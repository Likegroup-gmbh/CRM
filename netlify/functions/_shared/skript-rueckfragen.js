// Geklaerte Rueckfragen (Dialog vor der Generierung) fuer Generierung und
// Edit. Ohne Limit: die Antworten gelten, bis der User sie aendert.

const RUECKFRAGEN_SKIP_STATUS = ['pending', 'running', 'error', 'cancelled'];

const RUECKFRAGEN_HEADER = '# GEKLAERTE RUECKFRAGEN (verbindliche Antworten des Users - haben Vorrang vor '
  + 'widerspruechlichen CRM-Daten, aber nicht vor den harten Grenzen aus dem Briefing)';

function rueckfragenDialogText(rows) {
  return (rows || [])
    .filter((m) => !RUECKFRAGEN_SKIP_STATUS.includes(m.status))
    .filter((m) => (m.inhalt || '').trim())
    .map((m) => `${m.rolle === 'user' ? 'User' : 'Liky'}: ${m.inhalt.trim()}`)
    .join('\n');
}

async function loadRueckfragenDialog(supabase, skriptId) {
  if (!skriptId) return '';
  const { data } = await supabase.from('skript_chat_messages')
    .select('rolle, inhalt, status')
    .eq('skript_id', skriptId)
    .eq('aktion', 'rueckfrage')
    .order('created_at');
  return rueckfragenDialogText(data);
}

function fmtRueckfragenBlock(dialog) {
  if (!dialog) return '';
  return `\n${RUECKFRAGEN_HEADER}\n<rueckfragen_dialog>\n${dialog}\n</rueckfragen_dialog>\n`;
}

module.exports = {
  loadRueckfragenDialog, rueckfragenDialogText, fmtRueckfragenBlock,
  RUECKFRAGEN_HEADER, RUECKFRAGEN_SKIP_STATUS
};
