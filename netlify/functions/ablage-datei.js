// ablage-datei.js
// Einzelne SharePoint-Datei: loeschen (Papierkorb), Upload verwerfen (Rollback), umbenennen (PATCH),
// verschieben (Bild einem anderen Video zuordnen). Rohmaterial: Unterordner anlegen, Dateien
// zwischen den Ordnern umordnen und in eine Feedbackschleife verschieben (ADR 0070).

const { ablageHandler, AblageFehler } = require('./_shared/ablage/http');
const { createSchreiben } = require('./_shared/ablage/schreiben');

const AKTIONEN = {
  loeschen: 'dateiLoeschen',
  upload_verwerfen: 'uploadVerwerfen',
  umbenennen: 'dateiUmbenennen',
  verschieben: 'dateiVerschieben',
  ordner_anlegen: 'rohOrdnerAnlegen',
  roh_verschieben: 'rohVerschieben',
  roh_umordnen: 'rohUmordnen',
};

exports.handler = ablageHandler('ablage-datei', (ctx) => {
  const methode = AKTIONEN[ctx.body.aktion];
  if (!methode) throw new AblageFehler(400, 'Unbekannte Aktion');
  return createSchreiben(ctx)[methode](ctx);
});
