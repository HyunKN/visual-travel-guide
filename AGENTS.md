# Visual Travel Guide 작업 안내

프로젝트의 문서 원본은 이 저장소의 `docs/`다. 문서 체계에 처음 접근하거나 문서를 추가·이동할 때 [문서 안내서](docs/README.md)를 읽는다. Wiki는 main에 병합된 문서의 게시본이다. 게시·장애 처리는 [WIKI](docs/WIKI.md)를 따른다.

## 작업별 읽기

| 작업 | 먼저 읽을 문서 |
| --- | --- |
| 기능 범위·우선순위 결정 | [PRODUCT](docs/PRODUCT.md), 해당 기능 Issue |
| 시나리오 프로토타입 구현·관찰·인계 | [프로토타입 설계 시작점](docs/prototype/README.md), 해당 작업 Issue |
| 구현·수정 시작 | [DEVELOPMENT](docs/DEVELOPMENT.md), [QUALITY](docs/QUALITY.md), 해당 작업 Issue 또는 승인된 작업 요청 |
| 화면·상호작용 변경 | [DESIGN](docs/DESIGN.md) |
| 구조·데이터 흐름 변경 | [ARCHITECTURE](docs/ARCHITECTURE.md), 관련 ADR이 있으면 해당 기록 |
| 도메인 개념·명칭 변경 | [GLOSSARY](docs/GLOSSARY.md) |
| 코드 리뷰 | [CODING_STANDARDS](docs/CODING_STANDARDS.md), [구현 전 통과 조건](docs/DEVELOPMENT.md#구현-전-통과-조건), [QUALITY](docs/QUALITY.md), 해당 명세, 실제 변경 전체 |
| 새 작업 채팅 시작·작업 인계 | [THREADS](docs/THREADS.md), 해당 Issue, 기준 브랜치·커밋 |
| Wiki 게시·문서 자동화 변경 | [WIKI](docs/WIKI.md) |

## 사용자 가치 확인

기능 선정·설계·구현·리뷰에서는 [PRODUCT의 개발 핵심 원칙](docs/PRODUCT.md#개발-핵심-원칙-사용자가-선택할-이유)을 읽고, 기존 앱·상용 AI·검색 대신 선택할 이유와 그 근거를 되묻는다. [DEVELOPMENT](docs/DEVELOPMENT.md)의 단계별 점검과 [QUALITY](docs/QUALITY.md)의 비교 검증 기준에 따라 가설·증거·미검증 사항·다음 확인을 작업 기록에 남긴다.

## 작업 완료

- 변경한 동작에 영향을 받는 문서를 같은 변경 묶음에서 갱신한다. 문서 영향이 없으면 완료 보고나 PR에 이유를 한 줄 남긴다.
- 합의된 기준, 제안, 구현됨, 검증됨을 구분한다. 미정인 기술 스택·디자인 수치를 확정 사실로 채우지 않는다.
- 기능 진행 상황과 검증 증거는 Issue·PR에서 관리한다. 문서에는 지속적으로 쓰는 규칙과 결정, 원본 기록 링크를 남긴다.
- 리뷰에는 staged·unstaged·새 파일을 포함한다. 커밋 간 diff만 보고 미커밋 변경을 검토했다고 보고하지 않는다.
- 스킬의 commit·외부 게시·위임 단계는 사용자의 요청 범위와 실행 환경 권한 안에서 수행한다.

## Agent skills

- PPT → PDF 변환 시 전역 `ppt-to-pdf-images` 스킬(`~/.codex/skills/ppt-to-pdf-images/SKILL.md`)을 읽고 적용한다.
- Issue tracker: GitHub Issues. 발행·분할·통합, 테스트 발견 사항 정리, 다음 작업 선택 전에 [Issue 운영 규칙](docs/agents/issue-tracker.md)을 읽는다.
- Domain docs: 단일 도메인. 용어집·ADR을 다루는 스킬은 [문서 경로 설정](docs/agents/domain.md)을 읽는다. 이 프로젝트의 용어집은 `docs/GLOSSARY.md`다.
- 작업 단계별 스킬과 적용 조건은 [DEVELOPMENT](docs/DEVELOPMENT.md)에 있다. 실제 호출 전에 설치된 해당 `SKILL.md`를 읽는다.
