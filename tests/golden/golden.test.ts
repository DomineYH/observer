import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { createSim, fromGrid, replay, SIM_VERSION, terrainHash, toGrid, validateReplay, type ReplayData, type SimEvent } from '@sim';
import { generateTerrain } from '@adapters/mock/terrain';
import { unpackTerrain } from '@adapters/terrainFile/unpack';
import { COMBAT } from '@content/combat';
import { BASE_GUNS } from '@content/guns';
import { contentOf, PLACEMENTS } from '@content/lookup';
import { BASE } from '@content/scenarios/base';
import { BASE_SCENARIO } from '@content/scenarios/base';
import { BASE_MUNGYEONG } from '@content/scenarios/base-mungyeong';
import { dailyScenario } from '../../src/app/seed';
import { currentHeader, goldenFiles, headerVersions, readGolden, shouldWrite, type Versions } from './golden';
import { landOf, REAL_TERRAIN_FILE } from './land';
import { SCRIPTS } from './scripts';

const FIVE = '5-real-laser-move.json';
const COMBAT_FILE = '8-combat.json';

// M3 keeps these seven as they are (#126): name → SHA-256 of the file parsed and written again (values count, line
// endings and indentation do not). A SIM_VERSION rise after the M3 gate rewrites this table in the same PR.
const LOCKED: Record<string, string> = {
  '0-empty.json': '38039a20051b389b2461ffbbc309b5e0faf0e2be0d181ea30a4c8eb5cac2a0f3',
  '1-grid-eom.json': '7b233b36cd280d2812e29dfe4e91137266ee1f703473fcf3c30a3887ca4c5b06',
  '2-polar-move.json': '6f4923dced5be4acf04a0228502c2120dbdac97e86aeac2bbbc842e5a3ff7ef7',
  '3-time-limit.json': '3236599cd8d8d816a5ca5b5c1a5a5b4101f9151e163c9a2ba66f52cfd48a9c0c',
  '4-desktop-play.json': 'df01781ffa925cdef8a8382fc10f5de2dac4d0e320634260cddae444b40a247a',
  '5-real-laser-move.json': '4203b07992ed75b7ab01c0c20377bf0c29e9f00ccb6b609219f683351870fa88',
  '6-real-play.json': '3d40b282ccc41ef176d123c2284de5dd82183f4debb15cba1582f862bcc213a9',
};

describe('골든', () => {
  test('골든: 일곱 골든은 그대로다', () => {
    const sha = (f: string) => createHash('sha256').update(JSON.stringify(readGolden(f))).digest('hex');
    expect(Object.fromEntries(Object.keys(LOCKED).map((f) => [f, sha(f)]))).toEqual(LOCKED);
  });

  // Checks all five header versions (simVersion, 지형 판, 시나리오 버전, 포 프로파일 버전, 실전 자료 판 in a combat golden) against the code and the land's data.
  test('골든: simVersion이 코드와 같다', async () => {
    const files = goldenFiles();
    expect(files).toContain('0-empty.json');
    expect(files).toContain(FIVE);
    const real = await unpackTerrain(new Uint8Array(readFileSync(REAL_TERRAIN_FILE)));
    const ref = (r: { id: string; version: number }) => ({ id: r.id, version: r.version });
    for (const f of files) {
      const d = readGolden(f).replay;
      const found = contentOf(d);
      const [terrain, scenario, guns] = [d.terrain ? ref(real) : BASE.terrain, ref(found.scenario), ref(found.guns)];
      expect(headerVersions(d), f).toEqual({ simVersion: SIM_VERSION, terrain, scenario, guns, combat: found.combat?.version });
    }
  }, 30000); // reads every golden file

  // What the server will check (#126 2 and 3) holds for every daily golden: no game our app makes breaks it.
  test('골든: 일일 판의 머리는 그 날짜의 일일 시나리오다', () => {
    const daily = goldenFiles().filter((f) => readGolden(f).replay.seedKind === 'daily');
    expect(daily.length).toBeGreaterThanOrEqual(7);
    for (const f of daily) {
      const d = readGolden(f).replay;
      const { scenario } = dailyScenario(d.seed, d.terrain?.id ?? 'mock', PLACEMENTS);
      expect(d.scenario, f).toEqual({ id: scenario.id, version: scenario.version });
    }
  });

  test('골든: 일일 판은 기본 포이고 머리의 모드와 판 기록의 모드가 맞는다', () => {
    for (const f of goldenFiles().filter((f) => readGolden(f).replay.seedKind === 'daily')) {
      const { replay: d, record } = readGolden(f);
      expect(d.guns, f).toEqual({ id: BASE_GUNS.id, version: BASE_GUNS.version });
      // 실전 on both sides or on neither; otherwise the record says training once training was used (record.ts).
      expect(record.mode === 'combat', f).toBe(d.mode === 'combat');
      if (d.mode !== 'combat') expect(['training', 'standard'], f).toContain(record.mode);
      if (!d.inputs.some((i) => i.a === 'mode')) expect(record.mode, f).toBe(d.mode); // a game never switched keeps its first mode
    }
  });

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
    expect(replay(data, terrain, BASE_SCENARIO, BASE_GUNS)).toEqual(expected);
  }, 30000); // terrain generation and a replay (~2 s alone): vitest's 5 s default is hit under load

  test('골든: ① 좌표법 조정에서 임무끝까지', () => {
    const { terrainHash: header, replay: data, ...expected } = readGolden('1-grid-eom.json');
    expect(validateReplay(data).ok).toBe(true);
    expect(expected.ignored).toBe(0); // every scripted transmission was taken
    const terrain = generateTerrain(data.seed);
    expect(terrainHash(terrain)).toBe(header);
    expect(replay(data, terrain, BASE_SCENARIO, BASE_GUNS)).toEqual(expected);
    // The script does what it says: a 접근신관 효력사 lands and the mission ends with 임무끝.
    const sim = createSim({ ...data, scenario: BASE_SCENARIO, guns: BASE_GUNS, terrain });
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
    expect(replay(data, terrain, BASE_SCENARIO, BASE_GUNS)).toEqual(expected);
    // The script does what it says.
    const sim = createSim({ ...data, scenario: BASE_SCENARIO, guns: BASE_GUNS, terrain });
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
    const result = replay(data, terrain, BASE_SCENARIO, BASE_GUNS);
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
    const result = replay(data, terrain, BASE_SCENARIO, BASE_GUNS);
    expect(result).toEqual(expected);
    // The game is what scripts.ts says: standard mode, three missions, ended by the 40분 한도.
    expect(result.record).toMatchObject({ ticks: 48000, missions: 3, mode: 'standard' });
    expect(result.checkpoints.at(-1)!.tick).toBe(48000);
  }, 60000); // one replay hashing every tick (~10 s alone)

  test('골든: ⑤ 실제 지형의 레이저·효력사·이동', async () => {
    const { terrainHash: header, replay: data, ...expected } = readGolden(FIVE);
    expect(validateReplay(data).ok).toBe(true);
    expect(expected.ignored).toBe(0);
    expect(data.terrain).toEqual(BASE_MUNGYEONG.terrain);
    expect(data.mode).toBe('standard');
    expect(data.totalTicks).toBeLessThanOrEqual(12000);
    const { terrain, scenario, guns } = await landOf(data); // the committed 지형 파일: missing → ENOENT, never a skip
    expect(terrainHash(terrain)).toBe(header);
    expect(replay(data, terrain, scenario, guns)).toEqual(expected);
    // The script does what it says: a lase answers, the 효력사 lands, the post moves and 기러기 is told where.
    const sim = createSim({ ...data, scenario, guns, terrain });
    const events: SimEvent[] = [];
    const impacts: number[] = [];
    for (let t = 0; t < data.totalTicks; t++)
      for (const e of sim.step(data.inputs.filter((i) => i.t === t)).events) {
        events.push(e);
        if (e.type === 'impact') impacts.push(t);
      }
    const said = (speaker: string, kind: string) => events.some((e) => e.type === 'radio' && e.utterance.speaker === speaker && e.utterance.kind === kind);
    const at = (a: string) => data.inputs.find((i) => i.a === a)!;
    expect(sim.state.lases.map((l) => l.range?.dist)).toEqual([at('loc').v?.[2]]); // the polar request uses the lase's answer
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

  test('골든: ⑥ 실제 지형의 사람 플레이', async () => {
    const { terrainHash: header, replay: data, ...expected } = readGolden('6-real-play.json');
    expect(validateReplay(data).ok).toBe(true);
    expect(expected.ignored).toBe(0); // every recorded input was taken
    expect(data.terrain).toEqual(BASE_MUNGYEONG.terrain);
    expect(data.scenario).toEqual({ id: BASE_MUNGYEONG.scenario.id, version: 2 });
    const { terrain, scenario, guns } = await landOf(data); // the committed 지형 파일: missing → ENOENT, never a skip
    expect(terrainHash(terrain)).toBe(header);
    const result = replay(data, terrain, scenario, guns);
    expect(result).toEqual(expected);
    // The game is what scripts.ts says: standard mode, three missions, over before the 40분 한도 (48 000 ticks). The
    // 관측반 lived, so every combat unit was down (end.ts); one by 진지 돌파, which withholds 섬멸 (not cleared).
    expect(result.record).toMatchObject({ ticks: 29366, missions: 3, mode: 'standard', observerLost: false, cleared: false });
    expect(result.record.ticks).toBeLessThan(48000);
  }, 60000); // one replay hashing every tick (~6 s alone)

  test('골든: 장갑차 선두', async () => {
    const { terrainHash: header, replay: data, ...expected } = readGolden('7-apc-grid-eom.json');
    expect(validateReplay(data).ok).toBe(true);
    expect(expected.ignored).toBe(0); // every scripted transmission was taken
    expect(data).toMatchObject({ scenario: { id: 'apc-mungyeong', version: 1 }, terrain: { id: 'mungyeong', version: 2 }, guns: { id: 'base', version: 1 } });
    expect(data).toMatchObject({ mode: 'standard', seedKind: 'practice', seed: 20261106 });
    expect(data.totalTicks).toBeLessThanOrEqual(8000);
    const { terrain, scenario, guns } = await landOf(data);
    expect(terrainHash(terrain)).toBe(header);
    expect(replay(data, terrain, scenario, guns)).toEqual(expected);
    // The script does what it says: a 효력사 lands after the one correction and the mission ends with 임무끝.
    const sim = createSim({ ...data, scenario, guns, terrain });
    const events: SimEvent[] = [];
    const impacts: number[] = [];
    for (let t = 0; t < data.totalTicks; t++)
      for (const e of sim.step(data.inputs.filter((i) => i.t === t)).events) {
        events.push(e);
        if (e.type === 'impact') impacts.push(t);
      }
    const corr = data.inputs.find((i) => i.a === 'corr')!;
    expect(corr.v?.at(-1)).toBe('ffe');
    expect(impacts.some((t) => t > corr.t)).toBe(true);
    expect(events.some((e) => e.type === 'radio' && e.utterance.kind === 'end_of_mission')).toBe(true);
    expect(sim.record()).toMatchObject({ missions: 1, mode: 'standard' });
  }, 60000); // two runs of under 8 000 ticks on the 문경 land

  test('골든: 포 넷의 같은 각본', async () => {
    const files = ['guns-kh178.json', 'guns-kh179.json', 'guns-k55.json', 'guns-k9.json'];
    const goldens = files.map(readGolden);
    const head = goldens[0]!.replay;
    const results: Record<string, unknown> = {};
    for (const [i, { terrainHash: header, replay: data, ...expected }] of goldens.entries()) {
      const f = files[i]!;
      expect(validateReplay(data).ok, f).toBe(true);
      expect(data.guns, f).toEqual({ id: f.slice(5, -5), version: 1 });
      expect({ ...data, guns: undefined }, f).toEqual({ ...head, guns: undefined }); // the header's guns alone differs
      expect(data).toMatchObject({ seed: 20261106, seedKind: 'practice', mode: 'standard', scenario: { id: 'base' } });
      expect(data.terrain, f).toBeUndefined(); // the mock land
      expect(data.totalTicks, f).toBeLessThanOrEqual(3500);
      expect(expected.ignored, f).toBe(0); // every input taken, on the slowest gun too
      const { terrain, scenario, guns } = await landOf(data);
      expect(terrainHash(terrain), f).toBe(header);
      const result = replay(data, terrain, scenario, guns);
      expect(result, f).toEqual(expected);
      expect(result.record, f).toMatchObject({ missions: 1, mode: 'standard' }); // one 효력사 mission, through 임무끝
      expect(result.record.roundsTotal, f).toBeGreaterThan(0);
      results[data.guns.id] = result;
    }
    // The same script on the base gun, for comparison: its own header, the base profile.
    const d = goldens[0]!.replay;
    const { terrain } = await landOf(d);
    results.base = replay({ ...d, guns: { id: 'base', version: 1 } }, terrain, BASE_SCENARIO, BASE_GUNS);
    const chain = (id: string) => (results[id] as { chain: string }).chain;
    const differ = ['base', 'kh178', 'kh179', 'k9'];
    expect(new Set(differ.map(chain)).size).toBe(differ.length); // KH178, KH179 and K9 differ from each other and from base
    expect(results.k55).toEqual(results.kh179); // KH179 and K55: the same ballistics, the same game
  }, 60000); // five replays of 3 400 ticks each and the mock land

  test('골든: 실전 각본', async () => {
    const { terrainHash: header, replay: data, ...expected } = readGolden(COMBAT_FILE);
    expect(validateReplay(data).ok).toBe(true);
    expect(expected.ignored).toBe(0); // every scripted input was taken: no lase past the 레이저 한도 is in the record
    expect(data).toMatchObject({ mode: 'combat', combatDataVersion: COMBAT.version, seedKind: 'daily', seed: 20261106 });
    expect(data).toMatchObject({ scenario: { id: BASE_SCENARIO.id }, guns: { id: BASE_GUNS.id } });
    expect(data.terrain).toBeUndefined(); // the mock land
    expect(data.totalTicks).toBeLessThanOrEqual(18000);
    const { terrain, scenario, guns, combat } = await landOf(data);
    expect(terrainHash(terrain)).toBe(header);
    const result = replay(data, terrain, scenario, guns, combat);
    expect(result).toEqual(expected);
    expect(result.record.mode).toBe('combat');
    expect(Object.keys(result.record)).toHaveLength(23);
    // The script does what it says, through the public interface.
    const sim = createSim({ ...data, scenario, guns, terrain, combat });
    const events: SimEvent[] = [];
    for (let t = 0; t < data.totalTicks; t++) events.push(...sim.step(data.inputs.filter((i) => i.t === t)).events);
    const said = (speaker: string, kind: string) => events.filter((e) => e.type === 'radio' && e.utterance.speaker === speaker && e.utterance.kind === kind);
    const notes = (what: string) => events.filter((e): e is Extract<SimEvent, { type: 'post' }> => e.type === 'post' && e.what === what);
    // 증원: the two reinforcement units stand past the scenario's own and have set off.
    const own = scenario.units.length;
    expect(sim.state.platoons).toHaveLength(own + scenario.reinforcements.length);
    expect(sim.state.platoons.slice(own).every((p) => p.state !== 'wait')).toBe(true);
    // 적 포병: the exposed post (the planned one) drew the barrage; the 관측반 had walked off and lived.
    const op = scenario.plannedOp;
    const barrage = notes('barrage') as unknown as { x: number; y: number }[];
    expect(barrage).toHaveLength(combat!.numbers.barrage.rounds);
    expect(barrage.every((b) => Math.hypot(b.x - op.x, b.y - op.y) < 150)).toBe(true);
    expect(sim.state.observerLost).toBe(false);
    // 진지 변환: once, past the 체류 한도.
    expect(said('fdc', 'displacing')).toHaveLength(1);
    // 복창: all three kinds taken; one wrong 사격지휘통보 readback drew 기러기's 정정.
    for (const kind of ['mto', 'shot', 'rounds_complete']) expect(said('observer', kind).length, kind).toBeGreaterThan(0);
    const rbs = data.inputs.filter((i) => i.a === 'readback');
    expect(new Set(rbs.map((i) => i.v![0]))).toEqual(new Set(['mto', 'shot', 'rounds_complete']));
    expect(said('fdc', 'mto_correction')).toHaveLength(1);
    // 레이저 한도: all five used; after the fifth a mission is opened by grid and the game goes on with no lase.
    expect(sim.state.combat).toEqual({ lasesUsed: combat!.numbers.laserLimit });
    const lases = data.inputs.flatMap((i, k) => (i.a === 'lase' ? [k] : []));
    expect(lases).toHaveLength(combat!.numbers.laserLimit);
    expect(data.inputs.slice(lases.at(-1)! + 1).some((i) => i.a === 'loc' && i.v![0] === 'grid')).toBe(true);
    const fifth = data.inputs[lases.at(-1)!]!.t;
    expect(events.some((e) => e.type === 'radio' && e.utterance.speaker === 'observer' && e.utterance.kind === 'location' && e.utterance.slots.method === 'grid' && e.tick > fifth)).toBe(true);
  }, 60000); // two runs of 18 000 ticks on the mock land

  test('골든: 다시 만드는 조건', () => {
    const v = (simVersion: number, terrain: number, scenario: number, ids: { terrain: string; scenario: string; guns?: string } = { terrain: 'mock', scenario: 'base' }, guns = 1): Versions => ({
      simVersion,
      terrain: { id: ids.terrain, version: terrain },
      scenario: { id: ids.scenario, version: scenario },
      guns: { id: ids.guns ?? 'base', version: guns },
    });
    const golden = v(17, 1, 3);
    expect(shouldWrite(null, golden)).toBe(true); // no file
    expect(shouldWrite(golden, v(17, 1, 3))).toBe(false); // all equal: skip
    for (const now of [v(18, 1, 3), v(17, 2, 3), v(17, 1, 4), v(18, 2, 3), v(17, 2, 4)]) expect(shouldWrite(golden, now), JSON.stringify(now)).toBe(true);
    for (const now of [v(16, 1, 3), v(17, 1, 2), v(18, 1, 2), v(16, 2, 3)]) expect(() => shouldWrite(golden, now), JSON.stringify(now)).toThrow(/newer/);
    expect(() => shouldWrite(golden, v(17, 1, 3, { terrain: 'mungyeong', scenario: 'base' }))).toThrow(/terrain/);
    expect(() => shouldWrite(golden, v(17, 1, 3, { terrain: 'mock', scenario: 'other' }))).toThrow(/scenario/);
    // 포 프로파일 버전: a higher one rewrites, a lower one throws, another id throws.
    expect(shouldWrite(golden, v(17, 1, 3, undefined, 2))).toBe(true);
    expect(shouldWrite(golden, v(18, 1, 3, undefined, 2))).toBe(true);
    expect(() => shouldWrite(v(17, 1, 3, undefined, 2), golden)).toThrow(/newer/);
    expect(() => shouldWrite(v(17, 1, 3, undefined, 2), v(18, 1, 3))).toThrow(/newer/); // one higher, one lower
    expect(() => shouldWrite(golden, v(17, 1, 3, { terrain: 'mock', scenario: 'base', guns: 'k9' }))).toThrow(/guns/);
    // The real land: data changed under the same 판 is not rewritten (⑤ goes red instead); only a higher 판 rewrites.
    const g = v(17, 2, 1, { terrain: 'mungyeong', scenario: 'base-mungyeong' });
    expect(shouldWrite(g, v(17, 2, 1, { terrain: 'mungyeong', scenario: 'base-mungyeong' }))).toBe(false);
    expect(shouldWrite(g, v(17, 3, 1, { terrain: 'mungyeong', scenario: 'base-mungyeong' }))).toBe(true);
    expect(() => shouldWrite(g, v(17, 1, 1, { terrain: 'mungyeong', scenario: 'base-mungyeong' }))).toThrow(/newer/);
    expect(() => shouldWrite(g, v(17, 2, 1, { terrain: 'mock', scenario: 'base-mungyeong' }))).toThrow(/terrain/);
    // 실전 자료 판: a combat golden carries it; a higher one rewrites, a lower one throws, on one side only throws.
    const c = (combat: number, simVersion = 17): Versions => ({ ...v(simVersion, 1, 3), combat });
    expect(shouldWrite(c(1), c(1))).toBe(false);
    expect(shouldWrite(c(1), c(2))).toBe(true);
    expect(shouldWrite(c(1), c(2, 18))).toBe(true);
    expect(() => shouldWrite(c(2), c(1))).toThrow(/newer/);
    expect(() => shouldWrite(c(2), c(1, 18))).toThrow(/newer/); // one higher, one lower
    expect(() => shouldWrite(golden, c(1))).toThrow(/combat/);
    expect(() => shouldWrite(c(1), golden)).toThrow(/combat/);
    const header = readGolden('0-empty.json').replay;
    expect(headerVersions(header)).toEqual({ simVersion: header.simVersion, terrain: { id: 'mock', version: 1 }, scenario: header.scenario, guns: header.guns });
  });

  test('골든: 다시 만드는 조건 — 재생하고 쓰는 머리는 코드의 버전이다', () => {
    const mock = { id: 'mock', version: 1 };
    const now: Versions = { simVersion: SIM_VERSION, terrain: mock, scenario: { id: BASE_SCENARIO.id, version: BASE_SCENARIO.version }, guns: { id: 'base', version: 1 } };
    const mocks = SCRIPTS.filter((s) => !s.replay.terrain);
    for (const { file, replay: d } of mocks) expect(currentHeader(d, { ...now, guns: d.guns, combat: d.combatDataVersion }), file).toEqual(d); // versions unchanged: as is
    // A version rise: ④ pins simVersion 17 and base@1, every mock script leaves terrain out (mock).
    const risen: Versions = { simVersion: 99, terrain: mock, scenario: { id: 'base', version: 9 }, guns: { id: 'base', version: 1 } };
    for (const { file, replay: d } of mocks) {
      const h = currentHeader(d, { ...risen, guns: d.guns, combat: d.combatDataVersion });
      expect(h, file).toEqual({ ...d, simVersion: 99, scenario: { id: 'base', version: 9 } });
      expect(Object.hasOwn(h, 'terrain'), file).toBe(false); // mock is never written
      expect(validateReplay(h).ok, file).toBe(true);
      expect(shouldWrite(headerVersions(d), headerVersions(h)), file).toBe(true);
    }
    // A non-mock terrain carries the code's terrain version.
    const d = { ...SCRIPTS[0]!.replay, terrain: { id: 'mungyeong', version: 1 } };
    expect(currentHeader(d, { ...now, terrain: { id: 'mungyeong', version: 2 } }).terrain).toEqual({ id: 'mungyeong', version: 2 });
    // The gun profile: the code's version is written, another id is refused.
    expect(currentHeader(SCRIPTS[0]!.replay, { ...now, guns: { id: 'base', version: 2 } }).guns).toEqual({ id: 'base', version: 2 });
    expect(() => currentHeader(SCRIPTS[0]!.replay, { ...now, guns: { id: 'k9', version: 1 } })).toThrow(/guns/);
    // A combat script: the code's 실전 자료 판 is written; a script and versions that disagree on combat are refused.
    const fight: ReplayData = { ...SCRIPTS[0]!.replay, mode: 'combat', combatDataVersion: 1 };
    expect(headerVersions(fight).combat).toBe(1);
    expect(currentHeader(fight, { ...now, combat: 2 }).combatDataVersion).toBe(2);
    expect(validateReplay(currentHeader(fight, { ...now, combat: 2 })).ok).toBe(true);
    expect(() => currentHeader(fight, now)).toThrow(/combat/);
    expect(() => currentHeader(SCRIPTS[0]!.replay, { ...now, combat: 1 })).toThrow(/combat/);
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
