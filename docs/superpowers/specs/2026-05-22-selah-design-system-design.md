# selah Design System Refresh

Date: 2026-05-22
Status: Approved design for implementation planning

## Summary

Refresh Storyboard's visual system around the new `selah` brand while preserving its role as a fast worship setlist and preparation tool. The selected direction is **brand + tool balance**: the app should clearly feel like `selah`, but lists, forms, and editing flows must stay dense, predictable, and easy to scan.

The first implementation phase will update semantic tokens, core UI primitives, app layout components, and three representative screens: conti list, conti detail, and song library. It will also add a short design guide so future features do not drift back into one-off spacing and component decisions.

## Context

The current UI mostly follows shadcn/base-nova defaults with custom colors layered in `app/globals.css`. Because the product did not start with a clear design language, new features have accumulated inconsistent margins, card usage, heading treatment, and page density. The refresh should replace ad hoc Tailwind composition with a small set of stable visual rules.

The user provided the new `selah` logo image. The logo uses a dark brown background and warm ivory text. The English logo font is `DM Serif Display`. Korean serif text should use `Noto Serif KR`; Korean sans text and all control-heavy UI should use `Pretendard`.

## Goals

- Make `selah` the visible brand in the app while allowing Storyboard to remain as a secondary/internal product context.
- Replace the shadcn primary color and related semantic tokens with the `selah` palette.
- Establish consistent spacing, radius, typography, surface, and component usage rules.
- Convert the main list experiences toward a mixed density model: dense list-like overview screens and calmer section panels for editing/detail views.
- Keep the first phase focused on light mode. Dark tokens should remain functional but are not a polished launch target.
- Document the design rules briefly enough that future features can follow them without a full design system site.

## Non-Goals

- Full redesign of the PDF export/editor surface in the first phase.
- A public marketing page or hero page.
- A `/design-system` showcase route in the first phase.
- Fully polished dark mode.
- Database, server action, or data model changes.

## Brand Foundations

### Color

Use the logo colors as semantic foundations:

- Primary brown: `#5a3c31`
- Primary foreground / sub ivory: `#f5edcf`
- App background: `#fbf7ee`, a warm off-white derived from the logo palette, not pure white.
- Card and panel surfaces: `#fffdf7`, a near-white warm surface.
- Muted surfaces: `#f1e7d8`, a low-chroma warm neutral for hover, secondary panels, and inactive states.
- Border: `#e4d8c6`, a subtle brown-tinted divider.
- Ring: `#8c6d5c`, a lighter brown focus color that remains visibly related to the brand.
- Destructive, warning, and success colors should remain distinct from the brand brown and must pass contrast checks against their backgrounds.

The implementation should update `app/globals.css` so shadcn semantic tokens such as `--primary`, `--primary-foreground`, `--accent`, `--ring`, `--sidebar`, and `--sidebar-accent` reflect the `selah` palette. Components should continue using semantic classes like `bg-primary` and `text-primary-foreground` where possible.

### Typography

- `DM Serif Display`: logo and English brand mark only.
- `Noto Serif KR`: large Korean page titles, empty states, and occasional brand emphasis.
- `Pretendard`: default app font for body text, buttons, inputs, lists, editing tools, dialogs, and dense data surfaces.

Serif usage should be deliberate. It should create brand presence at page-level moments without making operational UI slower to scan.

### Shape And Spacing

- Use `8px` as the default radius for buttons, inputs, list rows, and regular cards.
- Allow `12px` only for larger panels, modals, sheets, and grouped editing surfaces.
- Avoid very pill-like shapes except for compact metadata badges where the shape improves scanability.
- Standardize spacing around a small scale: `4`, `8`, `12`, `16`, `24`, and `32` pixels.
- Page-level vertical gaps should use `24px` by default; dense lists should use `8px` to `12px` row gaps.

## Layout System

The app shell should become a stable "brand sidebar + work surface" layout.

- Desktop sidebar uses the primary brown surface with ivory `selah` branding.
- Sidebar active state uses a clear but restrained ivory-on-brown treatment.
- Mobile header uses the `selah` mark instead of the current `Storyboard` text, while preserving compact navigation.
- The main work surface uses a warm off-white background with content panels and lists layered above it.

`PageHeader` should become the shared page introduction pattern:

- Optional eyebrow or short context text.
- Page title.
- Optional description.
- Right-aligned primary actions.

Large top-level titles may use `Noto Serif KR`. Subsection titles, list labels, and form labels should stay in `Pretendard`.

## Component Rules

### Button

- `default`: primary brown background with ivory text. Use for the primary action on a page or dialog.
- `outline`: warm surface with brown-tinted border. Use for secondary commands.
- `ghost`: transparent command used in nav, row actions, and icon-only controls.
- `destructive`: separate red semantic treatment, not a brown variant.
- Icon buttons should keep stable square dimensions so rows do not shift when actions appear.

### Card And Panel

Use cards for repeated items only when the content is genuinely card-like. Prefer list rows for scan-heavy collections such as contis and songs.

Use panels for grouped editing surfaces, section editors, dialogs, and detail-page regions. Panels should have restrained borders, warm surfaces, and predictable internal spacing.

### Badge

Define badge meanings by usage:

- Status badges: progress, draft, complete, attention.
- Music metadata badges: key, BPM, section count, sheet music.
- Low-emphasis metadata: muted text or outline badge, not a saturated pill.

Badges should avoid becoming the dominant visual element in dense rows.

### Inputs And Forms

- Inputs, textareas, selects, and date fields should share height, radius, border, focus ring, and label spacing.
- Focus state should use the brand ring but remain accessible.
- Form groups should use consistent label-to-control and control-to-error spacing.

### Dialogs, Sheets, And Drawers

- Dialog and sheet surfaces should use the same warm panel treatment.
- Mobile sheets may use larger radius at the top edge, but desktop panels should stay restrained.
- Actions should be grouped consistently at the bottom or top-right based on the existing component pattern.

## Primary Screen Applications

### Conti List

Convert the conti overview from a generic card grid toward a list-like overview.

- Each row should show date, title, sanitized description, and available metadata such as song count when present.
- Desktop should favor scanability with horizontal alignment and compact row height.
- Mobile may stack into card-like rows, but the information order should remain consistent.
- Hover and active states should use subtle brand-tinted backgrounds or borders.

### Conti Detail

Keep the detail page calmer and panel-based.

- Header area shows date, title, description, and page actions with clear hierarchy.
- Song rows should show order number, song name, key/BPM badges, section summary, and row actions in a stable layout.
- The edit surface should feel like an expanded section panel, not a detached one-off form.
- Add-song and YouTube import actions remain visible but secondary to the song list.

### Song Library

Improve search and browsing density.

- Search becomes a compact tool area under the page header.
- Song items should be list-like or compact-card-like with consistent title, created date, and expandable metadata slots for future sheet/preset indicators.
- Empty and no-results states should use warmer brand language and may use `Noto Serif KR` sparingly.

## Documentation Output

Implementation should add a short design guide at `docs/design-system.md`, covering:

- Brand tokens and semantic token mapping.
- Typography roles.
- Spacing and radius rules.
- When to use cards, panels, rows, and badges.
- Page layout examples for list pages and detail pages.

The guide should be concise and operational. It should help a developer build the next feature without guessing margins or component variants.

## Error Handling And States

This refresh does not change server action behavior or data flow. Existing action result patterns and toast/error behavior should remain intact.

Visual updates should cover:

- Empty states.
- Loading states where existing loading files exist.
- Form validation errors.
- Destructive confirmations.
- Disabled button and pending states.

Error and destructive colors must stay semantically red and should not be replaced by the brand brown.

## Verification

Implementation should be verified with:

- `pnpm lint`
- `pnpm build` when feasible
- Browser review of the three target screens on desktop and mobile widths
- Visual checks for text overflow, overlapping controls, excessive whitespace, and poor contrast

The browser review should include:

- Conti list
- Conti detail
- Song library
- Sidebar and mobile header
- Representative dialog or sheet if touched by primitive changes

## Implementation Boundaries

The first implementation plan should stay within:

- `app/globals.css`
- core components under `components/ui/`
- layout components under `components/layout/`
- conti list/detail components under `components/contis/`
- song list/card components under `components/songs/`
- a short design guide under `docs/`

Avoid unrelated refactors and avoid changing data-fetching, server actions, or schema code unless a type-level UI adjustment requires it.
