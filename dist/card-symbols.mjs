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

// Render only known tokens; all other input remains escaped plain text.
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const image = (file, alt = '', extra = '') => `<img class="game-symbol ${extra}" src="assets/symbols/${file}.webp" alt="${escapeHTML(alt)}" ${alt ? '' : 'aria-hidden="true"'} width="28" height="28" decoding="async">`;
export function costHTML(value, ability = false) {
  if (value == null || value === '') return '';
  const n = String(value).toUpperCase();
  return /^[0-9X]$/.test(n) ? image(`${ability ? 'asp-faehigkeit-weiss-' : 'asp-'}${n.toLowerCase()}`, `{${n}}`, ability ? 'ability-symbol' : 'cost-symbol') : escapeHTML(aspText(value));
}
export function symbolHTML(value) {
  return escapeHTML(symbolText(value)).replace(/\{(T|X|[0-9]+)\}/g, (token, n) => n === 'T' ? image('turn-weiss', '{T}') : costHTML(n, true));
}
export function statIcon(key, value) {
  if (['pow','hp','res','ini'].includes(key)) return image(key);
  if (key === 'level' && [1,2].includes(Number(value))) return image(`lvl-${value}`);
  return '';
}
export function mechanicHTML(key) {
  const files = {pool:'pool',binding:'bindung',rise:'rise'};
  return `${files[key] ? image(files[key]) : ''}${escapeHTML(key[0]?.toUpperCase()+key.slice(1))}`;
}
