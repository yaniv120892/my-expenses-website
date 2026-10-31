import http from 'http';

// `@upstash/redis` speaks REST rather than the Redis wire protocol, so a local
// redis-server cannot stand in. TTLs expire lazily so rate-limit windows
// behave.
// Keys and values are stored exactly as the client sent them, without coercion.
type StoredEntry = { value: unknown; expiresAt?: number };

const store = new Map<unknown, StoredEntry>();

function liveEntry(key: unknown): StoredEntry | null {
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

// SCAN's MATCH glob: `*`, `?`, `[...]` and backslash escapes, as Redis reads them.
function globToRegExp(pattern: string): RegExp {
  let source = '';
  for (let index = 0; index < pattern.length; index++) {
    const character = pattern.charAt(index);
    switch (character) {
      case '\\':
        index++;
        source += escapeRegExp(pattern.charAt(index));
        break;
      case '*':
        source += '.*';
        break;
      case '?':
        source += '.';
        break;
      case '[': {
        const close = pattern.indexOf(']', index);
        if (close === -1) {
          source += escapeRegExp(character);
          break;
        }
        source += pattern.slice(index, close + 1);
        index = close;
        break;
      }
      default:
        source += escapeRegExp(character);
    }
  }
  return new RegExp(`^${source}$`);
}

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

function matchesScan(key: unknown, options: unknown[]): boolean {
  const matchIndex = options.findIndex((part) => String(part).toLowerCase() === 'match');
  if (matchIndex < 0) {
    return liveEntry(key) !== null;
  }
  return liveEntry(key) !== null && globToRegExp(String(options[matchIndex + 1])).test(String(key));
}

function runCommand(command: unknown[]): unknown {
  const [name, key, value, ...rest] = command;

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
      return [key, value, ...rest].filter((deleted) => store.delete(deleted)).length;
    case 'scan':
      // One page holds everything, so the cursor always comes back '0'.
      return ['0', [...store.keys()].filter((stored) => matchesScan(stored, [value, ...rest]))];
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
  const server = http.createServer((request, response) => {
    let raw = '';
    request.on('data', (chunk) => (raw += chunk));
    request.on('end', () => {
      // The client may put the command in the path or in the JSON body;
      // accept either so the shim is not coupled to one client version.
      const pathParts = (request.url || '/').split('/').filter(Boolean).map(decodeURIComponent);

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

      response.writeHead(200, { 'Content-Type': 'application/json' });
      const base64 = String(request.headers['upstash-encoding']).toLowerCase() === 'base64';

      // The client auto-pipelines: several commands arrive as an array of
      // arrays and it expects an array of results back, one per command.
      if (command.every(Array.isArray)) {
        const results = command.map((pipelined) => ({
          result: encodeResult(runCommand(pipelined), base64),
        }));
        response.end(JSON.stringify(results));
        return;
      }

      response.end(JSON.stringify({ result: encodeResult(runCommand(command), base64) }));
    });
  });

  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

export function seedKey(key: string, value: string): void {
  store.set(key, { value });
}
