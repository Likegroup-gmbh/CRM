// Formular des Skript-Paket-Drawers: Creator, Rechte, Skript-Chips, Mail-Tags.

import { renderTableSelect } from '../../core/components/TableSelect.js';
import { paketAuswahl, creatorOptionen, creatorAnzeigeName } from './skriptPaketModel.js';

const RECHTE = [
  { value: 'ansehen', label: 'Nur ansehen' },
  { value: 'feedback', label: 'Ansehen + Bearbeiten' }
];

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320;
}

export function renderPaketForm(drawer) {
  const body = drawer.panel?.querySelector('#skript-paket-body');
  const submit = drawer.panel?.querySelector('#skript-paket-submit');
  if (!body || !submit) return;
  const creator = drawer.currentCreator();
  const nameDefault = creator ? creatorAnzeigeName(creator) : '';
  const nameValue = drawer.share?.label
    || (!drawer.nameTouched ? nameDefault : (body.querySelector('#skript-paket-name')?.value || nameDefault));
  const rechte = drawer.share?.rechte || 'ansehen';
  const link = drawer.share ? `${window.location.origin}/share/${drawer.share.token}` : '';
  const code = drawer.share ? drawer.codes[drawer.share.id] : '';

  body.innerHTML = `
    <section class="share-drawer-abschnitt">
      <div class="form-group">
        <label class="form-label required">Creator</label>
        ${renderTableSelect({
          field: 'paket-creator',
          itemId: 'paket',
          value: drawer.creatorId || '',
          options: creatorOptionen(drawer.skripte).map((c) => ({ value: c.id, label: creatorAnzeigeName(c) })),
          placeholder: 'Creator wählen',
          disabled: Boolean(drawer.share),
          matchWidth: true
        })}
      </div>
      <div class="form-group">
        <label class="form-label required" for="skript-paket-name">Name des Zugangs</label>
        <input type="text" id="skript-paket-name" class="input" maxlength="80" value="${escapeHtml(nameValue)}">
      </div>
      <div class="form-group">
        <label class="form-label">Rechte</label>
        ${renderTableSelect({
          field: 'paket-rechte',
          itemId: 'paket',
          value: rechte,
          options: RECHTE,
          matchWidth: true
        })}
      </div>
    </section>
    <section class="share-drawer-abschnitt">
      <h4 class="drawer-section-title">Per E-Mail senden</h4>
      <div class="form-group">
        <label class="form-label" for="skript-paket-email">E-Mail-Adressen (optional)</label>
        <div class="tag-input-container">
          <div class="tag-input-wrapper">
            <div class="selected-tags" id="skript-paket-tags"></div>
            <input type="text" class="tag-input" id="skript-paket-email" placeholder="E-Mail eingeben …" autocomplete="off">
          </div>
          <div class="tag-suggestions" id="skript-paket-suggestions" style="display:none;"></div>
        </div>
      </div>
    </section>
    <section class="share-drawer-abschnitt skript-paket-liste" id="skript-paket-liste"></section>
    ${drawer.share ? `
      <section class="share-drawer-abschnitt">
        <div class="share-code-banner">
          <p class="share-code-banner-title">Link</p>
          <p class="share-link-value">${escapeHtml(link)}</p>
          ${code ? `<p class="share-code-line">Code <span class="share-fresh-code">${escapeHtml(code)}</span></p>` : ''}
          <div class="skript-paket-aktionen">
            <button type="button" class="mdc-btn mdc-btn--secondary" data-copy-link>Link kopieren</button>
            <button type="button" class="mdc-btn mdc-btn--secondary" data-rotate>Code rotieren</button>
            <button type="button" class="mdc-btn mdc-btn--secondary" data-resend>Erneut senden</button>
            <button type="button" class="mdc-btn mdc-btn--secondary" data-revoke>Widerrufen</button>
          </div>
        </div>
      </section>` : ''}`;
  submit.textContent = drawer.share ? 'Speichern' : 'Teilen';
  renderPaketListe(drawer);
  renderEmailTags(drawer);
  bindPaketForm(drawer);
}

export function renderPaketListe(drawer) {
  const el = drawer.panel?.querySelector('#skript-paket-liste');
  if (!el) return;
  if (!drawer.creatorId) {
    el.innerHTML = '<p class="share-dialog-empty">Wähle einen Creator. Danach stehen seine freigegebenen Skripte hier.</p>';
    return;
  }
  const auswahl = paketAuswahl({
    skripte: drawer.skripte,
    creatorId: drawer.creatorId,
    gespeichertIds: [...drawer.checked],
    hatZugang: true
  });
  const zeile = (skript, extra) => `
    <label class="checkbox-label skript-paket-zeile">
      <input type="checkbox" data-skript-id="${skript.id}" ${drawer.checked.has(skript.id) ? 'checked' : ''}>
      <span>${skript.nr != null ? `${skript.nr}. ` : ''}${escapeHtml(skript.titel)}</span>
      ${extra ? `<span class="skript-paket-zeile-meta">${escapeHtml(extra)}</span>` : ''}
    </label>`;
  const weitereOffen = auswahl.weitere.some((s) => drawer.checked.has(s.id));
  el.innerHTML = `
    <h4 class="drawer-section-title">Skripte</h4>
    <div class="skript-paket-liste">
      ${auswahl.eigene.length
        ? auswahl.eigene.map((s) => zeile(s)).join('')
        : '<p class="share-dialog-empty">Keine freigegebenen Skripte für diesen Creator.</p>'}
      ${auswahl.weitere.length ? `
        <button type="button" class="mdc-btn mdc-btn--secondary" id="skript-paket-weitere">Weitere Skripte der Kampagne</button>
        <div id="skript-paket-weitere-liste" class="skript-paket-liste" ${weitereOffen ? '' : 'hidden'}>
          ${auswahl.weitere.map((s) => zeile(s, s.creator ? creatorAnzeigeName(s.creator) : 'ohne Creator')).join('')}
        </div>` : ''}
    </div>`;
  el.querySelectorAll('input[type="checkbox"]').forEach((box) => {
    box.addEventListener('change', () => {
      if (box.checked) drawer.checked.add(box.dataset.skriptId);
      else drawer.checked.delete(box.dataset.skriptId);
    });
  });
  el.querySelector('#skript-paket-weitere')?.addEventListener('click', () => {
    const liste = el.querySelector('#skript-paket-weitere-liste');
    if (liste) liste.hidden = !liste.hidden;
  });
}

function bindPaketForm(drawer) {
  drawer.panel.querySelector('#skript-paket-name')?.addEventListener('input', () => {
    drawer.nameTouched = true;
  });
  const input = drawer.panel.querySelector('#skript-paket-email');
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addEmail(drawer, input.value, { warn: true });
      input.value = '';
    } else if (e.key === 'Backspace' && !input.value && drawer.emails.length) {
      drawer.emails.pop();
      drawer.emailsTouched = true;
      renderEmailTags(drawer);
    }
  });
  input?.addEventListener('input', () => {
    if (input.value.includes(',')) {
      input.value.split(',').forEach((part) => addEmail(drawer, part, { warn: false }));
      input.value = '';
    }
    schedulePartnerSearch(drawer, input.value.trim());
  });
  drawer.panel.querySelector('[data-copy-link]')?.addEventListener('click', async (e) => {
    const url = `${window.location.origin}/share/${drawer.share.token}`;
    try {
      await navigator.clipboard?.writeText(url);
      e.currentTarget.textContent = 'Kopiert';
    } catch (_) {
      window.toastSystem?.error('Link konnte nicht kopiert werden.');
    }
  });
  drawer.panel.querySelector('[data-rotate]')?.addEventListener('click', () => drawer.rotate());
  drawer.panel.querySelector('[data-resend]')?.addEventListener('click', () => drawer.resend());
  drawer.panel.querySelector('[data-revoke]')?.addEventListener('click', () => drawer.revoke());
}

export function addEmail(drawer, raw, { warn } = {}) {
  const email = String(raw || '').trim().toLowerCase();
  if (!email) return;
  if (!isValidEmail(email)) {
    if (warn) window.toastSystem?.warning('Ungültige E-Mail-Adresse.');
    return;
  }
  drawer.emailsTouched = true;
  if (!drawer.emails.includes(email)) drawer.emails.push(email);
  renderEmailTags(drawer);
}

function renderEmailTags(drawer) {
  const el = drawer.panel?.querySelector('#skript-paket-tags');
  if (!el) return;
  el.innerHTML = drawer.emails.map((email) => `
    <span class="tag-item">
      ${escapeHtml(email)}
      <span class="tag-remove" data-email="${escapeHtml(email)}">&times;</span>
    </span>`).join('');
  el.querySelectorAll('.tag-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      drawer.emails = drawer.emails.filter((email) => email !== btn.dataset.email);
      drawer.emailsTouched = true;
      renderEmailTags(drawer);
    });
  });
}

function schedulePartnerSearch(drawer, term) {
  clearTimeout(drawer._emailSearchTimer);
  if (!term) {
    hideSuggestions(drawer);
    return;
  }
  drawer._emailSearchTimer = setTimeout(() => searchPartners(drawer, term), 200);
}

function hideSuggestions(drawer) {
  drawer._emailSearchGen += 1;
  const suggestions = drawer.panel?.querySelector('#skript-paket-suggestions');
  if (!suggestions) return;
  suggestions.style.display = 'none';
  suggestions.innerHTML = '';
}

async function searchPartners(drawer, term) {
  const suggestions = drawer.panel?.querySelector('#skript-paket-suggestions');
  if (!suggestions) return;
  const safe = term.replace(/[,()%]/g, '').slice(0, 80);
  if (!safe) return hideSuggestions(drawer);
  const gen = ++drawer._emailSearchGen;
  const { data } = await window.supabase
    .from('ansprechpartner')
    .select('id, vorname, nachname, email, unternehmen:unternehmen_id(firmenname)')
    .or(`vorname.ilike.%${safe}%,nachname.ilike.%${safe}%,email.ilike.%${safe}%`)
    .order('nachname');
  if (gen !== drawer._emailSearchGen || !drawer.panel) return;
  const rows = (data || []).filter((ap) => {
    const email = String(ap.email || '').trim().toLowerCase();
    return email && isValidEmail(email) && !drawer.emails.includes(email);
  }).slice(0, 8);
  if (!rows.length) {
    suggestions.innerHTML = '<div class="suggestion-hint">Keine Vorschläge</div>';
    suggestions.style.display = 'block';
    return;
  }
  suggestions.innerHTML = rows.map((ap) => {
    const name = `${ap.vorname || ''} ${ap.nachname || ''}`.trim();
    const email = String(ap.email).trim();
    return `<div class="suggestion-item" data-email="${escapeHtml(email)}">${escapeHtml(name || email)}
      <span class="suggestion-item-meta">${escapeHtml(email)}</span></div>`;
  }).join('');
  suggestions.style.display = 'block';
  suggestions.querySelectorAll('.suggestion-item').forEach((item) => {
    item.addEventListener('click', () => {
      addEmail(drawer, item.dataset.email, { warn: false });
      const input = drawer.panel.querySelector('#skript-paket-email');
      if (input) input.value = '';
      hideSuggestions(drawer);
    });
  });
}
