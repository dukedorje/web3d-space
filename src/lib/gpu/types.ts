/// <reference types="@webgpu/types" />

/**
 * Successful GPU initialization result containing device, adapter, and limits.
 */
export interface GPUContext {
	readonly device: GPUDevice;
	readonly adapter: GPUAdapter;
	readonly limits: GPUSupportedLimits;
}

/**
 * Error codes for GPU initialization failures.
 */
export const GPUInitErrorCode = {
	/** navigator.gpu is undefined — WebGPU API not available */
	NO_WEBGPU_API: 'NO_WEBGPU_API',
	/** requestAdapter() returned null — no suitable GPU adapter */
	NO_ADAPTER: 'NO_ADAPTER',
	/** requestDevice() rejected — could not create a device */
	DEVICE_REQUEST_FAILED: 'DEVICE_REQUEST_FAILED',
	/** device.lost resolved — GPU device was lost during the session */
	DEVICE_LOST: 'DEVICE_LOST'
} as const;

export type GPUInitErrorCode = (typeof GPUInitErrorCode)[keyof typeof GPUInitErrorCode];

/**
 * Typed error thrown (or resolved) for all GPU initialization failure modes.
 */
export class GPUInitError extends Error {
	readonly code: GPUInitErrorCode;

	constructor(code: GPUInitErrorCode, message: string) {
		super(message);
		this.name = 'GPUInitError';
		this.code = code;
	}
}
