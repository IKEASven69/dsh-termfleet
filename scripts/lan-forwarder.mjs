// LAN 转发器 v2（用户态，无需管理员）：0.0.0.0:3182 → 127.0.0.1:3180
// dsh 宿主只听 127.0.0.1（安全栅栏）且对非本机 Host 的请求会直接断连——
// 本转发器把客户端→上游方向的第一个请求头块里的 Host 改写为 127.0.0.1:<目标端口>，
// WS Upgrade 请求同样被改写；Upgrade 完成后的二进制帧原样透传。
// 背景：dsh 宿主安全策略禁绑 0.0.0.0（防 RCE 面，正确）。局域网实机验收用本转发器暴露：
//   成员机连 ws://<lead局域网IP>:3182/dsh-termfleet/bus
// 首次启动 Windows 防火墙可能弹"允许访问"——点允许（或管理员执行：
//   netsh advfirewall firewall add rule name="TermFleet LAN 3182" dir=in action=allow protocol=TCP localport=3182）
import net from 'node:net'

const LISTEN_PORT = Number(process.env.TF_LAN_PORT || 3182)
const TARGET_PORT = Number(process.env.TF_TARGET_PORT || 3180)
const FAKE_HOST = '127.0.0.1:' + TARGET_PORT

const server = net.createServer((client) => {
  const up = net.connect(TARGET_PORT, '127.0.0.1')
  let headerMode = true
  let pending = Buffer.alloc(0)

  client.on('data', (chunk) => {
    if (!headerMode) { up.write(chunk); return }
    pending = Buffer.concat([pending, chunk])
    const text = pending.toString('latin1')
    const i = text.indexOf('\r\n\r\n')
    if (i < 0) {
      if (pending.length > 65536) { headerMode = false; up.write(pending); pending = null }
      return
    }
    const head = text.slice(0, i).replace(/^Host:.*$/mi, 'Host: ' + FAKE_HOST)
    const rest = text.slice(i + 4)
    up.write(Buffer.from(head + '\r\n\r\n' + rest, 'latin1'))
    headerMode = false
    pending = null
  })
  up.pipe(client)

  const done = () => { try { client.destroy() } catch {} ; try { up.destroy() } catch {} }
  client.on('error', done); up.on('error', done)
  client.on('close', done); up.on('close', done)
})

server.listen(LISTEN_PORT, '0.0.0.0', () => {
  console.log(`[lan-forwarder v2] 0.0.0.0:${LISTEN_PORT} → 127.0.0.1:${TARGET_PORT}（首请求头 Host 改写为 ${FAKE_HOST}）`)
})
