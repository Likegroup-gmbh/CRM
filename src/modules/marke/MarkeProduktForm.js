// MarkeProduktForm.js
// Eigene Seite zum Anlegen und Bearbeiten eines Produkts einer Marke.
// Routen: /marke/:markeId/produkt (anlegen), /marke/:markeId/produkt?produkt=:id (bearbeiten)
//
// Die Seite ist ein Worksheet: mittig ein Schreibdokument mit festen
// Ueberschriften und frei beschreibbaren Abschnitten (MarkeProduktDoc.js),
// rechts das Auslesen der Shop-URL samt Liky-Verlauf
// (MarkeProduktExtractPanel.js). Bilder und Varianten stehen als Tabellen
// mitten im Dokument.

import { MarkeProduktService, MAX_BILDER } from './services/MarkeProduktService.js';
import { ProduktVariantenPanel } from './MarkeProduktVarianten.js';
import { ProduktExtractPanel } from './MarkeProduktExtractPanel.js';
import { renderProduktDoc, bindProduktDoc, refreshDocHeights } from './MarkeProduktDoc.js';
import { UploaderField } from '../../core/form/fields/UploaderField.js';
import { produktConfig } from '../../core/form/config/ProduktFormConfig.js';

export class MarkeProduktForm {
  constructor() {
    this.markeId = null;
    this.produktId = null;
    this.marke = null;
    this.produkt = null;
    this.varianten = [];
    this.bilder = [];
    this.variantenPanel = null;
    this.extractPanel = null;
    this.uploader = null;
    this._abort = null;
  }

  get isEdit() {
    return !!this.produktId;
  }

  get returnRoute() {
    return `/marke/${this.markeId}?tab=produkte`;
  }

  async init(markeId) {
    this._abort?.abort();
    this._abort = new AbortController();

    this.markeId = markeId;
    this.produktId = new URLSearchParams(window.location.search).get('produkt');
    this.marke = null;
    this.produkt = null;
    this.varianten = [];
    this.bilder = [];

    try {
      const { data: marke, error } = await window.supabase
        .from('marke')
        .select('id, markenname, unternehmen_id')
        .eq('id', markeId)
        .single();
      if (error) throw error;
      this.marke = marke;

      if (this.produktId) {
        this.produkt = await MarkeProduktService.loadOne(this.produktId, markeId);
        if (!this.produkt) {
          window.toastSystem?.error?.('Produkt nicht gefunden');
          window.navigateTo(this.returnRoute);
          return;
        }
        [this.varianten, this.bilder] = await Promise.all([
          MarkeProduktService.loadVarianten(this.produktId),
          MarkeProduktService.loadBilder(this.produktId)
        ]);
      }
    } catch (err) {
      console.error('Produkt-Formular konnte nicht geladen werden:', err);
      window.ErrorHandler?.handle?.(err, 'MarkeProduktForm.init');
      window.navigateTo(this.returnRoute);
      return;
    }

    this.render();
    this.bindEvents();
  }

  render() {
    const title = this.isEdit
      ? MarkeProduktService.label(this.produkt)
      : 'Neues Produkt anlegen';

    window.setHeadline(title);

    window.breadcrumbSystem?.updateBreadcrumb([
      { label: 'Marken', url: '/marke', clickable: true },
      { label: this.marke.markenname || 'Marke', url: this.returnRoute, clickable: true },
      { label: this.isEdit ? MarkeProduktService.label(this.produkt) : 'Produkt anlegen', clickable: false }
    ]);

    const formData = this.isEdit
      ? { ...this.produkt, _isEditMode: true, _entityId: this.produkt.id }
      : null;

    window.content.innerHTML = renderProduktDoc(formData);

    const form = document.getElementById('produkt-form');
    bindProduktDoc(form, formData);

    // Setzt unter anderem setupSiteExtract auf; der eigene Submit-Handler in
    // bindEvents() ersetzt danach den generischen.
    window.formSystem.bindFormEvents('produkt', formData);

    this.mountBilderUploader(form);

    this.variantenPanel = new ProduktVariantenPanel();
    this.variantenPanel.mount(
      document.getElementById('produkt-varianten-panel'),
      this.varianten,
      this.bilder
    );

    this.extractPanel = new ProduktExtractPanel();
    this.extractPanel.mount(form);
  }

  /**
   * Der Uploader wird hier statt im FormRenderer aufgebaut, weil das Dokument
   * sein eigenes Markup rendert. Die Optionen bleiben in der Feld-Config.
   */
  mountBilderUploader(form) {
    const field = produktConfig.fields.find(f => f.name === 'bilder_files');
    const root = form?.querySelector('.uploader[data-name="bilder_files"]');
    if (!field || !root) return;

    this.uploader = new UploaderField({
      multiple: !!field.multiple,
      accept: field.accept || '*/*',
      maxFileSize: field.maxFileSize || null,
      maxFiles: field.maxFiles || null,
      sortable: !!field.sortable,
      primarySelectable: !!field.primarySelectable,
      variant: 'table'
    });
    this.uploader.mount(root);

    this.fillBilderUploader();
  }

  /** Bereits gespeicherte Kollektionsbilder in den Uploader spiegeln. */
  fillBilderUploader() {
    const uploader = this.getBilderUploader();
    if (!uploader) return;

    const kollektionsBilder = this.bilder
      .filter(b => !b.variante_id)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    uploader.setExistingFiles(kollektionsBilder.map((b, i) => ({
      id: b.id,
      name: `Produktbild ${i + 1}`,
      url: MarkeProduktService.publicUrl(b.storage_pfad)
    })));

    const haupt = kollektionsBilder.find(b => b.ist_hauptbild);
    if (haupt) uploader.primaryKey = `existing:${haupt.id}`;
    uploader.renderList();
  }

  getBilderUploader() {
    const root = document.querySelector('.uploader[data-name="bilder_files"]');
    return root?.__uploaderInstance || null;
  }

  /**
   * Nimmt die von der KI extrahierten Bilder als temporaere Eintraege in den
   * Uploader auf. Sie liegen bereits im Storage unter _temp/ und werden beim
   * Speichern verschoben - Entfernen und Sortieren laufen so ueber die
   * gleiche Mechanik wie bei gespeicherten Bildern.
   * @param {Array<{storage_pfad: string, url: string, quelle_url?: string}>} bilder
   */
  applyExtractedBilder(bilder = []) {
    const uploader = this.getBilderUploader();
    if (!uploader || !bilder.length) return;

    const frei = Math.max(0, MAX_BILDER - uploader.totalCount());
    if (!frei) return;

    const neue = bilder.slice(0, frei).map((b, i) => ({
      id: `temp:${b.storage_pfad}`,
      name: `Von der Produktseite ${i + 1}`,
      url: b.url,
      isTemporary: true,
      storagePfad: b.storage_pfad,
      quelleUrl: b.quelle_url || null
    }));

    uploader.existingFiles = [...uploader.existingFiles, ...neue];
    uploader.renderList();
  }

  applyExtractedVarianten(varianten = []) {
    if (varianten.length) this.variantenPanel?.setSuggestions(varianten);
  }

  bindEvents() {
    const form = document.getElementById('produkt-form');
    if (!form) return;

    const signal = this._abort?.signal;
    const opts = signal ? { signal } : undefined;

    // bindFormEvents setzt einen eigenen Submit-Handler - der wird hier ersetzt
    form.onsubmit = async (e) => {
      e.preventDefault();
      await this.handleSubmit();
    };

    // Abbrechen fuehrt zurueck auf den Produkte-Tab der Marke
    const cancelBtn = form.querySelector('.mdc-btn--cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => window.navigateTo(this.returnRoute), opts);
    }

    // Ergebnisse der KI-Extraktion abholen: Bilder und Varianten kommen
    // zusaetzlich zu den Textfeldern, die der ExtractReviewLayer selbst setzt.
    document.addEventListener('siteExtractApplied', (e) => {
      if (e.detail?.entity !== 'produkt') return;
      this.applyExtractedBilder(e.detail.images || []);
      this.applyExtractedVarianten(e.detail.varianten || []);
    }, opts);

    // Die uebernommenen Texte sind laenger als die leeren Felder - die
    // Abschnitte muessen danach auf ihre neue Hoehe wachsen.
    document.addEventListener('siteExtractFinished', (e) => {
      if (e.detail?.entity !== 'produkt') return;
      refreshDocHeights(form);
    }, opts);

    if (this.isEdit) {
      this.injectDeleteButton(form, opts);
    }
  }

  injectDeleteButton(form, opts) {
    const actions = form.querySelector('.form-actions');
    if (!actions || actions.querySelector('.produkt-delete-btn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mdc-btn mdc-btn--delete produkt-delete-btn';
    btn.innerHTML = `
      <span class="mdc-btn__icon" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
          <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
        </svg>
      </span>
      <span class="mdc-btn__label">Löschen</span>
    `;
    btn.addEventListener('click', () => this.handleDelete(), opts);

    actions.insertBefore(btn, actions.firstChild);
  }

  async handleSubmit() {
    const form = document.getElementById('produkt-form');
    if (!form) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    const data = window.formSystem.collectSubmitData(form);

    this.clearFieldErrors(form);
    const validation = window.validatorSystem.validateForm(data, {
      name: { type: 'text', minLength: 2, required: true }
    });
    if (!validation.isValid) {
      this.showFieldErrors(form, validation.errors);
      window.toastSystem?.error?.('Bitte Pflichtfelder ausfüllen');
      this.releaseSubmitBtn(submitBtn);
      return;
    }

    const preisFehler = this.validatePreisRange(data);
    if (preisFehler) {
      this.showFieldErrors(form, { preis_bis: preisFehler });
      window.toastSystem?.error?.(preisFehler);
      this.releaseSubmitBtn(submitBtn);
      return;
    }

    submitBtn?.classList.add('is-loading');

    try {
      let produktId = this.produktId;

      if (this.isEdit) {
        await MarkeProduktService.update(this.produktId, data);
      } else {
        const result = await MarkeProduktService.create(data, this.markeId, this.marke?.unternehmen_id);
        produktId = result.id;
      }

      await MarkeProduktService.saveVarianten(produktId, this.variantenPanel?.getVarianten() || []);
      await this.saveBilder(produktId);
      await this.saveVariantenBilder(produktId);

      window.toastSystem?.success?.(this.isEdit ? 'Produkt gespeichert' : 'Produkt angelegt');
      window.navigateTo(this.returnRoute);
    } catch (err) {
      console.error('Produkt speichern fehlgeschlagen:', err);
      window.toastSystem?.error?.('Fehler beim Speichern: ' + err.message);
      this.releaseSubmitBtn(submitBtn);
    }
  }

  validatePreisRange(data) {
    const von = MarkeProduktService.toNumber(data.preis_von);
    const bis = MarkeProduktService.toNumber(data.preis_bis);
    if (von != null && bis != null && bis < von) {
      return 'Der Preis "bis" darf nicht unter dem Preis "von" liegen';
    }
    return null;
  }

  /** Uebersetzt den Uploader-Zustand in die drei Gruppen des Service. */
  async saveBilder(produktId) {
    const uploader = this.getBilderUploader();
    if (!uploader) return;

    const behalten = uploader.getKeptExistingFiles();
    const primary = uploader.effectivePrimaryKey();

    const bestehende = [];
    const temp = [];

    behalten.forEach((f, index) => {
      const istHaupt = primary === `existing:${f.id}`;
      if (f.isTemporary) {
        temp.push({
          storage_pfad: f.storagePfad,
          quelle_url: f.quelleUrl,
          position: index,
          ist_hauptbild: istHaupt
        });
      } else {
        bestehende.push({ id: f.id, position: index, ist_hauptbild: istHaupt });
      }
    });

    // Temporaere Eintraege haben keine DB-Zeile, dürfen also nicht als
    // "geloescht" an den Service gehen - ihre Storage-Datei raeumt der Cron-Job.
    const geloeschteIds = uploader.getDeletedFileIds().filter(id => !String(id).startsWith('temp:'));

    const neue = uploader.files.map((file, i) => ({
      file,
      position: behalten.length + i,
      ist_hauptbild: primary === `new:${i}`
    }));

    await MarkeProduktService.saveBilder(produktId, { bestehende, geloeschteIds, temp, neue });
  }

  /** Variantenbilder brauchen die IDs, die erst beim Speichern der Varianten entstehen. */
  async saveVariantenBilder(produktId) {
    const aufgaben = this.variantenPanel?.getBildAufgaben() || [];
    if (!aufgaben.length) return;

    const gespeicherte = await MarkeProduktService.loadVarianten(produktId);

    for (const aufgabe of aufgaben) {
      const variante = gespeicherte.find(v => v.id === aufgabe.varianteId)
        || gespeicherte.find(v => v.name === aufgabe.varianteName);
      if (!variante) continue;

      try {
        await MarkeProduktService.saveVarianteBild(produktId, variante.id, aufgabe.file, aufgabe.altesBildId);
      } catch (err) {
        console.warn(`⚠️ Variantenbild für "${aufgabe.varianteName}" konnte nicht gespeichert werden:`, err);
      }
    }
  }

  /** Der globale SubmitGuard sperrt den Button in der Capture-Phase des Submits. */
  releaseSubmitBtn(btn) {
    btn?.classList.remove('is-loading');
    if (btn) window.submitGuard?.unlockButton?.(btn);
  }

  async handleDelete() {
    const res = await window.confirmationModal?.open({
      title: 'Produkt löschen?',
      message: `"${MarkeProduktService.label(this.produkt)}" wird endgültig gelöscht – samt Varianten und Bildern. Kampagnen, die dieses Produkt nutzen, verlieren die Zuordnung.`,
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      danger: true
    });
    if (!res?.confirmed) return;

    try {
      await MarkeProduktService.remove(this.produktId);
      window.toastSystem?.success?.('Produkt gelöscht');
      window.navigateTo(this.returnRoute);
    } catch (err) {
      console.error('Produkt loeschen fehlgeschlagen:', err);
      window.toastSystem?.error?.('Fehler beim Löschen: ' + err.message);
    }
  }

  clearFieldErrors(form) {
    form.querySelectorAll('.field-error').forEach(el => el.remove());
  }

  showFieldErrors(form, errors = {}) {
    for (const [field, message] of Object.entries(errors)) {
      const el = form.querySelector(`[name="${field}"]`);
      if (!el) continue;
      const error = document.createElement('div');
      error.className = 'field-error';
      error.textContent = message;
      // Der Abschnitt statt des direkten Elternteils: bei Preisfeldern liegt
      // das Input in einem Flex-Container, dort wuerde die Meldung umbrechen.
      (el.closest('.form-field') || el.parentNode).appendChild(error);
    }
  }

  destroy() {
    if (this._abort) {
      try { this._abort.abort(); } catch (_) { /* noop */ }
      this._abort = null;
    }
    this.variantenPanel?.destroy?.();
    this.variantenPanel = null;
    this.extractPanel?.destroy?.();
    this.extractPanel = null;
    this.uploader?.destroy?.();
    this.uploader = null;
  }
}

export const markeProduktForm = new MarkeProduktForm();
