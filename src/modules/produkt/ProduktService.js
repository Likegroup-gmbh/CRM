// ProduktService.js
// Datenzugriff fuer Produkte. Ein Produkt ist eine Kollektion:
// Varianten (produkt_variante) und Bilder (produkt_bilder) haengen daran.
//
// Besitzer ist das Unternehmen (unternehmen_id), die Marken-Zuordnung liegt in
// der Junction produkt_marke. Der Kontext entscheidet ueber den Filter:
//   { markeId }        -> nur Produkte dieser Marke (Marke-Detailseite)
//   { unternehmenId }  -> alle Produkte des Unternehmens, auch die einer Marke
//
// Bilder liegen im Storage-Bucket "produkte". Drei Quellen laufen zusammen:
//   1. bereits gespeicherte Bilder (Edit-Modus)
//   2. manuell hochgeladene Dateien   -> werden zu AVIF komprimiert
//   3. von der KI extrahierte Bilder  -> liegen unter _temp/ und werden verschoben
//
// AVIF nur, wo der Browser es encodieren kann (Chromium). Firefox und Safari
// liefern WebP - deshalb steht die Endung nie fest, sondern kommt aus dem
// tatsaechlichen Typ der komprimierten Datei.

import { compressImage, extensionForType } from '../../core/ImageCompressor.js';

export const PRODUKT_BUCKET = 'produkte';
export const PRODUKT_TEMP_PREFIX = '_temp';
export const MAX_BILDER = 5;

// Groesser als der Uploader-Standard (800px): Creator und KI muessen am
// Produktbild Details erkennen, nicht nur die Silhouette.
const BILD_KOMPRESSION = {
  maxWidth: 1200,
  maxHeight: 1200,
  quality: 0.85,
  format: 'image/avif',
  fallbackFormat: 'image/webp'
};

const MARKEN_SELECT = 'marken:produkt_marke(marke_id, marke:marke_id(id, markenname))';

const TABELLEN_SELECT = `
  varianten:produkt_variante(id),
  bilder:produkt_bilder(id, storage_pfad, position, ist_hauptbild, variante_id)
`;

export class ProduktService {
  // --- Lesen ---

  /** Alle Produkte ueber alle Unternehmen, fuer die Top-Level-Liste. */
  static async loadAll() {
    const { data, error } = await window.supabase
      .from('produkt')
      .select(`*, unternehmen:unternehmen_id(id, firmenname, logo_url), ${MARKEN_SELECT}, ${TABELLEN_SELECT}`)
      .order('name');

    if (error) throw error;
    return data || [];
  }

  /** Produkte des Kontexts inklusive Varianten-IDs und Bildern fuer die Tabelle. */
  static async loadForContext({ unternehmenId = null, markeId = null } = {}) {
    let query = window.supabase.from('produkt');

    if (markeId) {
      query = query
        .select(`*, treffer:produkt_marke!inner(marke_id), ${MARKEN_SELECT}, ${TABELLEN_SELECT}`)
        .eq('treffer.marke_id', markeId);
    } else {
      query = query
        .select(`*, ${MARKEN_SELECT}, ${TABELLEN_SELECT}`)
        .eq('unternehmen_id', unternehmenId);
    }

    const { data, error } = await query.order('name');

    if (error) throw error;
    return data || [];
  }

  /** Laedt ein einzelnes Produkt. Im Standalone ohne Kontext, sonst schuetzt der Kontext gegen fremde Deeplinks. */
  static async loadOne(produktId, { unternehmenId = null, markeId = null } = {}) {
    let query = window.supabase.from('produkt');

    if (markeId) {
      query = query
        .select('*, treffer:produkt_marke!inner(marke_id)')
        .eq('treffer.marke_id', markeId);
    } else if (unternehmenId) {
      query = query.select('*').eq('unternehmen_id', unternehmenId);
    } else {
      query = query.select('*');
    }

    const { data, error } = await query.eq('id', produktId).maybeSingle();

    if (error) throw error;
    return data;
  }

  /** Marken-IDs eines Produkts, fuer die Vorbelegung des Multiselects. */
  static async loadMarkenIds(produktId) {
    const { data, error } = await window.supabase
      .from('produkt_marke')
      .select('marke_id')
      .eq('produkt_id', produktId);

    if (error) throw error;
    return (data || []).map(row => row.marke_id);
  }

  static async loadVarianten(produktId) {
    const { data, error } = await window.supabase
      .from('produkt_variante')
      .select('*')
      .eq('produkt_id', produktId)
      .order('position')
      .order('created_at');

    if (error) throw error;
    return data || [];
  }

  static async loadBilder(produktId) {
    const { data, error } = await window.supabase
      .from('produkt_bilder')
      .select('*')
      .eq('produkt_id', produktId)
      .order('position');

    if (error) throw error;
    return data || [];
  }

  // --- Schreiben: Kollektion ---

  static async create(data, { unternehmenId = null } = {}) {
    const payload = { ...data, unternehmen_id: unternehmenId };
    delete payload.marke_ids;

    const result = await window.dataService.createEntity('produkt', payload);
    if (!result.success) throw new Error(result.error || 'Produkt konnte nicht angelegt werden');
    return result;
  }

  static async update(id, data) {
    const payload = { ...data };
    delete payload.marke_ids;
    // unternehmen_id steht als Hidden-Feld im Formular und darf nicht wandern
    delete payload.unternehmen_id;

    const result = await window.dataService.updateEntity('produkt', id, payload);
    if (!result.success) throw new Error(result.error || 'Produkt konnte nicht gespeichert werden');
    return result;
  }

  /** Setzt die Marken-Zuordnung auf genau diese Liste. */
  static async saveMarken(produktId, markeIds = []) {
    const { error: deleteError } = await window.supabase
      .from('produkt_marke')
      .delete()
      .eq('produkt_id', produktId);
    if (deleteError) throw deleteError;

    const eindeutige = [...new Set(markeIds.filter(Boolean))];
    if (!eindeutige.length) return;

    const { error } = await window.supabase
      .from('produkt_marke')
      .insert(eindeutige.map(marke_id => ({ produkt_id: produktId, marke_id })));
    if (error) throw error;
  }

  /**
   * Varianten und Bilder-Zeilen gehen per CASCADE mit, die Storage-Dateien
   * nicht. Erst die DB loeschen: schlaegt das fehl, sind die Bilder noch da.
   */
  static async remove(id) {
    const { error } = await window.supabase.from('produkt').delete().eq('id', id);
    if (error) throw error;
    await this.removeStorageFolder(id);
  }

  // --- Schreiben: Varianten ---

  /**
   * Synchronisiert die Varianten eines Produkts mit dem Stand aus dem Panel.
   * Vorhandene werden aktualisiert, fehlende geloescht, neue eingefuegt -
   * so bleiben IDs (und damit Variantenbilder) stabil.
   * @param {string} produktId
   * @param {Array<Object>} varianten - Eintraege mit optionaler id
   */
  static async saveVarianten(produktId, varianten = []) {
    const bestehende = await this.loadVarianten(produktId);
    const behaltenIds = varianten.map(v => v.id).filter(Boolean);

    const zuLoeschen = bestehende
      .filter(v => !behaltenIds.includes(v.id))
      .map(v => v.id);

    if (zuLoeschen.length) {
      const { error } = await window.supabase
        .from('produkt_variante')
        .delete()
        .in('id', zuLoeschen);
      if (error) throw error;
    }

    for (const [index, variante] of varianten.entries()) {
      const payload = {
        produkt_id: produktId,
        name: variante.name,
        modell_kompatibilitaet: variante.modell_kompatibilitaet || null,
        farbe: variante.farbe || null,
        preis: this.toNumber(variante.preis),
        uvp: this.toNumber(variante.uvp),
        merkmal: variante.merkmal || null,
        position: index
      };

      if (variante.id) {
        const { error } = await window.supabase
          .from('produkt_variante')
          .update(payload)
          .eq('id', variante.id);
        if (error) throw error;
      } else {
        const { error } = await window.supabase
          .from('produkt_variante')
          .insert([payload]);
        if (error) throw error;
      }
    }
  }

  // --- Schreiben: Bilder ---

  /**
   * Speichert die Bilder eines Produkts.
   * @param {string} produktId
   * @param {Object} bilder
   * @param {Array<Object>} bilder.bestehende - {id, position, ist_hauptbild} der behaltenen Bilder
   * @param {Array<string>} bilder.geloeschteIds - IDs, deren Zeile und Datei weg sollen
   * @param {Array<Object>} bilder.temp - {storage_pfad, quelle_url, position, ist_hauptbild} aus der KI-Extraktion
   * @param {Array<Object>} bilder.neue - {file, position, ist_hauptbild} aus dem Uploader
   */
  static async saveBilder(produktId, { bestehende = [], geloeschteIds = [], temp = [], neue = [] } = {}) {
    if (geloeschteIds.length) {
      const { data: rows } = await window.supabase
        .from('produkt_bilder')
        .select('storage_pfad')
        .in('id', geloeschteIds);

      const pfade = (rows || []).map(r => r.storage_pfad).filter(Boolean);
      if (pfade.length) {
        await window.supabase.storage.from(PRODUKT_BUCKET).remove(pfade);
      }

      const { error } = await window.supabase
        .from('produkt_bilder')
        .delete()
        .in('id', geloeschteIds);
      if (error) throw error;
    }

    for (const bild of bestehende) {
      if (!bild.id) continue;
      const felder = { position: bild.position ?? 0, ist_hauptbild: !!bild.ist_hauptbild };

      // Verkleinerte Fassung: neuer Pfad (die Endung kann sich aendern), danach
      // die alte Datei raeumen. Die DB-Zeile bleibt dieselbe.
      if (bild.ersatzFile) {
        const alt = await this.storagePfadFuer(bild.id);
        felder.storage_pfad = await this.uploadBild(produktId, bild.ersatzFile);
        if (alt && alt !== felder.storage_pfad) {
          await window.supabase.storage.from(PRODUKT_BUCKET).remove([alt]);
        }
      }

      const { error } = await window.supabase
        .from('produkt_bilder')
        .update(felder)
        .eq('id', bild.id);
      if (error) throw error;
    }

    for (const bild of temp) {
      // move() konvertiert nicht - die Endung der Quelle bleibt gueltig.
      const endung = bild.storage_pfad.split('.').pop() || 'webp';
      const zielPfad = `${produktId}/${crypto.randomUUID()}.${endung}`;
      const { error: moveError } = await window.supabase.storage
        .from(PRODUKT_BUCKET)
        .move(bild.storage_pfad, zielPfad);

      // Ein abgelaufenes Temp-Bild darf das Speichern nicht abbrechen
      if (moveError) {
        console.warn('⚠️ Extrahiertes Produktbild konnte nicht übernommen werden:', moveError.message);
        continue;
      }

      const { error } = await window.supabase.from('produkt_bilder').insert([{
        produkt_id: produktId,
        storage_pfad: zielPfad,
        quelle_url: bild.quelle_url || null,
        position: bild.position ?? 0,
        ist_hauptbild: !!bild.ist_hauptbild
      }]);
      if (error) throw error;
    }

    for (const bild of neue) {
      if (!bild.file) continue;

      const zielPfad = await this.uploadBild(produktId, bild.file);

      const { error } = await window.supabase.from('produkt_bilder').insert([{
        produkt_id: produktId,
        storage_pfad: zielPfad,
        quelle_url: bild.quelle_url || null,
        position: bild.position ?? 0,
        ist_hauptbild: !!bild.ist_hauptbild
      }]);
      if (error) throw error;
    }
  }

  /**
   * Komprimiert und legt eine Bilddatei unter einem neuen Pfad ab.
   * @returns {Promise<string>} storage_pfad
   */
  static async uploadBild(produktId, datei) {
    let file = datei;
    try {
      file = await compressImage(file, BILD_KOMPRESSION);
    } catch (err) {
      console.warn('⚠️ Produktbild konnte nicht komprimiert werden, nutze Original:', err);
    }

    const zielPfad = `${produktId}/${crypto.randomUUID()}.${extensionForType(file.type)}`;
    const { error } = await window.supabase.storage
      .from(PRODUKT_BUCKET)
      .upload(zielPfad, file, { cacheControl: '3600', upsert: true, contentType: file.type });
    if (error) throw error;

    return zielPfad;
  }

  static async storagePfadFuer(bildId) {
    const { data } = await window.supabase
      .from('produkt_bilder')
      .select('storage_pfad')
      .eq('id', bildId)
      .maybeSingle();
    return data?.storage_pfad || null;
  }

  /**
   * Legt das Bild einer Variante ab. Pro Variante gibt es genau ein Bild,
   * ein vorhandenes wird also ersetzt.
   */
  static async saveVarianteBild(produktId, varianteId, file, altesBildId = null) {
    let datei = file;
    try {
      datei = await compressImage(file, BILD_KOMPRESSION);
    } catch (err) {
      console.warn('⚠️ Variantenbild konnte nicht komprimiert werden, nutze Original:', err);
    }

    // Fester Name je Variante, aber die Endung folgt dem Format. Wechselt sie,
    // wuerde upsert die alte Datei stehen lassen - daher unten das remove().
    const zielPfad = `${produktId}/varianten/${varianteId}.${extensionForType(datei.type)}`;
    const { error: upError } = await window.supabase.storage
      .from(PRODUKT_BUCKET)
      .upload(zielPfad, datei, { cacheControl: '3600', upsert: true, contentType: datei.type });
    if (upError) throw upError;

    if (altesBildId) {
      const alt = await this.storagePfadFuer(altesBildId);
      if (alt && alt !== zielPfad) {
        await window.supabase.storage.from(PRODUKT_BUCKET).remove([alt]);
      }

      const { error } = await window.supabase
        .from('produkt_bilder')
        .update({ storage_pfad: zielPfad })
        .eq('id', altesBildId);
      if (error) throw error;
      return;
    }

    // Fremde Zeile derselben Variante entfernen, falls der Aufrufer sie nicht kannte
    const { data: fremde } = await window.supabase
      .from('produkt_bilder')
      .select('storage_pfad')
      .eq('variante_id', varianteId);
    const verwaist = (fremde || []).map(r => r.storage_pfad).filter(p => p && p !== zielPfad);
    if (verwaist.length) {
      await window.supabase.storage.from(PRODUKT_BUCKET).remove(verwaist);
    }
    await window.supabase.from('produkt_bilder').delete().eq('variante_id', varianteId);

    const { error } = await window.supabase.from('produkt_bilder').insert([{
      produkt_id: produktId,
      variante_id: varianteId,
      storage_pfad: zielPfad,
      position: 0,
      ist_hauptbild: false
    }]);
    if (error) throw error;
  }

  /**
   * Raeumt alle Dateien eines Produkt-Ordners im Bucket, inklusive des
   * Unterordners "varianten". list() liefert nur eine Ebene.
   */
  static async removeStorageFolder(produktId) {
    try {
      for (const prefix of [`${produktId}`, `${produktId}/varianten`]) {
        const { data: files } = await window.supabase.storage.from(PRODUKT_BUCKET).list(prefix);
        const pfade = (files || [])
          .filter(f => f.id) // Ordner-Platzhalter haben keine id
          .map(f => `${prefix}/${f.name}`);
        if (pfade.length) {
          await window.supabase.storage.from(PRODUKT_BUCKET).remove(pfade);
        }
      }
    } catch (err) {
      console.warn('⚠️ Produktbilder im Storage konnten nicht entfernt werden:', err);
    }
  }

  // --- Anzeige-Helfer ---

  static publicUrl(storagePfad) {
    if (!storagePfad) return null;
    const { data } = window.supabase.storage.from(PRODUKT_BUCKET).getPublicUrl(storagePfad);
    return data?.publicUrl || null;
  }

  /** Hauptbild der Kollektion, sonst das erste Bild. */
  static hauptbild(produkt) {
    const bilder = (produkt?.bilder || []).filter(b => !b.variante_id);
    if (!bilder.length) return null;
    return bilder.find(b => b.ist_hauptbild)
      || [...bilder].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0];
  }

  /** "29,90 €", "29,90 – 49,90 €" oder "-" */
  static preisLabel(produkt) {
    const von = this.toNumber(produkt?.preis_von);
    const bis = this.toNumber(produkt?.preis_bis);
    if (von != null && bis != null && bis !== von) return `${this.formatEuro(von)} – ${this.formatEuro(bis)}`;
    if (von != null) return this.formatEuro(von);
    if (bis != null) return `bis ${this.formatEuro(bis)}`;
    return '-';
  }

  static formatEuro(value) {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
  }

  static toNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  static label(produkt) {
    return produkt?.name || 'Produkt';
  }

  /** Markennamen aus dem eingebetteten Junction-Select, fuer die Tabelle. */
  static markenNamen(produkt) {
    return (produkt?.marken || [])
      .map(eintrag => eintrag?.marke?.markenname)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'de'));
  }
}
