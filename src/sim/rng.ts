// 난수 스트림: the demo's mulberry32 with its state kept explicit so it can be hashed and counted (B6).
export const STREAMS = ['scn', 'bal', 'fdc', 'exp', 'ai', 'las'] as const;
export type StreamName = (typeof STREAMS)[number];

export interface Stream {
  a: number; // int32 generator state
  count: number; // draws so far
}

export type Streams = Record<StreamName, Stream>;

// 시나리오 · 탄도 · FDC 판단 · 발각 · 적/아군 행동 (demo salts) · 레이저 (new, B6)
const SALT: Record<StreamName, number> = {
  scn: 0,
  bal: 0x5bd1e995,
  fdc: 0x1b873593,
  exp: 0x68e31da4,
  ai: 0x3c6ef372,
  las: 0x2545f491,
};

export function createStreams(seed: number): Streams {
  const s = (name: StreamName): Stream => ({ a: (seed ^ SALT[name]) | 0, count: 0 });
  return { scn: s('scn'), bal: s('bal'), fdc: s('fdc'), exp: s('exp'), ai: s('ai'), las: s('las') };
}

/** Uniform in [0, 1). */
export function next(s: Stream): number {
  s.a = (s.a + 0x6d2b79f5) | 0;
  s.count++;
  let t = Math.imul(s.a ^ (s.a >>> 15), 1 | s.a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
