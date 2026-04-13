/**
 * Simple orbit camera controller for PlayCanvas.
 * Handles mouse drag, scroll zoom, and touch gestures.
 * No dependency on PlayCanvas's script system.
 */
import type { Entity, Vec3 as Vec3Type } from 'playcanvas';

export interface OrbitCameraOptions {
	/** Initial yaw angle in degrees */
	yaw?: number;
	/** Initial pitch angle in degrees */
	pitch?: number;
	/** Initial distance from target */
	distance?: number;
	/** Orbit target point [x, y, z] */
	target?: [number, number, number];
	/** Min zoom distance */
	minDistance?: number;
	/** Max zoom distance */
	maxDistance?: number;
	/** Mouse sensitivity multiplier */
	sensitivity?: number;
}

export interface OrbitCamera {
	/** Update the camera entity position/rotation */
	update(): void;
	/** Set the orbit target */
	setTarget(x: number, y: number, z: number): void;
	/** Clean up event listeners */
	destroy(): void;
	/** Current yaw angle */
	yaw: number;
	/** Current pitch angle */
	pitch: number;
	/** Current distance */
	distance: number;
}

export function createOrbitCamera(
	canvas: HTMLCanvasElement,
	cameraEntity: Entity,
	pc: typeof import('playcanvas'),
	options: OrbitCameraOptions = {}
): OrbitCamera {
	let yaw = options.yaw ?? -45;
	let pitch = options.pitch ?? -15;
	let distance = options.distance ?? 6;
	const minDist = options.minDistance ?? 0.5;
	const maxDist = options.maxDistance ?? 100;
	const sens = options.sensitivity ?? 0.3;
	const target = new pc.Vec3(
		options.target?.[0] ?? 0,
		options.target?.[1] ?? 1,
		options.target?.[2] ?? 0
	);

	let dragging = false;

	function update() {
		const DEG_TO_RAD = Math.PI / 180;
		const yawRad = yaw * DEG_TO_RAD;
		const pitchRad = pitch * DEG_TO_RAD;
		const cosPitch = Math.cos(pitchRad);
		cameraEntity.setPosition(
			target.x + distance * cosPitch * Math.sin(yawRad),
			target.y + distance * Math.sin(pitchRad),
			target.z + distance * cosPitch * Math.cos(yawRad)
		);
		cameraEntity.lookAt(target as unknown as Vec3Type);
	}

	// Mouse
	const onMouseDown = (e: MouseEvent) => {
		if (e.button === 0) dragging = true;
	};
	const onMouseUp = () => {
		dragging = false;
	};
	const onMouseMove = (e: MouseEvent) => {
		if (!dragging) return;
		yaw -= e.movementX * sens;
		pitch = Math.max(-89, Math.min(89, pitch - e.movementY * sens));
		update();
	};
	const onWheel = (e: WheelEvent) => {
		e.preventDefault();
		distance = Math.max(minDist, Math.min(maxDist, distance + e.deltaY * 0.01));
		update();
	};

	canvas.addEventListener('mousedown', onMouseDown);
	window.addEventListener('mouseup', onMouseUp);
	window.addEventListener('mousemove', onMouseMove);
	canvas.addEventListener('wheel', onWheel, { passive: false });

	// Touch
	let lastTouchX = 0;
	let lastTouchY = 0;
	let lastPinchDist = 0;

	const onTouchStart = (e: TouchEvent) => {
		if (e.touches.length === 1) {
			lastTouchX = e.touches[0].clientX;
			lastTouchY = e.touches[0].clientY;
		} else if (e.touches.length === 2) {
			const dx = e.touches[1].clientX - e.touches[0].clientX;
			const dy = e.touches[1].clientY - e.touches[0].clientY;
			lastPinchDist = Math.sqrt(dx * dx + dy * dy);
		}
	};
	const onTouchMove = (e: TouchEvent) => {
		e.preventDefault();
		if (e.touches.length === 1) {
			const dx = e.touches[0].clientX - lastTouchX;
			const dy = e.touches[0].clientY - lastTouchY;
			yaw -= dx * sens;
			pitch = Math.max(-89, Math.min(89, pitch - dy * sens));
			lastTouchX = e.touches[0].clientX;
			lastTouchY = e.touches[0].clientY;
			update();
		} else if (e.touches.length === 2) {
			const dx = e.touches[1].clientX - e.touches[0].clientX;
			const dy = e.touches[1].clientY - e.touches[0].clientY;
			const pinchDist = Math.sqrt(dx * dx + dy * dy);
			distance = Math.max(minDist, Math.min(maxDist, distance - (pinchDist - lastPinchDist) * 0.02));
			lastPinchDist = pinchDist;
			update();
		}
	};

	canvas.addEventListener('touchstart', onTouchStart);
	canvas.addEventListener('touchmove', onTouchMove, { passive: false });

	// Initial position
	update();

	return {
		update,
		setTarget(x: number, y: number, z: number) {
			target.set(x, y, z);
			update();
		},
		destroy() {
			canvas.removeEventListener('mousedown', onMouseDown);
			window.removeEventListener('mouseup', onMouseUp);
			window.removeEventListener('mousemove', onMouseMove);
			canvas.removeEventListener('wheel', onWheel);
			canvas.removeEventListener('touchstart', onTouchStart);
			canvas.removeEventListener('touchmove', onTouchMove);
		},
		get yaw() { return yaw; },
		set yaw(v) { yaw = v; },
		get pitch() { return pitch; },
		set pitch(v) { pitch = v; },
		get distance() { return distance; },
		set distance(v) { distance = v; }
	};
}
