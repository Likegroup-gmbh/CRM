// pdf/ModelPdf.js
// Modelvertrag: PDF-Generierung.

import { VertraegeCreate } from '../VertraegeCreateCore.js';

VertraegeCreate.prototype.generateModelPDF = async function(vertrag, lang = this.getContractLanguage(vertrag)) {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      this.localizeDocText(doc, lang);

      doc.setFont('helvetica');

      const FOOTER_Y = 285;
      const MAX_CONTENT_Y = 265;

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

      const logoBase64 = await svgToPngDataUrl(logoSvg, 120, 66);

      let pageNumber = 1;

      const addFooter = () => {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text('LikeGroup GmbH | Jakob-Latscha-Str. 3 | 60314 Frankfurt am Main | Deutschland', 14, FOOTER_Y);
        doc.text(`Seite ${pageNumber}`, 196, FOOTER_Y, { align: 'right' });
        doc.setTextColor(0);
        pageNumber++;
      };

      const checkPageBreak = (neededSpace = 20) => {
        if (y > MAX_CONTENT_Y - neededSpace) {
          addFooter();
          doc.addPage();
          y = 20;
        }
      };

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

      doc.addImage(logoBase64, 'PNG', 93.6, 10, 22.75, 12.6);

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
      doc.text(`Name: ${creator?.vorname || ''} ${creator?.nachname || ''}`, 105, y, { align: 'center' });
      y += 5;
      doc.text(`${creator?.lieferadresse_strasse || ''} ${creator?.lieferadresse_hausnummer || ''}`, 105, y, { align: 'center' });
      y += 5;
      doc.text(`${creator?.lieferadresse_plz || ''} ${creator?.lieferadresse_stadt || ''}`, 105, y, { align: 'center' });
      y += 5;
      doc.text(`${vertrag.influencer_land || 'Deutschland'}`, 105, y, { align: 'center' });
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
      checkPageBreak(30);
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
      checkPageBreak(40);
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
      checkPageBreak(20);
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
      checkPageBreak(20);
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
      checkPageBreak(30);
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
        const lines = doc.splitTextToSize(vertrag.weitere_bestimmungen, 180);
        lines.forEach(line => {
          checkPageBreak(8);
          doc.text(line, 14, y);
          y += 5;
        });
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
      // PDF speichern und hochladen
      // ============================================
      const pdfBlob = doc.output('blob');
      const filePrefix = lang === 'en' ? 'EN_Contract_Model' : 'Vertrag_Model';
      const fileName = `${filePrefix}_${vertrag.name || 'Model'}_${new Date().toISOString().split('T')[0]}.pdf`;
      const filePath = vertrag.kunde_unternehmen_id
        ? `unternehmen/${vertrag.kunde_unternehmen_id}/${vertrag.id}/${fileName}`
        : `${vertrag.id}/${fileName}`;

      const { error: uploadError } = await window.supabase.storage
        .from('vertraege')
        .upload(filePath, pdfBlob, { contentType: 'application/pdf', upsert: true });

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

          console.log('✅ Model-PDF hochgeladen und URL gespeichert');
        }

        doc.save(fileName);
      }

      console.log('✅ Model-PDF generiert');

    } catch (error) {
      console.error('❌ Fehler bei Model-PDF-Generierung:', error);
      window.toastSystem?.show('PDF konnte nicht generiert werden', 'warning');
    }
};

