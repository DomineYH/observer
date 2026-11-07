/** Reads VITE_OBSERVER_BACKEND (unset → mock). M1 has only mock adapters, so anything else stops startup. */
export function selectBackend(value: string | undefined): 'mock' {
  if (value === undefined || value === 'mock') return 'mock';
  throw new Error(`VITE_OBSERVER_BACKEND=${JSON.stringify(value)}: M1은 mock만 지원한다`);
}
