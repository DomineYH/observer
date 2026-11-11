# Independent cross-check of research-73-o1 computed claims with pyproj + shapely.
import json, re, sys
from pyproj import Transformer
from shapely.geometry import Point, LineString, box
T = Transformer.from_crs("EPSG:4326", "EPSG:32652", always_xy=True)
SW = (417230, 4063490)
d = json.load(open('/tmp/research-73/m2-t64-draft.json'))
items = {f"Route {k}": LineString(v) for k, v in d['routes'].items()}
for i, (x, y, r) in enumerate(d['nais'], 1): items[f"NAI {i}"] = Point(x, y).buffer(r)
hx, hy = d['mortarSpread']
for tag, (nx, ny, _), (ax, ay) in [("box NAI2 ±700/500", d['nais'][1], (hx, hy)), ("box NAI3 ±350/250", d['nais'][2], (hx/2, hy/2)), ("box NAI3 ±700/500", d['nais'][2], (hx, hy))]:
    items[tag] = box(nx-ax, ny-ay, nx+ax, ny+ay)
claims = json.load(open('/mnt/c/dev/observer/.routing/evidence/research-73-o1.json'))
worst = 0
for c in claims:
    if c.get('kind') != 'computed': continue
    f = c.get('fact') or ''
    m = re.search(r'UTM 52N \(([\d.]+), ([\d.]+)\)', f)
    if not m: continue
    e, n = float(m[1]), float(m[2])
    # find lon/lat for this claim in source text, if given
    ll = re.search(r'lon[= ]*([\d.]+)[^\d]+lat[= ]*([\d.]+)', json.dumps(c, ensure_ascii=False))
    note = ''
    if ll:
        E, N = T.transform(float(ll[1]), float(ll[2])); dd = max(abs(E-e), abs(N-n)); worst = max(worst, dd); note = f'pyproj Δ={dd:.2f} m'
    p = Point(e-SW[0], n-SW[1])
    dist = sorted((p.distance(g), k) for k, g in items.items())[:2]
    print(f"{f[:28]:28} local=({p.x:.0f},{p.y:.0f}) nearest {dist[0][1]} {dist[0][0]:.1f} m, next {dist[1][1]} {dist[1][0]:.1f} m  {note}")
print('max pyproj delta', round(worst, 3))
