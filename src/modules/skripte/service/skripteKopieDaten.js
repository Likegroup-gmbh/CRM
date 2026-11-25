// skripteKopieDaten.js
// Skript kopieren (ADR 0075): eigenes Skript für einen weiteren Creator an derselben
// Videoidee, verknüpft mit dessen Kooperationsvideo (Prototype-Mixin von SkripteService)

import { planeVersionsRows } from '../versionsNummerierung.js';

/** Was die Kopie übernimmt. Status, Freigabe, Kommentare, Versionen und Chat bleiben beim Original. */
export const KOPIE_FELDER = [
  'id', 'titel', 'unternehmen_id', 'marke_id', 'kampagne_id', 'produktion_id', 'briefing_id',
  'produkt_id', 'persona_id', 'branche_id', 'bereich', 'strategie_item_id', 'video_idee',
  'video_laenge', 'funnel_stufe', 'tonalitaet', 'location', 'regieanweisung', 'herkunft', 'model',
  'prompt_kontext', 'master_regelwerk', 'hook', 'hauptteil', 'cta', 'hook_visuell', 'hauptteil_visuell', 'cta_visuell',
  'hook_variante_1', 'hook_variante_2', 'hook_variante_3', 'text_hook', 'rezept', 'caption',
  'inhalt_md', 'festlegungen', 'festgezogen', 'dokument_bloecke'
];

function istBesetzung(festlegung) {
  if (festlegung?.quelle === 'creator_tausch') return true;
  return /^\s*besetzung\b/i.test(String(festlegung?.text || ''));
}

/** Festlegungen des Originals ohne dessen Besetzung, dazu die Besetzung des neuen Creators. */
export function festlegungenFuerKopie(festlegungen, creatorName, am = new Date().toISOString()) {
  const liste = (Array.isArray(festlegungen) ? festlegungen : []).filter((f) => !istBesetzung(f));
  const name = String(creatorName || '').trim();
  if (name) liste.push({ text: `Besetzung: ${name}`, quelle: 'skript_kopie', am });
  return liste;
}

/** Insert-Zeile der Kopie aus dem geladenen Original. */
export function kopieZeile(quelle, { creatorName = '', userId = null, am } = {}) {
  const zeile = {};
  for (const feld of KOPIE_FELDER) {
    if (feld !== 'id') zeile[feld] = quelle?.[feld] ?? null;
  }
  const name = String(creatorName || '').trim();
  const titel = String(quelle?.titel || '').trim() || 'Skript';
  return {
    ...zeile,
    titel: name ? `${titel} – ${name}` : titel,
    prompt_kontext: { ...(quelle?.prompt_kontext || {}), kopie_von: quelle?.id || null },
    festlegungen: festlegungenFuerKopie(quelle?.festlegungen, name, am),
    festgezogen: Array.isArray(quelle?.festgezogen) ? quelle.festgezogen : [],
    dokument_bloecke_rev: quelle?.dokument_bloecke ? 1 : 0,
    status: 'entwurf',
    aktive_version_nr: 1,
    aktive_sub_nr: 0,
    created_by: userId,
    master_regelwerk: quelle?.master_regelwerk !== false
  };
}

export const skripteKopieDatenMethoden = {
  /**
   * Legt die Kopie an, schreibt ihre Version 1 und verknüpft sie mit dem Video.
   * Scheitert ein Schritt danach, wird die Kopie wieder gelöscht.
   * @returns {Promise<string>} Id der Kopie
   */
  async kopiereSkriptFuerVideo(skriptId, { videoId, creatorName = '' } = {}) {
    if (!skriptId || !videoId) throw new Error('Skript und Video sind nötig');
    const { data: quelle, error } = await this.db.from('skripte')
      .select(KOPIE_FELDER.join(', '))
      .eq('id', skriptId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!quelle) throw new Error('Skript nicht gefunden');
    if (quelle.prompt_kontext?.upload_status === 'lesen') {
      throw new Error('Das Skript wird noch aus der Datei gelesen. Kopieren geht danach.');
    }

    const { data: { user } } = await this.db.auth.getUser();
    const zeile = kopieZeile(quelle, { creatorName, userId: user?.id || null });
    const { data: kopie, error: insertError } = await this.db.from('skripte')
      .insert(zeile).select('id').single();
    if (insertError) throw new Error(insertError.message);

    try {
      const { rows } = planeVersionsRows({
        skript: { ...zeile, id: kopie.id },
        beschreibung: `Kopie von „${String(quelle.titel || 'Skript').trim()}“`,
        userId: user?.id || null
      });
      const { error: versionError } = await this.db.from('skript_versionen').insert(rows);
      if (versionError) throw new Error(versionError.message);
      await this.verknuepfeMitVideo(videoId, kopie.id, { freigegeben: false });
    } catch (err) {
      await this.db.from('skripte').delete().eq('id', kopie.id);
      throw err;
    }
    return kopie.id;
  }
};
