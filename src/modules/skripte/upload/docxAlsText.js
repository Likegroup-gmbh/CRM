// Word-Teile als Text für Liky, wenn ein Hinweis bestimmt, was übernommen
// wird (ADR 0073). Fett und Kursiv bleiben als **…** und *…* stehen.

// Background-Functions nehmen höchstens 256 KB Body an.
export const DOCX_TEXT_MAX = 100000;

const zelle = (text) => String(text || '').replace(/\n/g, ' / ').replace(/\|/g, '\\|');

export function docxAlsText(teile) {
  const zeilen = [];
  for (const teil of teile || []) {
    if (teil.typ === 'tabelle') {
      for (const reihe of teil.zeilen || []) zeilen.push(`| ${reihe.map(zelle).join(' | ')} |`);
    } else if (teil.typ === 'liste' || teil.typ === 'nummerierung') {
      teil.punkte.forEach((punkt, i) => zeilen.push(teil.typ === 'liste' ? `- ${punkt}` : `${i + 1}. ${punkt}`));
    } else if (teil.typ === 'h1' || teil.typ === 'h2') {
      zeilen.push(`${teil.typ === 'h1' ? '#' : '##'} ${teil.md}`);
    } else if (teil.md) {
      zeilen.push(teil.md);
    }
    zeilen.push('');
  }
  const text = zeilen.join('\n').trim();
  if (text.length > DOCX_TEXT_MAX) {
    throw new Error('Die Word-Datei ist für den Hinweis zu lang. Ohne Hinweis hochladen oder die Datei aufteilen.');
  }
  return text;
}

export function docxBilder(teile) {
  const blobs = [];
  for (const teil of teile || []) {
    if (teil.typ === 'bild') blobs.push(teil.blob);
    for (const bild of teil.bilder || []) blobs.push(bild.blob || bild);
  }
  return blobs.filter(Boolean);
}
