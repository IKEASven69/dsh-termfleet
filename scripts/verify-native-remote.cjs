// 原生化第二步验收：右栏 tab 原生「远程」视图——双实例 + 信任通道 + 对话流气泡 + 插话
// 用法：node scripts/verify-native-remote.cjs   退出码：全 PASS=0
const { chromium } = require('playwright')
const { spawn } = require('node:child_process')
const net = require('node:net')
const { mkdtempSync, readFileSync, existsSync, mkdirSync, writeFileSync, rmSync, symlinkSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join, dirname } = require('node:path')
const { fileURLToPath } = require('node:url')

const REPO = 'D:/coding/dsh-termfleet'
const DSH_BIN = 'C:/Users/20369/.version-fox/sdks/nodejs/node_modules/@deepseek-ai/dsh/lib/bin.js'
const TEAM_TOKEN = 'fleet-native-remote'
const MEMBER_NAME = 'NR-MEMBER'
const MARK = `NRE2E-${Date.now().toString(36)}-原生远程对话`
const results = []
let pageErrs = 0
const R = (name, ok, evidence) => { results.push({ ok }); console.log(`${ok ? '✅' : '❌'} ${name} 证据: ${evidence}`) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function waitFor(fn, ms, step = 400, label = '') {
  const t0 = Date.now()
  for (;;) { let v = null; try { v = await fn() } catch { v = null } ; if (v) return v; if (Date.now() - t0 > ms) throw new Error('waitFor 超时' + (label ? '：' + label : '')); await sleep(step) }
}
const portFree = (port) => new Promise((res) => { const s = net.createConnection({ port, host: '127.0.0.1' }); s.on('connect', () => { s.destroy(); res(false) }); s.on('error', () => res(true)) })
async function pickPort(want) { let p = want; while (!(await portFree(p))) p += 10; return p }
const killTree = (pid) => new Promise((res) => { const k = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' }); k.on('close', () => res()); k.on('error', () => res()) })
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
  await waitFor(() => existsSync(tokPath), 20000, 300, '插件令牌')
  const tok = JSON.parse(readFileSync(tokPath, 'utf8')).token
  await waitFor(async () => { try { const r = await fetch(`http://127.0.0.1:${port}/dsh-termfleet/ping`, { headers: { authorization: 'Bearer ' + tok } }); return r.status === 200 } catch { return false } }, 30000, 500, 'ping')
  return tok
}
const api = (base, tok, path, method, body) => fetch(`http://127.0.0.1:${base}/dsh-termfleet/${path}`, { method: method || 'GET', headers: { authorization: 'Bearer ' + tok, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })

;(async () => {
  const leadPort = await pickPort(3192)
  const memberPort = await pickPort(3181)
  const tmp = mkdtempSync(join(tmpdir(), 'tf-nr-'))
  for (const d of [join(tmp, 'dl'), join(tmp, 'dm'), join(tmp, 'hl'), join(tmp, 'hm')]) mkdirSync(d, { recursive: true })
  const patchFile = join(tmp, 'boot.patch.yml')
  writeFileSync(patchFile, `- insert:\n    - id: termfleet\n      name: 'D:/coding/dsh-termfleet/lib/index.js'\n      config: {}\n`)
  for (const up of [join(tmp, 'hl'), join(tmp, 'hm')]) {
    try {
      const real = 'C:/Users/20369/.version-fox/sdks/nodejs/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-llm'
      const j = join(up, '.version-fox', 'sdks', 'nodejs', 'node_modules', '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-llm')
      mkdirSync(dirname(j), { recursive: true }); symlinkSync(real, j, 'junction')
    } catch (e) {}
  }
  const lead = launchDsh({ port: leadPort, patchFile, dshHome: join(tmp, 'dl'), userProfile: join(tmp, 'hl'), envExtra: { TERMFLEET_ROLE: 'lead', TERMFLEET_TOKEN: TEAM_TOKEN, TERMFLEET_NAME: 'NR-LEAD' }, tag: 'lead' })
  const TOK_LEAD = await waitReady(leadPort, join(tmp, 'hl'))
  const member = launchDsh({ port: memberPort, patchFile, dshHome: join(tmp, 'dm'), userProfile: join(tmp, 'hm'), envExtra: { TERMFLEET_NAME: MEMBER_NAME, TERMFLEET_LEAD_URL: `ws://127.0.0.1:${leadPort}/dsh-termfleet/bus`, TERMFLEET_TOKEN: TEAM_TOKEN, TERMFLEET_ROLE: 'member' }, tag: 'member' })
  const TOK_MEMBER = await waitReady(memberPort, join(tmp, 'hm'))
  await waitFor(async () => { const f = await api(leadPort, TOK_LEAD, 'fleet').then((r) => r.json()); return (f.members || []).some((m) => m.name === MEMBER_NAME) }, 20000, 500, '成员上线')
  console.log(`[boot] lead=${leadPort} member=${memberPort} 成员已上线`)
  // 成员开信任 → 后面 ⚡请求查看 会自动允许(只读)
  await api(memberPort, TOK_MEMBER, 'pairing', 'POST', { trust: true })

  const browser = await chromium.launch({ args: ['--no-proxy-server'] })
  const page = await browser.newPage({ viewport: { width: 1720, height: 1000 } })
  try {
    const launchMatch = lead.out().match(/http:\/\/127\.0\.0\.1:(\d+)\/\?token=(\S+)/)
    let pageErrs = 0
    page.on('pageerror', (e) => { const s = String(e); if (s.indexOf('tab2 has no pane') < 0) { pageErrs++; console.log('[pageerror]', s.slice(0, 220)) } })
    await page.goto(`http://127.0.0.1:${leadPort}/?token=${launchMatch[2]}`)
    await page.waitForTimeout(5000)
    await page.evaluate((t) => { try { localStorage.setItem('tf_token', t) } catch (e) {} }, TOK_LEAD)
    const dismissModals = async () => { await page.evaluate(() => { for (const t of ['继续', '稍后配置']) { const b = [].slice.call(document.querySelectorAll('button')).find((x) => x.textContent.trim() === t); if (b) b.click() } }) }
    await dismissModals(); await page.waitForTimeout(800); await dismissModals()
    await page.evaluate(() => {
      const btns = [].slice.call(document.querySelectorAll('button, [role="button"]'))
      const tog = btns.filter((b) => { const r = b.getBoundingClientRect(); return r.top < 60 && r.right > window.innerWidth - 120 && r.width < 60 })
      if (tog.length) tog[tog.length - 1].click()
    })
    await page.waitForTimeout(1200)
    await page.reload(); await page.waitForTimeout(4000)
    await dismissModals(); await page.waitForTimeout(600); await dismissModals()

    // 打开右栏 tab
    let boardUp = false
    for (let i = 0; i < 3; i++) {
      await page.evaluate((idx) => { const c = [].slice.call(document.querySelectorAll('*')).filter((el) => el.children.length === 0 && el.textContent.trim().indexOf('TermFleet') >= 0 && el.getBoundingClientRect().width < 300)[idx]; if (c) { c.click(); if (c.parentElement) c.parentElement.click() } }, i)
      await page.waitForTimeout(1300)
      if (await page.$('[data-tf-native-board]')) { boardUp = true; break }
    }
    if (!boardUp) throw new Error('右栏原生 tab 未挂载')

    // RN1 切到「远程」视图：成员卡出现
    await page.evaluate(() => { const b = [].slice.call(document.querySelectorAll('[data-tf-native] button')).find((x) => x.textContent.trim() === '远程'); if (b) b.click() })
    await waitFor(async () => page.evaluate(() => !!document.querySelector('[data-tf-native-remote]')), 8000, 300, '远程视图挂载')
    const chip = await waitFor(async () => {
      const inPage = await page.evaluate(async (mn) => {
        const t = localStorage.getItem('tf_token') || ''
        try { const r = await fetch('/dsh-termfleet/fleet', { headers: { authorization: 'Bearer ' + t } }); const d = await r.json(); return r.status + ':' + (d.members || []).map((m) => m.name).join(',') } catch (e) { return 'ERR:' + e.message }
      }, MEMBER_NAME)
      if (!inPage.includes(MEMBER_NAME)) { console.log('[RN1 diag] 页面内 fleet=' + inPage); return null }
      return page.evaluate(() => { const el = document.querySelector(`[data-nr-member]`); return el ? el.textContent : null })
    }, 15000, 500, '成员卡出现')
    R('RN1 远程视图+成员卡(分段切换/fleet 轮询)', !!chip, `原生远程视图挂载，成员卡「${(chip || '').trim()}」`)

    // RN2 点选成员卡 → ⚡请求查看 → 信任自动允许 → 订阅中
    await page.evaluate((nm) => { const el = document.querySelector(`[data-nr-member="${nm}"]`); if (el) el.click() }, MEMBER_NAME)
    await sleep(500)
    await page.evaluate(() => { const b = [].slice.call(document.querySelectorAll('[data-tf-native-remote] button')).find((x) => x.textContent.trim() === '⚡请求查看'); if (b) b.click() })
    try {
      await waitFor(async () => page.evaluate(() => document.querySelector('[data-nr-stream-state]').textContent === '订阅中'), 20000, 800, '订阅中(信任自动允许)')
    } catch (e) {
      const cl = await api(leadPort, TOK_LEAD, 'consent/list').then((r) => r.json())
      console.log('[RN2 diag] lead consents=', JSON.stringify((cl.consents || []).map((c) => ({ t: c.type, s: c.status, m: c.mode, tg: c.target, a: !!c.auto }))))
      const stTxt = await page.evaluate(() => document.querySelector('[data-tf-native-remote]').innerText.slice(0, 320))
      console.log('[RN2 diag] 视图=', stTxt.replace(/\n/g, ' | '))
      throw e
    }
    const roState = await page.evaluate(() => document.querySelector('[data-tf-native-remote]').innerText.includes('只读'))
    R('RN2 ⚡请求查看(信任自动允许只读→订阅中)', roState, `信任通道自动生效，流状态=订阅中，通道 chip=只读`)

    // RN3 成员会话事件 → 原生气泡实时
    const w = await api(memberPort, TOK_MEMBER, 'probe-session/write', 'POST', { text: MARK }).then((r) => r.json())
    let bubble = null
    try {
      bubble = await waitFor(async () => page.evaluate((mk) => { const l = document.querySelector('[data-nr-list]'); return l && l.innerText.includes(mk) ? l.innerText.slice(0, 80) : null }, MARK), 20000, 500, '原生气泡出现')
    } catch (e) {
      const f = await api(leadPort, TOK_LEAD, 'fleet?r=10').then((r) => r.json())
      const evs = JSON.stringify(((f.members || []).find((m) => m.name === MEMBER_NAME) || {}).recentEvents || []).slice(0, 300)
      console.log('[RN3 diag] lead recentEvents=', evs)
      const txt = await page.evaluate(() => document.querySelector('[data-nr-list]').innerText.slice(0, 200))
      console.log('[RN3 diag] 页面 list=', txt.replace(/\n/g, ' | '))
      throw e
    }
    R('RN3 会话事件→原生气泡(经转发路径上行)', !!bubble && w.ok === true, `成员 probe write ok=${w.ok} → 原生对话流「${(bubble || '').replace(/\n/g, ' | ')}」`)

    // RN4 rw：请求接管 → 成员 API 允许 → 插话框启用 → 插话送达
    await page.evaluate(() => { const b = [].slice.call(document.querySelectorAll('[data-tf-native-remote] button')).find((x) => x.textContent.trim() === '请求接管'); if (b) b.click() })
    const rwC = await waitFor(async () => {
      const l = await api(leadPort, TOK_LEAD, 'consent/list').then((r) => r.json())
      return (l.consents || []).find((x) => x.type === 'sess' && x.status === 'pending' && x.mode !== 'rw') || null
    }, 12000, 400, 'rw pending 已建')
    await api(memberPort, TOK_MEMBER, 'consent/decide', 'POST', { id: rwC.id, decision: 'allow' })
    await waitFor(async () => page.evaluate(() => { const i = document.querySelector('[data-tf-native-remote] input'); return i && !i.disabled }), 15000, 400, '插话框启用(rw)')
    const INTER = MARK + '-来自原生面板的插话'
    await page.fill('[data-tf-native-remote] input', INTER)
    await page.evaluate(() => { const b = [].slice.call(document.querySelectorAll('[data-tf-native-remote] button')).find((x) => x.textContent.trim() === '发'); if (b) b.click() })
    const acked = await waitFor(async () => page.evaluate(() => document.querySelector('[data-nr-list]').innerText.includes('✓已送达')), 20000, 500, 'ack ✓已送达回执')
    const echoed = await waitFor(async () => {
      const p = await api(memberPort, TOK_MEMBER, 'probe-session').then((r) => r.json())
      return (p.sessionEvents || []).some((e) => String(e.brief || '').includes(INTER)) ? true : null
    }, 20000, 500, '成员会话真实出现插话')
    R('RN4 请求接管+插话闭环(rw 手动允许→插话框启用→✓已送达+成员会话回显)', acked && !!echoed, `成员 API 允许 → 插话框启用 → 「${INTER.slice(0, 26)}…」ack ✓已送达=${acked} 成员会话回显=${!!echoed}`)

    await page.screenshot({ path: join(REPO, 'docs', 'audit', 'screens', 'nr-1-native-remote.png') })
  } catch (e) {
    console.error('[fatal]', e?.stack || e)
    await page.screenshot({ path: join(REPO, 'docs', 'audit', 'screens', 'nr-fail.png') }).catch(() => {})
    R('执行中断', false, String(e && e.message || e).slice(0, 120))
  } finally {
    if (pageErrs > 0) R('页面错误面(排除宿主已知噪音)', false, pageErrs + ' 条非预期 pageerror')
    await browser.close().catch(() => {})
    await killTree(lead.pid); await killTree(member.pid)
    await sleep(1200)
    try { rmSync(tmp, { recursive: true, force: true }) } catch (e) {}
  }
  console.log(`\n[exit] ${results.every((r) => r.ok) ? 0 : 1}`)
  process.exit(results.every((r) => r.ok) ? 0 : 1)
})()
