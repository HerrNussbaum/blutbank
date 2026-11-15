import { overviewIcon } from './ui-icons.mjs';
import { downloadName } from './download-name.mjs';
import { presentationSections } from './deck-presentation.mjs';
import { previewCardFace } from './card-face-provider.mjs';
import { bindImagePreview } from './image-hover-preview.mjs';
import { exportTournament } from './deck-tournament.mjs';

import { createDeckSync } from './deck-sync.mjs';
import { CardSearch } from './card-search.mjs';
import {
  indexCards,
  newDeck,
  validateDeck,
  addCard,
  importText,
  deckText,
  deckStats,
  accountDeckStore,
  cacheAccountDeck,
  zones,
  zoneLabels,
} from './deck-model.mjs';
import { mountPresentation, escapeHTML as esc } from './deck-presentation.mjs';
import { setProxyDeck } from './proxy-printer.mjs';
import { costHTML } from './card-symbols.mjs';
import { costStatistics, sovereignProfile, aspCost } from './deck-costs.mjs';
const download = (name, data, type) => {
  const u = URL.createObjectURL(new Blob([data], { type })),
    a = document.createElement('a');
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 60000);
};
let accountUser = null,
  syncStatus = new Map(),
  activeStatus = () => {};
const sync = createDeckSync({
  loadDeck: (id) => store?.read().find((d) => d.id === id),
  saveDeck: async (deck, owner) => (await import('./deck-online.mjs')).saveOnline(deck, owner),
  onStatus: (id, state) => {
    syncStatus.set(id, state);
    activeStatus(id);
  },
});
globalThis.window?.addEventListener('blutbank-session', (e) => {
  accountUser = e.detail.user || null;
  store = accountUser ? accountDeckStore(accountUser.id) : null;
  sync.setUser(accountUser);
  if (!accountUser) syncStatus.clear();
  activeStatus();
});
let mountSequence = 0,
  index,
  store = null,
  trash = false,
  undo = [],
  lastId,
  search = '',
  zone = 'auto',
  filters = {},
  filterMenuOpen = false;

export async function mountDeckBuilder(root, cards, lang, id) {
  const t = (de, en) => (lang === 'en' ? en : de),
    zname = (z) => zoneLabels[z][lang === 'en' ? 1 : 0],
    route = (id, edit = false) => `#/${lang}/decks${id ? '/' + id : ''}${edit ? '?mode=edit' : ''}`,
    $ = (s) => root.querySelector(s);
  activeStatus = () => {};
  let visibleIds = null;
  let ownerId = null;
  const sequence = ++mountSequence;
  const active = () => sequence === mountSequence && location.hash.split('?')[0] === route(id);
  const canEdit = () => !!ownerId && accountUser?.id === ownerId;
  let editing = new URLSearchParams(location.hash.split('?')[1] || '').get('mode') === 'edit';
  if (lastId !== id) {
    undo = [];
    search = '';
    filters = {};
    filterMenuOpen = false;
    lastId = id;
  }
  root.innerHTML = /* HTML */ `<p>${t('Decks werden geladen …', 'Loading decks …')}</p>`;
  try {
    const online = await import('./deck-online.mjs'),
      session = await online.api('session');
    if (!active()) return;
    ownerId = session.user?.id || null;
    if (!id && !ownerId) {
      activeStatus = () => {};
      online.deckSignIn(root, lang);
      return;
    }
    if (!index) {
      const response = await fetch('data/card-identities.json');
      if (!response.ok) throw Error('Card identities unavailable');
      index = indexCards(cards, await response.json());
    }
    if (!active()) return;
    if (id) {
      const remote = await online.api('read-deck?id=' + encodeURIComponent(id));
      if (!active()) return;
      history.replaceState(history.state, '', route(id));
      if (!remote.owned) {
        activeStatus = () => {};
        await online.mountPublicDeck(root, cards, lang, remote.deck, session, active);
        return;
      }
      if (!ownerId) throw Error(t('Bitte anmelden.', 'Please sign in.'));
      store = accountDeckStore(ownerId);
      const cached = cacheAccountDeck(store, remote, index);
      if (!cached.pendingSave) syncStatus.set(id, { status: 'saved' });
    } else {
      const response = await online.api('list');
      if (!active()) return;
      store = accountDeckStore(ownerId);
      const ids = new Set(response.decks.map((r) => r.deck.id));
      for (const remote of response.decks) cacheAccountDeck(store, remote, index);
      // Keep obsolete cached data for recovery, but never show it as an offline deck.
      visibleIds = ids;
    }
    if (!active() || !canEdit()) return;
    render();
    if (id && current()?.pendingSave) sync.schedule(id);
  } catch (e) {
    if (active())
      root.innerHTML = /* HTML */ `<h1>${t('Deck nicht verfügbar', 'Deck unavailable')}</h1>
        <p>${esc(e.message)}</p>
        <a class="pill" href="#/${lang}/account">${t('Anmelden / Konto', 'Sign in / account')}</a>`;
  }

  function message(s) {
    const el = $('#deck-message');
    if (el) el.textContent = s;
  }

  function showSync(changedId) {
    if (changedId && changedId !== id) return;
    const el = $('#deck-save-status');
    if (!el) return;
    const state = syncStatus.get(id);
    el.dataset.state = state?.status || 'local';
    el.hidden = el.dataset.state === 'saved' || (editing && el.dataset.state !== 'error');
    el.textContent =
      state?.status === 'error'
        ? t('Online nicht gespeichert · Menü öffnen', 'Not saved online · open menu')
        : ['pending', 'saving'].includes(state?.status)
          ? t('Wird im Konto gespeichert …', 'Saving to account …')
          : state?.status === 'saved'
            ? t('Im Konto gespeichert', 'Saved to account')
            : t('Wird im Konto gespeichert …', 'Saving to account …');
    if (editing && state?.status !== 'error') el.textContent = '';
    el.title = state?.error || '';
    if (state?.status === 'error') message(state.error);
    else if (['pending', 'saving', 'saved'].includes(state?.status)) message('');
  }
  activeStatus = showSync;

  function current() {
    return canEdit() ? store?.read().find((d) => d.id === id) : null;
  }

  function save(d, remember = true) {
    try {
      if (!canEdit()) throw Error(t('Bitte zuerst anmelden.', 'Please sign in first.'));
      if (navigator.onLine === false)
        throw Error(
          t(
            'Keine Verbindung. Bitte erneut versuchen, sobald du online bist.',
            'No connection. Please try again when online.',
          ),
        );
      const latest = current();
      if (latest?.remoteRevision != null) d.remoteRevision = latest.remoteRevision;
      if (d.coverPrintingId && !d.entries.some((e) => e.printingId === d.coverPrintingId))
        d.coverPrintingId = '';
      validateDeck(d, index);
      if (remember) {
        undo.push(structuredClone(current()));
        if (undo.length > 40) undo.shift();
      }
      d.pendingSave = true;
      store.save(d, index);
      render();
      sync.schedule(d.id);
      return true;
    } catch (e) {
      message(t('Speichern fehlgeschlagen: ', 'Save failed: ') + e.message);
      return false;
    }
  }

  function button(label, action) {
    return /* HTML */ `<button class="pill" data-action="${action}">${label}</button>`;
  }

  function render() {
    const deck = current();
    root.innerHTML = /* HTML */ `<div class="deck-heading">
        <h1 class="${deck ? '' : 'visually-hidden'}">
          ${deck ? esc(deck.name) : t('Decks', 'Decks')}
        </h1>
        <div class="deck-heading-actions"></div>
      </div>
      <p id="deck-message" role="status" aria-live="polite"></p>`;
    if (id && !deck) {
      root.innerHTML += /* HTML */ `<p>${t('Deck nicht gefunden.', 'Deck not found.')}</p>
        <a href="${route('')}">${t('Decks', 'Decks')}</a>`;
      return;
    }
    if (!deck) {
      renderList();
      return;
    }
    if (deck.trashed) {
      root.innerHTML += /* HTML */ `<p>
          ${t('Dieses Deck liegt im Papierkorb.', 'This deck is in the trash.')}
        </p>
        ${button(t('Wiederherstellen', 'Restore'), 'restore')}`;
      bind({ restore: () => save({ ...deck, trashed: false }) });
      return;
    }
    root.innerHTML += /* HTML */ `<div class="deck-toolbar deck-detail-toolbar">
      <a
        class="deck-back deck-detail-action"
        href="${route('')}"
        aria-label="${t('Zur Deckübersicht', 'Back to decks')}"
        title="${t('Zur Deckübersicht', 'Back to decks')}"
        >${overviewIcon('back')}</a
      >${deckAction(editing ? t('Fertig', 'Done') : t('Bearbeiten', 'Edit'), 'mode', editing ? 'done' : 'edit', false)}${editing && undo.length ? deckAction(t('Rückgängig', 'Undo'), 'undo', 'restore') : ''}
      <span id="deck-save-status" role="status"></span>
      <div class="deck-more">
        <div class="menu-items">
          ${deckAction(t('Deckinfos bearbeiten', 'Edit deck details'), 'rename', 'info')}${deckAction(t('Kopie erstellen', 'Make a copy'), 'copy', 'copy')}${deckAction(t('Exportieren', 'Export'), 'export', 'download', true)}${deckAction(t('Proxies erstellen', 'Create proxies'), 'proxy', 'print')}${deckAction(t('In den Papierkorb', 'Move to trash'), 'trash', 'trash')}
        </div>
      </div>
    </div>`;
    if (editing) {
      root
        .querySelectorAll(
          '.deck-detail-toolbar [data-action=copy],.deck-detail-toolbar [data-action=export],.deck-detail-toolbar [data-action=proxy]',
        )
        .forEach((button) => button.remove());
      editor(deck);
    } else {
      root.innerHTML += '<div id="deck-presentation"></div>';
      mountPresentation($('#deck-presentation'), deck, index, lang);
    }
    arrangeDeck();
    showSync();
    bind({
      mode: async () => {
        try {
          const online = await import('./deck-online.mjs');
          await online.api('session');
          if (!canEdit() || !active()) return;
          editing = !editing;
          history.replaceState(null, '', route(id));
          render();
          window.scrollTo(0, 0);
        } catch (e) {
          message(e.message);
        }
      },
      rename: () => renameDeck(deck),
      undo: () => {
        const previous = undo.pop();
        if (previous?.id === id) save(previous, false);
        else message(t('Keine Änderung zum Rückgängigmachen.', 'Nothing to undo.'));
      },
      copy: () => copy(deck),
      export: () => exportDialog(deck),
      proxy: () => {
        setProxyDeck(
          deck.entries
            .filter((e) => e.zone !== 'maybe')
            .map((e) => ({ id: e.printingId, quantity: e.quantity })),
          cards,
          deck.name,
        );
        location.hash = `#/${lang}/proxy`;
      },
      trash: () => {
        if (save({ ...deck, trashed: true })) location.hash = route('');
      },
      import: () => {
        const parsed = importText($('#deck-import').value, index);
        if (parsed.errors.length) {
          message(
            t(
              'Nicht importiert. Unbekannte/ungültige Zeilen: ',
              'Not imported. Unknown/invalid lines: ',
            ) + parsed.errors.map((e) => `${e.line}: ${e.name}`).join('; '),
          );
          return;
        }
        save(merge({ ...deck, entries: [...deck.entries, ...parsed.entries] }));
      },
      cloud: () => online(deck),
    });
  }

  async function online(deck) {
    try {
      if (!canEdit()) throw Error(t('Bitte zuerst anmelden.', 'Please sign in first.'));
      await sync.flush(deck.id);
      deck = current();
      if (!deck) return;
      const online = await import('./deck-online.mjs');
      await online.saveOnline(deck, ownerId);
      syncStatus.set(deck.id, { status: 'saved' });
      showSync();
      message('');
    } catch (e) {
      message(e.message);
    }
  }

  function arrangeDeck() {
    const shell = document.createElement('div');
    shell.className = 'deck-shell deck-refined';
    const toolbar = $('.deck-toolbar'),
      main = $('.deck-edit-workspace') || $('#deck-presentation'),
      heading = $('.deck-heading');
    heading.classList.add('deck-heading-refined');
    // Im Editor genügt Fertig als Abschluss; die Leseansicht behält den Rücklink.
    const back = $('.deck-back');
    back.remove();
    const account = $('.deck-heading-actions a');
    if (account) $('.deck-more .menu-items').append(account);
    const actions = $('.deck-heading-actions');
    actions.append(toolbar);
    toolbar.classList.add('deck-toolbar-refined');
    const settings =
      toolbar.querySelector('.deck-editor-display') || main.querySelector('.deck-view-settings');
    const info = toolbar.querySelector('[data-action=rename]');
    if (settings && info) {
      settings.classList.add('deck-settings-menu');
      settings
        .querySelector('summary')
        .setAttribute('aria-label', t('Gruppieren und Sortieren', 'Group and sort'));
      settings.querySelector('summary').title = t('Gruppieren und Sortieren', 'Group and sort');
      info.after(settings);
    }
    if (editing) {
      const importer = $('.deck-import');
      if (importer) {
        importer.classList.add('deck-toolbar-import');
        settings.after(importer);
      }
    }

    const status = $('#deck-save-status'),
      mode = toolbar.querySelector('[data-action=mode]'),
      modeControl = document.createElement('div');
    modeControl.className = 'deck-mode-control';
    mode.before(modeControl);
    modeControl.append(mode, status);
    // Die Leseansicht hat ihren eigenen linken Infobereich und einen Aktionsslot rechts.
    // Vorhandene Buttons werden verschoben statt dupliziert; ihre data-action-Bindung bleibt.
    if (!editing && main.id === 'deck-presentation') {
      main.querySelector('.deck-profile-heading h1')?.remove();
      const viewSwitch = main.querySelector('.deck-view-switch');
      if (viewSwitch) toolbar.prepend(viewSwitch);
      main.querySelector('.deck-reading-toolbar')?.remove();
      // Speicherzustand gehört in den Infobereich links; Darstellung bleibt am Ansichtswechsel.
      main.querySelector('.deck-profile-heading').append(status);
      modeControl.classList.add('deck-mode-control-reading');
      main.querySelector('.deck-profile').append($('#deck-message'));
      root.append(main);
      return;
    }
    const controls = $('.deck-view-controls');
    if (controls) {
      const display = document.createElement('details');
      display.className = 'deck-display-options';
      display.innerHTML = `<summary>${t('Darstellung anpassen', 'Display options')}</summary>`;
      display.append(controls);
      actions.append(display);
    }
    shell.append(main);
    root.append(shell);
    const workspace = $('.deck-edit-workspace');
    if (workspace) workspace.prepend($('.deck-cards'));
  }

  function editor(deck) {
    bindImagePreview(root);
    const stats = deckStats(deck, index);
    root.innerHTML += /* HTML */ `<div class="deck-edit-workspace">
      <section class="deck-search">
        <input
          type="search"
          id="deck-search"
          aria-label="${t('Karten durchsuchen', 'Search cards')}"
          value="${esc(search)}"
        />
        <details class="deck-filter-menu" ${filterMenuOpen ? 'open' : ''}>
          <summary>${overviewIcon('filter')}<span>${t('Filter', 'Filter')}</span></summary>
          <div class="deck-search-filters">
            ${filterSelect('color', t('Farbe', 'Color'), [...new Set(cards.flatMap((c) => c.text?.colors || []))].sort())}${filterSelect('type', t('Typ', 'Type'), [...new Set(cards.flatMap((c) => c.text?.types || []))].sort())}${filterSelect('rarity', t('Seltenheit', 'Rarity'), ['K', 'N', 'L', 'F'])}<label
              >${t('ASP maximal', 'Maximum ASP')}<input
                type="number"
                min="0"
                max="99"
                data-search-filter="aspMax"
                value="${esc(filters.aspMax || '')}" /></label
            ><label
              >${t('Kartentext', 'Rules text')}<input
                type="search"
                data-search-filter="text"
                value="${esc(filters.text || '')}" /></label
            >${filterSelect('set', t('Edition', 'Set'), [...new Set(cards.map((c) => c.set))])}
          </div>
          <p class="muted">
            ${t('In der Suche sind Kombinationen wie Flying asp<=3 oder "draw a card" möglich.', 'Search supports combinations such as Flying asp<=3 or "draw a card".')}
          </p>
        </details>
        <label
          >${t('Hinzufügen zu', 'Add to')}<select id="deck-zone">
            <option value="auto">
              ${t('Automatisch (Herrscher / Rune / Spell)', 'Automatic (Sovereign / Rune / Spell)')}
            </option>
            ${zones.map((z) => /* HTML */ `<option value="${z}" ${zone === z ? 'selected' : ''}>${zname(z)}</option>`).join('')}
          </select></label
        >
        <div id="deck-results"></div>
      </section>
      <section class="deck-cards">
        ${deck.entries.length ? renderZone(deck, 'leaders') + ['pool', 'spell', 'maybe'].map((z) => renderZone(deck, z)).join('') : /* HTML */ `<p class="deck-empty-hint">${t('Dein Deck ist noch leer. Suche eine Karte und füge sie mit + hinzu.', 'Your deck is empty. Find a card and add it with +.')}</p>`}
        <details class="deck-import">
          <summary>${overviewIcon('import')}<span>${t('Importieren', 'Import')}</span></summary>
          <p>
            ${t('Eine Karte pro Zeile, z. B. 3x Oracle. Wird zum Deck hinzugefügt. Pool-Zuordnung anschließend prüfen.', 'One card per line, e.g. 3x Oracle. Adds to the deck. Check pool assignments afterwards.')}
          </p>
          <textarea
            id="deck-import"
            rows="5"
            aria-label="${t('Kartenliste importieren', 'Import card list')}"
          ></textarea
          >${button(t('Liste hinzufügen', 'Add list'), 'import')}
        </details>
      </section>
    </div>`;
    const sorting = document.createElement('label');
    sorting.textContent = 'Sortierung';
    const select = document.createElement('select');
    select.innerHTML =
      '<option value="name">Name</option><option value="asp">ASP</option><option value="quantity">Anzahl</option>';
    select.value = sessionStorage.getItem('deck-editor-sort') || 'name';
    sorting.append(select);
    $('.deck-cards').prepend(sorting);
    select.onchange = () => {
      sessionStorage.setItem('deck-editor-sort', select.value);
      render();
    };
    const grouping = document.createElement('label');
    grouping.textContent = t('Gruppierung', 'Group by');
    const groupSelect = document.createElement('select');
    groupSelect.innerHTML = [
      ['type', t('Kartentyp', 'Card type')],
      ['rarity', t('Seltenheit', 'Rarity')],
      ['color', t('Farbe', 'Color')],
      ['none', t('Keine', 'None')],
    ]
      .map(([value, label]) => /* HTML */ `<option value="${value}">${label}</option>`)
      .join('');
    groupSelect.value = sessionStorage.getItem('deck-editor-group') || 'type';
    grouping.append(groupSelect);
    sorting.before(grouping);
    groupSelect.onchange = () => {
      sessionStorage.setItem('deck-editor-group', groupSelect.value);
      render();
    };
    const adjustedLabel = document.createElement('label');
    adjustedLabel.className = 'cost-toggle';
    const adjustedInput = document.createElement('input');
    adjustedInput.type = 'checkbox';
    adjustedInput.checked = sessionStorage.getItem('deck-editor-adjusted') === 'true';
    adjustedLabel.append(adjustedInput, document.createTextNode(t('Aufschläge', 'Surcharges')));
    sorting.after(adjustedLabel);
    adjustedInput.onchange = () => {
      sessionStorage.setItem('deck-editor-adjusted', String(adjustedInput.checked));
      render();
    };
    // Das Ziel bleibt immer sichtbar direkt unter der Suche, unabhängig von den Suchfiltern.

    const editorOptions = document.createElement('div');
    editorOptions.className = 'deck-editor-search-options';
    editorOptions.setAttribute('aria-label', t('Deckdarstellung', 'Deck display'));
    editorOptions.append(grouping, sorting, adjustedLabel);
    const displayOptions = document.createElement('details');
    displayOptions.className = 'deck-display-options deck-editor-display action-menu';
    displayOptions.innerHTML = `<summary aria-label="${t('Gruppieren & Sortieren', 'Group & sort')}" title="${t('Gruppieren & Sortieren', 'Group & sort')}">${overviewIcon('filter')}</summary>`;
    displayOptions.append(editorOptions);
    $('.deck-detail-toolbar').append(displayOptions);
    const searchRow = document.createElement('div');
    searchRow.className = 'deck-editor-search-row';
    const searchInput = $('#deck-search'),
      filterMenu = $('.deck-filter-menu');
    searchInput.before(searchRow);
    searchRow.append(searchInput, filterMenu);
    searchRow.after($('.deck-search > label'));
    $('.deck-filter-menu').ontoggle = (e) => (filterMenuOpen = e.currentTarget.open);
    $('#deck-zone').onchange = (e) => (zone = e.target.value);
    $('#deck-search').oninput = (e) => {
      search = e.target.value;
      results();
    };
    root.querySelectorAll('[data-search-filter]').forEach(
      (el) =>
        (el.oninput = () => {
          filters[el.dataset.searchFilter] = el.value;
          results();
        }),
    );
    results();
    root.querySelectorAll('[data-quantity]').forEach(
      (el) =>
        (el.onchange = el.onblur =
          () => {
            const i = Number(el.dataset.quantity),
              n = Number(el.value);
            if (current().entries[i]?.quantity !== n) quantity(i, n);
          }),
    );
    root.querySelectorAll('[data-step]').forEach(
      (el) =>
        (el.onclick = () => {
          const i = Number(el.dataset.entry);
          quantity(i, deck.entries[i].quantity + Number(el.dataset.step));
        }),
    );
    root
      .querySelectorAll('[data-entry-options]')
      .forEach((el) => (el.onclick = () => entryOptions(deck, Number(el.dataset.entryOptions))));
    root
      .querySelectorAll('[data-remove]')
      .forEach((el) => (el.onclick = () => quantity(Number(el.dataset.remove), 0)));

    function quantity(i, n) {
      const d = structuredClone(deck);
      if (n === 0) d.entries.splice(i, 1);
      else d.entries[i].quantity = n;
      save(d);
    }
  }

  function filterSelect(key, label, values) {
    return /* HTML */ `<label
      >${label}<select data-search-filter="${key}">
        <option value="">${t('Alle', 'All')}</option>
        ${values.map((v) => /* HTML */ `<option value="${esc(v)}" ${filters[key] === v ? 'selected' : ''}>${esc(CardSearch.label(v, lang))}</option>`).join('')}
      </select></label
    >`;
  }

  function merge(d) {
    const map = new Map();
    for (const e of d.entries) {
      const k = e.printingId + ':' + e.zone;
      if (map.has(k)) map.get(k).quantity += e.quantity;
      else map.set(k, { ...e });
    }
    return { ...d, entries: [...map.values()] };
  }

  function renderZone(deck, z) {
    const section = presentationSections(deck, index, {
      lang,
      group: sessionStorage.getItem('deck-editor-group') || 'type',
      sort: sessionStorage.getItem('deck-editor-sort') || 'name',
      text: true,
      profile: sovereignProfile(deck, index),
      adjusted: sessionStorage.getItem('deck-editor-adjusted') === 'true',
    }).find((section) => section.id === z);
    if (!section) return '';
    const entries = section.groups.flatMap((group) =>
      group.items.map((entry, n) => ({
        ...entry,
        i: deck.entries.findIndex(
          (e) => e.printingId === entry.printingId && e.zone === entry.zone,
        ),
        groupHeading: n === 0 ? group.name : '',
        groupQuantity: group.quantity,
      })),
    );
    return /* HTML */ `<section class="deck-section">
      <h3>
        ${z === 'leaders' ? t('Herrscher & Rune', 'Sovereign & Rune') : zname(z)}
        <span>${entries.reduce((n, e) => n + e.quantity, 0)}</span>
      </h3>
      ${
        entries
          .map((e) => {
            const g = index.find((g) => g.id === e.cardId),
              c = g.variants.find((c) => c.id === e.printingId),
              count = deck.entries
                .filter((x) => x.cardId === g.id && x.zone !== 'maybe')
                .reduce((n, x) => n + x.quantity, 0),
              limit = { K: 4, N: 3, L: 2, F: 1 }[c.text?.rarity];
            const cost = aspCost(
              c,
              sovereignProfile(deck, index),
              sessionStorage.getItem('deck-editor-adjusted') === 'true',
            );
            return /* HTML */ `${e.groupHeading ? /* HTML */ `<h4 class="deck-editor-group-heading">${esc(e.groupHeading)} <span>${e.groupQuantity}</span></h4>` : ''}
              <article class="deck-entry ">
                <div class="deck-entry-main">
                  <div class="quantity-control">
                    <button data-entry="${e.i}" data-step="-1" aria-label="${esc(g.name)} −">
                      −</button
                    ><input
                      type="number"
                      min="0"
                      max="300"
                      value="${e.quantity}"
                      data-quantity="${e.i}"
                      aria-label="${esc(g.name)} ${t('Anzahl', 'quantity')}"
                    /><button data-entry="${e.i}" data-step="1" aria-label="${esc(g.name)} +">
                      +
                    </button>
                  </div>
                  <a class="deck-card-name" href="#/${lang}/card/${c.id}"
                    >${esc(g.name)}<template>${previewCardFace(c)}</template
                    ><img class="deck-hover" src="${esc(c.image)}" alt="" loading="lazy" /></a
                  >${!['sovereign', 'rune'].includes(e.zone) && !c.text?.types?.includes('Resource') ? /* HTML */ `<span class="deck-editor-asp" title="${t('ASP-Kosten', 'ASP cost')}">${cost.status === 'forbidden' ? '×' : costHTML(cost.value ?? (c.text?.stats?.asp === 'X' ? 'X' : null)) || '?'}</span>` : ''}<button
                    class="pill entry-menu"
                    data-entry-options="${e.i}"
                    aria-label="${esc(g.name)} · ${t('Version & Bereich', 'Printing & zone')}"
                    title="${t('Version & Bereich', 'Printing & zone')}"
                  >
                    ⋯</button
                  ><button
                    class="pill"
                    data-remove="${e.i}"
                    aria-label="${t('Entfernen', 'Remove')} ${esc(g.name)}"
                    title="${t('Entfernen', 'Remove')}"
                  >
                    ${overviewIcon('trash')}
                  </button>
                </div>
              </article>`;
          })
          .join('') || /* HTML */ `<p class="muted">${t('Noch keine Karten', 'No cards yet')}</p>`
      }
    </section>`;
  }

  function entryOptions(deck, i) {
    const entry = deck.entries[i],
      g = index.find((g) => g.id === entry.cardId),
      dialog = document.createElement('dialog');
    dialog.className = 'deck-description-dialog entry-options-dialog';
    dialog.setAttribute('aria-label', g.name);
    dialog.innerHTML = /* HTML */ `<form>
      <h2>${esc(g.name)}</h2>
      <label
        >${t('Bereich', 'Zone')}<select name="zone">
          ${zones.map((z) => /* HTML */ `<option value="${z}" ${z === entry.zone ? 'selected' : ''}>${zname(z)}</option>`).join('')}
        </select></label
      ><label
        >${t('Version', 'Printing')}<select name="printing">
          ${g.variants.map((v, n) => /* HTML */ `<option value="${v.id}" ${v.id === entry.printingId ? 'selected' : ''}>${esc(v.set)} · ${esc(v.code || '')} · ${esc(v.variant || n + 1)}</option>`).join('')}
        </select></label
      >
      <div class="deck-toolbar">
        <button class="pill" type="submit">${t('Übernehmen', 'Apply')}</button
        ><button class="pill" type="button">${t('Abbrechen', 'Cancel')}</button>
      </div>
    </form>`;
    root.append(dialog);
    dialog.querySelector('[type=button]').onclick = () => dialog.close();
    dialog.onclose = () => {
      dialog.remove();
      root.querySelector(`[data-entry-options="${i}"]`)?.focus();
    };
    dialog.querySelector('form').onsubmit = (event) => {
      event.preventDefault();
      const form = event.currentTarget,
        d = structuredClone(deck);
      d.entries[i].zone = form.elements.zone.value;
      d.entries[i].printingId = form.elements.printing.value;
      if (save(merge(d))) dialog.close();
    };
    dialog.showModal();
  }

  function results() {
    if (!search.trim() && !Object.values(filters).some((v) => v !== '')) {
      $('#deck-results').innerHTML = /* HTML */ `<p class="deck-search-hint"></p>`;
      return;
    }
    const activeFilters = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')),
      groups = index
        .map((g) => ({
          ...g,
          match: g.variants.find((c) => CardSearch.matches(c, { q: search, ...activeFilters })),
        }))
        .filter((g) => g.match),
      deck = current();
    $('#deck-results').innerHTML = `${groups
      .slice(0, 60)
      .map((g) => {
        const n = deck.entries.filter((e) => e.cardId === g.id).reduce((n, e) => n + e.quantity, 0);
        return /* HTML */ `<div class="deck-search-result">
          <button class="deck-card-name preview-name" data-preview="${g.match.id}">
            ${esc(g.name)}<template>${previewCardFace(g.match)}</template
            ><img
              class="deck-hover"
              src="${esc(g.match.image)}"
              alt="${esc(g.name)}"
              loading="lazy"
            /></button
          >${n ? `<small>${n}×</small>` : ''}<button
            class="pill"
            data-add="${g.id}"
            data-printing="${g.match.id}"
            aria-label="${esc(g.name)} ${t('hinzufügen', 'add')}"
            title="${t('Hinzufügen', 'Add')}"
          >
            ${overviewIcon('plus')}
          </button>
        </div>`;
      })
      .join(
        '',
      )}${!groups.length ? /* HTML */ `<p class="muted">${t('Keine passenden Karten.', 'No matching cards.')}</p>` : groups.length > 60 ? /* HTML */ `<p class="muted">${t('Suche eingrenzen, um weitere Karten zu finden.', 'Refine your search to find more cards.')}</p>` : ''}`;
    root
      .querySelectorAll('[data-preview]')
      .forEach((b) => (b.onclick = () => b.classList.toggle('show-preview')));
    root.querySelectorAll('[data-add]').forEach(
      (b) =>
        (b.onclick = () => {
          const g = index.find((g) => g.id === b.dataset.add),
            c = g.variants.find((c) => c.id === b.dataset.printing),
            types = c.text?.types || [],
            target =
              zone === 'auto'
                ? types.includes('Sovereign')
                  ? 'sovereign'
                  : types.includes('Rune')
                    ? 'rune'
                    : 'spell'
                : zone;
          const scroll = window.scrollY;
          if (save(addCard(current(), g, c.id, target))) {
            window.scrollTo(0, scroll);
            const next = root.querySelector(`[data-add="${g.id}"]`);
            next?.focus({ preventScroll: true });
          }
        }),
    );
  }

  function renameDeck(deck) {
    const dialog = document.createElement('dialog');
    dialog.className = 'deck-description-dialog';
    dialog.setAttribute('aria-label', t('Deckinfos bearbeiten', 'Edit deck details'));
    dialog.innerHTML = /* HTML */ `<form>
      <h2>${t('Deckinfos bearbeiten', 'Edit deck details')}</h2>
      <label
        >${t('Deckname', 'Deck name')}<input
          name="name"
          maxlength="120"
          required
          value="${esc(deck.name)}" /></label
      ><label
        >${t('Kurzbeschreibung', 'Summary')}<input
          name="summary"
          maxlength="300"
          value="${esc(deck.summary || '')}" /></label
      ><label
        >${t('Beschreibung', 'Description')}<textarea name="description" maxlength="5000" rows="6">
${esc(deck.description || '')}</textarea>
      </label>
      <div class="deck-toolbar">
        <button type="submit" class="pill">${t('Speichern', 'Save')}</button
        ><button type="button" class="pill">${t('Abbrechen', 'Cancel')}</button>
      </div>
    </form>`;
    root.append(dialog);
    dialog.querySelector('[type=button]').onclick = () => dialog.close();
    dialog.onclose = () => {
      dialog.remove();
      root.querySelector('.deck-more > summary')?.focus();
    };
    dialog.querySelector('form').onsubmit = (e) => {
      e.preventDefault();
      const name = e.currentTarget.elements.name.value.trim();
      if (
        name &&
        save({
          ...structuredClone(deck),
          name,
          summary: e.currentTarget.elements.summary.value.trim(),
          description: e.currentTarget.elements.description.value.trim(),
        })
      ) {
        dialog.close();
        root.querySelector('.deck-more > summary')?.focus();
      }
    };
    dialog.showModal();
  }

  function bind(actions) {
    root.querySelectorAll('[data-action]').forEach((b) => (b.onclick = actions[b.dataset.action]));
  }

  async function copy(d) {
    if (!canEdit()) return;
    const clone = {
      ...structuredClone(d),
      id: crypto.randomUUID(),
      name: (t('Kopie von ', 'Copy of ') + d.name).slice(0, 120),
      trashed: false,
      visibility: 'private',
    };
    delete clone.remoteRevision;
    delete clone.pendingSave;
    try {
      const online = await import('./deck-online.mjs');
      await online.saveOnline(clone, ownerId);
      if (!canEdit() || !active()) return;
      undo = [];
      location.hash = route(clone.id);
    } catch (e) {
      message(e.message);
    }
  }

  function exportDialog(deck) {
    const dialog = document.createElement('dialog');
    dialog.className = 'deck-export-dialog';
    dialog.setAttribute('aria-labelledby', 'deck-export-title');
    dialog.innerHTML = /* HTML */ `<form method="dialog">
      <h2 id="deck-export-title">${t('Deck exportieren', 'Export deck')}</h2>
      <label for="deck-export-format">${t('Format', 'Format')}</label
      ><select id="deck-export-format">
        <option value="text">${t('Textliste', 'Text list')}</option>
        <option value="json">JSON</option>
        <option value="tournament">
          ${t('Offizieller Turnierbogen (PDF)', 'Official tournament sheet (PDF)')}
        </option>
        <option value="tournament-octenarius">
          ${t('Octenarius-Turnierbogen (PDF)', 'Octenarius tournament sheet (PDF)')}
        </option>
      </select>
      <div class="export-dialog-actions">
        <button type="button" data-cancel>${t('Abbrechen', 'Cancel')}</button
        ><button type="submit">
          ${overviewIcon('download')}<span>${t('Exportieren', 'Export')}</span>
        </button>
      </div>
    </form>`;
    document.body.append(dialog);
    dialog.addEventListener('close', () => dialog.remove());
    dialog.querySelector('[data-cancel]').onclick = () => dialog.close();
    dialog.querySelector('form').onsubmit = async (e) => {
      e.preventDefault();
      const format = dialog.querySelector('select').value;
      try {
        if (format === 'tournament') await exportTournament(deck, cards);
        else if (format === 'tournament-octenarius')
          await exportTournament(deck, cards, 'octenarius');
        else if (format === 'json')
          download(
            downloadName(deck.name, 'json'),
            JSON.stringify(deck, null, 2),
            'application/json',
          );
        else download(downloadName(deck.name, 'txt'), deckText(deck, index), 'text/plain');
        dialog.close();
      } catch (error) {
        message(error.message);
        dialog.close();
      }
    };
    dialog.showModal();
  }
  function deckAction(label, action, icon, withText = false) {
    return /* HTML */ `<button
      class="pill deck-detail-action ${withText ? 'deck-action-text' : ''}"
      data-action="${action}"
      aria-label="${label}"
      title="${label}"
    >
      ${overviewIcon(icon)}${withText ? /* HTML */ `<span>${label}</span>` : ''}
    </button>`;
  }

  function renderList() {
    const actions = $('.deck-heading-actions');
    actions.querySelector('a')?.remove();
    actions.classList.add('deck-overview-toolbar');
    actions.insertAdjacentHTML(
      'afterbegin',
      trash
        ? /* HTML */ `<button
              class="pill deck-overview-text-action"
              data-action="toggle"
              aria-label="${t('Decks', 'Decks')}"
              title="${t('Decks', 'Decks')}"
            >
              ${overviewIcon('decks')}<span>${t('Decks', 'Decks')}</span></button
            ><button class="pill deck-overview-text-action" data-empty-trash>
              ${overviewIcon('trash')}<span>${t('Papierkorb leeren', 'Empty trash')}</span>
            </button>`
        : /* HTML */ `<button class="pill deck-new-button" data-action="new">
              ${overviewIcon('plus')}<span>${t('Neues Deck', 'New deck')}</span></button
            ><button
              class="pill deck-overview-action"
              data-action="toggle"
              aria-label="${t('Papierkorb', 'Trash')}"
              title="${t('Papierkorb', 'Trash')}"
            >
              ${overviewIcon('trash')}
            </button>`,
    );
    root.insertAdjacentHTML(
      'beforeend',
      /* HTML */ `<div class="deck-list">
        ${
          store
            .read()
            .filter((d) => (!visibleIds || visibleIds.has(d.id)) && !!d.trashed === trash)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .map((d, n) => {
              const leaders = ['sovereign', 'rune'].map((z) =>
                cards.find((c) => c.id === d.entries.find((e) => e.zone === z)?.printingId),
              );
              return /* HTML */ `<article
                class="deck-glass deck-reveal"
                data-deck-row="${esc(d.id)}"
                style="--reveal-index:${Math.min(n, 10)}"
              >
                <a class="deck-list-leaders" href="${route(d.id)}" aria-label="${esc(d.name)}"
                  >${leaders.map((c, i) => (c ? `<img src="${esc(c.image)}" alt="${esc(c.name)}" loading="lazy">` : /* HTML */ `<span class="leader-placeholder" title="${zname(i ? 'rune' : 'sovereign')}">—</span>`)).join('')}</a
                >
                <div class="deck-list-info">
                  <a href="${route(d.id)}"><strong>${esc(d.name)}</strong></a
                  ><small
                    >${deckStats(d, index).total} ${t('Karten', 'cards')} ·
                    ${new Date(d.updatedAt).toLocaleDateString(lang)}</small
                  >
                </div>
                <div class="deck-list-links">
                  ${
                    !trash
                      ? /* HTML */ `<label class="deck-visibility"
                          ><select
                            data-visibility="${esc(d.id)}"
                            aria-label="${esc(d.name)} · ${t('Sichtbarkeit', 'Visibility')}"
                          >
                            <option
                              value="private"
                              ${!['shared', 'public'].includes(d.visibility) ? 'selected' : ''}
                            >
                              ${t('Privat', 'Private')}
                            </option>
                            <option value="shared" ${d.visibility === 'shared' ? 'selected' : ''}>
                              Geteilt
                            </option>
                            <option value="public" ${d.visibility === 'public' ? 'selected' : ''}>
                              ${t('Öffentlich', 'Public')}
                            </option>
                          </select></label
                        >`
                      : ''
                  }${!trash ? /* HTML */ `<a class="pill deck-overview-action" href="${route(d.id, true)}" aria-label="${t('Bearbeiten', 'Edit')}" title="${t('Bearbeiten', 'Edit')}">${overviewIcon('edit')}</a>` : ''}${!trash ? /* HTML */ `<button class="pill deck-overview-action" aria-label="${t('Link kopieren', 'Copy link')}" title="${t('Link kopieren', 'Copy link')}" data-share-link="${esc(d.id)}" ${!['shared', 'public'].includes(d.visibility) ? 'disabled title="Zum Teilen Sichtbarkeit auf Geteilt oder Öffentlich stellen"' : ''}>${overviewIcon('link')}</button>` : ''}<button
                    class="pill deck-overview-action"
                    data-trash-deck="${esc(d.id)}"
                    aria-label="${trash ? t('Wiederherstellen', 'Restore') : t('Deck löschen', 'Delete deck')}"
                    title="${trash ? t('Wiederherstellen', 'Restore') : t('In den Papierkorb', 'Move to trash')}"
                  >
                    ${trash ? overviewIcon('restore') : overviewIcon('trash')}</button
                  >${trash ? /* HTML */ `<button class="pill deck-overview-action" data-delete-deck="${esc(d.id)}" aria-label="${t('Endgültig löschen', 'Delete permanently')}" title="${t('Endgültig löschen', 'Delete permanently')}">${overviewIcon('trash')}</button>` : ''}
                </div>
              </article>`;
            })
            .join('') ||
          /* HTML */ `<p class="empty">
            ${t('Hier sind noch keine Decks.', 'No decks here yet.')}
          </p>`
        }
      </div>`,
    );

    bind({
      new: async () => {
        if (!canEdit()) return;
        const d = newDeck(t('Neues Deck', 'New deck'));
        const trigger = root.querySelector('[data-action=new]');
        trigger.disabled = true;
        try {
          const online = await import('./deck-online.mjs');
          await online.saveOnline(d, ownerId);
          if (!canEdit() || !active()) return;
          undo = [];
          location.hash = route(d.id, true);
        } catch (e) {
          message(e.message);
        } finally {
          if (trigger.isConnected) trigger.disabled = false;
        }
      },
      toggle: () => {
        trash = !trash;
        render();
      },
    });
    async function deleteTrashed(ids) {
      if (!ids.length) return;
      const prompt =
        ids.length === 1
          ? t(
              'Dieses Deck endgültig löschen? Das kann nicht rückgängig gemacht werden.',
              'Permanently delete this deck? This cannot be undone.',
            )
          : t(
              `${ids.length} Decks endgültig löschen? Das kann nicht rückgängig gemacht werden.`,
              `Permanently delete ${ids.length} decks? This cannot be undone.`,
            );
      if (!confirm(prompt)) return;
      const controls = [
        ...root.querySelectorAll('[data-delete-deck],[data-empty-trash],[data-trash-deck]'),
      ];
      controls.forEach((b) => (b.disabled = true));
      try {
        if (!canEdit()) throw Error(t('Bitte erneut anmelden.', 'Please sign in again.'));
        for (const id of ids) {
          await sync.flush(id);
          if (syncStatus.get(id)?.status === 'error') throw Error(syncStatus.get(id).error);
        }
        const decks = store.read().filter((d) => ids.includes(d.id) && d.trashed);
        if (decks.length !== ids.length)
          throw Error(
            t('Decks wurden geändert. Bitte erneut versuchen.', 'Decks changed. Please try again.'),
          );
        const online = await import('./deck-online.mjs');
        await online.api('delete', {
          expectedUser: ownerId,
          decks: decks.map((d) => ({ id: d.id, revision: d.remoteRevision })),
        });
        if (!canEdit() || !active()) return;
        store.storage.setItem(
          store.key,
          JSON.stringify(store.read().filter((d) => !ids.includes(d.id))),
        );
        render();
      } catch (e) {
        message(e.message);
      } finally {
        controls.forEach((b) => (b.disabled = false));
      }
    }
    root
      .querySelectorAll('[data-delete-deck]')
      .forEach((b) => (b.onclick = () => deleteTrashed([b.dataset.deleteDeck])));
    root
      .querySelector('[data-empty-trash]')
      ?.addEventListener('click', () =>
        deleteTrashed(
          [...root.querySelectorAll('[data-delete-deck]')].map((b) => b.dataset.deleteDeck),
        ),
      );
    root.querySelectorAll('[data-trash-deck]').forEach(
      (b) =>
        (b.onclick = () => {
          const deck = store.read().find((d) => d.id === b.dataset.trashDeck);
          const positions = new Map(
            [...root.querySelectorAll('[data-deck-row]')].map((row) => [
              row.dataset.deckRow,
              row.getBoundingClientRect(),
            ]),
          );
          if (!deck || !save({ ...deck, trashed: !trash }, false)) return;
          const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
          root.querySelectorAll('[data-deck-row]').forEach((row) => {
            row.style.animation = 'none';
            const before = positions.get(row.dataset.deckRow),
              after = row.getBoundingClientRect();
            if (!reduce && before && (before.top !== after.top || before.left !== after.left))
              row.animate(
                [
                  {
                    transform: `translate(${before.left - after.left}px,${before.top - after.top}px)`,
                  },
                  { transform: 'translate(0,0)' },
                ],
                { duration: 520, easing: 'cubic-bezier(.4,0,.2,1)' },
              );
          });
        }),
    );
    root.querySelectorAll('[data-share-link]').forEach(
      (b) =>
        (b.onclick = async () => {
          try {
            await navigator.clipboard.writeText(
              new URL(route(b.dataset.shareLink), location.href).href,
            );
            b.title = t('Link kopiert', 'Link copied');
            message(t('Link kopiert', 'Link copied'));
          } catch {
            message('Link konnte nicht kopiert werden.');
          }
        }),
    );
    root.querySelectorAll('[data-visibility]').forEach(
      (select) =>
        (select.onchange = async () => {
          const deckId = select.dataset.visibility,
            requested = select.value,
            previous = store.read().find((d) => d.id === deckId)?.visibility || 'private';
          select.disabled = true;
          try {
            if (!canEdit()) throw Error(t('Bitte erneut anmelden.', 'Please sign in again.'));
            await sync.flush(deckId);
            if (syncStatus.get(deckId)?.status === 'error')
              throw Error(syncStatus.get(deckId).error);
            if (!canEdit()) return;
            const deck = store.read().find((d) => d.id === deckId),
              online = await import('./deck-online.mjs');
            const result = await online.setDeckVisibility(deck, requested, ownerId);
            if (!canEdit() || !active()) return;
            const all = store.read(),
              i = all.findIndex((d) => d.id === deckId);
            all[i] = {
              ...all[i],
              visibility: result.visibility,
              remoteRevision: result.revision,
            };
            store.storage.setItem(store.key, JSON.stringify(all));
            render();
            message(
              requested === 'shared'
                ? 'Geteilt: Jeder mit dem Link kann das Deck ansehen.'
                : requested === 'public'
                  ? t(
                      'Öffentlich: Jeder mit der Deckadresse kann das Deck ansehen.',
                      'Public: anyone with the deck address can view it.',
                    )
                  : t(
                      'Privat: Nur du kannst dieses Deck öffnen. Die Adresse bleibt gleich.',
                      'Private: only you can open this deck. Its address stays the same.',
                    ),
            );
          } catch (e) {
            select.value = previous;
            message(e.message);
          } finally {
            select.disabled = false;
          }
        }),
    );
  }
}
