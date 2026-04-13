<script lang="ts">
	import { getScenesByCategory, type SplatScene } from '$lib/splat/scenes';

	const sections: { title: string; subtitle: string; scenes: SplatScene[] }[] = [
		{
			title: 'COMPOSITES',
			subtitle: 'Objects placed inside environments',
			scenes: getScenesByCategory('composite')
		},
		{
			title: 'ENVIRONMENTS',
			subtitle: 'Full scene captures you can fly through',
			scenes: getScenesByCategory('environment')
		},
		{
			title: 'OBJECTS',
			subtitle: 'Individual object captures',
			scenes: getScenesByCategory('object')
		}
	];
</script>

<svelte:head>
	<title>Splat Viewer — Gaussian Splat Scenes</title>
</svelte:head>

<div class="min-h-screen bg-[#0a0a14] text-gray-200 font-mono">
	<header class="border-b border-cyan-900/50 px-6 py-5">
		<h1 class="text-2xl font-bold tracking-wide text-cyan-400">
			SPLAT_VIEWER
		</h1>
		<p class="mt-1 text-sm text-gray-500">Gaussian splat scenes &mdash; click to enter</p>
	</header>

	<main class="mx-auto max-w-5xl px-6 py-8">
		{#each sections as section}
			<section class="mb-10">
				<div class="mb-4 border-b border-cyan-900/30 pb-2">
					<h2 class="text-sm font-bold tracking-widest text-cyan-600">{section.title}</h2>
					<p class="mt-0.5 text-xs text-gray-600">{section.subtitle}</p>
				</div>

				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#each section.scenes as scene}
						<a
							href="/splat/{scene.slug}"
							class="group block border border-cyan-800/40 bg-[#0d0d1a] p-5
							       transition-all hover:border-cyan-400/60 hover:bg-[#111128]
							       hover:shadow-[0_0_20px_rgba(0,200,255,0.08)]"
						>
							<div class="mb-3 flex items-center justify-between">
								<h3 class="text-base font-semibold text-gray-100 group-hover:text-cyan-300">
									{scene.title}
								</h3>
								<span class="text-xs text-cyan-700 group-hover:text-cyan-400">&rarr;</span>
							</div>

							<p class="mb-4 text-sm leading-relaxed text-gray-500">
								{scene.description}
							</p>

							<div class="flex flex-wrap gap-1.5">
								{#each scene.tags as tag}
									<span class="border border-cyan-900/60 px-1.5 py-0.5 text-[0.65rem] uppercase tracking-wider text-cyan-600">
										{tag}
									</span>
								{/each}
							</div>
						</a>
					{/each}
				</div>
			</section>
		{/each}
	</main>
</div>

<style>
	:global(body) {
		margin: 0;
	}
</style>
