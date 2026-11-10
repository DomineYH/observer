// PROTOTYPE (#72): the base-mungyeong draft on the round-3 terrain, measured with the simulation's own code. Throwaway.
// Usage (repo root, so Vite finds its config): node prototype/m2-terrain/measure72.mjs [terrain=mungyeong72] [draft.json]
// Writes $DATA/base-mungyeong.json (the Scenario the app loads with ?scenario=) and $DATA/<terrain>-measure.json, and
// prints the report tables.
//   approaches  sim lineOfSight (bilinear), eye heightAt + 3.5 m, target heightAt + 1.7 × 0.85 m, every 25 m; forest =
//               cover `forest` at the nearest cell. #64 decision 10: two at ≥ 50 % seen and ≤ 30 % forest, the worst
//               ≥ 40 % and ≤ 35 %, every approach's last 1.5 km ≥ 50 %.
//   jitter      the paths createSim's deploy draws, seeds 1..SEEDS, same metric.
//   headless    createSim runs with no input but 작전 개시 at the planned post and 쌍안경 on, clear weather, up to 20 min:
//               when each unit is first seen (any member's `vis`), and for how much of its time; mock beside it.
/* global process, console */
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';
import { DATA, readTerrain } from './lib.mjs';

const file = process.argv[2] ?? 'mungyeong72';
const draft = JSON.parse(readFileSync(process.argv[3] ?? `${DATA}/../m2-t64-draft.json`, 'utf8'));
const SEEDS = 300, RUN_SEEDS = +(process.env.RUN_SEEDS ?? 40), MAX_TICKS = +(process.env.MAX_TICKS ?? 24000);
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const sim = await vite.ssrLoadModule('/src/sim/index.ts');
const { BASE_SCENARIO } = await vite.ssrLoadModule('/src/content/scenario.ts');
const { BASE_GUNS } = await vite.ssrLoadModule('/src/content/guns.ts');
const { CLEAR_WEATHER } = await vite.ssrLoadModule('/src/adapters/mock/weather.ts');
const { generateTerrain } = await vite.ssrLoadModule('/src/adapters/mock/terrain/index.ts');
await vite.close();
const { heightAt, lineOfSight, underCanopy, EYE_HEIGHT, createSim } = sim;

const t = readTerrain(`${DATA}/${file}.bin`);
const FOREST = 2, WATER = 3, VILLAGE = 5, BUILDING = 6;
const coverAt = (t, x, y) => t.cover[Math.min(t.n - 1, Math.max(0, Math.round(y / t.cell))) * t.n + Math.min(t.n - 1, Math.max(0, Math.round(x / t.cell)))];
const P = ([x, y]) => ({ x, y });
const eyeOf = (t, p) => ({ ...p, z: heightAt(t, p.x, p.y) + EYE_HEIGHT });
const seenMan = (t, e, x, y) => lineOfSight(t, e, { x, y, z: heightAt(t, x, y) + 1.7 * 0.85 });
const pct = (a, b) => Math.round((100 * a) / Math.max(1, b));
const lenOf = (pts) => pts.slice(1).reduce((s, p, k) => s + Math.hypot(p.x - pts[k].x, p.y - pts[k].y), 0);
const along = (pts, step, f) => { for (let s = 0; s < pts.length - 1; s++) { const a = pts[s], b = pts[s + 1], d = Math.hypot(b.x - a.x, b.y - a.y); for (let m = 0; m < d; m += step) f(a.x + ((b.x - a.x) * m) / d, a.y + ((b.y - a.y) * m) / d); } };
function routeScore(t, op, pts) {
  const e = eyeOf(t, op);
  let n = 0, seen = 0, forest = 0;
  along(pts, 25, (x, y) => { n++; if (seenMan(t, e, x, y)) seen++; if (coverAt(t, x, y) === FOREST) forest++; });
  return { seen: pct(seen, n), forest: pct(forest, n), length: Math.round(lenOf(pts)) };
}
const tail = (pts, m) => { const out = [pts.at(-1)]; for (let q = pts.length - 1; q > 0 && m > 0; q--) { const L = Math.hypot(pts[q].x - pts[q - 1].x, pts[q].y - pts[q - 1].y); if (L <= m) { out.unshift(pts[q - 1]); m -= L; } else { out.unshift({ x: pts[q].x + ((pts[q - 1].x - pts[q].x) * m) / L, y: pts[q].y + ((pts[q - 1].y - pts[q].y) * m) / L }); m = 0; } } return out; };
const quant = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const median = (a) => (a.length ? quant(a, 0.5) : null);

// --- the scenario (decision 7–12 of #64; units, intel and confidences as the demo)
const posts = draft.posts.map(P), op = posts[0], friends = draft.friends.map(P);
const routes = Object.fromEntries(Object.entries(draft.routes).map(([k, r]) => [k, r.map(P)]));
const okSupply = (r) => r.every((p) => p.y < draft.frontY - 200) && lenOf(r) >= 1500 && lenOf(r) <= 4000 && r[0].x < 4000;
const supply = t.roads.map((r, i) => ({ i, len: Math.round(lenOf(r)), first: r[0], last: r.at(-1), ok: okSupply(r) }));
const supplyOk = supply.filter((s) => s.ok);
const scenario = {
  id: 'base-mungyeong', version: 1,
  plannedOp: op, reserveOps: posts.slice(1), battery: P(draft.battery), fixedPoint: P(draft.fixedPoint), frontY: draft.frontY, friends,
  supplyRoad: supplyOk.length ? supplyOk.sort((a, b) => b.len - a.len)[0].i : -1, // none: no truck
  routes, nais: draft.nais.map(([x, y, r], k) => ({ x, y, r, conf: BASE_SCENARIO.nais[k].conf })),
  intelRoutes: BASE_SCENARIO.intelRoutes, units: BASE_SCENARIO.units,
};
if (file === 'mungyeong72') writeFileSync(`${DATA}/base-mungyeong.json`, JSON.stringify(scenario, null, 1));
const out = { file, scenario };
const log = (...a) => console.log(...a);

// --- placement rules (#64 decision 9 and its acceptance table)
log(`## ${file}: placement rules`);
const houseOrWater = (c) => c === VILLAGE || c === BUILDING || c === WATER;
for (const [k, r] of Object.entries(routes)) {
  const hit = { village: 0, building: 0, water: 0 };
  along(r, 5, (x, y) => { const c = coverAt(t, x, y); if (c === VILLAGE) hit.village++; if (c === BUILDING) hit.building++; if (c === WATER) hit.water++; });
  const goal = r.at(-1), closer = r.slice(1).every((p, q) => Math.hypot(p.x - goal.x, p.y - goal.y) < Math.hypot(r[q].x - goal.x, r[q].y - goal.y));
  const p2 = r[1], d2 = Math.hypot(p2.x - op.x, p2.y - op.y);
  log(`${k}: samples(5 m) on village ${hit.village} building ${hit.building} water ${hit.water} | each leg closer ${closer} | length ${Math.round(lenOf(r))} m | goal is a friend ${friends.some((f) => f.x === goal.x && f.y === goal.y)} | 2nd pt (${p2.x}, ${p2.y}) ${['open', 'field', 'forest', 'water', 'road', 'village', 'building'][coverAt(t, p2.x, p2.y)]}, underCanopy ${underCanopy(t, p2.x, p2.y)}, seen ${seenMan(t, eyeOf(t, op), p2.x, p2.y)}, ${(d2 / 1000).toFixed(2)} km (≤ 5.67)`);
  out[`rules${k}`] = { ...hit, closer };
}
friends.forEach((f, i) => { let bad = 0; for (let u = -85; u <= 85; u += 10) { const c = coverAt(t, f.x + u, f.y); if (c === FOREST || houseOrWater(c)) bad++; } log(`${i + 1}소대 (${f.x}, ${f.y}): line cells forest/house/water ${bad}/18, seen ${seenMan(t, eyeOf(t, op), f.x, f.y)}, south of front ${f.y < draft.frontY}, OP south of it ${op.y < f.y}`); });
posts.forEach((p, i) => log(`${i ? '예비 ' + i : '계획'} (${p.x}, ${p.y}): underCanopy ${underCanopy(t, p.x, p.y)}, ground ${heightAt(t, p.x, p.y).toFixed(0)} m, edge ${Math.min(p.x, p.y, 10230 - p.x, 10230 - p.y)} m`));
draft.nais.forEach(([x, y, r], i) => { let h = 0; for (let v = y - r; v <= y + r; v += 10) for (let u = x - r; u <= x + r; u += 10) if (Math.hypot(u - x, v - y) <= r && [VILLAGE, BUILDING].includes(coverAt(t, u, v))) h++; log(`NAI ${i + 1}: house cells inside ${h}`); });
{ const [x0, y0] = draft.nais[2], [sx, sy] = draft.mortarSpread; let h = 0, ok = 0, all = 0;
  for (let y = y0 - sy / 2 - 100; y <= y0 + sy / 2 + 100; y += 10) for (let x = x0 - sx / 2 - 100; x <= x0 + sx / 2 + 100; x += 10) if ([VILLAGE, BUILDING].includes(coverAt(t, x, y))) h++;
  for (let y = y0 - sy / 2; y <= y0 + sy / 2; y += 10) for (let x = x0 - sx / 2; x <= x0 + sx / 2; x += 10) { all++; if (!underCanopy(t, x, y) && !underCanopy(t, x + 30, y)) ok++; }
  log(`mortar box: house cells within 100 m ${h}, usable spots (sim's open test) ${pct(ok, all)} %`); }

// --- approaches against decision 10
log(`## approaches from the planned post (sim lineOfSight)`);
const score = {};
for (const [k, r] of Object.entries(routes)) {
  const s = routeScore(t, op, r), last = routeScore(t, op, tail(r, 1500)).seen;
  let water = 0; along(r, 10, (x, y) => { if (coverAt(t, x, y) === WATER) water++; });
  score[k] = { ...s, last1500: last, waterSamples10m: water, fromReserves: posts.slice(1).map((p) => routeScore(t, p, r).seen) };
  log(`${k}: seen ${s.seen} %, forest ${s.forest} %, last 1.5 km ${last} %, length ${s.length} m, water samples (10 m) ${water} | from 예비 1/2: ${score[k].fromReserves.join(' / ')} %`);
}
const ks = Object.keys(score).sort((a, b) => score[b].seen - score[a].seen);
const good = ks.filter((k) => score[k].seen >= 50 && score[k].forest <= 30);
const worst = ks.at(-1);
const crit = { twoGood: good.length >= 2, worst: score[worst].seen >= 40 && score[worst].forest <= 35, last: ks.every((k) => score[k].last1500 >= 50) };
crit.pass = crit.twoGood && crit.worst && crit.last;
log(`criterion: ≥2 at 50/30 ${crit.twoGood} (${good.join(',')}); worst ${worst} at 40/35 ${crit.worst}; every last 1.5 km ≥ 50 ${crit.last} → ${crit.pass ? 'PASS' : 'FAIL'}`);
Object.assign(out, { score, crit });

// --- jittered paths from the real deploy
const init = (seed, terrain, sc) => ({ seed, seedKind: 'practice', scenario: sc, guns: BASE_GUNS, weather: CLEAR_WEATHER, mode: 'training', terrain });
const jit = { A: [], B: [], C: [] }, jitForest = { A: [], B: [], C: [] };
const mortar = { n: 0, canopy: 0, forestCell: 0, seen: 0, cells: {} };
const recon = { A: 0, B: 0 };
for (let seed = 1; seed <= SEEDS; seed++) {
  const st = createSim(init(seed, t, scenario)).state;
  for (const p of st.platoons) {
    if (p.route) { const s = routeScore(t, op, p.path); jit[p.route].push(s.seen); jitForest[p.route].push(s.forest); }
    if (p.type === 'recon') recon[p.route]++;
    if (p.type === 'mortar') {
      mortar.n++;
      if (underCanopy(t, p.x, p.y)) mortar.canopy++;
      const c = ['open', 'field', 'forest', 'water', 'road', 'village', 'building'][coverAt(t, p.x, p.y)];
      mortar.cells[c] = (mortar.cells[c] ?? 0) + 1;
      if (lineOfSight(t, eyeOf(t, op), { x: p.x, y: p.y, z: heightAt(t, p.x, p.y) + 1.0 * 0.85 })) mortar.seen++;
    }
  }
}
const jitter = Object.fromEntries(Object.entries(jit).map(([k, a]) => [k, { n: a.length, median: median(a), p5: quant(a, 0.05), p95: quant(a, 0.95), forestMedian: median(jitForest[k]) }]));
log(`## jittered paths (deploy, seeds 1–${SEEDS})`);
for (const [k, j] of Object.entries(jitter)) log(`${k}: ${j.n} paths, seen median ${j.median} % (p5 ${j.p5}, p95 ${j.p95}), forest median ${j.forestMedian} %`);
log(`mortar spots: ${mortar.n}, under canopy ${mortar.canopy}, cells ${JSON.stringify(mortar.cells)}, tube (1.0 m) seen from the planned post ${pct(mortar.seen, mortar.n)} %`);
log(`recon route: A ${recon.A}, B ${recon.B}`);
Object.assign(out, { jitter, mortar, recon });

// --- supply road
log(`## supply road (#59 rule 8 lines; all points > 200 m south of the front, 1.5–4 km, first point x < 4000)`);
log(`lines ${t.roads.length}; meeting it: ${supplyOk.length ? supplyOk.map((s) => `#${s.i} ${s.len} m (${s.first.x}, ${s.first.y}) → (${s.last.x}, ${s.last.y})`).join('; ') : 'none'} → supplyRoad ${scenario.supplyRoad}`);
const near = supply.filter((s) => s.first.x < 4000 && s.first.y < draft.frontY - 200 && s.len >= 1000).slice(0, 8);
log(`lines starting west of x 4000 south of the front (≥ 1 km), first 8: ${near.map((s) => `#${s.i} ${s.len} m (${s.first.x}, ${s.first.y}) → (${s.last.x}, ${s.last.y}) north max ${Math.round(Math.max(...t.roads[s.i].map((p) => p.y)))}`).join('; ')}`);
out.supply = { ok: supplyOk, chosen: scenario.supplyRoad };

// --- headless runs: when is each unit first seen, and for how long (mock beside it)
function runs(name, terrainOf, scOf) {
  const rows = [];
  for (let seed = 1; seed <= RUN_SEEDS; seed++) {
    const tt = terrainOf(seed), sc = scOf(seed);
    const s = createSim(init(seed, tt, sc));
    s.step([{ a: 'start', v: [sc.plannedOp.x, sc.plannedOp.y] }]);
    s.step([{ a: 'bino', v: [1] }]);
    const P = s.state.platoons.map((p) => ({ type: p.type, route: p.route, first: -1, live: 0, seen: 0, hold: 0, holdSeen: 0, end: '' }));
    while (s.state.phase !== 'ended' && s.state.tick < MAX_TICKS) {
      s.step([]);
      if (s.state.tick % 6) continue;
      s.state.platoons.forEach((p, i) => {
        if (p.state === 'wait') return;
        const v = p.members.some((q) => q.vis), r = P[i];
        r.live++; if (v) { r.seen++; if (r.first < 0) r.first = s.state.tick; }
        if (p.state === 'hold' || p.state === 'emplaced') { r.hold++; if (v) r.holdSeen++; }
      });
    }
    s.state.platoons.forEach((p, i) => { P[i].end = p.state; });
    rows.push({ seed, ticks: s.state.tick, ended: s.state.phase === 'ended', P });
  }
  const by = (type) => rows.flatMap((r) => r.P.filter((p) => p.type === type));
  const sec = (a) => (a == null ? null : Math.round(a / 20));
  const sum = Object.fromEntries(['recon', 'inf', 'apc', 'mortar'].map((type) => {
    const ps = by(type), firsts = ps.filter((p) => p.first >= 0).map((p) => p.first);
    return [type, { units: ps.length, everSeen: pct(firsts.length, ps.length), firstSeenMedianS: sec(median(firsts)), seenShareMedian: median(ps.map((p) => pct(p.seen, p.live))), holdSeenShareMedian: median(ps.filter((p) => p.hold).map((p) => pct(p.holdSeen, p.hold))), holdEverSeen: pct(ps.filter((p) => p.holdSeen).length, ps.filter((p) => p.hold).length), overran: ps.filter((p) => p.end === 'overran').length }];
  }));
  const endS = rows.map((r) => r.ticks / 20);
  log(`${name}: ${rows.length} runs, ended ${rows.filter((r) => r.ended).length}, game length median ${Math.round(median(endS))} s`);
  for (const [type, v] of Object.entries(sum)) log(`  ${type}: ${JSON.stringify(v)}`);
  // infantry by route: first seen
  for (const k of ['A', 'B', 'C']) { const f = rows.flatMap((r) => r.P.filter((p) => p.type === 'inf' && p.route === k && p.first >= 0).map((p) => p.first)); log(`  inf on ${k}: first seen median ${sec(median(f))} s (${f.length} units)`); }
  return { sum, gameMedianS: Math.round(median(endS)) };
}
log(`## headless runs (seeds 1–${RUN_SEEDS}, 작전 개시 at the planned post, 쌍안경 on, clear, no fire, ≤ ${MAX_TICKS / 20} s)`);
out.headless = { real: runs(file, () => t, () => scenario) };
if (process.env.MOCK !== '0') out.headless.mock = runs('mock', (seed) => generateTerrain(seed), () => BASE_SCENARIO);
writeFileSync(`${DATA}/${file}-measure.json`, JSON.stringify(out, null, 1));

