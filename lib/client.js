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

		// ── 官方右侧栏 tab 主体（iframe 嵌 /app，撑满侧栏面板） ──
		function TfTabBody() {
			var ss = useState({ kind: "loading", msg: "探测 TermFleet host..." });
			var setStatus = ss[1];
			useEffect(function () {
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
			}, []);
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
						font: "500 12px/1.5 -apple-system,'Segoe UI','PingFang SC',sans-serif"
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
			}, banner, h("iframe", {
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

				// 4) 会话头 utility 入口（v1 原状保留）
				ctx.slots.inject("conversation.session.header.utilities", function () {
					return ctx.slots.register(
						{ name: "conversation.session.header.utilities", id: "dsh-termfleet:entry", order: 20, registrant: "dsh-termfleet" },
						function () { return h(EntryPanel); }
					);
				});

				window.__tfClient = "ok";
			} catch (e) {
				window.__tfClient = "err:" + String(e && e.message || e);
			}
		};

		return module.exports;
	}
});
