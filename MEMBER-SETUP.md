# TermFleet 成员机部署（三步）

> 前置：Windows + 已装 [Node ≥22](https://nodejs.org) + 已装 dsh（`dsh --version` 可用）+ Git。

## ① 拉代码装依赖（只做一次）

```cmd
git clone https://github.com/IKEASven69/dsh-plugin.git
cd dsh-plugin\plugins\dsh-termfleet
npm install
```

## ② 改配置（只做一次）

记事本打开 `scripts\member-boot.cmd`，改三行：

- `TF_LEAD_URL`：lead 机器给的地址（形如 `ws://192.168.x.x:3182/dsh-termfleet/bus`）
- `TF_NAME`：你的名字（默认机器名）
- `TF_TOKEN`：lead 给的团队令牌（默认 `fleet-dev-2026`，生产必改）

## ③ 启动

双击 `scripts\member-boot.cmd`（保持窗口开着）。5 秒内 lead 的"远程"页设备列表出现你的名字即成功。

## 常见问题

- **设备没出现在 lead**：①两台机是否同一局域网/能互 ping；②lead 侧 `lan-forwarder` 是否在跑（lead 机器上 `node scripts/lan-forwarder.mjs`）；③Windows 防火墙首次会弹"允许访问"——勾专用网络点允许；④`TF_TOKEN` 与 lead 是否一致。
- **成员页地址**：本机 `http://127.0.0.1:3181/dsh-termfleet/app?token=<成员机自己的令牌>`（令牌在成员机 `~/.dsh/termfleet/token.json`）。
- **被 lead 连接时的体验**：本机 TermFleet 页面会弹"⚑ 收到连接请求（来自 lead）"——允许/只读/拒绝由你决定；断开随时一键。
