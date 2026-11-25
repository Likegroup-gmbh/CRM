// EinladungApp.js
// Öffentliche Einladung ohne Konto: /einladung/:token (ADR 0055)
//
// Ablauf:
//  1. Token über die Edge Function `einladung` auflösen (resolve)
//  2. Vorhandene Sitzung in dieser Browser-Sitzung? → Formular
//  3. Sonst Name + 6-stelliger Code (verify) → Sitzung (6 h)
//  4. Formular (Produkt oder Briefing) → Absenden → Bestätigung, auf Wunsch "noch eins"
// Abgelaufene Sitzung: Code-Abfrage als Overlay, das ausgefüllte Formular bleibt erhalten.

import { BEREICH_LABELS } from '../briefing/create/fieldConfig.js';
import { escapeHtml } from '../briefing/create/FieldRenderer.js';
import {
  einladungResolve,
  einladungVerify,
  ladeSitzung,
  loescheSitzung,
  speichereSitzung
} from './einladungApi.js';
import { EinladungBriefingForm } from './EinladungBriefingForm.js';
import { EinladungProduktForm } from './EinladungProduktForm.js';
import { EinladungKonzeptForm } from './EinladungKonzeptForm.js';

const LOGO = '/assets/background/Logo-Icon-gray.svg';

export async function initEinladung(token) {
  const loginRoot = document.getElementById('login-root');
  const appRoot = document.getElementById('app-root');
  if (appRoot) appRoot.style.display = 'none';
  if (loginRoot) loginRoot.style.display = '';

  setzeNoindex();
  renderNachricht(loginRoot, 'Link wird geprüft …');

  let einladung;
  try {
    const antwort = await einladungResolve(token);
    if (!antwort.ok) {
      renderNachricht(loginRoot, antwort.fehler || 'Dieser Link ist ungültig.', true);
      return;
    }
    einladung = antwort.data;
  } catch (err) {
    console.error('Einladung-Resolve fehlgeschlagen:', err);
    renderNachricht(loginRoot, 'Der Link konnte nicht geprüft werden. Bitte später erneut versuchen.', true);
    return;
  }

  const gespeichert = ladeSitzung(token);
  if (gespeichert?.sitzung) {
    zeigeFormular(loginRoot, token, einladung, gespeichert);
    return;
  }

  renderCodeSeite(loginRoot, token, einladung, (sitzung) => zeigeFormular(loginRoot, token, einladung, sitzung));
}

function setzeNoindex() {
  document.title = 'Einladung';
  let meta = document.querySelector('meta[name="robots"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'robots';
    document.head.appendChild(meta);
  }
  meta.content = 'noindex, nofollow';
}

function kopfZeile(einladung) {
  // Konzept-Einladung (Creator): Marke und Projektname, sonst nichts vom Kunden.
  if (einladung.art === 'konzept') {
    return [einladung.markenname || einladung.firmenname, einladung.projektname].filter(Boolean).join(' · ');
  }
  const teile = [einladung.firmenname, einladung.markenname].filter(Boolean);
  return teile.join(' · ');
}

/** @handle aus dem Instagram-Link des Casting-Eintrags, sonst leer. */
function handleVon(link) {
  const m = String(link || '').match(/instagram\.com\/([^/?#\s]+)/i);
  return m ? `@${m[1].replace(/^@/, '')}` : '';
}

/** Name / @Handle der Person der Konzept-Einladung (nicht änderbar). */
export function personZeile(einladung) {
  return [einladung.eintragName, handleVon(einladung.eintragHandle)].filter(Boolean).join(' / ');
}

function titel(einladung) {
  if (einladung.art === 'konzept') return 'Creator Concept Sheet';
  if (einladung.art === 'produkt') return 'Produkt einreichen';
  const typ = BEREICH_LABELS[einladung.briefingTyp];
  return typ ? `Briefing ausfüllen (${typ})` : 'Briefing ausfüllen';
}

// ---------------------------------------------------------------------------
// Formular-Seite
// ---------------------------------------------------------------------------
function zeigeFormular(root, token, einladung, sitzungsdaten) {
  const zustand = { sitzung: sitzungsdaten.sitzung, name: sitzungsdaten.name };

  root.innerHTML = `
    <div class="einladung-page">
      <header class="einladung-kopf">
        <img src="${LOGO}" alt="" class="einladung-kopf__logo">
        <div class="einladung-kopf__text">
          ${kopfZeile(einladung) ? `<p class="einladung-kopf__eyebrow">${escapeHtml(kopfZeile(einladung))}</p>` : ''}
          <h1>${escapeHtml(titel(einladung))}</h1>
          ${einladung.art === 'konzept' && personZeile(einladung)
            ? `<p class="einladung-kopf__person">${escapeHtml(personZeile(einladung))}</p>` : ''}
        </div>
      </header>
      <main class="einladung-haupt">
        <div class="einladung-karte" id="einladung-inhalt"></div>
      </main>
      <div id="einladung-overlay"></div>
    </div>`;

  const inhalt = root.querySelector('#einladung-inhalt');
  const overlay = root.querySelector('#einladung-overlay');
  let aktuellesFormular = null;

  const neueSitzung = () => {
    loescheSitzung(token);
    overlay.innerHTML = '';
    const karte = document.createElement('div');
    karte.className = 'einladung-overlay';
    overlay.appendChild(karte);
    renderCodeKarte(karte, token, einladung, {
      hinweis: 'Die Sitzung ist abgelaufen. Bitte geben Sie den Code erneut ein, Ihre Angaben bleiben erhalten.',
      onErfolg: (daten) => {
        zustand.sitzung = daten.sitzung;
        zustand.name = daten.name;
        if (aktuellesFormular) aktuellesFormular.sitzung = daten.sitzung;
        overlay.innerHTML = '';
      }
    });
  };

  const starteFormular = () => {
    inhalt.innerHTML = '';
    const optionen = {
      token,
      sitzung: zustand.sitzung,
      onFertig: () => zeigeBestaetigung(),
      onSitzungAbgelaufen: neueSitzung
    };
    if (einladung.art === 'konzept') {
      aktuellesFormular = new EinladungKonzeptForm(optionen);
    } else if (einladung.art === 'produkt') {
      aktuellesFormular = new EinladungProduktForm(optionen);
    } else {
      aktuellesFormular = new EinladungBriefingForm({ ...optionen, typ: einladung.briefingTyp });
    }
    aktuellesFormular.mount(inhalt);
    window.scrollTo?.({ top: 0 });
  };

  const zeigeBestaetigung = () => {
    aktuellesFormular = null;
    const konzept = einladung.art === 'konzept';
    const nochEins = konzept
      ? 'Weitere Idee einreichen'
      : einladung.art === 'produkt' ? 'Weiteres Produkt einreichen' : 'Weiteres Briefing ausfüllen';
    inhalt.innerHTML = `
      <div class="einladung-fertig">
        <h2>Vielen Dank${zustand.name ? `, ${escapeHtml(zustand.name)}` : ''}</h2>
        <p>${konzept
          ? 'Deine Idee ist bei uns angekommen. Wir schauen sie uns an und melden uns bei dir.'
          : 'Ihre Angaben sind bei uns angekommen. Wir prüfen sie und melden uns, falls etwas offen ist.'}</p>
        <button type="button" class="mdc-btn" id="einladung-noch-eins">${nochEins}</button>
      </div>`;
    inhalt.querySelector('#einladung-noch-eins').addEventListener('click', starteFormular);
    window.scrollTo?.({ top: 0 });
  };

  starteFormular();
}

// ---------------------------------------------------------------------------
// Code-Eingabe (Name + 6-stelliger Code)
// ---------------------------------------------------------------------------
function renderCodeSeite(root, token, einladung, onErfolg) {
  root.innerHTML = `
    <div class="login-split-container">
      <div class="login-left">
        <div class="login-box auth-card" id="einladung-code-karte"></div>
      </div>
      <div class="login-right"></div>
    </div>`;
  renderCodeKarte(root.querySelector('#einladung-code-karte'), token, einladung, {
    onErfolg,
    mitLogo: true
  });
}

function renderCodeKarte(karte, token, einladung, { onErfolg, hinweis = '', mitLogo = false }) {
  // Konzept-Einladung: die Person steht fest, der Name ist vorbelegt und nicht änderbar.
  const konzept = einladung.art === 'konzept';
  const gespeicherterName = konzept
    ? (einladung.eintragName || '')
    : (localStorage.getItem('cj24.guestName') || '');
  const kopf = kopfZeile(einladung);

  karte.innerHTML = `
    ${mitLogo ? `
      <div class="login-logo-wrapper">
        <img src="${LOGO}" alt="Logo" class="login-logo">
      </div>` : ''}
    <h1 class="auth-title">${escapeHtml(titel(einladung))}</h1>
    ${kopf ? `<p class="auth-subtitle">${escapeHtml(kopf)}</p>` : ''}
    ${hinweis ? `<p class="guest-onboarding-note">${escapeHtml(hinweis)}</p>` : ''}

    <div class="form-box guest-form">
      <label class="label" for="einladung-name">${konzept ? 'Dein Name' : 'Ihr Name'}</label>
      <input type="text" id="einladung-name" class="input" placeholder="Vor- und Nachname"
             value="${escapeHtml(gespeicherterName)}" autocomplete="name" maxlength="80"${konzept ? ' readonly' : ''}>
    </div>

    <p class="auth-subtitle guest-code-label">6-stelliger Code</p>
    <div class="otp-container">
      <div class="otp-inputs" data-otp>
        ${Array.from({ length: 6 }, (_, i) => `
          <input type="text" class="otp-input" maxlength="1" inputmode="numeric"
                 autocomplete="${i === 0 ? 'one-time-code' : 'off'}">`).join('')}
      </div>
      <button type="button" class="verify-button" data-verify>Weiter</button>
    </div>
    <p class="guest-onboarding-note">
      ${konzept
        ? 'Den Code hast du von deinem Ansprechpartner bekommen. Ein Konto ist nicht nötig.'
        : 'Den Code hat Ihnen Ihr Ansprechpartner mitgeteilt. Ein Konto ist nicht nötig.'}
    </p>
    <div class="auth-alert auth-alert--error" data-fehler style="display:none;"></div>`;

  const nameInput = karte.querySelector('#einladung-name');
  const otp = Array.from(karte.querySelectorAll('.otp-input'));
  const fehlerEl = karte.querySelector('[data-fehler]');
  const knopf = karte.querySelector('[data-verify]');

  const zeigeFehler = (text) => {
    fehlerEl.textContent = text;
    fehlerEl.style.display = text ? '' : 'none';
  };
  const code = () => otp.map((i) => i.value).join('');
  const stil = () => otp.forEach((i) => {
    i.classList.remove('filled', 'error');
    if (i.value) i.classList.add('filled');
  });
  const leeren = () => {
    otp.forEach((i) => { i.value = ''; });
    stil();
    otp[0].focus();
  };

  let prueft = false;
  const pruefen = async () => {
    if (prueft) return;
    zeigeFehler('');
    const name = nameInput.value.trim();
    if (name.length < 2) {
      zeigeFehler('Bitte Ihren Namen eingeben (mindestens 2 Zeichen).');
      nameInput.focus();
      return;
    }
    if (!/^\d{6}$/.test(code())) {
      zeigeFehler('Bitte den 6-stelligen Code eingeben.');
      return;
    }

    prueft = true;
    knopf.disabled = true;
    knopf.textContent = 'Wird geprüft …';
    try {
      const antwort = await einladungVerify(token, code(), name);
      if (!antwort.ok || !antwort.data?.sitzung) {
        zeigeFehler(antwort.fehler || 'Der Code ist ungültig.');
        otp.forEach((i) => { if (i.value) i.classList.add('error'); });
        setTimeout(leeren, 1500);
        return;
      }
      if (!konzept) localStorage.setItem('cj24.guestName', name);
      const daten = { sitzung: antwort.data.sitzung, name };
      speichereSitzung(token, daten);
      onErfolg(daten);
    } catch (err) {
      console.error('Einladung-Verify fehlgeschlagen:', err);
      zeigeFehler('Prüfung fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      prueft = false;
      knopf.disabled = false;
      knopf.textContent = 'Weiter';
    }
  };

  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') otp[0].focus();
  });

  otp.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      const wert = e.target.value;
      if (wert !== '' && !/^\d$/.test(wert)) {
        e.target.value = '';
        return;
      }
      if (wert && index < otp.length - 1) {
        setTimeout(() => {
          otp[index + 1].focus();
          otp[index + 1].select();
        }, 10);
      }
      stil();
      if (code().length === 6 && nameInput.value.trim().length >= 2) setTimeout(pruefen, 200);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && index > 0) {
        otp[index - 1].focus();
        otp[index - 1].value = '';
        stil();
      }
      if (e.key === 'ArrowLeft' && index > 0) otp[index - 1].focus();
      if (e.key === 'ArrowRight' && index < otp.length - 1) otp[index + 1].focus();
      if (e.key === 'Enter') pruefen();
    });
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const eingefuegt = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
      if (eingefuegt.length === 6) {
        otp.forEach((o, i) => { o.value = eingefuegt[i] || ''; });
        stil();
        if (nameInput.value.trim().length >= 2) pruefen();
      }
    });
  });

  knopf.addEventListener('click', pruefen);
  (nameInput.value ? otp[0] : nameInput).focus();
}

function renderNachricht(root, text, fehler = false) {
  if (!root) return;
  root.innerHTML = `
    <div class="login-split-container">
      <div class="login-left">
        <div class="login-box auth-card">
          <div class="login-logo-wrapper">
            <img src="${LOGO}" alt="Logo" class="login-logo">
          </div>
          ${fehler
            ? `<div class="auth-alert auth-alert--error guest-flush">${escapeHtml(text)}</div>`
            : `<p class="auth-subtitle guest-flush">${escapeHtml(text)}</p>`}
        </div>
      </div>
      <div class="login-right"></div>
    </div>`;
}
