# P1#5 调研：进度摘要推送（频控版）——lead 们到底想在哪一刻被打断

> 调研日期：2026-10-09。调研员：TermFleet 专项（所有来源均为当日实际核实，绝对日期随条目标注）。
> 功能定义：成员 dsh 会话状态迁移（干活中→等待输入→疑似卡住，另有完成）时主动推给 lead（面板弹条+IM webhook），同类事件 30 分钟内不重推。
> 调研目标：回答「lead 在什么时刻真的希望被打断、什么推送会被关掉」，而非罗列功能。
> 调研渠道说明：WebSearch 本轮额度受限（限额重置 2026-10-22），全部证据改经 GitHub API（issues/搜索）、官方文档 raw 源直读、npm registry 与 HN Algolia 核实；linux.do 照例被 Cloudflare 403 挡掉，跳过。

---

## 0. 结论速览

1. **生态内 IM 机器人只推两类事件，且都推得很省**：dsh-feishu-bot 全生命周期只推「审批卡」和「会话完成」两类（README 原文核实），还内置「对方正在忙就不推完成通知」的克制规则；它的 issue #2（2026-09-02）是本轮唯一的「推送噪音」实证——重复内容（占位消息+完成通知各带一份全文）是用户动手改掉的第一噪音源。**没有任何 dsh 生态 bot 推「卡住/闲置」**——这是空白也是风险（判不准就推，是噪音 supplier）。
2. **市场领导的默认推送集是「有人/有物在等你」**：Claude Code 官方 Notification hook 的事件词汇=permission_prompt（要权限）+ idle_prompt（答完 60 秒没人理）+ TeammateIdle（agent 队友即将闲置，agent-team 场景一等公民）；GitHub Mobile 的推送默认集=被 @、被指派、被求 review、被求部署批准——四项全是 action-required。**「等输入」是厂商们公认的默认推；「卡住」没有任何主流产品默认推（只推「闲置」这种可观测事实）**。
3. **成熟监控/CI 的降噪三件套可直接搬**：Grafana 分组三参数默认值 group_wait 30s / group_interval 5m / repeat_interval 4h；PagerDuty 官方建议关键服务用「5 分钟滚动分组窗口」+ 静默时段 suppress；Argo CD 通知目录 8 个触发器全部 opt-in、无任何默认订阅，连 on-deployed 都做了「每 commit 只触发一次」的去重。**共识：阈值触发的不确定性事件（失败/卡住）才值得推；过程性事件只进面板。**
4. **对 30 分钟频控的直接回答**：对「疑似卡住」合理（判定本身已等 10 分钟，30 分钟冷却防连击）；对「等待输入」**偏长且方向错了**——等输入的价值在分钟级时效，重推解决不了「lead 没看到」，正确做法是 feishu-bot 式「首次即推 + lead 未读时升级通道（弹条→IM→响铃）」，而不是 30 分钟后再来一条同样的。

---

## 1. 既有实证：dsh 生态里的推送机器人们实际怎么做的

### 1.1 dsh-feishu-bot：只推两类事件，还内置「忙时不扰」

- 来源：README（英文主版，`https://raw.githubusercontent.com/452926826/dsh-feishu-bot/main/README.md`，2026-10-06 核实；该插件 npm 现役、周下载 325，见 COMPETITOR-SCAN-1006.md 2026-10-05 记录）

实际推送的事件全集（逐条核实于 README）：

1. **工具审批卡**：tool 请求批准时推「工具名+理由+参数摘要」，且**只有发起该会话的聊天能 `/approve` `/reject`**；投递失败/超时→自动拒绝或转交其他审批通道。
2. **会话完成通知**：「After every conversation completes, the bot notifies the originating chat」；要广播给别的聊天须显式配 `FEISHU_NOTIFY_CHATS`（opt-in）。

两条降噪设计（原文）：

> 「A chat that is currently processing a message is excluded from completion notifications for other conversations, **avoiding interruptions**.」

→ **忙碌抑制**：你正在跟它对话时，其他会话的完成通知不进来。这是生态内已有的最接近「打断管理」的实践，TermFleet 可直接搬（lead 正围观某成员流时，该成员的 progress 不弹条）。

> 审批答复权限定在发起聊天 → **推送范围最小化**：宁可少推，也不推给无权答复的人。

3. **没推的东西同样重要**：全文档没有任何 stuck/idle/进度心跳推送——生态最成熟的 IM 桥判定「值得打断 lead」的只有两刻：**要你批准**和**干完了**。

### 1.2 dsh-feishu-bot issue #2：被用户亲手修掉的噪音长什么样

- 来源：`https://github.com/452926826/dsh-feishu-bot/issues/2`（2026-09-02 创建，open）
- 标题：「feat: reaction-based status indicator instead of placeholder message（用表情指示代替占位消息）」

痛点原文（body 摘录）：

> 占位消息原地更新流程，「会令聊天里出现**重复的最终回答**（原地更新后的消息与完成通知各含一份完整回复）」。改法：处理中=触发消息上 🤔 表情、完成=摘除 🤔 保留 ✅，「最终回答只发送**一次**」。

对 TermFleet 的映射：**「同一件事的重复内容」是 IM 推送被嫌弃的第一形态**——用户对「多」的容忍度低于对「迟」。状态迁移可以多条，但每条必须带新信息；过程性状态（干活中）一律用面板/表情类零成本指示，不占推送额度。

### 1.3 dsh-astrbot-ingress / astrbot_plugin_dsh：双向审批卡的第二证

- 来源：`https://www.npmjs.com/package/dsh-astrbot-ingress`（latest 0.3.23，README 2026-10-06 核实）+ `https://github.com/CCYellowStar2/dsh-astrbot-ingress`（2026-10-06 查 issues：0 条）
- 定位：AstrBot（QQ/OneBot 等）当 IM 网关、本机 dsh 当脑，聊天里发 `/dsh …` 直接驱动会话、从聊天答复审批。
- **诚实标注**：两仓库均 0 issues（`has_issues: true` 但无条目，2026-10-06）——「推送过噪/过疏」的抱怨在这个插件上**不存在可引用的公开记录**；AstrBot 主仓（41.6k★）也未检索到针对「agent 审批卡推送」的噪音讨论（未做穷尽式检索，仅关键词抽查）。IM 推送需求本身由其存在与持续发版（0.3.x 活跃）佐证，噪音抱怨证伪/证实均不可得。

### 1.4 tarocub（原生 DeepSeek Harness 插件）：审批卡「有界过期」与 30 秒插话窗

- 来源：`https://github.com/cloveric/tarocub` README（2026-10-06 核实；20★ 小样本，但它是唯一「原生 Harness 插件」形态的常驻 IM bot，特性粒度细）
- 三条可迁移设计（README 原文核实）：
  1. **审批卡=交互卡**：Lark Card 2.0 / Telegram inline buttons，`Stop and approvals | Interactive cards`——卡片承载动作，不靠文字轰炸。
  2. **审批卡「bounded expiry」**：`AskUserQuestion(background=true)` 的审批卡挂在后台任务上而非随回合消失，超时/终止时**主动作废**——卡不会无限期挂着等答复。
  3. **插话窗默认 30 秒**：mid-turn steering「default 30s, `/steer` to tune/disable/unlimit」，命中时**用 OK 表情回执**而非新消息——又一次「过程反馈走表情，消息额度留给状态迁移」。
- 完成信号惯例：「Codex consumes authoritative `turn/completed` summaries before any read fallback」——**完成用引擎的权威 turn 结束事件，不用启发式猜**。

### 1.5 dsh 生态 team 插件的「无声故障」抱怨：推送缺席的代价

「通知类」feature request 在两个 agent-team 仓库检索为 **0 条**（`repo:wowyuarm/dsh-agent-team notification` 0 命中；`repo:deepseek-ai/deepseek-harness notification OR idle OR bell` 0 命中，均 2026-10-06）——**没人求更多推送**；但用户大量抱怨的是「坏了/停了/等了却没人知道」，这些正是推送缺失的反面证据：

- `https://github.com/NanmiCoder/dsh-agent-teams/issues/172`（2026-09-16）：「member restriction aborted every member start on 0.1.5 (**silent idle/unspawned**)」——成员静默没孵化，面板无信号。
- `https://github.com/NanmiCoder/dsh-agent-teams/issues/171`（2026-09-16，open）：「record **why** a member dispatch was rejected」——派发被拒无记录=无声失败。
- `https://github.com/NanmiCoder/dsh-agent-teams/issues/205`（2026-09-26）+ 更正评论 #issuecomment-5847395498（2026-09-27）：成员回合失败被记成 completed、面板 18/18 全绿；更正后幸存的窄命题是「settlement 之后的失败有时不留任何记录」（后续修复 #206，2026-09-26）。**错误信号比没信号更糟**——推送系统判错状态（把干活报成卡住）会直接损失信任。
- `https://github.com/wowyuarm/dsh-agent-team/issues/40`（2026-09-27，已实现）：「谁在做什么」结构化信号缺失——前轮调研主证据，此处作为「面板承载观察、推送承载打断」分工的佐证。

---

## 2. 成熟产品范式：通知分级与降噪的既定惯例

### 2.1 CI/CD

**Argo CD Notifications**（官方目录，`https://argo-cd.readthedocs.io/en/stable/operator-manual/notifications/catalog/` 及源文件 `argoproj/argo-cd` master `docs/operator-manual/notifications/catalog.md` + `notifications_catalog/install.yaml`，均 2026-10-06 核实）

- 触发器全集 8 个：on-created / on-deleted / **on-deployed**（"Triggered **once per commit**"——官方在定义层就去重）/ on-health-degraded / **on-sync-failed** / on-sync-running / on-sync-status-unknown / on-sync-succeeded。
- **install.yaml（529 行）不含任何默认订阅**——全部触发器 opt-in，装了不响，用户自己挑。社区惯例：订阅 failed / health-degraded / deployed 三类，sync-running 基本没人订（过程事件）。
- 可迁移规则：①触发器分「结果类」（失败/成功/降级）与「过程类」（running），只默认推结果类；②「同类结果一次迁移只推一次」做成定义而不是事后补救。

**GitHub Actions**（`https://docs.github.com/en/account-and-profile/managing-subscriptions-and-notifications-on-github/setting-up-notifications/configuring-notifications`，2026-10-06 核实）

- Actions 的「workflow runs updates」是仓库 watch 定制的一项（用户自选事件类型）；**「默认只推失败、成功不推」的官方原文页本轮 404 未能核实原文**（见 §5），仅能核实 watch=按事件类型订阅的模型。
- 可核实的硬证据是 **GitHub Mobile 推送默认集**（同页原文）：Direct mentions / Assignments to issues or pull requests / Requests to review a pull request / Requests to approve a deployment——**四项全是「有人在等你动作」**，且同页提供 "schedule when GitHub Mobile will send push notifications"（推送时段表=静默时段是一等公民）。
- 可迁移规则：①「等 lead 动作」的事件默认推、且推到最打扰的通道；「agent 自己的状态流」默认只进面板；②静默时段做在**接收方偏好**里，不做在事件语义里。

### 2.2 工具类 bot 的状态变更推送

**Linear + Slack**（`https://linear.app/docs/slack`，2026-10-06 核实）

- **零默认推送**：team/project/personal 通知全部要用户逐级开启；订阅选项粒度到「issue 加入 / 完成/取消 / 两者」——状态变更推送默认只订「终态」。
- **内建去重**：「repeated mentions of the same issue ID in this thread within **60 minutes** won't generate additional replies」——同一对象短窗去重是产品级默认。
- 可迁移规则：①状态推送默认订「终态 + 需要你」两类，中间态不订；②按对象（成员×会话）设去重窗。

**Jira + Slack bot**：本轮官方文档页 404，未能核实其默认通知集（见 §5）——不引用、不臆断。

### 2.3 监控领域（对「单人 lead 带 N 个 agent」最可迁移）

**Grafana Alerting**（官方文档源 `grafana/grafana` main `docs/sources/alerting/configure-notifications/create-notification-policy.md`，2026-10-06 核实，逐字引用）：

- **Group wait：30 秒**（新告警组首条通知前的等待——给「成组」留窗口）；
- **Group interval：5 分钟**（组内再有变化，至少 5 分钟才发下一条）;
- **Repeat interval：4 小时**（组无变化时的重提醒周期——不是沉默，是低频重申）；
- mute timings 只能配在子策略上（根策略不可静默=默认态永不静默）；官方示例按 `cluster/namespace/severity` 分组，**critical 走 PagerDuty、其余走 Slack**——分级通道是官方推荐姿势。

**PagerDuty**（`https://support.pagerduty.com/docs/event-orchestration` 与 `/docs/intelligent-alert-grouping`，2026-10-06 核实）：

- Intelligent Alert Grouping：滚动时间窗（上限 3600 秒）内相似告警并案，incident 仅 24h 内可并；**官方 best practice：「For critical services, use the standard five-minute grouping window」**；其 DataOps 团队实测 incident 量 -37%。
- Event Orchestration：suppress（静默期不建 incident 不呼叫人，告警仍可见）+ suspend「N 秒后再触发」+ dedup_key 并发去重。
- 可迁移规则：①**5 分钟滚动窗**适合「成员×事件」并案（同成员 5 分钟内 waiting→stuck→waiting 只发一条摘要）；②重提醒（repeat）与静默（suppress）分开——深夜 suppress、白天 4h 一条「仍未处理」重申。

**对 TermFleet 的三家抽取（每家 2-3 条）**：

| 来源 | 可迁移规则 |
|---|---|
| Grafana | ①同组（同成员）事件 30s~5min 窗口并案；②分级通道：只有关键级进 IM/手机，其余进面板；③repeat_interval=4h 低频重申「还没人管」，而非永久沉默 |
| Argo CD | ①全部触发器 opt-in、零默认订阅，默认集要「少而硬」；②结果类才推、过程类进面板；③每迁移每对象只推一次 |
| PagerDuty | ①5 分钟滚动并案窗；②suppress（静默时段）与 dedup（并案）是两个独立机制；③错报有代价——分组宁可欠并不可过并（overgrouping 警告） |

---

## 3. agent 时代特有问题：「等输入」vs「卡住」的判别与完成信号

### 3.1 市场领导的答案：只推可观测事实，不猜「卡住」

Claude Code hooks 官方文档（`https://code.claude.com/docs/en/hooks`，2026-10-06 核实，逐字/逐条）：

- **Notification hook** 的既有词汇：`notification_type: "permission_prompt"`（example message「Claude needs your permission」）+ matcher **`idle_prompt`**——「**60 seconds after Claude finishes responding, and only if you haven't typed since** and no background agent…」→ 官方对「没人管」的定义是**可观测的「答完后 60s 无输入」**，配句子是「Claude needs your attention」，不是「Claude 卡住了」。
- **`TeammateIdle`：When an agent team teammate is about to go idle**——agent-team 场景把「队友即将闲置」做成一等 hook 事件。这是与 TermFleet 场景最同构的官方先例：**多 agent 系统里被推送的事件是「闲置/等你」，不是「卡住」**。
- 其余相关事件：`Elicitation`（MCP 工具要用户输入）、`StopFailure`（停止失败）、`SessionEnd`——失败/结束也有事件，不靠猜。
- 官方明确 Notification hooks 用于「forwarding the notification to an external service」——「推到 IM」就是官方设计的用途。

### 3.2 第三方 notifier 生态收敛出同一组事件（2026-10-06 GitHub 检索）

| 仓库 | 自述（README/description 原文） |
|---|---|
| blamechris/claude-code-notify | "get notified when agents go **idle or need permissions**" |
| Mick4994/claude-code-notify | "toast alerts for **permission prompts, idle, and task completion**" |
| lt-hu/claude-tg-notify | "**permission requests, questions, plan reviews and idle prompts**" |
| nikhil-pn/claude-smart-notifications | "notifies **when away, silent when focused**, **idle detection after 30s**. Toggle on/off" |
| darshankapashi/claude-notify | "notification when Claude Code goes idle" |

（均为 GitHub 搜索结果 description 原文，2026-10-06。）

收敛结论：**事件三元组 = 权限/提问（等输入）+ 闲置（可观测无活动）+ 完成**。注意两点：①「idle」判定窗从 30s 到 60s 不等；②最讲究的一个（claude-smart-notifications）把「用户在场」作为抑制条件——**在场时不推**。没有任何一个工具声称能判「stuck」——因为从外部看，卡住与「一个很长的合法工具调用」不可区分。

### 3.3 用户什么时候想要被打断（HN 实证）

- **Show HN: Agent Notify**（2026-01-28，`https://news.ycombinator.com/item?id=46794537`）OP：「I kept missing when Claude Code or Codex **finished a task** while I was grabbing coffee…When they complete a task **or need your input**, there's no notification — you have to keep checking the terminal.」评论（2026-02-01）：Codex 加了终端铃，「Not as ideal as a notification since **I don't know which terminal finished**. But already a huge improvement」——**多会话下推送必须带「是谁」**；另一条（2026-02-12）：9 种音色区分事件类型——**事件身份要在推送里可辨**。
- **Show HN: Vibora**（2026-01-02，`https://news.ycombinator.com/item?id=46464606`）OP：「telling Claude to work on a feature, **notify you when it's finished**, and getting that first notification 20 minutes later — you won't want to go back」——离场场景（合上笔记本）下，「完成通知」就是产品核心价值。
- **Show HN: agent-pulse**（2026-03-06，`https://news.ycombinator.com/item?id=47270638`）：把 agent 生命周期事件（Stop 等 hook）经本地网关 fan-out，per-client 过滤——「完成」以 **Stop hook** 为权威信号是多工具共同实践。
- 「agent 停了不知道」的生态内对应物即 §1.5 的三条 silent failure issues（silent idle/unspawned、dispatch 拒绝无记录、失败被记成 completed）——**用户的痛不是「推送太少」，是「状态错/状态缺」**。
- 未能核实：Reddit（old.reddit.com 反爬占位页）、linux.do（Cloudflare 403）——与 2026-10-06 前轮调研一致。

### 3.4 「等输入 vs 卡住」的判别，当前技术边界

- 「等输入」= **显式事件**（权限卡/提问/MCP elicitation），零误报，语义就是「lead 被等待」。
- 「卡住」= **启发式推断**（无输出 N 分钟）。TermFleet 现实现（`src/index.ts` 契约 H，2026-10-06 读码核实：TERMFLEET_STUCK_MIN 默认 10 分钟、TERMFLEET_WAIT_SECS 默认 30 秒、同类冷却 TERMFLEET_NOTIFY_COOLDOWN_MIN 默认 30 分钟）用「最后事件 >10 分钟无新输出」判 stuck——但长工具调用（构建、测试、长文件读写）天然静默，**误报成本是信任**（dsh #205 教训：状态报错比不报更伤）。生态内无人尝试判 stuck，头部产品全部退守「idle/teammate-idle」这种可观测陈述。
- 「完成」= 权威 turn 结束事件（Codex `turn/completed`、Claude Stop/StopFailure、tarocub 惯例），不需要启发式。

---

## 4. 对 TermFleet 推送设计的启示（可落地 5 条）

> 前提：TermFleet 已有契约 H（状态迁移才推、同类 30min 冷却、WAIT_SECS=30、STUCK_MIN=10、idle 不推）+ SOS/审批卡/member-join 推送。以下建议是对现状的校准，不是推翻。

**1. 默认推送集按「lead 被等待」排序：等待输入 > SOS/审批卡 > 完成 > 卡住 > 干活中（不推）。**
依据：Claude Code 默认集（permission_prompt/idle_prompt/TeammateIdle）、GitHub Mobile 默认集（四项全是 action-required）、生态 bot 只推审批+完成（§1.1/§2.1/§3.1）。成员**正开着权限卡等人**是 lead 唯一「不做就停摆」的时刻；「干活中」永不推（过程态，面板见）。

**2. 明确回答：「等待输入」更值得默认推；30 分钟频控只对「卡住」合理。**
- 等待输入=显式事件、零误报、时效价值分钟级——**首推零冷却，状态不变就不重推**；重推解决不了「lead 没看到」，应改为**未读升级**：弹条（7s 消失的现状改为 waiting 类常驻）→ lead 10 分钟未读才进 IM → IM 也未读 30 分钟后一条「仍在等待」重申（对齐 Grafana repeat_interval 精神，把 30min 冷却从「重推间隔」改造成「升级阶梯」）。
- 疑似卡住=推断、有误报（长工具静默）——判定已等 10 分钟，**30 分钟同类冷却保持**；文案必须带可证伪证据（「距最后输出 N 分钟 + 最后事件类型 + 一键看流」），让 lead 3 秒内自行判断真假，把误报成本压到「看一眼」而不是「白跑一趟」。
- 补充：成员 stuck→working→stuck 当日第 3 次起改摘要句式（「今日第 3 次疑似卡住」），对齐 PagerDuty overgrouping 警告——反复卡住本身是信号，逐条推就成了噪音。

**3. 内容纪律：一次迁移=一条新信息；过程反馈走面板/表情，绝不进 IM。**
feishu-bot issue #2 的教训（重复全文是头号被嫌弃对象）+ tarocub「OK 表情回执」：IM 消息额度只花在状态迁移上，推送内联「成员名+事件类型+一行证据+跳转链接」，永不发「还在干」类占位（HN 多会话抱怨：推送必须能认出「是谁+什么事」——成员名前置）。

**4. 忙碌抑制 + 按对象去重。**
搬 feishu-bot 原生规则：lead 正围观某成员会话流时，该成员的 progress/完成事件只进流内、不弹条不进 IM；同成员（或同会话）5 分钟滚动窗内多个状态迁移并成一条（PagerDuty 5 分钟 best practice），即「同类 30 分钟」之外再补一层「相邻 5 分钟并案」，先并案后频控。

**5. 静默时段做在 lead 接收端，默认不做「事件侧」过滤。**
GitHub Mobile 的 schedule 是先例：深夜「等待输入」可能正是成员独自加班被卡的时刻，事件侧静默会漏掉真实求助。做法：lead 偏好里设免扰时段（免扰内 IM 静音、面板弹条保留、SOS 永远穿透）；这是接收方偏好而非产品默认。另：完成信号用权威 turn-end/Stop 类事件，不要用「无输出」猜完成（§3.4）。

---

## 5. 未能核实（如实标注）

- **linux.do**：Cloudflare 403（`/search.json` 返回 "Just a moment..."），与前两轮（2026-10-05/10-06）一致，跳过。
- **Reddit**（r/ClaudeAI 等）：old.reddit.com 反爬占位页，未取得内容。
- **GitHub Actions「默认只在失败时邮件通知」的官方原文**：对应文档页本轮 404（docs.github.com 站点结构调整），仅核实了 watch 按事件订阅模型与 GitHub Mobile 推送默认集；该默认行为本轮**不作为引用证据**。
- **Jira + Slack bot 默认通知集**：Atlassian 官方文档页 404，未能核实，不引用。
- **GitHub 官方 Slack App（github/slack）的默认订阅特性表**：仓库检索无果（api 返回空），未能核实。
- **AstrBot / astrbot 系的推送噪音抱怨**：dsh-astrbot-ingress 与 astrbot_plugin_dsh 均 0 issues，AstrBot 主仓仅关键词抽查——「过噪/过疏」抱怨无公开记录可引（不等于不存在）。
- **通用新闻面**：受 WebSearch 限额影响未覆盖；本轮全部信号来自 GitHub API/issues、官方文档 raw 源、npm registry 与 HN Algolia，日期均为绝对日期。
