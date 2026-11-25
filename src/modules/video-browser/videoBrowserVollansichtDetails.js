// videoBrowserVollansichtDetails.js
// Details-Spalte der Vollansicht im Stil von Attio/Notion: oben das Video mit seinen Verknüpfungen
// (Creator, Kooperation, Linie, Videoidee mit Konzept, Skript, Produkt) und dem Posting-Datum,
// darunter die Datei (Status, Tags, Verlauf, Runde, Format, Caption aus videoBrowserRenderTabs.js).
// Die Kundenseite sieht weniger: Creator ohne Link, Skript als Pill ohne Ziel, keine Videoidee.
// Links tragen `data-vb-voll-link`: die Vollansicht schließt und die App navigiert dorthin.

import { escapeHtml as esc } from '../../core/format.js';
import { CustomDatePicker } from '../../core/components/CustomDatePicker.js';
import { renderVerknuepfungPill, renderVerknuepfungPillStatisch } from '../../core/ui/verknuepfungPill.js';
import { skriptFlowUrlSync } from '../skripte/skriptFlowZiel.js';
import { formatDatum } from './videoBrowserFormat.js';
import { detailsPanelHtml, propHtml } from './videoBrowserRenderTabs.js';
import { captionFieldHtml } from './videoBrowserCaption.js';
import { skriptStatusHtml } from './videoBrowserRenderShowcase.js';
import { fristTagHtml } from './videoBrowserDeadline.js';

const IDEE_MAX = 80;
const LEER = '<span class="vb-voll-prop__empty">–</span>';

const link = (kind, label, href) => (label && href
  ? renderVerknuepfungPill({ kind, label, href, attrs: 'data-vb-voll-link' })
  : '');

const statisch = (kind, label) => renderVerknuepfungPillStatisch({ kind, label });

const virtuellHint = (on) => (on
  ? '<span class="vb-voll-prop__hint" title="Zugeordnet über den Creator, am Video nicht gespeichert">automatisch</span>'
  : '');

const kurz = (text) => (text.length > IDEE_MAX ? `${text.slice(0, IDEE_MAX - 1)}…` : text);

function skriptHtml(ctx, links) {
  const skript = links.skript;
  if (!skript) return LEER;
  const label = skript.titel || 'Skript';
  const pill = ctx.team
    ? link('skripte', label, skriptFlowUrlSync({ produktionId: ctx.produktionId, skript: { id: skript.id, briefing_id: skript.briefingId } }) || `/skripte/${skript.id}`)
    : statisch('skripte', label);
  return `<span class="vb-voll-prop__stack">${pill}${skriptStatusHtml(skript)}${ctx.team ? virtuellHint(links.skriptVirtuell) : ''}</span>`;
}

function postingHtml(ctx, row) {
  if (!ctx.canUpload) return row.postingDatum ? esc(formatDatum(row.postingDatum)) : LEER;
  return `<div class="vb-voll-prop__date" data-vb-voll-posting>${CustomDatePicker.render({
    id: row.id,
    entity: 'video',
    field: 'posting_datum',
    value: row.postingDatum || '',
    label: 'Posting-Datum',
    variant: 'text'
  })}</div>`;
}

/** Datum der Content-Deadline, bei einem Ausstehenden Video mit Frist-Tag (dort zählt der Verzug). */
function deadlineHtml(row, ausstehend) {
  const tag = ausstehend ? fristTagHtml(row.contentDeadline) : '';
  return `<span class="vb-voll-prop__stack">${esc(formatDatum(row.contentDeadline))}${tag}</span>`;
}

/** Eigenschaften des Videos (gilt auch für ein Ausstehendes Video). */
export function videoPropsHtml(ctx) {
  const { koop, row } = ctx.resolved;
  const links = row.links || {};
  const rows = [];
  const team = ctx.team;

  rows.push(propHtml('Creator', 'creator', team && koop.creatorId
    ? link('creator', koop.name, `/creator/${koop.creatorId}`)
    : statisch('creator', koop.name)));
  if (team) rows.push(propHtml('Kooperation', 'users', link('kooperation', koop.kooperationName || koop.name, `/kooperation/${koop.id}`)));
  if (koop.linie) {
    rows.push(propHtml('Linie', 'briefing', team
      ? link('briefing', koop.linieName, `/briefing/${koop.linieId}`)
      : statisch('briefing', koop.linieName)));
  }
  if (team) {
    const idee = links.idee;
    const ideeHtml = idee?.strategieId
      ? `<span class="vb-voll-prop__stack">${link('videoidee', kurz(idee.beschreibung || 'Videoidee'), `/konzepte/${idee.strategieId}`)}${virtuellHint(links.ideeVirtuell)}</span>`
      : (idee ? esc(kurz(idee.beschreibung || 'Videoidee')) : LEER);
    rows.push(propHtml('Videoidee', 'videoidee', ideeHtml));
  }
  rows.push(propHtml('Skript', 'skript', skriptHtml(ctx, links)));
  const produkt = links.idee?.produkt;
  if (team) rows.push(propHtml('Produkt', 'cube', produkt ? link('produkt', produkt.name, `/produkt/${produkt.id}`) : LEER));
  rows.push(propHtml('Posting-Datum', 'calendar', postingHtml(ctx, row)));
  if (team && row.contentDeadline) rows.push(propHtml('Content-Deadline', 'clock', deadlineHtml(row, !ctx.resolved.item)));

  return `<dl class="vb-props vb-voll-props">${rows.join('')}</dl>`;
}

/** Ganze Spalte: Video, dann Datei. Ohne Datei (Ausstehend) nur die Caption des Videos. */
export function vollDetailsHtml(ctx) {
  const { row, item } = ctx.resolved;
  const datei = item
    ? `<section class="vb-voll-section" aria-label="Datei">
        <h5 class="vb-detail__eyebrow">Datei</h5>
        ${detailsPanelHtml({ ...ctx, ohneAdManager: true })}
      </section>`
    : captionFieldHtml(row, { editable: ctx.canEditCaption, open: ctx.captionOpen?.has(row.id), scope: '' });
  return `
    <section class="vb-voll-section" aria-label="Video">
      <h5 class="vb-detail__eyebrow">${esc(row.label)}</h5>
      ${videoPropsHtml(ctx)}
    </section>
    ${datei}`;
}
