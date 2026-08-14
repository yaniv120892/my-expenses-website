import { z } from 'zod';

// Bounds one request, not one acknowledgement: the client splits larger sets
// into consecutive requests of this size.
export const MAX_ACKNOWLEDGE_IDS = 50;

export const acknowledgeAnnouncementsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(MAX_ACKNOWLEDGE_IDS),
});

export type AcknowledgeAnnouncementsRequest = z.infer<
  typeof acknowledgeAnnouncementsSchema
>;
