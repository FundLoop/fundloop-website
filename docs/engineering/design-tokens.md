# Design Tokens

Session 07 establishes the shared token model for FundLoop’s light and dark themes.

## Goals

- keep one durable theme system for both public marketing surfaces and denser operational screens
- reduce one-off `slate`, `emerald`, and ad hoc white-overlay styling drift
- make later visual redesign sessions build on shared primitives instead of restyling each page independently

## Token families

Primary token definitions live in [app/globals.css](../../app/globals.css).

### Core shadcn-compatible tokens

These continue to back the existing `background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `accent`, `muted`, `destructive`, `border`, `input`, and `ring` contract used by shared UI primitives.

### Semantic surface tokens

- `--surface-canvas`
- `--surface-subtle`
- `--surface-panel`
- `--surface-panel-strong`
- `--surface-elevated`
- `--surface-inset`
- `--surface-border`
- `--surface-border-strong`
- `--surface-shadow-soft`
- `--surface-shadow-panel`
- `--surface-shadow-floating`
- `--surface-grid`

Use these for app-shell backgrounds, cards, popovers, forms, and elevated panels instead of hard-coded `bg-white/...`, `dark:bg-slate-...`, or one-off border values.

### Semantic text tokens

- `--text-strong`
- `--text-base`
- `--text-muted`
- `--text-soft`
- `--text-inverse`

These should replace repeated raw `text-slate-*` / `dark:text-slate-*` styling when a component is part of the shared system.

### Interaction and status tokens

- `--interactive-primary`
- `--interactive-primary-hover`
- `--interactive-primary-foreground`
- `--interactive-secondary`
- `--interactive-secondary-hover`
- `--interactive-ghost-hover`
- `--status-success`
- `--status-success-soft`
- `--status-warning`
- `--status-warning-soft`
- `--status-danger`
- `--status-danger-soft`
- `--status-info`
- `--status-info-soft`

### Layout and type tokens

- `--space-section`
- `--space-section-lg`
- `--page-gutter`
- `--type-eyebrow`
- `--tracking-eyebrow`
- `--type-section-title`
- `--type-body-lg`
- `--tracking-display`

Use these for shared marketing/layout primitives so spacing and typography stay consistent across pages.

## Primitive ownership

Shared primitives that should consume the token system first:

- [components/ui/button.tsx](../../components/ui/button.tsx)
- [components/ui/card.tsx](../../components/ui/card.tsx)
- [components/ui/input.tsx](../../components/ui/input.tsx)
- [components/ui/textarea.tsx](../../components/ui/textarea.tsx)
- [components/ui/select.tsx](../../components/ui/select.tsx)
- [components/marketing/page-chrome.tsx](../../components/marketing/page-chrome.tsx)

## Practical rules

- Prefer semantic token variables over raw palette classes for shared UI.
- Keep page-level exceptions localized; if the same styling appears more than twice, promote it into the shared token system or primitive layer.
- Preserve strong contrast in both themes before introducing additional accent colors or decorative surfaces.
- When architecture or theming assumptions change, update this doc and [docs/engineering/README.md](./README.md) before closing the task.
