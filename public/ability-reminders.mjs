import definitions from './ability-reminder-definitions.mjs';
const norm = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();
const escapeRE = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let entries = [];
function rebuildEntries() {
  entries = definitions
    .flatMap((d) =>
      [d.name, ...(d.aliases || [])].map((name) => ({
        name,
        d,
        pattern: escapeRE(name).replace(/\\\[[XN]\\\]/g, '(?:\\[(?:\\d+|X|N)\\]|(?:\\d+|X|N))'),
      })),
    )
    .sort((a, b) => b.name.length - a.name.length);
}
export function syncAbilityGlossary(terms) {
  for (const term of terms) {
    let d = definitions.find(
      (x) => x.glossaryId === term.id || x.name.toLowerCase() === term.en.toLowerCase(),
    );
    if (!d && term.kind === 'Keyword') {
      d = { id: term.id, name: term.en, aliases: [], glossaryId: term.id, legacy: [] };
      definitions.push(d);
    }
    if (d) {
      if (d.reminderSource !== 'appendix-iii-ruletext') {
        d.de = (term.deText || '').trim();
        d.en = (term.enText || '').trim();
      }
      d.glossaryId = term.id;
      d.aliases = [...new Set([...(d.aliases || []), ...(term.aliases || [])])];
    }
  }
  rebuildEntries();
}
rebuildEntries();
const matches = (text) => {
  const result = [];
  const rx = new RegExp(
    '(?<![\\p{L}\\p{N}_])(?:' +
      entries.map((x, i) => `(?<ability${i}>${x.pattern})`).join('|') +
      ')(?![\\p{L}\\p{N}_])',
    'giu',
  );
  for (const m of text.matchAll(rx)) {
    const entry = entries.find((_, i) => m.groups['ability' + i] !== undefined);
    result.push({
      start: m.index,
      end: m.index + m[0].length,
      text: m[0],
      definition: entry.d,
      parameter: /\[[XN]\]/.test(entry.d.name) ? m[0].match(/\b(\d+|X|N)\b/i)?.[1] : null,
    });
  }
  return result;
};
const explanation = (match, language) => {
  const text = match.definition[language === 'de' ? 'de' : 'en'];
  return match.parameter ? text.replace(/\b[XN]\b/g, match.parameter) : text;
};

export function stripReminders(value) {
  const text = String(value ?? '');
  const stack = [],
    ranges = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') stack.push(i);
    else if (text[i] === ')' && stack.length) {
      const start = stack.pop();
      if (stack.length) continue;
      const before = text.slice(0, start).trimEnd(),
        last = matches(before).at(-1);
      if (
        last &&
        last.end === before.length &&
        last.definition.legacy.some((s) => norm(s) === norm(text.slice(start + 1, i)))
      )
        ranges.push([start, i + 1]);
    }
  }
  let out = text;
  for (const [a, b] of ranges.reverse()) out = out.slice(0, a) + out.slice(b);
  return out
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
// Source keywords are mentions, not proof of ownership. Only leading keyword runs
// are rendered as ability declarations; other mentions get a labeled explanation.

export function abilityParts(value, language = 'en') {
  const text = stripReminders(value),
    seen = new Set(),
    parts = [];
  const found = matches(text).filter((m) => {
    let depth = 0;
    for (const ch of text.slice(0, m.start)) {
      if (ch === '(') depth++;
      else if (ch === ')') depth = Math.max(0, depth - 1);
    }
    return depth === 0;
  });
  let cursor = 0,
    leading = true,
    previousEnd = 0;
  for (const m of found) {
    const between = text.slice(previousEnd, m.start);
    leading = leading && /^[\s,;]*$/.test(between);
    const lineStart = text.lastIndexOf('\n', m.start - 1) + 1;
    const after = text.slice(m.end);
    // A preserved parenthesis contains card-specific instructions, not a removable reminder.
    if (/^\s*\(/.test(after)) {
      seen.add(m.definition.id);
      previousEnd = m.end;
      continue;
    }
    const next = after.trimStart();
    const boundary =
      /^(?:$|[\n,;.])/.test(after) ||
      entries.some((e) => next.startsWith(e.name)) ||
      /^(?:When|Whenever|At |If |This |Pay |Sacrifice |Deal |Draw |Target |Unturn |Banish |Search |Destroy |Create |Return |\{)/.test(
        next,
      );
    const usedAction = /(?:^|:\s*|\bthen\s+|\bplay,\s*)Use\s*$/i.test(
      text.slice(lineStart, m.start),
    );
    const declaration =
      boundary && (leading || /^\s*$/.test(text.slice(lineStart, m.start)) || usedAction);
    if (declaration && !seen.has(m.definition.id)) {
      parts.push({ text: text.slice(cursor, m.end) });
      parts.push({
        reminder: true,
        id: m.definition.id,
        name: m.text,
        text: explanation(m, language),
      });
      cursor = m.end;
      seen.add(m.definition.id);
    }
    previousEnd = m.end;
  }
  parts.push({ text: text.slice(cursor) });
  // Explain references without granting the named ability to this card.
  for (const m of found)
    if (!seen.has(m.definition.id)) {
      seen.add(m.definition.id);
      parts.push({
        reminder: true,
        reference: true,
        id: m.definition.id,
        name: m.text,
        text: explanation(m, language),
      });
    }
  return parts;
}

export function expandedRules(value, language = 'en') {
  return abilityParts(value, language)
    .map((p) =>
      p.reminder ? (p.reference ? '\n' + p.name + ': ' : ' ') + '(' + p.text + ')' : p.text,
    )
    .join('');
}

export function normalizeCardReminders(card) {
  const text = { ...card.text };
  for (const field of ['rulesText', 'additionalCostsText'])
    text[field] = stripReminders(text[field]).replace(
      /\b(gains?\s+\{(?:X|\d+)\})(?!\s*ASP\b)/gi,
      '$1 ASP',
    );
  return { ...card, text };
}

// Names identify rows; only the middle Regeltext column supplies card reminders.
export function syncAbilityAppendix(rows) {
  const appendix = rows.find((r) => r.id === 'appendix-iii');
  if (!appendix) return;
  for (const line of appendix.body.split('\n')) {
    if (!/^\|\s*\*\*/.test(line)) continue;
    const cells = line.split(/(?<!\\)\|/).slice(1, -1);
    if (cells.length !== 3) continue;
    const name = cells[0].replace(/\*\*/g, '').trim();
    const d = definitions.find((d) =>
      [d.name, ...(d.aliases || [])].some((n) => n.toLowerCase() === name.toLowerCase()),
    );
    if (!d) continue;
    const text = cells[1].trim().replace(/\\\|/g, '|');
    if (!text) continue;
    d.legacy = [...new Set([...d.legacy, d.en, d.de, text])];
    d.en = text;
    d.de = text;
    d.reminderSource = 'appendix-iii-ruletext';
  }
  rebuildEntries();
}
