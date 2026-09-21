---
module: panels
status: active
last-updated: 2026-09-19
last-verified: 2026-09-19
verified-by: task-panel-v1-real
cover-files: ["src/client.ts", "web/"]
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

**成本**：建 client 构建管线（React+primitives 打包）≈ 一整个工作块，含与 better-sidebar 共存实测。

## 错题记录
（暂无）
