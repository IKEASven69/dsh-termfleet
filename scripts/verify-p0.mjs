// ═══════════════════════════════════════════════════════════════════════════
// verify-p0.mjs — TermFleet P0 端到端实测（自足：自拉 lead+member 双真实实例）
//
// 场景（每个真实断言，结束打印 `场景名→PASS/FAIL+证据`）：
//   S1 一句话入队：lead 面板「取码」生成 TF-JOIN 邀请码 → member 面板仅粘贴该码
//      点「入队」→ 配对成功、member 出现在 lead 成员列表。
//   S2 会话流镜像：成员 dsh 会话产生对话（probe-session/write 触发真实 agentLoop
//      会话：用户消息 + 助手回合）→ lead 面板「会话对话流」按序出现对应气泡
//      （实时，等待有上限并记录耗时）。
//   S3 插话：lead 面板向成员插话一句 → 成员 dsh 会话真实出现该句（member 侧
//      session/event user/message 回显）→ lead 端显示送达（followup-ack）。
//   S4 同意门：无同意时 member-stream 403、interject 403；授 ro 后流可见但
//      interject 403 readonly-channel；授 rw 后插话通（200+ack）。
//   S5 通知闭环：成员加入（member-join）与同意请求（consent-request，带「去处理」）
//      在 lead 面板出现 tf-notify 弹条。
//   S6 成员侧断开传播：双实例各自独立同意库（跨机现实），成员机 /consent/end 断开 rw
//      通道 → lead 实时 member-stream 即时收 event:'end'、lead 同意库同步 ended、
//      重连 member-stream 403（旧环形缓冲不可重放）。
//   S7 邀请码跨机地址：pairing/code?u=<局域网总线地址> 显式进码（解码一致）；面板
//      tfAdvertise() 按浏览器 location 计算——非本机打开时给可达 ws 地址、本机回落 Host 头。
//   S8 成员面板自持静默：成员答复同意后不自开 pty、不自订阅 member-stream（全程 0 请求）、
//      不误弹「成员机不在线」toast（评审 #2 回归锁）。
//
// 隔离纪律：
//   - 双实例 DSH_HOME 指向本次运行的临时目录（os.tmpdir()），且 lead/member 各持
//     独立 USERPROFILE（各自一份插件令牌/同意库——跨机真实现实，撤销只能走总线），
//     不读写用户真实 ~/.dsh；结束杀干净自拉进程并删除临时目录。
//   - 默认端口 3180/3181；若被占用（例如用户自己的 dsh 实例在跑）自动顺延到
//     空闲端口并在输出中如实标注实际端口——绝不杀用户进程（契约本身端口无关：
//     邀请码里的总线地址取自请求 Host 头）。
//
// 用法：node scripts/verify-p0.mjs
// 退出码：全 PASS=0，否则 1。
// ═══════════════════════════════════════════════════════════════════════════
import { spawn } from 'node:child_process'
import net from 'node:net'
import { mkdtempSync, readFileSync, existsSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DSH_BIN = 'C:/Users/20369/.version-fox/sdks/nodejs/node_modules/@deepseek-ai/dsh/lib/bin.js'
const TEAM_TOKEN = 'fleet-p0-e2e-2026'
const MEMBER_NAME = 'P0-MEMBER'
const SHOT_DIR = join(REPO, 'docs', 'audit', 'screens')
const RUN = Date.now().toString(36)
const MARK_S2 = `P0E2E-${RUN}-S2成员消息请回复`
const MARK_S3 = `P0E2E-${RUN}-S3来自lead的插话`

const results = []   // { name, ok, evidence }
const R = (name, ok, evidence) => { results.push({ name, ok, evidence }); console.log(`${ok ? '✅' : '❌'} ${name}→${ok ? 'PASS' : 'FAIL'} 证据: ${evidence}`) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function waitFor(fn, ms, step = 400, label = '') {
  const t0 = Date.now()
  for (;;) {
    let v = null
    try { v = await fn() } catch { v = null }
    if (v) return { v, ms: Date.now() - t0 }
    if (Date.now() - t0 > ms) throw new Error(`waitFor 超时(${ms}ms)${label ? '：' + label : ''}`)
    await sleep(step)
  }
}
const portFree = (port) => new Promise((res) => {
  const s = net.createConnection({ port, host: '127.0.0.1' })
  s.on('connect', () => { s.destroy(); res(false) })
  s.on('error', () => res(true))
})
async function pickPort(want) {
  let p = want
  while (!(await portFree(p))) { console.log(`[port] ${p} 已被占用（不碰他人进程），顺延 → ${p + 10}`); p += 10 }
  return p
}
const killTree = (pid) => new Promise((res) => {
  const k = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
  k.on('close', () => res()); k.on('error', () => { try { process.kill(Number(pid), 'SIGKILL') } catch {}; res() })
})

// ── dsh 实例拉起 ───────────────────────────────────────────────────────────
function launchDsh({ port, patchFile, dshHome, userProfile, envExtra, tag }) {
  const child = spawn(process.execPath, [DSH_BIN, '--patch', patchFile, '--profile', 'web', '--port', String(port), '--no-open'], {
    cwd: REPO,
    env: { ...process.env, DSH_HOME: dshHome, USERPROFILE: userProfile, ...envExtra },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let out = ''
  child.stdout.on('data', (d) => { out += String(d) })
  child.stderr.on('data', (d) => { out += String(d) })
  child.tag = tag
  child.out = () => out
  return child
}
async function waitReady(child, port, userProfile) {
  await waitFor(() => /http:\/\/127\.0\.0\.1:\d+\/\?token=\S+/.test(child.out()), 90000, 500, `${child.tag} 启动横幅`)
  const tokenPath = join(userProfile, '.dsh', 'termfleet', 'token.json')
  await waitFor(() => existsSync(tokenPath), 20000, 300, `${child.tag} 插件令牌文件`)
  const tok = JSON.parse(readFileSync(tokenPath, 'utf8')).token
  await waitFor(async () => {
    try { const r = await fetch(`http://127.0.0.1:${port}/dsh-termfleet/ping`, { headers: { authorization: 'Bearer ' + tok } }); return r.status === 200 } catch { return false }
  }, 30000, 500, `${child.tag} ping 200`)
  return tok
}

// ── SSE 读取（Node 侧直连证据） ────────────────────────────────────────────
async function sseProbe(url, token, { untilHello = true, maxMs = 6000 } = {}) {
  const ac = new AbortController()
  const events = []
  try {
    const res = await fetch(url, { headers: { authorization: 'Bearer ' + token }, signal: ac.signal })
    if (res.status !== 200) { try { ac.abort() } catch {} return { status: res.status, events } }
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let buf = '', cur = null
    const push = () => { if (cur) { events.push(cur); cur = null } }
    const deadline = Date.now() + maxMs
    for (;;) {
      const left = deadline - Date.now()
      if (left <= 0) break
      const timer = new Promise((r) => setTimeout(() => r({ done: true, value: undefined, _timeout: true }), left))
      const chunk = await Promise.race([reader.read(), timer])
      if (chunk._timeout || chunk.done) break
      buf += dec.decode(chunk.value, { stream: true })
      let idx
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).replace(/\r$/, ''); buf = buf.slice(idx + 1)
        if (line === '') {
          if (cur) {
            push()
            if (untilHello && events.some((e) => e.ev === 'hello')) { try { ac.abort() } catch {} return { status: res.status, events } }
          }
          continue
        }
        if (line.startsWith('event:')) cur = { ev: line.slice(6).trim(), data: '' }
        else if (line.startsWith('data:') && cur) cur.data += line.slice(5).trim()
      }
    }
    push()
    try { ac.abort() } catch {}
    return { status: res.status, events }
  } catch (e) {
    if (e && e.name === 'AbortError') return { status: 200, events }
    return { status: 0, events, err: String(e).slice(0, 120) }
  }
}

// ── 主流程 ─────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[preflight] dsh bin exists=${existsSync(DSH_BIN)} repo=${REPO}`)
  const leadPort = await pickPort(3180)
  const memberPort = await pickPort(3181)
  if (leadPort !== 3180 || memberPort !== 3181) console.log(`[port] ★ 实际端口 lead=${leadPort} member=${memberPort}（3180/3181 被占用时顺延，绝不杀用户进程）`)

  const tmp = mkdtempSync(join(tmpdir(), 'tf-p0-e2e-'))
  const dshHomeLead = join(tmp, 'dsh-lead')
  const dshHomeMember = join(tmp, 'dsh-member')
  // 双实例各自独立 USERPROFILE（跨机真实现实：lead/member 各持一份插件令牌/同意库，
  // 成员侧撤销只能经总线传播——不再被共享 consent.json 掩盖）
  const userProfileLead = join(tmp, 'home-lead')
  const userProfileMember = join(tmp, 'home-member')
  for (const d of [dshHomeLead, dshHomeMember, userProfileLead, userProfileMember]) mkdirSync(d, { recursive: true })
  mkdirSync(SHOT_DIR, { recursive: true })
  const patchFile = join(tmp, 'boot.patch.yml')
  writeFileSync(patchFile, `- insert:\n    - id: termfleet\n      name: 'D:/coding/dsh-termfleet/lib/index.js'\n      config: {}\n`)
  // 隔离 HOME 下插件 loadLlm 的兜底候选（~/.version-fox/.../dsh-llm）需要可达：
  // 在两个临时 home 里各建一个 junction 指向本机真实 dsh-llm（只读解析，不碰用户数据）
  for (const up of [userProfileLead, userProfileMember]) {
    try {
      const realLlm = 'C:/Users/20369/.version-fox/sdks/nodejs/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-llm'
      const jLink = join(up, '.version-fox', 'sdks', 'nodejs', 'node_modules', '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-llm')
      mkdirSync(dirname(jLink), { recursive: true })
      symlinkSync(realLlm, jLink, 'junction')
      console.log(`[tmp] dsh-llm junction ok(${basename(up)}): ${existsSync(join(jLink, 'lib', 'index.js'))}`)
    } catch (e) { console.log(`[tmp] dsh-llm junction 失败(若 loadLlm 首候选命中则无碍): ${e.message}`) }
  }
  console.log(`[tmp] ${tmp}`)

  const children = []
  let browser = null
  const SCEN = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8']
  try {
    // ── 拉 lead（env 指定角色/令牌；契约启动式同 ACCEPTANCE-M1，仅 HOME 隔离） ──
    const lead = launchDsh({ port: leadPort, patchFile, dshHome: dshHomeLead, userProfile: userProfileLead, envExtra: { TERMFLEET_ROLE: 'lead', TERMFLEET_TOKEN: TEAM_TOKEN, TERMFLEET_NAME: 'P0-LEAD' }, tag: 'lead' })
    children.push(lead)
    const TOK_LEAD = await waitReady(lead, leadPort, userProfileLead)
    console.log(`[lead] 就绪 port=${leadPort} ping=200 插件令牌已装载`)

    // ── 拉 member（关键：不带 TERMFLEET_ROLE/LEAD_URL/TOKEN——配对必须由邀请码完成） ──
    const member = launchDsh({ port: memberPort, patchFile, dshHome: dshHomeMember, userProfile: userProfileMember, envExtra: { TERMFLEET_NAME: MEMBER_NAME }, tag: 'member' })
    children.push(member)
    const TOK_MEMBER = await waitReady(member, memberPort, userProfileMember)
    console.log(`[member] 就绪 port=${memberPort}（独立 USERPROFILE，与 lead 无共享状态）`)

    // 令牌按实例区分（跨机现实：lead/member 各持一份插件令牌）
    const api = (base, path, method = 'GET', body) => fetch(`http://127.0.0.1:${base}/dsh-termfleet/${path}`, {
      method,
      headers: { authorization: 'Bearer ' + (base === memberPort ? TOK_MEMBER : TOK_LEAD), ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    const apiJson = async (base, path, method = 'GET', body) => { const r = await api(base, path, method, body); return { status: r.status, j: await r.json().catch(() => null) } }

    // 配对前体检：member 实例必须仍是 off（证明后面确实是被邀请码配对的）
    const prePair = await apiJson(memberPort, 'pairing')
    const preOff = prePair.j?.pairing?.role === 'off'
    console.log(`[S1] 配对前 member role=${prePair.j?.pairing?.role}（期望 off）env 隔离=${preOff}`)

    // ── 浏览器 ──
    browser = await chromium.launch({ args: ['--no-proxy-server'] })
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 950 }, locale: 'zh-CN' })
    const leadPage = await ctx.newPage()
    const memberPage = await ctx.newPage()
    // S8 证据采集：member 页对 member-stream 的全部请求计数（期望恒 0——成员不订阅自己）
    let memberMsReqs = 0
    memberPage.on('request', (r) => { if (r.url().includes('/dsh-termfleet/member-stream')) memberMsReqs++ })
    const hookNotify = (page) => page.evaluate(() => {
      window.__tfNotes = window.__tfNotes || []
      const seen = window.__tfSeen || (window.__tfSeen = new Set())
      const scan = () => {
        for (const el of document.querySelectorAll('#tfNotifWrap .tfnotif')) {
          const key = el.textContent
          if (!seen.has(key)) { seen.add(key); window.__tfNotes.push({ text: el.textContent, hasGo: !!el.querySelector('[data-tfgo]'), at: Date.now() }) }
        }
      }
      new MutationObserver(scan).observe(document.getElementById('tfNotifWrap'), { childList: true, subtree: true })
      scan()
      if (!window.__toastHooked) {
        window.__toastHooked = true
        const _t = window.toast
        window.toast = function (m) { (window.__toasts = window.__toasts || []).push(String(m)); return _t.call(window, m) }
      }
    })
    await leadPage.goto(`http://127.0.0.1:${leadPort}/dsh-termfleet/app?token=${encodeURIComponent(TOK_LEAD)}`, { waitUntil: 'domcontentloaded' })
    await leadPage.waitForTimeout(1200)
    await hookNotify(leadPage)
    await leadPage.evaluate(() => document.getElementById('navRemote').click()) // 远程页 → pollFleet 2.5s 起转
    await leadPage.waitForTimeout(600)

    // ═══ S1 一句话入队 ═══
    let s1Ok = false, s1Ev = '未执行', code = ''
    for (const [n, p] of [['lead', leadPage], ['member', memberPage]]) {
      p.on('pageerror', (e) => console.log(`[pageerror][${n}]`, String(e).slice(0, 200)))
    }
    try {
      await leadPage.evaluate(() => { const b = document.getElementById('setblk'); if (b && b.style.display === 'none') document.getElementById('setToggle').click() })
      await leadPage.evaluate(() => document.getElementById('pairCodeBtn').click())
      const wCode = await waitFor(async () => {
        const v = await leadPage.evaluate(() => document.getElementById('pairCode').value)
        return /^TF1-/.test(v) ? v : null
      }, 10000, 300, 'lead 面板「取码」生成邀请码')
      code = wCode.v
      console.log(`[S1] 邀请码 len=${code.length} 前缀=${code.slice(0, 8)}…`)
      // member 面板：仅粘贴该码 → 入队
      await memberPage.goto(`http://127.0.0.1:${memberPort}/dsh-termfleet/app?token=${encodeURIComponent(TOK_MEMBER)}`, { waitUntil: 'domcontentloaded' })
      await memberPage.waitForTimeout(1200)
      await hookNotify(memberPage)
      await memberPage.evaluate(() => document.getElementById('navRemote').click())
      await memberPage.waitForTimeout(600)
      await memberPage.fill('#joinCode', code)
      await memberPage.evaluate(() => document.getElementById('joinBtn').click())
      await waitFor(async () => ((await memberPage.evaluate(() => window.__toasts || [])).some((t) => t.includes('已加入'))), 10000, 300, 'member 入队 toast=已加入')
      console.log(`[S1] member 入队 toast=已加入；等待 lead 面板成员卡…`)
      // lead 面板成员列表出现 P0-MEMBER（pollFleet 2.5s 周期）
      let wCard = null
      try {
        wCard = await waitFor(async () => leadPage.evaluate((nm) => !!document.querySelector('#memberDevs [data-member="' + nm + '"]'), MEMBER_NAME), 20000, 500, 'lead 成员列表出现 ' + MEMBER_NAME)
      } catch (cardErr) {
        const fdbg = await apiJson(leadPort, 'fleet')
        const dom = await leadPage.evaluate(() => document.getElementById('memberDevs').innerText.replace(/\n/g, ' | ').slice(0, 200))
        throw new Error(`${cardErr.message}；[诊断] API /fleet=[${(fdbg.j?.members || []).map((m) => m.name).join(',')}] leadPanelDOM="${dom}"`)
      }
      const fleet = await apiJson(leadPort, 'fleet')
      const names = (fleet.j?.members || []).map((m) => m.name).join(',')
      s1Ok = names.split(',').includes(MEMBER_NAME)
      s1Ev = `配对前 member role=off(env 无角色/URL/令牌)；lead 面板「取码」得 TF1-码(len=${code.length}) → member 面板仅粘贴该码点「入队」→ toast=已加入 → ${wCard.ms}ms 内 lead 面板成员列表出现 [data-member=${MEMBER_NAME}]；API /fleet members=[${names}] (lead=:${leadPort} member=:${memberPort})`
      await leadPage.screenshot({ path: join(SHOT_DIR, 'p0-1-pairing-joined.png') })
    } catch (e) { s1Ev = '卡点：' + e.message }
    R('S1 一句话入队(TF-JOIN 粘贴即配对)', s1Ok, s1Ev)

    // 后续场景都依赖 S1 的成员卡；没有则直接失败收场
    if (!s1Ok) throw new Error('S1 未过——成员未上线，S2~S5 无法继续')

    // ═══ S4a 无同意门：member-stream 403 + interject 403 + 面板订阅被拒 ═══
    const ms403 = await sseProbe(`http://127.0.0.1:${leadPort}/dsh-termfleet/member-stream?m=${encodeURIComponent(MEMBER_NAME)}`, TOK_LEAD, { maxMs: 3000 })
    const ij403 = await apiJson(leadPort, 'interject', 'POST', { member: MEMBER_NAME, text: MARK_S3 })
    console.log(`[S4a] member-stream=${ms403.status}(${JSON.stringify(ms403).slice(0, 120)}) interject=${ij403.status} ${JSON.stringify(ij403.j)}`)
    await leadPage.evaluate((nm) => document.querySelector(`#memberDevs [data-member="${nm}"]`).click(), MEMBER_NAME)
    const ph403Res = await waitFor(async () => {
      const t = await leadPage.evaluate(() => document.getElementById('sfList').textContent)
      return t.includes('订阅被拒') ? t.slice(0, 80) : null
    }, 10000, 400, '面板订阅 403 占位出现')
    const ph403 = ph403Res.v

    // ═══ S2 setup：lead 请求会话镜像 → member 授 ro（顺带采 S5 consent-request 弹条） ═══
    await leadPage.evaluate(() => document.getElementById('sfReqSess').click())
    await sleep(900)
    const notes1 = await leadPage.evaluate(() => window.__tfNotes)
    const consentNote = notes1.find((n) => n.text.includes('请求连接') || n.text.includes('连接请求'))
    let shotNotify = false
    if (consentNote) { await leadPage.screenshot({ path: join(SHOT_DIR, 'p0-4-tf-notify.png') }); shotNotify = true }
    console.log(`[S5b] consent-request 弹条=${JSON.stringify(consentNote)} 截图=${shotNotify}`)
    // member 面板出现同意卡 → 仅只读
    await waitFor(async () => memberPage.evaluate(() => !!document.getElementById('csR')), 15000, 400, 'member 同意卡(仅只读按钮)')
    await memberPage.screenshot({ path: join(SHOT_DIR, 'p0-5-member-consent-ro.png') })
    await memberPage.evaluate(() => document.getElementById('csR').click())
    const roDecide = await waitFor(async () => {
      const l = await apiJson(leadPort, 'consent/list')
      const c = (l.j?.consents || []).find((x) => x.type === 'sess' && x.status === 'active' && x.target === 'member:' + MEMBER_NAME)
      return c && c.mode === 'ro' ? c : null
    }, 15000, 400, 'ro 同意经总线在 lead 生效')
    console.log(`[S2 setup] ro 通道 ${roDecide.v.id} 生效（成员机答复→lead 生效 ${roDecide.ms}ms）`)
    // 面板语义：同意开放后「重新点选成员即可」订阅（sfReqSess 不置 CH，无自动重订阅——走面板 403 提示的人工路径）
    await leadPage.evaluate((nm) => document.querySelector(`#memberDevs [data-member="${nm}"]`).click(), MEMBER_NAME)
    await waitFor(async () => (await leadPage.evaluate(() => document.getElementById('sfState').textContent)) === '订阅中', 15000, 400, 'lead 面板重选成员后订阅中')
    const msRo = await sseProbe(`http://127.0.0.1:${leadPort}/dsh-termfleet/member-stream?m=${encodeURIComponent(MEMBER_NAME)}`, TOK_LEAD, { maxMs: 5000 })
    const helloRo = msRo.events.find((e) => e.ev === 'hello')
    let helloConsentId = '?', helloMode = '?'
    try { const h = JSON.parse(helloRo.data); helloConsentId = h.consentId; helloMode = h.mode } catch {}
    console.log(`[S4b] ro 下 member-stream=${msRo.status} hello(consentId=${helloConsentId} mode=${helloMode})`)

    // ═══ S2 会话流镜像：成员 dsh 会话产生对话（probe write = 真实 agentLoop 会话） ═══
    let s2Ok = false, s2Ev = '未执行'
    w2Safe = {}
    try {
      const t2 = Date.now()
      const w2 = await apiJson(memberPort, 'probe-session/write', 'POST', { text: MARK_S2 })
      w2Safe = w2
      const writeMs = Date.now() - t2
      console.log(`[S2] member probe write=${w2.status} ok=${w2.j?.ok} echoSeq=${w2.j?.echoSeq} writeMs=${writeMs}`)
      const u = await waitFor(async () => {
        const i = await leadPage.evaluate((mk) => {
          const rows = [].slice.call(document.querySelectorAll('#sfList .sfmsg'))
          for (let k = rows.length - 1; k >= 0; k--) if (rows[k].classList.contains('sf-user') && rows[k].textContent.includes(mk)) return k
          return -1
        }, MARK_S2)
        return i >= 0 ? i : null
      }, 20000, 400, 'lead 面板出现成员输入气泡')
      const userMs = Date.now() - t2
      const a = await waitFor(async () => {
        const n = await leadPage.evaluate((ui) => {
          const rows = [].slice.call(document.querySelectorAll('#sfList .sfmsg'))
          for (let k = ui + 1; k < rows.length; k++) if (rows[k].classList.contains('sf-assistant')) return k
          return -1
        }, u.v)
        return n >= 0 ? n : null
      }, 15000, 400, 'lead 面板在该用户消息之后出现助手气泡')
      const asstMs = Date.now() - t2
      const bubbleCnt = await leadPage.evaluate(() => document.querySelectorAll('#sfList .sfmsg').length)
      s2Ok = true
      s2Ev = `成员真 dsh 会话(${w2.j?.echoSessionId || 'probe-session'}) probe-write ok=${w2.j?.ok} echoSeq=${w2.j?.echoSeq}(${writeMs}ms)；会话同意(ro ${roDecide.v.id})激活期间上行→lead 面板「会话对话流」用户气泡 ${userMs}ms 出现、其后助手气泡 +${asstMs - userMs}ms（顺序 user→assistant 正确），面板共 ${bubbleCnt} 条气泡`
      await leadPage.screenshot({ path: join(SHOT_DIR, 'p0-2-sessflow-live.png') })
    } catch (e) { s2Ev = '卡点：' + e.message + `；probe-write 响应=${JSON.stringify(w2Safe || {}).slice(0, 200)}` }
    R('S2 会话流镜像(成员dsh会话→lead面板气泡按序实时)', s2Ok, s2Ev)

    // ═══ S4c ro 门：流可见但插话 403 readonly-channel ═══
    const ijRo = await apiJson(leadPort, 'interject', 'POST', { member: MEMBER_NAME, text: 'ro-should-deny-' + RUN })
    const roInpDisabled = await leadPage.evaluate(() => document.getElementById('sfInput').disabled)
    console.log(`[S4c] ro interject=${ijRo.status} ${JSON.stringify(ijRo.j)} 面板插话框禁用=${roInpDisabled}`)

    // ═══ 升 rw：结束 ro → 重新请求 → member 允许（成员页刷新使 CH 复位以采纳新请求） ═══
    const roId = roDecide.v.id
    const endR = await apiJson(leadPort, 'consent/end', 'POST', { id: roId })
    console.log(`[rw] end ro ${roId} → ${endR.status} status=${endR.j?.consent?.status}`)
    await sleep(600)
    await leadPage.evaluate((nm) => document.querySelector(`#memberDevs [data-member="${nm}"]`).click(), MEMBER_NAME) // 重开订阅流（ended 后 sfReqSess 重新可见）
    await sleep(1200)
    await leadPage.evaluate(() => document.getElementById('sfReqSess').click())
    await memberPage.reload({ waitUntil: 'domcontentloaded' })
    await memberPage.waitForTimeout(1500)
    await hookNotify(memberPage)
    await memberPage.evaluate(() => document.getElementById('navRemote').click())
    await waitFor(async () => memberPage.evaluate(() => !!document.getElementById('csA')), 15000, 400, '刷新后 member 第二张同意卡(允许按钮)')
    await memberPage.screenshot({ path: join(SHOT_DIR, 'p0-5-member-consent-rw.png') })
    await memberPage.evaluate(() => document.getElementById('csA').click())
    const rwDecide = await waitFor(async () => {
      const l = await apiJson(leadPort, 'consent/list')
      const c = (l.j?.consents || []).find((x) => x.type === 'sess' && x.status === 'active' && x.target === 'member:' + MEMBER_NAME)
      return c && c.mode === 'rw' ? c : null
    }, 15000, 400, 'rw 同意经总线在 lead 生效')
    console.log(`[rw] rw 通道 ${rwDecide.v.id} 生效`)
    // 重选成员重建实时流（ack 经 member-stream SSE 回面板）
    await leadPage.evaluate((nm) => document.querySelector(`#memberDevs [data-member="${nm}"]`).click(), MEMBER_NAME)
    await waitFor(async () => (await leadPage.evaluate(() => document.getElementById('sfState').textContent)) === '订阅中', 15000, 400, 'rw 后重选成员订阅中')
    await waitFor(async () => leadPage.evaluate(() => !document.getElementById('sfInput').disabled), 15000, 400, 'lead 插话输入框启用(rw)')
    const msRw = await sseProbe(`http://127.0.0.1:${leadPort}/dsh-termfleet/member-stream?m=${encodeURIComponent(MEMBER_NAME)}`, TOK_LEAD, { maxMs: 4000 })
    console.log(`[rw] rw 下 member-stream=${msRw.status} events=[${msRw.events.map((e) => e.ev).join(',')}]`)

    // ═══ S3 插话：lead 面板输入 → 成员会话真实出现 → followup-ack 送达 ═══
    let s3Ok = false, s3Ev = '未执行'
    try {
      const t3 = Date.now()
      await leadPage.fill('#sfInput', MARK_S3)
      await leadPage.evaluate(() => document.getElementById('sfSend').click())
      let ackAt = 0, ackText = ''
      const a = await waitFor(async () => {
        const t = await leadPage.evaluate(() => { const p = document.querySelector('#sfList .sfack'); return p ? p.textContent : '' })
        return t.includes('已送达') ? t : null
      }, 20000, 400, 'followup-ack 已送达回执')
      ackAt = Date.now() - t3; ackText = a.v
      // 成员 dsh 会话真实出现该句（session/event user/message 回显）
      const probe = await apiJson(memberPort, 'probe-session')
      const hit = (probe.j?.sessionEvents || []).find((e) => e.type === 'user/message' && (e.brief || '').includes(MARK_S3))
      // lead 侧回执存证：/fleet lastFollowupAck（契约 C 闭环的服务端证据）
      const fleet2 = await apiJson(leadPort, 'fleet')
      const ack2 = (fleet2.j?.members || []).find((m) => m.name === MEMBER_NAME)?.lastFollowupAck
      s3Ok = !!hit && ack2?.ok === true
      s3Ev = `插话经 rw 通道 ${rwDecide.v.id} 下发；成员 dsh 会话(${probe.j?.probeSessionId}) user/message 回显 seq=${hit?.seq} brief="${(hit?.brief || '').slice(0, 50)}…"；面板回执 "${(ackText || '').trim()}" 耗时 ${ackAt}ms；API /fleet lastFollowupAck=${JSON.stringify(ack2)}`
      await leadPage.screenshot({ path: join(SHOT_DIR, 'p0-3-interject-ack.png') })
    } catch (e) { s3Ev = '卡点：' + e.message }
    R('S3 插话(lead面板→成员dsh会话真实出现→followup-ack送达)', s3Ok, s3Ev)

    // ═══ S4 判定 ═══
    R('S4 同意门(无同意403/ro流可见但禁写/rw插话通)',
      ms403.status === 403 && ij403.status === 403 && ij403.j?.error === 'no-consent' && !!ph403
      && msRo.status === 200 && !!helloRo && ijRo.status === 403 && ijRo.j?.error === 'readonly-channel' && roInpDisabled
      && msRw.status === 200 && s3Ok,
      `无同意: member-stream=${ms403.status} interject=${ij403.status}(${ij403.j?.error}) 面板显示"${(ph403 || '').slice(0, 40)}…"；ro: member-stream=${msRo.status}(hello consentId=${helloConsentId} mode=${helloMode}) interject=${ijRo.status}(${ijRo.j?.error}) 面板插话框禁用=${roInpDisabled}；rw: member-stream=${msRw.status} 插话 200+ack(见 S3)`)

    // ═══ S5 通知闭环 ═══
    const notes = await leadPage.evaluate(() => window.__tfNotes)
    const joinNote = notes.find((n) => n.text.includes('上线'))
    R('S5 通知闭环(member-join/consent-request 弹条)',
      !!joinNote && !!consentNote && consentNote.hasGo && shotNotify,
      `lead 面板 tf-notify 弹条(.tfnotif)：member-join="${joinNote ? joinNote.text.slice(0, 40) : '缺失'}"；consent-request="${consentNote ? consentNote.text.slice(0, 46) : '缺失'}" 带「去处理」按钮=${consentNote ? consentNote.hasGo : '-'}；截图 p0-4-tf-notify.png`)

    // ═══ S6 成员侧断开跨总线传播：成员机 /consent/end（独立同意库，只能走总线）→
    //     lead 实时 member-stream 即时收 event:'end' + lead 同意库同步 ended + 重连 403（旧缓冲不可重放） ═══
    let s6Ok = false, s6Ev = '未执行'
    try {
      const rwId6 = rwDecide.v.id
      const url6 = `http://127.0.0.1:${leadPort}/dsh-termfleet/member-stream?m=${encodeURIComponent(MEMBER_NAME)}`
      // a) lead 侧开实时流（不因 hello 提前退出），等 hello/重放落地后成员机点「断开」
      const p6 = sseProbe(url6, TOK_LEAD, { untilHello: false, maxMs: 6000 })
      await sleep(1000)
      const endM = await apiJson(memberPort, 'consent/end', 'POST', { id: rwId6 })
      const ms6 = await p6
      const endEv6 = ms6.events.find((e) => e.ev === 'end')
      // b) lead 同意库经总线同步为 ended（lead/member 同意库独立，不经总线则无从得知）
      const l6 = await apiJson(leadPort, 'consent/list')
      const c6 = (l6.j?.consents || []).find((x) => x.id === rwId6)
      // c) 重连被拒：member-stream 403（旧缓冲不可重放）
      const ms6After = await sseProbe(url6, TOK_LEAD, { maxMs: 3000 })
      s6Ok = endM.status === 200 && !!endEv6 && c6?.status === 'ended' && ms6After.status === 403
      s6Ev = `成员机(独立同意库) /consent/end ${rwId6} → ${endM.status}(status=${endM.j?.consent?.status})；lead 实时流收 event:'end'=${!!endEv6}(${endEv6 ? String(endEv6.data).slice(0, 60) : '缺失'})；lead consent/list ${rwId6}.status=${c6?.status || '缺失'}；重连 member-stream=${ms6After.status}${ms6After.status === 403 ? '(no-active-consent 拒绝重连/重放)' : ''}`
    } catch (e) { s6Ev = '卡点：' + e.message }
    R('S6 成员侧断开跨总线传播(成员机断开→lead流即时end+库同步ended+重连403)', s6Ok, s6Ev)

    // ═══ S7 邀请码跨机地址：?u= 显式进码 + 面板 tfAdvertise 按 location 计算 ═══
    let s7Ok = false, s7Ev = '未执行'
    try {
      const advUrl = 'ws://192.168.7.20:3182/dsh-termfleet/bus'
      const codeU = await apiJson(leadPort, 'pairing/code?u=' + encodeURIComponent(advUrl))
      let decU = null
      try { decU = JSON.parse(Buffer.from(String(codeU.j?.code || '').slice(4), 'base64url').toString('utf8')).u } catch {}
      // 面板决策函数真测：非本机打开 → 可达 ws 地址；本机打开 → ''（回落 Host 头）
      const advLan = await leadPage.evaluate(() => tfAdvertise({ hostname: '192.168.7.20', host: '192.168.7.20:3182', protocol: 'http:' }))
      const advLocal = await leadPage.evaluate(() => tfAdvertise({ hostname: '127.0.0.1', host: '127.0.0.1:3180', protocol: 'http:' }))
      const advLoop = await leadPage.evaluate(() => tfAdvertise({ hostname: 'localhost', host: 'localhost:3180', protocol: 'http:' }))
      const advV6 = await leadPage.evaluate(() => tfAdvertise({ hostname: '[::1]', host: '[::1]:3180', protocol: 'http:' }))
      s7Ok = codeU.status === 200 && decU === advUrl && advLan === advUrl && advLocal === '' && advLoop === '' && advV6 === ''
      s7Ev = `GET pairing/code?u=${advUrl} → ${codeU.status} 码内解码 u=${decU}（一致=${decU === advUrl}）；面板 tfAdvertise(局域网)=${advLan}、(127.0.0.1)='${advLocal}'、(localhost)='${advLoop}'、([::1]带括号)='${advV6}'——跨机时码内地址成员可达，不再被 Host 头改写困在 127.0.0.1`
    } catch (e) { s7Ev = '卡点：' + e.message }
    R('S7 邀请码跨机地址(?u=显式进码+面板按location算可达地址)', s7Ok, s7Ev)

    // ═══ S8 成员面板自持静默：答复同意后不自开 pty/不自订阅/不误弹（评审 #2 回归锁） ═══
    const memberToasts = await memberPage.evaluate(() => (window.__toasts || []).join(' | '))
    const s8Ok = memberMsReqs === 0 && !memberToasts.includes('成员机不在线')
    R('S8 成员面板自持静默(成员答复后0次自订阅member-stream+无误弹)',
      s8Ok, `member 页全程 member-stream 请求数=${memberMsReqs}(期望0)；member 页 toasts=[${memberToasts.slice(0, 200)}]`)

    // 汇总（每场景一行）
    console.log('\n═══ P0 E2E 结果 ═══')
    for (const r of results) console.log(`${r.name}→${r.ok ? 'PASS' : 'FAIL'} 证据: ${r.evidence}`)
    const allPass = results.length === 8 && results.every((r) => r.ok)
    console.log(`[exit] ${allPass ? 0 : 1}（全 PASS=0）`)
    return allPass ? 0 : 1
  } catch (e) {
    console.error('[fatal]', e?.stack || e)
    for (const c of children) { try { console.error(`[${c.tag} tail]`, c.out().slice(-600)) } catch {} }
    for (const s of SCEN) if (!results.some((r) => r.name.startsWith(s))) R(s + '(未执行到)', false, '前置场景失败，本场景未执行')
    return 1
  } finally {
    try { if (browser) await browser.close() } catch {}
    for (const c of children) { try { await killTree(c.pid); console.log(`[cleanup] ${c.tag} pid=${c.pid} 已 taskkill /T /F`) } catch {} }
    await sleep(1200)
    for (const p of [leadPort, memberPort]) console.log(`[cleanup] port ${p} free=${await portFree(p)}`)
    try { rmSync(tmp, { recursive: true, force: true }); console.log(`[cleanup] 临时目录已删除 ${tmp}`) } catch (e) { console.log(`[cleanup] 临时目录删除失败(残留于 tmp，无害): ${e.message}`) }
  }
}

// w2Safe：S2 失败路径引用的探针响应占位
let w2Safe = {}
process.exit(await main())
