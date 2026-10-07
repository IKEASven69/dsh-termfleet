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
