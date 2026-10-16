# 콘텐츠·상태·구현 경계

현재 계약은 **schemaVersion 2**다. [보완 개발 설계 4·5절](FLOW_EXTENSION_DESIGN.md)의 ComparisonCase·Continuation·preset 허용 장면과 N/홈/이력을 구현했다. P03의 후보 C는 case/option/input/reference/target을 함께 검사하고 후보 참고 장면에서 설명·질문을 연다. 다음 관람 카드 UI는 P05의 범위다. 부분 영역 중첩은 거부하고 틀린 후보를 입력 사진의 실제 대상으로 추가하지 않는다.

이관 근거는 [P01 준비 묶음](content-preparation/README.md)이다. 검수 자료를 [런타임 JSON](content/content.json)에 병합하고 새 사진 3장을 같은 해시로 복사했다. P01 packet은 변경하지 않은 이관 입력이며 진행자 정답표는 publicDir 밖에 있다. 새 사진 촬영일은 미상이다. 화면용 이미지 최적화·전체 시나리오 통합은 P06에서 확인한다.

상태: 콘텐츠·상태 계약. [실제 콘텐츠](content/README.md)와 [모바일 웹](../../prototype/README.md)을 연결했다. 화면 동작은 [SCREENS](SCREENS.md), 작업 경계는 [TASKS](TASKS.md), 검증 범위는 [검증 기록](../../prototype/VERIFICATION.md)을 따른다.

## 1. 첫 구현 구성

- `prototype/` 아래 독립적인 모바일 웹을 만든다. 기존 문서/Wiki용 Python 스크립트와 앱 실행 환경을 섞지 않는다.
- Vanilla JavaScript ES modules + HTML/CSS, 개발·빌드는 [Vite](https://vite.dev/guide/)를 사용한다. 실제 설치 버전과 lockfile은 `prototype/`에 고정했다. 앱 framework, DB, 이미지 모델 SDK는 사용하지 않는다.
- 정적 JSON/JS 자료 → 무결성 검증 → 메모리의 선택 상태 → 화면 렌더링으로 연결한다. 외부 API나 서버 저장소가 없다.
- 핵심 검사는 자료 참조 관계와 사용자 행동 경계에 둔다. 상태 전환은 Node test runner, 통합 흐름은 브라우저로 확인한다. 동일 동작을 여러 도구에 중복 작성하지 않는다.
- 계획상 모듈 책임: 자료 로드/검사, 선택·이동 상태, 화면/접근성, 테스트 설정. 처음부터 화면마다 패키지·서비스·저장소를 만들지 않는다.
- 실행·검사 명령과 실제 버전은 [prototype README](../../prototype/README.md)에 있다. 콘텐츠는 `docs/prototype/content/`가 원본이고 Vite가 정적 파일로 제공한다.

## 2. 콘텐츠 묶음

| 자료 | 필수 속성 | 규칙 |
| --- | --- | --- |
| Dataset | schemaVersion, contentVersion, scenes, targets, questions, answers, sources, assets | 모든 ID는 종류 안에서 유일. 참조는 존재해야 함 |
| v2 추가 | comparisonCases, continuations, testPresets.navigationScenes·comparisonCaseId | [보완 계약 4절](FLOW_EXTENSION_DESIGN.md#4-콘텐츠-계약의-변경안). v1은 명시적으로 거부 |
| Scene | id, title, areaLabel, assetId, wholeTargetId 또는 null, regions, targetIds | 하나의 준비된 관찰 장면. 실제 좌표/GPS가 아님. 건물 전체가 사진에 없으면 null |
| Region | id, targetIds, x, y, width, height | 원본 이미지 기준 0~1 사각형. 범위를 벗어나거나 크기 0이면 잘못된 자료 |
| Target | id, kind, displayName, neutralLabel, sceneIds, parentTargetId, overviewAnswerId, questionIds | kind는 building/part. 부분의 parent는 실제 지원 건물 또는 null |
| Question | id, targetId, label, answerId | 준비된 질문. 같은 문구라도 대상 연결이 다르면 별도 ID |
| Answer | id, targetId, questionId 또는 null, shortText, moreText, sourceIds, reviewStatus, checkedAt | overview는 questionId=null. 질문 답변은 연결된 question과 target 모두 일치 |
| Source | id, title, url, publisher, checkedAt, claimNote | 설명의 어떤 사실을 뒷받침하는지 기록. 기관 홈 링크만으로 대체하지 않음 |
| Asset | id, localPath, alt, width, height, sourceUrl, creatorCredit, licenseLabel, licenseUrl, modificationNote, checkedAt | 원본 출처·표시 의무·재사용 조건을 확인. 해설 이용 조건과 사진 이용 조건은 별개 |
| Card | id, contextKey, sceneId, targetId, questionId 또는 null, answerId, assetId, prompt | 모든 연결이 같은 대상을 가리킴. 맥락당 0~1개 |
| TestPreset | id, sceneId, contextKey, cardVisible, contentVersion | 시나리오 준비용. 사용자가 풀어야 할 정답·개인정보는 넣지 않음 |

`reviewStatus`는 draft/reviewed/unsupported 중 하나. reviewed는 사실·대상·출처 검수를 뜻하며 실기기 동작 통과를 뜻하지 않는다. 설명 본문을 관찰 참여자에게 보일 수 있는 것은 reviewed뿐이다. 개발 fixture는 문화유산 사실을 담지 않는 별도 명시 자료다. 테스트용 잘못된 자료는 관찰용 콘텐츠와 분리한다. JSON이면 주석 대신 필드를 사용한다.

표는 언어에 종속되지 않는 계약이다. 특정 타입 라이브러리나 DB 스키마를 요구하지 않는다. 필수 값이 없을 때 허구의 기본 설명으로 보정하지 않는다.

## 3. 초기 콘텐츠 슬롯과 선정 조건

| 슬롯 | 필요한 장면 | 사용 목적 | 선정 완료 조건 |
| --- | --- | --- | --- |
| C01 | 건물 외관 전체가 보이는 장면 | S1 이름·전체 설명 | 건물 ID·이름·해설 근거, 전체 사진 이용 가능 |
| C02 | 문양 또는 구조물과 주변 건물의 관계가 보이는 장면 | S2 부분 탐색·지정 | 부분이 스마트폰에서도 구별되며 의미/용도 출처 확보 |
| C03 | 처음 보면 지나치기 쉬운 세부 요소가 있는 다른 장면 | S3 호기심 카드 | 앞선 질문의 학습을 피할 다른 대상, 정확한 카드 문구와 설명 |

사용자가 선택한 준비 대상은 **근정전·경회루·자경전 십장생굴뚝 세 곳**이다. 근정전·경회루는 궁능유적본부 사진, 굴뚝은 아래 한국민족문화대백과사전 사진으로 연결했다. 지원 부분은 앞마당의 돌바닥, 굴뚝 중앙 문양, 위쪽 배출구다. [원본과 선정 근거](content/README.md)에서 사실·이용 조건·남은 사용자 검토를 구분한다. 공식 명칭이 불명확한 부분에는 임의의 전통 용어를 붙이지 않는다.

현재 자료는 장면 6개, 대상 7개, 답변 13개, 질문 6개다. 기존 C01~C03을 보존하고 P01의 C04~C06·사정전/수정전·추가 질문·다음 관람 관계를 병합했다. S1~S3은 기존 세 장면만 허용한다. 사진 촬영일은 모두 미상이며 [파일별 출처·크기·해시](content/content.json)를 보존한다.

### 사진 선정 기준과 교체 후보

이번 프로토타입의 기본 선정 방침은 **국가유산 디지털 서비스·국가유산포털에서 공공누리 제1유형으로 개방된 공식 사진을 우선 사용**하는 것이다. 사진·부분 자료는 [국가유산 디지털 서비스](https://digital.khs.go.kr/)를 우선 검색하고, 설명은 국가유산포털·궁능유적본부 등 관리기관의 해당 대상 원문을 우선 근거로 삼는다. 공식 사진 중 필요한 전체·부분 구도, 해상도, 최근 촬영일을 확인한 후보를 비교한다. 필요한 장면을 확보하지 못하면 아래 외부 사진 후보 또는 직접 촬영 자료로 보완하며, 그 이유와 파일별 이용 조건을 기록한다. 이 방침은 자료 출처의 우선순위이며 특정 사진의 최종 채택이나 검수 완료를 뜻하지 않는다.

가능하면 **촬영일이 확인되는 최근 사진**을 우선한다. 업로드일·페이지 수정일·검색 결과의 게시일을 촬영일로 사용하지 않는다. 촬영일을 모르면 미상으로 기록하며 최신 사진이라고 소개하지 않는다. 최근 사진이라도 대상이 잘리거나 다른 건물이 주로 보이면 해당 과업에 사용하지 않는다. 실제 건물과 부분의 대응, 스마트폰에서의 구별 가능성, 재사용 조건을 함께 확인한다.

사진별 촬영일 또는 미상, 날짜의 근거 URL, 원본 크기, 작성자, 개별 라이선스와 수정 내역을 Asset의 출처 기록에 함께 보관한다. `checkedAt`은 검수일이며 촬영일을 대신하지 않는다. 원본에서 크롭하거나 표식을 합성하면 그 변경과 적용 라이선스도 기록한다.

### 선정한 십장생굴뚝 사진

2026-10-14 사용자 선택에 따라 **한국민족문화대백과사전의 「경복궁 자경전 십장생 굴뚝」 사진**을 사용한다. 사진 자료 선택은 완료했으며 앱 자산 저장·설명 검수·모바일 영역 검사는 별도다.

- 출처 항목: [십장생](https://encykorea.aks.ac.kr/Article/E0034031). 이 항목에 실린 굴뚝 사진을 사용하며 동명의 굴뚝 해설 항목의 다른 대표 사진과 혼동하지 않는다.
- 미디어 ID: `7b8dca9e`. [원본 표시 이미지](https://devin.aks.ac.kr/image/7b8dca9e-6f0d-4a71-8bb8-82baa66160ab?preset=orig)는 브라우저에서 **1200×1194px**임을 확인했다.
- 저작권자: 한국학중앙연구원. 해당 사진의 개별 미디어 정보에서 **공공누리 제1유형**을 확인했다. 촬영일은 미상이며 최근 촬영 사진으로 소개하지 않는다.
- 출처 표기: `[경복궁 자경전 십장생 굴뚝] 한국민족문화대백과사전`과 원문 링크를 표시한다. 한국학중앙연구원·공공누리 제1유형 정보도 함께 제공한다.
- 사용 제안: 원본 전체로 굴뚝과 중앙 문양의 관계를 보여주고, 부분을 선택하면 같은 사진의 해당 영역을 설명과 연결한다. 개별 동식물 명칭·상징은 굴뚝의 해당 부분에 관한 근거로 검수하며, 일반적인 십장생 목록을 그대로 사진 속 정답으로 사용하지 않는다.

이 선택은 앞선 공식 사진 우선 방침을 품질에 맞춰 적용한 결과다. 디지털 서비스 [굴뚝 소개 페이지](https://digital.khs.go.kr/heri/heriDetail.do?ctptUid=13898859671256200462&ctptNo=1121108100000)의 대표 이미지가 **460×247px**이며 확대 화면도 같은 파일을 늘려 표시하는 것을 확인하여 관찰용 이미지에서 제외했다. 별도 기록 파일의 원본 품질까지 낮다고 단정한 것은 아니다. 아래 디지털 서비스의 2010년 굴뚝 전경·상세 자료는 비교 기록과 설명 근거 탐색용으로 남긴다.

### 국가유산 디지털 서비스 확인 자료

[무료 개방 공지](https://digital.khs.go.kr/service/noticeView.do?BBS_UID=13935462819815414975)는 2024년 5월 17일부터 당시 약 48만 건의 원형 디지털 데이터·콘텐츠를 내려받아 활용하도록 무료 개방한다는 안내다. 사진·도면·보고서·영상과 3D 정밀데이터·에셋·테마 콘텐츠를 포함한다. 48만 건은 당시 발표 수치이며 이번에 확보한 자료 수가 아니다. 현재 프로토타입에는 사진과 설명 근거 자료를 사용하고, 3D 뷰어·VR 기능을 추가하는 결정으로 확대하지 않는다.

2026-10-14 브라우저에서 다음 파일별 상세 페이지의 **공공누리 제1유형**, 생산연도, 용량을 확인했다. 정면·전경·굴뚝 상세의 화면 미리보기를 확인했으며, 문살 상세는 메타데이터만 확인했다. 다운로드·원본 픽셀 검사·관찰용 최종 채택은 아직 하지 않았다. 아래 용량은 상세 페이지 표기이며 제공 JPG의 용량이나 원본 해상도를 대신하지 않는다.

| 공식 자료 | 생산연도·용량 표기 | 이번 프로토타입에서의 후보 역할 |
| --- | --- | --- |
| [근정전 정면](https://digital.khs.go.kr/record/recordDetailImg.do?ichDataUid=13923037396327606087&bizId=20230000001&pageSe=bizDetail&bizUid=13921921849344500012&ctptUid=13898859666526200071&ctptNo=1111102230000) | 2008.08 · JPG 4.8 MB | 건물과 앞마당이 함께 보이는 전체 장면 비교 후보. 방문객 포함. 최근 사진으로 소개하지 않음 |
| [근정전 격자 비꽃살문 상세](https://digital.khs.go.kr/record/recordDetailImg.do?ichDataUid=13984763921436204162&bizId=20240000001&pageSe=bizDetail&bizUid=13983502643880499112&ctptUid=13898859666526200071&ctptNo=1111102230000) | 1962 · JPG 5.2 MB | 특정 부분 자료의 명칭·출처 확인 사례. 역사 사진이므로 현재 장면과의 일치 검수 전에는 S2 관찰에 쓰지 않음 |
| [경회루 전경](https://digital.khs.go.kr/record/recordDetailImg.do?ichDataUid=13898236814963363944&bizId=20210000011&pageSe=bizDetail&bizUid=13898748261807900015&ctptUid=13898859666538200072&ctptNo=1111102240000) | 2003.07.17 · 원본 TIF 23.3 MB, 제공 파일명은 JPG | 건물 전체 알아보기 비교 후보. 미리보기는 어두운 구도이며 최근·더 선명한 공식 사진과 비교 필요 |
| [십장생굴뚝 전경](https://digital.khs.go.kr/record/recordDetailImg.do?ichDataUid=13984450620002586984&bizId=20250000287&pageSe=bizDetail&bizUid=13983502660143506920&ctptUid=13898859671256200462&ctptNo=1121108100000) | 2010 · JPG 468.1 KB | 중앙 문양과 주변 벽체가 함께 보이는 장면 후보. 굴뚝 상부·주변 건물 전체를 모두 보여주는 사진은 아님 |
| [십장생굴뚝 상세](https://digital.khs.go.kr/record/recordDetailImg.do?ichDataUid=13984450621052587241&bizId=20250000287&pageSe=bizDetail&bizUid=13983502660143506920&ctptUid=13898859671256200462&ctptNo=1121108100000) | 2010 · JPG 530.8 KB | 중앙 문양의 일부가 크게 보이는 설명·재관찰 보조 후보. 개별 동식물의 명칭·의미는 해당 부분의 해설 근거와 대조 필요 |

디지털 서비스의 **사업연도·DB 구축연도와 사진 생산연도를 분리**한다. 예를 들어 2024년 구축 사업의 문살 상세 사진은 생산연도가 1962이며, 2023년 구축 사업의 근정전 정면은 2008.08이다. 생산연도만 제공하면 그 표기를 보존하고 확인하지 않은 촬영일로 바꾸지 않는다. 사진별 원본 파일명·기록 ID·제공기관·작성자 정보와 출처 링크를 채택 시 Asset에 옮긴다. 작가가 내용란에 언급된 경우 공식 표시와 동일하게 확인하여 기록한다.

### 외부 비교·보완 후보

아래는 2026-10-14에 출처 페이지와 실제 사진을 확인한 **외부 비교·보완 후보**다. 공식 사진과의 비교를 마치거나 앱 자산으로 저장하거나 관찰용 자료로 검수 완료한 상태는 아니다.

| 대상·사진 | 확인된 촬영일 / 원본 크기 | 작성자·파일별 이용 조건 | 활용 제안과 남은 확인 |
| --- | --- | --- | --- |
| [근정전 정면](https://commons.wikimedia.org/wiki/File:Front_view_of_the_Imperial_Throne_Hall_Geunjeongjeon_at_Gyeongbokgung_Palace_with_blue_sky_in_Seoul.jpg) | 2024-06-05 / 6402×3601 | Basile Morin · CC BY-SA 4.0 | 건물 전체·앞마당·바닥·품계석 맥락이 보임. 기존 오래된 정면 사진의 대체 후보. 부분 설명 근거와 모바일 표시 크기 확인 필요 |
| [근정전 가까운 구도](https://commons.wikimedia.org/wiki/File:Gyeongbokgung_Mar_2025_148.jpg) | 2025-03-13 / 4080×3060 | Epicgenius · CC BY-SA 4.0 | 난간·돌 조각·처마의 부분 탐색 보조 후보. 정면 장면과 촬영 위치가 다름. 보이는 조각의 명칭·설명 및 방문객이 포함된 원본의 최종 사용 범위 확인 필요 |
| [경회루 전경](https://commons.wikimedia.org/wiki/File:%EA%B2%BD%EB%B3%B5%EA%B6%81%EA%B2%BD%ED%9A%8C%EB%A3%A8.jpg) | 2024-11-28 / 4176×2784 | 신재미 · CC BY 4.0 | 연못과 건물 전체가 보여 C01 후보. 눈이 있는 계절 장면이므로 모의 관람에도 같은 사진을 사용하고 현재 날씨로 소개하지 않음 |
| [경회루 눈 없는 전경](https://commons.wikimedia.org/wiki/File:Gyeonghoeru,_Gyeongbokgung,_Seoul_2020-02-01.jpg) | 2020-02-01 / 4032×2268 | Stck w · CC BY-SA 4.0 | 건물·기둥이 더 크게 보이는 비교 후보. 최신 사진으로 소개하지 않음 |
| [십장생굴뚝 문양이 보이는 사진](https://commons.wikimedia.org/wiki/File:%EA%B2%BD%EB%B3%B5%EA%B6%81_%EC%9E%90%EA%B2%BD%EC%A0%84_%EC%8B%AD%EC%9E%A5%EC%83%9D%EA%B5%B4%EB%9A%9D%28%EA%B6%81%EB%8A%A5%EC%9C%A0%EC%A0%81%EB%B3%B8%EB%B6%80%29-min.jpg) | 미상 / 2000×1125 | 궁능유적본부 · Commons 파일 페이지에 공공누리 제1유형 표시 | 중앙 문양이 보여 C03 설명·재관찰 후보. 2025-04-09는 Commons 업로드일. 원 기관의 해당 이미지 이용 조건과 촬영일은 추가 확인 필요. 구조물 전체 맥락에는 전경 사진을 별도로 비교 |

CC 사진은 파일별 작성자·원본·라이선스 링크와 수정 여부를 표시한다. [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.ko)의 변경한 사진 배포 조건도 지킨다. 굴뚝 사진의 공공누리 표시는 재게시본에서 확인했으므로 원 기관의 해당 파일 조건까지 대조한 후 채택한다. [공공누리 제1유형 안내](https://www.kogl.or.kr/info/licenseType1.do)는 유형 설명이며 해당 이미지에 대한 확인을 대신하지 않는다.

최종 자료 선택 전에는 예쁜 사진이라는 이유로 작은 문양의 가시성이나 설명 대상의 일치를 가정하지 않는다. 현장 방문 후 직접 촬영한 사진을 확보하면 같은 검수 기준으로 교체할 수 있으며, 사진을 바꿀 때 해당 영역 좌표와 관찰 자료도 함께 갱신한다.

### 콘텐츠 검수 순서

1. 문화유산 관리기관·공공기관 등 신뢰할 수 있는 원문에서 **특정 대상의 특정 주장**을 확인한다. 자료의 최신 주소와 접근 여부를 확인한다.
2. 사진의 촬영 위치와 표시한 부분이 설명 대상과 같은지 확인한다. 일반적인 문양 설명을 특정 건물 장식의 의미로 오인하지 않는다.
3. 사진의 저장·수정·크롭·공개 사용 가능 조건과 attribution을 확인한다. 열람 가능하다는 이유만으로 다운로드·배포 가능으로 판단하지 않는다.
4. 원문 장문 복사 대신 근거에 맞는 짧은 설명을 작성하고 claimNote에 사실별 근거를 연결한다. 추정·해석은 그 성격을 표시한다.
5. 검수한 사람 또는 AI의 확인 범위와 날짜를 작업 기록에 남긴다. 공개 자료에 참여자 이름을 넣지 않는다.
6. 사실·대상·출처의 검수가 끝나면 reviewed로 바꾼다. 화면의 영역 크기·구별 가능성·카드와 설명의 대응은 P06 화면 확인과 P07 실기기 검사에서 별도 증거로 남긴다.

자료 확보에 실패한 C02는 P03의 합성 개발 fixture까지는 막지 않지만 S2 관찰 시작을 막는다. 합성 fixture는 `개발용 예시` 표시와 별도 preset으로 관리하고 문화유산 사실·사용자 관찰 성공 증거로 쓰지 않는다.

## 4. 부분 선택 좌표

사진은 잘리지 않는 `contain` 방식으로 보여준다. 영역은 화면 전체나 컨테이너 비율이 아니라 **원본 이미지 비율**로 저장한다.

원본 크기 W×H, 표시 컨테이너 Cw×Ch이면:

```text
scale = min(Cw / W, Ch / H)
renderW = W * scale; renderH = H * scale
offsetX = (Cw - renderW) / 2; offsetY = (Ch - renderH) / 2
nx = (pointerX - containerLeft - offsetX) / renderW
ny = (pointerY - containerTop  - offsetY) / renderH
```

- nx/ny가 0~1 밖이면 사진 여백이므로 선택하지 않는다.
- 이미지를 불러오기 전이거나 원본 크기가 없으면 좌표 선택을 비활성화하고 대체 경로를 표시한다.
- 지정 영역 내부 여부만 판정한다. 영역 밖을 가까운 곳으로 자동 이동시키지 않는다.
- part 영역의 일치 target ID를 중복 제거해 하나이면 미리보기, 0이면 미지원 부분으로 처리한다. 2~3개가 실제로 모호한 자료는 C가 구현된 버전에서만 사용한다. C를 보류한 버전에서는 중첩을 자료 검사 오류로 처리한다. 3개 초과 중첩은 항상 자료 오류다.
- wholeTarget은 전체 건물 행동으로 명시적으로 선택한다. part 영역 선택과 자동 경쟁시키지 않는다.
- `wholeTargetId=null`인 십장생굴뚝 장면에서는 전체 건물 행동을 표시하지 않는다. 사진에 보이는 중앙 문양·배출구를 부분 대상으로 선택한다.
- 화면 크기·가로세로 변경 때 표시 사각형을 다시 계산한다. 저장 좌표는 바꾸지 않는다. 사진과 overlay가 동일한 변환을 사용한다.
- 이미지 경계·영역 경계, contain 여백, 기기 회전, 작은 화면을 기능 검사에 포함한다. 키보드 사용자는 동일 target ID를 텍스트 목록에서 선택한다.

## 5. 메모리 상태와 불변 조건

필요한 상태: presetId, sceneId, contextKey, screen, selection(좌표·region 후보·선택 target), selectedQuestionId, answerId, entryOrigin, 화면 이동 기록. 자유 질문 대안은 이번 기본 범위에 포함하지 않으며 그 상태를 미리 추가하지 않는다.

1. A의 targetId와 answer.targetId가 항상 같다. question을 골랐다면 question.targetId와 answer.questionId도 일치해야 한다.
2. scene이 바뀌면 이전 선택·질문·답변이 남지 않는다.
3. target이 바뀌면 이전 질문·답변이 남지 않는다.
4. 이름·설명·출처·강조 영역은 동일한 선택 상태에서 계산한다. 각 화면에 따로 복사해 서로 어긋나게 하지 않는다.
5. 홈 카드의 scene/target/question/answer는 검증된 연결이어야 한다. `card.sceneId === state.sceneId`와 현재 맥락을 함께 검사한다. 장면 이동은 preset.navigationScenes에서 scene/context/card를 함께 읽고 이전 선택·비교 상태를 비운다.
6. 사용자 입력이나 URL에서 주어진 ID를 그대로 신뢰하지 않는다. 검증된 자료에 없는 ID는 안전한 오류·초기 상태로 보낸다.
7. 준비된 내용의 부재와 프로그램의 자료 오류를 구분한다. 전자는 E의 지원 한계, 후자는 검사 실패와 복구 가능한 오류다.
8. 새로고침은 개인정보나 질문 이력을 복구하지 않는다. 앱은 localStorage·계정·외부 분석 도구를 사용하지 않는다.
9. 홈은 같은 실행의 현재 장면으로 이동한다. N은 출발 설명을 유지하고 다른 허용 장면을 고르면 V로 이동한다. 새 탐색에 표시하지 않는 참고 장면도 허용 이력 목록과 구분한다.
10. 정상 뒤로/앞으로는 runId와 허용 장면·맥락·카드·화면별 대상/질문/답변을 검사한 뒤 복원한다. 잘못된 snapshot은 시작 H로 교체한다. 스크롤·확대·내부 스크롤·포커스는 각 browser history 항목의 UI snapshot으로 복원한다. 진행자 초기화/새로고침은 새 runId다.

## 6. 입력 → 처리 → 저장 → 표시

```text
테스트 preset 선택
  → scene/context 확인 → 메모리에 저장 → H
사진의 위치/전체/텍스트 대안 선택
  → 지원 영역 조회 → selection 갱신 → 미리보기 또는 C
대상 확인
  → overviewAnswer 참조 검증 → target/answer 갱신 → A
준비된 질문 선택
  → target/question/answer 참조 검증 → question/answer 갱신 → A
호기심 카드 선택
  → 카드 연결 검증 → scene/target/question/answer 갱신 → A
```

영구 저장과 API 응답 단계는 없다. 이미지·정적 파일을 제공하는 개발/정적 서버와 질문을 처리하는 서비스는 구분한다. 배포한다면 외부 출처 클릭 및 호스팅 접속 기록은 해당 서비스의 동작이며, 앱에서 질문·위치·관찰 내용을 수집하지 않는다.

## 7. 실행과 전달 경계

- 같은 PC의 데스크톱 브라우저에서 먼저 확인한다. 스마트폰 접근은 승인된 LAN 개발 서버 또는 정적 호스팅을 사용하며 실제 접근 방법은 구현 시 검증한다.
- 사용자에게 링크를 전달하는 것과 인터넷에 공개 배포하는 것은 별도 작업이다. 배포 환경·접근 권한을 정하기 전 임의 서비스에 게시하지 않는다.
- P07의 실행 안내는 실제로 작동한 명령, 설치한 버전, LAN/공개 여부, 기기 조건을 명시한다. 원격 동기화·오프라인 설치·PWA는 추가하지 않는다.
- 정식 앱 구현으로 넘어갈 때 이 구조를 그대로 확장해야 하는 것은 아니다. 프로토타입에서 검증한 UX 요구와 콘텐츠 계약을 재사용할지 따로 판단한다.
