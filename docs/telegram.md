# Telegram

Load before changing the Telegram bot, `/api/webhook`, Settings → Telegram, or how a user's
notification chat is linked or unlinked. The ops alert chat is separate: README "Alerting
(Telegram)".

## A Telegram chat is linked only by the bot hearing from it

- No request names a chat id: the settings PUT schema has no provider field (an older client's
  `provider.telegramChatId` is stripped), GET reports only `telegramLinked`, and the test send
  goes to the linked chat.
- Settings → Telegram asks `POST /api/user/settings/telegram-link` for a random code (Redis
  `telegramLinkCode:<code>` → user id, for `LINK_CODE_TTL_SECONDS` in
  `src/server/services/telegramLinkService.ts`) and shows `/start <code>`, plus a `t.me` deep
  link when `TELEGRAM_BOT_USERNAME` is set.
- The webhook takes the code with one GETDEL (`takeValue`), so it binds at most once, writes
  `{ chatId }` to the user's `UserNotificationProvider` through `userRepository.setTelegramChat` —
  its one writer — and replies in the chat; an unknown, expired or used code binds nothing and
  gets the same neutral reply.
- `DELETE` on the same route unlinks.
- While a link code is out, `useUserSettingsQuery` polls →
  [ui.md](ui.md), for the polling pattern.

## Webhook

`/api/webhook` is the `auth: 'telegram'` route, checked by its secret-token header; the bot only
sends, except for `/start <code>`. Register it per environment with
`setWebhook(url=${WEBSITE_URL}/api/webhook, secret_token=${TELEGRAM_WEBHOOK_SECRET})` (README
"Deployment (Vercel)" has the full URL).
