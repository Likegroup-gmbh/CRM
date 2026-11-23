// personaCreateScope.js
// Zuordnung aus dem Create-Drawer: Unternehmen und Briefing sind Pflicht.
// Marke und Produkt sind optional und stehen nur in der URL, wenn eins
// gewählt wurde (nicht jedes Unternehmen hat eine Marke). Der Drawer legt
// keine Persona an.

function withProdukt(q, produktId) {
  if (produktId) q.set('produkt', produktId);
  return q;
}

function withMarke(q, markeId) {
  if (markeId) q.set('marke', markeId);
  return q;
}

export function readCreateScope(search, ctx = null) {
  const params = typeof search === 'string'
    ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
    : (search || new URLSearchParams());

  const unternehmenId = ctx?.unternehmenId || params.get('unternehmen') || null;
  const markeId = ctx?.markeId || params.get('marke') || null;
  const briefingId = params.get('briefing') || null;
  const produktId = params.get('produkt') || null;
  if (!unternehmenId || !briefingId) return null;

  return { unternehmenId, markeId, briefingId, produktId };
}

export function personaCreateRoute(origin, { unternehmenId, markeId = null, briefingId, produktId }) {
  if (origin === 'marke' && markeId) {
    const q = withProdukt(new URLSearchParams({ briefing: briefingId }), produktId);
    return `/marke/${markeId}/persona?${q}`;
  }
  if (origin === 'unternehmen') {
    const q = withMarke(new URLSearchParams(), markeId);
    q.set('briefing', briefingId);
    return `/unternehmen/${unternehmenId}/persona?${withProdukt(q, produktId)}`;
  }
  const q = withMarke(new URLSearchParams({ unternehmen: unternehmenId }), markeId);
  q.set('briefing', briefingId);
  return `/persona/new?${withProdukt(q, produktId)}`;
}

export async function resolveCreateScopeLabels(scope) {
  const labels = {
    unternehmenName: '',
    markeName: '',
    briefingName: '',
    produktName: 'Produkt',
    produktSub: ''
  };
  if (!scope || !window.supabase?.from) return labels;

  try {
    const produktPromise = scope.produktId
      ? window.supabase.from('produkt').select('name, kurzbeschreibung').eq('id', scope.produktId).maybeSingle()
      : Promise.resolve({ data: null });
    const [unternehmen, marke, briefing, produkt] = await Promise.all([
      window.supabase.from('unternehmen').select('firmenname').eq('id', scope.unternehmenId).maybeSingle(),
      scope.markeId
        ? window.supabase.from('marke').select('markenname').eq('id', scope.markeId).maybeSingle()
        : Promise.resolve({ data: null }),
      window.supabase.from('campaign_briefings').select('aktivierung_name').eq('id', scope.briefingId).maybeSingle(),
      produktPromise
    ]);
    labels.unternehmenName = unternehmen.data?.firmenname || '';
    labels.markeName = marke.data?.markenname || '';
    labels.briefingName = briefing.data?.aktivierung_name || '';
    if (scope.produktId) {
      labels.produktName = produkt.data?.name || 'Produkt';
      labels.produktSub = produkt.data?.kurzbeschreibung || '';
    }
  } catch (err) {
    console.error('Zuordnung der Persona konnte nicht beschriftet werden:', err);
  }
  return labels;
}
