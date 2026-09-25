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
});
