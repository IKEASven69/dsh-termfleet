// 原生化第一步验收：右栏 tab 原生任务板（React）——临时 dsh 实例 + 种子任务 + 同框断言
// 用法：node scripts/verify-native-board.cjs   退出码：全 PASS=0
const { chromium } = require('playwright')
const { spawn } = require('node:child_process')
const net = require('node:net')
const { mkdtempSync, readFileSync, existsSync, mkdirSync, writeFileSync, rmSync, symlinkSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join, dirname } = require('node:path')
const { fileURLToPath } = require('node:url')

const REPO = 'D:/coding/dsh-termfleet'
const DSH_BIN = 'C:/Users/20369/.version-fox/sdks/nodejs/node_modules/@deepseek-ai/dsh/lib/bin.js'
const TEAM_TOKEN = 'fleet-native-e2e'
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

;(async () => {
  const port = await pickPort(3191)
  const tmp = mkdtempSync(join(tmpdir(), 'tf-native-'))
  for (const d of [join(tmp, 'dsh'), join(tmp, 'home')]) mkdirSync(d, { recursive: true })
  const patchFile = join(tmp, 'boot.patch.yml')
  writeFileSync(patchFile, `- insert:\n    - id: termfleet\n      name: 'D:/coding/dsh-termfleet/lib/index.js'\n      config: {}\n`)
  try {
    const real = 'C:/Users/20369/.version-fox/sdks/nodejs/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-llm'
    const j = join(tmp, 'home', '.version-fox', 'sdks', 'nodejs', 'node_modules', '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-llm')
    mkdirSync(dirname(j), { recursive: true }); symlinkSync(real, j, 'junction')
  } catch (e) {}
  const child = spawn(process.execPath, [DSH_BIN, '--patch', patchFile, '--profile', 'web', '--port', String(port), '--no-open'], {
    cwd: REPO, env: { ...process.env, DSH_HOME: join(tmp, 'dsh'), USERPROFILE: join(tmp, 'home'), TERMFLEET_ROLE: 'lead', TERMFLEET_TOKEN: TEAM_TOKEN, TERMFLEET_NAME: 'NB-LEAD' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let out = ''
  child.stdout.on('data', (d) => { out += String(d) })
  child.stderr.on('data', (d) => { out += String(d) })
  try {
    const m = await waitFor(() => { const mm = out.match(/http:\/\/127\.0\.0\.1:(\d+)\/\?token=(\S+)/); return mm ? { launch: mm[2] } : null }, 90000, 500, 'dsh 启动横幅')
    var launchToken = m.launch
  } catch (e) { console.error('[fatal] 启动失败 tail:', out.slice(-400)); await killTree(child.pid); process.exit(1) }
  const tokPath = join(tmp, 'home', '.dsh', 'termfleet', 'token.json')
  await waitFor(() => existsSync(tokPath), 20000, 300, '插件令牌')
  const TOK = JSON.parse(readFileSync(tokPath, 'utf8')).token
  await waitFor(async () => { try { const r = await fetch(`http://127.0.0.1:${port}/dsh-termfleet/ping`, { headers: { authorization: 'Bearer ' + TOK } }); return r.status === 200 } catch { return false } }, 30000, 500, 'ping')
  console.log(`[boot] port=${port} 启动+插件令牌就绪`)

  // 种子任务：两态+绑定会话徽标样本+一个 wontfix（应入「其他」列）
  const api = (path, method, body) => fetch(`http://127.0.0.1:${port}/dsh-termfleet/${path}`, { method: method || 'GET', headers: { authorization: 'Bearer ' + TOK, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const t1 = await api('tasks/create', 'POST', { title: 'NB登录模块实现', desc: '种子任务描述', prio: 'P1', acceptance: [{ text: '验收条的种子任务' }] }).then((r) => r.json())
  const t2 = await api('tasks/create', 'POST', { title: 'NB时区修复' }).then((r) => r.json())
  await api('tasks/create', 'POST', { title: 'NB废弃样本', status: 'wontfix' })
  await api('tasks/action', 'POST', { id: t2.task.id, op: 'status', patch: { status: 'active' } })
  await api('tasks/action', 'POST', { id: t2.task.id, op: 'bind-session', patch: { session: { member: '', sessionId: 'nb-seed-session', label: '本机 · 种子' } } })
  console.log('[seed] 3 任务（含 wontfix 与绑定会话样本）')

  const browser = await chromium.launch({ args: ['--no-proxy-server'] })
  const page = await browser.newPage({ viewport: { width: 1720, height: 1000 } })
  try {
    const dismissModals = async () => { await page.evaluate(() => { for (const t of ['继续', '稍后配置']) { const b = [].slice.call(document.querySelectorAll('button')).find((x) => x.textContent.trim() === t); if (b) b.click() } }) }
    await page.goto(`http://127.0.0.1:${port}/?token=${launchToken}`)
    page.on('pageerror', (e) => { const s = String(e); if (s.indexOf('tab2 has no pane') < 0) { pageErrs++; console.log('[pageerror]', s.slice(0, 250)) } else console.log('[pageerror][宿主已知噪音]', s.slice(0, 80)) })
    page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 250)) })
    await page.waitForTimeout(5000)
    await page.evaluate((t) => { try { localStorage.setItem('tf_token', t) } catch (e) {} }, TOK)
    // 首启弹窗链（预览版说明 → API Key）逐个关掉
    await dismissModals()
    await page.waitForTimeout(800)
    await dismissModals()
    // 展开右侧栏（右上角面板切换图标）
    await page.evaluate(() => {
      const btns = [].slice.call(document.querySelectorAll('button, [role="button"]'))
      const tog = btns.filter((b) => { const r = b.getBoundingClientRect(); return r.top < 60 && r.right > window.innerWidth - 120 && r.width < 60 })
      if (tog.length) tog[tog.length - 1].click()
    })
    await page.waitForTimeout(1200)
    await page.reload(); await page.waitForTimeout(4000)
    await dismissModals()
    await page.waitForTimeout(600)
    await dismissModals()
    await page.screenshot({ path: join(REPO, 'docs', 'audit', 'screens', 'nb-0-web-before.png') })

    // 打开右栏 TermFleet tab：部分匹配候选逐个点击直到原生板出现
    const clicked = await page.evaluate(() => {
      const cands = [].slice.call(document.querySelectorAll('*')).filter((el) => el.children.length === 0 && el.textContent.trim().indexOf('TermFleet') >= 0 && el.getBoundingClientRect().width < 300)
      return cands.length
    })
    let boardUp = false
    for (let i = 0; i < Math.max(1, clicked); i++) {
      await page.evaluate((idx) => {
        const cands = [].slice.call(document.querySelectorAll('*')).filter((el) => el.children.length === 0 && el.textContent.trim().indexOf('TermFleet') >= 0 && el.getBoundingClientRect().width < 300)
        const el = cands[idx]
        if (!el) return
        el.click()
        if (el.parentElement) el.parentElement.click()
      }, i)
      await page.waitForTimeout(1500)
      if (await page.$('[data-tf-native-board]')) { boardUp = true; break }
    }
    if (!boardUp) {
      const dump = await page.evaluate(() => ({
        body: !!document.querySelector('[data-tf-sidebar-tab-body]'),
        native: !!document.querySelector('[data-tf-native-board]'),
        auth: !!document.querySelector('[data-tf-native="auth"]'),
        entryBtn: !!document.getElementById('tf-entry-btn'),
        tfClient: window.__tfClient || 'unset',
      }))
      console.log(`[diag] ${JSON.stringify(dump)}`)
      await page.screenshot({ path: join(REPO, 'docs', 'audit', 'screens', 'nb-click-after.png') })
    }
    R('N1 原生任务板挂载(右栏 TermFleet tab → data-tf-native-board)', boardUp, `右栏候选 chip×${clicked}，点击后 [data-tf-native-board] 出现=${boardUp}`)

    // 列与卡片内容断言
    const cols = await page.evaluate(() => [].slice.call(document.querySelectorAll('[data-nb-col]')).map((c) => c.getAttribute('data-nb-col')))
    const cardTexts = await page.evaluate(() => [].slice.call(document.querySelectorAll('[data-nb-card]')).map((c) => c.innerText.replace(/\n/g, ' | ').slice(0, 60)))
    const hasLogin = cardTexts.some((t) => t.includes('NB登录模块实现'))
    const hasActive = cardTexts.some((t) => t.includes('NB时区修复') && t.includes('⚡会话'))
    const wontfixInOther = await page.evaluate(() => { const o = document.querySelector('[data-nb-col="_other"]'); return o ? o.innerText.includes('NB废弃样本') : false })
    R('N2 看板列/卡片/徽标', cols.length >= 6 && hasLogin && hasActive && wontfixInOther,
      `列=[${cols.join(',')}]；登录卡在板=${hasLogin}；时区卡 active 态带 ⚡会话=${hasActive}；wontfix 入「其他」列=${wontfixInOther}`)

    // 卡片展开：验收勾选 + 状态流转按钮
    await page.evaluate(() => { const c = [].slice.call(document.querySelectorAll('[data-nb-card]')).find((x) => x.innerText.includes('NB登录模块实现')); if (c) { const head = c.firstElementChild; head.click() } })
    await page.waitForTimeout(600)
    const detail = await page.evaluate(() => { const c = [].slice.call(document.querySelectorAll('[data-nb-card]')).find((x) => x.innerText.includes('NB登录模块实现')); return c ? c.innerText : '' })
    const hasAcc = detail.includes('A1') && detail.includes('验收条的种子任务')
    const hasFlow = detail.includes('→ 就绪')
    R('N3 卡片展开(验收条/状态流转按钮)', hasAcc && hasFlow, `展开含 A1 验收文本=${hasAcc}；流转按钮「→ 就绪」存在=${hasFlow}；卡片文本="${detail.replace(/\n/g, ' | ').slice(0, 90)}…"`)

    // 状态流转：点「→ 就绪(A)」→ 卡片迁列
    await page.evaluate(() => { const c = [].slice.call(document.querySelectorAll('[data-nb-card]')).find((x) => x.innerText.includes('NB登录模块实现')); const b = [].slice.call(c.querySelectorAll('button')).find((b) => b.textContent.trim() === '→ 就绪(A)'); if (b) b.click() })
    await page.waitForTimeout(1200)
    const moved = await page.evaluate(() => { const col = document.querySelector('[data-nb-col="ready"]'); return col ? col.innerText.includes('NB登录模块实现') : false })
    R('N4 状态流转(→就绪(A) 后卡片迁列)', moved, `点击流转按钮后 ready 列含该卡=${moved}（unified-board 转移表经 /tasks/action 生效）`)

    // 快速建任务
    await page.fill('[data-tf-native-board] input', 'NB快速新建样本')
    await page.evaluate(() => { const b = [].slice.call(document.querySelectorAll('[data-tf-native-board] button')).find((x) => x.textContent.trim() === '建'); if (b) b.click() })
    await page.waitForTimeout(1200)
    const added = await page.evaluate(() => { const col = document.querySelector('[data-nb-col="needs-triage"]'); return col ? col.innerText.includes('NB快速新建样本') : false })
    R('N5 快速建任务(入待分诊列)', added, `快速输入+「建」→ 待分诊列出现 NB快速新建样本=${added}`)

    // flag 切回 iframe 完整面板（「完整面板」按钮在共享 tab 头部 [data-tf-native]，不在任务板容器内）
    await page.evaluate(() => { const b = [].slice.call(document.querySelectorAll('[data-tf-native] button')).find((x) => x.textContent.trim() === '完整面板'); if (b) b.click() })
    await page.waitForTimeout(1500)
    const iframeBack = await page.$('[data-tf-sidebar-tab-body] iframe')
    await page.evaluate(() => { const b = [].slice.call(document.querySelectorAll('button')).find((x) => x.textContent.trim() === '原生任务板'); if (b) b.click() })
    await page.waitForTimeout(1200)
    const nativeBack = await page.$('[data-tf-native-board]')
    R('N6 flag 双向切换(完整面板↔原生)', !!iframeBack && !!nativeBack, `「完整面板」→ iframe 主体=${!!iframeBack}；「原生任务板」→ 原生回归=${!!nativeBack}`)

    await page.screenshot({ path: join(REPO, 'docs', 'audit', 'screens', 'nb-1-native-board.png') })
  } catch (e) {
    console.error('[fatal]', e?.stack || e)
    await page.screenshot({ path: join(REPO, 'docs', 'audit', 'screens', 'nb-fail.png') }).catch(() => {})
    R('执行中断', false, String(e && e.message || e).slice(0, 120))
  } finally {
    await browser.close().catch(() => {})
    await killTree(child.pid)
    await sleep(1200)
    try { rmSync(tmp, { recursive: true, force: true }) } catch (e) {}
  }
  if (pageErrs > 0) R('页面错误面(排除宿主已知噪音)', false, pageErrs + ' 条非预期 pageerror')
  console.log(`\n[exit] ${results.every((r) => r.ok) ? 0 : 1}`)
  process.exit(results.every((r) => r.ok) ? 0 : 1)
})()
