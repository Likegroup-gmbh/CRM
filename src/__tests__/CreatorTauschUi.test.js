import { describe, it, expect, beforeEach, vi } from 'vitest';
import { tauschMenuItemHtml, TAUSCH_ACTION } from '../modules/creator-tausch/creatorTauschUi.js';
import {
  tauschBannerHtml,
  tauschSkriptButtonHtml,
  quittiereTausch
} from '../modules/skripte/editor/skriptTauschBanner.js';

const vermerk = { vorher_name: 'Mia <b>', jetzt_name: 'Lea', quittiert: false };

describe('tauschMenuItemHtml', () => {
  const item = { id: 'i1', creator_id: 'c1' };

  it('zeigt den Eintrag fuer echte Eintraege mit Creator', () => {
    const html = tauschMenuItemHtml(item, {});
    expect(html).toContain(`data-action="${TAUSCH_ACTION}"`);
    expect(html).toContain('data-id="i1"');
  });

  it('versteckt ihn ohne Creator, bei Vorschlaegen, Kunden und ohne Bearbeiten-Recht', () => {
    expect(tauschMenuItemHtml({ id: 'i1' }, {})).toBe('');
    expect(tauschMenuItemHtml({ ...item, isVorschlag: true }, {})).toBe('');
    expect(tauschMenuItemHtml(item, { isKunde: true })).toBe('');
    expect(tauschMenuItemHtml(item, { canEdit: false })).toBe('');
  });
});

describe('Skript-Banner', () => {
  beforeEach(() => { window.isInternal = () => true; });

  it('zeigt den Hinweis intern und escaped die Namen', () => {
    const html = tauschBannerHtml({ creator_tausch: vermerk });
    expect(html).toContain('Lea');
    expect(html).toContain('Mia &lt;b&gt;');
    expect(html).toContain('ed-tausch-quittieren');
  });

  it('zeigt nichts ohne Vermerk, nach Quittieren oder fuer Externe', () => {
    expect(tauschBannerHtml({})).toBe('');
    expect(tauschBannerHtml({ creator_tausch: { ...vermerk, quittiert: true } })).toBe('');
    window.isInternal = () => false;
    expect(tauschBannerHtml({ creator_tausch: vermerk })).toBe('');
  });

  it('hat den Tauschen-Button mit stabiler ID', () => {
    expect(tauschSkriptButtonHtml()).toContain('id="ed-creator-tauschen"');
  });

  it('quittiert: Vermerk bleibt, Banner verschwindet', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    window.supabase = { from: vi.fn(() => ({ update })) };
    const view = { skript: { id: 's1', creator_tausch: vermerk }, renderDoc: vi.fn() };
    await quittiereTausch(view);
    expect(update).toHaveBeenCalledWith({ creator_tausch: { ...vermerk, quittiert: true } });
    expect(view.skript.creator_tausch.quittiert).toBe(true);
    expect(view.renderDoc).toHaveBeenCalled();
  });
});
