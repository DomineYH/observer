// PROTOTYPE, not product code, ticket #120. The floating switcher (prototype skill UI.md): ← label →, and the `show` value.
// Keys: [ and ] cycle the variant (plain ←/→ aim the reticle in this game, so they are left to it). Dev builds only.
import { useEffect } from 'react';
import { ignoreShortcut } from '@ui/shortcut';
import { PROTO, SHOW, SHOWS, VARIANT_NAME, VARIANTS } from './store';

const go = (patch: Record<string, string>) => {
  const p = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(patch)) p.set(k, v);
  location.search = p.toString(); // a reload: each variant starts its own game
};
const cycle = <T,>(xs: readonly T[], x: T, d: number) => xs[(xs.indexOf(x) + d + xs.length) % xs.length]!;

export function PrototypeSwitcher() {
  useEffect(() => {
    if (!PROTO) return;
    const down = (e: KeyboardEvent) => {
      if (ignoreShortcut(e)) return;
      if (e.key === '[') go({ variant: cycle(VARIANTS, PROTO!, -1) });
      if (e.key === ']') go({ variant: cycle(VARIANTS, PROTO!, 1) });
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);
  if (!import.meta.env.DEV || !PROTO) return null;
  const pill = { font: '12px ui-monospace, monospace', background: '#fff', color: '#111', border: 'none', borderRadius: 12, padding: '2px 8px' } as const;
  return (
    <div
      data-prototype="switcher"
      style={{ position: 'fixed', bottom: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 60, display: 'flex', whiteSpace: 'nowrap', gap: 4, alignItems: 'center', background: '#e91e63', padding: '3px 6px', borderRadius: 16, boxShadow: '0 2px 8px #000a' }}
    >
      <button type="button" aria-label="이전 변형" style={pill} onClick={() => go({ variant: cycle(VARIANTS, PROTO!, -1) })}>
        ←
      </button>
      <span style={{ color: '#fff', font: 'bold 12px ui-monospace, monospace' }}>
        {PROTO} ({VARIANT_NAME[PROTO]})
      </span>
      <button type="button" aria-label="다음 변형" style={pill} onClick={() => go({ variant: cycle(VARIANTS, PROTO!, 1) })}>
        →
      </button>
      <button type="button" aria-label="보이기 바꾸기" style={pill} onClick={() => go({ show: cycle(SHOWS, SHOW, 1) })}>
        show={SHOW}
      </button>
    </div>
  );
}
