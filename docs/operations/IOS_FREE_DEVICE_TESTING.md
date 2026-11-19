# Windows에서 iPhone 무료 테스트하기

[후속 Issue #37](https://github.com/HyunKN/visual-travel-guide/issues/37)의 개인 테스트 절차다. GitHub Actions에서 아이폰 실기기용 IPA를 만들고 Windows에서 무료 Apple 계정으로 서명한다. 이 작업은 Sprint 1 범위 밖이다.

## 1. GitHub Actions에서 IPA 받기

1. 워크플로가 기본 브랜치에 등록되면 [Actions](https://github.com/HyunKN/visual-travel-guide/actions) → **Build unsigned iPhone IPA** → **Run workflow**에서 검사할 브랜치를 고른다. GitHub에서 수동 실행하려면 저장소 쓰기 권한이 필요하다. [수동 실행 안내](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)
2. 표준 `macos-26` runner가 Expo SDK 57의 iOS 프로젝트를 생성하고, 실기기용 arm64 Release 앱을 서명 없이 빌드한다. 이 SDK는 iOS 16.4 이상과 Xcode 26.4 이상을 요구한다. 공개 저장소의 표준 runner는 무료다. [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/) · [GitHub runner 조건](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
3. 실행 요약에서 커밋·앱 ID·최소 iOS·SHA-256을 확인한다. 성공한 실행의 **Artifacts**에서 `nubi-iphone-unsigned-<커밋 SHA>`를 받아 압축을 풀면 `Nubi-unsigned.ipa`가 생긴다. 산출물은 7일 동안 보관된다. 이 IPA는 서명 후 기기에 설치할 수 있다.

### 로그인도 확인할 때

GitHub 저장소 **Settings → Secrets and variables → Actions**에서 **Variables**에 `EXPO_PUBLIC_SUPABASE_URL`을, **Secrets**에 `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 설정한다. 둘 다 없으면 탐색·카메라·지도를 먼저 확인할 수 있고, 로그인·개인 메모 검사는 건너뛴다. 키는 CI 로그에서 가려지며 빌드된 IPA에는 공개 클라이언트용 publishable key가 포함된다. Apple 계정은 Windows 설치 도구에서 입력한다.

기존 Google·네이버 연결과 `visual-travel-guide://auth/callback` 허용 목록을 재사용한다. 기존 `visual-travel-guide://auth/callback**` 항목은 이 경로를 포함한다. 실행 요약의 설정 상태가 `enabled`여도 브라우저 복귀와 세션 확정은 아이폰에서 확인한다. [Supabase redirect URL](https://supabase.com/docs/guides/auth/redirect-urls)

## 2. Windows에서 서명하고 iPhone에 설치하기

1. Windows에 Sideloadly와 공식 안내에 나오는 Apple 웹 배포판 iTunes·iCloud를 준비한다. iPhone을 USB로 연결하고 잠금 해제 후 컴퓨터를 신뢰한다. [Sideloadly 설치](https://sideloadly.io/) · [기기 인식 FAQ](https://sideloadly.io/faq)
2. Sideloadly의 기기 목록에서 본인 iPhone을 고른다. `Nubi-unsigned.ipa`와 본인의 무료 Apple 계정으로 설치를 시작하고 계정 확인은 로컬에서 진행한다.
3. 기기에서 요청하는 경우 **설정 → 일반 → VPN 및 기기 관리**에서 개발자 앱을 신뢰한다. **설정 → 개인정보 보호 및 보안 → 개발자 모드**를 켜고 재시동 후 기기에서 확인한다. 홈 화면에서 앱을 연다. [Apple 개발자 모드 안내](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device)

## 3. 실기기 확인과 갱신

같은 IPA의 실행 링크, 기기 모델, iOS 버전과 결과를 [#37](https://github.com/HyunKN/visual-travel-guide/issues/37)에 남긴다.

| 확인할 흐름 | 기기에서 볼 결과 |
| --- | --- |
| 첫 실행과 장소 설명 | 홈이 열리고 건물 선택에서 설명으로 이동한다. 한글과 굵은 제목을 확인한다. |
| 촬영·갤러리 | 권한을 허용해 각각 사진을 선택할 수 있다. 권한 거절과 닫기 뒤 화면으로 복귀할 수 있다. |
| 지도·GPS | 지도가 표시되고 앱 사용 중 위치 권한으로 현재 위치를 확인한다. 권한 거절이나 지도 로드 실패 때도 장소 목록을 사용할 수 있다. |
| 로그인·기기 저장 | 로그인 설정이 포함된 빌드에서 Google·네이버 인증 후 앱으로 복귀한다. 개인 메모를 저장하고 재실행해 다시 읽는다. |
| 업데이트·갱신 | 메모를 하나 저장한 뒤 앱 삭제 없이 같은 Apple 계정과 서명 시 적용된 같은 Bundle ID로 덮어쓴다. 갱신 후 저장한 메모를 다시 읽는다. |

무료 계정의 프로비저닝은 7일간 유효하며 기기당 최대 3개 앱을 설치할 수 있다. 만료 전에 같은 계정과 Bundle ID로 다시 사이드로드하거나 Sideloadly의 자동 갱신을 사용한다. 첫 서명에서 Bundle ID가 바뀌었다면 이후에도 동일한 값을 사용한다. [Apple Personal Team 제한](https://developer.apple.com/help/account/basics/about-your-developer-account/) · [Sideloadly 갱신 FAQ](https://sideloadly.io/faq)

iOS에서는 기존 PhotoGlass 대체 화면을 사용한다. 사진 선택 이후 장소 안내의 iOS 실기기 동작은 이 절차에서 확인한다. 실제 모델 추론의 iOS 연결은 [#30](https://github.com/HyunKN/visual-travel-guide/issues/30)과 이어지는 후속 범위다.
