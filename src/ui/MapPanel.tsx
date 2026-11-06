// 지도 패널: a canvas the render module's drawMap paints with the terrain.
import { useEffect, useRef } from 'react';
import type { TerrainData } from '@sim';
import { drawMap, MAP_PX, mapBase } from '@render/map';

export function MapPanel({ terrain }: { terrain: TerrainData }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext('2d');
    if (!c) return;
    const { n } = terrain;
    const base = document.createElement('canvas');
    base.width = base.height = n;
    base.getContext('2d')!.putImageData(new ImageData(mapBase(terrain) as Uint8ClampedArray<ArrayBuffer>, n, n), 0, 0);
    drawMap(c, terrain, base);
  }, [terrain]);
  return <canvas ref={ref} width={MAP_PX} height={MAP_PX} role="img" aria-label="지도" />;
}
