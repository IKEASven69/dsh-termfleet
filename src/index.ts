/**
 * dsh-termfleet host 半（TS 镜像源）。
 * ⚠ 本文件=lib/index.js 的逐字镜像 + TS 头：运行装载的是 lib/index.js（宿主 file://），
 *   改动请改 lib 后运行 node scripts/rebuild-src.cjs 再生本文件，勿手编（历史手拼多次损坏）。
 * 能力：鉴权门 / 任务库 / 决策笔记库(wnlds 治理) / 审计 / 同意总线(握手卡+限时+SSE) / PTY 门控 / M3(diff/replay/cost/session-links)。
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'

export interface Config {}

/**
 * dsh-termfleet host 半（M0 探针版；源码 src/index.ts，手写同步镜像）。
 * 两命门探针路由（全部挂在宿主 webServer 上，未鉴权——仅本机回环探针用）：
 *   GET  /dsh-termfleet/ping                自检 {"ok":true,...}
 *   GET  /dsh-termfleet/probe-session       会话流命门只读面：全局 session/event 环形缓冲
 *   POST /dsh-termfleet/probe-session/write 会话流命门写入面：agentLoop.create(假 provider)
 *                                            + agent.followup(UserMessage)，等待 user/message 回显
 *   GET  /dsh-termfleet/probe-pty           PTY 命门：懒 spawn pwsh，回显滚动缓冲
 *   POST /dsh-termfleet/probe-pty/write     PTY 命门写入面：pty.write(data)，等待标记回显
 *   POST /dsh-termfleet/probe-pty/kill      显式杀掉探针 PTY
 * 写法依据：
 *   - webServer.register({kind,path,handler})：dsh-host-webserver/lib/types/index.d.ts:30-46,90
 *   - 会话流：ctx.on('session/event')（dsh-session；untagged listener 全局放行 dsh-scope/lib/index.js:331-332）
 *   - 写入：agentLoop.create + agent.followup（dsh-api-session-controller/lib/index.js:773-774 同款内部调用）
 *   - UserMessage 构造：dsh-llm createUserMessage（lib/index.js:48 导出；同 file URL 导入命中宿主 ESM 缓存）
 *   - PTY：@lydell/node-pty spawn/onData/write/kill（照抄 termfleet-heimdall server/src/pty-host.ts:54-77）
 */
export const name = 'dsh-termfleet'

/** M0 探针会话 id（每次装载唯一，前缀固定——清理 ~/.dsh/sessions 残留时按前缀识别）。 */
const PROBE_SESSION_ID = `termfleet-m0-probe-${Date.now().toString(36)}`

const waitFor = (pred, timeoutMs, stepMs = 20) =>
  new Promise((resolve) => {
    const t0 = Date.now()
    const timer = setInterval(() => {
      let v
      try { v = pred() } catch { v = undefined }
      if (v) { clearInterval(timer); resolve(v) }
      else if (Date.now() - t0 > timeoutMs) { clearInterval(timer); resolve(null) }
    }, stepMs)
  })

export function apply(ctx, _config) {
  const bootAt = Date.now()
  ctx.logger.info('dsh-termfleet: M0 探针插件已加载（命门① session 流 + 命门② PTY）')

  // ── 鉴权门（M1：M0 发现插件路由绕过宿主 launch token，全部路由必须过门）──
  // 令牌持久化 ~/.dsh/termfleet/token.json（跨重启稳定）；装载失败 fail-closed（持续 401）。
  let gateToken = null
  let safeEqual = null
  ;(async () => {
    try {
      const [{ randomBytes, timingSafeEqual }, fs, path, os] = await Promise.all([
        import('node:crypto'), import('node:fs'), import('node:path'), import('node:os'),
      ])
      const dir = path.join(os.homedir(), '.dsh', 'termfleet')
      const file = path.join(dir, 'token.json')
      let t = null
      try { t = JSON.parse(fs.readFileSync(file, 'utf8')).token } catch { /* 首次或损坏 */ }
      if (typeof t !== 'string' || !t.length) {
        t = randomBytes(24).toString('hex')
        fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(file, JSON.stringify({ token: t, createdAt: new Date().toISOString() }, null, 2))
      }
      gateToken = t
      safeEqual = (a, b) => {
        const ba = Buffer.from(a), bb = Buffer.from(b)
        return ba.length === bb.length && timingSafeEqual(ba, bb)
      }
      ctx.logger.info(`dsh-termfleet: 鉴权门已启用（令牌文件 ${file}，全路由无豁免）`)
    } catch (e) {
      ctx.logger.error(`dsh-termfleet: 令牌装载失败，全部路由将持续 401（fail-closed）：${String(e).slice(0, 200)}`)
    }
  })()

  /** Bearer 头或 ?token= 查询参数；令牌未就绪一律拒绝。 */
  const isAuthorized = (req, url) => {
    if (!gateToken || !safeEqual) return false
    const h = String(req.headers?.authorization ?? '')
    const bearer = h.startsWith('Bearer ') ? h.slice(7) : ''
    const q = url.searchParams.get('token') ?? ''
    return (bearer.length > 0 && safeEqual(bearer, gateToken)) || (q.length > 0 && safeEqual(q, gateToken))
  }
  const guard = (req, res) => {
    const url = new URL(req.url, 'http://localhost')
    if (isAuthorized(req, url)) return false
    res.writeHead(401, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end(JSON.stringify({ error: 'unauthorized' }))
    return true
  }

  // ── 任务库（M1 真实现：项目共享任务板，落盘 ~/.dsh/termfleet/tasks.json） ──
  const taskStore = (() => {
    let data = null
    let mods = null
    let file = ''
    const ensure = async () => {
      if (!mods) mods = { fs: await import('node:fs'), path: await import('node:path'), os: await import('node:os') }
      if (!data) {
        file = mods.path.join(mods.os.homedir(), '.dsh', 'termfleet', 'tasks.json')
        try { data = JSON.parse(mods.fs.readFileSync(file, 'utf8')) } catch { data = { seq: 0, tasks: [] } }
        if (!data || !Array.isArray(data.tasks)) data = { seq: 0, tasks: [] }
      }
      return data
    }
    const save = () => {
      if (!mods || !data) return
      mods.fs.mkdirSync(mods.path.dirname(file), { recursive: true })
      mods.fs.writeFileSync(file, JSON.stringify(data, null, 2))
    }
    return {
      async list() { return (await ensure()).tasks },
      async create(input, by) {
        const d = await ensure()
        d.seq++
        const t = {
          id: 'T-' + String(d.seq).padStart(3, '0'),
          title: String(input.title ?? '未命名').slice(0, 120),
          desc: String(input.desc ?? '').slice(0, 4000),
          project: String(input.project ?? '默认').slice(0, 60),
          prio: (['P0', 'P1', 'P2'].includes(input.prio) ? input.prio : 'P2'),
          due: String(input.due ?? '').slice(0, 20),
          cli: String(input.cli ?? '').slice(0, 30),
          status: 'todo', owner: null,
          createdAt: Date.now(), updatedAt: Date.now(),
          history: [{ ts: Date.now(), by, what: '创建' }],
        }
        d.tasks.unshift(t); save()
        auditStore.add(by, '新建任务', t.id + ' ' + t.title)
        return t
      },
      async act(op, id, patch, by) {
        const d = await ensure()
        const t = d.tasks.find((x) => x.id === id)
        if (!t) return null
        const H = (what) => { t.history.push({ ts: Date.now(), by, what }); t.updatedAt = Date.now() }
        if (op === 'claim') { const from = t.owner; t.owner = by; H(`认领 ${from ?? '无人'} → ${by}`) }
        else if (op === 'release') { t.owner = null; H('取消认领') }
        else if (op === 'update') {
          for (const k of ['title', 'desc', 'project', 'due', 'cli'])
            if (typeof patch?.[k] === 'string') { t[k] = String(patch[k]).slice(0, k === 'desc' ? 4000 : 120); H(`改 ${k}`) }
          if (['P0', 'P1', 'P2'].includes(patch?.prio)) { t.prio = patch.prio; H(`优先级 → ${patch.prio}`) }
          if (typeof patch?.owner === 'string') { t.owner = patch.owner; H(`指派 → ${patch.owner}`) }
        } else if (op === 'status') {
          const to = String(patch?.status ?? '')
          if (['todo', 'doing', 'review', 'done', 'blocked'].includes(to)) { t.status = to; H(`状态 → ${to}`) }
        } else if (op === 'delete') { auditStore.add(by, '删除任务', id + ' ' + (t.title || '')); d.tasks = d.tasks.filter((x) => x.id !== id); save(); return t }
        else return t
        auditStore.add(by, '任务操作 ' + op, id + ' ' + (t.title || ''))
        save(); return t
      },
    }
  })()

  // ── 探针状态（全部随路由回显） ──────────────────────────────
  const state = {
    pluginBootAt: bootAt,
    probeSessionId: PROBE_SESSION_ID,
    sessionCreated: [],
    sessionEvents: [],        // {t, sessionId, seq, type, brief} 环形 500
    streamFrames: 0,
    lastStreamFrameAt: null,
    agentEvents: [],
    writes: [],               // 每次 followup 的完整记录（含回显延迟）
    pty: null,                // ensurePty 填充
    ptyTail: [],              // {t, d} 环形 400
    llm: { loaded: false, source: null, error: null },
    services: { ready: false, agents: 0, sessions: 0, at: null, error: null },
  }

  // ── 实时流总线（SSE 订阅源）：pty 输出与会话事件 ──
  const bus = { pty: [], sess: [], history: { pty: [], sess: [] } }
  const emitPty = (d) => { bus.history.pty.push(d); if (bus.history.pty.length > 500) bus.history.pty.shift(); for (const f of bus.pty) { try { f(d) } catch {} } }
  const emitSess = (e) => { bus.history.sess.push(e); if (bus.history.sess.length > 300) bus.history.sess.shift(); for (const f of bus.sess) { try { f(e) } catch {} } }

  // ── 命门①读：未打 scope 标的全局 listener（宿主内零网络零盘读） ──
  ctx.on('session/created', (s) => {
    state.sessionCreated.push({ t: Date.now(), id: s?.id })
  })
  ctx.on('session/event', (session, event) => {
    let brief = ''
    const data = event?.data
    if (data && Array.isArray(data.content)) {
      brief = data.content.filter((b) => b?.type === 'text').map((b) => b.text).join(' ').slice(0, 200)
    }
    const rec = { t: Date.now(), sessionId: session?.id, seq: event?.seq, type: event?.type, brief }
    state.sessionEvents.push(rec)
    emitSess(rec)
    if (state.sessionEvents.length > 500) state.sessionEvents.shift()
  })
  ctx.on('agent/assistant-stream', () => { state.streamFrames++; state.lastStreamFrameAt = Date.now() })
  ctx.on('agent/created', ({ agent }) => state.agentEvents.push({ t: Date.now(), kind: 'created', id: agent?.id, status: agent?.status }))
  ctx.on('agent/status', ({ agent, status }) => state.agentEvents.push({ t: Date.now(), kind: 'status', id: agent?.id, status }))
  ctx.on('agent/error', ({ agent, error }) => state.agentEvents.push({ t: Date.now(), kind: 'error', id: agent?.id, error: String(error).slice(0, 200) }))

  // ── 服务注入：agents / sessions / agentLoop（真宿主里全部在册） ──
  let svc = null
  let agentRef = null
  ctx.inject(['agents', 'sessions', 'agentLoop'], (c) => {
    svc = c
    state.services.ready = true
    state.services.at = Date.now()
    try {
      state.services.agents = c.agents.list().length
      state.services.sessions = c.sessions.list().length
    } catch (e) { state.services.error = String(e).slice(0, 200) }
    ctx.logger.info('dsh-termfleet: services injected (agents/sessions/agentLoop)')
  })

  // ── dsh-llm 装载：createUserMessage（与宿主同实例——相同 file URL 命中 ESM 模块缓存） ──
  let llmMod = null
  async function loadLlm() {
    if (llmMod) return llmMod
    const [{ pathToFileURL }, fs, path, os] = await Promise.all([
      import('node:url'), import('node:fs'), import('node:path'), import('node:os'),
    ])
    const candidates = []
    try {
      if (process.argv[1]) {
        // dsh bin = <install>/@deepseek-ai/dsh/lib/bin.js → 同级包目录
        candidates.push(path.resolve(path.dirname(process.argv[1]), '../..', 'dsh-llm', 'lib', 'index.js'))
      }
    } catch { /* fallthrough */ }
    // M0 探针机兜底（本机 dsh 安装树）
    candidates.push(path.join(os.homedir(), '.version-fox/sdks/nodejs/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-llm/lib/index.js'))
    for (const c of candidates) {
      try {
        if (!fs.existsSync(c)) continue
        llmMod = await import(pathToFileURL(c).href)
        state.llm = { loaded: true, source: c, error: null }
        return llmMod
      } catch (e) { state.llm.error = String(e).slice(0, 200) }
    }
    throw new Error(`dsh-llm not found; tried: ${candidates.join(' | ')}`)
  }

  // ── 命门①写：创建真 agent（假 provider → 请求快败，零 API 费用）+ followup ──
  async function sessionWrite(text) {
    const rec = { t: Date.now(), text, ok: false }
    state.writes.push(rec)
    if (!svc) { rec.error = 'services not ready (agents/sessions/agentLoop)'; return rec }
    try {
      if (!agentRef) {
        // 第三个参数 meta.cwd 喂 system-prompt 的 {{cwd}} 变量（dsh-agent-loop
        // types/index.d.ts:148 create(id, options?, meta?: Pick<SessionHeader,'cwd'>)）
        const agent = await svc.agentLoop.create(PROBE_SESSION_ID, {
          provider: 'termfleet-probe-noop',
          model: 'termfleet-probe-m',
        }, { cwd: process.cwd() })
        agentRef = agent
        rec.agentCreated = { id: agent.id, status: agent.status, at: Date.now() }
      }
      const m = await loadLlm()
      rec.llmSource = state.llm.source
      const msg = m.createUserMessage({
        content: [{ type: 'text', text }],
        source: { kind: 'user' },
      })
      rec.msgId = msg.id
      const sentAt = Date.now()
      agentRef.followup(msg) // 官方 prompt RPC 的同款内部调用（queue 模式）
      const hit = await waitFor(
        () => state.sessionEvents.find((e) => e.type === 'user/message' && typeof e.brief === 'string' && e.brief.includes(text)),
        8000,
      )
      rec.ok = Boolean(hit)
      if (hit) {
        rec.echoAt = hit.t
        rec.echoSeq = hit.seq
        rec.echoSessionId = hit.sessionId
        rec.echoLatencyMs = hit.t - sentAt
      } else {
        rec.error = 'timeout waiting for user/message echo in session/event stream'
      }
    } catch (e) {
      rec.error = String(e?.stack || e).slice(0, 400)
    }
    return rec
  }

  // ── 命门②：PTY spawn（@lydell/node-pty，懒加载隔离故障） ──
  let ptyProc = null
  async function ensurePty() {
    if (state.pty) return state.pty
    const fs = await import('node:fs')
    const path = await import('node:path')
    const os = await import('node:os')
    const st = {
      ok: false, file: null, args: null, cwd: null, pid: null,
      spawnAt: Date.now(), exited: false, exitCode: null, error: null,
      bytes: 0, chunks: 0, firstDataAt: null, lastDataAt: null, markers: [],
      moduleLoadedFrom: null,
    }
    state.pty = st
    try {
      const mod = await import('@lydell/node-pty')
      st.moduleLoadedFrom = new URL('.', import.meta.resolve('@lydell/node-pty')).href
      const candidates = [
        'C:/Program Files/PowerShell/7/pwsh.exe',
        'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',
      ]
      const file = candidates.find((c) => { try { return fs.existsSync(c) } catch { return false } }) || 'powershell.exe'
      const cwd = path.join(os.tmpdir(), 'termfleet-m0-pty')
      fs.mkdirSync(cwd, { recursive: true })
      const proc = mod.spawn(file, ['-NoLogo', '-NoProfile'], {
        name: 'xterm-256color',
        cols: 100,
        rows: 30,
        cwd,
        env: process.env,
      })
      st.ok = true
      st.file = file
      st.args = ['-NoLogo', '-NoProfile']
      st.cwd = cwd
      st.pid = proc.pid
      ptyProc = proc
      const seen = new Set()
      proc.onData((d) => {
        const now = Date.now()
        st.bytes += d.length
        st.chunks++
        if (!st.firstDataAt) st.firstDataAt = now
        st.lastDataAt = now
        state.ptyTail.push({ t: now, d: d.length > 2000 ? d.slice(0, 2000) : d })
        emitPty({ t: now, d: d.length > 2000 ? d.slice(0, 2000) : d })
        if (state.ptyTail.length > 400) state.ptyTail.shift()
        let idx = d.indexOf('M0_PTY_OK')
        while (idx !== -1) {
          if (!seen.has(st.chunks + ':' + idx)) {
            seen.add(st.chunks + ':' + idx)
            st.markers.push({ t: now, marker: 'M0_PTY_OK' })
          }
          idx = d.indexOf('M0_PTY_OK', idx + 1)
        }
      })
      proc.onExit(({ exitCode }) => { st.exited = true; st.exitCode = exitCode })
    } catch (e) {
      st.error = String(e?.stack || e).slice(0, 600)
    }
    return st
  }

  async function ptyWrite(data, expect) {
    const st = await ensurePty()
    if (!ptyProc) return { ok: false, error: st.error }
    const sentAt = Date.now()
    const before = st.markers.length
    ptyProc.write(data)
    const expectText = expect || 'M0_PTY_OK'
    const hit = await waitFor(() => (expectText ? (st.markers.length > before || null) : true), 8000)
    const latencyMs = st.markers.length > before ? st.markers[st.markers.length - 1].t - sentAt : null
    return {
      ok: Boolean(hit),
      wrote: data,
      sentAt,
      latencyMs,
      lastDataAt: st.lastDataAt,
      tail: tailText(500),
    }
  }

  function tailText(max = 500) {
    const joined = state.ptyTail.map((x) => x.d).join('')
    return joined.length > max ? joined.slice(-max) : joined
  }

  // ── webServer 路由 ─────────────────────────────────────────
    // ── 决策笔记库 v2（write-notes-like-deepseek 治理产品化：目录即状态 + 六分类 + 合法流转 + 校验门） ──
  // 树：~/.dsh/termfleet/team-memory/{proposed|implemented|rejected|archived}/{category}/yyyy-mm-dd-slug.md
  // 旧扁平 md 首次访问自动迁入 implemented/process；真实项目决策种子一次。
  const NOTE_STATES = ['proposed', 'implemented', 'rejected', 'archived']
  const NOTE_CATS = ['feature', 'bug-fix', 'simplification', 'architecture', 'process', 'testing']
  const memoryStore = (() => {
    let root = '', mods = null, inited = false
    const ensure = async () => {
      if (!mods) mods = { fs: await import('node:fs'), path: await import('node:path'), os: await import('node:os') }
      if (!root) {
        root = mods.path.join(mods.os.homedir(), '.dsh', 'termfleet', 'team-memory')
        for (const s of NOTE_STATES) for (const c of NOTE_CATS) mods.fs.mkdirSync(mods.path.join(root, s, c), { recursive: true })
      }
      if (!inited) { inited = true; migrateFlat(); seedOnce() }
      return root
    }
    const migrateFlat = () => {
      try {
        const files = mods.fs.readdirSync(root).filter((f) => f.endsWith('.md'))
        for (const f of files) {
          const txt = mods.fs.readFileSync(mods.path.join(root, f), 'utf8')
          mods.fs.writeFileSync(mods.path.join(root, 'implemented', 'process', f), txt)
          mods.fs.unlinkSync(mods.path.join(root, f))
        }
      } catch { /* 无旧文件 */ }
    }
    const seedOnce = () => {
      const marker = mods.path.join(root, '.seeded')
      if (mods.fs.existsSync(marker)) return
      const seeds = [
        { st: 'implemented', cat: 'architecture', title: '会话流取宿主内 listener，弃 api-gateway 兜底', body: '卡点：插件如何拿 dsh 会话流两眼一抹黑。\n解法：宿主内全局 listener 收全量会话事件（M0 实测 seq0-16 完整），写入走 agentLoop.create+followup。\n代价：0；收益：零网络零盘读，api-gateway 仅留作跨机备选。\n备选：走官方 dsh-api-gateway Remote RPC——功能完备但多一层网络与鉴权，进程内 seam 更近。' },
        { st: 'implemented', cat: 'process', title: '插件路由必须过同意/鉴权门', body: '卡点：M0 发现插件 webServer 直挂路由绕过宿主 launch token，等于裸奔后门。\n解法：全路由 Bearer 令牌校验（timingSafeEqual/fail-closed），PTY 动作另需同意通道（无通道 403/只读禁写 403）。\n代价：每次请求多一次校验；收益：信任类产品的底线。' },
        { st: 'rejected', cat: 'simplification', title: '继续打磨自研 Heimdall UI', body: '最强理由：代码全在自己手里，想怎么改怎么改。\n为何放弃：三轮 UIUX 收口仍与成熟产品有代差，投入产出被否决——改为 dsh 插件形态+视觉继承宿主。留档防走回头路。' },
        { st: 'proposed', cat: 'feature', title: '任务与会话自动关联（cwd/任务标记匹配）', body: '提案：会话投影按 cwd+CLI 匹配任务，卡片上的会话徽标自动长出来，无需手动指派。\n验收：匹配准确率抽样 ≥90% 再转 implemented。\n备选：手动绑定——确定但烦，先自动+可改。' },
        { st: 'implemented', cat: 'testing', title: '验收必须真测+留证，不接受演示数据冒充', body: '卡点：演示图被当成交付多次返工。\n解法：每功能真浏览器/真 API 打靶+截图/输出留档；中文身份头过 Windows 管道会脏字节（fetch 静默抛）——一律 encodeURIComponent。' },
        { st: 'implemented', cat: 'architecture', title: '远程对象=会话而非桌面（隐私边界）', body: '整桌面围观侵犯成员隐私，出列降级 backlog；连接边界只到会话流（dsh listener/PTY），同意卡管到会话粒度，成员批得明白。' },
      ]
      for (const s of seeds) {
        const date = '2026-09-19'
        const slug = s.title.slice(0, 20).replace(/[\\/:*?"<>|\s]+/g, '-')
        const front = ['title: ' + s.title, 'date: ' + date + 'T12:00:00.000Z', 'category: ' + s.cat, 'project: dsh-termfleet', 'by: 团队', 'tags: lesson,pit'].join('\n')
        const dir = mods.path.join(root, s.st, s.cat)
        mods.fs.mkdirSync(dir, { recursive: true })
        mods.fs.writeFileSync(mods.path.join(dir, date + '-' + slug + '.md'), '---\n' + front + '\n---\n\n' + s.body + '\n')
      }
      mods.fs.writeFileSync(marker, new Date().toISOString())
    }
    const parseNote = (rel, text) => {
      const parts = rel.split('/')
      const n = { id: rel.replace(/\.md$/, ''), state: parts[0], category: parts[1] || '' }
      const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
      if (m) {
        for (const line of m[1].split('\n')) { const kv = line.match(/^([a-z-]+):\s*(.*)$/); if (kv) n[kv[1]] = kv[2] }
        n.body = m[2].trim()
      } else n.body = text.trim()
      if (!n.title) n.title = n.id
      return n
    }
    const buildText = (f) => {
      const front = [
        'title: ' + String(f.title || '未命名').replace(/\n/g, ' '),
        'date: ' + (f.date || new Date().toISOString()),
        'category: ' + (NOTE_CATS.includes(f.category) ? f.category : 'process'),
        'project: ' + String(f.project || '通用'),
        'by: ' + String(f.by || 'me'),
        f.sourceTask ? 'source-task: ' + String(f.sourceTask) : '',
        'tags: lesson,pit',
      ].filter(Boolean).join('\n')
      return '---\n' + front + '\n---\n\n' + String(f.body || '') + '\n'
    }
    return {
      async list() {
        await ensure()
        const out = []
        const walk = (dir, rel) => {
          let ents = []; try { ents = mods.fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
          for (const e of ents) {
            if (e.isDirectory()) walk(mods.path.join(dir, e.name), rel + e.name + '/')
            else if (e.name.endsWith('.md')) {
              try { out.push(parseNote(rel + e.name, mods.fs.readFileSync(mods.path.join(dir, e.name), 'utf8'))) } catch { /* 读不了的跳过 */ }
            }
          }
        }
        walk(root, '')
        return out.filter((n) => NOTE_STATES.includes(n.state)).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      },
      async create(input, by, stateOverride) {
        await ensure()
        const st = NOTE_STATES.includes(stateOverride) ? stateOverride : (NOTE_STATES.includes(input.state) ? input.state : 'proposed')
        const cat = NOTE_CATS.includes(input.category) ? input.category : 'process'
        const date = new Date().toISOString().slice(0, 10)
        const slug = String(input.title || 'lesson').slice(0, 24).replace(/[\\/:*?"<>|\s]+/g, '-')
        const name = date + '-' + slug + '-' + Math.random().toString(36).slice(2, 6) + '.md'
        const full = buildText({ title: input.title, date: new Date().toISOString(), category: cat, project: input.project, by, sourceTask: input.sourceTask, body: input.body })
        const dir = mods.path.join(root, st, cat)
        mods.fs.mkdirSync(dir, { recursive: true })
        mods.fs.writeFileSync(mods.path.join(dir, name), full)
        return { id: st + '/' + cat + '/' + name.replace(/\.md$/, ''), ok: true, state: st, category: cat }
      },
      async transition(id, to, by) {
        await ensure()
        const from = id.split('/')[0]
        const legal = { proposed: ['implemented', 'rejected'], implemented: ['archived'], rejected: ['archived'], archived: [] }
        if (!NOTE_STATES.includes(to) || !(legal[from] || []).includes(to)) return { ok: false, error: '非法流转 ' + from + ' → ' + to }
        const src = mods.path.join(root, id + '.md')
        if (!mods.fs.existsSync(src)) return { ok: false, error: '笔记不存在' }
        const cat = id.split('/')[1]
        const dstDir = mods.path.join(root, to, cat)
        mods.fs.mkdirSync(dstDir, { recursive: true })
        mods.fs.renameSync(src, mods.path.join(dstDir, mods.path.basename(id) + '.md'))
        return { ok: true, id: to + '/' + cat + '/' + mods.path.basename(id) }
      },
      async verify() {
        const notes = await this.list()
        const errors = []
        for (const n of notes) {
          const e = []
          if (!n.title || n.title === n.id) e.push('缺 title')
          if (!n.body || n.body.length < 10) e.push('正文过短/为空')
          if (!NOTE_CATS.includes(n.category)) e.push('分类非法: ' + n.category)
          if (n.state === 'proposed' && !/备选/.test(n.body || '')) e.push('proposed 应含备选方案段（最强理由+为何放弃）')
          if (e.length) errors.push({ id: n.id, problems: e })
        }
        return { total: notes.length, failed: errors.length, errors }
      },
    }
  })()

  // ── 审计库（真事件：任务/记忆全操作落 ~/.dsh/termfleet/audit.json） ──
  const auditStore = (() => {
    let data = null, file = '', mods = null
    const ensure = async () => {
      if (!mods) mods = { fs: await import('node:fs'), path: await import('node:path'), os: await import('node:os') }
      if (!data) {
        file = mods.path.join(mods.os.homedir(), '.dsh', 'termfleet', 'audit.json')
        try { data = JSON.parse(mods.fs.readFileSync(file, 'utf8')) } catch { data = [] }
        if (!Array.isArray(data)) data = []
      }
      return data
    }
    return {
      async add(actor, action, detail) {
        const d = await ensure()
        d.push({ ts: Date.now(), actor: String(actor).slice(0, 40), action: String(action).slice(0, 60), detail: String(detail || '').slice(0, 200) })
        if (d.length > 500) d.splice(0, d.length - 500)
        mods.fs.writeFileSync(file, JSON.stringify(d, null, 1))
      },
      async list() { return (await ensure()).slice().reverse() },
    }
  })()

  // ── 同意总线 v0（M1 主干：握手卡状态机 + 限时通道 + 审计；落盘 consent.json 跨刷新） ──
  // 单机先真：成员侧=同页模拟 decide；跨机成员接 WS 后 decide 来自成员机，状态机不变。
  const consentStore = (() => {
    let list = null, file = '', mods = null
    const ensure = async () => {
      if (!mods) mods = { fs: await import('node:fs'), path: await import('node:path'), os: await import('node:os') }
      if (!list) {
        file = mods.path.join(mods.os.homedir(), '.dsh', 'termfleet', 'consent.json')
        try { list = JSON.parse(mods.fs.readFileSync(file, 'utf8')) } catch { list = [] }
        if (!Array.isArray(list)) list = []
      }
      prune(); return list
    }
    const save = () => { if (mods && list) mods.fs.writeFileSync(file, JSON.stringify(list.slice(0, 100), null, 1)) }
    const prune = () => {
      const now = Date.now()
      for (const c of list) if (c.status === 'active' && c.expireAt && c.expireAt <= now) c.status = 'expired'
    }
    return {
      async requestRemote(c) {
        const l = await ensure()
        const exist = l.find((x) => x.id === c.id)
        if (exist) { if (exist.status === 'pending') { exist.remote = true; save() } return exist }
        const n = { id: c.id, type: c.type, target: c.target, requester: c.requester, mode: null, status: 'pending', createdAt: Date.now(), expireAt: null, decidedBy: null, endedBy: null, remote: true }
        l.unshift(n); save(); return n
      },
      async request(type, target, requester) {
        const l = await ensure()
        const c = { id: 'C-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), type, target, requester, mode: null, status: 'pending', createdAt: Date.now(), expireAt: null, decidedBy: null, endedBy: null }
        l.unshift(c); save(); return c
      },
      async decide(id, decision, decider) {
        const l = await ensure()
        const c = l.find((x) => x.id === id)
        if (!c || c.status !== 'pending') return null
        if (decision === 'deny') c.status = 'denied'
        else { c.status = 'active'; c.mode = decision === 'allow' ? 'rw' : 'ro'; c.expireAt = Date.now() + 30 * 60 * 1000 }
        c.decidedBy = decider; save(); return c
      },
      async end(id, by) {
        const l = await ensure()
        const c = l.find((x) => x.id === id)
        if (!c) return null
        if (c.status === 'active') { c.status = 'ended'; c.endedBy = by; save() }
        return c
      },
      async activeOf(type) {
        const l = await ensure()
        return l.find((c) => c.type === type && c.status === 'active') || null
      },
      async get(id) { const l = await ensure(); return l.find((x) => x.id === id) || null },
      async all() { const l = await ensure(); return l.slice(0, 30) },
    }
  })()


  // ── 任务↔会话自动关联（cwd/项目名匹配 + 会话事件驱动） ──
  const sessionLink = (() => {
    // 项目名→仓库路径映射（首版：常见约定 D:/coding/<project>）
    // 同步版（路由 handler 内用 fsSync/pathSync——在 async handler 上下文里先 import 好缓存到模块级）
    let _mods = null
    const M = async () => { if (!_mods) _mods = { fs: await import('node:fs'), path: await import('node:path'), os: await import('node:os'), cp: await import('node:child_process') }; return _mods }
    const repoFor = async (project) => {
      if (!project || project === '默认') return null
      const m = await M()
      const candidates = ['D:/coding/' + project, 'D:/codingprojects/' + project]
      for (const c of candidates) { try { if (m.fs.existsSync(c + '/.git')) return c } catch {} }
      return null
    }
    const matchTask = async (project) => {
      if (!project) return []
      try {
        const m = await M()
        const f = m.path.join(m.os.homedir(), '.dsh', 'termfleet', 'tasks.json')
        const d = JSON.parse(m.fs.readFileSync(f, 'utf8'))
        return (d.tasks || []).filter((t) => (t.project || '默认') === project && t.status !== 'done')
      } catch { return [] }
    }
    return { repoFor, matchTask, M }
  })()

  // ── IM 出站桥 v1（M2 薄桥：审批卡通知走 webhook；人不在电脑前时的旁路入口） ──
  const imBridge = (() => {
    let cfg = null, mods = null, file = ''
    const load = async () => {
      if (!mods) mods = { fs: await import('node:fs'), path: await import('node:path'), os: await import('node:os') }
      if (!file) file = mods.path.join(mods.os.homedir(), '.dsh', 'termfleet', 'im.json')
      if (!cfg) { try { cfg = JSON.parse(mods.fs.readFileSync(file, 'utf8')) } catch { cfg = {} } }
      return cfg
    }
    const send = async (title, text) => {
      const c = await load()
      if (!c.enabled || !c.webhook) return { sent: false, reason: 'im-disabled' }
      const body = String(c.webhook).includes('feishu')
        ? { msg_type: 'text', content: { text: '[' + title + '] ' + text } }
        : { title, text, ts: Date.now() }
      try {
        const r = await fetch(c.webhook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
        return { sent: r.ok, status: r.status }
      } catch (e) { return { sent: false, error: String(e).slice(0, 120) } }
    }
    return { load, send, get cfg() { return cfg }, save: async (nc) => { await load(); Object.assign(cfg, nc || {}); mods.fs.writeFileSync(file, JSON.stringify(cfg, null, 2)) } }
  })()

  // ── 跨机总线 v1（M1 主体：成员出站 WS 连 lead；同意/PTY/事件中继） ──
  // 配对 ~/.dsh/termfleet/pairing.json：{role:'lead'|'member'|'off', name, leadUrl, token}
  // 协议(JSON 帧)：hello/presence/sess-event/pty-out/consent-decided ↑；consent-request/pty-open/pty-write/pty-kill ↓
  const busLink = (() => {
    let cfg = null, mods = null, file = '', wsMod = null
    let lead = { conns: new Map() }     // name → {ws,lastSeen,sessions[],events[],ptyOut[]}
    let member = { ws: null, timer: null, connected: false }
    const loadCfg = async () => {
      if (!mods) mods = { fs: await import('node:fs'), path: await import('node:path'), os: await import('node:os') }
      if (!file) file = mods.path.join(mods.os.homedir(), '.dsh', 'termfleet', 'pairing.json')
      try { cfg = JSON.parse(mods.fs.readFileSync(file, 'utf8')) } catch { cfg = { role: 'off' } }
      if (!cfg || !['lead', 'member', 'off'].includes(cfg.role)) cfg = { role: 'off' }
      // 环境变量覆盖（单机双实例测试用；真实跨机走 pairing.json）
      if (process.env.TERMFLEET_ROLE && ['lead', 'member', 'off'].includes(process.env.TERMFLEET_ROLE)) cfg.role = process.env.TERMFLEET_ROLE
      if (process.env.TERMFLEET_NAME) cfg.name = process.env.TERMFLEET_NAME
      if (process.env.TERMFLEET_LEAD_URL) cfg.leadUrl = process.env.TERMFLEET_LEAD_URL
      if (process.env.TERMFLEET_TOKEN) cfg.token = process.env.TERMFLEET_TOKEN
      return cfg
    }
    const saveCfg = () => { if (mods && cfg) mods.fs.writeFileSync(file, JSON.stringify(cfg, null, 2)) }
    const send = (ws, obj) => { try { ws.send(JSON.stringify(obj)) } catch { /* 断了就算了 */ } }
    // ── lead：升级路由处理器（noServer 握手） ──
    const leadUpgrade = async (req, socket, head) => {
      if (!wsMod) wsMod = await import('ws')
      const { WebSocketServer } = wsMod
      if (!lead.wss) {
        lead.wss = new WebSocketServer({ noServer: true })
        lead.wss.on('connection', (ws) => {
          let name = null
          ws.on('message', (raw) => {
            let m = null; try { m = JSON.parse(String(raw)) } catch { return }
            if (m.t === 'hello') {
              if (!m.token || m.token !== cfg.token) { send(ws, { t: 'bye', reason: 'bad-token' }); ws.close(); return }
              name = String(m.name || '成员').slice(0, 30)
              lead.conns.set(name, { ws, lastSeen: Date.now(), sessions: m.sessions || [], events: [], ptyOut: [] })
              ctx.logger.info('dsh-termfleet bus: 成员上线 ' + name)
              return
            }
            if (!name) return
            const c = lead.conns.get(name); if (!c) return
            c.lastSeen = Date.now()
            if (m.t === 'presence') { c.sessions = m.sessions || []; if (m.summary) c.summary = m.summary }
            else if (m.t === 'sess-event') { c.events.push(m.d); if (c.events.length > 60) c.events.shift() }
            else if (m.t === 'sos') { c.lastSos = m; auditStore.add(m.name || name, '呼叫 lead 协助', m.msg || '-') }
            else if (m.t === 'pty-out') { c.ptyOut.push(m.d); if (c.ptyOut.length > 200) c.ptyOut.shift() }
            else if (m.t === 'consent-decided') {
              // 成员答复回传：lead 侧同 id 生效
              consentStore.decide(m.id, m.decision, name + '@成员机').then((c2) => { if (c2) auditStore.add(name, '允许连接(' + (c2.mode || 'deny') + ')·成员机', m.id) })
            }
          })
          ws.on('close', () => { const c = lead.conns.get(name); if (c && c.ws === ws) lead.conns.delete(name) })
        })
      }
      lead.wss.handleUpgrade(req, socket, head, (ws) => lead.wss.emit('connection', ws))
    }
    const leadFleet = async () => {
      await loadCfg()
      const out = []
      for (const [name, c] of lead.conns) {
        out.push({ name, online: true, lastSeen: c.lastSeen, sessions: c.sessions, msgCount: c.msgCount || 0, lastSos: c.lastSos || null, summary: c.summary || null,
          recentEvents: c.events.slice(-8), ptyTail: c.ptyOut.slice(-30).map((x) => x.d).join('').slice(-600) })
      }
      return out
    }
    const toMember = (name, obj) => { const c = lead.conns.get(name); if (c && c.ws) { send(c.ws, obj); return true } return false }
    // ── member：出站连接循环 ──
    const memberLoop = async () => {
      await loadCfg()
      if (cfg.role !== 'member' || member.timer) return
      const scheduleReconnect = () => {
        if (!member.timer) member.timer = setTimeout(() => { member.timer = null; connect() }, 5000)
      }
      const connect = async () => {
        if (member.timer) { clearTimeout(member.timer); member.timer = null }
        if (!wsMod) wsMod = await import('ws')
        try {
          const ws = new wsMod.WebSocket(cfg.leadUrl)
          member.ws = ws
          let settled = false
          ws.on('open', () => {
            settled = true; member.connected = true
            send(ws, { t: 'hello', name: cfg.name, token: cfg.token, sessions: [{ id: 'pwsh', tag: 'cli', label: 'pwsh 会话' }] })
            ctx.logger.info('dsh-termfleet bus: 已连上 lead ' + cfg.leadUrl)
          })
          ws.on('message', async (raw) => {
            let m = null; try { m = JSON.parse(String(raw)) } catch { return }
            if (m.t === 'consent-request') {
              // lead 下发的请求 → 本机建 pending（同 id）；本机页面轮询即可见+可答复
              consentStore.requestRemote(m.consent).then(() => {
                auditStore.add(m.consent.requester, '请求连接（来自 lead）', m.consent.target || '')
                imBridge.send('TermFleet 审批卡', m.consent.requester + ' 请求连接你的会话（' + (m.consent.target || '') + '，30 分钟限时）。id=' + m.consent.id + '。答复：回复\"允许/只读/拒绝\"（经 IM 桥回调），或打开成员页 ' + (imBridge.cfg && imBridge.cfg.pageUrl ? imBridge.cfg.pageUrl : 'http://127.0.0.1:3181/dsh-termfleet/app'))
              })
            } else if (m.t === 'pty-open' || m.t === 'pty-write' || m.t === 'pty-kill') {
              // 双端验证：成员机只在本机存在 active 远端 rw 通道时执行
              const ch = await consentStore.activeOf('pty')
              if (!ch || !ch.remote || ch.mode !== 'rw') { auditStore.add('bus', '拒执行远端指令（无本机通道）', m.t); return }
              if (m.t === 'pty-open') { ensurePty() }
              else if (m.t === 'pty-write') { ptyWrite(String(m.data || ''), undefined) }
              else if (m.t === 'pty-kill') { try { ptyProc?.kill() } catch { /* 已退 */ } }
            }
          })
          ws.on('close', () => { if (member.ws === ws) { member.connected = false; member.ws = null } scheduleReconnect() })
          ws.on('error', () => { try { ws.close() } catch { /* 忽略 */ } })
          // 连接超时兜底（服务器不可达时 error 不一定触发）
          setTimeout(() => { if (!settled) { try { ws.close() } catch { /* 忽略 */ } } }, 4000)
        } catch { scheduleReconnect() }
      }
      connect()
      // 周期 presence：一行进度摘要（在干/等/空闲/卡住）——成员机最清楚自己的会话
      const summarize = () => {
        const evs = state.sessionEvents
        const last = evs[evs.length - 1]
        const since = last ? Date.now() - last.t : null
        let stt = '空闲', line = '无会话活动'
        if (last) {
          if (since != null && since > 10 * 60 * 1000) { stt = '疑似卡住'; line = (last.type || '') + ' 后 ' + Math.round(since / 60000) + ' 分钟无输出' }
          else if (/permission|question|approval|input/i.test(last.type || '')) { stt = '等待输入'; line = (last.brief || last.type || '').slice(0, 40) }
          else { stt = '干活中'; line = ((last.type || '') + ' ' + (last.brief || '')).slice(0, 50) }
        }
        return { state: stt, line, at: last ? last.t : 0, events: evs.length }
      }
      setInterval(() => { if (member.connected && member.ws) send(member.ws, { t: 'presence', sessions: [{ id: 'pwsh', tag: 'cli', label: 'pwsh 会话' }], summary: summarize() }) }, 30000)
      bus.sess.push(() => { if (member.connected && member.ws) send(member.ws, { t: 'presence', summary: summarize() }) })
      // 本机会话事件与 PTY 输出上报（宿主内已有钩子，挂转发）
      bus.sess.push((e) => { if (member.connected && member.ws) send(member.ws, { t: 'sess-event', d: e }) })
      bus.pty.push((d) => { if (member.connected && member.ws) send(member.ws, { t: 'pty-out', d }) })
    }
    return {
      loadCfg, saveCfg,
      get role() { return cfg ? cfg.role : '?' },
      get cfg() { return cfg },
      leadUpgrade, leadFleet, toMember,
      memberStart: memberLoop,
      memberConnected: () => member.connected,
      memberSend: (obj) => { if (member.ws && member.connected) send(member.ws, obj) },
    }
  })()


ctx.inject(['webServer'], (host) => {
    host.effect(() => {
      const json = (res, code, obj) => {
        res.writeHead(code, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        })
        res.end(JSON.stringify(obj))
      }
      const readBody = (req, limit = 65536) =>
        new Promise((resolve, reject) => {
          let n = 0
          const chunks = []
          req.on('data', (c) => {
            n += c.length
            if (n > limit) { reject(new Error('body too large')); req.destroy(); return }
            chunks.push(c)
          })
          req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
          req.on('error', reject)
        })

      const disposers = [
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/ping',
          handler: (req, res) => {
            if (guard(req, res)) return
            if (req.method !== 'GET') { res.writeHead(405, { allow: 'GET' }); res.end(); return }
            json(res, 200, { ok: true, ts: Date.now(), uptimeMs: Date.now() - bootAt, plugin: name })
          },
        }),
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/probe-session',
          handler: async (req, res) => {
            if (guard(req, res)) return
            if (req.method !== 'GET') { res.writeHead(405, { allow: 'GET' }); res.end(); return }
            let snapshotCount = null
            let snapshotTypes = null
            try {
              const s = svc?.sessions?.get(PROBE_SESSION_ID)
              if (s) {
                const evts = s.snapshotEvents()
                snapshotCount = evts.length
                snapshotTypes = evts.map((e) => e.type)
              }
            } catch { /* 会话尚未创建 */ }
            json(res, 200, {
              ok: true,
              ts: Date.now(),
              probeSessionId: PROBE_SESSION_ID,
              services: state.services,
              llm: state.llm,
              sessionCreated: state.sessionCreated,
              sessionEventCount: state.sessionEvents.length,
              sessionEvents: state.sessionEvents.slice(-60),
              streamFrames: state.streamFrames,
              lastStreamFrameAt: state.lastStreamFrameAt,
              agentEvents: state.agentEvents.slice(-30),
              writes: state.writes,
              probeSessionSnapshot: { count: snapshotCount, types: snapshotTypes },
            })
          },
        }),
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/probe-session/write',
          handler: async (req, res) => {
            if (guard(req, res)) return
            if (req.method !== 'POST') { res.writeHead(405, { allow: 'POST' }); res.end(); return }
            try {
              const body = JSON.parse((await readBody(req)) || '{}')
              const text = typeof body.text === 'string' && body.text.trim()
                ? body.text
                : `M0_STREAM_WRITE_OK ts=${Date.now()}`
              const rec = await sessionWrite(text)
              json(res, rec.ok ? 200 : 500, rec)
            } catch (e) {
              json(res, 400, { ok: false, error: String(e).slice(0, 300) })
            }
          },
        }),
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/probe-pty',
          handler: async (req, res) => {
            if (guard(req, res)) return
            const ch = await consentStore.activeOf('pty')
            if (!ch) { json(res, 403, { error: 'no-consent', hint: '先经同意卡建立通道（/consent/request → decide）' }); return }
            if (req.method !== 'GET') { res.writeHead(405, { allow: 'GET' }); res.end(); return }
            const st = await ensurePty()
            // 给 shell banner 一点时间
            await waitFor(() => st.firstDataAt != null, 3000)
            json(res, st.ok ? 200 : 500, {
              ok: st.ok,
              ts: Date.now(),
              pty: st,
              tail: tailText(500),
            })
          },
        }),
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/probe-pty/write',
          handler: async (req, res) => {
            if (guard(req, res)) return
            const ch = await consentStore.activeOf('pty')
            if (!ch) { json(res, 403, { error: 'no-consent' }); return }
            if (ch.mode !== 'rw') { json(res, 403, { error: 'readonly-channel' }); return }
            if (req.method !== 'POST') { res.writeHead(405, { allow: 'POST' }); res.end(); return }
            try {
              const body = JSON.parse((await readBody(req)) || '{}')
              const data = typeof body.data === 'string' && body.data.length ? body.data : 'echo M0_PTY_OK\r'
              const echo = String(body.data || '').match(/echo\s+(\S+)/)
              const rec = await ptyWrite(data, body.expect || (echo ? echo[1] : undefined))
              json(res, rec.ok ? 200 : 500, rec)
            } catch (e) {
              json(res, 400, { ok: false, error: String(e).slice(0, 300) })
            }
          },
        }),
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/probe-pty/kill',
          handler: async (req, res) => {
            if (guard(req, res)) return
            if (req.method !== 'POST') { res.writeHead(405, { allow: 'POST' }); res.end(); return }
            try {
              if (ptyProc) ptyProc.kill()
              json(res, 200, { ok: true, killedPid: state.pty?.pid ?? null })
            } catch (e) {
              json(res, 500, { ok: false, error: String(e).slice(0, 300) })
            }
          },
        }),
      ]
      // ── 任务面板路由（M1 真实现；身份 v1=X-TF-User 头，接总线后换成员身份） ──
      const who = (req) => (()=>{try{return decodeURIComponent(String(req.headers?.['x-tf-user'] ?? 'me'))}catch{return String(req.headers?.['x-tf-user'] ?? 'me')}})().slice(0, 40)
      disposers.push(
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/app',
          handler: async (req, res) => {
            if (guard(req, res)) return
            try {
              const fsx = await import('node:fs')
              const here = new URL('.', import.meta.url) // lib/
              const html = fsx.readFileSync(new URL('app.html', here), 'utf8')
              res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
              res.end(html)
            } catch (e) {
              res.writeHead(500, { 'content-type': 'application/json' })
              res.end(JSON.stringify({ error: String(e).slice(0, 300) }))
            }
          },
        }),
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/tasks',
          handler: async (req, res) => {
            if (guard(req, res)) return
            if (req.method !== 'GET') { res.writeHead(405, { allow: 'GET' }); res.end(); return }
            json(res, 200, { ok: true, tasks: await taskStore.list() })
          },
        }),
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/tasks/create',
          handler: async (req, res) => {
            if (guard(req, res)) return
            if (req.method !== 'POST') { res.writeHead(405, { allow: 'POST' }); res.end(); return }
            try {
              const body = JSON.parse((await readBody(req)) || '{}')
              const t = await taskStore.create(body, who(req))
              json(res, 200, { ok: true, task: t })
            } catch (e) { json(res, 400, { ok: false, error: String(e).slice(0, 300) }) }
          },
        }),
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/tasks/action',
          handler: async (req, res) => {
            if (guard(req, res)) return
            if (req.method !== 'POST') { res.writeHead(405, { allow: 'POST' }); res.end(); return }
            try {
              const body = JSON.parse((await readBody(req)) || '{}')
              const t = await taskStore.act(String(body.op ?? ''), String(body.id ?? ''), body.patch ?? {}, who(req))
              if (!t) { json(res, 404, { ok: false, error: 'task not found' }); return }
              json(res, 200, { ok: true, task: t, tasks: await taskStore.list() })
            } catch (e) { json(res, 400, { ok: false, error: String(e).slice(0, 300) }) }
          },
        }),
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/memory',
          handler: async (req, res) => {
            if (guard(req, res)) return
            if (req.method !== 'GET') { res.writeHead(405, { allow: 'GET' }); res.end(); return }
            json(res, 200, { ok: true, lessons: await memoryStore.list() })
          },
        }),
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/memory/create',
          handler: async (req, res) => {
            if (guard(req, res)) return
            if (req.method !== 'POST') { res.writeHead(405, { allow: 'POST' }); res.end(); return }
            try {
              const body = JSON.parse((await readBody(req)) || '{}')
              const r = await memoryStore.create(body, who(req))
              auditStore.add(who(req), '新增避坑[' + r.state + '/' + r.category + ']', String(body.title || ''))
              json(res, 200, r)
            } catch (e) { json(res, 400, { ok: false, error: String(e).slice(0, 300) }) }
          },
        }),
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/memory/transition',
          handler: async (req, res) => {
            if (guard(req, res)) return
            if (req.method !== 'POST') { res.writeHead(405, { allow: 'POST' }); res.end(); return }
            try {
              const body = JSON.parse((await readBody(req)) || '{}')
              const r = await memoryStore.transition(String(body.id || ''), String(body.to || ''), who(req))
              if (r.ok) { auditStore.add(who(req), '笔记流转→' + body.to, body.id || ''); json(res, 200, r) }
              else json(res, 409, r)
            } catch (e) { json(res, 400, { ok: false, error: String(e).slice(0, 300) }) }
          },
        }),
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/memory/verify',
          handler: async (req, res) => {
            if (guard(req, res)) return
            if (req.method !== 'GET') { res.writeHead(405, { allow: 'GET' }); res.end(); return }
            json(res, 200, await memoryStore.verify())
          },
        }),
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/audit',
          handler: async (req, res) => {
            if (guard(req, res)) return
            if (req.method !== 'GET') { res.writeHead(405, { allow: 'GET' }); res.end(); return }
            json(res, 200, { ok: true, events: await auditStore.list() })
          },
        }),
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/fleet',
          handler: async (req, res) => {
            if (guard(req, res)) return
            if (req.method !== 'GET') { res.writeHead(405, { allow: 'GET' }); res.end(); return }
            json(res, 200, { ok: true, members: await busLink.leadFleet() })
          },
        }),
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/pairing',
          handler: async (req, res) => {
            if (guard(req, res)) return
            await busLink.loadCfg()
            if (req.method === 'GET') { json(res, 200, { ok: true, pairing: busLink.cfg }); return }
            if (req.method !== 'POST') { res.writeHead(405, { allow: 'POST' }); res.end(); return }
            try {
              const body = JSON.parse((await readBody(req)) || '{}')
              const cfg = busLink.cfg
              if (['lead', 'member', 'off'].includes(body.role)) cfg.role = body.role
              if (typeof body.name === 'string') cfg.name = body.name.slice(0, 30)
              if (typeof body.leadUrl === 'string') cfg.leadUrl = body.leadUrl.slice(0, 200)
              if (typeof body.token === 'string' && body.token.length >= 6) cfg.token = body.token.slice(0, 64)
              busLink.saveCfg()
              auditStore.add(who(req), '配对设置', cfg.role + (cfg.name ? ' ' + cfg.name : ''))
              json(res, 200, { ok: true, pairing: cfg })
            } catch (e) { json(res, 400, { ok: false, error: String(e).slice(0, 300) }) }
          },
        }),
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/remote/write',
          handler: async (req, res) => {
            if (guard(req, res)) return
            if (req.method !== 'POST') { res.writeHead(405, { allow: 'POST' }); res.end(); return }
            try {
              const body = JSON.parse((await readBody(req)) || '{}')
              const mn = String(body.member || '')
              const ch = await consentStore.activeOf('pty')
              if (!ch) { json(res, 403, { ok: false, error: 'no-consent' }); return }
              if (ch.mode !== 'rw') { json(res, 403, { ok: false, error: 'readonly-channel' }); return }
              if (ch.target !== 'member:' + mn) { json(res, 403, { ok: false, error: 'target-mismatch' }); return }
              const ok = busLink.toMember(mn, { t: 'pty-write', data: String(body.data || '') })
              if (ok) auditStore.add(who(req), '远端写入', body.member + ' · ' + String(body.data || '').slice(0, 40))
              json(res, ok ? 200 : 404, { ok, error: ok ? null : 'member offline' })
            } catch (e) { json(res, 400, { ok: false, error: String(e).slice(0, 300) }) }
          },
        }),
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/im',
          handler: async (req, res) => {
            if (guard(req, res)) return
            await imBridge.load()
            if (req.method === 'GET') { json(res, 200, { ok: true, im: imBridge.cfg || {} }); return }
            if (req.method !== 'POST') { res.writeHead(405, { allow: 'GET,POST' }); res.end(); return }
            try {
              const body = JSON.parse((await readBody(req)) || '{}')
              if (typeof body.webhook === 'string') imBridge.cfg.webhook = body.webhook.slice(0, 300)
              if (typeof body.enabled === 'boolean') imBridge.cfg.enabled = body.enabled
              await imBridge.save({})
              if (body.test) { const r = await imBridge.send('TermFleet 测试', 'IM 出站通道连通性测试 ' + new Date().toLocaleTimeString()); json(res, 200, { ok: true, im: imBridge.cfg, test: r }); return }
              json(res, 200, { ok: true, im: imBridge.cfg })
            } catch (e) { json(res, 400, { ok: false, error: String(e).slice(0, 300) }) }
          },
        }),
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/im/callback',
          handler: async (req, res) => {
            // 鉴权：?t= 团队令牌（pairing.token）；IM 桥是外部进程，不走插件 gate
            const u = new URL(req.url, 'http://localhost')
            await busLink.loadCfg()
            const t = u.searchParams.get('t') || ''
            const expect = busLink.cfg.token || ''
            if (!expect || t !== expect) { res.writeHead(401, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'bad-team-token' })); return }
            if (req.method !== 'POST') { res.writeHead(405, { allow: 'POST' }); res.end(); return }
            try {
              const body = JSON.parse((await readBody(req)) || '{}')
              const text = String(body.text || body.msg || '').trim()
              if (!text) { json(res, 400, { ok: false, error: 'empty text' }); return }
              // 解析：决定词 + 可选 consent id（无 id 则作用于最新 remote pending）
              const decide = /允许|同意|allow/i.test(text) ? 'allow' : /只读|readonly|ro/i.test(text) ? 'readonly' : /拒绝|deny/i.test(text) ? 'deny' : ''
              if (!decide) { json(res, 200, { ok: true, understood: false, hint: '未识别决定词（允许/只读/拒绝）' }); return }
              const idm = text.match(/C-[a-z0-9]+/i)
              const list = await consentStore.all()
              const target = (idm && list.find((c) => c.id === idm[0] && c.status === 'pending')) || list.find((c) => c.remote && c.status === 'pending')
              if (!target) { json(res, 200, { ok: true, understood: true, acted: false, hint: '无待答复的连接请求' }); return }
              const c = await consentStore.decide(target.id, decide, body.from ? String(body.from).slice(0, 30) + '@IM' : 'IM 答复')
              if (c && c.remote) busLink.memberSend({ t: 'consent-decided', id: c.id, decision: decide })
              auditStore.add('IM', 'IM 答复：' + decide, target.id)
              json(res, 200, { ok: true, understood: true, acted: true, consent: target.id, decision: decide, mode: c && c.mode })
            } catch (e) { json(res, 400, { ok: false, error: String(e).slice(0, 300) }) }
          },
        }),
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/sos',
          handler: async (req, res) => {
            if (guard(req, res)) return
            if (req.method !== 'POST') { res.writeHead(405, { allow: 'POST' }); res.end(); return }
            try {
              await busLink.loadCfg()
              const msg = String(JSON.parse((await readBody(req)) || '{}').msg || '').slice(0, 120)
              busLink.memberSend({ t: 'sos', name: busLink.cfg.name || '成员', msg: msg || '请求协助', ts: Date.now() })
              auditStore.add(who(req), '呼叫 lead 协助', msg || '-')
              imBridge.send('SOS', (busLink.cfg.name || '成员') + ' 呼叫 lead 协助：' + (msg || '-'))
              json(res, 200, { ok: true })
            } catch (e) { json(res, 400, { ok: false, error: String(e).slice(0, 300) }) }
          },
        }),

        // ── M3：任务↔会话关联 / diff / 回放 / 成本 ──
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/session-links',
          handler: async (req, res) => {
            if (guard(req, res)) return
            if (req.method !== 'GET') { res.writeHead(405, { allow: 'GET' }); res.end(); return }
            // 返回当前活跃会话与任务的匹配结果
            const sessions = state.sessionEvents.slice(-5).map((e) => e.sessionId).filter((v, i, a) => a.indexOf(v) === i)
            const links = []
            for (const sid of sessions) {
              const evts = state.sessionEvents.filter((e) => e.sessionId === sid)
              const last = evts[evts.length - 1]
              if (!last) continue
              // 用会话 brief 中出现的项目名匹配
              const text = evts.map((e) => e.brief || '').join(' ').toLowerCase()
              const tasks = await taskStore.list()
              for (const t of tasks) {
                const proj = (t.project || '默认').toLowerCase()
                if (proj !== '默认' && text.includes(proj)) {
                  links.push({ sessionId: sid, taskId: t.id, taskTitle: t.title, project: t.project, lastEvent: last.type, eventCount: evts.length, lastAt: last.t })
                }
              }
            }
            json(res, 200, { ok: true, links, activeSessions: sessions.length })
          },
        }),
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/diff',
          handler: async (req, res) => {
            if (guard(req, res)) return
            if (req.method !== 'GET') { res.writeHead(405, { allow: 'GET' }); res.end(); return }
            const u = new URL(req.url, 'http://localhost')
            const project = u.searchParams.get('project') || ''
            const repo = await sessionLink.repoFor(project)
            if (!repo) { json(res, 200, { ok: true, diff: '(项目 ' + project + ' 未找到本地仓库)', repo: null }); return }
            try {
              const { execSync } = await import('node:child_process')
              const stat = execSync('git diff --stat', { cwd: repo, encoding: 'utf8', timeout: 5000 }).trim()
              const diff = execSync('git diff', { cwd: repo, encoding: 'utf8', timeout: 10000 }).slice(0, 20000)
              const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: repo, encoding: 'utf8' }).trim()
              json(res, 200, { ok: true, stat, diff, branch, repo })
            } catch (e) {
              json(res, 200, { ok: true, diff: '(git diff 失败: ' + String(e).slice(0, 120) + ')', stat: '', branch: '', repo })
            }
          },
        }),
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/replay',
          handler: async (req, res) => {
            if (guard(req, res)) return
            if (req.method !== 'GET') { res.writeHead(405, { allow: 'GET' }); res.end(); return }
            json(res, 200, {
              ok: true,
              ptyHistory: bus.history.pty.slice(-200).map((x) => x.d).join(''),
              sessHistory: bus.history.sess.slice(-100),
              auditTrail: await auditStore.list(),
            })
          },
        }),
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/cost',
          handler: async (req, res) => {
            if (guard(req, res)) return
            if (req.method !== 'GET') { res.writeHead(405, { allow: 'GET' }); res.end(); return }
            // 从审计事件聚合：按人统计操作数+时长估算
            const events = await auditStore.list()
            const byActor = {}
            for (const e of events) {
              const a = e.actor || 'unknown'
              if (!byActor[a]) byActor[a] = { operations: 0, channels: 0, tasks: 0, first: e.ts, last: e.ts }
              byActor[a].operations++
              byActor[a].last = e.ts
              if ((e.action || '').includes('连接') || (e.action || '').includes('通道')) byActor[a].channels++
              if ((e.action || '').includes('任务')) byActor[a].tasks++
            }
            for (const a of Object.keys(byActor)) {
              byActor[a].durationMin = Math.round((byActor[a].last - byActor[a].first) / 60000)
            }
            // 从任务列表统计
            const tasks = await taskStore.list()
            const taskStats = {
              total: tasks.length,
              todo: tasks.filter((t) => t.status === 'todo').length,
              doing: tasks.filter((t) => t.status === 'doing').length,
              review: tasks.filter((t) => t.status === 'review').length,
              done: tasks.filter((t) => t.status === 'done').length,
              blocked: tasks.filter((t) => t.status === 'blocked').length,
            }
            json(res, 200, { ok: true, byActor, taskStats, sessionCount: state.sessionEvents.length, ptyBytes: state.pty ? state.pty.bytes : 0 })
          },
        }),
        // ── 同意总线 v0 路由 ──
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/consent/request',
          handler: async (req, res) => {
            if (guard(req, res)) return
            try {
              const body = JSON.parse((await readBody(req)) || '{}')
              const target = String(body.target || '')
              const c = await consentStore.request(String(body.type || 'pty'), target, who(req))
              auditStore.add(who(req), '请求连接', c.type + ' → ' + c.target)
              if (target.startsWith('member:')) busLink.toMember(target.slice(7), { t: 'consent-request', consent: c })
              json(res, 200, { ok: true, consent: c })
            } catch (e) { json(res, 400, { ok: false, error: String(e).slice(0, 300) }) }
          },
        }),
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/consent/decide',
          handler: async (req, res) => {
            if (guard(req, res)) return
            try {
              const body = JSON.parse((await readBody(req)) || '{}')
              const c = await consentStore.decide(String(body.id || ''), String(body.decision || ''), who(req))
              if (!c) { json(res, 409, { ok: false, error: 'consent not pending' }); return }
              auditStore.add(who(req), body.decision === 'deny' ? '拒绝连接' : '允许连接(' + c.mode + ')', c.id + ' ' + c.type + ' → ' + c.target)
              // 成员侧答复远端(lead)请求：回传总线
              if (c.remote) busLink.memberSend({ t: 'consent-decided', id: c.id, decision: body.decision || (c.mode === 'rw' ? 'allow' : c.mode === 'ro' ? 'readonly' : 'deny') })
              json(res, 200, { ok: true, consent: c })
            } catch (e) { json(res, 400, { ok: false, error: String(e).slice(0, 300) }) }
          },
        }),
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/consent/end',
          handler: async (req, res) => {
            if (guard(req, res)) return
            try {
              const body = JSON.parse((await readBody(req)) || '{}')
              const c = await consentStore.end(String(body.id || ''), who(req))
              auditStore.add(who(req), '断开通道', String(body.id || ''))
              json(res, 200, { ok: true, consent: c })
            } catch (e) { json(res, 400, { ok: false, error: String(e).slice(0, 300) }) }
          },
        }),
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/consent/list',
          handler: async (req, res) => {
            if (guard(req, res)) return
            json(res, 200, { ok: true, consents: await consentStore.all() })
          },
        }),
        // ── SSE 实时流：?k=pty | events（持有响应，宿主 webServer 文档明示支持） ──
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/stream',
          handler: async (req, res) => {
            if (guard(req, res)) return
            const u = new URL(req.url, 'http://localhost')
            const k = u.searchParams.get('k') === 'events' ? 'sess' : 'pty'
            res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', connection: 'keep-alive' })
            res.write('retry: 2000\n\n')
            let off = null
            const send = (ev, d) => { try { res.write('event: ' + ev + '\ndata: ' + JSON.stringify(d) + '\n\n') } catch {} }
            send('hello', { k, ts: Date.now() })
            off = (d) => send(k === 'pty' ? 'pty' : 'sess', d)
            bus[k].push(off)
            req.on('close', () => {
              const i = bus[k].indexOf(off); if (i >= 0) bus[k].splice(i, 1)
              try { res.end() } catch {}
            })
          },
        }),

      )
      ctx.logger.info('dsh-termfleet: 18 routes registered on webServer (probe/tasks/memory/audit/consent+SSE)')
      // lead 角色注册 WS 升级路由；member 角色启动出站连接（跨机总线）
      ;(async () => {
        await busLink.loadCfg()
        if (busLink.role === 'lead') {
          try { disposers.push(host.webServer.registerUpgrade({ path: '/dsh-termfleet/bus', handler: busLink.leadUpgrade })) } catch (e) { ctx.logger.warn('dsh-termfleet bus: upgrade 注册失败 ' + e) }
        } else if (busLink.role === 'member') {
          busLink.memberStart()
        }
      })()
      return () => {
        try { ptyProc?.kill() } catch { /* 已退出 */ }
        disposers.forEach((d) => d())
      }
    }, 'dsh-termfleet: http routes')
  })
}
