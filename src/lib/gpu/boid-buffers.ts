/// <reference types="@webgpu/types" />

/** Bytes per boid: vec3f(12) + pad(4) + vec3f(12) + pad(4) + pad(12) = 48 */
export const BYTES_PER_BOID = 48;

/** Bytes per boid config: 12 fields x 4 bytes = 48 (16-byte aligned) */
export const BYTES_PER_CONFIG = 48;

/** World bounds: cube from -HALF_EXTENT to +HALF_EXTENT on each axis */
export const HALF_EXTENT = 50;

/** Workgroup size matching the compute shader */
export const WORKGROUP_SIZE = 64;

/** GPUShaderStage.COMPUTE = 0x4 — defined as a constant to avoid runtime reference in non-browser environments */
const SHADER_STAGE_COMPUTE = 0x4;

/**
 * Bind group layout descriptor shared by buffer creation and pipeline creation.
 * Bindings: 0=boidsIn, 1=boidsOut, 2=uniforms, 3=configBuffer
 */
export const BOID_BIND_GROUP_LAYOUT_DESCRIPTOR: GPUBindGroupLayoutDescriptor = {
	label: 'boid-bind-group-layout',
	entries: [
		{
			binding: 0,
			visibility: SHADER_STAGE_COMPUTE,
			buffer: { type: 'read-only-storage' }
		},
		{
			binding: 1,
			visibility: SHADER_STAGE_COMPUTE,
			buffer: { type: 'storage' }
		},
		{
			binding: 2,
			visibility: SHADER_STAGE_COMPUTE,
			buffer: { type: 'uniform' }
		},
		{
			binding: 3,
			visibility: SHADER_STAGE_COMPUTE,
			buffer: { type: 'storage' }
		}
	]
};

/**
 * Uniform buffer layout (all offsets in bytes):
 *   deltaTime:            f32      (offset  0)
 *   boidCount:            u32      (offset  4)
 *   worldSize:            f32      (offset  8)
 *   maxForce:             f32      (offset 12)
 *   viewProjectionMatrix: mat4x4f  (offset 16)  — 64 bytes
 *   selectedBoidIndex:    u32      (offset 80)
 *   totalTime:            f32      (offset 84)
 *   _pad0:                f32      (offset 88)
 *   _pad1:                f32      (offset 92)
 *   Total: 96 bytes (16-byte aligned)
 *
 * Steering weights (separation, alignment, cohesion, perceptionRadius,
 * separationRadius, maxSpeed) moved to per-boid config buffer in sprint 002.
 */
export const UNIFORM_BUFFER_SIZE = 96;

/** Byte offset of viewProjectionMatrix in the uniform buffer. */
export const VP_MATRIX_OFFSET = 16;

/** Byte offset of selectedBoidIndex (u32) in the uniform buffer. */
export const SELECTED_BOID_INDEX_OFFSET = 80;

/** Byte offset of totalTime (f32) in the uniform buffer. */
export const TOTAL_TIME_OFFSET = 84;

/** Sentinel value meaning no boid is selected. */
export const NO_BOID_SELECTED = 0xFFFFFFFF;

export interface BoidBuffers {
	/** Ping-pong storage buffers [A, B] */
	readonly storage: readonly [GPUBuffer, GPUBuffer];
	/** Per-boid config buffer (personality parameters) */
	readonly config: GPUBuffer;
	/** Uniform buffer for deltaTime, boidCount, worldSize, maxForce, VP matrix */
	readonly uniform: GPUBuffer;
	/** Bind group layout for the compute pipeline */
	readonly bindGroupLayout: GPUBindGroupLayout;
	/** Bind groups [even-frame, odd-frame]: group[N % 2] reads from storage[N % 2] */
	readonly bindGroups: readonly [GPUBindGroup, GPUBindGroup];
	/** Number of boids */
	readonly count: number;
}

/**
 * Generate initial boid data: random positions in [-HALF_EXTENT, HALF_EXTENT]
 * and random velocities in [-1, 1] per component.
 *
 * Layout per boid (48 bytes / 12 floats):
 *   [px, py, pz, _pad0, vx, vy, vz, _pad1(u32), _pad2, _pad3, _pad4, _pad5]
 */
export function initializeBoidData(count: number): Float32Array {
	const floatsPerBoid = BYTES_PER_BOID / 4; // 12
	const data = new Float32Array(count * floatsPerBoid);

	for (let i = 0; i < count; i++) {
		const offset = i * floatsPerBoid;
		// position: spawn in smaller volume so boids can see each other
		data[offset + 0] = (Math.random() * 2 - 1) * HALF_EXTENT * 0.5;
		data[offset + 1] = (Math.random() * 2 - 1) * HALF_EXTENT * 0.5;
		data[offset + 2] = (Math.random() * 2 - 1) * HALF_EXTENT * 0.5;
		data[offset + 3] = 0; // _pad0
		// velocity: random direction with meaningful speed (5-15 units/s)
		const speed = 5 + Math.random() * 10;
		const theta = Math.random() * Math.PI * 2;
		const phi = Math.acos(Math.random() * 2 - 1);
		data[offset + 4] = Math.sin(phi) * Math.cos(theta) * speed;
		data[offset + 5] = Math.sin(phi) * Math.sin(theta) * speed;
		data[offset + 6] = Math.cos(phi) * speed;
		// padding (offsets 7-11) default to 0
	}

	return data;
}

/** Default flocker config values for BoidConfig struct initialization. */
export const DEFAULT_FLOCKER_CONFIG = {
	separationWeight: 1.5,
	alignmentWeight: 1.0,
	cohesionWeight: 1.0,
	perceptionRadius: 15.0,
	separationRadius: 5.0,
	maxSpeed: 25.0,
	wanderStrength: 0.0,
	crowdSpeedBoost: 1.5,
	personalityType: 0, // Flocker
	experienceTimer: 0.0,
	stressLevel: 0.0,
} as const;

/**
 * Generate initial config buffer data: all boids get default flocker config.
 * For personality-distributed configs, use initializeConfigBuffer() from
 * personality-templates.ts instead.
 *
 * Layout per boid config (48 bytes / 12 floats):
 *   [separationWeight, alignmentWeight, cohesionWeight, perceptionRadius,
 *    separationRadius, maxSpeed, wanderStrength, crowdSpeedBoost,
 *    personalityType(u32), experienceTimer, stressLevel, _padding]
 */
export function initializeConfigData(count: number): Float32Array {
	const floatsPerConfig = BYTES_PER_CONFIG / 4; // 12
	const data = new Float32Array(count * floatsPerConfig);
	const u32View = new Uint32Array(data.buffer);
	const c = DEFAULT_FLOCKER_CONFIG;

	for (let i = 0; i < count; i++) {
		const offset = i * floatsPerConfig;
		data[offset + 0] = c.separationWeight;
		data[offset + 1] = c.alignmentWeight;
		data[offset + 2] = c.cohesionWeight;
		data[offset + 3] = c.perceptionRadius;
		data[offset + 4] = c.separationRadius;
		data[offset + 5] = c.maxSpeed;
		data[offset + 6] = c.wanderStrength;
		data[offset + 7] = c.crowdSpeedBoost;
		u32View[offset + 8] = c.personalityType;
		data[offset + 9] = c.experienceTimer;
		data[offset + 10] = c.stressLevel;
		data[offset + 11] = 0.0; // _padding
	}

	return data;
}

/**
 * Write config data to an existing GPU config buffer.
 * Use this for runtime distribution changes without recreating all buffers.
 */
export function writeConfigBuffer(
	device: GPUDevice,
	configBuffer: GPUBuffer,
	configData: Float32Array
): void {
	device.queue.writeBuffer(configBuffer, 0, configData.buffer);
}

/**
 * Create ping-pong boid storage buffers, config buffer, uniform buffer,
 * bind group layout, and both bind groups for even/odd frame dispatch.
 *
 * @param configData Optional pre-built config data (e.g. from initializeConfigBuffer
 *   in personality-templates.ts). Falls back to all-flocker config if not provided.
 */
export function createBoidBuffers(
	device: GPUDevice,
	count: number,
	configData?: Float32Array
): BoidBuffers {
	const bufferSize = count * BYTES_PER_BOID;
	const configSize = count * BYTES_PER_CONFIG;
	const initialData = initializeBoidData(count);
	const initialConfig = configData ?? initializeConfigData(count);

	const storageA = device.createBuffer({
		label: 'boid-storage-A',
		size: bufferSize,
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
		mappedAtCreation: false
	});

	const storageB = device.createBuffer({
		label: 'boid-storage-B',
		size: bufferSize,
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
		mappedAtCreation: false
	});

	// Upload initial data to buffer A
	device.queue.writeBuffer(storageA, 0, initialData.buffer);
	// Copy A -> B so both buffers start with the same data
	const encoder = device.createCommandEncoder({ label: 'boid-init-copy' });
	encoder.copyBufferToBuffer(storageA, 0, storageB, 0, bufferSize);
	device.queue.submit([encoder.finish()]);

	const configBuffer = device.createBuffer({
		label: 'boid-config',
		size: configSize,
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
	});
	device.queue.writeBuffer(configBuffer, 0, initialConfig.buffer);

	const uniformBuffer = device.createBuffer({
		label: 'boid-uniforms',
		size: UNIFORM_BUFFER_SIZE,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
	});

	const bindGroupLayout = device.createBindGroupLayout(BOID_BIND_GROUP_LAYOUT_DESCRIPTOR);

	// Even frame: read A, write B
	const bindGroupEven = device.createBindGroup({
		label: 'boid-bind-group-even',
		layout: bindGroupLayout,
		entries: [
			{ binding: 0, resource: { buffer: storageA } },
			{ binding: 1, resource: { buffer: storageB } },
			{ binding: 2, resource: { buffer: uniformBuffer } },
			{ binding: 3, resource: { buffer: configBuffer } }
		]
	});

	// Odd frame: read B, write A
	const bindGroupOdd = device.createBindGroup({
		label: 'boid-bind-group-odd',
		layout: bindGroupLayout,
		entries: [
			{ binding: 0, resource: { buffer: storageB } },
			{ binding: 1, resource: { buffer: storageA } },
			{ binding: 2, resource: { buffer: uniformBuffer } },
			{ binding: 3, resource: { buffer: configBuffer } }
		]
	});

	return {
		storage: [storageA, storageB] as const,
		config: configBuffer,
		uniform: uniformBuffer,
		bindGroupLayout,
		bindGroups: [bindGroupEven, bindGroupOdd] as const,
		count
	};
}

/** Default simulation parameters (uniforms that remain global, not per-boid). */
export const DEFAULT_SIM_PARAMS = {
	maxForce: 5.0,
	worldSize: HALF_EXTENT * 2
} as const;

export interface SimParams {
	maxForce?: number;
	worldSize?: number;
}

/**
 * Pack uniform data into a correctly-laid-out ArrayBuffer.
 * Layout: deltaTime(f32), boidCount(u32), worldSize(f32), maxForce(f32),
 *         VP(mat4x4f), selectedBoidIndex(u32), totalTime(f32), _pad(2xf32)
 * Useful for testing without a GPU device.
 */
export function packUniforms(
	deltaTime: number,
	boidCount: number,
	params?: SimParams
): ArrayBuffer {
	const p = { ...DEFAULT_SIM_PARAMS, ...params };
	const data = new ArrayBuffer(UNIFORM_BUFFER_SIZE);
	const f32 = new Float32Array(data);
	const u32 = new Uint32Array(data);
	f32[0] = deltaTime;
	u32[1] = boidCount;
	f32[2] = p.worldSize;
	f32[3] = p.maxForce;
	// Offsets 4-19 (bytes 16-79): VP matrix — left zeroed, written separately
	u32[20] = NO_BOID_SELECTED; // selectedBoidIndex at byte 80
	f32[21] = 0.0; // totalTime at byte 84
	return data;
}

/**
 * Write uniform data (deltaTime, boidCount, worldSize, maxForce) to the uniform buffer.
 */
export function writeUniforms(
	device: GPUDevice,
	uniformBuffer: GPUBuffer,
	deltaTime: number,
	boidCount: number,
	params?: SimParams
): void {
	const data = packUniforms(deltaTime, boidCount, params);
	device.queue.writeBuffer(uniformBuffer, 0, data);
}

/**
 * Write selection-related uniforms (selectedBoidIndex + totalTime) at byte offset 80.
 */
export function writeSelectionUniforms(
	device: GPUDevice,
	uniformBuffer: GPUBuffer,
	selectedBoidIndex: number,
	totalTime: number
): void {
	const data = new ArrayBuffer(16); // 4 values x 4 bytes, 16-byte aligned write
	const u32 = new Uint32Array(data);
	const f32 = new Float32Array(data);
	u32[0] = selectedBoidIndex;
	f32[1] = totalTime;
	// f32[2], f32[3] are padding (zero)
	device.queue.writeBuffer(uniformBuffer, SELECTED_BOID_INDEX_OFFSET, data);
}

/**
 * Destroy old boid buffers and create new ones with the given count.
 * Callers must update any bind groups / cleanup handles that referenced the old buffers.
 */
export function recreateBoidBuffers(
	device: GPUDevice,
	old: BoidBuffers,
	newCount: number,
	configData?: Float32Array
): BoidBuffers {
	old.storage[0].destroy();
	old.storage[1].destroy();
	old.config.destroy();
	old.uniform.destroy();
	return createBoidBuffers(device, newCount, configData);
}

/**
 * Write a view-projection matrix (Float32Array of 16 floats = 64 bytes)
 * to the uniform buffer at VP_MATRIX_OFFSET.
 */
export function writeCameraMatrix(
	device: GPUDevice,
	uniformBuffer: GPUBuffer,
	vpMatrix: Float32Array
): void {
	device.queue.writeBuffer(uniformBuffer, VP_MATRIX_OFFSET, vpMatrix.buffer);
}
