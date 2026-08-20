// ViewModeToggle.js
// Wiederverwendbarer View-Switcher (z. B. Liste/Grid/Kanban/Kalender)

import { icon } from '../icons/IconSystem.js';

const MODE_ICONS = {
  list: 'list-bullet',
  grid: 'grid',
  kanban: 'squares-2x2',
  calendar: 'calendar',
  table: 'list-bullet',
};

export class ViewModeToggle {
  static getIcon(name) {
    const key = MODE_ICONS[name];
    return key ? icon(key, { stroke: 1.5 }) : '';
  }

  static render(modes = []) {
    const buttons = modes.map(mode => {
      const iconHtml = mode.icon ? this.getIcon(mode.icon) : '';
      const activeClass = mode.active ? 'active' : '';
      return `
        <button id="${mode.buttonId}" class="mdc-btn mdc-btn--secondary ${activeClass}">
          ${iconHtml}
          ${mode.label}
        </button>
      `;
    }).join('');

    return `<div class="view-toggle">${buttons}</div>`;
  }
}
