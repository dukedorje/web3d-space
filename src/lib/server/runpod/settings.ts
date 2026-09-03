import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { defaults } from './client';

export interface AutoShutdownConfig {
	enabled: boolean;
	idleMinutes: number;
}

export interface GpuOpsSettings {
	autoShutdown: AutoShutdownConfig;
	/** epoch ms of last probe / log / mutation. Used for idle stop. */
	lastActivityMs: number;
	/** Pod ids we started from this console (never auto-kill negotiated). */
	ownedPodIds: string[];
}

const FILE = join(process.cwd(), '.data', 'gpu-ops.json');

function fallback(): GpuOpsSettings {
	const d = defaults();
	return {
		autoShutdown: { enabled: d.autoOff, idleMinutes: d.autoOffMinutes },
		lastActivityMs: Date.now(),
		ownedPodIds: []
	};
}

export function loadSettings(): GpuOpsSettings {
	try {
		const raw = JSON.parse(readFileSync(FILE, 'utf8')) as Partial<GpuOpsSettings>;
		const base = fallback();
		return {
			autoShutdown: {
				enabled: raw.autoShutdown?.enabled ?? base.autoShutdown.enabled,
				idleMinutes: raw.autoShutdown?.idleMinutes ?? base.autoShutdown.idleMinutes
			},
			lastActivityMs: raw.lastActivityMs ?? Date.now(),
			ownedPodIds: Array.isArray(raw.ownedPodIds) ? raw.ownedPodIds : []
		};
	} catch {
		return fallback();
	}
}

export function saveSettings(next: GpuOpsSettings): void {
	mkdirSync(dirname(FILE), { recursive: true });
	writeFileSync(FILE, JSON.stringify(next, null, 2));
}

export function touchActivity(): GpuOpsSettings {
	const s = loadSettings();
	s.lastActivityMs = Date.now();
	saveSettings(s);
	return s;
}

export function rememberPod(id: string): void {
	const s = loadSettings();
	if (!s.ownedPodIds.includes(id)) s.ownedPodIds.push(id);
	s.lastActivityMs = Date.now();
	saveSettings(s);
}

export function forgetPod(id: string): void {
	const s = loadSettings();
	s.ownedPodIds = s.ownedPodIds.filter((x) => x !== id);
	saveSettings(s);
}
