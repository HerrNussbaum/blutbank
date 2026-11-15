// Shared, filesystem-safe names for exported decks and proxies.
export function downloadName(name, extension, suffix = '') {
  const clean =
    String(name || 'Deck')
      .normalize('NFC')
      .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^[. ]+|[. ]+$/g, '')
      .slice(0, 100)
      .trim() || 'Deck';
  return `${clean}${suffix ? ' – ' + suffix : ''} – Octenarius.${extension}`;
}
