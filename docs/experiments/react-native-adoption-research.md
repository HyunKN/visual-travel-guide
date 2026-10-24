# React Native 구성 선택 조사

조사일: 2026-10-24. 상태: **조사 완료, 후속 대화에서 시작 구성 채택**. Android 앱 빌드·호환성·성능은 이 저장소에서 검증하지 않았다.

후속 결정: 사용자가 온디바이스 AI와 연동 라이브러리의 차이를 확인한 뒤 TypeScript + React Native + Expo로 먼저 진행하는 데 동의했다. Expo Development Build에서 작은 모델 연결 실험을 시작하는 범위다. 특정 모델·추론 런타임·호환 버전·성능까지 확정한 것은 아니다. 현재 결정 원본은 [ARCHITECTURE](../ARCHITECTURE.md)이며 아래 사례·제안은 선택 당시의 근거로 보존한다.

목적은 TypeScript, React Native, Expo를 한 묶음으로 자동 채택하는 것이 아니라, Android 우선·1인 개발·사진 입력·기기 내 인식에 필요한 구성과 유지 비용을 나누어 판단하는 것이다. 기존 웹 프로토타입은 Vanilla JavaScript + Vite이며 React 화면 코드가 아니다. 상위 구조와 현재 미정 항목은 [ARCHITECTURE](../ARCHITECTURE.md)를 따른다.

## 확인 방법과 근거의 강도

- 공식 문서, GitHub 소스, Issue·PR 본문 및 상태를 읽었다. Microsoft ONNX Runtime 소스는 조사일 이전 커밋 `174470241c9c62da79f34c80ab56826c0844ae7f`로 고정했다(2026-10-08).
- Issue·PR 작성자의 재현·수정 보고는 **당사자 보고**다. 이 프로젝트에서 재현한 결과가 아니다.
- `main`의 버전 숫자와 수정 코드는 npm 배포 완료를 뜻하지 않는다. npm 배포물까지 내려받아 대조하지 않았으므로 추천할 확정 버전 조합을 제시하지 않는다.
- Closed는 수정 완료와 동의어가 아니다. 병합 여부·종료 댓글을 구분했다. 현재 상태는 이후 바뀔 수 있다.

## 온디바이스 추론 연결에서 확인한 사실

### 1. 공식 패키지는 있으나 최신 Expo 호환 보증은 아니다

Microsoft의 `onnxruntime-react-native`는 Android·iOS에서 ONNX 모델을 실행하는 패키지다. 고정 소스의 README에는 React Native autolinking과 Expo config plugin + prebuild 경로가 명시되어 있다. 따라서 Expo라서 원천적으로 불가능하다는 판단은 틀리다. 반대로 그 설치 문서만으로 최신 Expo·RN 조합이 정상 작동한다고 판단할 수도 없다. [고정 README](https://github.com/microsoft/onnxruntime/blob/174470241c9c62da79f34c80ab56826c0844ae7f/js/react_native/README.md)

| 근거 | 날짜·조합·확인 상태 | 우리 판단에 미치는 영향 |
| --- | --- | --- |
| [PR #28266](https://github.com/microsoft/onnxruntime/pull/28266) | 2026-04-30 **병합됨**. RN autolinking 설정과 Expo MainApplication 등록 패치 추가 | 유지·수정 활동은 실제로 있다. 패키지가 방치되었다고 단정하면 안 된다 |
| [PR #28658](https://github.com/microsoft/onnxruntime/pull/28658) | 2026-05-25 생성, 조사 시 **Open / 미병합**. Expo 55 이후 MainApplication 구조에 맞춘 plugin 수정 제안 | Expo 설정 파일을 자동 변경하는 경로도 SDK 변화에 영향을 받는다 |
| [PR #29005](https://github.com/microsoft/onnxruntime/pull/29005) | 2026-06-11 생성, **Open / 미병합**. 작성자는 Expo 56 + RN 0.85 + ORT RN 1.24.3 Android에서 `unimodule.json` 제거 전후를 비교해 등록·추론 성공을 보고 | 실제 작동 사례가 있지만 패치 의존 사례다. 공식 배포 조합의 무수정 성공으로 소개하면 안 된다 |
| [PR #33081](https://github.com/microsoft/onnxruntime/pull/33081) | 2026-10-03 생성, **Open / 미병합**. 작성자는 RN 0.86 Bridgeless에서 `install()` 실패 및 수정 후 추론 성공을 보고 | Expo를 빼더라도 RN New Architecture와 ORT 네이티브 초기화 문제는 남을 수 있다 |
| [Issue #32744](https://github.com/microsoft/onnxruntime/issues/32744) | 2026-09-22 생성, **Open**. ORT RN 1.24.3 앱에 Android 네이티브 ORT 1.30.0이 들어간 사례 보고 | npm 버전만 고정해도 네이티브 엔진이 고정된다고 생각하면 안 된다 |
| [Issue #27062](https://github.com/microsoft/onnxruntime/issues/27062) | 2026-01-19 생성. Expo 54 + ORT RN 1.23.2 + iOS 16.7.12 모델 로드 실패. 2026-03-21 **비활동 bot 종료**, 수정 증거 없음. 작성자는 동일 모델 Android 성공 보고 | iOS 확대 시 모델 경로·번들 검증 필요. Android 우선 선택을 직접 차단하는 근거로 쓰지 않는다 |

직접 소스에서도 두 위험을 확인했다. Android Gradle 의존성에 `latest.integration`이 있고, 초기화 코드는 `getCatalystInstance().getJSCallInvokerHolder()`를 사용한다. 이는 위 보고의 코드 근거를 확인한 것이며 우리 앱의 장애 재현은 아니다. [Gradle](https://github.com/microsoft/onnxruntime/blob/174470241c9c62da79f34c80ab56826c0844ae7f/js/react_native/android/build.gradle) · [초기화 코드](https://github.com/microsoft/onnxruntime/blob/174470241c9c62da79f34c80ab56826c0844ae7f/js/react_native/android/src/main/java/ai/onnxruntime/reactnative/OnnxruntimeModule.java)

### 2. New Architecture는 피해 갈 기본 선택지가 아니다

Expo 공식 문서는 SDK 55부터 New Architecture를 끌 수 없고, RN 0.82부터 해당 구조만 지원한다고 설명한다. 따라서 오래된 답변의 `newArchEnabled: false`를 최신 구성의 해결책으로 복사하면 안 된다. Expo Doctor의 라이브러리 검사는 초기 확인 수단이며 실기기 실행 증거를 대신하지 않는다. [Expo 공식 안내](https://docs.expo.dev/guides/new-architecture/)

현재 ORT RN 소스의 개발 의존성은 RN `^0.73.11`, peer 범위는 `*`다. 이것을 최신 RN 전체 호환이라는 뜻으로 읽으면 안 되고, 개발 의존성이 오래되었다는 이유만으로 실제 모든 앱이 실패한다고 단정해서도 안 된다. 최신 조합의 배포물과 기기 실행을 따로 확인해야 한다. [고정 package.json](https://github.com/microsoft/onnxruntime/blob/174470241c9c62da79f34c80ab56826c0844ae7f/js/react_native/package.json)

### 3. LiteRT/TFLite 경로도 존재하지만 자동 대체재는 아니다

Margelo의 `react-native-fast-tflite`는 Nitro Modules를 사용하고 입력·출력 버퍼를 앱에서 해석하도록 한다. 유지자가 제공한 최신 릴리스 페이지에서 v3.0.1(2026-04-21)의 Android GPU delegate 반환 수정도 확인했다. 이는 RN에서 다른 추론 엔진을 연결할 경로가 있다는 증거다. 우리 ONNX 모델의 무손실 변환, 정확도, 호환성, 성능이 확인되었다는 뜻은 아니다. 엔진 교체는 별도 실험으로 다룬다. [고정 README](https://github.com/margelo/react-native-fast-tflite/blob/feeb7677e0e9464fc4ec00c6687139fd2a606667/README.md) · [v3.0.1](https://github.com/margelo/react-native-fast-tflite/releases/tag/v3.0.1)

## 구성 선택에 반영할 기준

1. **TypeScript 채택과 Expo 채택을 별도 결정한다.** 자료형·상태 오류 방지는 TypeScript의 역할이고, 네이티브 연결·빌드 구성은 Expo/RN 쪽 문제다.
2. **Expo 없는 RN도 비교 대상으로 남긴다.** Expo plugin 문제를 줄일 수 있지만 Gradle·네이티브 프로젝트 관리가 사라지지 않으며, RN/ORT 초기화 문제는 공유할 수 있다.
3. **Expo를 시험한다면 Development Build로 시작한다.** Expo Go에서 홈 화면이 보이는 것은 우리 모델 연결의 검증이 아니다. [개발 빌드 안내](https://docs.expo.dev/develop/development-builds/introduction/)
4. **추론 패키지 존재와 실기기 성공을 구분한다.** 모델 로드·동일 사진 전처리·추론 결과·재입력·백그라운드 복귀를 확인해야 한다.
5. **선정 전에 버전 조합과 패치 비용을 기록한다.** Expo SDK/RN/JS 패키지/실제 네이티브 ORT/Android ABI/기기를 함께 기록한다. `package-lock`만으로 재현성을 주장하지 않는다.
6. **중단 조건을 정한다.** 출처·목적·되돌리는 방법을 설명할 수 없는 패치를 여러 개 겹쳐야 하거나, 실제 네이티브 의존성 버전을 고정하지 못하거나, 재시도·복귀에서 추론이 깨지면 해당 조합을 승인하지 않는다. 전체 RN 채택 실패와 특정 런타임 연결 실패를 구분한다.

## 실제 앱 개발팀·개인 개발자의 사례

조사일: 2026-10-24. 다음은 개발 당사자의 공개 설명 또는 실제 저장소다. 자기 보고를 독립 성능 측정으로 취급하지 않는다. 공급사 권고, 기업 사례, 개인 사례, GitHub 장애 보고는 서로 다른 종류의 근거다.

| 사례·시점 | 확인한 내용 | 우리에게 적용할 해석과 한계 |
| --- | --- | --- |
| Vercel v0 iOS · 2025-11-24 | 여러 구현을 검토한 뒤 React Native + Expo를 선택. 사진 붙여넣기에서 Expo Module과 Swift 구현도 사용했다. [개발팀 원문](https://vercel.com/blog/how-we-built-the-v0-ios-app) | 세밀한 모바일 UI가 가능하다는 실제 사례. Expo만으로 모든 기능이 끝난다는 근거는 아니다. iOS 사례이며 Android 온디바이스 인식 성공 사례가 아니다. |
| Shopify · 2026-09-10 | 과거 React Native 공유 코드의 이득을 인정하면서 Swift·Kotlin으로 전환한다고 발표. AI 도구로 두 플랫폼 구현 비용이 달라졌다는 자사 판단과 프레임워크·의존성 관리 비용을 설명했다. [개발팀 원문](https://shopify.engineering/back-to-native) | 이전의 RN 도입 사례만 인용하면 현재 방향을 잘못 전달한다. 대규모 팀의 전환 경험이므로 1인 개발에서도 네이티브가 더 싸다는 증거는 아니다. 전환 발표와 모든 앱 전환 완료를 구분한다. |
| Waywise · 게시일 미표기, 조사일 열람 | 1인 개발자가 여행 가이드 앱에 RN + Expo를 사용하고 가이드를 로컬에 저장한다고 설명. 개발·반복에 약 1년이 걸렸다는 자기 보고와 App Store 연결이 있다. [개발자 사례](https://max.shearer.co/work/waywise), [앱 등록](https://apps.apple.com/gb/app/travel-guidebooks-waywise/id6476279831) | 여행·1인·오프라인 콘텐츠라는 조건은 유사하다. AI 가이드 생성은 백엔드에서 수행하므로 우리 기기 내 이미지 인식의 검증 근거가 아니다. 최신 2026 신규 도입 사례로 표시하지 않는다. |
| Bluesky · 조사일 main | package.json에서 Expo, expo-dev-client와 자체 Expo 모듈 의존성을 확인했다. [실제 구성](https://github.com/bluesky-social/social-app/blob/main/package.json) | Expo 기반 제품에서도 자체 네이티브 모듈이 필요할 수 있다. main은 변하는 참조이며 이 파일의 버전들을 우리에게 그대로 채택하지 않는다. |

## 최신 흐름을 해석하는 기준

- React Native 팀은 2024-06-25부터 새 앱에 Expo 같은 프레임워크를 권장했다. 이것은 현재 출발점의 근거이지 시장 점유율이나 모든 프로젝트의 우월성 증거가 아니다. [공식 권고](https://reactnative.dev/blog/2024/06/25/use-a-framework-to-build-react-native-apps)
- 현재 공식 안내는 새 RN 프로젝트에서 TypeScript를 기본으로 쓰되 JavaScript도 지원한다고 설명한다. 우리에게는 건물 ID·후보·취소·오류 상태의 계약을 검사할 수 있다는 장점이 있다. 타입 검사는 런타임 입력 검증이나 모델 정확도를 보장하지 않는다. [TypeScript 안내](https://reactnative.dev/docs/typescript)
- Expo 도입과 EAS 클라우드 서비스 도입은 별개다. 로컬 Android 빌드 경로가 있으며, 네이티브 라이브러리 변경 시에는 개발 앱을 다시 빌드해야 한다. [로컬 빌드](https://docs.expo.dev/guides/local-app-overview/), [개발 빌드 사용](https://docs.expo.dev/develop/development-builds/use-development-builds/)
- 사용자 투표·다운로드 수·성공 사례만으로 순위를 매기지 않았다. 2025년의 마이그레이션 성공을 2026년의 유지 방침으로 확대하지 않으며, 열린 PR도 모든 배포 버전의 실패로 확대하지 않는다.

## 조사 당시의 제안 — 후속 채택 범위는 문서 상단 참조

조사 당시 사용자 결정은 Android 설치형·기기 내 추론 우선, Flutter 제외, React 계열 우선 검토였다. 당시에는 TypeScript·Expo·모델 런타임·버전 묶음을 아직 선택하지 않은 상태에서 아래 제안을 작성했다.

| 결정 | 제안 | 추천을 바꿀 조건 |
| --- | --- | --- |
| TypeScript / JavaScript | RN을 택한다면 TypeScript 권장. 모델 출력·콘텐츠 연결·상태 전환의 명시적 계약에 사용하고 복잡한 타입 기법을 도입하지 않음 | 기존 팀의 JS 전용 코드·도구 제약이 있으면 이행 비용을 다시 비교. 현재는 개인 숙련도 우열 미확인 |
| Expo 사용 / 미사용 | Expo Development Build를 첫 호환성 실험 후보로 두되, 제품 전체를 아직 생성하지 않음 | Expo 설정 자동화만 문제라면 설정·플러그인 수정과 Expo 없이 native 프로젝트 직접 관리하는 비용 비교 |
| RN 추론 연결 | 기존 ONNX 산출물로 적재·전처리·추론부터 확인. ONNX 패키지 공식 제공만으로 안정 판정하지 않음 | RN 공통 초기화 문제면 Expo 제거가 해결책이 아님. 유지 가능한 네이티브 연결부 또는 다른 런타임 경로 검토 |
| 부가 도구 | 탐색·사진·필수 상태 외에는 필요가 생길 때 추가 | UI 라이브러리·전역 상태·클라우드·DB·분석 도구를 트렌드만으로 일괄 채택하지 않음 |

이 조합을 추천하는 이유는 사용자가 예시로 제시했기 때문이 아니라, React 우선이라는 선택 안에서 공통 모바일 기능 설정을 줄일 가능성 때문이다. 반대로 핵심인 모델 연결에 지속적인 포크·수동 패치가 필요하면 그 이점이 사라질 수 있다. 현재는 가능성과 위험을 조사했으며 우리 환경에서의 개발 속도·성능 우위는 입증하지 않았다.

## 다음 검증의 범위와 중단 조건

이 절은 실행 계획이며 이번 조사에서 실행한 결과가 아니다.

1. Android 실기기와 OS를 정하고 Expo SDK/RN/추론 패키지/실제 Android 런타임의 버전·모델 해시를 고정한다. 가장 최신인 조합보다 재현 가능한 조합을 찾는다.
2. 정상 JPEG 사진 1장 → PC와 같은 전처리 → 같은 모델 적재·추론 → 후보 데이터 표시를 연결한다. 한 장은 연결 검증일 뿐 정확도 평가가 아니다.
3. 취소·재선택·연속 입력에서 이전 결과가 덮어쓰지 않는지, 오류 후 다시 입력할 수 있는지 확인한다. 화면 전환과 권한 거부도 확인한다.
4. 첫 적재·추론 시간, 메모리, 빌드 산출물 크기, UI 응답을 실제 기기에서 기록한다. 성능 통과 숫자는 목표 기기와 사용 조건에 맞춰 실행 전에 합의한다.
5. 의존성을 고정한 깨끗한 재빌드가 가능한지 확인한다. 미병합 패치를 꼭 써야 하면 범위·소유·재검증 부담을 기록한다.
6. Expo 설정 문제 / RN 바인딩 문제 / 모델 연산·전처리 문제를 분리한다. 해결되지 않은 원인과 유지 비용이 크면 그 조합의 제품 도입은 보류하고 작은 대안 검증으로 전환한다. 라이브러리 복구를 이유로 제품 전체를 먼저 만들지 않는다.

사용자 가치 측면에서 이 작업은 사진 탐색 기능의 구현 위험을 줄이는 지원 조사다. 첫 방문 도움 이해, 기존 검색·무료 AI 대비 이용 편의, 실제 현장 유용성은 별도 미검증이며 프레임워크 채택으로 달성했다고 기록하지 않는다.

## 이 기록의 완료 범위

외부 소스와 공개 이슈 상태 조사 및 후속 시작 구성 결정 기록을 수행했다. 패키지 설치, 앱 생성, 모델 변환, Android 빌드, 실기기 재현, 성능 측정은 수행하지 않았다. 이 문서는 제품 개발 완료나 사용 가치 검증을 뜻하지 않는다.
