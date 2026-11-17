import { expandCards } from './card-catalog.mjs';
import { htmlParagraphs } from './text-paragraphs.mjs';
import { catalogActionIcon } from './ui-icons.mjs';
import { mountMeta } from './deck-meta.mjs';
import liveAbilityDefinitions from './ability-reminder-definitions.mjs';
import {
  numberOf,
  parentOf,
  subtree,
  chapterOf,
  renderDelta,
  enhanceFormulas,
} from './rulebook.mjs';

import { setCardFaceRenderer } from './card-face-provider.mjs';
import { referencedCards, renderCardLinks, tokenCreators } from './token-references.mjs';
import {
  abilityParts,
  expandedRules,
  stripReminders,
  normalizeCardReminders,
  syncAbilityGlossary,
  syncAbilityAppendix,
} from './ability-reminders.mjs';
import { cardHeading, cardValueRow, cardPropertyRow, colorCrystal } from './card-layout.mjs';
import { bindCardPreview } from './card-hover-preview.mjs';
import {
  symbolText,
  aspText,
  cardFlow,
  symbolHTML,
  costHTML,
  statIcon,
  mechanicHTML,
  reminderParts,
  reminderHTML,
} from './card-symbols.mjs';
import { mountDeckBuilder } from './deck-builder.mjs';
import { mountAccount, mountShared, api } from './deck-online.mjs';
import { CardSearch } from './card-search.mjs';
import { mountProxy } from './proxy-printer.mjs';
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

let accountUser = null;
let dataReady = false,
  homeCompact = false,
  cardEditorAccess = null,
  onlineCardApi = null;

function applyLiveGlossary() {
  syncAbilityGlossary(terms);
  syncAbilityAppendix(de);
}
let liveBookPromise;
let liveBookLoadedAt = 0;
function liveRulebook() {
  if (!liveBookPromise) {
    liveBookPromise = fetch('/cms-rules', { cache: 'default' })
      .then((r) => {
        if (!r.ok) throw Error('Regelwerk nicht verfügbar');
        return r.json();
      })
      .then((book) => {
        liveBookLoadedAt = Date.now();
        return { languages: { de: book.de, en: book.en }, glossary: book.glossary };
      })
      .catch((error) => {
        liveBookPromise = null;
        throw error;
      });
  }
  return liveBookPromise;
}
// Refresh published content after returning from the editor without refetching on chapter clicks.
let returnedRulebookRefresh = null;
function refreshReturnedRulebook() {
  if (!returnedRulebookRefresh && document.visibilityState === 'visible' && dataReady)
    returnedRulebookRefresh = refreshRules()
      .catch(() => {})
      .finally(() => {
        returnedRulebookRefresh = null;
      });
}
document.addEventListener('visibilitychange', refreshReturnedRulebook);
window.addEventListener('focus', refreshReturnedRulebook);

async function loadCards() {
  const configResponse = await fetch('deck-config.json');
  if (configResponse.ok) {
    const config = await configResponse.json();
    if (config.api) {
      const endpoint = new URL(config.api, location.href);
      if (endpoint.origin !== location.origin) throw Error('Invalid API origin');
      onlineCardApi = endpoint.href;
      endpoint.searchParams.set('action', 'cards');
      endpoint.searchParams.set('view', 'catalog');
      const r = await fetch(endpoint, { cache: 'no-store', credentials: 'same-origin' });
      if (!r.ok) throw Error('Kartendaten nicht verfügbar');
      return expandCards((await r.json()).cards);
    }
  }
  return expandCards(await (await fetch('data/cards.json?v=card-editor-1')).json());
}

function renderLanguageSwitcher(view = state.view, id = state.id) {
  const host = document.querySelector('#languages');
  host.dataset.view = view;
  host.dataset.routeId = id;
  // Retain the focused radio when only the language changes.
  if (!host.querySelector('.oct-language-switch')) {
    host.innerHTML =
      '<div class="oct-language-switch" role="group" aria-label="Sprache / Language">' +
      ['de', 'en']
        .map(
          (l) =>
            /* HTML */ `<label
              ><input
                type="radio"
                name="oct-language"
                value="${l}"
                aria-label="${l === 'de' ? 'Deutsch' : 'English'}"
              /><span>${l.toUpperCase()}</span></label
            >`,
        )
        .join('') +
      '</div>';
    for (const radio of host.querySelectorAll('input'))
      radio.addEventListener('change', () => {
        if (radio.checked)
          location.hash = url(host.dataset.view, host.dataset.routeId, radio.value);
      });
  }
  for (const radio of host.querySelectorAll('input')) radio.checked = state.lang === radio.value;
}
function closeHeaderLogin(restoreFocus = false) {
  const panel = document.querySelector('#oct-header-login');
  const button = document.querySelector('#header-account button.oct-account-icon');
  if (!panel || panel.hidden) return;
  panel.hidden = true;
  button?.setAttribute('aria-expanded', 'false');
  if (restoreFocus) button?.focus();
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeHeaderLogin(true);
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('#header-account')) closeHeaderLogin();
});
function renderAccountHeader() {
  let host = document.querySelector('#header-account');
  if (!host) {
    host = document.createElement('div');
    host.id = 'header-account';
    document.querySelector('#languages').after(host);
  }
  const icon =
    '<svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M4.5 21v-2a7.5 7.5 0 0 1 15 0v2"/></svg>';
  host.innerHTML = accountUser
    ? /* HTML */ `<a
        class="oct-account-icon"
        href="${url('account')}"
        aria-label="${t('Konto', 'Account')}"
        title="${t('Konto', 'Account')}"
        >${icon}<span class="oct-account-label">${t('Konto', 'Account')}</span></a
      >`
    : /* HTML */ `<button
          class="oct-account-icon"
          type="button"
          aria-expanded="false"
          aria-controls="oct-header-login"
          aria-label="${t('Einloggen', 'Sign in')}"
          title="${t('Einloggen', 'Sign in')}"
        >
          ${icon}<span class="oct-account-label">${t('Konto', 'Account')}</span>
        </button>
        <div
          id="oct-header-login"
          class="header-login"
          role="region"
          aria-label="${t('Anmelden', 'Sign in')}"
          hidden
        ></div>`;
  const button = host.querySelector('button');
  if (button)
    button.onclick = () => {
      const panel = host.querySelector('.header-login');
      panel.hidden = !panel.hidden;
      button.setAttribute('aria-expanded', String(!panel.hidden));
      if (!panel.hidden) mountAccount(panel, cards, state.lang);
    };
}

async function updateCardEditorAccess() {
  try {
    cardEditorAccess = (await api('session')).cardPermissions || null;
  } catch {
    cardEditorAccess = null;
  }
  if (state.view === 'card') addCardEditorLink();
  if (['rules', 'glossary'].includes(state.view)) addRuleAdminLink();
}

function addCardEditorLink() {
  document.querySelector('#card-editor-link')?.remove();
  if (cardEditorAccess?.access && state.view === 'card') {
    const a = document.createElement('a');
    a.id = 'card-editor-link';
    a.className = 'pill';
    a.href = url('editor', state.id);
    a.title = t('Karte bearbeiten', 'Edit card');
    a.innerHTML = /* HTML */ `${catalogActionIcon('edit')}<span
        >${t('Karte bearbeiten', 'Edit card')}</span
      >`;
    document.querySelector('.card-page-tools')?.append(a);
  }
}

let de = [],
  en = [],
  cards = [],
  terms = [],
  state = {},
  cardFilters = {},
  limit = 48,
  searchTimer,
  cardReturn = null,
  pendingCardReturn = null,
  pendingArchiveRestore = null;
const t = (a, b) => (state.lang === 'en' ? b : a);

const url = (view, id = '', lang = state.lang) => {
  const query = location.hash.split('?')[1] || '';
  const suffix =
    ['cards', 'card'].includes(view) && ['cards', 'card'].includes(state.view) && query
      ? '?' + query
      : view === 'decks' &&
          id &&
          state.view === 'decks' &&
          new URLSearchParams(query).get('mode') === 'edit'
        ? '?mode=edit'
        : '';
  return `#/${lang}/${view}${id ? '/' + encodeURIComponent(id) : ''}${suffix}`;
};
function navigationIcon(section) {
  const paths = {
    meta: '<path d="m3 7 5 4 4-7 4 7 5-4-2 11H5L3 7Zm3 14h12"/>',
    rules: '<path d="M12 7v14m0-14C9 4 5 4 2 5v15c4-1 7-1 10 1 3-2 6-2 10-1V5c-3-1-7-1-10 2Z"/>',
    cards:
      '<g fill="var(--oct-icon-surface,#071e23)"><rect x="6" y="3" width="12" height="18" rx="2" transform="rotate(-24 12 19)"/><rect x="6" y="2" width="12" height="18" rx="2"/><rect x="6" y="3" width="12" height="18" rx="2" transform="rotate(24 12 19)"/></g>',
    decks: '<path d="m12 3 10 5-10 5L2 8 12 3Zm-10 9 10 5 10-5M2 16l10 5 10-5"/>',
    proxy:
      '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/><path d="M18 12h.01"/>',
  };
  return /* HTML */ `<svg
    class="oct-nav-icon"
    viewBox="${section === 'cards' ? '-3 -2 30 27' : '0 0 24 24'}"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    ${paths[section] || ''}
  </svg>`;
}
const labels = () => ({
  cards: t('Karten', 'Cards'),
  rules: t('Regeln', 'Rules'),
  decks: t('Decks', 'Decks'),
  meta: 'Meta',
  proxy: 'Proxies',
});

async function start() {
  liveRulebook().catch(() => {});
  window.addEventListener('offline', () => {
    if (state.view === 'decks') render();
  });
  window.addEventListener('online', () => {
    if (state.view === 'decks') render();
  });
  setCardFaceRenderer((c) => cardFace(c, true));
  window.addEventListener('blutbank-session', (e) => {
    if (e.detail.user) setTimeout(() => api('list').catch(() => {}), 0);
    cardEditorAccess = e.detail.cardPermissions || null;
    const nextUser = e.detail.user || null;
    const changed = accountUser?.id !== nextUser?.id;
    accountUser = nextUser;
    if (changed || !document.querySelector('#header-account')) renderAccountHeader();
    if (state.view === 'card') addCardEditorLink();
    if (changed && ['decks', 'ruleadmin', 'rules'].includes(state.view)) render();
  });

  window.addEventListener('hashchange', render);
  if (readState().view === 'home') render();
  try {
    [de, en, cards, terms] = await Promise.all(
      ['rules-de', 'rules-en', 'cards', 'glossary'].map(async (name) => {
        if (name === 'cards') return loadCards();
        if (name.startsWith('rules-') || name === 'glossary') {
          try {
            const book = await liveRulebook();
            return name === 'glossary'
              ? book.glossary
              : book.languages[name.endsWith('en') ? 'en' : 'de'];
          } catch (error) {
            if (error.status !== undefined) throw error;
          }
        }
        const response = await fetch(`data/${name}.json?v=ability-glossary-20261026`);
        if (!response.ok) throw new Error(`Cannot load ${name}`);
        return response.json();
      }),
    );
    applyLiveGlossary();
    cards = cards.map(normalizeCardReminders);
    dataReady = true;
    updateCardEditorAccess();
    if (state.view === 'home') homeResults();
    else render();
  } catch (error) {
    $('#content').innerHTML =
      '<h1>Archiv nicht verfügbar / Archive unavailable</h1><p>Bitte die Seite erneut laden. / Please reload this page.</p>';
    console.error(error);
  }
}

function archiveFooter() {
  const downloadIcon =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></svg>';
  $('#archive-footer').innerHTML = /* HTML */ `<div class="footer-source-grid">
    <section class="footer-downloads">
      <h2>${t('Downloads', 'Downloads')}</h2>
      <a href="data/card-texts.json" data-footer-download="texts-download" download
        >${downloadIcon}<span>${t('Kartentexte · JSON', 'Card texts · JSON')}</span></a
      ><a href="data/card-texts.csv" data-footer-download="cards-csv" download
        >${downloadIcon}<span>${t('Kartentexte · CSV', 'Card texts · CSV')}</span></a
      ><a href="data/cards.json" data-footer-download="cards-download" download
        >${downloadIcon}<span>${t('Kartendaten · JSON', 'Card data · JSON')}</span></a
      >
    </section>
    <section class="footer-notice">
      <h2>${t('Hinweise', 'Notice')}</h2>
      <p>
        ${t('Octenarius ist die offizielle Kartendatenbank für Bluthelden und mit dem offiziellen Regelwerk verknüpft. Die hier veröffentlichten Kartentexte einschließlich Errata sind für offizielle Turniere maßgeblich. Rechte an Kartentexten, Illustrationen, Marken und Spielzeichen liegen bei den jeweiligen Rechteinhabern.', 'Octenarius is the official Bluthelden card database and is linked to the official rulebook. The card text published here, including errata, is authoritative for official tournaments. Card text, artwork, trademarks and game icons belong to their respective rights holders.')}
      </p>
    </section>
  </div>`;
  if (onlineCardApi)
    for (const a of document.querySelectorAll('[data-footer-download]')) {
      const endpoint = new URL(onlineCardApi);
      endpoint.searchParams.set('action', a.dataset.footerDownload);
      a.href = endpoint.href;
    }
}

function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function readState() {
  const p = location.hash.slice(2).split('?')[0].split('/');
  return {
    lang: p[0] === 'en' ? 'en' : 'de',
    view: [
      'home',
      'rules',
      'cards',
      'card',
      'glossary',
      'search',
      'proxy',
      'meta',
      'decks',
      'account',
      'shared',
      'editor',
      'users',
      'ruleadmin',
    ].includes(p[1])
      ? p[1]
      : 'home',
    id: safeDecode(p.slice(2).join('/')) || '',
  };
}

function source() {
  return state.lang === 'en' ? en : de;
}
function ruleId(id) {
  return url('rules', id);
}
// Link only complete terms. Rule identifiers remain stable in both languages.

function linkText(text, current = '') {
  text = symbolText(text);
  const aliases = new Map();
  for (const term of terms) {
    for (const alias of [term.de, term.en, ...(term.aliases || [])]) {
      if (!alias || alias.length < 2) continue;
      // English “dies” is an ordinary pronoun in German.
      if (state.lang === 'de' && alias.toLowerCase() === 'dies') continue;
      aliases.set(alias.toLowerCase(), term.id);
    }
  }
  const pattern = [...aliases.keys()]
    .sort((a, b) => b.length - a.length)
    .map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const rx = new RegExp(
    `(?<![\\p{L}\\p{N}_])(${pattern || '(?!)'})(?![\\p{L}\\p{N}_])|\\b((?:[0-9]+\\.)+[0-9]+)\\b|\\b((?:Kapitel|chapter)\\s+([0-9]+)(?![.0-9]))\\b|\\b((?:Anhang|Appendix)\\s+(?:III|II|I))\\b`,
    'giu',
  );
  let out = '',
    last = 0;
  for (const m of text.matchAll(rx)) {
    out += symbolHTML(text.slice(last, m.index));
    const targetRule = m[2] || m[4];
    const ruleTarget = targetRule && source().find((s) => numberOf(s) === targetRule);
    if (ruleTarget) {
      out += /* HTML */ `<a href="${ruleId(ruleTarget.id)}">${esc(m[0])}</a>`;
    } else if (m[5]) {
      out += /* HTML */ `<a
        href="${ruleId('appendix-' + m[5].match(/(III|II|I)$/i)[1].toLowerCase())}"
        >${esc(m[0])}</a
      >`;
    } else if (m[1] && aliases.get(m[1].toLowerCase()) !== current) {
      const id = aliases.get(m[1].toLowerCase());
      const term = terms.find((x) => x.id === id);
      out += /* HTML */ `<a
        class="term"
        href="${url('glossary', id)}"
        title="${esc((term[state.lang + 'Text'] || '').replace(/\s+/g, ' ').trim())}"
        >${esc(m[0])}</a
      >`;
    } else out += esc(m[0]);
    last = m.index + m[0].length;
  }
  return out + symbolHTML(text.slice(last));
}

// Lists retain their hierarchy and natural spacing independently of prose alignment.

function renderParagraphs(text) {
  const lines = text.split('\n');
  let out = '',
    paragraph = [],
    stack = [];
  const flush = () => {
    if (paragraph.length) {
      out += '<p>' + linkText(paragraph.join(' ')) + '</p>';
      paragraph = [];
    }
  };
  const close = () => {
    const x = stack.pop();
    out += '</li></' + x.tag + '>';
  };
  for (const line of lines) {
    const m = /^(\s*)([•●▪◦*-]|o(?=\s)|\d+[.)])\s+(.+)$/.exec(line);
    if (m) {
      flush();
      const indent = m[1].length,
        number = parseInt(m[2], 10),
        tag = Number.isNaN(number) ? 'ul' : 'ol';
      while (
        stack.length &&
        (indent < stack.at(-1).indent ||
          (indent === stack.at(-1).indent && tag !== stack.at(-1).tag))
      )
        close();
      if (!stack.length || indent > stack.at(-1).indent) {
        out += `<${tag}${tag === 'ol' ? ` start="${number}"` : ''}><li>`;
        stack.push({ indent, tag });
      } else out += `</li><li${tag === 'ol' ? ` value="${number}"` : ''}>`;
      out += linkText(m[3]);
    } else if (!line.trim()) {
      flush();
    } else {
      while (stack.length) close();
      paragraph.push(line.trim());
    }
  }
  flush();
  while (stack.length) close();
  return out;
}
// Content supports plain paragraphs, lists and simple Markdown tables.

function renderBody(body) {
  const chunks = body.split(/(\n?\|[^\n]+\|\n\|[ :|\-]+\|\n(?:\|[^\n]+\|(?:\n|$))+)/g);
  return chunks
    .map((chunk) => {
      if (!chunk.trim().startsWith('|')) return renderParagraphs(chunk);
      const rows = chunk
        .trim()
        .split('\n')
        .map((line) =>
          line
            .split('|')
            .slice(1, -1)
            .map((x) => x.trim()),
        );
      return (
        '<div class="table-wrap"><table><thead><tr>' +
        rows[0].map((x) => '<th scope="col">' + linkText(x) + '</th>').join('') +
        '</tr></thead><tbody>' +
        rows
          .slice(2)
          .map((row) => '<tr>' + row.map((x) => '<td>' + linkText(x) + '</td>').join('') + '</tr>')
          .join('') +
        '</tbody></table></div>'
      );
    })
    .join('');
}

function render() {
  if (!window.dispatchEvent(new CustomEvent('blutbank-before-route', { cancelable: true }))) return;
  clearTimeout(searchTimer);
  const previous = state;
  state = readState();
  if (['card', 'cards', 'editor'].includes(state.view) && state.id === '688dcbaa3d2b') {
    history.replaceState(history.state, '', url(state.view, 'cca2d2102a69'));
    state = readState();
  }
  document.body.dataset.view = state.view;
  if (state.view === 'cards' && state.id) {
    history.replaceState(history.state, '', url('card', state.id));
    state = readState();
    document.body.dataset.view = state.view;
  }
  if (state.view === 'card') {
    cardReturn =
      pendingCardReturn ||
      history.state?.cardReturn ||
      (previous.view === 'card' ? cardReturn : null);
    pendingCardReturn = null;
    if (cardReturn) history.replaceState({ ...history.state, cardReturn }, '', location.href);
  }
  const languageOnly =
    previous.lang !== state.lang && previous.view === state.view && previous.id === state.id;
  document.body.classList.toggle(
    'deck-mode',
    ['meta', 'decks', 'account', 'shared', 'editor', 'users', 'ruleadmin'].includes(state.view),
  );
  document.body.classList.toggle('card-page-mode', state.view === 'card');
  document.body.classList.toggle('archive-mode', ['cards', 'card'].includes(state.view));
  limit = 48;
  document.documentElement.lang = state.lang;
  $('#tabs').setAttribute('aria-label', t('Hauptnavigation', 'Main navigation'));
  document.body.classList.toggle(
    'catalog',
    [
      'cards',
      'card',
      'proxy',
      'meta',
      'decks',
      'account',
      'shared',
      'editor',
      'users',
      'ruleadmin',
    ].includes(state.view),
  );
  document.title = `${labels()[state.view] || { home: t('Offizielle Bluthelden-Kartendatenbank', 'Official Bluthelden card database'), account: t('Konto', 'Account'), shared: t('Geteiltes Deck', 'Shared deck'), editor: t('Kartenredaktion', 'Card editorial'), ruleadmin: t('Regelverwaltung', 'Rule administration'), glossary: t('Begriffe & Keywords', 'Terms & keywords'), users: t('Benutzerverwaltung', 'User administration') }[state.view] || t('Suche', 'Search')} · Octenarius`;
  $('.brand').href = url('home');
  $('#tabs').innerHTML = Object.entries(labels())
    .map(
      ([k, v]) =>
        /* HTML */ `<a
          href="${url(k, '')}"
          class="${state.view === k || (k === 'cards' && state.view === 'card') || (k === 'rules' && ['glossary', 'ruleadmin'].includes(state.view)) ? 'active' : ''}"
          ${state.view === k ? 'aria-current="page"' : ''}
          aria-label="${v}"
          title="${v}"
          >${navigationIcon(k)}<span class="oct-nav-label">${v}</span></a
        >`,
    )
    .join('');
  renderLanguageSwitcher();
  renderAccountHeader();
  if (state.view === 'home') {
    $('#sidebar').innerHTML = '';
    home(!languageOnly);
    archiveFooter();
    return;
  }
  if (!dataReady) {
    $('#content').innerHTML = /* HTML */ `<p role="status">
      ${t('Archiv wird geladen …', 'Loading archive …')}
    </p>`;
    return;
  }
  sidebar();
  if (state.view === 'users') {
    import('./user-admin.mjs').then(({ mountUserAdmin }) => {
      if (state.view === 'users') mountUserAdmin($('#content'), state.lang);
    });
  }
  if (state.view === 'editor') {
    (async () => {
      await updateCardEditorAccess();
      if (state.view !== 'editor') return;
      if (!cardEditorAccess?.access) {
        $('#content').innerHTML = '<p>Keine Redaktionsberechtigung.</p>';
        return;
      }
      const { mountCardEditor } = await import('./card-editor.mjs');
      if (state.view === 'editor')
        mountCardEditor($('#content'), cards, state.lang, state.id, async (card) => {
          cards = (await loadCards()).map(normalizeCardReminders);
        });
    })();
  }
  if (state.view === 'ruleadmin') {
    mountTypemill(true);
    return;
  }
  if (state.view === 'rules') rules();
  if (state.view === 'cards') catalog();
  if (state.view === 'card') cardPage();
  if (state.view === 'meta') mountMeta($('#content'), cards, state.lang);
  if (state.view === 'decks') {
    const restore = pendingArchiveRestore;
    pendingArchiveRestore = null;
    mountDeckBuilder($('#content'), cards, state.lang, state.id).then(() => {
      if (restore && state.view === 'decks') window.scrollTo(0, restore.scroll || 0);
    });
  }
  if (state.view === 'shared') {
    pendingArchiveRestore = null;
    mountShared($('#content'), cards, state.lang, state.id);
  }
  if (state.view === 'account') mountAccount($('#content'), cards, state.lang);
  if (state.view === 'proxy') mountProxy($('#content'), cards, state.lang);
  if (state.view === 'glossary') glossary();
  if (state.view === 'search') search();
  if (onlineCardApi)
    for (const a of document.querySelectorAll('a[download][href]')) {
      const href = a.getAttribute('href');
      const action = {
        'data/card-texts.json': 'texts-download',
        'data/card-texts.csv': 'cards-csv',
        'data/cards.json': 'cards-download',
      }[href];
      if (action) {
        const endpoint = new URL(onlineCardApi);
        endpoint.searchParams.set('action', action);
        a.href = endpoint.href;
      }
    }
  archiveFooter();
  if (!languageOnly) window.scrollTo({ top: 0, behavior: 'instant' });
}

function home(autoFocus = true) {
  if (!dataReady && !state.id) state.id = $('#home-query')?.value || '';
  const restore = pendingArchiveRestore;
  pendingArchiveRestore = null;
  if (state.id.trim()) homeCompact = true;
  $('#content').innerHTML = /* HTML */ `<section
      class="home-search${homeCompact ? ' has-query' : ''}"
    >
      <h1 class="visually-hidden">${t('Octenarius durchsuchen', 'Search Octenarius')}</h1>
      <form id="home-search-form" role="search">
        <label class="visually-hidden" for="home-query"
          >${t('Regeln, Begriffe und Karten durchsuchen', 'Search rules, terms and cards')}</label
        ><input id="home-query" type="search" autocomplete="off" value="${esc(state.id)}" /><button
          aria-label="${t('Suchen', 'Search')}"
          type="submit"
        >
          <svg
            viewBox="0 0 24 24"
            width="28"
            height="28"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            aria-hidden="true"
          >
            <circle cx="10.5" cy="10.5" r="7.5" />
            <path d="m16 16 6 6" />
          </svg>
        </button>
      </form>
      <p class="home-intro">
        ${t('Die offizielle Bluthelden-Kartendatenbank mit integriertem Regelwerk.', 'The official Bluthelden card database with integrated rulebook.')}
      </p>
    </section>
    <div id="home-status" class="home-status" role="status" aria-live="polite"></div>
    <section id="home-results" aria-label="${t('Suchergebnisse', 'Search results')}"></section>`;
  $('#home-query').addEventListener('input', (e) => {
    const q = e.target.value;
    state.id = q;
    history.replaceState(null, '', url('home', q));
    homeCompact = !!q.trim();
    $('.home-search').classList.toggle('has-query', homeCompact);
    if (!q.trim()) {
      homeResults();
      window.scrollTo({
        top: 0,
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      });
    }
    document.querySelectorAll('#languages a').forEach((a) => (a.href = url('home', q, a.lang)));
    clearTimeout(searchTimer);
    searchTimer = setTimeout(homeResults, 120);
  });
  $('#home-search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    clearTimeout(searchTimer);
    homeResults();
    $('#home-results a')?.focus();
  });
  homeResults();
  if (!restore && autoFocus)
    requestAnimationFrame(() => $('#home-query')?.focus({ preventScroll: true }));
  if (restore)
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-card="${CSS.escape(restore.focus || '')}"]`)
        ?.focus({ preventScroll: true });
      window.scrollTo(0, restore.scroll || 0);
    });
}

function homeResults() {
  if (state.view !== 'home') return;
  const q = state.id.trim(),
    results = $('#home-results'),
    status = $('#home-status');
  homeCompact = !!q;
  $('.home-search').classList.toggle('has-query', homeCompact);
  if (!q) {
    results.innerHTML = '';
    status.textContent = '';
    return;
  }
  if (!dataReady) {
    status.textContent = t('Das Archiv wird geladen …', 'Loading the archive …');
    return;
  }
  const { rr, tt, cc } = findResults(q);
  status.textContent = `${cc.length} ${t('Karten', 'cards')} · ${rr.length} ${t('Regeln', 'rules')} · ${tt.length} ${t('Begriffe', 'terms')}`;
  results.innerHTML =
    (!cc.length && !rr.length && !tt.length
      ? /* HTML */ `<p>
          ${t('Keine Treffer. Versuche einen anderen Suchbegriff.', 'No results. Try another search term.')}
        </p>`
      : '') +
    /* HTML */ `<div class="search-results-columns">
      ${
        cc.length
          ? /* HTML */ `<section class="search-card-results">
              <h2>${t('Karten', 'Cards')}</h2>
              <div class="card-grid">${cc.slice(0, 8).map(cardHTML).join('')}</div>
              <a class="home-more" href="#/${state.lang}/cards?q=${encodeURIComponent(q)}"
                >${t('Alle Karten anzeigen', 'Show all cards')} (${cc.length})</a
              >
            </section>`
          : ''
      }
      <div class="search-text-results">
        ${
          tt.length
            ? /* HTML */ `<section>
                <h2>${t('Begriffe', 'Terms')}</h2>
                ${tt
                  .slice(0, 3)
                  .map(
                    (x) =>
                      /* HTML */ `<a class="result" href="${url('glossary', x.id)}"
                        ><h3>${esc(x[state.lang])}</h3>
                        <p>${esc(textExcerpt(x[state.lang + 'Text'], q, 190))}</p></a
                      >`,
                  )
                  .join('')}
              </section>`
            : ''
        }
        ${
          rr.length
            ? /* HTML */ `<section>
                <h2>${t('Regeln', 'Rules')}</h2>
                ${rr
                  .slice(0, 3)
                  .map(
                    (r) =>
                      /* HTML */ `<a class="result" href="${ruleId(r.id)}"
                        ><h3>${r.number ? esc(r.number) + ' ' : ''}${esc(r.title)}</h3>
                        <p>${esc(ruleSearchPreview(r, q, 190))}</p></a
                      >`,
                  )
                  .join('')}
              </section>`
            : ''
        }
        ${rr.length > 3 || tt.length > 3 ? /* HTML */ `<a class="home-more" href="${url('search', q)}">${t('Alle Suchergebnisse anzeigen', 'Show all search results')}</a>` : ''}
      </div>
    </div>`;
  bindCards();
}

function sidebar() {
  $('#sidebar').innerHTML = /* HTML */ `<div class="searchbox">
      <input
        id="search"
        aria-label="${t('Archiv durchsuchen', 'Search archive')}"
        value="${state.view === 'search' ? esc(state.id) : ''}"
      />
    </div>
    <nav class="reference-controls" aria-label="${t('Nachschlagen', 'Reference navigation')}">
      <a class="contents-back reference-button" href="${ruleId('contents')}"
        >${catalogActionIcon('basic')}<span>${t('Inhalt', 'Contents')}</span></a
      ><a
        class="reference-button reference-glossary"
        href="${url('glossary')}"
        aria-label="${t('Glossar', 'Glossary')}"
        title="${t('Glossar', 'Glossary')}"
        >${t('Glossar', 'Glossary')}</a
      >
    </nav>`;
  $('#search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') location.hash = url('search', e.target.value.trim());
  });
  $('#search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    const q = e.target.value;
    searchTimer = setTimeout(() => {
      history.replaceState(null, '', url('search', q));
      state = { ...state, view: 'search', id: q };
      document.body.dataset.view = 'search';
      document.querySelector('.cms-outline')?.remove();
      document.body.classList.remove('catalog');
      renderLanguageSwitcher('search', q);
      document.querySelectorAll('#tabs a').forEach((a) => a.classList.remove('active'));
      document.title = t('Suche', 'Search') + ' · Octenarius';
      if (!document.querySelector('.contents-back')) {
        const a = document.createElement('a');
        a.className = 'contents-back';
        a.href = ruleId('');
        a.textContent = '← ' + t('Inhaltsverzeichnis', 'Contents');
        $('#sidebar').append(a);
      }
      search();
      archiveFooter();
    }, 200);
  });
}

function addRuleAdminLink() {}
async function refreshRules() {
  liveBookPromise = null;
  const book = await liveRulebook();
  de = book.languages.de;
  en = book.languages.en;
  terms = book.glossary;
  applyLiveGlossary();
  if (['rules', 'glossary'].includes(state.view)) render();
}
function glossaryContents() {
  return ['', 'Keyword']
    .map(
      (kind) =>
        /* HTML */ `<section class="toc-glossary">
          <h2>
            <a href="${url('glossary')}"
              >${kind ? t('Keywords', 'Keywords') : t('Begriffe', 'Terms')}</a
            >
          </h2>
          ${terms
            .filter((g) => (g.kind === 'Keyword') === (kind === 'Keyword'))
            .sort((a, b) => a[state.lang].localeCompare(b[state.lang], state.lang))
            .map(
              (g) =>
                /* HTML */ `<a class="toc-section" href="${url('glossary', g.id)}"
                  >${esc(g[state.lang])}</a
                >`,
            )
            .join('')}
        </section>`,
    )
    .join('');
}
function firstRule(rows) {
  return rows.find((row) => row.id === '1') || rows[0];
}
function ruleEntry(rows, lang) {
  let saved;
  try {
    saved = localStorage.getItem('octenarius.rules.last.' + lang);
  } catch {}
  return rows.find((row) => row.id === saved) || firstRule(rows);
}
function rememberRule(lang, id) {
  try {
    localStorage.setItem('octenarius.rules.last.' + lang, id);
  } catch {}
}

function rules() {
  mountTypemill(false);
}
function renderRuleSidebar(current) {
  const rows = source(),
    byId = new Map(rows.map((r) => [r.id, r])),
    children = (id) => rows.filter((r) => parentOf(r) === id),
    label = (r) => (r.number ? esc(r.number) + ' ' : '') + esc(r.title);
  const ancestors = [];
  let cursor = current;
  const seen = new Set();
  while (cursor && parentOf(cursor) && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    cursor = byId.get(parentOf(cursor));
    if (cursor) ancestors.unshift(cursor);
  }
  const expanded = new Set([...ancestors.map((r) => r.id), current?.id]);
  function tree(parent = '') {
    return (
      '<ul>' +
      children(parent)
        .map((r) => {
          const nested = children(r.id),
            link = /* HTML */ `<a
              href="${ruleId(r.id)}"
              ${r.id === current?.id ? 'aria-current="page"' : ''}
              >${label(r)}</a
            >`;
          return nested.length
            ? /* HTML */ `<li>
                <details ${expanded.has(r.id) ? 'open' : ''}>
                  <summary>${link}</summary>
                  ${tree(r.id)}
                </details>
              </li>`
            : `<li class="cms-tree-leaf">${link}</li>`;
        })
        .join('') +
      '</ul>'
    );
  }
  $('#sidebar').insertAdjacentHTML(
    'beforeend',
    /* HTML */ `<nav class="cms-tree" aria-label="${t('Regelwerkstruktur', 'Rulebook structure')}">
      ${tree()}
    </nav>`,
  );
}
function rulesNative() {
  const rows = source(),
    current = rows.find((r) => r.id === state.id),
    byId = new Map(rows.map((r) => [r.id, r]));
  const children = (id) => rows.filter((r) => parentOf(r) === id),
    label = (r) => (r.number ? esc(r.number) + ' ' : '') + esc(r.title);
  const ancestors = [];
  let cursor = current;
  const seen = new Set();
  while (cursor && parentOf(cursor) && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    cursor = byId.get(parentOf(cursor));
    if (cursor) ancestors.unshift(cursor);
  }
  renderRuleSidebar(current);
  if (!state.id || state.id === 'contents') {
    $('#content').innerHTML = /* HTML */ `<h1>${t('Inhalt', 'Contents')}</h1>
      <nav class="cms-child-pages" aria-label="${t('Kapitel', 'Chapters')}">
        ${children('')
          .map(
            (r) =>
              /* HTML */ `<a href="${ruleId(r.id)}"
                >${label(r)}<span aria-hidden="true"> →</span></a
              >`,
          )
          .join('')}<a href="${url('glossary')}"
          >${t('Glossar · Begriffe & Keywords', 'Glossary · Terms & keywords')} →</a
        >
      </nav>`;
    return;
  }
  if (!current) {
    $('#content').innerHTML = /* HTML */ `<h1>${t('Regel nicht gefunden', 'Rule not found')}</h1>
      <a href="${ruleId('contents')}">${t('Zum Inhaltsverzeichnis', 'Back to contents')}</a>`;
    return;
  }
  rememberRule(state.lang, current.id);
  const chapter = ancestors[0] || current,
    chapters = children(''),
    index = chapters.indexOf(chapter);
  const sectionBody = (r) =>
    /* HTML */ `<div class="rule-copy" data-rule-source="${esc(r.id)}">
      ${r.html !== undefined ? publishedHTML(r.html, r.id) : renderBody(r.body)}
    </div>`;
  const sectionTree = (parent, depth = 2) =>
    children(parent)
      .map(
        (r) =>
          /* HTML */ `<section class="rule-section" id="rule-section-${esc(r.id)}"><h${Math.min(depth, 6)}>${label(r)}</h${Math.min(depth, 6)}>${sectionBody(r)}${sectionTree(r.id, depth + 1)}</section>`,
      )
      .join('');
  $('#content').innerHTML = /* HTML */ `<article class="rule-chapter cms-rule-page">
    <div class="rule-heading">
      <h1>${label(chapter)}</h1>
      <nav
        class="page-links cms-page-links"
        aria-label="${t('Kapitelnavigation', 'Chapter navigation')}"
      >
        ${index > 0 ? /* HTML */ `<a class="reference-button reference-arrow reference-previous" href="${ruleId(chapters[index - 1].id)}" aria-label="${t('Vorheriges Kapitel', 'Previous chapter')}: ${label(chapters[index - 1])}" title="${label(chapters[index - 1])}">${catalogActionIcon('previous')}</a>` : ''}${index < chapters.length - 1 ? /* HTML */ `<a class="reference-button reference-arrow" href="${ruleId(chapters[index + 1].id)}" aria-label="${t('Nächstes Kapitel', 'Next chapter')}: ${label(chapters[index + 1])}" title="${label(chapters[index + 1])}">${catalogActionIcon('next')}</a>` : ''}
      </nav>
    </div>
    ${sectionBody(chapter)}${sectionTree(chapter.id)}
  </article>`;
  // Resolve authored relative links using each section's original source path.
  const paths = new Map(rows.map((r) => ['/handbuch' + r.cmsPath, r.id]));
  for (const copy of $('#content').querySelectorAll('[data-rule-source]')) {
    const origin = byId.get(copy.dataset.ruleSource);
    for (const a of copy.querySelectorAll('a[href]')) {
      if (a.getAttribute('href').startsWith('#/')) continue;
      const target = new URL(
        a.getAttribute('href'),
        location.origin + '/handbuch' + origin.cmsPath + '/',
      );
      if (target.origin === location.origin && paths.has(target.pathname.replace(/\/$/, '')))
        a.href = ruleId(paths.get(target.pathname.replace(/\/$/, ''))) + target.hash;
    }
    for (const image of copy.querySelectorAll('img[src]')) {
      const src = image.getAttribute('src');
      if (src.startsWith('media/')) image.src = '/handbuch/' + src;
    }
  }
  if (current.id !== chapter.id)
    requestAnimationFrame(() => {
      if (state.view === 'rules' && state.id === current.id)
        document.getElementById('rule-section-' + current.id)?.scrollIntoView({ block: 'start' });
    });
  enhanceFormulas($('#content'));
}

function toast(msg) {
  $('#toast').textContent = msg;
  $('#toast').style.display = 'block';
  setTimeout(() => ($('#toast').style.display = 'none'), 2000);
}

const searchTextCache = new WeakMap();
function publishedSearchContent(row) {
  if (searchTextCache.has(row)) return searchTextCache.get(row);
  const template = document.createElement('template');
  template.innerHTML = row.html || '';
  template.content.querySelectorAll('script,style').forEach((el) => el.remove());
  const clean = (node) => (node.textContent || '').replace(/\s+/g, ' ').trim();
  const tableRows = [...template.content.querySelectorAll('tbody tr')].map((tr) =>
    [...tr.querySelectorAll('td')].map(clean).join(' — '),
  );
  template.content
    .querySelectorAll('p,li,tr,h1,h2,h3,h4,blockquote,br')
    .forEach((el) => el.append(document.createTextNode(' ')));
  let text = clean(template.content);
  if (!row.html)
    text = (row.body || '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/<[^>]*>/g, '')
      .replace(/^[ \t]*[| :\-]+$/gm, '')
      .replace(/[|*`#]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const content = { text, tableRows };
  searchTextCache.set(row, content);
  return content;
}
const normalizeSearchText = (value) =>
  value
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
function textExcerpt(text, query, limit = 230) {
  const index = normalizeSearchText(text).indexOf(normalizeSearchText(query.trim()));
  let start = index > 60 ? index - 60 : 0;
  if (start) {
    const boundary = text.indexOf(' ', start);
    if (boundary >= 0 && boundary < index) start = boundary + 1;
  }
  let end = Math.min(text.length, start + limit);
  if (end < text.length) {
    const boundary = text.lastIndexOf(' ', end);
    if (boundary > start + limit / 2) end = boundary;
  }
  return (start ? '… ' : '') + text.slice(start, end).trim() + (end < text.length ? ' …' : '');
}
function ruleSearchPreview(row, query, limit = 230) {
  const content = publishedSearchContent(row),
    needle = normalizeSearchText(query.trim());
  const matchingRow =
    needle && content.tableRows.find((text) => normalizeSearchText(text).includes(needle));
  return textExcerpt(matchingRow || content.text, query, limit);
}

function findResults(q) {
  const norm = (s) =>
    s
      .toLocaleLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  const match = (s) => norm(s).includes(norm(q));
  const rr = q
    ? source().filter((s) => match(s.id + ' ' + s.title + ' ' + publishedSearchContent(s).text))
    : [];
  rr.sort(
    (a, b) =>
      (norm(b.id) === norm(q) ? 100 : match(b.title) ? 10 : 0) -
      (norm(a.id) === norm(q) ? 100 : match(a.title) ? 10 : 0),
  );
  const tt = q
    ? terms.filter((x) =>
        match(x.de + ' ' + x.en + ' ' + x.aliases.join(' ') + ' ' + x[state.lang + 'Text']),
      )
    : [];
  tt.sort(
    (a, b) =>
      (norm(b[state.lang]) === norm(q) ? 100 : match(b[state.lang]) ? 10 : 0) -
      (norm(a[state.lang]) === norm(q) ? 100 : match(a[state.lang]) ? 10 : 0),
  );
  const cc = q ? CardSearch.group(cards, { q }) : [];
  return { rr, tt, cc };
}

function search() {
  const q = state.id.trim(),
    { rr, tt, cc } = findResults(q);
  $('#content').innerHTML = /* HTML */ `<h1>${q ? esc(q) : t('Suche', 'Search')}</h1>
    <p class="muted">
      ${cc.length} ${t('Karten', 'cards')} · ${tt.length} ${t('Begriffe', 'terms')} · ${rr.length}
      ${t('Regeln', 'rules')}
    </p>
    <div class="search-results-columns">
      ${
        cc.length
          ? /* HTML */ `<section class="search-card-results">
              <h2>${t('Karten', 'Cards')}</h2>
              <div class="card-grid">${cc.slice(0, 60).map(cardHTML).join('')}</div>
            </section>`
          : ''
      }
      <div class="search-text-results">
        ${tt.length ? /* HTML */ `<h2>${t('Begriffe', 'Terms')}</h2>` : ''}${tt
          .map(
            (x) =>
              /* HTML */ `<a class="result" href="${url('glossary', x.id)}"
                ><h3>${esc(x[state.lang])}</h3>
                <p>${esc(x[state.lang + 'Text'])}</p></a
              >`,
          )
          .join('')}${rr.length ? /* HTML */ `<h2>${t('Regeln', 'Rules')}</h2>` : ''}${rr
          .map(
            (r) =>
              /* HTML */ `<a class="result" href="${ruleId(r.id)}"
                ><h3>${r.number ? esc(r.number) + ' ' : ''}${esc(r.title)}</h3>
                <p>${esc(ruleSearchPreview(r, q, 230))}</p></a
              >`,
          )
          .join('')}
      </div>
    </div>
    ${q && !rr.length && !tt.length && !cc.length ? /* HTML */ `<p>${t('Keine Treffer.', 'No results.')}</p>` : ''}`;
  bindCards();
}

function cardHTML(group) {
  const c = group.card || group,
    d = c.text || {},
    hint = `${c.id}-hint`;
  return /* HTML */ `<a
    class="card"
    href="${url('card', c.id)}"
    data-card="${c.id}"
    aria-label="${esc(c.name)}"
    aria-describedby="${hint}"
    ><img
      src="${esc(c.image)}"
      alt="${esc(c.name)}"
      loading="lazy"
      decoding="async"
      width="750"
      height="1047"
    /><span class="card-hint" id="${hint}" role="tooltip">${cardFace(c, true)}</span></a
  >`;
}
const statLabels = {
  asp: ['ASP-Kosten', 'ASP cost'],
  level: ['Level', 'Level'],
  pow: ['Stärke (POW)', 'Power (POW)'],
  hp: ['Trefferpunkte (HP)', 'Health (HP)'],
  res: ['Resistenz (RES)', 'Resistance (RES)'],
  ini: ['Initiative (INI)', 'Initiative (INI)'],
  magic: ['Magiewert', 'Magic value'],
  lp: ['Lebenspunkte (LP)', 'Life (LP)'],
};
const cardLabel = (value) => CardSearch.label(value, state.lang);

function readCardFilters() {
  const filters = Object.fromEntries(new URLSearchParams(location.hash.split('?')[1] || ''));
  if (filters.color) {
    filters.colors = filters.color;
    delete filters.color;
  }
  if (filters.rarity) {
    filters.rarities = filters.rarity;
    delete filters.rarity;
  }
  return filters;
}

function filterSelect(key, title, values) {
  return /* HTML */ `<label
    >${esc(title)}<select class="pill" data-filter="${key}">
      <option value="">${t('Alle', 'All')}</option>
      ${values.map((value) => /* HTML */ `<option value="${esc(value)}" ${cardFilters[key] === value ? 'selected' : ''}>${esc(cardLabel(value))}</option>`).join('')}
    </select></label
  >`;
}

function filterInput(key, title) {
  return /* HTML */ `<label
    >${esc(title)}<input
      class="pill"
      data-filter="${key}"
      value="${esc(cardFilters[key] || '')}"
      autocomplete="off"
  /></label>`;
}

function filterChoices(key, title, values) {
  const selected = (cardFilters[key] || '').split(',');
  return `<fieldset class="filter-choices"><legend>${title}</legend>${values.map((v) => /* HTML */ `<label data-choice="${esc(v)}"><input type="checkbox" data-multi="${key}" value="${esc(v)}" ${selected.includes(v) ? 'checked' : ''} />${key === 'colors' ? colorCrystal(v) : ''}${esc(cardLabel(v))}</label>`).join('')}</fieldset>`;
}

function catalog() {
  cardFilters = readCardFilters();
  for (const key of ['type', 'excludeType', 'subtype', 'trait']) delete cardFilters[key];
  const restore = pendingArchiveRestore || history.state?.archive;
  pendingArchiveRestore = null;
  if (restore?.hash === location.hash) limit = restore.limit || 48;
  const options = (field) =>
    [...new Set(cards.flatMap((c) => c.text?.[field] || []))].sort((a, b) =>
      cardLabel(a).localeCompare(cardLabel(b), state.lang),
    );
  $('#content').innerHTML = /* HTML */ `<div class="catalog-heading visually-hidden">
      <h1>${t('Karten', 'Cards')}</h1>
    </div>
    <form class="catalog-search catalog-home-search" id="quick-search" role="search">
      <label class="sr-only" for="card-search">${t('Karten durchsuchen', 'Search cards')}</label
      ><input
        id="card-search"
        value="${esc(cardFilters.q || '')}"
        type="search"
        autocomplete="off"
      /><button type="submit" aria-label="${t('Suchen', 'Search')}">
        ${catalogActionIcon('search')}
      </button>
    </form>
    <details class="advanced-filters" id="advanced-search" ${restore?.advanced ? 'open' : ''}>
      <summary>
        ${t('Erweiterte Suche', 'Advanced search')}<span id="active-filters"></span>
      </summary>
      <form id="advanced-form">
        <div class="advanced-row">
          <h2>${t('Name & Text', 'Name & text')}</h2>
          <div class="advanced-fields">
            ${filterInput('name', t('Kartenname', 'Card name'))}${filterInput('text', t('Kartentext', 'Rules text'))}${filterInput('typeLine', t('Typzeile', 'Type line'))}
          </div>
        </div>
        <div class="advanced-row">
          <h2>${t('Farben', 'Colors')}</h2>
          <div class="advanced-fields">
            ${filterChoices('colors', t('Kartenfarben', 'Card colors'), options('colors'))}<label
              >${t('Farbvergleich', 'Color comparison')}<select
                class="pill"
                data-filter="colorMode"
              >
                ${[
                  ['include', t('Enthält diese Farben', 'Including these colors')],
                  ['exact', t('Genau diese Farben', 'Exactly these colors')],
                  ['atmost', t('Höchstens diese Farben', 'At most these colors')],
                ]
                  .map(
                    ([v, l]) =>
                      /* HTML */ `<option
                        value="${v}"
                        ${cardFilters.colorMode === v ? 'selected' : ''}
                      >
                        ${l}
                      </option>`,
                  )
                  .join('')}
              </select></label
            >
          </div>
        </div>
        <div class="advanced-row">
          <h2>${t('Fähigkeiten & Mechaniken', 'Abilities & mechanics')}</h2>
          <div class="advanced-fields filter-columns">
            ${filterSelect('keyword', t('Begriff im Kartentext', 'Term in card text'), options('keywords'))}${filterSelect('mechanic', t('Mechanik', 'Mechanic'), ['pool', 'binding', 'rise'])}
          </div>
        </div>
        <div class="advanced-row">
          <h2>${t('Werte', 'Stats')}</h2>
          <div class="advanced-fields filter-columns">
            ${CardSearch.numeric
              .map(
                (k) =>
                  /* HTML */ `<fieldset class="stat-filter">
                    <legend>${statIcon(k)}${t(...statLabels[k])}</legend>
                    <select
                      class="pill"
                      data-filter="${k}Op"
                      aria-label="${t(...statLabels[k])} ${t('Vergleich', 'comparison')}"
                    >
                      ${['=', '<=', '>=', '<', '>', '!='].map((op) => /* HTML */ `<option value="${esc(op)}" ${cardFilters[k + 'Op'] === op ? 'selected' : ''}>${esc(op)}</option>`).join('')}</select
                    ><input
                      class="pill"
                      type="number"
                      min="0"
                      step="1"
                      data-filter="${k}Value"
                      value="${esc(cardFilters[k + 'Value'] || '')}"
                      aria-label="${t(...statLabels[k])} ${t('Wert', 'value')}"
                    />
                  </fieldset>`,
              )
              .join('')}
          </div>
        </div>
        <div class="advanced-row">
          <h2>${t('Edition & Druck', 'Set & printing')}</h2>
          <div class="advanced-fields filter-columns">
            ${filterSelect('set', t('Edition', 'Set'), [...new Set(cards.map((c) => c.set))])}${filterSelect('group', t('Spoiler-Gruppe', 'Spoiler group'), [...new Set(cards.map((c) => c.group))])}${filterSelect('language', t('Kartensprache', 'Card language'), options('language'))}${filterInput('artist', t('Künstler', 'Artist'))}${filterChoices('rarities', t('Seltenheit', 'Rarity'), [...new Set(cards.map((c) => c.text?.rarity).filter(Boolean))])}
          </div>
        </div>
        <div class="advanced-row">
          <h2>${t('Weitere Optionen', 'More options')}</h2>
          <div class="advanced-fields filter-columns">
            ${filterSelect('unknown', t('Ohne erfassten Wert für', 'Without a recorded value for'), CardSearch.numeric)}<label
              >${t('Sortierung', 'Sort by')}<select class="pill" data-filter="sort">
                ${[
                  ['name', t('Name', 'Name')],
                  ['asp', t('ASP-Kosten', 'ASP cost')],
                  ['level', 'Level'],
                  ['set', t('Edition', 'Set')],
                ]
                  .map(
                    ([v, l]) =>
                      /* HTML */ `<option value="${v}" ${cardFilters.sort === v ? 'selected' : ''}>
                        ${l}
                      </option>`,
                  )
                  .join('')}
              </select></label
            >${filterInput('flavor', t('Flavourtext', 'Flavor text'))}
          </div>
        </div>
        <div class="advanced-actions"></div>
      </form>
    </details>
    <div class="catalog-results-heading">
      <button
        class="pill catalog-action"
        id="clear-filters"
        aria-label="${t('Filter zurücksetzen', 'Clear filters')}"
        type="button"
        hidden
      >
        ${catalogActionIcon('reset')}<span>${t('Filter zurücksetzen', 'Clear filters')}</span>
      </button>
    </div>
    <div class="card-grid" id="cards"></div>
    <button class="pill more catalog-action" id="more" type="button">
      ${catalogActionIcon('plus')}<span>${t('Weitere Karten laden', 'Load more cards')}</span>
    </button> `;
  organizeCardFilters();
  const quick = () => {
    const q = $('#card-search').value.trim();
    if (q) cardFilters.q = q;
    else delete cardFilters.q;
    limit = 48;
    saveCardFilters();
    fillCards();
  };
  $('#card-search').oninput = quick;
  $('#quick-search').onsubmit = (e) => {
    e.preventDefault();
    quick();
  };
  const applyFilters = () => {
    const legacy = Object.fromEntries(
      Object.entries(cardFilters).filter(([k]) => k === 'q' || /Min$|Max$/.test(k)),
    );
    cardFilters = legacy;
    document.querySelectorAll('[data-filter]').forEach((input) => {
      if (input.value) cardFilters[input.dataset.filter] = input.value;
    });
    for (const key of ['colors', 'rarities']) {
      const values = [...document.querySelectorAll(`[data-multi="${key}"]:checked`)].map(
        (i) => i.value,
      );
      if (values.length) cardFilters[key] = values.join(',');
    }
    for (const k of CardSearch.numeric) if (!cardFilters[k + 'Value']) delete cardFilters[k + 'Op'];
    if (!cardFilters.colors) delete cardFilters.colorMode;
    if (cardFilters.sort === 'name') delete cardFilters.sort;
    limit = 48;
    saveCardFilters();
    fillCards();
  };
  $('#advanced-form').onsubmit = (e) => {
    e.preventDefault();
    applyFilters();
  };
  $('#advanced-form').addEventListener('input', applyFilters);
  $('#advanced-form').addEventListener('change', applyFilters);
  $('#clear-filters').onclick = () => {
    const expanded = $('#advanced-search').open;
    cardFilters = Object.fromEntries(
      Object.entries(cardFilters).filter(([key]) => ['q', 'sort'].includes(key)),
    );
    saveCardFilters();
    catalog();
    $('#advanced-search').open = expanded;
    $('#filter-toggle').focus({ preventScroll: true });
  };
  $('#more').onclick = () => {
    limit += 48;
    fillCards();
  };
  fillCards();
  if (restore?.hash === location.hash)
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-card="${CSS.escape(restore.focus || '')}"]`)
        ?.focus({ preventScroll: true });
      window.scrollTo({ top: restore.scroll || 0, behavior: 'instant' });
    });
}

function organizeCardFilters() {
  const form = $('#advanced-form'),
    panel = $('#advanced-search'),
    toolbar = $('.catalog-results-heading');
  toolbar.classList.add('catalog-toolbar');
  const searchRow = document.createElement('div');
  searchRow.className = 'catalog-search-row';
  const search = $('#quick-search');
  search.before(searchRow);
  searchRow.append(search, toolbar);
  const sort = form.querySelector('[data-filter="sort"]'),
    sortLabel = sort.closest('label');
  sort.id = 'catalog-sort';
  toolbar.append(sortLabel);
  sortLabel.className = 'catalog-sort';
  sort.setAttribute('aria-label', t('Sortierung', 'Sort by'));
  sortLabel.replaceChildren();
  sortLabel.insertAdjacentHTML('afterbegin', catalogActionIcon('sort'));
  sortLabel.append(sort);
  sort.onchange = () => {
    if (sort.value === 'name') delete cardFilters.sort;
    else cardFilters.sort = sort.value;
    limit = 48;
    saveCardFilters();
    fillCards();
  };
  const toggle = document.createElement('button');
  toggle.id = 'filter-toggle';
  toggle.className = 'pill filter-toggle catalog-action';
  toggle.type = 'button';
  toggle.setAttribute('aria-controls', 'advanced-search');
  toggle.setAttribute('aria-expanded', String(panel.open));
  toggle.innerHTML = /* HTML */ `${catalogActionIcon('sliders')}<span
      class="filter-toggle-label"
    ></span
    ><span id="active-filters"></span>`;
  panel.querySelector('summary').replaceChildren();
  panel.querySelector('summary').hidden = true;
  toggle.onclick = () => (panel.open = !panel.open);
  const updateFilterToggle = () => {
    toggle.setAttribute('aria-expanded', String(panel.open));
    toggle.setAttribute('aria-label', t('Filter', 'Filters'));
    toggle.querySelector('.filter-toggle-label').textContent = t('Filter', 'Filters');
  };
  panel.ontoggle = updateFilterToggle;
  updateFilterToggle();
  toolbar.insertBefore(toggle, $('#clear-filters'));
  toolbar.insertBefore(sortLabel, toggle);
  form.onkeydown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      panel.open = false;
      toggle.focus();
    }
  };
  const rows = [...form.querySelectorAll('.advanced-row')],
    actions = form.querySelector('.advanced-actions');
  const groups = [
    { name: t('Grundfilter', 'Basic filters'), icon: 'basic', rows: rows.slice(0, 3) },
    { name: t('Werte', 'Stats'), icon: 'stats', rows: rows.slice(3, 4) },
    { name: t('Druckversion', 'Printing'), icon: 'printing', rows: rows.slice(4) },
  ];
  const groupBar = document.createElement('div');
  groupBar.className = 'catalog-filter-groups';
  groupBar.setAttribute('role', 'group');
  groupBar.setAttribute('aria-label', t('Filterbereiche', 'Filter sections'));
  form.prepend(groupBar);
  const groupPanels = [],
    groupButtons = [];
  const selectGroup = (index) => {
    groupPanels.forEach((section, i) => {
      section.hidden = i !== index;
      groupButtons[i].setAttribute('aria-expanded', String(i === index));
    });
  };
  groups.forEach((group, i) => {
    const section = document.createElement('section');
    section.className = 'filter-group';
    section.id = `catalog-filter-group-${i}`;
    section.setAttribute('aria-label', group.name);
    section.append(...group.rows);
    form.insertBefore(section, actions);
    groupPanels.push(section);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pill catalog-action';
    button.setAttribute('aria-controls', section.id);
    button.innerHTML = /* HTML */ `${catalogActionIcon(group.icon)}<span>${group.name}</span
      ><span class="catalog-group-chevron" aria-hidden="true">⌄</span>`;
    button.onclick = () => selectGroup(section.hidden ? i : -1);
    groupBar.append(button);
    groupButtons.push(button);
  });
  selectGroup(0);
  const chips = document.createElement('div');
  chips.id = 'filter-chips';
  chips.className = 'filter-chips';
  chips.setAttribute('aria-label', t('Aktive Filter', 'Active filters'));
  panel.before(chips);
}

function renderFilterChips() {
  const labels = {
    name: t('Name', 'Name'),
    typeLine: t('Typzeile', 'Type line'),
    text: t('Text', 'Text'),
    colors: t('Farbe', 'Color'),
    rarities: t('Seltenheit', 'Rarity'),
    type: t('Typ', 'Type'),
    excludeType: t('Ohne Typ', 'Exclude type'),
    subtype: t('Untertyp', 'Subtype'),
    trait: t('Zusatz', 'Trait'),
    keyword: t('Fähigkeit', 'Ability'),
    mechanic: t('Mechanik', 'Mechanic'),
    set: t('Edition', 'Set'),
    group: t('Gruppe', 'Group'),
    language: t('Sprache', 'Language'),
    artist: t('Illustration', 'Artist'),
    flavor: t('Flavourtext', 'Flavor text'),
    unknown: t('Unbekannter Wert', 'Unknown stat'),
  };
  const entries = Object.entries(cardFilters).filter(
    ([key]) => !['q', 'sort', 'colorMode'].includes(key) && !key.endsWith('Op'),
  );
  const chips = entries.flatMap(([key, value]) =>
    ['colors', 'rarities'].includes(key)
      ? value.split(',').map((part) => [key, part, part])
      : [[key, value, '']],
  );
  $('#filter-chips').innerHTML = chips
    .map(([key, value, part]) => {
      const stat = /^(\w+)(Value|Min|Max)$/.exec(key),
        label =
          stat && statLabels[stat[1]]
            ? `${t(...statLabels[stat[1]])} ${stat[2] === 'Value' ? cardFilters[stat[1] + 'Op'] || '=' : stat[2] === 'Min' ? '≥' : '≤'} ${value}`
            : `${labels[key] || key}: ${value.split(',').map(cardLabel).join(', ')}`;
      return /* HTML */ `<span class="filter-chip"
        ><span class="filter-chip-label">${esc(label)}</span
        ><button
          type="button"
          data-clear-filter="${esc(key)}"
          data-clear-value="${esc(part)}"
          aria-label="${esc(label)} · ${t('entfernen', 'remove')}"
        >
          ${catalogActionIcon('close')}
        </button></span
      >`;
    })
    .join('');
  $('#filter-chips').hidden = !chips.length;
  document.querySelectorAll('[data-clear-filter]').forEach(
    (button) =>
      (button.onclick = () => {
        const expanded = $('#advanced-search').open,
          key = button.dataset.clearFilter,
          part = button.dataset.clearValue;
        if (part) {
          const rest = (cardFilters[key] || '').split(',').filter((value) => value !== part);
          if (rest.length) cardFilters[key] = rest.join(',');
          else delete cardFilters[key];
        } else delete cardFilters[key];
        if (key.endsWith('Value')) delete cardFilters[key.replace(/Value$/, 'Op')];
        if (key === 'colors' && !cardFilters.colors) delete cardFilters.colorMode;
        saveCardFilters();
        catalog();
        $('#advanced-search').open = expanded;
        $('#filter-toggle').focus({ preventScroll: true });
      }),
  );
}

function saveCardFilters() {
  const query = new URLSearchParams(cardFilters).toString();
  history.replaceState(null, '', `#/${state.lang}/cards` + (query ? '?' + query : ''));
  state.id = '';
  document
    .querySelectorAll('#languages a')
    .forEach((a) => (a.href = `#/${a.lang}/cards` + (query ? '?' + query : '')));
  document.querySelector('#tabs a.active')?.setAttribute('href', location.hash);
}

function fillCards() {
  const items = CardSearch.group(cards, cardFilters);
  $('#cards').innerHTML = items.length
    ? items.slice(0, limit).map(cardHTML).join('')
    : /* HTML */ `<p class="empty">
        ${t('Keine passenden Karten. Entferne einen Filter oder ändere die Suche.', 'No matching cards. Remove a filter or change your search.')}
      </p>`;
  const active = Object.keys(cardFilters).filter(
    (k) => !['q', 'sort', 'colorMode'].includes(k) && !k.endsWith('Op'),
  ).length;
  $('#active-filters').textContent = active ? ` · ${active}` : '';
  $('#clear-filters').hidden = !active;
  renderFilterChips();
  $('#more').hidden = items.length <= limit;
  bindCards();
}

function bindCards() {
  bindCardPreview();
  document.querySelectorAll('[data-card]').forEach(
    (b) =>
      (b.onclick = (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        openCard(cards.find((c) => c.id === b.dataset.card));
      }),
  );
  document.querySelectorAll('.card > img').forEach(
    (im) =>
      (im.onerror = () => {
        im.alt = t('Bild nicht verfügbar: ', 'Image unavailable: ') + im.alt;
        im.style.objectFit = 'contain';
      }),
  );
}

function openCard(c) {
  pendingCardReturn = {
    hash: location.hash,
    limit,
    scroll: window.scrollY,
    focus: c.id,
    advanced: $('#advanced-search')?.open || false,
  };
  history.replaceState({ ...history.state, archive: pendingCardReturn }, '', location.href);
  location.hash = url('card', c.id);
}

function cardTextSummary(c) {
  const d = c.text || {};
  return symbolText(
    [
      c.name + (d.stats?.asp != null ? ' ' + aspText(d.stats.asp) : ''),
      d.typeLine,
      ...Object.entries(d.stats || {})
        .filter(([k, v]) => k !== 'asp' && v !== null)
        .map(([k, v]) => `${k.toUpperCase()}: ${v}`),
      expandedRules(d.rulesText, d.language),
      d.additionalCostsText,
      d.flavorText,
      c.notes,
    ]
      .filter(Boolean)
      .join('\n\n'),
  );
}

function referenceTerms() {
  return terms.flatMap((term) => [term.de, term.en, ...(term.aliases || [])]).filter(Boolean);
}

function cardRuleText(value, language = 'en', links = true, section = 'all') {
  const render = links
      ? (text) =>
          renderCardLinks(
            text,
            cards,
            linkText,
            (c, label) =>
              /* HTML */ `<a class="token-reference-link" href="${url('card', c.id)}"
                >${esc(label)}</a
              >`,
            referenceTerms(),
          )
      : symbolHTML,
    parts = abilityParts(cardFlow(stripReminders(value)), language);
  const html = parts
    .filter((p) => !p.reference)
    .map((p) =>
      p.reminder
        ? `<em class="generated-reminder" data-ability="${esc(p.id)}">(${render(p.text)})</em>`
        : reminderParts(p.text)
            .map((x) => (x.reminder ? `<em>${render(x.text)}</em>` : render(x.text)))
            .join(''),
    )
    .join('');
  const paragraphs = htmlParagraphs(html)
    .map((x) => /* HTML */ `<p class="card-rule-paragraph">${x}</p>`)
    .join('');
  const references = parts.filter((p) => p.reference);
  return (
    (section === 'references' ? '' : paragraphs) +
    (section !== 'text' && references.length
      ? /* HTML */ `<aside class="card-ability-references">
          <h3>${t('Erklärungen erwähnter Fähigkeiten', 'Referenced ability explanations')}</h3>
          ${references.map((p) => /* HTML */ `<p><strong>${esc(p.name)}</strong><br />${render(p.text)}</p>`).join('')}
        </aside>`
      : '')
  );
}

function tokenExplanations(c, preview) {
  const tokens = referencedCards(c.text?.rulesText || '', cards, c, referenceTerms());
  if (!tokens.length) return '';
  return /* HTML */ `<aside class="card-token-references">
    <h3>${t('Referenzierte Karten', 'Referenced cards')}</h3>
    ${tokens
      .map((token) => {
        const image = `<img src="${esc(token.original)}" alt="${esc(token.name)}" loading="lazy" width="150" height="210">`;
        return /* HTML */ `<section class="referenced-token">
          ${preview ? image : /* HTML */ `<a href="${url('card', token.id)}">${image}</a>`}
          <div>
            ${cardHeading(token, state.lang, 'h3')}${cardPropertyRow(token, state.lang)}
            <div class="card-rules">
              ${cardRuleText(token.text?.rulesText || '', token.text?.language, !preview)}
            </div>
          </div>
        </section>`;
      })
      .join('')}
  </aside>`;
}

function cardFace(c, preview = false) {
  const d = c.text || {};
  const properties = [
    [
      t('Lebenspunkte (LP)', 'Life (LP)'),
      !d.types?.includes('Sovereign') && d.stats?.lp != null ? String(d.stats.lp) : '',
    ],
    [
      t('Farbe', 'Color'),
      (d.colors || []).map((color) => colorCrystal(color) + esc(cardLabel(color))).join(', '),
      true,
    ],
    [
      t('Mechaniken', 'Mechanics'),
      Object.entries(d.mechanics || {})
        .filter(([k, v]) => v === true && !['pool', 'rise'].includes(k))
        .map(([k]) => mechanicHTML(k))
        .join(', '),
      true,
    ],
  ];
  return `${cardHeading(c, state.lang, preview ? 'h2' : 'h1')}
        ${cardPropertyRow(c, state.lang)}
        ${d.rulesText?.trim() ? /* HTML */ `<div class="card-rules">${cardRuleText(d.rulesText, d.language, !preview, 'text')}</div>` : ''}
        ${d.flavorText ? /* HTML */ `<p class="card-flavor">${esc(symbolText(d.flavorText))}</p>` : ''}
        ${
          preview
            ? ''
            : `<dl class="card-facts">${properties
                .filter(([, v]) => v)
                .map(
                  ([k, v, html]) =>
                    /* HTML */ `<div>
                      <dt>${k}</dt>
                      <dd>${html ? v : esc(v)}</dd>
                    </div>`,
                )
                .join('')}</dl>
        ${d.artist ? /* HTML */ `<p class="card-artist">${t('Illustration', 'Illustration')}: ${esc(d.artist)}</p>` : ''}${cardRuleText(d.rulesText || '', d.language, true, 'references')}${tokenExplanations(c, false)}`
        }`;
}

function tokenProvenance(c) {
  const creators = tokenCreators(c, cards);
  if (!creators.length) return '';
  return /* HTML */ `<section class="token-creators">
    <h2>${t('Erzeugt durch', 'Created by')}</h2>
    <div class="token-creator-links">
      ${creators.map((card) => /* HTML */ `<a href="${url('card', card.id)}">${esc(card.name)}</a>`).join('')}
    </div>
  </section>`;
}

function cardPage() {
  const c = cards.find((c) => c.id === state.id);
  if (!c) {
    $('#content').innerHTML = /* HTML */ `<h1>${t('Karte nicht gefunden', 'Card not found')}</h1>
      <a href="${url('cards')}">${t('Zum Kartenarchiv', 'Back to card archive')}</a>`;
    return;
  }
  document.title = `${c.name} · ${c.set} · Octenarius`;
  const d = c.text || {},
    variants = cards
      .filter((x) => !x.archived || x.id === c.id)
      .filter((x) =>
        c.gameplayId
          ? x.gameplayId === c.gameplayId
          : CardSearch.nameKey(x.name) === CardSearch.nameKey(c.name),
      );

  $('#content').innerHTML = /* HTML */ ` <article class="card-page" aria-label="${esc(c.name)}">
    <div class="card-page-art">
      <img
        class="selected-card-image"
        src="${esc(c.original.replace('width=3200', 'width=1250'))}"
        alt="${esc(c.name)}"
        width="750"
        height="1047"
      />
      <div class="card-page-tools">
        <button
          class="pill card-function-button"
          id="copy-card-text"
          type="button"
          title="${t('Text kopieren', 'Copy text')}"
        >
          ${catalogActionIcon('clipboard')}<span>${t('Text kopieren', 'Copy text')}</span></button
        ><button
          class="pill card-function-button"
          id="copy-card-link"
          type="button"
          title="${t('Link kopieren', 'Copy link')}"
        >
          ${catalogActionIcon('link')}<span>${t('Link kopieren', 'Copy link')}</span></button
        ><a
          class="pill card-function-button"
          title="${t('Offizieller Spoiler', 'Official spoiler')}"
          href="${esc(c.source)}"
          target="_blank"
          rel="noopener"
          >${catalogActionIcon('external')}<span
            >${t('Offizieller Spoiler', 'Official spoiler')}</span
          ></a
        >
      </div>
      <aside class="card-printings" aria-label="${t('Druckversionen', 'Printings')}">
        <section class="printing-list">
          <div class="printing-options">
            ${variants
              .map(
                (v) =>
                  /* HTML */ `<a
                    class="printing-link ${v.id === c.id ? 'selected' : ''}"
                    href="${url('card', v.id)}"
                    data-version="${v.id}"
                    ${v.id === c.id ? 'aria-current="page"' : ''}
                    >${catalogActionIcon('printing')}<span class="printing-label"
                      ><span class="printing-edition">${esc(v.set)}</span
                      ><span class="printing-meta"
                        >${[v.code || v.text?.collectorNumber || '', v.text?.language?.toUpperCase()].filter(Boolean).map(esc).join(' · ')}</span
                      >${v.text?.rarity || v.variant ? /* HTML */ `<span class="printing-detail">${[v.text?.rarity ? cardLabel(v.text.rarity) : '', v.variant, v.archived ? t('archiviert', 'archived') : ''].filter(Boolean).map(esc).join(' · ')}</span>` : ''}</span
                    ></a
                  >`,
              )
              .join('')}
          </div>
        </section>
      </aside>
    </div>
    <div class="card-page-text">
      ${cardFace(c)}
      ${
        c.notes
          ? /* HTML */ `<section class="card-errata">
              <h2>${t('Hinweise & Errata', 'Notes & errata')}</h2>
              <div>${renderParagraphs(c.notes)}</div>
            </section>`
          : ''
      }
      ${tokenProvenance(c)}
    </div>
  </article>`;
  addCardEditorLink();
  updateCardEditorAccess();
  document.querySelectorAll('[data-version]').forEach(
    (a) =>
      (a.onclick = (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        history.replaceState({ ...history.state, cardReturn }, '', a.href);
        state = readState();
        cardPage();
        document
          .querySelectorAll('#languages a')
          .forEach((link) => (link.href = url('card', state.id, link.lang)));
        document
          .querySelector(`[data-version="${a.dataset.version}"]`)
          ?.focus({ preventScroll: true });
      }),
  );
  $('#copy-card-text').onclick = () =>
    copyText(cardTextSummary(c), t('Kartentext kopiert', 'Card text copied'));
  $('#copy-card-link').onclick = () => copyText(location.href, t('Link kopiert', 'Link copied'));
}

async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    toast(message);
  } catch {
    toast(
      t(
        'Kopieren nicht verfügbar. Text bitte markieren.',
        'Copy unavailable. Please select the text.',
      ),
    );
  }
}

function publishedHTML(html, current) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode())
    if (!walker.currentNode.parentElement?.closest('a,code,pre,script,style'))
      nodes.push(walker.currentNode);
  for (const node of nodes) {
    const replacement = document.createElement('template');
    replacement.innerHTML = linkText(node.textContent, current);
    node.replaceWith(replacement.content);
  }
  return template.innerHTML;
}
function glossaryKindIcon(term) {
  const keyword = /keyword/i.test(term.kind || '');
  const title = keyword ? t('Keyword', 'Keyword') : t('Begriff', 'Term');
  return /* HTML */ `<svg
    class="glossary-kind-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    role="img"
    aria-label="${title}"
  >
    <title>${title}</title>
    ${keyword ? '<path d="M3 3h8l10 10-8 8L3 11Z"/><circle cx="7.5" cy="7.5" r="1"/>' : '<path d="M12 5c-3-2-7-2-10-1v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v15"/>'}
  </svg>`;
}
function glossary() {
  renderRuleSidebar();
  const selected = terms.find((x) => x.id === state.id);
  const sorted = [...terms].sort((a, b) => a[state.lang].localeCompare(b[state.lang], state.lang));
  const shown = selected ? [selected] : sorted;
  const letters = [...new Set(sorted.map((x) => x[state.lang][0].toUpperCase()))];
  $('#content').innerHTML =
    `${selected ? /* HTML */ `<h1>${glossaryKindIcon(selected)}${esc(selected[state.lang])}</h1>` : /* HTML */ `<h1>${t('Glossar', 'Glossary')}</h1>`}
    ${selected ? /* HTML */ `<a class="reference-button glossary-back" href="${url('glossary')}">${catalogActionIcon('previous')}<span>${t('Alle Begriffe', 'All terms')}</span></a>` : /* HTML */ `<div class="alphabet">${letters.map((l) => /* HTML */ `<a href="#letter-${l}">${l}</a>`).join('')}</div>`}
    ${shown
      .map(
        (x, i) =>
          /* HTML */ `<section class="glossary-item" id="term-${x.id}">
            ${!selected && (!i || shown[i - 1][state.lang][0] !== x[state.lang][0]) ? /* HTML */ `<span id="letter-${x[state.lang][0].toUpperCase()}"></span>` : ''}
            ${selected ? '' : /* HTML */ `<h2><a href="${url('glossary', x.id)}">${glossaryKindIcon(x)}${esc(x[state.lang])}</a></h2>`}
            <div class="rule-copy">
              ${x[state.lang + 'Html'] !== undefined ? publishedHTML(x[state.lang + 'Html'], x.id) : x[state.lang + 'Delta'] ? renderDelta(x[state.lang + 'Delta'], (text) => linkText(text, x.id)) : linkText(x[state.lang + 'Text'], x.id)}
            </div>
            ${x.rule ? /* HTML */ `<p class="definition-rule"><a href="${ruleId(x.rule)}">${t('Regel', 'Rule')} ${x.rule} · ${esc(source().find((s) => s.id === x.rule)?.title || '')}</a></p>` : ''}
          </section>`,
      )
      .join('')}`;
  enhanceFormulas($('#content'));
  addRuleAdminLink();
  if ($('.alphabet'))
    $('.alphabet').onclick = (e) => {
      const a = e.target.closest('a');
      if (a) {
        e.preventDefault();
        document.getElementById(a.getAttribute('href').slice(1))?.scrollIntoView();
      }
    };
  if (selected) {
    const names = [selected.de, selected.en, ...selected.aliases]
      .filter((x) => !(state.lang === 'de' && x === 'dies'))
      .map((x) => x.toLowerCase());
    const refs = source()
      .filter(
        (s) =>
          s.id !== selected.rule &&
          names.some((n) => (s.title + ' ' + s.body).toLowerCase().includes(n)),
      )
      .slice(0, 12);
    $('#content').innerHTML += /* HTML */ `<h2>${t('Erwähnt in', 'Mentioned in')}</h2>
      <div class="backlinks">
        ${refs.map((s) => /* HTML */ `<a href="${ruleId(s.id)}">${s.number ? esc(s.number) + ' · ' : ''}${esc(s.title)}</a>`).join('') || t('Keine weiteren Verweise.', 'No additional references.')}
      </div>`;
  }
}
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const menu = document.querySelector('.action-menu[open]');
  if (menu) {
    e.preventDefault();
    menu.open = false;
    menu.querySelector('summary').focus();
    return;
  }
});
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (
    e.defaultPrevented ||
    e.button !== 0 ||
    e.metaKey ||
    e.ctrlKey ||
    e.shiftKey ||
    e.altKey ||
    !a ||
    a.hasAttribute('data-card') ||
    !/^#\/(de|en)\/card\//.test(a.getAttribute('href'))
  )
    return;
  if (['decks', 'shared'].includes(state.view)) {
    pendingCardReturn = { hash: location.hash, scroll: window.scrollY };
  }
});
// UI initialization

document.addEventListener('pointerdown', (event) =>
  document.querySelectorAll('.action-menu[open]').forEach((menu) => {
    if (!menu.contains(event.target)) menu.open = false;
  }),
);
document.addEventListener('click', (event) => {
  const item = event.target.closest('.menu-items button,.menu-items a');
  const menu = item?.closest('.action-menu');
  if (menu) menu.open = false;
});
document.addEventListener(
  'toggle',
  (event) => {
    if (event.target.matches('.action-menu[open]'))
      document.querySelectorAll('.action-menu[open]').forEach((menu) => {
        if (menu !== event.target) menu.open = false;
      });
  },
  true,
);

function decorateSearch() {
  document
    .querySelectorAll(
      'input[type="search"], #search, #deck-search, input[data-filter="name"], input[data-filter="text"], input[data-filter="artist"], input[data-filter="flavor"]',
    )
    .forEach((input) => {
      if (input.closest('.search-field, #home-search-form, .catalog-home-search')) return;
      const wrap = document.createElement('span');
      wrap.className = 'search-field';
      input.before(wrap);
      wrap.append(input);
    });
}
new MutationObserver(decorateSearch).observe(document.querySelector('#content'), {
  childList: true,
  subtree: true,
});
new MutationObserver(decorateSearch).observe(document.querySelector('#sidebar'), {
  childList: true,
  subtree: true,
});
$('.skip').addEventListener('click', (e) => {
  e.preventDefault();
  $('#content').focus();
  $('#content').scrollIntoView();
});
start();

async function mountTypemill(edit) {
  if (edit) {
    location.href = '/handbuch/tm/content/visual/regeln';
    return;
  }
  const lang = state.lang,
    id = state.id;
  $('#content').innerHTML =
    '<p role="status">' + t('Regeln werden geladen …', 'Loading rules …') + '</p>';
  try {
    const loaded = await liveRulebook();
    const book = { ...loaded.languages, glossary: loaded.glossary };
    if (state.view !== 'rules' || state.lang !== lang || state.id !== id) return;
    de = book.de;
    en = book.en;
    terms = book.glossary;
    applyLiveGlossary();
    if (!state.id) {
      const entry = ruleEntry(source(), state.lang);
      if (entry) {
        state.id = entry.id;
        history.replaceState(history.state, '', ruleId(entry.id));
      }
    }
    sidebar();
    rulesNative();
    renderAccountHeader();
  } catch (error) {
    if (state.view === 'rules')
      $('#content').innerHTML = '<p role="alert">' + esc(error.message) + '</p>';
  }
}
