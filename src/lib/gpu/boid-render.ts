/// <reference types="@webgpu/types" />

import { BYTES_PER_BOID } from './boid-buffers.js';

/** Number of sides on the cone base. */
const CONE_SIDES = 8;

/** Cone dimensions: radius of base, length along +Z axis. */
const CONE_RADIUS = 0.3;
const CONE_LENGTH = 1.0;

/** Floats per vertex: position (3) + normal (3) = 6. */
const FLOATS_PER_VERTEX = 6;

/** Clear color: dark navy background. */
export const CLEAR_COLOR: GPUColor = { r: 0.02, g: 0.02, b: 0.08, a: 1.0 };

/**
 * Vertex data for a single triangle: 3 vertices x 6 floats each.
 * Layout per vertex: [px, py, pz, nx, ny, nz]
 */
export interface ConeGeometry {
	/** Interleaved position + normal float data. */
	readonly vertexData: Float32Array;
	/** Number of vertices (for draw call). */
	readonly vertexCount: number;
}

/**
 * Generate cone/wedge geometry pointing along +Z axis.
 * Base circle at z=0, apex at z=CONE_LENGTH.
 * Returns interleaved position + normal data.
 *
 * Triangles:
 *   - CONE_SIDES triangles for the lateral surface (base edge to apex)
 *   - CONE_SIDES - 2 triangles for the base cap (triangle fan)
 *   Total: CONE_SIDES + (CONE_SIDES - 2) = 2*CONE_SIDES - 2
 */
export function generateConeGeometry(
	sides: number = CONE_SIDES,
	radius: number = CONE_RADIUS,
	length: number = CONE_LENGTH
): ConeGeometry {
	const lateralTris = sides;
	const baseTris = sides - 2;
	const totalTris = lateralTris + baseTris;
	const totalVerts = totalTris * 3;
	const vertexData = new Float32Array(totalVerts * FLOATS_PER_VERTEX);

	let offset = 0;

	function writeVertex(px: number, py: number, pz: number, nx: number, ny: number, nz: number) {
		vertexData[offset++] = px;
		vertexData[offset++] = py;
		vertexData[offset++] = pz;
		vertexData[offset++] = nx;
		vertexData[offset++] = ny;
		vertexData[offset++] = nz;
	}

	const apex = { x: 0, y: 0, z: length };
	const angleStep = (2 * Math.PI) / sides;

	// Precompute base ring positions
	const ring: Array<{ x: number; y: number }> = [];
	for (let i = 0; i < sides; i++) {
		const angle = i * angleStep;
		ring.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
	}

	// Lateral surface triangles
	for (let i = 0; i < sides; i++) {
		const curr = ring[i];
		const next = ring[(i + 1) % sides];

		// Compute face normal for this lateral triangle
		// Edge vectors from curr base to apex and to next base
		const e1x = apex.x - curr.x,
			e1y = apex.y - curr.y,
			e1z = apex.z - 0;
		const e2x = next.x - curr.x,
			e2y = next.y - curr.y,
			e2z = 0;

		// Cross product e1 x e2
		let nx = e1y * e2z - e1z * e2y;
		let ny = e1z * e2x - e1x * e2z;
		let nz = e1x * e2y - e1y * e2x;
		const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz);
		if (nLen > 0) {
			nx /= nLen;
			ny /= nLen;
			nz /= nLen;
		}

		writeVertex(curr.x, curr.y, 0, nx, ny, nz);
		writeVertex(next.x, next.y, 0, nx, ny, nz);
		writeVertex(apex.x, apex.y, apex.z, nx, ny, nz);
	}

	// Base cap (triangle fan, normal pointing -Z)
	const baseNormal = { x: 0, y: 0, z: -1 };
	for (let i = 1; i < sides - 1; i++) {
		writeVertex(ring[0].x, ring[0].y, 0, baseNormal.x, baseNormal.y, baseNormal.z);
		// Wind clockwise so normal faces -Z (outward from base)
		writeVertex(ring[i + 1].x, ring[i + 1].y, 0, baseNormal.x, baseNormal.y, baseNormal.z);
		writeVertex(ring[i].x, ring[i].y, 0, baseNormal.x, baseNormal.y, baseNormal.z);
	}

	return { vertexData, vertexCount: totalVerts };
}

/**
 * Render pipeline + resources needed to draw instanced boids.
 */
export interface BoidRenderer {
	readonly pipeline: GPURenderPipeline;
	readonly vertexBuffer: GPUBuffer;
	readonly vertexCount: number;
	bindGroup: GPUBindGroup;
	readonly depthTexture: GPUTexture;
	readonly depthView: GPUTextureView;
	/** Recreate the bind group with new buffers (after buffer recreation). */
	updateBindGroup(boidBuffer: GPUBuffer, uniformBuffer: GPUBuffer, configBuffer?: GPUBuffer): void;
}

/**
 * Create a depth texture for the render pass.
 */
export function createDepthTexture(
	device: GPUDevice,
	width: number,
	height: number
): GPUTexture {
	return device.createTexture({
		label: 'boid-depth-texture',
		size: { width, height },
		format: 'depth24plus',
		usage: GPUTextureUsage.RENDER_ATTACHMENT
	});
}

/**
 * Create the full boid renderer: pipeline, vertex buffer, bind group, depth texture.
 *
 * @param device - GPU device
 * @param format - Canvas preferred texture format
 * @param boidBuffer - Storage buffer containing boid state (read-only in render)
 * @param uniformBuffer - Uniform buffer containing VP matrix at offset 16
 * @param configBuffer - Storage buffer containing per-boid config (read-only in render)
 * @param shaderSource - WGSL source for the render shader
 * @param canvasWidth - Width of the render target
 * @param canvasHeight - Height of the render target
 */
export function createBoidRenderer(
	device: GPUDevice,
	format: GPUTextureFormat,
	boidBuffer: GPUBuffer,
	uniformBuffer: GPUBuffer,
	configBuffer: GPUBuffer,
	shaderSource: string,
	canvasWidth: number,
	canvasHeight: number
): BoidRenderer {
	const shaderModule = device.createShaderModule({
		label: 'boid-render-shader',
		code: shaderSource
	});

	// Render bind group layout: boid storage + uniforms + config storage
	const bindGroupLayout = device.createBindGroupLayout({
		label: 'boid-render-bind-group-layout',
		entries: [
			{
				binding: 0,
				visibility: GPUShaderStage.VERTEX,
				buffer: { type: 'read-only-storage' }
			},
			{
				binding: 1,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: { type: 'uniform' }
			},
			{
				binding: 2,
				visibility: GPUShaderStage.VERTEX,
				buffer: { type: 'read-only-storage' }
			}
		]
	});

	const pipelineLayout = device.createPipelineLayout({
		label: 'boid-render-pipeline-layout',
		bindGroupLayouts: [bindGroupLayout]
	});

	const pipeline = device.createRenderPipeline({
		label: 'boid-render-pipeline',
		layout: pipelineLayout,
		vertex: {
			module: shaderModule,
			entryPoint: 'vs_main',
			buffers: [
				{
					arrayStride: FLOATS_PER_VERTEX * 4, // 24 bytes
					attributes: [
						{ shaderLocation: 0, offset: 0, format: 'float32x3' }, // position
						{ shaderLocation: 1, offset: 12, format: 'float32x3' } // normal
					]
				}
			]
		},
		fragment: {
			module: shaderModule,
			entryPoint: 'fs_main',
			targets: [{ format }]
		},
		primitive: {
			topology: 'triangle-list',
			cullMode: 'back',
			frontFace: 'ccw'
		},
		depthStencil: {
			format: 'depth24plus',
			depthWriteEnabled: true,
			depthCompare: 'less'
		}
	});

	// Generate cone geometry and upload to vertex buffer
	const cone = generateConeGeometry();
	const vertexBuffer = device.createBuffer({
		label: 'boid-cone-vertex-buffer',
		size: cone.vertexData.byteLength,
		usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
	});
	device.queue.writeBuffer(vertexBuffer, 0, cone.vertexData.buffer);

	// Bind group for render pass
	const bindGroup = device.createBindGroup({
		label: 'boid-render-bind-group',
		layout: bindGroupLayout,
		entries: [
			{ binding: 0, resource: { buffer: boidBuffer } },
			{ binding: 1, resource: { buffer: uniformBuffer } },
			{ binding: 2, resource: { buffer: configBuffer } }
		]
	});

	// Depth texture
	const depthTexture = createDepthTexture(device, canvasWidth, canvasHeight);
	const depthView = depthTexture.createView({ label: 'boid-depth-view' });

	const renderer: BoidRenderer = {
		pipeline,
		vertexBuffer,
		vertexCount: cone.vertexCount,
		bindGroup,
		depthTexture,
		depthView,
		updateBindGroup(newBoidBuffer: GPUBuffer, newUniformBuffer: GPUBuffer, newConfigBuffer?: GPUBuffer) {
			renderer.bindGroup = device.createBindGroup({
				label: 'boid-render-bind-group',
				layout: bindGroupLayout,
				entries: [
					{ binding: 0, resource: { buffer: newBoidBuffer } },
					{ binding: 1, resource: { buffer: newUniformBuffer } },
					{ binding: 2, resource: { buffer: newConfigBuffer ?? configBuffer } }
				]
			});
		}
	};
	return renderer;
}

/**
 * Encode the instanced boid draw call into a render pass.
 *
 * @param pass - Active render pass encoder
 * @param renderer - The boid renderer resources
 * @param instanceCount - Number of boid instances to draw
 */
export function renderBoids(
	pass: GPURenderPassEncoder,
	renderer: BoidRenderer,
	instanceCount: number
): void {
	pass.setPipeline(renderer.pipeline);
	pass.setVertexBuffer(0, renderer.vertexBuffer);
	pass.setBindGroup(0, renderer.bindGroup);
	pass.draw(renderer.vertexCount, instanceCount);
}
