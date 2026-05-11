// Hilfsfunktion, die aus Rechnungs-Submit-Daten (IDs) die Pfad-Metadaten
// (Namen) für den Dropbox-Upload auflöst. Damit kann der Server eine
// menschenlesbare Ordnerstruktur bauen.
//
// Liefert ein Objekt:
//   { unternehmen, marke, kampagne, kooperation, rechnungsNr }
//
// Felder die nicht aufgelöst werden konnten, bleiben leer; die Netlify
// Function fängt das ab und fällt auf einen sinnvollen Pfad zurück.

export async function resolveRechnungPathMetadata({
  unternehmenId,
  kampagneId,
  kooperationId,
  rechnungsNr,
}) {
  const result = {
    unternehmen: '',
    marke: '',
    kampagne: '',
    kooperation: '',
    rechnungsNr: rechnungsNr || '',
  };

  if (!window.supabase) return result;

  const tasks = [];

  if (unternehmenId) {
    tasks.push(
      window.supabase
        .from('unternehmen')
        .select('firmenname')
        .eq('id', unternehmenId)
        .single()
        .then(({ data }) => { if (data?.firmenname) result.unternehmen = data.firmenname; })
        .catch(() => {})
    );
  }

  if (kampagneId) {
    tasks.push(
      window.supabase
        .from('kampagne')
        .select('kampagnenname, eigener_name, marke:marke_id(markenname)')
        .eq('id', kampagneId)
        .single()
        .then(({ data }) => {
          if (data) {
            result.kampagne = data.eigener_name || data.kampagnenname || '';
            if (data.marke?.markenname) result.marke = data.marke.markenname;
          }
        })
        .catch(() => {})
    );
  }

  if (kooperationId) {
    tasks.push(
      window.supabase
        .from('kooperationen')
        .select('name')
        .eq('id', kooperationId)
        .single()
        .then(({ data }) => { if (data?.name) result.kooperation = data.name; })
        .catch(() => {})
    );
  }

  await Promise.all(tasks);
  return result;
}
