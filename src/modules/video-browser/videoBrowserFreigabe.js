// videoBrowserFreigabe.js
// Video-Freigabe durch die Kundenseite (ADR 0072): ein Klick gibt die aktuelle Feedbackschleife
// eines Videos frei. Der Server legt ihre Dateien als Finale Version ab und setzt das Flag
// `freigabe` am Video (Checkbox der Kooperationstabelle). Danach ist der Kunde nicht mehr am Zug.

import { confirmationModal } from '../../core/ConfirmationModal.js';
import { escapeHtml as esc } from '../../core/format.js';
import { icon } from '../../core/icons/IconSystem.js';
import { ablageVonQuelle } from '../../core/ablage/ablageUpload.js';
import { STILL_FINAL_VARIANT } from '../../core/stills/stillAssets.js';
import { freigebenVideoKunde, zuruecknehmenVideoKunde } from './VideoBrowserAdapter.js';
import { buildTree, detectRatio, formatDatum, plural, selectionEquals, validateSelection } from './videoBrowserLogic.js';
import { ratioOfItem } from './videoBrowserRatio.js';

const RAW_KEY = { video: 'videoAssets', story: 'storyAssets', still: 'stillAssets' };

/** Feedbackschleife mit Dateien, in der der Kunde am Zug ist. */
export function aktuelleSchleife(row) {
  return row?.folders?.find(f => f.kind === 'schleife' && f.current && !f.leer) || null;
}

/** Dateien der Schleife, die Finale Version werden können: Videos, Stories und Bilder mit Video. */
export function freigabeDateien(folder) {
  return (folder?.items || []).filter(i => RAW_KEY[i.type] && i.asset?.id && (i.type !== 'still' || i.asset.video_id));
}

/** Kundenseite mit Feedback-Recht, und die aktuelle Schleife hat Dateien. Das Team gibt über "Als final markieren" frei. */
export function kannFreigeben(ctx, row) {
  if (!ctx || ctx.team || !ctx.canComment || !row) return false;
  return freigabeDateien(aktuelleSchleife(row)).length > 0;
}

/** Seitenverhältnis aus den gespeicherten Pixelmaßen, sonst aus den Metadaten der Datei. */
async function ratioVon(item) {
  const fest = detectRatio(item.asset?.breite, item.asset?.hoehe);
  return fest || ratioOfItem(item);
}

/**
 * Nutzlast für den Server. Videos und Stories brauchen ein Standardformat; ohne bleiben sie in der Schleife.
 * @param {object[]} dateien aus freigabeDateien()
 * @param {(item: object) => Promise<string|null>} [ratioFn]
 * @returns {Promise<{ finals: Array<{ kind: string, source_id: string, slot: string|null }>, uebersprungen: object[] }>}
 */
export async function freigabeNutzlast(dateien, ratioFn = ratioVon) {
  const formate = await Promise.all(dateien.map(i => (i.type === 'still' ? null : ratioFn(i).catch(() => null))));
  const finals = [];
  const uebersprungen = [];
  dateien.forEach((item, idx) => {
    if (item.type !== 'still' && !formate[idx]) {
      uebersprungen.push(item);
      return;
    }
    finals.push({ kind: item.type, source_id: item.asset.id, slot: item.type === 'still' ? null : formate[idx] });
  });
  return { finals, uebersprungen };
}

/** Datum der Freigabe: jüngste Finale Version, die aus dieser Schleife stammt. */
export function freigegebenAm(row, folder) {
  const quellen = new Set((folder?.items || []).map(i => i.id));
  const daten = (row?.folders?.find(f => f.kind === 'final')?.items || [])
    .filter(i => quellen.has(i.asset?.source_asset_id))
    .map(i => String(i.asset?.created_at || ''))
    .filter(Boolean)
    .sort();
  return daten.length ? daten[daten.length - 1] : null;
}

/* ---- HTML ---- */

export function freigabeButtonHtml(row, { secondary = false } = {}) {
  return `<button type="button" class="mdc-btn${secondary ? ' mdc-btn--secondary' : ''} vb-freigabe-btn" data-vb-kunde-freigeben="${esc(row.id)}">${icon('check')}<span>Video freigeben</span></button>`;
}

/**
 * Leiste unter dem Player (Kundenansicht, an der Stelle der Final-Leiste des Teams):
 * in der Schleife, die beim Kunden liegt, der Knopf, in der freigegebenen der Vermerk.
 */
export function kundenFreigabeBarHtml(ctx) {
  const { row, folder, item } = ctx.resolved;
  if (!row || !folder || folder.kind !== 'schleife' || !item || item.type === 'roh') return '';
  if (folder.current && kannFreigeben(ctx, row)) {
    return `
    <div class="vb-freigabe">
      <button type="button" class="vb-finalbar vb-finalbar--freigabe" data-vb-kunde-freigeben="${esc(row.id)}">
        <span class="vb-finalbar__star">${icon('check')}</span>
        <span class="vb-finalbar__text">
          <span class="vb-finalbar__title">Video freigeben</span>
          <span class="vb-finalbar__sub">${esc(`Gibt ${plural(freigabeDateien(folder).length, 'Datei', 'Dateien')} aus ${folder.name} frei`)}</span>
        </span>
      </button>
    </div>`;
  }
  if (folder.status?.key === 'freigegeben') {
    const am = formatDatum(freigegebenAm(row, folder));
    return `
    <div class="vb-freigabe">
      <p class="vb-finalbar vb-finalbar--freigegeben is-final" role="status">
        <span class="vb-finalbar__star">${icon('check')}</span>
        <span class="vb-finalbar__text">
          <span class="vb-finalbar__title">${esc(am ? `Freigegeben am ${am}` : 'Freigegeben')}</span>
          <span class="vb-finalbar__sub">Die Finale Version steht bereit.</span>
        </span>
      </p>
    </div>`;
  }
  return '';
}

/* ---- Ablauf ---- */

/** Baum neu bauen und die Ansicht angleichen, ohne den Player neu zu starten. */
function refreshView(vb) {
  vb.tree = buildTree(vb.raw, { team: vb.team });
  const valid = validateSelection(vb.sel, vb.tree);
  if (!selectionEquals(valid, vb.sel)) vb._setSel(valid);
  vb._render({ restoreFocus: false, patch: true });
}

function findRow(vb, rowId) {
  for (const koop of vb.tree.kooperationen) {
    const row = koop.rows.find(r => r.id === rowId);
    if (row) return { koop, row };
  }
  return null;
}

function tempFinal(item, slot) {
  const source = item.asset;
  return {
    id: `tmp-freigabe-${source.id}`,
    video_id: source.video_id,
    story_id: source.story_id ?? null,
    kooperation_id: source.kooperation_id,
    file_url: source.file_url,
    file_path: source.file_path,
    file_name: source.file_name,
    file_size: source.file_size || 0,
    version_number: 1,
    variant_name: item.type === 'still' ? STILL_FINAL_VARIANT : slot,
    titel: source.titel || null,
    is_current: false,
    is_final: true,
    source_asset_id: source.id,
    ...ablageVonQuelle(source),
    created_at: new Date().toISOString()
  };
}

function setBusy(button, busy) {
  if (!button) return;
  if (busy) button.setAttribute('aria-busy', 'true');
  else button.removeAttribute('aria-busy');
}

function bestaetigungsText(row, folder, finals, uebersprungen) {
  const teile = [
    `„${esc(row.label)}“ aus ${esc(folder.name)} wird freigegeben. ${esc(plural(finals.length, 'Datei geht', 'Dateien gehen'))} als Finale Version an das Team.`
  ];
  if (uebersprungen.length) {
    teile.push(`${esc(plural(uebersprungen.length, 'Datei', 'Dateien'))} ohne Standardformat (9:16, 4:5, 1:1) ${uebersprungen.length === 1 ? 'bleibt' : 'bleiben'} in der Feedbackschleife: ${uebersprungen.map(i => `„${esc(i.name)}“`).join(', ')}.`);
  }
  return teile.join('<br><br>');
}

/**
 * Klick auf "Video freigeben": Formate bestimmen, bestätigen, sofort als freigegeben zeigen,
 * dann speichern. Ein Fehler rollt zurück, der Toast bietet kurz "Rückgängig".
 */
export async function freigabeAusfuehren(vb, button) {
  const rowId = button?.dataset?.vbKundeFreigeben;
  const found = rowId ? findRow(vb, rowId) : null;
  if (!found || !kannFreigeben(vb._ctx(), found.row)) return;
  vb._freigabeBusy = vb._freigabeBusy || new Set();
  if (vb._freigabeBusy.has(rowId)) return;
  vb._freigabeBusy.add(rowId);
  setBusy(button, true);
  try {
    await ablauf(vb, found);
  } finally {
    vb._freigabeBusy.delete(rowId);
    setBusy(button, false);
  }
}

async function ablauf(vb, { row }) {
  const folder = aktuelleSchleife(row);
  const dateien = freigabeDateien(folder);
  const { finals, uebersprungen } = await freigabeNutzlast(dateien);
  if (vb.destroyed) return;
  if (!finals.length) {
    vb.toast('error', 'Keine Datei im Standardformat (9:16, 4:5, 1:1) gefunden. Bitte melde dich beim Team.');
    return;
  }

  const { confirmed } = await confirmationModal.open({
    title: 'Video freigeben',
    message: bestaetigungsText(row, folder, finals, uebersprungen),
    confirmText: 'Freigeben',
    danger: false
  });
  if (!confirmed || vb.destroyed) return;

  const byId = new Map(dateien.map(i => [i.asset.id, i]));
  const temps = { video: [], story: [], still: [] };
  for (const f of finals) temps[f.kind].push(tempFinal(byId.get(f.source_id), f.slot));
  const tempIds = new Set(Object.values(temps).flat().map(t => t.id));
  ersetzen(vb, new Set(), temps);
  refreshView(vb);

  let saved;
  try {
    saved = await freigebenVideoKunde(row.id, finals);
  } catch (err) {
    console.error('VideoBrowser: Freigabe fehlgeschlagen', err);
    if (vb.destroyed) return;
    ersetzen(vb, tempIds);
    refreshView(vb);
    if (err?.hint === 'bereits_freigegeben') {
      vb.toast('info', 'Dieses Video ist bereits freigegeben.');
      void vb.reload().catch(() => {});
    } else {
      vb.toast('error', 'Freigabe fehlgeschlagen. Bitte versuche es erneut.');
    }
    return;
  }
  if (vb.destroyed) return;

  const ids = [...saved.video, ...saved.story, ...saved.still].map(a => a.id);
  ersetzen(vb, new Set([...tempIds, ...ids]), saved);
  refreshView(vb);

  vb.toast('success', 'Video freigegeben.', {
    action: { label: 'Rückgängig', onClick: () => { void zuruecknehmen(vb, row.id, ids, saved.freigabe_vorher); } }
  });
}

/**
 * Entfernt Zeilen nach id aus vb.raw und hängt neue an. Arbeitet auf dem aktuellen Stand,
 * weil ein Live-Reload vb.raw zwischendurch ersetzen kann.
 */
function ersetzen(vb, weg, neu = {}) {
  for (const [kind, key] of Object.entries(RAW_KEY)) {
    vb.raw[key] = [...(vb.raw[key] || []).filter(a => !weg.has(a.id)), ...(neu[kind] || [])];
  }
}

async function zuruecknehmen(vb, videoId, ids, freigabeVorher) {
  if (vb.destroyed || !ids.length) return;
  const weg = new Set(ids);
  const entfernt = { video: [], story: [], still: [] };
  for (const [kind, key] of Object.entries(RAW_KEY)) {
    entfernt[kind] = (vb.raw[key] || []).filter(a => weg.has(a.id));
  }
  ersetzen(vb, weg);
  refreshView(vb);
  try {
    await zuruecknehmenVideoKunde(videoId, ids, freigabeVorher);
  } catch (err) {
    console.error('VideoBrowser: Freigabe zurücknehmen fehlgeschlagen', err);
    if (vb.destroyed) return;
    ersetzen(vb, weg, entfernt);
    refreshView(vb);
    vb.toast('error', 'Die Freigabe lässt sich nicht mehr zurücknehmen. Bitte melde dich beim Team.');
    return;
  }
  if (!vb.destroyed) vb.toast('success', 'Rückgängig gemacht.');
}
