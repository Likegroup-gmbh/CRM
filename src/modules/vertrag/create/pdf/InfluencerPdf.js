// pdf/InfluencerPdf.js
// Influencer-Kooperationsvertrag: PDF-Generierung.

import { VertraegeCreate } from '../VertraegeCreateCore.js';
import { uploadGeneratedVertragPdf } from './VertragPdfUpload.js';
import { renderPaginatedText, renderZusatzBestimmung } from './PdfTextFlow.js';
import { KSK_SELBSTZAHLER_VERTRAGSTEXT_DE } from '../../../../core/budget/kskSelbstzahler.js';
import { loadLikeGroupLogoPng, drawLikeGroupLogo, likeGroupFooterLine } from '../../../../core/pdf/PdfBrand.js';

VertraegeCreate.prototype.generateInfluencerPDF = async function(vertrag, lang = this.getContractLanguage(vertrag)) {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      doc.setFont('helvetica');
      this.localizeDocText(doc, lang);

      // Konstanten für Fußzeile (gesperrter Bereich)
      const FOOTER_Y = 285;
      const MAX_CONTENT_Y = 265;

      const logoBase64 = await loadLikeGroupLogoPng();

      // Seitenzähler für Fußzeile
      let pageNumber = 1;

      // Helper: Fußzeile hinzufügen (stellt Font-Zustand danach wieder her)
      const addFooter = () => {
        const prevSize = doc.getFontSize();
        const prevFont = doc.getFont();
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text(likeGroupFooterLine(), 14, FOOTER_Y);
        doc.text(`Seite ${pageNumber}`, 196, FOOTER_Y, { align: 'right' });
        doc.setTextColor(0);
        doc.setFontSize(prevSize);
        doc.setFont(prevFont.fontName, prevFont.fontStyle);
        pageNumber++;
      };

      // Helper: Seitenumbruch für paginierten Freitext (Footer + neue Seite)
      const onPageBreak = () => {
        addFooter();
        doc.addPage();
        return 20;
      };

      // Zusätzliche Bestimmungen pro Paragraph (optional)
      const zusaetze = vertrag.paragraph_zusaetze || {};

      // Hole Kunden- und Creator-Daten
      const kunde = this.unternehmen.find(u => u.id === vertrag.kunde_unternehmen_id);
      const creator = this.creators.find(c => c.id === vertrag.creator_id);
      const creatorContractAddress = this.getResolvedCreatorContractAddress(creator, vertrag);

      // Helper: Datum formatieren
      const formatDate = (d) => this.formatContractDate(d, lang);
      const formatMoney = (v, emptyValue = '0,00') => this.formatContractMoney(v, lang, { emptyValue });

      // Helper: Checkbox zeichnen
      const drawCheckbox = (x, yPos, checked, label) => {
        doc.rect(x, yPos - 2.5, 3, 3);
        if (checked) {
          doc.line(x + 0.5, yPos - 2, x + 2.5, yPos);
          doc.line(x + 0.5, yPos, x + 2.5, yPos - 2);
        }
        doc.text(label, x + 5, yPos);
      };

      // Helper: Ja/Nein Checkboxen
      const drawYesNoCheckboxes = (x, yPos, value) => {
        drawCheckbox(x, yPos, value === true, 'Ja');
        drawCheckbox(x + 20, yPos, value === false || value === undefined || value === null, 'Nein');
      };

      // Helper: Text mit Umbruch (zeilenweise paginiert, läuft nie in die Fußzeile)
      const addWrappedText = (text, x, yStart, maxWidth) => {
        const localizedText = this.localizeContractText(text, lang);
        return renderPaginatedText(doc, localizedText, { x, y: yStart, maxWidth, maxContentY: MAX_CONTENT_Y, onPageBreak });
      };

      // Labels
      const nutzungsdauerLabels = {
        'unbegrenzt': 'Unbegrenzt',
        '12_monate': '12 Monate',
        '6_monate': '6 Monate',
        '3_monate': '3 Monate'
      };
      const getNutzungsdauerText = (v) => {
        if (v.nutzungsdauer === 'individuell' && v.nutzungsdauer_custom_wert != null) {
          const einheit = v.nutzungsdauer_custom_einheit === 'jahre' ? 'Jahre' : 'Monate';
          return `${v.nutzungsdauer_custom_wert} ${einheit}`;
        }
        return nutzungsdauerLabels[v.nutzungsdauer] || '-';
      };

      const organischeVeroeffentlichungLabels = {
        'influencer_only': 'Veröffentlichung ausschließlich über den Influencer',
        'collab': 'Co-Autoren-Post / Collab',
        'zusatz_unternehmen': 'Zusätzliche Veröffentlichung durch Unternehmen/Kunden',
        'keine_zusatz': 'Keine zusätzliche Veröffentlichung durch Unternehmen/Kunden'
      };

      const mediaBuyoutLabels = {
        'organisch': 'Organisch',
        'paid': 'Paid Ads',
        'beides': 'Organisch & Paid Ads'
      };

      const mindestOnlineDauerLabels = {
        '7_tage': '7 Tage',
        '14_tage': '14 Tage',
        '30_tage': '30 Tage',
        'unbegrenzt': 'Unbegrenzt'
      };

      const zahlungszielLabels = {
        '14_tage': '14 Tage',
        '30_tage': '30 Tage',
        '45_tage': '45 Tage'
      };

      const anpassungenLabels = {
        'schnitt': 'Schnitt & Tempo',
        'hook': 'Hook / Einstieg',
        'szenenreihenfolge': 'Szenenreihenfolge',
        'effekte': 'Effekte / Zooms',
        'untertitel': 'Untertitel',
        'nachfilmen': 'Nachfilmen einzelner Szenen'
      };

      // ============================================
      // SEITE 1: Titel + Adressdaten (ZENTRIERT)
      // ============================================

      // Logo oben zentriert
      drawLikeGroupLogo(doc, logoBase64, { align: 'center' });

      // Titel (Logo endet bei y=46, daher Titel ab y=54)
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('INFLUENCER-KOOPERATIONSVERTRAG', 105, 54, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      
      // Vertragsname
      doc.setFontSize(10);
      doc.text(`${vertrag.name || 'Ohne Name'}`, 105, 64, { align: 'center' });

      let y = 80;

      // Agenturdaten (zentriert)
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Agenturdaten', 105, y, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      doc.text('LikeGroup GmbH', 105, y, { align: 'center' });
      y += 5;
      doc.text('Jakob-Latscha-Str. 3', 105, y, { align: 'center' });
      y += 5;
      doc.text('60314 Frankfurt am Main', 105, y, { align: 'center' });
      y += 5;
      doc.text('Deutschland', 105, y, { align: 'center' });

      // Kundendaten (zentriert, untereinander formatiert)
      y += 15;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Kundendaten', 105, y, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      doc.text(`Firmenname: ${kunde?.firmenname || '-'}`, 105, y, { align: 'center' });
      y += 5;
      doc.text(`${kunde?.rechnungsadresse_strasse || ''} ${kunde?.rechnungsadresse_hausnummer || ''}`, 105, y, { align: 'center' });
      y += 5;
      doc.text(`${kunde?.rechnungsadresse_plz || ''} ${kunde?.rechnungsadresse_stadt || ''}`, 105, y, { align: 'center' });

      // Influencer-Vertretung
      y += 15;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Influencer / Vertretung', 105, y, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      doc.text('Wird der Influencer durch eine Agentur vertreten?', 105, y, { align: 'center' });
      y += 6;
      drawCheckbox(85, y, !vertrag.influencer_agentur_vertreten, 'Nein');
      drawCheckbox(105, y, vertrag.influencer_agentur_vertreten, 'Ja');
      
      if (vertrag.influencer_agentur_vertreten) {
        y += 8;
        doc.text(`Agenturname: ${vertrag.influencer_agentur_name || '-'}`, 105, y, { align: 'center' });
        y += 5;
        const strasseZeile = `${vertrag.influencer_agentur_strasse || ''} ${vertrag.influencer_agentur_hausnummer || ''}`.trim();
        const plzStadtZeile = `${vertrag.influencer_agentur_plz || ''} ${vertrag.influencer_agentur_stadt || ''}`.trim();
        doc.text(strasseZeile || '-', 105, y, { align: 'center' });
        y += 5;
        doc.text(plzStadtZeile || '-', 105, y, { align: 'center' });
        y += 5;
        doc.text(vertrag.influencer_agentur_land || 'Deutschland', 105, y, { align: 'center' });
        y += 5;
        doc.text(`Vertreten durch: ${vertrag.influencer_agentur_vertretung || '-'}`, 105, y, { align: 'center' });
      }

      // Influencer-Daten (zentriert, untereinander formatiert)
      y += 15;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Influencer-Daten', 105, y, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      doc.text(`Name: ${creator?.vorname || ''} ${creator?.nachname || ''}`, 105, y, { align: 'center' });
      y += 5;
      y = this.appendPdfCreatorContractAddress(doc, y, creatorContractAddress, vertrag.influencer_land || 'Deutschland');
      y += 5;
      const profiles = vertrag.influencer_profile || [];
      doc.text(`Profil(e): ${profiles.length > 0 ? profiles.join(', ') : '-'}`, 105, y, { align: 'center' });

      // PO / Auftragsnummer (zentriert)
      y += 15;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('PO / Auftragsnummer', 105, y, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      y += 8;
      doc.text(`${vertrag.kunde_po_nummer || '_______________________________'}`, 105, y, { align: 'center' });
      doc.setFontSize(9);
      y += 7;
      doc.text('Zwingend auf der Rechnung anzugeben. Ohne Angabe ist keine Zahlung möglich.', 105, y, { align: 'center' });
      doc.setFontSize(10);

      // Fußzeile für Seite 1
      addFooter();

      // ============================================
      // SEITE 2: Vertragsinhalte
      // ============================================
      doc.addPage();
      y = 20;

      // §1 Vertragsgegenstand
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§1 Vertragsgegenstand', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      y = addWrappedText('Der Influencer verpflichtet sich zur Erstellung und Veröffentlichung werblicher Inhalte zugunsten des Auftraggebers bzw. eines von der LikeGroup GmbH betreuten Kunden.', 14, y, 180);

      // §2 Plattformen & Inhalte
      y += 10;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§2 Plattformen & Inhalte', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.text('2.1 Plattformen', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      const plattformen = vertrag.plattformen || [];
      drawCheckbox(14, y, plattformen.includes('instagram'), 'Instagram');
      drawCheckbox(50, y, plattformen.includes('tiktok'), 'TikTok');
      drawCheckbox(86, y, plattformen.includes('youtube'), 'YouTube');
      const sonstigeLabel = plattformen.includes('sonstige') && vertrag.plattformen_sonstige
        ? `Sonstige: ${vertrag.plattformen_sonstige}`
        : 'Sonstige';
      drawCheckbox(122, y, plattformen.includes('sonstige'), sonstigeLabel);

      y += 10;
      doc.setFont('helvetica', 'bold');
      doc.text('2.2 Inhalte', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      doc.text(`Videos / Reels: ${vertrag.anzahl_reels || 0}`, 14, y);
      y += 5;
      doc.text(`Feed-Posts: ${vertrag.anzahl_feed_posts || 0}`, 14, y);
      y += 5;
      doc.text(`Story-Slides: ${vertrag.anzahl_storys || 0}`, 14, y);
      y = renderZusatzBestimmung(doc, zusaetze.p2, { y, maxContentY: MAX_CONTENT_Y, onPageBreak });

      // §3 Konzept, Freigabe & Veröffentlichungsplan
      y += 12;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§3 Konzept, Freigabe & Veröffentlichungsplan', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      y = addWrappedText('Der Content ist der LikeGroup GmbH vor Veröffentlichung zur Freigabe vorzulegen. Produktion und Veröffentlichung dürfen erst nach Freigabe erfolgen.', 14, y, 180);
      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.text('3.1 Korrekturschleifen', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      drawCheckbox(14, y, vertrag.korrekturschleifen === 1, '1');
      drawCheckbox(30, y, vertrag.korrekturschleifen === 2, '2');

      y += 10;
      doc.setFont('helvetica', 'bold');
      doc.text('3.2 Veröffentlichungsplan', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      const veroeffentlichungsplan = vertrag.veroeffentlichungsplan || {};
      const videoDates = veroeffentlichungsplan.videos || [];
      const feedPostDates = veroeffentlichungsplan.feed_posts || [];
      const storyDates = veroeffentlichungsplan.storys || [];
      
      if (videoDates.length > 0) {
        doc.text('Videos / Reels:', 14, y);
        y += 5;
        videoDates.forEach((date, idx) => {
          doc.text(`Video ${idx + 1} – Veröffentlichung am: ${formatDate(date)}`, 20, y);
          y += 4;
        });
      }
      if (feedPostDates.length > 0) {
        y += 3;
        doc.text('Feed-Posts:', 14, y);
        y += 5;
        feedPostDates.forEach((date, idx) => {
          doc.text(`Feed-Post ${idx + 1} – Veröffentlichung am: ${formatDate(date)}`, 20, y);
          y += 4;
        });
      }
      if (storyDates.length > 0) {
        y += 3;
        doc.text('Storys:', 14, y);
        y += 5;
        storyDates.forEach((date, idx) => {
          doc.text(`Story ${idx + 1} – ${formatDate(date)}`, 20, y);
          y += 4;
        });
      }
      y = renderZusatzBestimmung(doc, zusaetze.p3, { y, maxContentY: MAX_CONTENT_Y, onPageBreak });

      // Helper: Seitenumbruch prüfen - wenn nicht genug Platz, neue Seite
      const checkPageBreak = (neededSpace) => {
        if (y + neededSpace > MAX_CONTENT_Y) {
          addFooter();
          doc.addPage();
          y = 20;
        }
      };

      // §4 Werbekennzeichnung
      checkPageBreak(30);
      y += 10;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§4 Werbekennzeichnung', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      y = addWrappedText('Der Influencer verpflichtet sich zur vollständigen, gesetzeskonformen Kennzeichnung der Inhalte (z.B. „Werbung", „Anzeige", „Paid Partnership").', 14, y, 180);

      // §5 Nutzungsrechte & Media Buyout
      checkPageBreak(80);
      y += 10;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§5 Nutzungsrechte & Media Buyout', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.text('5.1 Organische Veröffentlichung', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      doc.text(organischeVeroeffentlichungLabels[vertrag.organische_veroeffentlichung] || '-', 14, y);

      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.text('5.2 Zusätzliche Nutzung für Werbung (Media Buyout)', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      doc.text(mediaBuyoutLabels[vertrag.media_buyout] || '-', 14, y);

      y += 8;
      doc.text(`Nutzungsdauer: ${getNutzungsdauerText(vertrag)}`, 14, y);
      y += 5;
      const medienLabels = { 'social_media': 'Social Media', 'website': 'Website', 'otv': 'OTV' };
      const medienText = (vertrag.medien || []).map(m => medienLabels[m] || m).join(', ') || '-';
      doc.text(`Medien: ${medienText}`, 14, y);

      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.text('5.3 Exklusivität', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      const exklusivitaetEinheitLabels = { 'monate': 'Monate', 'wochen': 'Wochen', 'tage': 'Tage' };
      const exklusivitaetEinheit = exklusivitaetEinheitLabels[vertrag.exklusivitaet_einheit || this.formData.exklusivitaet_einheit] || 'Monate';
      const exklusivitaetMonate = vertrag.exklusivitaet_monate || parseInt(this.formData.exklusivitaet_monate) || '-';
      drawCheckbox(14, y, !vertrag.exklusivitaet, 'Keine Exklusivität');
      y += 5;
      drawCheckbox(14, y, vertrag.exklusivitaet, `Exklusivität für ${exklusivitaetMonate} ${exklusivitaetEinheit}`);
      y = renderZusatzBestimmung(doc, zusaetze.p5, { y, maxContentY: MAX_CONTENT_Y, onPageBreak });

      // §6 Vergütung
      checkPageBreak(55);
      y += 12;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§6 Vergütung', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      doc.text(`Fixvergütung: ${formatMoney(vertrag.verguetung_netto)} € netto zzgl. USt.`, 14, y);
      y += 6;
      drawCheckbox(14, y, vertrag.zusatzkosten, `Zusatzkosten vereinbart: ${vertrag.zusatzkosten_betrag !== null && vertrag.zusatzkosten_betrag !== undefined ? formatMoney(vertrag.zusatzkosten_betrag, '-') : '-'} € netto`);
      y += 5;
      drawCheckbox(14, y, !vertrag.zusatzkosten, 'Keine Zusatzkosten');
      y += 8;
      doc.text(`Zahlungsziel: ${zahlungszielLabels[vertrag.zahlungsziel] || '-'}`, 14, y);
      y += 5;
      const skontoValue = vertrag.skonto === true || vertrag.skonto === 'true';
      doc.text('Skonto:', 14, y);
      y += 5;
      drawCheckbox(14, y, skontoValue, 'Ja (3% bei Zahlung innerhalb 7 Tage)');
      y += 5;
      drawCheckbox(14, y, !skontoValue, 'Nein');
      y = renderZusatzBestimmung(doc, zusaetze.p6, { y, maxContentY: MAX_CONTENT_Y, onPageBreak });

      // §7 Qualitätsanforderungen
      checkPageBreak(35);
      y += 12;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§7 Qualitätsanforderungen', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      y = addWrappedText('Der Content muss insbesondere: technisch sauber (Ton, Licht, Bild), natürlich und nicht übermäßig werblich, markenkonform, visuell hochwertig, kreativ, lebendig und mit ästhetisch geeignetem Hintergrund umgesetzt sein.', 14, y, 180);
      y = renderZusatzBestimmung(doc, zusaetze.p7, { y, maxContentY: MAX_CONTENT_Y, onPageBreak });

      // §8 Anpassungen
      checkPageBreak(55);
      y += 10;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§8 Anpassungen', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      doc.text('Kostenfreie Anpassungen umfassen u.a.:', 14, y);
      y += 6;
      const anpassungen = vertrag.anpassungen || [];
      Object.entries(anpassungenLabels).forEach(([key, label]) => {
        if (y + 5 > MAX_CONTENT_Y) {
          addFooter();
          doc.addPage();
          y = 20;
        }
        drawCheckbox(14, y, anpassungen.includes(key), label);
        y += 5;
      });
      y = renderZusatzBestimmung(doc, zusaetze.p8, { y, maxContentY: MAX_CONTENT_Y, onPageBreak });

      // §9 Neuerstellung (Neudreh)
      checkPageBreak(30);
      y += 8;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§9 Neuerstellung (Neudreh)', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      y = addWrappedText('Weicht der Content erheblich vom Briefing oder den Qualitätsanforderungen ab und ist nicht anpassbar, ist er vor Veröffentlichung kostenfrei neu zu erstellen.', 14, y, 180);

      // §10 Reichweiten-Garantie
      checkPageBreak(25);
      y += 10;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§10 Reichweiten-Garantie', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 6;
      drawCheckbox(14, y, !vertrag.reichweiten_garantie, 'Keine Garantie');
      y += 5;
      drawCheckbox(14, y, vertrag.reichweiten_garantie, `Mindestreichweite: ${vertrag.reichweiten_garantie_wert || '-'}`);
      y = renderZusatzBestimmung(doc, zusaetze.p10, { y, maxContentY: MAX_CONTENT_Y, onPageBreak });

      // §11 Mindest-Online-Dauer
      checkPageBreak(40);
      y += 10;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§11 Mindest-Online-Dauer', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 6;
      Object.entries(mindestOnlineDauerLabels).forEach(([key, label]) => {
        if (y + 5 > MAX_CONTENT_Y) {
          addFooter();
          doc.addPage();
          y = 20;
        }
        drawCheckbox(14, y, vertrag.mindest_online_dauer === key, label);
        y += 5;
      });
      y = renderZusatzBestimmung(doc, zusaetze.p11, { y, maxContentY: MAX_CONTENT_Y, onPageBreak });

      // §12 Rechte Dritter
      checkPageBreak(25);
      y += 8;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§12 Rechte Dritter', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      y = addWrappedText('Der Influencer garantiert, dass der Content frei von Rechten Dritter ist und haftet für Rechtsverletzungen.', 14, y, 180);

      // §13 Künstlersozialkasse
      checkPageBreak(25);
      y += 10;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§13 Künstlersozialkasse', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      // KSK-Selbstzahler: Creator fuehrt die Abgabe selbst ab und erhaelt den Ausgleich on top
      const kskParagraphText = vertrag.ksk_selbstzahler
        ? KSK_SELBSTZAHLER_VERTRAGSTEXT_DE
        : 'Die KSK-Abgabe wird – sofern relevant – vom Auftraggeber abgeführt und nicht gesondert auf der Rechnung des Influencers ausgewiesen.';
      y = addWrappedText(kskParagraphText, 14, y, 180);

      // §14 Rücktritt
      checkPageBreak(25);
      y += 10;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§14 Rücktritt', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      y = addWrappedText('Bei Nichterfüllung, wiederholter Qualitätsabweichung oder Nichtveröffentlichung ist ein Rücktritt zulässig. Ein Vergütungsanspruch besteht dann nicht.', 14, y, 180);

      // §15 Vertragsschluss
      checkPageBreak(25);
      y += 10;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§15 Vertragsschluss', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      y = addWrappedText('Der Vertrag wird mit Unterschrift des Influencers oder seines Vertretungsberechtigten wirksam. Eine Gegenzeichnung der LikeGroup GmbH ist nicht erforderlich.', 14, y, 180);

      // §16 Weitere Bestimmungen (nur wenn ausgefüllt)
      if (vertrag.weitere_bestimmungen) {
        checkPageBreak(30);
        y += 10;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('§16 Weitere Bestimmungen', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 8;
        y = addWrappedText(vertrag.weitere_bestimmungen, 14, y, 180);
      }

      // Unterschriften
      checkPageBreak(45);
      y += 20;
      doc.text('Ort, Datum: ___________________________', 14, y);
      y += 15;
      doc.text('Influencer / Vertreter: ___________________________', 14, y);

      // Fußzeile für letzte Seite
      addFooter();

      // PDF speichern
      const pdfBlob = doc.output('blob');
      const filePrefix = lang === 'en' ? 'EN_Contract_Influencer' : 'Vertrag_Influencer';
      const fileName = `${filePrefix}_${vertrag.name || 'Kooperation'}_${new Date().toISOString().split('T')[0]}.pdf`;

      const uploadResult = await uploadGeneratedVertragPdf(this, vertrag, pdfBlob, fileName);
      console.log('✅ Influencer-PDF nach Dropbox hochgeladen und URL gespeichert');
      doc.save(fileName);
      return uploadResult;

    } catch (error) {
      console.error('❌ Fehler bei Influencer-PDF-Generierung:', error);
      window.toastSystem?.show('PDF konnte nicht generiert werden', 'warning');
      throw error;
    }
};

  // ============================================
  // VIDEOGRAFEN-PRODUKTIONSVERTRAG PDF
