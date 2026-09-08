/// <reference types="@webgpu/types" />

/** Maximum delta-time in seconds — prevents explosions on tab-refocus. */
export const MAX_DELTA_TIME = 0.1;

export interface KernelFrameContext {
	device: GPUDevice;
	encoder: GPUCommandEncoder;
	canvasContext?: GPUCanvasContext;
	dt: number;
	now: number;
	frameIndex: number;
}

export interface GpuKernelConfig {
	device: GPUDevice;
	/** Optional. Compute-only callers may omit a canvas. */
	canvasContext?: GPUCanvasContext;
	/** Encode compute and/or render into this frame's encoder. Kernel submits. */
	onFrame: (ctx: KernelFrameContext) => void;
	maxDeltaTime?: number;
}

export interface GpuKernel {
	start(): void;
	stop(): void;
	isRunning(): boolean;
	/** Plugin may reset ping-pong after recreating GPU buffers. */
	resetFrameIndex(): void;
	getFrameIndex(): number;
}

/**
 * Reusable WebGPU frame kernel: rAF, clamped dt, one encoder, submit.
 * Steering plugins live outside this module.
 */
export function createGpuKernel(config: GpuKernelConfig): GpuKernel {
	const { device, canvasContext, onFrame } = config;
	const maxDt = config.maxDeltaTime ?? MAX_DELTA_TIME;

	let running = false;
	let rafId = 0;
	let lastTime = -1;
	let frameIndex = 0;

	function frame(now: number): void {
		if (!running) return;

		const rawDt = lastTime < 0 ? 0 : (now - lastTime) / 1000;
		const dt = Math.min(rawDt, maxDt);
		lastTime = now;

		const encoder = device.createCommandEncoder({ label: 'frame-encoder' });
		onFrame({
			device,
			encoder,
			canvasContext,
			dt,
			now,
			frameIndex
		});
		device.queue.submit([encoder.finish()]);
		frameIndex++;
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
		},
		resetFrameIndex() {
			frameIndex = 0;
		},
		getFrameIndex() {
			return frameIndex;
		}
	};
}
