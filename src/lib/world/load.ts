import type { WorldDocument } from './document.js';
import { WorldDocumentError } from './document.js';
import { log } from '../log.js';

export type AssetKind = 'hdri' | 'glb' | 'splat';

export class MissingAssetError extends WorldDocumentError {
	readonly url: string;
	readonly kind: AssetKind;

	constructor(kind: AssetKind, url: string) {
		super(`Missing ${kind} asset: ${url}`);
		this.name = 'MissingAssetError';
		this.kind = kind;
		this.url = url;
	}
}

export type FetchLike = (input: string, init?: { method?: string }) => Promise<{ ok: boolean; status: number }>;

async function probe(fetchImpl: FetchLike, kind: AssetKind, url: string): Promise<void> {
	let res: { ok: boolean; status: number };
	try {
		res = await fetchImpl(url, { method: 'HEAD' });
	} catch {
		throw new MissingAssetError(kind, url);
	}
	if (!res.ok) {
		log('error', `HEAD ${kind} ${url} → ${res.status}`);
		throw new MissingAssetError(kind, url);
	}
	log('info', `HEAD ${kind} ${url} → ${res.status}`);
}

/**
 * Probe HDRI and mesh/splat URLs. Does not decode GPU resources.
 * Missing URLs throw MissingAssetError so a page can show the failure.
 */
export async function assertWorldAssetsAvailable(
	doc: WorldDocument,
	fetchImpl: FetchLike = fetch
): Promise<void> {
	await probe(fetchImpl, 'hdri', doc.hdri);
	for (const entity of doc.entities) {
		if (entity.glb) await probe(fetchImpl, 'glb', entity.glb);
		if (entity.splat) await probe(fetchImpl, 'splat', entity.splat);
	}
}
