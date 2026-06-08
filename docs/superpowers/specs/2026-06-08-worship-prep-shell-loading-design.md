# 예배준비 탭 Shell 로딩 UX 개선 설계

날짜: 2026-06-08

## 요약

예배준비 탭은 데이터 캐시는 적용되어 있지만, 페이지 최상단에서 `searchParams`와 Google Sheets 기반 데이터를 함께 기다리고 route-level `loading.tsx`가 전체 화면 스켈레톤을 보여준다. 그 결과 메뉴 이동 시 캐시 hit가 있어도 “탭 전체가 다시 로딩된다”는 체감이 남는다.

이번 변경은 캐시 정책을 더 강하게 만드는 것이 아니라, Next.js 16 Cache Components 패러다임에 맞게 정적 shell과 request-time 데이터 영역을 분리한다.

## 목표

- `/worship-prep` 진입 시 헤더, 날짜 선택기, 자동화 패널은 즉시 보이게 한다.
- Google Sheets와 콘티 데이터가 필요한 카드 영역만 스켈레톤으로 대기하게 한다.
- PPT export 버튼은 데이터 준비 전에도 헤더에 보이되 disabled 상태로 둔다.
- 기존 `worship-prep` 캐시 TTL과 invalidation 정책은 유지한다.
- `/songs`, `/contis` 캐시 작업에는 영향을 주지 않는다.

## 비목표

- Google Sheets TTL을 늘려 stale 허용 시간을 키우는 것.
- 클라이언트 상태에 이전 예배준비 데이터를 저장해 화면을 직접 유지하는 것.
- 예배준비 데이터를 DB로 복제하거나 Google Sheets 연동 방식을 바꾸는 것.
- 전체 앱 shell, sidebar, 인증 layout을 재설계하는 것.

## 현재 구조와 문제

현재 `app/(authenticated)/worship-prep/page.tsx`는 다음 일을 모두 한 곳에서 처리한다.

- `searchParams`를 읽어 선택 날짜를 결정한다.
- `getWorshipPrepDetail(selectedDate)`로 Google Sheets 데이터를 읽는다.
- `getContiByDate(selectedDate)`, `getContis()`, `getConti(conti.id)`로 콘티 데이터를 읽는다.
- 데이터가 있을 때만 `WorshipPptxExportButton`을 렌더한다.
- 준비 카드도 같은 서버 컴포넌트 반환값 안에서 렌더한다.

`searchParams`는 request-time data이므로 페이지 전체가 정적 shell처럼 재사용되기 어렵다. 또한 `app/(authenticated)/worship-prep/loading.tsx`가 route-level fallback으로 존재해, 메뉴 전환 중 전체 예배준비 화면이 스켈레톤으로 바뀐다.

## 권장 접근

정적 shell과 데이터 패널을 분리한다.

```text
WorshipPrepPage
  -> 즉시 렌더되는 shell
     - PageHeader
     - disabled PPT export button fallback
     - WorshipDateSelector
     - PrepAutomationPanel
  -> Suspense boundary
     fallback: 카드 영역 스켈레톤
     child: WorshipPrepDataPanel
       - searchParams 해석
       - worship-prep / conti query 호출
       - 실제 PPT export button
       - PrepElementCards
```

페이지 최상단은 request-time query 결과를 기다리지 않는다. 데이터가 필요한 영역만 Suspense 아래로 내린다. 이 구조는 “대기가 사라지는 것”이 아니라 “대기가 화면 전체를 덮지 않는 것”을 목표로 한다.

## 컴포넌트 설계

### `WorshipPrepPage`

역할은 화면의 안정적인 shell을 제공하는 것이다.

- `PageHeader`를 즉시 렌더한다.
- 헤더 action에는 disabled 상태의 PPT export 버튼 모양을 둔다.
- `WorshipDateSelector`와 `PrepAutomationPanel`을 즉시 렌더한다.
- 데이터 영역은 `<Suspense fallback={<WorshipPrepCardsSkeleton />}>`로 감싼다.
- `searchParams` Promise는 하위 데이터 컴포넌트에 그대로 전달한다.

### `WorshipPrepDataPanel`

역할은 선택 날짜와 데이터를 해석해 실제 데이터 UI를 렌더하는 것이다.

- `searchParams`에서 `date`를 읽고 `normalizeDate()`로 정규화한다.
- `getWorshipPrepDetail(selectedDate)`, `getContiByDate(selectedDate)`, `getContis()`를 병렬 실행한다.
- 연결된 콘티가 있으면 `getConti(conti.id)`를 추가로 조회한다.
- `WorshipPptxExportButton`과 `PrepElementCards`를 실제 데이터로 렌더한다.
- 데이터가 없으면 기존의 “선택한 주차 데이터가 없습니다” empty state를 유지한다.

### `WorshipPrepHeaderAction`

헤더 action의 loading/ready 상태를 명확히 한다.

- shell 단계에서는 disabled 버튼을 렌더한다.
- 데이터 준비 후 `item`이 있으면 기존 `WorshipPptxExportButton`을 렌더한다.
- 데이터가 없으면 disabled 버튼 또는 빈 상태 중 하나를 사용한다. 이번 설계에서는 사용자가 명시한 방향에 맞춰 disabled 버튼을 유지한다.

### `WorshipPrepCardsSkeleton`

카드 영역 전용 fallback이다.

- 전체 페이지 헤더 스켈레톤을 포함하지 않는다.
- 날짜 선택기와 자동화 패널 위치를 다시 그리지 않는다.
- 준비 카드 6개 수준의 스켈레톤만 보여준다.

## Route-level loading 처리

`app/(authenticated)/worship-prep/loading.tsx`는 제거하는 것을 권장한다. 현재 문제의 체감 원인이 route-level fallback이 전체 화면을 대체하는 데 있기 때문이다.

파일을 유지해야 할 이유가 생기면 fallback은 매우 약하게 만들어야 한다. 하지만 이번 설계에서는 데이터 영역 Suspense fallback이 명시적으로 존재하므로 route-level `loading.tsx`는 불필요하다.

## 데이터 흐름

```text
사용자 메뉴 이동
  -> /worship-prep shell 즉시 렌더
  -> 헤더/날짜 선택기/자동화 패널 표시
  -> 카드 영역 Suspense fallback 표시
  -> WorshipPrepDataPanel에서 cached query 실행
  -> 데이터 준비 후 카드 영역과 PPT 버튼 교체
```

날짜 변경도 같은 흐름을 따른다. 날짜 선택기는 계속 유지되고, 데이터 영역만 해당 날짜의 결과로 교체된다.

## 캐시와 무효화

기존 캐시 정책은 유지한다.

- `getWorshipPrepDetail(isoDate)`: `worship-prep:{date}`, 60초 stale/revalidate, 300초 expire
- `getContiByDate(date)`: `conti-by-date:{date}`와 `contis`
- `getContis()`: `contis`
- `getConti(id)`: `conti:{id}`와 `contis`

Google Sheets 외부 직접 수정 가능성이 있으므로 예배준비 TTL을 `hours`로 늘리지 않는다. 앱 내부 수정은 기존 `invalidateWorshipPrepSundayDate()`와 route handler의 `expireWorshipPrepSundayDate()` 흐름을 그대로 사용한다.

## 에러와 empty state

- Google Sheets 또는 콘티 query가 실패하면 기존 server error boundary 동작을 따른다. 이번 변경에서 별도 retry UI는 추가하지 않는다.
- 선택 날짜에 데이터가 없으면 기존 empty state 문구를 유지한다.
- 데이터가 없을 때도 PPT export 버튼은 disabled 상태로 남긴다.

## 테스트 전략

source guard 중심으로 최소 회귀를 막는다.

- `worship-prep/page.tsx`가 route-level 데이터 전체를 기다리는 구조가 아닌지 확인한다.
- 페이지가 `<Suspense>`와 카드 영역 fallback을 사용하는지 확인한다.
- 데이터 panel 컴포넌트가 `searchParams`와 `getWorshipPrepDetail()`를 담당하는지 확인한다.
- route-level `app/(authenticated)/worship-prep/loading.tsx`가 제거되었는지 확인한다.
- disabled PPT export fallback이 shell에 존재하는지 확인한다.

기존 검증도 유지한다.

- `pnpm test tests/worship-prep-loading-source.test.mjs tests/cache-worship-prep-source.test.mjs`
- `pnpm test`
- `pnpm lint`
- `pnpm build`

## 자체 리뷰

- Placeholder scan: 미정 항목 없이 구현 방향과 fallback 정책을 명시했다.
- Internal consistency: “전체 shell은 즉시 표시, 카드 영역만 스켈레톤, PPT 버튼은 disabled”라는 사용자 선택과 모든 섹션이 일치한다.
- Scope check: 변경 범위는 `/worship-prep` route와 관련 fallback/source guard에 한정된다.
- Ambiguity check: route-level `loading.tsx`는 제거가 권장안이며, 데이터 TTL은 유지로 명시했다.
