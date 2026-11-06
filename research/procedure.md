# 조사 보고서: 한국군 사격요구 절차 구조 (방향·표적번호·위험근접) — Issue #2 (`research-2-o1`)

- **조사 일자:** 2026-11-06
- **대상 이슈:** [DomineYH/observer#2](https://github.com/DomineYH/observer/issues/2)
- **비교 기준 코드/문서:** `PRD/OBSERVER_PRD_v0.2.md`, `PRD/OBSERVER_demo_v0.2.html` (커밋 `a2b3c48`)
- **보안 및 출처 원칙:** 공개 자료만 사용(비공개 야전교범·음어표·부대 고유 SOP 제외). 1차 공식 문헌(미 육군 야전교범 `FM 6-30`, 미 해병대 교범 `MCWP 3-16.6`, 미 해병대 교육사령부 `B2C2437`, 국내 국방/통신 학술논문)을 근거로 사실을 확정하고, 한국군 야전교범 비공개로 인해 2차 자료(군사 커뮤니티·위키·시뮬레이터)로만 파악되는 사항은 한계(`limitations`) 및 `확인 불가(Unverifiable)`로 분리 기록함.

---

## 요약 비교표 (데모 v0.2 대비 판정)

| 구분 | 세부 질문 항목 | 1차 공개 교범(미군/연합 포술) 기준 판정 | 한국군 고유 야전교범(공개 1차 자료) 기준 판정 | 핵심 근거 출처 |
| --- | --- | --- | --- | --- |
| **1. 방향** | 방안좌표 사격 시 첫 수정 앞에 `"방향 ○○○○"` 송신 | **같음 (Same)** — 최초 3회 사격요구에는 미포함, 첫 수정 맨 앞 요소로 송신 | **확인 불가 (Unverifiable)** — 한국군 학술논문상 `관목방위각` 원리는 동일하나 실제 음성 문구·위치는 비공개 | [MCWP 3-16.6 §3106, §3302b](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt), [FM 6-30 §4-4a, §5-5a](https://archive.org/download/ost-military-doctrine-fm6_30/fm6_30_djvu.txt), `OBSERVER_demo_v0.2.html:805-812` |
| **1. 방향** | 사격요구(2차 표적위치 또는 3차 송신)에 넣는 경우 및 사전·재송신 | **일부 같음 / 일부 다름 (Partial / Different)** — 극좌표·기지점전이 2차 송신 포함 및 3차 송신(장방형 표적 장축 방위각)은 같으나, MTO 복창 시 사전 송신·100밀 변경 시 재송신 미지원은 다름 | **확인 불가 (Unverifiable)** — 공개 1차 한국군 자료 미수록 (2차 예문에서는 첫 수정 방향 생략 사례 존재) | [MCWP 3-16.6 §3103, §3104a, §3302b](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt), `OBSERVER_demo_v0.2.html:722-728, 805` |
| **2. 표적번호** | 부여 주체(FDC)와 시점(사격지휘통보/MTO 4번째 요소) | **같음 (Same)** — 임기표적은 FDC가 사격지휘통보(MTO) 마지막(4번째) 요소로 부여 | **일부 확인 / 세부 문형 확인 불가** — 학술논문상 BTCS의 표적번호 부여·관리는 확인되나 음성 사격지휘통보 문형은 비공개 | [FM 6-30 §4-10d](https://archive.org/download/ost-military-doctrine-fm6_30/fm6_30_djvu.txt), [MCWP 3-16.6 §3107d](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt), [한성대 논문(2021)](https://dspace.hansung.ac.kr/bitstream/2024.oak/9207/2/200000360828.pdf), `OBSERVER_demo_v0.2.html:735-737` |
| **2. 표적번호** | 번호 체계(영문 2자 + 숫자 4자)와 읽는 법(포네틱 + 단자리 숫자) | **같음 (Same)** — `AA7732` / `AB1037` 형태(영문 2글자 + 숫자 4자리), 포네틱 알파벳 + 자릿수별 숫자 읽기 | **확인 불가 (Unverifiable)** — 한국군 음성 호창 표준 문구(`"표적번호 알파브라보 하나공공하나"`)는 1차 공개 문헌 미수록 | [MCWP 3-16.6 §3107d, §3203c](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt), [FM 6-30 §4-10d](https://archive.org/download/ost-military-doctrine-fm6_30/fm6_30_djvu.txt), `OBSERVER_demo_v0.2.html:694-695` |
| **2. 표적번호** | 전이사격이 직전 표적번호를 기준점으로 삼는지 및 송신 구조 | **기준점 개념 같음 / 상태 기계 구조 다름 (Different)** — 이전 표적번호 참조는 같으나, 교범은 `'Record as target'`(표적기록)이 선행되어야 하고 3회 분할 송신으로 보냄(데모는 표적기록 없이 직전 번호 자동 참조 + 1회 압축 송신) | **확인 불가 (Unverifiable)** — 한국군 야전교범상 약식 1회 송신(`"전이사격, ..."`) 허용 여부는 공개 1차 자료 미수록 | [MCWP 3-16.6 §2203, §3102b, §3103c, §3303d(2)](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt), [FM 6-30 §4-3c(3), §4-4b](https://archive.org/download/ost-military-doctrine-fm6_30/fm6_30_djvu.txt), `OBSERVER_demo_v0.2.html:834-847` |
| **3. 위험근접** | 기준 거리 600 m 및 3차 송신(공격방법) 선언 | **같음 (Same)** — 야포·박격포 아군 600 m 이내 시 공격방법(3차 송신)에 `'Danger Close'` 선언 (단, 수정 중 진입/해제 `'CANCEL DANGER CLOSE'` 미구현은 다름) | **확인 불가 (Unverifiable)** — 한국군 야전교범 원문 비공개 (2차 자료에서는 동일하게 600 m 기준으로 기술) | [FM 6-30 §4-6b, §5-5b](https://archive.org/download/ost-military-doctrine-fm6_30/fm6_30_djvu.txt), [MCWP 3-16.6 §3104b(2)](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt), `OBSERVER_demo_v0.2.html:740-745` |
| **3. 위험근접** | 바로 효력사 금지 여부 (`"위험근접, 조정 후 효력사"`) | **다름 (Different)** — 교범은 조정사격 시 포복 사격법을 의무화하나, 정확한 표적 위치/사전계획·레이저 FPF에서는 비조정 효력사도 허용하며 FDC의 일괄 효력사 거부 규정은 없음 | **확인 불가 (Unverifiable)** — PRD §4.1이 명시한 게임 설계 규칙이며 한국군 1차 공개 자료에서 미확인 | [MCWP 3-16.6 §5801-5802, Fig 5-28](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt), [FM 6-30 §5-6d](https://archive.org/download/ost-military-doctrine-fm6_30/fm6_30_djvu.txt), `OBSERVER_demo_v0.2.html:746, 844` |
| **3. 위험근접** | 수정량 상한(축당 100 m)과 포복 사격(Creeping Fire) 원칙 | **핵심 원칙 같음 / 적용 범위·문구 다름 (Different)** — 100 m 이하 점진 수정 원칙은 같으나, 교범은 사거리(아군 방향 접근) 수정을 100 m 이하로 제한하는 반면 데모는 좌우·사거리 양축 모두 방향 무관 100 m로 제한하고 FDC 거부 문구를 둠 | **확인 불가 (Unverifiable)** — 한국군 교범의 Creeping Fire 번역어 및 FDC 재송신 요구 문구는 공개 1차 자료 미확인 | [FM 6-30 §5-6d](https://archive.org/download/ost-military-doctrine-fm6_30/fm6_30_djvu.txt), [MCWP 3-16.6 §3302e(4)(a)](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt), `OBSERVER_demo_v0.2.html:806-807` |

---

## 1. 방향 (Observer-Target Direction)

### 1.1 질문 요지
- `"방향 ○○○○"`을 첫 수정 앞에 보내는가, 사격요구(표적위치 또는 세 번째 송신)에 넣는 경우가 있는가?
- 데모 v0.2의 동작과 같음 / 다름 / 확인 불가 여부.

### 1.2 1차 공개 교범 조사 결과
1. **방안좌표(Grid) 사격요구에서의 송신 시점:**
   - 미 육군 야전교범 `FM 6-30` (§4-4a, §5-5a) 및 미 해병대 `MCWP 3-16.6` (§2202a, §3106, §3302b)에 따르면, 야포·박격포의 방안좌표 사격요구에서는 FDC가 초기 사격제원을 계산할 때 관측자-표적 방향(OT direction)이 필요하지 않으므로 **최초 3회 사격요구 송신에는 방향을 넣지 않는다** ([FM 6-30 §4-4a, p. 4-2](https://archive.org/download/ost-military-doctrine-fm6_30/fm6_30_djvu.txt), [MCWP 3-16.6 §3106, p. 3-18](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt)).
   - 방안좌표 임무에서 OT 방향(10밀 단위, 4자리 숫자)은 **① 사격요구 완료 직후, ② 사격지휘통보(MTO)를 복창할 때, 또는 ③ 첫 번째 후속 수정(first subsequent correction)과 함께(또는 그 직전에)** 송신한다 ([MCWP 3-16.6 §2202a, p. 2-38; §3106, p. 3-18; §3302b, p. 3-47](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt)).
   - 첫 수정에서 방향을 보낼 때는 후속 수정 순서(Sequence of Subsequent Corrections)의 **첫 번째 항목**으로 모든 다른 수정 요소(좌우 편의·사거리·파열고)보다 앞에 위치한다 (`"DIRECTION 1680, LEFT 50, ADD 200, OVER"`) ([FM 6-30 §5-5a, p. 5-6](https://archive.org/download/ost-military-doctrine-fm6_30/fm6_30_djvu.txt), [MCWP 3-16.6 Table 3-1, p. 3-49](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt)).
   - 또한 조정 도중 표적 이동 등으로 기존 OT 방향이 **100밀(또는 5도) 이상 변경**되면 새 방향을 다시 송신해야 한다 ([FM 6-30 §5-5a, p. 5-6](https://archive.org/download/ost-military-doctrine-fm6_30/fm6_30_djvu.txt), [MCWP 3-16.6 §3302b, p. 3-47~3-48](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt)).
2. **사격요구(2차 송신 표적위치 또는 3차 송신)에 방향이 들어가는 경우:**
   - **2차 송신(표적위치)에 들어가는 경우:**
     - **극좌표법(Polar Plot):** 2차 송신 첫머리에 `"Direction ○○○○, distance ○○○○"` 형태로 반드시 포함된다 ([FM 6-30 §4-4c, p. 4-2](https://archive.org/download/ost-military-doctrine-fm6_30/fm6_30_djvu.txt), [MCWP 3-16.6 §3103b, p. 3-4](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt), [USMC TBS B2C2437](https://www.trngcmd.marines.mil/Portals/207/Docs/TBS/B2C2437%20Call%20For%20Indirect%20Fire.pdf)).
     - **기지점 전이(Shift from a Known Point):** 2차 송신 첫머리에 `"Direction ○○○○, Left/Right ○○, Add/Drop ○○"` 형태로 반드시 포함된다 ([FM 6-30 §4-4b, p. 4-2](https://archive.org/download/ost-military-doctrine-fm6_30/fm6_30_djvu.txt), [MCWP 3-16.6 §3103c, p. 3-4~3-5](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt)).
     - *(참고: 해군 함포사격[NGF]에서는 방안좌표 사격이라도 관측자 조정 시 2차 송신 표적위치에 방향을 함께 보낸다 — [MCWP 3-16.6 §2202b, p. 2-38](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt)).*
   - **3차 송신(표적성질·공격방법·통제방법)에 방위각이 들어가는 경우:**
     - 3차 송신에는 관측자-표적 방향(OT direction)은 들어가지 않는다. 다만 표적이 길이·폭 200 m 이상의 **장방형·선형 표적(rectangular/linear target)**일 때 표적성질(Target Description)의 하위 요소로 **표적 자체의 장축 방위각(attitude, 0000~3199밀, 100밀 단위)**을 `"400 BY 200, ATTITUDE 2800"` 형태로 포함한다 ([FM 6-30 §4-5, p. 4-3](https://archive.org/download/ost-military-doctrine-fm6_30/fm6_30_djvu.txt), [MCWP 3-16.6 §3104a(1), p. 3-6](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt)). 이는 PRD §4.1의 대대 사격 표적 예문(`"표적크기 200×500m, 방위각 800밀"`, `PRD/OBSERVER_PRD_v0.2.md:90`)에 대응한다.
3. **한국군 공개 문헌 검토 (한계 및 2차 자료):**
   - 한국군 포병 자동화 화력지휘 관련 학술논문([한국통신학회논문지 KICS NODE01552797](https://engjournal.kics.or.kr/digital-library/manuscript/file/33792/NODE01552797.pdf), [한성대 석사학위논문 2021](https://dspace.hansung.ac.kr/bitstream/2024.oak/9207/2/200000360828.pdf))에서 한국군 사격요구 6요소와 관목방위각(OT azimuth)을 이용한 편차 수정 원리가 미군 교범(`FM 6-30`) 체계와 동일함은 확인된다.
   - 그러나 한국군 육군 야전교범(`야교 6-40 대포포술` 등) 원문은 비공개 군사자료이므로 실제 음성 무전에서 `"방향 ○○○○"`이라고 부르는지, `"관목방위각 ○○○○"`이라고 부르는지, 혹은 FDC가 관측소 좌표를 이미 알고 있을 때 생략하는지는 1차 공개 자료로 **확인 불가**이다. (2차 자료인 [유용원의 군사세계 게시글 #88920](https://bemil.chosun.com/nbrd/bbs/view.html?b_bbs_id=10040&num=88920)에서는 방안좌표 첫 수정 시 방향 없이 바로 `"우로 50, 줄이기 하나백"`을 송신함).

### 1.3 데모 v0.2 동작과의 비교 판정
- **같음 (Same — 1차 미군 교범 기준):**
  - 방안좌표 사격요구의 최초 3회 송신에 방향을 넣지 않고, 첫 수정(`sendCorr`) 문장 맨 앞에 `"방향 ○○○○"`을 붙여 송신하며(`PRD/OBSERVER_demo_v0.2.html:805-812`), 극좌표 사격요구에서는 2차 송신(`sendLoc('polar', ...)`)에 방위각을 포함해 그 값을 기준선으로 삼는 동작(`PRD/OBSERVER_demo_v0.2.html:722-728`)은 `FM 6-30` §4-4, §5-5a 및 `MCWP 3-16.6` §3103b, §3106, §3302b와 일치한다.
- **다름 (Different — 1차 미군 교범 기준):**
  1. 교범(`MCWP 3-16.6` §2202a, §3106, §3302b)은 방안좌표 임무에서 사격요구 직후나 MTO 복창 시점에 방향을 미리 보내는 것도 허용하고, 조정 중 OT 방향이 100밀 이상 바뀌면 방향을 재송신하도록 규정하나, 데모 v0.2는 오직 첫 수정(`sendCorr`에서 `m.dir==null`일 때)에서만 1회 입력받고 이후에는 `dir=null`로 고정해 변경할 수 없다 (`PRD/OBSERVER_demo_v0.2.html:805`).
  2. 또한 방안좌표로 최초 `효력사`를 걸고 수정 없이 `임무끝`(`sendEOM`)으로 종료하는 경우, 데모 v0.2에서는 플레이어가 방향을 한 번도 보낼 기회가 없다 (`PRD/OBSERVER_demo_v0.2.html:705, 829-832`).
- **확인 불가 (Unverifiable — 한국군 고유 음성 절차 기준):**
  - 한국군 야전교범에서 첫 수정 시 실제 호창 단어가 `"방향 ○○○○"`인지 여부 및 생략 조건은 공개 1차 자료 부재로 **확인 불가**.

---

## 2. 표적번호 (Target Number) 및 전이사격 (Shift from a Known Point)

### 2.1 질문 요지
- 누가, 어느 시점(사격지휘통보?)에 부여하는가?
- 번호 체계와 읽는 법은 무엇인가?
- 전이사격이 직전 표적번호를 기준점으로 삼는가?
- 데모 v0.2의 동작과 같음 / 다름 / 확인 불가 여부.

### 2.2 1차 공개 교범 조사 결과
1. **부여 주체와 부여 시점:**
   - `FM 6-30` (§4-10d) 및 `MCWP 3-16.6` (§3107d)에 따르면, 야포·박격포의 임기표적(target of opportunity)에 대한 표적번호는 **사격지휘소(FDC)**가 부여하며, 관측자의 사격요구를 접수한 뒤 첫 수정 전에 관측자에게 보내는 **사격지휘통보(Message to Observer, MTO)의 4번째(마지막) 요소**(`① 사격부대 → ② 변경사항 → ③ 효력사 발수 → ④ 표적번호`)로 통보한다 ([FM 6-30 §4-10, p. 4-6](https://archive.org/download/ost-military-doctrine-fm6_30/fm6_30_djvu.txt), [MCWP 3-16.6 §3107, p. 3-18~3-19](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt)).
   - 예외적으로, 화력지원계획에 의해 사전 계획된 표적(planned target)은 이미 부여된 표적번호를 관측자가 사격요구(경고명령/표적위치)에서 호출하며([FM 6-30 §4-3a(3), p. 4-1](https://archive.org/download/ost-military-doctrine-fm6_30/fm6_30_djvu.txt), [MCWP 3-16.6 §3105a, p. 3-16](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt)), 해군 함포사격(NGF)에서는 관측자(spotter)가 1차 송신에서 할당 블록 내 번호를 직접 부여한다 ([MCWP 3-16.6 §3203c, p. 3-26](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt)).
   - 한국군 포병 관련 1차 학술문헌([한성대 석사학위논문 2021](https://dspace.hansung.ac.kr/bitstream/2024.oak/9207/2/200000360828.pdf), [한국군사과학기술학회 논문 KIMST idx=12167](https://www.kimst.or.kr/electronic_paper/pdf_down_other.kin?stype=journal&idx=12167))에서도 사격요구 접수 시 포병사격지휘체계(BTCS)/지휘통제체계가 표적에 고유 `표적번호`를 부여하여 사격명령서를 하달·관리함이 확인된다.
2. **번호 체계와 읽는 법:**
   - **번호 체계:** 상급 사령부/화력지원협조기구(FSCC)가 제대별로 할당한 **영문 알파벳 2글자 + 일련번호 숫자 4자리**(총 6자리, 예: `AA7732`, `AB1037`, `AB2135`) 체계를 사용한다 ([FM 6-30 §4-10d, p. 4-6](https://archive.org/download/ost-military-doctrine-fm6_30/fm6_30_djvu.txt), [MCWP 3-16.6 §3107d, p. 3-19; §3203c, p. 3-26](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt)).
   - **읽는 법:** 무선 전화 절차(`FM 24-35` / `QSTAG 246`, [FM 6-30 Preface & §4-12](https://archive.org/download/ost-military-doctrine-fm6_30/fm6_30_djvu.txt))에 따라 영문 2글자는 NATO 포네틱 코드(`ALFA BRAVO`)로, 숫자 4자리는 자릿수별로 끊어 읽는다. (한국군 포병숫자 읽기는 2차 자료인 [우만위키](https://tcatmon.com/wiki/%ED%8F%AC%EB%B3%91_%EC%9A%A9%EC%96%B4)·[나무위키](https://namu.wiki/w/%ED%8F%AC%EB%B3%91%20%EC%9A%A9%EC%96%B4)에서 `공, 하나, 둘, 삼, 넷, 오, 여섯, 칠, 팔, 아홉` 단자리 읽기로 확인됨).
3. **전이사격(Shift from a Known Point)과 표적번호의 관계 및 송신 구조:**
   - **기준점으로서의 이전 표적번호:** `MCWP 3-16.6` §2203은 기지점 전이의 기준점(known point)이 **"사전에 보고된 지형 참조점 또는 이전에 사격하여 기록된 표적(a target that was previously fired on and recorded)"**일 수 있다고 명시하며, 경고명령에서 `"shift AB 1037"`처럼 표적번호를 직접 지정한다 ([MCWP 3-16.6 §2203, p. 2-39; §3102b Situation 3, p. 3-3](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt)).
   - **교범상 선행 조건(`Record as Target`):** 단, `MCWP 3-16.6` §3203c 및 §3303d(2), `FM 6-30` §5-8 Table 5-2에 따르면 단순히 사격 임무 중 MTO로 부여된 표적번호는 임무 종료 시 자동으로 기지점/표적으로 영구 등록되지 않으며, 관측자가 임무 종료 시 `"Record as target"`(표적기록)을 요청해야 FDC가 최종 수정된 좌표를 해당 표적번호로 기록하여 이후 전이사격의 기준점으로 재사용할 수 있다 ([MCWP 3-16.6 §3203c, p. 3-26; §3303d(2), p. 3-58](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt), [FM 6-30 Table 5-2, p. 5-11](https://archive.org/download/ost-military-doctrine-fm6_30/fm6_30_djvu.txt)).
   - **교범상 전이사격의 3회 분할 송신 구조:** `FM 6-30` (§4-3c(3), §4-4b) 및 `MCWP 3-16.6` (§3102b Situation 3, §3103c Situation 3)에서 기지점 전이는 별도의 특수 1회 송신이 아니라 **표준 3회 분할 사격요구(Call for Fire)**의 표적위치 결정 방법 중 하나이다:
     1. **1차 송신 (호출 + 경고명령):** `"[호출], adjust fire (또는 fire for effect), shift AB 1037, over."` ([MCWP 3-16.6 Figure 3-1, p. 3-3](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt))
     2. **2차 송신 (표적위치):** `"Direction 0680, right 250, add 200, over."` ([MCWP 3-16.6 Figure 3-2, p. 3-5](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt))
     3. **3차 송신 (표적성질·공격방법·통제방법):** `"Machine gun position, converged sheaf, at my command, over."` ([MCWP 3-16.6 Figure 3-4, p. 3-11](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt))

### 2.3 데모 v0.2 동작과의 비교 판정
- **같음 (Same — 1차 미군 교범 기준):**
  - 기러기(FDC)가 사격지휘통보(`mtoText`)의 마지막 요소로 `AB1001` 형식(영문 2자 + 숫자 4자)의 표적번호를 부여하고 `"표적번호 알파브라보 하나공공하나"`로 읽는 점(`PRD/OBSERVER_demo_v0.2.html:694-695, 735-737`), 그리고 전이사격 시 이전 표적번호를 기준점으로 삼고 FDC가 새 사격지휘통보에서 새 표적번호(`AB1002`)를 부여하는 점(`PRD/OBSERVER_demo_v0.2.html:841, 845`)은 교범과 일치한다.
- **다름 (Different — 1차 미군 교범 기준, 교신 상태 기계 구조 차이):**
  1. **전이사격 송신 횟수 및 상태 전이:** 교범(`FM 6-30` §4-3~4-4, `MCWP 3-16.6` §3102~3103)은 기지점 전이를 일반 사격요구와 동일하게 **3회 분할 송신(`IDLE → LOC → DESC`)**으로 처리하고 `조정`과 `효력사`를 모두 경고명령에서 선택할 수 있는 반면, 데모 v0.2(`sendShift`, `PRD/OBSERVER_demo_v0.2.html:834-847`)는 2차 자료([유용원의 군사세계 예문 #88920](https://bemil.chosun.com/nbrd/bbs/view.html?b_bbs_id=10040&num=88920))의 압축 문형을 섞어 **`IDLE` 상태에서 단 1회 송신**(`"전이, 표적번호 ..., 방향 ..., 우로 ..., 줄이기 ..., [표적성질], 포대 삼발, 효력사"`)으로 모든 요소를 보내고 곧장 `WAIT → FLIGHT`로 넘어간다.
  2. **표적기록(`Record as target`) 생략:** 교범은 임무 종료 시 표적기록을 한 표적만 기지점으로 쓸 수 있고 여러 기록 표적 중 선택할 수 있으나, 데모 v0.2는 표적기록 절차 없이 무조건 직전 완료 임무 1개(`R.lastTn`, `R.lastAim`)만 자동 참조한다 (`PRD/OBSERVER_demo_v0.2.html:831, 838`).
  3. **MTO 복창 생략:** 교범(`MCWP 3-16.6` §3107)은 관측자가 MTO(사격지휘통보)를 복창하도록 규정하나, 데모 v0.2는 표준/훈련 모드에서 MTO 복창 없이 `포대 사격준비 끝`으로 진행한다 (`PRD/OBSERVER_PRD_v0.2.md:365`, `PRD/OBSERVER_demo_v0.2.html:748-754`).
- **확인 불가 (Unverifiable — 한국군 고유 음성 절차 기준):**
  - 한국군 야전교범에서 사격지휘통보 음성 문장에 표적번호를 항상 포함해 읽는지(2차 자료인 군사세계 예문에는 생략됨), 그리고 직전 탄착점 기준 1회 압축 송신(`"전이사격, 우로 ..., 줄이기 ..."` — 표적번호·방향 생략)이 정식 약식 절차로 존재하는지는 한국군 1차 공개 자료에서 **확인 불가**.

---

## 3. 위험근접 (Danger Close)

### 3.1 질문 요지
- 기준 거리(600 m), 바로 효력사 금지 여부, 수정량 상한(축당 100 m)과 포복 사격 원칙이 한국군 규칙에도 있는가?
- 데모 v0.2의 동작과 같음 / 다름 / 확인 불가 여부.

### 3.2 1차 공개 교범 조사 결과
1. **기준 거리 600 m 및 선언 시점:**
   - `FM 6-30` (§4-6b, §5-5b), `MCWP 3-16.6` (§3104b(2)), `USMC TBS B2C2437` 모두 **야포(artillery) 및 박격포(mortars) 사격에서 표적(예상 탄착점)이 아군 병력으로부터 600 m 이내**일 때를 위험근접(`Danger Close`)으로 정의하며, 사격요구 3차 송신의 5번째 요소(공격방법, Method of Engagement)에 `"Danger close"`를 포함하도록 규정한다 ([FM 6-30 §4-6b, p. 4-3](https://archive.org/download/ost-military-doctrine-fm6_30/fm6_30_djvu.txt), [MCWP 3-16.6 §3104b(2), p. 3-8](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt), [USMC TBS B2C2437](https://www.trngcmd.marines.mil/Portals/207/Docs/TBS/B2C2437%20Call%20For%20Indirect%20Fire.pdf)).
   - 또한 초기 표적은 600 m 밖이었으나 조정사격 중 수정으로 인해 탄착점이 아군 600 m 이내로 들어오면 후속 수정 송신의 두 번째 순서(Direction 바로 다음)에 `"DANGER CLOSE"`를 선언해야 하며, 반대로 600 m 밖으로 나가면 `"CANCEL DANGER CLOSE"`를 송신한다 ([FM 6-30 §5-5b, p. 5-6](https://archive.org/download/ost-military-doctrine-fm6_30/fm6_30_djvu.txt), [MCWP 3-16.6 Table 3-1, p. 3-49](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt)).
2. **포복 사격(Creeping Fire) 원칙과 100 m 수정 상한:**
   - `FM 6-30` (§5-6d) 및 `MCWP 3-16.6` (§3104b(2), §3302e(4)(a))는 위험근접 조정사격에서 큰 폭의 사거리 괄호를 좁히는 협차법(bracketing) 사용을 금지하고, 반드시 **포복 사격법(Creeping Fire / Creeping Method of Adjustment)**을 사용하도록 규정한다 ([FM 6-30 §5-6d, p. 5-10](https://archive.org/download/ost-military-doctrine-fm6_30/fm6_30_djvu.txt), [MCWP 3-16.6 §3302e(4), p. 3-54](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt)).
   - 구체적으로 `FM 6-30` §5-6d는 *"사거리 변경 시 큰 폭의 사거리 수정 대신 100 m 이하의 수정량을 사용하여 탄을 표적으로 조금씩 이동시킨다(using corrections of 100 meters or less)"*고 규정하며, `MCWP 3-16.6` §3302e(4)(a)는 *"야포와 박격포에서 아군 병력 쪽으로 탄을 이동시킬 때 100 m 이하 단위로 수정한다(in 100-meter increments or less when moving rounds toward friendly forces)"*고 명시한다 ([FM 6-30 §5-6d, p. 5-10](https://archive.org/download/ost-military-doctrine-fm6_30/fm6_30_djvu.txt), [MCWP 3-16.6 §3302e(4)(a), p. 3-54](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt)).
3. **바로 효력사(First-round Fire for Effect) 금지 여부:**
   - 1차 교범(`FM 6-30`, `MCWP 3-16.6`)에는 **위험근접 표적에 대해 최초 효력사(Fire for Effect)를 일괄 금지하거나 FDC가 효력사 요구를 거부한다는 규정이 없다.**
   - 교범은 위험근접 상황(예: 아군 200~400 m 이내의 최후방어사격 FPF)에서 정확도를 위해 가능하면 단포 조정을 거칠 것을 권고하고(`MCWP 3-16.6` §5801, `FM 6-30` §7-3), ICM 탄종 조정 시 아군 600 m 밖에서 조정을 시작하도록 규정하지만(`MCWP 3-16.6` §5402c, p. 5-31), 동시에 기습 효과 유지나 레이저 측정·사전 등록 표적의 경우 **비조정 효력사(Nonadjusted Fire for Effect)가 가능함**을 명시하고 실제 교신 예문(`"H12 this is H18, fire for effect, polar, over." ... "Establish as final protective fire, attitude 1900, danger close, delay, over."`)을 수록하고 있다 ([MCWP 3-16.6 §5802, Figure 5-28 & 5-29, p. 5-74~5-78](https://archive.org/download/milmanual-mcwp-3-16.6-supporting-arms-observer-spotter-and-controller/mcwp_3-16.6_supporting_arms_observer_spotter_and_controller_djvu.txt)).

### 3.3 데모 v0.2 동작과의 비교 판정
- **같음 (Same — 1차 미군 교범 기준):**
  - 아군(또는 관측소) 600 m 이내를 위험근접 기준으로 삼고 사격요구 3차 송신에 `"위험근접"`을 포함하며(`PRD/OBSERVER_demo_v0.2.html:740-745`), 위험근접 조정사격에서 100 m를 초과하는 큰 폭의 수정을 금지하는 핵심 안전 원리(`PRD/OBSERVER_demo_v0.2.html:806`)는 교범과 일치한다.
- **다름 (Different — 1차 미군 교범 기준):**
  1. **바로 효력사 강제 금지:** 교범은 표적 위치가 확실할 때 위험근접 비조정 효력사도 허용하나, 데모 v0.2는 위험근접 시 최초 `효력사` 요청을 FDC가 무조건 `조정`(`m.phase='adj'`)으로 강제 전환하고 `"위험근접, 조정 후 효력사"`를 송신한다 (`PRD/OBSERVER_demo_v0.2.html:746, 844`).
  2. **수정량 100 m 상한의 적용 축 및 FDC 거부 응답:** 교범(`FM 6-30` §5-6d, `MCWP 3-16.6` §3302e(4)(a))은 관측자가 사거리(특히 아군 방향 접근) 수정을 100 m 이하로 수행하는 절차인 반면, 데모 v0.2는 좌우(`lv`)와 사거리(`rv`) 양축 모두 방향과 무관하게 100 m 이하(`lv>100||rv>100`)로 제한하고 초과 시 FDC가 `"위험근접, 수정량 100 이하로 재송신, 이상"`으로 거부하여 `ADJ` 상태로 되돌린다 (`PRD/OBSERVER_demo_v0.2.html:806-807`). (단, PRD §4.1 `PRD/OBSERVER_PRD_v0.2.md:93`에서 이미 이 두 문구를 미군 교범 원칙을 게임 규칙으로 옮긴 `설계` 항목으로 명시하고 있음).
  3. **조정 중 동적 위험근접 진입/해제 미구현:** 데모 v0.2는 최초 표적위치(`sendDesc`)와 전이사격(`sendShift`) 시점에만 600 m 여부를 판정하며, 이후 수정탄 이동으로 600 m 경계를 넘나들 때의 `DANGER CLOSE` 추가 선언이나 `CANCEL DANGER CLOSE`는 구현되어 있지 않다 (`PRD/OBSERVER_demo_v0.2.html:742, 803-818`).
- **확인 불가 (Unverifiable — 한국군 고유 교범 기준):**
  - 한국군 야전교범에서 위험사격(위험근접) 시 600 m 기준 외에 최초 효력사 금지 규정이 별도로 존재하는지, Creeping Fire를 `"포복 사격"`으로 번역하는지(한국어 일반 군사용어에서 '포복사격'은 보병의 엎드려 쏴 자세를 뜻함), 그리고 FDC의 거부 교신문이 존재하는지는 한국군 1차 공개 문헌에서 **확인 불가**.

---

## Unresolved (미결 및 확인 불가 항목)

한국군 육군 야전교범(`야교 6-40 대포포술`, `관측`, `합동화력운용` 등)이 군사자료(대외비)로 분류되어 공개 웹(국방부·육군·국방일보·국회도서관·KCI 학술DB)에 원문이 공개되어 있지 않기 때문에, 아래 3건의 **한국군 고유 무선 교신 문형 및 세부 규칙**은 1차 공식 자료로 확인할 수 없어 `fact = null` (`확인 불가`)로 남긴다.

1. **`1-B` 한국군 방안좌표 사격 시 `'방향 ○○○○'`의 실제 음성 호창 문구 및 생략 조건 (`fact = null`):**
   - 한국군 학술논문([KICS NODE01552797](https://engjournal.kics.or.kr/digital-library/manuscript/file/33792/NODE01552797.pdf))과 2차 자료([아카라이브 전술 채널 #83853341](https://arca.live/b/staytactical/83853341))에서는 관측자-표적 방위각을 **`관목방위각`**이라 부르며, 2차 자료 예문([유용원의 군사세계 #88920](https://bemil.chosun.com/nbrd/bbs/view.html?b_bbs_id=10040&num=88920))에서는 방안좌표 첫 수정 시 방향 송신을 아예 생략(`"우로 50, 줄이기 하나백"`)한다. 실제 한국군 음성 교범에서 미군(`DIRECTION ○○○○`)처럼 `"방향 ○○○○"`으로 부르는지, `"관목방위각 ○○○○"`으로 부르는지, 혹은 BTCS에 관측소 좌표가 입력된 경우 생략하는지는 공개 1차 자료로 확인 불가.
2. **`2-C` 한국군 음성 사격지휘통보 내 표적번호 호창 위치 및 약식 전이사격 단일 문형 여부 (`fact = null`):**
   - 한국군 학술논문([한성대 2021](https://dspace.hansung.ac.kr/bitstream/2024.oak/9207/2/200000360828.pdf), [KIMST idx=12167](https://www.kimst.or.kr/electronic_paper/pdf_down_other.kin?stype=journal&idx=12167))에서 BTCS가 표적번호를 부여·관리하는 것은 확인되나, 음성 사격지휘통보에서 `"표적번호 알파브라보 하나공공하나"`를 매번 호창하는지(2차 자료인 군사세계 예문에서는 생략됨), 그리고 미군 교범의 3회 분할 `'기지점 전이'` 외에 직전 표적 임무 종료 직후 1회 송신하는 약식 `'전이사격'` 문형이 한국군 교범에 존재하는지는 공개 1차 자료로 확인 불가.
3. **`3-C` 한국군 위험근접(위험사격) 시 최초 효력사 금지 여부, `'포복 사격'` 용어 및 FDC 거부 문구 (`fact = null`):**
   - 2차 자료([나무위키 포병 용어](https://namu.wiki/w/%ED%8F%AC%EB%B3%91%20%EC%9A%A9%EC%96%B4))는 한국군도 미군과 동일하게 야포·박격포 아군 600 m 이내를 위험사격(위험근접)으로 둔다고 설명하나, 한국군 교범에서 Creeping Fire의 공식 번역어가 무엇인지(`포복 사격` vs `점진 사격` 등)와 위험근접 시 최초 효력사 금지 및 FDC 거부 문구(`"위험근접, 조정 후 효력사"`, `"위험근접, 수정량 100 이하로 재송신"`)가 실제 교범에 있는지는 공개 1차 자료로 확인 불가 (PRD §4.1에서도 해당 문구는 게임 `설계`로 분류됨).
