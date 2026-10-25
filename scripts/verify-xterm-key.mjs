// ═══════════════════════════════════════════════════════════════════════════
// verify-xterm-key.mjs — xterm 原生终端「真实键盘键入」全链路专项实测
//
// 背景（2026-10-25 真测揪出存量 bug）：
//   onData 里 api('/pty/raw','POST',{data}) 三参误用——api(path,body) 只收两参，
//   'POST' 落在 body 位 → 实发请求体是 JSON.stringify('POST')='"POST"'，
//   服务端读 body.data=undefined → 写空串。症状：用户敲键终端零回显。
//   此前「回显 OK」证据全部来自 HTTP 探针路由（probe-pty/write）或页内手工
//   fetch，键盘路径从未被真实键事件打过。
//
// 本脚本补上这一环：真实 Chromium CDP 键事件（page.keyboard.type，含大写
// E2E 与空格——恰是合成 KeyboardEvent 丢失的字符形态）逐键打穿
// keydown → xterm onData → POST /pty/raw → pty.write → pwsh 回显 → SSE → 渲染。
//
// 断言：
//   K1 通道与 xterm 就绪（chanPill + .xterm 元素）。
//   K2 /pty/raw 请求体全部携带真实键入字符（绝不出现 '"POST"' 垃圾体——回归锁）。
//   K3 终端缓冲出现完整回显行「echo E2E_KEY_OK」与 pwsh 输出「E2E_KEY_OK」。
//   K4 大写+空格+数字混合输入逐字保真（无丢字）。
//
// 隔离纪律：临时 DSH_HOME/USERPROFILE，结束杀干净自拉进程并删除临时目录；
//   端口从 3190 起顺延，绝不碰 3180/3181 与用户进程。
// 用法：node scripts/verify-xterm-key.mjs   （全 PASS=0，否则 1）
// ═══════════════════════════════════════════════════════════════════════════
import { spawn } from 'node:child_process'
import net from 'node:net'
import { mkdtempSync, readFileSync, existsSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DSH_BIN = 'C:/Users/20369/.version-fox/sdks/nodejs/node_modules/@deepseek-ai/dsh/lib/bin.js'
const results = []
const R = (name, ok, evidence) => { results.push({ name, ok }); console.log(`${ok ? '✅' : '❌'} ${name}→${ok ? 'PASS' : 'FAIL'} 证据: ${evidence}`) }
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
async function pickPort(want) {
  let p = want
  while (!(await portFree(p))) { console.log(`[port] ${p} 已被占用（不碰他人进程），顺延 → ${p + 10}`); p += 10 }
  return p
}
const killTree = (pid) => new Promise((res) => {
  const k = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
  k.on('close', () => res()); k.on('error', () => { try { process.kill(Number(pid), 'SIGKILL') } catch {}; res() })
})

async function main() {
  const port = await pickPort(3190)
  const tmp = mkdtempSync(join(tmpdir(), 'tf-xkey-e2e-'))
  const dshHome = join(tmp, 'dsh-lead')
  const userProfile = join(tmp, 'home-lead')
  for (const d of [dshHome, userProfile]) mkdirSync(d, { recursive: true })
  const patchFile = join(tmp, 'boot.patch.yml')
  writeFileSync(patchFile, `- insert:\n    - id: termfleet\n      name: 'D:/coding/dsh-termfleet/lib/index.js'\n      config: {}\n`)
  try {
    const realLlm = 'C:/Users/20369/.version-fox/sdks/nodejs/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-llm'
    const jLink = join(userProfile, '.version-fox', 'sdks', 'nodejs', 'node_modules', '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-llm')
    mkdirSync(dirname(jLink), { recursive: true })
    symlinkSync(realLlm, jLink, 'junction')
  } catch {}

  const child = spawn(process.execPath, [DSH_BIN, '--patch', patchFile, '--profile', 'web', '--port', String(port), '--no-open'], {
    cwd: REPO,
    env: { ...process.env, DSH_HOME: dshHome, USERPROFILE: userProfile, TERMFLEET_ROLE: 'lead', TERMFLEET_TOKEN: 'fleet-xkey-e2e', TERMFLEET_NAME: 'XKEY-LEAD' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let out = ''
  child.stdout.on('data', (d) => { out += String(d) })
  child.stderr.on('data', (d) => { out += String(d) })
  let browser = null
  try {
    await waitFor(() => /http:\/\/127\.0\.0\.1:\d+\/\?token=\S+/.test(out), 90000, 500, 'dsh 启动横幅')
    const tokenPath = join(userProfile, '.dsh', 'termfleet', 'token.json')
    await waitFor(() => existsSync(tokenPath), 20000, 300, '插件令牌文件')
    const TOK = JSON.parse(readFileSync(tokenPath, 'utf8')).token
    console.log(`[lead] 就绪 port=${port}`)

    browser = await chromium.launch({ args: ['--no-proxy-server'] })
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 950 }, locale: 'zh-CN' })
    const page = await ctx.newPage()
    const rawBodies = []
    page.on('request', (r) => { if (r.url().includes('/dsh-termfleet/pty/raw')) rawBodies.push(r.postData() || '') })

    await page.goto(`http://127.0.0.1:${port}/dsh-termfleet/app?token=${TOK}`)
    await page.waitForLoadState('domcontentloaded')
    // 远程页 + 本机自连（免确认直通）。夹具用 JS 点击开通道；被测对象是键入链路，须真实键事件
    await page.evaluate(() => pg('remote'))
    await page.evaluate(() => { const b = [].slice.call(document.querySelectorAll('button')).find((x) => x.textContent.indexOf('请求连接本机 pwsh') >= 0); if (!b) throw new Error('请求连接按钮未找到'); b.click() })

    // K1 通道与 xterm 就绪
    await waitFor(async () => {
      return page.evaluate(() => ({
        chan: (document.getElementById('chanPill') || {}).textContent || '',
        xterm: !!document.querySelector('#ptyXterm .xterm'),
        ta: !!document.querySelector('#ptyXterm .xterm-helper-textarea'),
      })).then((s) => (s.chan.indexOf('rw') >= 0 && s.xterm && s.ta ? s : null))
    }, 15000, 300, '通道+终端就绪').then((s) => R('K1 通道与 xterm 就绪', true, `chanPill="${s.v.chan}" .xterm+helper-textarea 在场`))

    // 真实点击终端区域取焦点，再真实 CDP 键盘逐键输入（大写+空格+下划线+数字）
    await page.locator('#ptyXterm .xterm').click()
    const CMD = 'echo E2E_KEY_OK 42'
    await page.keyboard.type(CMD, { delay: 25 })
    await page.keyboard.press('Enter')
    await waitFor(async () => {
      return page.evaluate(() => {
        const t = window.XT && window.XT.term
        if (!t || !t.buffer) return null
        const lines = []
        for (let i = 0; i < t.buffer.active.length; i++) {
          const l = t.buffer.active.getLine(i)
          if (l) { const s = l.translateToString(true); if (s.trim()) lines.push(s.trim()) }
        }
        return lines.slice(-6)
      }).then((lines) => (lines && lines.some((x) => x.trim() === 'E2E_KEY_OK') && lines.some((x) => x.trim() === '42') ? lines : null))
    }, 12000, 300, '回显出现').then((s) => { const lines = s.v
      const echoLine = lines.find((x) => x.indexOf('echo E2E_KEY_OK 42') >= 0)
      // pwsh 按空格拆参：echo 输出两行「E2E_KEY_OK」「42」
      const outA = lines.find((x) => x.trim() === 'E2E_KEY_OK')
      const outB = lines.find((x) => x.trim() === '42')
      const outLine = outA && outB ? `${outA.trim()} + ${outB.trim()}` : null
      const typedPart = echoLine ? echoLine.slice(echoLine.lastIndexOf('>') + 1).trim() : ''
      // K2 请求体保真：每请求都带真实字符，绝不出现 '"POST"'
      const junk = rawBodies.filter((b) => b === '"POST"' || b === '"POST\\r"')
      const withData = rawBodies.filter((b) => { try { const j = JSON.parse(b); return typeof j.data === 'string' && j.data.length > 0 } catch { return false } })
      R('K2 /pty/raw 请求体携带真实键入', rawBodies.length >= CMD.length && junk.length === 0 && withData.length >= CMD.length,
        `${rawBodies.length} 个请求（≥${CMD.length} 键），垃圾体 ${junk.length} 个，带数据体 ${withData.length} 个，样本=${rawBodies.slice(0, 3).join(' ')}`)
      // K3 完整回显行 + pwsh 输出
      R('K3 终端缓冲完整回显', !!echoLine && !!outLine, `输入行="${echoLine || '无'}" 输出行="${outLine || '无'}"`)
      // K4 无丢字（剥掉提示符后与命令逐字一致）
      R('K4 大写/空格/数字混合逐字保真', typedPart === CMD, `逐字比对=${typedPart === CMD ? '一致' : `不一致（实收 "${typedPart}"）`}`)
    })

    // 截图存档
    await page.screenshot({ path: join(REPO, 'docs', 'audit', 'screens', `xkey-${Date.now().toString(36)}.png`), fullPage: false })
  } catch (e) {
    R('xterm 真实键入全链路', false, String(e).slice(0, 200))
  } finally {
    if (browser) { try { await browser.close() } catch {} }
    try { await killTree(child.pid) } catch {}
    await sleep(600)
    try { rmSync(tmp, { recursive: true, force: true }) } catch {}
  }
  const fail = results.filter((r) => !r.ok).length
  console.log(fail === 0 ? `\n全部 ${results.length} 项 PASS ✅` : `\n${fail} 项 FAIL ❌`)
  process.exit(fail === 0 ? 0 : 1)
}
main()
