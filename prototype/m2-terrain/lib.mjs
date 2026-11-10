// PROTOTYPE (#58): shared helpers for the terrain scripts. Throwaway.
/* global process, console, Buffer, TextDecoder */
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fromUrl } from 'geotiff';
import proj4 from 'proj4';

export const DATA = process.env.M2_58_DATA ?? '/home/dominelinux/wt/observer/_notes/m2-58-data';
export const UTM52 = '+proj=utm +zone=52 +datum=WGS84 +units=m +no_defs';
export const toLonLat = (x, y) => proj4(UTM52, 'WGS84', [x, y]);
export const toUtm = (lon, lat) => proj4('WGS84', UTM52, [lon, lat]);

const GLO = (res, lat, lon) => {
  const t = `Copernicus_DSM_COG_${res}_N${lat}_00_E${lon}_00_DEM`;
  return `https://copernicus-dem-${res === 10 ? 30 : 90}m.s3.amazonaws.com/${t}/${t}.tif`;
};
export const GEDTM = 'https://s3.opengeohub.org/global/dtm/v1.2/gedtm_rf_m_30m_s_20060101_20151231_go_epsg.4326.3855_v1.2.tif';
const WORLDCOVER = (tile) => `https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_${tile}_Map.tif`;
/** The candidate squares: centre as #68 checked it, and the source tiles that cover it (WorldCover tiles are 3° by SW corner). */
export const SITES = {
  jinan: { centre: [127.42, 35.79], glo30: GLO(10, 35, 127), glo90: GLO(30, 35, 127), cover: WORLDCOVER('N33E126') },
  mungyeong: { centre: [128.13, 36.76], glo30: GLO(10, 36, 128), glo90: GLO(30, 36, 128), cover: WORLDCOVER('N36E126') },
};
/** SW node of a site's square: the centre in UTM 52N minus half the 10,230 m node span, rounded to 10 m. */
export const originOf = (site) => toUtm(...SITES[site].centre).map((v) => Math.round((v - 5115) / 10) * 10);

/**
 * Reads the pixels covering a lon/lat box (plus 2 pixels) with HTTP range reads. Returns a raster with
 * `lon(c)`/`lat(r)` giving pixel-centre coordinates: PixelIsPoint tiepoints are centres, PixelIsArea tiepoints corners.
 */
export async function readBox(url, [w, s, e, n]) {
  const tif = await fromUrl(url);
  const im = await tif.getImage();
  const [ox, oy] = im.getOrigin();
  const [rx, ry] = im.getResolution(); // ry < 0
  const point = im.getGeoKeys().GTRasterTypeGeoKey === 2;
  const cx0 = point ? ox : ox + rx / 2; // centre of pixel column 0
  const cy0 = point ? oy : oy + ry / 2;
  const c0 = Math.max(0, Math.floor((w - cx0) / rx) - 2);
  const c1 = Math.min(im.getWidth(), Math.ceil((e - cx0) / rx) + 3);
  const r0 = Math.max(0, Math.floor((n - cy0) / ry) - 2);
  const r1 = Math.min(im.getHeight(), Math.ceil((s - cy0) / ry) + 3);
  const [data] = await im.readRasters({ window: [c0, r0, c1, r1] });
  return {
    data, width: c1 - c0, height: r1 - r0, point, nodata: im.getGDALNoData(),
    sampleFormat: im.getSampleFormat(), bits: im.getBitsPerSample(),
    // fractional pixel index of a coordinate inside the window
    col: (lon) => (lon - cx0) / rx - c0,
    row: (lat) => (lat - cy0) / ry - r0,
  };
}

/** Bilinear value at a lon/lat (pixel centres are the sample points). */
export function bilinear(r, lon, lat) {
  const u = r.col(lon);
  const v = r.row(lat);
  const i = Math.floor(u);
  const j = Math.floor(v);
  const fx = u - i;
  const fy = v - j;
  const at = (a, b) => r.data[b * r.width + a];
  const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** Nearest pixel value at a lon/lat. */
export const nearest = (r, lon, lat) => r.data[Math.round(r.row(lat)) * r.width + Math.round(r.col(lon))];

// --- tiny PNG writer (RGB) ---
const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'latin1');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
/** rgb: Uint8Array w*h*3, row 0 at the top. */
export function writePng(path, w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
  console.log('wrote', path);
}

/** Reads a terrain file written by build.mjs (same layout as the src/app/main.tsx PROTOTYPE loader). */
export function readTerrain(path) {
  const b = readFileSync(path);
  const buf = b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
  const len = new DataView(buf).getUint32(0, true);
  const head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, len)));
  const nn = head.n * head.n;
  let at = 4 + len + ((4 - ((4 + len) % 4)) % 4);
  const f32 = () => new Float32Array(buf, (at += nn * 4) - nn * 4, nn);
  return { ...head, ground: f32(), surface: f32(), buildings: f32(), cover: new Uint8Array(buf, at, nn) };
}

/** Writes a terrain in the layout readTerrain and the src/app/main.tsx PROTOTYPE loader read. */
export function writeTerrain(path, t, label) {
  const header = Buffer.from(JSON.stringify({ n: t.n, cell: t.cell, grid: t.grid, roads: t.roads, villages: t.villages, label }));
  const len = Buffer.alloc(4);
  len.writeUInt32LE(header.length);
  const pad = Buffer.alloc((4 - ((4 + header.length) % 4)) % 4, 32);
  const bytes = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength);
  writeFileSync(path, Buffer.concat([len, header, pad, bytes(t.ground), bytes(t.surface), bytes(t.buildings), bytes(t.cover)]));
  console.log('wrote', path);
}
