import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { createSim, fromGrid, replay, SIM_VERSION, terrainHash, toGrid, validateReplay, type SimEvent } from '@sim';
import { generateTerrain } from '@adapters/mock/terrain';
import { unpackTerrain } from '@adapters/terrainFile/unpack';
import { MOCK_PLACEMENT } from '@content/placement';
import { BASE_SCENARIO } from '@content/scenario';
import { MUNGYEONG_PLACEMENT } from '@content/mungyeong';
import { currentHeader, goldenFiles, headerVersions, readGolden, shouldWrite, type Versions } from './golden';
import { landOf, REAL_TERRAIN_FILE } from './land';
import { SCRIPTS } from './scripts';

const FIVE = '5-real-laser-move.json';

describe('골든', () => {
  // Checks all three header versions (simVersion, 지형 판, 시나리오 버전) against the code and the land's data.
  test('골든: simVersion이 코드와 같다', async () => {
    const files = goldenFiles();
    expect(files).toContain('0-empty.json');
    expect(files).toContain(FIVE);
    const real = await unpackTerrain(new Uint8Array(readFileSync(REAL_TERRAIN_FILE)));
    const ref = (r: { id: string; version: number }) => ({ id: r.id, version: r.version });
    for (const f of files) {
      const d = readGolden(f).replay;
      const [terrain, scenario] = d.terrain ? [ref(real), ref(MUNGYEONG_PLACEMENT.scenario)] : [MOCK_PLACEMENT.terrain, ref(BASE_SCENARIO)];
      expect(headerVersions(d), f).toEqual({ simVersion: SIM_VERSION, terrain, scenario });
    }
  }, 30000); // reads every golden file

  test('골든: 세 파일과 ⑤ 머리의 정체가 같다', async () => {
    const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
    const t = await unpackTerrain(new Uint8Array(readFileSync(REAL_TERRAIN_FILE)));
    const identity = { id: t.id, version: t.version, hash: terrainHash(t) };
    const header = json('terrain/mungyeong/header.json');
    const { terrainHash: hash, replay: data } = readGolden(FIVE);
    expect({ id: header.id, version: header.version, hash: header.hash }).toEqual(identity);
    expect(json('src/adapters/realTerrain/mungyeong/expected.json')).toEqual(identity);
    expect({ ...data.terrain, hash }).toEqual(identity);
    expect(identity.id).toBe('mungyeong');
  });

  test('골든: 0번 개시만 한 빈 판', () => {
    const { terrainHash: header, replay: data, ...expected } = readGolden('0-empty.json');
    expect(validateReplay(data).ok).toBe(true);
    expect(expected.checkpoints.map((c) => c.tick)).toEqual([200, 400]);
    const terrain = generateTerrain(data.seed);
    expect(terrainHash(terrain)).toBe(header);
    expect(replay(data, terrain, BASE_SCENARIO)).toEqual(expected);
  }, 30000); // terrain generation and a replay (~2 s alone): vitest's 5 s default is hit under load

  test('골든: ① 좌표법 조정에서 임무끝까지', () => {
    const { terrainHash: header, replay: data, ...expected } = readGolden('1-grid-eom.json');
    expect(validateReplay(data).ok).toBe(true);
    expect(expected.ignored).toBe(0); // every scripted transmission was taken
    const terrain = generateTerrain(data.seed);
    expect(terrainHash(terrain)).toBe(header);
    expect(replay(data, terrain, BASE_SCENARIO)).toEqual(expected);
    // The script does what it says: a 접근신관 효력사 lands and the mission ends with 임무끝.
    const sim = createSim({ ...data, scenario: BASE_SCENARIO, terrain });
    const events: SimEvent[] = [];
    for (let t = 0; t < data.totalTicks; t++) events.push(...sim.step(data.inputs.filter((i) => i.t === t)).events);
    expect(events.some((e) => e.type === 'impact' && e.fuze === 'vt')).toBe(true);
    expect(events.some((e) => e.type === 'radio' && e.utterance.kind === 'end_of_mission')).toBe(true);
    expect(sim.state.missions[0]).toMatchObject({ report: 'neutralized', truth: 'neutralized' });
  }, 30000); // two full runs (~3 s alone): vitest's 5 s default is hit under load

  test('골든: ② 극좌표·레이저·전이·위험근접·이동', () => {
    const { terrainHash: header, replay: data, ...expected } = readGolden('2-polar-move.json');
    expect(validateReplay(data).ok).toBe(true);
    expect(expected.ignored).toBe(0);
    const terrain = generateTerrain(data.seed);
    expect(terrainHash(terrain)).toBe(header);
    expect(replay(data, terrain, BASE_SCENARIO)).toEqual(expected);
    // The script does what it says.
    const sim = createSim({ ...data, scenario: BASE_SCENARIO, terrain });
    const events: SimEvent[] = [];
    for (let t = 0; t < data.totalTicks; t++) events.push(...sim.step(data.inputs.filter((i) => i.t === t)).events);
    const said = (speaker: string, kind: string) => events.some((e) => e.type === 'radio' && e.utterance.speaker === speaker && e.utterance.kind === kind);
    expect(sim.state.lases.some((l) => l.range !== null)).toBe(true);
    expect(events.some((e) => e.type === 'radio' && e.utterance.kind === 'location' && e.utterance.slots.method === 'polar')).toBe(true);
    expect(said('observer', 'shift')).toBe(true);
    expect(said('fdc', 'danger_close_adjust_first')).toBe(true);
    expect(said('observer', 'move_notice') && said('fdc', 'move_notice')).toBe(true);
    expect(said('fdc', 'position_report')).toBe(true);
    expect(sim.state.knownOp).toEqual(fromGrid(4520, 3180, terrain.grid));
    expect(sim.state.op).toEqual({ x: 5200, y: 1800 });
    expect(sim.state.observerLost).toBe(false);
    expect(sim.record().compromised).toBe(false); // no 발각 on this seed (scripts.ts): a regenerated golden must keep it
  }, 30000);

  test('골든: ③ 사격 없이 시간 한도까지', () => {
    const { terrainHash: header, replay: data, ...expected } = readGolden('3-time-limit.json');
    expect(validateReplay(data).ok).toBe(true);
    expect(data.inputs).toHaveLength(1); // 개시 only: nothing is fired
    expect(data.totalTicks).toBe(48000); // the 40분 한도 is the terminal tick (#33: no padding past it)
    const terrain = generateTerrain(data.seed);
    expect(terrainHash(terrain)).toBe(header);
    const result = replay(data, terrain, BASE_SCENARIO);
    expect(result).toEqual(expected);
    // The script does what it says, read off its record: the limit ended it, no round was fired, the post was never found
    // and the 관측반 lived.
    expect(result.record).toMatchObject({ ticks: 48000, roundsTotal: 0, missions: 0, compromised: false, observerLost: false, cleared: false, clearTick: null });
    expect(result.checkpoints.at(-1)!.tick).toBe(48000);
  }, 60000); // one replay hashing every tick (~10 s alone)

  test('골든: ④ 데스크톱 한 판', () => {
    const { terrainHash: header, replay: data, ...expected } = readGolden('4-desktop-play.json');
    expect(validateReplay(data).ok).toBe(true);
    expect(expected.ignored).toBe(0); // every recorded input was taken
    const terrain = generateTerrain(data.seed);
    expect(terrainHash(terrain)).toBe(header);
    const result = replay(data, terrain, BASE_SCENARIO);
    expect(result).toEqual(expected);
    // The game is what scripts.ts says: standard mode, three missions, ended by the 40분 한도.
    expect(result.record).toMatchObject({ ticks: 48000, missions: 3, mode: 'standard' });
    expect(result.checkpoints.at(-1)!.tick).toBe(48000);
  }, 60000); // one replay hashing every tick (~10 s alone)

  test('골든: ⑤ 실제 지형의 레이저·효력사·이동', async () => {
    const { terrainHash: header, replay: data, ...expected } = readGolden(FIVE);
    expect(validateReplay(data).ok).toBe(true);
    expect(expected.ignored).toBe(0);
    expect(data.terrain).toEqual(MUNGYEONG_PLACEMENT.terrain);
    expect(data.mode).toBe('standard');
    expect(data.totalTicks).toBeLessThanOrEqual(12000);
    const { terrain, scenario } = await landOf(data); // the committed 지형 파일: missing → ENOENT, never a skip
    expect(terrainHash(terrain)).toBe(header);
    expect(replay(data, terrain, scenario)).toEqual(expected);
    // The script does what it says: a lase answers, the 효력사 lands, the post moves and 기러기 is told where.
    const sim = createSim({ ...data, scenario, terrain });
    const events: SimEvent[] = [];
    const impacts: number[] = [];
    for (let t = 0; t < data.totalTicks; t++)
      for (const e of sim.step(data.inputs.filter((i) => i.t === t)).events) {
        events.push(e);
        if (e.type === 'impact') impacts.push(t);
      }
    const said = (speaker: string, kind: string) => events.some((e) => e.type === 'radio' && e.utterance.speaker === speaker && e.utterance.kind === kind);
    const at = (a: string) => data.inputs.find((i) => i.a === a)!;
    expect(sim.state.lases.some((l) => l.range !== null)).toBe(true);
    expect(impacts.some((t) => t > at('corr').t)).toBe(true); // the 효력사 after the correction
    expect(said('observer', 'move_notice') && said('fdc', 'move_notice')).toBe(true);
    expect(said('fdc', 'position_report')).toBe(true);
    const [x, y] = at('move').v as number[];
    expect(sim.state.op).toEqual({ x, y });
    expect(sim.state.post).toMatchObject({ state: 'ready', moves: 1 });
    const [e, n] = at('pos').v as number[];
    expect(toGrid(x!, y!, terrain.grid)).toEqual({ e, n }); // the report names the square the post stands in
    expect(sim.state.knownOp).toEqual(fromGrid(e!, n!, terrain.grid));
    expect(sim.state.observerLost).toBe(false);
    expect(sim.record().compromised).toBe(false); // no 발각 on this seed (scripts.ts): a regenerated golden must keep it
  }, 30000);

  test('골든: 다시 만드는 조건', () => {
    const v = (simVersion: number, terrain: number, scenario: number, ids = { terrain: 'mock', scenario: 'base' }): Versions => ({
      simVersion,
      terrain: { id: ids.terrain, version: terrain },
      scenario: { id: ids.scenario, version: scenario },
    });
    const golden = v(17, 1, 3);
    expect(shouldWrite(null, golden)).toBe(true); // no file
    expect(shouldWrite(golden, v(17, 1, 3))).toBe(false); // all equal: skip
    for (const now of [v(18, 1, 3), v(17, 2, 3), v(17, 1, 4), v(18, 2, 3), v(17, 2, 4)]) expect(shouldWrite(golden, now), JSON.stringify(now)).toBe(true);
    for (const now of [v(16, 1, 3), v(17, 1, 2), v(18, 1, 2), v(16, 2, 3)]) expect(() => shouldWrite(golden, now), JSON.stringify(now)).toThrow(/newer/);
    expect(() => shouldWrite(golden, v(17, 1, 3, { terrain: 'mungyeong', scenario: 'base' }))).toThrow(/terrain/);
    expect(() => shouldWrite(golden, v(17, 1, 3, { terrain: 'mock', scenario: 'other' }))).toThrow(/scenario/);
    // The real land: data changed under the same 판 is not rewritten (⑤ goes red instead); only a higher 판 rewrites.
    const g = v(17, 2, 1, { terrain: 'mungyeong', scenario: 'base-mungyeong' });
    expect(shouldWrite(g, v(17, 2, 1, { terrain: 'mungyeong', scenario: 'base-mungyeong' }))).toBe(false);
    expect(shouldWrite(g, v(17, 3, 1, { terrain: 'mungyeong', scenario: 'base-mungyeong' }))).toBe(true);
    expect(() => shouldWrite(g, v(17, 1, 1, { terrain: 'mungyeong', scenario: 'base-mungyeong' }))).toThrow(/newer/);
    expect(() => shouldWrite(g, v(17, 2, 1, { terrain: 'mock', scenario: 'base-mungyeong' }))).toThrow(/terrain/);
    const header = readGolden('0-empty.json').replay;
    expect(headerVersions(header)).toEqual({ simVersion: header.simVersion, terrain: { id: 'mock', version: 1 }, scenario: header.scenario });
  });

  test('골든: 다시 만드는 조건 — 재생하고 쓰는 머리는 코드의 버전이다', () => {
    const mock = { id: 'mock', version: 1 };
    const now: Versions = { simVersion: SIM_VERSION, terrain: mock, scenario: { id: BASE_SCENARIO.id, version: BASE_SCENARIO.version } };
    const mocks = SCRIPTS.filter((s) => !s.replay.terrain);
    for (const { file, replay: d } of mocks) expect(currentHeader(d, now), file).toEqual(d); // versions unchanged: as is
    // A version rise: ④ pins simVersion 17 and base@1, every mock script leaves terrain out (mock).
    const risen: Versions = { simVersion: 99, terrain: mock, scenario: { id: 'base', version: 9 } };
    for (const { file, replay: d } of mocks) {
      const h = currentHeader(d, risen);
      expect(h, file).toEqual({ ...d, simVersion: 99, scenario: { id: 'base', version: 9 } });
      expect(Object.hasOwn(h, 'terrain'), file).toBe(false); // mock is never written
      expect(validateReplay(h).ok, file).toBe(true);
      expect(shouldWrite(headerVersions(d), headerVersions(h)), file).toBe(true);
    }
    // A non-mock terrain carries the code's terrain version.
    const d = { ...SCRIPTS[0]!.replay, terrain: { id: 'mungyeong', version: 1 } };
    expect(currentHeader(d, { ...now, terrain: { id: 'mungyeong', version: 2 } }).terrain).toEqual({ id: 'mungyeong', version: 2 });
    // Ids are not rewritten.
    expect(() => currentHeader(d, now)).toThrow(/terrain/);
    expect(() => currentHeader(SCRIPTS[4]!.replay, { ...now, scenario: { id: 'other', version: 1 } })).toThrow(/scenario/);
    // ⑤ names the 문경 land: as is at its own versions, the code's 판 after a rise, never a mock header.
    const five = SCRIPTS.find((s) => s.file === FIVE)!.replay;
    const own = headerVersions(five);
    expect(own.terrain).toEqual({ id: 'mungyeong', version: 2 });
    expect(currentHeader(five, own)).toEqual(five);
    const raised = currentHeader(five, { ...own, terrain: { id: 'mungyeong', version: 3 } });
    expect(raised.terrain).toEqual({ id: 'mungyeong', version: 3 });
    expect(validateReplay(raised).ok).toBe(true);
    expect(() => currentHeader(five, now)).toThrow(/terrain/);
  });
});
