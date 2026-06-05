# 좌측 악보 작업대 설계

## 배경

콘티 곡 편집 drawer는 이미 wide 모드에서 좌측 큰 악보 미리보기와 우측 편집 폼으로 나뉜다. 현재 악보 업로드, 썸네일 갤러리, PDF 포함 선택 UI는 우측 편집 폼 하단에 남아 있다.

사용자는 좌측 영역을 단순 preview가 아니라 악보 관련 작업 전체를 다루는 공간으로 쓰는 A안을 선택했다.

## 목표

- 좌측 패널을 `악보 작업대`로 만든다.
- 좌측에 큰 미리보기, 업로드 드래그앤드롭, 썸네일 갤러리, PDF 포함 선택 UI를 배치한다.
- 우측 편집 폼은 곡 정보, 프리셋, 키/템포, 섹션/가사/메모, 프리셋 저장에 집중한다.
- 기존 악보 preview modal 회귀는 만들지 않는다.
- 모바일에서는 좌우 분할을 쓰지 않고 기존 본문 흐름 안에서 악보 작업대를 표시한다.

## 비목표

- 악보 업로드 서버 액션, 파일 저장 방식, PDF 렌더링 방식을 바꾸지 않는다.
- SheetMusicSelector의 선택 의미를 바꾸지 않는다. `null`은 전체 포함, 빈 배열은 저장 차단 대상이라는 현재 규칙을 유지한다.
- Preset 모드의 PDF 편집 흐름은 이번 변경 범위에 포함하지 않는다.
- Drawer를 완전한 focus trap dialog primitive로 재작성하지 않는다.

## UX 설계

### 데스크톱

wide drawer는 두 열을 유지한다.

좌측 `악보 작업대`:

1. 상단 제목: `악보`
2. 보조 문구: `PDF 내보내기에 포함할 악보를 선택하세요.`
3. 큰 `SheetMusicPreviewPane`
4. 업로드 드래그앤드롭 영역
5. 악보 썸네일 갤러리
6. PDF 포함 선택 UI

우측 `곡 편집`:

1. 곡명
2. 프리셋 불러오기
3. YouTube 레퍼런스
4. 키/템포/섹션/가사/메모 편집
5. 프리셋 저장

좌측은 sticky 패널로 유지하되 내부가 길어질 수 있으므로 좌측 패널 자체에 세로 스크롤을 허용한다. 큰 미리보기는 가장 중요한 요소이므로 업로드/선택 UI가 있어도 가능한 한 충분한 높이를 유지한다.

### 모바일

모바일은 좌측 열이 없으므로 현재처럼 편집 본문 안에 악보 작업대를 렌더링한다. 순서는 다음과 같다.

1. 악보 제목/설명
2. 큰 미리보기
3. 업로드
4. 썸네일 갤러리
5. PDF 포함 선택

## 컴포넌트 설계

### ArrangementEditor

`ArrangementEditor`가 악보 작업대 레이아웃을 소유한다.

새 내부 렌더링 단위:

- `renderSheetMusicWorkspace()`
  - 제목/설명
  - `SheetMusicPreviewPane`
  - `sheetMusicManagementSlot`
  - `SheetMusicSelector`

데스크톱에서는 이 workspace를 좌측 패널에 렌더링한다. 우측 본문에서는 악보 섹션을 제거한다.

모바일에서는 동일 workspace를 우측 본문 흐름의 악보 위치에 렌더링한다.

### ContiSongEditor

현재와 같이 다음 책임을 가진다.

- `SheetMusicUploader`
- `SheetMusicGallery`
- 업로드 후 `songSheetMusic` 갱신
- 삭제 후 `songSheetMusic` 및 preview state 갱신

다만 `sheetMusicManagementSlot`의 외부 wrapper는 좌측 workspace와 중복 card 느낌이 나지 않도록 단순한 `space-y-*` 컨테이너로 낮춘다. 업로드/갤러리 자체의 기능은 유지한다.

### SheetMusicGallery

현재 controlled preview mode를 유지한다.

- 썸네일 hover/focus/click 시 좌측 preview를 갱신한다.
- nested preview dialog는 `previewMode="controlled"`에서 렌더링하지 않는다.
- 삭제 버튼은 hover에 의존해 마운트/언마운트되지 않는다.

## 상태 흐름

1. `ContiSongEditor`가 곡의 악보 목록을 로드한다.
2. `SheetMusicGallery`가 PDF/image preview item을 만든다.
3. controlled mode에서 첫 item 또는 사용자가 선택한 item을 `onPreviewChange`로 부모에 전달한다.
4. `ArrangementEditor` 좌측 workspace가 `sheetMusicPreviewItem`을 받아 큰 preview를 표시한다.
5. `SheetMusicSelector`는 `draft.sheetMusicFileIds`를 갱신하고 저장 규칙은 기존 `save-rules`를 따른다.

## 에러와 빈 상태

- 악보가 없으면 좌측 workspace는 업로드 영역을 중심으로 보여준다.
- preview item이 없으면 `SheetMusicPreviewPane`의 빈 상태 문구를 표시한다.
- PDF preview 실패 시 `previewState="unavailable"` 문구를 표시한다.
- 삭제된 파일이 현재 preview 대상이면 preview state를 `null`로 정리한다.

## 테스트와 검증

소스 회귀 테스트에 다음 조건을 추가한다.

- `ArrangementEditor`에 `renderSheetMusicWorkspace()` 렌더링 함수가 있다.
- 데스크톱 좌측 패널 안에 `sheetMusicManagementSlot`과 `SheetMusicSelector`가 렌더링된다.
- 우측 본문에서 악보 관리 UI가 중복 렌더링되지 않는다.
- 모바일에서는 workspace가 본문 흐름에 렌더링된다.
- `SheetMusicGallery`는 controlled mode에서 nested dialog를 만들지 않는다.

검증 명령:

- `node --experimental-strip-types --test tests/worship-prep-source.test.mjs`
- `pnpm test`
- `pnpm lint`
- `pnpm build`
- Browser QA: 콘티 곡 편집 drawer에서 좌측에 preview, 업로드, 썸네일, 포함 선택이 함께 보이고 썸네일 클릭 시 nested modal이 생기지 않는지 확인한다.
