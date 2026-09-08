<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { createPlayCanvasApp, type PlayCanvasApp } from '$lib/playcanvas/create-app';
	import { WORLD_FIXTURE } from '$lib/world/fixture';
	import { parseWorldDocument } from '$lib/world/document';
	import { mountWorld, worldBounds } from '$lib/world/mount';

	let canvas: HTMLCanvasElement;
	let loading = $state(true);
	let loadStatus = $state('Initializing…');
	let error: string | null = $state(null);
	let pcState: PlayCanvasApp | null = null;
	let debugInfo = $state('');
	let showDebug = $state(false);

	const world = parseWorldDocument(WORLD_FIXTURE);
	const cam = world.cameras[0]!;

	function doCleanup() {
		if (pcState) {
			pcState.app.destroy();
			pcState = null;
		}
	}

	onDestroy(() => doCleanup());

	onMount(() => {
		let destroyed = false;
		let rafId = 0;

		async function init() {
			try {
				loadStatus = 'Creating GPU…';
				pcState = await createPlayCanvasApp({ canvas });
				if (destroyed) {
					doCleanup();
					return;
				}

				loadStatus = 'Loading XELA + sky…';
				await mountWorld(pcState, world);
				if (destroyed) {
					doCleanup();
					return;
				}

				const { pc, app } = pcState;
				const bounds = worldBounds(pcState);
				const startPos: [number, number, number] = bounds
					? [
							bounds.center[0],
							bounds.center[1] + Math.max(bounds.half[1] * 0.4, 4),
							bounds.center[2] + Math.max(bounds.half[2] * 2.4, 20)
						]
					: cam.position;
				const farClip = bounds
					? Math.max(500, (bounds.half[0] + bounds.half[1] + bounds.half[2]) * 8)
					: 2000;

				const camera = new pc.Entity('Camera');
				camera.addComponent('camera', {
					clearColor: new pc.Color(0.02, 0.02, 0.05),
					toneMapping: pc.TONEMAP_ACES,
					farClip
				});
				camera.setLocalPosition(...startPos);
				app.root.addChild(camera);
				if (bounds) {
					camera.lookAt(bounds.center[0], bounds.center[1], bounds.center[2]);
				}

				const cameraFrame = new pc.CameraFrame(app, camera.camera);
				cameraFrame.rendering.toneMapping = pc.TONEMAP_ACES;
				cameraFrame.rendering.sceneDepthMap = true;
				cameraFrame.rendering.sceneColorMap = true;
				cameraFrame.bloom.enabled = true;
				cameraFrame.bloom.intensity = 0.04;
				cameraFrame.taa.enabled = false;
				cameraFrame.enabled = true;
				cameraFrame.update();

				const eul = camera.getEulerAngles();
				let yaw = eul.y;
				let pitch = eul.x;
				const sensitivity = 0.15;
				let speed = Math.max(8, bounds ? bounds.half[2] * 0.15 : 8);
				let locked = false;
				const keysDown = new Set<string>();

				canvas.addEventListener('click', () => {
					if (locked) document.exitPointerLock();
					else canvas.requestPointerLock();
				});
				document.addEventListener('pointerlockchange', () => {
					locked = document.pointerLockElement === canvas;
					if (!locked) keysDown.clear();
				});
				window.addEventListener('mousemove', (e) => {
					if (!locked) return;
					yaw -= e.movementX * sensitivity;
					pitch = Math.max(-89, Math.min(89, pitch - e.movementY * sensitivity));
					camera.setEulerAngles(pitch, yaw, 0);
				});
				canvas.addEventListener(
					'wheel',
					(e) => {
						e.preventDefault();
						speed = Math.max(1, Math.min(40, speed - e.deltaY * 0.01));
					},
					{ passive: false }
				);
				canvas.addEventListener('keydown', (e) => {
					keysDown.add(e.code);
					if (e.code === 'KeyC') showDebug = !showDebug;
				});
				canvas.addEventListener('keyup', (e) => keysDown.delete(e.code));
				canvas.setAttribute('tabindex', '0');

				let lastTime = performance.now();
				function movementLoop() {
					if (destroyed) return;
					const now = performance.now();
					const dt = (now - lastTime) / 1000;
					lastTime = now;
					const move = speed * dt;
					const pos = camera.getPosition().clone();
					if (keysDown.has('KeyW')) pos.add(camera.forward.clone().mulScalar(move));
					if (keysDown.has('KeyS')) pos.add(camera.forward.clone().mulScalar(-move));
					if (keysDown.has('KeyD')) pos.add(camera.right.clone().mulScalar(move));
					if (keysDown.has('KeyA')) pos.add(camera.right.clone().mulScalar(-move));
					if (keysDown.has('Space') || keysDown.has('KeyE')) pos.y += move;
					if (keysDown.has('ShiftLeft') || keysDown.has('KeyQ')) pos.y -= move;
					camera.setPosition(pos);
					if (showDebug) {
						debugInfo = `pos [${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}]  yaw ${Math.round(yaw)}  pitch ${Math.round(pitch)}  speed ${speed.toFixed(1)}`;
					}
					rafId = requestAnimationFrame(movementLoop);
				}
				rafId = requestAnimationFrame(movementLoop);
				loading = false;
				canvas.focus();
			} catch (err) {
				error = err instanceof Error ? err.message : String(err);
				loading = false;
			}
		}

		init();
		return () => {
			destroyed = true;
			cancelAnimationFrame(rafId);
			doCleanup();
		};
	});
</script>

<svelte:head>
	<title>World — XELA</title>
</svelte:head>

<canvas bind:this={canvas} class="fixed inset-0 h-full w-full bg-black"></canvas>

{#if loading}
	<div class="pointer-events-none fixed inset-0 flex items-center justify-center font-mono text-cyan-300">
		{loadStatus}
	</div>
{/if}

{#if error}
	<div class="fixed inset-0 flex items-center justify-center bg-black/80 font-mono text-red-400">
		{error}
	</div>
{/if}

<div class="pointer-events-none fixed left-4 top-4 font-mono text-xs text-cyan-500/80">
	<a class="pointer-events-auto text-cyan-400 hover:underline" href="/">lab</a>
	· click to look · WASD · wheel speed · C debug
</div>

{#if showDebug}
	<div class="fixed bottom-4 left-4 font-mono text-xs text-cyan-300">{debugInfo}</div>
{/if}
