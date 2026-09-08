/// <reference types="@webgpu/types" />

import {
	writeUniforms,
	writeCameraMatrix,
	writeSelectionUniforms,
	type BoidBuffers,
	type SimParams
} from './boid-buffers.js';
import { dispatchBoidCompute } from './boid-compute.js';
import { renderBoids, CLEAR_COLOR, type BoidRenderer } from './boid-render.js';
import type { Camera } from './camera.js';
import { createGpuKernel, type GpuKernel } from './kernel.js';

/** Callback invoked when simParams.boidCount changes. Returns the new BoidBuffers. */
export type BufferRecreateCallback = (newCount: number, oldBuffers: BoidBuffers) => BoidBuffers;

/**
 * Snapshot of simulation parameters read from plain JS object each frame.
 * This is the D-005 snapshot bridge — the component writes to this object
 * via $effect, and the animation loop reads from it. No $state runes here.
 */
export interface SimParamsSnapshot extends SimParams {
	boidCount: number;
	/** Index of the selected boid, or NO_BOID_SELECTED (0xFFFFFFFF) if none. */
	selectedBoidIndex: number;
}

export interface AnimationLoopConfig {
	device: GPUDevice;
	canvasContext: GPUCanvasContext;
	buffers: BoidBuffers;
	computePipeline: GPUComputePipeline;
	camera: Camera;
	/** Plain JS object — animation loop reads from this each frame. */
	simParams: SimParamsSnapshot;
	/**
	 * Optional callback invoked when simParams.boidCount differs from the active
	 * buffer count. Must destroy old buffers and return newly created ones.
	 */
	onBoidCountChange?: BufferRecreateCallback;
	/** Optional boid renderer for instanced drawing. If not provided, only clear color is rendered. */
	boidRenderer?: BoidRenderer;
}

export type AnimationLoop = GpuKernel;

/**
 * Boids plugin on the shared WebGPU kernel.
 *
 * Per frame:
 * 1. Kernel: clamped dt, encoder
 * 2. Plugin: snapshot, uniforms, compute, render
 * 3. Kernel: submit, next rAF
 */
export function createAnimationLoop(config: AnimationLoopConfig): AnimationLoop {
	const { device, canvasContext, computePipeline, camera, simParams, boidRenderer } = config;
	const { onBoidCountChange } = config;

	let buffers: BoidBuffers = config.buffers;
	let totalTime = 0;

	const kernel = createGpuKernel({
		device,
		canvasContext,
		onFrame({ encoder, dt, frameIndex }) {
			const params: SimParams = {
				maxForce: simParams.maxForce,
				worldSize: simParams.worldSize
			};
			const boidCount = simParams.boidCount;

			if (onBoidCountChange && boidCount !== buffers.count) {
				buffers = onBoidCountChange(boidCount, buffers);
				kernel.resetFrameIndex();
				frameIndex = 0;
			}

			writeUniforms(device, buffers.uniform, dt, boidCount, params);

			camera.update(dt);
			const vpMatrix = camera.getViewProjectionMatrix();
			writeCameraMatrix(device, buffers.uniform, vpMatrix);

			totalTime += dt;
			writeSelectionUniforms(device, buffers.uniform, simParams.selectedBoidIndex, totalTime);

			const bindGroup = buffers.bindGroups[frameIndex % 2];
			dispatchBoidCompute(encoder, computePipeline, bindGroup, boidCount);

			const textureView = canvasContext.getCurrentTexture().createView();
			const renderPassDescriptor: GPURenderPassDescriptor = {
				colorAttachments: [
					{
						view: textureView,
						loadOp: 'clear' as const,
						storeOp: 'store' as const,
						clearValue: CLEAR_COLOR
					}
				]
			};
			if (boidRenderer) {
				renderPassDescriptor.depthStencilAttachment = {
					view: boidRenderer.depthView,
					depthLoadOp: 'clear',
					depthStoreOp: 'store',
					depthClearValue: 1.0
				};
			}
			const renderPass = encoder.beginRenderPass(renderPassDescriptor);
			if (boidRenderer) {
				renderBoids(renderPass, boidRenderer, boidCount);
			}
			renderPass.end();
		}
	});

	return kernel;
}
