// The simulation's public interface. Other modules import only this (as `@sim`).
export { SIM_VERSION } from './version';
export { createSim, STEP_MS } from './sim';
export type { StreamName } from './rng';
export type * from './types';
export { replay, validateReplay, CHECKPOINT_TICKS } from './replay';
export { COVER, heightAt, surfaceAt, lineOfSight, terrainHash } from './terrain';
export type * from './terrain';
export { toGrid, fromGrid } from './grid';
