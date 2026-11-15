import assert from 'node:assert/strict';
import { subtree, moveSection, chapterOf, renderDelta } from '../public/rulebook.mjs';
const rows = [
  { id: '1', parent: '' },
  { id: '1.1', parent: '1' },
  { id: 'nested', parent: '1.1' },
  { id: 'other', parent: '1' },
  { id: '2', parent: '' },
];
assert.deepEqual(
  subtree(rows, '1.1').map((r) => r.id),
  ['1.1', 'nested'],
);
assert.equal(chapterOf(rows, 'nested'), '1');
assert.deepEqual(
  moveSection(rows, '1.1', 1).map((r) => r.id),
  ['1', 'other', '1.1', 'nested', '2'],
);
assert.deepEqual(
  moveSection(rows, '2', -1).map((r) => r.id),
  ['2', '1', '1.1', 'nested', 'other'],
);
assert.equal(
  renderDelta({ ops: [{ insert: '<script>', attributes: { bold: true } }, { insert: '\n' }] }),
  '<p><strong>&lt;script&gt;</strong></p>',
);
assert(
  !renderDelta({
    ops: [{ insert: 'x', attributes: { link: 'javascript:evil()' } }, { insert: '\n' }],
  }).includes('href'),
);
assert.equal(
  renderDelta({
    ops: [
      { insert: 'One' },
      { insert: '\n', attributes: { list: 'ordered' } },
      { insert: 'Two' },
      { insert: '\n', attributes: { list: 'ordered' } },
    ],
  }),
  '<ol><li>One</li><li>Two</li></ol>',
);
console.log('Whole rulebook structure, stable links, subtree movement and safe rich text passed.');
const rich = renderDelta({
  ops: [
    {
      insert: 'Rich',
      attributes: {
        strike: true,
        color: '#ff0000',
        background: 'rgb(255, 255, 0)',
        font: 'serif',
        size: 'large',
        script: 'super',
      },
    },
    { insert: '\n', attributes: { header: 4, align: 'center', indent: 2, direction: 'rtl' } },
    { insert: { image: 'https://example.test/image.png' } },
    { insert: '\n' },
    { insert: { video: 'https://www.youtube.com/embed/test' } },
    { insert: '\n' },
    { insert: { formula: 'x^2' } },
    { insert: '\n' },
  ],
});
assert(
  rich.includes('<s>') &&
    rich.includes('<sup>') &&
    rich.includes('text-align:center') &&
    rich.includes('<h4'),
);
assert(
  rich.includes('rule-image') && rich.includes('rule-video') && rich.includes('data-formula="x^2"'),
);
assert(
  !renderDelta({
    ops: [
      { insert: { image: 'javascript:evil' } },
      { insert: { video: 'https://evil.test/embed/a' } },
      { insert: '\n' },
    ],
  }).includes('src='),
);
assert(
  !renderDelta({
    ops: [
      { insert: 'safe', attributes: { color: 'red;position:fixed', font: 'x" onclick="evil' } },
      { insert: '\n' },
    ],
  }).includes('style='),
);
console.log('Full rich text, safe CSS, image/video allowlists and formulas passed.');
assert.equal(
  renderDelta({
    ops: [
      { insert: 'A' },
      { insert: '\n', attributes: { table: 'row-1' } },
      { insert: 'B' },
      { insert: '\n', attributes: { table: 'row-1' } },
      { insert: 'C' },
      { insert: '\n', attributes: { table: 'row-2' } },
      { insert: '\n' },
    ],
  }),
  '<div class="table-wrap"><table><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td></tr></tbody></table></div><p><br></p>',
);

assert(
  renderDelta({
    ops: [
      {
        insert: 'Clipboard',
        attributes: {
          background: 'rgba(0, 0, 0, 0)',
          color: 'rebeccapurple',
          link: '/#/de/rules/1',
        },
      },
      { insert: '\n' },
    ],
  }).includes('background-color:rgba(0, 0, 0, 0)'),
);
assert(
  !renderDelta({
    ops: [{ insert: 'x', attributes: { link: 'javascript:alert(1)' } }, { insert: '\n' }],
  }).includes('href='),
);
