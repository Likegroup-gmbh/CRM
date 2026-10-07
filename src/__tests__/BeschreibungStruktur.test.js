import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';
import {
  BESCHREIBUNG_FELDER,
  normalisiereStruktur,
  parseFliesstext,
  parseStruktur,
  strukturZuText
} from '../modules/strategie/videoidee/beschreibungStruktur.js';
import {
  showEditItemDrawer,
  removeEditItemDrawer
} from '../modules/strategie/VideoideeDrawer.js';
import { persistVideoideeEdit } from '../modules/strategie/videoideeEdit.js';
import { renderItemRow } from '../modules/strategie/StrategieDetailRenderer.js';
import { strategieService } from '../modules/strategie/StrategieService.js';

const require = createRequire(import.meta.url);
const { runDescription } = require('../../netlify/functions/_shared/video-transcribe.js');

const STRUKTUR = {
  titel: '4 Zeichen für die Perimenopause',
  angle: 'Symptom-Aufzählung als Wiedererkennungs-Moment',
  hook: 'Vier Zeichen dafür, dass du in der Perimenopause bist.',
  visual_hook: 'Aus dem Auto gefilmt',
  hauptteil: 'Die Person nennt vier Zeichen der Reihe nach.',
  cta: 'Klick hier und erfahre mehr.'
};

describe('beschreibungStruktur', () => {
  it('kennt sechs Felder in fester Reihenfolge', () => {
    expect(BESCHREIBUNG_FELDER.map((f) => f.key)).toEqual([
      'titel', 'angle', 'hook', 'visual_hook', 'hauptteil', 'cta'
    ]);
  });

  it('leitet den Fliesstext ab: Titel als Erstzeile, Absatz je Feld', () => {
    expect(strukturZuText(STRUKTUR)).toBe([
      '4 Zeichen für die Perimenopause',
      'Angle: Symptom-Aufzählung als Wiedererkennungs-Moment',
      'Hook: Vier Zeichen dafür, dass du in der Perimenopause bist.',
      'Visual Hook: Aus dem Auto gefilmt',
      'Hauptteil: Die Person nennt vier Zeichen der Reihe nach.',
      'CTA: Klick hier und erfahre mehr.'
    ].join('\n\n'));
  });

  it('lässt leere Felder im Text weg', () => {
    expect(strukturZuText({ titel: 'T', hook: 'H' })).toBe('T\n\nHook: H');
  });

  it('liefert für leere oder ungültige Struktur null bzw. leeren Text', () => {
    expect(normalisiereStruktur({ titel: '  ', hook: '' })).toBeNull();
    expect(normalisiereStruktur(null)).toBeNull();
    expect(normalisiereStruktur([])).toBeNull();
    expect(strukturZuText(null)).toBe('');
  });

  it('nimmt umschließende Anführungszeichen ab', () => {
    const s = normalisiereStruktur({ titel: '„Mein Titel“', hook: '"Hallo"' });
    expect(s.titel).toBe('Mein Titel');
    expect(s.hook).toBe('Hallo');
  });

  it('parst JSON mit Fence, Einleitung und Aliasen', () => {
    const raw = 'Hier die Analyse:\n```json\n{"title":"T","visualHook":"V","hook":"H"}\n```';
    const s = parseStruktur(raw);
    expect(s.titel).toBe('T');
    expect(s.visual_hook).toBe('V');
    expect(s.hook).toBe('H');
    expect(s.cta).toBe('');
  });

  it('nimmt ein Objekt direkt (JSON-Modus)', () => {
    expect(parseStruktur({ titel: 'T' }).titel).toBe('T');
  });

  it('gibt bei Fließtext oder kaputtem JSON null zurück', () => {
    expect(parseStruktur('Das Video zeigt vier Zeichen.')).toBeNull();
    expect(parseStruktur('{"titel": ')).toBeNull();
    expect(parseStruktur('')).toBeNull();
    expect(parseStruktur(undefined)).toBeNull();
  });
});

const ALT_TEXT_1 = [
  'Titel: „4 Zeichen für die Perimenopause“',
  'Hook: „Vier Zeichen dafür, dass du in der Perimenopause bist.“ Visual Hook: aus dem Auto gefilmt, damit das Video nicht zu statisch wirkt.',
  'Hauptteil: Die Person nennt vier Zeichen der Reihe nach; sie',
  'ordnet die Hormone ein. Überleitung zum CTA: „Erkennst du dich wieder?',
  'Unterstütze dich mit den PeriMenopause Kapseln von Bärbel Drexel.“',
  'CTA: „Klick hier und erfahre mehr.“'
].join('\n');

describe('parseFliesstext (Altbestand)', () => {
  it('zerlegt den Fließtext in die Felder, Visual Hook auch mitten in der Zeile', () => {
    const s = parseFliesstext(ALT_TEXT_1);
    expect(s.titel).toBe('4 Zeichen für die Perimenopause');
    expect(s.angle).toBe('');
    expect(s.hook).toBe('Vier Zeichen dafür, dass du in der Perimenopause bist.');
    expect(s.visual_hook).toBe('aus dem Auto gefilmt, damit das Video nicht zu statisch wirkt.');
    expect(s.cta).toBe('Klick hier und erfahre mehr.');
  });

  it('lässt „Überleitung zum CTA:“ im Hauptteil stehen und fügt Zeilenumbrüche zusammen', () => {
    const s = parseFliesstext(ALT_TEXT_1);
    expect(s.hauptteil).toContain('Überleitung zum CTA: „Erkennst du dich wieder? Unterstütze dich');
    expect(s.hauptteil).not.toContain('\n');
  });

  it('versteht Absätze und Hook-Wert mit Anführungszeichen im Text', () => {
    const s = parseFliesstext([
      'Titel: „So hilfst du deinem Körper bei der Perimenopause“',
      '',
      'Hook: Der Titel steht als Headline auf dem Bild: „So hilfst du deinem Körper“',
      '',
      'Hauptteil: Ein Hintergrundbild mit Infos.',
      '',
      'CTA: „Klick hier und erfahre mehr.“'
    ].join('\n'));
    expect(s.titel).toBe('So hilfst du deinem Körper bei der Perimenopause');
    expect(s.hook).toBe('Der Titel steht als Headline auf dem Bild: „So hilfst du deinem Körper“');
    expect(s.hauptteil).toBe('Ein Hintergrundbild mit Infos.');
    expect(s.visual_hook).toBe('');
  });

  it('gibt null für normalen Fließtext oder zu wenige Labels', () => {
    expect(parseFliesstext('Ein Video über vier Zeichen.')).toBeNull();
    expect(parseFliesstext('Titel: T\nCTA: C')).toBeNull();
    expect(parseFliesstext('Hook: H\nCTA: C\nTitel: T')).toBeNull();
    expect(parseFliesstext('')).toBeNull();
  });
});

describe('runDescription', () => {
  function antwort(response) {
    return { ok: true, json: async () => ({ success: true, result: { response } }) };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('liefert Struktur und abgeleiteten Text', async () => {
    const fetchMock = vi.fn().mockResolvedValue(antwort(JSON.stringify(STRUKTUR)));
    vi.stubGlobal('fetch', fetchMock);

    const result = await runDescription('Transkript', 'Caption', 'acc', 'tok');

    expect(result.struktur).toEqual(STRUKTUR);
    expect(result.text.split('\n')[0]).toBe(STRUKTUR.titel);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.response_format.type).toBe('json_schema');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('versucht es ohne JSON-Modus, wenn das Modell ihn ablehnt', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ success: false, errors: [{ message: 'response_format' }] }) })
      .mockResolvedValueOnce(antwort(JSON.stringify(STRUKTUR)));
    vi.stubGlobal('fetch', fetchMock);

    const result = await runDescription('T', '', 'acc', 'tok');

    expect(result.struktur.titel).toBe(STRUKTUR.titel);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).response_format).toBeUndefined();
  });

  it('fällt bei unlesbarer Antwort auf Fließtext zurück', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(antwort('Kein JSON hier'))
      .mockResolvedValueOnce(antwort('Ein Video über vier Zeichen.'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await runDescription('T', '', 'acc', 'tok');

    expect(result).toEqual({ struktur: null, text: 'Ein Video über vier Zeichen.' });
  });
});

describe('ersetzeBeschreibung (Netlify)', () => {
  const { ersetzeBeschreibung, beschreibungBlocker } = require('../../netlify/functions/_shared/beschreibung-analyse.js');

  /** Chainbarer Supabase-Stub: ki_requests zaehlt 0, strategie_items liefert das Item und merkt Updates. */
  function fakeSupabase(item) {
    const updates = [];
    const chain = (table, state = {}) => new Proxy(function () {}, {
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
            return chain(table, state);
          };
        }
        return () => chain(table, state);
      }
    });
    return { from: (table) => chain(table), updates };
  }

  beforeEach(() => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acc';
    process.env.CLOUDFLARE_AI_TOKEN = 'tok';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_AI_TOKEN;
  });

  it('sperrt Items ohne Link oder Transkript', () => {
    expect(beschreibungBlocker({ video_link: null, transkript: 'x' })).toBe('Nur eine Videoreferenz');
    expect(beschreibungBlocker({ video_link: 'https://t.co', transkript: '  ' })).toBe('Transkript fehlt');
    expect(beschreibungBlocker({ video_link: 'https://t.co', transkript: 'x' })).toBeNull();
  });

  it('schreibt Struktur, Text und Quelle ki', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, result: { response: JSON.stringify(STRUKTUR) } })
    }));
    const supabase = fakeSupabase({ id: 'i1', video_link: 'https://tiktok.com/x', transkript: 'Text', caption: 'Cap' });

    const result = await ersetzeBeschreibung(supabase, { userId: 'u1', itemId: 'i1' });

    expect(result.beschreibung_struktur).toEqual(STRUKTUR);
    expect(result.beschreibung_quelle).toBe('ki');
    expect(result.beschreibung.split('\n')[0]).toBe(STRUKTUR.titel);
    expect(supabase.updates).toContainEqual(result);
  });

  it('wirft ohne Transkript und schreibt nichts', async () => {
    const supabase = fakeSupabase({ id: 'i1', video_link: 'https://tiktok.com/x', transkript: null });
    await expect(ersetzeBeschreibung(supabase, { userId: 'u1', itemId: 'i1' })).rejects.toThrow('Transkript fehlt');
    expect(supabase.updates).toHaveLength(0);
  });
});

describe('Beschreibungs-Tabelle im Drawer', () => {
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

  const referenz = (extra = {}) => ({
    id: 'i1',
    video_link: 'https://tiktok.com/x',
    umsetzungsvorgabe: 'U',
    beschreibung: strukturZuText(STRUKTUR),
    beschreibung_struktur: STRUKTUR,
    ...extra
  });

  it('zeigt sechs editierbare Zeilen im Team', () => {
    open(referenz());

    const rows = [...document.querySelectorAll('[data-videoidee-section="beschreibung"] [data-videoidee-struktur]')];
    expect(rows.map((r) => r.dataset.videoideeStruktur)).toEqual([
      'titel', 'angle', 'hook', 'visual_hook', 'hauptteil', 'cta'
    ]);
    expect(rows[0].querySelector('th').textContent).toBe('Titel');
    expect(rows[3].querySelector('th').textContent).toBe('Visual Hook');
    expect(rows[2].querySelector('textarea').value).toBe(STRUKTUR.hook);
    expect(document.querySelector('textarea[data-field="beschreibung"]')).toBeNull();
  });

  it('zeigt dem Kunden nur gefüllte Zeilen, read-only', () => {
    open(referenz({ beschreibung_struktur: { ...STRUKTUR, visual_hook: '' } }), { isKunde: true, canEdit: false });

    const section = document.querySelector('[data-videoidee-section="beschreibung"]');
    expect(section.querySelector('textarea')).toBeNull();
    expect(section.querySelectorAll('[data-videoidee-struktur]')).toHaveLength(5);
    expect(section.querySelector('[data-videoidee-struktur="visual_hook"]')).toBeNull();
    expect(section.textContent).toContain(STRUKTUR.angle);
  });

  it('bleibt bei Altbestand beim Fließtext', () => {
    open(referenz({ beschreibung_struktur: null, beschreibung: 'Nur Fließtext' }));

    const section = document.querySelector('[data-videoidee-section="beschreibung"]');
    expect(section.querySelector('[data-videoidee-struktur]')).toBeNull();
    expect(section.querySelector('textarea[data-field="beschreibung"]').value).toBe('Nur Fließtext');
  });

  it('nutzt die Tabelle weder bei Idee noch bei Vorschlag', () => {
    open({ id: 'i1', video_link: null, beschreibung: 'Idee', beschreibung_struktur: STRUKTUR });
    expect(document.querySelector('[data-videoidee-struktur]')).toBeNull();

    removeEditItemDrawer();
    open({ id: 'i1', ist_vorschlag: true, video_link: 'https://tiktok.com/x', beschreibung: 'V', beschreibung_struktur: STRUKTUR });
    expect(document.querySelector('[data-videoidee-struktur]')).toBeNull();
  });

  it('speichert eine Zeile, leitet beschreibung neu ab und setzt die Quelle auf user', async () => {
    const item = referenz({ beschreibung_quelle: 'ki' });
    const detail = open(item);

    const area = document.querySelector('textarea[data-field="beschreibung_struktur.cta"]');
    area.value = 'Jetzt testen.';
    area.dispatchEvent(new Event('blur'));
    await vi.waitFor(() => expect(strategieService.updateStrategieItem).toHaveBeenCalled());

    const [id, updates] = strategieService.updateStrategieItem.mock.calls[0];
    expect(id).toBe('i1');
    expect(updates.beschreibung_struktur).toEqual({ ...STRUKTUR, cta: 'Jetzt testen.' });
    expect(updates.beschreibung.split('\n')[0]).toBe(STRUKTUR.titel);
    expect(updates.beschreibung).toContain('CTA: Jetzt testen.');
    expect(updates.beschreibung_quelle).toBe('user');
    expect(item.beschreibung_struktur.cta).toBe('Jetzt testen.');
    expect(detail.rerenderItemsTable).toHaveBeenCalled();
  });

  it('zeigt Altbestand mit Labels im Fließtext als Tabelle und speichert erst bei Änderung', async () => {
    const item = referenz({ beschreibung_struktur: null, beschreibung: ALT_TEXT_1, beschreibung_quelle: 'ki' });
    open(item);

    const hook = document.querySelector('textarea[data-field="beschreibung_struktur.hook"]');
    expect(hook.value).toBe('Vier Zeichen dafür, dass du in der Perimenopause bist.');
    expect(document.querySelector('textarea[data-field="beschreibung_struktur.angle"]').value).toBe('');

    hook.dispatchEvent(new Event('blur'));
    await Promise.resolve();
    expect(strategieService.updateStrategieItem).not.toHaveBeenCalled();

    const angle = document.querySelector('textarea[data-field="beschreibung_struktur.angle"]');
    angle.value = 'Symptom-Aufzählung';
    angle.dispatchEvent(new Event('blur'));
    await vi.waitFor(() => expect(strategieService.updateStrategieItem).toHaveBeenCalled());

    const updates = strategieService.updateStrategieItem.mock.calls[0][1];
    expect(updates.beschreibung_struktur.angle).toBe('Symptom-Aufzählung');
    expect(updates.beschreibung_struktur.hook).toBe('Vier Zeichen dafür, dass du in der Perimenopause bist.');
    expect(updates.beschreibung_quelle).toBe('user');
  });

  it('zeigt „Neu analysieren“ nur dem Team mit Transkript', () => {
    open(referenz({ transkript: 'Text' }));
    expect(document.querySelector('[data-action="analysiere-beschreibung"]')).toBeTruthy();

    removeEditItemDrawer();
    open(referenz());
    expect(document.querySelector('[data-action="analysiere-beschreibung"]')).toBeNull();

    removeEditItemDrawer();
    open(referenz({ transkript: 'Text' }), { isKunde: true, canEdit: false });
    expect(document.querySelector('[data-action="analysiere-beschreibung"]')).toBeNull();
  });

  it('ersetzt die Beschreibung bei „Neu analysieren“ und rendert die Tabelle neu', async () => {
    const neu = { ...STRUKTUR, titel: 'Neuer Titel' };
    vi.spyOn(strategieService, 'analysiereBeschreibung').mockResolvedValue({
      beschreibung: strukturZuText(neu),
      beschreibung_quelle: 'ki',
      beschreibung_struktur: neu
    });
    const item = referenz({ transkript: 'Text', beschreibung_struktur: null, beschreibung: 'Alter Fließtext', beschreibung_quelle: 'ki' });
    const detail = open(item);

    document.querySelector('[data-action="analysiere-beschreibung"]').click();
    await vi.waitFor(() => expect(strategieService.analysiereBeschreibung).toHaveBeenCalledWith('i1'));
    await vi.waitFor(() => {
      expect(document.querySelector('textarea[data-field="beschreibung_struktur.titel"]')?.value).toBe('Neuer Titel');
    });
    expect(item.beschreibung_struktur).toEqual(neu);
    expect(detail.rerenderItemsTable).toHaveBeenCalled();
  });

  it('fragt vor dem Ersetzen von Hand geschriebener Beschreibung nach', async () => {
    vi.spyOn(strategieService, 'analysiereBeschreibung').mockResolvedValue({});
    window.confirmationModal = { open: vi.fn().mockResolvedValue({ confirmed: false }) };
    open(referenz({ transkript: 'Text', beschreibung_quelle: 'user' }));

    document.querySelector('[data-action="analysiere-beschreibung"]').click();
    await vi.waitFor(() => expect(window.confirmationModal.open).toHaveBeenCalled());
    expect(strategieService.analysiereBeschreibung).not.toHaveBeenCalled();
    delete window.confirmationModal;
  });

  it('speichert nichts, wenn die Zeile unverändert bleibt', async () => {
    open(referenz());
    const area = document.querySelector('textarea[data-field="beschreibung_struktur.hook"]');
    area.dispatchEvent(new Event('blur'));
    await Promise.resolve();
    expect(strategieService.updateStrategieItem).not.toHaveBeenCalled();
  });
});

describe('Strategie-Tabelle', () => {
  function zelle(item, detail = { items: [item], canEdit: true, isKunde: false }) {
    const tbody = document.createElement('tbody');
    tbody.innerHTML = renderItemRow(detail, item, 0);
    return tbody.querySelector('.col-beschreibung');
  }

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('zeigt bei strukturierter Beschreibung nur den Titel, gesperrt', () => {
    const cell = zelle({
      id: 'i1', video_link: 'https://tiktok.com/x', beschreibung: strukturZuText(STRUKTUR), beschreibung_struktur: STRUKTUR
    });
    const area = cell.querySelector('textarea');
    expect(area.value).toBe(STRUKTUR.titel);
    expect(area.hasAttribute('readonly')).toBe(true);
    expect(cell.textContent).not.toContain('Angle');
  });

  it('zeigt dem Kunden nur den Titel', () => {
    const item = { id: 'i1', video_link: 'https://tiktok.com/x', beschreibung: strukturZuText(STRUKTUR), beschreibung_struktur: STRUKTUR };
    const cell = zelle(item, { items: [item], canEdit: false, isKunde: true });
    expect(cell.textContent.trim()).toBe(STRUKTUR.titel);
  });

  it('zeigt bei Altbestand den Fließtext editierbar', () => {
    const cell = zelle({ id: 'i1', video_link: 'https://tiktok.com/x', beschreibung: 'Fließtext' });
    const area = cell.querySelector('textarea');
    expect(area.value).toBe('Fließtext');
    expect(area.hasAttribute('readonly')).toBe(false);
  });
});

describe('Beschreibung außerhalb des Drawers', () => {
  it('persistVideoideeEdit verwirft die Struktur bei Freitext-Änderung und Link-Wechsel', async () => {
    vi.spyOn(strategieService, 'updateStrategieItem').mockResolvedValue({});
    vi.spyOn(strategieService, 'deleteScreenshot').mockResolvedValue();
    vi.spyOn(strategieService, 'enqueueItemProcessing').mockResolvedValue(true);

    const item = {
      id: 'i1',
      video_link: 'https://tiktok.com/a',
      beschreibung: 'alt',
      beschreibung_struktur: STRUKTUR
    };
    const detail = { strategieId: 's1', items: [item] };

    await persistVideoideeEdit(detail, 'i1', {
      art: 'videoreferenz',
      video_link: 'https://tiktok.com/a',
      beschreibung: 'neu',
      umsetzungsvorgabe: 'U'
    });
    expect(strategieService.updateStrategieItem.mock.calls[0][1].beschreibung_struktur).toBeNull();

    item.beschreibung_struktur = STRUKTUR;
    item.beschreibung = 'neu';
    await persistVideoideeEdit(detail, 'i1', {
      art: 'videoreferenz',
      video_link: 'https://tiktok.com/b',
      beschreibung: 'neu',
      umsetzungsvorgabe: 'U'
    });
    expect(strategieService.updateStrategieItem.mock.calls[1][1].beschreibung_struktur).toBeNull();

    vi.restoreAllMocks();
  });

  it('persistVideoideeEdit rührt beschreibung_struktur ohne vorhandene Struktur nicht an', async () => {
    vi.spyOn(strategieService, 'updateStrategieItem').mockResolvedValue({});
    const item = { id: 'i1', video_link: null, beschreibung: 'alt' };

    await persistVideoideeEdit({ strategieId: 's1', items: [item] }, 'i1', {
      art: 'idee',
      beschreibung: 'neu'
    });

    expect(strategieService.updateStrategieItem.mock.calls[0][1]).not.toHaveProperty('beschreibung_struktur');
    vi.restoreAllMocks();
  });
});
