// IconRegistry.js
// Duenner Wrapper um das zentrale IconSystem. Die fruehere Inline-SVG-Map
// wurde in src/core/icons/iconDefs.js (bzw. iconDefs.generated.js) ueberfuehrt.
// Behaelt die bestehenden Keys bei, damit Call-Sites nicht umgeschrieben
// werden muessen.

import { icon, hasIcon } from '../icons/IconSystem.js';

// IconRegistry-Key -> IconSystem-Key (nur wo sie abweichen)
const KEY_MAP = {
  view: 'eye',
  edit: 'pencil-square',
  note: 'chat-bubble-left',
  delete: 'trash',
  remove: 'trash',
  'add-to-campaign': 'campaign',
  favorite: 'star',
  'add-to-list': 'list-plus',
  unlink: 'minus-circle',
  refresh: 'arrow-path',
  'add-ansprechpartner': 'user-plus',
  check: 'check',
  zap: 'bolt',
  invoice: 'bolt',
  quickview: 'arrows-expand',
  video: 'video',
  tasks: 'clipboard-check',
  details: 'plus',
  download: 'arrow-down-tray',
  'add-details': 'plus',
  rechnungen: 'bolt',
  'rechnung-create': 'rechnung',
  'status-change': 'arrow-path',
  'status-offen': 'flag',
  'status-default': 'check-circle',
  'status-rueckfrage': 'question-mark-circle',
  'status-bezahlt': 'check',
  'status-qonto': 'paper-airplane',
  'status-marc-qonto': 'building-library',
  strategie: 'strategy',
  abgeschlossen: 'check-circle',
  'video produktion': 'table-cells',
  sourcing: 'sourcing',
  'script erstellung': 'skripte',
  'post produktion': 'scissors',
  'verträge': 'clipboard-document',
  vertraege: 'clipboard-document',
  besprechung: 'chat-bubble',
  'creator briefing': 'clipboard',
  filter: 'adjustments-horizontal',
  connect: 'link-slash',
  'ig-refresh': 'arrow-path-filled',
  chart: 'chart-bar-sm',
  warn: 'exclamation-triangle',
  external: 'arrow-top-right-on-square',
  trash: 'trash',
};

// Keys, die mit gefuellter Optik gerendert werden muessen
const FILLED_KEYS = new Set(['connect', 'ig-refresh']);

export class IconRegistry {
  constructor() {
    // Cache bleibt als API-Fassade, wird aber nicht mehr benoetigt,
    // weil das Sprite selbst das Caching uebernimmt.
    this.cache = new Map();
  }

  resolveKey(name) {
    return KEY_MAP[name] || name;
  }

  get(name, options = {}) {
    if (!name) return '';
    const key = this.resolveKey(name);
    const opts = { stroke: 1.5, ...options };
    if (FILLED_KEYS.has(key)) opts.className = `${opts.className || ''} crm-icon--filled`.trim();
    return icon(key, opts);
  }

  getHeroIcon(name) {
    return this.get(name);
  }

  getStatusIcon(statusName) {
    if (!statusName) return this.get('status-default');
    const key = String(statusName).toLowerCase().trim();
    const statusIconMap = {
      'strategie': 'strategie',
      'abgeschlossen': 'abgeschlossen',
      'video produktion': 'video produktion',
      'sourcing': 'sourcing',
      'script erstellung': 'script erstellung',
      'post produktion': 'post produktion',
      'verträge': 'verträge',
      'vertraege': 'vertraege',
      'besprechung': 'besprechung',
      'rechnungen': 'rechnungen',
      'creator briefing': 'creator briefing',
      'offen': 'status-offen',
      'rückfrage': 'status-rueckfrage',
      'bezahlt': 'status-bezahlt',
      'an qonto gesendet': 'status-qonto',
      'marc an qonto gesendet': 'status-marc-qonto',
    };
    const iconKey = statusIconMap[key] || 'status-default';
    return this.get(iconKey);
  }

  register() {
    // Icons werden zentral in iconDefs.js gepflegt. register() bleibt als
    // No-Op, damit alte Call-Sites nicht brechen.
    if (import.meta.env?.DEV) {
      console.warn('[IconRegistry] register() ist veraltet – Icons zentral in iconDefs.js pflegen.');
    }
  }

  getAvailableIcons() {
    return Object.keys(KEY_MAP);
  }

  clearCache() {
    this.cache.clear();
  }
}

export const iconRegistry = new IconRegistry();
