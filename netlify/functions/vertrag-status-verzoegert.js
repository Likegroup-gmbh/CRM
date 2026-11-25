// Persistiert Verzögert für Verträge, die seit 30 Tagen gesendet und nicht
// unterschrieben sind. Anzeige leitet dasselbe in getVertragStatus ab;
// hier wird vertraege.status nachgezogen, damit Filter und andere Leser stimmen.

const { createClient } = require('@supabase/supabase-js');

const VERZOEGERT_NACH_TAGE = 30;

exports.handler = async () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ vertrag-status-verzoegert: Supabase-Konfiguration fehlt');
    return { statusCode: 500, body: 'Supabase-Konfiguration fehlt' };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const cutoff = new Date(Date.now() - VERZOEGERT_NACH_TAGE * 24 * 60 * 60 * 1000).toISOString();

  try {
    const { data, error } = await supabase
      .from('vertraege')
      .update({ status: 'verzoegert' })
      .eq('status', 'gesendet')
      .lte('gesendet_am', cutoff)
      .is('dropbox_file_url', null)
      .is('unterschriebener_vertrag_url', null)
      .select('id');
    if (error) throw error;

    const updated = data?.length || 0;
    console.log(`[vertrag-status-verzoegert] ${updated} Verträge auf verzoegert`);
    return { statusCode: 200, body: JSON.stringify({ updated }) };
  } catch (err) {
    console.error('[vertrag-status-verzoegert]', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
