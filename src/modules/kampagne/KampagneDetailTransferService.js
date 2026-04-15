// KampagneDetailTransferService.js
// Überträgt Kampagnenart-spezifische Daten zu auftrag_details

export async function transferKampagneDataToAuftragsdetails(submitData, kampagneId, auftragIdFallback) {
  try {
    const auftragId = submitData.auftrag_id || auftragIdFallback;
    if (!auftragId) {
      console.log('ℹ️ Keine auftrag_id - Auftragsdetails-Transfer übersprungen');
      return;
    }

    console.log('🔄 Starte Transfer Kampagnendaten → Auftragsdetails');

    const { KAMPAGNENARTEN_MAPPING } = await import('../auftrag/logic/KampagnenartenMapping.js');

    const auftragsDetailsUpdate = {};
    let gesamtVideos = 0;
    let gesamtCreator = 0;

    for (const [, config] of Object.entries(KAMPAGNENARTEN_MAPPING)) {
      const { prefix, hasCreator, hasBilder, hasVideographen } = config;

      const videoKey = `${prefix}_video_anzahl`;
      if (submitData[videoKey] !== undefined && submitData[videoKey] !== '') {
        const videoAnzahl = parseInt(submitData[videoKey], 10) || 0;
        auftragsDetailsUpdate[videoKey] = videoAnzahl;
        gesamtVideos += videoAnzahl;
      }

      if (hasCreator) {
        const creatorKey = `${prefix}_creator_anzahl`;
        if (submitData[creatorKey] !== undefined && submitData[creatorKey] !== '') {
          const creatorAnzahl = parseInt(submitData[creatorKey], 10) || 0;
          auftragsDetailsUpdate[creatorKey] = creatorAnzahl;
          gesamtCreator += creatorAnzahl;
        }
      }

      if (hasBilder) {
        const bilderKey = `${prefix}_bilder_anzahl`;
        if (submitData[bilderKey] !== undefined && submitData[bilderKey] !== '') {
          auftragsDetailsUpdate[bilderKey] = parseInt(submitData[bilderKey], 10) || 0;
        }
      }

      if (hasVideographen) {
        const videographenKey = `${prefix}_videographen_anzahl`;
        if (submitData[videographenKey] !== undefined && submitData[videographenKey] !== '') {
          auftragsDetailsUpdate[videographenKey] = parseInt(submitData[videographenKey], 10) || 0;
        }
      }
    }

    if (Object.keys(auftragsDetailsUpdate).length === 0) {
      console.log('ℹ️ Keine Kampagnenart-Felder zu übertragen');
      return;
    }

    auftragsDetailsUpdate.gesamt_videos = gesamtVideos;
    auftragsDetailsUpdate.gesamt_creator = gesamtCreator;

    console.log('📊 Auftragsdetails-Update Daten:', auftragsDetailsUpdate);

    const { data: existingDetails, error: checkError } = await window.supabase
      .from('auftrag_details')
      .select('id')
      .eq('auftrag_id', auftragId)
      .maybeSingle();

    if (checkError) {
      console.error('❌ Fehler beim Prüfen der Auftragsdetails:', checkError);
      return;
    }

    if (existingDetails) {
      const { data: alleKampagnen, error: kampError } = await window.supabase
        .from('kampagne')
        .select('*')
        .eq('auftrag_id', auftragId);

      if (kampError) {
        console.error('❌ Fehler beim Laden aller Kampagnen:', kampError);
        return;
      }

      const aggregatedData = {};
      let totalVideos = 0;
      let totalCreator = 0;

      for (const kamp of (alleKampagnen || [])) {
        for (const [, config] of Object.entries(KAMPAGNENARTEN_MAPPING)) {
          const { prefix, hasCreator, hasBilder, hasVideographen } = config;

          const videoKey = `${prefix}_video_anzahl`;
          const videoVal = parseInt(kamp[videoKey], 10) || 0;
          aggregatedData[videoKey] = (aggregatedData[videoKey] || 0) + videoVal;
          totalVideos += videoVal;

          if (hasCreator) {
            const creatorKey = `${prefix}_creator_anzahl`;
            const creatorVal = parseInt(kamp[creatorKey], 10) || 0;
            aggregatedData[creatorKey] = (aggregatedData[creatorKey] || 0) + creatorVal;
            totalCreator += creatorVal;
          }

          if (hasBilder) {
            const bilderKey = `${prefix}_bilder_anzahl`;
            aggregatedData[bilderKey] = (aggregatedData[bilderKey] || 0) + (parseInt(kamp[bilderKey], 10) || 0);
          }

          if (hasVideographen) {
            const videographenKey = `${prefix}_videographen_anzahl`;
            aggregatedData[videographenKey] = (aggregatedData[videographenKey] || 0) + (parseInt(kamp[videographenKey], 10) || 0);
          }
        }
      }

      aggregatedData.gesamt_videos = totalVideos;
      aggregatedData.gesamt_creator = totalCreator;

      const { error: updateError } = await window.supabase
        .from('auftrag_details')
        .update(aggregatedData)
        .eq('id', existingDetails.id);

      if (updateError) {
        console.error('❌ Fehler beim Update der Auftragsdetails:', updateError);
      } else {
        console.log('✅ Auftragsdetails aktualisiert (aggregiert):', aggregatedData);
      }
    } else {
      const newDetails = { auftrag_id: auftragId, ...auftragsDetailsUpdate };
      const { error: insertError } = await window.supabase
        .from('auftrag_details')
        .insert(newDetails);

      if (insertError) {
        console.error('❌ Fehler beim Erstellen der Auftragsdetails:', insertError);
      } else {
        console.log('✅ Auftragsdetails erstellt:', newDetails);
      }
    }
  } catch (error) {
    console.error('❌ Fehler beim Transfer der Kampagnendaten zu Auftragsdetails:', error);
  }
}
