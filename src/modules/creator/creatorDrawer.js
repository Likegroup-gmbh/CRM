// Duennes Mount fuer die bestehende Drawer-Schale (drawer-overlay / drawer-panel).
// Gleiche Klassen, gleiche Ein- und Ausblendzeit wie die uebrigen Drawer.
// Die Breite laesst sich am Griff am linken Rand per Ziehen (oder Pfeiltasten)
// anpassen und wird pro Drawer in localStorage gemerkt. Zu breite Tabellen
// scrollen dann horizontal innerhalb des Drawer-Koerpers.

const MIN_WIDTH = 360;
const widthKey = (id) => `drawer-width:${id}`;

const clampWidth = (px) => Math.min(Math.max(px, MIN_WIDTH), Math.round(window.innerWidth * 0.95));

function applyWidth(panel, px) {
  panel.style.width = `${Math.round(px)}px`;
  // Inline max-width, damit auch ueber die Klassen-Obergrenze hinaus
  // vergroessert werden kann (z.B. 1200px bei drawer-panel--xwide)
  panel.style.maxWidth = '95vw';
}

function bindResize(panel, id) {
  const handle = document.createElement('div');
  handle.className = 'drawer-resize-handle';
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-orientation', 'vertical');
  handle.setAttribute('aria-label', 'Breite anpassen');
  handle.tabIndex = 0;
  panel.appendChild(handle);

  const persist = (width) => {
    try { localStorage.setItem(widthKey(id), String(Math.round(width))); } catch { /* privat o.ae. */ }
  };

  handle.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    const right = panel.getBoundingClientRect().right;
    let lastWidth = null;
    panel.classList.add('drawer-panel--resizing');
    document.body.classList.add('drawer-resizing');

    const onMove = (moveEvent) => {
      lastWidth = clampWidth(right - moveEvent.clientX);
      applyWidth(panel, lastWidth);
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      panel.classList.remove('drawer-panel--resizing');
      document.body.classList.remove('drawer-resizing');
      if (lastWidth != null) persist(lastWidth);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  });

  // Tastatur: Pfeiltasten verschieben die Breite in 24px-Schritten
  handle.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const current = panel.getBoundingClientRect().width || panel.offsetWidth || MIN_WIDTH;
    const delta = event.key === 'ArrowLeft' ? 24 : -24;
    const next = clampWidth(current + delta);
    applyWidth(panel, next);
    persist(next);
  });
}

export function openDrawer({ id, title, subtitle = '', body = '', avatar = null, panelClass = '', resizable = true, onClose = null }) {
  closeDrawer(id);

  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  overlay.id = `${id}-overlay`;

  // Kleines Bild neben dem Titel, damit im Drawer klar ist, um wen es geht
  const avatarHtml = avatar?.url
    ? `<img src="${avatar.url}" alt="" class="table-avatar table-avatar-img" />`
    : (avatar?.initials ? `<span class="table-avatar">${avatar.initials}</span>` : '');

  const panel = document.createElement('div');
  panel.className = `drawer-panel${panelClass ? ` ${panelClass}` : ''}`;
  panel.id = id;
  panel.setAttribute('role', 'dialog');
  panel.innerHTML = `
    <div class="drawer-header">
      <div class="drawer-header-left${avatarHtml ? ' drawer-header-left--with-avatar' : ''}">
        ${avatarHtml}
        <div>
          <span class="drawer-title">${title}</span>
          ${subtitle ? `<p class="drawer-subtitle">${subtitle}</p>` : ''}
        </div>
      </div>
      <button type="button" class="drawer-close-btn" aria-label="Schließen">&times;</button>
    </div>
    <div class="drawer-body">${body}</div>
  `;

  if (resizable) {
    let stored = null;
    try { stored = Number(localStorage.getItem(widthKey(id))); } catch { stored = null; }
    if (stored > 0) applyWidth(panel, clampWidth(stored));
    bindResize(panel, id);
  }

  const close = () => {
    closeDrawer(id, true);
    onClose?.();
  };

  overlay.addEventListener('click', close);
  panel.querySelector('.drawer-close-btn').addEventListener('click', close);

  document.body.appendChild(overlay);
  document.body.appendChild(panel);
  requestAnimationFrame(() => panel.classList.add('show'));

  return { panel, body: panel.querySelector('.drawer-body'), close };
}

export function closeDrawer(id, animated = false) {
  const overlay = document.getElementById(`${id}-overlay`);
  const panel = document.getElementById(id);
  if (!overlay && !panel) return;

  if (!animated) {
    overlay?.remove();
    panel?.remove();
    return;
  }

  panel?.classList.remove('show');
  setTimeout(() => {
    overlay?.remove();
    panel?.remove();
  }, 300);
}
