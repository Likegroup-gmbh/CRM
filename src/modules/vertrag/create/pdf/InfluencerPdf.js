// pdf/InfluencerPdf.js
// Influencer-Kooperationsvertrag: PDF-Generierung.

import { VertraegeCreate } from '../VertraegeCreateCore.js';

VertraegeCreate.prototype.generateInfluencerPDF = async function(vertrag, lang = this.getContractLanguage(vertrag)) {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      doc.setFont('helvetica');
      this.localizeDocText(doc, lang);

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

      // Helper: Text mit Umbruch
      const addWrappedText = (text, x, yStart, maxWidth) => {
        const localizedText = this.localizeContractText(text, lang);
        const lines = doc.splitTextToSize(localizedText, maxWidth);
        doc.text(lines, x, yStart);
        return yStart + (lines.length * 5);
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
      doc.addImage(logoBase64, 'PNG', 93.6, 10, 22.75, 12.6);

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
      doc.text(`${creatorContractAddress?.strasse || ''} ${creatorContractAddress?.hausnummer || ''}`.trim(), 105, y, { align: 'center' });
      y += 5;
      doc.text(`${creatorContractAddress?.plz || ''} ${creatorContractAddress?.stadt || ''}`.trim(), 105, y, { align: 'center' });
      y += 5;
      doc.text(`${creatorContractAddress?.land || vertrag.influencer_land || 'Deutschland'}`, 105, y, { align: 'center' });
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

      // §11 Mindest-Online-Dauer
      checkPageBreak(35);
      y += 10;
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
      y = addWrappedText('Die KSK-Abgabe wird – sofern relevant – vom Auftraggeber abgeführt und nicht gesondert auf der Rechnung des Influencers ausgewiesen.', 14, y, 180);

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

          console.log('✅ Influencer-PDF hochgeladen und URL gespeichert');
        }

        doc.save(fileName);
      }

      console.log('✅ Influencer-PDF generiert');

    } catch (error) {
      console.error('❌ Fehler bei Influencer-PDF-Generierung:', error);
      window.toastSystem?.show('PDF konnte nicht generiert werden', 'warning');
    }
};

  // ============================================
  // VIDEOGRAFEN-PRODUKTIONSVERTRAG PDF
