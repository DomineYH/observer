// The ci.yml `changes` classifier: only docs/, .routing/ and top-level Markdown count as docs-only; anything else runs CI.
import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';

const SCRIPT = new URL('../../.github/scripts/classify-changes.sh', import.meta.url).pathname;
const classify = (paths: string[]) => execFileSync('sh', [SCRIPT], { input: paths.map((p) => p + '\n').join('') }).toString().trim();

test('classify-changes: docs-only PRs skip, everything else runs', () => {
  expect(classify(['src/app/main.tsx'])).toBe('code=true');
  expect(classify(['docs/adr/x.md', 'src/a.ts'])).toBe('code=true');
  expect(classify(['terrain/README.md'])).toBe('code=true');
  expect(classify(['docs/adr/x.md'])).toBe('code=false');
  expect(classify(['GLOSSARY.md', '.routing/repo_checks.json'])).toBe('code=false');
  expect(classify([])).toBe('code=true');
});
