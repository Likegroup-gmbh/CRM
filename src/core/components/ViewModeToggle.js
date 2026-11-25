// ViewModeToggle.js
// Wiederverwendbarer View-Switcher (z. B. Liste/Grid/Kanban/Kalender)

import { icon } from '../icons/IconSystem.js';

const MODE_ICONS = {
  list: 'list-bullet',
  grid: 'grid',
  kanban: 'squares-2x2',
  calendar: 'calendar',
  table: 'list-bullet',
  folder: 'folder',
  showcase: 'squares-2x2',
};

export class ViewModeToggle {
  static getIcon(name) {
    const key = MODE_ICONS[name];
    return key ? icon(key, { stroke: 1.5 }) : '';
  }

  /**
   * @param {Array<{ buttonId?: string, label: string, icon?: string, title?: string, active?: boolean, attrs?: string }>} modes
   * @param {{ className?: string, groupAttrs?: string, extraHtml?: string }} [opts]
   * className/groupAttrs/extraHtml: zusätzliche Klasse, Attribute und Markup (z. B. gleitender Indikator) am Wrapper.
   */
  static render(modes = [], { className = '', groupAttrs = '', extraHtml = '' } = {}) {
    const buttons = modes.map(mode => {
      const iconHtml = mode.icon ? this.getIcon(mode.icon) : '';
      const activeClass = mode.active ? 'active' : '';
      const idAttr = mode.buttonId ? ` id="${mode.buttonId}"` : '';
      const titleAttr = mode.title ? ` title="${mode.title}"` : '';
      const extraAttrs = mode.attrs ? ` ${mode.attrs}` : '';
      return `
        <button${idAttr} class="mdc-btn mdc-btn--secondary ${activeClass}"${titleAttr}${extraAttrs}>
          ${iconHtml}
          ${mode.label}
        </button>
      `;
    }).join('');

    return `<div class="view-toggle${className ? ` ${className}` : ''}"${groupAttrs ? ` ${groupAttrs}` : ''}>${buttons}${extraHtml}</div>`;
  }
}
