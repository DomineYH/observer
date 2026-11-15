# PROTOTYPE, not product code, ticket #130 (시제품: 시나리오·포·모드를 고르는 화면의 모양)

Throwaway. Lives on branch `prototype/m3-selection-screen` only; never merge to main.

Run: `npx vite --port 5191 --strictPort` (mock) or `VITE_OBSERVER_BACKEND=real npx vite --port 5191 --strictPort` (문경), then open
`http://localhost:5191/?variant=B&state=daily&n=1` — `variant=A|B|C`, `state=daily|practice|combat|locked|lockedc`, `n=1|2|4`.
Switch with the pink bar at the bottom (or `[` / `]`). Dev builds only; without `?variant=` the page is main's.

- `store.ts` — the address arguments, the faked scenarios (n=4 adds two fake ones), five guns, 실전 and its 300 s countdown.
- `Variants.tsx` — A 줄로 쌓기, B 판 정보 카드, C 시나리오 먼저 · 개시 바, as slots for PrepPanel and HeadBand.
- `PrototypeSwitcher.tsx` — the floating switcher and the debug strip.
- `shots.mjs` — screenshots of every variant × state × size and the narrow-screen scroll numbers.
- `sanity.mjs` — main vs this branch without `?variant=`, and a pixel diff.
- `REPORT.md` and `shots/` — the write-up and the screenshots.

Hooks (inert without `?variant=`): `src/app/main.tsx`, `src/ui/PrepPanel.tsx` (`proto` slots), `src/ui/HeadBand.tsx` (`modeName`, `extra`).
