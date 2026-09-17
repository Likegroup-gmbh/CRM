// ensureCastingEintragHatCreator
// Casting-Eintrag bekommt eine creator_id: schon da, Instagram-Treffer
// verknuepfen, sonst Creator-Formular-Drawer. Aendert nicht die Gates
// von assignCastingItem — die Videoidee haengt weiter am Eintrag.

import { creatorAuswahlService, handleAusLink } from './CreatorAuswahlService.js';
import { CreatorFormDrawer } from '../creator/CreatorFormDrawer.js';

export class EnsureCreatorCancelled extends Error {
  constructor() {
    super('Creator-Anlage abgebrochen');
    this.name = 'EnsureCreatorCancelled';
    this.cancelled = true;
  }
}

export function instagramHandleFromItem(item) {
  return handleAusLink(item?.link_instagram)
    || ((item?.plattform === 'instagram' || item?.plattform === 'both')
      ? (item.creator_handle || '').replace(/^@/, '') || null
      : null);
}

export function tiktokHandleFromItem(item) {
  return handleAusLink(item?.link_tiktok)
    || ((item?.plattform === 'tiktok' || item?.plattform === 'both')
      ? (item.creator_handle || '').replace(/^@/, '') || null
      : null);
}

const FOLLOWER_BUCKETS = [
  [2500, '0-2500'],
  [5000, '2500-5000'],
  [10000, '5000-10000'],
  [25000, '10000-25000'],
  [50000, '25000-50000'],
  [100000, '50000-100000'],
  [250000, '100000-250000'],
  [500000, '250000-500000'],
  [1000000, '500000-1000000']
];

export function followerToBucket(n) {
  if (n == null || n === '') return '';
  const s = String(n);
  if (s.includes('-') || s.endsWith('+')) return s;
  const num = Number(n);
  if (!Number.isFinite(num)) return '';
  for (const [max, value] of FOLLOWER_BUCKETS) {
    if (num < max) return value;
  }
  return '1000000+';
}

export function resolveFollowerSubmit(formValue, original) {
  if (formValue == null || formValue === '') {
    return original == null || original === '' ? null : Number(original);
  }
  if (/^\d+$/.test(String(formValue))) return Number(formValue);
  const bucket = String(formValue);
  if (original != null && followerToBucket(original) === bucket) return Number(original);
  if (bucket.endsWith('+')) return 1000000;
  const low = parseInt(bucket.split('-')[0], 10);
  return Number.isFinite(low) ? low : (original == null ? null : Number(original));
}

export function prefillFromCastingItem(item) {
  const nameParts = (item?.name || '').trim().split(/\s+/).filter(Boolean);
  const vorname = nameParts[0] || '';
  const nachname = nameParts.slice(1).join(' ') || '';

  return {
    vorname,
    nachname,
    mail: item?.email || '',
    telefonnummer: item?.telefon || '',
    instagram: instagramHandleFromItem(item) || '',
    tiktok: tiktokHandleFromItem(item) || '',
    instagram_follower: followerToBucket(item?.follower_instagram),
    tiktok_follower: followerToBucket(item?.follower_tiktok),
    lieferadresse_stadt: item?.wohnort || '',
    notiz: item?.notiz || item?.beschreibung || '',
    profilbild_url: item?.profilbild_url || item?.profile_image_url || ''
  };
}

async function loadEintrag(eintragOrId) {
  const id = typeof eintragOrId === 'string' ? eintragOrId : eintragOrId?.id;
  if (!id) throw new Error('Casting-Eintrag nicht gefunden');

  const passed = typeof eintragOrId === 'object' ? eintragOrId : null;
  if (passed?.creator_id) return passed;

  const { data, error } = await window.supabase
    .from('creator_auswahl_items')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) throw new Error('Casting-Eintrag nicht gefunden');
  return data;
}

export async function findCreatorByInstagram(handle) {
  if (!handle) return null;
  const { data, error } = await window.supabase
    .from('creator')
    .select('id, vorname, nachname, instagram')
    .ilike('instagram', handle)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function linkCreator(item, creatorId) {
  await creatorAuswahlService.updateItem(item.id, { creator_id: creatorId });
  item.creator_id = creatorId;
  return creatorId;
}

/**
 * Stellt sicher, dass der Casting-Eintrag eine creator_id hat.
 * @returns {Promise<string>} creator_id
 * @throws {EnsureCreatorCancelled} wenn der Drawer abgebrochen wird
 */
export async function ensureCastingEintragHatCreator(eintragOrId) {
  const item = await loadEintrag(eintragOrId);
  const patchCaller = (creatorId) => {
    if (typeof eintragOrId === 'object' && eintragOrId) {
      eintragOrId.creator_id = creatorId;
    }
    item.creator_id = creatorId;
    return creatorId;
  };

  if (item.creator_id) return patchCaller(item.creator_id);

  const handle = instagramHandleFromItem(item);
  if (handle) {
    const existing = await findCreatorByInstagram(handle);
    if (existing) {
      await linkCreator(item, existing.id);
      window.toastSystem?.show('Bestehenden Creator verknüpft', 'success');
      return patchCaller(existing.id);
    }
  }

  const prefill = prefillFromCastingItem(item);

  return new Promise((resolve, reject) => {
    const drawer = new CreatorFormDrawer();
    let settled = false;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      fn(value);
    };

    drawer.open({
      prefill,
      originalFollowers: {
        instagram: item.follower_instagram ?? null,
        tiktok: item.follower_tiktok ?? null
      },
      extraInsert: {
        profilbild_url: item.profilbild_url || item.profile_image_url || null
      },
      onCreated: async (creator) => {
        try {
          await linkCreator(item, creator.id);
          finish(resolve, patchCaller(creator.id));
        } catch (error) {
          finish(reject, error);
        }
      },
      onUseExisting: async (creatorId) => {
        try {
          await linkCreator(item, creatorId);
          window.toastSystem?.show('Bestehenden Creator verknüpft', 'success');
          finish(resolve, patchCaller(creatorId));
        } catch (error) {
          finish(reject, error);
        }
      },
      onCancel: () => finish(reject, new EnsureCreatorCancelled())
    });
  });
}
