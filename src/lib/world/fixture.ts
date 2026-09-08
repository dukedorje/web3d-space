import type { WorldDocument } from './document.js';

/** Dreamballz XELA vessel + dingdong sky, pulled onto LFS. */
export const WORLD_FIXTURE: WorldDocument = {
	hdri: '/worlds/xela/planet-atmosphere.png',
	entities: [
		{
			id: 'xela',
			glb: '/worlds/xela/xela.glb',
			position: [0, 0, 0],
			lodDistance: 200
		}
	],
	cameras: [
		{
			id: 'entry',
			position: [0, 3, 14],
			yaw: 180,
			pitch: -8
		}
	],
	lights: [{ id: 'key', type: 'directional', intensity: 1 }]
};
