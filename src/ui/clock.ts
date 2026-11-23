/** mm:ss of a tick (50 ms each). */
export const clock = (tick: number) => {
  const s = Math.floor(tick / 20);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/** m:ss of the ticks left, rounded up to the second: a wait is shown until its last second is over. */
export const waitClock = (ticks: number) => {
  const s = Math.ceil(Math.max(0, ticks) / 20);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
