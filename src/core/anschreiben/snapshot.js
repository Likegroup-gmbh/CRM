// Anschreiben-Snapshot: Empfaenger-Scope, Mailvorlagen und PDF in einem Load.
// Der Drawer malt erst, wenn das Ergebnis steht.

const EMPTY_SCOPE = { creators: [], managements: [], kampagne: null };

const VORLAGE_FIELDS = 'id, name, betreff, body, empfaenger_typ, is_standard, is_shared, created_by, dokument_typ';

async function pullAnsprechpartner(db, table, column, id, byId) {
  if (!id) return 0;
  const { data, error } = await db
    .from(table)
    .select('ansprechpartner:ansprechpartner_id(id, vorname, nachname, email)')
    .eq(column, id);
  if (error) throw error;
  let skipped = 0;
  for (const row of data || []) {
    const ap = row.ansprechpartner;
    if (!ap?.id || byId.has(ap.id)) continue;
    const email = String(ap.email || '').trim();
    if (!email) {
      skipped += 1;
      byId.set(ap.id, null);
      continue;
    }
    byId.set(ap.id, { ...ap, email });
  }
  return skipped;
}

export async function loadAnsprechpartnerRows(db, { unternehmenId, markeId }) {
  const byId = new Map();
  const skippedUnternehmen = await pullAnsprechpartner(
    db, 'ansprechpartner_unternehmen', 'unternehmen_id', unternehmenId, byId,
  );
  const skippedMarke = await pullAnsprechpartner(
    db, 'ansprechpartner_marke', 'marke_id', markeId, byId,
  );
  const rows = [];
  for (const ap of byId.values()) {
    if (!ap) continue;
    const name = [ap.vorname, ap.nachname].filter(Boolean).join(' ') || ap.email;
    rows.push({
      id: ap.id,
      email: ap.email,
      name,
      vorname: ap.vorname || '',
    });
  }
  return { rows, skipped: skippedUnternehmen + skippedMarke };
}

export async function loadMailvorlagen(db, dokumentTyp) {
  const { data, error } = await db
    .from('mailvorlage')
    .select(VORLAGE_FIELDS)
    .order('is_standard', { ascending: false })
    .order('name');
  if (error) {
    console.error('Mailvorlagen laden fehlgeschlagen:', error);
    return [];
  }
  return (data || []).filter((v) => (v.dokument_typ || 'briefing') === dokumentTyp);
}

export async function loadPdfResult(createPdf, hint) {
  try {
    const result = await createPdf(hint);
    if (result?.empty) return { pdf: null, status: 'empty' };
    if (result?.serverFallback) return { pdf: result, status: 'server' };
    if (result?.pdfs?.length) {
      return {
        pdf: {
          pdfs: result.pdfs,
          dateiname: result.pdfs.map((item) => item.dateiname).filter(Boolean).join(', '),
        },
        status: 'ready',
      };
    }
    if (!result?.blob) throw new Error('PDF fehlt');
    return { pdf: result, status: 'ready' };
  } catch (err) {
    console.error('PDF-Erzeugung fehlgeschlagen:', err);
    return { pdf: null, status: 'error', error: err };
  }
}

export async function loadAnschreibenSnapshot({
  db,
  dokumentTyp,
  loadEmpfaengerScope = null,
  createPdf,
  pdfHint = null,
  vorlagen = true,
}) {
  const scopePromise = loadEmpfaengerScope
    ? loadEmpfaengerScope(db).catch((err) => {
      console.error('Empfänger-Scope laden fehlgeschlagen:', err);
      return { ...EMPTY_SCOPE };
    })
    : Promise.resolve(null);

  const vorlagenPromise = vorlagen
    ? loadMailvorlagen(db, dokumentTyp)
    : Promise.resolve(null);

  const [empfaengerScope, loadedVorlagen, pdfResult] = await Promise.all([
    scopePromise,
    vorlagenPromise,
    loadPdfResult(createPdf, pdfHint),
  ]);

  return {
    empfaengerScope,
    vorlagen: loadedVorlagen,
    pdf: pdfResult.pdf,
    pdfStatus: pdfResult.status,
  };
}
