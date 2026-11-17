# 자료 작성

배치(시나리오와 그 글), 포 프로파일, 실전 수치를 적는 폴더다. 모두 JSON으로 그대로 옮길 수 있는 값만 담은 TS 상수이고 번들에 실린다([ADR 0017](../../docs/adr/0017-scenarios-and-gun-profiles-are-json-ready-ts-constants-bundled-and-validated-only-in-ci.md)). 앱은 실행 때 자료를 검사하지 않는다. 검사는 셋 다 CI에서 돈다: 형식 = `npm run typecheck`, JSON 왕복과 유한한 수 = `시나리오: JSON으로 옮겼다 되돌려도 같다`, 내용 검증 = `check.ts`의 `contentCheck`(`tests/acceptance/contentCheck.test.ts`).

| 파일 | 담는 것 |
| --- | --- |
| `scenarios/<식별자>.ts` | 배치 하나: 시나리오 자료, 글, 지형 참조, 있으면 일일 시작일(`dailyFrom`) |
| `lookup.ts` | 배치 목록 `PLACEMENTS`, 포 프로파일 목록 `GUNS`(`guns.ts`의 것), 찾기 함수 |
| `guns.ts` | 포 프로파일 목록: 다섯 프로파일과 곁의 이름·소개 글(`base` 먼저, 값은 프로파일마다 다 적는다) |
| `range.ts` | 판 전 사거리 검사(싸움터의 가장 먼 점 + 500 m ≤ 최대 사거리) |
| `combat.ts` | 실전 수치와 실전 자료 판 |
| `check.ts` | 내용 검증 |

## 작성 흐름

1. 식별자를 정한다(영문 소문자로 시작하는 소문자·숫자·붙임표, 파일 이름과 같다). 가장 가까운 배치 파일을 베껴 `scenarios/<식별자>.ts`를 만들고 값과 글을 다 적는다(다른 파일의 값을 가져오지 않는다).
2. 배치 목록(`lookup.ts`의 `PLACEMENTS`)의 끝에 더한다. 한 전장의 첫 배치가 그 전장의 기본 시나리오이므로 앞에 끼우지 않는다.
3. 내용 검증을 돌린다: `npx vitest run -t "시나리오"`. 포대에서 싸움터의 가장 먼 점까지 + 500 m가 기본 포의 최대 사거리 24 km 안이어야 한다(내용 규칙 12번).
4. `배치` 테스트를 돌린다: `npx vitest run -t "배치"`. 실제 지형이면 가시 기준과 자리 검사가 함께 돈다. 기본값을 못 맞추면 좌표를 고치고, 그래도 안 되면 결정을 받아 테스트 안의 예외 표에 결정 링크와 함께 적는다.
5. 관측소를 지금의 벌채 원 밖에 놓아야 하면 멈춘다. 지형 판이 올라 골든이 바뀌므로 소유자 결정이 있어야 한다.
6. 그 시나리오의 각본 골든 하나를 더한다(`npm run golden:update`는 없는 파일만 만든다).
7. 고칠 때: 아래 판 규칙 표를 보고 올릴 판을 올린다. 시나리오 버전을 올리면 그 시나리오의 골든만 다시 만든다([ADR 0009](../../docs/adr/0009-replay-data-names-terrain-by-id-and-version-and-goldens-regenerate-when-a-header-version-rises.md)).

**일일 시작일의 한 걸음.** 새 배치를 일일 시나리오의 후보로 넣으려면 `dailyFrom`에 여덟 자리 날짜 수(연·월·일)를 적는다. 그 배치가 실리는 날보다 뒤의 날짜로 적는다(기계가 보지 못하므로 리뷰가 본다). 한 번 내보낸 값은 고치지도 지우지도 않고, `시나리오: main에 들어간 일일 시작일은 그대로다`의 표에 줄을 더한다. 기본 시나리오에는 적지 않는다. 적지 않은 배치는 연습 전용이다([ADR 0020](../../docs/adr/0020-the-daily-scenario-is-picked-by-day-number-and-daily-start-dates-keep-past-days-stable.md)).

## 판 규칙

| 바꾼 값 | 올리는 판 |
| --- | --- |
| 증원 밖의 시나리오 자료 | 시나리오 버전 |
| 증원 | 실전 자료 판 |
| 글 | 없음 |

같은 규칙으로 포 프로파일의 값은 그 프로파일의 버전, 실전 수치와 포의 진지 변환 시간은 실전 자료 판이 덮는다([ADR 0019](../../docs/adr/0019-values-read-only-in-combat-are-covered-by-the-combat-data-version.md)). 지형 참조와 일일 시작일은 어느 판에도 들지 않는다. 판을 올리면 `tests/acceptance/expected.ts`에 새 기대값 줄을 적고, `자료: 내용과 버전이 어긋나지 않는다`가 값과 판이 어긋나지 않는지 본다.
