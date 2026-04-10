/**
 * Personality type definitions and templates for the boid simulation.
 * Single source of truth for personality config values (D-009).
 */

/** Bytes per boid config — must match BYTES_PER_CONFIG in boid-buffers.ts */
const BYTES_PER_CONFIG = 48;

export const PERSONALITY_TYPES = {
	FLOCKER: 0,
	LONER: 1,
	PREDATOR: 2,
	EXPLORER: 3,
	SWIRLER: 4,
	TIMID: 5,
	MIMIC: 6,
} as const;

export type PersonalityType = typeof PERSONALITY_TYPES[keyof typeof PERSONALITY_TYPES];

/** All valid personality type values. */
export const ALL_PERSONALITY_TYPES: readonly PersonalityType[] = [0, 1, 2, 3, 4, 5, 6];

/** Human-readable names for each personality type. */
export const PERSONALITY_NAMES: Record<PersonalityType, string> = {
	[PERSONALITY_TYPES.FLOCKER]: 'Flocker',
	[PERSONALITY_TYPES.LONER]: 'Loner',
	[PERSONALITY_TYPES.PREDATOR]: 'Predator',
	[PERSONALITY_TYPES.EXPLORER]: 'Explorer',
	[PERSONALITY_TYPES.SWIRLER]: 'Swirler',
	[PERSONALITY_TYPES.TIMID]: 'Timid',
	[PERSONALITY_TYPES.MIMIC]: 'Mimic',
};

/** RGB colors matching the WGSL COLORS array in boid-render.wgsl. */
export const PERSONALITY_COLORS: Record<PersonalityType, [number, number, number]> = {
	[PERSONALITY_TYPES.FLOCKER]: [0.2, 0.6, 1.0],
	[PERSONALITY_TYPES.LONER]: [1.0, 0.45, 0.1],
	[PERSONALITY_TYPES.PREDATOR]: [1.0, 0.15, 0.15],
	[PERSONALITY_TYPES.EXPLORER]: [0.2, 0.9, 0.3],
	[PERSONALITY_TYPES.SWIRLER]: [0.7, 0.3, 1.0],
	[PERSONALITY_TYPES.TIMID]: [1.0, 0.9, 0.2],
	[PERSONALITY_TYPES.MIMIC]: [0.9, 0.9, 0.9],
};

/** Tunable fields of a BoidConfig (excludes experienceTimer, stressLevel, padding). */
export interface BoidConfigTemplate {
	separationWeight: number;
	alignmentWeight: number;
	cohesionWeight: number;
	perceptionRadius: number;
	separationRadius: number;
	maxSpeed: number;
	wanderStrength: number;
	crowdSpeedBoost: number;
}

/**
 * Canonical personality templates. Values are starting points tuned for visual
 * distinctness at 300 boids in a 100-unit world.
 */
export const PERSONALITY_TEMPLATES: Record<PersonalityType, BoidConfigTemplate> = {
	[PERSONALITY_TYPES.FLOCKER]: {
		separationWeight: 1.5,
		alignmentWeight: 1.0,
		cohesionWeight: 1.0,
		perceptionRadius: 15.0,
		separationRadius: 5.0,
		maxSpeed: 25.0,
		wanderStrength: 0.0,
		crowdSpeedBoost: 1.5,
	},
	[PERSONALITY_TYPES.LONER]: {
		separationWeight: 3.0,
		alignmentWeight: 0.1,
		cohesionWeight: 0.0,
		perceptionRadius: 20.0,
		separationRadius: 10.0,
		maxSpeed: 20.0,
		wanderStrength: 0.5,
		crowdSpeedBoost: 0.0,
	},
	[PERSONALITY_TYPES.PREDATOR]: {
		separationWeight: 0.5,
		alignmentWeight: 0.0,
		cohesionWeight: 0.0,
		perceptionRadius: 25.0,
		separationRadius: 3.0,
		maxSpeed: 35.0,
		wanderStrength: 0.3,
		crowdSpeedBoost: 0.0,
	},
	[PERSONALITY_TYPES.EXPLORER]: {
		separationWeight: 1.0,
		alignmentWeight: 0.3,
		cohesionWeight: -0.5,
		perceptionRadius: 18.0,
		separationRadius: 6.0,
		maxSpeed: 28.0,
		wanderStrength: 0.8,
		crowdSpeedBoost: 0.5,
	},
	[PERSONALITY_TYPES.SWIRLER]: {
		separationWeight: 1.2,
		alignmentWeight: 1.5,
		cohesionWeight: 0.7,
		perceptionRadius: 15.0,
		separationRadius: 4.0,
		maxSpeed: 22.0,
		wanderStrength: 0.1,
		crowdSpeedBoost: 0.5,
	},
	[PERSONALITY_TYPES.TIMID]: {
		separationWeight: 2.5,
		alignmentWeight: 0.4,
		cohesionWeight: 0.3,
		perceptionRadius: 20.0,
		separationRadius: 8.0,
		maxSpeed: 30.0,
		wanderStrength: 0.2,
		crowdSpeedBoost: 2.0,
	},
	[PERSONALITY_TYPES.MIMIC]: {
		separationWeight: 1.5,
		alignmentWeight: 1.0,
		cohesionWeight: 1.0,
		perceptionRadius: 15.0,
		separationRadius: 5.0,
		maxSpeed: 25.0,
		wanderStrength: 0.0,
		crowdSpeedBoost: 1.0,
	},
};

/**
 * Pack a personality template into a 48-byte Float32Array ready for GPU upload.
 * Layout matches the BoidConfig WGSL struct (D-008).
 */
export function packConfigForBoid(
	template: BoidConfigTemplate,
	personalityType: PersonalityType
): Float32Array {
	const floatsPerConfig = BYTES_PER_CONFIG / 4; // 12
	const data = new Float32Array(floatsPerConfig);
	const u32View = new Uint32Array(data.buffer);

	data[0] = template.separationWeight;
	data[1] = template.alignmentWeight;
	data[2] = template.cohesionWeight;
	data[3] = template.perceptionRadius;
	data[4] = template.separationRadius;
	data[5] = template.maxSpeed;
	data[6] = template.wanderStrength;
	data[7] = template.crowdSpeedBoost;
	u32View[8] = personalityType;
	data[9] = 0.0; // experienceTimer
	data[10] = 0.0; // stressLevel
	data[11] = 0.0; // _padding

	return data;
}

/** Personality distribution: maps each type to a ratio (0-1). */
export type PersonalityDistribution = Record<PersonalityType, number>;

/** Default distribution: 40% flockers, 15% loners, 10% each mid-tier, 5% mimics. */
export const DEFAULT_DISTRIBUTION: PersonalityDistribution = {
	[PERSONALITY_TYPES.FLOCKER]: 0.40,
	[PERSONALITY_TYPES.LONER]: 0.15,
	[PERSONALITY_TYPES.PREDATOR]: 0.10,
	[PERSONALITY_TYPES.EXPLORER]: 0.10,
	[PERSONALITY_TYPES.SWIRLER]: 0.10,
	[PERSONALITY_TYPES.TIMID]: 0.10,
	[PERSONALITY_TYPES.MIMIC]: 0.05,
};

/** Preset distributions for quick selection. */
export const DISTRIBUTION_PRESETS: Record<string, PersonalityDistribution> = {
	Balanced: DEFAULT_DISTRIBUTION,
	'All Flockers': {
		[PERSONALITY_TYPES.FLOCKER]: 1.0,
		[PERSONALITY_TYPES.LONER]: 0.0,
		[PERSONALITY_TYPES.PREDATOR]: 0.0,
		[PERSONALITY_TYPES.EXPLORER]: 0.0,
		[PERSONALITY_TYPES.SWIRLER]: 0.0,
		[PERSONALITY_TYPES.TIMID]: 0.0,
		[PERSONALITY_TYPES.MIMIC]: 0.0,
	},
	'Predator Chaos': {
		[PERSONALITY_TYPES.FLOCKER]: 0.20,
		[PERSONALITY_TYPES.LONER]: 0.10,
		[PERSONALITY_TYPES.PREDATOR]: 0.40,
		[PERSONALITY_TYPES.EXPLORER]: 0.0,
		[PERSONALITY_TYPES.SWIRLER]: 0.0,
		[PERSONALITY_TYPES.TIMID]: 0.30,
		[PERSONALITY_TYPES.MIMIC]: 0.0,
	},
	'Peaceful Flock': {
		[PERSONALITY_TYPES.FLOCKER]: 0.80,
		[PERSONALITY_TYPES.LONER]: 0.0,
		[PERSONALITY_TYPES.PREDATOR]: 0.0,
		[PERSONALITY_TYPES.EXPLORER]: 0.10,
		[PERSONALITY_TYPES.SWIRLER]: 0.10,
		[PERSONALITY_TYPES.TIMID]: 0.0,
		[PERSONALITY_TYPES.MIMIC]: 0.0,
	},
	Chaos: {
		[PERSONALITY_TYPES.FLOCKER]: 0.0,
		[PERSONALITY_TYPES.LONER]: 0.0,
		[PERSONALITY_TYPES.PREDATOR]: 0.0,
		[PERSONALITY_TYPES.EXPLORER]: 0.50,
		[PERSONALITY_TYPES.SWIRLER]: 0.50,
		[PERSONALITY_TYPES.TIMID]: 0.0,
		[PERSONALITY_TYPES.MIMIC]: 0.0,
	},
};

/** Preset names in display order. */
export const PRESET_NAMES = Object.keys(DISTRIBUTION_PRESETS);

/**
 * Normalize a distribution so ratios sum to 1. Handles edge case of all-zero
 * by falling back to uniform distribution.
 */
export function normalizeDistribution(dist: PersonalityDistribution): PersonalityDistribution {
	const sum = ALL_PERSONALITY_TYPES.reduce<number>((s, t) => s + Math.max(0, dist[t] ?? 0), 0);
	if (sum < 0.001) {
		// Fallback: uniform
		const uniform = 1 / ALL_PERSONALITY_TYPES.length;
		const result = {} as Record<number, number>;
		for (const t of ALL_PERSONALITY_TYPES) result[t] = uniform;
		return result as PersonalityDistribution;
	}
	const result = {} as Record<number, number>;
	for (const t of ALL_PERSONALITY_TYPES) {
		result[t] = Math.max(0, dist[t] ?? 0) / sum;
	}
	return result as PersonalityDistribution;
}

/**
 * Assign personality types to `count` boids based on the given distribution.
 * Returns a shuffled array of PersonalityType values.
 */
export function distributePersonalities(
	count: number,
	distribution?: PersonalityDistribution
): PersonalityType[] {
	const dist = normalizeDistribution(distribution ?? DEFAULT_DISTRIBUTION);
	const assignments: PersonalityType[] = [];

	// Allocate counts proportionally, rounding down
	let remaining = count;
	const counts: [PersonalityType, number][] = [];
	for (const t of ALL_PERSONALITY_TYPES) {
		const n = Math.floor(dist[t] * count);
		counts.push([t, n]);
		remaining -= n;
	}

	// Distribute remainder by largest fractional part
	const fractionals = ALL_PERSONALITY_TYPES
		.map((t) => ({ type: t, frac: dist[t] * count - Math.floor(dist[t] * count) }))
		.sort((a, b) => b.frac - a.frac);
	for (let i = 0; i < remaining; i++) {
		const entry = counts.find(([t]) => t === fractionals[i].type);
		if (entry) entry[1]++;
	}

	// Fill the assignments array
	for (const [type, n] of counts) {
		for (let i = 0; i < n; i++) {
			assignments.push(type);
		}
	}

	// Shuffle (Fisher-Yates) so personalities are spatially mixed
	for (let i = assignments.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[assignments[i], assignments[j]] = [assignments[j], assignments[i]];
	}

	return assignments;
}

/**
 * Initialize config buffer data from a personality distribution.
 * Returns a Float32Array ready for GPU upload.
 */
export function initializeConfigBuffer(
	count: number,
	distribution?: PersonalityDistribution
): Float32Array {
	const floatsPerConfig = BYTES_PER_CONFIG / 4;
	const data = new Float32Array(count * floatsPerConfig);
	const u32View = new Uint32Array(data.buffer);
	const assignments = distributePersonalities(count, distribution);

	for (let i = 0; i < count; i++) {
		const pType = assignments[i];
		const template = PERSONALITY_TEMPLATES[pType];
		const offset = i * floatsPerConfig;

		data[offset + 0] = template.separationWeight;
		data[offset + 1] = template.alignmentWeight;
		data[offset + 2] = template.cohesionWeight;
		data[offset + 3] = template.perceptionRadius;
		data[offset + 4] = template.separationRadius;
		data[offset + 5] = template.maxSpeed;
		data[offset + 6] = template.wanderStrength;
		data[offset + 7] = template.crowdSpeedBoost;
		u32View[offset + 8] = pType;
		data[offset + 9] = 0.0; // experienceTimer
		data[offset + 10] = 0.0; // stressLevel
		data[offset + 11] = 0.0; // _padding
	}

	return data;
}
