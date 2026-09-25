---
id: 001
title: v2 sidebar 补齐：挂官方 sidebar-right + 与 dsh-better-sidebar 共存 — 实施清单
status: complete
---

# 实施清单（change-001）

> 每完成一项把 `- [ ]` 改成 `- [x]`。`npm run doc:status` 会聚合所有 tasks.md 的勾选框算完成率。

## S1. 准备
- [x] 1.1 明确影响模块：panels（client 半）+ host 不动
- [x] 1.2 补充验收清单：引导胶囊 + tab chip + DockSurface + BS 共存

## S2. 代码改动
- [x] 2.1 `lib/client.js` 改 v2：`exports.inject = ["slots", "sidebarRightTabs"]`
- [x] 2.2 新增 `TfTabBody`（iframe 撑满）/ `TfTabTitle`（icon+文字）/ `TfGuideIcon`（字母方块）
- [x] 2.3 `ctx.sidebarRightTabs.register({id, kind:"termfleet", priority, title, guide})`
- [x] 2.4 `ctx.slots.inject("sidebar.right.pane.tab", key="dsh-termfleet", ...)` × 2（body + title）
- [x] 2.5 保留 `conversation.session.header.utilities` 入口（v1 原状）
- [x] 2.6 头部注释更新（v1 → v2 槽位变更说明 + BS 共存说明）
- [x] 2.7 `node --check` 语法通过
- [x] 2.8 `TfTabBody` + `EntryPanel` 加 401 banner（fetch 探测 + dsw 主题黄底）
  - `data-tf-status="auth"` 触发黄底警告
  - banner 文案含根因（dsh launch token ≠ host token.json）+ 临时绕过 + TBD 编号
  - host 鉴权门不动（CLAUDE.md 硬约束守住）

## S3. spec 同步
- [x] 3.1 `docs/lib/specs/panels.md` frontmatter 更新 last-updated/last-verified/verified-by/cover-files
- [x] 3.2 `docs/lib/specs/panels.md` 新增"v2 补齐：官方右侧栏挂载"小节
- [x] 3.3 `docs/lib/specs/panels.md` 新增"dsh-better-sidebar 共存"小节
- [x] 3.4 `docs/lib/_status.md` 更新 spec 状态（bus/imbridge/screen stale → fresh）

## S4. 实测验收（playwright headless）
- [x] 4.1 `scripts/verify-sidebar-right.cjs`：单装 termfleet 状态截图 5 张
- [x] 4.2 `scripts/verify-coexist.cjs`：装 better-sidebar 后截图 5+ 张
- [x] 4.3 `scripts/diag-sidebar-owner.cjs`：诊断 panel/guide owner 标记，确认走官方 sidebar-right
- [x] 4.4 `scripts/verify-banner.cjs`：401 banner 显示验证（TF tab + header 浮层）
- [x] 4.5 `scripts/diag-tab-body-chrome.cjs`：TF tab body DOM 干净（仅 banner + iframe）
- [x] 4.6 `scripts/diag-dock-chrome.cjs`：DockSurface chrome 列表（确认官方，无 BS 污染）

## S5. 证据归档
- [x] 5.1 截图：`docs/audit/screens/sidebar-coexist-1..8.png`（共存 8 张）
- [x] 5.2 截图：`docs/audit/screens/sidebar-right-v2-1..4.png`（单装 4 张保留）
- [x] 5.3 截图：`docs/audit/screens/diag-1-sidebar-owner.png`（owner 标记证据）
- [x] 5.4 截图：`docs/audit/screens/banner-1-tf-tab.png`（401 banner 在 TF tab 顶部）
- [x] 5.5 截图：`docs/audit/screens/banner-2-header-float.png`（401 banner 在 header 浮层）
- [x] 5.6 诊断 log：`scripts/diag-sidebar-owner.cjs` 输出含 panel CSS 类名 `P3OORG_panel` + guide CSS 类名 `geFEbW_guide`

## S6. 已知非阻塞
- [ ] 6.1 iframe 鉴权 token 联动（dsh launch token ≠ termfleet token.json）—— 单独 TBD，change-002 排期根治（修 host 端接受 dsh launch token）
- [x] 6.2 banner UX 兜底（已完成——避免用户把 401 误判为白屏）
- [ ] 6.3 BS tab strip 与官方 sidebar-right tab strip 是否视觉统一 —— 已验证共存，未做样式对齐