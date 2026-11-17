import type { CombatData, GunProfile, Point } from '@sim';
import type { Gun } from './guns';
import type { Placement } from './placement';
import { inRange } from './range';

/** 어긋난 곳: whose datum (식별자, or `combat` for the 실전 자료), which content rule, and where in it. */
export interface Finding {
  id: string;
  rule: string;
  at: string;
}

const ID = /^[a-z][a-z0-9-]*$/;
const count = (n: number) => Number.isInteger(n) && n >= 1;
const blank = (s: string) => s.trim() === '';
const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

/** 일일 시작일: an eight-digit 연·월·일 that is a real calendar day. */
function realDay(d: number): boolean {
  if (!Number.isInteger(d) || d < 10000101 || d > 99991231) return false;
  const [y, m, day] = [Math.floor(d / 10000), Math.floor(d / 100) % 100, d % 100];
  const t = new Date(Date.UTC(y, m - 1, day));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === day;
}

/** 시나리오와 배치 rules 1–9 · 11–16 (#116, #124) of one 배치; `first` = the first 배치 of its 전장, `base` the 기본 포
 * (none when the 포 프로파일 목록 lacks it, which 포 프로파일 1 reports). */
function placementFindings(p: Placement, seen: Set<string>, first: boolean, base: GunProfile | undefined): Finding[] {
  const { scenario: s, briefing: b } = p;
  const out: Finding[] = [];
  const bad = (rule: number, at: string) => out.push({ id: s.id, rule: `시나리오 ${rule}`, at });
  const keys = Object.keys(s.routes);
  const has = (k: string) => keys.includes(k);
  const routes = Object.entries(s.routes).filter((e): e is [string, readonly Point[]] => e[1] !== undefined);

  if (!ID.test(s.id) || seen.has(s.id)) bad(1, 'id');
  seen.add(s.id);
  if (!count(s.version)) bad(1, 'version');

  if (keys.length === 0) bad(2, 'routes');
  for (const k of keys) if (!/^[A-Z]$/.test(k)) bad(2, `routes.${k}`);
  for (const [k, pts] of routes) if (pts.length < 3) bad(3, `routes.${k}`);

  if (s.friends.length === 0) bad(4, 'friends');
  for (const [k, pts] of routes) if (!s.friends.some((f) => same(f, pts[pts.length - 1]!))) bad(4, `routes.${k}`);

  s.friends.forEach((f, i) => f.y < s.frontY || bad(5, `friends[${i}]`));
  for (const [k, pts] of routes) if (!(pts[0]!.y > s.frontY)) bad(5, `routes.${k}`);

  s.units.forEach((u, i) => {
    if (u.type === 'mortar') return;
    const r = u.route;
    if (typeof r === 'string') return has(r) || bad(6, `units[${i}].route`);
    if (!has(r.first) || !has(r.second)) bad(6, `units[${i}].route`);
    if (!(r.p > 0 && r.p < 1)) bad(6, `units[${i}].route.p`);
  });

  s.intelRoutes.forEach(({ route }, i) => {
    if (!has(route) || s.intelRoutes.findIndex((x) => x.route === route) < i) bad(7, `intelRoutes[${i}].route`);
  });

  s.units.forEach((u, i) => {
    if (u.type !== 'mortar') return;
    if (!Number.isInteger(u.nai) || u.nai < 0 || u.nai >= s.nais.length) bad(8, `units[${i}].nai`);
    if (!(u.spread.x > 0 && u.spread.y > 0)) bad(8, `units[${i}].spread`);
  });
  s.nais.forEach((n, i) => n.r > 0 || bad(8, `nais[${i}].r`));

  if (!s.units.some((u) => u.type !== 'recon')) bad(9, 'units');

  if (base && !inRange(s, base)) bad(12, 'battery');

  if (!count(s.timeLimitS)) bad(11, 'timeLimitS');
  const second = (t: number) => Number.isInteger(t) && t >= 0 && t < s.timeLimitS;
  s.units.forEach((u, i) => {
    if (!second(u.t0)) bad(11, `units[${i}].t0`);
    if (u.type === 'mortar' && !second(u.fireFromS)) bad(11, `units[${i}].fireFromS`);
  });

  if (b.nais.length !== s.nais.length) bad(13, 'briefing.nais');
  if (Object.keys(b.routes).join() !== keys.join()) bad(13, 'briefing.routes');

  for (const k of ['name', 'blurb', 'enemy', 'mission', 'plannedOp'] as const) if (blank(b[k])) bad(14, `briefing.${k}`);
  b.nais.forEach((t, i) => blank(t) && bad(14, `briefing.nais[${i}]`));
  for (const [k, t] of Object.entries(b.routes)) if (t !== undefined && blank(t)) bad(14, `briefing.routes.${k}`);

  if (p.dailyFrom !== undefined && !realDay(p.dailyFrom)) bad(15, 'dailyFrom');
  if (p.dailyFrom !== undefined && first) bad(16, 'dailyFrom');
  return out;
}

/** 포 프로파일 rules 1–5 (#116); 진지 변환 시간 is in rule 3 (M3-20). */
function gunFindings(guns: readonly Gun[]): Finding[] {
  const out: Finding[] = [];
  const seen = new Set<string>();
  guns.forEach(({ profile: g, name, blurb: text }, i) => {
    const bad = (rule: number, at: string) => out.push({ id: g.id, rule: `포 프로파일 ${rule}`, at });
    if (!ID.test(g.id) || seen.has(g.id) || (i === 0 && g.id !== 'base')) bad(1, 'id');
    seen.add(g.id);
    if (!count(g.version)) bad(1, 'version');
    if (g.sheaf.length === 0) bad(2, 'sheaf');
    const { man, vehicle, tube } = g.lethalRadiusM;
    const positive = { 'ffe.intervalS': g.ffe.intervalS, maxRangeM: g.maxRangeM, 'lethalRadiusM.man.quick.stand': man.quick.stand,
      'lethalRadiusM.man.quick.prone': man.quick.prone, 'lethalRadiusM.man.vt.stand': man.vt.stand, 'lethalRadiusM.man.vt.prone': man.vt.prone,
      'lethalRadiusM.vehicle': vehicle, 'lethalRadiusM.tube.quick': tube.quick, 'lethalRadiusM.tube.vt': tube.vt, displacementS: g.displacementS };
    for (const [at, v] of Object.entries(positive)) if (!(v > 0)) bad(3, at);
    const { tof, peRange: r, peDeflection: d } = g;
    const nonNegative = { 'tof.baseS': tof.baseS, 'tof.sPerKm': tof.sPerKm, 'peRange.baseM': r.baseM, 'peRange.mPerKm': r.mPerKm,
      'peDeflection.baseM': d.baseM, 'peDeflection.mPerKm': d.mPerKm, 'ffe.jitterS': g.ffe.jitterS };
    for (const [at, v] of Object.entries(nonNegative)) if (!(v >= 0)) bad(4, at);
    if (blank(name)) bad(5, 'name');
    if (blank(text)) bad(5, 'blurb');
  });
  if (guns.length === 0) out.push({ id: 'base', rule: '포 프로파일 1', at: 'id' });
  return out;
}

const WHOLE = ['radioExposure', 'laserExposure', 'exposureLimit', 'barrage.rounds', 'laserLimit'];

/** 실전 수치 rules 1 · 2: every number positive, the five counts whole, the 실전 자료 판 a whole number from 1. */
function combatFindings(c: CombatData): Finding[] {
  const out: Finding[] = [];
  const bad = (rule: number, at: string) => out.push({ id: 'combat', rule: `실전 ${rule}`, at });
  const walk = (o: object, path: string): void => {
    for (const [k, v] of Object.entries(o)) {
      const at = path + k;
      if (typeof v === 'object' && v !== null) walk(v, `${at}.`);
      else if (!(typeof v === 'number' && v > 0) || (WHOLE.includes(at) && !Number.isInteger(v))) bad(1, `numbers.${at}`);
    }
  };
  walk(c.numbers, '');
  if (!count(c.version)) bad(2, 'version');
  return out;
}

/** 내용 검증 (ADR 0017): the 어긋난 곳 of the 배치 목록, the 포 프로파일 목록 and the 실전 수치, none when all keep the
 * content rules. Run by the tests only; the app never checks its content. The 증원 rules (M3-16) arrive with their data. */
export function contentCheck(content: { placements: readonly Placement[]; guns: readonly Gun[]; combat: CombatData }): Finding[] {
  const base = content.guns.find((g) => g.profile.id === 'base')?.profile;
  const seen = new Set<string>();
  const fields = new Set<string>();
  const out = content.placements.flatMap((p) => {
    const first = !fields.has(p.terrain.id);
    fields.add(p.terrain.id);
    return placementFindings(p, seen, first, base);
  });
  return [...out, ...gunFindings(content.guns), ...combatFindings(content.combat)];
}
