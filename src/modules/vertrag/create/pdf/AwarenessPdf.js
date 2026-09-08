// pdf/AwarenessPdf.js
// Direktvertrag (Code-Bezeichner: awareness): PDF-Generierung nach den
// Original-Vorlagen (DE_TT/DE_IGR Agreement Awareness 2025).
// - Deckblatt (Seite 1, gestapelt wie Standard-Influencer-Vertrag) und Anhaenge:
//   einsprachig, Sprache = lang (Split-Button)
// - Seite 2: Praeambel + "ES WURDE ZUGESTIMMT..." + § 6 Rechte des Kunden als
//   beguenstigte Dritte (Abs. 1/4/5, nur Deutsch; "EHG" = Platzhalter fuer kunde.firmenname)
// - Hauptteil (SPECIAL/GENERAL TERMS, 1.1-10.10): immer bilingual (EN|DE)
// - Pro gewaehlter Plattform ein eigener Anhang (A, B, ...)
// Dynamische Werte aus vertrag.* + vertrag.awareness_felder.* + unternehmen.*

import { VertraegeCreate } from '../VertraegeCreateCore.js';
import { uploadGeneratedVertragPdf } from './VertragPdfUpload.js';

VertraegeCreate.prototype.generateAwarenessPDF = async function(vertrag, lang = this.getContractLanguage(vertrag)) {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFont('helvetica');

    const en = lang === 'en';

    // ============================================
    // Daten & dynamische Werte
    // ============================================
    const af = vertrag.awareness_felder || {};
    const kunde = this.unternehmen.find(u => u.id === vertrag.kunde_unternehmen_id) || {};
    const creator = this.creators.find(c => c.id === vertrag.creator_id) || {};
    const creatorAddr = this.getResolvedCreatorContractAddress(creator, vertrag) || {};
    const kampagne = this.kampagnen.find(k => k.id === vertrag.kampagne_id) || {};
    const markenname = kampagne?.marke?.markenname || 'BURGA';

    const ph = (v, len = 20) => {
      const s = (v === null || v === undefined) ? '' : String(v).trim();
      return s !== '' ? s : '_'.repeat(len);
    };

    const platLabels = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube' };
    const platLabel = (p) => p === 'sonstige'
      ? (vertrag.plattformen_sonstige || (en ? 'Other' : 'Sonstige'))
      : (platLabels[p] || p);
    const plattformen = (vertrag.plattformen || []).length ? vertrag.plattformen : ['tiktok'];
    const plattformenText = plattformen.map(platLabel).join(', ') || 'TikTok';
    const platAccountsEn = plattformen.map(platLabel).join(' and ') || 'TikTok';
    const platAccountsDe = plattformen.map(platLabel).join(' und ') || 'TikTok';

    // Plattform-Nomen im Singular (fuer "Das TikTok Video muss ..." etc.)
    const platNoun = (p, lc = false) => {
      const map = {
        tiktok: lc ? 'TikTok video' : 'TikTok Video',
        instagram: lc ? 'Instagram reel' : 'Instagram-Reel',
        youtube: lc ? 'YouTube video' : 'YouTube Video'
      };
      return map[p] || (lc ? 'video' : 'Video');
    };

    const anzahlReels = vertrag.anzahl_reels || 0;
    const anzahlFeed = vertrag.anzahl_feed_posts || 0;
    const anzahlStorys = vertrag.anzahl_storys || 0;

    // Lieferumfang pro Plattform (Anhang-Tabelle, einsprachig per lang)
    const lieferumfangFor = (p) => {
      if (p === 'instagram') {
        const parts = [];
        if (anzahlReels) parts.push(en ? `${anzahlReels} Instagram reel(s)` : `${anzahlReels} Instagram-Reel(s)`);
        if (anzahlFeed) parts.push(en ? `${anzahlFeed} feed post(s)` : `${anzahlFeed} Feed-Post(s)`);
        if (anzahlStorys) parts.push(en ? `${anzahlStorys} story slide(s)` : `${anzahlStorys} Story-Slide(s)`);
        return parts.join(', ') || (en ? '1 Instagram reel' : '1 Instagram-Reel');
      }
      if (p === 'youtube') return `${anzahlReels || 1} YouTube ${en ? 'video(s)' : 'Video(s)'}`;
      if (p === 'sonstige') return `${anzahlReels || 1} ${platLabel('sonstige')} ${en ? 'video(s)' : 'Video(s)'}`;
      return `${anzahlReels || 1} TikTok ${en ? 'video(s)' : 'Video(s)'}`;
    };

    // 1.2.2 Deliverables im Haupttext: EN- und DE-Variante getrennt,
    // damit die EN-Spalte auch bei lang=de englisch bleibt.
    const buildDeliverables = (isEn) => {
      const parts = [];
      const plat = plattformen.map(platLabel).join('/') || 'TikTok';
      if (anzahlReels) {
        const noun = plattformen.length === 1 && plattformen[0] === 'instagram'
          ? (isEn ? 'Instagram reel(s)' : 'Instagram-Reel(s)')
          : (isEn ? 'video(s)' : 'Video(s)');
        parts.push(`${anzahlReels} ${plat} ${noun}`);
      }
      if (anzahlFeed) parts.push(isEn ? `${anzahlFeed} feed post(s)` : `${anzahlFeed} Feed-Post(s)`);
      if (anzahlStorys) parts.push(isEn ? `${anzahlStorys} story slide(s)` : `${anzahlStorys} Story-Slide(s)`);
      return parts.join(', ') || (isEn ? `1 ${plat} video` : `1 ${plat} Video`);
    };
    const deliverablesEn = buildDeliverables(true);
    const deliverablesDe = buildDeliverables(false);

    // Account-Handle pro Plattform (Anhang). influencer_profile-Eintraege sind
    // i.d.R. "TikTok @handle" – Plattform-Praefix fuer die Anzeige entfernen.
    const stripPlatPrefix = (s) => (s || '').replace(/^\s*(tiktok|instagram|youtube)\s*/i, '').trim();
    const profileFor = (re) => stripPlatPrefix((vertrag.influencer_profile || []).find(pr => re.test(pr)) || '');
    const tiktokHandle = profileFor(/tiktok/i) || creator.tiktok || '';
    const accountFor = (p) => {
      if (p === 'tiktok') return tiktokHandle;
      if (p === 'instagram') return creator.instagram || profileFor(/insta/i);
      if (p === 'youtube') return profileFor(/youtube/i);
      return '';
    };

    // Anhang-Referenzen (A, B, ...) fuer 3.2.1 / 7.1 / 7.2
    const ANNEX_LETTERS = ['A', 'B', 'C', 'D', 'E'];
    const annexLetters = plattformen.map((_, i) => ANNEX_LETTERS[i] || String(i + 1));
    const annexRefEn = annexLetters.length > 1
      ? `Annexes ${annexLetters.slice(0, -1).join(', ')} and ${annexLetters[annexLetters.length - 1]}`
      : `Annex ${annexLetters[0]}`;
    const annexRefDe = annexLetters.length > 1
      ? `Anhänge ${annexLetters.slice(0, -1).join(', ')} und ${annexLetters[annexLetters.length - 1]}`
      : `Anhang ${annexLetters[0]}`;

    // Datum im ISO-Format wie im Original (2025-04-10)
    const isoDate = (d) => {
      if (!d) return null;
      const dt = new Date(d);
      return Number.isNaN(dt.getTime()) ? String(d) : dt.toISOString().split('T')[0];
    };
    const verguetungBetrag = (af.verguetung_brutto !== null && af.verguetung_brutto !== undefined)
      ? af.verguetung_brutto
      : vertrag.verguetung_netto;
    const moneyEn = this.formatContractMoney(verguetungBetrag, 'en', { emptyValue: '__________' });
    const moneyDe = this.formatContractMoney(verguetungBetrag, 'de', { emptyValue: '__________' });

    const zahlungszielTage = { '14_tage': 14, '30_tage': 30, '45_tage': 45 }[vertrag.zahlungsziel] || 30;

    const zahlungsmethode = af.zahlungsmethode;
    const zahlungsmethodeEn = zahlungsmethode === 'paypal' ? 'PayPal'
      : zahlungsmethode === 'banktransfer' ? 'bank transfer'
      : 'bank transfer or PayPal';
    const zahlungsmethodeDe = zahlungsmethode === 'paypal' ? 'PayPal'
      : zahlungsmethode === 'banktransfer' ? 'Banküberweisung'
      : 'Banküberweisung oder PayPal';

    const aufbewahrung = af.content_aufbewahrung_dauer || '12_monate';
    const aufbewahrungEn = aufbewahrung === '6_monate' ? '6 (six) months'
      : aufbewahrung === 'individuell' ? 'the agreed period'
      : '1 (one) year';
    const aufbewahrungDe = aufbewahrung === '6_monate' ? '6 (sechs) Monate'
      : aufbewahrung === 'individuell' ? 'den vereinbarten Zeitraum'
      : '1 (ein) Jahr';

    const videoLen = af.video_mindestlaenge_sekunden;
    const statistikFrist = af.statistik_frist_tage;
    const contentVorlauf = af.content_vorlauf_tage || 3;
    const kuendigungsfrist = af.kuendigungsfrist_tage || 30;
    const brandTag = af.brand_tag || '';
    const veroeffentlichungsfrist = isoDate(af.veroeffentlichungsfrist);

    // ============================================
    // Layout-Konstanten
    // ============================================
    const LEFT_X = 14;      // EN-Spalte / linker Rand
    const RIGHT_X = 109;    // DE-Spalte (Hauptteil)
    const COL_W = 87;       // Spaltenbreite (Hauptteil)
    const FULL_W = 182;     // volle Breite (Deckblatt/Anhang)
    const TOP_Y = 20;
    const MAX_CONTENT_Y = 275;
    const FOOTER_Y = 288;
    const LH = 4;           // Zeilenhoehe Fliesstext
    const LH_H = 4.6;       // Zeilenhoehe Ueberschrift

    let pageNumber = 1;
    let y = TOP_Y;

    const setBody = () => { doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); };
    const setHead = () => { doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); };

    const addFooter = () => {
      const prevSize = doc.getFontSize();
      const prevFont = doc.getFont();
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120);
      const footerLabel = kunde.firmenname
        ? `${kunde.firmenname}`
        : 'Influencer Agreement';
      doc.text(footerLabel, LEFT_X, FOOTER_Y);
      doc.text(`${en ? 'Page' : 'Seite'} ${pageNumber}`, 196, FOOTER_Y, { align: 'right' });
      doc.setTextColor(0);
      doc.setFontSize(prevSize);
      doc.setFont(prevFont.fontName, prevFont.fontStyle);
      pageNumber++;
    };

    const newPage = () => {
      addFooter();
      doc.addPage();
      y = TOP_Y;
      return y;
    };

    // Bilingualer Absatz: EN links, DE rechts, Zeilenumbruch + Seitenumbruch
    const row = (enText, deText, opts = {}) => {
      const gap = opts.gap ?? 1.5;
      setBody();
      const enLines = doc.splitTextToSize(enText || '', COL_W);
      const deLines = doc.splitTextToSize(deText || '', COL_W);
      const rows = Math.max(enLines.length, deLines.length);
      if (y + rows * LH > MAX_CONTENT_Y) y = newPage();
      for (let i = 0; i < rows; i++) {
        if (enLines[i]) doc.text(enLines[i], LEFT_X, y + i * LH);
        if (deLines[i]) doc.text(deLines[i], RIGHT_X, y + i * LH);
      }
      y += rows * LH + gap;
    };

    // Bilinguale Ueberschrift (fett)
    const heading = (enText, deText, opts = {}) => {
      const topGap = opts.topGap ?? 3;
      y += topGap;
      setHead();
      const enLines = doc.splitTextToSize(enText || '', COL_W);
      const deLines = doc.splitTextToSize(deText || '', COL_W);
      const rows = Math.max(enLines.length, deLines.length);
      if (y + rows * LH_H > MAX_CONTENT_Y) y = newPage();
      for (let i = 0; i < rows; i++) {
        if (enLines[i]) doc.text(enLines[i], LEFT_X, y + i * LH_H);
        if (deLines[i]) doc.text(deLines[i], RIGHT_X, y + i * LH_H);
      }
      y += rows * LH_H + 1.5;
      setBody();
    };

    // Volle Breite (Titel etc.), zentriert
    const centered = (text, size, style, dy = 0) => {
      doc.setFont('helvetica', style || 'normal');
      doc.setFontSize(size);
      y += dy;
      doc.text(text, 105, y, { align: 'center' });
    };

    // Einsprachiger Absatz ueber die volle Breite (Deckblatt/Anhang)
    const para = (text, opts = {}) => {
      const { style = 'normal', indent = 0, gap = 1.5, align, size = 8.5 } = opts;
      doc.setFont('helvetica', style);
      doc.setFontSize(size);
      const lines = doc.splitTextToSize(text || '', FULL_W - indent);
      if (y + lines.length * LH > MAX_CONTENT_Y) y = newPage();
      lines.forEach(line => {
        if (align === 'center') doc.text(line, 105, y, { align: 'center' });
        else doc.text(line, LEFT_X + indent, y);
        y += LH;
      });
      y += gap;
      setBody();
    };

    // Haengender Einzug: Marker (A)/(B)/(C) links, Text eingerueckt
    const hanging = (marker, text) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      const lines = doc.splitTextToSize(text || '', FULL_W - 8);
      if (y + lines.length * LH > MAX_CONTENT_Y) y = newPage();
      doc.text(marker, LEFT_X, y);
      lines.forEach(line => { doc.text(line, LEFT_X + 8, y); y += LH; });
      y += 1.5;
    };

    // Checkbox zeichnen (Deckblatt, wie InfluencerPdf)
    const drawCheckbox = (x, yPos, checked, label) => {
      doc.rect(x, yPos - 2.5, 3, 3);
      if (checked) {
        doc.line(x + 0.5, yPos - 2, x + 2.5, yPos);
        doc.line(x + 0.5, yPos, x + 2.5, yPos - 2);
      }
      doc.text(label, x + 5, yPos);
    };

    // Tabelle mit Vollrahmen (Anhang). Zellen = Array von Segmenten
    // { text, style?, bullet?, gapAfter? } fuer fette Zwischenzeilen/Bullets.
    // Wird nicht mitten drin umgebrochen (vorher newPage, wenn noetig).
    const boxTable = (headers, rows, colWidths) => {
      const PAD = 1.5;
      const W = colWidths.reduce((a, b) => a + b, 0);

      const prepCell = (segments, w, bold) => {
        const out = [];
        segments.forEach(seg => {
          const prefix = seg.bullet ? '• ' : '';
          const wrapped = doc.splitTextToSize(prefix + (seg.text || ''), w - 2 * PAD);
          wrapped.forEach((t, i) => out.push({
            text: t,
            style: seg.style || (bold ? 'bold' : 'normal'),
            indent: seg.bullet && i > 0 ? 2.5 : 0
          }));
          if (seg.gapAfter) out.push({ text: '', style: 'normal', indent: 0 });
        });
        return out;
      };

      const headerCells = headers.map((h, i) => prepCell([{ text: h }], colWidths[i], true));
      const bodyCells = rows.map(r => r.map((cell, i) => prepCell(cell, colWidths[i], false)));

      const rowHeight = cells => Math.max(...cells.map(c => c.length)) * LH + 2 * PAD;
      const headerH = rowHeight(headerCells);
      const bodyHs = bodyCells.map(rowHeight);
      const totalH = headerH + bodyHs.reduce((a, b) => a + b, 0);
      if (y + totalH > MAX_CONTENT_Y) y = newPage();

      const tableTop = y;
      const renderRow = (cells, h) => {
        let x = LEFT_X;
        cells.forEach((cell, i) => {
          let cy = y + PAD + 2.5;
          cell.forEach(line => {
            doc.setFont('helvetica', line.style);
            doc.setFontSize(8.5);
            if (line.text) doc.text(line.text, x + PAD + line.indent, cy);
            cy += LH;
          });
          x += colWidths[i];
        });
        y += h;
      };

      renderRow(headerCells, headerH);
      bodyCells.forEach((cells, i) => renderRow(cells, bodyHs[i]));

      // Aussenrahmen + Innenlinien
      doc.setDrawColor(0);
      doc.rect(LEFT_X, tableTop, W, totalH);
      doc.line(LEFT_X, tableTop + headerH, LEFT_X + W, tableTop + headerH);
      let lx = LEFT_X;
      colWidths.slice(0, -1).forEach(w => { lx += w; doc.line(lx, tableTop, lx, tableTop + totalH); });
      y += 2;
      setBody();
    };

    // Unterschriftenblock (Unternehmen + Influencer), zweispaltig, mit Umbruchschutz
    const signatureBlock = (startY) => {
      let sy = startY;
      const NEEDED = 62;
      if (sy + NEEDED > MAX_CONTENT_Y) {
        sy = newPage();
      } else {
        sy += 10;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(en ? 'FOR AND ON BEHALF OF THE COMPANY' : 'FÜR UND IM NAMEN DES UNTERNEHMENS', LEFT_X, sy);
      doc.text(en ? 'FOR AND ON BEHALF OF THE INFLUENCER' : 'FÜR UND IM NAMEN DES INFLUENCERS', RIGHT_X, sy);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      sy += 10;
      const labels = en
        ? ['[Name]', '[Title]', '[Date]', '[Signature]']
        : ['[Name]', '[Titel]', '[Datum]', '[Unterschrift]'];
      labels.forEach((lab) => {
        doc.text(`_____________________________  ${lab}`, LEFT_X, sy);
        doc.text(`_____________________________  ${lab}`, RIGHT_X, sy);
        sy += 11;
      });
      return sy;
    };

    // ============================================
    // SEITE 1: Deckblatt (gestapelt, wie Standard-Influencer-Vertrag)
    // LikeGroup = Agentur (fix), Kunde + Influencer dynamisch.
    // ============================================

    // LikeGroup Logo als SVG (identisch zum Standard-Influencer-Vertrag)
    const logoSvg = `<svg width="120" height="66" viewBox="0 0 120 66" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_4719_236)">
<path d="M65.7855 50.1389V47.153H64.2168V60.8863H65.7855V53.7794C65.7855 50.6035 67.8717 48.5575 71.1445 48.5575H71.4975V46.9418H71.1445C68.7105 46.9418 66.8153 48.1536 65.7855 50.1468V50.1415V50.1389Z" fill="#0D0D0D"/>
<path d="M79.4557 46.8257C75.2885 46.8257 72.1484 49.9224 72.1484 54.0144C72.1484 58.1064 75.3176 61.2031 79.4557 61.2031C83.5937 61.2031 86.739 58.1064 86.739 54.0144C86.739 49.9224 83.6282 46.8257 79.4557 46.8257ZM85.1119 54.017C85.1119 57.2458 82.7019 59.6983 79.4557 59.6983C76.2095 59.6983 73.7702 57.2484 73.7702 54.017C73.7702 50.7857 76.2042 48.3358 79.4557 48.3358C82.7072 48.3358 85.1119 50.7857 85.1119 54.017Z" fill="#0D0D0D"/>
<path d="M100.293 55.1998C100.293 57.8926 98.3151 59.6957 95.6343 59.6957C92.9535 59.6957 91.1937 57.919 91.1937 55.2526V47.1504H89.625V55.6855C89.625 59.0278 91.844 61.2058 95.1751 61.2058C97.4764 61.2058 99.26 60.2078 100.293 58.4866V60.8837H101.861V47.1504H100.293V55.2024V55.1971V55.1998Z" fill="#0D0D0D"/>
<path d="M112.96 46.8257C110.335 46.8257 108.169 48.1694 107.004 50.2999V47.1478H105.436V66H107.004V57.7342C108.164 59.8594 110.33 61.2084 112.96 61.2084C116.995 61.2084 120 58.1117 120 54.0197C120 49.9277 116.998 46.831 112.96 46.831V46.8257ZM112.692 59.6983C109.441 59.6983 107.007 57.2484 107.007 54.017C107.007 50.7857 109.441 48.3358 112.692 48.3358C115.944 48.3358 118.378 50.7857 118.378 54.017C118.378 50.7857 115.944 59.6983 112.692 59.6983Z" fill="#0D0D0D"/>
<path d="M48.8391 48.6869H59.8119C59.419 55.007 54.2883 59.6006 47.7349 59.6006C40.6719 59.6006 35.3421 54.2626 35.3421 47.1926C35.3421 47.0158 35.3474 46.8389 35.3553 46.6594H33.6168C33.6115 46.8362 33.6035 47.0105 33.6035 47.1926C33.6035 55.1628 39.6792 61.2084 47.7376 61.2084C55.796 61.2084 61.5531 55.4374 61.5531 47.7022V47.153H48.8417V48.6842H48.8364H48.8391V48.6869Z" fill="#0D0D0D"/>
<path d="M28.7462 15.3067H23.1191V41.5879H28.7462V15.3067Z" fill="#0D0D0D"/>
<path d="M5.58991 0H0V41.448H18.2535V36.4531H5.59257L5.58991 0Z" fill="#0D0D0D"/>
<path d="M82.6114 35.9753C81.0347 37.2636 78.9777 38.0503 76.6233 38.0503C71.8589 38.0503 68.4667 34.9642 67.6041 30.7402H91.3838C91.6784 28.3114 91.3838 26.1703 91.3838 26.1703C90.3513 19.4885 84.3207 14.1715 76.6233 14.1715C68.0633 14.1715 61.7461 20.6844 61.7461 28.4513C61.7461 36.2182 68.0659 42.731 76.6233 42.731C82.2477 42.731 86.8423 39.9538 89.3851 35.9753H82.6114ZM76.618 18.8522C81.3825 18.8522 84.9472 22.0519 85.7514 26.1624H67.6041C68.5251 21.8777 72.0261 18.8522 76.6233 18.8522H76.6233Z" fill="#0D0D0D"/>
<path d="M62.0331 41.4525C61.6187 40.1351 61.0132 38.8889 60.2323 37.748C57.5524 33.817 53.1035 31.4694 48.3254 31.4694C45.927 31.4694 43.595 32.078 41.5286 33.1767L59.2071 15.2815H52.3678L39.7225 28.3367V0H34.0918V41.5052H39.4251C40.8248 38.3356 44.0147 36.1171 47.7251 36.1171C51.4356 36.1171 54.6254 38.3329 56.0252 41.5052H62.0463C62.0463 41.5052 62.041 41.4893 62.0384 41.4683C62.0384 41.4604 62.0331 41.4525Z" fill="#0D0D0D"/>
</g>
<defs>
<clipPath id="clip0_4719_236">
<rect width="120" height="66" fill="white"/>
</clipPath>
</defs>
</svg>`;

    // Helper: SVG zu PNG konvertieren (data: URL statt blob:)
    const svgToPngDataUrl = async (svgString, width, height) => {
      return new Promise((resolve, reject) => {
        const svgBase64 = btoa(unescape(encodeURIComponent(svgString)));
        const dataUrl = `data:image/svg+xml;base64,${svgBase64}`;
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = width * 2;
          canvas.height = height * 2;
          const ctx = canvas.getContext('2d');
          ctx.scale(2, 2);
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = dataUrl;
      });
    };

    // Logo oben zentriert (in Umgebungen ohne Canvas, z.B. Tests, uebersprungen)
    let logoBase64 = null;
    try {
      const testCtx = document.createElement('canvas').getContext?.('2d');
      if (typeof Image !== 'undefined' && testCtx) {
        logoBase64 = await svgToPngDataUrl(logoSvg, 120, 66);
      }
    } catch (e) {
      console.warn('⚠️ Logo wird uebersprungen:', e);
    }
    if (logoBase64) doc.addImage(logoBase64, 'PNG', 93.6, 10, 22.75, 12.6);

    // Titel
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(en ? 'INFLUENCER COOPERATION AGREEMENT' : 'INFLUENCER-KOOPERATIONSVERTRAG', 105, 54, { align: 'center' });
    doc.setFont('helvetica', 'normal');

    // Vertragsname
    doc.setFontSize(10);
    doc.text(`${vertrag.name || (en ? 'Untitled' : 'Ohne Name')}`, 105, 64, { align: 'center' });

    y = 80;

    // Agenturdaten (LikeGroup, fix)
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(en ? 'Agency details' : 'Agenturdaten', 105, y, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y += 8;
    doc.text('LikeGroup GmbH', 105, y, { align: 'center' });
    y += 5;
    doc.text('Jakob-Latscha-Str. 3', 105, y, { align: 'center' });
    y += 5;
    doc.text('60314 Frankfurt am Main', 105, y, { align: 'center' });
    y += 5;
    doc.text(en ? 'Germany' : 'Deutschland', 105, y, { align: 'center' });

    // Kundendaten (dynamisch)
    y += 15;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(en ? 'Client details' : 'Kundendaten', 105, y, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y += 8;
    doc.text(`${en ? 'Company name' : 'Firmenname'}: ${kunde.firmenname || '-'}`, 105, y, { align: 'center' });
    y += 5;
    doc.text(`${kunde.rechnungsadresse_strasse || ''} ${kunde.rechnungsadresse_hausnummer || ''}`.trim(), 105, y, { align: 'center' });
    y += 5;
    doc.text(`${kunde.rechnungsadresse_plz || ''} ${kunde.rechnungsadresse_stadt || ''}`.trim(), 105, y, { align: 'center' });

    // Influencer-Vertretung
    y += 15;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(en ? 'Influencer / representation' : 'Influencer / Vertretung', 105, y, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y += 8;
    doc.text(en ? 'Is the influencer represented by an agency?' : 'Wird der Influencer durch eine Agentur vertreten?', 105, y, { align: 'center' });
    y += 6;
    drawCheckbox(85, y, !vertrag.influencer_agentur_vertreten, en ? 'No' : 'Nein');
    drawCheckbox(105, y, vertrag.influencer_agentur_vertreten, en ? 'Yes' : 'Ja');

    if (vertrag.influencer_agentur_vertreten) {
      y += 8;
      doc.text(`${en ? 'Agency name' : 'Agenturname'}: ${vertrag.influencer_agentur_name || '-'}`, 105, y, { align: 'center' });
      y += 5;
      const strasseZeile = `${vertrag.influencer_agentur_strasse || ''} ${vertrag.influencer_agentur_hausnummer || ''}`.trim();
      const plzStadtZeile = `${vertrag.influencer_agentur_plz || ''} ${vertrag.influencer_agentur_stadt || ''}`.trim();
      doc.text(strasseZeile || '-', 105, y, { align: 'center' });
      y += 5;
      doc.text(plzStadtZeile || '-', 105, y, { align: 'center' });
      y += 5;
      doc.text(vertrag.influencer_agentur_land || (en ? 'Germany' : 'Deutschland'), 105, y, { align: 'center' });
      y += 5;
      doc.text(`${en ? 'Represented by' : 'Vertreten durch'}: ${vertrag.influencer_agentur_vertretung || '-'}`, 105, y, { align: 'center' });
    }

    // Influencer-Daten (dynamisch)
    y += 15;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(en ? 'Influencer details' : 'Influencer-Daten', 105, y, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y += 8;
    const creatorName = `${creator.vorname || ''} ${creator.nachname || ''}`.trim();
    doc.text(`Name: ${creatorName}`, 105, y, { align: 'center' });
    y += 5;
    y = this.appendPdfCreatorContractAddress(doc, y, creatorAddr, vertrag.influencer_land || (en ? 'Germany' : 'Deutschland'));
    y += 5;
    const profiles = vertrag.influencer_profile || [];
    doc.text(`${en ? 'Profile(s)' : 'Profil(e)'}: ${profiles.length > 0 ? profiles.join(', ') : '-'}`, 105, y, { align: 'center' });

    // PO / Auftragsnummer
    y += 15;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(en ? 'PO / order number' : 'PO / Auftragsnummer', 105, y, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    y += 8;
    doc.text(`${vertrag.kunde_po_nummer || '_______________________________'}`, 105, y, { align: 'center' });
    doc.setFontSize(9);
    y += 7;
    doc.text(en ? 'Mandatory on the invoice. Payment is not possible without it.' : 'Zwingend auf der Rechnung anzugeben. Ohne Angabe ist keine Zahlung möglich.', 105, y, { align: 'center' });
    doc.setFontSize(10);

    // ============================================
    // SEITE 2: Praeambel + Zustimmung + § 6 (Rechte des Kunden als
    // beguenstigte Dritte). Eigene Seite, weil das Deckblatt hochkant gestapelt ist.
    // ============================================
    newPage();
    setBody();

    // Praeambel (einsprachig, haengender Einzug)
    para(en ? 'WHEREAS:' : 'AUSGANGSLAGE:', { style: 'bold' });
    // Produktbeschreibung: aus awareness_felder.produkt_beschreibung, sonst BURGA-Default.
    const produktBeschreibung = (af.produkt_beschreibung || '').trim();
    hanging('(A)', produktBeschreibung || (en
      ? 'The Company is a manufacturer and distributor of cases for mobile phones, laptops, tablet and others;'
      : 'Das Unternehmen ist ein Hersteller und Vertreiber von Schutzhüllen für Handys, Laptops, Tablets und ähnliches;'));
    hanging('(B)', en
      ? 'The Influencer is a person engaged in marketing who, by his or her reputation, influences the choice of buyers;'
      : 'Der Influencer ist eine im Marketing tätige Person, die durch ihren Ruf die Entscheidung der Käufer beeinflusst;');
    hanging('(C)', en
      ? 'The Company seeks to promote its product through Influencer’s social media outlets.'
      : 'Das Unternehmen versucht, sein Produkt über die sozialen Medien durch Influencer zu bewerben.');
    y += 2;
    para(en
      ? 'AGREED TO ENTER INTO AGREEMENT UNDER THESE CONDITIONS:'
      : 'ES WURDE ZUGESTIMMT, UNTER DIESEN BEDINGUNGEN EIN ABKOMMEN ZU SCHLIESSEN:', { style: 'bold' });

    // § 6 Rechte des Kunden als beguenstigte Dritte (Abs. 1, 4, 5) — nur Deutsch,
    // volle Breite. "EHG" im Originaltext = Platzhalter fuer den Kunden.
    const ehg = ph(kunde.firmenname, 20);
    y += 4;
    para(`§ 6 Rechte von ${ehg} als begünstigte Dritte`, { style: 'bold' });
    para(`1. ${ehg} ist begünstigte Dritte im Sinne von § 328 BGB und erwirbt die nachfolgend bestimmten eigenen Rechte gegen den Creator. Die zugunsten von ${ehg} entstandenen Rechte können ohne Zustimmung von ${ehg} in Textform nicht nachträglich aufgehoben oder beschränkt werden.`);
    para(`4. Die fachliche Abstimmung erfolgt grundsätzlich über die Agentur. ${ehg} darf dem Creator unmittelbar verbindliche Weisungen erteilen, soweit diese der Einhaltung des Projektblatts, des Briefings, technischer oder markenbezogener Vorgaben oder der Vermeidung rechtlicher Risiken dienen. Bei widersprechenden Weisungen informiert der Creator Agentur und ${ehg} unverzüglich. Im Zweifel geht die Weisung von ${ehg} vor.`);
    para('5. Die gesetzlichen Einwendungen des Creators aus diesem Vertrag bleiben bestehen.');

    // ============================================
    // SPECIAL TERMS (bilingual)
    // ============================================
    newPage();
    setBody();
    centered('SPECIAL TERMS', 12, 'bold');
    y += 4;
    doc.text('SONDERBEDINGUNGEN', 105, y, { align: 'center' });
    y += 8;
    setBody();

    // 1. Object of agreement
    heading('1. OBJECT OF AGREEMENT', '1. VERTRAGSGEGENSTAND', { topGap: 0 });
    row(
      '1.1. The Company herewith appoints an Influencer as its promoter to promote the Company’s products and brands (hereinafter – Products).',
      '1.1. Das Unternehmen ernennt hiermit einen Influencer als seinen Promoter, um die Produkte und Marken des Unternehmens (im Folgenden Produkte) zu bewerben.'
    );
    row(
      '1.2. The Influencer undertakes to promote Products through this Platform under these conditions:',
      '1.2. Der Influencer verpflichtet sich, unter diesen Bedingungen Produkte über die folgende Plattform zu bewerben:'
    );
    row(`1.2.1 ${plattformenText};`, `1.2.1. ${plattformenText};`);
    row(`1.2.2. Deliverables: ${deliverablesEn};`, `1.2.2. Lieferumfang: ${deliverablesDe};`);
    row(
      `1.2.3. ${plattformen.length === 1 ? platNoun(plattformen[0], true) : 'Video content'} has to be at least ${ph(videoLen, 4)} seconds long;`,
      `1.2.3. ${plattformen.length === 1 ? `Das ${platNoun(plattformen[0])}` : 'Video-Inhalte'} ${plattformen.length === 1 ? 'muss' : 'müssen'} mindestens ${ph(videoLen, 4)} Sekunden lang sein;`
    );
    row(
      `1.2.4. Content has to be published no later than ${ph(veroeffentlichungsfrist, 12)};`,
      `1.2.4. Der Inhalt muss bis spätestens ${ph(veroeffentlichungsfrist, 12)} veröffentlicht werden;`
    );
    row(
      '1.2.5. Creative concept has to be discussed and confirmed by the Company before filming.',
      '1.2.5. Das kreative Konzept muss vor dem Filmen mit dem Unternehmen abgesprochen und bestätigt werden;'
    );

    // 2. Payment and transfer
    heading('2. PAYMENT AND TRANSFER', '2. ZAHLUNG UND ÜBERWEISUNG');
    row(
      `2.1. For the Services named in this Agreement, the Company agrees to pay Influencer ${moneyEn} € (all fees and taxes included to the amount). Influencer agrees that this payment shall be the sole and entire compensation received and no other compensation of any kind shall be due upon termination of the Agreement or thereafter.`,
      `2.1. Für die in diesem Vertrag genannten Dienstleistungen erklärt sich das Unternehmen bereit, dem Influencer ${moneyDe} € (alle Gebühren und Steuern im Betrag enthalten) zu zahlen. Der Influencer erklärt sich damit einverstanden, dass diese Zahlung die einzige und gesamte Vergütung ist, die er erhält, und dass bei Beendigung des Vertrags oder danach keine weitere Vergütung jeglicher Art fällig wird.`
    );
    row(
      '2.2. No payments will be made until the Influencer’s Content has been approved by the Company.',
      '2.2. Es werden keine Zahlungen geleistet, bevor der Inhalt des Influencers vom Unternehmen genehmigt wurde.'
    );
    row(
      `2.3. Payment shall be made via ${zahlungsmethodeEn} within ${zahlungszielTage} days of receipt from the Influencer of a respective invoice. Invoice is made by Influencer via PayPal or by filling out the Company's or Influencer's invoice template with the provided information. By sending the invoice, the Influencer confirms that the information provided in the invoice is correct and accepts full loss if the information is incorrect. If Parties do not agree on an invoice date, the payment will be due thirty (30) days after the completion of the Agreement.`,
      `2.3. Die Zahlung erfolgt per ${zahlungsmethodeDe} innerhalb von ${zahlungszielTage} Tagen nach Erhalt einer entsprechenden Rechnung durch den Influencer. Die Rechnung wird vom Influencer über PayPal oder durch Ausfüllen der Rechnungsvorlage des Unternehmens oder des Influencers mit den bereitgestellten Informationen erstellt. Mit der Übersendung der Rechnung bestätigt der Influencer, dass die in der Rechnung gemachten Angaben korrekt sind und stimmt dem vollen Haftungsausschluss zu, falls die Angaben falsch sein sollten. Einigen sich die Parteien nicht auf ein Rechnungsdatum, wird die Zahlung dreißig (30) Tage nach Abschluss des Vertrags fällig.`
    );
    row(
      '2.4. The Company is responsible for paying all the relevant taxes by sending the transfer and is not responsible for any of the additional fees that may occur in the Influencer’s country of residence.',
      '2.4. Das Unternehmen ist für die Zahlung aller relevanten Steuern bei der Überweisung und nicht für die zusätzlichen Gebühren verantwortlich, die im Wohnsitzland des Influencers anfallen können.'
    );
    row(
      `2.5. The Influencer agrees that the collaboration shall be considered fully completed only upon the delivery of all agreed content and the provision of performance analytics (e.g., reach, impressions, clicks, engagement, etc.) related to the published content. These statistics must be provided to the Company within ${ph(statistikFrist, 4)} calendar days after the final post is published. The Influencer may issue an invoice only after the above deliverables, including the required performance statistics, have been submitted in full. Failure to provide the required insights within the stated timeframe may result in delayed payment until all deliverables are received.`,
      `2.5. Der Influencer erklärt sich damit einverstanden, dass die Zusammenarbeit erst dann als vollständig abgeschlossen gilt, wenn alle vereinbarten Inhalte geliefert und Leistungsanalysen (z. B. Reichweite, Impressionen, Klicks, Engagement usw.) in Bezug auf die veröffentlichten Inhalte bereitgestellt wurden. Diese Statistiken müssen dem Unternehmen innerhalb von ${ph(statistikFrist, 4)} Kalendertagen nach Veröffentlichung des letzten Beitrags zur Verfügung gestellt werden. Der Influencer kann erst dann eine Rechnung ausstellen, wenn die oben genannten Leistungen, einschließlich der erforderlichen Leistungsstatistiken, vollständig erbracht wurden. Werden die geforderten Einblicke nicht innerhalb des angegebenen Zeitrahmens zur Verfügung gestellt, kann dies zu einer verzögerten Zahlung führen, bis alle Leistungen eingegangen sind.`
    );

    // 3. Performance and service delivery
    heading('3. PERFORMANCE AND SERVICE DELIVERY', '3. LEISTUNG UND DIENSTLEISTUNGSERBRINGUNG');
    row(
      '3.1. The Parties agree and understand that the Products will be marked as samples.',
      '3.1. Produkte werden als ‚Sample‘ gekennzeichnet.'
    );
    row(
      '3.2. The Influencer undertakes to promote Products in accordance with the following conditions:',
      '3.2. Der Influencer verpflichtet sich, die Produkte gemäß den folgenden Bedingungen zu bewerben:'
    );
    row(
      `3.2.1. The deliverables are provided in ${annexLetters.length > 1 ? annexRefEn : 'an Annex A'}. Please review ${annexLetters.length > 1 ? 'them' : 'it'} below.`,
      `3.2.1. Die zu erbringenden Leistungen sind in ${annexLetters.length > 1 ? `den ${annexRefDe}` : 'einem Anhang A'} enthalten. Bitte lesen Sie ${annexLetters.length > 1 ? 'sie' : 'ihn'} unten.`
    );
    row(
      '3.2.2. All Content developed by Influencer is to be approved by the Company before posting. The Company can either approve the content or ask for additional revisions and/or amendments within two (2) days of receipt of work.',
      '3.2.2. Alle vom Influencer entwickelten Inhalte müssen vor der Veröffentlichung vom Unternehmen genehmigt werden. Das Unternehmen kann den Inhalt entweder genehmigen oder innerhalb von zwei (2) Tagen nach Erhalt der Arbeit zusätzliche Überarbeitungen und/oder Änderungen verlangen.'
    );
    row(
      '3.2.3. The Company is to be tagged in every single social media post. It must be clearly stated that the advertisement is a paid collaboration.',
      '3.2.3. Das Unternehmen muss in jedem einzelnen Beitrag auf Social Media genannt werden. Es muss deutlich angegeben werden, dass es sich bei der Anzeige um eine bezahlte Zusammenarbeit handelt.'
    );
    row(
      `3.2.4. All Content shall be submitted to the Company prior to publication, minimum ${contentVorlauf} business days prior to Content going live. The Company has a right to reject any deliverable in accordance with this Section and must notify the Influencer within 3 business days of receipt of work;`,
      `3.2.4. Alle Inhalte müssen dem Unternehmen vor der Veröffentlichung vorgelegt werden, und zwar mindestens ${contentVorlauf} Werktage, bevor der Inhalt veröffentlicht wird. Das Unternehmen hat das Recht, jede Leistung in Übereinstimmung mit diesem Abschnitt abzulehnen und muss den Influencer innerhalb von 3 Werktagen nach Erhalt der Arbeit benachrichtigen.`
    );

    // 4. Ownership and usage
    heading('4. OWNERSHIP AND USAGE', '4. EIGENTUM UND NUTZUNG');
    row(
      `4.1. The Influencer agrees to display the Content as directed by the Company and keep such Content on his/her ${platAccountsEn} account for a period of ${aufbewahrungEn}. If requested by the Company, Influencer agrees to remove the Content from any of Influencer’s Platform and to cease all further use thereof. All the rights to Content remain the property of the Influencer.`,
      `4.1. Der Influencer erklärt sich damit einverstanden, die Inhalte gemäß den Anweisungen des Unternehmens zu zeigen und diese Inhalte für einen Zeitraum von ${aufbewahrungDe} auf seinem ${platAccountsDe}-Konto zu speichern. Auf Verlangen des Unternehmens verpflichtet sich der Influencer, die Inhalte von der Plattform des Influencers zu entfernen und deren weitere Nutzung einzustellen. Alle Rechte an den Inhalten verbleiben im Eigentum des Influencers.`
    );
    row(
      `4.2. The Influencer hereby grants ${markenname} the right to reuse the Deliverables (the "Content") for purposes of organic communication, limited to organic reposting under ${markenname}'s account${brandTag ? ` (${brandTag})` : ''}.`,
      `4.2. Der Influencer gewährt ${markenname} hiermit das Recht, die erstellten Inhalte (den „Content“) für Zwecke der organischen Kommunikation wiederzuverwenden, beschränkt auf das organische Reposten unter dem ${markenname}-Account${brandTag ? ` (${brandTag})` : ''}.`
    );

    // ============================================
    // GENERAL TERMS (bilingual)
    // ============================================
    heading('GENERAL TERMS', 'ALLGEMEINE BEDINGUNGEN');

    // 5. Liability
    heading('5. LIABILITY', '5. HAFTUNG', { topGap: 0 });
    row(
      '5.1. To the fullest extent permitted by law Influencer will defend, indemnify, and hold the Company harmless from any claims or demands made by any third party, as well as any and all damages, losses, liabilities, judgments, costs, reasonable attorneys\' fees, and other expenses of every kind and nature, known and unknown, incurred or suffered by the Company, relating to or arising out of the improper and (or) insulting and (or) disrespectful (to person, race, religion, ethnic, etc.) promotion, in accordance with this Agreement, of Products and (or) Company’s brands. The Influencer understands that the provisions in this article are not limited to the Products or Company’s brands, but also include any other promotion, public remarks, statements or messages, not related to the Company or its brands, that the Influencer conducts during the Term of the Agreement or 6 months after the termination of the Agreement.',
      '5.1. Soweit gesetzlich zulässig, wird der Influencer das Unternehmen von allen Ansprüchen oder Forderungen Dritter sowie von allen Schäden, Verlusten, Verbindlichkeiten, Urteilen, Kosten, angemessenen Anwaltsgebühren und anderen Ausgaben jeder Art freistellen, bekannter und unbekannter Art, die dem Unternehmen im Zusammenhang mit der unangemessenen und (oder) beleidigenden und (oder) respektlosen (gegenüber Personen, Rasse, Religion, Ethnie usw.) Werbung für die Produkte und (oder) die Marken des Unternehmens gemäß diesem Vertrag entstanden sind oder daraus hervorgehen. Der Influencer nimmt zur Kenntnis, dass sich die Bestimmungen dieses Artikels nicht auf die Produkte oder die Marken des Unternehmens beschränken, sondern auch alle anderen Werbemaßnahmen, öffentlichen Äußerungen, Erklärungen oder Nachrichten umfassen, die sich nicht auf das Unternehmen oder seine Marken beziehen und die der Influencer während der Laufzeit des Vertrags oder 6 Monate nach Beendigung des Vertrags durchführt.'
    );
    row(
      '5.2. The Influencer undertakes to comply with all the rules and the requirements of the relevant social media platforms, not to distribute the prohibited, unethical or Company discrediting content. The Company has a maximum of two (2) business days to reject any deliverable (in writing) in accordance with this section and must notify Influencer within two (2) business days of receipt of work that additional revisions and/or amendments will be requested unless a representative of the Company sent a written notice prior to the Influencer providing longer approval timeframe. The Company may request no more than two (2) revisions and/or amendments to Influencer’s Content.',
      '5.2. Der Influencer verpflichtet sich, alle Regeln und Anforderungen der jeweiligen Social-Media-Plattformen einzuhalten und keine verbotenen, unethischen oder das Unternehmen diskreditierenden Inhalte zu verbreiten. Das Unternehmen kann innerhalb von zwei (2) Arbeitstagen jede Leistung (schriftlich) gemäß diesem Abschnitt ablehnen und muss den Influencer innerhalb von zwei (2) Arbeitstagen nach Erhalt der Arbeit darüber informieren, dass zusätzliche Überarbeitungen und/oder Änderungen verlangt werden, es sei denn, ein Vertreter des Unternehmens hat dem Influencer eine schriftliche Benachrichtigung zukommen lassen, die eine längere Genehmigungsfrist vorsieht. Das Unternehmen kann nicht mehr als zwei (2) Überarbeitungen und/oder Änderungen an den Inhalten des Influencers verlangen.'
    );
    row(
      '5.3. When publishing posts/statuses about the Company’s Products or brands, the Influencer must clearly disclose her material connection with the Company, including the fact that the Influencer was given any consideration or provided with certain experiences. The aforementioned disclosure should be clear and prominent and made in close proximity to any statements that the Influencer makes about the Company or the Company’s products or services. The Influencer declares that she understands that the above mentioned disclosure is required regardless of any space limitations of the medium (e.g. Twitter). The Influencer should only make factual statements about the Company or the Company’s products that the Influencer knows for certain are true and can be verified.',
      '5.3. Wenn der Influencer Beiträge/Statements über die Produkte oder Marken des Unternehmens veröffentlicht, muss er seine materielle Verbindung mit dem Unternehmen deutlich offenlegen, einschließlich der Tatsache, dass er eine Gegenleistung erhalten oder bestimmte Erfahrungen gemacht hat. Die vorgenannte Offenlegung sollte klar und deutlich sein und in unmittelbarer Nähe zu allen Aussagen erfolgen, die der Influencer über das Unternehmen oder die Produkte oder Dienstleistungen des Unternehmens macht. Der Influencer erklärt, dass er versteht, dass die oben genannte Offenlegung unabhängig von etwaigen Platzbeschränkungen des Mediums (z.B. Twitter) erforderlich ist. Der Influencer sollte nur sachliche Aussagen über das Unternehmen oder die Produkte des Unternehmens machen, von denen der Influencer sicher weiß, dass sie wahr sind und überprüft werden können.'
    );

    // 6. General requirements
    heading('6. GENERAL REQUIREMENTS', '6. ALLGEMEINE ANFORDERUNGEN');
    row(
      '6.1. The Company will provide the creator with Creative guidelines including all tags, key messages and visual requirements. The Services shall conform to the Guidelines of the Company, abide by the rules of the relevant social media platforms, and are subject to the Company’s acceptance and approval.',
      '6.1. Das Unternehmen stellt dem Ersteller kreative Richtlinien zur Verfügung, die alle Tags, Schlüsselbotschaften und visuellen Anforderungen enthalten. Die Dienste müssen mit den Richtlinien des Unternehmens übereinstimmen, die Regeln der jeweiligen Social-Media-Plattformen einhalten und unterliegen der Annahme und Genehmigung durch das Unternehmen.'
    );
    row(
      '6.2. It is obligatory to follow the Creative Guidelines provided by the Company. In the event the Influencer does not follow the Guidelines provided by the Company, the Influencer will be required to edit or redo the Content. If the Influencer refuses to amend the content and/or publishes Content without approval, the Influencer is not entitled to the compensation.',
      '6.2. Es ist verpflichtend, die vom Unternehmen vorgegebenen Gestaltungsrichtlinien zu befolgen. Falls der Influencer sich nicht an die vom Unternehmen vorgegebenen Richtlinien hält, muss er den Inhalt bearbeiten oder neu erstellen. Wenn der Influencer sich weigert, den Inhalt zu ändern und/oder den Inhalt ohne Genehmigung veröffentlicht, hat er keinen Anspruch auf Vergütung.'
    );

    // 7. Duration and termination
    heading('7. DURATION AND TERMINATION', '7. DAUER UND BEENDIGUNG');
    row(
      `7.1. This agreement shall take effect as soon as it has been signed by both parties and shall be valid for the duration of the collaboration or until all the deliverables stated in 3.2. and ${annexRefEn} are completed and pre-approval of the Company is given.`,
      `7.1. Dieser Vertrag tritt in Kraft, sobald er von beiden Parteien unterzeichnet ist, und gilt für die Dauer der Zusammenarbeit bzw. bis alle in 3.2. und ${annexRefDe} genannten Leistungen erbracht sind und die Vorabgenehmigung des Unternehmens erteilt ist.`
    );
    row(
      `7.2. In the event that all the deliverables stated in 3.2. and ${annexRefEn} are not completed and pre-approval to make amendments is not given by the Company in ${kuendigungsfrist} days after signing this Agreement, any Party retains the right to terminate this Agreement unilaterally. Termination of the contract under this subparagraph releases both parties from their obligation to effect and to receive future performance only if the deliverables have been created until the moment of termination. In case of termination under this clause the Company is responsible for paying compensation only for the deliverables that were created until termination.`,
      `7.2. Sollten nicht alle unter 3.2 und in ${annexRefDe} genannten Leistungen erbracht und die Vorabgenehmigung nicht innerhalb von ${kuendigungsfrist} Tagen nach Unterzeichnung erteilt werden, behält sich jede Vertragspartei das Recht vor, dieses Abkommen einseitig zu kündigen. Die Kündigung des Vertrags gemäß diesem Unterabsatz entbindet beide Parteien nur dann von ihrer Verpflichtung, künftige Leistungen zu erbringen und zu empfangen, wenn die Leistungen bis zum Zeitpunkt der Kündigung erbracht wurden. Im Falle einer Beendigung gemäß dieser Klausel ist das Unternehmen nur für die bis zur Beendigung erbrachten Leistungen entschädigungspflichtig.`
    );
    row(
      '7.3. In the event of a breach of the Agreement, any Party has the right to terminate this Agreement if the following conditions are met:',
      '7.3. Im Falle einer Verletzung des Abkommens hat jede Vertragspartei das Recht, das Abkommen zu kündigen, wenn die folgenden Bedingungen erfüllt sind:'
    );
    row(
      '7.3.1. the affected party, within three (3) days of learning about the infringement, informs the other party about the breach of the Agreement, obliging the guilty Party to remedy the breach;',
      '7.3.1. die betroffene Partei informiert die andere Partei innerhalb von drei (3) Tagen, nachdem sie von dem Verstoß erfahren hat, über die Verletzung des Vertrags und verpflichtet die schuldige Partei, die Verletzung zu beheben;'
    );
    row(
      '7.3.2. within the fourteen (14) days period, from the day that the written notice was received regarding the breach, the guilty Party does not remedy the breach of the Agreement.',
      '7.3.2. die schuldige Vertragspartei stellt innerhalb der Frist von vierzehn (14) Tagen ab dem Tag, an dem sie die schriftliche Mitteilung über den Verstoß erhalten hat, den Verstoß gegen das Abkommen nicht ab.'
    );
    row(
      '7.4. In addition, in the event that the Influencer has breached this Agreement, the Company has the right to:',
      '7.4. Falls der Influencer gegen diesen Vertrag verstoßen hat, hat das Unternehmen außerdem folgendes Recht:'
    );
    row(
      '7.4.1. immediately suspend, limit or terminate the Influencer’s access to any of the Company’s accounts and/or;',
      '7.4.1. er kann den Zugang des Influencers zu einem der Konten des Unternehmens sofort aussetzen, einschränken oder beenden und/oder;'
    );
    row(
      '7.4.2. instruct the Influencer to cease all promotional activities or make clarifying statements, and the Influencer shall immediately comply.',
      '7.4.2. er kann den Influencer anweisen, alle Werbemaßnahmen einzustellen oder klarstellende Erklärungen abzugeben, und der Influencer wird dem unverzüglich nachkommen.'
    );
    row(
      '7.5. In the event that the Influencer breaches the conditions of this Agreement and does not remedy the breach in accordance with articles 7.2. and 7.3. of this Agreement or infringes conditions set forth in Article 5.1. and 5.2 of this Agreement, the Influencer automatically loses the right to any kind of compensation under this Agreement and the Company has the right to immediately terminate the Agreement, informing the Influencer one (1) day prior to the termination of the Agreement. If the Agreement is terminated due to the fault of a Party, the affected Party has the right to claim direct damages.',
      '7.5. Für den Fall, dass der Influencer gegen die Bedingungen dieses Vertrages verstößt und den Verstoß nicht gemäß Artikel 7.2. und 7.3. dieses Vertrages behebt oder gegen die in Artikel 5.1. und 5.2. dieses Vertrages festgelegten Bedingungen verstößt, verliert der Influencer automatisch das Recht auf jegliche Art von Entschädigung im Rahmen dieses Vertrages und das Unternehmen hat das Recht, den Vertrag sofort zu kündigen, indem es den Influencer einen (1) Tag vor der Kündigung des Vertrags informiert. Wird das Abkommen aufgrund des Verschuldens einer Partei gekündigt, hat die betroffene Partei das Recht, direkten Schadenersatz zu verlangen.'
    );

    // 8. Confidentiality and exclusivity
    heading('8. CONFIDENTIALITY AND EXCLUSIVITY', '8. VERTRAULICHKEIT UND AUSSCHLIESSLICHKEIT');
    row(
      '8.1. During the term of the Agreement, the Influencer will receive, have access to and create documents, records and information of a confidential and proprietary nature to the Company and customers of the Company. Influencer acknowledges and agrees that such information is an asset of the Company or its clients, is not generally known to the public, is of confidential nature and, to preserve the goodwill of the Company and its clients, must be kept strictly confidential and used only in the performance of Influencer’s duties under this Agreement.',
      '8.1. Während der Laufzeit des Vertrags erhält der Influencer Zugang zu Dokumenten, Aufzeichnungen und Informationen vertraulicher und geschützter Natur, die für das Unternehmen und dessen Kunden bestimmt sind, und erstellt diese. Der Influencer erklärt sich damit einverstanden, dass diese Informationen ein Vermögenswert des Unternehmens oder seiner Kunden sind, der Öffentlichkeit nicht allgemein bekannt sind, vertraulichen Charakter haben und zur Wahrung des Firmenwerts des Unternehmens und seiner Kunden streng vertraulich behandelt und nur zur Erfüllung der Pflichten des Influencers im Rahmen dieses Vertrags verwendet werden dürfen.'
    );
    row(
      '8.2. Influencer agrees that Influencer will not use, disclose, communicate, copy or permit the use or disclosure of information indicated in article 8.1. of this Agreement to any third party in any manner whatsoever except to the existing employees of the Company or as otherwise directed by the Company in the course of Influencer’s performance of services under this Agreement, and thereafter only with the written permission of the Company. Upon termination of this Agreement or upon the request of the Company, the Influencer will return to the Company all of the confidential information, and all copies or reproductions thereof, which are in the Influencer’s possession or control.',
      '8.2. Der Influencer erklärt sich damit einverstanden, dass er die in Artikel 8.1. dieses Vertrages genannten Informationen in keiner Weise gegenüber Dritten verwendet, offenlegt, weitergibt, kopiert oder deren Verwendung oder Offenlegung zulässt, außer gegenüber den vorhandenen Mitarbeitern des Unternehmens oder auf andere Weise auf Anweisung des Unternehmens im Zuge der Erbringung der Dienstleistungen des Influencers im Rahmen dieses Vertrages, und danach nur mit schriftlicher Genehmigung des Unternehmens. Bei Beendigung dieses Vertrags oder auf Verlangen des Unternehmens gibt der Influencer alle vertraulichen Informationen und alle Kopien oder Reproduktionen davon, die sich im Besitz oder unter der Kontrolle des Influencers befinden, an das Unternehmen zurück.'
    );

    // 9. Warranties and statements
    heading('9. WARRANTIES AND STATEMENTS', '9. GEWÄHRLEISTUNGEN UND ERKLÄRUNGEN');
    row('9.1. Parties state and guarantee that:', '9.1. Die Parteien erklären und garantieren Folgendes:');
    row(
      '9.1.1. each Party is fully established and legally operates in accordance with the laws of their respective countries;',
      '9.1.1. jede Vertragspartei hat ihren Sitz und ist nach dem Recht ihres Landes rechtmäßig tätig;'
    );
    row(
      '9.1.2. the Party has performed all legal actions necessary for the proper conclusion and validity of the Agreement and has all the permits, licenses, staff required for the provision of the services provided by the law;',
      '9.1.2. die Vertragspartei hat alle für den ordnungsgemäßen Abschluss und die Gültigkeit des Vertrags erforderlichen Rechtshandlungen vorgenommen und verfügt über alle Genehmigungen, Lizenzen und Mitarbeiter, die für die Erbringung der gesetzlich vorgesehenen Dienstleistungen erforderlich sind;'
    );
    row(
      '9.1.3. in concluding the Agreement, the Party will not violate the laws, rules, regulations, ordinances, obligations or agreements binding on it.',
      '9.1.3. die Vertragspartei wird beim Abschluss des Vertrags nicht gegen die für sie verbindlichen Gesetze, Regeln, Vorschriften, Verordnungen, Verpflichtungen oder Vereinbarungen verstoßen.'
    );
    row(
      '9.2. Neither Party shall be the agent, representative or attorney-in-fact of the other Party and consequently it shall have no authority whatsoever to act in the name of or on behalf of the other Party or to bind the other Party in any way.',
      '9.2. Keine der Vertragsparteien ist der Agent, Vertreter oder Bevollmächtigte der anderen Vertragspartei und hat daher keinerlei Befugnis, im Namen oder im Auftrag der anderen Vertragspartei zu handeln oder die andere Vertragspartei in irgendeiner Weise zu binden.'
    );
    row(
      '9.3. Influencer is retained as an independent contractor of the Company. The Influencer acknowledges and agrees that:',
      '9.3. Der Influencer wird als unabhängiger Auftragnehmer des Unternehmens eingestellt. Der Influencer erkennt an und stimmt Folgendem zu:'
    );
    row(
      '9.3.1. the Influencer is solely responsible for the manner and form by which the Influencer performs under this Agreement;',
      '9.3.1. der Influencer ist allein verantwortlich für die Art und Weise, in der er im Rahmen dieses Vertrags Leistungen erbringt;'
    );
    row(
      '9.3.2. the Influencer is responsible for the withholding and payment of all taxes and other assessments arising out of the Influencer’s performance of services, and neither the Influencer nor any of the Influencer’s employees or independent clients shall be entitled to participate in any employee benefit plans of the Company;',
      '9.3.2. der Influencer ist für die Einbehaltung und Abführung aller Steuern und sonstiger Abgaben verantwortlich, die sich aus der Erbringung von Dienstleistungen durch den Influencer ergeben, und weder der Influencer noch seine Angestellten oder unabhängigen Kunden haben Anspruch auf die Teilnahme an einem Sozialplan des Unternehmens;'
    );
    row(
      '9.3.3. none of the provisions in this Agreement shall be interpreted as indicating the intent to enter into an employee-based contract.',
      '9.3.3. keine der Bestimmungen dieses Abkommens darf so ausgelegt werden, dass die Absicht besteht, einen Arbeitnehmervertrag abzuschließen.'
    );

    // 10. Miscellaneous
    heading('10. MISCELLANEOUS PROVISIONS', '10. SONSTIGE BESTIMMUNGEN');
    row(
      '10.1. This Agreement together with its annex contains the entire agreement and understanding between the Parties with respect to the subject matter hereof and supersedes and replaces all prior agreements or understandings, whether written or oral, with respect to the same subject matter that are still in force between the Parties.',
      '10.1. Dieses Abkommen mit seinem Anhang enthält die gesamte Vereinbarung und Übereinkunft zwischen den Vertragsparteien in Bezug auf den Gegenstand dieses Abkommens und ersetzt alle früheren schriftlichen oder mündlichen Vereinbarungen oder Übereinkünfte in Bezug auf denselben Gegenstand, die zwischen den Vertragsparteien noch in Kraft sind, und setzt diese außer Kraft.'
    );
    row(
      '10.2. Any amendments to this Agreement, as well as any additions or deletions, must be agreed in writing by both Parties.',
      '10.2. Änderungen dieses Abkommens sowie Ergänzungen oder Streichungen müssen von beiden Parteien schriftlich vereinbart werden.'
    );
    row(
      '10.3. Whenever possible, the provisions of this Agreement shall be interpreted in such a manner as to be valid and enforceable under the applicable law. However, if one or more provisions of this Agreement are found to be invalid, illegal or unenforceable, in whole or in part, the remainder of that provision and of this Agreement shall remain in full force and effect as if such invalid, illegal or unenforceable provision had never been contained herein. Moreover, in such an event, the parties shall amend the invalid, illegal or unenforceable provision(s) or any part thereof and/or agree on a new provision in such a way as to reflect insofar as possible the purpose of the invalid, illegal or unenforceable provision(s).',
      '10.3. Wann immer möglich, sind die Bestimmungen dieses Abkommens so auszulegen, dass sie nach dem anwendbaren Recht gültig und durchsetzbar sind. Sollten sich jedoch eine oder mehrere Bestimmungen dieses Vertrags ganz oder teilweise als ungültig, rechtswidrig oder nicht durchsetzbar erweisen, so bleiben die übrigen Bestimmungen dieses Vertrags so in Kraft, als ob die ungültige, rechtswidrige oder nicht durchsetzbare Bestimmung nie in diesem Vertrag enthalten gewesen wäre. Darüber hinaus werden die Parteien in einem solchen Fall die unwirksame(n), rechtswidrige(n) oder undurchführbare(n) Bestimmung(en) oder Teile davon ändern und/oder eine neue Bestimmung vereinbaren, die dem Zweck der unwirksamen, rechtswidrigen oder undurchführbaren Bestimmung(en) so weit wie möglich entspricht.'
    );
    row(
      '10.4. Any failure or delay by a Party in exercising any right under this Agreement, any single or partial exercise of any right under this Agreement or any partial reaction or absence of reaction by a Party in the event of violation by the other Party of one or more provisions of this Agreement, shall not operate or be interpreted as a waiver (either express or implied, in whole or in part) of that Party’s rights under this Agreement or under said provision(s), nor shall it preclude any further exercise of any such rights. Any waiver of a right must be expressed and in writing. If there has been an express written waiver of a right following a specific failure by a Party, this waiver cannot be invoked by the other Party in favour of a new failure, similar to the prior one, or in favour of any other kind of failure.',
      '10.4. Jedes Versäumnis oder jede Verzögerung einer Vertragspartei bei der Ausübung von Rechten im Rahmen dieses Abkommens, jede einmalige oder teilweise Ausübung von Rechten im Rahmen dieses Abkommens oder jede teilweise oder ausbleibende Reaktion einer Vertragspartei im Falle eines Verstoßes der anderen Vertragspartei gegen eine oder mehrere Bestimmungen dieses Abkommens gilt nicht als (ausdrücklicher oder stillschweigender, vollständiger oder teilweiser) Verzicht auf die Rechte der betreffenden Vertragspartei im Rahmen dieses Abkommens oder der genannten Bestimmung(en) und schließt eine weitere Ausübung dieser Rechte nicht aus. Jeder Verzicht auf ein Recht muss ausdrücklich und schriftlich erfolgen. Hat eine Vertragspartei ausdrücklich und schriftlich auf ein Recht verzichtet, das sich aus einem bestimmten Versäumnis ergibt, so kann die andere Vertragspartei diesen Verzicht nicht für ein neues Versäumnis, das dem vorangegangenen ähnlich ist, oder für eine andere Art von Versäumnis geltend machen.'
    );
    row(
      '10.5. Neither Party has the right to assign any or all of its rights and obligations under this Agreement to any third party without the prior written consent of the other Party.',
      '10.5. Keine der Vertragsparteien ist berechtigt, ihre Rechte und Pflichten aus diesem Abkommen ohne vorherige schriftliche Zustimmung der anderen Vertragspartei ganz oder teilweise auf Dritte zu übertragen.'
    );
    row(
      '10.6. All issues, questions and disputes concerning the validity, interpretation, enforcement, performance and termination of this Agreement shall be governed by and construed in accordance with Lithuanian law, and no effect shall be given to any other choice-of-law or conflict-of-laws rules or provisions (Lithuanian, foreign or international), that would cause the laws of any other jurisdiction to be applicable.',
      '10.6. Sämtliche Probleme, Fragen und Streitigkeiten im Zusammenhang mit der Gültigkeit, Auslegung, Durchsetzung, Erfüllung und Beendigung dieses Abkommens unterliegen litauischem Recht und sind nach diesem auszulegen; andere (litauische, ausländische oder internationale) Rechtswahl- oder Kollisionsnormen oder -bestimmungen, die dazu führen würden, dass das Recht einer anderen Rechtsordnung anwendbar wäre, bleiben unberücksichtigt.'
    );
    row(
      '10.7. All disputes concerning the validity, interpretation, enforcement, performance and termination of this Agreement shall be submitted to the exclusive jurisdiction of Kaunas city (Lithuania).',
      '10.7. Alle Streitigkeiten über die Gültigkeit, Auslegung, Durchsetzung, Erfüllung und Beendigung dieses Vertrags unterliegen der ausschließlichen Zuständigkeit der Stadt Kaunas (Litauen).'
    );
    row(
      '10.8. This Agreement is executed in separate copies, each of which is deemed an original and all of which taken together constitute one and the same agreement. Translations into any language other than English may be made but are for the sake of convenience only, even when executed by one or both parties.',
      '10.8. Dieser Vertrag wird in getrennten Exemplaren ausgefertigt, von denen jedes als Original gilt und die alle zusammen einen einzigen Vertrag darstellen. Übersetzungen in eine andere Sprache als Englisch sind möglich, haben aber nur den Zweck der Vereinfachung, auch wenn sie von einer oder beiden Parteien angefertigt werden.'
    );
    row(
      '10.9. Executed in two original copies, each party acknowledging receipt of one.',
      '10.9. Ausfertigung in zwei Originalen, wobei jede Partei den Erhalt eines Exemplars bestätigt.'
    );
    row(
      '10.10. English version of the agreement shall prevail.',
      '10.10. Es gilt die englische Version der Vereinbarung.'
    );

    // ============================================
    // Unterschriften (Vertrag)
    // ============================================
    y = signatureBlock(y);

    // ============================================
    // ANHAENGE: ein Anhang pro Plattform (einsprachig per lang)
    // ============================================
    plattformen.forEach((plattform, idx) => {
      const letter = annexLetters[idx];
      const account = accountFor(plattform);
      const nounEn = platNoun(plattform, true);
      const nounDe = platNoun(plattform);

      newPage();
      setBody();
      centered(en ? `ANNEX ${letter}` : `ANHANG ${letter}`, 12, 'bold');
      y += 8;
      setBody();

      para(en
        ? 'The Influencer’s social media platforms relevant to this Agreement:'
        : 'Die Social-Media-Plattformen des Influencers, die für diese Vereinbarung relevant sind:');
      para(`1. ${platLabel(plattform)} Account: ${ph(account, 16)}`);

      y += 2;
      para(en ? 'DELIVERABLES' : 'LEISTUNGEN', { style: 'bold', align: 'center', size: 10 });
      y += 1;

      const items = en ? [
        '1. Content must be created according to the visual guidelines (provided in a file named "Guidelines" sent together with this Agreement).',
        '2. Content must be approved before publication.',
        '3. Do not use copyrighted materials, including music that appears to be available on the platforms.',
        `4. Content must be sent for approval at least ${contentVorlauf} business days before the agreed publication date.`
      ] : [
        '1. Der Inhalt muss gemäß den visuellen Richtlinien erstellt werden (die in einer Datei namens "Richtlinien" zur Verfügung gestellt werden und zusammen mit diesem Vertrag gesendet werden).',
        '2. Der Inhalt muss vor der Veröffentlichung genehmigt werden.',
        '3. Verwenden Sie keine urheberrechtlich geschützten Materialien, einschließlich Musik, die scheinbar auf den Plattformen verfügbar ist.',
        `4. Der Inhalt muss spätestens ${contentVorlauf} Werktage vor dem vereinbarten Veröffentlichungsdatum zur Genehmigung gesendet werden.`
      ];
      items.forEach(t => para(t));
      y += 2;

      // Richtlinien-Zelle: Genehmigung + Tag + Allgemeine Richtlinien (wie Original)
      const guidelineSegments = en ? [
        { text: `The ${nounEn} must be approved by the Company before publication.`, bullet: true },
        { text: `Tag ${ph(brandTag, 14)}`, bullet: true, gapAfter: true },
        { text: 'General guidelines:', style: 'bold' },
        { text: 'Products must be properly attached to the respective devices.', bullet: true },
        { text: 'No accessories from other brands should be visible.', bullet: true },
        { text: 'High-quality video showing the product on the phone (and other devices) in the centre of the frame.', bullet: true },
        { text: 'The product design must be clearly visible (sufficient lighting, etc.).', bullet: true },
        { text: 'Tags and text must be in the Influencer’s native language.', bullet: true }
      ] : [
        { text: `Das ${nounDe} muss von dem Unternehmen vor der Veröffentlichung genehmigt werden.`, bullet: true },
        { text: `Taggen Sie ${ph(brandTag, 14)}`, bullet: true, gapAfter: true },
        { text: 'Allgemeine Richtlinien:', style: 'bold' },
        { text: 'Die Produkte müssen auf den entsprechenden Geräten angebracht sein. Die Hüllen müssen ordnungsgemäß auf die Geräte angebracht werden.', bullet: true },
        { text: 'Es sollte kein Zubehör von anderen Marken zu sehen sein.', bullet: true },
        { text: 'Qualitativ hochwertiges Video, das das Produkt auf dem Handy (und anderen Geräten) im Zentrum des Bildes zeigt.', bullet: true },
        { text: 'Das Design des Produkts muss klar sichtbar sein (ausreichende Beleuchtung; usw.).', bullet: true },
        { text: 'Tags, Text müssen in der Muttersprache des Influencers sein (auf Deutsch).', bullet: true }
      ];

      boxTable(
        en ? ['Deliverable', 'Date', 'Guidelines'] : ['Lieferumfang', 'Datum', 'Richtlinien'],
        [[
          [{ text: lieferumfangFor(plattform) }],
          [{ text: ph(veroeffentlichungsfrist, 12) }],
          guidelineSegments
        ]],
        [40, 28, 114]
      );

      para(en
        ? 'Executed in two original copies, each party acknowledging receipt of one.'
        : 'Ausfertigung in zwei Originalen, wobei jede Partei den Erhalt eines Exemplars bestätigt.',
        { style: 'bold' });

      // Unterschriften (Anhang)
      y = signatureBlock(y);
    });

    // Letzte Fußzeile
    addFooter();

    // ============================================
    // Speichern + Upload
    // ============================================
    const pdfBlob = doc.output('blob');
    const filePrefix = en ? 'EN_Contract_Awareness' : 'Vertrag_Awareness';
    const fileName = `${filePrefix}_${vertrag.name || 'Kooperation'}_${new Date().toISOString().split('T')[0]}.pdf`;

    const uploadResult = await uploadGeneratedVertragPdf(this, vertrag, pdfBlob, fileName);
    if (uploadResult?.fileUrl) {
      console.log('✅ Direktvertrag-PDF nach Dropbox hochgeladen und URL gespeichert');
    } else {
      console.warn('⚠️ Dropbox-Upload nicht erfolgreich – PDF wird nur lokal heruntergeladen');
    }
    doc.save(fileName);

    console.log('✅ Direktvertrag-PDF generiert');
  } catch (error) {
    console.error('❌ Fehler bei Direktvertrag-PDF-Generierung:', error);
    window.toastSystem?.show('PDF konnte nicht generiert werden', 'warning');
  }
};
