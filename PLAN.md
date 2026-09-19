# dsh-termfleet · 主计划（开工前筹备 v1 · 2026-09-19）

> **定位一句话**：纯 dsh 插件形态的团队驾驶舱——lead 与成员同装一个插件，获得跨成员的远程桌面围观、终端/DSH 会话接管、IM 审批、任务面板与团队记忆，全部动作过统一同意/审计总线。
> 生态调研与决策依据：`D:\coding\termfleet-heimdall\docs\DSH-ECOSYSTEM-SCAN-0918.md`（唯一权威调研版）。
> 立项条目：`D:\coding\docs\needs\dsh-termfleet.md`。

---

## 1. 已定决策（D1–D10，均有调研背书）

| # | 决策 | 依据 |
|---|---|---|
| D1 | **纯 dsh 插件**，lead/成员同装，出站 WS 星型连 lead 插件端点；不依赖 Orca/任何外部 app | 用户定调；Orca fork 为另一独立项目线，两线不混（2026-09-19 纠偏） |
| D2 | 包名 **`dsh-termfleet`** | dsh-market 命名惯例（dsh- 前缀可发现性） |
| D3 | 五件套（操控面）：远程桌面 / 远程操控(dsh+CLI) / IM / 任务面板 / hippo 记忆 | 用户确认 2026-09-19 |
| D4 | 六缺口（感知/交付面）：进度汇报流 / 成果 diff / 会话转交 / 求助按钮 / 接管回放 / 成本面板（+熔断、权限分级） | 同上 |
| D5 | **统一同意/审计总线**是唯一从零核心**：握手卡(允许/只读/拒绝)·限时·角色·全量审计·配对(邀请码→设备令牌)**；桌面与终端共用同一张卡、同一个断开按钮 | 25+ 红海包全是"连自己"，他信治理空白 |
| D6 | 工作量三档：**装上即用**（hippo/dsh-connect/dsh-plugin-desktop）｜**要写有底**（屏幕流抄 dsh-remote-desktop 先例、PTY 接管搬 termfleet worker.mjs、面板移植 webapp 现成实现）｜**从零**（仅总线） | 2026-09-19 口径澄清 |
| D7 | IM 不自研：dsh-connect（多渠道）/审批卡动线参 dsh-reach | 生态成熟过剩 |
| D8 | 远程操控范围：dsh 会话（插件/宿主 API）+ 插件自托管任意 CLI（PTY host，worker.mjs 思路） | 用户需求"操控 cli" |
| D9 | 团队记忆层：个人层=hippo 原样（~/.hippo 私有）；共享层=git 仓 + hippo federation 盯目录（待 M0 验证） | hippo federation 是跨 agent 文件同步，恰好可复用 |
| D10 | 成员机零入站端口；跨网场景自建 relay（M2 后）；传输局域网 WS、M3 前决定是否上 TLS | worker.mjs 安全基线延续 |

## 2. 最终架构图（三色工作量标注）

```mermaid
flowchart TB
    subgraph LEAD["① Lead 侧 = dsh + dsh-termfleet 插件（桌面壳可选·面板同屏）"]
        direction LR
        subgraph CTL["操控面面板"]
            FLEET["Fleet 视图<br/>成员×任务×操控入口"]
            TASKS["任务面板<br/>派活/跟进/验收"]
            DESKV["远程桌面观看<br/>只看/可操作"]
            TAKE["接管终端<br/>限时·留痕"]
        end
        subgraph SENSE["感知面面板"]
            PROG["进度摘要流+事件推送"]
            DIFF["成果 diff 视图"]
            REPLAY["接管回放"]
            COST["成本面板"]
        end
        AUDIT["审计时间线"]
        PANIC["紧急熔断·一键断全队"]
    end

    subgraph BUS["★ 统一同意/审计总线（从零自建·唯一核心）"]
        CONSENT["同意握手卡<br/>允许/只读/拒绝·随时断开"]
        PAIR["配对：邀请码→设备令牌"]
        POLICY["策略：角色·限时·范围·权限分级"]
        ALOG["审计日志·全动作"]
    end

    subgraph MEM["② 成员侧 = dsh + 同一插件（全部出站 WS）"]
        GATE["同意门<br/>桌面/终端同一张握手卡"]
        SOS["求助按钮<br/>呼叫 lead 围观"]
        SCREEN["屏幕流被控端"]
        PTYRELAY["会话中继<br/>dsh 会话/自托管任意 CLI"]
        HANDOFF["会话转交<br/>人走活不断"]
    end

    subgraph ECO["③ 生态件·装上即用（零代码）"]
        HIPPO["hippo 记忆引擎"]
        IMBR["dsh-connect IM 桥"]
        DESK["dsh-plugin-desktop 壳"]
    end

    SHARED["团队记忆仓<br/>git + hippo federation 盯目录"]
    IMC["IM 云：飞书/微信/钉钉<br/>成员手机·审批卡聊天答复"]

    TASKS -->|"A 派活"| PTYRELAY
    FLEET -->|"B 请求围观/接管"| CONSENT
    SOS -->|"B' 反向求助"| CONSENT
    CONSENT --> GATE
    GATE -.->|"人不在电脑前"| IMBR --> IMC
    IMC -.->|"聊天答复"| IMBR
    GATE -->|"同意·只看"| SCREEN -->|"屏幕流"| DESKV
    GATE -->|"同意·可操作"| PTYRELAY <-->|"双向流"| TAKE
    PTYRELAY -.->|"进度/完成/卡住事件"| PROG
    PTYRELAY -.->|"git diff"| DIFF
    TASKS -->|"C 验收"| HIPPO
    HIPPO -->|"D 蒸馏卡点/解法"| SHARED
    SHARED -->|"E 新成员开局注入"| HIPPO
    ALOG --> REPLAY
    ALOG --> AUDIT
    CONSENT & GATE & SCREEN & PTYRELAY -.-> ALOG
    MEM ===|"出站 WS：局域网直连 lead 端点；跨网自建 relay"| BUS
    POLICY -.-> CONSENT
    PANIC -.-> BUS

    classDef zero fill:#e6f9f2,stroke:#0b8a66
    classDef port fill:#fff3e0,stroke:#b4740a
    classDef core fill:#ffe9e9,stroke:#d64545
    class HIPPO,IMBR,DESK,IMC zero
    class FLEET,TASKS,DESKV,TAKE,PROG,DIFF,REPLAY,COST,AUDIT,SOS,SCREEN,PTYRELAY,HANDOFF,SHARED port
    class CONSENT,PAIR,POLICY,ALOG,GATE,PANIC core
```

**图例**：绿=装上即用（零代码）｜橙=要写·有底（移植或照先例）｜红=从零自建（仅总线族）。
**动线**：A 派活 → B 请求/B' 求助 → 同意（人不在走 IM）→ 操控/围观 → C 验收 → D 蒸馏 → E 注入。

## 3. 里程碑与验收（每步：真测+录屏+笔记登记）

| 里程碑 | 范围 | 验收标准（全部真测） |
|---|---|---|
| **M0 探针 PoC**（1-2 天） | ①一次性探针插件实测两命门：**dsh 会话输入/输出流能否拿到**、**插件内 spawn PTY 行不行**；②读 dsh-remote-desktop 源码确认截屏+键鼠实现路线；③hippo federation 盯 git 仓验证（团队记忆层可行性） | 三项各有实测结论+证据（日志/截图）落档；架构假设全部钉死或触发 D8/D9 降级 |
| **M1 总线+接管最小闭环** | 配对（邀请码→令牌）、握手卡、出站 WS、dsh 会话/PTY 中继、双向流、限时、审计日志 | 两台真机：lead 发起→成员同意→lead 实际敲进成员会话看到回显；拒绝/超时/断开三条路径各测一遍；全程录屏 |
| **M2 围观+IM 审批** | 屏幕流（照先例）、只看/可操作两档、水印、IM 桥接审批卡、求助按钮 | 手机 IM 里答复一个接管请求生效；只看档 lead 敲键盘成员端无反应；录屏 |
| **M3 任务+记忆+感知面** | 任务面板、验收→蒸馏→团队记忆闭环、进度流、diff、回放、成本、熔断、权限分级 | 全流程录屏：派活→开工→卡住事件推送→接管解卡→验收→教训进团队仓→新成员开局注入命中；回放可放；熔断一键全断 |

降级路径：M0 若"dsh 会话流拿不到"→ 改走官方 dsh-api-gateway Remote 协议（架构微调，D8 注）；若"federation 盯 git 不可行"→ 团队仓改文件同步任务（D9 注）。

## 4. 复用清单（精确到包）

| 用途 | 包 | 状态 |
|---|---|---|
| 记忆引擎 | 本地 dsh-hippo v0.5.0 | 已深度适配，148 测试 |
| IM 桥 | dsh-connect（首选，多渠道）/ dsh-reach（审批卡动线参考） | npm 现成 |
| 桌面壳（lead 建议装） | dsh-plugin-desktop | npm 现成 |
| 屏幕流先例 | dsh-remote-desktop（本地代理 8090+屏幕/键鼠） | M0 读源码 |
| PTY 接管逻辑 | termfleet-heimdall `worker/worker.mjs` + `server/src/pty-host.ts` | 自家代码移植 |
| 面板底子 | termfleet-heimdall webapp：cpTailSummary/taskDiff/checkpoints/usage | 自家代码移植 |

## 5. 风险表

| 风险 | 等级 | 缓解 |
|---|---|---|
| dsh 会话流不可达（M0 命门①） | 高 | 官方 dsh-api-gateway/Typert Remote 协议兜底 |
| 插件进程截屏权限（macOS 录屏授权） | 中 | 先 Windows（团队主力环境）；macOS 文档化授权步骤 |
| lead 单点（关机全队瘫痪/数据丢） | 中 | 任务+审计定时 git 快照；lead 离线成员本地照跑（会话本就在成员机） |
| 上游 dsh 版本漂移（0.1.x 快迭代） | 中 | 版本门控声明；CI 对 0.1.5-rc.1 与最新 rc 双测 |
| worker.mjs 移植进 Cordis 生命周期的水土不服 | 低-中 | M1 第一周即做真机双机验证 |

## 6. 环境前置

- dsh 0.1.5-rc.1+（本机已装）；Node ≥22（插件宿主随 dsh）
- 两台真机（lead/成员）用于 M1 起的所有验收——不接受单机模拟冒充
- 团队记忆仓：新建空 git 仓（M3 前）
- 笔记登记：沿用 termfleet-heimdall `.agents/notes` 体系（proposed→implemented），每里程碑验收后登记

## 7. 开工即执行（M0 任务细单）

1. `dsh-plugin/plugins/dsh-termfleet/` 起插件骨架（package.json + cordis.patch.yml 最小半）
2. 探针 ①：宿主 ctx 上找 session/会话输入输出 seam（读 @deepseek-ai/dsh-agent 事件词汇表 + dsh-api-gateway 源码），实测读一条会话流+写入一条输入
3. 探针 ②：插件内 spawn PTY（node-pty/@lydell/node-pty）跑 pwsh，回显经 webServer 路由输出
4. 读 dsh-remote-desktop 源码：截屏 API 选型（截图周期/增量？键鼠注入方式）、本地代理结构，落一页实现笔记
5. hippo federation 指向临时 git 仓，push/pull 后确认自动入库
6. 全部结论回填本 PLAN 第 1/3 节并登记笔记
