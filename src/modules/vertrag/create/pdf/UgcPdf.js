// pdf/UgcPdf.js
// UGC-Produktionsvertrag: PDF-Generierung.

import { VertraegeCreate } from '../VertraegeCreateCore.js';

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
      return this.generateInfluencerPDF(vertrag, lang);
    }
    
    if (vertrag.typ === 'Videograph') {
      return this.generateVideografPDF(vertrag, lang);
    }

    if (vertrag.typ === 'Model') {
      return this.generateModelPDF(vertrag, lang);
    }

    // Standard: UGC-PDF
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      this.localizeDocText(doc, lang);

      // Font auf Helvetica setzen (ähnlich Arial, in jsPDF eingebaut)
      doc.setFont('helvetica');

      // Konstanten für Fußzeile (gesperrter Bereich)
      const FOOTER_Y = 285; // Position der Fußzeile
      const MAX_CONTENT_Y = 250; // Maximale Y-Position für Content (vor Fußzeile)

      // LikeGroup Logo als SVG (wird zur Laufzeit zu PNG konvertiert)
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

      // Helper: SVG zu PNG konvertieren (für jsPDF) - verwendet data: URL statt blob:
      const svgToPngDataUrl = async (svgString, width, height) => {
        return new Promise((resolve, reject) => {
          const svgBase64 = btoa(unescape(encodeURIComponent(svgString)));
          const dataUrl = `data:image/svg+xml;base64,${svgBase64}`;
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width * 2; // Höhere Auflösung
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
        // Links: Adresse
        doc.text('LikeGroup GmbH | Jakob-Latscha-Str. 3 | 60314 Frankfurt am Main | Deutschland', 14, FOOTER_Y);
        // Rechts: Seitenzahl
        doc.text(`Seite ${pageNumber}`, 196, FOOTER_Y, { align: 'right' });
        doc.setTextColor(0);
        pageNumber++;
      };

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
      doc.text(`${creatorContractAddress?.strasse || ''} ${creatorContractAddress?.hausnummer || ''}`.trim(), 105, y, { align: 'center' });
      y += 5;
      doc.text(`${creatorContractAddress?.plz || ''} ${creatorContractAddress?.stadt || ''}`.trim(), 105, y, { align: 'center' });
      y += 5;
      doc.text(`${creatorContractAddress?.land || 'Deutschland'}`, 105, y, { align: 'center' });

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
      // 5.2 Zahlungsbedingungen - benötigt ~30mm, daher Seitenumbruch wenn nötig
      if (y > 220) {
        addFooter();
        doc.addPage();
        y = 20;
      } else {
        y += 8;
      }
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

      // §6 Deadlines & Korrekturen - Seitenumbruch wenn nötig
      if (y > MAX_CONTENT_Y) {
        addFooter();
        doc.addPage();
        y = 20;
      } else {
        y += 14;
      }
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

      // ============================================
      // SEITE 3+: Statische Paragraphen §7-§13
      // ============================================
      // Nur neue Seite wenn nicht genug Platz für §7
      if (y > MAX_CONTENT_Y) {
        addFooter();
        doc.addPage();
        y = 20;
      } else {
        y += 14;
      }

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

      // §8 Verschwiegenheit
      y += 14;
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

      // §9 Qualitätsrichtlinien & Briefings
      y += 14;
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

      // §10 Neudreh, Anpassungen & Rücktrittsrecht
      y += 14;
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

      // 10.2 Anpassungen - benötigt ~35mm, daher Seitenumbruch wenn nötig
      if (y > 215) {
        addFooter();
        doc.addPage();
        y = 20;
      } else {
        y += 8;
      }
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

      // Seitenumbruch prüfen
      if (y > MAX_CONTENT_Y) {
        addFooter();
        doc.addPage();
        y = 20;
      }

      y += 8;
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

      // §11 Agenturbeauftragung & Stellvertretung - Seitenumbruch wenn nötig
      if (y > MAX_CONTENT_Y) {
        addFooter();
        doc.addPage();
        y = 20;
      } else {
        y += 14;
      }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§11 Agenturbeauftragung & Stellvertretung', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      doc.text('• Die Agentur handelt im Namen und auf Rechnung des Kunden.', 18, y);
      y += 4;
      doc.text('• Vertragspartner des Creators ist ausschließlich der Kunde.', 18, y);
      y += 4;
      doc.text('• Sämtliche Nutzungsrechte gehen unmittelbar auf den Kunden über.', 18, y);
      y += 4;
      doc.text('• Weisungen und Abnahmen der Agentur gelten als verbindlich.', 18, y);
      y += 4;
      doc.text('• Die Agentur übernimmt keine Haftung für Inhalt oder Rechtskonformität.', 18, y);

      // Seitenumbruch prüfen für §12
      if (y > MAX_CONTENT_Y) {
        addFooter();
        doc.addPage();
        y = 20;
      } else {
        y += 14;
      }

      // §12 Schlussbestimmungen
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§12 Schlussbestimmungen', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      doc.text('Änderungen bedürfen der Schriftform. Sollten einzelne Bestimmungen unwirksam sein, bleibt der', 14, y);
      y += 4;
      doc.text('Vertrag im Übrigen wirksam.', 14, y);

      // §13 Vertragsschluss
      y += 14;
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
        y += 14;
        if (y > MAX_CONTENT_Y) {
          addFooter();
          doc.addPage();
          y = 20;
        }
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('§14 Weitere Bestimmungen', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 8;
        const weitereLines = doc.splitTextToSize(vertrag.weitere_bestimmungen, 180);
        doc.text(weitereLines, 14, y);
        y += weitereLines.length * 5;
      }

      // Unterschrift (nur Creator erforderlich)
      y += 25;
      doc.setFontSize(10);
      doc.text('Ort, Datum: ___________________________', 14, y);
      y += 15;
      doc.text('Creator: ______________________________', 14, y);

      // Fußzeile für letzte Seite
      addFooter();

      // PDF als Blob generieren
      const pdfBlob = doc.output('blob');
      const filePrefix = lang === 'en' ? 'EN_Contract' : 'Vertrag';
      const fileName = `${filePrefix}_${vertrag.name || 'UGC'}_${new Date().toISOString().split('T')[0]}.pdf`;
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
        // Fallback: Nur lokal herunterladen
        doc.save(fileName);
      } else {
        // Permanente Public URL generieren
        const { data: urlData } = window.supabase.storage
          .from('vertraege')
          .getPublicUrl(filePath);

        // URL in DB speichern
        if (urlData?.publicUrl) {
          await window.supabase
            .from('vertraege')
            .update({
              datei_url: urlData.publicUrl,
              datei_path: filePath
            })
            .eq('id', vertrag.id);

          console.log('✅ PDF hochgeladen und URL gespeichert');
        }

        // Auch lokal herunterladen
        doc.save(fileName);
      }

      console.log('✅ PDF generiert');

    } catch (error) {
      console.error('❌ Fehler bei PDF-Generierung:', error);
      window.toastSystem?.show('PDF konnte nicht generiert werden', 'warning');
    }
};

  // ============================================
  // INFLUENCER-KOOPERATIONSVERTRAG PDF
