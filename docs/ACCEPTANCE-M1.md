# M1 实机验收手册（两台物理机 · 2026-09-20 版）

> 目标：在真实两台机上走完"lead 请求 → 成员同意 → lead 实际敲进成员会话"全链并录屏。
> 单机双实例已全通（z-3-FINAL.png 等）；本手册补真实跨机网络一段。

## 环境

| 机 | 角色 | 准备 |
|---|---|---|
| A（主力机） | lead | 本仓库最新代码；`node scripts/lan-forwarder.mjs`（保持运行）；lead 实例：`TERMFLEET_ROLE=lead TERMFLEET_TOKEN=<团队令牌> dsh --patch scripts/boot.patch.yml --profile web --port 3180 --no-open`；查本机局域网 IP（`ipconfig`，以太网 IPv4） |
| B（第二台） | member | 按 [MEMBER-SETUP.md](../MEMBER-SETUP.md) 三步部署（LEAD_URL 用 `ws://<A的IP>:3182/dsh-termfleet/bus`） |

lead 面板：`http://127.0.0.1:3180/dsh-termfleet/app?token=<A机 ~/.dsh/termfleet/token.json>`
成员面板：`http://127.0.0.1:3181/dsh-termfleet/app?token=<B机同路径>`

## 验收清单（录屏逐项过，预期结果必须命中）

| # | 操作 | 预期 |
|---|---|---|
| 0 | B 机双击 member-boot.cmd | 5 秒内 A 的远程页设备列表出现 B 的名字（在线绿点） |
| 1 | A 设备卡点 B → 请求连接 | B 的 TermFleet 页弹「⚑ 收到连接请求（来自 lead）」 |
| 2 | B 点「允许（可操作）」 | A 页通道变 `● 已连接 · 可操作`，倒计时 30:00 起跳 |
| 3 | A 在终端输入 `echo ACCEPTANCE_OK` 回车 | A 的终端出现成员机真实回显（两行：命令+结果） |
| 4 | B 点自己页面的「断开」 | A 页立刻变 `○ 已断开`；A 再发指令被 403 拒绝 |
| 5 | 重新请求，B 点「拒绝」 | A 页变 `○ 已拒绝`；无需理由 |
| 6 | 重新请求，B 选「仅只读」 | A 页 `● 只读`；A 输入框禁用；绕过 UI 直接 curl 写也 403 |
| 7 | 通道建立后等 30 分钟（或临时改代码缩短） | 自动断开（expired），全程无需人工 |
| 8 | B 点「呼叫 lead 协助」 | A 设备卡红 SOS 徽标 + toast；IM（若配 webhook）同步收到 |
| 9 | （配了 IM）A 发请求后手机 IM 答复「允许」 | 通道建立，A 页 actor 记录含 IM 来源 |
| 10 | 全程结束查 A 的「审计」页 | 每一步（请求/允许/拒绝/断开/远端写入/IM 答复）各有一条真事件 |

## 录屏要求（用户纪律：真测不造假）

- 一镜到底不剪辑，覆盖清单 #0–#10（#7 可注明跳过或缩短）
- 两台机器同框（或双屏同录）：A 的 lead 面板 + B 的成员面板都要可见
- 存档 `docs/audit/video/m1-acceptance.mp4`，登记 Agent Note

## 已知边界

- **A 机自测经局域网 IP 会被本机代理(TUN/fake-ip)劫持**：TCP 假握手成功但载荷丢弃（表现为 empty reply）——这不是产品问题；跨机验证以 B 机发起为准（真实外部包只走 Windows 防火墙，首连弹窗允许即可）。双实例回环 + B 机发起的 LAN 包两条路径已覆盖协议层验证。

- dsh 宿主禁绑 0.0.0.0（安全栅栏，正确）——局域网暴露走用户态转发器（3182→3180），首连防火墙弹窗需点允许
- B 机若与 A 不在同一网段：改用 Tailscale/FRP 隧道（把 LEAD_URL 指到隧道地址即可，协议不变）
