// pdf/VideografPdf.js
// Videografen-/Fotografen-Produktionsvertrag: PDF-Generierung.

import { VertraegeCreate } from '../VertraegeCreateCore.js';

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

      // LikeGroup Logo als SVG
      const logoSvg = `<svg width="120" height="66" viewBox="0 0 120 66" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_4719_236)">
<path d="M65.7855 50.1389V47.153H64.2168V60.8863H65.7855V53.7794C65.7855 50.6035 67.8717 48.5575 71.1445 48.5575H71.4975V46.9418H71.1445C68.7105 46.9418 66.8153 48.1536 65.7855 50.1468V50.1415V50.1389Z" fill="#0D0D0D"/>
<path d="M79.4557 46.8257C75.2885 46.8257 72.1484 49.9224 72.1484 54.0144C72.1484 58.1064 75.3176 61.2031 79.4557 61.2031C83.5937 61.2031 86.739 58.1064 86.739 54.0144C86.739 49.9224 83.6282 46.8257 79.4557 46.8257ZM85.1119 54.017C85.1119 57.2458 82.7019 59.6983 79.4557 59.6983C76.2095 59.6983 73.7702 57.2484 73.7702 54.017C73.7702 50.7857 76.2042 48.3358 79.4557 48.3358C82.7072 48.3358 85.1119 50.7857 85.1119 54.017Z" fill="#0D0D0D"/>
<path d="M100.293 55.1998C100.293 57.8926 98.3151 59.6957 95.6343 59.6957C92.9535 59.6957 91.1937 57.919 91.1937 55.2526V47.1504H89.625V55.6855C89.625 59.0278 91.844 61.2058 95.1751 61.2058C97.4764 61.2058 99.26 60.2078 100.293 58.4866V60.8837H101.861V47.1504H100.293V55.2024V55.1971V55.1998Z" fill="#0D0D0D"/>
<path d="M112.96 46.8257C110.335 46.8257 108.169 48.1694 107.004 50.2999V47.1478H105.436V66H107.004V57.7342C108.164 59.8594 110.33 61.2084 112.96 61.2084C116.995 61.2084 120 58.1117 120 54.0197C120 49.9277 116.998 46.831 112.96 46.831V46.8257ZM112.692 59.6983C109.441 59.6983 107.007 57.2484 107.007 54.017C107.007 50.7857 109.441 48.3358 112.692 48.3358C115.944 48.3358 118.378 50.7857 118.378 54.017C118.378 57.2484 115.944 59.6983 112.692 59.6983Z" fill="#0D0D0D"/>
<path d="M48.8391 48.6869H59.8119C59.419 55.007 54.2883 59.6006 47.7349 59.6006C40.6719 59.6006 35.3421 54.2626 35.3421 47.1926C35.3421 47.0158 35.3474 46.8389 35.3553 46.6594H33.6168C33.6115 46.8362 33.6035 47.0105 33.6035 47.1926C33.6035 55.1628 39.6792 61.2084 47.7376 61.2084C55.796 61.2084 61.5531 55.4374 61.5531 47.7022V47.153H48.8417V48.6842H48.8364H48.8391V48.6869Z" fill="#0D0D0D"/>
<path d="M28.7462 15.3067H23.1191V41.5879H28.7462V15.3067Z" fill="#0D0D0D"/>
<path d="M5.58991 0H0V41.448H18.2535V36.4531H5.59257L5.58991 0Z" fill="#0D0D0D"/>
<path d="M82.6114 35.9753C81.0347 37.2636 78.9777 38.0503 76.6233 38.0503C71.8589 38.0503 68.4667 34.9642 67.6041 30.7402H91.3838C91.6784 28.3114 91.3838 26.1703 91.3838 26.1703C90.3513 19.4885 84.3207 14.1715 76.6233 14.1715C68.0633 14.1715 61.7461 20.6844 61.7461 28.4513C61.7461 36.2182 68.0659 42.731 76.6233 42.731C82.2477 42.731 86.8423 39.9538 89.3851 35.9753H82.6114ZM76.618 18.8522C81.3825 18.8522 84.9472 22.0519 85.7514 26.1624H67.6041C68.5251 21.8777 72.0261 18.8522 76.6233 18.8522H76.618Z" fill="#0D0D0D"/>
<path d="M62.0331 41.4525C61.6187 40.1351 61.0132 38.8889 60.2323 37.748C57.5524 33.817 53.1035 31.4694 48.3254 31.4694C45.927 31.4694 43.595 32.078 41.5286 33.1767L59.2071 15.2815H52.3678L39.7225 28.3367V0H34.0918V41.5052H39.4251C40.8248 38.3356 44.0147 36.1171 47.7251 36.1171C51.4356 36.1171 54.6254 38.3329 56.0252 41.5052H62.0463C62.0463 41.5052 62.041 41.4893 62.0384 41.4683C62.0384 41.4683 62.0384 41.4604 62.0331 41.4525Z" fill="#0D0D0D"/>
</g>
<defs>
<clipPath id="clip0_4719_236">
<rect width="120" height="66" fill="white"/>
</clipPath>
</defs>
</svg>`;

      // Helper: SVG zu PNG konvertieren - verwendet data: URL statt blob:
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

      // Logo konvertieren
      const logoBase64 = await svgToPngDataUrl(logoSvg, 120, 66);

      // Seitenzähler für Fußzeile
      let pageNumber = 1;

      // Helper: Fußzeile hinzufügen
      const addFooter = () => {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text('LikeGroup GmbH | Jakob-Latscha-Str. 3 | 60314 Frankfurt am Main | Deutschland', 14, FOOTER_Y);
        doc.text(`Seite ${pageNumber}`, 196, FOOTER_Y, { align: 'right' });
        doc.setTextColor(0);
        pageNumber++;
      };

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

      // Helper für Textumbruch
      const addWrappedText = (text, x, y, maxWidth) => {
        const localizedText = this.localizeContractText(text, lang);
        const lines = doc.splitTextToSize(localizedText, maxWidth);
        lines.forEach(line => {
          if (y > MAX_CONTENT_Y) {
            addFooter();
            doc.addPage();
            y = 20;
          }
          doc.text(line, x, y);
          y += 5;
        });
        return y;
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
      doc.text(`Name / Firma: ${creator?.vorname || ''} ${creator?.nachname || ''}`, 105, y, { align: 'center' });
      y += 5;
      doc.text(`${creator?.lieferadresse_strasse || ''} ${creator?.lieferadresse_hausnummer || ''}`, 105, y, { align: 'center' });
      y += 5;
      doc.text(`${creator?.lieferadresse_plz || ''} ${creator?.lieferadresse_stadt || ''}`, 105, y, { align: 'center' });
      y += 5;
      doc.text(`${vertrag.influencer_land || 'Deutschland'}`, 105, y, { align: 'center' });
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

      // §3 Output, Abgabe & Versionierung
      y += 10;
      if (y > MAX_CONTENT_Y) {
        addFooter();
        doc.addPage();
        y = 20;
      }
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
      // Alle Optionen als Checkboxen anzeigen
      Object.entries(lieferumfangLabels).forEach(([key, label]) => {
        drawCheckbox(14, y, lieferumfang.includes(key), label);
        y += 6;
      });

      // 3.2 Abgabe V1
      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('3.2 Abgabe der ersten Version (V1)', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      const v1Deadline = this.formatContractDate(vertrag.videograf_v1_deadline, lang);
      y = addWrappedText(`Die erste inhaltliche Version (Preview / V1) ist spätestens bis: ${v1Deadline} digital zur Verfügung zu stellen.`, 14, y, 180);

      // 3.3 Korrekturschleifen
      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('3.3 Korrekturschleifen', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      drawCheckbox(14, y, true, `${vertrag.korrekturschleifen || 1} Korrekturschleife(n)`);
      y += 6;
      y = addWrappedText('Eine Korrekturschleife umfasst jeweils eine überarbeitete Version nach Feedback.', 14, y, 180);

      // 3.4 Finale Version
      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('3.4 Abgabe der finalen Version', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      y = addWrappedText(`Die finale Version ist spätestens ${vertrag.videograf_finale_werktage || 5} Werktage nach Abschluss der letzten Korrekturschleife bereitzustellen.`, 14, y, 180);

      // §4 Qualitätsanforderungen
      y += 10;
      if (y > MAX_CONTENT_Y) {
        addFooter();
        doc.addPage();
        y = 20;
      }
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
        doc.text(req, 14, y);
        y += 5;
      });
      y += 3;
      y = addWrappedText('Technisch oder inhaltlich nicht verwertbares Material gilt als nicht vertragsgemäß.', 14, y, 180);

      // §5 Nachbesserung & Neuerstellung
      y += 10;
      if (y > MAX_CONTENT_Y) {
        addFooter();
        doc.addPage();
        y = 20;
      }
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

      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.text('5.2 Neuerstellung (Neudreh)', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      y = addWrappedText('Ein Anspruch auf kostenfreie Neuerstellung (Neudreh) besteht insbesondere bei: erheblichen technischen Mängeln, unbrauchbarem Bild- oder Tonmaterial, grober Abweichung vom Briefing, Missachtung professioneller Standards. Sofern die Mängel nicht durch Nachbesserung behoben werden können, ist der Auftragnehmer verpflichtet, die Leistung neu zu erbringen. Wenn es sich hierbei um ein einmaliges Event gehandelt hat, entfällt die Vergütung.', 14, y, 180);

      // §7 Nutzungsrechte
      y += 10;
      if (y > MAX_CONTENT_Y) {
        addFooter();
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§7 Nutzungsrechte', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      y = addWrappedText('Der Auftragnehmer überträgt dem Auftraggeber ausschließliche, zeitlich und räumlich unbegrenzte Nutzungsrechte an sämtlichen erstellten Inhalten.', 14, y, 180);
      y += 3;
      const nutzungsart = vertrag.videograf_nutzungsart || [];
      // Alle Optionen als Checkboxen anzeigen
      Object.entries(nutzungsartLabels).forEach(([key, label]) => {
        drawCheckbox(14, y, nutzungsart.includes(key), label);
        y += 6;
      });
      y += 3;
      y = addWrappedText('Eine Urheberbenennung ist nicht erforderlich, sofern nicht ausdrücklich vereinbart.', 14, y, 180);

      // §8 Rechte Dritter
      y += 10;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§8 Rechte Dritter', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      y = addWrappedText('Der Auftragnehmer garantiert, dass sämtliche Inhalte frei von Rechten Dritter sind. Er haftet für alle daraus resultierenden Rechtsverletzungen.', 14, y, 180);

      // §9 Vergütung
      y += 10;
      if (y > MAX_CONTENT_Y) {
        addFooter();
        doc.addPage();
        y = 20;
      }
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

      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.text('9.2 Zahlungsbedingungen', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      doc.text(`Zahlungsziel: ${zahlungszielLabels[vertrag.zahlungsziel] || '-'}`, 14, y);
      y += 5;
      doc.text(`Skonto: ${(vertrag.skonto === true || vertrag.skonto === 'true') ? 'Ja (3% bei Zahlung innerhalb 7 Tage)' : 'Nein'}`, 14, y);
      y += 5;
      y = addWrappedText('Die Zahlung erfolgt durch die LikeGroup GmbH im Auftrag des Kunden. Die Rechnungsstellung erfolgt nach finaler Abnahme.', 14, y, 180);

      // §10 Verschwiegenheit
      y += 10;
      if (y > MAX_CONTENT_Y) {
        addFooter();
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§10 Verschwiegenheit', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      y = addWrappedText('Der Auftragnehmer verpflichtet sich zur vollständigen Verschwiegenheit über Inhalte, Material und Ergebnisse dieses Auftrags. Eine Eigenverwendung oder Veröffentlichung ist nur mit vorheriger schriftlicher Zustimmung zulässig.', 14, y, 180);

      // §11 Rücktritt
      y += 10;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§11 Rücktritt', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      y = addWrappedText('Erfüllt der Auftragnehmer die vereinbarten Leistungen auch nach Nachbesserung oder Neuerstellung nicht, ist der Auftraggeber berechtigt, vom Vertrag zurückzutreten. Bereits gezahlte Vergütungen können anteilig oder vollständig zurückgefordert werden.', 14, y, 180);

      // §12 Vertragsschluss
      y += 10;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§12 Vertragsschluss', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      y = addWrappedText('Dieser Vertrag wird mit der Unterschrift des Auftragnehmers wirksam. Eine zusätzliche Unterschrift der LikeGroup GmbH ist nicht erforderlich.', 14, y, 180);

      // §13 Weitere Bestimmungen (nur wenn ausgefüllt)
      if (vertrag.weitere_bestimmungen) {
        y += 10;
        if (y > MAX_CONTENT_Y) {
          addFooter();
          doc.addPage();
          y = 20;
        }
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('§13 Weitere Bestimmungen', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 8;
        y = addWrappedText(vertrag.weitere_bestimmungen, 14, y, 180);
      }

      // Unterschrift
      y += 20;
      if (y > MAX_CONTENT_Y) {
        addFooter();
        doc.addPage();
        y = 20;
      }
      doc.text('Ort, Datum: ___________________________', 14, y);
      y += 15;
      doc.text('Auftragnehmer: ___________________________', 14, y);

      // Fußzeile für letzte Seite
      addFooter();

      // PDF speichern
      const pdfBlob = doc.output('blob');
      const filePrefix = lang === 'en' ? 'EN_Contract_Videograf' : 'Vertrag_Videograf';
      const fileName = `${filePrefix}_${vertrag.name || 'Produktion'}_${new Date().toISOString().split('T')[0]}.pdf`;
      // Speichere in Unternehmens-Ordner: unternehmen/{unternehmen_id}/{vertrag_id}/{filename}
      const filePath = vertrag.kunde_unternehmen_id 
        ? `unternehmen/${vertrag.kunde_unternehmen_id}/${vertrag.id}/${fileName}`
        : `${vertrag.id}/${fileName}`;

      // PDF in Storage hochladen
      const { data: uploadData, error: uploadError } = await window.supabase.storage
        .from('vertraege')
        .upload(filePath, pdfBlob, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (uploadError) {
        console.warn('⚠️ PDF-Upload fehlgeschlagen:', uploadError);
        doc.save(fileName);
      } else {
        const { data: urlData } = window.supabase.storage
          .from('vertraege')
          .getPublicUrl(filePath);

        if (urlData?.publicUrl) {
          await window.supabase
            .from('vertraege')
            .update({
              datei_url: urlData.publicUrl,
              datei_path: filePath
            })
            .eq('id', vertrag.id);

          console.log('✅ Videograf-PDF hochgeladen und URL gespeichert');
        }

        doc.save(fileName);
      }

      console.log('✅ Videograf-PDF generiert');

    } catch (error) {
      console.error('❌ Fehler bei Videograf-PDF-Generierung:', error);
      window.toastSystem?.show('PDF konnte nicht generiert werden', 'warning');
    }
};

  // ============================================
  // MODELVERTRAG PDF
