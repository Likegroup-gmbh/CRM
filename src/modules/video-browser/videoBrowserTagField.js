// videoBrowserTagField.js
// Tag-Feld im Tab "Details": Chips mit Entfernen-Kreuz und die Combobox zum Hinzufügen.
// Die Combobox bleibt nach jeder Auswahl offen (Mehrfachauswahl), Esc und Klick daneben schließen.

import { TagCombobox } from '../../core/components/TagCombobox.js';
import { resolveSelection } from './videoBrowserLogic.js';
import { tagOptions } from './videoBrowserTagLogic.js';
import { tagChipHtml, tagTriggerHtml, tagsOf } from './videoBrowserRenderTags.js';
import { addTag, createTag, removeTag } from './videoBrowserTags.js';
import { setDetailTab } from './videoBrowserTabs.js';

const slotOf = (vb) => vb.detailInner?.querySelector('[data-vb-tag-slot]') || null;

function optionsFor(vb, query) {
  const { item } = resolveSelection(vb.tree, vb.sel);
  const opts = tagOptions(vb.raw?.tagTypen || [], item?.tagIds || [], query);
  return {
    groups: opts.groups.map(g => ({ label: g.group, items: g.tags.map(t => ({ id: t.id, label: t.label })) })),
    create: opts.create,
    emptyText: opts.empty ? 'Alle Tags sind schon vergeben.' : 'Keine Treffer.'
  };
}

/** Combobox öffnen (Klick auf "+ Tag" und Taste T). Wechselt dafür in den Tab "Details". */
export function openTagField(vb) {
  if (!vb.canUpload) return false;
  const { item } = resolveSelection(vb.tree, vb.sel);
  if (!item?.variantKey) return false;
  if (vb.tagField) { vb.tagField.open(); return true; }

  setDetailTab(vb, 'details', { animate: true });
  const host = slotOf(vb);
  if (!host) return false;

  const combo = new TagCombobox({
    host,
    label: 'Tag hinzufügen',
    getOptions: (query) => optionsFor(vb, query),
    onSelect: (entry) => { void addTag(vb, entry.id); },
    onCreate: (label) => { void createTag(vb, label); },
    onRemoveLast: () => {
      const current = resolveSelection(vb.tree, vb.sel).item;
      const last = current?.tagIds?.[current.tagIds.length - 1];
      if (last) void removeTag(vb, last);
    },
    onOpen: ({ input, list }) => vb.motion?.tagInputOpen(input, list),
    onClose: (reason) => {
      if (vb.tagField === combo) vb.tagField = null;
      // Host zeigt wieder den Trigger. Nach Esc bekommt er den Fokus, sonst bleibt er dort, wo er hinwollte.
      const slot = slotOf(vb);
      if (!slot) return;
      slot.innerHTML = tagTriggerHtml();
      if (reason === 'escape' || reason === 'api-focus') slot.querySelector('[data-vb-tag-open]')?.focus();
    }
  });
  vb.tagField = combo;
  combo.open();
  return true;
}

export function closeTagField(vb, { focus = false } = {}) {
  const combo = vb.tagField;
  if (!combo) return;
  vb.tagField = null;
  combo.close(focus ? 'api-focus' : 'api');
}

/**
 * Chips mit dem Zustand der Datei abgleichen (nach Vergeben, Entfernen und Rollback) und die
 * Optionsliste der offenen Combobox neu bauen. Neue Chips poppen ein, entfernte schrumpfen weg.
 */
export function refreshTagField(vb) {
  const container = vb.detailInner?.querySelector('[data-vb-tag-chips]');
  if (!container) return;
  const { item } = resolveSelection(vb.tree, vb.sel);
  const wanted = tagsOf(item, vb.raw?.tagTypen || []);
  const editable = !!vb.canUpload;
  const have = [...container.querySelectorAll('[data-tag-id]')].filter(c => !c.dataset.leaving);

  have.filter(c => !wanted.some(t => t.id === c.dataset.tagId)).forEach((chip) => {
    chip.dataset.leaving = '1';
    vb.motion?.chipOut(chip, () => chip.remove());
  });
  wanted.filter(t => !have.some(c => c.dataset.tagId === t.id)).forEach((tag) => {
    container.insertAdjacentHTML('beforeend', tagChipHtml(tag, { removable: editable }));
    vb.motion?.chipIn(container.lastElementChild);
  });
  vb.tagField?.refresh();
}
