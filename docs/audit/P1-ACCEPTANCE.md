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
