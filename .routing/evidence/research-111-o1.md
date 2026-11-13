# 조사 보고: 관측자의 FDC(기러기) 교신 복창 절차 (`research-111-o1`)

- **대상 이슈**: `DomineYH/observer#111` (상위 지도 `#109`)
- **기준 커밋 / 작성일**: `25ccf77` / `2026-11-13`
- **선행 M1 연계**: `/tmp/research-111/m1-procedure.md:89`(MTO 복창 누락), `:76-81`(Record as target), `:102-118`(위험근접) 및 `/tmp/research-111/m1-phrasing.md:12-19, 25-30, 75-82`의 출처·1차 검증 결론을 이어받아 다운로드된 원문(`MCWP 3-16.6`, `FM 6-30`) 및 한국 공개 자료로 재확인함.
- **조사 범위 제약**: 한국 육군 포병·통신보안 야전교범은 비공개(`대외비`)로 민간 공개 자료만 사용함(ADR 0013). `law.go.kr`은 `2026-11-13` 시스템 점검 중이어서 `해양경찰청 정보통신 운영규칙 [별표 6]` 원문을 열람·다운로드하지 못해 `unconfirmed`(`confidence: low`) 용어 포인터로만 남겼고, `ATP/TC 3-09.30` PDF는 `archive.org` 텍스트 미수록 및 호스트 중단 지침에 따라 포인터·미확인 상태로 남김.

---

## 주장 및 근거 목록 (Claims Table)

| # | Claim | Kind | Source | Evidence |
| --- | --- | --- | --- | --- |
| 1 | 미군 야포·박격포 교범(MCWP 3-16.6 §3107, `m1-procedure.md:89`)상 FDC의 MTO(사격지휘통보)는 관측자가 복창함 | fact | [MCWP 3-16.6](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt) | §3107 L5516-5518: "That decision is announced to the observer in the form of an MTO, which the observer reads back." |
| 2 | 긴급제압(immediate suppression) 임무에서는 MTO를 송신하지 않음 | fact | [MCWP 3-16.6](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt) | §3107 L5528: "An MTO is not transmitted for an immediate suppression mission." |
| 3 | 야포·박격포 FDC의 `"Shot"`(발사) 통보는 조정 매 발 및 효력사 초탄마다 관측자가 `"Shot, out"`으로 수신확인(복창)함 | fact | [MCWP 3-16.6](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt) | §3109a L5816,5822-5823: "The observer acknowledges each." FDC: "Shot, over." FO: "Shot, out." |
| 4 | FM 6-30 등록사격 예문도 FDC의 `"SHOT, OVER"`를 관측자가 복창함을 명시함 | fact | [FM 6-30](https://archive.org/download/ost-military-doctrine-fm6_30/fm6_30_djvu.txt) | L5992: "SHOT, OVER (Read back by FO)" |
| 5 | 함포지원(NGF)에서는 함정의 `"Shot"`·`"Splash"` 송신에 관측자 수신확인 의무가 없음 | fact | [MCWP 3-16.6](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt) | §3205 L6490-6491: "There is no requirement for the spotter to acknowledge these transmissions." |
| 6 | 야포·박격포 기본 교범(`MCWP 3-16.6 §3109b`)에서 `"Splash"`(탄착 5초 전)는 FDC가 `"out"`으로 끝내며 관측자 복창 의무가 없음 | fact | [MCWP 3-16.6](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt) | §3109b L5841-5848: "The observer is not required to acknowledge the transmission." FDC: "Splash, out." |
| 7 | `MCWP 3-16.6`·`FM 6-30`은 효력사 규정 발수 발사 후 FDC가 `"rounds complete"`를 보고한다고 정의함 | fact | [MCWP 3-16.6](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt) | L27980-27982: "term used to report that the number of rounds specified in fire for effect have been fired." |
| 8 | `"rounds complete"`(`마감탄 떳다`)에 대한 야포 관측자 복창 의무와 대화 예문은 다운로드된 1차 교범(`MCWP 3-16.6`·`FM 6-30`) 및 한국 1차 자료에서 미확인 | fact | unconfirmed | Searched mcwp_3_16_6.txt, fm6_30.txt, archive.org ATP/TC 3-09.30, law.go.kr, kli.korean.go.kr; no FO readback rule. |
| 9 | FDC의 신원확인 도전(`Authentication`)은 복창이 아니라 암호 응답(`"I authenticate …, out"`)으로 회신함 | fact | [MCWP 3-16.6](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt) | L5800-5801: FDC: "Authenticate ALFA, BRAVO, over." Observer: "I authenticate CHARLIE, out." |
| 10 | 야포 `'지명사(At My Command)'`에서만 FDC가 `"... is ready, over"`를 보내며 관측자는 복창 없이 `"Fire"`를 명령함 | fact | [MCWP 3-16.6](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt) | L5286-5289: "FDC announces 'section/platoon/battery/battalion is ready, over'... observer announces 'fire'" |
| 11 | 함포지원(NGF) 사전사격보고(`GTL`, `ready`, `TOF`, 위험근접 탄착확인)는 관측자가 전문 복창 후 `"break . . . fire"`를 명령함 | fact | [MCWP 3-16.6](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt) | L6435-6436: "The spotter reads back the entire prefiring report and commands 'break . . . fire.'" |
| 12 | 야포 FDC는 `"Record as target"` 시 조정좌표를 알리고(`§3303e(2)(a)`), 조건 시 `PEr`·`Angle T`·`TOF`를 별도 송신함(`FM 6-30 §4-11`) | fact | [MCWP 3-16.6](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt) | L7514-7516: "the FDC applies the refinement, conducts a replot when necessary, and announces the adjusted grid to the target." |
| 13 | 야포 FDC의 조정좌표 안내, `PEr`·`Angle T`·`TOF`, 감도점검 응답(`radio_check_reply`), 재효력사 응답(`repeat_ack`)에 대한 관측자 복창 의무는 1차 교범에서 미확인 | fact | unconfirmed | Searched mcwp_3_16_6.txt & fm6_30.txt for additional information, replot, radio check, repeat ack; none found. |
| 14 | 게임의 FDC 위험근접 3종 통보(`적용`, `조정 후 효력사`, `수정량 100 이하`)는 미군 교범에 없는 게임 `설계` 규칙임(`m1-procedure.md:108-117`) | fact | [PRD/OBSERVER_PRD_v0.2.md](https://github.com/DomineYH/observer/blob/25ccf77/PRD/OBSERVER_PRD_v0.2.md#L93) | PRD L93: "설계(미군 교범의 포복 사격 원칙을 옮김). 검수 필요" |
| 15 | `FM 6-30 §4-13` 예시에서 관측자는 MTO(부대·변경·발수·표적번호) 전문을 복창하고 추가 데이터가 없으면 `"OUT"`으로 끝냄 | fact | [FM 6-30](https://archive.org/download/ost-military-doctrine-fm6_30/fm6_30_djvu.txt) | L4240-4246: FDC "Y, VT, 3 ROUNDS, TARGET AF2036, OVER." -> FO "Y, VT, 3 ROUNDS, TARGET AF2036, OUT." |
| 16 | 좌표법 임무에서 미전달 OT 방위각(`direction`)은 MTO 복창 시(또는 첫 수정량과 함께) 덧붙여 송신함(추가 송신 시 끝말 `OVER`) | fact | [MCWP 3-16.6](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt) | §3106 L5511-5513: "the observer transmits the direction when reading back the MTO or with the first subsequent correction in adjustment." |
| 17 | 미확인(용어 포인터): 검색 스니펫상 `해양경찰청 정보통신 운영규칙 [별표 6]`에 `복창`·`이상(OVER)`·`끝(OUT)`·`대기`가 보이나, 원문 미열람(`low`)이자 해경 규칙으로 육군 포병 출처가 아님 | fact | unconfirmed | search via web search tool for 해양경찰청 정보통신 운영규칙 별표 6; law.go.kr under maintenance 2026-11-13 (page unread; search-index snippet only) |
| 18 | `[2차 포인터]` `PRD` 예문의 원출처인 유용원의 군사세계 #88920은 MTO·사격준비 끝 복창 없이 `"하나발/마감탄 떳다, 잠깐대기"`를 사용함(`low`) | fact | [bemil #88920](https://bemil.chosun.com/nbrd/bbs/view.html?b_bbs_id=10040&num=88920) | 본문: "포대 사격준비 끝" "준비 쏴" "하나발 떳다 이상" "하나발 떳다 잠깐대기" |
| 19 | 현재 `PRD §4.3` `예문`은 `사격지휘통보`·`포대 사격준비 끝` 복창을 생략하고, `"하나발/마감탄 떳다, 이상"`에 `"잠깐대기"`로 복창함 | fact | [PRD/OBSERVER_PRD_v0.2.md](https://github.com/DomineYH/observer/blob/25ccf77/PRD/OBSERVER_PRD_v0.2.md#L113-L120) | PRD §4.3 L116: "FDC : 하나발 떳다, 이상. 관측: 하나발 떳다, 잠깐대기." |
| 20 | 미확인(용어 포인터): 검색 스니펫상 `해양경찰청 정보통신 운영규칙 [별표 6]`에 `오송`·`정송`·`재송/반복`이 보이나, 원문 미열람(`low`)이자 해경 규칙으로 육군 포병 출처가 아님 | fact | unconfirmed | search via web search tool for 해양경찰청 정보통신 운영규칙 별표 6; law.go.kr under maintenance 2026-11-13 (page unread; search-index snippet only) |
| 21 | 미군 교범 함포(NGF) 조항(`§3206b`, `§8-23b`)은 오복창 시 송신자가 `"Wrong"`+올바른 데이터를 보내고 오복창 측이 `"Wrong"`+정정본을 재복창하도록 규정함 | fact | [MCWP 3-16.6](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt) | §3206b L6536-6539: "If an error is made during a readback, the word 'wrong' followed by the correct data is transmitted" |
| 22 | 미군 야포 조항(`§4-8`, `§3110`)은 자기 송신·FDC 오복창 발견 시 `"Correction"`+수정 데이터(영향 요소 전체)를 보내고 올바른 복창을 받은 뒤 진행하도록 규정함 | fact | [FM 6-30](https://archive.org/download/ost-military-doctrine-fm6_30/fm6_30_djvu.txt) | §4-8 L3761-3763: "or that the FDC has made an error in the read back, he announces CORRECTION and transmits the correct data." |
| 23 | 미군 야포망에서 FDC가 관측자의 잘못된 MTO 복창을 지적하는 구두 예문(`Wrong`/`Correction`) 및 한국군 포병 교범의 `'틀렸음'`·`'정정'`·`'재송신'` 표현은 미확인 | fact | unconfirmed | Searched mcwp_3_16_6.txt §3110, fm6_30.txt §4-8, kli.korean.go.kr, kookbang.dema.mil.kr; no ROK manual readback correction phrase. |
| 24 | 일반 야포 사격(통제방법 미지정)은 화포가 준비되는 대로 사격(`when ready`)하고 MTO는 첫 수정 이전에 전달하며, MTO 복창 전 일반 발사를 금지하는 조항은 없음 | fact | [MCWP 3-16.6](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt) | L5282,5518-5519: "executed by the firing unit when ready." / "The MTO should be sent... before the first subsequent correction." |
| 25 | Copperhead 임무는 발사 전 MTO 송신이 필수이나 `"Shot"` 미복창 시 타이밍 유지를 위해 재송신하지 않으며, `"Designate"` 미응답 시만 `"Designate now"`를 재송신함 | fact | [MCWP 3-16.6](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt) | L19510-19512: "If an operator fails to acknowledge 'shot'... it will not be retransmitted because the operator's timing will be affected." |
| 26 | 정밀 등록사격(`FM 6-30 Ch 5`)에서 관측자의 MTO 응답은 관측 준비 완료를 의미함 | fact | [FM 6-30](https://archive.org/download/ost-military-doctrine-fm6_30/fm6_30_djvu.txt) | L6029: "The FO's response to the message to observer indicates that he is ready to observe." |
| 27 | 한국군 포병 야전교범상 관측자 복창 대기 vs 병행 규칙 및 한국 포병 구두 복창 절차 자체는 비공개로 공개 1차 자료에서 미확인(`m1-phrasing.md:12`) | fact | unconfirmed | m1-phrasing.md L12: "한국군 포병 관측·사격지휘 야전교범 및 통신보안 교범 원문은... 민간에 공개되지 않는다." |
| 28 | `PRD v0.2`는 실전 모드에서 플레이어가 기러기 교신을 받아 쓰거나 말하여 복창해야 진행하도록 설계 과제로 정의함 | fact | [PRD/OBSERVER_PRD_v0.2.md](https://github.com/DomineYH/observer/blob/25ccf77/PRD/OBSERVER_PRD_v0.2.md#L365) | PRD §8 L365: "없음(직접 입력 또는 음성). 기러기 교신을 플레이어가 복창해야 진행" |
| 29 | 현재 코드(`25ccf77`)는 MTO 복창 없이 `ready`를 병행 예약하고, `shot_readback`·`rounds_complete_readback`을 자동 발화하며, `ENDINGS`에 `'out'`과 `FORMATS`에 복창 입력이 없음 | fact | [src/sim/procedure.ts](https://github.com/DomineYH/observer/blob/25ccf77/src/sim/procedure.ts#L235-L300) | procedure.ts L276-277: "case 'shot_readback': say({ speaker: 'observer', ending: 'wait', kind: 'shot' });" |
| 30 | `[설계 제안]` 실전 모드에서는 MTO 필수 복창과 발사(`하나발 떳다`)·마감탄(`마감탄 떳다`) 복창을 도입하고, 끝말 `'out'`(`끝`) 지원 여부를 확정할 것을 제안 | proposal | — | 제안(Proposal): MTO 필수 복창 + 발사/마감탄 복창 도입, ENDINGS 'out'(끝) 지원 검토 |
| 31 | `[설계 제안]` `src/sim/inputs.ts`에 복창 입력을 추가해 오복창 시 FDC가 `"오송"`/`"정정"`으로 재복창을 요구하게 하고, `src/sim/queue.ts`의 `ACTS`는 append-only로 확장할 것을 제안 | proposal | — | 제안(Proposal): readback 입력·오송 정정 단계 추가 및 queue.ts ACTS append-only 준수 |
| 32 | `[설계 제안]` 일반 사격은 MTO 복창과 포대 준비를 병행하되 수정·지명사 발사 전 완료를 요구하고, `src/ui/Composer.tsx` 등에 복창 UI를 추가할 것을 제안 | proposal | — | 제안(Proposal): MTO 복창·사격준비 병행(수정 전 완료 게이트) 및 UI 복창 입력기 추가 |

---

## 1. 어느 기러기 교신을 관측자가 복창하는가

| 기러기(FDC) 교신 항목 | 복창 여부 | 근거 및 교범 조항 (`#`) | 한국 `예문` (`PRD §4.3`) · 현재 게임과의 차이 |
| --- | --- | --- | --- |
| **사격지휘통보 (MTO)** (사격부대·변경사항·발수·표적번호) | **복창함** (예외: 긴급제압은 MTO 없음) | `[#1]` `MCWP 3-16.6 §3107` (M1 `m1-procedure.md:89` 재확인), `FM 6-30 §4-13`; `[#2]` `§3107 Note` | `[#18][#19][#29]` `PRD §4.3` L113과 현재 `procedure.ts:235-238`은 MTO 후 관측자 복창이 없음 (`m1-procedure.md:89` 지적 사항과 동일) |
| **"발사" (`SHOT` / `하나발 떳다`)** | **복창함 (야포·박격포)** / **안 함 (함포 NGF)** | `[#3][#4]` `MCWP 3-16.6 §3109a`, `FM 6-30 L5992` (조정 매 발, 효력사 초탄 확인); `[#5]` NGF `§3205` | `[#19][#29]` `PRD §4.3` L116은 관측자 복창이 있으나 현재 코드는 1.2초 뒤 자동 발화(`shot_readback`, 끝말 `잠깐대기`) |
| **"탄착" (`SPLASH`, 5초 전 경보)** | **복창 안 함 (`MCWP 3-16.6 §3109b`)** *(고공파열·검색 포인터와 차이)* | `[#6]` `MCWP 3-16.6 §3109b` (`"Splash, out."`), `FM 6-30 §5-5n`; 단 `FM 6-30 §7-6` L13233 고공파열 등록은 `SPLASH, OVER.`, 미다운로드 `ATP 3-09.30` 웹 포인터(`low`)는 `"Splash, out"` 응답 언급 | `[#14]` `PRD §4.1` L83은 무전 교신 없이 화면 카운트다운으로 대체(`설계`) |
| **"사격 끝" (`ROUNDS COMPLETE` / `마감탄 떳다`)** | **1차 교범 미확인** *(보조 포인터·한국 예문은 복창)* | `[#7]` FDC 보고 정의만 수록(`MCWP §9014d`, Glossary); `[#8]` **미확인** (미다운로드 `ATP 3-09.30` 요약 포인터[`low`]만 `"Rounds complete, out"` 언급) | `[#18][#19][#29]` `PRD §4.3` L120은 `"마감탄 떳다, 잠깐대기"`로 복창하며 현재 코드는 자동 발화(`rounds_complete_readback`) |
| **신원확인 도전 (`Authentication`)** | **복창 안 함 (암구호 응답)** | `[#9]` `MCWP 3-16.6 §3108a`, `FM 6-30 §4-12a` (`Authenticate ALFA, BRAVO, over` -> `I authenticate CHARLIE, out`) | 게임에 미구현 |
| **사격준비 끝 (`Battery is ready` / `포대 사격준비 끝`)** | **복창 안 함 (야포 AMC)** / **복창함 (함포 NGF `ready [TOF]`)** | `[#10]` 야포 `§3104c(2)(a)`(지명사일 때만 송신, 관측자는 `"Fire"` 명령); `[#11]` NGF `§3204e(3)`(사전보고 전문 복창 후 `"break . . . fire"`) | `[#19]` `PRD §4.3` L114-115도 `"포대 사격준비 끝"` -> `"준비 쏴"`로 복창 없음 |
| **임무끝·표적기록 조정좌표 (`Record as target`)** | **조정좌표 복창 여부 미확인** (임무끝 자체는 관측자 선송·FDC 복창) | `[#12]` FDC의 조정좌표 안내 수록(`MCWP §3303e(2)(a)`, `m1-procedure.md:77`); `[#13]` 관측자 재복창 여부 **미확인** | 게임은 `Record as target` 미구현(`m1-procedure.md:88`), `end_of_mission`은 관측자 송신 후 종료 |
| **추가 정보 (`PEr`, `Angle T`, `TOF`)** | **미확인** (야포 MTO 별도 송신) | `[#12]` FDC 별도 송신 규칙 확인(`FM 6-30 §4-11`); `[#13]` 관측자 복창 의무 **미확인** (NGF에서는 `ready` 보고에 포함되어 복창) | 게임은 `PEr`·`Angle T`·`TOF` 무전 미송신(UI/자동 처리) |
| **위험근접 FDC 통보 3종** | **해당 없음 (`설계`)** | `[#14]` `PRD §4.1` L93, `src/sim/danger.ts:25-37`, `m1-procedure.md:108-117` (NGF만 위험근접 탄착 확인을 사전보고로 복창 `[#11]`) | 현재 게임은 `danger_close_*`가 `ending: 'over'`이나 관측자 복창은 요구하지 않음 |
| **통신 점검 응답 (`감명 양호`)** | **미확인** | `[#13]` 다운로드 교범에 포병 감도점검 복창 예문 없음; `m1-phrasing.md:25-30` (`설계`) | `PRD §4.3` L105-106 예문 수록(`설계`), `procedure.ts:214-218` 자동 응답 후 `idle` |
| **재효력사 응답 (`동제원 포대 ○발`)** | **미확인** | `[#13]` FDC 측 복창 성격을 띠는 게임 문구(`grammar.ts:154`, `procedure.ts:307-309`); 1차 교범 대응 예문 미확인 | `procedure.ts:308`에서 `ending: 'wait'` 후 바로 `ready` 진행 |

---

## 2. 무엇을 복창하며 끝말은 무엇인가

| 구분 | 교범·공개 규정 내용 (`#`) | 한국 `예문` (`PRD §4.3`) · 현재 코드와 비교 |
| --- | --- | --- |
| **복창 범위 (전문 vs 일부)** | `[#15]` `FM 6-30 §4-13` 기준 MTO 4요소(사격부대·변경사항·발수·표적번호) **전문을 그대로 복창**함. `[#3]` `"Shot"` 등 단문 통보도 동일 문구를 그대로 반복함. *(참고 포인터 `[#17]`: `해양경찰청 정보통신 운영규칙 [별표 6]` 검색 스니펫에 `복창` 용어가 보이나 `law.go.kr` 점검으로 원문 미열람·해경 규칙이라 육군 포병 출처가 아님, `unconfirmed`/`low`.)* | 현재 `procedure.ts:235-238`은 `mto`를 출력만 하고 관측자 복창 입력이 없음. |
| **MTO 복창에 덧붙이는 요소** | `[#16]` 좌표법(`grid`) 임무에서 관측자가 아직 관측-표적 방위각(`direction`)을 보내지 않았다면, **MTO 복창 뒤에 `Direction ○○○○`를 덧붙여** 보낼 수 있음(`MCWP 3-16.6 §3106`, `§2202a`, `FM 6-30 §5-4 L5984`). | 현재 게임(`PRD §4.4` L145, `procedure.ts:133`)은 첫 수정(`corr`)에서만 방향을 받도록 제한함. |
| **끝말 (`이상` / `끝` / `잠깐대기`)** | `[#3][#15]` 미군 교범은 FDC가 응답·복창을 기대하며 넘길 때는 **`OVER`**, 관측자가 복창만 마치고 상대의 재응답이 불필요할 때는 **`OUT`**으로 마침. 단, MTO 복창에 `Direction` 등 **응답이 필요한 새 데이터를 덧붙일 때는 `OVER`**로 끝냄(`[#16]`, `FM 6-30 L4087, L5984`). 한국어 용어 후보로 `해양경찰청 [별표 6]` 검색 스니펫(`[#17]`, `unconfirmed`/`low`)에 `이상(OVER)`·`끝(OUT)`·`대기(WAIT)`가 검색되나, 원문 미열람 및 해경 규칙이므로 한국 육군 포병의 공식 끝말 규범은 미확인임. | `[#18][#19][#29]` **충돌 지점**: `bemil #88920` 및 `PRD §4.3` L113, L116, L120은 FDC의 MTO 끝말과 관측자의 `"하나발/마감탄 떳다"` 복창 끝말에 **`잠깐대기`**를 사용하며, `src/sim/radio.ts:5`의 `ENDINGS`와 `src/content/radio/grammar.ts:41`에 **`'out'`(`끝`)이 아예 정의되어 있지 않음**. |

---

## 3. 잘못 복창했을 때 누가, 어떤 말로 정정하며 관측자는 다음 무엇을 말하는가

> **Part 3 결론 요약**: 1차 교범 원문으로 확인된 오복창·정정 절차는 미군 **함포지원(NGF, `MCWP 3-16.6 §3206b`, `FM 6-30 §8-23b`)의 `"Wrong"` + 올바른 데이터 상호 복창(`[#21]`)**과 미군 **야포(`MCWP 3-16.6 §3110`, `FM 6-30 §4-8`)의 관측자 `"Correction"`(`정정`) + 올바른 복창 대기(`[#22]`)**이다. 반면 야포망에서 FDC가 관측자의 MTO 오복창을 지적하는 구두 문구와 **한국 육군 포병 교범(`대외비`)의 오복창 지적·정정·재송신 표준어(`"틀렸음"`·`"오송"`·`"정정"` 등)는 공개 1차 자료에서 미확인(`[#23]`)**이다. `해양경찰청 정보통신 운영규칙 [별표 6]`(`[#20]`)은 육군 포병 교범이 아닌 **해양경찰청(Coast Guard) 행정규칙**이며 `law.go.kr` 점검으로 원문을 열람하지 못한 **`unconfirmed`(`low`) 검색 색인 스니펫 포인터**이므로, 한국 육군 포병 절차의 근거가 아니라 `"오송"`·`"정송"`·`"복창"`·`"이상"`·`"끝"` 용어 포인터로만 참고할 수 있다.

| 상황 | 누가·어떤 말로 정정하는가 (`#`) | 관측자가 다음 무엇을 말하는가 (`#`) | 한계 / 미확인 (`#`) |
| --- | --- | --- | --- |
| **관측자(수신자)가 복창을 틀렸을 때** *(원래 송신자인 FDC가 바로잡음)* | - **미군 함포지원(NGF, `§3206b`, `§8-23b`)**: 송신자가 **`"Wrong"` + 올바른 데이터**를 송신함 `[#21]`.<br>- **한국 포병**: 1차 교범 비공개로 **미확인** `[#23]`. *(참고 포인터 `[#20]`: 해경 `[별표 6]` 검색 스니펫에 **`"오송"`** 용어가 보이나 원문 미열람·해경 규칙임.)* | `[#21]` NGF `§3206b` 기준: 오복창한 관측자는 다음 턴에 **`"Wrong"` + 정정된 데이터**를 다시 읽어 복창함(`OVER` 또는 `OUT`). | `[#23]` 미군 야포 장(`MCWP §3110`, `FM 6-30 §4-8`)에는 FDC가 관측자의 MTO 오복창을 지적하는 대화 예문이 별도 수록되어 있지 않으며, 한국 육군 포병 교범(`대외비`)상 `"틀렸음"`·`"오송"`·`"정정"` 구두어는 **미확인**(`[#20]`은 해경 규칙·검색 포인터 한정). |
| **FDC가 관측자의 사격요구·수정을 잘못 복창했을 때** *(관측자가 바로잡음)* | `[#22]` 미군 야포·박격포(`§3110`, `§4-8`): 관측자가 **`"Correction"`**(`정정`)을 선언하고 올바른 데이터(영향받는 하위 요소 전체 포함)를 재송신함. *(참고 포인터 `[#20]`: 해경 `[별표 6]` 검색 스니펫에 자기 정정어 **`"정송"`**이 보이나 원문 미열람·육군 포병 출처 아님.)* | `[#22]` `FM 6-30 §4-8 L3788-3792`: 관측자는 FDC로부터 **올바른 복창(`OUT`/`OVER`)을 받은 뒤에야** 다음 사격요구 요소를 이어서 송신함. | 게임 `PRD §4.1` L94에 `"정정 / 재송신"`(`미군`)만 용어표에 있고 실제 교신 절차는 미구현. |
| **청취 실패로 다시 부를 때** | 미군 포병에서는 `"Repeat"`이 재발사 명령(`재효력사`)이므로 재송신 요청에는 **`"Say again"`**(`재송신`)을 사용(`m1-phrasing.md:82`, `MCWP 3-16.6 L9339`). *(해경 `[별표 6]` 검색 스니펫 `[#20]`에 `"재송/반복"`이 보이나 포병에서는 `Repeat` 충돌 위험으로 사용 금지.)* | 상대가 원래 교신을 재송신하면 정상 복창 절차를 수행함. | 한국 육군 포병의 청취 실패 재요청 구두어는 비공개 교범으로 미확인(`m1-phrasing.md:82`). |

---

## 4. 순서와 타이밍: FDC가 복창을 기다린 뒤 다음 단계로 가는지, 병행하는지

| 상황 / 단계 | 복창 대기 vs 병행 (`#`) | 근거 (`#`) |
| --- | --- | --- |
| **일반 야포 사격 (`준비되는 대로` / `When ready`)** | **병행 (발사 자체를 일반 MTO 복창 완료까지 보류하지 않음)**. 통제방법 미지정 시 화포는 준비되는 대로 사격하며, MTO는 **첫 후속 수정 이전(`before the first subsequent correction`)**까지 전달됨. 단, 관측자가 아직 OT 방위각을 보내지 않았다면 첫 조정 전까지는 MTO 복창 또는 첫 수정에 방위각 전달이 필수임. | `[#24]` `MCWP 3-16.6 §3104c(2)` L5281-5282, `§3107` L5518-5519; `[#16]` `§2202a`, `§3106` |
| **Copperhead 정밀유도 임무** | **MTO는 발사 전 필수 / `"Shot"` 복창은 비대기(병행) / `"Designate"`는 응답 대기**. MTO는 PRF 코드·TOF 전달 때문에 발사 전에 보내며(`FM 6-30 L12227-12228`), `"Shot"` 미복창 시 **타이밍 훼손을 막기 위해 재송신하지 않음**. 반면 `"Designate"` 미응답 시 `"Designate now"`를 반복 송신하며, `"Rounds complete"`는 마지막 교전명령 **수신확인 후** 보고함. | `[#25]` `MCWP 3-16.6 §9014a,c,d` L19510-19557, `FM 6-30 L12227-12228, L12270-12272` |
| **정밀 등록사격 (`Precision Registration`)** | **MTO 응답 후 관측 준비 개시**. 관측자의 MTO 응답 자체가 관측 준비가 되었음을 알리는 신호 역할을 함. | `[#26]` `FM 6-30 Ch 5` L6029 (`"indicates that he is ready to observe."`) |
| **지명사 (`At My Command`) & 함포 (NGF)** | **관측자 명령/복창 대기 후 발사**. 야포 지명사는 `"... is ready, over"` 뒤 관측자의 `"Fire"` 명령을 기다려 발사하며, 함포(NGF)는 사전사격보고(`ready [TOF]`) **전문을 관측자가 복창하고 `"break . . . fire"`를 명령**해야 발사함. | `[#10]` `MCWP 3-16.6 §3104c(2)(a)`, `[#11]` `§3204e(3)` |
| **초기 사격요구(CFF) 복창 오류·인증** | **올바른 복창 확인 후 다음 단계 진행**. 3회 분할 CFF 매 부분 뒤 FDC 복창이 따르며(`§3101`), `Correction` 후 올바른 복창을 받아야 계속함(`FM 6-30 L3788-3792`). 인증 응답 20초 초과 시 재도전(`§3108a L5784-5785`). | `[#22]` `FM 6-30 §4-8`, `MCWP §3101 L4742-4744`, `§3108a L5784-5785` |
| **한국군 야전교범 기준** | **미확인** (비공개 교범). `bemil #88920` 포인터(`low`)에서는 MTO 복창 없이 곧바로 `포대 사격준비 끝 -> 준비 쏴`로 진행함. | `[#27]` `unconfirmed`, `[#18]` `bemil #88920` |

---

## 5. 보고된 모든 표현의 PRD §4.1 출처 태그 (`예문` · `공개` · `미군` · `추정` · `설계`)

> `예문`은 `PRD/OBSERVER_PRD_v0.2.md`의 인용 교신 예문(`§4.3` 등)에 직접 등장하는 문구에만 부여함. `PRD §4.3` 예문 블록 안에 있더라도 `PRD §4.1` 표에서 `설계`로 명시된 문구는 `설계`로 구분 병기함.

| 표현 / 문구 | 출처 태그 | 근거 및 출처 비고 (`#`) |
| --- | --- | --- |
| `사격지휘통보, 포대, 접근신관, 하나발, 지명사, 표적번호 알파브라보 하나공공하나, 잠깐대기` | `예문` + `설계` | `PRD §4.1` L77(`예문 + 설계`), `§4.3` L113 (`[#19]`; 표적번호 위치·읽기 `설계`) |
| `하나발 떳다` / `마감탄 떳다` | `예문` | `PRD §4.1` L81-82, `§4.3` L116, L120 (`[#18][#19]`) |
| `포대 사격준비 끝` / `[신관] 사격준비 끝` / `준비 쏴` | `예문` | `PRD §4.1` L79-80, `§4.3` L114-115, L118-119 (`[#19]`) |
| `잠깐대기` (복창 끝맺음 포함) | `예문` | `PRD §4.1` L67, `§4.3` L112, L113, L116, L120 (`[#18][#19]`) |
| `이상` (`OVER`) | `예문` + `미확인 포인터` | `PRD §4.3` L105-125(`예문`) + `해양경찰청 [별표 6]` 검색 포인터(`[#17][#19]`, 원문 미열람 `low`·해경 규칙) |
| `끝` (`OUT`, 응답 불필요 복창 끝말) | `미군` + `미확인 포인터` | `MCWP 3-16.6`/`FM 6-30` `"out"`(`[#3][#15]`) + `해양경찰청 [별표 6]` 검색 포인터(`[#17]`, 원문 미열람 `low`·육군 포병 출처 아님) |
| `대기` (`WAIT`) / `복창` / `응답` | `미확인 포인터` *(해경 공개규칙)* | `해양경찰청 [별표 6]` 검색 포인터(`[#17]`, `confidence: low`, `law.go.kr` 점검으로 원문 미열람·육군 포병 출처 아님) |
| `오송` / `정송` / `재송` | `미확인 포인터` *(해경 공개규칙)* | `해양경찰청 [별표 6]` 검색 포인터(`[#20]`, `confidence: low`, `law.go.kr` 점검으로 원문 미열람·육군 포병 출처 아님) |
| `정정` (`Correction`) / `재송신` (`Say again`) | `미군` | `PRD §4.1` L94(`미군`), `MCWP 3-16.6 §3110`·`FM 6-30 §4-8` (`[#22]`), `m1-phrasing.md:75-82` |
| `Wrong` (오복창 정정어, 한국어 옮김 예: `"틀렸음"`) | `미군` (원어) / `추정`·`설계` (한국어) | `MCWP 3-16.6 §3206b`, `FM 6-30 §8-23b` (`[#21]`); 한국어 포병 구두어는 미확인(`[#23]`) |
| `방향 ○○○○` (MTO 복창 시 덧붙임 포함) | `미군` | `PRD §4.1` L75(`미군`), `MCWP 3-16.6 §3106` (`[#16]`) |
| `탄착` (`Splash`, 5초 전 경보) | `미군` (원어) / `설계` (게임 내 교신 생략) | `MCWP 3-16.6 §3109b`, `FM 6-30 §5-5n` (`[#6]`); `PRD §4.1` L83 교신 생략은 `설계` |
| `사격 끝` (`Rounds complete`) / `Battery is ready` / `Fire` / `Shot` | `미군` | `MCWP 3-16.6 §3104c(2)(a)`, `§3109a`, `§9014d`, Glossary (`[#3][#7][#10]`) |
| `Authenticate ALFA, BRAVO` / `I authenticate CHARLIE` | `미군` | `MCWP 3-16.6 §3108a`, `FM 6-30 §4-12a` (`[#9]`) |
| `Record as target` (조정좌표 안내) / `PEr` / `Angle T` / `TOF` | `미군` | `MCWP 3-16.6 §3303e(2)(a)`, `FM 6-30 §4-11` (`[#12]`) |
| `감명 보고` / `감명 양호` | `설계` *(PRD §4.3 예문 내 수록)* | `PRD §4.1` L69가 명시적 `설계` 분류 (`m1-phrasing.md:25-30`, `grammar.ts:92-93`) |
| `표적이 아군 600 m 이내, 위험근접 적용` / `위험근접, 조정 후 효력사` / `위험근접, 수정량 100 이하로 재송신` | `설계` *(PRD §4.3 예문 내 수록)* | `PRD §4.1` L93 및 `src/content/radio/grammar.ts:124-126` 명시적 `설계` (`[#14]`) |
| `동제원 포대 ○발` (`repeat_ack`, FDC 회신) | `추정` / `설계` | `PRD §4.1` L87 관측자 `"재효력사, 동제원, 포대 둘발"`(`예문`)의 대칭 응답(`grammar.ts:154`) |

---

## 6. "플레이어가 기러기 교신을 복창" 구현을 위해 게임에 필요한 사항

현재 `PRD/OBSERVER_PRD_v0.2.md`(§8 L365, §11.2 L547)는 실전 모드에서 플레이어가 기러기 교신을 받아 쓰거나 말해야 진행하도록 규정하나(`[#28]`), 커밋 `25ccf77` 기준 코드는 반대 방향(기러기만 갈매기를 복창)으로만 구현되어 있다(`[#29]`). 실제 교범 조사 결과에 따른 구현 필요 사항은 다음과 같다.

1. **복창 대상 선별 (`[#30]`, proposal)**:
   - **필수 1순위**: `사격지휘통보 (MTO)` 복창(`MCWP 3-16.6 §3107`, `[#1]`) — 사격부대·신관(변경사항)·발수·지명사 여부·표적번호 전문 복창(`[#15]`). 필요 시 아직 방향을 보내지 않은 좌표법 임무에서는 MTO 복창 뒤에 `방향 ○○○○`를 덧붙일 수 있도록 허용(`[#16]`, 현재 `src/sim/procedure.ts:133`은 첫 `corr`에서만 방향 허용).
   - **2순위(교범·예문 부합)**: `"하나발 떳다"`(`SHOT`, `[#3][#4]`)와 `"마감탄 떳다"`(`PRD §4.3` 예문 반영, `[#19]`) 복창을 플레이어 입력으로 전환. 현재 `src/sim/procedure.ts:251, 276-278, 296-300`은 `shot_readback`과 `rounds_complete_readback`을 `1.2s` 뒤 자동 생성함(`[#29]`).
   - **비복창 유지**: `"포대 사격준비 끝"`(관측자가 `"준비 쏴"` 입력, `[#10]`), `"탄착"`(현재 미송신 `설계`, `[#6]`), `"감명 양호"`(`[#13]`), 위험근접 FDC 안내(`[#14]`).
2. **끝말 및 문법 확장 (`[#30]`, proposal)**:
   - `src/sim/radio.ts:5`의 `ENDINGS`(`['over', 'wait', 'none']`)와 `src/content/radio/grammar.ts:41`의 `endings`(`over`, `wait`)에는 **`'out'`(`"끝"`)이 없음**(`[#29]`).
   - 미군 교범(`[#15]`) 및 해경 용어 포인터(`[#17]`) 정합성을 택한다면 `'out'`(`"끝"`)을 추가해 응답이 필요 없는 복창 종료에 쓰고(방향을 덧붙이는 MTO 복창만 `'over'`), 기존 `PRD §4.3` 한국 `예문` 통일성을 중시하면 `"잠깐대기"`를 유지하거나 두 끝말 모두 수용하는 설계 결정이 필요함.
3. **입력 규격·오복창 정정 루프·상태해시 호환 (`[#31]`, proposal)**:
   - `src/sim/types.ts`의 `MODES`에 실전 모드 식별자를 추가하고, `src/sim/inputs.ts:29-50`의 `FORMATS`에 플레이어 복창 입력(예: `readback`)을 추가해야 리플레이 검증(`validInput`)과 `Sim.step`이 수락할 수 있음.
   - 플레이어가 MTO 슬롯(신관·발수·표적번호 등)을 틀리게 입력·발화하면, FDC가 **`"오송, [올바른 내용], 이상"`**(`[#20]` 해경 규칙 용어 포인터·미확인) 또는 **`"틀렸음 / 정정, [올바른 내용], 이상"`**(`설계`, NGF `[#21]` 대응)으로 되돌려 보내고 플레이어가 다시 정확히 복창할 때까지 해당 복창 단계를 유지하도록 `src/sim/procedure.ts`와 `src/content/radio/grammar.ts`를 확장함.
   - `src/sim/queue.ts:4-8`의 `ACTS` 튜플은 `src/sim/stateHash.ts`가 인덱스로 해시하므로 **append-only 원칙**을 지켜 기존 `shot_readback`·`rounds_complete_readback` 등을 지우거나 순서를 바꾸지 말고 새 act만 뒤에 추가해야 함.
4. **타이밍 게이트 (`[#32]`, proposal)**:
   - 현재 `src/sim/procedure.ts:126-128`은 `desc` 시점에 `mto`(`9~12s`)와 `ready`(`24~38s`)를 **병행 예약**하고 있으며, 이는 일반 사격의 `when ready` 병행 원칙(`[#24]`)과 부합함.
   - 따라서 실전 모드에서도 **일반 사격의 MTO 복창은 포대 준비(`ready`)와 병행**시키되, 첫 수정 입력(`adjust`/`effect`) 전까지(그리고 `지명사(amc)` 임무라면 `"준비 쏴"` 입력 전까지) MTO 복창 완료를 요구하는 게이트가 교범(`§3107`, `[#24]`)에 가장 부합함.
   - `"하나발 떳다"`·`"마감탄 떳다"` 미복창으로 포탄 비행(`impact`)·`effect_open` 타이밍을 멈추면 안 됨(`[#25]` Copperhead timing 보호 원칙 및 현재 `procedure.ts:251-274` 구조와 일치); 미복창 시 타임아웃 경고/감점 또는 재촉 처리로 분리하는 편이 자연스러움.
5. **UI 및 음성·직접 입력 연결 (`[#32]`, proposal)**:
   - `src/ui/Composer.tsx`·`src/ui/radio/drafts.ts`·`src/ui/radio/sentence.ts`는 현재 관측자 주도 송신 폼과 미리보기만 다루므로, 실전 모드에서 기러기 교신이 수신되었을 때 플레이어가 문장을 직접 입력하거나 음성으로 받아쓰기·말하기(`PRD §8 L365`, `§11.2 L547`)로 복창을 전송할 수 있는 복창 입력 경로가 필요함. (`src/sim/danger.ts`는 변경 없이 `src/sim/procedure.ts` 단계 가드와 연계 가능.)

---

## 7. 확인 불가 항목 (Unconfirmed)

1. **`"사격 끝" (ROUNDS COMPLETE / 마감탄 떳다)`의 야포 관측자 복창 의무 (`#8`)**: `MCWP 3-16.6`(`L19555-19557, L27980-27982`)과 `FM 6-30`(`L12313-12315`)은 FDC 보고 정의만 싣고 관측자 복창 대화 예문은 없음. `ATP 3-09.30` 텍스트가 `archive.org`에 없어 원문 PDF를 확인하지 못함(웹 검색 포인터만 존재, `low`). 한국군 야전교범 또한 비공개임.
2. **기타 FDC 송신(`Record as target` 조정좌표, `PEr`·`Angle T`·`TOF`, 감도점검 응답, 재효력사 응답)의 관측자 복창 여부 (`#13`)**: 다운로드된 `MCWP 3-16.6`·`FM 6-30`에서 FDC 송신 규정은 확인되나 관측자 복창 예문·의무가 명시되지 않음.
3. **야포망에서의 FDC 오복창 지적 구두 문구 및 한국군 정정·오복창·재송신 표준어 (`#23`)**: `MCWP 3-16.6 §3206b`·`FM 6-30 §8-23b`의 `"Wrong"`은 함포지원(NGF) 조항에 있고 야포 조항(`§3110`, `§4-8`)에는 관측자 `"Correction"`만 예시됨. 한국 육군 포병 교범이 `"오송"`·`"정송"`(해경 `[별표 6]`은 미열람 검색 포인터 `#20`)을 쓰는지 `"정정"`·`"틀렸음"`·`"재송신"`을 쓰는지는 공개 1차 자료로 확인 불가.
4. **한국군 포병 교범상의 복창 대기 vs 병행 타이밍 및 관측자 MTO 복창 여부 (`#27`)**: 한국군 포병·통신보안 교범이 대외비이므로(`m1-phrasing.md:12`), 한국군 교범 원문 기준으로 관측자가 `사격지휘통보`를 실제로 복창하는지(2차 포인터 `bemil #88920`은 생략)와 복창 완료 전 발사 대기 여부는 공개 자료에서 확정 불가.
5. **`해양경찰청 정보통신 운영규칙 [별표 6]` 원문 (`#17`, `#20`)**: `law.go.kr` 시스템 점검(`2026-11-13`)으로 원문 페이지를 열람하지 못해 검색 색인 스니펫(`low`)에 의존해 `unconfirmed`로 분류함. 또한 이 규정은 육군 포병 출처가 아닌 해양경찰청(Coast Guard) 행정규칙이므로 `오송`·`정송`·`복창`·`이상`·`끝` 용어의 참고 포인터로만 사용할 수 있음.
