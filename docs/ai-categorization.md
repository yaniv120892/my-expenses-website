# AI calls and categorization

Load before changing an AI provider client, a `CategorySuggester`, `AI_PROVIDER` or
`AI_CATEGORY_SUGGESTER`, a prompt in `src/server/services/ai/`, or anything that calls a model per
transaction row.

Transaction categories come from a user's own description mapping (`UserCategoryMapping`) first,
then the AI provider.

## Every model call made per transaction row is bounded

The OpenAI and Gemini clients behind `AIProvider`, and any `CategorySuggester`, take their timeout
(and retry count where the SDK has one) from `AI_REQUEST_LIMITS`
(`src/server/services/ai/requestLimits.ts`), never an SDK default, because those calls run one row
at a time inside a batch request. A timeout is an ordinary provider failure that fails its row;
the limit is per call, so a batch against a degraded provider can still outrun the function. The
assistant's Mastra model is a separate streaming client and is not bound by these limits.

## Only the category decision may leave the `AI_PROVIDER` model

`AIServiceFactory.getCategorySuggester()` is the one place that decides, on
`AI_CATEGORY_SUGGESTER`; the prose-producing methods have no such flag. Every suggester offers
exactly the option list `src/server/services/ai/prompts.ts` builds and ends in its
`buildCategoryEvaluation`, so the flag changes the model and never the question or the record.

`npm run categories:compare` benchmarks the suggesters against each other →
[local-development.md](local-development.md), for its arguments.

## Assistant

The chat assistant is a Mastra agent in `src/server/services/assistant/` (tools, PG-backed memory,
and `financeQueries.ts`, the read-side figures both assistants share). Mastra keeps its own tables
in the `mastra` Postgres schema, not Prisma-managed. Dashboard AI insights are generated in the
request's locale and cached per locale.
