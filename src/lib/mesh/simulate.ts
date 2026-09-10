import type { MeshDirectory, MeshMember, RadioSnapshot } from './radio.js';
import { buildTopology, type TopoGraph } from './graph.js';

/** Four-router OpenWrt fleet from lightning-mesh topology fixtures. */
export const FLEET: MeshMember[] = [
	{
		nodeId: 'wr3000s-a',
		name: 'Front Porch',
		backhaul_addr: '10.254.242.84',
		subnet: '10.42.243.0/24',
		mesh_mac: 'aa:bb:cc:d9:85:af',
		position: [6, 0.7, 8],
		isSelf: true
	},
	{
		nodeId: 'm3000-b',
		name: 'Kitchen',
		backhaul_addr: '10.254.12.214',
		subnet: '10.42.12.0/24',
		mesh_mac: 'aa:bb:cc:e7:ba:9d',
		position: [8, 0.7, -4]
	},
	{
		nodeId: 'tr3000',
		name: 'Workshop',
		backhaul_addr: '10.254.61.115',
		subnet: '10.42.61.0/24',
		mesh_mac: 'aa:bb:cc:98:fb:10',
		position: [-6, 0.7, 2]
	},
	{
		nodeId: 'm3000',
		name: 'Hill',
		backhaul_addr: '10.254.242.172',
		subnet: '10.42.242.0/24',
		mesh_mac: 'aa:bb:cc:44:21:0e',
		position: [-14, 0.7, -8]
	}
];

const CHANNEL = 36;
const FREQ = 5180;

type LinkSpec = {
	a: number;
	b: number;
	mbps: [number, number];
	dbm: [number, number];
	relayed?: boolean;
	/** Directory index that must already be visible. */
	afterMs: number;
};

const LINKS: LinkSpec[] = [
	{ a: 0, b: 1, mbps: [979, 979], dbm: [-41, -43], afterMs: 1600 },
	{ a: 1, b: 2, mbps: [552, 609], dbm: [-58, -55], afterMs: 2400 },
	{ a: 0, b: 2, mbps: [493, 724], dbm: [-62, -57], afterMs: 2400 },
	{ a: 2, b: 3, mbps: [246, 5], dbm: [-78, -91], afterMs: 4200 },
	{ a: 1, b: 3, mbps: [94, 31], dbm: [-84, -88], relayed: true, afterMs: 5000 },
	{ a: 0, b: 3, mbps: [15, 5], dbm: [-92, -95], relayed: true, afterMs: 5000 }
];

function walk(base: number, t: number, amp: number, seed: number): number {
	return base + Math.sin(t * 0.0011 + seed) * amp + Math.sin(t * 0.00037 + seed * 2) * amp * 0.35;
}

function appearMs(index: number): number {
	return 400 + index * 800;
}

function snapshot(
	member: MeshMember,
	peers: { mac: string; mbps: number; dbm: number; relayed: boolean }[],
	unix: number
): RadioSnapshot {
	return {
		version: 1,
		backhaul_addr: member.backhaul_addr,
		mesh_if: 'phy1-mesh0',
		mesh_mac: member.mesh_mac,
		channel: CHANNEL,
		freq_mhz: FREQ,
		collected_at_unix: unix,
		stations: peers.map((p) => ({
			mac: p.mac,
			signal_dbm: Math.round(p.dbm),
			expected_throughput_mbps: Math.max(1, Math.round(p.mbps)),
			inactive_ms: 40
		})),
		mpaths: peers.map((p) => ({
			dst: p.mac,
			next_hop: p.relayed ? FLEET[2]!.mesh_mac : p.mac,
			metric: p.relayed ? 1200 : 100
		}))
	};
}

export function simulateMesh(elapsedMs: number): { directory: MeshDirectory; graph: TopoGraph } {
	const visible = FLEET.filter((_, i) => elapsedMs >= appearMs(i));
	const directory: MeshDirectory = { nodes: visible };
	const unix = 1_751_234_567 + Math.floor(elapsedMs / 1000);
	const radioByKey = new Map<string, RadioSnapshot | undefined>();

	for (const member of visible) {
		const idx = FLEET.indexOf(member);
		const hillDark = idx === 3 && Math.floor(elapsedMs / 8000) % 2 === 1;
		if (hillDark) {
			radioByKey.set(member.backhaul_addr, undefined);
			continue;
		}
		const peers: { mac: string; mbps: number; dbm: number; relayed: boolean }[] = [];
		for (const link of LINKS) {
			if (elapsedMs < link.afterMs) continue;
			if (link.a !== idx && link.b !== idx) continue;
			const other = link.a === idx ? link.b : link.a;
			if (elapsedMs < appearMs(other)) continue;
			const fromA = link.a === idx;
			peers.push({
				mac: FLEET[other]!.mesh_mac,
				mbps: walk(fromA ? link.mbps[0] : link.mbps[1], elapsedMs, fromA ? 40 : 18, idx + other),
				dbm: walk(fromA ? link.dbm[0] : link.dbm[1], elapsedMs, 3, idx * 3 + other),
				relayed: Boolean(link.relayed)
			});
		}
		radioByKey.set(member.backhaul_addr, snapshot(member, peers, unix));
	}

	return { directory, graph: buildTopology(directory, radioByKey) };
}
