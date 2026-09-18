import { describe, expect, it } from 'vitest';
import { isCardHoldingFee } from './cardFees';

describe('isCardHoldingFee', () => {
  it.each([
    'דמי כרטיס',
    'דמי כרטיס /הנפקה',
    'דמי כרטיס הנפקה',
    'דמי הנפקה',
    'דמי שימוש',
    'דמי חבר',
    'שופרסל - דמי כרטיס',
    'Card Fee',
    'ANNUAL FEE',
    'annual membership fee',
  ])('flags %s', (description) => {
    expect(isCardHoldingFee(description)).toBe(true);
  });

  it.each([
    'דמי רישום קטנציקים עומרי',
    'דמי לידה',
    'דמי אבטלה - סתיו',
    'כרטיס זיכוי',
    'feeder store',
    '',
  ])('does not flag %s', (description) => {
    expect(isCardHoldingFee(description)).toBe(false);
  });
});
