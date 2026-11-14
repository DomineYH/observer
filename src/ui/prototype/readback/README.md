# PROTOTYPE, not product code, ticket #120 (시제품: 실전 복창 입력)

Throwaway. Lives on branch `prototype/m3-readback-input` only; never merge to main.

Run: `npx vite --port 5190 --strictPort`, then open
`http://localhost:5190/?seed=20261106&variant=A&show=text` (`variant=A|B|C`, `show=text|brief|voice`).
Switch with the pink bar at the bottom (or `[` / `]`). Dev builds only; without `?variant=` the page is main's.

- `store.ts` — which FDC messages ask for a read-back, checking, the masked 무전 기록, timings and taps.
- `ReadbackPanel.tsx` — variants A (낱말·칸 고르기), B (숫자만 받아 적기), C (가린 뒤 후보 고르기) and the debug strip.
- `PrototypeSwitcher.tsx` — the floating switcher.
- `play.mjs` — plays one mission per variant (desktop and portrait), takes screenshots, prints taps.
- `sanity.mjs` — screenshot of the page without `?variant=`, and a pixel diff.
- `REPORT.md` and `shots/` — the write-up and the screenshots.
