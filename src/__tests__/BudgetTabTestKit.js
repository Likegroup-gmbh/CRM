import { beforeEach } from 'vitest';

export const lena = { id: 'c1', vorname: 'Lena', nachname: 'Hartmann', instagram: 'https://instagram.com/lena.lifts/' };
export const mia = { id: 'c2', vorname: 'Mia', nachname: 'Okafor', tiktok: '@miaokafor' };

export const JANUAR = ['t-jan', 'Januar'];
export const JAHR = ['t-2026', '2026'];

export function koop(id, { briefing_id = 'l1', creator = null, videos = [], zusatz = null, produktion_id = 'p1', name, tags = [] } = {}) {
  return {
    id,
    name: name || `Koop ${id}`,
    briefing_id,
    produktion_id,
    creator,
    verkaufspreis_zusatzkosten: zusatz,
    kooperation_videos: videos.map(v => ({ verkaufspreis_netto: v })),
    kooperation_tags: tags.map(([tagId, tagName]) => ({ tag_id: tagId, kooperation_tag_typen: { id: tagId, name: tagName } }))
  };
}

export const koops = [
  koop('k1', { creator: lena, videos: [2000, 1800], zusatz: 500, tags: [JANUAR] }),
  koop('k2', { creator: lena, briefing_id: 'l2', videos: [2000], tags: [JANUAR, JAHR] }),
  koop('k3', { creator: mia, briefing_id: 'l2', videos: [3000, '400.5'], tags: [JAHR] }),
  koop('k4', { name: 'Altbestand Max', briefing_id: null, videos: [1000] })
];

export function setupValidator() {
  beforeEach(() => {
    window.validatorSystem = {
      sanitizeHtml: (value) => String(value ?? ''),
      sanitizeUrl: (value) => String(value ?? '')
    };
  });
}
