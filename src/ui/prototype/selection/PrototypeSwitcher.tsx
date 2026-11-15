// PROTOTYPE, not product code, ticket #130. The floating switcher (prototype skill UI.md) with the debug strip above it.
// Keys: [ and ] cycle the variant (plain ←/→ aim the reticle in this game). Dev builds only.
import { useEffect, useSyncExternalStore } from 'react';
import type { Mode, Phase, SeedKind } from '@sim';
import { ignoreShortcut } from '@ui/shortcut';
import * as P from './store';
import { PROTO_CSS } from './Variants';

const go = (patch: Record<string, string>) => {
  const p = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(patch)) p.set(k, v);
  if (patch.state && patch.state !== 'practice') p.delete('seed'); // the states other than practice are daily games
  if (patch.state) p.delete('scenario');
  location.search = p.toString(); // a reload: each variant and state starts its own game
};
const cycle = <T,>(xs: readonly T[], x: T, d: number) => xs[(xs.indexOf(x) + d + xs.length) % xs.length]!;

export function PrototypeSwitcher({ seed, seedKind, phase, realMode }: { seed: number; seedKind: SeedKind; phase: Phase; realMode: Mode }) {
  const s = useSyncExternalStore(P.subscribe, P.get);
  useEffect(() => {
    if (!P.PROTO) return;
    const down = (e: KeyboardEvent) => {
      if (ignoreShortcut(e)) return;
      if (e.key === '[') go({ variant: cycle(P.VARIANTS, P.PROTO!, -1) });
      if (e.key === ']') go({ variant: cycle(P.VARIANTS, P.PROTO!, 1) });
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);
  if (!import.meta.env.DEV || !P.PROTO) return null;
  const pill = { font: '12px ui-monospace, monospace', background: '#fff', color: '#111', border: 'none', borderRadius: 12, padding: '2px 8px' } as const;
  const t = P.remaining(Date.now());
  const strip = [
    `seedKind=${seedKind}`,
    `seed=${seed}`,
    `scenario=${P.scenarioOf(seedKind).id}`,
    `gun=${s.gun}`,
    `mode=${s.mode}${s.mode === 'combat' ? `(real ${realMode})` : ''}`,
    `phase=${phase}`,
    `남은=${t === null ? '—' : P.mmss(t)}`,
    `n=${P.N}`,
  ].join(' ');
  return (
    <div data-prototype="switcher" style={{ position: 'fixed', bottom: 6, left: '50%', transform: 'translateX(-50%)', zIndex: 60, display: 'grid', gap: 3, justifyItems: 'center', maxWidth: 'calc(100vw - 12px)' }}>
      <style>{PROTO_CSS}</style>
      <div data-prototype="debug" style={{ font: '10px ui-monospace, monospace', background: '#000d', color: '#9f9', padding: '2px 6px', borderRadius: 6, maxWidth: '100%', overflowWrap: 'anywhere' }}>
        {strip}
        <br />
        마지막 누름: {s.last}
      </div>
      <div style={{ display: 'flex', whiteSpace: 'nowrap', gap: 4, alignItems: 'center', background: '#e91e63', padding: '3px 6px', borderRadius: 16, boxShadow: '0 2px 8px #000a' }}>
        <button type="button" aria-label="이전 변형" style={pill} onClick={() => go({ variant: cycle(P.VARIANTS, P.PROTO!, -1) })}>
          ←
        </button>
        <span style={{ color: '#fff', font: 'bold 12px ui-monospace, monospace' }}>
          {P.PROTO} ({P.VARIANT_NAME[P.PROTO]})
        </span>
        <button type="button" aria-label="다음 변형" style={pill} onClick={() => go({ variant: cycle(P.VARIANTS, P.PROTO!, 1) })}>
          →
        </button>
        <button type="button" aria-label="상태 바꾸기" style={pill} onClick={() => go({ state: cycle(P.STATES, P.STATE, 1) })}>
          {P.STATE}
        </button>
        <button type="button" aria-label="시나리오 수 바꾸기" style={pill} onClick={() => go({ n: String(cycle(P.COUNTS, P.N, 1)) })}>
          n={P.N}
        </button>
      </div>
    </div>
  );
}
