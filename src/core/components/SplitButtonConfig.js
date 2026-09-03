// SplitButtonConfig.js
// Deklarative Configs fuer Split-Buttons. Gleicher Ansatz wie ActionConfig:
// id + items, spaeter neue Buttons nur hier (oder per register) anlegen.

/**
 * @typedef {object} SplitButtonItem
 * @property {string} id
 * @property {string} [icon]
 * @property {string} [label]
 * @property {object} [data]
 * @property {boolean} [danger]
 * @property {boolean} [disabled]
 * @property {boolean} [selects=false] - Item ist Kommando, keine selektierte Variante (kein Check, aendert data-split-selected nicht)
 */

/**
 * @typedef {object} SplitButtonDef
 * @property {string} [label]
 * @property {string} [icon] - optionales Icon im Primary-Button
 * @property {string} [variant] '' | 'secondary' | 'cancel'
 * @property {SplitButtonItem[]|function} items
 */

function contractSubmitItems(variants) {
  return [
    ...variants,
    { id: 'separator' },
    { id: 'draft', icon: 'notebook', label: 'Als Entwurf speichern', selects: false, data: { action: 'draft' } },
    { id: 'submit-and-new', icon: 'document-refresh', label: 'Erstellen & Neu mit gleichen Daten', selects: false, data: { action: 'submit-and-new' } }
  ];
}

function languageVariants() {
  return [
    { id: 'de', icon: 'contract', label: 'Deutsch', data: { lang: 'de' } },
    { id: 'en', icon: 'contract', label: 'English', data: { lang: 'en' } }
  ];
}

export const SplitButtonConfigs = {
  'ugc-contract-submit': {
    label: 'Erstellen & PDF',
    items: contractSubmitItems([
      { id: 'legacy-de', icon: 'contract', label: 'Alter Vertrag (DE)', data: { template: 'legacy', lang: 'de' } },
      { id: 'legacy-en', icon: 'contract', label: 'Alter Vertrag (EN)', data: { template: 'legacy', lang: 'en' } },
      { id: 'v2', icon: 'contract', label: 'Neuer Vertrag', data: { template: 'v2', lang: 'de' } }
    ])
  },
  'influencer-contract-submit': {
    label: 'Erstellen & PDF',
    items: contractSubmitItems([
      { id: 'legacy-de', icon: 'contract', label: 'Standard (DE)', data: { template: 'legacy', lang: 'de' } },
      { id: 'legacy-en', icon: 'contract', label: 'Standard (EN)', data: { template: 'legacy', lang: 'en' } },
      { id: 'awareness-de', icon: 'contract', label: 'BURGA Awareness (DE)', data: { template: 'awareness', lang: 'de' } },
      { id: 'awareness-en', icon: 'contract', label: 'BURGA Awareness (EN)', data: { template: 'awareness', lang: 'en' } }
    ])
  },
  'videograph-contract-submit': {
    label: 'Erstellen & PDF',
    items: contractSubmitItems(languageVariants())
  },
  'model-contract-submit': {
    label: 'Erstellen & PDF',
    items: contractSubmitItems(languageVariants())
  },
  'contracting-contract-submit': {
    label: 'Erstellen & PDF',
    items: contractSubmitItems(languageVariants())
  },
  'unternehmen-create': {
    label: 'Unternehmen anlegen',
    icon: 'unternehmen-secondary',
    items: (opts) => [
      ...(opts.canCreateMarke ? [{ id: 'marke', icon: 'marke-secondary', label: 'Marke anlegen', selects: false, data: { href: '/marke/new' } }] : [])
    ]
  }
};

export class SplitButtonConfig {
  static get(id) {
    return SplitButtonConfigs[id] || null;
  }

  static register(id, config) {
    if (!id || !config) return;
    SplitButtonConfigs[id] = config;
  }

  static getItem(configId, itemId) {
    const config = this.get(configId);
    if (!config) return null;
    const items = Array.isArray(config.items) ? config.items : [];
    return items.find((item) => item.id === itemId) || null;
  }

  static resolveItems(config, options = {}) {
    if (!config) return [];
    const items = typeof config.items === 'function' ? config.items(options) : config.items;
    return Array.isArray(items) ? items : [];
  }
}
