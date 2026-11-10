// SkriptEditorDocRenderer.js
// Reine Renderer fuer die Editor-Mitte: Neu-Modus (Generator), Rueckfragen-
// Phase und das eigentliche Skript-Dokument (Hook/Hauptteil/CTA + Visual).
// Alles pure Funktionen: State rein, HTML-String raus.
// Teile: skriptDocCreatorHtml (Creator, Chips), skriptDocTabelleHtml (Grid),
// skriptDocKopfHtml (Aktionen, Vorgaben); hier re-exportiert.

import { skripteService } from '../SkripteService.js';
import { escapeHtml } from '../SkripteUtils.js';
import { skriptNrLabel } from '../skriptNummern.js';
import { istMasterSkript, renderMasterMarkdownHtml } from '../master/skriptMasterFormat.js';
import {
  hatGridInhalt, hatZusatzInfos, gridFelderFuerSkript, zusatzInfosMarkdown
} from '../master/skriptCreatorFacing.js';
import { renderToolbarListenKopf } from '../../../core/components/ToolbarMenu.js';
import { SEKTION_LABELS_KURZ, hatHookVarianten } from './skriptEditorKonstanten.js';
import { tauschBannerHtml } from './skriptTauschBanner.js';
import { dokumentHtml } from './dokument/blockRenderer.js';
import { gridTabelleHtml, hookVariantenTabelleHtml } from './skriptDocTabelleHtml.js';

export {
  konzeptCreatorFromSkript, creatorsFuerListe, sortListeSkripte, creatorsFuerKopf,
  listeCreatorHtml, listeVideoHtml, verknuepfungenHtml
} from './skriptDocCreatorHtml.js';
export { docHeadActionsHtml, personaWahlHtml, vorgabenPanelHtml } from './skriptDocKopfHtml.js';

function titelZelleHtml(skript) {
  return `<div class="skripte-editor-titel skripte-editor-sektion-text" data-sektion="titel" data-feld="titel" data-placeholder="Skript-Titel">${escapeHtml(skript?.titel || '')}</div>`;
}

/** Video-URL der Videoidee: live aus dem Konzept, sonst Snapshot aus dem Generator. */
export function videoIdeeUrl(skript) {
  const url = skript?.strategie_item?.video_link
    || skript?.prompt_kontext?.referenz_video?.url
    || skript?.prompt_kontext?.generator_payload?.referenz_video?.url
    || '';
  return /^https?:\/\//i.test(String(url).trim()) ? String(url).trim() : '';
}

function videoIdeeZeileHtml(skript) {
  if (window.isKunde?.() || window.isGast?.()) return '';
  const url = videoIdeeUrl(skript);
  if (!url) return '';
  const u = escapeHtml(url);
  return `<div class="skripte-editor-videoidee"><span class="skripte-editor-videoidee-label">Video-Idee</span> <a href="${u}" target="_blank" rel="noopener noreferrer" class="skripte-editor-videoidee-link">${u}</a></div>`;
}

function pruefungHtml(skript) {
  const p = skript?.pruefung;
  if (!p) return '';
  const teile = [];
  if (p.laenge && p.laenge.status && p.laenge.status !== 'ok') {
    const richtung = p.laenge.status === 'ueber' ? 'darüber' : 'darunter';
    teile.push(`${p.laenge.worte} Wörter, ${richtung} von ${p.laenge.min}–${p.laenge.max}.`);
  }
  if (p.hook_zeit?.status === 'ueber') {
    teile.push(`Hook ca. ${p.hook_zeit.sekunden} Sek., Vorgabe bis ${p.hook_zeit.max} Sek.`);
  }
  if (Array.isArray(p.claims) && p.claims.length) {
    teile.push(`Verbotene Claims: ${p.claims.join(', ')}.`);
  }
  for (const d of (Array.isArray(p.doppelungen) ? p.doppelungen : []).slice(0, 2)) {
    const [a, b] = (d.zellen || []).map((z) => SEKTION_LABELS_KURZ[z] || z);
    teile.push(`Steht doppelt in ${a} und ${b}: „${d.satz}“`);
  }
  if (!teile.length) return '';
  return `<p class="skripte-editor-pruefung">${escapeHtml(teile.join(' '))}</p>`;
}

/** Logo (Marke, sonst Unternehmen) + Skripttitel – gleiche Klassen wie Strategie/Sourcing. */
function docHeadHtml(skript, extraHtml = '', fallbackName = 'Skript') {
  const marke = skript?.marke;
  const unternehmen = skript?.unternehmen;
  return `
    <div class="skripte-editor-doc-head">
      ${renderToolbarListenKopf({
        name: [skriptNrLabel(skript), skript?.titel].filter(Boolean).join(' · ') || fallbackName,
        logoUrl: marke?.logo_url || unternehmen?.logo_url || '',
        logoAlt: marke?.markenname || unternehmen?.firmenname || 'Logo'
      })}
      ${extraHtml}
    </div>${tauschBannerHtml(skript)}`;
}

/** Rueckfragen-Phase: Vorgaben + Aufbau-Toggles statt (noch leerem) Skript-Inhalt. */
export function fragenModusHtml({ skript, genStatus, docHeadActionsHtml, vorgabenPanelHtml }) {
  const payload = skript?.prompt_kontext?.generator_payload || {};
  const laeuft = Boolean(genStatus?.laeuft);
  const aufbauToggle = (id, flag, label) => `
      <label class="toggle-label" for="${id}">
        <span class="toggle-text">${label}</span>
        <span class="toggle-switch">
          <input type="checkbox" id="${id}" data-aufbau-flag="${flag}"
            ${payload[flag] ? 'checked' : ''} ${laeuft ? 'disabled' : ''}>
          <span class="toggle-slider"></span>
        </span>
      </label>`;
  return `
    ${docHeadHtml(skript, `
      <span class="skripte-badge skripte-badge--info" title="Liky klärt erst offene Fragen, dann wird das Skript geschrieben">Rückfragen</span>
      ${docHeadActionsHtml}
    `, 'Neues Skript')}
    ${vorgabenPanelHtml}
    <div class="skripte-editor-fragen-info">
      <p>Liky prüft die Vorgaben und stellt dir rechts Rückfragen, bevor das Skript geschrieben wird.</p>
      <p class="skripte-hint">Antworte rechts im Chat. Sobald die Rückfragen geklärt sind, startest du die Generierung dort.</p>
    </div>
    <div class="skripte-editor-aufbau">
      ${aufbauToggle('ed-aufbau-rezept', 'mit_rezept', 'Rezept unter dem CTA')}
      ${aufbauToggle('ed-aufbau-text-hook', 'mit_text_hook', 'Text-Hook')}
      ${aufbauToggle('ed-aufbau-caption', 'mit_caption', 'Caption')}
    </div>
  `;
}

/** Neues Format: gerenderte Markdown-Sektionen aus ##-Ueberschriften. */
export function masterDocHtml({ skript, docHeadActionsHtml, vorgabenPanelHtml }) {
  return `
    ${docHeadHtml(skript, docHeadActionsHtml, 'Skript')}
    ${vorgabenPanelHtml}
    <div class="skripte-editor-doc-box skripte-editor-doc-box--md">
      ${renderMasterMarkdownHtml(skript.inhalt_md, escapeHtml)}
    </div>
  `;
}

function docTabsHtml(activeTab) {
  return `
    <div class="tab-navigation skripte-editor-doc-tabs" role="tablist">
      <button type="button" class="tab-button${activeTab === 'skript' ? ' active' : ''}"
        role="tab" data-editor-tab="skript" aria-selected="${activeTab === 'skript'}">Skript</button>
      <button type="button" class="tab-button${activeTab === 'zusatz' ? ' active' : ''}"
        role="tab" data-editor-tab="zusatz" aria-selected="${activeTab === 'zusatz'}">Zusätzliche Infos</button>
    </div>
  `;
}

/**
 * Skript-Dokument (ADR 0062): Kopf + Vorgaben, darunter die Seite mit Titel
 * und den Bloecken; die Skript-Tabelle (gesagt/visual) ist einer davon.
 */
export function skriptDocHtml({
  skript, messages, isReadonly, docHeadActionsHtml, vorgabenPanelHtml, docTab = 'skript',
  zeigeHookVarianten = false, bloeckeEditierbar = false, mitIntern = false,
  bildUrl = (pfad) => skripteService.skriptBildUrl(pfad), toolbarHtml = ''
}) {
  const extraMd = skript.inhalt_md ? zusatzInfosMarkdown(skript.inhalt_md) : '';
  const pruefung = pruefungHtml(skript);
  const showExtra = hatZusatzInfos(skript.inhalt_md) || Boolean(pruefung);
  const showGrid = hatGridInhalt(skript);

  if (istMasterSkript(skript) && !showGrid) {
    return masterDocHtml({ skript, docHeadActionsHtml, vorgabenPanelHtml });
  }

  const grid = showGrid ? gridFelderFuerSkript(skript) : {
    hook: skript.hook, hauptteil: skript.hauptteil, cta: skript.cta,
    hook_visuell: skript.hook_visuell, hauptteil_visuell: skript.hauptteil_visuell,
    cta_visuell: skript.cta_visuell
  };
  const activeTab = showExtra && docTab === 'zusatz' ? 'zusatz' : 'skript';
  const skriptTabelleHtml = gridTabelleHtml({ skript, grid, messages, isReadonly })
    + (zeigeHookVarianten && hatHookVarianten(skript) ? hookVariantenTabelleHtml({ skript }) : '');

  return `
    ${docHeadHtml(skript, docHeadActionsHtml, 'Skript')}
    ${vorgabenPanelHtml}
    ${showExtra ? docTabsHtml(activeTab) : ''}
    <div class="skripte-editor-doc-panel skripte-editor-doc-panel--seite" data-editor-tab-panel="skript"${activeTab === 'zusatz' ? ' hidden' : ''}>
      ${toolbarHtml}
      <div class="skripte-editor-seite-scroll">
        <article class="skripte-editor-seite">
          ${titelZelleHtml(skript)}
          ${videoIdeeZeileHtml(skript)}
          ${dokumentHtml(skript.dokument_bloecke, {
            editierbar: bloeckeEditierbar, mitIntern, bildUrl, skriptTabelleHtml
          })}
        </article>
      </div>
    </div>
    ${showExtra ? `
    <div class="skripte-editor-doc-panel skripte-editor-doc-panel--zusatz" data-editor-tab-panel="zusatz"${activeTab === 'skript' ? ' hidden' : ''}>
      ${pruefung}
      <div class="skripte-editor-doc-box skripte-editor-doc-box--md">
        ${renderMasterMarkdownHtml(extraMd, escapeHtml, { feld: null })}
      </div>
    </div>
    ` : ''}
  `;
}
