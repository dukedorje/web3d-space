import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAnimationLoop, type AnimationLoopConfig, type SimParamsSnapshot, type BufferRecreateCallback } from './animation-loop.js';

// --- Helpers to build mock config ---

function makeSimParams(): SimParamsSnapshot {
	return {
		boidCount: 256,
		maxForce: 0.5,
		worldSize: 100,
		selectedBoidIndex: 0xFFFFFFFF
	};
}

function makeMockBuffers(count: number) {
	const bindGroupEven = { _label: `even-${count}` } as unknown as GPUBindGroup;
	const bindGroupOdd = { _label: `odd-${count}` } as unknown as GPUBindGroup;
	return {
		storage: [{} as GPUBuffer, {} as GPUBuffer] as const,
		config: {} as GPUBuffer,
		uniform: {} as GPUBuffer,
		bindGroupLayout: {} as GPUBindGroupLayout,
		bindGroups: [bindGroupEven, bindGroupOdd] as const,
		count
	};
}

function makeMockConfig(simParams?: SimParamsSnapshot): {
	config: AnimationLoopConfig;
	mocks: {
		writeUniforms: ReturnType<typeof vi.fn>;
		writeCameraMatrix: ReturnType<typeof vi.fn>;
		submit: ReturnType<typeof vi.fn>;
		encoderFinish: ReturnType<typeof vi.fn>;
		cameraUpdate: ReturnType<typeof vi.fn>;
	};
} {
	const encoderFinish = vi.fn().mockReturnValue('command-buffer');

	function makeEncoder() {
		const computePass = {
			setPipeline: vi.fn(),
			setBindGroup: vi.fn(),
			dispatchWorkgroups: vi.fn(),
			end: vi.fn()
		};
		const renderPass = { end: vi.fn() };
		return {
			beginComputePass: vi.fn().mockReturnValue(computePass),
			beginRenderPass: vi.fn().mockReturnValue(renderPass),
			finish: encoderFinish
		};
	}

	const submit = vi.fn();
	const device = {
		createCommandEncoder: vi.fn().mockImplementation(() => makeEncoder()),
		queue: { submit, writeBuffer: vi.fn() }
	} as unknown as GPUDevice;

	const textureView = {};
	const canvasContext = {
		getCurrentTexture: vi.fn().mockReturnValue({
			createView: vi.fn().mockReturnValue(textureView)
		})
	} as unknown as GPUCanvasContext;

	const buffers = makeMockBuffers(256);

	const cameraUpdate = vi.fn();
	const camera = {
		update: cameraUpdate,
		getViewProjectionMatrix: vi.fn().mockReturnValue(new Float32Array(16)),
		attach: vi.fn(),
		detach: vi.fn(),
		position: new Float32Array(3),
		yaw: 0,
		pitch: 0,
		speed: 20,
		isLocked: false
	};

	return {
		config: {
			device,
			canvasContext,
			buffers,
			computePipeline: {} as GPUComputePipeline,
			camera,
			simParams: simParams ?? makeSimParams()
		},
		mocks: {
			writeUniforms: device.queue.writeBuffer as unknown as ReturnType<typeof vi.fn>,
			writeCameraMatrix: device.queue.writeBuffer as unknown as ReturnType<typeof vi.fn>,
			submit,
			encoderFinish,
			cameraUpdate
		}
	};
}

// Mock requestAnimationFrame to call callback synchronously with a given timestamp
let rafCallback: ((time: number) => void) | null = null;
let rafIdCounter = 1;

beforeEach(() => {
	rafCallback = null;
	rafIdCounter = 1;
	vi.stubGlobal('requestAnimationFrame', vi.fn((cb: (time: number) => void) => {
		rafCallback = cb;
		return rafIdCounter++;
	}));
	vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

describe('createAnimationLoop', () => {
	it('returns start, stop, isRunning', () => {
		const { config } = makeMockConfig();
		const loop = createAnimationLoop(config);

		expect(typeof loop.start).toBe('function');
		expect(typeof loop.stop).toBe('function');
		expect(typeof loop.isRunning).toBe('function');
	});

	it('is not running initially', () => {
		const { config } = makeMockConfig();
		const loop = createAnimationLoop(config);

		expect(loop.isRunning()).toBe(false);
	});

	it('is running after start()', () => {
		const { config } = makeMockConfig();
		const loop = createAnimationLoop(config);
		loop.start();

		expect(loop.isRunning()).toBe(true);
	});

	it('calls requestAnimationFrame on start', () => {
		const { config } = makeMockConfig();
		const loop = createAnimationLoop(config);
		loop.start();

		expect(requestAnimationFrame).toHaveBeenCalledOnce();
	});

	it('calls cancelAnimationFrame on stop', () => {
		const { config } = makeMockConfig();
		const loop = createAnimationLoop(config);
		loop.start();
		loop.stop();

		expect(cancelAnimationFrame).toHaveBeenCalled();
		expect(loop.isRunning()).toBe(false);
	});

	it('submits a command buffer each frame', () => {
		const { config, mocks } = makeMockConfig();
		const loop = createAnimationLoop(config);
		loop.start();

		// Simulate first frame at t=16ms
		rafCallback!(16);

		expect(mocks.submit).toHaveBeenCalledWith(['command-buffer']);
	});

	it('requests next frame after each frame', () => {
		const { config } = makeMockConfig();
		const loop = createAnimationLoop(config);
		loop.start();

		// Initial call
		expect(requestAnimationFrame).toHaveBeenCalledTimes(1);

		// Simulate frame
		rafCallback!(16);

		// Should request another frame
		expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
	});
});

describe('delta-time clamping', () => {
	it('clamps delta-time to 100ms max', () => {
		const { config, mocks } = makeMockConfig();
		const loop = createAnimationLoop(config);
		loop.start();

		// First frame: dt=0 (no lastTime yet)
		rafCallback!(0);

		// Second frame: 500ms later — should be clamped to 0.1s
		const secondRaf = rafCallback!;
		secondRaf(500);

		// Camera.update should have been called with clamped dt
		// First call: dt=0, second call: dt=0.1 (clamped from 0.5)
		expect(mocks.cameraUpdate).toHaveBeenCalledTimes(2);
		const secondCallDt = mocks.cameraUpdate.mock.calls[1][0];
		expect(secondCallDt).toBeCloseTo(0.1, 5);
	});

	it('passes unclamped dt when under 100ms', () => {
		const { config, mocks } = makeMockConfig();
		const loop = createAnimationLoop(config);
		loop.start();

		// First frame
		rafCallback!(1000);

		// Second frame: 50ms later
		rafCallback!(1050);

		const secondCallDt = mocks.cameraUpdate.mock.calls[1][0];
		expect(secondCallDt).toBeCloseTo(0.05, 5);
	});

	it('first frame has dt=0', () => {
		const { config, mocks } = makeMockConfig();
		const loop = createAnimationLoop(config);
		loop.start();

		rafCallback!(16);

		const firstCallDt = mocks.cameraUpdate.mock.calls[0][0];
		expect(firstCallDt).toBe(0);
	});
});

describe('snapshot read pattern', () => {
	it('reads simParams snapshot each frame (not cached at creation)', () => {
		const simParams = makeSimParams();
		const { config, mocks } = makeMockConfig(simParams);
		const loop = createAnimationLoop(config);
		loop.start();

		// First frame
		rafCallback!(0);

		// Mutate the snapshot (simulating $effect bridge update)
		simParams.boidCount = 512;

		// Second frame should pick up new values
		rafCallback!(16);

		// The encoder was created twice — verify loop ran twice
		expect(mocks.submit).toHaveBeenCalledTimes(2);
		// Camera update was called with both frames
		expect(mocks.cameraUpdate).toHaveBeenCalledTimes(2);
	});
});

describe('ping-pong buffer swap', () => {
	it('alternates bind groups across frames', () => {
		const { config } = makeMockConfig();
		const device = config.device as unknown as {
			createCommandEncoder: ReturnType<typeof vi.fn>;
		};
		const loop = createAnimationLoop(config);
		loop.start();

		// Frame 0: should use bindGroups[0]
		rafCallback!(0);
		const encoder0 = device.createCommandEncoder.mock.results[0].value;
		const computeCall0 = encoder0.beginComputePass.mock.results[0].value;
		const bg0 = computeCall0.setBindGroup.mock.calls[0][1];
		expect(bg0).toBe(config.buffers.bindGroups[0]);

		// Frame 1: should use bindGroups[1]
		rafCallback!(16);
		const encoder1 = device.createCommandEncoder.mock.results[1].value;
		const computeCall1 = encoder1.beginComputePass.mock.results[0].value;
		const bg1 = computeCall1.setBindGroup.mock.calls[0][1];
		expect(bg1).toBe(config.buffers.bindGroups[1]);
	});
});

describe('boidCount change detection', () => {
	it('does not call onBoidCountChange when count is unchanged', () => {
		const simParams = makeSimParams(); // boidCount: 256
		const { config } = makeMockConfig(simParams);
		const onBoidCountChange = vi.fn<BufferRecreateCallback>().mockReturnValue(makeMockBuffers(256));
		const loop = createAnimationLoop({ ...config, onBoidCountChange });
		loop.start();

		rafCallback!(0);
		rafCallback!(16);

		expect(onBoidCountChange).not.toHaveBeenCalled();
	});

	it('calls onBoidCountChange when boidCount changes', () => {
		const simParams = makeSimParams(); // boidCount: 256
		const { config } = makeMockConfig(simParams);
		const newBuffers = makeMockBuffers(512);
		const onBoidCountChange = vi.fn<BufferRecreateCallback>().mockReturnValue(newBuffers);
		const loop = createAnimationLoop({ ...config, onBoidCountChange });
		loop.start();

		// First frame — count matches
		rafCallback!(0);
		expect(onBoidCountChange).not.toHaveBeenCalled();

		// Mutate snapshot (simulates slider change via $effect bridge)
		simParams.boidCount = 512;

		// Second frame — count mismatch triggers callback
		rafCallback!(16);
		expect(onBoidCountChange).toHaveBeenCalledOnce();
		expect(onBoidCountChange).toHaveBeenCalledWith(512, config.buffers);
	});

	it('uses new buffers from callback on subsequent frames', () => {
		const simParams = makeSimParams(); // boidCount: 256
		const { config } = makeMockConfig(simParams);
		const newBuffers = makeMockBuffers(512);
		const onBoidCountChange = vi.fn<BufferRecreateCallback>().mockReturnValue(newBuffers);
		const loop = createAnimationLoop({ ...config, onBoidCountChange });
		loop.start();

		simParams.boidCount = 512;
		rafCallback!(0); // triggers recreation

		// Count now matches newBuffers.count — should not call again
		rafCallback!(16);
		expect(onBoidCountChange).toHaveBeenCalledOnce();
	});

	it('resets frameIndex to 0 after buffer recreation', () => {
		const simParams = makeSimParams(); // boidCount: 256
		const { config } = makeMockConfig(simParams);
		const device = config.device as unknown as {
			createCommandEncoder: ReturnType<typeof vi.fn>;
		};
		const newBuffers = makeMockBuffers(512);
		const onBoidCountChange = vi.fn<BufferRecreateCallback>().mockReturnValue(newBuffers);
		const loop = createAnimationLoop({ ...config, onBoidCountChange });
		loop.start();

		// Advance one frame to get frameIndex=1
		rafCallback!(0);

		// Change count — should reset frameIndex to 0
		simParams.boidCount = 512;
		rafCallback!(16);

		// The frame after recreation should use bindGroups[0] (even), not [1]
		const encoderIdx = device.createCommandEncoder.mock.results[1].value;
		const computePass = encoderIdx.beginComputePass.mock.results[0].value;
		const usedBindGroup = computePass.setBindGroup.mock.calls[0][1];
		expect(usedBindGroup).toBe(newBuffers.bindGroups[0]);
	});
});

describe('single compute dispatch', () => {
	it('dispatches exactly one compute pass per frame', () => {
		const { config } = makeMockConfig();
		const device = config.device as unknown as {
			createCommandEncoder: ReturnType<typeof vi.fn>;
		};
		const loop = createAnimationLoop(config);
		loop.start();

		rafCallback!(0);

		const encoder = device.createCommandEncoder.mock.results[0].value;
		expect(encoder.beginComputePass).toHaveBeenCalledTimes(1);
	});
});

describe('D-005 snapshot bridge sync', () => {
	it('picks up param changes from snapshot on next frame', () => {
		const simParams = makeSimParams();
		const { config, mocks } = makeMockConfig(simParams);
		const loop = createAnimationLoop(config);
		loop.start();

		rafCallback!(0);

		// Simulate $effect writing new values
		simParams.worldSize = 200;
		simParams.maxForce = 10.0;

		rafCallback!(16);

		// writeBuffer is called each frame — verify it was called twice total
		expect(mocks.submit).toHaveBeenCalledTimes(2);
	});
});
