// PROTOTYPE (#58, for #60): counts OSM buildings, place names and river/water cells on a square. Counts only; the
// terrain's cover is not changed. Usage: node water.mjs <site>. One Overpass request for water (cached in
// $DATA/osm-water-<site>.json); buildings and places come from build.mjs's cache $DATA/osm-<site>.json.
// River cells: waterway=river lines stamped every 8 m (as roads). Water cells: natural=water areas (ways and
// multipolygon relations, outer rings joined; inner rings are ignored, so islands count as water).
/* global process, console */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { DATA, originOf, osmWater, readTerrain, toLonLat, toUtm } from './lib.mjs';

const site = process.argv[2];
const t = readTerrain(`${DATA}/${site}.bin`);
const { n, cell } = t;
const [X0, Y0] = originOf(site);
const [w, s] = toLonLat(X0 - 200, Y0 - 200), [e, nn] = toLonLat(X0 + 10430, Y0 + 10430);
const [w2, n2] = toLonLat(X0 - 200, Y0 + 10430), [e2, s2] = toLonLat(X0 + 10430, Y0 - 200);
const bb = `${Math.min(s, s2)},${Math.min(w, w2)},${Math.max(nn, n2)},${Math.max(e, e2)}`;
const path = `${DATA}/osm-water-${site}.json`;
if (!existsSync(path)) {
  const q = `[out:json][timeout:90];(way["waterway"="river"](${bb});way["natural"="water"](${bb});relation["natural"="water"](${bb}););out geom;`;
  execFileSync('curl', ['-sSf', '-m', '180', '--retry', '4', '--retry-delay', '30', '-A', 'terrain-prototype/0.1', '--data-urlencode', `data=${q}`, 'https://overpass-api.de/api/interpreter', '-o', path]);
}
const local = (p) => { const [x, y] = toUtm(p.lon, p.lat); return { x: x - X0, y: y - Y0 }; };
const els = JSON.parse(readFileSync(path, 'utf8')).elements;

const { river, water } = osmWater(els, local, n, cell);
let r = 0, wa = 0, either = 0, wc = 0, wcAndOsm = 0;
for (let k = 0; k < n * n; k++) {
  r += river[k]; wa += water[k];
  const osm = river[k] || water[k];
  if (osm) either++;
  if (t.cover[k] === 3) { wc++; if (osm) wcAndOsm++; }
}
const base = JSON.parse(readFileSync(`${DATA}/osm-${site}.json`, 'utf8')).elements;
const buildingWays = base.filter((x) => x.type === 'way' && x.tags?.building).length;
const buildingCells = t.buildings.reduce((a, h) => a + (h > 0 ? 1 : 0), 0);
console.log(`${site}: OSM buildings ${buildingWays} (cells ${buildingCells}), place names ${t.villages.length} [${t.villages.map((v) => v.name).join(', ')}]`);
console.log(`  river lines ${els.filter((x) => x.type === 'way' && x.tags?.waterway === 'river').length}, water areas ${els.filter((x) => x.tags?.natural === 'water').length}`);
console.log(`  cells: river ${r}, water area ${wa}, either ${either} (${((100 * either) / (n * n)).toFixed(2)}%); WorldCover water ${wc}, of them also OSM ${wcAndOsm}`);
