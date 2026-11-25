// auswertungQuellen.js
// Die beiden Erfassungswege in der Mitte der Erfassen-Ansicht (ADR 0078): Link zum Post mit „Abrufen“ (Instagram
// Business Discovery, Ergebnis gilt als erfasst) und die Ablage für Insights-Screenshots (Ziehen,
// Cmd+V, Dateiauswahl; die KI liest, das Team prüft). Stories und TikTok kann der Abruf nicht: der
// Link wird trotzdem gespeichert, „Abrufen“ bleibt aus und nennt den Grund.

import { icon } from '../../core/icons/IconSystem.js';
import { plattformAusLink } from './auswertungKonfig.js';
import { esc } from './auswertungFormat.js';

const BILD_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';
const SHORTCODE = /instagram\.com\/(?:[^/]+\/)?(?:reels?|p|tv)\/[A-Za-z0-9_-]+/i;

export const HINWEIS_LINK = 'Instagram liefert Aufrufe, Likes und Kommentare. Der Post gilt danach als erfasst.';

/**
 * Warum „Abrufen“ für diesen Link nicht geht, sonst null. Spiegelt abrufSperre in
 * netlify/functions/post-link-abruf.js, damit der Knopf schon vor dem Klick Bescheid weiß.
 */
export function abrufGrund(link) {
  const text = String(link || '').trim();
  if (!text) return 'Link zum Post einfügen.';
  if (!/^https?:\/\//i.test(text)) return 'Der Link muss mit https:// beginnen.';
  const plattform = plattformAusLink(text);
  if (plattform === 'ig_story') return 'Stories liefert die Instagram-API nicht. Screenshot der Story-Insights einfügen.';
  if (plattform === 'tiktok') return 'TikTok ist nicht angebunden. Screenshot der Insights einfügen.';
  if (!plattform) return 'Abrufen geht nur mit Instagram-Links.';
  if (!SHORTCODE.test(text)) return 'Im Link fehlt der Post (…/reel/… oder …/p/…).';
  return null;
}

/** Gültiger Link, der sich nur nicht abrufen lässt: speichern ja, abrufen nein. */
export const nurSpeichern = (link) => /^https?:\/\/\S+$/i.test(String(link || '').trim()) && Boolean(abrufGrund(link));

const tastenkuerzel = () => (/mac|iphone|ipad/i.test(globalThis.navigator?.platform || globalThis.navigator?.userAgent || '') ? '⌘V' : 'Strg+V');

/**
 * @param {{ einheit: object, post: object|null, status: string }} eintrag
 */
export function renderLinkLeiste(eintrag) {
  const link = eintrag.post?.link || '';
  const grund = link ? abrufGrund(link) : null;
  return `
    <div class="erfassen-quelle">
      <label class="form-label" for="erfassen-link">Link zum Post</label>
      <div class="erfassen-quelle__zeile">
        <input id="erfassen-link" class="form-input" type="url" name="link" value="${esc(link)}" placeholder="https://www.instagram.com/reel/…"
               autocomplete="off" spellcheck="false" data-erfassen-link>
        <button type="button" class="mdc-btn mdc-btn--secondary" data-erfassen-aktion="abrufen"${grund || !link ? ' disabled' : ''}>
          ${icon('arrow-down-tray', { size: 14 })}<span>Abrufen</span>
        </button>
      </div>
      <p class="erfassen-quelle__hinweis" data-erfassen-link-hinweis>${esc(grund || HINWEIS_LINK)}</p>
    </div>`;
}

/**
 * Ablage für Insights-Screenshots. Liegen schon Bilder da, bleibt sie als schmaler Streifen unter dem Bild.
 * @param {{ post: object|null, status: string }} eintrag
 */
export function renderAblage(eintrag) {
  const liest = eintrag.status === 'liest';
  const kompakt = Boolean(eintrag.post?.screenshots);
  return `
    <div class="upload-dropzone erfassen-ablage${liest ? ' is-liest' : ''}${kompakt ? ' erfassen-ablage--kompakt' : ''}" data-erfassen-ablage tabindex="0" role="button"
         aria-label="Insights-Screenshots auswählen">
      <div class="dropzone-content">
        ${icon('photo', { size: 20 })}
        <p class="dropzone-text">${kompakt ? 'Weiteren Screenshot' : 'Insights-Screenshots'} hier ablegen, mit ${tastenkuerzel()} einfügen oder <span class="dropzone-browse-btn">auswählen</span>${kompakt ? '' : ', gern mehrere auf einmal'}</p>
        <p class="dropzone-hint">PNG, JPG, WebP oder GIF bis 10 MB, bis zu 6 je Post. Ein später nachgelegter Screenshot wird mit den vorigen zusammen neu gelesen.</p>
      </div>
      <input type="file" accept="${BILD_ACCEPT}" multiple hidden data-erfassen-datei>
    </div>`;
}

/** Knopf und Hinweis beim Tippen nachziehen. */
export function aktualisiereLinkHinweis(root, link) {
  const grund = abrufGrund(link);
  const knopf = root?.querySelector('[data-erfassen-aktion="abrufen"]');
  if (knopf) knopf.disabled = Boolean(grund);
  const hinweis = root?.querySelector('[data-erfassen-link-hinweis]');
  if (!hinweis) return;
  const leer = !String(link || '').trim();
  hinweis.textContent = leer ? HINWEIS_LINK : grund || HINWEIS_LINK;
}

/** Bilder aus einem Paste- oder Drop-Event, nur echte Dateien. */
export function bilderAus(transfer) {
  const files = [...(transfer?.files || [])];
  if (files.length) return files.filter(f => f.type?.startsWith('image/'));
  return [...(transfer?.items || [])]
    .filter(item => item.kind === 'file' && item.type?.startsWith('image/'))
    .map(item => item.getAsFile())
    .filter(Boolean);
}

/** Enthält ein Drag Dateien? (Beim dragover sind die Dateien selbst noch nicht lesbar.) */
export const ziehtDateien = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
