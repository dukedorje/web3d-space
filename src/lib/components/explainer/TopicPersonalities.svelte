<script lang="ts">
	import SvelteGpuBridge from './SvelteGpuBridge.svelte';
	import {
		ALL_PERSONALITY_TYPES,
		PERSONALITY_NAMES,
		PERSONALITY_COLORS,
		PERSONALITY_TEMPLATES,
		type BoidConfigTemplate,
		type PersonalityType
	} from '$lib/gpu/personality-templates';
	import PersonalityComparison from './PersonalityComparison.svelte';
	import PersonalityMiniSim from './PersonalityMiniSim.svelte';
	import PersonalityTransitions from './PersonalityTransitions.svelte';

	// Convert [r,g,b] (0-1 range) to CSS rgb string
	function toCss(color: [number, number, number]): string {
		return `rgb(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)})`;
	}

	// The 8 tunable fields in display order
	const PARAM_FIELDS: { key: keyof BoidConfigTemplate; label: string; description: string }[] = [
		{ key: 'separationWeight', label: 'Separation Weight', description: 'How hard a boid pushes away from neighbors' },
		{ key: 'alignmentWeight', label: 'Alignment Weight', description: 'How strongly a boid matches its neighbors\' direction' },
		{ key: 'cohesionWeight', label: 'Cohesion Weight', description: 'Pull toward the center of nearby boids (negative = repel)' },
		{ key: 'perceptionRadius', label: 'Perception Radius', description: 'How far a boid can "see" neighbors' },
		{ key: 'separationRadius', label: 'Separation Radius', description: 'Distance at which the separation force kicks in' },
		{ key: 'maxSpeed', label: 'Max Speed', description: 'Top speed the boid can travel' },
		{ key: 'wanderStrength', label: 'Wander Strength', description: 'Random drift — higher means less predictable path' },
		{ key: 'crowdSpeedBoost', label: 'Crowd Speed Boost', description: 'Extra speed when surrounded by many neighbors' },
	];

	// Per-field: compute mean and classify each value as high/low/normal
	type CellClass = 'high' | 'low' | 'normal';

	function classifyValues(): Map<string, CellClass> {
		const result = new Map<string, CellClass>();
		for (const { key } of PARAM_FIELDS) {
			const values = ALL_PERSONALITY_TYPES.map((t) => PERSONALITY_TEMPLATES[t][key]);
			const mean = values.reduce((s, v) => s + v, 0) / values.length;
			// Use 20% above/below mean as threshold
			const hi = mean * 1.2;
			const lo = mean * 0.8;
			for (const t of ALL_PERSONALITY_TYPES) {
				const v = PERSONALITY_TEMPLATES[t][key];
				const mapKey = `${key}-${t}`;
				if (v > hi) result.set(mapKey, 'high');
				else if (v < lo) result.set(mapKey, 'low');
				else result.set(mapKey, 'normal');
			}
		}
		return result;
	}

	const cellClasses = classifyValues();

	function cellClass(key: keyof BoidConfigTemplate, t: PersonalityType): string {
		const cls = cellClasses.get(`${key}-${t}`);
		if (cls === 'high') return 'bg-green-900/40 text-green-300 font-semibold';
		if (cls === 'low') return 'bg-orange-900/40 text-orange-300 font-semibold';
		return 'text-gray-300';
	}

	// Short descriptions for each personality type
	const PERSONALITY_DESCRIPTIONS: Record<PersonalityType, string> = {
		0: 'Loves company. Stays tight with the flock, speeds up in crowds.',
		1: 'Fiercely independent. Dodges everyone and wanders solo.',
		2: 'Fast and antisocial. Ignores the flock, hunts its own path.',
		3: 'Curious wanderer. Actively drifts away from groups to explore.',
		4: 'Orbit-lover. Aligns tightly with neighbors, creating spinning rings.',
		5: 'Easily spooked. Keeps distance and bolts when crowded.',
		6: 'Chameleon. Matches Flocker behavior but blends into the crowd.',
	};
</script>

<!-- ============================================================ -->
<!-- SECTION 10 PART 1: Personality Type Display & Parameter Table -->
<!-- S4.2 (comparison widget), S4.3 (mini-sim), S4.4 (state diagram), S4.5 go below -->
<!-- ============================================================ -->
<section id="personalities" class="mb-20">
	<h2 class="text-3xl font-bold text-white mb-6">Personalities and Stress</h2>

	<!-- ── Intro prose ── -->
	<div class="prose prose-invert max-w-none mb-10">
		<p class="text-gray-300 leading-relaxed">
			Every boid in the simulation has a <strong class="text-white">personality type</strong> — a set of
			numerical weights that decide how it reacts to the boids around it. Think of it like a mood that
			never changes: a Flocker always wants to stay with the crowd, while a Predator always ignores
			everyone and charges ahead.
		</p>
		<p class="text-gray-300 leading-relaxed mt-3">
			Each personality is defined by eight tunable numbers. The most important are
			<strong class="text-white">separation weight</strong> (how hard a boid pushes away from neighbors),
			<strong class="text-white">alignment weight</strong> (how much it steers to match their direction),
			and <strong class="text-white">cohesion weight</strong> (how strongly it moves toward the center of
			nearby boids). Two radius values control what counts as "nearby":
			<strong class="text-white">perception radius</strong> is how far a boid can "see," and
			<strong class="text-white">separation radius</strong> is the personal-space bubble where pushing
			starts. Rounding things out are <strong class="text-white">max speed</strong>,
			<strong class="text-white">wander strength</strong> (random drift added to movement), and
			<strong class="text-white">crowd speed boost</strong> (extra speed when surrounded by lots of neighbors).
		</p>
	</div>

	<!-- ── Personality grid ── -->
	<h3 class="text-xl font-semibold text-white mb-4">The 7 Personality Types</h3>
	<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-12">
		{#each ALL_PERSONALITY_TYPES as t}
			{@const color = PERSONALITY_COLORS[t]}
			{@const cssColor = toCss(color)}
			<div class="rounded-lg border border-white/10 bg-white/5 p-4 flex flex-col gap-2">
				<div class="flex items-center gap-3">
					<div
						class="w-5 h-5 rounded-sm flex-shrink-0"
						style="background-color: {cssColor};"
					></div>
					<span class="font-bold text-white text-sm">{PERSONALITY_NAMES[t]}</span>
				</div>
				<p class="text-gray-400 text-xs leading-relaxed">{PERSONALITY_DESCRIPTIONS[t]}</p>
			</div>
		{/each}
	</div>

	<!-- ── Parameter comparison table ── -->
	<h3 class="text-xl font-semibold text-white mb-3">Parameter Comparison</h3>
	<p class="text-gray-400 text-sm mb-4">
		Values <span class="text-green-300 font-semibold">highlighted green</span> are notably above average for that parameter;
		<span class="text-orange-300 font-semibold">orange</span> is notably below.
	</p>

	<div class="overflow-x-auto rounded-lg border border-white/10">
		<table class="w-full text-sm border-collapse">
			<thead>
				<tr class="bg-white/10">
					<th class="text-left px-3 py-3 text-gray-300 font-semibold min-w-[160px]">Parameter</th>
					{#each ALL_PERSONALITY_TYPES as t}
						{@const cssColor = toCss(PERSONALITY_COLORS[t])}
						<th class="px-3 py-3 text-center min-w-[80px]">
							<div class="flex flex-col items-center gap-1">
								<div
									class="w-3 h-3 rounded-sm"
									style="background-color: {cssColor};"
								></div>
								<span class="text-gray-200 font-semibold text-xs">{PERSONALITY_NAMES[t]}</span>
							</div>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each PARAM_FIELDS as { key, label, description }, i}
					<tr class={i % 2 === 0 ? 'bg-white/[0.02]' : 'bg-transparent'}>
						<td class="px-3 py-2.5 border-r border-white/10">
							<div class="font-medium text-gray-200 text-xs">{label}</div>
							<div class="text-gray-500 text-xs mt-0.5">{description}</div>
						</td>
						{#each ALL_PERSONALITY_TYPES as t}
							<td class="px-3 py-2.5 text-center text-xs {cellClass(key, t)}">
								{PERSONALITY_TEMPLATES[t][key]}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- S4.2: Personality Comparison Widget -->
	<PersonalityComparison />

	<!-- S4.3: Personality Mini-Simulation -->
	<PersonalityMiniSim />

	<!-- S4.4: State-transition diagram & stress graph -->
	<PersonalityTransitions />

	<!-- S4.5: Svelte-GPU Bridge -->
	<SvelteGpuBridge />
</section>
