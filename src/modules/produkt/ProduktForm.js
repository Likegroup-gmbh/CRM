// ProduktForm.js
// Eigene Seite zum Anlegen und Bearbeiten eines Produkts.
// Routen: /marke/:markeId/produkt, /unternehmen/:unternehmenId/produkt
//         (Bearbeiten jeweils mit ?produkt=:id)
//         /produkt/new — Anlegen aus der Liste, Firma waehlt man im Dokument
//
// Die Seite ist ein Worksheet: mittig ein Schreibdokument mit festen
// Ueberschriften und frei beschreibbaren Abschnitten (ProduktDoc.js),
// rechts das Auslesen der Shop-URL samt Liky-Verlauf
// (ProduktExtractPanel.js). Bilder und Varianten stehen als Tabellen
// mitten im Dokument.
//
// Im Unternehmens- und Listen-Kontext traegt das Dokument ein Marken-
// Multiselect. Aus einer Marke heraus ist die Zuordnung fix.

import { ProduktService, MAX_BILDER } from './ProduktService.js';
import { ProduktVariantenPanel } from './ProduktVarianten.js';
import { ProduktExtractPanel } from './ProduktExtractPanel.js';
import { renderProduktDoc, bindProduktDoc, refreshDocHeights } from './ProduktDoc.js';
import { UploaderField } from '../../core/form/fields/UploaderField.js';
import { produktConfig } from '../../core/form/config/ProduktFormConfig.js';
import { resolveOwnerContext } from '../../core/OwnerContext.js';
import { icon } from '../../core/icons/IconSystem.js';

export class ProduktForm {
  constructor() {
    this.ctx = null;
    this.produktId = null;
    this.produkt = null;
    this.markenIds = [];
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

  get isStandalone() {
    return !!this.ctx?.standalone;
  }

  get returnRoute() {
    if (this.isStandalone) return '/produkt';
    return `${this.ctx.basePath}?tab=produkte`;
  }

  get zeigtMarkenFeld() {
    if (this.isStandalone) return true;
    return !this.ctx.markeId && this.ctx.markenAnzahl > 0;
  }

  get zeigtUnternehmenFeld() {
    return this.isStandalone;
  }

  async init(ownerId) {
    this._abort?.abort();
    this._abort = new AbortController();

    this.produktId = new URLSearchParams(window.location.search).get('produkt');
    this.produkt = null;
    this.markenIds = [];
    this.varianten = [];
    this.bilder = [];

    try {
      this.ctx = ownerId
        ? await resolveOwnerContext(ownerId)
        : standaloneProduktContext();

      if (this.produktId) {
        this.produkt = await ProduktService.loadOne(this.produktId, this.ctx);
        if (!this.produkt) {
          window.toastSystem?.error?.('Produkt nicht gefunden');
          window.navigateTo(this.returnRoute);
          return;
        }
        [this.varianten, this.bilder, this.markenIds] = await Promise.all([
          ProduktService.loadVarianten(this.produktId),
          ProduktService.loadBilder(this.produktId),
          ProduktService.loadMarkenIds(this.produktId)
        ]);
      }
    } catch (err) {
      console.error('Produkt-Formular konnte nicht geladen werden:', err);
      window.ErrorHandler?.handle?.(err, 'ProduktForm.init');
      window.navigateTo(this.ctx?.basePath || '/produkt');
      return;
    }

    await this.render();
    this.bindEvents();
    if (this.zeigtUnternehmenFeld) {
      await this.applyUnternehmenScope();
    }
    if (this.isStandalone) {
      this.syncMarkenFeldSichtbarkeit();
    }
  }

  async render() {
    const title = this.isEdit
      ? ProduktService.label(this.produkt)
      : 'Neues Produkt anlegen';

    window.setHeadline(title);

    const crumbs = this.isStandalone
      ? [
          { label: 'Produkte', url: '/produkt', clickable: true },
          { label: 'Produkt anlegen', clickable: false }
        ]
      : [
          { label: this.ctx.listLabel, url: this.ctx.listPath, clickable: true },
          { label: this.ctx.ownerLabel, url: this.returnRoute, clickable: true },
          { label: this.isEdit ? ProduktService.label(this.produkt) : 'Produkt anlegen', clickable: false }
        ];
    window.breadcrumbSystem?.updateBreadcrumb(crumbs);

    const formData = this.isEdit
      ? { ...this.produkt, marke_ids: this.markenIds, _isEditMode: true, _entityId: this.produkt.id }
      : null;

    window.content.innerHTML = renderProduktDoc(formData, {
      mitMarkenFeld: this.zeigtMarkenFeld,
      mitUnternehmenFeld: this.zeigtUnternehmenFeld,
      unternehmenId: this.ctx.unternehmenId
    });

    const form = document.getElementById('produkt-form');
    bindProduktDoc(form, formData);

    // Searchable-Selects und filterBy (Marke nach Firma) muessen stehen,
    // bevor applyUnternehmenScope die Firmenliste setzt.
    await window.formSystem.bindFormEvents('produkt', formData);

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

  findUnternehmenSelect() {
    return document.querySelector('#field-unternehmen_id')
      || document.querySelector('#produkt-form select[data-field-name="unternehmen_id"]')
      || document.querySelector('#produkt-form select[name="unternehmen_id"]');
  }

  async applyUnternehmenScope() {
    const select = this.findUnternehmenSelect();
    if (!select) return;

    const rows = await ProduktService.loadCreateUnternehmenOptions(window.currentUser?.id);
    const options = rows.map(u => ({ value: u.id, label: u.firmenname }));
    if (window.formSystem?.reinitializeSearchableSelect) {
      window.formSystem.reinitializeSearchableSelect(select, options, {
        placeholder: 'Unternehmen suchen und auswählen...',
        type: 'select',
        searchable: true
      });
      return;
    }

    select.innerHTML = '<option value="">Unternehmen suchen und auswählen...</option>';
    options.forEach(opt => {
      const el = document.createElement('option');
      el.value = opt.value;
      el.textContent = opt.label;
      select.appendChild(el);
    });
  }

  syncMarkenFeldSichtbarkeit() {
    if (!this.isStandalone) return;
    const form = document.getElementById('produkt-form');
    const section = form?.querySelector('[data-doc-field="marke_ids"]');
    if (!section) return;
    const value = form.querySelector('[name="unternehmen_id"]')?.value;
    section.hidden = !value;
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
      warnFileSize: field.warnFileSize || null,
      shrinkOptions: field.shrink || null,
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
      url: ProduktService.publicUrl(b.storage_pfad)
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

    // Abbrechen: Liste oder Produkte-Tab der Marke/Firma
    const cancelBtn = form.querySelector('.mdc-btn--cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => window.navigateTo(this.returnRoute), opts);
    }

    if (this.isStandalone) {
      form.addEventListener('change', (e) => {
        const name = e.target?.name || e.target?.dataset?.fieldName;
        if (name === 'unternehmen_id') this.syncMarkenFeldSichtbarkeit();
      }, opts);
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
        ${icon('trash-alt')}
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
      name: { type: 'text', minLength: 2, required: true },
      ...(this.zeigtUnternehmenFeld ? { unternehmen_id: { type: 'text', required: true } } : {})
    });
    if (!validation.isValid) {
      this.showFieldErrors(form, validation.errors);
      window.toastSystem?.error?.('Bitte Pflichtfelder ausfüllen');
      this.releaseSubmitBtn(submitBtn);
      return;
    }

    const preisFehler = this.validatePreisRange(data);
    if (preisFehler) {
      this.showFieldErrors(form, { [preisFehler.feld]: preisFehler.text });
      window.toastSystem?.error?.(preisFehler.text);
      this.releaseSubmitBtn(submitBtn);
      return;
    }

    submitBtn?.classList.add('is-loading');

    try {
      let produktId = this.produktId;

      if (this.isEdit) {
        await ProduktService.update(this.produktId, data);
      } else {
        const unternehmenId = this.ctx.unternehmenId || data.unternehmen_id;
        if (!unternehmenId) {
          this.showFieldErrors(form, { unternehmen_id: 'Bitte ein Unternehmen wählen' });
          window.toastSystem?.error?.('Bitte ein Unternehmen wählen');
          this.releaseSubmitBtn(submitBtn);
          return;
        }
        const result = await ProduktService.create(data, { unternehmenId });
        produktId = result.id;
      }

      await ProduktService.saveMarken(produktId, this.collectMarkenIds(data));
      await ProduktService.saveVarianten(produktId, this.variantenPanel?.getVarianten() || []);
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

  /**
   * Ohne sichtbares Feld bleibt die bestehende Zuordnung erhalten - aus einer
   * Marke heraus kommt sie nur dazu. Sonst zaehlt genau die Auswahl im Tag-Feld.
   */
  collectMarkenIds(data) {
    if (!this.zeigtMarkenFeld) {
      return [...new Set([...this.markenIds, this.ctx.markeId].filter(Boolean))];
    }
    const werte = data.marke_ids;
    if (Array.isArray(werte)) return werte;
    return werte ? [werte] : [];
  }

  /** @returns {{feld: string, text: string}|null} */
  validatePreisRange(data) {
    const von = ProduktService.toNumber(data.preis_von);
    const bis = ProduktService.toNumber(data.preis_bis);
    const uvp = ProduktService.toNumber(data.preis_uvp);

    if (von != null && bis != null && bis < von) {
      return { feld: 'preis_bis', text: 'Der Preis "bis" darf nicht unter dem Preis "von" liegen' };
    }
    // Ein UVP unter dem Verkaufspreis waere im Skript eine falsche Ersparnis
    const hoechster = bis != null ? bis : von;
    if (uvp != null && hoechster != null && uvp < hoechster) {
      return { feld: 'preis_uvp', text: 'Der UVP darf nicht unter dem Verkaufspreis liegen' };
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
    const neue = [];

    behalten.forEach((f, index) => {
      const istHaupt = primary === `existing:${f.id}`;

      // Verkleinertes Extraktionsbild: die Temp-Datei im Storage laesst der
      // Cron-Job verfallen, hochgeladen wird die kleinere Fassung.
      if (f.isTemporary && f.replacementFile) {
        neue.push({
          file: f.replacementFile,
          quelle_url: f.quelleUrl,
          position: index,
          ist_hauptbild: istHaupt
        });
      } else if (f.isTemporary) {
        temp.push({
          storage_pfad: f.storagePfad,
          quelle_url: f.quelleUrl,
          position: index,
          ist_hauptbild: istHaupt
        });
      } else {
        bestehende.push({
          id: f.id,
          position: index,
          ist_hauptbild: istHaupt,
          ersatzFile: f.replacementFile || null
        });
      }
    });

    // Temporaere Eintraege haben keine DB-Zeile, dürfen also nicht als
    // "geloescht" an den Service gehen - ihre Storage-Datei raeumt der Cron-Job.
    const geloeschteIds = uploader.getDeletedFileIds().filter(id => !String(id).startsWith('temp:'));

    uploader.files.forEach((file, i) => {
      neue.push({
        file,
        position: behalten.length + i,
        ist_hauptbild: primary === `new:${i}`
      });
    });

    await ProduktService.saveBilder(produktId, { bestehende, geloeschteIds, temp, neue });
  }

  /** Variantenbilder brauchen die IDs, die erst beim Speichern der Varianten entstehen. */
  async saveVariantenBilder(produktId) {
    const aufgaben = this.variantenPanel?.getBildAufgaben() || [];
    if (!aufgaben.length) return;

    const gespeicherte = await ProduktService.loadVarianten(produktId);

    for (const aufgabe of aufgaben) {
      const variante = gespeicherte.find(v => v.id === aufgabe.varianteId)
        || gespeicherte.find(v => v.name === aufgabe.varianteName);
      if (!variante) continue;

      try {
        await ProduktService.saveVarianteBild(produktId, variante.id, aufgabe.file, aufgabe.altesBildId);
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
      message: `"${ProduktService.label(this.produkt)}" wird endgültig gelöscht – samt Varianten und Bildern. Kampagnen, die dieses Produkt nutzen, verlieren die Zuordnung.`,
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      danger: true
    });
    if (!res?.confirmed) return;

    try {
      await ProduktService.remove(this.produktId);
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

function standaloneProduktContext() {
  return {
    typ: 'produkt',
    markeId: null,
    unternehmenId: null,
    owner: null,
    basePath: '/produkt',
    listPath: '/produkt',
    listLabel: 'Produkte',
    ownerLabel: null,
    markenAnzahl: 0,
    standalone: true
  };
}

export const produktForm = new ProduktForm();
