// StrategiebriefingService.js
// Zentrale Save-Logik für Strategiebriefings (v2)

const KAMPAGNENART_LABELS = {
  influencer: 'Influencer',
  organic: 'Organic',
  paid: 'Paid'
};

const V2_FIELDS = [
  'kampagnen_zusammenfassung', 'beworben_typ', 'beworben_beschreibung',
  'plattformen', 'creator_branche', 'drehort', 'rechtliches',
  'erfolgskriterien', 'learnings',
  'ziel_influencer', 'format_influencer',
  'funnel', 'ziel_paid',
  'ziel_organic', 'format_organic'
];

export class StrategiebriefingService {

  static getLabel(kampagnenart) {
    return KAMPAGNENART_LABELS[kampagnenart] || kampagnenart;
  }

  static buildInsertPayload(formData, { markeId, unternehmenId, kampagnenart }) {
    const data = {
      schema_version: 'v2',
      kickoff_type: kampagnenart,
      kampagnenart,
      marke_id: markeId || null,
      unternehmen_id: markeId ? null : (unternehmenId || null),
      created_by: window.currentUser?.id || null
    };

    for (const field of V2_FIELDS) {
      if (formData[field] !== undefined) {
        data[field] = formData[field];
      }
    }

    return data;
  }

  static getValidationRules() {
    return {
      kampagnen_zusammenfassung: { type: 'text', required: true, minLength: 10 },
      erfolgskriterien: { type: 'text', required: true, minLength: 5 }
    };
  }

  static async saveBriefing(formData, { markeId, unternehmenId, kampagnenart }) {
    const insertData = this.buildInsertPayload(formData, { markeId, unternehmenId, kampagnenart });

    const { data: result, error } = await window.supabase
      .from('marke_kickoff')
      .insert([insertData])
      .select()
      .single();

    if (error) throw error;
    return result;
  }

  static isV2(kickoff) {
    return kickoff?.schema_version === 'v2' || !!kickoff?.kampagnen_zusammenfassung;
  }
}
