// pdf/AwarenessPdf.js
// BURGA "Awareness"-Influencer-Vertrag: bilinguale (EN links / DE rechts) PDF-Generierung.
// Eigenes zweispaltiges Layout, unabhaengig von der Standard-Influencer-PDF und den
// ContractTranslations. Statischer Rechtstext hardcoded, dynamische Werte aus
// vertrag.* + vertrag.awareness_felder.*

import { VertraegeCreate } from '../VertraegeCreateCore.js';
import { uploadGeneratedVertragPdf } from './VertragPdfUpload.js';

VertraegeCreate.prototype.generateAwarenessPDF = async function(vertrag, lang = this.getContractLanguage(vertrag)) {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFont('helvetica');

    // ============================================
    // Daten & dynamische Werte
    // ============================================
    const af = vertrag.awareness_felder || {};
    const kunde = this.unternehmen.find(u => u.id === vertrag.kunde_unternehmen_id) || {};
    const creator = this.creators.find(c => c.id === vertrag.creator_id) || {};
    const creatorAddr = this.getResolvedCreatorContractAddress(creator, vertrag) || {};

    const ph = (v, len = 20) => {
      const s = (v === null || v === undefined) ? '' : String(v).trim();
      return s !== '' ? s : '_'.repeat(len);
    };

    const platLabels = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube' };
    const platLabel = (p) => p === 'sonstige'
      ? (vertrag.plattformen_sonstige || (lang === 'en' ? 'Other' : 'Sonstige'))
      : (platLabels[p] || p);
    const plattformenText = (vertrag.plattformen || []).map(platLabel).join(', ')
      || (lang === 'en' ? 'TikTok' : 'TikTok');

    const buildDeliverables = () => {
      const parts = [];
      const r = vertrag.anzahl_reels || 0;
      const f = vertrag.anzahl_feed_posts || 0;
      const s = vertrag.anzahl_storys || 0;
      const plat = (vertrag.plattformen || []).map(platLabel).join('/') || 'TikTok';
      if (r) parts.push(lang === 'en' ? `${r} ${plat} video(s)` : `${r} ${plat} Video(s)`);
      if (f) parts.push(lang === 'en' ? `${f} feed post(s)` : `${f} Feed-Post(s)`);
      if (s) parts.push(lang === 'en' ? `${s} story slide(s)` : `${s} Story-Slide(s)`);
      return parts.join(', ') || (lang === 'en' ? '1 TikTok video' : '1 TikTok Video');
    };
    const deliverablesText = buildDeliverables();

    const formatDate = (d) => (d ? this.formatContractDate(d, lang) : null);
    const money = (v) => this.formatContractMoney(v, lang, { emptyValue: '__________' });
    const verguetungBetrag = (af.verguetung_brutto !== null && af.verguetung_brutto !== undefined)
      ? af.verguetung_brutto
      : vertrag.verguetung_netto;

    const zahlungszielTage = { '14_tage': 14, '30_tage': 30, '45_tage': 45 }[vertrag.zahlungsziel] || 30;

    const zahlungsmethodeText = (() => {
      const m = af.zahlungsmethode;
      if (lang === 'en') {
        return m === 'paypal' ? 'PayPal'
          : m === 'banktransfer' ? 'bank transfer'
          : 'bank transfer or PayPal';
      }
      return m === 'paypal' ? 'PayPal'
        : m === 'banktransfer' ? 'Banküberweisung'
        : 'Banküberweisung oder PayPal';
    })();

    const aufbewahrungText = (() => {
      const a = af.content_aufbewahrung_dauer || '12_monate';
      if (lang === 'en') {
        return a === '6_monate' ? '6 (six) months'
          : a === 'individuell' ? 'the agreed period'
          : '1 (one) year';
      }
      return a === '6_monate' ? '6 (sechs) Monate'
        : a === 'individuell' ? 'den vereinbarten Zeitraum'
        : '1 (ein) Jahr';
    })();

    const videoLen = af.video_mindestlaenge_sekunden;
    const statistikFrist = af.statistik_frist_tage;
    const contentVorlauf = af.content_vorlauf_tage || 3;
    const kuendigungsfrist = af.kuendigungsfrist_tage || 30;
    const brandTag = af.brand_tag || '';
    const veroeffentlichungsfrist = formatDate(af.veroeffentlichungsfrist);
    const tiktokHandle = (vertrag.influencer_profile || []).find(p => /tiktok/i.test(p))
      || creator.tiktok || '';

    // ============================================
    // Layout-Konstanten
    // ============================================
    const LEFT_X = 14;      // EN-Spalte
    const RIGHT_X = 109;    // DE-Spalte
    const COL_W = 87;       // Spaltenbreite
    const FULL_W = 182;     // volle Breite
    const TOP_Y = 20;
    const MAX_CONTENT_Y = 275;
    const FOOTER_Y = 288;
    const LH = 4;           // Zeilenhoehe Fliesstext
    const LH_H = 4.6;       // Zeilenhoehe Ueberschrift

    let pageNumber = 1;
    let y = TOP_Y;

    const setBody = () => { doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); };
    const setHead = () => { doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); };

    const addFooter = () => {
      const prevSize = doc.getFontSize();
      const prevFont = doc.getFont();
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120);
      const footerLabel = kunde.firmenname
        ? `${kunde.firmenname}`
        : 'Influencer Agreement';
      doc.text(footerLabel, LEFT_X, FOOTER_Y);
      doc.text(`${lang === 'en' ? 'Page' : 'Seite'} ${pageNumber}`, 196, FOOTER_Y, { align: 'right' });
      doc.setTextColor(0);
      doc.setFontSize(prevSize);
      doc.setFont(prevFont.fontName, prevFont.fontStyle);
      pageNumber++;
    };

    const newPage = () => {
      addFooter();
      doc.addPage();
      y = TOP_Y;
      return y;
    };

    // Bilingualer Absatz: EN links, DE rechts, Zeilenumbruch + Seitenumbruch
    const row = (en, de, opts = {}) => {
      const gap = opts.gap ?? 1.5;
      setBody();
      const enLines = doc.splitTextToSize(en || '', COL_W);
      const deLines = doc.splitTextToSize(de || '', COL_W);
      const rows = Math.max(enLines.length, deLines.length);
      if (y + rows * LH > MAX_CONTENT_Y) y = newPage();
      for (let i = 0; i < rows; i++) {
        if (enLines[i]) doc.text(enLines[i], LEFT_X, y + i * LH);
        if (deLines[i]) doc.text(deLines[i], RIGHT_X, y + i * LH);
      }
      y += rows * LH + gap;
    };

    // Bilinguale Ueberschrift (fett)
    const heading = (en, de, opts = {}) => {
      const topGap = opts.topGap ?? 3;
      y += topGap;
      setHead();
      const enLines = doc.splitTextToSize(en || '', COL_W);
      const deLines = doc.splitTextToSize(de || '', COL_W);
      const rows = Math.max(enLines.length, deLines.length);
      if (y + rows * LH_H > MAX_CONTENT_Y) y = newPage();
      for (let i = 0; i < rows; i++) {
        if (enLines[i]) doc.text(enLines[i], LEFT_X, y + i * LH_H);
        if (deLines[i]) doc.text(deLines[i], RIGHT_X, y + i * LH_H);
      }
      y += rows * LH_H + 1.5;
      setBody();
    };

    // Volle Breite (Titel etc.), zentriert
    const centered = (text, size, style, dy = 0) => {
      doc.setFont('helvetica', style || 'normal');
      doc.setFontSize(size);
      y += dy;
      doc.text(text, 105, y, { align: 'center' });
    };

    // Unterschriftenblock (Unternehmen + Influencer), zweispaltig, mit Umbruchschutz
    const signatureBlock = (startY) => {
      let sy = startY;
      const NEEDED = 62;
      if (sy + NEEDED > MAX_CONTENT_Y) {
        sy = newPage();
      } else {
        sy += 10;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(lang === 'en' ? 'FOR AND ON BEHALF OF THE COMPANY' : 'FÜR UND IM NAMEN DES UNTERNEHMENS', LEFT_X, sy);
      doc.text(lang === 'en' ? 'FOR AND ON BEHALF OF THE INFLUENCER' : 'FÜR UND IM NAMEN DES INFLUENCERS', RIGHT_X, sy);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      sy += 10;
      const labels = lang === 'en'
        ? ['[Name]', '[Title]', '[Date]', '[Signature]']
        : ['[Name]', '[Titel]', '[Datum]', '[Unterschrift]'];
      labels.forEach((lab) => {
        doc.text(`_____________________________  ${lab}`, LEFT_X, sy);
        doc.text(`_____________________________  ${lab}`, RIGHT_X, sy);
        sy += 11;
      });
      return sy;
    };

    // ============================================
    // SEITE 1: Titel + Praeambel + Parteien
    // ============================================
    centered(lang === 'en' ? 'INFLUENCER AGREEMENT' : 'INFLUENCER-VERTRAG', 16, 'bold');
    y += 7;
    centered(`${lang === 'en' ? 'Date' : 'Datum'}: ${ph(formatDate(af.vertrag_datum), 14)}`, 10, 'normal');
    y += 8;

    setBody();
    heading('WHEREAS:', 'AUSGANGSLAGE:', { topGap: 0 });
    row(
      '(A) The Company is a manufacturer and distributor of cases for mobile phones, laptops, tablets and others;',
      '(A) Das Unternehmen ist ein Hersteller und Vertreiber von Schutzhüllen für Handys, Laptops, Tablets und ähnliches;'
    );
    row(
      '(B) The Influencer is a person engaged in marketing who, by his or her reputation, influences the choice of buyers;',
      '(B) Der Influencer ist eine im Marketing tätige Person, die durch ihren Ruf die Entscheidung der Käufer beeinflusst;'
    );
    row(
      '(C) The Company seeks to promote its product through the Influencer\u2019s social media outlets.',
      '(C) Das Unternehmen versucht, sein Produkt über die sozialen Medien durch den Influencer zu bewerben.'
    );
    row(
      'AGREED TO ENTER INTO AGREEMENT UNDER THESE CONDITIONS:',
      'ES WURDE ZUGESTIMMT, UNTER DIESEN BEDINGUNGEN EIN ABKOMMEN ZU SCHLIESSEN:'
    );

    // Parteien: UNTERNEHMEN
    heading('COMPANY', 'UNTERNEHMEN');
    row(
      `Company name: ${ph(kunde.firmenname)}`,
      `Firmenname: ${ph(kunde.firmenname)}`,
      { gap: 0.5 }
    );
    row(`Reg. code: ${ph('', 16)}`, `Reg.-Code: ${ph('', 16)}`, { gap: 0.5 });
    row(`VAT ID: ${ph('', 16)}`, `USt-IdNr.: ${ph('', 16)}`, { gap: 0.5 });
    row(
      `Address: ${ph(`${kunde.rechnungsadresse_strasse || ''} ${kunde.rechnungsadresse_hausnummer || ''}`.trim())}, ${ph(`${kunde.rechnungsadresse_plz || ''} ${kunde.rechnungsadresse_stadt || ''}`.trim())}`,
      `Adresse: ${ph(`${kunde.rechnungsadresse_strasse || ''} ${kunde.rechnungsadresse_hausnummer || ''}`.trim())}, ${ph(`${kunde.rechnungsadresse_plz || ''} ${kunde.rechnungsadresse_stadt || ''}`.trim())}`,
      { gap: 0.5 }
    );
    row(`Contact email: ${ph(af.ansprechpartner_email, 18)}`, `Kontakt-Email: ${ph(af.ansprechpartner_email, 18)}`, { gap: 0.5 });
    row(
      `Represented by: ${ph('', 18)}`,
      `Vertreten durch: ${ph('', 18)}`
    );

    // Parteien: INFLUENCER
    heading('INFLUENCER', 'INFLUENCER');
    const creatorName = `${creator.vorname || ''} ${creator.nachname || ''}`.trim();
    row(`Name / Agency: ${ph(creatorName)}`, `Name / Agentur: ${ph(creatorName)}`, { gap: 0.5 });
    const creatorAddrLine = `${creatorAddr.strasse || ''} ${creatorAddr.hausnummer || ''}`.trim();
    const creatorAddrLine2 = `${creatorAddr.plz || ''} ${creatorAddr.stadt || ''}`.trim();
    row(
      `Address: ${ph([creatorAddrLine, creatorAddrLine2, creatorAddr.land].filter(Boolean).join(', '))}`,
      `Adresse: ${ph([creatorAddrLine, creatorAddrLine2, creatorAddr.land].filter(Boolean).join(', '))}`,
      { gap: 0.5 }
    );
    row(`Reg. code: ${ph(af.influencer_reg_code, 16)}`, `Reg.-Code: ${ph(af.influencer_reg_code, 16)}`, { gap: 0.5 });
    row(`VAT ID / Tax ID: ${ph(af.influencer_ust_id, 16)}`, `USt-IdNr. / Steuer-IdNr.: ${ph(af.influencer_ust_id, 16)}`, { gap: 0.5 });
    row(`Contact email: ${ph(creator.email, 18)}`, `Kontakt-Email: ${ph(creator.email, 18)}`);

    // ============================================
    // SPECIAL TERMS
    // ============================================
    newPage();
    setBody();
    centered('SPECIAL TERMS', 12, 'bold');
    y += 4;
    doc.text('SONDERBEDINGUNGEN', 105, y, { align: 'center' });
    y += 8;
    setBody();

    // 1. Object of agreement
    heading('1. OBJECT OF AGREEMENT', '1. VERTRAGSGEGENSTAND', { topGap: 0 });
    row(
      '1.1. The Company herewith appoints the Influencer as its promoter to promote the Company\u2019s products and brands (hereinafter \u2013 Products).',
      '1.1. Das Unternehmen ernennt hiermit den Influencer als seinen Promoter, um die Produkte und Marken des Unternehmens (im Folgenden Produkte) zu bewerben.'
    );
    row(
      '1.2. The Influencer undertakes to promote Products through the following platform(s) under these conditions:',
      '1.2. Der Influencer verpflichtet sich, unter diesen Bedingungen Produkte über die folgende(n) Plattform(en) zu bewerben:'
    );
    row(`1.2.1. ${plattformenText};`, `1.2.1. ${plattformenText};`);
    row(`1.2.2. Deliverables: ${deliverablesText};`, `1.2.2. Lieferumfang: ${deliverablesText};`);
    row(
      `1.2.3. Video content has to be at least ${ph(videoLen, 4)} seconds long;`,
      `1.2.3. Video-Inhalte müssen mindestens ${ph(videoLen, 4)} Sekunden lang sein;`
    );
    row(
      `1.2.4. Content has to be published no later than ${ph(veroeffentlichungsfrist, 12)};`,
      `1.2.4. Der Inhalt muss bis spätestens ${ph(veroeffentlichungsfrist, 12)} veröffentlicht werden;`
    );
    row(
      '1.2.5. The creative concept has to be discussed and confirmed by the Company before filming.',
      '1.2.5. Das kreative Konzept muss vor dem Filmen mit dem Unternehmen abgesprochen und bestätigt werden.'
    );

    // 2. Payment and transfer
    heading('2. PAYMENT AND TRANSFER', '2. ZAHLUNG UND ÜBERWEISUNG');
    row(
      `2.1. For the Services named in this Agreement, the Company agrees to pay the Influencer ${money(verguetungBetrag)} \u20ac (all fees and taxes included). The Influencer agrees that this payment shall be the sole and entire compensation received.`,
      `2.1. Für die in diesem Vertrag genannten Dienstleistungen erklärt sich das Unternehmen bereit, dem Influencer ${money(verguetungBetrag)} \u20ac (alle Gebühren und Steuern enthalten) zu zahlen. Der Influencer erklärt sich damit einverstanden, dass diese Zahlung die einzige und gesamte Vergütung ist.`
    );
    row(
      '2.2. No payments will be made until the Influencer\u2019s Content has been approved by the Company.',
      '2.2. Es werden keine Zahlungen geleistet, bevor der Inhalt des Influencers vom Unternehmen genehmigt wurde.'
    );
    row(
      `2.3. Payment shall be made via ${zahlungsmethodeText} within ${zahlungszielTage} days of receipt of a respective invoice from the Influencer. If the Parties do not agree on an invoice date, the payment will be due thirty (30) days after completion of the Agreement.`,
      `2.3. Die Zahlung erfolgt per ${zahlungsmethodeText} innerhalb von ${zahlungszielTage} Tagen nach Erhalt einer entsprechenden Rechnung des Influencers. Einigen sich die Parteien nicht auf ein Rechnungsdatum, wird die Zahlung dreißig (30) Tage nach Abschluss des Vertrags fällig.`
    );
    row(
      '2.4. The Company is responsible for paying all relevant taxes by sending the transfer and is not responsible for any additional fees that may occur in the Influencer\u2019s country of residence.',
      '2.4. Das Unternehmen ist für die Zahlung aller relevanten Steuern bei der Überweisung verantwortlich und nicht für zusätzliche Gebühren, die im Wohnsitzland des Influencers anfallen können.'
    );
    row(
      `2.5. The collaboration shall be considered fully completed only upon delivery of all agreed content and provision of performance analytics (e.g. reach, impressions, clicks, engagement). These statistics must be provided to the Company within ${ph(statistikFrist, 4)} calendar days after the final post is published. The Influencer may issue an invoice only after all deliverables, including the required statistics, have been submitted in full.`,
      `2.5. Die Zusammenarbeit gilt erst dann als vollständig abgeschlossen, wenn alle vereinbarten Inhalte geliefert und Leistungsanalysen (z. B. Reichweite, Impressionen, Klicks, Engagement) bereitgestellt wurden. Diese Statistiken müssen dem Unternehmen innerhalb von ${ph(statistikFrist, 4)} Kalendertagen nach Veröffentlichung des letzten Beitrags zur Verfügung gestellt werden. Der Influencer kann erst dann eine Rechnung ausstellen, wenn alle Leistungen einschließlich der Statistiken vollständig erbracht wurden.`
    );

    // 3. Performance and service delivery
    heading('3. PERFORMANCE AND SERVICE DELIVERY', '3. LEISTUNG UND DIENSTLEISTUNGSERBRINGUNG');
    row(
      '3.1. The Parties agree that the Products will be marked as samples.',
      '3.1. Die Parteien vereinbaren, dass die Produkte als \u201aSample\u2018 gekennzeichnet werden.'
    );
    row(
      '3.2. The Influencer undertakes to promote Products in accordance with the following conditions:',
      '3.2. Der Influencer verpflichtet sich, die Produkte gemäß den folgenden Bedingungen zu bewerben:'
    );
    row(
      '3.2.1. The deliverables are provided in Annex A. Please review it below.',
      '3.2.1. Die zu erbringenden Leistungen sind in Anhang A enthalten. Bitte lesen Sie ihn unten.'
    );
    row(
      '3.2.2. All Content developed by the Influencer is to be approved by the Company before posting. The Company can either approve the content or ask for revisions within two (2) days of receipt of work.',
      '3.2.2. Alle vom Influencer entwickelten Inhalte müssen vor der Veröffentlichung vom Unternehmen genehmigt werden. Das Unternehmen kann den Inhalt genehmigen oder innerhalb von zwei (2) Tagen nach Erhalt Überarbeitungen verlangen.'
    );
    row(
      '3.2.3. The Company is to be tagged in every single social media post. It must be clearly stated that the advertisement is a paid collaboration.',
      '3.2.3. Das Unternehmen muss in jedem einzelnen Beitrag genannt werden. Es muss deutlich angegeben werden, dass es sich um eine bezahlte Zusammenarbeit handelt.'
    );
    row(
      `3.2.4. All Content shall be submitted to the Company prior to publication, minimum ${contentVorlauf} business days before Content goes live. The Company has the right to reject any deliverable and must notify the Influencer within 3 business days of receipt of work.`,
      `3.2.4. Alle Inhalte müssen dem Unternehmen vor der Veröffentlichung vorgelegt werden, mindestens ${contentVorlauf} Werktage bevor der Inhalt veröffentlicht wird. Das Unternehmen hat das Recht, jede Leistung abzulehnen, und muss den Influencer innerhalb von 3 Werktagen nach Erhalt benachrichtigen.`
    );

    // 4. Ownership and usage
    heading('4. OWNERSHIP AND USAGE', '4. EIGENTUM UND NUTZUNG');
    row(
      `4.1. The Influencer agrees to display the Content as directed by the Company and keep such Content on his/her account for a period of ${aufbewahrungText}. If requested by the Company, the Influencer agrees to remove the Content and cease further use thereof. All rights to Content remain the property of the Influencer.`,
      `4.1. Der Influencer erklärt sich damit einverstanden, die Inhalte gemäß den Anweisungen des Unternehmens zu zeigen und für einen Zeitraum von ${aufbewahrungText} auf seinem Konto zu speichern. Auf Verlangen des Unternehmens entfernt der Influencer die Inhalte und stellt deren weitere Nutzung ein. Alle Rechte an den Inhalten verbleiben beim Influencer.`
    );
    row(
      `4.2. The Influencer hereby grants the Company the right to reuse the deliverables (the "Content") for purposes of organic communication, limited to organic reposting under the Company\u2019s account${brandTag ? ` (${brandTag})` : ''}.`,
      `4.2. Der Influencer gewährt dem Unternehmen hiermit das Recht, die erstellten Inhalte (den \u201eContent\u201c) für Zwecke der organischen Kommunikation wiederzuverwenden, beschränkt auf das organische Reposten unter dem Account des Unternehmens${brandTag ? ` (${brandTag})` : ''}.`
    );

    // ============================================
    // GENERAL TERMS
    // ============================================
    heading('GENERAL TERMS', 'ALLGEMEINE BEDINGUNGEN');

    // 5. Liability
    heading('5. LIABILITY', '5. HAFTUNG', { topGap: 0 });
    row(
      '5.1. To the fullest extent permitted by law, the Influencer will defend, indemnify and hold the Company harmless from any claims, damages, losses, liabilities, costs and expenses arising out of improper, insulting or disrespectful promotion of Products and/or the Company\u2019s brands, as well as any other public remarks made during the Term or 6 months thereafter.',
      '5.1. Soweit gesetzlich zulässig, stellt der Influencer das Unternehmen von allen Ansprüchen, Schäden, Verlusten, Verbindlichkeiten, Kosten und Ausgaben frei, die aus unangemessener, beleidigender oder respektloser Werbung für die Produkte und/oder Marken des Unternehmens sowie aus anderen öffentlichen Äußerungen während der Laufzeit oder 6 Monate danach entstehen.'
    );
    row(
      '5.2. The Influencer undertakes to comply with all rules and requirements of the relevant social media platforms and not to distribute prohibited, unethical or Company-discrediting content. The Company may request no more than two (2) revisions of the Influencer\u2019s Content.',
      '5.2. Der Influencer verpflichtet sich, alle Regeln und Anforderungen der jeweiligen Social-Media-Plattformen einzuhalten und keine verbotenen, unethischen oder das Unternehmen diskreditierenden Inhalte zu verbreiten. Das Unternehmen kann nicht mehr als zwei (2) Überarbeitungen verlangen.'
    );
    row(
      '5.3. When publishing posts about the Company\u2019s Products or brands, the Influencer must clearly disclose the material connection with the Company. The disclosure must be clear, prominent and in close proximity to the statements, regardless of any space limitations of the medium.',
      '5.3. Bei Veröffentlichung von Beiträgen über die Produkte oder Marken des Unternehmens muss der Influencer die materielle Verbindung zum Unternehmen deutlich offenlegen. Die Offenlegung muss klar, deutlich und in unmittelbarer Nähe zu den Aussagen erfolgen, unabhängig von Platzbeschränkungen des Mediums.'
    );

    // 6. General requirements
    heading('6. GENERAL REQUIREMENTS', '6. ALLGEMEINE ANFORDERUNGEN');
    row(
      '6.1. The Company will provide the creator with creative guidelines including all tags, key messages and visual requirements. The Services shall conform to the Guidelines and are subject to the Company\u2019s acceptance and approval.',
      '6.1. Das Unternehmen stellt dem Ersteller kreative Richtlinien zur Verfügung, einschließlich aller Tags, Schlüsselbotschaften und visuellen Anforderungen. Die Dienste müssen den Richtlinien entsprechen und unterliegen der Annahme und Genehmigung durch das Unternehmen.'
    );
    row(
      '6.2. It is obligatory to follow the Creative Guidelines. If the Influencer does not follow them, the Influencer will be required to edit or redo the Content. If the Influencer refuses to amend the content and/or publishes without approval, the Influencer is not entitled to compensation.',
      '6.2. Es ist verpflichtend, die Gestaltungsrichtlinien zu befolgen. Hält sich der Influencer nicht daran, muss er den Inhalt bearbeiten oder neu erstellen. Weigert sich der Influencer oder veröffentlicht ohne Genehmigung, hat er keinen Anspruch auf Vergütung.'
    );

    // 7. Duration and termination
    heading('7. DURATION AND TERMINATION', '7. DAUER UND BEENDIGUNG');
    row(
      '7.1. This Agreement takes effect once signed by both parties and is valid for the duration of the collaboration or until all deliverables stated in 3.2. and Annex A are completed and pre-approved by the Company.',
      '7.1. Dieser Vertrag tritt in Kraft, sobald er von beiden Parteien unterzeichnet ist, und gilt für die Dauer der Zusammenarbeit bzw. bis alle in 3.2. und Anhang A genannten Leistungen erbracht und vom Unternehmen vorab genehmigt sind.'
    );
    row(
      `7.2. If the deliverables are not completed and pre-approval is not given within ${kuendigungsfrist} days after signing, any Party may terminate this Agreement unilaterally. In case of termination the Company pays compensation only for deliverables created until termination.`,
      `7.2. Werden die Leistungen nicht erbracht und die Vorabgenehmigung nicht innerhalb von ${kuendigungsfrist} Tagen nach Unterzeichnung erteilt, kann jede Partei diesen Vertrag einseitig kündigen. Im Falle einer Kündigung zahlt das Unternehmen nur für bis zur Kündigung erstellte Leistungen.`
    );
    row(
      '7.3. In the event of a breach, any Party may terminate if: (7.3.1.) the affected party informs the other within three (3) days of learning about the breach, obliging the guilty Party to remedy it; and (7.3.2.) the guilty Party does not remedy the breach within fourteen (14) days of the written notice.',
      '7.3. Im Falle einer Verletzung kann jede Partei kündigen, wenn: (7.3.1.) die betroffene Partei die andere innerhalb von drei (3) Tagen nach Kenntnis informiert und zur Behebung auffordert; und (7.3.2.) die schuldige Partei den Verstoß nicht innerhalb von vierzehn (14) Tagen nach der schriftlichen Mitteilung behebt.'
    );
    row(
      '7.4. In addition, if the Influencer has breached this Agreement, the Company may (7.4.1.) immediately suspend, limit or terminate the Influencer\u2019s access to any of the Company\u2019s accounts; and/or (7.4.2.) instruct the Influencer to cease all promotional activities or make clarifying statements.',
      '7.4. Zusätzlich kann das Unternehmen bei einem Verstoß des Influencers (7.4.1.) den Zugang des Influencers zu Konten des Unternehmens sofort aussetzen, einschränken oder beenden; und/oder (7.4.2.) den Influencer anweisen, alle Werbemaßnahmen einzustellen oder klarstellende Erklärungen abzugeben.'
    );
    row(
      '7.5. If the Influencer breaches this Agreement and does not remedy it under 7.2. and 7.3., or infringes 5.1. and 5.2., the Influencer automatically loses the right to any compensation and the Company may terminate immediately, informing the Influencer one (1) day prior.',
      '7.5. Verstößt der Influencer gegen diesen Vertrag und behebt dies nicht gemäß 7.2. und 7.3. oder verstößt gegen 5.1. und 5.2., verliert er automatisch das Recht auf jegliche Vergütung und das Unternehmen kann sofort kündigen, indem es den Influencer einen (1) Tag vorher informiert.'
    );

    // 8. Confidentiality and exclusivity
    heading('8. CONFIDENTIALITY AND EXCLUSIVITY', '8. VERTRAULICHKEIT UND AUSSCHLIESSLICHKEIT');
    row(
      '8.1. During the term, the Influencer will access and create documents and information of a confidential and proprietary nature. The Influencer acknowledges that such information is an asset of the Company or its clients, is not generally known, and must be kept strictly confidential.',
      '8.1. Während der Laufzeit erhält der Influencer Zugang zu vertraulichen und geschützten Dokumenten und Informationen und erstellt diese. Der Influencer erkennt an, dass diese Informationen ein Vermögenswert des Unternehmens oder seiner Kunden sind, nicht allgemein bekannt sind und streng vertraulich behandelt werden müssen.'
    );
    row(
      '8.2. The Influencer will not use, disclose, copy or permit disclosure of the information indicated in 8.1. to any third party, except as directed by the Company. Upon termination or on request, the Influencer will return all confidential information and copies thereof.',
      '8.2. Der Influencer wird die in 8.1. genannten Informationen nicht verwenden, offenlegen, kopieren oder deren Offenlegung an Dritte zulassen, außer auf Anweisung des Unternehmens. Bei Beendigung oder auf Verlangen gibt der Influencer alle vertraulichen Informationen und Kopien zurück.'
    );

    // 9. Warranties and statements
    heading('9. WARRANTIES AND STATEMENTS', '9. GEWÄHRLEISTUNGEN UND ERKLÄRUNGEN');
    row(
      '9.1. Each Party states and guarantees that it is legally established and operates in accordance with the laws of its country, has performed all legal actions for the valid conclusion of the Agreement, and will not violate any laws or binding obligations.',
      '9.1. Jede Partei erklärt und garantiert, dass sie rechtmäßig gegründet ist und nach dem Recht ihres Landes tätig ist, alle Rechtshandlungen für den gültigen Abschluss vorgenommen hat und gegen keine Gesetze oder verbindlichen Verpflichtungen verstößt.'
    );
    row(
      '9.2. Neither Party is the agent or representative of the other and has no authority to bind the other Party in any way.',
      '9.2. Keine Partei ist Vertreter der anderen und hat keine Befugnis, die andere Partei in irgendeiner Weise zu binden.'
    );
    row(
      '9.3. The Influencer is retained as an independent contractor and is solely responsible for the manner of performance and for the withholding and payment of all taxes. Nothing in this Agreement indicates an intent to enter into an employee-based contract.',
      '9.3. Der Influencer wird als unabhängiger Auftragnehmer eingestellt und ist allein für die Art der Leistungserbringung sowie für die Einbehaltung und Abführung aller Steuern verantwortlich. Nichts in diesem Vertrag deutet auf die Absicht eines Arbeitnehmervertrags hin.'
    );

    // 10. Miscellaneous
    heading('10. MISCELLANEOUS PROVISIONS', '10. SONSTIGE BESTIMMUNGEN');
    row(
      '10.1. This Agreement together with its annex contains the entire agreement between the Parties and supersedes all prior agreements. 10.2. Any amendments must be agreed in writing by both Parties.',
      '10.1. Dieser Vertrag mit seinem Anhang enthält die gesamte Vereinbarung zwischen den Parteien und ersetzt alle früheren Vereinbarungen. 10.2. Änderungen müssen von beiden Parteien schriftlich vereinbart werden.'
    );
    row(
      '10.3. If any provision is found invalid, the remainder of this Agreement remains in full force, and the Parties shall replace the invalid provision with one reflecting its purpose as closely as possible.',
      '10.3. Sollte eine Bestimmung ungültig sein, bleibt der übrige Vertrag in Kraft, und die Parteien ersetzen die ungültige Bestimmung durch eine, die deren Zweck möglichst nahekommt.'
    );
    row(
      '10.5. Neither Party may assign its rights or obligations without the prior written consent of the other. 10.6.\u201310.7. This Agreement is governed by Lithuanian law; all disputes are subject to the exclusive jurisdiction of Kaunas city (Lithuania).',
      '10.5. Keine Partei darf ihre Rechte oder Pflichten ohne vorherige schriftliche Zustimmung der anderen übertragen. 10.6.\u201310.7. Dieser Vertrag unterliegt litauischem Recht; alle Streitigkeiten unterliegen der ausschließlichen Zuständigkeit der Stadt Kaunas (Litauen).'
    );
    row(
      '10.8.\u201310.10. This Agreement is executed in two original copies, each party acknowledging receipt of one. Translations are for convenience only. The English version of the Agreement shall prevail.',
      '10.8.\u201310.10. Dieser Vertrag wird in zwei Originalen ausgefertigt, wobei jede Partei den Erhalt eines Exemplars bestätigt. Übersetzungen dienen nur der Vereinfachung. Es gilt die englische Version des Vertrags.'
    );

    // ============================================
    // Unterschriften (Vertrag)
    // ============================================
    y = signatureBlock(y);

    // ============================================
    // ANHANG A / ANNEX A
    // ============================================
    newPage();
    setBody();
    centered('ANNEX A', 12, 'bold');
    y += 4;
    doc.text('ANHANG A', 105, y, { align: 'center' });
    y += 8;
    setBody();

    row(
      `The Influencer\u2019s social media platforms relevant to this Agreement: TikTok Account: ${ph(tiktokHandle, 16)}`,
      `Die für diese Vereinbarung relevanten Social-Media-Plattformen des Influencers: TikTok Account: ${ph(tiktokHandle, 16)}`
    );

    heading('DELIVERABLES', 'LEISTUNGEN', { topGap: 2 });
    row(
      '1. Content must be created according to the visual guidelines (provided in a file named "Guidelines" sent together with this Agreement).',
      '1. Der Inhalt muss gemäß den visuellen Richtlinien erstellt werden (bereitgestellt in einer Datei namens "Richtlinien", die zusammen mit diesem Vertrag gesendet wird).'
    );
    row('2. Content must be approved before publication.', '2. Der Inhalt muss vor der Veröffentlichung genehmigt werden.');
    row(
      '3. Do not use copyrighted materials, including music that appears to be available on the platforms.',
      '3. Verwenden Sie keine urheberrechtlich geschützten Materialien, einschließlich Musik, die scheinbar auf den Plattformen verfügbar ist.'
    );
    row(
      `4. Content must be sent for approval at least ${contentVorlauf} business days before the agreed publication date.`,
      `4. Der Inhalt muss spätestens ${contentVorlauf} Werktage vor dem vereinbarten Veröffentlichungsdatum zur Genehmigung gesendet werden.`
    );

    heading('SCOPE / GUIDELINES', 'LIEFERUMFANG / RICHTLINIEN', { topGap: 2 });
    row(
      `Deliverable: ${deliverablesText}  |  Date: ${ph(veroeffentlichungsfrist, 12)}`,
      `Lieferumfang: ${deliverablesText}  |  Datum: ${ph(veroeffentlichungsfrist, 12)}`
    );
    row(
      `\u2022 The content must be approved by the Company before publication.  \u2022 Tag ${ph(brandTag, 14)}.`,
      `\u2022 Der Inhalt muss vom Unternehmen vor der Veröffentlichung genehmigt werden.  \u2022 Taggen Sie ${ph(brandTag, 14)}.`
    );
    row(
      '\u2022 Products must be properly attached to the respective devices. \u2022 No accessories from other brands should be visible. \u2022 High-quality video showing the product in the centre of the frame. \u2022 The product design must be clearly visible (sufficient lighting). \u2022 Tags and text must be in the Influencer\u2019s native language.',
      '\u2022 Die Produkte müssen ordnungsgemäß auf den entsprechenden Geräten angebracht sein. \u2022 Es sollte kein Zubehör anderer Marken sichtbar sein. \u2022 Qualitativ hochwertiges Video, das das Produkt im Zentrum des Bildes zeigt. \u2022 Das Design des Produkts muss klar sichtbar sein (ausreichende Beleuchtung). \u2022 Tags und Text müssen in der Muttersprache des Influencers sein.'
    );

    // Unterschriften (Anhang)
    y = signatureBlock(y);

    // Letzte Fußzeile
    addFooter();

    // ============================================
    // Speichern + Upload
    // ============================================
    const pdfBlob = doc.output('blob');
    const filePrefix = lang === 'en' ? 'EN_Contract_Awareness' : 'Vertrag_Awareness';
    const fileName = `${filePrefix}_${vertrag.name || 'Kooperation'}_${new Date().toISOString().split('T')[0]}.pdf`;

    const uploadResult = await uploadGeneratedVertragPdf(this, vertrag, pdfBlob, fileName);
    if (uploadResult?.fileUrl) {
      console.log('✅ Awareness-PDF nach Dropbox hochgeladen und URL gespeichert');
    } else {
      console.warn('⚠️ Dropbox-Upload nicht erfolgreich – PDF wird nur lokal heruntergeladen');
    }
    doc.save(fileName);

    console.log('✅ Awareness-PDF generiert');
  } catch (error) {
    console.error('❌ Fehler bei Awareness-PDF-Generierung:', error);
    window.toastSystem?.show('PDF konnte nicht generiert werden', 'warning');
  }
};
