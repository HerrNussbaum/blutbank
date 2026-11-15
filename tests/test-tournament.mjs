import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { tournamentBytes } from '../public/deck-tournament.mjs';
vm.runInThisContext(
  await readFile(new URL('../public/vendor/pdf-lib.min.js', import.meta.url), 'utf8'),
);
const { PDFPage, PDFDocument } = globalThis.PDFLib;
const drawn = [],
  originalDraw = PDFPage.prototype.drawText;
PDFPage.prototype.drawText = function (text, options) {
  drawn.push({ text, ...options });
  assert(options.x >= 0 && options.y >= 0, 'Text must stay on the sheet');
  assert(
    options.x + options.font.widthOfTextAtSize(text, options.size) <= this.getWidth() + 0.1,
    'Text must not run past the page',
  );
  return originalDraw.call(this, text, options);
};
const cards = [
  {
    id: 'long',
    name: 'Airell the Blue, Chairman of the Mages of Glimmertal',
    text: { colors: ['blue'] },
  },
  {
    id: 'multi',
    name: 'A long multi-color card name with a second line',
    text: { colors: ['white', 'blue', 'red'] },
  },
  { id: 'rune', name: 'Rune of Leros', text: { colors: ['grey'] } },
  { id: 'maybe', name: 'NEVER PRINT ME', text: { colors: [] } },
];
const deck = {
  entries: [
    { printingId: 'long', zone: 'sovereign', quantity: 1 },
    { printingId: 'rune', zone: 'rune', quantity: 1 },
    ...Array.from({ length: 20 }, () => ({ printingId: 'long', zone: 'pool', quantity: 1 })),
    ...Array.from({ length: 40 }, () => ({ printingId: 'multi', zone: 'spell', quantity: 1 })),
    { printingId: 'maybe', zone: 'maybe', quantity: 9 },
  ],
};
const before = JSON.stringify(deck);
try {
  const bytes = await tournamentBytes(deck, cards, 'Max Mustermann', 'Nickname', 'octenarius');
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 1);
  assert(Math.abs(pdf.getPages()[0].getWidth() - 841.89) < 0.1);
  assert(drawn.some((d) => d.text === 'HERRSCHER'));
  assert(drawn.some((d) => d.text === 'RUNE'));
  assert(drawn.some((d) => d.text === 'Pool: 20     Spell: 40     Gesamt: 62'));
  assert(!drawn.some((d) => d.text.includes('NEVER PRINT ME')));
  const blue = drawn.find((d) => d.text === 'BL' && d.y > 400 && d.x < 100);
  const quantity = drawn.find(
    (d) => d.text === '1' && Math.abs(d.y - blue.y) < 0.01 && d.x < blue.x,
  );
  assert.equal(blue.size, quantity.size, 'Color codes and quantities use the same font size');
  assert(blue.x > 49, 'Color codes are centered toward the name column');
  assert(
    drawn.some((d) => d.text === 'W BL R'),
    'Multi-color cards retain every color label',
  );
  const body = drawn.filter((d) => d.x >= 77 && d.y > 57 && d.y < 427 && d.size >= 7.5);
  assert(body.length >= 60, 'Every occupied row must contain a readable name');
  assert.equal(JSON.stringify(deck), before, 'Export must not modify the saved deck');
  await assert.rejects(
    () =>
      tournamentBytes(
        { entries: [...deck.entries, { printingId: 'long', zone: 'pool', quantity: 1 }] },
        cards,
        '',
        '',
        'octenarius',
      ),
    /20 Pool/,
  );
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    arrayBuffer: async () =>
      new Uint8Array(await readFile(new URL('../public/Decklist2026.pdf', import.meta.url))).buffer,
  });
  try {
    const official = await PDFDocument.load(
      await tournamentBytes({ entries: deck.entries.slice(0, 2) }, cards),
    );
    assert.equal(
      official.getPages()[0].getWidth(),
      4096,
      'The official template remains available',
    );
  } finally {
    globalThis.fetch = oldFetch;
  }
} finally {
  PDFPage.prototype.drawText = originalDraw;
}
console.log('Tournament formats, full-capacity layout, colors and deck preservation passed.');
