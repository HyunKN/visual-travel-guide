# 모바일 웹 인식 모델 실행·배포 선택지 조사

조사일: 2026-10-23. 상태: 공식 자료 기반 기술 조사와 실험 제안. 최종 제품 스택·모델·배포처 선정이나 Android 실기기 검증 결과가 아니다. 기준은 [구조 초안](../ARCHITECTURE.md), [Product Backlog](../PRODUCT_BACKLOG_DRAFT.md)의 6개 건물 후보 식별·불확실 처리다. 임의 사진의 부분 자동 식별은 별도 확장 검토다.

## 1. 모델을 두는 곳과 실행하는 곳은 다르다

모델 파일은 학습 결과를 저장한 파일이다. 정적 웹 서버·오브젝트 저장소·모델 저장소에서 내려받게 하고, 실제 계산은 방문객 스마트폰의 브라우저에서 수행할 수 있다. 서버에 파일을 올렸다고 서버가 사진을 분석하는 것은 아니다. ONNX Runtime Web은 앱 JavaScript, WASM 실행 파일, ONNX 모델 파일을 배포 자산으로 구분한다. [공식 배포 문서](https://onnxruntime.ai/docs/tutorials/web/deploy.html)

| 선택지 | 모델 파일 위치 | 실제 계산 | 우리 서비스에서 확인할 부담 |
| --- | --- | --- | --- |
| 브라우저 추론 | 정적 서버/CDN에서 전달, 브라우저 캐시에 보관 가능 | 방문객 폰의 CPU(WASM) 또는 GPU(WebGPU) | 첫 다운로드, 기기 호환성, 메모리, 발열, UI 반응 |
| 서버 추론 | 서버의 디스크·모델 저장소 | 우리가 운영하는 서버 CPU/GPU | 사진 업로드 시간, 요청 비용, 동시 요청, 장애, 사진 보관·삭제 |
| 조건부 혼합 | 브라우저용과 서버용 각각 | 기기 조건에 따라 선택 | 두 경로 검증과 운영 비용. 사진의 서버 전송을 숨기면 안 됨 |

이 표의 부담은 구조상 예상되는 비교 항목이며 아직 실측하지 않았다. 서버 추론도 우리가 선택·학습한 모델을 실행할 수 있으므로 상용 AI API 사용과 같은 뜻이 아니다. ONNX Runtime은 Web과 Python/Node 등 실행 환경을 별도로 제공한다. [공식 실행 환경 안내](https://onnxruntime.ai/docs/get-started/with-javascript/web.html), [Python 안내](https://onnxruntime.ai/docs/get-started/with-python.html)

**현재 제안:** 모바일 웹을 유지하면서 작은 모델의 브라우저 실행부터 검증한다. 스마트폰 직접 실행을 목표로 삼되 실험 전 제품 채택을 확정하지 않는다. 화면은 인식 연결부만 호출하게 두어 서버 방식으로 바꾸더라도 사용자 흐름을 다시 만들지 않게 한다. 이것은 설계 제안이다.

## 2. 브라우저 실행 기술과 Android 조건

### ONNX Runtime Web

- WASM은 CPU 실행 경로이며 공식 지원표에 Chrome/Edge Android가 포함된다. WebGPU는 GPU 실행 경로다. 지원표의 OS·브라우저 표기만으로 특정 폰과 특정 모델이 실행된다고 판단하지 않는다. [지원표](https://onnxruntime.ai/docs/get-started/with-javascript/web.html)
- Chrome 공식 문서는 Android WebGPU의 Chrome 121 이상 조건, HTTPS 등 secure context 조건, GPU adapter가 없을 수 있는 상황을 설명한다. 초기 Android 기본 활성화 공지는 Android 12 이상 Qualcomm·ARM GPU 대상이었다. 이 초기 공지를 현재 모든 Android의 지원 범위로 일반화하지 않는다. `navigator.gpu` 존재뿐 아니라 `requestAdapter()`와 실제 session 생성·추론 성공을 확인한다. [현재 문제 해결 안내](https://developer.chrome.com/docs/web-platform/webgpu/troubleshooting-tips), [Chrome 121 도입 공지](https://developer.chrome.com/blog/new-in-webgpu-121)
- 같은 와이파이의 `http://192.168...` 주소는 localhost 예외와 다르다. 따라서 PC localhost 성공 후 폰 LAN HTTP에서 WebGPU 실패할 수 있다. 폰 실험에는 신뢰 가능한 HTTPS 경로를 준비해야 한다. 위 secure context 조건에 따른 적용 판단이다.
- WASM 다중 스레드는 브라우저 지원과 `crossOriginIsolated`가 필요하다. 첫 호환성 실험에서는 `numThreads = 1`을 명시해 헤더 문제와 모델 문제를 구분할 수 있다. 다중 스레드를 켜면 COOP/COEP와 외부 이미지·모델 응답 조건도 확인한다. [환경 옵션](https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html)
- 모델 실행을 Worker로 옮기면 UI 작업과 분리할 수 있다. 다만 `env.wasm.proxy`를 그대로 WebGPU에 사용할 수는 없다. WebGPU는 별도 Worker 내부에서 런타임을 로드하는 방식이 필요하며 배포 후 Worker·CSP·동일 출처 로딩까지 확인한다. Worker 사용 자체가 계산량이나 메모리를 줄이지는 않는다. [Worker 제한](https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html), [Worker 배포](https://onnxruntime.ai/docs/tutorials/web/deploy.html)

### Transformers.js

지원하는 모델의 전처리·모델 로딩·추론을 제공하고 내부적으로 ONNX Runtime Web을 사용한다. `device: 'webgpu'`로 GPU 경로를 선택할 수 있다. 임의 PyTorch 체크포인트를 넣기만 하면 실행되는 것이 아니며 지원 아키텍처·ONNX 변환·전처리가 맞아야 한다. 모델 경로와 WASM 경로를 자체 호스팅 경로로 지정할 수 있다. [WebGPU 가이드](https://huggingface.co/docs/transformers.js/guides/webgpu), [커스텀 모델](https://huggingface.co/docs/transformers.js/custom_usage)

공식 Vanilla JS 예제가 있어 현재 Vite 기반 앱 때문에 React를 추가할 필요는 없다. 예제도 실제 제품에서는 모델 다운로드·추론을 Worker로 분리할 것을 권한다. [Vanilla JS 예제](https://huggingface.co/docs/transformers.js/v3.8.1/tutorials/vanilla-js)

라이브러리 `main` 문서는 개발 버전일 수 있다. 실험 때 설치 버전과 문서 버전을 맞추고 lockfile을 보존한다. 이 조사에서 확인한 문서의 안정판 링크는 `v3.8.1`이지만 최신 버전으로 채택한 것은 아니다. 양자화 옵션은 모델별로 제공 파일과 지원 여부가 다르므로 `q8`·`fp16` 옵션만 바꾸어 모든 모델을 경량화할 수 있다고 가정하지 않는다. [dtype 문서](https://huggingface.co/docs/transformers.js/v3.8.1/guides/dtypes)

## 3. 다운로드·캐시·메모리는 첫 사용 UX와 연결된다

**확인된 사실:** 모델을 Cache API 또는 OPFS에 저장해 재다운로드를 줄일 수 있다. 저장 용량과 삭제 정책은 브라우저마다 다르며 저장소 압박·사용자 삭제 등으로 캐시가 사라질 수 있다. 다운로드가 끝났다는 것과 다음 방문에서도 반드시 오프라인 실행된다는 것은 다르다. [ORT 모델 캐시](https://onnxruntime.ai/docs/tutorials/web/large-models.html), [브라우저 저장소 정책](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)

**설계 제안:** 홈과 예시 설명은 모델 로딩 없이 먼저 보이고, 실제 사진 분석에 진입할 때 다운로드 진행·취소·재시도를 제공한다. 캐시 키에는 모델 버전 또는 해시를 포함한다. 캐시 실패는 분석 불가능과 구분하고, 저장 실패 시 현재 세션 실행 가능 여부를 확인한다. 사용자 사진을 모델 캐시와 함께 저장하거나 자동 학습 자료로 모으지 않는다.

**메모리 판단:** 가중치 파일 용량은 실제 탭의 메모리 사용량과 다르다. 입력 사진 디코딩, 모델 초기화, 중간 텐서, CPU/GPU 복사도 사용한다. ORT 문서가 설명하는 WASM 32bit 주소 공간 한도는 폰에서 그 용량까지 안전하다는 뜻이 아니다. 원본 사진은 한 번에 하나만 처리하고 필요한 입력 크기로 전처리하며 완료·취소 시 텐서와 세션 자원을 정리하는 실험이 필요하다. [플랫폼 제한](https://onnxruntime.ai/docs/tutorials/web/large-models.html)

## 4. 후보 모델과 사용 조건을 분리한다

| 후보 | 공식 근거로 확인한 사실 | 이번 과제에 대한 판단·남은 검증 |
| --- | --- | --- |
| MobileNetV2 1.0 | ONNX Model Zoo는 FP32 약 13.3 MB, INT8 약 3.5 MB 변형과 Apache-2.0을 기재한다. 출력은 ImageNet 1,000개 분류이며 경복궁 6개 건물이 아니다. [모델 원본 안내](https://github.com/onnx/models/tree/main/validated/vision/classification/mobilenet) | 첫 다운로드·전처리·WASM 실행 실험에 적합한 작은 기준선이라는 제안. 건물 식별에는 특징 벡터+참조 사진 비교 또는 분류층 학습이 추가로 필요하다. 실제 내려받은 파일·해시·전처리·지원 연산·특징 출력 위치 확인 필요 |
| TensorFlow.js MobileNetV2 | 공식 브라우저 패키지가 이미지 입력과 `infer(image, true)` 특징 추출 API를 제공한다. 패키지 저장소 Apache-2.0. [API](https://github.com/tensorflow/tfjs-models/tree/master/mobilenet), [저장소 라이선스](https://github.com/tensorflow/tfjs-models/blob/master/LICENSE) | ONNX 변환 없이 특징 추출을 먼저 확인할 대안. TFJS와 ONNX 파일의 가중치·전처리를 섞지 않는다. 별도 가중치 URL을 사용하면 해당 배포물 조건도 확인. 최종 런타임 두 개를 앱에 동시에 싣자는 뜻은 아님 |
| MobileCLIP2-S0 | Apple 공식 모델 카드의 이미지 인코더는 11.4M, 텍스트 인코더는 63.4M 파라미터다. 공식 사용법은 PyTorch/OpenCLIP이고 export 전에 재매개변수화를 안내한다. [모델 카드](https://huggingface.co/apple/MobileCLIP2-S0), [공식 구현](https://github.com/apple-aiml-research/ml-mobileclip) | 이미지 인코더만 내보내면 전체 이미지+텍스트 모델보다 작게 만들 가능성이 있다. 이는 구조에 따른 추론이며 ONNX 크기·Android 브라우저 호환성은 미검증. 공식 iPhone 성능을 Android 웹 성능으로 옮기면 안 됨. 아래 모델 라이선스 때문에 제품 기본 후보로 바로 확정하지 않음 |
| CLIP ViT-B/32 | OpenAI 원본 구현은 MIT이며 이미지·텍스트 특징을 각각 추출한다. Xenova는 Transformers.js용 ONNX 변환 모델과 사용 예제를 제공한다. [원본](https://github.com/openai/CLIP), [변환 배포자 모델 카드](https://huggingface.co/Xenova/clip-vit-base-patch32) | 경복궁 이름만 넣은 zero-shot 결과와 사진 참조 기반 결과를 구분해 비교할 후보. 원본 MIT와 변환 파일의 출처·고지·revision을 함께 기록. 도메인 정확도·다운로드/메모리 확인 전 ‘모바일 경량 모델’로 단정하지 않음 |
| SigLIP base patch16-224 | Google 계정의 해당 모델 카드는 Apache-2.0, 224 입력, 이미지·텍스트 유사도 용도를 기재한다. 카드 본문은 Hugging Face 팀 작성임을 밝힌다. [해당 모델](https://huggingface.co/google/siglip-base-patch16-224) | 정확도 비교 후보. SigLIP 계열 전체의 라이선스·크기를 하나로 묶지 않는다. 선택한 ONNX 변환본·양자화·지원 연산과 실기기 로딩은 추가 확인 필요 |

**MobileCLIP 라이선스의 중요한 구분:** 코드 `LICENSE`는 MIT지만 가중치는 별도 `LICENSE_MODELS`를 따른다. 현재 공식 문구는 Research Purposes를 비상업 과학 연구·학술 개발로 정의하며, 그 범위에서 product development를 제외한다고 명시한다. 따라서 “무료 앱이니 제품에 그대로 사용 가능”이라고 결론 내릴 수 없다. 학술 실험과 서비스 제품 적용을 분리하고, 제품 채택 전 해당 용도에 대한 조건을 확인해야 한다. [코드 라이선스](https://github.com/apple-aiml-research/ml-mobileclip/blob/main/LICENSE), [모델 라이선스](https://github.com/apple-aiml-research/ml-mobileclip/blob/main/LICENSE_MODELS)

라이브러리의 라이선스, 모델 가중치의 라이선스, 학습·평가 사진의 이용 조건은 각각 확인한다. 전처리·이미지 인코더를 변경하거나 변환한 모델은 원본과 구별해 기록한다. 모델의 이름에 ‘Mobile’이 포함된 것은 우리 폰에서 빠르다는 검증이 아니다.

## 5. 먼저 실행할 한 가지 실험

**추천: MobileNetV2 1.0의 이미지 특징 기반 참조 사진 검색을 첫 기준선으로 사용한다.** 목적은 ‘우리 사진으로 구별 신호가 생기는가’와 ‘브라우저 실행 비용은 얼마인가’를 작게 확인하는 것이다. 최종 모델 추천이나 경복궁 전문 인식 성능 보장은 아니다. 특징 추출을 바로 쓰려면 TFJS 공식 API, ONNX 실행 호환성부터 보려면 Model Zoo FP32 모델을 사용하되 두 실험의 파일과 결과를 구분한다.

1. 대상별 출처·이용 조건·촬영 그룹·정답이 확인된 참조 사진과 별도 평가 사진을 준비한다. 같은 사진의 크롭·리사이즈를 양쪽에 넣지 않는다.
2. 참조 사진 특징은 개발 환경에서 미리 계산하고, 브라우저는 입력 사진 한 장의 특징을 계산해 비교한다. 참조 목록과 입력은 같은 모델·같은 전처리를 쓴다.
3. 먼저 FP32의 출력 일치와 식별 결과를 확인한다. 양자화는 동일 평가셋에서 정확도·불확실 처리·다운로드·실행시간의 차이를 비교한 뒤 고려한다.
4. 다른 궁궐, 나무, 사람, 흐림, 기둥만 보이는 사진도 포함한다. 가장 높은 유사도 하나가 나온다고 항상 6개 건물 중 하나로 확정하지 않는다. 보류 임계값은 별도 검증셋으로 정한다.
5. PC 결과와 Android 실제 기기 결과를 별도로 남긴다. 기종이 정해지기 전에는 Android 완료로 표시하지 않는다.

위 단계는 실험 제안이며 이 조사 파일 작성 중 모델을 내려받거나 실행하지 않았다. 처음 확보한 소량 사진만으로 목표 Top-1 80%·Top-3 90% 달성을 주장할 수 없다. 특히 건물 분류 성공은 잡상·기둥 자동 탐지, 클릭 위치의 의미 이해, 설명 사실성, 사용자 가치의 검증이 아니다.

## 6. 실험 기록과 양식 6에 넘길 내용

| 기록 | 최소 내용 |
| --- | --- |
| 재현 환경 | OS·브라우저·기종, Node/Python·라이브러리 버전, 실제 실행 명령, 모델 URL/revision/SHA-256 |
| 런타임 | WASM/WebGPU, 실제 선택 경로·fallback·실패 사유, Worker 사용, HTTPS·격리 여부 |
| 첫 실행 | 캐시를 비운 다운로드 bytes/시간, 모델 초기화, 전처리, 추론, 결과까지 총시간 |
| 재방문 | 캐시 적중 여부와 재다운로드, 동일 사진·다른 사진 반복 실행 시간 |
| 안정성 | 반복 입력·취소·화면 이동·연속 입력의 이전 결과 혼입, UI 반응, 메모리 관찰 가능 범위, 탭/기기 실패 |
| 식별 | 건물별 Top-1/Top-3·혼동 사례·보류·지원 외 입력 오확정, 촬영 그룹 기준 분리와 표본 수 |

모델을 읽어 온 시간과 추론 시간만 재고 ‘빠르다’고 판단하지 않는다. 사용자가 처음 앱을 열어 유용한 결과를 얻기까지의 비용을 별도로 본다. 메모리를 계측할 수 없는 환경은 추정치를 실제 측정값처럼 쓰지 않고 미측정으로 남긴다.

**이번 조사로 설명 가능한 양식 6 내용:** 모델 호스팅과 계산 위치의 구분, 교체 가능한 인식 연결부, 브라우저 실행 조건, 사용자 사진의 처리 경로, 런타임별 실패 처리, 재현 실험 항목. **아직 확정할 수 없는 내용:** 제품 런타임·후보 모델 채택, Android 성능·정확도, 실제 호스팅 용량/비용/헤더 제약, 데이터 충분성.

사용자와 결정할 것은 (1) 브라우저 추론을 먼저 검증하는 진행 방향, (2) 첫 다운로드와 서버 사진 전송에 대한 제품 기준, (3) Android 시험 기기다. 실험에서 최초 대기나 호환성 부담이 크면 서버 추론을 비교한다. 두 경로의 운영을 동시에 구현하는 혼합 방식은 필요 근거가 생긴 뒤 검토한다.
