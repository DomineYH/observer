// 지도 패널: the terrain base, roads, 1 km 방안선 and 지명 (demo drawMap, lines 1281–1310, without units yet).
import { useEffect, useRef } from 'react';
import type { TerrainData } from '@sim';
import { gridLines, mapBase } from '@render/map';

const W = 512;

export function MapPanel({ terrain }: { terrain: TerrainData }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext('2d');
    if (!c) return;
    const { n, cell } = terrain;
    const k = W / (n * cell);
    const mx = (x: number) => x * k;
    const my = (y: number) => W - y * k;

    const base = document.createElement('canvas');
    base.width = base.height = n;
    base.getContext('2d')!.putImageData(new ImageData(mapBase(terrain) as Uint8ClampedArray<ArrayBuffer>, n, n), 0, 0);
    c.imageSmoothingEnabled = true;
    c.drawImage(base, 0, 0, W, W);

    c.lineCap = c.lineJoin = 'round';
    for (const [width, colour] of [[3.2, 'rgba(60,40,20,.75)'], [1.6, 'rgba(250,240,215,.95)']] as const) {
      c.lineWidth = width;
      c.strokeStyle = colour;
      for (const road of terrain.roads) {
        c.beginPath();
        road.forEach((p, i) => (i ? c.lineTo(mx(p.x), my(p.y)) : c.moveTo(mx(p.x), my(p.y))));
        c.stroke();
      }
    }

    c.font = '9px monospace';
    c.lineWidth = 1;
    c.strokeStyle = 'rgba(20,30,60,.5)';
    c.fillStyle = 'rgba(20,25,40,.85)';
    for (const l of gridLines(terrain)) {
      const p = Math.round(l.axis === 'e' ? mx(l.at) : my(l.at)) + 0.5;
      c.beginPath();
      if (l.axis === 'e') {
        c.moveTo(p, 0);
        c.lineTo(p, W);
        if (p < W - 12) c.fillText(l.label, p + 2, 9);
      } else {
        c.moveTo(0, p);
        c.lineTo(W, p);
        if (p > 12) c.fillText(l.label, 2, p - 3);
      }
      c.stroke();
    }

    c.font = 'bold 10px monospace';
    c.textAlign = 'center';
    c.lineWidth = 3;
    c.strokeStyle = 'rgba(255,255,255,.8)';
    c.fillStyle = '#2a2418';
    for (const v of terrain.villages) {
      const x = mx(v.x);
      const y = my(v.y + v.r) - 4;
      c.strokeText(v.name, x, y);
      c.fillText(v.name, x, y);
    }
  }, [terrain]);
  return <canvas ref={ref} width={W} height={W} role="img" aria-label="지도" />;
}
