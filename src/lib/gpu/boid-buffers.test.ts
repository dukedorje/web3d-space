import { describe, it, expect } from 'vitest';
import {
	BYTES_PER_BOID,
	BYTES_PER_CONFIG,
	HALF_EXTENT,
	WORKGROUP_SIZE,
	UNIFORM_BUFFER_SIZE,
	VP_MATRIX_OFFSET,
	BOID_BIND_GROUP_LAYOUT_DESCRIPTOR,
	DEFAULT_SIM_PARAMS,
	DEFAULT_FLOCKER_CONFIG,
	initializeBoidData,
	initializeConfigData,
	packUniforms
} from './boid-buffers.js';

describe('boid buffer constants', () => {
	it('BYTES_PER_BOID is 48', () => {
		expect.assertions(1);
		expect(BYTES_PER_BOID).toBe(48);
	});

	it('BYTES_PER_CONFIG is 48', () => {
		expect.assertions(1);
		expect(BYTES_PER_CONFIG).toBe(48);
	});

	it('HALF_EXTENT is 50', () => {
		expect.assertions(1);
		expect(HALF_EXTENT).toBe(50);
	});

	it('WORKGROUP_SIZE is 64', () => {
		expect.assertions(1);
		expect(WORKGROUP_SIZE).toBe(64);
	});

	it('UNIFORM_BUFFER_SIZE is 96 (deltaTime + boidCount + worldSize + maxForce + mat4 VP + selectedBoidIndex + totalTime + padding)', () => {
		expect.assertions(1);
		expect(UNIFORM_BUFFER_SIZE).toBe(96);
	});

	it('VP_MATRIX_OFFSET is 16', () => {
		expect.assertions(1);
		expect(VP_MATRIX_OFFSET).toBe(16);
	});

	it('bind group layout has 4 entries (read storage, write storage, uniform, config)', () => {
		expect.assertions(1);
		expect(BOID_BIND_GROUP_LAYOUT_DESCRIPTOR.entries).toHaveLength(4);
	});
});

describe('initializeBoidData', () => {
	it('returns a Float32Array with 12 floats per boid (48 bytes)', () => {
		expect.assertions(2);
		const data = initializeBoidData(300);
		expect(data).toBeInstanceOf(Float32Array);
		expect(data.length).toBe(300 * 12);
	});

	it('produces byte length equal to count * BYTES_PER_BOID', () => {
		expect.assertions(1);
		const count = 300;
		const data = initializeBoidData(count);
		expect(data.byteLength).toBe(count * BYTES_PER_BOID);
	});

	it('positions are within [-HALF_EXTENT, HALF_EXTENT]', () => {
		expect.assertions(1);
		const data = initializeBoidData(100);
		let allInRange = true;
		for (let i = 0; i < 100; i++) {
			const offset = i * 12;
			for (let c = 0; c < 3; c++) {
				const v = data[offset + c];
				if (v < -HALF_EXTENT || v > HALF_EXTENT) {
					allInRange = false;
				}
			}
		}
		expect(allInRange).toBe(true);
	});

	it('velocities have meaningful speed (5-15 range)', () => {
		expect.assertions(1);
		const data = initializeBoidData(100);
		let allInRange = true;
		for (let i = 0; i < 100; i++) {
			const offset = i * 12;
			const vx = data[offset + 4];
			const vy = data[offset + 5];
			const vz = data[offset + 6];
			const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
			if (speed < 4.9 || speed > 15.1) {
				allInRange = false;
			}
		}
		expect(allInRange).toBe(true);
	});

	it('padding fields are zero', () => {
		expect.assertions(1);
		const data = initializeBoidData(50);
		let allZero = true;
		for (let i = 0; i < 50; i++) {
			const offset = i * 12;
			// padding at [3], [7], [8], [9], [10], [11]
			if (data[offset + 3] !== 0 || data[offset + 8] !== 0 || data[offset + 9] !== 0 || data[offset + 10] !== 0 || data[offset + 11] !== 0) {
				allZero = false;
			}
		}
		expect(allZero).toBe(true);
	});

	it('handles zero boids', () => {
		expect.assertions(1);
		const data = initializeBoidData(0);
		expect(data.length).toBe(0);
	});

	it('generates varying data (not all identical)', () => {
		expect.assertions(1);
		const data = initializeBoidData(10);
		const firstPx = data[0];
		let hasDifferent = false;
		for (let i = 1; i < 10; i++) {
			if (data[i * 12] !== firstPx) {
				hasDifferent = true;
				break;
			}
		}
		expect(hasDifferent).toBe(true);
	});
});

describe('initializeConfigData', () => {
	it('returns a Float32Array with 12 floats per config (48 bytes)', () => {
		expect.assertions(2);
		const data = initializeConfigData(100);
		expect(data).toBeInstanceOf(Float32Array);
		expect(data.length).toBe(100 * 12);
	});

	it('produces byte length equal to count * BYTES_PER_CONFIG', () => {
		expect.assertions(1);
		const data = initializeConfigData(100);
		expect(data.byteLength).toBe(100 * BYTES_PER_CONFIG);
	});

	it('initializes all boids with default flocker config', () => {
		expect.assertions(8);
		const data = initializeConfigData(10);
		const c = DEFAULT_FLOCKER_CONFIG;
		// Check first boid
		expect(data[0]).toBeCloseTo(c.separationWeight, 5);
		expect(data[1]).toBeCloseTo(c.alignmentWeight, 5);
		expect(data[2]).toBeCloseTo(c.cohesionWeight, 5);
		expect(data[3]).toBeCloseTo(c.perceptionRadius, 5);
		expect(data[4]).toBeCloseTo(c.separationRadius, 5);
		expect(data[5]).toBeCloseTo(c.maxSpeed, 5);
		expect(data[6]).toBeCloseTo(c.wanderStrength, 5);
		expect(data[7]).toBeCloseTo(c.crowdSpeedBoost, 5);
	});

	it('stores personalityType as u32 at offset 8', () => {
		expect.assertions(1);
		const data = initializeConfigData(5);
		const u32 = new Uint32Array(data.buffer);
		expect(u32[8]).toBe(0); // Flocker = 0
	});

	it('handles zero boids', () => {
		expect.assertions(1);
		const data = initializeConfigData(0);
		expect(data.length).toBe(0);
	});
});

describe('packUniforms', () => {
	it('returns an ArrayBuffer of UNIFORM_BUFFER_SIZE bytes', () => {
		expect.assertions(1);
		const buf = packUniforms(0.016, 300);
		expect(buf.byteLength).toBe(UNIFORM_BUFFER_SIZE);
	});

	it('packs deltaTime at offset 0 as f32', () => {
		expect.assertions(1);
		const buf = packUniforms(0.016, 300);
		const f32 = new Float32Array(buf);
		expect(f32[0]).toBeCloseTo(0.016, 5);
	});

	it('packs boidCount at offset 4 as u32', () => {
		expect.assertions(1);
		const buf = packUniforms(0.016, 300);
		const u32 = new Uint32Array(buf);
		expect(u32[1]).toBe(300);
	});

	it('packs worldSize at offset 8 and maxForce at offset 12', () => {
		expect.assertions(2);
		const buf = packUniforms(0.016, 100);
		const f32 = new Float32Array(buf);
		expect(f32[2]).toBeCloseTo(DEFAULT_SIM_PARAMS.worldSize, 5);
		expect(f32[3]).toBeCloseTo(DEFAULT_SIM_PARAMS.maxForce, 5);
	});

	it('allows overriding sim params', () => {
		expect.assertions(2);
		const buf = packUniforms(0.016, 100, {
			worldSize: 200.0,
			maxForce: 10.0
		});
		const f32 = new Float32Array(buf);
		expect(f32[2]).toBe(200.0);
		expect(f32[3]).toBe(10.0);
	});

	it('worldSize defaults to HALF_EXTENT * 2', () => {
		expect.assertions(1);
		const buf = packUniforms(0.016, 100);
		const f32 = new Float32Array(buf);
		expect(f32[2]).toBe(HALF_EXTENT * 2);
	});
});

describe('camera matrix uniform layout (smoke)', () => {
	it('VP_MATRIX_OFFSET is 16-byte aligned', () => {
		expect.assertions(1);
		expect(VP_MATRIX_OFFSET % 16).toBe(0);
	});

	it('uniform buffer accommodates mat4 (64 bytes) starting at VP_MATRIX_OFFSET', () => {
		expect.assertions(1);
		expect(VP_MATRIX_OFFSET + 64).toBeLessThanOrEqual(UNIFORM_BUFFER_SIZE);
	});

	it('camera matrix region is zero in freshly packed uniforms', () => {
		expect.assertions(1);
		const buf = packUniforms(0.016, 300);
		const f32 = new Float32Array(buf, VP_MATRIX_OFFSET, 16);
		expect(Array.from(f32).every((v) => v === 0)).toBe(true);
	});
});
