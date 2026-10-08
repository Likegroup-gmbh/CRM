import { describe, it, expect } from 'vitest';
import { renderAuftragAmpel } from '../modules/auftrag/logic/AuftragStatusUtils.js';

describe('renderAuftragAmpel', () => {
  it('zeigt Beauftragt als Aktiv', () => {
    const html = renderAuftragAmpel('Beauftragt');
    expect(html).toContain('auftrag-ampel--beauftragt');
    expect(html).toContain('Aktiv');
  });

  it('behandelt leeren Status wie Beauftragt', () => {
    [null, undefined, ''].forEach((status) => {
      const html = renderAuftragAmpel(status);
      expect(html).toContain('auftrag-ampel--beauftragt');
      expect(html).toContain('Aktiv');
    });
  });

  it('zeigt Abgeschlossen und Storniert', () => {
    expect(renderAuftragAmpel('Abgeschlossen')).toContain('auftrag-ampel--abgeschlossen');
    expect(renderAuftragAmpel('Storniert')).toContain('auftrag-ampel--storniert');
  });

  it('zeigt einen unbekannten Status im Klartext statt als Aktiv', () => {
    const html = renderAuftragAmpel('In Produktion');
    expect(html).toContain('auftrag-ampel--unbekannt');
    expect(html).toContain('In Produktion');
    expect(html).not.toContain('Aktiv');
  });

  it('escaped den Statuswert', () => {
    const html = renderAuftragAmpel('<img src=x>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x&gt;');
  });
});
