<script lang="ts">
	interface Section {
		id: string;
		title: string;
	}

	interface Props {
		sections: Section[];
	}

	let { sections }: Props = $props();
	let activeId = $state(sections[0]?.id ?? '');
	let mobileOpen = $state(false);

	function scrollTo(id: string) {
		const el = document.getElementById(id);
		if (el) {
			el.scrollIntoView({ behavior: 'smooth' });
			mobileOpen = false;
		}
	}

	$effect(() => {
		const sectionEls = sections
			.map((s) => document.getElementById(s.id))
			.filter((el): el is HTMLElement => el !== null);

		if (sectionEls.length === 0) return;

		const observer = new IntersectionObserver(
			(entries) => {
				// Find the topmost visible section
				const visible = entries
					.filter((e) => e.isIntersecting)
					.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

				if (visible.length > 0) {
					activeId = visible[0].target.id;
				}
			},
			{
				rootMargin: '-10% 0px -60% 0px',
				threshold: 0
			}
		);

		for (const el of sectionEls) {
			observer.observe(el);
		}

		return () => observer.disconnect();
	});
</script>

<!-- Desktop sidebar -->
<nav
	class="hidden lg:block fixed left-0 top-0 h-screen w-64 overflow-y-auto border-r border-white/10 bg-gray-950/80 backdrop-blur-sm pt-20 pb-8 px-4 z-40"
>
	<div class="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">Contents</div>
	<ul class="space-y-1">
		{#each sections as section, i}
			<li>
				<button
					onclick={() => scrollTo(section.id)}
					class="w-full text-left px-3 py-1.5 rounded text-sm transition-colors duration-150
						{activeId === section.id
						? 'text-blue-400 bg-blue-400/10 border-l-2 border-blue-400 font-medium'
						: 'text-gray-400 hover:text-gray-200 border-l-2 border-transparent'}"
				>
					<span class="text-gray-600 mr-1.5">{i + 1}.</span>
					{section.title}
				</button>
			</li>
		{/each}
	</ul>
	<div class="mt-6 pt-4 border-t border-white/10">
		<a href="/boids" class="block px-3 py-2 rounded text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 transition-colors">
			See It Live →
		</a>
	</div>
</nav>

<!-- Mobile top bar -->
<div class="lg:hidden fixed top-0 left-0 right-0 z-40 bg-gray-950/90 backdrop-blur-sm border-b border-white/10">
	<button
		onclick={() => (mobileOpen = !mobileOpen)}
		class="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-300"
	>
		<span class="font-medium">
			{sections.find((s) => s.id === activeId)?.title ?? 'Contents'}
		</span>
		<svg
			class="w-4 h-4 transition-transform {mobileOpen ? 'rotate-180' : ''}"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	{#if mobileOpen}
		<ul class="border-t border-white/10 px-4 py-2 space-y-1 max-h-[60vh] overflow-y-auto">
			{#each sections as section, i}
				<li>
					<button
						onclick={() => scrollTo(section.id)}
						class="w-full text-left px-3 py-1.5 rounded text-sm transition-colors
							{activeId === section.id
							? 'text-blue-400 bg-blue-400/10 font-medium'
							: 'text-gray-400 hover:text-gray-200'}"
					>
						<span class="text-gray-600 mr-1.5">{i + 1}.</span>
						{section.title}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
