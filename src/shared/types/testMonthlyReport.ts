/** What the Settings test-report button reports; the client words it in the user's language. */
export type TestMonthlyReportResult =
  | {
      status: 'SENT';
      month: string;
      recipient: string;
      transactionCount: number;
    }
  | { status: 'NOT_BUILT' }
  | { status: 'FAILED' };
