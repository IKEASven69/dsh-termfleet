/**
 * dsh-termfleet host 半（TS 镜像源）。
 * ⚠ 本文件=lib/index.js 的逐字镜像 + TS 头：运行装载的是 lib/index.js（宿主 file://），
 *   改动请改 lib 后运行 node scripts/rebuild-src.cjs 再生本文件，勿手编（历史手拼多次损坏）。
 * 能力：鉴权门 / 任务库 / 决策笔记库(wnlds 治理) / 审计 / 同意总线(握手卡+限时+SSE) / PTY 门控。
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
  const bus = { pty: [], sess: [] }
  const emitPty = (d) => { for (const f of bus.pty) { try { f(d) } catch {} } }
  const emitSess = (e) => { for (const f of bus.sess) { try { f(e) } catch {} } }

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
        // ── 同意总线 v0 路由 ──
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/consent/request',
          handler: async (req, res) => {
            if (guard(req, res)) return
            try {
              const body = JSON.parse((await readBody(req)) || '{}')
              const c = await consentStore.request(String(body.type || 'pty'), String(body.target || ''), who(req))
              auditStore.add(who(req), '请求连接', c.type + ' → ' + c.target)
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
      return () => {
        try { ptyProc?.kill() } catch { /* 已退出 */ }
        disposers.forEach((d) => d())
      }
    }, 'dsh-termfleet: http routes')
  })
}
