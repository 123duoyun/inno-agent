import checkboxSelectUrl from "./checkbox-select.svg";
import checkboxUnselectUrl from "./checkbox-unselect.svg";

interface CheckboxProps {
	checked: boolean;
	onChange: (value: boolean) => void;
	disabled?: boolean;
	"aria-label"?: string;
	className?: string;
}

/**
 * Controlled checkbox rendered with custom SVG icons
 * (`checkbox-select.svg` / `checkbox-unselect.svg`). A visually-hidden
 * native input is retained for keyboard accessibility and form-state.
 */
export function Checkbox({ checked, onChange, disabled, "aria-label": ariaLabel, className = "" }: CheckboxProps) {
	return (
		<span className={`relative inline-flex h-3.5 w-3.5 items-center justify-center ${className}`}>
			<input
				type="checkbox"
				checked={checked}
				disabled={disabled}
				aria-label={ariaLabel}
				onChange={(e) => onChange(e.target.checked)}
				className="absolute inset-0 m-0 cursor-pointer opacity-0"
			/>
			<img
				src={checked ? checkboxSelectUrl : checkboxUnselectUrl}
				alt=""
				aria-hidden="true"
				className="pointer-events-none h-full w-full"
			/>
		</span>
	);
}
