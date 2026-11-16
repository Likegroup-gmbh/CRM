// medienablageRestText.js
// Klartext zum Rest des Umzugs: aus dem technischen Grund einer ablage_umzug-Zeile wird
// Ursache, Erklaerung und der naechste Schritt. Dazu die Gruppierung je Ursache.
// Unbekannte Gruende erscheinen als "Sonstiger Fehler" mit dem Originaltext.

const WEITER = 'Danach hier „Erneut versuchen“.';

// ton: fehler (rot, braucht Handarbeit), warn (gelb, einmal beheben), info (grau, erledigt sich)
// erneut: hilft ein neuer Versuch, sobald die Ursache behoben ist
// befehl: Terminal-Befehl zum Schritt (wird als Code gezeigt)
export const URSACHEN = {
  onedrive_kein_zugriff: {
    titel: 'Kein Zugriff auf alte OneDrive-Links',
    warum: 'Diese Dateien liegen als Link im privaten OneDrive einer Person. Die Medienablage-App darf dort nicht lesen.',
    tun: `Einmal der App Leserecht auf diese OneDrives geben (Anleitung oben im Skript). ${WEITER}`,
    befehl: 'node scripts/medienablage/onedrive-freigeben.mjs --token <Admin-Token>',
    ton: 'warn',
    erneut: true,
  },
  onedrive_weg: {
    titel: 'Alter OneDrive-Link existiert nicht mehr',
    warum: 'Die Datei wurde im OneDrive gelöscht oder der Link zurückgezogen.',
    tun: 'Datei beim Creator neu anfordern und in der Kooperation hochladen, oder den Eintrag dort löschen.',
    ton: 'fehler',
    erneut: false,
  },
  onedrive_ordner: {
    titel: 'Link zeigt auf einen Ordner',
    warum: 'Der gespeicherte OneDrive-Link führt zu einem Ordner statt zu einer einzelnen Datei.',
    tun: 'Die Datei in der Kooperation direkt neu hochladen.',
    ton: 'warn',
    erneut: false,
  },
  dropbox_fehlt: {
    titel: 'Datei nicht mehr in Dropbox',
    warum: 'Unter dem gespeicherten Pfad liegt keine Datei mehr (verschoben, umbenannt oder gelöscht).',
    tun: `In Dropbox nach der Datei suchen. Gefunden: zurück an den Pfad legen. ${WEITER} Nicht gefunden: neu hochladen oder Eintrag löschen.`,
    ton: 'fehler',
    erneut: true,
  },
  ohne_quelle: {
    titel: 'Keine Quelle gespeichert',
    warum: 'Der Eintrag hat weder Dropbox-Pfad noch Link, es gibt nichts zu kopieren.',
    tun: 'Datei in der Kooperation neu hochladen oder den Eintrag löschen.',
    ton: 'warn',
    erneut: false,
  },
  ohne_zuordnung: {
    titel: 'Ohne Zuordnung',
    warum: 'Die Datei gehört zu keiner Kooperation bzw. keinem Unternehmen. SharePoint weiß deshalb nicht, in welchen Ordner sie soll.',
    tun: `Datei in der Kooperation dem richtigen Video zuordnen oder löschen. ${WEITER}`,
    ton: 'fehler',
    erneut: true,
  },
  groesse_falsch: {
    titel: 'Größe nach dem Kopieren falsch',
    warum: 'Die Kopie in SharePoint war nicht gleich groß wie das Original und wurde verworfen.',
    tun: 'Nichts. Der Umzug versucht es automatisch noch einmal.',
    ton: 'info',
    erneut: false,
  },
  speicher_lesen: {
    titel: 'Alte Datei nicht lesbar',
    warum: 'Die Datei im alten Supabase-Speicher ließ sich nicht herunterladen (meist fehlt sie dort oder der Pfad stimmt nicht).',
    tun: `Vertrag bzw. Beleg prüfen und bei Bedarf neu hochladen. ${WEITER}`,
    ton: 'fehler',
    erneut: true,
  },
  pfad_name: {
    titel: 'Dropbox lehnt den Dateipfad ab',
    warum: 'Dropbox meldet, dass Pfad und Dateiname nicht zusammenpassen, meist wegen Sonderzeichen im Namen.',
    tun: 'Dokument in der Buchhaltung bzw. Kooperation neu hochladen.',
    ton: 'fehler',
    erneut: false,
  },
  leer: {
    titel: 'Datei ist leer',
    warum: 'Die Quelle hat 0 Byte, es gibt nichts zu kopieren.',
    tun: 'Datei neu hochladen oder den Eintrag löschen.',
    ton: 'warn',
    erneut: false,
  },
  zu_gross: {
    titel: 'Dokument größer als 200 MB',
    warum: 'Dokumente werden am Stück übertragen, über 200 MB geht das nicht.',
    tun: 'Datei verkleinern und neu hochladen.',
    ton: 'fehler',
    erneut: false,
  },
  item_doppelt: {
    titel: 'Ziel in SharePoint schon belegt',
    warum: 'Dieselbe SharePoint-Datei gehört schon zu einem anderen Eintrag.',
    tun: 'Doppelten Eintrag in der Kooperation löschen.',
    ton: 'warn',
    erneut: false,
  },
};

const ALIAS = {
  dropbox_link_weg: 'dropbox_fehlt',
  ohne_kooperation: 'ohne_zuordnung',
  ohne_unternehmen: 'ohne_zuordnung',
  storage_fehlt: 'speicher_lesen',
};

export const TYP_LABEL = {
  video: 'Video',
  story: 'Story',
  still: 'Bild',
  roh: 'Rohmaterial',
  vertrag: 'Vertrag',
  vertrag_unterschrieben: 'Unterschriebener Vertrag',
  rechnung: 'Rechnung',
  rechnung_alt: 'Rechnung (alt)',
  beleg: 'Beleg',
  auftragsdokument: 'Auftragsdokument',
};

const bekannt = (g) => Object.prototype.hasOwnProperty.call(URSACHEN, g);

export function ursacheSchluessel(grund) {
  const g = String(grund || '').trim();
  if (bekannt(g)) return g;
  if (ALIAS[g]) return ALIAS[g];
  if (/^storage\b/i.test(g)) return 'speicher_lesen';
  if (/name from path does not match/i.test(g)) return 'pfad_name';
  return g || 'unbekannt';
}

/** Text zur Ursache; unbekannte Gruende zeigen den Originaltext. */
export function ursacheInfo(schluessel, grund) {
  if (bekannt(schluessel)) return URSACHEN[schluessel];
  return {
    titel: 'Sonstiger Fehler',
    warum: grund ? `Technischer Grund: ${grund}` : 'Der Umzug hat keinen Grund gemeldet.',
    tun: 'Erneut versuchen. Bleibt der Fehler, den Grund an die Entwicklung weitergeben.',
    ton: 'fehler',
    erneut: true,
  };
}

const TON_RANG = { fehler: 0, warn: 1, info: 2 };

/**
 * Zeilen je Ursache bündeln. -> [{ schluessel, info, anzahl, firmen: [{ id, bereich, anzahl }], zeilen }],
 * größte Gruppe zuerst (bei gleicher Größe rot vor gelb vor grau).
 */
export function restGruppen(zeilen) {
  const je = new Map();
  for (const z of zeilen || []) {
    const schluessel = ursacheSchluessel(z.grund);
    if (!je.has(schluessel)) je.set(schluessel, { schluessel, info: ursacheInfo(schluessel, z.grund), zeilen: [] });
    je.get(schluessel).zeilen.push(z);
  }
  return [...je.values()]
    .map((g) => {
      const firmen = new Map();
      for (const z of g.zeilen) {
        const key = `${z.bereich}:${z.unternehmen_id}`;
        if (!firmen.has(key)) firmen.set(key, { id: z.unternehmen_id, bereich: z.bereich, anzahl: 0 });
        firmen.get(key).anzahl += 1;
      }
      return { ...g, anzahl: g.zeilen.length, firmen: [...firmen.values()].sort((a, b) => b.anzahl - a.anzahl) };
    })
    .sort((a, b) => b.anzahl - a.anzahl || TON_RANG[a.info.ton] - TON_RANG[b.info.ton]);
}
