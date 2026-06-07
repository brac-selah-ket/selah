# (selah) Brand Rollout Design

Date: 2026-06-07
Status: Approved design for implementation planning

## Summary

Rename the visible product identity from Storyboard to `(selah)` while preserving `(selah)` as the community brand mark. The first implementation pass should update local code, documentation, metadata, package naming, and favicon assets. Service URL and Vercel project/domain management are intentionally out of scope for this pass because they are managed outside the repository.

The app will keep the current brown `selah` primary color as the canonical brand color. Future route-level theme work may allow the entire app shell to switch primary color by main section, with `예배 준비` staying brown and `콘티` / `찬양 라이브러리` using Chapel Green, but that should be implemented as a disciplined route theme system rather than one-off component color overrides.

## Context

The existing app has already moved visually toward the `selah` brand:

- `components/layout/brand-mark.tsx` renders `(selah)`.
- `app/globals.css` uses the brown/ivory `selah` palette and DM Serif Display for the brand mark.
- `docs/design-system.md` says `selah` is the visible product brand.

However, multiple product-facing surfaces still say Storyboard:

- `package.json` name is `storyboard`.
- `app/layout.tsx` metadata title is `Storyboard`.
- `README.md` is still the default Next.js README.
- Sidebar secondary copy says `Storyboard worship setlist`.
- `.env.example` includes `APP_BASE_URL=https://storyboard-eta.vercel.app`.
- Favicon is still the default Vercel icon.

There are also deeper internal identifiers such as `lib/repositories/storyboard`, `getStoryboardRepository`, migration scripts, Turso/R2 resource names, and historical design docs. These should not all be renamed in the first branding pass because several are migration or persistence boundaries with wider blast radius.

## Decisions

### Product Name

Use `(selah)` as the visible product name.

Do not add `Prep`, `Order`, `Board`, or another product suffix in the first pass. The product already has a strong parenthetical brand mark, and adding descriptors weakened the brand during exploration. Functional clarity should come from supporting copy and README, not from a longer product name.

Recommended supporting copy:

- English: `worship preparation workspace`
- Korean: `예배 준비를 한 흐름으로`

### Color

Keep the existing brown as the canonical brand primary:

- Primary: `#5a3c31`
- Primary foreground: `#f5edcf`

Chapel Green may become a section primary for song/setlist-focused routes later:

- Chapel Green: `#305a53`
- Chapel Green foreground: `#f8f1de`

Brown and Chapel Green should not be mixed as competing colors in one surface. If Chapel Green is adopted, route groups should swap the full primary/sidebar/ring token set so each route has one clear primary color.

### URL

Do not change service URL, Vercel project slug, or Discord Interactions URL in this implementation pass.

The repository should continue to document `APP_BASE_URL` as required for server-side Discord notification links, but examples should use a neutral placeholder rather than the current Storyboard Vercel URL.

### Repository And Package Naming

Change the package name to `selah`.

The GitHub repository can be renamed from `Somang-Youth/storyboard` to `Somang-Youth/selah` outside the code change. Local worktree paths do not need to change during implementation.

### Favicon

Replace the default Vercel favicon with a small `(selah)`-aligned mark.

At favicon sizes, the full `(selah)` word is too wide. Use a compact brown/ivory mark such as `(s)` or a parenthetical `s` glyph based on the same DM Serif Display brand language. The favicon should use the canonical brown, not Chapel Green.

## Scope

### In Scope

- `package.json` visible package name.
- Root metadata title and description.
- Sidebar secondary copy.
- README product documentation.
- `.env.example` and `.env.local.example` branding examples and `APP_BASE_URL` placeholder wording.
- Favicon replacement.
- `docs/design-system.md` wording so Storyboard is no longer described as the product context.
- A small route-theme foundation may be added if it is needed to support future full-primary switching, but it should not become a broad visual redesign.

### Out Of Scope

- Vercel project/domain URL changes.
- Discord Developer Portal Interactions URL change.
- Live environment variable mutation.
- Turso database rename.
- R2 bucket rename.
- Renaming `lib/repositories/storyboard` and all `getStoryboardRepository` symbols.
- Renaming historical migration scripts and historical Superpowers docs.
- Reworking the app layout or page UX beyond branding copy and favicon.

## Branding Copy

README short description:

`(selah)` is a worship preparation workspace for coordinating weekly worship data, setlists, song arrangements, scripture, sheet music, Discord automation, and PPT output.

Korean product sentence:

`(selah)는 예배 준비, 콘티, 찬양 라이브러리, 말씀 본문, 악보, PPT 산출물을 한 흐름으로 맞추는 예배 준비 워크스페이스입니다.`

Sidebar secondary copy:

`worship preparation workspace`

Metadata:

- Title: `(selah)`
- Description: `예배 준비를 한 흐름으로 맞추는 워크스페이스`

## Route Theme Direction

The first pass can document, but does not have to fully implement, the route theme strategy:

- `예배 준비`: canonical brown primary.
- `콘티 목록`: Chapel Green primary.
- `찬양 라이브러리`: Chapel Green primary.

If implemented later, use route-level CSS variables rather than hard-coded component overrides. The sidebar background, active nav, primary buttons, rings, and primary badges should all inherit the route theme. Avoid showing brown and Chapel Green as peer primary colors within the same route.

## Implementation Boundaries

The first implementation should be a scoped branding pass. Expected files:

- `package.json`
- `README.md`
- `app/layout.tsx`
- `app/favicon.ico`
- `components/layout/sidebar.tsx`
- `docs/design-system.md`
- `.env.example`
- `.env.local.example`

If route theme foundation is included, expected files may also include:

- `app/globals.css`
- `app/(authenticated)/layout.tsx`
- `components/layout/app-shell.tsx`

Avoid touching repository provider code or migration scripts unless a direct user-facing branding reference requires it.

## Verification

Run:

- `pnpm lint`
- `pnpm test` if branding changes touch TypeScript or shared components beyond metadata/copy.

Browser checks:

- Login page title/favicon shows `(selah)`.
- Authenticated sidebar uses `(selah)` and no Storyboard copy.
- `/worship-prep`, `/contis`, and `/songs` still render normally.
- Favicon is legible at small size.
- No visible `Storyboard` remains in current UI chrome.

Manual deployment checklist for later URL work:

- Rename Vercel project or add desired domain.
- Set `APP_BASE_URL` to the new deployed canonical URL.
- Update Discord Developer Portal Interactions URL if the host changes.
- Run cron endpoint smoke checks after the URL change.
