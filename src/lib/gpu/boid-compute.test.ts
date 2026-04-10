import { describe, it, expect, vi } from 'vitest';
import { dispatchBoidCompute } from './boid-compute.js';
import { WORKGROUP_SIZE } from './boid-buffers.js';

describe('dispatchBoidCompute', () => {
	it('dispatches ceil(boidCount / WORKGROUP_SIZE) workgroups', () => {
		expect.assertions(3);
		const pass = {
			setPipeline: vi.fn(),
			setBindGroup: vi.fn(),
			dispatchWorkgroups: vi.fn(),
			end: vi.fn()
		};
		const encoder = {
			beginComputePass: vi.fn().mockReturnValue(pass)
		} as unknown as GPUCommandEncoder;
		const pipeline = {} as GPUComputePipeline;
		const bindGroup = {} as GPUBindGroup;

		dispatchBoidCompute(encoder, pipeline, bindGroup, 300);

		expect(pass.setPipeline).toHaveBeenCalledWith(pipeline);
		expect(pass.setBindGroup).toHaveBeenCalledWith(0, bindGroup);
		expect(pass.dispatchWorkgroups).toHaveBeenCalledWith(Math.ceil(300 / WORKGROUP_SIZE));
	});

	it('dispatches 1 workgroup for count <= WORKGROUP_SIZE', () => {
		expect.assertions(1);
		const pass = {
			setPipeline: vi.fn(),
			setBindGroup: vi.fn(),
			dispatchWorkgroups: vi.fn(),
			end: vi.fn()
		};
		const encoder = {
			beginComputePass: vi.fn().mockReturnValue(pass)
		} as unknown as GPUCommandEncoder;

		dispatchBoidCompute(encoder, {} as GPUComputePipeline, {} as GPUBindGroup, 1);

		expect(pass.dispatchWorkgroups).toHaveBeenCalledWith(1);
	});

	it('calls pass.end() to finalize the compute pass', () => {
		expect.assertions(1);
		const pass = {
			setPipeline: vi.fn(),
			setBindGroup: vi.fn(),
			dispatchWorkgroups: vi.fn(),
			end: vi.fn()
		};
		const encoder = {
			beginComputePass: vi.fn().mockReturnValue(pass)
		} as unknown as GPUCommandEncoder;

		dispatchBoidCompute(encoder, {} as GPUComputePipeline, {} as GPUBindGroup, 64);

		expect(pass.end).toHaveBeenCalledOnce();
	});
});
