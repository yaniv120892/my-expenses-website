import { afterEach, describe, expect, it, vi } from 'vitest';
import { streamMessage } from '@/services/chatService';

afterEach(() => {
  vi.unstubAllGlobals();
});

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });
}

function handlers() {
  return { onDelta: vi.fn(), onDone: vi.fn(), onError: vi.fn() };
}

describe('streamMessage', () => {
  it('reads every chunk, joining frames split across them, then reports done', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            streamOf([
              'data: {"type":"delta","value":"Hel"}\n\nda',
              'ta: {"type":"delta","value":"lo"}\n\n',
              'data: {"type":"delta","value":"!"}',
            ]),
          ),
        ),
    );
    const streamHandlers = handlers();

    await streamMessage([], streamHandlers);

    expect(streamHandlers.onDelta.mock.calls).toEqual([['Hel'], ['lo'], ['!']]);
    expect(streamHandlers.onDone).toHaveBeenCalledTimes(1);
    expect(streamHandlers.onError).not.toHaveBeenCalled();
  });

  it('sends a 401 to the login page without reading a body', async () => {
    const location = {
      origin: 'https://app.test',
      pathname: '/chat',
      search: '',
      href: 'https://app.test/chat',
    };
    vi.stubGlobal('window', { location });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    const streamHandlers = handlers();

    await streamMessage([], streamHandlers);

    expect(location.href).toBe('https://app.test/login?reason=session-expired&next=%2Fchat');
    expect(streamHandlers.onDone).not.toHaveBeenCalled();
  });
});
