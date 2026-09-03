import { env } from '$env/dynamic/private';
import { beatsT4000, isBlackwellId, type CloudGpuFacts } from './t4000';

const REST_V1 = 'https://rest.runpod.io/v1';
const REST_V2 = 'https://api.runpod.io/v2';
const GRAPHQL = 'https://api.runpod.io/graphql';

/** Cloudflare 1010s the v2 catalog without a browser UA. */
const UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

export class RunpodError extends Error {
	constructor(
		public readonly status: number,
		public readonly detail: string,
		public readonly path: string
	) {
		super(`RunPod ${status} ${path}: ${detail}`);
		this.name = 'RunpodError';
	}
}

function apiKey(): string {
	const k = env.RUNPOD_API_KEY;
	if (!k) throw new RunpodError(503, 'RUNPOD_API_KEY is not set', 'env');
	return k;
}

function headers(json = true): Record<string, string> {
	const h: Record<string, string> = {
		Authorization: `Bearer ${apiKey()}`,
		'User-Agent': UA,
		Accept: 'application/json'
	};
	if (json) h['Content-Type'] = 'application/json';
	return h;
}

async function readBody(res: Response): Promise<unknown> {
	const text = await res.text();
	if (!text) return null;
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

async function v1<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${REST_V1}${path}`, {
		...init,
		headers: { ...headers(), ...(init?.headers as Record<string, string> | undefined) }
	});
	const body = await readBody(res);
	if (!res.ok) {
		throw new RunpodError(res.status, typeof body === 'string' ? body : JSON.stringify(body), path);
	}
	return body as T;
}

async function v2<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${REST_V2}${path}`, {
		...init,
		headers: { ...headers(), ...(init?.headers as Record<string, string> | undefined) }
	});
	const body = await readBody(res);
	if (!res.ok) {
		throw new RunpodError(res.status, typeof body === 'string' ? body : JSON.stringify(body), path);
	}
	return body as T;
}

export interface RunpodPod {
	id: string;
	name?: string;
	desiredStatus: string;
	imageName?: string;
	costPerHr?: number;
	gpuCount?: number;
	memoryInGb?: number;
	vcpuCount?: number;
	publicIp?: string | null;
	ports?: string[];
	portMappings?: Record<string, number> | null;
	lastStartedAt?: string;
	createdAt?: string;
	machine?: {
		dataCenterId?: string;
		gpuTypeId?: string;
		location?: string;
		secureCloud?: boolean;
	};
	machineId?: string;
	env?: Record<string, string>;
	interruptible?: boolean;
	volumeInGb?: number;
	containerDiskInGb?: number;
}

export interface GpuCatalogEntry extends CloudGpuFacts {
	community: boolean;
	secure: boolean;
	maxCount?: { community?: number; secure?: number };
	dataCenters: { id: string; availability: string }[];
	beatKind: ReturnType<typeof beatsT4000>['kind'];
	beatReasons: string[];
	beats: boolean;
}

export interface DataCenterEntry {
	id: string;
	name: string;
	region?: string;
	globalNetwork?: boolean;
	gpuAvailability: { id: string; name?: string; availability: string }[];
}

export interface AccountSnapshot {
	email: string | null;
	balance: number | null;
	spendLimit: number | null;
	spendPerHr: number | null;
}

export function proxyUrl(podId: string, port: number): string {
	return `https://${podId}-${port}.proxy.runpod.net`;
}

export function mapStatus(desired: string): 'running' | 'stopped' | 'terminated' | 'other' {
	if (desired === 'RUNNING') return 'running';
	if (desired === 'EXITED') return 'stopped';
	if (desired === 'TERMINATED') return 'terminated';
	return 'other';
}

export async function listPods(): Promise<RunpodPod[]> {
	const pods = await v1<RunpodPod[]>('/pods');
	return Array.isArray(pods) ? pods : [];
}

/** v2 carries gpu.id + dataCenterId; v1 list often returns machine: {}. */
export async function enrichPods(pods: RunpodPod[]): Promise<RunpodPod[]> {
	try {
		const listed = await v2<{
			pods?: Array<{
				id: string;
				gpu?: { id?: string };
				dataCenterId?: string | null;
			}>;
		}>('/pods');
		const byId = new Map((listed.pods ?? []).map((p) => [p.id, p]));
		return pods.map((p) => {
			const extra = byId.get(p.id);
			if (!extra) return p;
			return {
				...p,
				machine: {
					...p.machine,
					gpuTypeId: p.machine?.gpuTypeId ?? extra.gpu?.id,
					dataCenterId: p.machine?.dataCenterId ?? extra.dataCenterId ?? undefined
				}
			};
		});
	} catch {
		return pods;
	}
}

export async function getPod(id: string): Promise<RunpodPod> {
	return v1<RunpodPod>(`/pods/${id}`);
}

export async function createPod(input: {
	name: string;
	gpuTypeId: string;
	imageName?: string;
	dataCenterId?: string;
	cloudType?: 'SECURE' | 'COMMUNITY';
	gpuCount?: number;
	containerDiskInGb?: number;
	volumeInGb?: number;
	ports?: string[];
	env?: Record<string, string>;
}): Promise<RunpodPod> {
	const ssh = env.GPU_SSH_PUBLIC_KEY;
	const payload: Record<string, unknown> = {
		name: input.name,
		imageName: input.imageName ?? env.GPU_DEFAULT_IMAGE ?? 'runpod/pytorch:1.0.2-cu1281-torch280-ubuntu2404',
		gpuTypeIds: [input.gpuTypeId],
		gpuCount: input.gpuCount ?? 1,
		gpuTypePriority: 'custom',
		cloudType: input.cloudType ?? 'SECURE',
		containerDiskInGb: input.containerDiskInGb ?? 50,
		volumeInGb: input.volumeInGb ?? 40,
		volumeMountPath: '/workspace',
		ports: input.ports ?? ['8000/http', '8888/http', '22/tcp'],
		env: {
			AICAM_ROLE: 't4000-sim',
			...(ssh ? { PUBLIC_KEY: ssh } : {}),
			...input.env
		},
		supportPublicIp: true
	};
	if (input.dataCenterId) {
		payload.dataCenterIds = [input.dataCenterId];
		payload.dataCenterPriority = 'custom';
	}
	return v1<RunpodPod>('/pods', { method: 'POST', body: JSON.stringify(payload) });
}

export async function stopPod(id: string): Promise<unknown> {
	return v1(`/pods/${id}/stop`, { method: 'POST' });
}

export async function startPod(id: string): Promise<unknown> {
	return v1(`/pods/${id}/start`, { method: 'POST' });
}

export async function restartPod(id: string): Promise<unknown> {
	return v1(`/pods/${id}/restart`, { method: 'POST' });
}

export async function resetPod(id: string): Promise<unknown> {
	return v1(`/pods/${id}/reset`, { method: 'POST' });
}

export async function terminatePod(id: string): Promise<void> {
	await v1(`/pods/${id}`, { method: 'DELETE' });
}

export async function updatePod(
	id: string,
	patch: Record<string, unknown>
): Promise<RunpodPod> {
	return v1<RunpodPod>(`/pods/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export async function listCatalogGpus(): Promise<GpuCatalogEntry[]> {
	const data = await v2<{ gpus: Array<Record<string, unknown>> }>(
		'/catalog/gpus?include=AVAILABILITY&product=POD'
	);
	return (data.gpus ?? []).map((g) => {
		const id = String(g.id ?? '');
		const price = (g.price ?? {}) as { secure?: number; community?: number };
		const facts: CloudGpuFacts = {
			id,
			name: String(g.name ?? id),
			memoryGb: Number(g.memory ?? 0),
			blackwell: isBlackwellId(id),
			securePrice: price.secure ?? null,
			communityPrice: price.community ?? null,
			availability: (g.availability as string) ?? null
		};
		const beat = beatsT4000(facts);
		return {
			...facts,
			community: Boolean(g.community),
			secure: Boolean(g.secure),
			maxCount: g.maxCount as GpuCatalogEntry['maxCount'],
			dataCenters: Array.isArray(g.dataCenters)
				? (g.dataCenters as { id: string; availability: string }[])
				: [],
			beatKind: beat.kind,
			beatReasons: beat.reasons,
			beats: beat.beats
		};
	});
}

export async function listDataCenters(): Promise<DataCenterEntry[]> {
	const data = await v2<{ dataCenters: DataCenterEntry[] }>(
		'/catalog/datacenters?include=GPU_AVAILABILITY'
	);
	return data.dataCenters ?? [];
}

export async function accountSnapshot(): Promise<AccountSnapshot> {
	const res = await fetch(GRAPHQL, {
		method: 'POST',
		headers: headers(),
		body: JSON.stringify({
			query: 'query { myself { email clientBalance spendLimit currentSpendPerHr } }'
		})
	});
	const body = (await res.json()) as {
		data?: {
			myself?: {
				email?: string;
				clientBalance?: number;
				spendLimit?: number;
				currentSpendPerHr?: number;
			};
		};
	};
	const me = body.data?.myself;
	return {
		email: me?.email ?? null,
		balance: me?.clientBalance ?? null,
		spendLimit: me?.spendLimit ?? null,
		spendPerHr: me?.currentSpendPerHr ?? null
	};
}

export async function podLogsResponse(id: string, source?: 'container' | 'system', tail = 200): Promise<Response> {
	const params = new URLSearchParams({ tail: String(tail) });
	if (source) params.set('source', source);
	const res = await fetch(`${REST_V2}/pods/${id}/logs?${params}`, {
		headers: {
			Authorization: `Bearer ${apiKey()}`,
			'User-Agent': UA,
			Accept: 'text/event-stream'
		}
	});
	if (!res.ok) {
		const detail = await res.text();
		throw new RunpodError(res.status, detail, `/v2/pods/${id}/logs`);
	}
	return res;
}

export function defaults() {
	return {
		gpuType: env.GPU_DEFAULT_TYPE ?? 'NVIDIA RTX PRO 4500 Blackwell',
		dataCenter: env.GPU_DEFAULT_DATACENTER ?? 'EU-RO-1',
		image: env.GPU_DEFAULT_IMAGE ?? 'runpod/pytorch:1.0.2-cu1281-torch280-ubuntu2404',
		prefix: env.GPU_POD_PREFIX ?? 'aicam-',
		autoOff: env.GPU_AUTO_OFF !== 'false',
		autoOffMinutes: Number(env.GPU_AUTO_OFF_MINUTES ?? 30)
	};
}
