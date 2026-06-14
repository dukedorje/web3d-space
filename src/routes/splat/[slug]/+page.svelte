<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import { createPlayCanvasApp, type PlayCanvasApp } from '$lib/playcanvas/create-app';
	import { getScene } from '$lib/splat/scenes';

	let canvas: HTMLCanvasElement;
	let loading = $state(true);
	let loadStatus = $state('Initializing...');
	let error: string | null = $state(null);
	let pcState: PlayCanvasApp | null = null;
	let debugInfo = $state('');
	let showDebug = $state(false);

	let sceneUpdate: ((dt: number, frame: number) => void) | undefined;
	let sceneCleanup: (() => void) | undefined;

	const scene = $derived(getScene($page.params.slug));

	function doCleanup() {
		try {
			sceneCleanup?.();
		} catch (err) {
			console.error('[scene] cleanup threw', err);
		}
		sceneCleanup = undefined;
		sceneUpdate = undefined;
		if (pcState) {
			pcState.app.destroy();
			pcState = null;
		}
	}

	beforeNavigate(() => doCleanup());
	onDestroy(() => doCleanup());

	onMount(() => {
		let destroyed = false;

		async function init() {
			if (!scene) {
				error = `Unknown scene: "${$page.params.slug}"`;
				loading = false;
				return;
			}

			try {
				pcState = await createPlayCanvasApp({ canvas });
			} catch (err) {
				error = `Init failed: ${err instanceof Error ? err.message : String(err)}`;
				loading = false;
				return;
			}

			if (destroyed) { doCleanup(); return; }

			const { pc, app } = pcState;

			loadStatus = 'Loading assets...';

			const sceneSetup = scene.setup(pc, app);
			const { assets, build, prepare } = sceneSetup;
			sceneUpdate = sceneSetup.update;
			sceneCleanup = sceneSetup.cleanup;

			const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
			const assetListPromise = new Promise<void>((resolve) => {
				assetListLoader.load(() => resolve());
			});
			const preparePromise = prepare
				? prepare((phase: string) => { loadStatus = phase; })
				: Promise.resolve();

			Promise.all([assetListPromise, preparePromise]).then(() => {
				if (destroyed || !pcState) return;

				if (!prepare) loadStatus = 'Building scene...';

				build();

				// Camera
				const camera = new pc.Entity('Camera');
				camera.addComponent('camera', {
					clearColor: new pc.Color(0.15, 0.15, 0.2),
					toneMapping: pc.TONEMAP_ACES,
					farClip: 500
				});
				camera.setLocalPosition(...scene.camera.position);
				app.root.addChild(camera);

				// Full render pipeline with depth map for mesh+splat compositing
				const cameraFrame = new pc.CameraFrame(app, camera.camera);
				cameraFrame.rendering.toneMapping = pc.TONEMAP_ACES;
				cameraFrame.rendering.sharpness = 0.5;
				cameraFrame.rendering.sceneDepthMap = true;
				cameraFrame.bloom.enabled = true;
				cameraFrame.bloom.intensity = 0.02;
				cameraFrame.taa.enabled = true;
				cameraFrame.vignette.enabled = true;
				cameraFrame.vignette.intensity = 0.3;
				cameraFrame.enabled = true;
				cameraFrame.update();

				// FPS fly-around camera with WASD + pointer lock
				let yaw = scene.camera.yaw;
				let pitch = scene.camera.pitch;
				const sensitivity = 0.15;
				let speed = 3;
				const minSpeed = 1;
				const maxSpeed = 30;
				let locked = false;
				const keysDown = new Set<string>();

				camera.setEulerAngles(pitch, yaw, 0);

				function updateLook() {
					camera.setEulerAngles(pitch, yaw, 0);
				}

				canvas.addEventListener('click', () => {
					if (locked) {
						document.exitPointerLock();
					} else {
						canvas.requestPointerLock();
					}
				});

				document.addEventListener('pointerlockchange', () => {
					locked = document.pointerLockElement === canvas;
					if (!locked) keysDown.clear();
				});

				window.addEventListener('mousemove', (e) => {
					if (!locked) return;
					yaw -= e.movementX * sensitivity;
					pitch = Math.max(-89, Math.min(89, pitch - e.movementY * sensitivity));
					updateLook();
				});

				canvas.addEventListener('wheel', (e) => {
					e.preventDefault();
					speed -= e.deltaY * 0.01;
					speed = Math.max(minSpeed, Math.min(maxSpeed, speed));
				}, { passive: false });

				canvas.addEventListener('keydown', (e) => {
					keysDown.add(e.code);
					if (e.code === 'KeyC' && !e.ctrlKey && !e.metaKey) {
						showDebug = !showDebug;
					}
					if (e.code === 'KeyP' && !e.ctrlKey && !e.metaKey) {
						const pos = camera.getPosition();
						const cfg = `camera: { position: [${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}], yaw: ${Math.round(yaw)}, pitch: ${Math.round(pitch)} }`;
						navigator.clipboard.writeText(cfg);
						debugInfo = `Copied! ${cfg}`;
					}
				});
				canvas.addEventListener('keyup', (e) => { keysDown.delete(e.code); });
				if (!canvas.hasAttribute('tabindex')) {
					canvas.setAttribute('tabindex', '0');
				}

				let lastTime = performance.now();
				let frameIdx = 0;
				function movementLoop() {
					const now = performance.now();
					const dt = (now - lastTime) / 1000;
					lastTime = now;

					if (sceneUpdate) {
						try {
							sceneUpdate(dt, frameIdx);
						} catch (err) {
							console.error('[scene] update threw', err);
							sceneUpdate = undefined;
						}
					}
					frameIdx++;

					const moveAmount = speed * dt;
					const pos = camera.getPosition().clone();
					const forward = camera.forward.clone();
					const right = camera.right.clone();

					if (keysDown.has('KeyW')) pos.add(forward.clone().mulScalar(moveAmount));
					if (keysDown.has('KeyS')) pos.add(forward.clone().mulScalar(-moveAmount));
					if (keysDown.has('KeyD')) pos.add(right.clone().mulScalar(moveAmount));
					if (keysDown.has('KeyA')) pos.add(right.clone().mulScalar(-moveAmount));
					if (keysDown.has('Space') || keysDown.has('KeyE')) pos.y += moveAmount;
					if (keysDown.has('ShiftLeft') || keysDown.has('ShiftRight') || keysDown.has('KeyQ')) pos.y -= moveAmount;

					camera.setPosition(pos);
					if (showDebug) {
						debugInfo = `pos: [${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}]  yaw: ${Math.round(yaw)}  pitch: ${Math.round(pitch)}  speed: ${speed.toFixed(1)}`;
					}
					requestAnimationFrame(movementLoop);
				}
				requestAnimationFrame(movementLoop);

				// Touch look-around
				let lastTouchX = 0, lastTouchY = 0;
				canvas.addEventListener('touchstart', (e) => {
					if (e.touches.length === 1) {
						lastTouchX = e.touches[0].clientX;
						lastTouchY = e.touches[0].clientY;
					}
				});
				canvas.addEventListener('touchmove', (e) => {
					e.preventDefault();
					if (e.touches.length === 1) {
						const dx = e.touches[0].clientX - lastTouchX;
						const dy = e.touches[0].clientY - lastTouchY;
						yaw -= dx * sensitivity;
						pitch = Math.max(-89, Math.min(89, pitch - dy * sensitivity));
						lastTouchX = e.touches[0].clientX;
						lastTouchY = e.touches[0].clientY;
						updateLook();
					}
				}, { passive: false });

				loading = false;
			});
		}

		init();

		return () => {
			destroyed = true;
			doCleanup();
		};
	});
</script>

<svelte:head>
	<title>{scene?.title ?? 'Splat'} — Gaussian Splat Viewer</title>
</svelte:head>

{#if loading}
	<div class="loading">
		<p>{loadStatus}</p>
	</div>
{/if}

{#if error}
	<div class="error">
		<p>Error</p>
		<p>{error}</p>
	</div>
{/if}

<canvas bind:this={canvas}></canvas>

<a href="/splat" class="back-link">&larr; Back</a>

{#if showDebug}
	<div class="debug">
		{debugInfo}
		<br /><span class="hint">P = copy camera config &middot; C = toggle</span>
	</div>
{/if}

<div class="info">
	<span>Click to lock mouse &middot; WASD to move &middot; Q/E or Shift/Space for up/down &middot; Scroll = speed &middot; C = debug</span>
</div>

<style>
	canvas {
		display: block;
		width: 100%;
		height: 100vh;
	}

	.loading {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 20, 0.85);
		color: #aac;
		font-family: monospace;
		font-size: 1.2rem;
		z-index: 15;
	}

	.error {
		position: fixed;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: #1a0a0a;
		color: #ff6b6b;
		font-family: monospace;
		font-size: 1.2rem;
		z-index: 10;
	}

	.error p:first-child {
		font-size: 1.5rem;
		font-weight: bold;
		margin-bottom: 0.5rem;
	}

	.back-link {
		position: fixed;
		top: 1rem;
		left: 1rem;
		font-family: monospace;
		font-size: 0.8rem;
		color: #8af;
		background: rgba(10, 10, 30, 0.7);
		border: 1px solid rgba(100, 160, 255, 0.3);
		padding: 0.35rem 0.75rem;
		text-decoration: none;
		z-index: 5;
	}

	.back-link:hover {
		background: rgba(20, 30, 60, 0.9);
		border-color: rgba(100, 160, 255, 0.6);
	}

	.debug {
		position: fixed;
		top: 1rem;
		right: 1rem;
		font-family: monospace;
		font-size: 0.75rem;
		color: #0f0;
		background: rgba(0, 0, 0, 0.7);
		border: 1px solid rgba(0, 255, 0, 0.3);
		padding: 0.5rem 0.75rem;
		z-index: 10;
		white-space: pre;
	}

	.debug .hint {
		color: #0a0;
		font-size: 0.65rem;
	}

	.info {
		position: fixed;
		bottom: 1rem;
		left: 50%;
		transform: translateX(-50%);
		background: rgba(10, 10, 30, 0.7);
		border: 1px solid rgba(255, 255, 255, 0.15);
		padding: 0.5rem 1rem;
		font-family: monospace;
		font-size: 0.75rem;
		color: #889;
		z-index: 5;
		white-space: nowrap;
	}
</style>
