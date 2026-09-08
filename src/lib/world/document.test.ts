import { describe, it, expect } from 'vitest';
import { parseWorldDocument, serializeWorldDocument, WorldDocumentError } from './document.js';
import { WORLD_FIXTURE } from './fixture.js';

describe('parseWorldDocument', () => {
	it('parses a fixture with HDRI, GLB, camera, and LOD', () => {
		const doc = parseWorldDocument(WORLD_FIXTURE);
		expect(doc.hdri).toBe('/env/studio.hdr');
		expect(doc.entities[0]?.glb).toBe('/models/vr-gallery.glb');
		expect(doc.entities[0]?.lodDistance).toBe(80);
		expect(doc.cameras[0]?.id).toBe('entry');
	});

	it('rejects a document with no GLB', () => {
		expect(() =>
			parseWorldDocument({
				...WORLD_FIXTURE,
				entities: [{ id: 'only-splat', splat: '/a.ply', lodDistance: 10 }]
			})
		).toThrow(WorldDocumentError);
	});

	it('rejects missing HDRI', () => {
		const { hdri: _drop, ...rest } = WORLD_FIXTURE;
		expect(() => parseWorldDocument(rest)).toThrow(/hdri/);
	});
});

describe('round-trip', () => {
	it('serializes a fixture back to an equivalent document', () => {
		const once = parseWorldDocument(WORLD_FIXTURE);
		const twice = serializeWorldDocument(once);
		expect(twice.hdri).toBe(once.hdri);
		expect(twice.entities.map((e) => e.glb)).toEqual(once.entities.map((e) => e.glb));
		expect(twice.cameras.map((c) => c.id)).toEqual(once.cameras.map((c) => c.id));
		expect(twice.entities.map((e) => e.lodDistance)).toEqual(once.entities.map((e) => e.lodDistance));
	});
});
