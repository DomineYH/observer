// 가공's writing side, outside rules/ (it needs node:fs and key lists): the 지형 파일 checks, the 지형 판 규칙 and
// the four writes. Every stop throws before the first write.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import type { Config } from '../config';
import { buildTerrain, type Built, type Expected } from '../rules/build';
import type { Snapshot } from '../snapshot';

/** The one serialiser for expected.json, header.json and log.json. */
export const text = (json: unknown): string => JSON.stringify(json, null, 2) + '\n';

/** The 지형 파일 header's allow list, in file order (#62). No real-world position. */
const HEADER_KEYS = ['format', 'id', 'version', 'n', 'cell', 'scale', 'grid', 'edge', 'credits', 'forest', 'roads', 'villages', 'names'];
const MAX_BYTES = 1_500_000;

const stop = (why: string): never => {
  throw new Error(`가공: ${why}`);
};

export function checkFile(file: Uint8Array): void {
  const body = gunzipSync(file);
  const L = body.readUInt32LE(0);
  const keys = Object.keys(JSON.parse(body.subarray(4, 4 + L).toString('utf8')) as object);
  if (keys.join() !== HEADER_KEYS.join()) stop(`지형 파일 머리의 키가 허용 목록과 다르다 (${keys.join(', ')})`);
  if (file.length > MAX_BYTES) stop(`지형 파일이 1.5 MB를 넘는다 (${file.length} bytes)`);
}

/** source: the 지형 원천 module folder (terrain.bin, expected.json); data: terrain/<id> (header.json, log.json). */
export interface Dirs {
  data: string;
  source: string;
}

/** 지형 판 규칙: no committed 기대값 → write · same 판 → same unpacked content and hash, the file is not rewritten ·
 *  판 + 1 → write · anything else → stop. The 판 is never raised here. */
export function writeBuild(dirs: Dirs, built: Built): void {
  const bin = join(dirs.source, 'terrain.bin');
  const exp = join(dirs.source, 'expected.json');
  let writeBin = true;
  if (existsSync(exp)) {
    const committed = JSON.parse(readFileSync(exp, 'utf8')) as Expected;
    const v = built.expected.version;
    if (!existsSync(bin)) stop('지형 기대값은 있는데 지형 파일이 없다');
    if (v === committed.version) {
      const same = gunzipSync(readFileSync(bin)).equals(gunzipSync(built.file)) && committed.hash === built.expected.hash;
      if (!same) stop('판이 같은데 내용이 다르다. 가공 설정의 version을 올린다');
      writeBin = false;
    } else if (v !== committed.version + 1) stop(`지형 판 규칙: 커밋된 판 ${committed.version}에서 ${v}로 갈 수 없다`);
  }
  mkdirSync(dirs.source, { recursive: true });
  mkdirSync(dirs.data, { recursive: true });
  if (writeBin) writeFileSync(bin, built.file);
  writeFileSync(exp, text(built.expected));
  writeFileSync(join(dirs.data, 'header.json'), text(built.header));
  writeFileSync(join(dirs.data, 'log.json'), text(built.log));
}

export async function buildAndWrite(dirs: Dirs, id: string, config: Config, snap: Snapshot): Promise<Built> {
  const built = await buildTerrain(id, config, snap);
  checkFile(built.file);
  writeBuild(dirs, built);
  return built;
}
