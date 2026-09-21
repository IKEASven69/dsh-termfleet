// 审计 v2 验证：表格/筛选/ANSI清洗/回放升级 全走 Playwright
const { chromium } = require('playwright')
const { readFileSync } = require('node:fs')
const TOK = JSON.parse(readFileSync(process.env.USERPROFILE + '/.dsh/termfleet/token.json', 'utf8')).token
const URL = 'http://127.0.0.1:3180/dsh-termfleet/app?token=' + TOK
const OUT = 'D:/coding/dsh-termfleet/docs/audit/screens'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } })
  await page.goto(URL)
  await page.waitForTimeout(1800)

  console.log('--- ① ansiClean 功能 ---')
  const ansi = await page.evaluate(() => {
    const E = String.fromCharCode(27), B = String.fromCharCode(7)
    return ansiClean(E + '[?9001h' + E + ']0;title' + B + 'PS> echo OK' + E + '[K\r\nOK')
  })
  console.log('ANSI 清洗:', JSON.stringify(ansi), ansi.includes('OK') && !ansi.includes(String.fromCharCode(27)) ? '✓' : '✗')

  console.log('--- ② 审计表格 ---')
  await page.evaluate(() => pg('audit'))
  await sleep(900)
  const head = await page.evaluate(() => document.querySelector('.athead') ? document.querySelector('.athead').textContent : '无表头')
  console.log('表头:', head)
  const rows = await page.evaluate(() => document.querySelectorAll('.arow').length)
  console.log('表格行:', rows)
  await page.screenshot({ path: OUT + '/30-audit-table.png' })

  console.log('--- ③ 操作人筛选 ---')
  const whoOpts = await page.evaluate(() => document.getElementById('audWho').options.length)
  console.log('操作人选项:', whoOpts)
  await page.selectOption('#audWho', { index: 1 })
  await sleep(500)
  const filtered = await page.evaluate(() => document.querySelectorAll('.arow').length)
  console.log('筛选后行数:', filtered)
  await page.screenshot({ path: OUT + '/31-audit-filtered.png' })

  console.log('--- ④ 回放 v2 ---')
  await page.evaluate(() => openReplay())
  await sleep(1200)
  const rep = await page.evaluate(() => ({
    pty: (document.getElementById('replayPty') || { textContent: '' }).textContent.length,
    rows: document.querySelectorAll('#replayAudit .arow').length,
    filterBtns: document.querySelectorAll('#repFilter button').length,
    stepBtn: !!document.getElementById('repStep'),
  }))
  console.log('回放:', JSON.stringify(rep))
  await page.screenshot({ path: OUT + '/32-replay-v2.png' })

  await browser.close()
  console.log('验证完成')
})().catch((e) => { console.error(e.message); process.exit(1) })
