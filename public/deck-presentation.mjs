import { colorCrystal } from './card-layout.mjs';
import { costHTML, statIcon } from './card-symbols.mjs';
import { bindDeckPreview } from './deck-hover-preview.mjs';
import { previewCardFace } from './card-face-provider.mjs';
import { aspCost, sovereignProfile, costStatistics, entryCard } from './deck-costs.mjs';
import { deckStats, zones, zoneLabels } from './deck-model.mjs';
import { CardSearch } from './card-search.mjs';
export const escapeHTML = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const esc = escapeHTML;

/* Kleine sichere Textauszeichnung für die optionale Deckbeschreibung:
 * Absätze, einfache Listen und bis zu drei Überschriftsebenen. Kein freies HTML.
 */
export function descriptionHTML(text) {
  let out = '',
    list = false;
  for (const line of String(text || '').split('\n')) {
    if (/^[-*] /.test(line)) {
      if (!list) {
        out += '<ul>';
        list = true;
      }
      out += '<li>' + esc(line.slice(2)) + '</li>';
      continue;
    }
    if (list) {
      out += '</ul>';
      list = false;
    }
    const h = /^(#{1,3})\s+(.+)$/.exec(line);
    if (h) out += `<h${h[1].length + 1}>${esc(h[2])}</h${h[1].length + 1}>`;
    else if (line.trim()) out += '<p>' + esc(line) + '</p>';
  }
  return out + (list ? '</ul>' : '');
}
export function rarityLabel(card, lang) {
  return CardSearch.label(
    card?.text?.rarity || (lang === 'en' ? 'Unknown rarity' : 'Seltenheit unbekannt'),
    lang,
  );
}

/* Reine Aufbereitung der Deckbereiche: gut prüfbar, ohne DOM oder Speicherung.
 * Jede Druckversion bleibt eigenständig. Mengen zählen Exemplare, nicht Namen.
 * Herrscher/Runen haben einen gemeinsamen Bereich mit stabiler Reihenfolge.
 * Gruppierung wirkt auf die Deckliste; Bilder bleiben ein ruhiges Raster pro Bereich.
 */
export function presentationSections(
  deck,
  index,
  {
    lang = 'de',
    group = 'type',
    sort = 'name',
    profile = null,
    adjusted = false,
    text = false,
  } = {},
) {
  const t = (de, en) => (lang === 'en' ? en : de);
  return [
    [['sovereign', 'rune'], t('Herrscher & Rune', 'Sovereign & Rune'), 'leaders'],
    ...['pool', 'spell', 'maybe'].map((z) => [[z], zoneLabels[z][lang === 'en' ? 1 : 0], z]),
  ].flatMap(([zoneIds, label, id]) => {
    const entries = deck.entries
      .filter((e) => zoneIds.includes(e.zone))
      .map((e) => ({ ...e, card: entryCard(e, index) }))
      .filter((e) => e.card);
    if (!entries.length) return [];
    const compare = (a, b) => {
      const zoneOrder = zoneIds.length > 1 ? zoneIds.indexOf(a.zone) - zoneIds.indexOf(b.zone) : 0;
      if (zoneOrder) return zoneOrder;
      if (sort === 'quantity' && a.quantity !== b.quantity) return b.quantity - a.quantity;
      if (sort === 'asp') {
        const av = aspCost(a.card, profile, adjusted).value,
          bv = aspCost(b.card, profile, adjusted).value;
        const ar = Number.isFinite(av) ? av : Infinity,
          br = Number.isFinite(bv) ? bv : Infinity;
        if (ar !== br) return ar - br;
      }
      return a.card.name.localeCompare(b.card.name, lang);
    };
    entries.sort(compare);
    const groups = new Map();
    for (const entry of entries) {
      const d = entry.card.text || {};
      const key =
        !text || zoneIds.length > 1 || group === 'none'
          ? ''
          : group === 'type'
            ? (d.types || []).map((x) => CardSearch.label(x, lang)).join(' / ')
            : group === 'rarity'
              ? rarityLabel(entry.card, lang)
              : group === 'color'
                ? (d.colors || []).map((x) => CardSearch.label(x, lang)).join(' / ')
                : '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    }
    return [
      {
        id,
        label,
        quantity: entries.reduce((sum, e) => sum + e.quantity, 0),
        groups: [...groups]
          .sort(([a], [b]) => a.localeCompare(b, lang))
          .map(([name, items]) => ({
            name,
            items,
            quantity: items.reduce((sum, e) => sum + e.quantity, 0),
          })),
      },
    ];
  });
}

/* Erstellt die Lesefläche. Bedienelemente bleiben im DOM, nur der Kartenbereich wird
 * beim Wechsel neu gezeichnet; dadurch bleiben Fokus und geöffnete Optionen erhalten.
 * In der Infospalte werden keine Kontoadressen oder erfundene Autoren angezeigt.
 */
export function mountPresentation(root, deck, index, lang) {
  const t = (de, en) => (lang === 'en' ? en : de),
    stats = deckStats(deck, index),
    profile = sovereignProfile(deck, index);
  // Darstellungswahl pro Deck während dieser Browsersitzung behalten, auch nach
  // einem Kartendetail-Besuch. Das sind keine gespeicherten Deckänderungen.
  const preferenceKey = 'blutbank.deck-view.v1:' + deck.id;
  let preferences = {};
  try {
    preferences = JSON.parse(sessionStorage.getItem(preferenceKey) || '{}') || {};
  } catch {}
  let view = ['images', 'text'].includes(preferences.view) ? preferences.view : 'images';
  let group = ['type', 'rarity', 'color', 'none'].includes(preferences.group)
    ? preferences.group
    : 'type';
  let sort = ['name', 'asp', 'quantity'].includes(preferences.sort) ? preferences.sort : 'name';
  let adjusted = preferences.adjusted === true,
    allCopies = preferences.allCopies === true;
  const date = new Date(deck.updatedAt),
    dateText = Number.isNaN(date.getTime())
      ? ''
      : date.toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' });
  const available = presentationSections(deck, index, { lang });
  root.classList.add('deck-presentation-reading');
  root.innerHTML = /* HTML */ `<div class="deck-reading-layout">
    <aside class="deck-profile" aria-label="${t('Deckinformationen', 'Deck information')}">
      <div class="deck-profile-heading">
        <h1>${esc(deck.name)}</h1>
        ${dateText ? /* HTML */ `<p class="deck-profile-meta">${t('Aktualisiert', 'Updated')} ${esc(dateText)}</p>` : ''}
      </div>
      ${deck.summary ? /* HTML */ `<p class="deck-profile-summary">${esc(deck.summary)}</p>` : ''}
      ${deck.description ? /* HTML */ `<div class="deck-profile-description">${descriptionHTML(deck.description)}</div>` : ''}
      ${available.length ? /* HTML */ `<nav class="deck-section-nav" aria-label="${t('Deckbereiche', 'Deck sections')}">${available.map((s) => /* HTML */ `<a href="#deck-zone-${s.id}" data-deck-section="deck-zone-${s.id}">${esc(s.label)}</a>`).join('')}<a href="#deck-statistics" data-deck-section="deck-statistics">${t('Statistik', 'Statistics')}</a></nav>` : ''}
    </aside>
    <div class="deck-reading-main">
      <div class="deck-reading-toolbar">
        <div class="deck-view-tools">
          <div class="deck-view-switch" role="group" aria-label="${t('Deckansicht', 'Deck view')}">
            <button type="button" data-presentation-view="text" aria-pressed="false">
              ${t('Liste', 'List')}</button
            ><button type="button" data-presentation-view="images" aria-pressed="true">
              ${t('Bilder', 'Images')}
            </button>
          </div>
          <details class="deck-display-options deck-view-settings action-menu">
            <summary
              aria-label="${t('Darstellung anpassen', 'Display options')}"
              title="${t('Darstellung anpassen', 'Display options')}"
            >
              <svg
                viewBox="0 0 24 24"
                width="19"
                height="19"
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <path d="M3 6h18M3 12h18M3 18h18" />
                <circle cx="8" cy="6" r="2" fill="var(--background)" />
                <circle cx="16" cy="12" r="2" fill="var(--background)" />
                <circle cx="10" cy="18" r="2" fill="var(--background)" />
              </svg>
            </summary>
            <div class="deck-view-controls">
              <label
                >${t('Gruppierung', 'Group by')}<select id="deck-group">
                  <option value="type">${t('Kartentyp', 'Card type')}</option>
                  <option value="rarity">${t('Seltenheit', 'Rarity')}</option>
                  <option value="color">${t('Farbe', 'Color')}</option>
                  <option value="none">${t('Keine', 'None')}</option>
                </select></label
              >
              <label
                >${t('Sortierung', 'Sort by')}<select id="deck-sort">
                  <option value="name">Name</option>
                  <option value="asp">ASP</option>
                  <option value="quantity">${t('Anzahl', 'Quantity')}</option>
                </select></label
              >
              <label class="deck-copy-setting"
                ><input
                  type="checkbox"
                  id="deck-all-copies"
                />${t('Einzelne Exemplare', 'Individual copies')}</label
              >
              <label class="cost-toggle"
                ><input type="checkbox" id="deck-adjusted" />${t('Aufschläge', 'Surcharges')}</label
              >
              ${profile ? '' : /* HTML */ `<p id="deck-cost-help" class="cost-help">${t('Für diesen Herrscher ist noch keine geprüfte Farbleiste verfügbar.', 'No reviewed color bar is available for this Sovereign.')}</p>`}
            </div>
          </details>
        </div>
        <div class="deck-reading-tools"><div class="deck-reading-actions"></div></div>
      </div>
      <div id="presented-cards"></div>
      <section class="deck-statistics" id="deck-statistics">
        <div id="deck-cost-statistics"></div>
        <div class="statistics-grid">
          ${[
            ['colors', t('Farben', 'Colors')],
            ['types', t('Kartentypen', 'Card types')],
            ['rarities', t('Seltenheiten', 'Rarities')],
          ]
            .map(
              ([key, label]) =>
                /* HTML */ `<section>
                  <h3>${label}</h3>
                  <div class="stat-distribution">
                    ${
                      Object.entries(stats[key])
                        .sort((a, b) => b[1] - a[1])
                        .map(
                          ([name, quantity]) =>
                            /* HTML */ `<div>
                              <span
                                >${key === 'colors' ? colorCrystal(name) : ''}${esc(CardSearch.label(name, lang))}</span
                              ><b>${quantity}</b
                              ><small
                                >${stats.total ? Math.round((quantity / stats.total) * 100) : 0}%</small
                              ><meter min="0" max="${Math.max(1, stats.total)}" value="${quantity}">
                                ${quantity}
                              </meter>
                            </div>`,
                        )
                        .join('') || '—'
                    }
                  </div>
                </section>`,
            )
            .join('')}
        </div>
      </section>
      ${
        stats.issues.length
          ? /* HTML */ `<details class="deck-validation">
              <summary>${t('Kopienlimits prüfen', 'Review copy limits')}</summary>
              <ul>
                ${stats.issues.map((issue) => `<li>${esc(issue)}</li>`).join('')}
              </ul>
            </details>`
          : ''
      }
    </div>
  </div>`;
  const list = root.querySelector('#presented-cards'),
    metrics = root.querySelector('#deck-cost-statistics');
  root.querySelector('#deck-group').value = group;
  root.querySelector('#deck-sort').value = sort;
  root.querySelector('#deck-adjusted').checked = adjusted;
  root.querySelector('#deck-all-copies').checked = allCopies;
  if (!profile)
    root.querySelector('#deck-adjusted').setAttribute('aria-describedby', 'deck-cost-help');
  root.querySelectorAll('[data-presentation-view]').forEach(
    (button) =>
      (button.onclick = () => {
        view = button.dataset.presentationView;
        draw();
      }),
  );
  for (const [id, change] of [
    ['deck-group', (value) => (group = value)],
    ['deck-sort', (value) => (sort = value)],
  ])
    root.querySelector('#' + id).onchange = (e) => {
      change(e.target.value);
      draw();
    };
  root.querySelector('#deck-adjusted').onchange = (e) => {
    adjusted = e.target.checked;
    draw();
  };
  root.querySelector('#deck-all-copies').onchange = (e) => {
    allCopies = e.target.checked;
    draw();
  };
  // Bereichslinks scrollen innerhalb der Ansicht; sie dürfen die #/…-App-Route nicht ersetzen.
  root.querySelectorAll('[data-deck-section]').forEach(
    (link) =>
      (link.onclick = (e) => {
        e.preventDefault();
        const target = root.querySelector('#' + link.dataset.deckSection);
        target?.scrollIntoView({
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
          block: 'start',
        });
      }),
  );
  const settingsMenu = root.querySelector('.deck-view-settings');
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && settingsMenu?.isConnected) settingsMenu.open = false;
  });
  const hidePreview = bindDeckPreview(root);

  /* Gleiche Symbolplätze in jeder Listenzeile: Pool, Rise, Level, Binding, Kosten.
   * CSS zieht nur vorhandene Symbole ohne Lücken zusammen; die Kosten bleiben rechts.
   */
  function symbols(entry) {
    const card = entry.card,
      d = card.text || {},
      s = d.stats || {},
      cost = aspCost(card, profile, adjusted);
    const icon = (key, alt) =>
      `<img class="game-symbol" src="assets/symbols/aligned/${key}.webp" alt="${alt}">`;
    if (entry.zone === 'rune') return '<span class="deck-line-symbols"></span>';
    // Die bekannten 20-/30-LP-Grafiken enthalten Zahl und Herz gemeinsam.
    // Andere Werte erhalten dasselbe Herz mit einer lesbaren Zahl als Überlagerung.
    const life = [20, 30].includes(Number(s.lp))
      ? `<img class="game-symbol deck-lp-symbol" src="assets/symbols/lp-${Number(s.lp)}.png" alt="${s.lp} LP">`
      : /* HTML */ `<span class="deck-life-custom" role="img" aria-label="${s.lp ?? '?'} LP"
          ><img src="assets/symbols/lp-heart.png" alt="" /><span>${s.lp ?? '?'}</span></span
        >`;
    const value = d.types?.includes('Resource')
      ? ''
      : entry.zone === 'sovereign'
        ? life
        : cost.status === 'forbidden'
          ? /* HTML */ `<span title="${t('Nicht spielbar', 'Not playable')}">×</span>`
          : costHTML(cost.value ?? (s.asp === 'X' ? 'X' : null)) ||
            /* HTML */ `<span title="${t('Unbekannte Kosten', 'Unknown cost')}">?</span>`;
    return /* HTML */ `<span class="deck-line-symbols"
      ><span class="deck-symbol-slot">${d.mechanics?.pool ? icon('pool', 'Pool') : ''}</span
      ><span class="deck-symbol-slot">${d.mechanics?.rise ? icon('rise', 'Rise') : ''}</span
      ><span class="deck-symbol-slot">${s.level != null ? statIcon('level', s.level) : ''}</span
      ><span class="deck-symbol-slot"
        >${d.mechanics?.binding ? icon('bindung', 'Binding') : ''}</span
      ><span class="deck-cost-slot">${value}</span></span
    >`;
  }

  function cardHTML(entry) {
    const card = entry.card,
      text = view === 'text';
    return /* HTML */ `<a
      class="presentation-card ${text ? 'deck-card-name' : 'deck-art-card'}"
      href="#/${lang}/card/${card.id}"
      aria-label="${esc(card.name)} · ${entry.quantity}×"
      data-deck-preview="${text ? 'both' : 'text'}"
      ><img
        class="${text ? 'deck-hover' : 'deck-art'}"
        src="${esc(card.image)}"
        alt="${esc(card.name)}"
        loading="lazy"
      />${text ? /* HTML */ `<span class="presentation-quantity">${entry.quantity}</span><span class="presentation-name">${esc(card.name)}</span>${symbols(entry)}` : !allCopies ? /* HTML */ `<span class="deck-art-count">${entry.quantity}×</span>` : ''}<template
        class="deck-text-template"
        >${previewCardFace(card)}</template
      ></a
    >`;
  }

  /* Nur die Kartenansicht und ASP-Kurve neu zeichnen. Die Infospalte und die
   * Hauptaktionen bleiben an Ort und Stelle; es werden keine Deckeinträge geändert.
   */
  function draw() {
    try {
      sessionStorage.setItem(
        preferenceKey,
        JSON.stringify({ view, group, sort, adjusted, allCopies }),
      );
    } catch {}
    hidePreview();
    root.dataset.presentationView = view;
    root.classList.toggle('deck-text-view', view === 'text');
    root
      .querySelectorAll('[data-presentation-view]')
      .forEach((button) =>
        button.setAttribute('aria-pressed', String(button.dataset.presentationView === view)),
      );
    const sections = presentationSections(deck, index, {
      lang,
      group,
      sort,
      profile,
      adjusted,
      text: view === 'text',
    });
    list.innerHTML = sections.length
      ? sections
          .map(
            (section) =>
              /* HTML */ `<section class="presented-zone" id="deck-zone-${section.id}">
                <h2>
                  <span>${esc(section.label)}</span
                  ><span class="deck-section-count">${section.quantity}</span>
                </h2>
                <div class="presentation-groups">
                  ${section.groups
                    .map(
                      (g) =>
                        /* HTML */ `<section class="presentation-group">
                          ${g.name ? /* HTML */ `<h3><span>${esc(g.name)}</span><span class="deck-group-count">${g.quantity}</span></h3>` : ''}
                          <div class="${view === 'text' ? 'presentation-text' : 'deck-image-grid'}">
                            ${g.items.flatMap((entry) => Array.from({ length: view === 'images' && allCopies ? entry.quantity : 1 }, () => cardHTML(entry))).join('')}
                          </div>
                        </section>`,
                    )
                    .join('')}
                </div>
              </section>`,
          )
          .join('')
      : /* HTML */ `<p class="deck-empty-hint">
          ${t('Dieses Deck enthält noch keine Karten.', 'This deck has no cards yet.')}
        </p>`;
    const costs = costStatistics(deck, index, adjusted),
      max = Math.max(1, ...Object.values(costs.curve));
    metrics.innerHTML = /* HTML */ `<section class="cost-chart">
      <h3>${t('ASP-Kurve', 'ASP curve')}</h3>
      <div class="asp-histogram">
        ${
          Object.entries(costs.curve)
            .sort((a, b) => a[0] - b[0])
            .map(
              ([n, q]) =>
                /* HTML */ `<div aria-label="{${n}}: ${q} ${t('Karten', 'cards')}">
                  <b>${q}</b
                  ><span
                    class="asp-bar"
                    style="--bar-height:${Math.max(3, (q / max) * 100)}%"
                  ></span
                  ><span>${costHTML(n)}</span>
                </div>`,
            )
            .join('') || '<p>—</p>'
        }
      </div>
    </section>`;
  }
  draw();
}
