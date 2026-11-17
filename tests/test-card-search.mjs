import { expandCards } from '../public/card-catalog.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CardSearch as S } from '../public/card-search.mjs';
const cards = expandCards(
  JSON.parse(readFileSync(new URL('../public/data/cards.json', import.meta.url))),
);
const fixture = {
  name: 'Überwächter',
  set: 'Origin',
  group: 'Test',
  notes: 'Official errata',
  text: {
    types: ['Character'],
    colors: ['green'],
    subtypes: ['Elf'],
    rarity: 'K',
    keywords: ['Flying'],
    rulesText: 'Flying. Draw a card.',
    stats: { asp: 0, pow: 3, hp: null, level: 2 },
    mechanics: { pool: true, binding: null },
  },
};
assert(S.matches(fixture, { q: 'uberwachter flying' }));
assert(S.matches(fixture, { q: '"draw a card" asp<=4 pow>=3' }));
assert(!S.matches(fixture, { q: '"draw two cards"' }));
assert(S.matches(fixture, { q: 'grün charakter' }), 'German property aliases');
assert(S.matches(fixture, { aspMin: '0', aspMax: '0' }), 'Printed zero is a real value');
assert(!S.matches(fixture, { hpMax: '2' }), 'Unknown HP must not match a numeric filter');
assert(!S.matches(fixture, { q: 'hp=0' }), 'Unknown HP must not be treated as zero');
assert(S.matches(fixture, { unknown: 'hp' }));
assert(!S.matches(fixture, { color: 'black' }));
assert(
  S.matches(fixture, {
    set: 'Origin',
    type: 'Character',
    subtype: 'Elf',
    color: 'green',
    rarity: 'K',
    mechanic: 'pool',
    levelMin: '2',
    levelMax: '2',
  }),
);
assert(!S.matches(fixture, { mechanic: 'binding' }));
assert(!S.matches(fixture, { aspMax: '-1' }));
assert(!S.matches(fixture, { aspMin: 'not-a-number' }));
assert(S.matches(fixture, {}), 'Reset includes all cards');
assert(S.query(fixture, 'errata'), 'Official notes are searchable');
const ids = new Set(cards.map((c) => c.id));
for (const c of cards) {
  assert(!c.text.rawText || typeof c.text.rawText === 'string', `Invalid OCR provenance: ${c.id}`);
  assert(new URL(c.original).protocol === 'https:', `Invalid card image: ${c.id}`);
  assert(['machine', 'reviewed'].includes(c.text.status));
  for (const k of S.numeric)
    assert(
      c.text.stats[k] === null || c.text.stats[k] === 'X' || Number.isInteger(c.text.stats[k]),
      `Invalid ${k}: ${c.id}`,
    );
  assert(S.matches(c, {}));
}
const amazon = cards.find((c) => c.id === '4bee77b4f168');
assert(
  S.matches(amazon, {
    type: 'Character',
    color: 'white',
    aspMin: '4',
    aspMax: '4',
    powMin: '2',
    powMax: '2',
    hpMin: '3',
    hpMax: '3',
  }),
);
assert(!S.matches(amazon, { aspMax: '3' }));
const tobin = cards.find((c) => c.id === '9d7645b2b87e');
assert(tobin.text.types.includes('Character') && tobin.text.typeLine.includes('Advisor'));
assert.equal(tobin.text.stats.hp, null, 'Advisor has no printed HP');
assert(S.matches(tobin, { mechanic: 'pool' }));
const rune = cards.find((c) => c.id === '83ffeed6cc65');
assert(rune.text.types.includes('Rune') && rune.text.types.includes('Resource'));
const exports = JSON.parse(
  readFileSync(new URL('../public/data/card-texts.json', import.meta.url)),
);
assert.equal(exports.length, new Set(cards.map((c) => c.gameplayId)).size);
assert(exports.every((c) => cards.some((v) => v.gameplayId === c.id)));
console.log(
  `Card search: ${cards.length} complete text records, numeric/range, language, AND and unknown-value checks passed.`,
);
const printings = [
  {
    ...fixture,
    id: 'a',
    name: 'Same Name',
    set: 'Origin',
    text: { ...fixture.text, stats: { asp: 2 }, colors: ['green'] },
  },
  {
    ...fixture,
    id: 'b',
    name: 'SAME  NAME',
    set: 'Alliances',
    text: { ...fixture.text, stats: { asp: 5 }, colors: ['blue'] },
  },
  { ...fixture, id: 'c', name: 'Another Name' },
];
assert.equal(S.group(printings).length, 2, 'Same names appear once');
assert.equal(S.group(printings, { set: 'Alliances' })[0].card.id, 'b', 'Show a matching printing');
assert.equal(
  S.group(printings, { set: 'Alliances' })[0].variants.length,
  2,
  'Keep other printings accessible',
);
assert.equal(
  S.group(printings, { set: 'Alliances', aspMax: '2' }).length,
  0,
  'All filters must match the same printing',
);
const grouped = S.group(cards);
assert.equal(
  grouped.reduce((n, g) => n + g.variants.length, 0),
  cards.length,
  'No printing lost',
);
// Gameplay identities, not names, distinguish mechanically different cards.
assert.equal(new Set(grouped.map((g) => g.card.gameplayId || g.key)).size, grouped.length);
assert(
  grouped.every((g) =>
    g.variants.every((c) => !c.gameplayId || c.gameplayId === g.card.gameplayId),
  ),
);
console.log(
  `Grouping: ${cards.length} printings in ${grouped.length} name groups; variant filtering passed.`,
);

// Advanced filters combine on the same printing, including exact/subset colors.
assert(S.matches(fixture, { name: 'uberwachter', text: '"Draw a card"' }));
assert(!S.matches(fixture, { name: 'Flying' }), 'Name searches must not match rules text');
assert(!S.matches(fixture, { text: 'Überwächter' }), 'Text searches must not match card names');
assert(S.matches(fixture, { colors: 'green', colorMode: 'exact', rarities: 'K,N' }));
assert(!S.matches(fixture, { colors: 'green,blue', colorMode: 'exact' }));
assert(S.matches(fixture, { colors: 'green,blue', colorMode: 'atmost' }));
assert(!S.matches(fixture, { colors: 'green,blue', colorMode: 'include' }));
assert(
  S.matches(fixture, { excludeType: 'Character' }),
  'Removed type filters must not hide cards through stale URLs',
);
assert(S.matches(fixture, { aspValue: '0', aspOp: '=' }));
assert(S.matches(fixture, { powValue: '2', powOp: '>' }));
assert(!S.matches(fixture, { hpValue: '0', hpOp: '!=' }), 'Missing stats cannot pass inequality');
assert(!S.matches(fixture, { aspValue: 'NaN', aspOp: '=' }));
assert(S.matches(fixture, { q: 'pow!=2' }));
const symbolFixture = {
  ...fixture,
  text: { ...fixture.text, rulesText: '[Turn]: Generate 2 ASP. Once per turn.' },
};
assert(S.matches(symbolFixture, { q: '{T} {2}' }));
assert(S.matches(symbolFixture, { text: '{T}' }));
const { symbolText, aspText } = await import('../public/card-symbols.mjs');
assert.equal(
  symbolText('[Turn], 3 ASP: Turn target Character. Once per turn.'),
  '{T}, {3}: Turn target Character. Once per turn.',
);
assert.equal(symbolText('{T}: Generate {X}. Cost: X ASP.'), '{T}: Generate {X}. Cost: {X}.');
assert.equal(aspText(0), '{0}');
assert.equal(aspText(null), '');
for (const c of cards)
  assert(!/\[Turn\]|\b\d+ ASP\b/.test(c.text.rulesText), 'Built text uses shared symbol notation');
console.log('Advanced filters, symbol notation, literal turn text and zero/missing stats passed.');
const { cardFlow } = await import('../public/card-symbols.mjs');
assert.equal(
  cardFlow(
    'Flying\nWhen Bird enters play, draw a\ncard.\n{2}, {T}: Deal 1 DMG to target\nCharacter.',
  ),
  'Flying\nWhen Bird enters play, draw a card.\n{2}, {T}: Deal 1 DMG to target Character.',
);
assert.equal(
  cardFlow(
    'Advisor (Put this in the Advisor slot.\nIt remains a Character.)\nWhen it enters play, draw a\ncard.',
  ),
  'Advisor (Put this in the Advisor slot. It remains a Character.)\nWhen it enters play, draw a card.',
);

assert.equal(
  cardFlow('Draw a\ncard.\n[Turn]: Generate\n2 ASP.\n\nAnother ability.'),
  'Draw a card.\n{T}: Generate {2}.\n\nAnother ability.',
);

const { symbolHTML, costHTML, statIcon, mechanicHTML } = await import('../public/card-symbols.mjs');
assert(symbolHTML('<script>{T} & {0}</script>').startsWith('&lt;script&gt;'));
assert(symbolHTML('{T} {0} {X}').includes('turn-weiss.webp'));
assert(symbolHTML('{T} {0} {X}').includes('asp-faehigkeit-weiss-0.webp'));
assert.equal(costHTML(12), '{12}');
assert.equal(costHTML(null), '');
assert(costHTML(0).includes('alt="{0}"'));
assert.equal(statIcon('level', 3), '');
for (const html of [
  symbolHTML('{T} {0} {X}'),
  costHTML(4),
  statIcon('hp'),
  statIcon('level', 2),
  mechanicHTML('binding'),
]) {
  for (const [, path] of html.matchAll(/src="([^"]+)"/g))
    assert(readFileSync(new URL('../public/' + path, import.meta.url)).length > 0);
}
console.log(
  'Accessible symbol rendering, HTML escaping, asset paths and unsupported-cost fallback passed.',
);

const { reminderParts, reminderHTML } = await import('../public/card-symbols.mjs');
assert.deepEqual(reminderParts('Flying (Only Flying can block it.)'), [
  { text: 'Flying ', reminder: false },
  { text: '(Only Flying can block it.)', reminder: true },
]);
assert.equal(reminderHTML('(T): Draw 1 card. (Reminder.)').includes('<em>(Reminder.)</em>'), true);
assert.equal(reminderHTML('Unclosed (reminder').includes('<em>'), false);
assert.equal(reminderHTML('(<script>alert(1)</script>)').includes('<script>'), false);

assert.equal(
  cardFlow('Gain {1}. Gain {X} ASP. gains {2}.'),
  'Gain {1} ASP. Gain {X} ASP. gains {2} ASP.',
);
assert.equal(cardFlow('Gain 2 ASP.'), 'Gain {2} ASP.');
assert.equal(cardFlow(cardFlow('Gain {1}.')), 'Gain {1} ASP.');
for (const c of cards) assert(!/\bgains?\s+\{(?:X|\d+)\}(?!\s*ASP\b)/i.test(c.text.rulesText));
console.log('ASP gain notation is complete across all printings and remains idempotent.');

assert(
  !S.matches({ ...fixture, archived: true }, {}),
  'Archived printings are excluded from new selections',
);
assert(
  !S.query({ ...fixture, archived: true }, 'flying'),
  'Archived printings are excluded from global search',
);
assert.equal(
  S.group([
    { ...fixture, id: 'old', gameplayId: 'same', archived: true },
    { ...fixture, id: 'new', gameplayId: 'same' },
  ])[0].card.id,
  'new',
);
