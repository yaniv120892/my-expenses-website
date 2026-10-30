import { z } from 'zod';
import { recordIdSchema } from '@/shared/schemas/common';

export const invitableRoleSchema = z.enum(['EDITOR', 'VIEWER']);

export const createInviteSchema = z.object({
  role: invitableRoleSchema.default('EDITOR'),
});

// Loose on purpose: the code is normalized server-side, so a retyped one with
// spaces, dashes or lowercase still reaches the lookup.
const inviteCodeSchema = z.string().trim().min(1).max(32);

export const inviteCodeRequestSchema = z.object({ code: inviteCodeSchema });

export const changeMemberRoleSchema = z.object({ role: invitableRoleSchema });

export const memberIdParamsSchema = z.object({ memberId: recordIdSchema });

export const inviteIdParamsSchema = z.object({ inviteId: recordIdSchema });
