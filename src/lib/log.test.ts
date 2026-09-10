import { describe, it, expect, beforeEach } from 'vitest';
import { clearLog, getLog, log, onLog } from './log.js';

describe('log', () => {
	beforeEach(() => clearLog());

	it('keeps a ring of lines and notifies listeners', () => {
		const seen: number[] = [];
		const stop = onLog((lines) => seen.push(lines.length));
		log('info', 'hello');
		log('error', 'boom');
		expect(getLog().map((l) => `${l.level}:${l.msg}`)).toEqual(['info:hello', 'error:boom']);
		expect(seen.at(-1)).toBe(2);
		stop();
		log('warn', 'after');
		expect(seen.at(-1)).toBe(2);
	});
});
