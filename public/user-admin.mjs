import { api } from './deck-online.mjs';
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const roles = {
  reader: ['Normales Konto', 'Regular account'],
  editor: ['Redaktion', 'Editor'],
  approver: ['Freigabe', 'Reviewer'],
  admin: ['Administration', 'Administrator'],
};

export async function mountUserAdmin(root, lang = 'de') {
  const t = (de, en) => (lang === 'en' ? en : de);
  root.innerHTML = /* HTML */ `<p role="status">
    ${t('Berechtigung wird geprüft …', 'Checking permissions …')}
  </p>`;
  try {
    const session = await api('session');
    if (!session.cardPermissions?.manage) {
      root.innerHTML = /* HTML */ `<p>
        ${t('Keine Berechtigung zur Benutzerverwaltung.', 'No permission to manage users.')}
      </p>`;
      return;
    }
    const response = await api('card-users'),
      owners = new Set(response.owners.map((e) => e.toLowerCase())),
      users = new Map(response.users.map((u) => [u.email.toLowerCase(), u]));
    for (const email of response.owners) users.set(email.toLowerCase(), { email, role: 'admin' });
    root.innerHTML = /* HTML */ `<a class="account-back" href="#/${lang}/account"
        >← ${t('Konto', 'Account')}</a
      >
      <h1>${t('Benutzerverwaltung', 'User administration')}</h1>
      <p class="muted">
        ${t('Zugriffsrechte für registrierte Konten.', 'Access permissions for registered accounts.')}
      </p>
      <p id="user-admin-status" role="status"></p>
      <div class="user-admin-list">
        ${[...users.values()]
          .sort((a, b) => a.email.localeCompare(b.email))
          .map((u, i) => {
            const locked =
              owners.has(u.email.toLowerCase()) ||
              u.email.toLowerCase() === session.user.email.toLowerCase();
            return /* HTML */ `<form
              data-user-form
              data-email="${esc(u.email)}"
              class="user-admin-row"
            >
              <label for="user-role-${i}"
                >${esc(u.email)}${locked ? `<small>${owners.has(u.email.toLowerCase()) ? t('Startkonto', 'Owner account') : t('Dein Konto', 'Your account')}</small>` : ''}</label
              ><select
                id="user-role-${i}"
                name="role"
                ${locked ? 'disabled' : ''}
                aria-label="${t('Rolle für', 'Role for')} ${esc(u.email)}"
              >
                ${Object.entries(roles)
                  .map(
                    ([key, label]) =>
                      /* HTML */ `<option value="${key}" ${u.role === key ? 'selected' : ''}>
                        ${t(...label)}
                      </option>`,
                  )
                  .join('')}</select
              >${locked ? '' : /* HTML */ `<button class="pill" type="submit">${t('Speichern', 'Save')}</button>`}
            </form>`;
          })
          .join('')}
      </div>`;
    root.querySelectorAll('[data-user-form]').forEach(
      (form) =>
        (form.onsubmit = async (e) => {
          e.preventDefault();
          const button = form.querySelector('button');
          button.disabled = true;
          try {
            await api('card-role', { email: form.dataset.email, role: form.elements.role.value });
            root.querySelector('#user-admin-status').textContent = t(
              'Benutzerrechte gespeichert.',
              'User permissions saved.',
            );
          } catch (error) {
            root.querySelector('#user-admin-status').textContent = error.message;
          } finally {
            button.disabled = false;
          }
        }),
    );
  } catch (error) {
    root.innerHTML = /* HTML */ `<p>${esc(error.message)}</p>`;
  }
}
