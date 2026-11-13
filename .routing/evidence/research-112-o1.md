# 실전 모드(적 대포병 · 포대 생존 기동 · 관측초소 노출) 공개 교리/제원 조사 (`research-112-o1`)

- **작성일**: 2026-11-13
- **대상 작업**: `DomineYH/observer#112` (상위 `#109`, 입력 커밋 `25ccf77`) · 관련 PRD: [PRD/OBSERVER_PRD_v0.2.md](../../PRD/OBSERVER_PRD_v0.2.md) (§8 실전 모드 "더 많은 적 + 적 대포병", F-20 적 관측·위협 요소)
- **화포 기초 제원 앵커**: `#110 report (branch research/m3-gun-specs, 00fc7bc), rows 9, 17, 22, 26 & L64–120` (작업 사본 `/tmp/research-112/m3-gun-specs.md`) + `FM 6-50 (1976)` 원문 재검증 (`L22837–22841`, `L23018–23020`).
- **원칙**: 공개 1차 교범·제조사(OEM)·학술·실전 분석 보고서 및 개발사 공식 게임 매뉴얼의 최종 URL만 인용했으며, [교리/Doctrine] · [제조사/Spec] · [언론·기술추정/Estimate] · [추정·제안/Proposal]을 구분하고 상충 수치를 평균하지 않고 병기했다. 게임 규칙은 결정하지 않으며, 확인 불가 항목은 `미확인 (Unconfirmed)`에 명시했다.
- **동반 산출물**: [.routing/evidence/research-112-o1.json](research-112-o1.json) (총 31개 항목, 아래 `## Claims` 표와 1:1 대응) · 계산 스크립트 `/tmp/research-112/calc_112.py`

---

## Claims

> 아래 31개 행은 `research-112-o1.json`의 1–31번 항목과 1:1 대응하며, `Evidence` 열은 `section_or_quote`(≤25단어 원문 인용·조항 또는 계산식/제안 표기)와 동일하다.

| # | 항목 / 질문 | 구분 (`kind`) | 신뢰도 | 핵심 사실 / 계산 / 추정 요약 | Evidence (≤25단어) | 출처 (`source_url`) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `AN/TPQ-36/37` 추적시간·플롯·동시표적 | `fact` | `high` | 궤적 추적 Q-36 `3–5초`(3–15플롯), Q-37 `5–8초`(30 km 미만 5–12·이상 최소 15플롯), 동시 최대 `10문` 탐지 | `Sec. 5-43, 5-48, 5-51: "AN/TPQ - 36: 3 - 5 seconds. AN/TPQ - 37: 5 - 8 seconds."` | `https://www.bits.de/NRANEU/others/amd-us-archive/atp3_09x12%2815%29.pdf` |
| 2 | `AN/TPQ-36/37` 탐지거리·TLE·방렬/이탈 | `fact` | `high` | Q-36 `750 m–24 km`(방렬 20/이탈 10분), Q-37 야포 `4–30 km`(TLE50 35 m)·로켓 `4–50 km`(방렬 30/이탈 15분) | `FM 6-121 Sec. 3-1: "AN/TPQ-36 can be emplaced and ready for operation within 20 minutes. It can be march-ordered within 10 minutes."` | `https://archive.org/download/FM_6_121_F_A_T_A_1990/FM%206-121%20Field%20Artillery%20Target%20Acquisition%20%281990%29_djvu.txt` |
| 3 | `AN/TPQ-50` 교리 거리 대 OEM 제원 충돌 | `fact` | `high` | 교범 계획거리 `0.5–10 km`(비행탄 20발 동시 추적, 155mm 1–6 km, TLE50 50 m) vs SRCTec 카드 원점 `15 km` | `ATP 3-09.12 Sec. 7-23: "Planning ranges for the AN/TPQ- 50 are 0.5 to 10km" (SRCTec PDF: 15 km)` | `https://www.bits.de/NRANEU/others/amd-us-archive/atp3_09x12%2815%29.pdf` |
| 4 | `AN/TPQ-53` 모드별 거리·정확도 및 이탈 충돌 | `fact` | `high` | 90° `0.5–20/3–34/5–60 km`(CEP50 30 m/0.3%), 360° `30 RPM`(야포 5–25 km, 75 m/1%); 방렬/이탈 교범 `5/2분` vs LM `10/5분` | `LM Card p.1: "Emplacement – 10 min. / Displacement – 5 min." (ATP 3-09.12 Sec. 6-64: 5 / 2 min)` | `https://www.lockheedmartin.com/content/dam/lockheed-martin/rms/documents/ground-based-air-surveillance-radars/2316434_Q-53_Product_Card_Refresh.pdf` |
| 5 | `ARTHUR` / `ARTHUR-K` 진지변환·탐지거리 충돌 | `fact` | `medium` | 진입·이탈 `<60초`·광케이블 `500 m`; 탐지거리 `ARTHUR-K 60 km`·분당 100표적(서울경제) vs 최신형 `100 km`(Saab 2025) | `Saab ARTHUR: "in and out of action in less than 60 seconds" (2025 PR: "up to 100 km")` | `https://www.saab.com/products/arthur` |
| 6 | `1L219 Zoopark-1` · `1L260 Zoopark-1M` | `fact` | `medium` | 1L219 G-band(30 kW)·계측거리 `40 km`·40–60° 동시 `4표적`; 1L260 70 kW·`45 km`·좌표 정확도 `49–95 m` | `1L260 page: "The coordinates’ accuracy is between 49 and 95 meters, depending on the size of the projectile."` | `https://www.radartutorial.eu/19.kartei/04.battle/en/karte066.en.html` |
| 7 | `천경-II (TPQ-74K)` 배치·언론 추정 범위 | `fact` | `medium` | 2018–2024년 군단/서북도서 배치 완료, AESA(~1,000모듈); 언론 추정 `10초 이내` 역추적·`8~18시간`, 거리 `60+` vs `약 70 km` | `서울경제: "10초 내 북 장사정포 포탄 감지가능" · "탐지 60km 내외" / FN뉴스: "최대 탐지거리 약 70km"` | `https://www.sedaily.com/article/13847191` |
| 8 | 다중 궤적 평균(200 m)·검열(500 m)·AFATDS | `fact` | `high` | 단일 화기 초탄 산출 가능하나 `200 m` 내 궤적 평균화, `500 m` 내 `2–16`궤적 검열, AFATDS `400 m` 내 `3+` 방위선 교차 | `Sec. 3-38 (200 m averaging), 3-42 (2-16 tracks within 500 m), App. A-9 (3+ rays/400 m)` | `https://www.bits.de/NRANEU/others/amd-us-archive/atp3_09x12%2815%29.pdf` |
| 9 | 교리(`FM 3-09.70`) 최단 대응사격 도래 시간 | `fact` | `high` | 중·고강도 전장에서 적 표적탐지자산 초탄 포착 시 최단 `5–12분` 이내 대응사격 도래 상정 | `Sec. 3-44: "In this case, the enemy may respond in as little as 5 to 12 minutes."` | `https://archive.org/download/FM_3_09_70_T_T_P_M109A6_H_P_O_2000/FM%203-09-70%20Tactics%2C%20Techniques%2C%20and%20Procedures%20for%20M109A6%20Howitzer%20%28Paladin%29%20Operations%20%282000%29_djvu.txt` |
| 10 | 실전(`RUSI 2022-07`) 대포병 사격 소요시간 | `fact` | `high` | UAV 식별 시 `3–5분` 정밀 포격 대 EW 방향탐지·음향·대포병레이더 식별 시 부정확한 포격 `약 30분` | `p.7: "3 to 5 minutes after UAV reconnaissance" / "EW direction finding, acoustic reconnaissance or counterbattery artillery radar... approximately half an hour"` | `https://static.rusi.org/special-report-202207-ukraine-final-web_0.pdf` |
| 11 | 실전(`RUSI 2022-11`) 일반 지휘본부 화력임무 | `fact` | `high` | 자체 UAV `3–5분` 대 화력지휘본부 대기열 경유 일반 화력임무 전술 `20–30분` · 작전 `약 48시간` (대포병 전용 아님) | `p.38–39: "within 3–5 minutes of target detection" / "fire missions taking 20–30 minutes at the tactical level, and around 48 hours"` | `https://static.rusi.org/359-SR-Ukraine-Preliminary-Lessons-Feb-July-2022-web-final.pdf` |
| 12 | 미확인: 음향(`UTAMS`)/섬광 및 `Zoopark`·`천경-II` 상세 | `fact` | `low` | UTAMS·음향/섬광 소요탄·종단 초(s) 및 Zoopark·천경-II 공식 방렬/이탈·TLE50 공개 1차 자료 `unconfirmed` | `unconfirmed (ATP 3-09.12 no UTAMS specs; FM3-05.230/ODIN inaccessible; Korean press lacks setup time)` | `unconfirmed` |
| 13 | [계산] 추적/TOF 점유율 및 레이더 방사 한계 | `computed` | `high` | 9·15 km(TOF 26.4·42.0 s)서 Q-36/37 추적(3–8 s)은 `11.4–30.3%`·`7.1–19.0%`; EW 방사한도 `Q-36/37 2분`, `Q-53 6 vs 3분`, `ARTHUR >7분` (`cross-check not run: needs sympy or pint`) | `track/TOF: [3..8]/(3+2.6*d); EW_rad = max(2, 8 - displace_min)` | `https://www.bits.de/NRANEU/others/amd-us-archive/atp3_09x12%2815%29.pdf` |
| 14 | `#110` 앵커 및 `FM 6-50` 견인·자주 방렬/이탈 | `fact` | `high` | `#110 report (branch research/m3-gun-specs, 00fc7bc), rows 9, 17, 22, 26`: `M101A1` 1분/30초(`KH178 unconfirmed`), `KH179` 3분+/15–20분, `M109` `30s/30s` | `FM 6-50 L22837 & L23018: "emplaced within 30 seconds (M109, M109A1)... displaced within 30 seconds"` | `https://archive.org/download/FM_6_50_T_F_A_C_B_1976/FM%206-50%20The%20Field%20Artillery%20Cannon%20Battery%20%281976%29_djvu.txt` |
| 15 | `K55`·`K55A1`·`M109A6`·`K9` 초탄·기동 비교 | `fact` | `high` | `K55` `2–11분`/`11–12분`(스페이드) vs `K55A1` 정지 `45s`/기동 `75s`; `M109A6` `30s`(저하 45s); `K9` 정지 `30s`/기동 `60s`·`67 km/h` | `중앙일보 L201: "K9은 정지 상태에선 사격명령을 받고 30초 이내에 사격이 가능하다. 이동 중에도 1분 안에"` | `https://www.joongang.co.kr/article/25053184` |
| 16 | 진지변환 거리(`300–500 m`)·포간 분산·실전 비교 | `fact` | `high` | 교범 생존이동 `300–500 m`(레이더 `>=500 m`), 포간 `>=100 m`(소대 PA `1.5×3 km`) vs 2022년 러 포대 `100×300 m`(포간 20–40 m) | `FM 3-09.70 3-44: "A survivability move of 300 to 500 meters removes the platoon or howitzers from the target footprint"` | `https://www.bits.de/NRANEU/others/amd-us-archive/atp3_09x70%2815%29.pdf` |
| 17 | 진지변환 트리거 기준 및 비개량 진지(PA) 재선정 | `fact` | `high` | 기준은 `현 위치 발사 탄수, 사격 지속시간, 체류시간`(2-6, 3-40); 비Paladin은 매 이동 새 PA·예비진지 필요(3-51) | `FM 3-09.70 Sec. 3-51: "Non-M109A6 units must select new PAs for survivability moves."` | `https://archive.org/download/FM_3_09_70_T_T_P_M109A6_H_P_O_2000/FM%203-09-70%20Tactics%2C%20Techniques%2C%20and%20Procedures%20for%20M109A6%20Howitzer%20%28Paladin%29%20Operations%20%282000%29_djvu.txt` |
| 18 | [계산] 견인 대 자주 `300–500 m` 총 진지변환 창 | `computed` | `low` | `추정 모수`(야지 `15–30 km/h`, K55/K9 이탈 `30s` 차용): `KH179` `18.6–25.0+분`, `M101A1` `2.1–5.5분`, `M109` `1.6–3.0분`, `K55` `3.1–13.5분`, `K9` `1.27–3.00분` (`cross-check not run: needs sympy or pint`) | `total = displace + (300..500m)/v + emplace; KH179 18.6-25.0m vs M109 1.6-3.0m` | `https://www.bits.de/NRANEU/others/amd-us-archive/atp3_09x70%2815%29.pdf` |
| 19 | 미확인: `KH178` 방렬·`K55A1/궤도 K9` 이탈 초(s)·속도 | `fact` | `low` | `KH178` 전용 방렬/이탈, `K55A1`·궤도형 `K9/K9A1` 독립 진지이탈 초(s), 야지 행군 평균속도 공식 표 모두 `unconfirmed` | `unconfirmed (KH178 official setup; tracked K9 & K55A1 out-of-action sec; doctrine move km/h)` | `unconfirmed` |
| 20 | 군용 LWR(`Saab`·`Elbit`·`Hensoldt`) 탐지대상·FOV | `fact` | `high` | LRF·LTD·빔라이더·IR조명 탐지, `Saab LEDS-50` `360°` 방위(LWS-310×4, 반사 억제), `Elbit E-LAWS` `360°×110°` FOV | `Elbit LWS: "Threat detection coverage: 360° horizontal, 110° vertical FOV" (Saab: "360° azimuth coverage")` | `https://www.saab.com/products/leds` |
| 21 | LWR 파장 대역(`400–1700 nm`)·`±15°`·연막 대응 | `fact` | `high` | 위협 532/694.3/905/1064/1540/1550 nm, `400–1700 nm` 수신·`±15°` 방위·산란(<1%) 구분; RUSI(2022-11) LWR 경보 시 연막탄 대응 확인 | `Jurba p.1184: "a good optical responsivity covering a large spectral range from 400 to 1700 nm"` | `https://oam-rc.inoe.ro/articles/extended-spectral-range-laser-receiver/fulltext` |
| 22 | [제안·추정] LWR 조도 임계(`1 W/cm²`) 역제곱 외삽 | `proposal` | `low` | `[추정]` 연구자 물리 모델 외삽: `0.2 MW@5 km`=`1.0186 W/cm²` 기준 `50 W–3 MW` 확대 시 `79.8 m–19.54 km`(`244.95배`) 변동 → 고정 km 부재 추정 (`cross-check not run: needs scipy or sympy`) | `Proposal/추정: R=(2/theta)*sqrt(P/(pi*10000)); 50W->79.8m, 3MW->19.54km (244.95x)` | `https://oam-rc.inoe.ro/articles/extended-spectral-range-laser-receiver/fulltext` |
| 23 | 미확인: 제식 LWR 고정 `km` 거리·`ms`·기종별 파장 | `fact` | `low` | Saab·Elbit·Hensoldt 공개 제원상 고정 최대 탐지거리(km)·반응속도(ms)·개별 기종 정확 파장(nm) `unconfirmed` | `unconfirmed (OEM LWR pages publish FOV & threat class, not fixed km range or ms)` | `unconfirmed` |
| 24 | `Rohde & Schwarz` `TDOA/AOA` 기하 조건·정확도 | `fact` | `high` | TDOA 측위는 동시 수신 최소 `3개 이상` 수신소 필요, 일반 정확도 `수백 m`(하이브리드 `~100 m`~수 m급 정밀화) | `Sec. 6.6 & 7.2: "accurate to about several hundred meters" / "minimum of three stations operating simultaneously"` | `https://cdn.rohde-schwarz.com/am/us/campaigns_2/a_d/Intro-to-direction-finding-methodologies.pdf` |
| 25 | 실전(`RUSI 2022-07`) 지상 EW 전개 및 DF 탐지반경 | `fact` | `high` | 러시아군 EW 복합체 전개 `25–40분`, 지상 전술 무선통신 삼각측량 반경 `30–70 km` | `p.11–12: "take between 25–40 minutes to set up" / "triangulating tactical communications within a radius of between 30 and 70 km"` | `https://static.rusi.org/special-report-202207-ukraine-final-web_0.pdf` |
| 26 | OP RDF 회피·OTL 위치노출 억제 교신 교범 | `fact` | `high` | 버스트 송신 및 유선/전령으로 DF 최소화, OTL 송신이 관측반 노출 우려 시 임의 기준점 전환(MCWP 3-16.6), 필수 교신만 허용(FM 6-30) | `MCWP 3-16.6: "burst transmission capability, which minimizes vulnerability to enemy radio direction finding"` | `https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt` |
| 27 | OP 체류구분·2인 교대·스카이라인·가시레이저 위험 | `fact` | `high` | 단기 OP `<=12시간` vs 장기(9-161), 2인 `20–30분` 교대(H-25), 고립지형·산마루 회피, 가시 레이저 노출 고위험(Table 2-10), `Splash` 엄폐 | `FM 3-21.8 9-161: "The OP can either be short term (12 hours or less) or long term"` | `https://www.bits.de/NRANEU/others/amd-us-archive/FM3-21.8%2807%29.pdf` |
| 28 | OP 피탐 후 대응 교범 및 고정 체류한도(`unconfirmed`) | `fact` | `medium` | 피탐 시 경계조 엄호(9-145)·간접화력 억제(9-162/H-8)·후속선 이탈 요청 및 예비진지 사전 구축(8-77); 고정 분/시간 타이머 `unconfirmed` | `FM 3-21.8 9-145: "If the reconnaissance element is compromised, the security element must be able to quickly support them."` | `https://www.bits.de/NRANEU/others/amd-us-archive/FM3-21.8%2807%29.pdf` |
| 29 | 게임 사례 1: *Flashpoint Campaigns: Cold War* | `fact` | `high` | 비플레이어 자동 WLR(`Counter-Battery Radar`)이 주기적 방사로 포격 탐지 후 FSCC 이양, 플레이어는 `Shoot & Scoot` SOP로 회피 | `OTS Guide 4.8: "Consider setting “Shoot & Scoot” SOP for your own artillery units to reposition after firing."` | `https://www.ontargetsimulations.com/guides/coldwar/fieldmanuals/intermediate-tutorials/artillery-operations/` |
| 30 | 게임 사례 2: *Combat Mission: Afrika Korps* | `fact` | `high` | 관측반(`Spotter`)은 포격 중 은신 해제(`cannot hide`) 강제 노출, 무전기 관측반이 유선보다 기동 우위, 본사격 `30–60초` 전 시사탄 경고 | `CMAK Manual p.119: "A spotting team cannot call for an artillery strike while hidden - it must unhide"` | `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3843570/manuals/d310bfc71b620f3e871de6eb8d321c659d4f1a81/CM3_manual_EN.pdf?t=1755522099` |
| 31 | 적 관측반(지도/나침반 대 LRF) 초탄 정밀도 비교 | `fact` | `high` | 전통 지도·나침반 관측반 평균 표적오차 `약 500 m`(수정사격 필수) vs LRF(`AN/GVS-5 ±10 m`, 1초 측정) 초탄 효력사(FFE) 가능 | `FM 6-30 App. A-12: "AN/GVS-5 provides a range to the target that is accurate to within ±10 meters."` | `https://archive.org/download/ost-military-doctrine-fm6_30/fm6_30_djvu.txt` |

---

## Part 1. 발포 포대에 대한 대포병 사격 (Counter-Battery Fire)

### 1.1 주요 대포병 레이더 제원 및 교리/제원/추정 구분

> **`[교리]`** = 군 교범 계획치/성능 기준 · **`[제조사]`** = OEM 공개 제품카드/웹페이지 · **`[추정]`** = 기술 레퍼런스/언론 보도(비1차 교범)

| 체계명 | 구분 | 탐지·계획 사거리 | 추적 시간 / 필요 포탄(플롯) | 동시 탐지 · 정확도 | 진지 방렬 / 이탈 | 출처 (최종 URL) |
| --- | --- | --- | --- | --- | --- | --- |
| `AN/TPQ-36` | `[교리]` | 최소 `750 m` ~ 최대 `24 km` (81mm·114mm 90%, 105/155/203mm 70%) | 궤적 추출 **`3–5초`** (`3–15` 플롯) | 동시탐지는 `3–15` 플롯/다중 처리 (Q-37 대비 단거리·고각 최적화) | **`20분` / `10분`** (위장망 제외, ARTEP 이탈 10분) | [ATP 3-09.12](https://www.bits.de/NRANEU/others/amd-us-archive/atp3_09x12%2815%29.pdf), [FM 6-121](https://archive.org/download/FM_6_121_F_A_T_A_1990/FM%206-121%20Field%20Artillery%20Target%20Acquisition%20%281990%29_djvu.txt) |
| `AN/TPQ-37` | `[교리]` | 야포 **`4–30 km`**, 장거리 로켓 **`4–50 km`** (구 FM 6-121 최소 `3 km` 충돌) | 궤적 추출 **`5–8초`** (`<30 km` 5–12, `>30 km` 최소 15플롯) | 동시 최대 **`10문`**. TLE50/90: 야포 `35m(0.35%) / 90m(0.9%)`, 로켓 `70m(0.4%) / 175m(1%)` | **`30분` / `15분`** (위장망 제외) | [ATP 3-09.12](https://www.bits.de/NRANEU/others/amd-us-archive/atp3_09x12%2815%29.pdf), [FM 6-121](https://archive.org/download/FM_6_121_F_A_T_A_1990/FM%206-121%20Field%20Artillery%20Target%20Acquisition%20%281990%29_djvu.txt) |
| `AN/TPQ-50` | `[교리]` vs `[제조사]` | **교리**: `0.5–10 km` (60mm 0.5, 81mm 0.5–8, 120/122/240mm 1–10, 155mm 1–6 km) **vs OEM**: **`15 km`** | 비행 탄체 추적 (단발 초 수치 `unconfirmed`) | 동시 **`20발`** 비행탄; 360° `700 km²`; TLE50 50 m(122mm 100, 240mm 200 m) | `unconfirmed` | [ATP 3-09.12 Table 7-1](https://www.bits.de/NRANEU/others/amd-us-archive/atp3_09x12%2815%29.pdf), [SRCTec PDF](https://www.radartutorial.eu/19.kartei/04.battle/pubs/ANTPQ50.pdf) |
| `AN/TPQ-53` | `[교리]` vs `[제조사]` | **90°**: 0.5–20(박격포)·3–34(야포)·5–60 km(로켓)<br>**360°**: 3–15·5–20/25 km (2018 GaN 연장계약) | 단일·다수 자동 탐지·분류·추적 (회전 360° `30 RPM`) | 동시 **`6+`표적**, Pd `>=85%`, 오경보 `<=1건/6h`; CEP50 `30m/0.3%`(90°) vs `50–75m/0.5–1%`(360°) | **충돌**: 교리 **`5분/2분`** vs LM 2023 카드 **`10분/5분`** | [ATP 3-09.12 Ch. 6](https://www.bits.de/NRANEU/others/amd-us-archive/atp3_09x12%2815%29.pdf), [LM 2023 Card](https://www.lockheedmartin.com/content/dam/lockheed-martin/rms/documents/ground-based-air-surveillance-radars/2316434_Q-53_Product_Card_Refresh.pdf), [LM 2018 GaN](https://news.lockheedmartin.com/2018-10-08-U-S-Army-Awards-Lockheed-Martin-Contract-Extending-AN-TPQ-53-Radar-Range) |
| `ARTHUR` / `ARTHUR-K` | `[제조사]` / `[추정]` | **충돌/세대**: Saab 2025 PR 최신형 최대 **`100 km`** vs 서울경제 `ARTHUR-K` **`60 km`** | 단발 추적 초 `unconfirmed` | `[추정]` ARTHUR-K 분당 **약 100개** 표적 추적, ECM 대응, 4.5톤 일체형 | **`<60초`** 진입·이탈 (광케이블 **`500 m`** 원격) | [Saab ARTHUR](https://www.saab.com/products/arthur), [Saab 2025 PR](https://www.saab.com/newsroom/press-releases/2025/saab-receives-order-for-artillery-locating-radar-from-sweden), [서울경제](https://www.sedaily.com/article/13847191) |
| `1L219 Zoopark-1` / `1L260 -1M` | `[추정]` | 계측상한 `1L219` **`40 km`** / `1L260` **`45 km`** (포종별 실탐지거리 `unconfirmed`) | G/C-G 대역(5.25–5.925 GHz), 30/70 kW; 추적 초 `unconfirmed` | `1L219`: 40–60° 동시 **`4표적`**; `1L260`: 좌표 정확도 **`49–95 m`** | `unconfirmed` | [Radartutorial 1L219](https://www.radartutorial.eu/19.kartei/04.battle/en/karte066.en.html), [Radartutorial 1L260](https://www.radartutorial.eu/19.kartei/04.battle/en/karte069.en.html) |
| `천경-II (AN/TPQ-74K)` | `[추정]` (언론) | **충돌**: 서울경제 **`60 km 이상`** (`60 km 내외`) vs 파이낸셜뉴스 **`약 70 km`** | `[추정]` **`10초 이내`** 탐지·역추적 (AESA ~1,000모듈, 천무 차체, 연속 8~18h) | 정확한 TLE50·동시표적 수 공식 미공개 (`unconfirmed`) | `unconfirmed` (차량 일체형, 2018–2024 전군·서북도서 전력화) | [문화일보](https://www.munhwa.com/article/11421104), [서울경제](https://www.sedaily.com/article/13847191), [파이낸셜뉴스](https://www.fnnews.com/news/202303061211400720) |

### 1.2 소요 발사수, 다중 궤적 병합 및 발사→착탄 종단 타임라인

1. **초탄 탐지 대 다발/교차 검증 (`ATP 3-09.12`)**:
   - 대포병 레이더는 **단 1발의 발사 궤적**만으로도 발사원점 좌표를 즉시 산출할 수 있으나(`ATP 3-09.12` 6-32 등), 교범은 정확도 확보 및 중복 보고 차단을 위해 **반경 `200 m` 이내 다중 궤적을 평균화**(Sec. 3-38)하고, **반경 `500 m` 이내에 `2–16`개 궤적이 쌓이면 동일 표적을 자동 검열(censoring)** 한다(Sec. 3-42).
   - 다수 센서를 묶는 AFATDS 화력지휘체계는 **반경 `400 m` 이내에서 교차하는 `3개 이상` 표적지시선(target-indicator ray)** 을 교차 결합한다(App. A-9).
   - `[계산]` (`행 13`, `cross-check not run: needs sympy or pint`) 사거리 `9 km`(PRD §6 TOF `26.4 s`)·`15 km`(TOF `42.0 s`) 기준 `AN/TPQ-36/37` 추적 소요시간(`3–8 s`)은 포탄 비과시간의 **`11.4–30.3%`** (`9 km`), **`7.1–19.0%`** (`15 km`)에 불과하므로 포탄이 표적에 낙하하기 전에 이미 레이더 추적이 완료된다.
2. **방사 생존성 제약 (`ATP 3-09.12` 3-25)**:
   - 적 EW 위협 하 최적 차폐각(screening crest)이 없는 레이더는 `2분 이상` 연속 방사를 지양하고, **`8분 - 진지이탈(march-order) 시간` (최소 `2분`)** 만 방사 후 **최소 `500 m` 생존이동**을 실시한다.
   - `[계산]` (`행 13`, `cross-check not run: needs sympy or pint`) 따라서 이탈 `10/15분`인 `Q-36/Q-37`은 바닥값 **`2.0분`**, `Q-53`은 교범(`2분`) 기준 **`6.0분`** 대 LM(`5분`) 기준 **`3.0분`**, `ARTHUR`(`<1분`)는 **`7.0분+`** 의 1회 방사 허용창을 가진다.
3. **종단(End-to-End) 대응사격 도래 시간**:
   - **교리 최악 가정 (`FM 3-09.70` 3-44, `행 9`)**: 적 표적탐지자산이 초탄을 포착하면 **최단 `5–12분`** 만에 대응탄이 낙하한다고 상정한다.
   - **실전 대포병 관측 (`RUSI Special Report 2022-07` p.7, `행 10`)**: UAV 정찰로 표적을 식별한 뒤에는 **`3–5분(3 to 5 minutes)`** 내 정확한 포격이 도래한 반면, **EW 방향탐지 · 음향정찰 · 대포병레이더**로 표적이 식별되면 부정확한 포격 도래까지 **`약 30분(approximately half an hour)`** 이 소요되었다.
   - **실전 일반 화력지휘본부 대기열 (`RUSI Preliminary Lessons 2022-11` p.38–39, `행 11`)**: 자체 UAV 보유 시 **`3–5분`** 내 효력을 발휘했으나, 화력지휘본부 대기열 하단에 신규 표적을 순차 적재하는 일반 화력임무(fire missions)는 전술 수준 **`20–30분`**, 작전 수준 **`약 48시간`** 이 소요되었다(대포병 전용이 아닌 일반 화력임무 대기열 기준).
   - **음향(`UTAMS`)·섬광 탐지 (`행 12`)**: 미군 교범 `ATP 3-09.12` 내 정량 소요탄·처리 초 수치 및 한국군 음향/섬광 제원은 `unconfirmed`.

---

## Part 2. 포대 생존 기동 — 사격 후 진지변환 (Shoot-and-Scoot)

### 2.1 `#110` 앵커 및 화포별 방렬·이탈 시간 비교

- **선행 앵커 (`#110`)**: `#110 report (branch research/m3-gun-specs, 00fc7bc), rows 9 (105mm), 17 (KH179), 22 (K55/K55A1), 26 (K9/K9A1) & L64–120` (작업 사본 `/tmp/research-112/m3-gun-specs.md`)을 승계하고 `FM 6-50 (1976)` 원문을 재검증했다.

| 체계 | 구분 | 방렬 / 초탄 준비 시간 | 진지 이탈(해제) 시간 | 최고도로속도 / 비고 | 출처 |
| --- | --- | --- | --- | --- | --- |
| `105mm M101A1` (`KH178` 공식 `unconfirmed`) | 견인 | 정식 **`1분 이내`**, 긴급 점령 만점 **`0–3:00`** (최대 3:45) | **`30초 이내`** (FM 6-50 Task 2; 차량 결합 대기 제외) | `KH178` 전용 한국군 공식 방렬/이탈 `unconfirmed` | [FM 6-50 (1976)](https://archive.org/download/FM_6_50_T_F_A_C_B_1976/FM%206-50%20The%20Field%20Artillery%20Cannon%20Battery%20%281976%29_djvu.txt), `#110 report (branch research/m3-gun-specs, 00fc7bc), row 9` |
| `155mm KH179` (`M114A1` 2/1분, `M777` <3분, `M198` 10–12분) | 견인 | **`최소 3분 이상`** | 차량 견인 이탈 **`15–20분`** | 155mm 견인포 중 해제·견인 부담이 가장 큼 | [세계일보 (2011-09-07)](https://www.segye.com/newsView/20110906003831), `#110 report (branch research/m3-gun-specs, 00fc7bc), row 17` |
| `K55` (`M109` 30s/30s) | 자주 | **충돌**: 스페이드 고정 포함 초탄 **`2–11분`**(디펜스투데이) vs **`11–12분`**(세계일보) | `K55` 전용 `unconfirmed` (`FM 6-50` 원형 `M109` **`30초`**) | 구형 수동·반자동 유압 스페이드 제약 | [디펜스투데이](https://www.defensetoday.kr/news/articleView.html?idxno=5035), [세계일보 (2011-09-20)](https://www.segye.com/newsView/20110920004480), [FM 6-50](https://archive.org/download/FM_6_50_T_F_A_C_B_1976/FM%206-50%20The%20Field%20Artillery%20Cannon%20Battery%20%281976%29_djvu.txt) |
| `K55A1` / `M109A6 Paladin` | 자주 | `K55A1`: 정지 **`45초`**, 기동 **`75초`**<br>`Paladin`: 임무수신 **`30초`** (고각/저하 `45/60s`) | `K55A1`·`Paladin` 독립 물리 이탈 `unconfirmed` (단 `FM 6-50` `M109` **`30초`**) | 스페이드 제거, 전동 유압·자동사통개량 | [디펜스투데이](https://www.defensetoday.kr/news/articleView.html?idxno=5035), [FM 3-09.70](https://archive.org/download/FM_3_09_70_T_T_P_M109A6_H_P_O_2000/FM%203-09-70%20Tactics%2C%20Techniques%2C%20and%20Procedures%20for%20M109A6%20Howitzer%20%28Paladin%29%20Operations%20%282000%29_djvu.txt) |
| `K9 / K9A1` | 자주 | 정지 **`30초 이내`**, 기동 **`1분(60초) 이내`** | 궤도형 독립 이탈 초 `unconfirmed` (`#110` row 26; 참고: 8x8 차륜 `K9MH <30s`) | 최고속도 **`67 km/h`** (47t, 15초 3발·3분 18발) | [중앙일보 (2022-03-06)](https://www.joongang.co.kr/article/25053184), [문화일보 (2020-11-13)](https://www.munhwa.com/article/11212758), `#110 report (branch research/m3-gun-specs, 00fc7bc), row 26` |

### 2.2 진지변환 트리거·이동거리 및 계산된 생존 이동 창 (`computed`, `confidence: low`)

1. **이동 기준(Triggers) 및 거리 (`ATP 3-09.70` · `FM 3-09.70`)**:
   - **3대 발동 조건 (`ATP 3-09.70` 2-6, 3-40)**: 포대장이 METT-TC 및 대포병 위협에 따라 ① **현 위치 발사 탄수**, ② **사격 지속시간**, ③ **진지 내 체류시간** 기준으로 이동 명령을 하달한다.
   - **거리 및 분산 (`FM 3-09.70` 3-44, 3-50; `ATP 3-09.70` 2-14, 4-9)**: 생존성 이동 거리 **`300–500 m`** 는 적 포병 표적 풋프린트를 벗어나며, 자주포 간격은 **`최소 100 m`**, Paladin 소대 구역은 `1.5×3 km`다. 비개량 부대는 이동마다 **신규 PA/예비진지 선정**이 필수이나 Paladin은 동일 사격구역 내 즉각 재배치가 가능하다(3-51, 3-52). 반면 RUSI(2022-07) 관측상 러시아 포대는 `100×300 m`(포간 `20–40 m`) 밀집 후 피격 시까지 거의 이동하지 않았고 MLRS만 `150 m` 이격 후 사격 즉시 이동했다.
2. **300–500 m 진지변환 + 재방렬 총 시간 비교 (`행 18`, `calc_112.py`, `cross-check not run: needs sympy or pint`, `confidence: low`)**:
   - 출처에 없는 야지 주행속도 **`15–30 km/h` (`추정 모수`)** 적용 시 `300–500 m` 주행에 **`36–120초` (`0.60–2.00분`)** 가 소요된다(참고: `K9` 평탄 도로 최고속 `67 km/h` 이론 하한 `16.12–26.87초`). 또한 `K55` 및 `K9`의 이탈시간 `30초`는 M109(`FM 6-50`) 수치를 차용한 **`추정 모수`** 다.

| 비교 포병 (산출 근거 및 추정 모수 표기) | 총 이탈+이동+재방렬 창 | 교리 최악 대포병 (`5–12분`, 행 9) 대비 | 실전 `RUSI 2022-07` (`약 30분` 대포병 / `3–5분` UAV, 행 10) 대비 |
| --- | --- | --- | --- |
| **`KH179` (155mm 견인)** (`15–20m` + 주행 `추정 모수 15–30 km/h` + `3m+`) | **`18.60–25.00+분`** (`1,116–1,500+ s`) | **`1.55–5.00배 느림`** (초탄 포착 후 탈출 사실상 불가) | `약 30분` 대포병 루프 직전·UAV `3–5분`엔 탈출 불가 |
| **`M101A1` (105mm 견인, FM 6-50)** (`30s` + 주행 `추정 모수 15–30 km/h` + `60–180s`, 결합대기 제외) | **`2.10–5.50분`** (`126–330 s`) | `0.17–1.10x` (상단은 `5분` 경계, 실전 견인결합 시 지연) | UAV `3–5분`과 경합; `약 30분` 루프에는 충분히 이탈 |
| **`M109` (자주, FM 6-50 기준)** (`30s` + 주행 `추정 모수 15–30 km/h` + `30s`) | **`1.60–3.00분`** (`96–180 s`) | **`1.67–7.50배 빠름`** (`KH179` 대비 **`6.20–15.62배`** 빠름) | UAV `3–5분` 하한 직전·`약 30분` 루프 대비 여유 |
| **`K55` (자주, 스페이드 제약)** (`이탈 30s 추정 모수` + 주행 `추정 모수 15–30 km/h` + `2–11m`) | **`3.10–13.50분`** (`186–810 s`) | 상단 `13.5분`은 `12분` 교리 한계 초과 | 장시간 스페이드 작업 시 노출 확대 |
| **`K9` (모수화 추정)** (`이탈 30s 추정 모수` + 주행 `추정 모수 15–30 km/h` 및 `67 km/h` 하한 + `30s`) | **`1.27–3.00분`** (`76.1–180 s`, 모수 가정) | **`1.67–9.46배 빠름`** (`30s` 정지초탄 포함 단발 스쿠트 유리) | 독립 궤도형 `K9` 이탈 초 `unconfirmed`(`행 19`)로 `confidence: low` |

---

## Part 3. 관측초소(OP)에 대한 적 위협 (LWR · RDF · OP 교리)

### 3.1 레이저 경보 수신기 (LWR)

- **제식 LWR 스펙 (`Saab`, `Elbit`, `Hensoldt`, `행 20`)**: `Saab LEDS-50`은 `LWS-310` 센서 4기로 **`360°` 방위각**(상단 LWS-500 추가 시 반구형)과 **반사빔 억제(anti-reflection)** 를 제공한다. `Elbit E-LAWS`는 레이저 거리측정기(LRF)·표적지시기(LTD)·빔라이더·IR 조명을 **수평 `360°` × 수직 `110°` FOV** 로 탐지한다. `Hensoldt ALTAS-2QB`도 LRF·LTD·빔라이더를 경보해 연막·대응체계를 연동한다.
- **파장 · 해상도 · 직사/산란 · 연막 대응 (`Jurba et al. 2012`, `RUSI 2022-11`, `행 21`)**:
  - 위협 파장은 `532 nm`(배주파 Nd:YAG), `694.3 nm`(루비), `905 nm`(InGaAs), `1064 nm`(Nd:YAG), `1540 nm`(Er:Glass), `1550 nm`(라만 Nd:YAG)이며, Si+InGaAs 수신기는 **`400–1700 nm`** 전 대역과 **`±15°`** 방위 해상도, **`1%` 미만 진폭의 산란빔 배제** 를 구현한다.
  - 경보 시 표준 대응은 **연막/수막(smoke/water-fog) 전개 및 기동**이며, `RUSI(2022-11)`는 우크라이나전 거점의 LWR 경보 시 인원이 **연막탄을 투척(pop smoke grenades)** 해 조준을 교란한 실전을 보고했다.
- **`[추정 · Proposal]` 역제곱 조도 외삽 모델 (`행 22`, `kind: proposal`, `confidence: low`, `cross-check not run: needs scipy or sympy`)**:
  - `Jurba et al.(2012, p.1183)` 직사 판별 임계조도 `1 W/cm²`(1 mm²당 0.01 W)에 대표치 `P = 0.2 MW · θ = 1 mrad · R = 5,000 m`를 대입하면 `1.0186 W/cm²`로 논문의 `5,000 m` 예시와 부합한다.
  - **`[추정]`** 위 임계식을 Table 1 레이저 출력(`50 W` 다이오드 ~ `3 MW` Nd:YAG)에 연구자 자체 역제곱 모델로 외삽하면 `79.8 m (50 W)` → `5.05 km (0.2 MW)` → `11.28 km (1 MW)` → `19.54 km (3 MW)`로 **출력만으로 `244.95배` 변동**하므로, **[추정] LWR에 고정 km 상수가 성립하지 않는다**는 해석은 출처 직접 진술이 아닌 물리 모델 기반 `추정`이다. 제조사 데이터시트상 고정 `km` 최대거리는 `unconfirmed`(`행 23`).

### 3.2 무선 방향탐지 (RDF / EW)

- **원리·기하 조건 (`Rohde & Schwarz DF`, `행 24`)**: `TDOA` 측위는 동일 전파를 동시 수신하는 **최소 `3개 이상` 수신소**가 필요하며(Sec. 7.2) 일반 정확도는 **수백 m(`several hundred meters`, Sec. 6.6)** 급이고, `AOA+TDOA` 하이브리드는 자동 DF `~100 m`~수동 휴대 DF `m급`까지 정밀화된다(Sec. 7.1).
- **실전 지상 EW DF 타임라인 (`RUSI Special Report 2022-07` p.11–12, `행 25`)**: 러시아군 대부분 EW 복합체는 진지 전개에 **`25–40분`** 이 걸리며, 지상 전술 무선통신 삼각측량 유효 반경은 주파수에 따라 **`30–70 km`** 로 관측되었다.

### 3.3 OP 운용·은닉·노출 대응 교리 (`FM 3-21.8` · `MCWP 3-16.6` · `FM 6-30`)

- **체류 및 인원 운용 (`FM 3-21.8`, `행 27`)**: 상부 지침에 따라 **단기(`12시간 이하`)** 또는 장기 OP로 운용하며(9-161), 관측 피로로 인해 최소 **2인 1조가 `20–30분`마다 관측·경계를 교대**한다(H-25). 급수탑·고립 수목·단독 건물(적 TRP 표적 우려)과 산마루 스카이라인을 피해 경사면 하단과 은엄폐 진입로를 택한다(9-161).
- **교신·레이저·정밀도 트레이드오프 (`MCWP 3-16.6` · `FM 6-30` · `FM 3-21.8`, `행 26, 27, 31`)**:
  - RDF 회피를 위해 **버스트 송신·유선·전령**을 우선하고 사격망 무전을 임무 필수로 제한하며(`MCWP 3-16.6` / `FM 6-30`), 관측자-표적선(OTL) 송신이 지상 관측반 위치를 노출할 우려가 있으면 **임의 기준지형**으로 전환한다(`MCWP 3-16.6` L2932–2934). FDC의 `Splash`(착탄 5초 전) 경보는 관측자의 엄폐 유지를 돕는다(L5837–5842).
  - 가시광 레이저 표지는 **노출 위험이 매우 높음(`Risk of compromise is high`)** 으로 분류되며(`FM 3-21.8` Table 2-10), 반대로 전통 지도·나침반 관측반의 **평균 표적오차 `약 500 m`**(`FM 6-30` L1177) 대비 LRF(`AN/GVS-5 ±10 m`, 1초 측정)는 초탄 효력사(FFE)를 가능케 해 은밀성과 화력 정확도 간 상충이 존재한다.
- **노출·피탐 이후 대처 (`FM 3-21.8`, `행 28`)**: 정찰/OP 피탐 시 경계조가 직·간접화력으로 즉시 엄호(9-145), 장거리 OP는 탐지 시 화력 지원(9-162), 경계선 압박 시 상급 보고 후 후속선 이탈 요청(H-8), 사전 **예비·대체진지** 선정(8-77)을 수행한다. 보편적 고정 분/시간 타이머 및 한국군 OP 교리는 `unconfirmed`.

---

## Part 4. 게임 및 시뮬레이터 모델링 사례

1. **대포병 레이더·진지변환 모델링 — *Flashpoint Campaigns: Cold War* ([OTS 공식 포병 운용 가이드](https://www.ontargetsimulations.com/guides/coldwar/fieldmanuals/intermediate-tutorials/artillery-operations/), [SOP 가이드](https://www.ontargetsimulations.com/guides/coldwar/fieldmanuals/basic-tutorials/standard-operating-procedure-sop/), `행 29`)**:
   비플레이어 자동 유닛인 `Counter-Battery Radar`(WLR)는 탐지 커버리지와 생존성의 균형을 맞추기 위해 제한된 방사 주기(`controlled emission cycles`)로 동작하며 적 포격을 탐지하면 자동으로 `FSCC`에 대포병 화력임무를 요청한다. 플레이어 포병은 대포병 회피를 위해 `Shoot & Scoot` SOP를 켜 두어 사격 임무 직후 자동 재배치하도록 모델링한다.
2. **관측반(Spotter) 노출·유무선 모델링 — *Combat Mission: Afrika Korps* ([Battlefront/Steam 공식 매뉴얼 p.117–119](https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3843570/manuals/d310bfc71b620f3e871de6eb8d321c659d4f1a81/CM3_manual_EN.pdf?t=1755522099), `행 30`)**:
   포병 관측반(`Spotter Team`)은 은신(`Hide`) 상태에서는 포격을 호출할 수 없고 포격 임무 전체 기간 동안 **은신 해제 상태(`cannot hide`)를 강제 유지**해 적 시선 피탐 위험을 감수하며, 무전기 관측반은 야전선(wire) 가설이 필요한 유선 관측반보다 빠른 이동등급을 부여받고 본사격 `30–60초` 전 소수 시사탄(`spotting rounds`)이 먼저 낙하한다.

---

## 실전 모드 요약 (규칙 비결정 · 증거 기반 수치 범위, PRD §8 · F-20)

- 본 절은 게임 규칙을 결정하지 않고, `PRD §8`("더 많은 적 + 적 대포병") 및 `F-20`(적 관측반/센서 위협) 설계 시 직접 참조 가능한 검증 범위와 저장소 내 출처 행만 요약한다.
  - **적 대포병 탐지·대응창**: 교범 기준 레이더 궤적 추적은 **`3–8초`** (`Q-36/37`, [research-112-o1.json](research-112-o1.json) 행 1, 13 `computed/high`)이나 발사→착탄 종단 대응창은 **교리 최악 `5–12분`**(`FM 3-09.70`, 행 9) vs **실전 `RUSI 2022-07` UAV 직결 `3–5분` · EW 방향탐지/음향/대포병레이더 경유 `약 30분`**(행 10)이다(참고: `RUSI 2022-11` 일반 HQ 화력임무 대기열은 전술 `20–30분` · 작전 `~48시간`, 행 11).
  - **아군 포대 생존 이동 (`견인포 vs 자주포`, `#110` 앵커)**: `#110 report (branch research/m3-gun-specs, 00fc7bc), rows 9, 17, 22, 26 (L64–120)`과 [research-112-o1.json](research-112-o1.json) 행 14–18 기준, `추정 모수`(야지 `15–30 km/h`, K55/K9 이탈 `30초` 차용; 행 18 `computed/low`, `cross-check not run: needs sympy or pint`)를 적용한 `300–500 m` 이탈+이동+재방렬 창은 **견인포 `KH179` `18.6–25.0+분`** (`M101A1` `2.1–5.5분`) 대 **자주포 `M109` `1.6–3.0분` · `K55` `3.1–13.5분` · `K9(추정 모수)` `1.27–3.00분`** 으로 나타난다.
  - **관측초소(OP) 노출 트레이드오프**: OP가 **LRF(오차 `±10 m`, 초탄 FFE, 행 31)** 를 쏘면 LWR(`400–1700 nm`, `360° FOV`, 연막 대응 가능, 행 20–21) 피탐 위험이 생기며(역제곱 거리는 행 22 `proposal/low` 추정 모델 참고), 무전 교신이 길면 지상 RDF/EW(`TDOA 3+국`, 전개 `25–40분`, 전술통신 삼각측량 `30–70 km`, 행 24–25) 위험이 증가하는 반면 버스트·유선·OTL 대체 및 지도/나침반(`평균 오차 ~500 m`) 운용은 노출을 낮춘다(행 26–27, 31).

---

## 미확인 (`Unconfirmed`)

1. **비레이더 음향(`UTAMS`)·섬광 표적탐지 정량 소요탄·종단 시간 및 `Zoopark-1/1M`·`천경-II` 공식 제원 (`행 12`)**:
   - *확인 시도*: `ATP 3-09.12` 전 문단(`L1–6490`), `FM 6-121`, `Radartutorial`, 문화일보/서울경제/파이낸셜뉴스, `ODIN`, `armypubs.army.mil`.
   - *사유*: `armypubs` DNS 실패, `ODIN` JS 전용 SPA(역공학 배제), `FM 3-05.230` 환경상 `pdftotext` 부재, 한국/러시아군 공식 방렬·이탈·TLE50 비공개.
   - *충족 요건*: 미 육군 UTAMS 공개 교범 또는 ADD/방사청/러시아 1차 공식 제원표.
2. **한국군 `KH178` 방렬·이탈, `K55A1`·궤도형 `K9/K9A1` 독립 진지이탈 초(s), 야지 진지변환 평균속도 (`행 19`)**:
   - *확인 시도*: `#110 report (branch research/m3-gun-specs, 00fc7bc), rows 9, 22, 26 & L64–120` (`/tmp/research-112/m3-gun-specs.md`), 중앙일보·문화일보·디펜스투데이·세계일보, 한화 쇼룸/EU, `FM 3-09.70`, `ATP 3-09.70`.
   - *사유*: `#110`과 동일하게 궤도형 K9/K55A1은 '초탄 사격준비'(30/60s, 45/75s)만 공개되고 물리적 '진지 이탈' 초 및 야지 고정 행군속도 교범 표가 없음.
   - *충족 요건*: 육군 포병 야전교범 또는 K9/K55A1 체계 백서.
3. **군용 제식 LWR(`LEDS-50`, `E-LAWS`, `ALTAS-2QB`)의 고정 최대 탐지거리(km) · 반응속도(ms) · 기종별 정확 파장(nm) (`행 23`)**:
   - *확인 시도*: Saab `LEDS-50` 웹/PDF, Elbit `E-LAWS` 웹/PDF, Hensoldt `ALTAS-2QB` 웹, `Jurba et al. (2012)`.
   - *사유*: 제조사는 `FOV`/`반사억제`만 공표하며 일부 PDF는 폰트 인코딩 제한이 있음. (`[추정]` 행 22 `proposal/low`의 역제곱 물리 모델 추정에 따르면 LWR 거리는 위협 출력 `50 W–3 MW` → `245x` 및 대기조건 종속이라 고정 `km` 상수가 성립하지 않는 것으로 추정되나, 이는 출처 직접 진술이 아님.)
   - *충족 요건*: 특정 위협 출력/발산각/대기감쇠가 고정된 시험 조건 하의 OEM 수광감도(W/cm²) 사양.
4. **한국군 OP/FO 교신보안 SOP 및 보편적 고정 분/시간 단위 OP 최대 체류 한도 (`행 28`)**:
   - *확인 시도*: `FM 3-21.8`, `MCWP 3-16.6`, `FM 6-30`, `ATP 3-09.12/3-09.70`.
   - *사유*: 미 교범은 단기(`<=12h`)/장기 구분과 `20–30분` 2인 교대만 규정하며, 고정 탈출 타이머 대신 지휘관 지침/METT-TC에 따름. 한국군 OP 교리는 비공개.
   - *충족 요건*: 한국군 보병/포병 관측소 운용 공개 교범.
5. **접근 차단/폰트 인코딩으로 미확보된 참고 문헌 목록 (`미사용`)**:
   - `armypubs.army.mil` (DNS 실패), `marines.mil` · `dote.osd.mil` · `esd.whs.mil` · `chosun.com` · `bistudio.com` (HTTP 403), `odin.t2com.army.mil` (JS-only SPA), `opg.optica.org` (Radware challenge), Identity-H/글리프 인코딩 PDF (`FM 3-09 (2014)`, `Armored Brigade II Manual`, `FC-RS Manual` 일부, `Elbit E-LAWS PDF`, `Saab LEDS50 PDF` p.2+, `RUSI Meatgrinder 2023` 표 구간).
