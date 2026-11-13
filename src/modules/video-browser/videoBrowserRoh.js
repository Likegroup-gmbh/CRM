// videoBrowserRoh.js
// Rohmaterial im Videos-Tab (Team, ADR 0070): Unterordner ein-/ausklappen und anlegen, Dateien
// markieren und in eine Feedbackschleife verschieben, über die Leiste mit Ziel-Menü oder per
// Drag & Drop auf eine Schleife in Spalte 2. Alle Funktionen bekommen den Controller (`vb`).

import { ablageRohOrdnerAnlegen, ablageRohVerschieben } from '../../core/ablage/ablageApi.js';
import { ablageVonQuelle } from '../../core/ablage/ablageUpload.js';
import {
  buildTree,
  cssEscape,
  plural,
  resolveSelection,
  schleifeName,
  selectionEquals,
  validateSelection
} from './videoBrowserLogic.js';
import { rohKey } from './videoBrowserRenderRoh.js';
import { rohZielTyp } from './videoBrowserRohOrdner.js';

export const ROH_DRAG_TYPE = 'application/x-vb-roh';

const lower = (s) => String(s || '').toLowerCase();
const titelAusName = (name) => String(name || '').replace(/\.[a-z0-9]{2,5}$/i, '').trim().slice(0, 120) || null;

export function rohZuruecksetzen(vb) {
  vb.rohAuswahl.clear();
  vb.rohMenu = false;
  vb.rohNeu = null;
}

function offenerRohOrdner(vb) {
  const r = resolveSelection(vb.tree, vb.sel);
  return r.folder?.kind === 'raw' ? r : null;
}

function fokus(vb, selector) {
  vb.colsEl?.querySelector(selector)?.focus({ preventScroll: true });
}

/** Baum neu bauen; verschwindet die gewählte Datei, rendert auch das Detail neu. */
function refresh(vb) {
  vb.tree = buildTree(vb.raw, { team: vb.team });
  const valid = validateSelection(vb.sel, vb.tree);
  if (!selectionEquals(valid, vb.sel)) {
    vb._setSel(valid);
    vb._render({ restoreFocus: false });
    return;
  }
  vb._renderNav();
}

/* ---- Ordner ---- */

export function rohToggle(vb, pfad) {
  const r = offenerRohOrdner(vb);
  if (!r) return;
  const key = rohKey(r.koop.id, pfad);
  if (vb.rohZu.has(key)) vb.rohZu.delete(key);
  else vb.rohZu.add(key);
  vb._renderNav();
  fokus(vb, `[data-vb-roh-toggle="${cssEscape(pfad)}"]`);
}

export function rohNeuOeffnen(vb, parentPfad = '') {
  const r = offenerRohOrdner(vb);
  if (!r || !vb.canUpload) return;
  vb.rohNeu = { koopId: r.koop.id, parent: parentPfad };
  if (parentPfad) vb.rohZu.delete(rohKey(r.koop.id, parentPfad));
  vb._renderNav();
  fokus(vb, '[data-vb-roh-neu-input]');
}

export function rohNeuSchliessen(vb) {
  if (!vb.rohNeu || vb._rohNeuBusy) return;
  vb.rohNeu = null;
  vb._renderNav();
}

export async function rohNeuAnlegen(vb, form) {
  const r = offenerRohOrdner(vb);
  if (!r || !vb.rohNeu || vb._rohNeuBusy) return;
  const input = form.querySelector('[data-vb-roh-neu-input]');
  const name = input?.value.trim() || '';
  if (!name) {
    rohNeuSchliessen(vb);
    return;
  }
  const parentPfad = form.dataset.parent || '';
  const eltern = parentPfad ? (r.folder.unterordner || []).find(o => lower(o.pfad) === lower(parentPfad)) : null;
  if (parentPfad && !eltern?.itemId) {
    vb.toast('error', 'Dieser Ordner ist noch nicht in der Ablage angekommen. Bitte gleich erneut versuchen.');
    return;
  }

  vb._rohNeuBusy = true;
  input.disabled = true;
  try {
    const { ordner } = await ablageRohOrdnerAnlegen(r.koop.id, name, eltern?.itemId || null);
    if (vb.destroyed) return;
    const liste = vb.raw.rohOrdner || [];
    if (!liste.some(o => o.item_id === ordner.item_id)) {
      vb.raw.rohOrdner = [...liste, { ...ordner, art: 'frei', kooperation_id: r.koop.id }];
    }
    vb._rohNeuBusy = false;
    vb.rohNeu = null;
    refresh(vb);
    vb.toast('success', `Ordner „${ordner.name}“ angelegt.`);
  } catch (err) {
    console.error('VideoBrowser: Ordner anlegen fehlgeschlagen', err);
    vb._rohNeuBusy = false;
    if (vb.destroyed) return;
    vb.toast('error', err?.message || 'Ordner konnte nicht angelegt werden.');
    input.disabled = false;
    input.focus();
  }
}

/* ---- Markieren ---- */

/** Checkbox geklickt; mit Shift markiert sie den Bereich seit der letzten (Reihenfolge wie angezeigt). */
export function rohCheck(vb, input, { shift = false } = {}) {
  const id = input.dataset.vbRohCheck;
  const an = input.checked;
  const ids = [...vb.colsEl.querySelectorAll('[data-vb-roh-check]')].map(el => el.dataset.vbRohCheck);
  const a = ids.indexOf(vb._rohLetzter);
  const b = ids.indexOf(id);
  const bereich = shift && a >= 0 && b >= 0 ? ids.slice(Math.min(a, b), Math.max(a, b) + 1) : [id];
  for (const x of bereich) {
    if (an) vb.rohAuswahl.add(x);
    else vb.rohAuswahl.delete(x);
  }
  vb._rohLetzter = id;
  if (!vb.rohAuswahl.size) vb.rohMenu = false;
  vb._renderNav();
  fokus(vb, `[data-vb-roh-check="${cssEscape(id)}"]`);
}

export function rohMarkierungAufheben(vb) {
  vb.rohAuswahl.clear();
  vb.rohMenu = false;
  vb._renderNav();
}

export function rohMenuUmschalten(vb, offen = !vb.rohMenu) {
  vb.rohMenu = offen && vb.rohAuswahl.size > 0;
  vb._renderNav();
  fokus(vb, vb.rohMenu ? '[data-vb-roh-ziel]' : '[data-vb-roh-menu]');
}

/** Aus dem Detail: genau diese Datei markieren und das Ziel-Menü öffnen. */
export function rohEinzelnVerschieben(vb, id) {
  vb.rohAuswahl.clear();
  vb.rohAuswahl.add(id);
  rohMenuUmschalten(vb, true);
}

/* ---- Verschieben ---- */

function tempAsset(asset, { videoId, version, kooperationId, jetzt }) {
  const typ = rohZielTyp(asset.file_name);
  const basis = {
    id: `tmp-roh-${asset.id}`,
    video_id: videoId,
    file_url: asset.file_url,
    file_path: asset.file_path,
    file_name: asset.file_name,
    version_number: version,
    variant_name: null,
    titel: asset.titel || titelAusName(asset.file_name),
    is_final: false,
    source_asset_id: null,
    ...ablageVonQuelle(asset),
    created_at: jetzt
  };
  return {
    typ,
    row: typ === 'still' ? { ...basis, kooperation_id: kooperationId, file_size: asset.file_size } : { ...basis, is_current: true }
  };
}

/**
 * Rohmaterial in Feedbackschleife `version` von Video `videoId` verschieben. Die Dateien wechseln
 * sofort (optimistisch), danach lädt der Tab den echten Stand. Schlägt alles fehl, kommt der alte zurück.
 */
export async function rohVerschieben(vb, ids, { videoId, version }) {
  if (!vb.canUpload || vb._rohMoveBusy || !ids?.length) return;
  const { koop } = resolveSelection(vb.tree, vb.sel);
  const zielRow = koop?.rows.find(x => x.id === videoId);
  if (!zielRow) return;
  const wanted = new Set(ids);
  const items = (zielRow.folders.find(f => f.kind === 'raw')?.items || []).filter(i => wanted.has(i.id));
  const movable = items.filter(i => i.verschiebbar);
  if (!movable.length) {
    vb.toast('warning', 'Nur Videos und Bilder aus SharePoint lassen sich in eine Feedbackschleife verschieben.');
    return;
  }

  vb._rohMoveBusy = true;
  const before = { rohmaterial: vb.raw.rohmaterial, videoAssets: vb.raw.videoAssets, stillAssets: vb.raw.stillAssets };
  const set = new Set(movable.map(i => i.id));
  const jetzt = new Date().toISOString();
  const temps = movable.map(i => tempAsset(i.asset, { videoId, version, kooperationId: koop.id, jetzt }));
  vb.raw.rohmaterial = (before.rohmaterial || []).filter(a => !set.has(a.id));
  vb.raw.videoAssets = [...(before.videoAssets || []), ...temps.filter(t => t.typ === 'video').map(t => t.row)];
  vb.raw.stillAssets = [...(before.stillAssets || []), ...temps.filter(t => t.typ === 'still').map(t => t.row)];
  for (const id of set) vb.rohAuswahl.delete(id);
  vb.rohMenu = false;
  refresh(vb);

  let ergebnisse;
  try {
    ergebnisse = await ablageRohVerschieben([...set], videoId, version);
  } catch (err) {
    ergebnisse = [...set].map(id => ({ id, ok: false, fehler: err?.message }));
  } finally {
    vb._rohMoveBusy = false;
  }
  if (vb.destroyed) return;

  const ok = ergebnisse.filter(e => e.ok).length;
  const fehler = ergebnisse.filter(e => !e.ok);
  if (!ok) {
    Object.assign(vb.raw, before);
    refresh(vb);
  }
  if (ok) {
    const ziel = { kooperationId: koop.id, videoId, folderId: `s${version}` };
    vb.toast('success', `${plural(ok, 'Datei', 'Dateien')} nach „${schleifeName(version)}“ (${zielRow.label}) verschoben.`, {
      action: { label: 'Öffnen', onClick: () => vb._select(ziel, { autoItem: true }) }
    });
  }
  if (fehler.length) {
    const grund = fehler[0].fehler || 'Verschieben fehlgeschlagen';
    vb.toast('error', fehler.length === set.size ? grund : `${plural(fehler.length, 'Datei', 'Dateien')} nicht verschoben: ${grund}`);
  }
  try {
    await vb.reload();
  } catch (err) {
    console.error('VideoBrowser: Aktualisieren nach Verschieben fehlgeschlagen', err);
  }
}

/* ---- Drag & Drop auf eine Feedbackschleife in Spalte 2 ---- */

// vb._rohDrag deckt Browser ab, die eigene Typen während dragover nicht in `types` zeigen
const istRohDrag = (vb, e) => !!vb._rohDrag || [...(e.dataTransfer?.types || [])].includes(ROH_DRAG_TYPE);

function zielVon(vb, target) {
  const li = target?.closest?.('.vb-col--2 li[data-folder-id]');
  if (!li) return null;
  const { row } = resolveSelection(vb.tree, vb.sel);
  const f = row?.folders.find(x => x.id === li.dataset.folderId);
  return f?.kind === 'schleife' ? { li, videoId: row.id, version: f.number } : null;
}

function zielLoeschen(vb) {
  vb.root.querySelectorAll('.is-roh-drop').forEach(el => el.classList.remove('is-roh-drop'));
}

function dragGhost(anzahl) {
  const el = document.createElement('div');
  el.className = 'vb-roh-dragghost';
  el.textContent = plural(anzahl, 'Datei', 'Dateien');
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 0);
  return el;
}

/** @param {(target: EventTarget, type: string, handler: Function) => void} on registriert mit Aufräumen */
export function bindRohDrag(vb, on) {
  on(vb.root, 'dragstart', (e) => {
    const li = e.target.closest?.('[data-vb-roh-drag]');
    if (!li || !e.dataTransfer) return;
    const id = li.dataset.vbRohDrag;
    // Eine markierte Zeile nimmt alle markierten mit
    const ids = vb.rohAuswahl.has(id) ? [...vb.rohAuswahl] : [id];
    vb._rohDrag = ids;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(ROH_DRAG_TYPE, JSON.stringify(ids));
    if (ids.length > 1) e.dataTransfer.setDragImage(dragGhost(ids.length), 12, 12);
    vb.root.classList.add('is-roh-dragging');
  });
  on(vb.root, 'dragend', () => {
    vb._rohDrag = null;
    vb.root.classList.remove('is-roh-dragging');
    zielLoeschen(vb);
  });
  on(vb.root, 'dragover', (e) => {
    if (!istRohDrag(vb, e)) return;
    const ziel = zielVon(vb, e.target);
    if (!ziel) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!ziel.li.classList.contains('is-roh-drop')) {
      zielLoeschen(vb);
      ziel.li.classList.add('is-roh-drop');
    }
  });
  on(vb.root, 'dragleave', (e) => {
    const li = e.target.closest?.('.is-roh-drop');
    if (li && !li.contains(e.relatedTarget)) li.classList.remove('is-roh-drop');
  });
  on(vb.root, 'drop', (e) => {
    if (!istRohDrag(vb, e)) return;
    const ziel = zielVon(vb, e.target);
    zielLoeschen(vb);
    if (!ziel) return;
    e.preventDefault();
    let ids = vb._rohDrag;
    if (!ids) {
      try { ids = JSON.parse(e.dataTransfer.getData(ROH_DRAG_TYPE) || '[]'); } catch { ids = []; }
    }
    void rohVerschieben(vb, ids, { videoId: ziel.videoId, version: ziel.version });
  });
}
