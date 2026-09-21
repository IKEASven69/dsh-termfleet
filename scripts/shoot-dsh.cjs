// 审计 v2 + dsh 同框截图套件（Playwright）
const { chromium } = require('playwright')
const { readFileSync } = require('node:fs')

const TOK = JSON.parse(readFileSync(process.env.USERPROFILE + '/.dsh/termfleet/token.json', 'utf8')).token
const LAUNCH_TOKEN = process.argv[2] || ''
const HOST = 'http://127.0.0.1:3180/?token=' + LAUNCH_TOKEN
const APP = 'http://127.0.0.1:3180/dsh-termfleet/app?token=' + TOK
const OUT = 'D:/coding/dsh-termfleet/docs/audit/screens'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } })

  // ── A. 独立面板：审计表格新形态 ──
  await page.goto(APP)
  await page.waitForTimeout(1800)
  await page.evaluate(() => pg('audit'))
  await sleep(900)
  await page.screenshot({ path: OUT + '/30-audit-table.png' })

  // 操作人筛选
  await page.evaluate(() => { const s = document.getElementById('audWho'); s.selectedIndex = 1; s.onchange() })
  await sleep(500)
  await page.screenshot({ path: OUT + '/31-audit-who-filter.png' })
  await page.evaluate(() => { const s = document.getElementById('audWho'); s.selectedIndex = 0; s.onchange() })

  // 回放 v2
  await page.evaluate(() => openReplay())
  await sleep(1000)
  await page.screenshot({ path: OUT + '/32-replay-v2.png' })
  // 步进
  await page.click('#repStep'); await page.click('#repStep')
  await sleep(400)
  await page.screenshot({ path: OUT + '/33-replay-stepped.png' })
  await page.evaluate(() => document.getElementById('replayMask').classList.remove('on'))

  // ── B. dsh web 同框 ──
  await page.goto('http://127.0.0.1:3180/?token=' + LAUNCH_TOKEN)
  await page.waitForTimeout(5000)
  await page.evaluate(() => { try { localStorage.setItem('tf_token', TOK || '') } catch (e) {} })
  const sess = page.locator('text=查看dsh-notch项目').first()
  if (await sess.count()) { await sess.click(); await page.waitForTimeout(2500) }
  const tf = page.locator('button', { hasText: /^TF$/ }).first()
  console.log('TF 按钮:', await tf.count())
  await page.screenshot({ path: OUT + '/34-dsh-with-tf.png' })

  if (await tf.count()) {
    await tf.click(); await page.waitForTimeout(4000)
    await page.screenshot({ path: OUT + '/35-dsh-panel-open.png' })
    // 面板里建立通道
    const frame = page.frameLocator('iframe[src*="dsh-termfleet/app"]')
    try {
      await frame.locator('.nav span', { hasText: '远程' }).click(); await sleep(500)
      await frame.locator('#csReq, #csActs button').first().click(); await sleep(800)
      const allow = frame.locator('#csAllow')
      if (await allow.count()) { await allow.click(); await sleep(2000) }
      await frame.locator('#cmdInput').fill('echo IN_DSH_UI')
      await frame.locator('#cmdline .btn').click()
      await sleep(2200)
      await page.screenshot({ path: OUT + '/36-dsh-panel-live.png' })
    } catch (e) { console.log('面板流程:', e.message.slice(0, 60)) }
  }

  await browser.close()
  console.log('截图完成 → 30~36')
})().catch((e) => { console.error(e.message); process.exit(1) })
