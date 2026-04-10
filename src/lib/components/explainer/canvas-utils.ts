/**
 * Shared Canvas 2D demo utility with IntersectionObserver-based lifecycle.
 * Each demo only animates when visible in the viewport.
 */

export interface CanvasDemoOptions {
	width?: number;
	height?: number;
	rootMargin?: string;
}

export interface CanvasDemo {
	start(): void;
	stop(): void;
	readonly isVisible: boolean;
}

/**
 * Creates a managed Canvas 2D animation loop that only runs when visible.
 *
 * Usage with Svelte 5:
 * ```ts
 * $effect(() => {
 *   const demo = createCanvasDemo(canvas, (ctx, dt) => { ... });
 *   demo.start();
 *   return () => demo.stop();
 * });
 * ```
 */
export function createCanvasDemo(
	canvas: HTMLCanvasElement,
	draw: (ctx: CanvasRenderingContext2D, dt: number) => void,
	options: CanvasDemoOptions = {}
): CanvasDemo {
	const { width = 600, height = 400, rootMargin = '100px' } = options;

	canvas.width = width;
	canvas.height = height;

	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Failed to get 2d context');

	let visible = false;
	let rafId: number | null = null;
	let lastTime = 0;
	let running = false;

	function loop(time: number) {
		if (!running || !visible) {
			rafId = null;
			return;
		}
		const dt = lastTime ? (time - lastTime) / 1000 : 1 / 60;
		lastTime = time;
		draw(ctx, Math.min(dt, 0.1));
		rafId = requestAnimationFrame(loop);
	}

	function startLoop() {
		if (rafId !== null) return;
		lastTime = 0;
		rafId = requestAnimationFrame(loop);
	}

	function stopLoop() {
		if (rafId !== null) {
			cancelAnimationFrame(rafId);
			rafId = null;
		}
	}

	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				visible = entry.isIntersecting;
				if (visible && running) {
					startLoop();
				} else {
					stopLoop();
				}
			}
		},
		{ rootMargin }
	);

	observer.observe(canvas);

	return {
		start() {
			running = true;
			if (visible) startLoop();
		},
		stop() {
			running = false;
			stopLoop();
			observer.disconnect();
		},
		get isVisible() {
			return visible;
		}
	};
}
