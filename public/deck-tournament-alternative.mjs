const palette = {
  white: ['W', 'Weiß', '#e9e4d5'],
  black: ['B', 'Schwarz', '#30383d'],
  orange: ['O', 'Orange', '#d98c34'],
  green: ['G', 'Grün', '#397447'],
  grey: ['E', 'Equilibra', '#909a99'],
  purple: ['P', 'Violett', '#8a64a6'],
  red: ['R', 'Rot', '#ae4b43'],
  brown: ['Br', 'Braun', '#946b49'],
  blue: ['BL', 'Blau', '#387ba8'],
};

/** An A4 landscape sheet with compact color labels and wide card-name cells. */
export async function alternativeTournamentBytes(deck, cards, fullName, nickname) {
  const { PDFDocument, StandardFonts, rgb } = globalThis.PDFLib;
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([841.89, 595.28]);
  const width = page.getWidth(),
    height = page.getHeight();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const brand = await pdf.embedFont(StandardFonts.TimesRoman);
  const color = (hex) =>
    rgb(
      ...hex
        .replace('#', '')
        .match(/../g)
        .map((v) => parseInt(v, 16) / 255),
    );
  const ink = color('#15343b'),
    line = color('#ccd2d0'),
    faint = color('#f2f5f4');
  const clean = (value) =>
    String(value ?? '')
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, '-')
      .replace(/…/g, '...')
      .replace(/[^\x20-\x7e\u00a0-\u00ff]/g, '-');
  const text = (value, x, top, size = 10, font = regular, fill = ink) =>
    page.drawText(clean(value), { x, y: height - top - size, size, font, color: fill });
  const rect = (x, top, w, h, fill) =>
    page.drawRectangle({ x, y: height - top - h, width: w, height: h, color: fill });
  const rule = (x, top, w, fill = line) =>
    page.drawLine({
      start: { x, y: height - top },
      end: { x: x + w, y: height - top },
      thickness: 0.5,
      color: fill,
    });
  const wrap = (value, w, size, font) => {
    const lines = [];
    let current = '';
    for (const word of clean(value).split(/\s+/)) {
      if (current && font.widthOfTextAtSize(current + ' ' + word, size) > w) {
        lines.push(current);
        current = '';
      }
      for (const char of (current ? ' ' : '') + word) {
        if (current && font.widthOfTextAtSize(current + char, size) > w) {
          lines.push(current);
          current = '';
        }
        current += char;
      }
    }
    if (current) lines.push(current);
    return lines;
  };
  const cell = (value, x, top, w, h, preferred = 10.5, font = regular) => {
    if (!value) return;
    let size = preferred,
      lines = wrap(value, w, size, font);
    while (lines.length * size * 1.08 > h - 3 && size > 1) {
      size -= 0.25;
      lines = wrap(value, w, size, font);
    }
    const start = top + (h - lines.length * size * 1.08) / 2;
    lines.forEach((s, i) => text(s, x, start + i * size * 1.08, size, font));
  };
  const index = new Map(cards.map((c) => [c.id, c]));
  const card = (e) => index.get(e.printingId);
  const name = (e) => card(e)?.name || e.cardId || e.printingId;
  const entries = (zone) => deck.entries.filter((e) => e.zone === zone);
  const pool = entries('pool'),
    spells = entries('spell');
  if (pool.length > 20 || spells.length > 40)
    throw Error('Der Turnierbogen bietet 20 Pool- und 40 Spell-Zeilen.');
  pdf.setTitle('Bluthelden - Turnierdeckliste');
  pdf.setCreator('Octenarius');
  text('OCTENARIUS', 28, 18, 17, brand);
  text('BLUTHELDEN · TURNIERDECKLISTE', width - 218, 24, 9, bold);
  rule(28, 43, width - 56, color('#9b782e'));
  text('Vor- und Nachname', 28, 53, 8);
  cell(fullName, 125, 48, 306, 23, 11);
  rule(123, 71, 308);
  text('Nickname', 459, 53, 8);
  cell(nickname, 514, 48, width - 542, 23, 11);
  rule(512, 71, width - 540);
  const gap = 12,
    specialWidth = (width - 56 - gap) / 2;
  for (const [i, zone, label] of [
    [0, 'sovereign', 'HERRSCHER'],
    [1, 'rune', 'RUNE'],
  ]) {
    const x = 28 + i * (specialWidth + gap);
    rect(x, 82, specialWidth, 43, faint);
    rect(x, 82, 3, 43, color('#9b782e'));
    text(label, x + 12, 87, 8, bold);
    cell(entries(zone).map(name).join(', '), x + 12, 99, specialWidth - 24, 24, 12, bold);
  }
  const colWidth = (width - 56 - 2 * gap) / 3;
  const columns = [
    [pool, 'POOL DECK'],
    [spells.slice(0, 20), 'SPELL DECK'],
    [spells.slice(20), 'SPELL DECK'],
  ];
  columns.forEach(([rows, title], col) => {
    const x = 28 + col * (colWidth + gap);
    text(title, x, 135, 10, bold);
    rect(x, 151, colWidth, 17, faint);
    text('Anz. / Farbe', x + 3, 155, 7);
    text('Kartenname', x + 49, 154, 8, bold);
    for (let i = 0; i < 20; i++) {
      const top = 168 + i * 18.5;
      if (i % 2) rect(x, top, colWidth, 18.5, faint);
      rule(x, top + 18.5, colWidth);
      const e = rows[i];
      if (!e) continue;
      cell(String(e.quantity), x + 4, top, 12, 18.5, 10, bold);
      const keys = [
        ...new Set(
          (card(e)?.text?.colors || []).map((k) => k.toLowerCase().replace(/^gray$/, 'grey')),
        ),
      ];
      const labels = keys.map((k) => palette[k]?.[0] || '?');
      cell(labels.join(' '), x + 19, top, 23, 18.5, 6.5);
      keys.forEach((key, j) =>
        rect(
          x + 43,
          top + 3 + (j * 12) / keys.length,
          2,
          12 / keys.length,
          color(palette[key]?.[2] || '#909a99'),
        ),
      );
      cell(name(e), x + 49, top, colWidth - 53, 18.5);
    }
  });
  let lx = 28;
  for (const [code, label] of Object.values(palette)) {
    const value = code + ' ' + label;
    text(value, lx, 551, 7);
    lx += regular.widthOfTextAtSize(value, 7) + 14;
  }
  rule(28, 568, width - 56);
  const total = (zones) =>
    deck.entries.filter((e) => zones.includes(e.zone)).reduce((sum, e) => sum + e.quantity, 0);
  text(
    `Pool: ${total(['pool'])}     Spell: ${total(['spell'])}     Gesamt: ${total(['pool', 'spell', 'sovereign', 'rune'])}`,
    28,
    574,
    9,
    bold,
  );
  return pdf.save();
}
