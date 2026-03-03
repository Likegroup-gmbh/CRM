// AuthUtils.js (ES6-Modul)
// UI-Funktionen für Authentifizierung

import { authService } from './AuthService.js';
import { initPasswordHints } from '../../auth/password-hints.js';

export class AuthUtils {
  constructor() {
    this.isPasswordVisible = false;
  }

  // Login anzeigen
  showLogin() {
    try {
      window.appRoot.style.display = 'none';
      window.loginRoot.style.display = 'block';
      window.loginRoot.innerHTML = this.createLoginFormHtml();
      this.bindLoginEvents();
    } catch (error) {
      console.error('Error showing login:', error);
    }
  }

  // Login-Formular HTML erstellen
  createLoginFormHtml() {
    return `
      <div class="login-split-container">
        <div class="login-left">
          <div class="login-box">
            <div class="login-logo-wrapper">
              <img src="/assets/background/Logo-Icon-gray.svg" alt="Logo" class="login-logo">
            </div>
            <h2>Willkommen bei LikeBase</h2>
            <form id="loginForm" class="login-form">
              <div class="form-box">
                <label for="loginEmail" class="label">E-Mail</label>
                <input type="email" id="loginEmail" class="input" placeholder="ihre@email.com" required>
              </div>
              <div class="form-box">
                <label for="loginPassword" class="label">Passwort</label>
                <div class="password-input-container">
                  <input type="password" id="loginPassword" class="input" placeholder="Passwort" required>
                  <button type="button" class="password-toggle" onclick="window.authUtils.togglePassword('loginPassword')">
                    <svg class="eye-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                    </svg>
                  </button>
                </div>
                <a href="javascript:void(0)" onclick="window.authUtils.showForgotPassword()" class="forgot-password-link">Passwort vergessen?</a>
              </div>
              <div class="login-actions">
                <div class="form-box">
                  <button type="submit" class="btn primary-btn" style="width: 100%;">Anmelden</button>
                </div>
                <div class="register-links-row">
                  <a href="javascript:void(0)" onclick="window.authUtils.showRegister()" class="register-link-btn">
                    Registrierung
                  </a>
                </div>
              </div>
              <div id="loginError" class="text-error" style="display: none;"></div>
            </form>
          </div>
        </div>
        <div class="login-right"></div>
      </div>
    `;
  }

  // Login-Events binden
  bindLoginEvents() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.onsubmit = (e) => this.handleLoginSubmit(e);
    }
  }

  // Login-Submit behandeln
  async handleLoginSubmit(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');

    try {
      errorDiv.style.display = 'none';
      
      const { user, error } = await authService.signInWithPassword(email, password);
      
      if (error) {
        throw error;
      }

      if (user) {
        console.log('✅ Login erfolgreich');
        this.showApp();
      }
    } catch (error) {
      console.error('Login failed:', error);
      errorDiv.textContent = error.message || 'Anmeldung fehlgeschlagen';
      errorDiv.style.display = 'block';
    }
  }

  // Login-Daten validieren
  validateLoginData(data) {
    const errors = [];
    
    if (!data.email) errors.push('E-Mail ist erforderlich');
    if (!data.password) errors.push('Passwort ist erforderlich');
    
    return errors;
  }

  // Registrierung anzeigen
  showRegister() {
    window.loginRoot.innerHTML = this.createRegisterFormHtml();
    this.bindRegisterEvents();
  }

  // Registrierungs-Formular HTML erstellen
  createRegisterFormHtml() {
    return `
      <div class="login-split-container">
        <div class="login-left">
          <div class="login-box">
            <div class="login-logo-wrapper">
              <img src="/assets/background/Logo-Icon-gray.svg" alt="Logo" class="login-logo">
            </div>
            <h2>Registrierung</h2>
            <form id="registerForm" class="register-form">
              <div class="form-row">
                <div class="form-box">
                  <label for="registerVorname" class="label label-register">Vorname *</label>
                  <input type="text" id="registerVorname" class="input" placeholder="Vorname" required>
                </div>
                <div class="form-box">
                  <label for="registerNachname" class="label label-register">Nachname *</label>
                  <input type="text" id="registerNachname" class="input" placeholder="Nachname" required>
                </div>
              </div>
              <div class="form-box">
                <label for="registerEmail" class="label label-register">E-Mail *</label>
                <input type="email" id="registerEmail" class="input" placeholder="ihre@email.com" required>
                <div id="registerEmailError" class="text-error" style="display: none;"></div>
              </div>
              <div class="form-box">
                <label for="registerFirmenhandy" class="label label-register">Firmenhandy <span class="label-optional">(optional)</span></label>
                <input type="tel" id="registerFirmenhandy" class="input" placeholder="z. B. 15123456789">
              </div>
              <div class="form-box">
                <label for="registerPassword" class="label label-register">Passwort *</label>
                <div class="password-input-container">
                  <input type="password" id="registerPassword" class="input" placeholder="Passwort" required>
                  <button type="button" class="password-toggle" onclick="window.authUtils.togglePassword('registerPassword')">
                    <svg class="eye-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                    </svg>
                  </button>
                </div>
              </div>
              <div class="login-actions">
                <div class="form-box">
                  <button type="submit" class="btn primary-btn" style="width: 100%;">Registrieren</button>
                </div>
                <div class="register-links-row">
                  <a href="javascript:void(0)" onclick="window.authUtils.showLogin()" class="register-link-btn">
                    Zurück zum Login
                  </a>
                </div>
              </div>
              <div id="registerError" class="text-error" style="display: none;"></div>
            </form>
          </div>
        </div>
        <div class="login-right"></div>
      </div>
    `;
  }

  // Registrierungs-Events binden
  bindRegisterEvents() {
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
      registerForm.onsubmit = (e) => this.handleRegisterSubmit(e);
      initPasswordHints('registerPassword');
    }
  }

  // Registrierungs-Submit behandeln
  async handleRegisterSubmit(e) {
    e.preventDefault();
    
    const vorname = document.getElementById('registerVorname').value.trim();
    const nachname = document.getElementById('registerNachname').value.trim();
    const emailInput = document.getElementById('registerEmail');
    const email = emailInput.value;
    const firmenhandy = document.getElementById('registerFirmenhandy')?.value?.trim() || '';
    const password = document.getElementById('registerPassword').value;
    const errorDiv = document.getElementById('registerError');
    const emailErrorDiv = document.getElementById('registerEmailError');

    try {
      errorDiv.style.display = 'none';
      this.clearRegisterEmailError(emailInput, emailErrorDiv);
      
      // Validierung
      if (!vorname || !nachname) {
        throw new Error('Bitte geben Sie Vorname und Nachname ein.');
      }

      
      const result = await authService.signUp(
        email,
        vorname,
        nachname,
        password,
        null,
        firmenhandy,
        null
      );
      
      if (result.error) {
        throw result.error;
      }

      if (result.user) {
        console.log('✅ Registrierung erfolgreich');
        
        // Prüfen ob E-Mail-Verifikation erforderlich ist
        if (result.needsEmailVerification && result.redirectTo) {
          // E-Mail für OTP-Seite speichern
          localStorage.setItem('pendingVerificationEmail', email);
          
          // Erfolgreiche Registrierung anzeigen
          this.showRegistrationSuccess(email, result.redirectTo);
        } else {
          // Fallback: Direkt zur App (sollte nicht passieren)
          this.showApp();
        }
      }
    } catch (error) {
      console.error('Registration failed:', error);

      if (this.isDuplicateEmailError(error)) {
        this.showRegisterEmailError(
          emailInput,
          emailErrorDiv,
          error.message || 'Diese E-Mail-Adresse wird bereits verwendet.'
        );
        return;
      }

      errorDiv.textContent = error.message || 'Registrierung fehlgeschlagen';
      errorDiv.style.display = 'block';
    }
  }

  isDuplicateEmailError(error) {
    if (!error) return false;
    return error.code === 'DUPLICATE_EMAIL' || error.isDuplicateEmail === true;
  }

  clearRegisterEmailError(emailInput, emailErrorDiv) {
    if (emailInput) {
      emailInput.classList.remove('is-invalid');
      emailInput.style.borderColor = '';
      emailInput.style.boxShadow = '';
    }

    if (emailErrorDiv) {
      emailErrorDiv.textContent = '';
      emailErrorDiv.style.display = 'none';
    }
  }

  showRegisterEmailError(emailInput, emailErrorDiv, message) {
    if (emailInput) {
      emailInput.classList.add('is-invalid');
      emailInput.style.borderColor = 'var(--color-error)';
      emailInput.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.2)';
      emailInput.focus();
    }

    if (emailErrorDiv) {
      emailErrorDiv.textContent = message;
      emailErrorDiv.style.display = 'block';
    }
  }

  // Zeige Registrierungserfolg und leite zur OTP-Seite weiter
  showRegistrationSuccess(email, redirectUrl) {
    const successHtml = `
      <div class="login-split-container">
        <div class="login-left">
          <div class="login-box">
            <div class="login-box-icon success">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h2 class="success">Registrierung erfolgreich!</h2>
            <p class="login-box-message">
              Wir haben einen 6-stelligen Bestätigungscode an<br>
              <strong>${email}</strong> gesendet.
            </p>
            <p class="login-box-hint">
              Sie werden in <span id="countdown">3</span> Sekunden zur Bestätigungsseite weitergeleitet...
            </p>
            <div class="form-box text-center">
              <button type="button" class="btn primary-btn" onclick="window.location.href='${redirectUrl}'">
                Jetzt bestätigen
              </button>
            </div>
            <div class="form-box text-center mt-md">
              <button type="button" class="btn secondary-btn" onclick="window.authUtils.showLogin()">
                Zurück zum Login
              </button>
            </div>
          </div>
        </div>
        <div class="login-right"></div>
      </div>
    `;
    
    window.loginRoot.innerHTML = successHtml;
    
    // Countdown und automatische Weiterleitung
    let countdown = 3;
    const countdownElement = document.getElementById('countdown');
    const interval = setInterval(() => {
      countdown--;
      if (countdownElement) {
        countdownElement.textContent = countdown;
      }
      
      if (countdown <= 0) {
        clearInterval(interval);
        window.location.href = redirectUrl;
      }
    }, 1000);
  }

  // Passwort vergessen anzeigen
  showForgotPassword() {
    window.loginRoot.innerHTML = this.createForgotPasswordFormHtml();
    this.bindForgotPasswordEvents();
  }

  // Passwort vergessen Formular HTML erstellen
  createForgotPasswordFormHtml() {
    return `
      <div class="login-split-container">
        <div class="login-left">
          <div class="login-box">
            <div class="login-logo-wrapper">
              <img src="/assets/background/Logo-Icon-gray.svg" alt="Logo" class="login-logo">
            </div>
            <h2>Passwort vergessen?</h2>
            <p class="login-box-description">
              Geben Sie Ihre E-Mail-Adresse ein und wir senden Ihnen einen Link zum Zurücksetzen Ihres Passworts.
            </p>
            <form id="forgotPasswordForm" class="login-form">
              <div class="form-box">
                <label for="forgotEmail" class="label">E-Mail</label>
                <input type="email" id="forgotEmail" class="input" placeholder="ihre@email.com" required>
              </div>
              <div class="login-actions">
                <div class="form-box">
                  <button type="submit" class="btn primary-btn" style="width: 100%;">Link senden</button>
                </div>
                <div class="register-links-row">
                  <a href="javascript:void(0)" onclick="window.authUtils.showLogin()" class="register-link-btn">
                    Zurück zum Login
                  </a>
                </div>
              </div>
              <div id="forgotPasswordError" class="text-error" style="display: none;"></div>
            </form>
          </div>
        </div>
        <div class="login-right"></div>
      </div>
    `;
  }

  // Passwort vergessen Events binden
  bindForgotPasswordEvents() {
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    if (forgotPasswordForm) {
      forgotPasswordForm.onsubmit = (e) => this.handleForgotPasswordSubmit(e);
    }
  }

  // Passwort vergessen Submit behandeln
  async handleForgotPasswordSubmit(e) {
    e.preventDefault();
    
    const email = document.getElementById('forgotEmail').value;
    const errorDiv = document.getElementById('forgotPasswordError');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    try {
      errorDiv.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Wird gesendet...';
      
      const { success, error } = await authService.requestPasswordReset(email);
      
      if (error) {
        throw error;
      }

      // Erfolg anzeigen (unabhängig davon ob E-Mail existiert - Sicherheit)
      this.showForgotPasswordSuccess(email);
    } catch (error) {
      console.error('Password reset request failed:', error);
      errorDiv.textContent = error.message || 'Anfrage fehlgeschlagen. Bitte versuchen Sie es später erneut.';
      errorDiv.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Link senden';
    }
  }

  // Passwort vergessen Erfolg anzeigen
  showForgotPasswordSuccess(email) {
    const successHtml = `
      <div class="login-split-container">
        <div class="login-left">
          <div class="login-box">
            <div class="login-box-icon success">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
              </svg>
            </div>
            <h2 class="success">E-Mail gesendet!</h2>
            <p class="login-box-message">
              Falls ein Account mit <strong>${email}</strong> existiert, haben wir einen Link zum Zurücksetzen des Passworts gesendet.
            </p>
            <p class="login-box-hint">
              Bitte überprüfen Sie auch Ihren Spam-Ordner.
            </p>
            <div class="form-box text-center">
              <button type="button" class="btn primary-btn" onclick="window.authUtils.showLogin()" style="width: 100%;">
                Zurück zum Login
              </button>
            </div>
          </div>
        </div>
        <div class="login-right"></div>
      </div>
    `;
    
    window.loginRoot.innerHTML = successHtml;
  }

  // Registrierungs-Daten validieren
  validateRegisterData(data) {
    const errors = [];
    
    if (!data.vorname) errors.push('Vorname ist erforderlich');
    if (!data.nachname) errors.push('Nachname ist erforderlich');
    if (!data.email) errors.push('E-Mail ist erforderlich');
    if (!data.password) errors.push('Passwort ist erforderlich');
    
    return errors;
  }

  // App anzeigen
  showApp() {
    window.loginRoot.style.display = 'none';
    window.appRoot.style.display = 'block';
    
    // WICHTIG: Nach Login IMMER zum Dashboard navigieren
    // Dies verhindert veraltete Daten auf der zuletzt geöffneten Seite
    console.log('🏠 Navigiere zum Dashboard nach Login');
    
    // URL auf Dashboard setzen
    window.history.pushState({}, '', '/dashboard');
    
    // Dashboard laden
    if (window.moduleRegistry) {
      window.moduleRegistry.loadDashboard();
    }
    
    // Header-UI initialisieren
    window.setupHeaderUI?.();
  }

  // Logout behandeln
  async handleLogout() {
    try {
      const { error } = await authService.signOut();
      if (error) {
        console.error('Logout error:', error);
      }
      this.showLogin();
    } catch (error) {
      console.error('Logout failed:', error);
      this.showLogin();
    }
  }

  // Passwort-Sichtbarkeit umschalten
  togglePassword(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;

    this.isPasswordVisible = !this.isPasswordVisible;
    input.type = this.isPasswordVisible ? 'text' : 'password';
    
    const toggleBtn = input.parentElement.querySelector('.password-toggle');
    if (toggleBtn) {
      const icon = toggleBtn.querySelector('svg');
      if (icon) {
        if (this.isPasswordVisible) {
          icon.innerHTML = `
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"></path>
          `;
        } else {
          icon.innerHTML = `
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
          `;
        }
      }
    }
  }
}

// Exportiere Instanz
export const authUtils = new AuthUtils();
