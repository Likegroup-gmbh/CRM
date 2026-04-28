// ProjektErstellenValidator.js
// Per-Step Pflichtfeld- und Business-Rules-Validation.

import { normalizeCampaignBlocks } from '../logic/CampaignBudgetFields.js';

export class ProjektErstellenValidator {
  validateStep(step, formData) {
    if (step === 1) return this.validateStep1(formData);
    if (step === 2) return this.validateStep2(formData);
    if (step === 3) return this.validateStep3(formData);
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
    const a = formData.auftrag || {};
    const d = formData.details || {};
    const parseMoney = (value) => {
      if (value === '' || value == null) return 0;
      const n = parseFloat(value);
      return Number.isFinite(n) ? n : 0;
    };
    if (!a.angebotsnummer || !String(a.angebotsnummer).trim()) {
      errors.push('Angebotsnummer ist ein Pflichtfeld');
    }
    if (d.agency_services_enabled) {
      if (d.retainer_type && d.retainer_type !== 'none' && (!d.retainer_amount || d.retainer_amount <= 0)) {
        errors.push('Retainer-Betrag muss größer als 0 sein');
      }
      if (d.percentage_fee_enabled && (!d.percentage_fee_value || d.percentage_fee_value <= 0)) {
        errors.push('Agentur Fee muss größer als 0 sein');
      }
      if (d.ksk_enabled && (!d.ksk_value || d.ksk_value <= 0)) {
        errors.push('KSK-Betrag muss größer als 0 sein');
      }
      if (d.extra_services_enabled) {
        const hasEmptyExtra = (d.extra_services || []).some(e => e?.name && (!e.amount || e.amount < 0));
        if (hasEmptyExtra) {
          errors.push('Zusatzleistungen brauchen einen gültigen Betrag');
        }
      }
      const extraServicesTotal = d.extra_services_enabled && Array.isArray(d.extra_services)
        ? d.extra_services.reduce((sum, item) => sum + parseMoney(item?.amount), 0)
        : 0;
      const agencyFee = d.percentage_fee_enabled ? parseMoney(d.percentage_fee_value) : 0;
      const ksk = d.ksk_enabled ? parseMoney(d.ksk_value) : 0;
      const deductions = extraServicesTotal + agencyFee + ksk;
      const netto = parseMoney(a.nettobetrag);
      if (a.nettobetrag !== '' && a.nettobetrag != null && deductions > netto) {
        errors.push('Agentur Fee, KSK und Zusatzleistungen dürfen das Netto-Budget nicht überschreiten');
      }
    }
    return { valid: errors.length === 0, errors };
  }

  validateStep3(formData) {
    const errors = [];
    const k = formData.kampagne || {};
    const d = formData.details || {};
    const blocks = normalizeCampaignBlocks(d);
    if (!k.kampagnenname || !String(k.kampagnenname).trim()) {
      errors.push('Kampagnenname ist ein Pflichtfeld');
    }
    if (!blocks.length) {
      errors.push('Mindestens eine Kampagnenart muss ausgewählt sein');
    }
    blocks.forEach(block => {
      if (!block.campaign_type) {
        errors.push('Jeder Kampagnenblock braucht eine Kampagnenart');
      }
      ['video_anzahl', 'creator_anzahl'].forEach(field => {
        const raw = block[field];
        if (raw !== '' && raw != null && Number(raw) < 0) {
          errors.push('Creator- und Video-Anzahl dürfen nicht negativ sein');
        }
      });
      [
        'einkaufspreis_netto_von',
        'einkaufspreis_netto_bis',
        'verkaufspreis_netto_von',
        'verkaufspreis_netto_bis'
      ].forEach(field => {
        const raw = block[field];
        if (raw !== '' && raw != null && Number(raw) < 0) {
          errors.push('Preise dürfen nicht negativ sein');
        }
      });
    });
    return { valid: errors.length === 0, errors };
  }
}
