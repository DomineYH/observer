// 단축키 무시 조건 (spec 385, B7): a modifier held, or the focus in a field that takes typing, a choice or arrows
// (demo 1381 ignores INPUT and SELECT; TEXTAREA too). A focused button keeps the keys.
const FIELDS = new Set(['INPUT', 'SELECT', 'TEXTAREA']);

/** True when a keydown must not act as a 단축키. Shift is not a modifier here: it is the ×10/×5 multiplier. */
export const ignoreShortcut = (e: Pick<KeyboardEvent, 'ctrlKey' | 'altKey' | 'metaKey' | 'target'>) =>
  e.ctrlKey || e.altKey || e.metaKey || FIELDS.has((e.target as { tagName?: string } | null)?.tagName ?? '');
