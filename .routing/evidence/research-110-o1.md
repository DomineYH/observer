# OBSERVER 포병 4개 체계(105mm·KH179·K55·K9) 공개 제원 및 게임 모델 비교 조사 (research-110-o1)

- **작성일**: 2026-11-13
- **대상 작업**: `DomineYH/observer#110` (`research-110-o1`)
- **원칙**: 공개 1차·제조사(OEM)·정부/학술·미군 공개 교범·국제기구 자료만 사용했으며, 위키류·커뮤니티 게시글 인용 및 사표(firing table, `사표`) 조회·복원을 배제했다. 확인되지 않은 항목은 모두 `unconfirmed`로 명시했다.
- **동반 산출물**: `.routing/evidence/research-110-o1.json` (아래 `## Claims` 표와 1:1 대응, 총 37개 항목)

## Claims

| # | 항목 / 질문 | 구분 (`kind`) | 신뢰도 | 핵심 사실 / 계산 / 제안 요약 | 출처 (`source_url` 또는 상태) |
| --- | --- | --- | --- | --- | --- |
| 1 | KH178 구경·포신장·계열 | `fact` | `high` | 105mm 37구경장 견인곡사포, M101 토대 1978년 개발 착수 | `http://www.hyundai-wia.com/business/defense_ground03.asp` |
| 2 | 포대 문수 (KH178/KH179/K55) | `fact` | `low` | 미군 ATP 3-09.50은 BCT 6문/포대(구 8문); 한국군 공식 1차 문수 문서는 `unconfirmed` | `unconfirmed` (참조: `ATP 3-09.50`) |
| 3 | 105mm 최대 사거리 | `fact` | `high` | KH178 14.7 km(HE)/18 km(ERBB); KM1(494 m/s) 11.27 km; M1 11.27–11.5 km | `http://www.hyundai-wia.com/business/defense_ground03.asp` |
| 4 | 4개 체계 고정 최소 사거리 | `fact` | `low` | 4개 체계 모두 고정 최소 사거리 공식 수치 `unconfirmed` (장약·고각·차폐각 가변, 사표 배제) | `unconfirmed` |
| 5 | 105mm 공산오차(PE/CEP) | `fact` | `low` | 한국군 PE 공식표 `unconfirmed`; ARES/ICRC 추정 CEP 60/97/120/163 m(5/10/15/20 km) | `https://www.icrc.org/sites/default/files/document/file_list/aresweb-generic.pdf` |
| 6 | 105mm 비과시간·초속 근거 | `fact` | `high` | 거리별 TOF 표 `unconfirmed`; KM1 초속 494 m/s, M1 Ch7 472.4 m/s·Ch5 310.9 m/s | `https://poongsan.co.kr/kor/images/catalogue.pdf` |
| 7 | 105mm 고폭탄 살상반경 | `fact` | `medium` | 자세 분리 `unconfirmed`; DAAAM 105mm M1 살상면적 500 m²(R_eq 12.62 m); ARES RED 10% 90 m | `https://www.daaam.info/Downloads/Pdfs/science_books_pdfs/2015/Sc_Book_2015-020.pdf` |
| 8 | 105mm 발사속도 | `fact` | `high` | KH178 최대 15발/분·지속 5발/분; M101/A1 최대 10발/분·지속 3발/분 | `http://www.hyundai-wia.com/business/defense_ground03.asp` |
| 9 | 105mm 방렬·진지변환 시간 | `fact` | `medium` | KH178 한국군 공식 `unconfirmed`; M101A1(FM 6-50) 정식 1분/긴급 점령 0–3:00/이탈 30초 | `https://www.bits.de/NRANEU/others/amd-us-archive/FM6-50%281976%29.pdf` |
| 10 | 105mm 신관 종류 | `fact` | `high` | 풍산 KM1(KM557 PD·KM564 MTSQ), 105/155 공용 PF500·PF302·PF600A·PF701A; US M1 PD/MTSQ/PROX/ET | `https://poongsan.co.kr/kor/images/catalogue.pdf` |
| 11 | KH179 구경·포신장·계열 | `fact` | `high` | 155mm 39구경장 견인곡사포, M198 기반 1979년 착수, M114 대체 | `http://www.hyundai-wia.com/business/defense_ground03.asp` |
| 12 | KH179/155mm 견인 사거리 | `fact` | `high` | KH179 24 km(HE)/30 km(RAP); 풍산 KM107 18.1(KM119A1)·18.8(K677), KM549A1 23.5/30.1 km, K307 33.4 km | `http://www.hyundai-wia.com/business/defense_ground03.asp` |
| 13 | 155mm 견인 공산오차·CEP | `fact` | `high` | KH179 공식 `unconfirmed`; FM 6-40 6 km 예시 PE_r 15 m·PE_d 4 m; GICHD 15–30 km CEP 95–275 m | `https://man.fas.org/dod-101/sys/land/docs/fm6-40-ch3.htm` |
| 14 | KH179 비과시간·초속 근거 | `fact` | `high` | 거리별 TOF 표 `unconfirmed`; KM107 684/706 m/s, KM549A1 678/826 m/s, K307 830 m/s | `https://poongsan.co.kr/kor/images/catalogue.pdf` |
| 15 | 155mm 고폭탄 살상반경 | `fact` | `high` | 한국군 자세 분리 `unconfirmed`; ARES 800 m², ICRC 16 m, GICHD 0–25 m/엎드림 RED 125 m | `https://www.icrc.org/sites/default/files/document_new/file_list/ewipa_explosive_weapons_with_wide_area_effect_final.pdf` |
| 16 | KH179 발사속도 | `fact` | `high` | KH179 최대 4발/분(15초)·지속 2발/분(30초), M198 동일, M777 지속 2발/분 | `http://www.hyundai-wia.com/business/defense_ground03.asp` |
| 17 | KH179 방렬·진지변환 시간 | `fact` | `medium` | KH179 방렬 최소 3분+·이탈 15–20분; 비교 M198 10–12분, M777 <3분, M114A1 2분/1분 | `https://www.segye.com/newsView/20110906003831` |
| 18 | 155mm 신관 종류 | `fact` | `high` | K519 PD(100 μs/지연 25–65 ms), KM557A1, KM732(FMCW), KM739A1, PF500/PF600A(9m)/PF701A(4–15m) | `https://poongsan.co.kr/kor/images/catalogue.pdf` |
| 19 | K55/K55A1 구경·계열 | `fact` | `high` | M109A2 면허생산(원 제식명 KM109A2), K55A1은 155mm 39구경장 개량 궤도 자주포 | `https://dapa-magazine.kr/page/vol149/16.html` |
| 20 | K55/K55A1 사거리·초속 | `fact` | `high` | K55 24 km(KM119A1 684.3 m/s); K55A1 30–32 km(KM203 826 m/s) | `https://www.defensetoday.kr/news/articleView.html?idxno=5035` |
| 21 | K55/K55A1 발사속도 | `fact` | `high` | K55(M109A2) 4발/분(3분)·지속 1발/분; K55A1 최대 4발/분·지속 2발/분 | `https://en.hyundai-wia.com/business/defense_ground01.asp` |
| 22 | K55/K55A1 방렬·이탈 시간 | `fact` | `medium` | K55 초탄 2–11분(FM 6-50 M109 30초/이탈 30초); K55A1 정지 45초·기동 75초(이탈 `unconfirmed`) | `https://www.defensetoday.kr/news/articleView.html?idxno=5035` |
| 23 | K9/K9A1 구경·포대문수·자주 | `fact` | `medium` | 155mm 52구경장 궤도식 자주곡사포; 한국군 K9/K9A1 비부대 포대 문수 `unconfirmed` | `https://en.hyundai-wia.com/business/defense_ground01.asp` |
| 24 | K9/K9A1 사거리·연장탄 | `fact` | `high` | 표준 40 km, K307+K676 41.0 km(928 m/s); 복합연장탄 +30% 이상·풍산/언론 최대 60 km(KADIS 2020 54 km) | `https://poongsan.co.kr/kor/images/catalogue.pdf` |
| 25 | K9/K9A1 발사속도 | `fact` | `high` | 급속 15초 3발(12발/분), 최대 6(현대위아·K-9/A1)–8발/분(한화EU K9·USA K9A1 3분), 지속 2–3발/분(1시간) | `https://hanwha-aerospace.eu/portfolio/k9-sph/` |
| 26 | K9/K9A1 방렬·진지변환 | `fact` | `medium` | 방렬·초탄 정지 30초·기동 60초 이내(K9A1 쇼룸/K9); 궤도형 K9 진지 이탈 초 단위 `unconfirmed`(비교: 차륜 K9MH <30s) | `https://m.hanwhaaerospace.com/kor/showroom.do` |
| 27 | K55·K9 PE·TOF·자세살상 | `fact` | `low` | K55/A1 및 K9/A1의 거리별 PE·TOF와 자세 분리 살상반경(m) 모두 `unconfirmed` | `unconfirmed` |
| 28 | 현행 게임 코드·PRD §6 모델 | `fact` | `high` | 155mm 견인 6문 W자, TOF `3+2.6d`, PE `1.5d+2`/`0.5d+1`, 간격 9초, R `26/15`·`28/24` m | `PRD/OBSERVER_PRD_v0.2.md` |
| 29 | 게임 vs FM 6-40 (6 km) 분산 | `computed` | `high` | 6 km 게임 PE_r 11 m·CEP 12.82 m vs FM 6-40 15 m·16.3 m (1.36x·1.27x 정밀; 8 km 편차 포함 62.02 m) | `https://man.fas.org/dod-101/sys/land/docs/fm6-40-ch3.htm` |
| 30 | 게임 vs GICHD 15–30 km CEP | `computed` | `high` | 15/20/25/30 km 게임 CEP 28.2–53.8 m vs GICHD 95–275 m (실제가 3.09–5.11배 넓음) | `https://www.gichd.org/fileadmin/uploads/gichd/Publications/Explosive_weapon_effects_web.pdf` |
| 31 | 게임 비과시간 vs 진공 하한 | `computed` | `medium` | 9 km 게임 26.4 s > M107/K9 진공 하한 9.7–16.2 s; 단 6 km 18.6 s < M1 Ch5 진공 20.38 s | `https://poongsan.co.kr/kor/images/catalogue.pdf` |
| 32 | 게임 살상면적 vs ICRC/DAAAM | `computed` | `high` | 게임 유효면적 PD 1,954/650 m², VT 2,129/1,529 m²; PD 서 있음은 ICRC(800–804 m²)의 2.43배 | `https://www.icrc.org/sites/default/files/document/file_list/aresweb-generic.pdf` |
| 33 | 게임 효력사 간격(9초) vs 4체계 | `computed` | `high` | 게임 9초(6.67발/분)는 KH179 최대(15초)보다 1.67배 빠르고 K9 최대(7.5–10초) 대역에 해당 | `https://www.daaam.info/Downloads/Pdfs/science_books_pdfs/2015/Sc_Book_2015-020.pdf` |
| 34 | 화포 체계 간 사거리 발전 비율 | `computed` | `high` | KH178/M101 1.30x, KH179/M114 1.64x, K55A1/K55 1.33x, K9/K55 1.71x, K9+30% 52.0–53.3 km | `https://www.dapa.go.kr/dapa/doc/selectDoc.do?bbsSeq=326&docSeq=18795&menuSeq=3069` |
| 35 | PRD §11.2(105mm) vs §4/§6 감사 | `fact` | `medium` | §11.3 첨부 원문(유용원의 군사세계) 저장소 미보유로 예문 105mm 수치 `unconfirmed`; 코드는 155mm 체급+K9급 ROF 혼재 | `PRD/OBSERVER_PRD_v0.2.md` |
| 36 | 포 프로파일 JSON 기본 설계 제언 | `proposal` | `medium` | 데모 호환 프리셋 유지 + 화포별 ROF(K9 9s vs KH179 15/30s)·비선형 원거리 분산·105/155 살상면적 분리 | `PRD/OBSERVER_PRD_v0.2.md` |
| 37 | PRD §11.2·§6 문서 정합성 제언 | `proposal` | `high` | 원문 아카이빙 없인 §11.2 교차검증 불가; §6 주석을 거리별 실측 배율(6 km 1.36x, 원거리 3–5x)로 구체화 권고 | `PRD/OBSERVER_PRD_v0.2.md` |

---

## 1. 화포 4개 체계별 공개 제원 정리

### 1.1 105mm 견인포 (`KH178`, `M101 / M101A1` 계열)

| 항목 | 확인된 공개 수치 및 근거 | 출처 |
| --- | --- | --- |
| 1. 구경 · 포대 문수 · 견인/자주 | 구경 105 mm, 포신 37구경장, **견인곡사포** (`M101` 토대 1978년 개발, 법제처 분류 '105MM 개량포'). 한국군 공개 포대 문수 `unconfirmed` (참고: 미군 BCT 105mm `M119` 포대 `6문`, 구 8문에서 전환). | [현대위아](http://www.hyundai-wia.com/business/defense_ground03.asp), [방사청 청아람 Vol. 149](https://dapa-magazine.kr/page/vol149/16.html), [법제처 별표 제3-4호](https://www.law.go.kr/LSW/flDownload.do?flSeq=167130377), `unconfirmed` (US 참조: [ATP 3-09.50](https://www.bits.de/NRANEU/others/amd-us-archive/ATP3-09-50%2816%29.pdf)) |
| 2. 사거리 (최대/최소 · 탄종/장약) | **최대**: `KH178` 14.7 km(HE), 18 km(ERBB); `KM1` 7호 장약(`494 m/s`) 11.27 km; `M101` 11,270 m(472.4 m/s) / `M1` 11,500 m(494 m/s). **고정 최소 사거리**: `unconfirmed`. | [현대위아](http://www.hyundai-wia.com/business/defense_ground03.asp), [풍산 카탈로그 PDF p.46](https://poongsan.co.kr/kor/images/catalogue.pdf), [FAS M101](https://man.fas.org/dod-101/sys/land/m101.htm), TM 43-0001-28 C11 (2003-10-27), `unconfirmed` |
| 3. 공산오차 (사거리·편의) 또는 추정 | 한국군 거리별 사거리·편의 공산오차 `unconfirmed`. 공개 모델 추정 CEP: `5 km 60 m`, `10 km 97 m`, `15 km 120 m`, `20 km 163 m`. | `unconfirmed`, [ARES/ICRC (2016-05) Table 2.5](https://www.icrc.org/sites/default/files/document/file_list/aresweb-generic.pdf) |
| 4. 비과시간 (거리별) 또는 초속 근거 | 거리별 비과시간 `unconfirmed`. **초속 근거**: `KM1` 494 m/s; `M1` Ch.7 472.4(또는 494) m/s, Ch.6 376.4 m/s, Ch.5 310.9 m/s. | `unconfirmed`, [풍산 카탈로그 PDF p.46](https://poongsan.co.kr/kor/images/catalogue.pdf), TM 43-0001-28 |
| 5. 고폭탄 살상반경 (서 있음/엎드림) | 자세 분리 살상반경(m) `unconfirmed`. 학술치: `105mm M1` 자연파편 **유효살상면적 500 m²**(등가 반경 `12.62 m`), 인명 1명 살상당 평균 `31.6발`; `ARES/ICRC` `RED 10% 90 m`, `RED 0.1% 275 m`, `MSD 550 m`. | `unconfirmed`, [DAAAM (2015) p.221, 228](https://www.daaam.info/Downloads/Pdfs/science_books_pdfs/2015/Sc_Book_2015-020.pdf), [ARES/ICRC (2016-05) Table 1.1](https://www.icrc.org/sites/default/files/document/file_list/aresweb-generic.pdf) |
| 6. 발사속도 및 효력사 간격 근거 | `KH178`: 최대 **15발/분**(4.0초/발), 지속 **5발/분**(12.0초/발). `M101`: 최대 10발/분(6.0초), 지속 3발/분(20.0초). (`M119`: 최대 8발/분 3분, 지속 3발/분 30분). | [현대위아](http://www.hyundai-wia.com/business/defense_ground03.asp), [FAS M101](https://man.fas.org/dod-101/sys/land/m101.htm), [ATP 3-09.50 Table 1-1](https://www.bits.de/NRANEU/others/amd-us-archive/ATP3-09-50%2816%29.pdf) |
| 7. 방렬 및 진지 변환 시간 | `KH178` 한국군 공식 `unconfirmed`. 원형 `M101A1`: 정식 방렬 **1분 이내**, 긴급 점령 만점 **0–3:00**(최대 3:45), 긴급 진지변환 **30초 이내**. | `unconfirmed`, [FM 6-50 (1976-07-01)](https://www.bits.de/NRANEU/others/amd-us-archive/FM6-50%281976%29.pdf) |
| 8. 신관 (순발/접근/시한) | **풍산 `KM1`(105mm)**: **순발(PD)** `KM557`, **기계시한(MTSQ)** `KM564`; **105/155mm 공용**: `PF500`(전자시한 0.5–199.9s), `PF302`(충격/지연), `PF600A`(FMCW 근접 9 m), `PF701A`(다기능 4–15 m). **미군 `M1`(105mm)**: `M557`·`M739`(PD), `M582`(MTSQ), `M732A2`(PROX), `M767`(ET). (참고: 법제처 표는 박격포·105·155 통합 열거). | [풍산 카탈로그 PDF p.46, 61–62](https://poongsan.co.kr/kor/images/catalogue.pdf), TM 43-0001-28, [법제처 별표 제3-4호](https://www.law.go.kr/LSW/flDownload.do?flSeq=167130377) |

### 1.2 155mm 견인포 `KH179` (`M114 / M198 / M777` 계열)

| 항목 | 확인된 공개 수치 및 근거 | 출처 |
| --- | --- | --- |
| 1. 구경 · 포대 문수 · 견인/자주 | 구경 155 mm, 포신 39구경장, **견인곡사포** (`M198` 토대 1979년 개발, `M114` 대체). 한국군 공식 포대 문수 직접 출처 `unconfirmed` (미군 `M777` 등 BCT 기준 `6문/포대`; 본 프로젝트 PRD §6도 6문 전제). | [현대위아](http://www.hyundai-wia.com/business/defense_ground03.asp), [방사청 청아람 Vol. 149](https://dapa-magazine.kr/page/vol149/16.html), `unconfirmed` (US 참조: [ATP 3-09.50](https://www.bits.de/NRANEU/others/amd-us-archive/ATP3-09-50%2816%29.pdf)) |
| 2. 사거리 (최대/최소 · 탄종/장약) | **최대**: `KH179` **24 km(HE), 30 km(RAP)** (세계일보 일반 20–22 km vs `M114` 14.6 km). 풍산 탄약: `KM107` 18.1 km(`KM119A1`)·18.8 km(`K677` 4호), `KM549A1` 23.5 km(`KM119A1`)·30.1 km(`KM203`), `K307 BB` 33.4 km(`KM203`). 비교 `M198` 22.4/30 km, `M777` 14.8/24/30 km. **최소 사거리**: `unconfirmed`. | [현대위아](http://www.hyundai-wia.com/business/defense_ground03.asp), [세계일보 (2011-09-07)](https://www.segye.com/newsView/20110906003831), [풍산 카탈로그 PDF p.47–48](https://poongsan.co.kr/kor/images/catalogue.pdf), [FAS M198](https://man.fas.org/dod-101/sys/land/m198.htm), [ATP 3-09.50 Table 1-1](https://www.bits.de/NRANEU/others/amd-us-archive/ATP3-09-50%2816%29.pdf), `unconfirmed` |
| 3. 공산오차 (사거리·편의) 또는 추정 | 한국군 `KH179` 전 사거리 공식 PE `unconfirmed`. 미군 교범 예시(`FM 6-40`, 6,000 m Ch.5 GB): **`PE_r = 15 m`, `PE_d = 4 m`, `PE_TB = 0.11 s`** (`CEP 16.3 m`). `GICHD(2017)` 비유도 155mm CEP: `15 km 95 m`, `20 km 115 m`, `25 km 140 m`, `30 km 275 m`. | `unconfirmed`, [FM 6-40 Ch.3 (1996-04-23)](https://man.fas.org/dod-101/sys/land/docs/fm6-40-ch3.htm), [GICHD (2017-02) p.34 Table 2](https://www.gichd.org/fileadmin/uploads/gichd/Publications/Explosive_weapon_effects_web.pdf) |
| 4. 비과시간 (거리별) 또는 초속 근거 | 거리별 비과시간 `unconfirmed`. **초속 근거**: `KM107` 684 m/s(`KM119A1`)·706 m/s(`K677`), `KM549A1` 678 m/s(`KM119A1`)·826 m/s(`KM203`), `K307` 830 m/s(`KM203`); `M107 M4` 563.0 m/s. | `unconfirmed`, [풍산 카탈로그 PDF p.47–48](https://poongsan.co.kr/kor/images/catalogue.pdf), TM 43-0001-28 |
| 5. 고폭탄 살상반경 (서 있음/엎드림) | 서 있음/엎드림 분리 한국군 공식치 `unconfirmed`. 공개: `ARES(2016)` **800 m²**(R_eq `15.96 m`); `ICRC(2022)` 단발 **`LETHAL RADIUS 16 m`**; `GICHD` 치사거리 `0–25 m`, **엎드림(`prone`) 겨울군복 병사 `RED 10% 125 m / RED 0.1% 450 m`**; `Article 36(M795)` 50 m; `UN OHCHR` 50–150 m; `DAAAM` 1명당 `13.6발`(15 km 제압 `43발`). | `unconfirmed`, [ARES/ICRC (2016)](https://www.icrc.org/sites/default/files/document/file_list/aresweb-generic.pdf), [ICRC (2022-01)](https://www.icrc.org/sites/default/files/document_new/file_list/ewipa_explosive_weapons_with_wide_area_effect_final.pdf), [GICHD (2017)](https://www.gichd.org/fileadmin/uploads/gichd/Publications/Explosive_weapon_effects_web.pdf), [Article 36](https://article36.org/assets/documents/publication_files/WAE-Harm-Table-Final-Version.pdf), [OHCHR](https://www.ohchr.org/sites/default/files/Documents/HRBodies/HRCouncil/CoIGaza/Kill_Radius_Compared.pdf), [DAAAM](https://www.daaam.info/Downloads/Pdfs/science_books_pdfs/2015/Sc_Book_2015-020.pdf) |
| 6. 발사속도 및 효력사 간격 근거 | 최대 **4발/분**(15.0초/발), 지속 **2발/분**(30.0초/발) (`M198` 동일; `M777` 지속 2발/분). | [현대위아](http://www.hyundai-wia.com/business/defense_ground03.asp), [FAS M198](https://man.fas.org/dod-101/sys/land/m198.htm), [ATP 3-09.50](https://www.bits.de/NRANEU/others/amd-us-archive/ATP3-09-50%2816%29.pdf) |
| 7. 방렬 및 진지 변환 시간 | `KH179`: 방렬 **최소 3분 이상**, 방열 해제 및 차량 견인 이탈 **15–20분** (비교 `M198` 투입 6분/방열·해제 10–12분; `M777` 3분 미만; `M114A1` 정식 2분/긴급 0–5:00/이탈 1분). | [세계일보 (2011-09-07)](https://www.segye.com/newsView/20110906003831), [DMN (2011-12-03)](https://www.defensemedianetwork.com/stories/lightweight-155-mm-howitzer-2/), [FAS M198](https://man.fas.org/dod-101/sys/land/m198.htm), [FM 6-50](https://www.bits.de/NRANEU/others/amd-us-archive/FM6-50%281976%29.pdf) |
| 8. 신관 (순발/접근/시한) | **순발/지연**: `K519`(순발 `100 μs` 이내, `KM2` 지연 `0.025–0.065s`), `KM557A1`; **근접**: `KM732`(FMCW), `PF600A`(폭발고도 **9 m**, FMCW); **전자시한**: `PF500`(0.5–199.9s); **다기능**: `KM739A1`, `PF701A`(충격/지연/시한/근접 **4·7·10·12·15 m 설정**). `GD-OTS M107`도 PD/Proximity 공용. | [풍산 카탈로그 PDF p.48, 61–62](https://poongsan.co.kr/kor/images/catalogue.pdf), [KIMST 17(4) 2014](https://www.kimst.or.kr/electronic_paper/pdf_down_other.kin?stype=journal&idx=12520), [법제처](https://www.law.go.kr/LSW/flDownload.do?flSeq=167130377), [YTN KM732](https://www.ytn.co.kr/_ln/0101_202107121140584981), [GD-OTS M107](https://www.gdots.com/wp-content/uploads/2017/11/155mm-M107-HE_US.pdf) |

### 1.3 155mm 자주포 `K55 / K55A1` (`KM109A2` 계열)

| 항목 | 확인된 공개 수치 및 근거 | 출처 |
| --- | --- | --- |
| 1. 구경 · 포대 문수 · 견인/자주 | 구경 155 mm, 포신 39구경장, **궤도식 자주곡사포** (미 `M109A2` 면허생산, 원 제식명 `KM109A2`, 개량형 `K55A1`). 한국군 공식 포대 문수 직접 출처 `unconfirmed` (미군 ABCT `M109` `6문/포대`). | [방사청 청아람 Vol. 149](https://dapa-magazine.kr/page/vol149/16.html), [현대위아 영문](https://en.hyundai-wia.com/business/defense_ground01.asp), `unconfirmed` (US 참조: [ATP 3-09.50](https://www.bits.de/NRANEU/others/amd-us-archive/ATP3-09-50%2816%29.pdf)) |
| 2. 사거리 (최대/최소 · 탄종/장약) | **최대**: `K55` **24 km**(`KM119A1` 684.3 m/s, `KM203` 사용 제한; 원형 `M109A2` 일반 18.0 km / RAP 23.5 km). `K55A1` **30 km**(현대위아) / **32 km**(디펜스투데이, `KM203` 826 m/s 허용). **최소 사거리**: `unconfirmed`. | [디펜스투데이 (2023-03-31)](https://www.defensetoday.kr/news/articleView.html?idxno=5035), [현대위아 영문](https://en.hyundai-wia.com/business/defense_ground01.asp), [FAS M109](https://man.fas.org/dod-101/sys/land/m109.htm), `unconfirmed` |
| 3. 공산오차 (사거리·편의) 또는 추정 | 공식 사거리·편의 PE `unconfirmed` (39구경장 155mm 일반 수준 참고: `FM 6-40` 6 km `15/4 m`, `GICHD` 15–30 km CEP `95–275 m`). | `unconfirmed` |
| 4. 비과시간 (거리별) 또는 초속 근거 | 거리별 비과시간 `unconfirmed`. **초속 근거**: `K55`(`KM119A1`) `684.3 m/s`, `K55A1`(`KM203`) `826 m/s`. | `unconfirmed`, [디펜스투데이 (2023-03-31)](https://www.defensetoday.kr/news/articleView.html?idxno=5035) |
| 5. 고폭탄 살상반경 (서 있음/엎드림) | 자세 분리 한국군 공식치 `unconfirmed` (155mm 공용 탄약: `ARES` 800 m², `ICRC` 16 m, `GICHD` 0–25 m / 엎드림 `RED` 125 m). | `unconfirmed` (공용 155mm 출처 1.2와 동일) |
| 6. 발사속도 및 효력사 간격 근거 | `K55` (`M109A2`): 최대 **4발/분**(3분간), 지속 **1발/분**(60분간). `K55A1` (반자동 급속장전): 최대 **4발/분**(15.0초/발), 지속 **2발/분**(30.0초/발). | [현대위아 영문](https://en.hyundai-wia.com/business/defense_ground01.asp), [FAS M109](https://man.fas.org/dod-101/sys/land/m109.htm), [디펜스투데이 (2023-03-31)](https://www.defensetoday.kr/news/articleView.html?idxno=5035), [ATP 3-09.50](https://www.bits.de/NRANEU/others/amd-us-archive/ATP3-09-50%2816%29.pdf) |
| 7. 방렬 및 진지 변환 시간 | `K55`: 스페이드 고정 등 초탄 발사 **2–11분** (미 `M109/A1` `FM 6-50` 정식 방렬 **30초**, 진지변환 **30초**). `K55A1`: 정지 시 **45초 이내**, 기동 시 **75초 이내** 초탄 발사 (`K55A1` 별도 이탈 시간 `unconfirmed`). | [디펜스투데이 (2023-03-31)](https://www.defensetoday.kr/news/articleView.html?idxno=5035), [FM 6-50](https://www.bits.de/NRANEU/others/amd-us-archive/FM6-50%281976%29.pdf), `unconfirmed` |
| 8. 신관 (순발/접근/시한) | 155mm 공용: `K519` PD, `KM557A1` PD, `KM732` 근접(FMCW), `KM739A1`, `PF500` 시한, `PF600A` 근접(9 m), `PF701A` 다기능(4–15 m). | [풍산 카탈로그](https://poongsan.co.kr/kor/images/catalogue.pdf), [법제처](https://www.law.go.kr/LSW/flDownload.do?flSeq=167130377), [YTN](https://www.ytn.co.kr/_ln/0101_202107121140584981) |

### 1.4 155mm 자주포 `K9 / K9A1`

| 항목 | 확인된 공개 수치 및 근거 | 출처 |
| --- | --- | --- |
| 1. 구경 · 포대 문수 · 견인/자주 | 구경 155 mm, 포신 **52구경장**, **궤도식 자주곡사포**. 한국군 `K9/K9A1` 비부대 공식 포대 문수 `unconfirmed` (실부대 보도 및 해외 파생형 호주 AS9 사례는 기준상 제외). | [현대위아 영문](https://en.hyundai-wia.com/business/defense_ground01.asp), `unconfirmed` |
| 2. 사거리 (최대/최소 · 탄종/장약) | **최대**: 표준 **40 km**, `K307 BB` + `K676` 장약 **41.0 km**(`928 m/s`). 복합추진(BB+RAP) 사거리 연장탄 **현재보다 30% 이상 연장**(산술 `52.0–53.3 km+`; `KADIS 2020` 계획치 `54 km`; 풍산·언론 `최대 60 km 수준`). **최소 사거리**: `unconfirmed`. | [한화 Aerospace EU](https://hanwha-aerospace.eu/portfolio/k9-sph/), [현대위아 영문](https://en.hyundai-wia.com/business/defense_ground01.asp), [풍산 카탈로그 PDF p.48](https://poongsan.co.kr/kor/images/catalogue.pdf), [방사청 docSeq=18795](https://www.dapa.go.kr/dapa/doc/selectDoc.do?bbsSeq=326&docSeq=18795&menuSeq=3069), [SPNews](https://www.spnews.co.kr/news/articleView.html?idxno=76470), [뉴스핌](https://www.newspim.com/news/view/20260406000571), [KADIS (2020-12) p.11](https://www.kadis.or.kr/module/file-download/329), `unconfirmed` |
| 3. 공산오차 (사거리·편의) 또는 추정 | 공식 사거리·편의 PE `unconfirmed` (참고: `GICHD` 30 km 155mm 비유도 CEP `275 m`). | `unconfirmed` |
| 4. 비과시간 (거리별) 또는 초속 근거 | 거리별 비과시간 `unconfirmed`. **초속 근거**: `K307` + `K676` 장약 **`928 m/s`**. | `unconfirmed`, [풍산 카탈로그 PDF p.48](https://poongsan.co.kr/kor/images/catalogue.pdf) |
| 5. 고폭탄 살상반경 (서 있음/엎드림) | 자세 분리 한국군 공식치 `unconfirmed` (155mm 공용 `ARES 800 m²` / `ICRC 16 m` / `GICHD` 동일). | `unconfirmed` (공용 155mm 출처 1.2와 동일) |
| 6. 발사속도 및 효력사 간격 근거 | **급속(Burst)**: **15초 이내 3발**(12발/분, 5.0초 간격); **최대(Max)**: **6발/분**(현대위아 `K9`, 디펜스투데이 `K-9`/`K-9A1` 3분간) 또는 **6–8발/분(3분간)**(한화EU `K9`, 한화USA `K9A1`, `KADIS 2020` `K9`); **지속(Sustained)**: **2발/분**(현대위아·`K-9A1` 1시간) 또는 **2–3발/분**(한화USA `K9A1` 1시간). | [한화 Aerospace EU](https://hanwha-aerospace.eu/portfolio/k9-sph/), [한화 Defense USA (`K9A1`)](https://hanwhadefenseusa.com/land-systems), [현대위아 영문](https://en.hyundai-wia.com/business/defense_ground01.asp), [디펜스투데이 idxno=657](https://www.defensetoday.kr/news/articleView.html?idxno=657), [KADIS (2020-12) p.10](https://www.kadis.or.kr/module/file-download/329) |
| 7. 방렬 및 진지 변환 시간 | **방렬·초탄 발사**: 정지 간 **30초 이내**, 기동 간 **60초(1분) 이내**(`K9A1` 쇼룸, 한화EU `K9` `<60s`, 디펜스투데이 `K-9`/`K-9A1`); **궤도형 `K9/K9A1` 독립 진지 이탈 초 단위 `unconfirmed`**(쇼룸 `'신속한 진지 이탈'`, `KADIS 2022` 수치 `0` 마스킹. 비교 참고: 한화USA 8x8 차륜형 `K9MH` 방렬·이탈 `<30초`, `KADIS 2020` 남아공 `G6` 차륜형 `30초`). | [한화 쇼룸 (`K9A1`)](https://m.hanwhaaerospace.com/kor/showroom.do), [한화 Aerospace EU (`K9`)](https://hanwha-aerospace.eu/portfolio/k9-sph/), [디펜스투데이 idxno=657](https://www.defensetoday.kr/news/articleView.html?idxno=657), `unconfirmed` (비교: [한화USA `K9MH`](https://hanwhadefenseusa.com/land-systems)) |
| 8. 신관 (순발/접근/시한) | 155mm 공용: `K519` PD, `KM557A1` PD, `KM732` 근접(FMCW), `KM739A1`, `PF500`, `PF600A`(9 m), `PF701A`(4–15 m). | [풍산 카탈로그](https://poongsan.co.kr/kor/images/catalogue.pdf), [법제처](https://www.law.go.kr/LSW/flDownload.do?flSeq=167130377), [YTN](https://www.ytn.co.kr/_ln/0101_202107121140584981) |

---

## 2. 게임 모델(`PRD §6` · `src/sim/`) vs 공개 155mm 견인포 수치 비교 (`computed`)

현행 게임 코드는 `src/content/guns.ts`에 `BASE_GUNS` 식별자만 두고, 실제 수치 상수는 `src/sim/ballistics.ts`, `src/sim/lethality.ts`, `src/sim/procedure.ts`와 [OBSERVER PRD v0.2](PRD/OBSERVER_PRD_v0.2.md) §6에 정의되어 있다. 아래 비교 수치는 모두 파이썬 스크립트로 산출했다(`cross-check not run: needs scipy/ballistics library`).

| 비교 영역 | 게임 수치 (PRD §6 / `src/sim/`) | 공개 155mm 견인·일반 155mm 비교치 | 차이·배율 (`computed`) | 해석 |
| --- | --- | --- | --- | --- |
| 포대 편제·방렬 | 155mm 견인포 **6문**, W자(횡 120 m × 종 44 m, 좌우 24 m 간격) (`src/sim/ballistics.ts:13`) | `ATP 3-09.50` 여단전투단 155mm 6문/포대 | 문수 **미군 BCT와 일치 (6문)** | 한국군 비부대 공식 편제 문수(`KH179`·`K9` 등)는 `unconfirmed` |
| 공산오차 (6 km 순수 분산) | `PE_r = 11.0 m`, `PE_d = 4.0 m`, 단일탄 `CEP = 12.82 m` (8 km: `PE_r 14 m`, `CEP 16.23 m`; 비표준 오차 30–90 m 포함 시 `62.02 m`) | `FM 6-40` Ch.3 (6 km Ch.5GB): `PE_r = 15.0 m`, `PE_d = 4.0 m`, `CEP = 16.3 m` | `PE_r`: 실제가 게임의 **1.36배**; `CEP`: **1.27배** (`PE_d` 4.0 m 동일) | 6 km에서는 PRD §6 주석("약 2배 정밀")보다 실제와의 차이가 작음 |
| 공산오차 (15–30 km 원거리) | 선형식 `1.5d+2` / `0.5d+1` 기준 단일탄 `CEP`: 15 km `28.19 m`, 20 km `36.73 m`, 25 km `45.27 m`, 30 km `53.82 m` | `GICHD(2017)` Table 2 155mm 비유도 CEP: `95 / 115 / 140 / 275 m` (`ICRC 2022` 25 km 140 m) | 실제 CEP가 게임의 **3.37 / 3.13 / 3.09 / 5.11배** | 원거리로 갈수록 선형 PE 식이 실제보다 훨씬 더 정밀해짐(3–5배) |
| 비과시간 (TOF) vs 진공 하한 | `tofSec(d) = 3 + 2.6*(d/1000)`: 3 km `10.8 s`, 6 km `18.6 s`, 9 km `26.4 s`, 15 km `42.0 s` (`src/sim/ballistics.ts:16`) | 진공탄도 물리 하한(`TOF_vac`): 9 km `KH179(684 m/s) >= 13.21 s`, `M107 M4(563 m/s) >= 16.15 s`, `105mm Ch7 >= 19.45 s`, `K9(928 m/s) >= 9.71 s` | 9 km에서 게임 26.4 s는 155mm 진공 하한 대비 1.63–2.00배 (공기저항 고려 타당 범위). 단 6 km 18.6 s < `105mm Ch5(310.9 m/s)` 진공 하한 `20.38 s` | 동일 선형식을 105mm 저장약·K9 고초속에 공용하면 물리 오차 커짐 |
| 살상반경 · 유효살상면적 | `0.92 * exp(-(r/R)^2)` (`REACH_M 110 m`, `VT_HEIGHT_M 7 m`): `PD` R `26/15 m` (유효면적 `1,953.82 / 650.31 m²`, R_eq `24.94 / 14.39 m`), `VT` R `28/24 m` (`2,128.68 / 1,529.03 m²`, R_eq `26.03 / 22.06 m`) (`src/sim/lethality.ts:7-25`) | `ARES/ICRC(2016)` 155mm **800 m²**, `ICRC(2022)` 단발 **16 m**(804.25 m²); `GICHD` 0–25 m & 엎드림 `RED 125 m`; `Article 36` 50 m | `PD 서 있음(1,953.82 m²)`은 ICRC의 **2.43배**; `PD 엎드림(650.31 m²)`은 **0.81배**. 게임 내 `PD 서있음/엎드림 = 3.00x`, `엎드림 VT/PD = 2.35x` | 게임의 **PD 엎드림(R_eq 14.39 m)만 ICRC 16 m와 비슷**하고, PD 서 있음 및 VT는 약 1.9–2.65배 치명적. VT의 대(對)엎드림 2.35배 상승은 NSWC("공중폭발 최대 2배 면적") 보고 방향과 일치 |
| 효력사 발사 간격 & 소요탄수 | 문당 **9.0초** (`6.667발/분`, 지터 2.2초; 3발 일제 18.0초, 총 18발) (`src/sim/procedure.ts:44-45`) | `KH179` 최대 **4발/분(15.0초)**·지속 **2발/분(30.0초)**; `K55A1` 15/30초; `K9` 최대 **6–8발/분(7.5–10.0초)**; `KH178` 15/5발/분(4/12초). `DAAAM` 15 km `M107` 제압 43발 | 게임 9.0초는 **`KH179` 최대보다 1.67배, 지속보다 3.33배 빠름** (`K9` 최대 대역과 일치). `DAAAM` 43발은 게임 18발의 **2.39배** | 게임은 155mm 견인포(`KH179`)로 설정됐지만 **효력사 발사속도는 K9급** |
| (미구현) 방렬·진지변환 | 게임 내 포대 고정(방렬 완료 상태 시작; 관측반 설치 30초) | `KH179` 방렬 3분+ / 이탈 15–20분 vs `K55` 2–11분 / `K55A1` 정지 45·기동 75초 / `K9·K9A1` 정지 30·기동 60초 (궤도형 이탈 초 단위 `unconfirmed`, 비교: 차륜 `K9MH` <30초) | 방렬·초탄 기준 `KH179` 3분+ vs `K9` 30초 **6배+** (이탈은 `K9` 궤도형 초 단위 `unconfirmed`; 견인 15–20분 vs 차륜 `K9MH` <30초는 30–40배) | 후속 포 프로파일 JSON에서 대포병 회피·재배치 시나리오 도입 시 핵심 변수 |

---

## 3. PRD §11.2 (`"예문의 명중률 수치는 105mm 기준"`) vs §4·§6·§11.3 감사

1. **문서 간 진술 대조** ([OBSERVER PRD v0.2](PRD/OBSERVER_PRD_v0.2.md)):
   - `§11.2`(L536): `"포의 기준: 데모는 155mm 견인포지만 예문의 명중률 수치는 105mm 기준. 포 프로파일 JSON(7.2)으로 선택형 — 기본값을 무엇으로 할지"`
   - `§11.3`(L553): `"제공받은 교신 예문: 조선일보 유용원의 군사세계 게시글 본문(사용자 첨부 텍스트)"`
   - `§6`(L260–270): 데모 탄도·살상 수치는 `155mm 견인포 6문` 기준이며 사거리 공산오차 주석(L262)에 `"실제 155mm보다 약 2배 정밀 — 게임 조정값"`이라 명기됨.
2. **예문 원문 확인 한계 (`unconfirmed`)**:
   - `§11.3`이 지목한 "사용자 첨부 텍스트(유용원의 군사세계 게시글)" 원문은 본 저장소에 포함되어 있지 않으며, 작업지시에 따라 해당 커뮤니티 원문을 외부 재검색·추정 복원하지 않았다.
   - `§4.1` 용어표(L59–97)에서 `"예문"`으로 인용된 부분은 호출, 수정사격, 사격규모("포대 삼발"), 신관("접근/순발/충격신관"), 지명사("준비 쏴") 등 **교신 형식뿐이며, '105mm 명중률 수치' 자체는 PRD 본문(L1–615) 어디에도 수록되어 있지 않다.** 따라서 예문 속 105mm 수치의 원형은 **`unconfirmed`** 다.
3. **현행 코드 수치를 통한 구경·체계 혼재 진단**:
   - **살상력·편제**: PD 엎드림 등가반경 `14.39 m`는 `105mm DAAAM(12.62 m)`보다 `155mm ICRC(16 m)` 쪽에 가깝고(PD 서 있음/VT는 그 약 1.9–2.65배), 6문 W자 `120×44 m` 편제와 함께 **155mm 포대** 성격이다.
   - **명중률(PE)**: `6 km` 기준 `PE_r 11 m`는 `FM 6-40` 155mm(`15 m`)의 1.36배로 PRD의 `"약 2배"`보다 차이가 작은 반면, 15–30 km에서는 `GICHD` 155mm CEP 대비 `3.09–5.11배` 좁다. 참고로 `ARES/ICRC(2016)`상 `105mm` 추정 CEP(5/10/15 km `60/97/120 m`)와 `155mm GICHD` CEP(15 km `95 m`) 간에는 큰 차이가 없고, 선형식 `1.5 m/km + 2 m`는 어느 실물 화포의 사거리 곡선과도 일치하지 않는 게임용 간략식이다.
   - **발사속도**: `9초` 간격(`6.67발/분`)은 `KH179`(155mm 견인, 최대 4발/분)보다 `K9`(최대 6–8발/분) 또는 `KH178`(105mm 지속 5발/분·최대 15발/분 사이)에 더 가깝다.

---

## 확인 불가 (`unconfirmed`) 항목

아래 7개 범주는 공개 1차·OEM·군 교범·학술 자료를 교차 확인했으나, **사표(firing table, `사표`) 미조회·미인용 원칙** 및 **비공개 교범 부재**로 인해 공식 수치를 확인할 수 없어 `unconfirmed`로 남겼다.

1. **4개 체계(`KH178`, `KH179`, `K55/A1`, `K9/A1`) 고정 최소 사거리**
   - *조회한 출처*: 현대위아 국·영문 제원표, 한화USA·한화EU, 풍산 카탈로그, 방사청 보도자료/청아람, `ATP 3-09.50`, `FM 6-50`, `TM 43-0001-28`.
   - *사유*: 모든 OEM 제원표는 최대 사거리만 공표하며, 간접사격 최소 사거리는 1호 장약·최소 고각·지형 차폐각(`ATP 3-09.50` Ch.8 최소고각 계산 절차)에 따라 달라지는 사표 산출 영역이므로 고정 수치 확인 불가.
   - *충족 요건*: 합참/육군 공개 제원서 또는 각 화포 운용 교범의 장약 1호·저고각 한계 명기.
2. **4개 체계의 거리별 사거리·편의 공산오차 (`PE_r`, `PE_d`)**
   - *조회한 출처*: 현대위아, 한화, 풍산, `FM 6-40` Ch.3, `GICHD(2017)`, `ARES/ICRC(2016)`.
   - *사유*: 한국군 화포·장약·포탄 조합의 거리별 PE 표는 사표(FT) 고유 데이터로 작업지시상 조회·재구성 금지 대상임. (`FM 6-40` 6 km `15/4 m` 단일 교범 예시 및 `ARES`/`GICHD` 비유도 일반 CEP만 대체 참고 가능.)
   - *충족 요건*: 사표 비지정 범위 내에서 국방과학연구소(ADD)/방사청이 탄약별 분산 스펙트럼을 논문·보도자료로 공개 발표할 경우 보완 가능.
3. **4개 체계의 거리별 비과시간 (`TOF`)**
   - *조회한 출처*: 풍산 카탈로그(포구초속), `TM 43-0001-28`, `FM 6-40`, 디펜스투데이(`K55A1`).
   - *사유*: 거리-고각-장약별 실측 비과시간은 사표 테이블 데이터임. (대체 근거로 각 체계 최대·주요 장약 포구초속 `310.9–928 m/s`와 영항력 진공탄도 하한만 제시.)
   - *충족 요건*: 사표 이외의 공식 비행시간 근사식 또는 탄도 성능 곡선이 공개 학술 논문에 게재될 경우.
4. **한국군 105mm/155mm 고폭탄의 서 있음 vs 엎드림 분리 살상반경 (`m`)**
   - *조회한 출처*: 풍산 카탈로그, `ARES/ICRC(2016)`, `ICRC(2022)`, `GICHD(2017)`, `DAAAM(2015)`, `Article 36`, `UN OHCHR`.
   - *사유*: 공개 문헌은 단일 유효살상면적(`500 m²`, `800 m²`/`16 m`) 또는 특정 자세 단일 지표(`GICHD` 엎드림 병사 `RED 10% 125 m`, `0–25 m`)만 보고하며, 동일 무기 모델 내에서 서 있음 반경과 엎드림 반경을 한 표로 분리 제시한 1차 자료가 부재함.
   - *충족 요건*: 국방규격 또는 미군 `JMEM`(합동탄약효과교범) 비분류 요약 치사반경 공개문.
5. **한국군 `KH178`·`KH179`·`K55`·`K9/K9A1` 공식 비부대 포대 문수 직접 출처**
   - *조회한 출처*: 현대위아 국·영문, 한화, 방사청, 법제처, `ATP 3-09.50`(미군 BCT 6문/포대), 일반 언론.
   - *사유*: 특정 실부대명을 밝히는 보도나 해외 수출 파생형(호주 `AS9` 등) 사례는 기준상 한국군 공식 비부대 편제 근거로 채택할 수 없으며, 비부대 공개 문서 중 `KH178`·`KH179`·`K55`·`K9/K9A1` 한국군 포대 문수를 직접 명시한 1차 자료는 찾지 못함.
   - *충족 요건*: 국방부·육군 공식 비부대 교범·편제 요약·보도자료 내 105mm/KH179/K55/K9 포대 문수 명기.
6. **`KH178` 전용 방렬/진지변환 시간 및 `K55A1`·`K9/K9A1`(궤도형) 진지변환(이탈) 초 단위 시간**
   - *조회한 출처*: 현대위아, 세계일보, 디펜스투데이, 한화 쇼룸(`K9A1`)·한화EU(`K9`)·한화USA(`K9MH`), `KADIS 2020/2022`, `FM 6-50(1976)`.
   - *사유*: `KH179`(방렬 3분+/이탈 15–20분), `K55`(초탄 2–11분), `K55A1`(정지 45초/기동 75초), `K9/K9A1`(정지 30초/기동 60초 초탄)은 확인되었으나 `KH178`(원형 `M101A1` 1분/30초로만 대체 참조) 및 `K55A1`·궤도형 `K9/K9A1` 본체의 독립 진지 이탈 초 단위 시간은 공개 미확인(`한화 쇼룸` 정성 표현 '신속한 진지 이탈', `KADIS 2022` `0` 마스킹; `<30초`는 8x8 차륜형 `K9MH` 수치).
   - *충족 요건*: 육군 포병 교범(야전포병 전술·포대 운용) 공개본 또는 `K55A1`/`K9` 사업 백서.
7. **`PRD §11.2` 언급 교신 예문의 '105mm 명중률 수치' 원형**
   - *조회한 출처*: `PRD/OBSERVER_PRD_v0.2.md`, `GLOSSARY.md`, `src/sim/ballistics.ts`, `src/sim/lethality.ts`, `src/sim/procedure.ts`, `src/content/guns.ts`.
   - *사유*: `§11.3`의 사용자 첨부 원본("조선일보 유용원의 군사세계 게시글")이 저장소에 없고 외부 복원이 금지되어 원 수치 대조 불가.

---

## 4. 제언 (`proposal`)

1. **`PRD §7.2` 포 프로파일 JSON 도입 시 화포별 기본값 분리**:
   - 데모 M1 회귀 기준(`GLOSSARY.md` 동작 기준) 보존을 위해 현행 `src/sim/` 수치는 `demo-155` 호환 프로파일로 유지한다.
   - 신규 시나리오용 `105mm(KH178)`·`155mm 견인(KH179)`·`155mm 자주(K55/K55A1, K9/K9A1)` 프로파일 JSON에는 ① 효력사 간격을 화포별 실사격 속도(`KH178` 4–12초, `KH179`/`K55A1` 최대 15초·지속 30초, `K9` 최대 7.5–10초)로 분리하고, ② 원거리(15–30 km) 공산오차가 선형(`1.5 m/km`)보다 가파르게 증가하도록 비선형 보정 계수를 추가하며, ③ 105mm(`R_eq 12.62 m`)와 155mm(`ICRC 16 m` vs 현행 PD 서 있음 `24.94 m`)의 살상반경 배율을 재조정할 것을 제안한다.
2. **문서 정합성 정리 (`PRD/OBSERVER_PRD_v0.2.md`)**:
   - `§11.3` 첨부 교신 원문을 저장소 `_notes/` 등에 아카이빙하지 않을 경우 `§11.2`의 '105mm 명중률' 근거 추적이 불가능하므로 원문 아카이빙 또는 항목 갱신을 권고한다.
   - `§6` L262 주석(`"실제 155mm보다 약 2배 정밀"`)을 거리별 실제 비교치(6 km에서는 `FM 6-40` 대비 1.36배 정밀, 15–30 km에서는 `GICHD` 대비 3.1–5.1배 정밀, 효력사 9초 간격은 `K9`급)로 정정해 후속 밸런스 튜닝 혼선을 방지할 것을 제안한다.
