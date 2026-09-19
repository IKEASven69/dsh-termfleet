# 设计基线 · dsh-termfleet client 半（2026-09-19 侦察）

> 来源全部实读：本机 DeepSeek Harness 源码仓 `D:\coding\deepseek-harness\packages\client\`（ui-primitives / ui-theme）+ dsh 安装树 `~/.version-fox/sdks/nodejs/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/`（dsh-client-modules / dsh-client-ui-settings）+ 本地 dsh-hippo（挂载先例）。
> 用途：低保真 mockup 与 M1-M3 面板实现的唯一视觉依据。策略=视觉继承宿主（PLAN 第 10 节）。

## ① 可用原子清单（@deepseek-ai/dsh-client-ui-primitives@0.1.2-rc.1）

纯 React 原子（零 cordis 依赖），CSS Modules + 主题变量，亮暗自动跟随。

| 原子 | 用途（termfleet 对应） |
|---|---|
| `Button` | 全部按钮（胶囊几何：h36/pad14/r18，sm 紧凑档 h28） |
| `Input` | 邀请码输入、任务标题输入 |
| `Modal` | 成员侧**握手卡弹窗**（允许/只读/拒绝三按钮） |
| `Pill` | 状态徽章：限时剩余、只看/可操作档位、任务状态 |
| `StateDot` | **Fleet 视图成员在线状态**、会话活动指示 |
| `ConnectionIndicator` | lead↔成员通道状态（已连/重连中/断开） |
| `TerminalBlock` | **接管终端回显**、PTY tail 展示 |
| `DiffBlock` | 成果 diff 视图（任务变更文件） |
| `RiskConfirmation` | 危险操作确认（熔断全队断开！） |
| `Toast` | 操作反馈（已断开/已拒绝/通道建立） |
| `Tooltip` / `HoverCard` | 操作按钮说明、审计条目悬浮详情 |
| `Menu` | 面板内下拉（请求操控类型选择） |
| `DisclosureRow` | 审计时间线折叠行、进度流展开 |
| `JsonTree` | 调试/审计详情查看 |
| `SearchBlock` | 会话/任务搜索 |
| `FoldToggle` / `ReadBlock` / `OnboardingSurface` / `BrandWordmark` | 折叠开关 / 只读信息块 / 首次引导 / 品牌 |

## ② 主题令牌速查（ui-theme design-platform.css）

| 令牌 | 语义 |
|---|---|
| `--dsw-alias-label-primary / -secondary / -tertiary / -caption` | 文字四级（主/次/弱/说明） |
| `--dsw-alias-bg-base / -overlay / -module-platform` | 背景：页面底/浮层/模块卡 |
| `--dsw-alias-brand-primary`（静态锚 `--dsw-static-neutral-bluish-1000`） | 品牌主色/主按钮填充（`--dsw-alias-button-primary-fill`） |
| `--dsw-alias-border-*` | 边框层级 |
| `--dsw-font-family` / `--ds-font-family-code` | 界面字体 / 等宽（终端用 code 族） |
| `--ds-transition-duration`(0.2s/-fast 0.1s/-slow 0.3s) `--ds-ease-in-out` | 动效节奏 |
| `--dsw-corner-shape: superellipse(1.5)` | 圆角形态（Button 用 r18 胶囊） |

**暗色机制**：`body[data-ds-dark-theme]` 属性切换同名 alias 变量块——**面板代码只许引用 `--dsw-alias-*` 语义层，禁止写死颜色**，亮暗即自动跟随宿主。

## ③ 面板挂载配方（照 hippo 已验证形态）

```jsonc
// package.json
{ "exports": { "./client": "./lib/client.js" },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "inject": ["@deepseek-ai/dsh-client-runtime", "@deepseek-ai/dsh-client-ui-settings"],
      "platform": "web"
    } } }
```

```js
// lib/client.js（构建产物形态）
window.__ModuleLoader__.load({
  id: "dsh-termfleet",
  factory: (require) => {
    const runtime = require("@deepseek-ai/dsh-client-runtime")
    const settings = require("@deepseek-ai/dsh-client-ui-settings")
    // 在此注册面板/设置页/偏好；host API 经插件 webServer 路由 fetch（带鉴权令牌）
  },
})
```

- `inject` 数组=工厂可 require 的客户端 DI 模块；`dsh-client-ui-settings` 提供 settings chrome/pages/header actions/**plugin tabs**/onboarding 扩展点（preferences 读写走 Host settings 文档，带 schema 校验与并发保护）
- host 半 API：插件 webServer 路由 + 本库鉴权门（Bearer）；整页工作台形态参 hippo `/dsh-hippo/app`（webServer 路由 + client 页面）
- 深度注入面（sidebar/对话流内嵌）属 dsh-client-ui-conversation 等包，M3 感知面再侦察，M1 先用 settings plugin tab + 独立页两种形态

## ④ 布局惯例（M1 低保真依据）

- 官方扩展点：**settings 的 plugin tab**（低侵入、第一落点）+ **独立页**（工作台重界面，参 hippo /app）
- 组件几何：胶囊按钮（h36/r18，密集行用 sm）、Pill 徽章表状态、StateDot 表在线、TerminalBlock 表终端、DisclosureRow 表可折叠时间线
- 信息分级用 label 四级令牌，不用自造灰阶
- 密度参照：Fleet 视图成员行 = StateDot + 名字(label-primary) + 一行进度摘要(label-tertiary) + Pill(状态) + 操作 Menu

## ⑤ Do / Don't

- **Do**：全部用 primitives 原子 + `--dsw-alias-*` 令牌；亮暗交给宿主；几何抄官方（胶囊/密集档）；Fleet 用官方 chrome 形态（tab/页面）
- **Don't**：**禁止自造视觉**——不写死色值（含 hover/边框/阴影色）、不发明新圆角体系、不引第三方 UI 库、不自造 toast/弹窗；mockup 阶段用近似色示意可以，落码一律令牌化
