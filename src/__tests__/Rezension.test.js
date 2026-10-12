import { describe, it, expect, afterEach } from 'vitest';
import {
  creatorWert,
  darfRezensionSehen,
  formatRezension,
  paintStars,
  readRezensionForm,
  renderKooperationRezension,
  renderRezensionListe,
  saveRezension,
  settleRezensionFilters,
  syncRezensionForm,
  wertDerRezension
} from '../modules/creator/rezension.js';
import CreatorFilterLogic from '../modules/creator/filters/CreatorFilterLogic.js';

function parse(html) {
  return new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
}

const review = {
  id: 'r1',
  produktionsqualitaet: 5,
  kommunikation_verlaesslichkeit: 4,
  kommentar: 'Pünktlich',
  angelegt_von: 'Lea',
  geaendert_von: 'Tim'
};

afterEach(() => {
  delete window.isInternal;
  delete window.canEdit;
});

describe('Rezension', () => {
  it('mittelt die Achsen und dann die Rezensionen, leer bleibt leer', () => {
    expect(wertDerRezension(5, 3)).toBe(4);
    expect(creatorWert([
      { produktionsqualitaet: 5, kommunikation_verlaesslichkeit: 5 },
      { produktionsqualitaet: 1, kommunikation_verlaesslichkeit: 3 }
    ])).toBe(3.5);
    expect(creatorWert([])).toBeNull();
  });

  it('zeigt eine Nachkommastelle und ohne Wert einen Strich', () => {
    expect(formatRezension(4.5)).toBe('4,5');
    expect(formatRezension(4.25)).toBe('4,3');
    expect(formatRezension('4.5')).toBe('4,5');
    expect(formatRezension(null)).toBe('–');
    expect(formatRezension(undefined)).toBe('–');
  });

  it('filtert auf den ungerundeten Schnitt und lässt Unbewertete beim Mindestwert aus', () => {
    expect(CreatorFilterLogic.processFilters({ rezension_min: '4' }).rezension_schnitt)
      .toEqual({ type: 'rezension_min', value: 4 });
    expect(CreatorFilterLogic.processFilters({ rezension_ohne: true }).rezension_schnitt)
      .toEqual({ type: 'rezension_ohne' });
    expect(CreatorFilterLogic.processFilters({ rezension_min: '4', rezension_ohne: true }).rezension_schnitt)
      .toEqual({ type: 'rezension_min', value: 4 });
    expect(settleRezensionFilters({ rezension_min: '4', rezension_ohne: true }).rezension_ohne)
      .toBeUndefined();

    const rows = [
      { rezension_schnitt: 4.5 },
      { rezension_schnitt: 3.96 },
      { rezension_schnitt: null }
    ];
    const min = CreatorFilterLogic.filterLocalData(rows, { rezension_min: '4' });
    expect(min.map((row) => row.rezension_schnitt)).toEqual([4.5]);
    const ohne = CreatorFilterLogic.filterLocalData(rows, { rezension_ohne: true });
    expect(ohne).toEqual([{ rezension_schnitt: null }]);
  });

  it('versteckt die Rezension vor allen, die nicht intern sind', () => {
    window.isInternal = () => false;
    expect(darfRezensionSehen()).toBe(false);
    expect(renderKooperationRezension(review, { canEdit: true })).toBe('');
    expect(renderRezensionListe([review])).toBe('');
  });

  it('zeigt beide Achsen, beide Namen und keinen Löschen-Knopf', () => {
    window.isInternal = () => true;
    window.canEdit = () => true;
    const doc = parse(renderKooperationRezension(review, { canEdit: true }));

    expect(doc.querySelectorAll('[data-axis="produktion"]')).toHaveLength(5);
    expect(doc.querySelectorAll('[data-axis="kommunikation"]')).toHaveLength(5);
    expect(doc.querySelector('[data-axis="produktion"][aria-checked="true"]').dataset.value).toBe('5');
    expect(doc.querySelector('.profile-info-item .info-label').textContent).toBe('Wert');
    expect(doc.body.textContent).toContain('Angelegt von');
    expect(doc.body.textContent).toContain('Lea');
    expect(doc.body.textContent).toContain('Zuletzt geändert von');
    expect(doc.body.textContent).toContain('Tim');
    expect(doc.querySelector('[name="kommentar"]').value).toBe('Pünktlich');
    expect(doc.querySelector('[data-action="save-rezension"]').classList.contains('mdc-btn--secondary')).toBe(true);
    expect(doc.querySelector('[data-action="delete-rezension"]')).toBeNull();
    expect(doc.body.textContent).not.toContain('Löschen');
  });

  it('lässt ohne Bearbeitungsrecht nur lesen', () => {
    window.isInternal = () => true;
    const doc = parse(renderKooperationRezension(review, { canEdit: false }));
    expect(doc.querySelector('[data-action="save-rezension"]')).toBeNull();
    expect(doc.querySelector('.rezension-star').disabled).toBe(true);
    expect(doc.querySelector('[name="kommentar"]').readOnly).toBe(true);
  });

  it('speichert nur ganze Sterne von 1 bis 5 auf beiden Achsen', async () => {
    const writes = [];
    const supabase = {
      from: () => ({
        insert: (payload) => {
          writes.push(payload);
          return { select: () => ({ single: async () => ({ data: { id: 'neu' }, error: null }) }) };
        }
      })
    };

    await expect(saveRezension(supabase, {
      kooperationId: 'k1',
      creatorId: 'c1',
      produktionsqualitaet: 4,
      kommunikation_verlaesslichkeit: 2,
      kommentar: '  '
    })).resolves.toEqual({ id: 'neu' });
    expect(writes[0].kommentar).toBeNull();
    expect(writes[0].produktionsqualitaet).toBe(4);

    await expect(saveRezension(supabase, {
      kooperationId: 'k1',
      produktionsqualitaet: 4.5,
      kommunikation_verlaesslichkeit: 2
    })).rejects.toThrow(/Sterne/);
  });

  it('aktualisiert den Wert, sobald beide Achsen Sterne haben', () => {
    window.isInternal = () => true;
    const doc = parse(renderKooperationRezension(null, { canEdit: true }));
    const root = doc.querySelector('#koop-rezension');
    paintStars(root.querySelector('[data-axis="produktion"]').parentElement, 5);
    paintStars(root.querySelector('[data-axis="kommunikation"]').parentElement, 4);
    const values = syncRezensionForm(root);
    expect(values).toEqual({
      produktionsqualitaet: 5,
      kommunikation_verlaesslichkeit: 4,
      kommentar: null
    });
    expect(root.querySelector('[data-rezension-wert]').textContent).toBe('4,5');
    expect(root.querySelector('[data-action="save-rezension"]').disabled).toBe(false);
    expect(readRezensionForm(root).produktionsqualitaet).toBe(5);
  });

  it('listet Kommentar und beide Personen in der Schublade', () => {
    window.isInternal = () => true;
    const doc = parse(renderRezensionListe([{
      ...review,
      kooperation: { id: 'k1', name: 'Sommer' }
    }]));
    expect(doc.body.textContent).toContain('Sommer');
    expect(doc.body.textContent).toContain('Pünktlich');
    expect(doc.body.textContent).toContain('Lea');
    expect(doc.body.textContent).toContain('Tim');
    expect(doc.body.textContent).toContain('4,5');
  });
});
