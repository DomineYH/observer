// The simulation's public interface. Other modules import only this (as `@sim`).
export { SIM_VERSION } from './version';
export { createSim, STEP_MS } from './sim';
export { signalAt } from './visibility';
export type { StreamName } from './rng';
export type * from './types';
export { replay, validateReplay, CHECKPOINT_TICKS } from './replay';
export { COVER, EYE_HEIGHT, heightAt, surfaceAt, lineOfSight, terrainHash, underCanopy } from './terrain';
export { moveCheck, planMove, type MoveBlock } from './post';
export type * from './terrain';
export { toGrid, fromGrid } from './grid';
export {
  SPEAKERS,
  ENDINGS,
  RADIO_KINDS,
  WARNINGS,
  LOCATION_METHODS,
  FUZE_REQUESTS,
  FUZES,
  CONTROLS,
  LATERAL_DIRS,
  RANGE_DIRS,
  NEXTS,
  EFFECTS,
  ACTIVITIES,
  TARGET_TYPES,
  TARGET_NAMES,
  UNITS,
  SLOT_RANGES,
} from './radio';
export type * from './radio';
