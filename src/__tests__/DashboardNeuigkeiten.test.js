import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadNeuigkeiten, renderNeuigkeitenBlock } from '../modules/dashboard/DashboardNeuigkeiten.js';

function chain(result) {
  const q = {};
  for (const m of ['select', 'eq', 'order', 'limit', 'not', 'in']) {
    q[m] = vi.fn(() => q);
  }
  q.then = (resolve) => resolve(result);
  return q;
}

const BEISPIEL = [
  { slug: 'ordner-fuer-personas-a1b2c3d', titel: 'Ordner für Personas', teaser: 'Personas lassen sich gruppieren.', published_at: '2026-09-02T10:00:00Z' }
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
  it('zeigt den Block fuer interne User mit Titel und Link', () => {
    window.isInternal = () => true;

    const html = renderNeuigkeitenBlock(BEISPIEL);

    expect(html).toContain('Was ist neu');
    expect(html).toContain('Ordner für Personas');
    expect(html).toContain('/neuigkeiten/ordner-fuer-personas-a1b2c3d');
    expect(html).toContain('Alle Updates');
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

  it('escaped HTML in Titel und Teaser', () => {
    window.isInternal = () => true;
    const html = renderNeuigkeitenBlock([
      { slug: 'x-1234567', titel: '<img src=x onerror=alert(1)>', teaser: '<script>1</script>', published_at: null }
    ]);
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;img src=x');
  });
});
