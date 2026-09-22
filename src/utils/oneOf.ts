// MUI change handlers hand back a widened `string`; narrowing rather than
// casting catches a value the control should never emit.
export function isOneOf<T extends string>(
  options: readonly T[],
  value: string,
): value is T {
  return options.some((option) => option === value);
}
