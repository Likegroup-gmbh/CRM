// SkriptEditorDokument.js
// Mitte: Skript-Dokument, Kopf-Aktionen und Kooperation (Prototype-Mixin).

import { skripteService } from '../SkripteService.js';
import { PLACEHOLDER_DEFAULT, PLACEHOLDER_FRAGEN } from './skriptEditorKonstanten.js';
import {
  fragenModusHtml, skriptDocHtml, docHeadActionsHtml, vorgabenPanelHtml,
  verknuepfungenHtml, konzeptCreatorFromSkript
} from './SkriptEditorDocRenderer.js';
import { SkriptKooperationDrawer } from '../SkriptKooperationDrawer.js';
import { openCreatorTausch } from '../../creator-tausch/creatorTauschUi.js';
import { findeAlterEintragFuerSkript } from '../../creator-tausch/CreatorTauschService.js';
import { quittiereTausch } from './skriptTauschBanner.js';
import { SkriptEditorView } from './SkriptEditorViewCore.js';

SkriptEditorView.prototype.bindDocHeadActions = function(el) {
  this.bindShareButton(el);
  this.bindAnschreibenButton(el);
  this.bindFreigebenButton(el);
};

SkriptEditorView.prototype.docHeadActions = function() {
  return docHeadActionsHtml({
    kannTeilen: this.kannTeilen,
    kannFreigeben: this.kannFreigeben,
    status: this.skript?.status || '',
    verknuepfungenHtml: this.renderVerknuepfungenHtml()
  });
};

SkriptEditorView.prototype.bindFreigebenButton = function(el) {
  el.querySelector('#ed-freigeben')?.addEventListener('click', () => this.freigeben());
};

SkriptEditorView.prototype.freigeben = async function() {
  if (!this.kannFreigeben || !this.skript?.id) return;
  const btn = document.getElementById('ed-freigeben');
  if (btn) btn.disabled = true;
  try {
    await skripteService.freigebenSkriptGast(this.skript.id);
    this.skript.status = 'freigegeben';
    this.renderDoc();
    window.toastSystem?.show('Skript freigegeben', 'success');
  } catch (error) {
    if (btn) btn.disabled = false;
    window.toastSystem?.show(error.message || 'Freigabe fehlgeschlagen', 'error');
  }
};

SkriptEditorView.prototype.bindShareButton = function(el) {
  el.querySelector('#ed-share')?.addEventListener('click', () => {
    if (!this.kannTeilen) return;
    window.shareListDialog?.open({
      entityType: 'skript',
      entityId: this.skript.id,
      entityName: this.skript.titel || 'Skript',
      kampagneId: this.skript.kampagne_id || null
    });
  });
};

SkriptEditorView.prototype.bindAnschreibenButton = function(el) {
  el.querySelector('#ed-anschreiben')?.addEventListener('click', () => {
    if (!this.kannTeilen) return;
    this.openSkriptAnschreiben();
  });
};

SkriptEditorView.prototype.openSkriptAnschreiben = async function() {
  const { openAnschreiben } = await import('../../../core/anschreiben/openAnschreiben.js');
  await openAnschreiben({
    dokumentTyp: 'skript',
    dokumentId: this.skript.id,
    skript: this.skript,
  });
};

SkriptEditorView.prototype.warmSkriptAnschreiben = function() {
  if (!this.kannTeilen) return;
  import('../../../core/anschreiben/openAnschreiben.js').then(({ warmAnschreiben }) => {
    warmAnschreiben({
      dokumentTyp: 'skript',
      dokumentId: this.skript.id,
      skript: this.skript,
    }).catch((err) => console.error('Anschreiben vorwärmen fehlgeschlagen:', err));
  });
};

SkriptEditorView.prototype.renderDoc = function() {
  const el = document.getElementById('ed-doc');
  if (!el) return;

  this.inlineEdit.detach();

  // Rueckfragen-Phase: Vorgaben + Hinweis statt (noch leerem) Skript-Inhalt
  if (this.istFragenModus()) {
    el.innerHTML = fragenModusHtml({
      skript: this.skript,
      genStatus: this.genStatus,
      docHeadActionsHtml: this.docHeadActions(),
      vorgabenPanelHtml: vorgabenPanelHtml(this.skript)
    });
    el.querySelectorAll('[data-aufbau-flag]').forEach((toggle) => {
      toggle.addEventListener('change', () => this.saveGeneratorFlag(toggle.dataset.aufbauFlag, toggle.checked));
    });
    this.bindDocHeadActions(el);
    this.bindVerknuepfungen(el);
    const input = document.getElementById('ed-input');
    if (input && !input.disabled) input.placeholder = PLACEHOLDER_FRAGEN;
    this.renderVersionSelect();
    return;
  }

  const inputEl = document.getElementById('ed-input');
  if (inputEl && inputEl.placeholder === PLACEHOLDER_FRAGEN) inputEl.placeholder = PLACEHOLDER_DEFAULT;

  el.innerHTML = skriptDocHtml({
    skript: this.skript,
    messages: this.messages,
    isReadonly: this.isReadonly,
    docHeadActionsHtml: this.docHeadActions(),
    vorgabenPanelHtml: vorgabenPanelHtml(this.skript),
    docTab: this.docTab || 'skript',
    zeigeHookVarianten: this.kannAiAktionen
  });
  el.querySelectorAll('[data-editor-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      this.docTab = btn.dataset.editorTab;
      this.renderDoc();
    });
  });
  this.bindDocHeadActions(el);
  el.querySelectorAll('.skripte-editor-visual-btn').forEach((btn) => {
    btn.addEventListener('click', () => this.openVisuellModusMenu(btn));
  });
  this.bindVerknuepfungen(el);
  this.inlineEdit.attach(el, { readonly: !this.kannDokumentEditieren });
  this.renderVersionSelect();
};

/**
 * Aufbau-Toggle in der Rueckfragen-Phase: Flag sofort lokal mitziehen
 * (startGenerationAusFragen liest den Payload von hier) und in
 * prompt_kontext.generator_payload persistieren, damit ein Reload den
 * Stand haelt.
 */
SkriptEditorView.prototype.saveGeneratorFlag = async function(flag, wert) {
  if (!this.skript?.id) return;
  const pk = this.skript.prompt_kontext || {};
  this.skript.prompt_kontext = {
    ...pk,
    generator_payload: { ...(pk.generator_payload || {}), [flag]: wert }
  };
  try {
    await skripteService.updateGeneratorFlags(this.skript.id, { [flag]: wert });
  } catch (err) {
    window.toastSystem?.error(err.message);
  }
};

SkriptEditorView.prototype.renderVerknuepfungenHtml = function() {
  return verknuepfungenHtml({
    verknuepfungen: this.verknuepfungen,
    konzeptCreator: konzeptCreatorFromSkript(this.skript),
    kannZuweisen: this.kannZuweisen
  });
};

SkriptEditorView.prototype.bindVerknuepfungen = function(el) {
  el.querySelector('#ed-skript-zuweisen')?.addEventListener('click', () => this.openKooperationDrawer());
  el.querySelector('#ed-creator-tauschen')?.addEventListener('click', () => this.openCreatorTauschFuerSkript());
  el.querySelector('#ed-tausch-quittieren')?.addEventListener('click', () => quittiereTausch(this));
};

/** Creator tauschen: alten Casting-Eintrag aus dem Skript aufloesen, dann derselbe Dialog wie im Casting. */
SkriptEditorView.prototype.openCreatorTauschFuerSkript = async function() {
  if (!this.kannZuweisen || !this.skript?.id) return;
  try {
    const alterItemId = await findeAlterEintragFuerSkript(this.skript, this.verknuepfungen);
    if (!alterItemId) {
      window.toastSystem?.show('Zu diesem Skript gibt es keinen Casting-Eintrag (Altbestand). Tausch nicht möglich.', 'info');
      return;
    }
    await openCreatorTausch({
      alterItemId,
      onSuccess: async () => {
        const id = this.skript.id;
        const fresh = await skripteService.loadSkript(id);
        if (fresh) this.upsertSkriptInListe(fresh);
        this.skript = null;
        await this.switchSkript(id);
      }
    });
  } catch (err) {
    window.toastSystem?.error(err.message);
  }
};

SkriptEditorView.prototype.reloadVerknuepfungen = async function() {
  if (!this.skript?.id) {
    this.verknuepfungen = [];
    return;
  }
  try {
    this.verknuepfungen = await skripteService.loadSkriptVerknuepfungen(this.skript.id);
  } catch (err) {
    console.warn('Skript-Verknüpfungen konnten nicht geladen werden:', err);
    this.verknuepfungen = [];
  }
};

SkriptEditorView.prototype.openKooperationDrawer = function() {
  if (!this.kannZuweisen || !this.skript) return;
  if (!this._koopDrawer) this._koopDrawer = new SkriptKooperationDrawer();
  this._koopDrawer.open({
    skript: this.skript,
    verknuepfungen: this.verknuepfungen,
    onSuccess: async () => {
      await this.reloadVerknuepfungen();
      this.renderDoc();
      this.renderListe();
    }
  });
};
