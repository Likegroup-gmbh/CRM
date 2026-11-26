import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const MAX_ZEILEN = 400;
const ROOT = join(__dirname, '..', '..');

const ORDNER = [
  'src/modules/share',
  'src/modules/shares',
  'src/modules/briefing',
  'src/modules/auswertung',
  'src/modules/report-pdf',
  'src/core/animation',
  'supabase/functions/share-list',
  'supabase/functions/einladung',
  'supabase/functions/_shared',
  'netlify/functions/_shared/ablage',
  'netlify/functions/_shared/tiktok',
  'src/core/tiktok',
  'src/core/uploadJobs',
];

const DATEI_MUSTER = [
  { ordner: 'src/core', muster: /^calendarDates/i },
  { ordner: 'src/core/ablage', muster: /^ablageOrdnerLink/i },
  { ordner: 'src/modules/kooperation', muster: /^kooperationVideos(Tab|Laden)/i },
  { ordner: 'src/core/components', muster: /^(share|SegmentSwitch|CalendarGrid|calendarGrid)/i },
  { ordner: 'src/core/form/logic', muster: /^(FormSearchableSelect|searchableSelect)/i },
  { ordner: 'src/core/ui', muster: /^(verknuepfung|tableVerknuepfungen)/i },
  { ordner: 'src/modules/skripte', muster: /^skriptPaket/i },
  { ordner: 'src/modules/kampagne', muster: /^(KampagneCalendar|kampagneCalendar|produktionFlow|kooperationFlowZiel|produktionTabDetail|detailWahlSwitch|skriptWahlSwitch|KampagneDetailKatalog|KampagneDetailSkripte|storysTab|CustomUploadTabHandler|customUploadBestand)/i },
  { ordner: 'src/modules/kooperation', muster: /^kooperationVideoDetail/i },
  { ordner: 'src/modules/produkt', muster: /^produktFormEinbettung/i },
  { ordner: 'src/modules/persona', muster: /^personaFormEinbettung/i },
  { ordner: 'src/core/doc', muster: /^docEinbettung/i },
  { ordner: 'src/modules/video-browser', muster: /^(videoBrowserKalender|videoBrowserView|videoBrowserVollansicht|videoBrowserVerknuepfungen|videoBrowserAdapterWrite|videoBrowserHost|videoBrowserDetailEvents|videoBrowserShowcase|videoBrowserRenderShowcase|videoBrowserSuche|videoBrowserKommentarAutoren)/i },
  { ordner: 'src/modules/admin', muster: /^(PdfVorlagen|medienablage|TikTokApi|tiktokApi)/i },
  { ordner: 'netlify/functions', muster: /^tiktok-/i },
  { ordner: 'src/modules/creator', muster: /^(CreatorListForm|creatorTiktokPrefill|creatorProfilLaden|creatorInstagramPrefill)/ },
  { ordner: 'src/modules/creator-auswahl', muster: /^(sourcingProfil|sourcingSpalten|CastingDetail(ProfilAbruf|QuickAdd|RowActions|Events|Bulk|Freigabe|ZeilenStatus)|CreatorAuswahlDetail|castingDetailDrawer|castingEngagement|castingPlattformZellen|castingPreisZellen|castingItem|castingTableRender|castingRealtime|castingFreigabe)/ },
  { ordner: 'src/__tests__', muster: /^(share|guest|einladung|skriptPaket|accountReturn|zugang|dateigroesse|briefing|auswertung|calendar|videoBrowserKalender|videoBrowserShowcase|videoBrowserVollansicht|videoBrowserVerknuepfungen|videoBrowserSuche|searchableSelect|verknuepfung|tableVerknuepfungen|ablageOrdnerLink|tabSlider|viewToggleSlider|produktionFlow|docEinbettung|skriptImFlow|reportPdf|VerifyAuthStaffCache|AblageCascade|AblageSpalte|CustomUploadJob|MediaSrc|RohmaterialService|VideoRohmaterialRenderer|VertragPdfUpload|medienablage|TikTok|sourcingZelleKit|CastingPlattformzeilen|creatorTiktokPrefill|creatorInstagramPrefill|CreatorAnlegen|InstagramCpm|SourcingPreisZelle|SourcingViewsPreisZelle|SourcingHiddenColumnsMigration|CastingFreigabe)/i },
  { ordner: 'netlify/functions/_shared', muster: /^instagram-cpm-/ },
];

function dateienIn(ordner) {
  const abs = join(ROOT, ordner);
  return readdirSync(abs).flatMap((name) => {
    const pfad = join(abs, name);
    return statSync(pfad).isDirectory() ? dateienIn(relative(ROOT, pfad)) : [pfad];
  });
}

function ueberwachteDateien() {
  const ausOrdnern = ORDNER.flatMap(dateienIn);
  const ausMustern = DATEI_MUSTER.flatMap(({ ordner, muster }) => (
    readdirSync(join(ROOT, ordner))
      .filter((name) => muster.test(name))
      .map((name) => join(ROOT, ordner, name))
  ));
  return [...new Set([...ausOrdnern, ...ausMustern])].filter((pfad) => /\.(js|ts)$/.test(pfad));
}

function zeilen(pfad) {
  const text = readFileSync(pfad, 'utf8');
  return text.endsWith('\n') ? text.split('\n').length - 1 : text.split('\n').length;
}

describe('Dateigröße', () => {
  it(`hält jede überwachte Datei bei höchstens ${MAX_ZEILEN} Zeilen`, () => {
    const zuGross = ueberwachteDateien()
      .map((pfad) => ({ datei: relative(ROOT, pfad), zeilen: zeilen(pfad) }))
      .filter((f) => f.zeilen > MAX_ZEILEN);
    expect(zuGross).toEqual([]);
  });
});
