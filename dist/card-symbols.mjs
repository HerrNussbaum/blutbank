/** Shared plain-text notation. Ordinary uses of the word “turn” stay untouched. */
export function symbolText(value) {
  return String(value ?? '')
    .replace(/\[(?:turn|tap|T)\]|\{(?:turn|tap)\}|[↷↻⟳]/gi, '{T}')
    .replace(/\b(\d+|X)\s+ASP\b/gi, '{$1}')
    .replace(/\[ASP\s*:?\s*(\d+|X)\]|\[(\d+|X)\s*ASP\]/gi, (_, a, b) => `{${a || b}}`);
}
export const aspText = value => value == null || value === '' ? '' : `{${value}}`;
