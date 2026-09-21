---
module: host
status: active
last-updated: 2026-09-19
last-verified: 2026-09-19
verified-by: m1-auth-gate
cover-files: ["src/index.ts", "lib/index.js", "cordis.patch.yml"]
---

# host 规格书

## 职责
宿主挂载层：cordis.patch.yml 声明插件注入面；注册全部 webServer 路由；令牌鉴权门（M1）；管理各子模块（bus/relay/screen/im/membridge）的装载与生命周期。

## 架构
- cordis.patch.yml：insert dsh-termfleet（M0 已验 --dump-config 合成）
- 无构建管线期间 src/index.ts 与 lib/index.js 双写（宿主经 file:// 装载 lib）

## 关键文件
- src/index.ts（源） / lib/index.js（装载物镜像）
- cordis.patch.yml

## 接口契约
- 全路由过鉴权门（2026-09-19 实测：无令牌 401 / 错令牌 401 / 正确 Bearer 200 / ?token= 200）
- GET /dsh-termfleet/ping → {"ok":true}
- 令牌：~/.dsh/termfleet/token.json（randomBytes(24)，timingSafeEqual 比较，装载失败 fail-closed 持续 401）
- M0 探针路由：/dsh-termfleet/probe-session、/dsh-termfleet/probe-pty

## 依赖
- @deepseek-ai/cordis、@deepseek-ai/dsh-host-webserver（peer，可选）

## 关联流程
- [consent-takeover](../flows/consent-takeover.md)

## 已知陷阱 / 设计约束
- 插件路由绕过 dsh launch token（M0 发现）→ M1 第一件事加鉴权门（见 decisions.md）
- 自建会话必传 meta.cwd；同 id 重建抛 SessionAlreadyExistsError
- 零费用测试需关 title-LLM（否则发网络请求）

## 错题记录
（暂无）
