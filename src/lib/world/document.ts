export type Vec3 = [number, number, number];

export interface WorldCamera {
	id: string;
	position: Vec3;
	yaw: number;
	pitch: number;
}

export interface WorldLight {
	id: string;
	type: 'directional' | 'point' | 'ambient';
	position?: Vec3;
	color?: Vec3;
	intensity?: number;
}

export interface WorldEntity {
	id: string;
	/** Imported mesh (photogrammetry enters here as GLB). */
	glb?: string;
	/** Sidecar splat cache URL, or omit when using KHR_gaussian_splatting in the GLB. */
	splat?: string;
	position?: Vec3;
	rotation?: Vec3;
	scale?: Vec3;
	lodDistance: number;
}

export interface WorldDocument {
	hdri: string;
	entities: WorldEntity[];
	cameras: WorldCamera[];
	lights?: WorldLight[];
}

export class WorldDocumentError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'WorldDocumentError';
	}
}

function isVec3(value: unknown): value is Vec3 {
	return (
		Array.isArray(value) &&
		value.length === 3 &&
		value.every((n) => typeof n === 'number' && Number.isFinite(n))
	);
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		throw new WorldDocumentError(`${label} must be an object`);
	}
	return value as Record<string, unknown>;
}

function asString(value: unknown, label: string): string {
	if (typeof value !== 'string' || value.trim() === '') {
		throw new WorldDocumentError(`${label} must be a non-empty string`);
	}
	return value;
}

function asFiniteNumber(value: unknown, label: string): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		throw new WorldDocumentError(`${label} must be a finite number`);
	}
	return value;
}

function parseEntity(raw: unknown, index: number): WorldEntity {
	const obj = asRecord(raw, `entities[${index}]`);
	const entity: WorldEntity = {
		id: asString(obj.id, `entities[${index}].id`),
		lodDistance: asFiniteNumber(obj.lodDistance, `entities[${index}].lodDistance`)
	};
	if (obj.glb !== undefined) entity.glb = asString(obj.glb, `entities[${index}].glb`);
	if (obj.splat !== undefined) entity.splat = asString(obj.splat, `entities[${index}].splat`);
	if (obj.position !== undefined) {
		if (!isVec3(obj.position)) throw new WorldDocumentError(`entities[${index}].position must be [x,y,z]`);
		entity.position = obj.position;
	}
	if (obj.rotation !== undefined) {
		if (!isVec3(obj.rotation)) throw new WorldDocumentError(`entities[${index}].rotation must be [x,y,z]`);
		entity.rotation = obj.rotation;
	}
	if (obj.scale !== undefined) {
		if (!isVec3(obj.scale)) throw new WorldDocumentError(`entities[${index}].scale must be [x,y,z]`);
		entity.scale = obj.scale;
	}
	if (!entity.glb && !entity.splat) {
		throw new WorldDocumentError(`entities[${index}] must name a glb or splat URL`);
	}
	return entity;
}

function parseCamera(raw: unknown, index: number): WorldCamera {
	const obj = asRecord(raw, `cameras[${index}]`);
	if (!isVec3(obj.position)) {
		throw new WorldDocumentError(`cameras[${index}].position must be [x,y,z]`);
	}
	return {
		id: asString(obj.id, `cameras[${index}].id`),
		position: obj.position,
		yaw: asFiniteNumber(obj.yaw, `cameras[${index}].yaw`),
		pitch: asFiniteNumber(obj.pitch, `cameras[${index}].pitch`)
	};
}

function parseLight(raw: unknown, index: number): WorldLight {
	const obj = asRecord(raw, `lights[${index}]`);
	const type = asString(obj.type, `lights[${index}].type`);
	if (type !== 'directional' && type !== 'point' && type !== 'ambient') {
		throw new WorldDocumentError(`lights[${index}].type must be directional, point, or ambient`);
	}
	const light: WorldLight = {
		id: asString(obj.id, `lights[${index}].id`),
		type
	};
	if (obj.position !== undefined) {
		if (!isVec3(obj.position)) throw new WorldDocumentError(`lights[${index}].position must be [x,y,z]`);
		light.position = obj.position;
	}
	if (obj.color !== undefined) {
		if (!isVec3(obj.color)) throw new WorldDocumentError(`lights[${index}].color must be [r,g,b]`);
		light.color = obj.color;
	}
	if (obj.intensity !== undefined) {
		light.intensity = asFiniteNumber(obj.intensity, `lights[${index}].intensity`);
	}
	return light;
}

export function parseWorldDocument(raw: unknown): WorldDocument {
	const obj = asRecord(raw, 'world');
	const hdri = asString(obj.hdri, 'hdri');
	if (!Array.isArray(obj.entities) || obj.entities.length === 0) {
		throw new WorldDocumentError('entities must be a non-empty array');
	}
	if (!Array.isArray(obj.cameras) || obj.cameras.length === 0) {
		throw new WorldDocumentError('cameras must be a non-empty array');
	}
	const entities = obj.entities.map(parseEntity);
	if (!entities.some((e) => e.glb)) {
		throw new WorldDocumentError('at least one entity must name a glb');
	}
	const cameras = obj.cameras.map(parseCamera);
	const doc: WorldDocument = { hdri, entities, cameras };
	if (obj.lights !== undefined) {
		if (!Array.isArray(obj.lights)) {
			throw new WorldDocumentError('lights must be an array when present');
		}
		doc.lights = obj.lights.map(parseLight);
	}
	return doc;
}

export function serializeWorldDocument(doc: WorldDocument): WorldDocument {
	return parseWorldDocument(JSON.parse(JSON.stringify(doc)));
}
