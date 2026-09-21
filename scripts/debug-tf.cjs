const { chromium } = require('playwright')
const { readFileSync } = require('node:fs')
const LAUNCH = process.argv[2]
;(async () => {
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1600, height: 950 } })
  await p.goto('http://127.0.0.1:3180/?token=' + LAUNCH)
  await p.waitForTimeout(5000)
  const r = await p.evaluate(() => ({
    tfClient: window.__tfClient || '未加载',
    btnSample: [].slice.call(document.querySelectorAll('button')).map(x => x.textContent.trim()).filter(t => t && t.length < 8).slice(0, 20),
    inSession: !!document.querySelector('[data-slot*="header"]'),
  }))
  console.log(JSON.stringify(r, null, 1))
  const sess = p.locator('text=查看dsh-notch项目').first()
  if (await sess.count()) { await sess.click(); await p.waitForTimeout(2500) }
  const r2 = await p.evaluate(() => ({
    tfClient2: window.__tfClient || '未加载',
    tfBtn: [].slice.call(document.querySelectorAll('button')).filter(x => x.textContent.trim() === 'TF').length,
  }))
  console.log(JSON.stringify(r2))
  await b.close()
})()
