# 악보 LLM 가사 자동 생성 설계

## 배경

현재 콘티 곡 편집의 `LyricsEditor`는 `악보 OCR` 버튼으로 `OcrRegionSelector`를 열고, 사용자가 직접 선택한 영역 이미지를 Google Cloud Vision OCR에 보내 텍스트를 추출한다. 결과는 한 가사 페이지로 현재 `lyrics` 배열 뒤에 추가된다.

새 기능은 사용자가 영역을 고르지 않아도 악보 이미지 전체를 LLM에 보내 가사 페이지 초안을 자동 생성하는 것이다. 사용자가 Gemini 웹에서 테스트한 결과, PDF를 문서 입력으로 넘길 때는 내장 텍스트와 모델의 일반 지식이 섞여 실제 악보와 다른 가사가 만들어졌고, 같은 PDF를 캡처 이미지로 새 대화에 넣었을 때 실제 보이는 악보 가사에 더 충실했다.

따라서 PDF도 LLM에 `application/pdf`로 넘기지 않고 앱에서 페이지 이미지로 렌더링한 뒤 이미지 배열로 전달한다.

## 목표

- 악보 이미지와 PDF 페이지 이미지에서 가사 초안을 자동 생성한다.
- LLM은 Gemini를 직접 호출한다. 이번 범위에서 provider 추상화는 만들지 않는다.
- PDF 파일은 모든 페이지를 이미지 data URL로 렌더링해서 Gemini에 보낸다.
- 프롬프트는 verse, chorus, bridge 등 곡 구조를 인식하되, 앱에 반영하는 값은 `lyrics: string[]`만 생성한다.
- 생성된 가사는 항상 기존 `lyrics` 배열 뒤에 추가한다.
- 기존 가사를 교체하는 버튼이나 분기는 만들지 않는다.
- 가사 페이지 줄 길이 규칙은 실제 예배 PPT 템플릿 측정값을 반영한다.

## 비목표

- `sectionOrder` 자동 생성은 하지 않는다.
- `sectionLyricsMap` 자동 매핑은 하지 않는다.
- 기존 Google Vision 기반 영역 OCR 기능을 제거하지 않는다.
- 악보 업로드, 파일 저장, PDF export, preset 저장 구조는 바꾸지 않는다.
- OpenAI, Anthropic 등 다른 provider fallback은 이번 범위에 포함하지 않는다.

## Provider 선택

Gemini 전용으로 구현한다.

이유:

- Gemini API는 이미지 입력과 구조화된 JSON 출력을 공식 지원한다.
- 사용자의 실제 테스트에서 악보 PDF를 이미지로 전달했을 때 한글 가사 추출 품질이 좋았다.
- 이번 기능은 provider 교체보다 PDF를 이미지로 강제 변환하고 프롬프트를 단단히 제한하는 것이 더 중요하다.

환경 변수:

- `GEMINI_API_KEY`: 필수
- `GEMINI_LYRICS_MODEL`: 선택. 없으면 `gemini-2.5-pro`를 사용한다.

## UX 설계

`LyricsEditor`의 기존 버튼 영역에 `가사 자동 생성` 버튼을 추가한다.

- 악보 파일이 있을 때만 표시한다.
- 기존 `악보 OCR` 버튼은 유지한다.
- 버튼을 누르면 새 dialog를 연다.
- dialog는 악보 이미지/PDF 페이지를 준비하고 Gemini 생성 요청을 실행한다.
- 생성 결과를 가사 페이지 목록 형태로 미리 보여준다.
- 사용자가 `가사에 추가`를 누르면 `setLyrics(prev => [...prev, ...generatedPages])`만 수행한다.
- 추가 후 dialog를 닫고 toast로 성공을 알린다.

기본 사용 패턴은 가사가 비어 있는 상태에서 자동 생성하는 것이다. 그래도 기존 가사가 있는 경우에도 append만 수행해 사용자가 의도치 않게 기존 편집 내용을 잃지 않게 한다.

## 컴포넌트 설계

### LyricsEditor

책임:

- `SheetMusicLyricsGeneratorDialog` open 상태를 가진다.
- dialog에서 받은 `generatedPages`를 현재 `lyrics` 뒤에 추가한다.
- 기존 `OcrRegionSelector` 흐름은 그대로 유지한다.

### SheetMusicLyricsGeneratorDialog

새 client component로 만든다.

책임:

- `sheetMusicFiles`를 받아 이미지 생성 입력을 준비한다.
- 이미지 파일은 `getSheetMusicAssetUrl(file)`에서 fetch한 blob을 data URL로 변환한다.
- PDF 파일은 기존 `getPdfPageCount`와 PDF 렌더링 흐름을 재사용하되, Gemini 요청용으로 모든 페이지를 압축 이미지 data URL로 렌더링한다.
- Gemini 요청 이미지는 긴 변 기준 최대 1800px, JPEG quality 0.86을 기본으로 한다. 이 기준은 한글 악보 가독성과 서버 액션 payload 크기 사이의 균형값이다.
- 파일명과 페이지 번호를 함께 서버 액션에 전달한다.
- 로딩, 에러, 결과 preview, 추가 버튼 상태를 관리한다.

기존 `OcrRegionSelector`는 선택 영역 OCR에 상태가 많이 묶여 있으므로 확장하지 않고 분리한다.

### Server Action

새 서버 액션 파일을 만든다.

제안 위치:

- `lib/actions/sheet-music-lyrics.ts`

액션:

- `generateLyricsFromSheetMusicImages(input): Promise<ActionResult<{ lyrics: string[] }>>`

입력:

- `songName?: string`
- `pages: { imageDataUrl: string; sourceName: string; pageLabel: string }[]`

검증:

- page 수가 0이면 실패
- data URL 형식이 아니면 실패
- 압축 후 이미지가 페이지당 4MB를 넘으면 실패
- 압축 후 전체 이미지 총량이 20MB를 넘으면 실패
- `GEMINI_API_KEY`가 없으면 실패

출력:

- `lyrics: string[]`

서버 액션은 Gemini 응답을 `zod` 또는 명시적 런타임 검증으로 확인한다. 빈 문자열 페이지는 제거하고, 모든 페이지가 비면 실패 메시지를 반환한다.

## Prompt 설계

핵심 지시:

- 입력 이미지는 악보이다.
- 실제 이미지에 보이는 한글 가사만 추출한다.
- 모델의 기억, 일반 찬양 지식, 검색 결과, 파일명 추론으로 가사를 보충하지 않는다.
- PDF 내장 텍스트가 아니라 이미지에 보이는 가사를 기준으로 판단한다.
- verse, chorus, bridge, outro 등 구조를 먼저 이해한 뒤, 앱의 가사 페이지로 부르기 좋은 줄 단위로 나눈다.
- 반복 기호는 참고하되, 같은 가사를 무리하게 중복 생성하지 않는다.
- key-up 반복처럼 가사가 동일한 경우 중복 페이지를 만들지 않는다.
- 읽기 어려운 글자는 추측하지 말고 자연스러운 최소 추정만 한다.
- 최종 출력은 JSON만 반환한다.

출력 schema:

```json
{
  "lyrics": [
    "첫 번째 가사 페이지",
    "두 번째 가사 페이지"
  ]
}
```

프롬프트는 section label을 앱 데이터에 넣지 않는다. 다만 모델이 verse, chorus, bridge를 구분해서 읽도록 유도하면 중복과 순서 판단이 좋아지므로 내부 reasoning 기준으로만 사용한다.

## 가사 페이지 규칙

현재 `lib/utils/lyrics-validation.ts`는 `text.length >= 25`로 줄 길이 경고를 낸다. 이 기준은 공백을 한글과 같은 폭으로 세기 때문에 실제 PPT 템플릿과 맞지 않는다.

사용자가 제공한 `260531예배.pptx` 기준 측정값:

- 일반 찬양 가사 슬라이드: `Noto Serif KR`, 약 `80pt`
- 텍스트 박스 폭: 약 `25.53in`
- 한글 한 글자 폭: 약 `77pt`
- 공백 한 칸 폭: 약 `21pt`
- 공백은 한글의 약 `0.27배`
- 공백 없는 한글 기준 한 줄 최대: 약 `23자`

새 줄 길이 계산:

```ts
visualLength =
  hangulCount * 1
  + whitespaceCount * 0.3
  + latinOrDigitCount * 0.7
  + otherCount * 1
```

줄 길이 경고:

- `visualLength > 23`

예시:

- `주 사랑해요 온 맘 다하여 말로 다 할 수 없어`
- 공백 포함 26자, 공백 제외 17자
- `visualLength = 17 + 9 * 0.3 = 19.7`
- 경고 없음

줄 수 규칙은 기존 UX를 유지한다. 한 페이지가 3줄 이상이면 경고한다.

LLM 프롬프트에도 각 줄은 `visualLength <= 23`을 목표로 줄바꿈하라고 지시한다.

## 데이터 흐름

1. 사용자가 콘티 곡 편집 drawer에서 `가사 자동 생성`을 누른다.
2. `SheetMusicLyricsGeneratorDialog`가 선택된 악보 파일 목록을 받는다.
3. 이미지 파일은 data URL로 변환한다.
4. PDF 파일은 모든 페이지를 이미지 data URL로 렌더링한다.
5. dialog가 `generateLyricsFromSheetMusicImages` 서버 액션을 호출한다.
6. 서버 액션이 Gemini에 이미지 배열과 prompt를 보낸다.
7. 서버 액션이 structured JSON을 검증하고 `lyrics` 배열을 반환한다.
8. dialog가 결과를 미리 보여준다.
9. 사용자가 `가사에 추가`를 누르면 `LyricsEditor`가 현재 `lyrics` 뒤에 결과를 append한다.
10. 기존 저장 버튼을 누를 때 현재 `ArrangementEditor` 저장 흐름이 그대로 `draft.lyrics`를 저장한다.

## 에러 처리

- API key 누락: `.env.local`에 `GEMINI_API_KEY`가 필요하다는 메시지를 보여준다.
- 악보 없음: 버튼을 표시하지 않는다.
- PDF 렌더링 실패: 실패한 파일명과 페이지를 보여주고 요청을 중단한다.
- 이미지 크기 초과: 페이지당 4MB 또는 전체 20MB 제한을 넘었다는 메시지를 보여준다.
- Gemini 응답 schema 오류: 생성 결과를 해석할 수 없다는 메시지를 보여준다.
- 생성 결과 없음: 이미지에서 가사를 찾지 못했다는 메시지를 보여준다.

## 테스트와 검증

단위 테스트:

- `visualLength` 계산에서 공백은 0.3, 영문/숫자는 0.7로 계산된다.
- `주 사랑해요 온 맘 다하여 말로 다 할 수 없어`는 줄 길이 경고가 없다.
- 공백 없는 한글 24자는 줄 길이 경고가 있다.
- 3줄 이상 페이지는 기존처럼 줄 수 경고가 있다.

소스 회귀 테스트:

- `LyricsEditor`에 `가사 자동 생성` 버튼과 새 dialog가 연결된다.
- 기존 `악보 OCR` 버튼과 `OcrRegionSelector`는 유지된다.
- 자동 생성 결과는 append 흐름만 가진다.
- 교체/overwrite 흐름은 없다.

서버 액션 테스트:

- API key 누락 시 실패 메시지를 반환한다.
- 빈 pages 입력은 실패한다.
- Gemini 응답이 `lyrics: string[]`가 아니면 실패한다.
- 빈 문자열 페이지는 제거된다.

수동 QA:

- 이미지 악보만 있는 곡에서 가사 자동 생성 후 페이지가 append된다.
- PDF 악보가 있는 곡에서 각 PDF 페이지가 이미지로 렌더링되어 요청된다.
- 생성된 줄이 PPT 기준 경고를 과도하게 만들지 않는다.
- 기존 영역 OCR이 계속 동작한다.

검증 명령:

- `node --experimental-strip-types --test tests/worship-prep-source.test.mjs`
- 관련 유틸 테스트
- `pnpm test`
- `pnpm lint`
