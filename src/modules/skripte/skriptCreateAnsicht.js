// Hinweise und Übersicht im Skript-Create-Drawer.

import { escapeHtml } from './SkripteUtils.js';
import { truncateText } from '../strategie/strategieItemPicker.js';
import { funnelWarnung, personaWarnung } from './skriptCreateKontext.js';
import { closeSkriptCreateDrawer } from './SkriptCreateDrawer.js';

export function creatorName(item) {
  const eintrag = item?.casting_eintrag;
  if (eintrag?.name) return eintrag.name;
  const c = eintrag?.creator;
  const crmName = c ? `${c.vorname || ''} ${c.nachname || ''}`.trim() : '';
  if (crmName) return crmName;
  return item?.creator_name || 'Kein Creator';
}

export function renderFunnelWarnung(drawer, item) {
  const el = drawer.el('funnel-hint');
  if (!el) return;
  const text = funnelWarnung(item);
  el.textContent = text;
  el.hidden = !text;
}

export function renderPersonaWarnung(drawer, item) {
  const el = drawer.el('persona-hint');
  if (!el) return;
  const text = personaWarnung(item);
  el.textContent = text;
  el.hidden = !text;
}

export function renderHinweisVorhanden(drawer, item) {
  const hint = drawer.el('videoidee-hint');
  if (!hint || !drawer.items.length) return;
  if (!item?.hasSkript) {
    hint.textContent = 'Nur Ideen, die im Konzept ausdrücklich freigegeben wurden.';
    return;
  }
  const nr = item.skript_nr ? `Nr. ${item.skript_nr}` : 'Diese Idee';
  hint.textContent = `${nr} hat schon ${item.skripte.length === 1 ? 'ein Skript' : `${item.skripte.length} Skripte`}. Beim Erstellen entsteht ein weiteres.`;
}

export function renderCreateUebersicht(drawer) {
  const box = drawer.el('uebersicht');
  const liste = drawer.el('uebersicht-liste');
  if (!box || !liste) return;
  if (!drawer.items.length) {
    box.hidden = true;
    liste.innerHTML = '';
    return;
  }

  const sortiert = [...drawer.items].sort((a, b) => (a.skript_nr ?? Infinity) - (b.skript_nr ?? Infinity));
  liste.innerHTML = sortiert.map((item) => {
    const nr = item.skript_nr ? `${item.skript_nr}.` : '–';
    const skripte = item.skripte || [];
    const status = skripte.length
      ? skripte.map((s) => `<a href="/skripte/${escapeHtml(s.id)}" class="table-link" data-skript-id="${escapeHtml(s.id)}">${escapeHtml(s.status_label)}</a>`).join(', ')
      : '<span class="skripte-hint">Noch kein Skript</span>';
    return `
      <li class="skripte-create-uebersicht-zeile${skripte.length ? ' ist-generiert' : ''}">
        <span class="skripte-create-uebersicht-nr">${nr}</span>
        <span class="skripte-create-uebersicht-text" title="${escapeHtml(truncateText(item.beschreibung || item.kurzbeschreibung, 200))}">
          ${escapeHtml(creatorName(item))} · ${escapeHtml(truncateText(item.beschreibung || item.kurzbeschreibung, 60))}
        </span>
        <span class="skripte-create-uebersicht-status">${status}</span>
      </li>`;
  }).join('');
  box.hidden = false;

  liste.querySelectorAll('a[data-skript-id]').forEach((a) => {
    a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      e.preventDefault();
      const id = a.dataset.skriptId;
      closeSkriptCreateDrawer();
      window.navigateTo?.(`/skripte/${id}`);
    });
  });
}

export function renderCreateCreator(drawer, item) {
  const box = drawer.el('kontext');
  const el = drawer.el('creator-anzeige');
  if (!box) return;
  if (!item) {
    box.hidden = true;
    if (el) el.textContent = '–';
    return;
  }
  if (el) el.textContent = creatorName(item);
  box.hidden = false;
}
