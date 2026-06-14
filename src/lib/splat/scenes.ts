const ASSET_BASE = 'https://raw.githubusercontent.com/playcanvas/engine/main/examples/assets';
const HF_CAKEWALK = 'https://huggingface.co/cakewalk/splat-data/resolve/main';

export type SceneCategory = 'environment' | 'object' | 'composite';

export type SceneStatusFn = (phase: string) => void;

export interface SplatSceneSetup {
	assets: Record<string, any>;
	build: () => void;
	/** Optional loader for resources outside the default AssetListLoader (side-loaded
	 *  JSON, binary, etc.). Runs in parallel with the asset load; report progress via onStatus. */
	prepare?: (onStatus: SceneStatusFn) => Promise<void>;
	/** Per-frame hook, called from the viewer movement loop with delta seconds and frame index. */
	update?: (dt: number, frame: number) => void;
	/** Teardown hook, called before the PlayCanvas app is destroyed. */
	cleanup?: () => void;
}

export interface SplatScene {
	slug: string;
	title: string;
	description: string;
	category: SceneCategory;
	tags: string[];
	camera: { position: [number, number, number]; yaw: number; pitch: number };
	setup: (pc: any, app: any) => SplatSceneSetup;
}

// ── Environments ──────────────────────────────────────────────

const environments: SplatScene[] = [
	{
		slug: 'apartment',
		title: 'Apartment',
		description: 'Full interior scan — fly through rooms, walls, and ceilings.',
		category: 'environment',
		tags: ['sog', '~5 MB'],
		camera: { position: [-8, 1.5, 2], yaw: 190, pitch: 0 },
		setup(pc, app) {
			const assets = {
				apartment: new pc.Asset('apartment', 'gsplat', {
					url: `${ASSET_BASE}/splats/apartment.sog`
				})
			};
			return {
				assets,
				build() {
					const e = new pc.Entity('apartment');
					e.addComponent('gsplat', { asset: assets.apartment });
					e.setLocalEulerAngles(180, 0, 0);
					app.root.addChild(e);
				}
			};
		}
	},
	{
		slug: 'bonsai',
		title: 'Bonsai',
		description: 'A bonsai tree on a table — compact scene from the MipNeRF360 dataset.',
		category: 'object',
		tags: ['sog', '~3 MB'],
		camera: { position: [4.9, 2.2, 0.1], yaw: 443, pitch: -28 },
		setup(pc, app) {
			const assets = {
				bonsai: new pc.Asset('bonsai', 'gsplat', {
					url: '/splats/bonsai.sog'
				})
			};
			return {
				assets,
				build() {
					const e = new pc.Entity('bonsai');
					e.addComponent('gsplat', { asset: assets.bonsai });
					e.setLocalEulerAngles(180, 0, 0);
					app.root.addChild(e);
				}
			};
		}
	},
];

// ── Objects ───────────────────────────────────────────────────

const objects: SplatScene[] = [
	{
		slug: 'bicycle',
		title: 'Bicycle',
		description: 'A bicycle captured with gaussian splatting.',
		category: 'object',
		tags: ['sog', '~14 MB'],
		camera: { position: [3.9, 1.1, 0.5], yaw: 441, pitch: -12 },
		setup(pc, app) {
			const assets = {
				bicycle: new pc.Asset('bicycle', 'gsplat', {
					url: `${ASSET_BASE}/splats/bicycle.sog`
				})
			};
			return {
				assets,
				build() {
					const e = new pc.Entity('bicycle');
					e.addComponent('gsplat', { asset: assets.bicycle });
					e.setLocalEulerAngles(180, 0, 0);
					app.root.addChild(e);
				}
			};
		}
	},
	{
		slug: 'guitar',
		title: 'Guitar',
		description: 'A single guitar captured with gaussian splatting.',
		category: 'object',
		tags: ['ply', '~1.5 MB'],
		camera: { position: [-2.8, -0.1, 2.6], yaw: 309, pitch: 23 },
		setup(pc, app) {
			const assets = {
				guitar: new pc.Asset('guitar', 'gsplat', {
					url: `${ASSET_BASE}/splats/guitar.compressed.ply`
				})
			};
			return {
				assets,
				build() {
					const e = new pc.Entity('guitar');
					e.addComponent('gsplat', { asset: assets.guitar });
					e.setLocalEulerAngles(0, 0, 180);
					app.root.addChild(e);
				}
			};
		}
	},
	{
		slug: 'biker',
		title: 'Biker',
		description: 'A biker figure — fine detail gaussian splat capture.',
		category: 'object',
		tags: ['ply', '~2.5 MB'],
		camera: { position: [0, 1, 3], yaw: 180, pitch: -5 },
		setup(pc, app) {
			const assets = {
				biker: new pc.Asset('biker', 'gsplat', {
					url: `${ASSET_BASE}/splats/biker.compressed.ply`
				})
			};
			return {
				assets,
				build() {
					const e = new pc.Entity('biker');
					e.addComponent('gsplat', { asset: assets.biker });
					e.setLocalEulerAngles(180, 90, 0);
					app.root.addChild(e);
				}
			};
		}
	},
	{
		slug: 'skull',
		title: 'Skull',
		description: 'A detailed skull rendered with gaussian splatting.',
		category: 'object',
		tags: ['sog', '~5 MB'],
		camera: { position: [-1.1, 2.4, 0.7], yaw: -59, pitch: -32 },
		setup(pc, app) {
			const assets = {
				skull: new pc.Asset('skull', 'gsplat', {
					url: `${ASSET_BASE}/splats/skull.sog`
				})
			};
			return {
				assets,
				build() {
					const e = new pc.Entity('skull');
					e.addComponent('gsplat', { asset: assets.skull });
					e.setLocalEulerAngles(180, 90, 0);
					app.root.addChild(e);
				}
			};
		}
	},
	{
		slug: 'hotel-sculpture',
		title: 'Hotel Sculpture',
		description: 'An ornate sculpture captured in a hotel lobby.',
		category: 'object',
		tags: ['ply', '~16 MB'],
		camera: { position: [4.7, 1.2, 0.7], yaw: 443, pitch: -13 },
		setup(pc, app) {
			const assets = {
				sculpture: new pc.Asset('hotel-sculpture', 'gsplat', {
					url: `${ASSET_BASE}/splats/hotel-culpture.compressed.ply`
				})
			};
			return {
				assets,
				build() {
					const e = new pc.Entity('hotel-sculpture');
					e.addComponent('gsplat', { asset: assets.sculpture });
					e.setLocalEulerAngles(180, 0, 0);
					app.root.addChild(e);
				}
			};
		}
	},
	{
		slug: 'nike',
		title: 'Nike Shoe',
		description: 'A sneaker — clean object capture from HuggingFace.',
		category: 'object',
		tags: ['sog', '~3 MB'],
		camera: { position: [1.8, -2.1, 2.0], yaw: 388, pitch: -2 },
		setup(pc, app) {
			const assets = {
				nike: new pc.Asset('nike', 'gsplat', {
					url: '/splats/nike.sog'
				})
			};
			return {
				assets,
				build() {
					const e = new pc.Entity('nike');
					e.addComponent('gsplat', { asset: assets.nike });
					e.setLocalEulerAngles(180, 0, 0);
					app.root.addChild(e);
				}
			};
		}
	},
	{
		slug: 'plush',
		title: 'Plush Toy',
		description: 'A plush toy — soft detail gaussian splat capture.',
		category: 'object',
		tags: ['sog', '~3.5 MB'],
		camera: { position: [0.5, -2.2, 2.7], yaw: 369, pitch: 4 },
		setup(pc, app) {
			const assets = {
				plush: new pc.Asset('plush', 'gsplat', {
					url: '/splats/plush.sog'
				})
			};
			return {
				assets,
				build() {
					const e = new pc.Entity('plush');
					e.addComponent('gsplat', { asset: assets.plush });
					e.setLocalEulerAngles(180, 0, 0);
					app.root.addChild(e);
				}
			};
		}
	}
];

// ── Composites (objects placed in environments) ───────────────

const composites: SplatScene[] = [
	{
		slug: 'vr-gallery',
		title: 'VR Gallery',
		description: 'Mesh room with splat objects on pedestals — guitar, biker, and skull.',
		category: 'composite',
		tags: ['mesh+splat', '~10 MB'],
		camera: { position: [-3, 1.5, 2], yaw: 150, pitch: -5 },
		setup(pc, app) {
			const assets = {
				gallery: new pc.Asset('gallery', 'container', {
					url: `${ASSET_BASE}/models/vr-gallery.glb`
				}),
				guitar: new pc.Asset('guitar', 'gsplat', {
					url: `${ASSET_BASE}/splats/guitar.compressed.ply`
				}),
				biker: new pc.Asset('biker', 'gsplat', {
					url: `${ASSET_BASE}/splats/biker.compressed.ply`
				}),
				skull: new pc.Asset('skull', 'gsplat', {
					url: `${ASSET_BASE}/splats/skull.sog`
				})
			};
			return {
				assets,
				build() {
					const galleryEntity = assets.gallery.resource.instantiateRenderEntity();
					app.root.addChild(galleryEntity);

					const guitar = new pc.Entity('guitar');
					guitar.addComponent('gsplat', { asset: assets.guitar });
					guitar.setLocalPosition(0, 0.8, 0);
					guitar.setLocalEulerAngles(0, 0, 180);
					guitar.setLocalScale(0.4, 0.4, 0.4);
					app.root.addChild(guitar);

					const biker = new pc.Entity('biker');
					biker.addComponent('gsplat', { asset: assets.biker });
					biker.setLocalPosition(-1.5, 0.05, 0);
					biker.setLocalEulerAngles(180, 90, 0);
					biker.setLocalScale(0.7, 0.7, 0.7);
					app.root.addChild(biker);

					const skull = new pc.Entity('skull');
					skull.addComponent('gsplat', { asset: assets.skull });
					skull.setLocalPosition(1.5, 0.05, 0);
					skull.setLocalEulerAngles(180, 90, 0);
					skull.setLocalScale(0.7, 0.7, 0.7);
					skull.rotate(0, 150, 0);
					app.root.addChild(skull);
				}
			};
		}
	},
	{
		slug: 'apartment-showroom',
		title: 'Apartment Showroom',
		description: 'Objects placed inside the apartment scan — guitar on the table, shoe on the floor.',
		category: 'composite',
		tags: ['multi-splat', '~15 MB'],
		camera: { position: [0, 1.5, 3], yaw: 0, pitch: 0 },
		setup(pc, app) {
			const assets = {
				apartment: new pc.Asset('apartment', 'gsplat', {
					url: `${ASSET_BASE}/splats/apartment.sog`
				}),
				guitar: new pc.Asset('guitar', 'gsplat', {
					url: `${ASSET_BASE}/splats/guitar.compressed.ply`
				}),
				nike: new pc.Asset('nike', 'gsplat', {
					url: `${HF_CAKEWALK}/nike.splat`
				})
			};
			return {
				assets,
				build() {
					const apt = new pc.Entity('apartment');
					apt.addComponent('gsplat', { asset: assets.apartment });
					app.root.addChild(apt);

					const guitar = new pc.Entity('guitar');
					guitar.addComponent('gsplat', { asset: assets.guitar });
					guitar.setLocalPosition(0.5, 0.75, -1);
					guitar.setLocalEulerAngles(0, 0, 180);
					guitar.setLocalScale(0.3, 0.3, 0.3);
					app.root.addChild(guitar);

					const nike = new pc.Entity('nike');
					nike.addComponent('gsplat', { asset: assets.nike });
					nike.setLocalPosition(-1, 0.05, 0.5);
					nike.setLocalScale(0.5, 0.5, 0.5);
					app.root.addChild(nike);
				}
			};
		}
	}
];

export const scenes: SplatScene[] = [...composites, ...environments, ...objects];

export function getScene(slug: string): SplatScene | undefined {
	return scenes.find((s) => s.slug === slug);
}

export function getScenesByCategory(category: SceneCategory): SplatScene[] {
	return scenes.filter((s) => s.category === category);
}
