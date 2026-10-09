// Hook-Sperre (ADR 0054): gesperrter gesprochener Hook bleibt in Generierung und Edit,
// das Schloss sitzt an der Hook-Zeile der Videoreferenz.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';
import { showEditItemDrawer, removeEditItemDrawer } from '../modules/strategie/VideoideeDrawer.js';
import { strukturZuText } from '../modules/strategie/videoidee/beschreibungStruktur.js';
import { persistVideoideeEdit } from '../modules/strategie/videoideeEdit.js';
import { strategieService } from '../modules/strategie/StrategieService.js';

const require = createRequire(import.meta.url);
const {
  gesperrterHook, ladeGesperrtenHook, hookSperreEditBlock, hookSperreGenerierungBlock,
  varianteOhneGesperrtenHook, filtereHookSperre, trifftGesprochenenHook, hookLagImAuftrag,
  mitHookHinweis, HOOK_SPERRE_HINWEIS
} = require('../../netlify/functions/_shared/hook-sperre.js');
const { buildEditPrompt } = require('../../netlify/functions/_shared/skript-edit-prompt.js');
const { buildPrompt } = require('../../netlify/functions/skript-generate-background.js');
const { ersetzeBeschreibung } = require('../../netlify/functions/_shared/beschreibung-analyse.js');

const STRUKTUR = {
  titel: 'Perimenopause',
  angle: 'Wiedererkennung',
  hook: 'Vier Zeichen dafür, dass du in der Perimenopause bist.',
  visual_hook: 'Aus dem Auto gefilmt',
  hauptteil: 'Die Person nennt vier Zeichen.',
  cta: 'Klick hier.'
};

const referenz = (extra = {}) => ({
  id: 'i1',
  video_link: 'https://tiktok.com/x',
  umsetzungsvorgabe: 'U',
  beschreibung: strukturZuText(STRUKTUR),
  beschreibung_struktur: STRUKTUR,
  hook_gesperrt: false,
  ...extra
});

describe('gesperrterHook', () => {
  it('liefert den Hook nur bei gesetzter Sperre', () => {
    expect(gesperrterHook(referenz({ hook_gesperrt: true }))).toBe(STRUKTUR.hook);
    expect(gesperrterHook(referenz())).toBeNull();
    expect(gesperrterHook(null)).toBeNull();
  });

  it('liest Altbestand aus dem Fliesstext', () => {
    const item = referenz({ hook_gesperrt: true, beschreibung_struktur: null });
    expect(gesperrterHook(item)).toBe(STRUKTUR.hook);
  });

  it('kennt keinen gesperrten leeren Hook', () => {
    const item = referenz({ hook_gesperrt: true, beschreibung_struktur: { ...STRUKTUR, hook: '' } });
    expect(gesperrterHook(item)).toBeNull();
  });

  it('ladeGesperrtenHook überlebt einen Lesefehler', async () => {
    const supabase = {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'x' } }) }) }) })
    };
    expect(await ladeGesperrtenHook(supabase, 'i1')).toBeNull();
    expect(await ladeGesperrtenHook(supabase, null)).toBeNull();
  });
});

describe('Edit-Filter', () => {
  const hook = 'Vier Zeichen.';

  it('verwirft nur den gesprochenen Hook im Bundle', () => {
    const liste = [
      { sektion: 'hook', spalte: 'gesprochen', vorschlag_text: 'x' },
      { sektion: 'hook', spalte: 'visuell', vorschlag_text: 'y' },
      { sektion: 'hauptteil', spalte: 'gesprochen', vorschlag_text: 'z' },
      { sektion: 'hook_variante_1', spalte: 'gesprochen', vorschlag_text: 'v' }
    ];
    const r = filtereHookSperre(liste, hook);
    expect(r.verworfen).toHaveLength(1);
    expect(r.behalten.map((a) => `${a.sektion}/${a.spalte}`)).toEqual([
      'hook/visuell', 'hauptteil/gesprochen', 'hook_variante_1/gesprochen'
    ]);
  });

  it('lässt ohne Sperre alles durch', () => {
    const liste = [{ sektion: 'hook', spalte: 'gesprochen', vorschlag_text: 'x' }];
    expect(filtereHookSperre(liste, null).behalten).toHaveLength(1);
  });

  it('trifft nur Sektion hook in der gesprochenen Spalte', () => {
    expect(trifftGesprochenenHook({ sektion: 'hook', ist_visuell: false })).toBe(true);
    expect(trifftGesprochenenHook({ sektion: 'hook', ist_visuell: true })).toBe(false);
    expect(trifftGesprochenenHook({ sektion: 'hauptteil', ist_visuell: false })).toBe(false);
  });

  it('der Hook liegt im Auftrag bei Alles, benanntem Hook und Hook-Button', () => {
    const chat = { aktion: 'chat' };
    expect(hookLagImAuftrag({ message: chat, umfang: 'alles' })).toBe(true);
    expect(hookLagImAuftrag({ message: chat, umfang: 'teil', umfangSektion: 'hook' })).toBe(true);
    expect(hookLagImAuftrag({ message: chat, umfang: 'teil', umfangSektion: 'cta' })).toBe(false);
    expect(hookLagImAuftrag({ message: chat, umfang: 'markierung' })).toBe(false);
    expect(hookLagImAuftrag({ message: { aktion: 'kuerzen', sektion: 'hook' } })).toBe(true);
    expect(hookLagImAuftrag({ message: { aktion: 'kuerzen', sektion: 'cta' } })).toBe(false);
    expect(hookLagImAuftrag({ message: { aktion: 'visuell', sektion: 'hook' } })).toBe(false);
  });

  it('hängt den Hinweis an die Antwort, aber nur einmal', () => {
    expect(mitHookHinweis('Ich habe den CTA überarbeitet.', true))
      .toBe(`Ich habe den CTA überarbeitet. ${HOOK_SPERRE_HINWEIS}`);
    expect(mitHookHinweis('Ich habe den CTA überarbeitet.', false)).toBe('Ich habe den CTA überarbeitet.');
    const schon = 'Der Hook ist vom Kunden freigegeben und bleibt.';
    expect(mitHookHinweis(schon, true)).toBe(schon);
    expect(mitHookHinweis(null, true)).toBe(HOOK_SPERRE_HINWEIS);
  });

  it('der Edit-Prompt nennt den gesperrten Hook, ohne Sperre nichts', () => {
    const skript = { id: 's1', hook: 'H', hauptteil: 'T', cta: 'C', bereich: 'influencer_marketing', prompt_kontext: {} };
    const basis = { skript, history: [], kontext: { master: [], briefing: null }, modus: null };
    const message = { aktion: 'chat', sektion: 'gesamt', inhalt: 'Überarbeite alles' };

    const mit = buildEditPrompt({ ...basis, gesperrterHook: 'Freigegebener Hook.' }, message).task;
    expect(mit).toContain('# HOOK-SPERRE');
    expect(mit).toContain('Freigegebener Hook.');

    expect(buildEditPrompt(basis, message).task).not.toContain('# HOOK-SPERRE');
    expect(hookSperreEditBlock(null)).toBe('');
  });
});

describe('Generierung', () => {
  it('der Prompt verlangt den Wortlaut nur mit Sperre', () => {
    const ctx = { master: [], briefing: null, bereich: 'influencer_marketing' };
    const mit = buildPrompt(ctx, {}, '', { gesperrterHook: 'Freigegebener Hook.' }).task;
    expect(mit).toContain('# GESPERRTER HOOK');
    expect(mit).toContain('Freigegebener Hook.');
    expect(buildPrompt(ctx, {}, '').task).not.toContain('# GESPERRTER HOOK');
    expect(hookSperreGenerierungBlock(null)).toBe('');
  });

  it('entfernt eine Variante, die dem gesperrten Hook gleicht, und rückt nach', () => {
    const r = varianteOhneGesperrtenHook({
      hook_variante_1: 'Gesperrt', hook_variante_2: 'Anders', hook_variante_3: null
    }, 'Gesperrt');
    expect(r).toEqual({ hook_variante_1: 'Anders', hook_variante_2: null, hook_variante_3: null });
  });
});

describe('Neu analysieren', () => {
  function fakeSupabase(item) {
    const updates = [];
    const chain = (table) => new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === 'then') {
          const result = table === 'ki_requests' ? { count: 0, data: null, error: null } : { data: null, error: null };
          return (resolve) => resolve(result);
        }
        if (prop === 'maybeSingle') return async () => ({ data: item, error: null });
        if (prop === 'single') return async () => ({ data: { id: 'ki-1' }, error: null });
        if (prop === 'update') {
          return (patch) => {
            if (table === 'strategie_items') updates.push(patch);
            return chain(table);
          };
        }
        return () => chain(table);
      }
    });
    return { from: (table) => chain(table), updates };
  }

  beforeEach(() => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acc';
    process.env.CLOUDFLARE_AI_TOKEN = 'tok';
    const neu = { ...STRUKTUR, hook: 'Neuer KI-Hook', angle: 'Neuer Angle' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, result: { response: JSON.stringify(neu) } })
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_AI_TOKEN;
  });

  const basis = { id: 'i1', video_link: 'https://tiktok.com/x', transkript: 'Text', caption: 'Cap' };

  it('behält den gesperrten Hook und schreibt die übrigen Zeilen neu', async () => {
    const supabase = fakeSupabase({
      ...basis, hook_gesperrt: true, beschreibung: strukturZuText(STRUKTUR), beschreibung_struktur: STRUKTUR
    });
    const result = await ersetzeBeschreibung(supabase, { userId: 'u1', itemId: 'i1' });

    expect(result.beschreibung_struktur.hook).toBe(STRUKTUR.hook);
    expect(result.beschreibung_struktur.angle).toBe('Neuer Angle');
    expect(result.beschreibung).toContain(`Hook: ${STRUKTUR.hook}`);
    expect(result.beschreibung).toContain('Neuer Angle');
  });

  it('ersetzt den Hook ohne Sperre', async () => {
    const supabase = fakeSupabase({ ...basis, hook_gesperrt: false, beschreibung_struktur: STRUKTUR });
    const result = await ersetzeBeschreibung(supabase, { userId: 'u1', itemId: 'i1' });
    expect(result.beschreibung_struktur.hook).toBe('Neuer KI-Hook');
  });
});

describe('Schloss im Drawer', () => {
  beforeEach(() => {
    window.toastSystem = { show: vi.fn() };
    vi.spyOn(strategieService, 'updateStrategieItem').mockResolvedValue({});
  });

  afterEach(() => {
    removeEditItemDrawer();
    document.body.innerHTML = '';
    delete window.toastSystem;
    vi.restoreAllMocks();
  });

  function open(item, extra = {}) {
    const detail = {
      items: [item],
      canEdit: true,
      isKunde: false,
      getTeilbereicheFromStrategie: () => [],
      rerenderItemsTable: vi.fn(),
      ...extra
    };
    showEditItemDrawer(detail, item.id);
    return detail;
  }

  const lock = () => document.querySelector('[data-action="toggle-hook-sperre"]');

  it('zeigt dem Team einen Schalter an der Hook-Zeile, dem Kunden nichts', () => {
    open(referenz());
    const hookRow = document.querySelector('[data-videoidee-struktur="hook"]');
    expect(hookRow.querySelector('[data-action="toggle-hook-sperre"]')).toBeTruthy();
    expect(document.querySelectorAll('[data-action="toggle-hook-sperre"]')).toHaveLength(1);
    expect(lock().getAttribute('aria-pressed')).toBe('false');

    removeEditItemDrawer();
    open(referenz({ hook_gesperrt: true }), { isKunde: true, canEdit: false });
    expect(document.querySelector('.videoidee-struktur__lock')).toBeNull();
  });

  it('zeigt Teammitgliedern ohne Rechte nur den Status', () => {
    open(referenz({ hook_gesperrt: true }), { canEdit: false });
    expect(document.querySelector('[data-action="toggle-hook-sperre"]')).toBeNull();
    expect(document.querySelector('.videoidee-struktur__lock.is-locked')).toBeTruthy();

    removeEditItemDrawer();
    open(referenz({ hook_gesperrt: false }), { canEdit: false });
    expect(document.querySelector('.videoidee-struktur__lock')).toBeNull();
  });

  it('sperrt den Hook und speichert nur das Flag', async () => {
    const item = referenz();
    open(item);
    lock().click();

    await vi.waitFor(() => expect(strategieService.updateStrategieItem).toHaveBeenCalled());
    expect(strategieService.updateStrategieItem).toHaveBeenCalledWith('i1', { hook_gesperrt: true });
    expect(item.hook_gesperrt).toBe(true);
    await vi.waitFor(() => expect(lock().getAttribute('aria-pressed')).toBe('true'));
  });

  it('schreibt bei Altbestand die Struktur mit, behält aber den Fliesstext', async () => {
    const alt = [
      'Titel: T', 'Hook: Alter Hook.', 'Hauptteil: Teil.', 'CTA: Los.'
    ].join('\n');
    const item = referenz({ beschreibung_struktur: null, beschreibung: alt });
    open(item);
    lock().click();

    await vi.waitFor(() => expect(strategieService.updateStrategieItem).toHaveBeenCalled());
    const updates = strategieService.updateStrategieItem.mock.calls[0][1];
    expect(updates.hook_gesperrt).toBe(true);
    expect(updates.beschreibung_struktur.hook).toBe('Alter Hook.');
    expect(updates).not.toHaveProperty('beschreibung');
  });

  it('entsperrt mit einem Klick', async () => {
    const item = referenz({ hook_gesperrt: true });
    open(item);
    lock().click();

    await vi.waitFor(() => expect(strategieService.updateStrategieItem).toHaveBeenCalled());
    expect(strategieService.updateStrategieItem).toHaveBeenCalledWith('i1', { hook_gesperrt: false });
    expect(item.hook_gesperrt).toBe(false);
  });

  it('sperrt keinen leeren Hook', () => {
    open(referenz({ beschreibung_struktur: { ...STRUKTUR, hook: '' } }));
    expect(lock().disabled).toBe(true);
    lock().click();
    expect(strategieService.updateStrategieItem).not.toHaveBeenCalled();
  });

  it('öffnet die Sperre, wenn der Hook-Text geleert wird', async () => {
    const item = referenz({ hook_gesperrt: true });
    open(item);
    const area = document.querySelector('textarea[data-field="beschreibung_struktur.hook"]');
    area.value = '';
    area.dispatchEvent(new Event('blur'));

    await vi.waitFor(() => expect(strategieService.updateStrategieItem).toHaveBeenCalled());
    expect(strategieService.updateStrategieItem.mock.calls[0][1].hook_gesperrt).toBe(false);
    expect(item.hook_gesperrt).toBe(false);
  });

  it('lässt den Hook von Hand änderbar und die Sperre stehen', async () => {
    const item = referenz({ hook_gesperrt: true });
    open(item);
    const area = document.querySelector('textarea[data-field="beschreibung_struktur.hook"]');
    expect(area.disabled).toBe(false);
    area.value = 'Neuer Hook von Hand.';
    area.dispatchEvent(new Event('blur'));

    await vi.waitFor(() => expect(strategieService.updateStrategieItem).toHaveBeenCalled());
    const updates = strategieService.updateStrategieItem.mock.calls[0][1];
    expect(updates.beschreibung_struktur.hook).toBe('Neuer Hook von Hand.');
    expect(updates).not.toHaveProperty('hook_gesperrt');
  });

  it('nimmt die Sperre mit, wenn Freitext die Struktur ersetzt', async () => {
    const item = referenz({ hook_gesperrt: true });
    const detail = { items: [item], strategieId: 's1' };
    await persistVideoideeEdit(detail, 'i1', {
      art: 'videoreferenz',
      video_link: item.video_link,
      umsetzungsvorgabe: 'U',
      beschreibung: 'Neuer Freitext'
    });
    const updates = strategieService.updateStrategieItem.mock.calls[0][1];
    expect(updates.beschreibung_struktur).toBeNull();
    expect(updates.hook_gesperrt).toBe(false);
  });
});
