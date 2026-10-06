// 0.2.0-rc.2 显式兼容性回归：client 加载 + slots + SSE + PTY + 任务门禁
const { chromium } = require('playwright')
const { readFileSync } = require('node:fs')
const TOK = JSON.parse(readFileSync(process.env.USERPROFILE + '/.dsh/termfleet/token.json', 'utf8')).token
const LAUNCH = process.argv[2]
const results = []

;(async () => {
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1600, height: 950 } })
  await p.goto('http://127.0.0.1:3180/?token=' + LAUNCH)
  await p.waitForTimeout(5000)
  const mf = await p.evaluate(() => JSON.stringify(window.__DSH_BOOT__ || {}).includes('dsh-termfleet'))
  results.push({ check: '0.2.0 manifest 收录 termfleet', ok: mf })
  await p.evaluate((t) => { try { localStorage.setItem('tf_token', t) } catch (e) {} }, TOK)

  const sess = p.locator('text=查看dsh-notch项目').first()
  if (await sess.count()) { await sess.click(); await p.waitForTimeout(2500) }
  const tfOk = await p.evaluate(() => { const btn = [].slice.call(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'TF'); if (btn) { btn.click(); return true } return false })
  results.push({ check: 'slots 注册: TF 按钮', ok: tfOk })
  await p.waitForTimeout(3500)
  const fr = p.frames().find(f => f.url().includes('dsh-termfleet/app'))
  results.push({ check: 'client 半 iframe 加载', ok: !!fr })
  if (!fr) { console.log(JSON.stringify(results)); await b.close(); process.exit(0) }

  // PTY 通道链
  await fr.evaluate(() => { const ns = [].slice.call(document.querySelectorAll('.nav span')); const r = ns.find(n => n.textContent.indexOf('远程') >= 0); if (r) r.click() })
  await sleep(800)
  await fr.evaluate(() => { const b2 = document.querySelector('#csActs button'); if (b2) b2.click() })
  await sleep(800)
  await fr.evaluate(() => { const a = document.getElementById('csAllow'); if (a) a.click() })
  await sleep(2200)
  await fr.evaluate(() => { const i = document.getElementById('cmdInput'); if (i) { i.value = 'echo V020_COMPAT_OK'; const cl = document.getElementById('cmdline'); if (cl) cl.classList.add('on'); if (window.sendCmd) window.sendCmd() } })
  await sleep(2800)
  const ptyText = await fr.evaluate(() => (document.getElementById('ptyTerm') || { textContent: '' }).textContent)
  results.push({ check: 'PTY 回显', ok: ptyText.includes('V020_COMPAT_OK') && !ptyText.includes('not defined') })

  // SSE
  await fr.evaluate(() => { const ns = [].slice.call(document.querySelectorAll('.nav span')); const r = ns.find(n => n.textContent.indexOf('远程') >= 0); if (r) r.click() })
  await sleep(500)
  const ev = await fr.evaluate(() => document.getElementById('evCnt') ? document.getElementById('evCnt').textContent : '?')
  results.push({ check: 'SSE 会话事件流(' + ev + ')', ok: ev !== '0 条' && ev !== '?' })

  // 门禁
  const gate = await fetch('http://127.0.0.1:3180/dsh-termfleet/ping').then(r => r.status)
  results.push({ check: '鉴权门 401', ok: gate === 401 })

  // 任务 10 态
  const st = await fetch('http://127.0.0.1:3180/dsh-termfleet/tasks', { headers: { authorization: 'Bearer ' + TOK } }).then(r => r.json())
  results.push({ check: '任务库(' + (st.tasks || []).length + '条,v2字段=' + ((st.tasks || [])[0] && 'acceptance' in (st.tasks || [])[0] ? '有' : '无') + ')', ok: (st.tasks || []).length > 0 })

  await b.close()
  console.log(JSON.stringify(results, null, 1))
})().catch(e => { console.error('ERR', e.message.slice(0, 100)); process.exit(1) })
