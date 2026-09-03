import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { proxyUrl } from '$lib/server/runpod/client';
import { touchActivity } from '$lib/server/runpod/settings';

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	touchActivity();
	const url = `${proxyUrl(params.id, 8000)}/probes`;
	try {
		const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
		const text = await res.text();
		let body: unknown = text;
		try {
			body = JSON.parse(text);
		} catch {
			body = { raw: text };
		}
		return json({ ok: res.ok, probes: body }, { status: res.ok ? 200 : 502 });
	} catch (err) {
		return json(
			{ ok: false, error: err instanceof Error ? err.message : 'probe unreachable' },
			{ status: 502 }
		);
	}
};
