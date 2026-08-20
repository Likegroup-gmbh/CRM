// SkriptEditorVersionen.js
// Versions-Verwaltung im Editor: aktive Version bestimmen, Auswahl-Dropdown,
// Wechsel auf einen aelteren Snapshot.

import { skripteService } from '../SkripteService.js';
import { escapeHtml } from '../SkripteUtils.js';

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

  /** Version-Dropdown rechts vom Feedback-Button im Doc-Kopf. */
  renderSelect() {
    const v = this.view;
    const wrap = document.getElementById('ed-version-wrap');
    if (!wrap) return;
    if (v.neuModus || !v.skript || !v.versionen.length) {
      wrap.innerHTML = '';
      return;
    }

    const key = (x) => `${x.version_nr}.${x.sub_nr || 0}`;
    const aktivKey = `${v.aktiveVersion.version_nr}.${v.aktiveVersion.sub_nr || 0}`;
    wrap.innerHTML = `
      <select id="ed-version" class="skripte-editor-version-select"
        title="Version auswählen – der gewählte Stand wird in den Editor geladen">
        ${v.versionen.map((x) => `
          <option value="${key(x)}" ${key(x) === aktivKey ? 'selected' : ''}>
            ${skripteService.versionLabel(x)}${x.aenderung_beschreibung ? ` · ${escapeHtml(x.aenderung_beschreibung)}` : ''}
          </option>
        `).join('')}
      </select>
    `;
    wrap.querySelector('#ed-version').addEventListener('change', (e) => this.onChange(e.target.value));
  }

  /** Gewaehlten Versions-Snapshot in die Arbeitskopie laden. */
  async onChange(versionKey) {
    const v = this.view;
    const [nr, sub] = versionKey.split('.').map(Number);
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
