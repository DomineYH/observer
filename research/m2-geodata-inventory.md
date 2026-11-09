# 조사 보고서 (#53): 지형·토지피복·건물 자료 후보의 해상도·형식·크기·접근 방법

- **작업 지시서**: `research-53-o1` / 보정 `research-53-o2` (대상 이슈: `DomineYH/observer#53`, 상위 지도 에픽: `DomineYH/observer#51`)
- **조사 일자 (`retrieved_on`)**: `2026-11-09`
- **기준 커밋**: `acf3651` ([`src/sim/terrain.ts`](src/sim/terrain.ts), [`docs/adr/0006-grid-reference-comes-with-terrain-data.md`](docs/adr/0006-grid-reference-comes-with-terrain-data.md), [`PRD/OBSERVER_PRD_v0.2.md`](PRD/OBSERVER_PRD_v0.2.md))

---

## 0. 목표 전장 격자 규격 요약 (`TerrainData` 계약 및 북위 38° 기준 길이)

### 0.1 `TerrainData` 구조 및 격자 노드 대 픽셀 면적 정합성

현재 시뮬레이션 엔진([`src/sim/terrain.ts`](src/sim/terrain.ts))과 [`docs/adr/0006-grid-reference-comes-with-terrain-data.md`](docs/adr/0006-grid-reference-comes-with-terrain-data.md)가 정의하는 전장 지형 데이터(`TerrainData`) 계약은 다음과 같다.

- **격자 수 및 간격**: `n = 1024`, `cell = 10` m, 배열 원소 수 `1024 × 1024 = 1,048,576`개.
- **격자 스팬(Span)과 등록 기준(Registration) — 해결해야 할 사실관계**:
  - [`src/sim/terrain.ts`](src/sim/terrain.ts) 30행 주석은 `Cell (i, j) is index j*n + i at x = i*cell, y = j*cell`이라고 정의하고, 56행 보간 함수 `sample()`은 `const span = (t.n - 1) * t.cell;`을 사용한다. 따라서 `i, j ∈ [0, 1023]`인 **1,024개 격자 노드(node)는 `0 m`부터 `(1024 - 1) × 10 = 10,230 m`까지 `10,230 m × 10,230 m` 구간**에 놓인다.
  - 반면 `n × cell = 10,240 m` (`10.24 km × 10.24 km = 104.8576 km²`)를 외곽 경계로 삼아 GDAL의 기본 면적 픽셀(`PixelIsArea`) 방식으로 `gdalwarp -te e0 n0 (e0+10240) (n0+10240) -ts 1024 1024`를 실행하면, 생성된 1,024개 픽셀의 중심(centre)은 `e0 + 5 m, e0 + 15 m, ..., e0 + 10,235 m`에 위치하여 **`src/sim/terrain.ts`의 격자 노드(`x = i × 10 m`)와 동·북으로 각각 `5 m` 어긋난다.** 이 격자 등록 기준(노드 점 추출 vs 픽셀 면적 중심) 차이는 변환 파이프라인 설계 시 결정해야 할 기술적 사실이다(본 보고서는 특정 해법을 임의로 택하지 않는다).
- **래스터 및 벡터 배열**:
  - `ground: Float32Array` (`1,048,576 × 4 B = 4,194,304 B = 4.00 MiB`): 지면 높이(m).
  - `surface: Float32Array` (`4,194,304 B = 4.00 MiB`): 표면 높이(지면 + 숲 + 건물, m). `underCanopy`는 `surfaceAt(t, x, y) - heightAt(t, x, y) > 3` m로 판정한다([`src/sim/terrain.ts`](src/sim/terrain.ts)).
  - `cover: Uint8Array` (`1,048,576 × 1 B = 1,048,576 B = 1.00 MiB`): `COVER = ['open', 'field', 'forest', 'water', 'road', 'village', 'building']` 인덱스(`0`~`6`).
  - `buildings: Float32Array` (`4,194,304 B = 4.00 MiB`): 셀별 건물 높이(m, `0` = 없음).
  - `roads: readonly (readonly Point[])[]`: 도로 중심선 폴리라인(국지 미터 좌표).
  - `villages: readonly Village[]`: 마을 중심 좌표(`x, y`), 반경(`r`), 이름(`name`).
  - `grid: GridRef`: `{ letters: string; e0: number; n0: number }`. [`src/sim/terrain.ts`](src/sim/terrain.ts), [`src/adapters/mock/terrain/index.ts`](src/adapters/mock/terrain/index.ts)(`letters: 'CB'`), [`docs/adr/0006-grid-reference-comes-with-terrain-data.md`](docs/adr/0006-grid-reference-comes-with-terrain-data.md)에 따라 **`grid.letters`는 UTM/MGRS 대(zone, 예: `52S`) 텍스트를 포함하지 않고 100 km 방안 문자 두 글자(예: `'CB'`, `'CH'`)만 담는다.**

### 0.2 북위 38° 기준 위도·경도 1°의 실거리 산술식 (`[직접 계산]`)

본 보고서의 모든 경위도 기반 해상도·픽셀 수·도엽 크기 계산은 WGS84 타원체(`장반경 a = 6,378,137.0 m`, `편평률 f = 1 / 298.257223563`, 제1이심률 제곱 `e² = 2f - f² = 0.00669437999014`)의 **북위 `φ = 38°` (`sin 38° = 0.615661475`, `cos 38° = 0.788010754`)** 기준 실거리를 공통 적용한다.

1. **자오선 곡률반경 `M(38°)` 및 위도 1° 길이 (`Δφ = 1°`, 남북 방향)**:
   $$M(38^\circ) = \frac{a(1 - e^2)}{(1 - e^2 \sin^2 38^\circ)^{3/2}} = \frac{6,335,439.327}{(1 - 0.002537269)^{3/2}} = 6,359,629.65\text{ m}$$
   $$\text{위도 } 1^\circ\text{ 길이} = M(38^\circ) \times \frac{\pi}{180} = 110,996.48\text{ m} \approx 111.00\text{ km}$$
2. **묘유선 곡률반경 `N(38°)` 및 경도 1° 길이 (`Δλ = 1°`, 동서 방향)**:
   $$N(38^\circ) = \frac{a}{(1 - e^2 \sin^2 38^\circ)^{1/2}} = \frac{6,378,137.0}{0.998730560} = 6,386,244.48\text{ m}$$
   $$\text{경도 } 1^\circ\text{ 길이} = N(38^\circ) \times \cos 38^\circ \times \frac{\pi}{180} = 87,832.46\text{ m} \approx 87.83\text{ km}$$
3. **`10,240 m × 10,240 m` (`10.24 km`) 전장의 경위도 폭 (북위 38°)**:
   - 동서 경도 폭 (`Δλ`): `10,240 m ÷ 87,832.46 m/° = 0.116586°` (`10,230 m` 노드 스팬 기준 `0.116472°`)
   - 남북 위도 폭 (`Δφ`): `10,240 m ÷ 110,996.48 m/° = 0.092255°` (`10,230 m` 노드 스팬 기준 `0.092165°`)
4. **1:5,000 수치지형도 1도엽 (`1'30" × 1'30" = 0.025° × 0.025°`)의 실거리 (북위 38°)**:
   - 동서 폭: `87,832.46 m/° × 0.025° = 2,195.81 m` (`≈ 2.20 km`)
   - 남북 폭: `110,996.48 m/° × 0.025° = 2,774.91 m` (`≈ 2.77 km`)

---

## 1. 8대 후보 자료원 종합 요약표

| 자료원 | 해상도 / 축척 | 좌표계 (EPSG) | 배포 형식 | 받는 방법 · 키 · 1회 범위 | 핵심 속성 (분류·수고·층수·용도) | 갱신 주기 · 최신 판 식별자 | 10.24 km × 10.24 km (104.86 km²) 원자료 크기 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. 국토지리정보원 DEM** ([국토정보플랫폼](https://map.ngii.go.kr/mn/mainPage.do), [공공데이터포털](https://www.data.go.kr/data/15059920/fileData.do), [고시 제2026-283호](https://www.law.go.kr/LSW/admRulInfoR.do?urlMode=admRulLsInfoP&mobile=Y&chrClsCd=010202&admRulSeq=2100000272806)) | **1 m** (항공LiDAR), **5 m** (1:5,000 지형도 보간), **90 m** (공개DEM) | 수평: **EPSG:5186** (중부, 지역별 5185~5188) / **EPSG:5179** (UTM-K)<br>수직: 정표고 (KNGeoid, m) | GeoTIFF (`.tif`), ERDAS `.img`, ASCII (`.txt`/`.asc`) | 포털 파일 다운로드 (API 키 없음). **90 m 공개DEM도 로그인 및 대용량 파일전송 S/W 필요**([`data.go.kr/15059920`](https://www.data.go.kr/data/15059920/fileData.do)). **5 m·1 m는 '공개제한' 자료**로 학술연구 등 목적에 한해 심사 후 **1:5,000 도엽 단위**(약 2.20×2.77 km) 제공([`research-52-o1.md`](.routing/evidence/research-52-o1.md)) | 지면 해발고도 **DTM** (소수 2자리 m). 건물·수관 높이 없음 | 지형변화 수시·연차 갱신 (`국토교통부 국토지리정보원_DEM_20240924`, 수정 `2025-06-17`; 고시 제2026-283호 시행 `2026-01-13`) | **[직접 계산]** 북위 38° 기준 **20~30도엽** (동서 5~6열 × 남북 4~5행).<br>5 m Float32 비압축: 순수 영역 **16.78 MB** (20~30도엽 합산 약 **21.1~31.7 MB**; ASCII 시 순수 영역 ~117.4 MB).<br>1 m Float32 비압축: **419.43 MB** |
| **2. 환경부 토지피복지도** ([EGIS](https://egis.me.go.kr/main.do), [소개](https://aid.mcee.go.kr/intro/land.do), [훈령 제4호](https://www.law.go.kr/LSW/admRulInfoR.do?urlMode=admRulLsInfoP&mobile=Y&chrClsCd=010202&admRulSeq=2100000268062)) | 대분류 **30 m** (1:50,000)<br>중분류 **5 m** (1:25,000)<br>세분류 **1 m** (1:5,000) | **EPSG:5186** (GRS80 중부원점 X=600,000, Y=200,000; 구판은 5181/5174) | 벡터 **SHP** (폴리곤), 래스터 **GeoTIFF**, PDF 지도첩 | EGIS 포털 로그인 및 온라인 자료신청 후 **도엽 단위** 다운로드 (API 키 없음; 군사·보안시설 포함 공개제한 도엽은 온라인 제공 불가) | **대분류 7 / 중분류 22 / 세분류 41개** 3자리 코드(`111`~`721`). 도로(`154`), 논(`211`·`212`), 밭(`221`·`222`), 산림(`311`~`331`), 하천(`711`) 포함. **수고·건물높이 없음** | 권역별 연차 갱신 (훈령 제4호 시행 `2025-11-11`, `data.go.kr/15152095` 수정 `2025-11-12`) | **[직접 계산]** 세분류 **20~30도엽**, 중분류 **1~4도엽**.<br>래스터(Uint8) 비압축: 대분류 **116.96 KB**, 중분류 **4.19 MB**, 세분류 **104.86 MB** (도엽 SHP ZIP 실측은 미확인) |
| **3. 산림청 임상도** ([공공데이터포털](https://www.data.go.kr/data/15093362/fileData.do), [FGIS](https://www.forest.go.kr/newkfsweb/html/HtmlPage.do?pg=/fgis/UI_KFS_5002_020100.html&mn=KFS_02_04_03_04_01&orgId=fgis), [코드정의서 PDF](https://www.forest.go.kr/kfsweb/cmm/fms/FileDown.do?atchFileId=FILE_000000020078723&fileSn=0&dwldHistYn=N&bbsId=BBSMSTR_1019&dnldCntYn=Y)) | **1:5,000** (대축척, 전국 18,251도엽) 및 **1:25,000** (750도엽) | **EPSG:5186** (GRS80 중부) 및 **EPSG:5179** (UTM-K) | 벡터 **SHP** (폴리곤, 테이블 `TB_FGDI_IM5000`) | FGIS·공공데이터포털에서 로그인·신청 목적 입력 후 **시군구 또는 1:5,000 도엽 단위** 무료 다운로드 (API 키 없음) | 임상(`FRTP_CD` 1~4), **수종그룹**(`KOFTR_GROU` 10~99), **경급**(`DMCLS_CD` 0~3), **영급**(`AGCLS_CD` 1~9), **밀도**(`DNST_CD` A~C), **임분고/수고**(`HEIGHT`/`HEIGT_CD` `00`~`40`, 2 m 간격) 모두 보유 | 5년 주기 현행화 + 연차 갱신 (`산림청_임상도(산림공간정보)_20241231`, 수정 `2026-10-06`) | **[직접 계산]** 1:5,000 기준 **20~30도엽** (또는 1~2개 시군구). 도엽 SHP ZIP 실측 크기는 로그인 제한으로 미확인 |
| **4. 국토부 건물통합정보** ([V-World 전국](https://www.vworld.kr/dtmk/dtmk_ntads_s002.do?svcCde=NA&dsId=18), [V-World 시군구](https://www.vworld.kr/dtmk/dtmk_ntads_s002.do?dsId=30524&svcCde=MK), [공공데이터포털](https://www.data.go.kr/data/15083092/fileData.do)) | **1:1,000 / 1:5,000** 연속수치지형도 건물 외곽선 + 건축물대장 | **EPSG:5186** (`2023-08-08` 이후; `2023-08-05` 이전은 EPSG:5174) | 벡터 **SHP** (폴리곤) + 마스터 **CSV** | V-World·공공데이터포털에서 **전국(6,605 MB) 또는 시군구별 SHP** 일괄 다운로드(API 키 불필요) 또는 V-World WFS/Data API(키 필수) | 총 26개 필드(`A0`~`A25`): **지상층수**(`GRND_FLR`), **지하층수**(`UGRND_FLR`), **건물높이 m**(`HEIGHT`), **용도코드**(`USABILITY`), 구조(`STRCT_CD`), 면적, 건물명(`BLD_NM`) | 전체 **월간**, 변동 **일간** (`국토교통부_GIS건물통합정보_20260809`, 전국 14,422,486건) | **[실측]** 전국 SHP **6,605 MB**, 농촌·중소 시군구 1곳 압축 SHP **2.5~15 MB**.<br>**[직접 계산]** 104.86 km² 전국 면적비례 평균 **6.90 MB** |
| **5. V-World 오픈플랫폼** ([API 레퍼런스](https://www.vworld.kr/dev/v4apiRefer.do), [2D 데이터 API 2.0](https://www.vworld.kr/dev/v4dv_2ddataguide2_s002.do?svcIde=), [WMTS](https://www.vworld.kr/dev/v4dv_wmtsguide_s001.do)) | 배경타일 레벨 6~19, 벡터 레이어 158종, 다운로드 737종 | 타일: **EPSG:3857**<br>2D API: **EPSG:4326, 3857, 5179, 5180~5188** 선택 가능 | WMTS 타일(`PNG`/`JPG`), 2D API(`GeoJSON`/`XML`), 다운로드(`SHP`/`CSV`/`IMG`) | API는 **무료 인증키(`key`) 필수**. 2D Data API는 **1회 BOX/POLYGON 면적 ≤ 2 km²**, **페이지당 최대 1,000건(`size≤1000`)** 제한 | 레이어별 상이: 건물(`LT_C_SPBD`), 도로(`LT_L_SPRD`), 연속지적도(`LP_PA_CBND_BUBUN`) 등 158종. 원시 DEM API는 미제공 | 레이어별 일간·월간·수시 갱신 (`2026-10-20` 등) | **[직접 계산]** 104.86 km²를 2D API(1회 ≤ 2 km²)로 조회 시 **최소 53회 분할 요청** + 페이지네이션 필요 |
| **6. ESA WorldCover** ([AWS S3 Readme](https://esa-worldcover.s3.eu-central-1.amazonaws.com/readme.html), [Zenodo v200](https://zenodo.org/api/records/7254221)) | **1/12,000°** (0.3", 북위 38°에서 동서 **7.32 m** × 남북 **9.25 m**) | **EPSG:4326** (WGS84 경위도) | **Cloud Optimized GeoTIFF (COG)**, 8-bit `Uint8` (DEFLATE 압축) | AWS S3 / Zenodo **무인증·키 없음**. `3°×3°` 타일(36,000×36,000 px) 통째 다운로드 또는 HTTP Range(`/vsicurl/`) 부분 읽기 | **11개 분류 코드** (`10` 수목, `20` 관목, `30` 초지, `40` 농경지, `50` 시가지, `60` 나지, `70` 설빙, `80` 수역, `90` 습지, `95` 맹그로브, `100` 이끼). **도로 분리·수고 없음** | 정적 연간판 2종: `2020 v100` (`2021-10-20`), **`2021 v200`** (`2022-10-28`). 이후 신규 판 없음 | **[실측]** 남한 본토 `3°×3°` 타일(`N36E126`) **87.37 MB** (83.32 MiB).<br>**[직접 계산]** 북위 38° 10.24 km 전장 **`1,399 × 1,107` px** (`1,548,693` px) 비압축 **`1.55 MB`** (`1.48 MiB`) |
| **7. Copernicus DEM** ([AWS S3 Readme](https://copernicus-dem-30m.s3.amazonaws.com/readme.html), [EUSP 가이드](https://egnos.gsc-europa.eu/sites/default/files/2025-07/Guide%20on%20Copernicus%20DEM%20GLO%20-%2030%20for%20Flight%20Procedure%20Design.pdf)) | **GLO-30**: 1" (북위 38°에서 동서 **24.40 m** × 남북 **30.83 m**)<br>**GLO-90**: 3" (동서 73.19 m × 남북 92.50 m) | 수평: **EPSG:4326** (WGS84)<br>수직: **EGM2008** (`EPSG:3855`) | **Cloud Optimized GeoTIFF (COG)**, 32-bit `Float32` (DEFLATE 압축) | AWS S3 (`s3://copernicus-dem-30m/`) **무인증·키 없음**. `1°×1°` 타일(3,600×3,600 px) 다운로드 또는 HTTP Range 부분 읽기 | **DSM (수치표면모형)**: 건물·산림 수관 상단이 포함된 표고(m). 순수 지면(DTM)과 수관고 분리 불가 | 2011~2015 TanDEM-X 관측 기반 유지보수 릴리스 (`2019_1` ~ `2024_1`) | **[실측]** `1°×1°` 타일 `N37_00_E127_00` **49.40 MB**, `N38_00_E127_00` **46.33 MB** (GLO-90은 **5.85 MB**).<br>**[직접 계산]** 북위 38° 10.24 km 전장 GLO-30 **`420 × 332` px** (`139,440` px) 비압축 **`557.76 KB`** (`544.69 KiB`) |
| **8. OSM / Overture Maps** ([Geofabrik 한국](https://download.geofabrik.de/asia/south-korea.html), [Overture STAC](https://stac.overturemaps.org/2026-10-21.0/catalog.json), [Overture Docs](https://docs.overturemaps.org/getting-data/)) | 벡터 (원천 축척 혼합: 위성·항공·크라우드소싱·공공데이터) | **EPSG:4326** (WGS84 경위도) | OSM: `.osm.pbf`, `.shp.zip`, `.gpkg.zip`<br>Overture: **GeoParquet** (Zstd), `PMTiles` | **무인증·키 없음**. Geofabrik은 국가 단위 덤프(또는 Overpass API bbox 질의); Overture는 S3에서 DuckDB/CLI로 **10.24 km bbox만 HTTP Range 원격 추출** 가능 | **건물**(`height`, `num_floors`/`building:levels`, `subtype`), **도로**(`highway`/`class`, `road_surface`), **토지피복/수계**(`land_cover`, `water`), **마을 지명**(`places`/`divisions`) | OSM: **일간** (`south-korea-261108`, `2026-11-08`)<br>Overture: **월간** (최신 **`2026-10-21.0`**, 스키마 `v2.0.0`) | **[실측]** Geofabrik 한국 전체 `.osm.pbf` **291.30 MB**, `.shp.zip` **590.33 MB**.<br>**[직접 계산]** 10.24 km 전장 면적비례 평균 OSM PBF **~304 KB** (SHP **~616 KB**) |

---

## 2. 자료원별 상세 조사 결과

### 2.1 국토지리정보원(NGII) 수치표고모형 (DEM)

- **공식 출처**:
  - 국가법령정보센터 행정규칙: [「수치표고모형의 구축 및 관리 등에 관한 규정」 (국토지리정보원고시 제2026-283호, 시행 2026. 1. 13.)](https://www.law.go.kr/LSW/admRulInfoR.do?urlMode=admRulLsInfoP&mobile=Y&chrClsCd=010202&admRulSeq=2100000272806)
  - 국가법령정보센터 행정규칙: [「1/5000 지형도도식규정」 (국토지리정보원고시 제2009-583호)](https://www.law.go.kr/LSW/admRulInfoR.do?urlMode=admRulLsInfoP&mobile=Y&chrClsCd=010202&admRulSeq=2000000070540)
  - 공공데이터포털 파일데이터: [국토교통부 국토지리정보원_DEM_20240924 (`https://www.data.go.kr/data/15059920/fileData.do`)](https://www.data.go.kr/data/15059920/fileData.do)
  - 국토정보플랫폼: [https://map.ngii.go.kr/mn/mainPage.do](https://map.ngii.go.kr/mn/mainPage.do)
  - 이용 조건 및 보안 등급 조사 보고서: [`.routing/evidence/research-52-o1.md`](.routing/evidence/research-52-o1.md)
- **해상도 및 좌표계(EPSG)**:
  - **격자 간격**:
    1. **1 m 격자**: 항공레이저측량(LiDAR, 점밀도 2.5점/m² 이상) 기반 수치지면자료에서 구축(고시 제12조, 제36조, 제40조).
    2. **5 m 격자**: 1:5,000 수치지형도의 등고선·표고점 등을 불규칙삼각망(TIN)·크리깅·공삼차보간으로 보간하여 남한 전역 연속 구축(고시 제46조~제48조, 제55조제2항).
    3. **90 m 격자**: 한반도 전역 공개 가능 수치표고모형(고시 제55조제1항).
  - **수평 좌표계**: 세계측지계(ITRF2000, GRS80 타원체) 기반 평면직각좌표계(중부원점 **EPSG:5186**, 서부 **EPSG:5185**, 동부 **EPSG:5187**, 동해 **EPSG:5188**) 및 단일원점 **UTM-K (EPSG:5179)** (고시 제5조제1항).
  - **수직 기준**: 인천만 평균해수면 기준 최신 국가지오이드모델(KNGeoid)을 적용한 **정표고**(orthometric height, 단위 m, 소수점 둘째 자리까지 기록, 고시 제5조제2항·제43조제1항).
- **배포 형식 및 도엽 규격**:
  - 1:5,000 수치지형도 도엽 단위(1:50,000 지형도 15'×15'을 100등분한 **위도 1'30" × 경도 1'30"**, §0.2의 북위 38° 실거리 기준 **동서 `2,195.81 m` × 남북 `2,774.91 m`**)로 분할 저장하며, 도엽 간 접합을 위해 **도곽보다 사방 50 m 크게 제작**한다(고시 제43조제2항).
  - 파일 형식은 GeoTIFF(`.tif`), ERDAS Imagine(`.img`), ASCII 텍스트(`.txt`/`.asc`) 형식으로 유통된다(고시 제43조제3항 별표6 및 [`data.go.kr/15059920`](https://www.data.go.kr/data/15059920/fileData.do)).
- **받는 방법 (일괄 vs API, 키 유무, 로그인·보안 제한)**:
  - OpenAPI/타일 API 형태가 아니라 **국토정보플랫폼(`map.ngii.go.kr`)에서 영역/도엽 선택 후 파일 내려받기** 방식이다(API 키 불필요).
  - **90 m 공개DEM 로그인 및 전송 S/W 필수**: 공공데이터포털 [`data.go.kr/data/15059920/fileData.do`](https://www.data.go.kr/data/15059920/fileData.do)의 `기타 유의사항` 및 `설명`에는 다음과 같이 명시되어 있다:
    > `"이용방법 : 포털접속 → 간편지도 검색 선택 → 항목 선택(ex: 인덱스, 영역, 반경 ...) → 영역 지정 및 선택 → 공개DEM 선택 → 항목 선택 (다운로드를 위해서는 로그인이 필요합니다)"`
    > `"국토정보플랫폼 다운로드를 위해서는 대용량 파일전송 S/W가 필요합니다."`
  - **5 m / 1 m DEM의 공개제한 등급**: [`.routing/evidence/research-52-o1.md`](.routing/evidence/research-52-o1.md) (§1 및 §2.1)에 정리된 바와 같이, 「국토지리정보원 공간정보 공급 규정」(국토지리정보원고시 제2015-1530호) 제28조제2항 및 「국토지리정보원 국가공간정보 보안관리규정」(국토지리정보원예규 제199호) [별표 1]에 따라 해상도가 90 m보다 정밀한 5 m·1 m DEM은 **'공개제한'** 자료로서 학술연구·공공복리 등의 목적일 경우에만 확인·검토하여 제공되며 무단 복제·유출·일반 재배포가 금지된다.
- **속성**:
  - 인공지물과 식생을 제거한 **순수 지면 표고(bare-earth DTM)** 값만 가진다(고시 제35조~제36조). 건물 높이나 산림 수관 높이는 들어 있지 않다.
- **갱신 주기와 판 식별자**:
  - 연차별 항공레이저측량 및 1:5,000 수치지형도 수정 사업에 맞춰 수시·연차 갱신한다([`data.go.kr/15059920`](https://www.data.go.kr/data/15059920/fileData.do) 기준 `국토교통부 국토지리정보원_DEM_20240924`, 수정일 `2025-06-17`; 현행 고시 제2026-283호 시행일 `2026-01-13`).
- **10.24 km × 10.24 km 한 전장의 원자료 크기 (`[직접 계산]`)**:
  - **필요 도엽 수 (북위 38° 기준)**: 1:5,000 도엽 1매가 동서 `2,195.81 m` × 남북 `2,774.91 m`(§0.2)이므로, `10,240 m × 10,240 m` 전장은 동서 `10,240 ÷ 2,195.81 = 4.66`도엽 폭(도곽 경계 걸침에 따라 **5~6열**) × 남북 `10,240 ÷ 2,774.91 = 3.69`도엽 폭(**4~5행**) = **총 20~30개 도엽**이 필요하다.
  - **5 m DEM 격자 크기**:
    - 전장 순수 영역(`10,240 m × 10,240 m`): `(10,240 / 5) × (10,240 / 5) = 2,048 × 2,048 = 4,194,304` 격자점 (`10,230 m` 노드 스팬 기준으로는 `2,047 × 2,047 = 4,190,209`점).
    - 32-bit Float(`4 B`/점) 비압축 GeoTIFF/IMG 기준: `4,194,304 × 4 B = 16,777,216 B` (**16.00 MiB / 16.78 MB**).
    - 도엽 1매(도곽 `2,195.81 m × 2,774.91 m` + 사방 50 m 여백 = `2,295.81 m × 2,874.91 m` → 약 `459 × 575 = 263,925`점) 기준 도엽당 Float32 비압축 크기는 `263,925 × 4 B = 1,055,700 B` (**약 1.06 MB**), 20~30도엽 합산 비압축 크기는 **약 21.1 ~ 31.7 MB**이다. ASCII(`X Y Z\n`, 점당 약 28 B) 형식이면 전장 순수 영역 기준 `4,194,304 × 28 B ≈` **117.4 MB**(20~30도엽 합산 약 148~222 MB)이다.
  - **1 m DEM 격자 크기**:
    - 전장 순수 영역: `10,240 × 10,240 = 104,857,600` 격자점.
    - Float32(`4 B`/점) 비압축 기준: `104,857,600 × 4 B = 419,430,400 B` (**400.00 MiB / 419.43 MB**).

---

### 2.2 환경부(기후에너지환경부) 토지피복지도 (EGIS)

- **공식 출처**:
  - 국가법령정보센터 행정규칙: [「토지피복지도 작성 지침」 (기후에너지환경부훈령 제4호, 시행 2025. 11. 11.)](https://www.law.go.kr/LSW/admRulInfoR.do?urlMode=admRulLsInfoP&mobile=Y&chrClsCd=010202&admRulSeq=2100000268062)
  - 환경공간정보서비스(EGIS) 토지피복지도 소개 및 분류체계표: [https://aid.mcee.go.kr/intro/land.do](https://aid.mcee.go.kr/intro/land.do) 및 자료신청 안내 [https://egis.me.go.kr/req/intro.do](https://egis.me.go.kr/req/intro.do)
- **해상도·축척·좌표계(EPSG)**:
  - **3단계 등급 체계** (훈령 제4조, 제6조):
    1. **대분류 토지피복지도**: 해상도 **30 m급**, 축척 **1:50,000** (`15' × 15'` 도곽), **7개 분류 항목**.
    2. **중분류 토지피복지도**: 해상도 **5 m급**, 축척 **1:25,000** (`7'30" × 7'30"` 도곽), **22개 분류 항목**.
    3. **세분류 토지피복지도**: 해상도 **1 m급**, 축척 **1:5,000** (`1'30" × 1'30"` 도곽), **41개 분류 항목**.
  - **기준 좌표계**: 세계측지계(GRS80) **중부원점**(북위 38°, 동경 127°, 가산수치 `X(N) = 600,000 m, Y(E) = 200,000 m`) = **EPSG:5186** (훈령 제6조제2항). (단, 초기 구축 차수는 Bessel `EPSG:5174` 또는 구 GRS80 `EPSG:5181` 이력 존재).
- **배포 형식 및 받는 방법**:
  - **배포 형식**: 벡터 **SHP**(폴리곤), 래스터 **GeoTIFF**, 인터넷 서비스용 **PDF 도면**(훈령 제15조, 제27조, 제28조).
  - **받는 방법**: 환경공간정보서비스(`egis.me.go.kr/req/intro.do`)에서 로그인 후 온라인 자료신청을 통해 도엽 단위로 내려받으며 API 키는 필요하지 않다(단, 군사·보안시설 등이 포함된 공개제한 도엽은 온라인 제공이 불가하며 공문 신청 및 방문 수령 대상임, [`.routing/evidence/research-52-o1.md`](.routing/evidence/research-52-o1.md) §2.2 참조).
- **갱신 주기와 판 식별자**:
  - 세분류 토지피복지도는 권역별 연차 갱신되며 도엽별 이력정보에 촬영년도 및 고시번호가 부여된다(훈령 제26조). 현행 작성 지침은 **기후에너지환경부훈령 제4호(2025. 11. 11. 시행)**이다.
- **속성: 토지피복 분류 체계와 전체 코드표 (대분류 7 / 중분류 22 / 세분류 41)** ([훈령 제14조·제17조](https://www.law.go.kr/LSW/admRulInfoR.do?urlMode=admRulLsInfoP&mobile=Y&chrClsCd=010202&admRulSeq=2100000268062), [EGIS 분류표](https://aid.mcee.go.kr/intro/land.do)):

| 대분류 (7종) | 중분류 (22종) | 세분류 (41종) 코드 및 항목명 |
| :--- | :--- | :--- |
| **100** 시가화·건조지역 | **110** 주거지역 | `111` 단독주거시설, `112` 공동주거시설 |
| **100** 시가화·건조지역 | **120** 공업지역 | `121` 공업시설 |
| **100** 시가화·건조지역 | **130** 상업지역 | `131` 상업·업무시설, `132` 혼합지역 |
| **100** 시가화·건조지역 | **140** 문화·체육·휴양지역 | `141` 문화·체육·휴양시설 |
| **100** 시가화·건조지역 | **150** 교통지역 | `151` 공항, `152` 항만, `153` 철도, `154` 도로, `155` 기타 교통·통신시설 |
| **100** 시가화·건조지역 | **160** 공공용지 | `161` 환경기초시설, `162` 교육·행정시설, `163` 기타 공공시설 |
| **200** 농업지역 | **210** 논 | `211` 경지정리가 된 논, `212` 경지정리가 안 된 논 |
| **200** 농업지역 | **220** 밭 | `221` 경지정리가 된 밭, `222` 경지정리가 안 된 밭 |
| **200** 농업지역 | **230** 시설재배지 | `231` 시설재배지 (비닐하우스·유리온실 등) |
| **200** 농업지역 | **240** 과수원 | `241` 과수원 |
| **200** 농업지역 | **250** 기타재배지 | `251` 목장·양식장, `252` 기타재배지 (원예·묘포원) |
| **300** 산림지역 | **310** 활엽수림 | `311` 활엽수림 (활엽수 면적 75% 이상) |
| **300** 산림지역 | **320** 침엽수림 | `321` 침엽수림 (침엽수 면적 75% 이상) |
| **300** 산림지역 | **330** 혼효림 | `331` 혼효림 (침·활 혼재, 각 75% 미만) |
| **400** 초지 | **410** 자연초지 | `411` 자연초지 |
| **400** 초지 | **420** 인공초지 | `421` 골프장, `422` 묘지, `423` 기타초지 |
| **500** 습지 | **510** 내륙습지 | `511` 내륙습지 (수변식생) |
| **500** 습지 | **520** 연안습지 | `521` 갯벌, `522` 염전 |
| **600** 나지 | **610** 자연나지 | `611` 해변, `612` 강기슭, `613` 암벽·바위 |
| **600** 나지 | **620** 인공나지 | `621` 채광지역, `622` 운동장, `623` 기타나지 (절성토·비포장도로·임도 등) |
| **700** 수역 | **710** 내륙수 | `711` 하천, `712` 호소 |
| **700** 수역 | **720** 해양수 | `721` 해양수 |

  - **한계**: 산림(`311, 321, 331`)에 수고(나무 높이)·영급 속성이 없고, 시가화·건조지역(`111`~`163`)에도 개별 건물 높이나 층수 속성이 없다(훈령 제17조).
- **10.24 km × 10.24 km 한 전장의 원자료 크기 (`[직접 계산]`)**:
  - **도엽 수 (북위 38° 기준, §0.2)**:
    - 세분류(1:5,000, `1'30"×1'30"` = 동서 `2,195.81 m` × 남북 `2,774.91 m`): 동서 5~6열 × 남북 4~5행 = **20~30도엽**.
    - 중분류(1:25,000, `7'30"×7'30"` = `0.125°×0.125°` = 동서 `10,979.06 m` × 남북 `13,874.56 m`): **1~4도엽**.
    - 대분류(1:50,000, `15'×15'` = `0.25°×0.25°` = 동서 `21,958.12 m` × 남북 `27,749.12 m`): **1~2도엽**.
  - **래스터(`Uint8`, 픽셀당 1 B) 환산 비압축 크기**:
    - 대분류(30 m 격자): `⌈10,240 / 30⌉ × ⌈10,240 / 30⌉ = 342 × 342 = 116,964 B` (**114.22 KiB / 116.96 KB**).
    - 중분류(5 m 격자): `(10,240 / 5) × (10,240 / 5) = 2,048 × 2,048 = 4,194,304 B` (**4.00 MiB / 4.19 MB**).
    - 세분류(1 m 격자): `10,240 × 10,240 = 104,857,600 B` (**100.00 MiB / 104.86 MB**).
  - 벡터 SHP 형식의 실제 도엽별 ZIP 바이트 크기는 로그인/신청 제한으로 미확인 항목(§4)에 기재하였다.

---

### 2.3 산림청 임상도 (FGIS)

- **공식 출처**:
  - 공공데이터포털 파일데이터: [산림청_임상도(산림공간정보)_20241231 (`https://www.data.go.kr/data/15093362/fileData.do`)](https://www.data.go.kr/data/15093362/fileData.do)
  - 산림청 산림공간정보서비스(FGIS) 임상도 안내: [https://www.forest.go.kr/newkfsweb/html/HtmlPage.do?pg=/fgis/UI_KFS_5002_020100.html&mn=KFS_02_04_03_04_01&orgId=fgis](https://www.forest.go.kr/newkfsweb/html/HtmlPage.do?pg=/fgis/UI_KFS_5002_020100.html&mn=KFS_02_04_03_04_01&orgId=fgis)
  - 산림청 공식 『임상도(1:5,000) DB구조 및 속성정보 (`TB_FGDI_IM5000`)』 정의서 PDF: [https://www.forest.go.kr/kfsweb/cmm/fms/FileDown.do?atchFileId=FILE_000000020078723&fileSn=0&dwldHistYn=N&bbsId=BBSMSTR_1019&dnldCntYn=Y](https://www.forest.go.kr/kfsweb/cmm/fms/FileDown.do?atchFileId=FILE_000000020078723&fileSn=0&dwldHistYn=N&bbsId=BBSMSTR_1019&dnldCntYn=Y) (실측 `126,691 B`)
- **축척·좌표계(EPSG)·배포 형식**:
  - **축척**: **1:5,000 대축척 임상도**(전국 18,251도엽) 및 **1:25,000 임상도**(전국 750도엽).
  - **좌표계**: 세계측지계(GRS80) 기반 **EPSG:5186**(중부원점) 및 **EPSG:5179**(UTM-K).
  - **배포 형식**: 벡터 **SHP**(폴리곤). SHP 파일 특성(DBF 필드명 10자 제한)에 맞춰 표준영문명을 10자 이내로 단축한 필드명을 사용한다(`TB_FGDI_IM5000` 정의서 p.1).
- **받는 방법 및 갱신 주기·판 식별자**:
  - 산림공간정보서비스(FGIS) 또는 공공데이터포털에서 로그인·활용 목적 입력 후 **시군구 단위 또는 1:5,000 도엽 단위**로 무료 다운로드한다(API 키 불필요).
  - **갱신 이력 및 주기**: 전국 확대제작(2009~2013년, 16,940도엽) → 1차 현행화(2015~2019년, 17,575도엽) → 2차 현행화(2020~2024년, 18,251도엽)로 5년 주기 권역별 현행화 및 연차 갱신이 이루어진다. 공공데이터포털 최신 공개판 식별자는 **`산림청_임상도(산림공간정보)_20241231`** (수정일 `2026-10-06`)이다.
- **속성: 수종·영급·경급·밀도·수고(임분고) 유무 및 전체 코드표** ([`TB_FGDI_IM5000` 정의서 p.1~7](https://www.forest.go.kr/kfsweb/cmm/fms/FileDown.do?atchFileId=FILE_000000020078723&fileSn=0&dwldHistYn=N&bbsId=BBSMSTR_1019&dnldCntYn=Y)):
  - 1:5,000 임상도(`TB_FGDI_IM5000`, 2021 현행화 구축 속성데이터 기준)에는 **수종(`KOFTR_GROU`), 경급(`DMCLS_CD`), 영급(`AGCLS_CD`), 밀도(`DNST_CD`)뿐 아니라 임분고/수고(`HEIGHT` / `HEIGT_CD`)가 정식 속성으로 정의되어 있다.** (참고: 공공데이터포털 요약 설명문에는 6종 속성만 언급되어 있으나, 산림청 공식 테이블 정의서 PDF에서 `HEIGT_CD`/`HEIGHT` 및 `HEIGHT_NM`이 확인됨).

| 표준한글명 | 표준영문명 | SHP 단축 필드명 | 타입 | 코드값 및 의미 (`TB_FGDI_IM5000` 코드 정의서 p.2~7) |
| :--- | :--- | :--- | :--- | :--- |
| 임목존재코드 | `STORUNST_CD` | **`STORUNST`** | `VARCHAR2(2)` | `1`: 입목지, `2`: 무립목지(미립목지·제지), `0`: 비산림(초지·경작지·하천·과수원·기타) |
| 임종코드 | `FROR_CD` | **`FROR_CD`** | `VARCHAR2(2)` | `1`: 인공림(조림·파종), `2`: 천연림, `0`: 무립목지/비산림 |
| 임상코드 | `FRTP_CD` | **`FRTP_CD`** | `VARCHAR2(2)` | `1`: 침엽수림(침엽 수관 ≥75%), `2`: 활엽수림(활엽 수관 ≥75%), `3`: 혼효림(침·활 25~75%), `4`: 죽림(대나무림), `0`: 무립목지/비산림 |
| 수종그룹코드 | `KOFTR_GROU_CD` | **`KOFTR_GROU`** | `VARCHAR2(2)` | **침엽수(10~21)**: `10` 기타침엽수, `11` 소나무, `12` 잣나무, `13` 낙엽송, `14` 리기다소나무, `15` 곰솔(해송), `16` 전나무, `17` 편백나무, `18` 삼나무, `19` 가문비나무, `20` 비자나무, `21` 은행나무<br>**낙엽활엽수(30~49)**: `30` 기타활엽수, `31` 상수리나무, `32` 신갈나무, `33` 굴참나무, `34` 기타참나무류, `35` 오리나무, `36` 고로쇠나무, `37` 자작나무, `38` 박달나무, `39` 밤나무, `40` 물푸레나무, `41` 서어나무, `42` 때죽나무, `43` 호두나무, `44` 백합나무, `45` 포플러, `46` 벚나무, `47` 느티나무, `48` 층층나무, `49` 아까시나무<br>**상록활엽수(60~68)**: `60` 기타상록활엽수, `61` 가시나무, `62` 구실잣밤나무, `63` 녹나무, `64` 굴거리나무, `65` 황칠나무, `66` 사스레피나무, `67` 후박나무, `68` 새덕이<br>**기타·비산림**: `77` 침활혼효림, `78` 죽림, `81` 미립목지, `82` 제지(임도·암석지·묘지), `83` 관목덤불, `91` 주거지, `92` 초지, `93` 경작지, `94` 수체, `95` 과수원, `99` 기타 |
| 경급코드 | `DMCLS_CD` | **`DMCLS_CD`** | `VARCHAR2(2)` | `0`: 치수(흉고직경 <6 cm 수관비율 ≥51%), `1`: 소경목(6~18 cm), `2`: 중경목(18~30 cm), `3`: 대경목(≥30 cm) |
| 영급코드 | `AGCLS_CD` | **`AGCLS_CD`** | `VARCHAR2(2)` | `1`: 1영급(1~10년생 ≥50%), `2`: 2영급(11~20년생), `3`: 3영급(21~30년생), `4`: 4영급(31~40년생), `5`: 5영급(41~50년생), `6`: 6영급(51~60년생; 1:25,000에서는 51년생 이상), `7`: 7영급(61~70년생), `8`: 8영급(71~80년생), `9`: 9영급(81년생 이상) |
| 밀도코드 | `DNST_CD` | **`DNST_CD`** | `VARCHAR2(2)` | `A`: 소(교목 수관점유 ≤50%), `B`: 중(51~70%), `C`: 밀(≥71%) |
| **임분고코드 (수고)** | `HEIGT_CD` | **`HEIGHT`** | `VARCHAR2(2)` | `0`(`00`): 1 m 미만, `2`(`02`): 1~3 m, `4`(`04`): 3~5 m, `6`(`06`): 5~7 m, `8`(`08`): 7~9 m, `10`: 9~11 m, `12`: 11~13 m, `14`: 13~15 m, `16`: 15~17 m, `18`: 17~19 m, `20`: 19~21 m, `22`: 21~23 m, `24`: 23~25 m, `26`: 25~27 m, `28`: 27~29 m, `30`: 29~31 m, `32`: 31~33 m, `34`: 33~35 m, `36`: 35~37 m, `38`: 37~39 m, `40`: 39 m 이상 |
| 부가 필드 | `LDMARK_STNDA_CD`, `MAP_LABEL_CD`, `갱신년도`, `FRTP_NM`, `KOFTR_NM`, `DMCLS_NM`, `AGCLS_NM`, `DNST_NM`, `HEIGHT_NM` | `LDMARK_STN`, `MAP_LABEL`, `갱신년도` 등 | `VARCHAR2` | 지형지물표준코드(6자), 맵라벨(10자, 임종+수종-경급+영급+밀도), 갱신년도(8자) 및 각 코드 한글 명칭 |

- **10.24 km × 10.24 km 한 전장의 원자료 크기**:
  - **[직접 계산]** 북위 38° 기준 1:5,000 도엽(`2,195.81 m × 2,774.91 m`, §0.2) **20~30도엽**(또는 시군구 단위 배포본 1~2개 시군구)에 해당한다. 실제 도엽/시군구 SHP ZIP 바이트 크기는 FGIS 로그인 제한으로 미확인 항목(§4)에 기록하였다.

---

### 2.4 국토교통부 건물통합정보 (`GIS건물통합정보` / `건물통합정보_마스터`)

- **공식 출처**:
  - V-World 국가중점데이터(전국): [GIS건물통합정보 (`dsId=18`, `https://www.vworld.kr/dtmk/dtmk_ntads_s002.do?svcCde=NA&dsId=18`)](https://www.vworld.kr/dtmk/dtmk_ntads_s002.do?svcCde=NA&dsId=18)
  - V-World 오픈마켓(시군구 분할): [시군구별 GIS건물통합정보 (`dsId=30524`, `https://www.vworld.kr/dtmk/dtmk_ntads_s002.do?dsId=30524&svcCde=MK`)](https://www.vworld.kr/dtmk/dtmk_ntads_s002.do?dsId=30524&svcCde=MK)
  - 공공데이터포털 파일데이터: [국토교통부_GIS건물통합정보 (`https://www.data.go.kr/data/15083092/fileData.do`)](https://www.data.go.kr/data/15083092/fileData.do) 및 [국토교통부_건물통합정보_마스터 (`https://www.data.go.kr/data/15146873/fileData.do`)](https://www.data.go.kr/data/15146873/fileData.do)
- **해상도(원천 축척) 및 좌표계(EPSG)**:
  - 1:1,000(도시지역) 및 1:5,000(비도시지역) 수치지형도 2.0(연속수치지형도) 건물 폴리곤에 세움터 건축물대장 속성을 결합한 데이터이다.
  - **좌표계**: 데이터 기준일 **`2023-08-08` 이후는 GRS80 중부원점 `EPSG:5186`**, `2023-08-05` 이전은 Bessel 중부원점 `EPSG:5174`이다([V-World `dsId=18`](https://www.vworld.kr/dtmk/dtmk_ntads_s002.do?svcCde=NA&dsId=18)).
- **배포 형식·받는 방법·갱신 주기·판 식별자**:
  - **형식**: 벡터 **SHP**(건물 외곽선 폴리곤 + DBF) 및 **CSV**(마스터 속성).
  - **받는 방법**: V-World 공간정보 다운로드 또는 공공데이터포털에서 API 키 없이 **시군구별 ZIP 파일** 또는 **전국 통합 파일**로 일괄 다운로드한다(V-World 2D 데이터 API/WFS로도 조회 가능).
  - **갱신 주기 및 판 식별자**: 전체 데이터 **월간 갱신**, 변동 데이터 **일간 갱신**이며, 확인된 최신 공개판은 **`국토교통부_GIS건물통합정보_20260809`**(전국 총 **14,422,486건**)이다.
- **속성: 건물의 층수·높이·용도 필드 및 전체 26개 컬럼 명세** ([V-World `dsId=30524` 공식 샘플 테이블](https://www.vworld.kr/dtmk/dtmk_ntads_s002.do?dsId=30524&svcCde=MK)):

| SHP 컬럼 약어 | 표준 영문 필드명 | 한글 필드명 | 공식 샘플 데이터 값 예시 (`dsId=30524`) |
| :--- | :--- | :--- | :--- |
| `A0` | `SRC_OBJECTID` | 원천도형ID | `1721`, `3927` |
| `A1` | `UFID` | 고유식별자 | `1989205359864463920000000000` |
| `A2` | `BLDG_PNU` | 건물필지고유번호 | `4311110100100990004` |
| `A3` | `GIS_IDNTFC_NO` | 건물공간정보식별번호 | `1989205359864463920000000000` |
| `A4` | `BLD_NM` | 건물명 | `청주향교`, `(주)세원산업` |
| `A5` | `DONG_NM` | 건물동명칭 | `관리사`, `주건축물제1동` |
| `A6` | `PLATAREA` | 대지면적 (㎡) | `423`, `146` |
| `A7` | `ARCHAREA` | 건축면적 (㎡) | `124.2`, `16.86` |
| **`A8`** | **`GRND_FLR`** | **지상층수** | **`2`, `1`, `5`, `15`** |
| **`A9`** | **`UGRND_FLR`** | **지하층수** | **`0`, `1`, `2`** |
| `A10` | `TOTALAREA` | 연면적 (㎡) | `248.4`, `16.86` |
| **`A13`** | **`HEIGHT`** | **건물높이 (m)** | **`6.45`, `7.8`, `0`** |
| **`A14`** | **`STRCT_CD`** | **구조코드** | `11`(벽돌구조), `21`(철근콘크리트구조), `51`(일반목구조) |
| **`A15`** | **`USABILITY`** | **주용도코드** | **`01000`(단독주택), `02000`(공동주택), `03000`(제1종근린생활시설), `04000`(제2종근린생활시설), `17000`(공장), `18000`(창고시설)** |
| `A16`, `A17` | `BC_RAT`, `VL_RAT` | 건폐율(%), 용적률(%) | `52.53`, `55.66` |
| `A18`~`A25` | `BLDRGST_PK`, `USEAPR_DAY`, `REGIST_DAY`, `GB_CD`, `VIOL_BD_YN`, `GEOIDN`, `BLD_UNLICE`, `BD_MGT_SN`, `SGG_OID`, `COL_ADM_SE` | 건축물대장PK, 사용승인일, 등기일, 구분코드, 위반건축물여부, 무허가여부, 건물관리번호, 시군구코드 등 | `43110` 등 |

  - **샘플 데이터상 사실**: 공식 샘플 테이블에서 `GRND_FLR = 1`인 단독주택(`01000`) 레코드 중 `HEIGHT = 0`으로 기록된 사례가 존재한다.
- **10.24 km × 10.24 km 한 전장의 원자료 크기**:
  - **[실측]** 전국 14,422,486건 전체 SHP 용량은 **6,605 MB**이다([`dsId=18`](https://www.vworld.kr/dtmk/dtmk_ntads_s002.do?svcCde=NA&dsId=18)). 시군구별 압축 SHP(`dsId=30524`)의 실제 파일 크기는 충북 기준 **증평군 `2,506 KB`(2.45 MiB)**, **진천군 `6,894 KB`(6.73 MiB)**, **옥천군 `9,236 KB`(9.02 MiB)**, **제천시 `10 MB`**, **음성군 `11 MB`**, **충주시 `15 MB`**, **청주시 상당구 `8,885 KB`**이다([`dsId=30524`](https://www.vworld.kr/dtmk/dtmk_ntads_s002.do?dsId=30524&svcCde=MK)).
  - **[직접 계산]** 남한 육지면적(약 `100,413 km²`) 대비 단일 전장(`104.8576 km²`)의 면적 비율은 `104.8576 ÷ 100,413 = 0.00104426` (`0.1044%`)이므로, 전국 단순 면적비례 평균 크기는 `6,605 MB × 0.00104426 ≈` **6.90 MB**(약 15,060동)이다.

---

### 2.5 V-World (브이월드 공간정보 오픈플랫폼)

- **공식 출처**:
  - API 레퍼런스 총괄: [https://www.vworld.kr/dev/v4apiRefer.do](https://www.vworld.kr/dev/v4apiRefer.do)
  - 2D 데이터 API 2.0 가이드 및 파라미터 명세: [https://www.vworld.kr/dev/v4dv_2ddataguide2_s001.do](https://www.vworld.kr/dev/v4dv_2ddataguide2_s001.do) 및 [https://www.vworld.kr/dev/v4dv_2ddataguide2_s002.do?svcIde=](https://www.vworld.kr/dev/v4dv_2ddataguide2_s002.do?svcIde=)
  - WMTS API 가이드: [https://www.vworld.kr/dev/v4dv_wmtsguide_s001.do](https://www.vworld.kr/dev/v4dv_wmtsguide_s001.do)
  - 공간정보 다운로드 카탈로그: [https://www.vworld.kr/dtmk/dtmk_ntads_s001.do](https://www.vworld.kr/dtmk/dtmk_ntads_s001.do)
- **제공 방식·해상도·좌표계·형식**:
  1. **WMTS 배경지도 타일 API**:
     - URL: `https://api.vworld.kr/req/wmts/1.0.0/{key}/{layer}/{tileMatrix}/{tileRow}/{tileCol}.{tileType}`
     - 레이어: `Base`(기본, PNG), `Satellite`(항공·위성 영상, JPEG), `Hybrid`(하이브리드, PNG), `gray`, `midnight`. 줌 레벨 **6 ~ 19**, `256 × 256` px, **EPSG:3857**.
  2. **2D 데이터 API 2.0 (`GetFeature`) 및 WFS API**:
     - URL: `https://api.vworld.kr/req/data?service=data&version=2.0&request=GetFeature&key={key}&data={layer}&geomFilter={geom}&crs={crs}&format={json|xml}&size={1..1000}&page={n}`
     - 제공 레이어: 총 **158종**(건물 `LT_C_SPBD`, 도로 `LT_L_SPRD`, 연속지적도 `LP_PA_CBND_BUBUN`, 도시지역 `LT_C_UQ111` 등).
     - 지원 좌표계(`crs`): **`EPSG:4326`**(기본값), `EPSG:4019`, `EPSG:3857`, **`EPSG:5179`**, **`EPSG:5180`~`5188`**.
     - 응답 형식: `json`(**GeoJSON**) 또는 `xml`(GML).
  3. **공간정보 파일 다운로드 (`dtmk_ntads_s001.do`)**:
     - 총 **737종**(오픈마켓 630건, 지도조회 79건, 국가중점데이터 28건)의 SHP, CSV, IMG 등을 일괄 내려받기 제공한다.
  4. **WebGL 3D 지도 API**:
     - 브라우저 내 3D 가시화 전용 JavaScript API이다([`.routing/evidence/research-52-o1.md`](.routing/evidence/research-52-o1.md) §2.5에 확인된 약관 제14조·제19조상 3차원 공간정보는 공개제한 공간정보이며 오픈플랫폼 제공 데이터의 무단 저장·복제가 금지됨).
- **키 유무 및 1회 요청 범위 제한**:
  - 모든 API는 **무료 회원가입 후 발급받는 인증키(`key`)가 필수**이다.
  - **2D 데이터 API 2.0의 1회 요청 범위 제한**([레퍼런스 명세](https://www.vworld.kr/dev/v4dv_2ddataguide2_s002.do?svcIde=)):
    - `size`: 페이지당 최대 **1,000건** (`default=10, min=1, max=1000`).
    - `geomFilter` 면적 제한: **`POLYGON`, `MULTIPOLYGON`, `BOX(minx,miny,maxx,maxy)` 요청 시 면적이 `2 km²`를 넘지 말아야 한다.**
- **10.24 km × 10.24 km 한 전장을 2D 데이터 API로 받을 때의 계산 (`[직접 계산]`)**:
  - 전장 면적은 `10.24 km × 10.24 km = 104.8576 km²`이고 1회 `BOX` 최대 면적이 `2 km²`이므로, 전장 1개를 API로 조회하려면 최소 `⌈104.8576 ÷ 2.0⌉ = 53개` 이상의 서브 박스로 분할 호출해야 하며, 서브 박스당 피처 수가 1,000건을 초과하면 추가 페이지네이션(`page=2, 3...`)이 필요하다.

---

### 2.6 ESA WorldCover (10 m 전 지구 토지피복도)

- **공식 출처**:
  - AWS Open Data S3 Readme: [https://esa-worldcover.s3.eu-central-1.amazonaws.com/readme.html](https://esa-worldcover.s3.eu-central-1.amazonaws.com/readme.html)
  - Product User Manual (PUM v2.0): [https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/docs/WorldCover_PUM_V2.0.pdf](https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/docs/WorldCover_PUM_V2.0.pdf)
  - Zenodo 공식 레코드: [v100 (`2020`, DOI: `10.5281/zenodo.5571936`)](https://zenodo.org/api/records/5571936) 및 [v200 (`2021`, DOI: `10.5281/zenodo.7254221`)](https://zenodo.org/api/records/7254221)
  - 한국 본토 타일 직접 URL: [https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_N36E126_Map.tif](https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_N36E126_Map.tif)
- **해상도 및 좌표계(EPSG)**:
  - **좌표계**: **EPSG:4326** (WGS84 경위도).
  - **해상도**: 경위도 **`1 / 12,000°` (`0.00008333333333333333°` = `0.3 arc-second`)** ([S3 GeoTIFF 헤더 실측](https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_N36E126_Map.tif)).
    - §0.2의 북위 38° 경위도 1° 실거리(경도 `87,832.46 m`, 위도 `110,996.48 m`) 기준 1픽셀 크기는 **동서 `87,832.46 ÷ 12,000 = 7.3194 m` (`≈ 7.32 m`) × 남북 `110,996.48 ÷ 12,000 = 9.2497 m` (`≈ 9.25 m`)**이다.
- **배포 형식 및 받는 방법**:
  - **배포 형식**: **Cloud Optimized GeoTIFF (COG)**, 8-bit unsigned integer (`Uint8`, `BitsPerSample=8`, `Compression=8` DEFLATE, 내부 타일 블록 `1024 × 1024`, `NoData = 0`).
  - **타일 단위**: **`3° × 3°` 타일** (`36,000 × 36,000` 픽셀). 남한 본토(36°~39°N, 126°~129°E)는 단일 타일(`N36E126`)에 대부분 포함되며 동해안 일부만 `N36E129`에 걸친다.
  - **받는 방법**: AWS S3 (`s3://esa-worldcover/v200/2021/map/`) 또는 HTTPS URL에서 **회원가입·API 키 없이 즉시 다운로드** 또는 **HTTP Range 요청(`gdalwarp /vsicurl/...` 또는 JS `geotiff`) 부분 읽기**가 가능하다.
- **속성: 11개 토지피복 분류 코드표** ([Zenodo 7254221](https://zenodo.org/api/records/7254221)):

| 픽셀 값 (`Uint8`) | 영문 분류명 | 한글 의미 |
| :---: | :--- | :--- |
| **`10`** | Tree cover | 수목 피복 (산림, 수관 피복 ≥10%) |
| **`20`** | Shrubland | 관목지 |
| **`30`** | Grassland | 자연·인공 초지 |
| **`40`** | Cropland | 농경지 (논·밭·경작지) |
| **`50`** | Built-up | 시가지·인공 건조물 (건물·도로·콘크리트 포장 포함) |
| **`60`** | Bare / sparse vegetation | 나지·모래·바위·희소식생 |
| **`70`** | Snow and ice | 만년설·빙하 |
| **`80`** | Permanent water bodies | 영구 수역 (하천·호수·바다) |
| **`90`** | Herbaceous wetland | 초본 습지 |
| **`95`** | Mangroves | 맹그로브 |
| **`100`** | Moss and lichen | 이끼·지의류 |
| `0` | NoData | 결측 |

  - **한계**: 도로(road) 전용 클래스가 따로 분리되어 있지 않으며(`50 Built-up`에 건물·도로 등이 합산됨), 산림(`10`)의 수고(canopy height)나 건물 높이 속성이 없다.
- **갱신 주기와 판 식별자**:
  - **`2020 v100`** (공개일 `2021-10-20`) 및 **`2021 v200`** (공개일 `2022-10-28`). 2021 v200 이후 후속 연간판은 없다.
- **원자료 크기 (`[실측]` 및 `[직접 계산]`)**:
  - **[실측]** S3 HTTP HEAD 조회 결과(호스트 교차검증 완료):
    - 한국 본토 `3°×3°` 타일 `ESA_WorldCover_10m_2021_v200_N36E126_Map.tif`: **87,371,384 B (83.32 MiB / 87.37 MB)** (v100은 `97,114,478 B = 92.62 MiB`).
    - 동해안 타일 `N36E129_Map.tif`: **6,602,194 B (6.30 MiB / 6.60 MB)**.
  - **[직접 계산]** §0.2의 북위 38° 경위도 1° 실거리(동서 `87,832.46 m/°`, 남북 `110,996.48 m/°`)와 해상도 `1/12,000°` 기준 `10,240 m × 10,240 m` 전장의 픽셀 수 및 크기:
    - **동서 픽셀 수 (`w`)**: `(10,240 m ÷ 87,832.46 m/°) × 12,000 px/° = 0.116586° × 12,000 = 1,399.03 px` → **`1,399 px`**
    - **남북 픽셀 수 (`h`)**: `(10,240 m ÷ 110,996.48 m/°) × 12,000 px/° = 0.092255° × 12,000 = 1,107.06 px` → **`1,107 px`**
    - **총 픽셀 수 (`w × h`)**: `1,399 × 1,107 =` **`1,548,693 픽셀`**
    - **8-bit `Uint8`(`1 B`/px) 비압축 원자료 크기**: **`1,548,693 B` (`1.48 MiB / 1.55 MB`)** (DEFLATE 압축 시 약 100~230 KB).
    - *(참고: `(n - 1) × cell = 10,230 m` 노드 스팬 기준으로는 `1,397.66 × 1,105.98` → **`1,398 × 1,106 = 1,546,188 px` (`1.47 MiB / 1.55 MB`)**).*

---

### 2.7 Copernicus DEM (GLO-30 / GLO-90)

- **공식 출처**:
  - AWS Open Data S3 Readme (GLO-30): [https://copernicus-dem-30m.s3.amazonaws.com/readme.html](https://copernicus-dem-30m.s3.amazonaws.com/readme.html)
  - 유럽연합 우주프로그램청(EUSPA) 공식 기술 가이드: [Guide on Copernicus DEM GLO-30 (`https://egnos.gsc-europa.eu/sites/default/files/2025-07/Guide%20on%20Copernicus%20DEM%20GLO%20-%2030%20for%20Flight%20Procedure%20Design.pdf`)](https://egnos.gsc-europa.eu/sites/default/files/2025-07/Guide%20on%20Copernicus%20DEM%20GLO%20-%2030%20for%20Flight%20Procedure%20Design.pdf)
  - 한국 중부 1°×1° 타일 직접 URL:
    - GLO-30: `https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N37_00_E127_00_DEM/Copernicus_DSM_COG_10_N37_00_E127_00_DEM.tif` 및 `N38_00_E127_00`
    - GLO-90: `https://copernicus-dem-90m.s3.amazonaws.com/Copernicus_DSM_COG_30_N37_00_E127_00_DEM/Copernicus_DSM_COG_30_N37_00_E127_00_DEM.tif`
- **해상도 및 좌표계(EPSG)**:
  - **해상도** (§0.2의 북위 38° 경도 1° = `87,832.46 m`, 위도 1° = `110,996.48 m` 기준):
    - **GLO-30**: **`1 arc-second` (`1/3,600° = 0.0002777777777777778°`)** — 북위 38°에서 **동서 `87,832.46 ÷ 3,600 = 24.3979 m` (`≈ 24.40 m`) × 남북 `110,996.48 ÷ 3,600 = 30.8324 m` (`≈ 30.83 m`)**.
    - **GLO-90**: **`3 arc-seconds` (`1/1,200° = 0.0008333333333333334°`)** — 북위 38°에서 **동서 `73.19 m` × 남북 `92.50 m`**.
  - **좌표계**: 수평 **EPSG:4326** (WGS84), 수직 **EGM2008 지오이드 모델 (EPSG:3855)** 기반 정표고(단위 m).
- **배포 형식 및 받는 방법**:
  - **배포 형식**: **Cloud Optimized GeoTIFF (COG)**, 32-bit Floating Point (`Float32`, `BitsPerSample=32`, `SampleFormat=3`, `Compression=8` DEFLATE + `PREDICTOR=3`, 내부 타일 블록 GLO-30 `1024×1024` / GLO-90 `2048×2048`).
  - **타일 규격**: **`1° × 1°` 타일** (위도 0°~50° 구간에서 AWS COG는 인접 타일 중복 1픽셀을 제거하여 GLO-30이 `3,600 × 3,600` 픽셀, GLO-90이 `1,200 × 1,200` 픽셀).
  - **받는 방법**: AWS S3 (`s3://copernicus-dem-30m/`, `s3://copernicus-dem-90m/`) 또는 HTTPS에서 **API 키·로그인 없이 무료 다운로드 또는 HTTP Range(`/vsicurl/`) 부분 읽기** 가능.
- **속성 및 주의사항 (DSM vs DTM)**:
  - TanDEM-X X-밴드 SAR 간섭측량(2011~2015년 촬영 WorldDEM 기반)으로 제작된 **수치표면모형(DSM)**이다. 따라서 산림이나 건물 밀집지에서는 순수 지면고(DTM)가 아니라 수관·건물 상단이 포함된 표고가 기록되어 있다.
- **원자료 크기 (`[실측]` 및 `[직접 계산]`)**:
  - **[실측]** S3 HTTP HEAD 조회 결과(호스트 교차검증 완료):
    - GLO-30 `N37_00_E127_00` (북위 37°~38°, 동경 127°~128°): **49,403,795 B (47.12 MiB / 49.40 MB)**.
    - GLO-30 `N38_00_E127_00` (북위 38°~39°, 동경 127°~128°): **46,332,224 B (44.19 MiB / 46.33 MB)**.
    - GLO-90 `N37_00_E127_00`: **5,848,902 B (5.58 MiB / 5.85 MB)**.
  - **[직접 계산]** §0.2의 북위 38° 경위도 1° 실거리(동서 `87,832.46 m/°`, 남북 `110,996.48 m/°`) 기준 `10,240 m × 10,240 m` 전장의 픽셀 수 및 크기:
    - **GLO-30 (`1/3,600°`)**:
      - 동서 픽셀 수 (`w`): `(10,240 ÷ 87,832.46) × 3,600 = 419.71 px` → **`420 px`** (`10,230 m` 스팬 기준 `419.30 → 419 px`)
      - 남북 픽셀 수 (`h`): `(10,240 ÷ 110,996.48) × 3,600 = 332.12 px` → **`332 px`**
      - 총 픽셀 수 (`w × h`): `420 × 332 =` **`139,440 픽셀`**
      - 32-bit Float(`4 B`/px) 비압축 크기: `139,440 × 4 B =` **`557,760 B` (`544.69 KiB / 557.76 KB`)**.
    - **GLO-90 (`1/1,200°`)**:
      - 동서 `139.90 → 140 px` × 남북 `110.71 → 111 px` = **`15,540 픽셀`**
      - 32-bit Float(`4 B`/px) 비압축 크기: `15,540 × 4 B =` **`62,160 B` (`60.70 KiB / 62.16 KB`)**.

---

### 2.8 OpenStreetMap (OSM) 및 Overture Maps

- **공식 출처**:
  - Geofabrik South Korea 다운로드 서버: [https://download.geofabrik.de/asia/south-korea.html](https://download.geofabrik.de/asia/south-korea.html)
  - Overture Maps 공식 문서: [https://docs.overturemaps.org/getting-data/](https://docs.overturemaps.org/getting-data/)
  - Overture Maps 스키마 레퍼런스: [buildings/building](https://docs.overturemaps.org/schema/reference/buildings/building/), [transportation/segment](https://docs.overturemaps.org/schema/reference/transportation/segment/), [base/land_cover](https://docs.overturemaps.org/schema/reference/base/land_cover/)
  - Overture Maps STAC 카탈로그: [https://stac.overturemaps.org/catalog.json](https://stac.overturemaps.org/catalog.json) 및 [https://stac.overturemaps.org/2026-10-21.0/catalog.json](https://stac.overturemaps.org/2026-10-21.0/catalog.json)
- **해상도·좌표계(EPSG)·배포 형식**:
  - **좌표계**: 두 자료 모두 **EPSG:4326** (WGS84 경위도).
  - **배포 형식**:
    - **OSM (Geofabrik)**: `.osm.pbf` (Protocolbuffer Binary Format), `.shp.zip` (Esri Shapefile), `.gpkg.zip` (GeoPackage), `.osm.bz2`. (소규모 영역은 Overpass API로 JSON/GeoJSON/OSM XML 직접 질의 가능).
    - **Overture Maps**: Zstandard 압축 **GeoParquet** (공간 정렬 및 Row Group `bbox` 메타데이터 내장) 및 타일 시각화용 `PMTiles`.
- **받는 방법 (일괄 vs API, 키 유무, 범위)**:
  - 두 자료원 모두 **회원가입·API 키 없이 무료·무인증**으로 받을 수 있다.
  - **Geofabrik OSM**: 남한 전체 파일(`south-korea-latest.osm.pbf`)을 한 번에 내려받거나, Overpass API(`https://overpass-api.de/api/interpreter`)에 bbox 쿼리를 보내 해당 전장 범위만 추출할 수 있다.
  - **Overture Maps**: AWS S3(`s3://overturemaps-us-west-2/release/2026-10-21.0/theme=...`) 또는 Azure Blob에 호스팅되어 있으며, `overturemaps download --bbox=min_lon,min_lat,max_lon,max_lat -f geojson --type=building -o buildings.geojson` CLI 명령이나 `DuckDB`의 `httpfs`+`spatial` 확장을 통해 **전국 파일을 받지 않고 HTTP Range로 10.24 km 전장 bbox에 해당하는 GeoParquet Row Group만 추출할 수 있다.**
- **속성 상세 비교**:
  1. **건물 (`buildings`)**:
     - **OSM**: `building=*` (`yes`, `apartments`, `house`, `industrial`, `commercial`, `farm_auxiliary` 등), 높이 `height`(m, 선택 태그), 지상층수 `building:levels`(선택 태그), 지하층수 `building:levels:underground`.
     - **Overture (`theme=buildings, type=building`)**: OSM, Microsoft ML Building Footprints, Google Open Buildings, Esri Community Maps 및 동아시아 건물 데이터셋(Zenodo DOI `10.5281/zenodo.8174931`) 등을 병합.
       - 주요 필드(스키마 `v2.0.0`): `height` (`float64`, m 단위 건물 높이, 선택), `num_floors` (`int32`, 지상층수, 선택), `num_floors_underground` (`int32`, 선택), `min_height` (`float64`), `subtype` (`agricultural, civic, commercial, education, entertainment, industrial, medical, military, outbuilding, religious, residential, service, transportation`), `class`, `names`, `has_parts` (`boolean`), `sources`.
  2. **도로망 (`roads`)**:
     - **OSM**: `highway=*` (`motorway, trunk, primary, secondary, tertiary, unclassified, residential, service, track, path`), `surface=*`, `lanes=*`, `bridge=*`, `tunnel=*`.
     - **Overture (`theme=transportation, type=segment`)**: `subtype` (`road`, `rail`, `water`), `class` (`motorway, trunk, primary, secondary, tertiary, residential, living_street, service, track, path, footway, bridleway, cycleway, steps, unknown`), `subclass`, `road_surface` (`paved, unpaved, asphalt, concrete, dirt, gravel`), `width_rules`, `level_rules`, `road_flags` (`is_bridge, is_tunnel, is_under_construction`).
  3. **토지피복·수계·마을 지명 (`cover`, `villages`)**:
     - **OSM**: `landuse=farmland|paddy|orchard|vineyard|forest|residential|industrial|military`, `natural=wood|water|wetland|grassland|scrub|bare_rock|sand`, `waterway=river|stream|canal`, `place=city|town|village|hamlet|isolated_dwelling` + `name:ko`/`name`.
     - **Overture**:
       - `theme=base, type=land_cover`: ESA WorldCover 10 m 등을 벡터 폴리곤으로 변환한 테마. `subtype` 10종: `barren, crop, forest, grass, mangrove, moss, shrub, snow, urban, wetland`.
       - `theme=base, type=water`: 하천·호소·해양 폴리곤/선형.
       - `theme=divisions, type=division` 및 `theme=places, type=place`: 행정구역·마을·거점 좌표 및 다국어 명칭(`names.primary`).
  - **한계**: 산림 폴리곤에 수고(나무 높이) 속성이 없으며, 한국 농촌·접경지역에서 건물 `height` 및 `num_floors`(`building:levels`)의 실제 채워짐 비율(fill rate)은 1차 공식 출처로 확인되지 않아 §4 미확인 항목으로 분리하였다.
- **갱신 주기와 판 식별자**:
  - **Geofabrik OSM**: **일간 갱신** (조회 시점 최신 스냅샷: **`south-korea-261108.osm.pbf`**, `2026-11-08T21:21:49Z`).
  - **Overture Maps**: **월간 릴리스** (STAC 카탈로그 확인 최신 정식 릴리스: **`2026-10-21.0`**, 스키마 버전 **`v2.0.0`**; 직전 릴리스 `2026-09-23.1`, `2026-09-23.0`).
- **원자료 크기 (`[실측]` 및 `[직접 계산]`)**:
  - **[실측]** Geofabrik South Korea (`2026-11-08` 기준 HTTP HEAD 실측):
    - `south-korea-261108.osm.pbf`: **291,304,615 B (277.81 MiB / 291.30 MB)**.
    - `south-korea-261108-free.shp.zip`: **590,326,515 B (563.00 MiB / 590.33 MB)**.
    - `south-korea-261108.gpkg.zip`: **약 579 MB**.
  - **[직접 계산]** `10.24 km × 10.24 km` (`104.8576 km²`, 남한 육지면적 `100,413 km²`의 `0.1044%`) 단순 면적비례 평균:
    - OSM PBF 평균 크기: `291.30 MB × 0.00104426 ≈` **304 KB** (SHP 기준 평균 **약 616 KB**).

---

## 3. 변환 도구 및 파이프라인 기술 조사 (GDAL, Python, Node.js/TypeScript)

[`src/sim/terrain.ts`](src/sim/terrain.ts)의 `TerrainData`는 동서(`x`)·남북(`y`)이 국지 미터(m) 단위로 직교하는 `n = 1024`, `cell = 10` m 격자와 방안 기준점(`grid: { letters, e0, n0 }`)을 사용한다([`docs/adr/0006-grid-reference-comes-with-terrain-data.md`](docs/adr/0006-grid-reference-comes-with-terrain-data.md)).

> **격자 스팬(`10,230 m` vs `10,240 m`) 및 등록 기준 주의사항 (§0.1 참조)**:
> [`src/sim/terrain.ts`](src/sim/terrain.ts)는 셀 `(i, j)`의 위치를 `x = i × 10, y = j × 10` (`0 m .. 10,230 m`, `span = (n - 1) × cell = 10,230 m`)으로 정의한다. 아래 예시와 같이 `gdalwarp -te e0 n0 (e0+10240) (n0+10240) -ts 1024 1024`를 그대로 호출하면 GDAL의 기본 `PixelIsArea` 규약에 따라 각 픽셀의 중심이 `e0 + 5, e0 + 15, ..., e0 + 10,235`에 놓여 **`src/sim/terrain.ts`의 노드 좌표(`e0 + i × 10`)와 5 m 차이**가 발생한다. 실제 변환 스크립트를 작성할 때는 이 5 m 오프셋 및 `10,230 m` vs `10,240 m` 스팬 정합 방식을 먼저 확정해야 한다.

### 3.1 GDAL / OGR CLI 도구 ([`https://gdal.org/en/stable/programs/`](https://gdal.org/en/stable/programs/index.html))

1. **`gdalwarp`** (래스터 좌표계 재투영 · 영역 추출 · 리샘플링):
   - 연속형 표고(DEM → `ground`): 공선형(`-r bilinear`) 또는 3차 회선(`-r cubic`) 보간을 지원한다.
   - 범주형 토지피복(WorldCover 등 → `cover`): 최근린(`-r near`) 또는 최빈값(`-r mode`) 리샘플링을 지원한다.
   - 원격 COG(`/vsicurl/`): 전체 타일을 내려받지 않고 HTTP Range로 목표 영역만 추출할 수 있다.
     ```bash
     # 예시 (단, -te 범위와 픽셀 중심 5 m 오프셋 정합 여부는 §0.1에 따라 결정 필요)
     gdalwarp -t_srs EPSG:32652 -te <xmin> <ymin> <xmax> <ymax> \
       -ts 1024 1024 -r mode -ot Byte \
       /vsicurl/https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_N36E126_Map.tif \
       worldcover_10m.tif
     ```
2. **`gdal_rasterize`** (벡터 SHP / GeoJSON / GeoParquet → 격자 번인):
   - 벡터 폴리곤·선형(환경부 토지피복지도, 산림청 임상도 `HEIGHT`, 국토부 건물통합정보 `HEIGHT`, 도로 선형)을 속성값(`-a <필드>`) 또는 고정값(`-burn`)으로 1024×1024 래스터에 번인한다.
3. **`ogr2ogr`** (벡터 좌표계 변환 · 영역 클리핑 · 속성 SQL 처리):
   - `-s_srs`/`-t_srs` 재투영, `-spat`/`-clipdst` 영역 클리핑 및 `-dialect SQLite -sql "..."` 쿼리를 수행한다.

### 3.2 Python 라이브러리 생태계 ([PyPI 공식 레지스트리 확인](https://pypi.org/))

- **`rasterio` (최신 `v1.5.0`)**: GDAL 기반 래스터 읽기·쓰기·재투영(`rasterio.warp.reproject`) 및 벡터 래스터화(`rasterio.features.rasterize`).
- **`geopandas` (`v1.1.3`) + `shapely` + `pyproj`**: SHP/GeoJSON/GeoParquet 읽기 및 투영 변환(`to_crs`).
- **`duckdb` (`spatial` + `httpfs` 확장) / `overturemaps` CLI**: Overture Maps S3 GeoParquet에서 인증키 없이 전장 bbox만 원격 추출.

### 3.3 Node.js / TypeScript 라이브러리 생태계 ([npm 공식 레지스트리 확인](https://registry.npmjs.org/))

저장소([`package.json`](package.json))와 동일한 Node.js/TypeScript 환경에서 사용할 수 있는 패키지는 다음과 같다:

| 패키지명 (npm 최신 버전) | 역할 및 특징 | `TerrainData` 파이프라인 적용 지점 |
| :--- | :--- | :--- |
| **`geotiff`** (`v3.0.5`) | 순수 JavaScript GeoTIFF 및 Cloud Optimized GeoTIFF(COG) 리더 (`fromFile`, `fromUrl`, `readRasters({ bbox })`) | 로컬 GeoTIFF 또는 S3 원격 COG(`WorldCover`, `Copernicus DEM`)를 `Float32Array` / `Uint8Array`로 직접 로드 |
| **`proj4`** (`v2.22.0`) | 순수 JS 좌표계 변환 라이브러리 | 한국 좌표계(`EPSG:5186`, `EPSG:5179`, `EPSG:5174`) ↔ WGS84(`EPSG:4326`) ↔ UTM(`EPSG:32652`) 점·폴리라인 변환 |
| **`mgrs`** (`v2.2.0`) | WGS84 경위도 ↔ 군사격자참조체계(MGRS) 문자열 변환 (`forward`, `inverse`, `toPoint`) | `TerrainData.grid` 메타데이터 계산 보조 (**주의**: [`src/sim/terrain.ts`](src/sim/terrain.ts) 및 [`docs/adr/0006-grid-reference-comes-with-terrain-data.md`](docs/adr/0006-grid-reference-comes-with-terrain-data.md)에 따라 `grid.letters`에는 대 표기 `52S` 등을 제외한 **방안 문자 두 글자, 예: `'CB'`**만 저장해야 함) |
| **`gdal-async`** (`v3.12.3`) | Node.js용 C++ 네이티브 GDAL 비동기 바인딩 (`gdalwarp`, `rasterize` 내장) | Node/TS 빌드 스크립트에서 SHP/GeoTIFF 원자료 → `TerrainData` 정적 에셋 생성 |

---

## 4. 확인하지 못한 항목 (`Unconfirmed / fact: null`)

작업 지시서의 제약사항(*"Do not sign up for anything, do not use credentials or API keys, and do not download datasets in full"*) 및 1차 출처 검증 원칙에 따라, 아래 항목은 미확인(`[`.routing/evidence/research-53-o1.json`](.routing/evidence/research-53-o1.json)`의 `fact: null` 레코드)으로 분류한다.

1. **국토지리정보원(NGII) 90 m/5 m/1 m DEM, 환경부(EGIS) 세분류·중분류 토지피복지도 SHP, 산림청(FGIS) 1:5,000 임상도 SHP의 단일 도엽 ZIP 실측 바이트 크기**:
   - **수행한 탐색**: `https://map.ngii.go.kr/mn/mainPage.do`, `https://www.data.go.kr/data/15059920/fileData.do`, `https://egis.me.go.kr/req/intro.do`, `https://www.data.go.kr/data/15093362/fileData.do`, `https://www.forest.go.kr/newkfsweb/html/HtmlPage.do?pg=/fgis/UI_KFS_5002_020100.html&mn=KFS_02_04_03_04_01&orgId=fgis`를 조회하였다. 도엽 규격(`1'30"×1'30"`), 분류체계(41종), 임상도 DB 테이블 정의서(`TB_FGDI_IM5000` PDF, `126,691 B`)는 공식 문서에서 확인하였으나, 실제 데이터 파일 내려받기는 각 포털의 로그인·신청 절차 및 전용 전송 S/W가 필요하여 비로그인 HTTP 요청으로 압축 ZIP 크기를 실측할 수 없었다(대신 §2.1~§2.2에 격자 해상도 및 북위 38° 실거리 기반 비압축 바이트 산술 계산치를 제시함).
2. **한국 비수도권·농촌·접경지역에서 OpenStreetMap(OSM) 및 Overture Maps 건물의 높이(`height`) 및 층수(`building:levels` / `num_floors`) 속성 실제 입력 비율(fill rate) 및 Overture 10.24 km bbox 추출본의 실측 바이트 크기**:
   - **수행한 탐색**: Overture Maps 스키마 문서(`https://docs.overturemaps.org/schema/reference/buildings/building/`)와 Geofabrik South Korea 메타데이터(`https://download.geofabrik.de/asia/south-korea.html`)를 확인하였다. 스키마상 `height`와 `num_floors`(`building:levels`)가 선택(optional) 필드라는 사실은 확인되나, 한국 농촌·접경지역 건물 피처 중 해당 필드가 `null`이 아닌 정량적 비율을 보고한 1차 공식 출처는 없으며 전체 데이터셋 다운로드·전수 조사는 작업 지시서에서 금지되어 있다.

---

## 5. 조합 비교표: "10 m 격자 1024×1024 전장 하나를 만들 때 어떤 조합이 가장 적은 손질로 되는가"

> **원칙**: 작업 지시서에 따라 특정 조합을 승자로 단정(pick a winner)하지 않으며, 각 조합이 `TerrainData`(`ground`, `surface`, `cover`, `buildings`, `roads`, `villages`, `grid`)를 채우기 위해 거쳐야 하는 **사전 절차(로그인·키·신청)**, **법적·보안 공개제한 여부**, **변환·전처리 손질 단계**를 사실 그대로 대조한다. 출처가 없는 자체 보정 아이디어는 `(제안, 출처 없음)`으로 명시하였다.

| 비교 항목 | **조합 A: 글로벌 클라우드 공개 조합**<br>(Copernicus DEM GLO-30 + ESA WorldCover 10 m + Overture Maps / OSM) | **조합 B: 하이브리드 조합 (글로벌 COG + 국내 건물·임상 오픈데이터)**<br>(국토부 건물통합정보 시군구 SHP + 산림청 임상도 + WorldCover/OSM + NGII 5 m 또는 Copernicus DEM) | **조합 C: 국내 국가공간정보 정밀 조합**<br>(국토지리정보원 5 m DEM + 환경부 세분류 토지피복지도 1 m + 산림청 1:5,000 임상도 + 국토부 건물통합정보 + 수치지형도 도로/지명) | **조합 D: V-World API 중심 조합**<br>(V-World 2D 데이터 API 2.0 `GetFeature` + 외부 DEM [NGII 또는 Copernicus]) |
| :--- | :--- | :--- | :--- | :--- |
| **1. 회원가입 · 로그인 · API 키 · 신청서 유무** | **전무 (0건)**.<br>3개 자료원 모두 AWS S3 / HTTPS에서 무인증·무키로 즉시 자동화 스크립트 접근 가능 | 건물통합정보(시군구 SHP)는 V-World/공공데이터포털 웹 다운로드 가능하나, **산림청 임상도·NGII DEM(90 m 및 5 m 모두)은 포털 로그인 및 신청/전송 S/W 필요** | **3개 포털(NGII, EGIS, FGIS) 로그인·신청서 작성** 및 대용량 파일전송 S/W 설치 필요 | **V-World 무료 회원가입 및 API 인증키(`key`) 발급 필수** (DEM은 별도 포털 필요) |
| **2. 공개제한 및 재배포 제약 ([`.routing/evidence/research-52-o1.md`](.routing/evidence/research-52-o1.md))** | 전 세계 공개 라이선스(`COP-DEM-GLO-30-F`, `CC BY 4.0`, `ODbL 1.0`)로 **한국 공간정보 보안규정상 공개제한 해당 없음** | **NGII 5 m DEM 사용 시**: [`.routing/evidence/research-52-o1.md`](.routing/evidence/research-52-o1.md)에 보고된 바와 같이 「국토지리정보원 공간정보 공급 규정」 제28조제2항 및 보안관리규정 [별표 1]상 **'공개제한' 등급으로 학술연구 등 목적에 한해 제한 공급되며 공개 웹 재배포가 금지됨** (Copernicus DEM이나 90 m 공개DEM으로 대체 시 회피) | **NGII 5 m DEM은 '공개제한'(학술연구 등 목적 한정 공급, 일반 공개 재배포 금지)**이며, 환경부 세분류 토지피복지도 중 군사·보안시설 인접 도엽도 '공개제한'(온라인 다운로드 불가, 공문·방문 수령 대상)임([`.routing/evidence/research-52-o1.md`](.routing/evidence/research-52-o1.md)) | [`.routing/evidence/research-52-o1.md`](.routing/evidence/research-52-o1.md)에 보고된 브이월드 이용약관 제14조·제19조상 **오픈API 응답 데이터의 무단 저장·복제·타인 제공 금지** 및 3D 공간정보 '공개제한' |
| **3. 한 번에 받는 범위 및 파일 조각 수** | **HTTP Range 부분 읽기로 전장 1개(10.24 km) 범위만 즉시 추출**.<br>도엽 접합(mosaic) 불필요 (단일 `3°×3°` 및 `1°×1°` COG 타일 내부) | 건물통합정보는 **시군구 SHP 1~2개**, WorldCover/OSM은 단일 추출, 1:5,000 임상도·5 m DEM 사용 시 **북위 38° 기준 각 20~30도엽 병합** 필요 | 5 m DEM(20~30도엽) + 세분류 피복(20~30도엽) + 임상도(20~30도엽) = **총 60~90개 도엽 SHP/IMG 압축 해제 및 병합(`gdalbuildvrt`/`ogrmerge`)** 필요 | V-World 2D API의 **1회 BOX ≤ 2 km² 제한** 때문에 104.86 km² 전장 1개당 **최소 53회 이상 분할 HTTP 호출** + 1,000건 페이지네이션 루프 필요 |
| **4. 좌표계 통일 손질** | **모두 `EPSG:4326`으로 동일**.<br>국지 미터 평면으로 1회 일괄 재투영 | `EPSG:4326`(WorldCover/Overture)과 `EPSG:5186`/`5179`(건물·임상도) **2개 좌표계 혼합** → `gdalwarp`/`ogr2ogr`로 통일 | **모두 `EPSG:5186`(또는 `5179`) 국내 표준 평면직각좌표계로 동일** (단, `2023-08-05` 이전 건물이나 구버전 도엽 `EPSG:5174` 혼입 시 PRJ 확인 필요) | API 요청 시 `crs=EPSG:5186` 또는 `EPSG:4326` 파라미터를 지정하여 서버 측 변환 응답 수령 가능 |
| **5. `ground` (10 m 지면 해발고도) 품질 및 손질** | Copernicus GLO-30(`420×332` px, 약 24.4×30.8 m)을 10 m로 보간.<br>**한계**: 10 m급 미지형 부재 + **DSM이므로 산림·도심에서 지면고가 수관·건물만큼 포함됨** | NGII 5 m DEM 사용 시 **순수 지면(DTM)을 5 m→10 m 리샘플링**(단, 공개제한 제약 존재). Copernicus GLO-30 사용 시 조합 A와 동일한 DSM 한계 | NGII 5 m(또는 1 m) DEM 사용 → **순수 지면 정표고(DTM)** 확보(단, 공개제한 제약 존재) | V-World는 원시 DEM 래스터 다운로드 API를 제공하지 않으므로 외부 DEM(NGII 또는 Copernicus)을 별도 결합해야 함 |
| **6. `cover` (7종 피복: `open, field, forest, water, road, village, building`) 손질** | WorldCover(`1,399×1,107` px) 11개 코드와 Overture/OSM 도로·건물 벡터를 합성 *(제안, 출처 없음: `10`→`forest`, `40`→`field`, `80`→`water`, `50`→`village` 등 매핑 규칙 자체 정의 필요)* | WorldCover 기본 피복 위에 OSM/Overture 도로와 국토부 건물통합정보 폴리곤을 합성 *(제안, 출처 없음: 클래스 매핑 규칙 자체 정의 필요)* | 환경부 세분류 SHP(41개 코드) 전체를 `gdal_rasterize`로 10 m 격자에 래스터화 후 건물 폴리곤 번인 *(제안, 출처 없음: 41개 코드 → 7종 `COVER` 매핑 규칙 자체 정의 필요)* | 토지피복 전체를 덮는 단일 V-World API 레이어가 없어 연속지적도·산림·도로·건물 등 여러 레이어를 각각 53회 이상 호출해 합성해야 함 |
| **7. `surface` (수관·건물 상단 고도) 및 산림 수고 손질** | WorldCover와 OSM/Overture에는 **산림 수고(canopy height) 속성이 없음** → 별도 수고 값 부여 방식 결정 필요 | 산림청 임상도의 **`HEIGHT`(`HEIGT_CD`, `00`~`40`, 2 m 간격 임분고 코드)** 속성을 래스터화하여 활용 가능 *(구버전 도엽 결측 시 `AGCLS_CD` 영급 활용 등은 제안, 출처 없음)* | 산림청 1:5,000 임상도 `HEIGHT`(`00`~`40`)와 건물통합정보 `HEIGHT` 속성을 결합하여 임분고와 건물 높이 반영 가능 | 산림 수고 API가 별도로 없어 임상도 SHP 파일 다운로드 등을 병행해야 함 |
| **8. `buildings` (건물 높이 m) 품질 및 결측 손질** | OSM/Overture 스키마에 `height`·`num_floors` 필드가 존재하나 선택(optional) 속성임 (한국 농촌 실제 입력률은 §4 미확인) | 국토부 건물통합정보(`HEIGHT`, `GRND_FLR`) 사용으로 **세움터 건축물대장 높이·층수 확보** *(샘플상 `HEIGHT=0`인 건물에 `GRND_FLR`을 곱해 보정하는 방식은 제안, 출처 없음)* | 국토부 건물통합정보(`HEIGHT`, `GRND_FLR`) 사용으로 **건축물대장 높이·층수 확보** *(결측 시 층수 기반 보정은 제안, 출처 없음)* | V-World 건물 레이어(`LT_C_SPBD`)로 건물 도형·층수 조회 가능하나 2 km² 면적 제한으로 분할 호출 필요 |
| **9. `roads` (도로 폴리라인) 및 `villages` (마을 지명) 추출 손질** | Overture(`transportation/segment`, `places`/`divisions`) 또는 OSM(`highway=*`, `place=village|hamlet`)에서 단일 스키마로 추출 가능 | OSM/Overture에서 추출하거나 국내 수치지형도 도로·지명 레이어를 결합 | 1:5,000 수치지형도 도로 중심선·지명 레이어를 20~30개 도엽별로 병합·위상 접합(stitching)하거나 OSM/Overture 보조 사용 | V-World 도로(`LT_L_SPRD`)·지명 API를 53회 이상 분할 호출 후 경계선에서 잘린 폴리라인을 재병합해야 함 |
| **10. 10.24 km 전장 1개 원자료 용량 (`[직접 계산]`)** | 비압축 래스터 기준 Copernicus GLO-30 **`557.76 KB`** + WorldCover **`1.55 MB`** + OSM PBF 면적평균 **~`304 KB`** (또는 Overture bbox 추출) | 건물 시군구 SHP(**실측 2.5~15 MB**, 전장 면적평균 **6.90 MB**) + WorldCover(**1.55 MB**) + 임상도(20~30도엽) + DEM | 5 m DEM(순수 **16.78 MB**, 20~30도엽 합산 **21.1~31.7 MB**) + 세분류 피복(래스터 환산 **104.86 MB** 또는 20~30도엽 SHP) + 임상도(20~30도엽 SHP) + 건물 SHP(평균 **6.90 MB**) | 53회 이상 분할 호출된 GeoJSON 응답 합계 + 별도 DEM 용량 |
