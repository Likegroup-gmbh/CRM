// videoBrowserRenderTags.js
// HTML der Tags im Videos-Tab: Chips, Tag-Feld im Detail (Team bearbeitet, Kunde liest) und die
// kurze Textfassung für die Meta-Zeile der Spaltenliste.

import { icon } from '../../core/icons/IconSystem.js';
import { escapeHtml as esc } from '../../core/format.js';
import { tagHint } from './videoBrowserTagLogic.js';

/** Labels der Tags einer Datei in Vergabereihenfolge. */
export function tagsOf(item, catalog) {
  const byId = new Map((catalog || []).map(t => [t.id, t]));
  return (item?.tagIds || []).map(id => byId.get(id)).filter(Boolean);
}

/** "Persona A, TikTok +1" für die Meta-Zeile der Liste: zwei Namen, der Rest als Zahl. */
export function tagMetaText(item, catalog, max = 2) {
  const tags = tagsOf(item, catalog);
  if (!tags.length) return '';
  const shown = tags.slice(0, max).map(t => t.label).join(', ');
  return tags.length > max ? `${shown} +${tags.length - max}` : shown;
}

export function tagChipHtml(tag, { removable = false } = {}) {
  const remove = removable
    ? `<button type="button" class="tag-remove" data-vb-tag-remove="${esc(tag.id)}" aria-label="Tag „${esc(tag.label)}“ entfernen">×</button>`
    : '';
  return `<span class="tag vb-tag" data-tag-id="${esc(tag.id)}"><span class="vb-tag__label">${esc(tag.label)}</span>${remove}</span>`;
}

/** "+ Tag"-Knopf, der die Combobox öffnet. Sitzt im Slot des Tag-Feldes, auch nach dem Schließen der Combobox. */
export function tagTriggerHtml() {
  return `<button type="button" class="vb-tag-trigger" data-vb-tag-open aria-label="Tag hinzufügen (T)" title="Tag hinzufügen (T)">${icon('plus')}<span>Tag</span></button>`;
}

/** Inhalt des Tag-Feldes ohne den äußeren Rahmen, damit der Controller ihn gezielt ersetzen kann. */
export function tagFieldInnerHtml(item, catalog, { editable }) {
  const chips = tagsOf(item, catalog).map(tag => tagChipHtml(tag, { removable: editable })).join('');
  if (!editable) return `<div class="vb-tagfield__row" data-vb-tag-chips>${chips}</div>`;
  return `
    <div class="vb-tagfield__row" data-vb-tag-chips>${chips}</div>
    <span class="vb-tagfield__slot" data-vb-tag-slot>${tagTriggerHtml()}</span>`;
}

/**
 * Tag-Feld der Datei. Nur Dateien mit Variante tragen Tags (Rohmaterial und direkt hochgeladene
 * Finale ohne Quelle nicht). Kunden sehen die Tags, ändern sie aber nicht, ohne Tags fehlt die Zeile.
 */
export function tagFieldHtml(ctx, item) {
  if (!item?.variantKey) return '';
  const catalog = ctx.tagCatalog || [];
  const editable = !!ctx.canUpload;
  if (!editable && !(item.tagIds || []).length) return '';
  return `
    <div class="vb-tagfield" data-vb-tagfield>
      <div class="vb-tagfield__main" data-vb-tagfield-main>${tagFieldInnerHtml(item, catalog, { editable })}</div>
      ${editable ? `<p class="vb-tagfield__hint" data-vb-tag-hint>${esc(tagHint(item))}</p>` : ''}
    </div>`;
}
