# Issue tracker 설정

기능 명세와 작업은 [Visual Travel Guide GitHub Issues](https://github.com/HyunKN/visual-travel-guide/issues)에서 관리한다. `to-spec`, `to-tickets`, Issue 기반 구현 전에 읽는다.

- 기능 전체는 상위 Issue, 독립적으로 검증할 작업은 하위 Issue로 연결한다. 지원 도구에 하위 Issue 기능이 없으면 양쪽에 전체 URL 링크를 남긴다.
- 선행 작업과 완료 기준을 각 작업에 기록한다. 도구가 의존 관계를 지원하지 않으면 본문에 선행 Issue URL과 상태를 연결한다.
- 실제 발행 전 최신 Issue와 사용 가능한 GitHub connector 또는 `gh` 권한·기능을 확인한다. 도구 지원과 인증 상태를 가정하지 않는다.
- 스킬이 tracker 발행을 요구하면 GitHub Issue 발행을 뜻한다. 사용자가 해당 발행까지 요청한 범위에서 진행한다. AI Workflow 설정은 [Issue #1](https://github.com/HyunKN/visual-travel-guide/issues/1)에서 추적한다.
- 라벨 매핑과 자동 triage는 아직 설정하지 않았다. 이를 요구하는 스킬을 처음 실행할 때 기존 라벨을 조회해 프로젝트 매핑을 정한다. `ready-for-agent` 등 기본값이 서버에 존재한다고 가정하지 않는다.
- PR은 변경과 검증의 기록이다. 외부 PR을 요청 접수·triage 대상으로 삼는 설정은 꺼져 있다.

Issue에는 목적·범위·인수 조건·검증 방법·선행 작업·관련 문서 링크를 담는다. PR 작성에는 저장소의 [PR 양식](../../.github/pull_request_template.md)을 사용한다. 실제로 생성되지 않은 Issue·PR 번호를 문서에 넣지 않는다.
