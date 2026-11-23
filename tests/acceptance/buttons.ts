// The tests have no DOM. To press a button they record every <button> the components create while they are drawn and
// call its own handler: the real form with its real state makes the input, as it does for a player.
// In a test file:  vi.mock('react/jsx-dev-runtime', async (real) => recording(await real()));  (and 'react/jsx-runtime').
type ButtonProps = { children?: unknown; disabled?: boolean; onClick?: () => void; [handler: string]: unknown };
type Jsx = (type: unknown, props: ButtonProps, ...rest: unknown[]) => unknown;

const buttons: ButtonProps[] = [];

/** The JSX runtime with its element makers wrapped: each <button> made is kept, in the order drawn. */
export function recording<T extends object>(real: T): T {
  const wrapped: Record<string, Jsx> = {};
  for (const name of ['jsx', 'jsxs', 'jsxDEV']) {
    const make = (real as Record<string, Jsx | undefined>)[name];
    if (!make) continue;
    wrapped[name] = (type, props, ...rest) => {
      if (type === 'button') buttons.push(props);
      return make(type, props, ...rest);
    };
  }
  return { ...real, ...wrapped };
}

/** Draws with `draw` and gives the buttons it made whose only child is the text `label`. */
export function buttonsOf(draw: () => unknown, label: string): ButtonProps[] {
  buttons.length = 0;
  draw();
  return buttons.filter((b) => b.children === label);
}

/** Presses as a player can: a disabled button takes no press. True when it was pressed. */
export function press(button: ButtonProps | undefined): boolean {
  if (!button || button.disabled || !button.onClick) return false;
  button.onClick();
  return true;
}

/** Every button drawn, for a handler that is not a click (the 눌러서 말하기 button's press and release). */
export function allButtons(draw: () => unknown): ButtonProps[] {
  buttons.length = 0;
  draw();
  return [...buttons];
}
