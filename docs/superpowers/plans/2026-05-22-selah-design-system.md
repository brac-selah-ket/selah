# selah Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved `selah` brand-balanced design system to semantic tokens, core primitives, app layout, conti screens, song library screens, and a concise design guide.

**Architecture:** Keep the existing Next.js App Router, shadcn/base-ui primitives, Tailwind v4 semantic token model, and Hugeicons usage. Add brand tokens and font families globally, then make layout and screen components consume those semantic tokens instead of one-off color and spacing choices. Preserve existing data fetching, server actions, dialogs, and optimistic conti-song behavior.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/base-nova components, @base-ui/react, @hugeicons/react, Pretendard, Google-hosted DM Serif Display and Noto Serif KR CSS imports.

---

## Scope Check

This plan covers one bounded design-system refresh. It does not redesign PDF export/editor internals, alter database shape, change server actions, or introduce a component showcase route. Existing `main` changes for conti edit sheet/preset management are preserved by keeping `ContiDetail`'s `variant` and `showDescription` props intact.

## File Structure

- Modify `app/globals.css`: import brand fonts, expose Tailwind font families, replace shadcn semantic colors with the `selah` palette, reduce default radius, and keep dark mode functional.
- Create `components/layout/brand-mark.tsx`: reusable `(selah)` brand mark so sidebar and mobile header do not duplicate font/color decisions.
- Modify `components/layout/sidebar.tsx`: apply primary brown sidebar, ivory brand mark, restrained active nav, and brand-aware logout area.
- Modify `components/layout/app-shell.tsx`: switch mobile header to `BrandMark`, use warm app background, and keep drawer portal behavior unchanged.
- Modify `components/layout/page-header.tsx`: add `eyebrow`, `titleClassName`, and stable spacing/action layout for top-level pages.
- Modify `components/ui/button.tsx`: tune radius, focus ring, brand hover, outline, ghost, and fixed icon sizing.
- Modify `components/ui/card.tsx`: reduce default radius, use brand-tinted borders, and keep card slot API unchanged.
- Modify `components/ui/input.tsx` and `components/ui/textarea.tsx`: standardize height, radius, warm surface, border, and focus treatment.
- Modify `components/ui/badge.tsx`: reduce pill dominance and add explicit status/music metadata variants.
- Modify `components/contis/conti-list.tsx`: move conti overview from grid cards to a dense list surface.
- Modify `components/contis/conti-card.tsx`: keep the component name for compatibility but render a list row link.
- Modify `components/contis/conti-detail.tsx`: wrap the detail/editor song area in section panels while preserving picker/import state.
- Modify `components/contis/conti-song-item.tsx`: restyle song rows around stable order, metadata, and action zones.
- Modify `app/(authenticated)/contis/page.tsx`: use the enhanced page header.
- Modify `components/songs/song-list.tsx`: make search a compact tool surface and list songs vertically.
- Modify `components/songs/song-card.tsx`: keep the component name for compatibility but render a compact song row.
- Modify `app/(authenticated)/songs/page.tsx`: use the enhanced page header.
- Create `docs/design-system.md`: concise operational guide for future feature work.

## Task 1: Brand Tokens And Fonts

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Replace the font imports at the top of `app/globals.css`**

Replace the first import block with:

```css
@import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
@import url("https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Noto+Serif+KR:wght@500;600;700&display=swap");
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
```

- [ ] **Step 2: Add brand font families to the Tailwind theme block**

Inside `@theme inline`, after `--font-sans: var(--font-sans);`, add:

```css
  --font-brand: var(--font-brand);
  --font-serif-kr: var(--font-serif-kr);
```

- [ ] **Step 3: Replace the `:root` color tokens**

Replace the existing `:root` block with:

```css
:root {
  --background: #fbf7ee;
  --foreground: #33251f;
  --card: #fffdf7;
  --card-foreground: #33251f;
  --popover: #fffdf7;
  --popover-foreground: #33251f;
  --primary: #5a3c31;
  --primary-foreground: #f5edcf;
  --secondary: #f1e7d8;
  --secondary-foreground: #3f2e27;
  --muted: #f1e7d8;
  --muted-foreground: #7a6255;
  --accent: #5a3c31;
  --accent-foreground: #f5edcf;
  --destructive: oklch(0.577 0.245 27.325);
  --border: #e4d8c6;
  --input: #e4d8c6;
  --ring: #8c6d5c;
  --chart-1: #5a3c31;
  --chart-2: #8c6d5c;
  --chart-3: #c4a98d;
  --chart-4: #f5edcf;
  --chart-5: #7f4f3f;
  --radius: 0.5rem;
  --font-sans: "Pretendard Variable", Pretendard, ui-sans-serif, system-ui, sans-serif;
  --font-brand: "DM Serif Display", ui-serif, Georgia, serif;
  --font-serif-kr: "Noto Serif KR", ui-serif, Georgia, serif;
  --sidebar: #5a3c31;
  --sidebar-foreground: #f5edcf;
  --sidebar-primary: #f5edcf;
  --sidebar-primary-foreground: #5a3c31;
  --sidebar-accent: rgb(245 237 207 / 0.14);
  --sidebar-accent-foreground: #f5edcf;
  --sidebar-border: rgb(245 237 207 / 0.18);
  --sidebar-ring: #f5edcf;
}
```

- [ ] **Step 4: Replace the `.dark` block with compatible brand dark tokens**

Replace the existing `.dark` block with:

```css
.dark {
  --background: #241a16;
  --foreground: #f8f0dc;
  --card: #30221c;
  --card-foreground: #f8f0dc;
  --popover: #30221c;
  --popover-foreground: #f8f0dc;
  --primary: #f5edcf;
  --primary-foreground: #3a281f;
  --secondary: #3a281f;
  --secondary-foreground: #f8f0dc;
  --muted: #3a281f;
  --muted-foreground: #d1bfa5;
  --accent: #f5edcf;
  --accent-foreground: #3a281f;
  --destructive: oklch(0.704 0.191 22.216);
  --border: rgb(245 237 207 / 0.16);
  --input: rgb(245 237 207 / 0.18);
  --ring: #d1bfa5;
  --chart-1: #f5edcf;
  --chart-2: #d1bfa5;
  --chart-3: #a98269;
  --chart-4: #7f4f3f;
  --chart-5: #5a3c31;
  --sidebar: #241a16;
  --sidebar-foreground: #f8f0dc;
  --sidebar-primary: #f5edcf;
  --sidebar-primary-foreground: #3a281f;
  --sidebar-accent: rgb(245 237 207 / 0.12);
  --sidebar-accent-foreground: #f8f0dc;
  --sidebar-border: rgb(245 237 207 / 0.14);
  --sidebar-ring: #d1bfa5;
}
```

- [ ] **Step 5: Update the base body styling**

In the `body` rule, replace:

```css
@apply bg-background text-foreground;
```

with:

```css
@apply bg-background text-foreground antialiased;
font-family: var(--font-sans);
```

- [ ] **Step 6: Verify token changes**

Run:

```bash
pnpm lint
```

Expected: ESLint exits successfully. CSS-only token changes should not introduce TypeScript or lint errors.

- [ ] **Step 7: Commit**

```bash
git add app/globals.css
git commit -m "style: add selah brand tokens"
```

## Task 2: Brand Shell And Page Header

**Files:**
- Create: `components/layout/brand-mark.tsx`
- Modify: `components/layout/sidebar.tsx`
- Modify: `components/layout/app-shell.tsx`
- Modify: `components/layout/page-header.tsx`
- Modify: `app/(authenticated)/contis/page.tsx`
- Modify: `app/(authenticated)/songs/page.tsx`

- [ ] **Step 1: Create `BrandMark`**

Create `components/layout/brand-mark.tsx`:

```tsx
import { cn } from "@/lib/utils"

interface BrandMarkProps {
  className?: string
  compact?: boolean
}

export function BrandMark({ className, compact = false }: BrandMarkProps) {
  return (
    <span
      className={cn(
        "font-brand leading-none tracking-normal",
        compact ? "text-2xl" : "text-[2rem]",
        className
      )}
    >
      (selah)
    </span>
  )
}
```

- [ ] **Step 2: Update `SidebarContent` branding and nav styles**

In `components/layout/sidebar.tsx`, add this import:

```tsx
import { BrandMark } from "@/components/layout/brand-mark"
```

Replace the header block:

```tsx
<div className="p-4 border-b">
  {headerContent ?? (
    <Link href="/" className="text-xl font-bold">
      Storyboard
    </Link>
  )}
</div>
```

with:

```tsx
<div className="border-b border-sidebar-border p-4">
  {headerContent ?? (
    <Link
      href="/"
      className="inline-flex flex-col gap-1 text-sidebar-foreground transition-opacity hover:opacity-85"
    >
      <BrandMark />
      <span className="text-xs font-medium text-sidebar-foreground/65">
        Storyboard worship setlist
      </span>
    </Link>
  )}
</div>
```

Replace the `className` passed to each nav `Link` with:

```tsx
className={cn(
  "flex items-center gap-2 rounded-lg px-3 py-2 text-base font-medium transition-colors",
  isActive
    ? "bg-sidebar-accent text-sidebar-accent-foreground"
    : "text-sidebar-foreground/68 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
)}
```

Replace the logout wrapper:

```tsx
<div className="p-2 border-t">
```

with:

```tsx
<div className="border-t border-sidebar-border p-2">
```

Add this `className` to the logout `Button`:

```tsx
className="w-full justify-start gap-2 text-sidebar-foreground/72 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
```

Replace the desktop `aside` class:

```tsx
className="hidden md:flex w-45 fixed left-0 top-0 h-screen border-r bg-card flex-col"
```

with:

```tsx
className="fixed left-0 top-0 hidden h-screen w-45 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex"
```

- [ ] **Step 3: Update mobile app shell branding**

In `components/layout/app-shell.tsx`, add:

```tsx
import { BrandMark } from "@/components/layout/brand-mark";
```

Replace the mobile header:

```tsx
<header className="md:hidden sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background px-4">
  <Button variant="ghost" size="icon" aria-label="메뉴 열기" onClick={() => setNavOpen(true)}>
    <HugeiconsIcon icon={Menu01Icon} strokeWidth={2} />
  </Button>
  <span className="font-semibold">Storyboard</span>
</header>
```

with:

```tsx
<header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur md:hidden">
  <Button variant="ghost" size="icon" aria-label="메뉴 열기" onClick={() => setNavOpen(true)}>
    <HugeiconsIcon icon={Menu01Icon} strokeWidth={2} />
  </Button>
  <BrandMark compact className="text-primary" />
</header>
```

Replace the main element:

```tsx
<main className="flex-1 p-4 md:p-6 min-w-0">{children}</main>
```

with:

```tsx
<main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
```

- [ ] **Step 4: Enhance `PageHeader`**

Replace `components/layout/page-header.tsx` with:

```tsx
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  eyebrow?: string
  backHref?: string
  children?: React.ReactNode
  titleClassName?: string
}

export function PageHeader({
  title,
  description,
  eyebrow,
  backHref,
  children,
  titleClassName,
}: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-2">
        {backHref && (
          <Link
            href={backHref}
            className="mt-1 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="이전 화면으로 이동"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-7" />
          </Link>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1 text-sm font-semibold text-primary/75">{eyebrow}</p>
          )}
          <h1
            className={cn(
              "font-serif-kr text-3xl font-bold leading-tight tracking-normal text-foreground sm:text-4xl",
              titleClassName
            )}
          >
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-2xl text-base text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}
```

- [ ] **Step 5: Update target page headers**

In `app/(authenticated)/contis/page.tsx`, replace:

```tsx
<PageHeader title="콘티 목록">
```

with:

```tsx
<PageHeader title="콘티 목록" eyebrow="selah worship setlist">
```

In `app/(authenticated)/songs/page.tsx`, replace:

```tsx
<PageHeader title="찬양 라이브러리" description="예배에 사용할 곡을 관리합니다">
```

with:

```tsx
<PageHeader
  title="찬양 라이브러리"
  eyebrow="song library"
  description="예배에 사용할 곡과 악보를 관리합니다"
>
```

- [ ] **Step 6: Verify shell changes**

Run:

```bash
pnpm lint
```

Expected: ESLint exits successfully. If it reports import ordering changes, apply the auto-fix manually by keeping local import groups consistent with nearby files.

- [ ] **Step 7: Commit**

```bash
git add components/layout/brand-mark.tsx components/layout/sidebar.tsx components/layout/app-shell.tsx components/layout/page-header.tsx 'app/(authenticated)/contis/page.tsx' 'app/(authenticated)/songs/page.tsx'
git commit -m "style: apply selah app shell"
```

## Task 3: Core UI Primitive Styling

**Files:**
- Modify: `components/ui/button.tsx`
- Modify: `components/ui/card.tsx`
- Modify: `components/ui/input.tsx`
- Modify: `components/ui/textarea.tsx`
- Modify: `components/ui/badge.tsx`

- [ ] **Step 1: Update button variants**

In `components/ui/button.tsx`, replace the base class passed to `cva` with:

```tsx
"focus-visible:border-ring focus-visible:ring-ring/45 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 rounded-md border border-transparent bg-clip-padding text-base font-semibold focus-visible:ring-3 aria-invalid:ring-3 [&_svg:not([class*='size-'])]:size-5 inline-flex items-center justify-center whitespace-nowrap transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none shrink-0 [&_svg]:shrink-0 outline-none group/button select-none"
```

Replace the `variant` values with:

```tsx
variant: {
  default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 [a]:hover:bg-primary/90",
  outline: "border-border bg-card text-foreground shadow-sm hover:border-primary/35 hover:bg-muted/70 hover:text-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 aria-expanded:bg-muted aria-expanded:text-foreground",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
  ghost: "text-muted-foreground hover:bg-muted/70 hover:text-foreground dark:hover:bg-muted/50 aria-expanded:bg-muted aria-expanded:text-foreground",
  destructive: "bg-destructive/10 hover:bg-destructive/20 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/20 text-destructive focus-visible:border-destructive/40 dark:hover:bg-destructive/30",
  link: "text-primary underline-offset-4 hover:underline",
},
```

Keep the existing `size` variants unchanged except the rounded classes will now resolve from `--radius`.

- [ ] **Step 2: Update card radius and surface treatment**

In `components/ui/card.tsx`, replace the `Card` class string with:

```tsx
"border border-border/80 bg-card text-card-foreground gap-4 overflow-hidden rounded-lg py-4 text-base shadow-sm has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:py-3 data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-lg *:[img:last-child]:rounded-b-lg group/card flex flex-col"
```

Replace `CardHeader`'s rounded class string fragment:

```tsx
"gap-1 rounded-t-xl px-4 group-data-[size=sm]/card:px-3 [.border-b]:pb-4 group-data-[size=sm]/card:[.border-b]:pb-3 group/card-header @container/card-header grid auto-rows-min items-start has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto]"
```

with:

```tsx
"gap-1 rounded-t-lg px-4 group-data-[size=sm]/card:px-3 [.border-b]:pb-4 group-data-[size=sm]/card:[.border-b]:pb-3 group/card-header @container/card-header grid auto-rows-min items-start has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto]"
```

Replace `CardFooter`'s class string with:

```tsx
"bg-muted/45 rounded-b-lg border-t p-4 group-data-[size=sm]/card:p-3 flex items-center"
```

- [ ] **Step 3: Update input and textarea surfaces**

In `components/ui/input.tsx`, replace the class string with:

```tsx
"border-input bg-card focus-visible:border-ring focus-visible:ring-ring/40 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 disabled:bg-input/50 dark:disabled:bg-input/80 h-9 rounded-md border px-3 py-1 text-base transition-colors file:h-6 file:text-base file:font-medium focus-visible:ring-3 aria-invalid:ring-3 file:text-foreground placeholder:text-muted-foreground w-full min-w-0 outline-none file:inline-flex file:border-0 file:bg-transparent disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
```

In `components/ui/textarea.tsx`, replace the class string with:

```tsx
"border-input bg-card focus-visible:border-ring focus-visible:ring-ring/40 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 disabled:bg-input/50 dark:disabled:bg-input/80 rounded-md border px-3 py-2 text-base transition-colors focus-visible:ring-3 aria-invalid:ring-3 placeholder:text-muted-foreground flex field-sizing-content min-h-20 w-full outline-none disabled:cursor-not-allowed disabled:opacity-50"
```

- [ ] **Step 4: Add badge variants for metadata**

In `components/ui/badge.tsx`, replace the base badge class with:

```tsx
"h-5 gap-1 rounded-md border border-transparent px-2 py-0.5 text-sm font-semibold transition-all has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:size-4! inline-flex items-center justify-center w-fit whitespace-nowrap shrink-0 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive overflow-hidden group/badge"
```

Replace the `variant` values with:

```tsx
variant: {
  default: "bg-primary text-primary-foreground [a]:hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
  destructive: "bg-destructive/10 [a]:hover:bg-destructive/20 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 text-destructive dark:bg-destructive/20",
  outline: "border-border bg-card text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-muted/50",
  key: "border-primary/20 bg-primary/10 text-primary",
  tempo: "border-border bg-card text-muted-foreground",
  status: "bg-primary text-primary-foreground",
  attention: "border-destructive/20 bg-destructive/10 text-destructive",
  link: "text-primary underline-offset-4 hover:underline",
},
```

This changes the public variant union. Update call sites in later tasks where TypeScript reports narrow variant usage changes.

- [ ] **Step 5: Verify primitive type changes**

Run:

```bash
pnpm lint
```

Expected: ESLint exits successfully. TypeScript should accept the new `Badge` variants because they are generated by `class-variance-authority`.

- [ ] **Step 6: Commit**

```bash
git add components/ui/button.tsx components/ui/card.tsx components/ui/input.tsx components/ui/textarea.tsx components/ui/badge.tsx
git commit -m "style: tune core ui primitives"
```

## Task 4: Conti List And Detail Surfaces

**Files:**
- Modify: `components/contis/conti-list.tsx`
- Modify: `components/contis/conti-card.tsx`
- Modify: `components/contis/conti-detail.tsx`
- Modify: `components/contis/conti-song-item.tsx`

- [ ] **Step 1: Convert conti list container to list surface**

In `components/contis/conti-list.tsx`, replace the empty state with:

```tsx
<div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed bg-card/70 px-6 py-12 text-center">
  <p className="font-serif-kr text-2xl font-semibold text-foreground">아직 콘티가 없습니다</p>
  <p className="mt-2 text-base text-muted-foreground">첫 콘티를 만들고 이번 주 예배 흐름을 정리해보세요.</p>
</div>
```

Replace the list wrapper:

```tsx
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
```

with:

```tsx
<div className="overflow-hidden rounded-lg border bg-card shadow-sm">
```

- [ ] **Step 2: Render `ContiCard` as a row**

Replace `components/contis/conti-card.tsx` with:

```tsx
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { sanitizeContiDescription } from "@/lib/conti-description"
import type { Conti } from "@/lib/types"

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-")
  return `${year}.${month}.${day}`
}

function formatLongDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-")
  return `${year}년 ${month}월 ${day}일`
}

export function ContiCard({ conti }: { conti: Conti }) {
  const description = sanitizeContiDescription(conti.description)
  const title = conti.title || formatLongDate(conti.date)

  return (
    <Link
      href={`/contis/${conti.id}`}
      className="group grid gap-3 border-b px-4 py-4 transition-colors last:border-b-0 hover:bg-muted/55 sm:grid-cols-[7.5rem_1fr_auto] sm:items-center"
    >
      <div className="text-sm font-semibold text-primary/75">{formatDate(conti.date)}</div>
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{description}</p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">설명이 없는 콘티입니다</p>
        )}
      </div>
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground group-hover:text-primary">
        열기
        <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-4" />
      </div>
    </Link>
  )
}
```

- [ ] **Step 3: Wrap conti detail in a panel**

In `components/contis/conti-detail.tsx`, replace:

```tsx
return (
  <div className="flex flex-col gap-4">
```

with:

```tsx
return (
  <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
    <div className="flex flex-col gap-4">
```

At the end of the return, replace the final closing:

```tsx
  </div>
)
```

with:

```tsx
    </div>
  </section>
)
```

In the empty state, replace:

```tsx
<div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
```

with:

```tsx
<div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-background/60 px-6 py-12 text-center">
```

Replace the action wrapper:

```tsx
<div className="flex items-center gap-2 self-start">
```

with:

```tsx
<div className="flex flex-wrap items-center gap-2 self-start">
```

- [ ] **Step 4: Restyle conti song rows**

In `components/contis/conti-song-item.tsx`, replace the outer row class with:

```tsx
className="group grid cursor-pointer grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-lg border bg-card px-3 py-3 transition-colors hover:border-primary/25 hover:bg-muted/45 sm:grid-cols-[2.25rem_1fr_auto]"
```

Replace the order number class with:

```tsx
className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold text-primary"
```

Replace the song name class:

```tsx
className="truncate text-base font-semibold"
```

Change key badges from:

```tsx
<Badge key={key} variant="secondary">
```

to:

```tsx
<Badge key={key} variant="key">
```

Change tempo badges from:

```tsx
<Badge key={i} variant="outline">
```

to:

```tsx
<Badge key={i} variant="tempo">
```

Replace the action zone class:

```tsx
className="flex shrink-0 items-center gap-0.5"
```

with:

```tsx
className="flex shrink-0 items-center gap-1"
```

- [ ] **Step 5: Verify conti screens compile**

Run:

```bash
pnpm lint
```

Expected: ESLint exits successfully. If JSX nesting fails after wrapping `ContiDetail`, check that the new `<section>` encloses exactly one inner `<div>` and all existing dialogs remain siblings inside that inner div.

- [ ] **Step 6: Commit**

```bash
git add components/contis/conti-list.tsx components/contis/conti-card.tsx components/contis/conti-detail.tsx components/contis/conti-song-item.tsx
git commit -m "style: redesign conti overview surfaces"
```

## Task 5: Song Library List Surface

**Files:**
- Modify: `components/songs/song-list.tsx`
- Modify: `components/songs/song-card.tsx`

- [ ] **Step 1: Restyle song search and list container**

In `components/songs/song-list.tsx`, keep the existing outer wrapper and replace the search container:

```tsx
<div className="relative">
```

with:

```tsx
<div className="rounded-lg border bg-card p-3 shadow-sm">
  <div className="relative">
```

After the `Input`, close the extra inner `div`:

```tsx
  </div>
</div>
```

The resulting search block should be:

```tsx
<div className="rounded-lg border bg-card p-3 shadow-sm">
  <div className="relative">
    <HugeiconsIcon
      icon={SearchIcon}
      strokeWidth={2}
      className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
    />
    <Input
      type="text"
      placeholder="곡 이름 검색..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      className="pl-9"
    />
  </div>
</div>
```

Replace both empty states with branded panel states:

```tsx
{showEmptyState && (
  <div className="flex min-h-44 flex-col items-center justify-center rounded-lg border border-dashed bg-card/70 px-6 py-10 text-center">
    <p className="font-serif-kr text-2xl font-semibold text-foreground">아직 등록된 곡이 없습니다</p>
    <p className="mt-2 text-base text-muted-foreground">자주 부르는 찬양부터 하나씩 추가해보세요.</p>
  </div>
)}

{showSearchEmptyState && (
  <div className="flex min-h-44 flex-col items-center justify-center rounded-lg border border-dashed bg-card/70 px-6 py-10 text-center">
    <p className="font-serif-kr text-2xl font-semibold text-foreground">검색 결과가 없습니다</p>
    <p className="mt-2 text-base text-muted-foreground">다른 곡 이름으로 다시 찾아보세요.</p>
  </div>
)}
```

Replace the song grid wrapper:

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
```

with:

```tsx
<div className="overflow-hidden rounded-lg border bg-card shadow-sm">
```

- [ ] **Step 2: Render `SongCard` as a row**

Replace `components/songs/song-card.tsx` with:

```tsx
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, MusicNoteSquare01Icon } from "@hugeicons/core-free-icons";
import type { Song } from "@/lib/types";

interface SongCardProps {
  song: Song;
}

export function SongCard({ song }: SongCardProps) {
  const formattedDate = new Date(song.createdAt).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Link
      href={`/songs/${song.id}`}
      className="group grid gap-3 border-b px-4 py-4 transition-colors last:border-b-0 hover:bg-muted/55 sm:grid-cols-[2rem_1fr_auto] sm:items-center"
    >
      <div className="hidden size-8 items-center justify-center rounded-md bg-muted text-primary sm:flex">
        <HugeiconsIcon icon={MusicNoteSquare01Icon} strokeWidth={2} className="size-5" />
      </div>
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold text-foreground">{song.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{formattedDate} 등록</p>
      </div>
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground group-hover:text-primary">
        열기
        <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-4" />
      </div>
    </Link>
  );
}
```

- [ ] **Step 3: Verify song library compiles**

Run:

```bash
pnpm lint
```

Expected: ESLint exits successfully.

- [ ] **Step 4: Commit**

```bash
git add components/songs/song-list.tsx components/songs/song-card.tsx
git commit -m "style: redesign song library list"
```

## Task 6: Design Guide

**Files:**
- Create: `docs/design-system.md`

- [ ] **Step 1: Create the operational design guide**

Create `docs/design-system.md`:

```markdown
# selah Design System

## Brand

`selah` is the visible product brand. Storyboard may remain as internal/product context, but user-facing navigation and app chrome should lead with `(selah)`.

## Color Tokens

- `--primary`: `#5a3c31`, the logo brown.
- `--primary-foreground`: `#f5edcf`, the logo ivory.
- `--background`: `#fbf7ee`, the warm app canvas.
- `--card`: `#fffdf7`, the main panel surface.
- `--muted`: `#f1e7d8`, secondary surfaces and hover states.
- `--border`: `#e4d8c6`, warm dividers.
- `--ring`: `#8c6d5c`, focus rings.

Use semantic Tailwind classes (`bg-primary`, `text-muted-foreground`, `border-border`) instead of hard-coded hex values in components.

## Typography

- Use `font-brand` for the `(selah)` mark only.
- Use `font-serif-kr` for top-level Korean page titles and empty-state headlines.
- Use the default sans font for lists, forms, buttons, dialogs, editors, and dense work surfaces.

## Spacing And Shape

- Use `gap-1`, `gap-2`, `gap-3`, `gap-4`, `gap-6`, and `gap-8` as the main spacing scale.
- Use `rounded-md` for controls and metadata.
- Use `rounded-lg` for panels, dialogs, list surfaces, and larger grouped areas.
- Avoid nested cards. Use panels for grouped editing areas and rows for scan-heavy lists.

## Lists, Cards, And Panels

- Use list rows for contis, songs, and other objects users compare or scan.
- Use cards only when items are visually independent and not primarily scanned as a table-like list.
- Use panels for detail regions, editor sections, dialogs, and empty states.

## Badges

- `variant="key"`: musical key metadata.
- `variant="tempo"`: BPM metadata.
- `variant="status"`: high-emphasis workflow state.
- `variant="attention"`: warnings or required attention.
- `variant="outline"` or muted text: low-emphasis metadata.

## Page Pattern

Use `PageHeader` on primary pages. Prefer:

1. `eyebrow` for product/context text.
2. `title` for the page name.
3. `description` for one sentence of context.
4. Primary action buttons in the right action area.

Keep operational controls close to the content they affect. Search and filters should sit in a compact tool panel under the header.
```

- [ ] **Step 2: Verify guide has no placeholders**

Run:

```bash
rg -n "TBD|TODO|placeholder|FIXME" docs/design-system.md
```

Expected: no output and exit code `1`.

- [ ] **Step 3: Commit**

```bash
git add docs/design-system.md
git commit -m "docs: add selah design system guide"
```

## Task 7: Final Verification And Browser Review

**Files:**
- Verify all files changed in Tasks 1-6.

- [ ] **Step 1: Run lint**

Run:

```bash
pnpm lint
```

Expected: exits successfully.

- [ ] **Step 2: Run production build**

Run:

```bash
pnpm build
```

Expected: exits successfully. If the Google font CSS import causes build-time CSS ordering or network issues, switch the two brand font families to CSS font-family fallbacks only and leave a follow-up note in `docs/design-system.md` that self-hosted font files are needed for offline-perfect rendering.

- [ ] **Step 3: Start the dev server**

Run:

```bash
pnpm dev
```

Expected: Next.js dev server starts and prints a localhost URL, normally `http://localhost:3000`.

- [ ] **Step 4: Browser review desktop**

Open these routes at a desktop width:

```text
http://localhost:3000/contis
http://localhost:3000/songs
```

Expected:

- Sidebar is primary brown with ivory `(selah)` mark.
- Page title uses Korean serif styling.
- List rows have stable height, no text overlap, and hover states are subtle.
- Buttons use brown primary styling and icon spacing remains stable.

- [ ] **Step 5: Browser review mobile**

Open the same routes at a mobile width.

Expected:

- Mobile header shows `(selah)`.
- Action buttons collapse to icon buttons without text overflow.
- Conti and song rows stack cleanly.
- Drawer/sidebar remains usable.

- [ ] **Step 6: Review conti detail**

From `http://localhost:3000/contis`, click one conti row that has songs.

Expected:

- The song list sits in a panel.
- Song rows show order, title, key/BPM badges, section summary, and actions without overlap.
- Move/edit/delete controls remain clickable.
- Expanding a song editor keeps the newly merged sheet/preset UI usable.

- [ ] **Step 7: Final status**

Run:

```bash
git status --short
```

Expected: no uncommitted tracked files. Ignored `.superpowers/` files may exist locally but should not appear in status.
