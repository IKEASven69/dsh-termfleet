# P0 验收记录（2026-10-07 · 会话流镜像 v1 + TF-JOIN 一句话入队 + 通知闭环）

> 方法：`node scripts/verify-p0.mjs`（自足 E2E：自拉 lead+member 双真实 dsh 实例 + Playwright 双面板，
> 双实例 DSH_HOME/USERPROFILE 均指向临时目录、不碰用户真实 ~/.dsh；结束自动 taskkill 自拉进程并删除临时目录）。
> 本轮实测：2026-10-07 14:16，退出码 0（六场景全 PASS）。端口 3180 被占用自动顺延（lead=:3190 member=:3181，不碰他人进程）。

## 场景结果（每条均来自本轮 verify-p0.mjs 实际输出）

| # | 场景 | 结果 | 关键证据（实测值） | 截图 |
|---|---|---|---|---|
| S1 | 一句话入队（TF-JOIN 粘贴即配对） | ✅ PASS | 配对前 member role=off（启动 env 无 ROLE/LEAD_URL/TOKEN，API GET /pairing 实证）；lead 面板「取码」得 TF1-码（len=115）→ member 面板仅粘贴该码点「入队」toast=已加入 → 2045ms 内 lead 成员列表出现 [data-member=P0-MEMBER]；API /fleet members=[P0-MEMBER] | [p0-1-pairing-joined.png](screens/p0-1-pairing-joined.png) |
| S2 | 会话流镜像（成员 dsh 会话→lead 面板气泡按序实时） | ✅ PASS | 成员真 agentLoop 会话（termfleet-m0-probe-muxps4cp）probe-session/write 200 ok=true echoSeq=8（97ms）；ro 会话同意激活期间按契约 A 上行，lead 面板「会话对话流」用户气泡 99ms 出现、助手气泡 +412ms（顺序 user→assistant 正确，上限 20s 内），面板共 17 条气泡。注：助手回合由 dsh 假 provider（termfleet-probe-noop，M0 同款零 API 费）产生 assistant/attempt 事件，非真实 LLM 文本 | [p0-2-sessflow-live.png](screens/p0-2-sessflow-live.png) |
| S3 | 插话（lead 面板→成员 dsh 会话真实出现→followup-ack 送达） | ✅ PASS | 插话经 rw 通道 C-muxpsemlm1z 下发 200；成员 dsh 会话 user/message 回显 seq=21 brief 含插话原文（API GET /probe-session 实证）；面板回执「✓ 已送达（followup）」耗时 421ms；API /fleet lastFollowupAck={ok:true,via:'followup'}——契约 C 闭环 | [p0-3-interject-ack.png](screens/p0-3-interject-ack.png) |
| S4 | 同意门（无同意 403 / ro 流可见但禁写 / rw 插话通） | ✅ PASS | 无同意：member-stream=403+interject=403(no-consent)+面板显示「订阅被拒（403）…」；ro：member-stream=200（hello consentId=C-muxpsar93ur mode=ro，Node 侧 SSE 直连实证）+interject=403(readonly-channel)+面板插话框禁用=true；rw：member-stream=200+插话 200+ack（见 S3） | [p0-5-member-consent-ro.png](screens/p0-5-member-consent-ro.png) / [p0-5-member-consent-rw.png](screens/p0-5-member-consent-rw.png) |
| S5 | 通知闭环（member-join/consent-request 弹条） | ✅ PASS | lead 面板 tf-notify 弹条实测 DOM：member-join「P0-MEMBER 上线」、consent-request「me 请求连接 sess → member:P0-MEMBER」带「去处理」按钮（hasGo=true），7s 窗口内截图留存 | [p0-4-tf-notify.png](screens/p0-4-tf-notify.png) |
| S6 | 成员侧断开跨总线传播 | ✅ PASS | 成员机（独立同意库）/consent/end C-muxpsemlm1z→200(status=ended)；lead 实时流即时收 event:'end'（reason=consent-ended）；lead consent/list 同 id 收口 ended；重连 member-stream=403（旧环形缓冲不可重放） | —（时序事件，无稳态画面） |

**结论：6/6 PASS，exit 0，全绿。** 复跑命令：`node scripts/verify-p0.mjs`。

## 本轮修复登记

- `lib/index.js:681`：followup 处理闭包内裸调 `memberSend`（未定义）会把成员宿主打崩（dsh fatal load failure）→ 改为 `send(member.ws, ...)`（回执用当前连接 ws）。`src/index.ts` 经 `node scripts/rebuild-src.cjs` 再生逐字镜像，再生前后 md5 一致（da915b8b…），无手拼漂移。

## 边界与已知说明

- S2 助手回合由假 provider（termfleet-probe-noop）产生，验证的是**镜像管道与顺序**，非 LLM 文本质量。
- 本轮为单机双实例（独立 USERPROFILE 模拟跨机：lead/member 各持一份插件令牌/同意库）；真实跨两物理机的网络段验收沿用 ACCEPTANCE-M1 手册（lan-forwarder 路径已单独验证）。
- 隔离纪律核验：运行结束 `[cleanup]` 输出两实例已 taskkill、端口 3190/3181 free=true、临时目录已删除；未触碰用户真实 profile。

═══════════════════════════════════════════

# 复审修复轮（2026-10-07 下午）：评审 #2/#3/#4 修复 + S7/S8 回归

## 处置清单（上轮独立评审 4 条发现）

| # | 发现 | 处置 |
|---|---|---|
| 1 | medium·成员侧撤销不跨总线传播 | ✅ 上轮已修（consent-end 帧 :542/:605/:657/:1613 + 门控兜底 :1392-1395），S6 已是回归锁 |
| 2 | low·成员面板授予后误开 pty/自订阅噪音 | ✅ 本轮修：`CH._mine` 三处门控（decide 捕获回填/pollFleet 轮询/启动恢复 `!c.remote`） |
| 3 | low·邀请码跨机地址困在 127.0.0.1 | ✅ 本轮修：面板 `tfAdvertise(location)` 显式传 `?u=`（IPv6 括号归一） |
| 4 | low·auditStore.add fire-and-forget 裸奔 | ✅ 本轮根治：add 内写盘 try/catch 永不 reject（约 20 调用点一次收口） |

## E2E 扩到 8 场景与三轮实测

- 新增 **S7 邀请码跨机地址**（pairing/code?u= 进码解码一致 + tfAdvertise 三组求值）、**S8 成员面板自持静默**（member 页全程 member-stream 请求数=0 + 无「成员机不在线」误弹，网络层 listener 跨 reload 累积计数）。
- 第一跑 S8 **FAIL 抓真凶**：`decide()` 内 `CH=d.consent`（服务端回包）冲掉本地 `_mine` → 成员答复后照样 startPty（2 次自订阅+误弹）→ 修为进函数捕获回填。
- 第二跑 S8 仍 1 次自订阅 → 定位**启动恢复路径**（gen-app-html.mjs:1382）无标记 → `CH._mine=!c.remote`。
- 第三跑 8/8 全绿（S8 证据：member 页 member-stream 请求数=0、toasts 仅剩合法的「通道建立」），但独立复审指出 1 条低危：tfAdvertise 漏 `[::1]` 带括号形式。
- 终跑（第四跑）：`[::1]` 归一化入码——**首版正则 `/^\[|\]$/g` 被生成器模板字符串吃掉反斜杠**（实际生成 `/^[|]$/g`，转义地狱前科再犯），S7 新增 v6 断言当场抓住 FAIL；改用 charAt 切括号（对转义免疫）后 **8/8 全绿 exit 0**。

## 独立复审（换人冷启动，读全 diff）

结论：三处修复实现正确、无夹带改动；lib/app.html 与生成器逐字节一致（临时目录再生比对）；lib/index.js 全文件 diff 仅 :425-427 一处 hunk。findings：1 条低危（tfAdvertise 漏 `[::1]` 带括号形式——已当场修复：首版正则被生成器模板字符串吃反斜杠（转义地狱前科再犯），改 charAt 切括号并新增 S7 v6 断言锁定，终跑全绿）+ 3 条提示级（S7 拼接链路未在非回环 origin 实点 / rtEndBtn 丢 `_mine` 但不可达且方向保守 / COMPETITOR-SCAN-1006.md 应与修复分开提交——已照办）。

## 调研增量（同日第 4 轮扫描，详见 COMPETITOR-SCAN-1006.md）

- **dsh-team-rooms 2026-10-05 宣布 RETIRED**（无 1.0.8 后新版）——官方 `dsh-experimental-agent-team` 收编其赛道；它从未做人对人功能，TermFleet「人对人 via 会话」生态位仍空。
- **上游 0.2.1-alpha.1（2026-10-03）** 两条破坏性变更（invariant 导出移除/输入区 stats 拆 activity/usage）+ 兼容守卫按 peer 声明线**静默跳过**插件——本仓 grep 实证两者均未使用、peer 未声明宿主版本线、现装 0.2.0-rc.2 加载正常（本轮 E2E 即实证）；0.2.1 稳定后须真机回归+确认守卫语义（已登记 NEXT-UPDATES 兼容观察）。

## 本轮边界与未覆盖

- S7 的 `?u=` 拼接链路未在非回环 origin 下真实点击 pairCodeBtn（E2E 环境浏览器只能以 127.0.0.1 打开面板；覆盖缺口非缺陷，复审提示级）。
- 真两台物理机验收（ACCEPTANCE-M1 #0-#10）仍待用户 B 机；本轮同机双独立 USERPROFILE 模拟跨机（同意库/令牌隔离，S6/S8 均依赖此隔离成立）。
