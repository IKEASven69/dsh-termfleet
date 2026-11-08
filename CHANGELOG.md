# Changelog

## 0.1.0 — 2026-11-08（首发）

dsh 团队驾驶舱插件首个公开发布。lead 与成员同装一个插件，获得**会话级**远程协作：连会话不连桌面，全部动作过统一同意/审计总线。

### 核心能力

- **会话流镜像 + 插话**（契约 A/B/C）：成员 dsh 会话对话流实时镜像到 lead 面板（user/assistant/tool 分气泡）；lead 插话经 rw 通道写入成员活动会话，回执（followup-ack）闭环；ro/rw 服务端双端强制门控。
- **同意总线**：连接握手卡（允许/仅只读/拒绝）、30 分钟限时（跨机）、全程审计留痕、成员侧断开跨总线即时传播；**本机直连免确认且不限时**（同源会话连自己的 shell）。
- **信任快捷通道**（契约 I）：成员开信任后 lead 一键请求自动允许只读（auto=ro 落库透传、审计留痕），关信任即门闸；rw 接管永远手动点头。
- **TF-JOIN 一句话入队**（契约 D）：lead 面板取码 → 成员粘贴即配对上线（码内含 lead 总线地址+团队令牌；支持 ?u= 显式局域网地址）。
- **通知闭环**（契约 E）：member-join / consent-request / progress 面板弹条 + IM webhook 双向（审批卡经 IM 回复 allow/ro/deny）。
- **任务↔会话强关联 + 任务板跨机同步**（契约 F/G）：任务绑定 sessionId（不存名字）、弱匹配一键转正、op 上行/全量广播/删除墓碑/上线对账、id 舰队名标签防撞；10 态 unified-board 转移表+验收条目+待确认门禁+两盏灯+打回计数。
- **摘要推送**（契约 H）：成员侧五态状态机（迁移才推）+ 分级频控（waiting-input 零误报零冷却 / 启发式 30min 冷却）+ lead 忙碌抑制 + 阈值 env。
- **查重 v1.1**：标题 bigram Jaccard（阈值 env，默认 0.55），创建时提示非拦截；v1 的 desc 稀释缺陷已修。
- **xterm.js 原生终端**：PTY 流原生渲染（vendored UMD，零 CDN），逐键裸流转发；真实键事件 E2E 全链验证。
- **四页 IA**：远程（context 状态机 none/local/member）/ 任务（行列表+★置顶+看板切换）/ 避坑库 / 审计（分色+筛选）；右栏原生任务板与远程视图（better-sidebar 0.28 双路径兼容）。
- **doclib**：seal（SHA-256 账本）+ linkcheck。

### 兼容性

- dsh 0.2.0-rc.2 / 0.2.1-alpha.2 / **0.2.1-rc.5 实测全绿**（38 项 E2E：p0 15 + lan 3 + 原生板 6 + 原生远程 4 + 共存 4 + 键击 6）。
- better-sidebar 0.28 共存（dock 接管下经 `betterSidebar.registerTab` 注册）；0.19.1 会被 dsh 兼容守卫禁用（上游行为）。

### 已知边界（如实）

- 真双机录屏验收（ACCEPTANCE-M1 #0-#10）待第二台机器；单机双实例+LAN 转发路径已全覆盖。
- IM 实发需真实 webhook 环境（E2E 验证到转发路径）。
- 成本聚合暂缓（dsh-cost-meter 无文档化数据接口）；回放切片排 P2 末位。
- dsh launch token 与插件令牌不联动：首次经按钮打开面板需按授权卡粘贴一次 token（之后永久生效）。
- better-sidebar 0.28 首挂竞态（上游）：刚启动就点 TermFleet 标签偶发「空面板」，切走再切回即愈；原生面注册后右下角不再出现兜底按钮。

### 安装

```
dsh plugin --profile web add github:IKEASven69/dsh-termfleet
# npm 发布后可用：dsh plugin --profile web add dsh-termfleet
```
