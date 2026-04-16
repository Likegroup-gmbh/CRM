// AuftragStatusUtils.js
// Ampelsystem: Beauftragt (Grün) / Abgeschlossen (Rot) / Storniert (Grau)
// Budget-basierter automatischer Status-Check

const AMPEL_MAP = {
  'Beauftragt':     { color: '#22c55e', label: 'Aktiv',          cssClass: 'beauftragt' },
  'Abgeschlossen':  { color: '#ef4444', label: 'Abgeschlossen',  cssClass: 'abgeschlossen' },
  'Storniert':      { color: '#9ca3af', label: 'Storniert',       cssClass: 'storniert' }
};

export function renderAuftragAmpel(status) {
  const s = AMPEL_MAP[status] || AMPEL_MAP['Beauftragt'];
  return `<span class="auftrag-ampel auftrag-ampel--${s.cssClass}" title="${status || 'Beauftragt'}">
    <span class="auftrag-ampel__dot" style="background:${s.color};"></span>
    ${s.label}
  </span>`;
}

/**
 * Prüft ob der Auftrags-Status basierend auf dem Budget-Verbrauch aktualisiert werden muss.
 * Verbrauch = Summe(kooperation_videos.verkaufspreis_netto) aller Kooperationen des Auftrags.
 * Budget = auftrag.gesamt_budget.
 * 
 * Regeln:
 * - Storniert wird NIE automatisch überschrieben
 * - Verbrauch >= Budget → Abgeschlossen
 * - Verbrauch < Budget und Status == Abgeschlossen → zurück auf Beauftragt
 */
export async function checkAuftragBudgetStatus(auftragId) {
  if (!auftragId || !window.supabase) return;

  try {
    const { data: auftrag, error: auftragError } = await window.supabase
      .from('auftrag')
      .select('id, status, gesamt_budget')
      .eq('id', auftragId)
      .single();

    if (auftragError || !auftrag) {
      console.warn('⚠️ Budget-Check: Auftrag nicht gefunden', auftragId);
      return;
    }

    if (auftrag.status === 'Storniert') return;

    const totalBudget = parseFloat(auftrag.gesamt_budget) || 0;
    if (totalBudget <= 0) return;

    const { data: kampagnen } = await window.supabase
      .from('kampagne')
      .select('id')
      .eq('auftrag_id', auftragId);

    if (!kampagnen || kampagnen.length === 0) return;

    const kampagneIds = kampagnen.map(k => k.id);

    const { data: kooperationen } = await window.supabase
      .from('kooperationen')
      .select('id, kooperation_videos(verkaufspreis_netto)')
      .in('kampagne_id', kampagneIds);

    const usedBudget = (kooperationen || []).reduce((sum, koop) => {
      return sum + (koop.kooperation_videos || [])
        .reduce((s, v) => s + (parseFloat(v.verkaufspreis_netto) || 0), 0);
    }, 0);

    let newStatus = null;

    if (usedBudget >= totalBudget && auftrag.status !== 'Abgeschlossen') {
      newStatus = 'Abgeschlossen';
    } else if (usedBudget < totalBudget && auftrag.status === 'Abgeschlossen') {
      newStatus = 'Beauftragt';
    }

    if (newStatus) {
      const { error: updateError } = await window.supabase
        .from('auftrag')
        .update({ status: newStatus })
        .eq('id', auftragId);

      if (updateError) {
        console.error('❌ Budget-Status-Update fehlgeschlagen:', updateError);
      } else {
        console.log(`✅ Auftrag ${auftragId} Status: ${auftrag.status} → ${newStatus} (Budget: ${usedBudget}/${totalBudget})`);
        document.dispatchEvent(new CustomEvent('auftrag-status-changed', {
          detail: { auftragId, oldStatus: auftrag.status, newStatus, usedBudget, totalBudget }
        }));
      }
    }
  } catch (err) {
    console.error('❌ Budget-Check Fehler:', err);
  }
}
