// Status- und Fehlermeldung der Gastseite in der Login-Shell.

import { escapeHtml } from '../../core/format.js';

export function renderMessage(root, text, isError = false) {
  if (!root) return;
  root.innerHTML = `
    <div class="login-split-container">
      <div class="login-left">
        <div class="login-box auth-card">
          <div class="login-logo-wrapper">
            <img src="/assets/background/Logo-Icon-gray.svg" alt="Logo" class="login-logo">
          </div>
          ${isError
            ? `<div class="auth-alert auth-alert--error guest-flush">${escapeHtml(text)}</div>`
            : `<p class="auth-subtitle guest-flush">${escapeHtml(text)}</p>`}
        </div>
      </div>
      <div class="login-right"></div>
    </div>
  `;
}
