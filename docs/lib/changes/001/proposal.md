---
id: 001
title: v2 sidebar 补齐：挂官方 sidebar-right + 与 dsh-better-sidebar 共存
status: complete
specs_impacted: [panels]
links: []
created: 2026-09-23
updated: 2026-09-23
---

# v2 sidebar 补齐：挂官方 sidebar-right + 与 dsh-better-sidebar 共存

## 背景

M1 收口阶段（[M1.md phase: M1, 2026-09-19 起]）已实现 termfleet 在 dsh web 内的入口（`conversation.session.header.utilities` 槽 + 右侧 480px iframe 浮层）。但 TBD.md #7 记录：panel 游离于宿主 UI 之外——官方右侧栏无入口。dsh-better-sidebar 是社区主流右栏插件，调研阶段（[DSH-ECOSYSTEM-SCAN-0918.md]）已记录在案；v0.19.0+ 已改走 DSH 原生侧边栏 API，与本插件潜在共存/抢位风险需实测。

## 目标

1. termfleet TF 入口出现在 dsh 官方右侧栏（`@deepseek-ai/dsh-client-ui-sidebar-right` 提供），独立于 header 浮层。
2. 装上 dsh-better-sidebar 后，TF 与 BS 6 个内置 tab 类型（files/git/subagent/sidechat/terminal/browser）在同一引导页共存，零冲突。
3. 用户既有工作流（header 浮层）保持不变，仅为增量。
4. iframe 鉴权 401 时用户看到明确提示而非一行 JSON（避免误判"白屏"），**host 鉴权门不放开**（CLAUDE.md 硬约束守住）。

可验证：
- 官方引导页出现 `kind=termfleet` 引导胶囊，文案"TermFleet 团队驾驶舱"
- 点击引导胶囊 → 官方 DockSurface tab strip 出现 TermFleet chip + chrome
- BS 装上后，引导页 7 个胶囊并排（6 BS + 1 TF），无抢位
- host 鉴权门 401 时 TF tab 顶部显式 banner（黄底警告），文案含根因 + TBD 编号

## 方案

`lib/client.js` v2 增量注册三个槽位，与 `dsh-client-ui-sidebar-files` 同款 API：

```js
exports.inject = ["slots", "sidebarRightTabs"];
exports.apply = function (ctx) {
  // 1) tab 类型定义（effect 包裹，DSH 自家 effect 注册模式）
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: "dsh-termfleet",
    kind: "termfleet",
    priority: "builtin",
    title: () => "TermFleet",
    guide: [{
      order: 50,
      title: () => "TermFleet 团队驾驶舱",
      description: () => "任务 / 远程 / 避坑 / 审计 · 全过统一同意总线",
      icon: TfGuideIcon
    }]
  }), "dsh-termfleet: tab definition");

  // 2) tab 主体（keyed slot, key="dsh-termfleet"）
  ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register(
    { name: "sidebar.right.pane.tab", key: "dsh-termfleet" },
    () => h(TfTabBody)));

  // 3) tab chip 标题
  ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register(
    { name: "sidebar.right.pane.tab.title", key: "dsh-termfleet" },
    () => h(TfTabTitle)));

  // 4) 原状保留：header utility 入口（v1）
  ctx.slots.inject("conversation.session.header.utilities", ...);
};
```

**401 banner**：`TfTabBody` + `EntryPanel` 浮层都加 fetch 探测 `/dsh-termfleet/app` —— 401 时在 iframe 之上显示黄底 banner（`[data-tf-status="auth"]`），文案含根因 + 临时绕过 + TBD 编号。host 鉴权门不动（CLAUDE.md 硬约束守住）。

实现选择：
- **iframe 形态** body：先复用现有 `/dsh-termfleet/app` 页面（v1 header 浮层已实测 verify-1~6.png）。M3 视觉收口期换真 React + `@deepseek-ai/dsh-client-ui-primitives` 原子组件。
- **kind="termfleet"** vs BS 的 `files`/`git`/`subagent`/`sidechat`/`terminal`/`browser`：keyspace 互不交叉，零冲突。
- **TfGuideIcon**：CSS 变量驱动的方块（`--dsw-alias-brand-primary`），无私有 CSS，零全局污染。
- **401 banner**：fetch 探测 (`credentials: "include"`，走 dsh session cookie)，覆盖 `auth/error/network/network` 四种 status；用 dsw 主题变量（`--dsw-alias-bg-warning-soft` 等），亮暗自动。

## 非目标

- 不替换/重写 header 浮层（v1 仍保留，v2 是**增量**而非替换）
- 不实现 React + primitives 打包管线（plan: M3 视觉收口期统一收口，按 panels.md 第 10 节）
- 不修 iframe 鉴权 token 联动（dsh launch token ≠ termfleet token.json）—— 根治放 change-002；本次只加 401 banner
- 不实现与 better-sidebar 的双向联动（如 TF tab 触发 BS 某个 tab）；保持注册独立