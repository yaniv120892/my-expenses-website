# UI, language and client data

Load before adding a page, a user-visible string, a formatted number, money or date, an RTL-aware
icon or chart, or a client query that waits on server-side change.

The styling and mutation-outcome rules for `.tsx` files are in `.claude/rules/ui-components.md`;
they load when you open a component.

## Shell

`src/app/(app)/` holds the authenticated pages inside `ExpensesShell`, the shared `AppShell` from
`@yaniv120892/my-ui` (drawer on desktop; top bar and a four-item bottom bar plus "More" on phones).
Auth pages (`src/app/(auth)/`) sit in its `AuthCard`. `src/app/join/` redeems a household invite
→ [household-membership.md](household-membership.md), before changing it. `src/config/appUrls.ts` lists the sibling
apps the drawer links to.

## Design and language

Design and language come from `@yaniv120892/my-ui`, shared with My Investments and My Shopping.

- The root layout reads the locale with `getLocale()` (a `locale` cookie, then
  `Accept-Language`, default Hebrew), sets `<html lang dir>`, and renders `DesignProvider` (theme,
  RTL emotion cache, i18n).
- Every user-visible string is a key in `src/i18n/messages/<area>.ts` — English the source, Hebrew
  beside it, merged in `src/i18n/messages/index.ts`, held equal by `messages.test.ts` — read with
  `useT()`.
- Numbers, money and dates go through `useAppFormat()` (`src/i18n/useAppFormat.ts`, built on the
  package's `useFormat`, which caches each Intl formatter per locale and options and formats dates
  in one shared time zone); a pure helper that builds UI text takes `t` and the formatter as
  arguments.
- Data (descriptions, categories, announcements, assistant replies) and text sent to Telegram,
  email or agents is not translated; the server formatters in `src/utils/format.ts` are for those.
- Layout is written for LTR and the RTL plugin flips physical sides. What it cannot flip is
  mirrored from the locale's direction: an icon pointing along the reading direction takes
  `MIRROR_IN_RTL_SX` (`src/components/rtlStyles.ts`), and a chart sets its axes from
  `useI18n().direction` (`src/components/trends/trendFilters.ts`).
- Dashboard AI insights are generated in the request's locale and cached per locale.

## Server state the client did not change

Server state that changes without the client acting — extraction webhooks and a Telegram chat
being linked — is observed by polling: `useImportsQuery` sets a `refetchInterval` while any import
is in flight and `false` otherwise (see `src/utils/importStatus.ts`), overriding the global 60s
`staleTime`; `useUserSettingsQuery` does the same while a link code is out.
