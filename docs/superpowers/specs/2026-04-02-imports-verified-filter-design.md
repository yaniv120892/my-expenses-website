# Imports Tab — Verified Filter

**Date:** 2026-04-02  
**Status:** Approved

## Context

The Imports list already displays a `Verified` / `Not Verified` indicator (CheckCircle/Cancel icon) for each import row, but there is no way to filter by this field. Users want to quickly see only unverified imports (e.g., to act on them) or only verified ones (to confirm completion).

## Design

### Component Changed
`my-expenses-website/src/components/ImportList.tsx` — the only file modified.

### State
Add `isVerifiedFilter: "ALL" | "true" | "false"` alongside the existing filter state (`statusFilter`, `paymentMonthFilter`, `cardFilter`). Default: `"ALL"`.

### UI — ToggleButtonGroup
A MUI `ToggleButtonGroup` (exclusive, small size) placed in the existing filter `Stack`, after the other filters:

```
[ All ]  [ Verified ]  [ Not Verified ]
```

On mobile the Stack already switches to column layout, so this stacks naturally.

### Filtering Logic
Add one condition to the existing `useMemo` filter chain:
- `"ALL"` → no change
- `"true"` → `import.isVerified === true`
- `"false"` → `import.isVerified === false`

## Verification
1. Run `npm run dev:website` and navigate to the Imports tab
2. Confirm the toggle appears in the filter bar
3. Toggle to "Verified" — only verified imports shown
4. Toggle to "Not Verified" — only unverified imports shown
5. Toggle back to "All" — all imports shown
6. Confirm it composes correctly with the other filters (status, month, card)
