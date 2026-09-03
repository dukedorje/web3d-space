import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createPod, defaults, listPods, RunpodError } from '$lib/server/runpod/client';
import { rememberPod } from '$lib/server/runpod/settings';
import { startIdleWatcher } from '$lib/server/runpod/idle';

export const prerender = false;

export const GET: RequestHandler = async () => {
	startIdleWatcher();
	try {
		return json({ ok: true, pods: await listPods() });
	} catch (err) {
		if (err instanceof RunpodError) {
			return json({ ok: false, error: err.detail }, { status: err.status });
		}
		throw err;
	}
};

export const POST: RequestHandler = async ({ request }) => {
	startIdleWatcher();
	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	const d = defaults();
	const gpuTypeId = String(body.gpuTypeId ?? d.gpuType);
	const dataCenterId = body.dataCenterId ? String(body.dataCenterId) : d.dataCenter;
	const name = String(body.name ?? `${d.prefix}sim-${Date.now()}`);
	try {
		const pod = await createPod({
			name,
			gpuTypeId,
			dataCenterId,
			cloudType: body.cloudType === 'COMMUNITY' ? 'COMMUNITY' : 'SECURE',
			imageName: body.imageName ? String(body.imageName) : undefined
		});
		rememberPod(pod.id);
		return json({ ok: true, pod }, { status: 201 });
	} catch (err) {
		if (err instanceof RunpodError) {
			return json({ ok: false, error: err.detail }, { status: err.status === 500 ? 503 : err.status });
		}
		throw err;
	}
};
