// Gemeinsame Fakes für die Tests der Erfassen-Ansicht: Einheiten, Posts und eine gemountete Ansicht,
// deren `aendere` das Modell wie die Pane neu rechnet. Das Schreiben und das Warten auf die KI
// mockt jeder Test selbst (vi.mock auf auswertungPostsSpeichern.js und auswertungKiLauf.js).

import { baueModell } from '../modules/auswertung/auswertungModell.js';
import { neuerZustand } from '../modules/auswertung/auswertungAnsicht.js';
import { renderErfassen } from '../modules/auswertung/auswertungPruefbereich.js';
import { bindeErfassen } from '../modules/auswertung/auswertungErfassen.js';

const PRODUKTION = { id: 'pr1', name: 'Q3 Slushi', linien: [] };

export function einheit(nr, extra = {}) {
  return {
    id: `video:v${nr}`, art: 'video', videoId: `v${nr}`, nr, label: `Video ${nr}`, titel: `Hook ${nr}`,
    kooperationId: `k${nr}`, creator: { id: `c${nr}`, name: `Creator ${nr}`, handle: `creator${nr}` },
    produktion: { id: PRODUKTION.id, name: PRODUKTION.name }, linie: null, erwartet: true,
    dateien: [], tags: { persona: [], ansatz: [], plattform: [] }, gepostetAm: null,
    ...extra
  };
}

export function post(id, einheitId, extra = {}) {
  return {
    id, einheitId, kampagneId: 'ka1', plattform: 'ig_reel', accountHandle: null, link: null,
    postedAt: '2026-11-01', measuredAt: '2026-11-09', metrics: {}, confidence: null,
    source: 'manuell', status: 'draft', kiStatus: null, kiFehler: null,
    screenshotPfade: [], screenshots: 0, dateiId: null, confirmedBy: null,
    ...extra
  };
}

export const modellAus = (einheiten, posts) => baueModell(
  { einheiten, posts, verbrauch: [], produktionen: [PRODUKTION] },
  { ebene: 'produktion', produktionId: PRODUKTION.id }
);

/** Ansicht wie in der Pane: rendern, binden, Änderungen rechnen das Modell neu. */
export function montiere({ einheiten, posts = [], zustand: teil = {} }) {
  let liste = [...posts];
  let modell = modellAus(einheiten, liste);
  const zustand = neuerZustand({ ansicht: 'erfassen', ...teil });
  const root = document.createElement('div');
  root.setAttribute('data-auswertung', '');
  root.innerHTML = `<div data-auswertung-inhalt>${renderErfassen(modell, zustand)}</div>`;
  document.body.append(root);
  const aendere = {
    post: (p) => {
      liste = liste.some(x => x.id === p.id) ? liste.map(x => (x.id === p.id ? p : x)) : [...liste, p];
      modell = modellAus(einheiten, liste);
      return true;
    },
    weg: (id) => {
      liste = liste.filter(x => x.id !== id);
      modell = modellAus(einheiten, liste);
      return true;
    }
  };
  const loese = bindeErfassen(root, { modell: () => modell, zustand, posterCache: new Map(), aendere });
  return {
    root,
    zustand,
    posts: () => liste,
    form: () => root.querySelector('[data-erfassen-form]'),
    zeilen: () => [...root.querySelectorAll('[data-erfassen-eintrag]')].map(el => ({ key: el.dataset.erfassenEintrag, status: el.dataset.status, aktiv: el.classList.contains('is-aktiv') })),
    abbauen: () => { loese(); root.remove(); }
  };
}

/** Bis die Promise-Kette der Aktion durch ist. */
export const warte = () => new Promise(resolve => setTimeout(resolve, 0));

export function bild(name = 'insights.png', type = 'image/png', size = 2048) {
  return new File([new Uint8Array(size)], name, { type });
}
