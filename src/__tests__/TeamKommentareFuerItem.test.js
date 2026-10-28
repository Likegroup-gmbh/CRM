import { describe, it, expect } from 'vitest';
import { waehleTeamKommentare } from '../modules/skripte/SkriptKommentarService.js';

const team = { id: 'u1', name: 'Anna Team', rolle: 'mitarbeiter' };
const kunde = { id: 'u2', name: 'Kunde K', rolle: 'kunde' };

describe('waehleTeamKommentare', () => {
  const skripte = [{ id: 's1', titel: 'Skript A' }, { id: 's2', titel: 'Skript B' }];

  it('behaelt nur Beitraege von Admin und Mitarbeiter', () => {
    const rows = [
      { id: 'k1', skript_id: 's1', typ: 'kommentar', sektion: 'hook', inhalt: 'Vom Team', created_by: team, created_at: '2026-10-01' },
      { id: 'k2', skript_id: 's1', typ: 'kommentar', sektion: 'hook', inhalt: 'Vom Kunden', created_by: kunde, created_at: '2026-10-02' },
      { id: 'k3', skript_id: 's1', typ: 'kommentar', sektion: 'hook', inhalt: 'Gast', created_by: null, author_name: 'Gast', created_at: '2026-10-03' }
    ];
    const out = waehleTeamKommentare(rows, skripte);
    expect(out.map((k) => k.id)).toEqual(['k1']);
    expect(out[0].autor).toBe('Anna Team');
  });

  it('traegt bei Antworten Sektion und Zitat des Threads, auch ueber mehrere Ebenen', () => {
    const rows = [
      { id: 'w', skript_id: 's1', typ: 'kommentar', sektion: 'hauptteil', selektion_text: 'zu lang', inhalt: 'Kunde', created_by: kunde },
      { id: 'a1', skript_id: 's1', parent_id: 'w', typ: 'kommentar', inhalt: 'Kuerzen wir', created_by: team },
      { id: 'a2', skript_id: 's1', parent_id: 'a1', typ: 'kommentar', inhalt: 'Erledigt', created_by: team }
    ];
    const out = waehleTeamKommentare(rows, skripte);
    expect(out.map((k) => k.id)).toEqual(['a1', 'a2']);
    for (const k of out) {
      expect(k.ist_antwort).toBe(true);
      expect(k.sektion).toBe('hauptteil');
      expect(k.zitat).toBe('zu lang');
    }
  });

  it('nummeriert Skripte nur, wenn es mehrere gibt, und uebernimmt Aenderungen mit vorher/nachher', () => {
    const rows = [{
      id: 'c1', skript_id: 's2', typ: 'aenderung', sektion: 'hook', inhalt: 'Hook geaendert',
      vorher_text: 'Alt', nachher_text: 'Neu', created_by: team
    }];
    const mehrere = waehleTeamKommentare(rows, skripte);
    expect(mehrere[0].skript_nr).toBe(2);
    expect(mehrere[0].skript_titel).toBe('Skript B');
    expect(mehrere[0].vorher_text).toBe('Alt');
    expect(mehrere[0].nachher_text).toBe('Neu');

    expect(waehleTeamKommentare(rows, [skripte[1]])[0].skript_nr).toBeNull();
  });
});
