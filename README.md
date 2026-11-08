# dsh-termfleet · TermFleet

**dsh 团队驾驶舱插件** —— lead 与成员同装一个插件，获得跨成员的**会话级**远程协作。
**连会话，不连桌面**：成员的 dsh 会话对话流实时镜像到 lead 面板，lead 可插话直达会话；一切连接过同意握手、限时授权、全程审计。桌面永远不被看到。

## 核心能力

| 能力 | 说明 |
|---|---|
| 🪞 会话流镜像 | 成员 dsh 会话对话流（user/assistant/tool）实时镜像到 lead 面板；服务端 ro/rw 双端强制门控 |
| ⌨️ 插话 | lead 经 rw 通道向成员活动会话插话，回执（followup-ack）闭环；ro 通道服务端 403 |
| 🤝 同意总线 | 握手卡（允许/只读/拒绝）· 跨机 30 分钟限时 · 全程审计 · 成员侧断开即时传播；**本机直连免确认不限时** |
| ⚡ 信任通道 | 成员开信任 → lead 一键请求自动允许只读；rw 接管永远手动点头 |
| 🎟️ TF-JOIN | lead 取码 → 成员粘贴即入队（码含总线地址+团队令牌，支持局域网显式地址） |
| 🔔 通知闭环 | 连接/请求/进度 面板弹条 + IM webhook 审批卡（IM 回复 allow/ro/deny）+ 分级频控摘要推送 |
| 📋 共享任务板 | 全员可建/认领；任务↔会话强绑定；跨机同步（op 上行/广播/墓碑）；unified-board 10 态门禁 |
| 🧠 避坑库 | 决策笔记治理（wnlds 规范：备选/收益/代价），任务关联 |
| 🖥️ 探针终端 | xterm.js 原生 PTY 终端（vendored 零 CDN），逐键转发 |
| 🧾 审计 | 全操作分色审计流（任务/避坑/连接通道），连接·通道筛选 |

## 30 秒上手

```bash
# 两台机都装（或 GitHub 直装）
dsh plugin --profile web add github:IKEASven69/dsh-termfleet

# lead 机：起 dsh 后打开 TermFleet 面板 → ⚙设置 → 「取码」
# member 机：TermFleet 面板 → ⚙设置 → 粘贴邀请码 → 「入队」→ 5 秒内上线
# lead 面板点成员卡「⚡看会话」→ TA 同意（或信任自动允许）→ 实时对话流
```

成员机详细部署：[MEMBER-SETUP.md](MEMBER-SETUP.md)。局域网为默认边界（无公网依赖）；跨网自用推荐 Tailscale（两台机同账号，lead 地址填 100.x IP 零改动）。

## 安全模型

- 一切数据路由过 Bearer 令牌门（`~/.dsh/termfleet/token.json`，timingSafeEqual/fail-closed）
- 会话镜像与插话必须成员显式同意（ro 只读 / rw 可操作），跨机 30 分钟限时，随时可断
- 全操作（任务/避坑/连接·通道）入审计流；信任自动允许也留痕
- 不碰桌面：屏幕流已被产品决策移除（`screen` 模块 unplugged），远程对象=会话本身

## 验收状态

38 项 E2E 全绿（dsh 0.2.0-rc.2 / 0.2.1-alpha.2 / 0.2.1-rc.5 实测）：`verify-p0` 15 场景（入队/镜像/插话/同意门/通知/断开传播/跨机地址/任务同步/绑定/墓碑/推送频控/信任/动态/查重）+ `verify-lan` 3（LAN 取码地址/跨转发器/双向数据）+ 原生板 6 + 原生远程 4 + better-sidebar 共存 4 + xterm 真实键击 6。验收记录见 [docs/audit/](docs/audit/)。

## 文档

- 主计划：[PLAN.md](PLAN.md) · 规格库：[docs/lib/specs/](docs/lib/specs/_modules.md) · 决策：[docs/lib/decisions.md](docs/lib/decisions.md)
- 验收：[docs/ACCEPTANCE-M1.md](docs/ACCEPTANCE-M1.md) · 竞品扫描：[docs/COMPETITOR-SCAN-1105.md](docs/COMPETITOR-SCAN-1105.md)
- 开发：lib/index.js 为宿主装载物（src/index.ts 为镜像，`node scripts/rebuild-src.cjs` 再生）；面板页由 `node scripts/gen-app-html.mjs` 生成（勿手改 lib/app.html）

## English

**TermFleet** is a team cockpit plugin for [dsh](https://github.com/deepseek-ai/dsh): session-level remote collaboration across machines. Lead sees members' live dsh conversation streams (with consent handshake, time-limited grants and full audit) and can inject messages into their sessions; includes TF-JOIN one-line pairing, a shared task board with cross-machine sync, IM approval cards, and a native xterm terminal. LAN-first by design — no public relay; use Tailscale for cross-network.

```bash
dsh plugin --profile web add github:IKEASven69/dsh-termfleet
```

## License

MIT
