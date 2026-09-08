<script lang="ts">
	const links = [
		{ href: '/world', title: 'WORLD', blurb: 'Dreamballz XELA + dingdong sky' },
		{ href: '/splat', title: 'SPLAT', blurb: 'Gaussian splat scenes' },
		{ href: '/boids', title: 'BOIDS', blurb: 'WebGPU compute heritage' }
	];
</script>

<svelte:head>
	<title>web3d-space</title>
</svelte:head>

<div class="min-h-screen bg-[#0a0a14] px-6 py-10 font-mono text-gray-200">
	<header class="mx-auto mb-10 max-w-3xl border-b border-cyan-900/50 pb-5">
		<h1 class="text-2xl font-bold tracking-wide text-cyan-400">WEB3D_SPACE</h1>
		<p class="mt-1 text-sm text-gray-500">browser world renderer · PlayCanvas + splat cache</p>
	</header>
	<main class="mx-auto grid max-w-3xl gap-3">
		{#each links as link}
			<a
				href={link.href}
				class="block border border-cyan-800/40 bg-[#0d0d1a] p-5 hover:border-cyan-400/60 hover:text-cyan-300"
			>
				<div class="text-sm font-bold tracking-widest text-cyan-600">{link.title}</div>
				<p class="mt-1 text-sm text-gray-500">{link.blurb}</p>
			</a>
		{/each}
	</main>
</div>
