// VersionCheck.js
// Erkennt nach einem Deploy, dass der aktuelle Tab alten Code laedt,
// und zeigt einen Banner mit "Jetzt neu laden". Verhindert, dass
// Uploads mit veraltetem Client-Code (z.B. ohne Stills-Index) weiterlaufen.
//
// Im Dev (kein /version.json) bleibt der Check still deaktiviert.

const POLL_MS = 2 * 60 * 1000;
const VERSION_URL = '/version.json';

let _knownBuild = null;
let _shown = false;
let _timer = null;

async function fetchBuild() {
  try {
    const resp = await fetch(VERSION_URL, { cache: 'no-store' });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data?.build || null;
  } catch {
    return null;
  }
}

function showBanner() {
  if (_shown) return;
  _shown = true;
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }

  const banner = document.createElement('div');
  banner.setAttribute('role', 'status');
  banner.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'right:0',
    'z-index:10000',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'gap:12px',
    'padding:10px 16px',
    'background:#1a1a1a',
    'color:#fff',
    'font:14px/1.4 system-ui,sans-serif',
    'box-shadow:0 2px 8px rgba(0,0,0,.25)',
  ].join(';');

  const text = document.createElement('span');
  text.textContent = 'Eine neue Version des CRM ist verfügbar.';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Jetzt neu laden';
  btn.style.cssText = [
    'appearance:none',
    'border:0',
    'border-radius:6px',
    'padding:6px 12px',
    'background:#fff',
    'color:#1a1a1a',
    'font:inherit',
    'font-weight:600',
    'cursor:pointer',
  ].join(';');
  btn.addEventListener('click', () => location.reload());

  banner.append(text, btn);
  document.body.prepend(banner);
}

async function check() {
  if (_shown || document.visibilityState === 'hidden') return;
  const build = await fetchBuild();
  if (!build) return;
  if (_knownBuild == null) {
    _knownBuild = build;
    return;
  }
  if (build !== _knownBuild) showBanner();
}

export function initVersionCheck() {
  if (typeof window === 'undefined') return;
  check();
  _timer = setInterval(check, POLL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
}
