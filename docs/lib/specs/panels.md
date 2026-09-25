---
module: panels
status: active
last-updated: 2026-09-23
last-verified: 2026-09-23
verified-by: sidebar-right-v2.1-banner-and-coexist
cover-files: ["src/client.ts", "lib/client.js", "web/"]
---

# panels 规格书（client 半面板）

## 职责
挂进 dsh web GUI 的全部面板：Fleet 视图、任务面板、远程会话窗（会话级：终端流+答权限卡+发指令）、审计时间线、进度流、diff 视图、回放、成本、权限设置、握手卡弹窗（成员侧）、求助按钮。

## 设计约束（PLAN 第 10 节四道保险）
1. 全部用 @deepseek-ai/dsh-client-ui-primitives 官方原子 + 官方主题，禁自造视觉
2. 布局抄 Orca/VSCode/Linear 成熟模式
3. 低保真 2-3 版用户圈点定稿后才写代码
4. 每里程碑截图过目
- 基线文档：[design-baseline.md](../../design-baseline.md)（M1 侦察产出）
- 挂载参照：dsh-hippo web/ + src/client.ts（/dsh-hippo/app 桥接全 API）

## 任务页=项目级共享任务板（2026-09-19 语义纠偏）

看板默认（四状态列）+列表双视图；全员同视图可建/认领/更新；项目维度筛选；指派可选（详情内），派活仅 lead；会话↔任务自动关联（badge 非手动指派产物）。

## 任务详情·五 tab 钻取视图（2026-09-19 需求扩项，用户定稿方向）

任务不再是"显示"而是可钻到每一个细节的管理对象。详情抽屉五 tab：
1. **全流程**：任务全生命周期时间线（创建→派活→工作流启动→会话→接管→审批→提交→验收→蒸馏），每事件带「定位」深链（会话 seq / 回放帧 / diff 行 / 笔记）
2. **会话细节**：关联会话事件流 seq 级浏览+搜索，接管期间写入带 actor 标记，按 seq 定位回放帧
3. **决策笔记**：write-notes-like-deepseek 治理产品化——目录即状态（proposed/implemented/rejected）六分类，验收自动登记 implemented（noteOnMerged）、打回自动 noteOnRejected、派活注入 guardrail digest（termfleet-heimdall 已有实现可移植）
4. **工作流**：任务驱动的 dsh workflow run（durable）：步骤树+状态/耗时/IO 展开，人类介入点（接管）标注并回链时间线
5. **文档**：任务本体=完整文档+左侧大纲树（背景/目标验收标准/需求明细/技术方案/子任务/执行记录(自动追加)/变更记录）；大纲含「关联物」组直达会话/笔记/工作流/diff/时间线；文档内锚点可直接定位 seq/回放帧/笔记/diff 行（细节定位能力内嵌进文档）

mockup：docs/mockups/m1-mockups.html 任务详情抽屉（v3 四 tab 实测截图在 docs/mockups/v3-*.png）

## 侧边栏集成现状与路线（2026-09-20 调查）

**现状**：面板=独立页 /dsh-termfleet/app（浏览器标签形态）；lib/client.js 仍是 M0 骨架桩——**未注册进 dsh web UI 任何表面**（官方右栏无入口、better-sidebar 无集成、宿主界面里看不到 TermFleet 痕迹）。

**官方机制（已摸清）**：客户端扩展点=@deepseek-ai/dsh-client-ui-slots（槽位服务，如 conversation.session.header.utilities / main.conversation）+ @deepseek-ai/dsh-client-ui-sidebar-right（右侧栏承载面）；client 半经 dsh.client{inject}+window.__ModuleLoader__.load 挂载，React 面板需打包管线（参照 dsh-better-sidebar：createRoot 挂右栏 portal + slots 注册入口图标 + Settings 段）。

**与 dsh-better-sidebar 共存**：它 inject sidebar-right 自挂完整 shell（VSCode 式 viewer/editor/tab），另提供 native surface 适配；集成方式二选一：a) 我们走官方 slots 注册（需实测与它抢位/共存）；b) 若其 viewer 支持自定义 URL，/app 页作为编辑器标签嵌入（最低成本）。

**✅ 已完成（2026-09-21 实测 verify-1~6.png）**：TF 按钮在 dsh 会话头 → 点击弹出 480px 浮层面板（iframe 嵌 /app 全功能）→ 远程请求/同意/终端指令/断开、任务/详情、避坑库(10 条)、审计(58 条)全部面板内操作通过。**成本：建 client 构建管线（React+primitives 打包）≈ 一整个工作块，含与 better-sidebar 共存实测。

## 错题记录
（暂无）

## ✅ v2 补齐：官方右侧栏挂载（2026-09-23）

侧边栏 TBD #7 提前消化：lib/client.js v2 同时挂三处槽位（与 dsh-client-ui-sidebar-files 同款 API）。

- `sidebarRightTabs.register({id:"dsh-termfleet", kind:"termfleet", priority:"builtin", title, guide:[…]})` —— tab 类型定义（effect 包裹，描述"团队驾驶舱"，图标=TfGuideIcon 字母方块）
- `sidebar.right.pane.tab` key=`dsh-termfleet` —— TfTabBody（撑满侧栏，iframe 嵌 /dsh-termfleet/app）
- `sidebar.right.pane.tab.title` key=`dsh-termfleet` —— TfTabTitle（chip icon + "TermFleet"）
- `conversation.session.header.utilities` 原状保留（v1 TF 浮层入口）

**401 banner（v2.1，2026-09-23 补）**：`TfTabBody` + `EntryPanel` 浮层加 401 banner。fetch 探测 `/dsh-termfleet/app`，401 时在 iframe 之上显示黄底警告（`[data-tf-status="auth"]`），文案含根因（dsh launch token ≠ host token.json）+ 临时绕过 + TBD 编号（change-002）。host 鉴权门不动（CLAUDE.md 硬约束守住）。

未做：iframe 形态过渡，M3 视觉收口期换真 React 组件（dsh-client-ui-primitives 原子 + 主题变量）。iframe 鉴权 token 联动根治放 change-002。
验证：起 dsh web（`scripts/boot.patch.yml`）→ 浏览器看会话头 TF 浮层 + 官方侧栏 TF tab + 引导胶囊 + 401 banner；截图 `docs/audit/screens/sidebar-right-v2-*.png`、`banner-{1,2}-*.png`。

## dsh-better-sidebar 共存（2026-09-23 实测 ✅）

better-sidebar v0.19.0+ 也走官方 sidebar-right API（独立 key 互不抢位）；本插件 key=`dsh-termfleet`，共存冲突面窄。

**实测结果（playwright headless，2026-09-23）**：
- 引导页共 7 个胶囊并排：`files` / `git` / `subagent` / `sidechat` / `terminal` / `termfleet`（本插件） / `browser`
- 引导页容器是**官方** sidebar-right 模块（class `P3OORG_panel` + `geFEbW_guide`，不是 BS 自造的）
- BS 装上不影响 TF tab body（DOM 干净，只有 banner + iframe；diagsc 排除 BS 污染）
- TF tab 激活后官方 DockSurface tab strip 出现 TermFleet chip + 官方 chrome（分栏/全屏/收起）
- BS 自家 files tab 工作正常（显示完整 coding/ 目录树，截图 `each-tab-0-files.png`）

**截图**：`docs/audit/screens/sidebar-coexist-{1..8}.png`（共存 8 张）

## iframe 鉴权 token 联动（待 change-002 根治）

**问题**：dsh web BrowserAuth（cookie 鉴权，token query 仅首次有效）与 termfleet host `~/.dsh/termfleet/token.json` 鉴权门**完全不联动** —— 两套 token 各管各的。
- dsh 启动时生成 `launchToken`，URL 暴露给浏览器
- termfleet host 启动时生成 token（存 `~/.dsh/termfleet/token.json`）
- 浏览器 iframe 加载 `/dsh-termfleet/app` 时带 `?token=<localStorage.tf_token>`，但与 host token.json 不一致 → 401

**当前 UX**（v2.1 兜底）：401 banner 明确提示用户，便于排查。
**根治路径**（change-002）：让 host 端接受 dsh launch token（同步或共享 secret），浏览器侧 `localStorage.tf_token` 直接读 URL 的 `?token=`，即可过 host 鉴权门。CLAUDE.md "插件路由必须过鉴权门"硬约束保持——只是把两套 token 联动起来。
