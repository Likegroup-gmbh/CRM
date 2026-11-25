import { describe, expect, it } from 'vitest';
import { kommentarZeit } from '../modules/video-browser/videoBrowserFormat.js';
import { commentsPanelHtml } from '../modules/video-browser/videoBrowserRenderComments.js';
import { normalizeComments } from '../modules/video-browser/videoBrowserCommentData.js';

describe('kommentarZeit', () => {
  const now = new Date(2026, 10, 25, 12, 0, 0);
  const vor = (ms) => new Date(now.getTime() - ms).toISOString();

  it('unter einer Minute und in der Zukunft: gerade eben', () => {
    expect(kommentarZeit(vor(30_000), now)).toBe('gerade eben');
    expect(kommentarZeit(vor(-120_000), now)).toBe('gerade eben');
  });

  it('Minuten, dann Stunden', () => {
    expect(kommentarZeit(vor(60_000), now)).toBe('vor 1 Min.');
    expect(kommentarZeit(vor(59 * 60_000), now)).toBe('vor 59 Min.');
    expect(kommentarZeit(vor(60 * 60_000), now)).toBe('vor 1 Std.');
    expect(kommentarZeit(vor(23 * 3_600_000 + 59 * 60_000), now)).toBe('vor 23 Std.');
  });

  it('ab 24 Stunden gestern, danach das Datum', () => {
    expect(kommentarZeit(new Date(2026, 10, 24, 0, 0).toISOString(), now)).toBe('gestern');
    expect(kommentarZeit(new Date(2026, 10, 23, 23, 59).toISOString(), now)).toBe('23.11.2026');
  });

  it('ohne oder mit kaputtem Datum leer', () => {
    expect(kommentarZeit(null, now)).toBe('');
    expect(kommentarZeit('kein datum', now)).toBe('');
  });
});

describe('Kommentar-Panel', () => {
  const zeit = [
    { id: 'z1', runde: 1, asset_id: 'a1', text: 'Erster', author_name: 'anna', feedback_typ: 'cj', timecode_sec: '3', created_at: '2026-02-01T10:00:00Z' },
    { id: 'z2', runde: 1, asset_id: 'a1', text: 'Zweiter', author_name: 'Kai Kunde', feedback_typ: 'kunde', timecode_sec: null, created_at: '2026-02-02T10:00:00Z' }
  ];

  const render = ({ kommentare = zeit, canComment = true, type = 'video' } = {}) => {
    const host = document.createElement('div');
    host.innerHTML = commentsPanelHtml({
      resolved: {
        row: { comments: normalizeComments([], kommentare, []), kannKommentieren: true, folders: [] },
        folder: { offen: true },
        item: { id: 'a1', type, runde: 1, isFinal: false }
      },
      canComment,
      drafts: {},
      idPrefix: 't'
    });
    return host;
  };

  it('Eingabe steht vor der Liste, neueste Kommentare zuerst, Zähler im Kopf', () => {
    const host = render();
    const form = host.querySelector('[data-vb-comment-form]');
    const list = host.querySelector('[data-vb-comments]');
    expect(form.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect([...list.querySelectorAll('.vb-comment__text')].map(p => p.textContent)).toEqual(['Zweiter', 'Erster']);
    expect(host.querySelector('.vb-comments__count[data-vb-tab-count]').textContent).toBe('2');
    expect(host.querySelector('[data-vb-comments-empty]')).toBeNull();
  });

  it('Avatar mit Initiale, Kunde eigens markiert, volle Zeit im title', () => {
    const host = render();
    const [kunde, team] = host.querySelectorAll('.vb-comment');
    expect(kunde.classList.contains('vb-comment--kunde')).toBe(true);
    expect(kunde.querySelector('.vb-comment__avatar').textContent).toBe('K');
    expect(team.querySelector('.vb-comment__avatar').textContent).toBe('A');
    expect(team.querySelector('.vb-timecode').dataset.seek).toBe('3');
    const datum = team.querySelector('time.vb-comment__date');
    expect(datum.getAttribute('datetime')).toBe('2026-02-01T10:00:00.000Z');
    expect(datum.title).toContain('2026');
  });

  it('Zeitstempel-Pill nur bei Video und Story, nicht bei Bildern', () => {
    expect(render().querySelector('.vb-comment-form__pin [data-vb-pin]')).not.toBeNull();
    expect(render({ type: 'still' }).querySelector('[data-vb-pin]')).toBeNull();
  });

  describe('Kunden-Feedback, das das Team eingetragen hat', () => {
    const AP = 'Cosima Kitze';
    const zeile = (id, extra) => ({ id, runde: 1, asset_id: 'a1', text: id, timecode_sec: null, created_at: `2026-05-21T10:0${id.length}:00Z`, ...extra });
    const namen = (kommentare, kundenName = AP) => normalizeComments([], kommentare, [], kundenName)
      .map(c => [c.text, c.author.name, c.author.role]);

    it('zeigt den Ansprechpartner der Kampagne, das Team-Feedback bleibt beim Autor', () => {
      expect(namen([
        zeile('k', { feedback_typ: 'kunde', author_name: 'Svenja', author_rolle: 'mitarbeiter' }),
        zeile('tm', { feedback_typ: 'cj', author_name: 'Svenja', author_rolle: 'mitarbeiter' }),
        zeile('adm', { feedback_typ: 'kunde', author_name: 'Chef', author_rolle: 'admin' })
      ])).toEqual([
        ['k', 'Cosima Kitze', 'kunde'],
        ['tm', 'Svenja', 'team'],
        ['adm', 'Cosima Kitze', 'kunde']
      ]);
    });

    it('Kunden-Login, Gast und unbekannte Rolle behalten den gespeicherten Namen', () => {
      expect(namen([
        zeile('kai', { feedback_typ: 'kunde', author_name: 'Kai Kunde', author_rolle: 'kunde' }),
        zeile('gast', { feedback_typ: 'kunde', author_name: 'Pat (Gast)', author_rolle: null }),
        zeile('altes', { feedback_typ: 'kunde', author_name: 'Svenja' })
      ]).map(([, name]) => name)).toEqual(['Kai Kunde', 'Pat (Gast)', 'Svenja']);
    });

    it('ohne Ansprechpartner bleibt der gespeicherte Name', () => {
      const k = zeile('k', { feedback_typ: 'kunde', author_name: 'Svenja', author_rolle: 'mitarbeiter' });
      expect(namen([k], '')[0][1]).toBe('Svenja');
      expect(normalizeComments([], [k], [])[0].author.name).toBe('Svenja');
    });

    it('Kopf und Avatar im Panel zeigen den Ansprechpartner', () => {
      const host = document.createElement('div');
      host.innerHTML = commentsPanelHtml({
        resolved: {
          row: {
            comments: normalizeComments([], [zeile('k', { feedback_typ: 'kunde', author_name: 'Svenja', author_rolle: 'mitarbeiter' })], [], AP),
            kannKommentieren: true,
            folders: []
          },
          folder: { offen: true },
          item: { id: 'a1', type: 'video', runde: 1, isFinal: false }
        },
        canComment: false,
        drafts: {},
        idPrefix: 't'
      });
      const kommentar = host.querySelector('.vb-comment');
      expect(kommentar.querySelector('.vb-comment__author').textContent).toBe('Cosima Kitze');
      expect(kommentar.querySelector('.vb-comment__avatar').textContent).toBe('C');
      expect(kommentar.querySelector('.vb-comment__role').textContent).toBe('Kunde');
    });
  });

  it('leer: Hinweis mit Hook, ohne Schreibrecht ohne Eingabe', () => {
    const offen = render({ kommentare: [] });
    expect(offen.querySelector('[data-vb-comments-empty]').textContent).toContain('Noch kein Feedback');
    expect(offen.querySelector('.vb-comments__count').textContent).toBe('0');

    const lesen = render({ kommentare: [], canComment: false });
    expect(lesen.querySelector('[data-vb-comment-form]')).toBeNull();
    expect(lesen.querySelector('.vb-info')).not.toBeNull();
    expect(lesen.querySelector('[data-vb-comments-empty]').textContent).toContain('nichts kommentiert');
  });
});
