import { describe, expect, it } from 'vitest';

const bewerbung = require('../../netlify/functions/_shared/bewerbung.js');
import { renderTabNavigation } from '../modules/creator-auswahl/sourcingTabs.js';
import { renderAddSection, renderItemsTable } from '../modules/creator-auswahl/castingTableRender.js';
import { renderBewerbungTable } from '../modules/creator-auswahl/bewerbungTab.js';

describe('Bewerbung', () => {
  it('verlangt Name und mindestens einen Profil-Link', () => {
    expect(bewerbung.validateZeile({ vorname: 'Lea', nachname: '' }).ok).toBe(false);
    expect(bewerbung.validateZeile({ vorname: 'Lea', nachname: 'Klein' }).ok).toBe(false);
    const ok = bewerbung.validateZeile({ vorname: 'Lea', nachname: 'Klein', instagram: '@lea' });
    expect(ok.ok).toBe(true);
    expect(ok.zeile.link_instagram).toBe('https://instagram.com/lea');
    expect(ok.zeile.link_tiktok).toBeNull();
  });

  it('blendet den Reiter fuer Kunden aus und zeigt ihn dem Team', () => {
    const intern = renderTabNavigation({ isKunde: false, tabCounts: { bewerbung: 2 } });
    const kunde = renderTabNavigation({ isKunde: true, tabCounts: { bewerbung: 2 } });
    expect(intern).toContain('data-sourcing-tab="bewerbung"');
    expect(kunde).not.toContain('data-sourcing-tab="bewerbung"');
  });

  it('zeigt den Anfrage-Button nur mit create-Recht', () => {
    const intern = renderAddSection({ isKunde: false, canCreate: true, actionsOnly: true });
    const ohne = renderAddSection({ isKunde: false, canCreate: false, actionsOnly: true });
    expect(intern).toContain('id="btn-management-anfrage"');
    expect(intern).toContain('Managements anfragen');
    expect(ohne).not.toContain('btn-management-anfrage');
  });

  it('zeigt Ansprechpartner und Aufnehmen', () => {
    const html = renderBewerbungTable([{
      id: 'b1',
      vorname: 'Mara',
      nachname: 'Sommer',
      link_instagram: 'https://instagram.com/mara',
      management: { firmenname: 'Studio One' },
      ansprechpartner: { vorname: 'Lea', nachname: 'Klein' },
    }]);
    expect(html).toContain('Lea Klein · Studio One');
    expect(html).toContain('Aufnehmen');
    expect(html).toContain('Verwerfen');
  });

  it('ersetzt die Casting-Tabelle im Reiter Bewerbung', () => {
    const html = renderItemsTable({
      activeTab: 'bewerbung',
      isKunde: false,
      bewerbungen: [],
      items: [{ id: '1', name: 'Anna' }],
      hasAnyItems: true,
      hiddenColumns: [],
    });
    expect(html).toContain('Keine Bewerbungen.');
    expect(html).not.toContain('Anna');
  });
});
