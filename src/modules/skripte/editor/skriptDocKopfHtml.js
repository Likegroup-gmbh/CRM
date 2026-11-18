// skriptDocKopfHtml.js
// Doc-Kopf: Aktions-Buttons, Vorgaben-Panel und Persona-Wahl.

import { skripteService, FUNNEL_STUFEN, VIDEO_LAENGEN, SKRIPT_BEREICHE } from '../SkripteService.js';
import { funnelAbweichungsHinweis } from '../../strategie/strategieFunnelOptions.js';
import { formatVideoLaengeSchluessel } from '../../briefing/videolaenge.js';
import { escapeHtml } from '../SkripteUtils.js';
import { icon } from '../../../core/icons/IconSystem.js';
import { renderToolbarMenu } from '../../../core/components/ToolbarMenu.js';
import { tauschSkriptButtonHtml } from './skriptTauschBanner.js';

function menuItemHtml(id, label, iconName, title, { danger = false } = {}) {
  return `
    <button type="button" class="action-item${danger ? ' action-danger' : ''}" id="${id}" role="menuitem" title="${escapeHtml(title)}">
      ${iconName ? icon(iconName) : ''}
      ${escapeHtml(label)}
    </button>`;
}

/** Selten genutzte Aktionen hinter "…": PDF, Link, Teilen, Creator tauschen, Löschen. */
function kopfMenuHtml({ kannPdf, kannTeilen, kannTauschen, kannLoeschen }) {
  const items = [
    kannPdf ? menuItemHtml('ed-pdf', 'PDF herunterladen', 'pdf', 'Skript als PDF') : '',
    kannTeilen ? menuItemHtml('ed-copy-link', 'Link kopieren', 'link', 'Adresse für ein Kundenkonto kopieren') : '',
    kannTeilen ? menuItemHtml('ed-share', 'Skripte dieses Creators teilen', 'share-alt', 'Freigegebene Skripte dieses Creators teilen') : '',
    kannTauschen ? tauschSkriptButtonHtml() : ''
  ].filter(Boolean);
  if (kannLoeschen) {
    if (items.length) items.push('<div class="action-separator"></div>');
    items.push(menuItemHtml('ed-loeschen', 'Löschen', 'trash', 'Skript löschen', { danger: true }));
  }
  if (!items.length) return '';
  return renderToolbarMenu({
    toggleId: 'ed-kopf-menu',
    toggleIcon: icon('dots-vertical-filled'),
    itemsHtml: items.join('')
  });
}

/**
 * Doc-Kopf: Version, Status, Senden und Creator sichtbar, der Rest im "…"-Menü.
 * Mit statusWahlHtml (Team) ersetzt die Status-Wahl das Freigegeben-Badge.
 */
export function docHeadActionsHtml({
  kannTeilen = false, kannAnschreiben = null, kannPdf = false, kannZurueck = false, kannFreigeben = false,
  kannLoeschen = false, kannTauschen = false, status = '', statusWahlHtml = '', verknuepfungenHtml = ''
} = {}) {
  const senden = kannAnschreiben == null ? kannTeilen : kannAnschreiben;
  const freigabeBadge = !statusWahlHtml && status === 'freigegeben'
    ? `<span class="skripte-badge skripte-badge--success" title="Vom Kunden freigegeben">Freigegeben</span>`
    : '';
  const freigebenBtn = kannFreigeben ? `
    <button type="button" class="mdc-btn skripte-editor-share-btn" id="ed-freigeben"
      title="Skript freigeben">
      <span class="mdc-btn__icon">${icon('check')}</span>
      <span class="mdc-btn__label">Freigeben</span>
    </button>` : '';
  return `
    <div class="skripte-editor-version" id="ed-version-wrap"></div>
    ${kannZurueck ? `
    <button type="button" class="mdc-btn mdc-btn--secondary skripte-editor-share-btn" id="ed-zurueck">
      <span class="mdc-btn__label">Zurück</span>
    </button>` : ''}
    ${statusWahlHtml}
    ${freigabeBadge}
    ${freigebenBtn}
    ${verknuepfungenHtml}
    ${senden ? `
    <button type="button" class="mdc-btn mdc-btn--secondary skripte-editor-share-btn" id="ed-anschreiben"
      title="Skript per E-Mail senden">
      <span class="mdc-btn__icon">${icon('anschreiben')}</span>
      <span class="mdc-btn__label">Senden</span>
    </button>` : ''}
    ${kopfMenuHtml({ kannPdf, kannTeilen, kannTauschen, kannLoeschen })}
  `;
}

function linkHtml(url) {
  if (!/^https?:\/\//i.test(String(url).trim())) return escapeHtml(String(url));
  const u = escapeHtml(String(url).trim());
  return `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`;
}

/** String hat String.prototype.link — das ist keine URL, sondern die native Methode. */
function vorgabeWertHtml(wert) {
  if (wert && typeof wert === 'object' && typeof wert.link === 'string') return linkHtml(wert.link);
  return escapeHtml(String(wert));
}

/**
 * Skript ohne Persona, Briefing mit Personas: Auswahl statt stiller Lücke.
 * Ohne Persona fehlen Pain und Produkt im Kontext jedes Edits.
 */
export function personaWahlHtml(skript) {
  const optionen = skript?.persona_optionen;
  if (skript?.persona_id || !optionen?.length) return '';
  return `
    <p class="skripte-hint skripte-hint--warnung" data-persona-fehlt>
      Keine Persona verknüpft. Liky kennt Pain und Produkt erst, wenn sie gesetzt ist.
      <select class="form-input skripte-editor-persona-wahl" data-persona-setzen aria-label="Persona wählen">
        <option value="">Persona wählen…</option>
        ${optionen.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(skripteService.personaLabel(p))}</option>`).join('')}
      </select>
    </p>
  `;
}

/** Info: mit welchen Vorgaben das Skript generiert wurde (plus Persona-Wahl, wenn sie fehlt). */
export function vorgabenPanelHtml(skript, { kannPersonaSetzen = false } = {}) {
  const s = skript;
  if (!s) return '';
  const briefingName = s.briefing?.aktivierung_name
    || s.prompt_kontext?.briefing_name
    || s.prompt_kontext?.generator_payload?.briefing_name
    || s.prompt_kontext?.briefing_pdf?.name
    || s.prompt_kontext?.generator_payload?.briefing_pdf?.name
    || null;
  // Videovorlage: nach der Generierung top-level Snapshot, davor im Payload
  const referenz = s.prompt_kontext?.referenz_video
    || s.prompt_kontext?.generator_payload?.referenz_video || null;
  const referenzInfo = referenz ? [
    referenz.platform === 'tiktok' ? 'TikTok' : referenz.platform === 'instagram' ? 'Instagram' : null,
    referenz.author_name ? `@${referenz.author_name}` : null,
    referenz.duration_seconds ? `${Math.round(referenz.duration_seconds)}s` : null
  ].filter(Boolean).join(' · ') : null;
  const transkriptAuszug = referenz?.transkript_verwendet
    ? (referenz.transkript_verwendet.length > 220
      ? `${referenz.transkript_verwendet.slice(0, 220)}…`
      : referenz.transkript_verwendet)
    : null;
  const genPayload = s.prompt_kontext?.generator_payload || {};
  const zeilen = [
    ['Unternehmen', s.unternehmen?.firmenname],
    ['Briefing', briefingName],
    ['Videovorlage', referenzInfo],
    ['Video-URL', referenz?.url ? { link: referenz.url } : null],
    ['Vorlage-Transkript', transkriptAuszug],
    ['Marke', s.marke?.markenname],
    ['Kampagne', s.kampagne?.eigener_name || s.kampagne?.kampagnenname],
    ['Produkt', s.produkt?.name],
    ['Persona', s.personas ? skripteService.personaLabel(s.personas) : null],
    ['Branche', s.branchen?.name],
    ['Bereich', s.bereich ? (SKRIPT_BEREICHE[s.bereich] || s.bereich) : null],
    ['Regie-Modus', s.prompt_kontext?.modus || s.prompt_kontext?.generator_payload?.modus || null],
    ['Video-Länge', s.video_laenge ? (VIDEO_LAENGEN[s.video_laenge] || formatVideoLaengeSchluessel(s.video_laenge) || s.video_laenge) : null],
    ['Funnel-Stufe', s.funnel_stufe ? (FUNNEL_STUFEN[s.funnel_stufe] || s.funnel_stufe) : null],
    ['Tonalität', s.tonalitaet],
    ['Video-Idee', s.video_idee],
    ['Location', s.location],
    ['Regieanweisung', s.regieanweisung],
    ['Rezept unter dem CTA', genPayload.mit_rezept ? 'Ja' : null],
    ['Text-Hook', genPayload.mit_text_hook ? 'Ja' : null],
    ['Caption', genPayload.mit_caption ? 'Ja' : null]
  ].filter(([, wert]) => wert);

  const funnelHinweis = funnelAbweichungsHinweis(s);
  const personaWahl = kannPersonaSetzen ? personaWahlHtml(s) : '';
  if (!zeilen.length && !funnelHinweis && !personaWahl) return '';

  return `
    <div class="skripte-editor-vorgaben-wrap">
      ${funnelHinweis ? `<p class="skripte-hint skripte-hint--warnung" data-funnel-abweichung>${escapeHtml(funnelHinweis)}</p>` : ''}
      ${personaWahl}
      <details class="skripte-editor-vorgaben">
        <summary>Vorgaben aus dem Generator</summary>
        <dl class="skripte-editor-vorgaben-grid">
          ${zeilen.map(([label, wert]) => `
            <div class="skripte-editor-vorgaben-zeile">
              <dt>${escapeHtml(label)}</dt>
              <dd>${vorgabeWertHtml(wert)}</dd>
            </div>
          `).join('')}
        </dl>
      </details>
    </div>
  `;
}
