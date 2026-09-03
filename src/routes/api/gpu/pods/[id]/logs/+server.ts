import type { RequestHandler } from './$types';
import { podLogsResponse, RunpodError } from '$lib/server/runpod/client';
import { touchActivity } from '$lib/server/runpod/settings';

export const prerender = false;

export const GET: RequestHandler = async ({ params, url }) => {
	touchActivity();
	const source = url.searchParams.get('source');
	const tail = Number(url.searchParams.get('tail') ?? 200);
	try {
		const upstream = await podLogsResponse(
			params.id,
			source === 'system' || source === 'container' ? source : undefined,
			tail
		);
		return new Response(upstream.body, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive'
			}
		});
	} catch (err) {
		if (err instanceof RunpodError) {
			return new Response(err.detail, { status: err.status });
		}
		throw err;
	}
};
