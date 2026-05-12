// pdf/ContractingPdf.js
// Contracting-Vertrag (Influencer-Marketing-Vertrag mit LikeGroup als Auftraggeber/Durchfuehrer):
// PDF-Generierung anhand der Vorlage OLI.VORLAGE_Influencer-Marketing-Vertrag.

import { VertraegeCreate } from '../VertraegeCreateCore.js';
import { uploadGeneratedVertragPdf } from './VertragPdfUpload.js';

VertraegeCreate.prototype.generateContractingPDF = async function(vertrag, lang = this.getContractLanguage(vertrag)) {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFont('helvetica');
    this.localizeDocText(doc, lang);

    const FOOTER_Y = 285;
    const MAX_CONTENT_Y = 265;

    // LikeGroup Logo SVG (konsistent zu InfluencerPdf)
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
<path d="M62.0331 41.4525C61.6187 40.1351 61.0132 38.8889 60.2323 37.748C57.5524 33.817 53.1035 31.4694 48.3254 31.4694C45.927 31.4694 43.595 32.078 41.5286 33.1767L59.2071 15.2815H52.3678L39.7225 28.3367V0H34.0918V41.5052H39.4251C40.8248 38.3356 44.0147 36.1171 47.7251 36.1171C51.4356 36.1171 54.6254 38.3329 56.0252 41.5052H62.0463C62.0463 41.5052 62.0410 41.4893 62.0384 41.4683C62.0384 41.4683 62.0384 41.4604 62.0331 41.4525Z" fill="#0D0D0D"/>
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

    // Daten holen
    const kunde = this.unternehmen.find(u => u.id === vertrag.kunde_unternehmen_id);
    const creator = this.creators.find(c => c.id === vertrag.creator_id);
    const creatorContractAddress = this.getResolvedCreatorContractAddress(creator, vertrag);
    const auftrag = (this.contractingAuftraege || []).find(a => a.id === vertrag.contracting_auftrag_id);

    const formatDate = (d) => this.formatContractDate(d, lang);
    const formatMoney = (v, emptyValue = '0,00') => this.formatContractMoney(v, lang, { emptyValue });

    const drawCheckbox = (x, yPos, checked, label, opts = {}) => {
      doc.rect(x, yPos - 2.5, 3, 3);
      if (checked) {
        doc.line(x + 0.5, yPos - 2, x + 2.5, yPos);
        doc.line(x + 0.5, yPos, x + 2.5, yPos - 2);
      }
      if (label) doc.text(label, x + 5, yPos);
      return opts.width || 0;
    };

    const addWrappedText = (text, x, yStart, maxWidth) => {
      const localizedText = this.localizeContractText(text, lang);
      const lines = doc.splitTextToSize(localizedText, maxWidth);
      doc.text(lines, x, yStart);
      return yStart + (lines.length * 5);
    };

    const checkPageBreak = (neededSpace) => {
      if (y + neededSpace > MAX_CONTENT_Y) {
        addFooter();
        doc.addPage();
        y = 20;
      }
    };

    // Labels
    const plattformLabels = {
      instagram: 'Instagram',
      tiktok: 'TikTok',
      youtube: 'YouTube',
      facebook: 'Facebook',
      sonstige: 'Sonstige',
      andere: 'Andere'
    };
    const formatLabels = {
      reels_tiktoks: 'Reels / TikToks',
      stories: 'Stories',
      youtube_shorts: 'YouTube Shorts',
      videos: 'Videos',
      feedpost: 'Feedpost',
      ads: 'Ads'
    };
    const buyoutArtLabels = {
      whitelisting: 'Whitelisting (Meta)',
      spark_ad: 'Spark Ad (TikTok)',
      werbeanzeigen: 'Werbeanzeigen (Unternehmenskanal)'
    };
    const geoLabels = {
      deutschland: 'Deutschland',
      dach: 'DACH',
      europa: 'Europa',
      global: 'Global'
    };

    // Daten aus DB-Spalten
    const handles = vertrag.contracting_plattformen_handles || {};
    const plattformen = vertrag.plattformen || [];
    const formate = vertrag.contracting_content_formate || [];
    const buyoutAktiv = vertrag.contracting_buyout_aktiv === true;
    const buyoutPlatts = vertrag.contracting_buyout_plattformen || [];
    const buyoutArt = vertrag.contracting_buyout_art || [];

    // ============================================
    // SEITE 1: Titel + Vertragsparteien
    // ============================================
    doc.addImage(logoBase64, 'PNG', 93.6, 10, 22.75, 12.6);

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('INFLUENCER-MARKETING-VERTRAG', 105, 54, { align: 'center' });
    doc.setFont('helvetica', 'normal');

    doc.setFontSize(10);
    doc.text(`${vertrag.name || 'Ohne Name'}`, 105, 64, { align: 'center' });

    let y = 80;

    // Auftraggeber/Durchfuehrer (LikeGroup, fest)
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Vertragspartner', 105, y, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Auftraggeber / Durchführer:', 105, y, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    y += 6;
    doc.text('LikeGroup GmbH', 105, y, { align: 'center' });
    y += 5;
    doc.text('Jakob-Latscha-Straße 3', 105, y, { align: 'center' });
    y += 5;
    doc.text('60314 Frankfurt am Main', 105, y, { align: 'center' });
    y += 5;
    doc.text('Deutschland', 105, y, { align: 'center' });

    // Auftragnehmer / Influencer
    y += 12;
    doc.setFont('helvetica', 'bold');
    doc.text('Auftragnehmer / Influencer:', 105, y, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    y += 6;
    const creatorName = `${creator?.vorname || ''} ${creator?.nachname || ''}`.trim();
    doc.text(`Name: ${creatorName || '-'}`, 105, y, { align: 'center' });
    y += 5;

    if (vertrag.influencer_agentur_vertreten) {
      doc.text(`Für Influencer (Agentur): ${vertrag.influencer_agentur_name || '-'}`, 105, y, { align: 'center' });
      y += 5;
      const aStrasse = `${vertrag.influencer_agentur_strasse || ''} ${vertrag.influencer_agentur_hausnummer || ''}`.trim();
      const aPlzStadt = `${vertrag.influencer_agentur_plz || ''} ${vertrag.influencer_agentur_stadt || ''}`.trim();
      doc.text(aStrasse || '-', 105, y, { align: 'center' });
      y += 5;
      doc.text(aPlzStadt || '-', 105, y, { align: 'center' });
      y += 5;
      doc.text(vertrag.influencer_agentur_land || 'Deutschland', 105, y, { align: 'center' });
      y += 5;
      doc.text(`Vertreten durch: ${vertrag.influencer_agentur_vertretung || '-'}`, 105, y, { align: 'center' });
    } else {
      const cStrasse = `${creatorContractAddress?.strasse || ''} ${creatorContractAddress?.hausnummer || ''}`.trim();
      const cPlzStadt = `${creatorContractAddress?.plz || ''} ${creatorContractAddress?.stadt || ''}`.trim();
      doc.text(cStrasse || '-', 105, y, { align: 'center' });
      y += 5;
      doc.text(cPlzStadt || '-', 105, y, { align: 'center' });
      y += 5;
      doc.text(creatorContractAddress?.land || vertrag.influencer_land || 'Deutschland', 105, y, { align: 'center' });
    }

    // Beguenstigter Dritter (Unternehmen aus dem Contracting-Auftrag)
    y += 12;
    doc.setFont('helvetica', 'bold');
    doc.text('Begünstigter Dritter (Unternehmen):', 105, y, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    y += 6;
    doc.text(kunde?.firmenname || '-', 105, y, { align: 'center' });
    y += 5;
    const uStrasse = `${kunde?.rechnungsadresse_strasse || ''} ${kunde?.rechnungsadresse_hausnummer || ''}`.trim();
    const uPlzStadt = `${kunde?.rechnungsadresse_plz || ''} ${kunde?.rechnungsadresse_stadt || ''}`.trim();
    doc.text(uStrasse || '-', 105, y, { align: 'center' });
    y += 5;
    doc.text(uPlzStadt || '-', 105, y, { align: 'center' });
    y += 5;
    doc.text(kunde?.rechnungsadresse_land || 'Deutschland', 105, y, { align: 'center' });

    // Auftragsbezug
    y += 12;
    doc.setFont('helvetica', 'bold');
    doc.text('Auftragsbezug:', 105, y, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    y += 6;
    const auftragLabel = (auftrag?.titel || auftrag?.auftragsname || '-');
    doc.text(`Contracting-Auftrag: ${auftragLabel}`, 105, y, { align: 'center' });
    if (auftrag?.po) {
      y += 5;
      doc.text(`PO / Auftragsnummer: ${auftrag.po}`, 105, y, { align: 'center' });
    }
    if (auftrag?.angebotsnummer) {
      y += 5;
      doc.text(`Angebotsnummer: ${auftrag.angebotsnummer}`, 105, y, { align: 'center' });
    }

    addFooter();

    // ============================================
    // SEITE 2: §1 Vertragsgegenstand + §2 Plattformen
    // ============================================
    doc.addPage();
    y = 20;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('§1 Vertragsgegenstand', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y += 8;
    y = addWrappedText(`(1) Der Influencer verpflichtet sich zur Erstellung und Veröffentlichung werblicher Inhalte (nachfolgend "Content") zugunsten des Unternehmens ${kunde?.firmenname || '-'}, ${uStrasse}, ${uPlzStadt}, ${kunde?.rechnungsadresse_land || 'Deutschland'}.`, 14, y, 180);
    y += 4;
    y = addWrappedText(`(2) Vertragspartner dieses Vertrages sind ausschließlich der Auftraggeber LikeGroup GmbH und der Auftragnehmer ${creatorName || 'XXX'}${vertrag.influencer_agentur_vertreten ? `, vertreten durch die ${vertrag.influencer_agentur_name || 'XXX'}` : ''}. Das Unternehmen ${kunde?.firmenname || '-'} ist nicht Vertragspartei.`, 14, y, 180);
    y += 4;
    y = addWrappedText(`(3) Das Unternehmen ${kunde?.firmenname || '-'} erhält jedoch als begünstigter Dritter im Sinne des § 328 BGB die in diesem Vertrag geregelten Nutzungsrechte.`, 14, y, 180);
    y += 4;
    y = addWrappedText('(4) Die gesamte Abwicklung der Kooperation, insbesondere Vergütung, erfolgt über den Auftraggeber LikeGroup GmbH.', 14, y, 180);

    // §2 Plattformen & Veroeffentlichung
    checkPageBreak(40);
    y += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('§2 Plattformen & Veröffentlichung', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y += 8;
    doc.text('Die Veröffentlichung der Inhalte erfolgt auf folgenden Social-Media-Kanälen:', 14, y);
    y += 7;

    drawCheckbox(14, y, plattformen.includes('instagram'), `Instagram: ${handles.instagram || 'XXX'}`);
    y += 6;
    drawCheckbox(14, y, plattformen.includes('tiktok'), `TikTok: ${handles.tiktok || 'XXX'}`);
    y += 6;
    drawCheckbox(14, y, plattformen.includes('youtube'), `YouTube: ${handles.youtube || 'XXX'}`);
    y += 6;
    drawCheckbox(14, y, plattformen.includes('facebook'), `Facebook${plattformen.includes('facebook') && handles.facebook ? `: ${handles.facebook}` : ''}`);
    y += 6;
    const sonstigeText = plattformen.includes('sonstige')
      ? `Weitere Kanäle: ${vertrag.plattformen_sonstige || handles.weitere || ''}`
      : 'Weitere Kanäle: __________________________________';
    drawCheckbox(14, y, plattformen.includes('sonstige'), sonstigeText);

    // §2a Inhalte & Kooperationsdetails
    checkPageBreak(60);
    y += 12;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('§2a Inhalte & Kooperationsdetails Influencer-Posting & Storys', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Plattformen:', 14, y);
    doc.setFont('helvetica', 'normal');
    y += 6;
    let cbX = 14;
    ['instagram', 'tiktok', 'youtube', 'facebook'].forEach((p) => {
      drawCheckbox(cbX, y, plattformen.includes(p), plattformLabels[p]);
      cbX += 36;
    });
    y += 6;
    if (plattformen.includes('sonstige')) {
      doc.text(`Sonstige: ${vertrag.plattformen_sonstige || '-'}`, 14, y);
      y += 6;
    }

    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('Content-Formate:', 14, y);
    doc.setFont('helvetica', 'normal');
    y += 6;
    cbX = 14;
    let cbCount = 0;
    Object.entries(formatLabels).forEach(([key, label]) => {
      drawCheckbox(cbX, y, formate.includes(key), label);
      cbCount++;
      cbX += 36;
      if (cbCount % 3 === 0) {
        cbX = 14;
        y += 6;
      }
    });
    if (cbCount % 3 !== 0) y += 6;

    y += 4;
    doc.text(`Anzahl Inhalte: ${vertrag.contracting_anzahl_inhalte || 'XXX'}`, 14, y);
    y += 6;
    doc.text(`Datum / Zeitraum der Veröffentlichung: ${vertrag.contracting_veroeffentlichung_zeitraum || 'XXX'}`, 14, y);

    // §3 Media Buyout
    checkPageBreak(70);
    y += 12;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('§3 Nutzung für zusätzliche Ad-Ausspielung / Werbung (Media Buyout)', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y += 8;
    drawCheckbox(14, y, buyoutAktiv, 'Ja');
    drawCheckbox(40, y, !buyoutAktiv, 'Nein');
    y += 8;

    if (buyoutAktiv) {
      doc.setFont('helvetica', 'bold');
      doc.text('Plattformen:', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      cbX = 14;
      ['instagram', 'facebook', 'tiktok', 'andere'].forEach((p) => {
        drawCheckbox(cbX, y, buyoutPlatts.includes(p), plattformLabels[p]);
        cbX += 36;
      });
      y += 8;

      doc.setFont('helvetica', 'bold');
      doc.text('Art:', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      Object.entries(buyoutArtLabels).forEach(([key, label]) => {
        drawCheckbox(14, y, buyoutArt.includes(key), label);
        y += 5;
      });

      y += 4;
      doc.text(`Nutzungsdauer: ${vertrag.contracting_buyout_nutzungsdauer || 'XXX'}`, 14, y);
      y += 6;

      checkPageBreak(35);
      doc.setFont('helvetica', 'bold');
      doc.text('Geografisch:', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      cbX = 14;
      Object.entries(geoLabels).forEach(([key, label]) => {
        drawCheckbox(cbX, y, vertrag.contracting_buyout_geografisch === key, label);
        cbX += 32;
      });
      y += 8;

      if (vertrag.contracting_buyout_besonderheiten) {
        checkPageBreak(25);
        doc.setFont('helvetica', 'bold');
        doc.text('Besonderheiten / Absprachen:', 14, y);
        doc.setFont('helvetica', 'normal');
        y += 6;
        y = addWrappedText(vertrag.contracting_buyout_besonderheiten, 14, y, 180);
      }
    }

    // §4 Rechteübertragung
    checkPageBreak(60);
    y += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('§4 Rechteübertragung', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y += 8;
    y = addWrappedText(`(1) Wird dem § 3 des Vertrages zur Nutzung für Werbung zugestimmt, überträgt der Influencer dem Unternehmen ${kunde?.firmenname || '-'}, als begünstigtem Dritten, für die gewählte Nutzungsdauer ein einfaches Nutzungsrecht am erstellten Content.`, 14, y, 180);
    y += 4;
    y = addWrappedText('(2) Die Nutzungsdauer und Verwendung des einfachen Nutzungsrechts am erstellten Content richten sich dabei nach den Angaben und Markierungen im § 3 des Vertrages.', 14, y, 180);
    y += 4;
    y = addWrappedText('(3) Die Inhalte dürfen zum Zwecke der vertragsgemäßen Nutzung technisch bearbeitet und angepasst werden. Inhaltliche Veränderungen, die den Charakter, die Aussage oder den wirtschaftlichen Zweck der Inhalte wesentlich beeinträchtigen oder entstellen, sind unzulässig.', 14, y, 180);
    y += 4;
    y = addWrappedText('(4) Nach Ablauf der Nutzungsdauer erlischt das Nutzungsrecht.', 14, y, 180);
    y += 4;
    y = addWrappedText('(5) Eine Weitergabe an Dritte erfolgt nur mit Zustimmung des Influencers.', 14, y, 180);

    // §5 Produktion & Freigabe
    checkPageBreak(70);
    y += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('§5 Produktion & Freigabe', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y += 8;
    y = addWrappedText(`(1) Der Influencer erstellt den Content eigenständig unter Beachtung der Briefings und Skripts, die mit den Ansprechpartner ${kunde?.firmenname || '-'} oder LikeGroup GmbH abgestimmt wurden oder werden.`, 14, y, 180);
    y += 4;
    y = addWrappedText('(2) Der Content ist vor Veröffentlichung zur Freigabe vorzulegen.', 14, y, 180);
    y += 4;
    y = addWrappedText(`(3) Deadlines und Inhalte richten sich nach dem Unternehmen ${kunde?.firmenname || '-'} oder dem Auftraggeber LikeGroup GmbH und sind einzuhalten.`, 14, y, 180);
    y += 4;
    doc.text(`Voraussichtliche Veröffentlichung des Inhaltes: ${vertrag.contracting_veroeffentlichungsdatum || 'XXX'}`, 14, y);
    y += 6;
    const korrekturText = vertrag.korrekturschleifen
      ? `(4) Es werden maximal ${vertrag.korrekturschleifen} Korrekturschleife${vertrag.korrekturschleifen > 1 ? 'n' : ''} vereinbart.`
      : '(4) Es werden maximal zwei Korrekturschleifen vereinbart.';
    y = addWrappedText(korrekturText, 14, y, 180);

    // §6 Verguetung
    checkPageBreak(50);
    y += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('§6 Vergütung', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y += 8;
    y = addWrappedText(`(1) Der Influencer erhält für die vertragsgemäße Leistungserbringung eine Geldvergütung in Höhe von ${formatMoney(vertrag.verguetung_netto)} EUR netto.`, 14, y, 180);
    y += 4;
    y = addWrappedText('(2) Ein Anspruch auf darüberhinausgehende Vergütung, insbesondere in Form von Sachleistungen, besteht nicht.', 14, y, 180);
    y += 4;
    y = addWrappedText('(3) Die Zahlung erfolgt innerhalb von 45 Tagen nach Leistungserbringung und Rechnungsstellung.', 14, y, 180);
    y += 4;
    y = addWrappedText('(4) Der Auftraggeber führt die gesetzlich vorgeschriebene Künstlersozialabgabe gemäß § 24 KSVG ab, soweit erforderlich.', 14, y, 180);

    // §7 Bereitstellung von Produkten
    checkPageBreak(70);
    y += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('§7 Bereitstellung von Produkten / Arbeitsmitteln', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y += 8;
    y = addWrappedText('(1) Zur Durchführung der vertraglich geschuldeten Leistungen können dem Influencer Produkte zur Verfügung gestellt werden.', 14, y, 180);
    y += 4;
    y = addWrappedText(`(2) Die Bereitstellung erfolgt im Rahmen der Zusammenarbeit regelmäßig durch das Unternehmen ${kunde?.firmenname || '-'}. Der Auftraggeber LikeGroup GmbH übernimmt insoweit keine Verpflichtung zur Bereitstellung bestimmter Produkte.`, 14, y, 180);
    y += 4;
    y = addWrappedText('(3) Der Versand der Produkte und die dazugehörige Abwicklung erfolgt durch den Auftraggeber LikeGroup GmbH.', 14, y, 180);
    y += 4;
    y = addWrappedText('(4) Die zur Verfügung gestellten Produkte dienen ausschließlich der Unterstützung der Leistungserbringung und stellen keine Vergütung dar.', 14, y, 180);
    y += 4;
    y = addWrappedText(`(5) Ein Anspruch des Influencers auf Bereitstellung bestimmter Produkte besteht nicht. Ebenso wird durch die Bereitstellung kein eigenständiges Vertragsverhältnis zwischen Influencer und dem Unternehmen ${kunde?.firmenname || '-'} begründet.`, 14, y, 180);
    y += 4;
    y = addWrappedText('(6) Sofern nicht ausdrücklich etwas anderes vereinbart wird, ist der Influencer berechtigt, die überlassenen Produkte nach Durchführung der Zusammenarbeit zu behalten. Ein Anspruch hierauf besteht jedoch nicht.', 14, y, 180);

    // §8 Steuerliche Behandlung
    checkPageBreak(50);
    y += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('§8 Steuerliche Behandlung', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y += 8;
    y = addWrappedText('(1) Der Influencer ist für die ordnungsgemäße Versteuerung seiner Einnahmen selbst verantwortlich.', 14, y, 180);
    y += 4;
    y = addWrappedText('(2) Die Parteien sind sich einig, dass die Bereitstellung von Produkten grundsätzlich zur Unterstützung der Leistungserbringung erfolgt und keinen Vergütungscharakter hat.', 14, y, 180);
    y += 4;
    y = addWrappedText('(3) Soweit die Überlassung von Produkten im Einzelfall als geldwerter Vorteil oder steuerpflichtige Einnahme zu qualifizieren ist, obliegt die steuerliche Behandlung allein beim Influencer.', 14, y, 180);
    y += 4;
    y = addWrappedText('(4) Eine pauschale Versteuerung durch die Agentur oder das Unternehmen, insbesondere nach § 37b EStG, erfolgt nicht.', 14, y, 180);

    // §9 Pflichten des Influencers
    checkPageBreak(70);
    y += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('§9 Pflichten des Influencers', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y += 8;
    doc.text('(1) Der Influencer verpflichtet sich:', 14, y);
    y += 5;
    const pflichten = [
      '- zur vertragsgemäßen Content-Erstellung',
      '- zur Einhaltung des Briefings, Dos and Donts sowie Skript',
      '- Inhalte in hochwertiger Bild- und Tonqualität zu erstellen und',
      '- den Upload via (z.B. Drive / WeTransfer / E-Mail) zu tätigen.',
      '  Der Datentransfer via Social Media oder WhatsApp ist nicht gestattet.',
      '- wenn möglich, die Form der Dateibenennung zu berücksichtigen:',
      '  [UNTERNEHMEN_CREATOR_VIDEOX_VERSIONY]',
      '- zur ordnungsgemäßen Werbekennzeichnung („Werbung" / „Anzeige")',
      '- zur Beachtung von Urheber-, Marken- und Persönlichkeitsrechten.'
    ];
    pflichten.forEach(line => {
      checkPageBreak(8);
      doc.text(line, 18, y);
      y += 5;
    });
    y += 2;
    y = addWrappedText('(2) Der Influencer verwendet keine fremden Inhalte ohne entsprechende Rechte.', 14, y, 180);

    // §10 Exklusivitaet
    checkPageBreak(30);
    y += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('§10 Exklusivität', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y += 8;
    const exklBereich = vertrag.contracting_exklusivitaet_bereich || 'XXX';
    y = addWrappedText(`Der Influencer verpflichtet sich für die Dauer von zwei Wochen nach Veröffentlichung des Contents, keine Kooperationen mit unmittelbaren Wettbewerbern im Bereich "${exklBereich}" einzugehen.`, 14, y, 180);

    // §11 Leistungsstoerungen
    checkPageBreak(40);
    y += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('§11 Leistungsstörungen', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y += 8;
    y = addWrappedText(`(1) Der Auftraggeber LikeGroup GmbH und das Unternehmen ${kunde?.firmenname || '-'} sind berechtigt, im Rahmen der Abstimmung der Inhalte Nachbesserungen und Anpassungen zu verlangen.`, 14, y, 180);
    y += 4;
    y = addWrappedText('(2) Die Geltendmachung weitergehender Rechte, insbesondere Vergütungskürzung, Rücktritt oder Schadensersatz, erfolgt ausschließlich durch den Auftraggeber LikeGroup GmbH.', 14, y, 180);
    y += 4;
    y = addWrappedText('(3) Bei vollständiger Nichterfüllung entfällt der Vergütungsanspruch.', 14, y, 180);

    // §12 Haftung
    checkPageBreak(40);
    y += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('§12 Haftung', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y += 8;
    y = addWrappedText('(1) Der Influencer haftet für Schäden aus der Verletzung wesentlicher Vertragspflichten.', 14, y, 180);
    y += 4;
    y = addWrappedText(`(2) Der Influencer stellt den Auftraggeber und das Unternehmen ${kunde?.firmenname || '-'} von sämtlichen Ansprüchen Dritter frei, die aus einer Verletzung der Urheber-, Marken- und Persönlichkeitsrechten resultieren, sofern der Influencer die Rechtsverletzung zu vertreten hat.`, 14, y, 180);
    y += 4;
    y = addWrappedText('(3) Die Haftung ist auf Vorsatz und grobe Fahrlässigkeit beschränkt, soweit gesetzlich zulässig.', 14, y, 180);

    // §13 Datenschutz & Vertraulichkeit
    checkPageBreak(30);
    y += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('§13 Datenschutz & Vertraulichkeit', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y += 8;
    y = addWrappedText('(1) Beide Parteien halten die DSGVO ein.', 14, y, 180);
    y += 4;
    y = addWrappedText('(2) Vertraulichkeit gilt auch über das Vertragsende hinaus.', 14, y, 180);

    // §14 Schlussbestimmungen + Unterschriften: erzwungene neue Seite
    addFooter();
    doc.addPage();
    y = 20;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('§14 Schlussbestimmungen & Zusätzliche Informationen', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y += 8;
    y = addWrappedText('(1) Änderungen bedürfen der Schriftform.', 14, y, 180);
    y += 4;
    y = addWrappedText('(2) Es gilt deutsches Recht.', 14, y, 180);
    y += 4;
    y = addWrappedText('(3) Gerichtsstand: Frankfurt am Main.', 14, y, 180);
    y += 4;
    y = addWrappedText('(4) Der Auftragnehmer handelt als Unternehmer im Sinne des § 14 BGB.', 14, y, 180);
    y += 4;
    y = addWrappedText('(5) Sollten einzelne Bestimmungen unwirksam sein, bleibt der Vertrag im Übrigen wirksam.', 14, y, 180);

    // Weitere Bestimmungen (optional)
    if (vertrag.weitere_bestimmungen) {
      checkPageBreak(30);
      y += 10;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Weitere Bestimmungen', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      y = addWrappedText(vertrag.weitere_bestimmungen, 14, y, 180);
    }

    // Unterschriften
    checkPageBreak(60);
    y += 15;
    doc.text('Ort: __________________________', 14, y);
    y += 7;
    doc.text('Datum: __________________________', 14, y);
    y += 12;
    doc.text('Unterschrift LikeGroup GmbH: _______________________________', 14, y);
    y += 18;
    doc.text('Ort: __________________________', 14, y);
    y += 7;
    doc.text('Datum: __________________________', 14, y);
    y += 12;
    doc.text('Unterschrift Auftragnehmer: _______________________________', 14, y);

    addFooter();

    // PDF speichern + Upload
    const pdfBlob = doc.output('blob');
    const filePrefix = lang === 'en' ? 'EN_Contract_Contracting' : 'Vertrag_Contracting';
    const fileName = `${filePrefix}_${vertrag.name || 'Contracting'}_${new Date().toISOString().split('T')[0]}.pdf`;

    const uploadResult = await uploadGeneratedVertragPdf(this, vertrag, pdfBlob, fileName);
    if (uploadResult?.fileUrl) {
      console.log('✅ Contracting-PDF nach Dropbox hochgeladen und URL gespeichert');
    } else {
      console.warn('⚠️ Dropbox-Upload nicht erfolgreich – PDF wird nur lokal heruntergeladen');
    }
    doc.save(fileName);

    console.log('✅ Contracting-PDF generiert');

  } catch (error) {
    console.error('❌ Fehler bei Contracting-PDF-Generierung:', error);
    window.toastSystem?.show('PDF konnte nicht generiert werden', 'warning');
  }
};
