# 조사 보고서: 데모 v0.2(`PRD/OBSERVER_demo_v0.2.html`) 코드 인벤토리와 PRD v0.2 불일치 목록

- **작업 지시서:** `research-3-o1` (`.routing/tasks/research-2-5.json:65-117`)
- **대상 이슈:** GitHub Issue #3 (`조사: 데모 v0.2 코드 인벤토리와 PRD 불일치 목록`, 블로킹 대상: #8, #9, #10, #14)
- **조사 일자:** `2026-11-06` (입력 커밋 `a2b3c48`)
- **조사 범위:** 저장소 전용(`PRD/OBSERVER_demo_v0.2.html`, `PRD/OBSERVER_PRD_v0.2.md`, 워킹트리 전체)

---

## 1. `PRD/OBSERVER_demo_v0.2.html` 코드 인벤토리

데모 v0.2는 외부 번들러·라이브러리 없이 단일 HTML 파일(`1~1562행`)의 `<script>` 안 단일 IIFE(`PRD/OBSERVER_demo_v0.2.html:176-1559`)에 모든 상태·시뮬레이션·교신·렌더링·UI·목업 네트워크 코드를 담고 있다.

### 1.1 전역 상태 (IIFE 최상위 상수·가변 상태·배열·객체)

| 분류 | 식별자 | 초기값 / 타입 | 역할 및 출처 |
| --- | --- | --- | --- |
| **수학·포맷 유틸** | `$`, `TAU`, `MIL`, `AD`, `DIR16` | `document.querySelector`, `2π`, `6400/2π`, 포병 숫자 10개, 16방위 한글 | DOM 선택자, 각도·밀 변환(`PRD/OBSERVER_demo_v0.2.html:178-181`), 숫자·방위 표기(`PRD/OBSERVER_demo_v0.2.html:311,339`) |
| **시드·난수** | `URLSEED`, `SEED_KIND`, `SEED` | `?seed=` 파라미터, `'custom'\|'daily'`, 32비트 정수(일일 시드는 KST `YYYYMMDD`) | 연습/일일 시드 분기(`PRD/OBSERVER_demo_v0.2.html:186-189`) |
| **난수 스트림** | `RNG` (`rS,rB,rF,rE,rA`, `gS,gB,gA,gE`) | `mulberry32` 5개 스트림 + Box-Muller 가우시안 4개(`gF` 없음) | 용도별 분리 난수(`PRD/OBSERVER_demo_v0.2.html:190-193`) |
| **틱·입력 기록** | `INPUTS`, `tick`, `STEP`, `acc`, `camLog` | `[]`, `0`, `0.05`(50 ms), `0`, `{h:NaN,p:NaN}` | 틱 카운터, 고정 스텝 누적기, 입력 로그 배열, 쌍안경 조준각 변화 감지(`PRD/OBSERVER_demo_v0.2.html:196-197,1325-1327`) |
| **지형·정적 구조물** | `N=1024`, `CELL=10`, `SIZE=10240`, `GROUND`, `SURF`, `BLD`, `CR/CG/CB`, `BR/BG/BB`, `FOREST`, `ROAD`, `VILL`, `VILLAGES`, `ROADS` | `Float32Array(1048576)` 3개, `Uint8Array(1048576)` 9개, 마을 7곳, 도로 6개 | 10.24 km 정사각 높이맵(지면·표면·건물), 조명 전후 RGB, 숲/도로/마을 마스크(`PRD/OBSERVER_demo_v0.2.html:201-238`) |
| **전장 좌표·관측소** | `OBS`, `OPS`, `EYE_H=3.5`, `FRONT_Y=3650`, `PLANNED_OP`, `FRIEND`, `BATT`, `GZD='CH'`, `E0=40000`, `N0=30000` | `OBS={x:5120,y:1800}`, `BATT={x:4200,y:-4600}`, 아군 3소대 진지 | 실제 관측소 위치(`OBS`), 이동·설치·FDC 인지 위치 상태(`OPS`, 실행 중 `picked`, `stale`, `skipReport`, `compromised` 동적 추가), 방안좌표 원점(`PRD/OBSERVER_demo_v0.2.html:204-211,622,898,1015,1427`) |
| **기상** | `WX_PRESETS`, `WX`, `WV`, `SIGMA` | 프리셋 5종(`clear,haze,rain,wind,fog`), 현재 기상 객체, 바람 벡터 `{x,y}`, `3.912/WX.visibility` | 시정(코슈미더 계수 `SIGMA`), 구름, 바람, 기온, 강수(`PRD/OBSERVER_demo_v0.2.html:331-351`) |
| **시뮬레이션·전투** | `CS`, `clearT`, `trainUsed`, `opsStartReal`(미사용), `simT`, `paused`, `simSpeed`, `trainMode`, `score`, `ammoUsed`, `ended`, `endAt`, `OPS_LIMIT=2400`, `phase`, `SCN` | `'갈매기'`, `null`, `false`, `0`, `true`, `2`(×2), `true`, `0`, `0`, `false`, `'prep'` | 작전 단계(`'prep'\|'live'`), 모의 시각(`simT`), 점수·탄수, 시나리오 실제 배치(`SCN={second,apcR,reconR,mo}`)(`PRD/OBSERVER_demo_v0.2.html:398-404,423,1346`) |
| **전투 엔티티·배열** | `events`, `platoons`, `effects`, `impacts`, `lases`, `missions`, `friendlies`, `FRIEND_PIN` | 배열 8개 | 예약 이벤트 큐, 적 부대 5개, 연기/먼지/섬광/폭발 이펙트, 탄착점, 최근 레이저 5건, 사격 임무, 아군 보병 72명+트럭 1대, 아군 소대 피탄 시각(`PRD/OBSERVER_demo_v0.2.html:400-403,570`) |
| **전투 수치·집계** | `tcount`, `romerPin`, `friendlyHits`, `dangerMiss`, `friendlyMortar`, `apcBursts`, `friendlyLoss`, `NEUT=0.30`, `DESTROY=0.60`, `DET_MIL={eye:1.5,bino:0.3}`, `obsLost`, `obsLostReason`, `SHEAF` | 카운터 및 상수 | 표적 번호(`T1..`), 좌표자 핀, 감점·피해 집계, 무력화/파괴 임계값, 탐지 각크기, 관측반 손실 여부, 6문 W자 방렬 오프셋(`PRD/OBSERVER_demo_v0.2.html:404,492,509,538,609,671`) |
| **교신·오디오·음성** | `R`, `tnSeq=1000`, `AC`, `noiseBuf`, `muted`, `ttsOn` | 상태 기계 객체, 표적번호 시퀀스, Web Audio / TTS 상태 | 사격요구 상태 기계(`R`), `AB1001+` 발번, 폭음·무전 스퀠치, 브라우저 음성 합성(`PRD/OBSERVER_demo_v0.2.html:674,688,693-694`) |
| **렌더·지도·UI·넷** | `VW=640`, `VH=360`, `RK`(미사용), `low/lctx/img/pix/pix32/ybuf/dbuf`, `vc/vctx`, `cam`, `camZ`, `V`, `FOG`, `SKY`, `BAYER`, `maskCanvas`, `spriteList`, `mc/mctx`, `mapBase`, `vsCanvas`, `showVS`, `MV`, `CLIENT_VER`, `NET`, `RESERVED_CS`, `MOCK_RUNS`, `BOARDS` | 캔버스·버퍼·뷰포트·랭킹 상수 | 보셀 렌더러 버퍼, 카메라(`{h,p,binoc}`), 지도 뷰포트(`MV={z,x0,y0}`), 오프라인/온라인 네트워크 어댑터(`PRD/OBSERVER_demo_v0.2.html:320-329,1101,1234,1257,1452-1502`) |

---

### 1.2 `simStep()` 및 메인 프레임 루프 (`PRD/OBSERVER_demo_v0.2.html:1325-1353`)

- **프레임 루프(`frame(now)`, `1336-1345행`):**
  - `dt = Math.min(0.1, (now - last) / 1000)`에 배속 `simSpeed`(`1, 2, 4, 8`)를 곱해 누적기 `acc`에 더한다(`PRD/OBSERVER_demo_v0.2.html:1337-1338`).
  - `while (acc >= STEP && n < 40)`으로 50 ms 단위 `simStep()`을 프레임당 최대 40회 실행하며, `n >= 40`이면 남은 `acc`를 `0`으로 버린다(`PRD/OBSERVER_demo_v0.2.html:1338`).
  - 이후 화면 크기 동기화(`resize()`), 지형·능선·스프라이트·포스터화·오버레이 렌더링, 120 ms 간격 지도 갱신(`drawMap()`), 400 ms 간격 상단 HUD·표적 목록 DOM 갱신을 수행한다(`PRD/OBSERVER_demo_v0.2.html:1339-1344`).
- **`simStep()` 내부 실행 순서 (`1328-1334행`):**
  1. `tick++; simT = tick * STEP;` (`STEP = 0.05`초)(`PRD/OBSERVER_demo_v0.2.html:1329`)
  2. `camZ = sampleH(GROUND, OBS.x, OBS.y) + EYE_H;` — 관측 눈높이 고도 갱신(`PRD/OBSERVER_demo_v0.2.html:1329`)
  3. `if (cam.binoc && phase === 'live') logCam();` — 쌍안경 사용 중 방위각·고저각이 마지막 기록 대비 1밀 이상 변했으면 `{t:tick, a:'cam', v:[h,p]}` 기록(`PRD/OBSERVER_demo_v0.2.html:1327,1330`)
  4. `updateOP(STEP);` — 관측소 도보 이동 보간 및 도착 후 장비 설치 30초 진행(`PRD/OBSERVER_demo_v0.2.html:877-890,1331`)
  5. `for (const P of platoons) updatePlatoon(P, STEP);` — 적 5개 부대 출현·이동·대형 전개·돌격·진지 돌파·장갑차 직사·박격포 사격·구성원 좌표 갱신(`PRD/OBSERVER_demo_v0.2.html:454-485,1331`)
  6. `updateFriendly(STEP);` — 아군 보급 트럭 왕복/대피, 아군 보병 이동/응사, 600 m 내 적 보병에 대한 아군 직사화기 살상, 400 m 내 적 보병에 의한 아군 손실(`PRD/OBSERVER_demo_v0.2.html:579-606,1331`)
  7. `updateVisibility(tick % 6 === 0);` — 6틱(0.3초)마다 전체 적·아군·이펙트의 가시성(`vis`) 재계산, 그 외 틱에는 새로 추가된(`e.vis === undefined`) 이펙트만 즉시 계산(`PRD/OBSERVER_demo_v0.2.html:546-552,1332`)
  8. `updateIntel(STEP);` — 쌍안경 시야 중심부(`±BINO_FOV*0.42`) 안의 가시 적 구성원·포신·연기/먼지 신호를 집계해 `stage 1→2→3` 적정 진행(`PRD/OBSERVER_demo_v0.2.html:553-567,1333`)
  9. `if (tick % 100 === 0) exposureTick();` — 100틱(5초)마다 1.1 km 내 적 부대에 의한 관측소 발각 판정(`PRD/OBSERVER_demo_v0.2.html:610-620,1333`)
  10. `runEvents();` — `events` 큐에서 `t <= simT`인 모든 예약 콜백 실행(`PRD/OBSERVER_demo_v0.2.html:402,1333`)
  11. `checkEnd();` — 정찰조 제외 모든 적 부대 무력화/파괴/돌파 완료(교신 비통화 중) 또는 `simT > 2400`초 도달 시 8초 유예 후 `endGame()` 호출(`PRD/OBSERVER_demo_v0.2.html:1333,1347-1353`)

---

### 1.3 `R` 교신 상태 기계 (`PRD/OBSERVER_demo_v0.2.html:693-847`)

- **컨텍스트 객체 `R` (`693, 789행`):**
  - `state`: 현재 상태(`'IDLE' | 'WAIT' | 'LOC' | 'DESC' | 'AMC' | 'FLIGHT' | 'ADJ' | 'EOM'`, 총 8개)
  - `m`: 현재 활성 임무 객체(`newMission(warn)`이 생성, `IDLE`에서는 `null`)
  - `lastAim`, `lastBias`, `lastFuze`, `lastTn`: 직전 `sendEOM()` 완료 임무의 최종 조준점·탄도 편차·신관·표적번호(전이사격 `sendShift`가 승계)(`PRD/OBSERVER_demo_v0.2.html:693,831,838-839`)
  - `devText`, `suggest`: 조정탄 탄착 후 훈련 모드에 표시할 탄착 편의 문자열과 수정 제안값 `{lr,lv,rr,rv}`(`PRD/OBSERVER_demo_v0.2.html:693,788-790`)
  - `impactAt`, `lastImpactT`, `lastLase`: 예상 탄착 시각, 마지막 탄착 시각, 마지막 레이저 측정 결과(`PRD/OBSERVER_demo_v0.2.html:693,762,771,785,794,1069`)

- **상태 및 전이(Transition) 전체 목록:**

| 현재 상태 | 진입 함수 (조건) | 다음 상태 (예약 지연 후 후속 전이) | 출처 |
| --- | --- | --- | --- |
| `IDLE` | `sendPosReport(e,n)` (`OPS.unreported && OPS.state==='ready'`) | `WAIT` → `at(3+rF())` 후 `OPS.fdc` 갱신 및 `IDLE` | `PRD/OBSERVER_demo_v0.2.html:892-903` |
| `IDLE` | `sendCall(warn)` (`phase==='live' && OPS.state==='ready' && !OPS.unreported && !hardPause()`) | `WAIT` → `at(2.5+rF()*1.5)` 후 `"좌표 송신바람"` 복창 및 `LOC` | `PRD/OBSERVER_demo_v0.2.html:712-717` |
| `LOC` | `sendLoc(method,a,b)` (`grid` 4+4자리 또는 `polar` 방위각·거리) | `WAIT` → `at(2.5+rF()*1.5)` 후 복창 및 `DESC` (극좌표면 `m.dir` 자동 설정) | `PRD/OBSERVER_demo_v0.2.html:718-730` |
| `DESC` | `sendDesc(desc,n,fuze,amc,dc)` | `WAIT` → `at(3+rF()*1.5)` 복창·위험근접 미선언 감점(`-30`)·강제 조정 전환(`m.phase='adj'`) → `at(9+rF()*3)` `decideMTO()` 사격지휘통보(표적번호 `AB1001+` 부여) → `at(24+rF()*14)` 사격준비 끝 및 `readyToFire()` | `PRD/OBSERVER_demo_v0.2.html:731-754` |
| `IDLE` | `sendShift(dir,lr,lv,rr,rv,desc,n)` (`R.lastAim` 존재 & 방향 유효) | `WAIT` → `at(3)` 복창·위험근접 검사 → `at(9+rF()*3)` `decideMTO()` 새 표적번호 부여 → `at(20+rF()*8)` 사격준비 끝 및 `readyToFire()` | `PRD/OBSERVER_demo_v0.2.html:834-847` |
| `WAIT` (`readyToFire`) | `m.amc === true` (지명사) | `AMC` (`"준비 쏴"` 입력 대기) | `PRD/OBSERVER_demo_v0.2.html:755` |
| `WAIT` (`readyToFire`) | `m.amc === false` (준비되는 대로) | `WAIT` 유지 → `at(1.5)` 후 `fireNow()`가 `FLIGHT`로 전이 | `PRD/OBSERVER_demo_v0.2.html:755,762,775` |
| `AMC` | `sendFireCmd()` (`"준비 쏴"`) | `WAIT` → `at(1+rF())` 후 `fireNow()`가 `FLIGHT`로 전이 | `PRD/OBSERVER_demo_v0.2.html:756,762,775` |
| `FLIGHT` | `fireNow()` 조정탄(`m.phase==='adj'`) 탄착 → `afterAdjImpact` | 탄착(`tof`) 후 `at(1.5)`에 `ADJ`로 전이 | `PRD/OBSERVER_demo_v0.2.html:759-764,784-792` |
| `FLIGHT` | `fireNow()` 효력사(`m.phase==='ffe'`) 탄착 → `afterFFE` | `lastFire+2.3`초에 `"마감탄 떳다"` 후 `Math.max(2, lastImp-simT+2.5)`초 뒤 `EOM`으로 전이 | `PRD/OBSERVER_demo_v0.2.html:765-775,793-797` |
| `ADJ` 또는 `EOM` | `sendCorr(...)`에서 `m.dc && (lv>100 \|\| rv>100)` (위험근접 수정량 초과) | `WAIT` → `at(2.5)` 후 `"수정량 100 이하로 재송신"` 통보 및 `ADJ`로 전이 | `PRD/OBSERVER_demo_v0.2.html:806-807` |
| `ADJ` 또는 `EOM` | `sendCorr(dir,lr,lv,rr,rv,next)` 정상 수정 (`m.dir==null`이면 `dir` 필수) | `WAIT` → `next==='효력사'`면 `m.phase='ffe'` 및 `at(14+rF()*8)` 후 `readyToFire()`, `'조정'`이면 `at(11+rF()*6)` 후 `readyToFire()` | `PRD/OBSERVER_demo_v0.2.html:803-818` |
| `EOM` | `sendRepeat(b,n)` (재효력사) | `WAIT` → `recordBDA(m,b)` 기록 후 `at(3+prep)`(`prep=10` 또는 `20`) 뒤 `readyToFire()` | `PRD/OBSERVER_demo_v0.2.html:822-828` |
| `EOM` | `sendEOM(b)` (임무끝) | `recordBDA(m,b)`, `lastAim/lastBias/lastFuze/lastTn` 저장, `R.m=null` 후 즉시 `IDLE` | `PRD/OBSERVER_demo_v0.2.html:829-832` |

---

### 1.4 `at()` 이벤트 큐 (`PRD/OBSERVER_demo_v0.2.html:400-402`)

- **구현:** `at(delay, fn)`은 `events.push({t: simT + delay, fn})` 후 `events.sort((a,b) => a.t - b.t)`로 정렬하고, `runEvents()`가 매 틱 `events[0].t <= simT`인 항목을 `shift().fn()`으로 실행한다(`PRD/OBSERVER_demo_v0.2.html:400-402,1333`).
- **등록되는 모든 예약 이벤트:**
  1. **작전 개시 통신 점검:** `startOps()`에서 `at(4)` 기러기 `"감명 보고"` → 내부 `at(1.5)` 갈매기 `"감명 양호"`(`PRD/OBSERVER_demo_v0.2.html:1440`).
  2. **FDC 무전 응답·통보·준비 완료:** `sendCall`(`716행`), `sendLoc`(`729행`), `sendDesc`(`743,748,753행`), `sendCorr`(`807,815,816,817행`), `sendRepeat`(`825,827행`), `sendShift`(`844,845,846행`), `startMove`(`872행`), `sendPosReport`(`898행`).
  3. **사격 발사 및 문당 시차 발사:** `readyToFire` 비지명사 `at(1.5)`(`755행`), `sendFireCmd` `at(1+rF())`(`756행`), `fireNow` 효력사 6문×`rounds`발 각각의 `at(r*9 + rF()*2.2)` 발사(`768-769행`), `"하나발 떳다"`/`"마감탄 떳다"`에 대한 갈매기의 `at(1.2)` `"잠깐대기"` 복창(`763,772,773행`).
  4. **포탄 탄착 및 후속 전이:** `fireRound()`의 `at(tof, () => { impact(...); m.onImpact?.(...) })`(`668행`), `afterAdjImpact`의 `at(1.5, () => setState('ADJ'))`(`791행`), 효력사 마감탄 후 `at(wait, () => afterFFE(m))`(`774행`).
  5. **적 박격포탄 탄착 및 경고:** `mortarVolley()`의 포신별 `at(22 + rA()*4)` 탄착(`504행`) 및 첫 사격 `at(26)` 경고 메시지(`506행`).
  6. **음속 지연 폭음:** 적 박격포탄·아군 포탄 탄착 시 `at(d / 343, () => boom(...))`(`505,645행`).
  7. **관측소 발각 보복 사격 및 패배 종료:** `compromise()`의 박격포(`60 + k*4`초, 4발) 또는 직사(`20 + k*2`초, 6발) 탄착(`629행`), `loseObserver()`의 `at(4, () => endGame())`(`637행`).

---

### 1.5 난수 스트림 5개 (`PRD/OBSERVER_demo_v0.2.html:182-193`)

5개 스트림 모두 `mulberry32(seed)`(`182행`)로 생성하며 Box-Muller 변환 `gaussOf(r)`(`192행`, 호출당 `r()` 2회 소비)을 사용한다.

| 스트림 | 시드 파생 | 가우시안 헬퍼 | 실제 소비처 (코드 위치) |
| --- | --- | --- | --- |
| `RNG.scn` (`rS`) | `SEED` | `gS` | 초기 기상 프리셋 선택(`1552행`), 적 2소대·장갑차·정찰조 접근로 및 박격포 진지 위치(`421-422행`), 적·아군 구성원 초기 대형 오프셋·위상·경유점 산포(`419,434-438,572-573행`) |
| `RNG.bal` (`rB`) | `SEED ^ 0x5bd1e995` | `gB` | 임무별 비표준 조건 오차 크기·방향(`697행`), 포탄 사거리·편의 공산오차(`665행`), 적 피격 사망 판정·엎드림 지속시간(`654,656행`), 아군 포탄 관측소 오사(`659행`), `hitFriendlies()` 아군 병력 손실 판정(`495행`, **적 박격포탄 피격 시에도 호출됨**), **레이저 거리측정 오차 `gB()*2`(`1068행`)** |
| `RNG.fdc` (`rF`) | `SEED ^ 0x1b873593` | 없음 | `decideMTO()` 신관·발수 변경(`733-734행`), `sendRepeat()` 접근→순발 변경(`826행`), 무전 응답·준비·효력사 발사 간격 지터(`716,729,743,748,753,756,768,815-817,845-846,872,898행`) |
| `RNG.exp` (`rE`) | `SEED ^ 0x68e31da4` | `gE` | 5초마다 관측소 발각 확률 판정(`618행`), 발각 후 적 보복 사격 탄착 오차(`630행`) 및 관측반 피격 판정(`633행`) |
| `RNG.ai` (`rA`) | `SEED ^ 0x3c6ef372` | `gA` | 장갑차 사격 간격(`468행`), 박격포 사격 간격·목표 아군 소대·비과시간·탄착 산포(`470,503-504행`), 아군 응사 간격·배회(`594,597행`), 아군 직사화기 적 살상(`603행`) 및 400 m 내 적 보병에 의한 아군 손실(`604행`) |

> **결정성 주의(스트림 간 오염):**
> 1. `lase()`(`PRD/OBSERVER_demo_v0.2.html:1068`)가 레이저 오차 `Math.round(hit.z + gB()*2)`를 계산할 때 탄도 스트림 `RNG.bal`을 소비한다. 따라서 플레이어가 레이저를 몇 번 찍느냐에 따라 이후 포탄 탄착 위치와 살상 결과가 달라진다.
> 2. 적 박격포탄 탄착(`mortarVolley`, `PRD/OBSERVER_demo_v0.2.html:505`)이 `hitFriendlies()`(`495행`)를 호출할 때 `rB()`(`RNG.bal`)를 소비하므로, 적 박격포 사격이 포탄 탄도 난수열을 밀어낸다.

---

### 1.6 입력 기록 `{t, a, v}`(`INPUTS`)의 종류 전체 (`PRD/OBSERVER_demo_v0.2.html:196-197`)

`logIn(a, v)`를 통해 기록되는 액션(`a`)은 총 **18종**이다.

| # | `a` (종류) | `v` (값 형식) | 발생 시점 및 함수 | 출처 |
| --- | --- | --- | --- | --- |
| 1 | `'pick'` | `[x, y]` (반올림 m) | 작전 준비 중 지도 클릭으로 관측소 후보 선정 (`prepPick`) | `PRD/OBSERVER_demo_v0.2.html:1427` |
| 2 | `'start'` | `[OBS.x, OBS.y, trainMode?1:0]` | 관측소 점령·작전 개시 (`startOps`) | `PRD/OBSERVER_demo_v0.2.html:1435` |
| 3 | `'bino'` | `1 \| 0` | 쌍안경 켜기/끄기 (`toggleBino`) | `PRD/OBSERVER_demo_v0.2.html:1385` |
| 4 | `'cam'` | `[h, p]` (0.1밀 단위) | `live` 단계 쌍안경 사용 중 직전 기록 대비 `h` 또는 `p`가 1밀 이상 변화 (`logCam`) | `PRD/OBSERVER_demo_v0.2.html:1327,1330` |
| 5 | `'lase'` | `[h, p]` (0.1밀 단위) | 레이저 거리측정 (`lase`) | `PRD/OBSERVER_demo_v0.2.html:1061` |
| 6 | `'id'` | `[pid, h, p, relAz, elAbs]` | 화면 클릭으로 가시 표적/신호 탐지 성공 (`identifyAt`) | `PRD/OBSERVER_demo_v0.2.html:1081` |
| 7 | `'call'` | `'조정' \| '효력사'` | 사격요구 ① 호출·경고명령 송신 (`sendCall`) | `PRD/OBSERVER_demo_v0.2.html:713` |
| 8 | `'loc'` | `['grid', e, n]` 또는 `['polar', az, dist]` | 사격요구 ② 표적위치 송신 (`sendLoc`) | `PRD/OBSERVER_demo_v0.2.html:724` |
| 9 | `'desc'` | `[desc, n, fuze, amc, dc]` | 사격요구 ③ 표적성질·발수·신관·지명사·위험근접 송신 (`sendDesc`) | `PRD/OBSERVER_demo_v0.2.html:739` |
| 10 | `'fire'` | *(생략됨: `{t, a:'fire'}`)* | 지명사(`AMC`)에서 `"준비 쏴"` 송신 (`sendFireCmd`) | `PRD/OBSERVER_demo_v0.2.html:756` |
| 11 | `'corr'` | `[dir, lr, lv, rr, rv, next]` | 수정 송신 (`sendCorr`, 첫 수정 이후 `dir`은 `null`) | `PRD/OBSERVER_demo_v0.2.html:808` |
| 12 | `'repeat'` | `[b, n]` (`b`: `'파괴'\|'무력화'\|'미흡'`) | 재효력사 송신 (`sendRepeat`) | `PRD/OBSERVER_demo_v0.2.html:823` |
| 13 | `'eom'` | `b` (`'파괴'\|'무력화'\|'미흡'`) | 임무끝 송신 (`sendEOM`) | `PRD/OBSERVER_demo_v0.2.html:830` |
| 14 | `'shift'` | `[dir, lr, lv, rr, rv, desc, n]` | 전이사격 송신 (`sendShift`) | `PRD/OBSERVER_demo_v0.2.html:837` |
| 15 | `'move'` | `[to.x, to.y]` (반올림 m) | 관측소 도보 이동 출발 (`startMove`) | `PRD/OBSERVER_demo_v0.2.html:868` |
| 16 | `'pos'` | `[e, n]` (4자리 문자열 2개) | 관측소 위치 보고 송신 (`sendPosReport`) | `PRD/OBSERVER_demo_v0.2.html:895` |
| 17 | `'mode'` | `'train' \| 'std'` | 훈련/표준 모드 버튼 전환 | `PRD/OBSERVER_demo_v0.2.html:1408-1409` |
| 18 | `'pause'` | `1 \| 0` | 일시정지/재개 버튼 클릭 | `PRD/OBSERVER_demo_v0.2.html:1410` |

- **입력 기록 누락(재생 검증 시 불일치 유발 요인) 4건:**
  1. **위치 보고 생략(`#bSkip`, `PRD/OBSERVER_demo_v0.2.html:1015`):** `OPS.skipReport=true; OPS.unreported=false; OPS.stale=true;`로 바꿔 `sendCall()` 가드를 해제하지만 `logIn()`을 호출하지 않는다.
  2. **`EOM` 단계 `'수정 후 효력사'`(`#bC`, `PRD/OBSERVER_demo_v0.2.html:1023`):** `recordBDA(m, gv('eb'))`로 점수를 가감한 뒤 `sendCorr(...)`를 호출하는데, `'corr'` 로그에는 `eb` 값이 포함되지 않는다.
  3. **연습 시드 기상 변경(`#wxSel`, `PRD/OBSERVER_demo_v0.2.html:1013`):** `setWeather(ws.value)`가 시정(`SIGMA`)·바람(`WV`)·기온을 바꾸지만 `INPUTS`에는 기록되지 않는다(단 `record.weather`에는 최종 키가 남음).
  4. **위험근접 100 m 초과 수정 거부(`sendCorr`, `PRD/OBSERVER_demo_v0.2.html:806-807`):** `logIn('corr', ...)` 호출 전에 조기 반환하면서 `setState('WAIT')` 및 `at(2.5, ...)`로 2.5초 상태 전이를 일으킨다.

---

### 1.7 `window.__obs` 자동 테스트 API 목록 (`PRD/OBSERVER_demo_v0.2.html:1555-1558`)

총 **43개**의 프로퍼티·메서드·getter/setter가 노출되어 있다.

- **지형·가시선·좌표 헬퍼 (7개):** `los(x,y,z)`, `camZ()`, `H(x,y)`, `S(x,y)`, `pitchTo(x,y)`, `fromGrid(e,n)`, `toGrid(x,y)`
- **상태 객체·배열 참조 (9개):** `friendlies`, `spriteList`, `MV`, `OPS`, `OBS`, `platoons`, `missions`, `R`, `cam`
- **상태 접근자 getter/setter (11개):** `get phase`, `get simT`, `get tick`, `set speed(v)`, `get vis`, `get seed`, `get seedKind`, `get inputs`, `get score`, `get ammo`, `get ended`
- **작전·관측·지도·루프 제어 함수 (8개):** `mapZoomAt`, `mapCenterOn`, `startOps`, `prepPick`, `startMove`, `planMove`, `lase`, `identifyAt`, `setPaused(v)`, `step(n)`, `setMode(t)`, `toggleBino`, `record`(`computeRecord`), `pickAt`, `updateVisibility` *(총 15개)*
- **무전 교신 함수 (8개):** `sendPosReport`, `sendCall`, `sendLoc`, `sendDesc`, `sendCorr`, `sendEOM`, `sendRepeat`, `sendShift`, `sendFireCmd` *(위 `sendPosReport` 포함 시 교신 9개, 전체 고유 키 43개)*

---

## 2. PRD 7.5 권장 모듈 대응표 및 비순수(Impure) 시뮬레이션 코드

### 2.1 함수·상태 덩어리별 권장 모듈(`sim/`, `radio/`, `render/`, `ui/`, `net/`) 대응표

PRD 7.5(`PRD/OBSERVER_PRD_v0.2.md:351`)의 권장 구조에 데모 v0.2 코드를 매핑하면 다음과 같다.

| 권장 모듈 | 데모 v0.2 내 상태·상수 | 데모 v0.2 내 함수 | 줄 번호 (`PRD/OBSERVER_demo_v0.2.html`) |
| --- | --- | --- | --- |
| `sim/rng` | `SEED_KIND`, `SEED`, `RNG`, `rS,rB,rF,rE,rA`, `gS,gB,gA,gE` | `mulberry32`, `gaussOf` | `182-193` |
| `sim/terrain` | `N,CELL,SIZE`, `GROUND,SURF,BLD,FOREST,ROAD,VILL`, `OBS,OPS,EYE_H,FRONT_Y,PLANNED_OP,FRIEND,BATT,GZD,E0,N0`, `VILLAGES,ROADS`, `WX_PRESETS,WX,WV,SIGMA` | `hash`, `vnoise`, `fbm`, `ss`, `riverY`, `genTerrain`(수치 부분), `refl`, `sampleH`, `cellIdx`, `toGrid`, `fromGrid`, `az4`, `azOf`, `los`, `setWeather`(수치 부분), `planMove`, `moveCheck`, `startMove`, `updateOP` | `201-287, 306-318, 331-345, 390, 850-891` |
| `sim/units` | `ROUTES,NAI,INTEL_ROUTES,TYPE`, `platoons`, `friendlies,FRIEND_PIN`, `friendlyLoss,apcBursts,friendlyMortar`, `NEUT,DESTROY` | `member`, `makePlatoons`, `alive`, `strength`, `distToObj`, `moveAlong`, `updatePlatoon`, `apcFire`, `hitFriendlies`, `mortarVolley`, `judge`, `earlyBonus`, `makeFriendlies`, `friendAlive`, `stepTo`, `updateFriendly` | `403-516, 569-606` |
| `sim/intel` | `tcount`, `lases`, `DET_MIL` | `actOf`, `sizeOf`, `descOf`, `shortOf`, `intelTimes`, `relAzOf`, `visOf`, `effSize`, `effTop`, `updateVisibility`, `updateIntel`, `pickAt`, `lase`, `identifyAt` | `518-567, 1048-1087` |
| `sim/exposure` | `obsLost,obsLostReason` | `exposureTick`, `compromise`, `loseObserver` | `609-637` |
| `sim/ballistics` | `effects,impacts,missions`, `ammoUsed,friendlyHits`, `SHEAF` | `tofOf`, `impact`, `fireRound`, `devAgainst`, `bestPlatoon`, `truthOf`, `recordBDA` | `403-404, 640-671, 778-783, 798, 820-821` |
| `sim/core` (루프·기록) | `INPUTS,tick,STEP,acc,camLog`, `simT,paused,simSpeed,trainMode,score,ended,endAt,OPS_LIMIT,clearT,trainUsed,phase,SCN`, `events` | `logIn`, `at`, `runEvents`, `addScore`, `logCam`, `simStep`, `checkEnd`, `computeRecord` | `196-197, 398-402, 685, 1325-1353, 1475-1494` |
| `radio/` | `AD`, `R`, `tnSeq`, `dangerMiss` | `dg`, `corrWord`, `tnWord`, `newMission`, `setState`, `otFrame`, `setDir`, `nearestPlatoon`, `locText`, `okDir`, `sendCall`, `sendLoc`, `decideMTO`, `mtoText`, `sendDesc`, `readyToFire`, `sendFireCmd`, `fireNow`, `afterAdjImpact`, `afterFFE`, `corrParts`, `applyCorr`, `sendCorr`, `bdaWord`, `sendRepeat`, `sendEOM`, `sendShift`, `sendPosReport` | `311-313, 693-847, 892-903` |
| `render/voxel` | `VW,VH,low,lctx,img,pix,pix32,ybuf,dbuf,vc,vctx,cam,EYE_FOV,BINO_FOV,camZ,V,FOG,SKY,BAYER`, `BR/BG/BB,CR/CG/CB` | `shadeTerrain`, `setRes`, `pack`, `renderTerrain`, `ridgeLines`, `proj`, `blend`, `disc`, `posterize`, `resize` | `203, 238, 289-305, 320-329, 352-395, 1323` |
| `render/sprites` | `spriteList`, `SPR_COL` | `drawSpritesHi`, `drawSprites` | `1101-1184` |
| `render/overlay` | `maskCanvas,maskKey` | `drawOverlay` | `1101, 1185-1232` |
| `render/map` | `mc,mctx,mapBase,vsCanvas,showVS,MW,MV` | `drawIntelOverlay`, `computeViewshed`, `mapClamp`, `mapZoomAt`, `mapCenterOn`, `mapToWorld`, `buildMap`, `drawMap` | `1234-1320` |
| `ui/` | `AC,noiseBuf,muted,ttsOn`, `logEl,comp`, `vw,drag,mapDragged,mPtr,mDrag,mPinch`, `BOARDS,WXN` | `fmtT`, `esc`, `dir16`, `wxText`, `initAudio`, `boom`, `squelch`, `addMsg`, `fo`, `fdc`, `sys`, `nm`, `speak`, `sel`, `hint`, `corrInputs`, `dirInput`, `curAz`, `gv`, `hardPause`, `renderComposer`, `bindComposer`, `shiftPreview`, `previewText`, `renderTargets`, `frame`, `endGame`, `turn`, `tilt`, `toggleBino`, `syncVS`, `prepPick`, `startOps`, `rankOf`, `bestPerCallsign`, `showRank`, `recordHTML` | `1-174(HTML/CSS), 194, 198, 339-340, 351, 674-690, 906-1043, 1088-1098, 1335-1345, 1354-1449, 1496-1523, 1531-1550` |
| `net/` | `CLIENT_VER`, `NET`, `RESERVED_CS`, `CS_RE`, `MOCK_RUNS` | `lsGet`, `lsSet`, `validCS`, `setCS`, `allRuns`, `submitRec` | `1452-1474, 1503, 1524-1530` |

### 2.2 시뮬레이션·교신 코드 내 DOM·캔버스·`Date`·`Math.random` 결합 지점

PRD 7.5(`PRD/OBSERVER_PRD_v0.2.md:347-351`)는 `sim/`과 `radio/`가 DOM 의존이 없어야 한다고 규정하지만, 현재 데모 코드는 다음 7가지 지점에서 브라우저 API 및 렌더러 상태와 직접 결합되어 있다.

1. **`identifyAt(ix, iy)`의 렌더러 `V` 및 뷰포트 픽셀 의존 (`PRD/OBSERVER_demo_v0.2.html:1075-1080`):**
   - `if (!V || hardPause() || phase !== 'live') return false;`(`1076행`)에서 `V`는 `renderTerrain()`(`383, 1340행`)이 반환하는 `{tanH, focal, hor}` 객체다.
   - 따라서 `requestAnimationFrame(frame)`이 돌지 않는 순수 헤드리스 환경에서 `window.__obs.step(n)`만 호출하면 `V`가 `null`이거나 이전 카메라 피치(`cam.p`)의 `V.hor`에 머물러 `identifyAt()`이 실패하거나 각도가 어긋난다(반면 `pickAt(relAz, elAbs, tolAz, tolEl)`은 순수 각도 함수임, `1048행`).
2. **`Date.now()` / `new Date()` 호출 (`PRD/OBSERVER_demo_v0.2.html:187,1464,1491`):**
   - `kstDay()`(`187행`): `new Date(Date.now() + 9*3600e3)`로 일일 시드를 만든다.
   - `computeRecord()`(`1491행`): `created_at: new Date().toISOString()`을 기록 객체에 넣는다.
   - `MOCK_RUNS`(`1464행`): 목업 랭킹 생성 시 `Date.now()`를 사용한다.
3. **`location.search` 직접 참조 (`PRD/OBSERVER_demo_v0.2.html:186`):**
   - `const URLSEED = new URLSearchParams(location.search).get('seed');`가 모듈 최상위에서 `window.location`을 읽는다.
4. **`Math.random()` 호출 (`PRD/OBSERVER_demo_v0.2.html:675`):**
   - `initAudio()`(`675행`)가 폭발/무전 효과음용 백색소음 버퍼를 채울 때 `Math.random()`을 사용한다(시뮬레이션 상태에는 영향 없음).
5. **시뮬레이션 함수 내부의 캔버스(`document.createElement('canvas')`) 호출 (`PRD/OBSERVER_demo_v0.2.html:881,1248,1428,1436`):**
   - `updateOP()`(`881행`), `prepPick()`(`1428행`), `startOps()`(`1436행`)가 `if (showVS) computeViewshed()`를 호출하며, `computeViewshed()`(`1248행`)는 `document.createElement('canvas')`와 `getContext('2d')`를 사용한다.
6. **시뮬레이션·교신 함수 내부의 직접적인 DOM 갱신:**
   - 무전·시스템 로그(`fo`, `fdc`, `sys` → `addMsg`, `PRD/OBSERVER_demo_v0.2.html:681-684`): `updatePlatoon`(`461행`), `apcFire`(`489행`), `hitFriendlies`(`496행`), `mortarVolley`(`506행`), `earlyBonus`(`516행`), `updateIntel`(`564-565행`), `compromise`(`624,627,634행`), `loseObserver`(`637행`), `impact`(`660행`), `startMove`/`updateOP`(`871-888행`), `send*` 전체가 `#log` DOM에 `<div>`를 직접 추가한다.
   - 교신 문자열 내 HTML 태그 삽입(`nm(v)`, `PRD/OBSERVER_demo_v0.2.html:686`): 훈련 모드 숫자 병기가 `<span class="dim">(${v})</span>` HTML 문자열로 `corrParts()`, `locText()`, `tnWord()` 결과에 직접 섞여 있다.
   - 입력기 재렌더링(`renderComposer`, `PRD/OBSERVER_demo_v0.2.html:703,875,881,889,919,1073`): `setState()`가 호출될 때마다 `#composer.innerHTML`을 다시 쓰고 이벤트 리스너를 재바인딩한다.
   - 기타 DOM 조작: `lase()`가 `#laseOut`·`#llist`를(`1058-1072행`), `identifyAt()`이 `renderTargets()`(`#tlist`, `1085행`)를, `startMove()`가 `toggleBino()`(`#binoBtn`, `870,1385행`)를, `endGame()`이 `#debriefBox`·`#debrief`·`localStorage`를(`1356-1367행`) 직접 조작한다.
7. **Web Audio / Web Speech 직접 호출 (`PRD/OBSERVER_demo_v0.2.html:505,631,645,682-683,689,1057`):**
   - `mortarVolley`, `compromise`, `impact`가 `boom()`을, `fo`/`fdc`가 `squelch()`와 `speak()`(`window.speechSynthesis`)를, `lase()`가 `initAudio()`를 직접 호출한다.

---

## 3. PRD `[데모]` 표기 항목 중 데모 v0.2 실제 동작·수치와의 불일치 목록

### 3.1 기능 요구사항(F-01~F-31) 및 4장·5장(5.1~5.3) 불일치

| 항목 (PRD 위치) | PRD 본문 명세 | 데모 v0.2 실제 구현 (`PRD/OBSERVER_demo_v0.2.html`) |
| --- | --- | --- |
| **F-01** 육안 방위 테이프 (`PRD/OBSERVER_PRD_v0.2.md:154`) | 상단 방위 테이프(100밀 단위) | 눈금은 50밀 간격으로 그리고, 100밀마다 긴 눈금과 두 자리 숫자(`00`~`63`)를 표시함(`1211행`). |
| **F-02** 쌍안경 레티클 (`PRD/OBSERVER_PRD_v0.2.md:155`) | 수평 ±50밀, 10밀 간격 / 수직 ±20밀, 5밀 간격 | 수평 눈금도 5밀 간격(10밀 장선, ±40밀 숫자)이며, 수직 중앙 세로선은 위쪽(`+3`~`+25`밀)만 그려지고 아래쪽 세로선이 없음(`1203-1206행`). |
| **F-03** 시선 조작 배율 (`PRD/OBSERVER_PRD_v0.2.md:156`, 데모 안내표 `151행`) | 쌍안경 1–2밀 단위 미세 조작, 데모 안내표는 "`Shift` 누르면 10배" | 좌우(`turn`)는 쌍안경 2밀·육안 20밀에 `Shift` 시 10배이나, 상하(`tilt`)는 쌍안경 1밀·육안 5밀에 **`Shift` 시 5배**(`big?5:1`)만 적용됨(`1378-1379행`). |
| **F-04 / 5.2** 쌍안경 적정 판정 영역 및 속도 (`PRD/OBSERVER_PRD_v0.2.md:157,226-230`) | 쌍안경 안에 두고 `3+2.5/km`초(병종) → `6+4/km`초(규모·활동) 관측 | ① 시야각 `BINO_FOV`(7°) 전체가 아니라 중심부 좌우 `±42%`(`±2.94°`)만 인정하되 **고저각(`cam.p`)은 전혀 검사하지 않음**(`555-558행`); ② 적 구성원이 안 보이고 먼지·연기(`sig`)만 보일 때는 진행 속도가 **0.5배**(`dt*(c?1:0.5)`, `562행`); ③ 병종 식별 문구에 `장갑차(BMP 계열 추정)`, `박격포(82mm 추정)` 괄호 설명이 자동으로 붙음(`532행`). |
| **F-05** 레이저 거리측정 오차 (`PRD/OBSERVER_PRD_v0.2.md:158`) | 오차 ±2 m | 균일 오차 ±2 m가 아니라 **가우시안 표준편차 σ = 2 m**(`Math.round(hit.z + gB()*2)`)이므로 ±2 m를 넘는 오차가 나올 수 있으며, 탄도 난수 스트림(`gB`)을 소비함(`1068행`). |
| **F-07 / 4.1 / 4.3** 사격요구 입력기·교신 문구 (`PRD/OBSERVER_PRD_v0.2.md:79,111-135,160`) | ③ 표적성질·사격규모·통제방법 송신; 준비 완료는 `"포대 사격준비 끝"`; 효력 판정 뒤는 임무끝/재효력사/전이사격 | ① ③ 입력기에 PRD 4.3에 없는 **`신관 [요청 안 함 / 순발 / 접근]` 선택 칸**이 있음(`973,740행`); ② `sendCorr`에서 `'조정'` 계속 시 기러기가 `"포대"`가 빠진 `"사격준비 끝."`을 보냄(`817행`); ③ `EOM` 화면에 PRD 3장에 없는 **`"수정 후 효력사"`(`#bC`)**가 있고 실행 시 `recordBDA`가 호출되어 전과 보고 점수가 중복 가산될 수 있음(`999,1023행`). |
| **4.4 / F-09** 위험근접 미선언 경고 및 수정 시 검사 (`PRD/OBSERVER_PRD_v0.2.md:133,143-144`) | 600 m 이내 미선언 시 경고·감점 후 위험근접 적용(`"위험근접, 조정 후 효력사"`) | ① `sendDesc`는 `"표적이 아군 600 m 이내, 위험근접 적용"`과 `"위험근접, 조정 후 효력사"`를 2개 메시지로 보내는 반면(`745-746행`), `sendShift`는 1개 메시지로 합쳐 보냄(`844행`); ② 위험근접 여부는 최초 `m.loc`에서만 검사하고 **`sendCorr`로 조준점 `m.aim`이 아군/관측소 600 m 안으로 이동해도 위험근접이 발동하지 않음**(`742,803-818행`). |
| **F-21 / 5.1** 관측소 이동 후 위치 미보고 시 동작 (`PRD/OBSERVER_PRD_v0.2.md:174,193-194`) | 보고를 건너뛰면 기러기는 이전 위치를 기준으로 극좌표를 환산(좌표법+방향 송신에는 영향 없음) | ① 이동 완료 또는 계획 관측소에서 50 m 초과 이격 시 `OPS.unreported=true`가 되어 **위치 보고 또는 `"보고하지 않고 계속"`(`#bSkip`) 클릭 전까지 `sendCall()` 자체가 차단됨**(`713,941-946,1434-1435행`); ② `946행` 훈련 모드 힌트는 `"기러기는 극좌표와 수정량을 관측소 위치 기준으로 계산합니다"`라며 v0.1 기준 설명을 잘못 표시함; ③ `moveCheck()`(`860행`)에 북쪽 지도 가장자리(`to.y > SIZE-200`) 검사가 빠져 있음(`prepPick` `1425행`에는 있음). |
| **5.1** 관측소 발각 가시선 및 보복 사격 (`PRD/OBSERVER_PRD_v0.2.md:200-203`) | 1.1 km 안 가시선 통하는 적마다 발각 판정(숲 속 ×0.35); 박격포 없으면 800 m 안 보병·장갑차가 20초 뒤 직사 사격(4 m 안 70% 피격) | ① 관측소가 숲 속에 있으면 `los()`(`390,616행`)가 관측소 자체의 숲 수관(`SURF = GROUND + 12~17 m`)에 막혀 거의 `false`가 되므로 `canopy ? 0.35 : 1` 배율이 사실상 무력화됨; ② 박격포 부재 시 직사 보복은 **발각시킨 그 부대 `P`가 보병/장갑차이고 800 m 안일 때만** 발동하며(정찰조가 발각시키면 주변에 보병이 있어도 불발, `626행`), 2초 간격 **6발**을 산포 σ=35 m로 쏴 반경 4 m를 판정하므로 발당 피격 확률이 약 0.45%에 불과함(`629-633행`); ③ PRD에 없는 150초 재발각 쿨다운이 있음(`622행`). |
| **F-22 / 5.2** 시드별 실제 배치 (`PRD/OBSERVER_PRD_v0.2.md:220`) | 2소대는 서측·동측 중 한 곳, 장갑차는 중앙·동측 중 한 곳, 박격포는 NAI 3 안 임의 지점 | 정찰조도 `rS() < 0.6 ? 'A' : 'B'`(서측 60%, 중앙 40%)로 시드에 따라 바뀌며(`421행`), 박격포는 `NAI 3` 원(`r=550 m`)이 아닌 `700×500 m` 직사각형 내 비삼림 지점에 배치됨(`422행`). |
| **5.3** 탐지·누르기 대상 선택 기준 (`PRD/OBSERVER_PRD_v0.2.md:239,242`) | 허용 각도 안의 보이는 대상 중 **가장 가까운 것** 선택; 대상 높이 서 있는 사람 1.7 m, 엎드린 사람 0.45 m, 차량 2.3 m | ① `pickAt()`(`1051행`)은 거리(`d`)가 가장 가까운 대상이 아니라 **조준선 중심과의 정규화 각도 편차 `Math.hypot(a/tolAz, e/tolEl)`가 가장 작은 대상**을 선택함; ② 아군 보급 트럭 높이는 `2.6 m`로 판정하며(`549행`), 스프라이트 렌더링(`1112,1134행`)에서는 사람 1.75 m, 장갑차 2.2 m, 트럭 2.7 m 비율을 씀. |
| **F-24** 가시권 표시 (`PRD/OBSERVER_PRD_v0.2.md:177`) | 관측소에서 안 보이는 땅을 지도에서 어둡게 표시 | `computeViewshed()`(`1251행`)는 `y < OBS.y + 150`(관측소 남쪽 전체 및 북쪽 150 m 이내)을 계산에서 제외해 어둡게 칠하지 않음. |

---

### 3.2 6장 수치표·7장 그래픽·10장 기록/랭킹 불일치

| 항목 (PRD 위치) | PRD 본문 수치 / 사양 | 데모 v0.2 실제 수치 / 구현 (`PRD/OBSERVER_demo_v0.2.html`) |
| --- | --- | --- |
| **6장** 적 보병 횡대 전개 시간 (`PRD/OBSERVER_PRD_v0.2.md:253`) | 목표 1.5 km에서 약 20초에 걸쳐 전개 | `P.form += (want - P.form) * Math.min(1, dt / 20)`(`463행`)으로 선형 20초가 아니라 **시상수 τ = 20초인 1차 지수 수렴**이라 20초 후 63.2%, 약 60초 후 95% 전개됨. |
| **6장** 포대 위치 거리 (`PRD/OBSERVER_PRD_v0.2.md:260`) | 관측소 남쪽 약 9 km | 기본 관측소 `OBS(5120, 1800)`와 포대 `BATT(4200, -4600)` 사이 실제 거리는 **`6,466 m`(약 6.5 km)**임(`204,210행`; 아군 진지까지 약 8.0 km, 적 출현 지역까지 약 10.1~11.5 km). |
| **6장** 비표준 조건 기온 잔차 방향 (`PRD/OBSERVER_PRD_v0.2.md:264`) | 기온 1.2 m/°C(저온 = 근탄) 사거리 잔차 | 임무별 표적 방향이 아니라 **고정점 `(5000, 5500)`과 포대를 잇는 단위벡터**(`gx=5000-BATT.x, gy=5500-BATT.y`) 방향으로 기온 잔차를 더함(`698-700행`). |
| **6장** 효력사 간격 (`PRD/OBSERVER_PRD_v0.2.md:267`) | 문당 9초 간격 | `dt = r * 9 + rF() * 2.2`(`768행`)로 문당 9초 간격에 **포마다 0~2.2초의 무작위 지터**가 추가됨. |
| **6장** 장갑차·박격포 살상 확률 (`PRD/OBSERVER_PRD_v0.2.md:269-270,279`) | 기본 모델 `0.92 * exp(-(r/R)²)`; 장갑차는 순발 R 7 m 근접 직격만 유효, 접근신관은 효과 0.22배 | ① 장갑차(`veh`, `651행`)는 `p = (vt ? 0.22 : 0.9) * exp(-(r/7)²)`로 순발 계수가 `0.9`이고 접근신관은 `0.9*0.22`가 아닌 **`0.22` 자체**(순발 대비 0.244배)이며 파열고 7 m를 적용하지 않음; ② 박격포 포신(`tube`, `652행`)은 PRD 표에 없는 별도 식 `0.9 * exp(-(hypot(r, vt?7:0) / (vt?7:10))²)`을 사용함. |
| **6장** 아군 진지 피탄·박격포 손실 감쇠 (`PRD/OBSERVER_PRD_v0.2.md:272-273`) | 30 m 안 병력 손실(서 있음 60%, 엎드림 30%, 거리 감쇠); 박격포 15 m 안(30%/10%) | `hitFriendlies()`(`495행`)의 거리 감쇠식이 `exp(-(r/R)²)`가 아니라 지수에 `1.5`를 곱한 **`exp(-(r/R)² * 1.5)`**임. |
| **6장** 장갑차 정지 후 첫 사격 (`PRD/OBSERVER_PRD_v0.2.md:279`) | 목표 1,300 m에서 멈춰 8–16초마다 직사화기 사격 | 목표 1,300 m 도달 후 **첫 사격은 6초 뒤**(`P.nextFire = simT + 6`, `467행`)이고, 두 번째 사격부터 `8 + rA()*8`초 간격(`468행`). |
| **7.1** 지형 햇빛 음영 방향 (`PRD/OBSERVER_PRD_v0.2.md:293,297`) | `293행`은 "남남동 햇빛 음영", `297행`은 "낮은 서남서 햇빛" (문서 내 자기모순) | `shadeTerrain()`(`290행`)은 `sunAz = 250 * Math.PI / 180`(250° = **서남서**)을 사용함. |
| **10.1** 호출부호 예약어·욕설 필터 (`PRD/OBSERVER_PRD_v0.2.md:396`) | 상급·포대 호출부호(기러기 등)와 운영자 계열 예약어 차단 + 욕설 필터 | `RESERVED_CS = ['기러기','독수리포대','관측','운영자','admin','test']`(`1455행`)만 검사하고 **욕설 필터는 없으며**, 상급 콜사인 `'송골매'`는 예약어가 아니라 목업 랭킹 이름(`MOCK_RUNS`, `1460행`)으로 쓰임. |
| **10.2 / 10.3** 기록 객체 필드 (`PRD/OBSERVER_PRD_v0.2.md:404-446`) | `runs` 테이블 및 기록 항목 표 | 데모 `computeRecord()`(`1490행`)는 PRD 표와 SQL 스키마에 없는 **`compromised: !!OPS.compromised`** 필드를 추가로 생성함. |

---

## 4. PRD가 가리키지만 문서·저장소에 없는 5개 항목과 흔적 조사

워킹트리 전체를 확인한 결과, 아래 5개 항목의 독립 파일이나 절은 저장소에 존재하지 않는다(`.routing/tasks/wayfinder-prd-v02.json:10`에서도 확인됨). 각 항목의 PRD 참조 위치와 데모/PRD 내부 흔적은 다음과 같다.

1. **"4.5 교신 문법" (`교신 문법 JSON`)**
   - **PRD 참조:** `PRD/OBSERVER_PRD_v0.2.md:171`(F-18: `"4.5의 교신 문법을 공유"`), `PRD/OBSERVER_PRD_v0.2.md:314`(7.2 표: `"교신 문법 JSON(4.5) — 슬롯 문법으로 입력기·음성 인식·서버 검증이 공유"`). 그러나 4장은 `4.4 FDC AI의 판단 규칙`(`138-146행`)에서 끝난다.
   - **저장소·데모 내 흔적:** 별도 JSON 파일은 없으며, `PRD/OBSERVER_demo_v0.2.html` 안에 포병 숫자·수정량 변환 함수(`AD`, `dg`, `corrWord`, `tnWord`, `locText`, `mtoText`, `corrParts`, `bdaWord`: `311-313, 695, 709, 737, 799, 819행`), 송신 함수(`sendCall`, `sendLoc`, `sendDesc`, `sendFireCmd`, `fireNow`, `sendCorr`, `sendRepeat`, `sendEOM`, `sendShift`, `startMove`, `sendPosReport`: `712-903행`), 미리보기 함수(`shiftPreview`, `previewText`: `1026-1043행`)의 문자열 템플릿으로 하드코딩되어 있다.

2. **"개발 스펙 탭"**
   - **PRD 참조:** `PRD/OBSERVER_PRD_v0.2.md:36`(§2: `"개발 스펙의 작업 단위로 구현"`), `PRD/OBSERVER_PRD_v0.2.md:318`(§7.3: `"성능 목표와 기준 기기는 개발 스펙에 있고"`), `PRD/OBSERVER_PRD_v0.2.md:387`(§9: `"단계별 작업, 수용 기준, 테스트 명령은 개발 스펙 탭에 있습니다"`).
   - **저장소·데모 내 흔적:** 저장소와 데모 HTML 어디에도 흔적이 없다(원본 문서 작성 도구의 별도 탭이 마크다운 반출 시 빠진 상태).

3. **`supabase/migrations/0001_init.sql`**
   - **PRD 참조:** `PRD/OBSERVER_PRD_v0.2.md:465`(§10.3 SQL 주석), `PRD/OBSERVER_PRD_v0.2.md:495`(§10.5 PGlite 검증 언급).
   - **저장소·데모 내 흔적:** `supabase/` 디렉토리는 없으나, `PRD/OBSERVER_PRD_v0.2.md:423-466`에 핵심 스키마 발췌본(`profiles`, `runs`, `leaderboard_time` 뷰 1개, 기본 RLS 정책 3개)이 들어 있고, 데모(`PRD/OBSERVER_demo_v0.2.html:1455-1456,1496-1506`)에 호출부호 정규식(`CS_RE`), 예약어 배열(`RESERVED_CS`), 4개 보드(`total`, `time`, `ammo`, `acc`)의 정렬·자격 필터(`BOARDS`, `bestPerCallsign`)가 클라이언트 목업으로 남아 있다.

4. **`api/_lib/validate.js` (및 `/api/submit-run`, `/api/daily`, `src/net.js`)**
   - **PRD 참조:** `PRD/OBSERVER_PRD_v0.2.md:470-496`(§10.4~§10.5).
   - **저장소·데모 내 흔적:** `api/`나 `src/` 디렉토리는 없으나, ① PRD §10.4(`471-473행`)에 검증 규칙(KST 일일 시드 일치 여부, 시나리오 전투부대 수 4, 임무별 탄·수정 합계 및 초탄 오차 평균 일치, 최소 섬멸 시간 300초 하한, 무사격 섬멸·관측반 손실 섬멸 거부, 분당 3건 제한)이 명시되어 있고, ② 데모(`PRD/OBSERVER_demo_v0.2.html:1445-1447,1453-1454,1472-1474,1508-1509,1524-1534`)에 `window.OBS_NET` 계약(`online`, `claimCallsign(v)`, `myCallsign()`, `mountCaptcha(el)`, `fetchBoard(tab)`, `submitRun(rec)`)과 `POST /api/submit-run` 요청 본문 형식(`{run, events, inputs}`)이 구현되어 있다.

5. **데모 검증 스크립트**
   - **PRD 참조:** `PRD/OBSERVER_PRD_v0.2.md:5`(머리말), `PRD/OBSERVER_PRD_v0.2.md:283`(§6: 시드 4242, 1회 수정 후 효력사 18발 → 사상 60% 파괴), `PRD/OBSERVER_PRD_v0.2.md:302`(§7.1: 헤드리스 브라우저 FPS 측정), `PRD/OBSERVER_PRD_v0.2.md:348`(§7.5: 동일 시드·입력 2회 실행 상태 일치 확인).
   - **저장소·데모 내 흔적:** 스크립트 파일 자체는 저장소에 없으며, 데모 마지막 줄(`PRD/OBSERVER_demo_v0.2.html:1554-1558`)의 `window.__obs` 노출 객체가 해당 검증 스크립트가 호출하던 테스트 훅 흔적이다.

---

## Unresolved

1. **누락된 참조 산출물 5종의 원본 부재:** `4.5 교신 문법 JSON`, `개발 스펙 탭`(성능 목표·기준 기기·작업별 수용 기준), `supabase/migrations/0001_init.sql` 전체본(나머지 랭킹 뷰 3개·호출부호 변경 RLS·예약어 DB 제약), `api/_lib/validate.js` 및 `src/net.js`, `데모 검증 스크립트` 원본 파일은 저장소에 존재하지 않으므로 후속 설계 티켓(#8, #9, #10, #14)에서 본 보고서가 추출한 흔적과 인터페이스를 기준으로 재작성해야 한다.
2. **PRD 대 데모 불일치 항목의 M1 정본(Source of Truth) 결정 필요:**
   - 레이저 측정(`lase()`)과 적 박격포 피격(`hitFriendlies()`)이 탄도 난수 스트림(`RNG.bal`)을 소비하는 현상을 M1에서 별도 스트림/소비 규칙으로 분리할지 여부(`PRD/OBSERVER_demo_v0.2.html:495,1068`).
   - 입력 기록(`INPUTS`)에서 누락된 위치 보고 생략(`#bSkip`), `EOM` 수정 후 효력사(`#bC`)의 BDA 판정값, 연습 기상 변경(`#wxSel`), 위험근접 100 m 초과 거부 이벤트를 M1 입력 로그 스키마(#14)에 추가할지 여부(`PRD/OBSERVER_demo_v0.2.html:806,1013,1015,1023`).
   - `pickAt()` 표적 선택 우선순위(데모의 조준선 중심 각도 최소 vs PRD 5.3의 거리 최소), 포대 위치 거리(데모 6.5 km vs PRD 6장 9 km), 보병 전개 방식(데모 τ=20초 지수 수렴 vs PRD 6장 20초 전개) 중 어느 쪽을 M1 사양으로 고정할지 여부(`PRD/OBSERVER_demo_v0.2.html:210,463,1051`, `PRD/OBSERVER_PRD_v0.2.md:242,253,260`).
