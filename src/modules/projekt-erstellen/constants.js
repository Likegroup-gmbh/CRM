// Konstanten fuer den neuen Projekt-Erstellen-Flow.
// Die Werte werden 1:1 in auftrag.auftragtype bzw. auftrag_details.campaign_type geschrieben.

export const AUFTRAG_TYPES = [
  { value: 'Vorortproduktion', label: 'Vorortproduktion' },
  { value: 'Contracting', label: 'Contracting' },
  { value: 'UGC/Influencer', label: 'UGC / Influencer' }
];

export const CAMPAIGN_TYPES = [
  { value: 'ugc_paid', label: 'UGC Paid' },
  { value: 'ugc_organic', label: 'UGC Organic' },
  { value: 'influencer', label: 'Influencer Kampagne' },
  { value: 'vorort_produktion', label: 'Vor-Ort-Produktion' },
  { value: 'story', label: 'Story' }
];

export const RETAINER_TYPES = [
  { value: 'none', label: 'Kein Retainer' },
  { value: 'monthly', label: 'Monatlich' }
];

export const FEE_BASES = [
  { value: 'creator_budget', label: 'Creator-Budget' },
  { value: 'media_budget', label: 'Media-Budget' },
  { value: 'total_budget', label: 'Gesamtbudget' }
];

export const KSK_TYPES = [
  { value: 'percentage', label: 'Prozentual' },
  { value: 'fixed', label: 'Fixbetrag' }
];
