import assert from 'node:assert/strict';
import { createDeckSync } from '../public/deck-sync.mjs';
let deck = { id: 'deck', quantity: 1 },
  writes = [],
  states = [],
  release,
  active = 0,
  maximum = 0;
const sync = createDeckSync({
  delay: 60000,
  loadDeck: () => ({ ...deck }),
  onStatus: (_, s) => states.push(s),
  saveDeck: async (d, owner) => {
    active++;
    maximum = Math.max(maximum, active);
    writes.push({ ...d, owner });
    if (writes.length === 1) await new Promise((r) => (release = r));
    deck.remoteRevision = (deck.remoteRevision || 0) + 1;
    active--;
  },
});
sync.schedule('deck');
assert.equal(writes.length, 0);
assert.equal(states.at(-1).status, 'local');
sync.setUser({ id: 'a' });
sync.schedule('deck');
sync.schedule('deck');
const first = sync.flush('deck');
assert.equal(writes.length, 1);
deck.quantity = 3;
sync.schedule('deck');
deck.quantity = 4;
sync.schedule('deck');
release();
await first;
assert.equal(maximum, 1);
assert.equal(writes.length, 2);
assert.equal(writes[1].quantity, 4);
assert.equal(writes[1].remoteRevision, 1);
assert.equal(states.at(-1).status, 'saved');
sync.schedule('deck');
sync.setUser(null);
await sync.flush('deck');
assert.equal(writes.length, 2, 'Logout cancels queued writes');
let attempts = 0;
const failed = createDeckSync({
  delay: 60000,
  loadDeck: () => deck,
  saveDeck: async () => {
    attempts++;
    throw Error('Version conflict');
  },
  onStatus: (_, s) => states.push(s),
});
failed.setUser({ id: 'a' });
failed.schedule('deck');
await failed.flush('deck');
assert.equal(attempts, 1);
assert.equal(states.at(-1).status, 'error');
assert.equal(deck.quantity, 4, 'Failure preserves local edits');
failed.setUser(null);
console.log(
  'Deck sync: no unauthenticated writes, serialized writes, coalesced edits, fresh revisions, logout and retained local data passed.',
);
