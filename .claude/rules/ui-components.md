---
# This repo's own rule, not vendored from claude-config.
paths:
  - "src/**/*.tsx"
description: Styling and mutation-outcome rules for this repo's React components and pages.
---

# UI components

**Styling** — MUI `sx` + theme tokens only
> Pattern: Colours read `(theme.vars ?? theme).palette`, so dark mode resolves; charts use
> `.charts`: `positive` for money in, `negative` for money out.
> Avoid: Inline `style=`, CSS custom properties, global utility classes, hardcoded hex in
> components.

**Who reports a mutation's outcome is per component, not per prop name**
> Pattern: `TransactionForm` and `ScheduledTransactionForm` own it: they read a resolved
> `onSubmitAction`/`onDeleteAction` as success, show the snackbar and call `onCloseAction`, so a
> handler passed to them must let the rejection propagate or the form reports success on a failed
> save and closes over the unsaved edit. `PendingTransactionsList` is the opposite — it has no
> error surface, so its handlers must not reject and the page catches (`runWithNotice`). A new
> dialog picks one and says which in its props.

Strings, formatting and RTL: `docs/ui.md`, before adding user-visible text or a formatted value.
