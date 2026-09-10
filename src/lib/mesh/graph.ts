import type { MeshDirectory, RadioSnapshot } from './radio.js';

export interface TopoNode {
	key: string;
	label: string;
	name?: string;
	nodeId: string;
	subnet: string;
	isSelf: boolean;
	position: [number, number, number];
	radio?: RadioSnapshot;
}

export interface TopoEdgeDirection {
	throughputMbps: number;
	signalDbm: number;
	relayed: boolean;
}

export interface TopoEdge {
	a: string;
	b: string;
	aToB?: TopoEdgeDirection;
	bToA?: TopoEdgeDirection;
}

export interface TopoGraph {
	nodes: TopoNode[];
	edges: TopoEdge[];
}

export type EdgeStrength = 'strong' | 'relay' | 'weak';

const STRONG_MBPS = 300;
const WEAK_MBPS = 100;

function shortLabel(nodeId: string, subnet: string): string {
	const octets = subnet.split('.');
	if (octets.length >= 3 && octets[2]) return octets[2];
	return nodeId.length > 8 ? nodeId.slice(0, 8) : nodeId;
}

function pairKey(a: string, b: string): string {
	return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function edgeStrength(edge: TopoEdge): EdgeStrength {
	const dirs = [edge.aToB, edge.bToA].filter((d): d is TopoEdgeDirection => !!d);
	if (dirs.length === 0) return 'weak';
	if (dirs.every((d) => d.relayed)) return 'weak';
	const maxMbps = Math.max(...dirs.map((d) => d.throughputMbps));
	if (maxMbps >= STRONG_MBPS) return 'strong';
	if (maxMbps < WEAK_MBPS) return 'weak';
	return 'relay';
}

export function buildTopology(
	directory: MeshDirectory,
	radioByKey: Map<string, RadioSnapshot | undefined>
): TopoGraph {
	const nodes: TopoNode[] = directory.nodes.map((n) => ({
		key: n.backhaul_addr,
		label: shortLabel(n.nodeId, n.subnet),
		name: n.name,
		nodeId: n.nodeId,
		subnet: n.subnet,
		isSelf: Boolean(n.isSelf),
		position: n.position,
		radio: radioByKey.get(n.backhaul_addr)
	}));

	const byMac = new Map(nodes.map((n) => [n.radio?.mesh_mac ?? '', n]));
	byMac.delete('');

	const edges = new Map<string, TopoEdge>();

	function touch(from: TopoNode, to: TopoNode, dir: TopoEdgeDirection) {
		const k = pairKey(from.key, to.key);
		const existing = edges.get(k) ?? { a: from.key < to.key ? from.key : to.key, b: from.key < to.key ? to.key : from.key };
		if (from.key === existing.a) existing.aToB = dir;
		else existing.bToA = dir;
		edges.set(k, existing);
	}

	for (const node of nodes) {
		const radio = node.radio;
		if (!radio) continue;
		const mpathByDst = new Map(radio.mpaths.map((m) => [m.dst, m]));
		for (const sta of radio.stations) {
			const peer = byMac.get(sta.mac);
			if (!peer || peer.key === node.key) continue;
			const path = mpathByDst.get(sta.mac);
			const relayed = Boolean(path && path.next_hop !== sta.mac);
			touch(node, peer, {
				throughputMbps: sta.expected_throughput_mbps,
				signalDbm: sta.signal_dbm,
				relayed
			});
		}
	}

	return { nodes, edges: [...edges.values()] };
}
