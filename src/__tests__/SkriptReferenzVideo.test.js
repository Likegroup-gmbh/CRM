// Tests fuer die Videovorlage (Pflicht-Referenz) im Skript-Generator:
//   1. Client-Validierung des Referenz-Payloads (buildReferenzVideoPayload)
//   2. Prompt-Sektion + Transkript-Kuerzung (_shared/skript-context, CJS)
//   3. TranscribeService: Race-Schutz gegen stale Job-Updates

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildReferenzVideoPayload } from '../modules/skripte/SkriptGeneratorForm.js';
import { TranscribeService, isSupportedVideoUrl } from '../modules/transcribe/TranscribeService.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  buildKontextText,
  buildReferenzText,
  kuerzeTranskript,
  REFERENZ_TRANSKRIPT_MAX
} = require('../../netlify/functions/_shared/skript-context.js');

const DONE_JOB = {
  id: 'job-1',
  status: 'done',
  platform: 'tiktok',
  duration_seconds: 42.7,
  author_name: 'creatorin',
  likes_count: 1200,
  comments_count: 34,
  shares_count: 5,
  saves_count: 9
};

// ---------------------------------------------------------------------------
// 1. Referenz-Payload: Videovorlage ist Pflicht
// ---------------------------------------------------------------------------
describe('buildReferenzVideoPayload (Pflicht-Videovorlage)', () => {
  it('wirft ohne URL', () => {
    expect(() => buildReferenzVideoPayload({ status: 'idle', url: '', transkript: '' }))
      .toThrow(/Videovorlage angeben/);
  });

  it('wirft bei nicht unterstuetzter Plattform', () => {
    expect(() => buildReferenzVideoPayload({ status: 'idle', url: 'https://youtube.com/watch?v=x' }))
      .toThrow(/TikTok- oder Instagram-URL/);
  });

  it('wirft waehrend laufender Analyse (Generate blockiert)', () => {
    expect(() => buildReferenzVideoPayload({
      status: 'transcribing', url: 'https://www.tiktok.com/@u/video/1'
    })).toThrow(/noch analysiert/);
  });

  it('wirft im idle-Zustand ohne Analyse', () => {
    expect(() => buildReferenzVideoPayload({
      status: 'idle', url: 'https://www.tiktok.com/@u/video/1'
    })).toThrow(/zuerst analysieren/);
  });

  it('liefert quelle "job" mit Metadaten aus der Job-Row', () => {
    const ref = buildReferenzVideoPayload({
      status: 'ready',
      url: 'https://www.tiktok.com/@u/video/1',
      job: DONE_JOB,
      transkript: 'Das ist das (vom User korrigierte) Transkript der Vorlage.',
      beschreibung: 'Eine Beschreibung',
      caption: 'Die Caption'
    });
    expect(ref.quelle).toBe('job');
    expect(ref.transcription_job_id).toBe('job-1');
    expect(ref.platform).toBe('tiktok');
    expect(ref.metrics.likes).toBe(1200);
    expect(ref.transkript_verwendet).toContain('korrigierte');
  });

  it('wirft bei ready mit leerem Transkript', () => {
    expect(() => buildReferenzVideoPayload({
      status: 'ready', url: 'https://www.tiktok.com/@u/video/1', job: DONE_JOB, transkript: '   '
    })).toThrow(/Transkript.*leer/);
  });

  it('error-Zustand: kurzes manuelles Transkript reicht nicht', () => {
    expect(() => buildReferenzVideoPayload({
      status: 'error', url: 'https://www.instagram.com/reels/abc/', transkript: 'zu kurz'
    })).toThrow(/manuell/);
  });

  it('error-Zustand: langes manuelles Transkript ergibt quelle "manual"', () => {
    const ref = buildReferenzVideoPayload({
      status: 'error',
      url: 'https://www.instagram.com/reels/abc/',
      transkript: 'Dies ist ein manuell eingefuegtes Transkript mit deutlich mehr als fuenfzig Zeichen Inhalt.'
    });
    expect(ref.quelle).toBe('manual');
    expect(ref.transcription_job_id).toBeNull();
    expect(ref.metrics.likes).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. Prompt-Sektion (Server): Referenz als Bauweise, nie als Faktenquelle
// ---------------------------------------------------------------------------
describe('buildKontextText / buildReferenzText (Prompt)', () => {
  const referenz = {
    url: 'https://www.tiktok.com/@u/video/1',
    quelle: 'job',
    transkript_verwendet: 'Hook Satz. Hauptteil Inhalt. CTA am Ende.',
    beschreibung: 'Kurze Beschreibung des Videos.',
    caption: 'Original-Caption #ad',
    platform: 'tiktok',
    duration_seconds: 42.7,
    author_name: 'creatorin',
    metrics: { likes: 1200, comments: 34, shares: 5, saves: 9 }
  };

  it('enthaelt Referenz-Sektion mit Delimitern, Anti-Copy und Untrusted-Regel', () => {
    const text = buildKontextText({ dna: [] }, { video_idee: 'Morgenroutine', referenz_video: referenz });
    expect(text).toContain('VIDEOVORLAGE');
    expect(text).toContain('<referenzvideo>');
    expect(text).toContain('</referenzvideo>');
    expect(text).toContain('KEINE Kopie');
    expect(text).toContain('FREMDMATERIAL');
    expect(text).toContain('Hook Satz. Hauptteil Inhalt. CTA am Ende.');
    // Referenz steht VOR den Vorgaben (kreative Basis, dann Auftrag)
    expect(text.indexOf('<referenzvideo>')).toBeLessThan(text.indexOf('Vorgaben fuer dieses Video'));
  });

  it('Engagement-Metriken (Likes etc.) landen NICHT im Prompt', () => {
    const text = buildKontextText({ dna: [] }, { video_idee: 'x', referenz_video: referenz });
    expect(text).not.toContain('1200');
    expect(text).not.toMatch(/likes/i);
  });

  it('ohne Referenz keine Sektion (Legacy/Rueckfragen-Fallback)', () => {
    const text = buildKontextText({ dna: [] }, { video_idee: 'x' });
    expect(text).not.toContain('referenzvideo');
  });

  it('kuerzeTranskript behaelt Anfang UND Ende (Hook + CTA)', () => {
    const lang = `HOOKSTART ${'a'.repeat(REFERENZ_TRANSKRIPT_MAX * 2)} CTAENDE`;
    const gekuerzt = kuerzeTranskript(lang);
    expect(gekuerzt.length).toBeLessThan(lang.length);
    expect(gekuerzt).toContain('HOOKSTART');
    expect(gekuerzt).toContain('CTAENDE');
    expect(gekuerzt).toContain('gekuerzt');
  });

  it('buildReferenzText ist leer ohne verwendbares Transkript', () => {
    expect(buildReferenzText(null)).toBe('');
    expect(buildReferenzText({ transkript_verwendet: '  ' })).toBe('');
  });
});

// ---------------------------------------------------------------------------
// 3. TranscribeService: stale Updates nach URL-Wechsel werden ignoriert
// ---------------------------------------------------------------------------
describe('TranscribeService (Race-Schutz)', () => {
  let updates;
  let service;

  const mockSupabase = () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } })
    },
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: { id: `job-${Math.random()}` }, error: null })
        }))
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: null }) }))
      }))
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis()
    })),
    removeChannel: vi.fn()
  });

  beforeEach(() => {
    updates = [];
    window.supabase = mockSupabase();
    global.fetch = vi.fn().mockResolvedValue({ status: 202, ok: true });
    service = new TranscribeService({ onUpdate: (job) => updates.push(job) });
  });

  it('validiert URLs clientseitig', () => {
    expect(isSupportedVideoUrl('https://www.tiktok.com/@u/video/1')).toBe(true);
    expect(isSupportedVideoUrl('https://www.instagram.com/reels/x/')).toBe(true);
    expect(isSupportedVideoUrl('https://youtube.com/watch?v=1')).toBe(false);
    expect(isSupportedVideoUrl('')).toBe(false);
  });

  it('ignoriert Updates eines alten Laufs nach cancel (URL-Wechsel)', async () => {
    const job = await service.start('https://www.tiktok.com/@u/video/1');
    const alterRunId = service.runId;

    service.cancel(); // URL-Wechsel/Clear

    // Spaeter eintreffendes done des ALTEN Jobs darf nicht durchkommen
    service.handleJobUpdate({ ...job, status: 'done', transcript: 'alt' }, alterRunId);
    expect(updates).toHaveLength(0);
  });

  it('ignoriert Updates mit fremder Job-ID', async () => {
    await service.start('https://www.tiktok.com/@u/video/1');
    service.handleJobUpdate({ id: 'fremder-job', status: 'done' }, service.runId);
    expect(updates).toHaveLength(0);
  });

  it('reicht Updates des aktuellen Laufs durch und stoppt bei done', async () => {
    const job = await service.start('https://www.tiktok.com/@u/video/1');
    service.handleJobUpdate({ id: job.id, status: 'processing', progress_step: 'whisper' }, service.runId);
    service.handleJobUpdate({ id: job.id, status: 'done', transcript: 'fertig' }, service.runId);
    expect(updates).toHaveLength(2);
    expect(updates[1].transcript).toBe('fertig');
    expect(service.pollInterval).toBeNull();
    expect(service.channel).toBeNull();
  });
});
