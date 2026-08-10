export function lazy<T>(create: () => T): () => T {
  let created = false;
  let value: T;
  return () => {
    if (!created) {
      value = create();
      created = true;
    }
    return value;
  };
}
