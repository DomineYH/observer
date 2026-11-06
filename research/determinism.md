# Issue #4 조사 보고서: 브라우저 엔진(V8·JSC·SpiderMonkey) 및 서버(Node·Vercel) 간 결정성(Determinism) 파괴 지점과 M1 시뮬레이션 코딩 규칙

- **작업 지시서 ID:** `research-4-o1` (`task_id`: `wayfinder-prd-v02`, `input_version`: `a2b3c48`)
- **대상 이슈:** [GitHub Issue #4 — M1 시뮬레이션 코딩 규칙: 브라우저 엔진·서버 간 부동소수/수학 결정성](https://github.com/DomineYH/observer/issues/4)
- **조사 일자:** `2026-11-06`

---

## 1. 초월 함수 및 `Math` 내장 함수의 엔진 간 결과 차이

### 1.1 ECMA-262 명세상 결정적 연산 vs 비결정적(`implementation-approximated`) 연산
ECMAScript 명세([ECMA-262 §4.2](https://tc39.es/ecma262/multipage/overview.html#sec-terms-and-definitions-implementation-approximated))는 `implementation-approximated`를 *"외부 소스에 정의를 위임하되 이상적인 동작만 권고하는 기능"* 으로 정의한다. 또한 `Math` 객체 함수 명세([ECMA-262 §21.3.2](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-function-properties-of-the-math-object))는 `fdlibm`(Freely Distributable libm) 사용을 **권고(recommended)** 할 뿐 표준으로 강제하지 않는다.

따라서 `NaN`, `±0`, `±Infinity` 등 특수 경계값을 제외한 일반 유한 실수 입력에 대해 다음 함수들은 엔진 간 **최소 1 ULP(Unit in the Last Place) 이상의 결과 차이**가 허용된다([ECMA-262 §21.3.2](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-function-properties-of-the-math-object), [§6.1.6.1.3](https://tc39.es/ecma262/multipage/ecmascript-data-types-and-values.html#sec-numeric-types-number-exponentiate)):

| 구분 | 연산자 / 함수 | ECMA-262 절 | 명세 규격 | 엔진 간 비트 일치 보장 여부 |
|---|---|---|---|---|
| **비결정적 (`implementation-approximated`)** | `Math.sin`, `Math.cos`, `Math.tan` | §21.3.2.31, .12, .35 | `implementation-approximated` | **불가** (엔진·OS별 `libm` 차이) |
| | `Math.asin`, `Math.acos`, `Math.atan`, `Math.atan2` | §21.3.2.3, .2, .4, .6 | `implementation-approximated` | **불가** |
| | `Math.exp`, `Math.expm1`, `Math.log`, `Math.log1p`, `Math.log10`, `Math.log2` | §21.3.2.15, .16, .21~24 | `implementation-approximated` | **불가** |
| | `Math.sinh`, `Math.cosh`, `Math.tanh`, `Math.asinh`, `Math.acosh`, `Math.atanh` | §21.3.2.32, .13, .36, .5, .1, .7 | `implementation-approximated` | **불가** |
| | `Math.hypot(...args)` | §21.3.2.19 | `implementation-approximated` | **불가** (2인자 스케일링/단순 합산 구현 상이) |
| | `Math.pow(x, y)` 및 거듭제곱 연산자 `x ** y` | §21.3.2.27, §6.1.6.1.3 (`Number::exponentiate`) | `implementation-approximated` | **불가** (`(r/R)**2` 등 정수 지수도 `Number::exponentiate` 경유) |
| | `Math.cbrt` | §21.3.2.9 | `implementation-approximated` | **불가** |
| **결정적 (IEEE 754-2019 Exact)** | 사칙연산 `+`, `-`, `*`, `/` | §6.1.6.1.4~8 | IEEE 754-2019 binary64 `roundTiesToEven` (0.5 ULP) | **보장** (단, 덧셈·곱셈 결합법칙은 불성립) |
| | `Math.sqrt(x)` | [§21.3.2.33](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-math.sqrt) | `𝔽(the square root of ℝ(n))` (IEEE 754-2019 0.5 ULP) | **보장** (`Math.sqrt(dx*dx + dy*dy)`는 전 엔진 비트 일치) |
| | `Math.imul(x, y)` 및 32비트 비트 연산 (`\|0`, `>>>0`, `^`, `&`, `<<`, `>>`) | [§21.3.2.20](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-math.imul), §6.1.6.1.9~19 | 모듈러 32비트 정수 연산 | **보장** (`mulberry32` PRNG 자체는 100% 결정적) |
| | `Math.fround(x)` | [§21.3.2.17](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-math.fround) | IEEE 754-2019 binary32 `roundTiesToEven` 변환 | **보장** (`Float32Array` 저장 시 반올림과 동일) |
| | `Math.abs`, `Math.floor`, `Math.ceil`, `Math.round`, `Math.trunc`, `Math.sign`, `Math.min`, `Math.max`, `Math.clz32` | §21.3.2.1, .16, .10, .29, .37, .30, .25, .24, .11 | 정확한 실수/비트 매핑 규칙 명시 | **보장** |

### 1.2 V8 vs SpiderMonkey vs JavaScriptCore(WebKit) 및 Node/Vercel 간 실제 구현 차이
3대 브라우저 엔진과 서버 런타임의 C++ 소스를 대조한 결과, 동일한 입력에 대해 서로 다른 수학 라이브러리를 호출함이 확인되었다:

1. **V8 (Chrome, Edge, Node.js, Vercel Serverless Functions):**
   - [`src/base/ieee754.cc`](https://raw.githubusercontent.com/v8/v8/main/src/base/ieee754.cc)에서 OS `libm` 대신 자체 번들링한 수학 구현을 사용한다. 과거 Sun의 `fdlibm`을 수정해 사용했으나, 최신 V8은 `sin`, `cos`, `tan`, `exp`, `log`, `atan`, `atan2`, `pow` 등을 [`third_party/llvm-libc/src/shared/math.h`](https://raw.githubusercontent.com/v8/v8/main/src/base/ieee754.cc) 구현으로 위임(`LIBC_NAMESPACE::shared::exp(x)` 등)하고 있다.
   - `Math.hypot`은 [`src/builtins/math.tq`](https://raw.githubusercontent.com/v8/v8/main/src/builtins/math.tq)에서 Torque 내장 함수로 구현되어 최대값 `max`로 나눈 뒤 `Float64Sqrt((a / max) * (a / max) + (b / max) * (b / max)) * max`를 수행한다.
   - **클라이언트 Chrome vs 서버 Node/Vercel 간 버전 불일치 위험:** 둘 다 V8을 쓰더라도 클라이언트 Chrome(최신 V8)과 Vercel Node.js 런타임(LTS 고정 V8) 사이에 V8 버전 차이(예: `fdlibm` → `llvm-libc` 전환 전후)가 존재하면 **V8 대 V8 사이에서도 초월 함수 결과가 달라질 수 있다**([V8 `src/base/ieee754.cc`](https://raw.githubusercontent.com/v8/v8/main/src/base/ieee754.cc)).

2. **SpiderMonkey (Firefox):**
   - [`js/src/jsmath.cpp`](https://raw.githubusercontent.com/mozilla/gecko-dev/master/js/src/jsmath.cpp)에서 `exp`, `log`, `atan`, `atan2` 및 2인자 `ecmaHypot`은 번들링된 `fdlibm::exp`, `fdlibm::atan2`, `fdlibm::hypot`을 호출한다.
   - 반면 `sin`, `cos`, `tan`은 `UseFdlibmForSinCosTan(args)`(핑거프린팅 방지/설정 플래그 `javascript.options.use_fdlibm_for_sin_cos_tan`)에 따라 `fdlibm`과 호스트 네이티브 `std::sin/cos/tan` 사이를 분기한다([Gecko `js/src/jsmath.cpp`](https://raw.githubusercontent.com/mozilla/gecko-dev/master/js/src/jsmath.cpp)).

3. **JavaScriptCore / WebKit (macOS Safari, iOS/iPadOS의 모든 브라우저):**
   - [`Source/JavaScriptCore/runtime/MathCommon.h`](https://raw.githubusercontent.com/WebKit/WebKit/main/Source/JavaScriptCore/runtime/MathCommon.h)의 `#define JSC_DEFINE_VIA_STD(capitalizedName, lowerName) using std::lowerName;` 및 `atan2` 래퍼, 그리고 [`Source/JavaScriptCore/runtime/MathObject.cpp`](https://raw.githubusercontent.com/WebKit/WebKit/main/Source/JavaScriptCore/runtime/MathObject.cpp)의 `std::hypot(arg0, arg1)`을 통해 **`sin`, `cos`, `tan`, `exp`, `log`, `atan`, `atan2`, `hypot`을 호스트 OS의 `<cmath>`(`libm`)에 직접 위임**한다.
   - 결과적으로 iOS/macOS(Apple system `libm`, ARM64)와 Linux(glibc `libm`, x86_64) 및 V8(`llvm-libc`) 사이에서 초월 함수와 `Math.hypot`의 하위 비트(LSB)가 불일치한다.
   - 또한 `x ** y`(`operationMathPow`, [`MathCommon.cpp`](https://raw.githubusercontent.com/WebKit/WebKit/main/Source/JavaScriptCore/runtime/MathCommon.cpp))는 정수 지수(`≤ 1000`)에 대해 반복 곱셈 루프 최적화를 수행하는 반면 일반 실수 경로는 `mathPowInternal`을 탄다.

---

### 1.3 데모(`PRD/OBSERVER_demo_v0.2.html`) 내 결정성 파괴 지점 전수 감사
[`PRD/OBSERVER_demo_v0.2.html`](file:///mnt/c/dev/observer/PRD/OBSERVER_demo_v0.2.html) 코드(1~1562행)를 전수 조사한 결과, 시뮬레이션 상태(`sim/`, `radio/`)와 지형 생성에서 다음 7개 영역이 비결정적 수학 함수 또는 렌더러 상태에 노출되어 있다([Issue #4](https://github.com/DomineYH/observer/issues/4), [`PRD/OBSERVER_PRD_v0.2.md` §7.5, §10.4](file:///mnt/c/dev/observer/PRD/OBSERVER_PRD_v0.2.md)):

| 영역 | 데모 파일 위치 (`OBSERVER_demo_v0.2.html`) | 사용된 수식 / 함수 | 비결정성 파급 경로 (Desync 메커니즘) |
|---|---|---|---|
| **① 가우시안 난수 (`gaussOf`)** | 192행: `Math.sqrt(-2*Math.log(Math.max(1e-12,r())))*Math.cos(TAU*r())` | `Math.log`, `Math.cos` | 포탄 탄착 분산(`gB`), 적 사격 오차(`gE`), 음향 도착 시각 등에 매번 호출되어 탄착 좌표 `(ix, iy)`가 엔진마다 즉시 달라짐 |
| **② 지형 생성 (`buildTerrain`)** | 201~287행: 산봉우리/능선/안부/만/수로 생성 | `Math.exp`, `**2`, `Math.sin`, `Math.cos`, `Math.hypot` | 같은 시드에서도 `GROUND`/`SURF` (`Float32Array`) 고도값이 1 ULP 달라져 가시선(`los`)과 탄착 고도가 어긋남 |
| **③ 가시성 판정 (`visOf`)** | 540~541행: `d = Math.hypot(x-OBS.x, y-OBS.y)`, 코슈미더 `1 - Math.exp(-SIGMA*d) > 0.9` | `Math.hypot`, `Math.exp` | 경계 거리(`1 - exp(-SIGMA*d) == 0.9`) 부근에서 관측 성공/실패 및 `los()` 호출 여부가 갈림 |
| **④ 부대 기동·AI (`tickSim`, `planMove`)** | 459~478행, 578~605행, 856행: 돌격 감쇠 `Math.exp(-(simT-P.assaultT)/120)`, 토블러 보행 속도 `6*Math.exp(-3.5*Math.abs(grade+0.05))/3.6...` | `Math.hypot`, `Math.atan2`, `Math.sin`, `Math.cos`, `Math.exp` | 매 50 ms 틱마다 부대 좌표 `P.cx, P.cy`와 병사 오프셋에 미세 오차가 누적되어 사거리 진입(`dist < 900`) 틱과 `rE()` 호출 횟수가 달라짐 |
| **⑤ 포탄 살상·제압 (`impact`, `fireRound`)** | 495행, 646~667행: 살상 확률 `0.92*Math.exp(-((re/R)**2))`, 파편 `Math.exp(-((Math.hypot(...)/R)**2))`, 아군 피해 `Math.exp(-((r/R)**2)*1.5)` | `Math.exp`, `**2`, `Math.hypot` | `rB() < p` 판정 경계에서 병사 생사(`s.alive`), 소대 상태(`P.state`), 무전 보고 시각이 갈림 |
| **⑥ 관측소 조준·레이저·식별 (`pickAt`, `lase`, `identifyAt`)** | 1048~1086행: `Math.tan(cam.p)`, `Math.sin(cam.h)`, `Math.cos(cam.h)`, `Math.atan2(z-camZ, d)`, `Math.atan((ix-VW/2)/V.focal)` | `Math.tan`, `Math.sin`, `Math.cos`, `Math.atan2`, `Math.atan` | 레이저 거리측정(`lase`) 히트 지점과 쌍안경 식별(`identifyAt`) 각도 계산이 엔진마다 달라짐 |
| **⑦ 렌더러 해상도 누수 (`identifyAt`)** | 1077행: `cam.h + Math.atan((ix - VW/2) / V.focal)` (`V.focal`, `V.hor`는 화면 프리셋 `VW = 480\|640\|960`에 의존) | 렌더러 뷰포트 변수 `VW`, `VH`, `V` 참조 | 클라이언트 해상도 프리셋(저/중/고)에 따라 `V.focal`이 달라짐. 데모(1081행)는 결과 `best.pid`를 입력 로그에 기록해 우회하나, 조준 각도 기반 검증 시 치명적 불일치 발생 |

---

## 2. 대응책 후보 4가지의 비용 및 적합성 비교

M1 시뮬레이션은 **50 ms 고정 틱(20 Hz)** 으로 동작하며, 적 5개 소대(약 100명)와 동시 비행 포탄 수십 발 규모를 처리한다([`PRD/OBSERVER_PRD_v0.2.md` §7.5](file:///mnt/c/dev/observer/PRD/OBSERVER_PRD_v0.2.md), [`OBSERVER_demo_v0.2.html` 397~670행](file:///mnt/c/dev/observer/PRD/OBSERVER_demo_v0.2.html)). 네 가지 대응책 후보의 비용과 한계는 다음과 같다:

| 대응책 후보 | 구현·유지보수 비용 | 런타임 성능 비용 (20 Hz 기준) | 단독 사용 시 결정성 보장 | 평가 및 M1 채택 권고 |
|---|---|---|---|---|
| **① 결정적 수학 구현 (순수 TS 소프트웨어 다항식/유리식 근사·`fdlibm` 이식 또는 LUT + 선형보간)** | **낮음** (`sim/math.ts` 단일 모듈 ~150행 작성, `+`, `-`, `*`, `/`, `Math.sqrt`, `Math.imul`만 사용) | **무시 가능** (틱당 초월 함수 호출 <1,000회 → 순수 JS 연산 시 틱당 `< 0.05 ms` 소요) | **완전 보장** (IEEE 754-2019 사칙연산과 `Math.sqrt`만 조합하므로 모든 엔진에서 비트 단위 일치) | **[핵심 채택]** PRD §2·§7.5의 순수 TS `sim/` 아키텍처를 100% 유지하면서 물리 수식 가독성 보존 |
| **② 고정소수점 (Fixed-Point, 예: Q16.16 / Q32.32)** | **매우 높음** (지형 이중선형 보간, 3D 광선투사, 탄도학 전체 재작성 필요. 10,240 m 전장에서 거리 제곱 `10240² > 2³¹`이므로 32비트 오버플로 방지를 위해 64비트 `BigInt` 또는 수동 스케일링 필수) | **낮음~중간** (JS에서 `BigInt` 남용 시 오히려 `Number`보다 느려질 수 있음) | **완전 보장** | **[전면 도입 비권장 / 부분 활용]** 물리/지형 전체를 고정소수점으로 짜는 비용은 과도함. 단, **시간(`tick` 정수)** 및 **삼각함수 각도 인덱스(LUT)** 에만 정수/고정소수점 개념 활용 |
| **③ 비교 지점에서의 양자화 (Quantization at Comparison Points)** | **낮음** (임계값 비교 전 `Math.round(x * 1e6) / 1e6` 등 적용) | **무시 가능** | **단독 사용 시 실패 (불가)** | **[경계면 보조 수단으로만 채택]** 연속 상태(`P.cx`, `P.cy`)에 매 틱 1 ULP 오차가 누적되면 언젠가 양자화 경계(`0.5` 경계) 자체를 다른 틱에 넘게 되고, 그 순간 RNG(`rA/rB/rE`) 호출 횟수가 어긋나 이후 전체 시뮬레이션이 붕괴함. 따라서 **유저 입력 로그 직렬화 및 무전 보고 수치(밀, 10 m 격자) 양자화**에만 사용해야 함 |
| **④ 엔진 고정 (Engine Pinning) 또는 WebAssembly (Wasm)** | **브라우저 고정은 불가능** / **Wasm 이식은 중간 비용** (Rust/C++/AssemblyScript 빌드 파이프라인 추가 필요) | **매우 빠름** (Wasm 네이티브 수준) | **JS 엔진 고정은 불가 / Wasm은 보장** ([WebAssembly Core Spec §4.3.3](https://webassembly.github.io/spec/core/exec/numerics.html#floating-point-operations)) | **[JS 엔진 고정 불가]** 웹 특성상 Safari/iOS(JSC), Firefox(SpiderMonkey), Chrome(V8)을 모두 지원해야 하며([PRD §2](file:///mnt/c/dev/observer/PRD/OBSERVER_PRD_v0.2.md)), Chrome V8과 서버 Node V8도 버전이 다름. 순수 TS 결정적 수학 모듈(`sim/math.ts`)로 충분하므로 M1에서 무거운 Wasm 툴체인은 불필요함 |

### 2.1 M1을 위한 최적 조합 (권장 아키텍처)
1. **`Math.hypot(dx, dy)` 및 `x ** 2` 즉시 제거:**
   - `Math.hypot(dx, dy)` → `Math.sqrt(dx * dx + dy * dy)`로 대체 ([ECMA-262 §21.3.2.33](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-math.sqrt)에 의해 전 엔진 비트 일치, 10,240 m 전장에서 `dx*dx + dy*dy ≤ 2.1e8`이므로 오버플로 위험 0%).
   - `x ** 2` → `x * x` 함수(`sq(x) = x * x`)로 대체 ([ECMA-262 §6.1.6.1.4](https://tc39.es/ecma262/multipage/ecmascript-data-types-and-values.html#sec-numeric-types-number-multiply)).
2. **가우시안 난수(`gaussOf`)에서 `Math.log`/`Math.cos` 제거:**
   - Box-Muller 변환(`Math.sqrt(-2*Math.log(u))*Math.cos(TAU*v)`) 대신 **Marsaglia Polar Method**를 사용한다: 단위원 내부의 `(u, v)`(`s = u*u + v*v`, `0 < s < 1`)를 기각 샘플링(rejection sampling)한 뒤 `u * Math.sqrt(-2 * detLog(s) / s)`를 계산하면 삼각함수(`cos`/`sin`)가 완전히 제거되며, `detLog`만 결정적 다항식/유리식으로 구현하면 된다(또는 중심극한정리/Irwin-Hall 12-uniform 합산이나 테이블 역변환을 쓰면 초월 함수 자체를 0개로 만들 수 있음).
3. **초월 함수 5종(`exp`, `sin`, `cos`, `tan`, `atan2`)의 순수 TS 결정적 구현(`sim/math.ts`):**
   - IEEE 754 사칙연산(`+`, `-`, `*`, `/`)과 비트 연산만 사용하는 고정 차수 미니맥스(Minimax)/파데(Padé) 다항식 또는 `fdlibm` 포팅 함수를 `sim/math.ts`에 작성한다.
   - 포병 물리(살상 확률 `exp(-(r/R)^2)`, 코슈미더 `exp(-σd)`, 토블러 `exp(-3.5|g+0.05|)`, 시야 투영 `tan`)는 물리 모델 특성상 $10^{-5}$ 수준의 상대 오차면 시뮬레이션 품질에 아무런 영향이 없으면서도 **모든 엔진에서 100% 동일한 IEEE 754 binary64 비트열**을 반환한다([0 A.D. `Math.js` 사례](https://raw.githubusercontent.com/0ad/0ad/master/binaries/data/mods/public/globalscripts/Math.js)).

---

## 3. 그 밖의 비결정성 원천 분석

### 3.1 정렬 안정성 (`Array.prototype.sort` / `toSorted`)
- **명세 사실:** ES2019 이후 [ECMA-262 §23.1.3.30.1 `SortIndexedProperties`](https://tc39.es/ecma262/multipage/indexed-collections.html#sec-sortindexedproperties)는 일관된 비교 함수(consistent comparator)가 주어졌을 때 `Array.prototype.sort`가 **안정 정렬(stable sort: 비교 결과가 `0`이면 기존 인덱스 순서 $\pi(j) < \pi(k)$ 유지)** 임을 강제한다([V8 Blog — Getting things sorted in V8](https://v8.dev/blog/array-sort)).
- **파괴 지점:**
  1. 비교 함수가 `NaN`을 반환하거나 비결정적 수학 연산에 의존하면 정렬 결과가 `implementation-defined`가 된다([ECMA-262 §23.1.3.30.1](https://tc39.es/ecma262/multipage/indexed-collections.html#sec-sortindexedproperties)).
  2. 데모 401행의 이벤트 큐 `events.push({t: simT + delay, fn}); events.sort((a,b) => a.t - b.t)`처럼 부동소수점 시각 `simT + delay`로 정렬할 경우, `delay` 계산 방식에 따라 동시 이벤트의 부동소수점 하위 비트가 갈려 실행 순서가 역전될 수 있다.
- **M1 규칙:** 모든 예약 이벤트는 정수 틱(`dueTick: number`)과 단조 증가 정수 시퀀스 번호(`seq: number`)를 부여하고 `(a, b) => (a.dueTick - b.dueTick) || (a.seq - b.seq)`로 정렬한다.

### 3.2 객체 키 순회 순서 (`for..in`, `Object.keys`, `Object.entries`, `Map`, `Set`)
- **명세 사실:** [ECMA-262 §10.1.11.1 `OrdinaryOwnPropertyKeys`](https://tc39.es/ecma262/multipage/ordinary-and-exotic-objects-behaviours.html#sec-ordinaryownpropertykeys) 및 [§14.7.5.9 `EnumerateObjectProperties`](https://tc39.es/ecma262/multipage/ecmascript-language-statements-and-declarations.html#sec-enumerate-object-properties)(ES2020+)에 따라 일반(ordinary) 객체의 키 순회 순서는 모든 엔진에서 다음과 같이 결정적으로 정의된다:
  1. 배열 인덱스 키(`0` 이상 $2^{32}-2$ 이하의 정규 정수 문자열): 삽입 순서와 무관하게 **숫자 오름차순**.
  2. 나머지 문자열 키: **키가 추가된(삽입된) 순서**.
  3. Symbol 키: 삽입 순서.
  4. `Map` 및 `Set`([ECMA-262 §24.1](https://tc39.es/ecma262/multipage/keyed-collections.html#sec-map-objects), [§24.2](https://tc39.es/ecma262/multipage/keyed-collections.html#sec-set-objects)): 키 타입과 무관하게 항상 **엄격한 삽입 순서**.
- **파괴 지점:**
  - `for..in`은 프로토타입 체인을 순회하므로 `Object.prototype` 오염이나 상속 프로퍼티에 취약하다.
  - 데모 798행 `for (const id in m.kills)`는 `id`가 소대 인덱스(`0..4`)여서 오름차순으로 순회되지만, 동적 문자열 키 객체에서 삽입 순서가 달라지거나 동점자(`v > bv`) 비교 시 순회 순서에 의존하면 결과가 바뀔 수 있다.
- **M1 규칙:** `sim/` 내부에서 `for..in` 사용을 금지하고, 고정 길이 배열(`Array`) 또는 `Map`/`Set`만 사용하며, 객체 키 순회가 불가피할 때는 명시적으로 키를 정렬(`Object.keys(obj).sort()`)한 뒤 순회한다.

### 3.3 타입 배열 (`TypedArray`: `Float32Array`, `Int32Array` 등)
- **명세 사실:** [ECMA-262 §23.2 `TypedArray Objects`](https://tc39.es/ecma262/multipage/indexed-collections.html#sec-typedarray-objects)에 따라 `Float32Array`(데모의 `GROUND`, `SURF`, `BLD`)에 숫자를 쓰고 읽는 동작은 IEEE 754 binary32 `roundTiesToEven`(`Math.fround`와 동일)을 따르므로 모든 엔진에서 결정적이다.
- **파괴 지점:**
  1. 동일한 `ArrayBuffer`에 서로 다른 타입 뷰(예: `Float32Array` 버퍼를 `Uint8Array`로 읽거나 해싱)를 겹쳐 쓰면 CPU 바이트 엔디언(Endianness)에 의존하게 된다([ECMA-262 §25.1.2](https://tc39.es/ecma262/multipage/structured-data.html#sec-arraybuffer-objects)).
  2. 연산 중 발생한 `NaN`의 비트 페이로드(sign bit 및 quiet NaN payload bits)는 엔진/하드웨어마다 다를 수 있다([ECMA-262 §6.1.6.1](https://tc39.es/ecma262/multipage/ecmascript-data-types-and-values.html#sec-ecmascript-language-types-number-type)).
- **M1 규칙:** 지형 및 상태 해시(Checksum) 계산 시 원시 `Float32Array.buffer` 바이트를 그대로 해싱하지 말고, 값을 정수로 양자화하거나 `DataView`에서 리틀 엔디언(`littleEndian = true`)을 명시하고 `NaN` 여부를 사전 검증한다.

### 3.4 부동소수 누적 순서 및 비결합성 (`(a + b) + c !== a + (b + c)`)
- **명세 사실:** [ECMA-262 §6.1.6.1.7 `Number::add`](https://tc39.es/ecma262/multipage/ecmascript-data-types-and-values.html#sec-numeric-types-number-add) 및 [§6.1.6.1.4 `Number::multiply`](https://tc39.es/ecma262/multipage/ecmascript-data-types-and-values.html#sec-numeric-types-number-multiply)가 명시하듯, 유한 정밀도 부동소수점 덧셈과 곱셈은 교환법칙(`a + b === b + a`)은 성립하나 **결합법칙은 성립하지 않는다**.
- **파괴 지점:**
  1. 시간 누적: 매 틱 `simT += 0.05`로 더하면 거듭된 반올림 오차가 누적된다. 데모 1329행(`simT = tick * STEP`)처럼 정수 `tick`에서 곱셈으로 도출하거나, 아예 시뮬레이션 내부 시간을 **정수 `tick` (1 tick = 50 ms, 20 ticks = 1 s)** 으로만 관리해야 한다.
  2. 루프 누적: 적 소대·병사 배열 순회 순서가 바뀌면 합산/평균 좌표(`P.cx`, `P.cy`) 결과가 달라진다.

---

## 4. 결정적 록스텝·리플레이 검증을 하는 웹/크로스플랫폼 게임들의 공개 사례

1. **0 A.D. (Wildfire Games — SpiderMonkey JS 시뮬레이션 + C++ 록스텝 RTS):**
   - **방식:** 멀티플레이어 록스텝과 리플레이 검증을 위해 JS 시뮬레이션 레이어([`binaries/data/mods/public/globalscripts/Math.js`](https://raw.githubusercontent.com/0ad/0ad/master/binaries/data/mods/public/globalscripts/Math.js))에서 호스트 엔진의 `Math.cos`, `Math.sin`, `Math.atan`, `Math.atan2`, `Math.pow`를 **순수 JS 다항식 근사 함수(사칙연산 `+`, `-`, `*`, `/`, `%`만 사용)로 덮어써서(override)** OS별 부동소수점 라이브러리 차이를 제거했다. 거리 계산에는 `Math.hypot` 대신 `Math.sqrt(dx*dx + dz*dz)`(`euclidDistance2D`)를 사용하며, C++ 기동/충돌 레이어([`source/maths/Fixed.cpp`](https://raw.githubusercontent.com/0ad/0ad/master/source/maths/Fixed.cpp))는 32비트 Q15.16 고정소수점(`CFixed_15_16`)을 사용한다.

2. **Rapier (`@dimforge/rapier2d-deterministic` / `rapier3d-deterministic` — 웹 Wasm 물리 엔진):**
   - **방식:** 공식 문서([Determinism | Rapier JavaScript User Guide](https://rapier.rs/docs/user_guides/javascript/determinism))에 따르면 IEEE 754-2008을 준수하는 모든 브라우저/OS에서 Wasm 소프트웨어 수학 구현을 통해 비트 단위 크로스플랫폼 결정성을 달성한다. 특히 문서에서 **"자바스크립트의 `Math.sin`, `Math.cos` 등 초월 함수는 플랫폼 간 결정적이지 않으므로 시뮬레이션 입력 계산에 절대 사용하지 말 것"** 을 명시적으로 경고한다.

3. **Pokémon Showdown (`smogon/pokemon-showdown` — 브라우저 및 Node.js 겸용 배틀 시뮬레이터):**
   - **방식:** [`sim/prng.ts`](https://raw.githubusercontent.com/smogon/pokemon-showdown/master/sim/prng.ts)에서 명시적 시드 기반 정수 PRNG(`ChaCha20` / 64비트 LCG)와 입력 로그(`inputLog`: 시드 + 초기 편성 + 매 턴 플레이어 선택)만을 기록하여 브라우저와 Node.js 서버에서 동일한 배틀을 100% 재현·검증한다.

4. **Factorio (Wube Software — 결정적 록스텝 및 리플레이 아키텍처):**
   - **방식:** 공식 기술 블로그([Factorio Friday Facts #302](https://factorio.com/blog/post/fff-302))에서 설명하듯, 모든 클라이언트가 서버로부터 받은 틱 스탬프 기반 입력 액션(Input Action)만으로 시뮬레이션하는 **신성한 게임 상태(Sacred Deterministic Game State)** 와 카메라/UI/오디오 등 **비결정적 렌더/지연 은폐 상태(Latency/Render State)** 를 엄격히 분리한다.
   - *(참고: PRD §11.3에 언급된 공개 레퍼런스 [KH-179 포병 시뮬레이터 (`kh179.pages.dev`)](https://kh179.pages.dev/)도 조사했으나, 이는 클라이언트 단독 Three.js 훈련 시뮬레이터로 서버 리플레이 검증 아키텍처는 포함하지 않는다.)*

---

## 5. M1 스펙에 반영할 시뮬레이션 코딩 규칙 및 테스트 전략

### 5.1 M1 시뮬레이션(`src/sim/`, `src/radio/`) 필수 코딩 규칙 10계명
M6 서버 재생 검증([`PRD/OBSERVER_PRD_v0.2.md` §10.4](file:///mnt/c/dev/observer/PRD/OBSERVER_PRD_v0.2.md))이 브라우저(V8/JSC/SpiderMonkey)와 서버(Node/Vercel) 사이에서 100% 일치하도록 M1 스펙에 다음 규칙을 강제한다:

1. **네이티브 비결정적 `Math` 함수 호출 전면 금지 (ESLint `no-restricted-properties` 강제):**
   - `src/sim/` 및 `src/radio/` 내부에서 `Math.sin`, `Math.cos`, `Math.tan`, `Math.asin`, `Math.acos`, `Math.atan`, `Math.atan2`, `Math.exp`, `Math.expm1`, `Math.log`, `Math.log1p`, `Math.log2`, `Math.log10`, `Math.pow`, `Math.hypot`, `Math.cbrt`, `Math.sinh`, `Math.cosh`, `Math.tanh` 및 거듭제곱 연산자 `**`의 사용을 빌드 타임에 차단한다([ECMA-262 §21.3.2](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-function-properties-of-the-math-object), [§6.1.6.1.3](https://tc39.es/ecma262/multipage/ecmascript-data-types-and-values.html#sec-numeric-types-number-exponentiate)).
2. **허용된 표준 연산 및 `sim/math.ts` 결정적 수학 모듈 사용:**
   - 표준 허용 연산: `+`, `-`, `*`, `/`, `Math.sqrt`, `Math.imul`, `Math.fround`, `Math.abs`, `Math.floor`, `Math.ceil`, `Math.round`, `Math.trunc`, `Math.min`, `Math.max`, 비트 연산자([ECMA-262 §6.1.6.1](https://tc39.es/ecma262/multipage/ecmascript-data-types-and-values.html#sec-ecmascript-language-types-number-type)).
   - 거리 및 제곱: `hypot(dx, dy)`는 `Math.sqrt(dx * dx + dy * dy)`로, `x ** 2`는 `sq(x) = x * x`로 작성한다.
   - 초월 함수(`detExp`, `detSin`, `detCos`, `detTan`, `detAtan2`, `detLog`): 오직 `+`, `-`, `*`, `/`와 정수 비트 연산만으로 구성된 `src/sim/math.ts`의 결정적 다항식/유리식 함수를 사용한다([0 A.D. `Math.js`](https://raw.githubusercontent.com/0ad/0ad/master/binaries/data/mods/public/globalscripts/Math.js)).
3. **결정적 PRNG 및 가우시안 샘플러 분리:**
   - `Math.random()` 사용을 금지하고 `mulberry32(seed)` 스트림을 도메인별(`terrain`, `enemyAI`, `ballistics`, `radio`)로 분리한다([`OBSERVER_demo_v0.2.html` 182~190행](file:///mnt/c/dev/observer/PRD/OBSERVER_demo_v0.2.html)).
   - 가우시안 난수(`gaussOf`)는 `Math.log`/`Math.cos`를 호출하지 않도록 `detLog` 기반 Marsaglia Polar Method 또는 정수/다항식 역변환으로 구현한다.
4. **시간의 정수 틱(`tick: number`) 일원화:**
   - 시뮬레이션 내부 상태와 이벤트 스케줄러는 부동소수점 초(`simT += 0.05`)를 누적하지 않고 **정수 `tick` (1 tick = 50 ms)** 만을 기본 시간 단위로 사용한다. 초 단위 실수가 필요한 수식에서만 `const simT = tick * 0.05`로 계산한다([ECMA-262 §6.1.6.1.7](https://tc39.es/ecma262/multipage/ecmascript-data-types-and-values.html#sec-numeric-types-number-add)).
5. **이벤트 큐의 결정적 타이브레이커(Tie-breaker) 강제:**
   - 예약 이벤트(`at(delayTicks, fn)`)는 `{ dueTick: currentTick + delayTicks, seq: nextSeq++, ... }` 구조를 가지며, 정렬 비교식은 반드시 `(a.dueTick - b.dueTick) || (a.seq - b.seq)`를 사용한다([ECMA-262 §23.1.3.30.1](https://tc39.es/ecma262/multipage/indexed-collections.html#sec-sortindexedproperties)).
6. **렌더러·뷰포트·DOM 상태의 시뮬레이션 유입 차단:**
   - `src/sim/`과 `src/radio/`는 `window`, `document`, `performance.now()`, `Date.now()`, 화면 해상도 프리셋(`VW`, `VH`, `V.focal`)을 절대 참조할 수 없다([`PRD/OBSERVER_PRD_v0.2.md` §7.5](file:///mnt/c/dev/observer/PRD/OBSERVER_PRD_v0.2.md), [Factorio FFF-302](https://factorio.com/blog/post/fff-302)).
   - 데모 1077행의 `identifyAt(ix, iy)`처럼 화면 픽셀 좌표를 시뮬레이션에 넘기지 말고, 입력 단계에서 **정규화된 조준 방위각/고각(양자화된 mil 또는 라디안)** 으로 변환한 뒤 입력 로그에 기록하고 `sim/`에 전달한다.
7. **유저 입력 로그(`inputLog`)의 경계면 양자화:**
   - 모든 플레이어 입력은 정수 `tick` 스탬프와 양자화된 정수/고정 정밀도 파라미터(예: 방위각·고각 `0.1 mil` 단위 정수, 격자 좌표 `1 m` 또는 `10 m` 단위 정수, 탄종·신관·발수 열거형)로 기록하여 JSON 직렬화 시 부동소수점 표현 오차가 발생하지 않게 한다([Pokémon Showdown `sim/prng.ts`](https://raw.githubusercontent.com/smogon/pokemon-showdown/master/sim/prng.ts)).
8. **엔티티 순회 및 부동소수 합산 순서 고정:**
   - `for..in`을 금지하고 고정 순서 배열(`Array`) 또는 `Map`만 사용하며, 소대/병사 루프 및 벡터 합산 순서를 항상 생성 ID 오름차순으로 고정한다([ECMA-262 §10.1.11.1](https://tc39.es/ecma262/multipage/ordinary-and-exotic-objects-behaviours.html#sec-ordinaryownpropertykeys), [§6.1.6.1.7](https://tc39.es/ecma262/multipage/ecmascript-data-types-and-values.html#sec-numeric-types-number-add)).
9. **`TypedArray` 해싱 및 직렬화 규칙:**
   - `Float32Array` 지형 데이터(`GROUND`, `SURF`) 생성 직후와 시뮬레이션 종료 시 상태 해시(State Digest)를 산출할 때는 엔디언 독립적인 정수 양자화 배열 또는 `DataView` 리틀 엔디언 읽기를 사용한다([ECMA-262 §23.2](https://tc39.es/ecma262/multipage/indexed-collections.html#sec-typedarray-objects)).
10. **런 버전(`simVersion`) 명시:**
    - 리플레이 페이로드에 `simVersion`(또는 커밋 해시)을 포함하여, 시뮬레이션 수식이 업데이트되더라도 구버전 리플레이와 신버전 서버 검증기가 혼선 없이 매칭되도록 한다([`PRD/OBSERVER_PRD_v0.2.md` §10.4](file:///mnt/c/dev/observer/PRD/OBSERVER_PRD_v0.2.md)).

### 5.2 M1 결정성 검증 테스트 전략 (CI 파이프라인)
1. **정적 분석 게이트 (Lint Gate):**
   - ESLint 규칙으로 `src/sim/**` 및 `src/radio/**` 내 금지된 `Math.*` 프로퍼티, `**` 연산자, `for..in` 문, `Date`/`performance` 전역 객체 참조 시 CI 실패 처리.
2. **골든 리플레이 해시 테스트 (Golden Replay Digest Test):**
   - 고정 시드(예: `seed = 20260420`)와 대표 시나리오 입력 로그(관측·레이저·효력사·수정사·VT신관·연막탄·조명탄·적 돌격 포함 10분 분량 = 12,000틱)를 실행한 뒤, 매 200틱(10초)마다의 상태 스냅샷 해시(지형 해시 + 적 병사 좌표/생존 상태 + 탄착 좌표 + 최종 점수/등급)를 골든 해시와 비교.
3. **크로스 엔진 Playwright + Node.js 교차 검증 (Cross-Engine Matrix Test):**
   - CI에서 동일한 골든 시드 + 입력 로그를 **Playwright 3대 브라우저 엔진(`chromium` [V8], `firefox` [SpiderMonkey], `webkit` [JavaScriptCore])** 과 **Node.js 서버 런타임**에서 각각 실행하고, 4개 환경이 산출한 상태 스냅샷 해시 및 최종 점수가 **1비트도 빠짐없이 100% 일치**하는지 자동 검증한다.

---

## Unresolved

1. **`sim/math.ts` 초월 함수 근사 알고리즘의 구체적 계수 표준화 여부:**
   - 순수 TS로 구현할 `detExp`, `detSin`, `detCos`, `detTan`, `detAtan2`, `detLog`를 `fdlibm` IEEE 754 비트 조작 포팅(`Math.imul` + `DataView`/`Float64Array` 지수부 추출, ~1 ULP 정밀도)으로 구현할지, 혹은 분기 없는 순수 사칙연산 다항식/파데 근사(예: 0 A.D. 방식, ~$10^{-6}$ 정밀도)로 구현할지 M1 상세 설계에서 확정해야 한다(두 방식 모두 크로스 엔진 결정성은 100% 보장함).
2. **`identifyAt` 입력 로그 포맷 변경 범위:**
   - 현행 데모(`PRD/OBSERVER_demo_v0.2.html` 1081행)는 클라이언트에서 판정한 `best.pid`를 입력 로그(`['id', [best.pid, ...]]`)에 직접 기록한다. M6 부정행위 방지(Anti-cheat) 수준을 높이기 위해 입력 로그에 플레이어의 조준 각도`(cam.h, cam.p)`만 기록하고 서버가 `identifyAt`을 재계산하게 할 것인지, 아니면 `best.pid`와 조준 각도를 함께 기록해 서버가 유효 각도 범위만 검증할 것인지 M1/M6 인터페이스 확정 시 결정이 필요하다.
