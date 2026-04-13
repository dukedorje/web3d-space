<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { createPlayCanvasApp, type PlayCanvasApp } from '$lib/playcanvas/create-app';

	const ASSET_BASE = 'https://raw.githubusercontent.com/playcanvas/engine/main/examples/assets';

	let canvas: HTMLCanvasElement;
	let loading = $state(true);
	let loadStatus = $state('Initializing...');
	let error: string | null = $state(null);
	let pcState: PlayCanvasApp | null = null;

	function doCleanup() {
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

			// Assets: VR gallery mesh + splat objects
			const assets = {
				gallery: new pc.Asset('gallery', 'container', {
					url: `${ASSET_BASE}/models/vr-gallery.glb`
				}),
				guitar: new pc.Asset('guitar', 'gsplat', {
					url: `${ASSET_BASE}/splats/guitar.compressed.ply`
				}),
				biker: new pc.Asset('biker', 'gsplat', {
					url: `${ASSET_BASE}/splats/biker.compressed.ply`
				}),
				skull: new pc.Asset('skull', 'gsplat', {
					url: `${ASSET_BASE}/splats/skull.sog`
				})
			};

			const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
			assetListLoader.load(() => {
				if (destroyed || !pcState) return;

				loadStatus = 'Building scene...';

				// Gallery mesh — this is the structural environment
				const galleryEntity = assets.gallery.resource.instantiateRenderEntity();
				app.root.addChild(galleryEntity);

				// Place splat objects inside the gallery
				const guitar = new pc.Entity('guitar');
				guitar.addComponent('gsplat', { asset: assets.guitar });
				guitar.setLocalPosition(0, 0.8, 0);
				guitar.setLocalEulerAngles(0, 0, 180);
				guitar.setLocalScale(0.4, 0.4, 0.4);
				app.root.addChild(guitar);

				const biker = new pc.Entity('biker');
				biker.addComponent('gsplat', { asset: assets.biker });
				biker.setLocalPosition(-1.5, 0.05, 0);
				biker.setLocalEulerAngles(180, 90, 0);
				biker.setLocalScale(0.7, 0.7, 0.7);
				app.root.addChild(biker);

				const skull = new pc.Entity('skull');
				skull.addComponent('gsplat', { asset: assets.skull });
				skull.setLocalPosition(1.5, 0.05, 0);
				skull.setLocalEulerAngles(180, 90, 0);
				skull.setLocalScale(0.7, 0.7, 0.7);
				skull.rotate(0, 150, 0);
				app.root.addChild(skull);

				// Camera
				const camera = new pc.Entity('Camera');
				camera.addComponent('camera', {
					clearColor: new pc.Color(0.15, 0.15, 0.2),
					toneMapping: pc.TONEMAP_ACES,
					farClip: 500
				});
				camera.setLocalPosition(-3, 1.5, 2);
				app.root.addChild(camera);

				// Full render pipeline with depth map for mesh+splat compositing
				const cameraFrame = new pc.CameraFrame(app, camera.camera);
				cameraFrame.rendering.toneMapping = pc.TONEMAP_ACES;
				cameraFrame.rendering.sharpness = 0.5;
				cameraFrame.rendering.sceneDepthMap = true; // enables depth prepass for mesh-occludes-splat
				cameraFrame.bloom.enabled = true;
				cameraFrame.bloom.intensity = 0.02;
				cameraFrame.taa.enabled = true;
				cameraFrame.vignette.enabled = true;
				cameraFrame.vignette.intensity = 0.3;
				cameraFrame.enabled = true;
				cameraFrame.update();

				// FPS fly-around camera with WASD + pointer lock
				let yaw = 150;
				let pitch = -5;
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

				// Pointer lock for mouse look
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

				// Scroll to adjust movement speed
				canvas.addEventListener('wheel', (e) => {
					e.preventDefault();
					speed -= e.deltaY * 0.01;
					speed = Math.max(minSpeed, Math.min(maxSpeed, speed));
				}, { passive: false });

				// WASD + Q/E keyboard movement
				canvas.addEventListener('keydown', (e) => { keysDown.add(e.code); });
				canvas.addEventListener('keyup', (e) => { keysDown.delete(e.code); });
				if (!canvas.hasAttribute('tabindex')) {
					canvas.setAttribute('tabindex', '0');
				}

				// Movement update loop
				let lastTime = performance.now();
				function movementLoop() {
					const now = performance.now();
					const dt = (now - lastTime) / 1000;
					lastTime = now;

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
	<title>Hybrid Mesh+Splat Gallery — PlayCanvas</title>
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

<div class="info">
	<span>Click to lock mouse &middot; WASD to move &middot; Q/E or Shift/Space for up/down &middot; Scroll to adjust speed</span>
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

	.info {
		position: fixed;
		bottom: 1rem;
		left: 50%;
		transform: translateX(-50%);
		background: rgba(10, 10, 30, 0.7);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 0.5rem;
		padding: 0.5rem 1rem;
		font-family: monospace;
		font-size: 0.75rem;
		color: #889;
		z-index: 5;
		white-space: nowrap;
	}
</style>
