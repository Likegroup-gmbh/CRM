// WizardProgressBar.js
// 3-Step Fortschrittsanzeige. Nutzt das bestehende .multistep-progress / .progress-step Pattern
// aus components.css (siehe VertraegeCreate).

export class WizardProgressBar {
  constructor(host, labels, currentStep, onStepClick) {
    this.host = host;
    this.labels = labels || [];
    this.currentStep = currentStep || 1;
    this.onStepClick = onStepClick || null;
  }

  render() {
    if (!this.host) return;
    this.host.className = 'progress-steps';
    this.host.setAttribute('role', 'navigation');
    this.host.setAttribute('aria-label', 'Schritt-Fortschritt');

    const html = this.labels.map((label, idx) => {
      const step = idx + 1;
      const classes = ['progress-step'];
      if (step < this.currentStep) classes.push('active');
      if (step === this.currentStep) classes.push('active', 'current');
      return `
        <div class="${classes.join(' ')}" data-step="${step}" role="button" tabindex="0" aria-label="Schritt ${step}: ${label}">
          <div class="step-number">${step}</div>
          <div class="step-label">${label}</div>
        </div>
      `;
    }).join('');

    this.host.innerHTML = html;
    this.bindEvents();
  }

  bindEvents() {
    if (!this.host || !this.onStepClick) return;
    const items = this.host.querySelectorAll('.progress-step');
    items.forEach(item => {
      const step = parseInt(item.dataset.step, 10);
      const handler = (e) => {
        e.preventDefault();
        this.onStepClick(step);
      };
      item.addEventListener('click', handler);
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') handler(e);
      });
    });
  }

  update(currentStep) {
    this.currentStep = currentStep;
    this.render();
  }
}
