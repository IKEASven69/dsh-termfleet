// 最终 dsh 同框截图（稳健版：全部走 evaluate 驱动，不用 locator 等待）
const { chromium } = require('playwright')
const { readFileSync } = require('node:fs')
const LAUNCH = process.argv[2]
const TOK = JSON.parse(readFileSync(process.env.USERPROFILE + '/.dsh/termfleet/token.json', 'utf8')).token
const OUT = 'D:/coding/dsh-termfleet/docs/audit/screens'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1600, height: 950 } })
  await p.goto('http://127.0.0.1:3180/?token=' + LAUNCH)
  await p.waitForTimeout(5500)

  // 先进会话（TF 在会话头）
  try { await p.locator('text=查看dsh-notch项目').first().click({timeout:4000}); await p.waitForTimeout(2500) } catch(e) { console.log('无该会话，跳过') }
  // 预置面板令牌
  await p.evaluate(t => { try{localStorage.setItem('tf_token',t)}catch(e){} }, TOK)
  await p.waitForTimeout(500)
  // TF 按钮：直接 JS 点击（绕过 locator 匹配问题）
  const clicked = await p.evaluate(() => {
    const btn = [].slice.call(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'TF')
    if (btn) { btn.click(); return true }
    return false
  })
  console.log('TF 点击:', clicked)
  await sleep(3500)
  await p.screenshot({ path: OUT + '/35-dsh-panel-open.png' })

  const frameEl = await p.evaluate(() => { const f = document.querySelector('iframe[src*="dsh-termfleet/app"]'); return f ? f.src : null })
  console.log('面板 iframe:', frameEl ? '有' : '无')
  if (!frameEl) { await b.close(); return }

  const fr = p.frames().find(f => f.url().includes('dsh-termfleet/app'))
  if (!fr) { console.log('frame 未找到'); await b.close(); return }

  // 远程页
  await fr.evaluate(() => { const ns = [].slice.call(document.querySelectorAll('.nav span')); const r = ns.find(n => n.textContent.indexOf('远程') >= 0); if (r) r.click() })
  await sleep(800)
  // 请求连接
  await fr.evaluate(() => { const b = document.querySelector('#csActs button'); if (b) b.click() })
  await sleep(1100)
  await p.screenshot({ path: OUT + '/36-consent-in-dsh.png' })
  // 允许
  await fr.evaluate(() => { const a = document.getElementById('csAllow'); if (a) a.click() })
  await sleep(2400)
  // 敲指令
  await fr.evaluate(() => {
    const i = document.getElementById('cmdInput')
    if (i) { i.value = 'echo IN_DSH_UI_OK'; const cl = document.getElementById('cmdline'); if (cl) cl.classList.add('on'); if (window.sendCmd) window.sendCmd() }
  })
  await sleep(2800)
  await p.screenshot({ path: OUT + '/37-pty-in-dsh.png' })
  // 审计
  await fr.evaluate(() => { const ns = [].slice.call(document.querySelectorAll('.nav span')); const a = ns.find(n => n.textContent.indexOf('审计') >= 0); if (a) a.click() })
  await sleep(900)
  await p.screenshot({ path: OUT + '/38-audit-in-dsh.png' })
  // 断开
  await fr.evaluate(() => { const ns = [].slice.call(document.querySelectorAll('.nav span')); const r = ns.find(n => n.textContent.indexOf('远程') >= 0); if (r) r.click() })
  await sleep(500)
  await fr.evaluate(() => { const e = document.getElementById('rtEndBtn'); if (e) e.click() })
  await sleep(700)

  await b.close()
  console.log('✓ 最终 dsh 同框截图 35~38 完成')
})().catch(e => { console.error('ERR', e.message.slice(0, 100)); process.exit(1) })
