import "./app.css";
import "./i18n/index.js";
import "./stores/theme-store.js";
// Register <markdown-block> explicitly — QuestionDialog depends on it and must not
// rely on pi-web-ui's side-effect import chain (ChatCenter → MarkdownArtifact → mini-lit).
import "@mariozechner/mini-lit/dist/MarkdownBlock.js";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./react/App.js";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Missing #root element");

createRoot(rootEl).render(
	<StrictMode>
		<App />
	</StrictMode>,
);

// 工具栏图标按钮：按下后维持 #555AFF 0.5s 再恢复
document.addEventListener("pointerdown", (e) => {
	const btn = (e.target as HTMLElement)?.closest?.(".inno-toolbar-icon-btn") as HTMLElement | null;
	if (!btn || btn.hasAttribute("disabled")) return;
	btn.classList.remove("pressed");
	void btn.offsetWidth; // 强制 reflow，允许重复触发
	btn.classList.add("pressed");
	window.setTimeout(() => btn.classList.remove("pressed"), 500);
});

console.log("[inno-web] React initialized");
