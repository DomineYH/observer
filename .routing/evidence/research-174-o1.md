# Web Speech API `SpeechRecognition` 기반 한국어 음성 입력 조사 보고서 (research-174-o1)

- 대상 이슈: `DomineYH/observer#174` (상위 지도 `#173`)
- 기준 저장소 커밋: `2332372` / 조사일: `2026-11-23`
- 용어 기준: `GLOSSARY.md` (`음성 입력`, `음성 출력`, `교신 문장`, `숫자 읽기`, `방안 문자`, `끝말`, `복창`)

## Claims

| # | Claim | Kind | Source | Evidence |
|---|---|---|---|---|
| 1 | OBSERVER 기존 음성 출력(`src/adapters/webSpeech.ts`)은 `window.speechSynthesis`로 `lang = 'ko-KR'`, `rate = 1.05` 및 `'ko'` 음성 선택을 사용한다. | fact | `src/adapters/webSpeech.ts` | `u.lang = 'ko-KR'; u.rate = 1.05; speechSynthesis.getVoices().find((v) => v.lang?.startsWith('ko'));` |
| 2 | OBSERVER `교신 문장`은 고정 한국어 어휘와 한 자리씩 `숫자 읽기`·한글 `방안 문자`(알파~줄루)를 사용한다. | fact | `src/ui/radio/readings.ts` | `digits(4720,4) -> '넷칠둘공'; hundreds(250) -> '둘백오십'; rounds(3) -> '삼발'` |
| 3 | ADR 0013에 따라 OBSERVER 공개 빌드는 API 키·계정·로그인·유료 서비스 없이 공개 자료만 사용해야 한다. | fact | `docs/adr/0013-public-builds-use-only-login-free-open-data.md` | `공개 빌드는 로그인 없는 공개 자료만 쓴다` |
| 4 | `@mdn/browser-compat-data` `v8.1.10`(2026-11-23)은 Chrome 158(2026-11-17)·Edge 158(2026-11-19)·Firefox 160(2026-11-10)·Safari 27.2(2026-10-26)를 현행으로 기록한다(`caniuse`와 일부 충돌). | fact | https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/SpeechRecognition.json | `BCD pkg: 8.1.10; chrome 158 (2026-11-17), edge 158 (2026-11-19), firefox 160 (2026-11-10), safari 27.2 (2026-10-26)` |
| 5 | 데스크톱 Chrome은 33(`webkitSpeechRecognition`)·139(무접두사 `SpeechRecognition`)부터 플래그 없이 지원하며 SODA/클라우드에서 `ko-KR`을 포함한다. | fact | https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/soda/constants.h?format=TEXT | `"ko-KR", (SODA constants.h L169); chrome: version_added 139, prefix webkit version_added 33` |
| 6 | Android Chrome은 33(`webkitSpeechRecognition`)·139(무접두사)를 지원하고 `EXTRA_LANGUAGE`로 `ko-KR`을 전달하나 `processLocally`·`phrases`·`continuous`는 `false`다. | fact | https://chromium.googlesource.com/chromium/src/+/refs/heads/main/content/public/android/java/src/org/chromium/content/browser/SpeechRecognitionImpl.java?format=TEXT | `mIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language);` |
| 7 | 데스크톱 Edge는 정책 `SpeechRecognitionEnabled`(>=87) 및 BCD mirror(33/139)로 지원하며 Canary/Dev 150.0.4076+ 온디바이스 프리뷰는 `Korean (ko-KR)`을 명시한다(`caniuse` 충돌). | fact | https://learn.microsoft.com/en-us/microsoft-edge/web-platform/speech-recognition-api | `The local speech recognition model is available in Microsoft Edge Canary or Dev (version 150.0.4076 or later). Korean (ko-KR)` |
| 8 | 데스크톱 Firefox는 160(2026-11-10)부터 플래그 없이 무접두사 `SpeechRecognition`·`webkitSpeechRecognition`을 지원하며 `models.yaml`에 `ko-KR`이 있다(`caniuse` 충돌). | fact | https://raw.githubusercontent.com/mozilla-firefox/firefox/main/dom/media/webspeech/recognition/models.yaml | `id: multilingual ... supported_locales: - ko-KR ... display_name: "Nemotron 3.5 ASR Streaming 0.6B"` |
| 9 | Android용 Firefox(`firefox_android`)는 `SpeechRecognition`을 지원하지 않으며 Bugzilla 1244242는 2026-09-17 기준 `NEW` 상태다. | fact | https://bugzilla.mozilla.org/rest/bug/1244242 | `status: NEW; summary: Enable Web Speech API (on device) on Android` |
| 10 | 데스크톱 Safari는 14.1(2021-04-26)부터 `webkitSpeechRecognition` 접두사만 지원하며(무접두사 `false`) OS Siri/받아쓰기 활성화가 필요하다. | fact | https://webkit.org/blog/11648/new-webkit-features-in-safari-14-1/ | `Safari supports speech recognition powered by the same speech engine as Siri.` |
| 11 | iOS Safari는 14.5부터 `webkitSpeechRecognition`을 지원하나 `SFSafariViewController`(`webview_ios`)에서는 미지원이며(Bug 225298) Safari 26.0에서 `SecureContext`를 수정했다. | fact | https://bugs.webkit.org/show_bug.cgi?id=225298&ctype=xml | `Yes, SpeechRecognition API is not available in SafariViewController and web apps added to Home Screen for now.` |
| 12 | Safari/iOS Safari Web Speech API 전용 공식 `ko-KR` BCP-47 목록표는 확인되지 않았다(Siri 50+ 언어·OS 한국어 받아쓰기 간접 근거만 존재). | fact | unconfirmed | `Search: webkit.org blog, developer.apple.com Safari docs, WebKit SpeechRecognition source — no explicit Web Speech ko-KR locale table` |
| 13 | Edge 모바일(Android/iOS)은 정책 문서가 `Not supported`로 표기하며 독자적 Web Speech 지원 목록이 확인되지 않았다. | fact | unconfirmed | `Search: Microsoft Learn Edge web-platform & policy docs — desktop only; Android: Not supported, iOS: Not supported` |
| 14 | 데스크톱 Chrome 기본 모드(`processLocally = false`)는 오디오·도메인·언어 설정을 쿠키 없이 HTTPS로 Google 서버에 전송한다. | fact | https://web.archive.org/web/20230530065807id_/https://www.google.com/chrome/privacy/whitepaper.html | `It uses Google's servers to perform the conversion. Using the feature sends an audio recording to Google` |
| 15 | 데스크톱 Chrome 139(2025-08-05)는 `processLocally`, `available()`, `install()`을 도입해 SODA 온디바이스 인식(`ko-KR` 포함) 시 외부 전송을 차단한다. | fact | https://developer.chrome.com/release-notes/139 | `allowing websites to ensure that neither audio nor transcribed speech are sent to a third-party service for processing.` |
| 16 | Android Chrome은 `processLocally`·`available()`·`install()`이 모두 `false`이며 JNI로 Android OS `SpeechRecognizer`에 오디오 처리를 위임한다. | fact | https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/SpeechRecognition.json | `chrome_android: available_static false, install_static false, processLocally false` |
| 17 | Edge 기본 모드는 오디오를 임의 토큰과 함께 Azure Cognitive Services로 보내며(저장 안 함), Canary/Dev 150.0.4076+ 플래그 로컬 모델은 기기 내 처리(`ko-KR`)한다. | fact | https://learn.microsoft.com/en-us/legal/microsoft-edge/privacy | `The recorded audio is sent with a randomly generated token over a secure HTTPS connection to the Microsoft Azure Cognitive Services.` |
| 18 | Firefox 160은 원격 백엔드 없이 오직 로컬(`parakeet.cpp` + `libggml`, 다국어 ~785 MB 모델)로만 인식하며 `available({processLocally: false})`는 `'unavailable'`을 반환한다. | fact | https://raw.githubusercontent.com/mozilla-firefox/firefox/main/dom/media/webspeech/recognition/SpeechRecognition.cpp | `if (!aOptions.mProcessLocally) { ... AvailabilityStatus::Unavailable; }` |
| 19 | Safari·iOS Safari는 `processLocally` API가 없으며 Apple 개인정보 문서(2026-10-26) 기준 설정에서 기기 내 처리 미표시 시 회전하는 임의 ID와 함께 Apple 서버로 전송된다. | fact | https://www.apple.com/legal/privacy/data/en/ask-siri-dictation/ | `your device will indicate in Siri Settings or Keyboard Settings whether the things you say are processed on your device` |
| 20 | Web Speech API는 앱/빌드에 개발자 API 키·계정·요금이 불필요해 ADR 0013의 무비밀 공개 빌드 요건과 충돌하지 않는다(단 외부 벤더 서버·사용자 설정 의존). | fact | `docs/adr/0013-public-builds-use-only-login-free-open-data.md` | `No developer credentials or keys are required by Web Speech API interfaces` |
| 21 | 명세(2026-10-27)에서 JSGF/`SpeechGrammar`는 폐기·제거되었고 `grammars` 속성은 하위 호환용 무동작 상태이며 Safari·iOS Safari는 `SpeechGrammarList`가 없다. | fact | https://webaudio.github.io/web-speech-api/ | `This attribute does nothing and exists in this spec for the sole purpose of maintaining backwards compatibility.` |
| 22 | `phrases` / `SpeechRecognitionPhrase`(boost `0.0~10.0`, 기본 `1.0`)는 Chrome 142에 출시됐으나 온디바이스 전용(`!processLocally` 시 `phrases-not-supported`)이며 ChromeStatus와 상태 충돌이 있다. | fact | https://developer.chrome.com/release-notes/142 | `A valid boost must be a float value inside the range [0.0, 10.0], with a default value of 1.0 if not specified.` |
| 23 | Firefox 160은 `phrases` WebIDL을 노출하지만 백엔드 미연동(`partial_implementation`, Bugzilla 2072244 `NEW`)으로 인식 결과에 영향을 주지 않는다. | fact | https://bugzilla.mozilla.org/rest/bug/2072244 | `Phrases can be set but do not affect recognition.` |
| 24 | Android Chrome과 Safari·iOS Safari는 `phrases` / `SpeechRecognitionPhrase`를 지원하지 않는다(Android 소스는 `kPhrasesNotSupported` 오류 반환). | fact | https://chromium.googlesource.com/chromium/src/+/refs/heads/main/content/browser/speech/speech_recognizer_impl_android.cc?format=TEXT | `media::mojom::SpeechRecognitionErrorCode::kPhrasesNotSupported` |
| 25 | 명세와 주요 엔진은 `start()`, `stop()`(워키토키/PTT 끝맺음 결과 반환), `abort()`(즉시 중단)를 제공하나 활성 중 재호출 시 `InvalidStateError`가 난다. | fact | https://webaudio.github.io/web-speech-api/ | `for a web application where the end user is doing the end pointing, similar to a walkie-talkie` |
| 26 | `interimResults`는 지원 브라우저 전체에서 동작하나 `continuous`는 Android Chrome에서 미지원(`crbug 41297427`, 설정 무효)이고 Safari는 17에서 정식 지원되었다. | fact | https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/SpeechRecognition.json | `chrome_android continuous: false (crbug.com/41297427): The property can be set, but has no effect.` |
| 27 | `maxAlternatives`는 Chromium 네트워크 엔진에서 최대 30개·Firefox 160은 단일 후보이며, `confidence`는 Chrome SODA와 Android 온디바이스에서 고정 `1.0f`로 보고된다. | fact | https://chromium.googlesource.com/chromium/src/+/refs/heads/main/content/browser/speech/soda_speech_recognition_engine_impl.cc?format=TEXT | `constexpr float kSpeechRecognitionConfidence = 1.0f;` |
| 28 | Chromium 데스크톱 엔드포인터는 발화 전 `8,000 ms` `no-speech` 타임아웃, `!continuous` 시 0.5초/1.0초 침묵 종료, `continuous` 시 15초 침묵 종료를 가진다. | fact | https://chromium.googlesource.com/chromium/src/+/refs/heads/main/content/browser/speech/speech_recognizer_impl.cc?format=TEXT | `In continuous recognition, the session is automatically ended after 15 seconds of silence.` |
| 29 | Android Chrome은 연속 모드 최소 입력 길이 Intent `5분(300,000 ms)`을 설정하나 데스크톱 Chrome·Edge·Firefox·Safari의 단일 세션 최대 길이 상한은 확인되지 않았다. | fact | unconfirmed | `Search: Web Speech spec, MDN, Chromium speech/*.cc, Firefox SpeechRecognition*.cpp, WebKit SpeechRecogni*.cpp — no explicit session max duration constant` |
| 30 | Chromium `!continuous` 침묵 대기(0.5~1초)·환경소음 추정(300 ms), Firefox ~80 ms 청크(20 ms 폴링)는 확인되나 발화 종료 후 최종 결과 도달 지연(ms SLA)은 확인되지 않았다. | fact | unconfirmed | `Search: W3C spec, MDN, Chrome/Edge/Firefox/WebKit docs & C++ source — only endpointer silence wait (0.5s/1s) & 20ms poll documented` |
| 31 | `SpeechRecognition`은 `[SecureContext]`를 요구하며(Safari 26.0에서 적용 누락 수정) iframe에서는 `microphone` 및 `on-device-speech-recognition` Permissions Policy가 필요하다. | fact | https://developer.apple.com/documentation/safari-release-notes/safari-26-release-notes | `Fixed making the SpeechRecognition interface available only within a secure context. (151240414)` |
| 32 | 마이크 프롬프트는 `start()` 오디오 캡처 개시 시 뜨며, `start()` 자체는 WebIDL 제스처 검사가 없으나 Chrome·Firefox의 `install()`은 일시적 사용자 활성화를 필수로 요구한다. | fact | https://raw.githubusercontent.com/mozilla-firefox/firefox/main/dom/media/webspeech/recognition/SpeechRecognition.cpp | `aRv.ThrowNotAllowedError("install() requires transient user activation");` |
| 33 | 권한 지속 기간은 Chrome(116+) 방문 중 지속 vs 이번만 허용(이동/종료·16시간·5분 비활성 만료), Mac Safari 묻기/거부/항상 허용, Firefox 지속+13개월 미사용 만료(Nightly)로 다르다. | fact | https://developer.chrome.com/blog/one-time-permissions | `16 hours have passed since granting permission.` |
| 34 | `SpeechRecognition`은 `speechSynthesis`를 음소거하지 않아 스피커 재생 시 재수음 위험이 있으며, Android T+ Chrome은 인프로세스 `AudioRecord`로 오디오 포커스 충돌 없이 동시 재생을 허용한다. | fact | https://chromium.googlesource.com/chromium/src/+/refs/heads/main/content/public/android/java/src/org/chromium/content/browser/SpeechRecognitionImpl.java?format=TEXT | `the recognition service does not request transient audio focus, so media keeps playing during recognition.` |
| 35 | iOS Safari/홈 화면 웹앱에서는 Bug 317741 수정 후에도 Bug 321436(`NEW`, 2026-11-18)에서 `speechSynthesis`/`<audio>` 또는 `stop()`/`abort()` 후 다음 인식 세션이 무응답 먹통이 되는 회귀가 보고된다. | fact | https://bugs.webkit.org/show_bug.cgi?id=321436&ctype=xml | `SpeechRecognition stops producing results (no onresult/onerror/onend) after an <audio>/<video> element plays, on iOS Safari` |
| 36 | 브라우저 Web Speech API `SpeechRecognition` (`lang = 'ko-KR'`)이 한국어 구술 숫자(예: `"공 하나 둘 삼"`, `"삼발"`)를 한글과 아라비아 숫자·띄어쓰기 중 무엇으로 표기하는지는 1차 문서에서 확인되지 않았다. | fact | unconfirmed | `Search: W3C spec, MDN, Chromium speech/soda sources, Edge docs, Firefox models.yaml, WebKit docs — no ko-KR number formatting rule` |
| 37 | 인접 클라우드 문서인 Google Cloud STT `class-tokens`는 `ko-KR` `$OOV_CLASS_DIGIT_SEQUENCE`에서 `"구 사 일 이"`를 `"9412"`로 정규화하는 예시를 보이나 브라우저 `SpeechRecognition` 계약은 아니다. | fact | https://docs.cloud.google.com/speech-to-text/docs/class-tokens | `Korean (South Korea) ko-KR $OOV_CLASS_DIGIT_SEQUENCE "구 사 일 이" 9412` |
| 38 | Microsoft Azure Speech 문서(2026-01-30)와 Apple ML Research ITN(2017-08-02)도 역텍스트정규화(ITN)의 숫자 변환 구조를 설명하지만 Edge·Safari Web Speech API에서 이를 제어·보장하는 문서는 없다. | fact | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-custom-speech-display-text-format | `Inverse Text Normalization (ITN) - To convert the text of spoken form numbers to display form.` |

---

## 1. 브라우저별 현재 지원 현황

기준 호환성 소스: `@mdn/browser-compat-data` `v8.1.10` (`2026-11-23` 조회; Chrome 158 `2026-11-17`, Edge 158 `2026-11-19`, Firefox 160 `2026-11-10`, Safari/iOS Safari 27.2 `2026-10-26`) [#4]. 보조 참조 `Fyrd/caniuse` `features-json/speech-recognition.json`(`status: unoff`, `updated` 필드 없음)은 다수 브라우저에서 BCD와 상충함 [#4][#5][#7][#8].

| 브라우저 / 환경 | 노출 인터페이스 및 접두사 | 도입 버전 (BCD/공식) | 플래그 / OS 선행조건 | `lang = 'ko-KR'` 문서화 | 출처 간 충돌 및 비고 |
|---|---|---|---|---|---|
| **Desktop Chrome** | `webkitSpeechRecognition` -> `SpeechRecognition` | `33` (`2014-02-20`) 접두사, `139` (`2025-08-05`) 무접두사 [#5] | 기본 활성화(플래그 불필요); 온디바이스는 팩 설치 필요 [#15] | **명시됨**: SODA `constants.h` 및 Web Speech 온디바이스 explainer 목록에 `ko-KR` 포함 [#5][#15] | `caniuse`는 157~161을 여전히 접두사 필요(`a x #1`)로 표기해 Chrome 139·BCD와 충돌 [#4][#5] |
| **Desktop Edge** | `webkitSpeechRecognition` / `SpeechRecognition` | 정책 `SpeechRecognitionEnabled >= 87` (`2020-11-19`); BCD Chrome `33`/`139` mirror [#4][#7] | 기본 정책 허용; 온디바이스 로컬 모델은 Canary/Dev `150.0.4076+`에서 `edge://flags` 필요 [#7] | **명시됨**: Edge 온디바이스 문서에 `Korean (ko-KR)` 명시; 클라우드는 Azure 백엔드 사용 [#7][#17] | `caniuse`는 Edge 79~157을 `n #3`(이벤트 미발생)로 표시해 Microsoft 공식 문서 및 BCD와 충돌 [#4][#7] |
| **Desktop Firefox** | `SpeechRecognition` 및 `webkitSpeechRecognition` 별칭 | `160` (`2026-11-10`) 정식 탑재 [#4][#8] | 플래그 없이 노출(단 `AI Controls` 차단 가능); 최초 사용 시 ~785 MB 모델 다운로드 동의 필요 [#8][#18] | **명시됨**: `models.yaml` 다국어 모델(`nemotron-3.5-asr-streaming-0.6b`)에 `ko-KR` 포함 [#8] | `caniuse`는 Firefox 22~163을 `n d #2`(플래그 뒤 미지원)로 표기해 BCD 160과 충돌 [#4][#8] |
| **Desktop Safari** | `webkitSpeechRecognition`만 노출 (무접두사 `false`) | `14.1` (`2021-04-26`) [#10] | macOS 시스템 설정에서 Siri 또는 받아쓰기 활성화 필수 [#10]; `26.0`(`2025-09-15`)에서 `SecureContext` 강제 수정 [#11] | **공식 Web Speech 표 미확인(unconfirmed)** [#12] (Siri 50+ 언어·OS 한국어 받아쓰기 간접 근거) | — |
| **Android Chrome** | `webkitSpeechRecognition` -> `SpeechRecognition` | `33` (`2014-02-26`) 접두사, `139` (`2025-08-05`) 무접두사 [#6] | 플래그 불필요; Android OS Google Speech Services(`com.google.android.tts` 또는 Google 앱) 의존 [#6] | **코드 전달 확인**: `EXTRA_LANGUAGE`로 전달되며 실제 지원은 단말 Google 인식 서비스에 좌우 [#6] | `processLocally`, `available`, `install`, `phrases`, `continuous` 모두 `false` [#6][#16][#24][#26] |
| **iOS Safari** | `webkitSpeechRecognition`만 노출 (무접두사 `false`) | `14.5` (`2021-04-26`) [#4][#11] | OS Siri/받아쓰기 활성화 필수; `SFSafariViewController`(`webview_ios`·iOS Chrome/Firefox) 미지원 [#11] | **공식 Web Speech 표 미확인(unconfirmed)** [#12] (Bug 321436 #2에서 커뮤니티 `ko-KR` 재현 보고) | Bug 225298(2021)은 홈 화면 웹앱 미지원이라 했으나 Bug 321436(2026)은 독립형 PWA에서도 실행·회귀 보고 [#11][#35] |
| **참고: Android Firefox / Edge Mobile** | 미지원 (`firefox_android: false`) / 정책 미지원 | Firefox Android Bug 1244242 `NEW` (`2026-09-17`) [#9]; Edge 정책 `Not supported` [#13] | — | 미지원 / 미확인 [#9][#13] | — |

---

## 2. 오디오 전송 경로, 온디바이스 모드 및 ADR 0013 관계

| 브라우저 | 기본 인식 경로 (오디오 전송처) | 온디바이스 모드 (`processLocally` / `available()` / `install()`) | 한국어(`ko-KR`) 포함 여부 | 벤더 공식 문서/개인정보 백서 인용 및 ADR 0013 대조 |
|---|---|---|---|---|
| **Desktop Chrome** | Google 클라우드 서버 (`speech-api/full-duplex/v1`) [#14] | **지원 (`139`, 2025-08-05)**: SODA 기반 `processLocally`, `available()`, `install()` 제공 [#15] | **포함 (`ko-KR`)** [#5][#15] | 백서: 오디오·도메인·언어 설정을 Google 서버로 전송(쿠키 미전송) [#14]; Chrome 139: 온디바이스 시 오디오·전사문 외부 미전송 [#15] |
| **Android Chrome** | Android OS `SpeechRecognizer` 서비스에 JNI 위임 (`com.google.android.tts` 등) [#6][#16] | **미지원 (`false`)**: `processLocally`·`available()`·`install()` 모두 미제공 [#16] | OS 인식기 설정 의존 | 웹 API 차원에서 온디바이스 강제 불가; OS 서비스가 클라우드 또는 단말 팩 선택 |
| **Desktop Edge** | Microsoft Azure Cognitive Services (HTTPS + 임의 토큰) [#17] | **문서·BCD 충돌**: BCD는 `139` mirror로 표기, Microsoft 문서는 Canary/Dev `150.0.4076+` (`edge://flags`) 로컬 모델 안내 [#7][#17] | **온디바이스 목록에 `Korean (ko-KR)` 명시** [#7] | Edge 개인정보 백서(2026-11-10): 임의 토큰과 HTTPS로 Azure 전송, 오디오 저장 안 함 [#17]; 로컬 모델: 기기 밖 미유출·AI 학습 미수집 [#7] |
| **Desktop Firefox** | **항상 온디바이스** (원격 백엔드 미구현; `parakeet.cpp` + `libggml` utility process) [#18] | **로컬 전용 (`160`, 2026-11-10)**: `available({processLocally: false})`는 `'unavailable'`; `install()`(사용자 제스처+동의)로 모델 설치 [#8][#18][#32] | **포함 (`ko-KR`, 다국어 ~785 MB 모델)** [#8][#18] | `SpeechRecognition.cpp`: `!mProcessLocally`면 원격 불가 반환, 실행 경로는 항상 온디바이스 [#18] |
| **Safari / iOS Safari** | OS의 Siri / 받아쓰기 엔진 경유 (웹에서 제어 불가) [#10][#19] | **미지원 (`false`)**: `processLocally`, `available()`, `install()` 없음 [#10][#19] | Apple OS 기능 목록에 한국어 기기 내 받아쓰기 포함(웹 API 보장 아님) [#12][#19] | Apple 개인정보 문서(2026-10-26): OS 설정에 기기 내 처리가 표시되지 않으면 회전하는 임의 ID와 함께 Apple 서버 전송 [#19] |
| **ADR 0013 관계** | — | — | — | 앱·공개 빌드에 API 키·로그인·과금을 포함하지 않아 ADR 0013의 무비밀 공개 빌드 요건과 양립함. 단 클라우드 경로와 모델 다운로드는 브라우저·OS 벤더 인프라와 사용자 설정에 의존함 [#3][#20] |

---

## 3. 지정 어휘 바이어싱 (`SpeechGrammarList` / `phrases`)

OBSERVER의 `교신 문장`(`기러기`, `여기는`, `사격지휘통보`, `효력사`, `순발신관`, `공`~`아홉`, `알파`~`줄루` 등) 바이어싱 관련 규격과 브라우저별 현황은 다음과 같다 [#2].

| 기능 / API | 명세(2026-10-27) 상태 | Desktop Chrome | Desktop Edge | Desktop Firefox `160` | Android Chrome | Safari / iOS Safari | 제한 사항 |
|---|---|---|---|---|---|---|---|
| **`SpeechGrammarList` / `grammars` (JSGF)** | **폐기·제거됨**: `grammars`는 하위 호환용 무동작 속성 [#21] | 속성만 호환 유지 (`33`/`139`); SODA에서는 미사용 [#21] | BCD mirror (속성 호환만) [#21] | 호환 IDL만 존재, 문법 바이어싱 미수행 [#21] | 호환 속성만 존재 [#21] | **미구현 (`false`)** [#10][#21] | 고정 어휘·문법을 강제하는 수단으로 사용 불가 [#21] |
| **`phrases` / `SpeechRecognitionPhrase`** | `ObservableArray`, `boost` `0.0~10.0`(기본 `1.0`, 범위 밖 `SyntaxError`) [#22] | **지원 (`142`, 2025-10-28)**: 온디바이스 전용 (`!processLocally` 시 `phrases-not-supported`) [#22] | BCD `142` mirror vs Edge 공식 문서는 클라우드 기준만 설명 (충돌) [#22] | **부분 구현 (`partial_implementation`)**: WebIDL 수락만 하고 백엔드 미연동(Bug 2072244 `NEW`) [#23] | **미지원 (`false`)**: `kPhrasesNotSupported` 오류 반환 [#24] | **미지원 (`false`)** [#10][#24] | ChromeStatus 5225615177023488 상위 status가 여전히 `Proposed`로 표시되는 문서 불일치 존재 [#22] |

---

## 4. 푸시 투 토크(Push-to-Talk) 적합성 및 제약

| 항목 | 명세 및 브라우저 지원 현황 | PTT 구현 시 구체적 제약 / 동작 한계 |
|---|---|---|
| **`start()`, `stop()`, `abort()`** | 명세·Chrome·Edge·Firefox·Safari 모두 구현; 명세는 `stop()`의 전형적 용례로 `"walkie-talkie"`(버튼을 떼면 이미 수집한 음성으로 결과 산출)를 명시하며 `abort()`는 즉시 폐기 [#25] | 세션 진행 중(`error`/`end` 전) `start()` 재호출 시 `InvalidStateError` [#25]; iOS 27 Safari에서는 `stop()`/`abort()`로 세션을 끊으면 다음 세션이 먹통이 되는 Bug 321436 보고 존재 [#35] |
| **`interimResults`** | Chrome, Android Chrome, Edge, Firefox `160`, Safari `14.1+`/`iOS 14.5+` 모두 지원 [#26] | 실시간 자막 피드백 가능하나 최종 결과 전 텍스트가 바뀔 수 있음 |
| **`continuous`** | Desktop Chrome·Edge·Firefox `160`·Safari `17+` 지원(Safari `14.1~16` 부분 지원); **Android Chrome 미지원 (`false`, `crbug.com/41297427`)** [#26] | Android Chrome에서는 `continuous = true`가 무시되어 단일 발화 후 자동 종료될 수 있음 [#26]; 데스크톱 Chromium에서는 `!continuous` 시 0.5~1초 침묵만으로 끊기므로 PTT 유지 중 조기 종료 위험 [#28] |
| **`maxAlternatives` & `confidence`** | Chrome 네트워크 최대 `30`, Firefox `160`은 단일 후보만 추가; Chrome SODA와 Android 온디바이스는 `confidence = 1.0f` 고정 보고 [#27] | 다중 후보 비교는 Firefox/온디바이스 환경에서 제한적이며 `confidence` 점수는 SODA·Android에서 상수 `1.0`이어서 임계값 판별 신호로 신뢰 불가 [#27] |
| **단일 세션 시간/길이 제한** | Chromium 엔드포인터: 발화 전 `8,000 ms` 무음 시 `no-speech`, `!continuous` 시 `0.5s`(<3s 발화) 또는 `1.0s`(>=3s) 침묵 종료, `continuous` 시 `15s` 침묵 종료 [#28]; Android Intent는 연속 최소 길이 `5분(300,000 ms)` 전달 [#29] | 데스크톱 Chrome(클라우드/SODA)·Edge·Firefox·Safari의 **단일 세션 절대 최대 길이 상한은 1차 문서에서 미확인(unconfirmed)** [#29] |
| **발화 종료~최종 결과 지연** | Chromium `!continuous` 침묵 판정 대기 `0.5s`/`1.0s` + 초기 소음 추정 `300 ms` [#28][#30]; Firefox `parakeet.cpp` `~80 ms` 청크·`20 ms` 폴링 + `stop()` IPC 플러시 [#30] | 클라우드·Apple 서버 왕복 및 모델 종단 지연에 대한 **정확한 밀리초(ms) SLA 수치는 미확인(unconfirmed)** [#30] |

---

## 5. 실행 조건 및 기존 `음성 출력`(`speechSynthesis`)과의 상호작용

| 조건 항목 | 세부 내용 및 출처 |
|---|---|
| **Secure Context & 정책** | `[SecureContext]` 필수(HTTPS/`localhost`; Safari `26.0`에서 미적용 버그 수정). 크로스 오리진 iframe에서는 `microphone` 및 온디바이스 시 `on-device-speech-recognition` Permissions Policy 허용 필요 [#31]. |
| **프롬프트 시점 & 사용자 제스처** | `start()`가 오디오 캡처를 열 때 마이크 프롬프트 표시(Safari는 시스템 음성인식 TCC·마이크 TCC·사이트 권한 순차 확인 및 탭 가시성 `isViewVisible` 요구; Android Chrome도 가시 탭 이탈 시 세션 즉시 종료) [#32]. `start()` 자체는 명세 WebIDL상 일시적 사용자 활성화 검사가 없으나 Chrome·Firefox의 `install()`은 사용자 제스처를 필수로 소모하며 무제스처 시 `NotAllowedError` 발생 [#32]. |
| **권한 유지 기간** | **Chrome(116+)**: `방문 중 허용`(지속) vs `이번만 허용`(다른 출처 이동·탭 종료·`16시간` 경과·또는 마이크 미사용 백그라운드 `5분` 시 만료) [#33]. **Mac Safari**: `묻기`/`거부`/`항상 허용` [#33]. **Firefox**: 지속 허용(또는 일회성) + `미사용 권한 만료`(기본 13개월 비활성, 현재 `Nightly` 전용) [#33]. |
| **`speechSynthesis` 동시 재생 충돌** | 1) **음향 재수음**: `src/adapters/webSpeech.ts`의 `speechSynthesis` 출력은 자동 음소거되지 않아 스피커 환경에서 마이크가 `음성 출력`을 그대로 수음할 수 있음 [#1][#34].<br>2) **Android 오디오 포커스**: Android T+ Chrome(`SpeechRecognitionImpl.java`)은 인프로세스 `AudioRecord`로 포커스를 뺏지 않고 미디어 동시 재생을 허용하나, T 미만·fallback 경로에서는 포커스 전환/덕킹 또는 백그라운드 캡처 무음이 발생 가능 [#34].<br>3) **iOS Safari/PWA 먹통 회귀**: Bug 317741 수정(2026-06-26) 후에도 **Bug 321436 (`NEW`, 2026-11-18)** 에서 iOS 26.6~27.3 Beta 1 Safari·홈 화면 웹앱에서 `speechSynthesis.speak()` (`ko-KR` 시험 포함) / `<audio>` 재생이나 `stop()`/`abort()` 중단 뒤 다음 `webkitSpeechRecognition` 세션이 `onresult`/`onerror`/`onend` 없이 침묵하는 현상이 재현 중 [#35]. |

---

## 6. 한국어 숫자 표기 (한글 vs 아라비아 숫자, 띄어쓰기)

| 대상 범위 | 확인 결과 및 근거 | 성격 및 한계 |
|---|---|---|
| **브라우저 `SpeechRecognition` (`lang = 'ko-KR'`)** | **미확인 (`unconfirmed`)**: W3C 명세, MDN, Chromium/SODA, Microsoft Edge, Firefox(`models.yaml`/C++), Apple/WebKit 1차 문서 중 어디에서도 `"공 하나 둘 삼"` 또는 `"삼발"` 같은 한국어 구술 숫자의 한글/아라비아 숫자 출력 및 띄어쓰기 규격을 명시한 자료가 없음 [#36]. | 지침에 따라 직접 음성 테스트를 수행하지 않았음. 후속 프로토타입에서 실측 필요 [#36]. |
| **인접 벤더 클라우드 참고: Google Cloud STT** | `class-tokens` 문서에서 `ko-KR` `$OOV_CLASS_DIGIT_SEQUENCE`가 `"구 사 일 이"` -> `"9412"`로 변환되는 예시 제시 [#37]. | 유료 Google Cloud STT 기능 문서이며 Chrome 내장 SODA·무료 웹 엔드포인트의 동일 동작을 보장하지 않음 [#37]. |
| **인접 벤더 참고: Azure Speech & Apple Siri** | Azure `display-text-format`(`2026-01-30`)은 `ko-KR` ITN이 구술 숫자를 표시 숫자로 바꾼다고 설명하고 [#38], Apple ML ITN(`2017-08-02`)은 Siri의 숫자 FST 재작성을 설명함 [#38]. | Edge/Safari의 `SpeechRecognition` JS API에서 ITN 적용 여부·토글·띄어쓰기 규칙을 보장하는 웹 API 문서는 없음 [#38]. |

---

## 요약 (후속 티켓이 의존할 수 있는 사항)

1. **교차 브라우저 단일 경로 전제 불가**: 데스크톱 Chrome(`139+` 온디바이스 SODA, `142+` `phrases`), Edge(기본 클라우드, 온디바이스는 150+ Canary/Dev 플래그), Firefox `160`(로컬 전용 ~785 MB 모델, `phrases` 미작동), Safari/iOS(`webkitSpeechRecognition` 전용, `phrases`·`processLocally`·`SpeechGrammarList` 없음), Android Chrome(`processLocally`·`phrases`·`continuous` 없음)로 기능 편차가 매우 크다 [#4]–[#19], [#21]–[#27].
2. **문법 바이어싱 및 `confidence` 비의존**: `SpeechGrammarList`/JSGF는 명세상 폐기되었고, `phrases`는 Chrome 데스크톱 온디바이스 외에는 지원되지 않거나 미작동이며, SODA/Android 온디바이스는 `confidence = 1.0f`를 고정 반환하므로 후속 텍스트 매처는 비정규화 입력과 외부 후보 랭킹 부재를 가정해야 한다 [#21]–[#24], [#27].
3. **PTT 및 `음성 출력` 충돌 방어 필요**: Android Chrome의 `continuous = false` 강제, 데스크톱 Chromium의 0.5~1s 침묵 종료 및 15s 연속 침묵 타임아웃, `speechSynthesis` 동시 재생 시 음향 재수음 및 iOS 27 WebKit Bug 321436 먹통 회귀를 후속 PTT 상태기계·프로토타입 설계 시 고려해야 한다 [#25]–[#28], [#34]–[#35].
4. **ADR 0013 준수 여부**: API 자체는 개발자 키·계정·비용 없이 동작하므로 ADR 0013과 충돌하지 않으나, 기본 클라우드 모드는 브라우저 벤더 서버로 음성을 송신한다 [#14], [#17], [#19], [#20].

---

## 미확인 사항 (`unconfirmed`)

- **[#36] 브라우저 `SpeechRecognition` (`ko-KR`) 한국어 숫자·띄어쓰기 출력 형식**: `"공 하나 둘 삼"`이나 `"삼발"`이 한글(`공 하나 둘 삼` / `삼발`) vs 숫자(`0123` / `3발`)·공백 유무 중 무엇으로 전사되는지에 대한 1차 브라우저 문서 없음(검색: W3C Web Speech API 명세, MDN, Chromium `speech/`·`soda/`, Edge 문서, Firefox `models.yaml`·C++, WebKit/Apple 문서). 인접 Cloud STT / Azure ITN / Apple ITN 문서는 별도 맥락으로만 구분 제시함 [#36]–[#38].
- **[#12] Safari / iOS Safari `webkitSpeechRecognition`의 공식 `ko-KR` 지원 태그 목록**: Siri 기반 50+ 언어 및 OS 한국어 받아쓰기는 문서화되어 있으나 Web Speech API용 BCP-47 목록표는 미확인(검색: `webkit.org`, `developer.apple.com` Safari 문서, WebKit `SpeechRecognition` 소스).
- **[#13] Microsoft Edge 모바일(Android/iOS) Web Speech 상세 지원**: `SpeechRecognitionEnabled` 정책은 모바일 미지원(`Not supported`)이나, Edge 모바일 자체 지원 범위 1차 표는 미확인(검색: Microsoft Learn Edge web-platform·정책 문서).
- **[#29] 데스크톱 Chrome·Edge·Firefox·Safari 단일 세션 절대 최대 길이 상한**: Chromium `15s` 침묵 타임아웃과 Android `5분` Intent 최소 길이 외에 서버/엔진별 최대 세션 시간(분/초)은 1차 문서·클라이언트 코드에 미기재(검색: 명세, MDN, Chromium·Firefox·WebKit C++ 소스).
- **[#30] 발화 종료 후 최종 결과 반환 지연(ms SLA)**: 엔드포인터 침묵 대기(0.5~1s) 및 Firefox 20ms 폴링 외에 네트워크/모델 최종 확정 지연 수치는 미확인(검색: 명세, MDN, 각 벤더 문서·소스).
