import { describe, it, expect, afterEach } from 'vitest';
import { createRequire } from 'module';
import { buildAddItemQueueEntry, buildStrategieItemInsert, resolveVideoideeForm } from '../modules/strategie/addItemPayload.js';
import { AddItemDrawer } from '../modules/strategie/AddItemDrawer.js';

const require = createRequire(import.meta.url);
const { shouldApplyKiBeschreibung } = require('../../netlify/functions/_shared/ki-beschreibung.js');

describe('shouldApplyKiBeschreibung', () => {
  it('laesst die KI nur bei leerem oder fehlendem Text schreiben', () => {
    expect(shouldApplyKiBeschreibung(null)).toBe(true);
    expect(shouldApplyKiBeschreibung('')).toBe(true);
    expect(shouldApplyKiBeschreibung('   ')).toBe(true);
  });

  it('schuetzt vorhandenen Text', () => {
    expect(shouldApplyKiBeschreibung('Herbstliches Sandwich')).toBe(false);
    expect(shouldApplyKiBeschreibung('  Cheeseburger Toasties  ')).toBe(false);
  });
});

describe('buildAddItemQueueEntry', () => {
  it('behaelt die Beschreibung auch neben einer Video-URL', () => {
    const entry = buildAddItemQueueEntry({
      id: 'q1',
      url: 'https://tiktok.com/@x/video/1',
      kategorie: 'Rezepte',
      beschreibung: '  Herbstliches Sandwich  ',
      platform: 'tiktok'
    });

    expect(entry.url).toBe('https://tiktok.com/@x/video/1');
    expect(entry.beschreibung).toBe('Herbstliches Sandwich');
    expect(entry.kategorie).toBe('Rezepte');
    expect(entry.status).toBe('pending');
  });

  it('laesst die Beschreibung leer, wenn niemand etwas eintraegt', () => {
    const entry = buildAddItemQueueEntry({
      id: 'q2',
      url: 'https://instagram.com/reel/abc',
      beschreibung: '   ',
      platform: 'instagram'
    });

    expect(entry.beschreibung).toBeNull();
  });
});

describe('buildStrategieItemInsert', () => {
  it('markiert mitgebrachten Text als user', () => {
    const insert = buildStrategieItemInsert({
      strategieId: 's1',
      sortierung: 3,
      nextItem: {
        url: 'https://tiktok.com/@x/video/1',
        platform: 'tiktok',
        kategorie: 'Rezepte',
        beschreibung: 'Herbstliches Sandwich'
      }
    });

    expect(insert).toEqual({
      strategie_id: 's1',
      video_link: 'https://tiktok.com/@x/video/1',
      plattform: 'tiktok',
      sortierung: 3,
      teilbereich: 'Rezepte',
      beschreibung: 'Herbstliches Sandwich',
      beschreibung_quelle: 'user',
      umsetzungsvorgabe: null,
      verarbeitung_status: 'pending'
    });
  });

  it('laesst quelle leer, damit die KI fuellen darf', () => {
    const insert = buildStrategieItemInsert({
      strategieId: 's1',
      sortierung: 0,
      nextItem: {
        url: 'https://tiktok.com/@x/video/1',
        platform: 'tiktok',
        kategorie: null,
        beschreibung: null
      }
    });

    expect(insert.beschreibung).toBeNull();
    expect(insert.beschreibung_quelle).toBeNull();
    expect(insert.umsetzungsvorgabe).toBeNull();
    expect(insert.verarbeitung_status).toBe('pending');
  });

  it('legt eine Idee ohne Verarbeitung an', () => {
    const insert = buildStrategieItemInsert({
      strategieId: 's1',
      sortierung: 0,
      nextItem: {
        url: null,
        platform: 'idea',
        kategorie: null,
        beschreibung: 'Nur die Idee'
      }
    });

    expect(insert.video_link).toBeNull();
    expect(insert.plattform).toBeNull();
    expect(insert.beschreibung_quelle).toBe('user');
    expect(insert.umsetzungsvorgabe).toBeNull();
    expect(insert.verarbeitung_status).toBeNull();
  });

  it('traegt die Umsetzungsvorgabe nur neben einem Link', () => {
    const insert = buildStrategieItemInsert({
      strategieId: 's1',
      sortierung: 1,
      nextItem: {
        url: 'https://tiktok.com/@x/video/1',
        platform: 'tiktok',
        kategorie: null,
        beschreibung: null,
        umsetzungsvorgabe: '  Nur die Hook  '
      }
    });

    expect(insert.umsetzungsvorgabe).toBe('Nur die Hook');
  });
});

describe('resolveVideoideeForm', () => {
  it('verlangt URL und Vorgabe fuer eine Videoreferenz', () => {
    expect(resolveVideoideeForm({ art: 'videoreferenz', url: '', umsetzungsvorgabe: 'Hook' }).ok).toBe(false);
    expect(resolveVideoideeForm({ art: 'videoreferenz', url: 'https://t', umsetzungsvorgabe: '  ' }).ok).toBe(false);
    const ok = resolveVideoideeForm({
      art: 'videoreferenz',
      url: ' https://tiktok.com/x ',
      umsetzungsvorgabe: ' Nur die Hook ',
      beschreibung: ''
    });
    expect(ok).toMatchObject({
      ok: true,
      url: 'https://tiktok.com/x',
      umsetzungsvorgabe: 'Nur die Hook',
      beschreibung: null
    });
  });

  it('verlangt bei einer Idee die Beschreibung und wirft Link und Vorgabe weg', () => {
    expect(resolveVideoideeForm({ art: 'idee', beschreibung: '  ' }).ok).toBe(false);
    const ok = resolveVideoideeForm({
      art: 'idee',
      url: 'https://tiktok.com/x',
      umsetzungsvorgabe: 'Hook',
      beschreibung: ' Sandwich '
    });
    expect(ok).toMatchObject({
      ok: true,
      url: null,
      umsetzungsvorgabe: null,
      beschreibung: 'Sandwich'
    });
  });
});

describe('AddItemDrawer Tabs', () => {
  afterEach(() => {
    document.getElementById('add-item-drawer')?.remove();
    document.getElementById('add-item-drawer-overlay')?.remove();
  });

  it('startet auf Videoreferenz und blendet den Link im Idee-Tab aus', () => {
    const drawer = new AddItemDrawer();
    drawer.open({ id: 's1' }, []);

    expect(document.querySelector('[data-add-art="videoreferenz"]').classList.contains('active')).toBe(true);
    expect(document.getElementById('drawer-umsetzungsvorgabe')).toBeTruthy();
    expect(document.querySelector('[data-art-panel="videoreferenz"]').hidden).toBe(false);

    document.querySelector('[data-add-art="idee"]').click();

    expect(drawer.art).toBe('idee');
    expect(document.querySelector('[data-art-panel="videoreferenz"]').hidden).toBe(true);
    expect(document.getElementById('drawer-beschreibung').placeholder).toContain('Idee');
  });
});
