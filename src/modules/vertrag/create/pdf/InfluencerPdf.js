// pdf/InfluencerPdf.js
// Influencer-Kooperationsvertrag: PDF-Generierung.

import { VertraegeCreate } from '../VertraegeCreateCore.js';
import { uploadGeneratedVertragPdf } from './VertragPdfUpload.js';
import { createPdfLayout, ensureSpace } from './PdfTextFlow.js';
import { KSK_SELBSTZAHLER_VERTRAGSTEXT_DE } from '../../../../core/budget/kskSelbstzahler.js';
import { loadLikeGroupLogoPng, drawLikeGroupLogo, likeGroupFooterLine } from '../../../../core/pdf/PdfBrand.js';
import { isKorrekturschleife } from '../pflichtAuswahlen.js';

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

      // Layout-Schicht: vermisst Abschnitte vor dem Zeichnen und bricht bei Bedarf um
      // (nach localizeDocText erzeugen, wrappt doc.text zusätzlich)
      const layout = createPdfLayout(doc, { maxContentY: MAX_CONTENT_Y, onPageBreak, footerY: FOOTER_Y });

      // Helper: Checkbox zeichnen (Label bricht bei Bedarf um, liefert Baseline der letzten Zeile)
      const drawCheckbox = (x, yPos, checked, label, opts) => layout.checkbox(x, yPos, checked, label, opts);

      // Helper: Ja/Nein Checkboxen
      const drawYesNoCheckboxes = (x, yPos, value) => {
        drawCheckbox(x, yPos, value === true, 'Ja');
        drawCheckbox(x + 20, yPos, value === false || value === undefined || value === null, 'Nein');
      };

      // Helper: Text mit Umbruch (zeilenweise paginiert, läuft nie in die Fußzeile)
      const addWrappedText = (text, x, yStart, maxWidth) => {
        const localizedText = this.localizeContractText(text, lang);
        return layout.paginated(localizedText, { x, y: yStart, maxWidth });
      };

      // Zentrierte Zeile mit DB-Inhalt (bricht um, liefert Baseline der letzten Zeile)
      const centered = (text, yPos) => layout.line(text, 105, yPos, { align: 'center' });

      // Einzelne Zeile mit Platzprüfung (für Listen variabler Länge, z.B. Veröffentlichungsplan)
      const listLine = (text, x, yPos, step) => {
        const lineY = ensureSpace(yPos, step, layout.flow.maxContentY, layout.flow.onPageBreak);
        doc.text(text, x, lineY);
        return lineY + step;
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

      // Vertragsname (kann lang sein: umbrechen, Folgeblöcke rücken nach)
      doc.setFontSize(10);
      const nameEndY = centered(`${vertrag.name || 'Ohne Name'}`, 64);

      let y = Math.max(80, nameEndY + 16);

      // Agenturdaten (zentriert)
      y = layout.section(y, (y) => {
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
        return y;
      });

      // Kundendaten (zentriert, untereinander formatiert)
      y = layout.section(y, (y) => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Kundendaten', 105, y, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 8;
        y = centered(`Firmenname: ${kunde?.firmenname || '-'}`, y);
        y += 5;
        y = centered(`${kunde?.rechnungsadresse_strasse || ''} ${kunde?.rechnungsadresse_hausnummer || ''}`, y);
        y += 5;
        y = centered(`${kunde?.rechnungsadresse_plz || ''} ${kunde?.rechnungsadresse_stadt || ''}`, y);
        return y;
      }, { gap: 15 });

      // Influencer-Vertretung
      y = layout.section(y, (y) => {
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
          y = centered(`Agenturname: ${vertrag.influencer_agentur_name || '-'}`, y);
          y += 5;
          const strasseZeile = `${vertrag.influencer_agentur_strasse || ''} ${vertrag.influencer_agentur_hausnummer || ''}`.trim();
          const plzStadtZeile = `${vertrag.influencer_agentur_plz || ''} ${vertrag.influencer_agentur_stadt || ''}`.trim();
          y = centered(strasseZeile || '-', y);
          y += 5;
          y = centered(plzStadtZeile || '-', y);
          y += 5;
          y = centered(vertrag.influencer_agentur_land || 'Deutschland', y);
          y += 5;
          y = centered(`Vertreten durch: ${vertrag.influencer_agentur_vertretung || '-'}`, y);
        }
        return y;
      }, { gap: 15 });

      // Influencer-Daten (zentriert, untereinander formatiert)
      y = layout.section(y, (y) => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Influencer-Daten', 105, y, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 8;
        y = centered(`Name: ${creator?.vorname || ''} ${creator?.nachname || ''}`, y);
        y += 5;
        y = this.appendPdfCreatorContractAddress(doc, y, creatorContractAddress, vertrag.influencer_land || 'Deutschland');
        y += 5;
        const profiles = vertrag.influencer_profile || [];
        return centered(`Profil(e): ${profiles.length > 0 ? profiles.join(', ') : '-'}`, y);
      }, { gap: 15 });

      // PO / Auftragsnummer (zentriert)
      y = layout.section(y, (y) => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('PO / Auftragsnummer', 105, y, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        y += 8;
        y = centered(`${vertrag.kunde_po_nummer || '_______________________________'}`, y);
        doc.setFontSize(9);
        y += 7;
        doc.text('Zwingend auf der Rechnung anzugeben. Ohne Angabe ist keine Zahlung möglich.', 105, y, { align: 'center' });
        doc.setFontSize(10);
        return y;
      }, { gap: 15 });

      // Fußzeile für Seite 1
      addFooter();

      // ============================================
      // SEITE 2: Vertragsinhalte
      // ============================================
      // Jeder Abschnitt läuft über layout.section: vermessen, bei Bedarf Umbruch.
      // Zusatzbestimmungen (paragraph_zusaetze) paginieren zeilenweise und stehen
      // bewusst außerhalb der Abschnitte (dürfen über Seiten laufen).
      doc.addPage();
      y = 20;

      // §1 Vertragsgegenstand
      y = layout.section(y, (y) => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('§1 Vertragsgegenstand', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 8;
        return addWrappedText('Der Influencer verpflichtet sich zur Erstellung und Veröffentlichung werblicher Inhalte zugunsten des Auftraggebers bzw. eines von der LikeGroup GmbH betreuten Kunden.', 14, y, 180);
      });

      // §2 Plattformen & Inhalte
      y = layout.section(y, (y) => {
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
        y = drawCheckbox(122, y, plattformen.includes('sonstige'), sonstigeLabel);

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
        return y;
      });
      y = layout.zusatz(zusaetze.p2, y);

      // §3 Konzept, Freigabe & Veröffentlichungsplan (3.1)
      y = layout.section(y, (y) => {
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
        drawCheckbox(14, y, isKorrekturschleife(vertrag.korrekturschleifen, 1), '1');
        drawCheckbox(30, y, isKorrekturschleifen(vertrag.korrekturschleifen, 2), '2');
        return y;
      }, { gap: 12 });

      // 3.2 Veröffentlichungsplan (Länge hängt an der Anzahl der Termine: darf über Seiten laufen)
      y = layout.section(y, (y) => {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('3.2 Veröffentlichungsplan', 14, y);
        doc.setFont('helvetica', 'normal');
        y += 6;
        const veroeffentlichungsplan = vertrag.veroeffentlichungsplan || {};
        const videoDates = veroeffentlichungsplan.videos || [];
        const feedPostDates = veroeffentlichungsplan.feed_posts || [];
        const storyDates = veroeffentlichungsplan.storys || [];

        if (videoDates.length > 0) {
          y = listLine('Videos / Reels:', 14, y, 5);
          videoDates.forEach((date, idx) => {
            y = listLine(`Video ${idx + 1} – Veröffentlichung am: ${formatDate(date)}`, 20, y, 4);
          });
        }
        if (feedPostDates.length > 0) {
          y += 3;
          y = listLine('Feed-Posts:', 14, y, 5);
          feedPostDates.forEach((date, idx) => {
            y = listLine(`Feed-Post ${idx + 1} – Veröffentlichung am: ${formatDate(date)}`, 20, y, 4);
          });
        }
        if (storyDates.length > 0) {
          y += 3;
          y = listLine('Storys:', 14, y, 5);
          storyDates.forEach((date, idx) => {
            y = listLine(`Story ${idx + 1} – ${formatDate(date)}`, 20, y, 4);
          });
        }
        return y;
      }, { gap: 10, head: 25, splittable: true });
      y = layout.zusatz(zusaetze.p3, y);

      // §4 Werbekennzeichnung
      y = layout.section(y, (y) => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('§4 Werbekennzeichnung', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 8;
        return addWrappedText('Der Influencer verpflichtet sich zur vollständigen, gesetzeskonformen Kennzeichnung der Inhalte (z.B. „Werbung", „Anzeige", „Paid Partnership").', 14, y, 180);
      }, { gap: 10 });

      // §5 Nutzungsrechte & Media Buyout (5.1)
      y = layout.section(y, (y) => {
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
        return y;
      }, { gap: 10 });

      // 5.2 Media Buyout
      y = layout.section(y, (y) => {
        doc.setFontSize(10);
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
        return layout.line(`Medien: ${medienText}`, 14, y);
      }, { gap: 8 });

      // 5.3 Exklusivität
      y = layout.section(y, (y) => {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('5.3 Exklusivität', 14, y);
        doc.setFont('helvetica', 'normal');
        y += 6;
        const exklusivitaetEinheitLabels = { 'monate': 'Monate', 'wochen': 'Wochen', 'tage': 'Tage' };
        const exklusivitaetEinheit = exklusivitaetEinheitLabels[vertrag.exklusivitaet_einheit || this.formData.exklusivitaet_einheit] || 'Monate';
        const exklusivitaetMonate = vertrag.exklusivitaet_monate || parseInt(this.formData.exklusivitaet_monate) || '-';
        drawCheckbox(14, y, !vertrag.exklusivitaet, 'Keine Exklusivität');
        y += 5;
        return drawCheckbox(14, y, vertrag.exklusivitaet, `Exklusivität für ${exklusivitaetMonate} ${exklusivitaetEinheit}`);
      }, { gap: 8 });
      y = layout.zusatz(zusaetze.p5, y);

      // §6 Vergütung (Fixvergütung + Zusatzkosten)
      y = layout.section(y, (y) => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('§6 Vergütung', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 8;
        doc.text(`Fixvergütung: ${formatMoney(vertrag.verguetung_netto)} € netto zzgl. USt.`, 14, y);
        y += 6;
        y = drawCheckbox(14, y, vertrag.zusatzkosten, `Zusatzkosten vereinbart: ${vertrag.zusatzkosten_betrag !== null && vertrag.zusatzkosten_betrag !== undefined ? formatMoney(vertrag.zusatzkosten_betrag, '-') : '-'} € netto`);
        y += 5;
        drawCheckbox(14, y, !vertrag.zusatzkosten, 'Keine Zusatzkosten');
        return y;
      }, { gap: 12 });

      // Zahlungsbedingungen
      y = layout.section(y, (y) => {
        doc.setFontSize(10);
        doc.text(`Zahlungsziel: ${zahlungszielLabels[vertrag.zahlungsziel] || '-'}`, 14, y);
        y += 5;
        const skontoValue = vertrag.skonto === true || vertrag.skonto === 'true';
        doc.text('Skonto:', 14, y);
        y += 5;
        drawCheckbox(14, y, skontoValue, 'Ja (3% bei Zahlung innerhalb 7 Tage)');
        y += 5;
        drawCheckbox(14, y, !skontoValue, 'Nein');
        return y;
      }, { gap: 8 });
      y = layout.zusatz(zusaetze.p6, y);

      // §7 Qualitätsanforderungen
      y = layout.section(y, (y) => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('§7 Qualitätsanforderungen', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 8;
        return addWrappedText('Der Content muss insbesondere: technisch sauber (Ton, Licht, Bild), natürlich und nicht übermäßig werblich, markenkonform, visuell hochwertig, kreativ, lebendig und mit ästhetisch geeignetem Hintergrund umgesetzt sein.', 14, y, 180);
      }, { gap: 12 });
      y = layout.zusatz(zusaetze.p7, y);

      // §8 Anpassungen
      y = layout.section(y, (y) => {
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
          drawCheckbox(14, y, anpassungen.includes(key), label);
          y += 5;
        });
        return y;
      }, { gap: 10 });
      y = layout.zusatz(zusaetze.p8, y);

      // §9 Neuerstellung (Neudreh)
      y = layout.section(y, (y) => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('§9 Neuerstellung (Neudreh)', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 8;
        return addWrappedText('Weicht der Content erheblich vom Briefing oder den Qualitätsanforderungen ab und ist nicht anpassbar, ist er vor Veröffentlichung kostenfrei neu zu erstellen.', 14, y, 180);
      }, { gap: 8 });

      // §10 Reichweiten-Garantie
      y = layout.section(y, (y) => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('§10 Reichweiten-Garantie', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 6;
        drawCheckbox(14, y, !vertrag.reichweiten_garantie, 'Keine Garantie');
        y += 5;
        return drawCheckbox(14, y, vertrag.reichweiten_garantie, `Mindestreichweite: ${vertrag.reichweiten_garantie_wert || '-'}`);
      }, { gap: 10 });
      y = layout.zusatz(zusaetze.p10, y);

      // §11 Mindest-Online-Dauer
      y = layout.section(y, (y) => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('§11 Mindest-Online-Dauer', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 6;
        Object.entries(mindestOnlineDauerLabels).forEach(([key, label]) => {
          drawCheckbox(14, y, vertrag.mindest_online_dauer === key, label);
          y += 5;
        });
        return y;
      }, { gap: 10 });
      y = layout.zusatz(zusaetze.p11, y);

      // §12 Rechte Dritter
      y = layout.section(y, (y) => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('§12 Rechte Dritter', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 8;
        return addWrappedText('Der Influencer garantiert, dass der Content frei von Rechten Dritter ist und haftet für Rechtsverletzungen.', 14, y, 180);
      }, { gap: 8 });

      // §13 Künstlersozialkasse
      y = layout.section(y, (y) => {
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
        return addWrappedText(kskParagraphText, 14, y, 180);
      }, { gap: 10 });

      // §14 Rücktritt
      y = layout.section(y, (y) => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('§14 Rücktritt', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 8;
        return addWrappedText('Bei Nichterfüllung, wiederholter Qualitätsabweichung oder Nichtveröffentlichung ist ein Rücktritt zulässig. Ein Vergütungsanspruch besteht dann nicht.', 14, y, 180);
      }, { gap: 10 });

      // §15 Vertragsschluss
      y = layout.section(y, (y) => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('§15 Vertragsschluss', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 8;
        return addWrappedText('Der Vertrag wird mit Unterschrift des Influencers oder seines Vertretungsberechtigten wirksam. Eine Gegenzeichnung der LikeGroup GmbH ist nicht erforderlich.', 14, y, 180);
      }, { gap: 10 });

      // §16 Weitere Bestimmungen (nur wenn ausgefüllt, darf über Seiten laufen)
      if (vertrag.weitere_bestimmungen) {
        y = layout.section(y, (y) => {
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text('§16 Weitere Bestimmungen', 14, y);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          y += 8;
          return addWrappedText(vertrag.weitere_bestimmungen, 14, y, 180);
        }, { gap: 10, head: 20, splittable: true });
      }

      // Unterschriften
      y = layout.section(y, (y) => {
        doc.setFontSize(10);
        doc.text('Ort, Datum: ___________________________', 14, y);
        y += 15;
        doc.text('Influencer / Vertreter: ___________________________', 14, y);
        return y;
      }, { gap: 20 });

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
