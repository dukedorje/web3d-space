import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createGpuKernel, MAX_DELTA_TIME } from './kernel.js';

let rafCallback: ((time: number) => void) | null = null;
let rafIdCounter = 1;

beforeEach(() => {
	rafCallback = null;
	rafIdCounter = 1;
	vi.stubGlobal(
		'requestAnimationFrame',
		vi.fn((cb: (time: number) => void) => {
			rafCallback = cb;
			return rafIdCounter++;
		})
	);
	vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

function makeDevice() {
	const encoderFinish = vi.fn().mockReturnValue('command-buffer');
	const computePass = {
		setPipeline: vi.fn(),
		setBindGroup: vi.fn(),
		dispatchWorkgroups: vi.fn(),
		end: vi.fn()
	};
	const encoder = {
		beginComputePass: vi.fn().mockReturnValue(computePass),
		finish: encoderFinish
	};
	const submit = vi.fn();
	const device = {
		createCommandEncoder: vi.fn().mockReturnValue(encoder),
		queue: { submit }
	} as unknown as GPUDevice;
	return { device, encoder, computePass, submit };
}

describe('createGpuKernel', () => {
	it('does not import boid steering (this file is the proof)', () => {
		expect(typeof createGpuKernel).toBe('function');
		expect(MAX_DELTA_TIME).toBe(0.1);
		const path = fileURLToPath(new URL('./kernel.ts', import.meta.url));
		const src = readFileSync(path, 'utf8');
		expect(src).not.toMatch(/boid-steering|boid-buffers|boid-compute|boid-render/);
	});

	it('starts, dispatches a compute pass, and submits without a canvas', () => {
		const { device, encoder, computePass, submit } = makeDevice();
		const pipeline = {} as GPUComputePipeline;
		const bindGroup = {} as GPUBindGroup;

		const kernel = createGpuKernel({
			device,
			onFrame({ encoder: enc }) {
				const pass = enc.beginComputePass({ label: 'probe' });
				pass.setPipeline(pipeline);
				pass.setBindGroup(0, bindGroup);
				pass.dispatchWorkgroups(1);
				pass.end();
			}
		});

		kernel.start();
		expect(kernel.isRunning()).toBe(true);
		rafCallback!(16);

		expect(encoder.beginComputePass).toHaveBeenCalledOnce();
		expect(computePass.dispatchWorkgroups).toHaveBeenCalledWith(1);
		expect(submit).toHaveBeenCalledWith(['command-buffer']);
		expect(kernel.getFrameIndex()).toBe(1);

		kernel.stop();
		expect(kernel.isRunning()).toBe(false);
		expect(cancelAnimationFrame).toHaveBeenCalled();
	});

	it('clamps dt to MAX_DELTA_TIME', () => {
		const { device } = makeDevice();
		const dts: number[] = [];
		const kernel = createGpuKernel({
			device,
			onFrame({ dt }) {
				dts.push(dt);
			}
		});
		kernel.start();
		rafCallback!(0);
		rafCallback!(500);
		expect(dts[0]).toBe(0);
		expect(dts[1]).toBeCloseTo(MAX_DELTA_TIME, 5);
	});

	it('resetFrameIndex returns ping-pong to 0', () => {
		const { device } = makeDevice();
		const indexes: number[] = [];
		const kernel = createGpuKernel({
			device,
			onFrame({ frameIndex }) {
				indexes.push(frameIndex);
			}
		});
		kernel.start();
		rafCallback!(0);
		kernel.resetFrameIndex();
		rafCallback!(16);
		expect(indexes).toEqual([0, 0]);
	});
});
