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

═══════════════════════════════════════════

# 全页面 IA 重构 验收记录（2026-10-24）

> 方向与用户对齐，调研来源=better-sidebar 0.28 TeamBoard 源码 + Devin Desktop + Claude Code Agent View。改动单源 scripts/gen-app-html.mjs（`node --check` 通过→`node scripts/gen-app-html.mjs` 再生成 lib/app.html，产物与生成器逐字节一致，未手改）+ lib/client.js（原生半 R-fix）。

## 门禁复跑（本日三轮全绿）

| 检查 | 命令 | 结果 |
|---|---|---|
| P0 端到端 15 场景 | `node scripts/verify-p0.mjs` | ✅ S1-S15 全 PASS，exit 0（20:37-20:47，lead=:3180 member=:3181 双实例 HOME 隔离，S1 已按 R3 弹层路径验证） |
| 原生任务板回归 | `node scripts/verify-native-board.cjs` | ✅ N1-N6 全 PASS，exit 0（R-fix 列宽改动后复跑） |
| 原生远程回归 | `node scripts/verify-native-remote.cjs` | ✅ RN1-RN4 全 PASS，exit 0（R-fix 气泡折叠后复跑，RN3 实证「○ 状态同步 ×8」胶囊+▶ user 气泡并存） |

## 取景过目（node scripts/shoot-pages.mjs → style-*.png，逐张人工 Read 检查）

| 截图 | 断言面 | 过目结论 |
|---|---|---|
| style-remote-none.png | R1 none 态 | ✅ 左栏纯设备列表（本机+成员+⚙设置+成本行「0 完成 · 0 进行 · 0 待办」），右栏双 CTA 大卡（查看本机 pwsh/看成员的会话） |
| style-remote-local.png | R1 local 态 | ✅ 本机选中高亮，右侧「请连接本机 pwsh」+宿主 dsh 会话事件流分区 |
| style-remote.png | R1 member 态 | ✅ 点选成员订阅视图（成员卡含「干活中 turn/end」动态+⚡/◔按钮+progress 弹条） |
| style-task-list.png | R2 行模式默认 | ✅ 紧凑行（状态色点/优先级徽标/⚡会话徽标/负责人/状态 chip/星标+更多），「列表/看板」分段在右上 |
| style-task-pinned.png | R2 置顶 | ✅ 支付对账脚本行星标点亮（amber）+toast「已置顶 T-006-LEAD（排最前）」 |
| style-task-board.png | R2 看板切换 | ✅ 列横滚（待分诊/就绪/进行中/待验收/已实施…）+卡片优先级色条+⚡会话徽标 |
| style-task-detail.png | 详情抽屉 | ✅ 五 tab（文档/全流程/会话/决策笔记/工作流/diff）+验收条目/待确认/两盏灯 |
| style-settings.png | R3 设置弹层 | ✅ ⚙→settingsMask 全屏弹层：配对（信任开关+高级折叠）/TF-JOIN 两步向导/IM 通知/今日成本（操作人明细） |
| style-audit.png | R4 分色 | ✅ 操作类型色点：避坑=绿点、任务操作/新建任务=蓝点；「全部/任务/避坑/连接·通道」筛选+操作人下拉 |
| style-audit-conn.png | R4 连接筛宽匹配 | ✅ 「连接/通道」筛出请求连接/拒绝连接（琥珀点）2 条 |
| style-tooltip.png | ⓘ tooltip | ✅ 悬停浮层显示置顶排序规则（优先级→状态；星标=本机 localStorage 不进共享板） |
| style-memory.png | 避坑库回归 | ✅ 状态 chip（已生效/待定/已否决）+分类筛选+卡片三行截断（-webkit-line-clamp:3） |

## Concerns（如实记录）

- style-remote.png 摄到「订阅被拒（403）」瞬态：截帧先于信任 auto-ro 同意回路完成（约 2.5s 窗口）；自愈重订阅随后恢复，属取景时序而非产品缺陷——证据价值不受影响（该帧恰好留证 403 文案与「请求会话镜像」CTA）。
- style-tooltip.png 为小视口裁切帧（1020px），tooltip 文案完整可读但顶部被裁——取景脚本遗留画幅，非样式问题。
- 双路径回归覆盖：本轮 nb-*.png / nr-1-native-remote.png（20:30 取景）为 better-sidebar 双路径脚本的取景产物，脚本本体（verify-native-board/verify-native-remote）已在本日 R-fix 后复跑全绿（见上门禁表）。
- 真双机差距不变（沿用 2026-10-13 记录）：防火墙环境/跨机时钟偏移/录屏验收本身。

## xterm 原生终端轮 + 键入链路 bug 修复（2026-10-25）

### 发现的存量 bug（活体真测揪出）

- **现象**：内置浏览器面板点「请求连接本机 pwsh」建 rw 通道后，xterm 终端敲键零回显。此前各轮「PTY 回显 OK」的证据全部来自 HTTP 探针路由 `/probe-pty/write` 或页内手工 fetch——**键盘路径从未被真实键事件打过**。
- **根因**：onData 处理器 `api('/dsh-termfleet/pty/raw','POST',{data})` 三参误用——`api(path,body)` 只收两参，字符串 `'POST'` 落在 body 位，实发请求体为 `JSON.stringify('POST')`=`"POST"`；服务端 `body.data`=undefined → `ptyProc.write('')` 写空串。用户敲的每个键实际发出去的都是 `"POST"`。
- **修复**：gen-app-html.mjs 单处改回两参 `api('/dsh-termfleet/pty/raw',{data})`；全仓 grep `api('…','POST'` 确认仅此一处误用（lib/client.js 无同类）。契约入档决策库。

### 专项 E2E：`node scripts/verify-xterm-key.mjs`（新增）

真实 Chromium CDP 键事件（`page.keyboard.type`，命令含大写 E2E/空格/数字——恰是合成 KeyboardEvent 会丢的字符形态）打穿 keydown → xterm onData → POST /pty/raw → pty.write → pwsh 回显 → SSE → 渲染。单 lead 实例 HOME 隔离（3190 起顺延，不碰 3180/3181），退出杀净删临时目录：

| 检查 | 结果 |
|---|---|
| K1 通道与 xterm 就绪 | ✅ chanPill="通道 rw · 29:59"，.xterm+helper-textarea 在场 |
| K2 /pty/raw 请求体保真 | ✅ 22 请求全带真实数据，垃圾体 `"POST"` 0 个（回归锁） |
| K3 终端缓冲完整回显 | ✅ 输入行 `PS …> echo E2E_KEY_OK 42` 逐字一致 + pwsh 输出 `E2E_KEY_OK`/`42` 两行（pwsh 按空格拆参各打一行） |
| K4 大写/空格/数字逐字保真 | ✅ 剥提示符后与命令逐字比对一致 |

4/4 PASS，exit 0；截图 `docs/audit/screens/xkey-mvnsxrdl.png`。

### 测试手段边界（如实记录，防止后续误判）

- ZCode 内置浏览器（IAB）的 `locator.press/type` **不向页面注入键盘事件**（textarea 捕获级监听零到达；调用不报错但无事发生）——键盘链路真测必须走独立 playwright 脚本的真实 CDP 键事件。
- 页内合成 `KeyboardEvent` dispatchEvent **不保真**：丢大写与空格、带 shiftKey 反而全丢——只可用于接线探针（验证 onData 是否触发），不可用于保真断言。

### 入库说明

- xterm vendoring 轮（lib/vendor 三件、生成器内联、/pty/raw 路由、ptyWrite expect 语义、dedup v1.1）此前滞留工作区未提交，本次与键入修复、专项脚本、文档一并入库。
- verify-p0 15 场景不经键盘路径，改动面（onData 一行+pty/raw 路由）对其无影响；verify-xterm-key 的真实实例引导（spawn+页面加载+通道+SSE+PTY 全链）本身即 regenerated app.html 的回归冒烟。

## 本机通道不限时 + 通道死亡 UI 归位（2026-10-25，用户实测反馈「连本机怎么还会有时间限制/界面显示有问题」）

用户实测抓出两个问题：①本机自连也有 30 分钟倒计时并被服务端到点掐断（toast「限时到」）；②通道死亡后 UI 不归位——僵尸 xterm 终端继续挂着（打字无响应）、状态条残留「切只读/断开」死按钮、右上 pill 却显示「无通道」，三处互相矛盾。

### 修复

| 项 | 改动 |
|---|---|
| 服务端 TTL 分支 | `decide()`：`expireAt = (c.remote ‖ target 带 member: 前缀) ? +30min : null`——本机自连（同源已认证会话连自己的 shell）无「被控方限时授权」语义；跨机（lead→member 目标 / 成员机 remote 记录）保留 30 分钟限时 |
| 客户端不限时显示 | renderChannel 活动分支 `noTTL` 路径：pill「通道 rw · 本机不限时」、meta「本机直连 · 随时可断」、不设倒计时 tick；decide toast 文案随 expireAt 分支（「本机不限时」/「限时 30 分钟」） |
| 死亡即归位 | ended/expired/denied 分支：关 ptyES、藏 `#ptyXterm`、放回 `#ptyTerm` 占位、「请连接本机 pwsh」CTA 回归（原 `!CH` 判断对已存在但已死的通道恒 false → CTA 永不回归=僵尸根因）；CTA 显示条件改为「非 active/pending」 |
| 刷新自愈 | 活动本机通道分支 `!ptyES` 才 startPty（renderChannel 单一入口）——修复「带活通道刷新页面后终端永不出现」的第二种僵尸态；ptyXtermInit 复用已有 term 时也重新亮出容器并 fit |
| 文案 | 未连接 meta「连接本机 pwsh 会话（免确认·留痕·不限时）」（原「全程过同意门」与本机免确认事实不符） |

### 验证（verify-xterm-key 扩至 K1-K5，5/5 PASS exit 0）

- K1 本机通道不限时：chanPill=`通道 rw · 本机不限时`，无倒计时 ✓
- K2/K3/K4 键入链路回归：请求体逐键真实、完整回显、大写/空格/数字逐字保真 ✓
- K5 断开后 UI 归位：pill=`无通道`、终端已藏、CTA 回归 ✓（rtEndBtn 真实点击路径）
- 用户活实例（3180）页面端已生效（每请求读盘）；**服务端 TTL 分支需该实例进程重启加载新 lib/index.js 后，新建通道才不限时**——3180 是用户自己的实例（token 与 ~/.dsh/termfleet 一致），重启由用户拍板，未擅动。
