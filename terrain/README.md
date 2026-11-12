# 지형 가공

실제 지형 전장의 **지형 파일**을 만드는 폴더다. 일은 두 단계(받기 → 가공)로 나뉘고, 둘 다 `terrain/` 아래의 전장 폴더(`terrain/<id>/`)마다 한 번씩 돈다. 앱(`src/`)은 이 폴더의 어느 것도 가져오지 않는다. 브라우저에 가는 두 파일만 지형 원천 모듈(`src/adapters/realTerrain/<id>/`)에 쓴다.

## 두 단계와 명령

| 단계 | 명령 | 읽는 것 | 쓰는 것 | 네트워크 |
| --- | --- | --- | --- | --- |
| 받기 | `npm run terrain:fetch` | 가공 설정, 원격 원천 셋 | 원자료 스냅샷과 스냅샷 목록 | 쓴다. 사람이나 에이전트가 로컬에서 돌리고 CI는 돌리지 않는다 |
| 가공 | `npm run terrain:build` | 가공 설정, 원자료 스냅샷 | 지형 파일, 지형 기대값, 가공 자료 머리, 가공 기록 | 안 쓴다. CI는 가공을 메모리에서 다시 돌려 커밋된 것과 견주기만 한다(`가공: 다시 만들어 견주기`) |

- **받기**는 가공 설정의 실제 위치에서 마디의 경위도를 계산하고, GEDTM30과 WorldCover를 정사각을 덮는 창만 받고, OpenStreetMap은 Overpass 요청 한 번으로 받는다. 지면에 자료 없음 값이 있거나, 피복 창이 정사각을 다 덮지 못하거나, 군사 지물이 정사각 안에 하나라도 있거나, 응답에 기준 시각이 없으면 아무것도 쓰지 않고 멈춘다.
- **가공**은 WorldCover 대응표 → 수면 → 도로 칸 → 건물 → 벌채 원 → 건물 높이 층과 숲 높이 값 → 도로선(정사각에서 자르기 → 같은 등급의 두 선 끝만 만나는 점에서 잇기 → 순서) → 마을과 지명 → 지면을 눈금으로 반올림해 누르기 → 자기 검사 순서로 돈다. 멈출 때는 아무것도 쓰지 않는다. 규칙 코드(`pipeline/rules/`)에는 결정성 린트 묶음이 걸려 있다.
- 같은 스냅샷 + 같은 가공 설정 + 같은 코드 → 같은 내용이다. 정본은 커밋된 지형 파일이고, 푼 내용이 같으면 가공은 파일을 다시 쓰지 않는다.

### 폴더

```text
terrain/
  README.md                 이 문서
  pipeline/                 받기(fetch/)·가공(rules/, build/) 코드
  <id>/
    config.json             가공 설정 (사람이 적는다)
    snapshot/
      manifest.json         스냅샷 목록: 원천별 판·주소·SHA-256·OpenStreetMap 기준 시각
      ground.bin            마디의 지면, 0.01 m 정수
      cover.bin             마디의 WorldCover 원래 분류 값
      osm.json              추린 OpenStreetMap 요소, 국지 좌표, 요소당 한 줄
    header.json             가공 자료 머리 (실제 위치가 있는 유일한 파일)
    log.json                가공 기록 (바이너리 변경의 읽을 수 있는 차이)
src/adapters/realTerrain/<id>/
  terrain.bin               지형 파일 (브라우저가 받는다)
  expected.json             지형 기대값: id·version·hash
```

자료 파일은 `.gitattributes`에서 줄바꿈 변환을 끈다(`-text`). 모두 커밋한다.

## 판을 올리는 순서

지형 판 규칙: 커밋된 기대값이 없으면 쓴다 · 판이 같으면 푼 내용과 해시가 모두 같아야 한다 · 판이 정확히 1 크면 새로 쓴다 · 그 밖은 거부한다. 판은 가공이 올리지 않고 사람이 올린다.

1. 가공 설정이나 규칙을 고친다. 스냅샷을 새로 받을 때만 `npm run terrain:fetch`를 돌린다.
2. 가공 설정의 `version`(지형 판)을 1 올린다. 규칙 자체가 바뀌었으면 `rules`(가공 규칙 판)도 올린다.
3. `npm run terrain:build`로 가공한다.
4. 배치가 적은 지형 판을 고친다.
5. 골든 ⑤를 다시 만든다.
6. 가공 기록의 차이(`git diff -- terrain/<id>/log.json`)를 PR 설명에 옮긴다.

## 자료원

| 이름 | 판 | 주소 | 라이선스 | 무엇을 바꿨는지 |
| --- | --- | --- | --- | --- |
| GEDTM30 (OpenGeoHub Foundation) | v1.2 | https://s3.opengeohub.org/global/dtm/v1.2/gedtm_rf_m_30m_s_20060101_20151231_go_epsg.4326.3855_v1.2.tif | CC BY 4.0 | 10 m 마디에서 이중선형으로 읽고 0.1 m로 반올림했다 |
| ESA WorldCover 10 m 2021 | v200 | https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_N36E126_Map.tif | CC BY 4.0 | 마디에서 가장 가까운 화소를 읽어 피복 7종으로 묶었다 |
| OpenStreetMap | 스냅샷 목록의 기준 시각 | https://overpass-api.de/api/interpreter | ODbL 1.0 | 도로·건물·지명·수면을 추려 국지 좌표로 옮기고 격자에 얹었다 |

`terrain/<id>/snapshot/osm.json`은 OpenStreetMap에서 온 자료다(추린 요소의 좌표만 국지 좌표로 옮겼다). 표의 값은 가공 설정의 `sources`와 같다.

## 자료 출처 문구

원본은 가공 설정이고, 지형 파일 머리의 `credits`와 이 문서가 그것과 글자 그대로 같다(`가공: 안내 문서의 자료 출처 문구`).

```text
GEDTM30 v1.2, OpenGeoHub Foundation
© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium
© OpenStreetMap contributors
```

## 공개 배포 전 확인

M2 통과 조건이 아니다. 공개 배포와 저장소를 공개로 돌리는 일을 막는다. 전체 목록은 스펙 [#74](https://github.com/DomineYH/observer/issues/74)의 "공개 배포 전 확인 (M2-H2)"이고, 이 폴더에 닿는 항목은 다음과 같다.

1. **OpenStreetMap 추출본이 저장소에 있다.** `snapshot/osm.json`은 ODbL 자료라 저장소를 공개로 돌리면 재배포다. 고지와 동일조건 공개를 어떻게 적을지 확인한다. 안 된다는 결론이면 스냅샷을 저장소 밖으로 옮기고 CI 견주기는 래스터 층까지만 한다.
2. CC BY 4.0의 "변경했음을 밝힘"이 위 자료원 표로 충분한지. GEDTM30의 인용 문구와 "Use for testing purposes only" 문구를 같은 때에 확인한다.
3. 스냅샷은 지형 파일보다 정밀한 지면(0.01 m)과 OpenStreetMap 요소 번호를 싣고, 가공 설정과 가공 자료 머리에 실제 위치(`frame`)가 있다. 가상 방안 결정과 맞는지 본다.
4. 저장소를 공개로 돌릴 때 루트의 안내 문서와 고지 문서에 자료 출처 문구를 둘지.
5. Overpass 공개 서버를 전장당 한 번의 추출에 써도 되는지(이용 정책).
