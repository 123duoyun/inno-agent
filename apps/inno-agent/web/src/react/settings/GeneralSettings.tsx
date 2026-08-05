import { useTranslation } from "react-i18next";
import { setLocale } from "../../i18n/index.js";
import { SettingsSection, SettingsCard, SettingsRow } from "./primitives.js";

function LanguageSelect() {
	const { t, i18n } = useTranslation();
	return (
		<select
			className="rounded-md border border-[var(--inno-border)] bg-[var(--inno-surface)] px-2 py-1 text-xs"
			value={i18n.language}
			onChange={(e) => setLocale(e.target.value as "zh-CN" | "en")}
		>
			<option value="zh-CN">{t("settings.languageOptions.zh-CN")}</option>
			<option value="en">{t("settings.languageOptions.en")}</option>
		</select>
	);
}

export function GeneralSettings() {
	const { t } = useTranslation();
	return (
		<SettingsSection title={t("settings.tabs.general")} description={t("settings.sections.general.desc", "外观与语言偏好")}>
			<SettingsCard>
				<SettingsRow
					label={t("settings.language")}
					description={t("settings.sections.general.languageDesc", "切换界面显示语言")}
					control={<LanguageSelect />}
				/>
			</SettingsCard>
		</SettingsSection>
	);
}
