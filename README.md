# dsh-termfleet

TermFleet —— dsh 团队驾驶舱插件：lead 与成员同装一个插件，跨成员**会话级**远程操控——成员 dsh 会话对话流实时镜像到 lead 面板、lead 插话直达成员会话（同意握手卡 ro/rw 服务端门控/限时 30min/全程留痕）、TF-JOIN 邀请码粘贴即入队、连接/请求面板弹条通知、项目共享任务板、决策笔记库（write-notes-like-deepseek 治理）、IM 审批双向、审计。

- 成员机部署：[MEMBER-SETUP.md](MEMBER-SETUP.md)（三步；或 lead 面板「取码」→ 成员面板粘贴即入队）
- 实机验收：[docs/ACCEPTANCE-M1.md](docs/ACCEPTANCE-M1.md) / P0 E2E：[docs/audit/P0-ACCEPTANCE.md](docs/audit/P0-ACCEPTANCE.md)（`node scripts/verify-p0.mjs` 六场景全绿）
- 主计划与文档库：[PLAN.md](PLAN.md) / [docs/lib/specs/_modules.md](docs/lib/specs/_modules.md)
- 开发：lib/index.js 为宿主装载物（src/index.ts=镜像，`node scripts/rebuild-src.cjs` 再生）；`node scripts/gen-app-html.mjs` 再生面板页

> 从 dsh-plugin 管理文件夹迁出为独立仓（保留全部历史）。
