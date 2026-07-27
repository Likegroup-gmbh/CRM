// MarkeProduktService.js
// Datenzugriff fuer Produkte einer Marke. Ein Produkt ist eine Kollektion:
// Varianten (produkt_variante) und Bilder (produkt_bilder) haengen daran.
//
// Bilder liegen im Storage-Bucket "produkte". Drei Quellen laufen zusammen:
//   1. bereits gespeicherte Bilder (Edit-Modus)
//   2. manuell hochgeladene Dateien   -> werden zu WebP komprimiert
//   3. von der KI extrahierte Bilder  -> liegen unter _temp/ und werden verschoben

import { compressImage } from '../../../core/ImageCompressor.js';

export const PRODUKT_BUCKET = 'produkte';
export const PRODUKT_TEMP_PREFIX = '_temp';
export const MAX_BILDER = 5;

// Groesser als der Uploader-Standard (800px): Creator und KI muessen am
// Produktbild Details erkennen, nicht nur die Silhouette.
const BILD_KOMPRESSION = { maxWidth: 1200, maxHeight: 1200, quality: 0.85 };

export class MarkeProduktService {
  // --- Lesen ---

  /** Produkte der Marke inklusive Varianten-IDs und Bildern fuer die Tabelle. */
  static async loadForMarke(markeId) {
    const { data, error } = await window.supabase
      .from('produkt')
      .select(`
        *,
        varianten:produkt_variante(id),
        bilder:produkt_bilder(id, storage_pfad, position, ist_hauptbild, variante_id)
      `)
      .eq('marke_id', markeId)
      .order('name');

    if (error) throw error;
    return data || [];
  }

  /** Laedt ein einzelnes Produkt. markeId schuetzt gegen Deeplinks auf fremde Marken. */
  static async loadOne(produktId, markeId) {
    const { data, error } = await window.supabase
      .from('produkt')
      .select('*')
      .eq('id', produktId)
      .eq('marke_id', markeId)
      .maybeSingle();

    if (error) throw error;
    return data;
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

  static async create(data, markeId, unternehmenId = null) {
    const payload = { ...data, marke_id: markeId };
    // unternehmen_id ist kein Formularfeld, wird aus der Marke uebernommen
    if (unternehmenId) payload.unternehmen_id = unternehmenId;

    const result = await window.dataService.createEntity('produkt', payload);
    if (!result.success) throw new Error(result.error || 'Produkt konnte nicht angelegt werden');
    return result;
  }

  static async update(id, data) {
    const result = await window.dataService.updateEntity('produkt', id, data);
    if (!result.success) throw new Error(result.error || 'Produkt konnte nicht gespeichert werden');
    return result;
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
      const { error } = await window.supabase
        .from('produkt_bilder')
        .update({ position: bild.position ?? 0, ist_hauptbild: !!bild.ist_hauptbild })
        .eq('id', bild.id);
      if (error) throw error;
    }

    for (const bild of temp) {
      const zielPfad = `${produktId}/${crypto.randomUUID()}.webp`;
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
      let file = bild.file;
      if (!file) continue;

      try {
        file = await compressImage(file, BILD_KOMPRESSION);
      } catch (err) {
        console.warn('⚠️ Produktbild konnte nicht komprimiert werden, nutze Original:', err);
      }

      const zielPfad = `${produktId}/${crypto.randomUUID()}.webp`;
      const { error: upError } = await window.supabase.storage
        .from(PRODUKT_BUCKET)
        .upload(zielPfad, file, { cacheControl: '3600', upsert: true, contentType: file.type || 'image/webp' });
      if (upError) throw upError;

      const { error } = await window.supabase.from('produkt_bilder').insert([{
        produkt_id: produktId,
        storage_pfad: zielPfad,
        position: bild.position ?? 0,
        ist_hauptbild: !!bild.ist_hauptbild
      }]);
      if (error) throw error;
    }
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

    const zielPfad = `${produktId}/varianten/${varianteId}.webp`;
    const { error: upError } = await window.supabase.storage
      .from(PRODUKT_BUCKET)
      .upload(zielPfad, datei, { cacheControl: '3600', upsert: true, contentType: datei.type || 'image/webp' });
    if (upError) throw upError;

    if (altesBildId) {
      const { error } = await window.supabase
        .from('produkt_bilder')
        .update({ storage_pfad: zielPfad })
        .eq('id', altesBildId);
      if (error) throw error;
      return;
    }

    // Fremde Zeile derselben Variante entfernen, falls der Aufrufer sie nicht kannte
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
}
