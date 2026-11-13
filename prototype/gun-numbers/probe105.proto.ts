// PROTOTYPE #118 probe: how big the 105mm man R must be (KH178 게임 PE) for 포대 삼발 to reach 70–80 %.
// Run: npx vitest run --config prototype/gun-numbers/vitest.config.ts probe105
import { test } from 'vitest';
import { createSim, type Member } from '@sim';
import { fall } from '@sim/ballistics';
import { killMembers } from '@sim/lethality';
import { protoGun } from '@sim/protoGun';
import { createStreams, next } from '@sim/rng';
import { BASE_SCENARIO } from '@content/scenario';
import { init } from '../../tests/acceptance/init';
import { BUNDLES } from './bundles';

const N = 2000;
const formations = Array.from({ length: N }, (_, i) =>
  createSim({ ...init(i + 1), scenario: { ...BASE_SCENARIO, units: [{ type: 'inf', route: 'B', t0: 0 }] } }).state.platoons[0]!.members.map((m) => ({ u: m.u, v: m.v })),
);
const l = Math.hypot(800, 9100);
function anchor(d: number, rounds = 3): number {
  const battery = { x: (-800 / l) * d, y: (-9100 / l) * d };
  let dead = 0;
  let total = 0;
  formations.forEach((f, i) => {
    const bal = createStreams(i + 1).bal;
    const men: Pick<Member, 'kind' | 'x' | 'y' | 'prone' | 'alive'>[] = f.map((m) => ({ kind: 'man', x: -m.u, y: -m.v, prone: false, alive: true }));
    next(bal);
    for (let k = 0; k < rounds; k++) {
      if (k > 0) for (const m of men) m.prone = true;
      for (const g of protoGun.sheaf) {
        const p = fall({ x: 0, y: 0 }, battery, { x: 0, y: 0 }, bal, g);
        killMembers(men, p.x, p.y, 'quick', bal);
      }
    }
    dead += men.filter((m) => !m.alive).length;
    total += men.length;
  });
  return (dead / total) * 100;
}

test('probe 105 R', () => {
  const g = structuredClone(BUNDLES.find((b) => b.name === 'KH178 게임')!.gun);
  const lines: string[] = ['| 사람 R 배율 (base 대비) | 순발 서/엎 m | @8 | @10 | @12.4 |', '|---|---|---|---|---|'];
  for (const s of [0.79, 0.9, 1.0, 1.05, 1.1]) {
    g.lethalRadiusM.man = { quick: { stand: 26 * s, prone: 15 * s }, vt: { stand: 28 * s, prone: 24 * s } };
    Object.assign(protoGun, structuredClone(g));
    lines.push(`| ${s} | ${(26 * s).toFixed(1)}/${(15 * s).toFixed(1)} | ${[8000, 10000, 12400].map((d) => anchor(d).toFixed(1)).join(' | ')} |`);
  }
  lines.push('', '| 묶음 | 문당 발수 | @8 | @10 | @12.4 |', '|---|---|---|---|---|');
  for (const name of ['KH178 게임', 'KH178 공개', 'KH179 공개', 'base'])
    for (const r of [3, 4, 5]) {
      Object.assign(protoGun, structuredClone(BUNDLES.find((b) => b.name === name)!.gun));
      lines.push(`| ${name} | ${r} | ${[8000, 10000, 12400].map((d) => anchor(d, r).toFixed(1)).join(' | ')} |`);
    }
  process.stdout.write('\n' + lines.join('\n') + '\n');
});
