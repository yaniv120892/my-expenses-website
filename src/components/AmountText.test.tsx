// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { DesignTestProvider } from '@/test/renderWithClient';
import AmountText from './AmountText';

const LEFT_TO_RIGHT_MARK = '‎';

describe('AmountText', () => {
  afterEach(cleanup);

  it('signs a plain number by direction', () => {
    render(
      <DesignTestProvider>
        <AmountText value={42} type="EXPENSE" format="signed" />
        <AmountText value={1200} type="INCOME" format="signed" />
      </DesignTestProvider>,
    );
    expect(screen.getByText('-42')).toBeTruthy();
    expect(screen.getByText('+1,200')).toBeTruthy();
  });

  // A hand-prefixed "-" shows after the digits in a right-to-left line.
  it('keeps the minus before the digits in Hebrew', () => {
    render(
      <DesignTestProvider locale="he">
        <AmountText value={42} type="EXPENSE" format="signed" />
      </DesignTestProvider>,
    );
    expect(screen.getByText(`${LEFT_TO_RIGHT_MARK}-42`)).toBeTruthy();
  });
});
