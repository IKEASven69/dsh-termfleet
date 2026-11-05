# 竞品第 5 扫（2026-11-05）：一个月后的团队层格局与下一轮功能输入

> 方法：npm registry 搜索（dsh-/session/team/handoff/remote/monitor/mobile/console 关键词）+ 目录站 7211 条快照（awesome-dsh-plugin plugins-2026-10-27.json，D:\coding\dsh-market\research\）按关键词归类 + 四家新对手 README 深读 + 本机 rc.5 实证（verify-xterm-key 5/5 + verify-p0 后台）+ 10-27 双线格局调研（hippo+takeover，memory 在案）复用。WebSearch 本轮零消耗（月配额 11-22 才重置，外部赛道以 10-27 两子代理扫描为底）。
> 上轮：COMPETITOR-SCAN-1006.md（第 4 轮）。本文只写增量与新结论。

## 一、上游动态（最大变量）：dsh 一个月三连跳

- 版本时间线：**0.2.1-alpha.2（我们验收基线）→ rc.5（用户 11-04 升级）→ 0.2.2-rc.1（npm 11-04 发布，现 latest）**，另有 0.2.2-alpha.3 在飞。
- **rc.5 服务包提升事故（11-04 实证）**：@deepseek-ai 服务包从 dependencies 提升遮蔽，用户名下 image-offload/openimage 两插件未激活——教训已入 [[dsh-sensenova-image 状态]]。
- **termfleet rc.5 实证（本轮）**：verify-xterm-key 5/5 全绿（插件激活+webServer 注入+鉴权+consent 库+PTY 全链+SSE+client 加载+原生终端+键入 E2E）+ **verify-p0 15/15 全 PASS exit 0**（TF-JOIN 配对/bus 双向/会话镜像/插话+ack/同意门三态/通知弹条/断开传播/跨机任务板/绑定生命周期/墓碑/摘要推送频控/信任通道/fleet 深度/查重——lead=:3180 member=:3181 双实例 HOME 隔离，临时目录已清）。躲过 rc.5 事故的原因=deps 只有 @lydell/node-pty+ws，不依赖 @deepseek-ai 服务包。
- **peer 声明现状**：peers 全 `*`（cordis/dsh-host-webserver）——守卫不会按版本线跳过我们=坏了会直接炸宿主面板而不是静默消失。0.2 稳定后建议收紧为实证过的范围线。
- watch：0.2.2-rc.1 昨日刚发，本机未升；升级后照例全量 E2E 回归（本仓已有四套件+键击套件，成本≈半小时）。

## 二、单人遥控红海：已卷到原生 App 级，termfleet 不回这条赛道

| 包 | 版本/热度 | 一句话 | 对 termfleet 含义 |
|---|---|---|---|
| dsh-remote | 0.8.72，★187/2.43万 dl（目录站 remote 类之王） | 连自己老牌 | 红海确认 |
| **dsh-console-plugin** | 0.5.64（11-04 活跃） | 手机扫码/6 位码连本机 DSH，配套鸿蒙 App「DSH控制台」；**一次性票据 5min 兑换即焚、异地配对、自带公网隧道** | 配对 UX（一次性票据）比 TF-JOIN 更细；单人面被打磨到 App 级 |
| **dsh-mobile-plugin（AI-HUB）** | 0.5.21（11-04） | **手机全功能端：审批卡在手机点、排队插话、Git/文件/插件市场/子代理打断**，出站隧道免公网 IP，可无头跑服务器 | 功能面与 termfleet 单机半边高度重叠（审批卡/插话都有），且是原生 App+隧道 |
| @zhangfengshun/dsh-remote-ssh | 2.4.44（11-03） | VSCode Remote-SSH 式远程开发（超算向） | 机器级，不同层 |

**结论**：单人"连自己"卷完了，别回去。termfleet 的差异层继续成立——**团队**（consent 握手/审计/信任/限时/共享板）在目录站 team 类 29 条里全是 0-3★ 玩具、官方 agent-team profile 仍停在 0.1.5-alpha.2（09-09 后未动）——「人对人 via 会话」生态位依旧空着。

## 三、任务板：三方供给变四方，linxin666 是唯一正面对手

**@linxin666/dsh-client-ui-task-board-team v0.4.15（11-04，全家桶 0.4.15 同日发）**：cloud team-hub 为中心——hub 给 dsh-agents 成员派 issue → 本机 lease 认领 → 宿主镜像卡执行 → 结算回 hub；**决策问题/评论/评审驳回可在团队与会话之间往返**。

- 追平项：任务↔会话关联（我们 P1#4）它有了；"决策问题回流会话"甚至超出我们（我们只有自由插话，没有任务起源的模板化提问）。
- 差异仍在：它是 **hub 云中心**拓扑（要 team-hub 服务），termfleet 是 **P2P 局域网总线**（无云、审计在本机、consent 限时）——目标场景不同（云端协作团队 vs 同一局域网办公室/自用多机）。
- **决策：任务板停止加码**，维持"够用+跨机广播"现状；不跟 linxin666 在任务功能上对线（三方供给本就无稀缺性，第 4 扫结论维持）。任务详情「向绑定会话发决策问题」记入观察，不排期。

## 四、IM/通道面

xmanrui/dsh-im v5.10（全渠道 IM）、dsh-wechat 0.16、zaofan/dsh-qqbot 1.11、dsh-roost——通道层供给充分且活跃。termfleet 自研薄桥定位不变（差异在审批卡语义：consent 状态机+回调门控，不是聊天管道）。可选优化（不排期）：IM 卡升级为结构化按钮卡（飞书 card action），替代"回复允许/只读/拒绝"文本——等真实 webhook 环境验收时一并做。

## 五、自己组合的邻位图（避免自我竞争，找咬合点）

| 线 | 层 | 与 termfleet 关系 |
|---|---|---|
| dsh-takeover | 运行态·异步单次接力（handoff:1 协议，九家 harness，npm 已发） | **黄金咬合**：termfleet 管"看着+实时插话"，takeover 管"异步交接"。详见提案 P1-1 |
| dsh-hippo | 记忆·偏好态（明星产品线） | 无直接重叠 |
| **dsh-team-memory** | 团队记忆：agent team 事件蒸馏 L1（私有）/L2（共享），跨成员互证晋升 | **缺事件源**——termfleet 总线的 sess-event/progress 帧是现成上游，接上=两线同时增值。详见提案 P1-4 |
| dsh-intelhub / dsh-life / whale-scout / openimage / opencli | 情报/居民/技能/图像/CLI | 无重叠 |

10-27 格局调研的战略结论可直接复用到 termfleet：**superagent-prototype（deepseek-ai 官方，18.3k★，DshExecutor 每 Ticket 独立 dsh session）官方明说域事件（eval.started/ticket.created）"目前无消费者"=钦点扩展点，且跨会话感知/presence 明确没做无路线图**；presence:1（会话感知协议层）查无先例。

## 六、名字与分发（证据变了，旧决策该翻案）

- **npm 名 `dsh-termfleet` 当前未被抢注**（registry 404 实查）。但 takeover 线刚吃过亏：PUBLIC 仓 README 公示名字一个月后被 zhukeu2 同日抢注，被迫发 @cold777/dsh-takeover。termfleet 仓是公开的且 README 用名一个多月了。
- 三条分发渠道都已就绪：①awesome-dsh-plugin 目录（收录=一个 yml 的 PR，bot 自动认领 npm 包补安装命令/下载量）②**dsh-plugin-shop-catalog（2026.1105.0，今天刚发的新目录包）**③官方「插件→发现」页读目录 index.json（jsdelivr CDN，0.2.1+ 原生）。
- 10-27 结论「品类拥挤、分发>堆功能」对 termfleet 同样成立：本仓功能全绿但 0 发布 0 收录。**翻案建议**：尽早占名发 0.1.0（发布清单 takeover 线已踩平：EOTP→用户终端 publish→2 分钟异步上线；README 双语+徽标模板现成）。用户 10-09 说"不急"——当时没有抢注事故也没有第三条渠道，证据已变。

## 七、结论与功能提案（输入 NEXT-UPDATES）

**P0（损伤性，先做）**
1. **rc.5 全量回归收尾**：xterm-key 5/5 已过，verify-p0 15 场景本轮补跑（结果回填本文）；0.2.2-rc.1 升级时照例四套件回归。peer 线从 `*` 收紧到实证范围。
2. **占名发布 0.1.0**（见六；发布即分发，README 双语模板 takeover 线现成）。

**P1（真增量，按"用户哪一刻会感谢"排序）**
3. **「⇄ 交接给成员」按钮（termfleet × takeover 咬合）**：成员卡/通道条上一键把该成员会话按 handoff:1 产卡进 ~/.handoff，TA 在任意机器任意 harness 取件接力。用户时刻：下班了 TA 的会话没跑完 → 交接给值班的人，不用守着也不丢。协议/收件箱/审查全是现成（协议本体在 agent-handoff 仓），termfleet 侧只是加一个出站按钮+卡片字段映射。顺带收口 10-27 遗留的 ~/.handoff 总线统一。
4. **superagent presence 桥（骑 18.3k★）**：消费官方原型钦点的无消费者域事件（eval.started/ticket.created）→ 成员卡/远程页出现"TA 的 ticket 在跑"感知卡 → 点进照常走会话镜像管道（每 Ticket 独立 session）。termfleet 顺势=superagent 生态缺失的 presence 层，互补非竞争。
5. **成员主权面（privacy-first 差异化）**：成员面板一屏看清「谁正在看我、什么权限、剩多久」+ 一键「结束所有被看」+ 信任开关前置。25+ 单人遥控包全在卷"我怎么看别人"，没人做"被看的人的主权"——这是团队层的天然卖点（企业采购友好），且审计页数据全现成，纯 UI+一个批量 end 路由。
6. **team-memory 事件源**：termfleet 总线帧喂 dsh-team-memory 蒸馏（L1/L2），自家组合协同零新协议。

**P2（观望/挂起不变）**
7. 手机面：console/mobile 两家已把单人手机面做穿，termfleet 跟进只剩"团队视图上手机"（lead 手机看全员+批卡）——需求实证弱（用户无公网、Tailscale 外无隧道），继续观望。
8. 挂起不变：成本接价目表（上游仍无数据接口）、回放切片、避坑库/审计页原生化、多成员流隔离（真双机）、IM 实发验证、B 机录屏（ACCEPTANCE-M1 #0-#10）。
9. better-sidebar 0.30.1（11-05 仍在动）+sparkelf 分叉出现：共存矩阵在 0.28 验证过，升版时 verify-coexist 照例重跑。
