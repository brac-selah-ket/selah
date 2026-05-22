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
