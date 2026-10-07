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
