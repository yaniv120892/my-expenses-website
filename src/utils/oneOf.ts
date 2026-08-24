// MUI change handlers hand back a widened `string`, which is why assigning one
// to a literal-union setter used to need a cast. This narrows instead, so a
// value the control should never emit is caught rather than asserted away.
export function isOneOf<T extends string>(
  options: readonly T[],
  value: string,
): value is T {
  return options.some((option) => option === value);
}
