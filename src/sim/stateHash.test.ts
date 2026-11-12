import { expect, test } from 'vitest';
import { CALL_ADJUST, CALL_FFE, LOC_CLEAR, MOVE, POLAR, SHIFT, answered, ended, openRadio, send, started } from '../../tests/acceptance/mission';
import { oneUnit, started as startedWith } from '../../tests/acceptance/enemy';
import { flatTerrain, mainRoad } from '../../tests/acceptance/terrain';
import { hashState } from './stateHash';
import type { SimState } from './types';

test('상태 해시: 극좌표 표적위치의 방법·방위각·거리가 해시에 든다', () => {
  // A real state with a polar 표적위치; copies that differ in that location alone must hash apart.
  const sim = started();
  openRadio(sim);
  send(sim, CALL_ADJUST);
  answered(sim, 'call');
  expect(send(sim, POLAR(800, 1000)).ok).toBe(true);
  const state = structuredClone(sim.state) as SimState;
  const base = hashState(state);
  const differs = (change: (l: { method: string; azimuth: number; distance: number }) => void) => {
    const s = structuredClone(state);
    change(s.missions[0]!.location as never);
    return hashState(s);
  };
  expect(hashState(structuredClone(state))).toBe(base);
  expect(differs((l) => (l.distance = 1100))).not.toBe(base);
  expect(differs((l) => (l.azimuth = 801))).not.toBe(base);
  // And no location at all is not the same as a polar one.
  const none = structuredClone(state);
  none.missions[0]!.location = null;
  expect(hashState(none)).not.toBe(base);
});

test('상태 해시: 전이 임무의 전이 슬롯이 해시에 든다', () => {
  // A real state just after a 전이; copies that differ in one 전이 slot alone must hash apart.
  const sim = started();
  openRadio(sim);
  ended(sim, CALL_FFE, LOC_CLEAR);
  expect(send(sim, SHIFT(800, 'right', 100, 'add', 200, 3, 0, 'infantry', 'moving', 'men', 12)).ok).toBe(true);
  const state = structuredClone(sim.state) as SimState;
  const base = hashState(state);
  const differs = (change: (t: Record<string, unknown>) => void) => {
    const s = structuredClone(state);
    change(s.missions[1]!.shift as never);
    return hashState(s);
  };
  expect(hashState(structuredClone(state))).toBe(base);
  const changes: [string, unknown][] = [['targetNumber', 1000], ['direction', 801], ['lateralDir', 'left'], ['lateral', 110],
    ['rangeDir', 'drop'], ['range', 250], ['rounds', 2], ['dangerClose', 1], ['targetType', 'apc'], ['activity', 'halted'],
    ['unit', 'vehicles'], ['count', 11]];
  for (const [k, value] of changes) expect(differs((t) => (t[k] = value)), k).not.toBe(base);
  const none = structuredClone(state);
  none.missions[1]!.shift = null;
  expect(hashState(none)).not.toBe(base);
});

test('상태 해시: 관측소 이동·위치 보고의 상태가 해시에 든다', () => {
  // A real state halfway through a walk, with a report sent before; each field changed alone must hash apart.
  const sim = started();
  openRadio(sim);
  expect(sim.step([MOVE(440, 400)]).accepted).toEqual([true]);
  for (let k = 0; k < 500; k++) sim.step([]);
  const state = structuredClone(sim.state) as SimState;
  state.posReport = { easting: 4040, northing: 3032 };
  const base = hashState(state);
  const differs = (change: (s: SimState) => void) => {
    const s = structuredClone(state);
    change(s);
    return hashState(s);
  };
  expect(hashState(structuredClone(state))).toBe(base);
  const changes: [string, (s: SimState) => void][] = [
    ['op.x fraction', (s) => (s.op.x += 0.25)],
    ['op.y fraction', (s) => (s.op.y -= 0.25)],
    ['post.state', (s) => (s.post.state = 'setup')],
    ['post.departed', (s) => s.post.departed++],
    ['post.until', (s) => s.post.until++],
    ['post.moves', (s) => s.post.moves++],
    ['move.to', (s) => s.post.move!.to.x++],
    ['move.pts.x', (s) => (s.post.move!.pts[3]!.x += 0.5)],
    ['move.pts.t', (s) => (s.post.move!.pts[3]!.t += 0.5)],
    ['move.pts length', (s) => s.post.move!.pts.pop()],
    ['move.total', (s) => (s.post.move!.total += 0.5)],
    ['move.dist', (s) => (s.post.move!.dist += 0.5)],
    ['move.forest', (s) => (s.post.move!.forest += 0.5)],
    ['move none', (s) => (s.post.move = null)],
    ['posReport.easting', (s) => s.posReport!.easting++],
    ['posReport.northing', (s) => s.posReport!.northing++],
    ['posReport none', (s) => (s.posReport = null)],
  ];
  for (const [k, change] of changes) expect(differs(change), k).not.toBe(base);
});

test('상태 해시: 발각·보복·관측반 손실이 해시에 든다', () => {
  const sim = startedWith(oneUnit({ type: 'inf', route: 'A', t0: 0 }, [{ x: 320, y: 700 }, { x: 320, y: 620 }]), { seed: 7 });
  while (sim.state.compromised < 0) sim.step([]);
  const state = structuredClone(sim.state) as SimState;
  expect(state.fire).not.toBeNull();
  const base = hashState(state);
  const differs = (change: (s: SimState) => void) => {
    const s = structuredClone(state);
    change(s);
    return hashState(s);
  };
  const changes: [string, (s: SimState) => void][] = [
    ['compromised', (s) => s.compromised++],
    ['fire.shooter', (s) => (s.fire!.shooter = 'mortar')],
    ['fire.at.x', (s) => (s.fire!.at.x += 0.5)],
    ['fire.at.y', (s) => (s.fire!.at.y += 0.5)],
    ['fire.pid', (s) => s.fire!.pid++],
    ['fire.fired', (s) => s.fire!.fired++],
    ['fire none', (s) => (s.fire = null)],
    ['observerLost', (s) => (s.observerLost = true)],
    ['phase ended', (s) => (s.phase = 'ended')],
  ];
  for (const [k, change] of changes) expect(differs(change), k).not.toBe(base);
});

test('상태 해시: 아군 병사·보급 트럭·아군 섬광이 해시에 든다', () => {
  const FRIEND = { x: 1280, y: 1200 };
  const terrain = { ...flatTerrain({ n: 256 }), roads: [mainRoad([]), mainRoad([{ x: 400, y: 400 }, { x: 400, y: 1400 }])] };
  const route = [{ x: 1280, y: 2700 }, { x: 1280, y: 1800 }, FRIEND];
  const sim = startedWith({ ...oneUnit({ type: 'inf', route: 'B', t0: 0 }, route), friends: [FRIEND], supplyRoad: 1 }, { seed: 7, terrain });
  while (!sim.state.effects.some((e) => e.tiny)) sim.step([]); // the enemy within 750 m: the men fire, the truck drives
  const state = structuredClone(sim.state) as SimState;
  const base = hashState(state);
  const differs = (change: (s: SimState) => void) => {
    const s = structuredClone(state);
    change(s);
    return hashState(s);
  };
  const man = (s: SimState) => s.friendlies[3]!;
  const truck = (s: SimState) => s.truck!;
  const changes: [string, (s: SimState) => void][] = [
    ['friendlies length', (s) => s.friendlies.pop()],
    ['man.pos', (s) => man(s).pos++],
    ['man.hx', (s) => (man(s).hx += 0.5)],
    ['man.hy', (s) => (man(s).hy += 0.5)],
    ['man.x', (s) => (man(s).x += 0.5)],
    ['man.y', (s) => (man(s).y += 0.5)],
    ['man.tx', (s) => (man(s).tx += 0.5)],
    ['man.ty', (s) => (man(s).ty += 0.5)],
    ['man.ph', (s) => (man(s).ph += 0.5)],
    ['man.walker', (s) => (man(s).walker = !man(s).walker)],
    ['man.wait', (s) => man(s).wait++],
    ['man.moving', (s) => (man(s).moving = !man(s).moving)],
    ['man.dir', (s) => (man(s).dir += 0.5)],
    ['man.prone', (s) => (man(s).prone = !man(s).prone)],
    ['man.alive', (s) => (man(s).alive = false)],
    ['man.vis', (s) => (man(s).vis = !man(s).vis)],
    ['man.nextFire', (s) => man(s).nextFire++],
    ['truck.path length', (s) => truck(s).path.pop()],
    ['truck.path.x', (s) => (truck(s).path[2]!.x += 0.5)],
    ['truck.path.y', (s) => (truck(s).path[2]!.y += 0.5)],
    ['truck.i', (s) => truck(s).i++],
    ['truck.dirn', (s) => (truck(s).dirn = truck(s).dirn === 1 ? -1 : 1)],
    ['truck.x', (s) => (truck(s).x += 0.5)],
    ['truck.y', (s) => (truck(s).y += 0.5)],
    ['truck.wait', (s) => truck(s).wait++],
    ['truck.moving', (s) => (truck(s).moving = !truck(s).moving)],
    ['truck.dir', (s) => (truck(s).dir += 0.5)],
    ['truck.dustTick', (s) => truck(s).dustTick++],
    ['truck.vis', (s) => (truck(s).vis = !truck(s).vis)],
    ['truck none', (s) => (s.truck = null)],
    ['effect.tiny', (s) => (s.effects.find((e) => e.tiny)!.tiny = false)],
  ];
  for (const [k, change] of changes) expect(differs(change), k).not.toBe(base);
});

test('상태 해시: 날아가는 적 박격포탄과 진지의 엎드림이 해시에 든다', () => {
  const FRIEND = { x: 1280, y: 1200 };
  const mortar = { ...oneUnit({ type: 'mortar', nai: 0, spread: { x: 0, y: 0 }, t0: 0 }), nais: [{ x: 1280, y: 2400, r: 100, conf: 'low' as const }], friends: [FRIEND] };
  const sim = startedWith(mortar, { seed: 3, terrain: flatTerrain({ n: 256 }) });
  while (!sim.state.shells.length || !sim.state.shelledUntil[0]) sim.step([]); // a round in the air after one has landed
  const state = structuredClone(sim.state) as SimState;
  const base = hashState(state);
  const differs = (change: (s: SimState) => void) => {
    const s = structuredClone(state);
    change(s);
    return hashState(s);
  };
  const changes: [string, (s: SimState) => void][] = [
    ['shells length', (s) => s.shells.pop()],
    ['shell.pos', (s) => s.shells[0]!.pos++],
    ['shell.at', (s) => s.shells[0]!.at++],
    ['shelledUntil length', (s) => s.shelledUntil.push(0)],
    ['shelledUntil', (s) => s.shelledUntil[0]!++],
  ];
  for (const [k, change] of changes) expect(differs(change), k).not.toBe(base);
});

test('상태 해시: 섬멸 시각·종료 예정 틱·진지 돌파가 해시에 든다', () => {
  const sim = startedWith(oneUnit({ type: 'inf', route: 'B', t0: 0 }), { seed: 3, terrain: flatTerrain() });
  const state = structuredClone(sim.state) as SimState;
  const base = hashState(state);
  const differs = (change: (s: SimState) => void) => {
    const s = structuredClone(state);
    change(s);
    return hashState(s);
  };
  const changes: [string, (s: SimState) => void][] = [
    ['clearTick', (s) => (s.clearTick = 100)],
    ['endAt', (s) => (s.endAt = 100)],
    ['overran', (s) => (s.platoons[0]!.state = 'overran')],
  ];
  for (const [k, change] of changes) expect(differs(change), k).not.toBe(base);
});

test('상태 해시: 모드와 훈련 사용이 해시에 든다', () => {
  const state = structuredClone(started().state) as SimState;
  const base = hashState(state);
  const used = structuredClone(state);
  used.trainingUsed = true;
  const training = structuredClone(state);
  training.mode = 'training';
  expect(new Set([base, hashState(used), hashState(training)]).size).toBe(3);
});
