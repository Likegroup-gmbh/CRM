// Skript-Anschreiben: Empfaenger inkl. Ansprechpartner, Umfang/Anhang neben der Vorlage.
// Der Skript-Pool liegt einmal am prepared-Objekt. Scope, PDF und Versand lesen ihn.

import { loadAnsprechpartnerRows } from '../snapshot.js';
import { creatorFuerAnschreiben, createSkriptAnhang, sanitizeSkriptFilename } from '../../../modules/skripte/SkriptPdf.js';

const CREATOR_FELDER = 'id, vorname, nachname, mail, instagram, tiktok, profilbild_url, profilbild_thumb_url';

const SKRIPT_SELECT = `
  id, titel, created_at, hook, hauptteil, cta, hook_visuell, hauptteil_visuell, cta_visuell,
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

function profileOf(creator) {
  if (!creator?.id) return null;
  return {
    id: creator.id,
    vorname: creator.vorname || '',
    nachname: creator.nachname || '',
    mail: creator.mail || '',
    profilbild_url: creator.profilbild_url || '',
    profilbild_thumb_url: creator.profilbild_thumb_url || '',
    instagram: creator.instagram || '',
  };
}

/** Kooperation-Video schlägt die Videoidee, sobald ein Video einen Creator hat. */
export function creatorProfileFuerSkript(skript, verknuepfungen) {
  let videoHatCreator = false;
  const fromVideo = [];
  const seen = new Set();
  for (const row of verknuepfungen || []) {
    const creator = row?.kooperation?.creator;
    if (!creator) continue;
    videoHatCreator = true;
    const profil = profileOf(creator);
    if (!profil || seen.has(profil.id)) continue;
    seen.add(profil.id);
    fromVideo.push(profil);
  }
  if (videoHatCreator) return fromVideo;
  const konzept = profileOf(skript?.strategie_item?.casting_eintrag?.creator);
  return konzept ? [konzept] : [];
}

export function creatorIdsImPool(items) {
  const ids = [];
  const seen = new Set();
  for (const item of items || []) {
    for (const id of item.creatorIds || []) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

export function poolCreators(items) {
  const byId = new Map();
  let skipped = 0;
  for (const item of items || []) {
    for (const profil of item.creators || []) {
      if (!profil?.id || byId.has(profil.id)) continue;
      const email = String(profil.mail || '').trim();
      if (!email) {
        skipped += 1;
        byId.set(profil.id, null);
        continue;
      }
      const name = [profil.vorname, profil.nachname].filter(Boolean).join(' ') || email;
      byId.set(profil.id, {
        id: profil.id,
        email,
        name,
        vorname: profil.vorname || '',
      });
    }
  }
  return { creators: [...byId.values()].filter(Boolean), skipped };
}

function anzeigeFuer(profil, fallback) {
  const name = [profil?.vorname, profil?.nachname].filter(Boolean).join(' ') || fallback?.name || '';
  if (!name && !profil) return fallback || null;
  return {
    name: name || 'Creator',
    bildUrl: profil?.profilbild_url || profil?.profilbild_thumb_url || fallback?.bildUrl || '',
    instagram: profil?.instagram || fallback?.instagram || '',
  };
}

export function skripteFuerEmpfaenger(items, empfaenger, managementCreators = {}) {
  const list = items || [];
  if (empfaenger?.typ === 'ansprechpartner') return list;
  if (empfaenger?.typ === 'creator') {
    return list
      .filter((item) => (item.creatorIds || []).includes(empfaenger.id))
      .map((item) => {
        const profil = (item.creators || []).find((c) => c.id === empfaenger.id);
        return { ...item, creator: anzeigeFuer(profil, item.creator) };
      });
  }
  if (empfaenger?.typ === 'management') {
    const ids = new Set(managementCreators[empfaenger.id] || []);
    return list.filter((item) => (item.creatorIds || []).some((id) => ids.has(id)));
  }
  return [];
}

export async function loadManagementScope(db, creatorIds) {
  if (!creatorIds?.length) return [];
  const { data, error } = await db
    .from('creator_management')
    .select('creator_id, management:management_id(id, firmenname, email)')
    .in('creator_id', creatorIds)
    .eq('ist_aktiv', true);
  if (error) throw error;
  const byId = new Map();
  for (const row of data || []) {
    const management = row.management;
    const email = String(management?.email || '').trim();
    if (!management?.id || !email || !row.creator_id) continue;
    const prev = byId.get(management.id) || {
      id: management.id,
      email,
      name: management.firmenname || email,
      vorname: '',
      creatorIds: [],
    };
    if (!prev.creatorIds.includes(row.creator_id)) prev.creatorIds.push(row.creator_id);
    byId.set(management.id, prev);
  }
  return [...byId.values()];
}

function poolQuery(prepared) {
  const anhang = prepared.anhang || {};
  if (anhang.kampagneId) {
    return { dokumentId: prepared.dokumentId, anhang: { ...anhang, alle: true } };
  }
  return { dokumentId: prepared.dokumentId, anhang };
}

function itemsForAnhang(items, prepared) {
  if (prepared.anhang?.alle || !prepared.anhang?.kampagneId) return items;
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
      ? { id: prepared.anhang.kampagneId, label: prepared.anhang.kampagneName || 'Kampagne' }
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
  const proSkript = Boolean(prepared.anhang?.alle && prepared.anhang?.proSkript);
  return createSkriptAnhang(subset, { dateiname: anhangDateiname(prepared, proSkript), proSkript });
}

function anhangDateiname(prepared, proSkript) {
  if (prepared.anhang?.alle && !proSkript) {
    return sanitizeSkriptFilename(`Skripte ${prepared.anhang.kampagneName || prepared.dokumentName}`);
  }
  return sanitizeSkriptFilename(prepared.dokumentName);
}

export function renderSkriptSchalter(container, anhang, onChange) {
  if (!anhang?.kampagneId) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = `
    <div class="anschreiben-schalter">
      <span class="toggle-text">Alle Skripte dieser Kampagne</span>
      <label class="toggle-switch">
        <input type="checkbox" data-skript-umfang>
        <span class="toggle-slider"></span>
      </label>
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
  umfang.addEventListener('change', () => {
    anhang.alle = umfang.checked;
    anhangWrap.hidden = !umfang.checked;
    onChange?.();
  });
  anhangInput.addEventListener('change', () => {
    anhang.proSkript = anhangInput.checked;
    onChange?.();
  });
}

export async function loadSkriptPdfItems(db, { dokumentId, anhang }) {
  const alle = Boolean(anhang?.alle && anhang?.kampagneId);
  let query = db.from('skripte').select(SKRIPT_SELECT);
  query = alle
    ? query.eq('kampagne_id', anhang.kampagneId).order('created_at', { ascending: true })
    : query.eq('id', dokumentId);
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
    return {
      id: skript.id,
      titel: skript.titel || 'Skript',
      hook: skript.hook || '',
      hauptteil: skript.hauptteil || '',
      cta: skript.cta || '',
      hook_visuell: skript.hook_visuell || '',
      hauptteil_visuell: skript.hauptteil_visuell || '',
      cta_visuell: skript.cta_visuell || '',
      creators,
      creatorIds: creators.map((c) => c.id),
      creator,
      instagram: creator?.instagram || '',
      tiktok: String(
        skript?.strategie_item?.casting_eintrag?.link_tiktok
        || skript?.strategie_item?.casting_eintrag?.creator?.tiktok
        || ''
      ).trim(),
      produktName: skript?.produkt?.name || '',
      videoUrl: skript?.strategie_item?.video_link || '',
      ...customerOf(skript),
      kampagneName: kampagneName(skript),
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
      alle: false,
      proSkript: false,
      kampagneId: skript.kampagne_id || null,
      kampagneName: kampagneName(skript),
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
      if (!anhang.alle || !anhang.kampagneName) return text;
      return String(text ?? '').replace(/\{\{skript\}\}/g, anhang.kampagneName);
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
    const proSkript = Boolean(prepared.anhang?.alle && prepared.anhang?.proSkript);
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
