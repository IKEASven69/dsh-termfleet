# dsh-termfleet npm 首发 + 市场收录检查单（2026-11-08 备妥，等用户执行）

> 参照 takeover 线踩平的流程（docs 里同款文件）。本文件只备料；publish 需要用户 npm 账号（cold777）EOTP，由用户终端执行。

## 0. 现状核对（2026-11-08 实查）

- npm 名 `dsh-termfleet` 无人占用（registry 404）——**占名是本次发版第一动机**（takeover 的 `dsh-takeover` 被同日抢注的教训：README 公开公示名字一个月后被 squatted）。
- 分发三渠道已就绪：①awesome-dsh-plugin 目录（收录=一个 yml 的 PR，bot 按 repository.url 自动认领 npm 包补 npm 名/安装命令/下载量）②dsh-plugin-shop-catalog（2026.1105 新目录包）③官方「插件→发现」页读目录 index.json。
- 0.1.0 材料已备：package.json（private 已摘/version/repository/keywords/engines）+ LICENSE（MIT）+ CHANGELOG.md + README（双语）。

## 1. 发布前检查（我来做 / 已做打勾）

- [x] `private` 已从 package.json 移除（否则 publish 直接拒绝）
- [x] `files` = lib/ + cordis.patch.yml（npm 自动附 README/CHANGELOG/LICENSE/package.json）
- [x] `repository.url` 指回本仓（awesome bot 认领凭据，必须有）
- [x] peerDependencies 保持 `*`（takeover 的预发布范围坑与我们无关——`*` 匹配一切含 prerelease；收紧等上游 0.2 stable）
- [x] LICENSE 文件落盘（此前只有字段没有文件）
- [x] CHANGELOG.md 0.1.0 全量条目（含已知边界如实段）
- [x] README 双语重写（安装行 npm 版本等发布后启用）
- [ ] 发布前最后一跑：六套件全绿（本轮验收，结果回填 P1-ACCEPTANCE）
- [ ] `npm pack --dry-run` 过目 tarball 清单（确认无 scripts/、docs/、screens 混入）
- [ ] 隐私审计：git log 无密钥/策略词（termfleet 历史无竞品叙事，grep AKIA/ghp_/token 实值复核）

## 2. 发布步骤（用户执行）

1. `cd D:/coding/dsh-termfleet && npm login`（cold777 账号，EOTP 流）
2. `npm publish --access public`
3. PUT 202「package is being processed」≈2 分钟异步上线，期间 view 404 别慌
4. 验证三连：`npm view dsh-termfleet dist-tags`；`repository.url` 指回 GitHub；干净 profile `dsh plugin --profile web add dsh-termfleet` 真装一轮
5. README「安装」节启用 npm 命令行（发布后我来改）

## 3. 市场收录（首发 PR）

- 文件：awesome-dsh-plugin 仓 `data/plugins/IKEASven69__dsh-termfleet.yml`（新建条目，勿手编 README）
- 字段：name/description（中文一句）/category=team/tags=[team,session,cockpit]/repo 指本仓
- **不手写 `npm:` 字段**（bot 自动认领）；不发版本化 tarball（npm 是主路径；如发 Release 资产，文件名不带版本号 → `releases/latest/download/dsh-termfleet.tgz`）
- dsh-plugin-shop-catalog 渠道：观察其收录机制后补（2026.1105 刚发，机制未查）

## 4. 发布后

- GitHub Release v0.1.0 + tag（CHANGELOG 摘要）
- P1-ACCEPTANCE 回填「0.1.0 发布」节
- 记忆更新：发布状态 + npm 名占用情况
