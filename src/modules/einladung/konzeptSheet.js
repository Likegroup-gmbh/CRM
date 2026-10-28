// konzeptSheet.js
// Das Creator Concept Sheet (ADR 0059) als Daten: Abschnitte und Felder in PDF-Reihenfolge.
// Das Webformular der Konzept-Einladung (EinladungKonzeptForm) und der Block „Creator-Sheet“
// an der Videoidee lesen dieselbe Liste. Die Feldnamen gleicht Einladung.test.js mit der
// Allowlist der Edge Function (supabase/functions/einladung/felder.ts) ab.

export const KONZEPT_PFLICHT = Object.freeze(['idee', 'hook', 'ablauf']);

export const KONZEPT_FELD = Object.freeze({
  arbeitstitel: { label: 'Arbeitstitel', typ: 'text', platzhalter: 'Optional', max: 200 },
  idee: { label: 'Deine Idee', typ: 'textarea', pflicht: true, platzhalter: 'Was möchtest du machen?' },
  hook: { label: 'Einstieg / Hook', typ: 'textarea', pflicht: true, platzhalter: 'Was sehen oder hören wir zuerst?' },
  ablauf: { label: 'Ablauf', typ: 'textarea', pflicht: true, platzhalter: '3-5 Stichpunkte' },
  marke_integration: { label: 'So kommt die Marke rein', typ: 'textarea', platzhalter: 'Was zeigst, nutzt oder erklärst du konkret?' },
  eigenes_video_url: { label: 'Link zu einem eigenen Video', typ: 'url', platzhalter: 'https://' },
  eigenes_video_relevanz: { label: 'Was daran ist für diese Idee relevant? Zum Beispiel Format oder Schnitt.', typ: 'textarea' },
  referenz_video_url: { label: 'Link zu einem Referenzvideo (auch von einem anderen Account)', typ: 'url', platzhalter: 'https://' },
  referenz_aufgreifen: { label: 'Was möchtest du daraus aufgreifen? Zum Beispiel Einstieg oder Stimmung.', typ: 'textarea' },
  alternative_idee: { label: 'Alternative Idee', typ: 'textarea', platzhalter: 'Eine andere Richtung oder ein überraschenderer Ansatz' }
});

/** Abschnitte in der Reihenfolge des PDFs. `nr` ist die Nummer im PDF, leer bei den Beispielen. */
export const KONZEPT_ABSCHNITTE = Object.freeze([
  {
    id: 'idee',
    nr: '01',
    titel: 'Deine Idee.',
    text: 'Was möchtest du machen? 1-2 Sätze reichen. Einen Arbeitstitel kannst du gern dazuschreiben.',
    felder: ['arbeitstitel', 'idee']
  },
  {
    id: 'hook',
    nr: '02',
    titel: 'Dein Einstieg / Hook.',
    text: 'Was sehen oder hören wir in den ersten Sekunden? Beschreib den Einstieg oder einen möglichen ersten Satz.',
    felder: ['hook']
  },
  {
    id: 'ablauf',
    nr: '03',
    titel: 'Der grobe Ablauf.',
    text: 'Wie geht es weiter und wie endet das Video? 3-5 Stichpunkte reichen. Falls ein CTA vereinbart ist: Wie baust du ihn ein?',
    felder: ['ablauf']
  },
  {
    id: 'marke',
    nr: '04',
    titel: 'So kommt die Marke rein.',
    text: 'Wie baust du die Marke oder das Produkt ein? Was zeigst, nutzt oder erklärst du konkret, damit die vereinbarte Botschaft ankommt?',
    felder: ['marke_integration']
  },
  {
    id: 'beispiele',
    nr: '',
    titel: 'Beispiele & eine weitere Idee.',
    text: 'Optional - nur ausfüllen, wenn du schon etwas Passendes hast.',
    gruppen: [
      { frage: 'Hast du schon ein ähnliches Video umgesetzt?', felder: ['eigenes_video_url', 'eigenes_video_relevanz'] },
      { frage: 'Gibt es ein anderes Video als Inspiration?', felder: ['referenz_video_url', 'referenz_aufgreifen'] },
      { frage: 'Noch eine andere Richtung im Kopf?', felder: ['alternative_idee'], hilfe: '1-3 Sätze reichen.' }
    ]
  }
]);

/** Alle Feldnamen des Sheets (für den Abgleich mit der Edge Function). */
export function konzeptFeldNamen() {
  return Object.keys(KONZEPT_FELD);
}

/**
 * Block „Creator-Sheet“ für das Team: nur gefüllte Felder, in PDF-Reihenfolge.
 * @returns {Array<{ nr: string, titel: string, eintraege: Array<{ label: string, wert: string, link: boolean }> }>}
 */
export function konzeptSheetBloecke(formData) {
  const daten = formData || {};
  const eintrag = (name) => {
    const wert = String(daten[name] ?? '').trim();
    return wert ? { label: KONZEPT_FELD[name].label, wert, link: KONZEPT_FELD[name].typ === 'url' } : null;
  };
  return KONZEPT_ABSCHNITTE.map((a) => {
    const namen = a.felder || a.gruppen.flatMap((g) => g.felder);
    return {
      nr: a.nr,
      titel: a.titel.replace(/\.$/, ''),
      eintraege: namen.map(eintrag).filter(Boolean)
    };
  }).filter((b) => b.eintraege.length > 0);
}
