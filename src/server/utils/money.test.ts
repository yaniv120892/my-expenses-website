import { describe, expect, it } from 'vitest';
import {
  convertAmount,
  impliedRate,
  isSameMoney,
  toMoneyNumber,
  toMoneyString,
} from './money';

describe('money', () => {
  it('converts without binary floating-point drift', () => {
    expect(convertAmount('0.1', '3')).toBe(0.3);
    expect(convertAmount(0.1 + 0.2, 1)).toBe(0.3);
    expect(convertAmount('19.99', '3.074')).toBe(61.45);
  });

  it('rounds half away from zero, for charges and refunds alike', () => {
    expect(toMoneyString('1.005')).toBe('1.01');
    expect(toMoneyString('-1.005')).toBe('-1.01');
    expect(convertAmount('-10', '3.0745')).toBe(-30.75);
    expect(convertAmount('10', '3.0745')).toBe(30.75);
  });

  it('keeps an implied rate to eight places', () => {
    expect(impliedRate('92.35', '25')).toBe('3.69400000');
    expect(impliedRate('100', '3')).toBe('33.33333333');
  });

  it('reads Prisma-style decimals through toString', () => {
    const prismaDecimal = { toString: () => '12.30' };
    expect(toMoneyNumber(prismaDecimal)).toBe(12.3);
    expect(isSameMoney(prismaDecimal, 12.3)).toBe(true);
    expect(isSameMoney('12.30', '12.31')).toBe(false);
  });

  it('handles large amounts exactly', () => {
    expect(toMoneyString('999999999999.99')).toBe('999999999999.99');
    expect(convertAmount('123456789.12', '3.5')).toBe(432098761.92);
  });
});
