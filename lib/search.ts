/** Case- and accent-insensitive "contains" match on any of the given strings. */
export function matchesQuery(query: string, ...values: Array<string | undefined | null>) {
  const q = normalize(query);
  if (!q) return true;
  return values.some((v) => !!v && normalize(v).includes(q));
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}
