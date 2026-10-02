// Eigene Buchungen eines Mitarbeiters: Kooperationen mit assignee_id = Mitarbeiter.
// Einkauf und Verkauf sind die Netto-Werte der Kooperation, Marge ist Verkauf minus Einkauf.
// Das Jahr kommt aus created_at der Kooperation.

const cent = (value) => Math.round(value * 100) / 100;

function jahrVon(createdAt) {
  if (!createdAt) return null;
  const jahr = new Date(createdAt).getFullYear();
  return Number.isNaN(jahr) ? null : jahr;
}

/**
 * Summen pro Kalenderjahr, neuestes Jahr zuerst. Kooperationen ohne Datum landen in jahr: null am Ende.
 */
export function summiereBuchungenNachJahr(koops) {
  const proJahr = new Map();

  for (const koop of koops || []) {
    const jahr = jahrVon(koop.created_at);
    const zeile = proJahr.get(jahr) || { jahr, anzahl: 0, einkauf: 0, verkauf: 0, marge: 0 };
    zeile.anzahl += 1;
    zeile.einkauf += Number(koop.einkaufspreis_netto) || 0;
    zeile.verkauf += Number(koop.verkaufspreis_netto) || 0;
    proJahr.set(jahr, zeile);
  }

  return [...proJahr.values()]
    .map((zeile) => ({
      ...zeile,
      einkauf: cent(zeile.einkauf),
      verkauf: cent(zeile.verkauf),
      marge: cent(zeile.verkauf - zeile.einkauf)
    }))
    .sort((a, b) => {
      if (a.jahr === null) return 1;
      if (b.jahr === null) return -1;
      return b.jahr - a.jahr;
    });
}
