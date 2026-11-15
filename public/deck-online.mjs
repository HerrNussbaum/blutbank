import { accountIcon } from './ui-icons.mjs';
import {
  cachedDeckList,
  cachedOwnDeck,
  setDeckSession,
  invalidateDecks,
} from './deck-prefetch.mjs';

import { mountPresentation } from './deck-presentation.mjs';
import { accountDeckStore, validateDeck, indexCards } from './deck-model.mjs';
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
let config, csrf;

async function apiRequest(action, data) {
  if (!config) {
    const r = await fetch('/deck-config.json');
    config = await r.json();
  }
  if (!config.api)
    throw Error(
      'Die Octenarius-Kontofunktion ist derzeit nicht verfügbar. / Octenarius accounts are currently unavailable.',
    );
  const u = new URL(config.api, location.origin + '/');
  if (u.origin !== location.origin) throw Error('Invalid API origin');
  const [actionName, params] = action.split('?');
  u.searchParams.set('action', actionName);
  if (params)
    for (const [key, value] of new URLSearchParams(params)) u.searchParams.set(key, value);
  const r = await fetch(u, {
    method: data ? 'POST' : 'GET',
    credentials: 'same-origin',
    headers: data ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf || '' } : {},
    body: data ? JSON.stringify(data) : undefined,
  });
  let result;
  try {
    result = await r.json();
  } catch {
    throw Error('Server nicht verfügbar / Server unavailable');
  }
  if (!r.ok) {
    const error = Error(result.error || 'Server error');
    error.status = r.status;
    throw error;
  }
  if (result.csrf) csrf = result.csrf;
  if (['session', 'login', 'logout'].includes(actionName)) {
    setDeckSession(result);
    window.dispatchEvent(new CustomEvent('blutbank-session', { detail: result }));
  }
  return result;
}

export async function saveOnline(deck, expectedUser = null) {
  const session = await api('session');
  if (!session.user) throw Error('Bitte zuerst anmelden. / Please sign in first.');
  if (expectedUser && session.user.id !== expectedUser)
    throw Error('Das angemeldete Konto hat sich geändert. / The signed-in account has changed.');
  const sent = JSON.stringify({
    ...deck,
    remoteRevision: undefined,
    pendingSave: undefined,
    visibility: undefined,
  });
  const owner = session.user.id,
    result = await api('save', {
      deck,
      revision: deck.remoteRevision ?? null,
      expectedUser: owner,
    });
  const store = accountDeckStore(owner),
    all = store.read(),
    i = all.findIndex((d) => d.id === deck.id),
    latest = i >= 0 ? all[i] : deck;
  const saved = {
    ...latest,
    remoteRevision: result.revision,
    visibility: result.visibility || 'private',
    pendingSave:
      JSON.stringify({
        ...latest,
        remoteRevision: undefined,
        pendingSave: undefined,
        visibility: undefined,
      }) !== sent,
  };
  if (i < 0) all.push(saved);
  else all[i] = saved;
  store.storage.setItem(store.key, JSON.stringify(all));
  deck.remoteRevision = result.revision;
  deck.visibility = saved.visibility;
  return result;
}
export async function setDeckVisibility(deck, visibility, expectedUser) {
  const session = await api('session');
  if (!session.user || session.user.id !== expectedUser)
    throw Error('Bitte erneut anmelden. / Please sign in again.');
  return api('visibility', {
    id: deck.id,
    visibility,
    revision: deck.remoteRevision,
    expectedUser,
  });
}
export function deckSignIn(root, lang) {
  const en = lang === 'en';
  root.innerHTML = /* HTML */ `<h1>${en ? 'My decks' : 'Meine Decks'}</h1>
    <p>
      ${en ? 'Sign in to create and edit decks. Public decks can be viewed without signing in.' : 'Melde dich an, um Decks zu erstellen und zu bearbeiten. Öffentliche Decks kannst du auch ohne Anmeldung ansehen.'}
    </p>
    <a class="pill" href="#/${lang}/account">${en ? 'Sign in' : 'Anmelden'}</a>`;
}

export async function mountAccount(root, cards, lang) {
  const t = (d, e) => (lang === 'en' ? e : d);
  root.innerHTML = /* HTML */ `<h1>${t('Konto', 'Account')}</h1>
    <p role="status" id="account-status">
      ${t('Verbindung wird geprüft …', 'Checking connection …')}
    </p>`;
  try {
    let session = await api('session');
    if (!root.querySelector('#account-status')) return;
    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    if (params.has('token')) {
      const token = params.get('token');
      history.replaceState(null, '', `#/${lang}/account`);
      session = await api('login', { token });
    }
    if (!session.user) {
      root.innerHTML = /* HTML */ `<h1>${t('Anmelden', 'Sign in')}</h1>
        <p>
          ${t('Anmeldung per E-Mail-Link. Kein Passwort nötig.', 'Sign in by email link. No password needed.')}
        </p>
        <form class="account-form">
          <label
            >E-Mail<input
              type="email"
              name="email"
              autocomplete="email"
              required
              maxlength="254" /></label
          ><button class="pill">
            ${accountIcon('mail')}<span>${t('Anmeldelink senden', 'Send sign-in link')}</span>
          </button>
        </form>
        <p id="account-status" role="status"></p>`;
      root.querySelector('form').onsubmit = async (e) => {
        e.preventDefault();
        const button = e.target.querySelector('button');
        button.disabled = true;
        try {
          await api('request-login', { email: new FormData(e.target).get('email'), lang });
          root.querySelector('#account-status').textContent = t(
            'Wenn der Versand möglich ist, erhältst du einen Link. Er gilt 15 Minuten.',
            'If delivery is available, you will receive a link valid for 15 minutes.',
          );
        } catch (e) {
          root.querySelector('#account-status').textContent = e.message;
        } finally {
          button.disabled = false;
        }
      };
      return;
    }
    root.innerHTML = /* HTML */ `<h1>${t('Konto', 'Account')}</h1>
      <p class="account-email">${esc(session.user.email)}</p>
      <div class="account-actions">
        ${session.cardPermissions?.access ? /* HTML */ `<a class="pill" href="#/${lang}/editor">${accountIcon('cards')}<span>${t('Karten bearbeiten', 'Edit cards')}</span></a>` : ''}${
          session.cardPermissions?.manage
            ? /* HTML */ `<a class="pill" href="#/${lang}/ruleadmin"
                  >${accountIcon('rules')}<span
                    >${t('Regelwerk verwalten', 'Manage rulebook')}</span
                  ></a
                ><a class="pill" href="#/${lang}/users"
                  >${accountIcon('users')}<span
                    >${t('Benutzerverwaltung', 'User administration')}</span
                  ></a
                >`
            : ''
        }<button id="logout" class="pill">
          ${accountIcon('logout')}<span>${t('Abmelden', 'Sign out')}</span>
        </button>
      </div>
      <p id="account-status" role="status"></p>`;
    root.querySelector('#logout').onclick = async () => {
      await api('logout', {});
      mountAccount(root, cards, lang);
    };
  } catch (e) {
    const el = root.querySelector('#account-status');
    if (el) el.textContent = e.message;
  }
}

export async function mountShared(root, cards, lang, token) {
  root.innerHTML = /* HTML */ `<p id="shared-status">
    ${lang === 'en' ? 'Loading deck …' : 'Deck wird geladen …'}
  </p>`;
  try {
    await api('session');
    const { deck } = await api('read-shared', { token });
    if (!root.querySelector('#shared-status')) return;
    location.replace(`#/${lang}/decks/${encodeURIComponent(deck.id)}`);
  } catch (e) {
    const el = root.querySelector('#shared-status');
    if (el) el.textContent = e.message;
  }
}
export async function mountPublicDeck(root, cards, lang, deck, session, isCurrent = () => true) {
  const t = (d, e) => (lang === 'en' ? e : d);
  const idx = indexCards(cards, await (await fetch('data/card-identities.json')).json());
  if (!isCurrent()) return;
  root.innerHTML = /* HTML */ `<div id="public-presentation"></div>
    <p id="public-deck-status" role="status"></p>`;
  mountPresentation(root.querySelector('#public-presentation'), deck, idx, lang);
  const actions = root.querySelector('.deck-reading-actions');
  if (!session.user) {
    actions.innerHTML = /* HTML */ `<a class="pill" href="#/${lang}/account"
      >${t('Zum Kopieren anmelden', 'Sign in to make a copy')}</a
    >`;
    return;
  }
  const owner = session.user.id,
    button = document.createElement('button');
  button.className = 'pill deck-save-own';
  button.textContent = t('Als eigenes Deck speichern', 'Save as own deck');
  actions.append(button);
  button.onclick = async () => {
    button.disabled = true;
    try {
      const copy = { ...deck, id: crypto.randomUUID(), visibility: 'private', trashed: false };
      delete copy.remoteRevision;
      delete copy.pendingSave;
      validateDeck(copy, idx);
      await saveOnline(copy, owner);
      if (!isCurrent()) return;
      location.hash = `#/${lang}/decks/${copy.id}`;
    } catch (e) {
      if (isCurrent()) root.querySelector('#public-deck-status').textContent = e.message;
    } finally {
      button.disabled = false;
    }
  };
}

export async function api(action, data) {
  const [name, query] = action.split('?');
  if (!data && name === 'list') return cachedDeckList(() => apiRequest(action));
  if (!data && name === 'read-deck') {
    const cached = cachedOwnDeck(new URLSearchParams(query).get('id'));
    if (cached) return cached;
  }
  const mutation =
    data && ['save', 'visibility', 'delete', 'share', 'unshare', 'logout', 'login'].includes(name);
  if (mutation) invalidateDecks();
  try {
    return await apiRequest(action, data);
  } finally {
    if (mutation) invalidateDecks();
  }
}
