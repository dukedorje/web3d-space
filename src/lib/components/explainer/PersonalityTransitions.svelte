<script lang="ts">
	import { createCanvasDemo } from './canvas-utils';
	import { PERSONALITY_COLORS, PERSONALITY_NAMES, PERSONALITY_TYPES, type PersonalityType } from '$lib/gpu/personality-templates';

	// ── helpers ────────────────────────────────────────────────────────────────
	function toCss(color: [number, number, number]): string {
		return `rgb(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)})`;
	}

	function toHex(color: [number, number, number]): string {
		const r = Math.round(color[0] * 255).toString(16).padStart(2, '0');
		const g = Math.round(color[1] * 255).toString(16).padStart(2, '0');
		const b = Math.round(color[2] * 255).toString(16).padStart(2, '0');
		return `#${r}${g}${b}`;
	}

	// ── Diagram constants ──────────────────────────────────────────────────────
	const DIAG_W = 560;
	const DIAG_H = 360;
	const NODE_R = 26;

	// 7 types in circle order, skipping index to match visual arrangement
	const TYPE_ORDER: PersonalityType[] = [
		PERSONALITY_TYPES.FLOCKER,   // 0
		PERSONALITY_TYPES.LONER,     // 1
		PERSONALITY_TYPES.EXPLORER,  // 3
		PERSONALITY_TYPES.TIMID,     // 5
		PERSONALITY_TYPES.SWIRLER,   // 4
		PERSONALITY_TYPES.MIMIC,     // 6
		PERSONALITY_TYPES.PREDATOR,  // 2
	];

	// Transition definitions
	interface Transition {
		from: PersonalityType;
		to: PersonalityType;
		label: string;
		color?: string; // override; defaults to 'from' color
	}

	const TRANSITIONS: Transition[] = [
		{ from: PERSONALITY_TYPES.FLOCKER,  to: PERSONALITY_TYPES.LONER,    label: 'stress > 0.8' },
		{ from: PERSONALITY_TYPES.LONER,    to: PERSONALITY_TYPES.EXPLORER, label: 'stress < 0.2, exp > 10s' },
		{ from: PERSONALITY_TYPES.EXPLORER, to: PERSONALITY_TYPES.TIMID,    label: 'stress > 0.8' },
		{ from: PERSONALITY_TYPES.TIMID,    to: PERSONALITY_TYPES.FLOCKER,  label: 'stress < 0.2, exp > 8s' },
		{ from: PERSONALITY_TYPES.PREDATOR, to: PERSONALITY_TYPES.FLOCKER,  label: 'stress < 0.1, exp > 20s' },
		// "Any -> Predator" shown as a special note, not individual arrows (would clutter)
	];

	// ── Diagram canvas ─────────────────────────────────────────────────────────
	let diagCanvas: HTMLCanvasElement | undefined = $state();

	$effect(() => {
		if (!diagCanvas) return;
		const ctx = diagCanvas.getContext('2d');
		if (!ctx) return;
		diagCanvas.width = DIAG_W;
		diagCanvas.height = DIAG_H;
		drawDiagram(ctx);
	});

	function nodePositions(): Map<PersonalityType, { x: number; y: number }> {
		const cx = DIAG_W / 2;
		const cy = DIAG_H / 2;
		const rx = DIAG_W * 0.38;
		const ry = DIAG_H * 0.38;
		const map = new Map<PersonalityType, { x: number; y: number }>();
		for (let i = 0; i < TYPE_ORDER.length; i++) {
			const angle = (2 * Math.PI * i) / TYPE_ORDER.length - Math.PI / 2;
			map.set(TYPE_ORDER[i], {
				x: cx + rx * Math.cos(angle),
				y: cy + ry * Math.sin(angle),
			});
		}
		return map;
	}

	function drawArrow(
		ctx: CanvasRenderingContext2D,
		x1: number, y1: number,
		x2: number, y2: number,
		color: string,
		label: string
	) {
		const dx = x2 - x1;
		const dy = y2 - y1;
		const dist = Math.sqrt(dx * dx + dy * dy);
		const ux = dx / dist;
		const uy = dy / dist;

		// Start/end offset by node radius + 2px gap
		const gap = NODE_R + 4;
		const sx = x1 + ux * gap;
		const sy = y1 + uy * gap;
		const ex = x2 - ux * gap;
		const ey = y2 - uy * gap;

		// Curve control point — offset perpendicular to line
		const mx = (sx + ex) / 2;
		const my = (sy + ey) / 2;
		const perp = 22;
		const cpx = mx - uy * perp;
		const cpy = my + ux * perp;

		// Line
		ctx.beginPath();
		ctx.moveTo(sx, sy);
		ctx.quadraticCurveTo(cpx, cpy, ex, ey);
		ctx.strokeStyle = color;
		ctx.lineWidth = 1.5;
		ctx.globalAlpha = 0.85;
		ctx.stroke();
		ctx.globalAlpha = 1;

		// Arrowhead
		const t = 0.85;
		const qx = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cpx + t * t * ex;
		const qy = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cpy + t * t * ey;
		const tdx = ex - qx;
		const tdy = ey - qy;
		const tlen = Math.sqrt(tdx * tdx + tdy * tdy);
		const tx = tdx / tlen;
		const ty = tdy / tlen;
		const ah = 10;
		const aw = 5;
		ctx.beginPath();
		ctx.moveTo(ex, ey);
		ctx.lineTo(ex - ah * tx + aw * ty, ey - ah * ty - aw * tx);
		ctx.lineTo(ex - ah * tx - aw * ty, ey - ah * ty + aw * tx);
		ctx.closePath();
		ctx.fillStyle = color;
		ctx.fill();

		// Label near midpoint
		const lx = cpx;
		const ly = cpy;
		ctx.save();
		ctx.font = '9px monospace';
		ctx.fillStyle = '#c0c0c0';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		// Background pill
		const tw = ctx.measureText(label).width + 6;
		ctx.fillStyle = 'rgba(15,17,23,0.82)';
		ctx.fillRect(lx - tw / 2, ly - 7, tw, 14);
		ctx.fillStyle = '#b0b8cc';
		ctx.fillText(label, lx, ly);
		ctx.restore();
	}

	function drawDiagram(ctx: CanvasRenderingContext2D) {
		ctx.clearRect(0, 0, DIAG_W, DIAG_H);
		ctx.fillStyle = '#0f1117';
		ctx.fillRect(0, 0, DIAG_W, DIAG_H);

		const pos = nodePositions();

		// Draw transition arrows first (behind nodes)
		for (const tr of TRANSITIONS) {
			const from = pos.get(tr.from);
			const to = pos.get(tr.to);
			if (!from || !to) continue;
			const color = tr.color ?? toHex(PERSONALITY_COLORS[tr.from]);
			drawArrow(ctx, from.x, from.y, to.x, to.y, color, tr.label);
		}

		// "Any -> Predator" dashed ring around predator node
		const predPos = pos.get(PERSONALITY_TYPES.PREDATOR)!;
		ctx.save();
		ctx.setLineDash([4, 3]);
		ctx.strokeStyle = toHex(PERSONALITY_COLORS[PERSONALITY_TYPES.PREDATOR]);
		ctx.lineWidth = 1.2;
		ctx.globalAlpha = 0.45;
		ctx.beginPath();
		ctx.arc(predPos.x, predPos.y, NODE_R + 10, 0, Math.PI * 2);
		ctx.stroke();
		ctx.globalAlpha = 1;
		ctx.setLineDash([]);
		ctx.restore();

		// Draw nodes
		for (const type of TYPE_ORDER) {
			const p = pos.get(type)!;
			const color = PERSONALITY_COLORS[type];
			const cssColor = toCss(color);

			// Outer glow
			ctx.save();
			ctx.shadowColor = cssColor;
			ctx.shadowBlur = 12;
			ctx.beginPath();
			ctx.arc(p.x, p.y, NODE_R, 0, Math.PI * 2);
			ctx.fillStyle = 'rgba(15,17,23,0.9)';
			ctx.fill();
			ctx.restore();

			// Border
			ctx.beginPath();
			ctx.arc(p.x, p.y, NODE_R, 0, Math.PI * 2);
			ctx.strokeStyle = cssColor;
			ctx.lineWidth = 2;
			ctx.stroke();

			// Label
			ctx.save();
			ctx.font = 'bold 10px sans-serif';
			ctx.fillStyle = cssColor;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(PERSONALITY_NAMES[type], p.x, p.y);
			ctx.restore();
		}

		// Legend: "Any → Predator" note
		ctx.save();
		ctx.font = '10px sans-serif';
		ctx.fillStyle = '#6b7280';
		ctx.textAlign = 'left';
		ctx.fillText('Dashed ring: Any type can become Predator under very high stress (rare)', 10, DIAG_H - 12);
		ctx.restore();
	}

	// ── Stress graph simulation ────────────────────────────────────────────────
	const GRAPH_W = 500;
	const GRAPH_H = 150;
	const WINDOW_SEC = 30;
	const STRESS_THRESHOLD = 0.8;
	const EXP_THRESHOLD_LOW = 8; // seconds of low stress before transition

	interface StressPoint {
		t: number;       // simulation time in seconds
		stress: number;
		type: PersonalityType;
	}

	// Boid state for the standalone stress simulation
	interface StressBoid {
		type: PersonalityType;
		stress: number;
		experience: number; // seconds in current type
		simTime: number;
	}

	let graphCanvas: HTMLCanvasElement | undefined = $state();
	let simRunning = $state(false);

	// Reactive state for display
	let currentType: PersonalityType = $state(PERSONALITY_TYPES.FLOCKER);
	let currentStress: number = $state(0);

	// Mutable sim state (not $state — updated inside animation loop)
	let boid: StressBoid = {
		type: PERSONALITY_TYPES.FLOCKER,
		stress: 0.1,
		experience: 0,
		simTime: 0,
	};
	let history: StressPoint[] = [];
	let crossings: number[] = []; // sim times where stress crossed threshold

	function resetSim() {
		boid = { type: PERSONALITY_TYPES.FLOCKER, stress: 0.1, experience: 0, simTime: 0 };
		history = [];
		crossings = [];
		currentType = PERSONALITY_TYPES.FLOCKER;
		currentStress = 0.1;
	}

	// Stress model: oscillates with noise, responds to "crowd events"
	let noisePhase = 0;
	let crowdPhase = 0;

	function stepBoid(dt: number) {
		noisePhase += dt * 0.7;
		crowdPhase += dt * 0.23;

		// Base stress: slow sine wave + faster noise
		const base = 0.35
			+ 0.28 * Math.sin(noisePhase)
			+ 0.18 * Math.sin(noisePhase * 2.7 + 1.1)
			+ 0.12 * Math.sin(crowdPhase * 5.3 + 0.5);

		// Clamp to [0,1]
		const prevStress = boid.stress;
		boid.stress = Math.max(0, Math.min(1, base));
		boid.experience += dt;
		boid.simTime += dt;

		// Detect threshold crossing (low→high)
		if (prevStress < STRESS_THRESHOLD && boid.stress >= STRESS_THRESHOLD) {
			crossings.push(boid.simTime);
		}

		// Simple transition rules
		const { type, stress, experience } = boid;
		let nextType = type;
		if (stress > STRESS_THRESHOLD) {
			if (type === PERSONALITY_TYPES.FLOCKER) nextType = PERSONALITY_TYPES.LONER;
			else if (type === PERSONALITY_TYPES.EXPLORER) nextType = PERSONALITY_TYPES.TIMID;
		} else if (stress < 0.2 && experience > EXP_THRESHOLD_LOW) {
			if (type === PERSONALITY_TYPES.LONER) nextType = PERSONALITY_TYPES.EXPLORER;
			else if (type === PERSONALITY_TYPES.TIMID) nextType = PERSONALITY_TYPES.FLOCKER;
		}
		if (nextType !== type) {
			boid.type = nextType;
			boid.experience = 0;
		}

		history.push({ t: boid.simTime, stress: boid.stress, type: boid.type });

		// Prune old history beyond window
		const cutoff = boid.simTime - WINDOW_SEC;
		while (history.length > 1 && history[0].t < cutoff) {
			history.shift();
		}
		while (crossings.length && crossings[0] < cutoff) {
			crossings.shift();
		}

		// Sync reactive state for UI
		currentType = boid.type;
		currentStress = boid.stress;
	}

	function drawGraph(ctx: CanvasRenderingContext2D) {
		const padL = 36, padR = 10, padT = 12, padB = 22;
		const W = GRAPH_W - padL - padR;
		const H = GRAPH_H - padT - padB;

		ctx.fillStyle = '#0f1117';
		ctx.fillRect(0, 0, GRAPH_W, GRAPH_H);

		if (history.length < 2) {
			ctx.fillStyle = '#4b5563';
			ctx.font = '12px sans-serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText('Press Start to run simulation', GRAPH_W / 2, GRAPH_H / 2);
			return;
		}

		const tEnd = boid.simTime;
		const tStart = Math.max(0, tEnd - WINDOW_SEC);

		function mapX(t: number) {
			return padL + ((t - tStart) / WINDOW_SEC) * W;
		}
		function mapY(v: number) {
			return padT + (1 - v) * H;
		}

		// Grid lines
		ctx.strokeStyle = '#1f2937';
		ctx.lineWidth = 1;
		for (let v = 0; v <= 1; v += 0.25) {
			ctx.beginPath();
			ctx.moveTo(padL, mapY(v));
			ctx.lineTo(padL + W, mapY(v));
			ctx.stroke();
		}

		// Threshold dashed line
		ctx.save();
		ctx.setLineDash([5, 4]);
		ctx.strokeStyle = '#ef4444';
		ctx.lineWidth = 1.2;
		ctx.globalAlpha = 0.7;
		ctx.beginPath();
		ctx.moveTo(padL, mapY(STRESS_THRESHOLD));
		ctx.lineTo(padL + W, mapY(STRESS_THRESHOLD));
		ctx.stroke();
		ctx.restore();

		// Threshold label
		ctx.fillStyle = '#ef4444';
		ctx.font = '9px monospace';
		ctx.textAlign = 'left';
		ctx.fillText('0.8', padL + W + 2, mapY(STRESS_THRESHOLD) + 3);

		// Crossing vertical lines
		for (const ct of crossings) {
			if (ct < tStart) continue;
			const x = mapX(ct);
			ctx.save();
			ctx.strokeStyle = '#fbbf24';
			ctx.lineWidth = 1;
			ctx.globalAlpha = 0.5;
			ctx.setLineDash([3, 3]);
			ctx.beginPath();
			ctx.moveTo(x, padT);
			ctx.lineTo(x, padT + H);
			ctx.stroke();
			ctx.restore();
		}

		// Stress line — colored by personality
		ctx.lineWidth = 2;
		ctx.lineJoin = 'round';
		let i = 0;
		while (i < history.length) {
			// Find run of same type
			const segType = history[i].type;
			const segColor = toCss(PERSONALITY_COLORS[segType]);
			ctx.beginPath();
			ctx.strokeStyle = segColor;
			ctx.moveTo(mapX(history[i].t), mapY(history[i].stress));
			let j = i + 1;
			while (j < history.length && history[j].type === segType) {
				ctx.lineTo(mapX(history[j].t), mapY(history[j].stress));
				j++;
			}
			// Connect to next segment start
			if (j < history.length) {
				ctx.lineTo(mapX(history[j].t), mapY(history[j].stress));
			}
			ctx.stroke();
			i = j;
		}

		// Axes
		ctx.strokeStyle = '#374151';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(padL, padT);
		ctx.lineTo(padL, padT + H);
		ctx.lineTo(padL + W, padT + H);
		ctx.stroke();

		// Y-axis labels
		ctx.fillStyle = '#6b7280';
		ctx.font = '9px monospace';
		ctx.textAlign = 'right';
		ctx.textBaseline = 'middle';
		for (let v = 0; v <= 1; v += 0.5) {
			ctx.fillText(v.toFixed(1), padL - 4, mapY(v));
		}

		// X-axis label
		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';
		ctx.fillText('time (s)', padL + W / 2, padT + H + 6);
	}

	$effect(() => {
		if (!graphCanvas) return;

		const demo = createCanvasDemo(
			graphCanvas,
			(ctx, dt) => {
				if (simRunning) {
					stepBoid(dt);
				}
				drawGraph(ctx);
			},
			{ width: GRAPH_W, height: GRAPH_H }
		);
		demo.start();
		return () => demo.stop();
	});

	function toggleSim() {
		simRunning = !simRunning;
	}

	function handleReset() {
		simRunning = false;
		noisePhase = 0;
		crowdPhase = 0;
		resetSim();
	}
</script>

<!-- ================================================================ -->
<!-- S4.4: State-Transition Diagram & Stress Graph                    -->
<!-- ================================================================ -->

<div class="mt-16 mb-4">
	<h3 class="text-xl font-semibold text-white mb-3">How Personalities Change Over Time</h3>
	<div class="prose prose-invert max-w-none mb-6">
		<p class="text-gray-300 leading-relaxed text-sm">
			Boid personalities are not fixed forever. Each boid tracks two hidden values:
			a <strong class="text-white">stress level</strong> (0–1) that rises when too many neighbors
			crowd it and falls when it has space, and an
			<strong class="text-white">experience timer</strong> that counts how long it has held its
			current personality. When stress crosses a threshold — or stays low for long enough — a
			<strong class="text-white">transition</strong> fires and the boid adopts a new personality type.
			The diagram below shows the full set of possible transitions and their conditions.
		</p>
	</div>
</div>

<!-- State-transition diagram -->
<div class="rounded-lg border border-white/10 bg-white/5 p-4 mb-6 overflow-x-auto">
	<canvas
		bind:this={diagCanvas}
		class="block mx-auto rounded"
		style="max-width: 100%;"
	></canvas>
	<p class="text-gray-500 text-xs text-center mt-2">
		Arrows show stress-driven transitions. Line color matches the source personality.
		Mimic copies the nearest neighbor's behavior rather than following a fixed rule.
	</p>
</div>

<!-- Stress time-series graph -->
<div class="mt-8 mb-4">
	<h3 class="text-xl font-semibold text-white mb-3">Stress Over Time</h3>
	<p class="text-gray-300 text-sm mb-4">
		This standalone demo simulates one boid's <strong class="text-white">stress level</strong> over
		a rolling 30-second window. The line color matches the boid's current personality. When stress
		crosses the red threshold line (0.8), a yellow marker appears and a transition may fire.
	</p>
</div>

<div class="rounded-lg border border-white/10 bg-white/5 p-4 mb-4">
	<!-- Controls -->
	<div class="flex items-center gap-3 mb-3 flex-wrap">
		<button
			onclick={toggleSim}
			class="px-4 py-1.5 rounded text-sm font-medium transition-colors
				{simRunning
					? 'bg-orange-700 hover:bg-orange-600 text-white'
					: 'bg-blue-700 hover:bg-blue-600 text-white'}"
		>
			{simRunning ? 'Stop' : 'Start'}
		</button>
		<button
			onclick={handleReset}
			class="px-4 py-1.5 rounded text-sm font-medium bg-white/10 hover:bg-white/20 text-gray-200 transition-colors"
		>
			Reset
		</button>
		<!-- Current personality badge -->
		<div class="flex items-center gap-2 ml-2">
			<div
				class="w-3 h-3 rounded-sm flex-shrink-0"
				style="background-color: {toCss(PERSONALITY_COLORS[currentType])};"
			></div>
			<span class="text-sm text-gray-300">
				{PERSONALITY_NAMES[currentType]}
				<span class="text-gray-500 ml-1">stress: {currentStress.toFixed(2)}</span>
			</span>
		</div>
	</div>

	<!-- Graph canvas -->
	<canvas
		bind:this={graphCanvas}
		class="block w-full rounded"
		style="max-height: 150px;"
	></canvas>

	<p class="text-gray-500 text-xs mt-2">
		<span class="text-yellow-400">Yellow markers</span> = stress threshold crossing.
		Line color changes when the boid transitions to a new personality.
	</p>
</div>
