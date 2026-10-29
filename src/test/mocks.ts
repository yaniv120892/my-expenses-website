import type { MockInstance } from 'vitest';

export function firstInvocationOrder(mock: MockInstance): number {
  const [order] = mock.mock.invocationCallOrder;
  if (order === undefined) {
    throw new Error(`${mock.getMockName()} was never called`);
  }
  return order;
}
