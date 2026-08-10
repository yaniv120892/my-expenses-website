import http from 'http';

/**
 * Minimal stand-in for the Upstash REST API.
 *
 * `@upstash/redis` speaks HTTP/REST rather than the Redis wire protocol, so a
 * local redis-server cannot be used. Only the commands redisProvider issues are
 * implemented (set/get/del); values are stored verbatim, since the client
 * serialises before sending and parses after receiving.
 */
const store = new Map<string, string>();

function runCommand(command: unknown[]): unknown {
  const [name, key, value] = command as [string, string, string];

  switch (String(name).toLowerCase()) {
    case 'set':
      store.set(key, value);
      return 'OK';
    case 'get':
      return store.has(key) ? store.get(key) : null;
    case 'del':
      return store.delete(key) ? 1 : 0;
    default:
      return null;
  }
}

export function startUpstashShim(port: number): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      // The client may put the command in the path or in the JSON body;
      // accept either so the shim is not coupled to one client version.
      const pathParts = (req.url || '/')
        .split('/')
        .filter(Boolean)
        .map(decodeURIComponent);

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
          if (pathParts.length) command = [...pathParts, raw];
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });

      // The client auto-pipelines: several commands arrive as an array of
      // arrays and it expects an array of results back, one per command.
      const isPipeline =
        Array.isArray(command) && command.every((c) => Array.isArray(c));

      if (isPipeline) {
        const results = (command as unknown[][]).map((c) => ({
          result: runCommand(c),
        }));
        res.end(JSON.stringify(results));
        return;
      }

      res.end(JSON.stringify({ result: runCommand(command) }));
    });
  });

  return new Promise((resolve) =>
    server.listen(port, '127.0.0.1', () => resolve(server)),
  );
}

/** Lets the seed script write a session key directly. */
export function seedKey(key: string, value: string): void {
  store.set(key, value);
}
