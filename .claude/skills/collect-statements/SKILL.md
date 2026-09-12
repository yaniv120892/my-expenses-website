---
name: collect-statements
description: Download monthly credit-card statements from the Israeli card portals (Cal, Isracard, American Express IL) with Claude in Chrome, then import and reconcile them against pending transactions. Use when collecting statements for an import, backfilling past months, or running the monthly reconciliation ritual.
---

# Collecting card statements

The monthly ritual: pull each portal's statement, drop the files in one folder,
and let `npm run statements:import` reconcile them against pending transactions.

**Announce at start:** "I'm using the collect-statements skill."

## The division of labour

Claude never types credentials. Government ID numbers, card digits and
passwords go in by hand or from the browser's password manager; Claude drives
navigation, month selection and export. The one-time password is always the
human's — no portal here can be automated past it.

So the shape of every portal is the same:

1. Claude opens the login page and **stops**.
2. The human logs in and clears the OTP, then says so.
3. Claude selects card and month, exports, and repeats per card.

One login covers every card on that portal and every month, so the cost is one
login per portal per sitting — not one per card or per month. Do all months for
a portal in a single session.

## Before the first run

Turn off Chrome's **"Ask where to save each file"** at
`chrome://settings/downloads`. Left on, every export blocks on a native macOS
save dialog that Claude cannot see or dismiss, and the download sits unfinished
in `~/Downloads/.com.google.Chrome.XXXXXX`. With thirty files that is thirty
manual dialogs.

## Naming what you download

Rename each file to:

```
<issuer>-<last4>-<MM>-<YYYY>.xlsx      e.g. cal-6125-08-2026.xlsx
```

`scripts/import-statements.ts` reads the payment month and card from this name.
It is also how the script follows a statement whose import gets merged into an
older one for the same card and month. The portals' own filenames do not carry
the billing month — Cal's are dated the day you downloaded them — so renaming
is not optional.

Put every file for a run in one directory, then:

```bash
IMPORT_API_TOKEN=<bearer> npm run statements:import -- <dir> --dry-run
```

Read the table, then re-run without `--dry-run` to commit.

## Cal — cal-online.co.il

Verified end to end.

1. `https://www.cal-online.co.il/` → `כניסה לחשבון` (top left). The login is a
   **modal on the homepage**, not its own URL.
2. Tab `כניסה מהירה`: ID number + last 4 card digits → `שלחו לי סיסמה ב-SMS`.
   The code can also come by WhatsApp or phone call. Tab
   `כניסה עם שם משתמש` takes a username and password instead — worth trying,
   since it may skip the OTP on a remembered device.
3. **Hand over here.** After login you land on
   `digital-web.cal-online.co.il/dashboard`.
4. A WhatsApp marketing modal may appear — decline it (`לא, תודה`). Never
   accept marketing or consent prompts on the user's behalf.
5. Sidebar `עסקאות וחיובים` → `עסקאות בכרטיס לפי מועד חיוב`, which lands on
   `https://digital-web.cal-online.co.il/transactions` and can be opened
   directly on later runs.
6. Cards are a carousel at the top (arrows either side); months are tabs below
   it (`יולי | אוגוסט | ספטמבר`) with arrows for earlier months. Pick the card,
   then the month.
7. `ייצוא` → `ייצוא לאקסל` downloads an `.xlsx`.

Choose `לפי מועד חיוב` (by billing date) rather than `לפי תאריך ביצוע` (by
transaction date): the billing month is what the import records as
`paymentMonth`. `דפי פירוט` gives PDFs, which the extractor handles far worse
than the spreadsheet.

Skip the current month until it closes — mid-cycle it holds
`עסקאות בתהליך קליטה` rows that are not yet charged.

### What Cal's file looks like

Two title rows, then the header row:

```
תאריך עסקה | שם בית עסק | סכום עסקה | סכום חיוב | סוג עסקה | ענף | הערות
```

The sheet is right-to-left, the card's last four digits sit in the first title
row, and the second carries the billing date and total
(`עסקאות לחיוב ב-10/08/2026: 3,083.91 ₪`). That total is the sum of the
**expense** rows; refunds such as `החזר CashPro` are typed `INCOME` and sit
outside it — a useful check that nothing was dropped in extraction.

There are two amount columns: `סכום עסקה` (original) and `סכום חיוב` (actually
billed). They differ on foreign-currency charges.

## Isracard — isracard.co.il

Login verified; the statement pages are **not yet mapped** — fill this in on
the next run rather than guessing.

1. Go straight to `https://digital.isracard.co.il/personalarea/Login/`.
   Reaching it from the homepage opens it in a **new tab**.
2. Default is `כניסה באמצעות SMS`: `תעודת זהות` (or `דרכון`) + the card's last
   four digits → `שלח קוד לנייד`. `או כניסה עם סיסמה קבועה` is the
   password alternative.
3. The page carries a reCAPTCHA. Never attempt it — if it challenges, the human
   completes it.
4. **Hand over here.**

## American Express IL — americanexpress.co.il

Not yet mapped. Amex IL runs on Isracard's platform, so expect that flow to
resemble Isracard's rather than Cal's — but confirm before writing it down.

## After collecting

Statements are financial records. Keep them in a working directory outside the
repo, and never paste their contents into a transcript or an artifact beyond
the few rows needed to verify a match.
