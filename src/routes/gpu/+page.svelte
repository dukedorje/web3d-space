<script lang="ts">
	import GpuCountWidget from '$lib/components/gpu/GpuCountWidget.svelte';

	type PodRow = {
		id: string;
		name: string;
		status: string;
		desiredStatus: string;
		gpuType: string | null;
		dataCenter: string | null;
		costPerHr: number | null;
		publicIp: string | null;
		sshPort: number | null;
		http8000: string;
		http8888: string;
		owned: boolean;
		createdAt: string | null;
		lastStartedAt: string | null;
		image: string | null;
		memoryInGb: number | null;
		vcpuCount: number | null;
	};

	type CatalogGpu = {
		id: string;
		name: string;
		memoryGb: number;
		blackwell: boolean;
		securePrice: number | null;
		communityPrice: number | null;
		availability: string | null;
		beats: boolean;
		beatKind: 'fp4' | 'fp8' | 'none';
		beatReasons: string[];
		dataCenters: { id: string; availability: string }[];
	};

	let status = $state<{
		ok: boolean;
		error?: string;
		runningCount: number;
		pods: PodRow[];
		account: { email: string | null; balance: number | null; spendPerHr: number | null } | null;
		autoShutdown: { enabled: boolean; idleMinutes: number };
		defaults: { gpuType: string; dataCenter: string; image: string };
		t4000: { cudaCores: number; memoryGb: number; tdpW: number; throttleW: number };
	} | null>(null);

	let catalog = $state<{ ranked: CatalogGpu[]; dataCenters: { id: string; region?: string }[] } | null>(
		null
	);
	let selectedGpu = $state('NVIDIA RTX PRO 4500 Blackwell');
	let selectedDc = $state('EU-RO-1');
	let selectedPodId = $state<string | null>(null);
	let mutating = $state(false);
	let mutationError = $state<string | null>(null);
	let logs = $state<string[]>([]);
	let probes = $state<Record<string, unknown> | null>(null);
	let logSource = $state<'container' | 'system'>('container');
	let autoEnabled = $state(true);
	let autoMinutes = $state(30);

	const selectedPod = $derived(status?.pods.find((p) => p.id === selectedPodId) ?? status?.pods[0] ?? null);

	async function refreshStatus() {
		const res = await fetch('/api/gpu');
		const data = await res.json();
		status = data;
		if (data.ok) {
			autoEnabled = data.autoShutdown.enabled;
			autoMinutes = data.autoShutdown.idleMinutes;
			if (!selectedPodId && data.pods?.length) {
				const owned = data.pods.find((p: PodRow) => p.owned && p.status === 'running');
				selectedPodId = owned?.id ?? data.pods[0].id;
			}
		}
	}

	async function refreshCatalog() {
		const res = await fetch('/api/gpu/catalog');
		const data = await res.json();
		if (data.ok) catalog = data;
	}

	async function act(id: string, action: string) {
		mutating = true;
		mutationError = null;
		try {
			const res = await fetch(`/api/gpu/pods/${id}?action=${action}`, { method: 'POST' });
			const data = await res.json();
			if (!data.ok) mutationError = data.error ?? res.statusText;
			await refreshStatus();
		} finally {
			mutating = false;
		}
	}

	async function terminate(id: string) {
		if (!confirm(`Terminate ${id}? This deletes the pod.`)) return;
		mutating = true;
		mutationError = null;
		try {
			const res = await fetch(`/api/gpu/pods/${id}`, { method: 'DELETE' });
			const data = await res.json();
			if (!data.ok) mutationError = data.error ?? res.statusText;
			if (selectedPodId === id) selectedPodId = null;
			await refreshStatus();
		} finally {
			mutating = false;
		}
	}

	async function spinUp() {
		mutating = true;
		mutationError = null;
		try {
			const res = await fetch('/api/gpu/pods', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ gpuTypeId: selectedGpu, dataCenterId: selectedDc })
			});
			const data = await res.json();
			if (!data.ok) mutationError = data.error ?? res.statusText;
			else selectedPodId = data.pod?.id ?? null;
			await refreshStatus();
		} finally {
			mutating = false;
		}
	}

	async function saveAuto() {
		mutating = true;
		mutationError = null;
		try {
			const res = await fetch('/api/gpu/auto-shutdown', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ enabled: autoEnabled, idleMinutes: autoMinutes })
			});
			if (!res.ok) mutationError = (await res.json()).error ?? 'save failed';
		} finally {
			mutating = false;
		}
	}

	async function loadProbes(id: string) {
		const res = await fetch(`/api/gpu/pods/${id}/probes`);
		const data = await res.json();
		probes = data.ok ? data.probes : { error: data.error ?? 'unreachable' };
	}

	let logEs: EventSource | null = null;
	function attachLogs(id: string) {
		logEs?.close();
		logs = [];
		logEs = new EventSource(`/api/gpu/pods/${id}/logs?source=${logSource}&tail=150`);
		logEs.onmessage = (ev) => {
			try {
				const payload = JSON.parse(ev.data) as { line?: string; ts?: string; source?: string };
				logs = [...logs.slice(-400), `${payload.ts ?? ''} ${payload.line ?? ev.data}`];
			} catch {
				logs = [...logs.slice(-400), ev.data];
			}
		};
		logEs.onerror = () => {
			logs = [...logs, '— log stream dropped —'];
			logEs?.close();
		};
	}

	$effect(() => {
		void refreshStatus();
		void refreshCatalog();
		const t = setInterval(() => void refreshStatus(), 5000);
		return () => {
			clearInterval(t);
			logEs?.close();
		};
	});

	$effect(() => {
		if (selectedPodId) {
			void loadProbes(selectedPodId);
			attachLogs(selectedPodId);
		}
	});
</script>

<svelte:head>
	<title>GPU_OPS — All Systems Go</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Oxanium:wght@500;700&family=Share+Tech+Mono&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="ops">
	<div class="scan" aria-hidden="true"></div>
	<header class="top">
		<div>
			<h1>GPU_OPS</h1>
			<p>T4000 live-stack sim · RunPod · HEVC over Iroh</p>
		</div>
		<GpuCountWidget
			running={status?.runningCount ?? 0}
			spendPerHr={status?.account?.spendPerHr ?? null}
		/>
	</header>

	{#if mutationError}
		<div class="banner" role="alert">
			{mutationError}
			<button type="button" onclick={() => (mutationError = null)}>dismiss</button>
		</div>
	{/if}
	{#if status && !status.ok}
		<div class="banner" role="alert">{status.error}</div>
	{/if}

	<section class="grid">
		<article class="panel">
			<h2>SELECT GPU</h2>
			<p class="hint">
				Floor is Jetson T4000 — 1536 CUDA · 5th-gen FP4 tensor · 64 GB unified · 70/90 W. Ranked
				cheapest Blackwell first, then FP8 cards that still run SAM2 + DA-V2-S.
			</p>
			<label>
				SKU
				<select bind:value={selectedGpu}>
					{#if catalog}
						{#each catalog.ranked as gpu}
							<option value={gpu.id}>
								{gpu.beatKind === 'fp4' ? 'FP4' : 'FP8'} · {gpu.name} · {gpu.memoryGb}GB · ${gpu.securePrice ?? gpu.communityPrice ?? '—'}/hr · {gpu.availability}
							</option>
						{/each}
					{:else}
						<option value={selectedGpu}>{selectedGpu}</option>
					{/if}
				</select>
			</label>
			<label>
				DATACENTER
				<select bind:value={selectedDc}>
					{#if catalog}
						{#each catalog.dataCenters as dc}
							<option value={dc.id}>{dc.id}{dc.region ? ` · ${dc.region}` : ''}</option>
						{/each}
					{:else}
						<option value={selectedDc}>{selectedDc}</option>
					{/if}
				</select>
			</label>
			<div class="row">
				<button type="button" class="primary" disabled={mutating} onclick={spinUp}>SPIN UP</button>
				<button type="button" disabled={mutating} onclick={() => refreshCatalog()}>REFRESH STOCK</button>
			</div>
			{#if catalog}
				<table>
					<thead>
						<tr>
							<th>SKU</th>
							<th>KIND</th>
							<th>GB</th>
							<th>$/hr</th>
							<th>STOCK</th>
						</tr>
					</thead>
					<tbody>
						{#each catalog.ranked.slice(0, 12) as gpu}
							<tr
								class:sel={gpu.id === selectedGpu}
								onclick={() => {
									selectedGpu = gpu.id;
									const high = gpu.dataCenters.find((d) => d.availability === 'HIGH') ?? gpu.dataCenters[0];
									if (high) selectedDc = high.id;
								}}
							>
								<td>{gpu.name}</td>
								<td>{gpu.beatKind.toUpperCase()}</td>
								<td>{gpu.memoryGb}</td>
								<td>{gpu.securePrice ?? gpu.communityPrice ?? '—'}</td>
								<td>{gpu.availability}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</article>

		<article class="panel">
			<h2>POD</h2>
			{#if !selectedPod}
				<p class="hint">No pods on this account.</p>
			{:else}
				<dl>
					<dt>ID</dt>
					<dd class="mono">{selectedPod.id}</dd>
					<dt>NAME</dt>
					<dd>{selectedPod.name}</dd>
					<dt>STATE</dt>
					<dd class="state" data-state={selectedPod.status}>{selectedPod.status}</dd>
					<dt>GPU</dt>
					<dd>{selectedPod.gpuType ?? '—'}</dd>
					<dt>DC</dt>
					<dd>{selectedPod.dataCenter ?? '—'}</dd>
					<dt>RATE</dt>
					<dd>{selectedPod.costPerHr != null ? `$${selectedPod.costPerHr}/hr` : '—'}</dd>
					<dt>SSH</dt>
					<dd class="mono">
						{#if selectedPod.publicIp && selectedPod.sshPort}
							ssh root@{selectedPod.publicIp} -p {selectedPod.sshPort}
						{:else}
							—
						{/if}
					</dd>
					<dt>HTTP</dt>
					<dd>
						<a href={selectedPod.http8000} target="_blank" rel="noreferrer">:8000 sim</a>
						·
						<a href={selectedPod.http8888} target="_blank" rel="noreferrer">:8888 jupyter</a>
					</dd>
				</dl>
				<div class="row">
					<button type="button" disabled={mutating} onclick={() => act(selectedPod.id, 'start')}>START</button>
					<button type="button" disabled={mutating} onclick={() => act(selectedPod.id, 'stop')}>STOP</button>
					<button type="button" disabled={mutating} onclick={() => act(selectedPod.id, 'restart')}>RESTART</button>
					<button type="button" class="danger" disabled={mutating} onclick={() => terminate(selectedPod.id)}>TERMINATE</button>
				</div>
			{/if}

			<h2 class="mt">AUTO-OFF</h2>
			<p class="hint">Default 30 min idle. Only aicam- / owned pods. Does not touch negotiated training.</p>
			<label class="check">
				<input type="checkbox" bind:checked={autoEnabled} />
				enabled
			</label>
			<label>
				idle minutes
				<input type="number" min="5" max="120" bind:value={autoMinutes} />
			</label>
			<button type="button" disabled={mutating} onclick={saveAuto}>SAVE DEFAULTS</button>
		</article>

		<article class="panel span">
			<h2>FLEET</h2>
			{#if status?.pods?.length}
				<table>
					<thead>
						<tr>
							<th></th>
							<th>NAME</th>
							<th>STATE</th>
							<th>GPU</th>
							<th>DC</th>
							<th>$/hr</th>
						</tr>
					</thead>
					<tbody>
						{#each status.pods as pod}
							<tr class:sel={pod.id === selectedPod?.id} onclick={() => (selectedPodId = pod.id)}>
								<td>{pod.owned ? '●' : '○'}</td>
								<td>{pod.name}</td>
								<td class="state" data-state={pod.status}>{pod.status}</td>
								<td>{pod.gpuType ?? '—'}</td>
								<td>{pod.dataCenter ?? '—'}</td>
								<td>{pod.costPerHr ?? '—'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<p class="hint">Waiting on RunPod…</p>
			{/if}
		</article>

		<article class="panel">
			<h2>PROBES</h2>
			<p class="hint">
				T4000 envelope is 70 W default / 90 W throttle. This PRO 4500 floors at 150 W — we cannot
				cap to Thor. Report SM count, util, mem, encoder/decoder instead.
			</p>
			<button
				type="button"
				disabled={!selectedPod}
				onclick={() => selectedPod && loadProbes(selectedPod.id)}>PING</button
			>
			<pre>{probes ? JSON.stringify(probes, null, 2) : 'no sim worker yet — start worker on :8000'}</pre>
		</article>

		<article class="panel">
			<h2>LOGS</h2>
			<div class="row">
				<button type="button" class:primary={logSource === 'container'} onclick={() => (logSource = 'container')}
					>container</button
				>
				<button type="button" class:primary={logSource === 'system'} onclick={() => (logSource = 'system')}
					>system</button
				>
				<button
					type="button"
					disabled={!selectedPod}
					onclick={() => selectedPod && attachLogs(selectedPod.id)}>reconnect</button
				>
			</div>
			<pre class="logs">{logs.length ? logs.join('\n') : 'no log events'}</pre>
		</article>
	</section>

	<footer>
		RunPod REST v1: create / list / get / stop / start / restart / reset / terminate / patch / billing.
		v2: catalog (gpus, datacenters), SSE logs, runtime util on GET pod. GraphQL: balance.
		Idle auto-off is ours — RunPod pods have no native idle timer (that's serverless).
	</footer>
</div>

<style>
	.ops {
		min-height: 100vh;
		background: #07070e;
		color: #d7f6f4;
		font-family: 'Share Tech Mono', ui-monospace, monospace;
		position: relative;
		padding: 1.25rem 1.25rem 3rem;
	}
	.scan {
		pointer-events: none;
		position: fixed;
		inset: 0;
		background: repeating-linear-gradient(
			to bottom,
			transparent 0 2px,
			rgba(0, 0, 0, 0.12) 2px 3px
		);
		opacity: 0.35;
		z-index: 0;
	}
	.top,
	.grid,
	footer,
	.banner {
		position: relative;
		z-index: 1;
	}
	.top {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 1.5rem;
		border-bottom: 1px solid rgba(34, 232, 210, 0.25);
		padding-bottom: 1.25rem;
		margin-bottom: 1.25rem;
	}
	h1 {
		font-family: Oxanium, sans-serif;
		letter-spacing: 0.18em;
		color: #22e8d2;
		margin: 0;
		font-size: 1.8rem;
	}
	.top p {
		margin: 0.35rem 0 0;
		color: #5f8f93;
		font-size: 0.8rem;
	}
	.banner {
		border: 1px solid #c45b5b;
		color: #ffd0d0;
		padding: 0.6rem 0.8rem;
		margin-bottom: 1rem;
		display: flex;
		justify-content: space-between;
		gap: 1rem;
	}
	.grid {
		display: grid;
		gap: 1rem;
		grid-template-columns: 1fr;
	}
	@media (min-width: 960px) {
		.grid {
			grid-template-columns: 1fr 1fr;
		}
		.span {
			grid-column: 1 / -1;
		}
	}
	.panel {
		border: 1px solid rgba(34, 232, 210, 0.28);
		background: #0c0c18;
		padding: 1rem;
		box-shadow: 0 0 24px rgba(0, 200, 255, 0.05);
	}
	h2 {
		margin: 0 0 0.6rem;
		font-size: 0.72rem;
		letter-spacing: 0.28em;
		color: #22e8d2;
	}
	.mt {
		margin-top: 1.4rem;
	}
	.hint {
		color: #6a9396;
		font-size: 0.78rem;
		line-height: 1.45;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.7rem;
		letter-spacing: 0.14em;
		color: #7db8bc;
		margin: 0.6rem 0;
	}
	select,
	input[type='number'] {
		background: #07070e;
		color: #e8ffff;
		border: 1px solid #1c5c62;
		padding: 0.45rem 0.5rem;
		font: inherit;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin: 0.6rem 0;
	}
	button {
		background: transparent;
		color: #22e8d2;
		border: 1px solid #22e8d2;
		padding: 0.4rem 0.7rem;
		font: inherit;
		letter-spacing: 0.12em;
		cursor: pointer;
		min-height: 44px;
	}
	button:hover {
		background: rgba(34, 232, 210, 0.1);
	}
	button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	button.primary {
		background: #22e8d2;
		color: #061214;
	}
	button.danger {
		border-color: #c45b5b;
		color: #ffb4b4;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.78rem;
	}
	th {
		text-align: left;
		color: #4aa8b0;
		letter-spacing: 0.12em;
		border-bottom: 1px solid #14383c;
		padding: 0.3rem 0.25rem;
	}
	td {
		padding: 0.35rem 0.25rem;
		border-bottom: 1px solid #101820;
		cursor: pointer;
	}
	tr.sel td {
		color: #22e8d2;
		background: rgba(34, 232, 210, 0.06);
	}
	dl {
		display: grid;
		grid-template-columns: 5.5rem 1fr;
		gap: 0.25rem 0.6rem;
		font-size: 0.82rem;
	}
	dt {
		color: #4aa8b0;
	}
	dd {
		margin: 0;
	}
	.mono {
		font-size: 0.75rem;
		word-break: break-all;
	}
	.state[data-state='running'] {
		color: #5dffb2;
	}
	.state[data-state='stopped'] {
		color: #8a8a8a;
	}
	a {
		color: #22e8d2;
	}
	pre {
		background: #05050a;
		border: 1px solid #14383c;
		padding: 0.6rem;
		max-height: 22rem;
		overflow: auto;
		font-size: 0.72rem;
		color: #9fe7e2;
	}
	.logs {
		min-height: 12rem;
	}
	.check {
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
		letter-spacing: 0;
		font-size: 0.85rem;
	}
	footer {
		margin-top: 1.5rem;
		color: #4a6c70;
		font-size: 0.72rem;
		line-height: 1.5;
		max-width: 70rem;
	}
</style>
