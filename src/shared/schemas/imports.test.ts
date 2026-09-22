import { describe, it, expect } from 'vitest';
import {
  createAutoApproveRuleSchema,
  updateAutoApproveRuleSchema,
} from '@/shared/schemas/imports';

const rule = (descriptionPattern: string) => ({
  descriptionPattern,
  categoryId: 'cat-1',
  type: 'EXPENSE',
});

describe('auto-approve rule descriptionPattern', () => {
  it('rejects a blank pattern, which would match every row', () => {
    expect(createAutoApproveRuleSchema.safeParse(rule('   ')).success).toBe(
      false,
    );
    expect(
      updateAutoApproveRuleSchema.safeParse({ descriptionPattern: '' }).success,
    ).toBe(false);
  });

  it('stores the pattern trimmed', () => {
    expect(
      createAutoApproveRuleSchema.parse(rule('  netflix ')).descriptionPattern,
    ).toBe('netflix');
  });
});
