# M0 屏幕流侦察笔记 · dsh-remote-desktop@1.6.1（M2 照此写）

> 侦察时间 2026-09-19。来源：`npm i dsh-remote-desktop` 装入临时目录 `D:\coding\.tmp-m0\screen-ref\`（只装未启用未运行其服务；版本锁定见该目录 `package.json`，node_modules 已删，重装即 `npm i` 恢复）。
> 行号均指包内文件：`lib/index.js`（宿主端 1068 行）、`lib/screen.ps1`（截屏+键鼠 worker 293 行）、`lib/client.js`（dsh web 前端面板）、`lib/helper.ps1`、`lib/install-unlock-service.bat` + `lib/task.xml`（解锁服务）。
> 零原生依赖：不装任何 npm 原生模块，全部能力 = Node 内置 `node:http/child_process` + PowerShell(`System.Drawing`/`System.Windows.Forms`) + P/Invoke user32。MIT 许可（package.json:30）。

## 1. 截屏实现

- **进程模型**：Node 侧 `startWorker()` 常驻 spawn 一个 PowerShell 工作进程 `powershell.exe -STA -NoProfile -ExecutionPolicy Bypass -File screen.ps1`（index.js:55），stdin 发行命令、stdout 收行结果。**不是** JS 里调原生模块，而是"子进程做截屏，行协议回传"。
- **原生调用**：GDI+ 的 `System.Drawing.Graphics.CopyFromScreen`（screen.ps1:185），整屏抓 `PrimaryScreen.Bounds`。失败（显示器休眠）重试 5 次，每次先 `WakeDisplay()`（screen.ps1:183-191）。
- **整帧，无增量**：每帧全屏抓取 → 双线性缩放到请求的 w×h（screen.ps1:194-202）→ JPEG 编码（质量参数，screen.ps1:203-210）→ base64 → stdout 一行 `FRAME:<base64>`（screen.ps1:222）。无脏矩形/无帧间 diff。
- **周期（需求驱动）**：不是固定后台循环。有帧请求才 `setInterval("capture w h q", max(100, 1000/fps))`，**3 秒无请求自动停**（index.js:97-110）。三档画质即三档周期（VIEWER_HTML index.js:218）：流畅 640×360 q50 **5fps**（200ms）、标清 960×540 q60 **3fps**（333ms）、高清 1280×720 q70 **2fps**（500ms）。客户端轮询周期同样 `max(150, 1000/fps)`（index.js:246）。
- **传输形态**：主用 HTTP 单帧轮询（`img.src = /remote-screen/frame`，等最新帧最多 2.5s 否则 204，index.js:656-677）；另有 MJPEG `multipart/x-mixed-replace` 广播路由 `/remote-screen/stream`（index.js:705-717，内置 viewer 未用它）。**没有 WebSocket 屏幕流**。
- **DPI 适配**：worker 启动即 P/Invoke `SetProcessDPIAware()`（screen.ps1:5-13,170），使 `PrimaryScreen.Bounds` 返回物理像素（125% 缩放不裁边）；物理分辨率经 `SIZE:WxH` 报给 Node（screen.ps1:171-172 → index.js:65-67）→ `/remote-screen/status` 下发（index.js:700-704）→ 客户端按 screenW/H 做 letterbox 校正的坐标映射（toScreen/fromScreen，index.js:343-346, 509-531）。分辨率持久化到 settings，避免 worker 重启瞬间返回默认 1920×1080 造成鼠标偏移（index.js:39-40）。

## 2. 键鼠注入（Windows 具体 API，全在 screen.ps1:15-168 的 P/Invoke C# 块）

- **鼠标移动**：`user32!SetCursorPos`。有任务栏聚焦时它会被拒 → `MoveWithDesktop` 兜底：发一对 Alt 按键 + `AttachThreadInput`+`SetForegroundWindow` 抢回桌面/辅助窗口前台，重试 4 次（screen.ps1:153-166）。配套 `helper.ps1`：一个定位在屏幕外(-2000,-2000)的置顶隐形窗口，专职"持有前台"防止任务栏按钮卡焦点。
- **点击/滚轮**：`user32!mouse_event`：left=0x0002/0x0004、right=0x0008/0x0010、wheel=0x0800 ±120（screen.ps1:247-256）。
- **键盘**：`user32!keybd_event` 发 Enter(0x0D)/Backspace(0x08)（screen.ps1:283-290）；**文本输入 = 剪贴板 `Clipboard.SetText` + `SendKeys ^v`**（中文靠这个，screen.ps1:258-267，README 第八节"中文输入乱码"同证）；另有 `SendInput+KEYEVENTF_UNICODE`（TypeText，screen.ps1:49-56）与 `VkKeyScan`+`keybd_event`（TypeTextVK，锁屏界面认 VK 不认 Unicode，screen.ps1:58-69）两条备用路径。
- **唤醒/防锁屏**：`WakeDisplay` = `SetThreadExecutionState(ES_DISPLAY_REQUIRED)` + `PostMessage(HWND_BROADCAST, WM_SYSCOMMAND, SC_MONITORPOWER, -1)` + 1px 去而复返的鼠标净零移动（screen.ps1:71-87）；观看期间 `hold`/`release` = `SetThreadExecutionState(0x80000003/0x80000000)`（screen.ps1:228-235）；Node 侧另配 `powercfg CONSOLELOCK` + 注册表 `ScreenSaverIsSecure` 开关（index.js:693-694）。
- **Node 侧限速合并**：鼠标移动只保留最新位置、≥100ms 发一条、worker 回 `RDY` 握手防命令堆积（index.js:125-143, 71-72）——**这套节流必须抄**，否则逐点发送会拖影。
- **worker 行协议**（M2 直接沿用）：入 `capture w h q | mouse x y | click left|right|down|up|wheelup|wheeldown | key 文本 | keytext | keyenter | keyback | ime | restoreall | minimizeall | pos | hold | release | exit`；出 `FRAME:b64 | SIZE:WxH | POS:XxY | RDY | ERR:msg`（index.js:59-80 ↔ screen.ps1:213-293）。

## 3. "内置本地代理(8090)"结构

**纯 `node:http`，无 WS 服务端，无任何第三方库**。两个服务器：

- **screenServer**（127.0.0.1:**8092**，index.js:646-989,1055）：功能后端。路由：
  - `GET /remote-screen` → 内嵌单页 viewer HTML（index.js:651-655）
  - `GET /remote-screen/frame?w&h&q&fps` → 单帧 JPEG（index.js:656-677）
  - `GET /remote-screen/stream` → MJPEG 广播（index.js:705-717）
  - `GET /remote-screen/pos` → 光标坐标；`GET /remote-screen/status` → 分辨率/开关（index.js:678-683, 700-704）
  - `POST /remote-screen/input` → JSON `{type: mouse|click|key|keytext|keyenter|keyback|ime|restoreall|scroll|wheelup|wheeldown, x,y,button,text,dir}`（index.js:718-731 + 151-168）
  - `GET lockstate/lockcap`、`POST unlock` → 转发本机解锁服务 `http://127.0.0.1:8093`（index.js:732-797）
  - `GET/POST /remote-file/*`（drives/list/download/zip/upload）、`/remote-settings`、`/remote-nolock`、`/remote-apk*`（index.js:847-987）
- **proxy**（127.0.0.1:**8090**，可配 `listenPort`，index.js:1011-1061）：统一入口。规则：URL 前缀 `/remote-*` → 转 8092，**其余全部 → dsh webServer 端口（默认 3080）**并重写 Host/Origin/Referer 为 `127.0.0.1:<target>`（index.js:992-998,1020-1032）；WebSocket upgrade 手工双向 pipe 到 dsh 端口（自拼 101 响应，index.js:1035-1051）；`GET /remote-addr` 返回最近一次进来的公网 Host 供面板显示"检测到手机访问域名"（index.js:1014-1018）。
- 即：**8090 = "dsh web 的克隆站 + /remote-* 挂载屏控"**，手机只需访问一个域名。

## 4. 穿透模型（它假设的组网）

**只监听回环，公网完全外包**：两个 server 都 bind `127.0.0.1`（index.js:1055,1059）。README 第四节要求用户自备 cpolar/frp/ngrok 把公网 URL 转发到 `127.0.0.1:8090`，鉴权 = 隧道层的 HTTP Auth（README 明言"隧道认证是唯一安全门"）。插件自身 8090 上**零鉴权、CORS `*`**（index.js:648）——`controlEnabled` 开关（index.js:152）只是功能开关不是安全边界。
**对 termfleet 的含义**：这个"本机 HTTP 服务 + 第三方公网隧道"模型与 PLAN D10（成员机零入入端口、出站 WS 连 lead）**方向相反，不抄**；抄的是第 1/2 节的 capture/注入/worker 协议，帧改走我们既有的出站 WS 通道。

## 5. Windows 特别注意点 + 可抄度评估

**Windows 坑（它替我们踩过的）**：
1. **锁屏是硬墙**：Windows 锁屏只认真实硬件输入，SendInput/mouse_event 全被拒（README 六点五）。它的非常规解法 = 装 SYSTEM 服务 `DSHRemoteUnlock`（exe+计划任务 task.xml，`install-unlock-service.bat` 复制到 System32 注册 LocalSystem 自启，8093 提供 /state /capture /unlockkey 在会话 1 注入 PIN）。**termfleet 不抄解锁**（越权面过大、与同意总线理念冲突）；只抄"锁屏检测 + 只读预览 + 防锁屏开关"。
2. PowerShell 必须 `-STA`（Clipboard/SendKeys 要 STA，index.js:33,55）。
3. 不 `SetProcessDPIAware` 则 125% 缩放下截图被裁、鼠标错位（screen.ps1:5-13）。
4. `SetCursorPos` 在任务栏聚焦时静默失败 → 需 helper 窗口 + AttachThreadInput 抢前台（screen.ps1:150-166 + helper.ps1）。
5. worker stdin 必须挂 error 监听，否则 worker 死后写入 EPIPE 直接崩宿主（index.js:56-57）。
6. 硬编码残留：日志写死 `D:\dsh-temp\unlock.log`（index.js:778）、文件浏览默认 `D:\`（index.js:882）——自写时务必参数化。
7. 帧走 stdout base64 文本行：1080p JPEG 每帧几百 KB，2-5fps 可用；更高帧率/分辨率应换二进制管道或降档。

**可抄程度一句话**：工程质量中上——单文件能跑、零依赖、Windows 细节打磨极足（RDY 握手/鼠标合并/DPI/唤醒/EPIPE），但无鉴权、无测试、无模块化；**`screen.ps1` 的 P/Invoke 块与 worker 行协议、index.js 的需求驱动截屏循环与鼠标限速，可近乎照搬；8090 反代/穿透模型/文件传输路由不抄**（且按 PLAN D7 只参考不自用，自写实现即可规避 MIT 归属问题）。

---
*M0 结论：M2 屏幕流 = 成员插件 spawn PowerShell worker（照抄第 1/2 节 API 选型与协议）+ 帧封装进出站 WS + lead 端 viewer；分辨率状态、鼠标合并、DPI、STA、EPIPE 五个坑照本文规避。*
