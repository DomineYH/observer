// 기상 (F-17, F-26): the weather changes detection, the ballistics and the replay, through the public interface only.
import { expect, test } from 'vitest';
import { CHECKPOINT_TICKS, createSim, replay, validateReplay, type RecordedInput, type Sim, type Weather } from '@sim';
import { CLEAR_WEATHER, presetWeather } from '@adapters/mock/weather';
import { BASE_SCENARIO } from '@content/scenario';
import { atmosphere } from '@render/shade';
import { mortarAt, started } from './enemy';
import { init, replayData, START } from './init';
import { NO_TROOPS, openRadio, started as startedEmpty, toReady, untilImpact } from './mission';
import { flatTerrain } from './terrain';

const BINO_ON = { a: 'bino', v: [1] };
/** Whether the mortar crew (1.7 m, standing) is seen through the binoculars. */
const crewSeen = (sim: Sim) => {
  sim.step([BINO_ON]);
  return [...new Set(sim.state.platoons[0]!.members.filter((m) => m.kind === 'man').map((m) => m.vis))];
};

test('F-17: 시정과 탐지', () => {
  // 안개 (시정 2.5 km): Koschmieder's opacity 1 − exp(−3.912 d / 2500) passes 0.9 at d ≈ 1,471 m.
  const fog = presetWeather('fog');
  expect(crewSeen(started(mortarAt({ x: 320, y: 1720 }), { weather: fog }))).toEqual([true]); // 1,400–1,410 m
  expect(crewSeen(started(mortarAt({ x: 320, y: 1870 }), { weather: fog }))).toEqual([false]); // 1,550–1,560 m
  // The same crew is seen in clear weather: the visibility hid it, not its size.
  expect(crewSeen(started(mortarAt({ x: 320, y: 1870 }), { weather: presetWeather('clear') }))).toEqual([true]);
  // The view's fog thins with the same visibility: 2% contrast at 2.5 km.
  expect(atmosphere(fog).sigma * 2500).toBeCloseTo(3.912, 12);
});

/** The first mission's bias and its first round's impact, called by grid in `weather` (same seed: same draws). */
function firstRound(weather: Weather) {
  const sim = startedEmpty(7, NO_TROOPS, weather);
  openRadio(sim);
  toReady(sim);
  const { impact } = untilImpact(sim);
  return { bias: sim.state.missions[0]!.bias, impact };
}

test('F-17: 탄도 잔차', () => {
  // Calm at the standard 15 °C leaves only the random 비표준 조건 오차; 6 m per m/s downwind and 1.2 m per °C along the
  // battery → 고정점 (5000, 5500) line come on top of it, cold falling short (demo line 698).
  const calm = { ...CLEAR_WEATHER, windSpeedTenthMs: 0, tempTenthC: 150 };
  const base = firstRound(calm);
  const delta = (w: Weather) => {
    const r = firstRound({ ...calm, ...w });
    return { bias: [r.bias.x - base.bias.x, r.bias.y - base.bias.y], impact: [r.impact.x - base.impact.x, r.impact.y - base.impact.y] };
  };
  const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 6));

  // 10 m/s from the west blows the rounds 60 m east; the impact moves with the bias.
  const west = delta({ ...calm, windFromDeg: 270, windSpeedTenthMs: 100 });
  close(west.bias, [60, 0]);
  close(west.impact, [60, 0]);
  // From the north: 60 m south.
  close(delta({ ...calm, windFromDeg: 0, windSpeedTenthMs: 100 }).impact, [0, -60]);
  // 5 °C, 10 below standard: 12 m short, back towards the battery along the line to the 고정점.
  const fx = 5000 - BASE_SCENARIO.battery.x;
  const fy = 5500 - BASE_SCENARIO.battery.y;
  const f = Math.hypot(fx, fy);
  const cold = delta({ ...calm, tempTenthC: 50 });
  close(cold.bias, [(-12 * fx) / f, (-12 * fy) / f]);
  close(cold.impact, cold.bias);
  // 25 °C: 12 m beyond.
  close(delta({ ...calm, tempTenthC: 250 }).impact, [(12 * fx) / f, (12 * fy) / f]);
});

/** `sim` stepped through the assembly's rule: only accepted inputs go into the 입력 기록. */
function recorded(sim: Sim): { sim: Sim; inputs: RecordedInput[] } {
  const inputs: RecordedInput[] = [];
  const step: Sim['step'] = (batch) => {
    const t = sim.state.tick;
    const r = sim.step(batch);
    batch.forEach((input, i) => r.accepted[i] && inputs.push({ t, ...input }));
    return r;
  };
  return { sim: { ...sim, step }, inputs };
}

test('F-26: 재생 자료의 기상 값', () => {
  const seed = 20261106;
  const rain = presetWeather('rain');
  const live = recorded(createSim({ ...init(seed), scenario: NO_TROOPS, weather: rain }));
  live.sim.step([START]);
  openRadio(live.sim);
  toReady(live.sim);
  untilImpact(live.sim);
  while (live.sim.state.tick % CHECKPOINT_TICKS !== 0) live.sim.step([]);
  const ticks = live.sim.state.tick;

  // The header carries the whole weather value, every field an integer in spec units.
  const data = replayData(live.inputs, ticks, seed, rain);
  expect(Object.keys(data.weather).sort()).toEqual(['cloudPct', 'humidityPct', 'precipTenthMmH', 'pressureHpa', 'tempTenthC', 'visibilityM', 'windFromDeg', 'windSpeedTenthMs']);
  for (const v of Object.values(data.weather)) expect(Number.isInteger(v)).toBe(true);
  expect(validateReplay(JSON.parse(JSON.stringify(data))).ok).toBe(true);
  expect(validateReplay({ ...data, weather: { ...rain, precipTenthMmH: 2.4 } }).ok).toBe(false);

  // That header alone replays the same game: same 판 기록, no ignored input, the live state hash at the last checkpoint.
  const again = replay(data, flatTerrain(), NO_TROOPS);
  expect(again.ignored).toBe(0);
  expect(again.record).toEqual(live.sim.record());
  expect(again.checkpoints.at(-1)).toEqual({ tick: ticks, hash: live.sim.hash() });
  // The header's weather is what the replay uses: the same inputs under another weather give another game.
  expect(replay(replayData(live.inputs, ticks, seed, presetWeather('wind')), flatTerrain(), NO_TROOPS).chain).not.toBe(again.chain);
});
