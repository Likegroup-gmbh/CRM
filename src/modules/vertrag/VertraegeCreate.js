// VertraegeCreate.js (ES6-Modul)
// Multistep-Formular zur Vertragserstellung (mit DB-Draft Support)

import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import CONFIG from '../../core/ConfigSystem.js';

const CONTRACT_TEXT_TRANSLATIONS = {
  en: {
    'Seite': 'Page',
    'Seite ': 'Page ',
    'Seite 1 von 1': 'Page 1 of 1',
    'LikeGroup GmbH | Jakob-Latscha-Str. 3 | 60314 Frankfurt am Main | Deutschland': 'LikeGroup GmbH | Jakob-Latscha-Str. 3 | 60314 Frankfurt am Main | Germany',
    'Ja': 'Yes',
    'Nein': 'No',
    'Ja (3% bei Zahlung innerhalb 7 Tage)': 'Yes (3% for payment within 7 days)',
    'Skonto:': 'Cash discount:',
    'Sonstige': 'Other',
    'Deutschland': 'Germany',
    'UGC-PRODUKTIONSVERTRAG': 'UGC PRODUCTION AGREEMENT',
    'INFLUENCER-KOOPERATIONSVERTRAG': 'INFLUENCER COOPERATION AGREEMENT',
    'VIDEOGRAFEN- & FOTOGRAFEN-PRODUKTIONSVERTRAG': 'VIDEOGRAPHER & PHOTOGRAPHER PRODUCTION AGREEMENT',
    'Agenturdaten': 'Agency details',
    'Kundendaten': 'Client details',
    'Creatordaten': 'Creator details',
    'Influencer-Vertretung': 'Influencer representation',
    'Influencer / Vertretung': 'Influencer / representation',
    'Influencer-Daten': 'Influencer details',
    'PO / Auftragsnummer': 'PO / order number',
    'Ohne Name': 'Untitled',
    'Wird der Influencer durch eine Agentur vertreten?': 'Is the influencer represented by an agency?',
    'Zwingend auf der Rechnung anzugeben. Ohne Angabe ist keine Zahlung möglich.': 'Mandatory on the invoice. Payment is not possible without it.',
    'Fertiges Skript vom Auftraggeber': 'Final script provided by client',
    'Briefing vom Auftraggeber, direkter Dreh ohne Skript': 'Client briefing, direct shoot without script',
    'Briefing vom Auftraggeber, Skript durch Creator': 'Client briefing, script prepared by creator',
    'Eigenständige Konzeption durch Creator': 'Independent concept by creator',
    'Fertig geschnittenes Video': 'Final edited video',
    'Raw Cut (Szenen aneinandergeschnitten)': 'Raw cut (scenes stitched together)',
    'Rohmaterial (ungeschnittene Clips)': 'Raw footage (unedited clips)',
    'Organische Nutzung': 'Organic usage',
    'Paid Ads Nutzung': 'Paid ads usage',
    'Organisch & Paid Ads': 'Organic & paid ads',
    'Unbegrenzt': 'Unlimited',
    '12 Monate': '12 months',
    '6 Monate': '6 months',
    '3 Monate': '3 months',
    'Jahre': 'years',
    'Monate': 'months',
    'Wochen': 'weeks',
    'Tage': 'days',
    '30 Tage': '30 days',
    '45 Tage': '45 days',
    '60 Tage': '60 days',
    '14 Tage': '14 days',
    '7 Tage': '7 days',
    'Social Media': 'Social media',
    'Website': 'Website',
    '§1 Vertragsgegenstand': '§1 Subject of agreement',
    '§2 Leistungsumfang': '§2 Scope of services',
    '§3 Output & Lieferumfang': '§3 Output & delivery scope',
    '§4 Nutzungsrechte': '§4 Usage rights',
    '§5 Vergütung': '§5 Compensation',
    '§6 Deadlines & Korrekturen': '§6 Deadlines & revisions',
    '§7 Rechte Dritter': '§7 Third-party rights',
    '§8 Verschwiegenheit': '§8 Confidentiality',
    '§9 Qualitätsrichtlinien & Briefings': '§9 Quality guidelines & briefings',
    '§10 Neudreh, Anpassungen & Rücktrittsrecht': '§10 Reshoot, adjustments & right of withdrawal',
    '§11 Agenturbeauftragung & Stellvertretung': '§11 Agency mandate & representation',
    '§12 Schlussbestimmungen': '§12 Final provisions',
    '§13 Vertragsschluss': '§13 Conclusion of agreement',
    '§14 Weitere Bestimmungen': '§14 Additional provisions',
    '§2 Plattformen & Inhalte': '§2 Platforms & content',
    '§3 Konzept, Freigabe & Veröffentlichungsplan': '§3 Concept, approval & publication plan',
    '§4 Werbekennzeichnung': '§4 Ad labeling',
    '§5 Nutzungsrechte & Media Buyout': '§5 Usage rights & media buyout',
    '§6 Vergütung': '§6 Compensation',
    '§7 Qualitätsanforderungen': '§7 Quality requirements',
    '§8 Anpassungen': '§8 Adjustments',
    '§9 Neuerstellung (Neudreh)': '§9 Reproduction (reshoot)',
    '§10 Reichweiten-Garantie': '§10 Reach guarantee',
    '§11 Mindest-Online-Dauer': '§11 Minimum online duration',
    '§12 Rechte Dritter': '§12 Third-party rights',
    '§8 Rechte Dritter': '§8 Third-party rights',
    '§13 Künstlersozialkasse': '§13 Artists social fund',
    '§14 Rücktritt': '§14 Withdrawal',
    '§15 Vertragsschluss': '§15 Conclusion of agreement',
    '§16 Weitere Bestimmungen': '§16 Additional provisions',
    '§3 Output, Abgabe & Versionierung': '§3 Output, delivery & versioning',
    '§4 Qualitätsanforderungen': '§4 Quality requirements',
    '§5 Nachbesserung & Neuerstellung': '§5 Rework & reproduction',
    '§7 Nutzungsrechte': '§7 Usage rights',
    '§9 Vergütung': '§9 Compensation',
    '§10 Verschwiegenheit': '§10 Confidentiality',
    '§11 Rücktritt': '§11 Withdrawal',
    '§12 Vertragsschluss': '§12 Conclusion of agreement',
    '§13 Weitere Bestimmungen': '§13 Additional provisions',
    'Der Auftraggeber beauftragt den Creator mit der Erstellung von User Generated Content (UGC)': 'The client commissions the creator to produce user generated content (UGC).',
    'zu Marketingzwecken. Es handelt sich um einen einmaligen Produktionsauftrag.': 'The content is created for marketing purposes as a one-time production assignment.',
    'Die Vergütung versteht sich zzgl. gesetzlicher Umsatzsteuer, sofern diese anfällt.': 'Compensation is exclusive of statutory VAT if applicable.',
    'Bei Skonto gilt: Bei Zahlung innerhalb von 7 Kalendertagen ab Rechnungsdatum gewährt der': 'Cash discount rule: for payment within 7 calendar days from invoice date, the',
    'Creator 3% Skonto auf den Nettorechnungsbetrag. Der Skonto-Hinweis ist auf der Rechnung auszuweisen.': 'creator grants a 3% discount on the net invoice amount. The discount must be stated on the invoice.',
    'Sofern vereinbart, gelten folgende Unterlagen als verbindlicher Bestandteil dieses Vertrags:': 'If agreed, the following documents are binding parts of this agreement:',
    "• Do's & Don'ts": "• Do's & don'ts",
    '• Externe Briefings': '• External briefings',
    '• Kampagnen-Guidelines': '• Campaign guidelines',
    '• Zusätzliche schriftliche Vorgaben des Auftraggebers oder der Agentur': '• Additional written requirements from the client or agency',
    'Diese Unterlagen konkretisieren die qualitativen und inhaltlichen Anforderungen an den Content.': 'These documents specify the qualitative and content requirements for the content.',
    'Ein Anspruch auf Neudreh besteht insbesondere bei:': 'A claim for reshoot exists in particular in the following cases:',
    '• Abweichung vom Skript oder Briefing': '• Deviation from script or briefing',
    '• Unzureichender Tonqualität': '• Insufficient audio quality',
    '• Schlechter Beleuchtung oder Bildqualität': '• Poor lighting or image quality',
    '• Unnatürlicher oder stark werblicher Darstellung': '• Unnatural or overly promotional presentation',
    '• Unpassendem oder unaufgeräumtem Hintergrund': '• Inappropriate or cluttered background',
    '• Fehlender Kreativität, Dynamik oder Energie': '• Lack of creativity, dynamics, or energy',
    '• Missachtung der Qualitätsrichtlinien, Rechtsverstößen, unangemessenen Inhalten': '• Disregard of quality guidelines, legal violations, or inappropriate content',
    '• Inhaltlich oder qualitativ nicht verwertbarem Content': '• Content unusable in terms of quality or substance',
    'Als Anpassungen gelten insbesondere:': 'Adjustments include in particular:',
    '• Schnittgeschwindigkeit, Optimierung des Einstiegs (Hook)': '• Editing speed, optimization of opening hook',
    '• Kürzen, Straffen oder Umstellen von Szenen': '• Trimming, tightening, or rearranging scenes',
    '• Anpassung der Dramaturgie, Zoom-/Bewegungseffekte, Untertitel': '• Storyline adjustments, zoom/motion effects, subtitles',
    '• Nachfilmen einzelner Szenen, allgemeiner Performance-Feinschliff': '• Re-shooting specific scenes, general performance polishing',
    'Änderungen bedürfen der Schriftform. Sollten einzelne Bestimmungen unwirksam sein, bleibt der': 'Changes must be in writing. If individual provisions are invalid, the',
    'Vertrag im Übrigen wirksam.': 'agreement remains valid in all other respects.',
    'Dieser Vertrag wird mit der Unterschrift des Creators wirksam.': 'This agreement becomes effective upon signature by the creator.',
    'Eine zusätzliche Unterschrift der LikeGroup GmbH ist nicht erforderlich.': 'An additional signature by LikeGroup GmbH is not required.',
    'Ort, Datum: ___________________________': 'Place, date: ___________________________',
    'Creator: ______________________________': 'Creator: ______________________________',
    'Keine Exklusivität': 'No exclusivity',
    'Keine Zusatzkosten': 'No additional costs',
    'Zusatzkosten vereinbart': 'Additional costs agreed',
    '2.1 Content-Art und Anzahl': '2.1 Content type and quantity',
    '2.2 Art der Content-Erstellung': '2.2 Type of content creation',
    '3.1 Art der Lieferung': '3.1 Type of delivery',
    '3.2 Rohmaterial enthalten': '3.2 Raw footage included',
    '3.3 Untertitel': '3.3 Subtitles',
    '4.1 Nutzungsart': '4.1 Usage type',
    '4.2 Medien': '4.2 Media',
    '4.3 Nutzungsdauer': '4.3 Usage duration',
    '4.4 Exklusivität': '4.4 Exclusivity',
    '5.1 Vergütung': '5.1 Compensation',
    '5.2 Zahlungsbedingungen': '5.2 Payment terms',
    '6.1 Content-Deadline': '6.1 Content deadline',
    '6.2 Korrekturschleifen': '6.2 Revision rounds',
    '10.1 Anspruch auf Neudreh': '10.1 Right to reshoot',
    '10.2 Anpassungen (Korrekturschleifen)': '10.2 Adjustments (revision rounds)',
    '10.3 Rücktrittsrecht': '10.3 Right of withdrawal',
    '2.1 Plattformen': '2.1 Platforms',
    '2.2 Inhalte': '2.2 Content',
    '3.1 Korrekturschleifen': '3.1 Revision rounds',
    '3.2 Veröffentlichungsplan': '3.2 Publication plan',
    'Videos / Reels:': 'Videos / reels:',
    'Feed-Posts:': 'Feed posts:',
    '5.1 Organische Veröffentlichung': '5.1 Organic publication',
    '5.2 Zusätzliche Nutzung für Werbung (Media Buyout)': '5.2 Additional usage for advertising (media buyout)',
    '5.3 Exklusivität': '5.3 Exclusivity',
    'Kostenfreie Anpassungen umfassen u.a.:': 'Free adjustments include, among others:',
    'Keine Garantie': 'No guarantee',
    'Auftragnehmer (Videograf / Fotograf)': 'Contractor (videographer / photographer)',
    '2.1 Art der Leistung': '2.1 Type of service',
    '2.2 Produktionsart': '2.2 Production type',
    '2.3 Drehtage & Produktionsorte': '2.3 Shooting days & production locations',
    '3.1 Lieferumfang': '3.1 Delivery scope',
    '3.2 Abgabe der ersten Version (V1)': '3.2 Delivery of first version (V1)',
    '3.3 Korrekturschleifen': '3.3 Revision rounds',
    '3.4 Abgabe der finalen Version': '3.4 Delivery of final version',
    '9.1 Vergütung': '9.1 Compensation',
    '9.2 Zahlungsbedingungen': '9.2 Payment terms',
    '5.1 Nachbesserung (Korrekturen)': '5.1 Rework (revisions)',
    '5.2 Neuerstellung (Neudreh)': '5.2 Reproduction (reshoot)',
    'Produktion nach Briefing': 'Production based on briefing',
    'Produktion nach Skript / Shotlist': 'Production based on script / shot list',
    'Eigenständige Umsetzung nach Zielvorgabe': 'Independent execution based on objective',
    'Farbkorrektur / Grading enthalten': 'Color correction / grading included',
    'Sounddesign enthalten': 'Sound design included',
    'Rohmaterial (alle Clips)': 'Raw footage (all clips)',
    'Projektdateien (z.B. Premiere / Final Cut)': 'Project files (e.g. Premiere / Final Cut)',
    'Paid Ads': 'Paid ads',
    'Alle Medien (Social Media, Website, OTV, Print)': 'All media (social media, website, OTV, print)',
    'Schnitt & Tempo': 'Editing & pace',
    'Hook / Einstieg': 'Hook / opening',
    'Szenenreihenfolge': 'Scene order',
    'Effekte / Zooms': 'Effects / zooms',
    'Untertitel': 'Subtitles',
    'Nachfilmen einzelner Szenen': 'Re-shooting individual scenes',
    'Co-Autoren-Post / Collab': 'Co-author post / collab',
    'Zusätzliche Veröffentlichung durch Unternehmen/Kunden': 'Additional publication by company/client',
    'Keine zusätzliche Veröffentlichung durch Unternehmen/Kunden': 'No additional publication by company/client',
    'Ort: ': 'Location: ',
    'Keine Drehtage angegeben': 'No shooting days specified',
    'Eine Korrekturschleife umfasst jeweils eine überarbeitete Version nach Feedback.': 'One revision round includes one revised version after feedback.',
    'Eine Urheberbenennung ist nicht erforderlich, sofern nicht ausdrücklich vereinbart.': 'Author credit is not required unless explicitly agreed.',
    'Auftragnehmer: ___________________________': 'Contractor: ___________________________',
    'Influencer / Vertreter: ___________________________': 'Influencer / representative: ___________________________',
    'Der Creator garantiert, dass der Content frei von Rechten Dritter ist. Insbesondere dürfen keine': 'The creator guarantees that the content is free of third-party rights. In particular, no',
    'fremden Marken, Logos, Musikstücke, geschützten Inhalte oder Personen ohne entsprechende Rechte': 'third-party brands, logos, music tracks, protected content, or persons without appropriate rights',
    'oder Einwilligungen verwendet werden. Der Creator haftet für sämtliche daraus entstehenden': 'or consents may be used. The creator is liable for all resulting',
    'Rechtsverletzungen.': 'legal infringements.',
    'Der Creator verpflichtet sich zur vollständigen Verschwiegenheit über Inhalt, Ablauf und Ergebnisse': 'The creator commits to complete confidentiality regarding content, process, and results',
    'dieses Auftrags. Eine Veröffentlichung, Weitergabe oder Erwähnung des Contents vor der offiziellen': 'of this assignment. Publication, forwarding, or mention of the content prior to official',
    'Nutzung durch den Auftraggeber ist untersagt. Bei Verstoß kann eine angemessene Vertragsstrafe': 'use by the client is prohibited. In case of breach, an appropriate contractual penalty may be',
    'geltend gemacht werden.': 'claimed.',
    'Erfüllt der Creator die vereinbarten Anforderungen auch nach Nachbesserung oder Neudreh wiederholt': 'If the creator repeatedly fails to meet agreed requirements even after rework or reshoot,',
    'nicht, ist der Auftraggeber berechtigt, vom Vertrag zurückzutreten und bereits gezahlte Vergütungen': 'the client is entitled to withdraw from the agreement and reclaim compensation already paid',
    'anteilig oder vollständig zurückzufordern.': 'in part or in full.',
    '• Die Agentur handelt im Namen und auf Rechnung des Kunden.': '• The agency acts in the name and on behalf of the client.',
    '• Vertragspartner des Creators ist ausschließlich der Kunde.': '• The creator\'s contractual partner is exclusively the client.',
    '• Sämtliche Nutzungsrechte gehen unmittelbar auf den Kunden über.': '• All usage rights transfer directly to the client.',
    '• Weisungen und Abnahmen der Agentur gelten als verbindlich.': '• Agency instructions and approvals are binding.',
    '• Die Agentur übernimmt keine Haftung für Inhalt oder Rechtskonformität.': '• The agency assumes no liability for content or legal compliance.',
    'Der Influencer verpflichtet sich zur Erstellung und Veröffentlichung werblicher Inhalte zugunsten des Auftraggebers bzw. eines von der LikeGroup GmbH betreuten Kunden.': 'The influencer commits to creating and publishing promotional content for the client or a customer managed by LikeGroup GmbH.',
    'Der Content ist der LikeGroup GmbH vor Veröffentlichung zur Freigabe vorzulegen. Produktion und Veröffentlichung dürfen erst nach Freigabe erfolgen.': 'The content must be submitted to LikeGroup GmbH for approval before publication. Production and publication may only occur after approval.',
    'Der Influencer verpflichtet sich zur vollständigen, gesetzeskonformen Kennzeichnung der Inhalte (z.B. „Werbung", „Anzeige", „Paid Partnership").': 'The influencer commits to full, legally compliant labeling of content (e.g. "advertisement", "ad", "paid partnership").',
    'Der Content muss insbesondere: technisch sauber (Ton, Licht, Bild), natürlich und nicht übermäßig werblich, markenkonform, visuell hochwertig, kreativ, lebendig und mit ästhetisch geeignetem Hintergrund umgesetzt sein.': 'The content must in particular be technically clean (audio, lighting, image), natural and not overly promotional, on-brand, visually high-quality, creative, vivid, and produced with an aesthetically suitable background.',
    'Weicht der Content erheblich vom Briefing oder den Qualitätsanforderungen ab und ist nicht anpassbar, ist er vor Veröffentlichung kostenfrei neu zu erstellen.': 'If the content significantly deviates from the briefing or quality requirements and cannot be adjusted, it must be recreated free of charge before publication.',
    'Der Influencer garantiert, dass der Content frei von Rechten Dritter ist und haftet für Rechtsverletzungen.': 'The influencer guarantees that the content is free of third-party rights and is liable for legal infringements.',
    'Die KSK-Abgabe wird – sofern relevant – vom Auftraggeber abgeführt und nicht gesondert auf der Rechnung des Influencers ausgewiesen.': 'The KSK levy, where applicable, is paid by the client and is not listed separately on the influencer invoice.',
    'Bei Nichterfüllung, wiederholter Qualitätsabweichung oder Nichtveröffentlichung ist ein Rücktritt zulässig. Ein Vergütungsanspruch besteht dann nicht.': 'In case of non-performance, repeated quality deviations, or non-publication, withdrawal is permitted. There is then no entitlement to compensation.',
    'Der Vertrag wird mit Unterschrift des Influencers oder seines Vertretungsberechtigten wirksam. Eine Gegenzeichnung der LikeGroup GmbH ist nicht erforderlich.': 'The agreement becomes effective upon signature by the influencer or authorized representative. A countersignature by LikeGroup GmbH is not required.',
    'Der Auftragnehmer verpflichtet sich zur professionellen Erstellung von Foto- und/oder Videomaterial zu Marketing- und Kommunikationszwecken des Auftraggebers bzw. eines von der LikeGroup GmbH betreuten Kunden. Es handelt sich um einen einmaligen Produktionsauftrag.': 'The contractor commits to professionally producing photo and/or video material for the client\'s marketing and communication purposes or for a customer managed by LikeGroup GmbH. This is a one-time production assignment.',
    'Der Auftragnehmer verpflichtet sich, zum vereinbarten Zeitpunkt vollständig einsatzbereit zu erscheinen und die Produktion fachgerecht durchzuführen.': 'The contractor commits to appearing fully ready at the agreed time and carrying out the production professionally.',
    'Der Auftragnehmer verpflichtet sich zu professioneller handwerklicher Qualität. Insbesondere muss das Material:': 'The contractor commits to professional workmanship quality. In particular, the material must:',
    '• korrekt belichtet und scharf sein': '• be correctly exposed and sharp',
    '• eine saubere Bildkomposition aufweisen': '• show clean composition',
    '• ruhig und professionell geführt sein': '• be stable and professionally executed',
    '• bei Video über klar verständlichen, sauberen Ton verfügen': '• for video, include clearly understandable and clean audio',
    '• sauber farbkorrigiert bzw. bearbeitet sein': '• be cleanly color-corrected and edited',
    '• markenkonform gemäß Briefing umgesetzt sein': '• be executed in line with brand guidelines and briefing',
    'Technisch oder inhaltlich nicht verwertbares Material gilt als nicht vertragsgemäß.': 'Material unusable technically or in substance is deemed non-compliant with contract.',
    'Als Nachbesserungen gelten insbesondere: Schnittanpassungen, Farbkorrekturen, Tonanpassungen, Austausch einzelner Szenen, Bildauswahl bei Fotos, kleinere inhaltliche Anpassungen. Diese sind im Rahmen der vereinbarten Korrekturschleifen kostenfrei vorzunehmen.': 'Rework includes in particular: edit adjustments, color correction, audio adjustments, replacement of individual scenes, image selection for photos, and minor content adjustments. These are free of charge within the agreed revision rounds.',
    'Ein Anspruch auf kostenfreie Neuerstellung (Neudreh) besteht insbesondere bei: erheblichen technischen Mängeln, unbrauchbarem Bild- oder Tonmaterial, grober Abweichung vom Briefing, Missachtung professioneller Standards. Sofern die Mängel nicht durch Nachbesserung behoben werden können, ist der Auftragnehmer verpflichtet, die Leistung neu zu erbringen. Wenn es sich hierbei um ein einmaliges Event gehandelt hat, entfällt die Vergütung.': 'A claim for free reproduction (reshoot) exists in particular in cases of significant technical defects, unusable image or audio material, major deviation from briefing, or disregard of professional standards. If defects cannot be remedied by rework, the contractor must provide the service again. If this concerned a one-time event, compensation is forfeited.',
    'Der Auftragnehmer überträgt dem Auftraggeber ausschließliche, zeitlich und räumlich unbegrenzte Nutzungsrechte an sämtlichen erstellten Inhalten.': 'The contractor grants the client exclusive, unlimited usage rights in time and territory for all created content.',
    'Der Auftragnehmer garantiert, dass sämtliche Inhalte frei von Rechten Dritter sind. Er haftet für alle daraus resultierenden Rechtsverletzungen.': 'The contractor guarantees that all content is free from third-party rights. The contractor is liable for all resulting legal infringements.',
    'Die Zahlung erfolgt durch die LikeGroup GmbH im Auftrag des Kunden. Die Rechnungsstellung erfolgt nach finaler Abnahme.': 'Payment is made by LikeGroup GmbH on behalf of the client. Invoicing occurs after final approval.',
    'Der Auftragnehmer verpflichtet sich zur vollständigen Verschwiegenheit über Inhalte, Material und Ergebnisse dieses Auftrags. Eine Eigenverwendung oder Veröffentlichung ist nur mit vorheriger schriftlicher Zustimmung zulässig.': 'The contractor commits to complete confidentiality regarding content, material, and results of this assignment. Personal use or publication is only permitted with prior written consent.',
    'Erfüllt der Auftragnehmer die vereinbarten Leistungen auch nach Nachbesserung oder Neuerstellung nicht, ist der Auftraggeber berechtigt, vom Vertrag zurückzutreten. Bereits gezahlte Vergütungen können anteilig oder vollständig zurückgefordert werden.': 'If the contractor fails to provide the agreed services even after rework or reproduction, the client is entitled to withdraw from the agreement. Compensation already paid may be reclaimed in part or in full.',
    'Dieser Vertrag wird mit der Unterschrift des Auftragnehmers wirksam. Eine zusätzliche Unterschrift der LikeGroup GmbH ist nicht erforderlich.': 'This agreement becomes effective upon signature by the contractor. An additional signature by LikeGroup GmbH is not required.'
  }
};

export class VertraegeCreate {
  constructor() {
    this.currentStep = 1;
    this.totalSteps = 5;
    this.selectedTyp = null;
    this.formData = {};
    this.unternehmen = [];
    this.kampagnen = [];          // Alle Kampagnen
    this.filteredKampagnen = [];  // Gefiltert nach Kunde
    this.creators = [];
    this.filteredCreators = [];   // Gefiltert nach Kampagne (via Kooperationen)
    this.kundeAuftraegePo = [];   // PO-Nummern aus Aufträgen des Kunden
    this.isGenerated = false;
    this.editId = null; // ID wenn Draft bearbeitet wird
    this._filtersInitialized = false; // Flag um doppelte Filter-Initialisierung zu verhindern
    this._isRendering = false; // Lock um Flackern während des Renderns zu verhindern
    this._isInitializing = false; // Flag um Change-Events während Initialisierung zu ignorieren
    this.creatorAddressMissing = false; // Flag: Creator hat keine gültige Adresse
  }

  getContractLanguage(vertrag = {}) {
    const source = vertrag.vertragssprache
      || this.formData.vertragssprache
      || CONFIG?.CONTRACTS?.DEFAULT_LANGUAGE
      || CONFIG?.UI?.LANGUAGE
      || 'de';
    return source === 'en' ? 'en' : 'de';
  }

  getContractLocale(lang) {
    return lang === 'en' ? 'en-GB' : 'de-DE';
  }

  formatContractDate(dateValue, lang, options) {
    if (!dateValue) return '-';
    return new Date(dateValue).toLocaleDateString(this.getContractLocale(lang), options);
  }

  localizeContractText(text, lang) {
    if (lang !== 'en' || typeof text !== 'string') return text;

    const directMap = CONTRACT_TEXT_TRANSLATIONS.en;
    if (directMap[text]) return directMap[text];

    const leadingWhitespace = text.match(/^\s*/)?.[0] || '';
    const trimmedText = text.trimStart();

    if (directMap[trimmedText]) {
      return `${leadingWhitespace}${directMap[trimmedText]}`;
    }

    const prefixMap = [
      ['Firmenname: ', 'Company name: '],
      ['Name / Firma: ', 'Name / Company: '],
      ['Name: ', 'Name: '],
      ['Agenturname: ', 'Agency name: '],
      ['Adresse: ', 'Address: '],
      ['Vertreten durch: ', 'Represented by: '],
      ['Profil(e): ', 'Profile(s): '],
      ['Sonstige: ', 'Other: '],
      ['Nutzungsdauer: ', 'Usage period: '],
      ['Medien: ', 'Media: '],
      ['Fixvergütung: ', 'Fixed compensation: '],
      ['Zusatzkosten vereinbart: ', 'Additional costs agreed: '],
      ['Bei Zusatzkosten: ', 'Additional costs: '],
      ['Zahlungsziel: ', 'Payment term: '],
      ['Die erste inhaltliche Version (Preview / V1) ist spätestens bis: ', 'The first content version (preview / V1) must be delivered no later than: '],
      ['Die finale Version ist spätestens ', 'The final version must be delivered no later than '],
      ['Lieferdatum: ', 'Delivery date: '],
      ['Exklusivität für ', 'Exclusivity for '],
      ['Videos: ', 'Videos: '],
      ['Fotos: ', 'Photos: '],
      ['Storys: ', 'Stories: '],
      ['Storys:', 'Stories:'],
      ['Videos / Reels: ', 'Videos / reels: '],
      ['Feed-Posts: ', 'Feed posts: '],
      ['Story-Slides: ', 'Story slides: '],
      ['• Drehtag ', '• Shooting day '],
      ['Video ', 'Video '],
      ['Feed-Post ', 'Feed post '],
      ['Story ', 'Story '],
      ['Mindestreichweite: ', 'Minimum reach: '],
      ['Steuer-ID / USt-ID: ', 'Tax ID / VAT ID: '],
      ['Rechtsform: ', 'Legal form: '],
      ['Anzahl Videos: ', 'Number of videos: '],
      ['Anzahl Fotos: ', 'Number of photos: '],
      ['Skonto: ', 'Cash discount: '],
      ['Seite ', 'Page ']
    ];

    for (const [dePrefix, enPrefix] of prefixMap) {
      if (trimmedText.startsWith(dePrefix)) {
        const suffix = trimmedText.slice(dePrefix.length);
        return `${leadingWhitespace}${enPrefix}${this.localizeContractText(suffix, lang)}`;
      }
    }

    if (trimmedText.startsWith('Seite ') && trimmedText.includes(' von ')) {
      return `${leadingWhitespace}${trimmedText.replace(/^Seite\s+/, 'Page ').replace(' von ', ' of ')}`;
    }

    const localizedText = trimmedText
      .replace(' – Veröffentlichung am: ', ' - published on: ')
      .replace(' – ', ' - ')
      .replace(' digital zur Verfügung zu stellen.', ' and must be provided digitally.')
      .replace(' nach Abschluss der letzten Korrekturschleife bereitzustellen.', ' after completion of the last revision round.')
      .replace(' Werktage ', ' business days ')
      .replace(' Korrekturschleife(n)', ' revision round(s)')
      .replace(' zzgl. USt.', ' excl. VAT.')
      .replace(' € netto', ' EUR net');

    return `${leadingWhitespace}${localizedText}`;
  }

  localizeDocText(doc, lang) {
    if (lang !== 'en') return;
    const originalText = doc.text.bind(doc);
    doc.text = (text, ...args) => {
      if (typeof text === 'string') {
        return originalText(this.localizeContractText(text, lang), ...args);
      }
      if (Array.isArray(text)) {
        return originalText(text.map((line) => this.localizeContractText(line, lang)), ...args);
      }
      return originalText(text, ...args);
    };
  }

  // Initialisiere Vertrags-Erstellung (oder Draft-Bearbeitung)
  async init(draftId = null) {
    this.editId = draftId;
    
    window.setHeadline(draftId ? 'Vertrag bearbeiten' : 'Neuer Vertrag');
    
    // Breadcrumb
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Verträge', url: '/vertraege', clickable: true },
        { label: draftId ? 'Bearbeiten' : 'Neuer Vertrag', url: draftId ? `/vertraege/${draftId}/edit` : '/vertraege/new', clickable: false }
      ]);
    }
    
    // Berechtigungsprüfung
    const canCreate = window.currentUser?.rolle === 'admin' || 
                      window.currentUser?.rolle === 'mitarbeiter';
    
    if (!canCreate) {
      window.content.innerHTML = `
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Verträge zu erstellen.</p>
        </div>
      `;
      return;
    }

    // Lade Stammdaten
    await this.loadStammdaten();
    
    // Wenn Draft-ID übergeben, lade den Draft aus der DB
    if (draftId) {
      await this.loadDraftFromDB(draftId);
    }
    
    // Rendere Formular
    this.render();
  }

  // Draft aus Datenbank laden
  async loadDraftFromDB(draftId) {
    try {
      const { data: draft, error } = await window.supabase
        .from('vertraege')
        .select('*')
        .eq('id', draftId)
        .single();

      if (error) throw error;

      if (draft) {
        this.formData = {
          typ: draft.typ,
          vertragssprache: draft.vertragssprache || this.getContractLanguage(draft),
          name: draft.name,
          kunde_unternehmen_id: draft.kunde_unternehmen_id,
          kampagne_id: draft.kampagne_id,
          creator_id: draft.creator_id,
          // UGC-spezifische Felder
          anzahl_videos: draft.anzahl_videos || 0,
          anzahl_fotos: draft.anzahl_fotos || 0,
          anzahl_storys: draft.anzahl_storys || 0,
          content_erstellung_art: draft.content_erstellung_art,
          lieferung_art: draft.lieferung_art,
          rohmaterial_enthalten: draft.rohmaterial_enthalten,
          untertitel: draft.untertitel,
          nutzungsart: draft.nutzungsart,
          medien: draft.medien || [],
          nutzungsdauer: draft.nutzungsdauer,
          nutzungsdauer_custom_wert: draft.nutzungsdauer_custom_wert,
          nutzungsdauer_custom_einheit: draft.nutzungsdauer_custom_einheit,
          exklusivitaet: draft.exklusivitaet,
          exklusivitaet_monate: draft.exklusivitaet_monate,
          exklusivitaet_einheit: draft.exklusivitaet_einheit || 'monate',
          verguetung_netto: draft.verguetung_netto,
          zusatzkosten: draft.zusatzkosten,
          zusatzkosten_betrag: draft.zusatzkosten_betrag,
          zahlungsziel: draft.zahlungsziel,
          skonto: draft.skonto,
          content_deadline: draft.content_deadline,
          korrekturschleifen: draft.korrekturschleifen,
          abnahmedatum: draft.abnahmedatum,
          weitere_bestimmungen: draft.weitere_bestimmungen,
          // Influencer-spezifische Felder
          influencer_agentur_vertreten: draft.influencer_agentur_vertreten || false,
          influencer_agentur_name: draft.influencer_agentur_name,
          influencer_agentur_adresse: draft.influencer_agentur_adresse,
          influencer_agentur_vertretung: draft.influencer_agentur_vertretung,
          influencer_land: draft.influencer_land,
          influencer_profile: draft.influencer_profile || [],
          // Handle-Felder aus gespeicherten Profil-Strings parsen (Format: "Plattform @handle")
          ...this._parseProfileHandles(draft.influencer_profile || []),
          plattformen: draft.plattformen || [],
          plattformen_sonstige: draft.plattformen_sonstige,
          anzahl_reels: draft.anzahl_reels || 0,
          anzahl_feed_posts: draft.anzahl_feed_posts || 0,
          veroeffentlichungsplan: draft.veroeffentlichungsplan || {},
          organische_veroeffentlichung: draft.organische_veroeffentlichung,
          media_buyout: draft.media_buyout,
          reichweiten_garantie: draft.reichweiten_garantie || false,
          reichweiten_garantie_wert: draft.reichweiten_garantie_wert,
          mindest_online_dauer: draft.mindest_online_dauer,
          anpassungen: draft.anpassungen || [],
          // Videograf-spezifische Felder
          kunde_rechtsform: draft.kunde_rechtsform,
          influencer_steuer_id: draft.influencer_steuer_id,
          videograf_produktionsart: draft.videograf_produktionsart,
          videograf_produktionsplan: draft.videograf_produktionsplan || [],
          videograf_lieferumfang: draft.videograf_lieferumfang || [],
          videograf_v1_deadline: draft.videograf_v1_deadline,
          videograf_finale_werktage: draft.videograf_finale_werktage,
          videograf_nutzungsart: draft.videograf_nutzungsart || [],
          // PO-Nummer
          kunde_po_nummer: draft.kunde_po_nummer
        };
        this.selectedTyp = draft.typ;
        this.isGenerated = true;
        this.currentStep = 2; // Start bei Schritt 2 da Typ schon gewählt
        
        // Kaskade initialisieren: Kampagnen für Kunde und Creator für Kampagne laden
        this.updateFilteredKampagnen();
        await this.updateFilteredCreators();
        this._filtersInitialized = true; // Verhindert doppelte Initialisierung in renderStep2
        
        // Creator-Profile aus Creator-Profil übernehmen (falls Creator gewählt)
        if (this.formData.creator_id) {
          const creator = this.creators.find(c => c.id === this.formData.creator_id);
          if (creator) this._applyCreatorProfiles(creator);
        }
        
        console.log('📋 Draft aus DB geladen:', draft);
        console.log('📋 Gefilterte Kampagnen:', this.filteredKampagnen.length);
        console.log('📋 Gefilterte Creator:', this.filteredCreators.length);
      }
    } catch (error) {
      console.error('❌ Fehler beim Laden des Drafts:', error);
      window.toastSystem?.show('Draft konnte nicht geladen werden', 'error');
    }
  }

  // Formular zurücksetzen
  resetForm() {
    this.currentStep = 1;
    this.selectedTyp = null;
    this.formData = {};
    this.filteredKampagnen = [];
    this.filteredCreators = [];
    this.kundeAuftraegePo = [];
    this.isGenerated = false;
    this.editId = null;
    this._filtersInitialized = false;
    this._isRendering = false;
    this._isInitializing = false;
  }

  // Lade Unternehmen, Kampagnen und Creator
  async loadStammdaten() {
    if (!window.supabase) return;

    try {
      // Lade Unternehmen
      const { data: unternehmen } = await window.supabase
        .from('unternehmen')
        .select('id, firmenname, rechnungsadresse_strasse, rechnungsadresse_hausnummer, rechnungsadresse_plz, rechnungsadresse_stadt')
        .order('firmenname');
      
      this.unternehmen = unternehmen || [];
      console.log('📊 VERTRAG: Unternehmen geladen:', this.unternehmen.length);

      // Lade Kampagnen mit Unternehmen-ID
      const { data: kampagnen } = await window.supabase
        .from('kampagne')
        .select('id, kampagnenname, eigener_name, unternehmen_id, auftrag_id')
        .order('kampagnenname');
      
      this.kampagnen = kampagnen || [];
      console.log('📊 VERTRAG: Kampagnen geladen:', this.kampagnen.length);
      if (this.kampagnen.length > 0) {
        console.log('📊 VERTRAG: Beispiel-Kampagne:', this.kampagnen[0]);
      }

      // Lade Creator mit Adressen
      const { data: creators } = await window.supabase
        .from('creator')
        .select('id, vorname, nachname, lieferadresse_strasse, lieferadresse_hausnummer, lieferadresse_plz, lieferadresse_stadt, lieferadresse_land, instagram, tiktok')
        .order('nachname');
      
      this.creators = creators || [];
      console.log('📊 VERTRAG: Creator geladen:', this.creators.length);

    } catch (error) {
      console.error('❌ Fehler beim Laden der Stammdaten:', error);
    }
  }

  // Hauptrender-Funktion
  render() {
    // Verhindere doppeltes Rendern
    if (this._isRendering) {
      console.log('⏳ Render bereits aktiv, überspringe...');
      return;
    }
    this._isRendering = true;
    
    try {
      if (!this.isGenerated) {
        this.renderStep1();
      } else {
        this.renderMultistep();
      }
    } finally {
      // Lock freigeben nach kurzem Delay (für DOM-Updates)
      setTimeout(() => {
        this._isRendering = false;
      }, 50);
    }
  }

  // Schritt 1: Vertragstyp-Auswahl
  renderStep1() {
    const html = `
      <div class="form-page">
        <div class="vertrag-typ-selection">
          <h2>Vertragstyp auswählen</h2>
          <p class="form-hint">Wählen Sie den Vertragstyp aus und klicken Sie auf "Generieren".</p>
          
          <div class="form-field form-field--centered">
            <label for="vertrag-typ">Vertragstyp</label>
            <select id="vertrag-typ" class="form-select">
              <option value="">Bitte wählen...</option>
              <option value="UGC">UGC-Produktionsvertrag</option>
              <option value="Influencer Kooperation">Influencer Kooperation</option>
              <option value="Videograph">Videograph</option>
            </select>
          </div>
          
          <div class="form-actions form-actions--centered">
            <button type="button" class="mdc-btn mdc-btn--cancel" onclick="window.navigateTo('/vertraege')">
              <span class="mdc-btn__label">Abbrechen</span>
            </button>
            <button type="button" id="btn-generate" class="primary-btn" disabled>
              Generieren
            </button>
          </div>
        </div>
      </div>
    `;

    window.setContentSafely(window.content, html);
    this.bindStep1Events();
  }

  // Events für Schritt 1
  bindStep1Events() {
    const select = document.getElementById('vertrag-typ');
    const generateBtn = document.getElementById('btn-generate');

    if (select) {
      select.addEventListener('change', (e) => {
        this.selectedTyp = e.target.value;
        if (generateBtn) {
          generateBtn.disabled = !this.selectedTyp;
        }
      });
    }

    if (generateBtn) {
      generateBtn.addEventListener('click', () => {
        if (this.selectedTyp) {
          this.isGenerated = true;
          this.currentStep = 2;
          this.formData.typ = this.selectedTyp;
          this.render();
        }
      });
    }
  }

  // Multistep-Formular rendern
  renderMultistep() {
    const stepContent = this.getStepContent();
    const isEdit = !!this.editId;
    
    const html = `
      <div class="form-page">
        <form id="vertrag-form" data-entity="vertraege">
          <!-- Step Content -->
          <div class="multistep-content">
            ${stepContent}
          </div>
        </form>
      </div>
    `;

    // Erst HTML setzen
    window.setContentSafely(window.content, html);
    
    // Dann Progress Bar in main-wrapper einfügen (NACH setContentSafely!)
    const mainWrapper = document.querySelector('.main-wrapper');
    let progressContainer = document.getElementById('vertrag-progress-container');
    
    if (!progressContainer && mainWrapper) {
      progressContainer = document.createElement('div');
      progressContainer.id = 'vertrag-progress-container';
      progressContainer.className = 'multistep-progress';
      mainWrapper.insertBefore(progressContainer, mainWrapper.firstChild);
    }
    
    if (progressContainer) {
      progressContainer.innerHTML = this.renderProgressBar();
    }
    
    // Events binden
    this.bindProgressBarEvents();
    this.bindMultistepEvents();
    this.initSearchableSelects();
  }

  // Progress Bar rendern (inkl. Actions rechts)
  renderProgressBar() {
    const steps = [
      { num: 2, label: 'Parteien' },
      { num: 3, label: 'Leistung' },
      { num: 4, label: 'Nutzung' },
      { num: 5, label: 'Vergütung' }
    ];
    
    const isEdit = !!this.editId;
    const selectedLanguage = this.getContractLanguage(this.formData);

    return `
      <div class="progress-steps">
        ${steps.map(step => `
          <div class="progress-step ${this.currentStep >= step.num ? 'active' : ''} ${this.currentStep === step.num ? 'current' : ''}" 
               data-step="${step.num}" 
               class="cursor-pointer"
               title="Zu ${step.label} springen">
            <div class="step-number">${step.num - 1}</div>
            <div class="step-label">${step.label}</div>
          </div>
        `).join('')}
      </div>
      <div class="progress-actions">
        <button type="button" class="mdc-btn mdc-btn--cancel" id="btn-cancel">
          <span class="mdc-btn__label">Abbrechen</span>
        </button>
        <button type="button" id="btn-save-draft" class="secondary-btn" title="Als Entwurf in der Datenbank speichern">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 3.75H6.912a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H15M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859M12 3v8.25m0 0-3-3m3 3 3-3" />
          </svg>
          <span class="btn-label">Als Entwurf speichern</span>
        </button>
        ${this.currentStep > 2 ? `
          <button type="button" id="btn-prev" class="secondary-btn">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Zurück
          </button>
        ` : ''}
        ${this.currentStep === this.totalSteps ? `
          <div class="contract-language-switch" role="group" aria-label="Vertragssprache">
            <span class="contract-language-switch__label">Sprache:</span>
            <button type="button" class="secondary-btn ${selectedLanguage === 'de' ? 'btn-active' : ''}" data-contract-lang="de">
              Deutsch
            </button>
            <button type="button" class="secondary-btn ${selectedLanguage === 'en' ? 'btn-active' : ''}" data-contract-lang="en">
              English
            </button>
          </div>
        ` : ''}
        ${this.currentStep < this.totalSteps ? `
          <button type="button" id="btn-next" class="primary-btn">
            Weiter
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </button>
        ` : `
          <button type="button" id="btn-submit" class="primary-btn">
            ${isEdit ? 'Finalisieren & PDF' : 'Erstellen & PDF'}
          </button>
          <button type="button" id="btn-submit-and-new" class="secondary-btn" title="Vertrag erstellen und mit gleichen Daten neuen starten">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Erstellen & Neu mit gleichen Daten
          </button>
        `}
      </div>
    `;
  }

  // Progress Bar Events binden (nach dem Einfügen in DOM aufrufen)
  bindProgressBarEvents() {
    const progressContainer = document.getElementById('vertrag-progress-container');
    if (!progressContainer) return;

    const steps = progressContainer.querySelectorAll('.progress-step[data-step]');
    steps.forEach(stepEl => {
      stepEl.addEventListener('click', () => {
        const targetStep = parseInt(stepEl.dataset.step, 10);
        this.goToStep(targetStep);
      });
    });
  }

  // Zu einem bestimmten Schritt springen
  goToStep(targetStep) {
    // Aktuelle Daten speichern bevor wir wechseln
    this.saveCurrentStepData();
    
    // Schritt wechseln
    this.currentStep = targetStep;
    this.render();
  }

  // Step Content basierend auf aktuellem Schritt und Vertragstyp
  getStepContent() {
    // Influencer-Vertrag hat andere Steps
    if (this.selectedTyp === 'Influencer Kooperation') {
      switch (this.currentStep) {
        case 2: return this.renderInfluencerStep2(); // Parteien + Agentur
        case 3: return this.renderInfluencerStep3(); // Plattformen & Inhalte
        case 4: return this.renderInfluencerStep4(); // Nutzungsrechte & Buyout
        case 5: return this.renderInfluencerStep5(); // Vergütung & Qualität
        default: return '';
      }
    }
    
    // Videograf-Vertrag
    if (this.selectedTyp === 'Videograph') {
      switch (this.currentStep) {
        case 2: return this.renderVideografStep2(); // Parteien
        case 3: return this.renderVideografStep3(); // Leistungsumfang & Produktion
        case 4: return this.renderVideografStep4(); // Output & Korrektur
        case 5: return this.renderVideografStep5(); // Nutzungsrechte & Vergütung
        default: return '';
      }
    }
    
    // UGC-Vertrag (Standard)
    switch (this.currentStep) {
      case 2: return this.renderStep2();
      case 3: return this.renderStep3();
      case 4: return this.renderStep4();
      case 5: return this.renderStep5();
      default: return '';
    }
  }

  // Schritt 2: Vertragsparteien
  renderStep2() {
    // Filter nur initialisieren wenn noch nicht geschehen (z.B. bei Draft-Load bereits erledigt)
    if (!this._filtersInitialized) {
      this.updateFilteredKampagnen();
      // updateFilteredCreators ist async, aber hier brauchen wir es synchron für den Render
      // Bei neuem Vertrag ist filteredCreators sowieso leer
    }
    
    return `
      <div class="step-section">
        <h3>Vertragsparteien</h3>
        <p class="step-description">Vertragstyp: <strong>${this.selectedTyp}</strong></p>
        
        <!-- Kunde -->
        <div class="form-field">
          <label for="kunde_unternehmen_id">Kunde (Unternehmen) <span class="required">*</span></label>
          <select id="kunde_unternehmen_id" name="kunde_unternehmen_id" required data-searchable="true">
            <option value="">Unternehmen auswählen...</option>
            ${this.unternehmen.map(u => `
              <option value="${u.id}" ${this.formData.kunde_unternehmen_id === u.id ? 'selected' : ''}>
                ${u.firmenname}
              </option>
            `).join('')}
          </select>
          <div id="kunde-adresse" class="address-preview"></div>
        </div>

        <!-- Kampagne (abhängig von Kunde) -->
        <div class="form-field">
          <label for="kampagne_id">Kampagne <span class="required">*</span></label>
          <select id="kampagne_id" name="kampagne_id" required ${!this.formData.kunde_unternehmen_id ? 'disabled' : ''}>
            <option value="">${this.formData.kunde_unternehmen_id ? 'Kampagne auswählen...' : 'Bitte zuerst Kunde wählen...'}</option>
            ${this.filteredKampagnen.map(k => `
              <option value="${k.id}" ${this.formData.kampagne_id === k.id ? 'selected' : ''}>
                ${KampagneUtils.getDisplayName(k)}
              </option>
            `).join('')}
          </select>
        </div>

        <!-- Creator (abhängig von Kampagne, optional) -->
        <div class="form-field">
          <label for="creator_id">Creator</label>
          <select id="creator_id" name="creator_id" ${!this.formData.kampagne_id ? 'disabled' : ''} data-searchable="true">
            <option value="">${this.formData.kampagne_id ? 'Creator auswählen (optional)...' : 'Bitte zuerst Kampagne wählen...'}</option>
            ${this.filteredCreators.map(c => `
              <option value="${c.id}" ${this.formData.creator_id === c.id ? 'selected' : ''}>
                ${c.vorname} ${c.nachname}
              </option>
            `).join('')}
          </select>
          <div id="creator-adresse" class="address-preview"></div>
        </div>

        <h3 class="mt-section">Influencer-Vertretung</h3>
        
        <div class="form-field">
          <label>Wird der Influencer durch eine Agentur vertreten?</label>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="influencer_agentur_vertreten" value="false" 
                     ${!this.formData.influencer_agentur_vertreten ? 'checked' : ''}>
              <span>Nein</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="influencer_agentur_vertreten" value="true" 
                     ${this.formData.influencer_agentur_vertreten ? 'checked' : ''}>
              <span>Ja</span>
            </label>
          </div>
        </div>

        <div id="agentur-felder" class="${this.formData.influencer_agentur_vertreten ? '' : 'hidden'}">
          <div class="form-field">
            <label for="influencer_agentur_name">Agenturname</label>
            <input type="text" id="influencer_agentur_name" name="influencer_agentur_name"
                   value="${this.formData.influencer_agentur_name || ''}"
                   placeholder="Name der Agentur">
          </div>
          <div class="form-field">
            <label for="influencer_agentur_adresse">Agenturadresse</label>
            <input type="text" id="influencer_agentur_adresse" name="influencer_agentur_adresse"
                   value="${this.formData.influencer_agentur_adresse || ''}"
                   placeholder="Straße, PLZ Stadt">
          </div>
          <div class="form-field">
            <label for="influencer_agentur_vertretung">Vertreten durch</label>
            <input type="text" id="influencer_agentur_vertretung" name="influencer_agentur_vertretung"
                   value="${this.formData.influencer_agentur_vertretung || ''}"
                   placeholder="Name des Vertreters">
          </div>
        </div>

        <div class="form-field">
          <label for="name">Vertragsname (automatisch generiert)</label>
          <input type="text" id="name" name="name" readonly 
                 value="${this.formData.name || ''}"
                 placeholder="Wird automatisch generiert..." class="readonly-field">
        </div>
      </div>
    `;
  }

  // Kampagnen nach Kunde filtern
  updateFilteredKampagnen() {
    console.log('🔍 VERTRAG: updateFilteredKampagnen aufgerufen');
    console.log('🔍 VERTRAG: kunde_unternehmen_id:', this.formData.kunde_unternehmen_id, '(Typ:', typeof this.formData.kunde_unternehmen_id, ')');
    console.log('🔍 VERTRAG: Anzahl geladener Kampagnen:', this.kampagnen.length);
    
    // Debug: Alle einzigartigen Unternehmen-IDs in Kampagnen anzeigen
    if (this.kampagnen.length > 0) {
      const uniqueUnternehmenIds = [...new Set(this.kampagnen.map(k => k.unternehmen_id))];
      console.log('🔍 VERTRAG: Unternehmen-IDs in Kampagnen:', uniqueUnternehmenIds);
    }
    
    if (this.formData.kunde_unternehmen_id) {
      // String-Vergleich für robuste UUID-Behandlung
      const kundeId = String(this.formData.kunde_unternehmen_id);
      this.filteredKampagnen = this.kampagnen.filter(
        k => String(k.unternehmen_id) === kundeId
      );
      console.log('🔍 VERTRAG: Gefilterte Kampagnen:', this.filteredKampagnen.length);
      if (this.filteredKampagnen.length === 0 && this.kampagnen.length > 0) {
        console.log('⚠️ VERTRAG: Keine Kampagnen für Kunde gefunden!');
        console.log('⚠️ VERTRAG: Gesuchte Kunde-ID:', kundeId);
        console.log('⚠️ VERTRAG: Erste 3 Kampagnen:', this.kampagnen.slice(0, 3).map(k => ({name: KampagneUtils.getDisplayName(k), unternehmen_id: k.unternehmen_id})));
      }
    } else {
      this.filteredKampagnen = [];
      console.log('🔍 VERTRAG: Keine kunde_unternehmen_id gesetzt, filteredKampagnen geleert');
    }
  }

  // PO-Nummern aus Aufträgen des gewählten Kunden laden
  // Auto-selektiert die neueste PO, sofern noch keine gesetzt ist
  async loadKundeAuftraegePo() {
    if (!this.formData.kunde_unternehmen_id) {
      this.kundeAuftraegePo = [];
      return;
    }

    try {
      const kundeId = String(this.formData.kunde_unternehmen_id);
      const { data: auftraege, error } = await window.supabase
        .from('auftrag')
        .select('id, po, auftragsname')
        .eq('unternehmen_id', kundeId)
        .not('po', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      this.kundeAuftraegePo = auftraege || [];
      console.log('📋 VERTRAG: PO-Nummern geladen:', this.kundeAuftraegePo.length);
    } catch (error) {
      console.error('❌ Fehler beim Laden der PO-Nummern:', error);
      this.kundeAuftraegePo = [];
    }
  }

  // PO über die gewählte Kampagne → auftrag_id → auftrag.po laden
  async loadPoFromKampagne(kampagneId) {
    if (!kampagneId) {
      this.formData.kunde_po_nummer = null;
      return;
    }

    try {
      const kampagne = this.kampagnen.find(k => k.id === kampagneId);
      const auftragId = kampagne?.auftrag_id;

      if (!auftragId) {
        console.warn('⚠️ VERTRAG: Kampagne hat keine auftrag_id, PO kann nicht geladen werden');
        this.formData.kunde_po_nummer = null;
        return;
      }

      const { data: auftrag, error } = await window.supabase
        .from('auftrag')
        .select('po')
        .eq('id', auftragId)
        .single();

      if (error) throw error;

      this.formData.kunde_po_nummer = auftrag?.po || null;
      console.log('📋 VERTRAG: PO aus Kampagne-Auftrag gesetzt:', this.formData.kunde_po_nummer);
    } catch (error) {
      console.error('❌ Fehler beim Laden der PO aus Kampagne:', error);
      this.formData.kunde_po_nummer = null;
    }
  }

  // Vertragsname automatisch generieren: Typ + Kampagne + Creator
  generateVertragName() {
    const typ = this.formData.typ || this.selectedTyp || '';
    
    // Kampagne-Name finden
    let kampagneName = '';
    if (this.formData.kampagne_id) {
      const kampagne = this.kampagnen.find(k => k.id === this.formData.kampagne_id);
      kampagneName = KampagneUtils.getDisplayName(kampagne);
    }
    
    // Creator-Name finden
    let creatorName = '';
    if (this.formData.creator_id) {
      const creator = this.filteredCreators.find(c => c.id === this.formData.creator_id) 
                   || this.creators.find(c => c.id === this.formData.creator_id);
      if (creator) {
        creatorName = `${creator.vorname} ${creator.nachname}`.trim();
      }
    }
    
    // Name zusammenbauen
    const parts = [typ, kampagneName, creatorName].filter(p => p);
    this.formData.name = parts.join(' - ');
    
    // Input-Feld aktualisieren wenn vorhanden
    const nameInput = document.getElementById('name');
    if (nameInput) {
      nameInput.value = this.formData.name;
    }
    
    return this.formData.name;
  }

  // Creator nach Kampagne filtern (via kooperationen)
  async updateFilteredCreators() {
    if (!this.formData.kampagne_id) {
      this.filteredCreators = [];
      return;
    }

    try {
      // Lade Creator die über kooperationen mit der Kampagne verknüpft sind
      const { data: kooperationen } = await window.supabase
        .from('kooperationen')
        .select('creator_id')
        .eq('kampagne_id', this.formData.kampagne_id);

      if (kooperationen && kooperationen.length > 0) {
        const creatorIds = [...new Set(kooperationen.map(k => k.creator_id))];
        this.filteredCreators = this.creators.filter(c => creatorIds.includes(c.id));
      } else {
        this.filteredCreators = [];
      }
    } catch (error) {
      console.error('❌ Fehler beim Filtern der Creator:', error);
      this.filteredCreators = [];
    }
  }

  // Schritt 3: Leistungsumfang
  renderStep3() {
    return `
      <div class="step-section">
        <h3>§2 Leistungsumfang</h3>
        
        <div class="form-three-col">
          <div class="form-field">
            <label for="anzahl_videos">Anzahl Videos</label>
            <input type="number" id="anzahl_videos" name="anzahl_videos" min="0" 
                   value="${this.formData.anzahl_videos || 0}">
          </div>
          <div class="form-field">
            <label for="anzahl_fotos">Anzahl Fotos</label>
            <input type="number" id="anzahl_fotos" name="anzahl_fotos" min="0" 
                   value="${this.formData.anzahl_fotos || 0}">
          </div>
          <div class="form-field">
            <label for="anzahl_storys">Anzahl Storys</label>
            <input type="number" id="anzahl_storys" name="anzahl_storys" min="0" 
                   value="${this.formData.anzahl_storys || 0}">
          </div>
        </div>

        <div class="form-field">
          <label>Art der Content-Erstellung</label>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="content_erstellung_art" value="skript_fertig" 
                     ${this.formData.content_erstellung_art === 'skript_fertig' ? 'checked' : ''}>
              <span>Fertiges Skript vom Auftraggeber</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="content_erstellung_art" value="briefing_direkt" 
                     ${this.formData.content_erstellung_art === 'briefing_direkt' ? 'checked' : ''}>
              <span>Briefing vom Auftraggeber, direkter Dreh ohne Skript</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="content_erstellung_art" value="briefing_skript" 
                     ${this.formData.content_erstellung_art === 'briefing_skript' ? 'checked' : ''}>
              <span>Briefing vom Auftraggeber, Skript durch Creator</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="content_erstellung_art" value="eigenstaendig" 
                     ${this.formData.content_erstellung_art === 'eigenstaendig' ? 'checked' : ''}>
              <span>Eigenständige Konzeption durch Creator</span>
            </label>
          </div>
        </div>

        <h3>§3 Output & Lieferumfang</h3>
        
        <div class="form-field">
          <label>Art der Lieferung</label>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="lieferung_art" value="fertig_geschnitten" 
                     ${this.formData.lieferung_art === 'fertig_geschnitten' ? 'checked' : ''}>
              <span>Fertig geschnittenes Video</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="lieferung_art" value="raw_cut" 
                     ${this.formData.lieferung_art === 'raw_cut' ? 'checked' : ''}>
              <span>Raw Cut (Szenen aneinandergeschnitten, ohne Feinschnitt)</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="lieferung_art" value="rohmaterial" 
                     ${this.formData.lieferung_art === 'rohmaterial' ? 'checked' : ''}>
              <span>Rohmaterial (ungeschnittene Clips)</span>
            </label>
          </div>
        </div>

        <div class="form-two-col">
          <div class="form-field">
            <label class="checkbox-label">
              <input type="checkbox" name="rohmaterial_enthalten" value="true"
                     ${this.formData.rohmaterial_enthalten ? 'checked' : ''}>
              <span>Rohmaterial enthalten</span>
            </label>
          </div>
          <div class="form-field">
            <label class="checkbox-label">
              <input type="checkbox" name="untertitel" value="true"
                     ${this.formData.untertitel ? 'checked' : ''}>
              <span>Untertitel</span>
            </label>
          </div>
        </div>
      </div>
    `;
  }

  // Schritt 4: Nutzungsrechte
  renderStep4() {
    return `
      <div class="step-section">
        <h3>§4 Nutzungsrechte</h3>
        
        <div class="form-field">
          <label>Nutzungsart</label>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="nutzungsart" value="organisch" 
                     ${this.formData.nutzungsart === 'organisch' ? 'checked' : ''}>
              <span>Organische Nutzung</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="nutzungsart" value="paid" 
                     ${this.formData.nutzungsart === 'paid' ? 'checked' : ''}>
              <span>Paid Ads Nutzung</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="nutzungsart" value="beides" 
                     ${this.formData.nutzungsart === 'beides' ? 'checked' : ''}>
              <span>Organisch & Paid Ads</span>
            </label>
          </div>
        </div>

        <div class="form-field">
          <label>Medien</label>
          <div class="checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" name="medien" value="social_media"
                     ${(this.formData.medien || []).includes('social_media') ? 'checked' : ''}>
              <span>Social Media</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="medien" value="website"
                     ${(this.formData.medien || []).includes('website') ? 'checked' : ''}>
              <span>Website</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="medien" value="otv"
                     ${(this.formData.medien || []).includes('otv') ? 'checked' : ''}>
              <span>OTV</span>
            </label>
          </div>
        </div>

        <div class="form-field">
          <label for="nutzungsdauer">Nutzungsdauer</label>
          <select id="nutzungsdauer" name="nutzungsdauer">
            <option value="">Bitte wählen...</option>
            <option value="unbegrenzt" ${this.formData.nutzungsdauer === 'unbegrenzt' ? 'selected' : ''}>Unbegrenzt</option>
            <option value="12_monate" ${this.formData.nutzungsdauer === '12_monate' ? 'selected' : ''}>12 Monate</option>
            <option value="6_monate" ${this.formData.nutzungsdauer === '6_monate' ? 'selected' : ''}>6 Monate</option>
            <option value="3_monate" ${this.formData.nutzungsdauer === '3_monate' ? 'selected' : ''}>3 Monate</option>
            <option value="individuell" ${this.formData.nutzungsdauer === 'individuell' ? 'selected' : ''}>Individuell</option>
          </select>
        </div>
        <div class="form-field ${this.formData.nutzungsdauer === 'individuell' ? '' : 'hidden'}" id="nutzungsdauer-custom-wrapper">
          <label for="nutzungsdauer_custom_wert">Nutzungsdauer individuell</label>
          <div class="input-with-select">
            <input type="number" id="nutzungsdauer_custom_wert" name="nutzungsdauer_custom_wert" min="1" max="99"
                   value="${this.formData.nutzungsdauer_custom_wert ?? ''}" placeholder="Anzahl">
            <select id="nutzungsdauer_custom_einheit" name="nutzungsdauer_custom_einheit">
              <option value="jahre" ${this.formData.nutzungsdauer_custom_einheit === 'jahre' ? 'selected' : ''}>Jahre</option>
              <option value="monate" ${!this.formData.nutzungsdauer_custom_einheit || this.formData.nutzungsdauer_custom_einheit === 'monate' ? 'selected' : ''}>Monate</option>
            </select>
          </div>
        </div>

        <div class="form-two-col">
          <div class="form-field">
            <label class="checkbox-label">
              <input type="checkbox" id="exklusivitaet" name="exklusivitaet" value="true"
                     ${this.formData.exklusivitaet ? 'checked' : ''}>
              <span>Exklusivität</span>
            </label>
          </div>
          <div class="form-field ${this.formData.exklusivitaet ? '' : 'hidden'}" id="exklusivitaet-monate-wrapper">
            <label for="exklusivitaet_monate">Exklusivität Zeitraum</label>
            <div class="input-with-select">
              <input type="number" id="exklusivitaet_monate" name="exklusivitaet_monate" min="1" max="365"
                     value="${this.formData.exklusivitaet_monate || ''}" placeholder="Anzahl">
              <select id="exklusivitaet_einheit" name="exklusivitaet_einheit">
                <option value="monate" ${!this.formData.exklusivitaet_einheit || this.formData.exklusivitaet_einheit === 'monate' ? 'selected' : ''}>Monate</option>
                <option value="wochen" ${this.formData.exklusivitaet_einheit === 'wochen' ? 'selected' : ''}>Wochen</option>
                <option value="tage" ${this.formData.exklusivitaet_einheit === 'tage' ? 'selected' : ''}>Tage</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Schritt 5: Vergütung und Deadlines
  renderStep5() {
    return `
      <div class="step-section">
        <h3>§5 Vergütung</h3>
        
        <div class="form-two-col">
          <div class="form-field">
            <label for="verguetung_netto">Fixvergütung (netto) <span class="required">*</span></label>
            <div class="input-with-suffix">
              <input type="number" id="verguetung_netto" name="verguetung_netto" 
                     step="0.01" min="0" required
                     value="${this.formData.verguetung_netto || ''}">
              <span class="input-suffix">€</span>
            </div>
          </div>
          <div class="form-field">
            <label for="zahlungsziel">Zahlungsziel</label>
            <select id="zahlungsziel" name="zahlungsziel">
              <option value="">Bitte wählen...</option>
              <option value="30_tage" ${this.formData.zahlungsziel === '30_tage' ? 'selected' : ''}>30 Tage</option>
              <option value="60_tage" ${this.formData.zahlungsziel === '60_tage' ? 'selected' : ''}>60 Tage</option>
            </select>
          </div>
        </div>

        <div class="form-two-col">
          <div class="form-field">
            <label class="checkbox-label">
              <input type="checkbox" id="zusatzkosten" name="zusatzkosten" value="true"
                     ${this.formData.zusatzkosten ? 'checked' : ''}>
              <span>Zusatzkosten vereinbart</span>
            </label>
          </div>
          <div class="form-field ${this.formData.zusatzkosten ? '' : 'hidden'}" id="zusatzkosten-wrapper">
            <label for="zusatzkosten_betrag">Zusatzkosten (netto)</label>
            <div class="input-with-suffix">
              <input type="number" id="zusatzkosten_betrag" name="zusatzkosten_betrag" 
                     step="0.01" min="0"
                     value="${this.formData.zusatzkosten_betrag || ''}">
              <span class="input-suffix">€</span>
            </div>
          </div>
        </div>

        <div class="form-field">
          <label class="checkbox-label">
            <input type="checkbox" name="skonto" value="true"
                   ${this.formData.skonto ? 'checked' : ''}>
            <span>Skonto (3% bei Zahlung innerhalb von 7 Tagen)</span>
          </label>
        </div>

        <h3>§6 Deadlines & Korrekturen</h3>
        
        <div class="form-three-col">
          <div class="form-field">
            <label for="content_deadline">Content-Deadline</label>
            <input type="date" id="content_deadline" name="content_deadline"
                   value="${this.formData.content_deadline || ''}">
          </div>
          <div class="form-field">
            <label for="korrekturschleifen">Korrekturschleifen</label>
            <select id="korrekturschleifen" name="korrekturschleifen">
              <option value="">Bitte wählen...</option>
              <option value="1" ${this.formData.korrekturschleifen === 1 ? 'selected' : ''}>1</option>
              <option value="2" ${this.formData.korrekturschleifen === 2 ? 'selected' : ''}>2</option>
            </select>
          </div>
          <div class="form-field">
            <label for="abnahmedatum">Abnahmedatum</label>
            <input type="date" id="abnahmedatum" name="abnahmedatum"
                   value="${this.formData.abnahmedatum || ''}">
          </div>
        </div>

        <h3>Weitere Bestimmungen</h3>
        <div class="form-field">
          <label for="weitere_bestimmungen">Zusätzliche Vereinbarungen (optional)</label>
          <textarea id="weitere_bestimmungen" name="weitere_bestimmungen" rows="4"
                    placeholder="z.B. besondere Vereinbarungen, Sonderkonditionen...">${this.formData.weitere_bestimmungen || ''}</textarea>
        </div>
      </div>
    `;
  }

  // ============================================
  // INFLUENCER-VERTRAG STEPS
  // ============================================

  // Influencer Step 2: Vertragsparteien + Agentur-Vertretung
  renderInfluencerStep2() {
    if (!this._filtersInitialized) {
      this.updateFilteredKampagnen();
    }
    
    return `
      <div class="step-section">
        <h3>Vertragsparteien</h3>
        <p class="step-description">Vertragstyp: <strong>Influencer-Kooperationsvertrag</strong></p>
        
        <!-- Kunde -->
        <div class="form-field">
          <label for="kunde_unternehmen_id">Kunde (Unternehmen) <span class="required">*</span></label>
          <select id="kunde_unternehmen_id" name="kunde_unternehmen_id" required data-searchable="true">
            <option value="">Unternehmen auswählen...</option>
            ${this.unternehmen.map(u => `
              <option value="${u.id}" ${this.formData.kunde_unternehmen_id === u.id ? 'selected' : ''}>
                ${u.firmenname}
              </option>
            `).join('')}
          </select>
          <div id="kunde-adresse" class="address-preview"></div>
        </div>

        <!-- Kampagne -->
        <div class="form-field">
          <label for="kampagne_id">Kampagne <span class="required">*</span></label>
          <select id="kampagne_id" name="kampagne_id" required ${!this.formData.kunde_unternehmen_id ? 'disabled' : ''}>
            <option value="">${this.formData.kunde_unternehmen_id ? 'Kampagne auswählen...' : 'Bitte zuerst Kunde wählen...'}</option>
            ${this.filteredKampagnen.map(k => `
              <option value="${k.id}" ${this.formData.kampagne_id === k.id ? 'selected' : ''}>
                ${KampagneUtils.getDisplayName(k)}
              </option>
            `).join('')}
          </select>
        </div>

        <!-- Influencer (Creator) -->
        <div class="form-field">
          <label for="creator_id">Influencer <span class="required">*</span></label>
          <select id="creator_id" name="creator_id" required ${!this.formData.kampagne_id ? 'disabled' : ''} data-searchable="true">
            <option value="">${this.formData.kampagne_id ? 'Influencer auswählen...' : 'Bitte zuerst Kampagne wählen...'}</option>
            ${this.filteredCreators.map(c => `
              <option value="${c.id}" ${this.formData.creator_id === c.id ? 'selected' : ''}>
                ${c.vorname} ${c.nachname}
              </option>
            `).join('')}
          </select>
          <div id="creator-adresse" class="address-preview"></div>
        </div>

        <h3 class="mt-section">Influencer-Vertretung</h3>
        
        <div class="form-field">
          <label>Wird der Influencer durch eine Agentur vertreten?</label>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="influencer_agentur_vertreten" value="false" 
                     ${!this.formData.influencer_agentur_vertreten ? 'checked' : ''}>
              <span>Nein</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="influencer_agentur_vertreten" value="true" 
                     ${this.formData.influencer_agentur_vertreten ? 'checked' : ''}>
              <span>Ja</span>
            </label>
          </div>
        </div>

        <div id="agentur-felder" class="${this.formData.influencer_agentur_vertreten ? '' : 'hidden'}">
          <div class="form-field">
            <label for="influencer_agentur_name">Agenturname</label>
            <input type="text" id="influencer_agentur_name" name="influencer_agentur_name"
                   value="${this.formData.influencer_agentur_name || ''}"
                   placeholder="Name der Agentur">
          </div>
          <div class="form-field">
            <label for="influencer_agentur_adresse">Agenturadresse</label>
            <input type="text" id="influencer_agentur_adresse" name="influencer_agentur_adresse"
                   value="${this.formData.influencer_agentur_adresse || ''}"
                   placeholder="Straße, PLZ Stadt">
          </div>
          <div class="form-field">
            <label for="influencer_agentur_vertretung">Vertreten durch</label>
            <input type="text" id="influencer_agentur_vertretung" name="influencer_agentur_vertretung"
                   value="${this.formData.influencer_agentur_vertretung || ''}"
                   placeholder="Name des Vertreters">
          </div>
        </div>

        <h3 class="mt-section">Influencer-Daten</h3>
        
        <div class="form-field">
          <label for="influencer_land">Land</label>
          <input type="text" id="influencer_land" name="influencer_land"
                 value="${this.formData.influencer_land || 'Deutschland'}">
        </div>

        <div class="form-field">
          <label for="name">Vertragsname (automatisch generiert)</label>
          <input type="text" id="name" name="name" readonly 
                 value="${this.formData.name || ''}"
                 placeholder="Wird automatisch generiert..." class="readonly-field">
        </div>
      </div>
    `;
  }

  // Influencer Step 3: Plattformen & Inhalte
  renderInfluencerStep3() {
    const veroeffentlichungsplan = this.formData.veroeffentlichungsplan || {};
    
    return `
      <div class="step-section">
        <h3>§2 Plattformen & Inhalte</h3>
        
        <div class="form-field">
          <label>2.1 Plattformen</label>
          <div class="checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" name="plattformen" value="instagram"
                     ${(this.formData.plattformen || []).includes('instagram') ? 'checked' : ''}>
              <span>Instagram</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="plattformen" value="tiktok"
                     ${(this.formData.plattformen || []).includes('tiktok') ? 'checked' : ''}>
              <span>TikTok</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="plattformen" value="youtube"
                     ${(this.formData.plattformen || []).includes('youtube') ? 'checked' : ''}>
              <span>YouTube</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="plattformen" value="sonstige"
                     ${(this.formData.plattformen || []).includes('sonstige') ? 'checked' : ''}>
              <span>Sonstige</span>
            </label>
          </div>
        </div>

        <div class="form-field ${(this.formData.plattformen || []).includes('sonstige') ? '' : 'hidden'}" id="plattformen-sonstige-wrapper">
          <label for="plattformen_sonstige">Sonstige Plattform</label>
          <input type="text" id="plattformen_sonstige" name="plattformen_sonstige"
                 value="${this.formData.plattformen_sonstige || ''}"
                 placeholder="z.B. LinkedIn, Twitter">
        </div>

        <!-- Profile werden automatisch aus dem Creator-Profil übernommen -->

        <h4>2.2 Inhalte</h4>
        <div class="form-three-col">
          <div class="form-field">
            <label for="anzahl_reels">Videos / Reels</label>
            <input type="number" id="anzahl_reels" name="anzahl_reels" min="0" 
                   value="${this.formData.anzahl_reels || 0}">
          </div>
          <div class="form-field">
            <label for="anzahl_feed_posts">Feed-Posts</label>
            <input type="number" id="anzahl_feed_posts" name="anzahl_feed_posts" min="0" 
                   value="${this.formData.anzahl_feed_posts || 0}">
          </div>
          <div class="form-field">
            <label for="anzahl_storys">Story-Slides</label>
            <input type="number" id="anzahl_storys" name="anzahl_storys" min="0" 
                   value="${this.formData.anzahl_storys || 0}">
          </div>
        </div>

        <h3>§3 Konzept, Freigabe & Veröffentlichungsplan</h3>
        <p class="form-hint">Der Content ist der LikeGroup GmbH vor Veröffentlichung zur Freigabe vorzulegen.</p>

        <div class="form-field">
          <label for="korrekturschleifen">3.1 Korrekturschleifen</label>
          <div class="radio-group radio-group-inline">
            <label class="radio-option">
              <input type="radio" name="korrekturschleifen" value="1" 
                     ${this.formData.korrekturschleifen === 1 ? 'checked' : ''}>
              <span>1</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="korrekturschleifen" value="2" 
                     ${this.formData.korrekturschleifen === 2 ? 'checked' : ''}>
              <span>2</span>
            </label>
          </div>
        </div>

        <h4>3.2 Veröffentlichungsplan</h4>
        
        <div class="form-three-col">
          <div id="veroeffentlichungsplan-videos" class="veroeffentlichungsplan-section">
            <h5>Videos / Reels</h5>
            <div id="video-dates-list">
              ${this.renderVeroeffentlichungsDaten('videos', veroeffentlichungsplan.videos || [])}
            </div>
          </div>

          <div id="veroeffentlichungsplan-feed-posts" class="veroeffentlichungsplan-section">
            <h5>Feed-Posts</h5>
            <div id="feed-post-dates-list">
              ${this.renderVeroeffentlichungsDaten('feed_posts', veroeffentlichungsplan.feed_posts || [])}
            </div>
          </div>

          <div id="veroeffentlichungsplan-storys" class="veroeffentlichungsplan-section">
            <h5>Story-Slides</h5>
            <div id="story-dates-list">
              ${this.renderVeroeffentlichungsDaten('storys', veroeffentlichungsplan.storys || [])}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Helper: Veröffentlichungsdaten rendern
  renderVeroeffentlichungsDaten(typ, dates) {
    const labels = {
      'videos': 'Video',
      'feed_posts': 'Feed-Post',
      'storys': 'Story-Slide'
    };
    const label = labels[typ] || typ;
    
    if (!dates || dates.length === 0) {
      return `<div class="no-dates-hint">Noch keine ${label}-Termine geplant</div>`;
    }
    
    return dates.map((date, idx) => `
      <div class="veroeffentlichung-item" data-idx="${idx}">
        <span class="veroeffentlichung-label">${label} ${idx + 1}</span>
        <input type="date" name="${typ}_date_${idx}" value="${date}" class="veroeffentlichung-date">
      </div>
    `).join('');
  }

  // Influencer Step 4: Nutzungsrechte & Media Buyout
  renderInfluencerStep4() {
    return `
      <div class="step-section">
        <h3>§5 Nutzungsrechte & Media Buyout</h3>
        
        <div class="form-field">
          <label>5.1 Organische Veröffentlichung</label>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="organische_veroeffentlichung" value="influencer_only" 
                     ${this.formData.organische_veroeffentlichung === 'influencer_only' ? 'checked' : ''}>
              <span>Veröffentlichung ausschließlich über den Influencer</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="organische_veroeffentlichung" value="collab" 
                     ${this.formData.organische_veroeffentlichung === 'collab' ? 'checked' : ''}>
              <span>Co-Autoren-Post / Collab</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="organische_veroeffentlichung" value="zusatz_unternehmen" 
                     ${this.formData.organische_veroeffentlichung === 'zusatz_unternehmen' ? 'checked' : ''}>
              <span>Zusätzliche Veröffentlichung durch Unternehmen/Kunden</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="organische_veroeffentlichung" value="keine_zusatz" 
                     ${this.formData.organische_veroeffentlichung === 'keine_zusatz' ? 'checked' : ''}>
              <span>Keine zusätzliche Veröffentlichung durch Unternehmen/Kunden</span>
            </label>
          </div>
        </div>

        <div class="form-field">
          <label>5.2 Zusätzliche Nutzung für Werbung (Media Buyout)</label>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="media_buyout" value="organisch" 
                     ${this.formData.media_buyout === 'organisch' ? 'checked' : ''}>
              <span>Organisch</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="media_buyout" value="paid" 
                     ${this.formData.media_buyout === 'paid' ? 'checked' : ''}>
              <span>Paid Ads</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="media_buyout" value="beides" 
                     ${this.formData.media_buyout === 'beides' ? 'checked' : ''}>
              <span>Organisch & Paid Ads</span>
            </label>
          </div>
        </div>

        <div class="form-field">
          <label for="nutzungsdauer">Nutzungsdauer</label>
          <div class="radio-group radio-group-inline">
            <label class="radio-option">
              <input type="radio" name="nutzungsdauer" value="unbegrenzt" 
                     ${this.formData.nutzungsdauer === 'unbegrenzt' ? 'checked' : ''}>
              <span>Unbegrenzt</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="nutzungsdauer" value="12_monate" 
                     ${this.formData.nutzungsdauer === '12_monate' ? 'checked' : ''}>
              <span>12 Monate</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="nutzungsdauer" value="6_monate" 
                     ${this.formData.nutzungsdauer === '6_monate' ? 'checked' : ''}>
              <span>6 Monate</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="nutzungsdauer" value="3_monate" 
                     ${this.formData.nutzungsdauer === '3_monate' ? 'checked' : ''}>
              <span>3 Monate</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="nutzungsdauer" value="individuell" 
                     ${this.formData.nutzungsdauer === 'individuell' ? 'checked' : ''}>
              <span>Individuell</span>
            </label>
          </div>
        </div>
        <div class="form-field ${this.formData.nutzungsdauer === 'individuell' ? '' : 'hidden'}" id="nutzungsdauer-custom-wrapper">
          <label for="nutzungsdauer_custom_wert">Nutzungsdauer individuell</label>
          <div class="input-with-select">
            <input type="number" id="nutzungsdauer_custom_wert" name="nutzungsdauer_custom_wert" min="1" max="99"
                   value="${this.formData.nutzungsdauer_custom_wert ?? ''}" placeholder="Anzahl">
            <select id="nutzungsdauer_custom_einheit" name="nutzungsdauer_custom_einheit">
              <option value="jahre" ${this.formData.nutzungsdauer_custom_einheit === 'jahre' ? 'selected' : ''}>Jahre</option>
              <option value="monate" ${!this.formData.nutzungsdauer_custom_einheit || this.formData.nutzungsdauer_custom_einheit === 'monate' ? 'selected' : ''}>Monate</option>
            </select>
          </div>
        </div>

        <div class="form-field">
          <label>Medien</label>
          <div class="checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" name="medien" value="social_media"
                     ${(this.formData.medien || []).includes('social_media') ? 'checked' : ''}>
              <span>Social Media</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="medien" value="website"
                     ${(this.formData.medien || []).includes('website') ? 'checked' : ''}>
              <span>Website</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="medien" value="otv"
                     ${(this.formData.medien || []).includes('otv') ? 'checked' : ''}>
              <span>OTV</span>
            </label>
          </div>
        </div>

        <p class="form-hint mt-xs">Der Content darf technisch angepasst werden. Eine Weitergabe an Dritte ist ausgeschlossen.</p>

        <h4>5.3 Exklusivität</h4>
        <div class="form-two-col">
          <div class="form-field">
            <label class="checkbox-label">
              <input type="checkbox" id="exklusivitaet" name="exklusivitaet" value="true"
                     ${this.formData.exklusivitaet ? 'checked' : ''}>
              <span>Exklusivität vereinbart</span>
            </label>
          </div>
          <div class="form-field ${this.formData.exklusivitaet ? '' : 'hidden'}" id="exklusivitaet-monate-wrapper">
            <label for="exklusivitaet_monate">Zeitraum</label>
            <div class="input-with-select">
              <input type="number" id="exklusivitaet_monate" name="exklusivitaet_monate" min="1" max="365"
                     value="${this.formData.exklusivitaet_monate || ''}" placeholder="Anzahl">
              <select id="exklusivitaet_einheit" name="exklusivitaet_einheit">
                <option value="monate" ${!this.formData.exklusivitaet_einheit || this.formData.exklusivitaet_einheit === 'monate' ? 'selected' : ''}>Monate</option>
                <option value="wochen" ${this.formData.exklusivitaet_einheit === 'wochen' ? 'selected' : ''}>Wochen</option>
                <option value="tage" ${this.formData.exklusivitaet_einheit === 'tage' ? 'selected' : ''}>Tage</option>
              </select>
            </div>
          </div>
        </div>
        <p class="form-hint">Am Veröffentlichungstag darf keine Werbung für konkurrierende Marken erfolgen.</p>

        <h3 class="mt-section">§10 Reichweiten-Garantie</h3>
        <div class="form-two-col">
          <div class="form-field">
            <div class="radio-group">
              <label class="radio-option">
                <input type="radio" name="reichweiten_garantie" value="false" 
                       ${!this.formData.reichweiten_garantie ? 'checked' : ''}>
                <span>Keine Garantie</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="reichweiten_garantie" value="true" 
                       ${this.formData.reichweiten_garantie ? 'checked' : ''}>
                <span>Mindestreichweite</span>
              </label>
            </div>
          </div>
          <div class="form-field ${this.formData.reichweiten_garantie ? '' : 'hidden'}" id="reichweiten-wert-wrapper">
            <label for="reichweiten_garantie_wert">Mindestreichweite</label>
            <input type="number" id="reichweiten_garantie_wert" name="reichweiten_garantie_wert" min="0"
                   value="${this.formData.reichweiten_garantie_wert || ''}">
          </div>
        </div>

        <h3 class="mt-section">§11 Mindest-Online-Dauer</h3>
        <div class="form-field">
          <div class="radio-group radio-group-inline">
            <label class="radio-option">
              <input type="radio" name="mindest_online_dauer" value="7_tage" 
                     ${this.formData.mindest_online_dauer === '7_tage' ? 'checked' : ''}>
              <span>7 Tage</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="mindest_online_dauer" value="14_tage" 
                     ${this.formData.mindest_online_dauer === '14_tage' ? 'checked' : ''}>
              <span>14 Tage</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="mindest_online_dauer" value="30_tage" 
                     ${this.formData.mindest_online_dauer === '30_tage' ? 'checked' : ''}>
              <span>30 Tage</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="mindest_online_dauer" value="unbegrenzt" 
                     ${this.formData.mindest_online_dauer === 'unbegrenzt' ? 'checked' : ''}>
              <span>Unbegrenzt</span>
            </label>
          </div>
        </div>
      </div>
    `;
  }

  // Influencer Step 5: Vergütung & Qualität
  renderInfluencerStep5() {
    return `
      <div class="step-section">
        <h3>§6 Vergütung</h3>
        
        <div class="form-two-col">
          <div class="form-field">
            <label for="verguetung_netto">Fixvergütung (netto) <span class="required">*</span></label>
            <div class="input-with-suffix">
              <input type="number" id="verguetung_netto" name="verguetung_netto" 
                     step="0.01" min="0" required
                     value="${this.formData.verguetung_netto || ''}">
              <span class="input-suffix">€</span>
            </div>
          </div>
          <div class="form-field">
            <label for="zahlungsziel">Zahlungsziel</label>
            <div class="radio-group radio-group-inline">
              <label class="radio-option">
                <input type="radio" name="zahlungsziel" value="14_tage" 
                       ${this.formData.zahlungsziel === '14_tage' ? 'checked' : ''}>
                <span>14 Tage</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="zahlungsziel" value="30_tage" 
                       ${this.formData.zahlungsziel === '30_tage' ? 'checked' : ''}>
                <span>30 Tage</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="zahlungsziel" value="45_tage" 
                       ${this.formData.zahlungsziel === '45_tage' ? 'checked' : ''}>
                <span>45 Tage</span>
              </label>
            </div>
          </div>
        </div>

        <div class="form-two-col">
          <div class="form-field">
            <label class="checkbox-label">
              <input type="checkbox" id="zusatzkosten" name="zusatzkosten" value="true"
                     ${this.formData.zusatzkosten ? 'checked' : ''}>
              <span>Zusatzkosten vereinbart</span>
            </label>
          </div>
          <div class="form-field ${this.formData.zusatzkosten ? '' : 'hidden'}" id="zusatzkosten-wrapper">
            <label for="zusatzkosten_betrag">Zusatzkosten (netto)</label>
            <div class="input-with-suffix">
              <input type="number" id="zusatzkosten_betrag" name="zusatzkosten_betrag" 
                     step="0.01" min="0"
                     value="${this.formData.zusatzkosten_betrag || ''}">
              <span class="input-suffix">€</span>
            </div>
          </div>
        </div>

        <div class="form-field">
          <label>Skonto</label>
          <div class="radio-group radio-group-inline">
            <label class="radio-option">
              <input type="radio" name="skonto" value="true" 
                     ${this.formData.skonto ? 'checked' : ''}>
              <span>Ja (3% bei Zahlung innerhalb 7 Tage)</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="skonto" value="false" 
                     ${!this.formData.skonto ? 'checked' : ''}>
              <span>Nein</span>
            </label>
          </div>
        </div>

        <p class="form-hint">Die Zahlung erfolgt durch den Auftraggeber oder die LikeGroup GmbH im Auftrag des Kunden. Die Rechnungsstellung erfolgt nach Veröffentlichung bzw. Erreichung der Ziele.</p>

        <h3 class="mt-section">§7 Qualitätsanforderungen</h3>
        <p class="form-hint">Der Content muss technisch sauber (Ton, Licht, Bild), natürlich und nicht übermäßig werblich, markenkonform, visuell hochwertig, kreativ, lebendig und mit ästhetisch geeignetem Hintergrund umgesetzt sein.</p>

        <h3 class="mt-section">§8 Anpassungen</h3>
        <p class="form-hint">Kostenfreie Anpassungen umfassen u.a.:</p>
        <div class="form-field">
          <div class="checkbox-group checkbox-group-multi">
            <label class="checkbox-label">
              <input type="checkbox" name="anpassungen" value="schnitt"
                     ${(this.formData.anpassungen || []).includes('schnitt') ? 'checked' : ''}>
              <span>Schnitt & Tempo</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="anpassungen" value="hook"
                     ${(this.formData.anpassungen || []).includes('hook') ? 'checked' : ''}>
              <span>Hook / Einstieg</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="anpassungen" value="szenenreihenfolge"
                     ${(this.formData.anpassungen || []).includes('szenenreihenfolge') ? 'checked' : ''}>
              <span>Szenenreihenfolge</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="anpassungen" value="effekte"
                     ${(this.formData.anpassungen || []).includes('effekte') ? 'checked' : ''}>
              <span>Effekte / Zooms</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="anpassungen" value="untertitel"
                     ${(this.formData.anpassungen || []).includes('untertitel') ? 'checked' : ''}>
              <span>Untertitel</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="anpassungen" value="nachfilmen"
                     ${(this.formData.anpassungen || []).includes('nachfilmen') ? 'checked' : ''}>
              <span>Nachfilmen einzelner Szenen</span>
            </label>
          </div>
        </div>

        <h3 class="mt-section">Weitere Bestimmungen</h3>
        <div class="form-field">
          <label for="weitere_bestimmungen">Zusätzliche Vereinbarungen (optional)</label>
          <textarea id="weitere_bestimmungen" name="weitere_bestimmungen" rows="4"
                    placeholder="z.B. besondere Vereinbarungen, Sonderkonditionen...">${this.formData.weitere_bestimmungen || ''}</textarea>
        </div>
      </div>
    `;
  }

  // ============================================
  // VIDEOGRAF-VERTRAG STEPS
  // ============================================

  // Videograf Step 2: Vertragsparteien
  renderVideografStep2() {
    if (!this._filtersInitialized) {
      this.updateFilteredKampagnen();
    }
    
    return `
      <div class="step-section">
        <h3>Vertragsparteien</h3>
        <p class="step-description">Vertragstyp: <strong>Videografen- & Fotografen-Produktionsvertrag</strong></p>
        
        <!-- Kunde (Unternehmen) -->
        <div class="form-field">
          <label for="kunde_unternehmen_id">Kunde (Unternehmen) <span class="required">*</span></label>
          <select id="kunde_unternehmen_id" name="kunde_unternehmen_id" required data-searchable="true">
            <option value="">Unternehmen auswählen...</option>
            ${this.unternehmen.map(u => `
              <option value="${u.id}" ${this.formData.kunde_unternehmen_id === u.id ? 'selected' : ''}>
                ${u.firmenname}
              </option>
            `).join('')}
          </select>
          <div id="kunde-adresse" class="address-preview"></div>
        </div>

        <div class="form-field">
          <label for="kunde_rechtsform">Rechtsform <span class="required">*</span></label>
          <input type="text" id="kunde_rechtsform" name="kunde_rechtsform" 
                 placeholder="z.B. GmbH, AG, UG..."
                 value="${this.formData.kunde_rechtsform || ''}" required>
        </div>

        <!-- Kampagne -->
        <div class="form-field">
          <label for="kampagne_id">Kampagne <span class="required">*</span></label>
          <select id="kampagne_id" name="kampagne_id" required ${!this.formData.kunde_unternehmen_id ? 'disabled' : ''} data-searchable="true">
            <option value="">${this.formData.kunde_unternehmen_id ? 'Kampagne auswählen...' : 'Bitte zuerst Kunde wählen...'}</option>
            ${this.filteredKampagnen.map(k => `
              <option value="${k.id}" ${this.formData.kampagne_id === k.id ? 'selected' : ''}>
                ${KampagneUtils.getDisplayName(k)}
              </option>
            `).join('')}
          </select>
        </div>

        <h3 class="mt-section">Auftragnehmer (Videograf / Fotograf)</h3>

        <!-- Auftragnehmer (Creator) -->
        <div class="form-field">
          <label for="creator_id">Videograf/Fotograf <span class="required">*</span></label>
          <select id="creator_id" name="creator_id" required ${!this.formData.kampagne_id ? 'disabled' : ''} data-searchable="true">
            <option value="">${this.formData.kampagne_id ? 'Auftragnehmer auswählen...' : 'Bitte zuerst Kampagne wählen...'}</option>
            ${this.filteredCreators.map(c => `
              <option value="${c.id}" ${this.formData.creator_id === c.id ? 'selected' : ''}>
                ${c.vorname} ${c.nachname}
              </option>
            `).join('')}
          </select>
          <div id="creator-adresse" class="address-preview"></div>
        </div>

        <div class="form-two-col">
          <div class="form-field">
            <label for="influencer_steuer_id">Steuer-ID / USt-ID</label>
            <input type="text" id="influencer_steuer_id" name="influencer_steuer_id" 
                   placeholder="z.B. DE123456789"
                   value="${this.formData.influencer_steuer_id || ''}">
          </div>
          <div class="form-field">
            <label for="influencer_land">Land</label>
            <select id="influencer_land" name="influencer_land">
              <option value="Deutschland" ${this.formData.influencer_land === 'Deutschland' || !this.formData.influencer_land ? 'selected' : ''}>Deutschland</option>
              <option value="Österreich" ${this.formData.influencer_land === 'Österreich' ? 'selected' : ''}>Österreich</option>
              <option value="Schweiz" ${this.formData.influencer_land === 'Schweiz' ? 'selected' : ''}>Schweiz</option>
              <option value="Andere" ${this.formData.influencer_land === 'Andere' ? 'selected' : ''}>Andere</option>
            </select>
          </div>
        </div>
      </div>
    `;
  }

  // Videograf Step 3: Leistungsumfang & Produktion
  renderVideografStep3() {
    return `
      <div class="step-section">
        <h3>§2 Leistungsumfang</h3>
        
        <h4>2.1 Art der Leistung</h4>
        <div class="form-field">
          <label>Was wird produziert? <span class="required">*</span></label>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="content_erstellung_art" value="video" 
                     ${this.formData.content_erstellung_art === 'video' ? 'checked' : ''} required>
              <span>Video</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="content_erstellung_art" value="foto" 
                     ${this.formData.content_erstellung_art === 'foto' ? 'checked' : ''}>
              <span>Foto</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="content_erstellung_art" value="video_foto" 
                     ${this.formData.content_erstellung_art === 'video_foto' ? 'checked' : ''}>
              <span>Video & Foto</span>
            </label>
          </div>
        </div>

        <div class="form-two-col">
          <div class="form-field">
            <label for="anzahl_videos">Anzahl Videos</label>
            <input type="number" id="anzahl_videos" name="anzahl_videos" min="0" 
                   value="${this.formData.anzahl_videos || 0}">
          </div>
          <div class="form-field">
            <label for="anzahl_fotos">Anzahl Fotos</label>
            <input type="number" id="anzahl_fotos" name="anzahl_fotos" min="0" 
                   value="${this.formData.anzahl_fotos || 0}">
          </div>
        </div>

        <h4 class="mt-subsection">2.2 Produktionsart</h4>
        <div class="form-field">
          <label>Wie wird produziert? <span class="required">*</span></label>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="videograf_produktionsart" value="briefing" 
                     ${this.formData.videograf_produktionsart === 'briefing' ? 'checked' : ''} required>
              <span>Produktion nach Briefing</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="videograf_produktionsart" value="skript_shotlist" 
                     ${this.formData.videograf_produktionsart === 'skript_shotlist' ? 'checked' : ''}>
              <span>Produktion nach Skript / Shotlist</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="videograf_produktionsart" value="eigenstaendig" 
                     ${this.formData.videograf_produktionsart === 'eigenstaendig' ? 'checked' : ''}>
              <span>Eigenständige Umsetzung nach Zielvorgabe</span>
            </label>
          </div>
        </div>

        <h4 class="mt-subsection">2.3 Drehtage & Produktionsorte</h4>
        <p class="form-hint">Fügen Sie für jeden Drehtag das Datum und den Produktionsort hinzu.</p>
        
        <div id="videograf-produktionsplan-container">
          ${this.renderProduktionsplanRows()}
        </div>
        
        <button type="button" class="mdc-btn mdc-btn--secondary mt-xs" id="btn-add-drehtag">
          
          Drehtag hinzufügen
        </button>

        <p class="form-hint mt-sm">Der Auftragnehmer verpflichtet sich, zum vereinbarten Zeitpunkt vollständig einsatzbereit zu erscheinen und die Produktion fachgerecht durchzuführen.</p>
      </div>
    `;
  }

  // Helper: Produktionsplan-Rows rendern
  renderProduktionsplanRows() {
    const produktionsplan = this.formData.videograf_produktionsplan || [{ datum: '', ort: '' }];
    
    // Falls leer, mindestens eine Row
    if (produktionsplan.length === 0) {
      produktionsplan.push({ datum: '', ort: '' });
    }
    
    return produktionsplan.map((item, index) => `
      <div class="produktionsplan-row" data-index="${index}">
        <div class="form-field form-field--date">
          <label for="drehtag_datum_${index}">${index === 0 ? 'Drehtag <span class="required">*</span>' : `Drehtag ${index + 1}`}</label>
          <input type="date" id="drehtag_datum_${index}" name="drehtag_datum_${index}" 
                 value="${item.datum || ''}" ${index === 0 ? 'required' : ''}>
        </div>
        <div class="form-field form-field--ort">
          <label for="drehtag_ort_${index}">${index === 0 ? 'Produktionsort <span class="required">*</span>' : 'Produktionsort'}</label>
          <input type="text" id="drehtag_ort_${index}" name="drehtag_ort_${index}" 
                 placeholder="z.B. Frankfurt am Main, Studio ABC"
                 value="${item.ort || ''}" ${index === 0 ? 'required' : ''}>
        </div>
        ${index > 0 ? `
          <button type="button" class="mdc-btn mdc-btn--cancel" data-index="${index}" title="Entfernen">
            Entfernen
          </button>
        ` : ''}
      </div>
    `).join('');
  }

  // Videograf Step 4: Output, Abgabe & Korrektur
  renderVideografStep4() {
    const lieferumfang = this.formData.videograf_lieferumfang || [];
    
    return `
      <div class="step-section">
        <h3>§3 Output, Abgabe & Versionierung</h3>
        
        <h4>3.1 Lieferumfang</h4>
        <div class="form-field">
          <label>Was wird geliefert?</label>
          <div class="checkbox-group checkbox-group-multi">
            <label class="checkbox-label">
              <input type="checkbox" name="videograf_lieferumfang" value="fertig_geschnitten"
                     ${lieferumfang.includes('fertig_geschnitten') ? 'checked' : ''}>
              <span>Fertig geschnittenes Video</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="videograf_lieferumfang" value="farbkorrektur"
                     ${lieferumfang.includes('farbkorrektur') ? 'checked' : ''}>
              <span>Farbkorrektur / Grading enthalten</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="videograf_lieferumfang" value="sounddesign"
                     ${lieferumfang.includes('sounddesign') ? 'checked' : ''}>
              <span>Sounddesign enthalten</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="videograf_lieferumfang" value="rohmaterial"
                     ${lieferumfang.includes('rohmaterial') ? 'checked' : ''}>
              <span>Rohmaterial (alle Clips)</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="videograf_lieferumfang" value="projektdateien"
                     ${lieferumfang.includes('projektdateien') ? 'checked' : ''}>
              <span>Projektdateien (z.B. Premiere / Final Cut)</span>
            </label>
          </div>
        </div>

        <h4 class="mt-subsection">3.2 Abgabe der ersten Version (V1)</h4>
        <div class="form-field">
          <label for="videograf_v1_deadline">V1 Deadline <span class="required">*</span></label>
          <input type="date" id="videograf_v1_deadline" name="videograf_v1_deadline" 
                 value="${this.formData.videograf_v1_deadline || ''}" required>
          <p class="form-hint">Die erste inhaltliche Version (Preview / V1) ist spätestens bis zu diesem Datum digital zur Verfügung zu stellen.</p>
        </div>

        <h4 class="mt-subsection">3.3 Korrekturschleifen</h4>
        <div class="form-field">
          <label>Anzahl Korrekturschleifen <span class="required">*</span></label>
          <div class="radio-group radio-group-inline">
            <label class="radio-option">
              <input type="radio" name="korrekturschleifen" value="1" 
                     ${this.formData.korrekturschleifen == 1 ? 'checked' : ''} required>
              <span>1 Korrekturschleife</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="korrekturschleifen" value="2" 
                     ${this.formData.korrekturschleifen == 2 ? 'checked' : ''}>
              <span>2 Korrekturschleifen</span>
            </label>
          </div>
          <p class="form-hint">Eine Korrekturschleife umfasst jeweils eine überarbeitete Version nach Feedback.</p>
        </div>

        <h4 class="mt-subsection">3.4 Abgabe der finalen Version</h4>
        <div class="form-field">
          <label for="videograf_finale_werktage">Werktage nach letzter Korrektur <span class="required">*</span></label>
          <div class="input-with-suffix">
            <input type="number" id="videograf_finale_werktage" name="videograf_finale_werktage" 
                   min="1" max="30" 
                   value="${this.formData.videograf_finale_werktage || 5}" required>
            <span class="input-suffix">Werktage</span>
          </div>
          <p class="form-hint">Die finale Version ist spätestens X Werktage nach Abschluss der letzten Korrekturschleife bereitzustellen.</p>
        </div>
      </div>
    `;
  }

  // Videograf Step 5: Nutzungsrechte & Vergütung
  renderVideografStep5() {
    const nutzungsart = this.formData.videograf_nutzungsart || [];
    
    return `
      <div class="step-section">
        <h3>§7 Nutzungsrechte</h3>
        <p class="form-hint">Der Auftragnehmer überträgt dem Auftraggeber ausschließliche, zeitlich und räumlich unbegrenzte Nutzungsrechte an sämtlichen erstellten Inhalten.</p>
        
        <div class="form-field">
          <label>Nutzungsart <span class="required">*</span></label>
          <div class="checkbox-group checkbox-group-multi">
            <label class="checkbox-label">
              <input type="checkbox" name="videograf_nutzungsart" value="organisch"
                     ${nutzungsart.includes('organisch') ? 'checked' : ''}>
              <span>Organische Nutzung</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="videograf_nutzungsart" value="paid_ads"
                     ${nutzungsart.includes('paid_ads') ? 'checked' : ''}>
              <span>Paid Ads</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="videograf_nutzungsart" value="alle_medien"
                     ${nutzungsart.includes('alle_medien') ? 'checked' : ''}>
              <span>Alle Medien (Social Media, Website, OTV, Print)</span>
            </label>
          </div>
        </div>

        <p class="form-hint">Eine Urheberbenennung ist nicht erforderlich, sofern nicht ausdrücklich vereinbart.</p>

        <h3 class="mt-section">§9 Vergütung</h3>
        
        <div class="form-two-col">
          <div class="form-field">
            <label for="verguetung_netto">Fixvergütung (netto) <span class="required">*</span></label>
            <div class="input-with-suffix">
              <input type="number" id="verguetung_netto" name="verguetung_netto" 
                     step="0.01" min="0" required
                     value="${this.formData.verguetung_netto || ''}">
              <span class="input-suffix">€</span>
            </div>
          </div>
          <div class="form-field">
            <label for="zahlungsziel">Zahlungsziel</label>
            <div class="radio-group radio-group-inline">
              <label class="radio-option">
                <input type="radio" name="zahlungsziel" value="14_tage" 
                       ${this.formData.zahlungsziel === '14_tage' ? 'checked' : ''}>
                <span>14 Tage</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="zahlungsziel" value="30_tage" 
                       ${this.formData.zahlungsziel === '30_tage' ? 'checked' : ''}>
                <span>30 Tage</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="zahlungsziel" value="45_tage" 
                       ${this.formData.zahlungsziel === '45_tage' ? 'checked' : ''}>
                <span>45 Tage</span>
              </label>
            </div>
          </div>
        </div>

        <div class="form-two-col">
          <div class="form-field">
            <label class="checkbox-label">
              <input type="checkbox" id="zusatzkosten" name="zusatzkosten" value="true"
                     ${this.formData.zusatzkosten ? 'checked' : ''}>
              <span>Zusatzkosten vereinbart (z.B. Reisekosten, Requisiten)</span>
            </label>
          </div>
          <div class="form-field ${this.formData.zusatzkosten ? '' : 'hidden'}" id="zusatzkosten-wrapper">
            <label for="zusatzkosten_betrag">Zusatzkosten (netto)</label>
            <div class="input-with-suffix">
              <input type="number" id="zusatzkosten_betrag" name="zusatzkosten_betrag" 
                     step="0.01" min="0"
                     value="${this.formData.zusatzkosten_betrag || ''}">
              <span class="input-suffix">€</span>
            </div>
          </div>
        </div>

        <div class="form-field">
          <label>Skonto</label>
          <div class="radio-group radio-group-inline">
            <label class="radio-option">
              <input type="radio" name="skonto" value="true" 
                     ${this.formData.skonto ? 'checked' : ''}>
              <span>Ja (3% bei Zahlung innerhalb 7 Tage)</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="skonto" value="false" 
                     ${!this.formData.skonto ? 'checked' : ''}>
              <span>Nein</span>
            </label>
          </div>
        </div>

        <p class="form-hint">Die Zahlung erfolgt durch die LikeGroup GmbH im Auftrag des Kunden. Die Rechnungsstellung erfolgt nach finaler Abnahme.</p>

        <h3 class="mt-section">Weitere Bestimmungen</h3>
        <div class="form-field">
          <label for="weitere_bestimmungen">Zusätzliche Vereinbarungen (optional)</label>
          <textarea id="weitere_bestimmungen" name="weitere_bestimmungen" rows="4"
                    placeholder="z.B. besondere Vereinbarungen, Sonderkonditionen...">${this.formData.weitere_bestimmungen || ''}</textarea>
        </div>
      </div>
    `;
  }

  // Events für Multistep (Buttons sind jetzt im Progress Container)
  bindMultistepEvents() {
    const cancelBtn = document.getElementById('btn-cancel');
    const prevBtn = document.getElementById('btn-prev');
    const nextBtn = document.getElementById('btn-next');
    const submitBtn = document.getElementById('btn-submit');
    const saveDraftBtn = document.getElementById('btn-save-draft');
    const languageButtons = document.querySelectorAll('[data-contract-lang]');

    // Abbrechen
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        window.navigateTo('/vertraege');
      });
    }

    // Draft speichern (in DB)
    if (saveDraftBtn) {
      saveDraftBtn.addEventListener('click', async () => {
        this.saveCurrentStepData();
        await this.saveDraftToDB();
      });
    }

    // Zurück
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        this.saveCurrentStepData();
        this.currentStep--;
        this.render();
      });
    }

    // Weiter
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (this.validateCurrentStep()) {
          this.saveCurrentStepData();
          this.currentStep++;
          this.render();
        }
      });
    }
    
    // Submit (Vertrag erstellen)
    if (submitBtn) {
      submitBtn.addEventListener('click', async () => {
        if (this.validateCurrentStep()) {
          this.saveCurrentStepData();
          await this.handleSubmit(null, false);
        }
      });
    }

    // Submit und Neu (gleiche Daten behalten)
    const submitAndNewBtn = document.getElementById('btn-submit-and-new');
    if (submitAndNewBtn) {
      submitAndNewBtn.addEventListener('click', async () => {
        if (this.validateCurrentStep()) {
          this.saveCurrentStepData();
          await this.handleSubmit(null, true); // true = startNewAfter
        }
      });
    }

    if (languageButtons.length > 0) {
      languageButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const lang = btn.dataset.contractLang === 'en' ? 'en' : 'de';
          this.formData.vertragssprache = lang;
          languageButtons.forEach((otherBtn) => {
            otherBtn.classList.toggle('btn-active', otherBtn.dataset.contractLang === lang);
          });
        });
      });
    }

    // Dynamische Felder
    this.bindDynamicFieldEvents();
    
    // Adress-Vorschau bei Auswahl
    this.bindAddressPreviewEvents();
  }

  // Draft in Datenbank speichern
  async saveDraftToDB() {
    // Erst aktuelle Formulardaten sammeln!
    this.saveCurrentStepData();
    
    const saveDraftBtn = document.getElementById('btn-save-draft');
    const saveDraftLabel = saveDraftBtn?.querySelector('.btn-label');
    if (saveDraftBtn) {
      saveDraftBtn.disabled = true;
      if (saveDraftLabel) saveDraftLabel.textContent = 'Speichert...';
    }

    try {
      const data = this.prepareDataForDB();
      data.is_draft = true; // Als Draft markieren
      
      console.log('📤 Draft-Daten:', data); // Debug-Log

      if (this.editId) {
        // Update bestehenden Draft
        const { error } = await window.supabase
          .from('vertraege')
          .update(data)
          .eq('id', this.editId);

        if (error) throw error;
        window.toastSystem?.show('Entwurf aktualisiert!', 'success');
      } else {
        // Neuen Draft erstellen
        const { data: created, error } = await window.supabase
          .from('vertraege')
          .insert([data])
          .select()
          .single();

        if (error) throw error;
        
        // ID merken für spätere Updates
        this.editId = created.id;
        window.toastSystem?.show('Entwurf gespeichert!', 'success');
      }

      // Zur Liste navigieren
      setTimeout(() => {
        window.navigateTo('/vertraege');
      }, 500);

    } catch (error) {
      console.error('❌ Fehler beim Speichern des Drafts:', error);
      window.toastSystem?.show(`Fehler: ${error.message}`, 'error');
    } finally {
      if (saveDraftBtn) {
        saveDraftBtn.disabled = false;
        if (saveDraftLabel) saveDraftLabel.textContent = 'Als Entwurf speichern';
      }
    }
  }

  // Daten für DB vorbereiten
  prepareDataForDB() {
    const typ = this.formData.typ || this.selectedTyp;
    
    // Basis-Daten (für alle Vertragstypen)
    const data = {
      typ: typ,
      name: this.formData.name || null,
      kunde_unternehmen_id: this.formData.kunde_unternehmen_id || null,
      kampagne_id: this.formData.kampagne_id || null,
      creator_id: this.formData.creator_id || null,
      anzahl_storys: parseInt(this.formData.anzahl_storys) || 0,
      medien: this.formData.medien || [],
      nutzungsdauer: this.formData.nutzungsdauer || null,
      nutzungsdauer_custom_wert: this.formData.nutzungsdauer === 'individuell' ? (parseInt(this.formData.nutzungsdauer_custom_wert, 10) || null) : null,
      nutzungsdauer_custom_einheit: this.formData.nutzungsdauer === 'individuell' ? (this.formData.nutzungsdauer_custom_einheit || null) : null,
      exklusivitaet: this.formData.exklusivitaet || false,
      exklusivitaet_monate: this.formData.exklusivitaet ? parseInt(this.formData.exklusivitaet_monate) || null : null,
      exklusivitaet_einheit: this.formData.exklusivitaet ? (this.formData.exklusivitaet_einheit || 'monate') : null,
      verguetung_netto: parseFloat(this.formData.verguetung_netto) || null,
      zusatzkosten: this.formData.zusatzkosten || false,
      zusatzkosten_betrag: this.formData.zusatzkosten ? parseFloat(this.formData.zusatzkosten_betrag) || null : null,
      zahlungsziel: this.formData.zahlungsziel || null,
      skonto: this.formData.skonto === true || this.formData.skonto === 'true',
      korrekturschleifen: parseInt(this.formData.korrekturschleifen) || null,
      weitere_bestimmungen: this.formData.weitere_bestimmungen || null,
      kunde_po_nummer: this.formData.kunde_po_nummer || null,
      vertragssprache: this.getContractLanguage(this.formData)
    };

    if (typ === 'Influencer Kooperation') {
      // Influencer-spezifische Felder
      Object.assign(data, {
        // Agentur-Vertretung
        influencer_agentur_vertreten: this.formData.influencer_agentur_vertreten || false,
        influencer_agentur_name: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_name || null : null,
        influencer_agentur_adresse: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_adresse || null : null,
        influencer_agentur_vertretung: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_vertretung || null : null,
        
        // Influencer-Daten
        influencer_land: this.formData.influencer_land || 'Deutschland',
        influencer_profile: this.formData.influencer_profile || [],
        
        // Plattformen & Inhalte
        plattformen: this.formData.plattformen || [],
        plattformen_sonstige: this.formData.plattformen_sonstige || null,
        anzahl_reels: parseInt(this.formData.anzahl_reels) || 0,
        anzahl_feed_posts: parseInt(this.formData.anzahl_feed_posts) || 0,
        
        // Veröffentlichungsplan
        veroeffentlichungsplan: this.formData.veroeffentlichungsplan || {},
        
        // Nutzungsrechte
        organische_veroeffentlichung: this.formData.organische_veroeffentlichung || null,
        media_buyout: this.formData.media_buyout || null,
        
        // Reichweite & Online-Dauer
        reichweiten_garantie: this.formData.reichweiten_garantie || false,
        reichweiten_garantie_wert: this.formData.reichweiten_garantie ? parseInt(this.formData.reichweiten_garantie_wert) || null : null,
        mindest_online_dauer: this.formData.mindest_online_dauer || null,
        
        // Anpassungen
        anpassungen: this.formData.anpassungen || []
      });
    } else if (typ === 'Videograph') {
      // Videograf-spezifische Felder
      Object.assign(data, {
        // Kunde
        kunde_rechtsform: this.formData.kunde_rechtsform || null,
        
        // Auftragnehmer-Daten (nutzt influencer_-Felder für Kompatibilität)
        influencer_steuer_id: this.formData.influencer_steuer_id || null,
        influencer_land: this.formData.influencer_land || 'Deutschland',
        
        // Leistungsumfang
        anzahl_videos: parseInt(this.formData.anzahl_videos) || 0,
        anzahl_fotos: parseInt(this.formData.anzahl_fotos) || 0,
        content_erstellung_art: this.formData.content_erstellung_art || null,
        
        // Videograf-spezifisch
        videograf_produktionsart: this.formData.videograf_produktionsart || null,
        videograf_produktionsplan: this.formData.videograf_produktionsplan || [],
        videograf_lieferumfang: this.formData.videograf_lieferumfang || [],
        videograf_v1_deadline: this.formData.videograf_v1_deadline || null,
        videograf_finale_werktage: parseInt(this.formData.videograf_finale_werktage) || 5,
        videograf_nutzungsart: this.formData.videograf_nutzungsart || []
      });
    } else {
      // UGC-spezifische Felder
      Object.assign(data, {
        // Agentur-Vertretung
        influencer_agentur_vertreten: this.formData.influencer_agentur_vertreten || false,
        influencer_agentur_name: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_name || null : null,
        influencer_agentur_adresse: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_adresse || null : null,
        influencer_agentur_vertretung: this.formData.influencer_agentur_vertreten ? this.formData.influencer_agentur_vertretung || null : null,
        
        anzahl_videos: parseInt(this.formData.anzahl_videos) || 0,
        anzahl_fotos: parseInt(this.formData.anzahl_fotos) || 0,
        content_erstellung_art: this.formData.content_erstellung_art || null,
        lieferung_art: this.formData.lieferung_art || null,
        rohmaterial_enthalten: this.formData.rohmaterial_enthalten || false,
        untertitel: this.formData.untertitel || false,
        nutzungsart: this.formData.nutzungsart || null,
        content_deadline: this.formData.content_deadline || null,
        abnahmedatum: this.formData.abnahmedatum || null
      });
    }

    return data;
  }

  // Dynamische Feld-Events (Exklusivität, Zusatzkosten Toggle, Influencer-spezifisch)
  bindDynamicFieldEvents() {
    // Exklusivität Toggle
    const exklusivitaetCheckbox = document.getElementById('exklusivitaet');
    const exklusivitaetWrapper = document.getElementById('exklusivitaet-monate-wrapper');
    if (exklusivitaetCheckbox && exklusivitaetWrapper) {
      exklusivitaetCheckbox.addEventListener('change', (e) => {
        exklusivitaetWrapper.classList.toggle('hidden', !e.target.checked);
        this.formData.exklusivitaet = e.target.checked;
      });
    }
    // Exklusivität Monate/Einheit sofort speichern bei Eingabe
    const exklusivitaetMonateInput = document.getElementById('exklusivitaet_monate');
    if (exklusivitaetMonateInput) {
      exklusivitaetMonateInput.addEventListener('input', (e) => {
        this.formData.exklusivitaet_monate = e.target.value;
      });
    }
    const exklusivitaetEinheitSelect = document.getElementById('exklusivitaet_einheit');
    if (exklusivitaetEinheitSelect) {
      exklusivitaetEinheitSelect.addEventListener('change', (e) => {
        this.formData.exklusivitaet_einheit = e.target.value;
      });
    }

    // Nutzungsdauer Individuell Toggle (UGC Select + Influencer Radios)
    const nutzungsdauerCustomWrapper = document.getElementById('nutzungsdauer-custom-wrapper');
    const nutzungsdauerSelect = document.getElementById('nutzungsdauer');
    if (nutzungsdauerSelect && nutzungsdauerCustomWrapper) {
      nutzungsdauerSelect.addEventListener('change', (e) => {
        const isIndividuell = e.target.value === 'individuell';
        nutzungsdauerCustomWrapper.classList.toggle('hidden', !isIndividuell);
        this.formData.nutzungsdauer = e.target.value;
      });
    }
    const nutzungsdauerRadios = document.querySelectorAll('input[name="nutzungsdauer"]');
    if (nutzungsdauerRadios.length > 0 && nutzungsdauerCustomWrapper) {
      nutzungsdauerRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
          const isIndividuell = e.target.value === 'individuell';
          nutzungsdauerCustomWrapper.classList.toggle('hidden', !isIndividuell);
          this.formData.nutzungsdauer = e.target.value;
        });
      });
    }
    const nutzungsdauerCustomWertInput = document.getElementById('nutzungsdauer_custom_wert');
    if (nutzungsdauerCustomWertInput) {
      nutzungsdauerCustomWertInput.addEventListener('input', (e) => {
        this.formData.nutzungsdauer_custom_wert = e.target.value || null;
      });
    }
    const nutzungsdauerCustomEinheitSelect = document.getElementById('nutzungsdauer_custom_einheit');
    if (nutzungsdauerCustomEinheitSelect) {
      nutzungsdauerCustomEinheitSelect.addEventListener('change', (e) => {
        this.formData.nutzungsdauer_custom_einheit = e.target.value;
      });
    }

    // Zusatzkosten Toggle
    const zusatzkostenCheckbox = document.getElementById('zusatzkosten');
    const zusatzkostenWrapper = document.getElementById('zusatzkosten-wrapper');
    if (zusatzkostenCheckbox && zusatzkostenWrapper) {
      zusatzkostenCheckbox.addEventListener('change', (e) => {
        zusatzkostenWrapper.classList.toggle('hidden', !e.target.checked);
      });
    }

    // === INFLUENCER-SPEZIFISCHE EVENTS ===
    
    // Agentur-Vertretung Toggle
    const agenturRadios = document.querySelectorAll('input[name="influencer_agentur_vertreten"]');
    const agenturFelder = document.getElementById('agentur-felder');
    if (agenturRadios.length > 0 && agenturFelder) {
      agenturRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
          agenturFelder.classList.toggle('hidden', e.target.value !== 'true');
        });
      });
    }

    // Sonstige Plattform Toggle
    const plattformenCheckboxes = document.querySelectorAll('input[name="plattformen"]');
    const sonstigeWrapper = document.getElementById('plattformen-sonstige-wrapper');
    if (plattformenCheckboxes.length > 0 && sonstigeWrapper) {
      plattformenCheckboxes.forEach(cb => {
        cb.addEventListener('change', () => {
          const sonstigeChecked = document.querySelector('input[name="plattformen"][value="sonstige"]:checked');
          sonstigeWrapper.classList.toggle('hidden', !sonstigeChecked);
        });
      });
    }

    // Reichweiten-Garantie Toggle
    const reichweitenRadios = document.querySelectorAll('input[name="reichweiten_garantie"]');
    const reichweitenWrapper = document.getElementById('reichweiten-wert-wrapper');
    if (reichweitenRadios.length > 0 && reichweitenWrapper) {
      reichweitenRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
          reichweitenWrapper.classList.toggle('hidden', e.target.value !== 'true');
        });
      });
    }

    // Videos/Reels Anzahl → Veröffentlichungsplan automatisch synchronisieren
    const anzahlReelsInput = document.getElementById('anzahl_reels');
    if (anzahlReelsInput) {
      anzahlReelsInput.addEventListener('blur', () => {
        this.syncVeroeffentlichungsplanVideos();
      });
    }

    // Feed-Posts Anzahl → Veröffentlichungsplan automatisch synchronisieren
    const anzahlFeedPostsInput = document.getElementById('anzahl_feed_posts');
    if (anzahlFeedPostsInput) {
      anzahlFeedPostsInput.addEventListener('blur', () => {
        this.syncVeroeffentlichungsplanFeedPosts();
      });
    }

    // Story-Slides Anzahl → Veröffentlichungsplan automatisch synchronisieren
    const anzahlStorysInput = document.getElementById('anzahl_storys');
    if (anzahlStorysInput) {
      anzahlStorysInput.addEventListener('blur', () => {
        this.syncVeroeffentlichungsplanStorys();
      });
    }

    // === VIDEOGRAF: DREHTAGE HINZUFÜGEN/ENTFERNEN ===
    const btnAddDrehtag = document.getElementById('btn-add-drehtag');
    if (btnAddDrehtag) {
      btnAddDrehtag.addEventListener('click', () => {
        this.addDrehtag();
      });
    }

    // Drehtag entfernen (Event Delegation)
    const produktionsplanContainer = document.getElementById('videograf-produktionsplan-container');
    if (produktionsplanContainer) {
      produktionsplanContainer.addEventListener('click', (e) => {
        if (e.target.closest('.btn-remove-drehtag')) {
          const btn = e.target.closest('.btn-remove-drehtag');
          const idx = parseInt(btn.dataset.index, 10);
          this.removeDrehtag(idx);
        }
      });
    }
  }

  // Drehtag hinzufügen
  addDrehtag() {
    const container = document.getElementById('videograf-produktionsplan-container');
    if (!container) return;

    // Aktuelle Daten aus Formular sammeln
    this.collectProduktionsplanData();

    // Neuen leeren Eintrag hinzufügen
    if (!this.formData.videograf_produktionsplan) {
      this.formData.videograf_produktionsplan = [];
    }
    this.formData.videograf_produktionsplan.push({ datum: '', ort: '' });

    // Container neu rendern
    container.innerHTML = this.renderProduktionsplanRows();
  }

  // Drehtag entfernen
  removeDrehtag(idx) {
    const container = document.getElementById('videograf-produktionsplan-container');
    if (!container) return;

    // Aktuelle Daten aus Formular sammeln
    this.collectProduktionsplanData();

    // Eintrag entfernen
    if (this.formData.videograf_produktionsplan && this.formData.videograf_produktionsplan.length > idx) {
      this.formData.videograf_produktionsplan.splice(idx, 1);
    }

    // Container neu rendern
    container.innerHTML = this.renderProduktionsplanRows();
  }

  // Produktionsplan-Daten aus Formular sammeln
  collectProduktionsplanData() {
    const rows = document.querySelectorAll('.produktionsplan-row');
    if (rows.length === 0) return;

    this.formData.videograf_produktionsplan = [];
    rows.forEach((row, index) => {
      const datumInput = document.getElementById(`drehtag_datum_${index}`);
      const ortInput = document.getElementById(`drehtag_ort_${index}`);
      
      if (datumInput && ortInput) {
        this.formData.videograf_produktionsplan.push({
          datum: datumInput.value || '',
          ort: ortInput.value || ''
        });
      }
    });
  }

  // Veröffentlichungsdatum hinzufügen
  addVeroeffentlichungsDatum(typ) {
    const list = document.getElementById(`${typ === 'videos' ? 'video' : 'story'}-dates-list`);
    if (!list) return;

    // Aktuelle Daten sammeln
    if (!this.formData.veroeffentlichungsplan) {
      this.formData.veroeffentlichungsplan = {};
    }
    if (!this.formData.veroeffentlichungsplan[typ]) {
      this.formData.veroeffentlichungsplan[typ] = [];
    }

    // Neues Datum (leer)
    this.formData.veroeffentlichungsplan[typ].push('');
    
    // Liste neu rendern
    list.innerHTML = this.renderVeroeffentlichungsDaten(typ, this.formData.veroeffentlichungsplan[typ]);
  }

  // Veröffentlichungsdatum entfernen
  removeVeroeffentlichungsDatum(typ, idx) {
    if (!this.formData.veroeffentlichungsplan || !this.formData.veroeffentlichungsplan[typ]) return;
    
    this.formData.veroeffentlichungsplan[typ].splice(idx, 1);
    
    const listIds = { 'videos': 'video-dates-list', 'feed_posts': 'feed-post-dates-list', 'storys': 'story-dates-list' };
    const list = document.getElementById(listIds[typ]);
    if (list) {
      list.innerHTML = this.renderVeroeffentlichungsDaten(typ, this.formData.veroeffentlichungsplan[typ]);
    }
  }

  // Veröffentlichungsplan Videos synchronisieren (bei Blur von anzahl_reels)
  syncVeroeffentlichungsplanVideos() {
    const anzahlInput = document.getElementById('anzahl_reels');
    if (!anzahlInput) return;
    
    const anzahl = parseInt(anzahlInput.value) || 0;
    const list = document.getElementById('video-dates-list');
    if (!list) return;
    
    // Initialisiere veroeffentlichungsplan falls nicht vorhanden
    if (!this.formData.veroeffentlichungsplan) {
      this.formData.veroeffentlichungsplan = {};
    }
    
    // Bestehende Daten sammeln (falls vorhanden)
    const existingDates = this.formData.veroeffentlichungsplan.videos || [];
    
    // Neue Array mit exakt N leeren Items erstellen (vorhandene Werte übernehmen)
    const newDates = [];
    for (let i = 0; i < anzahl; i++) {
      newDates.push(existingDates[i] || '');
    }
    
    this.formData.veroeffentlichungsplan.videos = newDates;
    list.innerHTML = this.renderVeroeffentlichungsDaten('videos', newDates);
  }

  // Veröffentlichungsplan Feed-Posts synchronisieren (bei Blur von anzahl_feed_posts)
  syncVeroeffentlichungsplanFeedPosts() {
    const anzahlInput = document.getElementById('anzahl_feed_posts');
    if (!anzahlInput) return;
    
    const anzahl = parseInt(anzahlInput.value) || 0;
    const list = document.getElementById('feed-post-dates-list');
    if (!list) return;
    
    // Initialisiere veroeffentlichungsplan falls nicht vorhanden
    if (!this.formData.veroeffentlichungsplan) {
      this.formData.veroeffentlichungsplan = {};
    }
    
    // Bestehende Daten sammeln (falls vorhanden)
    const existingDates = this.formData.veroeffentlichungsplan.feed_posts || [];
    
    // Neue Array mit exakt N leeren Items erstellen (vorhandene Werte übernehmen)
    const newDates = [];
    for (let i = 0; i < anzahl; i++) {
      newDates.push(existingDates[i] || '');
    }
    
    this.formData.veroeffentlichungsplan.feed_posts = newDates;
    list.innerHTML = this.renderVeroeffentlichungsDaten('feed_posts', newDates);
  }

  // Veröffentlichungsplan Storys synchronisieren (bei Blur von anzahl_storys)
  syncVeroeffentlichungsplanStorys() {
    const anzahlInput = document.getElementById('anzahl_storys');
    if (!anzahlInput) return;
    
    const anzahl = parseInt(anzahlInput.value) || 0;
    const list = document.getElementById('story-dates-list');
    if (!list) return;
    
    // Initialisiere veroeffentlichungsplan falls nicht vorhanden
    if (!this.formData.veroeffentlichungsplan) {
      this.formData.veroeffentlichungsplan = {};
    }
    
    // Bestehende Daten sammeln (falls vorhanden)
    const existingDates = this.formData.veroeffentlichungsplan.storys || [];
    
    // Neue Array mit exakt N leeren Items erstellen (vorhandene Werte übernehmen)
    const newDates = [];
    for (let i = 0; i < anzahl; i++) {
      newDates.push(existingDates[i] || '');
    }
    
    this.formData.veroeffentlichungsplan.storys = newDates;
    list.innerHTML = this.renderVeroeffentlichungsDaten('storys', newDates);
  }

  // Adress-Vorschau Events und Kaskaden-Logik
  bindAddressPreviewEvents() {
    const kundeSelect = document.getElementById('kunde_unternehmen_id');
    console.log('🔗 VERTRAG: bindAddressPreviewEvents - kundeSelect gefunden:', !!kundeSelect);

    // Kunde ändert sich → Kampagnen filtern und Searchable Select neu erstellen
    if (kundeSelect) {
      kundeSelect.addEventListener('change', async (e) => {
        console.log('🔄 VERTRAG: Kunde change Event ausgelöst');
        console.log('🔄 VERTRAG: _isInitializing:', this._isInitializing);
        
        // Ignoriere Events während der Initialisierung
        if (this._isInitializing) {
          console.log('⏭️ VERTRAG: Event ignoriert wegen _isInitializing');
          return;
        }
        
        const id = e.target.value;
        console.log('🔄 VERTRAG: Kunde ausgewählt mit ID:', id);
        this.formData.kunde_unternehmen_id = id;
        
        // Adress-Vorschau
        const kunde = this.unternehmen.find(u => u.id === id);
        const preview = document.getElementById('kunde-adresse');
        if (preview && kunde) {
          preview.innerHTML = `
            <small class="address-text">
              ${kunde.rechnungsadresse_strasse || ''} ${kunde.rechnungsadresse_hausnummer || ''}<br>
              ${kunde.rechnungsadresse_plz || ''} ${kunde.rechnungsadresse_stadt || ''}
            </small>
          `;
        } else if (preview) {
          preview.innerHTML = '';
        }

        // Kampagnen filtern
        this.updateFilteredKampagnen();
        
        // PO zurücksetzen (wird über Kampagne-Auswahl neu gesetzt)
        this.formData.kunde_po_nummer = null;
        
        // Kampagne zurücksetzen
        this.formData.kampagne_id = null;
        this.formData.creator_id = null;
        this.filteredCreators = [];
        
        // Kampagne Searchable Select neu erstellen
        this.rebuildKampagneSelect(id);
        
        // Creator Searchable Select zurücksetzen
        this.rebuildCreatorSelect(false);
        
        // Vertragsname automatisch generieren
        this.generateVertragName();
      });
    }
  }

  // Kampagne Searchable Select erstellen/aktualisieren
  rebuildKampagneSelect(kundeId) {
    console.log('🔧 VERTRAG: rebuildKampagneSelect aufgerufen mit kundeId:', kundeId);
    console.log('🔧 VERTRAG: filteredKampagnen:', this.filteredKampagnen.length, 'Stück');
    
    const container = document.querySelector('.form-field:has(#kampagne_id), .form-field label[for="kampagne_id"]')?.closest('.form-field');
    if (!container) {
      console.warn('⚠️ VERTRAG: Kampagne-Container nicht gefunden!');
      return;
    }

    // Altes Searchable Select entfernen
    const oldSearchable = container.querySelector('.searchable-select-container');
    if (oldSearchable) oldSearchable.remove();
    
    // Altes Select wieder sichtbar machen oder neues erstellen
    let kampagneSelect = container.querySelector('#kampagne_id');
    if (!kampagneSelect) {
      kampagneSelect = document.createElement('select');
      kampagneSelect.id = 'kampagne_id';
      kampagneSelect.name = 'kampagne_id';
      kampagneSelect.required = true;
      container.appendChild(kampagneSelect);
    }
    kampagneSelect.style.display = '';
    kampagneSelect.disabled = false; // Wichtig: disabled entfernen!
    kampagneSelect.removeAttribute('disabled'); // Sicherheitshalber auch das Attribut

    const options = this.filteredKampagnen.map(k => ({ value: k.id, label: KampagneUtils.getDisplayName(k) }));
    console.log('🔧 VERTRAG: Kampagne-Optionen erstellt:', options.length, 'Stück');
    
    if (kundeId && window.formSystem?.createSearchableSelect) {
      window.formSystem.createSearchableSelect(kampagneSelect, options, {
        name: 'kampagne_id',
        placeholder: 'Kampagne suchen...',
        value: null
      });
      console.log('✅ VERTRAG: Searchable Select für Kampagne erstellt');
      
      // Event-Handler für Kampagne-Änderung
      kampagneSelect.addEventListener('change', async (e) => {
        const id = e.target.value;
        this.formData.kampagne_id = id;
        this.formData.creator_id = null;
        
        await this.loadPoFromKampagne(id);
        await this.updateFilteredCreators();
        this.rebuildCreatorSelect(!!id);
        
        // Vertragsname automatisch generieren
        this.generateVertragName();
      });
    } else {
      // Fallback ohne Searchable Select
      kampagneSelect.disabled = !kundeId;
      kampagneSelect.innerHTML = `
        <option value="">${kundeId ? 'Kampagne auswählen...' : 'Bitte zuerst Kunde wählen...'}</option>
        ${this.filteredKampagnen.map(k => `<option value="${k.id}">${KampagneUtils.getDisplayName(k)}</option>`).join('')}
      `;
    }
  }

  // Creator Searchable Select erstellen/aktualisieren
  rebuildCreatorSelect(enabled) {
    const container = document.querySelector('.form-field:has(#creator_id), .form-field label[for="creator_id"]')?.closest('.form-field');
    if (!container) return;

    // Altes Searchable Select entfernen
    const oldSearchable = container.querySelector('.searchable-select-container');
    if (oldSearchable) oldSearchable.remove();
    
    // Altes Select wieder sichtbar machen oder neues erstellen
    let creatorSelect = container.querySelector('#creator_id');
    if (!creatorSelect) {
      creatorSelect = document.createElement('select');
      creatorSelect.id = 'creator_id';
      creatorSelect.name = 'creator_id';
      // Creator ist optional, daher kein required
      container.appendChild(creatorSelect);
    }
    creatorSelect.style.display = '';

    // Adress-Vorschau zurücksetzen
    const creatorPreview = document.getElementById('creator-adresse');
    if (creatorPreview) creatorPreview.innerHTML = '';

    const options = this.filteredCreators.map(c => ({ value: c.id, label: `${c.vorname} ${c.nachname}` }));
    
    if (enabled && window.formSystem?.createSearchableSelect) {
      if (this.filteredCreators.length === 0) {
        creatorSelect.disabled = true;
        creatorSelect.innerHTML = '<option value="">Keine Creator für diese Kampagne</option>';
        return;
      }
      
      // Wichtig: disabled entfernen bevor Searchable Select erstellt wird!
      creatorSelect.disabled = false;
      creatorSelect.removeAttribute('disabled');
      
      window.formSystem.createSearchableSelect(creatorSelect, options, {
        name: 'creator_id',
        placeholder: 'Creator suchen...',
        value: null
      });
      
      // Event-Handler für Creator-Änderung
      creatorSelect.addEventListener('change', (e) => {
        const id = e.target.value;
        this.formData.creator_id = id;
        
        const creator = this.creators.find(c => c.id === id);
        const preview = document.getElementById('creator-adresse');
        if (preview && creator) {
          // Prüfen ob Creator eine gültige Adresse hat
          if (this.hasValidCreatorAddress(creator)) {
            this.creatorAddressMissing = false;
            preview.innerHTML = `
              <small class="address-text">
                ${creator.lieferadresse_strasse || ''} ${creator.lieferadresse_hausnummer || ''}<br>
                ${creator.lieferadresse_plz || ''} ${creator.lieferadresse_stadt || ''}<br>
                ${creator.lieferadresse_land || 'Deutschland'}
              </small>
            `;
          } else {
            // Keine gültige Adresse - Warnung mit Link zum Creator-Profil
            this.creatorAddressMissing = true;
            preview.innerHTML = `
              <div class="address-warning" style="color: #dc3545; background: #fff3f3; padding: 8px 12px; border-radius: 4px; border: 1px solid #dc3545; margin-top: 8px;">
                <span style="margin-right: 6px;">⚠️</span>
                <span>Keine Adresse hinterlegt! Vertragserstellung nicht möglich.</span><br>
                <a href="/creator/${creator.id}" onclick="event.preventDefault(); window.navigateTo('/creator/${creator.id}')" style="color: #0066cc; text-decoration: underline; margin-top: 4px; display: inline-block;">
                  Zum Creator-Profil →
                </a>
              </div>
            `;
          }
          // Social-Media-Profile aus Creator-Profil übernehmen
          this._applyCreatorProfiles(creator);
        } else if (preview) {
          this.creatorAddressMissing = false;
          preview.innerHTML = '';
          // Profile zurücksetzen wenn kein Creator
          this.formData.influencer_profile = [];
        }
        
        // Vertragsname automatisch generieren
        this.generateVertragName();
      });
    } else {
      // Fallback ohne Searchable Select
      creatorSelect.disabled = true;
      creatorSelect.innerHTML = '<option value="">Bitte zuerst Kampagne wählen...</option>';
    }
  }

  // Searchable Selects initialisieren
  initSearchableSelects() {
    // Flag setzen um Change-Events während der Initialisierung zu ignorieren
    this._isInitializing = true;
    
    const kundeSelect = document.getElementById('kunde_unternehmen_id');

    // Kunde als Searchable Select
    if (kundeSelect && window.formSystem?.createSearchableSelect) {
      const options = this.unternehmen.map(u => ({ value: u.id, label: u.firmenname }));
      const selectedKunde = this.formData.kunde_unternehmen_id;
      
      window.formSystem.createSearchableSelect(kundeSelect, options, {
        name: 'kunde_unternehmen_id',
        placeholder: 'Unternehmen suchen...',
        value: selectedKunde
      });
      
      // Nach Erstellung des Searchable Selects: Wert manuell setzen und Adresse anzeigen
      if (selectedKunde) {
        this.setSearchableSelectValue('kunde_unternehmen_id', selectedKunde, options);
        
        // Adress-Vorschau für geladenen Kunden
        const kunde = this.unternehmen.find(u => u.id === selectedKunde);
        const preview = document.getElementById('kunde-adresse');
        if (preview && kunde) {
          preview.innerHTML = `
            <small class="address-text">
              ${kunde.rechnungsadresse_strasse || ''} ${kunde.rechnungsadresse_hausnummer || ''}<br>
              ${kunde.rechnungsadresse_plz || ''} ${kunde.rechnungsadresse_stadt || ''}
            </small>
          `;
        }
      }
    }

    // Wenn Draft geladen: Kampagne und Creator Searchable Selects initialisieren
    if (this.formData.kunde_unternehmen_id) {
      this.initKampagneSearchableSelect();
    }
    if (this.formData.kampagne_id) {
      this.initCreatorSearchableSelect();
    }
    
    // Flag zurücksetzen nach kurzer Verzögerung
    setTimeout(() => {
      this._isInitializing = false;
      // Vertragsname automatisch generieren (nach Initialisierung)
      this.generateVertragName();
    }, 100);
  }

  // Kampagne Searchable Select initialisieren (für Draft-Load)
  initKampagneSearchableSelect() {
    const kampagneSelect = document.getElementById('kampagne_id');
    if (!kampagneSelect || !window.formSystem?.createSearchableSelect) return;

    const options = this.filteredKampagnen.map(k => ({ value: k.id, label: KampagneUtils.getDisplayName(k) }));
    const selectedKampagne = this.formData.kampagne_id;
    
    window.formSystem.createSearchableSelect(kampagneSelect, options, {
      name: 'kampagne_id',
      placeholder: 'Kampagne suchen...',
      value: selectedKampagne
    });
    
    if (selectedKampagne) {
      this.setSearchableSelectValue('kampagne_id', selectedKampagne, options);
    }
    
    // Event-Handler für Kampagne-Änderung
    kampagneSelect.addEventListener('change', async (e) => {
      // Ignoriere Events während der Initialisierung
      if (this._isInitializing) return;
      
      const id = e.target.value;
      this.formData.kampagne_id = id;
      this.formData.creator_id = null;
      
      await this.loadPoFromKampagne(id);
      await this.updateFilteredCreators();
      this.rebuildCreatorSelect(!!id);
      
      // Vertragsname automatisch generieren
      this.generateVertragName();
    });
  }

  // Creator Searchable Select initialisieren (für Draft-Load)
  initCreatorSearchableSelect() {
    const creatorSelect = document.getElementById('creator_id');
    if (!creatorSelect || !window.formSystem?.createSearchableSelect) return;

    const options = this.filteredCreators.map(c => ({ value: c.id, label: `${c.vorname} ${c.nachname}` }));
    const selectedCreator = this.formData.creator_id;
    
    if (this.filteredCreators.length === 0) {
      creatorSelect.disabled = true;
      creatorSelect.innerHTML = '<option value="">Keine Creator für diese Kampagne</option>';
      return;
    }
    
    window.formSystem.createSearchableSelect(creatorSelect, options, {
      name: 'creator_id',
      placeholder: 'Creator suchen...',
      value: selectedCreator
    });
    
    if (selectedCreator) {
      this.setSearchableSelectValue('creator_id', selectedCreator, options);
      
      // Adress-Vorschau für geladenen Creator
      const creator = this.creators.find(c => c.id === selectedCreator);
      const preview = document.getElementById('creator-adresse');
      if (preview && creator) {
        // Prüfen ob Creator eine gültige Adresse hat
        if (this.hasValidCreatorAddress(creator)) {
          this.creatorAddressMissing = false;
          preview.innerHTML = `
            <small class="address-text">
              ${creator.lieferadresse_strasse || ''} ${creator.lieferadresse_hausnummer || ''}<br>
              ${creator.lieferadresse_plz || ''} ${creator.lieferadresse_stadt || ''}<br>
              ${creator.lieferadresse_land || 'Deutschland'}
            </small>
          `;
        } else {
          // Keine gültige Adresse - Warnung mit Link zum Creator-Profil
          this.creatorAddressMissing = true;
          preview.innerHTML = `
            <div class="address-warning" style="color: #dc3545; background: #fff3f3; padding: 8px 12px; border-radius: 4px; border: 1px solid #dc3545; margin-top: 8px;">
              <span style="margin-right: 6px;">⚠️</span>
              <span>Keine Adresse hinterlegt! Vertragserstellung nicht möglich.</span><br>
              <a href="/creator/${creator.id}" onclick="event.preventDefault(); window.navigateTo('/creator/${creator.id}')" style="color: #0066cc; text-decoration: underline; margin-top: 4px; display: inline-block;">
                Zum Creator-Profil →
              </a>
            </div>
          `;
        }
      }
    }
    
    // Event-Handler für Creator-Änderung
    creatorSelect.addEventListener('change', (e) => {
      const id = e.target.value;
      this.formData.creator_id = id;
      
      const creator = this.creators.find(c => c.id === id);
      const preview = document.getElementById('creator-adresse');
      if (preview && creator) {
        // Prüfen ob Creator eine gültige Adresse hat
        if (this.hasValidCreatorAddress(creator)) {
          this.creatorAddressMissing = false;
          preview.innerHTML = `
            <small class="address-text">
              ${creator.lieferadresse_strasse || ''} ${creator.lieferadresse_hausnummer || ''}<br>
              ${creator.lieferadresse_plz || ''} ${creator.lieferadresse_stadt || ''}<br>
              ${creator.lieferadresse_land || 'Deutschland'}
            </small>
          `;
        } else {
          // Keine gültige Adresse - Warnung mit Link zum Creator-Profil
          this.creatorAddressMissing = true;
          preview.innerHTML = `
            <div class="address-warning" style="color: #dc3545; background: #fff3f3; padding: 8px 12px; border-radius: 4px; border: 1px solid #dc3545; margin-top: 8px;">
              <span style="margin-right: 6px;">⚠️</span>
              <span>Keine Adresse hinterlegt! Vertragserstellung nicht möglich.</span><br>
              <a href="/creator/${creator.id}" onclick="event.preventDefault(); window.navigateTo('/creator/${creator.id}')" style="color: #0066cc; text-decoration: underline; margin-top: 4px; display: inline-block;">
                Zum Creator-Profil →
              </a>
            </div>
          `;
        }
        // Social-Media-Profile aus Creator-Profil übernehmen
        this._applyCreatorProfiles(creator);
      } else if (preview) {
        this.creatorAddressMissing = false;
        preview.innerHTML = '';
        // Profile zurücksetzen wenn kein Creator
        this.formData.influencer_profile = [];
      }
    });
  }

  // Social-Media-Profile aus Creator-Profil in formData übernehmen
  _applyCreatorProfiles(creator) {
    if (!creator) return;
    const profiles = [];
    if (creator.instagram) {
      const handle = this._extractHandle(creator.instagram);
      profiles.push(`Instagram: @${handle}`);
    }
    if (creator.tiktok) {
      const handle = this._extractHandle(creator.tiktok);
      profiles.push(`TikTok: @${handle}`);
    }
    this.formData.influencer_profile = profiles;
  }

  // Handle aus URL oder String extrahieren
  // "https://www.instagram.com/majercars/" → "majercars"
  // "https://www.tiktok.com/@majer.cars" → "majer.cars"
  // "@majercars" → "majercars"
  // "majercars" → "majercars"
  _extractHandle(value) {
    if (!value) return '';
    let handle = value.trim();
    // URL → letzten Pfad-Teil nehmen
    if (handle.includes('.com/')) {
      handle = handle.split('.com/').pop();
    }
    // Trailing Slash entfernen
    handle = handle.replace(/\/+$/, '');
    // Führendes @ entfernen (wird beim Zusammenbauen wieder hinzugefügt)
    handle = handle.replace(/^@/, '');
    return handle;
  }

  // Hilfsfunktion: Wert in Searchable Select setzen (ohne Change-Event zu triggern!)
  setSearchableSelectValue(selectId, value, options) {
    const select = document.getElementById(selectId);
    if (!select) {
      console.warn(`⚠️ Select ${selectId} nicht gefunden`);
      return;
    }
    
    // Original-Select Wert setzen
    select.value = value;
    
    // Label finden
    const option = options.find(o => o.value === value);
    const label = option?.label || '';
    
    // Searchable Select Input finden
    const formField = select.closest('.form-field');
    const container = formField?.querySelector('.searchable-select-container');
    const input = container?.querySelector('.searchable-select-input');
    
    if (input) {
      input.value = label;
    }
    
    // KEIN dispatchEvent - Adress-Vorschauen werden separat gesetzt
  }

  // Profil-Strings ("Plattform @handle") in Handle-Felder parsen
  _parseProfileHandles(profiles) {
    const handles = {};
    const platformMap = {
      'instagram': 'handle_instagram',
      'tiktok': 'handle_tiktok',
      'youtube': 'handle_youtube',
      'sonstige': 'handle_sonstige'
    };
    (profiles || []).forEach(p => {
      const lower = (p || '').toLowerCase();
      for (const [key, field] of Object.entries(platformMap)) {
        if (lower.startsWith(key)) {
          handles[field] = p.substring(key.length).trim();
          break;
        }
      }
    });
    return handles;
  }

  // Prüft ob ein Creator eine gültige Adresse hat
  hasValidCreatorAddress(creator) {
    if (!creator) return false;
    // Mindestens Straße, PLZ und Stadt müssen vorhanden sein
    const hasStrasse = creator.lieferadresse_strasse && creator.lieferadresse_strasse.trim() !== '';
    const hasPlz = creator.lieferadresse_plz && creator.lieferadresse_plz.trim() !== '';
    const hasStadt = creator.lieferadresse_stadt && creator.lieferadresse_stadt.trim() !== '';
    return hasStrasse && hasPlz && hasStadt;
  }

  // Aktuellen Schritt validieren
  validateCurrentStep() {
    const form = document.getElementById('vertrag-form');
    if (!form) return true;

    // Prüfe required Felder im aktuellen Step
    const requiredFields = form.querySelectorAll('[required]');
    for (const field of requiredFields) {
      if (!field.value) {
        field.focus();
        window.toastSystem?.show('Bitte füllen Sie alle Pflichtfelder aus.', 'warning');
        return false;
      }
    }

    return true;
  }

  // Daten des aktuellen Schritts speichern
  saveCurrentStepData() {
    const form = document.getElementById('vertrag-form');
    if (!form) {
      console.log('⚠️ Kein Formular gefunden für saveCurrentStepData');
      return;
    }

    const formData = new FormData(form);
    
    // Debug: Alle FormData-Einträge loggen
    console.log('📋 FormData Einträge:', Array.from(formData.entries()));
    
    // Array-Felder die speziell behandelt werden müssen
    const arrayFields = ['medien', 'plattformen', 'anpassungen', 'videograf_lieferumfang', 'videograf_nutzungsart'];
    
    // Normale Felder (Array-Felder werden separat gesammelt)
    for (const [key, value] of formData.entries()) {
      if (arrayFields.includes(key)) {
        // Array-Felder überspringen - werden unten autoritativ gesammelt
        continue;
      } else if (value === 'true') {
        this.formData[key] = true;
      } else if (value === 'false') {
        this.formData[key] = false;
      } else {
        this.formData[key] = value;
      }
    }

    // Checkboxen die nicht gecheckt sind (außer Array-Felder)
    const checkboxes = form.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
      if (!cb.checked && !arrayFields.includes(cb.name)) {
        this.formData[cb.name] = false;
      }
    });

    // Array-Felder: Nur neu sammeln wenn die Checkboxen im aktuellen Step vorhanden sind
    // Ansonsten vorherige Werte beibehalten
    arrayFields.forEach(fieldName => {
      const checkboxesForField = form.querySelectorAll(`input[name="${fieldName}"]`);
      if (checkboxesForField.length > 0) {
        this.formData[fieldName] = [];
        checkboxesForField.forEach(cb => {
          if (cb.checked) {
            this.formData[fieldName].push(cb.value);
          }
        });
      }
      // Wenn keine Checkboxen im DOM: vorherige Werte bleiben erhalten
    });

    // Veröffentlichungsplan: Daten aus Date-Inputs sammeln
    const videoDates = form.querySelectorAll('input[name^="videos_date_"]');
    const feedPostDates = form.querySelectorAll('input[name^="feed_posts_date_"]');
    const storyDates = form.querySelectorAll('input[name^="storys_date_"]');
    
    if (videoDates.length > 0 || feedPostDates.length > 0 || storyDates.length > 0) {
      if (!this.formData.veroeffentlichungsplan) {
        this.formData.veroeffentlichungsplan = {};
      }
      
      if (videoDates.length > 0) {
        this.formData.veroeffentlichungsplan.videos = Array.from(videoDates).map(input => input.value);
      }
      if (feedPostDates.length > 0) {
        this.formData.veroeffentlichungsplan.feed_posts = Array.from(feedPostDates).map(input => input.value);
      }
      if (storyDates.length > 0) {
        this.formData.veroeffentlichungsplan.storys = Array.from(storyDates).map(input => input.value);
      }
    }

    // influencer_profile wird jetzt automatisch aus dem Creator-Profil übernommen (via _applyCreatorProfiles)

    // Videograf-Produktionsplan: Drehtage & Orte sammeln
    const produktionsplanRows = form.querySelectorAll('.produktionsplan-row');
    if (produktionsplanRows.length > 0) {
      this.formData.videograf_produktionsplan = [];
      produktionsplanRows.forEach((row, index) => {
        const datumInput = form.querySelector(`#drehtag_datum_${index}`);
        const ortInput = form.querySelector(`#drehtag_ort_${index}`);
        
        if (datumInput && ortInput) {
          this.formData.videograf_produktionsplan.push({
            datum: datumInput.value || '',
            ort: ortInput.value || ''
          });
        }
      });
    }
    
    // Typ aus selectedTyp sicherstellen (falls nicht im Formular)
    if (this.selectedTyp && !this.formData.typ) {
      this.formData.typ = this.selectedTyp;
    }
    
    console.log('💾 Gesammelte formData:', this.formData);
  }

  // Formular absenden (Erstellen oder Draft finalisieren)
  async handleSubmit(e, startNewAfter = false) {
    if (e) e.preventDefault();

    if (!this.validateCurrentStep()) return;
    this.saveCurrentStepData();

    // Prüfen ob Creator ausgewählt ist und keine gültige Adresse hat
    if (this.formData.creator_id) {
      const creator = this.creators.find(c => c.id === this.formData.creator_id);
      if (creator && !this.hasValidCreatorAddress(creator)) {
        window.toastSystem?.show('Der ausgewählte Creator hat keine gültige Adresse hinterlegt. Bitte zuerst Adresse im Creator-Profil ergänzen.', 'error');
        return;
      }
    }

    const submitBtn = document.getElementById('btn-submit');
    const submitAndNewBtn = document.getElementById('btn-submit-and-new');
    const isEdit = !!this.editId;
    
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = isEdit ? 'Wird finalisiert...' : 'Wird erstellt...';
    }
    if (submitAndNewBtn) {
      submitAndNewBtn.disabled = true;
    }

    try {
      const data = this.prepareDataForDB();
      data.is_draft = false; // Kein Draft mehr, finalisiert

      console.log('📤 Vertragsdaten:', data);

      let vertrag;

      if (this.editId) {
        // Update bestehenden Draft -> finalisieren
        const { data: updated, error } = await window.supabase
          .from('vertraege')
          .update(data)
          .eq('id', this.editId)
          .select()
          .single();

        if (error) throw error;
        vertrag = updated;
        console.log('✅ Draft finalisiert:', vertrag);
      } else {
        // Neuen Vertrag erstellen
        const { data: created, error } = await window.supabase
          .from('vertraege')
          .insert([data])
          .select()
          .single();

        if (error) throw error;
        vertrag = created;
        console.log('✅ Vertrag erstellt:', vertrag);
      }

      // PDF generieren
      await this.generatePDF(vertrag);

      window.toastSystem?.show(
        isEdit ? 'Vertrag finalisiert!' : 'Vertrag erfolgreich erstellt!', 
        'success'
      );
      
      if (startNewAfter) {
        // Neuen Vertrag mit gleichen Werten starten
        this.editId = null; // Wichtig: Neue ID für neuen Vertrag
        this.currentStep = 2;
        // Name wird automatisch neu generiert beim Render
        window.toastSystem?.show('Neuer Vertrag mit gleichen Werten gestartet', 'info');
        this.render();
      } else {
        // Zur Liste navigieren
        setTimeout(() => {
          window.navigateTo('/vertraege');
        }, 500);
      }

    } catch (error) {
      console.error('❌ Fehler beim Erstellen:', error);
      window.toastSystem?.show(`Fehler: ${error.message}`, 'error');
      
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = isEdit ? 'Vertrag finalisieren & PDF generieren' : 'Vertrag erstellen & PDF generieren';
      }
      if (submitAndNewBtn) {
        submitAndNewBtn.disabled = false;
      }
    }
  }

  // PDF generieren mit jsPDF
  async generatePDF(vertrag) {
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
      doc.text(`${creator?.lieferadresse_strasse || ''} ${creator?.lieferadresse_hausnummer || ''}`, 105, y, { align: 'center' });
      y += 5;
      doc.text(`${creator?.lieferadresse_plz || ''} ${creator?.lieferadresse_stadt || ''}`, 105, y, { align: 'center' });
      y += 5;
      doc.text(`${creator?.lieferadresse_land || 'Deutschland'}`, 105, y, { align: 'center' });

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
        doc.text(`Adresse: ${vertrag.influencer_agentur_adresse || '-'}`, 105, y, { align: 'center' });
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
      doc.text(`Fixvergütung: ${vertrag.verguetung_netto || 0} € netto`, 14, y);
      y += 5;
      doc.text('Die Vergütung versteht sich zzgl. gesetzlicher Umsatzsteuer, sofern diese anfällt.', 14, y);
      y += 8;
      // Zusatzkosten als Checkboxen
      drawCheckbox(14, y, vertrag.zusatzkosten === true, 'Zusatzkosten vereinbart');
      y += 5;
      drawCheckbox(14, y, !vertrag.zusatzkosten, 'Keine Zusatzkosten');
      if (vertrag.zusatzkosten && vertrag.zusatzkosten_betrag) {
        y += 6;
        doc.text(`Bei Zusatzkosten: ${vertrag.zusatzkosten_betrag} € netto`, 14, y);
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
  }

  // ============================================
  // INFLUENCER-KOOPERATIONSVERTRAG PDF
  // ============================================
  async generateInfluencerPDF(vertrag, lang = this.getContractLanguage(vertrag)) {
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

      // Helper: Datum formatieren
      const formatDate = (d) => this.formatContractDate(d, lang);

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
        doc.text(`Adresse: ${vertrag.influencer_agentur_adresse || '-'}`, 105, y, { align: 'center' });
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
      doc.text(`${creator?.lieferadresse_strasse || ''} ${creator?.lieferadresse_hausnummer || ''}`, 105, y, { align: 'center' });
      y += 5;
      doc.text(`${creator?.lieferadresse_plz || ''} ${creator?.lieferadresse_stadt || ''}`, 105, y, { align: 'center' });
      y += 5;
      doc.text(`${vertrag.influencer_land || 'Deutschland'}`, 105, y, { align: 'center' });
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
      doc.text(`Fixvergütung: ${vertrag.verguetung_netto || 0} € netto zzgl. USt.`, 14, y);
      y += 6;
      drawCheckbox(14, y, vertrag.zusatzkosten, `Zusatzkosten vereinbart: ${vertrag.zusatzkosten_betrag || '-'} € netto`);
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
  }

  // ============================================
  // VIDEOGRAFEN-PRODUKTIONSVERTRAG PDF
  // ============================================
  async generateVideografPDF(vertrag, lang = this.getContractLanguage(vertrag)) {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      this.localizeDocText(doc, lang);

      // Font auf Helvetica setzen
      doc.setFont('helvetica');

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

      // Helper: Produktionsart lesbar machen
      const produktionsartLabels = {
        'briefing': 'Produktion nach Briefing',
        'skript_shotlist': 'Produktion nach Skript / Shotlist',
        'eigenstaendig': 'Eigenständige Umsetzung nach Zielvorgabe'
      };

      // Helper: Lieferumfang lesbar machen
      const lieferumfangLabels = {
        'fertig_geschnitten': 'Fertig geschnittenes Video',
        'farbkorrektur': 'Farbkorrektur / Grading enthalten',
        'sounddesign': 'Sounddesign enthalten',
        'rohmaterial': 'Rohmaterial (alle Clips)',
        'projektdateien': 'Projektdateien (z.B. Premiere / Final Cut)'
      };

      // Helper: Nutzungsart lesbar machen
      const nutzungsartLabels = {
        'organisch': 'Organische Nutzung',
        'paid_ads': 'Paid Ads',
        'alle_medien': 'Alle Medien (Social Media, Website, OTV, Print)'
      };

      // Helper: Zahlungsziel lesbar machen
      const zahlungszielLabels = {
        '14_tage': '14 Tage',
        '30_tage': '30 Tage',
        '45_tage': '45 Tage'
      };

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

      // Helper für Textumbruch
      const addWrappedText = (text, x, y, maxWidth) => {
        const localizedText = this.localizeContractText(text, lang);
        const lines = doc.splitTextToSize(localizedText, maxWidth);
        lines.forEach(line => {
          if (y > MAX_CONTENT_Y) {
            addFooter();
            doc.addPage();
            y = 20;
          }
          doc.text(line, x, y);
          y += 5;
        });
        return y;
      };

      // Seitenzahlen Helper
      const addPageNumber = () => {
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.text(`Seite ${i} von ${pageCount}`, 105, 290, { align: 'center' });
          doc.setTextColor(0);
        }
      };

      // Logo oben zentriert
      doc.addImage(logoBase64, 'PNG', 93.6, 10, 22.75, 12.6);

      // Titel (Logo endet bei y=28, daher Titel ab y=36)
      let y = 36;

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('VIDEOGRAFEN- & FOTOGRAFEN-PRODUKTIONSVERTRAG', 105, y, { align: 'center' });
      doc.setFont('helvetica', 'normal');

      // Agenturdaten
      y += 12;
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

      // Kundendaten (untereinander formatiert)
      y += 12;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Kundendaten', 105, y, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      doc.text(`Firmenname: ${kunde?.firmenname || '-'}`, 105, y, { align: 'center' });
      y += 5;
      doc.text(`Rechtsform: ${vertrag.kunde_rechtsform || '-'}`, 105, y, { align: 'center' });
      y += 5;
      doc.text(`${kunde?.rechnungsadresse_strasse || ''} ${kunde?.rechnungsadresse_hausnummer || ''}`, 105, y, { align: 'center' });
      y += 5;
      doc.text(`${kunde?.rechnungsadresse_plz || ''} ${kunde?.rechnungsadresse_stadt || ''}`, 105, y, { align: 'center' });

      // Auftragnehmer (untereinander formatiert)
      y += 12;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Auftragnehmer (Videograf / Fotograf)', 105, y, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      doc.text(`Name / Firma: ${creator?.vorname || ''} ${creator?.nachname || ''}`, 105, y, { align: 'center' });
      y += 5;
      doc.text(`${creator?.lieferadresse_strasse || ''} ${creator?.lieferadresse_hausnummer || ''}`, 105, y, { align: 'center' });
      y += 5;
      doc.text(`${creator?.lieferadresse_plz || ''} ${creator?.lieferadresse_stadt || ''}`, 105, y, { align: 'center' });
      y += 5;
      doc.text(`${vertrag.influencer_land || 'Deutschland'}`, 105, y, { align: 'center' });
      y += 5;
      doc.text(`Steuer-ID / USt-ID: ${vertrag.influencer_steuer_id || '-'}`, 105, y, { align: 'center' });

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
      y = addWrappedText('Der Auftragnehmer verpflichtet sich zur professionellen Erstellung von Foto- und/oder Videomaterial zu Marketing- und Kommunikationszwecken des Auftraggebers bzw. eines von der LikeGroup GmbH betreuten Kunden. Es handelt sich um einen einmaligen Produktionsauftrag.', 14, y, 180);

      // §2 Leistungsumfang
      y += 10;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§2 Leistungsumfang', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;

      // 2.1 Art der Leistung
      doc.setFont('helvetica', 'bold');
      doc.text('2.1 Art der Leistung', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      // Alle Optionen als Checkboxen anzeigen
      const contentArtOptions = {
        'video': 'Video',
        'foto': 'Foto',
        'video_foto': 'Video & Foto'
      };
      Object.entries(contentArtOptions).forEach(([key, label]) => {
        drawCheckbox(14, y, vertrag.content_erstellung_art === key, label);
        y += 6;
      });
      y += 2;
      doc.text(`Anzahl Videos: ${vertrag.anzahl_videos || 0}`, 14, y);
      y += 5;
      doc.text(`Anzahl Fotos: ${vertrag.anzahl_fotos || 0}`, 14, y);

      // 2.2 Produktionsart
      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.text('2.2 Produktionsart', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      // Alle Optionen als Checkboxen anzeigen
      Object.entries(produktionsartLabels).forEach(([key, label]) => {
        drawCheckbox(14, y, vertrag.videograf_produktionsart === key, label);
        y += 6;
      });

      // 2.3 Drehtag & Produktionsort
      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.text('2.3 Drehtage & Produktionsorte', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      
      const produktionsplan = vertrag.videograf_produktionsplan || [];
      if (produktionsplan.length > 0) {
        produktionsplan.forEach((item, idx) => {
          const datumFormatted = item.datum
            ? this.formatContractDate(item.datum, lang, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
            : '-';
          doc.text(`• Drehtag ${idx + 1}: ${datumFormatted}`, 14, y);
          y += 5;
          doc.text(`  Ort: ${item.ort || '-'}`, 14, y);
          y += 5;
          if (y > MAX_CONTENT_Y) {
            addFooter();
            doc.addPage();
            y = 20;
          }
        });
      } else {
        doc.text('Keine Drehtage angegeben', 14, y);
        y += 5;
      }
      
      y += 2;
      y = addWrappedText('Der Auftragnehmer verpflichtet sich, zum vereinbarten Zeitpunkt vollständig einsatzbereit zu erscheinen und die Produktion fachgerecht durchzuführen.', 14, y, 180);

      // §3 Output, Abgabe & Versionierung
      y += 10;
      if (y > MAX_CONTENT_Y) {
        addFooter();
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§3 Output, Abgabe & Versionierung', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;

      // 3.1 Lieferumfang
      doc.setFont('helvetica', 'bold');
      doc.text('3.1 Lieferumfang', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      const lieferumfang = vertrag.videograf_lieferumfang || [];
      // Alle Optionen als Checkboxen anzeigen
      Object.entries(lieferumfangLabels).forEach(([key, label]) => {
        drawCheckbox(14, y, lieferumfang.includes(key), label);
        y += 6;
      });

      // 3.2 Abgabe V1
      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('3.2 Abgabe der ersten Version (V1)', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      const v1Deadline = this.formatContractDate(vertrag.videograf_v1_deadline, lang);
      y = addWrappedText(`Die erste inhaltliche Version (Preview / V1) ist spätestens bis: ${v1Deadline} digital zur Verfügung zu stellen.`, 14, y, 180);

      // 3.3 Korrekturschleifen
      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('3.3 Korrekturschleifen', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      drawCheckbox(14, y, true, `${vertrag.korrekturschleifen || 1} Korrekturschleife(n)`);
      y += 6;
      y = addWrappedText('Eine Korrekturschleife umfasst jeweils eine überarbeitete Version nach Feedback.', 14, y, 180);

      // 3.4 Finale Version
      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('3.4 Abgabe der finalen Version', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      y = addWrappedText(`Die finale Version ist spätestens ${vertrag.videograf_finale_werktage || 5} Werktage nach Abschluss der letzten Korrekturschleife bereitzustellen.`, 14, y, 180);

      // §4 Qualitätsanforderungen
      y += 10;
      if (y > MAX_CONTENT_Y) {
        addFooter();
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§4 Qualitätsanforderungen', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      y = addWrappedText('Der Auftragnehmer verpflichtet sich zu professioneller handwerklicher Qualität. Insbesondere muss das Material:', 14, y, 180);
      y += 3;
      const qualitaetsanforderungen = [
        '• korrekt belichtet und scharf sein',
        '• eine saubere Bildkomposition aufweisen',
        '• ruhig und professionell geführt sein',
        '• bei Video über klar verständlichen, sauberen Ton verfügen',
        '• sauber farbkorrigiert bzw. bearbeitet sein',
        '• markenkonform gemäß Briefing umgesetzt sein'
      ];
      qualitaetsanforderungen.forEach(req => {
        doc.text(req, 14, y);
        y += 5;
      });
      y += 3;
      y = addWrappedText('Technisch oder inhaltlich nicht verwertbares Material gilt als nicht vertragsgemäß.', 14, y, 180);

      // §5 Nachbesserung & Neuerstellung
      y += 10;
      if (y > MAX_CONTENT_Y) {
        addFooter();
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§5 Nachbesserung & Neuerstellung', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      
      doc.setFont('helvetica', 'bold');
      doc.text('5.1 Nachbesserung (Korrekturen)', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      y = addWrappedText('Als Nachbesserungen gelten insbesondere: Schnittanpassungen, Farbkorrekturen, Tonanpassungen, Austausch einzelner Szenen, Bildauswahl bei Fotos, kleinere inhaltliche Anpassungen. Diese sind im Rahmen der vereinbarten Korrekturschleifen kostenfrei vorzunehmen.', 14, y, 180);

      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.text('5.2 Neuerstellung (Neudreh)', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      y = addWrappedText('Ein Anspruch auf kostenfreie Neuerstellung (Neudreh) besteht insbesondere bei: erheblichen technischen Mängeln, unbrauchbarem Bild- oder Tonmaterial, grober Abweichung vom Briefing, Missachtung professioneller Standards. Sofern die Mängel nicht durch Nachbesserung behoben werden können, ist der Auftragnehmer verpflichtet, die Leistung neu zu erbringen. Wenn es sich hierbei um ein einmaliges Event gehandelt hat, entfällt die Vergütung.', 14, y, 180);

      // §7 Nutzungsrechte
      y += 10;
      if (y > MAX_CONTENT_Y) {
        addFooter();
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§7 Nutzungsrechte', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      y = addWrappedText('Der Auftragnehmer überträgt dem Auftraggeber ausschließliche, zeitlich und räumlich unbegrenzte Nutzungsrechte an sämtlichen erstellten Inhalten.', 14, y, 180);
      y += 3;
      const nutzungsart = vertrag.videograf_nutzungsart || [];
      // Alle Optionen als Checkboxen anzeigen
      Object.entries(nutzungsartLabels).forEach(([key, label]) => {
        drawCheckbox(14, y, nutzungsart.includes(key), label);
        y += 6;
      });
      y += 3;
      y = addWrappedText('Eine Urheberbenennung ist nicht erforderlich, sofern nicht ausdrücklich vereinbart.', 14, y, 180);

      // §8 Rechte Dritter
      y += 10;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§8 Rechte Dritter', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      y = addWrappedText('Der Auftragnehmer garantiert, dass sämtliche Inhalte frei von Rechten Dritter sind. Er haftet für alle daraus resultierenden Rechtsverletzungen.', 14, y, 180);

      // §9 Vergütung
      y += 10;
      if (y > MAX_CONTENT_Y) {
        addFooter();
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§9 Vergütung', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;

      doc.setFont('helvetica', 'bold');
      doc.text('9.1 Vergütung', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      const verguetung = vertrag.verguetung_netto ? parseFloat(vertrag.verguetung_netto).toFixed(2) : '0.00';
      doc.text(`Fixvergütung: ${verguetung} € netto zzgl. gesetzlicher Umsatzsteuer.`, 14, y);
      y += 6;
      if (vertrag.zusatzkosten) {
        drawCheckbox(14, y, true, 'Zusatzkosten vereinbart');
        y += 6;
        const zusatzkosten = vertrag.zusatzkosten_betrag ? parseFloat(vertrag.zusatzkosten_betrag).toFixed(2) : '0.00';
        doc.text(`Zusatzkosten (z.B. Reisekosten, Requisiten): ${zusatzkosten} € netto`, 14, y);
      } else {
        drawCheckbox(14, y, true, 'Keine Zusatzkosten');
      }

      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.text('9.2 Zahlungsbedingungen', 14, y);
      doc.setFont('helvetica', 'normal');
      y += 6;
      doc.text(`Zahlungsziel: ${zahlungszielLabels[vertrag.zahlungsziel] || '-'}`, 14, y);
      y += 5;
      doc.text(`Skonto: ${(vertrag.skonto === true || vertrag.skonto === 'true') ? 'Ja (3% bei Zahlung innerhalb 7 Tage)' : 'Nein'}`, 14, y);
      y += 5;
      y = addWrappedText('Die Zahlung erfolgt durch die LikeGroup GmbH im Auftrag des Kunden. Die Rechnungsstellung erfolgt nach finaler Abnahme.', 14, y, 180);

      // §10 Verschwiegenheit
      y += 10;
      if (y > MAX_CONTENT_Y) {
        addFooter();
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§10 Verschwiegenheit', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      y = addWrappedText('Der Auftragnehmer verpflichtet sich zur vollständigen Verschwiegenheit über Inhalte, Material und Ergebnisse dieses Auftrags. Eine Eigenverwendung oder Veröffentlichung ist nur mit vorheriger schriftlicher Zustimmung zulässig.', 14, y, 180);

      // §11 Rücktritt
      y += 10;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§11 Rücktritt', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      y = addWrappedText('Erfüllt der Auftragnehmer die vereinbarten Leistungen auch nach Nachbesserung oder Neuerstellung nicht, ist der Auftraggeber berechtigt, vom Vertrag zurückzutreten. Bereits gezahlte Vergütungen können anteilig oder vollständig zurückgefordert werden.', 14, y, 180);

      // §12 Vertragsschluss
      y += 10;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('§12 Vertragsschluss', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      y = addWrappedText('Dieser Vertrag wird mit der Unterschrift des Auftragnehmers wirksam. Eine zusätzliche Unterschrift der LikeGroup GmbH ist nicht erforderlich.', 14, y, 180);

      // §13 Weitere Bestimmungen (nur wenn ausgefüllt)
      if (vertrag.weitere_bestimmungen) {
        y += 10;
        if (y > MAX_CONTENT_Y) {
          addFooter();
          doc.addPage();
          y = 20;
        }
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('§13 Weitere Bestimmungen', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y += 8;
        y = addWrappedText(vertrag.weitere_bestimmungen, 14, y, 180);
      }

      // Unterschrift
      y += 20;
      if (y > MAX_CONTENT_Y) {
        addFooter();
        doc.addPage();
        y = 20;
      }
      doc.text('Ort, Datum: ___________________________', 14, y);
      y += 15;
      doc.text('Auftragnehmer: ___________________________', 14, y);

      // Fußzeile für letzte Seite
      addFooter();

      // PDF speichern
      const pdfBlob = doc.output('blob');
      const filePrefix = lang === 'en' ? 'EN_Contract_Videograf' : 'Vertrag_Videograf';
      const fileName = `${filePrefix}_${vertrag.name || 'Produktion'}_${new Date().toISOString().split('T')[0]}.pdf`;
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

          console.log('✅ Videograf-PDF hochgeladen und URL gespeichert');
        }

        doc.save(fileName);
      }

      console.log('✅ Videograf-PDF generiert');

    } catch (error) {
      console.error('❌ Fehler bei Videograf-PDF-Generierung:', error);
      window.toastSystem?.show('PDF konnte nicht generiert werden', 'warning');
    }
  }

  // Cleanup
  destroy() {
    this.currentStep = 1;
    this.selectedTyp = null;
    this.formData = {};
    this.filteredKampagnen = [];
    this.filteredCreators = [];
    this.isGenerated = false;
    this.editId = null;
    this._filtersInitialized = false;
    this._isRendering = false;
    this._isInitializing = false;
    
    // Progress Container aus main-wrapper entfernen
    const progressContainer = document.getElementById('vertrag-progress-container');
    if (progressContainer) {
      progressContainer.remove();
    }
  }
}

// Exportiere Instanz
export const vertraegeCreate = new VertraegeCreate();
