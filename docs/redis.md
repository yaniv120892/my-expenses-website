# Redis keys

Load before writing a Redis key or a cache, or touching `src/server/redis.ts`.

Every key written through `src/server/redis.ts` is namespaced by `redisKeyPrefix(scope)`, because
previews share production's one Upstash database. Only production is bare; everything else, an
unconfigured local process included, is namespaced.

- Preview caches key on the commit (`preview:<sha>:`) so a fix is never served a buggy commit's
  value.
- Sessions and login and Telegram link codes pass `'branch'` (`preview:<branch>:`) to survive
  pushes.
- Superseded namespaces expire by TTL, except a counter killed between INCR and EXPIRE, which has
  none.
