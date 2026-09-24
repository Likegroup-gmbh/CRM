// SkriptEditorDokument.js
// Mitte: Skript-Dokument, Kopf-Aktionen und Kooperation (Prototype-Mixin).

import { skripteService } from '../SkripteService.js';
import { PLACEHOLDER_DEFAULT, PLACEHOLDER_FRAGEN } from './skriptEditorKonstanten.js';
import {
  fragenModusHtml, skriptDocHtml, docHeadActionsHtml, vorgabenPanelHtml,
  verknuepfungenHtml, konzeptCreatorFromSkript
} from './SkriptEditorDocRenderer.js';
import { SkriptKooperationDrawer } from '../SkriptKooperationDrawer.js';
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
    el.querySelector('#ed-fragen-gen')?.addEventListener('click', () => this.startGenerationAusFragen());
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

SkriptEditorView.prototype.renderVerknuepfungenHtml = function() {
  return verknuepfungenHtml({
    verknuepfungen: this.verknuepfungen,
    konzeptCreator: konzeptCreatorFromSkript(this.skript),
    kannZuweisen: this.kannZuweisen
  });
};

SkriptEditorView.prototype.bindVerknuepfungen = function(el) {
  el.querySelector('#ed-skript-zuweisen')?.addEventListener('click', () => this.openKooperationDrawer());
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
    }
  });
};
