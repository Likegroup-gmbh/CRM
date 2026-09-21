import { icon } from './icons/IconSystem.js';
import { getVertragStatus, vertragStatusLabel } from '../modules/vertrag/vertragStatus.js';

/**
 * VertragSyncHelper.js
 * Synchronisiert kooperationen.vertrag_unterschrieben mit dem tatsächlichen Vertragsstatus.
 * Single Source of Truth: Ob ein unterschriebener Vertrag hochgeladen wurde.
 *
 * Migration SQL für Bestandsdaten (Issue #27):
 *
 *   UPDATE kooperationen k
 *   SET vertrag_unterschrieben = true
 *   FROM vertraege v
 *   WHERE v.kooperation_id = k.id
 *     AND k.vertrag_unterschrieben IS NOT true
 *     AND (v.dropbox_file_url IS NOT NULL OR v.unterschriebener_vertrag_url IS NOT NULL);
 */

export async function syncVertragCheckbox(kooperationId, signed, { supabase: sb } = {}) {
  if (!kooperationId) {
    return { success: false, error: 'Keine kooperationId' };
  }

  const supabase = sb || window.supabase;

  try {
    const { error } = await supabase
      .from('kooperationen')
      .update({ vertrag_unterschrieben: signed })
      .eq('id', kooperationId);

    if (error) {
      console.warn('Vertrag-Sync Fehler:', error);
      return { success: false, error: error.message || String(error) };
    }

    return { success: true };
  } catch (err) {
    console.warn('Vertrag-Sync Exception:', err);
    return { success: false, error: err.message || String(err) };
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const STATUS_RANK = {
  unterschrieben: 6,
  gesendet: 5,
  erstellt: 4,
  verzoegert: 3,
  abgelehnt: 2,
  entwurf: 1,
};

const BADGE_CLASS = {
  entwurf: 'vertrag-badge--draft',
  erstellt: 'vertrag-badge--created',
  gesendet: 'vertrag-badge--gesendet',
  verzoegert: 'vertrag-badge--verzoegert',
  abgelehnt: 'vertrag-badge--abgelehnt',
};

export function pickVertragForAnzeige(vertraege) {
  const list = vertraege || [];
  if (!list.length) return null;
  return list.slice().sort((a, b) => {
    const ra = STATUS_RANK[getVertragStatus(a)] || 0;
    const rb = STATUS_RANK[getVertragStatus(b)] || 0;
    if (rb !== ra) return rb - ra;
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  })[0];
}

/**
 * Pure rendering function für die Vertrag-Zelle in der Kampagnen-Tabelle.
 * Zeigt ausschließlich Status-Badges (keine Checkbox).
 */
export function renderVertragCell(koop) {
  const vertrag = pickVertragForAnzeige(koop._vertraege);
  if (!vertrag) {
    return `<span class="vertrag-badge vertrag-badge--none">Noch nicht erstellt</span>`;
  }

  const status = getVertragStatus(vertrag);
  if (status === 'unterschrieben') {
    const url = vertrag.dropbox_file_url || vertrag.unterschriebener_vertrag_url;
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="contract-signed-action contract-signed-action--open" title="${escapeHtml(vertrag.name || 'Vertrag')}">
      ${icon('check-circle')}
      Unterschrieben
    </a>`;
  }

  const cls = BADGE_CLASS[status] || 'vertrag-badge--created';
  return `<span class="vertrag-badge ${cls}" title="${escapeHtml(vertrag.name || 'Vertrag')}">${escapeHtml(vertragStatusLabel(status))}</span>`;
}

/**
 * Waehlt den fuer die Nutzungsrechte massgeblichen Vertrag einer Kooperation.
 * Prioritaet wie die Vertrag-Spalte: unterschrieben > erstellt; bei Gleichstand
 * gewinnt der neueste (created_at). Entwuerfe werden ignoriert.
 * @returns {object|null} der Vertrag oder null
 */
export function pickPrimaryVertragForRechte(vertraege) {
  const list = (vertraege || []).filter(v => !v.is_draft);
  if (list.length === 0) return null;

  const byNewest = (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0);

  const signed = list
    .filter(v => v.dropbox_file_url || v.unterschriebener_vertrag_url)
    .sort(byNewest);
  if (signed.length) return signed[0];

  const created = list
    .filter(v => v.datei_url)
    .sort(byNewest);
  if (created.length) return created[0];

  return list.sort(byNewest)[0];
}

/**
 * Pure rendering function fuer die Nutzungsrechte-Zelle in der Kampagnen-Tabelle.
 * Zeigt ein Auge-Icon, wenn ein (nicht-Entwurf) Vertrag verknuepft ist – sonst leer.
 * Die Details werden lazy beim Klick aus `vertraege` nachgeladen (NutzungsrechteModal).
 */
export function renderNutzungsrechteCell(koop) {
  const vertrag = pickPrimaryVertragForRechte(koop._vertraege);
  if (!vertrag) return '';

  return `<button type="button" class="nutzungsrechte-icon-btn" data-action="open-nutzungsrechte" data-vertrag-id="${escapeHtml(vertrag.id)}" title="Nutzungsrechte ansehen" aria-label="Nutzungsrechte ansehen">
    ${icon('eye-outline')}
  </button>`;
}
