// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { renderWithClient } from '@/test/renderWithClient';
import ImportList from '@/components/ImportList';
import { Import, ImportFileType, ImportStatus } from '@/types/import';

const importFor = (paymentMonth: string): Import => ({
  id: paymentMonth,
  fileUrl: '',
  originalFileName: `statement-${paymentMonth}.xlsx`,
  importType: ImportFileType.VISA_CREDIT,
  status: ImportStatus.COMPLETED,
  createdAt: '2026-04-02T10:00:00.000Z',
  updatedAt: '2026-04-02T10:00:00.000Z',
  creditCardLastFourDigits: '4730',
  paymentMonth,
  isVerified: false,
});

const imports = ['01/2026', '12/2025', '02/2026'].map(importFor);

vi.mock('@/hooks/useImports', () => ({
  useImportsQuery: () => ({ data: imports, isLoading: false }),
  useDeleteImportMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useRematchImportMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/useBreakpoints', () => ({ useIsMobile: () => false }));

afterEach(cleanup);

const renderedMonths = () =>
  screen
    .getAllByText(/^statement-/)
    .map((cell) => cell.textContent?.replace(/^statement-|\.xlsx$/g, ''));

describe('ImportList payment month order', () => {
  it('sorts rows by date, year first', () => {
    renderWithClient(
      <ImportList onImportClick={vi.fn()} expandedImportId={null} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Payment Month/ }));

    expect(renderedMonths()).toEqual(['12/2025', '01/2026', '02/2026']);
  });

  it('lists filter options by date, year first', () => {
    renderWithClient(
      <ImportList onImportClick={vi.fn()} expandedImportId={null} />,
    );

    fireEvent.mouseDown(screen.getAllByRole('combobox')[1]);

    const options = within(screen.getByRole('listbox'))
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(options).toEqual(['All', '12/2025', '01/2026', '02/2026']);
  });

  it('labels each status in words rather than its enum value', () => {
    renderWithClient(
      <ImportList onImportClick={vi.fn()} expandedImportId={null} />,
    );

    expect(screen.getAllByText('Completed')).toHaveLength(3);
    expect(screen.queryByText('COMPLETED')).toBeNull();
  });
});
