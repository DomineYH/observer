import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { TERRAIN_FAILURES } from '@adapters/index';
import { LoadError, LOADING_TEXT } from './LoadError';

// The ticket's sentences, character for character.
const TEXT = {
  fetch: '지형 자료를 받지 못했습니다. 연결을 확인하고 다시 시도하십시오.',
  mismatch: '지형 자료가 이 판과 맞지 않습니다. 다시 시도하십시오.',
  unsupported: '이 브라우저에서는 지형 자료를 풀 수 없습니다.',
};

test('실제 지형 원천: 오류 화면', () => {
  expect(LOADING_TEXT).toBe('지형 자료를 받는 중…');
  for (const reason of TERRAIN_FAILURES) {
    const html = renderToStaticMarkup(<LoadError reason={reason} onRetry={() => {}} />);
    expect(html, reason).toMatch(/^<main role="alert">/);
    expect(html.replace(/<[^>]*>/g, '|').split('|').filter(Boolean), reason).toEqual([TEXT[reason], '다시 시도']);
    expect(html.match(/<button/g), reason).toHaveLength(1);
    expect(html, reason).not.toMatch(/mock/i);
  }
});
