// CastingDetailFreigabe.js
// Kooperationsfreigabe in der Casting-Tabelle (Prototype-Mixin von CreatorAuswahlDetail).
// Ein Klick legt die Kooperation der Linie an; der Button schaltet in-place um,
// auch wenn Status oder Kundenfeedback per Realtime von der anderen Seite kommen.

import { creatorAuswahlService } from './CreatorAuswahlService.js';
import { buildSourcingStatusUpdates } from './sourcingStatusOptions.js';
import {
  animateFreigabeApprove,
  animateFreigabeLock,
  animateFreigabeUnlock,
  createSerienDaempfung,
  initFreigabeButton,
  revertFreigabeApprove
} from '../../core/animation/freigabePuls.js';
import { FREIGABE_LABEL, hatProduktionsKontext, istFreigabeBereit } from './castingFreigabeLogik.js';
import { findeFreigabeButton, setzeFreigabeZustand, syncFreigabeButtonInPlace } from './castingFreigabeZelle.js';
import { ladeFreigegebeneCreatorIds, legeKooperationAn, sichereCreatorOhneDrawer } from './castingFreigabeAnlage.js';

export function _canCreateKooperation() {
  return !this.isKunde && (window.permissionSystem?.can('kooperation', 'create') ?? false);
}

export async function _ladeFreigegebeneCreatorIds() {
  this.freigegebeneCreatorIds = new Set();
  if (!this._canCreateKooperation()) return;
  try {
    this.freigegebeneCreatorIds = await ladeFreigegebeneCreatorIds(window.supabase, this.liste);
  } catch (error) {
    console.warn('Freigegebene Creator konnten nicht geladen werden:', error);
  }
}

export function bindFreigabeEvents() {
  const root = this._getRoot();
  if (!root || !this._canCreateKooperation()) return;
  this._freigabeDaempfung ||= createSerienDaempfung();

  const onClick = (e) => {
    const btn = e.target.closest('[data-freigabe-btn]');
    if (!btn || !root.contains(btn)) return;
    e.preventDefault();
    e.stopPropagation();
    this.handleFreigabeClick(btn.dataset.itemId, btn, e);
  };
  root.addEventListener('click', onClick);
  this._boundEventListeners.add(() => root.removeEventListener('click', onClick));
}

/** Button einer Zeile aus dem aktuellen Item ableiten; animiert nur echte Uebergaenge. */
export function syncFreigabe(itemId) {
  if (this._freigabeLaeuft?.has(itemId)) return;
  const item = this.items.find(i => i.id === itemId);
  if (!item) return;
  syncFreigabeButtonInPlace(this._getRoot(), item, {
    freigegebeneCreatorIds: this.freigegebeneCreatorIds,
    kontextOk: hatProduktionsKontext(this.liste)
  });
}

/**
 * Nach dem Neuaufbau einer Zeile: die alte Freigabe-Zelle zuruecksetzen, damit
 * der Buegel vom alten Zustand aus animiert statt hart zu springen.
 */
export function uebernimmFreigabeZelle(rowEl, alteZelle, itemId) {
  const neueZelle = rowEl?.querySelector('td.cp-col-freigabe');
  if (!alteZelle || !neueZelle || alteZelle === neueZelle) return;
  neueZelle.replaceWith(alteZelle);
  this.syncFreigabe(itemId);
}

/** Nach einem Tabellen-Render steht der Button schon im Endzustand; der Uebergang wird nachgespielt. */
export function animiereFreigabeNachRender(itemId, warBereit) {
  const item = this.items.find(i => i.id === itemId);
  const btn = findeFreigabeButton(this._getRoot(), itemId);
  if (!item || !btn || warBereit === istFreigabeBereit(item)) return;
  if (btn.dataset.state === 'ready') {
    animateFreigabeUnlock(btn);
  } else if (btn.dataset.state === 'locked') {
    initFreigabeButton(btn, 'ready');
    animateFreigabeLock(btn);
  }
}

function zeigeFehler(detail, itemId, btn, error) {
  const aktuell = findeFreigabeButton(detail._getRoot(), itemId) || btn;
  delete aktuell.dataset.busy;
  revertFreigabeApprove(aktuell);
  setzeFreigabeZustand(aktuell, 'ready');
  initFreigabeButton(aktuell, 'ready');
  console.error('Kooperationsfreigabe fehlgeschlagen:', error);
  window.toastSystem?.show(error?.message || 'Kooperation konnte nicht angelegt werden', 'error');
}

/**
 * Klick auf Freigeben: sofort gesperrt und abgehakt, Animation laeuft, danach
 * (nicht davor) Creator sicherstellen und Kooperation anlegen. Fehler setzt zurueck.
 */
export async function handleFreigabeClick(itemId, btn, event) {
  const item = this.items.find(i => i.id === itemId);
  this._freigabeLaeuft ||= new Set();
  if (!item || btn.dataset.state !== 'ready' || this._freigabeLaeuft.has(itemId)) return;
  if (!istFreigabeBereit(item) || !hatProduktionsKontext(this.liste)) return;

  this._freigabeLaeuft.add(itemId);
  btn.dataset.busy = '1';
  setzeFreigabeZustand(btn, 'done', { mitLabel: false });
  animateFreigabeApprove(btn, {
    event,
    ruhig: this._freigabeDaempfung?.naechsteIstRuhig() ?? false,
    label: FREIGABE_LABEL.fertig
  });

  let koop;
  let creatorNeu = false;
  try {
    const creator = await sichereCreatorOhneDrawer(item);
    creatorNeu = creator.neu;
    koop = await legeKooperationAn(this.liste, creator.creatorId);
    (this.freigegebeneCreatorIds ||= new Set()).add(creator.creatorId);
  } catch (error) {
    this._freigabeLaeuft.delete(itemId);
    zeigeFehler(this, itemId, btn, error);
    return;
  }

  this._freigabeLaeuft.delete(itemId);
  const aktuell = findeFreigabeButton(this._getRoot(), itemId);
  if (aktuell) delete aktuell.dataset.busy;

  if (!koop.schonDa) {
    window.dispatchEvent(new CustomEvent('entityUpdated', {
      detail: { entity: 'kooperation', action: 'created', id: koop.id, skipListRedirect: true }
    }));
  }
  if (creatorNeu) window.toastSystem?.show('Creator aus dem Eintrag angelegt', 'success');
  if (koop.schonDa) window.toastSystem?.show('Für diesen Creator gab es in dieser Linie schon eine Kooperation', 'info');

  await this._setzeGebuchtNachFreigabe(item);
}

/** Status wird Gebucht. Die Zeile bleibt stehen, kein Umsortieren. */
export async function _setzeGebuchtNachFreigabe(item) {
  if (item.gebucht) {
    this.refreshItemRow(item.id);
    return;
  }
  const updates = buildSourcingStatusUpdates('gebucht');
  try {
    await creatorAuswahlService.updateItem(item.id, updates);
    Object.assign(item, updates);
  } catch (error) {
    console.error('Status nach Freigabe nicht gesetzt:', error);
    window.toastSystem?.show('Kooperation angelegt, Status Gebucht konnte nicht gespeichert werden', 'warning');
  }
  this.refreshItemRow(item.id);
}

export const castingDetailFreigabeMethods = {
  _canCreateKooperation,
  _ladeFreigegebeneCreatorIds,
  bindFreigabeEvents,
  syncFreigabe,
  uebernimmFreigabeZelle,
  animiereFreigabeNachRender,
  handleFreigabeClick,
  _setzeGebuchtNachFreigabe
};
