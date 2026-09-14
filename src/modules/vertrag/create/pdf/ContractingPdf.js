// pdf/ContractingPdf.js
// Contracting-Vertrag (Influencer-Marketing-Vertrag mit LikeGroup als Auftraggeber/Durchfuehrer):
// PDF-Generierung anhand der Vorlage OLI.VORLAGE_Influencer-Marketing-Vertrag.

import { VertraegeCreate } from '../VertraegeCreateCore.js';
import { uploadGeneratedVertragPdf } from './VertragPdfUpload.js';
import { renderPaginatedText, renderZusatzBestimmung } from './PdfTextFlow.js';
import { buildContractingAuftragnehmerLines } from './ContractingAuftragnehmerLines.js';
import { loadLikeGroupLogoPng, likeGroupFooterLine } from '../../../../core/pdf/PdfBrand.js';

VertraegeCreate.prototype.generateContractingPDF = async function(vertrag, lang = this.getContractLanguage(vertrag)) {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFont('helvetica');
    this.localizeDocText(doc, lang);

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

    // Helper: Seitenumbruch für paginierten Freitext (Footer + neue Seite)
    const onPageBreak = () => {
      addFooter();
      doc.addPage();
      return 20;
    };

    // Zusätzliche Bestimmungen pro Paragraph (optional)
    const zusaetze = vertrag.paragraph_zusaetze || {};

    // Daten holen
    const kunde = this.unternehmen.find(u => u.id === vertrag.kunde_unternehmen_id);
    const creator = this.creators.find(c => c.id === vertrag.creator_id);
    const creatorName = `${creator?.vorname || ''} ${creator?.nachname || ''}`.trim();
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
      return renderPaginatedText(doc, localizedText, { x, y: yStart, maxWidth, maxContentY: MAX_CONTENT_Y, onPageBreak });
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
      werbeanzeigen: 'Werbeanzeigen (Unternehmenskanal)',
      dark_ads: 'Dark Ads',
      sonstige: 'Sonstige'
    };
    const geoLabels = {
      deutschland: 'Deutschland',
      dach: 'DACH',
      europa: 'Europa',
      global: 'Global'
    };
    const zahlungszielLabels = {
      '14_tage': '14 Tage',
      '30_tage': '30 Tage',
      '45_tage': '45 Tage',
      '60_tage': '60 Tage'
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

    // Auftragnehmer / Influencer (Toggle nur_management_adresse steuert Name/Layout)
    y += 12;
    doc.setFont('helvetica', 'bold');
    doc.text('Auftragnehmer / Influencer:', 105, y, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    y += 6;
    const auftragnehmerLines = buildContractingAuftragnehmerLines({
      vertrag,
      creator,
      address: creatorContractAddress
    });
    for (const line of auftragnehmerLines) {
      doc.text(line, 105, y, { align: 'center' });
      y += 5;
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

    // §2 Plattformen & Veroeffentlichung (Überschrift + Intro + 5 Checkboxen ≈ 55mm)
    checkPageBreak(55);
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
    y = renderZusatzBestimmung(doc, zusaetze.p2, { y, maxContentY: MAX_CONTENT_Y, onPageBreak });

    // §2a Inhalte & Kooperationsdetails (Plattformen + Formate + Details ≈ 70mm)
    checkPageBreak(70);
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
    y = renderZusatzBestimmung(doc, zusaetze.p2a, { y, maxContentY: MAX_CONTENT_Y, onPageBreak });

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
        checkPageBreak(8);
        drawCheckbox(14, y, buyoutArt.includes(key), label);
        y += 5;
      });
      if (buyoutArt.includes('sonstige') && vertrag.contracting_buyout_art_sonstige) {
        checkPageBreak(8);
        y = addWrappedText(`Sonstige: ${vertrag.contracting_buyout_art_sonstige}`, 18, y, 176);
      }

      y += 4;
      doc.text(`Nutzungsdauer: ${vertrag.contracting_buyout_nutzungsdauer || 'XXX'}`, 14, y);
      y += 6;
    }

    // Geografisch und Besonderheiten unabhaengig vom Buyout-Status anzeigen
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
    y = renderZusatzBestimmung(doc, zusaetze.p3, { y, maxContentY: MAX_CONTENT_Y, onPageBreak });

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
    y = renderZusatzBestimmung(doc, zusaetze.p5, { y, maxContentY: MAX_CONTENT_Y, onPageBreak });

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
    const zahlungszielText = zahlungszielLabels[vertrag.zahlungsziel] || '45 Tage';
    y = addWrappedText(`(3) Die Zahlung erfolgt innerhalb von ${zahlungszielText} nach Leistungserbringung und Rechnungsstellung.`, 14, y, 180);
    y += 4;
    y = addWrappedText('(4) Der Auftraggeber führt die gesetzlich vorgeschriebene Künstlersozialabgabe gemäß § 24 KSVG ab, soweit erforderlich.', 14, y, 180);
    y = renderZusatzBestimmung(doc, zusaetze.p6, { y, maxContentY: MAX_CONTENT_Y, onPageBreak });

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
    const exklVon = vertrag.contracting_exklusivitaet_von ? formatDate(vertrag.contracting_exklusivitaet_von) : null;
    const exklBis = vertrag.contracting_exklusivitaet_bis ? formatDate(vertrag.contracting_exklusivitaet_bis) : null;
    let exklSatz;
    if (exklVon && exklBis) {
      exklSatz = `Der Influencer verpflichtet sich für den Zeitraum vom ${exklVon} bis ${exklBis}, keine Kooperationen mit unmittelbaren Wettbewerbern im Bereich "${exklBereich}" einzugehen.`;
    } else if (exklVon) {
      exklSatz = `Der Influencer verpflichtet sich ab dem ${exklVon}, keine Kooperationen mit unmittelbaren Wettbewerbern im Bereich "${exklBereich}" einzugehen.`;
    } else if (exklBis) {
      exklSatz = `Der Influencer verpflichtet sich bis zum ${exklBis}, keine Kooperationen mit unmittelbaren Wettbewerbern im Bereich "${exklBereich}" einzugehen.`;
    } else {
      exklSatz = `Der Influencer verpflichtet sich für die Dauer von zwei Wochen nach Veröffentlichung des Contents, keine Kooperationen mit unmittelbaren Wettbewerbern im Bereich "${exklBereich}" einzugehen.`;
    }
    y = addWrappedText(exklSatz, 14, y, 180);
    y = renderZusatzBestimmung(doc, zusaetze.p10, { y, maxContentY: MAX_CONTENT_Y, onPageBreak });

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

    // Unterschriften (Block benötigt ~71mm ab Start, daher 90 anfordern)
    checkPageBreak(90);
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
