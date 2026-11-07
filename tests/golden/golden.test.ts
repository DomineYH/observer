import { describe, expect, test } from 'vitest';
import { createSim, fromGrid, replay, SIM_VERSION, terrainHash, validateReplay, type SimEvent } from '@sim';
import { generateTerrain } from '@adapters/mock/terrain';
import { BASE_SCENARIO } from '@content/scenario';
import { goldenFiles, readGolden } from './golden';

describe('골든', () => {
  test('골든: simVersion이 코드와 같다', () => {
    const files = goldenFiles();
    expect(files).toContain('0-empty.json');
    for (const f of files) expect(readGolden(f).replay.simVersion, f).toBe(SIM_VERSION);
  });

  test('골든: 0번 개시만 한 빈 판', () => {
    const { terrainHash: header, replay: data, ...expected } = readGolden('0-empty.json');
    expect(validateReplay(data).ok).toBe(true);
    expect(expected.checkpoints.map((c) => c.tick)).toEqual([200, 400]);
    const terrain = generateTerrain(data.seed);
    expect(terrainHash(terrain)).toBe(header);
    expect(replay(data, terrain, BASE_SCENARIO)).toEqual(expected);
  });

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
    // The script does what it says, read off its record: the limit ended it, no round was fired, the 관측반 lived.
    expect(result.record).toMatchObject({ ticks: 48000, roundsTotal: 0, missions: 0, observerLost: false, cleared: false, clearTick: null });
    expect(result.checkpoints.at(-1)!.tick).toBe(48000);
  }, 60000); // one replay hashing every tick (~10 s alone)
});

