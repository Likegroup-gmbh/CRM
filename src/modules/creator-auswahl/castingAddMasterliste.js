// Tab "Aus Masterliste" im Drawer "Creator hinzufügen".
// Eine Masterliste wählen, Creator anhaken, alle gewählten auf einmal
// ins Casting legen. Profilfelder kommen mit, Preise bleiben leer.

import { creatorAuswahlService } from './CreatorAuswahlService.js';
import { mapMember } from '../creator/masterliste.js';
import { bestandErgebnisText } from './bestandZuCasting.js';
import { OHNE_KATEGORIE } from './castingKategorien.js';
import { escapeAttr } from '../../core/VideoUploadUtils.js';
import {
  gefiltertePersonen,
  masterlisteLabel,
  personLabel,
  personenFuerCasting
} from './masterlisteZuCasting.js';

const LISTEN_SELECT = 'id, name, unternehmen:unternehmen_id(firmenname)';
const MEMBER_SELECT = `
  id, ig_username, sourcing_creator_id,
  name, typ, follower_instagram, link_tiktok, follower_tiktok, wohnort, email, telefon,
  pool:sourcing_creator_id (
    name, link_instagram, follower_instagram,
    profile_image_url, profile_image_thumb_url, email, telefon, wohnort
  ),
  creator:creator_id (
    id, vorname, nachname, instagram, tiktok,
    instagram_follower, tiktok_follower, lieferadresse_stadt,
    mail, telefonnummer, profilbild_url, profilbild_thumb_url,
    creator_types:creator_creator_type(creator_type:creator_type_id(name))
  )
`;

function escapeText(value) {
  return escapeAttr(value);
}

export function renderMasterlisteTab() {
  const kategorien = this.detail?.getTeilbereiche?.() || [];
  const kategorieFeld = kategorien.length ? `
    <div class="form-field">
      <label class="form-label" for="masterliste-kategorie">Kategorie</label>
      <select id="masterliste-kategorie" name="kategorie" class="form-input">
        <option value="">${OHNE_KATEGORIE}</option>
        ${kategorien.map(name => `<option value="${escapeText(name)}">${escapeText(name)}</option>`).join('')}
      </select>
    </div>
  ` : '';

  return `
    <form id="masterliste-casting-form">
      <div class="form-field">
        <label class="form-label" for="masterliste-quelle">Masterliste</label>
        <select id="masterliste-quelle" class="form-input">
          <option value="">Masterlisten werden geladen…</option>
        </select>
      </div>
      <div class="form-field" id="masterliste-filter-feld" hidden>
        <label class="form-label" for="masterliste-filter">In der Liste suchen</label>
        <input id="masterliste-filter" class="form-input" type="search" placeholder="Name oder Instagram" autocomplete="off">
      </div>
      <p id="masterliste-status" class="form-hint">Masterlisten werden geladen…</p>
      <div id="masterliste-liste" class="casting-masterliste-liste"></div>
      ${kategorieFeld}
      <p class="form-hint">Profilfelder werden übernommen. Preise bleiben leer und lassen sich danach in der Tabelle setzen.</p>
      <div class="drawer-footer">
        <button type="button" class="mdc-btn mdc-btn--cancel" data-action="close-drawer">
          <span class="mdc-btn__label">Abbrechen</span>
        </button>
        <button type="submit" class="mdc-btn mdc-btn--create" id="masterliste-submit" disabled>
          <span class="mdc-btn__label">Hinzufügen</span>
        </button>
      </div>
    </form>
  `;
}

export function bindMasterlisteTab() {
  const form = document.getElementById('masterliste-casting-form');
  if (!form) return;
  this._ml = { personen: [], auswahl: new Set(), req: 0, busy: false, listen: [] };

  form.querySelector('[data-action="close-drawer"]')?.addEventListener('click', () => this.close());
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    this.uebernimmMasterliste();
  });
  form.addEventListener('change', (event) => {
    const ziel = event.target;
    if (ziel.id === 'masterliste-quelle') this.ladeMasterlisteMitglieder(ziel.value);
    else if (ziel.id === 'masterliste-alle') this.waehleSichtbareMasterliste(ziel.checked);
    else if (ziel.matches('[data-member-id]')) this.toggleMasterlistePerson(ziel.dataset.memberId, ziel.checked);
  });
  form.addEventListener('input', (event) => {
    if (event.target.id === 'masterliste-filter') this.zeichneMasterliste();
    if (!event.target.classList?.contains('searchable-select-input') || event.target.value) return;
    const select = form.querySelector('#masterliste-quelle');
    if (!select?.value) return;
    select.value = '';
    this.ladeMasterlisteMitglieder('');
  });
  this.ladeMasterlisten();
}

export async function ladeMasterlisten() {
  const select = document.getElementById('masterliste-quelle');
  const status = document.getElementById('masterliste-status');
  if (!select) return;
  const { data, error } = await window.supabase
    .from('creator_list')
    .select(LISTEN_SELECT)
    .order('name', { ascending: true });
  if (!select.isConnected) return;
  if (error) {
    if (status) status.textContent = 'Masterlisten konnten nicht geladen werden.';
    return;
  }
  const listen = data || [];
  this._ml.listen = listen;
  select.innerHTML = `<option value="">${listen.length ? 'Masterliste wählen…' : 'Keine Masterlisten'}</option>`
    + listen.map(row => `<option value="${escapeText(row.id)}">${escapeText(masterlisteLabel(row))}</option>`).join('');
  if (status) status.textContent = listen.length ? 'Bitte eine Masterliste wählen.' : 'Es gibt noch keine Masterliste.';
  if (listen.length && window.formSystem?.createSimpleSearchableSelect) {
    window.formSystem.createSimpleSearchableSelect(select, listen.map(row => ({
      value: row.id,
      label: masterlisteLabel(row)
    })), { placeholder: 'Masterliste suchen…' });
  }
}

export async function ladeMasterlisteMitglieder(listId) {
  const status = document.getElementById('masterliste-status');
  const filterFeld = document.getElementById('masterliste-filter-feld');
  this._ml.auswahl = new Set();
  this._ml.personen = [];
  const filter = document.getElementById('masterliste-filter');
  if (filter) filter.value = '';
  this.zeichneMasterliste();
  if (!listId) {
    if (filterFeld) filterFeld.hidden = true;
    if (status) status.hidden = false;
    if (status) status.textContent = 'Bitte eine Masterliste wählen.';
    return;
  }
  const req = ++this._ml.req;
  if (status) {
    status.hidden = false;
    status.textContent = 'Creator werden geladen…';
  }
  const { data, error } = await window.supabase
    .from('creator_list_member')
    .select(MEMBER_SELECT)
    .eq('list_id', listId);
  if (req !== this._ml.req) return;
  if (error) {
    if (status) status.textContent = 'Die Creator dieser Masterliste konnten nicht geladen werden.';
    return;
  }
  const vorhandene = (this.detail?.items || []).map(item => ({
    creator_id: item.creator_id,
    name: item.name,
    link_instagram: item.link_instagram
  }));
  this._ml.personen = personenFuerCasting((data || []).map(mapMember), vorhandene);
  if (filterFeld) filterFeld.hidden = this._ml.personen.length === 0;
  if (status) {
    status.hidden = this._ml.personen.length > 0;
    status.textContent = 'Diese Masterliste hat noch keine Creator.';
  }
  this.zeichneMasterliste();
}

export function zeichneMasterliste() {
  const liste = document.getElementById('masterliste-liste');
  if (!liste) return;
  const filter = document.getElementById('masterliste-filter')?.value || '';
  const sichtbar = gefiltertePersonen(this._ml?.personen || [], filter);
  const waehlbar = sichtbar.filter(person => !person.schonDa);
  const alleAn = waehlbar.length > 0 && waehlbar.every(person => this._ml.auswahl.has(person.memberId));

  const kopf = waehlbar.length ? `
    <label class="casting-masterliste-zeile">
      <input type="checkbox" id="masterliste-alle" ${alleAn ? 'checked' : ''}>
      <span>Alle auswählbaren</span>
    </label>
  ` : '';
  liste.innerHTML = kopf + sichtbar.map(person => {
    const gewaehlt = this._ml.auswahl.has(person.memberId);
    const hinweis = person.schonDa ? ' <span class="text-muted">schon auf diesem Casting</span>' : '';
    return `
      <label class="casting-masterliste-zeile${person.schonDa ? ' is-disabled' : ''}">
        <input type="checkbox" data-member-id="${escapeText(person.memberId)}" ${gewaehlt ? 'checked' : ''} ${person.schonDa ? 'disabled' : ''}>
        <span>${escapeText(personLabel(person))}${hinweis}</span>
      </label>
    `;
  }).join('');
  this.aktualisiereMasterlisteSubmit();
}

export function waehleSichtbareMasterliste(an) {
  const filter = document.getElementById('masterliste-filter')?.value || '';
  for (const person of gefiltertePersonen(this._ml.personen, filter)) {
    if (person.schonDa) continue;
    if (an) this._ml.auswahl.add(person.memberId);
    else this._ml.auswahl.delete(person.memberId);
  }
  this.zeichneMasterliste();
}

export function toggleMasterlistePerson(memberId, an) {
  if (an) this._ml.auswahl.add(memberId);
  else this._ml.auswahl.delete(memberId);
  this.aktualisiereMasterlisteSubmit();
  const alle = document.getElementById('masterliste-alle');
  if (!alle) return;
  const filter = document.getElementById('masterliste-filter')?.value || '';
  const waehlbar = gefiltertePersonen(this._ml.personen, filter).filter(person => !person.schonDa);
  alle.checked = waehlbar.length > 0 && waehlbar.every(person => this._ml.auswahl.has(person.memberId));
}

export function aktualisiereMasterlisteSubmit() {
  const button = document.getElementById('masterliste-submit');
  if (!button) return;
  const anzahl = this._ml?.auswahl.size || 0;
  button.disabled = !anzahl || this._ml?.busy;
  const label = button.querySelector('.mdc-btn__label');
  if (label) label.textContent = anzahl ? `${anzahl} hinzufügen` : 'Hinzufügen';
}

export async function uebernimmMasterliste() {
  if (!this._ml || this._ml.busy || !this._ml.auswahl.size) return;
  const personen = this._ml.personen.filter(person => this._ml.auswahl.has(person.memberId) && !person.schonDa);
  if (!personen.length) return;
  const kategorie = document.getElementById('masterliste-kategorie')?.value || null;
  const button = document.getElementById('masterliste-submit');

  this._ml.busy = true;
  if (button) button.disabled = true;
  try {
    const { added, skipped } = await creatorAuswahlService.addBestandPersonen(this.detail.listeId, personen, kategorie);
    const text = bestandErgebnisText({ added: added.length, skipped: skipped.length });
    if (!added.length) {
      window.toastSystem?.show(text, 'warning');
      return;
    }
    this.detail.items = await creatorAuswahlService.getItems(this.detail.listeId);
    await this.detail.customColumns?.loadValues?.(this.detail.items.map(item => item.id));
    window.toastSystem?.show(text, 'success');
    this.close();
    this.detail.rerenderTable?.();
  } catch (error) {
    console.error('Casting: Hinzufügen aus der Masterliste fehlgeschlagen', error);
    window.toastSystem?.show(error.message || 'Hinzufügen fehlgeschlagen', 'error');
  } finally {
    if (this._ml) this._ml.busy = false;
    this.aktualisiereMasterlisteSubmit();
  }
}

export function installCastingMasterlisteTab(proto) {
  Object.assign(proto, {
    renderMasterlisteTab,
    bindMasterlisteTab,
    ladeMasterlisten,
    ladeMasterlisteMitglieder,
    zeichneMasterliste,
    waehleSichtbareMasterliste,
    toggleMasterlistePerson,
    aktualisiereMasterlisteSubmit,
    uebernimmMasterliste
  });
}
