// HoverToolbarRegistry
// Namen von Hover-Toolbars auf ihre Konfiguration abbilden. Gleiche Rolle wie
// ActionConfig fuer die Action-Dropdowns, mit einem Unterschied: Configs werden
// zur Laufzeit angemeldet statt statisch deklariert.
//
// Der Grund ist der Kontext. Eine Live-Link-Toolbar braucht Store und
// StatsFetcher ihrer Tabelle, und die entstehen erst beim Mount. Also meldet die
// Tabelle ihre Config im Konstruktor an (Closure ueber this) und beim destroy()
// wieder ab. Kontextfreie Configs koennen sich beim Modul-Import registrieren.

const configs = new Map();

/**
 * Config unter einem Namen anmelden. Der Name landet als
 * data-hover-toolbar="<name>" im Zellen-Markup.
 *
 * Erneutes Anmelden ueberschreibt: eine Tabelle, die zweimal gemountet wird,
 * soll die frische Instanz hinterlassen, nicht die alte.
 */
export function registerHoverToolbar(name, config) {
  if (!name || !config) return;
  configs.set(name, config);
}

export function unregisterHoverToolbar(name) {
  configs.delete(name);
}

export function getHoverToolbarConfig(name) {
  return configs.get(name) || null;
}

/** Nur fuer Tests. */
export function clearHoverToolbarConfigs() {
  configs.clear();
}
