// pdf/EhgPdf.js
// EHG-Vertrag: UGC-Standard-Deckblatt plus Drittbeguenstigte, danach der
// einsprachige EHG-Vertragstext inkl. vollständigem § 6 und Projektblatt.

import { VertraegeCreate } from '../VertraegeCreateCore.js';
import { uploadGeneratedVertragPdf } from './VertragPdfUpload.js';
import {
  EHG_ANSCHRIFT,
  ehgCreatorAnzeige,
  ehgKampagneAnzeige,
  ehgMarkeProduktAnzeige,
  mappedEhgKonzeption,
  mappedEhgLieferbestandteile
} from '../EhgVertragGating.js';

// jsPDF Helvetica spricht WinAnsi. Typografische Anführungszeichen und
// Gedankenstriche aus der EHG-Vorlage werfen sonst vor dem Upload.
export function normalizePdfWinAnsi(value) {
  if (Array.isArray(value)) return value.map(normalizePdfWinAnsi);
  if (typeof value !== 'string') return value;
  return value
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u00A0\u202F\u2009\u200A]/g, ' ');
}

function bindPdfWinAnsi(doc) {
  const originalText = doc.text.bind(doc);
  const originalSplit = doc.splitTextToSize.bind(doc);
  doc.text = (text, ...args) => originalText(normalizePdfWinAnsi(text), ...args);
  doc.splitTextToSize = (text, width, options) =>
    originalSplit(normalizePdfWinAnsi(text), width, options);
}

const LOGO_SVG = `<svg width="120" height="66" viewBox="0 0 120 66" fill="none" xmlns="http://www.w3.org/2000/svg">
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

VertraegeCreate.prototype.generateEhgPDF = async function(vertrag, lang = this.getContractLanguage(vertrag)) {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFont('helvetica');
    this.localizeDocText(doc, lang);
    bindPdfWinAnsi(doc);

    const en = lang === 'en';
    const t = (de, english) => (en ? english : de);
    const ehg = vertrag.ehg_felder || {};
    const creator = this.creators.find(c => c.id === vertrag.creator_id) || {};
    const creatorAddr = this.getResolvedCreatorContractAddress(creator, vertrag) || {};

    const FOOTER_Y = 285;
    const MAX_Y = 265;
    const LEFT = 14;
    const WIDTH = 182;
    let pageNumber = 1;
    let y = 62;

    const addFooter = () => {
      const prevSize = doc.getFontSize();
      const prevFont = doc.getFont();
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text('LikeGroup GmbH | Jakob-Latscha-Str. 3 | 60314 Frankfurt am Main | Deutschland', 14, FOOTER_Y);
      doc.text(`${en ? 'Page' : 'Seite'} ${pageNumber}`, 196, FOOTER_Y, { align: 'right' });
      doc.setTextColor(0);
      doc.setFontSize(prevSize);
      doc.setFont(prevFont.fontName, prevFont.fontStyle);
      pageNumber++;
    };

    const newPage = () => {
      addFooter();
      doc.addPage();
      y = 20;
    };

    const ensure = (needed = 12) => {
      if (y + needed > MAX_Y) newPage();
    };

    const para = (text, opts = {}) => {
      const size = opts.size || 9;
      doc.setFont('helvetica', opts.style || 'normal');
      doc.setFontSize(size);
      const lines = doc.splitTextToSize(text || '', opts.width || WIDTH);
      lines.forEach((line) => {
        ensure(5);
        doc.text(line, opts.x ?? LEFT, y);
        y += opts.lh || 4.4;
      });
      y += opts.after ?? 2;
    };

    const heading = (text) => {
      y += 3;
      ensure(10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(text, LEFT, y);
      y += 6;
    };

    const centerBlock = (title, lines) => {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(title, 105, y, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      lines.forEach((line) => {
        doc.text(line || '-', 105, y, { align: 'center' });
        y += 5;
      });
    };

    const drawCheckbox = (x, yPos, checked, label) => {
      doc.rect(x, yPos - 2.5, 3, 3);
      if (checked) {
        doc.line(x + 0.5, yPos - 2, x + 2.5, yPos);
        doc.line(x + 0.5, yPos, x + 2.5, yPos - 2);
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(label, x + 5, yPos);
    };

    const signatureBlock = () => {
      ensure(36);
      y += 6;
      const ort = ehg.unterschrift_ort || 'Frankfurt am Main';
      const datum = this.formatContractDate(ehg.unterschrift_datum || new Date().toISOString().split('T')[0], lang);
      para(`${t('Ort, Datum', 'Location, Date')}: ${ort}, ${datum}`, { after: 6 });
      para(`${t('Creator', 'Creator')}: ______________________________`, { after: 4 });
      para(t(
        'Dieser Vertrag wird mit der Unterschrift des Creators wirksam.',
        'This agreement becomes effective upon signature by the creator.'
      ), { after: 1 });
      para(t(
        'Eine zusätzliche Unterschrift der LikeGroup GmbH ist nicht erforderlich.',
        'An additional signature by LikeGroup GmbH is not required.'
      ), { after: 4 });
    };

    let logoBase64 = null;
    try {
      if (typeof OffscreenCanvas === 'undefined') {
        logoBase64 = null;
      } else {
      const testCtx = document.createElement('canvas').getContext?.('2d');
      if (typeof Image !== 'undefined' && testCtx) {
        logoBase64 = await new Promise((resolve, reject) => {
          const svgBase64 = btoa(unescape(encodeURIComponent(LOGO_SVG)));
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 240;
            canvas.height = 132;
            const ctx = canvas.getContext('2d');
            ctx.scale(2, 2);
            ctx.drawImage(img, 0, 0, 120, 66);
            resolve(canvas.toDataURL('image/png'));
          };
          img.onerror = reject;
          img.src = `data:image/svg+xml;base64,${svgBase64}`;
        });
      }
      }
    } catch (e) {
      console.warn('⚠️ Logo wird übersprungen:', e);
    }
    if (logoBase64) doc.addImage(logoBase64, 'PNG', 93.6, 10, 22.75, 12.6);

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('UGC-PRODUKTIONSVERTRAG', 105, 36, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`${vertrag.name || 'Ohne Name'}`, 105, 46, { align: 'center' });

    centerBlock('Agenturdaten', [
      'LikeGroup GmbH',
      'Jakob-Latscha-Str. 3',
      '60314 Frankfurt am Main'
    ]);

    y += 10;
    centerBlock('Kundendaten', [
      `Firmenname: ${EHG_ANSCHRIFT.name}`,
      EHG_ANSCHRIFT.strasse,
      `${EHG_ANSCHRIFT.plz} ${EHG_ANSCHRIFT.stadt}`
    ]);

    y += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Creatordaten', 105, y, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y += 8;
    doc.text(`Name: ${creator.vorname || ''} ${creator.nachname || ''}`.trim() || '-', 105, y, { align: 'center' });
    y += 5;
    y = this.appendPdfCreatorContractAddress(doc, y, creatorAddr, t('Deutschland', 'Germany'));

    y += 12;
    centerBlock('Drittbegünstigte', [
      EHG_ANSCHRIFT.name,
      EHG_ANSCHRIFT.strasse,
      `${EHG_ANSCHRIFT.plz} ${EHG_ANSCHRIFT.stadt}`
    ]);

    y += 10;
    const drawYesNo = (x, yPos, value) => {
      drawCheckbox(x, yPos, !value, t('Nein', 'No'));
      drawCheckbox(x + 20, yPos, !!value, t('Ja', 'Yes'));
    };
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Influencer-Vertretung', 105, y, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y += 6;
    doc.text('Wird der Influencer durch eine Agentur vertreten?', 105, y, { align: 'center' });
    y += 6;
    drawYesNo(85, y, vertrag.influencer_agentur_vertreten);
    if (vertrag.influencer_agentur_vertreten) {
      y += 8;
      doc.text(`Agenturname: ${vertrag.influencer_agentur_name || '-'}`, 105, y, { align: 'center' });
      y += 5;
      doc.text(`${vertrag.influencer_agentur_strasse || ''} ${vertrag.influencer_agentur_hausnummer || ''}`.trim() || '-', 105, y, { align: 'center' });
      y += 5;
      doc.text(`${vertrag.influencer_agentur_plz || ''} ${vertrag.influencer_agentur_stadt || ''}`.trim() || '-', 105, y, { align: 'center' });
    }

    y += 12;
    centerBlock('PO / Auftragsnummer', [
      `${vertrag.kunde_po_nummer || '_______________________________'}`,
    ]);
    doc.setFontSize(9);
    doc.text('Zwingend auf der Rechnung anzugeben. Ohne Angabe ist keine Zahlung möglich.', 105, y, { align: 'center' });
    addFooter();

    doc.addPage();
    y = 20;

    heading(t('Präambel', 'Preamble'));
    para(t(
      'Der Creator produziert die im beigefügten Projektblatt beschriebenen werblichen Inhalte („Content“), vor allem Videoclips, zur exklusiven Nutzung durch EHG. Das Projektblatt ist Vertragsbestandteil. Vertragspartner des Creators und alleinige Schuldnerin der Vergütung ist die Agentur. EHG erhält als Drittbegünstigte eigene, in § 6 geregelte Rechte. „Dritte“ im Sinne dieses Vertrages sind alle natürlichen und juristischen Personen außer Creator, Agentur und EHG.',
      'The Creator shall produce the promotional content (“Content”) described in the attached project sheet—primarily video clips—for the exclusive use of EHG. The project sheet is an integral part of this contract. The Agency is the Creator’s contractual counterparty and the sole party obliged to pay the Remuneration. As a third-party beneficiary, EHG acquires its own rights as set out in Section 6. “Third parties” within the meaning of this contract are all natural and legal persons other than the Creator, the Agency, and EHG.'
    ));

    const sections = [
      {
        title: t('§ 1 Projekt, Leistung, Gewährleistung', '§ 1 Project, Services, and Remedies for Defects'),
        items: [
          t('1. Art, Umfang, Format, Fristen, Vergütung und Nutzungsumfang ergeben sich ausschließlich aus diesem Vertrag und dem Projektblatt. Das Projektblatt geht bei Abweichungen vor. Etwaige im Projektblatt als verbindlich bezeichnete Briefings und technische Vorgaben ergänzen es.',
            '1. The nature, scope, format, deadlines, remuneration, and scope of use are determined exclusively by this contract and the project sheet. In the event of discrepancies, the project sheet shall prevail. Any briefings and technical specifications designated as binding in the Project Sheet shall supplement the Project Sheet.'),
          t('2. Der Creator erstellt und liefert den Content persönlich, fristgerecht, im vereinbarten Format und entsprechend dem Briefing. Hilfspersonen darf der Creator nur mit Zustimmung der Agentur einsetzen, sofern das Briefing nicht bereits den Einsatz von Hilfspersonen umfasst.',
            '2. The Creator shall create and deliver the content personally, on time, in the agreed-upon format, and in accordance with the briefing. The Creator may only engage auxiliary personnel with the Agency’s consent, unless the briefing already provides for the use of auxiliary personnel.'),
          t('3. Der Creator veröffentlicht den Content weder auf eigenen Accounts noch anderweitig und stellt ihn Dritten nicht zur Verfügung, sofern Agentur oder EHG dies nicht vorher in Textform erlauben.',
            '3. The Creator shall not publish the content on their own accounts or elsewhere, nor shall they make it available to third parties, unless the Agency or EHG has given prior permission in text form (for purposes of this Agreement, “text form” refers to section 126b of the German Civil Code).'),
          t('4. Stellt die Agentur dem Creator Produkte, Texte, Marken, Logos, Claims oder sonstige Materialien von EHG zur Verfügung, dürfen diese ausschließlich zur Durchführung dieses Vertrages verwendet werden.',
            '4. If the Agency provides the Creator with products, texts, trademarks, logos, advertising claims, or other materials from EHG, these may be used exclusively for the performance of this contract.'),
          t('5. Der Creator legt vor der finalen Lieferung einen prüffähigen Entwurf vor. Er setzt Weisungen der Agentur oder EHG um, soweit sie der Einhaltung des Projektblatts, des Briefings, technischer Anforderungen oder rechtlicher Vorgaben dienen.',
            '5. The Creator shall submit a verifiable draft prior to final delivery. The Creator shall implement instructions from the Agency or EHG to the extent that they serve to ensure compliance with the project sheet, the briefing, technical requirements, or legal requirements.'),
          t('6. Bei Mängeln stehen Agentur und EHG die Rechte aus § 634 BGB zu; sie können insbesondere Nacherfüllung verlangen, die der Creator nach seiner Wahl durch Nachbesserung oder Neuerstellung bewirkt.',
            '6. In the event of defects, the Agency and EHG shall be entitled to the remedies under section 634 of the German Civil Code; in particular, they may require cure (Nacherfüllung), which the Creator shall, at the Creator’s option, effect by remedying the defect or creating the Content anew.')
        ]
      },
      {
        title: t('§ 2 Vergütung', '§ 2 Remuneration'),
        items: [
          t('1. Die Agentur zahlt die im Projektblatt vereinbarte Vergütung. Sie versteht sich netto zuzüglich gesetzlicher Umsatzsteuer, soweit diese anfällt.',
            '1. The Agency shall pay the remuneration agreed upon in the project sheet. This amount is net plus applicable statutory value-added tax, if any.'),
          t('2. Die Vergütung wird nach vollständiger vertragsgemäßer Lieferung und Zugang einer ordnungsgemäßen Rechnung fällig und ist innerhalb von 30 Tagen zu zahlen. Bei behebbaren Mängeln darf die Agentur einen angemessenen Teil bis zur Behebung zurückhalten.',
            '2. Remuneration becomes due upon complete delivery in accordance with the contract and receipt of a proper invoice and must be paid within 30 days. In the event of curable defects, the Agency may withhold a reasonable portion until the defects are remedied.'),
          t('3. Mit der Vergütung sind die vereinbarten Leistungen sowie ausschließlich die im Projektblatt ausgewählten Nutzungen abgegolten. Auslagen oder Zusatzleistungen werden nur erstattet beziehungsweise vergütet, wenn sie vorher in Textform vereinbart wurden.',
            '3. The remuneration covers the agreed-upon services as well as exclusively the uses selected in the project sheet. Expenses will be reimbursed and additional services separately remunerated only if agreed in advance in text form.'),
          t('4. EHG schuldet dem Creator weder Vergütung noch Aufwendungsersatz.',
            '4. EHG owes the Creator neither remuneration nor reimbursement of expenses.')
        ]
      },
      {
        title: t('§ 3 Nutzungs- und Persönlichkeitsrechte', '§ 3 Rights of Use and Personality Rights'),
        items: [
          t('1. Der Creator räumt der Agentur ein ausschließliches Nutzungsrecht an dem im Projektblatt vereinbarten Content ein. Die Agentur wird das Nutzungsrecht ganz oder teilweise auf EHG übertragen, einschließlich des Rechts der Weiterübertragung auf Dritte. Die Rechteübertragung umfasst nur die im Projektblatt genannten Nutzungsarten, Gebiete und Zeiträume. Nicht ausgewählte und bei Vertragsschluss unbekannte Nutzungsarten sind nicht umfasst.',
            '1. The Creator grants the Agency an exclusive right to use the Content agreed upon in the project sheet. The Agency shall transfer this right of use, in whole or in part, to EHG, including the right to further transfer those rights to third parties. The transfer of rights covers only the types of use, territories, and time periods specified in the project sheet. Types of use not selected and unknown at the time of contract conclusion are not covered.'),
          t('2. Die Rechte umfassen, soweit für die ausgewählten Nutzungen erforderlich, das Speichern, Vervielfältigen, Verbreiten, öffentliche Zugänglichmachen und Wiedergeben sowie das technische und redaktionelle Bearbeiten, sowie Anpassungen an Formate, Bildausschnitten, Farbgestaltung und sonstige marktübliche Bearbeitungen. Zulässig sind insbesondere Formatänderungen, Kürzungen, Ausschnitte, Untertitel, Übersetzungen, Vertonungen, Kombinationen mit anderen Inhalten und die Herstellung von Vorschaubildern.',
            '2. To the extent necessary for the selected uses, the rights include storage, reproduction, distribution, making available to the public, and communication to the public, as well as technical and editorial editing, and adaptations to formats, image cropping, color schemes, and other standard market edits.'),
          t('3. Der Creator willigt ein, dass sein im Content enthaltenes Bild und seine Stimme für die ausgewählten Nutzungen verwendet werden. Name, Pseudonym, Social-Media-Handle, Einzelbilder außerhalb des unmittelbaren Content-Zusammenhangs und biografische Angaben dürfen nur genutzt werden, wenn dies im Projektblatt ausgewählt ist.',
            '3. The Creator consents to the use of the Creator’s likeness and voice as embodied in the Content for the selected uses. The Creator’s name, pseudonym, social media handle, stills outside the immediate context of the Content, and biographical information may only be used if this is selected in the project sheet.'),
          t('4. Eine Urheber- oder Namensnennung ist nur geschuldet, wenn sie im Projektblatt vereinbart ist.',
            '4. Credit or attribution is only required if agreed upon in the project sheet.'),
          t('5. Eine Nutzung des Content durch den Creator oder eine Weitergabe an Dritte ist auch nach Ablauf der im Projektblatt geregelten Nutzungszeit verboten. Der Content bleibt für die Agentur und EHG auch nach Ende des Vertrags und Ende der Nutzung dauerhaft exklusiv.',
            '5. The Creator may not use the Content or make it available to third parties even after expiry of the usage period specified in the Project Sheet. The content remains permanently exclusive to the agency and EHG even after the termination of the contract and the end of its use.')
        ]
      },
      {
        title: t('§ 4 Rechte Dritter und Rechtmäßigkeit', '§ 4 Third-Party Rights and Legality'),
        items: [
          t('1. Der Creator gewährleistet, dass er den Content selbst erstellt oder sämtliche für die ausgewählten Nutzungen erforderlichen Rechte wirksam erworben hat und dass keine entgegenstehenden Rechte oder Bindungen bestehen.',
            '1. The Creator warrants that they have created the Content themselves or have validly acquired all rights necessary for the selected uses, and that no conflicting rights or obligations exist.'),
          t('2. Musik, Stockmaterial, Templates, Schriften, KI-Material und sonstige fremde Bestandteile dürfen nur verwendet werden, wenn die Lizenz sämtliche ausgewählten Nutzungen durch Agentur und EHG dauerhaft und unabhängig von späteren Änderungen der Lizenz- oder Plattformbedingungen gestattet. Musik oder sonstige Inhalte aus Plattformbibliotheken dürfen ohne vorherige Freigabe in Textform nicht verwendet werden. Nachweise legt der Creator auf Verlangen vor.',
            '2. Music, stock material, templates, fonts, AI-generated material, and other third-party components may only be used if the license permanently permits all selected uses by the Agency and EHG, regardless of any subsequent changes to the license or platform terms. Music or other content from platform libraries may not be used without prior approval in text form.'),
          t('3. Der Content darf weder rechtswidrig sein noch Rechte Dritter verletzen. Hat der Creator Zweifel, weist er Agentur und EHG vor Lieferung darauf hin. Für von Agentur oder EHG verbindlich vorgegebene Materialien haftet der Creator nicht, sofern er sie unverändert und vorgabengemäß verwendet und auf erkennbare Risiken hingewiesen hat.',
            '3. The content must not be unlawful nor infringe upon the rights of third parties. If the Creator has any doubts, they must notify the Agency and EHG prior to delivery.'),
          t('4. Verletzt der Creator diese Pflichten schuldhaft, ersetzt er Agentur und EHG den daraus entstehenden Schaden und stellt beide von berechtigten Ansprüchen Dritter sowie den erforderlichen angemessenen Kosten der Rechtsverteidigung frei. Agentur oder EHG informieren den Creator zeitnah und geben ihm angemessene Gelegenheit zur Mitwirkung an der Abwehr.',
            '4. If the Creator intentionally or negligently breaches these obligations, the Creator shall compensate the Agency and EHG for any resulting loss or damage and shall indemnify each of them against any valid third-party claims and the necessary and reasonable costs of legal defense.')
        ]
      },
      {
        title: t('§ 5 Vertraulichkeit und Vertragsdauer', '§ 5 Confidentiality and Term of the Agreement'),
        items: [
          t('1. Der Creator behandelt nicht öffentliche Informationen über das Projekt, die Agentur und EHG vertraulich. Unveröffentlichter Content und die Zusammenarbeit dürfen ohne vorherige Zustimmung von Agentur oder EHG weder veröffentlicht noch als Referenz genutzt werden.',
            '1. The Creator shall treat non-public information regarding the project, the Agency, and EHG as confidential. Unpublished content and the collaboration may not be published or used as a reference without the prior consent of the Agency or EHG.'),
          t('2. Der Vertrag endet mit vollständiger Erfüllung. Gesetzliche Kündigungsrechte bleiben unberührt. Nutzungsrechte, Vertraulichkeit sowie Ansprüche wegen bereits eingetretener Pflichtverletzungen bestehen im vereinbarten beziehungsweise gesetzlichen Umfang fort.',
            '2. The contract terminates upon full performance. Statutory rights of termination remain unaffected. Rights of use, confidentiality, and claims arising from breaches of duty that have already occurred shall continue to apply to the extent agreed upon or required by law.')
        ]
      },
      {
        title: t('§ 6 Rechte von EHG als begünstigte Dritte', '§ 6 Rights of EHG as a Third-Party Beneficiary'),
        items: [
          t('1. EHG ist begünstigte Dritte im Sinne von § 328 BGB und erwirbt die nachfolgend bestimmten eigenen Rechte gegen den Creator. Die zugunsten von EHG entstandenen Rechte können ohne Zustimmung von EHG in Textform nicht nachträglich aufgehoben oder beschränkt werden.',
            '1. EHG is a third-party beneficiary within the meaning of section 328 of the German Civil Code and acquires the rights set out below directly against the Creator. The rights arising in favor of EHG may not be subsequently revoked or restricted without EHG’s consent in text form.'),
          t('2. EHG kann im eigenen Namen die vertragsgemäße Erstellung und Lieferung des Contents, die Nacherfüllung nach § 1 Abs. 6 sowie die Unterlassung und Beseitigung einer vertragswidrigen Veröffentlichung oder Weitergabe verlangen. EHG kann ferner verlangen, dass der Creator EHG die im Projektblatt ausgewählten Nutzungs- und Persönlichkeitsrechte unmittelbar einräumt. Eine Leistung an EHG erfüllt die entsprechende Verpflichtung gegenüber der Agentur.',
            '2. EHG may, in its own name, require the Creator to create and deliver the Content in accordance with this Agreement, require cure pursuant to Section 1(6) and require cessation and removal of any publication or disclosure in breach of this Agreement. EHG may further demand that the Creator directly grant EHG the rights of use and personality rights selected in the project sheet. Performance rendered to EHG discharges the corresponding obligation owed to the Agency.'),
          t('3. Soweit EHG selbst betroffen ist, kann EHG Schadensersatz-, Aufwendungsersatz-, Nachweis- und Freistellungsansprüche wegen einer schuldhaften Verletzung der §§ 1, 3, 4 oder 5 im eigenen Namen geltend machen.',
            '3. To the extent that EHG itself is affected, EHG may assert claims for damages, reimbursement of expenses, provision of evidence, and indemnification in its own name arising from an intentional or negligent breach of Sections 1, 3, 4 or 5.'),
          t('4. Die fachliche Abstimmung erfolgt grundsätzlich über die Agentur. EHG darf dem Creator unmittelbar verbindliche Weisungen erteilen, soweit diese der Einhaltung des Projektblatts, des Briefings, technischer oder markenbezogener Vorgaben oder der Vermeidung rechtlicher Risiken dienen. Bei widersprechenden Weisungen informiert der Creator Agentur und EHG unverzüglich. Im Zweifel geht die Weisung von EHG vor.',
            '4. Substantive coordination shall generally be conducted through the Agency. EHG may issue binding instructions directly to the Creator to the extent that such instructions serve to ensure compliance with the project sheet, the briefing, technical or brand-related specifications, or the avoidance of legal risks. In the event of conflicting instructions, the Creator shall inform the agency and EHG immediately. In case of doubt, EHG’s instructions shall take precedence.'),
          t('5. Die gesetzlichen Einwendungen des Creators aus diesem Vertrag bleiben bestehen.',
            '5. The Creator’s statutory defenses arising from this contract remain in effect.')
        ]
      },
      {
        title: t('§ 7 Haftung der Agentur', '§ 7 Liability of the Agency'),
        items: [
          t('1. Die Agentur haftet unbeschränkt für Schäden, die auf Vorsatz oder grober Fahrlässigkeit der Agentur, ihrer gesetzlichen Vertreter oder Erfüllungsgehilfen beruhen, sowie für Schäden aus der schuldhaften Verletzung des Lebens, des Körpers oder der Gesundheit. Bei leicht fahrlässiger Verletzung einer wesentlichen Vertragspflicht haftet die Agentur nur auf Ersatz des bei Vertragsschluss vorhersehbaren, vertragstypischen Schadens. Wesentliche Vertragspflichten sind Pflichten, deren Erfüllung die ordnungsgemäße Durchführung dieses Vertrages überhaupt erst ermöglicht und auf deren Einhaltung der Creator regelmäßig vertrauen darf. Im Übrigen ist die Haftung der Agentur für leicht fahrlässig verursachte Schäden ausgeschlossen.',
            '1. The Agency shall be liable without limitation for loss or damage resulting from intentional conduct or gross negligence on the part of the Agency, its statutory representatives or persons engaged by it in performing its contractual obligations, and for loss or damage arising from death, personal injury or impairment of health. In the event of a negligent breach not amounting to gross negligence of a Material Contractual Obligation, the Agency shall be liable only for the loss or damage that was foreseeable when this Agreement was entered into and is typical of this type of Agreement.'),
          t('2. Die vorstehenden Haftungsbeschränkungen gelten für sämtliche Schadensersatzansprüche unabhängig von ihrem Rechtsgrund und entsprechend zugunsten der gesetzlichen Vertreter, Mitarbeiter und Erfüllungsgehilfen der Agentur.',
            '2. The foregoing limitations of liability apply to all claims for damages, regardless of their legal basis, and extend accordingly to the Agency’s statutory representatives, employees, and persons engaged by the Agency in performing its contractual obligations.')
        ]
      },
      {
        title: t('§ 8 Schlussbestimmungen', '§ 8 Final Provisions'),
        items: [
          t('1. Änderungen und Ergänzungen dieses Vertrags und des Projektblatts bedürfen der Textform. Individuelle Abreden haben Vorrang.',
            '1. Amendments and additions to this contract and the project sheet must be made in text form. Individually negotiated agreements shall take precedence.'),
          t('2. Entgegenstehende Geschäftsbedingungen des Creators gelten nur, wenn die Agentur ihnen in Textform zustimmt.',
            '2. Any conflicting standard terms and conditions of the Creator shall apply only if the Agency agrees to them in text form.'),
          t('3. Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts. Ein Gerichtsstand am Sitz der Agentur gilt nur, soweit dies gesetzlich zulässig ist.',
            '3. German law applies, excluding the UN Convention on Contracts for the International Sale of Goods. The courts at the Agency’s registered office shall have jurisdiction only to the extent permitted by law.'),
          t('4. Sollte eine Bestimmung unwirksam oder undurchführbar sein, bleibt der Vertrag im Übrigen wirksam. An die Stelle der Bestimmung tritt die gesetzliche Regelung.',
            '4. Should any provision be invalid or unenforceable, the remainder of the contract shall remain in full force and effect. The invalid or unenforceable provision shall be replaced by the applicable statutory provision.'),
          t('5. Der Vertrag wird zweisprachig deutsch/englisch ausgefertigt. Die englische Fassung enthält zusätzlich Definitionen der deutschen Rechtsbegriffe „Textform“ und Persönlichkeitsrechte. Im Zweifel gilt die deutsche Vertragsfassung.',
            '5. The Agreement shall be executed in two languages, German and English. The English version additionally contains definitions of the German legal terms “Textform” and “Persönlichkeitsrechte”. In the event of any doubt, the German version of the Agreement shall prevail.')
        ]
      }
    ];

    sections.forEach((section) => {
      heading(section.title);
      section.items.forEach((item) => para(item));
    });

    signatureBlock();
    addFooter();

    doc.addPage();
    y = 20;
    heading(t('PROJEKTBLATT', 'PROJECT SHEET'));
    para(t(
      'Anlage zum UGC-Content-Produktionsvertrag',
      'Appendix to the UGC Content Production Agreement'
    ), { style: 'bold' });

    const blank = (v) => (v && String(v).trim() !== '' ? String(v) : '________________');
    const kampagne = this.kampagnen.find(k => k.id === vertrag.kampagne_id);
    const projektLabel = ehgKampagneAnzeige(kampagne, (k) => this.getKampagneDisplayName(k));
    const creatorLabel = ehgCreatorAnzeige(creator, (v) => this._extractHandle?.(v) || '');
    const markeProduktLabel = ehgMarkeProduktAnzeige(ehg, this.ehgMarken || [], this.ehgProdukte || []);
    para(`${t('Projekt / Kampagne', 'Project / Campaign')}: ${blank(projektLabel)}`);
    para(`${t('Marke / Produkt', 'Brand / Product')}: ${blank(markeProduktLabel)}`);
    para(`${t('Creator / Handle', 'Creator / Handle')}: ${blank(creatorLabel)}`);
    para(`${t('Ansprechpartner Agentur / EHG', 'Agency / EHG Contact')}: ${blank(ehg.ansprechpartner)}`);

    heading(t('Leistung', 'Services'));
    para(`${t('Video(s)', 'Video(s)')}: ${vertrag.anzahl_videos || 0}     ${t('Foto(s)', 'Photo(s)')}: ${vertrag.anzahl_fotos || 0}`);
    if (ehg.content_sonstiges) para(`${t('Sonstiges', 'Other')}: ${ehg.content_sonstiges}`);

    const liefer = mappedEhgLieferbestandteile(vertrag, ehg);
    const lieferLabels = {
      finaler_schnitt: t('finaler Schnitt', 'Final cut'),
      rohschnitt: t('Rohschnitt', 'Rough cut'),
      rohmaterial: t('Rohmaterial', 'Raw footage'),
      untertitel: t('Untertitel / Caption', 'Subtitles / Captions'),
      thumbnail: t('Thumbnail / Cover', 'Thumbnail / Cover')
    };
    ensure(16);
    para(t('Lieferbestandteile:', 'Deliverables:'), { after: 1 });
    Object.entries(lieferLabels).forEach(([key, label]) => {
      ensure(6);
      drawCheckbox(LEFT, y, liefer.includes(key), label);
      y += 5;
    });
    y += 2;

    const konzeption = mappedEhgKonzeption(vertrag.content_erstellung_art);
    const konzeptLabels = {
      skript_gestellt: t('Skript wird gestellt', 'Script provided'),
      umsetzung_briefing: t('Umsetzung nach Briefing', 'Production based on briefing'),
      creator_konzeption: t('Creators Konzeption nach Briefing', 'Creator’s concept based on briefing')
    };
    para(t('Konzeption:', 'Concept:'), { after: 1 });
    Object.entries(konzeptLabels).forEach(([key, label]) => {
      ensure(6);
      drawCheckbox(LEFT, y, konzeption.includes(key), label);
      y += 5;
    });
    y += 2;
    if (ehg.technische_vorgaben) para(`${t('Technische Vorgaben / Format', 'Technical Specifications / Format')}: ${ehg.technische_vorgaben}`);
    para(`${t('Entwurf bis', 'Draft due by')}: ${ehg.entwurf_bis ? this.formatContractDate(ehg.entwurf_bis, lang) : '________________'}`);
    para(`${t('Finale Lieferung bis', 'Final delivery by')}: ${vertrag.content_deadline ? this.formatContractDate(vertrag.content_deadline, lang) : '________________'}`);

    heading(t('Nutzungsumfang', 'Scope of Use'));
    para(t('Es gelten ausschließlich die angekreuzten Nutzungen.', 'Only the checked uses apply.'));
    const nutzungLabels = [
      ['organic_social', t('Organic Social Media', 'Organic social media')],
      ['organic_youtube', t('Organic YouTube', 'Organic YouTube')],
      ['paid_youtube', t('Paid YouTube', 'Paid YouTube')],
      ['paid_media', t('Paid Media / Paid Social über Accounts von EHG oder beauftragten Mediendienstleistern', 'Paid media / Paid Social via EHG accounts or accounts of media service providers engaged by EHG')],
      ['website', t('Website / Onlineshop / App', 'Website / Online Store / App')],
      ['newsletter', t('Newsletter / CRM', 'Newsletter / CRM')],
      ['intern', t('interne Kommunikation/Präsentation', 'Internal Communication / Presentation')],
      ['whitelisting', t('Whitelisting über Account/Handle des Creators', 'Whitelisting via the creator’s account/handle')],
      ['partnership_ads', t('Partnership Ads / Branded Content Ads', 'Partnership Ads / Branded Content Ads')],
      ['pr', t('PR / Presse / Unternehmenskommunikation', 'PR / Press / Corporate Communications')],
      ['print', t('Print / Katalog / Flyer / POS', 'Print / Catalog / Flyer / POS')],
      ['aussenwerbung', t('Außenwerbung', 'Outdoor advertising')]
    ];
    const nutzungen = ehg.nutzungen || [];
    nutzungLabels.forEach(([key, label]) => {
      ensure(6);
      drawCheckbox(LEFT, y, nutzungen.includes(key), label);
      y += 5;
    });
    if (ehg.nutzung_sonstiges) para(`${t('Sonstiges', 'Other')}: ${ehg.nutzung_sonstiges}`);
    y += 2;

    para(t('Rechte an Person oder Identität zusätzlich zum Bild und zur Stimme im Content:', 'Additional Personality Rights relating to the Creator’s identity:'), { after: 1 });
    const rechteLabels = [
      ['name', t('Name / Pseudonym', 'Name / Pseudonym')],
      ['handle', t('Social-Media-Handle', 'Social media handle')],
      ['stills', t('Einzelbilder / Thumbnail', 'Still images / thumbnails')],
      ['bio', t('biografische Angaben', 'Biographical information')],
      ['credit', t('Credit / Namensnennung', 'Credit / Attribution')]
    ];
    const rechte = ehg.persoenlichkeitsrechte || [];
    rechteLabels.forEach(([key, label]) => {
      ensure(6);
      drawCheckbox(LEFT, y, rechte.includes(key), label);
      y += 5;
    });
    y += 2;

    const gebiet = ehg.gebiet;
    para(t('Gebiet:', 'Territory:'), { after: 1 });
    [
      ['weltweit', t('weltweit', 'Worldwide')],
      ['deutschland', t('Deutschland', 'Germany')],
      ['eu_ewr', t('EU / EWR', 'EU / EEA')],
      ['sonstiges', t('sonstiges', 'Other')]
    ].forEach(([key, label]) => {
      ensure(6);
      drawCheckbox(LEFT, y, gebiet === key, label);
      y += 5;
    });
    if (ehg.gebiet_sonstiges) para(ehg.gebiet_sonstiges);

    para(t('Dauer Organic:', 'Duration Organic:'), { after: 1 });
    drawCheckbox(LEFT, y, ehg.dauer_organic === 'unbegrenzt', t('unbefristet', 'Unlimited in time'));
    y += 5;
    drawCheckbox(LEFT, y, ehg.dauer_organic === 'sonstiges', t('sonstiges', 'Other'));
    y += 5;
    if (ehg.dauer_organic_sonstiges) para(ehg.dauer_organic_sonstiges);

    para(t('Dauer Paid:', 'Duration Paid:'), { after: 1 });
    [
      ['unbegrenzt', t('unbefristet', 'Unlimited in time')],
      ['6_monate', t('6 Monate', '6 months')],
      ['12_monate', t('12 Monate', '12 months')],
      ['24_monate', t('24 Monate', '24 months')],
      ['sonstiges', t('sonstiges', 'Other')]
    ].forEach(([key, label]) => {
      ensure(6);
      drawCheckbox(LEFT, y, ehg.dauer_paid === key, label);
      y += 5;
    });
    if (ehg.dauer_paid_sonstiges) para(ehg.dauer_paid_sonstiges);

    heading(t('Vergütung und Produkte', 'Remuneration and Products'));
    const money = this.formatContractMoney(vertrag.verguetung_netto ?? ehg.verguetung_netto, lang, { emptyValue: '________________' });
    para(`${t('Pauschalhonorar netto', 'Net flat fee')}: ${money} EUR`);
    para(t('Umsatzsteuer:', 'Value-Added Tax:'), { after: 1 });
    drawCheckbox(LEFT, y, ehg.ust === 'faellt_an', t('fällt an', 'applicable'));
    y += 5;
    drawCheckbox(LEFT, y, ehg.ust === 'kleinunternehmer', t('fällt nicht an / Kleinunternehmerregelung', 'not applicable / German small-business VAT scheme'));
    y += 7;
    if (ehg.zusatzleistungen) para(`${t('Zusatzleistungen / Auslagen', 'Additional Services / Expenses')}: ${ehg.zusatzleistungen}`);
    drawCheckbox(LEFT, y, !!ehg.produkte_verbleiben, t('Bereitgestellte Produkte verbleiben beim Creator', 'Products provided remain with the Creator'));
    y += 8;

    heading(t('Verbindliche Unterlagen', 'Binding Documents'));
    const unterlagen = ehg.unterlagen || [];
    [
      ['briefing', 'Briefing'],
      ['dos_donts', t('Do’s & Don’ts', 'Do’s & Don’ts')],
      ['technisch', t('technische Vorgaben', 'Technical Specifications')],
      ['sonstiges', t('sonstiges', 'Other')]
    ].forEach(([key, label]) => {
      ensure(6);
      drawCheckbox(LEFT, y, unterlagen.includes(key), label);
      y += 5;
    });
    if (ehg.unterlagen_sonstiges) para(ehg.unterlagen_sonstiges);
    if (ehg.unterlagen_bezeichnung) para(`${t('Bezeichnung, Datum und Version', 'Document title, date, and version')}: ${ehg.unterlagen_bezeichnung}`);
    drawCheckbox(LEFT, y, ehg.unterlagen_weg === 'beigefuegt', t('beigefügt', 'attached'));
    y += 5;
    drawCheckbox(LEFT, y, ehg.unterlagen_weg === 'elektronisch', `${t('elektronisch übermittelt am', 'sent electronically on')}: ${ehg.unterlagen_datum ? this.formatContractDate(ehg.unterlagen_datum, lang) : '__________'}`);
    y += 6;

    signatureBlock();
    addFooter();

    const pdfBlob = doc.output('blob');
    const filePrefix = en ? 'EN_Contract_EHG' : 'Vertrag_EHG';
    const fileName = `${filePrefix}_${vertrag.name || 'UGC'}_${new Date().toISOString().split('T')[0]}.pdf`;
    const uploadResult = await uploadGeneratedVertragPdf(this, vertrag, pdfBlob, fileName);
    if (uploadResult?.fileUrl) {
      console.log('✅ EHG-Vertrag-PDF nach Dropbox hochgeladen');
    } else {
      console.warn('⚠️ Dropbox-Upload nicht erfolgreich – PDF wird nur lokal heruntergeladen');
    }
    doc.save(fileName);
  } catch (error) {
    console.error('❌ Fehler bei EHG-Vertrag-PDF-Generierung:', error);
    window.toastSystem?.show('PDF konnte nicht generiert werden', 'warning');
    throw error;
  }
};
