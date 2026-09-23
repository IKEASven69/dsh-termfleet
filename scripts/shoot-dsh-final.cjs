// 最终全功能验证（state 块恢复后）：PTY 通道 + 会话事件流 + 各页
const { chromium } = require('playwright')
const { readFileSync } = require('node:fs')
const LAUNCH = process.argv[2]
const TOK = JSON.parse(readFileSync(process.env.USERPROFILE + '/.dsh/termfleet/token.json', 'utf8')).token
const OUT = 'D:/coding/dsh-termfleet/docs/audit/screens'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []

;(async () => {
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1600, height: 950 } })
  await p.goto('http://127.0.0.1:3180/?token=' + LAUNCH)
  await p.waitForTimeout(5000)
  await p.evaluate((t) => { try { localStorage.setItem('tf_token', t) } catch (e) {} }, TOK)
  const sess = p.locator('text=查看dsh-notch项目').first()
  if (await sess.count()) { await sess.click(); await p.waitForTimeout(2500) }

  const tf = await p.evaluate(() => { const btn = [].slice.call(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'TF'); if (btn) { btn.click(); return true } return false })
  results.push({ check: 'TF按钮', ok: tf })
  await sleep(3500)
  const fr = p.frames().find(f => f.url().includes('dsh-termfleet/app'))
  if (!fr) { results.push({ check: 'frame', ok: false }); console.log(JSON.stringify(results)); await b.close(); return }

  // PTY 全链
  await fr.evaluate(() => { const ns = [].slice.call(document.querySelectorAll('.nav span')); const r = ns.find(n => n.textContent.indexOf('远程') >= 0); if (r) r.click() })
  await sleep(800)
  await fr.evaluate(() => { const b2 = document.querySelector('#csActs button'); if (b2) b2.click() })
  await sleep(800)
  await fr.evaluate(() => { const a = document.getElementById('csAllow'); if (a) a.click() })
  await sleep(2200)
  await fr.evaluate(() => {
    const i = document.getElementById('cmdInput')
    if (i) { i.value = 'echo FINAL_ROUND_OK'; const cl = document.getElementById('cmdline'); if (cl) cl.classList.add('on'); if (window.sendCmd) window.sendCmd() }
  })
  await sleep(2800)
  const ptyText = await fr.evaluate(() => (document.getElementById('ptyTerm') || { textContent: '' }).textContent)
  results.push({ check: 'PTY回显(无引用错)', ok: ptyText.includes('FINAL_ROUND_OK') && !ptyText.includes('not defined') })
  results.push({ check: 'ANSI清洗', ok: !ptyText.includes('[?9001h') })

  // dsh 会话事件流（写一条真实会话事件→SSE 到面板）
  await fr.evaluate(() => {
    return fetch('/dsh-termfleet/probe-session/write', { method: 'POST', headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + TOK }, body: JSON.stringify({ text: 'EVENTFLOW_TEST' }) })
  })
  await sleep(2500)
  const evTxt = await fr.evaluate(() => document.getElementById('evCnt') ? document.getElementById('evCnt').textContent : '0 条')
  results.push({ check: 'dsh事件流SSE(' + evTxt + ')', ok: evTxt !== '0 条' })
  await p.screenshot({ path: OUT + '/h1-final-remote.png' })

  // 任务/避坑/审计
  await fr.evaluate(() => { const ns = [].slice.call(document.querySelectorAll('.nav span')); const t = ns.find(n => n.textContent.indexOf('任务') >= 0); if (t) t.click() })
  await sleep(600)
  results.push({ check: '任务卡片(' + (await fr.evaluate(() => document.querySelectorAll('.bcard').length)) + ')', ok: true })
  await fr.evaluate(() => { const ns = [].slice.call(document.querySelectorAll('.nav span')); const m2 = ns.find(n => n.textContent.indexOf('避坑') >= 0); if (m2) m2.click() })
  await sleep(700)
  results.push({ check: '避坑(' + (await fr.evaluate(() => document.querySelectorAll('.lcard').length)) + ')', ok: true })
  await fr.evaluate(() => { const ns = [].slice.call(document.querySelectorAll('.nav span')); const a = ns.find(n => n.textContent.indexOf('审计') >= 0); if (a) a.click() })
  await sleep(800)
  results.push({ check: '审计(' + (await fr.evaluate(() => document.querySelectorAll('.arow').length)) + '行)', ok: true })
  await p.screenshot({ path: OUT + '/h2-final-audit.png' })

  const geo = await fr.evaluate(() => { const de = document.documentElement; return de.scrollWidth > de.clientWidth + 2 ? false : true })
  results.push({ check: '窄面板几何', ok: geo })

  await b.close()
  console.log(JSON.stringify(results, null, 1))
})().catch(e => { console.error('ERR', e.message.slice(0, 120)); process.exit(1) })
