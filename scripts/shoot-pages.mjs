// shoot-pages.mjs — 样式翻新取景：双实例+种子数据，四页+详情全拍
// 用法：node scripts/shoot-pages.mjs   产出 docs/audit/screens/style-*.png
import { spawn } from 'node:child_process'
import net from 'node:net'
import { mkdtempSync, readFileSync, existsSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DSH_BIN = 'C:/Users/20369/.version-fox/sdks/nodejs/node_modules/@deepseek-ai/dsh/lib/bin.js'
const TEAM_TOKEN = 'fleet-style-shoot'
const MEMBER_NAME = '风格预览-成员'
const SHOT = join(REPO, 'docs', 'audit', 'screens')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function waitFor(fn, ms, step = 400, label = '') {
  const t0 = Date.now()
  for (;;) { let v = null; try { v = await fn() } catch { v = null } ; if (v) return v; if (Date.now() - t0 > ms) throw new Error('waitFor 超时：' + label); await sleep(step) }
}
const portFree = (port) => new Promise((res) => { const s = net.createConnection({ port, host: '127.0.0.1' }); s.on('connect', () => { s.destroy(); res(false) }); s.on('error', () => res(true)) })
async function pickPort(want) { let p = want; while (!(await portFree(p))) p += 10; return p }
const killTree = (pid) => new Promise((res) => { const k = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' }); k.on('close', () => res()); k.on('error', () => res()) })
function launchDsh({ port, patchFile, dshHome, userProfile, envExtra, tag }) {
  const child = spawn(process.execPath, [DSH_BIN, '--patch', patchFile, '--profile', 'web', '--port', String(port), '--no-open'], {
    cwd: REPO, env: { ...process.env, DSH_HOME: dshHome, USERPROFILE: userProfile, ...envExtra }, stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.tag = tag
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

async function main() {
  const leadPort = await pickPort(3194)
  const memberPort = await pickPort(3181)
  const tmp = mkdtempSync(join(tmpdir(), 'tf-style-'))
  for (const d of [join(tmp, 'dl'), join(tmp, 'dm'), join(tmp, 'hl'), join(tmp, 'hm')]) mkdirSync(d, { recursive: true })
  mkdirSync(SHOT, { recursive: true })
  const patchFile = join(tmp, 'boot.patch.yml')
  writeFileSync(patchFile, `- insert:\n    - id: termfleet\n      name: 'D:/coding/dsh-termfleet/lib/index.js'\n      config: {}\n`)
  for (const up of [join(tmp, 'hl'), join(tmp, 'hm')]) {
    try {
      const real = 'C:/Users/20369/.version-fox/sdks/nodejs/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-llm'
      const j = join(up, '.version-fox', 'sdks', 'nodejs', 'node_modules', '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-llm')
      mkdirSync(dirname(j), { recursive: true }); symlinkSync(real, j, 'junction')
    } catch (e) {}
  }
  const children = []
  let browser = null
  try {
    const lead = launchDsh({ port: leadPort, patchFile, dshHome: join(tmp, 'dl'), userProfile: join(tmp, 'hl'), envExtra: { TERMFLEET_ROLE: 'lead', TERMFLEET_TOKEN: TEAM_TOKEN, TERMFLEET_NAME: '风格预览-lead' }, tag: 'lead' })
    children.push(lead)
    const TOK_LEAD = await waitReady(leadPort, join(tmp, 'hl'))
    const member = launchDsh({ port: memberPort, patchFile, dshHome: join(tmp, 'dm'), userProfile: join(tmp, 'hm'), envExtra: { TERMFLEET_NAME: MEMBER_NAME, TERMFLEET_LEAD_URL: `ws://127.0.0.1:${leadPort}/dsh-termfleet/bus`, TERMFLEET_TOKEN: TEAM_TOKEN, TERMFLEET_ROLE: 'member' }, tag: 'member' })
    children.push(member)
    const TOK_MEMBER = await waitReady(memberPort, join(tmp, 'hm'))
    await waitFor(async () => { const f = await api(leadPort, TOK_LEAD, 'fleet').then((r) => r.json()); return (f.members || []).some((m) => m.name === MEMBER_NAME) }, 20000, 500, '成员上线')
    await api(memberPort, TOK_MEMBER, 'pairing', 'POST', { trust: true })

    // 种子：跨列任务（含验收/绑定会话/认领）——状态流转必须走 UB_FLOW 合法路径
    const mk = async (title, project, prio, statuses, extra) => {
      const r = await api(leadPort, TOK_LEAD, 'tasks/create', 'POST', { title, project, prio, ...(extra || {}) }).then((x) => x.json())
      for (const st of (statuses || [])) await api(leadPort, TOK_LEAD, 'tasks/action', 'POST', { op: 'status', id: r.task.id, patch: { status: st } })
      return r.task
    }
    await mk('用户登录模块：手机号+验证码链路', 'shop', 'P0', ['ready-for-agent', 'active'], { desc: '目标：手机号+验证码登录全链路\n重点：验证码 60s 限流、风控兜底', acceptance: [{ text: '验证码 60s 限流生效' }, { text: '异常登录风控兜底' }], pending: [{ text: '验证码通道用哪家待拍板' }] })
    await mk('时区转换修复（展示层统一 UTC）', 'shop', 'P1', ['ready-for-agent', 'active', 'review'], { desc: '展示层时区统一，存储层不动' })
    const t3 = await mk('购物车合单逻辑', 'shop', 'P1', ['ready-for-agent'])
    await api(leadPort, TOK_LEAD, 'tasks/action', 'POST', { op: 'claim', id: t3.id, patch: {} }).catch(() => {})
    await mk('商品详情页改版', 'shop', 'P2', [])
    await mk('营销位配置后台', 'ops', 'P2', ['ready-for-agent', 'active', 'blocked'], { desc: '等设计稿' })
    const t6 = await mk('支付对账脚本', 'ops', 'P0', [])
    await api(leadPort, TOK_LEAD, 'tasks/action', 'POST', { op: 'bind-session', id: t6.id, patch: { session: { member: MEMBER_NAME, sessionId: 'style-demo-session', label: MEMBER_NAME + ' · 演示' } } })
    await mk('旧版埋点清理', 'infra', 'P2', ['wontfix'])
    // 避坑库种子
    for (const l of [
      { state: 'implemented', category: 'bug-fix', title: '部署前必须跑双机验收', body: '卡点：单机验收漏掉跨机时钟偏移\n解法：上线 checklist 增加双机步骤' },
      { state: 'proposed', category: 'architecture', title: 'SSE 通道统一收敛到 member-stream', body: '提案：合并 pty/sess 两条 SSE\n备选：维持两条（隔离清晰）——暂维持' },
      { state: 'implemented', category: 'process', title: 'commit 信息走文件写入防乱码', body: 'Windows 管道会弄坏中文 commit message' },
    ]) await api(leadPort, TOK_LEAD, 'memory/create', 'POST', l).catch(() => {})
    // 审计已有若干真实事件（上面的 API 调用都会留痕）

    browser = await chromium.launch({ args: ['--no-proxy-server'] })
    const ctx = await browser.newContext({ viewport: { width: 1720, height: 1020 }, locale: 'zh-CN', deviceScaleFactor: 1.5 })
    const page = await ctx.newPage()
    await page.goto(`http://127.0.0.1:${leadPort}/dsh-termfleet/app?token=${encodeURIComponent(TOK_LEAD)}`)
    await page.waitForTimeout(2500)
    await page.evaluate(() => { try { localStorage.setItem('tf_user', '阿杰') } catch (e) {} })
    // 单机同意模拟卡前置：decide('deny') 两次（间隔 500ms），防止全屏 mask 盖住取景（隔离 HOME 下通常无卡，防御性执行）
    await page.evaluate(() => { if (typeof CH !== 'undefined' && CH && CH.id) decide('deny') })
    await page.waitForTimeout(500)
    await page.evaluate(() => { if (typeof CH !== 'undefined' && CH && CH.id) decide('deny') })

    const shot = async (name) => page.screenshot({ path: join(SHOT, `style-${name}.png`) })
    // 任务板（R2：默认=行列表；看板可切；置顶星标）
    await page.evaluate(() => pg('task'))
    await page.waitForTimeout(1200)
    await shot('task-list')
    await page.evaluate(() => { const b = document.querySelector('#listRows .trow [data-pin]'); if (b) b.click() })
    await page.waitForTimeout(500)
    await shot('task-pinned')
    await page.evaluate(() => { const b = document.querySelector('#listRows .trow [data-pin]'); if (b) b.click() })
    await page.evaluate(() => document.getElementById('vBoard').click())
    await page.waitForTimeout(800)
    await shot('task-board')
    // 详情抽屉
    await page.evaluate(() => { const c = [].slice.call(document.querySelectorAll('.bcard')).find((x) => x.innerText.includes('用户登录模块')); if (c) c.click() })
    await page.waitForTimeout(1200)
    await shot('task-detail')
    await page.evaluate(() => closeDrawer())
    // 远程页（context 三态：none CTA → local 本机 → member 对话流）
    await page.evaluate(() => pg('remote'))
    await page.waitForTimeout(2500)
    await shot('remote-none')
    await page.evaluate(() => setView('local'))
    await page.waitForTimeout(1000)
    await shot('remote-local')
    await page.evaluate((nm) => { const el = document.querySelector(`#memberDevs [data-member="${nm}"]`); if (el) el.click() }, MEMBER_NAME)
    await page.waitForTimeout(2500)
    // 成员产生两条会话事件
    for (const text of ['风格预览：成员正在看登录页联调', '风格预览：接口报 500 了，正在排查']) {
      await api(memberPort, TOK_MEMBER, 'probe-session/write', 'POST', { text }).catch(() => {})
      await sleep(2200)
    }
    await shot('remote')
    // 避坑库
    await page.evaluate(() => pg('mem'))
    await page.waitForTimeout(1500)
    await shot('memory')
    // 审计
    await page.evaluate(() => pg('audit'))
    await page.waitForTimeout(1500)
    await shot('audit')
    // 设置弹层（R1 迁出后 = ⚙ 按钮 → settingsMask）
    await page.evaluate(() => pg('remote'))
    await page.waitForTimeout(800)
    await page.evaluate(() => { if (typeof openSettings === 'function') openSettings(); else document.getElementById('settingsBtn').click() })
    await page.waitForTimeout(800)
    await shot('settings')

    console.log('[done] style-*.png 已产出')
    await browser.close()
  } catch (e) {
    console.error('[fatal]', e?.stack || e)
    try { await browser.close() } catch {}
    process.exitCode = 1
  } finally {
    for (const c of children) { try { await killTree(c.pid) } catch {} }
    await sleep(1000)
    try { rmSync(tmp, { recursive: true, force: true }) } catch (e) {}
  }
  // launchDsh 引用修正（child 在闭包里由 children 持有）
}
main()
