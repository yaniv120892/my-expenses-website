import { describe, expect, it } from 'vitest';
import { isForeignCurrency } from './currency';

describe('isForeignCurrency', () => {
  it('is true only for a known currency other than ILS', () => {
    expect(isForeignCurrency('USD')).toBe(true);
    expect(isForeignCurrency('ILS')).toBe(false);
  });

  it('reads a missing currency as ILS, as a pre-currency payload means it', () => {
    expect(isForeignCurrency(null)).toBe(false);
    expect(isForeignCurrency(undefined)).toBe(false);
  });
});
