# 시제품 #58: 진안 실제 지형으로 관측 화면·지도 그려 보기 (버리는 코드)

PROTOTYPE. 제품 코드가 아니다. 이 브랜치(`prototype/m2-terrain-preview`)는 #58의 질문에 답하려고 만든 일회용이다.
지형 자료(고도·피복·건물 격자)는 저장소에 넣지 않는다. 스크립트가 저장소 밖 `$M2_58_DATA`
(기본 `/home/dominelinux/wt/observer/_notes/m2-58-data`)에 만든다. 커밋하는 것은 스크립트, `src/app/main.tsx`의
`// PROTOTYPE` 스위치, 화면 캡처(`shots/`)뿐이다.

## 정사각

- 후보 C 진안 중심 35.79 N, 127.42 E → UTM 52N (EPSG:32652) (357216, 3961808), MGRS 52S CE 57216 61808.
- 정사각은 옮기지 않았다(중심을 10 m로 반올림만). #68에서 OSM 표본 확인을 한 범위(35.7439–35.8361 N,
  127.3634–127.4766 E)가 바로 이 정사각이라서다.
- 격자: `n = 1024`, `cell = 10`. 칸 (i, j)는 UTM (352100 + 10 i, 3956690 + 10 j)에 **놓인다**(마디 범위 10,230 m).
  100 km 방안 CE 안에서 동 52–62 km, 북 56–67 km라 가장자리에서 10 km 이상 떨어진다.
- 정렬: 각 마디를 UTM에서 경위도로 되돌린 뒤 원자료를 **그 점에서** 샘플링한다(고도는 원자료 화소 중심 사이
  이중선형, 피복은 가장 가까운 화소). GDAL `-te … -ts 1024`식 면적 재표본을 쓰지 않으므로 5 m 어긋남이 없다.
  GLO-30·GLO-90은 PixelIsPoint(타이포인트 = 화소 중심, 정수 각초), GEDTM30·WorldCover는 PixelIsArea(타이포인트 =
  모서리)로 읽어 중심을 계산한다(`lib.mjs` `readBox`). 도북·진북 차(약 0.9°)는 투영으로 처리된다.
- `grid`(방안 기준): 가상 `{ letters: 'CH', e0: 40000, n0: 30000 }` (mock과 같음, #67).

## 지면 세 가지 (모두 같은 정사각)

| | `ground` | `surface` |
|---|---|---|
| V1 | GEDTM30 v1.2 (맨땅) | ground + 데모 숲 높이(숲 칸) + 건물 높이 |
| V2 | GLO-30 DSM 그대로 | 같음 |
| V3 | GLO-30 − 데모 숲 높이(숲 칸) − 건물 높이 | 같음 |

- 데모 숲 높이: 숲 칸마다 12–17 m(mock 규칙, 칸별 해시). 임분고가 아니다.
- 건물: OSM `building` 다각형을 칸 마디로 래스터화. 높이는 `height`, 없으면 `building:levels`×3+1.5 m, 둘 다 없으면 6 m.
  다각형 안에 마디가 없는 작은 건물은 중심에 가장 가까운 칸 하나.
- 도로: OSM `highway` motorway–residential를 8 m 간격으로 칸에 찍어 피복 `road`로. 지도 선은 tertiary 이상과
  unclassified만, 정사각 안으로 잘라 넣었다. 지명: OSM `place=town|village|hamlet` 이름 노드.
- 군사 관련 지물은 요청하지 않았고, 응답에 섞여 와도 `military`/`landuse=military`/`building=military|bunker|barracks`는 버린다.
- 덤(질문 1의 가정 확인): `jinan-v{1,2,3}-clear.bin`은 P4 (4450, 1950) 둘레 60 m 숲을 베어 낸 판(피복 open,
  표면 = 지면). 지면은 그대로라 V3의 뺀 바닥은 남는다.

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
node build.mjs                              # 원격 범위 읽기 + Overpass 1회 → $M2_58_DATA/*.bin, stats.json
(cd ../.. && node prototype/m2-terrain/mock-dump.mjs)   # mock 비교용 mock-1.bin
node posts.mjs jinan-v2 [60]                # 관측소 후보와 북쪽 가시 비율 (60 = 둘레 60 m 벌채 가정)
node units.mjs jinan-v2                     # 기본 시나리오 점들이 놓이는 피복·지면
node profile.mjs shots                      # 숲 사면 2 km 단면 (질문 6)
node overview.mjs                           # 24 km 음영도(정사각 고르기용)
node serve.mjs 4180 &                       # 자료 파일을 CORS로 내보냄
cd ../.. && npx vite build && npx vite preview --port 5182 --host 0.0.0.0 &
# 브라우저: http://localhost:5182/?seed=1&fps=1&terrain=http://localhost:4180/jinan-v1.bin
node prototype/m2-terrain/capture.mjs http://localhost:5182 http://localhost:4180 <out dir> [chrome]
```

`capture.mjs`는 `window.__send`(PROTOTYPE 스위치)로 관측소 후보를 고르고 훈련 모드 미리보기·가시권 표시를 찍는다.
fps는 5초 동안 페이지의 requestAnimationFrame 횟수(관측 화면은 매 프레임 그린다). 실제 Chrome은 Windows 임시
폴더에 `playwright-core`를 깔고 `powershell.exe`로 `node capture.mjs … chrome`을 돌렸다.

설치한 npm 패키지: `geotiff`, `proj4` (이 폴더의 `package.json`). Windows 쪽 측정용 `playwright-core`(저장소 밖).
Overpass 요청은 Node fetch가 이 WSL에서 연결되지 않아 `curl`로 보낸다.

## 자료원과 판

- GEDTM30 v1.2, `gedtm_rf_m_30m_s_20060101_20151231_go_epsg.4326.3855_v1.2.tif` (OpenGeoHub, CC BY 4.0).
  파일은 Float32, scale/offset 태그 없음, nodata 3.4e38, 연직 EGM2008. 값이 GLO-30과 같은 범위(평균 394 m 대 401 m)라
  **m 그대로**(배율 1)로 읽었다. 문서에 "Use for testing purposes only"가 있다.
- Copernicus GLO-30 DSM `Copernicus_DSM_COG_10_N35_00_E127_00_DEM` (AWS 공개 버킷), 검산용 GLO-90 `…_COG_30_…`.
- ESA WorldCover 10 m 2021 v200, 타일 `N33E126`(33–36 N, 126–129 E가 35.79 N 127.42 E를 덮음).
- OpenStreetMap, Overpass API 1회(도로·건물·지명), 로컬 전용.

## 출처 표시

- GEDTM30: Global Ensemble Digital Terrain Model 30 m (GEDTM30) v1.2, OpenGeoHub Foundation (Ho et al. 2025), CC BY 4.0.
- Copernicus DEM: produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH
  2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.
- ESA WorldCover: © ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA
  WorldCover consortium, CC BY 4.0.
- 지도 캡처의 도로·건물·지명: © OpenStreetMap contributors, ODbL.

## 캡처 (`shots/`)

실제 Windows Chrome 156(창 띄움)에서 찍었다. `profile.png`만 headless.
`<판>-map-x1.png` 지도 전체, `<판>-<관측소>-map-x1-viewshed.png` 가시권 표시, `<판>-<관측소>-map-x3.png` 관측소 중심 ×3,
`<판>-<관측소>-eye.png`/`-bino.png` 육안·쌍안경(방위각 0020 밀, 고저 −22 밀: 게임의 처음 조준, 거의 북쪽).
판: `mock`(seed 1, 계획 관측소 P0), `v1`·`v2`·`v3`, 벌채 가정 `v1c`·`v2c`·`v3c`.
관측소: P1 (4750, 1900) 숲 없는 550 m, P2 (7350, 2100) 숲 없는 396 m, P3 (9750, 300) 숲 덮인 남동 정상 약 800 m,
P4 (4450, 1950) 벌채 가정 575 m. `profile.png` 숲 사면 단면.
