// auswertungPanel.js
// Detail-Panel eines Posts (Spec 5.5) in der bestehenden Drawer-Schale: Kontext, Poster, Aufrufe
// mit Engagement-Rate, alle Kennzahlen der Plattform, Herkunft (Link, KI oder manuell) und für das
// Team die Screenshots sowie die Sprünge in Erfassen und in den Video-Tab. Esc schließt, danach
// geht der Fokus zurück auf die Zeile.

import { openDrawer } from '../creator/creatorDrawer.js';
import { KENNZAHLEN, MESSREGEL_TAGE, felderDerPlattform } from './auswertungKonfig.js';
import { engagementRate, interaktionen, messTage } from './auswertungKennzahlen.js';
import { LEER, dateiLabel, datum, esc, exakt, herkunftText, kompakt, plattformLabel, plural, prozent, sekunden } from './auswertungFormat.js';
import { postDatei } from './auswertungTabelle.js';
import { fuelleVorschauen } from './auswertungScreenshots.js';

const DRAWER_ID = 'auswertung-post-drawer';

function feldWert(key, wert) {
  if (key === 'avgWatchSec') return sekunden(wert);
  if (key === 'completionPct') return typeof wert === 'number' ? `${wert.toLocaleString('de-DE')} %` : LEER;
  return exakt(wert);
}

function kennzahlenListe(post) {
  const zeilen = felderDerPlattform(post.plattform).map(key => [KENNZAHLEN[key]?.label || key, feldWert(key, post.metrics?.[key])]);
  zeilen.push(['Interaktionen', exakt(interaktionen(post))]);
  return `<dl class="auswertung-panel__werte">${zeilen.map(([l, w]) => `<div><dt>${esc(l)}</dt><dd>${esc(w)}</dd></div>`).join('')}</dl>`;
}

function herkunft(post, { team }) {
  const shots = team && post.screenshots ? '<div class="auswertung-panel__shots" data-panel-shots></div>' : '';
  return `<p class="auswertung-panel__text">${esc(herkunftText(post))}</p>${shots}`;
}

function eckdaten(post) {
  const tage = messTage(post);
  const messung = tage != null
    ? `gemessen nach ${plural(tage, 'Tag', 'Tagen')}${tage < MESSREGEL_TAGE ? ` (Messregel: ${MESSREGEL_TAGE} Tage)` : ''}`
    : '';
  const link = post.link
    ? `<a href="${esc(post.link)}" target="_blank" rel="noopener" class="table-link">Zum Post</a>`
    : '<span class="auswertung-panel__muted">Kein Link hinterlegt</span>';
  return `
    <p class="auswertung-panel__text">
      ${plattformLabel(post.plattform, { lang: true })}
      ${post.accountHandle ? `<span class="auswertung-panel__muted">${esc(post.accountHandle)}</span>` : ''}
    </p>
    <p class="auswertung-panel__text">Gepostet am ${esc(datum(post.postedAt))}${messung ? ` · ${esc(messung)}` : ''} · ${link}</p>`;
}

/**
 * @param {object} opts
 * @param {object} opts.post
 * @param {object} opts.einheit
 * @param {boolean} opts.team
 * @param {Map<string, Promise<string|null>>} opts.posterCache - aus der Tabelle
 * @param {HTMLElement} [opts.zurueck] - bekommt nach dem Schließen den Fokus
 * @param {(post: object) => void} [opts.onErfassen]
 * @param {(einheit: object, post: object) => void} [opts.onVideoTab]
 */
export function oeffnePostPanel({ post, einheit, team, posterCache, zurueck = null, onErfassen, onVideoTab }) {
  const abort = new AbortController();
  const datei = postDatei(einheit, post);
  const kontext = [einheit?.produktion?.name, einheit?.creator?.name, dateiLabel(einheit, post.dateiId)].filter(Boolean).join(' · ');
  const aktionen = team
    ? `<div class="drawer-footer">
        <button type="button" class="mdc-btn mdc-btn--secondary" data-panel-aktion="video">Im Video-Tab öffnen</button>
        <button type="button" class="mdc-btn" data-panel-aktion="erfassen">Zahlen bearbeiten</button>
      </div>`
    : '';

  const handle = openDrawer({
    id: DRAWER_ID,
    title: esc(einheit?.titel || einheit?.label || 'Post'),
    subtitle: esc(kontext),
    panelClass: 'auswertung-post-drawer',
    resizable: false,
    onClose: () => {
      abort.abort();
      if (zurueck?.isConnected) zurueck.focus({ preventScroll: true });
    },
    body: `
      <div class="auswertung-panel">
        <div class="auswertung-panel__held">
          <span class="auswertung-poster auswertung-poster--gross" data-panel-poster></span>
          <div>
            <div class="auswertung-panel__aufrufe">${esc(kompakt(post.metrics?.views))}</div>
            <div class="auswertung-panel__muted">Aufrufe · ${esc(prozent(engagementRate([post])))} Engagement-Rate</div>
          </div>
        </div>
        ${eckdaten(post)}
        <h4 class="drawer-section-title">Kennzahlen</h4>
        ${kennzahlenListe(post)}
        <h4 class="drawer-section-title">Herkunft</h4>
        ${herkunft(post, { team })}
      </div>`
  });

  if (aktionen) handle.body.insertAdjacentHTML('afterend', aktionen);
  handle.panel.setAttribute('aria-modal', 'true');
  handle.panel.setAttribute('aria-label', `Post ${einheit?.label || ''}`.trim());

  const slot = handle.panel.querySelector('[data-panel-poster]');
  posterCache?.get(datei?.id)?.then((url) => {
    if (!url || !slot?.isConnected) return;
    const img = document.createElement('img');
    img.alt = '';
    img.src = url;
    slot.replaceChildren(img);
  });
  void fuelleVorschauen(handle.panel.querySelector('[data-panel-shots]'), post.screenshotPfade);

  handle.panel.addEventListener('click', (e) => {
    const aktion = e.target.closest('[data-panel-aktion]')?.dataset.panelAktion;
    if (!aktion) return;
    handle.close();
    if (aktion === 'erfassen') onErfassen?.(post);
    if (aktion === 'video') onVideoTab?.(einheit, post);
  }, { signal: abort.signal });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    e.preventDefault();
    handle.close();
  }, { signal: abort.signal, capture: true });

  handle.panel.querySelector('.drawer-close-btn')?.focus({ preventScroll: true });
  return handle;
}
