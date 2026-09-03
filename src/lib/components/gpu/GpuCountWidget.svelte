<script lang="ts">
	let {
		running = 0,
		spendPerHr = null,
		label = 'GPUS ONLINE'
	}: {
		running?: number;
		spendPerHr?: number | null;
		label?: string;
	} = $props();

	const padded = $derived(String(running).padStart(2, '0'));
</script>

<div class="gpu-widget" data-testid="gpu-count-widget">
	<div class="gpu-widget__dots" aria-hidden="true">
		{#each Array.from({ length: Math.max(running, 1) }) as _, i}
			<span class="gpu-widget__dot" class:on={i < running}></span>
		{/each}
	</div>
	<div>
		<div class="gpu-widget__label">{label}</div>
		<div class="gpu-widget__count">{padded}</div>
	</div>
	{#if spendPerHr != null}
		<div class="gpu-widget__rate">
			<span class="gpu-widget__label">BURN</span>
			<div class="gpu-widget__count gpu-widget__count--sm">${spendPerHr.toFixed(2)}/hr</div>
		</div>
	{/if}
</div>

<style>
	.gpu-widget {
		display: flex;
		align-items: flex-end;
		gap: 1.25rem;
		font-family: 'Share Tech Mono', ui-monospace, monospace;
	}
	.gpu-widget__dots {
		display: flex;
		gap: 0.35rem;
		padding-bottom: 0.45rem;
	}
	.gpu-widget__dot {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 999px;
		background: #1a3a40;
		box-shadow: inset 0 0 0 1px #0e4a52;
	}
	.gpu-widget__dot.on {
		background: #22e8d2;
		box-shadow:
			0 0 10px #22e8d2,
			0 0 22px rgba(34, 232, 210, 0.45);
		animation: pulse 1.8s ease-in-out infinite;
	}
	.gpu-widget__label {
		font-size: 0.65rem;
		letter-spacing: 0.28em;
		color: #4aa8b0;
	}
	.gpu-widget__count {
		font-family: Oxanium, 'Share Tech Mono', monospace;
		font-size: 3rem;
		line-height: 0.9;
		font-weight: 700;
		color: #e8ffff;
		text-shadow: 0 0 18px rgba(34, 232, 210, 0.35);
	}
	.gpu-widget__count--sm {
		font-size: 1.4rem;
	}
	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.45;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.gpu-widget__dot.on {
			animation: none;
		}
	}
</style>
