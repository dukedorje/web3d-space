// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	showErrorOverlay,
	hideErrorOverlay,
	withErrorScope,
	handleCompilationInfo,
	createCleanupHandle
} from './errors.js';

describe('showErrorOverlay', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('creates an overlay element in the DOM', () => {
		expect.assertions(2);
		showErrorOverlay('Test error');
		const overlay = document.getElementById('gpu-error-overlay');
		expect(overlay).not.toBeNull();
		expect(overlay!.textContent).toContain('Test error');
	});

	it('includes a title with "WebGPU Error"', () => {
		expect.assertions(1);
		showErrorOverlay('Something broke');
		const overlay = document.getElementById('gpu-error-overlay')!;
		const title = overlay.querySelector('p:first-child');
		expect(title!.textContent).toBe('WebGPU Error');
	});

	it('updates the message if called again', () => {
		expect.assertions(2);
		showErrorOverlay('First error');
		showErrorOverlay('Second error');
		const overlays = document.querySelectorAll('#gpu-error-overlay');
		expect(overlays.length).toBe(1);
		expect(overlays[0].textContent).toContain('Second error');
	});

	it('sets fixed positioning with high z-index', () => {
		expect.assertions(2);
		showErrorOverlay('Test');
		const overlay = document.getElementById('gpu-error-overlay')!;
		expect(overlay.style.position).toBe('fixed');
		expect(overlay.style.zIndex).toBe('9999');
	});
});

describe('hideErrorOverlay', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('removes the overlay from the DOM', () => {
		expect.assertions(2);
		showErrorOverlay('Error');
		expect(document.getElementById('gpu-error-overlay')).not.toBeNull();
		hideErrorOverlay();
		expect(document.getElementById('gpu-error-overlay')).toBeNull();
	});

	it('does not throw if no overlay exists', () => {
		expect.assertions(1);
		expect(() => hideErrorOverlay()).not.toThrow();
	});
});

describe('withErrorScope', () => {
	it('returns the result when no GPU error occurs', async () => {
		expect.assertions(1);
		const device = {
			pushErrorScope: vi.fn(),
			popErrorScope: vi.fn().mockResolvedValue(null)
		} as unknown as GPUDevice;

		const result = await withErrorScope(device, 'validation', () => 42);
		expect(result).toBe(42);
	});

	it('calls pushErrorScope and popErrorScope with the correct filter', async () => {
		expect.assertions(2);
		const device = {
			pushErrorScope: vi.fn(),
			popErrorScope: vi.fn().mockResolvedValue(null)
		} as unknown as GPUDevice;

		await withErrorScope(device, 'validation', () => 'ok');
		expect(device.pushErrorScope).toHaveBeenCalledWith('validation');
		expect(device.popErrorScope).toHaveBeenCalledOnce();
	});

	it('throws when a GPU error is captured', async () => {
		expect.assertions(2);
		const device = {
			pushErrorScope: vi.fn(),
			popErrorScope: vi.fn().mockResolvedValue({ message: 'bad pipeline' })
		} as unknown as GPUDevice;

		try {
			await withErrorScope(device, 'validation', () => 'nope');
		} catch (err) {
			expect(err).toBeInstanceOf(Error);
			expect((err as Error).message).toContain('bad pipeline');
		}
	});

	it('works with async functions', async () => {
		expect.assertions(1);
		const device = {
			pushErrorScope: vi.fn(),
			popErrorScope: vi.fn().mockResolvedValue(null)
		} as unknown as GPUDevice;

		const result = await withErrorScope(device, 'out-of-memory', async () => {
			return 'async-result';
		});
		expect(result).toBe('async-result');
	});

	it('includes the filter type in the error message', async () => {
		expect.assertions(1);
		const device = {
			pushErrorScope: vi.fn(),
			popErrorScope: vi.fn().mockResolvedValue({ message: 'oops' })
		} as unknown as GPUDevice;

		try {
			await withErrorScope(device, 'internal', () => null);
		} catch (err) {
			expect((err as Error).message).toContain('internal');
		}
	});
});

describe('handleCompilationInfo', () => {
	it('returns empty array when there are no errors', () => {
		expect.assertions(1);
		const info = {
			messages: [
				{ type: 'warning', message: 'unused var', lineNum: 1, linePos: 0, offset: 0, length: 0 }
			]
		} as unknown as GPUCompilationInfo;
		expect(handleCompilationInfo(info)).toEqual([]);
	});

	it('extracts error messages with line info', () => {
		expect.assertions(2);
		const info = {
			messages: [
				{ type: 'error', message: 'syntax error', lineNum: 5, linePos: 10, offset: 0, length: 0 }
			]
		} as unknown as GPUCompilationInfo;
		const errors = handleCompilationInfo(info);
		expect(errors.length).toBe(1);
		expect(errors[0]).toContain('line 5');
	});

	it('handles multiple errors', () => {
		expect.assertions(1);
		const info = {
			messages: [
				{ type: 'error', message: 'err1', lineNum: 1, linePos: 0, offset: 0, length: 0 },
				{ type: 'info', message: 'note', lineNum: 0, linePos: 0, offset: 0, length: 0 },
				{ type: 'error', message: 'err2', lineNum: 3, linePos: 0, offset: 0, length: 0 }
			]
		} as unknown as GPUCompilationInfo;
		expect(handleCompilationInfo(info)).toHaveLength(2);
	});

	it('handles errors without line numbers', () => {
		expect.assertions(2);
		const info = {
			messages: [
				{ type: 'error', message: 'unknown error', lineNum: 0, linePos: 0, offset: 0, length: 0 }
			]
		} as unknown as GPUCompilationInfo;
		const errors = handleCompilationInfo(info);
		expect(errors.length).toBe(1);
		expect(errors[0]).not.toContain('line');
	});
});

describe('createCleanupHandle', () => {
	it('returns an object with destroy() and destroyed flag', () => {
		expect.assertions(2);
		const device = { destroy: vi.fn() } as unknown as GPUDevice;
		const handle = createCleanupHandle(device, []);
		expect(typeof handle.destroy).toBe('function');
		expect(handle.destroyed).toBe(false);
	});

	it('calls device.destroy() when destroy() is called', () => {
		expect.assertions(1);
		const device = { destroy: vi.fn() } as unknown as GPUDevice;
		const handle = createCleanupHandle(device, []);
		handle.destroy();
		expect(device.destroy).toHaveBeenCalledOnce();
	});

	it('destroys all tracked buffers', () => {
		expect.assertions(2);
		const device = { destroy: vi.fn() } as unknown as GPUDevice;
		const buf1 = { destroy: vi.fn() } as unknown as GPUBuffer;
		const buf2 = { destroy: vi.fn() } as unknown as GPUBuffer;
		const handle = createCleanupHandle(device, [buf1, buf2]);
		handle.destroy();
		expect(buf1.destroy).toHaveBeenCalledOnce();
		expect(buf2.destroy).toHaveBeenCalledOnce();
	});

	it('sets destroyed to true after destroy()', () => {
		expect.assertions(2);
		const device = { destroy: vi.fn() } as unknown as GPUDevice;
		const handle = createCleanupHandle(device, []);
		expect(handle.destroyed).toBe(false);
		handle.destroy();
		expect(handle.destroyed).toBe(true);
	});

	it('is idempotent — second destroy() is a no-op', () => {
		expect.assertions(2);
		const device = { destroy: vi.fn() } as unknown as GPUDevice;
		const buf = { destroy: vi.fn() } as unknown as GPUBuffer;
		const handle = createCleanupHandle(device, [buf]);
		handle.destroy();
		handle.destroy();
		expect(device.destroy).toHaveBeenCalledOnce();
		expect(buf.destroy).toHaveBeenCalledOnce();
	});

	it('clears the resources array so references can be GCd', () => {
		expect.assertions(1);
		const device = { destroy: vi.fn() } as unknown as GPUDevice;
		const resources: GPUBuffer[] = [
			{ destroy: vi.fn() } as unknown as GPUBuffer
		];
		const handle = createCleanupHandle(device, resources);
		handle.destroy();
		expect(resources.length).toBe(0);
	});
});
