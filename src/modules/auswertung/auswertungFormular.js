// auswertungFormular.js
// Prüfformular eines Posts (Spec 7.5): Kopf, Herkunft, Plattform, Datei, Account, Gepostet und
// Gemessen (Warnung unter der Messregel, kein Blocker), Kennzahlen der Plattform mit „bitte prüfen“
// für unsichere KI-Werte. Rendern und Einlesen sind rein; die Aktionen bindet auswertungErfassen.

import { CustomDatePicker } from '../../core/components/CustomDatePicker.js';
import { renderTableSelect, tableSelect } from '../../core/components/TableSelect.js';
import { formatExactNumber } from '../../core/format/compactNumber.js';
import { icon } from '../../core/icons/IconSystem.js';
import { KENNZAHLEN, MESSREGEL_TAGE, PLATTFORMEN, felderDerPlattform } from './auswertungKonfig.js';
import { esc, herkunftText, plural, unsichereFelder } from './auswertungFormat.js';
import { eintragSub, renderStatusChip } from './auswertungArbeitsliste.js';
import { ART_ICON, postDatei } from './auswertungTabelle.js';

const TAG_MS = 24 * 60 * 60 * 1000;
const DEZIMAL = new Set(['avgWatchSec', 'completionPct']);
export const PFLICHT = ['views'];

const heuteIso = () => new Date().toISOString().slice(0, 10);

/** Eingabe einer Kennzahl lesen: „31.504“ und „31 504“ bei Zählwerten, „12,5“ bei Sekunden und Prozent. NaN, wenn unlesbar. */
export function zahlAusEingabe(text, key) {
  const s = String(text ?? '').trim().replace(/[\s%]/g, '').replace(/s(ek\.?)?$/i, '');
  if (!s) return null;
  if (DEZIMAL.has(key)) {
    const n = Number(s.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || (key === 'completionPct' && n > 100)) return NaN;
    return Math.round(n * 10) / 10;
  }
  if (!/^\d{1,3}([.,]\d{3})*$|^\d+$/.test(s)) return NaN;
  return Number(s.replace(/[.,]/g, ''));
}

export function zahlAnzeige(wert, key) {
  if (typeof wert !== 'number' || !Number.isFinite(wert)) return '';
  return DEZIMAL.has(key) ? wert.toLocaleString('de-DE', { maximumFractionDigits: 1 }) : formatExactNumber(wert);
}

/** Tage zwischen Post und Messung, negativ, wenn die Messung davor liegt. */
function tageDazwischen(postedAt, measuredAt) {
  if (!postedAt || !measuredAt) return null;
  const diff = Date.parse(measuredAt) - Date.parse(postedAt);
  return Number.isFinite(diff) ? Math.round(diff / TAG_MS) : null;
}

export function messWarnung(postedAt, measuredAt) {
  const tage = tageDazwischen(postedAt, measuredAt);
  if (tage == null) return '';
  if (tage < 0) return 'Gemessen liegt vor Gepostet. Bitte die Daten prüfen.';
  if (tage >= MESSREGEL_TAGE) return '';
  return `Die Zahlen wurden ${plural(tage, 'Tag', 'Tage')} nach dem Post erfasst, die Messregel sind ${MESSREGEL_TAGE} Tage. Ggf. später neu erfassen.`;
}

/**
 * Formularwerte. Kennzahlen kommen nur aus den sichtbaren Feldern, also nur die der gewählten
 * Plattform; Werte anderer Plattformen fallen beim Speichern weg (Spec 7.5).
 */
export function liesFormular(form) {
  const feld = (name) => form.querySelector(`[name="${name}"]`);
  const datum = (name) => CustomDatePicker.getValue(feld(name)) || null;
  const metrics = {};
  form.querySelectorAll('[data-kennzahl]').forEach((input) => {
    const wert = zahlAusEingabe(input.value, input.dataset.kennzahl);
    if (wert != null) metrics[input.dataset.kennzahl] = wert;
  });
  const teil = {
    plattform: feld('plattform')?.value || null,
    accountHandle: String(feld('accountHandle')?.value || '').trim().replace(/^@/, '').toLowerCase() || null,
    postedAt: datum('postedAt'),
    measuredAt: datum('measuredAt'),
    link: String(feld('link')?.value || '').trim() || null,
    metrics
  };
  const datei = feld('dateiId');
  if (datei) teil.dateiId = datei.value || null;
  return teil;
}

/** Erstes fehlendes oder unlesbares Pflicht- bzw. Zahlenfeld: { name, text }, sonst null. */
export function pflichtFehler(teil) {
  if (!teil.plattform || !PLATTFORMEN[teil.plattform]) return { name: 'plattform', text: 'Plattform wählen.' };
  const ungueltig = Object.entries(teil.metrics).find(([, v]) => Number.isNaN(v));
  if (ungueltig) return { name: `m:${ungueltig[0]}`, text: `${KENNZAHLEN[ungueltig[0]]?.label || ungueltig[0]}: keine gültige Zahl.` };
  if (typeof teil.metrics.views !== 'number') return { name: 'm:views', text: 'Aufrufe fehlen.' };
  if (!teil.postedAt) return { name: 'postedAt', text: 'Datum „Gepostet am“ fehlt.' };
  return null;
}

/**
 * Was beim Bestätigen gespeichert wird. Gelesene Felder behalten ihren Schlüssel in confidence,
 * mit 1 statt Unsicherheit: ein späterer Abruf überschreibt Werte aus dem Screenshot nicht (ADR 0078).
 */
export function bestaetigungsTeil(post, teil) {
  const felder = new Set(felderDerPlattform(teil.plattform));
  const metrics = Object.fromEntries(Object.entries(teil.metrics).filter(([k, v]) => felder.has(k) && Number.isFinite(v)));
  const gelesen = Object.keys(post?.confidence || {}).filter(k => k in metrics);
  return { ...teil, metrics, confidence: gelesen.length ? Object.fromEntries(gelesen.map(k => [k, 1])) : null };
}

function kennzahlFeld(key, wert, { unsicher }) {
  const konfig = KENNZAHLEN[key] || { label: key };
  const pflicht = PFLICHT.includes(key);
  return `
    <label class="erfassen-feld${unsicher ? ' is-unsicher' : ''}" data-feld="${esc(key)}">
      <span class="erfassen-feld__label">
        ${esc(konfig.label)}${pflicht ? ' <span aria-hidden="true">*</span>' : ''}
        ${unsicher ? '<span class="erfassen-feld__pruefen" data-pruefen>bitte prüfen</span>' : ''}
      </span>
      <span class="erfassen-feld__eingabe">
        <input class="form-input" name="m:${esc(key)}" data-kennzahl="${esc(key)}" value="${esc(zahlAnzeige(wert, key))}"
               inputmode="${DEZIMAL.has(key) ? 'decimal' : 'numeric'}" autocomplete="off"${pflicht ? ' aria-required="true"' : ''}>
        ${konfig.einheit ? `<span class="erfassen-feld__einheit">${esc(konfig.einheit)}</span>` : ''}
      </span>
    </label>`;
}

/** Kennzahlen einer Plattform; `werte` sind die bisher eingegebenen, gleiche Felder bleiben. */
export function renderKennzahlFelder(plattform, werte = {}, unsicher = []) {
  return felderDerPlattform(plattform).map(key => kennzahlFeld(key, werte[key], { unsicher: unsicher.includes(key) })).join('');
}

/** Eigenes Dropdown (TableSelect im Formular-Modus): hidden input `name` hält den Wert, Wechsel kommt als table-select-change. */
function auswahl(name, label, optionen, wert) {
  return `
    <div class="erfassen-feld">
      <span class="erfassen-feld__label">${esc(label)}</span>
      ${renderTableSelect({
        field: name,
        itemId: 'erfassen',
        value: wert,
        options: optionen.map(([value, l]) => ({ value, label: l })),
        input: name,
        matchWidth: true
      })}
    </div>`;
}

/** Wert eines Formularfelds setzen; beim eigenen Dropdown Label und Haken mitziehen. */
export function setzeFeldWert(el, wert) {
  const wrapper = el.closest('[data-table-select]');
  const item = wrapper && [...wrapper.querySelectorAll('.table-select__panel .table-select__item')].find(i => i.dataset.value === String(wert));
  if (item) tableSelect.syncForm(wrapper, item, String(wert));
  else el.value = wert;
}

function datumFeld(name, label, wert) {
  return `
    <div class="erfassen-feld">
      <span class="erfassen-feld__label">${esc(label)}${name === 'postedAt' ? ' <span aria-hidden="true">*</span>' : ''}</span>
      ${CustomDatePicker.render({ id: `erfassen-${name}`, field: name, name, value: wert || '', label, variant: 'text', inputClass: 'form-input' })}
    </div>`;
}

export function renderKopf(eintrag) {
  const { einheit, post, status } = eintrag;
  const datei = postDatei(einheit, post);
  return `
    <header class="erfassen-kopf">
      <span class="auswertung-poster"${datei ? ` data-poster="${esc(datei.id)}"` : ''}>${icon(ART_ICON[einheit.art] || 'film', { size: 14 })}</span>
      <div class="erfassen-kopf__text">
        <h4 class="erfassen-kopf__titel">${esc(einheit.titel || einheit.label)}</h4>
        <p class="erfassen-kopf__sub">${esc(eintragSub(einheit, post))}</p>
        ${post ? `<p class="erfassen-kopf__herkunft">${esc(herkunftText(post))}</p>` : ''}
      </div>
      ${renderStatusChip(status)}
    </header>`;
}

/**
 * Felder des Posts. `werte` überschreibt die gespeicherten Kennzahlen (Plattformwechsel, offene Eingaben).
 * @param {{ einheit: object, post: object }} eintrag
 */
export function renderFelder(eintrag, { werte = null } = {}) {
  const { einheit, post } = eintrag;
  const dateien = einheit.dateien || [];
  const plattformen = Object.entries(PLATTFORMEN).map(([k, p]) => [k, p.label]);
  const measured = post.measuredAt || (post.source === 'manuell' ? heuteIso() : '');
  // Das geplante Postdatum als Vorschlag, aber nur, wenn es schon vorbei ist
  const geplant = einheit.gepostetAm && einheit.gepostetAm <= heuteIso() ? einheit.gepostetAm : '';
  const gepostet = post.postedAt || geplant;
  return `
    <div class="erfassen-felder" data-erfassen-felder>
      <div class="erfassen-felder__reihe">
        ${auswahl('plattform', 'Plattform', plattformen, post.plattform)}
        ${dateien.length > 1 ? auswahl('dateiId', 'Gepostete Datei', dateien.map(d => [d.id, [d.ratio, d.name].filter(Boolean).join(' · ') || 'Datei']), post.dateiId || dateien[0].id) : ''}
        <label class="erfassen-feld">
          <span class="erfassen-feld__label">Account</span>
          <input class="form-input" name="accountHandle" value="${esc(post.accountHandle || '')}" placeholder="${esc(einheit.creator?.handle || 'handle')}" autocomplete="off" spellcheck="false">
        </label>
      </div>
      <div class="erfassen-felder__reihe">
        ${datumFeld('postedAt', 'Gepostet am', gepostet)}
        ${datumFeld('measuredAt', 'Gemessen am', measured)}
      </div>
      <p class="erfassen-warnung" data-erfassen-messwarnung${messWarnung(gepostet, measured) ? '' : ' hidden'}>
        ${icon('exclamation-triangle', { size: 14 })}<span>${esc(messWarnung(gepostet, measured))}</span>
      </p>
      <h5 class="erfassen-abschnitt">Kennzahlen</h5>
      <div class="erfassen-kennzahlen" data-erfassen-kennzahlen>
        ${renderKennzahlFelder(post.plattform, werte || post.metrics, unsichereFelder(post))}
      </div>
    </div>`;
}

export function renderAktionen(eintrag, { weiterePlattform = false, abrufbar = false } = {}) {
  const { post, status } = eintrag;
  const liest = status === 'liest';
  const sperre = liest ? ' disabled' : '';
  const weitere = weiterePlattform
    ? `<button type="button" class="auswertung-link" data-erfassen-aktion="weitere"${sperre}>${icon('plus', { size: 12 })} Weitere Plattform</button>`
    : '';
  const haupt = post?.status === 'confirmed'
    ? `${abrufbar && post.source !== 'manuell' ? `<button type="button" class="mdc-btn mdc-btn--secondary" data-erfassen-aktion="neu-abrufen"${sperre}>Neu abrufen</button>` : ''}
       <button type="button" class="mdc-btn mdc-btn--secondary" data-erfassen-aktion="loeschen"${sperre}>Zahlen löschen</button>
       <button type="submit" class="mdc-btn mdc-btn--create" data-erfassen-aktion="speichern"${sperre}>Speichern</button>`
    : `${post ? `<button type="button" class="mdc-btn mdc-btn--secondary" data-erfassen-aktion="verwerfen"${sperre}>Verwerfen</button>` : ''}
       <button type="submit" class="mdc-btn mdc-btn--create" data-erfassen-aktion="bestaetigen"${sperre}>Bestätigen &amp; weiter <kbd class="erfassen-kbd">↵</kbd></button>`;
  return `
    <footer class="erfassen-aktionen">
      <div class="erfassen-aktionen__links">${weitere}</div>
      <p class="erfassen-hinweis" data-erfassen-hinweis role="alert" hidden></p>
      <div class="erfassen-aktionen__rechts">${haupt}</div>
    </footer>`;
}

/** Hinweis am Feld: Fokus bleibt dort, die Meldung steht neben den Aktionen. */
export function zeigeFeldFehler(form, fehler) {
  form.querySelectorAll('[aria-invalid="true"]').forEach(el => el.removeAttribute('aria-invalid'));
  const hinweis = form.querySelector('[data-erfassen-hinweis]');
  if (!fehler) {
    if (hinweis) hinweis.hidden = true;
    return;
  }
  const feld = form.querySelector(`[name="${fehler.name}"]`);
  // Beim eigenen Dropdown ist das Feld ein hidden input, markiert und fokussiert wird der Trigger
  const ziel = feld?.type === 'hidden' ? feld.closest('[data-table-select]')?.querySelector('.table-select__trigger') : feld;
  ziel?.setAttribute('aria-invalid', 'true');
  ziel?.focus();
  if (hinweis) {
    hinweis.textContent = fehler.text;
    hinweis.hidden = false;
  }
}

/** Fokus nach dem Wechsel: erstes unsicheres Feld, sonst Aufrufe (Spec 7.5). */
export function fokussiereErstesFeld(form) {
  const ziel = form?.querySelector('.erfassen-feld.is-unsicher input') || form?.querySelector('[data-kennzahl="views"]');
  ziel?.focus({ preventScroll: true });
  ziel?.select?.();
}
