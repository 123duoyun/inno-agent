import { apiFetch } from "./client.js";
import type { PresetMeta } from "../types/presets.js";

export async function listPresets(): Promise<PresetMeta[]> {
	return apiFetch<PresetMeta[]>("/api/presets");
}
