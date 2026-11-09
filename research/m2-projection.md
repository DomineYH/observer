# 조사 보고서: 실제 좌표 변환 — WGS84·UTM·MGRS와 도북·자북 편차를 빌드 때 계산하는 방법 (Issue #54)

- **작업 지시서**: `research-54-o1` (rev 1) / 정정 지시서 `research-54-o2` (rev 2)
- **대상 이슈**: [#54 조사: 실제 좌표 변환 — WGS84·UTM·MGRS와 도북·자북 편차를 빌드 때 계산하는 방법](https://github.com/DomineYH/observer/issues/54) (상위 지도: [#51](https://github.com/DomineYH/observer/issues/51))
- **기준 커밋**: `acf3651` (`2026-11-09`)

---

## 요약 표

| 조사 항목 | 핵심 결론 | 주요 수치 / 근거 | 출처 |
| :--- | :--- | :--- | :--- |
| **(1) WGS84 → UTM → MGRS 변환 규칙 (한국 51S/52S)** | • **UTM 대**: $120^\circ\text{E}\sim 126^\circ\text{E}$는 **51대**($\lambda_0=123^\circ\text{E}$, EPSG:32651), $126^\circ\text{E}\sim 132^\circ\text{E}$는 **52대**($\lambda_0=129^\circ\text{E}$, EPSG:32652).<br>• **위도대 문자**: $32^\circ\text{N}\sim 40^\circ\text{N}$은 **`S`**(`51S`, `52S`), $40^\circ\text{N}\sim 48^\circ\text{N}$은 **`T`**. <br>• **100 km 방안 문자(AA 체계)**: 열 문자는 $\lfloor E/100\,000\rfloor$과 대 번호 $\bmod\ 3$으로 결정(51대: `S~Z`, 52대: `A~H` 중 한국 육지는 `B, C, D, E`), 행 문자는 $\lfloor N/100\,000\rfloor \bmod 20$으로 결정(홀수 대 `A` 시작, 짝수 대 `F` 시작; 철원·인제 $N\in[4200, 4300)\text{ km}$는 `52S CH`, `52S DH`).<br>• **8자리 방안좌표(10 m 해상도)**: 반올림이 아니라 **버림(truncation)** 규칙($e_4 = \lfloor (E\bmod 100\,000)/10\rfloor$, $n_4 = \lfloor (N\bmod 100\,000)/10\rfloor$). | • 예: 철원 $(38.1467^\circ\text{N}, 127.3133^\circ\text{E}) \to$ UTM `52S` $E=352\,202.62\text{ m}, N=4\,223\,435.85\text{ m} \to$ MGRS **`52S CH 5220 2343`** (호스트 `proj4` 2.22.0 + `mgrs` 2.2.0 교차 확인: `52SCH52202343`) | [`proj4js/mgrs` `mgrs.js`](https://raw.githubusercontent.com/proj4js/mgrs/master/mgrs.js), [npm `proj4`](https://registry.npmjs.org/proj4/latest) |
| **(1) 국지 좌표 원점과 1 km 방안선 일치 여부** | 지형 원천(`TerrainData`)의 방안 기준(`grid.e0`, `grid.n0`)을 **1,000 m(1 km)의 정수 배수**로 두면, 데모(`PRD/OBSERVER_demo_v0.2.html`) 및 M1(`src/sim/grid.ts`, `src/render/map.ts`)의 1 km 방안선($x, y = 0, 1000, \dots, 10000\text{ m}$)과 10 m 격자 칸 경계(`cell = 10`), 그리고 실제 MGRS 1 km 방안선($E, N \equiv 0 \pmod{1000}$)이 **오차 0으로 정확히 일치**한다. | • `toGrid`: $\lfloor(g.e_0 + x)/10\rfloor$<br>• `gridLines(t, 1000)`: $g.e_0$가 $1000$의 배수이면 $x = 0, 1000, \dots, 10000\text{ m}$ | [`src/sim/grid.ts`](src/sim/grid.ts#L7-L14), [`src/render/map.ts`](src/render/map.ts#L47-L58), [`PRD/OBSERVER_demo_v0.2.html`](PRD/OBSERVER_demo_v0.2.html#L1273-L1281) |
| **(2) 10 km 전장 UTM 평면 근사 오차 (밀 환산)** | • **축척 계수 $k$**: 중앙자오선 $0.999600$($-4.00\text{ m}/10\text{ km}$, 측방 환산 $0.41\text{ mil}$) ~ $126^\circ\text{E}$ 대 경계 $1.000455$($+4.55\text{ m}/10\text{ km}$, $0.46\text{ mil}$). 10 km 전장 내부 변화량 $\Delta k \le 64.8\text{ ppm}$($0.65\text{ m}/10\text{ km}$, $0.066\text{ mil}$). 정각 투영이므로 등방성 $k$에 의한 방위각 오차는 **$0\text{ mil}$**.<br>• **자오선 수렴각(도편각) $\gamma$**: 진북 대비 도북의 회전각이 철원 $-1.044^\circ$($\mathbf{-18.56\text{ mil}}$), $126^\circ\text{E}$ 경계 $\pm 1.848^\circ$($\mathbf{\pm 32.85\text{ mil}}$)이므로 **빌드 때 위경도 데이터를 반드시 UTM 도북 격자로 재투영(회전·리샘플)해야 함**.<br>• **측지선 곡률 보정(Arc-to-Chord $|t-T|$)**: UTM 평면 직선과 타원체 최단경로 사이 각도 차이는 10 km 시선에서 최대 $6.69'' = \mathbf{0.033\text{ mil}}$로 1 mil 조준에서 보이지 않음. | • $1\text{ rad} = \frac{3200}{\pi}\text{ mil} \approx 1018.59\text{ mil}$<br>• $1^\circ = \frac{160}{9}\text{ mil} \approx 17.78\text{ mil}$<br>• $|t - T|_{\max} \approx 0.033\text{ mil} \ll 1\text{ mil}$<br>• 전장 10 km 동서 양 끝 사이 $\Delta\gamma_{\text{EW}} \approx 1.25\text{ mil}$ (전장 중심 단일 기준점 사용 시 무관) | [`proj4js/mgrs` `mgrs.js`](https://raw.githubusercontent.com/proj4js/mgrs/master/mgrs.js), [npm `geographiclib-geodesic`](https://registry.npmjs.org/geographiclib-geodesic/latest) |
| **(3) 한국 2026년 도북·자북 편차 및 UI 선택지** | • **진북–자북 편각($D$)**: 2026.0 기준 부산 $-8.43^\circ$($-149.9\text{ mil}$) ~ 대전 $-8.67^\circ$($-154.2\text{ mil}$) ~ 서울 $-8.99^\circ$($-159.8\text{ mil}$) ~ 파주 $-9.06^\circ$($-161.1\text{ mil}$) ~ 철원 $-9.19^\circ$($-163.4\text{ mil}$) ~ 인제 $-9.23^\circ$($-164.2\text{ mil}$). WMM2025와 IGRF-14 차이는 $0.01^\circ$($0.2\text{ mil}$) 이내.<br>• **연변화율($\dot{D}$)**: WMM2025 약 $-2.31'\sim -2.46'/\text{yr}$($-0.69\sim -0.73\text{ mil/yr}$), IGRF-14 약 $-2.04'\sim -2.28'/\text{yr}$($-0.60\sim -0.68\text{ mil/yr}$).<br>• **도자각($\text{G-M} = D - \gamma$)**: 52대 서부·중부 전선(파주·철원·인제)에서 **서편 $7.68^\circ \sim 8.72^\circ$ ($136.6 \sim 155.1\text{ mil}$)**.<br>• **UI 선택지**: (A) `지도 패널` 도편각 도표(GN·TN·MN 삼각 화살표), (B) `작전 준비` 브리핑/기상 줄 텍스트 병기, (C) `관측 화면`/`머리띠` 방위 테이프 자북 보조 눈금·토글, (D) 표시 생략(데이터만 보관). | • 철원(`52S CH`, 2026.0, WMM2025):<br>  - 진북 편각 $D = -9.19^\circ$ ($-163.4\text{ mil}$)<br>  - 도편각 $\gamma = -1.04^\circ$ ($-18.5\text{ mil}$)<br>  - **도자각 $D-\gamma = -8.15^\circ$ ($-144.8\text{ mil}$, 서편 $145\text{ mil}$)** | [WMM-2025 (`wmm-2025.json`)](https://raw.githubusercontent.com/naturalatlas/geomagnetism/master/data/wmm-2025.json), [`geomagnetism` `lib/model.js`](https://raw.githubusercontent.com/naturalatlas/geomagnetism/master/lib/model.js), [IGRF-14 (`igrf14coeffs.txt`)](https://www.ngdc.noaa.gov/IAGA/vmod/coeffs/igrf14coeffs.txt) |
| **(4) 빌드 라이브러리 라이선스 및 결정성 관문** | • `proj4` (`v2.22.0`): **MIT**<br>• `mgrs` (`v2.2.0`): `package.json`은 **MIT**이나 `readme.md`/`openmap.md`에 **BBN OpenMap / Community Mapbuilder(LGPL) 유래** 문구가 공존하여 주의 필요.<br>• `geomagnetism` (`v0.2.0`): **Apache-2.0**<br>• `geographiclib-geodesic` (`v2.2.0`): **MIT**<br>• **결정성 관문(`결정성 관문`, ADR 0005)**: 빌드 때만 실행하여 정적 `TerrainData`로 굽고 런타임(`src/sim/`)에서 호출하지 않으면 `terrainHash(t)`와 골든 기록 재생에 **완전히 무관**함. | • [`docs/adr/0005`](docs/adr/0005-deterministic-math-is-an-fdlibm-port-guarded-by-golden-records.md)<br>• [`docs/adr/0006`](docs/adr/0006-grid-reference-comes-with-terrain-data.md)<br>• [`src/sim/terrain.ts`](src/sim/terrain.ts#L102-L127) | [proj4 LICENSE.md](https://raw.githubusercontent.com/proj4js/proj4js/master/LICENSE.md), [mgrs readme.md](https://raw.githubusercontent.com/proj4js/mgrs/master/readme.md), [geomagnetism LICENSE](https://raw.githubusercontent.com/naturalatlas/geomagnetism/master/LICENSE) |

---

## 정정 내역 (Revision 2 — `research-54-o2`)

1. **§3 지자기 편각($D$) 및 도자각($D-\gamma$) 계산 정정**:
   - **원인**: 1차 제출(`research-54-o1`) 당시 검증 스크립트(`/tmp/research-54/calc_all.py`)의 슈미트 준정규화(Schmidt quasi-normalized) 르장드르 다항식 점화식(`n - 1 != m` 분기)에서 `k2 = sqrt((n+m-1)(n-m-1)/((n-m)(n+m)))` 대신 완전 정규화(fully normalized) 인자인 `sqrt((2n-1)/(2n-3))`가 잘못 곱해져 있었고, WMM2025와 IGRF-14가 동일한 함수를 거치면서 두 모델 모두 편각 절댓값이 약 $0.53^\circ$($9.4\text{ mil}$) 작게 산출되었다.
   - **조치**: 호스트(`observer-host`)가 `geomagnetism` `0.2.0`(WMM2025) 및 독립 IGRF-14 프로그램으로 교차 검증하여 오류를 지적하였으며, `calc_all.py`의 `k2` 수식을 [`geomagnetism/lib/model.js`](https://raw.githubusercontent.com/naturalatlas/geomagnetism/master/lib/model.js)와 동일한 슈미트 준정규화 점화식으로 수정한 뒤 재실행하였다. 수정 후 2026.0 WMM2025 진북 편각($D$)은 철원 $-9.189^\circ$(호스트 기준 $-9.19^\circ$), 서울 $-8.990^\circ$(기준 $-8.99^\circ$), 부산 $-8.435^\circ$(기준 $-8.43^\circ$), 대전 $-8.673^\circ$(기준 $-8.67^\circ$)로 모든 지점에서 호스트 기준값과 **$0.005^\circ$ 이내**로 일치함을 확인하고 요약 표·§3.1 표·본문 범위·철원 예시(`도자각 -8.15° = -144.8 mil`, 반올림 시 `서편 145밀`)·§3.2 선택지 예시 수치를 모두 갱신하였다.
2. **기타 수정 사항**:
   - §4.2에서 [`src/sim/terrain.ts`](src/sim/terrain.ts#L53-L63)의 타입 정의에 맞춰 `surface: Float32Array`, `cover: Uint8Array`로 바로잡았다.
   - 보고서 내 모든 로컬 파일 링크를 `file:///mnt/c/...` 절대 경로에서 저장소 상대 경로로 변경하였다.
   - 직접 다운로드하지 않은 NGA 문서 URL(`earth-info.nga.mil`) 인용을 제거하고 실제 열람한 원천([`proj4js/mgrs/master/mgrs.js`](https://raw.githubusercontent.com/proj4js/mgrs/master/mgrs.js) 등)으로 교체하였으며, §5 한계 절에 NGA PDF 미열람 사실과 호스트의 교차 검증 결과를 명시하였다.

---

## 1. 변환 규칙·수식 (한국 UTM 51S/52S 및 MGRS, 국지 좌표 원점 정렬)

### 1.1 WGS84 위경도 $(\phi, \lambda) \to$ UTM 미터 $(E, N)$

- **타원체 상수 (WGS84)**:
  - 장반경 $a = 6\,378\,137.0\text{ m}$, 편평률 역수 $1/f = 298.257223563$, 제1이심률 제곱 $e^2 = 2f - f^2 \approx 0.00669437999014$, 중앙자오선 축척 계수 $k_0 = 0.9996$.
- **UTM 대(Zone) 번호 및 중앙자오선 $\lambda_0$**:
  $$\text{Zone} = \left\lfloor \frac{\lambda_{\text{deg}} + 180}{6} \right\rfloor + 1, \qquad \lambda_0 = (\text{Zone} - 1)\times 6^\circ - 180^\circ + 3^\circ$$
  - **51대 (Zone 51N, EPSG:32651)**: 경도 $120^\circ\text{E} \le \lambda < 126^\circ\text{E}$, 중앙자오선 $\lambda_0 = 123^\circ\text{E}$ (백령도·연평도·태안 반도 서단 등 서해 도서 및 충남 서해안 일부).
  - **52대 (Zone 52N, EPSG:32652)**: 경도 $126^\circ\text{E} \le \lambda < 132^\circ\text{E}$, 중앙자오선 $\lambda_0 = 129^\circ\text{E}$ (파주·철원·인제·서울·대전·부산 등 한반도 육지 대부분).
- **횡메르카토르(Transverse Mercator) 변환식** (북반구 가짜 동향값 $E_{\text{false}} = 500\,000\text{ m}$, 가짜 북향값 $N_{\text{false}} = 0\text{ m}$):
  - 묘유선 곡률반경 $N_{\nu} = \frac{a}{\sqrt{1 - e^2\sin^2\phi}}$, $T = \tan^2\phi$, $C = \frac{e^2}{1 - e^2}\cos^2\phi$, $A = (\lambda - \lambda_0)\cos\phi$ ($\lambda, \lambda_0$는 라디안), 적도 자오선 호장 $M(\phi)$에 대하여:
    $$E = 500\,000 + k_0 N_{\nu}\left[A + (1 - T + C)\frac{A^3}{6} + (5 - 18T + T^2 + 72C - 58e'^2)\frac{A^5}{120}\right]$$
    $$N = k_0\left[M(\phi) + N_{\nu}\tan\phi\left(\frac{A^2}{2} + (5 - T + 9C + 4C^2)\frac{A^4}{24} + (61 - 58T + T^2 + 600C - 330e'^2)\frac{A^6}{720}\right)\right]$$
  - 출처: [`proj4js/mgrs` `mgrs.js` (`LLtoUTM`)](https://raw.githubusercontent.com/proj4js/mgrs/master/mgrs.js).

### 1.2 UTM 미터 $(E, N) \to$ MGRS 위도대·100 km 방안 문자·8자리 방안좌표

- **위도대 문자 (Latitude Band Letter)**:
  - $80^\circ\text{S}$부터 $72^\circ\text{N}$까지 $8^\circ$ 간격으로 `C`~`X`(영문자 `I`, `O` 제외)를 배정한다.
  - 위도 $32^\circ\text{N} \le \phi < 40^\circ\text{N}$ 구간은 **`S`**이므로 휴전선·남한 전역은 **`51S`** 또는 **`52S`**이다 ($40^\circ\text{N} \le \phi < 48^\circ\text{N}$인 북한 중북부는 `51T`/`52T`).
- **100 km 방안 문자 (100 km Grid Square ID, WGS84 AA 체계)**:
  1. **첫째 글자 (열 문자, Easting 100 km)**:
     - $\text{col} = \lfloor E / 100\,000 \rfloor \in \{1, 2, \dots, 8\}$ ($E = 500\,000\text{ m}$인 중앙자오선 서쪽은 $1\sim 4$, 동쪽은 $5\sim 8$).
     - $\text{Set} = ((\text{Zone} - 1) \bmod 3) + 1$에 따라 3개 대마다 24글자(`A`~`Z`, `I`·`O` 제외)가 순환한다:
       - **51대 ($\text{Set} = 3$)**: 열 $1\sim 8 \to$ `S, T, U, V, W, X, Y, Z` (한국 서해 $E \in [600, 800)\text{ km}$는 **`X`**, **`Y`**).
       - **52대 ($\text{Set} = 1$)**: 열 $1\sim 8 \to$ `A, B, C, D, E, F, G, H` (한국 육지 $E \in [200, 600)\text{ km}$는 **`B`** $[200,300)\text{ km}$, **`C`** $[300,400)\text{ km}$, **`D`** $[400,500)\text{ km}$, **`E`** $[500,600)\text{ km}$).
  2. **둘째 글자 (행 문자, Northing 100 km)**:
     - 20개 문자 배열 $L_{\text{row}} = \text{`ABCDEFGHJKLMNPQRSTUV`}$ (`I`, `O` 제외, $2\,000\text{ km}$ 주기)에서 $r = \lfloor N / 100\,000 \rfloor \bmod 20$을 구한다.
     - **홀수 대(51대)**는 오프셋 $0$ (`A`부터 시작: $L_{\text{row}}[r]$), **짝수 대(52대)**는 오프셋 $+5$ (`F`부터 시작: $L_{\text{row}}[(r + 5) \bmod 20]$)를 적용한다.
     - 따라서 52대 한반도 위도별 행 문자는 다음과 같다:
       - $N \in [3\,800\,000, 3\,900\,000)\text{ m}$ ($34.3^\circ\text{N}\sim 35.2^\circ\text{N}$, 부산·남해안): $r = 18 \to$ **`D`** (예: 부산 `52S ED`)
       - $N \in [3\,900\,000, 4\,000\,000)\text{ m}$ ($35.2^\circ\text{N}\sim 36.1^\circ\text{N}$, 대구·울산): $r = 19 \to$ **`E`**
       - $N \in [4\,000\,000, 4\,100\,000)\text{ m}$ ($36.1^\circ\text{N}\sim 37.0^\circ\text{N}$, 대전·충청): $r = 0 \to$ **`F`** (예: 대전 `52S CF`)
       - $N \in [4\,100\,000, 4\,200\,000)\text{ m}$ ($37.0^\circ\text{N}\sim 37.95^\circ\text{N}$, 서울·파주): $r = 1 \to$ **`G`** (예: 서울·파주 `52S CG`)
       - $N \in [4\,200\,000, 4\,300\,000)\text{ m}$ ($37.95^\circ\text{N}\sim 38.85^\circ\text{N}$, 철원·연천·화천·인제·고성): $r = 2 \to$ **`H`** (예: 철원 **`52S CH`**, 인제·고성 **`52S DH`**)
- **8자리 방안좌표 (10 m 해상도)**:
  - [`proj4js/mgrs` (`mgrs.js` L207-L234)](https://raw.githubusercontent.com/proj4js/mgrs/master/mgrs.js)은 좌표를 반올림하지 않고 **버림(truncation, `Math.floor`)**하여 해당 격자 칸의 남서쪽(좌하단) 모서리를 가리킨다:
    $$e_4 = \left\lfloor \frac{E \bmod 100\,000}{10} \right\rfloor \in [0000, 9999], \qquad n_4 = \left\lfloor \frac{N \bmod 100\,000}{10} \right\rfloor \in [0000, 9999]$$
  - 예: 철원 $(38.1467^\circ\text{N}, 127.3133^\circ\text{E}) \to$ UTM 52S $E = 352\,202.62\text{ m}, N = 4\,223\,435.85\text{ m}$:
    - 100 km 방안 문자: 열 $\lfloor 352\,202.62 / 100\,000 \rfloor = 3 \to \text{`C`}$, 행 $\lfloor 4\,223\,435.85 / 100\,000 \rfloor = 42 \equiv 2 \pmod{20} \to \text{`H`}$ (`52S CH`)
    - 8자리 좌표: $e_4 = \lfloor 52\,202.62 / 10 \rfloor = \text{`5220`}$, $n_4 = \lfloor 23\,435.85 / 10 \rfloor = \text{`2343`}$ $\to$ **`52S CH 5220 2343`** (호스트가 `proj4` 2.22.0 + `mgrs` 2.2.0으로 교차 검증하여 `52SCH52202343` 일치 확인).

### 1.3 국지 좌표 원점(`e0`, `n0`)을 1 km 배수에 둘 때 데모·M1의 1 km 방안선과 실제 MGRS 선의 일치 여부

- **확인 결과: 정확히 일치한다.**
- **코드 대조 근거**:
  1. **데모([`PRD/OBSERVER_demo_v0.2.html` L319-L333, L1273-L1281](PRD/OBSERVER_demo_v0.2.html#L1273-L1281))**:
     - `E0 = 40000`, `N0 = 30000` (100 km 방안 내 미터 오프셋, 모두 $1\,000\text{ m}$의 배수)으로 두고, `for (let m = 0; m <= WORLD; m += 1000)` 루프로 국지 좌표 $x, y = 0, 1000, 2000, \dots, 10000\text{ m}$ 위치에 1 km 방안선을 그으며 `40 + m/1000`, `30 + m/1000` 번호를 붙인다.
  2. **M1 시뮬레이션 및 렌더러([`src/sim/grid.ts` L7-L14](src/sim/grid.ts#L7-L14), [`src/render/map.ts` L47-L58](src/render/map.ts#L47-L58))**:
     - [`toGrid(x, y, g)`](src/sim/grid.ts#L7-L9)는 $e = \lfloor(g.e_0 + x)/10\rfloor$, $n = \lfloor(g.n_0 + y)/10\rfloor$으로 MGRS 버림 규칙과 완전히 동일한 수식을 쓴다.
     - [`gridLines(t, 1000)`](src/render/map.ts#L47-L58)는 `eStart = Math.ceil(g.e0 / 1000) * 1000`부터 `1000`씩 증가하며 국지 좌표 `pos: e - g.e0` 위치에 선을 그린다.
     - 따라서 빌드 때 `TerrainData.grid`의 `e0 = (E_origin mod 100000)`과 `n0 = (N_origin mod 100000)`을 **`1000`의 정수 배수**(예: $E_{\text{origin}} = 350\,000\text{ m} \implies e_0 = 50\,000$, $N_{\text{origin}} = 4\,220\,000\text{ m} \implies n_0 = 20\,000$)로 잡으면:
       - 실제 MGRS 1 km 방안선($E \equiv 0 \pmod{1000}$, $N \equiv 0 \pmod{1000}$)이 정확히 국지 좌표 $x, y = 0, 1000, 2000, \dots, 10000\text{ m}$에 놓인다.
       - 동시에 지형 격자 해상도 `cell = 10` m의 칸 경계($10\text{ m}$ 배수)와도 정확히 맞물린다.
  3. **주의할 제약 1가지 (100 km 경계 회피)**:
     - 현행 [`GridRef`](src/sim/terrain.ts#L16-L20) 구조체(`{ letters: string; e0: number; n0: number }`)는 전장 하나당 `letters`(예: `'CH'`) 1개만 들고 있고 [`gridLines`](src/render/map.ts#L51)는 `label: Math.floor(e / 1000)`으로 두 자리 번호를 만든다. 전장 폭이 $W = 1024 \times 10\text{ m} = 10\,240\text{ m}$이므로, 100 km 방안 문자가 중간에 바뀌지 않게 하려면 $e_0, n_0 \in \{0, 1000, 2000, \dots, 89\,000\}\text{ m}$ ($e_0 + 10\,240 \le 100\,000$) 범위에서 1 km 배수를 고르면 된다.

---

## 2. 오차 크기 표 및 밀(mil) 환산 산술 (10 km 정사각 전장의 UTM 평면 근사)

포병 밀(NATO mil) 환산 기준은 다음과 같다:
$$1\text{ 원주} = 360^\circ = 2\pi\text{ rad} = 6400\text{ mil} \implies 1^\circ = \frac{160}{9}\text{ mil} \approx 17.7778\text{ mil}, \quad 1\text{ rad} = \frac{3200}{\pi}\text{ mil} \approx 1018.5916\text{ mil}$$
따라서 거리 상대 오차 또는 작은 라디안 각도 $\delta\text{ (rad)}$를 밀 단위로 환산하면 $\delta_{\text{mil}} = \delta \times 1018.5916\text{ mil}$이다 ($100\text{ ppm} = 10^{-4}\text{ rad} \approx 0.1019\text{ mil}$).

### 2.1 오차 산출 수식과 단계별 산술 ($\phi = 38.0^\circ\text{N} \sim 38.15^\circ\text{N}$, 전장 폭 $\Delta L = 10\text{ km}$)

위도 $\phi = 38.0^\circ\text{N}$에서 타원체 자오선 곡률반경 $M = \frac{a(1-e^2)}{(1-e^2\sin^2\phi)^{3/2}} = 6\,359\,629.5\text{ m}$, 묘유선 곡률반경 $N_{\nu} = \frac{a}{\sqrt{1-e^2\sin^2\phi}} = 6\,386\,244.7\text{ m}$, 가우스 평균 곡률반경 $R = \sqrt{M N_{\nu}} = 6\,372\,923.2\text{ m}$ ($R^2 = 4.061415 \times 10^{13}\text{ m}^2$)이다. 중앙자오선으로부터의 동향 편차는 $x' = E - 500\,000\text{ m}$이다.

1. **점 축척 계수 (Point Scale Factor $k$)**:
   $$k \approx k_0\left(1 + \frac{x'^2}{2 R^2}\right), \qquad k_0 = 0.9996$$
   - **Case A (52대 중앙자오선, $129.0^\circ\text{E}$, $x' = 0\text{ m}$)**:
     - $k = 0.9996000 \implies k - 1 = -400.0\text{ ppm}$ ($10\text{ km}$당 $-4.00\text{ m}$).
     - 이를 측방 각도 상당치로 환산하면 $|-4.00\text{ m} / 10\,000\text{ m}| \times 1018.59\text{ mil/rad} = \mathbf{0.407\text{ mil}}$.
   - **Case B (철원 중부전선 `52S CH`, $38.15^\circ\text{N}, 127.31^\circ\text{E}$, $E \approx 351\,920\text{ m} \implies x' = -148\,080\text{ m}$)**:
     - $\frac{x'^2}{2R^2} = \frac{(-148\,080)^2}{2 \times 4.06155 \times 10^{13}} = \frac{2.19277 \times 10^{10}}{8.12311 \times 10^{13}} = +0.00026994$ ($+269.9\text{ ppm}$).
     - $k = 0.9996 \times 1.00026994 = 0.9998701 \implies k - 1 = -129.9\text{ ppm}$ ($10\text{ km}$당 **$-1.30\text{ m}$**, 상당 각도 **$\mathbf{0.132\text{ mil}}$**).
   - **Case C (52대 서단 경계, $38.0^\circ\text{N}, 126.0^\circ\text{E}$, $E \approx 236\,587\text{ m} \implies x' = -263\,413\text{ m}$)**:
     - $\frac{x'^2}{2R^2} = \frac{(-263\,413)^2}{8.12283 \times 10^{13}} = +0.00085419$ ($+854.2\text{ ppm}$).
     - $k = 0.9996 \times 1.0008545 = 1.0004547 \implies k - 1 = +454.7\text{ ppm}$ ($10\text{ km}$당 **$+4.55\text{ m}$**, 상당 각도 **$\mathbf{0.463\text{ mil}}$**).
   - **10 km 전장 내부에서의 축척 변화량 ($\Delta k$)**:
     $$\Delta k \approx k_0 \frac{|x'| \cdot \Delta x}{R^2} \quad (\Delta x = 10\,000\text{ m})$$
     - 철원($|x'| = 148.1\text{ km}$): $\Delta k = 0.9996 \times \frac{1.4808 \times 10^5 \times 10^4}{4.06155 \times 10^{13}} = 36.4\text{ ppm}$ ($10\text{ km}$당 $0.364\text{ m}$, 각도 환산 **$\mathbf{0.037\text{ mil}}$**).
     - $126^\circ\text{E}$ 경계($|x'| = 263.4\text{ km}$): $\Delta k = 64.8\text{ ppm}$ ($10\text{ km}$당 $0.648\text{ m}$, 각도 환산 **$\mathbf{0.066\text{ mil}}$**).
   - **방위각에 미치는 영향**: UTM은 **정각 투영(conformal projection)**이므로 한 점에서의 축척 계수 $k$는 모든 방향에 대해 동일(등방성)하다. 따라서 균일한 $k$에 의한 방위각 왜곡은 정확히 **$0\text{ mil}$**이다.

2. **자오선 수렴각 / 도편각 (Grid Convergence $\gamma$, 진북 대비 도북의 각도)**:
   $$\gamma \approx (\lambda - \lambda_0)\sin\phi + \frac{(\lambda - \lambda_0)^3}{3}\sin\phi\cos^2\phi(1 + 3\eta^2)$$
   - **Case A (중앙자오선 $129.0^\circ\text{E}$)**: $\gamma = 0^\circ = \mathbf{0.00\text{ mil}}$.
   - **Case B (철원 $38.15^\circ\text{N}, 127.31^\circ\text{E}$, $\Delta\lambda = -1.69^\circ$)**:
     - $\gamma = -1.69^\circ \times \sin(38.15^\circ) = -1.69^\circ \times 0.61772 = -1.0441^\circ = -1.0441 \times \frac{160}{9}\text{ mil} = \mathbf{-18.56\text{ mil}}$.
   - **Case C ($126.0^\circ\text{E}$ 대 경계, $\Delta\lambda = -3.00^\circ$)**:
     - $\gamma = -3.00^\circ \times \sin(38.0^\circ) = -1.8480^\circ = -1.8480 \times 17.7778\text{ mil} = \mathbf{-32.85\text{ mil}}$ (51대 동단에서는 $+1.8480^\circ = \mathbf{+32.85\text{ mil}}$).
   - **전장 10 km 내부에서의 수렴각 변화량 ($\Delta\gamma_{\text{EW}}$, $\Delta\gamma_{\text{NS}}$)**:
     - 동서 $10\text{ km}$ 이동 시: $\Delta\gamma_{\text{EW}} \approx \frac{\Delta E}{N_{\nu}}\tan\phi = \frac{10\,000}{6\,386\,245} \times \tan(38.0^\circ) = 0.0012233\text{ rad} = 0.07009^\circ (4.21') = \mathbf{1.246\text{ mil}}$.
     - 남북 $10\text{ km}$ 이동 시: $\Delta\gamma_{\text{NS}} \approx |\Delta\lambda|\cos\phi \cdot \frac{\Delta N}{M} \le 0.00372^\circ = \mathbf{0.066\text{ mil}}$.

3. **측지선 곡률 보정 / 곡선-현 보정각 (Arc-to-Chord Correction $t - T$)**:
   - 타원체 위의 최단 경로(측지선/빛·레이저·탄도의 대원 궤적)를 UTM 평면에 투영하면 미소하게 휜 곡선이 되며, 그 접선 방위각 $t$와 UTM 평면 직선(현, chord) 방위각 $T$ 사이의 차이는 가우스-크뤼거 등각 투영 미분 기하에 따라 다음과 같다:
     $$|t - T| \approx \frac{(N_2 - N_1)(2x'_1 + x'_2)}{6 R^2} \approx \frac{|x'| \cdot \Delta N}{2 R^2}\text{ (rad)}$$
   - 남북으로 $\Delta N = 10\,000\text{ m}$ 떨어진 목표를 조준할 때:
     - **Case B (철원, $|x'| = 148.1\text{ km}$)**:
       $$|t - T| = \frac{1.4808 \times 10^5 \times 10^4}{2 \times 4.06155 \times 10^{13}} = 1.823 \times 10^{-5}\text{ rad} = 3.76'' = 0.00104^\circ = \mathbf{0.0186\text{ mil}}$$
     - **Case C ($126^\circ\text{E}$ 대 경계, $|x'| = 263.4\text{ km}$)**:
       $$|t - T| = \frac{2.6341 \times 10^5 \times 10^4}{2 \times 4.06142 \times 10^{13}} = 3.243 \times 10^{-5}\text{ rad} = 6.69'' = 0.00186^\circ = \mathbf{0.0330\text{ mil}}$$
   - 즉, 10 km 전장 안에서 UTM 직선 방위각과 실제 타원체 측지선 방위각의 차이는 **최대 $0.033\text{ mil}$**로, 1 mil 단위 조준기에서는 30분의 1 눈금 미만이어서 전혀 보이지 않는다.

### 2.2 오차 크기 종합 비교 표

| 오차 항목 | 수식 | 중앙자오선 ($129^\circ\text{E}$) | 중부전선 철원 ($127.31^\circ\text{E}$) | 대 경계 ($126.0^\circ\text{E}$) | 1 mil 조준 가시성 및 빌드 시 조치 |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **점 축척 계수 편차 ($k - 1$)** | $k_0(1 + \frac{x'^2}{2R^2}) - 1$ | $-400.0\text{ ppm}$<br>($-4.00\text{ m}/10\text{ km}$)<br>상당 각도 $0.41\text{ mil}$ | $-129.9\text{ ppm}$<br>($-1.30\text{ m}/10\text{ km}$)<br>상당 각도 $0.13\text{ mil}$ | $+454.7\text{ ppm}$<br>($+4.55\text{ m}/10\text{ km}$)<br>상당 각도 $0.46\text{ mil}$ | **보이지 않음 ($0\text{ mil}$)**. 정각 투영이므로 방위각 왜곡이 $0$이며, 관측·탄도·포대가 모두 같은 UTM 격자 미터를 쓰므로 내부 오차 $0$. |
| **10 km 전장 내 축척 변화 ($\Delta k$)** | $k_0\frac{|x'|\Delta x}{R^2}$ | $0.0\text{ ppm}$<br>($0.00\text{ m}$, $0.000\text{ mil}$) | $36.4\text{ ppm}$<br>($0.36\text{ m}$, $0.037\text{ mil}$) | $64.8\text{ ppm}$<br>($0.65\text{ m}$, $0.066\text{ mil}$) | **보이지 않음 ($\le 0.066\text{ mil}$)**. 10 m 격자 해상도의 $1/15$ 미만. |
| **측지선 곡률 보정 ($|t - T|$, 10 km)** | $\frac{|x'|\Delta N}{2R^2}$ | $0.00''$<br>($\mathbf{0.000\text{ mil}}$) | $3.76''$<br>($\mathbf{0.019\text{ mil}}$) | $6.69''$<br>($\mathbf{0.033\text{ mil}}$) | **보이지 않음 ($\le 0.033\text{ mil}$)**. 평면 직선 시선(LOS)을 그대로 써도 무방함. |
| **자오선 수렴각 ($\gamma$, 진북 vs 도북)** | $(\lambda - \lambda_0)\sin\phi$ | $0.000^\circ$<br>($\mathbf{0.00\text{ mil}}$) | $-1.044^\circ$<br>($\mathbf{-18.56\text{ mil}}$) | $\pm 1.848^\circ$<br>($\mathbf{\pm 32.85\text{ mil}}$) | **매우 큼 ($18 \sim 33\text{ mil}$)**. 빌드 때 위경도 DEM/벡터를 **반드시 UTM 도북 격자로 재투영(회전·리샘플)**해야 함. |
| **전장 동서 10 km 간 $\gamma$ 차이 ($\Delta\gamma_{\text{EW}}$)** | $\frac{\Delta E}{N_{\nu}}\tan\phi$ | $0.070^\circ$<br>($\mathbf{1.25\text{ mil}}$) | $0.070^\circ$<br>($\mathbf{1.25\text{ mil}}$) | $0.070^\circ$<br>($\mathbf{1.25\text{ mil}}$) | 도북 기준 시뮬레이션 내부에서는 **$0\text{ mil}$**(모든 도북 자오선은 평행). 단, 도편각/도자각 안내 수치는 전장 중심($x=5120, y=5120$)에서 1회 계산할 때 양 끝단과 $\pm 0.62\text{ mil}$ 차이. |

---

## 3. 한국 2026년 도북·자북 편차 및 자북 표기 선택지 비교

### 3.1 WMM2025 및 IGRF-14 기준 한국 2026년 편각·도편각·도자각·연변화율

- **용어 및 부호 정의**:
  - **진북–자북 편각 (Magnetic Declination, $D$)**: 진북(True North)에서 자북(Magnetic North)까지의 각도(동편 $+$, 서편 $-$). 한국은 전 지역이 서편각($D < 0$)이다.
  - **자오선 수렴각 / 도편각 (Grid Convergence, $\gamma$)**: 진북에서 도북(Grid North)까지의 각도(동편 $+$, 서편 $-$).
  - **도북–자북 편차 / 도자각 (Grid–Magnetic Angle, $\text{G-M}$)**: 도북에서 자북까지의 각도:
    $$\text{도자각 (G-M)} = D - \gamma \quad (\text{서편을 양수로 읽는 군사 도표 관례에서는 } |D - \gamma|\text{ 서편})$$
- **계산 원천**:
  - **WMM2025**: 미국 NGA/NOAA NCEI 및 영국 BGS가 2024-12-17 발표한 `WMM-2025` 구면조화 계수([`naturalatlas/geomagnetism` `data/wmm-2025.json`](https://raw.githubusercontent.com/naturalatlas/geomagnetism/master/data/wmm-2025.json), epoch `2025.0`, $n=12$) 및 [`geomagnetism/lib/model.js`](https://raw.githubusercontent.com/naturalatlas/geomagnetism/master/lib/model.js)의 슈미트 준정규화 알고리즘.
  - **IGRF-14**: 국제지자기학회(IAGA)가 2024-11 발표한 제14세대 국제표준지자기장 계수([NOAA `igrf14coeffs.txt`](https://www.ngdc.noaa.gov/IAGA/vmod/coeffs/igrf14coeffs.txt), epoch `2025.0` 및 `2025–2030` SV, $n=13$).

| 지역 (MGRS 100 km) | 위경도 $(\phi, \lambda)$ | 도편각 $\gamma$ (진북→도북) | 2026.0 진북 편각 $D$ (WMM2025 / IGRF-14) | 2026.0 **도자각 $D - \gamma$ (도북→자북, WMM2025 / IGRF-14)** | 연변화율 $\dot{D}$ (WMM2025 / IGRF-14) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **철원** (`52S CH`) | $38.15^\circ\text{N}, 127.31^\circ\text{E}$ | $-1.04^\circ$ ($-18.5\text{ mil}$) | $-9.19^\circ$ ($-163.4\text{ mil}$) / $-9.18^\circ$ ($-163.2\text{ mil}$) | **$-8.15^\circ$ ($\mathbf{-144.8\text{ mil}}$, 서편 $145\text{ mil}$)** / $-8.14^\circ$ ($-144.6\text{ mil}$) | $-2.32'/\text{yr}$ ($-0.69\text{ mil/yr}$) / $-2.10'/\text{yr}$ ($-0.62\text{ mil/yr}$) |
| **인제** (`52S DH`) | $38.07^\circ\text{N}, 128.17^\circ\text{E}$ | $-0.51^\circ$ ($-9.1\text{ mil}$) | $-9.23^\circ$ ($-164.2\text{ mil}$) / $-9.22^\circ$ ($-164.0\text{ mil}$) | **$-8.72^\circ$ ($\mathbf{-155.1\text{ mil}}$, 서편 $155\text{ mil}$)** / $-8.71^\circ$ ($-154.9\text{ mil}$) | $-2.31'/\text{yr}$ ($-0.69\text{ mil/yr}$) / $-2.12'/\text{yr}$ ($-0.63\text{ mil/yr}$) |
| **파주** (`52S CG`) | $37.90^\circ\text{N}, 126.75^\circ\text{E}$ | $-1.38^\circ$ ($-24.6\text{ mil}$) | $-9.06^\circ$ ($-161.1\text{ mil}$) / $-9.05^\circ$ ($-161.0\text{ mil}$) | **$-7.68^\circ$ ($\mathbf{-136.6\text{ mil}}$, 서편 $137\text{ mil}$)** / $-7.67^\circ$ ($-136.4\text{ mil}$) | $-2.34'/\text{yr}$ ($-0.69\text{ mil/yr}$) / $-2.10'/\text{yr}$ ($-0.62\text{ mil/yr}$) |
| **서울** (`52S CG`) | $37.57^\circ\text{N}, 126.98^\circ\text{E}$ | $-1.23^\circ$ ($-21.9\text{ mil}$) | $-8.99^\circ$ ($-159.8\text{ mil}$) / $-8.98^\circ$ ($-159.6\text{ mil}$) | **$-7.76^\circ$ ($\mathbf{-137.9\text{ mil}}$, 서편 $138\text{ mil}$)** / $-7.75^\circ$ ($-137.7\text{ mil}$) | $-2.35'/\text{yr}$ ($-0.70\text{ mil/yr}$) / $-2.11'/\text{yr}$ ($-0.63\text{ mil/yr}$) |
| **대전** (`52S CF`) | $36.35^\circ\text{N}, 127.38^\circ\text{E}$ | $-0.96^\circ$ ($-17.0\text{ mil}$) | $-8.67^\circ$ ($-154.2\text{ mil}$) / $-8.66^\circ$ ($-154.0\text{ mil}$) | **$-7.72^\circ$ ($\mathbf{-137.2\text{ mil}}$, 서편 $137\text{ mil}$)** / $-7.71^\circ$ ($-137.0\text{ mil}$) | $-2.40'/\text{yr}$ ($-0.71\text{ mil/yr}$) / $-2.17'/\text{yr}$ ($-0.64\text{ mil/yr}$) |
| **부산** (`52S ED`) | $35.18^\circ\text{N}, 129.08^\circ\text{E}$ | $+0.04^\circ$ ($+0.8\text{ mil}$) | $-8.43^\circ$ ($-149.9\text{ mil}$) / $-8.42^\circ$ ($-149.8\text{ mil}$) | **$-8.48^\circ$ ($\mathbf{-150.7\text{ mil}}$, 서편 $151\text{ mil}$)** / $-8.47^\circ$ ($-150.5\text{ mil}$) | $-2.46'/\text{yr}$ ($-0.73\text{ mil/yr}$) / $-2.28'/\text{yr}$ ($-0.68\text{ mil/yr}$) |
| **백령도** (`51S XC`) | $37.97^\circ\text{N}, 124.67^\circ\text{E}$ | $+1.03^\circ$ ($+18.2\text{ mil}$) | $-8.83^\circ$ ($-157.0\text{ mil}$) / $-8.82^\circ$ ($-156.9\text{ mil}$) | **$-9.86^\circ$ ($\mathbf{-175.3\text{ mil}}$, 서편 $175\text{ mil}$)** / $-9.85^\circ$ ($-175.1\text{ mil}$) | $-2.34'/\text{yr}$ ($-0.69\text{ mil/yr}$) / $-2.04'/\text{yr}$ ($-0.60\text{ mil/yr}$) |
| **태안** (`51S YA`) | $36.75^\circ\text{N}, 125.95^\circ\text{E}$ | $+1.77^\circ$ ($+31.4\text{ mil}$) | $-8.65^\circ$ ($-153.8\text{ mil}$) / $-8.64^\circ$ ($-153.6\text{ mil}$) | **$-10.42^\circ$ ($\mathbf{-185.2\text{ mil}}$, 서편 $185\text{ mil}$)** / $-10.41^\circ$ ($-185.0\text{ mil}$) | $-2.38'/\text{yr}$ ($-0.70\text{ mil/yr}$) / $-2.11'/\text{yr}$ ($-0.62\text{ mil/yr}$) |

> **핵심 요약**:
> 1. 2026년 한국 전선의 **진북–자북 편각($D$)**은 약 **$-9.06^\circ \sim -9.23^\circ$ ($-161 \sim -164\text{ mil}$)**이지만, 52대 중·서부 전선에서는 도북 자체가 진북보다 서쪽으로 $9 \sim 25\text{ mil}$ 기울어($\gamma < 0$) 있으므로, **도북 대비 자북의 편차인 도자각($D - \gamma$)**은 **서편 $7.68^\circ \sim 8.72^\circ$ ($136.6 \sim 155.1\text{ mil}$)**(철원 `52S CH` 기준 **$-8.15^\circ = -144.8\text{ mil}$, 약 서편 $145\text{ mil}$**)이다.
> 2. **연변화율($\dot{D}$)**은 매년 서쪽으로 약 **$2.0'\sim 2.5'$ ($0.60 \sim 0.73\text{ mil/yr}$)**씩 커진다. 즉 1년 동안의 변화량이 $1\text{ mil}$ 미만($\approx 0.7\text{ mil}$)이므로, 빌드 때 기준 연도(예: `2026.0`)로 한 번 계산해 `TerrainData`에 상수로 넣어 두어도 수년간 1 mil 단위 오차 안에 머문다.

### 3.2 자북(Magnetic North) 표기 선택지 비교 (데모·M1 도북 기준 유지 전제)

데모([`PRD/OBSERVER_demo_v0.2.html` L315-L343](PRD/OBSERVER_demo_v0.2.html#L315-L343))와 M1([`src/sim/index.ts` L41-L45](src/sim/index.ts#L41-L45), [`src/ui/MapPanel.tsx`](src/ui/MapPanel.tsx), [`src/ui/ObservationView.tsx`](src/ui/ObservationView.tsx), [`src/ui/PrepPanel.tsx`](src/ui/PrepPanel.tsx))은 모든 방위각(`az`, `laserAz`, 삼각측량 교차, 포대 사각, 바람 방향)을 **도북(Grid North, $+y = 0\text{ mil}$, $+x = 1600\text{ mil}$)** 기준으로 처리한다. 이 내부 도북 기준을 깨뜨리지 않고 자북 정보를 다루는 **선택지 4가지**는 다음과 같다(특정 선택지를 승자로 고르지 않음).

| 선택지 | 표시 위치 및 방식 | 변경 대상 파일 (예시) | 장점 | 단점 / 고려 사항 |
| :--- | :--- | :--- | :--- | :--- |
| **선택지 A: `지도 패널` 도편각 도표 (Declination Diagram)** | 종이 군용지도(1:50,000) 하단 여백과 동일하게 `지도 패널` 모서리(`좌표자` 근처 또는 좌하단)에 **도북(GN)·진북(TN)·자북(MN) 삼각 화살표 아이콘과 도자각 수치**(예: 철원 기준 `도자각 서편 145밀 (8.1°) · 2026`)를 그린다. | [`src/sim/terrain.ts`](src/sim/terrain.ts#L16-L20) (`GridRef` 선택 필드), [`src/render/map.ts`](src/render/map.ts) 또는 [`src/ui/MapPanel.tsx`](src/ui/MapPanel.tsx) | • 실제 군용 지도의 도자각 표기 관례와 일치.<br>• 관측·사격 조작 절차(도북 기준)를 전혀 바꾸지 않으면서 실제 지형·좌표계 반영 사실을 직관적으로 보여 줌. | • 2D 지도 캔버스나 오버레이 모서리에 소형 범례 영역이 추가됨. |
| **선택지 B: `작전 준비` 화면 브리핑·기상 줄 병기** | [`PrepPanel.tsx`](src/ui/PrepPanel.tsx#L39-L41)의 기상 줄(`바람 08방향 4 m/s · 기온 15°C`) 또는 전장 소개 문구 옆에 **`도자각 서편 145밀 (WMM2025 2026)`**을 텍스트로 함께 표시한다. | [`src/sim/terrain.ts`](src/sim/terrain.ts#L16-L20), [`src/ui/PrepPanel.tsx`](src/ui/PrepPanel.tsx#L39-L41) | • UI 변경이 텍스트 1줄로 가장 작고 기존 화면 배치를 건드리지 않음.<br>• 출격 전 전장 환경 제원(기상·좌표계)을 한곳에서 확인 가능. | • 출격 후(`관측 화면`·`지도 패널`)에는 화면에 보이지 않음. |
| **선택지 C: `관측 화면` 방위 테이프 / `머리띠` 보조 표시 또는 전환** | [`src/render/overlay.ts`](src/render/overlay.ts#L98-L133)의 상단 방위각 테이프나 [`HeadBand.tsx`](src/ui/HeadBand.tsx)에 도북 방위각 옆으로 자북 방위각($\text{az}_{\text{mag}} = (\text{az}_{\text{grid}} - \text{GM} + 6400) \bmod 6400$)을 작게 병기하거나 도북/자북 표시 토글을 둔다. | [`src/sim/terrain.ts`](src/sim/terrain.ts#L16-L20), [`src/render/overlay.ts`](src/render/overlay.ts#L98-L133), [`src/ui/HeadBand.tsx`](src/ui/HeadBand.tsx) | • 휴대용 나침반(자북)과 지도·삼각분도기(도북) 사이의 도자각 환산 훈련까지 확장할 때 활용 가능. | • 플레이어가 자북 눈금을 그대로 `관측소 설정` 삼각측량이나 `수정량` 도북 방위각 칸에 잘못 입력해 $145\text{ mil}$ 오차를 낼 혼동 위험이 있음. |
| **선택지 D: UI 표시 생략 (지형 메타데이터에만 보관)** | 현행 데모·M1과 완전히 동일하게 UI에는 도북만 노출하고, 빌드 때 계산한 $\gamma, D, \text{G-M}$ 값은 `TerrainData.grid` 메타데이터(또는 빌드 매니페스트)에만 기록한다. | [`src/sim/terrain.ts`](src/sim/terrain.ts#L16-L20) (선택 필드만 추가, UI 변경 없음) | • UI 복잡도 증가가 전혀 없고 도북/자북 혼동 가능성이 원천 차단됨. | • 실제 좌표·지자기 변환이 적용되었다는 점이 화면상으로는 드러나지 않음. |

---

## 4. 라이선스·결정성 확인 (빌드 타임 라이브러리)

### 4.1 후보 라이브러리 라이선스 및 특징 (공식 저장소·레지스트리 기준)

| 패키지명 (버전) | 공식 저장소 / 레지스트리 출처 | 선언 라이선스 | 라이선스 상세 및 주의 사항 | 빌드 시 역할 |
| :--- | :--- | :---: | :--- | :--- |
| **`proj4`** (`v2.22.0`) | • [npm `proj4/latest`](https://registry.npmjs.org/proj4/latest)<br>• [`proj4js/proj4js/LICENSE.md`](https://raw.githubusercontent.com/proj4js/proj4js/master/LICENSE.md) | **MIT** | 표준 MIT 라이선스(Mike Adair, Richard Greenwood 등 저작권 고지). 상업·오픈소스 제약 없음. | WGS84 (`EPSG:4326`) $\leftrightarrow$ UTM 51N/52N (`EPSG:32651`, `EPSG:32652`) 고정밀 좌표 변환 (`etmerc`). |
| **`mgrs`** (`v2.2.0`) | • [npm `mgrs/latest`](https://registry.npmjs.org/mgrs/latest)<br>• [`proj4js/mgrs/package.json`](https://raw.githubusercontent.com/proj4js/mgrs/master/package.json)<br>• [`proj4js/mgrs/readme.md`](https://raw.githubusercontent.com/proj4js/mgrs/master/readme.md)<br>• [`proj4js/mgrs/openmap.md`](https://raw.githubusercontent.com/proj4js/mgrs/master/openmap.md) | **MIT** (`package.json`)<br>※ **문서 상충 주의** | `package.json`은 `"license": "MIT"`이나, `readme.md`에 *"port from Orbit traits by Community Mapbuilder (LGPL)"* 및 *"Portions of this software are based on a port of components from the OpenMap com.bbn.openmap.proj.coords Java package"* ([`openmap.md`](https://raw.githubusercontent.com/proj4js/mgrs/master/openmap.md))가 명시되어 있음. 빌드 전용(`devDependencies`)으로만 쓰거나 §1.2의 수식(약 30줄)을 직접 구현하면 번들 라이선스 이슈가 원천 해소됨. | 위경도/UTM $\to$ MGRS 100 km 방안 문자(`CH`, `DH` 등) 및 8자리 방안좌표 산출. |
| **`geomagnetism`** (`v0.2.0`) | • [npm `geomagnetism/latest`](https://registry.npmjs.org/geomagnetism/latest)<br>• [`naturalatlas/geomagnetism/LICENSE`](https://raw.githubusercontent.com/naturalatlas/geomagnetism/master/LICENSE)<br>• [`data/wmm-2025.json`](https://raw.githubusercontent.com/naturalatlas/geomagnetism/master/data/wmm-2025.json) | **Apache-2.0** | 표준 Apache License 2.0 (Copyright 2015 Natural Atlas, Inc.). `v0.2.0`에 최신 **WMM-2025** 계수(`wmm-2025.json`)가 기본 내장되어 있으며 외부 네이티브 의존성이 없음 (`dependencies: {}`). | 특정 날짜(예: `new Date('2026-01-01')`)와 위경도·고도에 대한 지자기 편각(`decl`) 계산. |
| **`geographiclib-geodesic`** (`v2.2.0`) *(선택 대안)* | • [npm `geographiclib-geodesic/latest`](https://registry.npmjs.org/geographiclib-geodesic/latest) | **MIT** | 표준 MIT 라이선스 (Charles Karney). | 타원체 측지선 거리·방위각 및 자오선 수렴각($\gamma$)·축척 계수($k$) 정밀 검증. |

### 4.2 결정성 관문(`결정성 관문`, ADR 0005 & ADR 0006)과의 무관성 확인

- **확인 결과**: 위 라이브러리를 **런타임(`src/sim/`)에서 전혀 부르지 않고 빌드(지형 생성·전처리) 단계에서만 실행**하여 정적 `TerrainData`로 구워 놓으면, **결정성 관문과 100% 무관**하다.
- **아키텍처 및 코드 근거**:
  1. **[ADR 0005 (`결정적 수학은 골든 기록이 지키는 fdlibm 이식이다`)](docs/adr/0005-deterministic-math-is-an-fdlibm-port-guarded-by-golden-records.md)**:
     - 결정성 관문이 막는 대상은 **런타임 시뮬레이션(`src/sim/`)** 내부에서 브라우저/JS 엔진(V8, SpiderMonkey, JavaScriptCore)마다 마지막 비트가 달라질 수 있는 `Math.sin`, `Math.cos`, `Math.atan2` 호출이다.
     - `proj4`, `mgrs`, `geomagnetism`은 내부적으로 표준 `Math.sin`/`Math.cos`/`Math.atan2`를 사용하므로([`mgrs.js` L270-L315](https://raw.githubusercontent.com/proj4js/mgrs/master/mgrs.js), [`geomagnetism/lib/model.js` L86-L87](https://raw.githubusercontent.com/naturalatlas/geomagnetism/master/lib/model.js)), 런타임 `src/sim/` 안에 들어가면 ADR 0005 규칙을 위반하지만, **빌드 스크립트(Node.js 오프라인 파이프라인)**에서만 실행하면 런타임 번들에는 포함조차 되지 않는다.
  2. **[ADR 0006 (`방안 기준은 지형 데이터에 딸려 온다`)](docs/adr/0006-grid-reference-comes-with-terrain-data.md) 및 [`src/sim/terrain.ts` (`terrainHash`)](src/sim/terrain.ts#L102-L127)**:
     - 지형 원천이 빌드 때 만든 `TerrainData` 객체(`ground: Float32Array`, `surface: Float32Array`, `buildings`, `cover: Uint8Array`, `roads`, `villages`, `grid: { letters, e0, n0 }`)는 정적 데이터로 전달된다.
     - 런타임에서 [`terrainHash(t)`](src/sim/terrain.ts#L102-L127)는 이미 구워진 `TerrainData`의 바이트/정수 배열과 `t.grid.letters`, `t.grid.e0`, `t.grid.n0`을 FNV-1a 32비트로 해시하여 골든 기록 머리말에 남긴다.
     - 런타임 좌표 변환 함수인 [`toGrid` / `fromGrid` (`src/sim/grid.ts`)](src/sim/grid.ts#L7-L14)는 사칙연산과 `Math.floor`만 수행하므로 초월함수를 전혀 쓰지 않는다.
  3. **빌드 산출물 자체의 재현성 팁**:
     - 만약 서로 다른 OS/CPU의 빌드 머신에서 지형 빌드 스크립트를 다시 돌릴 때도 동일한 `terrainHash(t)`가 나오게 하려면, 빌드 스크립트가 `Float32Array`(`ground`, `surface`)나 정수로 양자화하기 직전 값을 소수점 고정 자리(예: 고도 $0.01\text{ m}$ 또는 `Math.fround`)로 반올림하거나, 구워진 지형 자산 파일 자체를 저장소/아티팩트로 고정하면 된다.

---

## 5. 미확인 사항 및 한계 (Unconfirmed Items & Limitations)

- **미확인 사항**: 없음 (이슈 #54의 4개 질문 항목 모두 확인 완료).
- **알려진 한계 및 검증 내역**:
  1. **NGA 원문 PDF 미열람 및 교차 검증**: `earth-info.nga.mil`의 NGA.SIG.0012 / NGA.STND.0037 PDF 원문은 직접 다운로드하지 않았으며(검색·코드 주석에서 문서 제목만 확인), 실제 변환 규칙과 상수는 직접 열람한 [`proj4js/mgrs/master/mgrs.js`](https://raw.githubusercontent.com/proj4js/mgrs/master/mgrs.js) 소스 코드와 가우스-크뤼거(횡메르카토르) 표준 수식으로 확인하였다. 또한 호스트(`observer-host`)가 `proj4` `2.22.0` + `mgrs` `2.2.0`을 직접 실행하여 철원 $(38.1467^\circ\text{N}, 127.3133^\circ\text{E}) \to \text{`52SCH52202343`}$ 변환이 일치함을 교차 확인하였다.
  2. **지자기 편각 계산의 호스트 교차 검증 (`research-54-o2`)**: 1차 제출(`o1`) 시 `/tmp/research-54/calc_all.py`의 슈미트 준정규화 르장드르 점화식(`k2`) 오류로 편각이 약 $0.53^\circ$ 작게 계산되었으나, 호스트가 `geomagnetism` `0.2.0`(WMM2025) 및 독립 IGRF-14 프로그램으로 교차 검증하여 발견하였고, `k2` 수정 후 모든 기준점(철원 $-9.19^\circ$, 서울 $-8.99^\circ$, 부산 $-8.43^\circ$, 대전 $-8.67^\circ$)에서 $0.005^\circ$ 이내로 일치함을 확인하였다.
  3. **`mgrs` 패키지의 라이선스 문서 불일치**: npm 레지스트리와 `package.json`에는 `MIT`로 등록되어 있으나, 저장소 `readme.md`와 `openmap.md`에는 BBN OpenMap 및 Community Mapbuilder(LGPL) 유래 고지가 남아 있다. 런타임 번들에 포함하지 않고 빌드 전용으로만 쓰거나, §1.2의 MGRS 변환 규칙(51S/52S 한반도 영역에서는 30줄 내외의 정수 나눗셈·문자열 인덱싱)을 직접 작성하면 법적·기술적 모호함을 완전히 피할 수 있다.
  4. **100 km 방안 경계선 회피**: 현행 `GridRef` 구조체는 단일 100 km 방안 문자(`letters: string`)를 전제하므로, 빌드 때 10.24 km 전장 영역을 잡을 때 $E \equiv 0 \pmod{100\,000}$ 또는 $N \equiv 0 \pmod{100\,000}$ 경계선을 가로지르지 않도록 원점($e_0, n_0 \in [0, 89\,000]\text{ m}$)을 선택해야 한다.
