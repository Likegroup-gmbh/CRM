// produktEinreichungTabelle.js
// Eingang der Produkt-Einreichungen als Tabelle: gleiche Klassen und Spalten wie die Produktliste
// (ProduktList.renderSingleRow), gefüllt aus dem Payload der Einreichung. Spalten, die es erst
// nach dem Anlegen gibt (Personas, Briefings, Skripte), entfallen.

import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { ProduktService } from '../produkt/ProduktService.js';
import { NUR_UNTERNEHMEN_LABEL } from '../produkt/ProduktFolders.js';
import { einreichungDatum } from './einreichungService.js';

const BUCKET = 'einreichung';
const THUMB_GUELTIG_SEKUNDEN = 3600;

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Erstes Bild je Einreichung als signierte URL (der Bucket ist privat). Fehler ergeben keine Bilder. */
export async function ladeThumbs(einreichungen) {
  const pfade = new Map();
  for (const e of einreichungen) {
    const pfad = e.payload?.formData?.bilder?.[0]?.pfad;
    if (pfad) pfade.set(e.id, pfad);
  }
  if (!pfade.size) return new Map();
  try {
    const { data, error } = await window.supabase.storage
      .from(BUCKET)
      .createSignedUrls([...pfade.values()], THUMB_GUELTIG_SEKUNDEN);
    if (error) throw error;
    const urlZuPfad = new Map((data || []).map((d) => [d.path, d.signedUrl]));
    const ergebnis = new Map();
    for (const [id, pfad] of pfade) {
      if (urlZuPfad.get(pfad)) ergebnis.set(id, urlZuPfad.get(pfad));
    }
    return ergebnis;
  } catch (error) {
    console.warn('Bilder der Einreichungen nicht geladen:', error);
    return new Map();
  }
}

function renderThumb(name, url) {
  if (!url) return `<span class="table-avatar">${esc((name || '?')[0].toUpperCase())}</span>`;
  return `<img src="${esc(url)}" class="table-logo" width="24" height="24" alt="" loading="lazy">`;
}

function renderUnternehmen(unternehmen) {
  if (!unternehmen?.firmenname) return '-';
  return avatarBubbles.renderBubbles([{
    name: unternehmen.firmenname,
    label: unternehmen.internes_kuerzel || unternehmen.firmenname,
    type: 'org',
    id: unternehmen.id,
    entityType: 'unternehmen',
    logo_url: unternehmen.logo_url || null
  }], { showLabel: true });
}

function renderMarke(marke) {
  if (!marke?.markenname) return `<span class="text-muted">${esc(NUR_UNTERNEHMEN_LABEL)}</span>`;
  return `<span class="status-badge">${esc(marke.markenname)}</span>`;
}

function renderZeile(einreichung, { thumbs, zeigeLinie }) {
  const form = einreichung.payload?.formData || {};
  const einladung = einreichung.einladung || {};
  const name = form.name || 'Produkt';
  const varianten = Array.isArray(form.varianten) ? form.varianten.length : 0;
  const linie = zeigeLinie && einladung.briefing_id ? einladung.briefing?.aktivierung_name || '' : '';

  return `
    <tr data-einreichung-id="${esc(einreichung.id)}">
      <td class="col-thumb">${renderThumb(name, thumbs.get(einreichung.id))}</td>
      <td class="col-name col-name-with-icon">
        <a href="#" class="table-link" data-einreichung-pruefen>${esc(name)}</a>
      </td>
      <td>${renderUnternehmen(einladung.unternehmen)}</td>
      <td>${renderMarke(einladung.marke)}</td>
      <td>${esc(ProduktService.preisLabel(form))}</td>
      <td>${varianten > 0 ? varianten : '-'}</td>
      <td>${esc(einreichungDatum(einreichung))}</td>
      <td>${esc(einreichung.absender_name || '-')}</td>
      ${zeigeLinie ? `<td>${linie ? esc(linie) : '-'}</td>` : ''}
      <td class="col-actions">
        <div class="einreichung-inbox__aktionen">
          <button type="button" class="mdc-btn" data-einreichung-pruefen>Prüfen</button>
          <button type="button" class="mdc-btn mdc-btn--secondary" data-einreichung-verwerfen>Verwerfen</button>
        </div>
      </td>
    </tr>`;
}

/**
 * Tabelle der offenen Produkt-Einreichungen. `zeigeLinie`: Spalte „Linie“ nur dort, wo nicht schon
 * die Linie selbst offen ist.
 */
export function renderProduktEinreichungTabelle(offen, { thumbs = new Map(), zeigeLinie = false } = {}) {
  return `
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Bild</th>
            <th class="col-name">Produkt</th>
            <th>Unternehmen</th>
            <th>Marken</th>
            <th>Preis</th>
            <th>Varianten</th>
            <th>Eingereicht</th>
            <th>Von</th>
            ${zeigeLinie ? '<th>Linie</th>' : ''}
            <th class="col-actions">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          ${offen.map((e) => renderZeile(e, { thumbs, zeigeLinie })).join('')}
        </tbody>
      </table>
    </div>`;
}
