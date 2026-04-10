import { mat4, vec3 } from 'gl-matrix';

/**
 * Options for creating a camera.
 */
export interface CameraOptions {
	position?: [number, number, number];
	yaw?: number;
	pitch?: number;
	fov?: number;
	near?: number;
	far?: number;
	speed?: number;
	sensitivity?: number;
	minSpeed?: number;
	maxSpeed?: number;
}

/**
 * FPS fly-around camera with WASD + mouse look.
 */
export interface Camera {
	/** Advance camera state by dt seconds based on current input. */
	update(dt: number): void;
	/** Return combined view-projection matrix as Float32Array(16). */
	getViewProjectionMatrix(): Float32Array;
	/** Register input event listeners on the canvas. */
	attach(): void;
	/** Remove all input event listeners. */
	detach(): void;
	/** Current position (read-only copy). */
	readonly position: Float32Array;
	/** Current yaw in radians. */
	readonly yaw: number;
	/** Current pitch in radians. */
	readonly pitch: number;
	/** Current movement speed. */
	readonly speed: number;
	/** Whether pointer lock is currently active. */
	readonly isLocked: boolean;
}

const DEG_TO_RAD = Math.PI / 180;
const DEFAULT_FOV = 75 * DEG_TO_RAD;
const DEFAULT_NEAR = 0.1;
const DEFAULT_FAR = 1000;
const DEFAULT_SPEED = 20;
const DEFAULT_SENSITIVITY = 0.002;
const DEFAULT_MIN_SPEED = 5;
const DEFAULT_MAX_SPEED = 100;
const PITCH_LIMIT = 89 * DEG_TO_RAD;

/**
 * Create an FPS fly-around camera attached to a canvas element.
 *
 * Input handlers are registered on the canvas (not document) to avoid conflicts.
 * Call `attach()` to start listening for input, `detach()` to clean up.
 */
export function createCamera(canvas: HTMLCanvasElement, options: CameraOptions = {}): Camera {
	// Internal state
	const pos = vec3.fromValues(
		options.position?.[0] ?? 0,
		options.position?.[1] ?? 10,
		options.position?.[2] ?? 50
	);
	let yaw = options.yaw ?? 0;
	let pitch = options.pitch ?? 0;
	let speed = options.speed ?? DEFAULT_SPEED;
	let locked = false;

	const fov = options.fov ?? DEFAULT_FOV;
	const near = options.near ?? DEFAULT_NEAR;
	const far = options.far ?? DEFAULT_FAR;
	const sensitivity = options.sensitivity ?? DEFAULT_SENSITIVITY;
	const minSpeed = options.minSpeed ?? DEFAULT_MIN_SPEED;
	const maxSpeed = options.maxSpeed ?? DEFAULT_MAX_SPEED;

	const keysDown = new Set<string>();

	// Reusable matrices and vectors
	const viewMatrix = mat4.create();
	const projMatrix = mat4.create();
	const vpMatrix = mat4.create();
	const forward = vec3.create();
	const right = vec3.create();
	const tempVec = vec3.create();

	// Event handler references (for detach)
	function onKeyDown(e: KeyboardEvent) {
		keysDown.add(e.code);
	}

	function onKeyUp(e: KeyboardEvent) {
		keysDown.delete(e.code);
	}

	function onMouseMove(e: MouseEvent) {
		if (!locked) return;
		yaw -= e.movementX * sensitivity;
		pitch -= e.movementY * sensitivity;
		pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
	}

	function onWheel(e: WheelEvent) {
		e.preventDefault();
		// Scroll down (positive deltaY) = decrease speed, scroll up = increase
		speed -= e.deltaY * 0.01;
		speed = Math.max(minSpeed, Math.min(maxSpeed, speed));
	}

	function onClick() {
		if (locked) {
			canvas.ownerDocument.exitPointerLock();
		} else {
			canvas.requestPointerLock();
		}
	}

	function onPointerLockChange() {
		const doc = canvas.ownerDocument;
		locked = doc.pointerLockElement === canvas;
		if (!locked) {
			keysDown.clear();
		}
	}

	function getForwardVec(): vec3 {
		forward[0] = -Math.sin(yaw) * Math.cos(pitch);
		forward[1] = Math.sin(pitch);
		forward[2] = -Math.cos(yaw) * Math.cos(pitch);
		return forward;
	}

	function getRightVec(): vec3 {
		right[0] = Math.cos(yaw);
		right[1] = 0;
		right[2] = -Math.sin(yaw);
		return right;
	}

	const camera: Camera = {
		update(dt: number) {
			const moveAmount = speed * dt;
			const fwd = getForwardVec();
			const rt = getRightVec();

			// Forward/backward
			if (keysDown.has('KeyW')) {
				vec3.scaleAndAdd(pos, pos, fwd, moveAmount);
			}
			if (keysDown.has('KeyS')) {
				vec3.scaleAndAdd(pos, pos, fwd, -moveAmount);
			}

			// Strafe left/right
			if (keysDown.has('KeyD')) {
				vec3.scaleAndAdd(pos, pos, rt, moveAmount);
			}
			if (keysDown.has('KeyA')) {
				vec3.scaleAndAdd(pos, pos, rt, -moveAmount);
			}

			// Up/down
			if (keysDown.has('Space') || keysDown.has('KeyE')) {
				pos[1] += moveAmount;
			}
			if (keysDown.has('ShiftLeft') || keysDown.has('ShiftRight') || keysDown.has('KeyQ')) {
				pos[1] -= moveAmount;
			}
		},

		getViewProjectionMatrix(): Float32Array {
			const aspect = canvas.width / canvas.height || 1;

			// Build view matrix: lookAt(pos, pos + forward, up)
			const fwd = getForwardVec();
			vec3.add(tempVec, pos, fwd);
			mat4.lookAt(viewMatrix, pos as vec3, tempVec, [0, 1, 0]);

			// Build projection with ZO (zero-to-one) depth for WebGPU
			mat4.perspectiveZO(projMatrix, fov, aspect, near, far);

			// Combine: projection * view
			mat4.multiply(vpMatrix, projMatrix, viewMatrix);

			return vpMatrix as Float32Array;
		},

		attach() {
			canvas.addEventListener('keydown', onKeyDown);
			canvas.addEventListener('keyup', onKeyUp);
			canvas.addEventListener('mousemove', onMouseMove);
			canvas.addEventListener('wheel', onWheel, { passive: false });
			canvas.addEventListener('click', onClick);
			canvas.ownerDocument.addEventListener('pointerlockchange', onPointerLockChange);

			// Canvas must be focusable to receive keyboard events
			if (!canvas.hasAttribute('tabindex')) {
				canvas.setAttribute('tabindex', '0');
			}
		},

		detach() {
			canvas.removeEventListener('keydown', onKeyDown);
			canvas.removeEventListener('keyup', onKeyUp);
			canvas.removeEventListener('mousemove', onMouseMove);
			canvas.removeEventListener('wheel', onWheel);
			canvas.removeEventListener('click', onClick);
			canvas.ownerDocument.removeEventListener('pointerlockchange', onPointerLockChange);
			keysDown.clear();
		},

		get position() {
			return new Float32Array(pos);
		},

		get yaw() {
			return yaw;
		},

		get pitch() {
			return pitch;
		},

		get speed() {
			return speed;
		},

		get isLocked() {
			return locked;
		}
	};

	return camera;
}
