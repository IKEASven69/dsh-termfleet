# dsh-termfleet

团队驾驶舱 dsh 插件：lead/成员同装，跨成员远程桌面围观、终端/DSH 会话接管、IM 审批、任务面板、团队记忆，全部过统一同意/审计总线。

## 文档库

本项目使用 docs/lib 文档库系统（doclib skill）。修改代码前先读对应模块的 SPEC（docs/lib/specs/）。
- 权威主计划：PLAN.md（决策 D1-D10 / 架构图 / 里程碑 / M0 实测结论）
- 模块地图：docs/lib/specs/_modules.md
- 开工任务序：docs/lib/planning/phases/M1.md
- 常用：npm run doc:status / doc:health / doc:record-bug / doc:sync-module -- <module>

## 硬约束速记

- 一切远程动作必须过统一同意/审计总线；成员机零入站端口（全出站 WS）
- 生态件只参考不直用（直用白名单仅 hippo）；视觉继承宿主（官方原子+主题，禁自造）
- 无构建管线前 src/ 与 lib/ 双写同步（宿主装载 lib）
- 插件路由必须过鉴权门（M0 发现路由绕过 launch token）
