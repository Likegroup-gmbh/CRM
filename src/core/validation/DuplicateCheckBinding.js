// DuplicateCheckBinding.js
// Eine Einbindung des Duplikat-Checks in Anlege-Formulare.
// Jede Entity registriert nur: Felder, Check, Texte, Route. Die Oberfläche
// (Meldung, Liste, Submit sperren, Klick auf Treffer) ist für alle gleich.
//
//   const check = bindDuplicateCheck('management', form, { signal });
//   await check.pruefe();   // direkt vor dem Speichern, true = darf speichern
//
// Exakt (bei Management: namensgleich) sperrt das Speichern, ähnlich warnt nur.

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeImg(url) {
  if (!url) return null;
  return window.validatorSystem?.sanitizeUrl ? window.validatorSystem.sanitizeUrl(url) : url;
}

// Pro Entity: Felder, Check, Texte, Route, Darstellung eines Treffers
export const DUPLICATE_ENTITIES = {
  creator: {
    fields: ['vorname', 'nachname'],
    check: (v) => window.duplicateChecker.checkCreator(v.vorname, v.nachname, null),
    errorTitle: 'Dieser Creator existiert bereits!',
    route: '/creator',
    entry: (e) => ({
      name: `${e.vorname || ''} ${e.nachname || ''}`.trim(),
      meta: e.instagram ? `@${e.instagram}` : '',
      img: e.profilbild_thumb_url || e.profilbild_url
    })
  },
  marke: {
    fields: ['markenname'],
    check: (v) => window.duplicateChecker.checkMarke(v.markenname, null),
    errorTitle: 'Dieser Markenname existiert bereits!',
    route: '/marke',
    entry: (e) => ({ name: e.markenname, meta: e.unternehmen_name || '', img: e.logo_url })
  },
  unternehmen: {
    fields: ['firmenname'],
    check: (v) => window.duplicateChecker.checkUnternehmen(v.firmenname, null),
    errorTitle: 'Dieser Firmenname existiert bereits!',
    route: '/unternehmen',
    entry: (e) => ({ name: e.firmenname, meta: '', img: e.logo_url })
  },
  management: {
    fields: ['firmenname'],
    // frisch: direkt vor dem Speichern nicht aus dem Cache lesen
    check: (v, opts) => window.duplicateChecker.checkManagement(v.firmenname, null, opts),
    errorTitle: 'Dieses Management existiert bereits!',
    route: '/management',
    entry: (e) => ({ name: e.firmenname, meta: '', img: e.logo_url })
  }
};

/**
 * Hängt den Duplikat-Check an ein Anlege-Formular.
 * @param {'creator'|'marke'|'unternehmen'|'management'} entity
 * @param {HTMLFormElement} form
 * @param {Object} [opts]
 * @param {AbortSignal} [opts.signal] - entfernt die Listener beim Abbruch
 * @param {(id:string)=>void|Promise<void>} [opts.onSelect] - Klick auf einen Treffer (Standard: zur Detailseite)
 * @returns {{ pruefe: () => Promise<boolean>, destroy: () => void } | null}
 */
export function bindDuplicateCheck(entity, form, opts = {}) {
  const spec = DUPLICATE_ENTITIES[entity];
  if (!spec || !form) return null;

  const felder = spec.fields.map((name) => form.querySelector(`#${name}, input[name="${name}"]`));
  if (felder.some((f) => !f)) {
    console.warn(`⚠️ DUPLICATE-CHECK: Feld für ${entity} nicht gefunden`);
    return null;
  }

  const letztes = felder[felder.length - 1];
  let container = letztes.parentElement.querySelector('.duplicate-message-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'duplicate-message-container';
    letztes.parentElement.appendChild(container);
  }

  const abort = new AbortController();
  if (opts.signal) {
    if (opts.signal.aborted) abort.abort();
    else opts.signal.addEventListener('abort', () => abort.abort(), { once: true });
  }
  const listener = { signal: abort.signal };

  let lauf = 0; // verwirft veraltete Antworten

  const setSubmit = (gesperrt) => {
    const btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    btn.disabled = gesperrt;
    btn.style.opacity = gesperrt ? '0.5' : '';
    btn.style.cursor = gesperrt ? 'not-allowed' : '';
  };

  const leeren = () => {
    container.innerHTML = '';
    setSubmit(false);
  };

  const werte = () => Object.fromEntries(spec.fields.map((name, i) => [name, felder[i].value.trim()]));
  const vollstaendig = (v) => spec.fields.every((name) => v[name]);

  const select = async (id) => {
    if (opts.onSelect) {
      await opts.onSelect(id);
    } else if (window.navigationSystem) {
      window.navigationSystem.navigateTo(`${spec.route}/${id}`);
    }
  };

  const zeigen = (entries, istFehler) => {
    const liste = (entries || []).map((entry) => {
      const { name, meta, img } = spec.entry(entry);
      const src = safeImg(img);
      return `
        <li class="duplicate-list-item">
          <a href="#" class="duplicate-link" data-entity-id="${escapeHtml(entry.id)}">
            ${src
              ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(name)}" class="duplicate-avatar" />`
              : '<div class="duplicate-avatar duplicate-avatar-placeholder"></div>'}
            <span class="duplicate-name">${escapeHtml(name)}${meta ? ` <span class="duplicate-meta">(${escapeHtml(meta)})</span>` : ''}</span>
          </a>
        </li>`;
    }).join('');

    container.innerHTML = `
      <div class="${istFehler ? 'duplicate-error' : 'duplicate-warning'}">
        <strong>${istFehler ? escapeHtml(spec.errorTitle) : 'Folgende ähnliche Einträge gefunden:'}</strong>
        ${liste ? `<ul class="duplicate-list">${liste}</ul>` : ''}
      </div>`;

    container.querySelectorAll('.duplicate-link[data-entity-id]').forEach((link) => {
      link.addEventListener('click', async (e) => {
        e.preventDefault();
        const id = link.dataset.entityId;
        if (!id) return;
        try {
          await select(id);
        } catch (error) {
          console.error('Treffer öffnen fehlgeschlagen:', error);
          window.toastSystem?.show(error.message || 'Öffnen fehlgeschlagen', 'error');
        }
      }, listener);
    });
  };

  // Prüft die aktuellen Feldwerte. true = darf gespeichert werden (kein exakter Treffer).
  const pruefen = async (checkOpts) => {
    const nr = ++lauf;
    const v = werte();
    if (!vollstaendig(v) || !window.duplicateChecker) {
      leeren();
      return true;
    }
    try {
      const result = await spec.check(v, checkOpts);
      if (nr !== lauf) return true; // inzwischen neu getippt
      if (result.exact) {
        zeigen(result.similar, true);
        setSubmit(true);
        return false;
      }
      if (result.similar?.length) {
        zeigen(result.similar, false);
      } else {
        container.innerHTML = '';
      }
      setSubmit(false);
      return true;
    } catch (error) {
      console.error(`❌ DUPLICATE-CHECK (${entity}):`, error);
      return true;
    }
  };

  felder.forEach((feld) => {
    feld.addEventListener('blur', () => { void pruefen(); }, listener);
    feld.addEventListener('input', () => { lauf += 1; leeren(); }, listener);
  });

  return {
    // Direkt vor dem Speichern: schließt die Lücke zwischen Blur und Klick auf Speichern
    pruefe: () => pruefen({ frisch: true }),
    destroy: () => abort.abort()
  };
}
