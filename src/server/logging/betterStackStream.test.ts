import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.stubGlobal('fetch', fetchMock);

const { betterStackStream, flushRemoteLogs } =
  await import('./betterStackStream');

const SOURCE_URL = 'https://in.betterstack.example/v1/logs';
const SOURCE_TOKEN = 'source-token';

// Warn by default: error records flush eagerly, which is its own test below.
function writeRecords(count: number, level = 40): void {
  for (let index = 0; index < count; index += 1) {
    betterStackStream.write(
      `${JSON.stringify({ level, msg: `record-${index}` })}\n`,
    );
  }
}

// Lets an eager flush's promise settle so the next case starts unguarded.
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function sentBatch(): Record<string, unknown>[] {
  const body = fetchMock.mock.calls[0][1].body as string;
  return JSON.parse(body);
}

describe('betterStackStream', () => {
  beforeEach(async () => {
    // Drain whatever a previous test buffered so each case starts empty.
    process.env.BETTERSTACK_SOURCE_URL = SOURCE_URL;
    process.env.BETTERSTACK_SOURCE_TOKEN = SOURCE_TOKEN;
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));
    await flushRemoteLogs();
    await settle();
    fetchMock.mockClear();
  });

  it('ships buffered records as one batch', async () => {
    writeRecords(3);

    await flushRemoteLogs();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(SOURCE_URL);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(`Bearer ${SOURCE_TOKEN}`);
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(sentBatch().map((record) => record.msg)).toEqual([
      'record-0',
      'record-1',
      'record-2',
    ]);
  });

  it('empties the buffer so a second flush sends nothing', async () => {
    writeRecords(1);

    await flushRemoteLogs();
    await flushRemoteLogs();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('drops the oldest records past the cap and reports the count', async () => {
    writeRecords(130);

    await flushRemoteLogs();

    const batch = sentBatch();
    // 100 kept records plus the synthetic overflow notice.
    expect(batch).toHaveLength(101);
    expect(batch[0].msg).toBe('record-30');
    expect(batch[99].msg).toBe('record-129');
    expect(batch[100].droppedRecords).toBe(30);
  });

  it('reports the dropped count only once', async () => {
    writeRecords(130);
    await flushRemoteLogs();
    fetchMock.mockClear();

    writeRecords(1);
    await flushRemoteLogs();

    expect(
      sentBatch().some((record) => record.droppedRecords !== undefined),
    ).toBe(false);
  });

  it('drops an info record that is not marked for shipping', async () => {
    writeRecords(3, 30);

    await flushRemoteLogs();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ships an info record marked with ship', async () => {
    betterStackStream.write(
      `${JSON.stringify({ level: 30, ship: true, msg: 'request' })}\n`,
    );

    await flushRemoteLogs();

    expect(sentBatch().map((record) => record.msg)).toEqual(['request']);
  });

  it('ships an error without waiting for a flush', async () => {
    writeRecords(1, 50);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentBatch().map((record) => record.msg)).toEqual(['record-0']);
    await settle();
  });

  it('sends one eager batch for a burst and defers the rest', async () => {
    writeRecords(5, 50);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    await settle();
    fetchMock.mockClear();

    await flushRemoteLogs();

    expect(sentBatch().map((record) => record.msg)).toEqual([
      'record-1',
      'record-2',
      'record-3',
      'record-4',
    ]);
  });

  it('leaves nothing behind for the deferred flush after an eager one', async () => {
    writeRecords(1, 50);
    await settle();
    fetchMock.mockClear();

    await flushRemoteLogs();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ignores a line that is not JSON', async () => {
    betterStackStream.write('not json');

    await flushRemoteLogs();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('buffers nothing and sends nothing when the env is unset', async () => {
    delete process.env.BETTERSTACK_SOURCE_URL;
    delete process.env.BETTERSTACK_SOURCE_TOKEN;

    writeRecords(5);
    await flushRemoteLogs();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends nothing when only one of the two env vars is set', async () => {
    delete process.env.BETTERSTACK_SOURCE_TOKEN;

    writeRecords(5);
    await flushRemoteLogs();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('swallows a rejecting fetch', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    writeRecords(2);

    await expect(flushRemoteLogs()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry a failed batch on the next flush', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    writeRecords(2);
    await flushRemoteLogs();

    fetchMock.mockClear();
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));
    await flushRemoteLogs();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
