export function renderIfChanged(
  cache: Map<string, string>,
  key: string,
  value: string,
  render: () => void,
): boolean {
  if (cache.get(key) === value) return false;
  cache.set(key, value);
  render();
  return true;
}
