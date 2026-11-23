import { expect, test } from 'vitest';
import { VoiceInputError, VOICE_INPUT_FAILURES } from '../index';
import { fakeRecogniser, heardOf, noVoiceInput } from './voiceInput';

test('F-18: 가짜 인식기는 넘겨받은 글을 차례로 내고 다 쓰면 빈 목록을 낸다', async () => {
  const input = fakeRecogniser(['준비 쏴', '임무끝, 제압']);
  await input.open();
  // 들을 낱말 do not change what it hears; a cancelled listening uses nothing up.
  input.listen(['준비', '쏴']).cancel();
  expect(await input.listen(['준비', '쏴']).stop()).toEqual(['준비 쏴']);
  expect(await input.listen([]).stop()).toEqual(['임무끝, 제압']);
  expect(await input.listen(['준비', '쏴']).stop()).toEqual([]);
  expect(await input.listen(['준비', '쏴']).stop()).toEqual([]);
  input.close();
  expect(await fakeRecogniser([]).listen(['준비']).stop()).toEqual([]);
});

test('F-18: 가짜 인식기 — 주소의 heard를 |로 나눈다', async () => {
  expect(heardOf('')).toEqual([]);
  expect(heardOf('?seed=1')).toEqual([]);
  expect(heardOf('?heard=%EC%A4%80%EB%B9%84%20%EC%8F%B4')).toEqual(['준비 쏴']);
  expect(heardOf(`?seed=1&heard=${encodeURIComponent('기러기, 여기는 까마귀, 조정, 이상|준비 쏴')}`)).toEqual(['기러기, 여기는 까마귀, 조정, 이상', '준비 쏴']);
  const input = fakeRecogniser(heardOf('?heard=a|b'));
  expect([await input.listen([]).stop(), await input.listen([]).stop(), await input.listen([]).stop()]).toEqual([['a'], ['b'], []]);
});

test('F-18: 쓸 수 없는 브라우저의 음성 입력은 unsupported로 거절한다', async () => {
  expect(VOICE_INPUT_FAILURES).toEqual(['unsupported', 'denied', 'model']);
  const refusal = await noVoiceInput.open().catch((e: unknown) => e);
  expect(refusal).toBeInstanceOf(VoiceInputError);
  expect((refusal as VoiceInputError).reason).toBe('unsupported');
  expect(await noVoiceInput.listen(['준비']).stop()).toEqual([]);
});
