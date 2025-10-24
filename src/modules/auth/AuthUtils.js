// AuthUtils.js (ES6-Modul)
// UI-Funktionen für Authentifizierung

import { authService } from './AuthService.js';

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
      <div class="login-box">
        <h2>Anmeldung</h2>
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
          </div>
          <div class="form-box">
            <div class="auth-buttons-row">
              <button type="submit" class="btn primary-btn">Anmelden</button>
              <button type="button" class="btn btn-outlined" onclick="window.authUtils.showRegister()">
                Registrieren
              </button>
            </div>
          </div>
          <div class="form-box customer-link">
            <a href="/src/auth/kunden-register.html">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Registrierung für Kunden
            </a>
          </div>
          <div id="loginError" class="text-error" style="display: none;"></div>
        </form>
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
      <div class="login-box">
        <h2>Registrierung</h2>
        <form id="registerForm" class="register-form">
          <div class="form-box">
            <label for="registerName" class="label">Name</label>
            <input type="text" id="registerName" class="input" placeholder="Ihr Name" required>
          </div>
          <div class="form-box">
            <label for="registerEmail" class="label">E-Mail</label>
            <input type="email" id="registerEmail" class="input" placeholder="ihre@email.com" required>
          </div>
          <div class="form-box">
            <label for="registerPassword" class="label">Passwort</label>
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
          <div class="form-box">
            <div class="auth-buttons-row">
              <button type="submit" class="btn primary-btn">Registrieren</button>
              <button type="button" class="btn btn-outlined" onclick="window.authUtils.showLogin()">
                Zurück zum Login
              </button>
            </div>
          </div>
          <div class="form-box customer-link">
            <a href="/src/auth/kunden-register.html">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Registrierung für Kunden
            </a>
          </div>
          <div id="registerError" class="text-error" style="display: none;"></div>
        </form>
      </div>
    `;
  }

  // Registrierungs-Events binden
  bindRegisterEvents() {
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
      registerForm.onsubmit = (e) => this.handleRegisterSubmit(e);
    }
  }

  // Registrierungs-Submit behandeln
  async handleRegisterSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const errorDiv = document.getElementById('registerError');

    try {
      errorDiv.style.display = 'none';
      
      const result = await authService.signUp(email, name, password);
      
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
      errorDiv.textContent = error.message || 'Registrierung fehlgeschlagen';
      errorDiv.style.display = 'block';
    }
  }

  // Zeige Registrierungserfolg und leite zur OTP-Seite weiter
  showRegistrationSuccess(email, redirectUrl) {
    const successHtml = `
      <div class="login-box">
        <div class="success-icon" style="text-align: center; margin-bottom: 2rem;">
          <svg style="width: 80px; height: 80px; color: #10b981; margin: 0 auto;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        <h2 style="text-align: center; color: #10b981;">Registrierung erfolgreich!</h2>
        <p style="text-align: center; margin: 1.5rem 0; color: #6b7280;">
          Wir haben einen 6-stelligen Bestätigungscode an<br>
          <strong style="color: #4f46e5;">${email}</strong> gesendet.
        </p>
        <p style="text-align: center; margin-bottom: 2rem; color: #6b7280; font-size: 0.875rem;">
          Sie werden in <span id="countdown">3</span> Sekunden zur Bestätigungsseite weitergeleitet...
        </p>
        <div class="form-box text-center">
          <button type="button" class="btn primary-btn" onclick="window.location.href='${redirectUrl}'">
            Jetzt bestätigen
          </button>
        </div>
        <div class="form-box text-center" style="margin-top: 1rem;">
          <button type="button" class="btn secondary-btn" onclick="window.authUtils.showLogin()">
            Zurück zum Login
          </button>
        </div>
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

  // Registrierungs-Daten validieren
  validateRegisterData(data) {
    const errors = [];
    
    if (!data.name) errors.push('Name ist erforderlich');
    if (!data.email) errors.push('E-Mail ist erforderlich');
    if (!data.password) errors.push('Passwort ist erforderlich');
    
    return errors;
  }

  // App anzeigen
  showApp() {
    window.loginRoot.style.display = 'none';
    window.appRoot.style.display = 'block';
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
