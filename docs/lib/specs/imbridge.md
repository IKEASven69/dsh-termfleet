---
module: imbridge
status: planned
last-updated: 2026-09-19
last-verified:
cover-files: ["src/im/"]
---

# imbridge 规格书（IM 薄桥）

## 职责
出站：审批卡/接管请求/事件推送到飞书/钉钉/webhook（底子=termfleet webapp server/src/im.ts）。收方向：聊天里答复审批卡（长连接，参考 dsh-reach / dsh-im-feishu）。自研薄层，不直用 dsh-connect（D7）。

## v2 形态（2026-09-20）

出站：im.json {enabled,webhook}，审批卡(带 C-id+答复格式)/SOS/测试。入站：POST /dsh-termfleet/im/callback?t=团队令牌 {text,from}——决定词(允许/只读/拒绝)+可选 C-id→consentStore.decide→总线回传；响应 {ok,understood,acted}。任何 IM（飞书群机器人/自建桥）只需双向转接此协议。

## 已知陷阱 / 设计约束
- 收方向技术验证未做（TBD 挂账，M2 前置侦察）

## 错题记录
（暂无）
