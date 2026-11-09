// 가시권 표시 (training, demo lines 1247–1255): the ground the post cannot see, darkened, by the simulation's own 가시선.
import { EYE_HEIGHT, heightAt, lineOfSight, type Point, type TerrainData } from '@sim';

const TARGET_HEIGHT = 1.7; // a standing man
const SOUTH_SKIP_M = 150; // game rule (demo): nothing within 150 m north of the post or south of it is marked

/** RGBA, `g`×`g` cells over the whole terrain, row 0 = north: hidden ground is dark, the rest transparent. */
export function viewshed(t: TerrainData, op: Point, g = 192): Uint8ClampedArray {
  const px = new Uint8ClampedArray(g * g * 4);
  const cs = (t.n * t.cell) / g;
  const eye = { ...op, z: heightAt(t, op.x, op.y) + EYE_HEIGHT };
  for (let j = 0; j < g; j++)
    for (let i = 0; i < g; i++) {
      const x = (i + 0.5) * cs;
      const y = (j + 0.5) * cs;
      if (y < op.y + SOUTH_SKIP_M || lineOfSight(t, eye, { x, y, z: heightAt(t, x, y) + TARGET_HEIGHT })) continue;
      px.set([20, 20, 30, 120], ((g - 1 - j) * g + i) * 4);
    }
  return px;
}
