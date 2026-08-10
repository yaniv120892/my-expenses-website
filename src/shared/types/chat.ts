import { Transaction } from './transaction';

export type AggregationType =
  | 'total'
  | 'average'
  | 'count'
  | 'breakdown_by_category'
  | 'breakdown_by_month'
  | 'min_max'
  | 'list';

export interface AggregationResult {
  summary: string;
  data: Record<string, number | string>;
  transactionCount: number;
}

export interface ComparisonPeriod {
  label: string;
  transactions: Transaction[];
}

/**
 * Structured results the assistant's tools produce for the chat UI to render.
 *
 * These never reach the model. A tool returns only its `summary` string, and
 * records the view separately through the request-scoped sink — so the figures
 * on screen come from the database while the model writes the prose around
 * them. Putting the rows in the tool output instead would hand the model the
 * whole table and invite it to retype every amount, which is how the assistant
 * previously answered "list my food transactions" with a wall of text.
 *
 * Dates are ISO strings, not Date: these cross the SSE boundary as JSON.
 */
export type ViewNumberFormat = 'currency' | 'number' | 'percent';

export type ViewTone = 'income' | 'expense' | 'neutral';

export interface ViewStat {
  label: string;
  value: number;
  format: ViewNumberFormat;
  tone?: ViewTone;
}

export interface ViewTransactionRow {
  id: string;
  description: string;
  value: number;
  date: string;
  type: 'INCOME' | 'EXPENSE';
  categoryName: string;
}

export interface StatsView {
  kind: 'stats';
  title?: string;
  stats: ViewStat[];
}

export interface TransactionListView {
  kind: 'transactionList';
  title?: string;
  items: ViewTransactionRow[];
  /** Total matching the filters, which may exceed items.length. */
  totalCount: number;
  totalValue: number;
}

export interface CategoryBreakdownView {
  kind: 'categoryBreakdown';
  title?: string;
  slices: { categoryName: string; amount: number; percentage: number }[];
  total: number;
}

export interface TrendView {
  kind: 'trend';
  title?: string;
  period: string;
  points: { date: string; amount: number; count?: number }[];
  totalAmount: number;
  /** Null when there is no prior period to compare against. */
  percentageChange: number | null;
}

export interface ComparisonView {
  kind: 'comparison';
  title?: string;
  periods: { label: string; total: number; transactionCount: number }[];
  difference: number;
  /** Null when the baseline period is zero, where a percentage is undefined. */
  percentChange: number | null;
}

export type AssistantView =
  | StatsView
  | TransactionListView
  | CategoryBreakdownView
  | TrendView
  | ComparisonView;

/** What streamChatResponse yields, and what the SSE frames carry. */
export type AssistantStreamEvent =
  { type: 'delta'; value: string } | { type: 'view'; view: AssistantView };
