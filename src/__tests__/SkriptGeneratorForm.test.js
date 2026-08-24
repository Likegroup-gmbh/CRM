import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PersonaService } from '../modules/persona/PersonaService.js';
import { skripteService } from '../modules/skripte/SkripteService.js';
import { SkriptGeneratorForm } from '../modules/skripte/SkriptGeneratorForm.js';

vi.mock('../modules/persona/PersonaService.js', () => ({
  PersonaService: {
    loadForContext: vi.fn()
  }
}));

const PREFIX = 'tgen';
const SEARCHABLE_FIELDS = [
  'unternehmen', 'marke', 'kampagne', 'produkt', 'persona', 'branche', 'briefing', 'ref-item'
];

function lastCallFor(createFn, name) {
  const calls = createFn.mock.calls.filter(([select]) => select?.id === `${PREFIX}-${name}`);
  return calls[calls.length - 1] || null;
}

function optionValues(createFn, name) {
  const call = lastCallFor(createFn, name);
  return (call?.[1] || []).map((o) => o.value);
}

describe('SkriptGeneratorForm', () => {
  let form;
  let root;
  let createSimpleSearchableSelect;

  beforeEach(() => {
    vi.clearAllMocks();
    PersonaService.loadForContext.mockResolvedValue([]);
    createSimpleSearchableSelect = vi.fn();
    window.formSystem = { createSimpleSearchableSelect };

    vi.spyOn(skripteService, 'loadUnternehmen').mockResolvedValue([
      { id: 'u1', firmenname: 'Acme', branche_id: 'b1' }
    ]);
    vi.spyOn(skripteService, 'loadMarken').mockResolvedValue([
      { id: 'm1', markenname: 'Brand', branche_id: 'b2' }
    ]);
    vi.spyOn(skripteService, 'loadKampagnen').mockResolvedValue([
      { id: 'k1', kampagnenname: 'Sommer' }
    ]);
    vi.spyOn(skripteService, 'loadProdukte').mockResolvedValue([
      { id: 'pr1', name: 'Serum' }
    ]);
    vi.spyOn(skripteService, 'loadBriefings').mockResolvedValue([
      { id: 'br1', aktivierung_name: 'Launch', bereich: null }
    ]);
    vi.spyOn(skripteService, 'loadBranchen').mockResolvedValue([
      { id: 'b1', name: 'Beauty' },
      { id: 'b2', name: 'Food' }
    ]);
    vi.spyOn(skripteService, 'loadAktiveDna').mockResolvedValue([]);
    vi.spyOn(skripteService, 'loadStrategieItems').mockResolvedValue([]);
    vi.spyOn(skripteService, 'loadPersonas').mockResolvedValue([
      { id: 'global', name: 'DNA-Global', oberbegriff: 'Alle' }
    ]);

    root = document.createElement('div');
    document.body.appendChild(root);
    form = new SkriptGeneratorForm({ prefix: PREFIX });
  });

  afterEach(() => {
    root?.remove();
    delete window.formSystem;
    vi.restoreAllMocks();
  });

  describe('Persona-Kaskade', () => {
    it('laedt Personas nicht global und haelt den Select ohne Unternehmen disabled', async () => {
      await form.render(root);

      const select = form.el('persona');
      expect(select.disabled).toBe(true);
      expect(select.innerHTML).toContain('Erst Unternehmen');
      expect(PersonaService.loadForContext).not.toHaveBeenCalled();
      expect(skripteService.loadPersonas).not.toHaveBeenCalled();
    });

    it('filtert nach Unternehmen, mit Marke nur die der Marke', async () => {
      PersonaService.loadForContext
        .mockResolvedValueOnce([
          { id: 'p1', name: 'Lea', oberbegriff: 'Busy Mom' }
        ])
        .mockResolvedValueOnce([
          { id: 'p2', name: 'Mia', oberbegriff: 'Brand-Persona' }
        ]);

      await form.render(root);
      form.el('unternehmen').value = 'u1';
      await form.onUnternehmenChange();

      expect(PersonaService.loadForContext).toHaveBeenCalledWith({ unternehmenId: 'u1' });
      expect(form.el('persona').disabled).toBe(false);
      expect(form.el('persona').innerHTML).toContain('p1');
      expect(form.el('persona').innerHTML).not.toContain('global');

      form.el('marke').value = 'm1';
      await form.onMarkeChange();

      expect(PersonaService.loadForContext).toHaveBeenLastCalledWith({ markeId: 'm1' });
      expect(form.el('persona').innerHTML).toContain('p2');
      expect(form.el('persona').innerHTML).not.toContain('p1');
    });
  });

  describe('Searchable Selects', () => {
    it('wrappt nach render alle Kontextfelder inkl. disabled-Abhaengige', async () => {
      await form.render(root);

      for (const name of SEARCHABLE_FIELDS) {
        expect(lastCallFor(createSimpleSearchableSelect, name), name).toBeTruthy();
      }

      expect(lastCallFor(createSimpleSearchableSelect, 'unternehmen')[2].placeholder)
        .toBe('Unternehmen suchen…');
      expect(lastCallFor(createSimpleSearchableSelect, 'branche')[2].placeholder)
        .toBe('Branche suchen…');
      expect(optionValues(createSimpleSearchableSelect, 'unternehmen')).toContain('u1');
      expect(optionValues(createSimpleSearchableSelect, 'branche')).toEqual(['', 'b1', 'b2']);
      expect(optionValues(createSimpleSearchableSelect, 'marke')).toEqual(['']);
      expect(lastCallFor(createSimpleSearchableSelect, 'marke')[1][0].label)
        .toBe('– Erst Unternehmen wählen –');

      const dnaCalls = createSimpleSearchableSelect.mock.calls
        .filter(([select]) => select?.id === `${PREFIX}-dna`);
      expect(dnaCalls).toHaveLength(0);
    });

    it('reinitiiert Abhaengige nach Unternehmenwahl als enabled Searchable', async () => {
      PersonaService.loadForContext.mockResolvedValue([
        { id: 'p1', name: 'Lea', oberbegriff: 'Busy Mom' }
      ]);

      await form.render(root);
      createSimpleSearchableSelect.mockClear();

      form.el('unternehmen').value = 'u1';
      await form.onUnternehmenChange();

      expect(form.el('marke').disabled).toBe(false);
      expect(form.el('kampagne').disabled).toBe(false);
      expect(form.el('produkt').disabled).toBe(false);
      expect(form.el('persona').disabled).toBe(false);
      expect(form.el('briefing').disabled).toBe(false);

      expect(optionValues(createSimpleSearchableSelect, 'marke')).toContain('m1');
      expect(optionValues(createSimpleSearchableSelect, 'kampagne')).toContain('k1');
      expect(optionValues(createSimpleSearchableSelect, 'produkt')).toContain('pr1');
      expect(optionValues(createSimpleSearchableSelect, 'persona')).toContain('p1');
      expect(optionValues(createSimpleSearchableSelect, 'briefing')).toContain('br1');

      expect(lastCallFor(createSimpleSearchableSelect, 'marke')[2].placeholder)
        .toBe('Marke suchen…');
      expect(lastCallFor(createSimpleSearchableSelect, 'kampagne')[2].placeholder)
        .toBe('Kampagne suchen…');
      expect(lastCallFor(createSimpleSearchableSelect, 'produkt')[2].placeholder)
        .toBe('Produkt suchen…');
      expect(lastCallFor(createSimpleSearchableSelect, 'persona')[2].placeholder)
        .toBe('Persona suchen…');
      expect(lastCallFor(createSimpleSearchableSelect, 'briefing')[2].placeholder)
        .toBe('Briefing suchen…');
    });

    it('setzt die Branche aus Unternehmen und Marke am sichtbaren Select', async () => {
      await form.render(root);

      form.el('unternehmen').value = 'u1';
      await form.onUnternehmenChange();
      expect(form.el('branche').value).toBe('b1');

      form.el('marke').value = 'm1';
      await form.onMarkeChange();
      expect(form.el('branche').value).toBe('b2');
    });
  });

  describe('Vorlagen-Picker', () => {
    it('laedt das volle Item (mit Transkript) erst beim Select nach', async () => {
      vi.spyOn(skripteService, 'loadStrategieItem').mockResolvedValue({
        id: 'i1',
        beschreibung: 'Vorlage',
        video_link: 'https://tiktok.com/x',
        transkript: 'Hook. Teil. CTA.',
        caption: 'Caption'
      });

      await form.render(root);
      form.strategieItems = [{ id: 'i1', beschreibung: 'Vorlage', video_link: 'https://tiktok.com/x' }];
      const sel = form.el('ref-item');
      sel.innerHTML = '<option value="">–</option><option value="i1">Vorlage</option>';
      sel.disabled = false;
      sel.value = 'i1';
      await form.onRefItemChange();

      expect(skripteService.loadStrategieItem).toHaveBeenCalledWith('i1');
      expect(form.el('ref-transkript').value).toBe('Hook. Teil. CTA.');
      expect(form.el('ref-caption').value).toBe('Caption');
    });

    it('faellt auf das Picker-Item zurueck, wenn der Nachlade-Call fehlschlaegt', async () => {
      vi.spyOn(skripteService, 'loadStrategieItem').mockRejectedValue(new Error('boom'));

      await form.render(root);
      form.strategieItems = [{ id: 'i1', beschreibung: 'Vorlage', video_link: 'https://tiktok.com/x' }];
      const sel = form.el('ref-item');
      sel.innerHTML = '<option value="">–</option><option value="i1">Vorlage</option>';
      sel.disabled = false;
      sel.value = 'i1';
      await form.onRefItemChange();

      expect(form.el('idee').value).toBe('Vorlage');
      expect(form.el('ref-transkript').value).toBe('');
    });

    it('refetcht Strategie-Vorlagen beim Markenwechsel nur, wenn die Kampagne kippt', async () => {
      await form.render(root);
      form.el('unternehmen').value = 'u1';
      await form.onUnternehmenChange();
      skripteService.loadStrategieItems.mockClear();

      // Kampagne bleibt ausgewaehlt und existiert nach dem Reload noch
      form.el('kampagne').value = 'k1';
      form.el('marke').value = 'm1';
      await form.onMarkeChange();
      expect(skripteService.loadStrategieItems).not.toHaveBeenCalled();

      // Kampagne ist nach dem Reload nicht mehr gueltig -> Vorlagen neu
      skripteService.loadKampagnen.mockResolvedValue([]);
      form.el('marke').value = '';
      await form.onMarkeChange();
      expect(skripteService.loadStrategieItems).not.toHaveBeenCalled();
      // (kein kampagneId -> loadStrategieVorlagen laeuft ohne Query und leert den Picker)
      expect(optionValues(createSimpleSearchableSelect, 'ref-item')).toEqual(['']);
    });
  });

  describe('Bereich + Briefing-Vorgaben', () => {
    function chooseBriefing(briefing) {
      form.briefings = [briefing];
      const briefingSel = form.el('briefing');
      briefingSel.innerHTML = `<option value=""></option><option value="${briefing.id}">${briefing.aktivierung_name}</option>`;
      briefingSel.disabled = false;
      briefingSel.value = briefing.id;
      form.onBriefingChange();
    }

    it('setzt Bereich aus dem Briefing und nimmt ihn ins Payload', async () => {
      await form.render(root);
      chooseBriefing({ id: 'br1', aktivierung_name: 'Launch', bereich: 'paid_creator_ads' });
      form.el('unternehmen').value = 'u1';
      form.el('idee').value = 'Airfryer-Hook';

      expect(form.el('bereich').value).toBe('paid_creator_ads');
      const payload = form.getPayload();
      expect(payload.bereich).toBe('paid_creator_ads');
      expect(payload).not.toHaveProperty('modus');
    });

    it('laesst manuelle Bereich-Ueberschreibung zu', async () => {
      await form.render(root);
      chooseBriefing({ id: 'br1', aktivierung_name: 'Launch', bereich: 'owned_social' });
      form.el('unternehmen').value = 'u1';
      form.el('idee').value = 'Idee';
      form.el('bereich').value = 'influencer_marketing';

      expect(form.getPayload().bereich).toBe('influencer_marketing');
    });

    it('wirft ohne Bereich', async () => {
      await form.render(root);
      form.el('unternehmen').value = 'u1';
      form.el('idee').value = 'Idee';
      form.el('bereich').value = '';
      expect(() => form.getPayload()).toThrow(/Bereich/);
    });

    it('mappt PA-Laenge/Funnel, disabled sie und schickt sie im Payload', async () => {
      await form.render(root);
      chooseBriefing({
        id: 'br1',
        aktivierung_name: 'Launch',
        bereich: 'paid_creator_ads',
        pa_videolaengen: ['30s'],
        pa_funnel_stufen: ['upper']
      });
      form.el('unternehmen').value = 'u1';
      form.el('idee').value = 'Idee';

      expect(form.el('laenge').value).toBe('15-30');
      expect(form.el('funnel').value).toBe('top');
      expect(form.el('laenge').disabled).toBe(true);
      expect(form.el('funnel').disabled).toBe(true);
      const payload = form.getPayload();
      expect(payload.video_laenge).toBe('15-30');
      expect(payload.funnel_stufe).toBe('top');
    });

    it('parst IM-Freitext-Laenge und sperrt die Felder', async () => {
      await form.render(root);
      chooseBriefing({
        id: 'br1',
        aktivierung_name: 'Launch',
        bereich: 'influencer_marketing',
        im_formatvorgaben: { videolaenge: '30-60 Sek.' },
        im_funnel_stufen: ['mid']
      });

      expect(form.el('laenge').value).toBe('45-60');
      expect(form.el('funnel').value).toBe('mid');
      expect(form.el('laenge').disabled).toBe(true);
      expect(form.el('funnel').disabled).toBe(true);
    });

    it('laesst Laenge/Funnel nach Briefing-Abwahl wieder enabled, Werte bleiben', async () => {
      await form.render(root);
      chooseBriefing({
        id: 'br1',
        aktivierung_name: 'Launch',
        bereich: 'paid_creator_ads',
        pa_videolaengen: ['30s'],
        pa_funnel_stufen: ['upper']
      });
      expect(form.el('laenge').disabled).toBe(true);

      form.el('briefing').value = '';
      form.onBriefingChange();

      expect(form.el('laenge').disabled).toBe(false);
      expect(form.el('funnel').disabled).toBe(false);
      expect(form.el('laenge').value).toBe('15-30');
      expect(form.el('funnel').value).toBe('top');
      expect(form.el('laenge').querySelector('option[value=""]').textContent)
        .toBe('– Keine Vorgabe –');
    });

    it('setzt leeren Platzhalter wenn das Briefing keine Vorgabe hat', async () => {
      await form.render(root);
      chooseBriefing({
        id: 'br1',
        aktivierung_name: 'Launch',
        bereich: 'owned_social'
      });

      expect(form.el('laenge').value).toBe('');
      expect(form.el('funnel').value).toBe('');
      expect(form.el('laenge').disabled).toBe(true);
      expect(form.el('funnel').disabled).toBe(true);
      expect(form.el('laenge').querySelector('option[value=""]').textContent)
        .toBe('– Keine Vorgabe im Briefing –');
      expect(form.el('funnel').querySelector('option[value=""]').textContent)
        .toBe('– Keine Vorgabe im Briefing –');
    });
  });
});
