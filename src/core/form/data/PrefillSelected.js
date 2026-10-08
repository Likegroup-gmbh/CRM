// PrefillSelected.js
// Vorauswahl fuer Multiselects im Create-Flow (z.B. /produkt/new?briefing=...).
// Das Modul legt die IDs als data-prefill-values am <select> ab. Der Loader,
// der die Optionen als Naechstes mit gesetztem Parent baut, markiert sie als
// selected und verbraucht den Wert (einmalig - wer den Tag entfernt, bekommt
// ihn bei einem spaeteren Reload nicht zurueck).

const ATTR = 'prefillValues';

function findSelect(form, field) {
  return form?.querySelector?.(`[name="${field.name}"]`) || null;
}

function parseIds(el) {
  const raw = el?.dataset?.[ATTR];
  if (!raw) return null;
  try {
    const ids = JSON.parse(raw);
    return Array.isArray(ids) ? ids.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function setPrefillValues(el, ids) {
  const list = [...new Set((ids || []).filter(Boolean))];
  if (!el?.dataset) return;
  if (list.length) el.dataset[ATTR] = JSON.stringify(list);
  else delete el.dataset[ATTR];
}

/**
 * Markiert vorgemerkte IDs in `options` als selected. Fehlt eine ID in der
 * gefilterten Liste, wird die Zeile nachgeladen (nur wenn sie zum Parent passt).
 * Mutiert `options` und verbraucht die Vormerkung.
 */
export async function applyPrefillSelected(form, field, options, parentValue = null) {
  const el = findSelect(form, field);
  const ids = parseIds(el);
  if (ids === null) return options;
  delete el.dataset[ATTR];

  const valueField = field.valueField || 'id';
  const parent = parentValue
    ?? (field.filterBy ? form.querySelector?.(`[name="${field.filterBy}"]`)?.value : null)
    ?? null;

  for (const id of ids) {
    const known = options.find(o => o.value === id);
    if (known) {
      known.selected = true;
      continue;
    }
    if (!field.table || !window.supabase) continue;
    try {
      const { data: row } = await window.supabase
        .from(field.table)
        .select('*')
        .eq(valueField, id)
        .maybeSingle();
      if (!row) continue;
      if (field.filterBy && parent && row[field.filterBy] !== parent) continue;
      options.unshift({
        value: row[valueField],
        label: row[field.displayField] || row.name || 'Unbekannt',
        selected: true
      });
    } catch (err) {
      console.warn(`Vorauswahl ${field.name} konnte nicht nachgeladen werden:`, err?.message);
    }
  }
  return options;
}
