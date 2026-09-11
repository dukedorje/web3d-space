import { FLEET } from './simulate.js';

/**
 * RSSI bands (dBm), stronger = less negative:
 *   >= COVERED_DBM → covered
 *   [THIN_DBM, COVERED_DBM) → thin
 *   else (silence, missing, or weaker) → unknown
 */
export const COVERED_DBM = -70;
export const THIN_DBM = -85;
export const CELL_SIZE_M = 4;

export type CellState = 'unknown' | 'thin' | 'covered';

export type CoverageSample = {
	/** Local metres, same frame as simulate.ts positions [x, y, z]. */
	x?: number;
	z?: number;
	lat?: number;
	lon?: number;
	heading: number;
	rssi_dbm?: number;
	t: number;
	nodeId?: string;
	ssid?: string;
};

export type CoverageCell = {
	ix: number;
	iz: number;
	x: number;
	z: number;
	state: CellState;
};

export type CoverageGrid = {
	cells: CoverageCell[];
	cellSize: number;
	originX: number;
	originZ: number;
	cols: number;
	rows: number;
	covered: number;
	thin: number;
	unknown: number;
	/** covered / cells in the fleet AABB (padded). */
	completeness: number;
};

const PAD_M = CELL_SIZE_M;

function fleetOrigin(cellSize: number): {
	originX: number;
	originZ: number;
	cols: number;
	rows: number;
} {
	const xs = FLEET.map((n) => n.position[0]);
	const zs = FLEET.map((n) => n.position[2]);
	const originX = Math.min(...xs) - PAD_M;
	const originZ = Math.min(...zs) - PAD_M;
	const maxX = Math.max(...xs) + PAD_M;
	const maxZ = Math.max(...zs) + PAD_M;
	return {
		originX,
		originZ,
		cols: Math.max(1, Math.ceil((maxX - originX) / cellSize)),
		rows: Math.max(1, Math.ceil((maxZ - originZ) / cellSize))
	};
}

export function classifyRssi(rssiDbm: number | undefined): CellState {
	if (rssiDbm === undefined || !Number.isFinite(rssiDbm)) return 'unknown';
	if (rssiDbm >= COVERED_DBM) return 'covered';
	if (rssiDbm >= THIN_DBM) return 'thin';
	return 'unknown';
}

function rank(state: CellState): number {
	if (state === 'covered') return 2;
	if (state === 'thin') return 1;
	return 0;
}

function sampleXz(sample: CoverageSample): { x: number; z: number } | null {
	if (typeof sample.x === 'number' && typeof sample.z === 'number') {
		return { x: sample.x, z: sample.z };
	}
	return null;
}

export function cellAt(grid: CoverageGrid, x: number, z: number): CoverageCell | undefined {
	const ix = Math.floor((x - grid.originX) / grid.cellSize);
	const iz = Math.floor((z - grid.originZ) / grid.cellSize);
	return grid.cells.find((c) => c.ix === ix && c.iz === iz);
}

export function samplesUntil(samples: CoverageSample[], elapsedMs: number): CoverageSample[] {
	return samples.filter((s) => s.t <= elapsedMs);
}

export function paintGrid(samples: CoverageSample[], opts?: { cellSize?: number }): CoverageGrid {
	const cellSize = opts?.cellSize ?? CELL_SIZE_M;
	const { originX, originZ, cols, rows } = fleetOrigin(cellSize);
	const best = new Map<string, CellState>();

	for (const sample of samples) {
		const p = sampleXz(sample);
		if (!p) continue;
		const ix = Math.floor((p.x - originX) / cellSize);
		const iz = Math.floor((p.z - originZ) / cellSize);
		if (ix < 0 || iz < 0 || ix >= cols || iz >= rows) continue;
		const key = `${ix},${iz}`;
		const next = classifyRssi(sample.rssi_dbm);
		const prev = best.get(key) ?? 'unknown';
		if (rank(next) > rank(prev)) best.set(key, next);
	}

	const cells: CoverageCell[] = [];
	let covered = 0;
	let thin = 0;
	let unknown = 0;
	for (let ix = 0; ix < cols; ix++) {
		for (let iz = 0; iz < rows; iz++) {
			const state = best.get(`${ix},${iz}`) ?? 'unknown';
			if (state === 'covered') covered += 1;
			else if (state === 'thin') thin += 1;
			else unknown += 1;
			cells.push({
				ix,
				iz,
				state,
				x: originX + (ix + 0.5) * cellSize,
				z: originZ + (iz + 0.5) * cellSize
			});
		}
	}

	const total = cells.length || 1;
	return {
		cells,
		cellSize,
		originX,
		originZ,
		cols,
		rows,
		covered,
		thin,
		unknown,
		completeness: covered / total
	};
}

/** Recorded walk on the four-router fixture. Strong at Porch/Kitchen; Hill corner silent. */
export const FIXTURE_WALK: CoverageSample[] = [
	{
		x: 6,
		z: 8,
		heading: 180,
		rssi_dbm: -41,
		t: 800,
		nodeId: 'wr3000s-a',
		ssid: 'Lightning Mesh'
	},
	{ x: 6.4, z: 7.4, heading: 175, rssi_dbm: -48, t: 1400, nodeId: 'wr3000s-a' },
	{ x: 5.6, z: 8.3, heading: 190, rssi_dbm: -52, t: 2000, nodeId: 'wr3000s-a' },
	{
		x: 8,
		z: -4,
		heading: 90,
		rssi_dbm: -43,
		t: 3200,
		nodeId: 'm3000-b',
		ssid: 'Lightning Mesh'
	},
	{ x: 7.6, z: -3.5, heading: 95, rssi_dbm: -55, t: 3800, nodeId: 'm3000-b' },
	{ x: 8.4, z: -4.4, heading: 85, rssi_dbm: -61, t: 4400, nodeId: 'm3000-b' },
	{ x: -6, z: 2, heading: 270, rssi_dbm: -78, t: 5200, nodeId: 'tr3000' },
	{ x: -16, z: -10, heading: 225, rssi_dbm: -97, t: 6400 }
];
