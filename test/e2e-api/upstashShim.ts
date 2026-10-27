import http from 'http';

// `@upstash/redis` speaks REST rather than the Redis wire protocol, so a local
// redis-server cannot stand in. TTLs expire lazily so rate-limit windows
// behave.
const store = new Map<string, { value: string; expiresAt?: number }>();

function liveEntry(key: string): { value: string; expiresAt?: number } | null {
  const entry = store.get(key);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt !== undefined && Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry;
}

function runCommand(command: unknown[]): unknown {
  const [name, key, value, ...rest] = command as [string, string, string, ...string[]];

  switch (String(name).toLowerCase()) {
    case 'set': {
      // setValue sends ['set', key, value, 'EX', seconds].
      const exIndex = rest.findIndex((part) => String(part).toLowerCase() === 'ex');
      const ttlSeconds = exIndex >= 0 ? Number(rest[exIndex + 1]) : undefined;
      store.set(key, {
        value,
        ...(ttlSeconds ? { expiresAt: Date.now() + ttlSeconds * 1000 } : {}),
      });
      return 'OK';
    }
    case 'get':
      return liveEntry(key)?.value ?? null;
    case 'del':
      return store.delete(key) ? 1 : 0;
    case 'getdel': {
      const taken = liveEntry(key)?.value ?? null;
      store.delete(key);
      return taken;
    }
    case 'incr': {
      const entry = liveEntry(key);
      const next = Number(entry?.value ?? '0') + 1;
      // INCR keeps the key's existing TTL, as Redis does.
      store.set(key, { value: String(next), expiresAt: entry?.expiresAt });
      return next;
    }
    case 'expire': {
      const entry = liveEntry(key);
      if (!entry) {
        return 0;
      }
      entry.expiresAt = Date.now() + Number(value) * 1000;
      return 1;
    }
    default:
      return null;
  }
}

// The client asks for base64 results and decodes every string but "OK", as
// the real service sends them; a plain string would reach the app as garbage.
function encodeResult(result: unknown, base64: boolean): unknown {
  if (!base64) {
    return result;
  }
  if (typeof result === 'string') {
    return result === 'OK' ? result : Buffer.from(result).toString('base64');
  }
  if (Array.isArray(result)) {
    return result.map((item) => encodeResult(item, base64));
  }
  return result;
}

export function startUpstashShim(port: number): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      // The client may put the command in the path or in the JSON body;
      // accept either so the shim is not coupled to one client version.
      const pathParts = (req.url || '/').split('/').filter(Boolean).map(decodeURIComponent);

      let command: unknown[] = pathParts;
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            command = parsed;
          } else if (pathParts.length) {
            command = [...pathParts, JSON.stringify(parsed)];
          }
        } catch {
          if (pathParts.length) {
            command = [...pathParts, raw];
          }
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      const base64 = String(req.headers['upstash-encoding']).toLowerCase() === 'base64';

      // The client auto-pipelines: several commands arrive as an array of
      // arrays and it expects an array of results back, one per command.
      const isPipeline = Array.isArray(command) && command.every((c) => Array.isArray(c));

      if (isPipeline) {
        const results = (command as unknown[][]).map((c) => ({
          result: encodeResult(runCommand(c), base64),
        }));
        res.end(JSON.stringify(results));
        return;
      }

      res.end(JSON.stringify({ result: encodeResult(runCommand(command), base64) }));
    });
  });

  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

export function seedKey(key: string, value: string): void {
  store.set(key, { value });
}
