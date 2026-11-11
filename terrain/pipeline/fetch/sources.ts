// The only network code of 받기: GeoTIFF window reads over HTTP ranges, and one Overpass request through curl.
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { fromUrl } from 'geotiff';
import { retry, type Sources } from './fetch';
import { rasterOf, windowOf, type Geo } from './sample';

const CLIENT = 'observer-terrain-fetch/1'; // no personal information in requests
const RASTER_WAITS = [2000, 4000, 8000];
const OVERPASS_WAITS = [15000, 30000, 60000];

const versionOf = (pkg: string): string =>
  (JSON.parse(readFileSync(new URL(`../../../node_modules/${pkg}/package.json`, import.meta.url), 'utf8')) as { version: string }).version;

const run = promisify(execFile);

/** Overpass through curl (Node's fetch did not connect to this host). The answer stays in memory: never a file. */
async function overpassOnce(url: string, query: string): Promise<unknown> {
  let out: string;
  try {
    ({ stdout: out } = await run('curl', ['-sS', '--fail', '-m', '180', '-A', CLIENT, '--data-urlencode', `data=${query}`, url], {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    }));
  } catch (e) {
    // No cause: execFile's error carries curl's stdout, which may hold a partial answer with a military feature.
    // eslint-disable-next-line preserve-caught-error
    throw new Error(`curl exit ${(e as { code?: unknown }).code}`);
  }
  const res = JSON.parse(out) as { remark?: string };
  // Overpass answers 200 with partial elements when the query runs out of time; that is a failed attempt.
  if (res.remark !== undefined) throw new Error(`remark: ${res.remark}`);
  return res;
}

export const realSources = (): Sources => ({
  tools: { node: process.versions.node, geotiff: versionOf('geotiff'), proj4: versionOf('proj4') },
  raster: (url, box) =>
    retry(async () => {
      const im = await (await fromUrl(url, { headers: { 'User-Agent': CLIENT } })).getImage();
      const [originX, originY] = im.getOrigin() as [number, number];
      const [resX, resY] = im.getResolution() as [number, number];
      const point = im.getGeoKeys()?.GTRasterTypeGeoKey === 2; // a missing key is PixelIsArea, the GeoTIFF default
      const geo: Geo = { originX, originY, resX, resY, width: im.getWidth(), height: im.getHeight(), point };
      const win = windowOf(geo, box);
      const [data] = await im.readRasters({ window: win });
      const head = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': CLIENT } });
      if (!head.ok) throw new Error(`HEAD ${head.status}`);
      const size = Number(head.headers.get('content-length'));
      return {
        raster: rasterOf(geo, win, data as ArrayLike<number>, im.getGDALNoData()),
        pixel: point ? 'point' : 'area',
        bytes: size > 0 ? size : null,
        etag: head.headers.get('etag'),
      };
    }, RASTER_WAITS),
  overpass: (url, query) =>
    retry(() => overpassOnce(url, query), OVERPASS_WAITS).catch((e: unknown) => {
      throw new Error(`받기: Overpass에 닿지 못했다 (${new URL(url).host}, ${OVERPASS_WAITS.length + 1}번 시도, 마지막: ${(e as Error).message})`);
    }),
});
