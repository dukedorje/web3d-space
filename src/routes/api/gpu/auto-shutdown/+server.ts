import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadSettings, saveSettings } from '$lib/server/runpod/settings';
import { startIdleWatcher } from '$lib/server/runpod/idle';

export const prerender = false;

const MIN = 5;
const MAX = 120;

export const GET: RequestHandler = async () => {
	startIdleWatcher();
	return json(loadSettings().autoShutdown);
};

export const POST: RequestHandler = async ({ request }) => {
	startIdleWatcher();
	const body = (await request.json().catch(() => null)) as {
		enabled?: unknown;
		idleMinutes?: unknown;
	} | null;
	if (!body || typeof body.enabled !== 'boolean' || typeof body.idleMinutes !== 'number') {
		return json({ error: 'enabled:boolean and idleMinutes:number required' }, { status: 400 });
	}
	const idleMinutes = Math.round(body.idleMinutes);
	if (idleMinutes < MIN || idleMinutes > MAX) {
		return json({ error: `idleMinutes must be ${MIN}–${MAX}` }, { status: 400 });
	}
	const s = loadSettings();
	s.autoShutdown = { enabled: body.enabled, idleMinutes };
	saveSettings(s);
	return json(s.autoShutdown);
};
