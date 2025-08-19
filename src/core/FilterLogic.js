// FilterLogic.js (ES6-Modul)
// Zentrale Filter-Logik (Verarbeitung, Anwendung, Reset)

export function processFilterForm(formData) {
  const filters = {};
  for (const [key, value] of formData.entries()) {
    if (value) {
      if (key.includes('_min') || key.includes('_max')) {
        const baseKey = key.replace('_min', '').replace('_max', '');
        if (!filters[baseKey]) filters[baseKey] = {};
        if (key.includes('_min')) {
          filters[baseKey].min = parseInt(value);
        } else {
          filters[baseKey].max = parseInt(value);
        }
      } else if (['lieferadresse_land', 'bundesland'].includes(key)) {
        // Multi-Select Felder (nur noch für Land/Bundesland, da Sprache/Branche jetzt FK sind)
        const tags = value.split(',').map(tag => tag.trim()).filter(tag => tag);
        if (tags.length > 0) {
          filters[key] = tags;
        }
      } else {
        // Stelle sicher, dass der Wert als String gespeichert wird
        filters[key] = String(value);
      }
    }
  }
  return filters;
}

export function resetFilterState() {
  // Placeholder für spätere Logik
  return {};
}
