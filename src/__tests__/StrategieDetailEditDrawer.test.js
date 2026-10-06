import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  showEditItemDrawer,
  removeEditItemDrawer,
  visibleVideoideen
} from '../modules/strategie/VideoideeDrawer.js';
import { persistVideoideeEdit } from '../modules/strategie/videoideeEdit.js';
import { detectPlatform, isTranscribableUrl } from '../modules/strategie/addItemPayload.js';
import { syncVideoideeField } from '../modules/strategie/videoideeFieldSync.js';
import { strategieService } from '../modules/strategie/StrategieService.js';

const SCREENSHOT_URL = 'https://xxx.supabase.co/storage/v1/object/public/strategie-screenshots/screenshots/shot.jpg';

function detailStub(item) {
  return {
    strategieId: 'strat-1',
    items: [item],
    rerenderItemsTable: vi.fn()
  };
}

beforeEach(() => {
  window.toastSystem = { show: vi.fn() };
  vi.spyOn(strategieService, 'updateStrategieItem').mockResolvedValue({});
  vi.spyOn(strategieService, 'deleteScreenshot').mockResolvedValue();
  vi.spyOn(strategieService, 'enqueueItemProcessing').mockResolvedValue(true);
});

afterEach(() => {
  document.body.innerHTML = '';
  delete window.toastSystem;
  vi.restoreAllMocks();
});

describe('persistVideoideeEdit – Screenshot beim Link-Entfernen', () => {
  it('loescht den Screenshot und setzt screenshot_url auf null, wenn die URL geleert wird', async () => {
    const item = {
      id: 'i1',
      video_link: 'https://tiktok.com/@x/video/1',
      screenshot_url: SCREENSHOT_URL,
      teilbereich: 'Reels',
      beschreibung: 'Hook'
    };
    const detail = detailStub(item);

    const result = await persistVideoideeEdit(detail, 'i1', {
      art: 'idee',
      video_link: '',
      teilbereich: 'Reels',
      beschreibung: 'Hook',
      umsetzungsvorgabe: 'alte Vorgabe'
    });

    expect(result).toEqual({ ok: true });

    expect(strategieService.deleteScreenshot).toHaveBeenCalledWith(SCREENSHOT_URL);
    expect(strategieService.updateStrategieItem).toHaveBeenCalledWith('i1', expect.objectContaining({
      video_link: null,
      umsetzungsvorgabe: null,
      screenshot_url: null,
      transkript: null,
      caption: null,
      verarbeitung_status: null
    }));
    expect(strategieService.updateStrategieItem.mock.calls[0][1].kundenadaption).toBeUndefined();
    expect(strategieService.enqueueItemProcessing).not.toHaveBeenCalled();
    expect(item.screenshot_url).toBeNull();
  });

  it('wirft den alten Screenshot weg, wenn der Link gewechselt wird', async () => {
    const item = {
      id: 'i1',
      video_link: 'https://tiktok.com/@x/video/1',
      screenshot_url: SCREENSHOT_URL,
      teilbereich: null,
      beschreibung: null
    };
    const detail = detailStub(item);

    await persistVideoideeEdit(detail, 'i1', {
      art: 'videoreferenz',
      video_link: 'https://instagram.com/reel/abc',
      teilbereich: '',
      beschreibung: '',
      umsetzungsvorgabe: 'Nur der Schnitt'
    });

    expect(strategieService.deleteScreenshot).toHaveBeenCalledWith(SCREENSHOT_URL);
    expect(strategieService.updateStrategieItem).toHaveBeenCalledWith('i1', expect.objectContaining({
      video_link: 'https://instagram.com/reel/abc',
      umsetzungsvorgabe: 'Nur der Schnitt',
      kundenadaption: null,
      kundenadaption_quelle: null,
      screenshot_url: null,
      verarbeitung_status: 'pending'
    }));
    expect(strategieService.enqueueItemProcessing).toHaveBeenCalledWith('strat-1', 'i1');
  });

  it('fasst den Screenshot nicht an, wenn die URL gleich bleibt', async () => {
    const item = {
      id: 'i1',
      video_link: 'https://tiktok.com/@x/video/1',
      screenshot_url: SCREENSHOT_URL,
      teilbereich: 'Reels',
      beschreibung: 'Neu'
    };

    await persistVideoideeEdit(detailStub(item), 'i1', {
      art: 'videoreferenz',
      video_link: 'https://tiktok.com/@x/video/1',
      teilbereich: 'Reels',
      beschreibung: 'Neu',
      umsetzungsvorgabe: 'Die Hook'
    });

    expect(strategieService.deleteScreenshot).not.toHaveBeenCalled();
    expect(strategieService.updateStrategieItem).toHaveBeenCalledWith('i1', expect.not.objectContaining({
      screenshot_url: null
    }));
    expect(strategieService.updateStrategieItem).toHaveBeenCalledWith('i1', expect.objectContaining({
      umsetzungsvorgabe: 'Die Hook'
    }));
  });

  it('speichert eine Videoreferenz nicht ohne Umsetzungsvorgabe', async () => {
    const item = {
      id: 'i1',
      video_link: 'https://tiktok.com/@x/video/1',
      screenshot_url: SCREENSHOT_URL,
      beschreibung: 'Hook'
    };

    const result = await persistVideoideeEdit(detailStub(item), 'i1', {
      art: 'videoreferenz',
      video_link: 'https://tiktok.com/@x/video/1',
      beschreibung: 'Hook',
      umsetzungsvorgabe: '  '
    });

    expect(strategieService.updateStrategieItem).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, error: 'Was sollen wir von diesem Video umsetzen?' });
  });

  it('behaelt bei bestehenden YouTube-Links die Plattform und startet keine Verarbeitung', async () => {
    const item = {
      id: 'i1',
      video_link: 'https://youtube.com/watch?v=1',
      plattform: 'youtube',
      beschreibung: 'Alt'
    };

    const result = await persistVideoideeEdit(detailStub(item), 'i1', {
      art: 'videoreferenz',
      video_link: 'https://youtube.com/watch?v=1',
      beschreibung: 'Neu',
      umsetzungsvorgabe: 'Die Hook'
    });

    expect(result).toEqual({ ok: true });
    expect(strategieService.updateStrategieItem).toHaveBeenCalledWith('i1', expect.objectContaining({
      plattform: 'youtube',
      beschreibung: 'Neu'
    }));
    expect(strategieService.enqueueItemProcessing).not.toHaveBeenCalled();
  });

  it('lehnt einen neuen YouTube-Link ab', async () => {
    const item = { id: 'i1', video_link: null, beschreibung: 'Idee' };

    const result = await persistVideoideeEdit(detailStub(item), 'i1', {
      art: 'videoreferenz',
      video_link: 'https://youtube.com/watch?v=1',
      beschreibung: 'Idee',
      umsetzungsvorgabe: 'Die Hook'
    });

    expect(result).toEqual({ ok: false, error: 'Nur TikTok- und Instagram-Links sind erlaubt' });
    expect(strategieService.updateStrategieItem).not.toHaveBeenCalled();
  });

  it('behaelt die Kundenadaption, wenn aus einer Idee eine Videoreferenz wird', async () => {
    const item = {
      id: 'i1',
      video_link: null,
      kundenadaption: 'Handgeschrieben',
      beschreibung: 'Idee'
    };

    await persistVideoideeEdit(detailStub(item), 'i1', {
      art: 'videoreferenz',
      video_link: 'https://tiktok.com/@x/video/1',
      beschreibung: 'Idee',
      umsetzungsvorgabe: 'Die Hook'
    });

    const updates = strategieService.updateStrategieItem.mock.calls[0][1];
    expect(updates.kundenadaption).toBeUndefined();
    expect(updates.umsetzungsvorgabe).toBe('Die Hook');
    expect(updates.verarbeitung_status).toBe('pending');
  });
});

describe('detectPlatform / isTranscribableUrl', () => {
  it('erkennt die Plattform und liefert ohne URL null', () => {
    expect(detectPlatform('')).toBeNull();
    expect(detectPlatform(null)).toBeNull();
    expect(detectPlatform('https://www.tiktok.com/@x/video/1')).toBe('tiktok');
    expect(detectPlatform('https://instagram.com/reel/abc')).toBe('instagram');
    expect(detectPlatform('https://youtu.be/abc')).toBe('youtube');
    expect(detectPlatform('https://example.com')).toBe('other');
  });

  it('erlaubt nur TikTok und Instagram', () => {
    expect(isTranscribableUrl('https://tiktok.com/x')).toBe(true);
    expect(isTranscribableUrl('https://INSTAGRAM.com/reel/x')).toBe(true);
    expect(isTranscribableUrl('https://youtube.com/watch?v=1')).toBe(false);
    expect(isTranscribableUrl('')).toBe(false);
  });
});

describe('Videoidee-Drawer', () => {
  afterEach(() => {
    removeEditItemDrawer();
  });

  function open(items, extra = {}) {
    showEditItemDrawer({
      items,
      canEdit: true,
      isKunde: false,
      getTeilbereicheFromStrategie: () => ['Reels'],
      rerenderItemsTable: vi.fn(),
      ...extra
    }, items[0].id);
  }

  it('oeffnet eine Idee ohne Transkript und mit versteckter Umsetzungsvorgabe', () => {
    open([{ id: 'i1', video_link: null, beschreibung: '' }]);

    expect(document.querySelector('#edit-item-drawer button[type="submit"]')).toBeNull();
    expect(document.getElementById('videoidee-drawer-title').textContent).toBe('Idee');
    expect(document.querySelector('[data-videoidee-section="transkript"]')).toBeNull();
    expect(document.querySelector('[data-videoidee-section="caption"]')).toBeNull();
    expect(document.querySelector('[data-videoidee-section="umsetzungsvorgabe"]').hidden).toBe(true);
    expect(document.querySelector('[data-videoidee-section="beschreibung"] textarea')).toBeTruthy();
    expect(document.getElementById('videoidee-pos').textContent).toBe('1 von 1');
    expect(document.querySelector('[data-action="videoidee-prev"]').disabled).toBe(true);
    expect(document.querySelector('[data-action="videoidee-next"]').disabled).toBe(true);
    expect(document.querySelector('.videoidee-props [data-videoidee-prio]')).toBeTruthy();
    expect(document.querySelector('.videoidee-props [data-videoidee-prop="status"]')).toBeTruthy();
    expect(document.querySelector('.videoidee-doc__shot')?.tagName).toBe('DIV');
    expect(document.querySelector('.videoidee-props .strategie-umgesetzt-state, .videoidee-props [data-field="video_umgesetzt"]')).toBeTruthy();
    expect(document.querySelector('.videoidee-drawer__header [data-videoidee-prio]')).toBeNull();
    expect(document.querySelector('[data-videoidee-section="anmerkung"]')).toBeNull();
    expect(document.querySelector('[data-videoidee-section="kundenadaption"]')).toBeNull();
    expect(document.querySelector('.videoidee-drawer__footer').textContent).not.toContain('Anmerkung');
  });

  it('zeigt Feld-Icons an den Property-Labels', () => {
    open([{ id: 'i1', video_link: null, beschreibung: '' }]);

    const href = (prop) => document
      .querySelector(`[data-videoidee-prop="${prop}"] .videoidee-props__label use`)
      ?.getAttribute('href');

    expect(href('video_link')).toBe('#crm-icon-video');
    expect(href('teilbereich')).toBe('#crm-icon-tag');
    expect(href('creator')).toBe('#crm-icon-creator');
    expect(href('produkt')).toBe('#crm-icon-cube');
    expect(href('prio')).toBe('#crm-icon-prio');
    expect(href('status')).toBe('#crm-icon-status');
    expect(href('umsetzen')).toBe('#crm-icon-check');
  });

  it('zeigt die Skript-Freigabe als erste Property und Prio direkt vor Umsetzen', () => {
    open([{ id: 'i1', video_link: null, beschreibung: '', skript_freigabe: true }]);

    const props = [...document.querySelectorAll('.videoidee-props [data-videoidee-prop]')]
      .map((row) => row.dataset.videoideeProp);
    const badge = document.querySelector('.videoidee-props [data-videoidee-status] .status-badge');

    expect(props[0]).toBe('status');
    expect(props.indexOf('umsetzen')).toBe(props.indexOf('prio') + 1);
    expect(badge.classList.contains('success')).toBe(true);
    expect(badge.textContent).toBe('Freigegeben');
  });

  it('zeigt einen Gedankenstrich, wenn die Freigabe fehlt, und zieht den Badge nach', () => {
    const items = [{ id: 'i1', video_link: null, beschreibung: '' }];
    const detail = {
      items,
      canEdit: true,
      isKunde: false,
      getTeilbereicheFromStrategie: () => ['Reels'],
      rerenderItemsTable: vi.fn()
    };
    showEditItemDrawer(detail, items[0].id);

    const slot = document.querySelector('[data-videoidee-status]');
    expect(slot.textContent.trim()).toBe('–');
    expect(slot.querySelector('.status-badge')).toBeNull();

    items[0].skript_freigabe = true;
    document.dispatchEvent(new CustomEvent('videoidee-table-rendered'));

    expect(document.querySelector('[data-videoidee-status] .status-badge').textContent).toBe('Freigegeben');
  });

  it('zeigt dem Kunden und bei einem Vorschlag keine Status-Zeile', () => {
    open([{ id: 'i1', video_link: null, beschreibung: '', skript_freigabe: true }], { isKunde: true });
    expect(document.querySelector('[data-videoidee-prop="status"]')).toBeNull();

    removeEditItemDrawer();
    open([{ id: 'i1', ist_vorschlag: true, beschreibung: 'Sandwich', video_link: null, skript_freigabe: true }]);
    expect(document.querySelector('[data-videoidee-prop="status"]')).toBeNull();
  });

  it('legt Zurück und Weiter in den Footer, beim Vorschlag die Aktionen in den Header', () => {
    open([{ id: 'i1', video_link: null, beschreibung: '' }]);

    const footer = document.querySelector('.videoidee-drawer__footer');
    expect([...footer.children].map((el) => el.id || el.dataset.action)).toEqual([
      'videoidee-prev',
      'videoidee-pos',
      'videoidee-next'
    ]);
    expect(footer.querySelector('[data-field]')).toBeNull();

    removeEditItemDrawer();
    open([{ id: 'i1', ist_vorschlag: true, beschreibung: 'Sandwich', video_link: null }]);

    const header = document.querySelector('.videoidee-drawer__header');
    expect(header.querySelector('[data-action="uebernehmen-vorschlag"]')).toBeTruthy();
    expect(header.querySelector('[data-action="verwerfen-vorschlag"]')).toBeTruthy();
    expect(header.querySelector('[data-videoidee-prio]')).toBeNull();
    expect(header.textContent).not.toContain('Umsetzen');
  });

  it('oeffnet eine Videoreferenz mit Vorgabe', () => {
    open([{ id: 'i1', video_link: 'https://tiktok.com/x', umsetzungsvorgabe: 'Nur die Hook', beschreibung: '' }]);

    const shot = document.querySelector('.videoidee-doc__shot');
    expect(shot.tagName).toBe('A');
    expect(shot.getAttribute('href')).toBe('https://tiktok.com/x');
    expect(shot.getAttribute('target')).toBe('_blank');

    const block = document.querySelector('[data-videoidee-section="umsetzungsvorgabe"]');
    expect(block.hidden).toBe(false);
    expect(block.querySelector('textarea').value).toBe('Nur die Hook');
    expect(document.querySelector('[data-videoidee-section="transkript"]')).toBeTruthy();
    const caption = document.querySelector('[data-videoidee-section="caption"]');
    expect(caption).toBeTruthy();
    expect(caption.classList.contains('is-collapsed')).toBe(true);
    expect(caption.querySelector('[data-videoidee-toggle="caption"]').getAttribute('aria-expanded')).toBe('false');
    expect(caption.querySelector('.videoidee-doc__section-body').hidden).toBe(true);
    expect([...document.querySelectorAll('[data-videoidee-section]')].map((el) => el.dataset.videoideeSection)).toEqual([
      'kopf',
      'beschreibung',
      'transkript',
      'umsetzungsvorgabe',
      'kundenadaption',
      'anmerkung',
      'caption'
    ]);
  });

  it('klappt nur die Caption auf und wieder zu', () => {
    open([{ id: 'i1', video_link: 'https://tiktok.com/x', caption: 'Hook #ad', beschreibung: 'B' }]);

    for (const name of ['beschreibung', 'transkript', 'umsetzungsvorgabe', 'kundenadaption', 'anmerkung']) {
      const section = document.querySelector(`[data-videoidee-section="${name}"]`);
      expect(section?.querySelector('[data-videoidee-toggle]')).toBeNull();
    }

    const caption = document.querySelector('[data-videoidee-section="caption"]');
    const btn = caption.querySelector('[data-videoidee-toggle="caption"]');
    const body = caption.querySelector('.videoidee-doc__section-body');

    expect(caption.classList.contains('is-collapsed')).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(body.hidden).toBe(true);
    expect(body.querySelector('textarea').value).toBe('Hook #ad');

    btn.click();
    expect(caption.classList.contains('is-collapsed')).toBe(false);
    expect(caption.classList.contains('is-expanded')).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(body.hidden).toBe(false);

    btn.click();
    expect(caption.classList.contains('is-collapsed')).toBe(true);
    expect(caption.classList.contains('is-expanded')).toBe(false);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(body.hidden).toBe(true);
  });

  it('zeigt einem Vorschlag Übernehmen und Verwerfen, der Inhalt bleibt lesbar', () => {
    open([{ id: 'i1', ist_vorschlag: true, beschreibung: 'Sandwich', video_link: null }]);

    expect(document.querySelector('[data-action="uebernehmen-vorschlag"]')).toBeTruthy();
    expect(document.querySelector('[data-action="verwerfen-vorschlag"]')).toBeTruthy();
    expect(document.querySelector('#edit-item-drawer textarea[data-field="beschreibung"]')).toBeNull();
    expect(document.querySelector('[data-videoidee-section="beschreibung"]').textContent).toContain('Sandwich');
    expect(document.querySelector('[data-videoidee-section="anmerkung"]')).toBeNull();
    expect(document.querySelector('[data-videoidee-section="kundenadaption"]')).toBeNull();
  });

  it('setzt Leerzeilen zwischen den Beschreibungs-Labels', () => {
    open([{
      id: 'i1',
      ist_vorschlag: true,
      video_link: null,
      beschreibung: 'Titel\nPain Point: Müde\nHook: Aufwachen\nKernbotschaft: Kaffee\nAblauf: Trinken'
    }]);

    expect(document.querySelector('.videoidee-doc__prose').textContent).toBe([
      'Titel',
      'Pain Point: Müde',
      'Hook: Aufwachen',
      'Kernbotschaft: Kaffee',
      'Ablauf: Trinken'
    ].join('\n\n'));
  });

  it('zeigt Kundenadaption und Anmerkung nur mit Video-Link oder vorhandenem Text', () => {
    open([{ id: 'i1', video_link: null, beschreibung: 'Idee', kunde_anmerkung: 'Passt' }]);
    expect(document.querySelector('[data-videoidee-section="anmerkung"]').textContent).toContain('Passt');
    expect(document.querySelector('[data-videoidee-section="kundenadaption"]')).toBeNull();

    removeEditItemDrawer();
    open([{ id: 'i1', video_link: 'https://tiktok.com/x', beschreibung: 'Ref' }]);
    expect(document.querySelector('[data-videoidee-section="anmerkung"]')).toBeTruthy();
    expect(document.querySelector('[data-videoidee-section="kundenadaption"]')).toBeTruthy();
  });

  it('blendet leere Inhaltsabschnitte fuer den Kunden aus', () => {
    open(
      [{ id: 'i1', video_link: null, beschreibung: '', kundenadaption: 'So laeuft es' }],
      { isKunde: true, canEdit: false }
    );

    expect(document.querySelector('[data-videoidee-section="beschreibung"]')).toBeNull();
    expect(document.querySelector('[data-videoidee-section="umsetzungsvorgabe"]')).toBeNull();
    expect(document.querySelector('[data-videoidee-section="kundenadaption"]').textContent).toContain('So laeuft es');
    expect(document.querySelector('[data-videoidee-section="anmerkung"]')).toBeNull();
  });

  it('schaltet mit Weiter zur naechsten Videoidee', async () => {
    open([
      { id: 'i1', video_link: null, beschreibung: 'Eins' },
      { id: 'i2', video_link: null, beschreibung: 'Zwei' }
    ]);

    expect(document.getElementById('videoidee-pos').textContent).toBe('1 von 2');
    document.querySelector('[data-action="videoidee-next"]').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.getElementById('videoidee-pos').textContent).toBe('2 von 2');
    expect(document.querySelector('[data-field="beschreibung"]').value).toBe('Zwei');
    expect(document.querySelector('[data-action="videoidee-next"]').disabled).toBe(true);
  });

  it('schaltet mit Pfeil rechts, solange kein Feld fokussiert ist', async () => {
    open([
      { id: 'i1', video_link: null, beschreibung: 'Eins' },
      { id: 'i2', video_link: null, beschreibung: 'Zwei' }
    ]);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(document.getElementById('videoidee-pos').textContent).toBe('2 von 2');

    const field = document.querySelector('[data-field="beschreibung"]');
    field.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await Promise.resolve();
    expect(document.getElementById('edit-item-drawer').dataset.itemId).toBe('i2');
  });
});

describe('visibleVideoideen', () => {
  it('nimmt Vorschlaege zuerst, dann die Kategorien der Tabelle', () => {
    const vorschlag = { id: 'v1', ist_vorschlag: true, teilbereich: null };
    const a = { id: 'a1', teilbereich: 'A' };
    const b = { id: 'b1', teilbereich: 'B' };
    const detail = {
      items: [b, vorschlag, a],
      getTeilbereicheFromStrategie: () => ['A', 'B']
    };
    expect(visibleVideoideen(detail).map((item) => item.id)).toEqual(['v1', 'a1', 'b1']);
  });
});

describe('syncVideoideeField', () => {
  it('ueberschreibt das fokussierte Feld nicht', () => {
    document.body.innerHTML = `
      <textarea id="focused" data-field="beschreibung" data-item-id="i1">alt</textarea>
      <textarea id="peer" data-field="beschreibung" data-item-id="i1">alt</textarea>
    `;
    const focused = document.getElementById('focused');
    const peer = document.getElementById('peer');
    focused.focus();
    syncVideoideeField('i1', 'beschreibung', 'neu', null);
    expect(focused.value).toBe('alt');
    expect(peer.value).toBe('neu');
  });
});
