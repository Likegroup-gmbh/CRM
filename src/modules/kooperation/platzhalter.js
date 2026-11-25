// Platzhalter: eine Kooperation ohne Creator.
// Sie ist sichtbar und pflegbar, zählt aber erst mit, wenn ein Creator gesetzt ist.
// Fehlt das Feld creator_id, bleibt die Zeile gezählt: ältere Aufrufer
// kennen das Feld nicht und sind gebuchte Kooperationen.

export const PLATZHALTER_NAME = 'Platzhalter';

export const HINWEIS_VIDEOS = 'Die Videoanzahl überschreitet die verfügbaren Videos dieser Kampagne.';
export const HINWEIS_PRODUKTION = 'Verkaufspreis übersteigt das Produktionsbudget';
export const HINWEIS_CREATOR_BUDGET = 'Verkaufspreis übersteigt das Creator-Budget der Kampagne';
export const HINWEIS_VOLUMEN = 'Verkaufspreis übersteigt das Volumen der Kampagne';
export const HINWEIS_PRODUKTION_OHNE_BUDGET = 'Produktion hat kein Produktionsbudget';
export const HINWEIS_LINIE = 'Für diesen Creator gibt es in dieser Linie schon eine Kooperation.';

export function istPlatzhalter(koop) {
  return !!koop && Object.prototype.hasOwnProperty.call(koop, 'creator_id') && !koop.creator_id;
}

export function offenePlatzhalterAnzahl(koops) {
  return (koops || []).filter(istPlatzhalter).length;
}

export function summeVideoanzahl(koops) {
  return (koops || []).reduce((sum, koop) => sum + (parseInt(koop?.videoanzahl, 10) || 0), 0);
}

export function summeVerkaufspreis(videos) {
  return (videos || []).reduce((sum, video) => sum + (parseFloat(video?.verkaufspreis_netto) || 0), 0);
}

export function creatorAnzeigename(creator) {
  const name = `${creator?.vorname || ''} ${creator?.nachname || ''}`.trim();
  if (name) return name;
  if (creator?.instagram) return `@${creator.instagram}`;
  return 'Creator';
}

export function naechsteKooperationsnummer(namen) {
  const nummern = (namen || [])
    .map(name => {
      const match = String(name || '').match(/(\d+)\/\d+$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(n => n > 0);
  if (nummern.length === 0) return (namen || []).length + 1;
  return Math.max(...nummern) + 1;
}

export function kooperationsname(creatorName, nummer, maximum) {
  return `${creatorName} ${nummer}/${maximum || 1}`;
}

export function linienHinweis(koops, { creatorId, briefingId, ausserId } = {}) {
  if (!creatorId || !briefingId) return '';
  const belegt = (koops || []).some(koop =>
    koop.id !== ausserId && koop.creator_id === creatorId && koop.briefing_id === briefingId
  );
  return belegt ? HINWEIS_LINIE : '';
}

function zahlOderNull(wert) {
  if (wert == null || wert === '') return null;
  const n = Number(wert);
  return Number.isFinite(n) ? n : null;
}

// Decke wie guard_video_verkaufspreis: Produktionsbudget, sonst Creator-Budget
// bzw. Volumen. Eine Produktion ohne eigenes Budget, während eine andere
// der Kampagne eines hat, darf keine Verkaufspreise tragen.
export function deckenStandAus({
  kontingentVideos = 0,
  creatorBudget = null,
  auftragCreatorBudget = null,
  volumen = null,
  produktionen = []
} = {}) {
  const kampagne = zahlOderNull(creatorBudget);
  const auftrag = zahlOderNull(auftragCreatorBudget);
  const volumenZahl = zahlOderNull(volumen);
  const hatCreator = kampagne != null || auftrag != null;
  return {
    kontingentVideos: parseInt(kontingentVideos, 10) || 0,
    kampagneDecke: hatCreator ? (kampagne ?? auftrag) : volumenZahl,
    deckeQuelle: hatCreator ? 'creator' : (volumenZahl != null ? 'volumen' : 'keine'),
    produktionen: (produktionen || []).map(p => ({ id: p.id, budget: zahlOderNull(p.budget) }))
  };
}

function preisHinweis({ koop, eigenerVk, koops, videosByKoopId, stand }) {
  if (!koop?.produktion_id) return '';
  const eigene = (stand.produktionen || []).find(p => p.id === koop.produktion_id);
  const andereMitBudget = (stand.produktionen || []).some(p => p.id !== koop.produktion_id && p.budget != null);

  if (eigene?.budget != null) {
    const verwendet = (koops || [])
      .filter(k => k.id !== koop.id && !istPlatzhalter(k) && k.produktion_id === koop.produktion_id)
      .reduce((sum, k) => sum + summeVerkaufspreis(videosByKoopId?.[k.id]), 0);
    if (verwendet + eigenerVk > eigene.budget) return HINWEIS_PRODUKTION;
    return '';
  }

  if (andereMitBudget && eigenerVk > 0) return HINWEIS_PRODUKTION_OHNE_BUDGET;
  if (andereMitBudget) return '';
  if (stand.kampagneDecke == null) return '';

  const verwendet = (koops || [])
    .filter(k => k.id !== koop.id && !istPlatzhalter(k))
    .reduce((sum, k) => sum + summeVerkaufspreis(videosByKoopId?.[k.id]), 0);
  if (verwendet + eigenerVk <= stand.kampagneDecke) return '';
  return stand.deckeQuelle === 'volumen' ? HINWEIS_VOLUMEN : HINWEIS_CREATOR_BUDGET;
}

export function pruefeDecke({ koop, videosDieser = [], koops = [], videosByKoopId = {}, stand }) {
  if (!koop || !stand) return { video: false, preis: false, text: '' };
  const texte = [];

  if (stand.kontingentVideos > 0) {
    const gebucht = summeVideoanzahl((koops || []).filter(k => k.id !== koop.id && !istPlatzhalter(k)));
    const rest = stand.kontingentVideos - gebucht;
    if ((parseInt(koop.videoanzahl, 10) || 0) > rest) texte.push(HINWEIS_VIDEOS);
  }

  const preis = preisHinweis({
    koop,
    eigenerVk: summeVerkaufspreis(videosDieser),
    koops,
    videosByKoopId,
    stand
  });
  if (preis) texte.push(preis);

  return {
    video: texte.includes(HINWEIS_VIDEOS),
    preis: Boolean(preis),
    text: texte.join(' ')
  };
}

export function hinweisTexte(koops, videosByKoopId, stand) {
  const map = new Map();
  if (!stand) return map;
  for (const koop of koops || []) {
    if (!istPlatzhalter(koop)) continue;
    const text = pruefeDecke({
      koop,
      videosDieser: videosByKoopId?.[koop.id] || [],
      koops,
      videosByKoopId,
      stand
    }).text;
    if (text) map.set(koop.id, text);
  }
  return map;
}
