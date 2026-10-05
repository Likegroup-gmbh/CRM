import { describe, it, expect } from 'vitest';
import { renderEmptyRow, renderErrorRow } from '../core/list/tableStates.js';

describe('tableStates', () => {
  describe('renderEmptyRow', () => {
    it('rendert eine Zeile mit colspan und Empty-State-Titel', () => {
      const html = renderEmptyRow({
        colspan: 7,
        hasActiveFilters: false,
        state: { icon: 'inbox', title: 'Keine Marken vorhanden' }
      });

      expect(html.startsWith('<tr><td colspan="7" class="empty-state-cell">')).toBe(true);
      expect(html.endsWith('</td></tr>')).toBe(true);
      expect(html).toContain('Keine Marken vorhanden');
    });

    it('nutzt bei aktiven Filtern den gefilterten Zustand statt des Standards', () => {
      const html = renderEmptyRow({
        colspan: 3,
        hasActiveFilters: true,
        state: { icon: 'inbox', title: 'Keine Marken vorhanden' }
      });

      expect(html).not.toContain('Keine Marken vorhanden');
      expect(html).toContain('colspan="3"');
    });

    it('übernimmt Aktionen aus dem Standard-State', () => {
      const html = renderEmptyRow({
        colspan: 3,
        hasActiveFilters: false,
        state: { title: 'Leer', actionsHtml: '<button id="btn-new">Neu</button>' }
      });
      expect(html).toContain('id="btn-new"');
    });
  });

  describe('renderErrorRow', () => {
    it('rendert Fehlermeldung mit colspan und Fehlerklasse', () => {
      const html = renderErrorRow({ colspan: 11, message: 'Netzwerk weg' });
      expect(html).toContain('colspan="11"');
      expect(html).toContain('table-state-cell--error');
      expect(html).toContain('Fehler beim Laden: Netzwerk weg');
    });

    it('fällt ohne Meldung auf "Unbekannter Fehler" zurück', () => {
      expect(renderErrorRow({ colspan: 2 })).toContain('Fehler beim Laden: Unbekannter Fehler');
      expect(renderErrorRow({ colspan: 2, message: '' })).toContain('Unbekannter Fehler');
    });

    it('ist als <tr> in einen tbody parsebar', () => {
      const tbody = document.createElement('tbody');
      tbody.innerHTML = renderErrorRow({ colspan: 4, message: 'x' });
      expect(tbody.querySelectorAll('tr').length).toBe(1);
      expect(tbody.querySelector('td').getAttribute('colspan')).toBe('4');
    });
  });
});
