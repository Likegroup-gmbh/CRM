// ProjektErstellenValidator.js
// Per-Step Pflichtfeld- und Business-Rules-Validation.

export class ProjektErstellenValidator {
  validateStep(step, formData) {
    if (step === 1) return this.validateStep1(formData);
    if (step === 2) return this.validateStep2(formData);
    if (step === 3) return this.validateStep3(formData);
    if (step === 4) return this.validateStep4(formData);
    return { valid: true, errors: [] };
  }

  validateStep1(formData) {
    const errors = [];
    const a = formData.auftrag || {};
    if (!a.unternehmen_id) errors.push('Unternehmen ist ein Pflichtfeld');
    if (!a.ansprechpartner_id) errors.push('Ansprechpartner ist ein Pflichtfeld');
    if (!a.auftragtype) errors.push('Art des Auftrags ist ein Pflichtfeld');
    if (!a.titel || !String(a.titel).trim()) errors.push('Titel ist ein Pflichtfeld');
    if (a.start && a.ende && new Date(a.ende) < new Date(a.start)) {
      errors.push('Enddatum darf nicht vor dem Startdatum liegen');
    }
    return { valid: errors.length === 0, errors };
  }

  validateStep2(formData) {
    const errors = [];
    const d = formData.details || {};
    if (d.agency_services_enabled) {
      if (d.retainer_type && d.retainer_type !== 'none' && (!d.retainer_amount || d.retainer_amount <= 0)) {
        errors.push('Retainer-Betrag muss größer als 0 sein');
      }
      if (d.percentage_fee_enabled && (!d.percentage_fee_value || d.percentage_fee_value <= 0)) {
        errors.push('Prozentwert für prozentuale Vergütung muss größer als 0 sein');
      }
      if (d.ksk_enabled && (d.ksk_value == null || d.ksk_value < 0)) {
        errors.push('KSK-Wert darf nicht negativ sein');
      }
      if (d.extra_services_enabled) {
        const hasEmptyExtra = (d.extra_services || []).some(e => e?.name && (!e.amount || e.amount < 0));
        if (hasEmptyExtra) {
          errors.push('Zusatzleistungen brauchen einen gültigen Betrag');
        }
      }
    }
    return { valid: errors.length === 0, errors };
  }

  validateStep3(formData) {
    const errors = [];
    const d = formData.details || {};
    if (!Array.isArray(d.campaign_type) || d.campaign_type.length === 0) {
      errors.push('Mindestens eine Kampagnenart muss ausgewählt sein');
    }
    const budgets = d.campaign_budgets || {};
    (d.campaign_type || []).forEach(chipValue => {
      const values = budgets[chipValue] || {};
      ['video_anzahl', 'creator_anzahl'].forEach(suffix => {
        const raw = values[suffix];
        if (raw !== '' && raw != null && Number(raw) < 0) {
          errors.push('Creator- und Video-Anzahl dürfen nicht negativ sein');
        }
      });
    });
    return { valid: errors.length === 0, errors };
  }

  validateStep4(formData) {
    const errors = [];
    const k = formData.kampagne || {};
    const name = (k.kampagnenname || '').trim();
    if (!name) errors.push('Kampagnenname ist ein Pflichtfeld');
    return { valid: errors.length === 0, errors };
  }
}
