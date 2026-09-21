---
module: membridge
status: planned
last-updated: 2026-09-19
last-verified: 2026-09-19
verified-by: m0-probe
cover-files: ["src/memory/"]
---

# membridge 规格书（记忆桥）

## 职责
个人层=hippo 原样（装上即用）；团队层=git 仓 + hippo federation 盯目录；验收→蒸馏卡点/解法→团队仓；新成员开局注入。

## M0 实测结论
- HIPPO_DATA_DIR 沙箱全链路可用（~/.hippo 零触碰）
- 双步真测：scan 入库 6+3、clone 全量 created 9/9、recall top-1 命中 score 1.07、幂等

## v2 形态（2026-09-19）

team-memory/{proposed|implemented|rejected|archived}/{六分类}/yyyy-mm-dd-slug.md；流转=目录移动（legal 表）；/memory/verify 门；蒸馏→implemented/process。详见 decisions.md 对应条。

## 已知陷阱 / 设计约束
- federation 目录源只吃 .md（JSONL 单列文件级 source）
- scan 需 import hippo dist 直调 scan(engine)（CLI 无此命令）
- recall 按 project 域隔离

## 错题记录
（暂无）
