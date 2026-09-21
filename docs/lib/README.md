# Doclib

项目结构化文档库：模块规格、变更追踪、bug 记录、专项计划、架构决策和验证证据。

## 常用入口

- `specs/_modules.md`：模块总览。
- `_status.md`：全局仪表盘，由 `npm run doc:status` 生成。
- `bugs/_index.md`：bug 状态索引，由 `npm run doc:status` 或 `npm run doc:record-bug` 生成。
- `planning/plans/active/`：零散专项计划。

## 常用命令

```bash
npm run doc:status
npm run doc:health
npm run doc:search -- <keyword>
npm run doc:plan -- <slug> -- --title "..."
npm run doc:new-change -- <id> -- --title "..."
npm run doc:record-bug -- <slug> -- --title "..."
npm run doc:sync-module -- <module>
```
