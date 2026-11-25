import { describe, expect, it } from 'vitest';
import {
  FRIST_VORLAUF_TAGE,
  fristAriaLabel,
  fristStatus,
  fristTagHtml,
  tageBisDeadline
} from '../modules/video-browser/videoBrowserDeadline.js';
import { ausstehendTileHtml } from '../modules/video-browser/videoBrowserRenderShowcase.js';
import { buildTree } from '../modules/video-browser/videoBrowserTree.js';

const HEUTE = new Date(2026, 10, 24, 16, 49);

describe('Frist der Content-Deadline', () => {
  it('zählt Kalendertage, unabhängig von Uhrzeit und Zeitumstellung', () => {
    expect(tageBisDeadline('2026-11-24', HEUTE)).toBe(0);
    expect(tageBisDeadline('2026-11-25', new Date(2026, 10, 24, 23, 59))).toBe(1);
    expect(tageBisDeadline('2026-11-20', HEUTE)).toBe(-4);
    expect(tageBisDeadline('2026-03-30', new Date(2026, 2, 28))).toBe(2);
    expect(tageBisDeadline(null, HEUTE)).toBeNull();
    expect(tageBisDeadline('kaputt', HEUTE)).toBeNull();
  });

  it('wählt Stufe und Beschriftung', () => {
    expect(fristStatus('2026-11-23', HEUTE)).toMatchObject({ stufe: 'ueberfaellig', label: '1 Tag überfällig' });
    expect(fristStatus('2026-11-14', HEUTE)).toMatchObject({ stufe: 'ueberfaellig', label: '10 Tage überfällig' });
    expect(fristStatus('2026-11-24', HEUTE)).toMatchObject({ stufe: 'heute', label: 'Heute fällig' });
    expect(fristStatus('2026-11-25', HEUTE)).toMatchObject({ stufe: 'bald', label: 'Morgen fällig' });
    expect(fristStatus('2026-12-01', HEUTE)).toMatchObject({ stufe: 'bald', label: 'Fällig in 7 Tagen' });
    expect(fristStatus('2026-12-02', HEUTE)).toMatchObject({ stufe: 'ok' });
    expect(FRIST_VORLAUF_TAGE).toBe(7);
    expect(fristStatus('', HEUTE)).toBeNull();
  });

  it('der Tag erscheint erst im Vorlauf und trägt das Datum als Tooltip', () => {
    expect(fristTagHtml('2026-12-10', HEUTE)).toBe('');
    expect(fristTagHtml(null, HEUTE)).toBe('');
    const html = fristTagHtml('2026-11-20', HEUTE);
    expect(html).toContain('tag tag--nowrap tag--frist tag--frist-ueberfaellig');
    expect(html).toContain('4 Tage überfällig');
    expect(html).toContain('title="Content-Deadline 20.11.2026"');
    expect(fristAriaLabel('2026-12-10', HEUTE)).toBe('');
    expect(fristAriaLabel('2026-11-24', HEUTE)).toBe('Heute fällig');
  });
});

describe('Frist auf der Kachel eines Ausstehenden Videos', () => {
  const heute = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 2);
  };
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const entry = (contentDeadline) => ({
    koop: { id: 'k1', name: 'Lena' },
    row: { id: 'v1', label: 'Video 1', contentDeadline },
    item: { id: 'ausstehend:v1', type: 'ausstehend', name: 'Video 1' }
  });

  it('zeigt dem Team den Verzug, der Kundenseite nichts', () => {
    const deadline = iso(heute());
    const team = ausstehendTileHtml(entry(deadline), 0, { team: true, canUpload: true, mehrere: false });
    expect(team).toContain('tag--frist-ueberfaellig');
    expect(team).toContain('2 Tage überfällig');
    expect(team).toContain('aria-label="Video 1, ausstehend, 2 Tage überfällig, Lena"');

    const kunde = ausstehendTileHtml(entry(deadline), 0, { team: false, canUpload: false, mehrere: false });
    expect(kunde).not.toContain('tag--frist');
    expect(kunde).toContain('aria-label="Video 1, ausstehend, Lena"');
  });

  it('der Baum reicht die Deadline je Video nur ans Team durch', () => {
    const raw = {
      kooperationen: [{ id: 'k1', name: 'Lena', creator: {} }],
      videos: [
        { id: 'v1', kooperation_id: 'k1', position: 1, content_deadline: '2026-11-20' },
        { id: 'v2', kooperation_id: 'k1', position: 2, content_deadline: '2026-12-20' }
      ]
    };
    const rows = (team) => buildTree(raw, { team }).kooperationen[0].rows.map(r => r.contentDeadline);
    expect(rows(true)).toEqual(['2026-11-20', '2026-12-20']);
    expect(rows(false)).toEqual([null, null]);
  });
});
