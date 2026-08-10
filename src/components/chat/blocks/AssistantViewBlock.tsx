'use client';

import { AssistantView } from '@/shared/types/chat';
import StatsBlock from '@/components/chat/blocks/StatsBlock';
import TransactionListBlock from '@/components/chat/blocks/TransactionListBlock';
import CategoryBreakdownBlock from '@/components/chat/blocks/CategoryBreakdownBlock';
import TrendBlock from '@/components/chat/blocks/TrendBlock';
import ComparisonBlock from '@/components/chat/blocks/ComparisonBlock';

/**
 * Renders one structured result from the assistant.
 *
 * An unrecognised kind renders nothing rather than throwing: a client running
 * older code than the server should lose a card, not the whole reply.
 */
export default function AssistantViewBlock({ view }: { view: AssistantView }) {
  switch (view.kind) {
    case 'stats':
      return <StatsBlock view={view} />;
    case 'transactionList':
      return <TransactionListBlock view={view} />;
    case 'categoryBreakdown':
      return <CategoryBreakdownBlock view={view} />;
    case 'trend':
      return <TrendBlock view={view} />;
    case 'comparison':
      return <ComparisonBlock view={view} />;
    default:
      return null;
  }
}
