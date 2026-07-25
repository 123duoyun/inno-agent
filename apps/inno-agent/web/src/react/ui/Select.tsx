import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check } from "lucide-react";

interface Option {
	value: string;
	label: ReactNode;
}

interface SelectProps {
	value: string;
	options: Option[];
	onChange: (value: string) => void;
	/** Trigger className — should match surrounding input style. */
	className?: string;
	placeholder?: string;
	/** Disable the menu (trigger still renders). */
	disabled?: boolean;
}

/**
 * Custom dropdown that replaces native <select>.
 *
 * Trigger keeps the form's input style (passed via className), the popup
 * adopts the inno dropdown menu style:
 * `rounded-lg border bg-[--inno-surface] py-1 shadow-lg` with 11px items.
 */
export function Select({ value, options, onChange, className, placeholder, disabled }: SelectProps) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	const selected = options.find((o) => o.value === value);

	useEffect(() => {
		if (!open) return;
		function onDown(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setOpen(false);
			}
		}
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") setOpen(false);
		}
		document.addEventListener("mousedown", onDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	return (
		<div ref={ref} className="relative inline-block w-full">
			<button
				type="button"
				disabled={disabled}
				onClick={() => setOpen((v) => !v)}
				className={`${className ?? ""} flex items-center justify-between gap-2 text-left ${disabled ? "opacity-50" : ""}`}
			>
				<span className="truncate">{selected?.label ?? placeholder ?? ""}</span>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="10"
					height="10"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
					aria-hidden="true"
				>
					<path d="m6 9 6 6 6-6" />
				</svg>
			</button>
			{open ? (
				<div className="absolute left-0 top-full z-[100] mt-1 min-w-full whitespace-nowrap rounded-lg border border-[var(--inno-border)] bg-[var(--inno-surface)] py-1 shadow-lg">
					{options.map((o) => {
						const active = o.value === value;
						return (
							<button
								key={o.value}
								type="button"
								onClick={() => {
									onChange(o.value);
									setOpen(false);
								}}
								className={`flex w-full items-center gap-2 pl-2 pr-8 py-1 text-left leading-tight transition-colors hover:bg-[var(--inno-surface-muted)] ${active ? "text-[var(--inno-text)]" : "text-[var(--inno-text)]"}`}
								style={{ fontSize: "11px" }}
							>
								<Check
									width={12}
									height={12}
									className={`shrink-0 ${active ? "text-[var(--inno-text)]" : "text-transparent"}`}
									aria-hidden="true"
								/>
								<span className="flex-1 truncate">{o.label}</span>
							</button>
						);
					})}
				</div>
			) : null}
		</div>
	);
}
