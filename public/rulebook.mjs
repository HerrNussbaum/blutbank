export const numberOf = (row) => row.number || row.id;
export const escape = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export function parentOf(row) {
  return row.parent ?? (row.id.includes('.') ? row.id.slice(0, row.id.lastIndexOf('.')) : '');
}
export function subtree(rows, id) {
  const ids = new Set([id]);
  for (const r of rows) if (ids.has(parentOf(r))) ids.add(r.id);
  return rows.filter((r) => ids.has(r.id));
}
export function chapterOf(rows, id) {
  let row = rows.find((r) => r.id === id);
  const visited = new Set();
  while (row && parentOf(row) && !visited.has(row.id)) {
    visited.add(row.id);
    row = rows.find((r) => r.id === parentOf(row));
  }
  return row?.id;
}
export function moveSection(rows, id, direction) {
  const row = rows.find((r) => r.id === id);
  if (!row) return rows;
  const siblings = rows.filter((r) => parentOf(r) === parentOf(row)),
    i = siblings.indexOf(row),
    other = siblings[i + direction];
  if (!other) return rows;
  const block = subtree(rows, id),
    target = subtree(rows, other.id),
    ids = new Set(block.map((r) => r.id)),
    result = rows.filter((r) => !ids.has(r.id));
  const index =
    direction < 0
      ? result.findIndex((r) => r.id === other.id)
      : result.findIndex((r) => r.id === target.at(-1).id) + 1;
  result.splice(index, 0, ...block);
  return result;
}
const safeColor = (v) =>
  typeof v === 'string' &&
  /^(#[\da-f]{3,4}|#[\da-f]{6}|#[\da-f]{8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0(?:\.\d+)?|1(?:\.0+)?|\.\d+))?\s*\)|[a-z]{1,30})$/i.test(
    v,
  );
const safeRuleLink = (v) =>
  typeof v === 'string' &&
  v.length < 2048 &&
  !/[\x00-\x20]/.test(v) &&
  !v.startsWith('//') &&
  (/^(https?:\/\/|mailto:|tel:|sms:|#|\/(?!\/)|\.\/|\.\.\/)/i.test(v) || !/[\\:]/.test(v));

function mediaURL(value, video = false) {
  try {
    const u = new URL(value);
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      (!video ||
        (['www.youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com'].includes(u.hostname) &&
          /^\/(embed\/[\w-]+|video\/\d+)$/.test(u.pathname)))
    );
  } catch {
    return false;
  }
}
export function renderDelta(delta, linkText = escape) {
  let html = '',
    line = '',
    plainLine = '',
    list = '',
    tableRow = '';
  const closeTable = () => {
    if (tableRow) {
      html += '</tr></tbody></table></div>';
      tableRow = '';
    }
  };
  const close = () => {
    if (list) {
      html += `</${list}>`;
      list = '';
    }
  };
  for (const op of delta.ops || []) {
    const a = op.attributes || {};
    if (typeof op.insert === 'object' && op.insert) {
      const e = op.insert;
      if (mediaURL(e.image))
        line += `<img class="rule-image" src="${escape(e.image)}" alt="${escape(a.alt || '')}" loading="lazy">`;
      else if (mediaURL(e.video, true))
        line += `<iframe class="rule-video" src="${escape(e.video)}" title="Video" loading="lazy" referrerpolicy="no-referrer" allowfullscreen></iframe>`;
      else if (typeof e.formula === 'string')
        line += /* HTML */ `<span class="rule-formula" data-formula="${escape(e.formula)}"
          >${escape(e.formula)}</span
        >`;
      continue;
    }
    const parts = String(op.insert || '').split('\n');
    parts.forEach((part, i) => {
      if (part) {
        plainLine += part;
        let text = a.code
          ? escape(part)
          : safeRuleLink(a.link)
            ? /* HTML */ `<a href="${escape(a.link)}" rel="noopener">${escape(part)}</a>`
            : linkText(part);
        for (const [key, tag] of [
          ['bold', 'strong'],
          ['italic', 'em'],
          ['underline', 'u'],
          ['strike', 's'],
          ['code', 'code'],
        ])
          if (a[key]) text = `<${tag}>${text}</${tag}>`;
        if (['sub', 'super'].includes(a.script))
          text = `<${a.script === 'sub' ? 'sub' : 'sup'}>${text}</${a.script === 'sub' ? 'sub' : 'sup'}>`;
        const classes = [];
        if (['serif', 'monospace', 'sans-serif'].includes(a.font))
          classes.push('rule-font-' + a.font);
        if (['small', 'large', 'huge'].includes(a.size)) classes.push('rule-size-' + a.size);
        const styles = [];
        if (safeColor(a.color)) styles.push('color:' + a.color);
        if (safeColor(a.background)) styles.push('background-color:' + a.background);
        if (classes.length || styles.length)
          text = /* HTML */ `<span${classes.length ? ` class="${classes.join(' ')}"` : ''}${styles.length ? ` style="${styles.join(';')}"` : ''}>${text}</span>`;
        line += text;
      }
      if (i < parts.length - 1) {
        if (typeof a.table === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(a.table)) {
          close();
          if (!tableRow) {
            html += '<div class="table-wrap"><table><tbody><tr>';
            tableRow = a.table;
          } else if (tableRow !== a.table) {
            html += '</tr><tr>';
            tableRow = a.table;
          }
          html += '<td>' + (line || '<br>') + '</td>';
          line = '';
          plainLine = '';
          return;
        }
        closeTable();
        const styles = [];
        if (['left', 'center', 'right', 'justify'].includes(a.align))
          styles.push('text-align:' + a.align);
        if (Number.isInteger(a.indent) && a.indent > 0 && a.indent <= 8)
          styles.push('margin-inline-start:' + a.indent * 2 + 'em');
        const attrs =
          (styles.length ? ` style="${styles.join(';')}"` : '') +
          (a.direction === 'rtl' ? ' dir="rtl"' : '');
        if (a.list) {
          const tag = a.list === 'ordered' ? 'ol' : 'ul';
          if (list !== tag) {
            close();
            html += `<${tag}>`;
            list = tag;
          }
          html += `<li${attrs}>${['checked', 'unchecked'].includes(a.list) ? /* HTML */ `<input type="checkbox" disabled ${a.list === 'checked' ? 'checked' : ''} aria-label="${a.list === 'checked' ? 'Erledigt' : 'Offen'}" /> ` : ''}${line || '<br>'}</li>`;
        } else {
          close();
          const tag =
            Number.isInteger(a.header) && a.header >= 1 && a.header <= 6
              ? `h${a.header}`
              : a['code-block']
                ? 'pre'
                : a.blockquote
                  ? 'blockquote'
                  : 'p';
          html += `<${tag}${attrs}>${a['code-block'] ? escape(plainLine) : line || '<br>'}</${tag}>`;
        }
        line = '';
        plainLine = '';
      }
    });
  }
  close();
  closeTable();
  return html + (line ? /* HTML */ `<p>${line}</p>` : '');
}
let formulaLoading;
export async function enhanceFormulas(root) {
  const nodes = [...root.querySelectorAll('.rule-formula:not([data-rendered])')];
  if (!nodes.length) return;
  try {
    if (!window.katex)
      await (formulaLoading ??= new Promise((resolve, reject) => {
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = 'vendor/katex/katex.min.css';
        document.head.append(css);
        const script = document.createElement('script');
        script.src = 'vendor/katex/katex.min.js';
        script.onload = resolve;
        script.onerror = () => {
          formulaLoading = null;
          reject(Error('Formula load failed'));
        };
        document.head.append(script);
      }));
    for (const n of nodes) {
      if (!n.isConnected) continue;
      window.katex.render(n.dataset.formula, n, {
        throwOnError: false,
        trust: false,
        strict: 'ignore',
        maxExpand: 200,
      });
      n.dataset.rendered = 'true';
    }
  } catch {
    /* Keep the readable formula source when loading is unavailable. */
  }
}
