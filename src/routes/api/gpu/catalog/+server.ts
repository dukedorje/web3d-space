import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listCatalogGpus, listDataCenters, RunpodError } from '$lib/server/runpod/client';
import { cheapestBeating } from '$lib/server/runpod/t4000';
import { startIdleWatcher } from '$lib/server/runpod/idle';

export const prerender = false;

export const GET: RequestHandler = async () => {
	startIdleWatcher();
	try {
		const [gpus, dataCenters] = await Promise.all([listCatalogGpus(), listDataCenters()]);
		const ranked = cheapestBeating(gpus);
		return json({
			ok: true,
			gpus,
			ranked,
			dataCenters,
			blackwellInStock: gpus.filter(
				(g) => g.blackwell && g.availability && g.availability !== 'NONE'
			)
		});
	} catch (err) {
		if (err instanceof RunpodError) {
			return json({ ok: false, error: err.detail, status: err.status }, { status: err.status });
		}
		throw err;
	}
};
