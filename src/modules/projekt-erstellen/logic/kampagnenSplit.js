// kampagnenSplit.js
// Allokation von Auftrags-Netto auf N Kampagnen. Videos/Creator kommen
// aus den Kampagnenart-Bloecken der jeweiligen Kampagne.

import { parseCurrencyInput } from '../../../core/utils/parseCurrency.js';
import { normalizeCampaignBlocks } from './CampaignBudgetFields.js';
import {
  allocateProportionalMoney,
  roundMoney,
  splitMoneyEvenly,
  sumBy
} from './splitEvenly.js';

export function campaignBlockTotals(details) {
  return normalizeCampaignBlocks(details).reduce((sum, block) => {
    sum.videos += parseInt(block.video_anzahl, 10) || 0;
    sum.creators += parseInt(block.creator_anzahl, 10) || 0;
    return sum;
  }, { videos: 0, creators: 0 });
}

export function parentTotals(formData) {
  return {
    volumen: parseCurrencyInput(formData?.auftrag?.nettobetrag) || 0
  };
}

export function flattenCampaignBlocks(formData) {
  const slots = Array.isArray(formData?.kampagnen) ? formData.kampagnen : [];
  const scoped = slots.filter(slot => Array.isArray(slot?.campaign_blocks));
  if (scoped.length > 0) {
    return normalizeCampaignBlocks({
      campaign_blocks: scoped.flatMap(slot => slot.campaign_blocks)
    });
  }
  return normalizeCampaignBlocks(formData?.details);
}

export function filterBlocksForKampagne(blocks, kampagneId, { kampagnenNummer } = {}) {
  const list = Array.isArray(blocks) ? blocks : [];
  if (!kampagneId) return list;
  const own = list.filter(block => block.kampagne_id === kampagneId);
  if (own.length) return own;
  const isFirst = kampagnenNummer == null || Number(kampagnenNummer) === 1;
  if (!isFirst) return [];
  return list.filter(block => !block.kampagne_id);
}

export function makeKampagneSlot(nummer, {
  id = null,
  volumen = 0,
  videoanzahl = 0,
  creatoranzahl = 0,
  campaign_blocks = [],
  eigener_name = null
} = {}) {
  const blocks = Array.isArray(campaign_blocks)
    ? campaign_blocks.map(block => ({ ...block }))
    : [];
  const counts = campaignBlockTotals({ campaign_blocks: blocks });
  const hasBlocks = blocks.length > 0;
  const name = typeof eigener_name === 'string' ? eigener_name.trim() : '';
  return {
    id: id || null,
    kampagnen_nummer: nummer,
    eigener_name: name || null,
    volumen: roundMoney(volumen),
    campaign_blocks: blocks,
    videoanzahl: hasBlocks ? counts.videos : (parseInt(videoanzahl, 10) || 0),
    creatoranzahl: hasBlocks ? counts.creators : (parseInt(creatoranzahl, 10) || 0)
  };
}

export function distributeKampagnen(count, totals, existing = []) {
  const n = Math.max(1, parseInt(count, 10) || 1);
  const volParts = splitMoneyEvenly(totals?.volumen || 0, n);
  return Array.from({ length: n }, (_, i) => makeKampagneSlot(i + 1, {
    id: existing[i]?.id || null,
    volumen: volParts[i],
    campaign_blocks: existing[i]?.campaign_blocks || [],
    videoanzahl: existing[i]?.videoanzahl,
    creatoranzahl: existing[i]?.creatoranzahl,
    eigener_name: existing[i]?.eigener_name
  }));
}

export function resizeKampagnen(existing, newCount, totals) {
  const n = Math.max(1, parseInt(newCount, 10) || 1);
  const keep = (existing || []).slice(0, n);
  if (keep.length === n) {
    return keep.map((slot, i) => makeKampagneSlot(i + 1, slot));
  }

  const neue = n - keep.length;
  const restVol = Math.max(0, roundMoney((totals?.volumen || 0) - sumBy(keep, 'volumen')));
  const volParts = splitMoneyEvenly(restVol, neue);

  return Array.from({ length: n }, (_, i) => {
    if (keep[i]) return makeKampagneSlot(i + 1, keep[i]);
    return makeKampagneSlot(i + 1, {
      volumen: volParts[i - keep.length],
      campaign_blocks: []
    });
  });
}

export function reallocateFromEdited(slots, index, volumen, totals) {
  const list = (slots || []).map((slot, i) => makeKampagneSlot(slot.kampagnen_nummer || i + 1, slot));
  if (list.length === 0) return list;

  const idx = Math.max(0, Math.min(list.length - 1, parseInt(index, 10) || 0));
  const parentVol = roundMoney(totals?.volumen || 0);
  const raw = roundMoney(Math.max(0, Number(volumen) || 0));
  const nextVol = parentVol > 0 ? Math.min(parentVol, raw) : raw;

  if (list.length === 1) {
    return [makeKampagneSlot(1, { ...list[0], volumen: nextVol })];
  }

  const rest = Math.max(0, roundMoney(parentVol - nextVol));
  const parts = splitMoneyEvenly(rest, list.length - 1);
  let otherI = 0;
  return list.map((slot, i) => {
    if (i === idx) return makeKampagneSlot(slot.kampagnen_nummer, { ...slot, volumen: nextVol });
    return makeKampagneSlot(slot.kampagnen_nummer, { ...slot, volumen: parts[otherI++] });
  });
}

export function addKampagneSlot(slots, totals) {
  const keep = (slots || []).map((slot, i) => makeKampagneSlot(slot.kampagnen_nummer || i + 1, slot));
  const restVol = Math.max(0, roundMoney((totals?.volumen || 0) - sumBy(keep, 'volumen')));
  keep.push(makeKampagneSlot(keep.length + 1, {
    volumen: restVol,
    campaign_blocks: []
  }));
  return keep;
}

export function removeKampagneSlot(slots, index) {
  const list = (slots || []).map((slot, i) => makeKampagneSlot(slot.kampagnen_nummer || i + 1, slot));
  if (list.length <= 1) return list;
  const idx = parseInt(index, 10);
  if (!Number.isInteger(idx) || idx < 0 || idx >= list.length) return list;
  return list.filter((_, i) => i !== idx).map((slot, i) => makeKampagneSlot(i + 1, slot));
}

export function kampagnenResttopf(slots, totals) {
  const sumVol = roundMoney(sumBy(slots || [], 'volumen'));
  const parentVol = roundMoney(totals?.volumen || 0);
  return roundMoney(parentVol - sumVol);
}

export function kampagnenSplitHint(slots, totals) {
  const list = slots || [];
  if (list.length === 0) return null;

  const rest = kampagnenResttopf(list, totals);
  if (Math.abs(rest) <= 0.01) return null;
  if (rest > 0) {
    return {
      message: `Noch ${fmtMoney(rest)} € vom Auftrag nicht zugeordnet.`,
      kind: 'info'
    };
  }
  const sumVol = roundMoney(sumBy(list, 'volumen'));
  const parentVol = roundMoney(totals?.volumen || 0);
  return {
    message: `Hinweis: Die Kampagnen-Aufteilung weicht vom Auftrag ab (Volumen ${fmtMoney(sumVol)} € vs. Auftrag ${fmtMoney(parentVol)} €).`,
    kind: 'warning'
  };
}

export function kampagneDisplayName(titel, index, count) {
  if (!titel) return null;
  if (count <= 1 || index === 0) return titel;
  return `${titel} (${index + 1})`;
}

export function allocateCreatorBudgets(slots, auftragCreatorBudget) {
  const list = slots || [];
  return allocateProportionalMoney(
    list.map(slot => slot?.volumen || 0),
    auftragCreatorBudget
  );
}

export function seedSlotBlocksFromDetails(formData) {
  const slots = Array.isArray(formData?.kampagnen) ? formData.kampagnen : [];
  if (slots.some(slot => (slot?.campaign_blocks || []).length > 0)) return slots;
  const detailBlocks = normalizeCampaignBlocks(formData?.details);
  if (!detailBlocks.length || !slots[0]) return slots;
  return slots.map((slot, i) => makeKampagneSlot(slot.kampagnen_nummer || i + 1, {
    ...slot,
    campaign_blocks: i === 0 ? detailBlocks : (slot.campaign_blocks || [])
  }));
}

export function normalizeKampagnenSlots(formData) {
  const slots = Array.isArray(formData?.kampagnen) ? formData.kampagnen.filter(Boolean) : [];
  if (slots.length > 0) {
    return slots.map((slot, i) => makeKampagneSlot(slot.kampagnen_nummer || i + 1, slot));
  }
  const totals = parentTotals(formData);
  return [makeKampagneSlot(1, {
    id: formData?.kampagne?.id || null,
    volumen: totals.volumen,
    campaign_blocks: normalizeCampaignBlocks(formData?.details),
    eigener_name: formData?.kampagne?.eigener_name
  })];
}

function fmtMoney(n) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
