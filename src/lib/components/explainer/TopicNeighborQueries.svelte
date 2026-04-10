<script lang="ts">
	import { createCanvasDemo } from './canvas-utils';

	const CANVAS_W = 400;
	const CANVAS_H = 400;
	const BOID_COUNT = 15;
	const BOID_SIZE = 7;
	const QUERY_SIZE = 10;

	let canvas: HTMLCanvasElement | undefined = $state();
	let perceptionRadius = $state(90);
	let dragging = $state(false);

	// Static boids at random positions (generated once)
	interface StaticBoid {
		x: number;
		y: number;
		angle: number; // random facing direction for the triangle
	}

	const staticBoids: StaticBoid[] = [];
	for (let i = 0; i < BOID_COUNT; i++) {
		staticBoids.push({
			x: 40 + Math.random() * (CANVAS_W - 80),
			y: 40 + Math.random() * (CANVAS_H - 80),
			angle: Math.random() * Math.PI * 2
		});
	}

	// The draggable query boid
	let queryX = $state(CANVAS_W / 2);
	let queryY = $state(CANVAS_H / 2);

	function getCanvasCoords(e: MouseEvent): { x: number; y: number } | null {
		if (!canvas) return null;
		const rect = canvas.getBoundingClientRect();
		const scaleX = CANVAS_W / rect.width;
		const scaleY = CANVAS_H / rect.height;
		return {
			x: (e.clientX - rect.left) * scaleX,
			y: (e.clientY - rect.top) * scaleY
		};
	}

	function handleMouseDown(e: MouseEvent) {
		const pos = getCanvasCoords(e);
		if (!pos) return;
		const dx = pos.x - queryX;
		const dy = pos.y - queryY;
		// Start drag if click is near the query boid or its radius circle
		if (dx * dx + dy * dy < (perceptionRadius + 20) * (perceptionRadius + 20)) {
			dragging = true;
			queryX = pos.x;
			queryY = pos.y;
		}
	}

	function handleMouseMove(e: MouseEvent) {
		if (!dragging) return;
		const pos = getCanvasCoords(e);
		if (!pos) return;
		queryX = Math.max(5, Math.min(CANVAS_W - 5, pos.x));
		queryY = Math.max(5, Math.min(CANVAS_H - 5, pos.y));
	}

	function handleMouseUp() {
		dragging = false;
	}

	// Touch support for mobile
	function handleTouchStart(e: TouchEvent) {
		if (!canvas || e.touches.length === 0) return;
		const touch = e.touches[0];
		const rect = canvas.getBoundingClientRect();
		const scaleX = CANVAS_W / rect.width;
		const scaleY = CANVAS_H / rect.height;
		const x = (touch.clientX - rect.left) * scaleX;
		const y = (touch.clientY - rect.top) * scaleY;
		const dx = x - queryX;
		const dy = y - queryY;
		if (dx * dx + dy * dy < (perceptionRadius + 20) * (perceptionRadius + 20)) {
			dragging = true;
			queryX = x;
			queryY = y;
			e.preventDefault();
		}
	}

	function handleTouchMove(e: TouchEvent) {
		if (!dragging || !canvas || e.touches.length === 0) return;
		const touch = e.touches[0];
		const rect = canvas.getBoundingClientRect();
		const scaleX = CANVAS_W / rect.width;
		const scaleY = CANVAS_H / rect.height;
		queryX = Math.max(5, Math.min(CANVAS_W - 5, (touch.clientX - rect.left) * scaleX));
		queryY = Math.max(5, Math.min(CANVAS_H - 5, (touch.clientY - rect.top) * scaleY));
		e.preventDefault();
	}

	function handleTouchEnd() {
		dragging = false;
	}

	function drawBoidTriangle(
		ctx: CanvasRenderingContext2D,
		x: number, y: number, angle: number, size: number,
		fillColor: string, strokeColor?: string
	) {
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(angle);
		ctx.beginPath();
		ctx.moveTo(size, 0);
		ctx.lineTo(-size * 0.6, -size * 0.5);
		ctx.lineTo(-size * 0.6, size * 0.5);
		ctx.closePath();
		ctx.fillStyle = fillColor;
		ctx.fill();
		if (strokeColor) {
			ctx.strokeStyle = strokeColor;
			ctx.lineWidth = 2;
			ctx.stroke();
		}
		ctx.restore();
	}

	$effect(() => {
		if (!canvas) return;

		const demo = createCanvasDemo(
			canvas,
			(ctx) => {
				// Background
				ctx.fillStyle = '#0f1117';
				ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

				const rSq = perceptionRadius * perceptionRadius;

				// Draw perception radius circle
				ctx.beginPath();
				ctx.arc(queryX, queryY, perceptionRadius, 0, Math.PI * 2);
				ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
				ctx.lineWidth = 2;
				ctx.stroke();
				ctx.fillStyle = 'rgba(59, 130, 246, 0.06)';
				ctx.fill();

				// Count neighbors for the label
				let neighborCount = 0;

				// Draw static boids (dim or highlighted based on distance)
				for (const boid of staticBoids) {
					const dx = boid.x - queryX;
					const dy = boid.y - queryY;
					const distSq = dx * dx + dy * dy;
					const isNeighbor = distSq <= rSq;

					if (isNeighbor) {
						neighborCount++;
						// Highlighted: bright color + ring
						drawBoidTriangle(ctx, boid.x, boid.y, boid.angle, BOID_SIZE + 2, '#22c55e', '#86efac');
						// Draw a line from query to this neighbor
						ctx.beginPath();
						ctx.moveTo(queryX, queryY);
						ctx.lineTo(boid.x, boid.y);
						ctx.strokeStyle = 'rgba(34, 197, 94, 0.25)';
						ctx.lineWidth = 1;
						ctx.stroke();
					} else {
						// Dimmed
						drawBoidTriangle(ctx, boid.x, boid.y, boid.angle, BOID_SIZE, '#4b5563');
					}
				}

				// Draw the query boid on top
				drawBoidTriangle(ctx, queryX, queryY, 0, QUERY_SIZE, '#fbbf24', '#ffffff');

				// Neighbor count label
				ctx.font = 'bold 13px system-ui, sans-serif';
				ctx.fillStyle = '#e2e8f0';
				ctx.textAlign = 'left';
				ctx.fillText(`Neighbors: ${neighborCount} / ${BOID_COUNT}`, 10, 22);

				// Radius label
				ctx.font = '11px system-ui, sans-serif';
				ctx.fillStyle = '#94a3b8';
				ctx.fillText(`Radius: ${perceptionRadius}px`, 10, 38);

				// Drag hint
				if (!dragging) {
					ctx.fillStyle = '#64748b';
					ctx.font = '11px system-ui, sans-serif';
					ctx.textAlign = 'center';
					ctx.fillText('Drag the yellow boid', CANVAS_W / 2, CANVAS_H - 10);
				}
			},
			{ width: CANVAS_W, height: CANVAS_H }
		);
		demo.start();
		return () => demo.stop();
	});
</script>

<section id="neighbor-queries" class="mb-20">
	<h2 class="text-3xl font-bold text-white mb-6">Neighbor Queries</h2>

	<div class="prose prose-invert max-w-none mb-8">
		<p class="text-gray-300 mb-4">
			Before a boid can follow the flocking rules, it needs to answer one question:
			<em>who are my neighbors?</em> A <strong class="text-white">neighbor</strong>
			is any other boid within a certain distance -- we call that distance the
			<strong class="text-white">perception radius</strong>. Think of it like how far
			a bird can see: boids inside the radius influence your steering, and boids
			outside it are invisible to you.
		</p>
		<p class="text-gray-300 mb-4">
			In our shader, each boid loops through every other boid and checks the distance.
			If the distance squared is less than the perception radius squared (we compare
			squared values to avoid an expensive square root), that boid counts as a neighbor.
			The three flocking forces -- separation, alignment, and cohesion -- are only
			calculated from these neighbors.
		</p>
		<p class="text-gray-300 mb-4">
			Drag the yellow boid around the demo below. The blue circle shows its perception
			radius. Green boids are neighbors (inside the circle), gray boids are outside it.
			Try adjusting the radius slider to see how a larger radius means more neighbors
			and stronger flocking influence.
		</p>
	</div>

	<!-- Radius slider -->
	<div class="flex items-center gap-4 mb-4">
		<label class="flex items-center gap-2 text-sm text-gray-300">
			<span class="text-blue-400 font-medium w-32">Perception Radius</span>
			<input
				type="range"
				min="60"
				max="120"
				step="1"
				bind:value={perceptionRadius}
				class="flex-1 accent-blue-500 w-40"
			/>
			<span class="w-10 text-right font-mono text-xs">{perceptionRadius}px</span>
		</label>
	</div>

	<!-- Canvas -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="rounded-lg overflow-hidden border border-gray-700 inline-block"
		class:cursor-grabbing={dragging}
		class:cursor-grab={!dragging}
		onmousedown={handleMouseDown}
		onmousemove={handleMouseMove}
		onmouseup={handleMouseUp}
		onmouseleave={handleMouseUp}
		ontouchstart={handleTouchStart}
		ontouchmove={handleTouchMove}
		ontouchend={handleTouchEnd}
	>
		<canvas bind:this={canvas} class="block max-w-full h-auto"></canvas>
	</div>
	<p class="text-xs text-gray-500 mt-2">
		Drag the yellow query boid to explore. Green boids are within the perception radius.
	</p>
</section>
