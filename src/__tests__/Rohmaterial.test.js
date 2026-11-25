import { describe, it, expect } from 'vitest';
import creatorUpload from '../../netlify/functions/_shared/creator-upload.js';
import { resolveRohmaterialName } from '../modules/video/RohmaterialService.js';
import { sanitizeFileName } from '../core/videoFileNames.js';

const { validateFile, resolveTarget, loadMembership, SIZE_CAPS } = creatorUpload;

// Minimaler Service-Client fuer loadMembership: liefert pro Tabelle ein
// festes Ergebnis und ist in jeder Kette (select/eq/in/order) awaitbar.
function serviceClient(byTable) {
  return {
    from: (table) => {
      const result = { data: byTable[table] || [], error: null };
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        order: () => chain,
        then: (resolve) => resolve(result),
      };
      return chain;
    },
  };
}

// ────────────────────────────────────────────────────────────
// Versions-unabhaengige Dump-Logik
// ────────────────────────────────────────────────────────────

describe('Rohmaterial ist versionslos', () => {
  it('haengt an der Kooperation, nicht an einem Video-Slot', async () => {
    const supabase = serviceClient({
      kooperationen: [{ id: 'koop-1', name: 'C', kampagne: { id: 'k1', kampagnenname: 'K' } }],
    });
    const tokenRow = { id: 't1', kampagne_id: 'k1', creator_id: 'c1' };

    const hit = await resolveTarget(supabase, tokenRow, 'rohmaterial', 'koop-1');
    expect(hit).toMatchObject({ kind: 'rohmaterial' });
    expect(hit.koop.id).toBe('koop-1');

    // Fremde Kooperation gehoert nicht zum Token
    expect(await resolveTarget(supabase, tokenRow, 'rohmaterial', 'koop-2')).toBeNull();
  });

  it('loadMembership meldet die bereits abgelegten Dateien pro Kooperation', async () => {
    const supabase = serviceClient({
      kooperationen: [{ id: 'koop-1', name: 'C', kampagne: { id: 'k1', kampagnenname: 'K' } }],
      kooperation_rohmaterial_asset: [
        { kooperation_id: 'koop-1', file_name: 'clip.mov', file_size: 2048, created_at: '2026-08-30' },
      ],
    });

    const membership = await loadMembership(supabase, { id: 't1', kampagne_id: 'k1', creator_id: 'c1' });

    expect(membership.kooperationen[0].rohmaterial).toEqual([{ name: 'clip.mov', size: 2048 }]);
  });

  it('erlaubt Bilder (JPG, PNG, HEIC …) im Rohmaterial mit passendem Content-Type', () => {
    expect(validateFile('rohmaterial', 'foto.jpg', 1_000)).toMatchObject({ ok: true, contentType: 'image/jpeg' });
    expect(validateFile('rohmaterial', 'FOTO.PNG', 1_000)).toMatchObject({ ok: true, contentType: 'image/png' });
    expect(validateFile('rohmaterial', 'foto.heic', 1_000).ok).toBe(true);
    expect(validateFile('rohmaterial', 'dokument.pdf', 1_000)).toMatchObject({ ok: false, code: 'bad_type' });
  });

  it('erlaubt Video-Formate und zip bis 10 GB', () => {
    expect(SIZE_CAPS.rohmaterial).toBe(10 * 1024 * 1024 * 1024);

    expect(validateFile('rohmaterial', 'clip.mov', 5_000_000_000).ok).toBe(true);
    expect(validateFile('rohmaterial', 'takes.zip', 1_000).ok).toBe(true);

    expect(validateFile('rohmaterial', 'takes.zip', 1_000).contentType).toBe('application/zip');

    const tooBig = validateFile('rohmaterial', 'clip.mov', 11 * 1024 * 1024 * 1024);
    expect(tooBig).toMatchObject({ ok: false, code: 'too_large' });

    const badType = validateFile('rohmaterial', 'dokument.pdf', 1_000);
    expect(badType).toMatchObject({ ok: false, code: 'bad_type' });

    expect(validateFile('rohmaterial', 'clip.mov', 0)).toMatchObject({ ok: false, code: 'empty' });
  });

  it('laesst zip in den anderen Zieltypen weiterhin nicht zu', () => {
    expect(validateFile('video', 'takes.zip', 1_000)).toMatchObject({ ok: false, code: 'bad_type' });
    expect(validateFile('bilder', 'takes.zip', 1_000)).toMatchObject({ ok: false, code: 'bad_type' });
  });
});

// ────────────────────────────────────────────────────────────
// Namenskollision
// ────────────────────────────────────────────────────────────

describe('Namenskollision im Rohmaterial-Ordner', () => {
  it('haengt _2, _3 vor der Extension an', () => {
    const taken = new Set(['clip.mov']);
    expect(resolveRohmaterialName('clip.mov', taken)).toBe('clip_2.mov');
    taken.add('clip_2.mov');
    expect(resolveRohmaterialName('clip.mov', taken)).toBe('clip_3.mov');
  });

  it('laesst freie Namen unveraendert', () => {
    expect(resolveRohmaterialName('clip.mov', new Set())).toBe('clip.mov');
  });

  it('kommt mit Namen ohne Extension klar', () => {
    expect(resolveRohmaterialName('README', new Set(['README']))).toBe('README_2');
  });

  it('sanitized idempotent', () => {
    const once = sanitizeFileName('a<b>c|d.mov');
    expect(once).toBe('a-b-c-d.mov');
    expect(sanitizeFileName(once)).toBe(once);
  });
});
