# 양식 6 다이어그램 원본과 미리보기

2026-10-25 기준 시스템 구조 설계의 편집 가능한 원본이다. 양식 6의 논리 아키텍처·핵심 업무 흐름·데이터 설계에 대응한다. 설계 문서이며 앱 구현·Android 실기기 성능 검증 완료를 뜻하지 않는다.

## 원본 파일

| 구분 | 편집 원본 | 미리보기·삽입 파일 |
| --- | --- | --- |
| 논리 아키텍처 | [Mermaid](architecture.mmd) | [PNG](architecture.png) |
| 흐름 1 · 앱 실행에서 첫 설명까지 | [Mermaid](flow1.mmd), [SVG](flow1.svg) | [PNG](flow1.png), [Word 삽입용](flow1-word.png) |
| 흐름 2 · 불확실한 결과에서 재탐색 | [Mermaid](flow2.mmd), [SVG](flow2.svg) | [PNG](flow2.png), [Word 삽입용](flow2-word.png) |
| 논리 ERD 전체 | [Mermaid](data.mmd) | 아래 두 그림으로 나누어 표시 |
| 논리 ERD 1 · 건물과 설명 자료 | [SVG](erd-core.svg) | [PNG](erd-core.png), [Word 삽입용](erd-core-word.png) |
| 논리 ERD 2 · 질문·지원 영역·예시 | [SVG](erd-extension.svg) | [PNG](erd-extension.png), [Word 삽입용](erd-extension-word.png) |

Mermaid는 구조·관계·처리 순서를, SVG는 글자·도형·연결선을 편집할 수 있는 원본이다. PNG는 미리보기용이다. Word 삽입용 PNG는 바깥 제목·여백만 제외했으며 참여자·메시지·필드는 동일하다.

## 논리 아키텍처

화면·입력, 탐색·판단, 자료 조회, 대상·상태의 책임을 분리한다. 인식 연결부는 전처리·모델 실행을 맡고 학습·평가는 앱 실행과 분리한다.

![논리 아키텍처](https://raw.githubusercontent.com/HyunKN/visual-travel-guide/main/docs/diagrams/form6-20261025/architecture.png)

## 핵심 흐름 1

도움을 확인한 뒤 실제 사진 또는 준비된 예시로 시작하고, 같은 대상의 설명·출처로 연결한다. 예시는 모델을 호출하지 않는다. 미확정·오류는 재탐색 흐름으로 이어진다.

![사진 또는 예시에서 설명까지의 시퀀스](https://raw.githubusercontent.com/HyunKN/visual-travel-guide/main/docs/diagrams/form6-20261025/flow1.png)

## 핵심 흐름 2

미확정·오류를 구분하고 후보 선택 또는 판단 보류·재입력으로 연결한다. 상세 후보 비교는 Sprint 2의 선택적 흐름이다. 방문객의 후보 선택을 AI 검증 완료로 표시하지 않으며 늦은 이전 결과는 적용하지 않는다.

![불확실한 결과에서 후보 선택 또는 재탐색으로 가는 시퀀스](https://raw.githubusercontent.com/HyunKN/visual-travel-guide/main/docs/diagrams/form6-20261025/flow2.png)

## 데이터 설계

초기 저장 방식은 JSON과 별도 이미지·모델 파일이다. PK는 논리 고유 ID, FK는 다른 자료의 ID 참조이며 SQL DB 제약을 구현했다는 뜻은 아니다. FK 배열은 N:M 관계를 나타낸다. 중복·참조·파일 검사는 별도로 구현한다. 질문·부분 탐색은 Should·Sprint 미배치를 유지한다.

![구역 대상 설명 출처 이미지의 논리 ERD](https://raw.githubusercontent.com/HyunKN/visual-travel-guide/main/docs/diagrams/form6-20261025/erd-core.png)

![질문 지원 영역 예시의 논리 ERD](https://raw.githubusercontent.com/HyunKN/visual-travel-guide/main/docs/diagrams/form6-20261025/erd-extension.png)

## 그림 재생성

[시퀀스 생성 원본](render_sequences.py)은 이 폴더의 시퀀스 문법을 읽어 SVG·PNG를 생성한다. Mermaid 전체 문법을 처리하는 렌더러는 아니다. [ERD 생성 원본](render_erd.py)은 본문용 두 그림의 도형·텍스트를 그리며 전체 Mermaid ERD를 자동 렌더링하는 프로그램은 아니다. 관계를 수정할 때 Mermaid와 본문용 그림의 의미를 함께 맞춘다.

Python과 Pillow, Windows 맑은 고딕이 있는 환경에서 실행한다. 실행하면 이 폴더의 파생 SVG·PNG를 다시 쓴다. 설치·실행 환경에 따라 글꼴 렌더링이 달라질 수 있다.

```powershell
python render_sequences.py
python render_erd.py
```

관련 설명: [시스템 구조 설계](../../ARCHITECTURE.md), [데이터·입출력 계약](../../experiments/form6-data-contract-review.md), [개발 환경 선정 근거](../../experiments/form6-environment-research.md).
