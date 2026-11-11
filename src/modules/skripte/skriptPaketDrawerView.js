// Formular des Skript-Paket-Drawers: Empfänger zuerst, dann Skripte, Name/Rechte/Creator
// eingeklappt. Ohne Creator gilt das Kampagnen-Paket mit allen freigegebenen Skripten.

import { renderTableSelect } from '../../core/components/TableSelect.js';
import {
  paketAuswahl, creatorOptionen, creatorAnzeigeName, isValidEmail, emailsAusText
} from './skriptPaketModel.js';
import { BLOCKED_TEXT } from '../share/shareRecipientPlan.js';

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
        <div class="tag-input-container">
          <div class="tag-input-wrapper">
            <div class="selected-tags" id="skript-paket-tags"></div>
            <input type="text" class="tag-input" id="skript-paket-email" placeholder="E-Mails eingeben oder einfügen …" autocomplete="off" aria-label="E-Mail-Adressen">
          </div>
          <div class="tag-suggestions" id="skript-paket-suggestions" style="display:none;"></div>
        </div>
        <div class="skript-paket-vorschlaege" id="skript-paket-vorschlaege" hidden></div>
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
  renderEmailTags(drawer);
  bindPaketForm(drawer);
  body.querySelector('#skript-paket-email')?.focus();
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
  const zeile = (skript, extra) => `
    <label class="checkbox-label skript-paket-zeile">
      <input type="checkbox" data-skript-id="${skript.id}" ${drawer.checked.has(skript.id) ? 'checked' : ''}>
      <span>${skript.nr != null ? `${skript.nr}. ` : ''}${escapeHtml(skript.titel)}</span>
      ${extra ? `<span class="skript-paket-zeile-meta">${escapeHtml(extra)}</span>` : ''}
    </label>`;
  const alleAn = () => auswahl.eigene.length > 0 && auswahl.eigene.every((s) => drawer.checked.has(s.id));
  const leer = drawer.creatorId
    ? 'Keine freigegebenen Skripte für diesen Creator.'
    : 'Noch kein Skript freigegeben. Teilen lässt sich nur, was freigegeben ist.';
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
  const input = drawer.panel.querySelector('#skript-paket-email');
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) return;
    if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
      e.preventDefault();
      if (addEmail(drawer, input.value, { warn: true })) {
        input.value = '';
        hideSuggestions(drawer);
      }
    } else if (e.key === 'Backspace' && !input.value && drawer.emails.length) {
      drawer.emails.pop();
      drawer.emailsTouched = true;
      renderEmailTags(drawer);
    }
  });
  input?.addEventListener('paste', (e) => {
    const text = e.clipboardData?.getData('text') || '';
    const gefunden = emailsAusText(text);
    if (!gefunden.length) return;
    e.preventDefault();
    addEmails(drawer, gefunden);
    input.value = '';
    hideSuggestions(drawer);
  });
  input?.addEventListener('input', () => {
    if (/[,;]/.test(input.value)) {
      const teile = input.value.split(/[,;]/);
      const rest = teile.pop();
      addEmails(drawer, teile.flatMap((teil) => emailsAusText(teil)));
      input.value = rest.trim();
    }
    schedulePartnerSearch(drawer, input.value.trim());
  });
  input?.addEventListener('blur', () => {
    const wert = input.value.trim().toLowerCase();
    if (isValidEmail(wert) && addEmail(drawer, wert, { warn: false })) input.value = '';
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

/** Fügt Adressen hinzu und rendert einmal. Gibt die Zahl neuer Adressen zurück. */
export function addEmails(drawer, list) {
  let neu = 0;
  for (const raw of list || []) {
    const email = String(raw || '').trim().toLowerCase();
    if (!isValidEmail(email) || drawer.emails.includes(email)) continue;
    drawer.emails.push(email);
    neu += 1;
  }
  if (neu) {
    drawer.emailsTouched = true;
    renderEmailTags(drawer);
  }
  return neu;
}

/** true, wenn die Eingabe eine gültige Adresse war (neu oder schon drin). */
export function addEmail(drawer, raw, { warn } = {}) {
  const email = String(raw || '').trim().toLowerCase();
  if (!email) return false;
  if (!isValidEmail(email)) {
    if (warn) window.toastSystem?.warning('Ungültige E-Mail-Adresse.');
    return false;
  }
  addEmails(drawer, [email]);
  return true;
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
  renderVorschlaege(drawer);
  updateSubmitLabel(drawer);
  drawer.refreshPaketPlan?.();
}

function renderVorschlaege(drawer) {
  const el = drawer.panel?.querySelector('#skript-paket-vorschlaege');
  if (!el) return;
  const offen = (drawer.ansprechpartner || []).filter((ap) => !drawer.emails.includes(ap.email));
  el.hidden = !offen.length;
  if (!offen.length) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = `
    <span class="skript-paket-vorschlaege-label">Ansprechpartner</span>
    ${offen.map((ap) => `
      <button type="button" class="skript-paket-vorschlag" data-email="${escapeHtml(ap.email)}" title="${escapeHtml(ap.email)}">+ ${escapeHtml(ap.name || ap.email)}</button>`).join('')}
    ${offen.length > 1 ? '<button type="button" class="skript-paket-vorschlag skript-paket-vorschlag--alle" data-alle-vorschlaege>Alle hinzufügen</button>' : ''}`;
  el.querySelectorAll('[data-email]').forEach((btn) => {
    btn.addEventListener('click', () => addEmails(drawer, [btn.dataset.email]));
  });
  el.querySelector('[data-alle-vorschlaege]')?.addEventListener('click', () => {
    addEmails(drawer, offen.map((ap) => ap.email));
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
  clearTimeout(drawer._emailSearchTimer);
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
      if (input) {
        input.value = '';
        input.focus();
      }
      hideSuggestions(drawer);
    });
  });
}
