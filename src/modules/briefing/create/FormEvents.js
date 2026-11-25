// FormEvents.js
// Events des Briefing-Formulars: Multistep-Navigation (intern) und die Feld-Events,
// die intern und Einladung teilen (bindFormularEvents): Videolänge-Modus, „bis“-Datum,
// Umsetzungsideen. Zuordnung: ZuordnungEvents.js, Produktliste: ProduktListeEvents.js.

import { BriefingCreate } from './BriefingCreateCore.js';
import { feldNachName } from './fieldConfig.js';
import { bindSekundenSpanne } from '../../../core/components/SekundenSpanne.js';
import { CustomDatePicker } from '../../../core/components/CustomDatePicker.js';
import { ideeZeileHtml } from './fieldRendererListen.js';
import { navigateBack } from '../../../core/breadcrumbTrail.js';
import './ZuordnungEvents.js';
import './ProduktListeEvents.js';

function briefingForm() {
  return document.getElementById('briefing-form');
}

BriefingCreate.prototype.bindMultistepEvents = function() {
  document.getElementById('btn-cancel')?.addEventListener('click', () => navigateBack('/briefing'));

  document.getElementById('btn-save-draft')?.addEventListener('click', async () => {
    this.saveCurrentStepData();
    await this.saveDraftToDB();
  });

  document.getElementById('btn-prev')?.addEventListener('click', () => {
    this.saveCurrentStepData();
    this._animateAndRender(() => {
      this.currentStep--;
      this.render();
    });
  });

  document.getElementById('btn-next')?.addEventListener('click', () => {
    if (!this.validateCurrentStep()) return;
    this.saveCurrentStepData();
    this._animateAndRender(() => {
      this.currentStep++;
      this.render();
    });
  });

  document.getElementById('btn-submit')?.addEventListener('click', async () => {
    if (!this.validateCurrentStep()) return;
    this.saveCurrentStepData();
    await this.handleSubmit();
  });

  this.bindFormularEvents();
  this.bindCascadeEvents();
  this.bindProduktListe();
  void this.syncZielProduktion();
};

/** Feld-Events, die intern und im Einladungsformular gleich sind. */
BriefingCreate.prototype.bindFormularEvents = function() {
  const form = briefingForm();
  if (!form) return;

  CustomDatePicker.bind(form);

  form.querySelectorAll('[data-sekunden-spanne]').forEach(root => bindSekundenSpanne(root, {
    onCommit: () => this.saveCurrentStepData()
  }));

  form.addEventListener('change', (e) => {
    if (this._isInitializing) return;
    if (e.target.closest?.('[data-produkt-row]')) return;
    this.zeigeVideolaengeModus(e.target);
    this.zieheBisDatumNach(e.target);
    this.zeigeIdeeArt(e.target);
    this.saveCurrentStepData();
    if (e.target?.id === 'kampagne_id' && !this._linieGesperrt) {
      this.formData.produktion_id = null;
      void this.syncZielProduktion?.();
    }
  });

  form.addEventListener('click', (e) => {
    const add = e.target.closest('[data-ideen-add]');
    if (add) {
      this.ideeHinzufuegen(add.dataset.ideenAdd);
      return;
    }
    const remove = e.target.closest('.bf-repeatable-remove');
    if (remove) {
      remove.closest('[data-repeatable-row]')?.remove();
      this.saveCurrentStepData();
    }
  });
};

BriefingCreate.prototype.zeigeVideolaengeModus = function(target) {
  const match = /^(.+)__modus$/.exec(target?.name || '');
  if (!match) return;
  const root = target.closest(`[data-videolaenge="${match[1]}"]`);
  root?.querySelectorAll('[data-videolaenge-teil]').forEach((teil) => {
    teil.classList.toggle('hidden', teil.dataset.videolaengeTeil !== target.value);
  });
};

// „bis“ darf nicht vor dem Start liegen: min nachziehen, zu frühes „bis“ leeren.
BriefingCreate.prototype.zieheBisDatumNach = function(target) {
  if (!target?.classList?.contains('custom-date-picker__input')) return;
  const form = briefingForm();
  const start = CustomDatePicker.getValue(target);
  form?.querySelectorAll(`input[data-nach-datum="${target.name}"]`).forEach((bis) => {
    CustomDatePicker.setMin(bis, start);
    const ende = CustomDatePicker.getValue(bis);
    if (ende && start && ende < start) CustomDatePicker.setValue(bis, '');
  });
};

BriefingCreate.prototype.zeigeIdeeArt = function(target) {
  if (!target?.matches?.('[data-idee-verbindlich]')) return;
  const art = target.closest('[data-idee-row]')?.querySelector('[data-idee-art]');
  if (art) art.textContent = target.checked ? 'Verbindlich' : 'Inspiration';
};

BriefingCreate.prototype.ideeHinzufuegen = function(name) {
  const container = briefingForm()?.querySelector(`[data-ideenliste="${name}"]`);
  const field = feldNachName(name);
  if (!container || !field) return;
  const max = parseInt(container.dataset.max || '20', 10);
  if (container.querySelectorAll('[data-idee-row]').length >= max) {
    window.toastSystem?.show(`Maximal ${max} Einträge.`, 'warning');
    return;
  }
  container.insertAdjacentHTML('beforeend', ideeZeileHtml(field, {}));
  container.querySelector('[data-idee-row]:last-child [data-idee-text]')?.focus();
};
