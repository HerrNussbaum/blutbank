import { editorIcon } from './ui-icons.mjs';
import { cardStyleIssues } from './card-styleguide.mjs';

import { previewCardFace } from './card-face-provider.mjs';
import { cardSurcharges } from './deck-costs.mjs';
import { stripReminders } from './ability-reminders.mjs';
import { api } from './deck-online.mjs';

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

const labels = {
  name: 'Name',
  code: 'Kartennummer',
  notes: 'Hinweise & Errata',
  rulesText: 'Kartentext',
  additionalCostsText: 'Zusatzkosten',
  flavorText: 'Flavourtext',
  typeLine: 'Typzeile',
  types: 'Typen',
  subtypes: 'Untertypen',
  traits: 'Zusätze',
  colors: 'Farben',
  rarity: 'Seltenheit',
  collectorNumber: 'Sammlernummer',
  artist: 'Illustration',
  language: 'Sprache',
  asp: 'ASP',
  level: 'LVL',
  res: 'RES',
  ini: 'INI',
  pow: 'POW',
  hp: 'HP',
  magic: 'MAG',
  lp: 'LP',
  pool: 'Pool',
  binding: 'Binding',
  rise: 'Rise',
};
const cardFields = ['name', 'code', 'notes'],
  textFields = [
    'rulesText',
    'flavorText',
    'typeLine',
    'types',
    'subtypes',
    'traits',
    'colors',
    'rarity',
    'collectorNumber',
    'artist',
    'language',
  ];
const lists = new Set(['types', 'subtypes', 'traits', 'colors']),
  stats = ['asp', 'level', 'res', 'ini', 'pow', 'hp', 'magic', 'lp'],
  mechanics = ['pool', 'binding', 'rise'];

function diff(before, after) {
  const lines = [];
  function walk(a, b, path) {
    for (const key of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
      if (['rawText', 'reviewedFields', 'status', 'method', 'nameFromFilename'].includes(key))
        continue;
      const x = a?.[key],
        y = b?.[key];
      if (x == null && y === '') continue;
      const p = path ? path + '.' + key : key;
      if (
        x &&
        y &&
        typeof x === 'object' &&
        typeof y === 'object' &&
        !Array.isArray(x) &&
        !Array.isArray(y)
      )
        walk(x, y, p);
      else if (JSON.stringify(x) !== JSON.stringify(y))
        lines.push(
          /* HTML */ `<div class="editor-diff-row">
            <dt>${esc(labels[key] || p)}</dt>
            <dd>
              <del>${esc(Array.isArray(x) ? x.join(', ') : x)}</del
              ><ins>${esc(Array.isArray(y) ? y.join(', ') : y)}</ins>
            </dd>
          </div>`,
        );
    }
  }
  walk(before, after, '');
  return lines.length
    ? `<dl class="editor-diff">${lines.join('')}</dl>`
    : '<p>Keine Text- oder Werteänderungen.</p>';
}

function surchargeFields(card) {
  const costs = cardSurcharges(card);
  if (!card.text?.types?.includes('Sovereign')) return '';
  const colors = {
    white: 'Weiß',
    blue: 'Blau',
    green: 'Grün',
    brown: 'Braun',
    purple: 'Lila',
    red: 'Rot',
    orange: 'Orange',
    black: 'Schwarz',
  };
  return /* HTML */ `<fieldset class="editor-surcharges">
    <legend>Zusatzkosten nach Kartenfarbe</legend>
    <div class="editor-numbers">
      ${Object.entries(colors)
        .filter(([color]) => !(card.text.colors || []).includes(color))
        .map(
          ([color, name]) =>
            /* HTML */ `<label
              >${name}<select name="surcharge_${color}">
                <option value="">Unbekannt</option>
                <option value="forbidden" ${costs && costs[color] === null ? 'selected' : ''}>
                  Nicht spielbar
                </option>
                ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => /* HTML */ `<option value="${n}" ${costs?.[color] === n ? 'selected' : ''}>+${n} ASP</option>`).join('')}
              </select></label
            >`,
        )
        .join('')}
    </div>
  </fieldset>`;
}

function field(key, value) {
  if (['rulesText', 'additionalCostsText'].includes(key)) value = stripReminders(value);
  return /* HTML */ `<label
    >${labels[key]}${['notes', 'rulesText', 'additionalCostsText', 'flavorText'].includes(key) ? `<textarea name="${key}" ${key === 'rulesText' ? 'rows="9"' : 'rows="4"'}>${esc(value)}</textarea>` : /* HTML */ `<input name="${key}" value="${esc(Array.isArray(value) ? value.join(', ') : value)}" />`}</label
  >`;
}

export async function mountCardEditor(root, cards, lang, id, onPublished) {
  root.innerHTML = '<p role="status">Berechtigung wird geprüft …</p>';
  let current = null,
    loaded = null,
    dirty = false,
    busy = false,
    session,
    queue = [];
  const alive = () => root.querySelector('#card-editor-root');
  try {
    session = await api('session');
    if (!session.cardPermissions?.access) {
      root.innerHTML = '<p>Keine Redaktionsberechtigung.</p>';
      return;
    }
    const perms = session.cardPermissions;
    root.innerHTML = /* HTML */ `<section id="card-editor-root">
      <p id="editor-message" role="status"></p>
      <section id="editor-picker">
        <div class="editor-toolbar">
          <label
            ><input
              aria-label="Karte suchen"
              id="editor-search"
              type="search"
              placeholder="Name oder Kartennummer" /></label
          ><label
            ><select aria-label="Ansicht" id="editor-filter">
              <option value="all">Alle Karten</option>
              <option value="styleguide">Möglicher Styleguide-Verstoß (veröffentlicht)</option>
              <option value="submitted">Zur Freigabe</option>
              <option value="draft">In Bearbeitung</option>
            </select></label
          >
        </div>
        <div
          id="editor-list"
          hidden
          role="listbox"
          tabindex="0"
          aria-label="Karten auswählen"
        ></div>
      </section>
      <details id="editor-queue">
        <summary>Offene Änderungen</summary>
        <div id="editor-queue-body"></div>
      </details>
      <div class="editor-workspace">
        <div id="editor-card"><p>Karte auswählen.</p></div>
      </div>
    </section>`;
    const message = (t) => {
      if (alive()) root.querySelector('#editor-message').textContent = t;
    };

    const choose = () => {
      const list = root.querySelector('#editor-list'),
        q = root.querySelector('#editor-search').value.toLowerCase(),
        state = root.querySelector('#editor-filter').value;
      const items = cards.filter(
        (c) =>
          (!c.gameplaySourceId || c.id === c.gameplaySourceId) &&
          (!q || `${c.name} ${c.code}`.toLowerCase().includes(q)) &&
          (state === 'all' ||
            (state === 'styleguide' && cardStyleIssues(c).length > 0) ||
            queue.some((d) => d.card_id === c.id && d.state === state)),
      );
      list.innerHTML = items
        .map(
          (c) =>
            /* HTML */ `<button
              type="button"
              role="option"
              aria-selected="${c.id === current}"
              data-pick-card="${esc(c.id)}"
            >
              ${queue.some((d) => d.card_id === c.id) ? '● ' : ''}${esc(c.name)} ·
              ${esc(c.variant || c.set)}
            </button>`,
        )
        .join('');
      if (current && items.some((c) => c.id === current)) list.value = current;
      else list.selectedIndex = -1;
    };

    async function refreshQueue() {
      queue = (await api('card-queue')).drafts;
      if (alive()) {
        choose();
        renderQueue();
      }
    }

    function renderQueue() {
      const host = root.querySelector('#editor-queue-body');
      root.querySelector('#editor-queue').hidden = !queue.length;
      root.querySelector('#editor-queue > summary').textContent =
        `Offene Änderungen (${queue.length})`;
      host.innerHTML = queue.length
        ? /* HTML */ `<p>
              ${queue.length} offene Bearbeitungen. Zum Prüfen eine Karte öffnen. Sammelaktionen
              verwenden die angezeigten Versionen.
            </p>
            <div class="editor-bulk-actions">
              ${perms.approve ? '<button type="button" class="pill" data-bulk="publish">Auswahl veröffentlichen</button><button type="button" class="pill" data-bulk="reject">Auswahl zurückgeben</button>' : ''}${perms.edit ? '<button type="button" class="pill" data-bulk="submit">Auswahl einreichen</button><button type="button" class="pill" data-bulk="withdraw">Auswahl zurückziehen</button>' : ''}
            </div>
            <div class="editor-queue-scroll">
              <table>
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        id="queue-all"
                        aria-label="Alle offenen Änderungen auswählen"
                      />
                    </th>
                    <th>Karte</th>
                    <th>Status</th>
                    <th>Bearbeitungsgrund</th>
                    <th>Bearbeiter</th>
                    <th>Geändert</th>
                  </tr>
                </thead>
                <tbody>
                  ${queue
                    .map(
                      (d) =>
                        /* HTML */ `<tr>
                          <td>
                            <input
                              type="checkbox"
                              data-queue-id="${esc(d.card_id)}"
                              aria-label="${esc(cards.find((c) => c.id === d.card_id)?.name || d.card_id)} auswählen"
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              class="text-button"
                              data-open-draft="${esc(d.card_id)}"
                            >
                              ${esc(cards.find((c) => c.id === d.card_id)?.name || d.card_id)}
                            </button>
                          </td>
                          <td>${d.state === 'submitted' ? 'Zur Freigabe' : 'In Bearbeitung'}</td>
                          <td>${esc(d.source_note)}</td>
                          <td>${esc(d.author)}</td>
                          <td>${new Date(Number(d.updated_at) * 1000).toLocaleString('de-DE')}</td>
                        </tr>`,
                    )
                    .join('')}
                </tbody>
              </table>
            </div>`
        : '<p>Keine offenen Bearbeitungen.</p>';
      host
        .querySelector('#queue-all')
        ?.addEventListener('change', (e) =>
          host.querySelectorAll('[data-queue-id]').forEach((c) => (c.checked = e.target.checked)),
        );
      host
        .querySelectorAll('[data-open-draft]')
        .forEach((b) => (b.onclick = () => run(() => load(b.dataset.openDraft))));
      host.querySelectorAll('[data-bulk]').forEach(
        (b) =>
          (b.onclick = () =>
            run(async () => {
              if (dirty) throw Error('Bitte zuerst die aktuelle Bearbeitung speichern.');
              const action = b.dataset.bulk,
                ids = [...host.querySelectorAll('[data-queue-id]:checked')].map(
                  (c) => c.dataset.queueId,
                ),
                selected = queue.filter((d) => ids.includes(d.card_id));
              if (!selected.length) throw Error('Bitte mindestens eine Bearbeitung auswählen.');
              const required = action === 'submit' ? 'draft' : 'submitted';
              if (selected.some((d) => d.state !== required))
                throw Error(
                  action === 'submit'
                    ? 'Nur Entwürfe können eingereicht werden.'
                    : 'Bitte ausschließlich eingereichte Änderungen auswählen.',
                );
              const note = action === 'reject' ? prompt('Gemeinsamer Grund für die Rückgabe:') : '';
              if (action === 'reject' && !note?.trim()) return;
              if (!confirm(`${selected.length} Bearbeitungen: ${b.textContent}?`)) return;
              let done = 0;
              const failures = [];
              for (const d of selected) {
                try {
                  const result = await api('card-' + action, {
                    id: d.card_id,
                    revision: Number(d.revision),
                    publishedRevision: Number(d.base_revision),
                    ...(note ? { note } : {}),
                  });
                  done++;
                } catch (e) {
                  failures.push(
                    `${cards.find((c) => c.id === d.card_id)?.name || d.card_id}: ${e.message}`,
                  );
                }
              }
              if (action === 'publish' && done) {
                await onPublished();
                cards = (await api('cards')).cards;
              }
              await refreshQueue();
              if (current) await load(current, true);
              message(
                `${done} von ${selected.length} Bearbeitungen erfolgreich. ${failures.join(' · ')}`,
              );
            })),
      );
    }

    async function run(task) {
      if (busy) return;
      busy = true;
      root.inert = true;
      try {
        message('');
        await task();
      } catch (e) {
        message(e.message);
        if (/berechtigung/i.test(e.message)) {
          const s = await api('session');
          if (!s.cardPermissions?.access)
            root.innerHTML = '<p>Die Redaktionsberechtigung ist nicht mehr verfügbar.</p>';
        }
      } finally {
        busy = false;
        root.inert = false;
      }
    }

    function getPatch() {
      const f = root.querySelector('#editor-form');
      if (!f.reportValidity()) throw Error('Bitte die markierten Felder prüfen.');
      const patch = { card: {}, text: { stats: {}, mechanics: {} } };
      for (const k of cardFields) patch.card[k] = f.elements[k].value.trim();
      for (const k of textFields) {
        const v = f.elements[k].value.trim();
        patch.text[k] = lists.has(k)
          ? v
              .split(',')
              .map((x) => x.trim())
              .filter(Boolean)
          : v;
      }
      for (const k of stats)
        patch.text.stats[k] =
          f.elements[k].value === ''
            ? null
            : k === 'asp' && f.elements[k].value.toUpperCase() === 'X'
              ? 'X'
              : Number(f.elements[k].value);
      for (const k of mechanics)
        patch.text.mechanics[k] =
          f.elements[k].value === '' ? null : f.elements[k].value === 'true';
      const base = loaded.draft?.body || loaded.card;
      const costInputs = [...f.querySelectorAll('[name^=surcharge_]')];
      if (patch.text.types.includes('Sovereign') && costInputs.length) {
        patch.text.surcharges = {};
        for (const input of costInputs) {
          if (patch.text.colors.includes(input.name.slice(10))) continue;
          if (input.value === '')
            throw Error('Bitte für jede Fremdfarbe Zusatzkosten oder Nicht spielbar auswählen.');
          patch.text.surcharges[input.name.slice(10)] =
            input.value === 'forbidden' ? null : Number(input.value);
        }
        if (JSON.stringify(patch.text.surcharges) === JSON.stringify(base.text.surcharges))
          delete patch.text.surcharges;
      }
      for (const k of cardFields) if (patch.card[k] === base[k]) delete patch.card[k];
      for (const k of textFields)
        if (
          JSON.stringify(patch.text[k]) === JSON.stringify(base.text[k]) ||
          (patch.text[k] === '' && base.text[k] == null)
        )
          delete patch.text[k];
      for (const group of ['stats', 'mechanics']) {
        for (const k of Object.keys(patch.text[group]))
          if (patch.text[group][k] === (base.text[group]?.[k] ?? null)) delete patch.text[group][k];
        if (!Object.keys(patch.text[group]).length) delete patch.text[group];
      }
      return { patch, sourceNote: f.elements.sourceNote.value.trim() };
    }

    async function save() {
      if (!perms.edit) throw Error('Keine Bearbeitungsberechtigung.');
      const values = getPatch();
      await api('card-save', {
        id: current,
        revision: Number(loaded.draft?.revision || 0),
        ...values,
      });
      dirty = false;
      await load(current, true);
      message('Entwurf gespeichert. Öffentlich bleibt der bisherige Stand.');
    }

    async function load(cardId, force = false) {
      cardId = cards.find((c) => c.id === cardId)?.gameplaySourceId || cardId;
      if (!force && dirty && !confirm('Ungespeicherte Änderungen verwerfen?')) {
        root.querySelector('#editor-list').value = current;
        return;
      }
      const response = await api('card-load?id=' + encodeURIComponent(cardId));
      if (!alive()) return;
      loaded = response;
      current = cardId;
      dirty = false;
      root.querySelector('#editor-list').hidden = true;
      root.querySelector('#editor-search').setAttribute('aria-expanded', 'false');
      const draft = response.draft,
        c = draft?.body || response.card,
        d = c.text,
        editable = perms.edit && draft?.state !== 'submitted',
        body = root.querySelector('#editor-card');
      body.innerHTML = /* HTML */ `<div class="editor-card-heading">
          <h2>${esc(c.name)}</h2>
          <p>
            ${draft ? (draft.state === 'submitted' ? 'Zur Freigabe eingereicht' : 'Entwurf') : 'Veröffentlichter Stand'}
            · Version ${response.publishedRevision}${draft ? ' · Entwurf ' + draft.revision : ''}
          </p>
        </div>
        ${draft && Number(draft.base_revision) !== response.publishedRevision ? '<p class="editor-conflict">Die veröffentlichte Karte wurde seit Beginn dieses Entwurfs geändert. Bitte den Entwurf mit dem aktuellen Stand abgleichen. Prüfe die Unterschiede vor dem Verwerfen.</p>' : ''}
        <div class="editor-compare">
          <div class="editor-reference">
            <a href="${esc(c.original)}" target="_blank" rel="noopener"
              ><img src="${esc(c.original)}" alt="${esc(c.name)}"
            /></a>
            <section class="editor-live-preview" aria-label="Textvorschau">
              <div id="editor-live-face"></div>
            </section>
          </div>
          <form id="editor-form">
            <fieldset ${editable ? '' : 'disabled'}>
              <legend>Kartentext und Eigenschaften</legend>
              ${cardFields.map((k) => field(k, c[k])).join('')}${textFields.map((k) => field(k, d[k] || '')).join('')}${surchargeFields(c)}
              <div class="editor-numbers">
                ${stats.map((k) => /* HTML */ `<label>${labels[k]}<input ${k === 'asp' ? 'type="text" pattern="[0-9]{1,4}|[xX]" maxlength="4"' : 'type="number" min="0" max="1000" step="1"'} name="${k}" value="${esc(d.stats[k])}" /></label>`).join('')}
              </div>
              <div class="editor-mechanics">
                ${mechanics
                  .map(
                    (k) =>
                      /* HTML */ `<label
                        >${labels[k]}<select name="${k}">
                          <option value="">Unbekannt</option>
                          <option value="true" ${d.mechanics[k] === true ? 'selected' : ''}>
                            Vorhanden
                          </option>
                          <option value="false" ${d.mechanics[k] === false ? 'selected' : ''}>
                            Nicht vorhanden
                          </option>
                        </select></label
                      >`,
                  )
                  .join('')}
              </div>
              <label class="editor-reason"
                >Was wurde geändert und warum?<textarea
                  name="sourceNote"
                  required
                  maxlength="2000"
                  rows="2"
                  placeholder="Änderung kurz begründen und Quelle angeben"
                >
${esc(draft?.source_note || '')}</textarea></label
              >${editable ? '<button class="pill" type="submit">' + editorIcon('save') + '<span>Speichern</span></button>' : ''}
            </fieldset>
          </form>
        </div>
        <div class="editor-actions">
          ${draft && perms.edit ? (draft.state === 'draft' ? '<button class="pill" id="editor-submit">' + editorIcon('send') + '<span>Einreichen</span></button><button class="pill" id="editor-discard">' + editorIcon('trash') + '<span>Verwerfen</span></button>' : '<button class="pill" id="editor-withdraw">' + editorIcon('back') + '<span>Zurückziehen</span></button>') : ''}${draft?.state === 'submitted' && perms.approve ? '<button class="pill" id="editor-publish">' + editorIcon('publish') + '<span>Veröffentlichen</span></button><button class="pill" id="editor-reject">' + editorIcon('back') + '<span>Zurückgeben</span></button>' : ''}
        </div>
        <h3>Änderungen gegenüber der veröffentlichten Karte</h3>
        ${draft ? diff(response.card, draft.body) : '<p>Kein offener Entwurf.</p>'}
        <details id="editor-history">
          <summary>Verlauf</summary>
          <div id="editor-history-body"></div>
        </details>`;

      const fieldset = body.querySelector('fieldset'),
        tabs = document.createElement('div');
      tabs.className = 'editor-field-tabs';
      tabs.setAttribute('role', 'tablist');
      tabs.setAttribute('aria-label', 'Kartenfelder');
      const panels = {};
      for (const [key, label] of [
        ['text', 'Kartentext'],
        ['info', 'Werte & Typ'],
        ['meta', 'Druck & Quelle'],
      ]) {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.setAttribute('role', 'tab');
        tab.textContent = label;
        tab.dataset.panel = key;
        tab.id = 'editor-tab-' + key;
        tab.setAttribute('aria-controls', 'editor-panel-' + key);
        tabs.append(tab);
        const panel = document.createElement('div');
        panel.className = 'editor-field-panel editor-panel-' + key;
        panel.dataset.panel = key;
        panel.id = 'editor-panel-' + key;
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', tab.id);
        panels[key] = panel;
        tab.onclick = () => {
          for (const b of tabs.children) {
            b.setAttribute('aria-selected', String(b === tab));
            b.tabIndex = b === tab ? 0 : -1;
          }
          for (const [k, p] of Object.entries(panels)) p.hidden = k !== key;
        };
      }
      tabs.onkeydown = (e) => {
        const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
        if (!keys.includes(e.key)) return;
        e.preventDefault();
        const buttons = [...tabs.children],
          i = buttons.indexOf(document.activeElement),
          next =
            e.key === 'Home'
              ? 0
              : e.key === 'End'
                ? buttons.length - 1
                : (i + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next].click();
        buttons[next].focus();
      };
      fieldset.before(tabs);
      for (const label of [...fieldset.children].filter((el) => el.tagName === 'LABEL')) {
        const name = label.querySelector('[name]')?.name;
        if (['name', 'rulesText', 'additionalCostsText', 'flavorText'].includes(name))
          panels.text.append(label);
        else if (['code', 'notes', 'collectorNumber', 'artist', 'language'].includes(name))
          panels.meta.append(label);
        else if (['typeLine', 'types', 'subtypes', 'traits', 'colors', 'rarity'].includes(name))
          panels.info.append(label);
      }
      panels.info.append(
        fieldset.querySelector(':scope > .editor-numbers'),
        body.querySelector('.editor-mechanics'),
      );
      if (body.querySelector('.editor-surcharges'))
        panels.info.append(body.querySelector('.editor-surcharges'));
      const host = document.createElement('div');
      host.className = 'editor-field-panels';
      host.append(...Object.values(panels));
      fieldset.prepend(host);
      tabs.firstElementChild.click();
      const extra = document.createElement('details');
      extra.className = 'editor-extra-text';
      extra.innerHTML = '<summary>Flavourtext</summary>';
      const flavor = panels.text.querySelector('[name=flavorText]')?.closest('label');
      if (flavor) {
        extra.append(flavor);
        panels.text.append(extra);
      }
      const review = document.createElement('details');
      review.className = 'editor-review';
      review.innerHTML = '<summary>Änderungen prüfen</summary>';
      let item = body.querySelector('.editor-actions')?.nextElementSibling;
      if (item) {
        item.before(review);
        while (item && item.id !== 'editor-history') {
          const next = item.nextElementSibling;
          review.append(item);
          item = next;
        }
      }
      if (draft?.state === 'submitted') review.open = true;

      function updatePreview() {
        const form = body.querySelector('#editor-form'),
          preview = structuredClone(c);
        preview.name = form.elements.name.value;
        preview.text.rulesText = form.elements.rulesText.value;
        preview.text.typeLine = form.elements.typeLine.value;
        for (const key of stats)
          preview.text.stats[key] =
            form.elements[key].value === ''
              ? null
              : key === 'asp' && form.elements[key].value.toUpperCase() === 'X'
                ? 'X'
                : Number(form.elements[key].value);
        const host = body.querySelector('#editor-live-face');
        if (host) host.innerHTML = previewCardFace(preview);
      }

      const styleHost = document.createElement('section');
      styleHost.className = 'editor-styleguide';
      styleHost.setAttribute('aria-label', 'Styleguide-Prüfung');
      function updateStyleguide() {
        const form = body.querySelector('#editor-form');
        const candidate = {
          ...c,
          name: form.elements.name.value,
          text: {
            ...c.text,
            rulesText: form.elements.rulesText.value,
            additionalCostsText: form.elements.additionalCostsText?.value || '',
          },
        };
        const issues = cardStyleIssues(candidate);
        styleHost.innerHTML = /* HTML */ `<h3>
            ${issues.length} mögliche Auffälligkeit${issues.length === 1 ? '' : 'en'}
          </h3>
          <p>
            Hinweise zur redaktionellen Prüfung, keine automatische Korrektur. Geprüft wird der
            angezeigte Text einschließlich ungespeicherter Eingaben. Der Auswahlfilter prüft
            veröffentlichte Texte. Reminder und Flavourtext sind ausgenommen. {T} entspricht dem
            gedruckten (T). Regellogik und vollständige Styleguide-Konformität müssen manuell
            geprüft werden.
          </p>
          ${issues.length ? '<ul>' + issues.map((i) => `<li><strong>${esc(labels[i.field])}, Zeile ${i.line}:</strong> ${esc(i.message)}<br><q>${esc(i.excerpt)}</q></li>`).join('') + '</ul>' : '<p>Keine automatisch erkennbaren Auffälligkeiten.</p>'}`;
      }
      const extraPanels = document.createElement('div');
      extraPanels.className = 'editor-extra-panels';
      body.querySelector('#editor-form').after(extraPanels);
      function addPanel(key, label, content) {
        const panel = document.createElement('section');
        panel.className = 'editor-field-panel editor-panel-' + key;
        panel.id = 'editor-panel-' + key;
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', 'editor-tab-' + key);
        panel.hidden = true;
        panel.append(content);
        panels[key] = panel;
        extraPanels.append(panel);
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.id = 'editor-tab-' + key;
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-controls', panel.id);
        tab.setAttribute('aria-selected', 'false');
        tab.tabIndex = -1;
        tab.textContent = label;
        tabs.append(tab);
        tab.onclick = () => {
          for (const b of tabs.children) {
            b.setAttribute('aria-selected', String(b === tab));
            b.tabIndex = b === tab ? 0 : -1;
          }
          for (const [k, p] of Object.entries(panels)) p.hidden = k !== key;
          if (key === 'history') content.open = true;
        };
      }
      addPanel('style', 'Styleguide', styleHost);
      const changes = document.createElement('div');
      while (review.firstChild) {
        const node = review.firstChild;
        if (node.tagName === 'SUMMARY') node.remove();
        else changes.append(node);
      }
      review.remove();
      addPanel('changes', 'Änderungen', changes);
      addPanel('history', 'Verlauf', body.querySelector('#editor-history'));
      const editorTop = document.createElement('div');
      editorTop.className = 'editor-top-controls';
      body.querySelector('.editor-compare').before(editorTop);
      editorTop.append(tabs);
      const actions = body.querySelector('.editor-actions'),
        saveButton = body.querySelector('#editor-form button[type=submit]');
      if (saveButton) {
        saveButton.setAttribute('form', 'editor-form');
        actions.prepend(saveButton);
      }
      editorTop.append(actions);
      const main = document.createElement('div');
      main.className = 'editor-main';
      const form = body.querySelector('#editor-form');
      form.before(main);
      main.append(form, extraPanels);
      const reason = body.querySelector('.editor-reason'),
        reasonField = reason.querySelector('textarea');
      reasonField.setAttribute('form', 'editor-form');
      reasonField.disabled = !editable;
      reasonField.addEventListener('input', () => {
        dirty = true;
      });
      body.querySelector('.editor-compare').append(reason);

      updateStyleguide();
      body.querySelector('#editor-form').addEventListener('input', updateStyleguide);
      updatePreview();
      body.querySelector('#editor-form').addEventListener(
        'invalid',
        (e) => {
          const panel = e.target.closest('[role=tabpanel]');
          if (panel?.hidden) tabs.querySelector(`[aria-controls="${panel.id}"]`)?.click();
        },
        true,
      );
      body.querySelector('#editor-form').onsubmit = (e) => {
        e.preventDefault();
        run(save);
      };
      body.querySelector('#editor-form').oninput = (e) => {
        dirty = true;
        updatePreview();
        if (['types', 'colors'].includes(e.target.name)) {
          const f = body.querySelector('#editor-form');
          const updated = {
            ...c,
            text: {
              ...d,
              types: f.elements.types.value.split(',').map((x) => x.trim()),
              colors: f.elements.colors.value.split(',').map((x) => x.trim()),
            },
          };
          body.querySelector('.editor-surcharges')?.remove();
          panels.info.insertAdjacentHTML('beforeend', surchargeFields(updated));
        }
      };

      const button = (selector, task) => {
        const el = body.querySelector(selector);
        if (el) el.onclick = () => run(task);
      };
      button('#editor-submit', async () => {
        if (dirty) await save();
        await api('card-submit', { id: current, revision: Number(loaded.draft.revision) });
        await load(current, true);
        await refreshQueue();
        message('Zur Freigabe eingereicht.');
      });
      button('#editor-withdraw', async () => {
        await api('card-withdraw', { id: current, revision: Number(loaded.draft.revision) });
        await load(current, true);
        await refreshQueue();
      });
      button('#editor-discard', async () => {
        if (
          !confirm('Diesen Entwurf verwerfen? Die Änderungen bleiben im Verlauf nachvollziehbar.')
        )
          return;
        await api('card-discard', { id: current, revision: Number(loaded.draft.revision) });
        await load(current, true);
        await refreshQueue();
      });
      button('#editor-publish', async () => {
        if (!confirm('Die angezeigten Änderungen jetzt öffentlich veröffentlichen?')) return;
        const result = await api('card-publish', {
          id: current,
          revision: Number(loaded.draft.revision),
          publishedRevision: loaded.publishedRevision,
        });
        await onPublished(result.card);
        cards = (await api('cards')).cards;
        await load(current, true);
        await refreshQueue();
        message('Karte veröffentlicht. Suche und Downloads verwenden denselben Stand.');
      });
      button('#editor-reject', async () => {
        const note = prompt('Was muss überarbeitet werden?');
        if (!note) return;
        await api('card-reject', { id: current, revision: Number(loaded.draft.revision), note });
        await load(current, true);
        await refreshQueue();
        message('Zur Überarbeitung zurückgegeben: ' + note);
      });

      body.querySelector('#editor-history').ontoggle = async (e) => {
        if (!e.target.open) return;
        await run(async () => {
          const { history } = await api('card-history?id=' + encodeURIComponent(current));
          if (!alive() || current !== cardId) return;
          const el = body.querySelector('#editor-history-body');
          el.innerHTML =
            history
              .map(
                (event) =>
                  /* HTML */ `<article>
                    <h4>
                      ${esc(event.action)} · ${esc(event.actor)} ·
                      ${new Date(Number(event.created_at) * 1000).toLocaleString('de-DE')}
                    </h4>
                    <p>${esc(event.note)}</p>
                    ${event.before?.id && event.after?.id ? diff(event.before, event.after) : ''}${perms.approve && ['publish', 'restore'].includes(event.action) ? /* HTML */ `<button class="pill" data-restore="${esc(event.id)}">Stand vor dieser Änderung wiederherstellen</button>` : ''}
                  </article>`,
              )
              .join('') || '<p>Noch keine Änderungen.</p>';
          el.querySelectorAll('[data-restore]').forEach(
            (b) =>
              (b.onclick = () =>
                run(async () => {
                  const note = prompt('Grund für die Wiederherstellung:');
                  if (!note || !confirm('Diesen früheren Stand wieder öffentlich aktivieren?'))
                    return;
                  const result = await api('card-restore', {
                    id: current,
                    revision: Number(loaded.draft?.revision || 0),
                    publishedRevision: loaded.publishedRevision,
                    eventId: b.dataset.restore,
                    note,
                  });
                  await onPublished(result.card);
                  cards = (await api('cards')).cards;
                  await load(current, true);
                  message('Früherer Stand wiederhergestellt.');
                })),
          );
        });
      };
      await refreshQueue();
    }
    const searchInput = root.querySelector('#editor-search'),
      resultList = root.querySelector('#editor-list');
    searchInput.setAttribute('aria-controls', 'editor-list');
    searchInput.setAttribute('aria-expanded', 'false');
    const showResults = () => {
      choose();
      resultList.hidden = false;
      searchInput.setAttribute('aria-expanded', 'true');
    };
    searchInput.oninput = () => {
      choose();
      resultList.hidden = !searchInput.value.trim();
      searchInput.setAttribute('aria-expanded', String(!resultList.hidden));
    };
    searchInput.onfocus = () => {
      if (searchInput.value.trim()) showResults();
    };
    searchInput.onkeydown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        showResults();
        resultList.focus();
      } else if (e.key === 'Escape') {
        resultList.hidden = true;
        searchInput.setAttribute('aria-expanded', 'false');
      }
    };
    root.querySelector('#editor-filter').onchange = showResults;
    root.querySelector('#editor-list').onclick = (e) => {
      const option = e.target.closest('[data-pick-card]');
      if (option) run(() => load(option.dataset.pickCard));
    };
    await refreshQueue();
    if (id) await load(id);
    const guard = new AbortController(),
      entryHash = location.hash;
    document.addEventListener(
      'click',
      (e) => {
        const a = e.target.closest?.('a[href]');
        if (
          dirty &&
          alive() &&
          a &&
          !a.target &&
          a.hash &&
          a.hash !== location.hash &&
          !confirm('Ungespeicherte Änderungen verwerfen?')
        ) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      { capture: true, signal: guard.signal },
    );
    window.addEventListener(
      'hashchange',
      (e) => {
        if (dirty && alive() && !confirm('Ungespeicherte Änderungen verwerfen?')) {
          e.stopImmediatePropagation();
          history.replaceState(null, '', entryHash);
        } else guard.abort();
      },
      { capture: true, signal: guard.signal },
    );
    window.addEventListener(
      'beforeunload',
      (e) => {
        if (dirty && alive()) {
          e.preventDefault();
          e.returnValue = '';
        }
      },
      { once: true },
    );
  } catch (e) {
    root.innerHTML = '<p>' + esc(e.message) + '</p>';
  }
}
