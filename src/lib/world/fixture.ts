import type { WorldDocument } from './document.js';

/** Gallery-shaped fixture: HDRI, one GLB, one splat sidecar, camera, LOD. */
export const WORLD_FIXTURE: WorldDocument = {
	hdri: '/env/studio.hdr',
	entities: [
		{
			id: 'gallery',
			glb: '/models/vr-gallery.glb',
			position: [0, 0, 0],
			lodDistance: 80
		},
		{
			id: 'guitar',
			splat: '/splats/guitar.compressed.ply',
			position: [0, 0.8, 0],
			lodDistance: 25
		}
	],
	cameras: [
		{
			id: 'entry',
			position: [-3, 1.5, 2],
			yaw: 150,
			pitch: -5
		}
	],
	lights: [{ id: 'key', type: 'directional', intensity: 1 }]
};
