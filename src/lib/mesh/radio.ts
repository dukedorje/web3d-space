/** Lightning Mesh `GET /api/radio` schema v1. Field names are the wire contract. */

export interface RadioStation {
	mac: string;
	signal_dbm: number;
	expected_throughput_mbps: number;
	inactive_ms: number;
}

export interface RadioMpath {
	dst: string;
	next_hop: string;
	metric: number;
}

export interface RadioSnapshot {
	version: number;
	backhaul_addr: string;
	mesh_if: string;
	mesh_mac: string;
	channel: number;
	freq_mhz: number;
	collected_at_unix: number;
	stations: RadioStation[];
	mpaths: RadioMpath[];
}

export interface MeshMember {
	nodeId: string;
	name?: string;
	backhaul_addr: string;
	subnet: string;
	mesh_mac: string;
	/** Layout in the simulated world, metres. */
	position: [number, number, number];
	isSelf?: boolean;
}

export interface MeshDirectory {
	nodes: MeshMember[];
}
