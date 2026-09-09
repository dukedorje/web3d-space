<script lang="ts">
	let locked = $state(false);

	function toggle() {
		locked = !locked;
	}
</script>

<div class="lock-root">
	<button
		type="button"
		class="arm"
		class:on={locked}
		aria-pressed={locked}
		aria-label={locked ? 'Disengage lock' : 'Lock in'}
		onclick={toggle}
	>
		<span class="digit" data-side="off" aria-hidden="true">0</span>
		<span class="track" aria-hidden="true">
			<span class="bolt"></span>
		</span>
		<span class="digit" data-side="on" aria-hidden="true">1</span>
		<span class="tag">{locked ? 'ARM' : 'STBY'}</span>
	</button>

	{#if locked}
		<div class="banner" aria-live="assertive">
			<div class="stack">
				<p class="words">LOCKED IN</p>
				<span class="beam" aria-hidden="true"></span>
			</div>
		</div>
	{/if}
</div>

<style>
	.lock-root {
		--hot: #ff1b8d;
		--ice: #00f6ff;
		--ink: #05060c;
	}
	.arm {
		position: fixed;
		right: 1.25rem;
		bottom: 1.25rem;
		z-index: 30;
		display: grid;
		grid-template-columns: auto 1fr auto;
		grid-template-rows: auto auto;
		align-items: center;
		column-gap: 0.55rem;
		row-gap: 0.28rem;
		min-height: 44px;
		padding: 0.55rem 0.7rem 0.45rem;
		border: 1px solid color-mix(in oklab, var(--ice) 45%, #0b1a22);
		border-radius: 4px;
		background: var(--ink);
		color: var(--ice);
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}
	.arm:focus-visible {
		outline: 2px solid var(--ice);
		outline-offset: 4px;
	}
	.arm.on {
		border-color: transparent;
		color: #fff;
		background: #09030a;
		box-shadow:
			0 0 14px var(--hot),
			0 0 36px color-mix(in oklab, var(--ice) 70%, transparent);
	}

	.digit {
		grid-row: 1;
		font-family: 'Tactic Sans Extra Extended', 'Tactic Sans', sans-serif;
		font-weight: 800;
		font-size: 1.15rem;
		line-height: 1;
		letter-spacing: 0.02em;
		opacity: 0.28;
		transition: opacity 180ms cubic-bezier(0.16, 1, 0.3, 1);
	}
	.digit[data-side='off'] {
		grid-column: 1;
	}
	.digit[data-side='on'] {
		grid-column: 3;
	}
	.arm:not(.on) .digit[data-side='off'],
	.arm.on .digit[data-side='on'] {
		opacity: 1;
		text-shadow: 0 0 10px currentColor;
	}
	.arm.on .digit[data-side='on'] {
		color: var(--hot);
	}

	.track {
		grid-column: 2;
		grid-row: 1;
		position: relative;
		width: 4.6rem;
		height: 1.35rem;
		border-radius: 2px;
		background: #020308;
		overflow: hidden;
	}
	.bolt {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 1.55rem;
		height: calc(100% - 4px);
		border-radius: 1px;
		background: color-mix(in oklab, var(--ice) 70%, #fff);
		transform: translateX(0);
		transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1), background 180ms linear;
	}
	.arm.on .bolt {
		background: var(--hot);
		transform: translateX(2.85rem);
		box-shadow: 0 0 12px var(--hot);
	}

	.tag {
		grid-column: 1 / -1;
		grid-row: 2;
		justify-self: end;
		font-family: 'Tactic Sans', sans-serif;
		font-weight: 500;
		font-size: 0.62rem;
		letter-spacing: 0.28em;
		line-height: 1;
		opacity: 0.7;
	}
	.arm.on .tag {
		color: var(--hot);
		opacity: 1;
		letter-spacing: 0.34em;
	}

	.banner {
		position: fixed;
		inset: 0;
		z-index: 25;
		display: grid;
		place-items: center;
		pointer-events: none;
	}
	.words {
		margin: 0;
		font-family: 'Space Age', sans-serif;
		font-size: clamp(2.75rem, 12vw, 8rem);
		letter-spacing: 0.08em;
		line-height: 0.9;
		color: #fff4fb;
		text-align: center;
		white-space: nowrap;
		text-wrap: balance;
		text-shadow:
			-0.03em 0 var(--hot),
			0.03em 0 var(--ice),
			0 0 0.18em var(--hot),
			0 0 0.55em var(--ice),
			0 0 1.1em var(--hot);
		animation: lock-slam 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
	}
	.stack {
		display: grid;
		justify-items: center;
		gap: 0.55rem;
	}
	.beam {
		width: min(72vw, 46rem);
		height: 2px;
		background: var(--ice);
		box-shadow:
			0 0 8px var(--ice),
			0 0 24px var(--hot);
		animation: beam-in 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
		transform-origin: center;
	}

	@keyframes lock-slam {
		from {
			opacity: 0;
			transform: scale(1.12);
			filter: blur(8px);
		}
		to {
			opacity: 1;
			transform: scale(1);
			filter: blur(0);
		}
	}
	@keyframes beam-in {
		from {
			opacity: 0;
			transform: scaleX(0.18);
		}
		to {
			opacity: 0.95;
			transform: scaleX(1);
		}
	}

	@media (max-width: 640px) {
		.words {
			white-space: normal;
			padding: 0 0.75rem;
			font-size: clamp(2.1rem, 18vw, 4.2rem);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.bolt,
		.digit,
		.arm {
			transition: none;
		}
		.words,
		.beam {
			animation: none;
		}
	}
</style>
