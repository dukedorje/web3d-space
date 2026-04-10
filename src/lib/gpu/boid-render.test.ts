import { describe, it, expect, vi } from 'vitest';
import { generateConeGeometry, renderBoids } from './boid-render.js';

describe('generateConeGeometry', () => {
	it('returns correct vertex count for default 8-sided cone', () => {
		expect.assertions(1);
		const cone = generateConeGeometry();
		// 8 lateral triangles + 6 base triangles = 14 triangles = 42 vertices
		expect(cone.vertexCount).toBe(42);
	});

	it('returns correct vertex count for a custom side count', () => {
		expect.assertions(1);
		const cone = generateConeGeometry(6);
		// 6 lateral + 4 base = 10 triangles = 30 vertices
		expect(cone.vertexCount).toBe(30);
	});

	it('vertexData length matches vertexCount * 6 floats per vertex', () => {
		expect.assertions(1);
		const cone = generateConeGeometry();
		expect(cone.vertexData.length).toBe(cone.vertexCount * 6);
	});

	it('all vertex positions are finite numbers', () => {
		expect.assertions(1);
		const cone = generateConeGeometry();
		const allFinite = cone.vertexData.every((v) => Number.isFinite(v));
		expect(allFinite).toBe(true);
	});

	it('apex vertices are at z = length', () => {
		expect.assertions(1);
		const length = 1.0;
		const sides = 8;
		const cone = generateConeGeometry(sides, 0.3, length);
		// Lateral triangles: each has 3 vertices, the 3rd vertex (index 2) is the apex
		// Vertex stride = 6 floats. Lateral triangles are the first `sides` triangles.
		const apexZValues: number[] = [];
		for (let i = 0; i < sides; i++) {
			const triStart = i * 3; // vertex index of first vertex in triangle
			const apexVertexIdx = triStart + 2; // third vertex is apex
			const zOffset = apexVertexIdx * 6 + 2; // +2 for z component
			apexZValues.push(cone.vertexData[zOffset]);
		}
		expect(apexZValues.every((z) => Math.abs(z - length) < 1e-6)).toBe(true);
	});

	it('base cap normals point in -Z direction', () => {
		expect.assertions(1);
		const sides = 8;
		const cone = generateConeGeometry(sides);
		// Base cap starts after lateral triangles: sides * 3 vertices
		const baseStart = sides * 3;
		const baseTris = sides - 2;
		const baseNormals: Array<{ x: number; y: number; z: number }> = [];
		for (let i = 0; i < baseTris * 3; i++) {
			const vertIdx = baseStart + i;
			const nx = cone.vertexData[vertIdx * 6 + 3];
			const ny = cone.vertexData[vertIdx * 6 + 4];
			const nz = cone.vertexData[vertIdx * 6 + 5];
			baseNormals.push({ x: nx, y: ny, z: nz });
		}
		expect(baseNormals.every((n) => n.x === 0 && n.y === 0 && n.z === -1)).toBe(true);
	});

	it('generates a minimum of 3 sides', () => {
		expect.assertions(1);
		const cone = generateConeGeometry(3);
		// 3 lateral + 1 base = 4 triangles = 12 vertices
		expect(cone.vertexCount).toBe(12);
	});
});

describe('renderBoids', () => {
	it('issues a single instanced draw call', () => {
		expect.assertions(4);
		const pass = {
			setPipeline: vi.fn(),
			setVertexBuffer: vi.fn(),
			setBindGroup: vi.fn(),
			draw: vi.fn()
		} as unknown as GPURenderPassEncoder;

		const renderer = {
			pipeline: {} as GPURenderPipeline,
			vertexBuffer: {} as GPUBuffer,
			vertexCount: 42,
			bindGroup: {} as GPUBindGroup,
			depthTexture: {} as GPUTexture,
			depthView: {} as GPUTextureView,
			updateBindGroup: vi.fn()
		};

		renderBoids(pass, renderer, 300);

		expect(pass.setPipeline).toHaveBeenCalledWith(renderer.pipeline);
		expect(pass.setVertexBuffer).toHaveBeenCalledWith(0, renderer.vertexBuffer);
		expect(pass.setBindGroup).toHaveBeenCalledWith(0, renderer.bindGroup);
		expect(pass.draw).toHaveBeenCalledWith(42, 300);
	});
});
