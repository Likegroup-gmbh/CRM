// Formular des Skript-Paket-Drawers: Empfänger zuerst, dann Skripte, Name/Rechte/Creator
// eingeklappt. Ohne Creator gilt das Kampagnen-Paket mit allen Skripten der Kampagne.

import { renderTableSelect } from '../../core/components/TableSelect.js';
import { mountShareEmailField } from '../../core/components/shareEmailField.js';
import { escapeHtml } from '../../core/format.js';
import { paketAuswahl, creatorOptionen, creatorAnzeigeName } from './skriptPaketModel.js';
import { STATUS_LABELS } from './SkripteUtils.js';
import { BLOCKED_TEXT } from '../share/shareRecipientPlan.js';

const RECHTE = [
  { value: 'ansehen', label: 'Nur ansehen' },
  { value: 'feedback', label: 'Ansehen + Bearbeiten' }
];

export function renderPaketForm(drawer) {
  const body = drawer.panel?.querySelector('#skript-paket-body');
  const submit = drawer.panel?.querySelector('#skript-paket-submit');
  if (!body || !submit) return;
  const nameDefault = drawer.standardName();
  const nameValue = drawer.share?.label
    || (!drawer.nameTouched ? nameDefault : (body.querySelector('#skript-paket-name')?.value || nameDefault));
  const rechte = drawer.share?.rechte || 'feedback';
  const link = drawer.share ? `${window.location.origin}/share/${drawer.share.token}` : '';
  const code = drawer.share ? drawer.codes[drawer.share.id] : '';
  const creatorOptions = [
    { value: '', label: 'Alle Creator' },
    ...creatorOptionen(drawer.skripte).map((c) => ({ value: c.id, label: creatorAnzeigeName(c) }))
  ];
  const optionenOffen = drawer.optionenOffen || Boolean(drawer.creatorId);

  body.innerHTML = `
    <section class="share-drawer-abschnitt">
      <h4 class="drawer-section-title">Empfänger</h4>
      <div class="form-group">
        <div id="skript-paket-email-field"></div>
        <p class="share-plan-note">${escapeHtml(BLOCKED_TEXT.paket)}</p>
        <div id="skript-paket-plan" class="share-recipient-plan"></div>
      </div>
    </section>
    <section class="share-drawer-abschnitt" id="skript-paket-liste"></section>
    <details class="share-drawer-abschnitt skript-paket-optionen" id="skript-paket-optionen" ${optionenOffen ? 'open' : ''}>
      <summary>Weitere Optionen</summary>
      <div class="skript-paket-optionen-body">
        <div class="form-group">
          <label class="form-label">Nur Skripte von</label>
          ${renderTableSelect({
            field: 'paket-creator',
            itemId: 'paket',
            value: drawer.creatorId || '',
            options: creatorOptions,
            placeholder: 'Alle Creator',
            matchWidth: true
          })}
        </div>
        <div class="form-group">
          <label class="form-label" for="skript-paket-name">Name des Zugangs</label>
          <input type="text" id="skript-paket-name" class="input" maxlength="80" value="${escapeHtml(nameValue)}">
        </div>
        <div class="form-group">
          <label class="form-label">Rechte</label>
          ${renderTableSelect({
            field: 'paket-rechte',
            itemId: 'paket',
            value: rechte,
            options: RECHTE,
            input: 'paket-rechte',
            matchWidth: true
          })}
        </div>
      </div>
    </details>
    ${drawer.share ? `
      <section class="share-drawer-abschnitt">
        <div class="share-code-banner">
          <p class="share-code-banner-title">Link</p>
          <p class="share-link-value">${escapeHtml(link)}</p>
          ${code ? `<p class="share-code-line">Code <span class="share-fresh-code">${escapeHtml(code)}</span></p>` : ''}
          <div class="skript-paket-aktionen">
            <button type="button" class="mdc-btn mdc-btn--secondary" data-copy-link>Gast-Link kopieren</button>
            <button type="button" class="mdc-btn mdc-btn--secondary" data-rotate>Code rotieren</button>
            <button type="button" class="mdc-btn mdc-btn--secondary" data-resend>Erneut senden</button>
            <button type="button" class="mdc-btn mdc-btn--secondary" data-revoke>Widerrufen</button>
          </div>
        </div>
      </section>` : ''}`;
  renderPaketListe(drawer);
  mountEmailField(drawer, body);
  bindPaketForm(drawer);
  drawer.emailField?.input.focus();
}

function mountEmailField(drawer, body) {
  drawer.emailField?.destroy();
  drawer.emailField = mountShareEmailField(body.querySelector('#skript-paket-email-field'), {
    emails: drawer.emails,
    vorschlaege: drawer.ansprechpartner,
    idPrefix: 'skript-paket',
    inputId: 'skript-paket-email',
    onChange: (emails) => {
      drawer.emails = emails;
      drawer.emailsTouched = true;
      updateSubmitLabel(drawer);
      drawer.refreshPaketPlan?.();
    },
  });
  updateSubmitLabel(drawer);
  drawer.refreshPaketPlan?.();
}

export function updateSubmitLabel(drawer) {
  const submit = drawer.panel?.querySelector('#skript-paket-submit');
  if (!submit) return;
  if (drawer.share) {
    submit.textContent = 'Speichern';
    return;
  }
  const anzahl = drawer.emails.length;
  submit.textContent = anzahl ? `An ${anzahl} Empfänger senden` : 'Zugang anlegen';
}

function anzahlText(drawer) {
  return drawer.checked.size === 1 ? '1 ausgewählt' : `${drawer.checked.size} ausgewählt`;
}

export function renderPaketListe(drawer) {
  const el = drawer.panel?.querySelector('#skript-paket-liste');
  if (!el) return;
  const auswahl = paketAuswahl({
    skripte: drawer.skripte,
    creatorId: drawer.creatorId,
    gespeichertIds: [...drawer.checked],
    hatZugang: true
  });
  const zeile = (skript, creatorText) => {
    const meta = [creatorText, STATUS_LABELS[skript.status] || skript.status].filter(Boolean).join(' · ');
    return `
    <label class="checkbox-label skript-paket-zeile">
      <input type="checkbox" data-skript-id="${skript.id}" ${drawer.checked.has(skript.id) ? 'checked' : ''}>
      <span>${skript.nr != null ? `${skript.nr}. ` : ''}${escapeHtml(skript.titel)}</span>
      ${meta ? `<span class="skript-paket-zeile-meta">${escapeHtml(meta)}</span>` : ''}
    </label>`;
  };
  const alleAn = () => auswahl.eigene.length > 0 && auswahl.eigene.every((s) => drawer.checked.has(s.id));
  const leer = drawer.creatorId
    ? 'Keine Skripte für diesen Creator.'
    : 'Diese Kampagne hat noch keine Skripte.';
  const weitereOffen = auswahl.weitere.some((s) => drawer.checked.has(s.id));
  el.innerHTML = `
    <div class="skript-paket-liste-kopf">
      <h4 class="drawer-section-title">Skripte <span class="skript-paket-anzahl" data-anzahl>${anzahlText(drawer)}</span></h4>
      ${auswahl.eigene.length > 1 ? `<button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-alle>${alleAn() ? 'Keine' : 'Alle'}</button>` : ''}
    </div>
    <div class="skript-paket-liste">
      ${auswahl.eigene.length
        ? auswahl.eigene.map((s) => zeile(s, drawer.creatorId ? '' : (s.creator ? creatorAnzeigeName(s.creator) : ''))).join('')
        : `<p class="share-dialog-empty">${escapeHtml(leer)}</p>`}
      ${auswahl.weitere.length ? `
        <button type="button" class="mdc-btn mdc-btn--secondary" id="skript-paket-weitere">Weitere Skripte der Kampagne</button>
        <div id="skript-paket-weitere-liste" class="skript-paket-liste" ${weitereOffen ? '' : 'hidden'}>
          ${auswahl.weitere.map((s) => zeile(s, s.creator ? creatorAnzeigeName(s.creator) : 'ohne Creator')).join('')}
        </div>` : ''}
    </div>`;
  const alleBtn = el.querySelector('[data-alle]');
  const aktualisiereKopf = () => {
    el.querySelector('[data-anzahl]').textContent = anzahlText(drawer);
    if (alleBtn) alleBtn.textContent = alleAn() ? 'Keine' : 'Alle';
  };
  el.querySelectorAll('input[type="checkbox"]').forEach((box) => {
    box.addEventListener('change', () => {
      if (box.checked) drawer.checked.add(box.dataset.skriptId);
      else drawer.checked.delete(box.dataset.skriptId);
      aktualisiereKopf();
    });
  });
  alleBtn?.addEventListener('click', () => {
    const an = !alleAn();
    auswahl.eigene.forEach((s) => (an ? drawer.checked.add(s.id) : drawer.checked.delete(s.id)));
    renderPaketListe(drawer);
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
  drawer.panel.querySelector('#skript-paket-optionen')?.addEventListener('toggle', (e) => {
    drawer.optionenOffen = e.currentTarget.open;
  });
  drawer.panel.querySelector('[data-copy-link]')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const url = `${window.location.origin}/share/${drawer.share.token}`;
    try {
      await navigator.clipboard?.writeText(url);
      btn.textContent = 'Kopiert';
    } catch (_) {
      window.toastSystem?.error('Link konnte nicht kopiert werden.');
    }
  });
  drawer.panel.querySelector('[data-rotate]')?.addEventListener('click', () => drawer.rotate());
  drawer.panel.querySelector('[data-resend]')?.addEventListener('click', () => drawer.resend());
  drawer.panel.querySelector('[data-revoke]')?.addEventListener('click', () => drawer.revoke());
}
