// chat-verlauf.js
// Ein Verlauf fuer alle Chatboards. Rows rein, Anthropic-messages raus.
// Kein tool_use, keine Thinking-Bloecke: der Tool-Call ist schon Text,
// Thinking laeuft pro Request neu.

const SKIP_STATUS = new Set(['error', 'cancelled', 'pending', 'running']);

function defaultFormat(row) {
  if (!row || SKIP_STATUS.has(row.status)) return null;
  const rolle = row.rolle || row.role;
  const role = rolle === 'user' ? 'user'
    : (rolle === 'assistant' || rolle === 'liky' ? 'assistant' : null);
  if (!role) return null;
  const content = String(row.inhalt ?? row.text ?? row.content ?? '').trim();
  if (!content) return null;
  return { role, content };
}

/**
 * @param {Array} rows
 * @param {{ task?: string, format?: Function, limit?: number, dropTrailingUser?: string }} [opts]
 * limit schneidet von hinten, nach dropTrailingUser.
 * task wird der letzte User-Turn. Folgt er auf user, wird er angehaengt.
 */
function verlaufZuMessages(rows, { task = '', format = null, limit = 0, dropTrailingUser = null } = {}) {
  let list = Array.isArray(rows) ? rows.slice() : [];
  if (dropTrailingUser != null) {
    const last = list[list.length - 1];
    const rolle = last?.rolle || last?.role;
    const inhalt = String(last?.inhalt ?? last?.text ?? last?.content ?? '').trim();
    if (last && rolle === 'user' && inhalt === String(dropTrailingUser).trim() && inhalt) {
      list.pop();
    }
  }
  if (limit > 0) list = list.slice(-limit);

  const fmt = typeof format === 'function' ? format : defaultFormat;
  const turns = [];
  for (const row of list) {
    const turn = fmt(row);
    if (!turn) continue;
    const role = turn.role === 'user' || turn.role === 'assistant' ? turn.role : null;
    const content = String(turn.content ?? '').trim();
    if (!role || !content) continue;
    const prev = turns[turns.length - 1];
    if (prev && prev.role === role) prev.content += '\n\n' + content;
    else turns.push({ role, content });
  }
  while (turns.length && turns[0].role !== 'user') turns.shift();

  const auftrag = String(task ?? '').trim();
  if (auftrag) {
    const prev = turns[turns.length - 1];
    if (prev && prev.role === 'user') prev.content += '\n\n' + auftrag;
    else turns.push({ role: 'user', content: auftrag });
  }
  if (!turns.length) return [{ role: 'user', content: auftrag }];
  return turns;
}

module.exports = { verlaufZuMessages, defaultFormat, SKIP_STATUS };
