// DirektvertragGating.js
// "Direktvertrag" (Code-Bezeichner: awareness) = Vertrag, bei dem der Kunde
// (z.B. BURGA, UAB Hautica) direkt Vertragspartei des Influencers ist und
// LikeGroup keine Vertragspartei. Das Template wird nur bei diesen Kunden
// angeboten – Erkennung per firmenname-Match (kein DB-Flag).

import { VertraegeCreate } from './VertraegeCreateCore.js';

// Kunden-Erkennung: case-insensitive Teilstring auf unternehmen.firmenname
const DIREKTVERTRAG_KUNDEN_MATCHER = ['burga', 'hautica'];

// Flache formData-Felder, die in das JSONB awareness_felder wandern
// (DataPersistence.prepareDataForDB). Werden verworfen, wenn der Kunde
// kein Direktvertrag-Kunde (mehr) ist.
export const AWARENESS_FELD_NAMEN = [
  'vertrag_datum',
  'ansprechpartner_email',
  'video_mindestlaenge_sekunden',
  'veroeffentlichungsfrist',
  'verguetung_brutto',
  'zahlungsmethode',
  'statistik_frist_tage',
  'content_vorlauf_tage',
  'content_aufbewahrung_dauer',
  'brand_tag',
  'kuendigungsfrist_tage',
  'influencer_reg_code',
  'influencer_ust_id',
  'produkt_beschreibung'
];

export function isDirektvertragKunde(unternehmen, kundeId) {
  if (!kundeId) return false;
  const kunde = (unternehmen || []).find(u => u.id === kundeId);
  const name = (kunde?.firmenname || '').toLowerCase();
  return DIREKTVERTRAG_KUNDEN_MATCHER.some(matcher => name.includes(matcher));
}

// Prototype-Shortcut: prueft den aktuell gewaehlten Kunden
VertraegeCreate.prototype.isDirektvertragKunde = function() {
  return isDirektvertragKunde(this.unternehmen, this.formData?.kunde_unternehmen_id);
};

// Awareness-Sektionen im Formular ein-/ausblenden. Beim Verbergen werden die
// Awareness-Werte verworfen und das Template auf 'legacy' zurueckgesetzt,
// damit kein Direktvertrag-Datenmuell in Standard-Vertraegen landet.
VertraegeCreate.prototype.updateDirektvertragSections = function() {
  const show = this.isDirektvertragKunde();
  document.querySelectorAll('.awareness-section').forEach(el => {
    el.classList.toggle('hidden', !show);
  });
  if (!show) {
    AWARENESS_FELD_NAMEN.forEach(name => { delete this.formData[name]; });
    if (this.formData.vertrag_template === 'awareness') {
      this.formData.vertrag_template = 'legacy';
    }
  }
};
