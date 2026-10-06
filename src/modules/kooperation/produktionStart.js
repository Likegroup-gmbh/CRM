// Produktion aus einer Konzept-Zeile starten.
// Die Buchung bleibt eine Kooperation. Zuordnung kommt aus dem Konzept.

import { actionState } from '../../core/actions/actionState.js';
import { openProduktionStartDrawer } from './ProduktionStartDrawer.js';

const HIDDEN_INPUTS = new Set(['unternehmen_id', 'marke_id', 'briefing_id', 'creator_id', 'name']);
const KONTEXT_FELDER = ['unternehmen_id', 'marke_id', 'kampagne_id', 'briefing_id', 'produktion_id', 'creator_id'];

/**
 * Zuordnungsfelder der Kooperation als Hidden-Werte. Kampagne bleibt ein
 * Select, weil der Video-Stepper daran hängt. Content und Preise bleiben.
 */
export function applyKontextAnlage(fields) {
  const next = [];
  let hasProduktion = false;

  for (const field of fields || []) {
    if (field.name === 'produktion_id') hasProduktion = true;
    if (field.name === 'kampagne_id') {
      next.push({ name: 'kampagne_id', type: 'hidden-select', section: null });
      continue;
    }
    if (HIDDEN_INPUTS.has(field.name)) {
      next.push({ name: field.name, type: 'hidden', section: null });
      continue;
    }
    if (field.name === 'tags') continue;
    next.push(field);
  }

  if (!hasProduktion) {
    next.unshift({ name: 'produktion_id', type: 'hidden', section: null });
  }
  return next;
}

export function buildProduktionStartKontext(strategie, item) {
  const eintrag = item?.casting_eintrag;
  const creator = eintrag?.creator;
  const creatorName = eintrag?.name
    || [creator?.vorname, creator?.nachname].filter(Boolean).join(' ')
    || '';

  return {
    _kontextAnlage: true,
    unternehmen_id: strategie?.unternehmen_id || '',
    marke_id: strategie?.marke_id || '',
    kampagne_id: strategie?.kampagne_id || '',
    briefing_id: strategie?.briefing_id || '',
    produktion_id: strategie?.produktion_id || '',
    creator_id: eintrag?.creator_id || '',
    creatorName
  };
}

// Die Kaskade kann das versteckte Kampagnen-Select leeren. Vor dem Submit
// stehen die IDs aus dem Konzept wieder auf den Controls, sonst fällt die
// Kampagne aus dem FormData und die Validierung verlangt sie erneut.
export function restoreKontextFelder(form, kontext) {
  if (!form || !kontext) return;

  for (const name of KONTEXT_FELDER) {
    const value = kontext[name];
    if (!value) continue;
    const el = form.querySelector(`[name="${name}"]`);
    if (!el) continue;

    if (el.tagName === 'SELECT') {
      const hasOption = Array.from(el.options).some(option => option.value === value);
      if (!hasOption) el.appendChild(new Option(value, value, true, true));
      el.value = value;
    } else {
      el.value = value;
    }
    el.disabled = false;
  }
}

/**
 * Bedingungen, unter denen „Produktion starten“ klickbar ist.
 * Eintrag ohne Creator sagt nur „anlegen“, nicht zusätzlich „verbinden“.
 */
export function produktionStartChecks(item) {
  const eintrag = item?.casting_eintrag;
  const verbunden = !!(item?.creator_auswahl_item_id || eintrag);
  const checks = [
    { ok: !!item?.video_umgesetzt, reason: 'Zuerst Umsetzen aktivieren' }
  ];

  if (!verbunden) {
    checks.push({ ok: false, reason: 'Zuerst den Creator verbinden' });
  } else if (!eintrag?.creator_id) {
    checks.push({ ok: false, reason: 'Zuerst den Creator anlegen' });
  }

  checks.push({ ok: !!item?.produkt_id, reason: 'Zuerst das Produkt verbinden' });
  return checks;
}

export function produktionStartEntscheidung(kontext, existing) {
  if (!kontext?.creator_id) {
    return { open: false, message: 'Zuerst den Creator anlegen' };
  }
  if (!kontext.produktion_id || !kontext.kampagne_id) {
    return { open: false, message: 'Am Konzept hängt keine Produktion' };
  }
  if (existing) {
    return { open: false, message: 'Für diesen Creator gibt es in dieser Linie schon eine Kooperation' };
  }
  return { open: true, message: null };
}

// Eine Kooperation pro Creator und Linie: derselbe Creator darf in zwei Linien
// derselben Produktion je eine eigene Kooperation haben.
export async function findKooperationForCreator(client, { produktionId, creatorId, briefingId = null }) {
  if (!client || !produktionId || !creatorId) return null;

  let query = client
    .from('kooperationen')
    .select('id')
    .eq('produktion_id', produktionId)
    .eq('creator_id', creatorId);
  if (briefingId) query = query.eq('briefing_id', briefingId);
  const { data, error } = await query.limit(1);

  if (error) throw new Error(error.message || 'Kooperationen konnten nicht geladen werden');
  return data?.[0] || null;
}

export async function startProduktionFromItem(detail, itemId, deps = {}) {
  const toast = deps.toast || (typeof window !== 'undefined' ? window.toastSystem : null);
  const open = deps.open || openProduktionStartDrawer;

  try {
    const item = detail?.items?.find(i => i.id === itemId);
    const availability = actionState(produktionStartChecks(item));
    if (availability.mode !== 'enabled') {
      if (availability.title) toast?.show(availability.title, 'warning');
      return { opened: false, message: availability.title };
    }

    const kontext = buildProduktionStartKontext(detail.strategie, item);
    const client = deps.client || (typeof window !== 'undefined' ? window.supabase : null);
    const existing = await findKooperationForCreator(client, {
      produktionId: kontext.produktion_id,
      creatorId: kontext.creator_id,
      briefingId: kontext.briefing_id || null
    });
    const decision = produktionStartEntscheidung(kontext, existing);

    if (!decision.open) {
      toast?.show(decision.message, 'warning');
      return { opened: false, message: decision.message };
    }

    await open(kontext);
    return { opened: true };
  } catch (error) {
    console.error('Produktion starten fehlgeschlagen:', error);
    toast?.show('Produktion konnte nicht gestartet werden', 'error');
    return { opened: false };
  }
}
