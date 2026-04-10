/// <reference types="@webgpu/types" />

import { WORKGROUP_SIZE } from './boid-buffers.js';

/**
 * Create an async compute pipeline for boid simulation.
 */
export async function createBoidComputePipeline(
	device: GPUDevice,
	bindGroupLayout: GPUBindGroupLayout,
	shaderSource: string,
	label: string = 'boid-compute'
): Promise<GPUComputePipeline> {
	const shaderModule = device.createShaderModule({
		label: `${label}-shader`,
		code: shaderSource
	});

	const pipelineLayout = device.createPipelineLayout({
		label: `${label}-pipeline-layout`,
		bindGroupLayouts: [bindGroupLayout]
	});

	const pipeline = await device.createComputePipelineAsync({
		label: `${label}-pipeline`,
		layout: pipelineLayout,
		compute: {
			module: shaderModule,
			entryPoint: 'main'
		}
	});

	return pipeline;
}

/**
 * Encode a compute pass that dispatches the boid simulation.
 *
 * @param encoder - Command encoder to record into
 * @param pipeline - The boid compute pipeline
 * @param bindGroup - Bind group for this frame (use bindGroups[frameIndex % 2])
 * @param boidCount - Number of boids to dispatch over
 */
export function dispatchBoidCompute(
	encoder: GPUCommandEncoder,
	pipeline: GPUComputePipeline,
	bindGroup: GPUBindGroup,
	boidCount: number
): void {
	const workgroupCount = Math.ceil(boidCount / WORKGROUP_SIZE);
	const pass = encoder.beginComputePass({ label: 'boid-compute-pass' });
	pass.setPipeline(pipeline);
	pass.setBindGroup(0, bindGroup);
	pass.dispatchWorkgroups(workgroupCount);
	pass.end();
}
