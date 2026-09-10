export type LogLevel = 'info' | 'warn' | 'error';

export type LogLine = {
	t: number;
	level: LogLevel;
	msg: string;
};

const MAX = 80;
const lines: LogLine[] = [];
const listeners = new Set<(snapshot: readonly LogLine[]) => void>();

export function getLog(): readonly LogLine[] {
	return lines;
}

export function onLog(fn: (snapshot: readonly LogLine[]) => void): () => void {
	listeners.add(fn);
	fn(lines);
	return () => {
		listeners.delete(fn);
	};
}

export function log(level: LogLevel, msg: string, extra?: unknown): void {
	lines.push({ t: Date.now(), level, msg });
	if (lines.length > MAX) lines.shift();
	const tag = `[web3d] ${msg}`;
	if (level === 'error') console.error(tag, extra ?? '');
	else if (level === 'warn') console.warn(tag, extra ?? '');
	else console.info(tag, extra ?? '');
	for (const fn of listeners) fn(lines);
}

export function clearLog(): void {
	lines.length = 0;
	for (const fn of listeners) fn(lines);
}
