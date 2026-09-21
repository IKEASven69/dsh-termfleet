# Patterns

跨模块通用模式。

## 2026-09-21 · unified-board 对齐（用户提供其上班真实体系）

**结论**：任务模型全面采用 unified-board 设计（10 态转移表/验收编号/两盏灯/打回计数/待确认门禁/切片/查重四分法/relates_to/Agent Brief/封印/停留告警/grill 九项/入口闸）；termfleet 出协作与通道层（多人在线/会话关联/远程接管/审计/IM/进度流）——互补不重复。

15 项差距清单与迁移决策全文见 decisions.md 对应条目。核心落地项：

- host 状态机 v2：10 态 + 转移表守卫（非法 409）+ 打回自动 returns+1（达 5 → blocked）
- 任务字段 v2：acceptance 编号数组 / slices(covers,HITL,touch) / pending 待确认 / dupCheck / agentBrief 四行 / relates_to 关系数 / state(git.base/selfcheck/independent_verify/order)
- 门禁：pending 未清零不得越 ready-for-human；review→implemented 需 independent_verify=pass；归档前置全满足
- v1 迁移：todo→needs-triage、doing→active、review→review、done→implemented、blocked→blocked（保留 history）
