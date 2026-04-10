<script lang="ts">
	import { createCanvasDemo } from './canvas-utils';
	import { createBoids, stepSimulation, type Boid, type SteeringForces, type SimConfig } from './boid-2d';

	const CANVAS_W = 500;
	const CANVAS_H = 400;
	const BOID_COUNT = 30;

	let canvas: HTMLCanvasElement | undefined = $state();
	let separationOn = $state(true);
	let alignmentOn = $state(true);
	let cohesionOn = $state(true);
	let separationWeight = $state(1.5);
	let alignmentWeight = $state(1.0);
	let cohesionWeight = $state(1.0);
	let highlightedBoid = $state(0);

	let boids: Boid[] = [];
	let lastForces: SteeringForces[] = [];

	function handleCanvasClick(e: MouseEvent) {
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const scaleX = CANVAS_W / rect.width;
		const scaleY = CANVAS_H / rect.height;
		const mx = (e.clientX - rect.left) * scaleX;
		const my = (e.clientY - rect.top) * scaleY;

		let closest = 0;
		let closestDist = Infinity;
		for (let i = 0; i < boids.length; i++) {
			const dx = boids[i].x - mx;
			const dy = boids[i].y - my;
			const d = dx * dx + dy * dy;
			if (d < closestDist) {
				closestDist = d;
				closest = i;
			}
		}
		highlightedBoid = closest;
	}

	$effect(() => {
		if (!canvas) return;

		boids = createBoids(BOID_COUNT, CANVAS_W, CANVAS_H);
		lastForces = [];

		const demo = createCanvasDemo(
			canvas,
			(ctx, dt) => {
				const config: SimConfig = {
					separationOn,
					alignmentOn,
					cohesionOn,
					separationWeight,
					alignmentWeight,
					cohesionWeight
				};
				lastForces = stepSimulation(boids, config, CANVAS_W, CANVAS_H, dt);
				drawFrame(ctx);
			},
			{ width: CANVAS_W, height: CANVAS_H }
		);
		demo.start();
		return () => demo.stop();
	});

	function drawFrame(ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = '#0f1117';
		ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

		// Draw boids as triangles
		for (let i = 0; i < boids.length; i++) {
			const b = boids[i];
			const isHighlighted = i === highlightedBoid;
			const angle = Math.atan2(b.vy, b.vx);
			const size = isHighlighted ? 10 : 7;

			ctx.save();
			ctx.translate(b.x, b.y);
			ctx.rotate(angle);

			ctx.beginPath();
			ctx.moveTo(size, 0);
			ctx.lineTo(-size * 0.6, -size * 0.5);
			ctx.lineTo(-size * 0.6, size * 0.5);
			ctx.closePath();

			if (isHighlighted) {
				ctx.fillStyle = '#fbbf24';
				ctx.strokeStyle = '#ffffff';
				ctx.lineWidth = 2;
				ctx.fill();
				ctx.stroke();
			} else {
				ctx.fillStyle = '#94a3b8';
				ctx.fill();
			}

			ctx.restore();
		}

		// Draw force vectors on highlighted boid
		if (lastForces.length > highlightedBoid) {
			const b = boids[highlightedBoid];
			const f = lastForces[highlightedBoid];
			const scale = 0.4;

			if (separationOn) drawArrow(ctx, b.x, b.y, f.sepX * separationWeight * scale, f.sepY * separationWeight * scale, '#ef4444');
			if (alignmentOn) drawArrow(ctx, b.x, b.y, f.aliX * alignmentWeight * scale, f.aliY * alignmentWeight * scale, '#22c55e');
			if (cohesionOn) drawArrow(ctx, b.x, b.y, f.cohX * cohesionWeight * scale, f.cohY * cohesionWeight * scale, '#3b82f6');
		}

		// Legend
		drawLegend(ctx);
	}

	function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, color: string) {
		const mag = Math.sqrt(dx * dx + dy * dy);
		if (mag < 1) return;

		const ex = x + dx;
		const ey = y + dy;
		const angle = Math.atan2(dy, dx);
		const headLen = Math.min(8, mag * 0.4);

		ctx.strokeStyle = color;
		ctx.lineWidth = 2.5;
		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.lineTo(ex, ey);
		ctx.stroke();

		// Arrowhead
		ctx.fillStyle = color;
		ctx.beginPath();
		ctx.moveTo(ex, ey);
		ctx.lineTo(ex - headLen * Math.cos(angle - 0.4), ey - headLen * Math.sin(angle - 0.4));
		ctx.lineTo(ex - headLen * Math.cos(angle + 0.4), ey - headLen * Math.sin(angle + 0.4));
		ctx.closePath();
		ctx.fill();
	}

	function drawLegend(ctx: CanvasRenderingContext2D) {
		const items = [
			{ color: '#ef4444', label: 'Separation' },
			{ color: '#22c55e', label: 'Alignment' },
			{ color: '#3b82f6', label: 'Cohesion' }
		];
		ctx.font = '11px system-ui, sans-serif';
		const lx = 10;
		let ly = CANVAS_H - 12;
		for (let i = items.length - 1; i >= 0; i--) {
			ctx.fillStyle = items[i].color;
			ctx.fillRect(lx, ly - 8, 10, 10);
			ctx.fillStyle = '#cbd5e1';
			ctx.fillText(items[i].label, lx + 14, ly);
			ly -= 16;
		}
	}
</script>

<section id="boid-rules" class="mb-20">
	<h2 class="text-3xl font-bold text-white mb-6">Boid Rules</h2>
	<div class="prose prose-invert max-w-none mb-8">
		<p class="text-gray-300">
			In 1986, Craig Reynolds created a computer model of coordinated animal motion -- flocking
			birds, schooling fish, swarming insects. He called each simulated creature a
			<strong>boid</strong> (short for "bird-oid"). The magic? Every boid follows the same three
			simple rules, yet the group produces complex, lifelike movement without any leader telling
			them what to do.
		</p>
		<p class="text-gray-300">
			Each boid looks at its nearby neighbors and decides how to <strong>steer</strong> --
			meaning it adjusts the direction and speed it's moving. The three steering rules are:
		</p>
		<ol class="text-gray-300 space-y-2">
			<li>
				<strong>Separation</strong> -- steer <em>away</em> from boids that are too close.
				Nobody likes being crowded!
			</li>
			<li>
				<strong>Alignment</strong> -- steer toward the <em>average direction</em> your
				neighbors are heading. Go with the flow.
			</li>
			<li>
				<strong>Cohesion</strong> -- steer toward the <em>center of the group</em>. Stay
				together, don't wander off alone.
			</li>
		</ol>
		<p class="text-gray-300">
			Try toggling each rule on and off below, or drag the sliders to crank up the strength.
			Click any boid to see its force vectors -- the colored arrows show exactly how much each
			rule is pulling it.
		</p>
	</div>

	<!-- Controls -->
	<div class="flex flex-wrap gap-6 mb-4 items-start">
		<div class="flex flex-col gap-3">
			<label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none">
				<input type="checkbox" bind:checked={separationOn} class="accent-red-500 w-4 h-4" />
				<span class="text-red-400 font-medium">Separation</span>
			</label>
			<label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none">
				<input type="checkbox" bind:checked={alignmentOn} class="accent-green-500 w-4 h-4" />
				<span class="text-green-400 font-medium">Alignment</span>
			</label>
			<label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none">
				<input type="checkbox" bind:checked={cohesionOn} class="accent-blue-500 w-4 h-4" />
				<span class="text-blue-400 font-medium">Cohesion</span>
			</label>
		</div>
		<div class="flex flex-col gap-3 min-w-[200px]">
			<label class="flex items-center gap-2 text-sm text-gray-300">
				<span class="text-red-400 w-24">Sep weight</span>
				<input type="range" min="0.5" max="5" step="0.1" bind:value={separationWeight} class="flex-1 accent-red-500" />
				<span class="w-8 text-right font-mono text-xs">{separationWeight.toFixed(1)}</span>
			</label>
			<label class="flex items-center gap-2 text-sm text-gray-300">
				<span class="text-green-400 w-24">Ali weight</span>
				<input type="range" min="0.5" max="5" step="0.1" bind:value={alignmentWeight} class="flex-1 accent-green-500" />
				<span class="w-8 text-right font-mono text-xs">{alignmentWeight.toFixed(1)}</span>
			</label>
			<label class="flex items-center gap-2 text-sm text-gray-300">
				<span class="text-blue-400 w-24">Coh weight</span>
				<input type="range" min="0.5" max="5" step="0.1" bind:value={cohesionWeight} class="flex-1 accent-blue-500" />
				<span class="w-8 text-right font-mono text-xs">{cohesionWeight.toFixed(1)}</span>
			</label>
		</div>
	</div>

	<!-- Canvas -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="rounded-lg overflow-hidden border border-gray-700 inline-block cursor-crosshair"
		onclick={handleCanvasClick}
	>
		<canvas bind:this={canvas} class="block max-w-full h-auto"></canvas>
	</div>
	<p class="text-xs text-gray-500 mt-2">Click a boid to highlight it and see its force vectors.</p>
</section>
