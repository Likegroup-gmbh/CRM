// fetchAllRows.js
// Laedt eine Tabelle seitenweise, damit keine Zeile am PostgREST-Limit
// (Standard: 1000) still verloren geht. kooperation_videos hat z. B. ueber
// 2.500 Zeilen. Stabile Sortierung nach id, damit die Seiten deterministisch sind.
// Ist die erste Seite voll, werden die Restseiten parallel geholt — der Count
// steht schon an der ersten Antwort, also ohne Extra-Roundtrip.
export async function fetchAllRows(supabase, table, select, pageSize = 1000, refine) {
  const page = (withCount) => {
    let query = supabase
      .from(table)
      .select(select, withCount ? { count: 'exact' } : undefined)
      .order('id', { ascending: true });
    if (typeof refine === 'function') query = refine(query) || query;
    return query;
  };

  const first = await page(true).range(0, pageSize - 1);
  if (first.error) throw first.error;

  const data = first.data || [];
  const rows = [...data];
  if (data.length < pageSize) return rows;

  // Volle erste Seite: der Gesamt-Count reicht, um die restlichen Seiten
  // ohne Wasserfall zu bestimmen.
  const total = Number.isFinite(first.count) ? first.count : pageSize;
  const fetches = [];
  for (let offset = pageSize; offset < total; offset += pageSize) {
    fetches.push(page(false).range(offset, offset + pageSize - 1));
  }
  for (const { data: pageData, error } of await Promise.all(fetches)) {
    if (error) throw error;
    rows.push(...(pageData || []));
  }
  return rows;
}
