// LAN 转发器（用户态，无需管理员）：0.0.0.0:3182 → 127.0.0.1:3180
// 背景：dsh 宿主安全策略禁绑 0.0.0.0（防 RCE 面，正确）。局域网实机验收用本转发器暴露：
//   成员机连 ws://<lead局域网IP>:3182/dsh-termfleet/bus
// 首次启动 Windows 防火墙可能弹"允许访问"——点允许（或管理员执行：
//   netsh advfirewall firewall add rule name="TermFleet LAN 3182" dir=in action=allow protocol=TCP localport=3182）
import net from 'node:net'

const LISTEN_PORT = Number(process.env.TF_LAN_PORT || 3182)
const TARGET_PORT = Number(process.env.TF_TARGET_PORT || 3180)
let conns = 0

const server = net.createServer((client) => {
  const up = net.connect(TARGET_PORT, '127.0.0.1')
  conns++
  client.pipe(up); up.pipe(client)
  const done = () => { try { client.destroy() } catch {} ; try { up.destroy() } catch {} }
  client.on('error', done); up.on('error', done)
  client.on('close', () => { conns--; done() })
})

server.listen(LISTEN_PORT, '0.0.0.0', () => {
  console.log(`[lan-forwarder] 0.0.0.0:${LISTEN_PORT} → 127.0.0.1:${TARGET_PORT} （Ctrl+C 退出；当前连接 ${conns}）`)
})
