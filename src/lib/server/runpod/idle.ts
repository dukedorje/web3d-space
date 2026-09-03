import { defaults, listPods, mapStatus, stopPod } from './client';
import { loadSettings, saveSettings } from './settings';

const PREFIX = defaults().prefix;
let timer: ReturnType<typeof setInterval> | null = null;

export function startIdleWatcher(): void {
	if (timer) return;
	timer = setInterval(() => {
		void tickIdle();
	}, 60_000);
	if (typeof timer === 'object' && 'unref' in timer) timer.unref();
}

async function tickIdle(): Promise<void> {
	const s = loadSettings();
	if (!s.autoShutdown.enabled) return;
	const idleMs = s.autoShutdown.idleMinutes * 60_000;
	if (Date.now() - s.lastActivityMs < idleMs) return;

	const pods = await listPods().catch(() => []);
	const owned = pods.filter(
		(p) =>
			mapStatus(p.desiredStatus) === 'running' &&
			(s.ownedPodIds.includes(p.id) || (p.name ?? '').startsWith(PREFIX))
	);
	for (const p of owned) {
		try {
			await stopPod(p.id);
		} catch {
			/* next tick */
		}
	}
	s.lastActivityMs = Date.now();
	saveSettings(s);
}
