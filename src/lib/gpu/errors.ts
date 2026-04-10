/// <reference types="@webgpu/types" />

const OVERLAY_ID = 'gpu-error-overlay';

/**
 * Show a DOM error overlay with the given message.
 * Creates the overlay if it doesn't exist, or updates the message if it does.
 * Works imperatively (no Svelte dependency) so it functions even if Svelte fails.
 */
export function showErrorOverlay(message: string): void {
	if (typeof document === 'undefined') return;

	let overlay = document.getElementById(OVERLAY_ID);
	if (!overlay) {
		overlay = document.createElement('div');
		overlay.id = OVERLAY_ID;
		Object.assign(overlay.style, {
			position: 'fixed',
			inset: '0',
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			justifyContent: 'center',
			background: '#1a0a0a',
			color: '#ff6b6b',
			fontFamily: 'monospace',
			fontSize: '1.2rem',
			zIndex: '9999',
			padding: '2rem'
		});
		document.body.appendChild(overlay);
	}

	const title = document.createElement('p');
	Object.assign(title.style, {
		fontSize: '1.5rem',
		fontWeight: 'bold',
		marginBottom: '0.5rem'
	});
	title.textContent = 'WebGPU Error';

	const body = document.createElement('p');
	body.style.maxWidth = '600px';
	body.style.textAlign = 'center';
	body.textContent = message;

	overlay.innerHTML = '';
	overlay.appendChild(title);
	overlay.appendChild(body);
}

/**
 * Remove the error overlay from the DOM, if present.
 */
export function hideErrorOverlay(): void {
	if (typeof document === 'undefined') return;
	document.getElementById(OVERLAY_ID)?.remove();
}

/**
 * Wrap a GPU operation in pushErrorScope/popErrorScope for the given filter.
 * Returns the result of `fn`, or throws if a GPU error was captured.
 */
export async function withErrorScope<T>(
	device: GPUDevice,
	filter: GPUErrorFilter,
	fn: () => T | Promise<T>
): Promise<T> {
	device.pushErrorScope(filter);
	const result = await fn();
	const error = await device.popErrorScope();
	if (error) {
		const message = error.message || 'Unknown GPU error';
		throw new Error(`GPU ${filter} error: ${message}`);
	}
	return result;
}

/**
 * Extract error messages from a GPUCompilationInfo result.
 * Returns an array of error message strings (empty if no errors).
 */
export function handleCompilationInfo(info: GPUCompilationInfo): string[] {
	const errors: string[] = [];
	for (const msg of info.messages) {
		if (msg.type === 'error') {
			const location = msg.lineNum
				? ` (line ${msg.lineNum}, col ${msg.linePos})`
				: '';
			errors.push(`Shader error${location}: ${msg.message}`);
		}
	}
	return errors;
}

export interface CleanupHandle {
	/** Call to destroy the device and release all tracked resources. Idempotent. */
	destroy: () => void;
	/** Whether destroy() has already been called. */
	readonly destroyed: boolean;
}

/**
 * Create a cleanup handle that destroys the GPU device and nulls buffer references.
 * Calling destroy() multiple times is safe (idempotent).
 */
export function createCleanupHandle(
	device: GPUDevice,
	resources: GPUBuffer[]
): CleanupHandle {
	let destroyed = false;

	return {
		get destroyed() {
			return destroyed;
		},
		destroy() {
			if (destroyed) return;
			destroyed = true;

			for (const buffer of resources) {
				buffer.destroy();
			}
			// Clear the array so references can be GC'd
			resources.length = 0;

			device.destroy();
		}
	};
}
