export function assertNever({ value, what }: { value: never; what: string }): never {
  throw new Error(`Unhandled ${what}: ${String(value)}`);
}
