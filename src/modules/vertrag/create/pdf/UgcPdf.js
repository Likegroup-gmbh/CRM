// pdf/UgcPdf.js
// UGC-Produktionsvertrag: PDF-Generierung.

import { VertraegeCreate } from '../VertraegeCreateCore.js';
import { uploadGeneratedVertragPdf } from './VertragPdfUpload.js';
import { ensureSpace, renderPaginatedText, renderZusatzBestimmung } from './PdfTextFlow.js';
import { loadLikeGroupLogoPng, likeGroupFooterLine } from '../../../../core/pdf/PdfBrand.js';

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
        return;
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

      // Helper: Ja/Nein Checkboxen nebeneinander
      const drawYesNoCheckboxes = (x, yPos, value) => {
        drawCheckbox(x, yPos, value === true, 'Ja');
        drawCheckbox(x + 20, yPos, value === false || value === undefined || value === null, 'Nein');
      };

      // ============================================
      // SEITE 1: Titel + Adressdaten (ZENTRIERT)
      // ============================================

      // Logo oben zentriert
      doc.addImage(logoBase64, 'PNG', 93.6, 10, 22.75, 12.6);

      // Titel (Logo endet bei y=28, daher Titel ab y=36)
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('UGC-PRODUKTIONSVERTRAG', 105, 36, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      
      // Vertragsname
      doc.setFontSize(10);
      doc.text(`${vertrag.name || 'Ohne Name'}`, 105, 46, { align: 'center' });

      let y = 62;

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

      // Kundendaten (zentriert)
      y += 18;
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

      // Creatordaten (zentriert, untereinander formatiert)
      y += 18;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Creatordaten', 105, y, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      doc.text(`Name: ${creator?.vorname || ''} ${creator?.nachname || ''}`, 105, y, { align: 'center' });
      y += 5;
      y = this.appendPdfCreatorContractAddress(doc, y, creatorContractAddress, 'Deutschland');

      // Influencer-Vertretung (zentriert)
      y += 15;
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
      doc.text('Der Auftraggeber beauftragt den Creator mit der Erstellung von User Generated Content (UGC)', 14, y);
      y += 5;
      doc.text('zu Marketingzwecken. Es handelt sich um einen einmaligen Produktionsauftrag.', 14, y);

      // §2 Leistungsumfang
      y += 14;
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
      y = renderZusatzBestimmung(doc, zusaetze.p2, { y, maxContentY: MAX_CONTENT_Y, onPageBreak });

      // §3 Output & Lieferumfang
      y += 14;
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
      y = renderZusatzBestimmung(doc, zusaetze.p3, { y, maxContentY: MAX_CONTENT_Y, onPageBreak });

      // §4 Nutzungsrechte
      y += 14;
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
      doc.text(medienText, 14, y);
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
        doc.text(`Exklusivität für ${ugcMonate} ${ugcEinheit}`, 14, y);
      }
      y = renderZusatzBestimmung(doc, zusaetze.p4, { y, maxContentY: MAX_CONTENT_Y, onPageBreak });

      // §5 Vergütung
      y += 14;
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
      // 5.2 Zahlungsbedingungen - Block (~44mm) muss komplett passen
      y = ensureSpace(y + 8, 44, MAX_CONTENT_Y, onPageBreak);
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
      y = renderZusatzBestimmung(doc, zusaetze.p5, { y, maxContentY: MAX_CONTENT_Y, onPageBreak });

      // §6 Deadlines & Korrekturen - Block (~36mm) muss komplett passen
      y = ensureSpace(y + 14, 36, MAX_CONTENT_Y, onPageBreak);
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
      y = renderZusatzBestimmung(doc, zusaetze.p6, { y, maxContentY: MAX_CONTENT_Y, onPageBreak });

      // ============================================
      // SEITE 3+: Statische Paragraphen §7-§13
      // ============================================
      // Nur neue Seite wenn nicht genug Platz für den kompletten §7-Block (~30mm)
      y = ensureSpace(y + 14, 30, MAX_CONTENT_Y, onPageBreak);

      // §7 Rechte Dritter
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

      // §8 Verschwiegenheit - Block (~30mm) muss komplett passen
      y = ensureSpace(y + 14, 30, MAX_CONTENT_Y, onPageBreak);
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

      // §9 Qualitätsrichtlinien & Briefings - Block (~38mm) muss komplett passen
      y = ensureSpace(y + 14, 38, MAX_CONTENT_Y, onPageBreak);
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

      // §10 Neudreh, Anpassungen & Rücktrittsrecht - 10.1-Block (~60mm) muss komplett passen
      y = ensureSpace(y + 14, 60, MAX_CONTENT_Y, onPageBreak);
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

      // 10.2 Anpassungen - Block (~35mm) muss komplett passen
      y = ensureSpace(y + 8, 35, MAX_CONTENT_Y, onPageBreak);
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

      // 10.3 Rücktrittsrecht - Block (~25mm) muss komplett passen
      y = ensureSpace(y + 8, 25, MAX_CONTENT_Y, onPageBreak);
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

      // §11 Agenturbeauftragung & Stellvertretung - Block (~50mm) muss komplett passen
      y = ensureSpace(y + 14, 50, MAX_CONTENT_Y, onPageBreak);
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

      // §12 Schlussbestimmungen - Block (~25mm) muss komplett passen
      y = ensureSpace(y + 14, 25, MAX_CONTENT_Y, onPageBreak);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§12 Schlussbestimmungen', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      doc.text('Änderungen bedürfen der Schriftform. Sollten einzelne Bestimmungen unwirksam sein, bleibt der', 14, y);
      y += 4;
      doc.text('Vertrag im Übrigen wirksam.', 14, y);

      // §13 Vertragsschluss - Block (~25mm) muss komplett passen
      y = ensureSpace(y + 14, 25, MAX_CONTENT_Y, onPageBreak);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§13 Vertragsschluss', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      doc.text('Dieser Vertrag wird mit der Unterschrift des Creators wirksam.', 14, y);
      y += 4;
      doc.text('Eine zusätzliche Unterschrift der LikeGroup GmbH ist nicht erforderlich.', 14, y);

      // §14 Weitere Bestimmungen (nur wenn ausgefüllt)
      if (vertrag.weitere_bestimmungen) {
        // Überschrift + erste Zeile zusammenhalten
        y = ensureSpace(y + 14, 20, MAX_CONTENT_Y, onPageBreak);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('§14 Weitere Bestimmungen', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 8;
        // Zeilenweise paginieren, damit langer Freitext nie in Fußzeile/Seitenrand läuft
        y = renderPaginatedText(doc, vertrag.weitere_bestimmungen, { y, maxContentY: MAX_CONTENT_Y, onPageBreak });
      }

      // Unterschrift (nur Creator erforderlich) - garantiert genug Platz vor der Fußzeile
      y = ensureSpace(y + 25, 22, MAX_CONTENT_Y, onPageBreak);
      doc.setFontSize(10);
      doc.text('Ort, Datum: ___________________________', 14, y);
      y += 15;
      doc.text('Creator: ______________________________', 14, y);

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
      if (uploadResult?.fileUrl) {
        console.log('✅ PDF nach Dropbox hochgeladen und URL gespeichert');
      } else {
        console.warn('⚠️ Dropbox-Upload nicht erfolgreich – PDF wird nur lokal heruntergeladen');
      }
      doc.save(fileName);

      console.log('✅ PDF generiert');

    } catch (error) {
      console.error('❌ Fehler bei PDF-Generierung:', error);
      window.toastSystem?.show('PDF konnte nicht generiert werden', 'warning');
    }
};

  // ============================================
  // INFLUENCER-KOOPERATIONSVERTRAG PDF
