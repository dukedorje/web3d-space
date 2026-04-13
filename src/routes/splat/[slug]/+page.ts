import { scenes } from '$lib/splat/scenes';

export function entries() {
	return scenes.map((s) => ({ slug: s.slug }));
}
