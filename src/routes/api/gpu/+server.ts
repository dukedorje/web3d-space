import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	accountSnapshot,
	defaults,
	enrichPods,
	listPods,
	mapStatus,
	proxyUrl,
	RunpodError
} from '$lib/server/runpod/client';
import { startIdleWatcher } from '$lib/server/runpod/idle';
import { loadSettings, touchActivity } from '$lib/server/runpod/settings';
import { T4000 } from '$lib/server/runpod/t4000';

export const prerender = false;

export const GET: RequestHandler = async () => {
	startIdleWatcher();
	touchActivity();
	try {
		const [rawPods, account] = await Promise.all([listPods(), accountSnapshot().catch(() => null)]);
		const pods = await enrichPods(rawPods);
		const settings = loadSettings();
		const running = pods.filter((p) => mapStatus(p.desiredStatus) === 'running');
		return json({
			ok: true,
			t4000: T4000,
			defaults: defaults(),
			account,
			autoShutdown: settings.autoShutdown,
			idleSeconds: Math.max(0, Math.floor((Date.now() - settings.lastActivityMs) / 1000)),
			ownedPodIds: settings.ownedPodIds,
			runningCount: running.length,
			pods: pods.map((p) => ({
				id: p.id,
				name: p.name ?? p.id,
				status: mapStatus(p.desiredStatus),
				desiredStatus: p.desiredStatus,
				gpuType: p.machine?.gpuTypeId ?? null,
				dataCenter: p.machine?.dataCenterId ?? null,
				costPerHr: p.costPerHr ?? null,
				publicIp: p.publicIp ?? null,
				sshPort: p.portMappings?.['22'] ?? null,
				http8000: proxyUrl(p.id, 8000),
				http8888: proxyUrl(p.id, 8888),
				owned: settings.ownedPodIds.includes(p.id) || (p.name ?? '').startsWith(defaults().prefix),
				createdAt: p.createdAt ?? null,
				lastStartedAt: p.lastStartedAt ?? null,
				image: p.imageName ?? null,
				memoryInGb: p.memoryInGb ?? null,
				vcpuCount: p.vcpuCount ?? null
			}))
		});
	} catch (err) {
		if (err instanceof RunpodError) {
			return json({ ok: false, error: err.detail, status: err.status }, { status: err.status });
		}
		throw err;
	}
};
