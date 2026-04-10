/// <reference types="@webgpu/types" />

import { writeUniforms, writeCameraMatrix, writeSelectionUniforms, NO_BOID_SELECTED, type BoidBuffers, type SimParams } from './boid-buffers.js';
import { dispatchBoidCompute } from './boid-compute.js';
import { renderBoids, CLEAR_COLOR, type BoidRenderer } from './boid-render.js';
import type { Camera } from './camera.js';

/** Callback invoked when simParams.boidCount changes. Returns the new BoidBuffers. */
export type BufferRecreateCallback = (newCount: number, oldBuffers: BoidBuffers) => BoidBuffers;

/** Maximum delta-time in seconds — prevents physics explosion on tab-refocus. */
const MAX_DELTA_TIME = 0.1; // 100ms

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

export interface AnimationLoop {
	start(): void;
	stop(): void;
	isRunning(): boolean;
}

/**
 * Create an animation loop that drives compute and render passes each frame.
 *
 * Per frame:
 * 1. Calculate delta-time (clamped to MAX_DELTA_TIME)
 * 2. Read simParams snapshot for current parameters
 * 3. Write uniforms to GPU
 * 4. Write camera VP matrix to GPU
 * 5. Create command encoder
 * 6. Encode single compute pass (uber-shader)
 * 7. Encode render pass
 * 8. Submit command buffer
 * 9. Swap ping-pong buffer index
 * 10. Request next frame
 */
export function createAnimationLoop(config: AnimationLoopConfig): AnimationLoop {
	const { device, canvasContext, computePipeline, camera, simParams, boidRenderer } = config;
	const { onBoidCountChange } = config;

	let buffers: BoidBuffers = config.buffers;
	let running = false;
	let rafId = 0;
	let lastTime = -1;
	let frameIndex = 0;
	let totalTime = 0;

	function frame(now: number): void {
		if (!running) return;

		// 1. Delta-time in seconds, clamped
		const rawDt = lastTime < 0 ? 0 : (now - lastTime) / 1000;
		const dt = Math.min(rawDt, MAX_DELTA_TIME);
		lastTime = now;

		// 2. Read snapshot (plain JS object — no reactive reads)
		const params: SimParams = {
			maxForce: simParams.maxForce,
			worldSize: simParams.worldSize
		};
		const boidCount = simParams.boidCount;

		// 2b. Recreate buffers if boidCount changed
		if (onBoidCountChange && boidCount !== buffers.count) {
			buffers = onBoidCountChange(boidCount, buffers);
			frameIndex = 0;
		}

		// 3. Write uniforms
		writeUniforms(device, buffers.uniform, dt, boidCount, params);

		// 4. Update camera and write VP matrix
		camera.update(dt);
		const vpMatrix = camera.getViewProjectionMatrix();
		writeCameraMatrix(device, buffers.uniform, vpMatrix);

		// 4b. Write selection uniforms (selectedBoidIndex + totalTime)
		totalTime += dt;
		writeSelectionUniforms(device, buffers.uniform, simParams.selectedBoidIndex, totalTime);

		// 5. Create command encoder
		const encoder = device.createCommandEncoder({ label: 'frame-encoder' });

		// 6. Single compute pass (uber-shader)
		const bindGroup = buffers.bindGroups[frameIndex % 2];
		dispatchBoidCompute(encoder, computePipeline, bindGroup, boidCount);

		// 7. Render pass
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
			// Read from the buffer we just wrote to (current write target)
			renderBoids(renderPass, boidRenderer, boidCount);
		}
		renderPass.end();

		// 8. Submit
		device.queue.submit([encoder.finish()]);

		// 9. Swap ping-pong
		frameIndex++;

		// 10. Next frame
		rafId = requestAnimationFrame(frame);
	}

	return {
		start() {
			if (running) return;
			running = true;
			lastTime = -1;
			frameIndex = 0;
			rafId = requestAnimationFrame(frame);
		},

		stop() {
			if (!running) return;
			running = false;
			cancelAnimationFrame(rafId);
			rafId = 0;
		},

		isRunning() {
			return running;
		}
	};
}
