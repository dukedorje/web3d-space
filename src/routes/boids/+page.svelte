<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { initGPU, type GPUContext, GPUInitError } from '$lib/gpu/gpu-init.js';
	import {
		showErrorOverlay,
		hideErrorOverlay,
		createCleanupHandle,
		type CleanupHandle
	} from '$lib/gpu/errors.js';
	import { createCamera, type Camera } from '$lib/gpu/camera.js';
	import {
		createBoidBuffers,
		recreateBoidBuffers,
		writeConfigBuffer,
		DEFAULT_SIM_PARAMS,
		NO_BOID_SELECTED,
		type BoidBuffers
	} from '$lib/gpu/boid-buffers.js';
	import { readBoidPositions, readBoidConfig, findNearestBoidToRay, screenToRay } from '$lib/gpu/picking.js';
	import { mat4 } from 'gl-matrix';
	import {
		PERSONALITY_TYPES,
		PERSONALITY_NAMES,
		PERSONALITY_COLORS,
		ALL_PERSONALITY_TYPES,
		DISTRIBUTION_PRESETS,
		PRESET_NAMES,
		DEFAULT_DISTRIBUTION,
		initializeConfigBuffer,
		type PersonalityDistribution,
		type PersonalityType
	} from '$lib/gpu/personality-templates.js';
	import { createBoidComputePipeline } from '$lib/gpu/boid-compute.js';
	import {
		createAnimationLoop,
		type AnimationLoop,
		type SimParamsSnapshot,
		type BufferRecreateCallback
	} from '$lib/gpu/animation-loop.js';
	import { createBoidRenderer, type BoidRenderer } from '$lib/gpu/boid-render.js';
	import renderShaderSource from '$lib/gpu/shaders/boid-render.wgsl?raw';
	import computeShaderSource from '$lib/gpu/shaders/boid-steering.wgsl?raw';

	let canvas: HTMLCanvasElement;
	let error: string | null = $state(null);
	let loading = $state(true);
	let cleanup: CleanupHandle | undefined;
	let camera: Camera | undefined;
	let animLoop: AnimationLoop | undefined;
	let gpuDevice: GPUDevice | undefined;

	// Reactive simulation parameters (Svelte $state)
	let boidCount = $state(300);
	let maxForce = $state(DEFAULT_SIM_PARAMS.maxForce);
	let worldSize = $state(DEFAULT_SIM_PARAMS.worldSize);

	// Personality distribution state
	let activePreset = $state('Balanced');
	let currentDistribution: PersonalityDistribution = $state({ ...DEFAULT_DISTRIBUTION });

	// Track current buffers and device for runtime config updates
	let currentBuffers: BoidBuffers | undefined;

	// Boid inspector state
	let selectedBoidIndex = $state<number | null>(null);
	let inspectorData = $state<{
		personalityType: number;
		separationWeight: number;
		alignmentWeight: number;
		cohesionWeight: number;
		perceptionRadius: number;
		separationRadius: number;
		maxSpeed: number;
		wanderStrength: number;
		crowdSpeedBoost: number;
		stressLevel: number;
		experienceTimer: number;
		posX: number;
		posY: number;
		posZ: number;
		velX: number;
		velY: number;
		velZ: number;
	} | null>(null);

	function applyPreset(presetName: string) {
		activePreset = presetName;
		const preset = DISTRIBUTION_PRESETS[presetName];
		if (!preset) return;
		currentDistribution = { ...preset };
		applyDistribution();
	}

	function applyDistribution() {
		if (!gpuDevice || !currentBuffers) return;
		const configData = initializeConfigBuffer(currentBuffers.count, currentDistribution);
		writeConfigBuffer(gpuDevice, currentBuffers.config, configData);
	}

	/**
	 * Convert an RGB [0-1] tuple to a CSS color string.
	 */
	function rgbToCSS(rgb: [number, number, number]): string {
		return `rgb(${Math.round(rgb[0] * 255)}, ${Math.round(rgb[1] * 255)}, ${Math.round(rgb[2] * 255)})`;
	}

	/**
	 * Handle canvas click for boid selection.
	 * Only picks when pointer lock is NOT active (regular click enters pointer lock for camera).
	 */
	async function handleCanvasClick(event: MouseEvent) {
		if (!gpuDevice || !currentBuffers || !camera) return;

		// Only pick when NOT in pointer lock (or Shift+click while locked)
		if (camera.isLocked && !event.shiftKey) return;

		// Prevent pointer lock request when picking
		if (!camera.isLocked) {
			event.stopPropagation();
		}

		try {
			// 1. Get camera VP matrix and invert it
			const vpMatrix = camera.getViewProjectionMatrix();
			const invVP = mat4.create();
			mat4.invert(invVP, vpMatrix);

			// 2. Convert screen click to world-space ray
			const { rayOrigin, rayDir } = screenToRay(
				event.clientX,
				event.clientY,
				canvas,
				invVP as Float32Array
			);

			// 3. Read boid positions from GPU
			const activeIndex = 0; // Read from buffer A (both have recent data)
			const boidData = await readBoidPositions(
				gpuDevice,
				currentBuffers.storage[activeIndex],
				currentBuffers.count
			);

			// 4. Find nearest boid to ray
			const boidIndex = findNearestBoidToRay(boidData, rayOrigin, rayDir, currentBuffers.count);

			if (boidIndex >= 0) {
				selectedBoidIndex = boidIndex;

				// 5. Read config data for the selected boid
				const configData = await readBoidConfig(gpuDevice, currentBuffers.config, boidIndex);
				const u32View = new Uint32Array(configData.buffer);

				// 6. Extract position and velocity from boid data
				const floatsPerBoid = 12;
				const boidOffset = boidIndex * floatsPerBoid;

				inspectorData = {
					personalityType: u32View[8],
					separationWeight: configData[0],
					alignmentWeight: configData[1],
					cohesionWeight: configData[2],
					perceptionRadius: configData[3],
					separationRadius: configData[4],
					maxSpeed: configData[5],
					wanderStrength: configData[6],
					crowdSpeedBoost: configData[7],
					experienceTimer: configData[9],
					stressLevel: configData[10],
					posX: boidData[boidOffset + 0],
					posY: boidData[boidOffset + 1],
					posZ: boidData[boidOffset + 2],
					velX: boidData[boidOffset + 4],
					velY: boidData[boidOffset + 5],
					velZ: boidData[boidOffset + 6]
				};
			} else {
				// Clicked empty space — deselect
				selectedBoidIndex = null;
				inspectorData = null;
			}
		} catch (err) {
			console.warn('Boid picking failed:', err);
		}
	}

	function deselectBoid() {
		selectedBoidIndex = null;
		inspectorData = null;
	}

	// D-005 snapshot bridge: plain JS object written by $effect, read by animation loop
	const simParams: SimParamsSnapshot = {
		boidCount: 300,
		selectedBoidIndex: NO_BOID_SELECTED,
		...DEFAULT_SIM_PARAMS
	};

	$effect(() => {
		simParams.boidCount = boidCount;
		simParams.maxForce = maxForce;
		simParams.worldSize = worldSize;
		simParams.selectedBoidIndex = selectedBoidIndex !== null ? selectedBoidIndex : NO_BOID_SELECTED;
	});

	/**
	 * Configure the canvas context and backing store dimensions for the given device.
	 */
	function configureCanvas(
		ctx: GPUCanvasContext,
		device: GPUDevice,
		format: GPUTextureFormat,
		canvas: HTMLCanvasElement
	): void {
		const dpr = window.devicePixelRatio || 1;
		const width = Math.floor(canvas.clientWidth * dpr);
		const height = Math.floor(canvas.clientHeight * dpr);
		canvas.width = width;
		canvas.height = height;
		ctx.configure({ device, format, alphaMode: 'premultiplied' });
	}

	function doCleanup() {
		animLoop?.stop();
		animLoop = undefined;
		camera?.detach();
		camera = undefined;
		cleanup?.destroy();
		cleanup = undefined;
		hideErrorOverlay();
	}

	beforeNavigate(() => {
		doCleanup();
	});

	onDestroy(() => {
		doCleanup();
	});

	onMount(() => {
		let resizeObserver: ResizeObserver | undefined;
		let destroyed = false;

		async function init() {
			let gpuCtx: GPUContext;
			try {
				gpuCtx = await initGPU({
					onDeviceLost: (err) => {
						if (!destroyed) {
							error = err.message;
							showErrorOverlay(err.message);
						}
					}
				});
			} catch (err) {
				const msg =
					err instanceof GPUInitError
						? err.message
						: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`;
				error = msg;
				showErrorOverlay(msg);
				return;
			}

			if (destroyed) return;

			const { device } = gpuCtx;
			gpuDevice = device;
			const ctx = canvas.getContext('webgpu');
			if (!ctx) {
				const msg = 'Failed to get WebGPU canvas context.';
				error = msg;
				showErrorOverlay(msg);
				return;
			}

			const format = navigator.gpu.getPreferredCanvasFormat();

			// Create boid buffers with personality distribution
			const initialConfig = initializeConfigBuffer(simParams.boidCount, currentDistribution);
			const buffers = createBoidBuffers(device, simParams.boidCount, initialConfig);
			currentBuffers = buffers;

			// Compile uber-shader compute pipeline
			let computePipeline: GPUComputePipeline;
			try {
				computePipeline = await createBoidComputePipeline(
					device,
					buffers.bindGroupLayout,
					computeShaderSource
				);
			} catch (pipelineErr) {
				const msg = `Shader compilation failed: ${pipelineErr instanceof Error ? pipelineErr.message : String(pipelineErr)}`;
				error = msg;
				showErrorOverlay(msg);
				loading = false;
				return;
			}

			if (destroyed) return;
			loading = false;

			// Track device for cleanup on navigation
			cleanup = createCleanupHandle(device, [
				...buffers.storage,
				buffers.config,
				buffers.uniform
			]);

			// Create and attach camera input handlers
			camera = createCamera(canvas);
			camera.attach();

			configureCanvas(ctx, device, format, canvas);

			// Create boid renderer for instanced drawing (includes config buffer binding)
			const boidRenderer = createBoidRenderer(
				device,
				format,
				buffers.storage[0],
				buffers.uniform,
				buffers.config,
				renderShaderSource,
				canvas.width,
				canvas.height
			);

			// Buffer recreation callback for boid count slider
			const onBoidCountChange: BufferRecreateCallback = (newCount, oldBuffers) => {
				deselectBoid();
				const newConfig = initializeConfigBuffer(newCount, currentDistribution);
				const newBuffers = recreateBoidBuffers(device, oldBuffers, newCount, newConfig);
				currentBuffers = newBuffers;
				cleanup = createCleanupHandle(device, [
					...newBuffers.storage,
					newBuffers.config,
					newBuffers.uniform
				]);
				// Update renderer bind group to reference new buffers
				boidRenderer.updateBindGroup(newBuffers.storage[0], newBuffers.uniform, newBuffers.config);
				return newBuffers;
			};

			// Create and start animation loop
			animLoop = createAnimationLoop({
				device,
				canvasContext: ctx,
				buffers,
				computePipeline,
				camera,
				simParams,
				onBoidCountChange,
				boidRenderer
			});
			animLoop.start();

			resizeObserver = new ResizeObserver(() => {
				if (destroyed) return;
				configureCanvas(ctx, device, format, canvas);
			});
			resizeObserver.observe(canvas);
		}

		init();

		return () => {
			destroyed = true;
			resizeObserver?.disconnect();
			doCleanup();
		};
	});
</script>

<svelte:head>
	<title>Boids — WebGPU</title>
</svelte:head>

{#if loading}
	<div class="loading">
		<p>Compiling shaders...</p>
	</div>
{/if}

{#if error}
	<div class="error">
		<p>WebGPU Error</p>
		<p>{error}</p>
	</div>
{/if}

<canvas bind:this={canvas} onclick={handleCanvasClick}></canvas>

<div class="controls">
	<div class="control-row">
		<label for="boid-count">Boids</label>
		<input id="boid-count" type="range" min="10" max="2000" step="10" bind:value={boidCount} />
		<span class="value">{boidCount}</span>
	</div>
	<a href="/how-it-works" class="how-it-works-link">How It Works →</a>
</div>

<div class="personality-panel">
	<div class="panel-title">Personalities</div>
	<div class="presets">
		{#each PRESET_NAMES as name}
			<button
				class="preset-btn"
				class:active={activePreset === name}
				onclick={() => applyPreset(name)}
			>{name}</button>
		{/each}
	</div>
	<div class="legend">
		{#each ALL_PERSONALITY_TYPES as pType (pType)}
			<div class="legend-row">
				<span class="color-swatch" style="background: {rgbToCSS(PERSONALITY_COLORS[pType])}"></span>
				<span class="legend-name">{PERSONALITY_NAMES[pType]}</span>
				<span class="legend-pct">{Math.round((currentDistribution[pType] ?? 0) * 100)}%</span>
			</div>
		{/each}
	</div>
</div>

<div class="inspector-panel">
	{#if inspectorData}
		<div class="inspector-header">
			<span class="inspector-title">Boid #{selectedBoidIndex}</span>
			<button class="close-btn" onclick={deselectBoid}>x</button>
		</div>
		<div class="inspector-type">
			<span
				class="color-swatch"
				style="background: {rgbToCSS(PERSONALITY_COLORS[inspectorData.personalityType as PersonalityType] ?? [1,1,1])}"
			></span>
			<span>{PERSONALITY_NAMES[inspectorData.personalityType as PersonalityType] ?? 'Unknown'}</span>
		</div>
		<div class="inspector-section">Config</div>
		<div class="inspector-row"><span>Separation</span><span>{inspectorData.separationWeight.toFixed(2)}</span></div>
		<div class="inspector-row"><span>Alignment</span><span>{inspectorData.alignmentWeight.toFixed(2)}</span></div>
		<div class="inspector-row"><span>Cohesion</span><span>{inspectorData.cohesionWeight.toFixed(2)}</span></div>
		<div class="inspector-row"><span>Perception R</span><span>{inspectorData.perceptionRadius.toFixed(1)}</span></div>
		<div class="inspector-row"><span>Separation R</span><span>{inspectorData.separationRadius.toFixed(1)}</span></div>
		<div class="inspector-row"><span>Max Speed</span><span>{inspectorData.maxSpeed.toFixed(1)}</span></div>
		<div class="inspector-row"><span>Wander</span><span>{inspectorData.wanderStrength.toFixed(2)}</span></div>
		<div class="inspector-row"><span>Crowd Boost</span><span>{inspectorData.crowdSpeedBoost.toFixed(2)}</span></div>
		<div class="inspector-section">Live</div>
		<div class="inspector-row"><span>Stress</span><span>{inspectorData.stressLevel.toFixed(3)}</span></div>
		<div class="inspector-row"><span>Experience</span><span>{inspectorData.experienceTimer.toFixed(2)}s</span></div>
		<div class="inspector-section">State</div>
		<div class="inspector-row"><span>Position</span><span>{inspectorData.posX.toFixed(1)}, {inspectorData.posY.toFixed(1)}, {inspectorData.posZ.toFixed(1)}</span></div>
		<div class="inspector-row"><span>Velocity</span><span>{inspectorData.velX.toFixed(1)}, {inspectorData.velY.toFixed(1)}, {inspectorData.velZ.toFixed(1)}</span></div>
	{:else}
		<div class="inspector-placeholder">Click a boid to inspect</div>
	{/if}
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

	.controls {
		position: fixed;
		top: 1rem;
		left: 1rem;
		background: rgba(10, 10, 30, 0.75);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 0.5rem;
		padding: 0.75rem 1rem;
		font-family: monospace;
		font-size: 0.8rem;
		color: #ccd;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		z-index: 5;
		min-width: 220px;
	}

	.control-row {
		display: grid;
		grid-template-columns: 5rem 1fr 2.5rem;
		align-items: center;
		gap: 0.4rem;
	}

	.control-row label {
		text-align: right;
		opacity: 0.8;
	}

	.control-row input[type='range'] {
		width: 100%;
		accent-color: #6af;
	}

	.value {
		text-align: right;
		opacity: 0.9;
	}

	.how-it-works-link {
		display: block;
		margin-top: 0.4rem;
		text-align: right;
		font-size: 0.7rem;
		color: #6af;
		opacity: 0.7;
		text-decoration: none;
		transition: opacity 0.15s;
	}

	.how-it-works-link:hover {
		opacity: 1;
	}

	.personality-panel {
		position: fixed;
		top: 1rem;
		right: 1rem;
		background: rgba(10, 10, 30, 0.75);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 0.5rem;
		padding: 0.75rem 1rem;
		font-family: monospace;
		font-size: 0.8rem;
		color: #ccd;
		z-index: 5;
		min-width: 180px;
	}

	.panel-title {
		font-weight: bold;
		margin-bottom: 0.5rem;
		opacity: 0.9;
	}

	.presets {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		margin-bottom: 0.6rem;
	}

	.preset-btn {
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 0.25rem;
		color: #ccd;
		font-family: monospace;
		font-size: 0.7rem;
		padding: 0.2rem 0.5rem;
		cursor: pointer;
		transition: background 0.15s;
	}

	.preset-btn:hover {
		background: rgba(255, 255, 255, 0.15);
	}

	.preset-btn.active {
		background: rgba(100, 170, 255, 0.25);
		border-color: rgba(100, 170, 255, 0.5);
	}

	.legend {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.legend-row {
		display: grid;
		grid-template-columns: 0.8rem 1fr 2rem;
		align-items: center;
		gap: 0.4rem;
	}

	.color-swatch {
		display: inline-block;
		width: 0.7rem;
		height: 0.7rem;
		border-radius: 2px;
	}

	.legend-name {
		opacity: 0.85;
	}

	.legend-pct {
		text-align: right;
		opacity: 0.7;
	}

	.inspector-panel {
		position: fixed;
		bottom: 1rem;
		right: 1rem;
		background: rgba(10, 10, 30, 0.85);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 0.5rem;
		padding: 0.75rem 1rem;
		font-family: monospace;
		font-size: 0.75rem;
		color: #ccd;
		z-index: 5;
		min-width: 200px;
		max-width: 260px;
	}

	.inspector-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.4rem;
	}

	.inspector-title {
		font-weight: bold;
		font-size: 0.85rem;
		color: #eef;
	}

	.close-btn {
		background: none;
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: 3px;
		color: #aab;
		cursor: pointer;
		padding: 0 0.4rem;
		font-family: monospace;
		font-size: 0.75rem;
		line-height: 1.4;
	}

	.close-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #fff;
	}

	.inspector-type {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-bottom: 0.5rem;
		font-size: 0.85rem;
		color: #eef;
	}

	.inspector-section {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #88a;
		margin-top: 0.5rem;
		margin-bottom: 0.2rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		padding-bottom: 0.15rem;
	}

	.inspector-row {
		display: flex;
		justify-content: space-between;
		padding: 0.1rem 0;
		gap: 0.5rem;
	}

	.inspector-row span:first-child {
		opacity: 0.7;
	}

	.inspector-row span:last-child {
		text-align: right;
		color: #adf;
	}

	.inspector-placeholder {
		color: #667;
		font-style: italic;
		text-align: center;
		padding: 0.5rem 0;
	}
</style>
