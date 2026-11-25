import { describe, it, expect } from 'vitest';
import { istVeraltet } from '../modules/skripte/editor/skriptEditorVeraltet.js';

const T0 = '2026-09-25T10:00:00Z';
const T1 = '2026-09-25T10:01:00Z';
const T2 = '2026-09-25T10:02:00Z';

const skript = {
  hook: 'Neuer Hook nach dem Annehmen',
  hook_visuell: '0:00–0:03 Close-up',
  inhalt_md: '## Hook-Paket\nAudio: hi'
};

const offen = (extra = {}) => ({
  id: 'b', status: 'vorschlag', aktion: 'chat', sektion: 'hook', vorschlag_text: 'B', created_at: T1, ...extra
});
const angenommen = (extra = {}) => ({
  id: 'a', status: 'angenommen', aktion: 'chat', sektion: 'hook', vorschlag_text: 'A', created_at: T0, updated_at: T2, ...extra
});

describe('istVeraltet', () => {
  it('Accept fuer dieselbe Sektion danach: veraltet', () => {
    expect(istVeraltet(offen(), [angenommen(), offen()], skript)).toBe(true);
  });

  it('Accept davor: nicht veraltet', () => {
    expect(istVeraltet(offen({ created_at: T2 }), [angenommen({ updated_at: T1 })], skript)).toBe(false);
  });

  it('Selektion noch vorhanden: annehmbar', () => {
    expect(istVeraltet(offen({ selektion_text: 'nach dem Annehmen' }), [angenommen()], skript)).toBe(false);
  });

  it('Selektion weg: veraltet', () => {
    expect(istVeraltet(offen({ selektion_text: 'Alter Hook' }), [angenommen()], skript)).toBe(true);
  });

  it('andere Sektion: nicht veraltet', () => {
    expect(istVeraltet(offen(), [angenommen({ sektion: 'cta' })], skript)).toBe(false);
  });

  it('ist_visuell verschieden: nicht veraltet', () => {
    expect(istVeraltet(offen(), [angenommen({ ist_visuell: true })], skript)).toBe(false);
    expect(istVeraltet(offen({ ist_visuell: true }), [angenommen({ ist_visuell: true })], skript)).toBe(true);
  });

  it('Visual-Button zaehlt fuer die Visual-Spalte', () => {
    expect(istVeraltet(offen({ ist_visuell: true }), [angenommen({ aktion: 'visuell' })], skript)).toBe(true);
  });

  it('Master-Sektion: Selektion gegen den Sektions-Body', () => {
    const msg = offen({ sektion: 'hook-paket', selektion_text: 'Audio: hi' });
    expect(istVeraltet(msg, [angenommen({ sektion: 'hook-paket' })], skript)).toBe(false);
    expect(istVeraltet({ ...msg, selektion_text: 'weg' }, [angenommen({ sektion: 'hook-paket' })], skript)).toBe(true);
  });

  it('nur offene Vorschlaege, nie Visual-Button oder Rueckfrage', () => {
    expect(istVeraltet(offen({ status: 'fertig' }), [angenommen()], skript)).toBe(false);
    expect(istVeraltet(offen({ aktion: 'visuell' }), [angenommen()], skript)).toBe(false);
    expect(istVeraltet(offen({ aktion: 'rueckfrage' }), [angenommen()], skript)).toBe(false);
  });

  it('Bundle: Accept auf einer der Zellen macht das ganze Bundle veraltet', () => {
    const bundle = offen({
      sektion: 'gesamt',
      selektion_text: null,
      vorschlag_text: null,
      aenderungen: [
        { sektion: 'hook', spalte: 'gesprochen', vorschlag_text: 'Neuer Hook' },
        { sektion: 'cta', spalte: 'visuell', vorschlag_text: 'Neue Regie' }
      ]
    });
    expect(istVeraltet(bundle, [angenommen(), bundle], skript)).toBe(true);
    expect(istVeraltet(bundle, [angenommen({ sektion: 'hauptteil' }), bundle], skript)).toBe(false);
  });

  it('Bundle ohne spaeteren Accept: nicht veraltet', () => {
    const bundle = offen({
      sektion: 'gesamt',
      selektion_text: null,
      vorschlag_text: null,
      aenderungen: [{ sektion: 'hook', spalte: 'gesprochen', vorschlag_text: 'Neuer Hook' }]
    });
    expect(istVeraltet(bundle, [bundle], skript)).toBe(false);
  });
});

describe('istVeraltet: neuerer Vorschlag fuer dieselbe Zelle', () => {
  const neuer = (extra = {}) => offen({ id: 'c', vorschlag_text: 'C', created_at: T2, ...extra });

  it('neuerer offener Vorschlag macht den aelteren veraltet, nicht umgekehrt', () => {
    expect(istVeraltet(offen(), [offen(), neuer()], skript)).toBe(true);
    expect(istVeraltet(neuer(), [offen(), neuer()], skript)).toBe(false);
  });

  it('abgelehnter neuerer Vorschlag ersetzt nichts', () => {
    expect(istVeraltet(offen(), [offen(), neuer({ status: 'abgelehnt' })], skript)).toBe(false);
  });

  it('andere Zelle oder andere Spalte: bleibt offen', () => {
    expect(istVeraltet(offen(), [offen(), neuer({ sektion: 'cta' })], skript)).toBe(false);
    expect(istVeraltet(offen(), [offen(), neuer({ ist_visuell: true })], skript)).toBe(false);
  });

  it('verschiedene markierte Stellen derselben Zelle: beide offen, gleiche Stelle: veraltet', () => {
    const a = offen({ selektion_text: 'Neuer Hook' });
    expect(istVeraltet(a, [a, neuer({ selektion_text: 'nach dem Annehmen' })], skript)).toBe(false);
    expect(istVeraltet(a, [a, neuer({ selektion_text: 'Neuer Hook' })], skript)).toBe(true);
    expect(istVeraltet(a, [a, neuer()], skript)).toBe(true);
  });

  it('neuerer Einzelvorschlag auf einer Bundle-Zelle macht das Bundle veraltet', () => {
    const bundle = offen({
      sektion: 'gesamt', vorschlag_text: null,
      aenderungen: [
        { sektion: 'hook', spalte: 'gesprochen', vorschlag_text: 'Neuer Hook' },
        { sektion: 'cta', spalte: 'gesprochen', vorschlag_text: 'Neuer CTA' }
      ]
    });
    expect(istVeraltet(bundle, [bundle, neuer({ sektion: 'cta' })], skript)).toBe(true);
  });

  it('Spiegel: Server und Client sehen denselben offenen Vorschlag', async () => {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const { offeneVorschlaege } = require('../../netlify/functions/_shared/skript-edit-prompt.js');
    const verlauf = [
      offen({ rolle: 'assistant' }),
      neuer({ rolle: 'assistant' }),
      neuer({ rolle: 'assistant', id: 'd', status: 'abgelehnt', created_at: '2026-09-25T10:03:00Z' })
    ];
    const client = verlauf.filter((m) => m.status === 'vorschlag' && !istVeraltet(m, verlauf, skript)).map((m) => m.id);
    const server = offeneVorschlaege(verlauf, skript).map((m) => m.id);
    expect(server).toEqual(client);
    expect(client).toEqual(['c']);
  });
});
