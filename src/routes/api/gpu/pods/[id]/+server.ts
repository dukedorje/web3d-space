import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPod, restartPod, resetPod, startPod, stopPod, terminatePod, updatePod, RunpodError } from '$lib/server/runpod/client';
import { forgetPod, touchActivity } from '$lib/server/runpod/settings';
import { startIdleWatcher } from '$lib/server/runpod/idle';

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	startIdleWatcher();
	touchActivity();
	try {
		return json({ ok: true, pod: await getPod(params.id) });
	} catch (err) {
		if (err instanceof RunpodError) {
			return json({ ok: false, error: err.detail }, { status: err.status });
		}
		throw err;
	}
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	startIdleWatcher();
	touchActivity();
	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	try {
		return json({ ok: true, pod: await updatePod(params.id, body) });
	} catch (err) {
		if (err instanceof RunpodError) {
			return json({ ok: false, error: err.detail }, { status: err.status });
		}
		throw err;
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	startIdleWatcher();
	try {
		await terminatePod(params.id);
		forgetPod(params.id);
		return json({ ok: true });
	} catch (err) {
		if (err instanceof RunpodError) {
			return json({ ok: false, error: err.detail }, { status: err.status });
		}
		throw err;
	}
};

export const POST: RequestHandler = async ({ params, url }) => {
	startIdleWatcher();
	touchActivity();
	const action = url.searchParams.get('action');
	try {
		if (action === 'stop') return json({ ok: true, result: await stopPod(params.id) });
		if (action === 'start') return json({ ok: true, result: await startPod(params.id) });
		if (action === 'restart') return json({ ok: true, result: await restartPod(params.id) });
		if (action === 'reset') return json({ ok: true, result: await resetPod(params.id) });
		return json({ ok: false, error: `unknown action ${action}` }, { status: 400 });
	} catch (err) {
		if (err instanceof RunpodError) {
			return json({ ok: false, error: err.detail }, { status: err.status });
		}
		throw err;
	}
};
