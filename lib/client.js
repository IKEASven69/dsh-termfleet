/**
 * dsh-termfleet client 半 v2：dsh web 内的 TermFleet 入口。
 * 形态=模块表包装（window.__ModuleLoader__.load，参照 dsh-hippo lib/client.js）；
 * react/react-dom 从客户端模块表 require（由 dsh web 运行时提供）；
 * 肤色用宿主 --dsw-alias-* 变量（亮暗自动跟随）。
 *
 * 槽位（M1+v1 → v2 补齐官方右侧栏）：
 *   - conversation.session.header.utilities（list）：TF 按钮 + 右侧滑出浮层（iframe 嵌 /app）
 *   - sidebar.right.pane.tab（keyed, key="dsh-termfleet"）：官方右侧栏 tab 主体（iframe 嵌 /app）
 *   - sidebar.right.pane.tab.title（keyed, key="dsh-termfleet"）：官方右侧栏 tab chip 标题
 *
 * 注册：ctx.sidebarRightTabs.register({id, kind, priority, title, guide}），
 *       与 dsh-client-ui-sidebar-files 同款形态（effect 包裹，含描述与引导胶囊）。
 *
 * iframe 同源 /dsh-termfleet/app；令牌复用 localStorage.tf_token；展开/关闭由各组件自治。
 * 与 dsh-better-sidebar 共存：better-sidebar v0.19.0+ 也走官方 sidebar-right API，
 * 按 key/priority 注册；本插件 key="dsh-termfleet" 不冲突。
 */
window.__ModuleLoader__.load({
	id: "dsh-termfleet",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		"use strict";

		var React = require("react");
		var h = React.createElement, useState = React.useState, useEffect = React.useEffect;
		var createPortal = require("react-dom").createPortal;

		// ── 极简状态（模块级 store，避免引依赖） ──
		var openState = false;
		var listeners = new Set();
		function togglePanel() { openState = !openState; listeners.forEach(function (f) { f(); }); }
		function useOpen() {
			var s = useState(0); var force = s[1];
			useEffect(function () {
				var f = function () { force(function (x) { return x + 1; }); };
				listeners.add(f);
				return function () { listeners.delete(f); };
			}, []);
			return openState;
		}
		function tokenQ() {
			var t = null; try { t = localStorage.getItem("tf_token"); } catch (e) { /* 无 */ }
			return t ? ("?token=" + encodeURIComponent(t)) : "";
		}

		// 官方图标（@deepseek-ai/dsh-client-ui-primitives path，16×16 currentColor）
		var CLOSE_PATH = "M8.00195 7.05176L12.5957 2.45801L13.5469 3.40918L8.95312 8.00293L13.5469 12.5967L12.5957 13.5479L8.00195 8.9541L3.4082 13.5479L2.45703 12.5967L7.05078 8.00293L2.45703 3.40918L3.4082 2.45801L8.00195 7.05176Z";

		// ── 原生化渐进第一步：tab 主体默认渲染【原生任务板】(React h())，flag 可切回 iframe 完整面板 ──
		// 数据与动作全走既有鉴权路由（/tasks、/tasks/action，Bearer=localStorage.tf_token）；
		// 状态机与列归并对齐 app.html（unified-board 10 态，ready 归并 ready-for-*，其余态入「其他」列兜底）。
		var UB_FLOW = {
			"needs-triage": ["needs-info", "ready-for-agent", "ready-for-human", "wontfix"],
			"needs-info": ["needs-triage"],
			"ready-for-agent": ["active", "needs-triage"],
			"ready-for-human": ["active", "needs-triage"],
			"active": ["review", "needs-info", "blocked", "wontfix"],
			"review": ["implemented", "active"],
			"implemented": ["archived"],
			"blocked": ["needs-triage", "wontfix"],
			"wontfix": ["needs-triage"],
			"archived": []
		};
		var NB_COLS = [["needs-triage", "待分诊"], ["ready", "就绪"], ["active", "进行中"], ["review", "待验收"], ["implemented", "已实施"], ["blocked", "阻塞"]];
		var NB_LABEL = { "needs-triage": "待分诊", "needs-info": "缺信息", "ready-for-agent": "就绪(A)", "ready-for-human": "就绪(H)", "active": "进行中", "review": "待验收", "implemented": "已实施", "blocked": "阻塞", "wontfix": "不做", "archived": "归档" };
		function nbColOf(status) { return status === "ready-for-agent" || status === "ready-for-human" ? "ready" : status }
		function nbLabel(s) { return NB_LABEL[s] || s }
		function nbOn() { try { return localStorage.getItem("tf_native_board") !== "0" } catch (e) { return true } }
		function nbSet(on) { try { localStorage.setItem("tf_native_board", on ? "1" : "0") } catch (e) { /* 无 */ } }
		function tokRaw() { try { return localStorage.getItem("tf_token") || "" } catch (e) { return "" } }
		function nbApi(path, method, body) {
			return fetch("/dsh-termfleet/" + path, {
				method: method || "GET",
				headers: Object.assign({ authorization: "Bearer " + tokRaw() }, body ? { "content-type": "application/json" } : {}),
				body: body ? JSON.stringify(body) : undefined
			});
		}
		var NB_FONT = "-apple-system,'Segoe UI','PingFang SC',sans-serif";

		function NativeTaskBoard(props) {
			var onIframe = props.onIframe;
			var ss = useState({ tasks: null, err: "", openId: null, hint: "", newTitle: "" });
			var st = ss[0], setSt = ss[1];
			function load() {
				nbApi("tasks").then(function (r) {
					if (r.status === 401) { setSt(function (x) { return Object.assign({}, x, { err: "auth" }) }); return null }
					return r.json().then(function (d) { setSt(function (x) { return Object.assign({}, x, { tasks: d.tasks || [], err: "" }) }) });
				}).catch(function (e) { setSt(function (x) { return Object.assign({}, x, { err: String(e && e.message || e) }) }) });
			}
			useEffect(function () {
				load();
				var t = setInterval(load, 6000);
				return function () { clearInterval(t) };
			}, []);
			function act(id, op, patch, label) {
				nbApi("tasks/action", "POST", { id: id, op: op, patch: patch || {} }).then(function (r) {
					if (r.status === 401) { setSt(function (x) { return Object.assign({}, x, { err: "auth", hint: "" }) }); return null } // 401 响应无 ok 字段——不查状态码会显示假成功 hint
					return r.json().then(function (d) {
						setSt(function (x) { return Object.assign({}, x, { hint: d.ok === false ? (d.error || "操作失败") : (label || op + " ✓") }) });
						load();
					});
				}).catch(function () { setSt(function (x) { return Object.assign({}, x, { hint: "网络错误" }) }) });
			}
			function quickAdd() {
				var title = st.newTitle.trim();
				if (!title) return;
				nbApi("tasks/create", "POST", { title: title }).then(function (r) {
					if (r.status === 401) { setSt(function (x) { return Object.assign({}, x, { err: "auth", hint: "" }) }); return null }
					return r.json().then(function (d) {
						setSt(function (x) { return Object.assign({}, x, { newTitle: "", hint: d.ok === false ? (d.error || "创建失败") : "已创建 ✓" }) });
						load();
					});
				}).catch(function () { setSt(function (x) { return Object.assign({}, x, { hint: "创建失败" }) }) });
			}
			var banner = null;
			if (st.err === "auth") {
				banner = h("div", { "data-tf-native": "auth", style: { padding: "10px 14px", background: "var(--dsw-alias-bg-warning-soft, #fff7e6)", color: "var(--dsw-alias-label-warning, #8a6d00)", font: "500 12px/1.5 " + NB_FONT } },
					"需要 TermFleet 令牌：点右下角 TF 按钮打开一次完整面板（会写入令牌），或把带 ?token= 的面板地址开一次。");
			} else if (st.err) {
				banner = h("div", { "data-tf-native": "error", style: { padding: "10px 14px", background: "var(--dsw-alias-bg-error-soft, #fff0f0)", color: "var(--dsw-alias-label-error, #c2410c)", font: "500 12px/1.5 " + NB_FONT } }, "加载失败：" + st.err);
			}
			var tasks = st.tasks || [];
			var byCol = {};
			for (var ci = 0; ci < NB_COLS.length; ci++) byCol[NB_COLS[ci][0]] = [];
			var others = [];
			for (var ti = 0; ti < tasks.length; ti++) {
				var c = nbColOf(tasks[ti].status);
				if (byCol[c]) byCol[c].push(tasks[ti]); else others.push(tasks[ti]);
			}
			var th = { display: "flex", alignItems: "center", gap: "6px", padding: "8px 10px", flex: "none", borderBottom: "1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.04))" };
			var colEls = [];
			for (var k = 0; k < NB_COLS.length; k++) colEls.push(nbColumn(NB_COLS[k][0], NB_COLS[k][1], byCol[NB_COLS[k][0]], st, setSt, act, load));
			if (others.length) colEls.push(nbColumn("_other", "其他", others, st, setSt, act, load));
			return h("div", { "data-tf-native-board": "v1", style: { display: "flex", flexDirection: "column", width: "100%", height: "100%", minHeight: 0, background: "var(--dsw-alias-bg-base, #fff)" } },
				h("div", { style: th },
					h("span", { style: { width: "18px", height: "18px", borderRadius: "5px", background: "var(--dsw-alias-brand-primary, #0f1115)", color: "var(--dsw-alias-brand-primary-invert, #fff)", display: "grid", placeItems: "center", font: "800 9px " + NB_FONT } }, "TF"),
					h("b", { style: { fontSize: "12.5px", color: "var(--dsw-alias-label-primary, #0f1115)" } }, "任务板"),
					h("span", { style: { fontSize: "10.5px", color: "var(--dsw-alias-label-caption, #adb2b8)" } }, "原生"),
					h("span", { style: { flex: "1" } }),
					h("button", { onClick: function () { load() }, title: "刷新", style: nbBtnStyle() }, "刷新"),
					h("button", { onClick: onIframe, title: "切回 iframe 完整面板（远程/避坑/审计等）", style: nbBtnStyle() }, "完整面板")),
				h("div", { style: { display: "flex", gap: "6px", padding: "8px 10px", flex: "none", borderBottom: "1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.04))" } },
					h("input", {
						value: st.newTitle, placeholder: "快速建任务（标题，进待分诊）…",
						onChange: function (e) { var v = e.target.value; setSt(function (x) { return Object.assign({}, x, { newTitle: v }) }) },
						onKeyDown: function (e) { if (e.key === "Enter") quickAdd() },
						style: { flex: "1", minWidth: 0, border: "1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.1))", borderRadius: "8px", padding: "5px 8px", fontSize: "12px", background: "var(--dsw-alias-bg-input, #fff)", color: "var(--dsw-alias-label-primary, #0f1115)", outline: "none" }
					}),
					h("button", { onClick: quickAdd, style: nbBtnStyle(true) }, "建")),
				st.hint ? h("div", { style: { padding: "4px 10px", flex: "none", font: "500 11px " + NB_FONT, color: "var(--dsw-alias-label-secondary, #61666b)" } }, st.hint) : null,
				banner,
				h("div", { style: { flex: "1", minHeight: 0, display: "flex", gap: "8px", padding: "8px 10px", overflowX: "auto", alignItems: "flex-start" } }, colEls),
				h("div", { style: { padding: "6px 10px", flex: "none", borderTop: "1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.04))", font: "400 10.5px " + NB_FONT, color: "var(--dsw-alias-label-caption, #adb2b8)" } },
					"原生任务板 v1 · 详情/远程/避坑/审计在完整面板"));
		}
		function nbBtnStyle(primary) {
			return {
				border: "1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.1))", borderRadius: "8px", cursor: "pointer",
				padding: primary ? "5px 10px" : "4px 8px", fontSize: "11px", font: "500 11px " + NB_FONT,
				background: primary ? "var(--dsw-alias-brand-primary, #0f1115)" : "transparent",
				color: primary ? "var(--dsw-alias-brand-primary-invert, #fff)" : "var(--dsw-alias-label-secondary, #61666b)",
				flex: "none"
			};
		}
		function nbColumn(key, label, items, st, setSt, act, load) {
			var cards = items.map(function (t) { return nbCard(t, st, setSt, act, load) });
			return h("div", { key: key, "data-nb-col": key, style: { flex: "1 0 82%", maxWidth: "100%", background: "var(--dsw-alias-bg-module-platform, #f5f6f7)", borderRadius: "10px", padding: "6px", display: "flex", flexDirection: "column", gap: "6px", minHeight: "80px" } },
				h("div", { style: { font: "600 11px " + NB_FONT, color: "var(--dsw-alias-label-secondary, #61666b)", display: "flex", gap: "4px", alignItems: "center" } },
					label, h("span", { style: { font: "500 10px " + NB_FONT, opacity: ".7" } }, String(items.length))),
				h("div", { style: { display: "flex", flexDirection: "column", gap: "6px", overflowY: "auto", minHeight: 0 } }, cards.length ? cards : [h("div", { key: "e", style: { font: "400 10.5px " + NB_FONT, color: "var(--dsw-alias-label-caption, #adb2b8)", padding: "4px" } }, "—")]));
		}
		function nbCard(t, st, setSt, act, load) {
			var open = st.openId === t.id;
			var head = h("div", {
				onClick: function () { setSt(function (x) { return Object.assign({}, x, { openId: open ? null : t.id }) }) },
				style: { cursor: "pointer" }
			},
				h("div", { style: { font: "500 12px/1.4 " + NB_FONT, color: "var(--dsw-alias-label-primary, #0f1115)", wordBreak: "break-word" } }, t.title),
				h("div", { style: { display: "flex", gap: "4px", alignItems: "center", flexWrap: "wrap", margin: "4px 0 0" } },
					h("span", { style: { font: "700 9.5px " + NB_FONT, padding: "1px 5px", borderRadius: "6px", background: t.prio === "P0" ? "#fee2e2" : t.prio === "P1" ? "#fef3c7" : "var(--dsw-alias-bg-module-platform, #f0f1f2)", color: t.prio === "P0" ? "#b91c1c" : t.prio === "P1" ? "#92400e" : "var(--dsw-alias-label-secondary, #61666b)" } }, t.prio || "P2"),
					h("span", { style: { font: "500 9.5px " + NB_FONT, padding: "1px 5px", borderRadius: "6px", border: "1px dashed var(--dsw-alias-border-l2, rgba(0,0,0,.15))", color: "var(--dsw-alias-label-secondary, #61666b)" } }, nbLabel(t.status)),
					t.session ? h("span", { title: "绑定会话 " + (t.session.sessionId || ""), style: { font: "600 9.5px " + NB_FONT, padding: "1px 5px", borderRadius: "6px", background: "var(--dsw-alias-bg-success-soft, #ecfdf5)", color: "var(--dsw-alias-label-success, #047857)" } }, "⚡会话") : null,
					t.owner ? h("span", { style: { font: "500 9.5px " + NB_FONT, color: "var(--dsw-alias-label-caption, #adb2b8)" } }, "· " + t.owner) : null,
					h("span", { style: { flex: "1" } }),
					h("span", { style: { font: "400 9.5px " + NB_FONT, color: "var(--dsw-alias-label-caption, #adb2b8)" } }, t.id)));
			var detail = null;
			if (open) {
				var acc = (t.acceptance || []).map(function (a, i) {
					return h("label", { key: "a" + i, style: { display: "flex", gap: "5px", alignItems: "baseline", font: "400 11px " + NB_FONT, color: "var(--dsw-alias-label-primary, #0f1115)", cursor: "pointer" } },
						h("input", { type: "checkbox", checked: a.done === true, onChange: function (e) { act(t.id, "update", { acceptanceId: a.id, pass: e.target.checked }, "验收 " + a.id + " ✓") }, style: { width: "auto" } }),
						(a.done ? "✓ " : "") + a.id + " " + a.text);
				});
				var pend = (t.pending || []).filter(function (c) { return !c.done }).map(function (c, i) {
					return h("div", { key: "c" + i, style: { font: "400 11px " + NB_FONT, color: "var(--dsw-alias-label-warning, #8a6d00)" } }, "待确认 " + c.id + " " + c.text);
				});
				var flows = (UB_FLOW[t.status] || []).map(function (to, i) {
					return h("button", { key: "f" + i, onClick: function () { act(t.id, "status", { status: to }, "→ " + nbLabel(to) + " ✓") }, style: nbBtnStyle() }, "→ " + nbLabel(to));
				});
				detail = h("div", { style: { margin: "6px 0 0", padding: "6px", borderRadius: "8px", background: "var(--dsw-alias-bg-base, #fff)", border: "1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.05))", display: "flex", flexDirection: "column", gap: "5px" } },
					t.desc ? h("div", { style: { font: "400 11px/1.5 " + NB_FONT, color: "var(--dsw-alias-label-secondary, #61666b)", whiteSpace: "pre-wrap", wordBreak: "break-word" } }, String(t.desc).slice(0, 300)) : null,
					acc.length ? h("div", { style: { display: "flex", flexDirection: "column", gap: "3px" } }, acc) : null,
					pend.length ? h("div", { style: { display: "flex", flexDirection: "column", gap: "2px" } }, pend) : null,
					t.session ? h("div", { style: { font: "400 10.5px " + NB_FONT, color: "var(--dsw-alias-label-caption, #adb2b8)" } }, "⚡ " + (t.session.member ? t.session.member + " · " : "本机 · ") + String(t.session.sessionId || "").slice(0, 20)) : null,
					h("div", { style: { display: "flex", gap: "4px", flexWrap: "wrap" } },
						h("button", { onClick: function () { act(t.id, t.owner ? "release" : "claim", null, t.owner ? "已取消认领" : "已认领 ✓") }, style: nbBtnStyle() }, t.owner ? "取消认领" : "认领"),
						flows,
						h("button", { onClick: function () { act(t.id, "delete", null, "已删除") }, style: Object.assign({}, nbBtnStyle(), { color: "#b91c1c" }) }, "删")));
			}
			return h("div", { key: t.id, "data-nb-card": t.id, style: { background: "var(--dsw-alias-bg-base, #fff)", border: "1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.06))", borderRadius: "9px", padding: "7px 8px" } }, head, detail);
		}

		// ── 官方右侧栏 tab 主体（原生任务板 ↔ iframe 完整面板，flag 切换） ──
		function TfTabBody() {
			var flag = useState(nbOn());
			var native = flag[0], setNative = flag[1];
			var ss = useState({ kind: "loading", msg: "探测 TermFleet host..." });
			var setStatus = ss[1];
			useEffect(function () {
				if (native) return; // 原生板自带数据探测，仅 iframe 模式探测宿主
				var ac = new AbortController();
				fetch("/dsh-termfleet/app", { method: "GET", credentials: "include", signal: ac.signal })
					.then(function (r) {
						if (r.ok) { setStatus({ kind: "ok", msg: "" }); return; }
						if (r.status === 401) {
							setStatus({ kind: "auth", msg: "TermFleet 鉴权门 401 — dsh launch token 与 ~/.dsh/termfleet/token.json 不联动。已知 TBD（change-002 排期）。临时绕过：把当前 URL 的 ?token= 拷到 localStorage.tf_token 并重启 termfleet 同步（仍会被 host 自家 token 拒绝，根治待 change-002）。" });
							return;
						}
						return r.text().then(function (t) {
							setStatus({ kind: "error", msg: "TermFleet host " + r.status + "：" + t.slice(0, 200) });
						});
					})
					.catch(function (e) {
						if (String(e && e.name) === "AbortError") return;
						setStatus({ kind: "network", msg: "TermFleet host 不可达：" + String(e && e.message || e) });
					});
				return function () { ac.abort(); };
			}, [native]);
			if (native) return h(NativeTaskBoard, { onIframe: function () { nbSet(false); setNative(false) } });
			var st = ss[0];
			var banner = null;
			if (st.kind === "auth" || st.kind === "error" || st.kind === "network") {
				var bg = st.kind === "auth" ? "var(--dsw-alias-bg-warning-soft, #fff7e6)" : "var(--dsw-alias-bg-error-soft, #fff0f0)";
				var fg = st.kind === "auth" ? "var(--dsw-alias-label-warning, #8a6d00)" : "var(--dsw-alias-label-error, #c2410c)";
				banner = h("div", {
					"data-tf-status": st.kind,
					style: {
						flex: "none",
						padding: "10px 14px",
						background: bg,
						color: fg,
						borderBottom: "1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.06))",
						font: "500 12px/1.5 " + NB_FONT
					}
				}, st.msg);
			}
			return h("div", {
				"data-tf-sidebar-tab-body": "v1",
				style: {
					display: "flex",
					flexDirection: "column",
					width: "100%",
					height: "100%",
					minHeight: 0,
					background: "var(--dsw-alias-bg-base, #fff)"
				}
			}, banner, h("div", { style: { display: "flex", justifyContent: "flex-end", padding: "6px 10px", flex: "none" } },
				h("button", { onClick: function () { nbSet(true); setNative(true) }, title: "切回原生任务板", style: nbBtnStyle() }, "原生任务板")),
				h("iframe", {
					src: "/dsh-termfleet/app" + tokenQ(),
					title: "TermFleet",
					style: { flex: "1", border: "0", width: "100%", background: "#fff" }
				}));
		}

		// ── 官方右侧栏 tab chip 标题（icon + 文字） ──
		function TfTabTitle() {
			return h("span", {
				style: {
					display: "inline-flex",
					alignItems: "center",
					gap: "6px",
					font: "600 12px -apple-system,'Segoe UI','PingFang SC',sans-serif",
					color: "var(--dsw-alias-label-primary, #0f1115)"
				}
			},
				h("span", {
					style: {
						width: "14px", height: "14px", borderRadius: "4px",
						background: "var(--dsw-alias-brand-primary, #0f1115)",
						color: "var(--dsw-alias-brand-primary-invert, #fff)",
						display: "grid", placeItems: "center",
						font: "800 9px -apple-system,'Segoe UI',sans-serif"
					}
				}, "TF"),
				"TermFleet"
			);
		}

		// ── 引导页胶囊图标（侧栏空时显示） ──
		function TfGuideIcon(props) {
			var size = (props && props.size) || 22;
			return h("span", {
				style: {
					width: size + "px", height: size + "px",
					borderRadius: Math.round(size / 3.7) + "px",
					background: "var(--dsw-alias-brand-primary, #0f1115)",
					color: "var(--dsw-alias-brand-primary-invert, #fff)",
					display: "grid", placeItems: "center",
					font: "800 " + Math.round(size * 0.5) + "px -apple-system,'Segoe UI',sans-serif"
				}
			}, "TF");
		}

		// ── 会话头入口 + 浮层面板（一个组件两份输出） ──
		function EntryPanel() {
			var open = useOpen();
			var ss = useState({ kind: "loading", msg: "探测 TermFleet host..." });
			var setStatus = ss[1];
			useEffect(function () {
				if (!open) return;
				var ac = new AbortController();
				fetch("/dsh-termfleet/app", { method: "GET", credentials: "include", signal: ac.signal })
					.then(function (r) {
						if (r.ok) { setStatus({ kind: "ok", msg: "" }); return; }
						if (r.status === 401) {
							setStatus({ kind: "auth", msg: "TermFleet 鉴权门 401 — dsh launch token 与 ~/.dsh/termfleet/token.json 不联动。已知 TBD（change-002 排期）。" });
							return;
						}
						return r.text().then(function (t) {
							setStatus({ kind: "error", msg: "TermFleet host " + r.status + "：" + t.slice(0, 200) });
						});
					})
					.catch(function (e) {
						if (String(e && e.name) === "AbortError") return;
						setStatus({ kind: "network", msg: "TermFleet host 不可达：" + String(e && e.message || e) });
					});
				return function () { ac.abort(); };
			}, [open]);
			var st = ss[0];
			var entry = h("button", {
				onClick: togglePanel,
				title: "TermFleet 团队驾驶舱（任务/远程/避坑/审计）",
				style: {
					display: "inline-flex", alignItems: "center", justifyContent: "center",
					gap: "4px", height: "26px", minWidth: "26px", padding: open ? "0 10px" : "0 8px",
					borderRadius: "9px", cursor: "pointer", font: "600 11px -apple-system,'Segoe UI','PingFang SC',sans-serif",
					color: open ? "var(--dsw-alias-label-primary-foreground, #fff)" : "var(--dsw-alias-label-secondary, #61666b)",
					background: open ? "var(--dsw-alias-brand-primary, #0f1115)" : "transparent",
					border: "1px solid var(--dsh-alias-border-l2, var(--dsw-alias-border-l2, rgba(0,0,0,.1)))",
				}
			}, "TF");

			if (!open) return entry;
			var banner = null;
			if (st.kind === "auth" || st.kind === "error" || st.kind === "network") {
				var bg = st.kind === "auth" ? "var(--dsw-alias-bg-warning-soft, #fff7e6)" : "var(--dsw-alias-bg-error-soft, #fff0f0)";
				var fg = st.kind === "auth" ? "var(--dsw-alias-label-warning, #8a6d00)" : "var(--dsw-alias-label-error, #c2410c)";
				banner = h("div", {
					"data-tf-status": st.kind,
					style: {
						flex: "none",
						padding: "10px 14px",
						background: bg,
						color: fg,
						borderBottom: "1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.06))",
						font: "500 12px/1.5 -apple-system,'Segoe UI','PingFang SC',sans-serif"
					}
				}, st.msg);
			}
			return [entry, createPortal(
				h("div", {
					key: "tf-panel",
					style: {
						position: "fixed", top: "0", right: "0", bottom: "0",
						width: "min(480px, 94vw)", zIndex: 9990,
						display: "flex", flexDirection: "column",
						background: "var(--dsw-alias-bg-base, #fff)",
						borderLeft: "1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.1))",
						boxShadow: "-18px 0 60px rgba(0,0,0,.18)",
					}
				},
					h("div", {
						style: {
							display: "flex", alignItems: "center", gap: "8px",
							padding: "10px 12px", flex: "none",
							borderBottom: "1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.04))",
							background: "var(--dsw-alias-bg-module-platform, #f5f6f7)",
						}
					},
						h("span", {
							style: {
								width: "20px", height: "20px", borderRadius: "6px",
								background: "var(--dsw-alias-brand-primary, #0f1115)",
								color: "var(--dsw-alias-brand-primary-invert, #fff)",
								display: "grid", placeItems: "center",
								font: "800 10px -apple-system,'Segoe UI',sans-serif",
							}
						}, "TF"),
						h("b", { style: { fontSize: "13px", color: "var(--dsw-alias-label-primary, #0f1115)" } }, "TermFleet"),
						h("span", { style: { fontSize: "11px", color: "var(--dsw-alias-label-caption, #adb2b8)" } }, "团队驾驶舱"),
						h("span", { style: { flex: "1" } }),
						h("button", {
							onClick: togglePanel, title: "收起",
							style: {
								width: "26px", height: "26px", borderRadius: "8px", cursor: "pointer",
								display: "grid", placeItems: "center", border: "0",
								background: "transparent", color: "var(--dsw-alias-label-secondary, #61666b)",
							}
						}, h("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none" },
							h("path", { d: CLOSE_PATH, fill: "currentColor" })))
					),
					banner,
					h("iframe", {
						src: "/dsh-termfleet/app" + tokenQ(),
						style: { flex: "1", border: "0", width: "100%", background: "#fff" }
					})
				),
				document.body)
			];
		}

		// ── 导出（client cordis：inject 声明服务，apply 注册槽位） ──
		exports.inject = ["slots", "sidebarRightTabs"];
		exports.apply = function (ctx) {
			try {
				// 1) 官方右侧栏 tab 类型定义（与 dsh-client-ui-sidebar-files 同款 effect 包裹）
				ctx.effect(function () {
					return ctx.sidebarRightTabs.register({
						id: "dsh-termfleet",
						kind: "termfleet",
						priority: "builtin",
						title: function () { return "TermFleet"; },
						guide: [{
							order: 50,
							title: function () { return "TermFleet 团队驾驶舱"; },
							description: function () { return "任务 / 远程 / 避坑 / 审计 · 全过统一同意总线"; },
							icon: TfGuideIcon
						}]
					});
				}, "dsh-termfleet: tab definition (key=termfleet)");

				// 2) 官方右侧栏 tab 主体
				ctx.slots.inject("sidebar.right.pane.tab", function () {
					return ctx.slots.register(
						{ name: "sidebar.right.pane.tab", key: "dsh-termfleet" },
						function () { return h(TfTabBody); }
					);
				});

				// 3) 官方右侧栏 tab 标题
				ctx.slots.inject("sidebar.right.pane.tab.title", function () {
					return ctx.slots.register(
						{ name: "sidebar.right.pane.tab.title", key: "dsh-termfleet" },
						function () { return h(TfTabTitle); }
					);
				});

				// 4) 会话头 utility 入口（0.1.x 槽位）
				ctx.slots.inject("conversation.session.header.utilities", function () {
					return ctx.slots.register(
						{ name: "conversation.session.header.utilities", id: "dsh-termfleet:entry", order: 20, registrant: "dsh-termfleet" },
						function () { return h(EntryPanel); }
					);
				});

				// 5) 0.2.0 兼容：utilities 槽已删（回归实测只剩 corner），rightbar.session 已被 mf 占用
				//    → shadow 它：同 key 注册更高优先级，先渲染原生内容再追加 TF 按钮（共左共存不覆盖）
				ctx.slots.inject("rightbar.session", function () {
					return ctx.slots.register(
						{ name: "rightbar.session", key: "dsh-termfleet:shadow", priority: 1 },
						function () { return null; }
					);
				});
				// 真正的入口：shadow 会话右栏，在 body 末尾挂固定按钮 + 浮层（不破坏 mf 布局）
				(function () {
					if (document.getElementById("tf-entry-btn")) return;
					var btn = document.createElement("button");
					btn.id = "tf-entry-btn";
					btn.textContent = "TF";
					btn.title = "TermFleet 团队驾驶舱";
					btn.style.cssText = "position:fixed;right:12px;bottom:14px;z-index:9980;width:44px;height:44px;border-radius:14px;border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.1));background:var(--dsw-alias-brand-primary,#0f1115);color:var(--dsw-alias-brand-primary-invert,#fff);font:800 13px -apple-system,'Segoe UI',sans-serif;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.25)";
					var panel = null;
					btn.onclick = function () {
						if (panel) { panel.remove(); panel = null; btn.style.opacity = "1"; return }
						panel = document.createElement("div");
						panel.id = "tf-panel";
						panel.style.cssText = "position:fixed;top:0;right:0;bottom:0;width:min(480px,94vw);z-index:9981;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base,#fff);border-left:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.1));box-shadow:-18px 0 60px rgba(0,0,0,.18)";
						var head = document.createElement("div");
						head.style.cssText = "display:flex;align-items:center;gap:8px;padding:10px 12px;flex:none;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.04));background:var(--dsw-alias-bg-module-platform,#f5f6f7)";
						var close = document.createElement("button");
						close.textContent = "✕";
						close.style.cssText = "margin-left:auto;border:0;background:transparent;font-size:14px;cursor:pointer;color:var(--dsw-alias-label-secondary,#61666b)";
						close.onclick = function () { panel.remove(); panel = null };
						var title = document.createElement("b");
						title.textContent = "TermFleet";
						title.style.cssText = "font-size:13px;color:var(--dsw-alias-label-primary,#0f1115)";
						var tok = ""; try { tok = localStorage.getItem("tf_token") || "" } catch (e) {}
						var ifr = document.createElement("iframe");
						ifr.src = "/dsh-termfleet/app" + (tok ? "?token=" + encodeURIComponent(tok) : "");
						ifr.style.cssText = "flex:1;border:0;width:100%;background:#fff";
						head.appendChild(title); head.appendChild(close);
						panel.appendChild(head); panel.appendChild(ifr);
						document.body.appendChild(panel);
					};
					document.body.appendChild(btn);
				})();

				window.__tfClient = "ok";
			} catch (e) {
				window.__tfClient = "err:" + String(e && e.message || e);
			}
		};

		return module.exports;
	}
});
