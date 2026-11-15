import { api } from './deck-online.mjs';
import { escapeHTML as esc } from './html-utils.mjs';
export async function mountMeta(root, cards, lang) {
  const t = (de, en) => (lang === 'en' ? en : de);
  root.innerHTML = /* HTML */ `<p>${t('Decks werden geladen …', 'Loading decks …')}</p>`;
  try {
    const { decks } = await api('meta');
    if (!root.isConnected) return;
    const card = (e) => cards.find((c) => c.id === e.printingId),
      leaders = (d, z) =>
        d.entries
          .filter((e) => e.zone === z)
          .map(card)
          .filter(Boolean);
    const values = (z) =>
      [...new Set(decks.flatMap((d) => leaders(d, z).map((c) => c.name)))].sort();
    const colors = [
      ...new Set(
        decks.flatMap((d) => leaders(d, 'sovereign').flatMap((c) => c.text?.colors || [])),
      ),
    ].sort();
    const icon = /* HTML */ `<svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      aria-hidden="true"
    >
      <path d="M3 6h18M3 12h18M3 18h18" />
      <circle cx="8" cy="6" r="2" fill="var(--surface)" />
      <circle cx="16" cy="12" r="2" fill="var(--surface)" />
      <circle cx="10" cy="18" r="2" fill="var(--surface)" />
    </svg>`;
    root.innerHTML = /* HTML */ `<div class="meta-workspace">
      <section class="meta-search-panel" aria-label="${t('Decks suchen', 'Find decks')}">
        <div class="meta-search-field">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            aria-hidden="true"
          >
            <circle cx="10.5" cy="10.5" r="7.5" />
            <path d="m16 16 6 6" /></svg
          ><input
            type="search"
            id="meta-search"
            aria-label="${t('Decks durchsuchen', 'Search decks')}"
          />
        </div>
        <details class="meta-filters" ${matchMedia('(min-width:761px)').matches ? 'open' : ''}>
          <summary>${icon}<span>${t('Filter', 'Filter')}</span></summary>
          <div class="meta-filter-fields">
            ${[
              ['leader', t('Herrscher', 'Sovereign'), values('sovereign')],
              ['color', t('Farbe', 'Color'), colors],
              ['rune', t('Rune', 'Rune'), values('rune')],
            ]
              .map(
                ([id, label, options]) =>
                  /* HTML */ `<label
                    >${label}<select id="meta-${id}">
                      <option value="">${t('Alle', 'All')}</option>
                      ${options.map((v) => /* HTML */ `<option value="${esc(v)}">${esc(id === 'color' && lang !== 'en' ? { white: 'Weiß', black: 'Schwarz', orange: 'Orange', green: 'Grün', grey: 'Grau / Equilibra', purple: 'Lila', red: 'Rot', brown: 'Braun', blue: 'Blau' }[v] || v : v)}</option>`).join('')}
                    </select></label
                  >`,
              )
              .join('')}
          </div>
        </details>
      </section>
      <section
        class="deck-list"
        id="meta-results"
        aria-label="${t('Öffentliche Decks', 'Public decks')}"
      ></section>
    </div>`;
    const mobile = matchMedia('(max-width:760px)'),
      filterPanel = root.querySelector('.meta-filters');
    const updateFilters = () => {
      if (!filterPanel.isConnected) {
        mobile.removeEventListener('change', updateFilters);
        return;
      }
      filterPanel.open = !mobile.matches;
    };
    mobile.addEventListener('change', updateFilters);

    const render = () => {
      const q = root.querySelector('#meta-search').value.toLocaleLowerCase(),
        v = (id) => root.querySelector('#meta-' + id).value;
      const filtered = decks
        .filter(
          (d) =>
            [d.name, d.description, d.summary, ...d.entries.map((e) => card(e)?.name || '')]
              .join(' ')
              .toLocaleLowerCase()
              .includes(q) &&
            (!v('leader') || leaders(d, 'sovereign').some((c) => c.name === v('leader'))) &&
            (!v('rune') || leaders(d, 'rune').some((c) => c.name === v('rune'))) &&
            (!v('color') ||
              leaders(d, 'sovereign').some((c) => (c.text?.colors || []).includes(v('color')))),
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      root.querySelector('#meta-results').innerHTML =
        filtered
          .map(
            (d) =>
              /* HTML */ `<article class="deck-glass meta-deck">
                <a href="#/${lang}/decks/${encodeURIComponent(d.id)}"
                  ><div class="deck-list-leaders">
                    ${['sovereign', 'rune']
                      .flatMap((z) => leaders(d, z))
                      .map((c) => `<img src="${esc(c.image)}" alt="${esc(c.name)}" loading="lazy">`)
                      .join('')}
                  </div>
                  <div class="meta-deck-info">
                    <strong>${esc(d.name)}</strong>
                    <p>${esc(d.summary || d.description || '')}</p>
                  </div></a
                >
              </article>`,
          )
          .join('') || /* HTML */ `<p>${t('Keine Decks gefunden.', 'No decks found.')}</p>`;
    };
    root.querySelectorAll('input,select').forEach((el) => el.addEventListener('input', render));
    render();
  } catch (e) {
    root.textContent = 'Meta: ' + e.message;
  }
}
