import assert from 'node:assert/strict';
import { cardStyleIssues } from '../public/card-styleguide.mjs';
const card = (rulesText, name = 'Example', additionalCostsText = '') => ({
  name,
  text: { rulesText, additionalCostsText },
});
const rules = (...args) => cardStyleIssues(card(...args)).map((i) => i.rule);
assert.deepEqual(rules('{3}, {T}, pay 2 LP: Return target Character to its owners Hand.'), []);
assert.deepEqual(rules('{3}, (T), pay 2 LP: Return target Character to its owners Hand.'), []);
assert.deepEqual(rules('Create two 1/1 Spectral Moth Character Token with Flying.'), []);
assert.deepEqual(
  rules(
    'Skyguard (This Character can block one Character with Flying)\nDeal 1 DMG to target Character.',
  ),
  [],
);
assert.ok(rules('{T}, {3}: Draw 1 Card.').includes('cost-order'));
assert.ok(rules('Sacrifice a Character, {T}: Draw 1 Card.').includes('cost-order'));
assert.ok(rules('Deal two DMG to target Character.').includes('numbers'));
assert.ok(rules('Create 2 Lerium Tokens.').includes('token-number'));
assert.ok(rules('Gain 2 ASP.').includes('asp-symbol'));
assert.ok(rules('Target Character gets INI +2.').includes('stat-format'));
assert.ok(rules('When Example enters play, draw 1 Card.').includes('self-reference'));
assert.ok(rules('Whenever 1 Character enters play, draw 1 Card.').includes('trigger-count'));
assert.ok(rules('{T}: Draw 1 Card').includes('effect-stop'));
assert.ok(rules('', 'Example', 'Remove two Time Counters: Draw 1 Card.').includes('numbers'));
assert.deepEqual(rules('{T}: Choose one:'), []);
assert.deepEqual(
  rules('If you control a LVL 2 Resource, {1}, {T}: Rise (Search your Spell Deck for a card.)'),
  [],
);
assert.deepEqual(rules('When this Character enters play, search for Example.'), []);
assert.deepEqual(cardStyleIssues({}), []);
assert.equal(cardStyleIssues(card('\nGain 2 ASP.'))[0].line, 2);
console.log('Styleguide checks: 20 assertions passed.');
