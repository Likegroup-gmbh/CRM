// briefingDokument.js
// Inhalt eines Briefings in der Reihenfolge und mit dem Wortlaut des Creator-Briefing-PDFs
// (briefingFelder.json): drei Sektionen, je Sektion Einträge. DocView und Creator-PDF lesen
// dasselbe Modell. Produkte kommen live aus dem Katalog (briefing.produkte), nicht aus einer Kopie.
// „Frühere Angaben“ (Altfelder) baut fruehereAngaben getrennt, nur fürs Team.

import { FLOW_STEPS, SEKTIONEN } from './create/fieldConfig.js';
import { ALTFELDER } from './briefingAltfelder.js';
import { isLegacyBriefing, legacyAngaben, resolveBriefingFieldValue } from './briefingLegacy.js';
import { istPlatzhalter } from './create/briefingProduktSync.js';
import { tagsHtml } from './briefingWertAnzeige.js';

const PRODUKT_FELD = 'produkte';

function inhaltsSektion(stepId) {
  return FLOW_STEPS.find(s => s.id === stepId)?.sections.find(sec => sec.id === stepId) || null;
}

function wert(briefing, field) {
  return resolveBriefingFieldValue(briefing, field.name);
}

function datumsText(detail, von, bis) {
  if (!von) return null;
  const start = detail.escape(detail.formatDate(von));
  return bis ? `${start} bis ${detail.escape(detail.formatDate(bis))}` : start;
}

/** Ein Feld als Eintrag: Textareas als Text (inline editierbar), alles andere als Zeile. */
function feldEintrag(detail, field, value, { mitLeeren }) {
  const html = detail.formatValue(field, value);
  if (field.type === 'textarea') {
    if (html == null && !mitLeeren) return null;
    return { art: 'text', field, label: field.label, value: typeof value === 'string' ? value : '', html: html ?? '' };
  }
  if (html == null) return null;
  if (field.type === 'ideenListe') {
    const text = value
      .filter(e => String(e?.text ?? '').trim())
      .map(e => `${e.verbindlich ? 'Verbindlich' : 'Inspiration'}: ${e.text.trim()}`)
      .join('\n');
    return { art: 'liste', field, label: field.label, html, text };
  }
  return { art: 'zeile', field, label: field.label, html };
}

/**
 * Gruppe des PDFs als Einträge: Häkchen zu einer Zeile (Label der Gruppe), Liste plus
 * „Weitere …“ zu einer Zeile, Datum plus Bis-Datum zu einem Zeitraum.
 */
function gruppenEintraege(detail, group, ctx) {
  const b = detail.briefing;
  const felder = group.fields || [];
  const esc = (v) => detail.escape(v);
  const out = [];

  const an = felder.filter(f => f.type === 'checkbox' && wert(b, f) === true).map(f => f.label);
  if (an.length) out.push({ art: 'zeile', label: group.label, html: tagsHtml(an, esc), text: an.join(', ') });

  const liste = felder.find(f => f.type === 'checkboxes');
  for (const field of felder) {
    if (field.type === 'checkbox' || field.nachDatum) continue;
    if (field.type === 'date') {
      const bis = felder.find(f => f.nachDatum === field.name);
      const html = datumsText(detail, b[field.name], bis ? b[bis.name] : null);
      if (html) out.push({ art: 'zeile', field, label: field.label, html });
      continue;
    }
    if (field.type === 'checkboxes') {
      const werte = wert(b, field);
      const labels = (Array.isArray(werte) ? werte : []).map(v => field.options?.find(o => o.value === v)?.label || v);
      const weitere = felder.find(f => f.type === 'text');
      const frei = weitere ? String(b[weitere.name] ?? '').trim() : '';
      if (!labels.length && !frei) continue;
      const html = [labels.length ? tagsHtml(labels, esc) : '', frei ? esc(frei) : ''].filter(Boolean).join(' ');
      out.push({ art: 'zeile', field, label: field.label, html, text: [...labels, frei].filter(Boolean).join(', ') });
      continue;
    }
    if (field.type === 'text' && liste) continue;
    const eintrag = feldEintrag(detail, field, wert(b, field), ctx);
    if (eintrag) out.push(group.label && eintrag.art === 'text' ? { ...eintrag, gruppe: group.label } : eintrag);
  }
  return out;
}

function produktEintrag(detail, field, produkt) {
  const subs = field.fields || [];
  const name = istPlatzhalter(produkt.name) ? (produkt.url || 'Produkt') : produkt.name;
  const zeilen = subs
    .filter(sub => !['name', 'url'].includes(sub.name))
    .map(sub => ({ label: sub.label, text: String(produkt[sub.name] ?? '').trim() }))
    .filter(z => z.text);
  return {
    art: 'produkt',
    id: produkt.id,
    name,
    url: produkt.url || null,
    zeilen: zeilen.map(z => ({ label: z.label, html: detail.escape(z.text).replace(/\n/g, '<br>'), text: z.text }))
  };
}

/**
 * Die drei Sektionen des Creator-Briefings mit ihren befüllten Einträgen.
 * @param {{ briefing, formatValue, escape, formatDate }} detail
 * @param {{ mitLeeren?: boolean }} opts - leere Textfelder mitliefern (Inline-Bearbeitung)
 * @returns {{ id, titel, hinweis, eintraege: object[] }[]}
 */
export function briefingSektionen(detail, { mitLeeren = false } = {}) {
  const b = detail.briefing || {};
  const ctx = { mitLeeren };
  return SEKTIONEN.map(({ id, titel, hinweis }) => {
    const sektion = inhaltsSektion(id);
    const eintraege = [];
    for (const field of sektion?.fields || []) {
      if (field.name === 'aktivierung_name') continue;
      if (field.type === 'fieldGroup') {
        eintraege.push(...gruppenEintraege(detail, field, ctx));
        continue;
      }
      if (field.name === PRODUKT_FELD) {
        for (const produkt of b.produkte || []) eintraege.push(produktEintrag(detail, field, produkt));
        continue;
      }
      const eintrag = feldEintrag(detail, field, wert(b, field), ctx);
      if (eintrag) eintraege.push(eintrag);
    }
    return { id, titel, hinweis, eintraege };
  });
}

/** Produktnamen für Kopfzeile und PDF-Titelblock. */
export function produktNamen(briefing) {
  return (briefing?.produkte || [])
    .map(p => (istPlatzhalter(p?.name) ? p?.url : p?.name))
    .filter(Boolean);
}

/**
 * Altfelder mit Wert als Zeilen. Nur fürs Team, nie im Creator-PDF.
 * v1-Briefings (nur Präfix-Spalten) bekommen zusätzlich ihren Präfix-Katalog.
 */
export function fruehereAngaben(detail) {
  const b = detail.briefing || {};
  const rows = [];
  for (const field of ALTFELDER) {
    // Eigener Spaltenwert, kein Präfix-Fallback: den zeigt bei v1-Briefings legacyAngaben
    const html = detail.formatValue(field, b[field.name]);
    if (html != null) rows.push({ name: field.name, label: field.label, html });
  }
  if (isLegacyBriefing(b)) rows.push(...legacyAngaben(b, (s) => detail.escape(s)));
  return rows;
}
