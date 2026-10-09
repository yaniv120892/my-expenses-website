import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getValue, setValue } = vi.hoisted(() => ({
  getValue: vi.fn(),
  setValue: vi.fn(),
}));
vi.mock('@/server/redis', () => ({ getValue, setValue }));
vi.mock('@/server/logging/reportSwallowedError', () => ({
  reportSwallowedError: vi.fn(),
}));

import exchangeRateService, {
  parsePublishedRates,
} from './exchangeRateService';

const HEADER =
  'SERIES_CODE,FREQ,BASE_CURRENCY,COUNTER_CURRENCY,UNIT_MEASURE,DATA_TYPE,DATA_SOURCE,TIME_COLLECT,CONF_STATUS,PUB_WEBSITE,UNIT_MULT,COMMENTS,TIME_PERIOD,OBS_VALUE,RELEASE_STATUS';

function row(
  currency: string,
  unitMultiplier: number,
  day: string,
  value: string,
) {
  return `RER_${currency}_ILS,D,${currency},ILS,ILS,OF00,BOI_MRKT,V,F,Y,${unitMultiplier},,${day},${value},YP`;
}

describe('parsePublishedRates', () => {
  it('reads the day and rate of every row, oldest first', () => {
    const csv = [
      HEADER,
      row('USD', 0, '2026-10-02', '3.06'),
      row('USD', 0, '2026-10-01', '3.08'),
    ].join('\n');
    expect(parsePublishedRates(csv)).toEqual([
      { day: '2026-10-01', rate: '3.08000000' },
      { day: '2026-10-02', rate: '3.06000000' },
    ]);
  });

  it('scales a rate quoted per hundred units back to one unit', () => {
    const csv = [HEADER, row('JPY', 2, '2026-10-01', '1.9445')].join('\n');
    expect(parsePublishedRates(csv)).toEqual([
      { day: '2026-10-01', rate: '0.01944500' },
    ]);
  });

  it('rejects a body that is not the expected CSV', () => {
    expect(() => parsePublishedRates('<html>maintenance</html>')).toThrow(
      /Unexpected exchange rate CSV header/,
    );
  });
});

describe('exchangeRateService.getRateToBase', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    getValue.mockResolvedValue(null);
    setValue.mockResolvedValue(undefined);
  });

  it('takes the last rate published on or before the date and caches it for a day', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        [
          HEADER,
          row('USD', 0, '2026-10-01', '3.08'),
          row('USD', 0, '2026-10-02', '3.06'),
        ].join('\n'),
      ),
    );

    const quote = await exchangeRateService.getRateToBase(
      'USD',
      new Date(2026, 9, 3),
    );

    expect(quote).toEqual({ rate: '3.06000000', rateDate: '2026-10-02' });
    const requested = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requested.pathname).toMatch(/RER_USD_ILS$/);
    expect(requested.searchParams.get('endperiod')).toBe('2026-10-03');
    expect(setValue).toHaveBeenCalledWith(
      'fx:boi:USD:2026-10-03',
      quote,
      86400,
    );
  });

  it("caches today's fallback to an earlier day only briefly", async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 5, 10));
    fetchMock.mockResolvedValue(
      new Response([HEADER, row('USD', 0, '2026-10-02', '3.06')].join('\n')),
    );

    await exchangeRateService.getRateToBase('USD', new Date(2026, 9, 5));

    expect(setValue).toHaveBeenCalledWith(
      'fx:boi:USD:2026-10-05',
      { rate: '3.06000000', rateDate: '2026-10-02' },
      3600,
    );
  });

  it('serves a cached quote without calling the API', async () => {
    getValue.mockResolvedValue({ rate: '3.1', rateDate: '2026-10-02' });

    const quote = await exchangeRateService.getRateToBase(
      'USD',
      new Date(2026, 9, 3),
    );

    expect(quote).toEqual({ rate: '3.1', rateDate: '2026-10-02' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is null, not 1:1, for an unpublished currency', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 404 }));

    expect(
      await exchangeRateService.getRateToBase('XAU', new Date(2026, 9, 3)),
    ).toBeNull();
    expect(setValue).not.toHaveBeenCalled();
  });

  it('is null when the API fails or the cache is down', async () => {
    getValue.mockRejectedValue(new Error('redis down'));
    fetchMock.mockRejectedValue(new Error('timeout'));

    expect(
      await exchangeRateService.getRateToBase('USD', new Date(2026, 9, 3)),
    ).toBeNull();
  });
});
