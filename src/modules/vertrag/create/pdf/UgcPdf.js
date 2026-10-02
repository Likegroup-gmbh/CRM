// pdf/UgcPdf.js
// UGC-Produktionsvertrag: PDF-Generierung.

import { VertraegeCreate } from '../VertraegeCreateCore.js';
import { uploadGeneratedVertragPdf } from './VertragPdfUpload.js';
import { createPdfLayout } from './PdfTextFlow.js';
import { loadLikeGroupLogoPng, drawLikeGroupLogo, likeGroupFooterLine } from '../../../../core/pdf/PdfBrand.js';

VertraegeCreate.prototype.generatePDF = async function(vertrag) {
    const lang = this.getContractLanguage(vertrag);

    // Dynamisch jsPDF laden falls nicht vorhanden
    if (!window.jspdf) {
      try {
        const script = document.createElement('script');
        // jsdelivr.net ist in der CSP erlaubt
        script.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
        document.head.appendChild(script);
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
        });
      } catch (e) {
        console.warn('⚠️ jsPDF konnte nicht geladen werden:', e);
        window.toastSystem?.show('PDF-Bibliothek konnte nicht geladen werden', 'warning');
        throw new Error('PDF-Bibliothek konnte nicht geladen werden');
      }
    }

    // Je nach Vertragstyp unterschiedliche PDF generieren
    if (vertrag.typ === 'Influencer Kooperation') {
      const template = vertrag._pdfTemplate || this.formData?.vertrag_template || 'legacy';
      if (template === 'awareness' && typeof this.generateAwarenessPDF === 'function') {
        return this.generateAwarenessPDF(vertrag, lang);
      }
      return this.generateInfluencerPDF(vertrag, lang);
    }
    
    if (vertrag.typ === 'Videograph') {
      return this.generateVideografPDF(vertrag, lang);
    }

    if (vertrag.typ === 'Model') {
      return this.generateModelPDF(vertrag, lang);
    }

    if (vertrag.typ === 'Contracting') {
      return this.generateContractingPDF(vertrag, lang);
    }

    const template = vertrag._pdfTemplate || this.formData?.vertrag_template || 'legacy';
    if (template === 'ehg' && typeof this.generateEhgPDF === 'function') {
      return this.generateEhgPDF(vertrag, lang);
    }
    if (template === 'v2' && typeof this.generateUgcV2PDF === 'function') {
      return this.generateUgcV2PDF(vertrag, lang);
    }

    // Standard: UGC-PDF (Legacy)
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      this.localizeDocText(doc, lang);

      // Font auf Helvetica setzen (ähnlich Arial, in jsPDF eingebaut)
      doc.setFont('helvetica');

      // Konstanten für Fußzeile (gesperrter Bereich)
      const FOOTER_Y = 285; // Position der Fußzeile
      const MAX_CONTENT_Y = 250; // Maximale Y-Position für Content (vor Fußzeile)

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
        // Links: Adresse
        doc.text(likeGroupFooterLine(), 14, FOOTER_Y);
        // Rechts: Seitenzahl
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

      // Helper: Content-Erstellung Art lesbar machen
      const contentErstellungLabels = {
        'skript_fertig': 'Fertiges Skript vom Auftraggeber',
        'briefing_direkt': 'Briefing vom Auftraggeber, direkter Dreh ohne Skript',
        'briefing_skript': 'Briefing vom Auftraggeber, Skript durch Creator',
        'eigenstaendig': 'Eigenständige Konzeption durch Creator'
      };
      
      // Helper: Lieferung Art lesbar machen
      const lieferungLabels = {
        'fertig_geschnitten': 'Fertig geschnittenes Video',
        'raw_cut': 'Raw Cut (Szenen aneinandergeschnitten)',
        'rohmaterial': 'Rohmaterial (ungeschnittene Clips)'
      };
      
      // Helper: Nutzungsart lesbar machen
      const nutzungsartLabels = {
        'organisch': 'Organische Nutzung',
        'paid': 'Paid Ads Nutzung',
        'beides': 'Organisch & Paid Ads'
      };
      
      // Helper: Nutzungsdauer lesbar machen (inkl. individuell)
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

      // Helper: Datum formatieren
      const formatDate = (d) => this.formatContractDate(d, lang);
      const formatMoney = (v, emptyValue = '0,00') => this.formatContractMoney(v, lang, { emptyValue });

      // Layout-Schicht: vermisst Abschnitte vor dem Zeichnen und bricht bei Bedarf um
      // (nach localizeDocText erzeugen, wrappt doc.text zusätzlich)
      const layout = createPdfLayout(doc, { maxContentY: MAX_CONTENT_Y, onPageBreak, footerY: FOOTER_Y });

      // Helper: Checkbox zeichnen (echte Rechtecke mit X, Label bricht bei Bedarf um)
      const drawCheckbox = (x, yPos, checked, label) => layout.checkbox(x, yPos, checked, label);

      // Helper: Ja/Nein Checkboxen nebeneinander
      const drawYesNoCheckboxes = (x, yPos, value) => {
        drawCheckbox(x, yPos, value === true, 'Ja');
        drawCheckbox(x + 20, yPos, value === false || value === undefined || value === null, 'Nein');
      };

      // Zentrierte Zeile mit DB-Inhalt (bricht um, liefert Baseline der letzten Zeile)
      const centered = (text, yPos) => layout.line(text, 105, yPos, { align: 'center' });

      // ============================================
      // SEITE 1: Titel + Adressdaten (ZENTRIERT)
      // ============================================

      // Logo oben zentriert
      drawLikeGroupLogo(doc, logoBase64, { align: 'center' });

      // Titel (Logo endet bei y=28, daher Titel ab y=36)
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('UGC-PRODUKTIONSVERTRAG', 105, 36, { align: 'center' });
      doc.setFont('helvetica', 'normal');

      // Vertragsname (kann lang sein: umbrechen, Folgeblöcke rücken nach)
      doc.setFontSize(10);
      const nameEndY = centered(`${vertrag.name || 'Ohne Name'}`, 46);

      let y = Math.max(62, nameEndY + 16);

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
        return y;
      });

      // Kundendaten (zentriert)
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
      }, { gap: 18 });

      // Creatordaten (zentriert, untereinander formatiert)
      y = layout.section(y, (y) => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Creatordaten', 105, y, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 8;
        y = centered(`Name: ${creator?.vorname || ''} ${creator?.nachname || ''}`, y);
        y += 5;
        return this.appendPdfCreatorContractAddress(doc, y, creatorContractAddress, 'Deutschland');
      }, { gap: 18 });

      // Influencer-Vertretung (zentriert)
      y = layout.section(y, (y) => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Influencer-Vertretung', 105, y, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 6;
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
      // SEITE 2: Vertragsinhalte (linksbündig)
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
        doc.text('Der Auftraggeber beauftragt den Creator mit der Erstellung von User Generated Content (UGC)', 14, y);
        y += 5;
        doc.text('zu Marketingzwecken. Es handelt sich um einen einmaligen Produktionsauftrag.', 14, y);
        return y;
      });

      // §2 Leistungsumfang
      y = layout.section(y, (y) => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('§2 Leistungsumfang', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 8;
        doc.setFont('helvetica', 'bold');
        doc.text('2.1 Content-Art und Anzahl', 14, y);
        doc.setFont('helvetica', 'normal');
        y += 6;
        doc.text(`Videos: ${vertrag.anzahl_videos || 0}  |  Fotos: ${vertrag.anzahl_fotos || 0}  |  Storys: ${vertrag.anzahl_storys || 0}`, 14, y);
        y += 8;
        doc.setFont('helvetica', 'bold');
        doc.text('2.2 Art der Content-Erstellung', 14, y);
        doc.setFont('helvetica', 'normal');
        y += 6;
        doc.text(`${contentErstellungLabels[vertrag.content_erstellung_art] || '-'}`, 14, y);
        return y;
      }, { gap: 14 });
      y = layout.zusatz(zusaetze.p2, y);

      // §3 Output & Lieferumfang
      y = layout.section(y, (y) => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('§3 Output & Lieferumfang', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 8;
        doc.setFont('helvetica', 'bold');
        doc.text('3.1 Art der Lieferung', 14, y);
        doc.setFont('helvetica', 'normal');
        y += 6;
        doc.text(`${lieferungLabels[vertrag.lieferung_art] || '-'}`, 14, y);
        y += 8;
        doc.setFont('helvetica', 'bold');
        doc.text('3.2 Rohmaterial enthalten', 14, y);
        doc.setFont('helvetica', 'normal');
        y += 6;
        drawYesNoCheckboxes(14, y, vertrag.rohmaterial_enthalten);
        y += 8;
        doc.setFont('helvetica', 'bold');
        doc.text('3.3 Untertitel', 14, y);
        doc.setFont('helvetica', 'normal');
        y += 6;
        drawYesNoCheckboxes(14, y, vertrag.untertitel);
        return y;
      }, { gap: 14 });
      y = layout.zusatz(zusaetze.p3, y);

      // §4 Nutzungsrechte
      y = layout.section(y, (y) => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('§4 Nutzungsrechte', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 8;
        doc.setFont('helvetica', 'bold');
        doc.text('4.1 Nutzungsart', 14, y);
        doc.setFont('helvetica', 'normal');
        y += 6;
        doc.text(`${nutzungsartLabels[vertrag.nutzungsart] || '-'}`, 14, y);
        y += 8;
        doc.setFont('helvetica', 'bold');
        doc.text('4.2 Medien', 14, y);
        doc.setFont('helvetica', 'normal');
        y += 6;
        const medienLabels = { 'social_media': 'Social Media', 'website': 'Website', 'otv': 'OTV' };
        const medienText = (vertrag.medien || []).map(m => medienLabels[m] || m).join(', ') || '-';
        y = layout.line(medienText, 14, y);
        y += 8;
        doc.setFont('helvetica', 'bold');
        doc.text('4.3 Nutzungsdauer', 14, y);
        doc.setFont('helvetica', 'normal');
        y += 6;
        doc.text(getNutzungsdauerText(vertrag), 14, y);
        y += 8;
        doc.setFont('helvetica', 'bold');
        doc.text('4.4 Exklusivität', 14, y);
        doc.setFont('helvetica', 'normal');
        y += 6;
        drawYesNoCheckboxes(14, y, vertrag.exklusivitaet);
        if (vertrag.exklusivitaet) {
          y += 5;
          const ugcEinheitLabels = { 'monate': 'Monate', 'wochen': 'Wochen', 'tage': 'Tage' };
          const ugcEinheit = ugcEinheitLabels[vertrag.exklusivitaet_einheit || this.formData.exklusivitaet_einheit] || 'Monate';
          const ugcMonate = vertrag.exklusivitaet_monate || parseInt(this.formData.exklusivitaet_monate) || '-';
          y = layout.line(`Exklusivität für ${ugcMonate} ${ugcEinheit}`, 14, y);
        }
        return y;
      }, { gap: 14 });
      y = layout.zusatz(zusaetze.p4, y);

      // §5 Vergütung (5.1)
      y = layout.section(y, (y) => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('§5 Vergütung', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 8;
        doc.setFont('helvetica', 'bold');
        doc.text('5.1 Vergütung', 14, y);
        doc.setFont('helvetica', 'normal');
        y += 6;
        doc.text(`Fixvergütung: ${formatMoney(vertrag.verguetung_netto)} € netto`, 14, y);
        y += 5;
        doc.text('Die Vergütung versteht sich zzgl. gesetzlicher Umsatzsteuer, sofern diese anfällt.', 14, y);
        y += 8;
        // Zusatzkosten als Checkboxen
        drawCheckbox(14, y, vertrag.zusatzkosten === true, 'Zusatzkosten vereinbart');
        y += 5;
        drawCheckbox(14, y, !vertrag.zusatzkosten, 'Keine Zusatzkosten');
        if (vertrag.zusatzkosten && vertrag.zusatzkosten_betrag !== null && vertrag.zusatzkosten_betrag !== undefined) {
          y += 6;
          doc.text(`Bei Zusatzkosten: ${formatMoney(vertrag.zusatzkosten_betrag)} € netto`, 14, y);
        }
        return y;
      }, { gap: 14 });

      // 5.2 Zahlungsbedingungen
      y = layout.section(y, (y) => {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('5.2 Zahlungsbedingungen', 14, y);
        doc.setFont('helvetica', 'normal');
        y += 6;
        const zahlungszielLabels = { '30_tage': '30 Tage', '60_tage': '60 Tage' };
        doc.text(`Zahlungsziel: ${zahlungszielLabels[vertrag.zahlungsziel] || '-'}`, 14, y);
        y += 6;
        const ugcSkontoValue = vertrag.skonto === true || vertrag.skonto === 'true';
        doc.text('Skonto:', 14, y);
        y += 5;
        drawCheckbox(14, y, ugcSkontoValue, 'Ja (3% bei Zahlung innerhalb 7 Tage)');
        y += 5;
        drawCheckbox(14, y, !ugcSkontoValue, 'Nein');
        y += 5;
        doc.text('Bei Skonto gilt: Bei Zahlung innerhalb von 7 Kalendertagen ab Rechnungsdatum gewährt der', 14, y);
        y += 4;
        doc.text('Creator 3% Skonto auf den Nettorechnungsbetrag. Der Skonto-Hinweis ist auf der Rechnung auszuweisen.', 14, y);
        return y;
      }, { gap: 8 });
      y = layout.zusatz(zusaetze.p5, y);

      // §6 Deadlines & Korrekturen
      y = layout.section(y, (y) => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('§6 Deadlines & Korrekturen', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 8;
        doc.setFont('helvetica', 'bold');
        doc.text('6.1 Content-Deadline', 14, y);
        doc.setFont('helvetica', 'normal');
        y += 6;
        doc.text(`Lieferdatum: ${formatDate(vertrag.content_deadline)}`, 14, y);
        y += 8;
        doc.setFont('helvetica', 'bold');
        doc.text('6.2 Korrekturschleifen', 14, y);
        doc.setFont('helvetica', 'normal');
        y += 6;
        doc.text(`${vertrag.korrekturschleifen || '-'}`, 14, y);
        return y;
      }, { gap: 14 });
      y = layout.zusatz(zusaetze.p6, y);

      // ============================================
      // SEITE 3+: Statische Paragraphen §7-§13
      // ============================================

      // §7 Rechte Dritter
      y = layout.section(y, (y) => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('§7 Rechte Dritter', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 8;
        doc.text('Der Creator garantiert, dass der Content frei von Rechten Dritter ist. Insbesondere dürfen keine', 14, y);
        y += 4;
        doc.text('fremden Marken, Logos, Musikstücke, geschützten Inhalte oder Personen ohne entsprechende Rechte', 14, y);
        y += 4;
        doc.text('oder Einwilligungen verwendet werden. Der Creator haftet für sämtliche daraus entstehenden', 14, y);
        y += 4;
        doc.text('Rechtsverletzungen.', 14, y);
        return y;
      }, { gap: 14 });

      // §8 Verschwiegenheit
      y = layout.section(y, (y) => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('§8 Verschwiegenheit', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 8;
        doc.text('Der Creator verpflichtet sich zur vollständigen Verschwiegenheit über Inhalt, Ablauf und Ergebnisse', 14, y);
        y += 4;
        doc.text('dieses Auftrags. Eine Veröffentlichung, Weitergabe oder Erwähnung des Contents vor der offiziellen', 14, y);
        y += 4;
        doc.text('Nutzung durch den Auftraggeber ist untersagt. Bei Verstoß kann eine angemessene Vertragsstrafe', 14, y);
        y += 4;
        doc.text('geltend gemacht werden.', 14, y);
        return y;
      }, { gap: 14 });

      // §9 Qualitätsrichtlinien & Briefings
      y = layout.section(y, (y) => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('§9 Qualitätsrichtlinien & Briefings', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 8;
        doc.text('Sofern vereinbart, gelten folgende Unterlagen als verbindlicher Bestandteil dieses Vertrags:', 14, y);
        y += 5;
        doc.text('• Do\'s & Don\'ts', 18, y);
        y += 4;
        doc.text('• Externe Briefings', 18, y);
        y += 4;
        doc.text('• Kampagnen-Guidelines', 18, y);
        y += 4;
        doc.text('• Zusätzliche schriftliche Vorgaben des Auftraggebers oder der Agentur', 18, y);
        y += 5;
        doc.text('Diese Unterlagen konkretisieren die qualitativen und inhaltlichen Anforderungen an den Content.', 14, y);
        return y;
      }, { gap: 14 });

      // §10 Neudreh, Anpassungen & Rücktrittsrecht (Überschrift + 10.1 zusammen)
      y = layout.section(y, (y) => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('§10 Neudreh, Anpassungen & Rücktrittsrecht', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 8;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('10.1 Anspruch auf Neudreh', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 6;
        doc.text('Ein Anspruch auf Neudreh besteht insbesondere bei:', 14, y);
        y += 5;
        doc.text('• Abweichung vom Skript oder Briefing', 18, y);
        y += 5;
        doc.text('• Unzureichender Tonqualität', 18, y);
        y += 5;
        doc.text('• Schlechter Beleuchtung oder Bildqualität', 18, y);
        y += 5;
        doc.text('• Unnatürlicher oder stark werblicher Darstellung', 18, y);
        y += 5;
        doc.text('• Unpassendem oder unaufgeräumtem Hintergrund', 18, y);
        y += 5;
        doc.text('• Fehlender Kreativität, Dynamik oder Energie', 18, y);
        y += 5;
        doc.text('• Missachtung der Qualitätsrichtlinien, Rechtsverstößen, unangemessenen Inhalten', 18, y);
        y += 5;
        doc.text('• Inhaltlich oder qualitativ nicht verwertbarem Content', 18, y);
        return y;
      }, { gap: 14 });

      // 10.2 Anpassungen
      y = layout.section(y, (y) => {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('10.2 Anpassungen (Korrekturschleifen)', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 6;
        doc.text('Als Anpassungen gelten insbesondere:', 14, y);
        y += 5;
        doc.text('• Schnittgeschwindigkeit, Optimierung des Einstiegs (Hook)', 18, y);
        y += 5;
        doc.text('• Kürzen, Straffen oder Umstellen von Szenen', 18, y);
        y += 5;
        doc.text('• Anpassung der Dramaturgie, Zoom-/Bewegungseffekte, Untertitel', 18, y);
        y += 5;
        doc.text('• Nachfilmen einzelner Szenen, allgemeiner Performance-Feinschliff', 18, y);
        return y;
      }, { gap: 8 });

      // 10.3 Rücktrittsrecht
      y = layout.section(y, (y) => {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('10.3 Rücktrittsrecht', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 6;
        doc.text('Erfüllt der Creator die vereinbarten Anforderungen auch nach Nachbesserung oder Neudreh wiederholt', 14, y);
        y += 5;
        doc.text('nicht, ist der Auftraggeber berechtigt, vom Vertrag zurückzutreten und bereits gezahlte Vergütungen', 14, y);
        y += 5;
        doc.text('anteilig oder vollständig zurückzufordern.', 14, y);
        return y;
      }, { gap: 8 });

      // §11 Agenturbeauftragung & Stellvertretung
      y = layout.section(y, (y) => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('§11 Agenturbeauftragung & Stellvertretung', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 8;
        doc.text('Die Agentur beauftragt Creator im eigenen Namen und auf eigene Rechnung; Vertragspartner des', 14, y);
        y += 5;
        doc.text('Creators ist ausschließlich die Agentur.', 14, y);
        y += 8;
        doc.text('Der Creator räumt der Agentur die zur Durchführung der Beauftragung erforderlichen', 14, y);
        y += 5;
        doc.text('Nutzungsrechte ein.', 14, y);
        y += 8;
        doc.text('Die Agentur ist berechtigt, diese Rechte im Umfang der ihr eingeräumten Rechte ganz oder', 14, y);
        y += 5;
        doc.text('teilweise auf den in diesem Vertrag genannten Kunden zu übertragen oder diesem entsprechende', 14, y);
        y += 5;
        doc.text('Nutzungsrechte einzuräumen.', 14, y);
        return y;
      }, { gap: 14 });

      // §12 Schlussbestimmungen
      y = layout.section(y, (y) => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('§12 Schlussbestimmungen', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 8;
        doc.text('Änderungen bedürfen der Schriftform. Sollten einzelne Bestimmungen unwirksam sein, bleibt der', 14, y);
        y += 4;
        doc.text('Vertrag im Übrigen wirksam.', 14, y);
        return y;
      }, { gap: 14 });

      // §13 Vertragsschluss
      y = layout.section(y, (y) => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('§13 Vertragsschluss', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 8;
        doc.text('Dieser Vertrag wird mit der Unterschrift des Creators wirksam.', 14, y);
        y += 4;
        doc.text('Eine zusätzliche Unterschrift der LikeGroup GmbH ist nicht erforderlich.', 14, y);
        return y;
      }, { gap: 14 });

      // §14 Weitere Bestimmungen (nur wenn ausgefüllt)
      if (vertrag.weitere_bestimmungen) {
        // Langer Freitext darf über Seiten laufen: Überschrift + erste Zeilen zusammenhalten,
        // der Rest paginiert zeilenweise (nie in Fußzeile/Seitenrand)
        y = layout.section(y, (y) => {
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text('§14 Weitere Bestimmungen', 14, y);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          y += 8;
          return layout.paginated(vertrag.weitere_bestimmungen, { y });
        }, { gap: 14, head: 20, splittable: true });
      }

      // Unterschrift (nur Creator erforderlich) - garantiert genug Platz vor der Fußzeile
      y = layout.section(y, (y) => {
        doc.setFontSize(10);
        doc.text('Ort, Datum: ___________________________', 14, y);
        y += 15;
        doc.text('Creator: ______________________________', 14, y);
        return y;
      }, { gap: 25 });

      // Fußzeile für letzte Seite
      addFooter();

      // PDF als Blob generieren
      const pdfBlob = doc.output('blob');
      const template = vertrag._pdfTemplate || this.formData?.vertrag_template || 'legacy';
      const filePrefix = template === 'v2'
        ? (lang === 'en' ? 'EN_Contract_neu' : 'Vertrag_neu')
        : (lang === 'en' ? 'EN_Contract' : 'Vertrag');
      const fileName = `${filePrefix}_${vertrag.name || 'UGC'}_${new Date().toISOString().split('T')[0]}.pdf`;

      const uploadResult = await uploadGeneratedVertragPdf(this, vertrag, pdfBlob, fileName);
      console.log('✅ PDF nach Dropbox hochgeladen und URL gespeichert');
      doc.save(fileName);
      return uploadResult;

    } catch (error) {
      console.error('❌ Fehler bei PDF-Generierung:', error);
      window.toastSystem?.show('PDF konnte nicht generiert werden', 'warning');
      throw error;
    }
};

  // ============================================
  // INFLUENCER-KOOPERATIONSVERTRAG PDF
