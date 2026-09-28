// fetchAllRows.js
// Laedt eine Tabelle seitenweise, damit keine Zeile am PostgREST-Limit
// (Standard: 1000) still verloren geht. kooperation_videos hat z. B. ueber
// 2.500 Zeilen. Stabile Sortierung nach id, damit die Seiten deterministisch sind.
// Ist die erste Seite voll, werden die Restseiten parallel geholt — der Count
// steht schon an der ersten Antwort, also ohne Extra-Roundtrip.
export async function fetchAllRows(supabase, table, select, pageSize = 1000) {
  const first = await supabase
    .from(table)
    .select(select, { count: 'exact' })
    .order('id', { ascending: true })
    .range(0, pageSize - 1);
  if (first.error) throw first.error;

  const data = first.data || [];
  const rows = [...data];
  if (data.length < pageSize) return rows;

  // Volle erste Seite: der Gesamt-Count reicht, um die restlichen Seiten
  // ohne Wasserfall zu bestimmen.
  const total = typeof first.count === 'number' ? first.count : pageSize;
  const fetches = [];
  for (let offset = pageSize; offset < total; offset += pageSize) {
    fetches.push(
      supabase
        .from(table)
        .select(select)
        .order('id', { ascending: true })
        .range(offset, offset + pageSize - 1)
    );
  }
  for (const { data: page, error } of await Promise.all(fetches)) {
    if (error) throw error;
    rows.push(...(page || []));
  }
  return rows;
}

// Grosse Tabellen (kooperation_videos, kooperationen) nicht erst nach
// COUNT(*) paginieren: eine Welle startet sofort parallel, ohne Count.
// Volle letzte Seite → nächste Welle. Kurze Seite → Stopp, spätere Seiten
// dieser Welle verwerfen. Ein Fehler wirft, es gibt keine Teildaten.
export async function fetchAllRowsWave(supabase, table, select, options = {}) {
  const pageSize = options.pageSize ?? 1000;
  const wave = options.wave ?? 3;

  const fetchPage = (offset) =>
    supabase
      .from(table)
      .select(select)
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);

  const rows = [];
  let offset = 0;
  while (true) {
    const results = await Promise.all(
      Array.from({ length: wave }, (_, i) => fetchPage(offset + i * pageSize)),
    );
    for (const result of results) {
      if (result.error) throw result.error;
    }

    let short = false;
    for (const result of results) {
      const page = result.data || [];
      rows.push(...page);
      if (page.length < pageSize) {
        short = true;
        break;
      }
    }
    if (short) return rows;
    offset += wave * pageSize;
  }
}
