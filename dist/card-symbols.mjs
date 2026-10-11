/** Shared plain-text notation. Ordinary uses of the word “turn” stay untouched. */
export function symbolText(value) {
  return String(value ?? '')
    .replace(/\[(?:turn|tap|T)\]|\{(?:turn|tap)\}|[↷↻⟳]/gi, '{T}')
    .replace(/\b(\d+|X)\s+ASP\b/gi, '{$1}')
    .replace(/\[ASP\s*:?\s*(\d+|X)\]|\[(\d+|X)\s*ASP\]/gi, (_, a, b) => `{${a || b}}`);
}
export const aspText = value => value == null || value === '' ? '' : `{${value}}`;

/** OCR line wrapping follows the printed image, not the available text column. */
export function cardFlow(value) {
  return symbolText(value).split(/\n{2,}/).map(paragraph =>
    paragraph.replace(/\n(?!\{(?:T|X|\d+)\}(?:,?\s*\{(?:T|X|\d+)\})*\s*:|[•●]\s)/g, ' ')
  ).join('\n\n');
}
