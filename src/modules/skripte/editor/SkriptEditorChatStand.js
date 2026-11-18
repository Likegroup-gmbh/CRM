// SkriptEditorChatStand.js
// Manuelles Speichern aus dem Inline-Edit, abgeleitete Felder (Zeitmarker,
// Pruefung) und Festlegungen (Prototype-Mixin von SkriptEditorChatActions)

import { skripteService } from '../SkripteService.js';
import { skriptKommentarService } from '../SkriptKommentarService.js';
import { sektionAnzeigeKurz, skriptStand, manuellBeschreibung } from './skriptEditorVisuellHelfer.js';
import { zeitmarkerPatch, VISUELL_PAARE } from '../skriptSekunden.js';
import { pruefeDokument } from '../skriptPruefung.js';

const ZEIT_FELDER = new Set(VISUELL_PAARE.flat());
const GESPROCHEN = new Set(VISUELL_PAARE.map(([gesprochen]) => gesprochen));

/** Festlegung nach Ablehnen: „Abgelehnt für Hook: „…““. Ohne Vorschlagstext keine. */
export function festlegungAusAblehnungText(msg) {
  const liste = (Array.isArray(msg?.aenderungen) ? msg.aenderungen : [])
    .filter((a) => a?.sektion && String(a.vorschlag_text || '').trim());
  const einzel = String(msg?.vorschlag_text || '').trim();
  if (einzel && msg?.sektion && msg.sektion !== 'gesamt') {
    return `Abgelehnt für ${sektionAnzeigeKurz(msg.sektion, msg.ist_visuell)}: „${einzel.slice(0, 180)}“`;
  }
  if (!liste.length) return einzel ? `Abgelehnt: „${einzel.slice(0, 180)}“` : '';
  const zellen = [...new Set(liste.map((a) => sektionAnzeigeKurz(a.sektion, a.spalte === 'visuell')))].join(', ');
  const stueck = liste.map((a) => String(a.vorschlag_text).trim()).join(' / ').slice(0, 180);
  return `Abgelehnt für ${zellen}: „${stueck}“`;
}

export const chatStandMethoden = {
  /**
   * Abgeleitete Felder nach einer Textaenderung (ADR 0035): Zeitmarker aller
   * Visual-Zellen aus dem Gesamtstand und die Pruefung des Dokuments.
   */
  abgeleitet(stand, felder, { ausser = [] } = {}) {
    const patch = {};
    if (felder.some((f) => ZEIT_FELDER.has(f))) Object.assign(patch, zeitmarkerPatch(stand, { ausser }));
    if (felder.some((f) => GESPROCHEN.has(f))) patch.pruefung = pruefeDokument({ ...stand, ...patch });
    return patch;
  },

  /** Extern geaenderte Zellen ohne vollen Re-Render ins DOM schreiben; die Zelle mit Fokus bleibt. */
  zeigeZellen(patch) {
    const v = this.view;
    const fokus = v.inlineEdit?.focusedFeld?.();
    for (const [feld, text] of Object.entries(patch || {})) {
      if (feld === fokus || !ZEIT_FELDER.has(feld)) continue;
      const zelle = v.container?.querySelector(`[data-feld="${feld}"]`);
      if (zelle) zelle.textContent = text || '';
      v.inlineEdit?.syncSaved?.(feld, text || '');
    }
  },

  mitFestgezogen(feld, liste = null) {
    const basis = liste || (Array.isArray(this.view.skript?.festgezogen) ? this.view.skript.festgezogen.slice() : []);
    if (feld && !basis.includes(feld)) basis.push(feld);
    if (!liste) this.view.skript.festgezogen = basis;
    return basis;
  },

  async haengeFestlegung(text, quelle) {
    const v = this.view;
    const t = String(text || '').trim();
    if (!t || !v.skript) return;
    const liste = Array.isArray(v.skript.festlegungen) ? v.skript.festlegungen.slice() : [];
    if (liste.some((f) => f?.text === t)) return;
    liste.push({ text: t, quelle });
    await skripteService.updateSkript(v.skript.id, { festlegungen: liste });
    v.skript.festlegungen = liste;
  },

  // Nur das abgelehnte Stueck: die Anweisung davor galt diesem Turn, sie als
  // Dauer-Fakt zu speichern hat spaetere Edits auf den alten Wunsch festgenagelt
  async festlegungAusAblehnung(msg) {
    const text = festlegungAusAblehnungText(msg);
    if (text) await this.haengeFestlegung(text, 'ablehnung');
  },

  async saveManuell(feld, text, vorherText) {
    const v = this.view;
    if (!v.skript) return;
    const wert = text || null;

    // Kunden und Share-Gaeste mit Feedback-Recht: Feld-Update + Info-Zeile
    // kommen atomar aus dem RPC, ohne Version (die Versionshistorie bleibt
    // der interne Changelog). Gaeste haben keinen benutzer-Eintrag und
    // speichern ueber den eigenen RPC (Autor kommt aus dem Gast-JWT).
    if (v.isReadonly) {
      v.skript[feld] = wert;
      try {
        const kommentarId = window.permissionSystem?.isGast
          ? await skripteService.saveGastAenderung(v.skript.id, feld, wert)
          : await skripteService.saveKundeAenderung(v.skript.id, feld, wert);
        // Nachladen mit Autor-Join; schlaegt das fehl, liefert Realtime die Zeile
        try {
          const kommentar = await skriptKommentarService.loadKommentar(kommentarId);
          if (kommentar) {
            v.upsertFeedback(kommentar);
            v.renderFeedback();
          }
        } catch (_) { /* Realtime holt die Info-Zeile nach */ }
      } catch (err) {
        window.toastSystem?.error(err.message);
        throw err;
      }
      return;
    }

    const vorherigerStand = skriptStand(v.skript);
    vorherigerStand[feld] = vorherText || null;
    v.skript[feld] = wert;
    // Gesprochener Text bestimmt Sekunden und Pruefung; eine Visual-Zelle mit Fokus bleibt, wie sie ist.
    // Eine manuell bearbeitete Visual-Zelle wird nicht neu gestempelt.
    const fokus = v.inlineEdit?.focusedFeld?.();
    const stempel = GESPROCHEN.has(feld)
      ? this.abgeleitet(v.skript, [feld], { ausser: fokus ? [fokus] : [] })
      : {};
    Object.assign(v.skript, stempel);
    try {
      await skripteService.updateSkript(v.skript.id, { [feld]: wert, ...stempel });
      this.zeigeZellen(stempel);
      const neueVersion = await skripteService.createVersion(
        v.skript, manuellBeschreibung(feld), vorherigerStand, v.aktiveVersion
      );
      v.aktiveVersion = neueVersion;
      v.skript.aktive_version_nr = neueVersion.version_nr;
      v.skript.aktive_sub_nr = neueVersion.sub_nr;
      v.versionen = await skripteService.getVersionen(v.skript.id);
      v.renderVersionSelect();
    } catch (err) {
      window.toastSystem?.error(err.message);
      throw err;
    }
  },
};
