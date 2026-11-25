// linieVerschiebenDialog.js
// Aktionsmenü: Kooperation in eine andere Linie derselben Kampagne (ADR 0062).

import { openAssignSearchModal, esc } from '../../core/AssignSearchModal.js';
import { parseTeilbereiche } from '../creator-auswahl/castingKategorien.js';
import { applyLinieWechsel, grundText, planLinieWechsel } from './linieVerschieben.js';

function zeilen(result) {
  if (result?.error) throw new Error(result.error.message);
  return result?.data || [];
}

function eine(result) {
  if (result?.error) throw new Error(result.error.message);
  return result?.data || null;
}

async function ladeLinien(db, kooperation) {
  const produktionen = zeilen(await db
    .from('produktion')
    .select('id, name, kampagne_id, budget')
    .eq('kampagne_id', kooperation.kampagne_id));
  if (!produktionen.length) return [];
  const briefings = zeilen(await db
    .from('campaign_briefings')
    .select('id, aktivierung_name, is_draft, ist_altbestand, produktion_id')
    .in('produktion_id', produktionen.map(produktion => produktion.id)));
  const nachProduktion = new Map(produktionen.map(produktion => [produktion.id, produktion]));
  return briefings
    .filter(briefing => !briefing.is_draft && briefing.id !== kooperation.briefing_id)
    .map(briefing => {
      const produktion = nachProduktion.get(briefing.produktion_id);
      const linieName = briefing.aktivierung_name || 'Linie';
      const produktionName = produktion?.name || 'Produktion';
      return {
        id: briefing.id,
        label: `${produktionName} – ${linieName}`,
        ist_altbestand: !!briefing.ist_altbestand,
        briefingId: briefing.id,
        produktionId: briefing.produktion_id,
        kampagneId: produktion?.kampagne_id || kooperation.kampagne_id,
        budget: produktion?.budget ?? null,
        is_draft: false
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'de'));
}

async function ladeKontext(db, kooperation, linie) {
  const videos = zeilen(await db
    .from('kooperation_videos')
    .select('id, kooperation_id, strategie_item_id, skript_id, verkaufspreis_netto')
    .eq('kooperation_id', kooperation.id));
  const ideeIds = [...new Set(videos.map(video => video.strategie_item_id).filter(Boolean))];
  const skriptIds = [...new Set(videos.map(video => video.skript_id).filter(Boolean))];

  const ideenDirekt = ideeIds.length
    ? zeilen(await db.from('strategie_items').select('id, strategie_id, creator_auswahl_item_id').in('id', ideeIds))
    : [];
  const skripteDirekt = skriptIds.length
    ? zeilen(await db.from('skripte').select('id, strategie_item_id').in('id', skriptIds))
    : [];
  const weitereIdeeIds = skripteDirekt.map(skript => skript.strategie_item_id).filter(id => id && !ideeIds.includes(id));
  const ideenAusSkript = weitereIdeeIds.length
    ? zeilen(await db.from('strategie_items').select('id, strategie_id, creator_auswahl_item_id').in('id', weitereIdeeIds))
    : [];
  const kandidaten = [...ideenDirekt, ...ideenAusSkript];
  const alleIdeeIds = kandidaten.map(idee => idee.id);
  const skripteDerIdeen = alleIdeeIds.length
    ? zeilen(await db.from('skripte').select('id, strategie_item_id').in('strategie_item_id', alleIdeeIds))
    : [];
  const skripte = [...skripteDirekt];
  for (const skript of skripteDerIdeen) {
    if (!skripte.some(vorhanden => vorhanden.id === skript.id)) skripte.push(skript);
  }

  const referenzIds = [...new Set([...alleIdeeIds, ...skripte.map(skript => skript.strategie_item_id).filter(Boolean)])];
  const skriptRef = skripte.map(skript => skript.id);
  let fremdeVideos = [];
  if (referenzIds.length || skriptRef.length) {
    const teile = [];
    if (referenzIds.length) teile.push(`strategie_item_id.in.(${referenzIds.join(',')})`);
    if (skriptRef.length) teile.push(`skript_id.in.(${skriptRef.join(',')})`);
    fremdeVideos = zeilen(await db
      .from('kooperation_videos')
      .select('id, kooperation_id, strategie_item_id, skript_id')
      .or(teile.join(',')))
      .filter(video => video.kooperation_id !== kooperation.id);
  }

  const eintragIds = [...new Set(kandidaten.map(idee => idee.creator_auswahl_item_id).filter(Boolean))];
  const eintraege = eintragIds.length
    ? zeilen(await db.from('creator_auswahl_items').select('id, creator_id, kategorie, nicht_umsetzen').in('id', eintragIds))
    : [];
  const ideenAmEintrag = eintragIds.length
    ? zeilen(await db.from('strategie_items').select('id, strategie_id, creator_auswahl_item_id').in('creator_auswahl_item_id', eintragIds))
    : [];
  const ideen = [...kandidaten];
  for (const idee of ideenAmEintrag) {
    if (!ideen.some(vorhanden => vorhanden.id === idee.id)) ideen.push(idee);
  }

  const casting = eine(await db.from('creator_auswahl').select('id, teilbereich').eq('briefing_id', linie.briefingId).maybeSingle());
  const konzept = eine(await db.from('strategie').select('id').eq('briefing_id', linie.briefingId).maybeSingle());
  const zielEintraege = casting
    ? zeilen(await db.from('creator_auswahl_items').select('id, creator_id').eq('creator_auswahl_id', casting.id))
    : [];
  let verbrauch = 0;
  if (linie.budget != null) {
    const stand = eine(await db.from('produktion_verbrauch').select('budget_used').eq('produktion_id', linie.produktionId).maybeSingle());
    verbrauch = stand?.budget_used || 0;
  }
  const vertraege = zeilen(await db
    .from('vertraege')
    .select('id, typ, kooperation_id, produktion_id')
    .eq('kooperation_id', kooperation.id));

  return {
    kooperation,
    ziel: {
      briefingId: linie.briefingId,
      produktionId: linie.produktionId,
      kampagneId: linie.kampagneId,
      konzeptId: konzept?.id || null,
      castingId: casting?.id || null,
      is_draft: false,
      budget: linie.budget
    },
    videos,
    fremdeVideos,
    ideen,
    skripte,
    eintraege,
    zielEintraege,
    zielKategorien: parseTeilbereiche(casting?.teilbereich),
    vertraege,
    verbrauch
  };
}

export async function oeffneLinieVerschieben(kooperationId) {
  const db = window.supabase;
  if (!db || !kooperationId) return;
  const kooperation = eine(await db
    .from('kooperationen')
    .select('id, name, kampagne_id, briefing_id, produktion_id')
    .eq('id', kooperationId)
    .maybeSingle());
  if (!kooperation?.kampagne_id) {
    alert('Die Kooperation hat keine Kampagne.');
    return;
  }
  const linien = await ladeLinien(db, kooperation);

  return openAssignSearchModal({
    idPrefix: 'linie-verschieben',
    searchId: 'linie-verschieben-search',
    dropdownId: 'linie-verschieben-dropdown',
    title: 'In andere Linie verschieben',
    fieldLabel: 'Linie wählen',
    placeholder: 'Linie suchen...',
    confirmLabel: 'Verschieben',
    emptyText: 'Keine andere Linie in dieser Kampagne',
    inlineDropdown: true,
    search: async (term) => {
      const suche = term.trim().toLowerCase();
      if (!suche) return linien;
      return linien.filter(linie => linie.label.toLowerCase().includes(suche));
    },
    renderItem: (linie) => {
      const badge = linie.ist_altbestand ? '<div class="dropdown-item-details">Altbestand</div>' : '';
      return `<div class="dropdown-item-main">${esc(linie.label)}</div>${badge}`;
    },
    onConfirm: async (briefingId) => {
      const linie = linien.find(zeile => zeile.id === briefingId);
      if (!linie) throw new Error('Die Linie ist nicht mehr verfügbar.');
      const kontext = await ladeKontext(db, kooperation, linie);
      const plan = planLinieWechsel(kontext);
      if (!plan.ok) throw new Error(grundText(plan.grund));
      await applyLinieWechsel(db, plan);
      window.dispatchEvent(new CustomEvent('entityUpdated', {
        detail: { entity: 'kooperation', action: 'updated', id: kooperationId }
      }));
      window.dispatchEvent(new Event('softRefresh'));
    },
    successAlert: 'Die Kooperation liegt jetzt auf der gewählten Linie.',
    errorAlert: (err) => err?.message || 'Verschieben fehlgeschlagen.'
  });
}
