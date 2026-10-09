export type ExchangeRateQuote = {
  /** ILS per one unit of the currency, to eight places. */
  rate: string;
  /** The business day the rate was published for. */
  rateDate: string;
};
