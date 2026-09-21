---
module: bus
status: planned
last-updated: 2026-09-19
last-verified:
cover-files: ["src/bus/"]
---

# bus 规格书（统一同意/审计总线）

## 职责
唯一从零核心（PLAN D5）：同意握手卡状态机（请求→允许/只读/拒绝→超时/断开）；配对（邀请码→设备令牌→吊销）；策略（角色 lead/member、限时默认 30min、操控范围、权限分级）；全量审计日志（可回放原料）；紧急熔断（一键断全队）。桌面与终端共用同一张卡、同一个断开按钮。

## 架构（规划）
- lead 侧：WS 端点（成员出站连接）+ 状态机 + 审计落盘
- 成员侧：同意门 UI 触发 + 出站 WS 客户端
- IM 审批卡作为"人不在电脑前"的旁路答复通道（imbridge 转发）

## 接口契约（规划）
- 同意状态机事件：request/allow/readonly/deny/timeout/disconnect/revoke
- 审计记录：{ts, actor, action, target, consentId, detail}

## 依赖
- host（挂载）；imbridge（旁路审批，M2 接入）；relay/screen（被治理对象）

## 关联流程
- [consent-takeover](../flows/consent-takeover.md)

## 已知陷阱 / 设计约束
- 成员机零入站端口（D10）：全部出站 WS
- 拒绝无需理由；同意/拒绝均入审计

## 错题记录
（暂无）
