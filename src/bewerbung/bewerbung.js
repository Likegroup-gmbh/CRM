const root = document.getElementById('bewerbung-root');
const token = new URLSearchParams(location.search).get('token') || '';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function call(name, body) {
  const response = await fetch(`/.netlify/functions/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Die Anfrage ist fehlgeschlagen');
  return data;
}

function zeileHtml() {
  return `
    <div class="bewerbung-zeile" data-zeile>
      <label>Vorname<input class="form-input" name="vorname" required></label>
      <label>Nachname<input class="form-input" name="nachname" required></label>
      <label>Instagram<input class="form-input" name="instagram" placeholder="https://instagram.com/…"></label>
      <label>TikTok<input class="form-input" name="tiktok" placeholder="https://www.tiktok.com/@…"></label>
    </div>
  `;
}

function render(data) {
  const who = data.ansprechpartner
    ? `${data.ansprechpartner}, ${data.management}`
    : data.management;
  const sections = (data.briefing?.sections || [])
    .map((section) => `<p><strong>${esc(section.label)}</strong><br>${esc(section.text)}</p>`)
    .join('');
  const existing = (data.bewerbungen || [])
    .map((row) => `<li>${esc(row.vorname)} ${esc(row.nachname)}</li>`)
    .join('') || '<li>Noch keine Bewerbung über diesen Link.</li>';

  root.innerHTML = `
    <h1>${esc(data.briefing?.title || 'Briefing')}</h1>
    <p class="bewerbung-meta">${esc(who)} · Casting ${esc(data.casting || '')}</p>
    <section class="bewerbung-section">
      <div class="bewerbung-actions">
        <button type="button" class="mdc-btn mdc-btn--secondary" id="bewerbung-pdf">Briefing als PDF</button>
      </div>
      ${sections || '<p>Zu diesem Briefing liegen keine weiteren Texte vor.</p>'}
    </section>
    <section class="bewerbung-section">
      <h2>Deine Bewerbungen</h2>
      <ul class="bewerbung-liste">${existing}</ul>
    </section>
    <form class="bewerbung-section" id="bewerbung-form">
      <h2>Creator vorschlagen</h2>
      <div id="bewerbung-zeilen">${zeileHtml()}</div>
      <div class="bewerbung-actions">
        <button type="button" class="mdc-btn mdc-btn--secondary" id="bewerbung-add">Weiteren Creator</button>
        <button type="submit" class="mdc-btn">Abschicken</button>
      </div>
      <p id="bewerbung-fehler"></p>
    </form>
  `;

  document.getElementById('bewerbung-add').addEventListener('click', () => {
    document.getElementById('bewerbung-zeilen').insertAdjacentHTML('beforeend', zeileHtml());
  });
  document.getElementById('bewerbung-pdf').addEventListener('click', () => downloadPdf(data));
  document.getElementById('bewerbung-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const creator = [...document.querySelectorAll('[data-zeile]')].map((row) => ({
      vorname: row.querySelector('[name="vorname"]').value,
      nachname: row.querySelector('[name="nachname"]').value,
      instagram: row.querySelector('[name="instagram"]').value,
      tiktok: row.querySelector('[name="tiktok"]').value,
    }));
    const fehler = document.getElementById('bewerbung-fehler');
    fehler.textContent = '';
    try {
      render(await call('bewerbung-submit', { token, creator }));
    } catch (err) {
      fehler.textContent = err.message;
    }
  });
}

async function downloadPdf(data) {
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
  await new Promise((resolve, reject) => {
    if (window.jspdf?.jsPDF) return resolve();
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('PDF-Bibliothek nicht geladen'));
    document.head.appendChild(script);
  });
  const doc = new window.jspdf.jsPDF();
  let y = 20;
  doc.setFontSize(16);
  doc.text(data.briefing?.title || 'Briefing', 14, y);
  y += 12;
  doc.setFontSize(11);
  for (const section of data.briefing?.sections || []) {
    const lines = doc.splitTextToSize(`${section.label}: ${section.text}`, 180);
    if (y > 270) { doc.addPage(); y = 20; }
    doc.text(lines, 14, y);
    y += lines.length * 6 + 4;
  }
  doc.save('briefing.pdf');
}

if (!token) {
  root.innerHTML = '<p>Dieser Link ist unvollständig.</p>';
} else {
  call('bewerbung-resolve', { token }).then(render).catch((err) => {
    root.innerHTML = `<p>${esc(err.message)}</p>`;
  });
}
