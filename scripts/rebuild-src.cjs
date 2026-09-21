// src 重建：TS 头 + 当前验证过的 lib 全文（纯镜像，杜绝手拼漂移）
const fs = require('fs'), path = require('path'), os = require('os')
const root = path.join(os.homedir(), '..', '..', 'coding', 'dsh-termfleet')
// 用 import.meta 动态取绝对路径更稳
const libPath = path.resolve('D:/coding/dsh-termfleet/lib/index.js')
const srcPath = path.resolve('D:/coding/dsh-termfleet/src/index.ts')
const lib = fs.readFileSync(libPath, 'utf8')
const header = `/**
 * dsh-termfleet host 半（TS 镜像源）。
 * ⚠ 本文件=lib/index.js 的逐字镜像 + TS 头：运行装载的是 lib/index.js（宿主 file://），
 *   改动请改 lib 后运行 node scripts/rebuild-src.cjs 再生本文件，勿手编（历史手拼多次损坏）。
 * 能力：鉴权门 / 任务库 / 决策笔记库(wnlds 治理) / 审计 / 同意总线(握手卡+限时+SSE) / PTY 门控 / M3(diff/replay/cost/session-links)。
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'

export interface Config {}

`
fs.writeFileSync(srcPath, header + lib)
console.log('src rebuilt:', (header + lib).length, 'bytes')
