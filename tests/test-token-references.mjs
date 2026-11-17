import { expandCards } from '../public/card-catalog.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  tokenMentions,
  referencedTokens,
  renderTokenLinks,
  referencedCards,
  renderCardLinks,
  tokenCreators,
} from '../public/token-references.mjs';
const cards = expandCards(
  JSON.parse(fs.readFileSync(new URL('../public/data/cards.json', import.meta.url))),
);
assert.equal(
  referencedTokens('Create two Spectral Moth Tokens. Sacrifice three Spetral Moth Tokens.', cards)
    .length,
  1,
);
assert.equal(
  referencedTokens('Create a Giant Creeper Plant Token.', cards)[0].name,
  'Giant Creeper Plant Token',
);
assert.equal(
  referencedTokens('Create a Chieftain of War, Magic or Strategy Training Token.', cards).length,
  3,
);
assert.equal(
  tokenMentions('Fire damage. Alliance. Create a Token of the same kind.', cards).length,
  0,
);
assert.equal(referencedTokens('Create a "Healing Vessel" Token.', cards)[0].name, 'Healing Vessel');
assert.equal(referencedTokens('Create one Alliance Training Token.', cards).length, 1);
assert.match(
  renderTokenLinks(
    'Create a Skeleton Token.',
    cards,
    (s) => s,
    (c, s) => `[${c.id}:${s}]`,
  ),
  /Create a \[.*:Skeleton Token\]\./,
);
console.log('Token reference checks passed.');

for (const [name, target] of [
  ['Apprentice', 'Silas the Protection Mage'],
  ['Oracle', 'Fraya, Baroness of Truth'],
  ['Master Blacksmith', 'Young Blacksmith'],
  ['Fireelemental', 'Greater Fireelemental'],
]) {
  const card = cards.find((c) => c.name === name);
  const refs = referencedCards(card.text.rulesText, cards, card);
  assert(
    refs.some((c) => c.name === target),
    name,
  );
  assert(!refs.some((c) => c.name === name), 'Exclude self references');
}
assert.equal(
  referencedCards('Rise target Character with Rise. It gains Alliance and Fear.', cards, {}).length,
  0,
);
assert.equal(referencedCards('Young Blacksmith. Young Blacksmith.', cards, {}).length, 1);
assert.match(
  renderCardLinks(
    'Rise into Greater Fireelemental.',
    cards,
    (s) => s,
    (c, s) => `[${s}]`,
  ),
  /Rise into \[Greater Fireelemental\]/,
);
console.log(
  'General card references: Rise targets, aliases, deduplication and self/keyword exclusions passed.',
);

const moth = cards.find((c) => c.name === 'Spectral Moth (Token)');
assert(moth);
const creators = tokenCreators(moth, cards);
assert(creators.some((c) => c.name === 'Zayas Ritual'));
assert.equal(new Set(creators.map((c) => c.name)).size, creators.length);
const token = { id: 'token', name: 'Test Token', text: { types: ['Token'] } };
const source = [
  token,
  { id: 'yes', name: 'Creator', text: { rulesText: 'Create two Test Tokens.' } },
  { id: 'no', name: 'Consumer', text: { rulesText: 'Sacrifice two Test Tokens.' } },
];
assert.deepEqual(
  tokenCreators(token, source).map((c) => c.id),
  ['yes'],
);
assert.deepEqual(tokenCreators(source[1], source), []);
console.log(
  'Inverse token references distinguish creation from sacrifice and deduplicate printings.',
);
