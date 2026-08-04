/**
 * kskSelbstzahler.js
 *
 * KSK-Selbstzahler: Creator, die die Kuenstlersozialabgabe selbst abfuehren,
 * erhalten einen Aufschlag von KSK_SATZ_PROZENT auf ihr EK-Netto-Honorar.
 * Der Aufschlag wird aus dem KSK-Topf des Auftrags (ksk_value) ins
 * Creator-Budget umgebucht und ist Teil des USt-pflichtigen Entgelts.
 *
 * Bemessungsgrundlage ist ausschliesslich einkaufspreis_netto
 * (ohne Zusatzkosten, ohne den Aufschlag selbst).
 */

export const KSK_SATZ_PROZENT = 4.9;

export function berechneKskBetrag(ekNetto, satz = KSK_SATZ_PROZENT) {
  const netto = parseFloat(ekNetto) || 0;
  if (netto <= 0) return 0;
  return Math.round(netto * (satz / 100) * 100) / 100;
}

/**
 * Summiert die KSK-Betraege aller Selbstzahler-Kooperationen.
 * Wird fuer die Budget-Umbuchung (verfuegbar = creator_budget + Summe)
 * und die KSK-Topf-Anzeige (Topf - Summe) verwendet.
 */
export function summeKskSelbstzahler(kooperationen = []) {
  return (kooperationen || []).reduce((sum, k) => {
    if (!k?.ksk_selbstzahler) return sum;
    return sum + (parseFloat(k.ksk_betrag) || 0);
  }, 0);
}

// Paragraph-13-Alternativtext fuer Selbstzahler-Vertraege (Influencer-PDF).
// DE-Text und EN-Uebersetzung muessen als exaktes Paar in
// ContractTranslations.js registriert bleiben (String-Match).
const KSK_SATZ_ANZEIGE = String(KSK_SATZ_PROZENT).replace('.', ',');

export const KSK_SELBSTZAHLER_VERTRAGSTEXT_DE =
  `Der Auftragnehmer ist für die Abführung etwaiger Abgaben an die Künstlersozialkasse selbst verantwortlich. Die vereinbarte Vergütung enthält hierfür einen Ausgleich in Höhe von ${KSK_SATZ_ANZEIGE} % des Nettohonorars, der auf der Rechnung gesondert ausgewiesen wird.`;

export const KSK_SELBSTZAHLER_VERTRAGSTEXT_EN =
  `The contractor is responsible for paying any levies to the German artists' social fund (Künstlersozialkasse). The agreed compensation includes a surcharge of ${KSK_SATZ_PROZENT} % of the net fee for this purpose, which is listed separately on the invoice.`;
