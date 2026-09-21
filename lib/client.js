/**
 * dsh-termfleet client 半 v1：dsh web 内的 TermFleet 入口 + 右侧浮层面板。
 * 形态=模块表包装（window.__ModuleLoader__.load，参照 dsh-hippo lib/client.js）；
 * react/react-dom 从客户端模块表 require（由 dsh web 运行时提供）；
 * 肤色用宿主 --dsw-alias-* 变量（亮暗自动跟随）。
 * 槽位：conversation.session.header.utilities（list，实证存在——dsh-better-sidebar 同槽注册）
 * 点击行为：右侧滑出浮层，iframe 嵌 /dsh-termfleet/app（同源，令牌复用 localStorage.tf_token）。
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

		// ── 会话头入口 + 浮层面板（一个组件两份输出） ──
		function EntryPanel() {
			var open = useOpen();
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
					h("iframe", {
						src: "/dsh-termfleet/app" + tokenQ(),
						style: { flex: "1", border: "0", width: "100%", background: "#fff" }
					})
				),
				document.body)
			];
		}

		// ── 导出（client cordis：inject 声明服务，apply 注册槽位） ──
		exports.inject = ["slots"];
		exports.apply = function (ctx) {
			try {
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
