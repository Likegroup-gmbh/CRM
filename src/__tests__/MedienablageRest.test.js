import { describe, it, expect, vi } from 'vitest';
import { restGruppen, ursacheSchluessel } from '../modules/admin/medienablageRestText.js';
import { restHtml, restErneut, nichtGestartet, nochInDropbox } from '../modules/admin/medienablageRest.js';

const zeile = (extra) => ({
  id: Math.random().toString(36), unternehmen_id: 'u1', bereich: 'medien', typ: 'video', status: 'fehler', grund: 'dropbox_fehlt', versuche: 6,
  datei: 'clip.mp4', kampagne: 'Sommer', kooperation: 'Anna', ...extra,
});

function seite(data) {
  const unternehmen = data.unternehmen || [];
  const page = {
    data,
    _busy: false,
    unternehmen: (id) => unternehmen.find((u) => u.id === id) || null,
    ausfuehren: vi.fn(async () => {}),
  };
  return page;
}

const firmen = [
  { id: 'u1', firmenname: 'Alpha GmbH', ablage_ziel: 'sharepoint', dateien_sharepoint: 5, dateien_dropbox: 3 },
  { id: 'u2', firmenname: 'Beta AG', ablage_ziel: 'dropbox', dateien_sharepoint: 0, dateien_dropbox: 40 },
  { id: 'u3', firmenname: 'Gamma KG', ablage_ziel: 'sharepoint', dateien_sharepoint: 0, dateien_dropbox: 9 },
];

describe('Rest des Umzugs: Ursachen in Klartext', () => {
  it('führt ähnliche Gründe unter einer Ursache zusammen', () => {
    expect(ursacheSchluessel('dropbox_link_weg')).toBe('dropbox_fehlt');
    expect(ursacheSchluessel('ohne_kooperation')).toBe('ohne_zuordnung');
    expect(ursacheSchluessel('ohne_unternehmen')).toBe('ohne_zuordnung');
    expect(ursacheSchluessel('storage: {}')).toBe('speicher_lesen');
    expect(ursacheSchluessel('Name from path does not match name from body')).toBe('pfad_name');
    expect(ursacheSchluessel('irgendwas Neues')).toBe('irgendwas Neues');
  });

  it('gruppiert je Ursache, größte zuerst, mit Unternehmen und Anzahl', () => {
    const g = restGruppen([
      zeile({ grund: 'onedrive_kein_zugriff' }), zeile({ grund: 'onedrive_kein_zugriff', unternehmen_id: 'u3' }), zeile({ grund: 'onedrive_kein_zugriff' }),
      zeile({ grund: 'dropbox_fehlt' }),
    ]);
    expect(g.map((x) => [x.schluessel, x.anzahl])).toEqual([['onedrive_kein_zugriff', 3], ['dropbox_fehlt', 1]]);
    expect(g[0].firmen).toEqual([{ id: 'u1', bereich: 'medien', anzahl: 2 }, { id: 'u3', bereich: 'medien', anzahl: 1 }]);
    expect(g[0].info.befehl).toContain('onedrive-freigeben.mjs');
  });

  it('zeigt unbekannte Gründe als sonstigen Fehler mit dem Originaltext', () => {
    const [g] = restGruppen([zeile({ grund: 'boom 42' })]);
    expect(g.info.titel).toBe('Sonstiger Fehler');
    expect(g.info.warum).toContain('boom 42');
  });
});

describe('Rest des Umzugs: Anzeige', () => {
  it('meldet "alles umgezogen", wenn nichts fehlt', () => {
    const html = restHtml(seite({ unternehmen: firmen.filter((f) => f.id === 'u1').map((f) => ({ ...f, dateien_dropbox: 0 })), umzug_rest: [] }));
    expect(html).toContain('Keine Datei hängt fest.');
    expect(html).toContain('Alles umgezogen');
  });

  it('zeigt je Ursache Warum, Was tun, Unternehmen und Dateiliste', () => {
    const html = restHtml(seite({
      unternehmen: firmen,
      umzug_rest: [zeile({ grund: 'onedrive_kein_zugriff', datei: 'a.mp4' }), zeile({ grund: 'onedrive_kein_zugriff', datei: 'b.mp4' }), zeile({ grund: 'ohne_quelle', status: 'uebersprungen', datei: 'c.mp4' })],
    }));
    expect(html).toContain('3 Dateien hängen fest (1 Unternehmen)');
    expect(html).toContain('Kein Zugriff auf alte OneDrive-Links');
    expect(html).toContain('2 Dateien');
    expect(html).toContain('Alpha GmbH');
    expect(html).toContain('node scripts/medienablage/onedrive-freigeben.mjs');
    expect(html).toContain('Sommer · Anna');
    expect(html).toContain('a.mp4');
  });

  it('bietet "Erneut versuchen" nur, wenn es hilft und die Weiche auf SharePoint steht', () => {
    const html = restHtml(seite({
      unternehmen: firmen,
      umzug_rest: [
        zeile({ grund: 'onedrive_kein_zugriff', unternehmen_id: 'u1' }),
        zeile({ grund: 'dropbox_fehlt', unternehmen_id: 'u2' }),
        zeile({ grund: 'onedrive_weg', unternehmen_id: 'u1' }),
      ],
    }));
    expect(html.match(/data-ma-rest-erneut="medien:u1"/g)).toHaveLength(1);
    expect(html).not.toContain('data-ma-rest-erneut="medien:u2"');
    expect(html).toContain('Weiche steht auf Dropbox');
  });

  it('escaped Dateinamen und Gründe', () => {
    const html = restHtml(seite({ unternehmen: firmen, umzug_rest: [zeile({ datei: '<img src=x onerror=1>', grund: '<b>x</b>' })] }));
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<b>x</b>');
  });

  it('begrenzt die Dateiliste und nennt den Rest', () => {
    const viele = Array.from({ length: 130 }, (_, i) => zeile({ datei: `f${i}.mp4` }));
    const html = restHtml(seite({ unternehmen: firmen, umzug_rest: viele }));
    expect(html).toContain('… und 30 weitere.');
    expect(html).not.toContain('f129.mp4');
  });
});

describe('Rest des Umzugs: noch nicht gestartet und noch in Dropbox', () => {
  const data = {
    unternehmen: firmen,
    umzug: [{ unternehmen_id: 'u1', offen: 1, fertig: 5, fehler: 2, uebersprungen: 0 }],
    dokumente: [
      { id: 'u1', dokument_ablage_ziel: 'sharepoint', dropbox: 2, storage: 1 },
      { id: 'u2', dokument_ablage_ziel: 'dropbox', dropbox: 4, storage: 1 },
    ],
    dokument_umzug: [],
    umzug_rest: [],
  };

  it('findet Unternehmen mit Weiche SharePoint, deren Dateien nicht eingereiht sind', () => {
    // u1: 3 in Dropbox, 1 offen + 2 Fehler eingereiht -> 0; u3: 9 nicht eingereiht; Dokumente u1: 3 nicht eingereiht
    expect(nichtGestartet(seite(data))).toEqual([
      { id: 'u3', bereich: 'medien', anzahl: 9 },
      { id: 'u1', bereich: 'dokumente', anzahl: 3 },
    ]);
  });

  it('zeigt dafür "Umzug starten" mit den bestehenden Knöpfen', () => {
    const html = restHtml(seite(data));
    expect(html).toContain('Umzug noch nicht gestartet');
    expect(html).toContain('data-ma-umzug="u3"');
    expect(html).toContain('data-ma-dokument-umzug="u1"');
  });

  it('listet Unternehmen mit Weiche auf Dropbox nur zur Übersicht', () => {
    expect(nochInDropbox(seite(data))).toEqual([{ id: 'u2', medien: 40, dokumente: 5 }]);
    const html = restHtml(seite(data));
    expect(html).toContain('1 Unternehmen hat noch Dateien in Dropbox');
    expect(html).toContain('40 Dateien · 5 Dokumente');
  });
});

describe('Rest des Umzugs: Erneut versuchen', () => {
  const knopf = (wert) => ({ dataset: { maRestErneut: wert } });

  it('startet für Medien den Umzug des Unternehmens', async () => {
    const page = seite({ unternehmen: firmen });
    await restErneut(page, knopf('medien:u1'));
    expect(page.ausfuehren).toHaveBeenCalledWith({ aktion: 'umzug_starten', unternehmen_id: 'u1' }, expect.objectContaining({ button: expect.anything() }));
  });

  it('startet für Dokumente den Dokument-Umzug und meldet die Zahl', async () => {
    const page = seite({ unternehmen: firmen });
    await restErneut(page, knopf('dokumente:u1'));
    const [body, opts] = page.ausfuehren.mock.calls[0];
    expect(body).toEqual({ aktion: 'dokument_umzug_starten', unternehmen_id: 'u1' });
    expect(opts.erfolg({ angelegt: 4 })).toBe('Alpha GmbH: 4 Dokumente neu eingereiht.');
    expect(opts.erfolg({ angelegt: 0 })).toBe('Alpha GmbH: nichts neu einzureihen.');
  });

  it('tut während einer anderen Aktion nichts', async () => {
    const page = seite({ unternehmen: firmen });
    page._busy = true;
    await restErneut(page, knopf('medien:u1'));
    expect(page.ausfuehren).not.toHaveBeenCalled();
  });
});
