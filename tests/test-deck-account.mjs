import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
globalThis.crypto ??= { randomUUID };
import { accountDeckStore, cacheAccountDeck, newDeck } from '../public/deck-model.mjs';
const entries = new Map(),
  storage = {
    getItem: (key) => entries.get(key) || null,
    setItem: (key, value) => entries.set(key, value),
  };
entries.set('blutbank.decks.v1', JSON.stringify([{ id: 'legacy', name: 'Do not delete' }]));
const old = entries.get('blutbank.decks.v1');
assert.throws(() => accountDeckStore(null, storage));
const a = accountDeckStore('a', storage),
  b = accountDeckStore('b', storage);
assert.notEqual(a.key, b.key);
assert.deepEqual(a.read(), []);
assert.deepEqual(b.read(), []);
const deck = {
  schemaVersion: 1,
  id: 'same-address',
  name: 'Deck',
  description: '',
  entries: [],
  updatedAt: '2026-10-26T10:00:00Z',
  visibility: 'private',
};
cacheAccountDeck(a, { deck, revision: 1 }, []);
assert.equal(a.read()[0].remoteRevision, 1);
assert.deepEqual(b.read(), []);
cacheAccountDeck(a, { deck: { ...deck, visibility: 'public' }, revision: 2 }, []);
assert.equal(a.read()[0].id, 'same-address');
assert.equal(a.read()[0].visibility, 'public');
a.storage.setItem(
  a.key,
  JSON.stringify([{ ...a.read()[0], name: 'Unsaved edit', pendingSave: true }]),
);
cacheAccountDeck(a, { deck: { ...deck, visibility: 'private' }, revision: 3 }, []);
assert.equal(a.read()[0].name, 'Unsaved edit');
assert.equal(
  a.read()[0].remoteRevision,
  2,
  'Preserve revision conflicts instead of silently overwriting',
);
assert.equal(a.read()[0].visibility, 'private');
assert.equal(entries.get('blutbank.decks.v1'), old);
assert.equal(newDeck().visibility, 'private');
console.log(
  'Account deck buffer: login required, account separation, stable ID, visibility refresh, unsaved edit retention and legacy data preservation passed.',
);
