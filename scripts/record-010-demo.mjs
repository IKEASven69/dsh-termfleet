// ═══════════════════════════════════════════════════════════════════════════
// record-010-demo.mjs — 0.1.0 全功能演示录屏（双实例同框，当前 IA 实况）
//
// 产出：docs/audit/video/termfleet-010-demo.webm（一镜到底不剪辑）
// 画面：包装页左右 iframe 同框——左=lead 面板，右=成员面板（两真实 dsh 实例，
//       HOME 隔离），成员侧动作与 lead 反应同框可见。
// 场景：none 态双 CTA → 本机 pwsh 探针（xterm 真实键入回显）→ 取码 → 成员粘贴
//       入队 → 成员开信任 → ⚡一键查看(自动允许 ro) → rw 经典审批卡 → 成员会话
//       三连发实时滚入 → lead 插话 ✓已送达 → 绑定任务跨机同步+详情会话 tab → 审计收尾。
// 稳态复跑：node scripts/record-010-demo.mjs（退出码 0=录制成功且关键断言过）
// ═══════════════════════════════════════════════════════════════════════════
import { spawn } from 'node:child_process'
import net from 'node:net'
import { mkdtempSync, readFileSync, existsSync, mkdirSync, writeFileSync, rmSync, symlinkSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DSH_BIN = 'C:/Users/20369/.version-fox/sdks/nodejs/node_modules/@deepseek-ai/dsh/lib/bin.js'
const TEAM_TOKEN = 'fleet-demo-010'
const MEMBER_NAME = '演示成员-风格预览'
const SHOT = join(REPO, 'docs', 'audit', 'video', 'termfleet-010-demo.webm')
const RUN = Date.now().toString(36)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function waitFor(fn, ms, step = 400, label = '') {
  const t0 = Date.now()
  for (;;) {
    let v = null
    try { v = await fn() } catch { v = null }
    if (v) return { v, ms: Date.now() - t0 }
    if (Date.now() - t0 > ms) throw new Error(`waitFor 超时(${ms}ms)${label ? '：' + label : ''}`)
    await sleep(step)
  }
}
const portFree = (port) => new Promise((res) => {
  const s = net.createConnection({ port, host: '127.0.0.1' })
  s.on('connect', () => { s.destroy(); res(false) })
  s.on('error', () => res(true))
})
async function pickPort(want) { let p = want; while (!(await portFree(p))) p += 10; return p }
const killTree = (pid) => new Promise((res) => {
  const k = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
  k.on('close', () => res()); k.on('error', () => { try { process.kill(Number(pid), 'SIGKILL') } catch {}; res() })
})
function launchDsh({ port, patchFile, dshHome, userProfile, envExtra, tag }) {
  return spawn(process.execPath, [DSH_BIN, '--patch', patchFile, '--profile', 'web', '--port', String(port), '--no-open'], {
    cwd: REPO, env: { ...process.env, DSH_HOME: dshHome, USERPROFILE: userProfile, ...envExtra }, stdio: ['ignore', 'pipe', 'pipe'],
  })
}
async function waitReady(port, userProfile) {
  const tokPath = join(userProfile, '.dsh', 'termfleet', 'token.json')
  await waitFor(() => existsSync(tokPath), 20000, 300, '插件令牌')
  const tok = JSON.parse(readFileSync(tokPath, 'utf8')).token
  await waitFor(async () => {
    try { const r = await fetch(`http://127.0.0.1:${port}/dsh-termfleet/ping`, { headers: { authorization: 'Bearer ' + tok } }); return r.status === 200 } catch { return false }
  }, 30000, 500, 'ping')
  return tok
}
const api = (base, tok, path, method = 'GET', body) => fetch(`http://127.0.0.1:${base}/dsh-termfleet/${path}`, {
  method, headers: { authorization: 'Bearer ' + tok, ...(body ? { 'content-type': 'application/json' } : {}) },
  body: body ? JSON.stringify(body) : undefined,
})

async function main() {
  const leadPort = await pickPort(3190)
  const memberPort = await pickPort(3181)
  const tmp = mkdtempSync(join(tmpdir(), 'tf-demo010-'))
  for (const d of [join(tmp, 'dl'), join(tmp, 'dm'), join(tmp, 'hl'), join(tmp, 'hm')]) mkdirSync(d, { recursive: true })
  mkdirSync(dirname(SHOT), { recursive: true })
  const patchFile = join(tmp, 'boot.patch.yml')
  writeFileSync(patchFile, `- insert:\n    - id: termfleet\n      name: 'D:/coding/dsh-termfleet/lib/index.js'\n      config: {}\n`)
  for (const up of [join(tmp, 'hl'), join(tmp, 'hm')]) {
    try {
      const real = 'C:/Users/20369/.version-fox/sdks/nodejs/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-llm'
      const j = join(up, '.version-fox', 'sdks', 'nodejs', 'node_modules', '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-llm')
      mkdirSync(dirname(j), { recursive: true }); symlinkSync(real, j, 'junction')
    } catch {}
  }
  const wrapper = join(tmp, 'wrapper.html')
  const children = []
  let browser = null
  const fails = []
  const must = (ok, what) => { console.log(`${ok ? '✔' : '✘'} ${what}`); if (!ok) fails.push(what) }
  try {
    const lead = launchDsh({ port: leadPort, patchFile, dshHome: join(tmp, 'dl'), userProfile: join(tmp, 'hl'), envExtra: { TERMFLEET_ROLE: 'lead', TERMFLEET_TOKEN: TEAM_TOKEN, TERMFLEET_NAME: '演示lead-A机' }, tag: 'lead' })
    children.push(lead)
    const TOK_LEAD = await waitReady(leadPort, join(tmp, 'hl'))
    const member = launchDsh({ port: memberPort, patchFile, dshHome: join(tmp, 'dm'), userProfile: join(tmp, 'hm'), envExtra: { TERMFLEET_NAME: MEMBER_NAME, TERMFLEET_WAIT_SECS: '3', TERMFLEET_NOTIFY_COOLDOWN_MIN: '0.2' }, tag: 'member' })
    children.push(member)
    const TOK_MEMBER = await waitReady(memberPort, join(tmp, 'hm'))
    console.log(`[boot] lead=${leadPort} member=${memberPort}`)
    const leadUrl = `http://127.0.0.1:${leadPort}/dsh-termfleet/app?token=${encodeURIComponent(TOK_LEAD)}`
    const memberUrl = `http://127.0.0.1:${memberPort}/dsh-termfleet/app?token=${encodeURIComponent(TOK_MEMBER)}`
    writeFileSync(wrapper, `<!doctype html><meta charset="utf-8"><title>TermFleet 0.1 双机同框演示</title>
<body style="margin:0;background:#0b0d10;height:100vh;display:flex;flex-direction:column">
<div style="flex:none;padding:10px 16px;color:#adb2b8;font:600 13px -apple-system,'Segoe UI',sans-serif;border-bottom:1px solid #1c1f26">TermFleet 0.1 双机同框 · 左=lead(A机) 右=成员(B机) · 全程真实操作不剪辑</div>
<div style="flex:1;display:grid;grid-template-columns:1fr 1fr;min-height:0">
<iframe id="L" src="${leadUrl}" style="border:0;width:100%;height:100%"></iframe>
<iframe id="R" src="${memberUrl}" style="border:0;width:100%;height:100%"></iframe></div></body>`)

    browser = await chromium.launch({ args: ['--no-proxy-server'] })
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1000 }, locale: 'zh-CN', recordVideo: { dir: dirname(SHOT), size: { width: 1920, height: 1000 } } })
    const page = await ctx.newPage()
    const video = page.video()
    await page.goto('file:///' + wrapper.replaceAll('\\', '/'))
    await page.waitForFunction(() => document.querySelectorAll('iframe').length === 2, { timeout: 10000 })
    const leadFrame = (await waitFor(async () => page.frames().find((f) => f.url().includes(':' + leadPort)) || null, 10000, 200, 'lead iframe')).v
    const memberFrame = (await waitFor(async () => page.frames().find((f) => f.url().includes(':' + memberPort)) || null, 10000, 200, 'member iframe')).v
    await sleep(2000)

    // 帧1：none 态双 CTA 大卡（停留入画）
    await leadFrame.evaluate(() => document.getElementById('navRemote').click())
    await sleep(2800)

    // 帧2：本机 pwsh 探针（xterm 原生终端 + 真实键入回显）→ 断开
    await leadFrame.evaluate(() => document.getElementById('ctaLocal').click())
    await sleep(1200)
    await leadFrame.evaluate(() => document.getElementById('reqLocalBtn').click())
    await waitFor(async () => leadFrame.evaluate(() => !!document.querySelector('#ptyXterm .xterm')), 15000, 300, 'xterm 挂载')
    await sleep(1500)
    // 真实键盘：term.focus() 后 page.keyboard 走 CDP 进 iframe；打不进再合成小写兜底（caps 会被合成层丢）
    await leadFrame.evaluate(() => { window.XT.term.focus() })
    await sleep(300)
    await page.keyboard.type('echo TERMFLEET_010_OK', { delay: 45 })
    await page.keyboard.press('Enter')
    let ok = null
    try {
      ok = await waitFor(async () => {
        const t = await leadFrame.evaluate(() => { const x = window.XT && window.XT.term; if (!x || !x.buffer) return ''; const ls = []; for (let i = 0; i < x.buffer.active.length; i++) { const l = x.buffer.active.getLine(i); if (l) { const s = l.translateToString(true); if (s.trim()) ls.push(s.trim()) } } return ls.join('\n') })
        return t.includes('TERMFLEET_010_OK') ? true : null
      }, 6000, 300, 'xterm 回显(真实键盘)')
    } catch { ok = null }
    if (!ok) {
      console.log('[demo] 真实键盘未落进 iframe——合成小写兜底（视觉等价）')
      await leadFrame.evaluate(() => {
        const ta = window.XT.term.textarea; ta.focus()
        const s = 'echo tf010ok'
        for (const ch of s) ta.dispatchEvent(new KeyboardEvent('keydown', { key: ch, code: '', keyCode: ch.charCodeAt(0), which: ch.charCodeAt(0), bubbles: true, cancelable: true }))
        ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }))
      })
      try {
        await waitFor(async () => {
          const t = await leadFrame.evaluate(() => { const x = window.XT && window.XT.term; if (!x || !x.buffer) return ''; const ls = []; for (let i = 0; i < x.buffer.active.length; i++) { const l = x.buffer.active.getLine(i); if (l) { const s = l.translateToString(true); if (s.trim()) ls.push(s.trim()) } } return ls.join('\n') })
          return t.includes('tf010ok') ? true : null
        }, 8000, 300, 'xterm 回显(合成兜底)')
      } catch (e) {
        try {
          const dg = await leadFrame.evaluate(() => {
            const x = window.XT && window.XT.term
            const buf = []
            if (x && x.buffer && x.buffer.active) { for (let i = 0; i < x.buffer.active.length; i++) { const l = x.buffer.active.getLine(i); if (l) { const s = l.translateToString(true); if (s.trim()) buf.push(s.trim()) } } }
            const ix = document.getElementById('ptyXterm').getBoundingClientRect()
            return {
              chan: (document.getElementById('chanPill') || {}).textContent,
              chStatus: typeof CH !== 'undefined' && CH ? CH.status + '/' + (CH.mode || '') : String(CH),
              VIEW: typeof VIEW !== 'undefined' ? VIEW : '?',
              ctxLocalDisp: getComputedStyle(document.getElementById('ctxLocal')).display,
              ptyXtermDisp: getComputedStyle(document.getElementById('ptyXterm')).display,
              ptyTermDisp: getComputedStyle(document.getElementById('ptyTerm')).display,
              raws: performance.getEntriesByType('resource').filter((f) => f.name.indexOf('/pty/raw') >= 0).length,
              bufTail: buf.slice(-3),
              xtermRect: Math.round(ix.width) + 'x' + Math.round(ix.height),
              focused: String((document.activeElement || {}).className || '').slice(0, 30),
            }
          })
          console.log('[diag] ' + JSON.stringify(dg))
        } catch (e2) { console.log('[diag-err]', String(e2).slice(0, 80)) }
        throw e
      }
    }
    must(true, '本机 pwsh 探针：xterm 原生终端键入回显')
    await sleep(2800)
    await leadFrame.evaluate(() => document.getElementById('rtEndBtn').click())
    await sleep(1600)

    // 帧3：lead ⚙设置 → TF-JOIN 取码（弹层内，码留屏）
    await leadFrame.evaluate(() => { const m = document.getElementById('settingsMask'); if (m && !m.classList.contains('on')) document.getElementById('settingsBtn').click() })
    await sleep(800)
    await leadFrame.evaluate(() => document.getElementById('pairCodeBtn').click())
    await waitFor(async () => /^TF1-/.test(await leadFrame.evaluate(() => document.getElementById('pairCode').value)), 10000, 300, 'lead 取码')
    await sleep(3000)

    // 帧4：成员设置弹层粘贴码 → 入队（同框可见「已加入」）
    const code = await leadFrame.evaluate(() => document.getElementById('pairCode').value)
    await memberFrame.evaluate(() => document.getElementById('navRemote').click())
    await memberFrame.evaluate(() => { const m = document.getElementById('settingsMask'); if (m && !m.classList.contains('on')) document.getElementById('settingsBtn').click() })
    await sleep(800)
    await memberFrame.fill('#joinCode', code)
    await memberFrame.evaluate(() => document.getElementById('joinBtn').click())
    const joined = await waitFor(async () => {
      const f = await api(leadPort, TOK_LEAD, 'fleet').then((r) => r.json())
      return (f.members || []).some((m) => m.name === MEMBER_NAME) ? true : null
    }, 15000, 400, '成员入队上线')
    must(!!joined.v, '成员粘贴邀请码入队并上线')
    await sleep(3200)

    // 帧5：成员开信任（弹层内勾选+保存可见）
    await memberFrame.evaluate(() => document.getElementById('trustTgl').click())
    await memberFrame.evaluate(() => document.getElementById('pairSave').click())
    await sleep(2000)

    // 帧6：lead ⚡一键查看 → 信任自动允许(ro) → 订阅中
    await leadFrame.evaluate((nm) => { const b = document.querySelector(`[data-qview="${nm}"]`); if (b) b.click() }, MEMBER_NAME)
    const roC = await waitFor(async () => {
      const l = await api(leadPort, TOK_LEAD, 'consent/list').then((r) => r.json())
      return (l.consents || []).find((x) => x.type === 'sess' && x.status === 'active' && x.mode === 'ro' && x.auto === 'ro') || null
    }, 12000, 400, '信任自动允许')
    await waitFor(async () => (await leadFrame.evaluate(() => document.getElementById('sfState').textContent)) === '订阅中', 15000, 400, '一键查看订阅中')
    must(!!roC.v, '⚡一键查看：信任通道自动允许(只读)并订阅中')
    await sleep(2200)

    // 帧7：rw 经典审批卡（成员面板点头入画）
    await leadFrame.evaluate(() => document.getElementById('rtEndBtn').click())
    await sleep(1200)
    await leadFrame.evaluate((nm) => { const el = document.querySelector(`#memberDevs [data-member="${nm}"]`); if (el) el.click() }, MEMBER_NAME)
    await sleep(800)
    await leadFrame.evaluate(() => document.getElementById('sfReqSess').click())
    await waitFor(async () => {
      const l = await api(leadPort, TOK_LEAD, 'consent/list').then((r) => r.json())
      return (l.consents || []).find((x) => x.type === 'sess' && x.status === 'pending') || null
    }, 8000, 300, 'rw pending 已创建')
    await memberFrame.evaluate(() => location.reload())
    await sleep(2400)
    await memberFrame.evaluate(() => document.getElementById('navRemote').click())
    await waitFor(async () => memberFrame.evaluate(() => !!document.getElementById('csA')), 15000, 400, '成员审批卡出现')
    await sleep(1800)
    await memberFrame.evaluate(() => document.getElementById('csA').click())
    const rwC = await waitFor(async () => {
      const l = await api(leadPort, TOK_LEAD, 'consent/list').then((r) => r.json())
      return (l.consents || []).find((x) => x.type === 'sess' && x.status === 'active' && x.mode === 'rw') || null
    }, 12000, 400, 'rw 通道生效')
    must(!!rwC.v, '经典审批流：成员面板点「允许」→ rw 通道建立')
    await leadFrame.evaluate((nm) => { const el = document.querySelector(`#memberDevs [data-member="${nm}"]`); if (el) el.click() }, MEMBER_NAME)
    await waitFor(async () => (await leadFrame.evaluate(() => document.getElementById('sfState').textContent)) === '订阅中', 15000, 400, 'rw 后重订阅')
    await waitFor(async () => leadFrame.evaluate(() => !document.getElementById('sfInput').disabled), 10000, 300, '插话框启用')
    await sleep(1500)

    // 帧8：成员侧会话三连发 → lead 对话流实时滚入
    for (const text of [`演示-${RUN}：成员这边正在改登录模块`, `演示-${RUN}：撞上一个时区转换的坑`, `演示-${RUN}：已定位，准备修复`]) {
      await api(memberPort, TOK_MEMBER, 'probe-session/write', 'POST', { text })
      await sleep(3200)
    }
    const bubbles = await leadFrame.evaluate(() => document.querySelectorAll('#sfList .sfmsg').length)
    must(bubbles >= 3, `会话流镜像实时滚入（lead 对话流 ${bubbles} 条气泡）`)
    await sleep(2000)

    // 帧9：lead 插话 → 成员会话真实出现 → ✓已送达
    await leadFrame.fill('#sfInput', `演示-${RUN}：时区统一用 UTC 存储，别在展示层转换`)
    await leadFrame.evaluate(() => document.getElementById('sfSend').click())
    const ack = await waitFor(async () => {
      const p = await leadFrame.evaluate(() => { const a = document.querySelector('#sfList .sfack'); return a ? a.textContent : '' })
      return p.includes('已送达') ? p : null
    }, 20000, 400, '插话送达回执')
    must(!!ack.v, `插话送达成员 dsh 会话（回执「${(ack.v || '').trim()}」）`)
    await sleep(2600)

    // 帧10：成员建绑定任务 → lead 任务列表 ⚡徽标 → 详情会话 tab 绑定卡
    const pm = await api(memberPort, TOK_MEMBER, 'probe-session').then((r) => r.json())
    const mSid = ((pm.sessionEvents || []).slice(-1)[0] || {}).sessionId || ''
    const ct = await api(memberPort, TOK_MEMBER, 'tasks/create', 'POST', { title: `演示-${RUN}：修复时区转换`, project: '默认', session: { member: MEMBER_NAME, sessionId: mSid, label: '演示绑定' } }).then((r) => r.json())
    console.log(`[demo] create resp=${JSON.stringify(ct).slice(0, 220)} mSid=${mSid}`)
    let synced = null
    try {
      synced = await waitFor(async () => {
        const l = await api(leadPort, TOK_LEAD, 'tasks').then((r) => r.json())
        return (l.tasks || []).some((t) => t.id === ct.task?.id) ? true : null
      }, 15000, 400, '绑定任务跨机同步到 lead')
    } catch (e) {
      const l = await api(leadPort, TOK_LEAD, 'tasks').then((r) => r.json())
      console.log(`[demo diag] lead tasks=[${(l.tasks || []).map((t) => t.id + ':' + (t.session ? '⚡' : '-')).join(',')}]`)
      throw e
    }
    await leadFrame.evaluate(() => document.getElementById('navTask').click())
    await sleep(1600)
    const rowId = ct.task?.id
    await waitFor(async () => leadFrame.evaluate((id) => !!document.querySelector(`.trow[data-id="${id}"]`), rowId), 10000, 300, 'lead 任务行出现')
    await leadFrame.evaluate((id) => { const r = document.querySelector(`.trow[data-id="${id}"] .title`); if (r) r.click() }, rowId)
    await waitFor(async () => leadFrame.evaluate(() => document.getElementById('ovl').classList.contains('on')), 8000, 300, '详情大窗打开')
    await sleep(1200)
    await leadFrame.evaluate(() => { const a = document.querySelector('[data-pane="dp-sess"]'); if (a) a.click() })
    const bindCard = await waitFor(async () => {
      const t = await leadFrame.evaluate(() => document.getElementById('dpSessBody').textContent)
      return t.includes('绑定会话') ? t.slice(0, 80) : null
    }, 8000, 300, '详情会话tab绑定卡')
    must(!!bindCard.v, `任务详情绑定卡：${(bindCard.v || '').replace(/\s+/g, ' ').slice(0, 60)}…`)
    await sleep(3200)
    await leadFrame.evaluate(() => { const o = document.getElementById('ovl'); o.classList.remove('on') })

    // 帧11：审计收尾（全链留痕一屏，含新白话化行）
    await leadFrame.evaluate(() => document.getElementById('navAudit').click())
    await sleep(3000)

    await ctx.close().catch(() => {})
    try { if (video) await video.saveAs(SHOT) } catch (e) { console.log('[video save]', String(e).slice(0, 80)) }
    await sleep(1500)
    const size = existsSync(SHOT) ? statSync(SHOT).size : 0
    must(size > 200000, `录屏落盘 docs/audit/video/termfleet-010-demo.webm（${Math.round(size / 1024)}KB）`)

    console.log(`\n[exit] ${fails.length ? 1 : 0}（fails: ${fails.length ? fails.join('；') : '无'}）`)
    return fails.length ? 1 : 0
  } catch (e) {
    console.error('[fatal]', e?.stack || e)
    try { if (browser) await browser.close() } catch {}
    return 1
  } finally {
    for (const c of children) { try { await killTree(c.pid) } catch {} }
    await sleep(1200)
    try { rmSync(tmp, { recursive: true, force: true }) } catch {}
  }
}

process.exit(await main())
