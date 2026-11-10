// skriptDocTabelleHtml.js
// Skript-Tabelle (gesagt | zu sehen, Rezept, Caption) und Hook-Varianten.

import { escapeHtml } from '../SkripteUtils.js';
import { renderInlineMd } from '../../../core/utils/inlineFormat.js';
import { icon } from '../../../core/icons/IconSystem.js';
import {
  SEKTION_LABELS_KURZ, VISUELL_FIELD, HOOK_VARIANTE_FELDER, GRID_MD
} from './skriptEditorKonstanten.js';
import { visuellGuardGrund, visuellVorgaengerTitle } from './skriptEditorVisuellHelfer.js';

/** Grid-Zelle: Fett/Kursiv/Code und Hervorhebung. */
function gridMd(raw) {
  return renderInlineMd(raw, GRID_MD);
}

export function gridTabelleHtml({ skript, grid, messages, isReadonly }) {
  // Aufbau-Optionen aus der Generierung: Flag im Payload ODER bereits
  // vorhandener Inhalt zeigt die Zeile/den Block (leer = manuell fuellbar).
  const genPayload = skript?.prompt_kontext?.generator_payload || {};
  const zeigeTextHook = Boolean(genPayload.mit_text_hook) || Boolean((skript?.text_hook || '').trim());
  const zeigeRezept = Boolean(genPayload.mit_rezept) || Boolean((skript?.rezept || '').trim());
  const zeigeCaption = Boolean(genPayload.mit_caption) || Boolean((skript?.caption || '').trim());
  // Hook-Sperre (ADR 0054): Status aus der Videoidee, nur fuers Team
  const zeigeHookSperre = Boolean(skript?.strategie_item?.hook_gesperrt)
    && !window.isKunde?.() && !window.isGast?.();
  return `
    <div class="skripte-editor-doc-box">
      <table class="skripte-editor-tabelle">
        <colgroup>
          <col class="skripte-editor-tabelle-col--label">
          <col>
          <col>
        </colgroup>
        <thead>
          <tr>
            <th scope="col"></th>
            <th scope="col">Was gesagt wird</th>
            <th scope="col">Was zu sehen ist</th>
          </tr>
        </thead>
        <tbody>
        ${['hook', 'hauptteil', 'cta'].map((sektion) => {
          const visuellFeld = VISUELL_FIELD[sektion];
          const visuellText = grid[visuellFeld] || '';
          const gesprochen = grid[sektion] || '';
          const visuellGrund = visuellGuardGrund(
            { ...skript, ...grid },
            sektion,
            { readonly: isReadonly, messages }
          );
          const visuellTitle = visuellGrund === 'vorgaenger'
            ? visuellVorgaengerTitle(sektion)
            : 'Was zu sehen ist per KI generieren';
          const textHookBlock = sektion === 'hook' && zeigeTextHook ? `
              <div class="skripte-editor-text-hook">
                <span class="skripte-editor-text-hook-label">Text-Hook</span>
                <div class="skripte-editor-sektion-visual skripte-editor-text-hook-text" data-sektion="text_hook" data-feld="text_hook" data-placeholder="On-Screen-Text im Hook…">${gridMd(skript.text_hook || '').html}</div>
              </div>` : '';
          return `
          <tr data-sektion="${sektion}">
            <th scope="row">${SEKTION_LABELS_KURZ[sektion]}${sektion === 'hook' && zeigeHookSperre ? `
              <span class="skripte-editor-hook-sperre" title="Hook gesperrt: Der Kunde hat ihn freigegeben, Liky ändert ihn nicht. Das Schloss öffnest du am Konzept." aria-label="Hook gesperrt">${icon('lock-closed')}</span>` : ''}</th>
            <td>
              <div class="skripte-editor-sektion-text" data-sektion="${sektion}" data-feld="${sektion}">${gridMd(gesprochen).html}</div>
            </td>
            <td class="skripte-editor-tabelle-zelle--visual">
              ${textHookBlock}
              ${isReadonly ? '' : `
              <button class="skripte-editor-visual-btn" data-sektion="${sektion}"
                title="${escapeHtml(visuellTitle)}"
                ${visuellGrund ? 'disabled' : ''}>
                ${icon('ai-visual')}
              </button>
              `}
              <div class="skripte-editor-sektion-visual" data-sektion="${sektion}" data-feld="${visuellFeld}">${gridMd(visuellText).html}</div>
            </td>
          </tr>
        `;
        }).join('')}
        ${zeigeRezept ? `
          <tr data-sektion="rezept" class="skripte-editor-tabelle-zusatz">
            <th scope="row">Rezept</th>
            <td colspan="2">
              <div class="skripte-editor-sektion-text" data-sektion="rezept" data-feld="rezept" data-placeholder="Rezept aus der Caption…">${gridMd(skript.rezept || '').html}</div>
            </td>
          </tr>` : ''}
        ${zeigeCaption ? `
          <tr data-sektion="caption" class="skripte-editor-tabelle-zusatz">
            <th scope="row">Caption</th>
            <td colspan="2">
              <div class="skripte-editor-sektion-text" data-sektion="caption" data-feld="caption" data-placeholder="Caption für den Post…">${gridMd(skript.caption || '').html}</div>
            </td>
          </tr>` : ''}
        </tbody>
      </table>
    </div>
  `;
}

export function hookVariantenTabelleHtml({ skript }) {
  return `
    <div class="skripte-editor-doc-box skripte-editor-hook-varianten">
      <h2 class="skripte-editor-hook-varianten-titel">Hook-Varianten</h2>
      <table class="skripte-editor-tabelle skripte-editor-tabelle--varianten">
        <colgroup>
          <col class="skripte-editor-tabelle-col--label">
          <col>
        </colgroup>
        <thead>
          <tr>
            <th scope="col"></th>
            <th scope="col">Was gesagt wird</th>
          </tr>
        </thead>
        <tbody>
        ${HOOK_VARIANTE_FELDER.map((feld, i) => {
          const text = skript[feld] || '';
          return `
          <tr data-sektion="${feld}">
            <th scope="row">${SEKTION_LABELS_KURZ[feld] || `Hook ${i + 1}`}</th>
            <td>
              <div class="skripte-editor-sektion-text" data-sektion="${feld}" data-feld="${feld}">${gridMd(text).html}</div>
            </td>
          </tr>
        `;
        }).join('')}
        </tbody>
      </table>
    </div>
  `;
}
