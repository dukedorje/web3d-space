<script lang="ts">
	import { createCanvasDemo } from './canvas-utils';

	const CANVAS_SIZE = 300;
	const CENTER = CANVAS_SIZE / 2;
	const CONE_SIZE = 28;

	let canvas: HTMLCanvasElement | undefined = $state();

	// Velocity arrow tip position (relative to center)
	let arrowX = $state(60);
	let arrowY = $state(0);
	let dragging = $state(false);

	function getCanvasPos(e: MouseEvent | TouchEvent): { x: number; y: number } | null {
		if (!canvas) return null;
		const rect = canvas.getBoundingClientRect();
		const scaleX = CANVAS_SIZE / rect.width;
		const scaleY = CANVAS_SIZE / rect.height;
		let clientX: number, clientY: number;
		if (e instanceof MouseEvent) {
			clientX = e.clientX;
			clientY = e.clientY;
		} else {
			clientX = e.touches[0].clientX;
			clientY = e.touches[0].clientY;
		}
		return {
			x: (clientX - rect.left) * scaleX - CENTER,
			y: (clientY - rect.top) * scaleY - CENTER
		};
	}

	function onPointerDown(e: MouseEvent) {
		const pos = getCanvasPos(e);
		if (!pos) return;
		// Only start drag if near the arrow tip
		const dx = pos.x - arrowX;
		const dy = pos.y - arrowY;
		if (Math.sqrt(dx * dx + dy * dy) < 18) {
			dragging = true;
			e.preventDefault();
		}
	}

	function onPointerMove(e: MouseEvent) {
		if (!dragging) return;
		const pos = getCanvasPos(e);
		if (!pos) return;
		const mag = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
		// Clamp to [20, 100]
		const clamped = Math.max(20, Math.min(100, mag));
		if (mag > 0) {
			arrowX = (pos.x / mag) * clamped;
			arrowY = (pos.y / mag) * clamped;
		}
	}

	function onPointerUp() {
		dragging = false;
	}

	$effect(() => {
		if (!canvas) return;

		const demo = createCanvasDemo(
			canvas,
			(ctx) => {
				drawFrame(ctx, arrowX, arrowY);
			},
			{ width: CANVAS_SIZE, height: CANVAS_SIZE }
		);
		demo.start();
		return () => demo.stop();
	});

	function drawCone(ctx: CanvasRenderingContext2D, angle: number) {
		ctx.save();
		ctx.translate(CENTER, CENTER);
		ctx.rotate(angle);

		ctx.beginPath();
		ctx.moveTo(CONE_SIZE, 0);
		ctx.lineTo(-CONE_SIZE * 0.6, -CONE_SIZE * 0.5);
		ctx.lineTo(-CONE_SIZE * 0.6, CONE_SIZE * 0.5);
		ctx.closePath();

		ctx.fillStyle = '#38bdf8';
		ctx.strokeStyle = '#7dd3fc';
		ctx.lineWidth = 1.5;
		ctx.fill();
		ctx.stroke();

		ctx.restore();
	}

	function drawArrow(ctx: CanvasRenderingContext2D, ax: number, ay: number) {
		const mag = Math.sqrt(ax * ax + ay * ay);
		if (mag < 1) return;
		const angle = Math.atan2(ay, ax);
		const headLen = 10;

		ctx.save();
		ctx.translate(CENTER, CENTER);

		// Shaft
		ctx.strokeStyle = '#fbbf24';
		ctx.lineWidth = 2.5;
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(ax, ay);
		ctx.stroke();

		// Arrowhead
		ctx.fillStyle = '#fbbf24';
		ctx.beginPath();
		ctx.moveTo(ax, ay);
		ctx.lineTo(ax - headLen * Math.cos(angle - 0.4), ay - headLen * Math.sin(angle - 0.4));
		ctx.lineTo(ax - headLen * Math.cos(angle + 0.4), ay - headLen * Math.sin(angle + 0.4));
		ctx.closePath();
		ctx.fill();

		// Drag handle circle at tip
		ctx.strokeStyle = '#fde68a';
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.arc(ax, ay, 7, 0, Math.PI * 2);
		ctx.stroke();

		ctx.restore();
	}

	function drawFrame(ctx: CanvasRenderingContext2D, ax: number, ay: number) {
		// Background
		ctx.fillStyle = '#0f1117';
		ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

		// Grid lines (subtle)
		ctx.strokeStyle = '#1e293b';
		ctx.lineWidth = 1;
		for (let x = 0; x <= CANVAS_SIZE; x += 50) {
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, CANVAS_SIZE);
			ctx.stroke();
		}
		for (let y = 0; y <= CANVAS_SIZE; y += 50) {
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(CANVAS_SIZE, y);
			ctx.stroke();
		}

		const angle = Math.atan2(ay, ax);
		drawCone(ctx, angle);
		drawArrow(ctx, ax, ay);

		// Label
		ctx.font = '11px system-ui, sans-serif';
		ctx.fillStyle = '#64748b';
		ctx.fillText('drag arrow tip to rotate cone', 8, CANVAS_SIZE - 8);
	}
</script>

<section id="rendering" class="mb-20">
	<h2 class="text-3xl font-bold text-white mb-6">Rendering</h2>

	<div class="prose prose-invert max-w-none mb-8">
		<p class="text-gray-300">
			Every boid on screen is a small cone shape. There are up to 2,000 of them, but the GPU only
			needs <em>one</em> <strong class="text-white">draw call</strong> — a single instruction
			telling the GPU "draw this shape" — to paint them all. This works through
			<strong class="text-white">instanced rendering</strong> — a technique where you hand the GPU
			a single mesh template and say "draw this N times." Each copy is called an
			<strong class="text-white">instance</strong>.
		</p>
		<p class="text-gray-300">
			The secret ingredient is the <strong class="text-white">vertex shader</strong> — a tiny
			program that runs on the GPU for every corner (<strong class="text-white">vertex</strong>)
			of every instance. WebGPU passes an <strong class="text-white">instance index</strong> to
			the shader automatically: 0 for the first cone, 1 for the second, and so on. The shader uses
			that index to look up position and velocity data in the boid buffer, then offsets and rotates
			the vertex accordingly. After the vertex shader positions each corner, a
			<strong class="text-white">fragment shader</strong> — another small GPU program that runs
			once per pixel and decides its color — fills in the cone's surface.
		</p>
		<p class="text-gray-300">
			The result: one cone mesh, one draw call, thousands of correctly-placed and correctly-oriented
			boids -- all computed in parallel on the GPU.
		</p>
		<p class="text-gray-300">
			The orientation of each cone comes from its velocity vector. If a boid is moving to the right,
			the cone points right. If it's moving up-left, the cone points up-left. The math that
			converts an (x, y) velocity into an angle is <code>atan2(vy, vx)</code> -- a standard
			two-argument arctangent that handles all four quadrants correctly.
		</p>
	</div>

	<!-- Instanced Rendering Diagram -->
	<div class="mb-10">
		<h3 class="text-lg font-semibold text-gray-200 mb-4">How instanced rendering works</h3>
		<div class="flex items-center gap-4 flex-wrap">
			<!-- One mesh template -->
			<div class="flex flex-col items-center gap-2">
				<div class="w-20 h-20 bg-slate-800 border border-slate-600 rounded-lg flex items-center justify-center">
					<svg width="48" height="48" viewBox="0 0 48 48">
						<polygon points="40,24 14,14 14,34" fill="#38bdf8" stroke="#7dd3fc" stroke-width="1.5" />
					</svg>
				</div>
				<span class="text-xs text-gray-400 text-center">1 cone mesh<br />(template)</span>
			</div>

			<!-- Arrow -->
			<div class="flex flex-col items-center gap-1">
				<div class="flex items-center gap-1">
					<div class="h-0.5 w-16 bg-amber-400"></div>
					<div
						class="w-0 h-0"
						style="border-top: 6px solid transparent; border-bottom: 6px solid transparent; border-left: 10px solid #fbbf24;"
					></div>
				</div>
				<span class="text-xs text-amber-400 font-mono">instanced draw</span>
			</div>

			<!-- Multiple instances -->
			<div class="flex flex-col items-center gap-2">
				<div class="w-44 h-20 bg-slate-800 border border-slate-600 rounded-lg flex items-center justify-center gap-1 px-2">
					<svg width="28" height="28" viewBox="0 0 48 48">
						<polygon points="40,24 14,14 14,34" fill="#38bdf8" stroke="#7dd3fc" stroke-width="1.5" />
					</svg>
					<svg width="28" height="28" viewBox="0 0 48 48" style="transform: rotate(45deg)">
						<polygon points="40,24 14,14 14,34" fill="#38bdf8" stroke="#7dd3fc" stroke-width="1.5" />
					</svg>
					<svg width="28" height="28" viewBox="0 0 48 48" style="transform: rotate(-30deg)">
						<polygon points="40,24 14,14 14,34" fill="#38bdf8" stroke="#7dd3fc" stroke-width="1.5" />
					</svg>
					<svg width="28" height="28" viewBox="0 0 48 48" style="transform: rotate(110deg)">
						<polygon points="40,24 14,14 14,34" fill="#38bdf8" stroke="#7dd3fc" stroke-width="1.5" />
					</svg>
				</div>
				<span class="text-xs text-gray-400 text-center">N instances, each with<br />its own position & angle</span>
			</div>
		</div>
		<p class="text-xs text-emerald-400 font-mono mt-3">1 draw call, N instances</p>
	</div>

	<!-- Cone Rotation Demo -->
	<div class="mb-4">
		<h3 class="text-lg font-semibold text-gray-200 mb-2">Velocity → rotation demo</h3>
		<p class="text-sm text-gray-400 mb-3">
			The cone always points in the direction of the yellow velocity arrow. Drag the arrow tip to
			change direction — the cone updates instantly using <code class="text-sky-400">atan2(vy, vx)</code>.
		</p>
	</div>

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="rounded-lg overflow-hidden border border-gray-700 inline-block"
		class:cursor-grabbing={dragging}
		class:cursor-crosshair={!dragging}
		onmousedown={onPointerDown}
		onmousemove={onPointerMove}
		onmouseup={onPointerUp}
		onmouseleave={onPointerUp}
	>
		<canvas bind:this={canvas} class="block max-w-full h-auto"></canvas>
	</div>
</section>
