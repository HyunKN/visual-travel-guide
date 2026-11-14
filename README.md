# 누비 Nubi · Visual Travel Guide

눈앞의 장소를 알아보고 이야기를 읽으며, 같은 장소에 누군가 남긴 흔적을 발견하는 현장 가이드입니다. 첫 적용 장소는 경복궁의 **근정전·교태전·광화문**입니다.

**현재 단계 — Android 앱 개발 및 기능별 검증 진행 중** · 2026-11-14 기준

장소 선택·설명·사진 입력·지도·로그인·쪽지 저장과 공개 공유를 구현했습니다. 사용자 Android 에뮬레이터와 실제 Supabase 개발 서비스에서 확인한 결과를 기능별로 기록하고 있습니다. **사진 인식 모델의 실제 Android 연결, 최종 UI, 실기기 통합·성능·사용자 관찰은 남아 있습니다.**

[앱 실행 안내](mobile/README.md) · [App 기능 지도](https://github.com/HyunKN/visual-travel-guide/issues/27) · [개발 문서](docs/README.md) · [Wiki](https://github.com/HyunKN/visual-travel-guide/wiki/Development-Home)

## 앱에서 할 수 있는 일

| 기능 | 현재 동작과 확인 범위 |
| --- | --- |
| 장소 찾기·이야기 | 등록된 세 장소의 카드·이름 필터로 선택하고 출처 있는 설명을 읽습니다. 직접 선택과 설명 이동은 사용자 에뮬레이터에서 확인했습니다. |
| 사진으로 찾기 | 촬영·갤러리 선택·선택 해제·권한 안내를 제공합니다. 현재 앱에는 인식 runtime이 연결되지 않아 모델 미탑재를 안내하고 직접 선택으로 이어집니다. |
| 주변 장소 | MapLibre·OpenFreeMap 지도, 현재 위치 조회, 측정 시각/오차, 거리순 지원 장소 목록과 확대·축소를 제공합니다. 에뮬레이터 가상 위치·권한/지도 실패 복구를 확인했으며 실기기 현장 GPS 정확도는 미검증입니다. |
| 남긴 흔적 | 공통 장소 사진을 확대·이동하며 사진 위 표식을 눌러 글을 읽습니다. 홈에는 공개 글 미리보기를 표시합니다. 읽기·닫기·사진 유지와 긴 글 스크롤을 확인했고 일부 배치·큰 글자 검수는 남아 있습니다. |
| 나도 한 줄 남기기 | 사진에서 위치를 고르고 자유 텍스트를 씁니다. 최대 100자, 초안 보관, 수정 취소, ‘공개 / 나만 보기’ 선택을 제공합니다. ‘한 줄’은 참여 문구이며 줄바꿈을 제한하지 않습니다. |
| 내 글·공유 | 계정별 기기 글을 관리하고, 명시적으로 공개한 글을 다른 로그인 사용자가 읽습니다. Google·네이버 로그인, A/B 공유·신고·숨김/복원·초안 계정 분리를 확인했습니다. |
| 홈 복귀 | 설명·지도·사진의 상단 집 버튼으로 홈에 돌아갑니다. 작성 중 이동은 초안을 보호합니다. 자동 검사 완료, 해당 새 이동의 실제 기기 확인은 일부 남아 있습니다. |

가이드는 로그인 없이 이용합니다. 홈의 공개 글 미리보기를 넘어 메모를 읽거나 쓰는 진입과 ‘내 글’에는 **Google 또는 네이버 로그인**이 필요합니다. 로그인이나 공개 범위 선택만으로 글을 전송하지 않으며, 공개 범위의 기본 선택은 없습니다.

‘추천 이야기’는 검수된 장소 콘텐츠를 순환해 보여줍니다. 개인화 추천이나 쪽지 추천수 집계는 구현 범위에 포함하지 않습니다.

## 이용 흐름

```text
홈 → 장소 직접 선택 / 주변 지도 → 장소 이야기·출처
                                  → 공통 장소 사진
                                     ├─ 남긴 흔적 읽기
                                     └─ 나도 한 줄 남기기 → 기기 저장 / 명시적 공개

사진으로 찾기 → 촬영 / 갤러리 선택
               → 현재: 모델 미탑재 안내 → 장소 직접 선택
               → 후속: 실제 모델 연결·결과 검증 (#30)
```

사용자가 촬영한 사진은 장소를 찾는 임시 입력입니다. 쪽지는 **모두가 보는 불변 공통 사진과 정규화된 위치 좌표**에 연결합니다. 다른 사용자의 촬영 사진끼리 좌표를 추정·보정하지 않습니다. 선택 이유는 [설계 결정 ADR 0001](docs/adr/0001-shared-place-photo-anchors.md)에 있습니다.

## Android 개발 앱 실행

현재 앱은 Metro가 필요한 **Expo Development Build**입니다. 기존 개발 APK를 설치하고 Android SDK의 `adb`를 사용할 수 있는 환경에서, 에뮬레이터나 USB 디버깅 기기를 먼저 켭니다.

저장소 루트의 PowerShell에서:

```powershell
cd mobile
adb devices
adb reverse tcp:8083 tcp:8083
node --dns-result-order=ipv4first node_modules/expo/bin/cli start --dev-client --localhost --port 8083
```

- `adb devices`에 대상이 `device` 상태로 나타나야 합니다. `adb` 경로 설정과 기존 APK 설치는 [모바일 실행 안내](mobile/README.md#설치와-실행)를 따릅니다.
- Metro를 실행한 터미널은 켜두고, 앱에서 `http://127.0.0.1:8083` 개발 서버를 선택합니다. 같은 프로젝트의 8083 서버가 이미 실행 중이면 새로 시작하지 않습니다.
- 새 checkout에서 의존성이 없을 때만 `mobile/`에서 `npm ci`를 먼저 실행합니다. 네이티브 모듈을 변경하면 개발 APK 재빌드가 필요합니다. 이번 문구 변경만으로 재설치할 필요는 없습니다.
- 공유 서비스 설정은 [Supabase 안내](supabase/README.md)를 따릅니다. 비밀 키를 앱이나 저장소에 넣지 않습니다.

현재 기록한 APK는 에뮬레이터용 x86_64 개발 빌드입니다. 일반 배포용 Android 앱·iPhone 설치 지원을 완료한 상태는 아닙니다. Windows에서 무료로 iPhone을 시험하는 경로는 [후속 보류 문서](docs/operations/IOS_FREE_DEVICE_TESTING.md)에 정리했습니다.

## 코드와 데이터 구조

| 영역 | 현재 구성 |
| --- | --- |
| 앱 | React Native 0.86.3 · React 19.2.3 · TypeScript 6.0.3 · Expo SDK 57 · Expo Router |
| 장소 콘텐츠 | 앱에 포함한 검수 JSON·공통 장소 사진·설명 출처 |
| 기기 기록 | 프로젝트/사용자별 SQLite, 인증 세션은 SecureStore |
| 공개 공유 | Supabase Auth·Postgres·인증된 RPC, 공개 사본·신고·관리 상태 |
| 지도 | MapLibre React Native · OpenFreeMap 스타일/타일. 지도는 네트워크와 캐시를 사용하며 GPS 조회와 별개입니다. |
| 모델 | MobileCLIP2-S3·ONNX Runtime을 선정한 계획에 따라 모델/자료 작업을 분리합니다. 실제 앱의 `nativeRecognition.runtime`은 아직 `null`이며 Android 디코딩·전처리·추론 연결이 남아 있습니다. |

```text
mobile/       Android 제품 앱·기능별 코드·검사·실행 안내
supabase/     공개 글·권한·신고·관리 상태의 SQL 마이그레이션과 검사
docs/         제품·설계·개발 규칙·Sprint·결정·관찰 기록의 원본
prototype/    앞선 HTML/CSS/JavaScript 시나리오 프로토타입
experiments/  모델·인식 기술 실험
scripts/      Android 도구 설정·문서 검사·Wiki 게시 도구
```

이전 [웹 프로토타입](prototype/README.md)은 준비된 사진·선택 흐름과 사용자 관찰 기록입니다. Android 앱의 실제 촬영·GPS·로그인·기기 저장·공개 공유 결과와 구분합니다. 새로운 촬영 사진의 자동 인식이나 임의 문양/부위 식별을 제공하는 제품으로 설명하지 않습니다.

## 남은 개발과 검증

진행의 원본은 [App 기능 지도 #27](https://github.com/HyunKN/visual-travel-guide/issues/27)입니다. 이 README에 별도의 완료율을 복제하지 않습니다.

1. **[모델 연결 #30](https://github.com/HyunKN/visual-travel-guide/issues/30):** 모델·라벨·전처리 규격·참조 출력을 인계받고 실제 Android runtime을 구현·검증합니다. 촬영과 모델 미탑재 안내의 성공은 추론 성공과 다릅니다.
2. **[읽기 #32](https://github.com/HyunKN/visual-travel-guide/issues/32)·[최종 UI #36](https://github.com/HyunKN/visual-travel-guide/issues/36):** 남아 있는 배치·큰 글자·새 홈 복귀 확인과 최종 디자인을 구분해 관리합니다.
3. **[통합 #35](https://github.com/HyunKN/visual-travel-guide/issues/35):** 실제 모델을 포함한 전체 흐름, 실기기 지연/메모리, 사용자 비교 관찰과 Sprint 인수를 확인합니다.

전체 이름 검색·구역 탐색·후보 상세 비교는 Sprint 2, 세부 요소 탐색은 후순위입니다. LLM/RAG 자유 질문, AR, 정교한 궁궐 3D 복원, 완전한 오프라인 지도, 전국 지원을 현재 기능으로 약속하지 않습니다.

## 검증 기록과 문서

설계·코드 구현·자동 검사·사용자 에뮬레이터 확인·실기기 검증을 구분합니다. 현재 인식 정확도나 기존 검색 대비 개선 효과를 달성했다고 보고하지 않습니다. 앱 테스트는 [핵심 기능 변경 시 영향 범위만 검사하는 규칙](docs/DEVELOPMENT.md#핵심-기능-변경-시에만-재검사)을 따르고 이미 통과한 사용자 검사는 반복 요청하지 않습니다.

| 문서 | 내용 |
| --- | --- |
| [개발 문서 안내서](docs/README.md) | 문서 역할과 읽는 순서 |
| [모바일 README](mobile/README.md) | 도구 준비·앱 실행·빌드·기능별 검사 |
| [Android 검증 기록](mobile/VERIFICATION.md) · [읽기용 보고서](docs/operations/ANDROID_VERIFICATION.html) | 실행 조건·실제 결과·미확인 항목 |
| [제품 목표](docs/PRODUCT.md) · [상세 명세](docs/design/APP_SPRINT1_SPEC.md) | 사용자 가치·채택한 행동·데이터/예외 계약 |
| [기능 경계](docs/design/APP_FEATURE_BOUNDARIES.md) · [아키텍처](docs/ARCHITECTURE.md) | 모듈 책임·입출력·구조 결정 |
| [개발 흐름](docs/DEVELOPMENT.md) · [완료 기준](docs/QUALITY.md) | AI 협업·검사·인수 규칙 |
| [Sprint Planning](docs/sprints/SPRINT1_PLANNING.md) · [Sprint Backlog](docs/sprints/SPRINT1_BACKLOG.md) | 수업 제출 계획과 완료 조건 |
| [개발 Wiki](https://github.com/HyunKN/visual-travel-guide/wiki/Development-Home) | main에 병합된 개발 문서의 게시본 |

공개 저장소에는 개인정보·인증 비밀·참여자 원문·원본 이동 기록을 올리지 않습니다. 사진·해설·모델·서체 등 외부 자료는 출처와 이용 조건을 확인하고, 내부 수집 자료와 공개 가능한 결과를 분리합니다.
