// StrategieLongTextDrawer.js
// Volltext-Ansicht fuer Transkript und Caption. In der Tabelle stehen davon nur
// zwei Zeilen Vorschau - ein Transkript hat schnell mehrere tausend Zeichen.

const DRAWER_ID = 'strategie-longtext-drawer';

const FELD_TITEL = {
  transkript: 'Transkript',
  caption: 'Caption'
};

const QUELLE_LABELS = {
  whisper: 'Whisper-Transkription',
  native_captions: 'Native Untertitel der Plattform'
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function removeLongTextDrawer() {
  document.getElementById(`${DRAWER_ID}-overlay`)?.remove();
  document.getElementById(DRAWER_ID)?.remove();
}

export function closeLongTextDrawer() {
  const panel = document.getElementById(DRAWER_ID);
  const overlay = document.getElementById(`${DRAWER_ID}-overlay`);
  overlay?.classList.remove('active');
  panel?.classList.remove('show');
  setTimeout(removeLongTextDrawer, 250);
}

export function showLongTextDrawer(item, field) {
  const text = (item?.[field] || '').trim();
  if (!text) return;

  removeLongTextDrawer();

  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  overlay.id = `${DRAWER_ID}-overlay`;

  const panel = document.createElement('div');
  panel.setAttribute('role', 'dialog');
  panel.className = 'drawer-panel drawer-panel--wide';
  panel.id = DRAWER_ID;

  const header = document.createElement('div');
  header.className = 'drawer-header';

  const headerLeft = document.createElement('div');
  const title = document.createElement('span');
  title.className = 'drawer-title';
  title.textContent = FELD_TITEL[field] || 'Text';

  const quelle = field === 'transkript' ? QUELLE_LABELS[item.transkript_quelle] : null;
  const subtitle = document.createElement('p');
  subtitle.className = 'drawer-subtitle';
  subtitle.textContent = [`${text.length} Zeichen`, quelle].filter(Boolean).join(' · ');

  headerLeft.appendChild(title);
  headerLeft.appendChild(subtitle);

  const headerRight = document.createElement('div');
  const closeBtn = document.createElement('button');
  closeBtn.className = 'drawer-close-btn';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Schließen');
  closeBtn.innerHTML = '&times;';
  headerRight.appendChild(closeBtn);

  header.appendChild(headerLeft);
  header.appendChild(headerRight);

  const body = document.createElement('div');
  body.className = 'drawer-body';
  body.innerHTML = `
    <div class="longtext-content">${escapeHtml(text)}</div>
    <div class="drawer-footer">
      <button type="button" class="secondary-btn" id="btn-copy-longtext">In die Zwischenablage</button>
      <button type="button" class="primary-btn" id="btn-close-longtext">Fertig</button>
    </div>
  `;

  panel.appendChild(header);
  panel.appendChild(body);

  overlay.addEventListener('click', closeLongTextDrawer);
  closeBtn.addEventListener('click', closeLongTextDrawer);
  body.querySelector('#btn-close-longtext')?.addEventListener('click', closeLongTextDrawer);
  body.querySelector('#btn-copy-longtext')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text);
      window.toastSystem?.show('Kopiert', 'success');
    } catch (_) {
      window.toastSystem?.show('Kopieren nicht möglich', 'error');
    }
  });

  document.body.appendChild(overlay);
  document.body.appendChild(panel);
  requestAnimationFrame(() => { overlay.classList.add('active'); panel.classList.add('show'); });
}
