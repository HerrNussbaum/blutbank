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

/** Split rendered prose at text newlines, preserving formatted HTML tags. */
export function htmlParagraphs(html) {
  return html
    .replace(/<[^>]*>/g, (tag) => tag.replace(/\n\s*/g, ' '))
    .split(/\n+/)
    .filter((paragraph) => paragraph.trim());
}
