import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderAuftraege } from '../modules/unternehmen/UnternehmenDetailRendererBusiness.js';
import { renderKundenrechnungen } from '../modules/unternehmen/UnternehmenDetailRendererRelations.js';

describe('renderAuftraege', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.isKunde = vi.fn(() => true);
    window.currentUser = { rolle: 'kunde' };
  });

  it('summiert Netto, USt und Brutto im Tabellenfuß', () => {
    const detail = {
      auftraege: [
        { id: 'a1', auftragsname: 'Eins', nettobetrag: 1000, ust_betrag: 190, bruttobetrag: 1190, auftragtype: 'UGC' },
        { id: 'a2', auftragsname: 'Zwei', nettobetrag: 2500.5, ust_betrag: 475.1, bruttobetrag: 2975.6, auftragtype: 'UGC' }
      ],
      sanitize: (v) => v || '',
      formatCurrency: (n) => `${Number(n || 0).toFixed(2)} €`,
      formatDate: () => '-'
    };

    const html = renderAuftraege(detail);
    const tfoot = html.match(/<tfoot>[\s\S]*?<\/tfoot>/)?.[0] || '';

    expect(tfoot).toContain('GESAMT');
    expect(tfoot).toContain('3500.50 €');
    expect(tfoot).toContain('665.10 €');
    expect(tfoot).toContain('4165.60 €');
  });
});

describe('renderKundenrechnungen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.isKunde = vi.fn(() => true);
    window.currentUser = { rolle: 'kunde' };
  });

  // Ein Auftrag mit zwei Teilrechnungen ergibt zwei Zeilen. Die Summe muss die
  // Teilrechnungen zaehlen, nicht den Auftragskopf.
  it('summiert die explodierten Teilrechnungen im Tabellenfuß', () => {
    const detail = {
      kundenrechnungen: [
        { id: 'a1', auftragsname: 'Eins', nettobetrag: 1000, ust_betrag: 190, bruttobetrag: 1190, _teilrechnung: { label: '1 von 2' } },
        { id: 'a1', auftragsname: 'Eins', nettobetrag: 500, ust_betrag: 95, bruttobetrag: 595, _teilrechnung: { label: '2 von 2' } }
      ],
      sanitize: (v) => v || '',
      formatCurrency: (n) => `${Number(n || 0).toFixed(2)} €`,
      formatDate: () => '-'
    };

    const tfoot = renderKundenrechnungen(detail).match(/<tfoot>[\s\S]*?<\/tfoot>/)?.[0] || '';

    expect(tfoot).toContain('GESAMT');
    expect(tfoot).toContain('1500.00 €');
    expect(tfoot).toContain('285.00 €');
    expect(tfoot).toContain('1785.00 €');
  });
});
