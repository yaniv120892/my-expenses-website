import { z } from 'zod';

export const acknowledgeAnnouncementsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(50),
});

export type AcknowledgeAnnouncementsRequest = z.infer<
  typeof acknowledgeAnnouncementsSchema
>;
