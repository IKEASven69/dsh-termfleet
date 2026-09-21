# 待调查问题

未解决的坑 / 待调查问题 / 已知但没时间修的事项。

## 2026-09-19 · 屏幕流栈内未实跑（M2 首证）

dsh-remote-desktop 只拆了源码（docs/m0-screen-notes.md 五坑清单：-STA / SetProcessDPIAware / helper 前台兜底 / worker stdin 防 EPIPE / base64 行协议 2-5fps），截屏与键鼠注入未在本插件栈内实跑。M2 自写实现时先出最小 worker 首证。

## 2026-09-19 · 真实安装形态未验

M0 全程 --patch 覆盖层验证，未走 `dsh plugin --profile web add` 真实安装。M1 需补一次真实安装自证。

## 2026-09-19 · IM 收方向未探

出站（飞书/钉钉 webhook）有 webapp im.ts 底子；收方向（聊天里答复审批卡）需要长连接（飞书 WebSocket 事件 / dsh-reach 做法），未做技术验证。M2 前置侦察。

## 2026-09-19 · conPTY 清理只能树杀

conPTY 上报 pid=0 无法单杀子进程，清理靠宿主进程树杀（taskkill /T）。长驻成员机时的资源回收策略待 M1 定。

## 2026-09-19 · lead 单点与数据归属未定稿

任务库/审计日志在 lead 本机，lead 关机=全队瘫痪、换机=数据丢。PLAN 风险表给了"定时 git 快照 + 成员本地照跑"缓解，M3 前需定稿存储方案。


## 2026-09-20 · 发布前必办：monorepo 提不了 dsh-market（既踩坑，勿再踩）

dsh plugin add → pnpm add；npm/pnpm 均不支持 git 仓库子目录作依赖——monorepo 里的 plugins/dsh-termfleet 无法被市场安装（先例：dsh-opencli 为此另建独立仓 IKEASven69/dsh-opencli；dsh-hippo 走 npm 发布形态 dist-publish）。**开发期无碍**（boot.patch 绝对路径 --patch 不进 profile；成员机 clone+patch 同理）。**发布时二选一**：① `git subtree split -P plugins/dsh-termfleet -b termfleet-publish` 拆独立仓（保留历史）→ `dsh plugin --profile web add github:IKEASven69/dsh-termfleet`；② npm publish（hippo 形态：dist-publish + README-npm.md，package.json 已备 files/exports）→ `dsh plugin add dsh-termfleet`。发布日执行其一。

## 2026-09-20 · 面板游离于宿主 UI 之外（侧边栏集成未做）

面板是独立 URL 页，dsh web 内无入口。集成=建 client 半构建管线（slots/sidebar-right/React 打包）+ better-sidebar 共存实测。用户已过问，建议 M3 提前排。
