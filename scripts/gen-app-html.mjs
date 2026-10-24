// 生成 lib/app.html —— v7 原型整体移植 + 真数据绑定（任务/避坑/审计/同意总线/PTY·SSE）
// 再生：node scripts/gen-app-html.mjs（图标 docs/design-assets/icons-official.json）
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const iconsRaw = JSON.parse(readFileSync(path.join(here, '../docs/design-assets/icons-official.json'), 'utf8'))
const ICONS = {}
for (const [k, v] of Object.entries(iconsRaw.icons)) {
  const short = k.replace(/^Icon/, '').replace(/(Outline|Fill)\d+$/, '')
  ICONS[short] = Array.isArray(v) ? v : [v]
}
const ICONS_JSON = JSON.stringify(ICONS)
const ANSI_B64 = "ZnVuY3Rpb24gYW5zaUNsZWFuKHQpewogIGlmKCF0KXJldHVybicnCiAgdmFyIEU9U3RyaW5nLmZyb21DaGFyQ29kZSgyNyksIEI9U3RyaW5nLmZyb21DaGFyQ29kZSg3KQogIHZhciBzPVN0cmluZyh0KSwgb3V0PScnLCBpPTAKICB3aGlsZShpPHMubGVuZ3RoKXsKICAgIHZhciBjaD1zW2ldCiAgICBpZihjaD09PUUpewogICAgICBpZihzW2krMV09PT0nWycpeyBpKz0yOyB3aGlsZShpPHMubGVuZ3RoKXsgdmFyIGM9c1tpXS5jaGFyQ29kZUF0KDApOyBpZihjPj0weDIwJiZjPDB4NDApe2krK31lbHNle2JyZWFrfSB9IGkrKzsgY29udGludWUgfQogICAgICBpKz0yCiAgICAgIGlmKGNoPT09RSYmc1tpXT09PSddJyl7IC8qIE9TQyDlt7Lot7Pov4flpLTpg6jvvIzmib7nu4jmraIgKi8gfQogICAgICBjb250aW51ZQogICAgfQogICAgdmFyIGNkPWNoLmNoYXJDb2RlQXQoMCkKICAgIGlmKGNkPT09N3x8Y2Q9PT04KXsgaSsrOyBjb250aW51ZSB9CiAgICBpZihjZDwweDIwJiZjaCE9PSdcbicmJmNoIT09J1x0Jyl7IGkrKzsgY29udGludWUgfQogICAgb3V0Kz1jaDsgaSsrCiAgfQogIHJldHVybiBvdXQucmVwbGFjZSgvXHIvZywnJykucmVwbGFjZSgvXG57Myx9L2csJ1xuXG4nKS50cmltKCkKfQo="

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TermFleet · 团队驾驶舱</title>
<style>
:root{--n50:#f9fafb;--n60:#f5f6f7;--n100:#ebeef2;--n150:#e9ecf2;--n300:#cfd3d6;--n400:#adb2b8;--n600:#81858c;--n700:#61666b;--n750:#43454a;--n800:#353638;--n900:#1b1b1c;--n950:#151517;--n1000:#0f1115}
body{--bg:#0d0f12;--panel:#12141a;--card:#181b22;--card2:#22262f;--elev:#1f232b;--label1:#f2f4f7;--label2:#c3c8d0;--label3:#98a0ab;--caption:#6b7280;--brand:#f2f4f7;--brand-fg:#0f1115;--accent:#6ea8ff;--accent-t:rgba(110,168,255,.12);--border:rgba(255,255,255,.07);--border2:rgba(255,255,255,.14);--border3:rgba(255,255,255,.22);--hover:rgba(255,255,255,.06);--green:#4ed17e;--green-t:rgba(78,209,126,.13);--amber:#f5b04d;--amber-t:rgba(245,176,77,.13);--red:#f25a5a;--red-t:rgba(242,90,90,.13);--blue:#7fa7e8;--blue-t:rgba(127,167,232,.12);background:var(--bg);color:var(--label1)}
body[data-light]{--bg:#f6f7f9;--panel:#eef0f3;--card:#fff;--card2:#fff;--elev:#fff;--label1:#14161a;--label2:#3d434b;--label3:#5f6670;--caption:#9aa1ab;--brand:#14161a;--brand-fg:#fff;--accent:#2563eb;--accent-t:rgba(37,99,235,.08);--border:rgba(15,20,30,.08);--border2:rgba(15,20,30,.14);--border3:rgba(15,20,30,.24);--hover:rgba(38,49,72,.06);--green:#15803d;--green-t:rgba(34,197,94,.12);--amber:#b45309;--amber-t:rgba(245,158,11,.12);--red:#dc2626;--red-t:rgba(239,68,68,.10);--blue:#2563eb;--blue-t:rgba(59,130,246,.10)}
*{box-sizing:border-box;margin:0;padding:0}
:root{--ease:cubic-bezier(.4,0,.2,1);--dur:.18s;--dur-fast:.1s}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB',sans-serif;font-size:14px;line-height:1.55;transition:background .2s,color .2s}
.wrap{max-width:1380px;margin:0 auto;padding:0 20px 46px}
.topbar{display:flex;align-items:center;gap:12px;padding:13px 0 15px;flex-wrap:wrap}
.logo{display:flex;align-items:center;gap:8px;font-weight:700;font-size:16px}
.logo .mark{width:22px;height:22px;border-radius:7px;background:var(--brand);color:var(--brand-fg);display:grid;place-items:center;font-size:10.5px;font-weight:800}
.nav{display:flex;gap:2px;margin-left:6px}
.nav span{padding:7px 16px;border-radius:999px;font-size:13.5px;color:var(--label3);cursor:pointer;font-weight:500;transition:background var(--dur-fast) var(--ease),color var(--dur-fast) var(--ease)}
.nav span.on{background:var(--brand);color:var(--brand-fg);font-weight:600}
.pill{transition:all var(--dur-fast) var(--ease);display:inline-flex;align-items:center;justify-content:center;gap:5px;border-radius:999px;height:22px;padding:0 10px;box-sizing:border-box;font-size:11.5px;font-weight:600;color:var(--label2);border:1px solid var(--border2);white-space:nowrap}
.pill.g{color:var(--green);background:var(--green-t);border-color:transparent}
.pill.a{color:var(--amber);background:var(--amber-t);border-color:transparent}
.pill.r{color:var(--red);background:var(--red-t);border-color:transparent}
.pill.b{color:var(--blue);background:var(--blue-t);border-color:transparent}
button{font-family:inherit;cursor:pointer;transition:opacity .1s}
button:active{opacity:.75}button:disabled{opacity:.4;cursor:not-allowed}
.btn{border-radius:18px;border:0;background:var(--brand);color:var(--brand-fg);padding:0 16px;height:32px;font-size:13.5px;font-weight:600;display:inline-flex;align-items:center;gap:6px}
.btn.ghost{background:transparent;color:var(--label1);border:1px solid var(--border2);font-weight:500}
.btn.danger{background:transparent;color:var(--red);border:1px solid var(--red);font-weight:600}
.btn.sm{height:28px;padding:0 13px;font-size:12.5px;border-radius:14px}
.spacer{flex:1}
.dot{width:8px;height:8px;border-radius:50%;flex:none}
.dot.on{background:var(--green)}.dot.busy{background:var(--amber)}.dot.off{background:var(--n600)}
.me{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--caption)}
.me input{background:var(--card2);border:1px solid var(--border2);border-radius:15px;color:var(--label1);padding:0 10px;font-size:12.5px;width:86px;height:30px;outline:none;box-sizing:border-box}
.panel{background:var(--panel);border:1px solid var(--border);border-radius:16px;overflow:hidden}
.panel h5{font-size:12px;font-weight:600;color:var(--label2);padding:12px 14px 8px;letter-spacing:.3px}
::-webkit-scrollbar{width:10px;height:10px}
::-webkit-scrollbar-thumb{background:var(--border2);border-radius:8px;border:3px solid transparent;background-clip:padding-box}
::-webkit-scrollbar-thumb:hover{background:var(--border3);border:3px solid transparent;background-clip:padding-box}
::-webkit-scrollbar-track{background:transparent}
:focus-visible{outline:2px solid var(--accent);outline-offset:1px;border-radius:4px}
.page{display:none}.page.on{display:block}
.note{font-size:12px;color:var(--caption);margin-top:10px}
.mono{font-family:'SF Mono',Consolas,monospace}
svg.ic{display:inline-block;vertical-align:-3px}
.toast{position:fixed;bottom:26px;left:50%;transform:translateX(-50%) translateY(12px);background:var(--brand);color:var(--brand-fg);padding:9px 18px;border-radius:12px;font-size:13px;font-weight:500;z-index:300;opacity:0;transition:all .22s;pointer-events:none;max-width:80vw}
.toast.on{opacity:1;transform:translateX(-50%) translateY(0)}
.mask{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;display:none;transition:opacity var(--dur) var(--ease);opacity:0}
.mask.on{display:flex;opacity:1}
.mask .modal{transform:scale(.96);transition:transform var(--dur) var(--ease)}
.mask.on .modal{transform:scale(1)}
.mask.on{display:flex;align-items:center;justify-content:center}
.modal{width:min(480px,92vw);background:var(--bg);border:1px solid var(--border2);border-radius:16px;padding:20px 22px}
.modal h4{font-size:15px;margin-bottom:14px;display:flex;align-items:center;gap:8px}
.modal label{display:block;font-size:12px;color:var(--caption);margin:10px 0 4px}
.modal input,.modal textarea,.modal select{width:100%;background:var(--card2);border:1px solid var(--border2);border-radius:9px;color:var(--label1);padding:7px 10px;font-size:13px;outline:none;font-family:inherit}
.modal .acts{display:flex;gap:9px;margin-top:16px;justify-content:flex-end}
.menu{position:fixed;z-index:250;background:var(--bg);border:1px solid var(--border2);border-radius:12px;padding:6px;display:none;box-shadow:0 16px 50px rgba(0,0,0,.45);min-width:150px}
.menu.on{display:block}
.menu button{display:block;width:100%;text-align:left;background:transparent;border:0;color:var(--label2);font-size:13px;padding:7px 12px;border-radius:8px}
.menu button:hover{background:var(--hover);color:var(--label1)}
.menu button.danger{color:var(--red)}
/* ── 远程页 ── */
.rem{display:grid;grid-template-columns:296px 1fr;gap:16px;align-items:start}
.dev{display:flex;gap:10px;padding:11px 14px;border-top:1px solid var(--border);cursor:pointer;align-items:center}
.dev:hover{background:var(--hover)}
.dev.sel{background:var(--hover);box-shadow:inset 3px 0 0 var(--brand)}
.dev .av{width:34px;height:34px;border-radius:10px;background:var(--card2);display:grid;place-items:center;font-weight:700;font-size:13px;flex:none;border:1px solid var(--border)}
.dev .nm{font-weight:600;font-size:13.5px;display:flex;align-items:center;gap:7px}
.dev .mach{font-size:11.5px;color:var(--caption);font-family:'SF Mono',Consolas,monospace}
.dev .sessn{font-size:12px;color:var(--label3);margin-top:2px}
.sessbar{display:flex;gap:6px;align-items:center;padding:10px 14px 0;flex-wrap:wrap}
.sess{display:flex;align-items:center;gap:7px;padding:6px 13px;border-radius:10px 10px 0 0;border:1px solid var(--border);border-bottom:0;background:var(--card2);font-size:12.5px;color:var(--label3);cursor:pointer}
.sess.on{background:var(--card);color:var(--label1);font-weight:600;border-color:var(--border2)}
.sess .tag{font-size:10.5px;padding:1px 7px;border-radius:6px;border:1px solid var(--border2)}
.tag.cli{color:var(--amber);border-color:transparent;background:var(--amber-t)}
.tag.dsh{color:var(--blue);border-color:transparent;background:var(--blue-t)}
.newcli{font-size:12.5px;color:var(--label3);border:1px dashed var(--border2);border-radius:10px;padding:6px 12px;cursor:pointer;background:transparent}
.newcli:hover{color:var(--label1)}
.rwin{background:var(--card);border:1px solid var(--border2);border-radius:0 14px 14px 14px;overflow:hidden}
.rtoolbar{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border);flex-wrap:wrap}
.term{background:var(--n950);border:1px solid var(--border);color:var(--n300);font-family:'SF Mono','JetBrains Mono',Consolas,monospace;font-size:12.5px;border-radius:10px;padding:14px 16px;white-space:pre-wrap;line-height:1.6;margin:12px;min-height:150px;max-height:340px;overflow-y:auto}
body[data-light] .term{background:var(--n1000)}
.term .p{color:var(--green)}
.term .actor{color:var(--blue)}
.cmdline{display:none;gap:8px;margin:0 14px 12px}
.cmdline.on{display:flex}
.cmdline input{flex:1;background:var(--card2);border:1px solid var(--border2);border-radius:10px;color:var(--label1);padding:8px 12px;font-family:'SF Mono',Consolas,monospace;font-size:12.5px;outline:none}
.evrow{display:flex;gap:10px;padding:6px 2px;border-bottom:1px dashed var(--border);font-size:12.5px;align-items:baseline;color:var(--label2)}
.evrow .ts{font-family:'SF Mono',Consolas,monospace;color:var(--caption);flex:none}
.evrow .ty{flex:none;width:130px;font-size:11.5px;color:var(--label3)}
.ccard h4{display:flex;align-items:center;gap:8px;font-size:14px;margin-bottom:8px}
.ccard .who{font-size:13px;color:var(--label2);margin-bottom:12px}
.ccard .acts{display:flex;gap:9px;flex-wrap:wrap}
.ph{padding:26px 20px;text-align:center;color:var(--caption);font-size:13px;border:1px dashed var(--border2);border-radius:12px}
/* ── R1 远程页 IA：左栏纯设备列表 + 右栏 context 状态机 ── */
.devfoot{display:flex;align-items:center;gap:8px;padding:10px 14px 12px;border-top:1px solid var(--border);margin-top:2px}
.costline{font-size:11.5px;color:var(--caption);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;text-align:right}
.costline b{color:var(--label2);font-weight:600}
.ctxnone{display:flex;gap:14px;align-items:stretch;min-height:420px}
.cta{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:34px 22px;border:1.5px dashed var(--border2);border-radius:16px;background:var(--card);cursor:pointer;text-align:center;transition:border-color var(--dur) var(--ease),background var(--dur-fast) var(--ease),transform var(--dur-fast) var(--ease)}
.cta:hover{border-color:var(--label3);background:var(--elev);transform:translateY(-2px)}
.cta .big{font-size:15px;font-weight:700;color:var(--label1)}
.cta .sub{font-size:12.5px;color:var(--caption);max-width:300px;line-height:1.6}
.cta .ctaic{width:44px;height:44px;border-radius:13px;background:var(--accent-t);color:var(--accent);display:grid;place-items:center;font-size:19px}
.chanstrip{display:none;align-items:center;gap:10px;padding:9px 14px;background:var(--card);border:1px solid var(--border2);border-radius:12px;margin-bottom:12px;flex-wrap:wrap}
.chanstrip .remain{font-family:'SF Mono',Consolas,monospace;color:var(--label1);font-weight:600}
.evhead{display:flex;align-items:center;gap:8px;padding:11px 14px 7px;border-top:1px dashed var(--border);margin-top:4px;font-size:12px;font-weight:600;color:var(--label2);letter-spacing:.3px}
.evlist{max-height:230px;overflow-y:auto;padding:0 14px 12px}
.info{display:inline-flex;width:15px;height:15px;border-radius:50%;border:1px solid var(--border2);color:var(--label3);font-size:9.5px;align-items:center;justify-content:center;cursor:help;position:relative;flex:none;font-weight:700;user-select:none;font-style:normal}
.info:hover{color:var(--label1);border-color:var(--label3)}
.info:hover::after{content:attr(data-tip);position:absolute;left:0;bottom:calc(100% + 9px);background:var(--elev);border:1px solid var(--border2);color:var(--label2);padding:9px 11px;border-radius:10px;font-size:11.5px;font-weight:400;width:min(270px,72vw);white-space:normal;line-height:1.6;z-index:70;box-shadow:0 14px 44px rgba(0,0,0,.42);text-align:left;font-style:normal}
.info:hover::before{content:'';position:absolute;left:8px;bottom:calc(100% + 3px);border:6px solid transparent;border-top-color:var(--border2);z-index:71}
.info.tipdn:hover::after{bottom:auto;top:calc(100% + 9px)}
.info.tipdn:hover::before{bottom:auto;top:calc(100% + 3px);border-top-color:transparent;border-bottom-color:var(--border2)}
/* ── R3 设置弹层 ── */
.modal.wide{width:min(600px,94vw);max-height:88vh;overflow-y:auto}
.sgt{font-size:12px;font-weight:700;color:var(--label2);letter-spacing:.4px;margin:18px 0 8px;padding-top:12px;border-top:1px dashed var(--border);display:flex;align-items:center;gap:7px}
.sgt:first-of-type{border-top:0;padding-top:2px;margin-top:6px}
.modal .fin{display:flex;gap:6px;align-items:center}
.modal .fin input{flex:1;min-width:0}
.modal .hint{font-size:11.5px;color:var(--caption);margin-top:5px;line-height:1.55}
details.adv{border:1px dashed var(--border2);border-radius:10px;padding:8px 12px;margin-top:10px}
details.adv summary{cursor:pointer;font-size:12px;color:var(--label3);user-select:none;outline:none}
details.adv summary:hover{color:var(--label1)}
details.adv[open] summary{margin-bottom:8px}
details.adv .ain{display:grid;gap:7px}
.step{display:flex;gap:10px;align-items:flex-start;padding:7px 0}
.step .no{width:20px;height:20px;border-radius:50%;background:var(--card2);border:1px solid var(--border2);color:var(--label2);font-size:11px;font-weight:700;display:grid;place-items:center;flex:none;margin-top:2px}
.step .sc{min-width:0;flex:1}
/* ── 成员会话对话流（P0：member-stream 镜像 + 插话） ── */
.sflist{display:flex;flex-direction:column;gap:8px;max-height:400px;overflow-y:auto;padding:6px 2px}
.sfmsg{max-width:86%;padding:8px 12px;border-radius:12px;font-size:12.5px;line-height:1.6;white-space:pre-wrap;word-break:break-word}
.sfmsg .who{font-size:10.5px;margin-bottom:3px;font-family:'SF Mono',Consolas,monospace;opacity:.72}
.sf-user{align-self:flex-end;background:var(--brand);color:var(--brand-fg);border-bottom-right-radius:4px}
.sf-assistant{align-self:flex-start;background:var(--card2);border:1px solid var(--border);border-bottom-left-radius:4px;color:var(--label1)}
.sf-tool{align-self:flex-start;background:var(--blue-t);color:var(--blue);border:1px dashed var(--border2);border-radius:10px;cursor:pointer}
.sf-tool .head{display:flex;gap:8px;align-items:baseline}
.sf-tool .head .ar{margin-left:auto;flex:none}
.sf-tool .body{display:none;margin-top:6px;padding-top:6px;border-top:1px dashed var(--border2);color:var(--label2);font-family:'SF Mono',Consolas,monospace;font-size:11.5px;white-space:pre-wrap}
.sf-tool.open .body{display:block}
.sf-status{align-self:center;background:var(--card2);border:1px dashed var(--border2);border-radius:999px;color:var(--caption);font-size:11.5px;padding:2px 12px}
.sfend{display:none;align-items:center;gap:8px;background:var(--amber-t);color:var(--amber);border:1px solid var(--border2);border-radius:10px;padding:8px 12px;font-size:12.5px;font-weight:600;margin-bottom:8px}
.sfend.on{display:flex}
.sfack{display:inline-block;margin-top:5px}
/* ── tf-notify 右下弹条 ── */
.tfnotifwrap{position:fixed;right:16px;bottom:22px;z-index:320;display:flex;flex-direction:column;gap:8px;width:min(330px,86vw)}
.tfnotif{background:var(--card);border:1px solid var(--border2);border-radius:12px;padding:10px 12px;box-shadow:0 12px 40px rgba(0,0,0,.4);font-size:12.5px;color:var(--label2);animation:tfnotiin var(--dur) var(--ease)}
.tfnotif .tx{color:var(--label1);margin-top:4px;word-break:break-word}
@keyframes tfnotiin{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
/* ── 任务页 ── */
.tbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.seg{display:flex;background:var(--card2);border:1px solid var(--border);border-radius:999px;padding:2px;flex-wrap:wrap}
.seg button{border:0;background:transparent;color:var(--label2);padding:4px 12px;border-radius:999px;font-size:12.5px}
.seg button.on{background:var(--brand);color:var(--brand-fg);font-weight:600}
.search{display:flex;align-items:center;gap:6px;background:var(--card2);border:1px solid var(--border);border-radius:999px;padding:0 12px;height:32px;color:var(--caption);font-size:12.5px;box-sizing:border-box}
.search input{border:0;background:transparent;color:var(--label1);outline:none;font-size:12.5px;width:130px}
.board{display:flex;gap:12px;overflow-x:auto;padding:2px 2px 14px;align-items:flex-start;min-height:460px}
.bcol{flex:0 0 268px;width:268px;background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:10px;display:flex;flex-direction:column;gap:8px;max-height:calc(100vh - 300px)}
.bcol h4{font-size:12px;color:var(--label2);font-weight:600;margin:2px 2px 6px;display:flex;align-items:center;gap:7px;letter-spacing:.2px}
.bcol h4 .cnt{font-size:10.5px;background:var(--card2);border:1px solid var(--border);border-radius:999px;padding:0 7px;color:var(--label3);font-weight:600}
.bitems{display:flex;flex-direction:column;gap:8px;overflow-y:auto;min-height:36px;max-height:calc(100vh - 380px);padding:1px}
.bitems:empty::after{content:'空';font-size:11px;color:var(--caption);text-align:center;padding:8px 0;border:1px dashed var(--border);border-radius:9px;opacity:.7}
.bcard{position:relative;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:10px 11px 9px;cursor:pointer;transition:transform var(--dur-fast) var(--ease),border-color var(--dur) var(--ease),box-shadow var(--dur) var(--ease),background var(--dur-fast) var(--ease)}
.bcard::before{content:'';position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:0 3px 3px 0;background:var(--prio-c,transparent)}
.bcard[data-prio="P0"]{--prio-c:var(--red)}.bcard[data-prio="P1"]{--prio-c:var(--amber)}.bcard[data-prio="P2"]{--prio-c:var(--border3)}
.bcard:hover{border-color:var(--border3);transform:translateY(-1px);box-shadow:0 6px 20px rgba(0,0,0,.22);background:var(--elev)}
.bcard:active{transform:translateY(0) scale(.995)}
.bcard .chead{display:flex;align-items:flex-start;gap:6px}
.bcard .chead .t{flex:1;min-width:0;font-size:13px;color:var(--label1);font-weight:500;margin-bottom:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bcard .stq{width:22px;height:22px;padding:0;justify-content:center;border-radius:6px;opacity:.55}
.bcard:hover .stq{opacity:1}
.bcard .m{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:6px;font-size:11.5px;color:var(--label3)}
.bcard .m .slot{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.bcard .m2{display:flex;justify-content:space-between;font-size:11px;color:var(--caption);margin-top:5px;white-space:nowrap}
.claim{color:var(--blue);cursor:pointer;border-bottom:1px dashed var(--blue)}
.prio{font-size:11.5px;font-weight:700;font-family:'SF Mono',Consolas,monospace}
.prio.P0{color:var(--red)}.prio.P1{color:var(--amber)}.prio.P2{color:var(--label3)}
.listwrap{display:none}.listwrap.on{display:block}
.boardwrap{display:block}.boardwrap.off{display:none}
/* ── R2 任务页·行模式（better-sidebar TeamBoard 式紧凑行） ── */
.thead,.trow{display:grid;grid-template-columns:minmax(0,1fr) 108px 100px 78px;gap:10px;align-items:center}
.thead{padding:6px 10px;font-size:11.5px;color:var(--caption);font-weight:600}
.trow{padding:8px 10px;border-top:1px solid var(--border);font-size:13px;background:var(--card);transition:background var(--dur-fast) var(--ease);cursor:pointer}
.trow:hover{background:var(--hover)}
.trow .tt{display:flex;gap:8px;align-items:center;min-width:0}
.trow .dot{width:8px;height:8px}
.dot.todo{background:var(--n400)}
.dot.doing{background:var(--blue)}
.dot.review{background:var(--amber)}
.dot.done{background:var(--green)}
.dot.blocked{background:var(--red)}
.trow .title{color:var(--label1);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;display:inline;vertical-align:middle}
.trow .who{font-size:12.5px;color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.mini{display:inline-flex;align-items:center;gap:3px;font-size:10.5px;padding:0 6px;height:17px;border-radius:6px;border:1px solid var(--border2);color:var(--label3);white-space:nowrap;flex:none;vertical-align:middle}
.mini.sb{color:var(--green);border-color:transparent;background:var(--green-t)}
.rowops{display:flex;gap:5px;justify-content:flex-end;flex:none}
.ibtn{height:26px;flex:none;border:1px solid var(--border2);background:transparent;color:var(--label2);border-radius:8px;padding:0 8px;font-size:12px;display:inline-flex;align-items:center;gap:5px}
.ibtn:hover{color:var(--label1);border-color:var(--label3)}
.ibtn.star{width:26px;padding:0;justify-content:center;color:var(--caption)}
.ibtn.star:hover{color:var(--amber)}
.ibtn.star.onstar{color:var(--amber);border-color:transparent;background:var(--amber-t)}
.trow.pinflash{animation:pinflash .5s var(--ease)}
@keyframes pinflash{0%{background:var(--amber-t)}100%{background:transparent}}
.empty{padding:50px 20px;text-align:center;color:var(--caption);font-size:13px}
/* ── 查重 v1：相似任务提示区（fSim，新建任务标题下方） ── */
.fsim{display:none;margin:6px 0 2px;padding:7px 10px;border:1px dashed var(--border2);border-radius:9px;font-size:12px;color:var(--label2);background:var(--card2)}
.fsim .ft{font-size:11.5px;color:var(--caption);margin-bottom:3px}
.fsim .fr{display:flex;gap:8px;align-items:baseline;padding:2px 0}
.fsim .fr .sid{font-family:'SF Mono',Consolas,monospace;color:var(--caption);flex:none}
.fsim .fr .stt{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fsim .fr .spct{flex:none}
/* ── 避坑库 ── */
.lesson-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
.lcard{background:var(--card);border:1px solid var(--border);border-radius:11px;padding:13px 14px;cursor:pointer;transition:border-color var(--dur) var(--ease),transform var(--dur-fast) var(--ease)}
.lcard:hover{border-color:var(--border2);transform:translateY(-1px)}
.lcard:active{transform:translateY(0)}
.lcard:hover{border-color:var(--border2)}
.lcard .lt{font-size:13.5px;font-weight:600;color:var(--label1);margin-bottom:6px}
.lcard .lb{font-size:12.5px;color:var(--label3);line-height:1.6;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden}
.lcard .lm{display:flex;gap:8px;font-size:11px;color:var(--caption);margin-top:8px;white-space:nowrap}
/* ── 审计 ── */
.audline{display:flex;gap:10px;font-size:12.5px;padding:8px 2px;border-bottom:1px dashed var(--border);color:var(--label2)}
.audline .ts{font-family:'SF Mono',Consolas,monospace;color:var(--caption);flex:none}
.athead,.arow{display:grid;grid-template-columns:86px 96px 200px 190px minmax(0,1fr);gap:10px;align-items:center}
.athead{padding:7px 10px;font-size:11.5px;color:var(--caption);font-weight:600;background:var(--card2)}
.arow{padding:8px 10px;border-top:1px solid var(--border);font-size:12.5px;background:var(--card);transition:background var(--dur-fast) var(--ease)}
.arow:hover{background:var(--hover)}
.arow .ats{font-family:'SF Mono',Consolas,monospace;color:var(--caption)}
.arow .awho{font-weight:600;color:var(--label1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.arow .aact{color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.arow .atgt{color:var(--label3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.arow .adet{color:var(--label3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.acat{cursor:pointer}
.acat:hover{text-decoration:underline}
/* R4 审计操作类型分色：任务=蓝 / 避坑=绿 / 连接·通道=琥珀 */
.acat::before{content:'';display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:7px;background:var(--n400);vertical-align:1px}
.acat.c-task::before{background:var(--blue)}
.acat.c-mem::before{background:var(--green)}
.acat.c-conn::before{background:var(--amber)}
/* ── 响应式紧凑模式（侧边栏 iframe / 窄屏自动生效） ── */
@media (max-width: 700px) {
  .wrap{padding:0 10px 30px}
  .topbar{gap:6px;padding:10px 0 10px}
  .logo{font-size:14px}
  .nav span{padding:5px 10px;font-size:12px}
  /* 远程页：设备列改顶部横条，会话窗单栏 */
  .rem{grid-template-columns:1fr !important}
  .rem > .panel{max-height:150px;overflow-y:auto}
  .ctxnone{flex-direction:column;min-height:0}
  .cta{padding:20px 16px}
  .rtoolbar{flex-wrap:wrap;gap:6px}
  /* 会话对话流：窄屏压低高度 */
  .sflist{max-height:240px}
  /* 任务看板：横滚保留，卡片窄内边距 */
  .bcard{padding:9px 10px}
  /* 任务列表：窄屏只留 标题行/状态/操作 */
  .thead,.trow{grid-template-columns:minmax(0,1fr) 84px 74px}
  .thead span:nth-child(2),.trow .who{display:none}
  /* 任务详情大窗 → 全屏化 */
  .drawer{top:0;left:0;transform:none;width:100vw;height:100vh;border-radius:0;border:0}
  .drawer.on{transform:none}
  .doc-outline{grid-template-columns:1fr !important}
  .doc-outline .ol{position:static;display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px}
  .doc-outline .ol a{border-left:0;border-radius:6px;padding:3px 8px}
  .doc-body{max-width:none}
}
/* ── 任务详情·居中大窗（v7 原型形态） ── */
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99;display:none;transition:opacity var(--dur) var(--ease);opacity:0}
.overlay.on{display:block;opacity:1}
.overlay.on{display:block}
.drawer{position:fixed;top:3vh;left:50%;transform:translateX(-50%) scale(.97);width:min(1180px,94vw);height:92vh;background:var(--bg);border:1px solid var(--border2);border-radius:16px;z-index:100;display:none;flex-direction:column;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.5);opacity:0;transition:opacity var(--dur) var(--ease),transform var(--dur) var(--ease)}
.drawer.on{display:flex;opacity:1;transform:translateX(-50%) scale(1)}
.drawer.on{display:flex}
.dhead{display:flex;align-items:center;gap:10px;padding:13px 18px;border-bottom:1px solid var(--border)}
.dhead h3{font-size:15.5px;font-weight:700}
.dtabs{display:flex;gap:2px;padding:0 16px;border-bottom:1px solid var(--border);overflow-x:auto}
.dtabs span{padding:11px 13px;font-size:13.5px;color:var(--label3);cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap}
.dtabs span.on{color:var(--label1);font-weight:600;border-bottom-color:var(--label1)}
.dbody{flex:1;overflow-y:auto}
.dpane{display:none;padding:16px 20px 26px}
.dpane.on{display:block}
.flow{position:relative;padding-left:18px}
.flow::before{content:'';position:absolute;left:5px;top:6px;bottom:6px;width:2px;background:var(--border2)}
.fe{position:relative;padding:0 0 13px}
.fe::before{content:'';position:absolute;left:-17.5px;top:5px;width:9px;height:9px;border-radius:50%;background:var(--brand);border:2px solid var(--bg)}
.fe .ft{font-family:'SF Mono',Consolas,monospace;font-size:11.5px;color:var(--caption);margin-right:8px}
.fe .fx{font-size:13px;color:var(--label2)}
.doc-outline{display:grid;grid-template-columns:190px 1fr;gap:18px;align-items:start}
.doc-outline .ol{font-size:12.5px;position:sticky;top:0}
.doc-outline .ol .ot{font-size:11px;color:var(--caption);font-weight:600;margin:10px 0 4px 8px}
.doc-outline .ol a{display:block;color:var(--label3);text-decoration:none;padding:3px 8px 3px 16px;border-left:2px solid var(--border);cursor:pointer}
.doc-outline .ol a:hover{color:var(--label1)}
.doc-outline .ol a.lnk{color:var(--blue)}
.doc-body{max-width:700px;font-size:13.5px;color:var(--label2)}
.doc-body h1{font-size:20px;color:var(--label1);margin:2px 0 4px;font-weight:700;letter-spacing:.2px}
.doc-body .meta{font-size:11.5px;color:var(--caption);font-family:'SF Mono',Consolas,monospace;margin-bottom:14px}
.doc-body h2{font-size:13px;color:var(--label2);margin:24px 0 10px;font-weight:600;letter-spacing:.4px;display:flex;align-items:center;gap:8px}
.doc-body h2::before{content:'';width:3px;height:13px;border-radius:2px;background:var(--accent);flex:none}
.doc-body p{margin:6px 0;white-space:pre-wrap}
.note-card{border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:12px;background:var(--card)}
.note-card h6{font-size:13px;display:flex;align-items:center;gap:8px;margin-bottom:6px}
.note-card .meta{font-size:11.5px;color:var(--caption);font-family:'SF Mono',Consolas,monospace;margin-bottom:6px}
.note-card .body{font-size:12.5px;color:var(--label2)}
.note-card .body b{color:var(--label1)}
</style>
</head>
<body>
<div class="wrap">
  <div class="topbar">
    <div class="logo"><span class="mark">TF</span>TermFleet</div>
    <div class="nav">
      <span id="navRemote" onclick="pg('remote')">远程</span>
      <span class="on" id="navTask" onclick="pg('task')">任务</span>
      <span id="navMem" onclick="pg('mem')">避坑库 <span id="memCnt" style="font-size:11px;opacity:.7"></span></span>
      <span id="navAudit" onclick="pg('audit')">审计</span>
    </div>
    <span class="spacer"></span>
    <span class="pill" id="chanPill">无通道</span>
    <span class="me">我是 <input id="meInput" title="显示名（写入操作历史/审计）"></span>
    <button class="btn ghost sm" id="themeBtn"></button>
  </div>

  <!-- ═══ 远程 ═══ -->
  <div class="page" id="pg-remote">
    <div class="rem">
      <!-- 左栏：纯设备列表 -->
      <div class="panel">
        <h5>成员 · 设备</h5>
        <div class="dev" id="devLocal" title="查看本机 pwsh 终端与 dsh 会话事件流">
          <span class="dot on"></span><div class="av">我</div>
          <div style="min-width:0"><div class="nm">本机 <span class="pill g" style="margin-left:2px">在线</span></div>
          <div class="mach">127.0.0.1 · dsh 宿主内</div><div class="sessn" id="devLocalSub">pwsh 通道未建立</div></div>
        </div>
        <div id="memberDevs"></div>
        <div class="devfoot">
          <button class="ibtn" id="settingsBtn">⚙ 设置</button>
          <span class="costline" id="costSummary">加载中…</span>
        </div>
      </div>
      <!-- 右栏：context 状态机（none | local | member） -->
      <div>
        <div class="chanstrip" id="chanStrip">
          <span id="rtState" class="pill">○ 未连接</span>
          <span style="font-size:12.5px;color:var(--label3);min-width:0" id="rtMeta"></span>
          <span class="spacer"></span>
          <button class="btn ghost sm" id="rtModeBtn" disabled>切只读</button>
          <button class="btn danger sm" id="rtEndBtn" disabled>断开</button>
        </div>

        <div class="ctxnone" id="ctxNone">
          <div class="cta" id="ctaLocal">
            <div class="ctaic">▶</div>
            <div class="big">查看本机 pwsh</div>
            <div class="sub">打开插件自托管的探针终端 + 本宿主 dsh 会话事件流（全程过同意门·留痕）</div>
          </div>
          <div class="cta" id="ctaMember">
            <div class="ctaic">👥</div>
            <div class="big">看成员的会话</div>
            <div class="sub">在左侧点选成员设备 → 订阅 TA 的 dsh 会话对话流（TA 同意镜像后才可见）</div>
          </div>
        </div>

        <!-- 本机视图：PTY 终端 + dsh 事件流（合并面板） -->
        <div class="panel" id="ctxLocal" style="display:none">
          <div class="rtoolbar">
            <span class="pill b">本机</span>
            <button class="btn sm" id="reqLocalBtn" style="display:none">请求连接本机 pwsh</button>
            <i class="info" data-tip="本机 pwsh=插件自托管的探针终端（验证 PTY 链路用）；连接成员机时，看到的是 TA 的 dsh/CLI 会话流（宿主 listener 实测 seq 级）。远程对象=会话本身；无同意通道时服务端一律 403，只读禁写同为服务端强制。">i</i>
            <span class="spacer"></span>
            <span style="font-size:12.5px;color:var(--label3)" id="localHint">探针终端 · 连接后可操作（rw）/仅看（ro）</span>
          </div>
          <div class="term" id="ptyTerm">（点「请求连接本机 pwsh」——同意后此处实时显示宿主内 pwsh 流）</div>
          <div class="cmdline" id="cmdline">
            <input id="cmdInput" placeholder="输入指令回车发送（写入带 actor·留痕）…" onkeydown="if(event.key==='Enter')sendCmd()">
            <button class="btn sm" onclick="sendCmd()">发送</button>
          </div>
          <div class="evhead">dsh 会话事件流 <span class="pill b">宿主 listener · 实时</span>
            <i class="info" data-tip="本宿主的 dsh 会话一有事件就实时出现在这里——可在另一个 dsh 实例的 web 里发条消息试试。"></i>
            <span class="spacer"></span><span class="pill" id="evCnt">0 条</span>
          </div>
          <div class="evlist" id="evList"><div class="note" style="padding:4px 2px">（本宿主的 dsh 会话一有事件就实时出现在这里）</div></div>
        </div>

        <!-- 成员视图：对话流 + 插话 -->
        <div class="panel" id="ctxMember" style="display:none">
          <div class="rtoolbar">
            <span class="pill b" id="sfMemberPill" style="display:none"></span>
            <span class="pill" id="sfState">未选择成员</span>
            <span class="spacer"></span>
            <i class="info" data-tip="先重放最近 ≤300 条会话记录，后实时镜像。插话需 rw 会话通道（TA 同意「允许」后建立，限时 30 分钟）；只读通道只能看。"></i>
            <span class="pill" id="sfCnt">0 条</span>
          </div>
          <div class="sfend" id="sfEnd">▪ 已结束——该成员的会话同意通道已关闭，镜像停止。</div>
          <div class="sflist" id="sfList"><div class="ph">未选择成员——在左侧点选成员设备开始订阅。</div></div>
          <button class="btn ghost sm" id="sfJump" style="display:none;margin:6px auto 0">↓ 回到底部（最新消息）</button>
          <div style="display:flex;gap:8px;margin:10px 14px 0">
            <input id="sfInput" placeholder="插话将注入成员的活动 dsh 会话（Enter 发送）…" disabled style="flex:1;background:var(--card2);border:1px solid var(--border2);border-radius:10px;color:var(--label1);padding:8px 12px;font-size:12.5px;outline:none">
            <button class="btn ghost sm" id="sfReqSess" style="display:none">请求会话镜像</button>
            <button class="btn sm" id="sfSend" disabled>插话</button>
          </div>
          <div class="note" id="sfWhy" style="margin:6px 14px 12px">未选择成员。</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ═══ 任务 ═══ -->
  <div class="page on" id="pg-task">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <h3 style="font-size:15px">项目任务板</h3>
      <i class="info" data-tip="全员共享：任何人可建/认领/更新。行列表默认按 置顶 → 优先级(P0>P1>P2) → 状态 排序；★ 星标=本机置顶（存 localStorage，不进共享板）。点击行开任务详情。"></i>
      <span class="pill">全员共享 · 任何人可建/认领/更新</span>
      <span class="spacer"></span>
      <div class="seg"><button id="vList" class="on" onclick="tv(this,'list')">列表</button><button id="vBoard" onclick="tv(this,'board')">看板</button></div>
      <button class="btn sm" id="newBtn"></button>
    </div>
    <div class="tbar">
      <div class="seg" id="projSeg"></div>
      <div class="search" id="searchBox">🔍<input id="searchInput" placeholder="搜索标题/描述/人…"></div>
      <span class="spacer"></span>
      <button class="btn ghost sm" onclick="toast('按优先级排序（本视图已按序）')">⇅ 按优先级</button>
      <button class="btn ghost sm" onclick="toast('只看与我相关的任务（演示）')">只看我的</button>
    </div>
    <div class="boardwrap off" id="boardWrap"><div class="board" id="board"></div></div>
    <div class="listwrap on" id="listWrap">
      <div class="panel">
        <div class="thead"><span>任务</span><span>负责人</span><span>状态</span><span style="text-align:right">操作</span></div>
        <div id="listRows"></div>
      </div>
    </div>
  </div>

  <!-- ═══ 避坑库 ═══ -->
  <div class="page" id="pg-mem">
    <div class="tbar">
      <div class="seg" id="memStateSeg"></div>
      <div class="seg" id="memCatSeg"></div>
      <div class="search">🔍<input id="memSearch" placeholder="搜索教训/正文…"></div>
      <span class="spacer"></span>
      <span class="pill" id="memStat"></span>
      <button class="btn ghost sm" id="memVerifyBtn"></button>
      <button class="btn sm" id="newLessonBtn"></button>
    </div>
    <div class="lesson-grid" id="lessonGrid"></div>
  </div>

  <!-- ═══ 审计 ═══ -->
  <div class="page" id="pg-audit">
    <div class="panel" style="padding:14px 16px 18px">
      <div class="tbar">
        <div class="seg" id="audSeg">
          <button class="on" data-k="*">全部</button><button data-k="任务">任务</button><button data-k="避坑">避坑</button><button data-k="连接">连接/通道</button>
        </div>
        <select id="audWho" style="background:var(--card2);border:1px solid var(--border);border-radius:999px;color:var(--label1);padding:4px 12px;font-size:12.5px;outline:none"><option value="*">全部操作人</option></select>
        <span class="spacer"></span>
        <span class="pill" id="audCnt"></span>
        <button class="btn ghost sm" id="audReplay"></button>
        <button class="btn ghost sm" id="audRefresh"></button>
      </div>
      <div id="auditList"></div>
    </div>
  </div>
</div>

<!-- 任务详情·居中窗（六 tab） -->
<div class="overlay" id="ovl" onclick="closeDrawer()"></div>
<div class="drawer" id="drawer">
  <div class="dhead">
    <b id="dId" class="mono" style="font-size:12.5px;color:var(--caption)"></b>
    <h3 id="dTitle"></h3>
    <span id="dStatusPill"></span>
    <span class="spacer"></span>
    <button class="ibtn" id="dClaimBtn"></button>
    <button class="ibtn" id="dFlowBtn"></button>
    <button class="ibtn" id="dDelBtn"></button>
    <button class="ibtn" onclick="closeDrawer()">✕</button>
  </div>
  <div class="dtabs" id="dtabs">
    <span class="on" onclick="dtab(this,'dp-doc')">文档</span>
    <span onclick="dtab(this,'dp-flow')">全流程</span>
    <span onclick="dtab(this,'dp-sess')">会话</span>
    <span onclick="dtab(this,'dp-notes')">决策笔记</span>
    <span onclick="dtab(this,'dp-wf')">工作流</span>
    <span onclick="dtab(this,'dp-diff')">diff</span>
  </div>
  <div class="dbody">
    <div class="dpane on" id="dp-doc"><div class="doc-outline" id="docOutline"></div></div>
    <div class="dpane" id="dp-flow"><div class="flow" id="flowEl"></div></div>
    <div class="dpane" id="dp-sess"><div id="dpSessBody"><div class="ph">加载中…</div></div></div>
    <div class="dpane" id="dp-notes"><div id="taskNotes"></div></div>
    <div class="dpane" id="dp-wf"><div class="ph">dsh workflow run 步骤树——任务接工作流引擎后点亮</div></div>
    <div class="dpane" id="dp-diff"><div id="dpDiffBody"><div class="ph">加载中…</div></div></div>
  </div>
</div>

<!-- 同意卡（pending 时弹出；独立会话通道卡已并入此弹层） -->
<div class="mask" id="consentMask"><div class="modal">
  <h4 id="csTitle">会话通道</h4>
  <div class="who" id="csWho">未建立通道——没有人在连接你。</div>
  <div class="acts" id="csActs"></div>
  <div class="note" style="margin-top:10px">成员侧视角（单机模拟：跨机后此卡来自成员机的 decide）；拒绝无需理由 · 全程留痕。</div>
</div></div>

<!-- R1/R3 设置弹层（原左栏「总线与 IM 设置」整块迁入） -->
<div class="mask" id="settingsMask"><div class="modal wide">
  <h4>⚙ 团队设置 <button class="ibtn" style="margin-left:auto" onclick="closeSettings()">✕</button></h4>
  <div class="sgt">配对</div>
  <div style="font-size:12.5px;color:var(--label3)">当前角色：<b id="pairRole" style="color:var(--label1)">?</b> <span id="pairName" style="color:var(--caption)"></span></div>
  <label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" id="trustTgl" style="width:auto"> 信任此 lead：会话查看请求自动允许（仅只读，随时可断）</label>
  <details class="adv">
    <summary>高级 · 手动配对（角色 / 成员名 / leadUrl / 团队令牌）</summary>
    <div class="ain">
      <select id="pairSel" style="background:var(--card2);border:1px solid var(--border2);border-radius:8px;color:var(--label1);padding:5px 8px;font-size:12px">
        <option value="">— 改角色 —</option><option value="lead">lead（被连端）</option><option value="member">member（连接端）</option><option value="off">off</option>
      </select>
      <input id="pairName2" placeholder="成员名（member 用）" style="background:var(--card2);border:1px solid var(--border2);border-radius:8px;color:var(--label1);padding:5px 8px;font-size:12px">
      <input id="pairUrl" placeholder="leadUrl（member 用）ws://…" style="background:var(--card2);border:1px solid var(--border2);border-radius:8px;color:var(--label1);padding:5px 8px;font-size:12px">
      <input id="pairTok" placeholder="团队令牌（≥6位）" style="background:var(--card2);border:1px solid var(--border2);border-radius:8px;color:var(--label1);padding:5px 8px;font-size:12px">
      <div class="fin"><button class="btn sm" id="pairSave">保存配对</button></div>
      <div class="hint">member 保存后 5 秒内出站连接 lead；本机测试用两个端口各开一实例。一般用下方「邀请码」即可，无需手填。</div>
    </div>
  </details>
  <div class="sgt">邀请码 · 一句话入队（TF-JOIN）</div>
  <div class="step"><span class="no">1</span><div class="sc" style="width:100%">
    <div class="hint" style="margin:0 0 5px">lead 侧：生成邀请码并复制发给成员</div>
    <div class="fin">
      <input id="pairCode" readonly placeholder="点「取码」生成 TF1-…" class="mono">
      <button class="btn ghost sm" id="pairCodeBtn">取码</button>
      <button class="btn ghost sm" id="pairCodeCopy">复制</button>
    </div>
  </div></div>
  <div class="step"><span class="no">2</span><div class="sc" style="width:100%">
    <div class="hint" style="margin:0 0 5px">member 侧：粘贴邀请码，点「入队」即配对</div>
    <div class="fin">
      <input id="joinCode" placeholder="粘贴邀请码 TF1-…">
      <button class="btn sm" id="joinBtn">入队</button>
    </div>
  </div></div>
  <div class="hint" id="pairNote">lead 取码发给成员 → 成员粘贴点「入队」→ 5s 内连上（码含 lead 地址+团队令牌，请勿外传）。</div>
  <div class="sgt">IM 通知</div>
  <div class="fin"><input id="imWebhook" placeholder="webhook URL（飞书机器人/自定义）"></div>
  <div class="fin" style="margin-top:7px">
    <button class="btn ghost sm" id="imSave">保存</button>
    <button class="btn ghost sm" id="imToggle"></button>
    <button class="btn ghost sm" id="imTest">测试发送</button>
    <span class="spacer"></span>
    <button class="btn sm" id="sosBtn"></button>
  </div>
  <div class="hint">审批卡/通知走 webhook 推送；「呼叫 lead」=通知 lead + IM（人在外场景）。</div>
  <div class="sgt">今日成本</div>
  <div class="hint" id="costDetail" style="margin:0">加载中…</div>
  <div class="acts"><button class="btn ghost" onclick="closeSettings()">关闭</button></div>
</div></div>

<!-- 回放弹窗 -->
<div class="mask" id="replayMask"><div class="modal" style="width:min(760px,94vw)">
  <h4>回放 <span class="pill b" style="margin-left:auto">PTY 历史 + 审计时间线</span></h4>
  <div style="display:flex;gap:8px;margin-bottom:10px;align-items:center;flex-wrap:wrap">
    <div class="seg" id="repFilter"><button class="on" data-f="all">全部</button><button data-f="连接">连接/通道</button><button data-f="任务">任务</button><button data-f="避坑">避坑</button></div>
    <span class="spacer"></span>
    <button class="btn ghost sm" id="repStep">⏮ 步进回放</button>
  </div>
  <div style="display:flex;gap:12px;max-height:60vh">
    <div style="flex:1;min-width:0">
      <div style="font-size:11px;color:var(--caption);font-weight:600;margin-bottom:6px">终端输出（清洗后·可步进）</div>
      <div class="term" id="replayPty" style="margin:0;max-height:320px;min-height:120px;font-size:11.5px"></div>
    </div>
    <div style="width:300px;flex:none">
      <div style="font-size:11px;color:var(--caption);font-weight:600;margin-bottom:6px">审计时间线（点击行=定位）</div>
      <div id="replayAudit" style="max-height:320px;overflow-y:auto"></div>
    </div>
  </div>
  <div class="acts"><button class="btn ghost" onclick="document.getElementById('replayMask').classList.remove('on')">关闭</button></div>
</div></div>

<!-- 最近动态（一键查看成员近期会话事件） -->
<div class="mask" id="recentMask"><div class="modal">
  <h4 id="recentTitle">最近动态</h4>
  <div id="recentBody" style="max-height:420px;overflow-y:auto"></div>
  <div class="acts"><button class="btn ghost" onclick="document.getElementById('recentMask').classList.remove('on')">关闭</button></div>
</div></div>

<!-- 新建任务 -->
<div class="mask" id="formMask"><div class="modal">
  <h4>新建任务 <i class="info tipdn" data-tip="立项前 grill 九项自检：目标与验收？谁在用？不做什么？依赖？副作用？数据格式？测试面？可复用？性能安全？——机械改动请勿立项。"></i></h4>
  <label>标题 *</label><input id="fTitle" placeholder="要做什么">
  <div id="fSim" class="fsim"></div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
    <div><label>项目</label><input id="fProject" placeholder="如 pay"></div>
    <div><label>优先级</label><select id="fPrio"><option>P2</option><option>P1</option><option>P0</option></select></div>
    <div><label>截止</label><input id="fDue" placeholder="如 周五 / 09-30"></div>
  </div>
  <label>指定 CLI（可空：dsh / kimi / codex / pwsh…）</label><input id="fCli" placeholder="dsh">
  <label style="display:flex;gap:8px;align-items:center;margin-top:2px"><input type="checkbox" id="fSessOn" checked style="width:auto"> 绑定本机当前 dsh 会话 <span id="fSessHint" style="color:var(--caption);font-size:11.5px">（检测中…）</span></label>
  <label>验收条目（每行一条，自动编号 A1/A2…）</label><textarea id="fAcc" rows="2" placeholder="可执行/可观察的验收条件"></textarea>
  <label>待确认（每行一条 C1/C2…；未清零不得进入实施）</label><textarea id="fPend" rows="2" placeholder="需要拍板的细节点+推荐答案"></textarea>
  <label>描述（TL;DR+背景，即任务文档正文）</label><textarea id="fDesc" rows="4" placeholder="目标一段话+3-5 条重点；背景与决策可后续补"></textarea>
  <div class="acts"><button class="btn ghost" onclick="document.getElementById('formMask').classList.remove('on')">取消</button><button class="btn" id="formSubmit">创建</button></div>
</div></div>

<!-- 新增避坑 -->
<div class="mask" id="lessonMask"><div class="modal">
  <h4>新增避坑（团队记忆） <i class="info tipdn" data-tip="写法（wnlds 规范）：proposed 必须含「备选」段——先写备选最强理由，再写为何放弃；收益与代价都要写。落库写入 ~/.dsh/termfleet/team-memory/*.md（团队仓工作副本）。"></i></h4>
  <label>标题 *</label><input id="lTitle" placeholder="一句话决策/教训，如：部署前必须跑双机验收">
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
    <div><label>状态</label><select id="lState"><option>proposed</option><option>implemented</option><option>rejected</option></select></div>
    <div><label>分类（六选一）</label><select id="lCat"><option>process</option><option>architecture</option><option>bug-fix</option><option>feature</option><option>simplification</option><option>testing</option></select></div>
    <div><label>项目</label><input id="lProject" placeholder="如 pay / 通用"></div>
  </div>
  <div style="display:grid;grid-template-columns:1fr;gap:10px">
    <div><label>关联任务（可空）</label><input id="lSource" placeholder="如 T-001"></div>
  </div>
  <label>正文（卡点 / 解法 / 代价）</label><textarea id="lBody" rows="5"></textarea>
  <div class="acts"><button class="btn ghost" onclick="document.getElementById('lessonMask').classList.remove('on')">取消</button><button class="btn" id="lessonSubmit">落库</button></div>
</div></div>

<div class="menu" id="statMenu"></div>
<div class="toast" id="toastEl"></div>
<div class="tfnotifwrap" id="tfNotifWrap"></div>

<script>
var NL=String.fromCharCode(10),CR=String.fromCharCode(13),NL2=NL+NL,LF3=new RegExp(NL+'{3,}','g');
var ICONS = ${ICONS_JSON};
;var ansiClean = (function(){ var src = atob('${ANSI_B64}'); src = src.replace(/^function ansiClean\(t\)\{/, 'function(t){').replace(/\}\s*$/, '}'); return new Function('return (' + src + ')')(); })();
function ic(n, size){ size = size || 16; var ds = ICONS[n] || []; var inner = '';
  for (var i=0;i<ds.length;i++) inner += '<path d="'+ds[i]+'" fill="currentColor"/>';
  return '<svg class="ic" width="'+size+'" height="'+size+'" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+inner+'</svg>'; }

var TOK = new URLSearchParams(location.search).get('token') || localStorage.getItem('tf_token') || '';
if (TOK) localStorage.setItem('tf_token', TOK);
var ME = localStorage.getItem('tf_user') || 'me';
var ST = { tasks: [], q: '' };
var MEM = { lessons: [], state: '*', cat: '*', q: '' };
var AUD = { events: [], k: '*', who: '*' };
var CH = null;
var selMember = null      // 选中的成员机名（null=本机）
var VIEW = 'none'         // 右栏 context 状态机：none | local | member
var FLEET = { members: [], role: '?', name: '' }
var NSTATE = { proposed: ['待定','a'], implemented: ['已生效','g'], rejected: ['已否决','r'], archived: ['已归档',''] };
var NCATS = ['feature','bug-fix','simplification','architecture','process','testing'];
var NFLOW = { proposed: ['implemented','rejected'], implemented: ['archived'], rejected: ['archived'], archived: [] };            // 当前同意通道 {id,status,mode,expireAt,...}
var STATUSES = [['needs-triage','待分诊'],['ready','就绪'],['active','进行中'],['review','待验收'],['implemented','已实施'],['blocked','阻塞']];
var UB_STATES = ['needs-triage','needs-info','ready-for-agent','ready-for-human','active','review','implemented','blocked','wontfix','archived'];
var UB_FLOW = {
  'needs-triage': ['needs-info','ready-for-agent','ready-for-human','wontfix'],
  'needs-info': ['needs-triage'],
  'ready-for-agent': ['active','needs-triage'],
  'ready-for-human': ['active','needs-triage'],
  'active': ['review','needs-info','blocked','wontfix'],
  'review': ['implemented','active'],
  'implemented': ['archived'],
  'blocked': ['needs-triage','wontfix'],
  'wontfix': ['needs-triage'],
  'archived': []
};
var UB_BOARD = [['needs-triage','待分诊'],['ready','就绪'],['active','进行中'],['review','待验收'],['implemented','已实施']];
function stLabel(s){ var M={'needs-triage':'待分诊','needs-info':'缺信息','ready-for-agent':'就绪(A)','ready-for-human':'就绪(H)','active':'进行中','review':'待验收','implemented':'已实施','blocked':'阻塞','wontfix':'不做','archived':'归档','todo':'待办','doing':'进行中','done':'完成'}; return M[s]||s; }
function stClass(s){ return s==='implemented'||s==='done'?'g':s==='blocked'||s==='wontfix'?'r':s==='review'?'a':s==='active'||s==='doing'?'b':''; }
function boardOf(s){ if(['ready-for-agent','ready-for-human'].indexOf(s)>=0)return 'ready'; if(['todo'].indexOf(s)>=0)return 'needs-triage'; if(['doing'].indexOf(s)>=0)return 'active'; if(['done'].indexOf(s)>=0)return 'implemented'; return s; }

function api(path, body){
  return fetch(path, body ? { method:'POST', headers:{ 'content-type':'application/json','authorization':'Bearer '+TOK,'x-tf-user':encodeURIComponent(ME) }, body: JSON.stringify(body) }
                          : { headers:{ 'authorization':'Bearer '+TOK,'x-tf-user':encodeURIComponent(ME) } })
    .then(function(r){ if (r.status===401){ document.body.insertAdjacentHTML('afterbegin','<div style="background:var(--red-t);color:var(--red);padding:10px 14px;border-radius:12px;margin-bottom:10px">401：需带 ?token= 打开（~/.dsh/termfleet/token.json）</div>'); throw new Error('401'); } return r.json(); });
}
function toast(m){ var t=document.getElementById('toastEl'); t.textContent=m; t.classList.add('on'); clearTimeout(t._tm); t._tm=setTimeout(function(){t.classList.remove('on')},2400); }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function stLabel(s){ var M={'needs-triage':'待分诊','needs-info':'缺信息','ready-for-agent':'就绪(A)','ready-for-human':'就绪(H)','active':'进行中','review':'待验收','implemented':'已实施','blocked':'阻塞','wontfix':'不做','archived':'归档','todo':'待办','doing':'进行中','done':'完成'};
  for (var i=0;i<STATUSES.length;i++) if (STATUSES[i][0]===s) return STATUSES[i][1]; return M[s]||s; }
function stClass(s){ return s==='done'?'g':s==='blocked'?'r':s==='review'?'a':s==='doing'?'b':''; }
function stDot(s){ return s==='implemented'||s==='done'?'done':s==='blocked'||s==='wontfix'?'blocked':s==='review'?'review':s==='active'||s==='doing'?'doing':'todo'; }
/* ═══ R2 任务置顶（星标 · localStorage 持久）+ 确定性排序 ═══ */
var PRIO_RANK={P0:0,P1:1,P2:2};
var ST_RANK={'needs-triage':0,'needs-info':1,'ready-for-agent':2,'ready-for-human':2,'active':3,'doing':3,'review':4,'implemented':5,'done':5,'blocked':7,'wontfix':8,'archived':9};
function pinIds(){ try{ var v=JSON.parse(localStorage.getItem('tf_pin_tasks')||'[]'); return Array.isArray(v)?v:[] }catch(e){ return [] } }
function isPinned(id){ return pinIds().indexOf(id)>=0 }
function togglePin(id){ var p=pinIds(); var i=p.indexOf(id); if(i>=0)p.splice(i,1); else p.unshift(id);
  try{ localStorage.setItem('tf_pin_tasks',JSON.stringify(p)) }catch(e){}
  render(); toast(isPinned(id)?('已置顶 '+id+'（排最前）'):('已取消置顶 '+id)); }
function pinSort(arr){ return arr.slice().sort(function(a,b){
  var pa=isPinned(a.id)?0:1, pb=isPinned(b.id)?0:1;
  if(pa!==pb) return pa-pb;
  var ra=PRIO_RANK[a.prio]!=null?PRIO_RANK[a.prio]:3, rb=PRIO_RANK[b.prio]!=null?PRIO_RANK[b.prio]:3;
  if(ra!==rb) return ra-rb;
  var sa=ST_RANK[a.status]!=null?ST_RANK[a.status]:6, sb=ST_RANK[b.status]!=null?ST_RANK[b.status]:6;
  if(sa!==sb) return sa-sb;
  return (a.createdAt||0)-(b.createdAt||0); }); }
function projVisible(){ return visible().filter(function(t){ return ST.proj==='*'||(t.project||'默认')===ST.proj; }); }

/* ═══ 导航 ═══ */
function pg(v){
  ['remote:Remote','task:Task','mem:Mem','audit:Audit'].forEach(function(p){ var k=p.split(':')[0];
    document.getElementById('nav'+p.split(':')[1]).classList.toggle('on', v===k); });
  document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('on'); });
  document.getElementById('pg-'+v).classList.add('on');
  if (v==='remote'){ renderChannel(); if(!window._fleetTimer){ window._fleetTimer=setInterval(pollFleet,2500); pollFleet(); } }
  if (v==='task') load(); // 每次进任务页都拉最新（跨机同步的任务不刷新就永远不上板）
  if (v==='mem') loadMem();
  if (v==='audit') loadAudit();
}
function tv(el,v){ el.parentNode.querySelectorAll('button').forEach(function(b){b.classList.remove('on')}); el.classList.add('on');
  document.getElementById('boardWrap').classList.toggle('off', v!=='board');
  document.getElementById('listWrap').classList.toggle('on', v==='list'); }

/* ═══ R1 右栏 context 状态机（none | local | member） ═══ */
function setView(v){
  VIEW=v;
  if(v==='local') selMember=null;
  document.getElementById('ctxNone').style.display=v==='none'?'':'none';
  document.getElementById('ctxLocal').style.display=v==='local'?'':'none';
  document.getElementById('ctxMember').style.display=v==='member'?'':'none';
  document.getElementById('devLocal').classList.toggle('sel',v==='local');
  document.querySelectorAll('#memberDevs .dev').forEach(function(d){ d.classList.toggle('sel', v==='member'&&d.getAttribute('data-member')===selMember); });
  renderChannel();
}

/* ═══ 同意总线（真） ═══ */
function fmtRemain(ms){ var s=Math.max(0,Math.floor(ms/1000)); return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); }
var tick=null;
function renderChannel(){
  var pill=document.getElementById('chanPill'), st=document.getElementById('rtState'), meta=document.getElementById('rtMeta');
  var mb=document.getElementById('rtModeBtn'), eb=document.getElementById('rtEndBtn');
  var strip=document.getElementById('chanStrip');
  var sub=document.getElementById('devLocalSub');
  clearInterval(tick); tick=null;
  var showStrip=false;
  if(CH && CH.status==='pending'){
    showStrip=true;
    var mT0=CH.target&&CH.target.indexOf('member:')===0;
    st.className='pill a'; st.textContent='◌ 等待被控方确认';
    meta.textContent='同意后限时 30 分钟 · 拒绝无需理由 · 全程留痕';
    mb.disabled=true; mb.textContent='切只读'; eb.disabled=false; eb.textContent='取消请求';
    var sessObj=(CH&&CH.type==='sess')?'dsh 会话（镜像+插话）':'pwsh 会话';
    document.getElementById('csTitle').innerHTML=(CH&&CH.remote
      ? '⚑ 收到连接请求（来自 lead）'
      : '你发起的连接 · 等待被控方确认')+' <span class="pill a" style="margin-left:auto">待确认</span>';
    document.getElementById('csWho').innerHTML=(CH&&CH.remote
      ? '<b>'+esc(CH.requester||'lead')+'</b> 请求连接 <b>你的 '+sessObj+'</b>（仅此会话，不碰桌面）。你的答复：'
      : '<b>'+esc(CH?CH.requester:ME)+'</b>（你）→ <b>'+(mT0?esc(CH.target.slice(7))+' 的 '+sessObj:'本机 '+sessObj)+'</b>。下方按钮=被控方答复：');
    document.getElementById('csActs').innerHTML='<button class="btn sm" id="csA">允许</button><button class="btn ghost sm" id="csR">仅只读</button><button class="btn danger sm" id="csD">拒绝</button>';
    bindDecide(); document.getElementById('consentMask').classList.add('on');
    pill.className='pill a'; pill.textContent='等确认';
    sub.textContent=CH.remote?'收到连接请求——待你答复':'通道：等待确认';
  } else if(CH && CH.status==='active'){
    showStrip=true;
    if(CH.remote){ // 成员侧视角：lead 正在查看本机
      st.className='pill g'; st.textContent='● 被查看中 · '+(CH.mode==='rw'?'可操作':'只读');
      meta.textContent=esc(CH.requester||'lead')+' 正在查看本机会话 · 随时可断开';
      mb.disabled=true; mb.textContent='切只读'; eb.disabled=false; eb.textContent='断开';
      document.getElementById('cmdline').classList.remove('on');
      sub.textContent=(CH.type==='sess'?'会话':'pwsh')+'通道被 '+(CH.requester||'lead')+' 使用中';
      pill.className='pill g'; pill.textContent='通道开放中';
      document.getElementById('consentMask').classList.remove('on');
    } else {
      st.className='pill '+(CH.mode==='rw'?'g':'a'); st.textContent='● '+(CH.mode==='rw'?'rw · 可操作':'ro · 只读');
      mb.disabled=false; mb.textContent=CH.mode==='rw'?'切只读':'（只读中）'; eb.disabled=false; eb.textContent='断开';
      var chLabel=(CH.type==='sess')?'会话镜像':'pwsh';
      var mTarget=CH.target&&CH.target.indexOf('member:')===0;
      if(CH.type==='sess'||mTarget||VIEW!=='local'){ document.getElementById('cmdline').classList.remove('on'); }
      else{ document.getElementById('cmdline').classList.add('on');
        var i=document.getElementById('cmdInput'); i.disabled=(CH.mode!=='rw'); i.placeholder=CH.mode==='rw'?'输入指令回车发送（写入带 actor·留痕）…':'只读通道——服务端禁写（403）'; }
      sub.textContent=chLabel+'通道：'+CH.mode+' · 剩 '+fmtRemain(CH.expireAt-Date.now());
      tick=setInterval(function(){ if(!CH||CH.status!=='active'){clearInterval(tick);return}
        meta.innerHTML=(mTarget?'会话镜像 · ':'仅此会话 · ')+'剩余 <b class="mono" style="color:var(--label1)">'+fmtRemain(CH.expireAt-Date.now())+'</b> · 随时可断';
        sub.textContent=chLabel+'通道：'+CH.mode+' · 剩 '+fmtRemain(CH.expireAt-Date.now());
        if(CH.expireAt<=Date.now()){ CH.status='expired'; renderChannel(); toast('限时到——通道自动断开（服务端已失效）'); } },1000);
      meta.innerHTML=(mTarget?'会话镜像 · ':'仅此会话 · ')+'剩余 <b class="mono" style="color:var(--label1)">'+fmtRemain(CH.expireAt-Date.now())+'</b> · 随时可断';
      pill.className='pill '+(CH.mode==='rw'?'g':'a'); pill.textContent='通道 '+(CH.mode==='rw'?'rw':'ro')+' · '+fmtRemain(CH.expireAt-Date.now());
      document.getElementById('consentMask').classList.remove('on');
      // context 归位：活动通道指向成员→成员视图；本机 pwsh→本机视图
      if(mTarget){ if(VIEW!=='member'){ selMember=CH.target.slice(7); setView('member'); } if(SF.member!==selMember) sfOpen(selMember); }
      else if(VIEW==='none'){ setView('local'); }
    }
  } else {
    var why = CH ? ({denied:'已拒绝',ended:'已断开',expired:'已过期'})[CH.status]||CH.status : '未连接';
    st.className='pill'; st.textContent='○ '+why;
    meta.textContent=VIEW==='local'?'连接本机 pwsh 会话（全程过同意门·留痕）':'';
    mb.disabled=true; mb.textContent='切只读'; eb.disabled=true; eb.textContent='断开';
    document.getElementById('cmdline').classList.remove('on');
    sub.textContent='pwsh 通道未建立';
    document.getElementById('consentMask').classList.remove('on');
    pill.className='pill'; pill.textContent='无通道';
  }
  if(!showStrip && VIEW!=='none') showStrip=true; // 本机/成员视图下常驻一行通道状态
  strip.style.display=showStrip?'flex':'none';
  var rb=document.getElementById('reqLocalBtn');
  if(rb) rb.style.display=(VIEW==='local'&&!CH)?'':'none';
}
function bindDecide(){
  var m=document.getElementById('consentMask');
  var A=document.getElementById('csA'),R=document.getElementById('csR'),D=document.getElementById('csD');
  if(A){A.onclick=function(){decide('allow')}} if(R){R.onclick=function(){decide('readonly')}} if(D){D.onclick=function(){decide('deny')}}
}
function pollFleet(){
  api('/dsh-termfleet/fleet').then(function(d){
    FLEET.members=d.members||[];
    var box=document.getElementById('memberDevs');
    if(!FLEET.members.length){ box.innerHTML='<div class="dev" style="opacity:.5"><span class="dot off"></span><div class="av">?</div><div><div class="nm">团队成员设备</div><div class="sessn">暂无成员在线（member 配对后 5s 内出现）</div></div></div>'; return; }
    box.innerHTML=FLEET.members.map(function(m){
      // R-fix 成员卡信息行：①裸计数加标签（并入「N 条近期事件」，不再两处重复）②lastProgress 徽标与 summary.state 同文案时去重 ③bus 行 tags 为空时省略「 · 」分隔
      var tags=(m.sessions||[]).map(function(s){return s.tag}).filter(Boolean);
      var info=[];
      if(m.summary) info.push('<b style="color:var(--label2)">'+esc(m.summary.state)+'</b> '+esc((m.summary.line||'').slice(0,34)));
      info.push((m.recentEvents||[]).length+' 条近期事件');
      var pLabel=m.lastProgress?String(m.lastProgress.label||m.lastProgress.kind||''):'';
      if(m.lastProgress&&pLabel&&pLabel!==m.summary.state) info.push('<span class="pill a" title="进度推送 '+esc((m.lastProgress.line||'').slice(0,40))+'">'+esc(pLabel)+'</span>');
      return '<div class="dev '+(selMember===m.name?'sel':'')+'" data-member="'+esc(m.name)+'"><span class="dot on"></span><div class="av">'+esc(m.name.slice(0,1))+'</div><div style="min-width:0"><div class="nm">'+esc(m.name)+' <span class="pill g" style="margin-left:2px">在线</span></div><div class="mach" style="font-family:SF Mono,Consolas,monospace;font-size:11.5px;color:var(--caption)">bus 已连'+(tags.length?' · '+esc(tags.join(',')):'')+'</div><div class="sessn">'+info.join(' · ')+(m.lastSos?' <span class="pill r">SOS '+(m.lastSos.msg||'').slice(0,10)+'</span>':'')+'</div><div style="display:flex;gap:4px;margin:4px 0 0;flex:none"><button class="btn ghost sm" data-qview="'+esc(m.name)+'" title="一键请求查看 TA 的会话——TA 开了信任则自动允许（仅只读）">⚡看会话</button><button class="btn ghost sm" data-qrecent="'+esc(m.name)+'" title="看 TA 最近 20 条会话动态">◔动态</button></div></div>';
    }).join('');
    box.querySelectorAll('[data-member]').forEach(function(el){ el.onclick=function(){ selMember=el.getAttribute('data-member');
      setView('member'); sfOpen(selMember); pollFleet(); toast('已选中成员机：'+selMember+'（会话对话流订阅中…）'); }; });
    box.querySelectorAll('[data-qview]').forEach(function(b){ b.onclick=function(ev){ ev.stopPropagation(); qview(b.getAttribute('data-qview')); }; });
    box.querySelectorAll('[data-qrecent]').forEach(function(b){ b.onclick=function(ev){ ev.stopPropagation(); qrecent(b.getAttribute('data-qrecent')); }; });
    // 远端通道 active：拉成员 pty 尾流显示（仅本机视图可见终端——成员视图走对话流）
    if(CH && CH.status==='active' && CH.target && CH.target.indexOf('member:')===0){
      var m2=FLEET.members.filter(function(x){return x.name===CH.target.slice(7)})[0];
      var sosM=FLEET.members.filter(function(x){return x.lastSos && (!window.__sosSeen||window.__sosSeen<x.lastSos.ts)})[0];
      if(sosM){ window.__sosSeen=sosM.lastSos.ts; toast('🆘 '+sosM.name+' 呼叫协助：'+(sosM.lastSos.msg||'-')); }
      if(m2 && m2.ptyTail && VIEW==='local'){ var el=document.getElementById('ptyTerm'); el.textContent=m2.ptyTail; el.scrollTop=el.scrollHeight; }
    }
  }).catch(function(){});
  api('/dsh-termfleet/pairing').then(function(d){ FLEET.role=d.pairing&&d.pairing.role||'?'; FLEET.name=d.pairing&&d.pairing.name||'';
    document.getElementById('pairRole').textContent=FLEET.role; document.getElementById('pairName').textContent=FLEET.name?('· '+FLEET.name):'';
    var tt=document.getElementById('trustTgl'); if(tt) tt.checked=!!(d.pairing&&d.pairing.trust); }).catch(function(){});
  // pending 轮询：远端成员答复 / 成员页收到 lead 请求 → 采纳
  if(CH && CH.status==='pending'){
    api('/dsh-termfleet/consent/list').then(function(d){
      var c=(d.consents||[]).filter(function(x){return x.id===CH.id})[0];
      if(c && c.status!=='pending'){ var mine=CH._mine!==false; CH=c; CH._mine=mine; renderChannel(); if(c.status==='active') toast('成员机已答复：'+(c.mode==='rw'?'允许（可操作）':'仅只读')); else if(c.status==='denied') toast('成员机已拒绝'); }
    }).catch(function(){});
  } else if(!CH && FLEET.role==='member'){
    api('/dsh-termfleet/consent/list').then(function(d){
      // 采纳远端 pending；信任自动允许的（active+auto）也采纳并提示（成员零操作闭环的可见性）
      var c=(d.consents||[]).filter(function(x){return x.remote&&(x.status==='pending'||(x.status==='active'&&x.auto))})[0];
      if(c){ CH=c; CH._mine=false; renderChannel(); if(c.status==='active'&&c.auto) toast('已按信任设置自动允许（只读）——lead 正在查看，随时可断开'); }
    }).catch(function(){});
  }
  sfGate();
}
function requestChannel(){
  var target = selMember ? ('member:'+selMember) : 'pwsh7·本机';
  api('/dsh-termfleet/consent/request',{type:'pty',target:target}).then(function(d){
    if(d.ok){ CH=d.consent; CH._mine=true; renderChannel(); toast('已发起连接请求（入审计）'); }});
}
/* 契约 I：快捷操作（愿望机：一键「请求+信任自动允许」/一键最近动态） */
function qview(name){
  api('/dsh-termfleet/consent/request',{type:'sess',target:'member:'+name,auto:'ro'}).then(function(d){
    if(d.ok){ CH=d.consent; CH._mine=true; renderChannel();
      toast('已一键发起查看——'+name+' 开了信任会自动允许（只读），否则等 TA 确认'); }
    else toast('请求失败：'+((d&&d.error)||'?'));
  });
}
function qrecent(name){
  api('/dsh-termfleet/fleet?r=20').then(function(d){
    var m=(d.members||[]).filter(function(x){return x.name===name})[0];
    if(!m){ toast(name+' 不在线'); return; }
    document.getElementById('recentTitle').textContent=name+' · 最近动态';
    var st=m.summary?('状态 <b>'+esc(m.summary.state)+'</b> · '+esc(m.summary.line||'')):'暂无状态';
    var body='<div class="note" style="margin-bottom:8px">'+st+(m.lastProgress?(' · 最近推送 <b>'+esc(m.lastProgress.label||m.lastProgress.kind)+'</b>'):(''))+(m.lastFollowupAck&&m.lastFollowupAck.ok?' · 插话已送达':'')+'</div>'
      +'<div style="max-height:360px;overflow-y:auto">'
      +((m.recentEvents||[]).length?m.recentEvents.slice().reverse().map(function(e){
          return '<div class="evrow"><span class="ts">'+(e.ts?new Date(e.ts).toLocaleTimeString():'')+'</span><span class="ty mono">'+esc(e.type||'?')+'</span><span>'+esc(String(e.text||e.brief||'').slice(0,80))+'</span></div>';
        }).join(''):'<div class="ph">暂无近期事件</div>')+'</div>';
    document.getElementById('recentBody').innerHTML=body;
    document.getElementById('recentMask').classList.add('on');
  }).catch(function(){ toast('拉取失败'); });
}
function decide(dec){
  // 先取「是否 lead 侧发起」——服务端回包会整体替换 CH，本地 _mine 标记必须捕获后回填
  var mine=CH&&CH._mine!==false;
  api('/dsh-termfleet/consent/decide',{id:CH.id,decision:dec}).then(function(d){
    if(d.ok){ CH=d.consent; CH._mine=mine; renderChannel();
      if(dec==='deny'){ toast('已拒绝——无需理由，入审计'); }
      else { toast('通道建立：'+(CH.mode==='rw'?'可操作':'只读')+' · 30 分钟');
        // lead 侧才开流；成员面板答复(mine=false)后不动作——开了只会撞出
        // 「成员机不在线」误弹与对本机 member-stream 的 403 噪音（本机没有自己的 member 流）。
        if(mine){ if(CH.target && CH.target.indexOf('member:')===0){ selMember=CH.target.slice(7); setView('member'); sfOpen(selMember); }
          else startPty(); } } }});
}
document.getElementById('rtEndBtn').onclick=function(){
  if(!CH) return;
  api('/dsh-termfleet/consent/end',{id:CH.id}).then(function(d){ if(d.ok){ CH=d.consent||CH; CH.status=CH.status||'ended'; CH={status:'ended'}; renderChannel(); toast('已断开（入审计）'); } });
};
document.getElementById('rtModeBtn').onclick=function(){ toast('模式切换由成员侧决定——当前演示通道模式固定 '+CH.mode); };

/* ═══ PTY 实流 ═══ */
var ptyLines=[], ptyES=null;
function startPty(){
  if(CH && CH.target && CH.target.indexOf('member:')===0){
    api('/dsh-termfleet/remote/write',{member:CH.target.slice(7),data:'echo MEMBER_PTY_READY\\r'}).then(function(d){
      if(d.ok===false){ toast('成员机不在线'); } });
    return;
  }
  api('/dsh-termfleet/probe-pty').then(function(d){
    if(d.ok===false){ toast('PTY: '+d.error); return }
    ptyLines=[d.tail||'']; drawPty();
  });
  if(ptyES) ptyES.close();
  ptyES=new EventSource('/dsh-termfleet/stream?k=pty&token='+encodeURIComponent(TOK));
  ptyES.addEventListener('pty',function(ev){ var d=JSON.parse(ev.data);
    ptyLines.push(d.d); if(ptyLines.length>200)ptyLines.shift(); drawPty(); });
}
function drawPty(){
  var el=document.getElementById('ptyTerm');
  el.textContent=ptyLines.join('').slice(-1800);
  el.scrollTop=el.scrollHeight;
}
function sendCmd(){
  var i=document.getElementById('cmdInput'); if(!i.value.trim())return;
  var v=i.value; i.value='';
  if(CH && CH.target && CH.target.indexOf('member:')===0){
    ptyLines.push('['+esc(ME)+'·远端→'+CH.target.slice(7)+'] '+v+'\\n'); drawPty();
    api('/dsh-termfleet/remote/write',{member:CH.target.slice(7),data:v+'\\r'}).then(function(d){
      if(d.ok===false){ ptyLines.push('✗ 远端拒绝: '+(d.error||'')+'\\n'); drawPty(); } });
    return;
  }
  ptyLines.push('['+esc(ME)+'·远端] '+v+'\\n'); drawPty();
  api('/dsh-termfleet/probe-pty/write',{data:v+'\\r'}).then(function(d){
    if(d.ok===false){ ptyLines.push('✗ 服务端拒绝: '+d.error+'\\n'); drawPty(); } });
}

/* ═══ dsh 会话事件流（SSE） ═══ */
var evBuf=[], evES=null, evSeen=0;
function startEvents(){
  if(evES) return;
  evES=new EventSource('/dsh-termfleet/stream?k=events&token='+encodeURIComponent(TOK));
  evES.addEventListener('sess',function(ev){ var d=JSON.parse(ev.data);
    evBuf.unshift(d); if(evBuf.length>30)evBuf.pop(); evSeen++; drawEvents(); });
  evES.addEventListener('tf-notify',function(ev){ try{ tfNotify(JSON.parse(ev.data)); }catch(e){} });
}
function drawEvents(){
  document.getElementById('evCnt').textContent=evSeen+' 条';
  var el=document.getElementById('evList');
  if(!evBuf.length) return;
  el.innerHTML=evBuf.map(function(e){
    return '<div class="evrow"><span class="ts">'+new Date(e.t).toLocaleTimeString()+'</span><span class="ty mono">'+esc(e.type||'')+(e.seq!=null?' #'+e.seq:'')+'</span><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(e.brief||'')+'</span></div>';
  }).join('');
}

/* ═══ tf-notify 通知弹条（右下 · consent-request 带去处理 · 同类 30s 去重） ═══ */
var tfSeen={}
function tfNotify(d){
  d=d||{}; var now=Date.now();
  var key=(d.kind||'')+'|'+(d.text||'');
  if(tfSeen[key]&&now-tfSeen[key]<30000)return;
  tfSeen[key]=now;
  for(var k in tfSeen){ if(now-tfSeen[k]>120000)delete tfSeen[k] }
  var K={'member-join':['成员上线','g'],'consent-request':['连接请求','a'],'interject':['插话','b'],'task':['任务','']};
  var kk=K[d.kind]||[d.kind||'通知',''];
  var wrap=document.getElementById('tfNotifWrap');
  var el=document.createElement('div'); el.className='tfnotif';
  el.innerHTML='<div style="display:flex;align-items:center;gap:8px"><span class="pill '+kk[1]+'">'+kk[0]+'</span><span class="spacer"></span><span class="mono" style="font-size:10.5px;color:var(--caption)">'+new Date(d.ts||now).toLocaleTimeString()+'</span><span data-tfx style="cursor:pointer;color:var(--caption);padding:0 2px">✕</span></div>'
    +'<div class="tx">'+esc(d.text||'')+'</div>'
    +(d.kind==='consent-request'?'<div style="margin-top:8px;text-align:right"><button class="btn sm" data-tfgo>去处理</button></div>':'');
  el.querySelector('[data-tfx]').onclick=function(){ el.remove() };
  var go=el.querySelector('[data-tfgo]'); if(go)go.onclick=function(){ el.remove(); pg('remote'); toast('已切到远程页——在成员列表处理连接请求') };
  wrap.appendChild(el);
  while(wrap.children.length>4)wrap.removeChild(wrap.firstChild);
  setTimeout(function(){ if(el.parentNode)el.remove() },7000);
}

/* ═══ 成员会话对话流（P0：member-stream SSE 重放+实时 · 插话 · followup-ack） ═══ */
var SF={ member:null, es:null, n:0, stick:true, ended:false, pending:null, lastGate:0 }
function sfListEl(){ return document.getElementById('sfList') }
function sfAtBottom(){ var el=sfListEl(); return el.scrollHeight-el.scrollTop-el.clientHeight<48 }
function sfSetState(txt,cls){ var s=document.getElementById('sfState'); s.className='pill '+(cls||''); s.textContent=txt }
function sfScroll(){ var el=sfListEl();
  if(SF.stick){ el.scrollTop=el.scrollHeight; document.getElementById('sfJump').style.display='none'; }
  else if(SF.n){ document.getElementById('sfJump').style.display='inline-flex'; } }
function sfOpen(name){
  if(SF.es){ SF.es.close(); SF.es=null }
  SF.member=name; SF.n=0; SF.stick=true; SF.ended=false; SF.pending=null; SF.lastGate=0;
  document.getElementById('sfEnd').classList.remove('on');
  document.getElementById('sfJump').style.display='none';
  var mp=document.getElementById('sfMemberPill'); mp.style.display=''; mp.textContent=name;
  sfListEl().innerHTML='<div class="ph" id="sfPh">正在订阅 '+esc(name)+' 的会话对话流（先重放缓冲，后实时）…</div>';
  document.getElementById('sfCnt').textContent='0 条';
  sfSetState('连接中…','a');
  var es=new EventSource('/dsh-termfleet/member-stream?m='+encodeURIComponent(name)+'&token='+encodeURIComponent(TOK));
  SF.es=es;
  es.onopen=function(){ if(SF.es!==es)return; sfListEl().innerHTML=''; SF.n=0; SF.stick=true;
    sfSetState('订阅中','g'); document.getElementById('sfCnt').textContent='0 条'; sfGate(true); };
  es.addEventListener('sess',function(ev){ if(SF.es!==es)return; var d=null; try{ d=JSON.parse(ev.data) }catch(e){ return }
    if(d===null){ sfGone(); return }
    if(d&&d.__tf==='ack'){ sfAck(d); return }
    var e=d&&d.ev?d.ev:d; sfPush(e); });
  // 插话回执：member-stream event:'ack'（服务端实现）；兼容 event:'followup-ack'（契约别名）
  es.addEventListener('ack',function(ev){ if(SF.es!==es)return; var d=null; try{ d=JSON.parse(ev.data) }catch(e){ return } sfAck(d); });
  es.addEventListener('followup-ack',function(ev){ if(SF.es!==es)return; var d=null; try{ d=JSON.parse(ev.data) }catch(e){ return } sfAck(d); });
  es.addEventListener('end',function(ev){ if(SF.es!==es)return; var d=null; try{ d=JSON.parse(ev.data) }catch(e){}
    SF.ended=true; document.getElementById('sfEnd').classList.add('on');
    var why=(d&&d.reason)==='member-offline'?'成员离线，流结束':'会话同意已结束/过期，镜像停止';
    sfSetState('已结束','a');
    document.getElementById('sfEnd').textContent='▪ 已结束——'+why+'。重新请求会话镜像并获同意后可再订阅。';
    document.getElementById('sfWhy').textContent='通道已结束——插话关闭。';
    if(SF.pending){ var pa=SF.pending.querySelector('.ack'); if(pa){ pa.className='ack pill r sfack'; pa.textContent='✗ 未送达（流已结束）'; } SF.pending=null; }
    try{ es.close() }catch(e){} if(SF.es===es)SF.es=null; });
  es.onerror=function(){ if(SF.es!==es)return;
    if(es.readyState===2){ sfSetState('无法订阅','r');
      if(!SF.n){ sfListEl().innerHTML='<div class="ph">订阅被拒（403）——TA 尚无激活的会话同意，或服务端通道未部署；同意开放后重新点选成员即可。</div>';
        var b=document.createElement('button'); b.className='btn sm'; b.style.marginTop='10px'; b.textContent='请求会话镜像';
        b.onclick=function(){ document.getElementById('sfReqSess').click(); };
        var ph=sfListEl().querySelector('.ph'); ph.appendChild(document.createElement('br')); ph.appendChild(b); }
      sfGate(true); }
    else sfSetState('重连中…','a'); };
  sfGate(true);
}
function sfPush(e){
  var ph=document.getElementById('sfPh'); if(ph)ph.remove();
  var el=sfListEl(); var ty=(e&&e.type)||'status';
  var tstr=(e&&e.ts)?new Date(e.ts).toLocaleTimeString():'';
  var row=document.createElement('div');
  if(ty==='user'){ row.className='sfmsg sf-user'; row.innerHTML='<div class="who">成员输入 · '+tstr+'</div>'+esc((e&&e.text)||''); }
  else if(ty==='assistant'){ row.className='sfmsg sf-assistant'; row.innerHTML='<div class="who">助手 · '+tstr+'</div>'+esc((e&&e.text)||''); }
  else if(ty==='tool'){
    row.className='sfmsg sf-tool'; var full=(e&&e.text)||''; var first=full.split('\\n')[0].slice(0,90);
    row.innerHTML='<div class="head"><span>🔧 工具 · '+tstr+' · '+esc(first)+(full.length>first.length?' …':'')+'</span><span class="ar">▸</span></div><div class="body">'+esc(full)+'</div>';
    row.onclick=function(){ row.classList.toggle('open'); var a=row.querySelector('.ar'); if(a)a.textContent=row.classList.contains('open')?'▾':'▸'; };
  }
  else { row.className='sfmsg sf-status'; row.textContent=(tstr?tstr+' · ':'')+(e&&e.text||'状态同步'); }
  el.appendChild(row); SF.n++;
  while(el.children.length>320)el.removeChild(el.firstChild);
  document.getElementById('sfCnt').textContent=SF.n+' 条';
  sfScroll();
}
sfListEl().onscroll=function(){ SF.stick=sfAtBottom();
  document.getElementById('sfJump').style.display=(SF.stick||!SF.n)?'none':'inline-flex'; };
document.getElementById('sfJump').onclick=function(){ SF.stick=true; sfScroll(); };
function sfGate(force){
  var now=Date.now(); if(!force&&now-SF.lastGate<4000)return; SF.lastGate=now;
  var inp=document.getElementById('sfInput'), btn=document.getElementById('sfSend');
  var rq=document.getElementById('sfReqSess');
  rq.style.display=(SF.member&&!SF.ended)?'':'none';
  var setok=function(on,hint){ inp.disabled=!on; btn.disabled=!on; if(on)rq.style.display='none';
    inp.placeholder=on?('向 '+(SF.member||'成员')+' 的 dsh 会话插话（Enter 发送）…'):'插话不可用';
    document.getElementById('sfWhy').textContent=hint; };
  if(!SF.member){ setok(false,'未选择成员——点上方成员设备，订阅其会话流后可插话（需 rw 会话通道）。'); return }
  if(SF.ended){ setok(false,'通道已结束——插话关闭。重新请求会话镜像并获同意后恢复。'); return }
  api('/dsh-termfleet/consent/list').then(function(d){
    if(SF.ended)return;
    var c=(d.consents||[]).filter(function(x){return x.type==='sess'&&x.status==='active'&&x.target==='member:'+SF.member})[0];
    if(!c){ setok(false,'未建立会话镜像通道（type=sess）——点「请求会话镜像」，TA 同意后对话流与插话同时开放。'); return }
    if(c.mode!=='rw'){ setok(false,'只读（ro）会话通道——插话需 rw；服务端对 ro 插话返回 403 readonly-channel。'); return }
    setok(true,'rw 会话通道 · 剩 '+fmtRemain(c.expireAt-Date.now())+' · 插话注入 TA 的活动 dsh 会话，回执经 followup-ack 显示。');
  }).catch(function(){ setok(false,'通道状态查询失败——稍后自动重试。') });
}
document.getElementById('sfReqSess').onclick=function(){
  if(!SF.member)return;
  api('/dsh-termfleet/consent/request',{type:'sess',target:'member:'+SF.member}).then(function(d){
    if(d&&d.ok) toast('已请求会话镜像——等 TA 在成员页同意（30 分钟限时）');
    else toast('请求失败：'+((d&&d.error)||'未知'));
  }).catch(function(e){ toast('请求失败：'+e); });
};
function sfSend(){
  var i=document.getElementById('sfInput'); var v=i.value.trim(); if(!v||!SF.member)return;
  var btn=document.getElementById('sfSend'); btn.disabled=true;
  api('/dsh-termfleet/interject',{member:SF.member,text:v}).then(function(d){
    btn.disabled=false;
    if(d&&d.ok){ sfLocalEcho(v); document.getElementById('sfWhy').textContent='已发往成员会话——等待回执（followup-ack）…'; }
    else{ var er=(d&&d.error)||'未知原因';
      document.getElementById('sfWhy').textContent='插话被拒：'+er+(er==='readonly-channel'?'（只读通道）':er==='no-consent'?'（无激活同意）':'');
      toast('插话被拒：'+er); sfGate(true); }
  }).catch(function(e){ btn.disabled=false; document.getElementById('sfWhy').textContent='插话发送失败：'+e; });
}
function sfLocalEcho(v){
  var el=sfListEl(); var ph=document.getElementById('sfPh'); if(ph)ph.remove();
  var row=document.createElement('div'); row.className='sfmsg sf-user';
  row.innerHTML='<div class="who">我 · 插话 · '+new Date().toLocaleTimeString()+'</div>'+esc(v)+'<div class="ack pill a sfack">发送中…</div>';
  el.appendChild(row); SF.n++;
  document.getElementById('sfCnt').textContent=SF.n+' 条';
  SF.pending=row; sfScroll();
}
function sfAck(d){
  var ok=!!(d&&d.ok);
  if(SF.pending){ var a=SF.pending.querySelector('.ack');
    if(a){ a.className='ack pill '+(ok?'g':'r')+' sfack'; a.textContent=ok?('✓ 已送达'+(d&&d.via?'（'+d.via+'）':'')):'✗ 未送达'+(d&&d.reason?'（'+d.reason+'）':''); }
    SF.pending=null; }
  document.getElementById('sfWhy').textContent=ok?'最近插话已送达 ✓':'最近插话未送达 ✗——成员侧注入失败或会话已关。';
  if(!ok)toast('插话回执：未送达');
}
function sfGone(){
  sfSetState('成员离线','r');
  document.getElementById('sfWhy').textContent='成员总线连接断开——流已收口；TA 回线后重新点选即可恢复订阅。';
}
document.getElementById('sfSend').innerHTML=ic('Send',13)+' 插话';
document.getElementById('sfSend').onclick=sfSend;
document.getElementById('sfInput').addEventListener('keydown',function(ev){ if(ev.key==='Enter'&&!ev.shiftKey){ ev.preventDefault(); sfSend(); } });

/* ═══ 任务 ═══ */
function load(){ return api('/dsh-termfleet/tasks').then(function(d){ ST.tasks=d.tasks||[]; render(); }).catch(function(){}); }
function act(op, id, patch){ return api('/dsh-termfleet/tasks/action',{op:op,id:id,patch:patch||{}}).then(function(d){
  if(d.ok){ ST.tasks=d.tasks; render(); toast(op==='delete'?'已删除 '+id:'已更新 '+id);
    if(document.getElementById('drawer').classList.contains('on') && window.__t && window.__t.id===id && op!=='delete'){
      var nt=ST.tasks.filter(function(x){return x.id===id})[0]; if(nt) openDrawer(nt.id); }
    if(op==='status' && patch && patch.status==='done'){
      var t=ST.tasks.filter(function(x){return x.id===id})[0]||{};
      setTimeout(function(){ openLessonForm({title:'（蒸馏）'+t.title, state:'implemented', category:'process', project:t.project, sourceTask:id,
        body:'卡点：\\n解法：\\n代价/收益：\\n备选：（另一条路：最强理由+为何放弃）'}); toast('任务完成——建议蒸馏一条笔记（已填 implemented，可跳过）'); },350);
    } } }); }
function visible(){ return ST.tasks.filter(function(t){
  if(ST.q){ var q=ST.q.toLowerCase(); var hay=(t.title+' '+(t.desc||'')+' '+(t.owner||'')).toLowerCase(); if(hay.indexOf(q)<0) return false; }
  return true; }); }
function render(){ renderProjSeg(); renderBoard(); renderList(); }
function renderProjSeg(){
  var projects={}; ST.tasks.forEach(function(t){ projects[t.project||'默认']=1; });
  var seg=document.getElementById('projSeg'); seg.innerHTML='';
  var mk=function(name,label){ var b=document.createElement('button'); b.textContent=label;
    if(ST.proj===undefined)ST.proj='*'; if(ST.proj===name)b.classList.add('on');
    b.onclick=function(){ ST.proj=name; renderProjSeg(); renderBoard(); renderList(); }; seg.appendChild(b); };
  mk('*','全部 '+ST.tasks.length);
  Object.keys(projects).sort().forEach(function(n){ mk(n, n+' '+ST.tasks.filter(function(t){return (t.project||'默认')===n}).length); });
}
function cardMeta(t){
  var own = t.owner ? '<span>'+esc(t.owner)+'</span>' : '<span class="claim" data-claim="'+t.id+'">◻ 认领</span>';
  var cli = t.cli ? '<span class="pill" style="border-style:dashed;padding:0 7px;height:18px">'+esc(t.cli)+'</span>' : '';
  var sl = t._linkedSessions ? '<span class="pill b" style="padding:0 7px;height:18px">↔'+t._linkedSessions+'</span>' : '';
  var sb = t.session ? '<span class="pill g" style="padding:0 7px;height:18px" title="绑定会话 '+esc(t.session.sessionId)+'">⚡会话</span>' : '';
  return '<span class="prio '+t.prio+'" style="flex:none">'+t.prio+'</span><span class="slot">'+own+'</span>'+cli+sl+sb
    +(t.due?'<div class="m2"><span></span><span>'+esc(t.due)+'</span></div>':'');
}
function renderBoard(){
  var el=document.getElementById('board'); el.innerHTML='';
  STATUSES.forEach(function(st){
    var col=document.createElement('div'); col.className='bcol'; col.setAttribute('data-nb-col',st[0]);
    var items=pinSort(projVisible().filter(function(t){ return boardOf(t.status)===st[0]; }));
    col.innerHTML='<h4>'+stLabel(st[0])+' <span class="cnt">'+items.length+'</span></h4><div class="bitems"></div>';
    var box=col.querySelector('.bitems');
    items.forEach(function(t){
      var c=document.createElement('div'); c.className='bcard'; c.setAttribute('data-prio',t.prio||'P2');
      c.innerHTML='<div class="chead"><div class="t">'+esc(t.title)+'</div><button class="ibtn star'+(isPinned(t.id)?' onstar':'')+'" data-pin="'+t.id+'" title="置顶/取消置顶">★</button><button class="ibtn stq" data-stmenu="'+t.id+'">'+ic('ChevronDown',13)+'</button></div><div class="m">'+cardMeta(t)+'</div>';
      c.onclick=function(ev){ if(ev.target.closest('.claim')||ev.target.closest('.stq')||ev.target.closest('.star'))return; openDrawer(t.id); };
      box.appendChild(c);
    });
    el.appendChild(col);
  });
  el.querySelectorAll('[data-stmenu]').forEach(function(b){ b.onclick=function(ev){ ev.stopPropagation();
    var t=ST.tasks.filter(function(x){return x.id===b.getAttribute('data-stmenu')})[0]; openStatMenu(ev,t); }; });
  if(!projVisible().length) el.innerHTML='<div class="empty" style="grid-column:1/-1">'+(ST.tasks.length?'没有匹配的任务':'还没有任务<br><button class="btn" style="margin-top:12px" onclick="openNewTask()">＋ 新建任务</button>')+'</div>';
}
function renderList(){
  var el=document.getElementById('listRows'); el.innerHTML='';
  var items=pinSort(projVisible());
  items.forEach(function(t){
    var r=document.createElement('div'); r.className='trow'; r.setAttribute('data-id',t.id);
    var badges='';
    if(t.prio&&t.prio!=='P2') badges+=' <span class="prio '+t.prio+'">'+t.prio+'</span>';
    if(t.due) badges+=' <span class="mini">'+esc(t.due)+'</span>';
    if(t.cli) badges+=' <span class="mini">'+esc(t.cli)+'</span>';
    if(t.session) badges+=' <span class="mini sb" title="绑定会话 '+esc(String((t.session||{}).sessionId||''))+'">⚡</span>';
    r.innerHTML='<span class="tt"><span class="dot '+stDot(t.status)+'"></span>'
      +'<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><span class="title">'+esc(t.title)+'</span>'+badges+'</span></span>'
      +'<span class="who">'+(t.owner?esc(t.owner):'<span style="color:var(--caption)">未认领</span>')+'</span>'
      +'<span><span class="pill '+stClass(t.status)+'">'+stLabel(t.status)+'</span></span>'
      +'<span class="rowops"><button class="ibtn star'+(isPinned(t.id)?' onstar':'')+'" data-pin="'+t.id+'" title="置顶/取消置顶">★</button>'
      +'<button class="ibtn stq" data-stmenu="'+t.id+'" title="状态流转 / 认领 / 删除">⋯</button></span>';
    r.onclick=function(ev){ if(ev.target.closest('button'))return; openDrawer(t.id); };
    el.appendChild(r);
  });
  el.querySelectorAll('[data-stmenu]').forEach(function(b){ b.onclick=function(ev){ ev.stopPropagation();
    var t=ST.tasks.filter(function(x){return x.id===b.getAttribute('data-stmenu')})[0]; openStatMenu(ev,t); }; });
  if(!items.length) el.innerHTML='<div class="empty">'+(ST.tasks.length?'没有匹配的任务':'还没有任务<br><button class="btn" style="margin-top:12px" onclick="openNewTask()">＋ 新建任务</button>')+'</div>';
}
function openStatMenu(ev,t){
  ev.stopPropagation();
  var m=document.getElementById('statMenu'); m.innerHTML='';
  STATUSES.forEach(function(st){ var b=document.createElement('button'); if(t.status===st[0])b.style.color='var(--label1)';
    b.innerHTML=(t.status===st[0]?'● ':'')+stLabel(st[0]);
    b.onclick=function(){ m.classList.remove('on'); act('status',t.id,{status:st[0]}); }; m.appendChild(b); });
  var hr=document.createElement('hr'); hr.style.cssText='border:0;border-top:1px solid var(--border);margin:5px 0'; m.appendChild(hr);
  if(!t.owner){ var cb=document.createElement('button'); cb.innerHTML=ic('User',13)+' 认领';
    cb.onclick=function(){ m.classList.remove('on'); act('claim',t.id); }; m.appendChild(cb); }
  var d=document.createElement('button'); d.className='danger'; d.innerHTML=ic('Trash',13)+' 删除';
  d.onclick=function(){ m.classList.remove('on'); if(confirm('删除 '+t.id+'？')) act('delete',t.id); }; m.appendChild(d);
  var r=ev.currentTarget.getBoundingClientRect();
  m.style.left=Math.min(r.left,innerWidth-170)+'px'; m.style.top=(r.bottom+6)+'px'; m.classList.add('on');
}
document.addEventListener('click',function(ev){
  if(!ev.target.closest('#statMenu')) document.getElementById('statMenu').classList.remove('on');
  var cl=ev.target.closest('.claim[data-claim]'); if(cl){ ev.stopPropagation(); act('claim',cl.getAttribute('data-claim')); }
  var pin=ev.target.closest('[data-pin]'); if(pin){ ev.stopPropagation(); togglePin(pin.getAttribute('data-pin')); }
});

/* ═══ 详情·六 tab ═══ */
function dtab(el,id){ if(!el)return; document.querySelectorAll('#dtabs span').forEach(function(x){x.classList.remove('on')}); el.classList.add('on');
  document.querySelectorAll('.dpane').forEach(function(p){p.classList.remove('on')}); document.getElementById(id).classList.add('on'); }
function openDrawer(id){
  var t=ST.tasks.filter(function(x){return x.id===id})[0]; if(!t) return;
  window.__t=t;
  document.getElementById('dId').textContent=t.id;
  document.getElementById('dTitle').textContent=t.title;
  document.getElementById('dStatusPill').innerHTML='<span class="pill '+stClass(t.status)+'">'+stLabel(t.status)+'</span> <span class="prio '+t.prio+'">'+t.prio+'</span>';
  var cb=document.getElementById('dClaimBtn');
  cb.innerHTML=t.owner?ic('User',13)+' '+esc(t.owner):ic('User',13)+' 认领'; cb.disabled=!!t.owner;
  cb.onclick=function(){ act('claim',t.id); };
  var fb=document.getElementById('dFlowBtn'); fb.innerHTML='状态 '+ic('ChevronDown',12);
  fb.onclick=function(ev){ openStatMenu(ev, ST.tasks.filter(function(x){return x.id===t.id})[0]||t); };
  var db=document.getElementById('dDelBtn'); db.innerHTML=ic('Trash',13)+' 删';
  db.onclick=function(){ if(confirm('删除 '+t.id+'？')){ closeDrawer(); act('delete',t.id); } };
  document.getElementById('docOutline').innerHTML=
    '<div class="ol"><div class="ot">文档大纲</div><a>基本信息</a><a>描述（文档正文）</a><a>子任务/验收</a>'
    +'<a class="lnk" data-pane="dp-flow">▸ 全流程轨迹</a><a class="lnk" data-pane="dp-notes">▸ 关联避坑笔记</a>'
    +'<div class="ot">关联物</div><a class="lnk" data-pane="dp-sess">▸ 会话事件</a></div>'
    +'<div class="doc-body"><h1>'+esc(t.title)+'</h1><div class="meta">'+t.id+' · 创建 '+new Date(t.createdAt).toLocaleString()+' · 更新 '+new Date(t.updatedAt).toLocaleString()+'</div>'
    +'<h2>基本信息</h2><p>'+'状态 '+stLabel(t.status)+' · 优先级 '+t.prio+(t.project?' · 项目 '+esc(t.project):'')+(t.due?' · 截止 '+esc(t.due):'')+(t.cli?' · CLI '+esc(t.cli):'')+(t.owner?' · 认领 '+esc(t.owner):' · 未认领')+'</p>'
    +'<h2>描述（文档正文）</h2><p>'+esc(t.desc||'（空）')+'</p>'
    +'<h2>验收条目</h2><p>' + ((t.acceptance||[]).length ? (t.acceptance||[]).map(function(a){
        return '<label style="display:flex;gap:6px;align-items:baseline;padding:2px 0"><input type="checkbox" '+(a.done?'checked':'')+' data-acc="'+t.id+'|'+a.id+'|'+(!a.done)+'"><span>'+(a.done?'✓ ':'')+esc(a.id)+' '+esc(a.text)+'</span></label>'
      }).join('') : '<span style="color:var(--caption)">无验收条目</span>') + '</p>'
    +'<h2>待确认（未清零不得进入实施）</h2><p>' + ((t.pending||[]).length ? (t.pending||[]).map(function(c){
        return '<label style="display:flex;gap:6px;align-items:baseline;padding:2px 0"><input type="checkbox" '+(c.done?'checked':'')+' data-pend="'+t.id+'|'+c.id+'|'+(!c.done)+'"><span>'+(c.done?'✓ ':'')+esc(c.id)+' '+esc(c.text)+'</span></label>'
      }).join('') : '<span style="color:var(--caption)">无待确认</span>') + '</p>'
    +'<h2>两盏灯与打回</h2><p>自检 '+(t.state&&t.state.selfcheck==='pass'?'✓ pass':'○ pending')+' · 独立验收 '+(t.state&&t.state.independentVerify==='pass'?'✓ pass':'○ pending')+' · 打回 '+(t.state&&t.state.returns||0)+'/5 次</p></div>';
  document.getElementById('flowEl').innerHTML=t.history.map(function(h){
    return '<div class="fe"><span class="ft">'+new Date(h.ts).toLocaleTimeString()+'</span><span class="fx"><b>'+esc(h.by)+'</b> '+esc(h.what)+'</span></div>';
  }).join('')||'<div class="note">（无轨迹）</div>';
  renderSessTab(t); // 会话 tab：绑定卡/弱匹配候选（定义见 renderSessionLinks 原位置，函数声明提升）
  loadMem().then(function(){
    var rel=MEM.lessons.filter(function(l){ return l['source-task']===t.id; });
    document.getElementById('taskNotes').innerHTML=rel.length
      ? rel.map(function(l){ var st=NSTATE[l.state]||['?','']; return '<div class="note-card"><h6>'+esc(l.title)+' <span class="pill '+st[1]+'" style="margin-left:auto">'+st[0]+'</span></h6><div class="meta">'+esc(l.id+'.md')+' · '+esc(l.by||'')+' · '+esc((l.date||'').slice(0,10))+'</div><div class="body">'+esc((l.body||'').slice(0,300))+'</div></div>'; }).join('')
      : '<div class="ph">本任务还没有关联避坑——完成时点「蒸馏」或去避坑库新增（关联任务填 '+esc(t.id)+'）</div>';
  });
  document.getElementById('ovl').classList.add('on');
  document.getElementById('drawer').classList.add('on');
  dtab(document.querySelector('#dtabs span'),'dp-doc');
}
function closeDrawer(){ document.getElementById('ovl').classList.remove('on'); document.getElementById('drawer').classList.remove('on'); }
document.getElementById('docOutline').addEventListener('click',function(ev){
  var a=ev.target.closest('a[data-pane]'); if(!a)return;
  var p=a.getAttribute('data-pane');
  var idx=p==='dp-flow'?1:p==='dp-notes'?3:2;
  dtab(document.querySelectorAll('#dtabs span')[idx],p);
});

/* ═══ 避坑库 ═══ */
function loadMem(){ return api('/dsh-termfleet/memory').then(function(d){ MEM.lessons=d.lessons||[]; renderMem(); }).catch(function(){}); }
function memVisible(){ return MEM.lessons.filter(function(l){
  if(MEM.state&&MEM.state!=='*'&&l.state!==MEM.state) return false;
  if(MEM.cat&&MEM.cat!=='*'&&l.category!==MEM.cat) return false;
  if(MEM.q){ var q=MEM.q.toLowerCase(); var hay=((l.title||'')+' '+(l.body||'')+' '+(l.state||'')).toLowerCase(); if(hay.indexOf(q)<0)return false; }
  return true; }); }
function renderMem(){
  document.getElementById('memCnt').textContent=MEM.lessons.length?'('+MEM.lessons.length+')':'';
  // 状态筛选 + 统计（决策看板）
  var ss=document.getElementById('memStateSeg'); ss.innerHTML='';
  var mkS=function(k,label){ var b=document.createElement('button'); b.textContent=label;
    if((MEM.state||'*')===k)b.classList.add('on'); b.onclick=function(){ MEM.state=k; renderMem(); }; ss.appendChild(b); };
  var cnt={}; MEM.lessons.forEach(function(l){ cnt[l.state]=(cnt[l.state]||0)+1 });
  mkS('*','全部 '+MEM.lessons.length);
  Object.keys(NSTATE).forEach(function(s){ mkS(s, NSTATE[s][0]+' '+(cnt[s]||0)); });
  document.getElementById('memStat').textContent='proposed '+((cnt.proposed||0))+' → implemented '+(cnt.implemented||0)+' / rejected '+(cnt.rejected||0);
  // 分类筛选
  var cs=document.getElementById('memCatSeg'); cs.innerHTML='';
  var mkC=function(k,label){ var b=document.createElement('button'); b.textContent=label;
    if((MEM.cat||'*')===k)b.classList.add('on'); b.onclick=function(){ MEM.cat=k; renderMem(); }; cs.appendChild(b); };
  mkC('*','全分类');
  NCATS.forEach(function(c){ mkC(c,c); });
  var grid=document.getElementById('lessonGrid'); grid.innerHTML='';
  var items=memVisible();
  if(!items.length){ grid.innerHTML='<div class="empty" style="grid-column:1/-1">'+(MEM.lessons.length?'没有匹配的笔记':'笔记库还是空的<br><button class="btn" style="margin-top:12px" onclick="openLessonForm()">＋ 新增笔记</button>')+'</div>'; return; }
  items.forEach(function(l){
    var st=NSTATE[l.state]||['?',''];
    var c=document.createElement('div'); c.className='lcard';
    c.innerHTML='<div class="lm" style="margin:0 0 6px"><span class="pill '+st[1]+'">'+st[0]+'</span>'
      +'<span class="pill" style="border-style:dashed;padding:0 7px;height:18px">'+esc(l.category||'process')+'</span>'
      +'<span class="spacer" style="flex:1"></span>'+(NFLOW[l.state]&&NFLOW[l.state].length?'<span class="flowlnk" style="color:var(--caption);font-size:11px;cursor:pointer">流转 ▾</span>':'')+'</div>'
      +'<div class="lt">'+esc(l.title||l.id)+'</div><div class="lb">'+esc((l.body||'').slice(0,160))+'</div>'
      +'<div class="lm"><span class="pill" style="border-style:dashed;padding:0 7px;height:18px">'+esc(l.project||'通用')+'</span>'
      +(l['source-task']?'<span>'+esc(l['source-task'])+'</span>':'')+'<span>'+esc((l.date||'').slice(0,10))+'</span><span>'+esc(l.by||'')+'</span></div>';
    c.onclick=function(ev){ if(ev.target.classList.contains('flowlnk')){ ev.stopPropagation(); openNoteMenu(ev,l); return; } openLesson(l); };
    grid.appendChild(c);
  });
}
function openNoteMenu(ev,l){
  var m=document.getElementById('statMenu'); m.innerHTML='';
  (NFLOW[l.state]||[]).forEach(function(to){ var b=document.createElement('button');
    b.innerHTML='转入 '+NSTATE[to][0]+'（'+to+'）';
    b.onclick=function(){ m.classList.remove('on'); noteFlow(l.id,to); }; m.appendChild(b); });
  var r=ev.currentTarget.getBoundingClientRect();
  m.style.left=Math.min(r.left,innerWidth-190)+'px'; m.style.top=(r.bottom+6)+'px'; m.classList.add('on');
}
function noteFlow(id,to){
  api('/dsh-termfleet/memory/transition',{id:id,to:to}).then(function(d){
    if(d.ok){ toast('已流转 → '+to+'（目录移动·入审计）'); loadMem(); }
    else toast('流转被拒：'+(d.error||'')); });
}
function openLesson(l){
  document.getElementById('dId').textContent=l.id||'';
  document.getElementById('dTitle').textContent=l.title||'';
  document.getElementById('dStatusPill').innerHTML='<span class="pill g">团队记忆</span>';
  document.getElementById('dClaimBtn').style.display='none'; document.getElementById('dFlowBtn').style.display='none'; document.getElementById('dDelBtn').style.display='none';
  document.getElementById('dtabs').style.display='none';
  document.querySelectorAll('.dpane').forEach(function(p){p.classList.remove('on')});
  document.getElementById('dp-doc').classList.add('on');
  var st=NSTATE[l.state]||['?',''];
  document.getElementById('docOutline').innerHTML='<div class="ol"><div class="ot">决策笔记</div><a>正文</a><a>元信息</a><a>流转</a></div>'
    +'<div class="doc-body"><h1>'+esc(l.title||'')+'</h1><div class="meta">'+esc(l.id+'.md')+'</div>'
    +'<h2>状态</h2><p><span class="pill '+st[1]+'">'+st[0]+'</span> <span class="pill" style="border-style:dashed;padding:0 7px">'+esc(l.category||'process')+'</span>'
    +(NFLOW[l.state]&&NFLOW[l.state].length?'　可流转：'+NFLOW[l.state].map(function(t){return NSTATE[t][0]}).join(' / '):'　终态')+'</p>'
    +'<h2>正文</h2><p>'+esc(l.body||'')+'</p><h2>元信息</h2><p>'+esc(l.by||'')+' · '+esc((l.date||'').replace('T',' ').slice(0,19))+(l.project?' · '+esc(l.project):'')+(l['source-task']?' · 关联 '+esc(l['source-task']):'')+'</p>'
    +'<h2>正文</h2><p>'+esc(l.body||'')+'</p><h2>元信息</h2><p>项目 '+esc(l.project||'通用')+(l['source-task']?' · 关联 '+esc(l['source-task']):'')+'</p></div>';
  document.getElementById('ovl').classList.add('on'); document.getElementById('drawer').classList.add('on');
}
function openLessonForm(pre){ pre=pre||{};
  document.getElementById('lTitle').value=pre.title||'';
  document.getElementById('lState').value=pre.state||'proposed';
  document.getElementById('lCat').value=pre.category||'process';
  document.getElementById('lProject').value=pre.project||'';
  document.getElementById('lSource').value=pre.sourceTask||'';
  document.getElementById('lBody').value=pre.body||'';
  document.getElementById('lessonMask').classList.add('on'); document.getElementById('lTitle').focus(); }

/* ═══ 审计 ═══ */
function loadAudit(){
  AUD.who = AUD.who || '*'
  return api('/dsh-termfleet/audit').then(function(d){ AUD.events=d.events||[];
    var sel=document.getElementById('audWho'); if(sel){ var cur=AUD.who; var actors={}; AUD.events.forEach(function(e){actors[e.actor]=1});
      sel.innerHTML='<option value="*">全部操作人</option>'+Object.keys(actors).map(function(a){return '<option'+(a===cur?' selected':'')+'>'+esc(a)+'</option>'}).join(''); }
    renderAudit(); }).catch(function(){}); }
/* R4：操作类型分类（任务=蓝 / 避坑=绿 / 连接·通道=琥珀）+「连接/通道」筛选的宽匹配 */
function audCat(s){ s=s||'';
  if(/任务/.test(s)) return 'task';
  if(/避坑|笔记/.test(s)) return 'mem';
  if(/连接|通道|配对|插话|远端|IM|呼叫|信任/.test(s)) return 'conn';
  return ''; }
function audMatch(e){
  if(AUD.k==='*') return true;
  if(AUD.k==='连接'||AUD.k==='连接/通道') return audCat(e.action)==='conn';
  return (e.action||'').indexOf(AUD.k)>=0; }
function renderAudit(){
  document.getElementById('audCnt').textContent=AUD.events.length+' 条';
  var list=document.getElementById('auditList'); list.innerHTML='';
  var items=AUD.events.filter(audMatch);
  if(AUD.who&&AUD.who!=='*') items=items.filter(function(e){return e.actor===AUD.who});
  if(!items.length){ list.innerHTML='<div class="empty">'+(AUD.events.length?'没有匹配的审计事件<br><button class="btn ghost sm" style="margin-top:12px" onclick="loadAudit()">刷新审计</button>':'暂无审计事件——去任务/远程页做一次操作就会留痕<br><button class="btn ghost sm" style="margin-top:12px" onclick="loadAudit()">刷新审计</button>')+'</div>'; return; }
  var head=document.createElement('div'); head.className='athead';
  head.innerHTML='<span>时间</span><span>操作人</span><span>动作</span><span>对象</span><span>详情</span>';
  list.appendChild(head);
  items.forEach(function(e){
    var r=document.createElement('div'); r.className='arow';
    var det=e.detail||'', tgt=det.indexOf(' ')>0?det.slice(0,det.indexOf(' ')):det
    r.innerHTML='<span class="ats">'+new Date(e.ts).toLocaleTimeString()+'</span>'
      +'<span class="awho">'+esc(e.actor)+'</span>'
      +'<span class="aact acat c-'+audCat(e.action)+'" data-cat="'+esc(e.action)+'">'+esc(e.action)+'</span>'
      +'<span class="atgt">'+esc(tgt)+'</span>'
      +'<span class="adet" title="'+esc(det)+'">'+esc(det.slice(det.indexOf(' ')+1))+'</span>';
    list.appendChild(r);
  });
  list.querySelectorAll('.acat').forEach(function(c){ c.onclick=function(){ AUD.k=c.getAttribute('data-cat'); renderAudit(); }; });
}

/* ═══ M3：diff / 会话关联 / 回放 / 成本 ═══ */
function renderDiff(project) {
  var el = document.getElementById('dpDiffBody')
  if (!el) return
  api('/dsh-termfleet/diff?project=' + encodeURIComponent(project || ''))
    .then(function(d) {
      if (!d.ok) { el.innerHTML = '<div class="ph">加载失败</div>'; return }
      if (!d.repo) { el.innerHTML = '<div class="ph">' + esc(d.diff || '未找到仓库') + '</div>'; return }
      el.innerHTML =
        '<div class="tbar"><span class="pill">' + esc(d.branch || '?') + '</span>'
        + '<span class="pill g">' + esc(d.stat || '无变更') + '</span>'
        + '<span class="spacer"></span><span style="font-size:11px;color:var(--caption)">' + esc(d.repo) + '</span></div>'
        + '<div class="term" style="margin:0;font-size:11px;max-height:400px">' + esc((d.diff || '(无 diff)').slice(0, 8000)) + '</div>'
    }).catch(function() { el.innerHTML = '<div class="ph">网络错误</div>' })
}

// 会话 tab（P1 强关联）：显式绑定卡 → 「实时看」跳远程页共用镜像管道；无绑定时给弱匹配候选一键转正。
// 会话已结束≠解绑（调研定调：官方 agent-team 存 SessionId 引用、ended 冻结不静默改绑）。
function renderSessTab(t) {
  var sessBody=document.getElementById('dpSessBody');
  if(!sessBody) return;
  if(t.session){
    sessBody.innerHTML='<div class="note-card"><h6>绑定会话</h6><div class="meta">'+esc(t.session.member?(t.session.member+'（成员机）'):'本机')+' · <span class="mono">'+esc(String(t.session.sessionId).slice(0,24))+'</span></div>'
      +(t.session.label?'<div class="meta">'+esc(t.session.label)+'</div>':'')
      +'<div class="meta">绑定 '+esc(t.session.boundBy||'?')+' · '+new Date(t.session.boundAt).toLocaleString()+'</div>'
      +'<div style="margin-top:8px;display:flex;gap:8px"><button class="btn sm" id="dpWatch">▶ 实时看该会话</button><button class="btn ghost sm" id="dpUnbind">解绑</button></div></div>'
      +'<div class="note" style="margin-top:8px">会话已结束≠解绑——绑定保留可回看；成员离线时「实时看」会提示，TA 上线并同意后在远程页即可看。</div>';
    document.getElementById('dpWatch').onclick=function(){
      closeDrawer();
      document.getElementById('navRemote').click();
      if(t.session.member){
        selMember=t.session.member;
        var card=document.querySelector('#memberDevs [data-member="'+esc(t.session.member)+'"]');
        if(card){ card.click(); } else { toast('成员 '+t.session.member+' 不在线——TA 上线后点选即可（需 TA 同意会话镜像）'); }
      } else { toast('本机会话——右侧「dsh 会话事件流」即实时视图'); }
    };
    document.getElementById('dpUnbind').onclick=function(){
      api('/dsh-termfleet/tasks/action',{op:'unbind-session',id:t.id}).then(function(d){
        if(d.ok){ toast('已解绑'); load();
          setTimeout(function(){ var t2=(ST.tasks||[]).filter(function(x){return x.id===t.id})[0]; if(t2){ window.__t=t2; renderSessTab(t2); } }, 500); }
      });
    };
  } else {
    sessBody.innerHTML='<div class="note" style="margin-bottom:10px">未显式绑定会话。下方是按项目名弱匹配的候选（本机/成员会话事件里出现项目名时出现）——「转为正式绑定」升级为强关联。</div><div id="dpWeak"><div class="ph">检测中…</div></div>';
    api('/dsh-termfleet/session-links').then(function(d){
      var ls=(d.links||[]).filter(function(l){return l.taskId===t.id});
      var box=document.getElementById('dpWeak'); if(!box) return;
      box.innerHTML=ls.length?ls.map(function(l){
        return '<div class="note-card"><h6><span class="mono">'+esc(String(l.sessionId).slice(0,24))+'</span></h6><div class="meta">'+esc(l.member?(l.member+'（成员机）'):'本机')+' · 最近 '+esc(l.lastEvent)+' · '+l.eventCount+' 条 · '+new Date(l.lastAt).toLocaleTimeString()+'</div><button class="btn sm" data-bind="'+esc(l.sessionId)+'" data-mem="'+esc(l.member||'')+'">转为正式绑定</button></div>';
      }).join(''):'<div class="ph">暂无弱匹配候选——会话事件里出现项目名「'+esc(t.project||'默认')+'」后这里会出现。</div>';
      box.querySelectorAll('[data-bind]').forEach(function(b){
        b.onclick=function(){
          var sid=b.getAttribute('data-bind'), mem=b.getAttribute('data-mem')||'';
          api('/dsh-termfleet/tasks/action',{op:'bind-session',id:t.id,patch:{session:{member:mem,sessionId:sid,label:mem?(mem+' · 弱匹配转正'):'弱匹配转正'}}}).then(function(d){
            if(d.ok){ toast('已绑定 '+sid.slice(0,16)); load();
              setTimeout(function(){ var t2=(ST.tasks||[]).filter(function(x){return x.id===t.id})[0]; if(t2){ window.__t=t2; renderSessTab(t2); } }, 500); }
            else toast('绑定失败：'+((d&&d.error)||'?'));
          });
        };
      });
    }).catch(function(){ var box=document.getElementById('dpWeak'); if(box) box.innerHTML='<div class="ph">检测失败</div>'; });
  }
}

var REP = { ptyRaw: [], audit: [], filter: 'all', step: 0 }
function openReplay() {
  api('/dsh-termfleet/replay').then(function(d) {
    if (!d.ok) return
    REP.ptyRaw = ansiClean(d.ptyHistory || '').split(NL).filter(Boolean)
    REP.audit = (d.auditTrail || []).slice().reverse()
    REP.filter = 'all'; REP.step = 0
    renderReplay()
    document.getElementById('replayMask').classList.add('on')
  })
}
function renderReplay(uptoTs) {
  var rows = REP.audit.filter(function(e){ return REP.filter==='all' || (e.action||'').indexOf(REP.filter)>=0 })
  var list = document.getElementById('replayAudit'); list.innerHTML = ''
  rows.forEach(function(e) {
    var r = document.createElement('div'); r.className = 'arow'; r.style.cursor = 'pointer'
    r.innerHTML = '<span class="ats">'+new Date(e.ts).toLocaleTimeString()+'</span>'
      + '<span class="awho">'+esc(e.actor)+'</span>'
      + '<span class="aact">'+esc(e.action)+'</span>'
      + '<span class="adet" style="grid-column:span 2">'+esc((e.detail||'').slice(0,44))+'</span>'
    r.onclick = function() { renderPtyUpto(e.ts) }
    list.appendChild(r)
  })
  if (!rows.length) list.innerHTML = '<div class="note">（无匹配事件）</div>'
  renderPtyUpto(uptoTs)
}
function renderPtyUpto(uptoTs) {
  var lines = REP.ptyRaw
  var el = document.getElementById('replayPty')
  el.textContent = (lines.join(NL)).slice(-3000) || '（无 PTY 历史——先在远程页建立一次通道）'
  el.scrollTop = el.scrollHeight
}
document.addEventListener('click', function(ev){
  var f = ev.target.closest('#repFilter button')
  if (f) { f.parentNode.querySelectorAll('button').forEach(function(b){b.classList.remove('on')}); f.classList.add('on'); REP.filter = f.getAttribute('data-f'); renderReplay() }
  var s = ev.target.closest('#repStep')
  if (s) { REP.step = Math.min((REP.step||0)+5, REP.ptyRaw.length); document.getElementById('replayPty').textContent = REP.ptyRaw.slice(0, REP.step).join(NL) || '（无）' }
})

function loadCost() {
  api('/dsh-termfleet/cost').then(function(d) {
    if (!d.ok) return
    var el = document.getElementById('costSummary')
    if (!el) return
    var ts = d.taskStats || {}
    // R1：左栏底部一行小字（紧凑）；操作人明细在设置弹层的「今日成本」组
    el.innerHTML = '<b>' + (ts.done || 0) + '</b> 完成 · <b>' + (ts.doing || 0) + '</b> 进行 · <b>' + (ts.todo || 0) + '</b> 待办'
    var el2 = document.getElementById('costDetail')
    if (el2) {
      var actors = Object.entries(d.byActor || {}).map(function(a) {
        return esc(a[0]) + ' ' + a[1].operations + 'op/' + a[1].durationMin + 'min'
      }).join(' · ') || '暂无'
      el2.innerHTML = '<b>' + (ts.done || 0) + '</b> 完成 / <b>' + (ts.doing || 0) + '</b> 进行 / <b>' + (ts.todo || 0) + '</b> 待办'
        + ' · ' + (d.sessionCount || 0) + ' 会话事件 · ' + actors
    }
  })
}

// dtab 切换时按需加载
var _origDtab = dtab
dtab = function(el, id) {
  _origDtab(el, id)
  if (id === 'dp-diff' && window.__t) renderDiff(window.__t.project)
  if (id === 'dp-sess' && window.__t) renderSessTab(window.__t)
}

/* ═══ 表单与绑定 ═══ */
document.getElementById('newBtn').innerHTML=ic('Plus',14)+' 新建任务';
function openNewTask(){
  ['fTitle','fProject','fDue','fCli','fDesc'].forEach(function(id){document.getElementById(id).value='';});
  document.getElementById('fPrio').value='P2';
  document.getElementById('fSessOn').checked=true;
  simRender([]); // 查重 v1：开表单不留上次的相似提示
  document.getElementById('formMask').classList.add('on'); document.getElementById('fTitle').focus();
  // 绑定会话预填：本机最近活动的 dsh 会话 id（probe-session 全局环形缓冲最后一条）
  api('/dsh-termfleet/probe-session').then(function(d){
    var sid=((d.sessionEvents||[]).slice(-1)[0]||{}).sessionId||'';
    window.__tfSelfSess=sid;
    document.getElementById('fSessHint').textContent=sid?('：'+sid.slice(0,20)+(sid.length>20?'…':'')+(FLEET.role==='member'?'（'+FLEET.name+'）':'')):'（本机暂无会话活动，不绑定）';
    if(!sid) document.getElementById('fSessOn').checked=false;
  }).catch(function(){ window.__tfSelfSess=''; document.getElementById('fSessHint').textContent='（检测失败，不绑定）'; document.getElementById('fSessOn').checked=false; });
}
document.getElementById('newBtn').onclick=openNewTask;
document.getElementById('formSubmit').onclick=function(){
  var title=document.getElementById('fTitle').value.trim();
  if(!title){ toast('标题必填'); return; }
  var body={title:title,project:document.getElementById('fProject').value.trim(),
    prio:document.getElementById('fPrio').value,due:document.getElementById('fDue').value.trim(),
    cli:document.getElementById('fCli').value.trim(),desc:document.getElementById('fDesc').value};
  if(document.getElementById('fSessOn').checked&&window.__tfSelfSess){
    body.session={member:(FLEET.role==='member'?FLEET.name:''),sessionId:window.__tfSelfSess,
      label:(FLEET.role==='member'?FLEET.name+' · ':'本机 · ')+window.__tfSelfSess.slice(0,16)}; }
  api('/dsh-termfleet/tasks/create',body)
    .then(function(d){ if(d.ok){ document.getElementById('formMask').classList.remove('on'); simRender([]);
      var nsim=(d.similar||[]).length; // 查重 v1 契约 C/D：create 响应带 similar 数组；查重是提示不是门禁——创建不拦截，N>0 才在 toast 追加
      toast('已创建 '+d.task.id+(d.task.session?'（已绑定会话）':'')+(nsim>0?'，发现 '+nsim+' 个相似任务':'')); load(); } }); };
/* ═══ 查重 v1（契约 D 面板侧）：标题输入 debounce 600ms → POST /tasks/similar → fSim 提示区 ═══ */
// 相似度由服务端计算（归一化后字符 bigram 集合 + Jaccard，阈值 env TERMFLEET_DEDUP_THRESHOLD 默认 0.55，
// 候选=状态不在 wontfix/archived 的任务）；面板只消费 {ok, similar:[{id,title,status,score}]}。
// 引擎选择：服务端本地 bigram（hippo 向量化后可升级为向量检索——届时仅换服务端实现，本面板契约不变）。
var SIM={ tm:null, seq:0 }
function simRender(list){
  var el=document.getElementById('fSim'); if(!el)return;
  if(!list||!list.length){ el.style.display='none'; el.innerHTML=''; return; } // 无相似→清空并隐藏
  el.innerHTML='<div class="ft">发现 '+list.length+' 个相似任务（请确认是否重复；不拦截创建）：</div>'
    +list.map(function(s){ return '<div class="fr"><span class="sid">'+esc(s.id)+'</span><span class="stt">'+esc(s.title)+'</span><span class="pill b spct">'+Math.round((Number(s.score)||0)*100)+'%</span></div>'; }).join('');
  el.style.display='block';
}
document.getElementById('fTitle').addEventListener('input',function(){
  clearTimeout(SIM.tm); SIM.seq++;
  var v=this.value.trim();
  if(v.length<4){ simRender([]); return; } // 标题≥4 字符才发查询
  var q=SIM.seq, desc=document.getElementById('fDesc').value;
  SIM.tm=setTimeout(function(){
    api('/dsh-termfleet/tasks/similar',{title:v,desc:desc})
      .then(function(d){ if(q!==SIM.seq)return; simRender((d&&d.ok&&d.similar)||[]); }) // 过期响应丢弃（防抖竞态）
      .catch(function(){ if(q!==SIM.seq)return; simRender([]); });
  },600);
});
document.getElementById('newLessonBtn').innerHTML=ic('Plus',14)+' 新增笔记';
document.getElementById('memVerifyBtn').innerHTML=ic('Check',14)+' 校验';
document.getElementById('memVerifyBtn').onclick=function(){
  api('/dsh-termfleet/memory/verify').then(function(d){
    toast('校验门：'+d.total+' 篇，'+(d.failed?d.failed+' 篇不合格（'+d.errors.map(function(e){return e.id.split('/').pop().slice(11)+'…'}).join('；')+'）':'全部合格 ✓'));
  }); };
document.getElementById('newLessonBtn').onclick=function(){ openLessonForm(); };
document.getElementById('lessonSubmit').onclick=function(){
  var title=document.getElementById('lTitle').value.trim();
  if(!title){ toast('标题必填'); return; }
  api('/dsh-termfleet/memory/create',{title:title,state:document.getElementById('lState').value,category:document.getElementById('lCat').value,
    project:document.getElementById('lProject').value.trim(),
    sourceTask:document.getElementById('lSource').value.trim(),body:document.getElementById('lBody').value})
    .then(function(d){ if(d.ok){ document.getElementById('lessonMask').classList.remove('on'); toast('已落库 '+d.id); loadMem(); } }); };
document.getElementById('memSearch').oninput=function(){ MEM.q=this.value.trim(); renderMem(); };
document.getElementById('searchInput').oninput=function(){ ST.q=this.value.trim(); renderBoard(); renderList(); };
var meI=document.getElementById('meInput'); meI.value=ME;
meI.onchange=function(){ ME=this.value.trim()||'me'; localStorage.setItem('tf_user',ME); toast('身份：'+ME); };
var tb=document.getElementById('themeBtn');
function setTheme(light){ if(light){document.body.setAttribute('data-light','');localStorage.setItem('tf_theme','light');tb.innerHTML=ic('Light',14)+' 亮';}
  else{document.body.removeAttribute('data-light');localStorage.setItem('tf_theme','dark');tb.innerHTML=ic('Dark',14)+' 暗';} }
tb.onclick=function(){ setTheme(!document.body.hasAttribute('data-light')); };
setTheme(localStorage.getItem('tf_theme')==='light');
document.getElementById('pairSave').onclick=function(){
  var body={};
  var r=document.getElementById('pairSel').value; if(r)body.role=r;
  var n=document.getElementById('pairName2').value.trim(); if(n)body.name=n;
  var u=document.getElementById('pairUrl').value.trim(); if(u)body.leadUrl=u;
  var t=document.getElementById('pairTok').value.trim(); if(t)body.token=t;
  body.trust=document.getElementById('trustTgl').checked; // 信任开关总是随保存提交（取消勾选=关闭信任）
  if(!Object.keys(body).length){ toast('未填任何项'); return; }
  api('/dsh-termfleet/pairing',body).then(function(d){ if(d.ok){ toast('配对已保存：'+d.pairing.role+(d.pairing.name?' · '+d.pairing.name:'')+'（member 5s 内连上）'); pollFleet(); } });
};
/* 邀请码（lead 侧取码/复制）与一句话入队（member 侧粘贴即配对） */
// 非 127.0.0.1/localhost/::1 打开面板时，浏览器地址本身就是成员可达地址（含经 lan-forwarder：
// WS Upgrade 同样透传）——显式传 ?u=，避免服务端回落到 Host 头（常被改写为 127.0.0.1，跨机不可达）。
function tfAdvertise(loc){
  try{ var h=String(loc.hostname||'');
    if(h.charAt(0)==='[')h=h.slice(1); if(h.charAt(h.length-1)===']')h=h.slice(0,-1);
    if(!h||h==='127.0.0.1'||h==='localhost'||h==='::1') return '';
    return (loc.protocol==='https:'?'wss://':'ws://')+loc.host+'/dsh-termfleet/bus'; }catch(e){ return '' }
}
document.getElementById('pairCodeBtn').onclick=function(){
  var adv=tfAdvertise(location);
  api('/dsh-termfleet/pairing/code'+(adv?('?u='+encodeURIComponent(adv)):'')).then(function(d){
    if(d&&d.code){ document.getElementById('pairCode').value=d.code;
      document.getElementById('pairNote').textContent='邀请码已生成——发给成员，粘贴点「入队」即配对（码含 lead 地址+团队令牌，请勿外传）。'; toast('邀请码已生成'); }
    else toast('取码失败：'+((d&&d.error)||'未知'));
  }).catch(function(e){ toast('取码失败：'+e); });
};
document.getElementById('pairCodeCopy').onclick=function(){
  var inp=document.getElementById('pairCode'); var v=inp.value;
  if(!v){ toast('先点「取码」生成邀请码'); return; }
  var done=function(){ toast('邀请码已复制——发给成员即可入队'); };
  if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(v).then(done,function(){ inp.select(); document.execCommand('copy'); done(); }); }
  else{ inp.select(); document.execCommand('copy'); done(); }
};
document.getElementById('joinBtn').onclick=function(){
  var code=document.getElementById('joinCode').value.trim();
  if(!code){ toast('先粘贴邀请码（TF1-…）'); return; }
  var st=document.getElementById('pairNote');
  st.textContent='入队中…';
  api('/dsh-termfleet/pairing/join',{code:code}).then(function(d){
    if(d&&d.ok){ st.innerHTML='已加入 <b>'+esc(d.lead||d.leadName||'lead')+'</b>——正在连接，5s 内上线。';
      toast('已加入 '+(d.lead||d.leadName||'lead')); document.getElementById('joinCode').value=''; pollFleet(); }
    else st.textContent='入队失败：'+((d&&d.error)||'原因未知（码无效/已过期/lead 不可达）');
  }).catch(function(e){ st.textContent='入队失败：'+e; });
};
var imWeb=document.getElementById('imWebhook'), imTg=document.getElementById('imToggle');
function loadIm(){ api('/dsh-termfleet/im').then(function(d){ imWeb.value=(d.im&&d.im.webhook)||''; imTg.textContent=(d.im&&d.im.enabled)?'已启用 · 关闭':'已停用 · 启用'; }); }
loadIm();
/* R1 设置弹层 + 右栏 context 入口 */
function openSettings(){ document.getElementById('settingsMask').classList.add('on'); loadIm(); loadCost(); }
function closeSettings(){ document.getElementById('settingsMask').classList.remove('on'); }
document.getElementById('settingsBtn').onclick=openSettings;
document.getElementById('devLocal').onclick=function(){ setView('local'); };
document.getElementById('reqLocalBtn').onclick=requestChannel;
document.getElementById('ctaLocal').onclick=function(){ setView('local'); requestChannel(); };
document.getElementById('ctaMember').onclick=function(){
  if(!FLEET.members.length){ toast('左侧暂无成员在线——先在「⚙ 设置」配对成员'); openSettings(); return; }
  toast('在左侧点选成员设备，即可订阅 TA 的会话对话流');
  var box=document.getElementById('memberDevs'); box.style.transition='box-shadow .3s'; box.style.boxShadow='0 0 0 2px var(--accent-t)';
  setTimeout(function(){ box.style.boxShadow='none'; },1200);
};
document.getElementById('imSave').onclick=function(){ api('/dsh-termfleet/im',{webhook:imWeb.value.trim()}).then(function(d){ toast(d.ok?'IM webhook 已保存':'保存失败'); }); };
imTg.onclick=function(){ api('/dsh-termfleet/im',{enabled:true}).then(function(){ loadIm(); toast('IM 已启用'); }); };
document.getElementById('imTest').onclick=function(){ api('/dsh-termfleet/im',{test:true}).then(function(d){ toast(d.test&&d.test.sent?'测试消息已发出 ✓':'发送失败: '+JSON.stringify(d.test||{})); }); };
document.getElementById('sosBtn').innerHTML=ic('Warning',13)+' 呼叫 lead 协助';
document.getElementById('sosBtn').onclick=function(){
  var msg=prompt('简要说明卡在哪（可空）：','') ;
  api('/dsh-termfleet/sos',{msg:msg||''}).then(function(d){ toast(d.ok?'已呼叫 lead（IM 已同步推送）':'发送失败'); });
};
document.getElementById('audReplay').innerHTML=ic('Play',14)+' 回放';
document.getElementById('audReplay').onclick=openReplay;
loadCost();
document.getElementById('audRefresh').innerHTML=ic('Refresh',14)+' 刷新'; document.getElementById('audRefresh').onclick=loadAudit;
document.querySelectorAll('#audSeg button').forEach(function(b){ b.onclick=function(){
  document.querySelectorAll('#audSeg button').forEach(function(x){x.classList.remove('on')}); b.classList.add('on');
  AUD.k=b.getAttribute('data-k'); renderAudit(); }; });

/* ═══ 启动 ═══ */
api('/dsh-termfleet/consent/list').then(function(d){ var c=(d.consents||[]).find(function(x){return (x.type==='pty'||x.type==='sess')&&(x.status==='pending'||x.status==='active')}); if(c){ CH=c; CH._mine=!c.remote; } renderChannel(); }).catch(function(){renderChannel()});
// 键盘快捷键：Esc=关弹窗/抽屉, 1-4=切导航, /=聚焦搜索
document.addEventListener('keydown', function(ev) {
  if (ev.key === 'Escape') {
    ['replayMask','formMask','lessonMask','consentMask','recentMask','settingsMask'].forEach(function(id) { document.getElementById(id).classList.remove('on') });
    closeDrawer();
    document.getElementById('statMenu').classList.remove('on');
  }
  if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA' || ev.target.tagName === 'SELECT') return;
  if (ev.key === '1') pg('remote');
  if (ev.key === '2') pg('task');
  if (ev.key === '3') pg('mem');
  if (ev.key === '4') pg('audit');
  if (ev.key === '/') { ev.preventDefault(); var si = document.getElementById('searchInput'); if (si) { si.focus(); si.select(); } }
});
load(); loadMem(); startEvents();
</script>
</body>
</html>
`

writeFileSync(path.join(here, '../lib/app.html'), html)
console.log('lib/app.html generated,', html.length, 'bytes, icons:', Object.keys(ICONS).length)
