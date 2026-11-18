// auswertungScreenshots.js
// Screenshots eines Posts ansehen (Spec 7.5 links, Detail-Panel fürs Team). Der Bucket ist privat,
// die Bilder kommen über Signed URLs; die bleiben je Pfad kurz im Speicher, damit Blättern und
// Neu-Zeichnen nicht jedes Mal signieren.

import { icon } from '../../core/icons/IconSystem.js';
import { screenshotUrls } from './auswertungPostsSpeichern.js';
import { esc, plural } from './auswertungFormat.js';
import { schrittLabel } from './auswertungKiLauf.js';

// Kürzer als die Gültigkeit der URL (1 h), damit nie eine abgelaufene im Bild steht
const HALTBAR_MS = 45 * 60 * 1000;
const cache = new Map();

async function urlsFuer(pfade) {
  const jetzt = Date.now();
  const fehlen = pfade.filter(p => !(cache.get(p)?.bis > jetzt));
  if (fehlen.length) {
    const urls = await screenshotUrls(fehlen);
    fehlen.forEach((p, i) => { if (urls[i]) cache.set(p, { url: urls[i], bis: jetzt + HALTBAR_MS }); });
  }
  return pfade.map(p => cache.get(p)?.url).filter(Boolean);
}

/** Platzhalter der linken Spalte; `fuelleScreenshots` hängt die Bilder ein. */
export function renderScreenshotSpalte(post) {
  if (!post?.screenshots && post?.kiStatus !== 'laeuft') return '';
  const liest = post.kiStatus === 'laeuft'
    ? `<div class="erfassen-shots__liest"><span class="erfassen-status__puls" aria-hidden="true"></span>${esc(schrittLabel(post.kiSchritt))}</div>`
    : '';
  return `
    <div class="erfassen-shots" data-erfassen-shots data-index="0">
      <div class="erfassen-shots__bild" data-erfassen-shot-bild>${icon('photo', { size: 20 })}</div>
      ${liest}
      <div class="erfassen-shots__fuss" data-erfassen-shot-fuss hidden></div>
    </div>`;
}

function zeigeBild(slot, urls) {
  const index = Math.min(Math.max(0, Number(slot.dataset.index) || 0), urls.length - 1);
  slot.dataset.index = String(index);
  const bild = slot.querySelector('[data-erfassen-shot-bild]');
  const url = urls[index];
  bild.innerHTML = `<a href="${esc(url)}" target="_blank" rel="noopener" title="In voller Größe öffnen"><img src="${esc(url)}" alt="Screenshot ${index + 1} von ${urls.length}" decoding="async"></a>`;
  const fuss = slot.querySelector('[data-erfassen-shot-fuss]');
  if (urls.length < 2) {
    fuss.hidden = true;
    return;
  }
  fuss.hidden = false;
  fuss.innerHTML = `
    <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-erfassen-blaettern="-1" aria-label="Voriger Screenshot"${index === 0 ? ' disabled' : ''}>${icon('chevron-left', { size: 14 })}</button>
    <span>${index + 1} / ${urls.length} · ${esc(plural(urls.length, 'Screenshot', 'Screenshots'))} zusammengeführt</span>
    <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-erfassen-blaettern="1" aria-label="Nächster Screenshot"${index === urls.length - 1 ? ' disabled' : ''}>${icon('chevron-right', { size: 14 })}</button>`;
}

/** Bilder in die Spalte laden. Ein Fehler lässt das Icon stehen. */
export async function fuelleScreenshots(slot, post) {
  const pfade = post?.screenshotPfade || [];
  if (!slot || !pfade.length) return;
  try {
    const urls = await urlsFuer(pfade);
    if (!slot.isConnected || !urls.length) return;
    slot._urls = urls;
    slot.dataset.index = String(urls.length - 1);
    zeigeBild(slot, urls);
  } catch (error) {
    console.warn('Auswertung: Screenshots nicht ladbar', error?.message || error);
  }
}

export function blaettere(slot, schritt) {
  if (!slot?._urls?.length) return;
  slot.dataset.index = String((Number(slot.dataset.index) || 0) + schritt);
  zeigeBild(slot, slot._urls);
}

/** Vorschaubilder fürs Detail-Panel, jedes öffnet in voller Größe. */
export async function fuelleVorschauen(slot, pfade) {
  if (!slot || !pfade?.length) return;
  try {
    const urls = await urlsFuer(pfade);
    if (!slot.isConnected) return;
    slot.innerHTML = urls.map((url, i) => `
      <a class="auswertung-panel__shot" href="${esc(url)}" target="_blank" rel="noopener" title="Screenshot ${i + 1} öffnen">
        <img src="${esc(url)}" alt="Screenshot ${i + 1}" decoding="async">
      </a>`).join('');
  } catch (error) {
    slot.textContent = 'Screenshots konnten nicht geladen werden.';
    console.warn('Auswertung: Vorschauen nicht ladbar', error?.message || error);
  }
}
