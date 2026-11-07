/** mm:ss of a tick (50 ms each). */
export const clock = (tick: number) => {
  const s = Math.floor(tick / 20);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
