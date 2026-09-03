/**
 * Jetson T4000 floor — FACT from DS-11945-001 v1.4 (AICamera docs/references/T4000.md).
 *
 * Cloud GPUs "beat" this box when they have ≥ CUDA cores and a tensor/quant
 * generation that can run the same live stack (SAM2, Depth Anything V2-S,
 * Qwen 9B, NVENC-class encode). FP4 NVFP4 is Blackwell-only; Ada/Hopper
 * have FP8 but not the T4000's 5th-gen FP4 paths.
 */

export const T4000 = {
	id: 'NVIDIA Jetson T4000',
	name: 'T4000',
	architecture: 'Blackwell',
	computeCapability: '11.0',
	cudaCores: 1536,
	gpc: 2,
	tpc: 6,
	tensor: {
		generation: 5,
		fp4SparseTflops: 1200,
		fp8SparseTflops: 600,
		fp32Tflops: 4.7
	},
	memoryGb: 64,
	bandwidthGBs: 273,
	memoryKind: 'LPDDR5X unified',
	nvenc: 1,
	nvdec: 1,
	tdpW: 70,
	throttleW: 90,
	gpuClockGhz: 1.53
} as const;

export type BeatKind = 'fp4' | 'fp8' | 'none';

export interface CloudGpuFacts {
	id: string;
	name: string;
	memoryGb: number;
	architecture?: string;
	/** True when the SKU is Blackwell (5th-gen tensor, NVFP4). */
	blackwell: boolean;
	securePrice?: number | null;
	communityPrice?: number | null;
	availability?: string | null;
}

export function isBlackwellId(id: string): boolean {
	return /blackwell|rtx pro 4000|rtx pro 4500|rtx pro 5000|rtx pro 6000|geforce rtx 50|nvidia b200|nvidia b300/i.test(
		id
	);
}

export function beatsT4000(gpu: CloudGpuFacts): {
	beats: boolean;
	kind: BeatKind;
	reasons: string[];
} {
	const reasons: string[] = [];
	const coresOk = true; // every discrete RunPod GPU has ≥ 1536 CUDA cores
	if (gpu.memoryGb < 8) {
		return { beats: false, kind: 'none', reasons: ['VRAM below a usable live-stack floor'] };
	}
	if (gpu.blackwell) {
		reasons.push('Blackwell 5th-gen tensor (FP4/NVFP4) ≥ T4000');
		if (gpu.memoryGb >= T4000.memoryGb) reasons.push(`VRAM ${gpu.memoryGb} GB ≥ T4000 64 GB unified`);
		else reasons.push(`VRAM ${gpu.memoryGb} GB < T4000 64 GB (live stack still fits at ≥24 GB)`);
		return { beats: true, kind: 'fp4', reasons };
	}
	if (gpu.memoryGb >= 24) {
		reasons.push('Ada/Hopper FP8 tensor, no NVFP4');
		reasons.push(`${gpu.memoryGb} GB VRAM runs SAM2 + DA-V2-S + 9B`);
		return { beats: true, kind: 'fp8', reasons };
	}
	return { beats: coresOk && gpu.memoryGb >= 16, kind: 'fp8', reasons: ['sub-24 GB; tight for co-resident 9B'] };
}

export function cheapestBeating(gpus: CloudGpuFacts[]): CloudGpuFacts[] {
	return gpus
		.filter((g) => beatsT4000(g).beats)
		.sort((a, b) => {
			const pa = a.securePrice ?? a.communityPrice ?? 999;
			const pb = b.securePrice ?? b.communityPrice ?? 999;
			const ka = beatsT4000(a).kind === 'fp4' ? 0 : 1;
			const kb = beatsT4000(b).kind === 'fp4' ? 0 : 1;
			return ka - kb || pa - pb;
		});
}
