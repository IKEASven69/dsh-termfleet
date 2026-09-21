// 一镜到底全功能演示录屏（Playwright 直驱，agent-browser daemon 卡死时的稳定替代）
// 产出：docs/audit/video/full-feature-demo.webm
const { chromium } = require('playwright')
const { readFileSync, mkdirSync } = require('node:fs')
const path = require('node:path')

const ROOT = 'D:/coding/dsh-termfleet'
const TOK = JSON.parse(readFileSync(process.env.USERPROFILE + '/.dsh/termfleet/token.json', 'utf8')).token
const URL = 'http://127.0.0.1:3180/dsh-termfleet/app?token=' + TOK
const OUT = path.join(ROOT, 'docs/audit/video/full-feature-demo.webm')
mkdirSync(path.dirname(OUT), { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

;(async()=>{
const browser = await chromium.launch({ headless: false })
const ctx = await browser.newContext({ viewport: { width: 1600, height: 950 }, recordVideo: { dir: path.dirname(OUT), size: { width: 1600, height: 950 } } })
const page = await ctx.newPage()

await page.goto(URL)
await page.waitForTimeout(1500)
await page.evaluate(() => { localStorage.setItem('tf_user', '张三') })

// ── 场景1：远程页 + 同意通道 + 指令回显 + 断开 ──
await page.evaluate(() => pg('remote'))
await sleep(1800)
await page.evaluate(() => requestChannel())
await sleep(1200)   // 同意卡弹出（成员侧模拟）
await page.evaluate(() => decide('allow'))
await sleep(1800)   // 通道建立+倒计时
await page.evaluate(() => { startPty(); const i = document.getElementById('cmdInput'); if (i) { i.disabled = false; const cl = document.getElementById('cmdline'); if (cl) cl.classList.add('on') } })
await sleep(1500)
await page.evaluate(() => { const i = document.getElementById('cmdInput'); if (i) { i.value = 'echo DEMO_RECORDING'; sendCmd() } })
await sleep(2500)   // 回显
await page.evaluate(() => document.getElementById('rtEndBtn').click())
await sleep(1000)   // 断开

// ── 场景2：任务板 + 详情六 tab ──
await page.evaluate(() => pg('task'))
await sleep(1800)
await page.evaluate(() => { const c = document.querySelectorAll('.bcard')[0]; if (c) c.click() })
await sleep(1200)
await page.evaluate(() => dtab(document.querySelectorAll('#dtabs span')[1], 'dp-flow'))
await sleep(1400)
await page.evaluate(() => dtab(document.querySelectorAll('#dtabs span')[3], 'dp-notes'))
await sleep(1400)
await page.evaluate(() => dtab(document.querySelectorAll('#dtabs span')[5], 'dp-diff'))
await sleep(2000)
await page.evaluate(() => closeDrawer())

// ── 场景3：避坑库 ──
await page.evaluate(() => pg('mem'))
await sleep(1800)

// ── 场景4：审计 + 回放 ──
await page.evaluate(() => pg('audit'))
await sleep(1000)
await page.evaluate(() => openReplay())
await sleep(2200)
await page.evaluate(() => document.getElementById('replayMask').classList.remove('on'))
await sleep(600)

// ── 场景5：快捷键 + 亮暗 ──
await page.keyboard.press('2')
await sleep(800)
await page.keyboard.press('4')
await sleep(800)
await page.evaluate(() => document.body.setAttribute('data-light', ''))
await sleep(1600)
await page.evaluate(() => document.body.removeAttribute('data-light'))
await sleep(800)

await ctx.close()
await browser.close()
console.log('录制完成 →', OUT); process.exit(0)
})().catch(e=>{console.error(e);process.exit(1)})
