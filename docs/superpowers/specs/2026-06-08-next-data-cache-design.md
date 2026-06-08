# Next 데이터 캐시 설계

날짜: 2026-06-08

## 요약

메뉴 이동 시 `songs`, `contis`, `worship-prep` 데이터가 매번 다시 로딩되는 체감을 줄이기 위해 Next 서버 데이터 캐시를 도입한다.

이번 설계의 원칙은 다음과 같다.

- 앱 내부에서 수정한 데이터는 저장 직후 바로 최신 상태로 보여야 한다.
- Apollo Client 같은 별도 클라이언트 캐시를 도입하지 않는다.
- 현재 React Server Components, Server Actions, repository provider 경계를 유지한다.
- Neon/Turso provider 선택과 Turso/R2 migration 구조는 건드리지 않는다.
- Google Sheets 기반 `worship-prep`는 외부 직접 수정 가능성을 고려해 DB 데이터보다 짧은 캐시 수명을 둔다.

## 현재 문제

인증 라우트 그룹의 layout에 `export const dynamic = "force-dynamic"`이 설정되어 있어 인증 영역 전체가 요청마다 동적으로 렌더링된다.

주요 메뉴 페이지는 서버 컴포넌트에서 데이터를 직접 기다린다.

- `/songs`: `getSongs()`
- `/contis`: `getContisWithSongSummaries()`
- `/worship-prep`: `getWorshipPrepDetail()`, `getContiByDate()`, `getContis()`, 선택된 날짜에 연결된 콘티가 있을 때 `getConti()`

`lib/queries/*` 함수들은 repository 호출만 위임하고 캐시를 적용하지 않는다. 그 결과 메뉴를 오갈 때 같은 목록이나 상세 데이터가 반복 조회된다. 특히 `worship-prep`는 Google access token 생성과 Sheets API fetch 경로까지 반복될 수 있다.

## 목표

1. 메뉴 이동 시 이미 조회한 데이터의 재사용률을 높인다.
2. 앱 내부 mutation 이후에는 본인 화면에서 즉시 최신 데이터가 보이게 한다.
3. 캐시 책임을 query 계층에 집중시켜 repository provider 구현을 오염시키지 않는다.
4. 캐시 무효화 규칙을 명시적으로 관리해 stale 데이터 위험을 줄인다.
5. 기존 `revalidatePath` 기반 화면 갱신 동작은 초기 도입 단계에서 유지한다.

## 비목표

- Apollo Client, React Query, SWR 같은 클라이언트 데이터 캐시 도입.
- DB schema 변경.
- repository provider의 Neon/Turso 쿼리 로직 재작성.
- Google Sheets 외부 수정 사항을 실시간 감지하는 webhook 또는 polling 시스템.
- 모든 route를 정적으로 바꾸는 대규모 rendering strategy 변경.

## 권장 접근

Next 16의 Cache Components 기반 데이터 캐시를 사용한다.

`next.config.ts`에 `cacheComponents: true`를 활성화하고, 서버 query 함수에는 `'use cache'`, `cacheTag`, `cacheLife`를 적용한다. 캐시 적용 지점은 repository 위의 query 계층이다.

데이터 흐름은 다음과 같다.

```text
Page Server Component
  -> lib/queries/*
  -> cached query wrapper
  -> getStoryboardRepository()
  -> Neon 또는 Turso repository
```

이 구조는 현재 provider boundary를 유지한다. Turso migration 검증, Neon fallback, storage provider와도 직접 충돌하지 않는다.

## 모듈 구조

새 캐시 유틸리티는 작게 분리한다.

- `lib/cache/tags.ts`
  - tag 문자열을 생성하는 단일 출처.
  - 예: `cacheTags.songs()`, `cacheTags.song(id)`, `cacheTags.conti(id)`.
- `lib/cache/invalidation.ts`
  - Server Action에서 호출할 무효화 helper.
  - 예: `invalidateSong(id)`, `invalidateConti(id)`, `invalidateWorshipPrepDate(date)`.
- `lib/queries/songs.ts`
  - 곡 목록, 곡 상세, 프리셋 query 캐시 적용.
- `lib/queries/contis.ts`
  - 콘티 목록, 날짜 조회, 상세, export query 캐시 적용.
- `lib/queries/worship-prep.ts`
  - Google Sheets 기반 예배 준비 query 캐시 적용.

repository 파일에는 캐시 API를 넣지 않는다. repository는 계속 “원본 데이터를 읽고 쓰는 provider 구현” 역할만 가진다.

## 태그 정책

목록 태그와 상세 태그를 함께 사용한다.

```text
songs
song:{id}
song-presets:{songId}
contis
conti:{id}
conti-by-date:{date}
worship-prep:{date}
worship-prep-list
```

### 곡 태그

`songs`는 곡 목록, 곡 검색, 콘티 상세의 곡 선택 목록에 사용한다.

`song:{id}`는 곡 상세, 악보, 프리셋을 포함한 곡 단위 데이터를 나타낸다.

`song-presets:{songId}`는 프리셋 lazy load 또는 action 경로가 독립적으로 프리셋 목록을 읽을 때 사용한다.

### 콘티 태그

`contis`는 콘티 목록과 예배 준비에서 쓰는 전체 콘티 목록에 사용한다.

`conti:{id}`는 콘티 상세, 편집, export 관련 상세 데이터에 사용한다.

`conti-by-date:{date}`는 예배 준비에서 날짜로 콘티를 찾는 query에 사용한다.

### 예배 준비 태그

`worship-prep:{date}`는 Google Sheets의 특정 예배 날짜 row에 사용한다.

`worship-prep-list`는 최근 예배 준비 목록 query가 사용될 경우 적용한다.

## 무효화 정책

앱 내부 수정은 즉시 반영되어야 한다. 따라서 Server Action은 mutation 성공 후 관련 cache tag를 즉시 무효화한다.

기존 `revalidatePath`는 초기 도입 단계에서 유지한다. 이는 현재 client component의 `router.refresh()`와 path 기반 갱신 흐름을 갑자기 바꾸지 않기 위한 호환 장치다. 새로 추가하는 핵심은 tag 기반 무효화다.

### 곡 action

곡 생성:

- `songs`

곡 수정:

- `songs`
- `song:{id}`
- `contis`

곡명은 콘티 summary에 노출될 수 있으므로 곡 수정은 `contis`도 무효화한다.

곡 삭제:

- `songs`
- `song:{id}`
- `contis`

### 악보 action

악보 업로드, 삭제, 정렬:

- `song:{songId}`

현재 곡 목록은 악보 개수나 대표 악보 정보를 표시하지 않으므로 `songs`는 무효화하지 않는다. 향후 곡 목록에 악보 상태가 노출되면 별도 변경으로 `songs` 무효화를 추가한다.

### 프리셋 action

프리셋 생성, 수정, 삭제, 기본 프리셋 변경:

- `song:{songId}`
- `song-presets:{songId}`
- `contis`

프리셋명, YouTube reference, 적용 프리셋 정보가 콘티 summary에 보일 수 있으므로 `contis`를 무효화한다.

### 콘티 action

콘티 생성:

- `contis`
- `conti:{id}`
- `conti-by-date:{date}`

콘티 수정:

- `contis`
- `conti:{id}`
- `conti-by-date:{newDate}`
- 날짜가 바뀐 경우 `conti-by-date:{oldDate}`

old date 무효화를 정확히 하려면 action에서 수정 전 콘티를 읽는다. 구현 복잡도를 줄이고 싶다면 `contis`와 새 날짜를 무효화하되, 날짜 변경 케이스에서 기존 날짜 query가 남을 수 있다는 점을 테스트로 잡는다. 권장은 수정 전 값을 읽어 old/new date를 모두 무효화하는 것이다.

콘티 삭제:

- `contis`
- `conti:{id}`
- `conti-by-date:{date}`

삭제 action도 삭제 전 날짜를 알고 있어야 날짜 tag를 정확히 무효화할 수 있다.

### 콘티 곡 action

콘티 곡 추가, 삭제, 수정, 정렬:

- `contis`
- `conti:{contiId}`

현재 일부 action은 `contiSongId`만 받아 `contiId`를 직접 알지 못할 수 있다. 정확한 상세 tag 무효화를 위해 repository 조회 결과에서 `contiId`를 반환하거나, action에서 mutation 전후로 필요한 식별자를 조회한다.

YouTube playlist batch import처럼 새 곡이나 프리셋도 생성할 수 있는 action:

- `contis`
- `conti:{contiId}`
- `songs`
- 생성 또는 수정된 각 `song:{id}`
- 생성 또는 수정된 각 `song-presets:{songId}`

### PDF export action

콘티 PDF export 저장, 삭제:

- `conti:{contiId}`

현재 콘티 목록은 PDF export 상태를 표시하지 않으므로 `contis`는 무효화하지 않는다.

### 예배 준비 action

Discord thread 생성, 댓글 parsing, Google Sheets update처럼 앱 내부에서 예배 준비 데이터를 바꾸는 action:

- `worship-prep:{date}`
- `worship-prep-list`

해당 action이 날짜를 `YYMMDD`로 다루는 경우 ISO date로 변환한 뒤 tag를 무효화한다.

Google Sheets를 앱 밖에서 직접 수정하는 경우 앱은 이벤트를 알 수 없다. 이 경우 짧은 TTL이 보정 장치다.

## 캐시 수명

DB 기반 데이터는 앱 내부 Server Action이 무효화를 담당하므로 긴 수명을 둘 수 있다.

권장 수명:

- `songs`, `song:{id}`, `song-presets:{songId}`: hours
- `contis`, `conti:{id}`, `conti-by-date:{date}`: hours
- `worship-prep:{date}`: 60초
- `worship-prep-list`: 60초

`worship-prep`는 Google Sheets 외부 직접 수정 가능성이 있으므로 DB 데이터보다 짧게 둔다. 60초는 메뉴 이동 중 반복 fetch를 줄이면서도 외부 변경 반영 지연을 작게 유지하는 균형점이다.

## Rendering 설정

인증은 middleware가 담당하고, 인증된 페이지 데이터는 사용자별로 달라지지 않는다. 따라서 인증 route group 전체에 걸린 `force-dynamic`은 제거하는 방향이 맞다.

다만 모든 dynamic flag를 일괄 제거하지 않는다.

- 인증 layout의 전역 `force-dynamic`은 제거한다.
- `worship-prep` page의 dynamic 설정은 캐시 적용 후 다시 평가한다.
- `app/api/assets/sheet-music/[id]/route.ts`처럼 asset proxy가 `no-store`를 의도하는 route는 유지한다.

목표는 “필요한 데이터만 캐시하고 필요한 route만 동적으로 유지”하는 것이다.

## 에러 처리

캐시 계층은 repository 또는 Google Sheets error를 삼키지 않는다.

조회 실패 시 기존처럼 page 또는 action이 실패한다. stale 데이터를 임의로 보여주는 fallback은 이번 범위에 포함하지 않는다. 이유는 사용자가 명시한 기준이 “수정한 것은 바로 반영”이고, stale fallback은 실패 상황에서 오히려 혼란을 만들 수 있기 때문이다.

무효화 helper가 실패하는 경우는 Next cache API 호출 실패로 간주한다. mutation 자체가 성공했는데 무효화가 실패할 가능성은 낮지만, helper를 action 내부에서 호출하므로 예외가 발생하면 action error로 드러나게 둔다.

## 테스트 전략

이 repo에는 source-level guard test 패턴이 이미 많다. 캐시 도입도 우선 source-level test로 구조와 정책을 고정한다.

추가할 테스트:

- `next.config.ts`에 `cacheComponents: true`가 있다.
- 인증 layout에서 전역 `force-dynamic`이 제거된다.
- `lib/queries/songs.ts`가 곡 관련 cache tag를 사용한다.
- `lib/queries/contis.ts`가 콘티 관련 cache tag를 사용한다.
- `lib/queries/worship-prep.ts`가 `worship-prep:{date}` tag와 짧은 cache lifetime을 사용한다.
- 곡, 악보, 프리셋, 콘티, 콘티 곡, worship-prep action이 관련 invalidation helper를 호출한다.
- 날짜 기반 콘티 수정/삭제는 `conti-by-date` 무효화를 다룬다.

검증 명령:

```bash
pnpm lint
pnpm test
pnpm build
```

`pnpm dev`에서는 Next page cache 동작이 production과 다를 수 있으므로, 캐시 directive 자체는 build에서 검증해야 한다.

## 단계별 구현 계획 개요

1. cache tag와 invalidation helper를 만든다.
2. `next.config.ts`에 `cacheComponents: true`를 켠다.
3. `lib/queries/songs.ts`에 곡 query 캐시를 적용한다.
4. `lib/queries/contis.ts`에 콘티 query 캐시를 적용한다.
5. `lib/queries/worship-prep.ts`에 60초 캐시를 적용한다.
6. Server Actions에 invalidation helper 호출을 추가한다.
7. 인증 layout의 전역 `force-dynamic`을 제거하고 필요한 dynamic route만 남긴다.
8. source-level test와 lint/test/build를 실행한다.

## 수용 기준

- `/songs`, `/contis`, `/worship-prep`를 오갈 때 동일 데이터의 반복 조회가 줄어든다.
- 곡을 생성, 수정, 삭제한 뒤 곡 목록과 관련 콘티 summary가 최신 상태를 보여준다.
- 콘티를 생성, 수정, 삭제한 뒤 콘티 목록, 상세, 날짜 기반 예배 준비 연결이 최신 상태를 보여준다.
- 콘티 곡을 수정한 뒤 콘티 상세와 콘티 목록 summary가 최신 상태를 보여준다.
- 앱 내부에서 Google Sheets를 수정하는 action 이후 해당 예배 준비 날짜가 최신 상태를 보여준다.
- Google Sheets 외부 직접 수정은 최대 약 60초 후 반영된다.
- Neon/Turso repository provider 구현에는 캐시 API가 섞이지 않는다.
- 기존 path revalidation 흐름은 초기 도입 단계에서 유지된다.

## 리스크와 완화

### 과소 무효화

tag 범위가 너무 좁으면 오래된 목록이나 summary가 남을 수 있다.

완화: 초기에는 `songs`, `contis` 같은 넓은 목록 tag를 보수적으로 함께 무효화한다. 성능 이득이 충분히 확인되면 일부 무효화 범위를 좁힐 수 있다.

### 과다 무효화

너무 많은 tag를 무효화하면 캐시 이득이 줄어든다.

완화: 이 앱의 데이터 규모와 mutation 빈도를 고려하면 초기에는 정확성 우선이 맞다. 목록 이동 로딩 체감이 줄어드는지만 먼저 확인한다.

### 날짜 변경 케이스

콘티 날짜 수정 시 old date의 `conti-by-date:{oldDate}`가 남을 수 있다.

완화: update/delete action에서 기존 콘티를 먼저 조회해 old date를 확보한다.

### Google Sheets 외부 변경

외부 직접 수정은 앱이 즉시 알 수 없다.

완화: `worship-prep`에 60초 TTL을 둔다. 더 빠른 반영이 필요해지면 수동 refresh 버튼 또는 webhook성 동기화는 별도 설계로 다룬다.

## 구현 시 주의사항

- cache helper는 서버 전용으로 작성하고 client component에서 import하지 않는다.
- tag 문자열은 `lib/cache/tags.ts`에서만 만든다.
- Server Action의 mutation 성공 이후에만 무효화한다.
- `revalidatePath` 제거는 이번 1차 구현의 목표가 아니다.
- `worship-prep`는 DB query와 같은 긴 수명을 쓰지 않는다.
- source-level test는 정책을 너무 세부 구현 문자열에 묶지 않도록 helper 호출과 tag 사용 중심으로 작성한다.
