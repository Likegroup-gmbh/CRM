// Skript-Anschreiben: Empfaenger inkl. Ansprechpartner, Umfang/Anhang neben der Vorlage.
// Der Skript-Pool liegt einmal am prepared-Objekt. Scope, PDF und Versand lesen ihn.

import { loadAnsprechpartnerRows } from '../snapshot.js';
import {
  anschreibenCreatorId, castingGiltFuerAnschreiben, creatorFuerAnschreiben, createSkriptAnhang, sanitizeSkriptFilename
} from '../../../modules/skripte/SkriptPdf.js';
import { pdfBloecke } from '../../../modules/skripte/editor/dokument/blockModell.js';
import { skriptBildPublicUrl } from '../../../modules/skripte/editor/dokument/skriptBild.js';
import {
  creatorIdsImPool, creatorProfileFuerSkript, loadManagementScope, poolCreators, skripteFuerEmpfaenger
} from './skriptEmpfaenger.js';

export {
  creatorIdsImPool, creatorProfileFuerSkript, loadManagementScope, poolCreators, skripteFuerEmpfaenger
} from './skriptEmpfaenger.js';

const CREATOR_FELDER = 'id, vorname, nachname, mail, instagram, tiktok, profilbild_url, profilbild_thumb_url';

const SKRIPT_SELECT = `
  id, titel, created_at, produktion_id, hook, hauptteil, cta, hook_visuell, hauptteil_visuell, cta_visuell,
  rezept, text_hook, caption, dokument_bloecke,
  unternehmen:unternehmen_id(firmenname, logo_url),
  marke:marke_id(markenname, logo_url),
  produkt:produkt_id(name),
  kampagne:kampagne_id(kampagnenname, eigener_name),
  strategie_item:strategie_item_id(
    id, creator_name, video_link,
    casting_eintrag:creator_auswahl_item_id(
      id, name, link_instagram, link_tiktok,
      creator:creator_id(${CREATOR_FELDER})
    )
  )
`;

function kampagneName(skript) {
  return skript?.kampagne?.kampagnenname || skript?.kampagne?.eigener_name || '';
}

function customerOf(skript) {
  return {
    customerLogoUrl: skript?.marke?.logo_url || skript?.unternehmen?.logo_url || '',
    customerName: skript?.marke?.markenname || skript?.unternehmen?.firmenname || '',
  };
}

/** Umfang, der mit den vorhandenen IDs auch möglich ist. Sonst fällt er auf 'einzeln' zurück. */
export function effektiverUmfang(anhang) {
  if (anhang?.umfang === 'kampagne' && anhang.kampagneId) return 'kampagne';
  if (anhang?.umfang === 'produktion' && anhang.produktionId) return 'produktion';
  return 'einzeln';
}

export function istPool(anhang) {
  return effektiverUmfang(anhang) !== 'einzeln';
}

/** Name für {{skript}} und Dateiname: Produktion oder Kampagne, bei einzeln leer. */
function umfangName(anhang) {
  const umfang = effektiverUmfang(anhang);
  if (umfang === 'produktion') return anhang.produktionName || 'Produktion';
  if (umfang === 'kampagne') return anhang.kampagneName || '';
  return '';
}

/** Der Pool wird einmal am weitesten Umfang geladen, gefiltert wird clientseitig. */
function poolQuery(prepared) {
  const anhang = prepared.anhang || {};
  let umfang = 'einzeln';
  if (anhang.kampagneId) umfang = 'kampagne';
  else if (anhang.produktionId) umfang = 'produktion';
  return { dokumentId: prepared.dokumentId, anhang: { ...anhang, umfang } };
}

export function itemsForAnhang(items, prepared) {
  const anhang = prepared.anhang;
  const umfang = effektiverUmfang(anhang);
  if (umfang === 'kampagne') return items;
  if (umfang === 'produktion') {
    return items.filter((item) => item.produktionId === anhang.produktionId);
  }
  return items.filter((item) => item.id === prepared.dokumentId);
}

async function loadPool(db, prepared) {
  const items = await loadSkriptPdfItems(db, poolQuery(prepared));
  const managements = await loadManagementScope(db, creatorIdsImPool(items));
  return {
    items,
    managements,
    managementCreators: Object.fromEntries(managements.map((m) => [m.id, m.creatorIds])),
  };
}

function ensureSkriptPool(db, prepared) {
  if (!prepared._poolPromise) {
    prepared._poolPromise = loadPool(db, prepared).catch((err) => {
      prepared._poolPromise = null;
      throw err;
    });
  }
  return prepared._poolPromise;
}

function ensureAnsprechpartner(db, prepared) {
  if (!prepared._ansprechpartnerPromise) {
    prepared._ansprechpartnerPromise = loadAnsprechpartnerRows(db, {
      unternehmenId: prepared.unternehmenId,
      markeId: prepared.markeId,
    }).catch((err) => {
      prepared._ansprechpartnerPromise = null;
      throw err;
    });
  }
  return prepared._ansprechpartnerPromise;
}

function scopeFromPool(pool, prepared, ansprechpartner) {
  const items = itemsForAnhang(pool.items, prepared);
  const { creators, skipped } = poolCreators(items);
  const ids = new Set(creatorIdsImPool(items));
  const managements = pool.managements
    .map((m) => ({ ...m, creatorIds: m.creatorIds.filter((id) => ids.has(id)) }))
    .filter((m) => m.creatorIds.length);
  return {
    creators,
    managements,
    managementCreators: Object.fromEntries(managements.map((m) => [m.id, m.creatorIds])),
    kampagne: prepared.anhang?.kampagneId
      ? {
        id: prepared.anhang.kampagneId,
        label: umfangName(prepared.anhang) || prepared.anhang.kampagneName || 'Kampagne',
      }
      : null,
    skippedCreator: skipped,
    ansprechpartner: ansprechpartner?.rows || [],
    skippedAnsprechpartner: ansprechpartner?.skipped || 0,
  };
}

export async function loadPreparedSkriptScope(db, prepared) {
  const [pool, ansprechpartner] = await Promise.all([
    ensureSkriptPool(db, prepared),
    ensureAnsprechpartner(db, prepared).catch((err) => {
      console.error('Ansprechpartner laden fehlgeschlagen:', err);
      return { rows: [], skipped: 0 };
    }),
  ]);
  return scopeFromPool(pool, prepared, ansprechpartner);
}

async function pdfFromPool(db, prepared, empfaenger) {
  const pool = await ensureSkriptPool(db, prepared);
  let subset = itemsForAnhang(pool.items, prepared);
  if (empfaenger) {
    subset = skripteFuerEmpfaenger(subset, empfaenger, pool.managementCreators);
  }
  if (!subset.length) return { empty: true };
  const proSkript = Boolean(istPool(prepared.anhang) && prepared.anhang?.proSkript);
  return createSkriptAnhang(subset, { dateiname: anhangDateiname(prepared, proSkript), proSkript });
}

function anhangDateiname(prepared, proSkript) {
  if (istPool(prepared.anhang) && !proSkript) {
    return sanitizeSkriptFilename(`Skripte ${umfangName(prepared.anhang) || prepared.dokumentName}`);
  }
  return sanitizeSkriptFilename(prepared.dokumentName);
}

export function renderSkriptSchalter(container, anhang, onChange) {
  if (!anhang?.kampagneId && !anhang?.produktionId) {
    container.innerHTML = '';
    return;
  }
  const optionen = [`<option value="einzeln">Nur dieses Skript</option>`];
  if (anhang.produktionId) {
    optionen.push('<option value="produktion">Alle Skripte dieser Produktion</option>');
  }
  if (anhang.kampagneId) {
    optionen.push('<option value="kampagne">Alle Skripte dieser Kampagne</option>');
  }
  container.innerHTML = `
    <div class="anschreiben-schalter">
      <span class="toggle-text">Umfang</span>
      <select class="form-select" data-skript-umfang>${optionen.join('')}</select>
    </div>
    <div class="anschreiben-schalter" data-skript-anhang-wrap hidden>
      <span class="toggle-text">Eine PDF pro Skript</span>
      <label class="toggle-switch">
        <input type="checkbox" data-skript-anhang>
        <span class="toggle-slider"></span>
      </label>
    </div>
  `;
  const umfang = container.querySelector('[data-skript-umfang]');
  const anhangWrap = container.querySelector('[data-skript-anhang-wrap]');
  const anhangInput = container.querySelector('[data-skript-anhang]');
  umfang.value = effektiverUmfang(anhang);
  anhangWrap.hidden = !istPool(anhang);
  umfang.addEventListener('change', () => {
    anhang.umfang = umfang.value;
    anhangWrap.hidden = !istPool(anhang);
    onChange?.();
  });
  anhangInput.addEventListener('change', () => {
    anhang.proSkript = anhangInput.checked;
    onChange?.();
  });
}

export async function loadSkriptPdfItems(db, { dokumentId, anhang }) {
  const umfang = effektiverUmfang(anhang);
  let query = db.from('skripte').select(SKRIPT_SELECT);
  if (umfang === 'kampagne') {
    query = query.eq('kampagne_id', anhang.kampagneId).order('created_at', { ascending: true });
  } else if (umfang === 'produktion') {
    query = query.eq('produktion_id', anhang.produktionId).order('created_at', { ascending: true });
  } else {
    query = query.eq('id', dokumentId);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message || 'Skripte konnten nicht geladen werden');
  const skripte = Array.isArray(data) ? data : (data ? [data] : []);
  if (!skripte.length) throw new Error('Skript nicht gefunden');

  const ids = skripte.map((skript) => skript.id).filter(Boolean);
  const verknuepfungen = new Map();
  if (ids.length) {
    const { data: videos, error: videoError } = await db
      .from('kooperation_videos')
      .select(`skript_id, position, kooperation:kooperation_id(creator:creator_id(${CREATOR_FELDER}))`)
      .in('skript_id', ids);
    if (videoError) throw new Error(videoError.message || 'Creator konnte nicht geladen werden');
    for (const row of videos || []) {
      const list = verknuepfungen.get(row.skript_id) || [];
      list.push(row);
      verknuepfungen.set(row.skript_id, list);
    }
  }

  return skripte.map((skript) => {
    const links = verknuepfungen.get(skript.id) || [];
    const creators = creatorProfileFuerSkript(skript, links);
    const creator = creatorFuerAnschreiben(skript, links);
    const castingGilt = castingGiltFuerAnschreiben(skript, links);
    const creatorId = anschreibenCreatorId(skript, links);
    return {
      id: skript.id,
      produktionId: skript.produktion_id || null,
      titel: skript.titel || 'Skript',
      hook: skript.hook || '',
      hauptteil: skript.hauptteil || '',
      cta: skript.cta || '',
      hook_visuell: skript.hook_visuell || '',
      hauptteil_visuell: skript.hauptteil_visuell || '',
      cta_visuell: skript.cta_visuell || '',
      rezept: skript.rezept || '',
      text_hook: skript.text_hook || '',
      caption: skript.caption || '',
      creators,
      creatorIds: creators.map((c) => c.id),
      creator,
      creatorId,
      instagram: creator?.instagram || '',
      tiktok: String(
        (castingGilt && skript?.strategie_item?.casting_eintrag?.link_tiktok)
        || (castingGilt && skript?.strategie_item?.casting_eintrag?.creator?.tiktok)
        || links.find((l) => creatorId && l?.kooperation?.creator?.id === creatorId)?.kooperation?.creator?.tiktok
        || ''
      ).trim(),
      produktName: skript?.produkt?.name || '',
      videoUrl: skript?.strategie_item?.video_link || '',
      ...customerOf(skript),
      kampagneName: kampagneName(skript),
      dokument_bloecke: pdfBloecke(skript.dokument_bloecke, (pfad) => skriptBildPublicUrl(db, pfad)),
    };
  });
}

export async function loadSkriptEmpfaengerScope(db, { dokumentId, anhang }) {
  const items = await loadSkriptPdfItems(db, { dokumentId, anhang });
  const { creators, skipped } = poolCreators(items);
  const managements = await loadManagementScope(db, creatorIdsImPool(items));
  return {
    creators,
    managements,
    managementCreators: Object.fromEntries(managements.map((m) => [m.id, m.creatorIds])),
    kampagne: anhang?.kampagneId
      ? { id: anhang.kampagneId, label: anhang.kampagneName || 'Kampagne' }
      : null,
    skippedCreator: skipped,
  };
}

export const skriptAdapter = {
  platzhalter: ['vorname', 'name', 'skript', 'kampagne', 'unternehmen', 'marke'],

  async prepare(opts) {
    const skript = opts.skript;
    if (!skript?.id) return null;
    if (!window.isInternal?.()) return null;

    const anhang = {
      umfang: 'einzeln',
      proSkript: false,
      kampagneId: skript.kampagne_id || null,
      kampagneName: kampagneName(skript),
      produktionId: skript.produktion_id || null,
      produktionName: skript.produktion?.name || '',
    };

    const prepared = {
      dokumentId: opts.dokumentId,
      dokumentName: skript.titel || 'Skript',
      unternehmenId: skript.unternehmen_id,
      markeId: skript.marke_id || null,
      extraTabs: ['ansprechpartner'],
      anhang,
    };
    prepared.loadEmpfaengerScope = (db) => loadPreparedSkriptScope(db, prepared);
    prepared.mountExtras = (container, { onChange }) => {
      renderSkriptSchalter(container, anhang, onChange);
    };
    prepared.rewriteMail = (text) => {
      const name = umfangName(anhang);
      if (!name) return text;
      return String(text ?? '').replace(/\{\{skript\}\}/g, name);
    };
    return prepared;
  },

  async createPdf(prepared, db, hint) {
    const client = db || window.supabase;
    return pdfFromPool(client, prepared, hint?.empfaenger || null);
  },

  async buildAnhaenge(prepared, db, empfaenger) {
    const client = db || window.supabase;
    const pool = await ensureSkriptPool(client, prepared);
    const items = itemsForAnhang(pool.items, prepared);
    const proSkript = Boolean(istPool(prepared.anhang) && prepared.anhang?.proSkript);
    const dateiname = anhangDateiname(prepared, proSkript);
    const out = [];
    for (const person of empfaenger || []) {
      const subset = skripteFuerEmpfaenger(items, person, pool.managementCreators);
      if (!subset.length) continue;
      const pdf = await createSkriptAnhang(subset, { dateiname, proSkript });
      const pdfs = pdf.pdfs?.length ? pdf.pdfs : [pdf];
      out.push({
        empfaenger: person,
        pdfs: pdfs.map((item) => ({ dateiname: item.dateiname, blob: item.blob })),
      });
    }
    return out;
  },
};
