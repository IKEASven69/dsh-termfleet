# dsh-termfleet

TermFleet —— dsh 团队驾驶舱插件：lead 与成员同装一个插件，跨成员**会话级**远程操控（同意握手卡/限时 30min/全程留痕）、项目共享任务板、决策笔记库（write-notes-like-deepseek 治理）、IM 审批双向、审计。

- 成员机部署：[MEMBER-SETUP.md](MEMBER-SETUP.md)（三步）
- 实机验收：[docs/ACCEPTANCE-M1.md](docs/ACCEPTANCE-M1.md)
- 主计划与文档库：[PLAN.md](PLAN.md) / [docs/lib/specs/_modules.md](docs/lib/specs/_modules.md)
- 开发：lib/index.js 为宿主装载物（src/index.ts=镜像，`node scripts/rebuild-src.cjs` 再生）；`node scripts/gen-app-html.mjs` 再生面板页

> 从 dsh-plugin 管理文件夹迁出为独立仓（保留全部历史）。
