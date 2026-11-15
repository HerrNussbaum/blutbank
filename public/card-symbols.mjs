/** Shared plain-text notation. Ordinary uses of the word “turn” stay untouched. */

export function symbolText(value) {
  return String(value ?? '')
    .replace(/\(T\)|\[(?:turn|tap|T)\]|\{(?:turn|tap)\}|[↷↻⟳]/gi, '{T}')
    .replace(/\b(\d+|X)\s+ASP\b/gi, '{$1}')
    .replace(/\[ASP\s*:?\s*(\d+|X)\]|\[(\d+|X)\s*ASP\]/gi, (_, a, b) => `{${a || b}}`);
}
export const aspText = (value) => (value == null || value === '' ? '' : `{${value}}`);

/** Printed line endings are layout; keep only explicit paragraphs and ability boundaries. */

export function cardFlow(value) {
  const headings =
    /^(?:Flying|Skyguard|Speed|Horde|Punch|Surge|Defender|Barrier|Hideout|Alliance|Veil|Fear|Ecstasy|First Damage|Spectral Ward|Overrun|Advisor)(?:\s*\(|$)/i;
  const ability =
    /^(?:\{(?:T|X|\d+)\}[^:\n]*:|When\b|Whenever\b|At the (?:beginning|end)\b|If you control a LVL\b|[•●]\s)/i;
  return symbolText(value)
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((paragraph) => {
      const lines = paragraph
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      let out = '',
        depth = 0;
      for (const line of lines) {
        const boundary = depth === 0 && (headings.test(line) || ability.test(line));
        out += (out ? (boundary ? '\n' : ' ') : '') + line;
        depth = Math.max(
          0,
          depth + (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length,
        );
      }
      return out;
    })
    .join('\n\n')
    .replace(/\b(gains?\s+\{(?:X|\d+)\})(?!\s*ASP\b)/gi, '$1 ASP');
}

// Render only known tokens; all other input remains escaped plain text.
const escapeHTML = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const image = (file, alt = '', extra = '') =>
  `<img class="game-symbol ${extra}" src="assets/symbols/aligned/${file}.webp" alt="${escapeHTML(alt)}" ${file.startsWith('turn-') ? 'title="Turn: Drehe diese Karte, um die Fähigkeit zu aktivieren. / Turn this card to activate the ability."' : file.startsWith('asp-') ? 'title="ASP: Astralpunkte zum Bezahlen von Karten oder Fähigkeiten. / Astral points used to pay for cards or abilities."' : ''} ${alt ? '' : 'aria-hidden="true"'} width="28" height="28" decoding="async">`;

export function costHTML(value, ability = false) {
  if (value == null || value === '') return '';
  const n = String(value).toUpperCase();
  return /^[0-9X]$/.test(n)
    ? image(
        `${ability ? 'asp-faehigkeit-weiss-' : 'asp-'}${n.toLowerCase()}`,
        `{${n}}`,
        ability ? 'ability-symbol' : 'cost-symbol',
      )
    : escapeHTML(aspText(value));
}

export function symbolHTML(value) {
  return escapeHTML(symbolText(value)).replace(/\{(T|X|[0-9]+)\}/g, (token, n) =>
    n === 'T' ? image('turn-weiss', '{T}') : costHTML(n, true),
  );
}

export function statIcon(key, value) {
  if (key === 'magic') return image('spellpower');
  if (key === 'hp') return image('hp-shield');
  if (['pow', 'hp', 'res', 'ini'].includes(key)) return image(key);
  if (key === 'level' && [1, 2].includes(Number(value))) return image(`lvl-${value}`);
  return '';
}

export function mechanicHTML(key) {
  const files = { pool: 'pool', binding: 'bindung', rise: 'rise' };
  return `${files[key] ? image(files[key]) : ''}${escapeHTML(key[0]?.toUpperCase() + key.slice(1))}`;
}

/** Balanced reminder parentheses; unmatched source text is kept as plain text. */

export function reminderParts(value) {
  const text = symbolText(value),
    parts = [];
  let start = 0,
    open = -1,
    depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') {
      if (depth === 0) open = i;
      depth++;
    } else if (text[i] === ')' && depth) {
      depth--;
      if (depth === 0) {
        if (open > start) parts.push({ text: text.slice(start, open), reminder: false });
        parts.push({ text: text.slice(open, i + 1), reminder: true });
        start = i + 1;
      }
    }
  }
  if (start < text.length) parts.push({ text: text.slice(start), reminder: false });
  return parts;
}

export function reminderHTML(value) {
  return reminderParts(value)
    .map((p) => (p.reminder ? `<em>${symbolHTML(p.text)}</em>` : symbolHTML(p.text)))
    .join('');
}
