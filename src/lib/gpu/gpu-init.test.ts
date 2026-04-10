import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initGPU, GPUInitError, GPUInitErrorCode } from './gpu-init.js';

describe('GPUInitError', () => {
	it('has the correct name, code, and message', () => {
		expect.assertions(3);
		const err = new GPUInitError(GPUInitErrorCode.NO_WEBGPU_API, 'test message');
		expect(err.name).toBe('GPUInitError');
		expect(err.code).toBe('NO_WEBGPU_API');
		expect(err.message).toBe('test message');
	});

	it('is an instance of Error', () => {
		expect.assertions(1);
		const err = new GPUInitError(GPUInitErrorCode.NO_ADAPTER, 'no adapter');
		expect(err).toBeInstanceOf(Error);
	});

	it('distinguishes error codes', () => {
		expect.assertions(4);
		expect(GPUInitErrorCode.NO_WEBGPU_API).toBe('NO_WEBGPU_API');
		expect(GPUInitErrorCode.NO_ADAPTER).toBe('NO_ADAPTER');
		expect(GPUInitErrorCode.DEVICE_REQUEST_FAILED).toBe('DEVICE_REQUEST_FAILED');
		expect(GPUInitErrorCode.DEVICE_LOST).toBe('DEVICE_LOST');
	});
});

describe('initGPU', () => {
	let originalNavigator: PropertyDescriptor | undefined;

	beforeEach(() => {
		originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
	});

	afterEach(() => {
		if (originalNavigator) {
			Object.defineProperty(globalThis, 'navigator', originalNavigator);
		} else {
			// In Node there may be no navigator by default
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			delete (globalThis as any).navigator;
		}
	});

	it('throws NO_WEBGPU_API when navigator.gpu is undefined', async () => {
		expect.assertions(2);
		Object.defineProperty(globalThis, 'navigator', {
			value: {},
			configurable: true
		});

		try {
			await initGPU();
		} catch (err) {
			expect(err).toBeInstanceOf(GPUInitError);
			expect((err as GPUInitError).code).toBe(GPUInitErrorCode.NO_WEBGPU_API);
		}
	});

	it('throws NO_WEBGPU_API when navigator is undefined', async () => {
		expect.assertions(2);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		delete (globalThis as any).navigator;

		try {
			await initGPU();
		} catch (err) {
			expect(err).toBeInstanceOf(GPUInitError);
			expect((err as GPUInitError).code).toBe(GPUInitErrorCode.NO_WEBGPU_API);
		}
	});

	it('throws NO_ADAPTER when requestAdapter returns null', async () => {
		expect.assertions(2);
		Object.defineProperty(globalThis, 'navigator', {
			value: {
				gpu: {
					requestAdapter: vi.fn().mockResolvedValue(null)
				}
			},
			configurable: true
		});

		try {
			await initGPU();
		} catch (err) {
			expect(err).toBeInstanceOf(GPUInitError);
			expect((err as GPUInitError).code).toBe(GPUInitErrorCode.NO_ADAPTER);
		}
	});

	it('throws DEVICE_REQUEST_FAILED when requestDevice rejects', async () => {
		expect.assertions(3);
		const mockAdapter = {
			requestDevice: vi.fn().mockRejectedValue(new Error('device creation failed'))
		};
		Object.defineProperty(globalThis, 'navigator', {
			value: {
				gpu: {
					requestAdapter: vi.fn().mockResolvedValue(mockAdapter)
				}
			},
			configurable: true
		});

		try {
			await initGPU();
		} catch (err) {
			expect(err).toBeInstanceOf(GPUInitError);
			expect((err as GPUInitError).code).toBe(GPUInitErrorCode.DEVICE_REQUEST_FAILED);
			expect((err as GPUInitError).message).toContain('device creation failed');
		}
	});

	it('returns GPUContext on success', async () => {
		expect.assertions(4);
		const mockLimits = { maxTextureDimension2D: 8192 };
		const mockDevice = {
			limits: mockLimits,
			lost: new Promise(() => {}) // never resolves
		};
		const mockAdapter = {
			requestDevice: vi.fn().mockResolvedValue(mockDevice)
		};
		Object.defineProperty(globalThis, 'navigator', {
			value: {
				gpu: {
					requestAdapter: vi.fn().mockResolvedValue(mockAdapter)
				}
			},
			configurable: true
		});

		const ctx = await initGPU();
		expect(ctx.device).toBe(mockDevice);
		expect(ctx.adapter).toBe(mockAdapter);
		expect(ctx.limits).toBe(mockLimits);
		expect(mockAdapter.requestDevice).toHaveBeenCalledOnce();
	});

	it('calls onDeviceLost when device.lost resolves', async () => {
		expect.assertions(3);
		let resolveLost!: (info: { message: string; reason: string }) => void;
		const lostPromise = new Promise<{ message: string; reason: string }>((resolve) => {
			resolveLost = resolve;
		});

		const mockDevice = {
			limits: {},
			lost: lostPromise
		};
		const mockAdapter = {
			requestDevice: vi.fn().mockResolvedValue(mockDevice)
		};
		Object.defineProperty(globalThis, 'navigator', {
			value: {
				gpu: {
					requestAdapter: vi.fn().mockResolvedValue(mockAdapter)
				}
			},
			configurable: true
		});

		const onDeviceLost = vi.fn();
		await initGPU({ onDeviceLost });

		// Trigger device lost
		resolveLost({ message: 'GPU hung', reason: 'destroyed' });

		// Allow microtask to run
		await new Promise((r) => setTimeout(r, 0));

		expect(onDeviceLost).toHaveBeenCalledOnce();
		const lostErr = onDeviceLost.mock.calls[0][0];
		expect(lostErr).toBeInstanceOf(GPUInitError);
		expect(lostErr.code).toBe(GPUInitErrorCode.DEVICE_LOST);
	});

	it('does not throw when onDeviceLost is not provided and device is lost', async () => {
		expect.assertions(1);
		let resolveLost!: (info: { message: string; reason: string }) => void;
		const lostPromise = new Promise<{ message: string; reason: string }>((resolve) => {
			resolveLost = resolve;
		});

		const mockDevice = {
			limits: {},
			lost: lostPromise
		};
		const mockAdapter = {
			requestDevice: vi.fn().mockResolvedValue(mockDevice)
		};
		Object.defineProperty(globalThis, 'navigator', {
			value: {
				gpu: {
					requestAdapter: vi.fn().mockResolvedValue(mockAdapter)
				}
			},
			configurable: true
		});

		const ctx = await initGPU();

		// Trigger device lost — should not throw
		resolveLost({ message: 'lost', reason: 'unknown' });
		await new Promise((r) => setTimeout(r, 0));

		expect(ctx.device).toBe(mockDevice);
	});

	it('error messages distinguish NO_WEBGPU_API from NO_ADAPTER', async () => {
		expect.assertions(2);

		// NO_WEBGPU_API
		Object.defineProperty(globalThis, 'navigator', {
			value: {},
			configurable: true
		});
		try {
			await initGPU();
		} catch (err) {
			expect((err as GPUInitError).message).toContain('navigator.gpu');
		}

		// NO_ADAPTER
		Object.defineProperty(globalThis, 'navigator', {
			value: {
				gpu: {
					requestAdapter: vi.fn().mockResolvedValue(null)
				}
			},
			configurable: true
		});
		try {
			await initGPU();
		} catch (err) {
			expect((err as GPUInitError).message).toContain('requestAdapter()');
		}
	});
});
