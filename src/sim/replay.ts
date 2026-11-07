import { Hasher } from './hash';
import { validInput } from './inputs';
import { createSim } from './sim';
import type { TerrainData } from './terrain';
import type { ReplayData, ReplayResult, Scenario } from './types';
import { SIM_VERSION } from './version';

export const CHECKPOINT_TICKS = 200;
const INT32_MAX = 0x7fffffff;

const HEADER_KEYS = ['format', 'simVersion', 'seed', 'seedKind', 'scenario', 'guns', 'weather', 'mode', 'stepMs', 'inputs', 'totalTicks'];
const WEATHER_RANGES: readonly [key: string, min: number, max: number][] = [
  ['visibilityM', 0, Infinity],
  ['cloudPct', 0, 100],
  ['windFromDeg', 0, 359],
  ['windSpeedTenthMs', 0, Infinity],
  ['tempTenthC', -Infinity, Infinity],
  ['precipTenthMmH', 0, Infinity],
  ['pressureHpa', 0, Infinity],
  ['humidityPct', 0, 100],
];
const WEATHER_KEYS = WEATHER_RANGES.map(([k]) => k);

class FormatError extends Error {}

const fail = (msg: string): never => {
  throw new FormatError(msg);
};
const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const int = (x: unknown, min: number, max: number, what: string): void => {
  if (!Number.isInteger(x) || (x as number) < min || (x as number) > max) fail(`${what}: integer in ${min}..${max} expected`);
};
const keysExactly = (x: Record<string, unknown>, keys: readonly string[], what: string, optional: readonly string[] = []): void => {
  // Order-free: every expected key is an own key, and nothing else is there.
  for (const k of keys) if (!Object.hasOwn(x, k)) fail(`${what}: missing ${k}`);
  const present = keys.length + optional.filter((k) => Object.hasOwn(x, k)).length;
  if (Object.keys(x).length !== present) fail(`${what}: unknown key`);
};
const ref = (x: unknown, what: string): void => {
  if (!isObject(x)) return fail(`${what}: object expected`);
  keysExactly(x, ['id', 'version'], what);
  if (typeof x.id !== 'string' || !/^[a-z0-9_]+$/.test(x.id)) fail(`${what}.id: ASCII identifier expected`);
  int(x.version, 1, INT32_MAX, `${what}.version`);
};

function check(x: unknown): asserts x is ReplayData {
  if (!isObject(x)) return fail('replay data: object expected');
  keysExactly(x, HEADER_KEYS, 'header');
  if (x.format !== 1) fail('format: 1 expected');
  int(x.simVersion, 1, INT32_MAX, 'simVersion');
  int(x.seed, 0, INT32_MAX, 'seed');
  if (x.seedKind !== 'daily' && x.seedKind !== 'practice') fail('seedKind: daily | practice expected');
  ref(x.scenario, 'scenario');
  ref(x.guns, 'guns');
  const w = x.weather;
  if (!isObject(w)) return fail('weather: object expected');
  keysExactly(w, WEATHER_KEYS, 'weather');
  for (const [k, min, max] of WEATHER_RANGES) int(w[k], min, max, `weather.${k}`);
  if (x.mode !== 'training' && x.mode !== 'standard') fail('mode: training | standard expected');
  if (x.stepMs !== 50) fail('stepMs: 50 expected');
  int(x.totalTicks, 0, INT32_MAX, 'totalTicks');
  if (!Array.isArray(x.inputs)) return fail('inputs: array expected');
  let last = 0;
  x.inputs.forEach((input: unknown, i) => {
    const what = `inputs[${i}]`;
    if (!isObject(input)) return fail(`${what}: object expected`);
    keysExactly(input, ['t', 'a'], what, ['v']);
    int(input.t, last, (x.totalTicks as number) - 1, `${what}: tick (not decreasing, below totalTicks)`);
    last = input.t as number;
    if (typeof input.a !== 'string' || !/^[a-z_]+$/.test(input.a)) fail(`${what}.a: ASCII kind expected`);
    if ('v' in input && !Array.isArray(input.v)) fail(`${what}.v: array expected`); // each value is checked by its kind
    if (!validInput(input.a as string, input.v)) fail(`${what}: unknown kind or bad value`);
  });
}

/** 재생 자료 형식 검사, including each input's kind and values. */
export function validateReplay(x: unknown): { ok: true; data: ReplayData } | { ok: false; error: string } {
  try {
    check(x);
    return { ok: true, data: x };
  } catch (e) {
    if (e instanceof FormatError) return { ok: false, error: e.message };
    throw e;
  }
}

/** 재생기: a pure test tool. Records of another simVersion are not replayed. The caller regenerates the terrain from the
 * seed and passes the scenario the header names. Every replayed tick must advance: all 작전 준비 inputs and `start` sit
 * at t 0, and a game that ends (its clock stops) ends the record at that tick. */
export function replay(d: ReplayData, terrain: TerrainData, scenario: Scenario): ReplayResult {
  if (d.simVersion !== SIM_VERSION) throw new Error(`simVersion ${d.simVersion} is not this code's ${SIM_VERSION}`);
  if (scenario.id !== d.scenario.id || scenario.version !== d.scenario.version)
    throw new Error(`scenario ${scenario.id}@${scenario.version} is not the header's ${d.scenario.id}@${d.scenario.version}`);
  const sim = createSim({ ...d, scenario, terrain });
  const chain = new Hasher();
  const checkpoints: ReplayResult['checkpoints'] = [];
  let ignored = 0;
  let i = 0;
  for (let t = 0; t < d.totalTicks; t++) {
    const start = i;
    while (i < d.inputs.length && d.inputs[i]!.t === t) i++;
    for (const ok of sim.step(d.inputs.slice(start, i)).accepted) if (!ok) ignored++;
    if (sim.state.tick !== t + 1) throw new Error(`replay: game not started at tick 0 (tick ${t} did not advance)`);
    const hash = sim.hash();
    chain.u32(parseInt(hash.slice(0, 8), 16));
    chain.u32(parseInt(hash.slice(8), 16));
    if (sim.state.tick % CHECKPOINT_TICKS === 0) checkpoints.push({ tick: sim.state.tick, hash });
    // An ended game's clock stops: there is no tick past its terminal one, so the record must end there (총 틱 초과).
    if (sim.state.phase === 'ended' && t + 1 < d.totalTicks)
      throw new Error(`replay: the game ended at tick ${t + 1}, before totalTicks ${d.totalTicks}`);
  }
  return { record: sim.record(), ignored, chain: chain.hex(), checkpoints };
}
