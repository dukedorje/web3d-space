/**
 * Type declaration for WGSL shader files imported with ?raw suffix.
 * Allows `import shaderSource from './shader.wgsl?raw'` in TypeScript.
 */
declare module '*.wgsl?raw' {
	const source: string;
	export default source;
}
