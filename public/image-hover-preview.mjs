// Image cards show text only; text rows show artwork alongside text.
const bindings = new WeakMap();
export function bindImagePreview(root = document) {
  bindings.get(root)?.();
  const events = new AbortController();
  let active = null,
    hideTimer;
  const panel = document.createElement('div');
  panel.className = 'deck-rich-preview with-art unified-card-preview';
  panel.hidden = true;
  panel.setAttribute('aria-hidden', 'true');
  document.body.append(panel);
  const hide = () => {
    clearTimeout(hideTimer);
    active = null;
    panel.hidden = true;
  };
  const scheduleHide = () => {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, 140);
  };
  const show = (target, pointer = null) => {
    clearTimeout(hideTimer);
    const link = target?.closest?.('.card,[data-deck-preview],.deck-card-name');
    if (!link || !root.contains(link) || link === active) return;
    const image = link.querySelector('img');
    if (!image) return;
    active = link;
    const art = document.createElement('img');
    art.className = 'deck-preview-art';
    art.src = image.currentSrc || image.src;
    art.alt = '';
    const text = document.createElement('div');
    text.className = 'card-hint card-hint-floating';
    text.innerHTML =
      link.querySelector('template')?.innerHTML ||
      link.querySelector('.card-hint')?.innerHTML ||
      '';
    const imageRect = image.getBoundingClientRect(),
      hasVisibleArt = imageRect.width > 0 && imageRect.height > 0;
    panel.classList.toggle('with-art', !hasVisibleArt);
    panel.classList.toggle('text-only', hasVisibleArt);
    panel.replaceChildren(...(hasVisibleArt ? [text] : [art, text]));
    panel.hidden = false;
    const rect = link.getBoundingClientRect(),
      cardWidth = hasVisibleArt ? 320 : 600,
      cardHeight = innerHeight - 24,
      width = Math.min(cardWidth, innerWidth - 24);
    panel.style.setProperty('--preview-height', Math.min(cardHeight, innerHeight - 24) + 'px');
    panel.style.width = width + 'px';
    panel.style.maxHeight = Math.min(cardHeight, innerHeight - 24) + 'px';
    const editor = !!link.closest('.deck-edit-workspace');
    let anchor = rect;
    if (editor) {
      const range = document.createRange();
      const nameNode = [...link.childNodes].find(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
      );
      if (nameNode) {
        range.selectNodeContents(nameNode);
        const textRect = range.getBoundingClientRect();
        if (textRect.width) anchor = textRect;
      }
    } // Keep the entire vertical card column free, including the rows below the trigger.
    const column = link.closest(
      '.deck-section,.presentation-group,.presentation-section,.deck-art-grid,.deck-image-grid,#cards',
    );
    if (hasVisibleArt) {
      anchor = imageRect;
    } else if (column) {
      const columnRect = column.getBoundingClientRect();
      anchor = { left: columnRect.left, right: columnRect.right };
    }
    const gap = hasVisibleArt ? 4 : 12;
    // Keep a safety gap around the opening pointer even when a wide text link is hovered.
    const right = Math.max(anchor.right + gap, pointer ? pointer.x + 16 : anchor.right + gap),
      left = Math.min(anchor.left - gap, pointer ? pointer.x - 16 : anchor.left - gap);
    const rightSpace = Math.max(0, innerWidth - 12 - right),
      leftSpace = Math.max(0, left - 12);
    const useRight = rightSpace >= width;
    const fitsSide = useRight || leftSpace >= width;
    panel.style.width = width + 'px';
    panel.style.left =
      (fitsSide
        ? useRight
          ? right
          : left - width
        : Math.max(12, Math.min(anchor.left, innerWidth - width - 12))) + 'px';
    panel.classList.toggle('preview-overlap', !fitsSide);
    const positionTop = () => {
      panel.style.maxHeight = innerHeight - 24 + 'px';
      if (pointer && !fitsSide) {
        const below = Math.max(0, innerHeight - pointer.y - 28),
          above = Math.max(0, pointer.y - 28),
          useBelow = below >= above;
        panel.style.maxHeight = (useBelow ? below : above) + 'px';
        panel.style.top =
          (useBelow ? pointer.y + 16 : Math.max(12, pointer.y - 16 - panel.offsetHeight)) + 'px';
      } else
        panel.style.top =
          Math.max(12, Math.min(rect.top, innerHeight - panel.offsetHeight - 12)) + 'px';
    };
    positionTop();
    art.onload = positionTop;
  };
  root.addEventListener(
    'pointerover',
    (e) => {
      if (e.pointerType !== 'touch') show(e.target, { x: e.clientX, y: e.clientY });
    },
    { signal: events.signal },
  );
  root.addEventListener(
    'pointerout',
    (e) => {
      if (active && !active.contains(e.relatedTarget)) hide();
    },
    { signal: events.signal },
  );
  root.addEventListener('focusin', (e) => requestAnimationFrame(() => show(e.target)), {
    signal: events.signal,
  });
  panel.addEventListener('pointerenter', () => clearTimeout(hideTimer), { signal: events.signal });
  panel.addEventListener('pointerleave', scheduleHide, { signal: events.signal });
  root.addEventListener('focusout', hide, { signal: events.signal });
  window.addEventListener(
    'scroll',
    () => {
      const focused = document.activeElement;
      if (focused?.matches('.card,[data-deck-preview],.deck-card-name') && root.contains(focused)) {
        active = null;
        show(focused);
      } else hide();
    },
    { capture: true, passive: true, signal: events.signal },
  );
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape') hide();
    },
    { signal: events.signal },
  );
  const dispose = () => {
    clearTimeout(hideTimer);
    events.abort();
    panel.remove();
    bindings.delete(root);
  };
  window.addEventListener('hashchange', dispose, { once: true, signal: events.signal });
  bindings.set(root, dispose);
  return hide;
}
