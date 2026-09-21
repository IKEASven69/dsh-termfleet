---
module: relay
status: planned
last-updated: 2026-09-19
last-verified: 2026-09-19
verified-by: m0-probe
cover-files: ["src/relay/"]
---

# relay 规格书（会话中继）

## 职责
两条通道：①dsh 会话流（宿主内 seam：全局 listener 收全量会话事件；写入走 agentLoop.create + createUserMessage + agent.followup）②自托管 PTY（@lydell/node-pty spawn 任意 CLI）。所有远程动作经 bus 同意后放行。

## 架构
- M0 实测证据：读=插件全局 listener 收 seq0-16 全量事件，snapshotEvents 交叉验证一致；写=注入文本落 user/message(seq8) 回显 661/451ms（假 provider 零费用）；PTY=banner 97ms / stdin 回显 35ms
- 底子：termfleet-heimdall worker/worker.mjs + server/src/pty-host.ts（出站 WS/token/心跳/会话投影/接管协议整套移植）

## 已知陷阱 / 设计约束
- meta.cwd 必传；SessionAlreadyExistsError；conPTY pid=0 只能树杀（见 TBD）
- title-LLM 关闭以保零费用

## 错题记录
（暂无）
