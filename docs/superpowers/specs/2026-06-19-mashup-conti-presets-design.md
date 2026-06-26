# 매시업 콘티 프리셋 설계

날짜: 2026-06-19
상태: 구현 계획 작성 전 승인된 설계

## 요약

두 곡 매시업 프리셋을 1급 기능으로 추가한다. 매시업 프리셋은 참여하는 두 곡 상세 화면 양쪽에 같은 프리셋으로 보이고, 하나의 악보 선택과 PDF 레이아웃을 공유하며, 콘티에서는 인접한 두 곡에 적용되어 하나의 찬양 순서처럼 동작한다.

선택한 방향은 `song_presets`를 프리셋 본문을 담는 기준 엔티티로 유지하고, `song_preset_songs` 조인 테이블을 추가해 하나의 프리셋이 여러 곡에 연결될 수 있게 하는 것이다. 첫 구현의 UI는 정확히 두 곡 매시업만 지원하지만, 관계 모델은 순서를 가진 구조로 둬서 이후 더 긴 메들리로 확장할 수 있다.

## 배경

현재 모델은 모든 프리셋이 한 곡에 소속된다고 가정한다.

- `song_presets.song_id`는 단일 `songs.id`를 가리킨다.
- `preset_sheet_music`은 프리셋과 악보 파일들을 연결한다.
- `conti_songs.preset_id`는 콘티 곡 한 행에 프리셋 하나를 적용한다.
- PDF export는 현재 `conti.songs` 배열 인덱스로 페이지와 오버레이 번호를 만든다.
- PPT export는 섹션 순서가 있는 각 콘티 곡을 독립적인 `찬양 N` 섹션으로 변환한다.

이 모델은 한 곡 프리셋에는 충분하지만, A곡과 B곡이 라이브러리에 따로 존재하고, 두 곡 상세 화면 모두에서 같은 매시업 프리셋을 보여야 하며, 콘티에서는 하나의 공유 PDF 레이아웃을 써야 하는 실제 매시업 케이스를 표현할 수 없다.

## 목표

- 하나의 프리셋을 참여 곡 두 개에 연결한다.
- 두 곡 상세 화면 모두에서 같은 매시업 프리셋을 보여준다.
- 곡 상세 화면에서 연결할 곡을 검색하거나 새로 만들어 매시업 프리셋을 생성할 수 있게 한다.
- YouTube 재생목록 가져오기 리뷰에서 인접 곡을 매시업으로 연결할 수 있게 한다.
- 기존 콘티 안에서 인접 곡을 매시업으로 연결할 수 있게 한다.
- 매시업 그룹은 콘티 표시, PDF export, PPT export 기본값에서 하나의 순서로 취급한다.
- 매시업 프리셋의 악보 선택과 PDF 메타데이터는 두 곡에 중복 적용하지 않고 한 번만 사용한다.
- 적용된 매시업 그룹은 프리셋 자체를 삭제하지 않고 분리할 수 있게 한다.
- 분리할 때 연결 전 각 곡의 프리셋을 복원할지, 프리셋 없이 분리할지 사용자가 고를 수 있게 한다.
- 매시업 프리셋에 PPT/표시용 커스텀 제목을 둘 수 있게 한다.

## 비목표

- 비인접 콘티 곡 그룹핑은 지원하지 않는다.
- 이번 단계에서는 세 곡 이상 메들리 UI를 만들지 않는다.
- 콘티 매시업 그룹을 분리할 때 매시업 프리셋 엔티티를 자동 삭제하지 않는다.
- 매시업 전용 제어를 추가하는 범위를 넘어 arrangement editor 전체를 크게 재설계하지 않는다.
- `song_presets.song_id`를 즉시 제거하는 마이그레이션은 하지 않는다. 이번 단계에서는 호환성을 위해 남긴다.

## 선택한 접근

`song_presets`는 프리셋 기준 엔티티로 유지하고, 프리셋과 곡의 소유 관계를 나타내는 조인 테이블을 추가한다.

검토한 대안은 다음과 같다.

- `song_presets.song_id`를 JSON `song_ids`로 바꾸는 방식은 스키마 변경이 작아 보이지만 FK 검증, cascade 동작, 곡별 프리셋 조회를 잃는다.
- A곡 프리셋과 B곡 프리셋을 따로 두고 `mashupGroupId`로 묶는 방식은 현재의 한 곡 소유 모델을 유지하지만, 두 레코드가 서로 어긋날 수 있고 PDF 레이아웃을 진짜로 공유한다는 요구와 맞지 않는다.

조인 테이블 방식은 하나의 공유 프리셋 본문을 유지하면서 관계 무결성과 양쪽 곡에서의 직접 조회를 보장한다.

## 데이터 모델

### 프리셋 소유 관계

`song_preset_songs`를 추가한다.

- `id`
- `preset_id`: `song_presets.id` 참조, 프리셋 삭제 시 cascade
- `song_id`: `songs.id` 참조, 곡 삭제 시 cascade
- `sort_order`: 프리셋 안에서 곡의 순서
- `part_label`: nullable. 첫 구현에서는 `null`로 두고 이후 파트 라벨용으로 예약한다.

유니크 제약:

- `(preset_id, song_id)`: 같은 프리셋에 같은 곡이 중복 연결되지 않게 한다.
- `(preset_id, sort_order)`: 프리셋 안의 곡 순서가 모호해지지 않게 한다.

기존 모든 프리셋은 현재 `song_presets.song_id`를 사용해 `song_preset_songs`에 `sort_order = 0` 행 하나를 백필한다.

이번 단계에서는 `song_presets.song_id`를 legacy primary song 필드로 유지한다. 새 코드는 `song_preset_songs`를 기준으로 동작하고, legacy 코드는 `song_id`를 첫 번째 연결 곡으로 취급할 수 있다. legacy 컬럼 제거는 명시적으로 이번 범위 밖이다.

### 프리셋 타입과 제목

`song_presets`에 다음 필드를 추가한다.

- `preset_type`: `single` 또는 `mashup`, 기본값 `single`
- `display_title`: nullable text

이번 단계에서 매시업 프리셋은 정확히 두 곡과 연결되어야 한다. 기본 표시/PPT 제목은 첫 번째 연결 곡 이름이다. `display_title`이 있으면 콘티 그룹 제목과 PPT 제목에 사용한다.

### 콘티 매시업 적용

`conti_songs`에 다음 필드를 추가한다.

- `mashup_group_id`: 두 묶음 행이 공유하는 nullable text
- `mashup_part_order`: nullable integer. 앞 곡은 `0`, 뒤 곡은 `1`
- `pre_mashup_preset_id`: 분리 시 복원을 위해 연결 전 프리셋을 저장하는 nullable preset reference

인접한 두 콘티 행을 연결할 때:

- 하나의 `mashup_group_id`를 생성한다.
- 두 행의 `preset_id`를 공유 매시업 프리셋으로 설정한다.
- 현재 행 순서에 맞춰 `mashup_part_order`를 설정한다.
- 각 행의 기존 `preset_id`를 `pre_mashup_preset_id`에 저장한다.

매시업을 분리할 때:

- 두 행을 변경하기 전에 저장된 `pre_mashup_preset_id` 값을 읽는다.
- 사용자에게 confirm을 띄우고 “원래 프리셋 복원”과 “프리셋 없이 분리” 중 하나를 선택하게 한다.
- 복원을 선택하면 각 행의 `preset_id`를 저장해둔 `pre_mashup_preset_id`로 되돌린다.
- 프리셋 없이 분리하면 두 행의 `preset_id`를 `null`로 둔다.
- 새 `preset_id` 값을 결정한 뒤 `mashup_group_id`, `mashup_part_order`, `pre_mashup_preset_id`를 항상 비운다.
- 매시업 프리셋 자체는 삭제하지 않는다.

## UX

### 찬양 라이브러리

곡 상세 화면에 “매시업 프리셋 추가” 액션을 추가한다.

흐름:

1. 연결할 곡을 검색한다.
2. 연결할 곡이 없으면 인라인으로 새 곡을 만든다.
3. 현재 곡이 앞 곡인지 뒤 곡인지 선택한다.
4. 두 곡을 해당 순서로 연결한 매시업 프리셋을 만든다.
5. 공유 arrangement editor를 열어 key, tempo, section order, lyrics, sheet music, PDF metadata, notes, YouTube reference, `display_title`을 편집한다.

두 곡 상세 화면 모두 같은 프리셋을 “매시업” 라벨과 함께 보여준다. 어느 쪽에서 편집하든 같은 프리셋을 편집한다.

### YouTube 재생목록 가져오기

재생목록 리뷰 단계에서 인접한 import item 사이에 매시업 버튼을 보여준다.

버튼을 누르면:

- 두 항목을 기존 곡으로 resolve하거나, 프리셋 검색/적용 전에 새 곡 생성을 stage한다.
- 두 곡 순서와 일치하는 `preset_type = mashup` 프리셋을 검색한다.
- 매칭 프리셋이 있으면 선택하게 한다.
- 없으면 해당 곡 쌍의 빈 매시업 프리셋을 만들 수 있게 한다.
- 두 리뷰 항목을 연결된 상태로 표시해, 생성된 콘티에 공유 프리셋과 그룹 메타데이터가 적용되게 한다.

기존 중복 감지는 유지한다. 제외된 리뷰 항목은 매시업에 포함될 수 없다.

### 콘티 상세와 편집

그룹에 속하지 않은 인접 곡 사이에 연결 affordance를 보여준다. 클릭하면 두 곡 순서에 맞는 매시업 프리셋을 검색한다. 있으면 적용하고, 없으면 빈 매시업 프리셋 생성을 제안한다.

그룹 행은 시각적으로 두꺼운 하나의 매시업 row처럼 렌더링한다.

- 그룹은 하나의 표시 순번을 차지한다.
- row에는 “매시업” 라벨과 그룹 제목을 보여준다.
- 앞 곡과 뒤 곡은 row 안에 계속 표시한다.
- 내부 곡 사이에 강조된 “이어지는 매시업 프리셋” 스트립을 둔다.
- 이 스트립을 클릭하면 분리 confirm dialog를 연다.

분리 dialog는 “원래 프리셋 복원”과 “프리셋 없이 분리”를 제공한다.

## 파생 arrangement item

표시와 export를 위한 파생 view model을 도입한다.

- 단일 item: 콘티 곡 하나
- 매시업 item: 같은 `mashup_group_id`를 가진 두 콘티 곡. `mashup_part_order`로 정렬한다.

이 view model은 안정적인 item key를 가져야 한다.

- 단일: `conti-song:<contiSongId>`
- 매시업: `mashup:<mashupGroupId>`

raw 행이 필요한 기존 컴포넌트는 계속 `conti.songs`를 사용할 수 있다. 표시 순서가 중요한 UI table, PDF export, PPT export는 파생 arrangement item을 사용한다.

## Export 동작

### PDF

PDF export/editor는 매시업 item을 하나의 순서 item으로 취급한다.

- 공유 매시업 프리셋의 선택 악보를 사용한다.
- 공유 매시업 프리셋의 `pdfMetadata`를 사용한다.
- 해당 페이지 세트를 한 번만 생성한다.
- 오버레이 곡 번호는 표시 arrangement item 인덱스를 사용한다.
- 콘티 layout에서 PDF metadata를 동기화할 때 공유 매시업 프리셋에 다시 저장한다.

PDF editor는 가능하면 안정적인 arrangement item key로 저장된 layout을 resolve한다. 기존 index 기반 `songIndex`는 backward compatibility를 위해 남길 수 있지만, 새 매시업 동작은 “표시 순서 item 하나 = raw `conti_songs` index 하나”라고 가정하지 않아야 한다.

### PPT

기본 PPT export는 매시업 item을 하나의 찬양 섹션으로 합친다.

- 섹션 이름은 기존처럼 `찬양 N`으로 생성한다.
- 곡 제목은 `display_title`이 있으면 그것을 사용한다.
- `display_title`이 없으면 첫 번째 연결 곡 이름을 사용한다.
- section order, lyrics, section-lyrics map은 공유 매시업 프리셋의 arrangement 데이터를 사용한다.

PPT export UI에는 “매시업 분리 내보내기” 옵션을 제공한다. 이 옵션을 켜면 매시업 그룹을 기존 per-row 방식처럼 별도 곡 섹션으로 내보낸다.

## 검증과 에러 처리

- 이번 단계에서 매시업 생성은 정확히 두 곡 연결을 요구한다.
- 콘티 연결은 인접하고 그룹에 속하지 않은 두 행에만 허용한다.
- 이미 매시업 그룹에 속한 행은 먼저 분리해야 다른 행과 연결할 수 있다.
- 매시업 프리셋 매칭은 `preset_type = mashup`과 같은 ordered song pair를 기준으로 한다.
- 선택한 매시업 프리셋의 연결 곡이 두 콘티 행과 맞지 않으면 적용을 막고 toast를 보여준다.
- 연결된 악보가 더 이상 존재하지 않으면 기존 악보 empty state를 보여주고, 수정 전까지 PDF 생성을 막는다.
- 분리 복원 대상 프리셋이 삭제되어 있으면 존재하는 것만 복원하고 누락된 참조는 비운다.
- mutation 실패는 기존 server action result/toast 패턴을 따른다.

## 테스트와 검증

집중 테스트 범위:

- 기존 `song_presets.song_id`에서 `song_preset_songs` 백필
- `song_preset_songs`를 통한 곡별 프리셋 조회
- 현재 곡이 앞/뒤인 매시업 프리셋 생성
- ordered song pair로 매시업 프리셋 검색
- 인접한 콘티 행에 매시업 적용
- 비인접 행 또는 이미 그룹에 속한 행 연결 거부
- 이전 프리셋 복원 방식으로 분리
- 프리셋 clear 방식으로 분리
- 파생 arrangement item view model 렌더링
- PDF export/editor가 매시업 그룹에 대해 페이지 세트를 한 번만 생성
- PPT export가 기본값으로 매시업을 합쳐 내보냄
- PPT export의 분리 옵션
- YouTube import review에서 인접 항목 연결 및 공유 프리셋 생성/적용

구현 검증 명령:

- `pnpm lint`
- repository helper, view-model helper, PDF/PPT helper, import-state behavior 대상 Vitest 테스트

## 구현 메모

기존 패턴을 유지한다.

- Server action은 계속 `{ success, error, data }`를 반환한다.
- Repository interface에 명시적인 매시업 프리셋/콘티 그룹 메서드를 추가한다.
- Neon과 Turso schema/migration은 동기화한다.
- arrangement 데이터에는 기존 JSON text column을 계속 사용할 수 있지만, 관계 데이터는 relational table로 둔다.
- 기존 arrangement editor를 복제하지 말고 확장한다.
