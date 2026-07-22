import { useState } from "react";
import { settingsStore } from "../stores/settings-store.js";
import chatIconUrl from "./ui/chat-icon.svg";
import agentIconUrl from "./ui/agent-icon.svg";
import checkUrl from "./ui/check.svg";
import downArrowUrl from "./ui/arrow-down.svg";

interface ModeSwitchProps {
	simpleMode: boolean;
}

export function ModeSwitch({ simpleMode }: ModeSwitchProps) {
	const [showCard, setShowCard] = useState(false);

	return (
		<div className="relative px-2">
			{/* Pill - 点击切换展开/收起 */}
			<div
				className="relative w-full cursor-pointer rounded-xl"
				style={{ height: "44px", background: "rgba(227, 231, 255, 0.6)" }}
				onClick={() => setShowCard(!showCard)}
			>
				<div
					className="absolute inset-0 flex items-center justify-center gap-1.5"
					style={{ pointerEvents: "none", zIndex: 20 }}
				>
					<span style={{ fontSize: "14px", color: "#555AFF", fontWeight: 550, lineHeight: 1, whiteSpace: "nowrap" }}>
						{simpleMode ? "Chat 模式" : "Agent 模式"}
					</span>
					<img src={downArrowUrl} alt="" style={{ width: "8px", height: "5px" }} />
				</div>
			</div>

			{/* 展开卡片 */}
			{showCard && (
				<>
					{/* 遮罩 - 点击外部关闭 */}
					<div className="fixed inset-0 z-40" onClick={() => setShowCard(false)} />
					<div
						className="absolute z-50 left-1/2 -translate-x-1/2 top-full overflow-hidden rounded-2xl"
						style={{
							width: "100%",
							height: "108px",
							background: "rgba(255,255,255,0.8)",
							backdropFilter: "blur(5px)",
							WebkitBackdropFilter: "blur(5px)",
						}}
					>
						{/* 边框 */}
						<div
							className="pointer-events-none absolute inset-0 rounded-2xl"
							style={{ boxShadow: "inset 0 0 0 1px #DDE2FF" }}
						/>

						{/* 上半 - Chat 模式 */}
						<img
							src={chatIconUrl}
							alt=""
							className="absolute"
							style={{ left: "16px", top: "18px", width: "16px", height: "16px" }}
						/>
						<span
							className="absolute"
							style={{ left: "40px", top: "15px", fontSize: "14px", color: "#555AFF", fontWeight: 550, lineHeight: 1, whiteSpace: "nowrap" }}
						>
							Chat 模式
						</span>
						<span
							className="absolute"
							style={{ left: "40px", top: "33px", fontSize: "11px", color: "#545469", fontWeight: 400, lineHeight: 1, whiteSpace: "nowrap" }}
						>
							简单对话即可轻松解决问题
						</span>

						{/* 下半 - Agent 模式 */}
						<img
							src={agentIconUrl}
							alt=""
							className="absolute"
							style={{ left: "16px", top: "66px", width: "16px", height: "16px" }}
						/>
						<span
							className="absolute"
							style={{ left: "40px", top: "63px", fontSize: "14px", color: "#555AFF", fontWeight: 550, lineHeight: 1, whiteSpace: "nowrap" }}
						>
							Agent 模式
						</span>
						<span
							className="absolute"
							style={{ left: "40px", top: "81px", fontSize: "11px", color: "#545469", fontWeight: 400, lineHeight: 1, whiteSpace: "nowrap" }}
						>
							更多智能体调用，功能更强大
						</span>

						{/* 勾 - 跟随当前模式，垂直居中于对应行 */}
						<img
							src={checkUrl}
							alt=""
							className="absolute pointer-events-none"
							style={{
								right: "16px",
								top: simpleMode ? "23px" : "77px",
								width: "11px",
								height: "8px",
								zIndex: 30,
							}}
						/>

						{/* 点击区域 - 上半切换到 Chat */}
						<div
							className="absolute z-10 cursor-pointer"
							style={{ left: 0, top: 0, right: 0, height: "54px" }}
							onClick={() => { setShowCard(false); if (!simpleMode) void settingsStore.saveSimpleMode(true); }}
						/>
						{/* 点击区域 - 下半切换到 Agent */}
						<div
							className="absolute z-10 cursor-pointer"
							style={{ left: 0, top: "54px", right: 0, height: "54px" }}
							onClick={() => { setShowCard(false); if (simpleMode) void settingsStore.saveSimpleMode(false); }}
						/>
					</div>
				</>
			)}
		</div>
	);
}
