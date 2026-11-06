import type { Input, RecordedInput, Sim, SimEvent } from '@sim';

/** 입력 넣기 for the panels and 입력 기록 for the record: inputs wait for the next tick, and only the accepted ones are kept. */
export function createSession(sim: Sim) {
  const pending: Input[] = [];
  const log: RecordedInput[] = [];
  return {
    send(input: Input): void {
      pending.push(input);
    },
    /** One tick with every input sent since the last one. */
    step(): readonly SimEvent[] {
      const t = sim.state.tick;
      const batch = pending.splice(0);
      const { events, accepted } = sim.step(batch);
      batch.forEach((input, i) => accepted[i] && log.push({ t, ...input }));
      return events;
    },
    log: log as readonly RecordedInput[],
  };
}
