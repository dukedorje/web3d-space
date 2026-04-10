<script lang="ts">
	import {
		PERSONALITY_NAMES,
		PERSONALITY_TEMPLATES,
		PERSONALITY_COLORS,
		ALL_PERSONALITY_TYPES,
		type PersonalityType,
		type BoidConfigTemplate
	} from '$lib/gpu/personality-templates';

	const FIELD_LABELS: Record<keyof BoidConfigTemplate, string> = {
		separationWeight: 'Separation Weight',
		alignmentWeight: 'Alignment Weight',
		cohesionWeight: 'Cohesion Weight',
		perceptionRadius: 'Perception Radius',
		separationRadius: 'Separation Radius',
		maxSpeed: 'Max Speed',
		wanderStrength: 'Wander Strength',
		crowdSpeedBoost: 'Crowd Speed Boost'
	};

	const FIELDS = Object.keys(FIELD_LABELS) as (keyof BoidConfigTemplate)[];

	// "none" sentinel for single-type mode
	type SelectionValue = PersonalityType | 'none';

	let selA = $state<SelectionValue>(0); // Flocker
	let selB = $state<SelectionValue>(2); // Predator

	function toRgb(type: PersonalityType): string {
		const [r, g, b] = PERSONALITY_COLORS[type];
		return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
	}

	function formatVal(v: number): string {
		return v % 1 === 0 ? v.toFixed(1) : v.toFixed(2).replace(/0+$/, '');
	}

	function diffInfo(a: number, b: number): { symbol: string; cls: string; pct: string } {
		if (a === b) return { symbol: '=', cls: 'text-gray-400', pct: 'same' };
		const pct = a === 0 ? null : Math.round(((b - a) / Math.abs(a)) * 100);
		const pctStr = pct !== null ? `${pct > 0 ? '+' : ''}${pct}%` : b > a ? 'higher' : 'lower';
		if (b > a) return { symbol: '▲', cls: 'text-green-400', pct: pctStr };
		return { symbol: '▼', cls: 'text-red-400', pct: pctStr };
	}

	const templateA = $derived(selA !== 'none' ? PERSONALITY_TEMPLATES[selA] : null);
	const templateB = $derived(selB !== 'none' ? PERSONALITY_TEMPLATES[selB] : null);
	const comparing = $derived(templateA !== null && templateB !== null);
</script>

<div class="mt-10 rounded-xl bg-gray-800/50 border border-gray-700 p-6">
	<h3 class="text-xl font-semibold text-white mb-5">Compare Personalities</h3>

	<!-- Dropdowns -->
	<div class="flex flex-col sm:flex-row gap-4 mb-6">
		<div class="flex-1">
			<label class="block text-xs text-gray-400 mb-1 uppercase tracking-wide" for="sel-a">
				Type A
			</label>
			<select
				id="sel-a"
				bind:value={selA}
				class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
			>
				<option value="none">— None —</option>
				{#each ALL_PERSONALITY_TYPES as t}
					<option value={t}>{PERSONALITY_NAMES[t]}</option>
				{/each}
			</select>
		</div>

		<div class="flex items-end pb-2 text-gray-500 text-lg font-bold select-none hidden sm:flex">vs</div>

		<div class="flex-1">
			<label class="block text-xs text-gray-400 mb-1 uppercase tracking-wide" for="sel-b">
				Type B
			</label>
			<select
				id="sel-b"
				bind:value={selB}
				class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
			>
				<option value="none">— None —</option>
				{#each ALL_PERSONALITY_TYPES as t}
					<option value={t}>{PERSONALITY_NAMES[t]}</option>
				{/each}
			</select>
		</div>
	</div>

	{#if !templateA && !templateB}
		<p class="text-gray-500 text-sm italic">Select at least one personality type above.</p>
	{:else}
		<!-- Column headers -->
		<div class="grid mb-2" style="grid-template-columns: 1fr 120px 1fr">
			{#if templateA}
				<div class="text-sm font-semibold text-right pr-3" style="color: {selA !== 'none' ? toRgb(selA as PersonalityType) : 'white'}">
					{selA !== 'none' ? PERSONALITY_NAMES[selA as PersonalityType] : ''}
				</div>
			{:else}
				<div></div>
			{/if}
			<div class="text-xs text-gray-500 text-center uppercase tracking-wide self-center">Parameter</div>
			{#if templateB}
				<div class="text-sm font-semibold text-left pl-3" style="color: {selB !== 'none' ? toRgb(selB as PersonalityType) : 'white'}">
					{selB !== 'none' ? PERSONALITY_NAMES[selB as PersonalityType] : ''}
				</div>
			{:else}
				<div></div>
			{/if}
		</div>

		<!-- Parameter rows -->
		<div class="divide-y divide-gray-700/50">
			{#each FIELDS as field}
				{@const valA = templateA ? templateA[field] : null}
				{@const valB = templateB ? templateB[field] : null}
				{@const diff = comparing && valA !== null && valB !== null ? diffInfo(valA, valB) : null}

				<div class="grid py-2 items-center" style="grid-template-columns: 1fr 120px 1fr">
					<!-- Value A -->
					<div class="text-right pr-3">
						{#if valA !== null}
							<span class="font-mono text-sm text-white">{formatVal(valA)}</span>
							{#if diff}
								<span class="ml-1 text-xs {diff.cls}">{diff.pct}</span>
							{/if}
						{/if}
					</div>

					<!-- Center: parameter name + diff indicator -->
					<div class="text-center">
						<div class="text-xs text-gray-400">{FIELD_LABELS[field]}</div>
						{#if diff}
							<span class="text-sm {diff.cls} font-bold">{diff.symbol}</span>
						{/if}
					</div>

					<!-- Value B -->
					<div class="text-left pl-3">
						{#if valB !== null}
							{#if diff}
								<span class="text-xs {diff.cls} mr-1">{diff.pct}</span>
							{/if}
							<span class="font-mono text-sm text-white">{formatVal(valB)}</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>

		<!-- Magnitude summary when comparing -->
		{#if comparing && templateA && templateB}
			{@const pairs = FIELDS.map(f => ({ f, a: templateA[f], b: templateB[f] }))}
			{@const bigger = pairs.filter(p => p.b > p.a).length}
			{@const smaller = pairs.filter(p => p.b < p.a).length}
			<p class="mt-4 text-xs text-gray-500 text-center">
				{selB !== 'none' ? PERSONALITY_NAMES[selB as PersonalityType] : 'B'} is higher in {bigger} and lower in {smaller} of 8 parameters compared to {selA !== 'none' ? PERSONALITY_NAMES[selA as PersonalityType] : 'A'}.
			</p>
		{/if}
	{/if}
</div>
