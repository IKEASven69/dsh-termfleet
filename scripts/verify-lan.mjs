// ═══════════════════════════════════════════════════════════════════════════
// verify-lan.mjs — 跨机路径单机实测：lead + lan-forwarder + 走真实局域网接口的成员
//
// 与 verify-p0.mjs（同机回环双实例）的差别：本脚本让关键流量走【非回环接口】——
//   ① 浏览器以 http://<局域网IP>:<转发端口>/ 打开 lead 面板（真实 LAN 接口 + forwarder +
//      Host 改写）；② tfAdvertise 在非回环 origin 下算出 ws://<局域网IP>:<转发端口>/...
//      并随邀请码下发行（S7 曾只在纯函数层验证这条拼接链）；③ 成员经该地址出站连接，
//      WS Upgrade 与后续帧全部穿过 forwarder。
// 它仍不能替代真两台物理机（第二台的防火墙/时钟偏移/录屏），但把本机能压的跨机
// 路径全部压掉。TUN 劫持时如实退出（判定法：临时监听器对局域网 IP 无响应）。
//
// 用法：node scripts/verify-lan.mjs    退出码：全 PASS=0
// ═══════════════════════════════════════════════════════════════════════════
import { spawn } from 'node:child_process'
import net from 'node:net'
import os from 'node:os'
import http from 'node:http'
import { mkdtempSync, readFileSync, existsSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DSH_BIN = 'C:/Users/20369/.version-fox/sdks/nodejs/node_modules/@deepseek-ai/dsh/lib/bin.js'
const TEAM_TOKEN = 'fleet-lan-e2e'
const MEMBER_NAME = 'LAN-MEMBER'
const SHOT_DIR = join(REPO, 'docs', 'audit', 'screens')
const RUN = Date.now().toString(36)
const MARK = `LANE2E-${RUN}-经转发器的成员消息`

const results = []
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
async function pickPort(want) { let p = want; while (!(await portFree(p))) p += 10; return p }
const killTree = (pid) => new Promise((res) => {
  const k = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
  k.on('close', () => res()); k.on('error', () => { try { process.kill(Number(pid), 'SIGKILL') } catch {}; res() })
})
function launchDsh({ port, patchFile, dshHome, userProfile, envExtra, tag }) {
  const child = spawn(process.execPath, [DSH_BIN, '--patch', patchFile, '--profile', 'web', '--port', String(port), '--no-open'], {
    cwd: REPO, env: { ...process.env, DSH_HOME: dshHome, USERPROFILE: userProfile, ...envExtra }, stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.tag = tag
  let out = ''
  child.stdout.on('data', (d) => { out += String(d) })
  child.stderr.on('data', (d) => { out += String(d) })
  child.out = () => out
  return child
}
async function waitReady(port, userProfile) {
  const tokPath = join(userProfile, '.dsh', 'termfleet', 'token.json')
  await waitFor(() => existsSync(tokPath), 20000, 300, '插件令牌文件')
  const tok = JSON.parse(readFileSync(tokPath, 'utf8')).token
  await waitFor(async () => {
    try { const r = await fetch(`http://127.0.0.1:${port}/dsh-termfleet/ping`, { headers: { authorization: 'Bearer ' + tok } }); return r.status === 200 } catch { return false }
  }, 30000, 500, 'ping 200')
  return tok
}
const api = (base, tok, path, method = 'GET', body) => fetch(`http://127.0.0.1:${base}/dsh-termfleet/${path}`, {
  method,
  headers: { authorization: 'Bearer ' + tok, ...(body ? { 'content-type': 'application/json' } : {}) },
  body: body ? JSON.stringify(body) : undefined,
})

// 局域网 IP 自动探测（非内部 IPv4），并用临时监听器实测非回环接口真的可达（TUN 劫持判定法）
async function detectLanIp() {
  const candidates = []
  for (const nics of Object.values(os.networkInterfaces())) {
    for (const n of nics || []) if (n.family === 'IPv4' && !n.internal) candidates.push(n.address)
  }
  const prefer = candidates.find((a) => a.startsWith('192.168.')) || candidates[0]
  if (!prefer) throw new Error('未找到非内部 IPv4 地址——无局域网环境')
  const reachable = await new Promise((res) => {
    const s = net.createServer((c) => { c.write('HTTP/1.1 200 OK\r\ncontent-length:2\r\n\r\nok'); c.end() })
    s.listen(0, '0.0.0.0', () => {
      const port = s.address().port
      const req = http.get(`http://${prefer}:${port}/`, (r) => {
        let b = ''; r.on('data', (d) => (b += d)); r.on('end', () => { s.close(); res(b.includes('ok')) })
      })
      req.setTimeout(3000, () => { req.destroy(); s.close(); res(false) })
      req.on('error', () => { s.close(); res(false) })
    })
  })
  if (!reachable) throw new Error(`局域网 IP ${prefer} 自测不通——TUN/代理在劫持本机非回环流量（老判定法），跨机路径实测不可进行`)
  return prefer
}

async function main() {
  const lanIp = await detectLanIp()
  console.log(`[lan] 局域网接口实测可达：${lanIp}（TUN 未劫持）`)
  const leadPort = await pickPort(3190)
  const memberPort = await pickPort(3181)
  const lanPort = await pickPort(3182)

  const tmp = mkdtempSync(join(tmpdir(), 'tf-lan-e2e-'))
  for (const d of [join(tmp, 'dl'), join(tmp, 'dm'), join(tmp, 'hl'), join(tmp, 'hm')]) mkdirSync(d, { recursive: true })
  mkdirSync(SHOT_DIR, { recursive: true })
  const patchFile = join(tmp, 'boot.patch.yml')
  writeFileSync(patchFile, `- insert:\n    - id: termfleet\n      name: 'D:/coding/dsh-termfleet/lib/index.js'\n      config: {}\n`)
  for (const up of [join(tmp, 'hl'), join(tmp, 'hm')]) {
    try {
      const real = 'C:/Users/20369/.version-fox/sdks/nodejs/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-llm'
      const j = join(up, '.version-fox', 'sdks', 'nodejs', 'node_modules', '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-llm')
      mkdirSync(dirname(j), { recursive: true }); symlinkSync(real, j, 'junction')
    } catch {}
  }

  const children = []
  let browser = null
  try {
    const lead = launchDsh({ port: leadPort, patchFile, dshHome: join(tmp, 'dl'), userProfile: join(tmp, 'hl'), envExtra: { TERMFLEET_ROLE: 'lead', TERMFLEET_TOKEN: TEAM_TOKEN, TERMFLEET_NAME: 'LAN-LEAD' }, tag: 'lead' })
    children.push(lead)
    const TOK_LEAD = await waitReady(leadPort, join(tmp, 'hl'))
    const fwd = spawn(process.execPath, [join(REPO, 'scripts', 'lan-forwarder.mjs')], {
      cwd: REPO, env: { ...process.env, TF_LAN_PORT: String(lanPort), TF_TARGET_PORT: String(leadPort) },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    children.push(fwd)
    fwd.on('exit', (c) => { if (c !== 0 && c !== null) console.log(`[fwd] 提前退出 code=${c}`) })
    await waitFor(async () => !(await portFree(lanPort)), 8000, 300, 'forwarder 监听')
    console.log(`[fwd] 0.0.0.0:${lanPort} → 127.0.0.1:${leadPort}`)

    browser = await chromium.launch({ args: ['--no-proxy-server'] })
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 950 }, locale: 'zh-CN' })
    const leadPage = await ctx.newPage()

    // L1 浏览器走【局域网地址】打开 lead 面板 → 取码 → 码内地址必须是局域网 ws 地址
    await leadPage.goto(`http://${lanIp}:${lanPort}/dsh-termfleet/app?token=${encodeURIComponent(TOK_LEAD)}`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    leadPage.on('pageerror', (e) => console.log(`[leadPage error]`, String(e).slice(0, 160)))
    await leadPage.waitForTimeout(1200)
    await leadPage.evaluate(() => document.getElementById('navRemote').click()) // 远程页激活 → pollFleet 起转（成员卡才存在）
    await leadPage.waitForTimeout(600)
    await leadPage.evaluate(() => { const b = document.getElementById('setblk'); if (b && b.style.display === 'none') document.getElementById('setToggle').click() })
    await leadPage.evaluate(() => document.getElementById('pairCodeBtn').click())
    const wCode = await waitFor(async () => {
      const v = await leadPage.evaluate(() => document.getElementById('pairCode').value)
      return /^TF1-/.test(v) ? v : null
    }, 10000, 300, 'LAN origin 下取码')
    const code = wCode.v
    const payload = JSON.parse(Buffer.from(code.slice(4), 'base64url').toString('utf8'))
    const wantU = `ws://${lanIp}:${lanPort}/dsh-termfleet/bus`
    const l1Ok = payload.u === wantU
    R('L1 邀请码地址(浏览器走LAN接口打开面板→tfAdvertise算出可达ws地址进码)', l1Ok,
      `面板 URL=http://${lanIp}:${lanPort}/…（非回环 origin）→ 码内 u=${payload.u}（期望 ${wantU}，一致=${l1Ok}）；S7 遗留的「?u= 拼接链路未在非回环 origin 实点 pairCodeBtn」就此闭环。截图 lan-1`)
    await leadPage.screenshot({ path: join(SHOT_DIR, 'lan-1-panel-lan-origin.png') })

    // L2 成员经该地址入队（粘贴即配对）→ 出站 WS 穿过 forwarder 上线
    const member = launchDsh({ port: memberPort, patchFile, dshHome: join(tmp, 'dm'), userProfile: join(tmp, 'hm'), envExtra: { TERMFLEET_NAME: MEMBER_NAME }, tag: 'member' })
    children.push(member)
    const TOK_MEMBER = await waitReady(memberPort, join(tmp, 'hm'))
    const memberPage = await ctx.newPage()
    await memberPage.goto(`http://127.0.0.1:${memberPort}/dsh-termfleet/app?token=${encodeURIComponent(TOK_MEMBER)}`, { waitUntil: 'domcontentloaded' })
    await memberPage.waitForTimeout(1000)
    await memberPage.evaluate(() => document.getElementById('navRemote').click())
    await memberPage.waitForTimeout(600)
    await memberPage.fill('#joinCode', code)
    await memberPage.evaluate(() => document.getElementById('joinBtn').click())
    // 结果断言（不依赖 UI toast）：member 本机 pairing 变为 member 且已连接
    await waitFor(async () => {
      const p = await api(memberPort, TOK_MEMBER, 'pairing').then((r) => r.json())
      return p.pairing?.role === 'member' && p.pairing?.leadUrl === wantU ? true : null
    }, 10000, 400, 'member 本机 pairing=member 且 leadUrl=码内 LAN 地址')
    const fleet = await waitFor(async () => {
      const r = await api(leadPort, TOK_LEAD, 'fleet').then((r) => r.json())
      return (r.members || []).find((m) => m.name === MEMBER_NAME) || null
    }, 20000, 500, 'member 经 forwarder 上线出现在 lead 成员列表')
    R('L2 跨转发器入队上线(成员出站 ws://LAN:port 经forwarder→lead)', !!fleet.v,
      `member 面板粘贴码入队 → 出站连接 ${wantU}（经 forwarder ${lanPort}→${leadPort}，Host 改写+WS Upgrade 透传）→ ${fleet.ms}ms 内 lead /fleet 出现 ${MEMBER_NAME}（bus 地址来自码内 u=，非回环接口实测）。截图 lan-2`)
    await leadPage.screenshot({ path: join(SHOT_DIR, 'lan-2-member-via-forwarder.png') })

    // L3 信任通道经转发器自动允许 + 会话数据双向穿过 forwarder
    await api(memberPort, TOK_MEMBER, 'pairing', 'POST', { trust: true })
    await api(leadPort, TOK_LEAD, 'consent/request', 'POST', { type: 'sess', target: 'member:' + MEMBER_NAME, auto: 'ro' })
    const roC = await waitFor(async () => {
      const l = await api(leadPort, TOK_LEAD, 'consent/list').then((r) => r.json())
      return (l.consents || []).find((x) => x.type === 'sess' && x.status === 'active' && x.mode === 'ro' && x.target === 'member:' + MEMBER_NAME) || null
    }, 12000, 400, '信任自动允许经转发器生效')
    const w = await api(memberPort, TOK_MEMBER, 'probe-session/write', 'POST', { text: MARK }).then((r) => r.json())
    const seen = await waitFor(async () => {
      const r = await api(leadPort, TOK_LEAD, 'fleet?r=20').then((r) => r.json())
      const m = (r.members || []).find((x) => x.name === MEMBER_NAME)
      return (m?.recentEvents || []).some((e) => String(e.text || '').includes(MARK)) ? true : null
    }, 15000, 500, '成员会话事件经转发器上行到 lead')
    await leadPage.waitForSelector(`#memberDevs [data-member="${MEMBER_NAME}"]`, { timeout: 15000 })
    const clickDiag = await leadPage.evaluate((nm) => {
      const el = document.querySelector(`#memberDevs [data-member="${nm}"]`)
      if (!el) return 'element-null'
      if (typeof el.onclick !== 'function') return 'onclick-not-bound'
      el.click()
      return 'clicked, sfState=' + document.getElementById('sfState').textContent
    }, MEMBER_NAME)
    console.log(`[L3 click] ${clickDiag}`)
    let sfDiag = ''
    try {
      await waitFor(async () => {
        sfDiag = await leadPage.evaluate(() => {
          const ph = document.querySelector('#sfPh')
          return document.getElementById('sfState').textContent + '|' + (ph ? ph.textContent.slice(0, 50) : document.getElementById('sfList').textContent.slice(0, 50))
        })
        return sfDiag.split('|')[0] === '订阅中' ? sfDiag : null
      }, 15000, 500, 'lead 面板经 LAN 订阅成员对话流')
    } catch (e) {
      const devDump = await leadPage.evaluate(() => ({ timer: !!window._fleetTimer, devs: document.getElementById('memberDevs').innerText.slice(0, 80) }))
      console.log(`[L3 diag] sfState|内容=${sfDiag}；fleetTimer=${devDump.timer}；memberDevs="${devDump.devs.replace(/\n/g, ' | ')}"`)
      throw e
    }
    R('L3 数据双向穿转发器(信任自动允许+会话事件上行+面板SSE下行)',
      !!roC.v && !!seen.v && w.ok === true,
      `信任 ro 通道 ${roC.v?.id} 自动生效(${roC.ms}ms，帧双向经转发器)→成员 probe write ok=${w.ok}→lead /fleet recentEvents 含「${MARK.slice(0, 20)}…」(${seen.ms}ms，上行经转发器)；lead 面板经 LAN 地址订阅=订阅中(SSE 下行经转发器)。截图 lan-3`)
    await leadPage.screenshot({ path: join(SHOT_DIR, 'lan-3-stream-via-forwarder.png') })

    const allPass = results.length === 3 && results.every((r) => r.ok)
    console.log(`[exit] ${allPass ? 0 : 1}（全 PASS=0）`)
    return allPass ? 0 : 1
  } catch (e) {
    console.error('[fatal]', e?.stack || e)
    for (const s of ['L1', 'L2', 'L3']) if (!results.some((r) => r.name.startsWith(s))) R(s + '(未执行到)', false, '前置失败，未执行')
    return 1
  } finally {
    try { if (browser) await browser.close() } catch {}
    for (const c of children) { try { await killTree(c.pid) } catch {} }
    await sleep(1200)
    try { rmSync(tmp, { recursive: true, force: true }) } catch {}
  }
}

process.exit(await main())
