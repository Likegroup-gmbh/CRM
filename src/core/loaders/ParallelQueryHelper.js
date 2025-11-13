/**
 * ParallelQueryHelper
 * 
 * Hilfs-Modul für paralleles und sequentielles Laden von Supabase-Queries
 * zur Performance-Optimierung von Detail-Seiten.
 */

/**
 * Führt mehrere Query-Funktionen parallel aus mit Promise.all()
 * 
 * @param {Array<Function>} queries - Array von async Funktionen, die Promises zurückgeben
 * @returns {Promise<Array>} Array der Query-Resultate in der gleichen Reihenfolge
 * 
 * @example
 * const results = await parallelLoad([
 *   () => window.supabase.from('kampagne').select('*').eq('id', 1).single(),
 *   () => window.supabase.from('kooperationen').select('*').eq('kampagne_id', 1)
 * ]);
 */
export const parallelLoad = async (queries) => {
  console.log(`🚀 Paralleles Laden von ${queries.length} Queries...`);
  const startTime = performance.now();
  
  const results = await Promise.all(queries.map(q => q()));
  
  const loadTime = (performance.now() - startTime).toFixed(0);
  console.log(`✅ Parallel geladen in ${loadTime}ms`);
  
  return results;
};

/**
 * Führt mehrere Query-Funktionen sequentiell aus (eine nach der anderen)
 * 
 * @param {Array<Function>} queries - Array von async Funktionen, die Promises zurückgeben
 * @returns {Promise<Array>} Array der Query-Resultate in der gleichen Reihenfolge
 * 
 * @example
 * const results = await sequentialLoad([
 *   () => window.supabase.from('kampagne').select('*').eq('id', 1).single(),
 *   () => window.supabase.from('kooperationen').select('*').eq('kampagne_id', 1)
 * ]);
 */
export const sequentialLoad = async (queries) => {
  console.log(`🔄 Sequentielles Laden von ${queries.length} Queries...`);
  const startTime = performance.now();
  const results = [];
  
  for (const query of queries) {
    const result = await query();
    results.push(result);
  }
  
  const loadTime = (performance.now() - startTime).toFixed(0);
  console.log(`✅ Sequentiell geladen in ${loadTime}ms`);
  
  return results;
};





