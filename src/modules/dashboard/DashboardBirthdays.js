// DashboardBirthdays.js
// Lädt und rendert anstehende Geburtstage (nächste 30 Tage)

/**
 * Lädt anstehende Geburtstage je nach Rolle:
 * - Admin/Mitarbeiter: Ansprechpartner- + Mitarbeiter-Geburtstage
 * - Kunden: Mitarbeiter-Geburtstage (zugeordnete Betreuer)
 * @returns {Promise<Array>} Sortierte Liste der anstehenden Geburtstage
 */
export async function loadUpcomingBirthdays() {
  if (!window.supabase) return [];

  const isKunde = window.isKunde?.();

  try {
    const queries = [];

    // Ansprechpartner-Geburtstage (nur für Admin/Mitarbeiter)
    if (!isKunde) {
      queries.push(
        window.supabase
          .from('ansprechpartner')
          .select('id, vorname, nachname, geburtsdatum, profile_image_url')
          .not('geburtsdatum', 'is', null)
          .then(({ data, error }) => {
            if (error) console.error('❌ DashboardBirthdays: Ansprechpartner-Fehler:', error);
            return (data || []).map(c => ({ ...c, _type: 'ansprechpartner' }));
          })
      );
    }

    // Benutzer-Geburtstage. Kunden dürfen nur interne Mitarbeiter sehen,
    // keine anderen Kunden. Intern werden alle Benutzer angezeigt.
    let benutzerQuery = window.supabase
      .from('benutzer')
      .select('id, vorname, nachname, geburtsdatum, profile_image_url, rolle')
      .not('geburtsdatum', 'is', null);

    if (isKunde) {
      benutzerQuery = benutzerQuery.in('rolle', ['mitarbeiter', 'admin']);
    }

    queries.push(
      benutzerQuery.then(({ data, error }) => {
        if (error) console.error('❌ DashboardBirthdays: Benutzer-Fehler:', error);
        return (data || []).map(b => ({
          ...b,
          _type: b.rolle === 'kunde' || b.rolle === 'kunde_editor' ? 'kunde' : 'mitarbeiter'
        }));
      })
    );

    const results = await Promise.all(queries);
    const allContacts = results.flat();

    if (allContacts.length === 0) return [];

    return filterAndSortBirthdays(allContacts, 60);
  } catch (err) {
    console.error('❌ DashboardBirthdays: Unerwarteter Fehler:', err);
    return [];
  }
}

/**
 * Filtert Geburtstage nach den nächsten N Tagen und sortiert nach nächstem Auftreten.
 * Vergleicht nur Monat+Tag (jahresunabhängig).
 */
function filterAndSortBirthdays(contacts, daysAhead) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const results = [];

  for (const contact of contacts) {
    const bday = new Date(contact.geburtsdatum);
    if (isNaN(bday.getTime())) continue;

    const nextBirthday = getNextBirthday(bday, today);
    const diffDays = Math.round((nextBirthday - today) / (1000 * 60 * 60 * 24));

    if (diffDays >= 0 && diffDays <= daysAhead) {
      const age = nextBirthday.getFullYear() - bday.getFullYear();
      results.push({
        id: contact.id,
        vorname: contact.vorname || '',
        nachname: contact.nachname || '',
        profileImage: contact.profile_image_url || null,
        geburtsdatum: contact.geburtsdatum,
        type: contact._type || 'ansprechpartner',
        nextBirthday,
        daysUntil: diffDays,
        age
      });
    }
  }

  results.sort((a, b) => a.daysUntil - b.daysUntil);
  return results;
}

/**
 * Berechnet das nächste Geburtstagsdatum (dieses oder nächstes Jahr).
 */
function getNextBirthday(birthdayDate, today) {
  const thisYear = today.getFullYear();
  let next = new Date(thisYear, birthdayDate.getMonth(), birthdayDate.getDate());

  if (next < today) {
    next = new Date(thisYear + 1, birthdayDate.getMonth(), birthdayDate.getDate());
  }

  return next;
}

function formatBirthdayDate(date) {
  return date.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
}

function getInitials(vorname, nachname) {
  return ((vorname?.[0] || '') + (nachname?.[0] || '')).toUpperCase();
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Rendert die Geburtstags-Liste als HTML.
 * @param {Array} birthdays - Ergebnis von loadUpcomingBirthdays()
 * @returns {string} HTML
 */
export function renderBirthdaysList(birthdays) {
  if (!birthdays || birthdays.length === 0) {
    if (window.isKunde?.()) return '';
    return `
      <div class="dashboard-section dashboard-birthdays">
        <h3 class="dashboard-section__title dashboard-birthdays__title">Anstehende Geburtstage</h3>
        <p class="dashboard-section__empty dashboard-birthdays__empty">Keine Geburtstage in den nächsten 60 Tagen.</p>
      </div>
    `;
  }

  const typeLabels = { ansprechpartner: 'Ansprechpartner', mitarbeiter: 'Mitarbeiter', kunde: 'Kunde' };

  const items = birthdays.map(b => {
    const name = escapeHtml(`${b.vorname} ${b.nachname}`.trim());
    const initials = escapeHtml(getInitials(b.vorname, b.nachname));
    const dateStr = formatBirthdayDate(b.nextBirthday);
    const ageLabel = b.age ? `wird ${b.age}` : '';
    const typeLabel = typeLabels[b.type] || '';

    const avatarHtml = b.profileImage
      ? `<img src="${escapeHtml(b.profileImage)}" alt="${name}" class="dashboard-birthdays__avatar" />`
      : `<span class="dashboard-birthdays__avatar dashboard-birthdays__avatar--initials">${initials}</span>`;

    const daysLabel = b.daysUntil === 0
      ? '<span class="dashboard-birthdays__badge dashboard-birthdays__badge--today">Heute!</span>'
      : b.daysUntil === 1
        ? '<span class="dashboard-birthdays__badge">Morgen</span>'
        : `<span class="dashboard-birthdays__days">in ${b.daysUntil} Tagen</span>`;

    return `
      <li class="dashboard-birthdays__item" data-id="${b.id}">
        ${avatarHtml}
        <div class="dashboard-birthdays__info">
          <span class="dashboard-birthdays__name">${name}${typeLabel ? ` <span class="dashboard-birthdays__type">${typeLabel}</span>` : ''}</span>
          <span class="dashboard-birthdays__date">${dateStr}${ageLabel ? ' · ' + ageLabel : ''}</span>
        </div>
        ${daysLabel}
      </li>
    `;
  }).join('');

  return `
    <div class="dashboard-section dashboard-birthdays">
      <h3 class="dashboard-section__title dashboard-birthdays__title">Anstehende Geburtstage</h3>
      <ul class="dashboard-birthdays__list">
        ${items}
      </ul>
    </div>
  `;
}
