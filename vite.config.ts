/// <reference types="vitest/config" />
import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import type { Plugin } from 'vite';
const dirname =
	typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

/** Print world/splat/font fetches and any 4xx/5xx to the Vite terminal. */
function httpAssetLog(): Plugin {
	return {
		name: 'http-asset-log',
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				const started = Date.now();
				res.on('finish', () => {
					const pathname = (req.url ?? '').split('?')[0];
					const interesting =
						res.statusCode >= 400 ||
						pathname.startsWith('/worlds/') ||
						pathname.startsWith('/splats/') ||
						pathname.startsWith('/fonts/') ||
						pathname.startsWith('/scenes/');
					if (!interesting) return;
					const len = res.getHeader('content-length') ?? '-';
					const range = req.headers.range ? ` range=${req.headers.range}` : '';
					const line = `${res.statusCode} ${req.method} ${pathname} ${len}b ${Date.now() - started}ms${range}`;
					if (res.statusCode >= 400) server.config.logger.error(`[http] ${line}`);
					else server.config.logger.info(`[http] ${line}`);
				});
				next();
			});
		}
	};
}

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
	plugins: [httpAssetLog(), tailwindcss(), sveltekit(), devtoolsJson()],
	test: {
		expect: {
			requireAssertions: true
		},
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [
							{
								browser: 'chromium',
								headless: true
							}
						]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			},
			{
				extends: true,
				plugins: [
					// The plugin will run tests for the stories defined in your Storybook config
					// See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
					storybookTest({
						configDir: path.join(dirname, '.storybook')
					})
				],
				test: {
					name: 'storybook',
					browser: {
						enabled: true,
						headless: true,
						provider: playwright({}),
						instances: [
							{
								browser: 'chromium'
							}
						]
					}
				}
			}
		]
	}
});
