// CastingDetailLinks.js
// Creator anlegen, Videoidee verknuepfen oder anlegen, Konzept-Picker
// (Prototype-Mixin von CreatorAuswahlDetail)

import { creatorAuswahlService } from './CreatorAuswahlService.js';
import { strategieService } from '../strategie/StrategieService.js';
import { escapeAttr } from '../../core/VideoUploadUtils.js';
import { StrategieVideoideePickerDrawer } from '../strategie/StrategieVideoideePickerDrawer.js';
import {
  castingUmsetzungGate,
  CASTING_UMSETZUNG_GATE_ERROR,
  CASTING_CREATOR_PFLICHT_ERROR
} from './sourcingStatusOptions.js';
import { ensureCastingEintragHatCreator } from './ensureCastingEintragHatCreator.js';

/**
 * Stammdaten anlegen oder per Instagram-Treffer verknuepfen.
 * Nur bei Kunden-Prio plus Zusage/Gebucht und fehlender creator_id.
 */
export async function handleCreateCreator(itemId) {
  const item = this.items.find(i => i.id === itemId);
  if (!item) return;

  if (!castingUmsetzungGate(item)) {
    window.toastSystem?.show(CASTING_UMSETZUNG_GATE_ERROR, 'warning');
    return;
  }
  if (item.creator_id) return;

  try {
    await ensureCastingEintragHatCreator(item);
    this.rerenderTable();
  } catch (error) {
    if (error?.cancelled) return;
    console.error('Fehler beim Anlegen des Creators:', error);
    window.toastSystem?.show(error.message || 'Fehler beim Anlegen', 'error');
  }
}

/**
 * Bestehende Videoidee zuordnen. Braucht Umsetzungsgate und creator_id.
 */
export async function handleConnectVideoidee(itemId) {
  const item = this.items.find(i => i.id === itemId);
  if (!item) return;

  if (!castingUmsetzungGate(item)) {
    window.toastSystem?.show(CASTING_UMSETZUNG_GATE_ERROR, 'warning');
    return;
  }
  if (!item.creator_id) {
    window.toastSystem?.show(CASTING_CREATOR_PFLICHT_ERROR, 'warning');
    return;
  }

  if (!this.liste?.strategie_id) {
    const linked = await this.showKonzeptPicker();
    if (!linked || !this.liste?.strategie_id) return;
  }

  try {
    const drawer = new StrategieVideoideePickerDrawer();
    await drawer.open({
      eintrag: item,
      strategieId: this.liste.strategie_id,
      onSuccess: () => this.rerenderTable()
    });
  } catch (error) {
    if (error?.cancelled) return;
    console.error('Fehler beim Verbinden mit der Videoidee:', error);
    window.toastSystem?.show(error.message || 'Fehler beim Verbinden', 'error');
  }
}

/**
 * Konzept verknuepfen oder loesen (1:1-Paar, ADR 0010). Spiegelbild zu
 * StrategieDetail.handleCastingLink. Picker zeigt nur unverknuepfte
 * Konzepte derselben Kampagne mit gleichem Briefing. Loesen blockt,
 * sobald eine Videoidee einen Casting-Eintrag traegt (Service-Gate).
 */
export async function handleKonzeptLink() {
  if (this.liste?.strategie_id) {
    const result = await window.confirmationModal?.open({
      title: 'Konzept-Verknüpfung lösen?',
      message: 'Die Verknüpfung zum Konzept wird gelöst. Videoideen behalten ihre Zuordnung nicht.',
      confirmText: 'Lösen',
      cancelText: 'Abbrechen',
      danger: true
    });
    if (!result?.confirmed) return;

    try {
      await strategieService.unlinkCasting(this.liste.strategie_id);
      window.toastSystem?.show('Konzept-Verknüpfung gelöst', 'success');
      this.liste = await creatorAuswahlService.getListeById(this.listeId);
      await this.render();
      this.bindEvents();
    } catch (error) {
      console.error('Fehler beim Lösen der Konzept-Verknüpfung:', error);
      window.toastSystem?.show(error.message || 'Fehler beim Lösen', 'error');
    }
    return;
  }

  const linked = await this.showKonzeptPicker();
  if (linked) {
    await this.render();
    this.bindEvents();
  }
}

/**
 * Picker fuer unverknuepfte Konzepte derselben Kampagne + Briefing.
 * @returns {Promise<boolean>} true nach erfolgreichem Link, sonst false
 *   (Abbruch, kein Kandidat, Ladefehler).
 */
export async function showKonzeptPicker() {
  const { data: konzepte, error } = await window.supabase
    .from('strategie')
    .select('id, name, kampagne_id, briefing_id, creator_auswahl_id')
    .eq('kampagne_id', this.liste?.kampagne_id)
    .is('creator_auswahl_id', null)
    .order('name');

  if (error) {
    window.toastSystem?.show('Fehler beim Laden der Konzepte', 'error');
    return false;
  }

  const passend = (konzepte || []).filter(s =>
    (s.briefing_id || null) === (this.liste?.briefing_id || null)
  );

  if (passend.length === 0) {
    window.toastSystem?.show('Kein unverknüpftes Konzept mit gleichem Briefing in dieser Kampagne', 'info');
    return false;
  }

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = 'sourcing-konzept-picker-overlay';

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = 'sourcing-konzept-picker';

    panel.innerHTML = `
    <div class="drawer-header">
      <div>
        <span class="drawer-title">Konzept verknüpfen</span>
        <p class="drawer-subtitle">Nur unverknüpfte Konzepte dieser Kampagne mit gleichem Briefing</p>
      </div>
      <div>
        <button class="drawer-close-btn" type="button" aria-label="Schließen">&times;</button>
      </div>
    </div>
    <div class="drawer-body">
      <div class="form-field">
        <label for="sourcing-konzept-select">Konzept</label>
        <select id="sourcing-konzept-select" class="form-input">
          <option value="">– Konzept wählen –</option>
          ${passend.map(s => `<option value="${s.id}">${escapeAttr(s.name || 'Ohne Namen')}</option>`).join('')}
        </select>
      </div>
      <div class="drawer-footer">
        <button type="button" class="mdc-btn mdc-btn--cancel" data-action="close">
          <span class="mdc-btn__label">Abbrechen</span>
        </button>
        <button type="button" id="btn-konzept-link-confirm" class="mdc-btn mdc-btn--create" disabled>
          <span class="mdc-btn__label">Verknüpfen</span>
        </button>
      </div>
    </div>
  `;

    let settled = false;
    const finish = (linked) => {
      if (settled) return;
      settled = true;
      panel.classList.remove('show');
      overlay.classList.remove('active');
      setTimeout(() => { overlay.remove(); panel.remove(); }, 250);
      resolve(!!linked);
    };

    overlay.addEventListener('click', () => finish(false));
    panel.querySelector('.drawer-close-btn').addEventListener('click', () => finish(false));
    panel.querySelector('[data-action="close"]').addEventListener('click', () => finish(false));

    const select = panel.querySelector('#sourcing-konzept-select');
    const confirmBtn = panel.querySelector('#btn-konzept-link-confirm');
    select.addEventListener('change', () => { confirmBtn.disabled = !select.value; });

    confirmBtn.addEventListener('click', async () => {
      if (!select.value) return;
      confirmBtn.disabled = true;
      try {
        await strategieService.linkCasting(select.value, this.listeId);
        window.toastSystem?.show('Konzept verknüpft', 'success');
        this.liste = await creatorAuswahlService.getListeById(this.listeId);
        finish(true);
      } catch (error) {
        console.error('Fehler beim Verknüpfen:', error);
        window.toastSystem?.show(error.message || 'Fehler beim Verknüpfen', 'error');
        confirmBtn.disabled = false;
      }
    });

    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    requestAnimationFrame(() => {
      overlay.classList.add('active');
      panel.classList.add('show');
    });
  });
}

/**
 * Creator-zuerst: legt eine Videoidee im verknuepften Konzept an, schon
 * diesem Casting-Eintrag zugeordnet. Gate: Prio plus Zusage/Gebucht plus creator_id.
 * Fehlt das Paar, oeffnet der Picker zuerst denselben Drawer wie „Konzept verknüpfen“.
 */
export async function handleCreateVideoidee(itemId) {
  const item = this.items.find(i => i.id === itemId);
  if (!item) return;

  if (!castingUmsetzungGate(item)) {
    window.toastSystem?.show(CASTING_UMSETZUNG_GATE_ERROR, 'warning');
    return;
  }
  if (!item.creator_id) {
    window.toastSystem?.show(CASTING_CREATOR_PFLICHT_ERROR, 'warning');
    return;
  }

  if (!this.liste?.strategie_id) {
    const linked = await this.showKonzeptPicker();
    if (!linked || !this.liste?.strategie_id) return;
  }

  try {
    const existing = await strategieService.getStrategieItems(this.liste.strategie_id);
    const created = await strategieService.createStrategieItem({
      strategie_id: this.liste.strategie_id,
      video_link: null,
      plattform: null,
      sortierung: existing.length,
      teilbereich: null,
      beschreibung: null,
      beschreibung_quelle: null,
      verarbeitung_status: null,
      creator_auswahl_item_id: item.id
    });

    window.toastSystem?.show('Videoidee angelegt', 'success');
    window.dispatchEvent(new CustomEvent('strategieItemCreated', {
      detail: { strategieId: this.liste.strategie_id }
    }));
    window.navigateTo(`/konzepte/${this.liste.strategie_id}`);
    return created;
  } catch (error) {
    console.error('Fehler beim Anlegen der Videoidee:', error);
    window.toastSystem?.show(error.message || 'Fehler beim Anlegen der Videoidee', 'error');
  }
}

export const castingDetailLinksMethods = {
  handleCreateCreator,
  handleConnectVideoidee,
  handleKonzeptLink,
  showKonzeptPicker,
  handleCreateVideoidee
};
