<script lang="ts">
	import { createCanvasDemo } from './canvas-utils';
	import {
		ALL_PERSONALITY_TYPES,
		PERSONALITY_NAMES,
		PERSONALITY_COLORS,
		PERSONALITY_TEMPLATES,
		DISTRIBUTION_PRESETS,
		PRESET_NAMES,
		distributePersonalities,
		type PersonalityType
	} from '$lib/gpu/personality-templates';

	const CANVAS_W = 500;
	const CANVAS_H = 400;
	const BOID_COUNT = 30;
	const MAX_SPEED = 100;
	const MAX_FORCE = 180;
	const PERCEPTION = 70;
	const SEPARATION = 25;

	interface PBoid {
		x: number;
		y: number;
		vx: number;
		vy: number;
		type: PersonalityType;
	}

	function toCss(c: [number, number, number]): string {
		return `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
	}

	let canvas: HTMLCanvasElement | undefined = $state();
	let activePreset = $state('Balanced');

	function makeBoids(preset: string): PBoid[] {
		const dist = DISTRIBUTION_PRESETS[preset];
		const types = distributePersonalities(BOID_COUNT, dist);
		return types.map((type) => {
			const a = Math.random() * Math.PI * 2;
			const s = 20 + Math.random() * 30;
			return { x: Math.random() * CANVAS_W, y: Math.random() * CANVAS_H, vx: Math.cos(a) * s, vy: Math.sin(a) * s, type };
		});
	}

	let boids = $state(makeBoids(activePreset));

	function selectPreset(name: string) {
		activePreset = name;
		boids = makeBoids(name);
	}

	function wrap(v: number, size: number): number {
		if (v > size) return v - size;
		if (v < 0) return v + size;
		return v;
	}

	function toroidalDelta(a: number, b: number, size: number): number {
		let d = b - a;
		const half = size * 0.5;
		if (d > half) d -= size;
		if (d < -half) d += size;
		return d;
	}

	function limitVec(x: number, y: number, max: number): [number, number] {
		const m2 = x * x + y * y;
		if (m2 > max * max) {
			const m = Math.sqrt(m2);
			return [(x / m) * max, (y / m) * max];
		}
		return [x, y];
	}

	function step(dt: number) {
		const scale = 0.15; // Scale GPU-world params (~100-unit) to canvas (~500px)
		const forces = boids.map((b, i) => {
			const tmpl = PERSONALITY_TEMPLATES[b.type];
			let sepX = 0, sepY = 0, aliX = 0, aliY = 0, cohX = 0, cohY = 0;
			let pCount = 0, sCount = 0;
			let nearPredDx = 0, nearPredDy = 0, nearPredDist = Infinity;

			for (let j = 0; j < boids.length; j++) {
				if (j === i) continue;
				const o = boids[j];
				const dx = toroidalDelta(b.x, o.x, CANVAS_W);
				const dy = toroidalDelta(b.y, o.y, CANVAS_H);
				const d2 = dx * dx + dy * dy;
				if (d2 < PERCEPTION * PERCEPTION && d2 > 0) {
					aliX += o.vx; aliY += o.vy;
					cohX += dx; cohY += dy;
					pCount++;
					if (d2 < SEPARATION * SEPARATION) {
						const d = Math.sqrt(d2);
						sepX -= dx / d; sepY -= dy / d;
						sCount++;
					}
					// Track nearest predator for timid flee
					if (o.type === 2 /* PREDATOR */) {
						const d = Math.sqrt(d2);
						if (d < nearPredDist) { nearPredDist = d; nearPredDx = -dx; nearPredDy = -dy; }
					}
				}
			}

			let fx = 0, fy = 0;
			if (sCount > 0) {
				const [sx, sy] = limitVec(sepX / sCount, sepY / sCount, MAX_FORCE);
				fx += sx * tmpl.separationWeight * scale;
				fy += sy * tmpl.separationWeight * scale;
			}
			if (pCount > 0) {
				const [ax, ay] = limitVec(aliX / pCount - b.vx, aliY / pCount - b.vy, MAX_FORCE);
				fx += ax * tmpl.alignmentWeight * scale;
				fy += ay * tmpl.alignmentWeight * scale;
				const [cx, cy] = limitVec(cohX / pCount, cohY / pCount, MAX_FORCE);
				fx += cx * tmpl.cohesionWeight * scale;
				fy += cy * tmpl.cohesionWeight * scale;
			}
			// Wander
			if (tmpl.wanderStrength > 0) {
				fx += (Math.random() - 0.5) * tmpl.wanderStrength * MAX_FORCE * scale;
				fy += (Math.random() - 0.5) * tmpl.wanderStrength * MAX_FORCE * scale;
			}
			// Timid flee from predators
			if (b.type === 5 /* TIMID */ && nearPredDist < PERCEPTION) {
				const [flfx, flfy] = limitVec(nearPredDx, nearPredDy, MAX_FORCE);
				fx += flfx * 2.0 * scale; fy += flfy * 2.0 * scale;
			}
			return { fx, fy, maxSpd: tmpl.maxSpeed * scale * 4 };
		});

		for (let i = 0; i < boids.length; i++) {
			const b = boids[i];
			const f = forces[i];
			b.vx += f.fx * dt; b.vy += f.fy * dt;
			[b.vx, b.vy] = limitVec(b.vx, b.vy, f.maxSpd);
			b.x = wrap(b.x + b.vx * dt, CANVAS_W);
			b.y = wrap(b.y + b.vy * dt, CANVAS_H);
		}
	}

	function draw(ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = '#0a0a12';
		ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
		for (const b of boids) {
			const angle = Math.atan2(b.vy, b.vx);
			const sz = 6;
			ctx.save();
			ctx.translate(b.x, b.y);
			ctx.rotate(angle);
			ctx.beginPath();
			ctx.moveTo(sz, 0);
			ctx.lineTo(-sz * 0.6, -sz * 0.5);
			ctx.lineTo(-sz * 0.6, sz * 0.5);
			ctx.closePath();
			ctx.fillStyle = toCss(PERSONALITY_COLORS[b.type]);
			ctx.fill();
			ctx.restore();
		}
	}

	$effect(() => {
		if (!canvas) return;
		const demo = createCanvasDemo(canvas, (ctx, dt) => { step(dt); draw(ctx); }, { width: CANVAS_W, height: CANVAS_H });
		demo.start();
		return () => demo.stop();
	});

	// Active types in current distribution
	const activeTypes = $derived(
		ALL_PERSONALITY_TYPES.filter((t) => boids.some((b) => b.type === t))
	);
</script>

<div class="mt-12">
	<h3 class="text-xl font-semibold text-white mb-3">Personality Mini-Simulation</h3>
	<p class="text-gray-400 text-sm mb-4">
		30 boids with personality-based steering. Pick a preset to see how the mix changes behavior.
	</p>

	<!-- Preset buttons -->
	<div class="flex flex-wrap gap-2 mb-4">
		{#each PRESET_NAMES as name}
			<button
				onclick={() => selectPreset(name)}
				class="px-3 py-1.5 rounded text-sm transition-colors
					{activePreset === name
					? 'bg-blue-600 text-white'
					: 'bg-gray-800 text-gray-300 hover:bg-gray-700'}"
			>{name}</button>
		{/each}
	</div>

	<!-- Canvas -->
	<div class="rounded-lg overflow-hidden border border-white/10">
		<canvas bind:this={canvas} class="w-full" style="max-width:{CANVAS_W}px;aspect-ratio:{CANVAS_W}/{CANVAS_H}"></canvas>
	</div>

	<!-- Legend -->
	<div class="flex flex-wrap gap-3 mt-3">
		{#each activeTypes as t}
			<div class="flex items-center gap-1.5 text-xs text-gray-300">
				<div class="w-3 h-3 rounded-sm" style="background-color:{toCss(PERSONALITY_COLORS[t])}"></div>
				{PERSONALITY_NAMES[t]}
			</div>
		{/each}
	</div>
</div>
