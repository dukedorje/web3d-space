/// <reference types="@webgpu/types" />

import { BYTES_PER_BOID } from './boid-buffers.js';

/**
 * Read all boid positions from the GPU storage buffer via a staging buffer.
 *
 * This is a one-time readback triggered on click, NOT per-frame.
 * Creates a staging buffer, copies data, maps it, and returns the raw Float32Array.
 *
 * @param device - GPU device
 * @param storageBuffer - Active boid storage buffer (ping or pong)
 * @param count - Number of boids
 * @returns Float32Array containing the full boid state data
 */
export async function readBoidPositions(
	device: GPUDevice,
	storageBuffer: GPUBuffer,
	count: number
): Promise<Float32Array> {
	const size = count * BYTES_PER_BOID;

	const stagingBuffer = device.createBuffer({
		label: 'boid-picking-staging',
		size,
		usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
	});

	const encoder = device.createCommandEncoder({ label: 'picking-copy' });
	encoder.copyBufferToBuffer(storageBuffer, 0, stagingBuffer, 0, size);
	device.queue.submit([encoder.finish()]);

	await device.queue.onSubmittedWorkDone();
	await stagingBuffer.mapAsync(GPUMapMode.READ);

	const data = new Float32Array(stagingBuffer.getMappedRange().slice(0));
	stagingBuffer.unmap();
	stagingBuffer.destroy();

	return data;
}

/**
 * Read config data for a single boid from the GPU config buffer.
 *
 * @param device - GPU device
 * @param configBuffer - Config storage buffer
 * @param boidIndex - Index of the boid to read
 * @param bytesPerConfig - Bytes per config entry (default 48)
 * @returns Float32Array of 12 floats for the boid's config
 */
export async function readBoidConfig(
	device: GPUDevice,
	configBuffer: GPUBuffer,
	boidIndex: number,
	bytesPerConfig: number = 48
): Promise<Float32Array> {
	const offset = boidIndex * bytesPerConfig;
	const size = bytesPerConfig;

	const stagingBuffer = device.createBuffer({
		label: 'config-picking-staging',
		size,
		usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
	});

	const encoder = device.createCommandEncoder({ label: 'config-copy' });
	encoder.copyBufferToBuffer(configBuffer, offset, stagingBuffer, 0, size);
	device.queue.submit([encoder.finish()]);

	await device.queue.onSubmittedWorkDone();
	await stagingBuffer.mapAsync(GPUMapMode.READ);

	const data = new Float32Array(stagingBuffer.getMappedRange().slice(0));
	stagingBuffer.unmap();
	stagingBuffer.destroy();

	return data;
}

/**
 * Find the nearest boid to a world-space ray using point-to-ray distance.
 *
 * @param boidData - Full boid state Float32Array from readBoidPositions
 * @param rayOrigin - Ray origin in world space [x, y, z]
 * @param rayDir - Normalized ray direction [x, y, z]
 * @param count - Number of boids
 * @param maxDistance - Maximum distance threshold for selection (world units)
 * @returns Index of the nearest boid, or -1 if none within threshold
 */
export function findNearestBoidToRay(
	boidData: Float32Array,
	rayOrigin: Float32Array | number[],
	rayDir: Float32Array | number[],
	count: number,
	maxDistance: number = 3.0
): number {
	const floatsPerBoid = BYTES_PER_BOID / 4; // 12
	let bestIndex = -1;
	let bestDist = maxDistance;

	const ox = rayOrigin[0],
		oy = rayOrigin[1],
		oz = rayOrigin[2];
	const dx = rayDir[0],
		dy = rayDir[1],
		dz = rayDir[2];

	for (let i = 0; i < count; i++) {
		const offset = i * floatsPerBoid;
		// Boid position is at offsets 0, 1, 2
		const px = boidData[offset + 0] - ox;
		const py = boidData[offset + 1] - oy;
		const pz = boidData[offset + 2] - oz;

		// Project point onto ray: t = dot(p, d)
		const t = px * dx + py * dy + pz * dz;
		if (t < 0) continue; // Behind camera

		// Closest point on ray to boid
		const cx = t * dx - px;
		const cy = t * dy - py;
		const cz = t * dz - pz;
		const dist = Math.sqrt(cx * cx + cy * cy + cz * cz);

		if (dist < bestDist) {
			bestDist = dist;
			bestIndex = i;
		}
	}

	return bestIndex;
}

/**
 * Convert screen coordinates to a world-space ray using the inverse VP matrix.
 *
 * @param screenX - Click X in CSS pixels
 * @param screenY - Click Y in CSS pixels
 * @param canvas - The canvas element (for dimensions)
 * @param inverseVPMatrix - 16-float inverse view-projection matrix
 * @returns Object with rayOrigin and rayDir as Float32Array[3]
 */
export function screenToRay(
	screenX: number,
	screenY: number,
	canvas: HTMLCanvasElement,
	inverseVPMatrix: Float32Array
): { rayOrigin: Float32Array; rayDir: Float32Array } {
	// Convert screen to NDC: x in [-1, 1], y in [-1, 1] (flip Y for WebGPU)
	const rect = canvas.getBoundingClientRect();
	const ndcX = ((screenX - rect.left) / rect.width) * 2 - 1;
	const ndcY = 1 - ((screenY - rect.top) / rect.height) * 2;

	// Unproject near point (z=0 in WebGPU NDC) and far point (z=1)
	const nearWorld = unprojectPoint(ndcX, ndcY, 0.0, inverseVPMatrix);
	const farWorld = unprojectPoint(ndcX, ndcY, 1.0, inverseVPMatrix);

	// Ray direction = normalize(far - near)
	const dirX = farWorld[0] - nearWorld[0];
	const dirY = farWorld[1] - nearWorld[1];
	const dirZ = farWorld[2] - nearWorld[2];
	const len = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);

	const rayOrigin = new Float32Array([nearWorld[0], nearWorld[1], nearWorld[2]]);
	const rayDir = new Float32Array([dirX / len, dirY / len, dirZ / len]);

	return { rayOrigin, rayDir };
}

/**
 * Unproject a point from NDC to world space using the inverse VP matrix.
 */
function unprojectPoint(
	ndcX: number,
	ndcY: number,
	ndcZ: number,
	invVP: Float32Array
): [number, number, number] {
	// Multiply [ndcX, ndcY, ndcZ, 1] by the inverse VP matrix
	const x = invVP[0] * ndcX + invVP[4] * ndcY + invVP[8] * ndcZ + invVP[12];
	const y = invVP[1] * ndcX + invVP[5] * ndcY + invVP[9] * ndcZ + invVP[13];
	const z = invVP[2] * ndcX + invVP[6] * ndcY + invVP[10] * ndcZ + invVP[14];
	const w = invVP[3] * ndcX + invVP[7] * ndcY + invVP[11] * ndcZ + invVP[15];

	return [x / w, y / w, z / w];
}
