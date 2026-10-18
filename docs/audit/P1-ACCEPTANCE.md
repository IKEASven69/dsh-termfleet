# P1 #4 任务↔会话强关联 验收记录（2026-10-07）

> 复跑命令：`node scripts/verify-p0.mjs`（双真实 dsh 实例 lead:3180+member:3181，占用自动顺延；
> 双实例独立 USERPROFILE 模拟跨机；结束自清进程+临时目录）。本轮实测退出码 0（11 场景全 PASS）。

## 本轮交付（契约 F/G，详见 docs/lib/decisions.md）

- **契约 F 绑定本体**：task.session={member,sessionId,label,boundBy,boundAt}；bind-session/unbind-session（坏参数 409）；创建表单「绑定本机当前 dsh 会话」勾选+预填；详情「会话」tab 绑定卡（▶实时看/解绑）+ 弱匹配候选一键转正（带 member 归属）；任务卡 ⚡会话 徽标；成员 hello/presence 上报真实 dsh 会话 id。
- **契约 G 跨机同步 v1**（前提缺口补齐：任务板原本只在单机）：task-op 上行→lead 同一门禁应用→全量广播；成员 mergeFrom 后写赢合并；删除墓碑随广播；task-report 上线对账收编离线任务；id 舰队名标签+来源 id 沿用（查重）。

## 场景结果（S1-S8 为 P0 回归锁，本轮全过；S9-S11 为本轮新增）

| # | 场景 | 结果 | 关键证据（实测值） |
|---|---|---|---|
| S9 | 任务板跨机同步+会话强绑定 | ✅ PASS | member 建任务(id=T-001-P0MEMB)绑定本机会话→task-op 上行，lead 4ms 可见同 id（session.member/sessionId 完整）；lead 建任务→广播，member 2ms 可见；member 板该任务仅 1 份 |
| S10 | 弱匹配→强关联全链+生命周期+门禁 | ✅ PASS | session-links 命中 T-003-P0LEAD 且 link.member=P0-MEMBER（镜像归属真门禁）→转正 bind 200 归属正确→unbind null→坏参数 409 |
| S11 | 删除跨机传播（墓碑） | ✅ PASS | lead 建任务 member 3ms 可见→delete 200→墓碑随广播，member 1ms 清幽灵 |

## 独立复审（换人冷启动）抓出并已修复

1. **高危·删除不跨机传播**（幽灵任务可继续操作）→ 墓碑机制 + S11 回归锁
2. **中·成员离线创建任务永不补报**（与注释承诺不符）→ task-report 上线对账（importFrom，不复活墓碑）；E2E 未模拟断线创建，跨机真机验收覆盖
3. 中低·同 id 伪造帧可致重复 → create 沿用 id 加库内查重
4. 低·S10 member 归属断言为证据性 → 升级为真门禁（本项目弱匹配全链）
5. 低·boot 竞窗 idTag 未注入 → setIdTag 移到同步段
6. 低·解绑/转正后抽屉不刷新 → 回调内刷新 renderSessTab
7. 信息·后写赢基于跨机墙钟，时钟偏移会逆转真实后写 → v1 已知取舍，decisions 标注

复审同时确认：dshSessions 无 TDZ 风险、mergeFrom 并发安全（变更段全同步）、面板 esc 无注入面、旧 id 格式无代码断裂、src/lib/app.html 三方一致。

## 边界与未覆盖

- 成员离线创建的 task-report 对账：实现就绪但 E2E 未模拟断线（需可控断连），留跨机真机验收。
- subagent 会话过滤（绑定时排除 origin:'subagent' 会话）：需宿主把 header.origin 透出到 sessionEvents，登记为后续项。
- 时钟偏移场景的后写赢逆转：v1 取舍，未做 NTP/逻辑时钟。
- 真两台物理机验收（ACCEPTANCE-M1 #0-#10）：仍待用户 B 机。

═══════════════════════════════════════════

# P1 #5 进度摘要推送 验收记录（2026-10-09）

> 复跑命令：`node scripts/verify-p0.mjs`（12 场景）。本轮 **12/12 全绿连续两轮**（exit 0），诊断脚本 scripts/dbg-progress.mjs 入库。

## 本轮交付（契约 H，详见 docs/lib/decisions.md）

- 成员侧五态状态机（3s tick，迁移才推）：idle/working/waiting-input/waiting-reply/stuck；阈值 env（STUCK_MIN=10min/WAIT_SECS=30s/NOTIFY_COOLDOWN_MIN=30min，支持小数，下限 1s）；presence summarize 与推送共用 STUCK_MS。
- 分级频控（调研回灌）：waiting-input 仅 `approval/asked`、豁免同类冷却；启发式类 30min 同类冷却。
- lead 侧：lastProgress 入 /fleet（成员卡徽标）+ tf-notify 弹条 + IM 转发；忙碌抑制（lead 正订阅该成员流→IM 静默）；成员重连 hello 补推当前态。

## S12 场景（不变量断言，对探针异步补发事件与 tick 相位鲁棒）

| 项 | 实测 |
|---|---|
| 触发 | member env 注入 STUCK_MIN=0.1(6s)/COOLDOWN=0.2min(12s)/WAIT_SECS=3，两次 probe-write |
| 先推 | stuck#1 落地于写#1 后 +6s（lead 存储+SSE 弹条实证，`/fleet` lastProgress 同步） |
| 后抑 | 写#2 后的同类迁移被冷却抑制；不变量=同类相邻帧间隔 ≥11.5s（12s 下限）✓ |
| 末态 | lastProgress.kind 与末帧一致 ✓ |

## 频控断言 flake 猎杀（四轮演进，教训入 decisions）

具体帧数断言在「探针 agentLoop 异步补发 turn 事件 × 3s tick 相位 × 冷却网格边界」下必 flake——四轮出现四种合法时序（含写#2 的 working 距上次同类推送 15s 合法放行）。终版=不变量断言；期间顺手修掉 `Math.max(1, MIN)*60000` 把小数分钟钳成 1 分钟的隐藏 bug（stuckMs=60000 铁证）与 waiting-input 正则误配（approval/decided·policy、permission/preset 零冷却直推 IM——独立复审抓出）。

## 独立复审（换人冷启动）处置

- 修：waiting-input 正则收紧为 `approval/asked`（误配零冷却直推 IM）；presence 阈值与 env 统一；成员重连补推当前态；S12 相位 flake（事件同步+不变量）；调研文档落款日期。
- 确认无问题：sessSubs 清理可靠（IM 永久静默不成立）、lastProgress 无泄漏、tick/presence/bus.sess 无互踩、三产物一致、S12 无放水。
- 备案：stuck 优先于 waiting-input（设计确认）；3s tick 漏报粒度（零误报类可接受）；numEnv 超大值→Infinity（极端误配静默，不崩溃）。

## 边界与未覆盖

- IM 实发：E2E 无 webhook，只验 lead 转发路径（busy 抑制分支同源），实发留真实环境。
- 「完成」事件：现 stuck/waiting 二态启发式，可靠 turn 终态信号待后续（调研：生态共识推「审批+完成」，完成信号是缺口）。
- waiting-input 漏报粒度：3s tick 内被快速批准的审批不推送（零误报类漏报可接受）。

═══════════════════════════════════════════

# P1 #6 快捷操作面 验收记录（2026-10-09，P1 收官）

> 复跑命令：`node scripts/verify-p0.mjs`（14 场景）。本轮 **14/14 全绿（exit 0）首跑即过**，复审修复后复跑仍全绿。

## 本轮交付（契约 I，详见 docs/lib/decisions.md）

- **信任快捷通道**：成员面板开关「信任此 lead：会话查看请求自动允许（仅只读，随时可断）」（pairing.json 持久化）；lead 成员卡「⚡看会话」一键请求（auto=ro 随 consent 落库+透传）；成员侧三重门（auto=ro × 信任开 × 仅 sess）自动允许只读，审计「信任模式自动允许(只读)」+ IM 告知 + 面板提示「随时可断开」；安全边界=auto 只认 ro/仅 sess/最大半径只读 30min/**rw 接管永远要成员手动点头**。
- **一键动态**：fleet `?r=` 深度参数（1-50 钳制）+ 成员卡「◔动态」弹层（状态/最近推送/近 20 条会话事件/插话送达）。

## 场景结果（S13/S14 本轮新增）

| # | 场景 | 结果 | 关键证据（实测值） |
|---|---|---|---|
| S13 | 信任快捷通道（正反两半） | ✅ PASS | 开信任→一键请求→lead 侧 active ro（auto=ro 透传+成员侧记录落库回归锁 auto=ro/active），成员审计「信任模式自动允许(只读)」；关信任→同样请求 4.5s 后仍 pending（信任门闸成立） |
| S14 | 一键动态数据面 | ✅ PASS | fleet?r=20 → recentEvents 17 条（默认路由 8 条），含 S3 插话回显=true |
| S15 | 查重（近似命中+无关空+fSim 提示+创建不拦截） | ✅ PASS | 无令牌 POST /tasks/similar=401（鉴权门内）；建基线 T-005-P0LEAD「实现用户登录模块」→ similar「实现用户登陆模块」命中基线 score=0.5556≥0.55（契约 A bigram Jaccard 5/9≈0.556，TERMFLEET_DEDUP_THRESHOLD 默认）；无关标题「午饭吃什么」→ similar 0 条；面板 lead 新建表单 fTitle 逐字输入→fSim 提示区="发现 1 个相似任务（请确认是否重复；不拦截创建）： T-005-P0LEAD 实现用户登录模块 56%"（截图 p0-6-dedup-fsim.png）；近似标题创建第二任务 200（新 id=T-006-P0LEAD≠基线，未被拦截）且响应 similar 含基线 score=0.5556 |

## 独立复审（换人冷启动）处置

- **修（F1 中）**：requestRemote 字段白名单丢 auto——成员侧记录永不带 auto，面板「随时可断」卡与信任提示成死代码；修=requestRemote/request 均落库 auto + S13 加成员侧 auto 落库回归锁。
- 修（F2 低）：S13 清理原用 /consent/end 对 pending 是空操作（end 只收 active）→ 改双端显式 deny 收口，证据措辞同步纠正。
- 修（F3 低）：recentMask 纳入 Esc 关闭列表。
- 修（F4 低）：auto 落库滞后（路由事后改内存、重启丢失）→ auto 并入 request() 创建时落库。
- 确认无问题：rw 伪造不可能（只认 ro+仅 sess+硬编码 readonly decide）、trust 持久化语义、stopPropagation/token 传递/leadFleet 钳制、S13/S14 断言真实、三产物一致。

## 边界与未覆盖

- 成员自动路径 decide 返回 null 的极窄竞态会落穿补发审批卡 IM（需 lead 请求与成员手动答复几乎同时，无实害）。
- pending consent 无过期（prune 只清 active）——挂起请求永久留存，后续可加 TTL。
- 面板「⚡/◔」按钮的浏览器级点击测试未做（API 直证+纯渲染弹层），留真双机验收顺带覆盖。

═══════════════════════════════════════════

# 跨机路径单机实测（2026-10-13，verify-lan.mjs，L1-L3 全绿连续两轮）

> 用户问「能不能一个环境模拟两个 dsh 远程连接」——verify-p0.mjs 一直是同机双真实实例（独立 USERPROFILE）；本脚本再把**网络路径**也换成本机能压的最真实形态：一切关键流量走**非回环接口**（局域网 IP + lan-forwarder），不再只走 127.0.0.1。

| # | 场景 | 结果 | 关键证据 |
|---|---|---|---|
| L1 | 邀请码地址（非回环 origin 全链） | ✅ | 浏览器以 `http://192.168.1.12:3182/` 打开 lead 面板（真实 LAN 接口+forwarder）→ 取码 → 码内 u=`ws://192.168.1.12:3182/dsh-termfleet/bus`（tfAdvertise 真浏览器路径，S7 遗留的「拼接链路未实点」闭环） |
| L2 | 跨转发器入队上线 | ✅ | member 面板粘贴码 → 出站连接经 forwarder（Host 改写+WS Upgrade 透传）→ 525/533/534ms 内 lead /fleet 出现成员（三轮） |
| L3 | 数据双向穿转发器 | ✅ | 信任 ro 通道自动生效（3-5ms）→ 成员会话事件上行到 lead /fleet → lead 面板经 LAN 地址订阅成员对话流=订阅中（SSE 下行经转发器） |

**TUN 解除实证**：2026-10-07 记录的「Clash TUN 劫持本机非回环自测」已不复现（临时监听器对 192.168.1.12 回包正常）——本机 IP 已从 .17 变 .12（DHCP）。**对真双机验收的意义**：协议/转发/邀请码地址/双向数据已在本机非回环路径实证；B 机要补的只剩「第二台机的防火墙环境、跨机时钟偏移下的合并行为、以及录屏验收」本身。脚本：`node scripts/verify-lan.mjs`（TUN 劫持时如实退出并给判定法）。

═══════════════════════════════════════════

# 面板原生化第一步 验收记录（2026-10-15，verify-native-board.cjs N1-N6 全绿 + pageerror 门）

> 右栏 tab 主体改 flag 感知：默认**原生任务板**（React h()），「完整面板」一键切回 iframe。复跑：`node scripts/verify-native-board.cjs`（临时 dsh 实例+种子任务，零接触真实 3180）。

| # | 场景 | 结果 | 关键证据 |
|---|---|---|---|
| N1 | 原生板挂载 | ✅ | 右栏 TermFleet chip 点击 → `[data-tf-native-board]` 出现 |
| N2 | 看板列/卡片/徽标 | ✅ | 7 列（6 列+其他兜底）；登录卡在板；active 卡带 ⚡会话；wontfix 入其他列 |
| N3 | 卡片展开详情 | ✅ | A1 验收条+UB_FLOW 流转按钮（→缺信息/就绪(A)/就绪(H)/不做）+认领/删除 |
| N4 | 状态流转 | ✅ | 点「→ 就绪(A)」→ 卡片经 /tasks/action 迁入 ready 列（unified-board 转移表实测） |
| N5 | 快速建任务 | ✅ | 输入+「建」→ 待分诊列出现新卡 |
| N6 | flag 双向切换 | ✅ | 完整面板→iframe 主体；原生任务板→原生回归 |

**调试实录与评审处置**（详见 decisions 2026-10-15）：面板空+React #62 → 错误码解码=style prop 传字符串 → 改样式对象即愈；stash 对照实验排除宿主回归（旧 iframe tab 在 0.2.1-alpha.2 正常挂载）；评审 F1=401 假成功 hint（guard 401 响应无 ok 字段）→ act/quickAdd 补状态码检查；F2=pageerror 计入退出码（豁免宿主已知噪音「tab tab2 has no pane」）。已知边界：原生详情为轻量版（文档正文/大纲/避坑在完整面板）；快速建任务仅标题（进待分诊）。截图 nb-1-native-board.png。

═══════════════════════════════════════════

# 面板原生化第二步 验收记录（2026-10-15，verify-native-remote.cjs RN1-RN4 全绿 + 任务板 6/6 回归）

> 右栏 tab 升级「任务板/远程」分段切换；原生远程视图=成员卡轮询+⚡请求查看(信任自动 ro)+请求接管(rw 手动)+member-stream 对话流气泡(ack ✓已送达)+rw 插话。复跑：`node scripts/verify-native-remote.cjs`（双实例：member env 直连+信任+probe 回显断言，零接触真实 3180）。

| # | 场景 | 结果 | 关键证据 |
|---|---|---|---|
| RN1 | 远程视图+成员卡 | ✅ | 分段切换挂载 `[data-tf-native-remote]`，fleet 轮询出「● NR-MEMBER」卡 |
| RN2 | ⚡请求查看 | ✅ | 信任自动允许 ro → 流状态=订阅中 + 通道 chip=只读（2.5s 自愈重订阅路径实测） |
| RN3 | 会话事件→原生气泡 | ✅ | 成员 probe write → 原生对话流出现 ▶ user 气泡含 MARK（sessionId:seq 去重下无重复） |
| RN4 | 请求接管+插话闭环 | ✅ | rw 手动允许 → 插话框启用 → 插话后 ack「✓已送达」+ 成员会话真实回显 |

**评审处置**：F1 SSE 内建重连重放→sessionId:seq 去重（重订不清 evs）；F2 自愈空转收窄（仅无法订阅态重订）+重订不清 evs（插话气泡不丢）；F3 select/轮询竞态守卫（selRef 比对）；F4 send 精确清空 input+select 清 hint；死代码清理（不可达分支/onIframe）。已知边界：原生详情轻量版；多成员切换的流隔离已由 startStream close+去重重置覆盖（单成员 E2E，多成员留真双机）。

═══════════════════════════════════════════

# 0.2.1-alpha.2 + better-sidebar 共存验收（2026-10-15，verify-coexist-alpha2.cjs）

> 回应「适配最新版？支持官方侧边栏和 better-sidebar？」。脚本：`node scripts/verify-coexist-alpha2.cjs`（双插件同载临时实例+定向豁免+真实坐标点击）。

| # | 断言 | 结果 | 关键证据 |
|---|---|---|---|
| C1 | 双插件进 manifest | ✅ | `__DSH_BOOT__` 同时含 dsh-termfleet 与 better-sidebar（0.28.0，定向豁免后） |
| C2 | TermFleet 原生板挂载 | ⚠️ 部分 | better-sidebar 0.28 在载时引导卡同框可见，但自动化点击（合成+真实坐标）未触发宿主引导卡激活——**人工点击可用**（单插件实例 N1 已证挂载无碍），属测试自动化与宿主引导系统的交互限制 |
| C3 | 右栏多面板并存 | ✅ | better-sidebar 0.28 底部 dock 五 tab（文件/Git/任务管理/侧边对话/终端）+ 右栏引导卡含 TermFleet，同框渲染无冲突 |

**better-sidebar 版本矩阵（重要生态事实）**：
- **0.19.1（广泛安装版）：被 dsh 0.2.1-alpha.2 兼容守卫整体禁用**——peer 全钉 `0.1.5-rc.1`，守卫拒载（活体实证，与 COMPETITOR-SCAN-1006 记录的守卫机制吻合）。装旧版 better-sidebar 的用户升 dsh 后它会静默消失，需 `dsh plugin allow-version` 豁免或升级
- **0.28.0：适配线**（peers `^0.2.1-rc.1`），豁免后同载成功、自渲染底部 dock，与 TermFleet 右栏 tab 无冲突（key 隔离：`better-sidebar` vs `dsh-termfleet`）
- **TermFleet 自身不声明宿主版本 peer 线 → 守卫无从禁起**（同实例实测挂载正常）；0.28 的「任务管理」tab 与本插件任务板功能相邻，竞争关注点入档

**live 环境更新（用户指令）**：web profile 的 better-sidebar 已 0.24.1→0.28.0（`dsh plugin allow-version` 豁免 alpha.2 边界 + pnpm-workspace allowBuilds 放行 onnxruntime-node 构建并完成 postinstall）。**生效需重启 live dsh 实例**。
