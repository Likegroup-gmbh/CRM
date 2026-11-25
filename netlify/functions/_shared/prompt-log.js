// Prompt-Logging fuer Messungen: nur mit LOG_PROMPTS=true, nur ins
// Function-Log (nie in ki_requests). Loggt, was callClaude wirklich schickt.

function promptLogAktiv() {
  return process.env.LOG_PROMPTS === 'true';
}

function messagesText(messages) {
  return (messages || [])
    .map((m) => `[${m.role}]\n${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
    .join('\n\n');
}

function logPrompt({ job, id, aktion = null, stable = '', task = '', messages = null }) {
  if (!promptLogAktiv()) return;
  const rest = messages?.length ? messagesText(messages) : task;
  const kopf = `[LOG_PROMPTS] job=${job} id=${id || '-'} aktion=${aktion || '-'}`;
  console.log(`${kopf} teil=stable len=${stable.length}\n${stable}`);
  console.log(`${kopf} teil=${messages?.length ? 'messages' : 'task'} len=${rest.length}\n${rest}`);
}

module.exports = { logPrompt, promptLogAktiv, messagesText };
