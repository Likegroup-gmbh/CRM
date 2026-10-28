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
import { renderItemRow, renderItemsTable, rerenderItemsTable } from '../modules/strategie/StrategieDetailRenderer.js';
import { handleFieldUpdate } from '../modules/strategie/StrategieDetailTableEvents.js';
import { strategieService } from '../modules/strategie/StrategieService.js';
import { skriptKommentarService } from '../modules/skripte/SkriptKommentarService.js';

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
  function fakeSupabase(item, produkt = null) {
    const updates = [];
    const chain = (table, state = {}) => new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === 'then') {
          const result = table === 'ki_requests' ? { count: 0, data: null, error: null } : { data: null, error: null };
          return (resolve) => resolve(result);
        }
        if (prop === 'maybeSingle') return async () => ({ data: table === 'produkt' ? produkt : item, error: null });
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

  it('gibt das verlinkte Produkt als Kontext an die KI', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, result: { response: JSON.stringify(STRUKTUR) } })
    });
    vi.stubGlobal('fetch', fetchMock);
    const supabase = fakeSupabase(
      { id: 'i1', video_link: 'https://tiktok.com/x', transkript: 'Text', caption: '', produkt_id: 'p1' },
      { id: 'p1', name: 'Leggings X', kurzbeschreibung: 'Bequem und stabil' }
    );

    await ersetzeBeschreibung(supabase, { userId: 'u1', itemId: 'i1' });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const user = body.messages.find((m) => m.role === 'user').content;
    expect(user).toContain('Verlinktes Produkt: Leggings X (Bequem und stabil)');
  });

  it('lässt den Produktblock ohne Link weg', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, result: { response: JSON.stringify(STRUKTUR) } })
    });
    vi.stubGlobal('fetch', fetchMock);
    const supabase = fakeSupabase({ id: 'i1', video_link: 'https://tiktok.com/x', transkript: 'Text', caption: '' });

    await ersetzeBeschreibung(supabase, { userId: 'u1', itemId: 'i1' });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages.find((m) => m.role === 'user').content).not.toContain('Verlinktes Produkt');
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
    vi.spyOn(skriptKommentarService, 'loadTeamKommentareFuerItem').mockResolvedValue([]);
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

  it('zeigt Videoreferenz-Altbestand ohne Labels nicht doppelt, wenn er schon Kurzbeschreibung ist', () => {
    open(referenz({ beschreibung_struktur: null, beschreibung: 'Nur Fließtext', kurzbeschreibung: 'Nur Fließtext' }));
    expect(document.querySelector('[data-field="kurzbeschreibung"]').value).toBe('Nur Fließtext');
    const section = document.querySelector('[data-videoidee-section="beschreibung"]');
    expect(section.querySelectorAll('[data-videoidee-struktur]')).toHaveLength(6);
    expect(section.querySelector('[data-videoidee-struktur="hauptteil"] textarea').value).toBe('');
    expect(strategieService.updateStrategieItem).not.toHaveBeenCalled();
  });

  it('nutzt die Tabelle auch bei der Idee, nicht beim Vorschlag', () => {
    open({ id: 'i1', video_link: null, beschreibung: 'Idee', beschreibung_struktur: STRUKTUR });
    expect(document.querySelectorAll('[data-videoidee-struktur]')).toHaveLength(6);
    expect(document.querySelector('textarea[data-field="beschreibung_struktur.hook"]').value).toBe(STRUKTUR.hook);

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

describe('Strategie-Tabelle: Spalte Beschreibung = Kurzbeschreibung', () => {
  function zelle(item, detail = {}) {
    const tbody = document.createElement('tbody');
    tbody.innerHTML = renderItemRow({ hiddenColumns: [], items: [item], canEdit: true, isKunde: false, ...detail }, item, 0);
    return tbody.querySelector('.col-beschreibung');
  }

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('zeigt die Kurzbeschreibung editierbar und ignoriert die strukturierte Beschreibung', () => {
    const cell = zelle({
      id: 'i1', video_link: null, kurzbeschreibung: 'Knoblauch Chili-Öl',
      beschreibung: strukturZuText(STRUKTUR), beschreibung_struktur: STRUKTUR
    });
    const area = cell.querySelector('textarea');
    expect(area.dataset.field).toBe('kurzbeschreibung');
    expect(area.value).toBe('Knoblauch Chili-Öl');
    expect(area.hasAttribute('readonly')).toBe(false);
  });

  it('bleibt bei Videoreferenz ohne Kurzbeschreibung leer, auch mit strukturierter Beschreibung', () => {
    const cell = zelle({
      id: 'i1', video_link: 'https://tiktok.com/x', beschreibung: strukturZuText(STRUKTUR), beschreibung_struktur: STRUKTUR
    });
    expect(cell.querySelector('textarea').value).toBe('');
  });

  it('nutzt beim Vorschlag weiter beschreibung', () => {
    const cell = zelle({ id: 'i1', ist_vorschlag: true, video_link: null, beschreibung: 'Vorschlagstext' });
    const area = cell.querySelector('textarea');
    expect(area.dataset.field).toBe('beschreibung');
    expect(area.value).toBe('Vorschlagstext');
  });

  it('zeigt dem Kunden die Kurzbeschreibung, nicht editierbar', () => {
    const item = { id: 'i1', video_link: null, kurzbeschreibung: 'Kurz', beschreibung: strukturZuText(STRUKTUR) };
    const cell = zelle(item, { canEdit: false, isKunde: true });
    expect(cell.textContent.trim()).toBe('Kurz');
    expect(cell.querySelector('textarea')).toBeNull();
  });

  it('setzt die Beschreibung nach Plattform und vor Creator', () => {
    const html = renderItemRow(
      { hiddenColumns: [], items: [], canEdit: true, isKunde: false },
      { id: 'i1', video_link: null, kurzbeschreibung: 'X' },
      0
    );
    const tr = new DOMParser().parseFromString(`<table><tbody>${html}</tbody></table>`, 'text/html').querySelector('tr');
    const klassen = [...tr.children].map((td) => [...td.classList].find((c) => /^col-(platform|beschreibung|creator)$/.test(c)));
    expect(klassen.filter(Boolean)).toEqual(['col-platform', 'col-beschreibung', 'col-creator']);
  });

  it('schreibt schreibgeschuetzte Zellen beim Blur nicht zurueck', async () => {
    vi.spyOn(strategieService, 'updateStrategieItem').mockResolvedValue({});
    const item = { id: 'i1', video_link: null, ist_vorschlag: true, beschreibung: 'X' };
    const area = document.createElement('textarea');
    area.readOnly = true;
    area.dataset.field = 'beschreibung';
    area.dataset.itemId = 'i1';
    await handleFieldUpdate({ items: [item], canEdit: true, isKunde: false }, area);
    expect(strategieService.updateStrategieItem).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  describe('Abgleich mit dem Drawer', () => {
    let item;
    let detail;

    beforeEach(() => {
      vi.spyOn(strategieService, 'updateStrategieItem').mockResolvedValue({});
      vi.spyOn(skriptKommentarService, 'loadTeamKommentareFuerItem').mockResolvedValue([]);
      window.toastSystem = { show: vi.fn() };
      item = {
        id: 'i1', video_link: null, kurzbeschreibung: 'Knoblauch Chili-Öl',
        beschreibung: strukturZuText(STRUKTUR), beschreibung_struktur: { ...STRUKTUR }
      };
      detail = {
        items: [item], canEdit: true, isKunde: false, hiddenColumns: [], customColumns: null,
        getTeilbereicheFromStrategie: () => [], _q: (s) => document.querySelector(s), _bindTableEvents: () => {}
      };
      detail.rerenderItemsTable = () => rerenderItemsTable(detail);
      document.body.innerHTML = renderItemsTable(detail);
      showEditItemDrawer(detail, 'i1');
    });

    afterEach(() => {
      removeEditItemDrawer();
      delete window.toastSystem;
      vi.restoreAllMocks();
    });

    const zellenArea = () => document.querySelector('.strategie-items-table td.col-beschreibung textarea');
    const drawerKurz = () => document.querySelector('#edit-item-drawer textarea[data-field="kurzbeschreibung"]');

    it('zeigt Kurzbeschreibung und strukturierte Beschreibung als getrennte Bereiche', () => {
      expect(drawerKurz().value).toBe('Knoblauch Chili-Öl');
      const sektionen = [...document.querySelectorAll('#edit-item-drawer [data-videoidee-section]')].map((s) => s.dataset.videoideeSection);
      expect(sektionen.indexOf('kurzbeschreibung')).toBeGreaterThan(-1);
      expect(sektionen.indexOf('kurzbeschreibung')).toBeLessThan(sektionen.indexOf('beschreibung'));
      expect(document.querySelector('textarea[data-field="beschreibung_struktur.hook"]').value).toBe(STRUKTUR.hook);
    });

    it('übernimmt eine Kurzbeschreibung aus dem Drawer in die Tabelle, ohne die Struktur anzufassen', async () => {
      drawerKurz().value = 'Neuer Kurztext';
      drawerKurz().dispatchEvent(new Event('blur'));
      await vi.waitFor(() => expect(zellenArea().value).toBe('Neuer Kurztext'));

      const updates = strategieService.updateStrategieItem.mock.calls[0][1];
      expect(updates).toEqual({ kurzbeschreibung: 'Neuer Kurztext' });
      expect(item.beschreibung_struktur).toEqual(STRUKTUR);
    });

    it('leert die Tabellenzelle, wenn die Kurzbeschreibung im Drawer gelöscht wird', async () => {
      drawerKurz().value = '';
      drawerKurz().dispatchEvent(new Event('blur'));
      await vi.waitFor(() => expect(zellenArea().value).toBe(''));
    });

    it('übernimmt eine Zellenänderung in den Drawer', async () => {
      const area = zellenArea();
      area.value = 'Aus der Tabelle';
      await handleFieldUpdate(detail, area);
      expect(strategieService.updateStrategieItem.mock.calls[0][1]).toEqual({ kurzbeschreibung: 'Aus der Tabelle' });
      expect(drawerKurz().value).toBe('Aus der Tabelle');
    });

    it('lässt die Tabellenzelle unberührt, wenn nur die Struktur im Drawer geändert wird', async () => {
      const hook = document.querySelector('#edit-item-drawer textarea[data-field="beschreibung_struktur.hook"]');
      hook.value = 'Anderer Hook';
      hook.dispatchEvent(new Event('blur'));
      await vi.waitFor(() => expect(strategieService.updateStrategieItem).toHaveBeenCalled());
      expect(zellenArea().value).toBe('Knoblauch Chili-Öl');
      expect(strategieService.updateStrategieItem.mock.calls[0][1]).not.toHaveProperty('kurzbeschreibung');
    });
  });
});

describe('Kurzbeschreibung beim Speichern', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function stubs() {
    vi.spyOn(strategieService, 'updateStrategieItem').mockResolvedValue({});
    vi.spyOn(strategieService, 'deleteScreenshot').mockResolvedValue();
    vi.spyOn(strategieService, 'enqueueItemProcessing').mockResolvedValue(true);
  }

  it('persistVideoideeEdit verwirft die Struktur nur beim Link-Wechsel', async () => {
    stubs();
    const item = { id: 'i1', video_link: 'https://tiktok.com/a', beschreibung: 'alt', beschreibung_struktur: STRUKTUR };
    const detail = { strategieId: 's1', items: [item] };

    await persistVideoideeEdit(detail, 'i1', {
      art: 'videoreferenz', video_link: 'https://tiktok.com/a', umsetzungsvorgabe: 'U2'
    });
    expect(strategieService.updateStrategieItem.mock.calls[0][1]).not.toHaveProperty('beschreibung_struktur');

    await persistVideoideeEdit(detail, 'i1', {
      art: 'videoreferenz', video_link: 'https://tiktok.com/b', umsetzungsvorgabe: 'U2'
    });
    expect(strategieService.updateStrategieItem.mock.calls[1][1].beschreibung_struktur).toBeNull();
  });

  it('persistVideoideeEdit fasst beschreibung nie an und schreibt kurzbeschreibung nur auf Wunsch', async () => {
    stubs();
    const item = { id: 'i1', video_link: null, beschreibung: 'alt', kurzbeschreibung: 'kurz' };
    const detail = { strategieId: 's1', items: [item] };

    await persistVideoideeEdit(detail, 'i1', { art: 'idee' });
    const ohne = strategieService.updateStrategieItem.mock.calls[0][1];
    expect(ohne).not.toHaveProperty('beschreibung');
    expect(ohne).not.toHaveProperty('kurzbeschreibung');

    await persistVideoideeEdit(detail, 'i1', { art: 'idee', kurzbeschreibung: 'neu' });
    const mit = strategieService.updateStrategieItem.mock.calls[1][1];
    expect(mit.kurzbeschreibung).toBe('neu');
    expect(mit).not.toHaveProperty('beschreibung');
    expect(mit).not.toHaveProperty('beschreibung_struktur');
  });

  it('persistVideoideeEdit lässt das Entfernen des Links zu, wenn irgendein Beschreibungstext existiert', async () => {
    stubs();
    const item = { id: 'i1', video_link: 'https://tiktok.com/a', beschreibung: strukturZuText(STRUKTUR), beschreibung_struktur: STRUKTUR };
    const result = await persistVideoideeEdit({ strategieId: 's1', items: [item] }, 'i1', { art: 'idee', video_link: '' });
    expect(result.ok).toBe(true);
  });

  it('persistVideoideeEdit verlangt für eine Idee ohne jeden Text eine Kurzbeschreibung', async () => {
    stubs();
    const item = { id: 'i1', video_link: null };
    const result = await persistVideoideeEdit({ strategieId: 's1', items: [item] }, 'i1', { art: 'idee' });
    expect(result).toEqual({ ok: false, error: 'Bitte eine Kurzbeschreibung angeben' });
  });
});
