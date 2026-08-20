import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderAuftraege } from '../modules/unternehmen/UnternehmenDetailRendererBusiness.js';

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
