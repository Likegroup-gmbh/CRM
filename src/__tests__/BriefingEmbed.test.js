// BriefingEmbed.test.js
// BriefingDetail im Embed-Modus (Produktion, Tab Briefing) und Löschen über das
// zentrale entityUpdated-Event statt eigenem Löschpfad.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../modules/briefing/BriefingProdukte.js', () => ({
  loadBriefingProdukte: vi.fn(async () => [])
}));

import { BriefingDetail } from '../modules/briefing/BriefingDetail.js';

const row = {
  id: 'b1',
  aktivierung_name: 'Sommer',
  bereich: 'influencer_marketing',
  is_draft: false,
  persona_ids: [],
  unternehmen: { id: 'u1', firmenname: 'Firma', logo_url: null },
  marke: null
};

function supabaseStub() {
  const query = {
    select: () => query,
    eq: () => query,
    single: async () => ({ data: { ...row }, error: null })
  };
  return { from: () => query };
}

function deleted(id) {
  window.dispatchEvent(new CustomEvent('entityUpdated', {
    detail: { entity: 'briefing', action: 'deleted', id }
  }));
}

describe('BriefingDetail embedded', () => {
  let host;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    window.supabase = supabaseStub();
    window.isAdmin = () => true;
    window.isInternal = () => false;
    window.setHeadline = vi.fn();
    window.setContentSafely = vi.fn();
    window.navigateTo = vi.fn();
    window.validatorSystem = { sanitizeHtml: (s) => String(s ?? '') };
  });

  afterEach(() => {
    host.remove();
  });

  it('rendert das Dokument im Host, mit Bearbeiten, ohne Headline und Seitenwechsel', async () => {
    const doc = new BriefingDetail();
    await doc.mountEmbedded(host, 'b1');

    expect(host.querySelector('.briefing-detail--embedded')).not.toBeNull();
    expect(host.querySelector('#btn-edit-briefing')).not.toBeNull();
    expect(host.textContent).toContain('Sommer');
    expect(window.setHeadline).not.toHaveBeenCalled();
    expect(window.setContentSafely).not.toHaveBeenCalled();
    doc.destroy();
  });

  it('Bearbeiten öffnet den Wizard', async () => {
    const doc = new BriefingDetail();
    await doc.mountEmbedded(host, 'b1');

    host.querySelector('#btn-edit-briefing').click();
    await vi.waitFor(() => expect(window.navigateTo).toHaveBeenCalledWith('/briefing/b1/edit'));
    doc.destroy();
  });

  it('Löschen-Event der eigenen Id ruft onDeleted, fremde Ids nicht', async () => {
    const onDeleted = vi.fn();
    const doc = new BriefingDetail();
    await doc.mountEmbedded(host, 'b1', { onDeleted });

    deleted('b2');
    expect(onDeleted).not.toHaveBeenCalled();

    deleted('b1');
    expect(onDeleted).toHaveBeenCalledWith('b1');
    expect(window.navigateTo).not.toHaveBeenCalled();
    doc.destroy();
  });

  it('nach destroy reagiert der Embed nicht mehr und schreibt nichts in die Seite', async () => {
    const onDeleted = vi.fn();
    const doc = new BriefingDetail();
    await doc.mountEmbedded(host, 'b1', { onDeleted });
    doc.destroy();

    deleted('b1');
    expect(onDeleted).not.toHaveBeenCalled();
    expect(window.setContentSafely).not.toHaveBeenCalled();
  });

  it('ein Mount, der vor dem Laden zerstört wird, rendert nichts', async () => {
    const doc = new BriefingDetail();
    const mounting = doc.mountEmbedded(host, 'b1');
    doc.destroy();
    await mounting;

    expect(host.innerHTML).toBe('');
  });
});

describe('BriefingDetail Seite: Löschen', () => {
  beforeEach(() => {
    window.content = document.createElement('div');
    document.body.appendChild(window.content);
    window.supabase = supabaseStub();
    window.isAdmin = () => true;
    window.isInternal = () => false;
    window.setHeadline = vi.fn();
    window.setContentSafely = vi.fn((el, html) => { if (el?.nodeType) el.innerHTML = html; });
    window.navigateTo = vi.fn();
    window.breadcrumbSystem = { updateDetailLabel: vi.fn() };
    window.validatorSystem = { sanitizeHtml: (s) => String(s ?? '') };
  });

  afterEach(() => {
    window.content.remove();
    delete window.breadcrumbSystem;
    window.moduleRegistry = undefined;
  });

  it('navigiert nach dem zentralen Löschen-Event zurück', async () => {
    const page = new BriefingDetail();
    window.moduleRegistry = { currentModule: page };
    await page.init('b1');

    expect(window.content.querySelector('#btn-edit-briefing')).toBeNull();

    deleted('b1');
    expect(window.navigateTo).toHaveBeenCalledWith('/briefing');
    page.destroy();
  });
});
