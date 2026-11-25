// EinreichungAnlegen.js
// Review einer Kunden-Einreichung im bestehenden Briefing-Formular (ADR 0055).
// /briefing/new?einreichung=<id>&produktion=<id> lädt das Formular mit dem Payload vor.
// Speichern läuft über die normalen Wege (Entwurf oder Briefing erstellen); danach
// wird die Einreichung auf `angelegt` gesetzt. Der Payload der Einreichung bleibt unverändert.
// Produkte kommen ohne ID; die Produktliste legt sie mit der Dubletten-Regel an (ADR 0074).

import { BriefingCreate } from './BriefingCreateCore.js';
import { nutzungAusBereich } from './bereichAbleiten.js';
import { ladeEinreichung, markiereBriefingAngelegt } from '../../einladung/einreichungService.js';
import { briefingBasis, briefingTitel, freierTitel } from '../../produktion/produktionNames.js';

/** Zuordnung kommt aus Produktion und URL, nie aus dem Kunden-Payload. */
const KONTEXT_FELDER = ['unternehmen_id', 'marke_id', 'kampagne_id', 'produktion_id', 'produkt_id'];

/** Einreichungen vor ADR 0073: Ideen und Referenz-Links als Inspiration in die Ideenliste. */
function ideenAusAltPayload(payload) {
  const alt = Array.isArray(payload.umsetzungsideen) ? payload.umsetzungsideen : [];
  const links = (Array.isArray(payload.referenzen) ? payload.referenzen : [])
    .filter(r => r?.typ === 'url' && r.value)
    .map(r => r.value);
  return [...alt, ...links]
    .map(t => String(t ?? '').trim())
    .filter(Boolean)
    .map(text => ({ text, verbindlich: false }));
}

async function titelFuerEinreichung(formData, produktionId, absender) {
  try {
    const { listLinien } = await import('../../produktion/ProduktionService.js');
    const kampagne = (await window.supabase
      .from('kampagne')
      .select('kampagnenname, eigener_name')
      .eq('id', formData.kampagne_id)
      .maybeSingle()).data;
    const { data: produktion } = await window.supabase
      .from('produktion')
      .select('name')
      .eq('id', produktionId)
      .maybeSingle();
    const linien = await listLinien(produktionId);
    const basis = briefingBasis(kampagne, produktion?.name || '');
    return freierTitel(briefingTitel(basis, absender), linien.map(l => l.name));
  } catch (error) {
    console.warn('Titel der Einreichung nicht ermittelt:', error);
    return null;
  }
}

/** Formular mit dem Payload der Einreichung vorbelegen. Nur auf /briefing/new?einreichung=… */
BriefingCreate.prototype.applyEinreichung = async function() {
  const id = new URLSearchParams(window.location.search).get('einreichung');
  if (!id) return false;

  let einreichung = null;
  try {
    einreichung = await ladeEinreichung(id);
  } catch (error) {
    console.error('Einreichung nicht geladen:', error);
  }
  const einladung = einreichung?.einladung;
  if (!einreichung || einladung?.art !== 'briefing') {
    window.toastSystem?.error('Die Einreichung wurde nicht gefunden.');
    return false;
  }
  if (einreichung.status !== 'offen') {
    window.toastSystem?.warning('Diese Einreichung ist schon erledigt.');
    return false;
  }

  const kontext = {};
  for (const feld of KONTEXT_FELDER) {
    if (this.formData[feld]) kontext[feld] = this.formData[feld];
  }

  const payload = { ...(einreichung.payload?.formData || {}) };
  for (const feld of KONTEXT_FELDER) delete payload[feld];
  if (Array.isArray(payload.produkte)) {
    payload.produkte = payload.produkte.map(p => ({ ...p, produkt_id: null }));
  }
  if (!Array.isArray(payload.umsetzungsideen_eintraege) || !payload.umsetzungsideen_eintraege.length) {
    const ideen = ideenAusAltPayload(payload);
    if (ideen.length) payload.umsetzungsideen_eintraege = ideen;
  }

  this._einreichungId = einreichung.id;
  this._einreichungAbsender = einreichung.absender_name;
  this.formData = { ...payload, ...kontext, bereich: einladung.briefing_typ };
  // Eine leere Videolänge bleibt leer: der Kunde hat nichts vorgegeben.
  this.formData.videolaenge = payload.videolaenge || null;
  Object.assign(this.formData, nutzungAusBereich(this.formData, einladung.briefing_typ));
  this.selectedBereich = einladung.briefing_typ;
  this.currentStep = 1;

  const produktionId = kontext.produktion_id || einladung.produktion_id;
  if (produktionId && !this.formData.aktivierung_name) {
    const titel = await titelFuerEinreichung(this.formData, produktionId, einreichung.absender_name);
    if (titel) this.formData.aktivierung_name = titel;
  }
  if (!this.formData.produktion_id && einladung.produktion_id) {
    this.formData.produktion_id = einladung.produktion_id;
  }

  window.toastSystem?.info?.(`Einreichung von ${einreichung.absender_name} geladen. Prüfen, anpassen und speichern.`);
  return true;
};

/** Nach dem Speichern: Einreichung auf `angelegt` setzen und auf das Briefing verweisen. */
BriefingCreate.prototype.einreichungAbschliessen = async function(briefingId) {
  if (!this._einreichungId || this._einreichungErledigt || !briefingId) return;
  try {
    await markiereBriefingAngelegt(this._einreichungId, briefingId);
    this._einreichungErledigt = true;
  } catch (error) {
    console.error('Einreichung nicht als angelegt markiert:', error);
    window.toastSystem?.warning('Briefing gespeichert, aber die Einreichung blieb offen. Bitte im Eingang verwerfen.');
  }
};
