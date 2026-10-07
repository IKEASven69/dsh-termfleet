# P1 首位功能调研：任务↔会话强关联

> 调研日期：2026-10-06。调研员：TermFleet 专项（所有来源均为当日实际核实，绝对日期随条目标注）。
> 功能定义：任务创建时显式绑定 dsh 会话（sessionId），lead 在任务详情里直接看该会话实时流；替代现状的「项目名文本弱匹配」。
> 调研渠道说明：WebSearch 本轮额度受限（限额重置 2026-10-22），全部证据改经 GitHub API（gh CLI）、npm registry、官方源码直读与 HN Algolia 核实。

---

## 0. 结论速览

1. **需求实证成立**：wowyuarm 2026-09-27 的 issue #40 原文已取得——「谁在做什么」的结构化信号缺失是实测痛点（agent 靠 git mtime 拼凑判断），且已于 v0.2.0（2026-09-29）落地，验证了同款方案；人类版（跨成员、会话级）在生态内仍无人做。
2. **绑定载体的生态共识是「存 id、显名」**：官方 agent-team 的任务快照直接持有 `ownerId: SessionId`，展示层运行时解析为 `ownerName`；按名字/文本推导绑定的做法有真实翻车案例（nanmicoder #203：ASCII 清洗 vs Unicode 名字，绑定永不命中）。
3. **dsh 会话身份可支撑强绑定**：SessionId 是 branded string，唯一权威拷贝存于会话持久化 header，JSONL 后端按 id 一文件（`.jsonl.zstd`），跨重启稳定（issue #14 的 `SessionAlreadyExistsError` 从反面证明同 id 复用是设计行为）；事件流 `session/event` 信封自带 `session.id + seq`，TermFleet P0 已在消费。

---

## 1. 需求实证

### 1.1 主证据：wowyuarm/dsh-agent-team issue #40（2026-09-27）

- 原文：https://github.com/wowyuarm/dsh-agent-team/issues/40 （created 2026-09-27T14:35:27Z，closed 2026-09-29T05:00:15Z）
- 标题：**team_view 增加「活跃 task thread」段：让 agent 能看到当前谁在做什么、避免骑在他人在途工作上**

核心诉求原文摘录：

> ## 问题
> Agent 在 team_view 里拿不到「当前谁在活跃地做什么」的结构化信号。当任务冲突、或工作区有它没预期的改动时，agent 只能靠 git 文件修改时间 + 逐个读 thread 拼出「有人正在途、我不该骑上去」——**笨、慢、易漏**。
>
> 过去 trace 证实这是真实痛点：有成员要提交文档，发现某个 UI 改动是别人在途、还没推的（相关文件一分钟前还在被改），于是判断「有人正在活跃、现在提交会骑在别人在途工作上」而决定不提交——**但这个「谁在活跃」的信号完全来自 git mtime + 读 thread，team_view 帮不上**。

该 issue 同时给出了与 TermFleet 同构的解决路径（把已有 ledger 投影多产一份「活跃切片」：in_progress / 有 active claim 的 task thread + 参与成员 + 最新活动）。

**实现确认**：issue #40 于 v0.2.0 落地——release note（published 2026-09-29T04:45:23Z，https://github.com/wowyuarm/dsh-agent-team/releases/tag/v0.2.0）：「`team_view` 现在列出当前在途的任务 Thread：读者 Channel 里所有 in_progress / in_review 的 Task，连同已经在其上的成员与最新活动一起给出，且独立于读者自己的未读队列。」**需求→方案→落地周期仅 2 天**，且功能描述与本调研的 P1 设计几乎同构（agent 版）。

**与 TermFleet 的映射**：#40 是 agent 视角（agent 看谁在做什么），TermFleet 的任务↔会话强关联是人类 lead 视角的同一需求（lead 看哪个人在哪件事上的哪个会话）。区别仅在粒度：dsh 生态官方/社区方案都在「单用户边界内」，跨成员、经同意的会话级关联无人做。

### 1.2 同类抱怨（任务/会话/agent 状态脱节）

**① nanmicoder/dsh-agent-teams issue #205（2026-09-26）：任务状态与成员实际状态脱节**
- 原文：https://github.com/NanmiCoder/dsh-agent-teams/issues/205 （created 2026-09-26T15:10:59Z）
- 标题：「[Bug] Member turn failure is recorded as task completed, and often leaves no failure record (panel still shows 18/18)」——成员回合失败但任务仍标 `completed`，面板 18/18 全绿。
- ⚠️ **诚实更正**：报告人于 2026-09-27 发更正评论（#issuecomment-5847395498）：交付未丢失、`completed` 状态本身正确（数据一直在 `task.output`），是报告脚本读错了对象；**存活下来的窄命题**是「settlement 之后的成员回合失败有时不留任何记录」。引用时须带此更正——它不削弱「任务状态≠成员实际状态需要人工核对」的痛点，反而说明**当任务与成员会话解耦时，判断「到底做完没有」需要跨对象拼证据**，正是强关联要消除的。

**② nanmicoder/dsh-agent-teams issue #203（2026-09-25）：按「名字」绑定在真实世界必翻车**
- 原文：https://github.com/NanmiCoder/dsh-agent-teams/issues/203 （created 2026-09-25T18:40:36Z，open）
- 标题：「Client card recomputes teamId with an ASCII-only sanitizer while the server keeps Unicode: non-ASCII team names never match their live team」——客户端卡片用 ASCII-only 清洗规则重算 teamId，服务端保留 Unicode，**非 ASCII 团队名的绑定永不命中**。
- 对 TermFleet 的直接意义：现状「项目名文本弱匹配」就是这类按名字推导的绑定，中文名/特殊字符/重名都会命中失败。**绑定必须落在稳定 id 上，名字只能做展示。**

**③ HN Show HN「Orchestro – Trello for Claude Code with Kanban Board」（2025-10-12）**
- 来源：https://news.ycombinator.com/item?id=45559071 （HN Algolia 检索核实，2026-10-06）
- 作者动机原文：「**I kept losing track of what the AI was doing across multiple conversations.**」——多会话间任务重复、依赖不清、没有全局视图，于是给 Claude Code 做「任务管理大脑」。dsh 生态外独立证据：多 agent 会话 × 任务板脱节是跨 harness 的普遍抱怨，且已有人靠它做产品。

**④（旁证）iops-rooms 定位语（npm，0.7.4，2026-10-05 发版）**：https://www.npmjs.com/package/iops-rooms ——「看谁建了你的项目、哪个 AI 帮了忙，共享团队状态与 AI 配置」。「谁在做什么」的人向共享状态在 dsh 之外也在冒头（上轮竞品扫描 2026-10-05 已记录，增速快）。

### 1.3 未能核实

- **linux.do**：Cloudflare 403 拦截匿名读取（`/search.json` 返回 "Just a moment..."），与前两轮调研一致，跳过。
- **Reddit r/LocalLLaMA**：`old.reddit.com/search.json` 反爬返回占位页，无内容，未能核实。
- 通用新闻面（受 WebSearch 限额影响）未能覆盖；本节信号全部来自 GitHub issues/release 与 HN Algolia，日期均为绝对日期。

---

## 2. 竞品绑定模式

### 2.1 官方 `@deepseek-ai/dsh-experimental-agent-team`（team-rooms 继任者）：任务→会话引用语义 **存在，且就是 SessionId**

来源：GitHub 主仓源码直读（2026-10-06），`packages/experimental/agent-team/src/types.ts`、`task-board.ts`、`task-graph.ts`，https://github.com/deepseek-ai/deepseek-harness/tree/main/packages/experimental/agent-team ；npm 0.1.5-alpha.2（2026-09-09 首发）→ 0.2.1-alpha.1（2026-10-03），dist 内 `readmeFilename` 为空，README 以仓内为准。

从 `types.ts` 源码直接摘出的关键类型（逐行核实）：

```ts
/** Identifies the implicit team rooted at one top-level Session. */
export type TeamId = Branded<'TeamId'>          // TeamId = 根 SessionId 的别名品牌

export interface TeamMemberSnapshot {
  readonly id: SessionId                        // 每个成员的身份就是一个 SessionId
  readonly name: string
  readonly phase: 'provisioning' | 'active' | 'failed'
}

export interface TeamTaskSnapshot {
  readonly id: TeamTaskId                       // 实际生成格式 task-<n>（task-board.ts: TeamTaskId(`task-${state.nextTaskNumber}`)）
  readonly revision: number                     // 每次 mutation 递增——compare-and-set 基准
  readonly status: 'pending' | 'in_progress' | 'completed' | 'deleted'
  readonly ownerId?: SessionId                  // ★ 任务的 owner 直接引用成员的 SessionId
  readonly blockedBy: TeamTaskId[]              // 依赖边（DAG，task-graph.ts 做环/缺失/自引用校验）
  readonly writeScopes: string[]                // 声明要碰的文件路径，冲突时只告警不阻断
}

export interface TeamTaskView {
  readonly ownerId?: SessionId
  readonly ownerName?: string                   // ★ 展示层运行时把 SessionId 解析成名字
}
```

可借鉴的语义要点（全部有源码出处）：

1. **绑定载体 = SessionId 引用**，不是名字、不是路径。`claim` 动作写 `ownerId: caller.id`；`release` 用 `withoutOwner` 清掉引用回到 pending；Lead 可 `reassign` 给任意成员。
2. **存 id、显名分层**：durable 快照只存 id；`ownerName` 是运行时 enrich 的视图字段。名字可变、id 不变。
3. **乐观并发**：每次更新带 `expectedRevision`，stale 即拒（`TEAM_TASK_STALE_REVISION`）——任务状态机多人可写时的防覆盖手法。
4. **权威账本位置**：任务事件（`team/task`, version 2）追加在 **Lead 会话日志**里（`journal.transact(root.id, ...)`），状态由日志折叠投影而来，通过 Lead Session 的 `agentTeam` projection 发布给浏览器端。
5. **任务不挂「执行会话」而挂「执行者会话」**：官方模型里 member 本身就是一个 SessionId，claim 即绑定；没有单独的 task→session 外键。TermFleet 场景（人的会话会换、一个任务可能跨多个会话）比它多一层，但 `ownerId` 的思路可以平移为 `boundSessionId`。

官方 README（`packages/experimental/agent-team/README.md`，2026-10-06 直读）对边界的自述：「turns **one coding session** into a small working team」——整支团队活在**一个**会话内（teammate 是会话内子 agent，fork/fresh 两种上下文），明确不支持「多个独立进程协调一个团队」。**这正是 TermFleet 跨成员会话级生态位的空档所在**（与 COMPETITOR-SCAN-1006.md 结论一致）。

### 2.2 社区对标：wowyuarm/dsh-agent-team 的 task↔session 关联

- 任务即 Thread：task thread 带 ref（`task:<uuid>` 格式，如 `task:0e47`）；issue #4（2026-09-04）/PR #5 记录了「简写 ref 解析」——agent 常给前 6 位 hex 简写，Host/Client 从精确匹配改为**前缀唯一即解析、歧义即拒绝并列候选**。展示层把解析成功的 Task ref 渲染为可点击链接（v0.1.8 release，2026-09-05）。来源：https://github.com/wowyuarm/dsh-agent-team/issues/4 （created 2026-09-04T08:56:24Z）、https://github.com/wowyuarm/dsh-agent-team/releases/tag/v0.1.8 （2026-09-05T15:03:57Z）
- 任务与工作的绑定点是 **Claim**（成员对 task thread 的在途声明），`team_view` 活跃段 = 在途 task thread + 在其上的成员 + 最新活动（v0.2.0，见 1.1）。
- 与官方不同的存储选择：成员是**独立 DSH 会话进程**（team-rooms 血统），会话身份用 `agent-team-<uuid>` 形态的 sessionId 持久化（见 §3）。**在「多个独立会话」这一点上它比官方更接近 TermFleet 的形态**。

### 2.3 Orca（stablyai/orca，★86k+）：任务↔worktree 绑定，**创建时预填 + 单字段改绑 + 状态同步 opt-in**

来源：README（2026-10-06 直读 https://github.com/stablyai/orca ）与官方文档 https://www.onorca.dev/docs/review/linear （2026-10-06 实读）。

- **绑定单位是 worktree**（每 agent 一个隔离工作树），不是抽象 session id：任务抽屉里 Linear/GitHub issues 合一展示，「Rows with an attached workspace open that workspace」——从任务行点开就是绑定的 workspace/agent 会话。
- **绑定时机**：从 issue 创建 worktree 时，Orca **预填名字并自动附带 issue ID**；建议分支名直接用作 worktree 分支。
- **改绑**：workspace 卡片「Edit Worktree Details」里有单一 Issue 字段（Linear chip 或粘贴 URL），**换绑不重建**；GitHub 与 Linear 共享这一个字段，存新链接替换旧链接。
- **状态同步是 opt-in**：「Linear status sync（worktree 创建时把 issue 移到 In Progress）是 opt-in per team」——**自动改状态默认关，绑定本身默认做**。
- 反向上下文：从 issue 启动 agent 时，issue 描述/评论/子 issue 的图片媒体自动进 prompt。

### 2.4 Linear：**ID 嵌入约定 + 三档 magic words + 状态自动化默认开**

来源：https://linear.app/docs/github （2026-10-06 实读）。

- **约定绑定**：issue ID（如 `ENG-123`）嵌入分支名 → PR 自动关联 issue；`Cmd/Ctrl+Shift+.` 一键复制含 ID 的分支名；`Ignore ENG-123` / `skip ENG-123` 显式退出。
- **三档 magic words（这是最值得抄的语义设计）**：
  - **closing**（fixes / closes / resolves / completes / implements…）→ 建立链接 **且** 合并时联动状态；
  - **non-closing**（ref / part of / contributes to / toward…）→ 建立链接、移动状态，**但**合并不动状态；
  - **relation**（relates to / related to）→ 只标关联，无任何状态联动。
- **状态自动化默认开**：PR opened→In Progress、merged→Done，按 team 配置可细到 drafted / review requested / ready for merge；反向「取消 issue 自动关其 closes 链接的 PR」。
- **展示**：PR 以 attachment 形式出现在 issue 上，内嵌 review 状态（审批者头像、in review 等）；已开放 PR 后补 ID 即可回链。
- 对 TermFleet 的启示：**绑定不是布尔开关，而是「引用强度」的分级**——强绑定（实时流+状态联动）/ 弱关联（仅引用）/ 仅提及，用户心智里本来就分这三档。

### 2.5 GitHub（Issues↔PR）：**keyword closing refs + Development 侧栏**

来源：https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue （2026-10-06 实读）。

- 自动：PR 描述/commit message 写 `Closes #10`（close/fix/resolve 族），**合并进默认分支才自动关闭 issue**（keyword 只在默认分支生效——非默认分支的关闭语义被抑制，防误关）。
- 手动：PR 或 issue 侧栏「Development」段选择关联（PR 侧最多 10 个 issue 且须同仓；issue 侧可跨仓、还可直接关联分支——**分支是比 PR 更早的绑定时机**）。
- 展示：关联 issue 显示在 PR 的 Development 段，「signaling to collaborators that someone is working on the issue」——**绑定本身就是「有人在做」的信号**，与 #40 的诉求同源。

### 2.6 范式提炼（横评）

| 维度 | 官方 dsh agent-team | wowyuarm agent-team | Orca | Linear | GitHub | TermFleet 可借鉴 |
|---|---|---|---|---|---|---|
| 绑定载体 | `ownerId: SessionId` | task thread ref（UUID+简写解析） | issue ID 附着于 worktree | issue ID 嵌分支名/标题 | issue 编号 keyword | **存 id、显名**；拒绝文本推导 |
| 绑定时机 | claim（进行中） | claim | **创建 worktree 时预填**+事后单字段改绑 | 分支/PR 创建时自动+事后补链 | 开分支起即可手动 | 创建任务时一键 + 事后可改绑 |
| 展示 | ownerName 运行时解析 | 活跃段（谁在哪件事+最新活动） | 任务行直接开 workspace；单 Issue 字段 | issue 上 PR attachment 内嵌 review 状态 | Development 侧栏 | 任务详情内嵌会话流+活跃徽标 |
| 状态联动 | revision CAS，无自动状态 | 无自动状态 | **opt-in**（默认关） | 默认开、三档强度 | 合并默认分支才关 | opt-in 回写 + CAS 防覆盖 |
| 失效语义 | release 清 owner | 无（ledger 永续） | 换绑替换旧链接（单字段） | 取消 issue 关 closes-PR；完成 issue 不关 PR | 非默认分支不误关 | 会话 ended ≠ 解绑；冻结可回放 |

---

## 3. dsh 会话身份语义

### 3.1 SessionId 是什么：branded string，唯一权威存于持久化 header

- 类型定义（`packages/core/session/src/types.ts`，2026-10-06 直读 https://github.com/deepseek-ai/deepseek-harness/blob/main/packages/core/session/src/types.ts ）：

```ts
export type SessionId = Branded<'SessionId'>
// "Brand a string as a SessionId" —— 不透明字符串，无结构语义承诺
```

- **稳定性锚点**：`docs/subsystems/session.md`（2026-10-06 直读 https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/subsystems/session.md ）：`get id(): SessionId` —「The session identity, **derived from its durable header's single copy**」。id 在创建时写入 header 单拷贝，运行时 getter 只是从 header 读——**不存在运行中改 id 的语义**。

### 3.2 跨重启稳定性：稳定，有正反两证

- **JSONL 持久化后端按 id 一文件**：`packages/session/session-persistence/README.md`（2026-10-06 直读）：「one append-only `.jsonl.zstd` log per session」「immutable canonical generation filenames per Session」；服务方法 `create(header) / open(id,'write'|'read') / stat(id) / list() / flush()` 全部以 id 寻址；`create` 撞已有 id 抛 `SessionAlreadyExistsError`，二次写打开抛 `SessionAlreadyOwnedError`。
- **反面证明（重启后同 id 复用是常态）**：wowyuarm/dsh-agent-team issue #14（2026-09-10，https://github.com/wowyuarm/dsh-agent-team/issues/14 ）——插件重启后对已持久化成员会话错误地走 `create` 路径，立即撞上 `SessionAlreadyExistsError: session "agent-team-6278a8f7-ab60-42db-ba4c-6308adf18f2e" already exists`。该 issue 同时实证：① 磁盘 id 形态可读（`agent-team-<uuid>`）；② 158 个 session 文件跨进程存活、`session/list` 全部可列出可解析；③ `stat(id)`/`open(id,'read')` 可直接验证存在性。**结论：会话 id 跨重启不变，持久化绑定可行。**
- **崩溃恢复不改 id**：`session-persistence/README.md`「Resuming and crash recovery」段——崩溃会话重启后由 agent-loop 读同一 stored log、补写合成 closers（`turn/end {interrupted}` 等）**继续用同一 id**。
- ⚠️ 但「列表」与「文件」可能短暂脱节：issue #23（2026-09-14，https://github.com/wowyuarm/dsh-agent-team/issues/23 ）——DSH 本体升级后「原本的 session 在页面列表上会丢失，但是 session 文件还是存在的」；根因是 0.1.7-alpha.1 换了会话日志 V4 消息来源契约（issue #33，2026-09-22）。**绑定要做「列表不可见 ≠ 会话不存在」的降级判断。**

### 3.3 插件可消费的会话事件与标识字段

- **`ctx.on('session/event', (session, event) => …)`**：事件信封带 `session.id`（SessionId）与 `event.seq`（SessionSeq，连续追加序号）。TermFleet 本仓已实证消费（`src/index.ts`：`ctx.on('session/event', …)` 记录 `{t, sessionId: session?.id, seq: event?.seq, type, brief}` 环形缓冲，P0 E2E 全绿）。
- 相关生命周期事件（`session-persistence/README.md`，2026-10-06）：后端路由 `session/event`（拷入写句柄）、`session/flush`（持久化屏障）、**`session/disposed`（会话终结 drain+关句柄）**——`session/disposed` 是「会话已结束」的最可靠上游信号，可作绑定失效事件的来源；另有 `ctx.on('session/created', s => s.id)`（本仓已在用）。
- **读侧**：`ctx.sessionPersistence.stat(id)`（存在性+revision+eventCount，不读日志）、`list()`（全量快照）；`session-query` 包提供独立读/工具访问（`packages/session/README.md` 包地图，2026-10-06）。错误词表含 `'session/not-found': { sessionId }`（`core/session/src/types.ts` 错误映射）——**绑定解析失败有上游标准错误可对照**。
- **格式版本**：现行 SESSION_FORMAT_VERSION=V4（v3→v4 迁移含 identity migration 与 generation-aware delivery validation，`packages/session/session-format-v3-to-v4/`，2026-10-06 目录核实）；wowyuarm 0.1.15 release（2026-09-24）印证 V4 让「会话记录带上产出方标识」。

### 3.4 会话 header 的可绑定字段（`core/session/src/types.ts`，2026-10-06 直读）

| 字段 | 含义 | 对 TermFleet 的用途 |
|---|---|---|
| `id: SessionId` | 会话身份 | **强绑定主键** |
| `createdAt: number` | 创建时刻（Unix ms） | 任务详情展示「绑定会话创建于」 |
| `cwd?: string` | 创建时绝对工作目录 | **弱匹配兜底**（现状 session-links 已用 cwd vs project 小写匹配） |
| `parentSession?: SessionId` | fork 来源 | 沿会话谱系找任务源头 |
| `isSeeded: boolean` | 是否含 fork 继承前缀 | 区分「续会话」与「新会话」 |
| `origin?: 'subagent'` | 子代理标记（明确注释：presentation metadata, not proof that the child is continuable） | **绑定时过滤子代理会话**，只允许顶层会话上任务 |
| `delegationDepth?: number` | 委派深度（顶层缺省=0） | 同上，数字版判据 |
| `agentPreset?: string` | 会话预设 | 成员卡展示「该会话用什么 preset」 |

- **会话标题**：`session-title` 服务提供「log-backed titles with a deterministic fallback」（首个/全部 prompt 两种 LLM 策略，`packages/session/README.md` Titles 段，2026-10-06）——任务详情里绑定会话的显示名可用宿主标题服务，不必自造。

### 3.5 未能核实

- **普通（人开）会话的 id 生成算法**：源码内 `Session.create(id, …)` 由调用方传入 id，id 的生成点在宿主装配层；GitHub 代码搜索（`randomUUID SessionId` 等，2026-10-06）未命中生成点，官方文档未写明格式。**仅能确认：branded string、无结构语义承诺、实证样例为 UUID v4 形态（`6278a8f7-ab60-42db-ba4c-6308adf18f2e`）。设计上应按「不透明字符串」对待，切勿解析其内部结构。**
- 官方独立文档站：未发现（文档以 deepseek-harness 仓内 `docs/` 为准）；npm 上 `@deepseek-ai/dsh` 的 readme 字段为空（2026-10-06 `npm view` 核实）。
- 0.2.1-alpha.1 是否进一步改动会话事件信封字段名：未逐行核对 release 全量 diff，**TermFleet 进 0.2.1 回归时应专项验证 `session/event` 信封形状**（与 NEXT-UPDATES.md 的 0.2.1 观察项合并）。

---

## 4. 对 TermFleet 绑定设计的启示

1. **绑定载体：存 sessionId，绝不存名字/文本（最高优先）**。任务记录增加显式字段（建议 `boundSessionId: string` + `boundMember: string` 双字段），配合官方同款「存 id、显名」分层——durable 数据只有 id，成员名/会话标题在渲染时解析（官方 `ownerId→ownerName` 先例，§2.1）。现状「project 文本 + cwd 小写匹配」降级为**兜底建议器**（无绑定时按 cwd 给候选），不再承担绑定语义。反例成本已被生态付过一次：nanmicoder #203 的 ASCII/Unicode 名字推导失配（§1.2②）。会话 id 跨重启稳定（§3.2），持久化绑定没有生命周期障碍。
2. **绑定时机：创建时一键 + 存续期单字段改绑（Orca 模式）**。成员端创建任务时默认携带「当前活跃会话 id」（成员机已知本机最近活动会话，P0 管道现成）；lead 端任务详情提供改绑/补绑入口——**换绑不重建任务**（Orca「Edit Worktree Details 单字段替换」先例，§2.3）。参考 Linear 的三档语义（§2.4）把关联做成分级：强绑定（看实时流）/ 仅关联（列会话链接）/ 弱匹配建议（cwd 候选），避免把「提了一句」误升为强绑定。
3. **展示与跳转：任务详情内嵌会话流，绑定状态常显**。详情页直接复用 P0 镜像管道（`sess-event` 帧已带 `sessionId+seq`，按 `boundSessionId` 订阅即可）；任务卡/列表加会话徽标三态：**活跃**（事件在流）/ **离线**（成员 presence 掉线但会话未 disposed）/ **已结束**（收到 `session/disposed` 或成员机 `event:'end'`）。参照 #40 落地形态在任务板顶层给 lead 一个「在途」视图：哪个人在哪件事上、最新活动时刻——人类版 team_view（§1.1）。标题显示用宿主 `session-title`，不自造。
4. **失效处理：ended ≠ 解绑，降级永远可见**。会话结束（`session/disposed` / 成员断开）后任务详情**冻结显示最后 N 条事件 + 「请求成员重开/续会话」入口**（成员侧 `agentLoop.resume` 同 id 续，§3.2 崩溃恢复语义支持），绑定关系保留供回放与审计；绑定 id 无法解析（对照上游 `session/not-found`）或不在 `list()` 时，按「列表不可见 ≠ 会话不存在」（issue #23 教训）先标记 stale 再弱匹配给候选，**绝不静默改绑**。健壮性红线（nanmicoder #188/#224 教训，§1.2）：绑定校验失败只降级为「未绑定」状态，错误不越出任务详情，不炸宿主步骤。
5. **（进阶，可后置）状态回写用 opt-in + CAS**。若做「会话事件反向推进任务状态」（如任务置 in_progress），学 Linear 默认 opt-in（§2.3/§2.4：Orca 默认关、Linear 可配），且任务并发更新带 revision CAS（官方 `expectedRevision` 先例，§2.1）——P1 先不做回写，只做「显示」，规避 #205 类「状态与实况不符」的信任问题。

---

## 附：本调研证据清单（均 2026-10-06 核实）

| 证据 | 来源 | 绝对日期 |
|---|---|---|
| 「谁在做什么」issue 原文 | https://github.com/wowyuarm/dsh-agent-team/issues/40 | 2026-09-27 提出 / 2026-09-29 关闭 |
| 落地确认 | https://github.com/wowyuarm/dsh-agent-team/releases/tag/v0.2.0 | 2026-09-29 |
| 任务状态脱节（含更正） | https://github.com/NanmiCoder/dsh-agent-teams/issues/205 | 2026-09-26（更正 2026-09-27） |
| 名字绑定失配 | https://github.com/NanmiCoder/dsh-agent-teams/issues/203 | 2026-09-25 |
| 多会话丢跟踪（生态外） | https://news.ycombinator.com/item?id=45559071 | 2025-10-12 |
| 会话重启撞 id（身份稳定反证） | https://github.com/wowyuarm/dsh-agent-team/issues/14 | 2026-09-10 |
| 升级后会话列表丢失 | https://github.com/wowyuarm/dsh-agent-team/issues/23 | 2026-09-14 |
| 简写 ref 解析 | https://github.com/wowyuarm/dsh-agent-team/issues/4 | 2026-09-04 |
| 官方 agent-team 类型/任务板源码 | https://github.com/deepseek-ai/deepseek-harness/tree/main/packages/experimental/agent-team | 主线 2026-10-06 直读 |
| Session 类型/错误映射 | https://github.com/deepseek-ai/deepseek-harness/blob/main/packages/core/session/src/types.ts | 主线 2026-10-06 直读 |
| 持久化契约 | https://github.com/deepseek-ai/deepseek-harness/blob/main/packages/session/session-persistence/README.md | 主线 2026-10-06 直读 |
| Session 子系统文档 | https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/subsystems/session.md | 主线 2026-10-06 直读 |
| Orca README / Linear 集成文档 | https://github.com/stablyai/orca · https://www.onorca.dev/docs/review/linear | 2026-10-06 直读 |
| Linear GitHub 自动化 | https://linear.app/docs/github | 2026-10-06 直读 |
| GitHub PR↔issue 链接 | https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue | 2026-10-06 直读 |
