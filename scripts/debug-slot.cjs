const { chromium } = require('playwright')
const { readFileSync } = require('node:fs')
const LAUNCH = process.argv[2]
;(async () => {
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1600, height: 950 } })
  await p.goto('http://127.0.0.1:3180/?token=' + LAUNCH)
  await p.waitForTimeout(5000)
  let r = await p.evaluate(() => ({
    tf: [].slice.call(document.querySelectorAll('button')).filter(x => x.textContent.trim() === 'TF').length,
    slotUtilities: !!document.querySelector('[data-slot*="utilities"]'),
  }))
  console.log('首页:', JSON.stringify(r))
  const sess = p.locator('text=查看dsh-notch项目').first()
  if (await sess.count()) { await sess.click(); await p.waitForTimeout(3000) }
  r = await p.evaluate(() => ({
    tf: [].slice.call(document.querySelectorAll('button')).filter(x => x.textContent.trim() === 'TF').length,
    slotUtilities: !!document.querySelector('[data-slot*="utilities"]'),
    utilsChildren: document.querySelector('[data-slot*="utilities"]') ? document.querySelector('[data-slot*="utilities"]').children.length : -1,
    tfClient: window.__tfClient || '未加载',
  }))
  console.log('会话内:', JSON.stringify(r))
  await b.close()
})()
