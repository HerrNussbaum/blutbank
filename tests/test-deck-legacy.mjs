import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { CardSearch } from '../public/card-search.mjs';
import { normalizeDeckCardIdentities, indexCards } from '../public/deck-model.mjs';

const entry = (printingId, cardId, quantity, zone = 'spell') => ({
  printingId,
  cardId,
  quantity,
  zone,
});
const deck = (entries) => ({
  id: 'existing-account-deck',
  name: 'Existing private deck',
  visibility: 'private',
  entries,
});
const examples = [
  deck([
    entry('32ee8d52234d', 'card-32ee8d52234d', 2),
    entry('19532e874bac', 'card-19532e874bac', 3),
    entry('549c4a48ddec', 'card-549c4a48ddec', 4, 'pool'),
  ]),
  {
    ...deck([entry('688dcbaa3d2b', 'card-retained', 2), entry('cca2d2102a69', 'card-retained', 3)]),
    coverPrintingId: '688dcbaa3d2b',
  },
  deck([entry('cca2d2102a69', 'card-retained', 3), entry('688dcbaa3d2b', 'card-retained', 2)]),
  deck([
    entry('688dcbaa3d2b', 'card-retained', 2, 'pool'),
    entry('cca2d2102a69', 'card-retained', 3, 'spell'),
  ]),
  deck([entry('cca2d2102a69', 'card-retained', 3), entry('cca2d2102a69', 'card-retained', 2)]),
  deck([]),
  deck([
    entry('e6c10c910c75', 'card-e6c10c910c75', 2),
    entry('ee37ad941634', 'card-ee37ad941634', 3),
  ]),
];
const browser = examples.map((value) => normalizeDeckCardIdentities(structuredClone(value)));
const php = spawnSync(
  'php',
  [
    '-r',
    'require $argv[1]; $out=[]; foreach(json_decode(stream_get_contents(STDIN),true) as $deck) $out[]=normalizeDeckCardIdentities($deck); echo json_encode($out,JSON_THROW_ON_ERROR);',
    fileURLToPath(new URL('../private/bootstrap.php', import.meta.url)),
  ],
  { input: JSON.stringify(examples), encoding: 'utf8' },
);
assert.equal(php.status, 0, php.stderr);
const server = JSON.parse(php.stdout);
assert.deepEqual(server, browser, 'Existing decks must resolve identically in PHP and the browser');
assert.deepEqual(
  server[0].entries.map((value) => value.cardId),
  ['card-32ee8d52234d-character', 'card-f52e689e92b1', 'card-20e14ad55c10'],
);
for (const value of [server[1], server[2]]) {
  assert.equal(value.entries.length, 1);
  assert.equal(value.entries[0].quantity, 5);
}
assert.equal(server[1].coverPrintingId, 'cca2d2102a69');
assert.equal(server[3].entries.length, 2, 'Different deck zones must stay separate');
assert.equal(
  server[4].entries.length,
  2,
  'Pre-existing invalid duplicates must not be silently merged',
);
for (const value of server) {
  assert.equal(value.name, 'Existing private deck');
  assert.equal(value.visibility, 'private');
}
console.log(
  'Legacy decks: PHP/browser identity parity, retired printings, quantities, zones and privacy passed.',
);

assert.deepEqual(
  server[6].entries.map((e) => [e.printingId, e.cardId, e.quantity]),
  [
    ['e6c10c910c75', 'card-e6c10c910c75', 2],
    ['ee37ad941634', 'card-e6c10c910c75', 3],
  ],
);
const records = JSON.parse(await readFile(new URL('../public/data/cards.json', import.meta.url)));
const identities = JSON.parse(
  await readFile(new URL('../public/data/card-identities.json', import.meta.url)),
);
const zyphor = records.filter((c) => /zyphor/i.test(c.name));
assert.equal(CardSearch.group(zyphor).length, 1);
assert.equal(indexCards(zyphor, identities).length, 1);
assert.equal(indexCards(zyphor, identities)[0].variants.length, 2);
const overlay = spawnSync(
  'php',
  [
    '-r',
    `
require $argv[1]; require $argv[2];
$db=new PDO('sqlite::memory:');$db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE,PDO::FETCH_ASSOC);
$db->exec('CREATE TABLE card_published(card_id TEXT,body TEXT,updated_at INT)');
$old=json_decode(stream_get_contents(STDIN),true);
foreach($old as $i=>$c) { $db->prepare('INSERT INTO card_published VALUES(?,?,?)')->execute([$c['id'],json_encode($c),$i]); }
$before=$db->query('SELECT * FROM card_published')->fetchAll();
$out=array_values(array_filter(cardRecords($db,['card_editor_enabled'=>true]),fn($c)=>in_array($c['id'],['e6c10c910c75','ee37ad941634'])));
echo json_encode(['cards'=>$out,'unchanged'=>$before===$db->query('SELECT * FROM card_published')->fetchAll()]);
`,
    fileURLToPath(new URL('../private/bootstrap.php', import.meta.url)),
    fileURLToPath(new URL('../private/card-editor.php', import.meta.url)),
  ],
  {
    input: JSON.stringify(
      zyphor.map((c) => ({
        ...c,
        name: 'Zyphor Teller of Tales',
        text: {
          ...c.text,
          rulesText:
            'When this Character enters play, look at the top 3 cards of your Spell deck, draw one card and put the rest back on top in any order.',
        },
      })),
    ),
    encoding: 'utf8',
  },
);
assert.equal(overlay.status, 0, overlay.stderr);
const result = JSON.parse(overlay.stdout);
assert(result.unchanged, 'Loading corrected cards must not change stored editorial records');
assert(
  result.cards.every(
    (c) =>
      c.name === 'Zyphor, Teller of Lost Tales' &&
      c.text.rulesText === zyphor[0].text.rulesText &&
      c.text.gameplayId === 'card-e6c10c910c75',
  ),
);
console.log(
  'Zyphor: shared search/deck identity, distinct printings and legacy editorial compatibility passed.',
);
