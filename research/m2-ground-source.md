# 공개 빌드의 지면 자료원 조사 보고서 — 나지 표고(Bare-Earth) 파생 자료와 등고선 DTM (`#69`)

- **작성일 (조회일)**: `2026-11-09`
- **대상 이슈**: `DomineYH/observer#69` (`조사: 공개 빌드의 지면 자료원 — 나지 표고 파생 자료와 등고선 DTM`)
- **연계 맥락**: `DomineYH/observer#57` (30 m 수치표면모형에서 수관·건물 높이를 뺀 파생 지면의 오차 한계 및 전장 후보지 3곳), `DomineYH/observer#52` ([`research/m2-geodata-licence.md`](research/m2-geodata-licence.md))
- **구조화 증거 파일**: [`.routing/evidence/research-69-o1.json`](.routing/evidence/research-69-o1.json)
- **작성 원칙**: 본 보고서는 1차·공식 출처에서 확인된 사실과 산술 계산만을 기술하며, 특정 자료원을 승자로 선정하거나 법률적 유권해석·의견을 제시하지 않는다.

---

## 0. 총괄 요약표 (Summary Table)

### 0-1. 질문 (가)~(라) 핵심 조사 결과 요약

| 구분 | 조사 대상 / 항목 | 핵심 확인 사실 (1차 출처 기준) | 비상업(NC) 또는 공개제한 조건 유무 | 한국 내륙 후보지 3곳(진안·문경·봉평) 커버리지 | 판 식별자 / 기준 규격 | 주요 1차 출처 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **(가)** | **FABDEM** (`University of Bristol` / `Fathom`) | 발행처 원문: `"licensed under a Creative Commons "CC BY-NC-SA 4.0" license. For commercial use queries, please contact fabdem@fathom.global"` | **있음** (`CC BY-NC-SA 4.0`: 비상업 `NC` + 동일조건변경허락 `SA`) | **전역 포함** (`1 arc-second` $\approx 30\text{ m}$, $60^\circ\text{S}\sim 80^\circ\text{N}$, `N30E120-N40E130_FABDEM_V1-2.zip` 내 `N35E127`, `N36E128`, `N37E128`) | `V1-0` (`2021-12-21`), `V1-2` (`2023-05-30`) | [DataCite `10.5523/bris.s5hqmjcdj8yo2ibzi9b4ew3sn`](https://api.datacite.org/dois/10.5523/bris.s5hqmjcdj8yo2ibzi9b4ew3sn), [Hawker et al. (2022)](https://doi.org/10.1088/1748-9326/ac4d4f) |
| **(가)** | **FathomDEM** (`Fathom`) | 발행처 원문: `"available under a CC BY-NC-SA 4.0 license. This allows non commercial use... Please apply for access using your academic email address"` | **있음** (`CC BY-NC-SA 4.0` + Zenodo `restricted`, 학술 이메일 사전 승인 필수) | **범위 포함이나 접근 제한** (`1 arc-second` $\approx 30\text{ m}$, `Eurasia and Africa` 레코드 내 포함이나 비공개) | `v1.0` (`v1-0`, `2024-12-18` / `2025-02-11`) | [Zenodo `14511570`](https://zenodo.org/api/records/14511570), [Uhe et al. (2025)](https://doi.org/10.1088/1748-9326/ada972) |
| **(가)** | **GEDTM30** (`OpenGeoHub` / `OpenLandMap`) | 발행처 원문: `"released under fully open license CC-BY 4.0"`, 단 Zenodo 본문 Disclaimer에 `"Use for testing purposes only"` 병기 및 입력에 `GLO-30` + `ALOS AW3D30` 결합 (선행 `EDTM v1`은 FABDEM 라이선스 이슈로 폐기·삭제) | **자체 선언 라이선스에는 없음** (`CC-BY 4.0`, `open`), 단 테스트 전용 면책 문구 및 제3자 입력(`AW3D30`) 결합 | **전역 포함·즉시 접근 가능** (`1 arc-second` $\approx 30\text{ m}$, $65^\circ\text{S}\sim 85^\circ\text{N}$, S3 `432.4 GB` 단일 COG HTTP Range 지원) | `v0` (`2025-02`), `v1` (`2025-05`), `v1.01` (폐기), `v1.1` (`2025-06`), `v1.2` / `v1.2.0` (`2026-03-06`, 권장) | [Zenodo `18887460`](https://zenodo.org/api/records/18887460), [Codeberg `GEDTM30`](https://codeberg.org/openlandmap/GEDTM30), [Ho et al. (2025)](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12296579/fullTextXML) |
| **(가)** | **DiluviumDEM** (`Climate Central` 등) | 발행처 원문: `"cc-by-4.0"` + `"produced using Copernicus WorldDEM-30 © DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018"` | **없음** (`CC BY 4.0` + Copernicus 원저작물 출처표시) | **내륙 후보지 미적용** (`1 arc-second` $\approx 30\text{ m}$, 표고 $80\text{ m}$ 이하 해안만 보정하여 표고 $200\sim 1,300\text{ m}$인 진안·문경·봉평은 범위 밖) | `1.0` (`2023-09-12`) | [Zenodo `8384665`](https://zenodo.org/api/records/8384665), [Dusseau et al. (2023)](https://doi.org/10.1016/j.rse.2023.113812) |
| **(가)** | **DeltaDTM** (`TU Delft` / `Deltares`) | 발행처 원문: `"DeltaDTM is licensed as CC-BY 4.0. DeltaDTM is produced using Copernicus WorldDEM-30 © DLR... and © Airbus..."` | **원본은 없음** (`CC-BY 4.0`, 단 WUR 파생판 `wur01-gx7s1b`는 `CC BY-NC-SA 4.0`) | **내륙 후보지 결측(절단)** (`1 arc-second` $\approx 30\text{ m}$, `EGM2008` 표고 $30\text{ m}$ 초과 절단(`255`), `N36E128` 문경 타일은 아예 미존재) | `v1.0` (`2024-03-06`), `v1.1` (`2024-08-25`), `v1.1.1` (`2024-12-10`) | [4TU `10.4121/21997565.v4`](https://data.4tu.nl/v2/articles/21997565), [Pronk et al. (2024)](https://www.nature.com/articles/s41597-024-03091-9) |
| **(나)** | **1:5,000 수치지형도 등고선·표고점 기반 DTM 제작 및 보안관리규정 별표 1** | 1:5,000 수치지도는 **공공누리 제1유형**(출처표시, 상업적 활용·2차적 저작물 변형 가능). 고시 제2026-283호 제47조·제48조는 1:5,000 등고선·표고점 추출 후 TIN·크리깅·공삼차보간으로 5 m 격자 DEM을 제작하도록 규정. 반면 보안관리규정 `[별표 1]`은 **해상도 90 m보다 정밀하고 3차원 좌표가 포함된 3차원 공간정보**를 `공개제한`으로, **좌표가 없는 일반지역 3차원 영상자료**를 `공개`로 분류하며, **인터넷 등을 통해 좌표와 1:5,000 축척 이상 지도의 등고선·표고값 표시 불가**를 규정. **`가상 방안좌표` 게임 빌드에 대한 1차 출처 언급은 없음(`fact: null`).** | 저작권상 **비상업 제한 없음**(공공누리 제1유형), 단 **저작권법 제24조의2제1항 단서·공간정보관리법 제15조/제16조·보안관리규정 별표 1** 적용 | 한국 전역 1:5,000 도엽 제공 (진안 `35702`·`35706`, 문경 `36801`·`36805`, 봉평 `37806`) | 수치지도(`20240924`), 고시 제`2026-283`호(`2026-01-13`), 예규 제`199`호(`2024-05-01`) | [공공데이터포털 `15015482`](https://www.data.go.kr/data/15015482/fileData.do), [고시 제2026-283호](https://www.law.go.kr/LSW/admRulInfoR.do?admRulSeq=2100000272806), [예규 제199호 별표 1](https://www.law.go.kr/LSW/flDownload.do?flSeq=144914683) |
| **(다)** | **DSM 수관 감산 오차 및 90 m 공개 DEM 검산법** | **[발행 문헌 수치]** GLO-30은 산림에서 수관 중앙부에 군집(Guth 2021); 산림 MAE `5.15 m` vs FABDEM `2.88 m`(Hawker 2022); 수관 $>50\%$ 구간 GLO-30 ME `-2.94 m`, MAE `3.78 m`, RMSE `5.14 m` vs GEDTM30 ME `-0.00 m`, RMSE `3.73 m`(Ho 2025); 농경지 GLO-30 MAE `0.43 m`(Pronk 2024).<br>**[자체 산술 추정]** X-band 침투($\alpha=0.5$) 시 임분고 $16\text{ m}$ 전량 감산은 `-8.00 m` 과대 감산 편향 유발; 시기 불일치(2011~2015 vs 2024~2026) 생장분 `3.0~6.5 m` 및 신축 건물 구덩이; 양자화 표준편차 `0.58 m`; $25^\circ$ 경사 반픽셀($15\text{ m}$) 수평 오차 `6.99 m`.<br>**[검산법]** $9\times 9=81$개($10\text{ m}\to 90\text{ m}$) 블록 평균 후 개활 평지에서 수직 기준면 오프셋($\Delta\bar{z}_{\text{datum}}$) 분리 및 피복별 잔차·유효 감산 계수($\hat{\alpha}$) 역산. | 해당 없음 (기술·수치 분석) | 후보지 오차 민감도: **C(진안 분지, 개활 농경지) < A(문경, 혼합 지형) < B(봉평, 급경사 울창 산림)** | GLO-30(`2010~2015` 촬영), 임상도(`2024`), 건물통합정보(`2026`), NGII `90 m` 공개 DEM | [Guth & Geoffroy (2021)](https://api.crossref.org/works/10.1111/tgis.12825), [Hawker et al. (2022)](https://api.crossref.org/works/10.1088/1748-9326/ac4d4f), [Ho et al. (2025)](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12296579/fullTextXML), [Pronk et al. (2024)](https://www.nature.com/articles/s41597-024-03091-9) |
| **(라)** | **후보 3곳(진안·문경·봉평)의 90 m 공개 DEM 및 GLO-30 확보 방법** | **Copernicus GLO-30 / GLO-90**: AWS S3(`copernicus-dem-30m` / `copernicus-dem-90m`)에서 로그인·키 없이 단일 타일 즉시 확보 가능 (`C 진안`: `N35_00_E127_00` `46.11 MiB` / `5.55 MiB`, `A 문경`: `N36_00_E128_00` `46.24 MiB` / `5.52 MiB`, `B 봉평`: `N37_00_E128_00` `43.05 MiB` / `5.24 MiB`).<br>**국토지리정보원 90 m 공개 DEM**: 국토정보플랫폼(`map.ngii.go.kr`)에서 **회원 로그인 + 대용량 파일전송 S/W**를 통해 영역·도엽 지정 다운로드. | GLO-30/90: 상업적 이용·재배포 가능(출처표시)<br>NGII 90 m 공개 DEM: 공공누리 제1유형(`공개` 등급) | 3곳 모두 $10.24\text{ km}\times 10.24\text{ km}$ 영역이 단일 $1^\circ\times 1^\circ$ 타일 내부에 100% 수록됨 | `COP-DEM_GLO-30-DGED` / `GLO-90-DGED` (`COG`), NGII 공개DEM(`90 m`) | [AWS S3 `tileList.txt`](https://copernicus-dem-30m.s3.amazonaws.com/tileList.txt), [공공데이터포털 `15059920`](https://www.data.go.kr/data/15059920/fileData.do) |

---

## 1. 조사 배경 및 맥락 (`#57`, `#52`, `#69`)

1. **선행 라이선스 조사 (`#52`, [`research/m2-geodata-licence.md`](research/m2-geodata-licence.md))**:
   - 국토지리정보원 **고해상도 수치표고모형(1 m·5 m·10 m·30 m DEM)**은 「국토지리정보원 국가공간정보 보안관리규정」(국토지리정보원예규 제199호) `[별표 1]`의 `"해상도가 90m보다 정밀하고 3차원 좌표가 포함된 3차원 공간정보"`에 해당하여 **`공개제한`** 등급으로 분류되며, 공개 게임 빌드에 원시·파생 격자를 직접 수록해 재배포할 수 없다 ([`research/m2-geodata-licence.md`](research/m2-geodata-licence.md)).
   - 반면 **Copernicus DEM (GLO-30 / GLO-90)**, **산림청 1:5,000 임상도**, **국토교통부 건물통합정보**, **국토지리정보원 1:5,000 수치지형도**는 각각 공개 라이선스 또는 공공누리 제1유형으로 배포된다 ([`research/m2-geodata-licence.md`](research/m2-geodata-licence.md)).
2. **시제품 지면 근사 방식의 한계 (`#57`)**:
   - `#57`에서 검토된 시제품 파이프라인은 `Copernicus GLO-30 (30 m DSM) − 임상도 임분고(HEIGHT) − 건물통합정보 높이`로 지면 표고(DTM)를 근사한다.
   - 그러나 GLO-30은 TanDEM-X X-band 레이더 간섭기법(InSAR) 기반 **수치표면모형(DSM)**이므로 산림 수관 및 건물 높이가 섞여 있고, 특히 한국 전장 후보지 3곳(진안·문경·봉평, 각 $10.24\text{ km}\times 10.24\text{ km}$, $10\text{ m}$ 격자 $1,024\times 1,024$ 셀, [`GLOSSARY.md`](GLOSSARY.md) 기준 **가상 방안좌표** 적용)에서 단순 감산 시 수관 침투·시기 불일치·경사 오차가 발생한다.
3. **본 조사(`#69`)의 4대 과제**:
   - **(가)** Copernicus 계열 나지 표고(bare-earth) 파생 자료의 발행처 원문 라이선스(비상업 조건 유무), 해상도, 한국 커버리지, 판 식별자
   - **(나)** 공개 수치지형도 등고선·표고점으로 DTM을 만드는 길: 공공누리 조건, 보안관리규정 `[별표 1]`이 가상 방안좌표 빌드에 닿는지에 대해 1차 출처가 말하는 것
   - **(다)** DSM에서 수관 높이를 뺄 때의 알려진 오차(X-band 수관 침투 등)와 90 m 공개 DEM으로 검산하는 방법 (문헌 수치와 자체 산술 추정 분리)
   - **(라)** 후보 3곳(진안, 문경, 봉평)의 90 m 공개 DEM·GLO-30 확보 방법

---

## 2. (가) Copernicus 계열 나지 표고(Bare-Earth) 파생 자료 조사

> **작성 규칙 준수**: 각 데이터셋 발행처(publisher)가 공식 저장소 메타데이터 및 문서에서 직접 진술한 원문(publisher's own words)으로부터 출발하여, 비상업적 이용 제한(Non-Commercial) 유무를 포함한 라이선스 문언, 공간 해상도, 한국 커버리지, 판 식별자(version identifier)를 기술한다.

### 2-1. 데이터셋별 상세 비교표

| 데이터셋명 | 발행처 / 기탁 저장소 | 발행처 원문 라이선스 표기 (Publisher's Own Words) | 비상업(NC) 조건 유무 | 공간 해상도 / 좌표·수직 기준 | 한국 및 후보 3곳(진안·문경·봉평) 커버리지 | 판 식별자 (Version Identifiers) 및 DOI |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **FABDEM** *(Forest And Buildings removed Copernicus DEM)* | University of Bristol & Fathom (`data.bris.ac.uk` / DataCite) | `"The FABDEM dataset is licensed under a Creative Commons "CC BY-NC-SA 4.0" license. For commercial use queries, please contact fabdem@fathom.global"` | **있음** (`CC BY-NC-SA 4.0`: 비상업적 이용만 허용, 상업적 이용은 `fabdem@fathom.global` 별도 계약 필요, 2차적 저작물 동일조건변경허락 필수) | `1 arc second grid spacing (approximately 30m at the equator)` / WGS84 (`EPSG:4326`), `EGM2008` | **전역 포함**: $60^\circ\text{S}\sim 80^\circ\text{N}$ 전 지구 육지. $10^\circ\times 10^\circ$ 압축팩 `N30E120-N40E130_FABDEM_V1-2.zip` 내부에 후보 3곳 타일(`N35E127`, `N36E128`, `N37E128`) 모두 수록 | - `FABDEM V1-0` (`2021-12-21`, DOI: [`10.5523/bris.25wfy0f9ukoge2gs7a5mqpq2j7`](https://api.datacite.org/dois/10.5523/bris.25wfy0f9ukoge2gs7a5mqpq2j7))<br>- `FABDEM V1-2` (`2023-05-30`, DOI: [`10.5523/bris.s5hqmjcdj8yo2ibzi9b4ew3sn`](https://api.datacite.org/dois/10.5523/bris.s5hqmjcdj8yo2ibzi9b4ew3sn)) |
| **FathomDEM** | Fathom (`Zenodo`) | `"license": {"id": "cc-by-nc-sa-4.0"}`, `"access_right": "restricted"`, `"FathomDEM is available under a CC BY-NC-SA 4.0 license. This allows non commercial use and requires that any derivatives of FathomDEM are also published under the same license. Please apply for access using your academic email address..."` | **있음** (`CC BY-NC-SA 4.0`: 비상업 `NC` + 동일조건변경허락 `SA` + 학술 이메일 사전 승인제 `restricted`) | `1 arc-second` (`global 30m DEM`) / WGS84, `EGM2008` | **지리적 범위 포함이나 파일 비공개(`restricted`)**: `FathomDEM v1-0 Eurasia and Africa` (`locations east of 30W (including Europe, Africa, Asia and part of Oceania)`)에 한국 전역이 포함되나 학술 이메일 승인 전 다운로드 불가 | - `v1.0` (`v1-0`, 유라시아·아프리카 `2024-12-18` DOI: [`10.5281/zenodo.14511570`](https://zenodo.org/api/records/14511570); 아메리카 `2025-02-11` DOI: [`10.5281/zenodo.14523356`](https://zenodo.org/api/records/14523356)) |
| **GEDTM30** *(Global Ensemble Digital Terrain Model 30m)* | OpenGeoHub Foundation (`Zenodo`, `Codeberg`, `s3.opengeohub.org`) | Zenodo: `"license": {"id": "cc-by-4.0"}`, `"access_right": "open"`. Codeberg `README.md`: `"This dataset is released under fully open license CC-BY 4.0 (https://creativecommons.org/licenses/by/4.0/deed.en)."`<br>단, Zenodo 본문 Disclaimer: `"Use for testing purposes only... The data is provided "as is.""` | **자체 라이선스에는 없음** (`CC-BY 4.0`). 단, (1) Zenodo 본문에 `"Use for testing purposes only"` 면책 문구 병기, (2) 원저 논문 Table 1상 입력 DSM으로 `Copernicus GLO-30` 외에 **`ALOS AW3D30` 등을 함께 결합** | `1-arc-second (~30m)` (`0.000277777777778°`) / Horizontal `EPSG:4326`, Vertical `EGM2008 (EPSG:3855)`, `Float32` (v1.2 COG) | **전역 포함 및 무인증 즉시 접근 가능**: 경도 $-180^\circ\sim +180^\circ$, 위도 $-65^\circ\sim +85^\circ$ 전 지구 단일 BigTIFF COG (`432,407,644,715 B`), HTTP Range 요청으로 후보 3곳 영역만 부분 추출 가능 | - `v0` (`2025-02-24`, `10.5281/zenodo.14900181`)<br>- `v1` (`2025-05-22`, `10.5281/zenodo.15490367`)<br>- `v1.01` (`10.5281/zenodo.15645631`, Deprecated)<br>- `v1.1` (`2025-06-11`, `10.5281/zenodo.15689805`)<br>- `v1.2` / `v1.2.0` (`2026-03-06`, DOI: [`10.5281/zenodo.18887460`](https://zenodo.org/api/records/18887460), 권장판)<br>*(선행 `EDTM v1` `10.5281/zenodo.7634679`는 FABDEM 라이선스 이슈로 폐기·삭제)* |
| **DiluviumDEM** | Climate Central 외 (`Zenodo`) | Zenodo: `"license": {"id": "cc-by-4.0"}`, `"access_right": "open"`, `"DiluviumDEM was produced using Copernicus WorldDEM-30 © DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018 provided under COPERNICUS by the European Union and ESA; all rights reserved."` | **없음** (`CC BY 4.0` + Copernicus 원저작물 출처표시) | `1 arc-second` (`30m`) / WGS84, `EGM2008` | **해안 저지대($\le 80\text{ m}$)만 유효 — 내륙 후보지 3곳 미적용**: 한국 해안 타일(`N35E125.zip` `226.6 MB`, `N35E130.zip` `11.0 MB`, `N30E125.zip` `44.1 MB`)은 존재하나, 표고 $80\text{ m}$ 이하 해안 전용 보정 모델이므로 표고 $200\sim 1,300\text{ m}$인 진안·문경·봉평은 대상 외 | - `1.0` (`2023-09-12`, DOI: [`10.5281/zenodo.8384665`](https://zenodo.org/api/records/8384665), 개념 DOI `10.5281/zenodo.8329293`) |
| **DeltaDTM** | TU Delft & Deltares (`4TU.ResearchData`) | `"DeltaDTM is licensed as CC-BY 4.0. DeltaDTM is produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved."` | **4TU 원본은 없음** (`CC-BY 4.0` + Copernicus 출처표시).<br>*(단, WUR 해수면 기준 파생판 `10.17887/wur01-gx7s1b`는 `CC BY-NC-SA 4.0`)* | `1 arc-second` (`~30 m`), `EPSG:9518` (`EPSG:4326` + `EGM2008 EPSG:3855`) | **내륙 후보지 3곳 결측(절단)**: `v1.1` 기준 `EGM2008` 표고 $30\text{ m}$ 초과 픽셀을 전부 절단(`255` 플래그 처리)하므로 `N35E127`·`N37E128`은 해안·하구만 남고, 내륙 타일인 **`DeltaDTM_v1_1_N36E128.tif`(문경)는 아예 존재하지 않음** | - `v1.0` (`2024-03-06`, `10.4121/21997565.v1`·`v2`, $10\text{ m +MSL}$ 절단)<br>- `v1.1` (`2024-08-25`, `10.4121/21997565.v3`, $30\text{ m +EGM2008}$ 절단)<br>- `v1.1.1` (`2024-12-10`, DOI: [`10.4121/21997565.v4`](https://api.datacite.org/dois/10.4121/21997565.v4)) |

---

### 2-2. 데이터셋별 1차 출처 검증 세부 내용

#### (1) FABDEM (`V1-0`, `V1-2`)
- **발행처 원문 라이선스 ([DataCite DOI `10.5523/bris.s5hqmjcdj8yo2ibzi9b4ew3sn`](https://api.datacite.org/dois/10.5523/bris.s5hqmjcdj8yo2ibzi9b4ew3sn), [`10.5523/bris.25wfy0f9ukoge2gs7a5mqpq2j7`](https://api.datacite.org/dois/10.5523/bris.25wfy0f9ukoge2gs7a5mqpq2j7))**:
  - `rightsList`: `"The FABDEM dataset is licensed under a Creative Commons "CC BY-NC-SA 4.0" license. For commercial use queries, please contact fabdem@fathom.global"`
  - **비상업 조건 유무**: **있음 (`NC`, Non-Commercial)** 및 **동일조건변경허락 (`SA`, ShareAlike)**. 상업적 활용 시 Fathom(`fabdem@fathom.global`)과 별도 상업 라이선스 계약을 체결해야 한다.
  - **출처 간 상충 주의점**: Zenodo에 등록된 2쪽 분량의 V1-2 학회 초록 문서([`https://zenodo.org/api/records/8101259`](https://zenodo.org/api/records/8101259))와 원저 논문 본문([Hawker et al., 2022, `10.1088/1748-9326/ac4d4f`](https://api.crossref.org/works/10.1088/1748-9326/ac4d4f))은 텍스트 저작물에 대해 `CC BY 4.0`을 표기하나, 실제 지형 래스터 파일이 기탁된 브리스톨 대학교 데이터 저장소(`data.bris.ac.uk`)의 공식 라이선스는 `CC BY-NC-SA 4.0`이다.
- **해상도·커버리지·판 식별자**:
  - 해상도: `1 arc second grid spacing (approximately 30m at the equator)`.
  - 커버리지: 위도 $60^\circ\text{S}\sim 80^\circ\text{N}$ 전 지구 육지. $1^\circ\times 1^\circ$ GeoTIFF 타일을 $10^\circ\times 10^\circ$ 단위 ZIP 파일로 묶어 배포하며, 한국 전역은 `N30E120-N40E130_FABDEM_V1-2.zip` 하나에 포함된다. (단, 조회일 `2026-11-09` 기준 `data.bris.ac.uk` 파일 서버는 TCP 연결 재설정·타임아웃이 발생하였다.)
  - 판 식별자: `FABDEM V1-0` (2021년 12월 21일 공개, DOI `10.5523/bris.25wfy0f9ukoge2gs7a5mqpq2j7`), `FABDEM V1-2` (2023년 5월 30일 공개, 메타데이터 갱신 `2025-04-18`, DOI `10.5523/bris.s5hqmjcdj8yo2ibzi9b4ew3sn`).

#### (2) FathomDEM (`v1.0`)
- **발행처 원문 라이선스 ([Zenodo `14511570`](https://zenodo.org/api/records/14511570), [`14523356`](https://zenodo.org/api/records/14523356))**:
  - Zenodo 메타데이터: `"license": {"id": "cc-by-nc-sa-4.0"}`, `"access_right": "restricted"`.
  - 발행처 접근 신청 조건 원문(`accept_conditions_text`):
    > `"FathomDEM is available under a CC BY-NC-SA 4.0 license. This allows non commercial use and requires that any derivatives of FathomDEM are also published under the same license. Please apply for access using your academic email address to allow us to process your request as soon as possible. If you are interested in a commercial use, please contact Fathom through our website: https://www.fathom.global/product/fathomdem-global-terrain-data/"`
  - **비상업 조건 유무**: **있음 (`CC BY-NC-SA 4.0`)** + **학술 이메일 사전 승인(`restricted`)**.
- **해상도·커버리지·판 식별자**:
  - 해상도: `1 arc-second` (`global 30m DEM`, [Uhe et al., 2025, `10.1088/1748-9326/ada972`](https://api.crossref.org/works/10.1088/1748-9326/ada972)).
  - 커버리지: `FathomDEM v1-0 Eurasia and Africa` (`10.5281/zenodo.14511570`)가 서경 $30^\circ$ 동쪽의 유럽·아프리카·아시아·오세아니아 일부를 포괄하므로 한국 전역이 포함되나, Zenodo 파일 접근 권한이 `restricted`로 잠겨 있어 학술 이메일 승인 없이는 내려받을 수 없다.
  - 판 식별자: `v1.0` (`v1-0`, 유라시아·아프리카 `2024-12-18`, 아메리카 `2025-02-11`).

#### (3) GEDTM30 (`v0` ~ `v1.2.0`) 및 선행 EDTM (`v1`)
- **발행처 원문 라이선스 ([Zenodo `18887460`](https://zenodo.org/api/records/18887460), [Codeberg `openlandmap/GEDTM30` `README.md`](https://codeberg.org/openlandmap/GEDTM30/raw/branch/main/README.md))**:
  - Zenodo 메타데이터: `"license": {"id": "cc-by-4.0"}`, `"access_right": "open"`.
  - Codeberg `README.md` (`License` 절):
    > `"This dataset is released under fully open license CC-BY 4.0 (https://creativecommons.org/licenses/by/4.0/deed.en)."`
  - Zenodo 본문 `Disclaimer` 절 원문:
    > `"This is the first release of the Global Ensemble Digital Terrain Model (GEDTM30). Use for testing purposes only. The model is actively being improved, and future updates will enhance accuracy and reliability. The data is provided "as is." OpenGeoHub Foundation and its contributors are not responsible for any errors, omissions, or consequences arising from its use."`
  - 선행 `EDTM v1` 폐기 기록([Codeberg `README.md`](https://codeberg.org/openlandmap/GEDTM30/raw/branch/main/README.md)):
    - `EDTM v1` (`2023-02-13`, `https://doi.org/10.5281/zenodo.7634679`): `"Deprecated — Removed. License issue of FABDEM"`.
  - **원시 입력 자료 구성 확인 ([Ho et al., 2025, `10.7717/peerj.19673` / `PMC12296579`](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12296579/fullTextXML), Table 1)**:
    - GEDTM30은 FABDEM을 입력에서 제외한 대신, **Copernicus DEM GLO-30**과 **JAXA ALOS World 3D-30m (`AW3D30` v3.2/v4.1)** 두 가지 30 m DSM에 더해 GEDI L2A, ICESat-2 ATL08, 산림 수관고(GLAD GFC, ETH Global Canopy Height, Meta/WRI High Resolution Canopy Height), VIIRS 야간광, 식생지수 등을 결합한 랜덤 포레스트 앙상블 모델이다.
- **해상도·커버리지·판 식별자 및 기술 검증**:
  - 해상도: `1-arc-second (~30m)` (`0.00027777777777799305° = 1/3,600°`), 수평 `EPSG:4326`, 수직 `EGM2008 (EPSG:3855)`.
  - 한국 커버리지 및 S3 COG 직접 검증:
    - S3 직링크: [`https://s3.opengeohub.org/global/dtm/v1.2/gedtm_rf_m_30m_s_20060101_20151231_go_epsg.4326.3855_v1.2.tif`](https://s3.opengeohub.org/global/dtm/v1.2/gedtm_rf_m_30m_s_20060101_20151231_go_epsg.4326.3855_v1.2.tif) (`432,407,644,715 B` $\approx 402.7\text{ GiB}$, `Accept-Ranges: bytes`).
    - HTTP Range 요청으로 첫 64 KB BigTIFF 헤더를 파싱한 결과: `ImageWidth = 1,296,009`, `ImageLength = 540,009`, 범위 `[-180.00125°, -65.0009721°, +180.0009719°, +85.00125°]`로 **한국 전역 및 후보지 3곳을 100% 포함**한다.
    - **출처 내부 상충 주의**: Codeberg `README.md` 표에는 `Scale factor = 10`, `Data type = Int32`로 기재되어 있으나, Zenodo `v1.2.0` 릴리스 노트와 [`metadata/cog_list.csv`](https://codeberg.org/openlandmap/GEDTM30/raw/branch/main/metadata/cog_list.csv)에는 `Scale = 1`, `Float32`로 기재되어 있으며, 실제 `v1.2.tif` BigTIFF 태그 검증 결과 `SampleFormat = 3 (IEEE Float32)`이되 GDAL XML 메타데이터 안에 구버전의 `<Item name="SCALE" sample="0" role="scale">0.100000000000000006</Item>` 태그가 남아 있음을 확인하였다.
  - 판 식별자: `v0` (`2025-02-24`, `14900181`), `v1` (`2025-05-22`, `15490367`), `v1.01` (`15645631`, Deprecated), `v1.1` (`2025-06-11`, `15689805`), `v1.2` / `v1.2.0` (`2026-03-06`, `18887460`, Recommended).

#### (4) DiluviumDEM (`1.0`)
- **발행처 원문 라이선스 ([Zenodo `8384665`](https://zenodo.org/api/records/8384665))**:
  - Zenodo 메타데이터: `"license": {"id": "cc-by-4.0"}`, `"access_right": "open"`.
  - 발행처 설명문 원문:
    > `"DiluviumDEM was produced using Copernicus WorldDEM-30 © DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018 provided under COPERNICUS by the European Union and ESA; all rights reserved."`
  - **비상업 조건 유무**: **없음 (`CC BY 4.0`)**.
- **해상도·한국 커버리지 한계·판 식별자**:
  - 해상도: `1 arc-second` (`30m`). 판 식별자: `1.0` (`2023-09-12`, DOI `10.5281/zenodo.8384665`, [Dusseau et al., 2023, `10.1016/j.rse.2023.113812`](https://api.crossref.org/works/10.1016/j.rse.2023.113812)).
  - **내륙 후보지 미적용 사유**: 발행처 원문이 `"DiluviumDEM is a global coastal digital elevation model based on the CopernicusDEM (30m) but corrected up to 80 meters in elevation using a LightGBM model."`라고 밝히듯 **해발 $80\text{ m}$ 이하 해안 지역만 보정**하므로, 해발 $200\sim 1,300\text{ m}$에 위치한 진안·문경·봉평 후보지에는 적용되지 않는다.

#### (5) DeltaDTM (`v1.0`, `v1.1`, `v1.1.1`)
- **발행처 원문 라이선스 ([4TU.ResearchData `10.4121/21997565.v4`](https://data.4tu.nl/v2/articles/21997565), [`README.md`](https://data.4tu.nl/file/1da2e70f-6c4d-4b03-86bd-b53e789cc629/71c77b5f-b340-4fdb-a1b1-1d255b8ddb0f))**:
  - `README.md` (`License` 절) 원문:
    > `"DeltaDTM is licensed as CC-BY 4.0. DeltaDTM is produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved."`
  - **비상업 조건 유무**: 4TU.ResearchData의 원본 데이터셋(`10.4121/21997565.v4`)에는 **비상업 조건이 없음 (`CC-BY 4.0`)**. (단, 바헤닝언 대학교가 별도 배포하는 해수면 기준 파생판 [`10.17887/wur01-gx7s1b`](https://api.datacite.org/dois/10.17887/wur01-gx7s1b)은 `CC BY-NC-SA 4.0`을 사용한다.)
- **해상도·한국 커버리지 한계·판 식별자**:
  - 해상도: `1 arc-second` (`~30 m`), `EPSG:9518` (`WGS84` + `EGM2008`). 판 식별자: `v1.0` (`2024-03-06`, `.v1`·`.v2`), `v1.1` (`2024-08-25`, `.v3`), `v1.1.1` (`2024-12-10`, `.v4`, [`CHANGELOG.md`](https://data.4tu.nl/file/1da2e70f-6c4d-4b03-86bd-b53e789cc629/b0403ff2-0aa5-4394-9413-2eb851e0fa50)).
  - **내륙 후보지 결측 확인**: `README.md` 원문은 `"value 255 to indicate where DeltaDTM is *clipped* at 30 m +EGM2008"`라고 명시하며, [`deltadtm_v1_1.vrt`](https://data.4tu.nl/file/1da2e70f-6c4d-4b03-86bd-b53e789cc629/46fd11df-e2f2-4a47-93dc-8122f4683b21) 파일 목록을 직접 검사한 결과 `N35E127`·`N37E128`은 해안·저지대($\le 30\text{ m}$)만 남고 **`DeltaDTM_v1_1_N36E128.tif`(문경 후보지 A)는 타일 자체가 존재하지 않음**을 확인하였다.

---

## 3. (나) 공개 수치지형도 등고선·표고점으로 DTM을 만드는 길

> **작성 규칙 준수**: 오직 1차 출처(법령, 고시, 예규, 공공데이터포털·국토지리정보원 공식 문서)가 직접 말하는 바만 인용한다. 가상 방안좌표를 사용하는 게임 빌드에 관해 1차 출처가 언급하는 바가 없으면 없다고 명시한다.

### 3-1. 공개 수치지형도(1:5,000 등)의 공공누리 조건과 법률상 단서

1. **공공데이터포털 공식 메타데이터 ([`https://www.data.go.kr/data/15015482/fileData.do`](https://www.data.go.kr/data/15015482/fileData.do), `국토교통부 국토지리정보원_수치지도_20240924`, 수정일 `2025-06-22`)**:
   - 원문 표기:
     > `"비용부과유무 무료 ... 이용허락범위 공공저작물 : 출처표시 (제 1유형)"`
2. **공공누리 제1유형 공식 이용조건 ([`https://www.kogl.or.kr/info/licenseType1.do`](https://www.kogl.or.kr/info/licenseType1.do))**:
   - 원문 표기:
     > `"공공저작물을 상업적 활용 여부에 관계없이 무료로 자유롭게 이용하고 2차적 저작물 작성 등 변형하여 이용할 수 있습니다."`
3. **「저작권법」 제24조의2제1항 단서 ([`https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=188405`](https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=188405)) 및 국토지리정보원 저작권정책 ([`https://www.ngii.go.kr/kor/content.do?sq=261`](https://www.ngii.go.kr/kor/content.do?sq=261))**:
   - 「저작권법」 제24조의2제1항 본문 및 단서 원문:
     > `"국가 또는 지방자치단체가 업무상 작성하여 공표한 저작물이나 계약에 따라 저작재산권의 전부를 보유한 저작물은 허락 없이 이용할 수 있다. 다만, 다음 각 호의 어느 하나에 해당하는 경우에는 그러하지 아니하다.`
     > `1. 국가안전보장에 관련되는 정보가 포함되어 있는 경우`
     > `...`
     > `3. 다른 법률에 따라 공개가 제한되는 정보가 포함되어 있는 경우"`
   - 국토지리정보원 저작권정책 원문:
     > `"국토지리정보원에서 제공하는 공간정보 등 별도의 법률에 의해 공개가 제한되는 정보를 포함하는 경우 해당 법률에서 규정하는 절차에 의해 이용하여야 합니다"`

### 3-2. 1:5,000 수치지형도 등고선·표고점으로부터 격자 DTM을 제작하는 공식 절차

국토지리정보원의 **「수치표고모형의 구축 및 관리 등에 관한 규정」**(국토지리정보원고시 제2026-283호, `2026-01-13` 시행, [`https://www.law.go.kr/LSW/admRulInfoR.do?admRulSeq=2100000272806`](https://www.law.go.kr/LSW/admRulInfoR.do?admRulSeq=2100000272806))은 제2조에서 `"수치표고모형(Digital Elevation Model)"이란 수치지면자료를 이용하여 격자형태로 제작한 지표모형을 말한다`라고 정의하고, **제46조~제48조**에서 1:5,000 수치지형도의 등고선·표고점을 이용해 격자 수치표고모형을 제작하는 절차를 다음과 같이 직접 규정한다:

- **제46조(적용방법)**:
  > `"항공레이저측량이 수행되지 않은 지역의 수치표고모형을 제작할 경우에는 제47조 및 제48조의 규정에 따른다."`
- **제47조(지형자료 추출)**:
  > `"① 발주처에서 제공하는 최신의 1/5,000 수치지형도 및 수치도화 성과에서 수치표고모형 제작을 위해 필요한 등고선, 표고점 등의 지형자료를 추출한다."`
  > `"② 제1항에서 추출된 지형자료는 다음 각 호에 따라 편집한다.`
  > `1. 등고선, 표고점 등의 높이값에 이상이 있는 경우 인접한 지형자료 등을 이용하여 수정한다.`
  > `2. 수치도화 성과의 경우 도로, 하천 등 선형 지형지물의 연속성이 단절된 경우에는 인접한 지형자료 등을 참조하여 연결한다."`
- **제48조(수치표고모형의 제작)**:
  > `"추출된 지형자료를 이용하여 불규칙삼각망, 크리깅(Kriging)보간 또는 공삼차보간 등 제7조에 규정된 정확도를 확보할 수 있는 보간방법으로 5m 격자간격의 수치표고모형을 제작한다."`

### 3-3. 「국토지리정보원 국가공간정보 보안관리규정」 `[별표 1]` 및 관련 1차 법령이 말하는 것

1. **「국토지리정보원 국가공간정보 보안관리규정」**(국토지리정보원예규 제199호, `2024-05-01` 시행, [`https://www.law.go.kr/LSW/admRulInfoR.do?admRulSeq=2100000240356`](https://www.law.go.kr/LSW/admRulInfoR.do?admRulSeq=2100000240356)) **[별표 1] 「국가공간정보 세부 분류기준」**([`https://www.law.go.kr/LSW/flDownload.do?flSeq=144914683`](https://www.law.go.kr/LSW/flDownload.do?flSeq=144914683))의 관련 조문 원문은 다음과 같다:

| 구분 (구분코드) | 등급 | `[별표 1]` 원문 인용 (Verbatim Quote) |
| :--- | :--- | :--- |
| **전자지도** | **공개제한** | `- o 국가보안시설 및 군사시설을 제외한 국가기간시설(전력ㆍ통신ㆍ가스ㆍ석유ㆍ수자원 분야 등)이 포함된 지도`<br>`  * 단, 상하수도 분야의 관망도와 지자체에서 관리하는 공동구는 공개제한 대상에서 제외하고, 등고선과 표고점은 1:1,000 축척 이상에 한정함`<br>`- o 1:1,000 축척 이상 지도의 등고선과 표고점`<br>`- o 전용 지리정보시스템(GIS)에 직접 활용될 수 있는 22개 지형 분류 코드가 포함된 1:25,000 축척 이상 수치지형도` |
| **전자지도** | **공개** | `- o “비공개” 및 “공개제한” 대상 이외의 지도`<br>`- o 인터넷ㆍ내비게이션ㆍ휴대폰 등을 통해 좌표와 1:5,000 축척 이상 지도의 등고선ㆍ표고값 표시 불가` |
| **기타 공간정보** | **공개제한** | `- o 해상도가 90m보다 정밀하고 3차원 좌표가 포함된 3차원 공간정보`<br>`- o 단, 해상도 90m보다 정밀하고 3차원 좌표가 포함된 공간정보 중 도로 지역은 보안성 검토를 거쳐 국가안보상 위해 요인이 없는 경우 공개` |
| **기타 공간정보** | **공개** | `- o 좌표가 없는 일반지역 3차원 영상자료`<br>`- o 3차원 좌표가 있고 해상도가 90m보다 낮은 입체영상자료` |

2. **「공간정보의 구축 및 관리 등에 관한 법률」**([`https://www.law.go.kr/LSW/lsInfoP.do?lsId=011023`](https://www.law.go.kr/LSW/lsInfoP.do?lsId=011023), 법률 제20125호)의 관련 조문 원문:
   - **제15조(기본측량성과의 고시 등) 제4항**:
     > `"기본측량성과 등을 사용하여 지도등을 간행하려는 자는 제1항에 따라 고시된 기본측량성과 등을 사용하여야 하며, 대통령령으로 정하는 바에 따라 국토교통부장관의 간행심사를 받아야 한다."`
   - **제16조(기본측량성과의 국외 반출 금지) 제1항**:
     > `"누구든지 국토교통부장관의 허가 없이 기본측량성과 중 지도등 또는 측량용 사진을 국외로 반출하여서는 아니 된다. 다만, 대통령령으로 정하는 경우에는 그러하지 아니하다."`

3. **가상 방안좌표(`virtual grid references`) 빌드에 대해 1차 출처가 말하는 것 (`미확인 / 규정 없음`)**:
   - 「국토지리정보원 국가공간정보 보안관리규정」 본문 전 조문과 `[별표 1]`, 「공간정보의 구축 및 관리 등에 관한 법률」 및 동법 시행령·시행규칙, 「국토지리정보원 공간정보 공급 규정」, 「수치표고모형의 구축 및 관리 등에 관한 규정」 등 **어떠한 1차 출처도 '가상 방안좌표(virtual grid references)', '가상 격자 코드', '국지 상대좌표', 또는 '게임 빌드'에 관해 언급하지 않는다 (`답이 없음`, `fact: null`).**
   - 구체적으로, 1차 출처에는 다음 세 가지 지점에 대한 명시적 문언이 존재하지 않는다:
     1. 실제 측지계 원점(`e0, n0`)을 빌드에서 제거하고 [`GLOSSARY.md`](GLOSSARY.md)의 가상 방안좌표(`두 글자 가상 격자 기호 + 6자리·8자리 상대 동향·북향 미터 숫자`)와 $10\text{ m}$ 간격 표고 배열(`elevation[i][j]`)만 수록한 파일이 `[별표 1]`의 **`"해상도가 90m보다 정밀하고 3차원 좌표가 포함된 3차원 공간정보"`(`공개제한`)**에 해당하는지, 아니면 **`"좌표가 없는 일반지역 3차원 영상자료"`(`공개`)**에 해당하는지 여부.
     2. 1:5,000 수치지형도의 등고선·표고점으로부터 보간한 파생 지형 위에서 가상 방안좌표와 $20\text{ m}$ 주곡선·표고값을 화면에 표시하는 것이 `[별표 1]` `전자지도 > 공개` 란의 **`"인터넷ㆍ내비게이션ㆍ휴대폰 등을 통해 좌표와 1:5,000 축척 이상 지도의 등고선ㆍ표고값 표시 불가"`**에서 말하는 `'좌표'` 및 `'1:5,000 축척 이상 지도의 등고선·표고값'`에 해당하는지 여부.
     3. 1:5,000 수치지형도(기본측량성과)를 가공해 만든 게임 전장 데이터 번들의 배포 및 글로벌 저장소·스토어 배포가 「공간정보관리법」 제15조제4항의 **지도등 간행심사** 및 제16조제1항의 **지도등 국외 반출 금지** 대상에 해당하는지 여부.

---

## 4. (다) DSM에서 수관 높이를 뺄 때의 알려진 오차와 90 m 공개 DEM 검산 방법

> **작성 규칙 준수**: 학술 문헌 및 공식 문서에 **발표된 오차 수치(Published Error Figures)**와 본 조사에서 수식과 산술로 유도한 **자체 추정치(Own Estimates)**를 엄격히 분리하여 서술하고, 모든 수치의 산술 계산 과정을 명시한다.

### 4-1. [발행 문헌 수치] 1차 학술 출처에 보고된 GLO-30 및 파생 DTM 오차

#### (1) TanDEM-X / Copernicus GLO-30의 X-band 산림 수관 부분 침투 특성
- **Guth & Geoffroy (2021)** (*Transactions in GIS* 25(5), 2245–2266, [`https://api.crossref.org/works/10.1111/tgis.12825`](https://api.crossref.org/works/10.1111/tgis.12825)):
  - 원문 인용:
    > `"In open terrain, all five DEMs approximate the ground surface. With significant canopy, the Copernicus DEM elevations cluster tightly near the center of the canopy, while the other DEMs are spread throughout and even outside the canopy defined by LiDAR."`
  - **확인된 사실**: TanDEM-X(X-band, 파장 $\lambda \approx 3.1\text{ cm}$, 주파수 $9.65\text{ GHz}$) 신호는 수관 최상단(100% 수고)에서 완전히 산란되지 않고 수관 내부로 부분 침투하여, GLO-30 표고값은 LiDAR가 정의한 **수관 중앙부(near the center of the canopy)** 부근에 밀집한다.

#### (2) 산림·시가지·농경지 구간별 발행 문헌 오차 수치 종합표

| 출처 문헌 (연도, 학술지) | 비교 기준 (Reference) | 지형 / 토지피복 구간 | 대상 DEM | 평균오차 ME ($\text{m}$) | 절대평균오차 MAE ($\text{m}$) | 평균제곱근오차 RMSE ($\text{m}$) | 비고 (원문 정의) |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| **[Hawker et al. (2022)](https://api.crossref.org/works/10.1088/1748-9326/ac4d4f)**<br>*Environ. Res. Lett.* 17, 024016 | 12개국 항공 LiDAR DTM | **산림 (Forests)** | **Copernicus GLO-30** | — | **`5.15`** | — | 보정 전 원시 DSM |
| [Hawker et al. (2022)](https://api.crossref.org/works/10.1088/1748-9326/ac4d4f) | 12개국 항공 LiDAR DTM | **산림 (Forests)** | **FABDEM (V1-0)** | — | **`2.88`** | — | GLO-30 대비 MAE `2.27 m` ($44.1\%$) 감소 |
| [Hawker et al. (2022)](https://api.crossref.org/works/10.1088/1748-9326/ac4d4f) | 12개국 항공 LiDAR DTM | **시가지 (Built-up areas)** | **Copernicus GLO-30** | — | **`1.61`** | — | 보정 전 원시 DSM |
| [Hawker et al. (2022)](https://api.crossref.org/works/10.1088/1748-9326/ac4d4f) | 12개국 항공 LiDAR DTM | **시가지 (Built-up areas)** | **FABDEM (V1-0)** | — | **`1.12`** | — | GLO-30 대비 MAE `0.49 m` ($30.4\%$) 감소 |
| **[Ho et al. (2025)](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12296579/fullTextXML)**<br>*PeerJ* 13:e19673, **Table 3** | 지역별 참조 LiDAR DTM | **수관 피복률 $>50\%$ (`Tree cover >50%`)** | **Copernicus GLO-30 (`COP30`)** | **`-2.94`** | **`3.78`** | **`5.14`** | $\text{ME} = Z_{\text{LiDAR}} - Z_{\text{DEM}}$ (음수는 DEM이 지면보다 높음을 뜻함) |
| [Ho et al. (2025)](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12296579/fullTextXML), **Table 3** | 지역별 참조 LiDAR DTM | **수관 피복률 $>50\%$ (`Tree cover >50%`)** | **GEDTM30** | **`-0.00`** | **`1.91`** | **`3.73`** | GLO-30 대비 RMSE `1.41 m` ($27.4\%$) 감소 |
| [Ho et al. (2025)](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12296579/fullTextXML), **Table 3** | 지역별 참조 LiDAR DTM | **수관 피복률 $10\sim 50\%$ (`Tree cover 10–50%`)** | **Copernicus GLO-30 (`COP30`)** | **`-0.73`** | **`1.85`** | **`3.19`** | 희소·중밀도 수관 구간 |
| [Ho et al. (2025)](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12296579/fullTextXML), **Table 3** | 지역별 참조 LiDAR DTM | **수관 피복률 $10\sim 50\%$ (`Tree cover 10–50%`)** | **GEDTM30** | **`+0.09`** | **`1.56`** | **`2.87`** | — |
| [Ho et al. (2025)](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12296579/fullTextXML), **Table 3** | 지역별 참조 LiDAR DTM | **시가지 (`Built-up`)** | **Copernicus GLO-30 (`COP30`)** | **`-3.06`** | **`3.19`** | **`4.06`** | 건물 높이에 의한 양(+)의 표면 편향 `3.06 m` |
| [Ho et al. (2025)](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12296579/fullTextXML), **Table 3** | 지역별 참조 LiDAR DTM | **시가지 (`Built-up`)** | **GEDTM30** | **`-1.92`** | **`2.21`** | **`3.03`** | — |
| [Ho et al. (2025)](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12296579/fullTextXML), **Table 5** | 전체 LiDAR 검증지 종합 | **육지 안정 수관 (`Terra Firma, stable tree cover`)** | **MERIT DEM / FABDEM / GEDTM30 / FathomDEM** | `-2.12` / `-0.25` / `+0.98` / `-0.18` | `7.56` / `4.30` / `4.38` / `2.87` | `10.76` / `6.82` / `6.72` / `4.95` | 4종 파생 DTM 간 종합 비교 |
| **[Pronk et al. (2024)](https://www.nature.com/articles/s41597-024-03091-9)**<br>*Scientific Data* 11:273 | 해안 항공 LiDAR DTM | **개활 농경지 (`Cropland`)** | **CopernicusDEM / FABDEM / DeltaDTM** | — | **`0.43` / `0.38` / `0.32`** | — | 개활지에서는 보정 전 GLO-30도 $\text{MAE} < 0.5\text{ m}$ |

> **발행 문헌 수치의 핵심 시사점**: [Ho et al. (2025)](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12296579/fullTextXML) Table 3에서 수관 피복률 $>50\%$ 산림의 보정 전 GLO-30 평균 편향은 $\text{ME} = -2.94\text{ m}$ (즉, GLO-30이 실제 지면보다 평균 $+2.94\text{ m}$ 높음)이며, [Hawker et al. (2022)](https://api.crossref.org/works/10.1088/1748-9326/ac4d4f)의 산림 MAE도 $5.15\text{ m}$이다. 이는 일반적인 성숙 산림의 수관 최상단 높이($12\sim 25\text{ m}$)보다 훨씬 작은 값으로, X-band 레이더의 수관 내부 부분 침투 및 $30\text{ m}$ 픽셀 내 수관 공극(canopy gap) 평균화 때문임이 문헌 수치로 확인된다.

---

### 4-2. [자체 산술 추정 — 문헌 수치와 분리] 단순 감산 파이프라인($Z_{\text{GLO-30}} - H_{\text{임분고}} - H_{\text{건물}}$)의 4대 오차 성분 계산

시제품 파이프라인(`#57`)처럼 보정 계수 없이 임상도 임분고($H_{\text{tree}}$)와 건물통합정보 높이($H_{\text{bldg}}$)를 100% 그대로 빼는 식:
$$\hat{Z}_{\text{ground}} = Z_{\text{GLO-30}} - H_{\text{tree}} - H_{\text{bldg}}$$
을 적용할 때 발생하는 4대 오차 성분을 산술적으로 계산하면 다음과 같다.

#### (1) 오차 성분 1 — X-band 수관 부분 침투에 따른 과대 감산 편향 (Over-Subtraction Bias)
- **수식 모형**:
  실제 지면 표고를 $Z_{\text{ground}}$, 임상도 임분고(수관 최상단 높이)를 $H_{\text{tree}}$, GLO-30 픽셀이 실제로 반영하는 유효 수관고 비율(유효 산란 위상 중심 높이 비율)을 $\alpha \in [0, 1]$이라 하면,
  $$Z_{\text{GLO-30}} = Z_{\text{ground}} + \alpha H_{\text{tree}}$$
  여기에 $H_{\text{tree}}$ 전량($100\%$)을 감산하면 추정 지면 표고 $\hat{Z}_{\text{ground}}$의 편향(Bias)은 다음과 같다:
  $$\text{Bias}_{\text{canopy}} = \hat{Z}_{\text{ground}} - Z_{\text{ground}} = (Z_{\text{ground}} + \alpha H_{\text{tree}} - H_{\text{tree}}) - Z_{\text{ground}} = -(1 - \alpha) H_{\text{tree}}$$
- **산술 계산**:
  1. **Guth & Geoffroy (2021)의 수관 중앙부($\alpha = 0.50$) 가정 시**:
     - 한국 중장령림의 전형적인 임상도 임분고 $H_{\text{tree}} = 16\text{ m}$ (`HEIGHT = "16"`, $15\sim 17\text{ m}$ 구간)일 때:
       $$\text{Bias}_{\text{canopy}} = -(1 - 0.50) \times 16\text{ m} = -0.50 \times 16\text{ m} = -8.00\text{ m}$$
     - 수고 $H_{\text{tree}} = 20\text{ m}$ (`HEIGHT = "20"`)인 울창한 침엽수림·혼효림일 때:
       $$\text{Bias}_{\text{canopy}} = -(1 - 0.50) \times 20\text{ m} = -10.00\text{ m}$$
     - 만약 $\alpha = 0.65$ (상부 $35\%$ 침투)이고 $H_{\text{tree}} = 16\text{ m}$이면:
       $$\text{Bias}_{\text{canopy}} = -(1 - 0.65) \times 16\text{ m} = -0.35 \times 16\text{ m} = -5.60\text{ m}$$
  2. **Ho et al. (2025) Table 3의 수관 $>50\%$ 평균 과대편향($+2.94\text{ m}$) 대입 시**:
     - GLO-30이 지면보다 평균 $+2.94\text{ m}$ 높은 상태에서 임상도 임분고 $H_{\text{tree}} = 16.00\text{ m}$를 그대로 빼면:
       $$\text{Bias}_{\text{canopy}} = +2.94\text{ m} - 16.00\text{ m} = -13.06\text{ m}$$
     - 이 경우 유효 비율은 $\alpha = \frac{2.94}{16.00} = 0.18375 \approx 18.4\%$에 불과하여, 임분고 전량 감산 시 산림 경계마다 **$-5.6\text{ m} \sim -13.1\text{ m}$ 깊이의 인공 구덩이(인공 단애)**가 발생한다.

#### (2) 오차 성분 2 — 관측·구축 시기 불일치 오차 (Temporal Mismatch Error)
- **수식 모형**:
  Copernicus GLO-30의 원시 TanDEM-X 관측 시기는 `2010-12 ~ 2015-01` (중심 약 `2013년`)인 반면, 산림청 임상도는 `2024년`, 건물통합정보는 `2026년` 기준이다 ([`research/m2-geodata-licence.md`](research/m2-geodata-licence.md)). 시간차 $\Delta t = t_{\text{vector}} - t_{\text{GLO-30}} \approx 11\sim 13\text{년}$ 동안의 변화량 $\Delta H(\Delta t)$가 그대로 오차로 유입된다.
- **산술 계산**:
  1. **산림 생장분**: 연간 수고 생장률을 $g \in [0.3, 0.5]\text{ m/yr}$, 기간을 $\Delta t = 11\text{년}$ (`2013` $\to$ `2024`)으로 놓으면:
     $$\Delta H_{\text{growth}} = g \times \Delta t = [0.3 \times 11, \; 0.5 \times 11]\text{ m} = [3.30\text{ m}, \; 5.50\text{ m}]$$
     ($\Delta t = 10\sim 13\text{년}$ 범위에서는 $10 \times 0.3 = 3.00\text{ m}$ ~ $13 \times 0.5 = 6.50\text{ m}$). 즉 2013년 GLO-30에는 존재하지 않았던 $3.0\sim 6.5\text{ m}$의 생장분이 추가로 감산된다.
  2. **2015년 이후 신축 건물 및 벌채지**:
     - 2015년 이후 나지·농경지에 신축된 건물(층수 $N_{\text{floor}} = 3$, 층고 $h_{\text{floor}} = 3.0\text{ m}$ 가정 시 $H_{\text{bldg}} = 3 \times 3.0\text{ m} = 9.0\text{ m}$)을 2013년 GLO-30(당시 나지 표고 $Z_{\text{ground}}$)에서 빼면:
       $$\hat{Z}_{\text{ground}} - Z_{\text{ground}} = 0\text{ m} - 9.0\text{ m} = -9.00\text{ m}$$
       의 건물 형태 함몰지가 생긴다.

#### (3) 오차 성분 3 — 임상도 임분고(`HEIGHT`) 2 m 계급 양자화 및 폴리곤 평균화 오차
- **산술 계산**:
  - 임상도 `HEIGHT`(`HEIGT_CD`)는 `00`, `02`, `04`, ..., `40`의 $2\text{ m}$ 등간격 코드($\Delta H = 2.0\text{ m}$)를 사용한다 ([`research/m2-geodata-licence.md`](research/m2-geodata-licence.md)).
  - 반계급 최대 양자화 오차:
    $$e_{\text{max}} = \pm \frac{\Delta H}{2} = \pm \frac{2.0\text{ m}}{2} = \pm 1.00\text{ m}$$
  - 균등분포 가정 시 양자화 표준편차($\sigma_q$):
    $$\sigma_q = \frac{\Delta H}{\sqrt{12}} = \frac{2.0\text{ m}}{3.4641016} = 0.57735\text{ m} \approx 0.58\text{ m}$$

#### (4) 오차 성분 4 — 급경사 지형의 수평 정합·해상도 평활화 오차 (Slope × Horizontal Offset Error)
- **수식 모형**:
  한국 후보지 위도($35.79^\circ\text{N}\sim 37.60^\circ\text{N}$)에서 WGS84 타원체($a = 6,378,137.0\text{ m}$, $f = 1/298.257223563$) 기준 $1''$ (`GLO-30`) 1픽셀의 실측 크기는 다음과 같다:
  - **C. 진안 ($35.79^\circ\text{N}$)**: $\Delta x = 25.11\text{ m}$ (동서) $\times$ $\Delta y = 30.82\text{ m}$ (남북), 픽셀 면적 $774.0\text{ m}^2$
  - **A. 문경 ($36.76^\circ\text{N}$)**: $\Delta x = 24.80\text{ m}$ (동서) $\times$ $\Delta y = 30.83\text{ m}$ (남북), 픽셀 면적 $764.6\text{ m}^2$
  - **B. 봉평 ($37.60^\circ\text{N}$)**: $\Delta x = 24.53\text{ m}$ (동서) $\times$ $\Delta y = 30.83\text{ m}$ (남북), 픽셀 면적 $756.3\text{ m}^2$
  $30\text{ m}$ 원시 격자를 $10\text{ m}$ 격자로 재표본화하여 $1:5,000$ 벡터 폴리곤과 중첩할 때 반픽셀 수준의 수평 위치 오프셋(또는 레이더 사거리 왜곡 foreshortening/layover) $\Delta x_{\text{err}} = 15.0\text{ m}$가 존재하면, 경사각 $\theta$에서 발생하는 수직 오차 $\Delta z_{\text{slope}}$는 다음과 같다:
  $$\Delta z_{\text{slope}} = \Delta x_{\text{err}} \cdot \tan\theta$$
- **산술 계산 ($\Delta x_{\text{err}} = 15.0\text{ m}$ 기준)**:
  - 완경사 $\theta = 5^\circ$ ($\tan 5^\circ = 0.08749$): $\Delta z_{\text{slope}} = 15.0 \times 0.08749 = 1.31\text{ m}$
  - 중경사 $\theta = 15^\circ$ ($\tan 15^\circ = 0.26795$): $\Delta z_{\text{slope}} = 15.0 \times 0.26795 = 4.02\text{ m}$
  - 급경사 $\theta = 25^\circ$ ($\tan 25^\circ = 0.46631$, 문경·봉평 산악 사면): $\Delta z_{\text{slope}} = 15.0 \times 0.46631 = 6.99\text{ m}$
  - 험준 산악 $\theta = 35^\circ$ ($\tan 35^\circ = 0.70021$, 봉평 계곡 급사면): $\Delta z_{\text{slope}} = 15.0 \times 0.70021 = 10.50\text{ m}$

#### (5) 4대 자체 추정 오차의 종합 산술 요약표

| 오차 성분 (자체 산술 추정) | 산술 공식 | 입력 가정치 | 산출 오차 수치 ($\text{m}$) | 영향 방향 및 공간 특성 |
| :--- | :--- | :--- | :---: | :--- |
| **1. X-band 수관 부분 침투 과대 감산** | $\text{Bias} = -(1-\alpha)H_{\text{tree}}$ | $\alpha = 0.50$, $H_{\text{tree}} = 16\text{ m}$ (`20 m`) | **`-8.00 m`** (`-10.00 m`) | 산림 전체가 나지보다 $6\sim 13\text{ m}$ 낮게 파이는 음(-)의 계통 편향 |
| **2-a. 시기 불일치 (수목 생장분)** | $\Delta H = g \cdot \Delta t$ | $g = 0.3\sim 0.5\text{ m/yr}$, $\Delta t = 11\text{ yr}$ | **`-3.30 m ~ -5.50 m`** | 2013년 이후 자란 수고만큼 추가 과대 감산 |
| **2-b. 시기 불일치 (2015년 이후 신축 건물)** | $\Delta Z = -N_{\text{floor}} \cdot h_{\text{floor}}$ | $3\text{층} \times 3.0\text{ m}$ 신축 건물 | **`-9.00 m`** | 신축 건물 발자국 모양의 인공 구덩이 발생 |
| **3. 임상도 임분고 양자화 오차** | $\sigma_q = \Delta H / \sqrt{12}$ | $\Delta H = 2.0\text{ m}$ (`±1.0 m` 반계급) | **`±1.00 m` ($\sigma_q = 0.58\text{ m}$)** | 임상도 폴리곤 단위 무작위 계단 오차 |
| **4. 급경사 × 반픽셀 수평 오프셋** | $\Delta z = \Delta x_{\text{err}} \tan\theta$ | $\Delta x_{\text{err}} = 15.0\text{ m}$, $\theta = 15^\circ / 25^\circ / 35^\circ$ | **`4.02 m / 6.99 m / 10.50 m`** | 능선·계곡 사면에서 방향에 따라 양·음 교차 오차 |
| **무작위 오차 합산 (RSS, 계통편향 제외)** | $\sigma_{\text{RSS}} = \sqrt{\sigma_{\text{slope}}^2 + \sigma_{\text{growth}}^2 + \sigma_q^2 + \sigma_{\text{GLO30}}^2}$ | $\theta=25^\circ$ ($6.99\text{ m}$), 생장편차 $2.0\text{ m}$, $\sigma_q=0.58\text{ m}$, GLO-30 기본 $2.0\text{ m}$ | **`7.56 m`** ($\sqrt{48.86+4+0.34+4}$) | 계통 편향(`-8.00 m`)을 보정하더라도 급경사 산림에서 남는 잔여 RMSE 규모 |

---

### 4-3. 90 m 공개 DEM으로 10 m 파생 DTM을 검산하는 방법

#### (1) 두 종류의 90 m 공개 자료의 성격 구분 (핵심 전제)
1. **국토지리정보원 90 m 공개 DEM (`국토교통부 국토지리정보원_공개DEM`, [`data.go.kr/data/15059920`](https://www.data.go.kr/data/15059920/fileData.do))**:
   - 「수치표고모형의 구축 및 관리 등에 관한 규정」 제2조·제38조·제48조에 따라 항공레이저측량 필터링(식생·인공지물 제거) 또는 1:5,000 수치지형도 등고선·표고점 보간으로 제작된 **나지 표고(bare-earth DTM)**를 `보안관리규정 [별표 1]`의 공개 기준($90\text{ m}$)에 맞추어 제공하는 자료이다. 따라서 **수관·건물 감산 오차를 검산하는 독립 기준 진리값(reference bare-earth DTM)**으로 사용할 수 있다.
2. **Copernicus GLO-90 (`COP-DEM_GLO-90-DGED`, [`copernicus-dem-90m.s3.amazonaws.com`](https://copernicus-dem-90m.s3.amazonaws.com/readme.html))**:
   - GLO-30과 동일한 TanDEM-X X-band **수치표면모형(DSM)**을 $3''$ ($3\times 3 = 9$픽셀)로 다운샘플링한 표면 모형이다. 따라서 GLO-90은 **좌표 변환·리샘플링 파이프라인 무결성 검산**에만 쓸 수 있고, 수관 침투·건물 감산 오차의 진리값으로는 쓸 수 없다.

#### (2) 국토지리정보원 90 m 공개 DEM을 이용한 4단계 산술 검산 프로토콜

- **1단계 — 평면 좌표계 일치 (Planar Alignment)**:
  - $10\text{ m}$ 파생 DTM ($10.24\text{ km}\times 10.24\text{ km}$, $1,024\times 1,024 = 1,048,576$ 셀)과 국토지리정보원 $90\text{ m}$ 공개 DEM을 동일한 평면직각좌표계(중부원점 `EPSG:5186` 또는 UTM 52N `EPSG:32652`) 격자에 정렬한다.

- **2단계 — $9\times 9$ 블록 평균 (Block Aggregation Arithmetic)**:
  - $90\text{ m}$ 격자 1셀의 면적은 $90\text{ m}\times 90\text{ m} = 8,100\text{ m}^2$로서, $10\text{ m}\times 10\text{ m} = 100\text{ m}^2$ 격자 정확히 **$9\times 9 = 81$개 셀**($81 \times 100\text{ m}^2 = 8,100\text{ m}^2$)의 합과 일치한다.
  - $1,024\times 1,024$ 격자 내부에서 온전한 $9\times 9$ 블록의 개수는 다음과 같다:
    $$N_{\text{block,1D}} = \left\lfloor \frac{1024}{9} \right\rfloor = 113\text{개} \quad (\text{커버 폭 } 113 \times 90\text{ m} = 10,170\text{ m}, \text{ 외곽 잔여 } 1024 - 1017 = 7\text{셀} = 70\text{ m 제외})$$
    $$N_{\text{block,total}} = 113 \times 113 = 12,769\text{개 블록}$$
  - 각 $90\text{ m}$ 블록 $(I, J) \in \{0, \dots, 112\}^2$에서 파생 DTM의 블록 평균 표고 $\bar{Z}_{\text{derived,90}}(I,J)$, 원시 GLO-30의 블록 평균 $\bar{Z}_{\text{GLO30,90}}(I,J)$, 임상도 임분고의 블록 평균 $\bar{H}_{\text{tree,90}}(I,J)$를 각각 산출한다:
    $$\bar{Z}_{\text{derived,90}}(I,J) = \frac{1}{81} \sum_{u=0}^{8} \sum_{v=0}^{8} \hat{Z}_{\text{derived,10}}(9I+u, \; 9J+v)$$

- **3단계 — 수직 기준면 오프셋($\Delta\bar{z}_{\text{datum}}$) 분리 산출**:
  - Copernicus GLO-30의 수직 기준면은 **EGM2008 지오이드(`EPSG:3855`)**인 반면, 국토지리정보원 DEM은 **인천 평균해수면 기준 정표고(국가 지오이드모델 `KNGeoid18`, 고시 제2026-283호 제29조)**를 사용한다.
  - 두 지오이드 모델 간 계통 오프셋 $\Delta\bar{z}_{\text{datum}}$을 수관·건물 오차와 분리하기 위해, 81개 하위 셀 중 **산림 비율 $p_{\text{forest}}(I,J) = 0$, 건물 비율 $p_{\text{bldg}}(I,J) = 0$, 평균 경사 $\bar{\theta}(I,J) < 2^\circ$인 평탄 개활지·농경지 블록 집합 $S_{\text{open}}$**을 추출하여 기준면 오프셋을 먼저 계산한다:
    $$\Delta\bar{z}_{\text{datum}} = \frac{1}{|S_{\text{open}}|} \sum_{(I,J) \in S_{\text{open}}} \left( \bar{Z}_{\text{GLO30,90}}(I,J) - Z_{\text{NGII,90}}(I,J) \right)$$

- **4단계 — 토지피복·경사 층화 잔차 검산 및 유효 수관 감산 계수($\hat{\alpha}$) 역산**:
  - 모든 블록 $(I,J)$에 대해 수직 기준면 보정 잔차(residual) $r(I,J)$를 계산한다:
    $$r(I,J) = \left( \bar{Z}_{\text{derived,90}}(I,J) - Z_{\text{NGII,90}}(I,J) \right) - \Delta\bar{z}_{\text{datum}}$$
  - 블록을 (a) 개활지($p_{\text{forest}}=0, p_{\text{bldg}}=0$), (b) 혼효림($0 < p_{\text{forest}} < 0.8$), (c) 울창 산림($p_{\text{forest}} \ge 0.8$), (d) 시가지($p_{\text{bldg}} \ge 0.1$)의 4개 층(stratum)으로 나누어 각 층 $S_k$별 평균편향($\text{ME}_k$), 절대평균오차($\text{MAE}_k$), 평균제곱근오차($\text{RMSE}_k$)를 산출한다:
    $$\text{ME}_k = \frac{1}{|S_k|}\sum_{(I,J)\in S_k} r(I,J), \quad \text{MAE}_k = \frac{1}{|S_k|}\sum_{(I,J)\in S_k} |r(I,J)|, \quad \text{RMSE}_k = \sqrt{\frac{1}{|S_k|}\sum_{(I,J)\in S_k} r(I,J)^2}$$
  - 만약 울창 산림 구간($S_{\text{forest}}$)에서 단순 전량 감산($\alpha=1$)의 $\text{ME}_{\text{forest}}$가 큰 음수(예: $-5\sim -12\text{ m}$)로 나타나면, $S_{\text{forest}}$에서 다음 비율 추정식(또는 최소제곱 선형회귀)으로 **후보지 맞춤형 유효 수관 감산 계수 $\hat{\alpha}$**를 즉시 도출할 수 있다:
    $$\hat{\alpha} = \frac{\sum_{(I,J)\in S_{\text{forest}}} \left( \bar{Z}_{\text{GLO30,90}}(I,J) - Z_{\text{NGII,90}}(I,J) - \Delta\bar{z}_{\text{datum}} \right)}{\sum_{(I,J)\in S_{\text{forest}}} \bar{H}_{\text{tree,90}}(I,J)}$$
    이를 통해 보정 식 $\hat{Z}_{\text{ground}} = Z_{\text{GLO-30}} - \hat{\alpha} H_{\text{tree}} - H_{\text{bldg}}$로 과대 감산 편향($\text{ME}_{\text{forest}} \to 0$)을 제거할 수 있다.

---

## 5. (라) 후보 3곳(진안, 문경, 봉평)의 90 m 공개 DEM·GLO-30 확보 방법

### 5-1. 후보지 3곳의 지리 범위, 픽셀 수 및 타일·도엽 매핑 총괄표

`#57`에 정의된 후보 3곳(우선순위 **C 진안 > A 문경 > B 봉평**)의 중심 좌표에 대해, WGS84 타원체 곡률반경으로 계산한 $10.24\text{ km}\times 10.24\text{ km}$ (중심 기준 동서·남북 각 $\pm 5.12\text{ km}$) 경위도 범위, Copernicus $1^\circ\times 1^\circ$ 타일 ID, 픽셀 크기·개수, 그리고 국토지리정보원 1:50,000 및 1:5,000 도엽 번호는 다음과 같다.

| 항목 | **후보 C. 전북 진안 (진안읍 고원 분지)** | **후보 A. 경북 문경 (문경읍·조령 일대)** | **후보 B. 강원 평창 봉평 (흥정천 계곡 일대)** |
| :--- | :--- | :--- | :--- |
| **`#57` 우선순위 및 지형 특성** | **1순위 (C)** — 해발 ~300 m 고원 분지, 개활 농경지 위주 ($\text{DSM}\approx\text{DTM}$, 파생 오차 최소) | **2순위 (A)** — 문경읍 분지 + 조령산·주흘산 급사면 혼합 (파생 오차 중간) | **3순위 (B)** — 해발 700~1,300 m 급경사 울창 산림 계곡 (파생 오차 최대) |
| **중심 좌표 (`#57` 기준, $\pm 2\text{ km}$)** | `35.79° N, 127.42° E` (UTM `52S CE`) | `36.76° N, 128.13° E` (UTM `52S DF`) | `37.60° N, 128.37° E` (UTM `52S DG`) |
| **$10.24\text{ km}\times 10.24\text{ km}$ 위도 범위** | `35.7439° N ~ 35.8361° N` (폭 `0.0923°`) | `36.7139° N ~ 36.8061° N` (폭 `0.0923°`) | `37.5539° N ~ 37.6461° N` (폭 `0.0923°`) |
| **$10.24\text{ km}\times 10.24\text{ km}$ 경도 범위** | `127.3634° E ~ 127.4766° E` (폭 `0.1133°`) | `128.0727° E ~ 128.1873° E` (폭 `0.1147°`) | `128.3120° E ~ 128.4280° E` (폭 `0.1160°`) |
| **GLO-30 ($1''$) 1픽셀 크기 (동서 × 남북)** | `25.11 m × 30.82 m` (`774.0 m²`) | `24.80 m × 30.83 m` (`764.6 m²`) | `24.53 m × 30.83 m` (`756.3 m²`) |
| **GLO-30 $10.24\text{ km}$ 영역 내 픽셀 수** | `407.8 × 332.2 px` ($\approx 135,456\text{ px}$) | `412.9 × 332.2 px` ($\approx 137,116\text{ px}$) | `417.5 × 332.1 px` ($\approx 138,444\text{ px}$) |
| **GLO-90 ($3''$) 1픽셀 크기 (동서 × 남북)** | `75.34 m × 92.46 m` (`6,965.7 m²`) | `74.41 m × 92.48 m` (`6,881.2 m²`) | `73.59 m × 92.49 m` (`6,806.3 m²`) |
| **GLO-90 $10.24\text{ km}$ 영역 내 픽셀 수** | `135.9 × 110.7 px` ($\approx 15,096\text{ px}$) | `137.6 × 110.7 px` ($\approx 15,318\text{ px}$) | `139.2 × 110.7 px` ($\approx 15,429\text{ px}$) |
| **Copernicus $1^\circ\times 1^\circ$ 타일 ID** | **`N35_00_E127_00`** (단일 타일 100% 포함) | **`N36_00_E128_00`** (단일 타일 100% 포함; 단 서쪽 $6.5\text{ km}$ 이상 이동 시 `N36_00_E127_00` 인접) | **`N37_00_E128_00`** (단일 타일 100% 포함) |
| **GLO-30 타일 파일 크기 (HTTP HEAD 실측)** | `48,350,062 B` (`46.11 MiB` / `48.35 MB`) | `48,490,284 B` (`46.24 MiB` / `48.49 MB`)<br>*(서접 `E127`: `49,583,060 B` = `47.29 MiB`)* | `45,141,829 B` (`43.05 MiB` / `45.14 MB`) |
| **GLO-90 타일 파일 크기 (HTTP HEAD 실측)** | `5,817,447 B` (`5.55 MiB` / `5.82 MB`) | `5,784,649 B` (`5.52 MiB` / `5.78 MB`) | `5,498,391 B` (`5.24 MiB` / `5.50 MB`) |
| **국토지리정보원 1:50,000 도엽 번호** | **`35702`** (진안, 북부), **`35706`** (임실, 남부 $35.75^\circ\text{N}$ 경계) | **`36801`** (문경, 북부), **`36805`** (점촌, 남부 $36.75^\circ\text{N}$ 경계) | **`37806`** (봉평, $37.50^\circ\sim 37.75^\circ\text{N}$, $128.25^\circ\sim 128.50^\circ\text{E}$ 단일 도엽) |
| **국토지리정보원 1:5,000 도엽 번호 범위** | 중심 `35702087` (`35702065`~`35702100`, `35706005`~`35706010`) | 중심 `36801096` (`36801073`~`36801098`, `36805003`~`36805018`) | 중심 `37806055` (`37806033`~`37806078`) |

---

### 5-2. Copernicus GLO-30 (30 m) 및 GLO-90 (90 m) 확보 방법 (무인증 직링크)

Copernicus DEM은 AWS Open Data Registry의 공개 S3 버킷([`copernicus-dem-30m.s3.amazonaws.com`](https://copernicus-dem-30m.s3.amazonaws.com/readme.html) 및 [`copernicus-dem-90m.s3.amazonaws.com`](https://copernicus-dem-90m.s3.amazonaws.com/readme.html))을 통해 **회원가입·로그인·API 키 없이** HTTP GET 또는 GDAL `/vsicurl/`로 즉시 확보할 수 있다.

#### (1) 후보 3곳의 검증된 S3 직링크 목록 (`HTTP 200 OK` 확인 완료)
- **C. 전북 진안 (`N35_00_E127_00`)**:
  - **GLO-30 (`48,350,062 B`)**:
    [`https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N35_00_E127_00_DEM/Copernicus_DSM_COG_10_N35_00_E127_00_DEM.tif`](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N35_00_E127_00_DEM/Copernicus_DSM_COG_10_N35_00_E127_00_DEM.tif)
  - **GLO-90 (`5,817,447 B`)**:
    [`https://copernicus-dem-90m.s3.amazonaws.com/Copernicus_DSM_COG_30_N35_00_E127_00_DEM/Copernicus_DSM_COG_30_N35_00_E127_00_DEM.tif`](https://copernicus-dem-90m.s3.amazonaws.com/Copernicus_DSM_COG_30_N35_00_E127_00_DEM/Copernicus_DSM_COG_30_N35_00_E127_00_DEM.tif)
- **A. 경북 문경 (`N36_00_E128_00`, 필요 시 서접 `N36_00_E127_00`)**:
  - **GLO-30 (`48,490,284 B`)**:
    [`https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N36_00_E128_00_DEM/Copernicus_DSM_COG_10_N36_00_E128_00_DEM.tif`](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N36_00_E128_00_DEM/Copernicus_DSM_COG_10_N36_00_E128_00_DEM.tif)
  - **GLO-30 서접 타일 (`49,583,060 B`, 중심을 서쪽으로 $>6.5\text{ km}$ 옮겨 $128.00^\circ\text{E}$ 서쪽을 포함할 때만 필요)**:
    [`https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N36_00_E127_00_DEM/Copernicus_DSM_COG_10_N36_00_E127_00_DEM.tif`](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N36_00_E127_00_DEM/Copernicus_DSM_COG_10_N36_00_E127_00_DEM.tif)
  - **GLO-90 (`5,784,649 B`)**:
    [`https://copernicus-dem-90m.s3.amazonaws.com/Copernicus_DSM_COG_30_N36_00_E128_00_DEM/Copernicus_DSM_COG_30_N36_00_E128_00_DEM.tif`](https://copernicus-dem-90m.s3.amazonaws.com/Copernicus_DSM_COG_30_N36_00_E128_00_DEM/Copernicus_DSM_COG_30_N36_00_E128_00_DEM.tif)
- **B. 강원 평창 봉평 (`N37_00_E128_00`)**:
  - **GLO-30 (`45,141,829 B`)**:
    [`https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N37_00_E128_00_DEM/Copernicus_DSM_COG_10_N37_00_E128_00_DEM.tif`](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N37_00_E128_00_DEM/Copernicus_DSM_COG_10_N37_00_E128_00_DEM.tif)
  - **GLO-90 (`5,498,391 B`)**:
    [`https://copernicus-dem-90m.s3.amazonaws.com/Copernicus_DSM_COG_30_N37_00_E128_00_DEM/Copernicus_DSM_COG_30_N37_00_E128_00_DEM.tif`](https://copernicus-dem-90m.s3.amazonaws.com/Copernicus_DSM_COG_30_N37_00_E128_00_DEM/Copernicus_DSM_COG_30_N37_00_E128_00_DEM.tif)

#### (2) 전체 타일 다운로드 없이 $10.24\text{ km}\times 10.24\text{ km}$ 영역만 부분 추출(Windowed Read)하는 방법
위 S3 파일들은 모두 `Cloud Optimized GeoTIFF (COG)` 형식(`TIFF tile size: 1024 × 1024`, `Accept-Ranges: bytes`)으로 저장되어 있으므로, Python `rasterio` 또는 `gdalwarp /vsicurl/...`을 사용하면 $46\text{ MiB}$ 전체 타일을 받지 않고 HTTP Range 요청만으로 각 후보지의 $10.24\text{ km}\times 10.24\text{ km}$ 창(window)만 추출하고 UTM 52N / 중부원점 $10\text{ m}$ 격자($1,024\times 1,024$)로 즉시 재투영할 수 있다. (GEDTM30 `v1.2` 역시 동일한 HTTP Range 방식으로 [`s3.opengeohub.org`](https://s3.opengeohub.org/global/dtm/v1.2/gedtm_rf_m_30m_s_20060101_20151231_go_epsg.4326.3855_v1.2.tif)에서 후보지 3곳 창만 부분 추출 가능하다.)

---

### 5-3. 국토지리정보원 90 m 공개 DEM (및 1:5,000 수치지형도) 확보 방법

1. **공식 입수 경로 ([`https://www.data.go.kr/data/15059920/fileData.do`](https://www.data.go.kr/data/15059920/fileData.do), `국토교통부 국토지리정보원_공개DEM`)**:
   - 공공데이터포털 메타데이터에 기재된 공식 절차 원문:
     > `"포털접속 → 간편지도 검색 선택 → 항목 선택(ex: 인덱스, 영역, 반경 ...) → 영역 지정 및 선택 → 공개DEM 선택 → 항목 선택 (다운로드를 위해서는 로그인이 필요합니다)"`
     > `"국토정보플랫폼 다운로드를 위해서는 대용량 파일전송 S/W가 필요합니다."`
2. **후보지별 검색 지정 방법**:
   - 국토정보플랫폼([`https://map.ngii.go.kr/mn/mainPage.do`](https://map.ngii.go.kr/mn/mainPage.do)) 접속 및 로그인 후 `간편지도 검색`에서 다음 도엽 인덱스 또는 반경/영역을 지정하여 `공개DEM` (및 1:5,000 `수치지형도`)을 선택한다:
     - **C. 전북 진안**: 1:50,000 도엽 `35702`(진안) 및 `35706`(임실) — 또는 중심 좌표 `35.79°N, 127.42°E` 반경 `6 km` 영역 지정
     - **A. 경북 문경**: 1:50,000 도엽 `36801`(문경) 및 `36805`(점촌) — 또는 중심 좌표 `36.76°N, 128.13°E` 반경 `6 km` 영역 지정
     - **B. 강원 평창 봉평**: 1:50,000 도엽 `37806`(봉평) — 또는 중심 좌표 `37.60°N, 128.37°E` 반경 `6 km` 영역 지정

---

## 6. 미확인 항목 (Unconfirmed Items — `fact: null`)

작업 지시서 규칙에 따라, 1차 출처 전수 조사 또는 비로그인 공개 범위 내에서 확인되지 않은 항목(`fact: null`)과 수행한 검색 내역 및 한계를 별도 섹션으로 정리한다 ([`.routing/evidence/research-69-o1.json`](.routing/evidence/research-69-o1.json)의 13번·14번·23번 항목 대응).

| 번호 | 미확인 질문 (`fact: null`) | 수행한 검색 범위 (`source_url`) | 미확인 사유 및 한계 (`limitations`) |
| :---: | :--- | :--- | :--- |
| **1** | **(나) 「국토지리정보원 국가공간정보 보안관리규정」 `[별표 1]` 및 관련 1차 법령이 `'가상 방안좌표(virtual grid references)'`를 사용하는 게임 빌드에 적용되는지에 대한 1차 출처의 명시 여부** | - 국가법령정보센터: [「국토지리정보원 국가공간정보 보안관리규정」 본문](https://www.law.go.kr/LSW/admRulInfoR.do?admRulSeq=2100000240356) 및 [`[별표 1]`](https://www.law.go.kr/LSW/flDownload.do?flSeq=144914683)<br>- [「공간정보의 구축 및 관리 등에 관한 법률」](https://www.law.go.kr/LSW/lsInfoP.do?lsId=011023)<br>- [「수치표고모형의 구축 및 관리 등에 관한 규정」](https://www.law.go.kr/LSW/admRulInfoR.do?admRulSeq=2100000272806)<br>- [「국토지리정보원 공간정보 공급 규정」](https://www.law.go.kr/LSW/admRulInfoR.do?admRulSeq=2100000205917) | 위 1차 법령·행정규칙 전문을 전수 검색하였으나, `'가상 방안좌표'`, `'가상좌표'`, `'국지 상대좌표'`, 또는 `'게임 빌드'`를 다루는 조문이나 정의는 존재하지 않는다. 따라서 실제 측지 원점(`e0, n0`)을 제거하고 가상 방안좌표와 $10\text{ m}$ 표고 배열·$20\text{ m}$ 등고선만 수록한 빌드가 `[별표 1]`의 `"좌표가 없는 일반지역 3차원 영상자료"`(`공개`)에 해당하는지, 아니면 `"해상도가 90m보다 정밀하고 3차원 좌표가 포함된 3차원 공간정보"`(`공개제한`) 또는 `"좌표와 1:5,000 축척 이상 지도의 등고선ㆍ표고값 표시 불가"`에 저촉되는지에 대해 1차 출처는 답을 제공하지 않는다. |
| **2** | **(가) GEDTM30 (`CC BY 4.0` 표기)의 원시 입력 변수로 사용된 제3자 자료(`ALOS AW3D30` 등)의 약관이 GEDTM30 파생 게임 빌드의 배포에 미치는 영향에 대한 발행처 공식 유권해석** | - [Zenodo `18887460`](https://zenodo.org/api/records/18887460)<br>- [Codeberg `openlandmap/GEDTM30` `README.md`](https://codeberg.org/openlandmap/GEDTM30/raw/branch/main/README.md)<br>- [Ho et al. (2025), *PeerJ* 13:e19673 (`PMC12296579`)](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12296579/fullTextXML) | 발행처(OpenGeoHub)가 선행 `EDTM v1`에서 FABDEM의 비상업 라이선스 문제를 이유로 FABDEM을 제거하고 `GEDTM30`을 `CC BY 4.0`으로 공개한 사실은 확인되나, 입력 DSM 중 하나인 JAXA `ALOS AW3D30` 등의 원저작물 약관이 기계학습 앙상블 출력 격자(`GEDTM30`) 및 이를 재표본화한 게임 빌드에 전이되는지 여부에 관한 발행처나 원저작자의 명시적 문서는 확인되지 않았다. |
| **3** | **(라) 국토정보플랫폼(`map.ngii.go.kr`) 로그인 이후 제공되는 국토지리정보원 90 m 공개 DEM의 후보지별 실제 배포 파일명·포맷·바이트 크기 및 무인증 다운로드 URL 존재 여부** | - [공공데이터포털 `15059920` (`국토교통부 국토지리정보원_공개DEM`)](https://www.data.go.kr/data/15059920/fileData.do)<br>- 국토정보플랫폼 공개 메인 페이지 ([`map.ngii.go.kr`](https://map.ngii.go.kr/mn/mainPage.do)) | 공공데이터포털과 국토정보플랫폼 조회 결과, 국토지리정보원 90 m 공개 DEM은 회원 로그인 및 전용 대용량 파일전송 S/W를 필수로 요구하며 무인증 직링크를 제공하지 않는다. 작업 지시서의 하드 룰(회원가입·인증정보·API 키·로그인 우회 금지)을 준수하여 로그인 이후 단계의 내부 파일명과 바이트 크기는 확인하지 않았다. |

---

## 7. 참고 자료 및 저장소 내 관련 문서 색인

- **저장소 내부 문서**:
  - 용어 사전 (가상 방안좌표 정의): [`GLOSSARY.md`](GLOSSARY.md)
  - 선행 지형·공간정보 라이선스 조사 보고서 (`#52`): [`research/m2-geodata-licence.md`](research/m2-geodata-licence.md)
  - 본 보고서의 구조화 JSON 증거 파일: [`.routing/evidence/research-69-o1.json`](.routing/evidence/research-69-o1.json)
- **외부 1차 출처 URL**:
  1. FABDEM V1-2 DataCite Record: [`https://api.datacite.org/dois/10.5523/bris.s5hqmjcdj8yo2ibzi9b4ew3sn`](https://api.datacite.org/dois/10.5523/bris.s5hqmjcdj8yo2ibzi9b4ew3sn)
  2. FABDEM V1-0 DataCite Record: [`https://api.datacite.org/dois/10.5523/bris.25wfy0f9ukoge2gs7a5mqpq2j7`](https://api.datacite.org/dois/10.5523/bris.25wfy0f9ukoge2gs7a5mqpq2j7)
  3. Hawker et al. (2022), *Environ. Res. Lett.* 17, 024016: [`https://api.crossref.org/works/10.1088/1748-9326/ac4d4f`](https://api.crossref.org/works/10.1088/1748-9326/ac4d4f)
  4. FathomDEM v1-0 Eurasia and Africa (Zenodo `14511570`): [`https://zenodo.org/api/records/14511570`](https://zenodo.org/api/records/14511570)
  5. Uhe et al. (2025), *Environ. Res. Lett.* 20, 034008: [`https://api.crossref.org/works/10.1088/1748-9326/ada972`](https://api.crossref.org/works/10.1088/1748-9326/ada972)
  6. GEDTM30 v1.2.0 (Zenodo `18887460`): [`https://zenodo.org/api/records/18887460`](https://zenodo.org/api/records/18887460)
  7. GEDTM30 Codeberg Repository (`openlandmap/GEDTM30`): [`https://codeberg.org/openlandmap/GEDTM30/raw/branch/main/README.md`](https://codeberg.org/openlandmap/GEDTM30/raw/branch/main/README.md)
  8. Ho et al. (2025), *PeerJ* 13:e19673 (`PMC12296579` Full XML): [`https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12296579/fullTextXML`](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12296579/fullTextXML)
  9. DiluviumDEM v1.0 (Zenodo `8384665`): [`https://zenodo.org/api/records/8384665`](https://zenodo.org/api/records/8384665)
  10. DeltaDTM v1.1 / v1.1.1 (4TU.ResearchData `21997565`): [`https://data.4tu.nl/v2/articles/21997565`](https://data.4tu.nl/v2/articles/21997565)
  11. Pronk et al. (2024), *Scientific Data* 11:273: [`https://www.nature.com/articles/s41597-024-03091-9`](https://www.nature.com/articles/s41597-024-03091-9)
  12. Guth & Geoffroy (2021), *Transactions in GIS* 25(5): [`https://api.crossref.org/works/10.1111/tgis.12825`](https://api.crossref.org/works/10.1111/tgis.12825)
  13. 공공데이터포털 — 국토지리정보원 수치지도 (`15015482`): [`https://www.data.go.kr/data/15015482/fileData.do`](https://www.data.go.kr/data/15015482/fileData.do)
  14. 공공데이터포털 — 국토지리정보원 공개DEM (`15059920`): [`https://www.data.go.kr/data/15059920/fileData.do`](https://www.data.go.kr/data/15059920/fileData.do)
  15. 수치표고모형의 구축 및 관리 등에 관한 규정 (국토지리정보원고시 제2026-283호): [`https://www.law.go.kr/LSW/admRulInfoR.do?admRulSeq=2100000272806`](https://www.law.go.kr/LSW/admRulInfoR.do?admRulSeq=2100000272806)
  16. 국토지리정보원 국가공간정보 보안관리규정 (국토지리정보원예규 제199호) 본문 및 `[별표 1]`: [`https://www.law.go.kr/LSW/admRulInfoR.do?admRulSeq=2100000240356`](https://www.law.go.kr/LSW/admRulInfoR.do?admRulSeq=2100000240356), [`https://www.law.go.kr/LSW/flDownload.do?flSeq=144914683`](https://www.law.go.kr/LSW/flDownload.do?flSeq=144914683)
  17. 공간정보의 구축 및 관리 등에 관한 법률 (법률 제20125호): [`https://www.law.go.kr/LSW/lsInfoP.do?lsId=011023`](https://www.law.go.kr/LSW/lsInfoP.do?lsId=011023)
  18. Copernicus DEM AWS S3 (`copernicus-dem-30m` / `copernicus-dem-90m`): [`https://copernicus-dem-30m.s3.amazonaws.com/readme.html`](https://copernicus-dem-30m.s3.amazonaws.com/readme.html), [`https://copernicus-dem-30m.s3.amazonaws.com/tileList.txt`](https://copernicus-dem-30m.s3.amazonaws.com/tileList.txt)
