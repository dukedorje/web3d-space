import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCamera, type Camera } from './camera.js';
import { mat4 } from 'gl-matrix';

/** Create a minimal mock canvas for testing with a mock ownerDocument. */
function mockCanvas(width = 800, height = 600): HTMLCanvasElement & {
	_listeners: Record<string, EventListener[]>;
	_fire(type: string, event: Partial<Event>): void;
	_mockDoc: {
		pointerLockElement: HTMLCanvasElement | null;
		_listeners: Record<string, EventListener[]>;
		_fire(type: string, event: Partial<Event>): void;
	};
} {
	const listeners: Record<string, EventListener[]> = {};
	const docListeners: Record<string, EventListener[]> = {};

	const mockDoc = {
		pointerLockElement: null as HTMLCanvasElement | null,
		_listeners: docListeners,
		addEventListener: vi.fn((type: string, fn: EventListener) => {
			(docListeners[type] ??= []).push(fn);
		}),
		removeEventListener: vi.fn((type: string, fn: EventListener) => {
			const arr = docListeners[type];
			if (arr) {
				const idx = arr.indexOf(fn);
				if (idx >= 0) arr.splice(idx, 1);
			}
		}),
		_fire(type: string, event: Partial<Event>) {
			for (const fn of docListeners[type] ?? []) {
				fn(event as Event);
			}
		}
	};

	const canvas = {
		width,
		height,
		ownerDocument: mockDoc,
		addEventListener: vi.fn((type: string, fn: EventListener) => {
			(listeners[type] ??= []).push(fn);
		}),
		removeEventListener: vi.fn((type: string, fn: EventListener) => {
			const arr = listeners[type];
			if (arr) {
				const idx = arr.indexOf(fn);
				if (idx >= 0) arr.splice(idx, 1);
			}
		}),
		requestPointerLock: vi.fn(),
		hasAttribute: vi.fn(() => false),
		setAttribute: vi.fn(),
		_listeners: listeners,
		_mockDoc: mockDoc,
		_fire(type: string, event: Partial<Event>) {
			for (const fn of listeners[type] ?? []) {
				fn(event as Event);
			}
		}
	} as unknown as HTMLCanvasElement & {
		_listeners: Record<string, EventListener[]>;
		_fire(type: string, event: Partial<Event>): void;
		_mockDoc: typeof mockDoc;
	};
	return canvas;
}

describe('createCamera', () => {
	let canvas: ReturnType<typeof mockCanvas>;
	let camera: Camera;

	beforeEach(() => {
		canvas = mockCanvas();
		camera = createCamera(canvas);
	});

	describe('default state', () => {
		it('has default position [0, 10, 50]', () => {
			expect.assertions(1);
			expect(Array.from(camera.position)).toEqual([0, 10, 50]);
		});

		it('has default yaw and pitch of 0', () => {
			expect.assertions(2);
			expect(camera.yaw).toBe(0);
			expect(camera.pitch).toBe(0);
		});

		it('has default speed of 20', () => {
			expect.assertions(1);
			expect(camera.speed).toBe(20);
		});

		it('is not pointer-locked by default', () => {
			expect.assertions(1);
			expect(camera.isLocked).toBe(false);
		});
	});

	describe('custom options', () => {
		it('accepts custom position', () => {
			expect.assertions(1);
			const cam = createCamera(canvas, { position: [1, 2, 3] });
			expect(Array.from(cam.position)).toEqual([1, 2, 3]);
		});

		it('accepts custom speed', () => {
			expect.assertions(1);
			const cam = createCamera(canvas, { speed: 50 });
			expect(cam.speed).toBe(50);
		});

		it('accepts custom yaw and pitch', () => {
			expect.assertions(2);
			const cam = createCamera(canvas, { yaw: 1.0, pitch: 0.5 });
			expect(cam.yaw).toBe(1.0);
			expect(cam.pitch).toBe(0.5);
		});
	});

	describe('getViewProjectionMatrix', () => {
		it('returns a Float32Array of length 16', () => {
			expect.assertions(2);
			const vp = camera.getViewProjectionMatrix();
			expect(vp).toBeInstanceOf(Float32Array);
			expect(vp.length).toBe(16);
		});

		it('returns a valid matrix (non-zero determinant)', () => {
			expect.assertions(2);
			const vp = camera.getViewProjectionMatrix();
			const det = mat4.determinant(vp);
			expect(det).not.toBe(0);
			expect(Number.isFinite(det)).toBe(true);
		});

		it('changes when position changes', () => {
			expect.assertions(1);
			const vp1 = Float32Array.from(camera.getViewProjectionMatrix());
			camera.attach();
			// Simulate W key press
			canvas._fire('keydown', { code: 'KeyW' } as Partial<KeyboardEvent>);
			camera.update(1.0);
			const vp2 = camera.getViewProjectionMatrix();

			let different = false;
			for (let i = 0; i < 16; i++) {
				if (vp1[i] !== vp2[i]) {
					different = true;
					break;
				}
			}
			expect(different).toBe(true);
		});

		it('uses perspective projection with ZO depth range', () => {
			expect.assertions(2);
			const vp = camera.getViewProjectionMatrix();
			expect(vp).toBeInstanceOf(Float32Array);
			// For a perspective matrix, element [3][2] should be non-zero
			// (it's the perspective divide term)
			expect(vp[11]).not.toBe(0);
		});
	});

	describe('movement', () => {
		beforeEach(() => {
			camera.attach();
		});

		afterEach(() => {
			camera.detach();
		});

		it('moves forward along look direction when W is pressed', () => {
			expect.assertions(2);
			const posBefore = Array.from(camera.position);
			canvas._fire('keydown', { code: 'KeyW' } as Partial<KeyboardEvent>);
			camera.update(1.0);
			const posAfter = Array.from(camera.position);

			// Default yaw=0, pitch=0 means forward is [0, 0, -1]
			// So Z should decrease
			expect(posAfter[2]).toBeLessThan(posBefore[2]);
			// X should stay the same
			expect(posAfter[0]).toBeCloseTo(posBefore[0], 5);
		});

		it('moves backward when S is pressed', () => {
			expect.assertions(1);
			const posBefore = Array.from(camera.position);
			canvas._fire('keydown', { code: 'KeyS' } as Partial<KeyboardEvent>);
			camera.update(1.0);
			const posAfter = Array.from(camera.position);

			expect(posAfter[2]).toBeGreaterThan(posBefore[2]);
		});

		it('strafes right when D is pressed', () => {
			expect.assertions(1);
			const posBefore = Array.from(camera.position);
			canvas._fire('keydown', { code: 'KeyD' } as Partial<KeyboardEvent>);
			camera.update(1.0);
			const posAfter = Array.from(camera.position);

			expect(posAfter[0]).toBeGreaterThan(posBefore[0]);
		});

		it('strafes left when A is pressed', () => {
			expect.assertions(1);
			const posBefore = Array.from(camera.position);
			canvas._fire('keydown', { code: 'KeyA' } as Partial<KeyboardEvent>);
			camera.update(1.0);
			const posAfter = Array.from(camera.position);

			expect(posAfter[0]).toBeLessThan(posBefore[0]);
		});

		it('moves up when Space is pressed', () => {
			expect.assertions(1);
			const posBefore = Array.from(camera.position);
			canvas._fire('keydown', { code: 'Space' } as Partial<KeyboardEvent>);
			camera.update(1.0);
			const posAfter = Array.from(camera.position);

			expect(posAfter[1]).toBeGreaterThan(posBefore[1]);
		});

		it('moves up when E is pressed', () => {
			expect.assertions(1);
			const posBefore = Array.from(camera.position);
			canvas._fire('keydown', { code: 'KeyE' } as Partial<KeyboardEvent>);
			camera.update(1.0);
			const posAfter = Array.from(camera.position);

			expect(posAfter[1]).toBeGreaterThan(posBefore[1]);
		});

		it('moves down when ShiftLeft is pressed', () => {
			expect.assertions(1);
			const posBefore = Array.from(camera.position);
			canvas._fire('keydown', { code: 'ShiftLeft' } as Partial<KeyboardEvent>);
			camera.update(1.0);
			const posAfter = Array.from(camera.position);

			expect(posAfter[1]).toBeLessThan(posBefore[1]);
		});

		it('moves down when Q is pressed', () => {
			expect.assertions(1);
			const posBefore = Array.from(camera.position);
			canvas._fire('keydown', { code: 'KeyQ' } as Partial<KeyboardEvent>);
			camera.update(1.0);
			const posAfter = Array.from(camera.position);

			expect(posAfter[1]).toBeLessThan(posBefore[1]);
		});

		it('stops moving when key is released', () => {
			expect.assertions(1);
			canvas._fire('keydown', { code: 'KeyW' } as Partial<KeyboardEvent>);
			camera.update(1.0);
			canvas._fire('keyup', { code: 'KeyW' } as Partial<KeyboardEvent>);

			const posBefore = Array.from(camera.position);
			camera.update(1.0);
			const posAfter = Array.from(camera.position);

			expect(posAfter).toEqual(posBefore);
		});

		it('movement scales with dt', () => {
			expect.assertions(1);
			canvas._fire('keydown', { code: 'KeyW' } as Partial<KeyboardEvent>);

			const startPos = Array.from(camera.position);
			camera.update(0.5);
			const halfStep = Array.from(camera.position);

			// Reset
			const cam2 = createCamera(canvas, {
				position: [startPos[0], startPos[1], startPos[2]] as [number, number, number]
			});
			cam2.attach();
			canvas._fire('keydown', { code: 'KeyW' } as Partial<KeyboardEvent>);
			cam2.update(1.0);
			const fullStep = Array.from(cam2.position);

			// Half-step movement should be half of full-step movement
			const halfDist = Math.abs(halfStep[2] - startPos[2]);
			const fullDist = Math.abs(fullStep[2] - startPos[2]);
			expect(halfDist).toBeCloseTo(fullDist / 2, 5);
		});

		it('movement scales with speed', () => {
			expect.assertions(1);
			const slowCam = createCamera(canvas, { speed: 10, position: [0, 10, 50] });
			const fastCam = createCamera(canvas, { speed: 40, position: [0, 10, 50] });
			slowCam.attach();
			fastCam.attach();

			canvas._fire('keydown', { code: 'KeyW' } as Partial<KeyboardEvent>);
			slowCam.update(1.0);
			fastCam.update(1.0);

			const slowDist = Math.abs(slowCam.position[2] - 50);
			const fastDist = Math.abs(fastCam.position[2] - 50);
			expect(fastDist).toBeCloseTo(slowDist * 4, 5);
		});
	});

	describe('mouse look', () => {
		beforeEach(() => {
			camera.attach();
		});

		afterEach(() => {
			camera.detach();
		});

		function simulatePointerLock() {
			canvas._mockDoc.pointerLockElement = canvas;
			canvas._mockDoc._fire('pointerlockchange', {});
		}

		function simulatePointerUnlock() {
			canvas._mockDoc.pointerLockElement = null;
			canvas._mockDoc._fire('pointerlockchange', {});
		}

		it('does not update yaw/pitch when not locked', () => {
			expect.assertions(2);
			canvas._fire('mousemove', { movementX: 100, movementY: 100 } as Partial<MouseEvent>);
			expect(camera.yaw).toBe(0);
			expect(camera.pitch).toBe(0);
		});

		it('updates yaw and pitch when pointer is locked', () => {
			expect.assertions(3);
			simulatePointerLock();
			expect(camera.isLocked).toBe(true);

			canvas._fire('mousemove', { movementX: 100, movementY: 50 } as Partial<MouseEvent>);

			expect(camera.yaw).not.toBe(0);
			expect(camera.pitch).not.toBe(0);
		});

		it('applies sensitivity to mouse movement', () => {
			expect.assertions(1);
			const sensitivity = 0.002;
			simulatePointerLock();

			canvas._fire('mousemove', { movementX: 100, movementY: 0 } as Partial<MouseEvent>);

			expect(camera.yaw).toBeCloseTo(-100 * sensitivity, 5);
		});

		it('stops updating when pointer lock is released', () => {
			expect.assertions(2);
			simulatePointerLock();
			canvas._fire('mousemove', { movementX: 50, movementY: 0 } as Partial<MouseEvent>);
			const yawAfterLock = camera.yaw;

			simulatePointerUnlock();
			expect(camera.isLocked).toBe(false);

			canvas._fire('mousemove', { movementX: 100, movementY: 0 } as Partial<MouseEvent>);
			expect(camera.yaw).toBe(yawAfterLock);
		});

		it('requests pointer lock on canvas click', () => {
			expect.assertions(1);
			canvas._fire('click', {});
			expect(canvas.requestPointerLock as ReturnType<typeof vi.fn>).toHaveBeenCalled();
		});
	});

	describe('pitch clamping', () => {
		beforeEach(() => {
			camera.attach();
			// Lock pointer
			canvas._mockDoc.pointerLockElement = canvas;
			canvas._mockDoc._fire('pointerlockchange', {});
		});

		afterEach(() => {
			camera.detach();
		});

		it('clamps pitch to prevent looking past straight up', () => {
			expect.assertions(2);
			canvas._fire('mousemove', { movementX: 0, movementY: -100000 } as Partial<MouseEvent>);
			const maxPitch = 89 * (Math.PI / 180);
			expect(camera.pitch).toBeLessThanOrEqual(maxPitch);
			expect(camera.pitch).toBeCloseTo(maxPitch, 5);
		});

		it('clamps pitch to prevent looking past straight down', () => {
			expect.assertions(2);
			canvas._fire('mousemove', { movementX: 0, movementY: 100000 } as Partial<MouseEvent>);
			const minPitch = -89 * (Math.PI / 180);
			expect(camera.pitch).toBeGreaterThanOrEqual(minPitch);
			expect(camera.pitch).toBeCloseTo(minPitch, 5);
		});
	});

	describe('scroll speed adjustment', () => {
		beforeEach(() => {
			camera.attach();
		});

		afterEach(() => {
			camera.detach();
		});

		it('decreases speed on scroll down', () => {
			expect.assertions(1);
			const initialSpeed = camera.speed;
			canvas._fire('wheel', { deltaY: 100, preventDefault: vi.fn() } as Partial<WheelEvent>);
			expect(camera.speed).toBeLessThan(initialSpeed);
		});

		it('increases speed on scroll up', () => {
			expect.assertions(1);
			const initialSpeed = camera.speed;
			canvas._fire('wheel', { deltaY: -100, preventDefault: vi.fn() } as Partial<WheelEvent>);
			expect(camera.speed).toBeGreaterThan(initialSpeed);
		});

		it('clamps speed to minimum', () => {
			expect.assertions(1);
			for (let i = 0; i < 100; i++) {
				canvas._fire('wheel', { deltaY: 1000, preventDefault: vi.fn() } as Partial<WheelEvent>);
			}
			expect(camera.speed).toBe(5);
		});

		it('clamps speed to maximum', () => {
			expect.assertions(1);
			for (let i = 0; i < 100; i++) {
				canvas._fire('wheel', { deltaY: -1000, preventDefault: vi.fn() } as Partial<WheelEvent>);
			}
			expect(camera.speed).toBe(100);
		});

		it('respects custom min/max speed', () => {
			expect.assertions(2);
			const cam = createCamera(canvas, { speed: 50, minSpeed: 10, maxSpeed: 60 });
			cam.attach();

			for (let i = 0; i < 100; i++) {
				canvas._fire('wheel', { deltaY: -1000, preventDefault: vi.fn() } as Partial<WheelEvent>);
			}
			expect(cam.speed).toBe(60);

			for (let i = 0; i < 200; i++) {
				canvas._fire('wheel', { deltaY: 1000, preventDefault: vi.fn() } as Partial<WheelEvent>);
			}
			expect(cam.speed).toBe(10);
		});
	});

	describe('attach / detach', () => {
		it('registers event listeners on attach', () => {
			expect.assertions(1);
			camera.attach();
			expect(canvas.addEventListener).toHaveBeenCalled();
		});

		it('sets tabindex on canvas for keyboard focus', () => {
			expect.assertions(1);
			camera.attach();
			expect(canvas.setAttribute).toHaveBeenCalledWith('tabindex', '0');
		});

		it('removes event listeners on detach', () => {
			expect.assertions(1);
			camera.attach();
			camera.detach();
			expect(canvas.removeEventListener).toHaveBeenCalled();
		});

		it('clears key state on detach', () => {
			expect.assertions(1);
			camera.attach();
			canvas._fire('keydown', { code: 'KeyW' } as Partial<KeyboardEvent>);
			camera.detach();

			const posBefore = Array.from(camera.position);
			camera.update(1.0);
			const posAfter = Array.from(camera.position);
			expect(posAfter).toEqual(posBefore);
		});
	});
});
