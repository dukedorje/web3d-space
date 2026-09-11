import type { PlayCanvasApp } from '$lib/playcanvas/create-app.js';
import type { CoverageGrid } from './coverage.js';
import { edgeStrength, type TopoEdge, type TopoGraph, type TopoNode } from './graph.js';

type Pc = typeof import('playcanvas');
type Entity = import('playcanvas').Entity;
type StandardMaterial = import('playcanvas').StandardMaterial;

const STRONG = [0.13, 0.88, 0.89] as const;
const RELAY = [0.96, 0.75, 0.31] as const;
const WEAK = [0.45, 0.5, 0.62] as const;
const SELF = [0.96, 0.75, 0.31] as const;
/** Ground tiles — not link cyan/gold/grey. */
const COVERED = [0.91, 0.2, 0.62] as const;
const THIN = [0.42, 0.1, 0.32] as const;

function rgb(pc: Pc, c: readonly [number, number, number], a = 1) {
	return new pc.Color(c[0], c[1], c[2], a);
}

function mat(pc: Pc, color: readonly [number, number, number], emissive = 0.35): StandardMaterial {
	const m = new pc.StandardMaterial();
	m.diffuse = rgb(pc, color);
	m.emissive = rgb(pc, color);
	m.emissiveIntensity = emissive;
	m.useLighting = true;
	m.update();
	return m;
}

function placeLink(entity: Entity, a: [number, number, number], b: [number, number, number]) {
	const dx = b[0] - a[0];
	const dy = b[1] - a[1];
	const dz = b[2] - a[2];
	const len = Math.hypot(dx, dy, dz) || 0.01;
	entity.setLocalPosition((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.15, (a[2] + b[2]) / 2);
	entity.setLocalScale(0.08, len / 2, 0.08);
	entity.lookAt(b[0], b[1] + 0.15, b[2]);
	entity.rotateLocal(90, 0, 0);
}

export type MeshScene = {
	sync: (graph: TopoGraph, coverage?: CoverageGrid) => void;
	destroy: () => void;
};

export function mountMeshScene(pcApp: PlayCanvasApp): MeshScene {
	const { pc, app } = pcApp;
	const root = new pc.Entity('mesh-root');
	app.root.addChild(root);

	const groundMat = mat(pc, [0.05, 0.06, 0.1], 0.02);
	const ground = new pc.Entity('ground');
	ground.addComponent('render', { type: 'plane', material: groundMat });
	ground.setLocalScale(48, 1, 48);
	root.addChild(ground);

	const key = new pc.Entity('key');
	key.addComponent('light', {
		type: 'directional',
		color: rgb(pc, [1, 0.92, 0.82]),
		intensity: 0.7
	});
	key.setEulerAngles(50, 30, 0);
	root.addChild(key);

	const fill = new pc.Entity('fill');
	fill.addComponent('light', {
		type: 'directional',
		color: rgb(pc, [0.4, 0.7, 0.9]),
		intensity: 0.25
	});
	fill.setEulerAngles(20, -120, 0);
	root.addChild(fill);

	const nodeEnt = new Map<string, Entity>();
	const linkEnt = new Map<string, Entity>();
	const cellEnt = new Map<string, Entity>();
	const mats = {
		strong: mat(pc, STRONG, 0.8),
		relay: mat(pc, RELAY, 0.55),
		weak: mat(pc, WEAK, 0.25),
		self: mat(pc, SELF, 1.1),
		node: mat(pc, STRONG, 0.45),
		dark: mat(pc, [0.18, 0.2, 0.26], 0.08),
		covered: mat(pc, COVERED, 0.85),
		thin: mat(pc, THIN, 0.35)
	};

	function ensureNode(node: TopoNode): Entity {
		let e = nodeEnt.get(node.key);
		if (!e) {
			e = new pc.Entity(`node-${node.key}`);
			e.addComponent('render', { type: 'box', material: mats.node });
			const lamp = new pc.Entity('lamp');
			lamp.addComponent('light', {
				type: 'omni',
				color: rgb(pc, node.isSelf ? SELF : STRONG),
				intensity: 0.6,
				range: 6
			});
			lamp.setLocalPosition(0, 1.2, 0);
			e.addChild(lamp);
			root.addChild(e);
			nodeEnt.set(node.key, e);
		}
		e.setLocalPosition(...node.position);
		e.setLocalScale(node.isSelf ? 1.15 : 0.9, node.radio ? 1.4 : 0.6, node.isSelf ? 1.15 : 0.9);
		const render = e.render;
		if (render) render.material = node.radio ? (node.isSelf ? mats.self : mats.node) : mats.dark;
		return e;
	}

	function ensureLink(edge: TopoEdge, graph: TopoGraph): Entity {
		const k = `${edge.a}|${edge.b}`;
		let e = linkEnt.get(k);
		if (!e) {
			e = new pc.Entity(`link-${k}`);
			e.addComponent('render', { type: 'cylinder', material: mats.weak });
			root.addChild(e);
			linkEnt.set(k, e);
		}
		const a = graph.nodes.find((n) => n.key === edge.a);
		const b = graph.nodes.find((n) => n.key === edge.b);
		if (a && b) placeLink(e, a.position, b.position);
		const render = e.render;
		if (render) render.material = mats[edgeStrength(edge)];
		e.enabled = true;
		return e;
	}

	function ensureCell(
		grid: CoverageGrid,
		key: string,
		x: number,
		z: number,
		covered: boolean
	): Entity {
		let e = cellEnt.get(key);
		if (!e) {
			e = new pc.Entity(`cov-${key}`);
			e.addComponent('render', { type: 'box', material: covered ? mats.covered : mats.thin });
			root.addChild(e);
			cellEnt.set(key, e);
		}
		const span = grid.cellSize * 0.88;
		e.setLocalPosition(x, 0.04, z);
		e.setLocalScale(span, 0.05, span);
		const render = e.render;
		if (render) render.material = covered ? mats.covered : mats.thin;
		e.enabled = true;
		return e;
	}

	return {
		sync(graph, coverage) {
			const liveNodes = new Set(graph.nodes.map((n) => n.key));
			for (const node of graph.nodes) ensureNode(node);
			for (const [key, e] of nodeEnt) {
				if (!liveNodes.has(key)) e.enabled = false;
				else e.enabled = true;
			}

			const liveLinks = new Set(graph.edges.map((e) => `${e.a}|${e.b}`));
			for (const edge of graph.edges) ensureLink(edge, graph);
			for (const [key, e] of linkEnt) {
				e.enabled = liveLinks.has(key);
			}

			const liveCells = new Set<string>();
			if (coverage) {
				for (const cell of coverage.cells) {
					if (cell.state === 'unknown') continue;
					const k = `${coverage.originX}:${coverage.originZ}:${cell.ix}:${cell.iz}`;
					liveCells.add(k);
					ensureCell(coverage, k, cell.x, cell.z, cell.state === 'covered');
				}
			}
			for (const [key, e] of cellEnt) {
				e.enabled = liveCells.has(key);
			}
		},
		destroy() {
			root.destroy();
		}
	};
}
