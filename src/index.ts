/**
 * dsh-termfleet host 半：团队驾驶舱插件（M0 探针版）。
 * 两命门实测路由（宿主 webServer 上，未鉴权——仅本机回环探针用）：
 *   命门① dsh 会话流：ctx.on('session/event') 全局 listener 实时读 +
 *            agentLoop.create(假 provider) + agent.followup(UserMessage) 写入；
 *   命门② PTY：@lydell/node-pty spawn pwsh，onData 回显 + pty.write 注入。
 * 路由形态照抄 dsh-hippo 已验证的 host 半：  // ── 避坑库（D9 团队记忆提前：~/.dsh/termfleet/team-memory/*.md，即团队仓工作副本） ──
  // 文件即记录（git 可同步）；hippo federation 指向本目录即成共享层（M0 已验机制）。
  const memoryStore = (() => {
    let dir = ''
    const ensure = async () => {
      if (dir) return dir
      const p = await import('node:path'), os = await import('node:os'), fsx = await import('node:fs')
      dir = p.join(os.homedir(), '.dsh', 'termfleet', 'team-memory')
      fsx.mkdirSync(dir, { recursive: true })
      return dir
    }
    const parse = (name, text) => {
      const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
      const meta = { id: name.replace(/\.md$/, '') }
      if (m) {
        for (const line of m[1].split('\n')) {
          const kv = line.match(/^([a-z-]+):\s*(.*)$/)
          if (kv) meta[kv[1]] = kv[2]
        }
        meta.body = m[2].trim()
      } else meta.body = text.trim()
      return meta
    }
    return {
      async list() {
        const d = await ensure(), fsx = await import('node:fs')
        return fsx.readdirSync(d).filter((f) => f.endsWith('.md'))
          .map((f) => parse(f, fsx.readFileSync(d + '/' + f, 'utf8')))
          .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      },
      async create(input, by) {
        const d = await ensure()
        const date = new Date().toISOString().slice(0, 10)
        const slug = String(input.title || 'lesson').slice(0, 24).replace(/[\\/:*?"<>|\s]+/g, '-')
        const id = date + '-' + slug + '-' + Math.random().toString(36).slice(2, 6)
        const front = ['title: ' + String(input.title || '未命名').replace(/\n/g, ' '),
          'project: ' + String(input.project || '通用'), 'date: ' + new Date().toISOString(),
          'by: ' + by, input.sourceTask ? 'source-task: ' + String(input.sourceTask) : '',
          'tags: lesson,pit'].filter(Boolean).join('\n')
        const fsx = await import('node:fs')
        fsx.writeFileSync(d + '/' + id + '.md', '---\n' + front + '\n---\n\n' + String(input.body || '') + '\n')
        return { id, ok: true }
      },
    }
  })()

ctx.inject(['webServer']) 内
 * host.webServer.register —— 注册期零依赖、不碰用户活数据。
 * 构建产物 lib/index.js（骨架阶段手写同步，无构建管线）。
 * @module dsh-termfleet
 */

import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the Context.webServer merge（宿主由 web bundle 提供，不打进产物）。
import type {} from '@deepseek-ai/dsh-host-webserver'

/** 预留：M1 起总线（配对/握手卡/审计）的配置入口。 */
export interface Config {}

export const name = 'dsh-termfleet'

/** M0 探针会话 id（每次装载唯一，前缀固定——清理 ~/.dsh/sessions 残留时按前缀识别）。 */
const PROBE_SESSION_ID = `termfleet-m0-probe-${Date.now().toString(36)}`

const waitFor = (pred: () => any, timeoutMs: number, stepMs = 20): Promise<any> =>
  new Promise((resolve) => {
    const t0 = Date.now()
    const timer = setInterval(() => {
      let v: any
      try { v = pred() } catch { v = undefined }
      if (v) { clearInterval(timer); resolve(v) }
      else if (Date.now() - t0 > timeoutMs) { clearInterval(timer); resolve(null) }
    }, stepMs)
  })

export function apply(ctx: Context, _config?: Config): void {
  const bootAt = Date.now()
  ctx.logger.info('dsh-termfleet: M0 探针插件已加载（命门① session 流 + 命门② PTY）')

  // ── 鉴权门（M1：M0 发现插件路由绕过宿主 launch token，全部路由必须过门）──
  // 令牌持久化 ~/.dsh/termfleet/token.json（跨重启稳定）；装载失败 fail-closed（持续 401）。
  let gateToken: string | null = null
  let safeEqual: ((a: string, b: string) => boolean) | null = null
  ;(async () => {
    try {
      const [{ randomBytes, timingSafeEqual }, fs, path, os] = await Promise.all([
        import('node:crypto'), import('node:fs'), import('node:path'), import('node:os'),
      ])
      const dir = path.join(os.homedir(), '.dsh', 'termfleet')
      const file = path.join(dir, 'token.json')
      let t: string | null = null
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
    } catch (e: any) {
      ctx.logger.error(`dsh-termfleet: 令牌装载失败，全部路由将持续 401（fail-closed）：${String(e).slice(0, 200)}`)
    }
  })()

  /** Bearer 头或 ?token= 查询参数；令牌未就绪一律拒绝。 */
  const isAuthorized = (req: any, url: URL): boolean => {
    if (!gateToken || !safeEqual) return false
    const h = String(req.headers?.authorization ?? '')
    const bearer = h.startsWith('Bearer ') ? h.slice(7) : ''
    const q = url.searchParams.get('token') ?? ''
    return (bearer.length > 0 && safeEqual(bearer, gateToken)) || (q.length > 0 && safeEqual(q, gateToken))
  }
  const guard = (req: any, res: any): boolean => {
    const url = new URL(req.url, 'http://localhost')
    if (isAuthorized(req, url)) return false
    res.writeHead(401, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end(JSON.stringify({ error: 'unauthorized' }))
    return true
  }

  // ── 任务库（M1 真实现：项目共享任务板，落盘 ~/.dsh/termfleet/tasks.json） ──
  // 状态机：todo→doing→review→done，任意态可标 blocked；认领=写 owner。
  type TaskStatus = 'todo' | 'doing' | 'review' | 'done' | 'blocked'
  interface TaskRecord {
    id: string; title: string; desc: string; project: string
    prio: 'P0' | 'P1' | 'P2'; due: string; cli: string
    status: TaskStatus; owner: string | null
    createdAt: number; updatedAt: number
    history: Array<{ ts: number; by: string; what: string }>
  }
  const taskStore = (() => {
    let data: { seq: number; tasks: TaskRecord[] } | null = null
    let mods: { fs: typeof import('node:fs'); path: typeof import('node:path'); os: typeof import('node:os') } | null = null
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
      async create(input: any, by: string): Promise<TaskRecord> {
        const d = await ensure()
        d.seq++
        const t: TaskRecord = {
          id: 'T-' + String(d.seq).padStart(3, '0'),
          title: String(input.title ?? '未命名').slice(0, 120),
          desc: String(input.desc ?? '').slice(0, 4000),
          project: String(input.project ?? '默认').slice(0, 60),
          prio: (['P0', 'P1', 'P2'].includes(input.prio) ? input.prio : 'P2') as TaskRecord['prio'],
          due: String(input.due ?? '').slice(0, 20),
          cli: String(input.cli ?? '').slice(0, 30),
          status: 'todo', owner: null,
          createdAt: Date.now(), updatedAt: Date.now(),
          history: [{ ts: Date.now(), by, what: '创建' }],
        }
        d.tasks.unshift(t); save()
        return t
      },
      async act(op: string, id: string, patch: any, by: string): Promise<TaskRecord | null> {
        const d = await ensure()
        const t = d.tasks.find((x) => x.id === id)
        if (!t) return null
        const H = (what: string) => { t.history.push({ ts: Date.now(), by, what }); t.updatedAt = Date.now() }
        if (op === 'claim') { const from = t.owner; t.owner = by; H(`认领 ${from ?? '无人'} → ${by}`) }
        else if (op === 'release') { t.owner = null; H('取消认领') }
        else if (op === 'update') {
          for (const k of ['title', 'desc', 'project', 'due', 'cli'] as const)
            if (typeof patch?.[k] === 'string') { (t as any)[k] = String(patch[k]).slice(0, k === 'desc' ? 4000 : 120); H(`改 ${k}`) }
          if (['P0', 'P1', 'P2'].includes(patch?.prio)) { t.prio = patch.prio; H(`优先级 → ${patch.prio}`) }
          if (typeof patch?.owner === 'string') { t.owner = patch.owner; H(`指派 → ${patch.owner}`) }
        } else if (op === 'status') {
          const to = String(patch?.status ?? '')
          if (['todo', 'doing', 'review', 'done', 'blocked'].includes(to)) { t.status = to as TaskStatus; H(`状态 → ${to}`) }
        } else if (op === 'delete') { d.tasks = d.tasks.filter((x) => x.id !== id); save(); return t }
        else return t
        save(); return t
      },
    }
  })()


  // ── 探针状态（全部随路由回显） ──────────────────────────────
  const state: any = {
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

  // ── 命门①读：未打 scope 标的全局 listener（宿主内零网络零盘读） ──
  ctx.on('session/created', (s: any) => {
    state.sessionCreated.push({ t: Date.now(), id: s?.id })
  })
  ctx.on('session/event', (session: any, event: any) => {
    let brief = ''
    const data = event?.data
    if (data && Array.isArray(data.content)) {
      brief = data.content.filter((b: any) => b?.type === 'text').map((b: any) => b.text).join(' ').slice(0, 200)
    }
    state.sessionEvents.push({ t: Date.now(), sessionId: session?.id, seq: event?.seq, type: event?.type, brief })
    if (state.sessionEvents.length > 500) state.sessionEvents.shift()
  })
  ctx.on('agent/assistant-stream', () => { state.streamFrames++; state.lastStreamFrameAt = Date.now() })
  ctx.on('agent/created', ({ agent }: any) => state.agentEvents.push({ t: Date.now(), kind: 'created', id: agent?.id, status: agent?.status }))
  ctx.on('agent/status', ({ agent, status }: any) => state.agentEvents.push({ t: Date.now(), kind: 'status', id: agent?.id, status }))
  ctx.on('agent/error', ({ agent, error }: any) => state.agentEvents.push({ t: Date.now(), kind: 'error', id: agent?.id, error: String(error).slice(0, 200) }))

  // ── 服务注入：agents / sessions / agentLoop（真宿主里全部在册） ──
  let svc: any = null
  let agentRef: any = null
  ctx.inject(['agents', 'sessions', 'agentLoop'], (c: any) => {
    svc = c
    state.services.ready = true
    state.services.at = Date.now()
    try {
      state.services.agents = c.agents.list().length
      state.services.sessions = c.sessions.list().length
    } catch (e: any) { state.services.error = String(e).slice(0, 200) }
    ctx.logger.info('dsh-termfleet: services injected (agents/sessions/agentLoop)')
  })

  // ── dsh-llm 装载：createUserMessage（与宿主同实例——相同 file URL 命中 ESM 模块缓存） ──
  let llmMod: any = null
  async function loadLlm(): Promise<any> {
    if (llmMod) return llmMod
    const [{ pathToFileURL }, fs, path, os] = await Promise.all([
      import('node:url'), import('node:fs'), import('node:path'), import('node:os'),
    ])
    const candidates: string[] = []
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
      } catch (e: any) { state.llm.error = String(e).slice(0, 200) }
    }
    throw new Error(`dsh-llm not found; tried: ${candidates.join(' | ')}`)
  }

  // ── 命门①写：创建真 agent（假 provider → 请求快败，零 API 费用）+ followup ──
  async function sessionWrite(text: string): Promise<any> {
    const rec: any = { t: Date.now(), text, ok: false }
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
        () => state.sessionEvents.find((e: any) => e.type === 'user/message' && typeof e.brief === 'string' && e.brief.includes(text)),
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
    } catch (e: any) {
      rec.error = String(e?.stack || e).slice(0, 400)
    }
    return rec
  }

  // ── 命门②：PTY spawn（@lydell/node-pty，懒加载隔离故障） ──
  let ptyProc: any = null
  async function ensurePty(): Promise<any> {
    if (state.pty) return state.pty
    const fs = await import('node:fs')
    const path = await import('node:path')
    const os = await import('node:os')
    const st: any = {
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
      const seen = new Set<string>()
      proc.onData((d: string) => {
        const now = Date.now()
        st.bytes += d.length
        st.chunks++
        if (!st.firstDataAt) st.firstDataAt = now
        st.lastDataAt = now
        state.ptyTail.push({ t: now, d: d.length > 2000 ? d.slice(0, 2000) : d })
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
      proc.onExit(({ exitCode }: any) => { st.exited = true; st.exitCode = exitCode })
    } catch (e: any) {
      st.error = String(e?.stack || e).slice(0, 600)
    }
    return st
  }

  async function ptyWrite(data: string, expect?: string): Promise<any> {
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

  function tailText(max = 500): string {
    const joined = state.ptyTail.map((x: any) => x.d).join('')
    return joined.length > max ? joined.slice(-max) : joined
  }

  // ── webServer 路由 ─────────────────────────────────────────
  ctx.inject(['webServer'], (host) => {
    host.effect(() => {
      const json = (res: any, code: number, obj: unknown) => {
        res.writeHead(code, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        })
        res.end(JSON.stringify(obj))
      }
      const readBody = (req: any, limit = 65536): Promise<string> =>
        new Promise((resolve, reject) => {
          let n = 0
          const chunks: Buffer[] = []
          req.on('data', (c: Buffer) => {
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
          handler: (req: any, res: any) => {
            if (guard(req, res)) return
            if (req.method !== 'GET') { res.writeHead(405, { allow: 'GET' }); res.end(); return }
            json(res, 200, { ok: true, ts: Date.now(), uptimeMs: Date.now() - bootAt, plugin: name })
          },
        }),
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/probe-session',
          handler: async (req: any, res: any) => {
            if (guard(req, res)) return
            if (req.method !== 'GET') { res.writeHead(405, { allow: 'GET' }); res.end(); return }
            let snapshotCount: number | null = null
            let snapshotTypes: string[] | null = null
            try {
              const s = svc?.sessions?.get(PROBE_SESSION_ID)
              if (s) {
                const evts = s.snapshotEvents()
                snapshotCount = evts.length
                snapshotTypes = evts.map((e: any) => e.type)
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
          handler: async (req: any, res: any) => {
            if (guard(req, res)) return
            if (req.method !== 'POST') { res.writeHead(405, { allow: 'POST' }); res.end(); return }
            try {
              const body = JSON.parse((await readBody(req)) || '{}')
              const text = typeof body.text === 'string' && body.text.trim()
                ? body.text
                : `M0_STREAM_WRITE_OK ts=${Date.now()}`
              const rec = await sessionWrite(text)
              json(res, rec.ok ? 200 : 500, rec)
            } catch (e: any) {
              json(res, 400, { ok: false, error: String(e).slice(0, 300) })
            }
          },
        }),
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/probe-pty',
          handler: async (req: any, res: any) => {
            if (guard(req, res)) return
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
          handler: async (req: any, res: any) => {
            if (guard(req, res)) return
            if (req.method !== 'POST') { res.writeHead(405, { allow: 'POST' }); res.end(); return }
            try {
              const body = JSON.parse((await readBody(req)) || '{}')
              const data = typeof body.data === 'string' && body.data.length ? body.data : 'echo M0_PTY_OK\r'
              const rec = await ptyWrite(data, body.expect)
              json(res, rec.ok ? 200 : 500, rec)
            } catch (e: any) {
              json(res, 400, { ok: false, error: String(e).slice(0, 300) })
            }
          },
        }),
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/probe-pty/kill',
          handler: async (req: any, res: any) => {
            if (guard(req, res)) return
            if (req.method !== 'POST') { res.writeHead(405, { allow: 'POST' }); res.end(); return }
            try {
              if (ptyProc) ptyProc.kill()
              json(res, 200, { ok: true, killedPid: state.pty?.pid ?? null })
            } catch (e: any) {
              json(res, 500, { ok: false, error: String(e).slice(0, 300) })
            }
          },
        }),
      ]
      // ── 任务面板路由（M1 真实现；身份 v1=X-TF-User 头，接总线后换成员身份） ──
      const who = (req: any) => (()=>{try{return decodeURIComponent(String(req.headers?.['x-tf-user'] ?? 'me'))}catch{return String(req.headers?.['x-tf-user'] ?? 'me')}})().slice(0, 40)
      disposers.push(
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/app',
          handler: async (req: any, res: any) => {
            if (guard(req, res)) return
            try {
              const { pathToFileURL } = await import('node:url')
              const fsx = await import('node:fs')
              const here = new URL('.', import.meta.url) // lib/
              const html = fsx.readFileSync(new URL('app.html', here), 'utf8')
              res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
              res.end(html)
            } catch (e: any) {
              res.writeHead(500, { 'content-type': 'application/json' })
              res.end(JSON.stringify({ error: String(e).slice(0, 300) }))
            }
          },
        }),
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/tasks',
          handler: async (req: any, res: any) => {
            if (guard(req, res)) return
            if (req.method !== 'GET') { res.writeHead(405, { allow: 'GET' }); res.end(); return }
            json(res, 200, { ok: true, tasks: await taskStore.list() })
          },
        }),
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/tasks/create',
          handler: async (req: any, res: any) => {
            if (guard(req, res)) return
            if (req.method !== 'POST') { res.writeHead(405, { allow: 'POST' }); res.end(); return }
            try {
              const body = JSON.parse((await readBody(req)) || '{}')
              const t = await taskStore.create(body, who(req))
              json(res, 200, { ok: true, task: t })
            } catch (e: any) { json(res, 400, { ok: false, error: String(e).slice(0, 300) }) }
          },
        }),
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-termfleet/tasks/action',
          handler: async (req: any, res: any) => {
            if (guard(req, res)) return
            if (req.method !== 'POST') { res.writeHead(405, { allow: 'POST' }); res.end(); return }
            try {
              const body = JSON.parse((await readBody(req)) || '{}')
              const t = await taskStore.act(String(body.op ?? ''), String(body.id ?? ''), body.patch ?? {}, who(req))
              if (!t) { json(res, 404, { ok: false, error: 'task not found' }); return }
              json(res, 200, { ok: true, task: t, tasks: await taskStore.list() })
            } catch (e: any) { json(res, 400, { ok: false, error: String(e).slice(0, 300) }) }
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
              json(res, 200, await memoryStore.create(body, who(req)))
            } catch (e) { json(res, 400, { ok: false, error: String(e).slice(0, 300) }) }
          },
        }),

      )
      ctx.logger.info('dsh-termfleet: 12 routes registered on webServer (6 probe + 4 tasks + 2 memory)')
      return () => {
        try { ptyProc?.kill() } catch { /* 已退出 */ }
        disposers.forEach((d) => d())
      }
    }, 'dsh-termfleet: http routes')
  })
}
