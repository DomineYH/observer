import { describe, expect, test } from 'vitest';
import { replay, SIM_VERSION, validateReplay } from '@sim';
import { goldenFiles, readGolden } from './golden';

describe('골든', () => {
  test('골든: simVersion이 코드와 같다', () => {
    const files = goldenFiles();
    expect(files).toContain('0-empty.json');
    for (const f of files) expect(readGolden(f).replay.simVersion, f).toBe(SIM_VERSION);
  });

  test('골든: 0번 빈 판', () => {
    const { replay: data, ...expected } = readGolden('0-empty.json');
    expect(validateReplay(data).ok).toBe(true);
    expect(expected.checkpoints.map((c) => c.tick)).toEqual([200, 400]);
    expect(replay(data)).toEqual(expected);
  });
});
