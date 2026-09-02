// skripteKonstanten.js
// Konstanten des Skripte-Moduls (Labels, Funnel-Stufen, Video-Laengen, DNA-Layer).

export const FUNNEL_STUFEN = {
  top: 'Top (Awareness)',
  mid: 'Mid (Consideration)',
  bottom: 'Bottom (Conversion)'
};

// Video-Gesamtlaenge in 15-Sekunden-Spannen (Wert = Sekunden "von-bis")
export const VIDEO_LAENGEN = {
  '0-15': '0–15 Sek.',
  '15-30': '15–30 Sek.',
  '30-45': '30–45 Sek.',
  '45-60': '45–60 Sek.',
  '60-75': '1:00–1:15 Min.',
  '75-90': '1:15–1:30 Min.',
  '90-105': '1:30–1:45 Min.',
  '105-120': '1:45–2:00 Min.',
  '120-135': '2:00–2:15 Min.',
  '135-150': '2:15–2:30 Min.',
  '150-165': '2:30–2:45 Min.',
  '165-180': '2:45–3:00 Min.'
};

export const DNA_LAYER = {
  global: 'Global',
  branche: 'Branche',
  zielgruppe: 'Zielgruppe',
  marke: 'Marke'
};

// Briefing-Bereich = Master-Doc (ohne 'basis', das ist immer dabei)
export const SKRIPT_BEREICHE = {
  owned_social: 'Owned Social',
  paid_creator_ads: 'Paid Creator Ads',
  influencer_marketing: 'Influencer Marketing'
};

export const MASTER_BEREICHE = {
  basis: 'Basis (übergreifend)',
  ...SKRIPT_BEREICHE
};
