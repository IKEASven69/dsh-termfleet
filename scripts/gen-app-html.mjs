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

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TermFleet · 团队驾驶舱</title>
<style>
:root{--n50:#f9fafb;--n60:#f5f6f7;--n100:#ebeef2;--n150:#e9ecf2;--n300:#cfd3d6;--n400:#adb2b8;--n600:#81858c;--n700:#61666b;--n750:#43454a;--n800:#353638;--n900:#1b1b1c;--n950:#151517;--n1000:#0f1115}
body{--bg:var(--n950);--card:var(--n900);--card2:var(--n800);--label1:var(--n50);--label2:var(--n300);--label3:var(--n400);--caption:var(--n600);--brand:var(--n50);--brand-fg:var(--n1000);--border:rgba(255,255,255,.06);--border2:rgba(255,255,255,.12);--hover:rgba(255,255,255,.24);--green:#4ed17e;--green-t:rgba(34,197,94,.14);--amber:#f59e0b;--amber-t:rgba(245,158,11,.14);--red:#f25a5a;--red-t:rgba(239,68,68,.14);--blue:#7fa7e8;--blue-t:rgba(59,130,246,.10);background:var(--bg);color:var(--label1)}
body[data-light]{--bg:#fff;--card:var(--n60);--card2:#fff;--label1:var(--n1000);--label2:var(--n700);--label3:var(--n600);--caption:var(--n400);--brand:var(--n1000);--brand-fg:#fff;--border:rgba(0,0,0,.04);--border2:rgba(0,0,0,.1);--hover:rgba(38,49,72,.14);--green:#15803d;--green-t:rgba(34,197,94,.12);--amber:#b45309;--amber-t:rgba(245,158,11,.12);--red:#dc2626;--red-t:rgba(239,68,68,.10);--blue:#2563eb;--blue-t:rgba(59,130,246,.10)}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB',sans-serif;font-size:14px;line-height:1.55;transition:background .2s,color .2s}
.wrap{max-width:1380px;margin:0 auto;padding:0 20px 46px}
.topbar{display:flex;align-items:center;gap:12px;padding:13px 0 15px;flex-wrap:wrap}
.logo{display:flex;align-items:center;gap:8px;font-weight:700;font-size:16px}
.logo .mark{width:22px;height:22px;border-radius:7px;background:var(--brand);color:var(--brand-fg);display:grid;place-items:center;font-size:10.5px;font-weight:800}
.nav{display:flex;gap:2px;margin-left:6px}
.nav span{padding:7px 16px;border-radius:999px;font-size:13.5px;color:var(--label3);cursor:pointer;font-weight:500}
.nav span.on{background:var(--brand);color:var(--brand-fg);font-weight:600}
.pill{display:inline-flex;align-items:center;justify-content:center;gap:5px;border-radius:999px;height:22px;padding:0 10px;box-sizing:border-box;font-size:11.5px;font-weight:600;color:var(--label2);border:1px solid var(--border2);white-space:nowrap}
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
.panel{background:var(--card);border:1px solid var(--border);border-radius:14px;overflow:hidden}
.panel h5{font-size:12px;font-weight:600;color:var(--caption);padding:12px 14px 8px;letter-spacing:.3px}
.page{display:none}.page.on{display:block}
.note{font-size:12px;color:var(--caption);margin-top:10px}
.mono{font-family:'SF Mono',Consolas,monospace}
svg.ic{display:inline-block;vertical-align:-3px}
.toast{position:fixed;bottom:26px;left:50%;transform:translateX(-50%) translateY(8px);background:var(--brand);color:var(--brand-fg);padding:9px 18px;border-radius:12px;font-size:13px;font-weight:500;z-index:300;opacity:0;transition:all .22s;pointer-events:none;max-width:80vw}
.toast.on{opacity:1;transform:translateX(-50%) translateY(0)}
.mask{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;display:none}
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
/* ── 任务页 ── */
.tbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.seg{display:flex;background:var(--card2);border:1px solid var(--border);border-radius:999px;padding:2px;flex-wrap:wrap}
.seg button{border:0;background:transparent;color:var(--label2);padding:4px 12px;border-radius:999px;font-size:12.5px}
.seg button.on{background:var(--brand);color:var(--brand-fg);font-weight:600}
.search{display:flex;align-items:center;gap:6px;background:var(--card2);border:1px solid var(--border);border-radius:999px;padding:0 12px;height:32px;color:var(--caption);font-size:12.5px;box-sizing:border-box}
.search input{border:0;background:transparent;color:var(--label1);outline:none;font-size:12.5px;width:130px}
.board{display:grid;grid-template-columns:repeat(5,minmax(196px,1fr));gap:10px;overflow-x:auto;padding-bottom:4px}
.bcol h4{font-size:12.5px;color:var(--caption);font-weight:600;margin-bottom:8px;display:flex;align-items:center;gap:6px}
.bcol h4 .cnt{font-size:11px;background:var(--card2);border-radius:6px;padding:0 7px}
.bcard{position:relative;background:var(--card);border:1px solid var(--border);border-radius:11px;padding:11px 12px;margin-bottom:9px;cursor:pointer;transition:transform .1s}
.bcard:hover{border-color:var(--border2);transform:translateY(-1px)}
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
.thead,.trow{display:grid;grid-template-columns:52px 42px 92px minmax(0,1fr) 92px 88px 76px 148px;gap:10px;align-items:center}
.thead{padding:6px 10px;font-size:11.5px;color:var(--caption);font-weight:600}
.trow{padding:9px 10px;border-top:1px solid var(--border);font-size:13px;background:var(--card)}
.trow:hover{background:var(--hover)}
.trow .title{color:var(--label1);font-weight:500;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.trow .who{font-size:12.5px;color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.rowops{display:flex;gap:6px;justify-content:flex-end;flex:none}
.ibtn{height:26px;flex:none;border:1px solid var(--border2);background:transparent;color:var(--label2);border-radius:8px;padding:0 8px;font-size:12px;display:inline-flex;align-items:center;gap:5px}
.ibtn:hover{color:var(--label1);border-color:var(--label3)}
.empty{padding:50px 20px;text-align:center;color:var(--caption);font-size:13px}
/* ── 避坑库 ── */
.lesson-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
.lcard{background:var(--card);border:1px solid var(--border);border-radius:11px;padding:13px 14px;cursor:pointer}
.lcard:hover{border-color:var(--border2)}
.lcard .lt{font-size:13.5px;font-weight:600;color:var(--label1);margin-bottom:6px}
.lcard .lb{font-size:12.5px;color:var(--label3);line-height:1.6;max-height:60px;overflow:hidden}
.lcard .lm{display:flex;gap:8px;font-size:11px;color:var(--caption);margin-top:8px;white-space:nowrap}
/* ── 审计 ── */
.audline{display:flex;gap:10px;font-size:12.5px;padding:8px 2px;border-bottom:1px dashed var(--border);color:var(--label2)}
.audline .ts{font-family:'SF Mono',Consolas,monospace;color:var(--caption);flex:none}
/* ── 任务详情·居中大窗（v7 原型形态） ── */
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99;display:none}
.overlay.on{display:block}
.drawer{position:fixed;top:3vh;left:50%;transform:translateX(-50%);width:min(1180px,94vw);height:92vh;background:var(--bg);border:1px solid var(--border2);border-radius:16px;z-index:100;display:none;flex-direction:column;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.5)}
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
.doc-body h1{font-size:19px;color:var(--label1);margin:2px 0 4px;font-weight:700}
.doc-body .meta{font-size:11.5px;color:var(--caption);font-family:'SF Mono',Consolas,monospace;margin-bottom:14px}
.doc-body h2{font-size:15px;color:var(--label1);margin:20px 0 8px;padding-bottom:5px;border-bottom:1px solid var(--border);font-weight:700}
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
      <span class="on" id="navRemote" onclick="pg('remote')">远程</span>
      <span id="navTask" onclick="pg('task')">任务</span>
      <span id="navMem" onclick="pg('mem')">避坑库 <span id="memCnt" style="font-size:11px;opacity:.7"></span></span>
      <span id="navAudit" onclick="pg('audit')">审计</span>
    </div>
    <span class="spacer"></span>
    <span class="pill" id="chanPill">无通道</span>
    <span class="me">我是 <input id="meInput" title="显示名（写入操作历史/审计）"></span>
    <button class="btn ghost sm" id="themeBtn"></button>
  </div>

  <!-- ═══ 远程 ═══ -->
  <div class="page on" id="pg-remote">
    <div class="rem">
      <div class="panel">
        <h5>设备 · 成员</h5>
        <div class="dev sel" id="devLocal">
          <span class="dot on"></span><div class="av">我</div>
          <div style="min-width:0"><div class="nm">本机 <span class="pill g" style="margin-left:2px">在线</span></div>
          <div class="mach">127.0.0.1 · dsh 宿主内</div><div class="sessn" id="devLocalSub">pwsh 通道未建立</div></div>
        </div>
        <div class="dev" style="opacity:.5">
          <span class="dot off"></span><div class="av">?</div>
          <div><div class="nm">团队成员设备</div><div class="sessn">M1 总线跨机（配对+WS）接入后点亮</div></div>
        </div>
        <h5 style="border-top:1px solid var(--border)">今日成本</h5>
        <div style="padding:0 14px 12px;font-size:12.5px;color:var(--label2)">本机探针会话 · 跨机后按成员聚合</div>
      </div>
      <div>
        <div class="sessbar">
          <div class="sess on"><span class="tag cli">pwsh</span>本机会话</div>
          <div class="sess" style="opacity:.55" title="待总线"><span class="tag dsh">dsh</span>成员会话 · 待总线</div>
          <button class="newcli" onclick="toast('新开 CLI：成员设备通道就绪后开放（本机可用下方会话）')">＋ 新开 CLI</button>
          <span class="spacer"></span>
          <span class="pill">本机 · 127.0.0.1</span>
        </div>
        <div class="rwin">
          <div class="rtoolbar">
            <span id="rtState" class="pill">○ 未连接</span>
            <span style="font-size:12.5px;color:var(--label3)" id="rtMeta">连接本机 pwsh 会话（全程过同意门·留痕）</span>
            <span class="spacer"></span>
            <button class="btn ghost sm" id="rtModeBtn" disabled>切只读</button>
            <button class="btn danger sm" id="rtEndBtn" disabled>断开</button>
          </div>
          <div class="term" id="ptyTerm">（点「请求连接」——同意后此处实时显示宿主内 pwsh 流）</div>
          <div class="cmdline" id="cmdline">
            <input id="cmdInput" placeholder="输入指令回车发送（写入带 actor·留痕）…" onkeydown="if(event.key==='Enter')sendCmd()">
            <button class="btn sm" onclick="sendCmd()">发送</button>
          </div>
          <div class="note" style="margin:0 14px 12px">远程对象=会话本身（宿主内 PTY，M0 实测链路）；无同意通道时服务端一律 403——只读通道禁写也是服务端强制。</div>
        </div>

        <div class="panel" style="padding:14px 16px;margin-top:14px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <b style="font-size:14px">dsh 会话事件流</b>
            <span class="pill b">宿主 listener · 实时</span>
            <span class="spacer"></span>
            <span class="pill" id="evCnt">0 条</span>
          </div>
          <div id="evList" style="min-height:60px"><div class="note">（本宿主的 dsh 会话一有事件就实时出现在这里——可在 3180 的 dsh web 里发条消息试试）</div></div>
        </div>

        <div class="panel" style="padding:16px;margin-top:14px" id="consentPanel">
          <div class="ccard">
            <h4 id="csTitle">⚑ 连接请求</h4>
            <div class="who" id="csWho">尚未发起连接。</div>
            <div class="acts" id="csActs"></div>
            <div class="note">成员侧视角（单机模拟：跨机后此卡来自成员机的 decide）；拒绝无需理由 · 全程留痕。</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ═══ 任务 ═══ -->
  <div class="page" id="pg-task">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <h3 style="font-size:15px">项目任务板</h3>
      <span class="pill">全员共享 · 任何人可建/认领/更新</span>
      <span class="spacer"></span>
      <div class="seg"><button id="vBoard" class="on" onclick="tv(this,'board')">看板</button><button id="vList" onclick="tv(this,'list')">列表</button></div>
      <button class="btn sm" id="newBtn"></button>
    </div>
    <div class="tbar">
      <div class="seg" id="projSeg"></div>
      <div class="search" id="searchBox">🔍<input id="searchInput" placeholder="搜索标题/描述/人…"></div>
      <span class="spacer"></span>
      <button class="btn ghost sm" onclick="toast('按优先级排序（本视图已按序）')">⇅ 按优先级</button>
      <button class="btn ghost sm" onclick="toast('只看与我相关的任务（演示）')">只看我的</button>
    </div>
    <div class="boardwrap" id="boardWrap"><div class="board" id="board"></div></div>
    <div class="listwrap" id="listWrap">
      <div class="panel">
        <div class="thead"><span>编号</span><span>优先级</span><span>状态</span><span>任务</span><span>认领人</span><span>截止</span><span>CLI</span><span style="text-align:right">操作</span></div>
        <div id="listRows"></div>
      </div>
    </div>
  </div>

  <!-- ═══ 避坑库 ═══ -->
  <div class="page" id="pg-mem">
    <div class="tbar">
      <div class="seg" id="memProjSeg"></div>
      <div class="search">🔍<input id="memSearch" placeholder="搜索教训/项目…"></div>
      <span class="spacer"></span>
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
        <span class="spacer"></span>
        <span class="pill" id="audCnt"></span>
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
    <div class="dpane" id="dp-sess"><div id="dpSessBody"></div></div>
    <div class="dpane" id="dp-notes"><div id="taskNotes"></div></div>
    <div class="dpane" id="dp-wf"><div class="ph">dsh workflow run 步骤树——任务接工作流引擎后点亮</div></div>
    <div class="dpane" id="dp-diff"><div class="ph">任务关联 diff（验收→蒸馏管线）——M3 落地后点亮</div></div>
  </div>
</div>

<!-- 同意卡（pending 时弹出） -->
<div class="mask" id="consentMask"><div class="modal">
  <h4>⚑ 连接请求 <span class="pill a" style="margin-left:auto">限时 30 分钟</span></h4>
  <div class="who" id="consentWho"></div>
  <div class="acts">
    <button class="btn" id="csAllow">允许（可操作）</button>
    <button class="btn ghost" id="csRo">仅只读</button>
    <button class="btn danger" id="csDeny">拒绝</button>
  </div>
  <div class="note" style="margin-top:10px">成员侧视角（单机模拟）· 拒绝无需理由 · 同意后随时断开 · 全程留痕。</div>
</div></div>

<!-- 新建任务 -->
<div class="mask" id="formMask"><div class="modal">
  <h4>新建任务</h4>
  <label>标题 *</label><input id="fTitle" placeholder="要做什么">
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
    <div><label>项目</label><input id="fProject" placeholder="如 pay"></div>
    <div><label>优先级</label><select id="fPrio"><option>P2</option><option>P1</option><option>P0</option></select></div>
    <div><label>截止</label><input id="fDue" placeholder="如 周五 / 09-30"></div>
  </div>
  <label>指定 CLI（可空：dsh / kimi / codex / pwsh…）</label><input id="fCli" placeholder="dsh">
  <label>描述（即任务文档正文）</label><textarea id="fDesc" rows="4" placeholder="背景、验收标准…"></textarea>
  <div class="acts"><button class="btn ghost" onclick="document.getElementById('formMask').classList.remove('on')">取消</button><button class="btn" id="formSubmit">创建</button></div>
</div></div>

<!-- 新增避坑 -->
<div class="mask" id="lessonMask"><div class="modal">
  <h4>新增避坑（团队记忆）</h4>
  <label>标题 *</label><input id="lTitle" placeholder="一句话教训，如：部署前必须跑双机验收">
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <div><label>项目</label><input id="lProject" placeholder="如 pay / 通用"></div>
    <div><label>关联任务（可空）</label><input id="lSource" placeholder="如 T-001"></div>
  </div>
  <label>正文（卡点 / 解法 / 代价）</label><textarea id="lBody" rows="5"></textarea>
  <div class="acts"><button class="btn ghost" onclick="document.getElementById('lessonMask').classList.remove('on')">取消</button><button class="btn" id="lessonSubmit">落库</button></div>
  <div class="note" style="margin-top:8px">写入 ~/.dsh/termfleet/team-memory/*.md（团队仓工作副本；hippo federation 可指向此目录）。</div>
</div></div>

<div class="menu" id="statMenu"></div>
<div class="toast" id="toastEl"></div>

<script>
var ICONS = ${ICONS_JSON};
function ic(n, size){ size = size || 16; var ds = ICONS[n] || []; var inner = '';
  for (var i=0;i<ds.length;i++) inner += '<path d="'+ds[i]+'" fill="currentColor"/>';
  return '<svg class="ic" width="'+size+'" height="'+size+'" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+inner+'</svg>'; }

var TOK = new URLSearchParams(location.search).get('token') || localStorage.getItem('tf_token') || '';
if (TOK) localStorage.setItem('tf_token', TOK);
var ME = localStorage.getItem('tf_user') || 'me';
var ST = { tasks: [], q: '' };
var MEM = { lessons: [], proj: '*', q: '' };
var AUD = { events: [], k: '*' };
var CH = null;            // 当前同意通道 {id,status,mode,expireAt,...}
var STATUSES = [['todo','待办'],['doing','进行中'],['review','待验收'],['done','完成'],['blocked','阻塞']];

function api(path, body){
  return fetch(path, body ? { method:'POST', headers:{ 'content-type':'application/json','authorization':'Bearer '+TOK,'x-tf-user':encodeURIComponent(ME) }, body: JSON.stringify(body) }
                          : { headers:{ 'authorization':'Bearer '+TOK,'x-tf-user':encodeURIComponent(ME) } })
    .then(function(r){ if (r.status===401){ document.body.insertAdjacentHTML('afterbegin','<div style="background:var(--red-t);color:var(--red);padding:10px 14px;border-radius:12px;margin-bottom:10px">401：需带 ?token= 打开（~/.dsh/termfleet/token.json）</div>'); throw new Error('401'); } return r.json(); });
}
function toast(m){ var t=document.getElementById('toastEl'); t.textContent=m; t.classList.add('on'); clearTimeout(t._tm); t._tm=setTimeout(function(){t.classList.remove('on')},2400); }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function stLabel(s){ for (var i=0;i<STATUSES.length;i++) if (STATUSES[i][0]===s) return STATUSES[i][1]; return s; }
function stClass(s){ return s==='done'?'g':s==='blocked'?'r':s==='review'?'a':s==='doing'?'b':''; }

/* ═══ 导航 ═══ */
function pg(v){
  ['remote:Remote','task:Task','mem:Mem','audit:Audit'].forEach(function(p){ var k=p.split(':')[0];
    document.getElementById('nav'+p.split(':')[1]).classList.toggle('on', v===k); });
  document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('on'); });
  document.getElementById('pg-'+v).classList.add('on');
  if (v==='mem') loadMem();
  if (v==='audit') loadAudit();
}
function tv(el,v){ el.parentNode.querySelectorAll('button').forEach(function(b){b.classList.remove('on')}); el.classList.add('on');
  document.getElementById('boardWrap').classList.toggle('off', v!=='board');
  document.getElementById('listWrap').classList.toggle('on', v==='list'); }

/* ═══ 同意总线（真） ═══ */
function fmtRemain(ms){ var s=Math.max(0,Math.floor(ms/1000)); return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); }
var tick=null;
function renderChannel(){
  var pill=document.getElementById('chanPill'), st=document.getElementById('rtState'), meta=document.getElementById('rtMeta');
  var mb=document.getElementById('rtModeBtn'), eb=document.getElementById('rtEndBtn'), cl=document.getElementById('cmdline');
  var sub=document.getElementById('devLocalSub');
  clearInterval(tick); tick=null;
  if(!CH || CH.status==='pending'){
    st.className='pill a'; st.textContent='◌ 等待成员确认';
    meta.textContent='成员侧同意卡已弹出（本页下方/弹窗）';
    mb.disabled=true; eb.disabled=false; eb.textContent='取消请求';
    cl.classList.remove('on'); sub.textContent='pwsh 通道：等待确认';
    document.getElementById('csTitle').innerHTML='⚑ 连接请求 <span class="pill a" style="margin-left:auto">待确认</span>';
    document.getElementById('csWho').innerHTML='<b>'+esc(CH?CH.requester:ME)+'</b> 请求连接：<b>本机 pwsh 会话</b>（仅此会话）';
    document.getElementById('csActs').innerHTML='<button class="btn sm" id="csA">允许</button><button class="btn ghost sm" id="csR">仅只读</button><button class="btn danger sm" id="csD">拒绝</button>';
    bindDecide(); document.getElementById('consentMask').classList.add('on');
    pill.className='pill a'; pill.textContent='等确认';
  } else if(CH.status==='active'){
    st.className='pill '+(CH.mode==='rw'?'g':'a'); st.textContent='● 已连接 · '+(CH.mode==='rw'?'可操作':'只读');
    mb.disabled=false; mb.textContent=CH.mode==='rw'?'切只读':'（只读中）'; eb.disabled=false; eb.textContent='断开';
    cl.classList.add('on');
    var i=document.getElementById('cmdInput'); i.disabled=(CH.mode!=='rw'); i.placeholder=CH.mode==='rw'?'输入指令回车发送（写入带 actor·留痕）…':'只读通道——服务端禁写（403）';
    sub.textContent='pwsh 通道：'+CH.mode+' · 剩 '+fmtRemain(CH.expireAt-Date.now());
    tick=setInterval(function(){ if(!CH||CH.status!=='active'){clearInterval(tick);return}
      meta.innerHTML='剩余 <b class="mono" style="color:var(--label1)">'+fmtRemain(CH.expireAt-Date.now())+'</b> · 仅此会话 · 随时可断';
      sub.textContent='pwsh 通道：'+CH.mode+' · 剩 '+fmtRemain(CH.expireAt-Date.now());
      if(CH.expireAt<=Date.now()){ CH.status='expired'; renderChannel(); toast('限时到——通道自动断开（服务端已失效）'); } },1000);
    meta.innerHTML='剩余 <b class="mono" style="color:var(--label1)">'+fmtRemain(CH.expireAt-Date.now())+'</b> · 仅此会话 · 随时可断';
    document.getElementById('consentMask').classList.remove('on');
    pill.className='pill '+(CH.mode==='rw'?'g':'a'); pill.textContent='通道 '+(CH.mode==='rw'?'rw':'ro')+' · '+fmtRemain(CH.expireAt-Date.now());
  } else {
    var why = CH ? ({denied:'已拒绝',ended:'已断开',expired:'已过期'})[CH.status]||CH.status : '未连接';
    st.className='pill'; st.textContent='○ '+why;
    meta.textContent='连接本机 pwsh 会话（全程过同意门·留痕）';
    mb.disabled=true; mb.textContent='切只读'; eb.disabled=true; eb.textContent='断开';
    cl.classList.remove('on'); sub.textContent='pwsh 通道未建立';
    document.getElementById('consentMask').classList.remove('on');
    pill.className='pill'; pill.textContent='无通道';
    document.getElementById('csTitle').textContent='⚑ 连接请求';
    document.getElementById('csWho').innerHTML='尚未发起连接。点下方「请求连接本机 pwsh」——服务端无通道一律 403。';
    document.getElementById('csActs').innerHTML='<button class="btn" id="csReq">'+ic('Play',13)+' 请求连接本机 pwsh</button>';
    document.getElementById('csReq').onclick=requestChannel;
  }
}
function bindDecide(){
  var m=document.getElementById('consentMask');
  var A=document.getElementById('csA'),R=document.getElementById('csR'),D=document.getElementById('csD');
  if(A){A.onclick=function(){decide('allow')}} if(R){R.onclick=function(){decide('readonly')}} if(D){D.onclick=function(){decide('deny')}}
}
function requestChannel(){
  api('/dsh-termfleet/consent/request',{type:'pty',target:'pwsh7·本机'}).then(function(d){
    if(d.ok){ CH=d.consent; renderChannel(); toast('已发起连接请求（入审计）'); }});
}
function decide(dec){
  api('/dsh-termfleet/consent/decide',{id:CH.id,decision:dec}).then(function(d){
    if(d.ok){ CH=d.consent; renderChannel();
      if(dec==='deny'){ toast('已拒绝——无需理由，入审计'); }
      else { toast('通道建立：'+(CH.mode==='rw'?'可操作':'只读')+' · 30 分钟'); startPty(); } }});
}
document.getElementById('rtEndBtn').onclick=function(){
  if(!CH) return;
  api('/dsh-termfleet/consent/end',{id:CH.id}).then(function(d){ if(d.ok){ CH=d.consent||CH; CH.status=CH.status||'ended'; CH={status:'ended'}; renderChannel(); toast('已断开（入审计）'); } });
};
document.getElementById('rtModeBtn').onclick=function(){ toast('模式切换由成员侧决定——当前演示通道模式固定 '+CH.mode); };

/* ═══ PTY 实流 ═══ */
var ptyLines=[], ptyES=null;
function startPty(){
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
  ptyLines.push('[张三·远端] '+v+'\\n'); drawPty();
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
}
function drawEvents(){
  document.getElementById('evCnt').textContent=evSeen+' 条';
  var el=document.getElementById('evList');
  if(!evBuf.length) return;
  el.innerHTML=evBuf.map(function(e){
    return '<div class="evrow"><span class="ts">'+new Date(e.t).toLocaleTimeString()+'</span><span class="ty mono">'+esc(e.type||'')+(e.seq!=null?' #'+e.seq:'')+'</span><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(e.brief||'')+'</span></div>';
  }).join('');
}

/* ═══ 任务 ═══ */
function load(){ return api('/dsh-termfleet/tasks').then(function(d){ ST.tasks=d.tasks||[]; render(); }).catch(function(){}); }
function act(op, id, patch){ return api('/dsh-termfleet/tasks/action',{op:op,id:id,patch:patch||{}}).then(function(d){
  if(d.ok){ ST.tasks=d.tasks; render(); toast(op==='delete'?'已删除 '+id:'已更新 '+id);
    if(document.getElementById('drawer').classList.contains('on') && window.__t && window.__t.id===id && op!=='delete'){
      var nt=ST.tasks.filter(function(x){return x.id===id})[0]; if(nt) openDrawer(nt.id); }
    if(op==='status' && patch && patch.status==='done'){
      var t=ST.tasks.filter(function(x){return x.id===id})[0]||{};
      setTimeout(function(){ openLessonForm({title:'（蒸馏）'+t.title, project:t.project, sourceTask:id,
        body:'卡点：\\n解法：\\n代价/收益：'}); toast('任务完成——建议蒸馏一条避坑（可跳过）'); },350);
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
  return '<span class="prio '+t.prio+'" style="flex:none">'+t.prio+'</span><span class="slot">'+own+'</span>'+cli
    +(t.due?'<div class="m2"><span></span><span>'+esc(t.due)+'</span></div>':'');
}
function renderBoard(){
  var el=document.getElementById('board'); el.innerHTML='';
  STATUSES.forEach(function(st){
    var col=document.createElement('div'); col.className='bcol';
    var items=visible().filter(function(t){ return (ST.proj==='*'||(t.project||'默认')===ST.proj)&&t.status===st[0]; });
    col.innerHTML='<h4>'+stLabel(st[0])+' <span class="cnt">'+items.length+'</span></h4>';
    items.forEach(function(t){
      var c=document.createElement('div'); c.className='bcard';
      c.innerHTML='<div class="chead"><div class="t">'+esc(t.title)+'</div><button class="ibtn stq" data-stmenu="'+t.id+'">'+ic('ChevronDown',13)+'</button></div><div class="m">'+cardMeta(t)+'</div>';
      c.onclick=function(ev){ if(ev.target.closest('.claim')||ev.target.closest('.stq'))return; openDrawer(t.id); };
      col.appendChild(c);
    });
    el.appendChild(col);
  });
  el.querySelectorAll('[data-stmenu]').forEach(function(b){ b.onclick=function(ev){ ev.stopPropagation();
    var t=ST.tasks.filter(function(x){return x.id===b.getAttribute('data-stmenu')})[0]; openStatMenu(ev,t); }; });
  if(!visible().length) el.innerHTML='<div class="empty" style="grid-column:1/-1">'+(ST.tasks.length?'没有匹配的任务':'还没有任务——点右上「新建任务」建第一张卡')+'</div>';
}
function renderList(){
  var el=document.getElementById('listRows'); el.innerHTML='';
  visible().filter(function(t){return ST.proj==='*'||(t.project||'默认')===ST.proj}).forEach(function(t){
    var r=document.createElement('div'); r.className='trow';
    r.innerHTML='<span class="mono" style="font-size:12px;color:var(--caption)">'+t.id+'</span>'
      +'<span class="prio '+t.prio+'">'+t.prio+'</span>'
      +'<span class="pill '+stClass(t.status)+'" style="cursor:pointer" data-st="'+t.id+'">'+stLabel(t.status)+' '+ic('ChevronDown',12)+'</span>'
      +'<span class="title">'+esc(t.title)+'</span>'
      +'<span class="who">'+(t.owner?esc(t.owner):'<span style="color:var(--caption)">未认领</span>')+'</span>'
      +'<span class="who">'+esc(t.due||'—')+'</span>'
      +'<span class="who">'+esc(t.cli||'—')+'</span>'
      +'<span class="rowops">'+(t.owner?'':'<button class="ibtn" data-claim2="'+t.id+'">认领</button>')
      +'<button class="ibtn" data-del="'+t.id+'">'+ic('Trash',13)+'</button></span>';
    el.appendChild(r);
  });
  el.querySelectorAll('.title').forEach(function(x){ x.onclick=function(){ openDrawer(x.textContent==='__'?null:x.getAttribute('data-id')||findIdByTitle(x.textContent)); }; });
  el.querySelectorAll('[data-claim2]').forEach(function(x){ x.onclick=function(){ act('claim',x.getAttribute('data-claim2')); }; });
  el.querySelectorAll('[data-del]').forEach(function(x){ x.onclick=function(){ if(confirm('删除该任务？')) act('delete',x.getAttribute('data-del')); }; });
  el.querySelectorAll('[data-st]').forEach(function(p){ p.onclick=function(ev){ var t=ST.tasks.filter(function(x){return x.id===p.getAttribute('data-st')})[0]; openStatMenu(ev,t); }; });
}
function findIdByTitle(title){ var t=ST.tasks.filter(function(x){return x.title===title})[0]; return t&&t.id; }
function openStatMenu(ev,t){
  ev.stopPropagation();
  var m=document.getElementById('statMenu'); m.innerHTML='';
  STATUSES.forEach(function(st){ var b=document.createElement('button'); if(t.status===st[0])b.style.color='var(--label1)';
    b.innerHTML=(t.status===st[0]?'● ':'')+stLabel(st[0]);
    b.onclick=function(){ m.classList.remove('on'); act('status',t.id,{status:st[0]}); }; m.appendChild(b); });
  var hr=document.createElement('hr'); hr.style.cssText='border:0;border-top:1px solid var(--border);margin:5px 0'; m.appendChild(hr);
  var d=document.createElement('button'); d.className='danger'; d.innerHTML=ic('Trash',13)+' 删除';
  d.onclick=function(){ m.classList.remove('on'); if(confirm('删除 '+t.id+'？')) act('delete',t.id); }; m.appendChild(d);
  var r=ev.currentTarget.getBoundingClientRect();
  m.style.left=Math.min(r.left,innerWidth-170)+'px'; m.style.top=(r.bottom+6)+'px'; m.classList.add('on');
}
document.addEventListener('click',function(ev){
  if(!ev.target.closest('#statMenu')) document.getElementById('statMenu').classList.remove('on');
  var cl=ev.target.closest('.claim[data-claim]'); if(cl){ ev.stopPropagation(); act('claim',cl.getAttribute('data-claim')); }
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
    +'<h2>描述（文档正文）</h2><p>'+esc(t.desc||'（空）')+'</p></div>';
  document.getElementById('flowEl').innerHTML=t.history.map(function(h){
    return '<div class="fe"><span class="ft">'+new Date(h.ts).toLocaleTimeString()+'</span><span class="fx"><b>'+esc(h.by)+'</b> '+esc(h.what)+'</span></div>';
  }).join('')||'<div class="note">（无轨迹）</div>';
  document.getElementById('dpSessBody').innerHTML='<div class="note" style="margin-bottom:10px">任务关联会话的事件流（seq 级）——M1 接任务↔会话绑定后点亮；当前可在「远程」页看宿主实时事件流。</div><div id="dpSessFeed"></div>';
  loadMem().then(function(){
    var rel=MEM.lessons.filter(function(l){ return l['source-task']===t.id; });
    document.getElementById('taskNotes').innerHTML=rel.length
      ? rel.map(function(l){ return '<div class="note-card"><h6>'+esc(l.title)+' <span class="pill '+(l.id.indexOf('reject')>=0?'r':'g')+'" style="margin-left:auto">implemented</span></h6><div class="meta">'+esc(l.id+'.md')+' · '+esc(l.by||'')+' · '+esc((l.date||'').slice(0,10))+'</div><div class="body">'+esc((l.body||'').slice(0,300))+'</div></div>'; }).join('')
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
  if(MEM.proj!=='*'&&(l.project||'通用')!==MEM.proj) return false;
  if(MEM.q){ var q=MEM.q.toLowerCase(); var hay=((l.title||'')+' '+(l.body||'')+' '+(l.project||'')).toLowerCase(); if(hay.indexOf(q)<0)return false; }
  return true; }); }
function renderMem(){
  document.getElementById('memCnt').textContent=MEM.lessons.length?'('+MEM.lessons.length+')':'';
  var seg=document.getElementById('memProjSeg'); seg.innerHTML='';
  var projects={}; MEM.lessons.forEach(function(l){ projects[l.project||'通用']=1; });
  var mk=function(name,label){ var b=document.createElement('button'); b.textContent=label; if(MEM.proj===name)b.classList.add('on');
    b.onclick=function(){ MEM.proj=name; renderMem(); }; seg.appendChild(b); };
  mk('*','全部 '+MEM.lessons.length);
  Object.keys(projects).sort().forEach(function(n){ mk(n,n+' '+MEM.lessons.filter(function(l){return (l.project||'通用')===n}).length); });
  var grid=document.getElementById('lessonGrid'); grid.innerHTML='';
  var items=memVisible();
  if(!items.length){ grid.innerHTML='<div class="empty" style="grid-column:1/-1">'+(MEM.lessons.length?'没有匹配的教训':'避坑库还是空的——任务完成时点「蒸馏」，或右上手动新增')+'</div>'; return; }
  items.forEach(function(l){
    var c=document.createElement('div'); c.className='lcard';
    c.innerHTML='<div class="lt">'+esc(l.title||l.id)+'</div><div class="lb">'+esc((l.body||'').slice(0,160))+'</div>'
      +'<div class="lm"><span class="pill" style="border-style:dashed;padding:0 7px;height:18px">'+esc(l.project||'通用')+'</span>'
      +(l['source-task']?'<span>'+esc(l['source-task'])+'</span>':'')+'<span>'+esc((l.date||'').slice(0,10))+'</span><span>'+esc(l.by||'')+'</span></div>';
    c.onclick=function(){ openLesson(l); };
    grid.appendChild(c);
  });
}
function openLesson(l){
  document.getElementById('dId').textContent=l.id||'';
  document.getElementById('dTitle').textContent=l.title||'';
  document.getElementById('dStatusPill').innerHTML='<span class="pill g">团队记忆</span>';
  document.getElementById('dClaimBtn').style.display='none'; document.getElementById('dFlowBtn').style.display='none'; document.getElementById('dDelBtn').style.display='none';
  document.getElementById('dtabs').style.display='none';
  document.querySelectorAll('.dpane').forEach(function(p){p.classList.remove('on')});
  document.getElementById('dp-doc').classList.add('on');
  document.getElementById('docOutline').innerHTML='<div class="ol"><div class="ot">避坑记录</div><a>正文</a><a>元信息</a></div>'
    +'<div class="doc-body"><h1>'+esc(l.title||'')+'</h1><div class="meta">'+esc(l.id+'.md')+' · '+esc(l.by||'')+' · '+esc((l.date||'').replace('T',' ').slice(0,19))+'</div>'
    +'<h2>正文</h2><p>'+esc(l.body||'')+'</p><h2>元信息</h2><p>项目 '+esc(l.project||'通用')+(l['source-task']?' · 关联 '+esc(l['source-task']):'')+'</p></div>';
  document.getElementById('ovl').classList.add('on'); document.getElementById('drawer').classList.add('on');
}
function openLessonForm(pre){ pre=pre||{};
  document.getElementById('lTitle').value=pre.title||'';
  document.getElementById('lProject').value=pre.project||'';
  document.getElementById('lSource').value=pre.sourceTask||'';
  document.getElementById('lBody').value=pre.body||'';
  document.getElementById('lessonMask').classList.add('on'); document.getElementById('lTitle').focus(); }

/* ═══ 审计 ═══ */
function loadAudit(){ return api('/dsh-termfleet/audit').then(function(d){ AUD.events=d.events||[]; renderAudit(); }).catch(function(){}); }
function renderAudit(){
  document.getElementById('audCnt').textContent=AUD.events.length+' 条';
  var list=document.getElementById('auditList'); list.innerHTML='';
  var items=AUD.events.filter(function(e){ return AUD.k==='*'||(e.action||'').indexOf(AUD.k)>=0; });
  if(!items.length){ list.innerHTML='<div class="empty">还没有审计事件——做点操作（建任务/连接通道）</div>'; return; }
  items.forEach(function(e){ var d=document.createElement('div'); d.className='audline';
    d.innerHTML='<span class="ts">'+new Date(e.ts).toLocaleTimeString()+'</span><span><b>'+esc(e.actor)+'</b> '+esc(e.action)+' · '+esc(e.detail||'')+'</span>';
    list.appendChild(d); });
}

/* ═══ 表单与绑定 ═══ */
document.getElementById('newBtn').innerHTML=ic('Plus',14)+' 新建任务';
document.getElementById('newBtn').onclick=function(){
  ['fTitle','fProject','fDue','fCli','fDesc'].forEach(function(id){document.getElementById(id).value='';});
  document.getElementById('fPrio').value='P2';
  document.getElementById('formMask').classList.add('on'); document.getElementById('fTitle').focus(); };
document.getElementById('formSubmit').onclick=function(){
  var title=document.getElementById('fTitle').value.trim();
  if(!title){ toast('标题必填'); return; }
  api('/dsh-termfleet/tasks/create',{title:title,project:document.getElementById('fProject').value.trim(),
    prio:document.getElementById('fPrio').value,due:document.getElementById('fDue').value.trim(),
    cli:document.getElementById('fCli').value.trim(),desc:document.getElementById('fDesc').value})
    .then(function(d){ if(d.ok){ document.getElementById('formMask').classList.remove('on'); toast('已创建 '+d.task.id); load(); } }); };
document.getElementById('newLessonBtn').innerHTML=ic('Plus',14)+' 新增避坑';
document.getElementById('newLessonBtn').onclick=function(){ openLessonForm(); };
document.getElementById('lessonSubmit').onclick=function(){
  var title=document.getElementById('lTitle').value.trim();
  if(!title){ toast('标题必填'); return; }
  api('/dsh-termfleet/memory/create',{title:title,project:document.getElementById('lProject').value.trim(),
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
document.getElementById('audRefresh').innerHTML=ic('Refresh',14)+' 刷新'; document.getElementById('audRefresh').onclick=loadAudit;
document.querySelectorAll('#audSeg button').forEach(function(b){ b.onclick=function(){
  document.querySelectorAll('#audSeg button').forEach(function(x){x.classList.remove('on')}); b.classList.add('on');
  AUD.k=b.getAttribute('data-k'); renderAudit(); }; });
document.getElementById('rtEndBtn').onclick=function(){
  if(!CH||CH.status!=='pending'&&CH.status!=='active'){ return; }
  api('/dsh-termfleet/consent/end',{id:CH.id}).then(function(){ CH={status:'ended'}; renderChannel(); toast('已断开（入审计）'); }); };

/* ═══ 启动 ═══ */
renderChannel(); load(); loadMem(); startEvents();
</script>
</body>
</html>
`

writeFileSync(path.join(here, '../lib/app.html'), html)
console.log('lib/app.html generated,', html.length, 'bytes, icons:', Object.keys(ICONS).length)
