// pdf/ModelPdf.js
// Modelvertrag: PDF-Generierung.

import { VertraegeCreate } from '../VertraegeCreateCore.js';
import { uploadGeneratedVertragPdf } from './VertragPdfUpload.js';
import { renderPaginatedText, renderZusatzBestimmung } from './PdfTextFlow.js';
import { loadLikeGroupLogoPng, drawLikeGroupLogo, likeGroupFooterLine } from '../../../../core/pdf/PdfBrand.js';

VertraegeCreate.prototype.generateModelPDF = async function(vertrag, lang = this.getContractLanguage(vertrag)) {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      this.localizeDocText(doc, lang);

      doc.setFont('helvetica');

      const FOOTER_Y = 285;
      const MAX_CONTENT_Y = 265;

      const logoBase64 = await loadLikeGroupLogoPng();

      let pageNumber = 1;

      // Fußzeile (stellt Font-Zustand danach wieder her)
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

      const checkPageBreak = (neededSpace = 20) => {
        if (y > MAX_CONTENT_Y - neededSpace) {
          addFooter();
          doc.addPage();
          y = 20;
        }
      };

      // Helper: Seitenumbruch für paginierten Freitext (Footer + neue Seite)
      const onPageBreak = () => {
        addFooter();
        doc.addPage();
        return 20;
      };

      // Zusätzliche Bestimmungen pro Paragraph (optional)
      const zusaetze = vertrag.paragraph_zusaetze || {};

      const drawCheckbox = (x, yPos, checked, label) => {
        doc.rect(x, yPos - 2.5, 3, 3);
        if (checked) {
          doc.line(x + 0.5, yPos - 2, x + 2.5, yPos);
          doc.line(x + 0.5, yPos, x + 2.5, yPos - 2);
        }
        doc.text(label, x + 5, yPos);
      };

      const kunde = this.unternehmen.find(u => u.id === vertrag.kunde_unternehmen_id);
      const creator = this.creators.find(c => c.id === vertrag.creator_id);

      const formatDate = (d) => this.formatContractDate(d, lang);
      const formatMoney = (v, emptyValue = '0,00') => this.formatContractMoney(v, lang, { emptyValue });

      // Label-Maps
      const produktionsartLabels = {
        'foto': 'Fotoshooting',
        'video': 'Videoshooting',
        'kombiniert': 'Kombiniert (Foto & Video)'
      };

      const einsatzortLabels = {
        'studio': 'Studio',
        'outdoor': 'Outdoor',
        'on_location': 'On-Location',
        'ausland': 'Ausland'
      };

      const rolleLabels = {
        'posing': 'Reines Posing',
        'acting': 'Acting / Performance',
        'sprechrolle': 'Mit Sprechrolle',
        'moderation': 'Moderation',
        'sport': 'Sportliche Performance',
        'sonstiges': 'Sonstiges'
      };

      const stylingLabels = {
        'auftraggeber': 'Styling wird vom Auftraggeber gestellt',
        'eigene': 'Model bringt eigene Outfits mit',
        'fitting': 'Fitting-Termin vereinbart'
      };

      const nutzungsartenLabels = {
        'ecommerce': 'E-Commerce',
        'social_media': 'Social Media (organisch)',
        'paid_ads': 'Paid Ads',
        'website': 'Website',
        'ooh': 'OOH',
        'print': 'Print',
        'tv_ctv': 'TV / CTV',
        'pos': 'POS',
        'pr': 'PR',
        'kampagne': 'Kampagne'
      };

      const territoriumLabels = {
        'dach': 'DACH',
        'eu': 'EU',
        'weltweit': 'Weltweit',
        'beschraenkt': `Beschränkt auf: ${vertrag.model_territorium_beschraenkt || '-'}`
      };

      const nutzungsdauerLabels = {
        '3_monate': '3 Monate',
        '6_monate': '6 Monate',
        '12_monate': '12 Monate',
        '24_monate': '24 Monate',
        'unbegrenzt': 'Unbegrenzt'
      };

      const exklLabels = {
        'keine': 'Keine Exklusivität',
        'branche': 'Branchenexklusivität',
        'wettbewerber': 'Wettbewerber-Exklusivität'
      };

      const kiLabels = {
        'ki_erlaubt': 'Nutzung für KI-gestützte Weiterverarbeitung erlaubt',
        'training_ausgeschlossen': 'Nutzung für Trainingsdaten ausgeschlossen',
        'deepfake_nein': 'Keine Deepfake-Nutzung',
        'nur_kampagne': 'Nutzung ausschließlich im Rahmen der vereinbarten Kampagne'
      };

      const honorarArtLabels = {
        'tagesgage': 'Tagesgage',
        'halbtagesgage': 'Halbtagesgage',
        'pauschal': 'Pauschalhonorar',
        'stunde': 'Stundenhonorar'
      };

      const reisekostenLabels = {
        'inklusive': 'Inklusive',
        'nachweis': 'Werden gegen Nachweis erstattet',
        'pauschale': `Reisepauschale: € ${formatMoney(vertrag.model_reisepauschale)} netto`
      };

      const zahlungszielLabels = {
        '7_tage': '7 Tage',
        '14_tage': '14 Tage',
        '30_tage': '30 Tage',
        '45_tage': '45 Tage',
        '60_tage': '60 Tage'
      };

      // ============================================
      // SEITE 1: Titel + Parteien (ZENTRIERT)
      // ============================================

      drawLikeGroupLogo(doc, logoBase64, { align: 'center' });

      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('MODELVERTRAG', 105, 36, { align: 'center' });
      doc.setFont('helvetica', 'normal');

      doc.setFontSize(10);
      doc.text(`${vertrag.name || 'Ohne Name'}`, 105, 46, { align: 'center' });

      let y = 62;

      // Agenturdaten
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

      // Auftraggeber
      y += 18;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Auftraggeber', 105, y, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      doc.text(`Firmenname: ${kunde?.firmenname || '-'}`, 105, y, { align: 'center' });
      y += 5;
      doc.text(`${kunde?.rechnungsadresse_strasse || ''} ${kunde?.rechnungsadresse_hausnummer || ''}`, 105, y, { align: 'center' });
      y += 5;
      doc.text(`${kunde?.rechnungsadresse_plz || ''} ${kunde?.rechnungsadresse_stadt || ''}`, 105, y, { align: 'center' });

      // Model-Daten
      y += 18;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Model', 105, y, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      const creatorContractAddress = this.getResolvedCreatorContractAddress(creator, vertrag);
      doc.text(`Name: ${creator?.vorname || ''} ${creator?.nachname || ''}`, 105, y, { align: 'center' });
      y += 5;
      y = this.appendPdfCreatorContractAddress(doc, y, creatorContractAddress, vertrag.influencer_land || 'Deutschland');
      if (vertrag.influencer_steuer_id) {
        y += 5;
        doc.text(`Steuer-ID: ${vertrag.influencer_steuer_id}`, 105, y, { align: 'center' });
      }

      // PO / Auftragsnummer
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
      doc.text('Der Auftraggeber beauftragt das Model mit der Mitwirkung an einer Foto- und/oder Videoproduktion', 14, y);
      y += 5;
      doc.text('gemäß den nachfolgenden Bestimmungen.', 14, y);
      y += 7;
      doc.text('Die Produktion dient der Erstellung von Bild- und/oder Bewegtbildmaterial für die vertraglich', 14, y);
      y += 5;
      doc.text('definierte Nutzung.', 14, y);

      // §2 Produktion & Einsatz
      y += 14;
      checkPageBreak(60);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§2 Produktion & Einsatz', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);

      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.text('2.1 Produktionsart', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      const prodArtOptions = ['foto', 'video', 'kombiniert'];
      prodArtOptions.forEach(opt => {
        drawCheckbox(18, y, vertrag.model_produktionsart === opt, produktionsartLabels[opt]);
        y += 6;
      });

      y += 4;
      checkPageBreak(30);
      doc.setFont('helvetica', 'bold');
      doc.text('2.2 Produktionszeitraum', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      doc.text(`Shooting von: ${formatDate(vertrag.model_shooting_von)}`, 14, y);
      y += 5;
      doc.text(`Shooting bis: ${formatDate(vertrag.model_shooting_bis)}`, 14, y);

      y += 8;
      checkPageBreak(30);
      doc.setFont('helvetica', 'bold');
      doc.text('2.3 Tagesstruktur', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      doc.text(`Call Time (Ankunft): ${vertrag.model_call_time || '-'}`, 14, y);
      y += 5;
      doc.text(`Geplanter Drehbeginn: ${vertrag.model_drehbeginn || '-'}`, 14, y);
      y += 5;
      doc.text(`Geplantes Produktionsende: ${vertrag.model_produktionsende || '-'}`, 14, y);
      y += 5;
      doc.text(`Maximale tägliche Einsatzdauer: ${vertrag.model_max_tagesstunden || '-'} Stunden`, 14, y);

      y += 8;
      checkPageBreak(40);
      doc.setFont('helvetica', 'bold');
      doc.text('2.4 Einsatzort', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      const einsatzortArt = vertrag.model_einsatzort_art || [];
      Object.entries(einsatzortLabels).forEach(([key, label]) => {
        drawCheckbox(18, y, einsatzortArt.includes(key), label);
        y += 6;
      });
      y += 2;
      doc.text(`Adresse / Ort: ${vertrag.model_einsatzort_adresse || '-'}`, 14, y);

      y += 8;
      checkPageBreak(20);
      doc.setFont('helvetica', 'bold');
      doc.text('2.5 Optionstage', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      if (vertrag.model_optionstage) {
        doc.text(`Optionstag(e): ${vertrag.model_optionstage}`, 14, y);
        y += 5;
        doc.text('Die Buchung eines Optionstages bedarf der rechtzeitigen Bestätigung durch den Auftraggeber.', 14, y);
      } else {
        drawCheckbox(18, y, true, 'Keine Optionstage vereinbart');
      }
      y = renderZusatzBestimmung(doc, zusaetze.p2, { y, maxContentY: MAX_CONTENT_Y, onPageBreak });

      // §3 Produktionsrahmen
      y += 14;
      checkPageBreak(60);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§3 Produktionsrahmen', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);

      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.text('3.1 Geplanter Output (unverbindliche Zielgröße)', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      doc.text(`Anzahl Foto-Motive (ca.): ${vertrag.model_anzahl_foto_motive || 0}`, 14, y);
      y += 5;
      doc.text(`Anzahl Video-Sequenzen (ca.): ${vertrag.model_anzahl_video_sequenzen || 0}`, 14, y);
      y += 5;
      doc.text('Die tatsächliche Anzahl der finalen Assets liegt im Ermessen des Auftraggebers und stellt keinen', 14, y);
      y += 5;
      doc.text('Anspruch auf eine bestimmte Veröffentlichungsmenge dar.', 14, y);

      y += 8;
      checkPageBreak(50);
      doc.setFont('helvetica', 'bold');
      doc.text('3.2 Rolle des Models', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      const rolle = vertrag.model_rolle || [];
      Object.entries(rolleLabels).forEach(([key, label]) => {
        let displayLabel = label;
        if (key === 'sonstiges' && rolle.includes('sonstiges') && vertrag.model_rolle_sonstiges) {
          displayLabel = `Sonstiges: ${vertrag.model_rolle_sonstiges}`;
        }
        drawCheckbox(18, y, rolle.includes(key), displayLabel);
        y += 6;
      });

      y += 4;
      checkPageBreak(30);
      doc.setFont('helvetica', 'bold');
      doc.text('3.3 Styling', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      Object.entries(stylingLabels).forEach(([key, label]) => {
        let displayLabel = label;
        if (key === 'fitting' && vertrag.model_styling === 'fitting' && vertrag.model_fitting_datum) {
          displayLabel = `Fitting-Termin vereinbart am: ${formatDate(vertrag.model_fitting_datum)}`;
        }
        drawCheckbox(18, y, vertrag.model_styling === key, displayLabel);
        y += 6;
      });
      y = renderZusatzBestimmung(doc, zusaetze.p3, { y, maxContentY: MAX_CONTENT_Y, onPageBreak });

      addFooter();

      // ============================================
      // SEITE 3: Nutzungsrechte
      // ============================================
      doc.addPage();
      y = 20;

      // §4 Nutzungsrechte
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§4 Nutzungsrechte', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);

      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.text('4.1 Nutzungsarten', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      doc.text('Das im Rahmen der Produktion entstandene Material darf für folgende Zwecke genutzt werden:', 14, y);
      y += 6;
      const nutzungsarten = vertrag.model_nutzungsarten || [];
      Object.entries(nutzungsartenLabels).forEach(([key, label]) => {
        drawCheckbox(18, y, nutzungsarten.includes(key), label);
        y += 6;
      });

      y += 4;
      checkPageBreak(30);
      doc.setFont('helvetica', 'bold');
      doc.text('4.2 Territorium', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      Object.entries(territoriumLabels).forEach(([key, label]) => {
        drawCheckbox(18, y, vertrag.model_territorium === key, label);
        y += 6;
      });

      y += 4;
      checkPageBreak(30);
      doc.setFont('helvetica', 'bold');
      doc.text('4.3 Nutzungsdauer', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      Object.entries(nutzungsdauerLabels).forEach(([key, label]) => {
        drawCheckbox(18, y, vertrag.model_nutzungsdauer === key, label);
        y += 6;
      });
      y += 2;
      doc.text(`Beginn der Nutzungsdauer: ${formatDate(vertrag.model_nutzungsbeginn)}`, 14, y);

      y += 8;
      checkPageBreak(30);
      doc.setFont('helvetica', 'bold');
      doc.text('4.4 Exklusivität', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      Object.entries(exklLabels).forEach(([key, label]) => {
        let displayLabel = label;
        if (key !== 'keine' && vertrag.model_exklusivitaet_art === key && vertrag.model_exklusivitaet_dauer) {
          displayLabel = `${label} – Dauer: ${vertrag.model_exklusivitaet_dauer} Monate`;
        }
        drawCheckbox(18, y, vertrag.model_exklusivitaet_art === key, displayLabel);
        y += 6;
      });

      y += 4;
      checkPageBreak(15);
      doc.setFont('helvetica', 'bold');
      doc.text('4.5 Bearbeitung & Anpassung', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      doc.text('Der Auftraggeber ist berechtigt, das Bild- und Videomaterial im Rahmen des Vertragszwecks zu', 14, y);
      y += 5;
      doc.text('bearbeiten, zu kürzen, grafisch zu verändern oder mit anderen Inhalten zu kombinieren.', 14, y);

      y += 8;
      checkPageBreak(30);
      doc.setFont('helvetica', 'bold');
      doc.text('4.6 KI- und digitale Weiterverarbeitung', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      const kiNutzung = vertrag.model_ki_nutzung || [];
      Object.entries(kiLabels).forEach(([key, label]) => {
        drawCheckbox(18, y, kiNutzung.includes(key), label);
        y += 6;
      });
      y = renderZusatzBestimmung(doc, zusaetze.p4, { y, maxContentY: MAX_CONTENT_Y, onPageBreak });

      addFooter();

      // ============================================
      // SEITE 4: Vergütung, Absage, Schluss
      // ============================================
      doc.addPage();
      y = 20;

      // §5 Vergütung
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§5 Vergütung', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);

      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.text('5.1 Honorar', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      doc.text(`€ ${formatMoney(vertrag.verguetung_netto)} netto`, 14, y);
      y += 6;
      Object.entries(honorarArtLabels).forEach(([key, label]) => {
        drawCheckbox(18, y, vertrag.model_honorar_art === key, label);
        y += 6;
      });

      y += 4;
      checkPageBreak(25);
      doc.setFont('helvetica', 'bold');
      doc.text('5.2 Buyout', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      drawCheckbox(18, y, vertrag.model_buyout_inklusiv, 'Buyout im Honorar enthalten');
      y += 6;
      if (!vertrag.model_buyout_inklusiv && vertrag.model_buyout_betrag !== null && vertrag.model_buyout_betrag !== undefined) {
        doc.text(`Zusätzliches Buyout-Honorar: € ${formatMoney(vertrag.model_buyout_betrag)} netto`, 18, y);
        y += 6;
      }

      y += 4;
      checkPageBreak(25);
      doc.setFont('helvetica', 'bold');
      doc.text('5.3 Reise- und Nebenkosten', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      Object.entries(reisekostenLabels).forEach(([key, label]) => {
        drawCheckbox(18, y, vertrag.model_reisekosten === key, label);
        y += 6;
      });

      y += 4;
      checkPageBreak(15);
      doc.setFont('helvetica', 'bold');
      doc.text('5.4 Zahlungsziel', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      doc.text(`Zahlungsziel: ${zahlungszielLabels[vertrag.zahlungsziel] || '-'}`, 14, y);
      y += 5;
      doc.text('Rechnungsstellung durch das Model nach Abschluss der Produktion.', 14, y);
      y = renderZusatzBestimmung(doc, zusaetze.p5, { y, maxContentY: MAX_CONTENT_Y, onPageBreak });

      // §6 Absage & Ausfall
      y += 14;
      checkPageBreak(40);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§6 Absage & Ausfall', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);

      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.text('6.1 Wetterabhängigkeit', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      drawCheckbox(18, y, vertrag.model_wetterabhaengig, 'Produktion ist wetterabhängig');
      y += 6;
      drawCheckbox(18, y, !vertrag.model_wetterabhaengig, 'Produktion ist nicht wetterabhängig');

      y += 8;
      checkPageBreak(40);
      doc.setFont('helvetica', 'bold');
      doc.text('6.2 Absagebedingungen', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      doc.text('Bei Absage durch den Auftraggeber gelten folgende Regelungen:', 14, y);
      y += 6;
      const absageRegelung = vertrag.model_absage_regelung || [];
      drawCheckbox(18, y, absageRegelung.includes('100_24h'), '100 % Honorar bei Absage < 24 Stunden');
      y += 6;
      drawCheckbox(18, y, absageRegelung.includes('50_48h'), '50 % Honorar bei Absage < 48 Stunden');
      y += 6;
      drawCheckbox(18, y, absageRegelung.includes('individuell'), 'Individuelle Regelung');
      if (absageRegelung.includes('individuell') && vertrag.model_absage_individuell) {
        y += 6;
        doc.text(`   ${vertrag.model_absage_individuell}`, 18, y);
      }
      y = renderZusatzBestimmung(doc, zusaetze.p6, { y, maxContentY: MAX_CONTENT_Y, onPageBreak });

      // §7 Persönlichkeitsrechte
      y += 14;
      checkPageBreak(25);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§7 Persönlichkeitsrechte', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      doc.text('Das Model stimmt der Veröffentlichung der im Rahmen der Produktion entstandenen Aufnahmen', 14, y);
      y += 5;
      doc.text('gemäß den vertraglich vereinbarten Nutzungsrechten ausdrücklich zu.', 14, y);

      // §8 Schlussbestimmungen
      y += 14;
      checkPageBreak(50);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§8 Schlussbestimmungen', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      doc.text('Änderungen oder Ergänzungen dieses Vertrags bedürfen der Schriftform.', 14, y);
      y += 7;
      doc.text('Sollten einzelne Bestimmungen dieses Vertrags unwirksam sein oder werden, bleibt die Wirksamkeit', 14, y);
      y += 5;
      doc.text('der übrigen Regelungen unberührt.', 14, y);

      // Weitere Bestimmungen
      if (vertrag.weitere_bestimmungen) {
        y += 14;
        checkPageBreak(30);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Weitere Bestimmungen', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 8;
        y = renderPaginatedText(doc, vertrag.weitere_bestimmungen, { y, maxContentY: MAX_CONTENT_Y, onPageBreak });
      }

      // Unterschriften
      y += 20;
      checkPageBreak(40);
      doc.text('Ort, Datum: ___________________________', 14, y);
      y += 15;
      doc.text('Unterschrift Auftraggeber: ___________________________', 14, y);
      y += 15;
      doc.text('Model: ___________________________', 14, y);

      addFooter();

      // ============================================
      // PDF speichern und nach Dropbox hochladen
      // ============================================
      const pdfBlob = doc.output('blob');
      const filePrefix = lang === 'en' ? 'EN_Contract_Model' : 'Vertrag_Model';
      const fileName = `${filePrefix}_${vertrag.name || 'Model'}_${new Date().toISOString().split('T')[0]}.pdf`;

      const uploadResult = await uploadGeneratedVertragPdf(this, vertrag, pdfBlob, fileName);
      console.log('✅ Model-PDF nach Dropbox hochgeladen und URL gespeichert');
      doc.save(fileName);
      return uploadResult;

    } catch (error) {
      console.error('❌ Fehler bei Model-PDF-Generierung:', error);
      window.toastSystem?.show('PDF konnte nicht generiert werden', 'warning');
      throw error;
    }
};

