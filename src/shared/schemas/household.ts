import { z } from 'zod';
import { recordIdSchema } from '@/shared/schemas/common';

export const invitableRoleSchema = z.enum(['EDITOR', 'VIEWER']);

export const createInviteSchema = z.object({
  role: invitableRoleSchema.default('EDITOR'),
});

// Loose on purpose: the code is normalized server-side, so a retyped one with
// spaces, dashes or lowercase still reaches the lookup.
const inviteCodeSchema = z.string().trim().min(1).max(32);

export const inviteCodeQuerySchema = z.object({ code: inviteCodeSchema });

export const joinHouseholdSchema = z.object({ code: inviteCodeSchema });

export const changeMemberRoleSchema = z.object({ role: invitableRoleSchema });

export const memberIdParamsSchema = z.object({ memberId: recordIdSchema });

export const inviteIdParamsSchema = z.object({ inviteId: recordIdSchema });

export const ACTIVITY_PAGE_SIZE = 25;

export const householdActivityQuerySchema = z.object({
  cursor: recordIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(ACTIVITY_PAGE_SIZE),
});
