export function omitKey<V>({
  record,
  key,
}: {
  record: Record<string, V>;
  key: string;
}): Record<string, V> {
  return Object.fromEntries(Object.entries(record).filter(([entryKey]) => entryKey !== key));
}
