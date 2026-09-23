// 修正版：进会话后再点 TF，然后全页审查
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
  await p.waitForTimeout(5000)
  await p.evaluate((t) => { try { localStorage.setItem('tf_token', t) } catch (e) {} }, TOK)

  const sess = p.locator('text=查看dsh-notch项目').first()
  if (await sess.count()) { await sess.click(); await p.waitForTimeout(3000) }

  // ① dsh UI + TF 同框
  await p.screenshot({ path: OUT + '/ux-dsh-01-home.png' })

  // ② 点 TF 开面板
  await p.evaluate(() => { const btn = [].slice.call(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'TF'); if (btn) btn.click() })
  await sleep(3500)
  await p.screenshot({ path: OUT + '/ux-dsh-02-panel-task.png' })

  const fr = p.frames().find(f => f.url().includes('dsh-termfleet/app'))
  if (!fr) { console.log('frame 无'); await b.close(); return }

  // ③ 远程页
  await fr.evaluate(() => { const ns = [].slice.call(document.querySelectorAll('.nav span')); const r = ns.find(n => n.textContent.indexOf('远程') >= 0); if (r) r.click() })
  await sleep(900)
  await p.screenshot({ path: OUT + '/ux-dsh-03-remote.png' })

  // ④ 建立通道
  await fr.evaluate(() => { const b2 = document.querySelector('#csActs button'); if (b2) b2.click() })
  await sleep(900)
  await fr.evaluate(() => { const a = document.getElementById('csAllow'); if (a) a.click() })
  await sleep(2200)
  await p.screenshot({ path: OUT + '/ux-dsh-04-remote-active.png' })

  // ⑤ 任务详情（六 tab 窄面板）
  await fr.evaluate(() => { const ns = [].slice.call(document.querySelectorAll('.nav span')); const t = ns.find(n => n.textContent.indexOf('任务') >= 0); if (t) t.click() })
  await sleep(600)
  await fr.evaluate(() => { const c = document.querySelector('.bcard'); if (c) c.click() })
  await sleep(900)
  await p.screenshot({ path: OUT + '/ux-dsh-05-detail.png' })
  await fr.evaluate(() => { try { closeDrawer() } catch (e) {} })

  // ⑥ 审计
  await fr.evaluate(() => { const ns = [].slice.call(document.querySelectorAll('.nav span')); const a = ns.find(n => n.textContent.indexOf('审计') >= 0); if (a) a.click() })
  await sleep(800)
  await p.screenshot({ path: OUT + '/ux-dsh-06-audit.png' })

  // 几何审计
  const geo = await fr.evaluate(() => {
    const issues = []
    const de = document.documentElement
    if (de.scrollWidth > de.clientWidth + 2) issues.push('横向溢出')
    return issues
  })
  console.log('窄面板几何:', JSON.stringify(geo))

  // ⑦ 独立全屏对照
  const p2 = await b.newPage({ viewport: { width: 1600, height: 950 } })
  await p2.goto('http://127.0.0.1:3180/dsh-termfleet/app?token=' + TOK)
  await p2.waitForTimeout(1500)
  await p2.evaluate(() => { localStorage.setItem('tf_user', '张三'); pg('remote') })
  await sleep(500)
  await p2.screenshot({ path: OUT + '/ux-standalone-remote.png' })

  await b.close()
  console.log('✓ UX 审查截图完成')
})().catch(e => { console.error('ERR', e.message.slice(0, 120)); process.exit(1) })
