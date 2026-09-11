import { describe, expect, it } from 'vitest';
import {
	cellAt,
	classifyRssi,
	FIXTURE_WALK,
	paintGrid,
	samplesUntil,
	type CellState
} from './coverage.js';

const LINK_TOKENS = new Set(['strong', 'relay', 'weak']);

describe('coverage RSSI bands', () => {
	it('marks covered / thin / unknown at the documented thresholds', () => {
		expect(classifyRssi(-70)).toBe('covered');
		expect(classifyRssi(-69)).toBe('covered');
		expect(classifyRssi(-85)).toBe('thin');
		expect(classifyRssi(-84)).toBe('thin');
		expect(classifyRssi(-71)).toBe('thin');
		expect(classifyRssi(-86)).toBe('unknown');
		expect(classifyRssi(-97)).toBe('unknown');
		expect(classifyRssi(undefined)).toBe('unknown');
	});
});

describe('paintGrid', () => {
	it('leaves every cell unknown when samples are empty', () => {
		const grid = paintGrid([]);
		expect(grid.cells.length).toBeGreaterThan(0);
		expect(grid.cells.every((c) => c.state === 'unknown')).toBe(true);
		expect(grid.covered).toBe(0);
		expect(grid.completeness).toBe(0);
	});

	it('keeps silence unknown', () => {
		const grid = paintGrid([
			{ x: 6, z: 8, heading: 0, rssi_dbm: -96, t: 0 },
			{ x: 8, z: -4, heading: 0, t: 1 },
			{ x: -16, z: -10, heading: 0, rssi_dbm: -90, t: 2 }
		]);
		expect(cellAt(grid, 6, 8)?.state).toBe('unknown');
		expect(cellAt(grid, 8, -4)?.state).toBe('unknown');
		expect(cellAt(grid, -16, -10)?.state).toBe('unknown');
		expect(grid.covered).toBe(0);
		expect(grid.completeness).toBe(0);
	});

	it('paints a strong fixture walk covered at Porch and Kitchen; Hill corner stays unknown', () => {
		const grid = paintGrid(FIXTURE_WALK);
		expect(cellAt(grid, 6, 8)?.state).toBe('covered');
		expect(cellAt(grid, 8, -4)?.state).toBe('covered');
		expect(cellAt(grid, -6, 2)?.state).toBe('thin');
		expect(cellAt(grid, -16, -10)?.state).toBe('unknown');
		expect(grid.completeness).toBeGreaterThan(0);
		expect(grid.completeness).toBeLessThan(1);
	});

	it('does not reuse edgeStrength tokens for cell state', () => {
		const grid = paintGrid(FIXTURE_WALK);
		const states = new Set(grid.cells.map((c) => c.state));
		expect(states.has('covered')).toBe(true);
		expect(states.has('unknown')).toBe(true);
		for (const state of states) {
			expect(LINK_TOKENS.has(state)).toBe(false);
		}
		const cellStates: CellState[] = ['unknown', 'thin', 'covered'];
		expect(cellStates.some((s) => LINK_TOKENS.has(s))).toBe(false);
	});
});

describe('samplesUntil', () => {
	it('replays the fixture walk in time order', () => {
		expect(samplesUntil(FIXTURE_WALK, 0)).toEqual([]);
		const early = paintGrid(samplesUntil(FIXTURE_WALK, 2000));
		expect(cellAt(early, 6, 8)?.state).toBe('covered');
		expect(cellAt(early, 8, -4)?.state).toBe('unknown');
		const later = paintGrid(samplesUntil(FIXTURE_WALK, 6400));
		expect(cellAt(later, 8, -4)?.state).toBe('covered');
		expect(cellAt(later, -16, -10)?.state).toBe('unknown');
	});
});
