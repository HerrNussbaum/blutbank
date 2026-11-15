import { cardSurcharges } from './deck-costs.mjs';
import { costHTML, statIcon } from './card-symbols.mjs';
const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const tips = {
  asp: [
    'ASP-Kosten: Astralpunkte, die zum Ausspielen der Karte bezahlt werden.',
    'ASP cost: Astral points paid to play this card.',
  ],
  level: [
    'Level: Stufe des Charakters; relevant für Ausspielbedingungen und Karteneffekte.',
    'Level: The Character’s level, used by play requirements and card effects.',
  ],
  pool: ['Pool: Diese Karte gehört zum Pool-Deck.', 'Pool: This card belongs to the Pool Deck.'],
  rise: [
    'Rise: Ersetzt diese Karte durch die im Effekt benannte Karte; Counter werden übertragen.',
    'Rise: Replaces this card with the named card and transfers its counters.',
  ],
  magic: [
    'Spellpower: Wird mit RES verglichen. Bei mindestens gleicher Höhe wirkt der Effekt.',
    'Spellpower: Compared with RES; the effect applies if Spellpower is at least as high.',
  ],
  res: [
    'Resistenz (RES): Schützt vor Effekten mit niedrigerer Spellpower.',
    'Resistance (RES): Protects against effects with lower Spellpower.',
  ],
  ini: [
    'Initiative (INI): Wird für INI-Checks und die Kampfreihenfolge verwendet.',
    'Initiative (INI): Used for INI Checks and combat order.',
  ],
  pow: [
    'Power (POW): Bestimmt den Kampfschaden des Charakters.',
    'Power (POW): Determines the Character’s combat damage.',
  ],
  hp: [
    'Hitpoints (HP): Schaden senkt die HP. Bei 0 oder weniger wird der Charakter zerstört.',
    'Hitpoints (HP): Damage reduces HP. At 0 or less, the Character is destroyed.',
  ],
};
const tip = (key, lang) => esc(tips[key]?.[lang === 'en' ? 1 : 0] || key);
const hasValue = (value) => value !== null && value !== undefined && value !== '';

export function cardHeading(card, lang = 'de', heading = 'h1') {
  const d = card.text || {},
    level = d.stats?.level;
  const sovereign = d.types?.includes('Sovereign');
  const cost =
    sovereign && hasValue(d.stats?.lp)
      ? [20, 30].includes(Number(d.stats.lp))
        ? /* HTML */ `<span class="sovereign-life" aria-label="${esc(d.stats.lp)} LP"
            ><img
              src="assets/symbols/lp-${Number(d.stats.lp)}.png"
              alt="${esc(d.stats.lp)} LP"
              width="60"
              height="60"
          /></span>`
        : /* HTML */ `<span class="sovereign-life">${esc(d.stats.lp)} LP</span>`
      : costHTML(d.stats?.asp);
  const costTip = sovereign
    ? lang === 'en'
      ? 'Life points (LP): At 0 or less, you lose the game.'
      : 'Lebenspunkte (LP): Bei 0 oder weniger verlierst du das Spiel.'
    : tip('asp', lang);
  const levelIcon = statIcon('level', level);
  const badges = [
    ...['pool', 'rise'].map((key) =>
      d.mechanics?.[key] === true
        ? /* HTML */ `<span class="card-heading-badge" title="${tip(key, lang)}"
            ><img
              class="game-symbol"
              src="assets/symbols/aligned/${key}.webp"
              width="32"
              height="32"
              alt="${key === 'pool' ? 'Pool' : 'Rise'}"
          /></span>`
        : '',
    ),
    hasValue(level)
      ? /* HTML */ `<span
          class="card-heading-badge"
          title="${tip('level', lang)}"
          aria-label="Level ${esc(level)}"
          >${levelIcon || `LVL ${esc(level)}`}</span
        >`
      : '',
  ].join('');
  return /* HTML */ `<div class="card-heading"><div class="card-heading-cost" title="${costTip}">${cost}</div><div class="card-heading-name"><${heading}>${esc(card.name)}</${heading}>${d.typeLine ? /* HTML */ `<p class="card-type-line">${esc(d.typeLine)}</p>` : ''}</div><div class="card-heading-badges">${badges}</div></div>`;
}

export function cardValueRow(stats = {}, lang = 'de') {
  const labels = {
    magic: 'Spellpower',
    res: lang === 'en' ? 'Resistance' : 'Resistenz',
    ini: lang === 'en' ? 'Initiative' : 'Initiative',
    pow: lang === 'en' ? 'Power' : 'Stärke',
    hp: lang === 'en' ? 'Health' : 'Trefferpunkte',
  };
  const keys = ['magic', 'res', 'ini', 'pow', 'hp'];
  if (!keys.some((k) => hasValue(stats[k]))) return '';
  return `<dl class="card-values" aria-label="${lang === 'en' ? 'Card stats' : 'Kartenwerte'}">${keys
    .map((k) =>
      hasValue(stats[k])
        ? /* HTML */ `<div class="card-value" data-stat="${k}" title="${tip(k, lang)}">
            <dt><span class="visually-hidden">${labels[k]}</span>${statIcon(k)}</dt>
            <dd>${esc(stats[k])}</dd>
          </div>`
        : /* HTML */ `<div class="card-value-empty" data-stat="${k}" aria-hidden="true"></div>`,
    )
    .join('')}</dl>`;
}

export function cardPropertyRow(card, lang = 'de') {
  const values = cardSurcharges(card);
  if (!values) return cardValueRow(card.text?.stats, lang);
  const names = {
    white: 'Weiß',
    blue: 'Blau',
    green: 'Grün',
    brown: 'Braun',
    purple: 'Lila',
    red: 'Rot',
    orange: 'Orange',
    black: 'Schwarz',
  };
  const colors = Object.keys(names);
  return /* HTML */ `<div class="sovereign-costs">
    ${Object.entries(values)
      .map(([color, n]) => {
        const label =
          lang === 'en'
            ? `${color}: ${n === null ? 'cannot be played' : `+${n} ASP`}`
            : `${names[color]}: ${n === null ? 'nicht spielbar' : `+${n} ASP`}`;
        return /* HTML */ `<span
          class="sovereign-cost"
          title="${esc(label)}"
          role="img"
          aria-label="${esc(label)}"
          ><span
            class="sovereign-crystal${n === null ? ' excluded' : ''}"
            style="background-position:${(colors.indexOf(color) * 100) / 7}% 50%"
            aria-hidden="true"
          ></span
          ><span class="sovereign-surcharge" aria-hidden="true"
            >${n === null ? '×' : '+' + n}</span
          ></span
        >`;
      })
      .join('')}
  </div>`;
}

export function colorCrystal(color) {
  const index = ['white', 'blue', 'green', 'brown', 'purple', 'red', 'orange', 'black'].indexOf(
    color,
  );
  if (index < 0 && !['grey', 'colorless'].includes(color)) return '';
  return /* HTML */ `<span
    class="color-crystal${index < 0 ? ' color-crystal-neutral' : ''}"
    style="background-position:${(Math.max(0, index) * 100) / 7}% 50%"
    aria-hidden="true"
  ></span>`;
}
