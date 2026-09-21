---
plan: m0-probe-sprint
title: M0 探针冲刺（工作流执行）
status: completed
completed: 2026-09-19
---

# M0 探针冲刺报告（归档）

执行方式：动态工作流（骨架工+会话流侦察+屏幕流侦察+记忆仓验证并行 → 实测员两命门 → 收口员）。六项判定详表见 [PLAN.md 第 8 节](../../../../PLAN.md)。

## 判定总览
1. 骨架合成：**通**（--dump-config exit 0，合成树含 termfleet 层）
2. 会话流读：**通**（宿主内 listener 全量事件 seq0-16，snapshotEvents 交叉验证一致）
3. 会话流写：**通**（agentLoop.create+createUserMessage+agent.followup，seq8 落日志回显，假 provider 零费用）
4. PTY：**通**（@lydell/node-pty 宿主内 spawn pwsh，banner 97ms / 回显 35ms）
5. 屏幕流路线：**部分**（先例源码笔记钉死，栈内未实跑，M2 首证）
6. 记忆仓：**通**（HIPPO_DATA_DIR 沙箱，入库/clone/recall/幂等全过）

## M1 约束遗产
鉴权门第一优先（路由绕过 launch token）；meta.cwd 必传；SessionAlreadyExistsError；title-LLM 零费用开关；conPTY 树杀。

## 现场
证据留档 D:\coding\tmp\termfleet-m0-probe\；进程清干净；profiles 与 ~/.hippo 零触碰。
