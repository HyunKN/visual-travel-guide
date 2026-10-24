# Sprint 0 사진 식별 실행 실험

2026-10-23 사용자 요청: 자료 확보 → 후보 모델 실험 → 개발 환경 구체화.
제품 채택·학습·Android 검증과 분리한 개발용 실험이다.

## 실행 전에 정한 평가 계약 v1

- 문제: 모바일 웹에서 사용할 사진 식별의 데이터·실행 가능성이 아직 확인되지 않았다.
- 사용자 가치 가설: 사진으로 대상 설명까지 가는 수고를 줄인다. 이번 기술 실험은 기존 검색·AI 대비 사용자 가치 검증을 대신하지 않는다.
- 자료: 궁능유적본부의 6개 건물 안내에 수록된 사진 중 캡션상 해당 건물 외관만 지원 대상으로 사용한다. 같은 페이지의 다른 건물·굴뚝은 지원 밖 입력으로 분리한다. 촬영 시점·촬영 묶음은 미상이다.
- 첫 실행 전 contact sheet로 26장과 출처의 KOGL Type 1 표지를 확인했다. 높은 시점 사진이 포함되어 실제 방문객 촬영을 대표하지 않는다. 5720은 출처 캡션의 야경 표기와 육안 인상이 달라 lighting을 ambiguous로 둔다.
- 건물: 근정전·경회루·사정전·수정전·강녕전·교태전. 제품 지원 확정이 아닌 조사 후보다.
- 참조: 각 건물의 낮 외관 1장(5680, 5718, 5693, 5705, 5734, 5740). 나머지 독립 파일의 낮/밤 외관은 개발용 probe. 동일 원본 crop을 별도 평가 사진으로 만들지 않는다.
- 후보: 공개 ONNX 변환본 `Xenova/clip-vit-base-patch32`, vision INT8 파일. 원본 CLIP과 변환본의 출처를 구분한다. 기존 pretrained image encoder를 고정해 참조 사진과 cosine similarity로 비교한다. 새로 학습한 건물 분류 모델이 아니다.
- 기준선: 같은 사진의 RGB 8-bin/채널 히스토그램 cosine 최근접 검색. 색감·밤낮만으로 맞추는 효과와 비교한다.
- 지표: 지원 입력 Top-1/Top-3 건수와 분모, 건물별·낮밤별 결과, 지원 밖 입력의 강제 최근접 후보/점수, 모델 파일 크기, 세션 로딩, 사진별 전처리/추론 시간. 점수는 정답 확률이 아니다.
- 실행: 전체 이미지 특징 추출 1회, 별도 고정 입력 워밍업 후 10회 추론 시간. 결정론적 같은 모델의 반복은 독립 정확도 표본으로 세지 않는다. CPU thread 2개 고정.
- 필수 통과 조건: 캡션·출처·이용표시·파일 hash 기록, 참조/probe exact duplicate 없음, 출력 유한한 512차원, 모든 입력 처리, 같은 사진 self-match 확인. 누락·실패는 숨기지 않는다.
- 품질 판단: 작은 같은 기관 자료는 최종 holdout이 아니다. 탐색용 건수만 보고하며 Top-1 80%/Top-3 90%의 제품 목표 통과를 선언하지 않는다. 미확정 threshold를 이 표본에서 정해 성능을 부풀리지 않는다.
- 범위 밖: 학습/미세조정, 사용자가 누른 부위 인식, GPS 결합, Android 속도·메모리, 현장 효용, 제품 배포. 결과에 따라 다음 실험을 정한다.

### 진단 추가 v1.1 (첫 INT8 결과 확인 후, FP32 실행 전)

INT8 Top-1 2/17, 색상 기준선 3/17을 확인했다. 양자화만으로 실패가 생겼는지 구분하기 위해 같은 revision의 FP32 vision 모델을 동일 전처리·동일 참조/probe에 실행한다. 최초 결과·기준은 유지하고 진단을 `precision-comparison.json`에 별도로 기록한다. 이 추가 실험도 독립 성능 평가가 아니다. INT8/FP32의 특징 cosine, 후보 순서 일치, 동일 probe의 정답 건수를 비교한다.

### 비교 추가 v1.2 (MobileNet 실행 전)

FP32 CLIP도 Top-1 5/17로, 더 작은 모델에서 실행 비용과 구별 신호를 비교한다. 공식 ONNX Model Zoo의 `mobilenetv2-12.onnx` FP32, commit `c5cae0f1942c8d7727372c7b1f6b485aa39e4421`을 사용한다. 기존 ImageNet classifier 전의 `472`(global average pooling 후 reshape) 1280차원 출력을 추출한 파생 파일을 만들고 원본과 파생 hash를 기록한다. 원본 분류층 weight/bias에 특징을 통과시킨 값이 원본 logits와 일치하는지 먼저 확인한다. 새 분류기 학습은 아니다. 모델별 정해진 전처리를 쓰되 자료·참조·probe·cosine 비교·CPU thread·10회 warm 추론 조건은 유지한다. 원본 정답 목록의 의미와 참조 사진은 변경하지 않는다.

## 파일과 재실행

`prepare.py`는 공개 기관 페이지의 캡션·이용표시를 확인하고 고정한 사진과 모델을 내려받는다. `manifest.json`은 획득 근거와 파일 hash다. `run.py`는 그 hash를 확인한 뒤 결과를 `results.json`에 쓴다. 원본 사진·모델·Python 환경·페이지 사본은 Git에서 이미 제외된 `.codex-build/sprint0-recognition/`에 둔다. 재배포·제품 연결은 하지 않는다.

PowerShell, 저장소 루트에서:

```powershell
# 기본 python 대신 Python 3.12 interpreter를 지정한다. 이 PC의 기본 python은 3.13이다.
# 아래 $experimentPython은 설치한 Python 3.12 실행 파일 경로로 지정한다.
& $experimentPython -m venv .codex-build/sprint0-recognition/venv
.codex-build/sprint0-recognition/venv/Scripts/python.exe -m pip install -r experiments/sprint0-recognition/requirements.lock.txt
.codex-build/sprint0-recognition/venv/Scripts/python.exe experiments/sprint0-recognition/prepare.py
.codex-build/sprint0-recognition/venv/Scripts/python.exe experiments/sprint0-recognition/run.py
.codex-build/sprint0-recognition/venv/Scripts/python.exe experiments/sprint0-recognition/check_precision.py
.codex-build/sprint0-recognition/venv/Scripts/python.exe experiments/sprint0-recognition/compare_mobilenet.py
.codex-build/sprint0-recognition/venv/Scripts/python.exe experiments/sprint0-recognition/verify.py
```

Python 3.12를 사용한다. 실행 후 버전·backend·크기는 결과에 기록한다. manifest 재생성 후에는 캡션/사진을 다시 검토해야 하며, 기존 결과를 새 자료의 결과로 해석하지 않는다. 결과와 해석은 [실험 기록](../../docs/experiments/sprint0-recognition.md)에 연결한다.

실제 설치에는 Codex 제공 Python 3.12.14를 사용했다. 실행 환경의 기본 임시 폴더에서 ensurepip가 PermissionError로 실패하여, 해당 설치 프로세스의 TEMP/TMP를 `.codex-build/sprint0-recognition/tmp`로 지정한 뒤 성공했다. OS 전역 설정은 바꾸지 않았다. 같은 문제가 있으면 저장소 안의 쓰기 가능한 임시 디렉터리를 사용한다.
