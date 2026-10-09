/**
 * Passwort-Regeln (gleich wie serverseitig in Supabase Auth).
 * Reine Funktion ohne DOM, auch von Registrierungsseiten und AuthService nutzbar.
 */
export function checkPasswordCriteria(pw) {
  const value = String(pw ?? '');
  return {
    length: value.length >= 8,
    lowercase: /[a-z]/.test(value),
    uppercase: /[A-Z]/.test(value),
    digit: /\d/.test(value),
    symbol: /[^a-zA-Z0-9]/.test(value)
  };
}

export const PASSWORD_POLICY_MESSAGE =
  'Das Passwort muss mindestens 8 Zeichen lang sein und Klein- und Großbuchstaben, eine Ziffer und ein Sonderzeichen enthalten.';

/**
 * @returns {string|null} Kurzer deutscher Hinweis oder null, wenn das Passwort passt.
 */
export function passwordPolicyError(pw) {
  const r = checkPasswordCriteria(pw);
  return Object.values(r).every(Boolean) ? null : PASSWORD_POLICY_MESSAGE;
}

/**
 * Erkennt den Supabase-Auth-Fehler "weak_password" (422) bzw. dessen englischen Text.
 */
export function isWeakPasswordError(error) {
  if (!error) return false;
  const code = `${error.code || ''}`.toLowerCase();
  const msg = `${error.message || ''}`.toLowerCase();
  return code === 'weak_password' || msg.startsWith('password should') || msg.includes('weak password');
}

/**
 * Passwort-Hinweise: Einmal anzeigen bei Focus/Input, bleiben sichtbar, nur Inhalt wechselt
 * Nutzung: initPasswordHints('registerPassword') oder initPasswordHints('password')
 */
export function initPasswordHints(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const formBox = input.closest('.form-box');
  if (!formBox) return;

  let hintsEl = formBox.querySelector('.password-hints');
  if (!hintsEl) {
    hintsEl = document.createElement('div');
    hintsEl.className = 'password-hints';
    hintsEl.innerHTML = `
      <div class="password-hints-full">
        <div class="password-hints-title">Passwortanforderungen</div>
        <ul class="password-hints-list">
          <li data-criterion="length"><span class="hint-icon"></span> Mindestens 8 Zeichen</li>
          <li data-criterion="lowercase"><span class="hint-icon"></span> Kleinbuchstabe</li>
          <li data-criterion="uppercase"><span class="hint-icon"></span> Großbuchstabe</li>
          <li data-criterion="digit"><span class="hint-icon"></span> Ziffer</li>
          <li data-criterion="symbol"><span class="hint-icon"></span> Sonderzeichen</li>
        </ul>
      </div>
      <div class="password-hints-success" style="display: none;">Passwort erfüllt die Kriterien</div>
    `;
    formBox.appendChild(hintsEl);
  }
  hintsEl.style.display = 'none';

  const fullEl = hintsEl.querySelector('.password-hints-full');
  const successEl = hintsEl.querySelector('.password-hints-success');

  function updateHints(pw) {
    const r = checkPasswordCriteria(pw);
    const allOk = r.length && r.lowercase && r.uppercase && r.digit && r.symbol;

    if (allOk) {
      fullEl.style.display = 'none';
      successEl.style.display = 'block';
    } else {
      fullEl.style.display = 'block';
      successEl.style.display = 'none';
      fullEl.querySelectorAll('[data-criterion]').forEach(li => {
        const icon = li.querySelector('.hint-icon');
        const ok = r[li.dataset.criterion];
        icon.textContent = ok ? '✓' : '○';
        icon.className = 'hint-icon ' + (ok ? 'hint-ok' : 'hint-pending');
        li.classList.toggle('hint-satisfied', ok);
      });
    }
  }

  input.addEventListener('focus', () => {
    hintsEl.style.display = 'block';
    updateHints(input.value);
  });
  input.addEventListener('input', () => {
    hintsEl.style.display = 'block';
    updateHints(input.value);
  });
}
