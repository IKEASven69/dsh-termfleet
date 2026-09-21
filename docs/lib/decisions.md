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
