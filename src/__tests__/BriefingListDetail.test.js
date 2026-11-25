// BriefingListDetail.test.js
// Smoke-Tests: BriefingList rendert Zeilen aus campaign_briefings,
// BriefingDetail formatiert die Feldtypen aus fieldConfig korrekt.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BriefingDetail } from '../modules/briefing/BriefingDetail.js';
import { BriefingList } from '../modules/briefing/BriefingList.js';
import { BEREICH_LABELS } from '../modules/briefing/create/fieldConfig.js';
import { BriefingCreate } from '../modules/briefing/create/BriefingCreateCore.js';

describe('BriefingList Smoke', () => {
  it('BEREICH_LABELS deckt alle Bereiche ab', () => {
    expect(BEREICH_LABELS.influencer_marketing).toBe('Influencer');
    expect(BEREICH_LABELS.paid_creator_ads).toBe('Paid');
    expect(BEREICH_LABELS.owned_social).toBe('Organic');
  });

  it('BriefingList-Modul ist importierbar und Singleton vorhanden', async () => {
    const mod = await import('../modules/briefing/BriefingList.js');
    expect(mod.briefingList).toBeTruthy();
    expect(typeof mod.briefingList.init).toBe('function');
  });

  it('createUrl gibt Ordner-Kontext mit und lässt Ohne-Marke weg', () => {
    const list = new BriefingList();
    expect(list.createUrl()).toBe('/briefing/new');

    list.currentUnternehmenId = 'u1';
    expect(list.createUrl()).toBe('/briefing/new?unternehmen=u1');

    list.currentMarkeId = 'm1';
    expect(list.createUrl()).toBe('/briefing/new?unternehmen=u1&marke=m1');

    list._ohneMarke = true;
    expect(list.createUrl()).toBe('/briefing/new?unternehmen=u1');
  });
});

describe('BriefingCreate Prefill', () => {
  it('applyQueryPrefill setzt Unternehmen und Marke, ignoriert marke=ohne', () => {
    const original = window.location.search;
    const instance = new BriefingCreate();

    window.history.replaceState({}, '', '/briefing/new?unternehmen=u1&marke=m1');
    instance.applyQueryPrefill();
    expect(instance.formData.unternehmen_id).toBe('u1');
    expect(instance.formData.marke_id).toBe('m1');

    instance.formData = {};
    window.history.replaceState({}, '', '/briefing/new?unternehmen=u1&marke=ohne');
    instance.applyQueryPrefill();
    expect(instance.formData.unternehmen_id).toBe('u1');
    expect(instance.formData.marke_id).toBeUndefined();

    window.history.replaceState({}, '', original || '/');
  });
});

describe('BriefingDetail formatValue', () => {
  let detail;

  beforeEach(() => {
    detail = new BriefingDetail();
    detail.briefing = {};
    window.supabase = {
      storage: {
        from: () => ({ getPublicUrl: (p) => ({ data: { publicUrl: `https://cdn.test/${p}` } }) })
      }
    };
  });

  it('leere Werte werden ausgeblendet', () => {
    expect(detail.formatValue({ name: 'x', type: 'text' }, null)).toBeNull();
    expect(detail.formatValue({ name: 'x', type: 'text' }, '')).toBeNull();
    expect(detail.formatValue({ name: 'x', type: 'checkboxes' }, [])).toBeNull();
  });

  it('radio mappt auf Option-Label', () => {
    const field = {
      name: 'ansatz', type: 'radio',
      options: [{ value: 'kampagne', label: 'Kampagne' }, { value: 'always_on', label: 'Always-on' }]
    };
    expect(detail.formatValue(field, 'always_on')).toBe('Always-on');
  });

  it('checkboxes rendern Tags mit Labels', () => {
    const field = {
      name: 'im_funnel_stufen', type: 'checkboxes',
      options: [{ value: 'upper', label: 'Upper Funnel' }, { value: 'lower', label: 'Lower Funnel' }]
    };
    const html = detail.formatValue(field, ['upper', 'lower']);
    expect(html).toContain('Upper Funnel');
    expect(html).toContain('Lower Funnel');
    expect(html).toContain('tag--type');
  });

  it('Videolänge als Spanne oder Mindestlänge', () => {
    const field = { name: 'videolaenge', type: 'videolaenge' };
    expect(detail.formatValue(field, { art: 'intervall', von: 15, bis: 20 })).toBe('15–20 Sek.');
    expect(detail.formatValue(field, { art: 'minimum', von: 30, bis: null })).toBe('ab 30 Sek.');
  });

  it('Ideenliste markiert verbindlich und verlinkt Links', () => {
    const html = detail.formatValue({ name: 'umsetzungsideen_eintraege', type: 'ideenListe' }, [
      { text: 'https://www.tiktok.com/@x/video/1', verbindlich: true },
      { text: 'Unboxing', verbindlich: false },
      { text: '' }
    ]);
    expect(html).toContain('<a href="https://www.tiktok.com/@x/video/1"');
    expect(html.split('<br>')).toHaveLength(2);
    expect(html.indexOf('Verbindlich')).toBeLessThan(html.indexOf('Inspiration'));
  });

  it('channelGroup zeigt nur belegte Channels', () => {
    const field = {
      name: 'im_channels', type: 'channelGroup',
      channels: [
        { key: 'instagram', label: 'Instagram', formats: [{ value: 'reel', label: 'Reel' }] },
        { key: 'tiktok', label: 'TikTok', formats: [{ value: 'video', label: 'TikTok Video' }] }
      ]
    };
    const html = detail.formatValue(field, { instagram: ['reel'], tiktok: [] });
    expect(html).toContain('Instagram');
    expect(html).toContain('Reel');
    expect(html).not.toContain('TikTok');
  });

  it('repeatableUpload verlinkt Uploads ueber Storage-URL', () => {
    const field = { name: 'im_beispiele', type: 'repeatableUpload' };
    const html = detail.formatValue(field, [
      { typ: 'upload', value: 'campaign-briefings/b1/video.mp4', label: 'Beispiel 1' },
      { typ: 'url', value: 'https://example.com/post' }
    ]);
    expect(html).toContain('https://cdn.test/campaign-briefings/b1/video.mp4');
    expect(html).toContain('Beispiel 1');
    expect(html).toContain('https://example.com/post');
  });

  it('escape schuetzt gegen HTML-Injection', () => {
    const html = detail.formatValue({ name: 'aktivierung_name', type: 'text' }, '<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
  });
});

describe('BriefingDocView', () => {
  let detail;

  const sampleBriefing = {
    bereich: 'influencer_marketing',
    is_draft: false,
    aktivierung_name: 'Sommer-Launch TEWH',
    beschreibung: 'Barrier Repair Serum Launch',
    aufgabe: 'Serum in der Abendroutine zeigen',
    plattformen: ['instagram'],
    content_deadline: '2023-08-01',
    learnings_text: 'Hook in den ersten zwei Sekunden',
    verhandlungshinweis: 'Nutzungsdauer auf 6 Monate herunterhandeln',
    unternehmen: { firmenname: 'Skincare Brand' },
    marke: { markenname: 'Skincare', logo_url: 'https://cdn.test/skincare.svg' },
    produkte: [{ id: 'p1', name: 'Barrier Repair Serum' }, { id: 'p2', name: 'Night Cream' }],
    created_at: '2023-07-01T10:00:00.000Z',
    updated_at: '2023-07-15T10:00:00.000Z'
  };

  beforeEach(async () => {
    const { BriefingDetail } = await import('../modules/briefing/BriefingDetail.js');
    detail = new BriefingDetail();
    detail.briefing = { ...sampleBriefing };
    window.validatorSystem = {
      sanitizeHtml: (s) => String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
    };
    window.supabase = {
      storage: {
        from: () => ({ getPublicUrl: (p) => ({ data: { publicUrl: `https://cdn.test/${p}` } }) })
      }
    };
  });

  it('zeigt die befüllten Sektionen des Creator-Briefings in PDF-Reihenfolge', async () => {
    const { renderBriefingDoc } = await import('../modules/briefing/BriefingDocView.js');
    const html = renderBriefingDoc({ detail, compact: true });
    const sektionen = [...html.matchAll(/data-sektion="([^"]+)"/g)].map(m => m[1]);
    expect(sektionen).toEqual(['rahmen', 'produkt', 'umsetzung']);
    expect(html).toContain('Kampagnenübersicht &amp; Rahmen');
    expect(html).toContain('Barrier Repair Serum Launch');
    expect(html).toContain('Serum in der Abendroutine zeigen');
    expect(html).toContain('Verbindliche Vorgaben und freie Inspiration bitte klar unterscheiden.');
  });

  it('Kompakt ohne leere Felder und Admin-Meta, Alle Felder mit beidem', async () => {
    const { renderBriefingDoc } = await import('../modules/briefing/BriefingDocView.js');
    const compact = renderBriefingDoc({ detail, compact: true, canEdit: true });
    expect(compact).toContain('Komprimierte Ansicht');
    expect(compact).not.toContain('data-feld="kernbotschaft"');
    expect(compact).not.toContain('Erstellt');
    expect(compact).toContain('Alle Felder');

    const alle = renderBriefingDoc({ detail, compact: false, canEdit: true });
    expect(alle).toContain('data-feld="kernbotschaft"');
    expect(alle).toContain('data-placeholder="Was soll beim Publikum hängen bleiben?"');
    expect(alle).toContain('Erstellt');
    expect(alle).toContain('Komprimiert');
    expect(alle).not.toContain('Komprimierte Ansicht');
  });

  it('Altfelder nur unter Frühere Angaben und nur mit Recht', async () => {
    const { renderBriefingDoc } = await import('../modules/briefing/BriefingDocView.js');
    expect(renderBriefingDoc({ detail, compact: false })).not.toContain('Hook in den ersten zwei Sekunden');
    const mit = renderBriefingDoc({ detail, compact: true, fruehereAngaben: true });
    expect(mit).toContain('Frühere Angaben');
    expect(mit).toContain('Hook in den ersten zwei Sekunden');
    expect(mit).toContain('Nutzungsdauer auf 6 Monate herunterhandeln');
    expect(mit).not.toMatch(/briefing-doc__alt" open/);
    expect(renderBriefingDoc({ detail, compact: false, fruehereAngaben: true })).toMatch(/briefing-doc__alt" open/);
  });

  it('Hero zeigt Badges, Unterzeile, Produkte und Meta-Chips', async () => {
    const { renderBriefingDoc } = await import('../modules/briefing/BriefingDocView.js');
    const html = renderBriefingDoc({ detail, compact: true, canDelete: true });
    expect(html).toContain('Final');
    expect(html).toContain('Influencer');
    expect(html).toContain('Skincare Brand');
    expect(html).toContain('briefing-doc__lockup');
    expect(html).toContain('briefing-doc__lockup-x');
    expect(html).toContain('https://cdn.test/skincare.svg');
    expect(html).toContain('Abgabe');
    expect(html).toContain('briefing-doc__products');
    expect(html.indexOf('Barrier Repair Serum')).toBeLessThan(html.indexOf('Sommer-Launch TEWH'));
    expect(html.indexOf('Night Cream')).toBeLessThan(html.indexOf('Sommer-Launch TEWH'));
    expect(html).toContain('mdc-btn mdc-btn--delete');
    expect(html).toContain('#crm-icon-trash');
    expect(html).not.toContain('mdc-btn--sm');
  });

  it('ohne Produkte keine Zeile über der Headline', async () => {
    const { renderBriefingDoc } = await import('../modules/briefing/BriefingDocView.js');
    detail.briefing = { ...detail.briefing, produkte: [] };
    const html = renderBriefingDoc({ detail, compact: true, canDelete: false });
    expect(html).not.toContain('briefing-doc__products');
  });

  it('Titel ist nur mit Bearbeiten-Recht ein Feld, nicht im Druck', async () => {
    const { renderBriefingDoc } = await import('../modules/briefing/BriefingDocView.js');
    const editable = renderBriefingDoc({ detail, canEdit: true });
    expect(editable).toContain('data-feld="aktivierung_name"');
    expect(editable).toContain('Sommer-Launch TEWH');

    const readonly = renderBriefingDoc({ detail });
    expect(readonly).not.toContain('data-feld="aktivierung_name"');
    expect(readonly).toContain('Sommer-Launch TEWH');

    const print = renderBriefingDoc({ detail, canEdit: true, print: true });
    expect(print).not.toContain('data-feld="aktivierung_name"');
    expect(print).toContain('Sommer-Launch TEWH');
  });

  it('leerer Titel bleibt der letzte Name und wird nicht geschrieben', async () => {
    const { renderBriefingDoc, bindBriefingDoc } = await import('../modules/briefing/BriefingDocView.js');
    document.body.innerHTML = renderBriefingDoc({ detail, canEdit: true });
    const root = document.querySelector('.briefing-doc');
    const updates = [];
    window.toastSystem = { show: () => {} };
    window.supabase = {
      from: () => ({
        update: (payload) => {
          updates.push(payload);
          return { eq: () => Promise.resolve({ error: null }) };
        }
      })
    };
    const handle = bindBriefingDoc(root, { briefingId: 'b1', canEdit: true });
    const title = root.querySelector('[data-feld="aktivierung_name"]');
    title.textContent = '   ';
    title.dispatchEvent(new Event('input', { bubbles: true }));
    await handle.inlineEdit.flush();
    expect(updates).toEqual([]);
    expect(title.textContent).toBe('Sommer-Launch TEWH');
    await handle.destroy();
  });

  it('Titel speichert getrimmt und ohne Zeilenumbrueche', async () => {
    const { renderBriefingDoc, bindBriefingDoc } = await import('../modules/briefing/BriefingDocView.js');
    document.body.innerHTML = renderBriefingDoc({ detail, canEdit: true });
    const root = document.querySelector('.briefing-doc');
    const updates = [];
    const saved = [];
    window.toastSystem = { show: () => {} };
    window.supabase = {
      from: () => ({
        update: (payload) => {
          updates.push(payload);
          return { eq: () => Promise.resolve({ error: null }) };
        }
      })
    };
    const handle = bindBriefingDoc(root, {
      briefingId: 'b1',
      canEdit: true,
      onSaved: (feld, text) => saved.push([feld, text])
    });
    const title = root.querySelector('[data-feld="aktivierung_name"]');
    title.textContent = '  Herbst\nLaunch  ';
    title.dispatchEvent(new Event('input', { bubbles: true }));
    await handle.inlineEdit.flush();
    expect(updates).toEqual([{ aktivierung_name: 'Herbst Launch' }]);
    expect(saved).toEqual([['aktivierung_name', 'Herbst Launch']]);
    await handle.destroy();
  });

  it('Anschreiben sitzt zwischen Alle Felder und Loeschen, nicht im Print', async () => {
    const { renderBriefingDoc } = await import('../modules/briefing/BriefingDocView.js');
    const withBtn = renderBriefingDoc({ detail, canAnschreiben: true, canDelete: true });
    expect(withBtn).toContain('briefing-doc-head');
    expect(withBtn).toContain('btn-anschreiben-briefing');
    expect(withBtn).toContain('mdc-btn__icon');
    expect(withBtn).toContain('mdc-btn__label');
    expect(withBtn).toContain('#crm-icon-list-bullet');
    expect(withBtn).toContain('#crm-icon-mail-send');
    expect(withBtn).toContain('#crm-icon-trash');
    expect(withBtn).not.toContain('mdc-btn--sm');
    expect(withBtn.indexOf('briefing-doc-head')).toBeLessThan(withBtn.indexOf('btn-briefing-fields-toggle'));
    expect(withBtn.indexOf('btn-briefing-fields-toggle')).toBeLessThan(withBtn.indexOf('btn-anschreiben-briefing'));
    expect(withBtn.indexOf('btn-anschreiben-briefing')).toBeLessThan(withBtn.indexOf('btn-delete-briefing'));
    expect(withBtn.indexOf('btn-delete-briefing')).toBeLessThan(withBtn.indexOf('briefing-doc__badges'));
    expect(withBtn).not.toContain('briefing-doc__title-row');
    expect(withBtn).not.toContain('briefing-doc__toolbar');

    const expanded = renderBriefingDoc({ detail, compact: false, canAnschreiben: true });
    expect(expanded).toContain('#crm-icon-arrows-collapse');

    const without = renderBriefingDoc({ detail, canAnschreiben: false });
    expect(without).not.toContain('btn-anschreiben-briefing');

    const print = renderBriefingDoc({ detail, canAnschreiben: true, canDelete: true, print: true });
    expect(print).not.toContain('briefing-doc-head');
    expect(print).not.toContain('btn-anschreiben-briefing');
    expect(print).not.toContain('btn-briefing-fields-toggle');
    expect(print).not.toContain('btn-delete-briefing');
  });

  it('Bearbeiten sitzt nur mit showEdit und canEdit zwischen Alle Felder und Anschreiben', async () => {
    const { renderBriefingDoc } = await import('../modules/briefing/BriefingDocView.js');
    const html = renderBriefingDoc({ detail, canEdit: true, showEdit: true, canAnschreiben: true, canDelete: true });
    expect(html).toContain('btn-edit-briefing');
    expect(html).toContain('#crm-icon-pencil-square');
    expect(html.indexOf('btn-briefing-fields-toggle')).toBeLessThan(html.indexOf('btn-edit-briefing'));
    expect(html.indexOf('btn-edit-briefing')).toBeLessThan(html.indexOf('btn-anschreiben-briefing'));

    expect(renderBriefingDoc({ detail, canEdit: true })).not.toContain('btn-edit-briefing');
    expect(renderBriefingDoc({ detail, canEdit: false, showEdit: true })).not.toContain('btn-edit-briefing');
    expect(renderBriefingDoc({ detail, canEdit: true, showEdit: true, print: true })).not.toContain('btn-edit-briefing');
  });

  it('Duplizieren erscheint nur mit canDuplicate und nicht im Druck', async () => {
    const { renderBriefingDoc } = await import('../modules/briefing/BriefingDocView.js');
    const html = renderBriefingDoc({ detail, canEdit: true, showEdit: true, canAnschreiben: true, canDuplicate: true });
    expect(html).toContain('btn-duplicate-briefing');
    expect(html).toContain('#crm-icon-document-duplicate');
    expect(html.indexOf('btn-edit-briefing')).toBeLessThan(html.indexOf('btn-duplicate-briefing'));
    expect(html.indexOf('btn-duplicate-briefing')).toBeLessThan(html.indexOf('btn-anschreiben-briefing'));

    expect(renderBriefingDoc({ detail, canEdit: true })).not.toContain('btn-duplicate-briefing');
    expect(renderBriefingDoc({ detail, canDuplicate: true, print: true })).not.toContain('btn-duplicate-briefing');
  });

  it('embedded setzt den Modifier für den Produktions-Tab', async () => {
    const { renderBriefingDoc } = await import('../modules/briefing/BriefingDocView.js');
    expect(renderBriefingDoc({ detail, embedded: true })).toContain('briefing-detail--embedded');
    expect(renderBriefingDoc({ detail })).not.toContain('briefing-detail--embedded');
  });
});
