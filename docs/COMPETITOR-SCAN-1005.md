# 竞品调研 · 第 3 轮（2026-10-05）

> 上轮调研：2026-09-18（DSH-ECOSYSTEM-SCAN-0918.md，当时 dsh 0.1.5-rc.1）。本轮时隔 17 天，聚焦三个问题：①dsh 生态内是否出现直接竞品 ②上游 dsh 是否有破坏性更新 ③团队驾驶舱赛道格局变化。

## ① dsh 生态内直接竞品：出现 1 个正面撞车 + 2 个侧面逼近

### ⚠️ dsh-team-rooms v1.0.8（10-05 更新，9-11 首发）——**正面撞车度最高**

- 定位：跨会话持久团队房间 = 消息总线 + **共享任务板** + **审批门控交接（approval-gated handoffs）** + 共享时间线，**重启可存活**
- 从 dsh-background-agents 0.9.6 拆出，周下载 522（两周内从 0 到 500+，爬升快）
- 与 TermFleet 重叠：共享任务板 / 审批门控 / 时间线——**但它管的是"AI agent 之间"的协作（background agents 的房间），TermFleet 管的是"人与人之间通过 agent 会话"的协作（同意握手/限时/审计/IM/SOS）**
- GitHub 4 星（新仓），作者 PerryLink

### 侧面逼近

- **@linxin666/dsh-client-ui-task-board v0.4.5**（10-05 更新）：host 权威任务板 + **真实会话执行** + host cron 调度 + **可选跨设备**——它的"host 权威+跨设备"与 TermFleet 的任务板正面重叠，且是生态老牌（8 月首发，linxin666 系装机量大）
- **dsh-team v0.2.11**（9-30）：命名长驻 teammate + 共享任务列表 + member-to-member 通信（ctx.subagents 层）——agent 团队管理，偏 AI-to-AI
- **dsh-better-sidebar v0.24.1**（9-28，**周下载 5.78 万**——生态顶流）：右栏已含 tasks 页签+side chat，它的"tasks"若继续演化就是侧边栏内的任务板

### 判读

- "共享任务板"已被做 3 遍（linxin666/firetruck666/ukewea + team-rooms/team 的内置板）——**TermFleet 的任务板单拎出来没有稀缺性**
- TermFleet 的**不可替代组合**依然是：会话级远程操控（同意门+限时+审计）+ 跨机总线 + IM 双向——这三样生态内**仍然无人做**（team-rooms 的 approval-gated handoffs 是 agent 间交接，不是人对人会话接管）
- 威胁等级：team-rooms 需持续观察（迭代快、概念接近），但当前面向的是 background-agents 用户群，不冲突直接用户场景

## ② 上游 dsh 0.2.0-rc.2（9-29 发布）——**破坏性风险升级**

- 上游从 0.1.x 跳到 **0.2.0-rc**——大版本变更，plugin API 可能不兼容
- 本机开发环境还是 0.1.5-rc.1；**0.2.0 下 termfleet 的 cordis.patch/slots 注册/client 声明必须回归测试**
- 行动项：装一个 0.2.0-rc 的测试 profile 做兼容性验证（下轮），必要时按官方迁移文档改

## ③ 团队驾驶舱赛道（dsh 之外）

- **Orca ★85.4k**（10-05 活跃）：ADE for fleet of parallel agents——单人多 agent 驾驶舱的霸主，仍无团队协作层
- **Crush ★28.5k**（charmbracelet，10-05 活跃）：agent 终端，单机
- **claude-squad ★8.6k**：8-20 后推送放缓（上轮已注意到的趋势延续）
- **agent-relay v13.1.1**（10-04）：real-time agent-to-agent communication——新玩家，agent 间通信协议化，思路与我们的总线类似但面向 AI-to-AI
- **无人做"人对人 via agent 会话"的治理型远程协作**——TermFleet 的他信治理（同意/限时/审计）定位依然成立

## ④ 下轮更新目标建议（按优先级）

1. **会话流镜像 v1**（最高优先）：lead 面板实时渲染成员 dsh 会话对话流 + 插话输入——这是"远程操控 dsh"的真身，底子（listener+followup+SSE）全通，差的只是面板渲染与总线转发。M0~M2 验证过的技术全部复用
2. **dsh 0.2.0 兼容性回归**：测试 profile 跑一遍五件套，修复不兼容点（上游 0.2.0-rc.2 已发布，拖久了用户会先升级）
3. **任务↔会话强关联**：现在弱匹配（项目名文本），升级为创建任务时可选"绑定会话"（会话 id 直挂）+ 面板显示实时事件
4. **向量查重接入**（接 hippo 向量能力，unified-board 的 plan_embed 思路）
5. **任务切片模型**（S1..Sn + covers + HITL/AFK）——字段已留，UI 未做

## 与上轮结论的差异（增量化）

- 上轮说"团队版空白"→ 修正为：**团队版出现第一个正面竞品（team-rooms），但仅限 AI-agent 协作；人对人治理型仍空白**
- 上轮没注意的：linxin666 系 task-board 的跨设备能力值得拆源码看实现
- 上轮没预料的：上游 0.2.0 大版本这么快到来
