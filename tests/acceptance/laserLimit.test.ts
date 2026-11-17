// 레이저 한도 (M3-11, #122): a combat game takes five lases, 반사 없음 included, and ignores every one after them; 훈련·표준
// count nothing. Public interface only: create, step, read-only state, hash.
import { expect, test } from 'vitest';
import { createSim, type Input, type Mode, type Sim } from '@sim';
import { angleTo, mortarAt } from './enemy';
import { combatInit, init, START } from './init';
import { MOVE } from './mission';

const SCENARIO = mortarAt({ x: 320, y: 1020 }); // a mortar section's crew 700 m north of the flat-terrain post, seen by eye
const LASE = (az: number, el: number): Input => ({ a: 'lase', v: [Math.round(az + 64000) % 64000, Math.round(el)] });
const SKY = LASE(32000, 50); // south, 5 mils up: nothing to reflect

function game(mode: Mode): Sim {
  const sim = createSim({ ...(mode === 'combat' ? combatInit(7) : { ...init(7), mode }), scenario: SCENARIO });
  sim.step([START]);
  return sim;
}
/** Six lases sent the same in every mode: four at a man of the crew, one into the sky, and a sixth at the man. */
function script(): Input[] {
  const sim = game('standard');
  const man = sim.state.platoons[0]!.members.find((m) => m.kind === 'man' && m.vis)!;
  const at = angleTo(sim, man);
  const aim = LASE(at.az, at.el);
  return [aim, aim, SKY, aim, aim, aim];
}
const lase = (sim: Sim, inputs: Input[]) => inputs.map((i) => sim.step([i]).accepted[0]);

test('실전: 레이저 거리측정 — 한 판에 다섯 번까지 받아들여지고 그 뒤의 레이저는 무시된다', () => {
  const six = script();
  const combat = game('combat');
  const twin = game('combat');
  expect(lase(combat, six.slice(0, 5))).toEqual([true, true, true, true, true]);
  lase(twin, six.slice(0, 5));
  expect(combat.state.combat!.lasesUsed).toBe(5);
  expect(combat.state.lases.filter((l) => l.range === null)).toHaveLength(1); // 반사 없음 counted too
  expect(combat.state.lases.filter((l) => l.range?.target)).toHaveLength(4);

  // The sixth, at the man: nothing happens. Its twin steps without it.
  const before = { lases: structuredClone(combat.state.lases), las: combat.state.rng.las.count };
  expect(combat.step([six[5]!]).accepted).toEqual([false]);
  twin.step([]);
  expect(combat.state.lases).toEqual(before.lases);
  expect(combat.state.combat!.lasesUsed).toBe(5);
  expect(combat.state.rng.las.count).toBe(before.las);
  expect(combat.hash()).toBe(twin.hash());
  expect(combat.step([six[5]!]).accepted).toEqual([false]); // and no way back

  // The five measured as a standard game measures them, the same seed and aim.
  const standard = game('standard');
  lase(standard, six.slice(0, 5));
  expect(combat.state.lases).toEqual(standard.state.lases);
  expect(combat.state.rng.las.count).toBe(standard.state.rng.las.count);
  expect(combat.state.rng.las.count).toBe(8); // two draws for each of the four that met the man

  // While the post moves or sets up, a lase is ignored and not counted.
  const moving = game('combat');
  expect(moving.step([MOVE(440, 320)]).accepted).toEqual([true]);
  expect(moving.step([SKY]).accepted).toEqual([false]);
  for (let k = 0; k < 20000 && moving.state.post.state !== 'setup'; k++) moving.step([]);
  expect(moving.state.post.state).toBe('setup');
  expect(moving.step([SKY]).accepted).toEqual([false]);
  expect(moving.state.combat!.lasesUsed).toBe(0);
  for (let k = 0; k < 20000 && moving.state.post.state !== 'ready'; k++) moving.step([]);
  expect(moving.step([SKY]).accepted).toEqual([true]);
  expect(moving.state.combat!.lasesUsed).toBe(1);
});

test('실전: 레이저 한도 — 훈련·표준에서는 세지 않고 여섯째 레이저도 받아들여진다', () => {
  const six = script();
  for (const mode of ['standard', 'training'] as const) {
    const sim = game(mode);
    expect(lase(sim, six), mode).toEqual([true, true, true, true, true, true]);
    expect(sim.state.combat, mode).toBeNull();
    expect(sim.state.rng.las.count, mode).toBe(10); // two draws for each of the five that met the man, as before
    expect(sim.state.lases.map((l) => l.range?.target ?? null), mode).toEqual([true, true, true, null, true]); // newest first
  }
});
