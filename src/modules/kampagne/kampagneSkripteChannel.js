// kampagneSkripteChannel.js
// Realtime auf skripte: Kundenfreigabe (RPC) oder ein Status-Wechsel in einem anderen
// Tab/Fenster setzt Status-Select im Skripte-Pane und die Checkboxen in der Produktionstabelle
// live nach. Eigene Writes sind schon lokal synchronisiert und werden ueber den Diff-Check
// uebersprungen. Abonniert wird erst mit Nutzer-Token (realtimeAuth.js), nicht als anon.

import { ensureRealtimeAuth, refreshRealtimeAuth, beiSession } from '../../core/realtimeAuth.js';
import { patchWorkflowItem } from './KampagneDetailWorkflow.js';
import { syncSkriptFreigabeLocal, videoGehoertZuSkript } from './skriptFreigabeSync.js';

const RETRY_BASE_MS = 5000;
const RETRY_MAX_MS = 60000;

/** Oeffnet den Channel fuer detail.kampagneId, falls noch keiner laeuft. */
export async function openSkripteChannel(detail) {
  if (detail._skripteChannel || detail._skripteAuthLaeuft || detail._skripteSession) return;
  if (!window.supabase?.channel || !detail.kampagneId) return;

  const gen = detail._skripteGen || 0;
  detail._skripteAuthLaeuft = true;
  const ok = await (detail._skripteAuthErneuern ? refreshRealtimeAuth() : ensureRealtimeAuth());
  detail._skripteAuthLaeuft = false;
  detail._skripteAuthErneuern = false;
  if ((detail._skripteGen || 0) !== gen || detail._skripteChannel) return;

  if (!ok) {
    detail._skripteSession = beiSession(() => {
      detail._skripteSession = null;
      if ((detail._skripteGen || 0) === gen) openSkripteChannel(detail);
    });
    return;
  }

  const channel = window.supabase
    .channel(`kampagne-skripte-${detail.kampagneId}`, {
      config: { broadcast: { self: false } }
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'skripte',
      filter: `kampagne_id=eq.${detail.kampagneId}`
    }, (payload) => applySkriptUpdate(detail, payload));
  detail._skripteChannel = channel;

  channel.subscribe((status, err) => {
    if (detail._skripteChannel !== channel) return;
    if (status === 'SUBSCRIBED') {
      detail._skripteRetryAttempt = 0;
      return;
    }
    if (status !== 'CHANNEL_ERROR' && status !== 'TIMED_OUT') return;

    console.error('REALTIME: Skripte-Channel Error:', err);
    if (/invalid column for filter/i.test(String(err?.message || err || ''))) detail._skripteAuthErneuern = true;
    closeSkripteChannel(detail);
    // Backoff mit Streuung: ein dauerhaft fehlschlagender Channel baut sich sonst endlos
    // neu auf (je Aufbau eine Subscription-Pruefung), alle Tabs im selben Takt.
    const attempt = detail._skripteRetryAttempt || 0;
    detail._skripteRetryAttempt = attempt + 1;
    const delay = Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_MS) * (0.5 + Math.random());
    const retryGen = detail._skripteGen;
    detail._skripteRetryTimer = setTimeout(() => {
      detail._skripteRetryTimer = null;
      if (detail._isMounted && detail._skripteGen === retryGen) openSkripteChannel(detail);
    }, delay);
  });
}

/** Baut Channel, Retry und Session-Warten ab; laufende Auth-Pruefungen verfallen. */
export function closeSkripteChannel(detail) {
  detail._skripteGen = (detail._skripteGen || 0) + 1;
  clearTimeout(detail._skripteRetryTimer);
  detail._skripteRetryTimer = null;
  detail._skripteSession?.();
  detail._skripteSession = null;
  const channel = detail._skripteChannel;
  detail._skripteChannel = null;
  if (channel) window.supabase?.removeChannel(channel);
}

function applySkriptUpdate(detail, payload) {
  const skript = payload?.new;
  if (!skript?.id || skript.status === undefined) return;
  const freigegeben = skript.status === 'freigegeben';

  // Nur patchen, wenn sich lokal etwas unterscheidet — eigene Writes sind
  // bereits synchronisiert und wuerden sonst unnoetig Store-Events feuern.
  let dirty = false;
  const cached = detail._workflowData?.skripte?.find((s) => s.id === skript.id);
  if (cached && cached.status !== skript.status) dirty = true;
  if (!dirty && detail.store?.videos) {
    for (const list of Object.values(detail.store.videos)) {
      for (const video of list) {
        if (!videoGehoertZuSkript(video, skript.id)) continue;
        if ((video.skript_freigegeben || false) !== freigegeben || video.skript?.status !== skript.status) {
          dirty = true;
          break;
        }
      }
      if (dirty) break;
    }
  }
  if (!dirty) return;

  syncSkriptFreigabeLocal(detail, skript.id, { freigegeben, status: skript.status }, patchWorkflowItem);
}
