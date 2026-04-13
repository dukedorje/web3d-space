/**
 * Minimal PlayCanvas app factory for SvelteKit.
 * Dynamically imports PlayCanvas (SSR-safe) and creates an AppBase
 * with the component systems and resource handlers needed for Gaussian splats.
 */

export type { AppBase, Entity } from 'playcanvas';

export interface PlayCanvasApp {
	pc: typeof import('playcanvas');
	app: import('playcanvas').AppBase;
	device: import('playcanvas').GraphicsDevice;
}

export interface CreateAppOptions {
	canvas: HTMLCanvasElement;
	deviceTypes?: string[];
	maxPixelRatio?: number;
}

export async function createPlayCanvasApp(opts: CreateAppOptions): Promise<PlayCanvasApp> {
	const pc = await import('playcanvas');

	const device = await pc.createGraphicsDevice(opts.canvas, {
		deviceTypes: opts.deviceTypes ?? ['webgpu', 'webgl2'],
		antialias: false // splats don't benefit from AA
	});

	device.maxPixelRatio = opts.maxPixelRatio ?? Math.min(window.devicePixelRatio, 2);

	const createOptions = new pc.AppOptions();
	createOptions.graphicsDevice = device;

	createOptions.componentSystems = [
		pc.RenderComponentSystem,
		pc.CameraComponentSystem,
		pc.LightComponentSystem,
		pc.GSplatComponentSystem
	];
	createOptions.resourceHandlers = [
		pc.TextureHandler,
		pc.ContainerHandler,
		pc.GSplatHandler
	];

	const app = new pc.AppBase(opts.canvas);
	app.init(createOptions);

	app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
	app.setCanvasResolution(pc.RESOLUTION_AUTO);

	const resize = () => app.resizeCanvas();
	window.addEventListener('resize', resize);
	app.on('destroy', () => window.removeEventListener('resize', resize));

	app.start();

	return { pc, app, device };
}
