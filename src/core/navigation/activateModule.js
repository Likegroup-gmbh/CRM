// Aktuelles Modul abbauen und das zur Route passende Modul starten.

export async function activateModule(registry, { navPath, segment, id, action, trail }) {
  if (registry.currentModule && registry.currentModule.destroy) {
    console.log(`🗑️ Zerstöre aktuelles Modul:`, registry.currentModule.constructor.name);
    registry.currentModule.destroy();
    registry.currentModule = null;
  }

  registry._globalCleanup();

  if (window.breadcrumbSystem?.setFromRoute) {
    window.breadcrumbSystem.setFromRoute(segment, id || null, { action: action || null, trail });
  }

  // Navigationsbereich (Haupt-Navigation vs. Accounting-Bereich) mit der Route
  // synchronisieren — auch bei Header-Buttons und Browser-Zurueck, die
  // nicht durch das NavigationSystem selbst laufen.
  window.navigationSystem?.syncWithRoute?.(navPath);

  let moduleKey = segment;
  let module = registry.modules.get(moduleKey);
  let isEditMode = action === 'edit';

  // Leeres Segment (Root-Pfad "/"): kein Navigate. main.js ruft separat loadDashboard() auf.
  if (!moduleKey) {
    return;
  }

  // Legacy-Redirects: /auftrag/new, /auftragsdetails/new, /kampagne/new → Wizard
  if (id === 'new' && (segment === 'auftrag' || segment === 'auftragsdetails' || segment === 'kampagne')) {
    return registry._redirect('/projekt-erstellen');
  }
  
  if (id && segment === 'creator' && id !== 'new') {
    moduleKey = 'creator-detail';
    module = registry.modules.get(moduleKey);
    console.log(`🎯 Creator-Details erkannt, verwende Modul: ${moduleKey}`);
  }

  if (segment === 'creator-lists' && id) {
    moduleKey = 'creator-list-detail';
    module = registry.modules.get(moduleKey);
    console.log('🎯 Creator-Listen-Detail erkannt');
  }

  if (id && segment === 'mitarbeiter' && id !== 'new') {
    moduleKey = 'mitarbeiter-detail';
    module = registry.modules.get(moduleKey);
    console.log(`🎯 Mitarbeiter-Details erkannt, verwende Modul: ${moduleKey}`);
  }

  if (id && (segment === 'kunden-admin') && id !== 'new') {
    moduleKey = 'kunden-detail';
    module = registry.modules.get(moduleKey);
    console.log(`🎯 Kunden-Admin-Details erkannt, verwende Modul: ${moduleKey}`);
  }

  if (id && segment === 'kunden-kooperation' && id !== 'new') {
    moduleKey = 'kunden-kooperation-detail';
    module = registry.modules.get(moduleKey);
    console.log('🎯 Kunden Kooperation-Detail erkannt');
  }
  
  if (id && segment === 'marke' && id !== 'new') {
    moduleKey = 'marke-detail';
    module = registry.modules.get(moduleKey);
    console.log(`🎯 Marken-Details erkannt, verwende Modul: ${moduleKey}`);
  }

  if (id && segment === 'unternehmen' && id !== 'new') {
    moduleKey = 'unternehmen-detail';
    module = registry.modules.get(moduleKey);
    console.log(`🎯 Unternehmen-Details erkannt, verwende Modul: ${moduleKey}`);
  }

  // Personas und Produkte gehoeren dem Unternehmen, lassen sich aber auch aus
  // einer Marke heraus anlegen. Beide Routen fuehren auf dasselbe Formular,
  // das seinen Besitzer-Kontext aus dem Pfad ableitet (OwnerContext.js).
  // Top-Level: /persona (Liste), /persona/new und /persona/:id (Standalone-Formular).
  if (segment === 'persona' && id) {
    moduleKey = 'persona-form';
    module = registry.modules.get(moduleKey);
    console.log(`🎯 Persona-Formular erkannt (standalone), verwende Modul: ${moduleKey}`);
    if (module) {
      registry.currentModule = module;
      registry._didInitModule = true;
      return module.init(id);
    }
  }

  // /:segment/:ownerId/persona bzw. ?persona=:id zum Bearbeiten
  if (id && id !== 'new' && (segment === 'marke' || segment === 'unternehmen') && action === 'persona') {
    moduleKey = 'persona-form';
    module = registry.modules.get(moduleKey);
    console.log(`🎯 Persona-Formular erkannt (${segment}), verwende Modul: ${moduleKey}`);
  }

  // Top-Level: /produkt (Liste), /produkt/new und /produkt/:id (Standalone-Formular).
  if (segment === 'produkt' && id) {
    moduleKey = 'produkt-form';
    module = registry.modules.get(moduleKey);
    console.log(`🎯 Produkt-Formular erkannt (standalone), verwende Modul: ${moduleKey}`);
    if (module) {
      registry.currentModule = module;
      registry._didInitModule = true;
      return module.init(id);
    }
  }

  // /:segment/:ownerId/produkt bzw. ?produkt=:id zum Bearbeiten
  if (id && id !== 'new' && (segment === 'marke' || segment === 'unternehmen') && action === 'produkt') {
    moduleKey = 'produkt-form';
    module = registry.modules.get(moduleKey);
    console.log(`🎯 Produkt-Formular erkannt (${segment}), verwende Modul: ${moduleKey}`);
  }

  if (segment === 'produkt' && id) {
    moduleKey = 'produkt-form';
    module = registry.modules.get(moduleKey);
    console.log(`🎯 Produkt-Formular erkannt (Liste${id === 'new' ? '' : '-Detail'}), verwende Modul: produkt-form`);
  }
  
  if (id === 'new' && segment === 'auftragsdetails') {
    return registry._redirect('/projekt-erstellen');
  }
  else if (id && segment === 'auftragsdetails' && id !== 'new' && action === 'edit') {
    // Wizard-Redirect: auftrag_id aus den Details laden, dann Wizard-Edit öffnen
    moduleKey = 'auftragsdetails-detail';
    module = registry.modules.get(moduleKey);
    console.log(`🎯 Auftragsdetails-Edit → Wizard-Redirect für ID: ${id}`);
    if (module) {
      registry.currentModule = module;
      try {
        const { data } = await window.supabase
          .from('auftrag_details')
          .select('auftrag_id')
          .eq('id', id)
          .single();
        if (data?.auftrag_id) {
          return registry._redirect(`/projekt-erstellen/edit/${data.auftrag_id}`);
        }
      } catch (e) {
        console.warn('⚠️ Auftragsdetails-Edit Wizard-Redirect fehlgeschlagen:', e);
      }
      return module.init?.(id);
    }
  }
  else if (id && segment === 'auftragsdetails' && id !== 'new') {
    moduleKey = 'auftragsdetails-detail';
    module = registry.modules.get(moduleKey);
    console.log(`🎯 Auftragsdetails-Details erkannt, verwende Modul: ${moduleKey}`);
  }
  
  // Auftrag/Contract-Edit laeuft ueber den Wizard. Das alte FormSystem-Formular
  // schreibt nur die auftrag-Zeile und laesst auftrag_teilrechnung unberuehrt,
  // wodurch Kundenrechnungen weiter die alten Teilrechnungsbetraege zeigen.
  else if (id && id !== 'new' && action === 'edit' && (segment === 'auftrag' || segment === 'contracts')) {
    return registry._redirect(`/projekt-erstellen/edit/${id.split('?')[0]}`);
  }

  else if (id && segment === 'auftrag' && id !== 'new') {
    moduleKey = 'auftrag-detail';
    module = registry.modules.get(moduleKey);
    console.log(`🎯 Auftrags-Details erkannt, verwende Modul: ${moduleKey}`);
  }
  
  if (id === 'new' && segment === 'kooperation') {
    moduleKey = 'kooperation';
    module = registry.modules.get(moduleKey);
    console.log(`🎯 Kooperations-Erstellung erkannt, verwende Modul: ${moduleKey}`);
  }
  else if (id && segment === 'kooperation' && id !== 'new') {
    moduleKey = 'kooperation-detail';
    module = registry.modules.get(moduleKey);
    console.log(`🎯 Kooperations-Details erkannt, verwende Modul: ${moduleKey}`);
  }

  const idCleanForVideo = id ? id.split('?')[0] : id;
  if (idCleanForVideo && segment === 'video' && idCleanForVideo !== 'new') {
    moduleKey = 'kooperation-video-detail';
    module = registry.modules.get(moduleKey);
    console.log(`🎯 Video-Details erkannt, verwende Modul: ${moduleKey}`);
  }
  
  if (id && segment === 'kampagne' && id !== 'new' && action === 'edit') {
    // Kampagne bearbeiten → Wizard via auftrag_id
    console.log(`🎯 Kampagne-Edit → Wizard-Redirect für Kampagne-ID: ${id}`);
    try {
      const { data } = await window.supabase
        .from('kampagne')
        .select('auftrag_id')
        .eq('id', id)
        .single();
      if (data?.auftrag_id) {
        return registry._redirect(`/projekt-erstellen/edit/${data.auftrag_id}?step=kampagnen`);
      }
    } catch (e) {
      console.warn('⚠️ Kampagne-Edit Wizard-Redirect fehlgeschlagen:', e);
    }
    moduleKey = 'kampagne-detail';
    module = registry.modules.get(moduleKey);
  }
  else if (id && segment === 'kampagne' && id !== 'new') {
    moduleKey = 'kampagne-detail';
    module = registry.modules.get(moduleKey);
    if (module) module._openAsProduktion = false;
    console.log(`🎯 Kampagnen-Details erkannt, verwende Modul: ${moduleKey}`);
  }

  if (id && segment === 'produktion' && id !== 'new') {
    moduleKey = 'kampagne-detail';
    module = registry.modules.get(moduleKey);
    if (module) module._openAsProduktion = true;
    console.log(`🎯 Produktion erkannt, verwende Modul: ${moduleKey}`);
  }

  if (id && segment === 'contracts' && id !== 'new') {
    moduleKey = 'contracts-detail';
    module = registry.modules.get(moduleKey);
    console.log(`🎯 Contract-Details erkannt, verwende Modul: ${moduleKey}`);
  }

  if (segment === 'contracts' && !id) {
    console.log(`🔄 /contracts → /auftrag (Contracts-Tab)`);
    moduleKey = 'auftrag';
    module = registry.modules.get(moduleKey);
    if (module) module._pendingTab = 'contracts';
  }
  
  if (segment === 'briefing' && id === 'new') {
    moduleKey = 'briefing-create';
    module = registry.modules.get(moduleKey);
    console.log(`🎯 Briefing-Generator erkannt, verwende Modul: ${moduleKey}`);
  }

  if (segment === 'briefing' && id && id !== 'new' && action === 'edit') {
    moduleKey = 'briefing-create';
    module = registry.modules.get(moduleKey);
    console.log(`🎯 Briefing-Bearbeitung erkannt, verwende Modul: ${moduleKey} mit ID: ${id}`);
  }

  if (id && segment === 'briefing' && id !== 'new' && action !== 'edit') {
    moduleKey = 'briefing-detail';
    module = registry.modules.get(moduleKey);
    console.log(`🎯 Briefing-Details erkannt, verwende Modul: ${moduleKey}`);
  }
  
  if (id && segment === 'rechnung' && id !== 'new') {
    moduleKey = 'rechnung-detail';
    module = registry.modules.get(moduleKey);
    console.log(`🎯 Rechnung-Details erkannt, verwende Modul: ${moduleKey}`);
  }
  
  if (id && segment === 'konzepte' && id !== 'new') {
    moduleKey = 'konzepte-detail';
    module = registry.modules.get(moduleKey);
    console.log(`🎯 Konzepte-Details erkannt, verwende Modul: ${moduleKey}`);
  }
  
  if (id && segment === 'castings' && id !== 'new') {
    moduleKey = 'castings-detail';
    module = registry.modules.get(moduleKey);
    console.log(`🎯 Castings-Details erkannt, verwende Modul: ${moduleKey}`);
  }
  
  if (id && segment === 'education') {
    moduleKey = 'education-detail';
    module = registry.modules.get(moduleKey);
    console.log(`🎯 Education-Artikel erkannt, verwende Modul: ${moduleKey}, slug: ${id}`);
  }

  if (id && segment === 'ansprechpartner') {
    moduleKey = 'ansprechpartner-detail';
    module = registry.modules.get(moduleKey);
    console.log(`🎯 Ansprechpartner-Details/Erstellung erkannt, verwende Modul: ${moduleKey}`);
  }

  // /management-ansprechpartner: gefilterte Ansprechpartner-Liste (mode='management')
  if (segment === 'management-ansprechpartner' && id === 'new') {
    moduleKey = 'management-ansprechpartner-create';
    module = registry.modules.get(moduleKey);
    console.log(`🎯 Management-Ansprechpartner-Erstellung erkannt, verwende Modul: ${moduleKey}`);
  } else if (segment === 'management-ansprechpartner' && id) {
    // Detail-Ansicht nutzt das gleiche AnsprechpartnerDetail
    moduleKey = 'ansprechpartner-detail';
    module = registry.modules.get(moduleKey);
    console.log(`🎯 Management-Ansprechpartner-Details, verwende Modul: ${moduleKey}`);
  }

  // /management-creator: gefilterte Creator-Liste (mode='management')
  if (segment === 'management-creator' && id) {
    // Detail-Ansicht nutzt das gleiche CreatorDetail
    moduleKey = 'creator-detail';
    module = registry.modules.get(moduleKey);
    console.log(`🎯 Management-Creator-Details, verwende Modul: ${moduleKey}`);
  }

  if (segment === 'management' && id === 'new') {
    moduleKey = 'management-create';
    module = registry.modules.get(moduleKey);
    console.log(`🎯 Management-Erstellung erkannt, verwende Modul: ${moduleKey}`);
  }

  if (id && segment === 'management' && id !== 'new') {
    moduleKey = 'management-detail';
    module = registry.modules.get(moduleKey);
    console.log(`🎯 Management-Details erkannt, verwende Modul: ${moduleKey}`);
  }
  
  if (segment === 'vertraege' && id === 'new') {
    moduleKey = 'vertraege-create';
    module = registry.modules.get(moduleKey);
    console.log(`🎯 Vertraege-Erstellung erkannt, verwende Modul: ${moduleKey}`);
  }

  if (segment === 'vertraege' && id && action === 'edit') {
    moduleKey = 'vertraege-create';
    module = registry.modules.get(moduleKey);
    console.log(`🎯 Vertraege-Bearbeitung erkannt, verwende Modul: ${moduleKey} mit ID: ${id}`);
  }

  if (segment === 'projekt-erstellen') {
    moduleKey = 'projekt-erstellen';
    module = registry.modules.get(moduleKey);
    console.log(`🎯 Projekt-Erstellen, verwende Modul: ${moduleKey}`);
    if (module) {
      registry.currentModule = module;
      // Edit-Routen: /projekt-erstellen/edit/:id ODER /projekt-erstellen/:id/edit
      const editId = (id === 'edit' && action)
        ? action
        : (id && id !== 'new' && action === 'edit' ? id : null);
      if (editId && module.initForEdit) {
        return module.initForEdit(editId);
      }
      if (module.init) {
        return module.init();
      }
    }
  }

  if (module) {
    console.log(`✅ Modul gefunden: ${moduleKey}`, module);
    registry.currentModule = module;
    registry._didInitModule = true;

    const effectiveId = id ? id.split('?')[0] : id;
    if (effectiveId === 'new') {
      if (segment === 'skripte') {
        return module.init?.('new');
      }
      if (segment === 'vertraege' || segment === 'briefing' || segment === 'produkt') {
        return module.init?.();
      }
      if (segment === 'rechnung') {
        moduleKey = 'rechnung-detail';
        module = registry.modules.get(moduleKey);
        return module.init?.('new');
      }
      console.log(`📝 Zeige Erstellungsformular für: ${segment}`);
      if (moduleKey.includes('-detail')) {
        return module.init?.('new');
      } else {
        return module.showCreateForm?.();
      }
    } else if (effectiveId) {
      if (isEditMode) {
        console.log(`✏️ Zeige Edit-Formular für: ${segment}/${id}`);
        if ((segment === 'vertraege' || segment === 'briefing') && module && module.init) {
          return module.init(effectiveId);
        }
        // Fast-Path: Wenn das Modul initForEdit implementiert, diesen direkt nutzen
        // (kein Detail-Render-Flash vor der Edit-Form).
        if (module && typeof module.initForEdit === 'function') {
          return module.initForEdit(effectiveId);
        }
        if (module && module.init) {
          module.init(effectiveId).then(() => {
            if (module.showEditForm) {
              module.showEditForm();
            }
          });
          return;
        }
      } else {
        console.log(`👁️ Zeige Details für: ${segment}/${id}`);
        if (segment === 'skripte') {
          return module.init?.(effectiveId, action || null);
        }
        return module.init?.(effectiveId);
      }
    } else {
      console.log(`🚀 Initialisiere Modul: ${segment}`);
      return module.init();
    }
  } else {
    console.warn(`❌ Modul nicht gefunden: ${moduleKey} - bleibe auf aktueller Seite`);
    return;
  }
}
