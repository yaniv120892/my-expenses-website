// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { requireInput } from '@/test/dom';
import { renderWithClient } from '@/test/renderWithClient';
import { buildDetectedSubscription } from '@/test/subscriptionFixtures';
import EditSubscriptionDialog from '@/components/subscriptions/EditSubscriptionDialog';
import type { DetectedSubscription } from '@/types/subscription';

afterEach(() => {
  cleanup();
});

function dialog(open: boolean, subscription: DetectedSubscription) {
  return (
    <EditSubscriptionDialog
      open={open}
      subscription={subscription}
      onClose={vi.fn()}
      onSave={vi.fn()}
      isLoading={false}
    />
  );
}

function nameField(): HTMLInputElement {
  return requireInput(screen.getByDisplayValue(/Netflix|Spotify|edited/));
}

describe('EditSubscriptionDialog', () => {
  it('discards unsaved edits when reopened, and loads a different subscription', () => {
    const netflix = buildDetectedSubscription({ id: 'n', displayName: 'Netflix' });
    const { rerender } = renderWithClient(dialog(true, netflix));
    expect(nameField().value).toBe('Netflix');

    fireEvent.change(nameField(), { target: { value: 'edited' } });
    expect(nameField().value).toBe('edited');

    rerender(dialog(false, netflix));
    rerender(dialog(true, netflix));
    expect(nameField().value).toBe('Netflix');

    rerender(dialog(true, buildDetectedSubscription({ id: 's', displayName: 'Spotify' })));
    expect(nameField().value).toBe('Spotify');
  });
});
