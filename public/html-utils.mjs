/** Escape plain text before placing it in HTML text or quoted attributes. */
export function escapeHTML(value) {
  const entities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return String(value ?? '').replace(/[&<>"']/g, (character) => entities[character]);
}

export { htmlParagraphs } from './text-paragraphs.mjs';
