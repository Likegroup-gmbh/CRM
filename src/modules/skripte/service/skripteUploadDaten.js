// Skript aus einer Word- oder PDF-Datei (ADR 0073).
// Word ohne Hinweis wird hier zugeordnet. PDF und Word mit Hinweis legen die
// Zeile an und lassen die Background-Function den Wortlaut über Liky füllen.

import { neueBlockId } from '../editor/dokument/blockModell.js';
import { liesDocx } from '../upload/liesDocx.js';
import { docxAlsText, docxBilder } from '../upload/docxAlsText.js';
import { ordneSkriptInhalt } from '../upload/ordneSkriptInhalt.js';
import { pruefeUploadDatei, titelAusDateiname, uploadArt } from '../upload/skriptUploadGrenzen.js';
import { beschreibungStrukturVon } from '../../strategie/videoidee/beschreibungStruktur.js';
import { personaIdFuerSkript, resolveSkriptCreatePayload } from '../skriptCreateKontext.js';

const PDF_FUNKTION = 'skript-upload-pdf-background';
const PDF_WARTE_MS = 3 * 60 * 1000;

function hookWeicht(item, hook) {
  if (!item?.hook_gesperrt) return false;
  const frei = String(beschreibungStrukturVon(item)?.hook || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const gelesen = String(hook || '').replace(/\*+/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  return Boolean(frei) && frei !== gelesen;
}

function blockZumSpeichern(block, pfad) {
  const id = neueBlockId();
  if (block.typ === 'bild') {
    return { id, typ: 'bild', pfad, breite: 'mittel', unterschrift: '', intern: false };
  }
  if (block.typ === 'tabelle') {
    return { id, typ: 'tabelle', zeilen: block.zeilen, kopfzeile: block.kopfzeile === true, intern: false };
  }
  if (block.typ === 'liste' || block.typ === 'nummerierung') {
    return { id, typ: block.typ, punkte: block.punkte, intern: false };
  }
  return { id, typ: block.typ, md: block.md || '', intern: false };
}

export const skripteUploadDatenMethoden = {
  /**
   * Legt ein Skript aus einer Datei an. Liest Liky, wird gewartet, bis sie zugeordnet hat.
   * @param {string} [hinweis] sagt Liky, was aus der Datei übernommen wird
   * @returns {Promise<{ id: string }>}
   */
  async createSkriptAusUpload({ file, payload, item = null, hinweis = '' }) {
    const grund = pruefeUploadDatei(file);
    if (grund) throw new Error(grund);
    const art = uploadArt(file);
    const dateiname = file.name;
    const titel = titelAusDateiname(dateiname);
    hinweis = String(hinweis || '').trim();

    if (art === 'docx') {
      const teile = await liesDocx(await file.arrayBuffer());
      if (hinweis) return this._docxUeberLiky({ teile, payload, titel, dateiname, hinweis });
      const { zellen, bloecke } = ordneSkriptInhalt(teile);
      const skript = await this._insertUploadSkript({
        payload, titel, dateiname, art, zellen,
        hookWeicht: hookWeicht(item, zellen.hook)
      });
      await this._sonstVerwerfen(skript.id, async () => {
        await this._schreibeUploadBloecke(skript.id, bloecke);
        await this._schreibeUploadVersion(skript.id, { titel, zellen, dateiname });
      });
      return skript;
    }

    const skript = await this._insertUploadSkript({
      payload, titel, dateiname, art,
      zellen: {},
      hookWeicht: false,
      statusLesen: true
    });
    await this._sonstVerwerfen(skript.id, async () => {
      const pfad = await this._ladePdfHoch(file, skript.id);
      await this.triggerFunction(PDF_FUNKTION, { skriptId: skript.id, pdfPath: pfad, hinweis });
    });
    await this._warteAufPdf(skript.id);
    return skript;
  },

  async _docxUeberLiky({ teile, payload, titel, dateiname, hinweis }) {
    const text = docxAlsText(teile);
    const skript = await this._insertUploadSkript({
      payload, titel, dateiname, art: 'docx',
      zellen: {},
      hookWeicht: false,
      statusLesen: true
    });
    await this._sonstVerwerfen(skript.id, async () => {
      const bildPfade = [];
      for (const blob of docxBilder(teile)) bildPfade.push(await this.uploadSkriptBild(skript.id, blob));
      await this.triggerFunction(PDF_FUNKTION, { skriptId: skript.id, text, bildPfade, hinweis });
    });
    await this._warteAufPdf(skript.id);
    return skript;
  },

  /** Scheitert ein Schritt nach dem Anlegen, bleibt kein leerer Entwurf in der Liste. */
  async _sonstVerwerfen(skriptId, schritte) {
    try {
      await schritte();
    } catch (err) {
      await this.db.from('skripte').delete().eq('id', skriptId);
      throw err;
    }
  },

  async setzeSkriptVideoidee(skript, item) {
    if (!skript?.id || !item?.id) throw new Error('Videoidee fehlt');
    const personaId = personaIdFuerSkript(item);
    const produktIds = await this.loadAcceptedProduktIds(personaId);
    const payload = resolveSkriptCreatePayload(item, { produktIds });
    await this.updateSkript(skript.id, {
      strategie_item_id: payload.strategie_item_id,
      video_idee: payload.video_idee,
      funnel_stufe: payload.funnel_stufe,
      video_laenge: payload.video_laenge || skript.video_laenge || null,
      persona_id: payload.persona_id,
      produkt_id: payload.produkt_id,
      marke_id: payload.marke_id || skript.marke_id || null,
      briefing_id: payload.briefing_id || skript.briefing_id || null,
      prompt_kontext: {
        ...(skript.prompt_kontext || {}),
        upload_hook_weicht: hookWeicht(item, skript.hook)
      }
    });
  },

  async quittiereUploadPruefung(skript) {
    if (!skript?.prompt_kontext?.upload_pruefen) return;
    const prompt_kontext = { ...skript.prompt_kontext, upload_pruefen: false };
    await this.updateSkript(skript.id, { prompt_kontext });
    skript.prompt_kontext = prompt_kontext;
  },

  async loadKonzeptIdVonBriefing(briefingId) {
    if (!briefingId) return null;
    const { data, error } = await this.db.from('strategie')
      .select('id')
      .eq('briefing_id', briefingId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data?.id || null;
  },

  async _insertUploadSkript({ payload, titel, dateiname, art, zellen, hookWeicht: weicht, statusLesen = false }) {
    const { data: { user } } = await this.db.auth.getUser();
    const enriched = await this._enrichPayloadFromBriefing(payload);
    const { data, error } = await this.db.from('skripte').insert({
      titel,
      unternehmen_id: enriched.unternehmen_id || null,
      marke_id: enriched.marke_id || null,
      kampagne_id: enriched.kampagne_id || null,
      produktion_id: enriched.produktion_id || null,
      produkt_id: enriched.produkt_id || null,
      persona_id: enriched.persona_id || null,
      branche_id: enriched.branche_id || null,
      briefing_id: enriched.briefing_id || null,
      bereich: enriched.bereich || null,
      strategie_item_id: enriched.strategie_item_id || null,
      video_idee: enriched.video_idee || null,
      video_laenge: enriched.video_laenge || null,
      funnel_stufe: enriched.funnel_stufe || null,
      hook: zellen.hook || null,
      hauptteil: zellen.hauptteil || null,
      cta: zellen.cta || null,
      hook_visuell: zellen.hook_visuell || null,
      hauptteil_visuell: zellen.hauptteil_visuell || null,
      cta_visuell: zellen.cta_visuell || null,
      text_hook: zellen.text_hook || null,
      rezept: zellen.rezept || null,
      caption: zellen.caption || null,
      hook_variante_1: zellen.hook_variante_1 || null,
      hook_variante_2: zellen.hook_variante_2 || null,
      hook_variante_3: zellen.hook_variante_3 || null,
      aktive_version_nr: statusLesen ? null : 1,
      aktive_sub_nr: 0,
      herkunft: 'hochgeladen',
      status: 'entwurf',
      prompt_kontext: {
        upload_dateiname: dateiname,
        upload_art: art,
        upload_pruefen: statusLesen,
        upload_hook_weicht: Boolean(weicht),
        upload_status: statusLesen ? 'lesen' : 'fertig'
      },
      created_by: user?.id
    }).select('id').single();
    if (error) throw new Error(error.message);
    return data;
  },

  async _schreibeUploadBloecke(skriptId, bloecke) {
    if (!bloecke?.length) return;
    const liste = [{ id: 'skript-tabelle', typ: 'skript_tabelle' }];
    for (const block of bloecke) {
      const pfad = block.typ === 'bild' ? await this.uploadSkriptBild(skriptId, block.blob) : null;
      liste.push(blockZumSpeichern(block, pfad));
    }
    const { error } = await this.db.from('skripte')
      .update({ dokument_bloecke: liste, dokument_bloecke_rev: 1 })
      .eq('id', skriptId);
    if (error) throw new Error(error.message);
  },

  async _schreibeUploadVersion(skriptId, { titel, zellen, dateiname }) {
    const { data: { user } } = await this.db.auth.getUser();
    const { error } = await this.db.from('skript_versionen').insert({
      skript_id: skriptId,
      version_nr: 1,
      sub_nr: 0,
      titel,
      hook: zellen.hook || null,
      hauptteil: zellen.hauptteil || null,
      cta: zellen.cta || null,
      hook_visuell: zellen.hook_visuell || null,
      hauptteil_visuell: zellen.hauptteil_visuell || null,
      cta_visuell: zellen.cta_visuell || null,
      text_hook: zellen.text_hook || null,
      rezept: zellen.rezept || null,
      caption: zellen.caption || null,
      hook_variante_1: zellen.hook_variante_1 || null,
      hook_variante_2: zellen.hook_variante_2 || null,
      hook_variante_3: zellen.hook_variante_3 || null,
      aenderung_beschreibung: `Hochgeladen aus ${dateiname}`,
      created_by: user?.id
    });
    if (error) throw new Error(error.message);
  },

  async _ladePdfHoch(file, skriptId) {
    const { data: { user } } = await this.db.auth.getUser();
    if (!user) throw new Error('Keine aktive Sitzung');
    const pfad = `skript-upload/${user.id}/${skriptId}.pdf`;
    const { error } = await this.db.storage.from('documents')
      .upload(pfad, file, { upsert: true, contentType: 'application/pdf' });
    if (error) throw new Error(`Upload fehlgeschlagen: ${error.message}`);
    return pfad;
  },

  async _warteAufPdf(skriptId) {
    const start = Date.now();
    while (Date.now() - start < PDF_WARTE_MS) {
      const { data, error } = await this.db.from('skripte')
        .select('prompt_kontext')
        .eq('id', skriptId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      const status = data?.prompt_kontext?.upload_status;
      if (status === 'fertig') return;
      if (status === 'fehler') {
        await this.db.from('skripte').delete().eq('id', skriptId);
        throw new Error(data.prompt_kontext.upload_fehler || 'Die Datei konnte nicht gelesen werden');
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error('Liky liest die Datei noch. Das Skript liegt schon in der Liste.');
  }
};
