import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import type { Mode, RadioEvent, Sim } from '@sim';
import { MOVE, openRadio, started } from '../../tests/acceptance/mission';
import { flatTerrain } from '../../tests/acceptance/terrain';
import { PositionForm } from './PositionForm';
import { RadioLog } from './RadioLog';
import { posDraft } from './radio/drafts';

const NAMES = { callsign: '갈매기', gridLetters: 'CH' };
const GRID = flatTerrain().grid;
const text = (html: string) => html.replace(/<[^>]*>/g, '');
const form = (mode: Mode) => renderToStaticMarkup(<PositionForm op={{ x: 400, y: 320 }} grid={GRID} names={NAMES} mode={mode} send={() => {}} />);

test('B3: 위치 보고 훈련 힌트', () => {
  // The hint says what 기러기 really does: only 극좌표 is converted from the reported post (the old one when skipped);
  // 좌표법 + 방향 is untouched. The demo's hint also named the 수정량, which go along the observer's 방향.
  const training = text(form('training'));
  expect(training).toContain('기러기는 극좌표로 보낸 표적 위치를 보고한 관측소 위치에서 환산합니다');
  expect(training).toContain('보고하지 않으면 옛 위치에서 환산합니다');
  expect(training).toContain('좌표법 + 방향으로 보낸 임무에는 영향이 없습니다');
  expect(training).not.toContain('수정량');
  const standard = text(form('standard'));
  expect(standard).toContain('지도를 눌러 자기 위치를 좌표자로 읽어 넣으십시오');
  expect(standard).not.toContain('극좌표');
});

test('F-21: 위치 보고 — 입력기', () => {
  // 훈련 fills in the post's own grid; 표준 leaves it to the player. The app has no 훈련 until the mode switch: the
  // real-UI check of this prefill belongs to #38 (with #29's casualty line).
  expect(form('training')).toContain('value="4040"');
  expect(form('training')).toContain('value="3032"');
  expect(form('standard')).not.toContain('value="4040"');
  expect(text(form('standard'))).toContain('보고하지 않고 계속');
  // The preview is the sentence the simulation says for the input it sends.
  const sim: Sim = started();
  openRadio(sim);
  sim.step([MOVE(400, 320)]);
  while (sim.state.post.state !== 'ready') sim.step([]);
  const draft = posDraft('4040', '3032')!;
  const r = sim.step([draft.input]);
  expect(r.accepted).toEqual([true]);
  const said = r.events.find((e): e is RadioEvent => e.type === 'radio')!;
  expect(said.utterance).toEqual(draft.utterance);
  const preview = text(form('training').match(/<p aria-label="보낼 문장">(.*?)<\/p>/)![1]!);
  const logged = text(renderToStaticMarkup(<RadioLog lines={[said]} callsign="갈매기" gridLetters="CH" mode="training" />)).replace(/^\d\d:\d\d 갈매기 /, '');
  expect(logged).toBe(preview);
  expect(posDraft('404', '3032')).toBeNull();
  expect(posDraft('40400', '3032')).toBeNull();
});
