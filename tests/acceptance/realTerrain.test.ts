// The real 지형 원천 seam: the committed 문경 지형 파일 served by a stub fetch (no network, no skip).
import { readFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { EYE_HEIGHT, heightAt, lineOfSight, replay, terrainHash, validateReplay, type SeedKind } from '@sim';
import { TerrainLoadError, type TerrainFailure } from '@adapters/index';
import { MUNGYEONG, realTerrain } from '@adapters/realTerrain';
import { mockTerrain } from '@adapters/mock/terrain';
import { mockWeather } from '@adapters/mock/weather';
import { BASE_GUNS } from '@content/guns';
import { MUNGYEONG_PLACEMENT } from '@content/mungyeong';
import { newGame } from '@app/game';
import { submissionOf } from '@app/records';
import { viewshed } from '@render/viewshed';
import { startInput } from '@ui/prep';
import { packTerrain } from '../../terrain/pipeline/rules/pack';
import { flatTerrain } from './terrain';

const FILE = new Uint8Array(readFileSync('src/adapters/realTerrain/mungyeong/terrain.bin'));
const EXPECTED = JSON.parse(readFileSync('src/adapters/realTerrain/mungyeong/expected.json', 'utf8'));
const serve = (bytes: Uint8Array = FILE) => async () => new Response(bytes.slice());

/** The rejection of one load: a TerrainLoadError's reason, or a failure if it resolves or throws anything else. */
async function reason(load: Promise<unknown>): Promise<TerrainFailure> {
  const e = await load.then(
    () => expect.fail('resolved'),
    (e: unknown) => e,
  );
  expect(e).toBeInstanceOf(TerrainLoadError);
  return (e as TerrainLoadError).reason;
}

afterEach(() => void vi.unstubAllGlobals());

describe('실제 지형 원천', () => {
  test('F-15: 실제 지형 원천은 어느 시드에도 같은 정체', async () => {
    expect(EXPECTED).toEqual({ id: 'mungyeong', version: 2, hash: expect.any(String) });
    for (const source of [realTerrain(MUNGYEONG, terrainHash, serve()), realTerrain(MUNGYEONG, terrainHash, serve())])
      for (const seed of [1, 20261106, 20261107]) {
        const t = await source.load(seed);
        expect({ id: t.id, version: t.version, hash: terrainHash(t) }, String(seed)).toEqual(EXPECTED);
      }
  }, 30_000);

  test('실제 지형 원천: 거부하고 mock으로 돌아가지 않는다', async () => {
    const load = (get: typeof fetch, expected = MUNGYEONG.expected) => realTerrain({ ...MUNGYEONG, expected }, terrainHash, get).load(1);
    // 받지 못함: a dropped connection, a timeout, HTTP errors, a body that breaks off. The request carries an abort signal.
    const signals: unknown[] = [];
    const fail = (e: unknown) => async (_: unknown, init?: RequestInit) => (signals.push(init?.signal), Promise.reject(e));
    expect(await reason(load(fail(new TypeError('Failed to fetch'))))).toBe('fetch');
    expect(await reason(load(fail(new DOMException('timed out', 'TimeoutError'))))).toBe('fetch');
    expect(signals).toHaveLength(2);
    for (const s of signals) expect(s).toBeInstanceOf(AbortSignal);
    for (const status of [404, 500]) expect(await reason(load(async () => new Response('x', { status }))), String(status)).toBe('fetch');
    const broken = new Response(new ReadableStream({ pull: (c) => c.error(new TypeError('network')) }));
    expect(await reason(load(async () => broken))).toBe('fetch');

    // 맞지 않음: one byte changed in the compressed payload, or in the unpacked data (re-gzipped: found by the hash).
    const payload = FILE.slice();
    payload[1000]! ^= 0xff;
    expect(await reason(load(serve(payload)))).toBe('mismatch');
    const body = gunzipSync(FILE);
    body[body.length - 1]! ^= 1; // the last cover byte: the file still unpacks
    expect(await reason(load(serve(new Uint8Array(gzipSync(body)))))).toBe('mismatch');
    // A valid file of other land swapped in under the same name.
    const other = packTerrain({ ...flatTerrain(), id: 'mungyeong', version: 2 }, 10, { min: 12, max: 17, salt: 5 });
    expect(await reason(load(serve(other)))).toBe('mismatch');
    // The right file against an expectation off by any one of the three.
    for (const off of [{ id: 'mungyeong2' }, { version: 3 }, { hash: '0000000000000000' }])
      expect(await reason(load(serve(), { ...MUNGYEONG.expected, ...off })), JSON.stringify(off)).toBe('mismatch');

    // 지원하지 않음: no gzip unpacking in this browser, found before any request.
    vi.stubGlobal('DecompressionStream', undefined);
    const get = vi.fn(serve());
    expect(await reason(load(get))).toBe('unsupported');
    expect(get).not.toHaveBeenCalled();
  }, 60_000);

  test('실제 지형 원천: 받기는 쪽을 열 때 한 번', async () => {
    const get = vi.fn(serve());
    const source = realTerrain(MUNGYEONG, terrainHash, get);
    const first = await source.load(1);
    expect(await source.load(2)).toBe(first); // a new game, any seed: the same land, not fetched again
    expect(get).toHaveBeenCalledTimes(1);
  });

  // The 문경 지형 as the app loads it, for the tests below.
  const mungyeong = realTerrain(MUNGYEONG, terrainHash, serve()).load(0);
  const { scenario } = MUNGYEONG_PLACEMENT;

  /** A game on the 문경 지형 as the app builds it, started at the 계획 관측소 (no pick) and run `ticks` ticks. */
  async function played(seed: number, seedKind: SeedKind, ticks: number, preset?: 'clear' | 'fog') {
    const terrain = await mungyeong;
    const weather = await mockWeather.load(seed, seedKind, preset);
    const game = newGame({ seed, seedKind, scenario, guns: BASE_GUNS, weather, mode: 'training', terrain });
    game.session.send(startInput(game.sim.state, []));
    for (let k = 0; k < ticks; k++) game.session.step();
    return game;
  }

  test('실제 지형 원천: 재생 자료의 terrain', async () => {
    const g = await played(20261106, 'daily', 100);
    expect(g.sim.state.phase).toBe('live');
    const { replay: data } = submissionOf('참새12', g.sim, g.init, g.session.log);
    expect(data.terrain).toEqual({ id: 'mungyeong', version: 2 });
    expect(validateReplay(JSON.parse(JSON.stringify(data))).ok).toBe(true);
    const again = replay(data, await mungyeong, scenario);
    expect(again.record).toEqual(g.sim.record());
    // A game on the mock land carries no terrain key at all.
    const mock = newGame({ ...g.init, terrain: await mockTerrain.load(1) });
    expect('terrain' in submissionOf('참새12', mock.sim, mock.init, mock.session.log).replay).toBe(false);
  }, 60_000);

  test('F-30: 실제 지형에서 시드는 땅을 고르지 않는다', async () => {
    const land = (g: Awaited<ReturnType<typeof played>>) => terrainHash(g.init.terrain);
    // The same daily seed: the same land, the same weather, the same enemy, the same state.
    const [a, b] = [await played(20261106, 'daily', 200), await played(20261106, 'daily', 200)];
    expect(land(b)).toBe(land(a));
    expect(b.init.weather).toEqual(a.init.weather);
    expect(b.sim.state.platoons).toEqual(a.sim.state.platoons);
    expect(b.sim.hash()).toBe(a.sim.hash());
    // Practice seeds: the land stays, the enemy's chance moves; the preset changes the weather on the same land.
    const [p1, p2] = [await played(1, 'practice', 200, 'clear'), await played(2, 'practice', 200, 'clear')];
    expect(land(p2)).toBe(land(p1));
    expect(land(p1)).toBe(land(a));
    expect(p2.sim.state.platoons).not.toEqual(p1.sim.state.platoons);
    const fog = await played(1, 'practice', 0, 'fog');
    expect(land(fog)).toBe(land(p1));
    expect(fog.init.weather).not.toEqual(p1.init.weather);
  }, 60_000);

  test('F-24: 가시권 — 실제 지형에서도 시뮬레이션의 가시선과 같다', async () => {
    const t = await mungyeong;
    const op = scenario.plannedOp;
    const g = 192; // the app's 가시권 grid (MapPanel)
    const px = viewshed(t, op);
    expect(px).toHaveLength(g * g * 4);
    const cs = (t.n * t.cell) / g;
    const eye = { ...op, z: heightAt(t, op.x, op.y) + EYE_HEIGHT };
    let [dark, clear, skipped] = [0, 0, 0];
    for (let j = 0; j < g; j++)
      for (let i = 0; i < g; i++) {
        const x = (i + 0.5) * cs;
        const y = (j + 0.5) * cs;
        const a = px[((g - 1 - j) * g + i) * 4 + 3];
        // Never marked within 150 m north of the post or south of it; elsewhere dark exactly where the sim's 가시선
        // to a man standing there (1.7 m) is blocked.
        const expected = y < op.y + 150 ? 0 : lineOfSight(t, eye, { x, y, z: heightAt(t, x, y) + 1.7 }) ? 0 : 120;
        if (a !== expected) expect(a, `cell ${i},${j}`).toBe(expected);
        if (y < op.y + 150) skipped++;
        else if (expected) dark++;
        else clear++;
      }
    expect(Math.min(dark, clear, skipped)).toBeGreaterThan(100);
  }, 60_000);
});
