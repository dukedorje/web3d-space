<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { createPlayCanvasApp, type PlayCanvasApp } from '$lib/playcanvas/create-app';
	import { createOrbitCamera } from '$lib/playcanvas/orbit-camera';
	import { mountMeshScene, type MeshScene } from '$lib/mesh/mount';
	import { simulateMesh } from '$lib/mesh/simulate';
	import { FIXTURE_WALK, paintGrid, samplesUntil, type CoverageGrid } from '$lib/mesh/coverage';
	import { edgeStrength, type TopoGraph } from '$lib/mesh/graph';

	let canvas: HTMLCanvasElement;
	let pcState: PlayCanvasApp | null = null;
	let scene: MeshScene | null = null;
	let graph = $state<TopoGraph>({ nodes: [], edges: [] });
	let coverage = $state<CoverageGrid>(paintGrid([]));
	let elapsed = $state(0);
	let error = $state<string | null>(null);

	onMount(() => {
		let dead = false;
		let raf = 0;
		let orbit: ReturnType<typeof createOrbitCamera> | null = null;
		const origin = performance.now();

		function tick() {
			if (dead) return;
			elapsed = performance.now() - origin;
			graph = simulateMesh(elapsed).graph;
			coverage = paintGrid(samplesUntil(FIXTURE_WALK, elapsed));
			scene?.sync(graph, coverage);
			orbit?.update();
			raf = requestAnimationFrame(tick);
		}
		raf = requestAnimationFrame(tick);

		async function boot() {
			try {
				pcState = await createPlayCanvasApp({ canvas });
				if (dead) {
					pcState.app.destroy();
					pcState = null;
					return;
				}
				const { pc, app } = pcState;
				const camera = new pc.Entity('Camera');
				camera.addComponent('camera', {
					clearColor: new pc.Color(0.04, 0.045, 0.07),
					farClip: 200
				});
				app.root.addChild(camera);
				orbit = createOrbitCamera(canvas, camera, pc, {
					yaw: 28,
					pitch: -28,
					distance: 28,
					target: [0, 0.4, 0],
					minDistance: 10,
					maxDistance: 60
				});
				scene = mountMeshScene(pcState);
			} catch (err) {
				error = err instanceof Error ? err.message : String(err);
			}
		}

		boot();
		return () => {
			dead = true;
			cancelAnimationFrame(raf);
			orbit?.destroy();
			scene?.destroy();
			scene = null;
			pcState?.app.destroy();
			pcState = null;
		};
	});

	onDestroy(() => {
		scene?.destroy();
		pcState?.app.destroy();
	});
</script>

<svelte:head>
	<title>MESH — lightning radio world</title>
</svelte:head>

<div class="stage">
	<canvas bind:this={canvas} aria-label="Lightning Mesh radio world"></canvas>
	<header>
		<p class="kicker">LIGHTNING MESH</p>
		<h1>RADIO WORLD</h1>
		<p class="lede">
			Simulated <code>GET /api/radio</code> from the four-router 802.11s fleet. Directory gossips in,
			then stations and HWMP paths. Magenta tiles are a recorded walk — not the cyan/gold links. Hill
			drops telemetry on the odd 8s — 404 is a normal state.
		</p>
	</header>
	<aside>
		<p class="clock font-numerals">{(elapsed / 1000).toFixed(1)}s</p>
		<p class="coverage">
			<span class="k">coverage</span>
			<span class="pct font-numerals">{Math.round(coverage.completeness * 100)}%</span>
			{#if coverage.covered === 0 && coverage.thin === 0}
				<span class="meta">unknown</span>
			{:else}
				<span class="meta font-numerals">
					{coverage.covered} covered · {coverage.thin} thin · {coverage.unknown} unknown
				</span>
			{/if}
		</p>
		{#if error}
			<p class="fail">{error}</p>
		{:else if graph.nodes.length === 0}
			<p class="quiet">waiting on CRDT gossip…</p>
		{:else}
			<ul>
				{#each graph.nodes as node (node.key)}
					<li class:self={node.isSelf} class:dark={!node.radio}>
						<span class="name">{node.name ?? node.label}</span>
						<span class="meta font-numerals">
							{node.radio
								? `${node.radio.channel} · ${node.radio.freq_mhz} · ${node.radio.stations.length} sta`
								: 'no telemetry'}
						</span>
					</li>
				{/each}
			</ul>
			<ul class="edges">
				{#each graph.edges as edge (`${edge.a}|${edge.b}`)}
					<li class={edgeStrength(edge)}>
						<span
							>{graph.nodes.find((n) => n.key === edge.a)?.name}
							—
							{graph.nodes.find((n) => n.key === edge.b)?.name}</span
						>
						<span class="meta font-numerals">
							{Math.round(Math.max(edge.aToB?.throughputMbps ?? 0, edge.bToA?.throughputMbps ?? 0))}
							Mb/s
							{#if edge.aToB?.relayed || edge.bToA?.relayed}· relay{/if}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</aside>
</div>

<style>
	.stage {
		position: relative;
		min-height: 100vh;
		background: #090910;
		color: #c9d4dc;
		font-family: ui-monospace, monospace;
	}
	canvas {
		display: block;
		width: 100%;
		height: 100vh;
		cursor: grab;
	}
	header,
	aside {
		position: absolute;
		pointer-events: none;
		z-index: 1;
	}
	header {
		top: 1.2rem;
		left: 1.4rem;
		max-width: 28rem;
	}
	.kicker {
		margin: 0;
		letter-spacing: 0.28em;
		font-size: 0.68rem;
		color: #22e0e2;
	}
	h1 {
		margin: 0.2rem 0 0.5rem;
		font-family: 'Space Age', sans-serif;
		font-size: 1.6rem;
		font-weight: 400;
		color: #f5be4f;
	}
	.lede {
		margin: 0;
		font-size: 0.78rem;
		line-height: 1.45;
		color: #8b97a3;
	}
	code {
		color: #22e0e2;
	}
	aside {
		right: 1.2rem;
		top: 1.2rem;
		width: 18rem;
		border: 1px solid color-mix(in srgb, #22e0e2 28%, transparent);
		background: color-mix(in srgb, #090910 78%, transparent);
		padding: 0.8rem 0.9rem;
	}
	.clock {
		margin: 0 0 0.6rem;
		font-size: 1.4rem;
		color: #f5be4f;
	}
	.coverage {
		margin: 0 0 0.7rem;
	}
	.coverage .k {
		display: block;
		letter-spacing: 0.22em;
		font-size: 0.62rem;
		color: #e85aa8;
	}
	.coverage .pct {
		display: block;
		font-size: 1.4rem;
		color: #e85aa8;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.35rem;
	}
	li {
		display: grid;
		gap: 0.1rem;
		font-size: 0.78rem;
	}
	li.self .name {
		color: #f5be4f;
	}
	li.dark .name {
		color: #6a7380;
	}
	.meta {
		font-size: 0.7rem;
		color: #7d8894;
	}
	.edges {
		margin-top: 0.8rem;
		padding-top: 0.7rem;
		border-top: 1px solid color-mix(in srgb, #22e0e2 22%, transparent);
	}
	.strong {
		color: #22e0e2;
	}
	.relay {
		color: #f5be4f;
	}
	.weak {
		color: #8b97a3;
	}
	.quiet,
	.fail {
		margin: 0;
		font-size: 0.78rem;
	}
	.fail {
		color: #e07070;
	}
</style>
