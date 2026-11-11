// The demo's value noise (demo lines 216–219), integer hashing only, so it is the same in every engine.
import { hash } from '../../terrainFile/cellHash';

function vnoise(x: number, y: number, s: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let fx = x - ix;
  let fy = y - iy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, s);
  const b = hash(ix + 1, iy, s);
  const c = hash(ix, iy + 1, s);
  const d = hash(ix + 1, iy + 1, s);
  return (a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy) * 2 - 1;
}

/** Fractal sum of `o` octaves, roughly in [-1, 1]. */
export function fbm(x: number, y: number, s: number, o: number): number {
  let v = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < o; i++) {
    v += a * vnoise(x * f, y * f, s + i * 17);
    a *= 0.5;
    f *= 2.03;
  }
  return v;
}

/** Smoothstep from a to b (a > b runs backwards, as in the demo). */
export function ss(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
