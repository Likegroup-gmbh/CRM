// CreatorUploadActions.js
// Staff-Aktionen fuer den tokenisierten Creator-Upload (Video-Tabelle,
// Kooperations-Aktionsmenue). Spricht mit creator-upload-staff (requireInternal).

import { authorizedFetch } from '../../core/auth/getAccessToken.js';

const FN = '/.netlify/functions/creator-upload-staff';

// kampagneId -> Map(creator_id -> { expiresAt, lastSentAt })
// Modul-Cache: ueberlebt Table-Re-Renders, Handler aktualisiert ihn direkt.
const _statusCache = new Map();

export function getCachedCreatorUploadStatus(kampagneId) {
  return _statusCache.get(kampagneId) || new Map();
}

function setCachedStatus(kampagneId, creatorId, status) {
  if (!_statusCache.has(kampagneId)) _statusCache.set(kampagneId, new Map());
  const map = _statusCache.get(kampagneId);
  if (status) map.set(creatorId, status);
  else map.delete(creatorId);
}

async function callStaffApi(payload) {
  const resp = await authorizedFetch(FN, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || `Fehler (${resp.status})`);
  return data;
}

function toast(message, type = 'success') {
  window.toastSystem?.show?.(message, type);
}

function formatExpiry(iso) {
  try {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return iso;
  }
}

/**
 * Laedt die aktiven Upload-Tokens einer Kampagne in den Modul-Cache.
 */
export async function loadCreatorUploadStatus(kampagneId) {
  const map = new Map();
  try {
    const data = await callStaffApi({ action: 'status', kampagneId });
    (data.tokens || []).forEach(tok => {
      map.set(tok.creator_id, { expiresAt: tok.expires_at, lastSentAt: tok.last_sent_at });
    });
  } catch (err) {
    // Status ist reine Zusatzinfo im Menue — kein harter Fehler
    console.warn('[creator-upload] Status laden fehlgeschlagen:', err.message);
  }
  _statusCache.set(kampagneId, map);
  return map;
}

/**
 * @param {'creator-upload-send'|'creator-upload-resend'|'creator-upload-copy'|'creator-upload-revoke'} action
 * @param {HTMLElement} item Das angeklickte Menue-Element (data-kampagne-id, data-creator-id)
 */
export async function handleCreatorUploadAction(action, item) {
  const kampagneId = item?.dataset?.kampagneId;
  const creatorId = item?.dataset?.creatorId;
  if (!kampagneId || !creatorId) {
    toast('Kampagne oder Creator unbekannt', 'error');
    return;
  }

  try {
    if (action === 'creator-upload-send') {
      const res = await callStaffApi({ action: 'send', kampagneId, creatorId });
      toast(res.reused
        ? `Bestehender Link erneut gesendet (gültig bis ${formatExpiry(res.expiresAt)})`
        : `Upload-Link gesendet (gültig bis ${formatExpiry(res.expiresAt)})`);
      setCachedStatus(kampagneId, creatorId, { expiresAt: res.expiresAt, lastSentAt: new Date().toISOString() });
      return;
    }

    if (action === 'creator-upload-resend') {
      const res = await callStaffApi({ action: 'resend', kampagneId, creatorId });
      toast(`Neuer Link gesendet, alter Link ungültig (gültig bis ${formatExpiry(res.expiresAt)})`);
      setCachedStatus(kampagneId, creatorId, { expiresAt: res.expiresAt, lastSentAt: new Date().toISOString() });
      return;
    }

    if (action === 'creator-upload-copy') {
      const res = await callStaffApi({ action: 'link', kampagneId, creatorId });
      await navigator.clipboard.writeText(res.link);
      toast(`Link kopiert (gültig bis ${formatExpiry(res.expiresAt)})`);
      return;
    }

    if (action === 'creator-upload-revoke') {
      let proceed = true;
      if (window.confirmationModal) {
        const res = await window.confirmationModal.open({
          title: 'Zugang widerrufen',
          message: 'Der Upload-Link wird sofort ungültig. Laufende Uploads dieses Creators werden abgebrochen.',
          confirmText: 'Widerrufen',
          cancelText: 'Abbrechen',
          danger: true,
        });
        proceed = !!res?.confirmed;
      }
      if (!proceed) return;
      await callStaffApi({ action: 'revoke', kampagneId, creatorId });
      toast('Zugang widerrufen');
      setCachedStatus(kampagneId, creatorId, null);
    }
  } catch (err) {
    console.error('[creator-upload]', err);
    toast(err.message || 'Aktion fehlgeschlagen', 'error');
  }
}
