// The demo's integer cell hash (demo lines 216–219), shared by the mock generator and the 지형 파일 unpacker so
// both build 숲 높이 from the same expression. Integer hashing only, so it is the same in every engine.

/** Uniform in [0, 1) from a cell and a salt. */
export function hash(ix: number, iy: number, s: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(s, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** 숲 높이 rule: the values come from the 지형 파일 header (min, max, salt). */
export interface ForestRule {
  min: number;
  max: number;
  salt: number;
}

/** 숲 높이 of cell (i, j), in [min, max). */
export const forestHeight = (f: ForestRule, i: number, j: number): number => f.min + (f.max - f.min) * hash(i, j, f.salt);
