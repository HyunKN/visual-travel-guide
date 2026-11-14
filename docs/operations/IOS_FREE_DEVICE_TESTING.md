# Windows에서 iPhone 무료 테스트하기

결정일: 2026-11-14. 사용자는 Mac과 유료 Apple Developer 계정이 없으며, 무료 경로를 기록하고 나중에 진행하기로 했다. 구현·인수 진행의 원본은 [후속 Issue #37](https://github.com/HyunKN/visual-travel-guide/issues/37)이다. 현재 Android 작업과 Sprint 1의 완료 기준을 늘리는 결정은 아니다.

## 검토한 경로

1. GitHub Actions의 표준 macOS runner에서 Expo iOS 프로젝트를 생성하고 **아이폰 실기기용 arm64 앱**을 서명 없이 빌드한다.
2. `.app`을 `Payload/앱이름.app` 구조의 unsigned `.ipa`로 묶어 Actions 산출물로 내려받는다. Simulator용 산출물은 실제 아이폰에 설치할 수 없으므로 구분한다.
3. Windows의 **Sideloadly + 무료 Apple 계정**으로 로컬 서명 후 본인 iPhone에 설치한다. AltStore Classic + AltServer는 대안이다.
4. 7일 인증 만료 전에 같은 앱 ID·계정으로 갱신하고, 업데이트·갱신 뒤 기기 데이터 유지를 확인한다.

이 경로의 일반적인 지원과 다른 Expo 프로젝트 사례를 조사한 것이며 **누비의 빌드·설치 성공은 아직 검증하지 않았다.** iOS 대응과 실제 기기 검사가 필요하다. 설치 도구·워크플로는 아직 추가하거나 실행하지 않았다.

## 비용과 제한

- 확인 당시 저장소는 공개 상태다. GitHub의 공개 저장소 표준 hosted macOS runner는 무료다. 큰 runner·저장소 가시성 변경·산출물 보관의 조건은 착수 시 다시 확인한다.
- Sideloadly는 Windows와 무료 Apple 계정을 지원한다. 무료 계정은 보통 동시 설치 3개 및 7일 유효기간 제한이 있으며 PC 연결을 통한 갱신이 필요하다.
- Apple 계정 입력·서명은 사용자의 로컬 설치 도구에서 한다. GitHub 빌드에는 Apple 비밀번호를 올리지 않는다.
- 개인 개발 테스트 경로다. App Store/TestFlight 배포 준비는 별도 작업이다. 특정 entitlement가 필요한 기능은 무료 서명에서 별도 확인해야 한다.

## 누비에 필요한 준비

- `mobile/app.json`의 iOS 앱 ID·폰트·권한 설명 및 로그인 callback 설정을 확인한다.
- `nearby.tsx`의 Android 전용 지도 진입 조건을 iOS에 맞게 바꾸고 MapLibre를 실기기에서 확인한다.
- Android 전용 PhotoGlass는 먼저 기존 대체 화면으로 테스트한다. 동일한 iOS 유리 효과는 별도 구현 판단이며 이번 무료 설치 경로만으로 완성되지 않는다.
- 장소 설명·촬영/갤러리·지도/GPS·로그인/복귀·기기 저장을 확인한다. 실제 모델 추론의 iOS 연결은 모델 수신 규격과 별도로 검토한다.

## 확인한 자료

- [GitHub-hosted runner의 공개/비공개 조건](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
- [Sideloadly 공식 안내](https://sideloadly.io/) · [무료 계정·유효기간·갱신 FAQ](https://sideloadly.io/faq)
- [AltStore Classic의 Windows 설치](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows)
- [Expo 앱의 unsigned IPA → 무료 계정 서명 사례](https://github.com/adulari/forge/blob/main/docs/mobile/SIDELOAD.md)

공급자 정책·도구·iOS/Xcode 버전은 재개 시 재확인한다. 정확한 빌드 명령과 버전은 첫 호환 검사를 통과한 뒤 기록한다.
