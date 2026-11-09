import { expect, test } from 'vitest';
import { ignoreShortcut } from './shortcut';

const key = (over: Partial<Parameters<typeof ignoreShortcut>[0]> = {}) => ({
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  target: { tagName: 'BODY' } as unknown as EventTarget,
  ...over,
});
const on = (tagName: string) => key({ target: { tagName } as unknown as EventTarget });

test('B7: 단축키 무시 판정', () => {
  expect(ignoreShortcut(key())).toBe(false);
  expect(ignoreShortcut(key({ ctrlKey: true }))).toBe(true);
  expect(ignoreShortcut(key({ altKey: true }))).toBe(true);
  expect(ignoreShortcut(key({ metaKey: true }))).toBe(true);
  // Shift is the ×10/×5 multiplier, not a reason to ignore.
  expect(ignoreShortcut(Object.assign(key(), { shiftKey: true }))).toBe(false);
  for (const field of ['INPUT', 'SELECT', 'TEXTAREA']) expect(ignoreShortcut(on(field))).toBe(true);
  for (const other of ['BUTTON', 'CANVAS', 'BODY']) expect(ignoreShortcut(on(other))).toBe(false);
  expect(ignoreShortcut(key({ target: null }))).toBe(false);
});
