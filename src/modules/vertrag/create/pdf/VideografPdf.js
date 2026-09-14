// pdf/VideografPdf.js
// Videografen-/Fotografen-Produktionsvertrag: PDF-Generierung.

import { VertraegeCreate } from '../VertraegeCreateCore.js';
import { uploadGeneratedVertragPdf } from './VertragPdfUpload.js';
import { ensureSpace, renderPaginatedText, renderZusatzBestimmung } from './PdfTextFlow.js';
import { loadLikeGroupLogoPng, likeGroupFooterLine } from '../../../../core/pdf/PdfBrand.js';

VertraegeCreate.prototype.generateVideografPDF = async function(vertrag, lang = this.getContractLanguage(vertrag)) {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      this.localizeDocText(doc, lang);

      // Font auf Helvetica setzen
      doc.setFont('helvetica');

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

      // Helper: Produktionsart lesbar machen
      const produktionsartLabels = {
        'briefing': 'Produktion nach Briefing',
        'skript_shotlist': 'Produktion nach Skript / Shotlist',
        'eigenstaendig': 'Eigenständige Umsetzung nach Zielvorgabe'
      };

      // Helper: Lieferumfang lesbar machen
      const lieferumfangLabels = {
        'fertig_geschnitten': 'Fertig geschnittenes Video',
        'farbkorrektur': 'Farbkorrektur / Grading enthalten',
        'sounddesign': 'Sounddesign enthalten',
        'rohmaterial': 'Rohmaterial (alle Clips)',
        'projektdateien': 'Projektdateien (z.B. Premiere / Final Cut)'
      };

      // Helper: Nutzungsart lesbar machen
      const nutzungsartLabels = {
        'organisch': 'Organische Nutzung',
        'paid_ads': 'Paid Ads',
        'alle_medien': 'Alle Medien (Social Media, Website, OTV, Print)'
      };

      // Helper: Zahlungsziel lesbar machen
      const zahlungszielLabels = {
        '14_tage': '14 Tage',
        '30_tage': '30 Tage',
        '45_tage': '45 Tage'
      };

      // Helper: Geldbeträge lokalisiert formatieren
      const formatMoney = (v, emptyValue = '0,00') => this.formatContractMoney(v, lang, { emptyValue });

      // Helper: Checkbox zeichnen (echte Rechtecke mit X)
      const drawCheckbox = (x, yPos, checked, label) => {
        // Checkbox-Rechteck zeichnen (3x3mm)
        doc.rect(x, yPos - 2.5, 3, 3);
        if (checked) {
          // X in die Box zeichnen
          doc.line(x + 0.5, yPos - 2, x + 2.5, yPos);
          doc.line(x + 0.5, yPos, x + 2.5, yPos - 2);
        }
        // Label daneben
        doc.text(label, x + 5, yPos);
      };

      // Helper für Textumbruch (zeilenweise paginiert)
      const addWrappedText = (text, x, y, maxWidth) => {
        const localizedText = this.localizeContractText(text, lang);
        return renderPaginatedText(doc, localizedText, { x, y, maxWidth, maxContentY: MAX_CONTENT_Y, onPageBreak });
      };

      // Seitenzahlen Helper
      const addPageNumber = () => {
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.text(`Seite ${i} von ${pageCount}`, 105, 290, { align: 'center' });
          doc.setTextColor(0);
        }
      };

      // Logo oben zentriert
      doc.addImage(logoBase64, 'PNG', 93.6, 10, 22.75, 12.6);

      // Titel (Logo endet bei y=28, daher Titel ab y=36)
      let y = 36;

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('VIDEOGRAFEN- & FOTOGRAFEN-PRODUKTIONSVERTRAG', 105, y, { align: 'center' });
      doc.setFont('helvetica', 'normal');

      // Agenturdaten
      y += 12;
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

      // Kundendaten (untereinander formatiert)
      y += 12;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Kundendaten', 105, y, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      doc.text(`Firmenname: ${kunde?.firmenname || '-'}`, 105, y, { align: 'center' });
      y += 5;
      doc.text(`Rechtsform: ${vertrag.kunde_rechtsform || '-'}`, 105, y, { align: 'center' });
      y += 5;
      doc.text(`${kunde?.rechnungsadresse_strasse || ''} ${kunde?.rechnungsadresse_hausnummer || ''}`, 105, y, { align: 'center' });
      y += 5;
      doc.text(`${kunde?.rechnungsadresse_plz || ''} ${kunde?.rechnungsadresse_stadt || ''}`, 105, y, { align: 'center' });

      // Auftragnehmer (untereinander formatiert)
      y += 12;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Auftragnehmer (Videograf / Fotograf)', 105, y, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      const creatorContractAddress = this.getResolvedCreatorContractAddress(creator, vertrag);
      doc.text(`Name / Firma: ${creator?.vorname || ''} ${creator?.nachname || ''}`, 105, y, { align: 'center' });
      y += 5;
      y = this.appendPdfCreatorContractAddress(doc, y, creatorContractAddress, vertrag.influencer_land || 'Deutschland');
      y += 5;
      doc.text(`Steuer-ID / USt-ID: ${vertrag.influencer_steuer_id || '-'}`, 105, y, { align: 'center' });

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
      // SEITE 2: Vertragsinhalte (linksbündig)
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
      y = addWrappedText('Der Auftragnehmer verpflichtet sich zur professionellen Erstellung von Foto- und/oder Videomaterial zu Marketing- und Kommunikationszwecken des Auftraggebers bzw. eines von der LikeGroup GmbH betreuten Kunden. Es handelt sich um einen einmaligen Produktionsauftrag.', 14, y, 180);

      // §2 Leistungsumfang
      y += 10;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§2 Leistungsumfang', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;

      // 2.1 Art der Leistung
      doc.setFont('helvetica', 'bold');
      doc.text('2.1 Art der Leistung', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      // Alle Optionen als Checkboxen anzeigen
      const contentArtOptions = {
        'video': 'Video',
        'foto': 'Foto',
        'video_foto': 'Video & Foto'
      };
      Object.entries(contentArtOptions).forEach(([key, label]) => {
        drawCheckbox(14, y, vertrag.content_erstellung_art === key, label);
        y += 6;
      });
      y += 2;
      doc.text(`Anzahl Videos: ${vertrag.anzahl_videos || 0}`, 14, y);
      y += 5;
      doc.text(`Anzahl Fotos: ${vertrag.anzahl_fotos || 0}`, 14, y);

      // 2.2 Produktionsart
      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.text('2.2 Produktionsart', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      // Alle Optionen als Checkboxen anzeigen
      Object.entries(produktionsartLabels).forEach(([key, label]) => {
        drawCheckbox(14, y, vertrag.videograf_produktionsart === key, label);
        y += 6;
      });

      // 2.3 Drehtag & Produktionsort
      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.text('2.3 Drehtage & Produktionsorte', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      
      const produktionsplan = vertrag.videograf_produktionsplan || [];
      if (produktionsplan.length > 0) {
        produktionsplan.forEach((item, idx) => {
          const datumFormatted = item.datum
            ? this.formatContractDate(item.datum, lang, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
            : '-';
          doc.text(`• Drehtag ${idx + 1}: ${datumFormatted}`, 14, y);
          y += 5;
          doc.text(`  Ort: ${item.ort || '-'}`, 14, y);
          y += 5;
          if (y > MAX_CONTENT_Y) {
            addFooter();
            doc.addPage();
            y = 20;
          }
        });
      } else {
        doc.text('Keine Drehtage angegeben', 14, y);
        y += 5;
      }
      
      y += 2;
      y = addWrappedText('Der Auftragnehmer verpflichtet sich, zum vereinbarten Zeitpunkt vollständig einsatzbereit zu erscheinen und die Produktion fachgerecht durchzuführen.', 14, y, 180);
      y = renderZusatzBestimmung(doc, zusaetze.p2, { y, maxContentY: MAX_CONTENT_Y, onPageBreak });

      // §3 Output, Abgabe & Versionierung - Überschrift + 3.1-Block (~50mm) muss passen
      y = ensureSpace(y + 10, 50, MAX_CONTENT_Y, onPageBreak);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§3 Output, Abgabe & Versionierung', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;

      // 3.1 Lieferumfang
      doc.setFont('helvetica', 'bold');
      doc.text('3.1 Lieferumfang', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      const lieferumfang = vertrag.videograf_lieferumfang || [];
      // Alle Optionen als Checkboxen anzeigen (zeilenweise gegen Fußzeile abgesichert)
      Object.entries(lieferumfangLabels).forEach(([key, label]) => {
        if (y > MAX_CONTENT_Y) y = onPageBreak();
        drawCheckbox(14, y, lieferumfang.includes(key), label);
        y += 6;
      });

      // 3.2 Abgabe V1
      y = ensureSpace(y + 5, 18, MAX_CONTENT_Y, onPageBreak);
      doc.setFont('helvetica', 'bold');
      doc.text('3.2 Abgabe der ersten Version (V1)', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      const v1Deadline = this.formatContractDate(vertrag.videograf_v1_deadline, lang);
      y = addWrappedText(`Die erste inhaltliche Version (Preview / V1) ist spätestens bis: ${v1Deadline} digital zur Verfügung zu stellen.`, 14, y, 180);

      // 3.3 Korrekturschleifen
      y = ensureSpace(y + 5, 18, MAX_CONTENT_Y, onPageBreak);
      doc.setFont('helvetica', 'bold');
      doc.text('3.3 Korrekturschleifen', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      drawCheckbox(14, y, true, `${vertrag.korrekturschleifen || 1} Korrekturschleife(n)`);
      y += 6;
      y = addWrappedText('Eine Korrekturschleife umfasst jeweils eine überarbeitete Version nach Feedback.', 14, y, 180);

      // 3.4 Finale Version
      y = ensureSpace(y + 5, 18, MAX_CONTENT_Y, onPageBreak);
      doc.setFont('helvetica', 'bold');
      doc.text('3.4 Abgabe der finalen Version', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      y = addWrappedText(`Die finale Version ist spätestens ${vertrag.videograf_finale_werktage || 5} Werktage nach Abschluss der letzten Korrekturschleife bereitzustellen.`, 14, y, 180);
      y = renderZusatzBestimmung(doc, zusaetze.p3, { y, maxContentY: MAX_CONTENT_Y, onPageBreak });

      // §4 Qualitätsanforderungen - Block (~55mm) muss komplett passen
      y = ensureSpace(y + 10, 55, MAX_CONTENT_Y, onPageBreak);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§4 Qualitätsanforderungen', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      y = addWrappedText('Der Auftragnehmer verpflichtet sich zu professioneller handwerklicher Qualität. Insbesondere muss das Material:', 14, y, 180);
      y += 3;
      const qualitaetsanforderungen = [
        '• korrekt belichtet und scharf sein',
        '• eine saubere Bildkomposition aufweisen',
        '• ruhig und professionell geführt sein',
        '• bei Video über klar verständlichen, sauberen Ton verfügen',
        '• sauber farbkorrigiert bzw. bearbeitet sein',
        '• markenkonform gemäß Briefing umgesetzt sein'
      ];
      qualitaetsanforderungen.forEach(req => {
        if (y > MAX_CONTENT_Y) y = onPageBreak();
        doc.text(req, 14, y);
        y += 5;
      });
      y += 3;
      y = addWrappedText('Technisch oder inhaltlich nicht verwertbares Material gilt als nicht vertragsgemäß.', 14, y, 180);

      // §5 Nachbesserung & Neuerstellung - Überschrift + 5.1-Block (~35mm) muss passen
      y = ensureSpace(y + 10, 35, MAX_CONTENT_Y, onPageBreak);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§5 Nachbesserung & Neuerstellung', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      
      doc.setFont('helvetica', 'bold');
      doc.text('5.1 Nachbesserung (Korrekturen)', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      y = addWrappedText('Als Nachbesserungen gelten insbesondere: Schnittanpassungen, Farbkorrekturen, Tonanpassungen, Austausch einzelner Szenen, Bildauswahl bei Fotos, kleinere inhaltliche Anpassungen. Diese sind im Rahmen der vereinbarten Korrekturschleifen kostenfrei vorzunehmen.', 14, y, 180);

      y = ensureSpace(y + 8, 20, MAX_CONTENT_Y, onPageBreak);
      doc.setFont('helvetica', 'bold');
      doc.text('5.2 Neuerstellung (Neudreh)', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      y = addWrappedText('Ein Anspruch auf kostenfreie Neuerstellung (Neudreh) besteht insbesondere bei: erheblichen technischen Mängeln, unbrauchbarem Bild- oder Tonmaterial, grober Abweichung vom Briefing, Missachtung professioneller Standards. Sofern die Mängel nicht durch Nachbesserung behoben werden können, ist der Auftragnehmer verpflichtet, die Leistung neu zu erbringen. Wenn es sich hierbei um ein einmaliges Event gehandelt hat, entfällt die Vergütung.', 14, y, 180);

      // §7 Nutzungsrechte - Block (~50mm) muss komplett passen
      y = ensureSpace(y + 10, 50, MAX_CONTENT_Y, onPageBreak);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§7 Nutzungsrechte', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      y = addWrappedText('Der Auftragnehmer überträgt dem Auftraggeber ausschließliche, zeitlich und räumlich unbegrenzte Nutzungsrechte an sämtlichen erstellten Inhalten.', 14, y, 180);
      y += 3;
      const nutzungsart = vertrag.videograf_nutzungsart || [];
      // Alle Optionen als Checkboxen anzeigen (zeilenweise gegen Fußzeile abgesichert)
      Object.entries(nutzungsartLabels).forEach(([key, label]) => {
        if (y > MAX_CONTENT_Y) y = onPageBreak();
        drawCheckbox(14, y, nutzungsart.includes(key), label);
        y += 6;
      });
      y += 3;
      y = addWrappedText('Eine Urheberbenennung ist nicht erforderlich, sofern nicht ausdrücklich vereinbart.', 14, y, 180);
      y = renderZusatzBestimmung(doc, zusaetze.p7, { y, maxContentY: MAX_CONTENT_Y, onPageBreak });

      // §8 Rechte Dritter - Block (~25mm) muss komplett passen
      y = ensureSpace(y + 10, 25, MAX_CONTENT_Y, onPageBreak);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§8 Rechte Dritter', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      y = addWrappedText('Der Auftragnehmer garantiert, dass sämtliche Inhalte frei von Rechten Dritter sind. Er haftet für alle daraus resultierenden Rechtsverletzungen.', 14, y, 180);

      // §9 Vergütung - Überschrift + 9.1-Block (~40mm) muss passen
      y = ensureSpace(y + 10, 40, MAX_CONTENT_Y, onPageBreak);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§9 Vergütung', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;

      doc.setFont('helvetica', 'bold');
      doc.text('9.1 Vergütung', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      const verguetung = formatMoney(vertrag.verguetung_netto);
      doc.text(`Fixvergütung: ${verguetung} € netto zzgl. gesetzlicher Umsatzsteuer.`, 14, y);
      y += 6;
      if (vertrag.zusatzkosten) {
        drawCheckbox(14, y, true, 'Zusatzkosten vereinbart');
        y += 6;
        const zusatzkosten = formatMoney(vertrag.zusatzkosten_betrag);
        doc.text(`Zusatzkosten (z.B. Reisekosten, Requisiten): ${zusatzkosten} € netto`, 14, y);
      } else {
        drawCheckbox(14, y, true, 'Keine Zusatzkosten');
      }

      y = ensureSpace(y + 8, 30, MAX_CONTENT_Y, onPageBreak);
      doc.setFont('helvetica', 'bold');
      doc.text('9.2 Zahlungsbedingungen', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      doc.text(`Zahlungsziel: ${zahlungszielLabels[vertrag.zahlungsziel] || '-'}`, 14, y);
      y += 5;
      doc.text(`Skonto: ${(vertrag.skonto === true || vertrag.skonto === 'true') ? 'Ja (3% bei Zahlung innerhalb 7 Tage)' : 'Nein'}`, 14, y);
      y += 5;
      y = addWrappedText('Die Zahlung erfolgt durch die LikeGroup GmbH im Auftrag des Kunden. Die Rechnungsstellung erfolgt nach finaler Abnahme.', 14, y, 180);
      y = renderZusatzBestimmung(doc, zusaetze.p9, { y, maxContentY: MAX_CONTENT_Y, onPageBreak });

      // §10 Verschwiegenheit - Block (~30mm) muss komplett passen
      y = ensureSpace(y + 10, 30, MAX_CONTENT_Y, onPageBreak);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§10 Verschwiegenheit', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      y = addWrappedText('Der Auftragnehmer verpflichtet sich zur vollständigen Verschwiegenheit über Inhalte, Material und Ergebnisse dieses Auftrags. Eine Eigenverwendung oder Veröffentlichung ist nur mit vorheriger schriftlicher Zustimmung zulässig.', 14, y, 180);

      // §11 Rücktritt - Block (~30mm) muss komplett passen
      y = ensureSpace(y + 10, 30, MAX_CONTENT_Y, onPageBreak);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§11 Rücktritt', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      y = addWrappedText('Erfüllt der Auftragnehmer die vereinbarten Leistungen auch nach Nachbesserung oder Neuerstellung nicht, ist der Auftraggeber berechtigt, vom Vertrag zurückzutreten. Bereits gezahlte Vergütungen können anteilig oder vollständig zurückgefordert werden.', 14, y, 180);

      // §12 Vertragsschluss - Block (~25mm) muss komplett passen
      y = ensureSpace(y + 10, 25, MAX_CONTENT_Y, onPageBreak);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§12 Vertragsschluss', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      y = addWrappedText('Dieser Vertrag wird mit der Unterschrift des Auftragnehmers wirksam. Eine zusätzliche Unterschrift der LikeGroup GmbH ist nicht erforderlich.', 14, y, 180);

      // §13 Weitere Bestimmungen (nur wenn ausgefüllt)
      if (vertrag.weitere_bestimmungen) {
        // Überschrift + erste Textzeile zusammenhalten
        y = ensureSpace(y + 10, 20, MAX_CONTENT_Y, onPageBreak);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('§13 Weitere Bestimmungen', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 8;
        y = addWrappedText(vertrag.weitere_bestimmungen, 14, y, 180);
      }

      // Unterschrift - garantiert genug Platz vor der Fußzeile
      y = ensureSpace(y + 20, 22, MAX_CONTENT_Y, onPageBreak);
      doc.text('Ort, Datum: ___________________________', 14, y);
      y += 15;
      doc.text('Auftragnehmer: ___________________________', 14, y);

      // Fußzeile für letzte Seite
      addFooter();

      // PDF speichern
      const pdfBlob = doc.output('blob');
      const filePrefix = lang === 'en' ? 'EN_Contract_Videograf' : 'Vertrag_Videograf';
      const fileName = `${filePrefix}_${vertrag.name || 'Produktion'}_${new Date().toISOString().split('T')[0]}.pdf`;

      const uploadResult = await uploadGeneratedVertragPdf(this, vertrag, pdfBlob, fileName);
      if (uploadResult?.fileUrl) {
        console.log('✅ Videograf-PDF nach Dropbox hochgeladen und URL gespeichert');
      } else {
        console.warn('⚠️ Dropbox-Upload nicht erfolgreich – PDF wird nur lokal heruntergeladen');
      }
      doc.save(fileName);

      console.log('✅ Videograf-PDF generiert');

    } catch (error) {
      console.error('❌ Fehler bei Videograf-PDF-Generierung:', error);
      window.toastSystem?.show('PDF konnte nicht generiert werden', 'warning');
    }
};

  // ============================================
  // MODELVERTRAG PDF
