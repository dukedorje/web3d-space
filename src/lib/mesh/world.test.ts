import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { parseWorldDocument, WorldDocumentError } from '$lib/world/document.js';
import { WORLD_FIXTURE } from '$lib/world/fixture.js';
import { MissingAssetError } from '$lib/world/load.js';
import { FIXTURE_WALK, paintGrid } from './coverage.js';
import { loadMeshWorldDocument, skipWorldDocument } from './world.js';

describe('skipWorldDocument', () => {
	it('loads the world by default', () => {
		expect(skipWorldDocument(new URLSearchParams())).toBe(false);
		expect(skipWorldDocument('')).toBe(false);
		expect(skipWorldDocument('world=1')).toBe(false);
	});

	it('skips on noworld or world=0', () => {
		expect(skipWorldDocument(new URLSearchParams('noworld'))).toBe(true);
		expect(skipWorldDocument('noworld=1')).toBe(true);
		expect(skipWorldDocument('world=0')).toBe(true);
		expect(skipWorldDocument('world=off')).toBe(true);
		expect(skipWorldDocument('world=false')).toBe(true);
		expect(skipWorldDocument('world=skip')).toBe(true);
	});
});

describe('loadMeshWorldDocument', () => {
	it('parses the fixture HDRI + GLB when assets probe ok', async () => {
		const fetchImpl = vi.fn(async () => ({ ok: true, status: 200 }));
		const doc = await loadMeshWorldDocument({ fetch: fetchImpl });
		expect(doc).not.toBeNull();
		expect(doc?.hdri).toBe('/worlds/xela/planet-atmosphere.png');
		expect(doc?.entities[0]?.glb).toBe('/worlds/xela/xela.glb');
		expect(parseWorldDocument(WORLD_FIXTURE).entities[0]?.id).toBe(doc?.entities[0]?.id);
		const urls = fetchImpl.mock.calls.map((c) => c[0]);
		expect(urls).toContain('/worlds/xela/planet-atmosphere.png');
		expect(urls).toContain('/worlds/xela/xela.glb');
	});

	it('returns null when skipped so coverage can boot alone', async () => {
		const fetchImpl = vi.fn(async () => ({ ok: true, status: 200 }));
		await expect(loadMeshWorldDocument({ skip: true, fetch: fetchImpl })).resolves.toBeNull();
		expect(fetchImpl).not.toHaveBeenCalled();
		const grid = paintGrid(FIXTURE_WALK);
		expect(grid.completeness).toBeGreaterThan(0);
		expect(grid.covered).toBeGreaterThan(0);
	});

	it('fails with WorldDocumentError for a missing GLB', async () => {
		const fetchImpl = vi.fn(async (url: string) => {
			if (String(url).endsWith('.glb')) return { ok: false, status: 404 };
			return { ok: true, status: 200 };
		});
		const rejected = loadMeshWorldDocument({ fetch: fetchImpl });
		await expect(rejected).rejects.toBeInstanceOf(WorldDocumentError);
		await expect(loadMeshWorldDocument({ fetch: fetchImpl })).rejects.toBeInstanceOf(
			MissingAssetError
		);
		await expect(loadMeshWorldDocument({ fetch: fetchImpl })).rejects.toMatchObject({
			kind: 'glb',
			url: '/worlds/xela/xela.glb',
			name: 'MissingAssetError'
		});
		const grid = paintGrid(FIXTURE_WALK);
		expect(grid.completeness).toBeGreaterThan(0);
	});
});

describe('coverage paint stays independent of the world overlay', () => {
	it('still scores the fixture walk while a world document is in hand', () => {
		const world = parseWorldDocument(WORLD_FIXTURE);
		expect(world.hdri.length).toBeGreaterThan(0);
		expect(world.entities.some((e) => e.glb)).toBe(true);
		const grid = paintGrid(FIXTURE_WALK);
		expect(grid.cells.some((c) => c.state === 'covered')).toBe(true);
		expect(grid.completeness).toBeGreaterThan(0);
		expect(grid.completeness).toBeLessThan(1);
	});
});

describe('not a NeRF trainer', () => {
	it('mesh world overlay does not import a GPU kernel or trainer', () => {
		const path = fileURLToPath(new URL('./world.ts', import.meta.url));
		const src = readFileSync(path, 'utf8');
		expect(src).not.toMatch(/initGPU|createPlayCanvasApp|nerfstudio|instant-ngp|mlp/i);
		expect(src).toMatch(/parseWorldDocument/);
		expect(src).toMatch(/WORLD_FIXTURE/);
	});
});
