// Resolve named tokens before glossary linking; generic “Token” stays a rule term.
const escapeRE = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const baseName = (name) => name.replace(/\s*\(?Token\)?$/i, '').trim();

export function tokenMentions(text, cards) {
  const tokens = new Map();
  for (const c of cards) {
    if (!c.text?.types?.includes('Token') && !/Token\)?$/i.test(c.name)) continue;
    const name = baseName(c.name),
      key = name.toLowerCase();
    if (!tokens.has(key) || c.id === c.gameplaySourceId) tokens.set(key, c);
  }
  const hits = [];
  for (const [name, card] of tokens) {
    const aliases = [baseName(card.name)];
    if (name === 'spectral moth') aliases.push('Spetral Moth');
    if (name === 'goat') aliases.push('Stone Goat');
    for (const alias of aliases) {
      const re = new RegExp(
        `(?<![\\p{L}\\p{N}])(?:["“])?${escapeRE(alias)}(?:["”])?(?:\\s+(?:Character|Artifact|Training))?\\s+Tokens?(?![\\p{L}\\p{N}])`,
        'giu',
      );
      for (const m of text.matchAll(re))
        hits.push({ start: m.index, end: m.index + m[0].length, text: m[0], cards: [card] });
    }
  }
  const combined = /Chieftain of War, Magic or Strategy Training Tokens?/gi;
  for (const m of text.matchAll(combined)) {
    const found = ['war', 'magic', 'strategy']
      .map((x) => tokens.get(`chieftain of ${x}`))
      .filter(Boolean);
    if (found.length === 3)
      hits.push({ start: m.index, end: m.index + m[0].length, text: m[0], cards: found });
  }
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const result = [];
  for (const hit of hits) if (!result.length || hit.start >= result.at(-1).end) result.push(hit);
  return result;
}

export function referencedTokens(text, cards, currentId) {
  return [
    ...new Map(
      tokenMentions(text, cards)
        .flatMap((m) => m.cards)
        .filter((c) => c.id !== currentId)
        .map((c) => [baseName(c.name).toLowerCase(), c]),
    ).values(),
  ];
}

export function renderTokenLinks(text, cards, render, link) {
  let end = 0,
    result = '';
  for (const m of tokenMentions(text, cards)) {
    result += render(text.slice(end, m.start));
    result +=
      m.cards.length === 1
        ? link(m.cards[0], m.text)
        : m.cards.map((c) => link(c, baseName(c.name))).join(', ');
    end = m.end;
  }
  return result + render(text.slice(end));
}

// Printed names sometimes differ in punctuation or contain known transcription errors.
const namePattern = (name) =>
  escapeRE(name).replace(/['’]/g, "['’]").replace(/,/g, ',?').replace(/\s+/g, '\\s+');
const aliases = {
  'Silas the Protection Mage': ['Silas, the Protection Mage'],
  'Drumin, the Druid': ['Drumin, The Druide'],
  'Fraya, Baroness of Truth': ['Fraya, Baroness ot Truth'],
  'Member of the Winged Blades': ['Member of the Windbladeguard'],
};
const indexCache = new WeakMap();

function cardIndex(cards) {
  if (indexCache.has(cards)) return indexCache.get(cards);
  const grouped = new Map();
  for (const card of cards) {
    const key = card.name.toLowerCase();
    if (!grouped.has(key) || card.id === card.gameplaySourceId) grouped.set(key, card);
  }
  const index = [...grouped.values()].flatMap((card) =>
    [card.name, ...(aliases[card.name] || [])].map((name) => ({
      card,
      re: new RegExp(`(?<![\\p{L}\\p{N}])${namePattern(name)}(?![-\\p{L}\\p{N}])`, 'giu'),
    })),
  );
  indexCache.set(cards, index);
  return index;
}

export function cardMentions(text, cards, terms = []) {
  const ambiguous = new Set(
    ['rise', 'fire', 'alliance', 'growth', 'barrier', 'fear', 'surge', ...terms].map((x) =>
      x.toLowerCase(),
    ),
  );
  const hits = tokenMentions(text, cards);
  for (const { card, re } of cardIndex(cards))
    for (const m of text.matchAll(re)) {
      if (ambiguous.has(card.name.toLowerCase())) {
        const before = text.slice(Math.max(0, m.index - 65), m.index);
        if (
          !/(?:named|called|rise into|summon|cast|create|sacrifice|control)\s+(?:(?:one|a|an|the|two|three|\d+)\s+)?["“]?$/i.test(
            before,
          )
        )
          continue;
      }
      hits.push({ start: m.index, end: m.index + m[0].length, text: m[0], cards: [card] });
    }
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const result = [];
  for (const hit of hits) if (!result.length || hit.start >= result.at(-1).end) result.push(hit);
  return result;
}

export function referencedCards(text, cards, current, terms = []) {
  return [
    ...new Map(
      cardMentions(text, cards, terms)
        .flatMap((m) => m.cards)
        .filter(
          (c) =>
            c.name !== current?.name &&
            (!current?.gameplayId || c.gameplayId !== current.gameplayId),
        )
        .map((c) => [baseName(c.name).toLowerCase(), c]),
    ).values(),
  ];
}

export function renderCardLinks(text, cards, render, link, terms = []) {
  let end = 0,
    result = '';
  for (const m of cardMentions(text, cards, terms)) {
    result += render(text.slice(end, m.start));
    result +=
      m.cards.length === 1
        ? link(m.cards[0], m.text)
        : m.cards.map((c) => link(c, baseName(c.name))).join(', ');
    end = m.end;
  }
  return result + render(text.slice(end));
}

// Inverse links are limited to named tokens in an explicit creation clause.

export function tokenCreators(token, cards) {
  if (!token.text?.types?.includes('Token') && !/Token\)?$/i.test(token.name)) return [];
  const target = baseName(token.name).toLowerCase(),
    found = new Map();
  for (const card of cards) {
    if (card.name === token.name) continue;
    const text = card.text?.rulesText || '';
    const creates = tokenMentions(text, cards).some((hit) => {
      if (!hit.cards.some((c) => baseName(c.name).toLowerCase() === target)) return false;
      const before = text
        .slice(0, hit.start)
        .split(/[.!?;:\n]/)
        .at(-1);
      return /\bcreates?\b(?:(?!\b(?:sacrifice|destroy|banish)\b).)*$/i.test(before);
    });
    if (creates) {
      const key = (card.gameplayId || card.name).toLowerCase();
      if (!found.has(key) || card.id === card.gameplaySourceId) found.set(key, card);
    }
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}
