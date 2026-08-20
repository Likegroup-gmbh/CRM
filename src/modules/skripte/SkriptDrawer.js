// SkriptDrawer.js
// Zentraler Drawer-Helfer fuer das Skripte-Modul (Editor-Feedback, DNA-View).
// Ersetzt die zuvor duplizierten createDrawer-Implementierungen aus
// SkriptListeTab und SkriptFeedbackDrawer.

import { escapeHtml } from './SkripteUtils.js';

export function createSkriptDrawer(id, title, bodyHtml, buttons, { onClose } = {}) {
  removeSkriptDrawer(id);

  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay show';
  overlay.id = `${id}-overlay`;

  const panel = document.createElement('div');
  panel.setAttribute('role', 'dialog');
  panel.className = 'drawer-panel show skripte-drawer';
  panel.id = id;
  panel.innerHTML = `
    <div class="skripte-drawer-header">
      <h2>${escapeHtml(title)}</h2>
      <button class="skripte-drawer-close" aria-label="Schließen">&times;</button>
    </div>
    <div class="skripte-drawer-body">${bodyHtml}</div>
    <div class="skripte-drawer-footer"></div>
  `;

  const close = () => {
    removeSkriptDrawer(id);
    onClose?.();
  };

  const footer = panel.querySelector('.skripte-drawer-footer');
  for (const btn of buttons) {
    const el = document.createElement('button');
    el.className = btn.primary ? 'primary-btn' : (btn.danger ? 'danger-btn' : 'secondary-btn');
    el.textContent = btn.label;
    el.addEventListener('click', async () => {
      el.disabled = true;
      const shouldClose = await btn.onClick();
      el.disabled = false;
      if (shouldClose !== false) close();
    });
    footer.appendChild(el);
  }

  overlay.addEventListener('click', close);
  panel.querySelector('.skripte-drawer-close').addEventListener('click', close);

  document.body.appendChild(overlay);
  document.body.appendChild(panel);
}

export function removeSkriptDrawer(id) {
  document.getElementById(`${id}-overlay`)?.remove();
  document.getElementById(id)?.remove();
}
