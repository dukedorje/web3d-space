<script lang="ts">
	import StickyNav from '$lib/components/explainer/StickyNav.svelte';
	import TopicGpu from '$lib/components/explainer/TopicGpu.svelte';
	import TopicWebgpuPipeline from '$lib/components/explainer/TopicWebgpuPipeline.svelte';
	import TopicBoidRules from '$lib/components/explainer/TopicBoidRules.svelte';
	import TopicMemoryLayout from '$lib/components/explainer/TopicMemoryLayout.svelte';
	import TopicDoubleBuffering from '$lib/components/explainer/TopicDoubleBuffering.svelte';
	import TopicComputeShader from '$lib/components/explainer/TopicComputeShader.svelte';
	import TopicNeighborQueries from '$lib/components/explainer/TopicNeighborQueries.svelte';
	import TopicRendering from '$lib/components/explainer/TopicRendering.svelte';
	import TopicCamera from '$lib/components/explainer/TopicCamera.svelte';
	import TopicPersonalities from '$lib/components/explainer/TopicPersonalities.svelte';

	const sections = [
		{ id: 'what-is-a-gpu', title: 'What Is a GPU?' },
		{ id: 'webgpu-pipeline', title: 'The WebGPU Pipeline' },
		{ id: 'boid-rules', title: 'Boid Rules' },
		{ id: 'memory-layout', title: 'Memory Layout' },
		{ id: 'double-buffering', title: 'Double Buffering' },
		{ id: 'compute-shader', title: 'The Compute Shader' },
		{ id: 'neighbor-queries', title: 'Neighbor Queries' },
		{ id: 'rendering', title: 'Rendering' },
		{ id: 'camera', title: 'The Camera' },
		{ id: 'personalities', title: 'Personalities and Stress' }
	];

	// Pre-warm Shiki on idle so code blocks highlight faster
	if (typeof window !== 'undefined') {
		const warmShiki = () =>
			import('shiki').then((s) =>
				s.createHighlighter({ langs: ['wgsl', 'typescript'], themes: ['github-dark'] })
			);
		if ('requestIdleCallback' in window) {
			requestIdleCallback(() => warmShiki());
		} else {
			setTimeout(() => warmShiki(), 1000);
		}
	}
</script>

<svelte:head>
	<title>How It Works — Web3D Boid Simulation</title>
	<meta
		name="description"
		content="An interactive guide to how the WebGPU boid simulation works — from GPU basics to personality systems."
	/>
</svelte:head>

<div class="min-h-screen bg-gray-950 text-white">
	<StickyNav {sections} />

	<!-- Desktop: offset content for sidebar; Mobile: offset for top bar -->
	<main class="lg:pl-64 pt-14 lg:pt-0">
		<div class="max-w-3xl mx-auto px-6 py-16">
			<header class="mb-16">
				<div class="flex items-start justify-between gap-4 mb-4">
					<h1 class="text-5xl font-bold text-white">How It Works</h1>
					<a href="/boids" class="shrink-0 mt-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">See It Live →</a>
				</div>
				<p class="text-lg text-gray-400">
					A deep dive into the WebGPU boid simulation — what every piece does, why it's built
					that way, and how it all fits together.
				</p>
				<p class="mt-3 text-sm text-gray-500">
					No prior GPU or graphics programming knowledge required.
				</p>
			</header>

			<TopicGpu />
			<TopicWebgpuPipeline />
			<TopicBoidRules />
			<TopicMemoryLayout />
			<TopicDoubleBuffering />
			<TopicComputeShader />
			<TopicNeighborQueries />
			<TopicRendering />
			<TopicCamera />
			<TopicPersonalities />

			<!-- CTA: Try the simulation -->
			<section class="mt-16 mb-8 text-center py-12 rounded-2xl border border-white/10 bg-white/5">
				<h2 class="text-2xl font-bold text-white mb-3">Ready to see it in action?</h2>
				<p class="text-gray-400 mb-6 max-w-md mx-auto">
					You now know how GPUs work, how boids steer, and how personalities create variety.
					Time to watch 2,000 boids do their thing.
				</p>
				<a href="/boids" class="inline-block bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-3 rounded-lg transition-colors">
					Try the Simulation
				</a>
			</section>
		</div>
	</main>
</div>
