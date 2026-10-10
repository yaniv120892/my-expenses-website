import { describe, it, expect } from 'vitest';
import {
  createAutoApproveRuleSchema,
  processImportSchema,
  updateAutoApproveRuleSchema,
} from '@/shared/schemas/imports';

const rule = (descriptionPattern: string) => ({
  descriptionPattern,
  categoryId: 'cat-1',
  type: 'EXPENSE',
});

describe('processImportSchema paymentMonth', () => {
  const upload = (paymentMonth?: string) =>
    processImportSchema.safeParse({
      fileUrl: 'https://example.com/statement.xlsx',
      originalFileName: 'statement.xlsx',
      paymentMonth,
    });

  it('stores a month as MM/YYYY', () => {
    expect(upload(' 3/2026 ').data?.paymentMonth).toBe('03/2026');
  });

  it('treats a blank month as none', () => {
    expect(upload('  ').data?.paymentMonth).toBeUndefined();
    expect(upload().data?.paymentMonth).toBeUndefined();
  });

  it('rejects a month it cannot read', () => {
    expect(upload('13/2026').success).toBe(false);
    expect(upload('2026-03').success).toBe(false);
  });
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
