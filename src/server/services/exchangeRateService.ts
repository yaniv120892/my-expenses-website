import { subDays } from 'date-fns';
import Decimal from 'decimal.js';
import logger from '@/server/logging/logger';
import { reportSwallowedError } from '@/server/logging/reportSwallowedError';
import { getValue, setValue } from '@/server/redis';
import { toDayString } from '@/shared/dates';
import { toRateString } from '@/server/utils/money';

const BANK_OF_ISRAEL_RATES_URL =
  'https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/EXR/1.0';
const REQUEST_TIMEOUT_MS = 5000;
// Rates are published on business days only, so a weekend or holiday date
// takes the last rate published before it.
const LOOKBACK_DAYS = 7;
const CACHE_TTL_SECONDS = 24 * 60 * 60;

export type ExchangeRateQuote = {
  /** ILS per one unit of the currency, to eight places. */
  rate: string;
  /** The business day the rate was published for. */
  rateDate: string;
};

type PublishedRate = { day: string; rate: string };

class ExchangeRateService {
  /**
   * The Bank of Israel representative rate for the currency on `date`, or the
   * last one published before it. Null when none can be had, so a caller has
   * to say so rather than convert 1:1.
   */
  public async getRateToBase(
    currency: string,
    date: Date,
  ): Promise<ExchangeRateQuote | null> {
    const day = toDayString(date);
    const cacheKey = `fx:boi:${currency}:${day}`;

    const cached = await this.readCacheSafe(cacheKey);
    if (cached) {
      return cached;
    }

    const quote = await this.fetchQuoteSafe(currency, date);
    if (quote) {
      await this.writeCacheSafe(cacheKey, quote);
    }
    return quote;
  }

  private async fetchQuoteSafe(
    currency: string,
    date: Date,
  ): Promise<ExchangeRateQuote | null> {
    try {
      const rates = await this.fetchPublishedRates(currency, date);
      const latest = rates.at(-1);
      if (!latest) {
        logger.warn(
          { currency, day: toDayString(date) },
          'No published exchange rate in the look-back window',
        );
        return null;
      }
      return { rate: latest.rate, rateDate: latest.day };
    } catch (err) {
      reportSwallowedError(
        { err, currency, day: toDayString(date) },
        'Failed to fetch exchange rate',
      );
      return null;
    }
  }

  private async fetchPublishedRates(
    currency: string,
    date: Date,
  ): Promise<PublishedRate[]> {
    const url = new URL(`${BANK_OF_ISRAEL_RATES_URL}/RER_${currency}_ILS`);
    url.searchParams.set(
      'startperiod',
      toDayString(subDays(date, LOOKBACK_DAYS)),
    );
    url.searchParams.set('endperiod', toDayString(date));
    url.searchParams.set('format', 'csv');

    const response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    // An unpublished currency is a 404, which is an answer, not a failure.
    if (response.status === 404) {
      return [];
    }
    if (!response.ok) {
      throw new Error(
        `Exchange rate request for ${currency} failed with status ${response.status}`,
      );
    }
    return parsePublishedRates(await response.text());
  }

  private async readCacheSafe(
    cacheKey: string,
  ): Promise<ExchangeRateQuote | null> {
    try {
      return await getValue<ExchangeRateQuote>(cacheKey);
    } catch (err) {
      logger.warn({ err, cacheKey }, 'Exchange rate cache read failed');
      return null;
    }
  }

  private async writeCacheSafe(
    cacheKey: string,
    quote: ExchangeRateQuote,
  ): Promise<void> {
    try {
      await setValue(cacheKey, quote, CACHE_TTL_SECONDS);
    } catch (err) {
      logger.warn({ err, cacheKey }, 'Exchange rate cache write failed');
    }
  }
}

/**
 * Rows of the SDMX CSV, oldest first. OBS_VALUE is quoted per 10^UNIT_MULT
 * units (JPY is per 100 yen), so it is scaled back to one unit.
 */
export function parsePublishedRates(csv: string): PublishedRate[] {
  const [headerLine, ...lines] = csv.trim().split(/\r?\n/);
  if (!headerLine) {
    return [];
  }
  const header = headerLine.split(',');
  const dayColumn = header.indexOf('TIME_PERIOD');
  const valueColumn = header.indexOf('OBS_VALUE');
  const unitMultiplierColumn = header.indexOf('UNIT_MULT');
  if (dayColumn === -1 || valueColumn === -1) {
    throw new Error(
      `Unexpected exchange rate CSV header: ${headerLine.slice(0, 200)}`,
    );
  }

  return lines
    .map((line) => line.split(','))
    .filter((cells) => cells[valueColumn] && Number(cells[valueColumn]) > 0)
    .map((cells) => {
      const unitMultiplier = Number(cells[unitMultiplierColumn] ?? 0) || 0;
      return {
        day: cells[dayColumn],
        rate: toRateString(
          new Decimal(cells[valueColumn]).dividedBy(
            new Decimal(10).pow(unitMultiplier),
          ),
        ),
      };
    })
    .sort((left, right) => left.day.localeCompare(right.day));
}

const exchangeRateService = new ExchangeRateService();
export default exchangeRateService;
