// SubmitGuard.js
// Globaler Schutz gegen Doppelklicks auf Submit-Buttons + einheitliche Navigation

import { isFormRoute, navigateBack } from './breadcrumbTrail.js';

class SubmitGuard {
  constructor() {
    this.TIMEOUT_MS = 30000; // 30s Fallback
    this.activeTimeouts = new Map();
  }

  init() {
    // Capture-Phase: Submit-Events VOR allen anderen Handlern abfangen
    this._onFormSubmit = this.handleFormSubmit.bind(this);
    document.addEventListener('submit', this._onFormSubmit, true);
    
    // Click-Handler für Submit-Buttons (für nicht-form Buttons)
    this._onButtonClick = this.handleButtonClick.bind(this);
    document.addEventListener('click', this._onButtonClick, true);
    
    // Rücksprung nach Speichern (nur Seitenformulare, siehe handleEntityCreated)
    window.addEventListener('entityUpdated', this.handleEntityCreated.bind(this));
    window.addEventListener('entityCreated', this.handleEntityCreated.bind(this));
    
    // Globale Unlock-Funktion für Error-Handler
    window.unlockSubmit = this.unlockAll.bind(this);
    
    console.log('🔒 SubmitGuard initialisiert');
  }

  // Form-Submit abfangen
  handleFormSubmit(e) {
    const form = e.target;
    if (!form || form.tagName !== 'FORM') return;
    
    // Opt-out für spezielle Formulare (z.B. Drawer-Formulare mit eigener Logik)
    if (form.dataset.noSubmitGuard === 'true') return;
    
    const submitBtn = form.querySelector('button[type="submit"], .mdc-btn--create, .mdc-btn--save');
    if (!submitBtn) return;
    
    // Bereits gesperrt? → Blockieren
    if (this.isLocked(submitBtn)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      console.log('🔒 SubmitGuard: Doppelter Submit blockiert');
      return;
    }
    
    // Button sperren
    this.lockButton(submitBtn);
  }

  // Click auf Submit-Button abfangen (für Buttons außerhalb von Forms)
  handleButtonClick(e) {
    const btn = e.target.closest('button[type="submit"], .mdc-btn--create, .mdc-btn--save');
    if (!btn) return;
    
    // Opt-out: Button oder zugehöriges Form mit data-no-submit-guard
    const form = btn.closest('form');
    if (form?.dataset.noSubmitGuard === 'true' || btn.dataset.noSubmitGuard === 'true') return;
    
    // Bereits gesperrt? → Blockieren
    if (this.isLocked(btn)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      console.log('🔒 SubmitGuard: Doppelter Klick blockiert');
    }
  }

  // Nach Speichern eines Seitenformulars zurück zur Herkunft.
  // Opt-in über detail.redirect: entityUpdated feuert auch bei Inline-Edits,
  // Wizard-Schritten und Drawern, die nicht wegnavigieren dürfen.
  handleEntityCreated(e) {
    const { entity, id, action, redirect } = e.detail || {};
    if (!redirect || !entity) return;
    if (action !== 'created' && action !== 'updated') return;
    if (!isFormRoute(window.location.pathname)) return;

    const fallback = action === 'updated' && id ? `/${entity}/${id}` : `/${entity}`;
    setTimeout(() => navigateBack(fallback), 300);
  }

  // Prüfen ob Button gesperrt ist
  isLocked(btn) {
    return btn.dataset.submitLocked === 'true' || 
           btn.classList.contains('is-submit-locked');
  }

  // Button sperren
  lockButton(btn) {
    if (!btn || this.isLocked(btn)) return;
    
    btn.dataset.submitLocked = 'true';
    btn.classList.add('is-submit-locked');
    
    // Original-Inhalt speichern für Restore
    if (!btn.dataset.originalLabel) {
      const labelEl = btn.querySelector('.mdc-btn__label');
      if (labelEl) {
        btn.dataset.originalLabel = labelEl.textContent;
      }
    }
    
    console.log('🔒 SubmitGuard: Button gesperrt');
    
    // Timeout-Fallback: Nach 30s automatisch freigeben
    const timeoutId = setTimeout(() => {
      console.warn('⏱️ SubmitGuard: Timeout - Button wird freigegeben');
      this.unlockButton(btn);
    }, this.TIMEOUT_MS);
    
    this.activeTimeouts.set(btn, timeoutId);
  }

  // Button freigeben
  unlockButton(btn) {
    if (!btn) return;
    
    // Timeout clearen
    const timeoutId = this.activeTimeouts.get(btn);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.activeTimeouts.delete(btn);
    }
    
    // Nur freigeben wenn Button noch im DOM
    if (!btn.isConnected) return;
    
    btn.dataset.submitLocked = 'false';
    btn.classList.remove('is-submit-locked');
    
    // Original-Label wiederherstellen
    if (btn.dataset.originalLabel) {
      const labelEl = btn.querySelector('.mdc-btn__label');
      if (labelEl) {
        labelEl.textContent = btn.dataset.originalLabel;
      }
    }
    
    console.log('🔓 SubmitGuard: Button freigegeben');
  }

  // Alle gesperrten Buttons freigeben (für Error-Handler)
  unlockAll() {
    document.querySelectorAll('[data-submit-locked="true"], .is-submit-locked').forEach(btn => {
      this.unlockButton(btn);
    });
    console.log('🔓 SubmitGuard: Alle Buttons freigegeben');
  }
}

export { SubmitGuard };

// Singleton exportieren
export const submitGuard = new SubmitGuard();

// Globale Verfügbarkeit
if (typeof window !== 'undefined') {
  window.submitGuard = submitGuard;
}
