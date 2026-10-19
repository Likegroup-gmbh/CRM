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
  el.querySelector('#ed-zurueck')?.addEventListener('click', () => {
    window.moduleRegistry?.navigateTo('/skripte');
  });
  this.bindShareButton(el);
  this.bindPdfButton(el);
  this.bindAnschreibenButton(el);
  this.bindFreigebenButton(el);
  this.bindLoeschenButton(el);
};

SkriptEditorView.prototype.docHeadActions = function() {
  return docHeadActionsHtml({
    kannTeilen: this.kannTeilen,
    kannAnschreiben: this.kannAnschreiben,
    kannPdf: Boolean(this.skript?.id),
    kannZurueck: window.guestShare?.entityType === 'skript_paket',
    kannFreigeben: this.kannFreigeben,
    kannLoeschen: this.kannLoeschen,
    status: this.skript?.status || '',
    verknuepfungenHtml: this.renderVerknuepfungenHtml()
  });
};

// Gleicher Pfad wie das Aktionsmenü (Dialog, Toasts, entityUpdated); die
// Rückkehr zur Herkunft macht der entityUpdated-Listener in bindEvents.
SkriptEditorView.prototype.bindLoeschenButton = function(el) {
  el.querySelector('#ed-loeschen')?.addEventListener('click', async () => {
    if (!this.kannLoeschen) return;
    const { handleDelete } = await import('../../../core/actions/actionDelete.js');
    await handleDelete(this.skript.id, 'skripte');
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
    const creator = konzeptCreatorFromSkript(this.skript);
    window.skriptPaketDrawer?.open({
      kampagneId: this.skript.kampagne_id,
      kampagneName: this.skript.kampagne?.kampagnenname || this.skript.kampagne?.eigener_name || '',
      creatorId: creator?.id || null
    });
  });
};

SkriptEditorView.prototype.bindPdfButton = function(el) {
  el.querySelector('#ed-pdf')?.addEventListener('click', () => this.downloadPdf());
};

SkriptEditorView.prototype.downloadPdf = async function() {
  if (!this.skript?.id) return;
  const { downloadSkriptePdf, sanitizeSkriptFilename } = await import('../skriptPdfDownload.js');
  try {
    await downloadSkriptePdf([this.skript], {
      dateiname: sanitizeSkriptFilename(this.skript.titel),
      verknuepfungenNachId: new Map([[this.skript.id, this.verknuepfungen || []]])
    });
  } catch (err) {
    window.toastSystem?.error(err.message || 'PDF konnte nicht erstellt werden.');
  }
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

/** Generator-Vorgaben bleiben intern. In der geteilten Ansicht sieht der Gast sie nicht. */
SkriptEditorView.prototype.vorgabenFuerAnsicht = function() {
  if (window.isGast?.()) return '';
  return vorgabenPanelHtml(this.skript, { kannPersonaSetzen: !this.isReadonly });
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
      vorgabenPanelHtml: this.vorgabenFuerAnsicht()
    });
    el.querySelectorAll('[data-aufbau-flag]').forEach((toggle) => {
      toggle.addEventListener('change', () => this.saveGeneratorFlag(toggle.dataset.aufbauFlag, toggle.checked));
    });
    this.bindPersonaWahl(el);
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
    vorgabenPanelHtml: this.vorgabenFuerAnsicht(),
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
  this.bindPersonaWahl(el);
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

SkriptEditorView.prototype.bindPersonaWahl = function(el) {
  const select = el.querySelector('[data-persona-setzen]');
  if (!select || this.isReadonly) return;
  select.addEventListener('change', async () => {
    const personaId = select.value;
    if (!personaId || !this.skript?.id) return;
    select.disabled = true;
    try {
      await skripteService.setzeSkriptPersona(this.skript, personaId);
      const fresh = await skripteService.loadSkript(this.skript.id);
      if (fresh) {
        this.skript = fresh;
        this.upsertSkriptInListe?.(fresh);
      }
      this.renderDoc();
      window.toastSystem?.success('Persona gesetzt');
    } catch (err) {
      select.disabled = false;
      window.toastSystem?.error(err.message);
    }
  });
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
