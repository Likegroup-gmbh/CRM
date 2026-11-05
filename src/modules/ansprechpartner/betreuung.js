// Betreuung: ein Ansprechpartner gehört zu einem Management und kann
// zusätzlich Creator desselben Managements betreuen. Ohne das Management
// am Creator gilt die Betreuung nicht, die Zeile bleibt aber liegen.

const esc = (value) => window.validatorSystem?.sanitizeHtml?.(String(value ?? '')) ?? String(value ?? '');

export function diffIds(previous, next) {
  const prev = new Set(previous || []);
  const nxt = new Set(next || []);
  return {
    add: [...nxt].filter((id) => !prev.has(id)),
    remove: [...prev].filter((id) => !nxt.has(id))
  };
}

function norm(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function selectedManagementIds(form) {
  const field = form.querySelector('select[name="management_ids"], select[name="management_ids[]"]');
  if (!field) return [];
  const box = field.closest('.form-field');
  const fromTags = [...(box?.querySelectorAll('.tag-based-select .tag[data-value]') || [])]
    .map((tag) => tag.dataset.value)
    .filter(Boolean);
  if (fromTags.length) return [...new Set(fromTags)];
  return [...field.selectedOptions].map((option) => option.value).filter(Boolean);
}

export async function loadAnsprechpartner(managementIds) {
  if (!managementIds?.length || !window.supabase) return [];
  const { data, error } = await window.supabase
    .from('ansprechpartner')
    .select('id, vorname, nachname, email, management_id')
    .in('management_id', managementIds)
    .order('nachname', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function loadBetreuungIds(creatorId) {
  if (!creatorId || !window.supabase) return [];
  const { data, error } = await window.supabase
    .from('creator_ansprechpartner')
    .select('ansprechpartner_id')
    .eq('creator_id', creatorId);
  if (error) throw error;
  return (data || []).map((row) => row.ansprechpartner_id);
}

/**
 * Exakter Name im selben Management blockiert. Ähnliche Namen warnen nur.
 * @returns {{ exact: object|null, similar: object[] }}
 */
export async function findAnsprechpartnerDuplicate(managementId, vorname, nachname, excludeId = null) {
  const people = await loadAnsprechpartner([managementId]);
  const pool = people.filter((person) => person.id !== excludeId);
  const exact = pool.find((person) => norm(person.vorname) === norm(vorname) && norm(person.nachname) === norm(nachname)) || null;
  if (exact || !window.duplicateChecker?.findSimilarLocal) return { exact, similar: [] };
  const similar = window.duplicateChecker.findSimilarLocal(
    `${vorname} ${nachname}`,
    pool.map((person) => ({ ...person, fullname: `${person.vorname || ''} ${person.nachname || ''}`.trim() })),
    ['fullname', 'vorname', 'nachname'],
    excludeId
  ).filter((person) => person.id !== exact?.id);
  return { exact, similar };
}

const PHONE_PATTERN = /^[0-9\s\-()]+$/;

/** Leere Rufnummer bleibt leer. Eine gesetzte Nummer braucht ein Land und ein klares Format. */
export function normalizePhone(number, landId) {
  let value = String(number || '').trim();
  if (!value) return { ok: true, telefonnummer: null, telefonnummer_land_id: null };
  if (!PHONE_PATTERN.test(value)) {
    return { ok: false, message: 'Rufnummer: Nur Zahlen, Leerzeichen und - ( ) erlaubt.' };
  }
  if (value.startsWith('0')) value = value.slice(1).trim();
  if (!value) return { ok: true, telefonnummer: null, telefonnummer_land_id: null };
  const country = String(landId || '').trim();
  if (!country) return { ok: false, message: 'Bitte wähle ein Land zur Rufnummer.' };
  return { ok: true, telefonnummer: value, telefonnummer_land_id: country };
}

export async function createAnsprechpartner({ managementId, vorname, nachname, email, telefonnummer, telefonnummer_land_id }) {
  const first = String(vorname || '').trim();
  const last = String(nachname || '').trim();
  if (!first || !last) {
    return { ok: false, message: 'Vorname und Nachname sind Pflicht.' };
  }
  const phone = normalizePhone(telefonnummer, telefonnummer_land_id);
  if (!phone.ok) return phone;
  const duplicate = await findAnsprechpartnerDuplicate(managementId, first, last);
  if (duplicate.exact) {
    return { ok: false, exact: duplicate.exact, message: `${first} ${last} gibt es bei diesem Management schon.` };
  }
  const row = { vorname: first, nachname: last, management_id: managementId };
  const mail = String(email || '').trim();
  if (mail) row.email = mail;
  if (phone.telefonnummer) {
    row.telefonnummer = phone.telefonnummer;
    row.telefonnummer_land_id = phone.telefonnummer_land_id;
  }
  const { data, error } = await window.supabase
    .from('ansprechpartner')
    .insert(row)
    .select('id, vorname, nachname, email, telefonnummer, telefonnummer_land_id, management_id')
    .single();
  if (error) return { ok: false, message: error.message };
  return { ok: true, person: data, similar: duplicate.similar };
}

function personName(person) {
  return `${person.vorname || ''} ${person.nachname || ''}`.replace(/\s+/g, ' ').trim() || 'Ohne Namen';
}

function tagLabel(tag) {
  const text = tag.querySelector('span:not(.tag-remove)');
  return (text?.textContent || tag.textContent || '').replace(/×/g, '').trim();
}

function readDrafts(host) {
  return [...host.querySelectorAll('.betreuung-group')].map((group) => ({
    id: group.dataset.managementId,
    vorname: group.querySelector('.betreuung-vorname')?.value || '',
    nachname: group.querySelector('.betreuung-nachname')?.value || '',
    email: group.querySelector('.betreuung-email')?.value || ''
  }));
}

function applyDrafts(host, drafts) {
  for (const draft of drafts) {
    if (!draft.id) continue;
    const group = host.querySelector(`.betreuung-group[data-management-id="${CSS.escape(draft.id)}"]`);
    if (!group) continue;
    const vorname = group.querySelector('.betreuung-vorname');
    const nachname = group.querySelector('.betreuung-nachname');
    const email = group.querySelector('.betreuung-email');
    if (vorname) vorname.value = draft.vorname;
    if (nachname) nachname.value = draft.nachname;
    if (email) email.value = draft.email;
  }
}

export function renderBetreuungGroups({ managements, people, checkedIds }) {
  if (!managements.length) {
    return '<p class="form-hint">Erst Management hinterlegen.</p>';
  }
  return managements.map((management) => {
    const own = people.filter((person) => person.management_id === management.id);
    const checks = own.map((person) => {
      const mail = String(person.email || '').trim();
      return `
        <label class="betreuung-person">
          <input type="checkbox" class="creator-ap-check" value="${esc(person.id)}" data-management-id="${esc(management.id)}" ${checkedIds.has(person.id) ? 'checked' : ''} />
          <span class="betreuung-person__name">${esc(personName(person))}</span>
          ${mail ? `<span class="betreuung-person__mail">${esc(mail)}</span>` : ''}
        </label>
      `;
    }).join('');
    return `
      <div class="betreuung-group" data-management-id="${esc(management.id)}">
        <p class="form-label">${esc(management.name)}</p>
        <div class="betreuung-people">
          ${checks || '<p class="form-hint">Noch kein Ansprechpartner.</p>'}
        </div>
        <div class="form-row-group betreuung-new">
          <div class="form-field form-field--grow">
            <label>Vorname</label>
            <input type="text" class="form-input betreuung-vorname" autocomplete="section-betreuung given-name" />
          </div>
          <div class="form-field form-field--grow">
            <label>Nachname</label>
            <input type="text" class="form-input betreuung-nachname" autocomplete="section-betreuung family-name" />
          </div>
          <div class="form-field form-field--grow">
            <label>Mail</label>
            <input type="email" class="form-input betreuung-email" autocomplete="section-betreuung email" />
          </div>
        </div>
        <p class="form-hint betreuung-hint"></p>
        <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm betreuung-add">Ansprechpartner hinzufügen</button>
      </div>
    `;
  }).join('');
}

export async function mountCreatorBetreuung(form, { creatorId = null } = {}) {
  if (!form || form.dataset.betreuungBound === '1') return;
  form.dataset.betreuungBound = '1';
  const managementField = form.querySelector('select[name="management_ids"], select[name="management_ids[]"]');
  const host = document.createElement('div');
  host.id = 'creator-betreuung';
  host.className = 'form-section';
  const anchor = managementField?.closest('.form-field') || managementField;
  if (anchor?.parentElement) anchor.parentElement.insertBefore(host, anchor.nextSibling);
  else form.appendChild(host);

  const checked = new Set(await loadBetreuungIds(creatorId));
  let paintGen = 0;

  const paint = async ({ keepDrafts = true } = {}) => {
    const gen = ++paintGen;
    const ids = selectedManagementIds(form);
    host.dataset.managementKey = ids.join(',');
    if (!ids.length) {
      host.innerHTML = '<h3>Ansprechpartner</h3><p class="form-hint">Erst Management hinterlegen.</p>';
      return;
    }
    const names = new Map();
    const box = managementField?.closest('.form-field');
    for (const tag of box?.querySelectorAll('.tag-based-select .tag[data-value]') || []) {
      names.set(tag.dataset.value, tagLabel(tag));
    }
    for (const option of managementField?.querySelectorAll('option') || []) {
      if (option.value && !names.has(option.value)) names.set(option.value, option.textContent.trim());
    }
    let people = [];
    try {
      people = await loadAnsprechpartner(ids);
    } catch (error) {
      if (gen !== paintGen) return;
      host.innerHTML = `<h3>Ansprechpartner</h3><p class="form-hint">${esc(error.message)}</p>`;
      return;
    }
    if (gen !== paintGen) return;
    for (const input of host.querySelectorAll('.creator-ap-check')) {
      if (input.checked) checked.add(input.value);
      else checked.delete(input.value);
    }
    const drafts = keepDrafts ? readDrafts(host) : [];
    const managements = ids.map((id) => ({ id, name: names.get(id) || 'Management' }));
    host.innerHTML = `<h3>Ansprechpartner</h3>${renderBetreuungGroups({ managements, people, checkedIds: checked })}`;
    applyDrafts(host, drafts);
  };

  host.addEventListener('click', async (event) => {
    const button = event.target.closest('.betreuung-add');
    if (!button) return;
    const group = button.closest('.betreuung-group');
    const hint = group.querySelector('.betreuung-hint');
    const result = await createAnsprechpartner({
      managementId: group.dataset.managementId,
      vorname: group.querySelector('.betreuung-vorname').value,
      nachname: group.querySelector('.betreuung-nachname').value,
      email: group.querySelector('.betreuung-email').value
    });
    if (!result.ok) {
      hint.textContent = result.message;
      if (result.exact) checked.add(result.exact.id);
      if (result.exact) await paint({ keepDrafts: false });
      return;
    }
    checked.add(result.person.id);
    if (result.similar?.length) {
      window.toastSystem?.show('Ähnlicher Name vorhanden, die Person wurde trotzdem angelegt.', 'warning');
    }
    await paint({ keepDrafts: false });
  });

  form.addEventListener('change', (event) => {
    if (event.target.closest('#creator-betreuung')) return;
    const key = selectedManagementIds(form).join(',');
    if (key === host.dataset.managementKey) return;
    paint();
  });
  await paint();
}

/** Haken der gerade gewählten Managements schreiben. Andere Betreuungen bleiben. */
export async function syncCreatorBetreuung(creatorId, form) {
  if (!creatorId || !form || !window.supabase) return;
  const selected = new Set(selectedManagementIds(form));
  const checked = new Set(
    [...form.querySelectorAll('.creator-ap-check:checked')].map((node) => node.value)
  );
  const { data, error } = await window.supabase
    .from('creator_ansprechpartner')
    .select('id, ansprechpartner_id, ansprechpartner:ansprechpartner_id(management_id)')
    .eq('creator_id', creatorId);
  if (error) throw error;

  const existing = new Set();
  for (const link of data || []) {
    existing.add(link.ansprechpartner_id);
    const managementId = link.ansprechpartner?.management_id;
    if (!selected.has(managementId)) continue;
    if (!checked.has(link.ansprechpartner_id)) {
      await window.supabase.from('creator_ansprechpartner').delete().eq('id', link.id);
    }
  }
  const toInsert = [...checked].filter((id) => !existing.has(id));
  if (!toInsert.length) return;
  const { error: insertError } = await window.supabase
    .from('creator_ansprechpartner')
    .insert(toInsert.map((ansprechpartnerId) => ({ creator_id: creatorId, ansprechpartner_id: ansprechpartnerId })));
  if (insertError) throw insertError;
}

export function renderManagementPersonRows() {
  return `
    <section class="form-section" id="management-ap-section">
      <h3>Ansprechpartner</h3>
      <p class="form-hint">Die Verknüpfung mit Creatorn folgt auf der Detailseite.</p>
      <div id="management-ap-rows"></div>
      <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" id="management-ap-add">Person hinzufügen</button>
    </section>
  `;
}

export function bindManagementPersonRows(root) {
  const rows = root.querySelector('#management-ap-rows');
  const add = () => {
    const row = document.createElement('div');
    row.className = 'form-row-group management-ap-row';
    row.innerHTML = `
      <div class="form-field form-field--grow"><label>Vorname</label><input type="text" class="form-input management-ap-vorname" /></div>
      <div class="form-field form-field--grow"><label>Nachname</label><input type="text" class="form-input management-ap-nachname" /></div>
      <div class="form-field form-field--grow"><label>Mail</label><input type="email" class="form-input management-ap-email" /></div>
    `;
    rows.appendChild(row);
  };
  root.querySelector('#management-ap-add')?.addEventListener('click', add);
  add();
}

export async function saveManagementPersons(managementId, root) {
  const rows = [...root.querySelectorAll('.management-ap-row')];
  for (const row of rows) {
    const vorname = row.querySelector('.management-ap-vorname')?.value;
    const nachname = row.querySelector('.management-ap-nachname')?.value;
    if (!String(vorname || '').trim() && !String(nachname || '').trim()) continue;
    const result = await createAnsprechpartner({
      managementId,
      vorname,
      nachname,
      email: row.querySelector('.management-ap-email')?.value
    });
    if (!result.ok) {
      window.toastSystem?.show(result.message, 'error');
      continue;
    }
    if (result.similar?.length) {
      window.toastSystem?.show('Ähnlicher Name vorhanden, die Person wurde trotzdem angelegt.', 'warning');
    }
  }
}

export async function toggleBetreuung(creatorId, ansprechpartnerId, on) {
  if (on) {
    const { error } = await window.supabase
      .from('creator_ansprechpartner')
      .insert({ creator_id: creatorId, ansprechpartner_id: ansprechpartnerId });
    if (error && !String(error.message || '').includes('duplicate')) throw error;
    return;
  }
  const { error } = await window.supabase
    .from('creator_ansprechpartner')
    .delete()
    .eq('creator_id', creatorId)
    .eq('ansprechpartner_id', ansprechpartnerId);
  if (error) throw error;
}
