// produktEinreichung.js
// Review einer Produkt-Einreichung im bestehenden Produkt-Formular (ADR 0055).
// /produkt/new?einreichung=<id>&unternehmen=…&marke=… lädt das Formular mit dem Payload vor.
// Anlegen erzeugt ein Katalogprodukt (keine Linie, kein „Produkt übernehmen“).
// Vorher läuft ein Namensvergleich innerhalb derselben Marke: „Vorhandenes nehmen“ verwirft
// nur die Einreichung, „Trotzdem neu“ legt ein zweites Produkt an. Kein Feld-Merge.

import { ladeDatei, ladeEinreichung } from '../einladung/einreichungService.js';

const TEXT_FELDER = [
  'name', 'url', 'kurzbeschreibung', 'usp', 'pain_points', 'loesung',
  'preis_von', 'preis_bis', 'preis_uvp',
  'inhaltsstoffe', 'erlaubte_claims', 'verbotene_claims', 'rechtliche_hinweise'
];

export function einreichungIdAusUrl(search = window.location.search) {
  return new URLSearchParams(String(search).replace(/^\?/, '')).get('einreichung');
}

/** Offene Produkt-Einreichung oder null (mit Hinweis an den Nutzer). */
export async function ladeProduktEinreichung(id) {
  if (!id) return null;
  let einreichung = null;
  try {
    einreichung = await ladeEinreichung(id);
  } catch (error) {
    console.error('Einreichung nicht geladen:', error);
  }
  if (!einreichung || einreichung.einladung?.art !== 'produkt') {
    window.toastSystem?.error?.('Die Einreichung wurde nicht gefunden.');
    return null;
  }
  if (einreichung.status !== 'offen') {
    window.toastSystem?.warning?.('Diese Einreichung ist schon erledigt.');
    return null;
  }
  return einreichung;
}

/** formData für renderProduktDoc: Textfelder aus dem Payload, Zuordnung aus der Einladung. */
export function einreichungFormData(einreichung) {
  const payload = einreichung.payload?.formData || {};
  const einladung = einreichung.einladung || {};
  const data = {};
  for (const feld of TEXT_FELDER) {
    if (payload[feld] !== undefined && payload[feld] !== null) data[feld] = payload[feld];
  }
  data.unternehmen_id = einladung.unternehmen_id || '';
  data.marke_ids = einladung.marke_id ? [einladung.marke_id] : [];
  data.briefing_ids = [];
  return data;
}

export function variantenAusEinreichung(einreichung) {
  const rows = einreichung.payload?.formData?.varianten;
  return Array.isArray(rows) ? rows.map(v => ({ ...v, id: undefined })) : [];
}

export function einsatzsituationenAusEinreichung(einreichung) {
  const rows = einreichung.payload?.formData?.einsatzsituationen;
  return Array.isArray(rows) ? rows.filter(Boolean) : [];
}

/** Bilder aus dem Bucket `einreichung` als File-Objekte für den Uploader. */
export async function bilderAlsDateien(einreichung) {
  const bilder = einreichung.payload?.formData?.bilder;
  if (!Array.isArray(bilder)) return [];
  const dateien = [];
  for (const bild of bilder) {
    try {
      const blob = await ladeDatei(bild.pfad);
      dateien.push(new File([blob], bild.name || 'Bild', { type: blob.type || 'image/jpeg' }));
    } catch (error) {
      console.warn('Bild der Einreichung nicht geladen:', error);
    }
  }
  return dateien;
}

const norm = (s) => String(s || '').trim().toLocaleLowerCase('de');

/** Produkte mit gleichem Namen: in der Marke, ohne Marke im ganzen Unternehmen. */
export async function findeNamensDubletten({ unternehmenId, markeId = null, name }) {
  const wanted = norm(name);
  if (!wanted || !unternehmenId || !window.supabase) return [];

  const { data, error } = await window.supabase
    .from('produkt')
    .select('id, name')
    .eq('unternehmen_id', unternehmenId);
  if (error) throw error;
  let treffer = (data || []).filter(p => norm(p.name) === wanted);
  if (!treffer.length || !markeId) return treffer;

  const { data: links, error: linkError } = await window.supabase
    .from('produkt_marke')
    .select('produkt_id')
    .eq('marke_id', markeId)
    .in('produkt_id', treffer.map(p => p.id));
  if (linkError) throw linkError;
  const inMarke = new Set((links || []).map(l => l.produkt_id));
  treffer = treffer.filter(p => inMarke.has(p.id));
  return treffer;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Warnung bei gleichem Namen.
 * @returns {Promise<'vorhanden'|'neu'|'abbrechen'>}
 */
export function fragNachDublette(dubletten) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal overlay-modal einreichung-dublette';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Produkt gibt es schon</h3>
          <button type="button" class="modal-close" data-wahl="abbrechen" aria-label="Schließen">&times;</button>
        </div>
        <div class="modal-body">
          <p>In dieser Marke gibt es schon ein Produkt mit diesem Namen:</p>
          <ul>${dubletten.map(d => `<li><strong>${esc(d.name)}</strong></li>`).join('')}</ul>
          <p>„Vorhandenes nehmen“ verwirft die Einreichung, am vorhandenen Produkt ändert sich nichts.
             „Trotzdem neu“ legt ein zweites Produkt an.</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="mdc-btn mdc-btn--secondary" data-wahl="abbrechen">Abbrechen</button>
          <button type="button" class="mdc-btn mdc-btn--secondary" data-wahl="neu">Trotzdem neu</button>
          <button type="button" class="mdc-btn" data-wahl="vorhanden">Vorhandenes nehmen</button>
        </div>
      </div>`;
    const fertig = (wahl) => {
      modal.remove();
      resolve(wahl);
    };
    modal.addEventListener('click', (e) => {
      const knopf = e.target.closest('[data-wahl]');
      if (knopf) fertig(knopf.dataset.wahl);
      else if (e.target === modal) fertig('abbrechen');
    });
    document.body.appendChild(modal);
  });
}
