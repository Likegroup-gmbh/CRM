// SkriptEditorVersionen.js
// Versions-Verwaltung im Editor: aktive Version bestimmen, Auswahl-Dropdown,
// Wechsel auf einen aelteren Snapshot.

import { skripteService } from '../SkripteService.js';
import { escapeHtml } from '../SkripteUtils.js';
import { openFloatingMenu } from '../../../core/components/FloatingMenu.js';

function versionKey(x) {
  return `${x.version_nr}.${x.sub_nr || 0}`;
}

export class SkriptEditorVersionen {
  constructor(view) {
    this.view = view;
  }

  /** Aktive Version aus dem Skript-Merker bestimmen, Fallback: neueste Version. */
  setState(versionen) {
    const v = this.view;
    v.versionen = versionen || [];
    if (!v.versionen.length) {
      v.aktiveVersion = { version_nr: 1, sub_nr: 0 };
      return;
    }
    const gemerkt = v.skript?.aktive_version_nr
      ? v.versionen.find((x) => x.version_nr === v.skript.aktive_version_nr
        && (x.sub_nr || 0) === (v.skript.aktive_sub_nr || 0))
      : null;
    const aktiv = gemerkt || v.versionen[v.versionen.length - 1];
    v.aktiveVersion = { version_nr: aktiv.version_nr, sub_nr: aktiv.sub_nr || 0 };
  }

  /** Version-Trigger rechts vom Feedback-Button im Doc-Kopf. */
  renderSelect() {
    const v = this.view;
    const wrap = document.getElementById('ed-version-wrap');
    if (!wrap) return;
    if (v.neuModus || !v.skript || !v.versionen.length) {
      wrap.innerHTML = '';
      this.closeMenu();
      return;
    }

    const aktivKey = versionKey(v.aktiveVersion);
    const aktiv = v.versionen.find((x) => versionKey(x) === aktivKey) || v.versionen[v.versionen.length - 1];
    const triggerLabel = `${skripteService.versionLabel(aktiv)}${
      aktiv.aenderung_beschreibung ? ` · ${escapeHtml(aktiv.aenderung_beschreibung)}` : ''
    }`;
    wrap.innerHTML = `
      <button type="button" id="ed-version" class="skripte-editor-version-select"
        aria-haspopup="menu" aria-expanded="false"
        title="Version auswählen – der gewählte Stand wird in den Editor geladen">
        ${triggerLabel}
      </button>
    `;
    const btn = wrap.querySelector('#ed-version');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMenu(btn);
    });
  }

  closeMenu() {
    const menu = document.getElementById('ed-vermenu');
    if (menu) menu.hidden = true;
    document.getElementById('ed-version')?.setAttribute('aria-expanded', 'false');
    this._unbindDismiss();
  }

  toggleMenu(trigger) {
    const v = this.view;
    const menu = document.getElementById('ed-vermenu');
    if (!menu || !trigger) return;

    if (!menu.hidden) {
      this.closeMenu();
      return;
    }

    for (const id of ['ed-selmenu', 'ed-modmenu']) {
      const other = document.getElementById(id);
      if (other) other.hidden = true;
    }

    const aktivKey = versionKey(v.aktiveVersion);
    openFloatingMenu({
      el: menu,
      anchor: trigger,
      wrap: v.container?.querySelector('.skripte-editor'),
      layout: 'icon-label-sub',
      items: v.versionen.map((x) => ({
        id: versionKey(x),
        label: skripteService.versionLabel(x),
        subtext: x.aenderung_beschreibung || '',
        active: versionKey(x) === aktivKey
      })),
      onSelect: (id) => {
        this.closeMenu();
        this.onChange(id);
      }
    });
    trigger.setAttribute('aria-expanded', 'true');
    this._bindDismiss();
  }

  _bindDismiss() {
    this._unbindDismiss();
    this._onDismissKey = (e) => {
      if (e.key === 'Escape') this.closeMenu();
    };
    document.addEventListener('keydown', this._onDismissKey);
  }

  _unbindDismiss() {
    if (!this._onDismissKey) return;
    document.removeEventListener('keydown', this._onDismissKey);
    this._onDismissKey = null;
  }

  /** Gewaehlten Versions-Snapshot in die Arbeitskopie laden. */
  async onChange(key) {
    const v = this.view;
    const [nr, sub] = key.split('.').map(Number);
    if (nr === v.aktiveVersion.version_nr && sub === (v.aktiveVersion.sub_nr || 0)) return;
    const version = v.versionen.find((x) => x.version_nr === nr && (x.sub_nr || 0) === sub);
    if (!version) return;

    try {
      await v.inlineEdit.flush();
      await skripteService.wechsleVersion(v.skript.id, version);
      Object.assign(v.skript, {
        titel: version.titel,
        hook: version.hook,
        hauptteil: version.hauptteil,
        cta: version.cta,
        hook_visuell: version.hook_visuell ?? null,
        hauptteil_visuell: version.hauptteil_visuell ?? null,
        cta_visuell: version.cta_visuell ?? null,
        inhalt_md: version.inhalt_md ?? null,
        aktive_version_nr: nr,
        aktive_sub_nr: sub
      });
      v.aktiveVersion = { version_nr: nr, sub_nr: sub };
      v.clearPending();
      v.renderDoc();
      v.renderChat();
      this.renderSelect();
      window.toastSystem?.success(`${skripteService.versionLabel(version)} geladen – Änderungen setzen hier auf`);
    } catch (err) {
      window.toastSystem?.error(err.message);
      this.renderSelect();
    }
  }
}
