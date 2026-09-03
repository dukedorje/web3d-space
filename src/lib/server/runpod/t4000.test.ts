import { describe, expect, it } from 'vitest';
import { beatsT4000, cheapestBeating, isBlackwellId } from './t4000';

describe('T4000 floor', () => {
	it('treats Blackwell SKUs as FP4 matches', () => {
		expect(isBlackwellId('NVIDIA RTX PRO 4500 Blackwell')).toBe(true);
		expect(isBlackwellId('NVIDIA GeForce RTX 5090')).toBe(true);
		expect(isBlackwellId('NVIDIA L40S')).toBe(false);
	});

	it('ranks cheapest FP4 ahead of cheaper FP8', () => {
		const ranked = cheapestBeating([
			{
				id: 'NVIDIA L40S',
				name: 'L40S',
				memoryGb: 48,
				blackwell: false,
				securePrice: 0.99
			},
			{
				id: 'NVIDIA RTX PRO 4500 Blackwell',
				name: 'PRO 4500',
				memoryGb: 32,
				blackwell: true,
				securePrice: 0.72
			},
			{
				id: 'NVIDIA A40',
				name: 'A40',
				memoryGb: 48,
				blackwell: false,
				securePrice: 0.44
			}
		]);
		expect(ranked[0]?.id).toBe('NVIDIA RTX PRO 4500 Blackwell');
		expect(beatsT4000(ranked[0]!).kind).toBe('fp4');
	});
});
