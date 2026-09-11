import { skipWorldDocument } from '$lib/mesh/world';

export const ssr = false;
export const prerender = false;

export function load({ url }: { url: URL }) {
	return { skipWorld: skipWorldDocument(url.searchParams) };
}
