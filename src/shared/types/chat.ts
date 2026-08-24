import { Transaction } from './transaction';

export type AggregationType =
  | 'total'
  | 'average'
  | 'count'
  | 'breakdown_by_category'
  | 'breakdown_by_month'
  | 'min_max'
  | 'list';

// The aggregations SQL can answer exactly from grouped sums, with no row cap.
export type TotalsAggregationType = Extract<
  AggregationType,
  'total' | 'average' | 'count'
>;

export interface AggregationResult {
  summary: string;
  data: Record<string, number | string>;
  transactionCount: number;
}

export interface ComparisonPeriod {
  label: string;
  transactions: Transaction[];
}
