import { z } from 'zod';

// The insights body is produced by an LLM asked to reply with JSON, so its
// shape is a request rather than a guarantee — parse it before trusting it.
export const dashboardInsightsResponseSchema = z.object({
  unusualSpending: z.array(z.string()),
  summary: z.string(),
});
