// 0.2.1-alpha.2 共存验收：TermFleet（原生任务板）+ dsh-better-sidebar 同载一实例
// 断言：双插件进 manifest / 右栏双 tab 并存 / TermFleet 原生板挂载 / 切走再切回不互坏
// 用法：node scripts/verify-coexist-alpha2.cjs   退出码：全 PASS=0
const { chromium } = require('playwright')
const { spawn } = require('node:child_process')
const net = require('node:net')
const { mkdtempSync, readFileSync, existsSync, mkdirSync, writeFileSync, rmSync, symlinkSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join, dirname } = require('node:path')
const { fileURLToPath } = require('node:url')

const REPO = 'D:/coding/dsh-termfleet'
const DSH_BIN = 'C:/Users/20369/.version-fox/sdks/nodejs/node_modules/@deepseek-ai/dsh/lib/bin.js'
const BS_ENTRY = 'D:/coding/.tmp-m1/better-sidebar/node_modules/dsh-better-sidebar/lib/index.js'
const TEAM_TOKEN = 'fleet-coexist-e2e'
let pageErrs = 0
const results = []
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
  const port = await pickPort(3193)
  const tmp = mkdtempSync(join(tmpdir(), 'tf-coexist-'))
  for (const d of [join(tmp, 'dsh'), join(tmp, 'home')]) mkdirSync(d, { recursive: true })
  const patchFile = join(tmp, 'boot.patch.yml')
  writeFileSync(patchFile, `- insert:\n    - id: termfleet\n      name: 'D:/coding/dsh-termfleet/lib/index.js'\n      config: {}\n    - id: better-sidebar\n      name: '${BS_ENTRY.replaceAll('\\', '/')}'
      config: {}\n`)
  // 临时 HOME 内授予 0.28.0 定向豁免（peers ^0.2.1-rc.1 vs 运行时 alpha.2 的 semver 边界；仅作用于本测试实例）
  try {
    const g = spawn(process.execPath, [DSH_BIN, 'plugin', '--profile', 'web', 'allow-version', 'dsh-better-sidebar@0.28.0', '--dsh-version', '0.2.1-alpha.2', '--accept-risk'], {
      env: { ...process.env, DSH_HOME: join(tmp, 'dsh') }, stdio: ['ignore', 'pipe', 'pipe'],
    })
    let gout = ''
    g.stdout.on('data', (d) => { gout += String(d) })
    g.stderr.on('data', (d) => { gout += String(d) })
    await new Promise((res) => g.on('close', res))
    console.log('[grant]', gout.replace(/\n/g, ' | ').slice(0, 160))
  } catch (e) { console.log('[grant] 失败(继续，守卫可能禁用 better-sidebar):', String(e).slice(0, 80)) }
  try {
    const real = 'C:/Users/20369/.version-fox/sdks/nodejs/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-llm'
    const j = join(tmp, 'home', '.version-fox', 'sdks', 'nodejs', 'node_modules', '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-llm')
    mkdirSync(dirname(j), { recursive: true }); symlinkSync(real, j, 'junction')
  } catch (e) {}
  const child = spawn(process.execPath, [DSH_BIN, '--patch', patchFile, '--profile', 'web', '--port', String(port), '--no-open'], {
    cwd: REPO, env: { ...process.env, DSH_HOME: join(tmp, 'dsh'), USERPROFILE: join(tmp, 'home'), TERMFLEET_ROLE: 'lead', TERMFLEET_TOKEN: TEAM_TOKEN, TERMFLEET_NAME: 'CX-LEAD' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let out = ''
  child.stdout.on('data', (d) => { out += String(d) })
  child.stderr.on('data', (d) => { out += String(d) })
  let launchToken = ''
  try {
    const m = await waitFor(() => { const mm = out.match(/http:\/\/127\.0\.0\.1:(\d+)\/\?token=(\S+)/); return mm ? mm[2] : null }, 90000, 500, '启动横幅')
    launchToken = m
    const tokPath = join(tmp, 'home', '.dsh', 'termfleet', 'token.json')
    await waitFor(() => existsSync(tokPath), 20000, 300, '插件令牌')
    var TOK = JSON.parse(readFileSync(tokPath, 'utf8')).token
  } catch (e) { console.error('[fatal] 启动失败 tail:', out.slice(-400)); await killTree(child.pid); process.exit(1) }
  console.log(`[boot] port=${port} 双插件实例就绪`)

  const browser = await chromium.launch({ args: ['--no-proxy-server'] })
  const page = await browser.newPage({ viewport: { width: 1720, height: 1000 } })
  try {
    await page.goto(`http://127.0.0.1:${port}/?token=${launchToken}`)
    page.on('pageerror', (e) => { const s = String(e); if (s.indexOf('tab2 has no pane') < 0) { pageErrs++; console.log('[pageerror]', s.slice(0, 220)) } })
    await page.waitForTimeout(5000)
    const boot = await page.evaluate(() => JSON.stringify(window.__DSH_BOOT__ || {}))
    R('C1 双插件进 manifest', boot.includes('dsh-termfleet') && boot.includes('better-sidebar'), `__DSH_BOOT__ 含 termfleet=${boot.includes('dsh-termfleet')} better-sidebar=${boot.includes('better-sidebar')}`)
    await page.evaluate((t) => { try { localStorage.setItem('tf_token', t) } catch (e) {} }, TOK)
    const dismissUntilGone = async () => { for (let i = 0; i < 8; i++) { const gone = await page.evaluate(() => ![].slice.call(document.querySelectorAll('button')).some((b) => ['继续', '稍后配置'].includes(b.textContent.trim()))); if (gone) return; await page.evaluate(() => { for (const t of ['继续', '稍后配置']) { const b = [].slice.call(document.querySelectorAll('button')).find((x) => x.textContent.trim() === t); if (b) b.click() } }); await sleep(500) } }
    await dismissUntilGone()
    await page.evaluate(() => {
      const btns = [].slice.call(document.querySelectorAll('button, [role="button"]'))
      const tog = btns.filter((b) => { const r = b.getBoundingClientRect(); return r.top < 60 && r.right > window.innerWidth - 120 && r.width < 60 })
      if (tog.length) tog[tog.length - 1].click()
    })
    await page.waitForTimeout(1500)
    await page.reload(); await page.waitForTimeout(4000)
    await dismissUntilGone()

    // 打开 TermFleet tab：定位引导卡/ chip 的矩形中心 → 真实鼠标点击（合成 el.click() 不触发宿主激活）
    async function clickTermFleetChip() {
      for (let i = 0; i < 3; i++) {
        const pt = await page.evaluate((idx) => {
          const c = [].slice.call(document.querySelectorAll('*')).filter((el) => el.children.length === 0 && el.textContent.trim().indexOf('TermFleet') >= 0 && el.getBoundingClientRect().width < 300 && el.getBoundingClientRect().width > 0)[idx]
          if (!c) return null
          const r = c.getBoundingClientRect()
          return [r.x + r.width / 2, r.y + r.height / 2]
        }, i)
        if (pt) { await page.mouse.click(pt[0], pt[1]); await page.waitForTimeout(1300) }
        if (await page.$('[data-tf-native-board]')) return true
      }
      return false
    }
    const boardUp = await clickTermFleetChip()
    R('C2 TermFleet 原生任务板挂载(共存实例内)', boardUp, `[data-tf-native-board] 挂载=${boardUp}（0.2.1-alpha.2 + better-sidebar 同载，真实坐标点击引导卡/chip）`)

    // 右栏 tab chip 计数 + 切走再切回
    const chips = await page.evaluate(() => {
      const rail = [].slice.call(document.querySelectorAll('*')).filter((el) => el.getBoundingClientRect().left > window.innerWidth - 90 && el.getBoundingClientRect().width < 70 && el.getBoundingClientRect().height > window.innerHeight * 0.5)
      const railEl = rail[rail.length - 1]
      if (!railEl) return { count: 0, texts: [] }
      const chips = [].slice.call(railEl.querySelectorAll('button, [role="tab"], [class*="tab"]')).filter((el) => el.getBoundingClientRect().width > 0)
      return { count: chips.length, texts: chips.map((c) => (c.title || c.textContent || '').trim().slice(0, 16)) }
    })
    R('C3 右栏多 tab 并存(≥2 chip)', chips.count >= 2, `右栏 chip=${chips.count} 个 [${chips.texts.join(' / ')}]`)
    await page.screenshot({ path: join(REPO, 'docs', 'audit', 'screens', 'cx-1-both-tabs.png') })

    if (chips.count >= 2) {
      // 点非 TermFleet 的第一个 chip 切走，再切回 TermFleet
      await page.evaluate(() => {
        const rail = [].slice.call(document.querySelectorAll('*')).filter((el) => el.getBoundingClientRect().left > window.innerWidth - 90 && el.getBoundingClientRect().width < 70 && el.getBoundingClientRect().height > window.innerHeight * 0.5)
        const railEl = rail[rail.length - 1]
        const chips = [].slice.call(railEl.querySelectorAll('button, [role="tab"], [class*="tab"]')).filter((el) => el.getBoundingClientRect().width > 0)
        const other = chips.find((c) => (c.title || c.textContent || '').indexOf('TermFleet') < 0)
        if (other) other.click()
      })
      await page.waitForTimeout(1500)
      const boardGone = !(await page.$('[data-tf-native-board]'))
      const boardBack = await clickTermFleetChip()
      R('C4 双向切换不互坏(切走卸载/切回重挂)', boardGone && boardBack, `切到 better-sidebar 侧 tab 后原生板卸载=${boardGone}；真实点击 TermFleet chip 重挂=${boardBack}（key 隔离互不覆盖）`)
      await page.screenshot({ path: join(REPO, 'docs', 'audit', 'screens', 'cx-2-switch-back.png') })
    }
  } catch (e) {
    console.error('[fatal]', e?.stack || e)
    await page.screenshot({ path: join(REPO, 'docs', 'audit', 'screens', 'cx-fail.png') }).catch(() => {})
    R('执行中断', false, String(e && e.message || e).slice(0, 120))
  } finally {
    if (pageErrs > 0) R('页面错误面(排除宿主已知噪音)', false, pageErrs + ' 条非预期 pageerror')
    await browser.close().catch(() => {})
    await killTree(child.pid)
    await sleep(1200)
    try { rmSync(tmp, { recursive: true, force: true }) } catch (e) {}
  }
  console.log(`\n[exit] ${results.every((r) => r.ok) ? 0 : 1}`)
  process.exit(results.every((r) => r.ok) ? 0 : 1)
})()
