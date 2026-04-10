<script module lang="ts">
	import type { Highlighter } from 'shiki';

	async function loadShiki(): Promise<Highlighter> {
		const shiki = await import('shiki');
		return shiki.createHighlighter({
			langs: ['wgsl', 'typescript'],
			themes: ['github-dark']
		});
	}

	// Module-level Shiki highlighter promise (shared across all CodeBlock instances)
	const highlighterPromise: Promise<Highlighter> = loadShiki();

	// Call this from a route page's onMount with requestIdleCallback to pre-warm Shiki
	export function preWarmShiki() {
		if (typeof requestIdleCallback !== 'undefined') {
			requestIdleCallback(() => { highlighterPromise; });
		}
	}
</script>

<script lang="ts">
	interface Props {
		code: string;
		lang: 'wgsl' | 'typescript';
		title?: string;
	}

	let { code, lang, title }: Props = $props();

	let highlightedHtml = $state<string | null>(null);

	$effect(() => {
		let cancelled = false;
		highlighterPromise.then((highlighter) => {
			if (cancelled) return;
			highlightedHtml = highlighter.codeToHtml(code, {
				lang,
				theme: 'github-dark'
			});
		});
		return () => {
			cancelled = true;
		};
	});
</script>

{#if title}
	<div class="mb-2 text-sm font-mono text-gray-400">{title}</div>
{/if}

{#if highlightedHtml}
	<div class="code-block overflow-x-auto rounded-lg text-sm">
		{@html highlightedHtml}
	</div>
{:else}
	<pre class="rounded-lg bg-[#24292e] p-4 overflow-x-auto text-sm"><code class="font-mono text-gray-300">{code}</code></pre>
{/if}

<style>
	.code-block :global(pre) {
		padding: 1rem;
		margin: 0;
		overflow-x: auto;
	}
</style>
