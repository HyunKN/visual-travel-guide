# 개발 문서 게시와 자동화 운영

문서 게시·CI·장애 처리 전에 읽는다. 게시 설정의 원본은 [GitHub Actions](../.github/workflows/docs.yml), [게시 목록](../.github/wiki-pages.json), [변환 스크립트](../scripts/sync_wiki.py)다.

## 실행 흐름

```text
문서·설정 변경 → PR의 문서 검사 → main 병합
                                   → 문서 검사
                                   → Wiki 변환·커밋·푸시
```

관련 경로 변경 시 실행하고, GitHub Actions의 수동 실행은 main을 선택한다. 문서 검사에는 로컬 링크 확인과 게시 변환·보존 동작 검사가 포함된다. 앱·모델·실기기 테스트는 포함하지 않는다.

동일 저장소의 Wiki에 게시할 때 GitHub Actions의 기본 `GITHUB_TOKEN`과 `contents: write` 권한을 사용한다. 개인 토큰을 새로 발급하거나 저장하지 않는다. Wiki는 먼저 존재해야 하며 현재 기본 브랜치는 master다. 환경별 권한 정책으로 게시가 실패하면 실제 로그를 확인한다.

## 게시 대상과 보존

- 공통 문서의 페이지 이름은 `.github/wiki-pages.json`에서 지정한다. README는 Development-Home이다.
- 각 게시본의 위쪽에 원본 파일과 기준 커밋을 표시한다. 상대 링크는 게시 페이지 또는 해당 커밋의 파일로 변환한다.
- 기존 Wiki Home의 본문을 보존하고 개발 문서 링크 구간만 추가·관리한다. 기존 보고서는 게시 대상에 포함하지 않는다.
- 생성 페이지·사이드바에는 관리 표시를 넣고 `.codex-docs-sync.json`에 게시 목록을 기록한다. 같은 이름의 수동 페이지가 있으면 실패하고 덮어쓰지 않는다.
- 문서 이름을 바꿀 때 게시 목록도 바꾼다. 이전에 이 스크립트가 관리한 페이지만 정리한다. 삭제 대상에서 관리 표시가 사라졌다면 확인이 필요하므로 실패한다.
- 문서를 Wiki에서 독립적으로 편집하지 않고 저장소 PR로 수정한다.

## 로컬 확인

저장소 루트에서 Python 3으로 실행한다. 추가 패키지는 필요 없다.

```powershell
python scripts/sync_wiki.py --check
python -m unittest discover -s scripts/tests -v
```

초기 게시 또는 변환 확인에 실제 Wiki checkout을 사용할 수 있다. 아래 명령은 파일만 생성하며 commit·push를 수행하지 않는다.

```text
python scripts/sync_wiki.py --wiki-dir <Wiki checkout> --sha <main의 전체 커밋 SHA>
```

## 결과 확인과 재시도

1. [Docs and Wiki Actions](https://github.com/HyunKN/visual-travel-guide/actions/workflows/docs.yml)의 check와 publish 결과를 확인한다.
2. [Development-Home](https://github.com/HyunKN/visual-travel-guide/wiki/Development-Home)의 기준 커밋과 기대 main 커밋이 일치하는지 확인한다.
3. 실패하면 해당 로그를 확인하고 원본 문서·경로·권한·Wiki 충돌을 고친다. 미완료 게시를 성공으로 표시하지 않는다.
4. 해결 후 같은 실행을 재시도하거나 main에서 Run workflow를 실행한다. 반복 실행은 같은 입력에서 동일한 결과를 만든다.

원격 변경으로 push가 거절되면 강제 push 대신 최신 Wiki를 다시 받아 재시도한다. 검사·인증·push 실패에서는 기존 원격 게시본이 유지된다. 공통 문서를 다른 페이지로 되돌리려면 저장소 변경을 revert하고 게시한다.

설정 작업의 실제 검증 기록은 [Issue #1](https://github.com/HyunKN/visual-travel-guide/issues/1)에 남긴다.
