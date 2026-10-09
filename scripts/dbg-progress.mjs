// dbg-progress.mjs — 契约 H 最小实证：双实例 + 一条写入 + 45s 采样，观察 progress 帧在哪一环断
import { spawn } from 'node:child_process'
import net from 'node:net'
import { mkdtempSync, readFileSync, existsSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DSH_BIN = 'C:/Users/20369/.version-fox/sdks/nodejs/node_modules/@deepseek-ai/dsh/lib/bin.js'
const TEAM_TOKEN = 'dbg-h-2026'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const portFree = (port) => new Promise((res) => { const s = net.createConnection({ port, host: '127.0.0.1' }); s.on('connect', () => { s.destroy(); res(false) }); s.on('error', () => res(true)) })
async function pickPort(want) { let p = want; while (!(await portFree(p))) p += 10; return p }
const killTree = (pid) => { try { spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' }) } catch {} }
function launchDsh({ port, patchFile, dshHome, userProfile, envExtra, tag }) {
  const child = spawn(process.execPath, [DSH_BIN, '--patch', patchFile, '--profile', 'web', '--port', String(port), '--no-open'], {
    cwd: REPO, env: { ...process.env, DSH_HOME: dshHome, USERPROFILE: userProfile, ...envExtra }, stdio: ['ignore', 'pipe', 'pipe'],
  })
  let out = ''; child.stdout.on('data', (d) => { out += String(d) }); child.stderr.on('data', (d) => { out += String(d) })
  child.tag = tag; child.out = () => out; return child
}
async function sseCollect(url, token, maxMs, onEvent) {
  const ac = new AbortController()
  try {
    const res = await fetch(url, { headers: { authorization: 'Bearer ' + token }, signal: ac.signal })
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '', cur = null
    const deadline = Date.now() + maxMs
    for (;;) {
      const left = deadline - Date.now(); if (left <= 0) break
      const timer = new Promise((r) => setTimeout(() => r({ done: true, _t: 1 }), left))
      const chunk = await Promise.race([reader.read(), timer])
      if (chunk._t || chunk.done) break
      buf += dec.decode(chunk.value, { stream: true }); let idx
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).replace(/\r$/, ''); buf = buf.slice(idx + 1)
        if (line === '') { if (cur) { onEvent(cur); cur = null } continue }
        if (line.startsWith('event:')) cur = { ev: line.slice(6).trim(), data: '' }
        else if (line.startsWith('data:') && cur) cur.data += line.slice(5).trim()
      }
    }
    try { ac.abort() } catch {}
  } catch (e) { console.log('[sse err]', String(e).slice(0, 80)) }
}

const leadPort = await pickPort(3190); const memberPort = await pickPort(3181)
const tmp = mkdtempSync(join(tmpdir(), 'tf-dbg-h-'))
const upL = join(tmp, 'hl'); const upM = join(tmp, 'hm')
for (const d of [join(tmp, 'dl'), join(tmp, 'dm'), upL, upM]) mkdirSync(d, { recursive: true })
const patchFile = join(tmp, 'p.yml')
writeFileSync(patchFile, `- insert:\n    - id: termfleet\n      name: 'D:/coding/dsh-termfleet/lib/index.js'\n      config: {}\n`)
for (const up of [upL, upM]) {
  try {
    const real = 'C:/Users/20369/.version-fox/sdks/nodejs/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-llm'
    const j = join(up, '.version-fox', 'sdks', 'nodejs', 'node_modules', '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-llm')
    mkdirSync(dirname(j), { recursive: true }); symlinkSync(real, j, 'junction')
  } catch {}
}
const lead = launchDsh({ port: leadPort, patchFile, dshHome: join(tmp, 'dl'), userProfile: upL, envExtra: { TERMFLEET_ROLE: 'lead', TERMFLEET_TOKEN: TEAM_TOKEN, TERMFLEET_NAME: 'DBG-LEAD' }, tag: 'lead' })
const member = launchDsh({ port: memberPort, patchFile, dshHome: join(tmp, 'dm'), userProfile: upM, envExtra: { TERMFLEET_NAME: 'DBG-MEMBER', TERMFLEET_WAIT_SECS: '3', TERMFLEET_NOTIFY_COOLDOWN_MIN: '0.2', TERMFLEET_STUCK_MIN: '0.1' }, tag: 'member' })
async function ready(child, port, up) {
  for (let i = 0; i < 180; i++) { if (/http:\/\/127\.0\.0\.1:\d+\/\?token=\S+/.test(child.out())) break; await sleep(500) }
  const tok = JSON.parse(readFileSync(join(up, '.dsh', 'termfleet', 'token.json'), 'utf8')).token
  for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://127.0.0.1:${port}/dsh-termfleet/ping`, { headers: { authorization: 'Bearer ' + tok } }); if (r.status === 200) return tok } catch {} await sleep(500) }
  throw new Error(child.tag + ' not ready')
}
const TOK_L = await ready(lead, leadPort, upL); const TOK_M = await ready(member, memberPort, upM)
console.log(`[boot] lead=${leadPort} member=${memberPort}`)
// member 配对（走 TF-JOIN 码，最真实）
const cr = await fetch(`http://127.0.0.1:${leadPort}/dsh-termfleet/pairing/code`, { headers: { authorization: 'Bearer ' + TOK_L } }).then((r) => r.json())
const jn = await fetch(`http://127.0.0.1:${memberPort}/dsh-termfleet/pairing/join`, { method: 'POST', headers: { authorization: 'Bearer ' + TOK_M, 'content-type': 'application/json' }, body: JSON.stringify({ code: cr.code }) }).then((r) => r.json())
console.log('[pair]', jn.ok, 'connected=' + jn.connected)
await sleep(3000)

const notes = []
const collector = sseCollect(`http://127.0.0.1:${leadPort}/dsh-termfleet/stream?k=events`, TOK_L, 45000, (ev) => {
  if (ev.ev === 'tf-notify') { notes.push(ev.data); console.log('[SSE tf-notify]', ev.data.slice(0, 90)) }
})
const apiM = (p, m, b) => fetch(`http://127.0.0.1:${memberPort}/dsh-termfleet/${p}`, { method: m || 'GET', headers: { authorization: 'Bearer ' + TOK_M, ...(b ? { 'content-type': 'application/json' } : {}) }, body: b ? JSON.stringify(b) : undefined })
const apiL = (p) => fetch(`http://127.0.0.1:${leadPort}/dsh-termfleet/${p}`, { headers: { authorization: 'Bearer ' + TOK_L } }).then((r) => r.json())

await sleep(5000)
console.log('[t+5s] probe write#1…')
const t12 = Date.now()
const w = await apiM('probe-session/write', 'POST', { text: 'DBG-H-第一条消息' }).then((r) => r.json())
console.log('[write1]', w.ok, 'echoSeq=' + w.echoSeq)
let stuckTs = null
for (let i = 0; i < 50; i++) {
  await sleep(400)
  const f = await apiL('fleet')
  const lp = (f.members || []).find((m) => m.name === 'DBG-MEMBER')?.lastProgress
  if (lp?.kind === 'stuck' && lp.ts > t12) { stuckTs = lp.ts; console.log('[stuck#1 observed] at +' + Math.round((stuckTs - t12) / 1000) + 's'); break }
}
console.log('[write2] at +' + Math.round((Date.now() - t12) / 1000) + 's')
await apiM('probe-session/write', 'POST', { text: 'DBG-H-第二条' })
for (const t of [4, 8, 12, 16]) {
  await sleep(4000)
  const f = await apiL('fleet')
  const lp = (f.members || []).find((m) => m.name === 'DBG-MEMBER')?.lastProgress
  const ps = await apiM('probe-session').then((r) => r.json())
  const last = (ps.sessionEvents || []).slice(-1)[0] || {}
  console.log(`[w2+${t}s] lastProgress=${JSON.stringify(lp)} lastEv=${last.type}@${last.t ? Math.round((Date.now() - last.t) / 1000) + 's前' : '-'} notes=${notes.length}`)
}
await collector
console.log('[done] SSE tf-notify 全帧:')
for (const n of notes) console.log('  ', n.slice(0, 110))
for (const c of [lead, member]) killTree(c.pid)
await sleep(1500)
try { rmSync(tmp, { recursive: true, force: true }) } catch {}
