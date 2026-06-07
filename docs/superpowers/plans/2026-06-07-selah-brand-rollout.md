# (selah) 브랜드 롤아웃 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자-facing 제품명을 `(selah)`로 통일하고, README/metadata/sidebar/favicon/package/env 예시와 라우트별 primary 테마 기반을 정리한다.

**Architecture:** 1차 변경은 사용자에게 보이는 브랜딩 표면과 문서에 집중한다. 내부 repository provider 네임스페이스와 migration script 이름은 운영 경계이므로 유지하고, route-level theme은 `AppShell`의 pathname 기반 class와 CSS 변수 override로 구현한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4 CSS variables, Vitest source tests, SVG app icon.

---

## 파일 구조

- Create: `tests/selah-branding-source.test.mjs`
  - 사용자-facing 파일들이 `(selah)` 브랜딩을 쓰고, `Storyboard` UI 문구와 기본 Vercel favicon이 제거됐는지 검증한다.
- Create: `tests/route-theme-source.test.mjs`
  - `/contis`, `/songs` route에서 Chapel Green full-primary 테마가 적용될 코드 기반을 검증한다.
- Modify: `package.json`
  - package name을 `selah`로 바꾼다. migration script path는 유지한다.
- Modify: `README.md`
  - Next.js 기본 README를 `(selah)` 제품 README로 교체한다.
- Modify: `app/layout.tsx`
  - metadata title/description/applicationName/icons를 `(selah)` 기준으로 바꾼다.
- Delete: `app/favicon.ico`
  - 기본 Vercel favicon을 제거한다.
- Create: `app/icon.svg`
  - 작은 크기에서도 읽히는 brown/ivory `(s)` favicon을 추가한다.
- Modify: `components/layout/sidebar.tsx`
  - 사이드바 보조 문구에서 `Storyboard`를 제거한다.
- Modify: `docs/design-system.md`
  - `Storyboard`를 내부 제품 맥락으로 남긴다는 문장을 제거하고 `(selah)` 단일 브랜드 규칙과 Chapel Green route theme 방향을 문서화한다.
- Modify: `.env.example`
  - `APP_BASE_URL`과 R2 bucket 예시에서 `storyboard` 고정값을 제거한다. 실제 서비스 URL은 후속 URL 작업에서 관리한다.
- Modify: `.env.local.example`
  - 로컬 예시에도 `APP_BASE_URL` 예시 값을 추가한다.
- Modify: `app/globals.css`
  - Chapel Green route theme CSS variables를 추가한다.
- Modify: `components/layout/app-shell.tsx`
  - `usePathname()`으로 section theme class를 루트 셸에 적용한다.

## 범위 고정

- Vercel project slug, production domain, Discord Developer Portal Interactions URL은 바꾸지 않는다.
- `lib/repositories/storyboard`, `getStoryboardRepository`, `scripts/storyboard-migration/*`, Turso/R2 실 리소스명은 이번 패스에서 바꾸지 않는다.
- 과거 `docs/superpowers/**` 기록 문서의 `Storyboard` 언급은 이력으로 유지한다.

---

### Task 1: 브랜딩 source test 추가

**Files:**
- Create: `tests/selah-branding-source.test.mjs`

- [ ] **Step 1: 실패하는 브랜딩 source test 작성**

Create `tests/selah-branding-source.test.mjs`:

```js
import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { test } from "vitest"

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8")
}

test("package and root metadata use the selah product name", async () => {
  const pkg = JSON.parse(await read("package.json"))
  const layout = await read("app/layout.tsx")

  assert.equal(pkg.name, "selah")
  assert.match(layout, /applicationName:\s*"\(selah\)"/)
  assert.match(layout, /title:\s*"\(selah\)"/)
  assert.match(layout, /description:\s*"예배 준비를 한 흐름으로 맞추는 워크스페이스"/)
  assert.match(layout, /icons:\s*\{\s*icon:\s*"\/icon\.svg"\s*\}/)
})

test("visible app chrome no longer uses Storyboard copy", async () => {
  const sidebar = await read("components/layout/sidebar.tsx")
  const readme = await read("README.md")
  const designSystem = await read("docs/design-system.md")

  assert.doesNotMatch(sidebar, /Storyboard/)
  assert.match(sidebar, /worship preparation workspace/)
  assert.match(readme, /# \(selah\)/)
  assert.match(readme, /예배 준비를 한 흐름으로 맞추는 예배 준비 워크스페이스/)
  assert.doesNotMatch(designSystem, /Storyboard may remain/)
})

test("environment examples avoid hard-coded storyboard service names", async () => {
  const envExample = await read(".env.example")
  const envLocalExample = await read(".env.local.example")

  assert.match(envExample, /APP_BASE_URL=https:\/\/your-app-domain\.example/)
  assert.doesNotMatch(envExample, /storyboard-eta\.vercel\.app/)
  assert.doesNotMatch(envExample, /R2_BUCKET_NAME=storyboard-assets/)
  assert.match(envExample, /R2_BUCKET_NAME=your-r2-bucket-name/)
  assert.match(envLocalExample, /APP_BASE_URL=https:\/\/your-app-domain\.example/)
})

test("selah icon is svg based and the default favicon file is removed", async () => {
  const icon = await read("app/icon.svg")

  assert.equal(existsSync(new URL("../app/favicon.ico", import.meta.url)), false)
  assert.match(icon, /<svg/)
  assert.match(icon, /#5a3c31/)
  assert.match(icon, /#f5edcf/)
  assert.match(icon, />\(s\)</)
})
```

- [ ] **Step 2: test가 실패하는지 확인**

Run:

```bash
pnpm test tests/selah-branding-source.test.mjs
```

Expected: FAIL. 대표 실패는 `pkg.name`이 현재 `storyboard`이고 `app/icon.svg`가 아직 없다는 내용이다.

- [ ] **Step 3: 커밋 보류**

브랜딩 테스트는 아직 실패하는 상태이므로 커밋하지 않는다. Task 3에서 favicon까지 적용한 뒤, 통과하는 테스트와 구현을 함께 커밋한다.

---

### Task 2: 제품명, README, metadata, sidebar, env 예시 갱신

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `app/layout.tsx`
- Modify: `components/layout/sidebar.tsx`
- Modify: `docs/design-system.md`
- Modify: `.env.example`
- Modify: `.env.local.example`

- [ ] **Step 1: package name 변경**

In `package.json`, change only the package name:

```json
{
  "name": "selah",
  "version": "0.1.0",
  "private": true
}
```

Do not rename these script paths in this pass:

```json
"db:export:neon": "node scripts/storyboard-migration/export-neon.mjs",
"db:import:turso": "node scripts/storyboard-migration/import-turso.mjs",
"db:verify:turso": "node scripts/storyboard-migration/verify-turso.mjs",
"storage:migrate:r2": "node scripts/storyboard-migration/migrate-blob-assets-to-r2.mjs"
```

- [ ] **Step 2: metadata 갱신**

In `app/layout.tsx`, replace the current metadata object with:

```ts
export const metadata: Metadata = {
  applicationName: "(selah)",
  title: "(selah)",
  description: "예배 준비를 한 흐름으로 맞추는 워크스페이스",
  icons: {
    icon: "/icon.svg",
  },
};
```

- [ ] **Step 3: sidebar 보조 문구 변경**

In `components/layout/sidebar.tsx`, replace:

```tsx
Storyboard worship setlist
```

with:

```tsx
worship preparation workspace
```

- [ ] **Step 4: README 전체 교체**

Replace `README.md` with:

````md
# (selah)

`(selah)`는 예배 준비, 콘티, 찬양 라이브러리, 말씀 본문, 악보, PPT 산출물을 한 흐름으로 맞추는 예배 준비 워크스페이스입니다.

## 주요 기능

- 주차별 예배 준비 데이터 조회
- Discord 예배 준비 스레드 생성, 메시지 파싱, 역할 선택 연동
- 콘티 생성, 수정, YouTube playlist 기반 곡 가져오기
- 찬양 라이브러리, 악보, 프리셋, 키/템포/섹션/가사 관리
- 말씀 본문 미리보기와 예배 PPT 내보내기
- 콘티별 PPT/PDF 산출물 준비

## 기술 스택

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Drizzle ORM
- Neon / Turso
- Vercel Blob / Cloudflare R2
- Vercel Cron

## 시작하기

```bash
pnpm install
pnpm dev
```

개발 서버는 기본적으로 [http://localhost:3000](http://localhost:3000)에서 실행됩니다.

## 환경 변수

필요한 값은 `.env.example`을 기준으로 설정합니다. 서버에서 생성하는 Discord 알림 링크에는 `APP_BASE_URL`이 필요합니다.

```bash
cp .env.example .env.local
```

주요 환경 변수:

- `AUTH_PASSWORD`, `AUTH_SECRET`: 공유 비밀번호 로그인
- `APP_BASE_URL`: 배포된 앱의 canonical URL
- `DATABASE_PROVIDER`: `neon` 또는 `turso`
- `STORAGE_PROVIDER`: `vercel-blob` 또는 `cloudflare-r2`
- `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SHEET_ID`, `GOOGLE_DRIVE_TEMPLATE_FOLDER_ID`: Google Sheets/Drive/PPTX 연동
- `DISCORD_BOT_TOKEN`, `DISCORD_CHANNEL_ID`, `DISCORD_GUILD_ID`, `DISCORD_PUBLIC_KEY`: Discord 연동
- `CRON_SECRET`: Vercel Cron 인증

## 명령어

```bash
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm db:turso:generate
pnpm db:turso:push
```

## 브랜딩

사용자-facing 제품명은 `(selah)`입니다. 기존 `storyboard` 이름은 일부 migration script와 내부 repository 경계에 남아 있을 수 있으며, 운영 리소스 rename이 필요한 시점에 별도 작업으로 정리합니다.
````

- [ ] **Step 5: design system 문서 갱신**

In `docs/design-system.md`, replace the `## Brand` section with:

```md
## Brand

`(selah)` is the visible product and community brand mark. User-facing navigation, metadata, documentation, and app chrome should lead with `(selah)`.

Do not introduce product suffixes such as `Prep`, `Order`, or `Board` in the first branding pass. Functional clarity should come from supporting copy such as `worship preparation workspace` and Korean page descriptions.
```

After the existing Color Tokens list, add:

```md
## Section Theme Direction

The canonical `(selah)` brand color is brown:

- Primary: `#5a3c31`
- Primary foreground: `#f5edcf`

Song and setlist-focused routes may use Chapel Green as a full route primary:

- Chapel Green: `#305a53`
- Chapel Green foreground: `#f8f1de`

When Chapel Green is active, swap the full route token set, including sidebar, active navigation, buttons, rings, and primary badges. Do not mix brown and Chapel Green as peer primary colors on the same route.
```

- [ ] **Step 6: env example 갱신**

In `.env.example`, replace:

```env
APP_BASE_URL=https://storyboard-eta.vercel.app
```

with:

```env
APP_BASE_URL=https://your-app-domain.example
```

Replace:

```env
R2_BUCKET_NAME=storyboard-assets
```

with:

```env
R2_BUCKET_NAME=your-r2-bucket-name
```

Replace:

```env
# Discord Replacement (somang-discord -> storyboard)
```

with:

```env
# Discord automation
```

In `.env.local.example`, add this block after `AUTH_PASSWORD`:

```env
# Public base URL used by server-side Discord notifications.
APP_BASE_URL=https://your-app-domain.example
```

- [ ] **Step 7: 브랜딩 source test 실행**

Run:

```bash
pnpm test tests/selah-branding-source.test.mjs
```

Expected: FAIL only on the favicon test because `app/icon.svg` has not been added and `app/favicon.ico` still exists.

- [ ] **Step 8: 커밋 보류**

이 시점에는 favicon test가 아직 실패하므로 커밋하지 않는다. Task 3에서 `app/icon.svg` 적용 후 브랜딩 변경 전체를 한 번에 커밋한다.

---

### Task 3: `(selah)` SVG favicon 적용

**Files:**
- Delete: `app/favicon.ico`
- Create: `app/icon.svg`

- [ ] **Step 1: 기존 Vercel favicon 삭제**

Remove:

```text
app/favicon.ico
```

- [ ] **Step 2: SVG icon 생성**

Create `app/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="(selah)">
  <rect width="64" height="64" rx="12" fill="#5a3c31"/>
  <text
    x="32"
    y="41"
    text-anchor="middle"
    font-family="'DM Serif Display', Georgia, 'Times New Roman', serif"
    font-size="30"
    font-style="italic"
    fill="#f5edcf"
  >(s)</text>
</svg>
```

- [ ] **Step 3: 브랜딩 source test 통과 확인**

Run:

```bash
pnpm test tests/selah-branding-source.test.mjs
```

Expected: PASS.

- [ ] **Step 4: 커밋**

```bash
git add tests/selah-branding-source.test.mjs package.json README.md app/layout.tsx components/layout/sidebar.tsx docs/design-system.md .env.example .env.local.example app/icon.svg
git add -u app/favicon.ico
git commit -m "chore: apply selah visible branding"
```

---

### Task 4: 라우트별 full-primary theme source test 추가

**Files:**
- Create: `tests/route-theme-source.test.mjs`

- [ ] **Step 1: 실패하는 route theme source test 작성**

Create `tests/route-theme-source.test.mjs`:

```js
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "vitest"

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8")
}

test("authenticated app shell chooses chapel theme for conti and song routes", async () => {
  const source = await read("components/layout/app-shell.tsx")

  assert.match(source, /usePathname/)
  assert.match(source, /function getSectionThemeClassName\(pathname: string\): string/)
  assert.match(source, /pathname\.startsWith\("\/contis"\)/)
  assert.match(source, /pathname\.startsWith\("\/songs"\)/)
  assert.match(source, /return "theme-chapel"/)
  assert.match(source, /getSectionThemeClassName\(pathname\)/)
})

test("globals define chapel green as a full route primary token set", async () => {
  const source = await read("app/globals.css")

  assert.match(source, /\.theme-chapel\s*\{/)
  assert.match(source, /--primary:\s*#305a53;/)
  assert.match(source, /--primary-foreground:\s*#f8f1de;/)
  assert.match(source, /--sidebar:\s*#305a53;/)
  assert.match(source, /--sidebar-foreground:\s*#f8f1de;/)
  assert.match(source, /--ring:\s*#55776d;/)
  assert.match(source, /\.dark\s+\.theme-chapel\s*\{/)
})
```

- [ ] **Step 2: test가 실패하는지 확인**

Run:

```bash
pnpm test tests/route-theme-source.test.mjs
```

Expected: FAIL because `AppShell` does not use `usePathname()` and `app/globals.css` does not define `.theme-chapel`.

- [ ] **Step 3: 커밋 보류**

라우트 테마 테스트는 아직 실패하는 상태이므로 커밋하지 않는다. Task 5에서 테마 구현 후 테스트와 구현을 함께 커밋한다.

---

### Task 5: Chapel Green route primary 전환 구현

**Files:**
- Modify: `components/layout/app-shell.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: AppShell에 route theme class 적용**

In `components/layout/app-shell.tsx`, add `usePathname` to the `next/navigation` imports:

```ts
import { usePathname } from "next/navigation";
```

Add this helper above `function AppShellInner`:

```ts
function getSectionThemeClassName(pathname: string): string {
  if (pathname.startsWith("/contis") || pathname.startsWith("/songs")) {
    return "theme-chapel";
  }

  return "theme-selah";
}
```

Inside `AppShellInner`, add:

```ts
const pathname = usePathname();
const sectionThemeClassName = getSectionThemeClassName(pathname);
```

Change the root wrapper from:

```tsx
<div className="flex min-h-screen">
```

to:

```tsx
<div className={cn("flex min-h-screen", sectionThemeClassName)}>
```

- [ ] **Step 2: Chapel Green CSS variable set 추가**

In `app/globals.css`, after the `.dark { ... }` block and before `@layer base`, add:

```css
.theme-selah {
  color-scheme: light;
}

.theme-chapel {
  --background: #f7f4ea;
  --foreground: #2d332f;
  --card: #fffdf7;
  --card-foreground: #2d332f;
  --popover: #fffdf7;
  --popover-foreground: #2d332f;
  --primary: #305a53;
  --primary-foreground: #f8f1de;
  --secondary: #e8ede4;
  --secondary-foreground: #263b35;
  --muted: #e8ede4;
  --muted-foreground: #5f6e67;
  --accent: #305a53;
  --accent-foreground: #f8f1de;
  --border: #d8dfd3;
  --input: #d8dfd3;
  --ring: #55776d;
  --chart-1: #305a53;
  --chart-2: #55776d;
  --chart-3: #9cad9f;
  --chart-4: #d8dfd3;
  --chart-5: #6f8b7e;
  --sidebar: #305a53;
  --sidebar-foreground: #f8f1de;
  --sidebar-primary: #f8f1de;
  --sidebar-primary-foreground: #305a53;
  --sidebar-accent: rgb(248 241 222 / 0.14);
  --sidebar-accent-foreground: #f8f1de;
  --sidebar-border: rgb(248 241 222 / 0.18);
  --sidebar-ring: #f8f1de;
}

.dark .theme-chapel {
  --background: #172522;
  --foreground: #f2efe0;
  --card: #1f302c;
  --card-foreground: #f2efe0;
  --popover: #1f302c;
  --popover-foreground: #f2efe0;
  --primary: #9fb9ad;
  --primary-foreground: #172522;
  --secondary: #263b35;
  --secondary-foreground: #f2efe0;
  --muted: #263b35;
  --muted-foreground: #c7d4cd;
  --accent: #9fb9ad;
  --accent-foreground: #172522;
  --border: rgb(248 241 222 / 0.15);
  --input: rgb(248 241 222 / 0.18);
  --ring: #9fb9ad;
  --chart-1: #9fb9ad;
  --chart-2: #c7d4cd;
  --chart-3: #6f8b7e;
  --chart-4: #305a53;
  --chart-5: #1f514c;
  --sidebar: #172522;
  --sidebar-foreground: #f2efe0;
  --sidebar-primary: #9fb9ad;
  --sidebar-primary-foreground: #172522;
  --sidebar-accent: rgb(248 241 222 / 0.12);
  --sidebar-accent-foreground: #f2efe0;
  --sidebar-border: rgb(248 241 222 / 0.14);
  --sidebar-ring: #9fb9ad;
}
```

- [ ] **Step 3: route theme source test 통과 확인**

Run:

```bash
pnpm test tests/route-theme-source.test.mjs
```

Expected: PASS.

- [ ] **Step 4: 관련 브랜딩 test도 재확인**

Run:

```bash
pnpm test tests/selah-branding-source.test.mjs tests/route-theme-source.test.mjs
```

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add components/layout/app-shell.tsx app/globals.css tests/route-theme-source.test.mjs
git commit -m "feat: add section primary themes"
```

---

### Task 6: 전체 검증과 브라우저 확인

**Files:**
- No code changes expected.

- [ ] **Step 1: lint 실행**

Run:

```bash
pnpm lint
```

Expected: PASS.

- [ ] **Step 2: test suite 실행**

Run:

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 3: dev server 실행**

Run:

```bash
pnpm dev
```

Expected: server starts at `http://localhost:3000`.

- [ ] **Step 4: 브라우저 smoke check**

Open these routes:

```text
http://localhost:3000/login
http://localhost:3000/worship-prep
http://localhost:3000/contis
http://localhost:3000/songs
```

Expected:

- Browser title uses `(selah)`.
- Favicon shows a brown/ivory `(s)` mark.
- Sidebar secondary copy says `worship preparation workspace`.
- `/worship-prep` uses the brown sidebar and primary controls.
- `/contis` and `/songs` use the Chapel Green sidebar and primary controls.
- No visible `Storyboard` copy remains in app chrome.

- [ ] **Step 5: final status 확인**

Run:

```bash
git status --short
```

Expected: no unstaged or uncommitted files after the implementation commits.
