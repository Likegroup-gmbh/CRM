import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadNeuigkeiten, renderNeuigkeitenBlock, bindNeuigkeitenEvents } from '../modules/dashboard/DashboardNeuigkeiten.js';

function chain(result) {
  const q = {};
  for (const m of ['select', 'eq', 'order', 'limit', 'not', 'in']) {
    q[m] = vi.fn(() => q);
  }
  q.then = (resolve) => resolve(result);
  return q;
}

function vorTagen(tage) {
  return new Date(Date.now() - tage * 24 * 60 * 60 * 1000).toISOString();
}

const BEISPIEL = [
  { titel: 'Ordner für Personas', kurztext: 'Du kannst Personas jetzt als Ordner gruppieren.', published_at: vorTagen(2) }
];

describe('DashboardNeuigkeiten – loadNeuigkeiten', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('laedt nichts und fragt nicht an, wenn der User kein interner ist', async () => {
    window.isInternal = () => false;
    window.supabase = { from: vi.fn() };

    const result = await loadNeuigkeiten();

    expect(result).toEqual([]);
    expect(window.supabase.from).not.toHaveBeenCalled();
  });

  it('laedt die neuesten Posts fuer interne User', async () => {
    window.isInternal = () => true;
    window.supabase = { from: vi.fn(() => chain({ data: BEISPIEL, error: null })) };

    const result = await loadNeuigkeiten();

    expect(window.supabase.from).toHaveBeenCalledWith('neuigkeit');
    expect(result).toEqual(BEISPIEL);
  });

  it('gibt bei Fehler ein leeres Array zurueck statt zu werfen', async () => {
    window.isInternal = () => true;
    window.supabase = { from: vi.fn(() => chain({ data: null, error: new Error('rls') })) };

    expect(await loadNeuigkeiten()).toEqual([]);
  });
});

describe('DashboardNeuigkeiten – renderNeuigkeitenBlock', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('zeigt Cards mit Titel, Kurztext und Datum - ohne Links', () => {
    window.isInternal = () => true;

    const html = renderNeuigkeitenBlock(BEISPIEL);

    expect(html).toContain('Was ist neu');
    expect(html).toContain('Ordner für Personas');
    expect(html).toContain('Du kannst Personas jetzt als Ordner gruppieren.');
    expect(html).toContain('dashboard-neuigkeiten__card');
    expect(html).not.toContain('/neuigkeiten/');
    expect(html).not.toContain('<a ');
  });

  it('zeigt das Neu-Badge nur bei Meldungen juenger als 7 Tage', () => {
    window.isInternal = () => true;

    const frisch = renderNeuigkeitenBlock([
      { titel: 'Frisch', kurztext: 'Text', published_at: vorTagen(6) }
    ]);
    expect(frisch).toContain('dashboard-neuigkeiten__badge');

    const alt = renderNeuigkeitenBlock([
      { titel: 'Alt', kurztext: 'Text', published_at: vorTagen(8) }
    ]);
    expect(alt).not.toContain('dashboard-neuigkeiten__badge');
  });

  it('zeigt hoechstens 3 Cards und den Alle-anzeigen-Button, wenn es mehr gibt', () => {
    window.isInternal = () => true;
    const vier = Array.from({ length: 4 }, (_, i) => ({
      titel: `Post ${i}`, kurztext: `Text ${i}`, published_at: vorTagen(10 + i)
    }));

    const html = renderNeuigkeitenBlock(vier);

    expect(html.match(/dashboard-neuigkeiten__card-titel/g)).toHaveLength(3);
    expect(html).toContain('data-action="neuigkeiten-alle"');
    expect(html).not.toContain('Post 3');
  });

  it('zeigt keinen Button, wenn es nur 3 oder weniger gibt', () => {
    window.isInternal = () => true;

    const html = renderNeuigkeitenBlock(BEISPIEL);

    expect(html).not.toContain('dashboard-neuigkeiten__toggle');
  });

  it('rendert expanded alle Cards mit Weniger-anzeigen-Button', () => {
    window.isInternal = () => true;
    const fuenf = Array.from({ length: 5 }, (_, i) => ({
      titel: `Post ${i}`, kurztext: `Text ${i}`, published_at: vorTagen(10 + i)
    }));

    const html = renderNeuigkeitenBlock(fuenf, { expanded: true });

    expect(html.match(/dashboard-neuigkeiten__card-titel/g)).toHaveLength(5);
    expect(html).toContain('data-action="neuigkeiten-weniger"');
  });

  it('zeigt nichts fuer Kunden', () => {
    window.isInternal = () => false;
    expect(renderNeuigkeitenBlock(BEISPIEL)).toBe('');
  });

  it('zeigt nichts, wenn es keine Posts gibt', () => {
    window.isInternal = () => true;
    expect(renderNeuigkeitenBlock([])).toBe('');
    expect(renderNeuigkeitenBlock(null)).toBe('');
  });

  it('escaped HTML in Titel und Kurztext', () => {
    window.isInternal = () => true;
    const html = renderNeuigkeitenBlock([
      { titel: '<img src=x onerror=alert(1)>', kurztext: '<script>1</script>', published_at: null }
    ]);
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;img src=x');
  });
});

describe('DashboardNeuigkeiten – Expand/Collapse', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('Alle anzeigen laedt alle Meldungen und rendert expanded', async () => {
    window.isInternal = () => true;
    const vier = Array.from({ length: 4 }, (_, i) => ({
      titel: `Post ${i}`, kurztext: `Text ${i}`, published_at: vorTagen(10 + i)
    }));
    const alle = [...vier, { titel: 'Post 4', kurztext: 'Text 4', published_at: vorTagen(20) }];
    window.supabase = { from: vi.fn(() => chain({ data: alle, error: null })) };

    document.body.innerHTML = renderNeuigkeitenBlock(vier);
    bindNeuigkeitenEvents();

    document.querySelector('[data-action="neuigkeiten-alle"]').click();
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.dashboard-neuigkeiten__card')).toHaveLength(5);
    });
    expect(document.querySelector('[data-action="neuigkeiten-weniger"]')).toBeTruthy();
  });

  it('Weniger anzeigen faellt auf die 3 neuesten aus dem Cache zurueck', async () => {
    window.isInternal = () => true;
    const vier = Array.from({ length: 4 }, (_, i) => ({
      titel: `Post ${i}`, kurztext: `Text ${i}`, published_at: vorTagen(10 + i)
    }));
    // Cache fuellen wie beim initialen Dashboard-Load
    window.supabase = { from: vi.fn(() => chain({ data: vier, error: null })) };
    await loadNeuigkeiten();

    const alle = [...vier, { titel: 'Post 4', kurztext: 'Text 4', published_at: vorTagen(20) }];
    document.body.innerHTML = renderNeuigkeitenBlock(alle, { expanded: true });
    bindNeuigkeitenEvents();

    document.querySelector('[data-action="neuigkeiten-weniger"]').click();

    expect(document.querySelectorAll('.dashboard-neuigkeiten__card')).toHaveLength(3);
    expect(document.querySelector('[data-action="neuigkeiten-alle"]')).toBeTruthy();
  });
});
