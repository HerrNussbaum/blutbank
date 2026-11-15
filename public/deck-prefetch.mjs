let owner = null,
  epoch = 0,
  pending = null,
  value = null,
  loadedAt = 0;
export function invalidateDecks() {
  epoch++;
  pending = null;
  value = null;
  loadedAt = 0;
}
export function setDeckSession(session) {
  const next = session.user?.id || null;
  if (next !== owner) {
    invalidateDecks();
    owner = next;
  }
}
export async function cachedDeckList(load) {
  if (!owner) return load();
  if (value && Date.now() - loadedAt < 20000) return structuredClone(value);
  if (pending) return structuredClone(await pending);
  const account = owner,
    generation = epoch;
  const task = load().then((result) => {
    if (owner !== account || generation !== epoch)
      throw Error('Das Konto oder die Decks wurden inzwischen geändert. Bitte erneut öffnen.');
    value = structuredClone(result);
    loadedAt = Date.now();
    return result;
  });
  pending = task;
  try {
    return structuredClone(await task);
  } finally {
    if (pending === task) pending = null;
  }
}
export function cachedOwnDeck(id) {
  if (!owner || !value || Date.now() - loadedAt >= 20000) return null;
  const row = value.decks.find((r) => r.deck.id === id);
  return row ? { ...structuredClone(row), owned: true } : null;
}
