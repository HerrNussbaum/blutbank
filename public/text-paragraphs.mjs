/** Split rendered prose at text newlines, preserving formatted HTML tags. */
export function htmlParagraphs(html) {
  return html
    .replace(/<[^>]*>/g, (tag) => tag.replace(/\n\s*/g, ' '))
    .split(/\n+/)
    .filter((paragraph) => paragraph.trim());
}
