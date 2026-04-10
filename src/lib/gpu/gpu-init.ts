/// <reference types="@webgpu/types" />

import { GPUInitError, GPUInitErrorCode, type GPUContext } from './types.js';

export type { GPUContext } from './types.js';
export { GPUInitError, GPUInitErrorCode } from './types.js';

/**
 * Options for GPU initialization.
 */
export interface GPUInitOptions {
	/**
	 * Called when the device is lost after successful initialization.
	 * If not provided, the device-lost event is silently ignored.
	 */
	onDeviceLost?: (error: GPUInitError) => void;
}

/**
 * Acquire a WebGPU adapter and device.
 *
 * @throws {GPUInitError} with code NO_WEBGPU_API if navigator.gpu is undefined
 * @throws {GPUInitError} with code NO_ADAPTER if requestAdapter() returns null
 * @throws {GPUInitError} with code DEVICE_REQUEST_FAILED if requestDevice() rejects
 */
export async function initGPU(options: GPUInitOptions = {}): Promise<GPUContext> {
	// 1. Check for WebGPU API availability
	if (typeof navigator === 'undefined' || !navigator.gpu) {
		throw new GPUInitError(
			GPUInitErrorCode.NO_WEBGPU_API,
			'WebGPU is not supported in this browser. navigator.gpu is undefined.'
		);
	}

	// 2. Request adapter
	const adapter = await navigator.gpu.requestAdapter();
	if (!adapter) {
		throw new GPUInitError(
			GPUInitErrorCode.NO_ADAPTER,
			'No suitable GPU adapter found. requestAdapter() returned null.'
		);
	}

	// 3. Request device
	let device: GPUDevice;
	try {
		device = await adapter.requestDevice();
	} catch (err) {
		throw new GPUInitError(
			GPUInitErrorCode.DEVICE_REQUEST_FAILED,
			`Failed to request GPU device: ${err instanceof Error ? err.message : String(err)}`
		);
	}

	// 4. Wire up device-lost handler
	device.lost.then((info) => {
		const lostError = new GPUInitError(
			GPUInitErrorCode.DEVICE_LOST,
			`GPU device was lost: ${info.message} (reason: ${info.reason})`
		);
		options.onDeviceLost?.(lostError);
	});

	return {
		device,
		adapter,
		limits: device.limits
	};
}
