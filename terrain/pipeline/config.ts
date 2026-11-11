// 가공 설정: the values a person writes for one 전장 (terrain/<id>/config.json). The 전장 식별자 is the folder name.
import { readFileSync } from 'node:fs';
import type { Cover, GridRef } from '@sim';

export interface Frame {
  proj: string; // proj4 string of the square's projected system
  x0: number; // projected position of node (0, 0), the south-west node
  y0: number;
  n: number; // nodes per side
  cell: number; // m between nodes
}

export interface Clearing {
  x: number; // m from node (0, 0)
  y: number;
  r: number;
  kind: 'planned' | 'reserve';
}

interface Source {
  name: string;
  url: string;
  license: string;
  credit: string;
}

export interface Config {
  version: number; // 지형 판
  rules: number; // 가공 규칙 판
  coverShare: Record<Cover, [number, number]> | null; // 피복 비율 범위, percent of cells, inclusive; null stops 가공
  grid: GridRef; // 방안 기준
  frame: Frame;
  clearings: Clearing[];
  sources: {
    ground: Source & { version: string; scale: number; kind: 'DTM' | 'DSM'; vertical: string; subtracted: string }; // metres = stored value · scale
    cover: Source & { version: string };
    osm: Source & { query: string }; // {{bbox}} becomes s,w,n,e
  };
}

const REQUIRED = [
  'version', 'rules', 'coverShare', 'grid', 'grid.letters', 'grid.e0', 'grid.n0', 'frame', 'frame.proj', 'frame.x0', 'frame.y0', 'frame.n', 'frame.cell', 'clearings',
  ...['ground', 'cover', 'osm'].flatMap((s) => ['name', 'url', 'license', 'credit'].map((k) => `sources.${s}.${k}`)),
  'sources.ground.version', 'sources.ground.scale', 'sources.ground.kind', 'sources.ground.vertical', 'sources.ground.subtracted', 'sources.cover.version', 'sources.osm.query',
];

export function readConfig(dir: string): Config {
  const config: unknown = JSON.parse(readFileSync(`${dir}/config.json`, 'utf8'));
  for (const path of REQUIRED) {
    const value = path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), config);
    if (value === undefined) throw new Error(`가공 설정: ${dir}/config.json에 ${path}가 없다`);
  }
  return config as Config;
}
