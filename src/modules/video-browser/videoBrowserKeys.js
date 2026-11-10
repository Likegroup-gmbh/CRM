// videoBrowserKeys.js
// Tastenkürzel im Detailbereich (nur Team):
//   E  Titel bearbeiten      F  Final markieren bzw. aufheben      T  Tag hinzufügen (Tab "Details")
// Sie gelten nur, wenn der Fokus in der Ansicht liegt (oder nirgends), nicht in Eingabefeldern und nicht
// im Player: dort gehört F dem Vollbild.

import { toggleFinal } from './videoBrowserActions.js';
import { resolveSelection } from './videoBrowserLogic.js';
import { startRename } from './videoBrowserRename.js';
import { canMarkFinal } from './videoBrowserRenderItem.js';
import { openTagField } from './videoBrowserTagField.js';

function isTyping(el) {
  if (!el || el === document.body) return false;
  return /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable || el.getAttribute?.('role') === 'combobox';
}

/** Gehört der Tastendruck dieser Ansicht? */
function inScope(vb, el) {
  if (!vb.root?.isConnected) return false;
  return el === document.body || el === document.documentElement || vb.root.contains(el);
}

/** @returns {boolean} true, wenn der Druck ein Kürzel ausgelöst hat */
export function onShortcut(vb, e) {
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return false;
  // Im Showcase ist der Detailbereich ausgeblendet: keine Kürzel auf der versteckten Datei
  if (vb.view === 'showcase') return false;
  const target = e.target;
  if (!inScope(vb, target) || isTyping(target)) return false;
  // Im Player gehört F dem Vollbild (und M, Leertaste usw. der Wiedergabe)
  if (target.closest?.('.vb-player')) return false;
  if (!vb.canUpload) return false;

  const key = String(e.key || '').toLowerCase();
  if (key !== 'e' && key !== 'f' && key !== 't') return false;
  const { item } = resolveSelection(vb.tree, vb.sel);
  if (!item) return false;

  if (key === 'e') {
    e.preventDefault();
    startRename(vb);
    return true;
  }
  if (key === 'f') {
    if (!canMarkFinal(item)) return false;
    e.preventDefault();
    void toggleFinal(vb, { source: 'key' });
    return true;
  }
  if (!item.variantKey) return false;
  e.preventDefault();
  return openTagField(vb);
}

/** Enter und Leertaste lösen eine klickbare Zeile aus (Titel, Eigenschaftszeile, Dateiname). */
export function isActivationKey(e) {
  return e.key === 'Enter' || e.key === ' ';
}
