// Abschluss eines Strategie-Item-Laufs.
// Screenshot- und Transkriptfehler machen die Zeile rot.
// Ein Kundenadaptionsfehler lässt den Lauf auf done und bleibt ein eigener Text.

function verarbeitungAbschluss({
  screenshotError = null,
  transcriptError = null,
  beschreibungFehler = null,
  adaptionFehler = null
} = {}) {
  const scrape = [
    screenshotError ? `Screenshot: ${screenshotError}` : null,
    transcriptError ? `Transkript: ${transcriptError}` : null,
    beschreibungFehler ? `Beschreibung: ${beschreibungFehler}` : null
  ].filter(Boolean);
  const adaption = adaptionFehler ? `Kundenadaption: ${adaptionFehler}` : null;

  if (scrape.length) {
    return {
      verarbeitung_status: 'error',
      verarbeitung_fehler: [...scrape, adaption].filter(Boolean).join(' | ')
    };
  }

  return {
    verarbeitung_status: 'done',
    verarbeitung_fehler: adaption
  };
}

module.exports = { verarbeitungAbschluss };
