# 竞品调研 · 第 4 轮（2026-10-06）

> 上轮调研：2026-10-05（COMPETITOR-SCAN-1005.md）。本轮仅隔 1 天，是快照式增量扫描，聚焦四问：A）dsh-team-rooms 有无新版/路线变化、做没做人对人功能；B）1 天内有无新团队协作类插件冒头；C）上游 dsh 0.2.0 正式版/新 rc/插件 API 变化；D）用户抱怨与需求信号（喂 P1 排序）。标注「本轮增量」处为与 10-05 结论的差异。

## 0. 一句话总览（本轮增量）

**dsh-team-rooms 已于 2026-10-05 宣布 RETIRED（官方 harness 收编 Agent Teams）——上轮标记的"最正面撞车"已退场；团队协作赛道主战场移交给官方 `dsh-experimental-agent-team` + 两个社区 agent-team 插件。TermFleet 的"人对人 via 会话"生态位在 dsh 生态内仍然无人占。**

## ① 问题 A：dsh-team-rooms——退役，而非迭代（本轮增量 ⚠️ 最大变化）

- **无新版**：npm latest 仍为 1.0.8（2026-10-05 11:09 UTC 发布），packument modified 停在 2026-10-05T16:34。来源：`https://registry.npmjs.org/dsh-team-rooms`
- **RETIRED**：GitHub 仓库描述改为 "RETIRED 2026-10-05 — the official DeepSeek Harness now ships the Agent Teams subsystem (dsh-experimental-agent-team)"；README 顶部墓志铭：兼容性更新自 2026-10-05 起停止。来源：`https://github.com/PerryLink/dsh-team-rooms`（pushed_at 2026-10-05T17:29Z），最后 5 条 commit 全是 10-05 的退役/release 文档
- 退役理由（README 原文）：官方 `dsh-experimental-agent-team`（+`-tool-agent-team`）已提供 implicit-root roster、**durable peer mailbox**、共享 **task DAG**（compare-and-set 更新）+ Web 投影；dsh-base bundle 默认**禁用**，需 profile patch 启用
- 作者自认的差异化残余：team-rooms 能做"**协调独立进程中的多个独立会话**"（native 子系统做不到），但 589 周下载撑不起兼容维护成本
- **没做人对人功能**：通读 README 与 release 记录，没有会话流镜像/插话/邀请码入队等任何"人对人"特性——它是 agent 房间（每个 member 是一个独立 DSH 会话进程，房间是它们之间的持久共享对象）。**对本项目威胁解除**
- 周下载 589（窗口 2026-09-28~10-04，`https://api.npmjs.org/downloads/point/last-week/dsh-team-rooms`），较上轮引用的 522 微升（爬升已停滞，退役后预计走低）
- README 点名推荐的社区替代：`@nanmicoder/dsh-agent-teams`（约 1.3 万周下载），但**其 peer 声明止步 0.2.1 以下，宿主兼容守卫在 0.2.1-alpha.1 上会跳过它**（除非用户手工加豁免）

## ② 团队协作赛道全景（2026-10-06 快照）

### 官方收编（本轮增量）

- `@deepseek-ai/dsh-experimental-agent-team` 0.1.5-alpha.2（2026-09-09）：roster + durable peer mailbox + 共享 task DAG；配套 `-tool-agent-team`（模型面工具）、`-client-ui-agent-team`（**Web 端 roster + 任务板 + 队友导航**）、`-agent-team-web-profile`（Web profile 层）。周下载约 32 万（随 dsh bundle 分发）。来源：`https://registry.npmjs.org/@deepseek-ai/dsh-experimental-agent-team`
- 判读：**"AI-agent 团队 + 任务板"成为官方能力**，任务板在 dsh 生态内的稀缺性进一步归零（官方投影 + linxin666 3.5 万/wk + nanmicoder 1.3 万/wk 三方供给）

### 社区 agent-team 系（agent 对 agent，非人对人）

- `@nanmicoder/dsh-agent-teams` 0.1.22（2026-09-29，周下载 13273，生态最强社区团队插件）：captain/members/带依赖任务/消息；targeting 0.2.0-rc.2；release: `https://github.com/nanmicoder/dsh-agent-teams/releases/tag/v0.1.22`
- `@wowyuarm/dsh-agent-team` 0.2.1（**2026-10-06 当天发布**，周下载 902）：持久 agent 团队；0.2.0（9-29）认证基线移到 dsh 0.2.0-rc.1；`team_view` 列出在途 task thread（谁在哪件事上、最新活动）。来源：`https://github.com/wowyuarm/dsh-agent-team/releases`
- `dsh-team` 0.2.11（2026-09-30，453/wk，无新版）；`@yangdcm/dsh-expert-team` 1.5.3（9-27，802/wk，角色化数字员工团）
- **都是 agent 间协作；无一家做同意握手/限时授权/审计的"人对人接管"**

### 侧面逼近（本轮增量，上轮未覆盖）

- **`dsh-team-hub` 0.2.7（2026-08-28，周下载仅 48，休眠）**——概念上离 TermFleet 最近的人向插件：把单用户 dsh Web 实例变成局域网团队服务——用户名/密码登录、Admin/Member/Disabled 角色、**按成员工作区与会话隔离**、RPC 默认拒绝、**WebSocket 逐帧过滤**、Admin 控制台、**结构化审计日志**。它做"多人安全共用一个 dsh"，TermFleet 做"多人各自 dsh 的协同驾驶舱"——互补但抢"团队治理"心智。休眠近 6 周，暂无威胁。来源：`https://github.com/zhoujianbin/dsh-team-hub`
- **`dsh-ui-auth` 0.7.0（2026-09-30，477/wk）**：Web UI 认证网关——**邀请码注册**、TOTP/Passkey、REST+WebSocket 逐用户隔离、JSONL 审计日志、用户管理面板。把"邀请码+审计+多用户隔离"做成了单机访问层标配。来源：`https://github.com/0QwQ0/dsh-ui-auth`
- **baixianger 跨主机栈**（全部 9-14 发版，各 300~370/wk）：`dsh-weave`（Iroh mesh，加密 peer 发现 + **远程会话投递**）、`dsh-chat`（跨主机会话群聊 @mentions）、`dsh-bridge`（本机跨会话消息+审计）、`dsh-network`（LAN/Tailnet/公网接入+配对 QR）。是**基础设施层**（会话级消息有总线了），但 9-03 issue 报告 dsh-chat 在当前 DSH 无法启动；另有 huahua-dsh-chatroom 专门给该栈打补丁——脆弱。来源：`https://github.com/baixianger/dsh-weave`
- **IM 桥**（验证双向 IM 需求，均单用户）：`dsh-feishu-bot` 0.19.16（8-25，325/wk）飞书双向+**scoped tool approvals**；`dsh-astrbot-ingress`（QQ，可从聊天答审批）。来源：`https://github.com/452926826/dsh-feishu-bot`
- **dsh 之外**：`iops-rooms` 0.7.4（10-05，2778/wk）"看谁建了你的项目、哪个 AI 帮了忙，共享团队状态与 AI 配置（Claude Code/Codex/Cursor）"——**人向团队 AI 状态共享**在通用生态冒头且增速快，值得作为定位参照。来源：`https://www.npmjs.com/package/iops-rooms`

### 上轮对手现状核对

- `@linxin666/dsh-client-ui-task-board`：仍 0.4.5（2026-10-05），周下载 35448——体量是 team-rooms 的 60 倍，任务板基本盘
- `dsh-better-sidebar`：仍 0.24.1，57806/wk，生态顶流不变

## ③ 问题 C：上游 dsh——0.2.0 正式版未发，0.2.1-alpha 已带破坏性变更（本轮增量）

- **npm dist-tags**：`latest=0.2.0-rc.2`（2026-09-29）、`next=0.2.0-rc.2`、`alpha=0.2.1-alpha.1`（2026-10-03）。**0.2.0 正式版截至 2026-10-06 未发布**。来源：`https://registry.npmjs.org/@deepseek-ai/dsh`
- **GitHub 新 release：dsh-v0.2.1-alpha.1（2026-10-03）**，与 TermFleet 兼容面相关的变更：
  - **破坏性：移除运行时 invariant 插件及各包 `./invariant` 导出**（依赖这些诊断入口的扩展/自定义 profile 需调整）
  - **破坏性：输入区统计扩展拆为 `activity` 和 `usage` 两个独立入口**，覆盖旧 `stats` 整行的插件必须更新注册 ID
  - **自动化任务（cron）改为 Web 内置能力**——生态内独立 automation 插件（如 michengai/dsh-automation 4003/wk）被上游吞掉，是"官方收编社区插件"的第二个实例（第一例=Agent Teams 收编 team-rooms）
  - 子路径插件不再读取独立 `package.json`（显示文本/图标须经子路径导出）
  - 新增实验性 Claude Code Mods 兼容层；`--public-url` 支持带路径前缀的反向代理；开发者工具组合包（会话原始日志+双向定位）
  - 来源：`https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.1-alpha.1`
- **兼容守卫新行为（来自 team-rooms 退役说明）**：宿主会因 peer 声明止步于某版本线而**跳过加载**插件（nanmicoder 在 0.2.1-alpha.1 上被跳过）——TermFleet 的 peer 范围须覆盖 `>=0.2.0-rc.1 <0.3`，否则 0.2.1 线用户会被静默跳过
- 上游 commit 活跃（10-03 为最新 release commit），官方 Agent Teams 仍标 experimental 且默认禁用——**"何时转正/是否默认启用"是下一个需要盯的上游事件**
- 生态事件（本轮增量）：**dsh Desktop（macOS/Windows）2026-10-02 上 HN 首页（416 分）**——桌面端内置插件管理与 dsh 命令，装机会进一步放大插件分发。来源：`https://hn.algolia.com/api/v1/search?query=deepseek%20harness`（created 2026-10-02）

## ④ 问题 D：用户抱怨与需求信号（喂 P1）

> 通道说明：npm/GitHub/HN 已核实；**linux.do 未能核实**（Cloudflare 403 拦截匿名 JSON 读取，`https://linux.do/search.json` 返回 "Just a moment..."；通用 WebSearch 本轮额度受限）——本节信号全部来自 GitHub issues 与 release/README 文本，日期均为绝对日期。

1. **"谁在做什么"的实时可视是硬需求**：wowyuarm/dsh-agent-team issue（2026-09-27，已实现）要求 team_view 增加"活跃 task thread"段——"让 agent 能看到当前谁在做什么、避免骑在他人在途工作上"。人类版对应物就是 TermFleet 的会话流镜像+任务↔会话强关联。来源：`https://github.com/wowyuarm/dsh-agent-team/issues`
2. **共享状态健壮性是慢性痛点**：nanmicoder issue（2026-10-04，open）"损坏的 team.json 使 SyntaxError 从全局钩子抛出，劫断宿主步骤"；wowyuarm bug（2026-10-06）"WAL 未 checkpoint，只备份 sqlite 会拿到陈旧账本"。教训：TermFleet 的共享任务板/审计存储必须做损坏容忍（单条损坏不拖垮宿主）+ WAL 感知备份
3. **自定义与扩展性抱怨**：nanmicoder issue（2026-09-29，open）"团队和团队成员似乎不能自定义"——团队模板/角色自定义是未满足需求
4. **分发与版本线摩擦剧烈**：nanmicoder 连续多条 "[dsh-plugin.org] plugin distribution incomplete/install failed" issue（2026-09-30~10-03）；peer 版本线不覆盖新 host 即被守卫跳过。教训：发布渠道冗余（npm+GitHub prebuilt）与 peer 区间宽覆盖是存活条件
5. **配对/邀请码已是生态标配**：dsh-ui-auth 邀请码注册、dsh-remote-link 的 QR+HMAC 一次性配对、dsh-palm 扫码配对设备信任——TF-JOIN 的邀请码入队符合用户习惯，**差异化必须落在"同意握手+时限+审计"而非配对本身**
6. **审计需求在升格**：从简单 JSONL 审计（dsh-gov、ui-auth）进化到哈希链收据（qiushi-dsh-evidence-audit，2026 年内条目）——TermFleet 审计日志可借鉴哈希链防篡改，成本低、话术强

## ⑤ dsh 之外的团队驾驶舱赛道

- **Orca（stablyai/orca）★86673，2026-10-07 仍活跃**：单人多 agent ADE 霸主，依旧无团队协作层（上轮 ★85.4k → +1.3k/天）。来源：`https://github.com/stablyai/orca`
- 出现 Orca 分叉/周边生态（ripperos-ade fork、Railway 部署模板、Nix flake）——单机 ADE 赛道拥挤，团队层空白依旧
- agent-relay / iops-rooms 等"团队 AI 状态"工具在 dsh 之外生长（见 ②），**"人对人 AI 协作治理"仍是跨生态空白**

## 对 TermFleet 的启示（含 P1 排序建议）

1. **定位话术立即更新**：上轮的"最正面竞品 team-rooms 已退役"，且官方已收编 agent 团队+任务板——所有对外材料应把 TermFleet 定义为"**人对人、跨成员、经同意的会话级驾驶舱**"，与官方 Agent Teams（agent 对 agent）划清边界；甚至可规划与 native Agent Teams 的展示互通（把成员的 agent-team roster 映射进面板）而非对抗
2. **P1 排序建议：任务↔会话强关联 ↑、摘要推送 ↑↑、向量查重 →、切片 UI ↓**。理由：任务板单拎已无稀缺性（官方+linxin666+nanmicoder 三方供给），强关联与"谁在做什么"实时状态是验证过的未满足需求（④-1）；IM 双向需求被 feishu-bot/astrbot 的审批卡验证，TermFleet 的跨成员摘要推送+审批闭环是生态空白，性价比最高；向量查重维持原优先级；切片 UI（单机长任务场景）离团队场景最远，降级
3. **0.2.1 线兼容回归提前做**：0.2.1-alpha.1 两条破坏性变更（invariant 移除、stats 拆分）+ 守卫按 peer 线静默跳过插件——本周内自查 TermFleet 是否注册 stats/invariant 入口，peer 区间放开到 `<0.3`，否则 0.2.1 用户会"装了没反应"
4. **健壮性即卖点**：共享状态损坏容忍（坏一条不炸宿主）、WAL 感知备份、哈希链审计收据——三件都是竞品 issue 里用户真踩过的坑（④-2、④-6），成本低且直接强化"治理型"人设
5. **盯两个上游事件**：官方 Agent Teams 转正/默认启用的时间点；自动化任务被收编后是否还有下一个"官方吞并"对象（若官方做跨成员/远程，才是真正的红警报——目前所有迹象都指向单用户边界内）

## 与上轮结论的差异（本轮增量小结）

- 上轮："team-rooms 是最正面撞车，需持续观察" → **本轮：已于 10-05 退役**，官方收编，威胁解除
- 上轮："0.2.0-rc.2 是最新" → **本轮：0.2.1-alpha.1（10-03）带两条破坏性变更 + 守卫按 peer 线跳过插件**
- 上轮未覆盖：dsh-team-hub（休眠的人向团队网关）、dsh-ui-auth（邀请码+多用户隔离标配化）、baixianger 跨主机栈、IM 审批桥双证、iops-rooms（dsh 外人向团队 AI 状态共享）
- 未变：Orca 无团队层；"人对人治理型远程协作"dsh 生态内仍无人做
- 未能核实：linux.do 社区讨论（Cloudflare 拦截）；WebSearch 额度受限，通用新闻面覆盖不足，建议下轮补
