// ActionsDropdownEffects.js
// Seiteneffekt-Helfer der globalen Dropdown-Actions (Instagram, Freischaltung,
// Zuordnung, Favoriten, Adressen, Rechnung). Der Router liegt in ActionsDropdownHandlers.js.

import { getSignedDocumentUrl, resolveDocumentUrl } from './DocumentUrlHelper.js';
import { authorizedFetch } from './auth/getAccessToken.js';

// Stiller Instagram-Connect für Bulk-Läufe: keine Toasts, Fehler nur in Konsole.
// Feuert bei Erfolg entityUpdated (→ Grid-Karte refresht sich einzeln).
// skip_brands spart bis zu 8 Graph-Calls pro Creator (Rate-Limit-Budget).
// @returns {Promise<{ok: boolean, retryable: boolean}>} retryable = Meta-Rate-Limit
export async function connectInstagramSilent(creatorId) {
  try {
    const response = await authorizedFetch('/.netlify/functions/instagram-connect', {
      method: 'POST',
      body: JSON.stringify({ creator_id: creatorId, skip_brands: true })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.ok) {
      const retryable = response.status === 429 || result.retryable === true;
      console.warn(`Bulk-Connect fehlgeschlagen für ${creatorId}:`, result.hint || result.error || 'Unbekannter Fehler');
      return { ok: false, retryable };
    }

    window.dispatchEvent(new CustomEvent('entityUpdated', {
      detail: { entity: 'creator', action: 'updated', id: creatorId }
    }));
    return { ok: true, retryable: false };
  } catch (err) {
    console.warn(`Bulk-Connect fehlgeschlagen für ${creatorId}:`, err);
    return { ok: false, retryable: false };
  }
}

export async function handleInstagramConnect(creatorId) {
  window.toastSystem?.show('Instagram-Daten werden geladen...', 'info');

  try {
    const response = await authorizedFetch('/.netlify/functions/instagram-connect', {
      method: 'POST',
      body: JSON.stringify({ creator_id: creatorId })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.ok) {
      const message = result.hint || result.error || 'Unbekannter Fehler';
      window.toastSystem?.show(`Instagram-Connect fehlgeschlagen: ${message}`, 'error');
      return;
    }

    const follower = result.followers_count != null
      ? ` (${Number(result.followers_count).toLocaleString('de-DE')} Follower)`
      : '';
    window.toastSystem?.show(`@${result.username} verbunden${follower}`, 'success');

    window.dispatchEvent(new CustomEvent('entityUpdated', {
      detail: { entity: 'creator', action: 'updated', id: creatorId }
    }));
  } catch (err) {
    console.error('Instagram-Connect fehlgeschlagen:', err);
    if (err.sessionDead) return;
    window.toastSystem?.show(`Instagram-Connect fehlgeschlagen: ${err.message}`, 'error');
  }
}

export async function toggleFreischaltung(userId) {
  try {
    const { data: user, error: loadError } = await window.supabase
      .from('benutzer')
      .select('freigeschaltet, rolle')
      .eq('id', userId)
      .single();
    if (loadError) throw loadError;

    const freischalten = !user.freigeschaltet;
    const updateData = { freigeschaltet: freischalten };
    if (freischalten) {
      if (user.rolle === 'pending') updateData.rolle = 'mitarbeiter';
    } else if (user.rolle !== 'admin' && user.rolle !== 'investor') {
      updateData.rolle = 'pending';
      updateData.zugriffsrechte = null;
    }

    const { error } = await window.supabase
      .from('benutzer')
      .update(updateData)
      .eq('id', userId);
    if (error) throw error;

    window.dispatchEvent(new CustomEvent('entityUpdated', {
      detail: { entity: 'benutzer', action: 'updated', id: userId, field: 'freigeschaltet', value: freischalten }
    }));
  } catch (err) {
    console.error('Freischaltung ändern fehlgeschlagen', err);
    alert('Freischaltung konnte nicht geändert werden.');
  }
}

export async function handleRemoveZuordnung(entityId, entityType) {
  if (!window.kundenDetail?.kundeId) return;
  await window.kundenDetail.removeZuordnung(entityId, entityType);
}

export async function addToFavorites(dropdown, creatorId, kampagneId) {
  try {
    if (!kampagneId) {
      const match = window.location.pathname.match(/\/kampagne\/([0-9a-fA-F-]{36})/);
      kampagneId = match ? match[1] : null;
    }
    if (!kampagneId) {
      alert('Kampagne konnte nicht ermittelt werden.');
      return;
    }
    await window.supabase
      .from('kampagne_creator_favoriten')
      .insert({ kampagne_id: kampagneId, creator_id: creatorId });
    window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'kampagne', action: 'favorite-added', id: kampagneId } }));
    alert('Zu Favoriten hinzugefügt.');
  } catch (err) {
    console.error('Fehler beim Hinzufügen zu Favoriten', err);
    alert('Hinzufügen zu Favoriten fehlgeschlagen.');
  }
}

export async function setStandardAdresse(adresseId, creatorId) {
  try {
    const { error: resetError } = await window.supabase
      .from('creator_adressen')
      .update({ ist_standard: false })
      .eq('creator_id', creatorId);
    if (resetError) throw resetError;

    const { error: setError } = await window.supabase
      .from('creator_adressen')
      .update({ ist_standard: true })
      .eq('id', adresseId);
    if (setError) throw setError;

    window.dispatchEvent(new CustomEvent('entityUpdated', {
      detail: { entity: 'creator_adressen', creatorId }
    }));
  } catch (error) {
    console.error('Fehler beim Festlegen der Standard-Adresse:', error);
    throw error;
  }
}

export async function setHauptadresseStandard(creatorId) {
  try {
    const { error: resetError } = await window.supabase
      .from('creator_adressen')
      .update({ ist_standard: false })
      .eq('creator_id', creatorId);
    if (resetError) throw resetError;

    window.dispatchEvent(new CustomEvent('entityUpdated', {
      detail: { entity: 'creator_adressen', creatorId }
    }));
  } catch (error) {
    console.error('Fehler beim Festlegen der Hauptadresse als Standard:', error);
    throw error;
  }
}

export async function openRechnungAnpassenDrawer(auftragId, { teilrechnungId = null } = {}) {
  try {
    const { RechnungAnpassenDrawer } = await import('/src/modules/auftrag/RechnungAnpassenDrawer.js');
    const drawer = new RechnungAnpassenDrawer();
    await drawer.open(auftragId, { teilrechnungId });
  } catch (error) {
    console.error('Fehler beim Öffnen des Rechnung-Anpassen-Drawers:', error);
    alert('Fehler beim Öffnen: ' + (error.message || 'Unbekannter Fehler'));
  }
}

export async function handleRechnungDownload(rechnungId) {
  try {
    const { data: pdfs, error: pdfErr } = await window.supabase
      .from('rechnung_pdfs')
      .select('id, file_name, file_path, file_url')
      .eq('rechnung_id', rechnungId);

    if (pdfErr) throw pdfErr;

    let downloadUrls = [];
    if (pdfs && pdfs.length > 0) {
      downloadUrls = await Promise.all(pdfs.map(async (p) => {
        let url = p.file_url || '';
        if (p.file_path && !p.file_path.startsWith('/')) {
          url = await getSignedDocumentUrl('rechnungen', p.file_path).catch(() => url);
        } else {
          url = await resolveDocumentUrl(url);
        }
        return { url, name: p.file_name };
      }));
    } else {
      const { data: rechnung, error } = await window.supabase
        .from('rechnung')
        .select('id, rechnung_nr, pdf_url')
        .eq('id', rechnungId)
        .single();
      if (error) throw error;
      if (!rechnung?.pdf_url) {
        window.toastSystem?.show('Keine PDF für diese Rechnung hinterlegt', 'warning');
        return;
      }
      downloadUrls = [{ url: await resolveDocumentUrl(rechnung.pdf_url), name: `Rechnung_${rechnung.rechnung_nr || rechnungId}.pdf` }];
    }

    window.toastSystem?.show('Download wird vorbereitet...', 'info');

    for (const pdf of downloadUrls) {
      const response = await fetch(pdf.url);
      if (!response.ok) throw new Error('PDF konnte nicht geladen werden');

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = pdf.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(blobUrl);
    }

    window.toastSystem?.show(`${downloadUrls.length} PDF(s) heruntergeladen`, 'success');
  } catch (error) {
    console.error('Fehler beim Herunterladen der Rechnung:', error);
    window.toastSystem?.show('Fehler beim Herunterladen: ' + (error.message || 'Unbekannter Fehler'), 'error');
  }
}
