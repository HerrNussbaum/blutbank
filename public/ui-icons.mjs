// Inline SVG controls used by the public and administrative views.
// Keep shape definitions and their accessibility conventions in this module.

export function catalogActionIcon(name) {
  const paths = {
    previous: '<path d="M20 12H4m6-6-6 6 6 6"/>',
    next: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    clipboard:
      '<rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 3h6v4H9zM9 12h6M9 16h6"/>',
    link: '<path d="m10 13 4-4m-6 7-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
    external:
      '<path d="M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/>',
    edit: '<path d="m15 4 5 5M3 21l5-1L21 7a2 2 0 0 0-5-5L3 15z"/>',
    search: '<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 6 6"/>',
    sliders:
      '<path d="M3 6h18M3 12h18M3 18h18"/><circle cx="8" cy="6" r="2" fill="var(--surface)"/><circle cx="16" cy="12" r="2" fill="var(--surface)"/><circle cx="10" cy="18" r="2" fill="var(--surface)"/>',
    reset: '<path d="M3 3h18l-7 8v5l-4 3v-8zM16 17l5 5m0-5-5 5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    basic: '<path d="M4 5h16M4 12h12M4 19h8"/>',
    stats: '<path d="m4 16 12-12 5 5L9 21zM10 10l3 3m1-7 3 3M6 14l3 3"/>',
    sort: '<path d="M8 3v18m-4-4 4 4 4-4M15 5h6M15 10h4M15 15h2"/>',
    printing: '<path d="m12 3 10 5-10 5L2 8zM2 12l10 5 10-5M2 16l10 5 10-5"/>',
  };
  return /* HTML */ `<svg
    class="catalog-action-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    ${paths[name] || ''}
  </svg>`;
}

export function overviewIcon(name) {
  const paths = {
    filter:
      '<path d="M3 6h18M3 12h18M3 18h18"/><circle cx="8" cy="6" r="2" fill="var(--surface)"/><circle cx="16" cy="12" r="2" fill="var(--surface)"/><circle cx="10" cy="18" r="2" fill="var(--surface)"/>',
    import: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    back: '<path d="M20 12H4m6-6-6 6 6 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
    download: '<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
    print: '<path d="M6 8V3h12v5M6 17H3V8h18v9h-3M6 14h12v7H6Z"/>',
    done: '<path d="m4 12 5 5L20 6"/>',
    restore: '<path d="M3 10a9 9 0 1 1 2 9M3 4v6h6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
    decks: '<path d="m3 7 9-4 9 4-9 4ZM3 12l9 4 9-4M3 17l9 4 9-4"/>',
    edit: '<path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14Z"/>',
    link: '<path d="m10 13 4-4m-6 7-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
  };
  return /* HTML */ `<svg
    class="deck-overview-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    ${paths[name]}
  </svg>`;
}

export function accountIcon(name) {
  const paths = {
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
    cards: '<rect x="7" y="5" width="14" height="16" rx="2"/><path d="M17 5V2H3v15h4"/>',
    rules: '<path d="M12 5c-3-2-7-2-10-1v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v15"/>',
    users:
      '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5"/>',
    logout: '<path d="M9 3H3v18h6m0-9h12m-4-4 4 4-4 4"/>',
  };
  return /* HTML */ `<svg
    class="account-action-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    ${paths[name]}
  </svg>`;
}

export const editorIcon = (name) => {
  const paths = {
    save: '<path d="M3 3h15l3 3v15H3ZM7 3v6h10V3M7 21v-8h10v8"/>',
    send: '<path d="m3 3 18 9-18 9 4-9Zm4 9h14"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15"/>',
    back: '<path d="M20 12H4m6-6-6 6 6 6"/>',
    publish: '<path d="m4 12 5 5L20 6"/>',
  };
  return /* HTML */ `<svg
    class="editor-action-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    ${paths[name]}
  </svg>`;
};
