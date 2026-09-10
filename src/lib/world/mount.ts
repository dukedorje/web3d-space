import type { WorldDocument } from './document.js';
import type { PlayCanvasApp } from '$lib/playcanvas/create-app.js';
import { log } from '$lib/log';

export async function mountWorld(pcApp: PlayCanvasApp, world: WorldDocument): Promise<void> {
	const { pc, app } = pcApp;

	const assets: Record<string, InstanceType<typeof pc.Asset>> = {
		hdri: new pc.Asset('world-hdri', 'texture', { url: world.hdri })
	};
	for (const entity of world.entities) {
		if (entity.glb) {
			assets[entity.id] = new pc.Asset(entity.id, 'container', { url: entity.glb });
		}
	}

	for (const asset of Object.values(assets)) {
		log('info', `load ${asset.name} ${asset.getFileUrl() ?? asset.name}`);
	}

	await new Promise<void>((resolve, reject) => {
		const failures: string[] = [];
		const onAssetError = (err: unknown, asset: InstanceType<typeof pc.Asset>) => {
			const url = asset.getFileUrl() ?? asset.name;
			const why = err instanceof Error ? err.message : String(err);
			failures.push(`${asset.name} (${url}): ${why}`);
			log('error', `asset ${asset.name} ${url} — ${why}`, err);
		};
		const onProgress = (asset: InstanceType<typeof pc.Asset>) => {
			log('info', `ok ${asset.name}`);
		};
		app.assets.on('error', onAssetError);
		const loader = new pc.AssetListLoader(Object.values(assets), app.assets);
		loader.on('progress', onProgress);
		loader.load((err: unknown, failed?: InstanceType<typeof pc.Asset>[]) => {
			app.assets.off('error', onAssetError);
			loader.off('progress', onProgress);
			if (!err) {
				log('info', `loaded ${Object.keys(assets).length} assets`);
				resolve();
				return;
			}
			const fromLoader = (failed ?? []).map((a) => `${a.name} (${a.getFileUrl() ?? '?'})`);
			const detail = [...new Set([...failures, ...fromLoader])].join('; ') || String(err);
			log('error', `AssetListLoader failed: ${detail}`);
			reject(new Error(detail));
		});
	});

	const hdriTex = assets.hdri.resource;
	if (hdriTex) {
		hdriTex.projection = pc.TEXTUREPROJECTION_EQUIRECT;
		hdriTex.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
		hdriTex.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
		const skybox = pc.EnvLighting.generateSkyboxCubemap(hdriTex, 512);
		const lighting = pc.EnvLighting.generateLightingSource(hdriTex, { size: 128 });
		app.scene.skybox = skybox;
		app.scene.skyboxIntensity = 0.8;
		app.scene.envAtlas = pc.EnvLighting.generateAtlas(lighting, { size: 256 });
		log('info', `skybox from ${world.hdri} (${hdriTex.width}x${hdriTex.height})`);
	} else {
		log('warn', `HDRI loaded but no texture resource: ${world.hdri}`);
	}

	for (const spec of world.entities) {
		const asset = assets[spec.id];
		if (!asset?.resource?.instantiateRenderEntity) {
			log('warn', `skip entity ${spec.id}: no renderable`);
			continue;
		}
		const entity = asset.resource.instantiateRenderEntity();
		entity.name = spec.id;
		if (spec.position) entity.setLocalPosition(...spec.position);
		if (spec.rotation) entity.setLocalEulerAngles(...spec.rotation);
		if (spec.scale) entity.setLocalScale(...spec.scale);
		app.root.addChild(entity);
		log('info', `entity ${spec.id}`);
	}

	const key = world.lights?.find((l) => l.type === 'directional');
	const sun = new pc.Entity('sun');
	sun.addComponent('light', {
		type: 'directional',
		intensity: key?.intensity ?? 1,
		castShadows: false
	});
	sun.setLocalEulerAngles(40, 30, 0);
	app.root.addChild(sun);
}

export function worldBounds(pcApp: PlayCanvasApp): {
	center: [number, number, number];
	half: [number, number, number];
} | null {
	const { app } = pcApp;
	let minX = Infinity,
		minY = Infinity,
		minZ = Infinity,
		maxX = -Infinity,
		maxY = -Infinity,
		maxZ = -Infinity;
	let found = false;
	for (const render of app.root.findComponents('render') as Array<{ meshInstances?: Array<{ aabb: { getMin(): { x: number; y: number; z: number }; getMax(): { x: number; y: number; z: number } } }> }>) {
		for (const mi of render.meshInstances ?? []) {
			const lo = mi.aabb.getMin();
			const hi = mi.aabb.getMax();
			found = true;
			minX = Math.min(minX, lo.x);
			minY = Math.min(minY, lo.y);
			minZ = Math.min(minZ, lo.z);
			maxX = Math.max(maxX, hi.x);
			maxY = Math.max(maxY, hi.y);
			maxZ = Math.max(maxZ, hi.z);
		}
	}
	if (!found) return null;
	return {
		center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
		half: [(maxX - minX) / 2, (maxY - minY) / 2, (maxZ - minZ) / 2]
	};
}
