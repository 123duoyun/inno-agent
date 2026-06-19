import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { RuntimePaths } from "../runtime.js";
import type { WorkspaceMeta, WorkspaceRegistry } from "../workspace/workspace-registry.js";
import { logger } from "../logger.js";

/**
 * Bundled preset workspaces.
 *
 * Presets are a read-only, ship-with-the-app set of ready-to-use workspaces.
 * Each preset is a directory under `<codeDir>/presets/<id>/` containing:
 *   - `preset.json` — metadata `{ id, name, description, icon? }` (id must equal
 *     the directory name)
 *   - `agent.md`    — per-workspace instructions (injected each turn by the
 *     extension's `before_agent_start` hook)
 *   - `.skills/`    — optional per-workspace private skills (also auto-injected)
 *
 * Opening a preset instantiates it: a fresh editable workspace is created and
 * the preset's `agent.md` + `.skills/` are copied in (excluding `preset.json`).
 */

export interface PresetMeta {
	id: string;
	name: string;
	description: string;
	icon?: string;
}

/** Only simple, single-segment ids — blocks path traversal. */
const PRESET_ID_RE = /^[a-zA-Z0-9._-]+$/;

function isValidPresetId(id: string): boolean {
	return PRESET_ID_RE.test(id) && id !== "." && id !== "..";
}

/** Absolute path to the bundled presets directory (resolved relative to compiled code root). */
export function presetsDir(paths: RuntimePaths): string {
	return join(paths.codeDir, "presets");
}

function readPresetMeta(dir: string, id: string): PresetMeta | null {
	const metaPath = join(dir, "preset.json");
	if (!existsSync(metaPath)) return null;
	try {
		const raw = JSON.parse(readFileSync(metaPath, "utf-8")) as Partial<PresetMeta>;
		const metaId = (raw.id ?? "").trim();
		// The on-disk id must match the directory name to keep instantiation safe.
		if (metaId !== id) {
			logger.warn({ dir, metaId, id }, "preset.json id does not match directory name; skipping");
			return null;
		}
		const name = (raw.name ?? "").trim();
		if (!name) {
			logger.warn({ dir }, "preset.json missing name; skipping");
			return null;
		}
		return {
			id,
			name,
			description: (raw.description ?? "").trim(),
			icon: raw.icon?.trim() || undefined,
		};
	} catch (err) {
		logger.warn({ err, dir }, "failed to parse preset.json; skipping");
		return null;
	}
}

/** List all valid bundled presets. Best-effort: invalid presets are skipped. */
export function listPresets(paths: RuntimePaths): PresetMeta[] {
	const root = presetsDir(paths);
	if (!existsSync(root)) return [];
	const out: PresetMeta[] = [];
	for (const entry of readdirSync(root, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		if (entry.name === "__MACOSX" || entry.name.startsWith(".")) continue;
		if (!isValidPresetId(entry.name)) continue;
		const meta = readPresetMeta(join(root, entry.name), entry.name);
		if (meta) out.push(meta);
	}
	return out;
}

/**
 * Recursively copy a preset's content into a destination workspace directory.
 * Uses file-by-file read/write (not cpSync) for robustness against
 * asar-unpacked paths in Electron packaged builds. Skips `preset.json`.
 */
function copyPresetContents(sourceDir: string, targetDir: string): void {
	if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
	for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
		if (entry.name === "__MACOSX" || entry.name === ".DS_Store" || entry.name === "preset.json") continue;
		const source = join(sourceDir, entry.name);
		const target = join(targetDir, entry.name);
		if (entry.isDirectory()) {
			copyPresetContents(source, target);
		} else if (entry.isFile()) {
			writeFileSync(target, readFileSync(source));
		}
	}
}

/**
 * Open a preset: return its stable dedicated workspace (creating + seeding it
 * with the preset's files on first open). Repeatedly opening the same preset
 * reuses one workspace, so every conversation for that task is archived
 * together. Throws on an unknown/invalid preset.
 */
export function instantiatePreset(
	paths: RuntimePaths,
	registry: WorkspaceRegistry,
	presetId: string,
): WorkspaceMeta {
	const id = presetId.trim();
	if (!isValidPresetId(id)) {
		throw new Error(`Invalid preset id: ${presetId}`);
	}
	const root = presetsDir(paths);
	const srcDir = join(root, id);
	// Confirm the resolved dir stays under the presets root (defence in depth).
	const rel = relative(root, srcDir);
	if (rel.startsWith("..") || !existsSync(srcDir) || !statSync(srcDir).isDirectory()) {
		throw new Error(`Preset not found: ${presetId}`);
	}
	const meta = readPresetMeta(srcDir, id);
	if (!meta) {
		throw new Error(`Preset metadata invalid: ${presetId}`);
	}

	const { ws, created } = registry.ensurePresetWorkspace(id, meta.name);
	const destDir = registry.resolveWorkspaceDir(ws.id);
	if (!destDir) {
		throw new Error(`Failed to resolve workspace dir for ${ws.id}`);
	}
	// Only seed the preset's files on first creation so later opens don't clobber
	// the user's edits / conversation artifacts in that workspace.
	if (created) {
		copyPresetContents(srcDir, destDir);
		logger.info({ presetId: id, workspaceId: ws.id }, "instantiated preset workspace");
	} else {
		logger.info({ presetId: id, workspaceId: ws.id }, "reused existing preset workspace");
	}
	return ws;
}
