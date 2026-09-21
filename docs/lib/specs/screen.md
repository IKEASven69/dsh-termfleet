---
module: screen
status: unplugged
last-updated: 2026-09-19
last-verified:
cover-files: ["src/screen/"]
---

# screen 规格书（屏幕流）

## 职责
远程桌面围观：截屏 worker（GDI+ CopyFromScreen）+ 键鼠注入（user32 P/Invoke）+ 帧协议（base64 行协议 2-5fps）。只看/可操作两档由 bus 决定；水印+留痕。

## 关联文档
- 先例拆解：[m0-screen-notes.md](../../m0-screen-notes.md)（五坑清单：-STA / DPI 感知 / helper 前台兜底 / stdin 防 EPIPE / 行协议）

## 已知陷阱 / 设计约束
- M2 首证优先（栈内未实跑，TBD 挂账）
- macOS 录屏权限文档化；锁屏只检测不解锁

## 错题记录
（暂无）

> 2026-09-19 出列：远程对象定为会话级（隐私边界），整屏围观/键鼠注入不再在 M2 范围；先例笔记 ../../m0-screen-notes.md 保留，若未来需要再启。
