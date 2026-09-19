// 生成 lib/app.html：真任务面板单文件页（官方图标内联）。
// 再生方式：node scripts/gen-app-html.mjs（图标来源 docs/design-assets/icons-official.json）
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
<title>TermFleet · 任务板</title>
<style>
:root{--n50:#f9fafb;--n60:#f5f6f7;--n100:#ebeef2;--n300:#cfd3d6;--n400:#adb2b8;--n600:#81858c;--n700:#61666b;--n800:#353638;--n900:#1b1b1c;--n950:#151517;--n1000:#0f1115}
body{--bg:var(--n950);--card:var(--n900);--card2:var(--n800);--label1:var(--n50);--label2:var(--n300);--label3:var(--n400);--caption:var(--n600);--brand:var(--n50);--brand-fg:var(--n1000);--border:rgba(255,255,255,.06);--border2:rgba(255,255,255,.12);--hover:rgba(255,255,255,.24);--green:#4ed17e;--green-t:rgba(34,197,94,.14);--amber:#f59e0b;--amber-t:rgba(245,158,11,.14);--red:#f25a5a;--red-t:rgba(239,68,68,.14);--blue:#7fa7e8;--blue-t:rgba(59,130,246,.10);background:var(--bg);color:var(--label1)}
body[data-light]{--bg:#fff;--card:var(--n60);--card2:#fff;--label1:var(--n1000);--label2:var(--n700);--label3:var(--n600);--caption:var(--n400);--brand:var(--n1000);--brand-fg:#fff;--border:rgba(0,0,0,.04);--border2:rgba(0,0,0,.1);--hover:rgba(38,49,72,.14);--green:#15803d;--green-t:rgba(34,197,94,.12);--amber:#b45309;--amber-t:rgba(245,158,11,.12);--red:#dc2626;--red-t:rgba(239,68,68,.10);--blue:#2563eb;--blue-t:rgba(59,130,246,.10)}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB',sans-serif;font-size:14px;line-height:1.55}
.wrap{max-width:1320px;margin:0 auto;padding:0 20px 60px}
.topbar{display:flex;align-items:center;gap:10px;padding:14px 0 14px;flex-wrap:wrap}
.logo{display:flex;align-items:center;gap:8px;font-weight:700;font-size:16px}
.logo .mark{width:22px;height:22px;border-radius:7px;background:var(--brand);color:var(--brand-fg);display:grid;place-items:center;font-size:10.5px;font-weight:800}
.pill{display:inline-flex;align-items:center;justify-content:center;gap:5px;border-radius:999px;height:22px;padding:0 10px;box-sizing:border-box;font-size:11.5px;font-weight:600;color:var(--label2);border:1px solid var(--border2);white-space:nowrap}
.pill.g{color:var(--green);background:var(--green-t);border-color:transparent}
.pill.a{color:var(--amber);background:var(--amber-t);border-color:transparent}
.pill.r{color:var(--red);background:var(--red-t);border-color:transparent}
.pill.b{color:var(--blue);background:var(--blue-t);border-color:transparent}
button{font-family:inherit;cursor:pointer;transition:opacity .1s}
button:active{opacity:.75}
.btn{border-radius:18px;border:0;background:var(--brand);color:var(--brand-fg);padding:0 16px;height:34px;font-size:13.5px;font-weight:600;display:inline-flex;align-items:center;gap:6px}
.btn.ghost{background:transparent;color:var(--label1);border:1px solid var(--border2);font-weight:500}
.btn.danger{background:transparent;color:var(--red);border:1px solid var(--red)}
.btn.sm{height:30px;padding:0 13px;font-size:12.5px;border-radius:15px;box-sizing:border-box}
.spacer{flex:1}
.me{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--caption)}
.me input{background:var(--card2);border:1px solid var(--border2);border-radius:15px;color:var(--label1);padding:0 10px;font-size:12.5px;width:86px;height:30px;outline:none;box-sizing:border-box}
svg.ic{display:inline-block;vertical-align:-3px}
.tbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.seg{display:flex;background:var(--card2);border:1px solid var(--border);border-radius:999px;padding:2px;flex-wrap:wrap}
.seg button{border:0;background:transparent;color:var(--label2);padding:4px 12px;border-radius:999px;font-size:12.5px}
.seg button.on{background:var(--brand);color:var(--brand-fg);font-weight:600}
.search{display:flex;align-items:center;gap:6px;background:var(--card2);border:1px solid var(--border);border-radius:999px;padding:0 12px;height:32px;box-sizing:border-box;color:var(--caption);font-size:12.5px}
.search input{border:0;background:transparent;color:var(--label1);outline:none;font-size:12.5px;width:130px}
.board{display:grid;grid-template-columns:repeat(5,minmax(196px,1fr));gap:10px;overflow-x:auto;padding-bottom:4px}
.bcol h4{font-size:12.5px;color:var(--caption);font-weight:600;margin-bottom:8px;display:flex;align-items:center;gap:6px}
.bcol h4 .cnt{font-size:11px;background:var(--card2);border-radius:6px;padding:0 7px}
.bcard{background:var(--card);border:1px solid var(--border);border-radius:11px;padding:11px 12px;margin-bottom:9px;cursor:pointer}
.bcard:hover{border-color:var(--border2)}
.bcard .t{font-size:13px;color:var(--label1);font-weight:500;margin-bottom:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
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
.panel{background:var(--card);border:1px solid var(--border);border-radius:14px;overflow:hidden}
.empty{padding:60px 20px;text-align:center;color:var(--caption);font-size:13px}
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
.drawer{position:fixed;top:0;right:0;bottom:0;width:min(430px,94vw);background:var(--bg);border-left:1px solid var(--border2);z-index:150;display:none;flex-direction:column}
.drawer.on{display:flex}
.dhead{display:flex;align-items:center;gap:9px;padding:14px 18px;border-bottom:1px solid var(--border)}
.dbody{flex:1;overflow-y:auto;padding:16px 18px}
.kv{display:grid;grid-template-columns:76px 1fr;gap:6px 12px;font-size:13px;margin-bottom:16px}
.kv b{color:var(--caption);font-weight:600}
.hline{font-size:12.5px;color:var(--label2);padding:6px 0;border-bottom:1px dashed var(--border)}
.hline .ts{font-family:'SF Mono',Consolas,monospace;color:var(--caption);margin-right:8px}
.note{font-size:12px;color:var(--caption)}
.pgnav{display:flex;gap:2px;margin-bottom:12px}
.pgnav span{padding:7px 16px;border-radius:999px;font-size:13.5px;color:var(--label3);cursor:pointer;font-weight:500}
.pgnav span.on{background:var(--brand);color:var(--brand-fg);font-weight:600}
.view{display:none}.view.on{display:block}
.lesson-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
.lcard{background:var(--card);border:1px solid var(--border);border-radius:11px;padding:13px 14px;cursor:pointer}
.lcard:hover{border-color:var(--border2)}
.lcard .lt{font-size:13.5px;font-weight:600;color:var(--label1);margin-bottom:6px}
.lcard .lb{font-size:12.5px;color:var(--label3);line-height:1.6;max-height:60px;overflow:hidden}
.lcard .lm{display:flex;gap:8px;font-size:11px;color:var(--caption);margin-top:8px;white-space:nowrap}
.dtabs{display:flex;gap:2px;padding:0 16px;border-bottom:1px solid var(--border);overflow-x:auto}
.dtabs span{padding:10px 12px;font-size:13px;color:var(--label3);cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap}
.dtabs span.on{color:var(--label1);font-weight:600;border-bottom-color:var(--label1)}
.dpane{display:none;padding:16px 18px 26px}
.dpane.on{display:block}
.flow{position:relative;padding-left:18px}
.flow::before{content:'';position:absolute;left:5px;top:6px;bottom:6px;width:2px;background:var(--border2)}
.fe{position:relative;padding:0 0 12px}
.fe::before{content:'';position:absolute;left:-17.5px;top:5px;width:9px;height:9px;border-radius:50%;background:var(--brand);border:2px solid var(--bg)}
.fe .ft{font-family:'SF Mono',Consolas,monospace;font-size:11.5px;color:var(--caption);margin-right:8px}
.fe .fx{font-size:13px;color:var(--label2)}
.doc-outline{display:grid;grid-template-columns:170px 1fr;gap:18px;align-items:start}
.doc-outline .ol{font-size:12.5px;position:sticky;top:0}
.doc-outline .ol a{display:block;color:var(--label3);padding:2px 8px 2px 14px;border-left:2px solid var(--border);cursor:pointer}
.doc-outline .ol a:hover{color:var(--label1)}
.doc-outline .ol a.lnk{color:var(--blue)}
.doc-body{max-width:640px;font-size:13.5px;color:var(--label2)}
.doc-body h2{font-size:15px;color:var(--label1);margin:18px 0 8px;padding-bottom:5px;border-bottom:1px solid var(--border);font-weight:700}
.doc-body p{margin:6px 0;white-space:pre-wrap}
.audline{display:flex;gap:10px;font-size:12.5px;padding:8px 2px;border-bottom:1px dashed var(--border);color:var(--label2)}
.audline .ts{font-family:'SF Mono',Consolas,monospace;color:var(--caption);flex:none}
.remgrid{display:grid;grid-template-columns:280px 1fr;gap:16px;align-items:start}
.devcard{display:flex;gap:10px;padding:12px 14px;border-top:1px solid var(--border);align-items:center}
.devcard .av{width:34px;height:34px;border-radius:10px;background:var(--card2);display:grid;place-items:center;font-weight:700;font-size:13px;border:1px solid var(--border);flex:none}
.ph{padding:40px 20px;text-align:center;color:var(--caption);font-size:13px;border:1px dashed var(--border2);border-radius:12px}
.authbar{background:var(--red-t);color:var(--red);border:1px solid var(--red);border-radius:12px;padding:10px 14px;font-size:13px;margin-bottom:12px;display:none}
.authbar.on{display:block}
</style>
</head>
<body>
<div class="wrap">
  <div class="authbar" id="authbar">⚠ 401：需要令牌。用带 <b>?token=…</b> 的地址打开本页（令牌在 <b>~/.dsh/termfleet/token.json</b>），或先启动宿主看 boot 日志。</div>
  <div class="topbar">
    <div class="logo"><span class="mark">TF</span>TermFleet · 任务板</div>
    <span class="pill">项目共享 · 任何人可建/认领/更新</span>
    <span class="pill" id="countPill">0 项</span>
    <span class="spacer"></span>
    <span class="me">我是 <input id="meInput" title="显示名（写入操作历史）"></span>
    <button class="btn ghost sm" id="themeBtn"></button>
    <button class="btn sm" id="newBtn"></button>
  </div>
  <div class="pgnav">
    <span class="on" id="navTask" onclick="pgView('task')">任务板</span>
    <span id="navMem" onclick="pgView('mem')">避坑库 <span id="memCnt" style="font-size:11px;opacity:.7"></span></span>
    <span id="navRemote" onclick="pgView('remote')">远程</span>
    <span id="navAudit" onclick="pgView('audit')">审计</span>
  </div>
  <div class="view on" id="viewTask">
  <div class="tbar">
    <div class="seg" id="projSeg"></div>
    <div class="search" id="searchBox"><input id="searchInput" placeholder="搜索标题/描述/人…"></div>
    <span class="spacer"></span>
    <div class="seg"><button id="vBoard" class="on">看板</button><button id="vList">列表</button></div>
  </div>
  <div class="boardwrap" id="boardWrap"><div class="board" id="board"></div></div>
  <div class="listwrap" id="listWrap">
    <div class="panel">
      <div class="thead"><span>编号</span><span>优先级</span><span>状态</span><span>任务</span><span>认领人</span><span>截止</span><span>CLI</span><span style="text-align:right">操作</span></div>
      <div id="listRows"></div>
    </div>
  </div>
  </div><!-- /viewTask -->
  <div class="view" id="viewMem">
    <div class="tbar">
      <div class="seg" id="memProjSeg"></div>
      <div class="search"><input id="memSearch" placeholder="搜索教训/项目…"></div>
      <span class="spacer"></span>
      <button class="btn sm" id="newLessonBtn"></button>
    </div>
    <div class="lesson-grid" id="lessonGrid"></div>
  </div>
  <div class="view" id="viewRemote">
    <div class="remgrid">
      <div class="panel">
        <h5 style="font-size:12px;font-weight:600;color:var(--caption);padding:12px 14px 8px">设备 · 成员</h5>
        <div class="devcard"><span style="width:8px;height:8px;border-radius:50%;background:var(--green);flex:none"></span><div class="av">我</div><div><div style="font-weight:600;font-size:13.5px">本机 <span class="pill g" style="margin-left:4px">在线</span></div><div style="font-size:11.5px;color:var(--caption);font-family:'SF Mono',Consolas,monospace">127.0.0.1 · 探针就绪</div><div style="font-size:12px;color:var(--label3)">dsh 宿主内 · PTY 可起</div></div></div>
        <div class="devcard" style="opacity:.5"><span style="width:8px;height:8px;border-radius:50%;background:var(--n600);flex:none"></span><div class="av">?</div><div><div style="font-weight:600;font-size:13.5px">团队成员设备</div><div style="font-size:12px;color:var(--label3)">M1 总线（配对+握手卡）接入后点亮</div></div></div>
      </div>
      <div>
        <div class="panel" style="padding:16px 18px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
            <b style="font-size:14.5px">本机 pwsh 会话（真实探针）</b>
            <span class="pill">M0 已验：宿主内 spawn PTY</span>
            <span class="spacer"></span>
            <button class="btn sm" id="ptyStartBtn"></button>
            <button class="btn ghost sm" id="ptyWriteBtn" disabled></button>
          </div>
          <div class="term" id="ptyTerm" style="margin:0;min-height:120px">（点「启动会话」——真起一个 pwsh，回显走宿主内 PTY 流）</div>
          <div class="note" style="margin-top:10px">远程成员设备/同意握手卡/IM 审批/倒计时 → M1 总线落地后在此页点亮（原型交互已定稿 docs/mockups/m1-mockups.html）。</div>
        </div>
        <div class="ph" style="margin-top:14px">握手卡与 IM 审批卡（成员侧视图）——总线接入后在此呈现，交互形态见原型 v7</div>
      </div>
    </div>
  </div>
  <div class="view" id="viewAudit">
    <div class="panel" style="padding:14px 16px 18px">
      <div class="tbar">
        <div class="seg" id="audSeg">
          <button class="on" data-k="*">全部</button><button data-k="任务">任务</button><button data-k="避坑">避坑</button>
        </div>
        <span class="spacer"></span>
        <span class="pill" id="audCnt"></span>
        <button class="btn ghost sm" id="audRefresh"></button>
      </div>
      <div id="auditList"></div>
    </div>
  </div>
</div>

<div class="mask" id="lessonMask"><div class="modal">
  <h4>新增避坑（团队记忆）</h4>
  <label>标题 *</label><input id="lTitle" placeholder="一句话教训，如：部署前必须跑双机验收">
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <div><label>项目</label><input id="lProject" placeholder="如 pay / 通用"></div>
    <div><label>关联任务（可空）</label><input id="lSource" placeholder="如 T-001"></div>
  </div>
  <label>正文（卡点 / 解法 / 代价）</label><textarea id="lBody" rows="5"></textarea>
  <div class="acts"><button class="btn ghost" onclick="document.getElementById('lessonMask').classList.remove('on')">取消</button><button class="btn" id="lessonSubmit">落库</button></div>
  <div class="note" style="margin-top:8px">写入 ~/.dsh/termfleet/team-memory/*.md（团队仓工作副本，git 可同步；hippo federation 可指向此目录）。</div>
</div></div>

<div class="mask" id="formMask"><div class="modal">
  <h4 id="formTitle">新建任务</h4>
  <label>标题 *</label><input id="fTitle" placeholder="要做什么">
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
    <div><label>项目</label><input id="fProject" placeholder="如 pay"></div>
    <div><label>优先级</label><select id="fPrio"><option>P2</option><option>P1</option><option>P0</option></select></div>
    <div><label>截止</label><input id="fDue" placeholder="如 周五 / 09-30"></div>
  </div>
  <label>指定 CLI（可空：dsh / kimi / codex / pwsh…）</label><input id="fCli" placeholder="dsh">
  <label>描述</label><textarea id="fDesc" rows="4" placeholder="背景、验收标准…（将来即任务文档的正文）"></textarea>
  <div class="acts"><button class="btn ghost" onclick="closeForm()">取消</button><button class="btn" id="formSubmit"></button></div>
</div></div>

<div class="menu" id="statMenu"></div>

<div class="drawer" id="drawer">
  <div class="dhead"><b id="dId" style="font-family:'SF Mono',Consolas,monospace;font-size:13px;color:var(--caption)"></b>
    <span style="font-weight:600;font-size:14.5px;flex:1" id="dTitle"></span>
    <button class="ibtn" onclick="closeDrawer()"></button></div>
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
    <div class="dpane" id="dp-sess"><div class="ph">会话事件流（seq 级）——M1 接宿主 listener + PTY 通道后点亮<br>已验机制：插件全局 listener 收全量会话事件（M0 seq0-16 实测）</div></div>
    <div class="dpane" id="dp-notes"><div id="taskNotes"></div></div>
    <div class="dpane" id="dp-wf"><div class="ph">dsh workflow run 步骤树——任务接工作流引擎后点亮</div></div>
    <div class="dpane" id="dp-diff"><div class="ph">任务关联 diff（验收管线）——M3 验收→蒸馏管线落地后点亮</div></div>
  </div>
</div>

<div class="toast" id="toastEl"></div>
<script>
var ICONS = ${ICONS_JSON};
function ic(n, size){ size = size || 16; var ds = ICONS[n] || []; var inner = '';
  for (var i=0;i<ds.length;i++) inner += '<path d="'+ds[i]+'" fill="currentColor"/>';
  return '<svg class="ic" width="'+size+'" height="'+size+'" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+inner+'</svg>'; }

var TOK = new URLSearchParams(location.search).get('token') || localStorage.getItem('tf_token') || '';
if (TOK) localStorage.setItem('tf_token', TOK);
var ME = localStorage.getItem('tf_user') || 'me';
var ST = { tasks: [], view: 'board', proj: '*', q: '' };
var STATUSES = [['todo','待办'],['doing','进行中'],['review','待验收'],['done','完成'],['blocked','阻塞']];

function api(path, body){
  return fetch(path, body ? { method:'POST', headers:{ 'content-type':'application/json','authorization':'Bearer '+TOK,'x-tf-user':encodeURIComponent(ME) }, body: JSON.stringify(body) }
                          : { headers:{ 'authorization':'Bearer '+TOK,'x-tf-user':encodeURIComponent(ME) } })
    .then(function(r){ if (r.status===401){ document.getElementById('authbar').classList.add('on'); throw new Error('401'); } return r.json(); });
}
function toast(m){ var t=document.getElementById('toastEl'); t.textContent=m; t.classList.add('on'); clearTimeout(t._tm); t._tm=setTimeout(function(){t.classList.remove('on')},2400); }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function stLabel(s){ for (var i=0;i<STATUSES.length;i++) if (STATUSES[i][0]===s) return STATUSES[i][1]; return s; }

var MEM = { lessons: [], proj: '*', q: '' };
function pgView(v){
  document.getElementById('navTask').classList.toggle('on', v==='task');
  document.getElementById('navMem').classList.toggle('on', v==='mem');
  document.getElementById('navRemote').classList.toggle('on', v==='remote');
  document.getElementById('navAudit').classList.toggle('on', v==='audit');
  document.getElementById('viewTask').classList.toggle('on', v==='task');
  document.getElementById('viewMem').classList.toggle('on', v==='mem');
  document.getElementById('viewRemote').classList.toggle('on', v==='remote');
  document.getElementById('viewAudit').classList.toggle('on', v==='audit');
  if (v==='mem') loadMem();
  if (v==='audit') loadAudit();
}
function loadMem(){ return api('/dsh-termfleet/memory').then(function(d){ MEM.lessons=d.lessons||[]; renderMem(); }).catch(function(){}); }
function memVisible(){
  return MEM.lessons.filter(function(l){
    if (MEM.proj!=='*' && (l.project||'通用')!==MEM.proj) return false;
    if (MEM.q){ var q=MEM.q.toLowerCase(); var hay=((l.title||'')+' '+(l.body||'')+' '+(l.project||'')).toLowerCase(); if (hay.indexOf(q)<0) return false; }
    return true;
  });
}
function renderMem(){
  document.getElementById('memCnt').textContent = MEM.lessons.length ? '('+MEM.lessons.length+')' : '';
  var seg = document.getElementById('memProjSeg'); seg.innerHTML='';
  var projects={}; MEM.lessons.forEach(function(l){ projects[l.project||'通用']=1; });
  var mk=function(name,label){ var b=document.createElement('button'); b.textContent=label; if(MEM.proj===name)b.classList.add('on');
    b.onclick=function(){ MEM.proj=name; renderMem(); }; seg.appendChild(b); };
  mk('*','全部 '+MEM.lessons.length);
  Object.keys(projects).sort().forEach(function(n){ mk(n, n+' '+MEM.lessons.filter(function(l){return (l.project||'通用')===n}).length); });
  var grid=document.getElementById('lessonGrid'); grid.innerHTML='';
  var items=memVisible();
  if(!items.length){ grid.innerHTML='<div class="empty" style="grid-column:1/-1">'+(MEM.lessons.length?'没有匹配的教训':'避坑库还是空的——任务完成时点「蒸馏」，或右上角手动新增')+'</div>'; return; }
  items.forEach(function(l){
    var c=document.createElement('div'); c.className='lcard';
    c.innerHTML='<div class="lt">'+esc(l.title||l.id)+'</div><div class="lb">'+esc((l.body||'').slice(0,160))+'</div>'
      +'<div class="lm"><span class="pill" style="border-style:dashed;padding:0 7px">'+esc(l.project||'通用')+'</span>'
      +(l['source-task']?'<span>'+esc(l['source-task'])+'</span>':'')+'<span>'+esc((l.date||'').slice(0,10))+'</span><span>'+esc(l.by||'')+'</span></div>';
    c.onclick=function(){ openLesson(l); };
    grid.appendChild(c);
  });
}
function openLesson(l){
  document.getElementById('dId').textContent=l.id||'';
  document.getElementById('dTitle').textContent=l.title||'';
  document.getElementById('dKv').innerHTML =
    '<b>项目</b><span>'+esc(l.project||'通用')+'</span>'
    +'<b>记录人</b><span>'+esc(l.by||'—')+'</span>'
    +'<b>日期</b><span>'+esc((l.date||'').replace('T',' ').slice(0,19))+'</span>'
    +'<b>关联任务</b><span>'+esc(l['source-task']||'—')+'</span>';
  document.getElementById('dHist').innerHTML='<div style="font-size:13px;color:var(--label2);white-space:pre-wrap">'+esc(l.body||'')+'</div>';
  document.getElementById('drawer').classList.add('on');
}
function openLessonForm(prefill){
  prefill=prefill||{};
  document.getElementById('lTitle').value=prefill.title||'';
  document.getElementById('lProject').value=prefill.project||'';
  document.getElementById('lSource').value=prefill.sourceTask||'';
  document.getElementById('lBody').value=prefill.body||'';
  document.getElementById('lessonMask').classList.add('on');
  document.getElementById('lTitle').focus();
}
function load(){ return api('/dsh-termfleet/tasks').then(function(d){ ST.tasks = d.tasks||[]; render(); }).catch(function(){}); }
function act(op, id, patch){ return api('/dsh-termfleet/tasks/action',{op:op,id:id,patch:patch||{}}).then(function(d){
  if(d.ok){ ST.tasks=d.tasks; render(); toast(op==='delete'?'已删除 '+id:'已更新 '+id);
    if(op==='status' && patch && patch.status==='done'){
      var t=ST.tasks.filter(function(x){return x.id===id})[0]||{};
      setTimeout(function(){ openLessonForm({title:'（蒸馏）'+t.title, project:t.project, sourceTask:id,
        body:'卡点：\\n解法：\\n代价/收益：'}); toast('任务完成——建议蒸馏一条避坑（可跳过）'); }, 350);
    }
  } }); }

function visible(){
  return ST.tasks.filter(function(t){
    if (ST.proj!=='*' && (t.project||'默认')!==ST.proj) return false;
    if (ST.q){ var q=ST.q.toLowerCase(); var hay=(t.title+' '+(t.desc||'')+' '+(t.owner||'')).toLowerCase(); if (hay.indexOf(q)<0) return false; }
    return true;
  });
}
function render(){ renderProjSeg(); renderBoard(); renderList(); document.getElementById('countPill').textContent = ST.tasks.length+' 项'; }
function renderProjSeg(){
  var projects = {}; ST.tasks.forEach(function(t){ projects[t.project||'默认']=1; });
  var names = Object.keys(projects).sort();
  var seg = document.getElementById('projSeg'); seg.innerHTML='';
  var mk = function(name,label){ var b=document.createElement('button'); b.textContent=label; if(ST.proj===name)b.classList.add('on');
    b.onclick=function(){ ST.proj=name; render(); }; seg.appendChild(b); };
  mk('*','全部 '+ST.tasks.length);
  names.forEach(function(n){ mk(n, n+' '+ST.tasks.filter(function(t){return (t.project||'默认')===n}).length); });
}
function cardMeta(t){
  var own = t.owner ? '<span>'+esc(t.owner)+'</span>' : '<span class="claim" data-claim="'+t.id+'">◻ 认领</span>';
  var cli = t.cli ? '<span class="pill" style="border-style:dashed;padding:0 7px;flex:none">'+esc(t.cli)+'</span>' : '';
  return '<span class="prio '+t.prio+'" style="flex:none">'+t.prio+'</span><span class="slot">'+own.replace('<span>','<span class="slot">').replace('</span>','</span>')+'</span>'+cli+(t.due?'<div class="m2"><span></span><span>'+esc(t.due)+'</span></div>':'');
}
function renderBoard(){
  var el = document.getElementById('board'); el.innerHTML='';
  STATUSES.forEach(function(st){
    var col = document.createElement('div'); col.className='bcol';
    var items = visible().filter(function(t){ return t.status===st[0]; });
    col.innerHTML = '<h4>'+stLabel(st[0])+' <span class="cnt">'+items.length+'</span></h4>';
    items.forEach(function(t){
      var c = document.createElement('div'); c.className='bcard';
      c.innerHTML = '<div class="t">'+esc(t.title)+'</div><div class="m">'+cardMeta(t)+'</div>';
      c.onclick = function(ev){ if(ev.target.closest('.claim'))return; openStatMenu(ev, t); };
      col.appendChild(c);
    });
    el.appendChild(col);
  });
  var any = visible().length;
  if(!any){ el.innerHTML='<div class="empty" style="grid-column:1/-1">'+(ST.tasks.length?'没有匹配的任务':'还没有任务——点右上「新建任务」建第一张卡')+'</div>'; }
}
function renderList(){
  var el = document.getElementById('listRows'); el.innerHTML='';
  visible().forEach(function(t){
    var r=document.createElement('div'); r.className='trow';
    r.innerHTML = '<span style="font-family:SF Mono,Consolas,monospace;font-size:12px;color:var(--caption)">'+t.id+'</span>'
      +'<span class="prio '+t.prio+'">'+t.prio+'</span>'
      +'<span class="pill '+(t.status==='done'?'g':t.status==='blocked'?'r':t.status==='review'?'a':t.status==='doing'?'b':'')+'" style="cursor:pointer">'+stLabel(t.status)+' '+ic('ChevronDown',12)+'</span>'
      +'<span class="title" data-open="'+t.id+'">'+esc(t.title)+'</span>'
      +'<span class="who">'+(t.owner?esc(t.owner):'<span style="color:var(--caption)">未认领</span>')+'</span>'
      +'<span class="who">'+esc(t.due||'—')+'</span>'
      +'<span class="who">'+esc(t.cli||'—')+'</span>'
      +'<span class="rowops">'+(t.owner?'':'<button class="ibtn" data-claim="'+t.id+'">认领</button>')
      +'<button class="ibtn" data-del="'+t.id+'">'+ic('Trash',13)+' 删</button></span>';
    el.appendChild(r);
  });
  el.querySelectorAll('[data-open]').forEach(function(x){ x.onclick=function(){ openDrawer(x.getAttribute('data-open')); }; });
  el.querySelectorAll('[data-claim]').forEach(function(x){ x.onclick=function(){ act('claim', x.getAttribute('data-claim')); }; });
  el.querySelectorAll('[data-del]').forEach(function(x){ x.onclick=function(){ if(confirm('删除该任务？')) act('delete', x.getAttribute('data-del')); }; });
  el.querySelectorAll('.pill').forEach(function(p){ p.onclick=function(ev){ var id=ev.currentTarget.closest('.trow').querySelector('[data-open]').getAttribute('data-open'); openStatMenu(ev, ST.tasks.filter(function(t){return t.id===id})[0]); }; });
}
function openStatMenu(ev, t){
  ev.stopPropagation();
  var m=document.getElementById('statMenu'); m.innerHTML='';
  STATUSES.forEach(function(st){
    var b=document.createElement('button'); if(t.status===st[0])b.style.color='var(--label1)';
    b.innerHTML=(t.status===st[0]?'● ':'')+stLabel(st[0]);
    b.onclick=function(){ m.classList.remove('on'); act('status', t.id, {status:st[0]}); }; m.appendChild(b);
  });
  var hr=document.createElement('hr'); hr.style.cssText='border:0;border-top:1px solid var(--border);margin:5px 0'; m.appendChild(hr);
  var d=document.createElement('button'); d.className='danger'; d.innerHTML=ic('Trash',13)+' 删除';
  d.onclick=function(){ m.classList.remove('on'); if(confirm('删除 '+t.id+'？')) act('delete', t.id); }; m.appendChild(d);
  var r=ev.currentTarget.getBoundingClientRect();
  m.style.left=Math.min(r.left, innerWidth-170)+'px'; m.style.top=(r.bottom+6)+'px'; m.classList.add('on');
}
document.addEventListener('click', function(ev){
  if(!ev.target.closest('#statMenu')) document.getElementById('statMenu').classList.remove('on');
  var cl = ev.target.closest('.claim[data-claim]');
  if (cl){ ev.stopPropagation(); act('claim', cl.getAttribute('data-claim')); }
});

function dtab(el,id){ if(!el)return; document.querySelectorAll('#dtabs span').forEach(function(x){x.classList.remove('on')}); el.classList.add('on');
  document.querySelectorAll('.dpane').forEach(function(p){p.classList.remove('on')}); document.getElementById(id).classList.add('on'); }
function openDrawer(id){
  var t = ST.tasks.filter(function(x){return x.id===id})[0]; if(!t) return;
  window.__t = t;
  document.getElementById('dId').textContent=t.id;
  document.getElementById('dTitle').textContent=t.title;
  // 文档 tab：大纲 + 正文（desc 即文档正文，后续扩展结构化章节）
  document.getElementById('docOutline').innerHTML =
    '<div class="ol"><a>基本信息</a><a>描述（文档正文）</a><a>子任务/验收</a><a class="lnk" data-pane="dp-flow">▸ 全流程轨迹</a><a class="lnk" data-pane="dp-notes">▸ 关联避坑笔记</a></div>'
    + '<div class="doc-body"><h2>基本信息</h2><p>'
    + '编号 '+esc(t.id)+' · 状态 '+stLabel(t.status)+' · 优先级 '+t.prio
    + (t.project?' · 项目 '+esc(t.project):'') + (t.due?' · 截止 '+esc(t.due):'') + (t.cli?' · CLI '+esc(t.cli):'')
    + (t.owner?' · 认领 '+esc(t.owner):' · 未认领') + '</p>'
    + '<h2>描述（文档正文）</h2><p>'+esc(t.desc||'（空）')+'</p>'
    + '<h2>创建/更新</h2><p>创建 '+new Date(t.createdAt).toLocaleString()+' · 更新 '+new Date(t.updatedAt).toLocaleString()+'</p></div>';
  // 全流程 tab：真实 history 时间线
  var fl = t.history.map(function(h){
    return '<div class="fe"><span class="ft">'+new Date(h.ts).toLocaleTimeString()+'</span><span class="fx"><b>'+esc(h.by)+'</b> '+esc(h.what)+'</span></div>';
  }).join('');
  document.getElementById('flowEl').innerHTML = fl || '<div class="note">（无轨迹）</div>';
  // 决策笔记 tab：避坑库中 source-task == 本任务
  loadMem().then(function(){
    var rel = MEM.lessons.filter(function(l){ return l['source-task']===t.id; });
    document.getElementById('taskNotes').innerHTML = rel.length
      ? rel.map(function(l){ return '<div class="lcard" style="margin-bottom:10px" data-note="'+esc(l.id)+'"><div class="lt">'+esc(l.title)+'</div><div class="lb">'+esc((l.body||'').slice(0,200))+'</div><div class="lm"><span>'+esc(l.date.slice(0,10))+'</span><span>'+esc(l.by||'')+'</span></div></div>'; }).join('')
      : '<div class="ph">本任务还没有关联避坑——完成时点「蒸馏」或去避坑库新增（填关联任务 '+esc(t.id)+'）</div>';
  });
  document.getElementById('drawer').classList.add('on');
  dtab(document.querySelector('#dtabs span'),'dp-doc');
}
function openLessonById(id){
  var l = MEM.lessons.filter(function(x){return x.id===id})[0]; if(!l) return; closeDrawer(); openLesson(l);
}
var AUD = { events: [], k: '*' };
function loadAudit(){ return api('/dsh-termfleet/audit').then(function(d){ AUD.events=d.events||[]; renderAudit(); }).catch(function(){}); }
function renderAudit(){
  document.getElementById('audCnt').textContent = AUD.events.length+' 条';
  var list=document.getElementById('auditList'); list.innerHTML='';
  var items = AUD.events.filter(function(e){ return AUD.k==='*' || (e.action||'').indexOf(AUD.k)>=0; });
  if(!items.length){ list.innerHTML='<div class="empty">还没有审计事件——去任务板/避坑库做点操作</div>'; return; }
  items.forEach(function(e){
    var d=document.createElement('div'); d.className='audline';
    d.innerHTML='<span class="ts">'+new Date(e.ts).toLocaleTimeString()+'</span><span><b>'+esc(e.actor)+'</b> '+esc(e.action)+' · '+esc(e.detail||'')+'</span>';
    list.appendChild(d);
  });
}
function ptyProbe(op){
  var btn=document.getElementById('ptyStartBtn'), wbtn=document.getElementById('ptyWriteBtn');
  if(op==='start'){ btn.disabled=true; btn.textContent='启动中…';
    api('/dsh-termfleet/probe-pty').then(function(d){
      btn.textContent='已启动 pid '+(d.pty&&d.pty.pid); wbtn.disabled=false;
      document.getElementById('ptyTerm').textContent=(d.tail||'').slice(-400)||'（无回显）';
      api('/dsh-termfleet/probe-pty/write',{data:'echo TERMFLEET_PTY_ALIVE\\r'}).then(function(d2){
        document.getElementById('ptyTerm').textContent=(d2.tail||'').slice(-500);
      });
    }); }
  else { api('/dsh-termfleet/probe-pty/write',{data:'echo TERMFLEET_PTY_ALIVE '+new Date().toLocaleTimeString()+'\\r'}).then(function(d2){
      document.getElementById('ptyTerm').textContent=(d2.tail||'').slice(-500); }); }
}
function _oldDrawer(id){
  var t = ST.tasks.filter(function(x){return x.id===id})[0]; if(!t) return;
  document.getElementById('dId').textContent=t.id;
  document.getElementById('dTitle').textContent=t.title;
  var dead=document.getElementById('dKv'); if(dead) dead.innerHTML =
    '<b>状态</b><span class="pill '+(t.status==='done'?'g':t.status==='blocked'?'r':t.status==='review'?'a':t.status==='doing'?'b':'')+'">'+stLabel(t.status)+'</span>'
    +'<b>优先级</b><span class="prio '+t.prio+'">'+t.prio+'</span>'
    +'<b>项目</b><span>'+esc(t.project||'默认')+'</span>'
    +'<b>认领</b><span>'+(t.owner?esc(t.owner):'<span class="claim" data-claim="'+t.id+'">◻ 认领</span>')+'</span>'
    +'<b>截止</b><span>'+esc(t.due||'—')+'</span>'
    +'<b>CLI</b><span>'+esc(t.cli||'—')+'</span>'
    +'<b>创建</b><span>'+new Date(t.createdAt).toLocaleString()+'</span>'
    +'<b>描述</b><span style="white-space:pre-wrap">'+esc(t.desc||'（空）')+'</span>';
  document.getElementById('dHist').innerHTML = t.history.slice().reverse().map(function(h){
    return '<div class="hline"><span class="ts">'+new Date(h.ts).toLocaleTimeString()+'</span><b>'+esc(h.by)+'</b> '+esc(h.what)+'</div>';
  }).join('') || '<div class="note">（无）</div>';
  document.getElementById('drawer').classList.add('on');
}
function closeDrawer(){ document.getElementById('drawer').classList.remove('on'); }

function openForm(){ document.getElementById('formTitle').textContent='新建任务';
  ['fTitle','fProject','fDue','fCli','fDesc'].forEach(function(id){document.getElementById(id).value='';});
  document.getElementById('fPrio').value='P2';
  document.getElementById('formSubmit').textContent='创建';
  document.getElementById('formMask').classList.add('on'); document.getElementById('fTitle').focus(); }
function closeForm(){ document.getElementById('formMask').classList.remove('on'); }
document.getElementById('formSubmit').onclick=function(){
  var title=document.getElementById('fTitle').value.trim();
  if(!title){ toast('标题必填'); return; }
  api('/dsh-termfleet/tasks/create',{ title:title, project:document.getElementById('fProject').value.trim(),
    prio:document.getElementById('fPrio').value, due:document.getElementById('fDue').value.trim(),
    cli:document.getElementById('fCli').value.trim(), desc:document.getElementById('fDesc').value })
    .then(function(d){ if(d.ok){ closeForm(); toast('已创建 '+d.task.id); return load(); } });
};

document.getElementById('newBtn').innerHTML = ic('Plus',14)+' 新建任务';
document.getElementById('newLessonBtn').innerHTML = ic('Plus',14)+' 新增避坑';
document.getElementById('newLessonBtn').onclick=function(){ openLessonForm(); };
document.getElementById('lessonSubmit').onclick=function(){
  var title=document.getElementById('lTitle').value.trim();
  if(!title){ toast('标题必填'); return; }
  api('/dsh-termfleet/memory/create',{ title:title, project:document.getElementById('lProject').value.trim(),
    sourceTask:document.getElementById('lSource').value.trim(), body:document.getElementById('lBody').value })
    .then(function(d){ if(d.ok){ document.getElementById('lessonMask').classList.remove('on'); toast('已落库 '+d.id); loadMem(); } });
};
document.getElementById('memSearch').oninput=function(){ MEM.q=this.value.trim(); renderMem(); };
var psb=document.getElementById('ptyStartBtn'); psb.innerHTML=ic('Play',14)+' 启动会话'; psb.onclick=function(){ ptyProbe('start'); };
var pwb=document.getElementById('ptyWriteBtn'); pwb.innerHTML=ic('Send',14)+' 发指令'; pwb.onclick=function(){ ptyProbe('write'); };
document.getElementById('audRefresh').innerHTML=ic('Refresh',14)+' 刷新'; document.getElementById('audRefresh').onclick=loadAudit;
document.querySelectorAll('#audSeg button').forEach(function(b){ b.onclick=function(){ document.querySelectorAll('#audSeg button').forEach(function(x){x.classList.remove('on')}); b.classList.add('on'); AUD.k=b.getAttribute('data-k'); renderAudit(); }; });
// 大纲锚与任务笔记卡：事件委托（免内联引号）
document.getElementById('docOutline').addEventListener('click', function(ev){
  var a = ev.target.closest('a[data-pane]'); if(!a) return;
  var idx = a.getAttribute('data-pane')==='dp-flow' ? 1 : 3;
  dtab(document.querySelectorAll('#dtabs span')[idx], a.getAttribute('data-pane'));
});
document.getElementById('taskNotes').addEventListener('click', function(ev){
  var c = ev.target.closest('[data-note]'); if(!c) return;
  pgView('mem'); openLessonById(c.getAttribute('data-note'));
});
document.getElementById('newBtn').onclick=openForm;
document.getElementById('vBoard').onclick=function(){ ST.view='board'; this.classList.add('on'); document.getElementById('vList').classList.remove('on');
  document.getElementById('boardWrap').classList.remove('off'); document.getElementById('listWrap').classList.remove('on'); };
document.getElementById('vList').onclick=function(){ ST.view='list'; this.classList.add('on'); document.getElementById('vBoard').classList.remove('on');
  document.getElementById('boardWrap').classList.add('off'); document.getElementById('listWrap').classList.add('on'); };
document.getElementById('searchInput').oninput=function(){ ST.q=this.value.trim(); render(); };
var meI=document.getElementById('meInput'); meI.value=ME;
meI.onchange=function(){ ME=this.value.trim()||'me'; localStorage.setItem('tf_user',ME); toast('身份：'+ME+'（写入后续操作历史）'); };
var tb=document.getElementById('themeBtn');
function setTheme(light){ if(light){document.body.setAttribute('data-light','');localStorage.setItem('tf_theme','light');tb.innerHTML=ic('Light',14)+' 亮';}
  else{document.body.removeAttribute('data-light');localStorage.setItem('tf_theme','dark');tb.innerHTML=ic('Dark',14)+' 暗';} }
tb.onclick=function(){ setTheme(!document.body.hasAttribute('data-light')); };
setTheme(localStorage.getItem('tf_theme')==='light');
document.querySelector('.drawer .ibtn').innerHTML=ic('Close',14);
load();
</script>
</body>
</html>
`

writeFileSync(path.join(here, '../lib/app.html'), html)
console.log('lib/app.html generated,', html.length, 'bytes, icons:', Object.keys(ICONS).length)
