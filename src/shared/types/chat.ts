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

// The aggregations that need the rows themselves (bounded by the read cap).
export type RowAggregationType = Exclude<
  AggregationType,
  TotalsAggregationType
>;

export interface AggregationResult {
  summary: string;
  data: Record<string, number | string>;
  transactionCount: number;
}
