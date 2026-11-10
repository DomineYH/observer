# 시제품 #58: 후보 전장(진안·문경) 실제 지형으로 관측 화면·지도 그려 보기 (버리는 코드)

PROTOTYPE. 제품 코드가 아니다. 이 브랜치(`prototype/m2-terrain-preview`)는 #58의 질문에 답하려고 만든 일회용이다.
지형 자료(고도·피복·건물 격자)는 저장소에 넣지 않는다. 스크립트가 저장소 밖 `$M2_58_DATA`
(기본 `/home/dominelinux/wt/observer/_notes/m2-58-data`)에 만든다. 커밋하는 것은 스크립트, `src/app/main.tsx`의
`// PROTOTYPE` 스위치, 화면 캡처(`shots/`)뿐이다.

## 정사각

| | C 진안 (`jinan`) | A 문경 (`mungyeong`) |
|---|---|---|
| 중심(#68이 확인한 그대로) | 35.79 N, 127.42 E | 36.76 N, 128.13 E |
| UTM 52N 중심 | (357216, 3961808) | (422347, 4068602) |
| SW 마디 (X0, Y0) | (352100, 3956690) | (417230, 4063490) |
| MGRS 범위 | 52S CE 52100 56690 – 62330 66920 | 52S DF 17230 63490 – 27460 73720 |

- 정사각은 옮기지 않았다(중심을 10 m로 반올림만, `lib.mjs` `originOf`). #68의 OSM 표본 확인 범위가 이 정사각이다.
  두 곳 모두 100 km 방안 가장자리에서 10 km 이상 떨어진다.
- 격자: `n = 1024`, `cell = 10`. 칸 (i, j)는 UTM (X0 + 10 i, Y0 + 10 j)에 **놓인다**(마디 범위 10,230 m).
- 정렬: 각 마디를 UTM에서 경위도로 되돌린 뒤 원자료를 **그 점에서** 샘플링한다(고도는 원자료 화소 중심 사이
  이중선형, 피복은 가장 가까운 화소). GDAL `-te … -ts 1024`식 면적 재표본을 쓰지 않으므로 5 m 어긋남이 없다.
  GLO-30·GLO-90은 PixelIsPoint(타이포인트 = 화소 중심, 정수 각초), GEDTM30·WorldCover는 PixelIsArea(타이포인트 =
  모서리)로 읽어 중심을 계산한다(`lib.mjs` `readBox`). 도북·진북 차(약 1°)는 투영으로 처리된다.
- `grid`(방안 기준): 가상 `{ letters: 'CH', e0: 40000, n0: 30000 }` (mock과 같음, #67), 두 곳 같음.

## 지형

- `ground` = GEDTM30 v1.2 (맨땅). 사용자 결정(2026-11-10)으로 기본값. o1의 V2(GLO-30 그대로)·V3(GLO-30 − 숲)는
  버렸다. o1 판 스크립트와 캡처는 커밋 `b162763`에 있다(`shots/v1-*`·`v2-*`·`v3-*`·`v?c-*`·`mock-*`·`profile.png`는 o1).
- `surface` = ground + 데모 숲 높이(숲 칸마다 12–17 m, mock 규칙, 칸별 해시. 임분고가 아니다) + 건물 높이.
- 건물: OSM `building` 다각형을 칸 마디로 래스터화. 높이는 `height`, 없으면 `building:levels`×3+1.5 m, 둘 다 없으면 6 m.
  다각형 안에 마디가 없는 작은 건물은 중심에 가장 가까운 칸 하나.
- 도로: OSM `highway` motorway–residential를 8 m 간격으로 칸에 찍어 피복 `road`로. 지도 선은 tertiary 이상과
  unclassified만, 정사각 안으로 잘라 넣었다. 지명: OSM `place=town|village|hamlet` 이름 노드.
- 군사 관련 지물은 요청하지 않았고, 응답에 섞여 와도 `military`/`landuse=military`/`building=military|bunker|barracks`는 버린다.
- GLO-30은 GEDTM30 배율 판정과 GLO-90(DSM) 거친 대조에만 쓴다.

## 관측소 벌채 규칙 (o2)

자료로 적용한다(`clear.mjs`): 관측소마다 반경 R 안의 칸은 `open`이 되고 숲·건물 높이가 없어 `surface = ground`.
그 밖은 바꾸지 않는다. R = 30 m, 60 m. 관측소는 `posts.mjs`가 고른다:

- 후보: 남쪽 1/3(y 200–3410 m, x 200–10030 m)의 국지 고점(반경 100 m 안에서 가장 높은 마디).
- 점수: 후보마다 반경 R을 베었다고 보고 북쪽 땅 가시 비율(o1과 같은 기준: 관측소 북쪽 600 m부터 y 9.9 km까지,
  x 0.3–9.9 km의 200 m 격자 표적, 15 m 간격 가시선, 눈 = 지면 + 3.5 m. 표면 가시 비율과, 숲 아닌 표적에서 선 사람
  (지면 + 1.7 m) 가시 비율). 표면 비율로 줄 세워 서로 1 km 이상 떨어진 상위 3곳을 남긴다.
- 선택 폭: 표면 30 % 이상인 후보 수(그중 1 km 이상 떨어진 수).
- `<site>-r<R>.bin`은 그 상위 3곳을 벤 지형이다.

### 피복 대응(제안)

| ESA WorldCover 2021 | COVER |
|---|---|
| 10 수목 | forest |
| 20 관목, 30 초지, 60 나지, 70 눈, 100 이끼 | open |
| 40 농경지, 90 초본 습지 | field |
| 50 시가지 | village |
| 80 영구 수면 | water |
| 95 맹그로브 | forest |
| (OSM 도로 칸) | road |
| (OSM 건물 칸) | building |

건물 > 도로 > WorldCover 순으로 덮어쓴다.

## 다시 만들기

```bash
cd prototype/m2-terrain && npm ci           # geotiff, proj4 (이 폴더 전용 의존성)
node build.mjs jinan; node build.mjs mungyeong   # 원격 범위 읽기 + Overpass 1회씩 → $M2_58_DATA/<site>.bin, stats-<site>.json
for s in jinan mungyeong; do for R in 30 60; do node posts.mjs $s $R; node clear.mjs $s $R; done; done
(cd ../.. && node prototype/m2-terrain/mock-dump.mjs)   # mock 비교용 mock-1.bin
node posts.mjs mock-1 0 5120,1800           # 고정 관측소 점수 (o1 mock 기준)
node compare.mjs jinan 60 4380,1950         # 북쪽 도로 가시, 고도 분포, 남쪽 가장자리 거울 대 실제
node units.mjs jinan                        # 기본 시나리오 점들이 놓이는 피복·지면
node water.mjs jinan                        # OSM 건물·지명·강/물 칸 집계(#60). 물 Overpass 1회 더, 피복은 안 바꿈
node overview.mjs mungyeong                 # 24 km 음영도
node serve.mjs 4180 &                       # 자료 파일을 CORS로 내보냄
cd ../.. && npx vite build && npx vite preview --port 5182 --host 0.0.0.0 &
# 브라우저: http://localhost:5182/?seed=1&fps=1&terrain=http://localhost:4180/jinan-r60.bin
node prototype/m2-terrain/runs.mjs runs.json
node prototype/m2-terrain/capture.mjs http://localhost:5182 http://localhost:4180 <out dir> chrome runs.json
```

`capture.mjs`는 `window.__send`(PROTOTYPE 스위치)로 관측소 후보를 고르고 훈련 모드 미리보기·가시권 표시를 찍는다.
fps는 5초 동안 페이지의 requestAnimationFrame 횟수(관측 화면은 매 프레임 그린다). 실제 Chrome은 Windows 임시
폴더에 `playwright-core`를 깔고 `powershell.exe`로 `node capture.mjs … chrome`을 돌렸다.

설치한 npm 패키지: `geotiff`, `proj4` (이 폴더의 `package.json`). Windows 쪽 측정용 `playwright-core`(저장소 밖).
Overpass 요청은 Node fetch가 이 WSL에서 연결되지 않아 `curl`로 보낸다.

## 3차 (#72): 문경, 벌채 100 m, 접근로 초안

- `build72.mjs [fallback]`: #58 캐시(표본 `.f32`, `osm-mungyeong.json`, `osm-water-mungyeong.json`)에서 문경을 다시 만든다.
  #60 피복표(초본 습지 90 → `open`), 덮어쓰기 건물 > 도로 > OSM 수면 > WorldCover, 터널 제외, `_link` 도로
  (Overpass 1회 더, `osm-links-mungyeong.json`). 도로선은 #59 8번 규칙(등급 trunk/main/local, 정사각에서 자름, 같은 등급의
  두 선 끝만 만나는 점에서 이음, 등급 → 긴 순 → 첫 점 y → x, 남쪽 끝에서 시작). 벌채는 #70 3절: 초안 관측소 3곳 둘레 100 m의
  **숲 칸만** `open`(아군 진지가 숲 칸이면 220 m; 초안은 해당 없음). 숲 높이 12–17 m, `fallback`이면 8–11.4 m(#70 6절).
  → `$DATA/mungyeong72.bin`(머리에 `clearings`), `mungyeong72-grades.json`.
- `measure72.mjs [terrain] [draft]`(저장소 루트에서): 시나리오 JSON `$DATA/base-mungyeong.json`을 쓰고(단위·첩보·신뢰도는
  데모 그대로, `reserveOps` 추가, `supplyRoad`는 조건에 맞는 가장 긴 선), 시뮬레이션 코드(`lineOfSight`, `createSim`의 `deploy`)로
  배치 규칙·접근로 기준(#64 결정 10)·흔들린 경로·물 칸·보급 도로·박격포 자리·무입력 판의 탐지 시각(mock 나란히)을 잰다.
- `tune72.mjs <route> <i> [r]`: 규칙을 지키는 대체 점 찾기. `runs72.mjs`: 캡처 목록.
- 앱: `?terrain=<url>&scenario=<url>`(`src/app/main.tsx`의 `// PROTOTYPE (#72)` 스위치). `serve.mjs`가 `.json`도 내보낸다.

```bash
node prototype/m2-terrain/build72.mjs
node prototype/m2-terrain/measure72.mjs mungyeong72 ~/wt/observer/_notes/m2-72-draft.json
node prototype/m2-terrain/runs72.mjs runs72.json
# 브라우저: http://localhost:5182/?seed=1&fps=1&terrain=http://localhost:4180/mungyeong72.bin&scenario=http://localhost:4180/base-mungyeong.json
```

캡처(`shots/`): `mg72-map-x1.png`, `mg72-<op|res1|res2>-{eye,bino,map-x1-viewshed,map-x3}.png`, `mg72-recon-{bino,eye}.png`
(작전 개시 뒤 ×8로 정찰조가 멈출 때까지 기다려 그쪽을 본 화면), 같은 세션의 mock `o3-mock-*`. 실제 Windows Chrome(창 띄움).

## 자료원과 판

- GEDTM30 v1.2, `gedtm_rf_m_30m_s_20060101_20151231_go_epsg.4326.3855_v1.2.tif` (OpenGeoHub, CC BY 4.0).
  파일은 Float32, scale/offset 태그 없음, nodata 3.4e38, 연직 EGM2008. 값이 GLO-30과 같은 범위(평균 394 m 대 401 m)라
  **m 그대로**(배율 1)로 읽었다. 문서에 "Use for testing purposes only"가 있다.
- Copernicus GLO-30 DSM 타일 `Copernicus_DSM_COG_10_N35_00_E127_00_DEM`(진안), `…_N36_00_E128_00_DEM`(문경)
  (AWS 공개 버킷), 검산용 GLO-90 `Copernicus_DSM_COG_30_N35_00_E127_00_DEM`, `…_N36_00_E128_00_DEM`.
- ESA WorldCover 10 m 2021 v200, 타일 `N33E126`(33–36 N, 126–129 E: 진안)과 `N36E126`(36–39 N, 126–129 E: 문경).
- OpenStreetMap, Overpass API 정사각마다 1회(도로·건물·지명) + 1회(`waterway=river`, `natural=water`, 3차에서 피복에 넣음) + 문경 1회(`*_link` 도로, 3차), 로컬 전용.

## 출처 표시

- GEDTM30: Global Ensemble Digital Terrain Model 30 m (GEDTM30) v1.2, OpenGeoHub Foundation (Ho et al. 2025), CC BY 4.0.
- Copernicus DEM: produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH
  2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.
- ESA WorldCover: © ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA
  WorldCover consortium, CC BY 4.0.
- 지도 캡처의 도로·건물·지명: © OpenStreetMap contributors, ODbL.

## 캡처 (`shots/`)

o2: `<site>-r<R>-map-x1.png` 지도 전체, `<site>-r<R>-best-map-x1-viewshed.png` 최선 관측소 가시권, `-best-map-x3.png`
관측소 중심 ×3(벌채 원이 보이는 크기), `-best-eye.png`/`-bino.png` 육안·쌍안경(북쪽), R = 60에서 `-best-edge-south.png`
남쪽 가장자리 쪽 육안(방위각 3220 밀). `o2-mock-*` 같은 세션의 mock. 실제 Windows Chrome 156(창 띄움).

o1:

실제 Windows Chrome 156(창 띄움)에서 찍었다. `profile.png`만 headless.
`<판>-map-x1.png` 지도 전체, `<판>-<관측소>-map-x1-viewshed.png` 가시권 표시, `<판>-<관측소>-map-x3.png` 관측소 중심 ×3,
`<판>-<관측소>-eye.png`/`-bino.png` 육안·쌍안경(방위각 0020 밀, 고저 −22 밀: 게임의 처음 조준, 거의 북쪽).
판: `mock`(seed 1, 계획 관측소 P0), `v1`·`v2`·`v3`, 벌채 가정 `v1c`·`v2c`·`v3c`.
관측소: P1 (4750, 1900) 숲 없는 550 m, P2 (7350, 2100) 숲 없는 396 m, P3 (9750, 300) 숲 덮인 남동 정상 약 800 m,
P4 (4450, 1950) 벌채 가정 575 m. `profile.png` 숲 사면 단면.
