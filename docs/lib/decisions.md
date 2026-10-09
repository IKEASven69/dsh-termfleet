# Decisions

架构决策记录（只保留生效结论；完整背景与备选分析见 PLAN.md 第 1 节 D1-D10 与 termfleet-heimdall 仓库 Agent Notes）。

## 2026-09-19 · D1 纯 dsh 插件形态，Orca fork 另立一线

lead/成员同装一个插件，出站 WS 星型连 lead 插件端点；不依赖任何外部 app。Orca fork 是独立项目线，互不依赖（用户纠正过一次混线，勿再犯）。

## 2026-09-19 · D5 统一同意/审计总线是唯一从零核心

握手卡（允许/只读/拒绝·随时断开）+ 配对（邀请码→设备令牌）+ 策略（角色/限时/范围/权限分级）+ 全量审计（可回放）+ 熔断。桌面与终端共用同一张卡、同一个断开按钮。relay/screen 的一切远程动作必须过 bus。

## 2026-09-19 · D7 生态件只参考不直用（用户定调）

第三方插件一律只读源码参考；直用白名单仅 hippo（自家作品）。IM 桥自研薄层（webapp im.ts 出站底子 + 收方向参考 dsh-reach 长连接）；桌面壳 dsh-plugin-desktop 为用户自选外部件非依赖。理由：信任类产品不背第三方供应链风险 + dsh 0.1.x 快跑的版本风险。

## 2026-09-19 · M0 判定：会话流取宿主内 seam，弃 api-gateway 兜底

实测宿主进程内 listener 可收全量会话事件（seq0-16 完整），写入走 agentLoop.create + createUserMessage + agent.followup（官方 prompt RPC 同款）。D8 降级路径未触发。约束：自建会话必传 meta.cwd；同 id 重建抛 SessionAlreadyExistsError；零费用需关 title-LLM。

## 2026-09-19 · M1 安全约束：插件路由必须先过鉴权门再上总线

M0 副产物发现：插件 webServer 直挂路由绕过 dsh launch token 信任栅。全部路由（含 probe/ping）必须校验 Bearer 令牌，无豁免。令牌持久化于 ~/.dsh/termfleet/（新增目录，不碰 profiles）。

## 2026-09-19 · D9 团队记忆 = git 仓 + hippo federation（已实测成立）

HIPPO_DATA_DIR 沙箱验证：scan 入库、新成员 clone 全量、recall 命中、幂等全通。注意：federation 目录源只吃 .md（JSONL 需单列文件级 source）；scan 用 import hippo dist 直调；recall 按 project 域隔离。

## 2026-09-19 · 前端视觉继承宿主（PLAN 第 10 节四道保险）

client 半全部用 @deepseek-ai/dsh-client-ui-primitives 官方原子 + 官方主题（亮暗跟随宿主）；布局抄 Orca/VSCode/Linear 成熟模式；低保真 2-3 版用户圈点定稿后才动代码；每里程碑截图过目。先并入 DeepSeek 样式，后期再分化（用户确认）。

## 2026-09-19 · 任务详情=五 tab 钻取视图（全流程定位/seq 细节/notes 治理/workflow）

用户定稿方向：任务管理要能钻到任务内每一个细节并全流程跟踪；决策笔记治理（write-notes-like-deepseek，目录即状态+验收自动登记）与 dsh workflow run 直接挂进任务详情。规格见 specs/panels.md「任务详情·五 tab」。

## 2026-09-19 · 信息架构定稿：三页制（远程/任务/审计），远程桌面软件心智

用户定调：远程就是远程、任务就是任务，不挤一处。一级导航三页：
- **远程**（默认页，ToDesk/向日葵心智）：左侧设备/成员列表（在线态+机器名+会话计数）→ 右侧远程会话窗（会话条混排 **dsh 会话 + 其他 CLI 终端**（PTY 托管、可新开 pwsh7/cmd/git-bash/自定义）→ 窗内工具栏 终端视图/屏幕围观切换、只读/可操作、限时、断开）。
- **任务**：纯任务管理（筛选/批量/流转/详情五 tab 钻取），接管动作不在任务页——任务行给「去远程」跳转。
- **审计**：全局时间线（连接/审批/任务分栏筛选）。
关键补充：可连接对象=**两类**（dsh 会话走宿主 listener、任意 CLI 走插件 PTY），同一同意卡覆盖。mockup v4=docs/mockups/m1-mockups.html（v4-*.png 实测截图）。

## 2026-09-19 · 任务面板语义纠偏：项目级共享任务板（非 lead 派活清单）

用户定调：任务是**整个项目的任务**，面板=全员共享查看的看板；任何人可建/认领/更新，指派是可选项非必经动作；会话与任务**自动关联**（cwd/任务标记匹配），不是指派的结果。页面形态：看板（默认，待办/进行中/待验收/完成 四列）+列表双视图；项目/仓库维度筛选；批量操作保留但「派活」仅 lead 可见。mockup v5=v5-task-board/list.png。

## 2026-09-19 · 远程对象=会话而非桌面（远程桌面出列，隐私边界）

用户定调：要的是**远程 dsh 会话**（含 CLI 会话）——像手机端操控自己电脑那样附加会话（看进度/答审批/发指令），只不过连的是队友+同意门；整桌面远程侵犯隐私，出列降级 backlog（先例笔记 m0-screen-notes.md 保留备用）。远程窗交互=会话级：答权限卡透传、发指令、只读/可操作、限时、断开；「直接连接也更无感」=边界只到会话，成员无桌面暴露。M2 范围同步改（屏幕流删）。

## 2026-09-19 · 任务面板 v1 实现形态：宿主路由 + 单文件页 + 官方图标内联

任务面板提前落真（用户催动）：host 半 taskStore（JSON 落盘 ~/.dsh/termfleet/tasks.json，状态机 todo/doing/review/done/blocked，全操作记 history）+ 路由 /app|/tasks|/tasks/create|/tasks/action（全过鉴权门，身份=X-TF-User 头需 encodeURIComponent）+ lib/app.html 单文件页（scripts/gen-app-html.mjs 生成，官方图标自 ui-primitives icons/index.tsx 提取内联 docs/design-assets/icons-official.json，色值=令牌实测）。待总线后升级：成员真实身份、六 tab 深钻、会话自动关联。

## 2026-09-19 · 排期纠偏：避坑库从 M3 提前（用户拍板）

原排序逻辑=M1 验收绑定接管闭环、记忆等验收做触发源；用户指出避坑库无总线依赖、不应后置。提前落地 v1：文件式团队记忆（md 文件即记录，目录即团队仓工作副本）+ 避坑库面板 + 完成任务自动弹蒸馏表单。hippo federation 指向目录即成共享层（机制 M0 已验）；后续接 hippo recall 语义检索与新成员开局注入仍在 M3 深化。

## 2026-09-19 · 同意总线 v0：状态机+服务端强制门控（主干落地）

握手卡状态机（pending→active(rw|ro)/denied；active→ended/expired）+30min 过期；consent.json 落盘跨刷新；全操作入审计。**强制点在服务端**：PTY 读需 active、写需 rw，无通道/只读一律 403——UI 只是展示，绕不过。SSE=宿主 webServer 文档明示的持有响应形态。成员侧 decide 单机模拟（跨机 WS 后替换来源，状态机不变）。

## 2026-09-19 · 决策笔记库 v2=wnlds 治理产品化（目录即状态/六分类/流转拦截/校验门）

用户纠偏：看过 write-notes-like-deepseek 就该按它的治理做，不是薄 md 文件。落地四态目录树+六分类+合法流转表（非法 409）+/memory/verify 校验门（proposed 必含备选段——最强理由+为何放弃）+面板看板统计/双筛选/流转菜单；蒸馏钩子默认 implemented/process 并带备选模板；文件即记录、流转即目录移动（git diff 可见）。旧扁平 md 自动迁移 implemented/process；真实项目决策种子 6 条（.seeded 一次性）。

## 2026-09-19 · 跨机总线 v1：成员出站 WS + 会话/同意/PTY 全中继

busLink（lead=registerUpgrade ws；member=出站重连）；pairing.json+TERMFLEET_* env 覆盖；成员上报会话事件/pty 输出，lead 下发请求/指令；consent 全链跨机（请求下发→成员本机弹卡→decide 回传）；/remote/write 暂未挂同意门（复用 lead 通道判定，M1 收口时统一入 guard——记 TBD）。
重连风暴教训：定时器重连必须在 close 后调度，成功连接不得再排重连；旧连接 close 事件不得删除同名新注册（conns.get(name).ws===ws 判定）。

## 2026-09-20 · M1 收口+M2 v1：门控统一/成员端双验证/IM 出站/SOS

remote-write 三态门控与 probe-pty 一致；成员机只执行带本机 active 远端 rw 通道的指令（双端验证）。IM 薄桥 v1=出站 webhook（审批卡+ SOS，飞书格式自适应），收方向（聊天内答复）待飞书自建应用凭据（M2 后续）。SOS=成员→lead 总线消息+IM 双路，lead 页徽标。

## 2026-09-20 · 实机网络方案：dsh 禁绑 0.0.0.0 → 用户态 lan-forwarder

dsh 宿主明示禁绑 0.0.0.0（防 RCE 暴露，安全设计）——不绕宿主，用 scripts/lan-forwarder.mjs 做用户态 TCP 转发（3182→3180，透明支持 HTTP/WS），局域网暴露面收敛到转发器端口+防火墙规则。跨网段后续走 Tailscale/FRP（协议不变）。

## 2026-09-20 · 仓库形态：monorepo 开发 + 发布时拆独立（市场可安装性坑）

用户指出既踩坑：monorepo 子目录不能被 dsh plugin add（pnpm 不支持 git 子目录）。定调：开发期留 monorepo（集中地惯例/文档/巡检共享，且 --patch 启动不依赖市场）；发布日 subtree split 拆独立仓或 npm publish（同 dsh-opencli/dsh-hippo 先例）。MEMBER-SETUP 的 clone 方式与发布形态不冲突（两条路并行）。

## 2026-09-20 · 本机 LAN-IP 自测噪音：Clash TUN 劫持（重要教训）

本机 curl 经 192.168.1.x 访问本机转发器：TCP 握手被 TUN/fake-ip 应答（curl 显示 Connected），载荷进代理栈被丢弃（empty reply）——极像服务端 bug，实为本机代理环境。判定法：127.0.0.1 同转发器同端口 200 而 LAN IP 000，即环境噪音。跨机验收以成员机发起为准。forwarder v2 保留首请求头 Host 改写（对 dsh fence 稳妥）。

## 2026-10-05 · dsh 0.2.0-rc.2 兼容性回归结论

本机 dsh 已是 0.2.0-rc.2（此前五件套全部隐式在 0.2.0 上验证）。显式回归补测：host 13 路由全 200、鉴权门 401、client 半加载 ok、manifest 收录、PTY 通道全链通（V020_OK 回显）。**唯一不兼容点：conversation.session.header.utilities 槽在 0.2.0 已删**（0.2.0 DOM 实测只剩 corner，且 rightbar.session 已被 mf 占用）。修复=双通道入口：0.1.x utilities 槽注册 + 全版本 DOM 兜底 TF 按钮（fixed 右下角，零框架依赖）。0.2.0 桌面 UI 改版（左侧新导航+预览版弹窗），TermFleet 面板在同框下工作正常（43/44-v020 截图）。

## 2026-10-07 · P0 会话流镜像 v1：契约 A/B/C 三帧 + 服务端三态门控（E2E 全绿）

会话流上行（契约 A）：成员机仅在本机 sess 同意激活期间（rw/ro 且 target 匹配本成员）把会话事件上行，帧 `{t:'sess-event', member, consentId, ev:{type,text,ts,sessionId,seq}}`，type 四桶映射 user/assistant/tool/status、text=brief 截 200 字（lib/index.js:722-730、evBucket :108-115）；lead 侧转入 member-stream 环形缓冲并实时转发订阅者（:584-591），面板经 SSE `/dsh-termfleet/member-stream` 消费。插话（契约 C）：lead 下行 `{t:'followup', member, text}`，成员端二次验证（active sess 通道+rw+target 匹配，与 PTY 双端验证同款）后 injectFollowup 注入本机 dsh 会话，回执 `{t:'followup-ack', member, ok, via, reason}` 存 lastFollowupAck 并转 member-stream 供面板显示「✓ 已送达」（:677-689）。断开传播（契约 B）：成员机（独立同意库）/consent/end 经总线使 lead 同库同 id 收口 ended，member-stream 即时收 event:'end'，重连 403 拒绝旧缓冲重放（:606-619、:748-749）。**门控在服务端**：member-stream/interject 按成员粒度查激活同意——无同意 403 no-consent、ro 流可见但插话 403 readonly-channel、rw 才放行（:481、:1334-1364）。坑：followup 处理闭包内曾裸调 busLink.memberSend（未定义）把成员宿主打崩（dsh fatal load failure），回执必须用当前连接 `send(member.ws,...)`（:681）。S2 注：助手回合由 dsh 假 provider（termfleet-probe-noop，M0 同款）产生，非真实 LLM 文本，零 API 费。

## 2026-10-07 · 契约 D：TF-JOIN 邀请码格式 = 'TF1-' + base64url(JSON{u,t,n})

愿望机原则落地（粘贴即配对，不填 URL/token）。码 = `'TF1-' + base64url(JSON{u:总线地址, t:团队令牌, n:lead 名})`（lib/index.js:1262-1284）。总线地址取值优先级：`?u=` 显式覆盖（跨机经 lan-forwarder 时由面板传）> `TERMFLEET_LEAD_ADVERTISE_URL` > 本请求 Host 头——端口无关，换端口/转发不废码。join 路由校验 TF1- 前缀+u/t 必填（坏码 400 bad-code / bad-code-payload 带原因），写 pairing.json 后 memberStart+memberReconnect 立即按新配置重连（:1286-1311）；**TERMFLEET_* 环境变量仍优先于 pairing.json**（loadCfg 既有覆盖逻辑，被 env 接管的实例 join 后以 env 为准）。E2E 实测：配对前 role=off（env 隔离）→ 粘贴 TF1-码（len=115）→ toast 已加入 → 2045ms 内 lead 成员列表出现该成员。

## 2026-10-07 · 契约 E：面板通知 = bus.notify 队列 + SSE event:'tf-notify'

通知统一走 `bus.notify` 订阅列表，`emitNotify(kind, text≤200)` 产生 `{kind, text, ts}`（lib/index.js:103-108）；`/stream?k=events` 附加订阅 bus.notify，以 `event:'tf-notify'` 转发面板（:1627、:1644）。事件种类：member-join（成员上线，:577）、consent-request（连接请求，带「去处理」跳转）、interject、task。面板渲染 .tfnotif 弹条 + `[data-tfgo]` 去处理按钮；E2E 实测两种弹条 DOM 均出现（「P0-MEMBER 上线」/「me 请求连接 sess → member:P0-MEMBER」hasGo=true），7s 窗口内截图 p0-4-tf-notify.png。IM 卡（既有）与系统通知（可选，dsh 0.2.0 notification surface 待查）另行补充，面板弹条为保底通道。

## 2026-10-07 · 面板角色标记 _mine：CH 被替换/恢复时必须回填（评审 #2 修复）

成员面板答复同意后不得自开 pty、不自订阅 member-stream（开了只会撞出「成员机不在线」误弹与对本机 member-stream 的 403 噪音）——lead 专属动作以 `CH._mine` 门控。语义链（gen-app-html.mjs）：lead 发起=true（requestChannel :715）、成员收卡=false（:707）、**decide() 进函数先捕获 `mine` 再回填**（:717-728，服务端回包 `CH=d.consent` 整体替换会丢本地标记）、轮询分支同款（:701）、启动恢复由服务端权威字段派生 `CH._mine=!c.remote`（:1382，remote 仅成员实例 WS 路径会置，lead 实例恒无——双向误判均无通路，独立复审穷举 7 个 CH= 赋值点确认闭环）。教训：首轮修复直接查替换后的 `CH._mine`，S8 抓出仍 2 次自订阅；二跑仍漏启动恢复路径——**标记必须随对象生命周期走，不能只看替换后的字段**。

## 2026-10-07 · 邀请码地址契约升级：面板 tfAdvertise(location) 显式传 `?u=`（评审 #3 修复）

Host 头回落（优先级第三）在跨机经 lan-forwarder 时不可达——forwarder 首请求 Host 改写为 127.0.0.1，码内地址成员机连不上。修复：面板按浏览器 location 计算 `tfAdvertise()`（gen-app-html.mjs:1318-1324）——hostname **先去 `[` `]` 括号归一**（`'[::1]'`→`'::1'`，浏览器 IPv6 回环带括号，独立复审实证）后属 {空, 127.0.0.1, localhost, ::1} 判本机返回 ''（回落 Host 头），否则 `ws(s)://<host>/dsh-termfleet/bus` 显式作 `?u=` 传给 pairing/code。lan-forwarder 对 WS Upgrade 同样透传（scripts/lan-forwarder.mjs 头注释），跨机成立。S7 回归锁：?u= 进码解码一致 + tfAdvertise 三组求值；已知覆盖缺口：?u= 拼接链路未在非回环 origin 实点 pairCodeBtn（提示级）。

## 2026-10-07 · auditStore.add 永不 reject（评审 #4 修复）

审计写盘 writeFileSync 包 try/catch（lib/index.js:425-427），失败降级 console.error+内存留存——add 永不 reject，全文件约 20 个调用点（含十余处未 await 的 fire-and-forget）一次性根治 unhandled rejection 击穿宿主的风险。副作用改善：以往 `await add` 在 try 内的路由（/consent/request 等）写盘失败会把**已成功的操作**误响应 400，现在不会。

## 2026-10-07 · 契约 F：任务↔会话强关联 = task.session 显式绑定 + 弱匹配兜底（P1 首位落地）

绑定载体存 **id 不存名字**（生态共识：官方 agent-team `TeamTaskSnapshot.ownerId: SessionId`；nanmicoder #203 实证按名字绑定在 Unicode 下永不命中）。`task.session = {member, sessionId, label, boundBy, boundAt}`（normSession 校验，sessionId 必填；member=''=本机）。操作：`tasks/action op=bind-session|unbind-session`（坏参数 _gateError→409）；创建表单勾选「绑定本机当前 dsh 会话」（probe-session 最后 sessionId 预填，成员端自动带 FLEET.name 归属）。**弱匹配兜底升级**：成员 sess-event 镜像进 lead state.sessionEvents 时带 `member` 归属 → session-links 命中含归属 → 详情「会话」tab 一键转正（不带归属会把成员会话误标本机）。**会话已结束≠解绑**（调研定调：冻结可回看，绝不静默改绑/清绑）；解绑仅显式。详情「▶ 实时看」跳远程页按 member 粒度订阅（与 #1 会话流镜像共用管道，同意门照常生效）。成员 hello/presence 上报真实 dsh 会话 id（dshSessions：环形缓冲去重后 3 条）。已知后续项：subagent 会话过滤（需 header.origin 透出到 sessionEvents）、时钟偏移下 sessionId 跨重启稳定性观察。

## 2026-10-07 · 契约 G：任务板跨机同步 v1 = op 上行 + 全量广播 + 墓碑 + 上线对账（lead 权威）

发现前提缺口：任务板原本只在单机（/tasks 全走本地 tasks.json，总线零任务帧）——「共享任务板」跨机不成立，本契约补上。**协议**：①成员本地乐观执行后上行 `{t:'task-op', kind:'create'|'action', body, by}`（role!=='member' 或断线 no-op）→ lead 过**同一套门禁**应用（by=名@成员机，门禁拒绝时审计+广播真相，成员按 updatedAt 自愈）→ `broadcastTasks` 全量广播 `{t:'tasks', tasks, tombstones}`；②成员收 tasks 走 `taskStore.mergeFrom(remote, tombstones)` 按 updatedAt **后写赢**合并（走闭包内存+save，不绕缓存直写——requestRemote 短路同款教训）；③**删除墓碑**：delete 推 `{id, deletedAt, by}`（cap 50）随广播走，成员据此清本地幽灵任务（mergeFrom 无墓碑无法区分「从没有」和「被删」——独立复审抓出的高危缺口，S11 回归锁）；④**上线对账**：成员 open 后上行 `{t:'task-report', tasks}`，lead `importFrom` 收编它没有的离线任务（不复活墓碑任务）再广播。**id 防撞**：id 追加舰队名标签（`T-001-P0LEAD`，boot 同步注入 setIdTag；create 帧沿用来源 id 但需格式+库内查重双校验，防同任务双 id 与伪造重复）。已知取舍：后写赢基于跨机墙钟（时钟偏移会逆转真实后写，v1 接受，文档标注）；成员断线期间的 op 补报=上线 task-report 对账（E2E 未模拟断线创建，跨机真机验收覆盖）。

## 2026-10-09 · 契约 H：进度摘要推送 = 成员侧状态机迁移触发 + 分级频控 + lead 忙碌抑制（P1#5 落地）

五态状态机（成员机每 3s tick）：idle/working/waiting-input/waiting-reply/stuck；**迁移才推**（持续状态不重推）。阈值 env 可调且支持小数（`TERMFLEET_STUCK_MIN` 默认 10min、`TERMFLEET_WAIT_SECS` 默认 30s（user 消息无回复=等回复）、`TERMFLEET_NOTIFY_COOLDOWN_MIN` 默认 30min——下限 1s 不是 1 分钟，E2E 注入小值实测真实迁移路径；presence summarize 与推送共用同一 STUCK_MS，展示不矛盾）。**分级频控（需求调研 2026-10-09 回灌，RESEARCH-PROGRESS-PUSH.md）**：waiting-input 仅由 `approval/asked` 产生（零误报显式事件，迁移触发天然稀疏）→**豁免同类冷却**；stuck/working/waiting-reply=启发式推断→同类 30min 冷却防连击（调研：生态头号噪音是"重复内容"；没有主流产品默认推"卡住"，误报即信任损失——故 stuck 推送文案带最后事件做可证伪证据）。lead 侧：存 `c.lastProgress`（/fleet 暴露→成员卡徽标）+ tf-notify 弹条 + IM webhook 转发；**忙碌抑制**（feishu-bot 先例）：lead 正订阅该成员 member-stream（sessSubs>0）→IM 不发（弹条保留）。成员上线/重连 hello 后补推当前态帧（lead conns 重建丢 lastProgress，kind 未变时 tick 不再推——防徽标静默消失）。**已知边界（备案）**：stuck 优先级高于 waiting-input（审批挂起超 STUCK_MIN 会追加一条"疑似卡住"，语义可辩护）；waiting-input 判定在 3s tick 粒度（3s 内被快速批准的审批不产生推送——零误报类的漏报可接受）；waiting-reply 需真实"用户消息无回复"场景（探针即时应答不触发）；触发帧 after-12s 合法放行（冷却语义是"距上次同类推送 ≥N"，非"抑制一切"）——S12 不变量断言（同类间隔 ≥12s）据此设计。

## 2026-10-09 · E2E 测试教训：S12 频控断言的四轮演进（flake 猎杀实录）

断言"具体帧数/顺序"在（探针 agentLoop 异步补发 turn 事件 × 3s tick 相位 × 12s 冷却网格边界）三因素下必然 flake——四轮实测出现四种不同合法时序。终版断言=**确定性不变量**：working/stuck 各 ≥1（管道通）+ 同类相邻帧间隔 ≥11.5s（冷却下限，留 0.5s 抖动余量）+ lastProgress 与末帧一致；写#2 时机同步到事件（轮询到本轮写后的首次 stuck 推送 ts>t12 再发，消除冷却基线漂移）。教训：**频控类测试断言"不变量"而非"脚本"；环境异步事件源（重试/补发）会移动冷却基线，任何依赖"上次推送发生在何时"的具体帧数断言都不可靠**。诊断工具 scripts/dbg-progress.mjs（双实例+逐帧打印）保留入库。
