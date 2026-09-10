import { describe, expect, it } from 'vitest';
import { edgeStrength } from './graph.js';
import { simulateMesh } from './simulate.js';

describe('simulateMesh', () => {
	it('starts empty', () => {
		const { directory, graph } = simulateMesh(0);
		expect(directory.nodes).toHaveLength(0);
		expect(graph.nodes).toHaveLength(0);
		expect(graph.edges).toHaveLength(0);
	});

	it('gossips the porch first', () => {
		const { graph } = simulateMesh(500);
		expect(graph.nodes.map((n) => n.name)).toEqual(['Front Porch']);
		expect(graph.nodes[0]?.radio?.channel).toBe(36);
		expect(graph.edges).toHaveLength(0);
	});

	it('builds the four-node fleet then radio links', () => {
		const early = simulateMesh(3000);
		expect(early.graph.nodes).toHaveLength(4);
		expect(early.graph.nodes.find((n) => n.name === 'Hill')?.radio).toBeDefined();

		const linked = simulateMesh(6000);
		expect(linked.graph.edges.length).toBeGreaterThanOrEqual(4);
		const porchKitchen = linked.graph.edges.find(
			(e) =>
				(e.a === '10.254.242.84' && e.b === '10.254.12.214') ||
				(e.b === '10.254.242.84' && e.a === '10.254.12.214')
		);
		expect(porchKitchen).toBeDefined();
		expect(edgeStrength(porchKitchen!)).toBe('strong');

		const relayed = linked.graph.edges.find((e) => e.aToB?.relayed || e.bToA?.relayed);
		expect(relayed).toBeDefined();
		expect(edgeStrength(relayed!)).toBe('weak');
	});

	it('drops Hill telemetry on the odd 8s window', () => {
		const dark = simulateMesh(8000 + 100);
		expect(dark.graph.nodes.find((n) => n.name === 'Hill')?.radio).toBeUndefined();
	});
});
