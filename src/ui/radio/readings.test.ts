import { expect, test } from 'vitest';
import { gridLabel } from './readings';

test('좌표 표기: 지형 자료의 방안 문자를 음성 문자로, 좌표는 네 자리로', () => {
  expect(gridLabel('AB', { e: 512, n: 3180 })).toBe('알파브라보 0512 3180');
  expect(gridLabel('CH', { e: 4300, n: 3250 })).toBe('찰리호텔 4300 3250');
});
