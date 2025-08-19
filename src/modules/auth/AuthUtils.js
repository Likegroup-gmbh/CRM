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
            <button type="submit" class="btn primary-btn">Anmelden</button>
          </div>
          <div class="form-box text-center">
            <button type="button" class="btn secondary-btn" onclick="window.authUtils.showRegister()">
              Registrieren
            </button>
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
            <button type="submit" class="btn primary-btn">Registrieren</button>
          </div>
          <div class="form-box text-center">
            <button type="button" class="btn secondary-btn" onclick="window.authUtils.showLogin()">
              Zurück zum Login
            </button>
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
      
      const { user, error } = await authService.signUp(email, name, password);
      
      if (error) {
        throw error;
      }

      if (user) {
        console.log('✅ Registrierung erfolgreich');
        this.showApp();
      }
    } catch (error) {
      console.error('Registration failed:', error);
      errorDiv.textContent = error.message || 'Registrierung fehlgeschlagen';
      errorDiv.style.display = 'block';
    }
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
