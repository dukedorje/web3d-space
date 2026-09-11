import { parseWorldDocument, type WorldDocument } from '$lib/world/document.js';
import { WORLD_FIXTURE } from '$lib/world/fixture.js';
import { assertWorldAssetsAvailable, type FetchLike } from '$lib/world/load.js';

/**
 * `/mesh` world overlay. Capture enters as GLB (or splat cache), not as a
 * trainer. Skip with `?noworld` / `?world=0` so coverage still boots alone.
 */
export function skipWorldDocument(search: URLSearchParams | string): boolean {
	const params =
		typeof search === 'string'
			? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
			: search;
	if (params.has('noworld')) return true;
	const world = params.get('world');
	return world === '0' || world === 'off' || world === 'false' || world === 'skip';
}

export async function loadMeshWorldDocument(opts?: {
	skip?: boolean;
	raw?: unknown;
	fetch?: FetchLike;
}): Promise<WorldDocument | null> {
	if (opts?.skip) return null;
	const doc = parseWorldDocument(opts?.raw ?? WORLD_FIXTURE);
	await assertWorldAssetsAvailable(doc, opts?.fetch);
	return doc;
}
