# 곡 고유 가사 저장 구조 설계

Date: 2026-06-23
Status: Implemented locally against Turso

## 요약

현재 가사는 `song_presets.lyrics`와 `conti_songs.lyrics`에 저장된다. 이 구조는 단일 곡의 가사가 프리셋마다 중복될 수 있고, 매시업 프리셋처럼 여러 곡을 조합하는 기능에서 "곡 고유 가사"와 "프리셋 스냅샷"의 경계가 흐려진다.

새 구조는 `songs.lyrics`를 곡 고유 가사의 canonical source로 추가한다. 기존 `song_presets.lyrics` 컬럼은 유지하지만, 의미를 "프리셋 가사 override 또는 매시업 스냅샷"으로 좁힌다. 단일 프리셋은 기본적으로 `songs.lyrics`를 fallback으로 사용하고, 매시업 프리셋은 생성 시점에 멤버 곡들의 `songs.lyrics`를 곡 순서대로 합쳐 `song_presets.lyrics`에 저장한다.

## 현재 구조

- `songs`에는 가사 컬럼이 없다.
- `song_presets.lyrics`가 찬양 라이브러리 프리셋 가사처럼 쓰인다.
- `conti_songs.lyrics`는 콘티에 곡이 들어간 시점의 가사 복사본 또는 콘티 override로 쓰인다.
- `sectionLyricsMap`은 프리셋 또는 콘티의 섹션 순서가 어떤 가사 페이지를 쓰는지 나타내는 arrangement 데이터다.

## 목표 구조

### Canonical Lyrics

`songs.lyrics`를 추가한다.

- 타입은 기존 패턴과 동일하게 JSON string 배열을 담는 `text` 컬럼이다.
- 기본 의미는 `string[]`이며, 빈 값은 `[]`로 취급한다.
- 단일 곡의 실제 가사 페이지는 이 컬럼을 기준으로 관리한다.

### Preset Lyrics

`song_presets.lyrics`는 유지한다.

- 단일 프리셋에서 비어 있으면 `songs.lyrics`를 fallback으로 노출한다.
- 단일 프리셋에서 값이 있으면 그 값을 우선한다.
- 매시업 프리셋에서는 멤버 곡들의 `songs.lyrics`를 생성 시점에 합친 스냅샷을 저장한다.
- 기존 매시업 프리셋의 `lyrics`는 유지한다. 이미 조합 프리셋의 스냅샷 성격이기 때문이다.

### Conti Lyrics

`conti_songs.lyrics`는 유지한다.

- 콘티에 곡을 적용할 때 현재 resolved lyrics를 복사한다.
- 콘티 안에서 수정된 가사는 콘티 전용 override로 남는다.
- 기존 PDF/PPT export는 계속 `conti_songs` 또는 arrangement item의 resolved lyrics를 사용한다.

## 마이그레이션

### Schema

현재 운영 저장소로 사용하는 Turso/SQLite schema에 `songs.lyrics`를 추가한다. Neon/Postgres는 더 이상 사용하지 않으므로 이번 변경 범위에서 제외한다.

- Turso: `lyrics text`

새 곡 생성 시 `lyrics`는 `[]`로 저장한다.

### 로컬 적용 결과

로컬 환경의 Turso DB에는 `drizzle/turso/0004_song_lyrics.sql`과 동일한 내용을 one-off SQL로 적용했다.

- `songs.lyrics` 컬럼 추가 완료.
- 기존 단일 프리셋 가사 30건을 `songs.lyrics`로 이관.
- 단일 프리셋 `song_presets.lyrics`는 0건으로 비움.
- `songs.lyrics` 미채움 곡은 0건으로 확인.

해소: 기존 테이블은 있지만 Drizzle migration history가 비어 있던 상태를 baseline 처리했다. `__drizzle_migrations`에 0000~0004의 현재 hash/timestamp 5개 row를 채웠고, 이후 `drizzle-kit migrate`가 정상 종료되는 것을 확인했다.

### 데이터 이관

기존 단일 프리셋의 `song_presets.lyrics` 중 비어 있지 않은 값을 해당 곡의 `songs.lyrics`로 옮긴다.

한 곡에 여러 단일 프리셋 가사가 있으면 다음 우선순위를 따른다.

1. `is_default = true`인 단일 프리셋
2. `sort_order`가 가장 빠른 단일 프리셋
3. 그래도 동률이면 DB 조회 순서상 가장 먼저 잡히는 프리셋

이관 후 단일 프리셋의 `song_presets.lyrics`는 `[]`로 비운다.

매시업 프리셋의 `song_presets.lyrics`는 이관하지 않고 유지한다.

## 런타임 동작

### 프리셋 편집

프리셋 에디터의 initial draft는 resolved lyrics를 사용한다.

Resolved lyrics:

1. `preset.lyrics`가 비어 있지 않으면 `preset.lyrics`
2. 아니면 단일 프리셋의 소유 곡 `songs.lyrics`
3. 그래도 없으면 `[]`

단일 프리셋 편집에서 가사를 바꾼 뒤 저장하면, 저장 전에 영향 범위 확인 alert를 띄운다.

- 기본 동작은 `song_presets.lyrics`가 아니라 `songs.lyrics`를 업데이트한다. 이렇게 해야 단일 곡 가사가 프리셋별로 다시 갈라지지 않는다.
- alert는 "가사 변경은 곡 가사로 저장되어 이 곡의 다른 단일 프리셋에도 반영된다"는 사실을 명시한다.
- alert 하단에 `이 프리셋에만 적용` 체크박스를 제공한다.
- 체크하지 않고 확인하면 `songs.lyrics`를 업데이트한다.
- 체크하고 확인하면 현재 프리셋의 `song_presets.lyrics`만 업데이트한다. 이 경우 곡 고유 가사는 바뀌지 않고, 해당 단일 프리셋은 `songs.lyrics` fallback보다 `song_presets.lyrics` override를 우선해서 노출한다.
- 가사를 변경하지 않은 저장은 alert 없이 기존 저장 흐름을 따른다.

매시업 프리셋 편집에서 가사를 저장하면 기존처럼 `song_presets.lyrics`를 업데이트한다. 매시업 가사는 두 곡을 붙인 프리셋 스냅샷이다.

### 매시업 프리셋 생성

매시업 프리셋 생성 시 멤버 곡을 정한 뒤, 멤버 순서대로 각 `songs.lyrics`를 읽어 concat한다.

생성되는 매시업 프리셋의 `song_presets.lyrics`는 concat 결과를 저장한다.

이후 멤버 곡의 `songs.lyrics`가 바뀌어도 기존 매시업 프리셋의 가사는 자동으로 바뀌지 않는다. 매시업 프리셋은 생성 당시의 조합 스냅샷이다.

### 콘티 적용

콘티에 단일 프리셋을 적용할 때는 resolved lyrics를 `conti_songs.lyrics`로 복사한다.

콘티에 매시업 프리셋을 적용할 때는 매시업 프리셋의 `song_presets.lyrics`를 각 arrangement item의 resolved lyrics로 사용한다.

## `sectionLyricsMap` 정책

`sectionLyricsMap`은 `songs`로 옮기지 않는다.

이 값은 곡 자체의 가사라기보다 프리셋 또는 콘티의 섹션 순서가 어떤 가사 페이지를 사용할지 나타내는 arrangement 데이터다. 따라서 `song_presets.section_lyrics_map`과 `conti_songs.section_lyrics_map`에 남긴다.

단일 프리셋이 `songs.lyrics` fallback을 쓰더라도 `sectionLyricsMap`은 해당 프리셋의 값을 유지한다.

## 오류 처리와 엣지 케이스

- JSON parse에 실패한 기존 lyrics 값은 빈 배열로 취급하고 마이그레이션에서 선택하지 않는다.
- 곡에 비어 있지 않은 단일 프리셋 가사가 없으면 `songs.lyrics`는 `[]`로 둔다.
- 마이그레이션 후 단일 프리셋의 `lyrics`는 모두 `[]`가 되어야 한다.
- 기존 매시업 프리셋은 이미 저장된 `lyrics`가 있으면 유지한다.
- 기존 매시업 프리셋의 `lyrics`가 비어 있으면, 런타임 fallback은 멤버 곡들의 `songs.lyrics`를 곡 순서대로 합쳐 보여줄 수 있다.

## 테스트

필수 테스트:

- `songPresetToDraft`가 `preset.lyrics`를 우선하고, 비어 있으면 `songLyrics` fallback을 사용한다.
- 단일 프리셋 저장 시 가사 변경이 `songs.lyrics` 업데이트 경로로 간다.
- 단일 프리셋 저장 시 alert의 `이 프리셋에만 적용`을 선택하면 `song_presets.lyrics`만 업데이트한다.
- 단일 프리셋 저장 시 가사를 바꾸지 않았으면 영향 범위 alert를 띄우지 않는다.
- 매시업 프리셋 저장 시 영향 범위 alert를 띄우지 않고 기존처럼 `song_presets.lyrics`를 업데이트한다.
- 매시업 프리셋 생성 시 멤버 곡의 `songs.lyrics`가 순서대로 합쳐져 `song_presets.lyrics`에 저장된다.
- 마이그레이션 SQL 또는 마이그레이션 스크립트가 단일 프리셋 가사를 `songs.lyrics`로 옮기고 단일 프리셋 lyrics를 비운다.
- 기존 매시업 프리셋 lyrics는 마이그레이션에서 유지된다.

검증:

- `pnpm vitest run`으로 관련 단위 테스트를 실행한다.
- `pnpm exec tsc --noEmit`
- `pnpm lint`
- 로컬 브라우저에서 단일 프리셋 편집 모달이 `songs.lyrics`를 보여주는지 확인한다.
- 로컬 브라우저에서 매시업 프리셋 생성 후 가사 페이지가 멤버 곡 순서대로 들어가는지 확인한다.

완료 검증:

- `pnpm exec tsc --noEmit`
- `pnpm lint` (기존 warning only)
- `pnpm vitest run tests/preset-lyrics-save-scope-source.test.mjs components/shared/arrangement-editor/save-rules.test.ts lib/utils/song-preset-draft.test.ts`
- `pnpm exec drizzle-kit check --config=drizzle.turso.config.ts`
- 브라우저 smoke: `가사 저장 범위` alert와 `이 프리셋에만 적용` 체크박스 확인, 임시 문구 DB 미저장 확인.
