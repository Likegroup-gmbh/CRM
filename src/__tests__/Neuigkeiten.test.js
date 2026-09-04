import { describe, it, expect, beforeEach, vi } from 'vitest';
import { neuigkeitenPage } from '../modules/neuigkeiten/NeuigkeitenPage.js';
import { neuigkeitDetail } from '../modules/neuigkeiten/NeuigkeitDetail.js';

function chain(result) {
  const q = {};
  for (const m of ['select', 'eq', 'order', 'limit', 'not', 'in', 'maybeSingle', 'single']) {
    q[m] = vi.fn(() => q);
  }
  q.then = (resolve) => resolve(result);
  return q;
}

const POST = {
  slug: 'ordner-fuer-personas-a1b2c3d',
  titel: 'Ordner für Personas',
  teaser: 'Personas lassen sich gruppieren.',
  inhalt: 'Sie können Personas jetzt in Ordnern sortieren.',
  schritte: [
    { titel: 'Oeffnen Sie Personas', text: 'Links in der Navigation.', route: '/persona', screenshot_path: 'abc/persona.png' }
  ],
  status: 'published',
  published_at: '2026-09-02T10:00:00Z'
};

beforeEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '<div id="content"></div>';
  window.content = document.getElementById('content');
  window.setHeadline = vi.fn();
  window.setContentSafely = vi.fn((el, html) => { el.innerHTML = html; });
  window.navigateTo = vi.fn();
  window.breadcrumbSystem = null;
});

describe('NeuigkeitenPage', () => {
  it('leitet Kunden aufs Dashboard um, ohne Daten zu laden', async () => {
    window.isInternal = () => false;
    window.supabase = { from: vi.fn() };

    await neuigkeitenPage.init();

    expect(window.navigateTo).toHaveBeenCalledWith('/dashboard');
    expect(window.supabase.from).not.toHaveBeenCalled();
  });

  it('rendert published Posts als Karten fuer interne User', async () => {
    window.isInternal = () => true;
    window.supabase = { from: vi.fn(() => chain({ data: [POST], error: null })) };

    await neuigkeitenPage.init();

    const html = window.content.innerHTML;
    expect(window.setHeadline).toHaveBeenCalledWith('Was ist neu');
    expect(html).toContain('Ordner für Personas');
    expect(html).toContain('education-card');
  });

  it('zeigt Empty State, wenn es keine Posts gibt', async () => {
    window.isInternal = () => true;
    window.supabase = { from: vi.fn(() => chain({ data: [], error: null })) };

    await neuigkeitenPage.init();

    expect(window.content.innerHTML).toContain('Noch keine Updates');
  });
});

describe('NeuigkeitDetail', () => {
  it('leitet Kunden aufs Dashboard um', async () => {
    window.isInternal = () => false;
    window.supabase = { from: vi.fn() };

    await neuigkeitDetail.init(POST.slug);

    expect(window.navigateTo).toHaveBeenCalledWith('/dashboard');
    expect(window.supabase.from).not.toHaveBeenCalled();
  });

  it('zeigt Not Found bei unbekanntem Slug', async () => {
    window.isInternal = () => true;
    window.supabase = { from: vi.fn(() => chain({ data: null, error: null })) };

    await neuigkeitDetail.init('gibts-nicht');

    expect(window.setHeadline).toHaveBeenCalledWith('Update nicht gefunden');
    expect(window.content.innerHTML).toContain('Update nicht gefunden');
  });

  it('rendert Inhalt, Schritte und Screenshot fuer interne User', async () => {
    window.isInternal = () => true;
    window.supabase = {
      from: vi.fn(() => chain({ data: POST, error: null })),
      storage: {
        from: vi.fn(() => ({
          getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://cdn.example/abc/persona.png' } }))
        }))
      }
    };

    await neuigkeitDetail.init(POST.slug);

    const html = window.content.innerHTML;
    expect(window.setHeadline).toHaveBeenCalledWith('Ordner für Personas');
    expect(html).toContain('So geht');
    expect(html).toContain('Oeffnen Sie Personas');
    expect(html).toContain('https://cdn.example/abc/persona.png');
    expect(html).toContain('Sie können Personas jetzt in Ordnern sortieren.');
  });

  it('rendert den Post auch ohne Screenshot', async () => {
    window.isInternal = () => true;
    const ohneShot = { ...POST, schritte: [{ titel: 'Schritt', text: 'Text', route: '/persona', screenshot_path: null }] };
    window.supabase = {
      from: vi.fn(() => chain({ data: ohneShot, error: null })),
      storage: {
        from: vi.fn(() => ({
          getPublicUrl: vi.fn(() => ({ data: { publicUrl: null } }))
        }))
      }
    };

    await neuigkeitDetail.init(POST.slug);

    const html = window.content.innerHTML;
    expect(html).toContain('Schritt');
    expect(html).not.toContain('neuigkeit-schritt__screenshot');
  });
});
