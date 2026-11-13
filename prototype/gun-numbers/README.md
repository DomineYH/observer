# PROTOTYPE, not product code, ticket #118

포 4종(KH178·KH179·K55·K9)의 공개 제원을 포 프로파일 숫자로 옮겨 같은 판에서 견주는 버리는 시제품. main에 합치지 않는다.

    npx vitest run --config prototype/gun-numbers/vitest.config.ts

`SEEDS_C=200` 같은 환경 변수로 C(전체 임무)의 시드 수를 줄여 빨리 돌릴 수 있다(기본 1000). 결과와 해석은 `REPORT.md`.
손잡이는 `src/sim/protoGun.ts` 하나이고 기본값은 지금 코드의 숫자다.
