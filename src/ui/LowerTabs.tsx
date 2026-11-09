export const TABS = [
  ['input', '입력'],
  ['map', '지도'],
  ['targets', '표적'],
  ['log', '무전'],
] as const;
export type Tab = (typeof TABS)[number][0];

/** 아래 탭 (narrow screens): buttons with a pressed state. The page's CSS shows the chosen panel and hides the tabs when wide. */
export function LowerTabs({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <div role="group" aria-label="아래 탭" className="lower-tabs">
      {TABS.map(([t, name]) => (
        <button key={t} type="button" aria-pressed={t === tab} onClick={() => onTab(t)}>
          {name}
        </button>
      ))}
    </div>
  );
}
