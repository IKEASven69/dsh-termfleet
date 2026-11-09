# 0.1.1 预研（2026-11-10）

> 触发：用户发布 0.1.0（见「npm 发布实况」——实际先发了 0.0.0-stage 占位）+ 要求「做 0.1.1 预研，说实话我都没看过当前的效果」→ 补录了当前 UI 的全功能演示视频，并在录制过程中钓出一个真产品 bug（已修）。本文件 = 0.1.1 的内容建议与依据。

## 一、npm 发布实况（先说清楚）

- `dsh-termfleet@0.0.0-stage`（cold777，2026-11-09 16:17 UTC）= **用户账号发的占位版**：描述已是 TermFleet 新文案、但 version 是 0.0.0-stage、无 repository 字段。**名字占住了（反抢注第一目标达成）**，但真正的 0.1.0 还没上去。
- 补发（用户一条命令）：`cd D:/coding/dsh-termfleet && npm publish --access public` → latest 变 0.1.0。可选收尾：`npm deprecate dsh-termfleet@0.0.0-stage "占位版本，请安装 0.1.0+"`。
- 待办（0.1.0 真上线后）：README 安装节启用 npm 命令行；awesome-dsh-plugin 新条目 PR（yml 草案见 docs/release/npm-and-market.md §3）；干净 profile `dsh plugin add dsh-termfleet` 真装一轮。

## 二、演示视频（本次新增基建 + 已知两处录制级限制）

- 产出：`docs/audit/video/termfleet-010-demo.webm`（5.8MB，一镜到底，10 项断言全过 exit 0）；脚本 `scripts/record-010-demo.mjs` 可稳态复跑。
- 场景：none 态双 CTA → 本机 pwsh 探针（xterm 真实键入回显）→ 取码 → 成员粘贴入队 → 开信任 → ⚡一键查看(自动允许 ro) → rw 经典审批卡 → 成员会话三连发实时滚入（32 条气泡）→ 插话 ✓已送达 → 绑定任务跨机同步+详情会话绑定卡 → 审计收尾。
- 录制级限制（非产品问题）：①xterm 键入在 wrapper iframe 里真实键盘焦点链不稳，脚本带「合成小写兜底」路径（视觉等价，大写会被合成层丢）；②同框录制用单包装页双 iframe（沿用 10-14 结论）。

## 三、录制钓出的真产品 bug（已修，0.1.1 首项）

**纯中文名成员 → 任务跨机「双胞胎」**：舰队 id 标签由实例名清洗（只留 ASCII 字母数字）生成——成员名「演示成员-风格预览」清洗后为空 → 成员侧任务 id 为裸 `T-001` → 上行 create 的 id 过不了保留格式校验（`/^T-\d{3}-[A-Za-z0-9]{1,8}$/`）→ lead 重新生成带自己标签的 `T-001-LEADA` → **同一逻辑任务在两机两个 id**（同步去重失效）。中文团队名是本产品常见场景。
修复：idTag 空标签时用实例名的确定性哈希兜底（base36 4 位，跨重启稳定，格式校验内）。修复后录屏实证：成员 `T-001-ON4G` → lead 同 id 保留 ✓。

## 四、0.1.1 内容建议

**已就绪（随 0.1.1 发）**
1. idTag 哈希兜底（见三；commit 待推）。

**建议纳入（小件，1 天内）**
2. better-sidebar 0.28 首挂竞态：向 bs 仓提 issue（首点「空面板」组件未被调用，切走切回自愈——diag 实证在 verify-coexist 留档）；我方文档已有，缺上游一跳。
3. 成员主权面小步版：成员面板「谁在看我」一屏（查 consent/list 里 remote active 的记录）+「一键结束全部被看」（批量 /consent/end）——第 5 扫 P1 提案的 1 天切片，差异化卖点先立住。

**0.2.0 候选（大件，等拍板）**
4. ⇄交接给成员（termfleet × takeover handoff:1，第 5 扫 P1 提案）。
5. superagent presence 桥（消费官方钦点的无消费者域事件）。
6. team-memory 事件源（总线帧喂 L1/L2）。

**兼容 watch**
7. dsh 0.2.2-rc.1（latest 11-04）：升级时六套件回归；peer 收紧到实证范围（现 `*`）。

## 五、建议节奏

0.1.1 = 修复版（#1+#2+#3，~1 天）→ 用户补发 0.1.0 后紧接着发 0.1.1（npm 名已占，无抢注风险）。0.2.0 = 功能版（#4/#5/#6 按用户时刻排序选一）。
