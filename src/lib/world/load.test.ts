import { describe, it, expect, vi } from 'vitest';
import { parseWorldDocument } from './document.js';
import { assertWorldAssetsAvailable, MissingAssetError } from './load.js';
import { WORLD_FIXTURE } from './fixture.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

describe('assertWorldAssetsAvailable', () => {
	it('resolves when HDRI and GLB probe ok', async () => {
		const fetchImpl = vi.fn(async () => ({ ok: true, status: 200 }));
		await assertWorldAssetsAvailable(parseWorldDocument(WORLD_FIXTURE), fetchImpl);
		const urls = fetchImpl.mock.calls.map((c) => c[0]);
		expect(urls).toContain('/worlds/xela/planet-atmosphere.png');
		expect(urls).toContain('/worlds/xela/xela.glb');
	});

	it('throws MissingAssetError for a missing GLB', async () => {
		const fetchImpl = vi.fn(async (url: string) => {
			if (String(url).endsWith('.glb')) return { ok: false, status: 404 };
			return { ok: true, status: 200 };
		});
		await expect(
			assertWorldAssetsAvailable(parseWorldDocument(WORLD_FIXTURE), fetchImpl)
		).rejects.toBeInstanceOf(MissingAssetError);
		await expect(
			assertWorldAssetsAvailable(parseWorldDocument(WORLD_FIXTURE), fetchImpl)
		).rejects.toMatchObject({
			kind: 'glb',
			url: '/worlds/xela/xela.glb'
		});
	});

	it('load.ts source does not mention initGPU or PlayCanvas', () => {
		const path = fileURLToPath(new URL('./load.ts', import.meta.url));
		const src = readFileSync(path, 'utf8');
		expect(src).not.toMatch(/initGPU|createPlayCanvasApp|playcanvas/i);
	});
});
