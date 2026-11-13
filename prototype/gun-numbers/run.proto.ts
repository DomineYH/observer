// PROTOTYPE #118: measurements A–D for every bundle at 8.0, 10.0 and 12.4 km. Prints tables; asserts nothing.
import { test } from 'vitest';
import { createSim, type Fuze, type Input, type Member, type Point, type Sim } from '@sim';
import { drawBias, fall, MIL } from '@sim/ballistics';
import { killMembers } from '@sim/lethality';
import { protoGun, type ProtoGun } from '@sim/protoGun';
import { createStreams, next } from '@sim/rng';
import { BASE_SCENARIO } from '@content/scenario';
import { init } from '../../tests/acceptance/init';
import { oneUnit, started } from '../../tests/acceptance/enemy';
import { CALL_ADJUST, desc, openRadio } from '../../tests/acceptance/mission';
import { CALM, gridAt, isImpact } from '../../tests/acceptance/strike';
import { BUNDLES } from './bundles';

const RANGES = [8_000, 10_000, 12_400];
const SEEDS_A = 2000;
const SEEDS_B = 5000;
const SEEDS_C = Number(process.env.SEEDS_C ?? 1000);
const SEEDS_D = 2000;

const use = (g: ProtoGun) => Object.assign(protoGun, structuredClone(g));
const BASE_GUN = structuredClone(protoGun);
const hyp = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
/** The base battlefield's bearing from a target back to the battery (BASE_SCENARIO: 800 m E, 9,100 m N of it). */
const BACK = (() => {
  const l = Math.hypot(800, 9100);
  return { x: -800 / l, y: -9100 / l };
})();
const batteryFor = (target: Point, d: number): Point => ({ x: target.x + BACK.x * d, y: target.y + BACK.y * d });
const pct = (x: number) => (x * 100).toFixed(1);
const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]!;
};
const table = (head: string[], rows: (string | number)[][]) =>
  [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');

// ---- A. 포대 삼발 anchor: tests/acceptance/lethality.test.ts's harness, the battery `d` m off ----
const formations = Array.from({ length: SEEDS_A }, (_, i) => {
  const sim = createSim({ ...init(i + 1), scenario: { ...BASE_SCENARIO, units: [{ type: 'inf', route: 'B', t0: 0 }] } });
  return sim.state.platoons[0]!.members.map((m) => ({ u: m.u, v: m.v }));
});
function anchor(fuze: Fuze, d: number): number {
  const centre = { x: 0, y: 0 };
  const battery = batteryFor(centre, d);
  let dead = 0;
  let total = 0;
  formations.forEach((f, i) => {
    const bal = createStreams(i + 1).bal;
    const men: Pick<Member, 'kind' | 'x' | 'y' | 'prone' | 'alive'>[] = f.map((m) => ({ kind: 'man', x: centre.x - m.u, y: centre.y - m.v, prone: false, alive: true }));
    next(bal); // the harness's aim-error direction draw, kept so the streams line up with it
    for (let k = 0; k < 3; k++) {
      if (k > 0) for (const m of men) m.prone = true;
      for (const g of protoGun.sheaf) killMembers(men, ...xy(fall(centre, battery, { x: 0, y: 0 }, bal, g)), fuze, bal);
    }
    dead += men.filter((m) => !m.alive).length;
    total += men.length;
  });
  return dead / total;
}
const xy = (p: Point) => [p.x, p.y] as const;

// ---- B. 초탄 오차: the adjusting round (centre gun, no sheaf) with a mission's 비표준 조건 오차, calm weather ----
function firstRound(d: number) {
  const target = { x: 0, y: 0 };
  const battery = batteryFor(target, d);
  const e = Array.from({ length: SEEDS_B }, (_, i) => {
    const bal = createStreams(i + 1).bal;
    return hyp(fall(target, battery, drawBias(bal), bal), target);
  });
  return { med: quantile(e, 0.5), p90: quantile(e, 0.9) };
}

// ---- D. 위험근접 reach: 효력사 rounds (6 guns × 3, no bias) farther than 100 / 200 m from the aim ----
function reach(d: number) {
  const aim = { x: 0, y: 0 };
  const battery = batteryFor(aim, d);
  let n = 0;
  let o100 = 0;
  let o200 = 0;
  let max = 0;
  for (let i = 0; i < SEEDS_D; i++) {
    const bal = createStreams(i + 1).bal;
    for (let k = 0; k < 3; k++)
      for (const g of protoGun.sheaf) {
        const r = hyp(fall(aim, battery, { x: 0, y: 0 }, bal, g), aim);
        n++;
        if (r > 100) o100++;
        if (r > 200) o200++;
        max = Math.max(max, r);
      }
  }
  return { o100: o100 / n, o200: o200 / n, max };
}

// ---- C. 전체 임무: a scripted observer on one approaching infantry platoon ----
// The platoon walks south from 4 km north of the flat test terrain's post; the battery stands `d` m from REF (where the
// platoon is about when the 효력사 lands) on the base battlefield's bearing.
const ROUTE = [{ x: 320, y: 4320 }, { x: 320, y: 3000 }, { x: 320, y: 600 }];
const REF = { x: 320, y: 4000 };
const FFE_WITHIN_M = 50; // 효력사 once an adjusting round lands this close to the platoon's centre …
const MAX_CORR = 5; // … or after this many adjusting rounds
const STEP_S = 0.05;

interface MissionResult {
  adjust: number; // adjusting rounds fired
  rounds: number; // every round fired
  broken: number; // s from the call to 무력화 (or 파괴), −1 never
  destroyed: number; // s from the call to 파괴, −1 never
  ffeRange: number; // battery → platoon at the 효력사, m
}

function mission(seed: number, d: number): MissionResult | null {
  const sc = { ...oneUnit({ type: 'inf', route: 'A', t0: 0 }, ROUTE), battery: batteryFor(REF, d) };
  const sim: Sim = started(sc, { seed, weather: CALM });
  openRadio(sim);
  const p = sim.state.platoons[0]!;
  const t0 = sim.state.tick;
  let broken = -1;
  let destroyed = -1;
  const step = (inputs: Input[] = []) => {
    if (sim.state.phase === 'ended') throw new Error('ended');
    const r = sim.step(inputs);
    const t = (sim.state.tick - t0) * STEP_S;
    if (broken < 0 && (p.state === 'broken' || p.state === 'destroyed')) broken = t;
    if (destroyed < 0 && p.state === 'destroyed') destroyed = t;
    return r;
  };
  const until = (done: () => boolean, limit = 6000) => {
    for (let k = 0; k < limit; k++) {
      if (done()) return;
      step();
    }
    throw new Error('stuck');
  };
  const stage = () => sim.state.radio.stage;
  try {
    if (!step([CALL_ADJUST]).accepted[0]) return null;
    until(() => stage() === 'loc');
    if (!step([gridAt(p)]).accepted[0]) return null;
    until(() => stage() === 'desc');
    if (!step([desc(3, 'quick', 'ready', 0, 'unknown')]).accepted[0]) return null;
    let adjust = 0;
    for (;;) {
      // the adjusting round lands; the observer reads its error from the platoon's centre on the 기준선 (OT line)
      let impact: Point | null = null;
      while (!impact) impact = step().events.find(isImpact) ?? null;
      adjust++;
      const dir = (((Math.atan2(p.x - sim.state.op.x, p.y - sim.state.op.y) * MIL) % 6400) + 6400) % 6400;
      const m = sim.state.missions.at(-1)!;
      const a = (m.direction ?? dir) / MIL;
      const ex = p.x - impact.x;
      const ey = p.y - impact.y;
      const rng = ex * Math.sin(a) + ey * Math.cos(a); // add +
      const lat = ex * Math.cos(a) - ey * Math.sin(a); // right +
      const ffe = Math.hypot(ex, ey) <= FFE_WITHIN_M || adjust >= MAX_CORR;
      const v = [lat >= 0 ? 'right' : 'left', Math.min(800, Math.round(Math.abs(lat))), rng >= 0 ? 'add' : 'drop', Math.min(1500, Math.round(Math.abs(rng))), ffe ? 'ffe' : 'adjust'];
      const input: Input = { a: 'corr', v: m.direction === null ? [Math.round(dir) % 6400, ...v] : v };
      until(() => stage() === 'adjust');
      if (!step([input]).accepted[0]) throw new Error('corr refused');
      if (ffe) break;
    }
    const ffeRange = hyp(p, sc.battery);
    until(() => stage() === 'effect');
    for (let k = 0; k < 100; k++) step(); // 5 s into the 효과 관측
    return { adjust, rounds: sim.state.missions.at(-1)!.impacts.length, broken, destroyed, ffeRange };
  } catch {
    return null;
  }
}

function missions(d: number) {
  const rs = Array.from({ length: SEEDS_C }, (_, i) => mission(i + 1, d)).filter((r): r is MissionResult => r !== null);
  const mean = (f: (r: MissionResult) => number, of = rs) => of.reduce((s, r) => s + f(r), 0) / of.length;
  const br = rs.filter((r) => r.broken >= 0);
  const de = rs.filter((r) => r.destroyed >= 0);
  return {
    n: rs.length,
    adjust: mean((r) => r.adjust),
    rounds: mean((r) => r.rounds),
    tBroken: br.length ? quantile(br.map((r) => r.broken), 0.5) : NaN,
    tDestroyed: de.length ? quantile(de.map((r) => r.destroyed), 0.5) : NaN,
    broken: br.length / rs.length,
    destroyed: de.length / rs.length,
    km: mean((r) => r.ffeRange) / 1000,
  };
}
// K55 has KH179's numbers to the last digit: run each distinct bundle once.
const seen = new Map<string, ReturnType<typeof missions>>();
const missionsOnce = (d: number) => {
  const key = JSON.stringify([protoGun, d]);
  if (!seen.has(key)) seen.set(key, missions(d));
  return seen.get(key)!;
};

test('PROTOTYPE #118: 포 4종 수치 견주기', () => {
  const out: string[] = [];
  const say = (s: string) => {
    out.push(s);
  };
  say(`seeds: A ${SEEDS_A} · B ${SEEDS_B} · C ${SEEDS_C} · D ${SEEDS_D} per cell; ranges ${RANGES.map((d) => d / 1000).join(' / ')} km`);

  say('\n### 수치 묶음\n');
  say(
    table(
      ['묶음', '최대 사거리 m', '비과시간 a+b·km', '사거리 PE a+b·km', '편의 PE a+b·km', '문수', '효력사 간격/흔들림 s', 'R 순발 서/엎 · 접근 서/엎 · 장갑차 · 포신 순발/접근 m'],
      BUNDLES.map(({ name, gun: g }) => {
        const R = g.lethalRadiusM;
        return [name, g.maxRangeM ?? '—', `${g.tof.baseS} + ${g.tof.sPerKm}`, `${g.peRange.baseM} + ${g.peRange.mPerKm}`, `${g.peDeflection.baseM} + ${g.peDeflection.mPerKm}`, g.sheaf.length, `${g.ffe.intervalS} / ${g.ffe.jitterS}`, `${R.man.quick.stand}/${R.man.quick.prone} · ${R.man.vt.stand}/${R.man.vt.prone} · ${R.vehicle} · ${R.tube.quick}/${R.tube.vt}`];
      }),
    ),
  );

  const A: (string | number)[][] = [];
  const B: (string | number)[][] = [];
  const C: (string | number)[][] = [];
  const D: (string | number)[][] = [];
  for (const b of BUNDLES) {
    use(b.gun);
    const km = (d: number) => `${b.name} @${d / 1000}`;
    for (const d of RANGES) {
      const out = d > (b.gun.maxRangeM ?? Infinity) ? ' (사거리 밖)' : '';
      A.push([km(d) + out, pct(anchor('quick', d)), pct(anchor('vt', d))]);
      const f = firstRound(d);
      B.push([km(d), f.med.toFixed(0), f.p90.toFixed(0), `${(protoGun.peRange.baseM + (protoGun.peRange.mPerKm * d) / 1000).toFixed(1)} / ${(protoGun.peDeflection.baseM + (protoGun.peDeflection.mPerKm * d) / 1000).toFixed(1)}`, (protoGun.tof.baseS + (d / 1000) * protoGun.tof.sPerKm).toFixed(1)]);
      const r = reach(d);
      D.push([km(d), pct(r.o100), pct(r.o200), r.max.toFixed(0)]);
      const c = missionsOnce(d);
      C.push([km(d), c.n, c.km.toFixed(2), c.adjust.toFixed(2), c.rounds.toFixed(1), c.tBroken.toFixed(0), c.tDestroyed.toFixed(0), pct(c.broken), pct(c.destroyed)]);
    }
  }
  use(BASE_GUN);

  say('\n### A. 포대 삼발 (노출 소총소대, 편의 없음, 첫 일제사 서 있음 → 엎드림) 사상률 %\n');
  say(table(['묶음 @km', '순발', '접근'], A));
  say('\n### B. 초탄 오차 (수정탄, 비표준 조건 오차 30–90 m 포함, 기상 잔차 0) m\n');
  say(table(['묶음 @km', '중앙값', 'p90', 'PE 사거리/편의 m', '비과시간 s'], B));
  say('\n### C. 전체 임무 (각본 관측자, 접근하는 보병 1개 소대)\n');
  say(table(['묶음 @km', '유효 판', '효력사 때 사거리 km', '수정탄 발수 평균', '총 발수 평균', '요청→무력화 s (중앙값)', '요청→파괴 s (중앙값)', '무력화 이상 %', '파괴 %'], C));
  say('\n### D. 위험근접 닿음 (효력사 6문×3발, 편의 없음, 조준점에서)\n');
  say(table(['묶음 @km', '>100 m %', '>200 m %', '최대 m'], D));
  process.stdout.write('\n\n' + out.join('\n') + '\n');
});
