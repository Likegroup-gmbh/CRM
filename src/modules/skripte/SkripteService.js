// SkripteService.js
// Datenzugriff fuer den Skript-Generator (Layer 1).
// Alle Queries laufen ueber window.supabase (RLS: intern voll, Kunden nur eigener Scope).
// Verhalten liegt in den Prototype-Mixins unter ./service.

import { FUNNEL_STUFEN, VIDEO_LAENGEN, SKRIPT_BEREICHE, MASTER_BEREICHE } from './skripteKonstanten.js';
import { berechneSkriptNummern } from './skriptNummern.js';
import { STATUS_LABELS } from './SkripteUtils.js';
import { SKRIPT_BILDER_BUCKET } from './editor/dokument/skriptBild.js';
import { skripteSkriptDatenMethoden } from './service/skripteSkriptDaten.js';
import { skripteGeneratorDatenMethoden } from './service/skripteGeneratorDaten.js';
import { skripteEditorDatenMethoden } from './service/skripteEditorDaten.js';

export { FUNNEL_STUFEN, VIDEO_LAENGEN, SKRIPT_BEREICHE, MASTER_BEREICHE };

export { SKRIPT_BILDER_BUCKET };

export class SkripteService {
  get db() {
    return window.supabase;
  }

  // ------------------------------------------------------------------
  // Stammdaten fuer Pick-and-pull
  // ------------------------------------------------------------------
  async loadUnternehmen() {
    const allowedIds = await window.getAllowedUnternehmenIds();
    if (allowedIds !== null && allowedIds.length === 0) return [];

    let q = this.db.from('unternehmen')
      .select('id, firmenname, branche_id').order('firmenname');
    if (allowedIds !== null) q = q.in('id', allowedIds);
    const { data } = await q;
    return data || [];
  }

  async loadMarken(unternehmenId) {
    const allowedIds = await window.getAllowedMarkenIds();
    if (allowedIds !== null && allowedIds.length === 0) return [];

    let q = this.db.from('marke')
      .select('id, markenname, branche_id, unternehmen_id').order('markenname');
    if (unternehmenId) q = q.eq('unternehmen_id', unternehmenId);
    if (allowedIds !== null) q = q.in('id', allowedIds);
    const { data } = await q;
    return data || [];
  }

  /**
   * Konzepte zum Create-Drawer. Ohne Unternehmen keine Treffer; Kampagne
   * filtert den Prefill aus dem Kampagnen-Workflow.
   */
  async loadKonzepte({ unternehmenId, kampagneId = null, produktionId = null } = {}) {
    if (!unternehmenId) return [];

    let q = this.db.from('strategie')
      .select('id, name, unternehmen_id, marke_id, kampagne_id, briefing_id')
      .eq('unternehmen_id', unternehmenId);
    if (kampagneId) q = q.eq('kampagne_id', kampagneId);
    if (produktionId) q = q.eq('produktion_id', produktionId);

    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  }

  /** Picker-Loader (Scope-Auswahl etc.): nur Label-Felder, kein select('*'). */
  async loadPersonas() {
    const { data } = await this.db.from('personas').select('id, name, oberbegriff')
      .order('oberbegriff', { nullsFirst: false }).order('name');
    return data || [];
  }

  /**
   * Strategie-Items der Kampagne fuer den Vorlagen-Picker (ein Roundtrip
   * via Inner-Join). Bewusst OHNE transkript/caption: das sind die dicken
   * Felder, die der Picker nicht anzeigt. transkript_quelle reicht als
   * "hat Transkript"-Flag. Das volle Item kommt erst beim Select ueber
   * loadStrategieItem.
   * nicht_umsetzen bleibt draussen - die sollen keine Vorlage werden.
   */
  async loadStrategieItems(kampagneId) {
    if (!kampagneId) return [];

    const { data, error } = await this.db.from('strategie_items')
      .select('id, strategie_id, video_link, plattform, beschreibung, kurzbeschreibung, transkript_quelle, creator_name, creator_auswahl_item_id, screenshot_url, nicht_umsetzen, strategie:strategie_id!inner(id, name, kampagne_id)')
      .eq('strategie.kampagne_id', kampagneId)
      .order('sortierung');

    if (error) throw new Error(error.message);
    return (data || []).filter((item) => !item.nicht_umsetzen);
  }

  /**
   * Videoideen, die im Konzept fuer die Skripterstellung freigegeben sind.
   * Ohne Konzept keine Treffer – der Drawer filtert immer auf ein Konzept.
   * Ein Casting-Eintrag ist keine Voraussetzung.
   */
  async loadFreigegebeneVideoideen({ unternehmenId, strategieId = null } = {}) {
    if (!unternehmenId || !strategieId) return [];

    const q = this.db.from('strategie_items')
      .select(`
        id, strategie_id, video_link, plattform, beschreibung, kurzbeschreibung, transkript_quelle,
        creator_name, creator_auswahl_item_id, produkt_id, screenshot_url, nicht_umsetzen, skript_freigabe, funnel_stufe, persona_id,
        videolaenge_von, videolaenge_bis,
        casting_eintrag:creator_auswahl_item_id(id, name, persona_id, creator_id, creator:creator_id(vorname, nachname)),
        strategie:strategie_id!inner(
          id, name, unternehmen_id, marke_id, kampagne_id, briefing_id,
          unternehmen:unternehmen_id(id, firmenname, branche_id),
          marke:marke_id(id, markenname, branche_id),
          kampagne:kampagne_id(id, kampagnenname, eigener_name),
          briefing:briefing_id(id, aktivierung_name, bereich, persona_ids, im_funnel_stufen, pa_funnel_stufen, pa_videolaengen, videolaengen, videolaenge_text, videolaenge_von, videolaenge_bis, videolaenge_funnel, im_formatvorgaben, os_formatvorgaben)
        )
      `)
      .eq('skript_freigabe', true)
      .eq('nicht_umsetzen', false)
      .eq('ist_vorschlag', false)
      .eq('strategie.unternehmen_id', unternehmenId)
      .eq('strategie_id', strategieId);

    const { data, error } = await q.order('sortierung');
    if (error) throw new Error(error.message);

    const items = data || [];
    if (items.length === 0) return [];

    const { data: skripte, error: skriptErr } = await this.db.from('skripte')
      .select('id, titel, status, strategie_item_id, created_at')
      .in('strategie_item_id', items.map((i) => i.id))
      .order('created_at', { ascending: true });
    if (skriptErr) throw new Error(skriptErr.message);

    const proItem = new Map();
    for (const sk of skripte || []) {
      const liste = proItem.get(sk.strategie_item_id) || [];
      liste.push({ id: sk.id, titel: sk.titel, status: sk.status, status_label: STATUS_LABELS[sk.status] || sk.status || '–' });
      proItem.set(sk.strategie_item_id, liste);
    }

    // Gleiche Nummern wie in Liste/Editor: Rang unter allen Ideen des Konzepts
    const nummern = await this.loadKonzeptNummern(strategieId, [...proItem.keys()]);

    return items.map((item) => ({
      ...item,
      hasSkript: proItem.has(item.id),
      skripte: proItem.get(item.id) || [],
      skript_nr: nummern.get(item.id) ?? null
    }));
  }

  /** Skript-Nummern (Map itemId -> Nr.) aller Ideen eines Konzepts. */
  async loadKonzeptNummern(strategieId, itemIdsMitSkript = []) {
    if (!strategieId) return new Map();
    const { data, error } = await this.db.from('strategie_items')
      .select('id, strategie_id, sortierung, skript_freigabe, nicht_umsetzen, ist_vorschlag')
      .eq('strategie_id', strategieId);
    if (error) {
      console.warn('Skript-Nummern konnten nicht geladen werden:', error.message);
      return new Map();
    }
    return berechneSkriptNummern(data || [], itemIdsMitSkript);
  }

  /** Einzelnes Strategie-Item voll (mit Transkript) - erst beim Select. */
  async loadStrategieItem(id) {
    if (!id) return null;
    const { data, error } = await this.db.from('strategie_items')
      .select('id, strategie_id, video_link, plattform, beschreibung, kurzbeschreibung, transkript, caption, creator_name, creator_auswahl_item_id, produkt_id, screenshot_url, funnel_stufe, persona_id, videolaenge_von, videolaenge_bis')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data || null;
  }

  /** Konzept (strategie_id) einer Videoidee, ohne Transkript. Fuer den Editor-Prefill. */
  async loadStrategieIdVonItem(itemId) {
    if (!itemId) return null;
    const { data, error } = await this.db.from('strategie_items')
      .select('strategie_id')
      .eq('id', itemId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data?.strategie_id || null;
  }

  /**
   * Accepted Produkt-Fits einer Persona. 0/1/n entscheidet der Resolver,
   * nicht der Caller.
   */
  async loadAcceptedProduktIds(personaId) {
    if (!personaId) return [];

    const { data, error } = await this.db.from('produkt_persona_vorschlag')
      .select('produkt_id')
      .eq('persona_id', personaId)
      .eq('status', 'accepted');
    if (error) throw new Error(error.message);
    return [...new Set((data || []).map((r) => r.produkt_id).filter(Boolean))];
  }

  /**
   * Persona nachträglich am Skript setzen (Skript ohne Persona an Videoidee und
   * Casting). Spalte und generator_payload, damit Rückfragen und Generierung sie
   * lesen. Produkt nur, wenn keins gesetzt ist und genau ein Fit existiert.
   */
  async setzeSkriptPersona(skript, personaId) {
    if (!skript?.id || !personaId) return null;
    const pk = skript.prompt_kontext || {};
    let produktId = skript.produkt_id || pk.generator_payload?.produkt_id || null;
    if (!produktId) {
      const fits = await this.loadAcceptedProduktIds(personaId);
      if (fits.length === 1) produktId = fits[0];
    }
    const patch = {
      persona_id: personaId,
      prompt_kontext: {
        ...pk,
        generator_payload: {
          ...(pk.generator_payload || {}),
          persona_id: personaId,
          ...(produktId ? { produkt_id: produktId } : {})
        }
      }
    };
    if (produktId && !skript.produkt_id) patch.produkt_id = produktId;
    await this.updateSkript(skript.id, patch);
    return { personaId, produktId };
  }

  /** Personas des Briefings als Auswahl, solange das Skript keine Persona hat. */
  async attachPersonaOptionen(skript) {
    const ids = skript?.briefing?.persona_ids;
    if (!skript || skript.persona_id || !Array.isArray(ids) || !ids.length) return skript;
    const { data, error } = await this.db.from('personas')
      .select('id, name, oberbegriff').in('id', ids);
    if (error || !data?.length) return skript;
    return { ...skript, persona_optionen: data };
  }

  /** Anzeige-Label einer Persona: "Oberbegriff (Name)", Fallback nur Name. */
  personaLabel(p) {
    if (!p) return '';
    return p.oberbegriff ? `${p.oberbegriff} (${p.name})` : p.name;
  }

  async loadBranchen() {
    const { data } = await this.db.from('branchen').select('id, name').order('name');
    return data || [];
  }

  async createPersona(payload) {
    const { data, error } = await this.db.from('personas').insert(payload).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async updatePersona(id, patch) {
    const { error } = await this.db.from('personas').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async deletePersona(id) {
    const { error } = await this.db.from('personas').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
}

Object.assign(
  SkripteService.prototype,
  skripteSkriptDatenMethoden,
  skripteGeneratorDatenMethoden,
  skripteEditorDatenMethoden
);

export const skripteService = new SkripteService();
