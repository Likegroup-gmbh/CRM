// jsPDF-Helvetica spricht WinAnsi. Zeichen außerhalb dieser Kodierung
// (Emoji, ZWJ, Variation Selector, kombinierende Reste) werden als rohe
// UTF-16-Bytes gezeichnet: Müllglyphen, gesperrte Wörter, Zeilen ohne Umbruch.

const WINANSI_EXTRA = new Set([
  0x20AC, // €
  0x201A, // ‚
  0x0192, // ƒ
  0x201E, // „
  0x2026, // …
  0x2020, // †
  0x2021, // ‡
  0x02C6, // ˆ
  0x2030, // ‰
  0x0160, // Š
  0x2039, // ‹
  0x0152, // Œ
  0x017D, // Ž
  0x2018, // ‘
  0x2019, // ’
  0x201C, // “
  0x201D, // ”
  0x2022, // •
  0x2013, // –
  0x2014, // —
  0x02DC, // ˜
  0x2122, // ™
  0x0161, // š
  0x203A, // ›
  0x0153, // œ
  0x017E, // ž
  0x0178, // Ÿ
]);

function isWinAnsi(codePoint) {
  if (codePoint === 0x09 || codePoint === 0x0A || codePoint === 0x0D) return true;
  if (codePoint >= 0x20 && codePoint <= 0x7E) return true;
  if (codePoint >= 0xA0 && codePoint <= 0xFF) return true;
  return WINANSI_EXTRA.has(codePoint);
}

/** NFC, dann nur WinAnsi. Emoji-Sequenzen fallen weg, Zeilenumbrüche bleiben. */
export function stripNonWinAnsi(value) {
  if (typeof value !== 'string') return value;
  let out = '';
  for (const ch of value.normalize('NFC')) {
    out += isWinAnsi(ch.codePointAt(0)) ? ch : '';
  }
  return out.replace(/[^\S\n]{2,}/g, ' ');
}

/**
 * EHG-Vorlage: typografische Anführungszeichen und Gedankenstriche auf ASCII,
 * danach derselbe WinAnsi-Schnitt. Sonst wirft der Upload.
 */
export function normalizePdfWinAnsi(value) {
  if (Array.isArray(value)) return value.map(normalizePdfWinAnsi);
  if (typeof value !== 'string') return value;
  return stripNonWinAnsi(value
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u00A0\u202F\u2009\u200A]/g, ' '));
}
