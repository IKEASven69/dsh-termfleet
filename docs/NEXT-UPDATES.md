# TermFleet 下一步进化路线（2026-10-05，按用户价值排序）

> 原则：每项都回答"用户哪一刻会感谢这个功能"。排除自嗨项（不做就没有人注意的）。

## P0 —— 补齐核心承诺（"远程操控成员的 dsh"的真身）

### 1. 会话流镜像 v1 ✅ 已落地（2026-10-07，E2E 全绿）
- **用户时刻**：lead 打开面板 → 看到成员正在用的 dsh 会话**对话流实时滚动**（他问了什么、agent 在干什么、卡在哪）→ 需要时输入框插话 → 成员的 dsh 里实时出现
- **为什么是 P0**：这是产品名里"远程操控 dsh"的真身。现状只有 pwsh 探针+命令写入，用户看不到成员的 dsh 在干什么——这是上轮用户指出"理解错了"的核心
- **技术底子（全已验证）**：成员机 listener 收全量会话事件（seq 级）+ agentLoop.followup 写入 + 总线 SSE 中继
- **✅ 实测结论（2026-10-07 verify-p0.mjs 六场景全 PASS，exit 0）**：成员真 dsh 会话（termfleet-m0-probe-*，假 provider 零 API 费）write→echoSeq=8（97ms）；ro 同意激活期间会话事件按契约 A 上行，lead 面板用户气泡 99ms 出现、助手气泡 +412ms（user→assistant 顺序正确，面板共 17 条气泡）；插话经 rw 通道下发后成员会话 seq=21 回显含插话原文、回执「✓ 已送达（followup）」421ms（契约 C lastFollowupAck={ok:true,via:'followup'}）；同意门三态全对（无同意 403 no-consent / ro 流可见但插话 403 readonly-channel+输入框禁用 / rw 插话通）；S6 成员机主动断开跨总线传播（lead 流即时收 event:'end'、lead 同意库同步 ended、重连 403）。截图 p0-1~p0-5 存 docs/audit/screens/，验收记录见 docs/audit/P0-ACCEPTANCE.md

### 2. 成员端零配置接入（TF-JOIN 一句话入队 ✅ 已落地；市场安装+首启引导仍开放）
- **用户时刻**：新成员"装好插件填个码就能被连"，而不是 clone 仓库+npm install+改三行配置
- **做法**：`dsh plugin --profile web add github:IKEASven69/dsh-termfleet`（独立仓已就绪）+ 面板内配对向导（填 lead 地址+团队码，保存即连）——现在配对 UI 已有，缺的是把"插件安装"这条路走顺 + 首次启动引导
- **✅ 实测结论（2026-10-07）**：TF-JOIN 粘贴即配对已通——lead 面板「取码」得 TF1-码（len=115），member 面板仅粘贴该码点「入队」→ toast「已加入」→ 2045ms 内 lead 面板成员列表出现 P0-MEMBER（API /fleet 实证）；配对前 member 实例 role=off（启动 env 无 ROLE/LEAD_URL/TOKEN，排除假配对）。码格式与解析见 decisions「契约 D」
- **仍开放**：插件市场安装路径（`dsh plugin add`）与首次启动引导

### 3. 通知闭环（被连时一定知道）✅ 面板弹条已落地（2026-10-07）；系统通知（可选）仍开放
- **用户时刻**：lead 发起连接 → 成员**无论在干啥都能知道**：dsh 内弹条（面板 DOM notify）+ IM 卡（已通）+ 系统通知（可选）
- **现状缺口**：成员在忙自己的会话时，连接请求只在 TermFleet 面板里，容易错过
- **做法**：client 半注册 dsh 通知槽位（0.2.0 有 notification surface 待查）+ 有请求时宿主弹条
- **✅ 实测结论（2026-10-07）**：契约 E 生效——lead 面板 tf-notify 弹条实测 DOM：member-join「P0-MEMBER 上线」、consent-request「me 请求连接 sess → member:P0-MEMBER」带「去处理」按钮（hasGo=true），7s 窗口内截图 p0-4-tf-notify.png 留存；成员侧同意卡（ro/rw）同轮实测出现（p0-5-*.png）。事件种类与下发通道见 decisions「契约 E」

## P1 —— 让日常使用顺手

### 4. 任务↔会话强关联
- 创建任务时"绑定当前会话"；lead 的任务详情里直接看该会话实时流（和 #1 共用管道）
- 现在是项目名文本弱匹配，升级为显式绑定 + 弱匹配兜底

### 5. 进度摘要推送（频控版）
- 成员卡住/完成/等审批 → 推 lead IM（现在只有 SOS 推）——频控：同类事件 30 分钟内不重推
- 数据源已有（summarize），缺推送触发器

### 6. 快捷操作面
- lead 常用动作一键化：一键"请求+默认允许"（对已信任成员）、一键"看某成员最近会话摘要"

## P2 —— 体验深化（不急但值得记）

- 面板原生化（iframe → slots React 组件，主题/导航全原生融合；0.2.0 rightbar 布局研究）
- 成本接 dsh-cost-meter 价目表（当前只有操作数/时长估算）
- 接管回放升级：按审计事件切片跳转
- 封印 manifest（归档防篡改，unified-board 对齐收尾）
- 向量查重（hippo 向量能力接入，新建任务查重）

## 明确不做（YAGNI）

- 屏幕流远程桌面（已出列：隐私边界+生态已有）
- 公网 relay（用户定调：局域网为尽头）
- AI-to-AI 协作（team-rooms/dsh-team 的领域，不抢）

# 愿望机原则（2026-10-07 用户定调，路线总纲）

**用户最简化操作实现最高级功能；agent 时代愿望机需求愈发强烈。**

市场佐证（2026-10-07 实测）：Orca 17 天 ★70k→86.6k（+21%）多 agent 品类爆发；dsh 月下载 189 万；官方 agent-team 周下载 32.5 万（多 agent adoption 巨大）——这批用户接下来必然撞上「怎么管人的舰队」。

套用到 TermFleet 的形态转变：
- 成员接入：clone+npm+改配置（运维操作）→ **邀请码一句话入队**（lead 生成 TF-JOIN 码=base64(url+token)，成员面板粘贴即自动配对上线 ✅ 已落地；进阶：dsh 会话里自然语言「加入张三舰队 XXX」插件监听自动配对，未做）
- 连接成员：面板选人→请求→等同意 → **「看看王五」一键/一句话**（信任成员跳过握手或自动握手）
- 配置界面从必经之路降级为手动兜底

# 顺序建议

**#1 会话流镜像 ✅ → #3 通知闭环 ✅（面板弹条）→ #2 零配置接入 ✅（TF-JOIN，市场安装仍开放）→ #4 强关联 → #5 推送**——#1 是产品成立的根，#3 是使用前提，#2 是分发前提。全部做完后 TermFleet 才算"远程操控成员 dsh"的完整闭环。下一顺位：#4 任务↔会话强关联。
