# 사진 위 흔적 표식

사용자가 제공한 스케치 원형 참고의 형태를 각색해 직접 작성한 고정 SVG다. 외부 아이콘·사진·생성 이미지·새 렌더러를 가져오지 않았다. 원본과 PNG를 함께 관리한다.

- `message`: 14×14dp, 손그림 원 안의 작은 말풍선과 좌하단 꼬리.
- `ring`: 14×14dp, 한 자릿수 겹침 개수용 테두리.
- `group-wide`: 20×14dp, 두 자릿수가 자연폭으로 읽히는 넓은 테두리. 개수는 PNG에 넣지 않고 React Native Text로 표시한다.
- `selected`: 14×14dp, 같은 원과 지름 3.2dp 중앙 착지점.

먹선은 `#292929`, 주 획 .95dp, 흰 아래받침 1.8dp, 우하단 그림자는 약 .65dp다. 단일 표식과 선택점의 기준 중심은 (7,7), 넓은 그룹은 (10,7)이다. 자산 자체가 추가 위치 보정이나 좌표 clamp를 하지 않는다. 48dp 터치·포커스·접근성 이름은 SceneScreen이 소유한다.

기존 PyMuPDF와 fontTools가 설치된 환경에서 저장소 루트 기준 다음으로 재현한다.

```powershell
python mobile/assets/trace-markers/render.py
```

PNG는 투명 RGBA이며 1×·2×·3×에서 각각 14/28/42px(넓은 그룹 20/40/60px × 14/28/42px)로 렌더한다. 크기·파일 해시는 `metadata.json`에 생성한다. 8× 검사에서 외곽 픽셀이 투명한지도 확인한다.

`.codex-build/trace-marker-preview.svg`와 `.png`는 흰색·중간 회색·어두운 바탕의 원본 크기와 5배 확대 시안이다. 숫자는 기존 SpoqaHanSansRegular.ttf의 glyph outline을 사용한다. 이 미리보기는 원본 도형 렌더이며 실제 Android 글자 배율·텍스트 baseline·GPU 화면 검증은 아니다.
