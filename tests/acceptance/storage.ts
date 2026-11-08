/** Browser storage for Node tests: a Map behind getItem/setItem. Past `limit` characters in all, setItem throws as a
 * full localStorage does. */
export function memoryStorage(limit = Infinity) {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (k: string) => items.get(k) ?? null,
    setItem(k: string, v: string) {
      let size = v.length;
      for (const [key, value] of items) if (key !== k) size += value.length;
      if (size > limit) throw new DOMException('quota', 'QuotaExceededError');
      items.set(k, v);
    },
  };
}
