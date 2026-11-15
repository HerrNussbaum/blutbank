import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { normalizeDeckCardIdentities } from '../public/deck-model.mjs';

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
