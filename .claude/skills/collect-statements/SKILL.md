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

`scripts/import-statements.ts` reads the payment month and card from this name,
and the payment month is half of what identifies a duplicate import. The
portals' own filenames do not carry the billing month — Cal's are dated the
day you downloaded them — so renaming is not optional.

Put every file for a run in one directory. The script targets
`http://127.0.0.1:3000` unless told otherwise, so **a run with no `--base-url`
imports into whatever is on this machine**, never production.

## Rehearsing a provider before its first production run

Rehearse over a Neon branch of the production database, not the seeded local
one: the seed holds only Jan–Feb 2026 rows, so a real statement's first run
there is all CREATE and the MERGE path — matching rows onto real pending
transactions — goes untested until production. The branch is disposable; reset
it from its parent between runs.

1. `~/.config/my-expenses/rehearsal.env` holds the branch's `DATABASE_URL` and
   `DIRECT_URL`, `REMOTE_DATABASE_OK=1`, `SESSION_USER_EMAIL`, production's
   `PRISMA_FIELD_ENCRYPTION_KEY`, the real `IMPORTS_S3_*`, and
   `EXCEL_EXTRACTION_AGENT_URL=http://127.0.0.1:51242`. It stays outside the
   repo, and is composed by hand — a wholesale `vercel env pull` would carry
   production's `DATABASE_URL`.
2. Terminal 1, the real extractor:
   `cd ~/Develop/my-expenses-agent && npm run dev` (its `.env` has `PORT=51242`).
3. Terminal 2: `set -a; source ~/.config/my-expenses/rehearsal.env; set +a; npm run dev:local`.
   The summary must show the branch's `ep-…` host under `Database` and the
   mock extractor must not have started.
4. Terminal 3, with the bearer the summary printed:

```bash
IMPORT_API_TOKEN=<bearer> npm run statements:import -- <dir> --dry-run
```

Read the table, then re-run without `--dry-run` to commit. The commit does not
upload again: the dry run recorded each file's import in
`.import-statements.json` beside the statements (per target, so a rehearsal
never stands in for production), and the commit approves those imports. If the
plan differs from what the dry run showed, the script says so before asking.

The branch's compute scales to zero after five idle minutes, and the local
server's connection pool does not recover from it: requests then fail with
`Timed out fetching a new connection from the connection pool` or hang. Anything
that leaves the database quiet that long — reading a plan, a stalled model call
during approval — needs the stack restarted before the next run. Approval is
atomic per row, so a commit that failed part-way leaves its failed rows
PENDING, and re-running the same command applies just those.

A commit takes seconds per created row locally: the categorizer is not running,
so every row falls back to a model call for its category.

Then **run the same directory once more with `--resubmit`** — that uploads
every file again, which is the re-import path that used to inject phantom
charges, and the one worth watching. Without the flag a re-run reuses the
recorded imports and only tells you nothing is left to reconcile.

## Running against production

The bearer is the `session` cookie from a logged-in browser tab (DevTools →
Application → Cookies → the site). It is a live seven-day credential: keep it
out of transcripts and shell history — put it in a file and point the script
at that, or paste it from the clipboard.

```bash
chmod 600 ~/.config/my-expenses/production-token   # the cookie value, one line
IMPORT_API_TOKEN_FILE=~/.config/my-expenses/production-token \
  npm run statements:import -- <dir> --base-url=https://<site> --dry-run
```

The script prints its target before the first upload and, for a non-local
target, asks for the **hostname** typed back rather than `y` before approving
anything. Start with a single already-imported month: an empty or all-MERGE
plan proves the connection and the token without changing a row.

A dry run is not free of writes. Upload and process create the import and its
pending rows on the target; only the approve step is skipped. A dry run you do
not follow with a commit leaves a pending import that the imports page can
delete — and if you delete it, run with `--resubmit`, since the manifest still
points at it.

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
6. Cards are a carousel at the top (arrows either side, wrapping around);
   months are tabs below it (`יולי | אוגוסט | ספטמבר`) with arrows for earlier
   months. The selected month stays put when the card changes, so do one month
   across every card, then the next. Each card shows its own billing day
   (`חיוב ב 15/08`) — cards on one account bill on different days.
   The carousel sits above the fold only at the top of the page; press `Home`
   before clicking its arrows. The page also holds a marketing carousel whose
   "next slide" button is easy to hit by mistake.
7. `ייצוא` opens a menu; `ייצוא לאקסל` in it downloads an `.xlsx`. **Every
   export arrives twice** (`… .xlsx` and `… (1).xlsx`, identical rows), so
   keep one and delete the other before renaming. Chrome's filename carries
   the card but the download date, not the billing month — read the second
   title row to confirm the month before naming the file.

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
outside it — a useful check that nothing was dropped in extraction. After the
last row sits a single-cell footer, which is why the sheet has one more
line than the import has rows.

There are two amount columns: `סכום עסקה` (original) and `סכום חיוב` (actually
billed). They differ on foreign-currency charges, and the billed one is what
must land as the value — the check above only holds for it.

To verify a run without reading rows into the transcript, compare each
import's summed `EXPENSE` values with the second title row's total; they
agree to the agora when nothing was dropped.

## Isracard — isracard.co.il

Verified end to end.

1. Go straight to `https://digital.isracard.co.il/personalarea/Login/`.
   Reaching it from the homepage opens it in a **new tab**.
2. Default is `כניסה באמצעות SMS`: `תעודת זהות` (or `דרכון`) + the card's last
   four digits → `שלח קוד לנייד`. `או כניסה עם סיסמה קבועה` is the
   password alternative.
3. The page carries a reCAPTCHA. Never attempt it — if it challenges, the human
   completes it.
4. **Hand over here.** After login you land on
   `https://web.isracard.co.il/StatusPage`. Wait for the human to say the cards
   page is showing: loading a page while the login is still redirecting sends
   the tab back to the login form.
5. Every statement has its own address, so no clicking through menus is
   needed:
   `https://web.isracard.co.il/transactions?monthAndYear=<MM>.<YYYY>&cardSuffix=<last4>`.
   Without `cardSuffix` the page opens on the first card, and the carousel
   arrows switch cards. The page already lists `עסקאות למועד חיוב` (by billing
   date), so the month in the address is the billing month.
6. The export is the `הורדה ל- Excel` button (`aria-label="download excel"`) at
   the bottom of the list. It downloads one file per click, already named
   `<last4>_<MM>_<YYYY>.xlsx`.

The session ends after roughly ten idle minutes (`היי, לא היית כאן הרבה זמן`),
and every page then redirects to the login form. Export all months in one go
right after the hand-back, and do the checking afterwards.

Chrome needs two settings for this portal, and both belong to the human:
`Ask where to save each file before downloading` off, and
`web.isracard.co.il` allowed under Site settings → Automatic downloads. Without
the second, only the first export of a visit arrives. The later clicks
still build the file (the page calls `URL.createObjectURL` and clicks a
download link), but Chrome drops them without a prompt.

The `פרטים אינם סופיים` notice appears on every month, so it says nothing
about whether a month has closed. A month is closed once its billing day on
the card (`לחיוב ב-10.09`) has passed.

### What Isracard's file looks like

Title rows first: `פירוט עסקאות` with the month name (`ספטמבר 2026`), then
the card name with its last four digits and the month's billed total
(`פלטינה מסטרקארד - 9301 … ₪ 1,048.36`), then the cardholder's name. A
`עסקאות למועד חיוב` label comes next, then the header row:

```
תאריך רכישה | שם בית עסק | סכום עסקה | מטבע עסקה | סכום חיוב | מטבע חיוב | מס' שובר | פירוט נוסף
```

Dates are text, `DD.MM.YY`. After the charge rows comes a short
`סה"כ לחיוב החודש בכרטיס בש"ח` line whose number equals the title row's
total. That total is the sum of `סכום חיוב`, the shekel amount actually
billed. Charges made abroad carry the original amount and currency (`€`, `$`)
in `סכום עסקה`/`מטבע עסקה`, so the original column sums to nothing
meaningful. A later `עסקאות בחיוב עתידי` block only holds a count and a note
about charges abroad billed in a later month. It has no rows to extract.

## American Express IL — americanexpress.co.il

Verified end to end. Amex IL runs on Isracard's platform: after login it is the
same site under another hostname, and the file has the same layout.

1. Go straight to `https://he.americanexpress.co.il/personalarea/login/`. The
   homepage's `החשבון שלי` links there.
2. The login form matches Isracard's, down to the reCAPTCHA: `כניסה באמצעות SMS`
   with `תעודת זהות` + the card's last four digits → `שלחו קוד לנייד`, or
   `או כניסה עם סיסמה קבועה`.
3. **Hand over here.** After login you land on
   `https://web.americanexpress.co.il/StatusPage`.
4. Every statement has its own address:
   `https://web.americanexpress.co.il/transactions?monthAndYear=<MM>.<YYYY>&cardSuffix=<last4>`,
   listed by billing date. The `הורדה ל- Excel` button
   (`aria-label="download excel"`) downloads one file named
   `<last4>_<MM>_<YYYY>.xlsx`. Rename it `amex-<last4>-<MM>-<YYYY>.xlsx`.

The automatic-downloads permission belongs on `web.americanexpress.co.il`, the
host the download runs on. Allowing `he.americanexpress.co.il`, where the login
lives, does nothing.

The file reads exactly as Isracard's does (see above): title rows with the
month and billed total, `תאריך רכישה | שם בית עסק | סכום עסקה | …`, text
`DD.MM.YY` dates, and a `סה"כ לחיוב החודש בכרטיס בש"ח` line equal to the sum of
`סכום חיוב`.

### Merges onto an unrelated recurring bill

Read every MERGE whose two descriptions share nothing. The matcher can merge a
small charge onto a pending recurring bill that happens to be within tolerance.
The model sees only descriptions, not the candidate's category or that it
recurs (YAN-114). On Amex this merged the card's `דמי כרטיס הנפקה` fee
(22.90) and a 21.90 pharmacy purchase onto the monthly `019` phone bill
(22.00 / 20.00). Committing that marks the phone bill paid under the wrong
charge.

Before the commit, approve each such row on its own. The row then becomes a
new transaction and leaves the pending bill alone:

```bash
curl -X POST -H "Authorization: Bearer <token>" -H 'Content-Type: application/json' \
  -d '{"description":"<row description>","value":<row value>,"date":"<row date>","type":"EXPENSE"}' \
  <base-url>/api/imports/transactions/<imported-row-id>/approve
```

Then run the commit. The script reports that the plan changed since the preview
(`-1 row(s)` per row taken out) and applies the rest.

## After collecting

Statements are financial records. Keep them in a working directory outside the
repo, and never paste their contents into a transcript or an artifact beyond
the few rows needed to verify a match.
