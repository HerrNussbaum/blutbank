import { htmlParagraphs } from '../public/text-paragraphs.mjs';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { downloadName } from '../public/download-name.mjs';
assert.deepEqual(
  htmlParagraphs(
    'If you <a\n class="term"\n href="#control"\n>control</a\n> a Dragon.\nNext ability.',
  ),
  ['If you <a class="term" href="#control" >control</a > a Dragon.', 'Next ability.'],
);
assert.deepEqual(htmlParagraphs('First\n\nSecond'), ['First', 'Second']);
assert.equal(downloadName('Mein Deck', 'json'), 'Mein Deck – Octenarius.json');
assert.equal(downloadName('Äther / "Test": Deck?', 'txt'), 'Äther Test Deck – Octenarius.txt');
assert.equal(downloadName('../', 'pdf'), 'Deck – Octenarius.pdf');
assert.equal(downloadName('Mein Deck', 'pdf', 'Proxies'), 'Mein Deck – Proxies – Octenarius.pdf');
const cards = JSON.parse(
  await readFile(new URL('../public/data/cards.json', import.meta.url), 'utf8'),
);
const texts = JSON.parse(
  await readFile(new URL('../public/data/card-texts.json', import.meta.url), 'utf8'),
);
assert.deepEqual(
  texts,
  cards.map((card) => ({ id: card.id, name: card.name, set: card.set, ...card.text })),
  'Static text downloads must match the card records used by a fresh installation',
);
for (const asset of [
  'vendor/pdf-lib.min.js',
  'vendor/pdf-lib-LICENSE.md',
  'vendor/katex/katex.min.js',
  'vendor/katex/katex.min.css',
  'vendor/quill/quill.js',
  'vendor/quill/quill.snow.css',
  'assets/symbols/lp-20.png',
  'assets/symbols/lp-30.png',
]) {
  await readFile(new URL('../public/' + asset, import.meta.url));
  const tracked = spawnSync('git', ['ls-files', '--error-unmatch', 'public/' + asset], {
    cwd: new URL('../', import.meta.url),
    encoding: 'utf8',
  });
  assert.equal(tracked.status, 0, 'Required self-hosting asset is missing from Git: ' + asset);
}
for (const name of await readdir(new URL('../public/', import.meta.url))) {
  if (!name.endsWith('.mjs')) continue;
  const file = new URL('../public/' + name, import.meta.url);
  const result = spawnSync(process.execPath, ['--check', file.pathname], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const source = await readFile(file, 'utf8');
  assert(!/LOKAL-KOMMENTAR/.test(source), name + ' includes historical patch comments');
  for (const match of source.matchAll(/(?:from\s*|import\s*\()\s*['"]\.\/([^'"]+)['"]/g)) {
    assert(!match[1].includes('?'), name + ' has versioned module identity');
    await readFile(new URL('../public/' + match[1], import.meta.url));
  }
}
for (const name of [
  'test-card-search',
  'test-proxy-printer',
  'test-deck-model',
  'test-deck-sync',
  'test-deck-account',
  'test-deck-legacy',
  'test-rulebook',
  'test-card-styleguide',
  'test-token-references',
])
  await import('./' + name + '.mjs');
console.log('Source graph, syntax and export filename checks passed.');
