import { compressImage } from '../../ImageCompressor.js';

// Kapselt Relations- und File-Upload-Handler, die an bestimmte Entities gebunden sind.
// Wird von FormSystem per Delegation genutzt. Einige Methoden benötigen Zugriff auf den
// FormRenderer, daher wird dieser im Constructor injiziert.
export class FormRelationsHandler {
  constructor(renderer) {
    this.renderer = renderer;
  }

  // Kampagne: Adressen verarbeiten (löschen + neu einfügen)
  async handleKampagneAddresses(kampagneId, form) {
    try {
      const addressesContainer = form.querySelector('.addresses-list');
      if (!addressesContainer) return;

      const addressItems = addressesContainer.querySelectorAll('.address-item');
      const addresses = [];

      addressItems.forEach(item => {
        const addressId = item.dataset.addressId;
        const address = {
          kampagne_id: kampagneId,
          adressname: form.querySelector(`input[name="adressname_${addressId}"]`)?.value || '',
          strasse: form.querySelector(`input[name="strasse_${addressId}"]`)?.value || '',
          hausnummer: form.querySelector(`input[name="hausnummer_${addressId}"]`)?.value || '',
          plz: form.querySelector(`input[name="plz_${addressId}"]`)?.value || '',
          stadt: form.querySelector(`input[name="stadt_${addressId}"]`)?.value || '',
          land: form.querySelector(`input[name="land_${addressId}"]`)?.value || '',
          notiz: form.querySelector(`textarea[name="notiz_${addressId}"]`)?.value || ''
        };

        if (address.adressname.trim()) {
          addresses.push(address);
        }
      });

      if (addresses.length > 0) {
        await window.supabase
          .from('kampagne_adressen')
          .delete()
          .eq('kampagne_id', kampagneId);

        const { error } = await window.supabase
          .from('kampagne_adressen')
          .insert(addresses);

        if (error) {
          console.error('❌ Fehler beim Speichern der Adressen:', error);
        } else {
          console.log(`✅ ${addresses.length} Adressen für Kampagne ${kampagneId} gespeichert`);
        }
      }
    } catch (error) {
      console.error('❌ Fehler beim Verarbeiten der Kampagnen-Adressen:', error);
    }
  }

  // Adressen-Felder einrichten (Add-Button)
  setupAddressesFields(form) {
    const addressesContainers = form.querySelectorAll('.addresses-container');

    addressesContainers.forEach(container => {
      const addBtn = container.querySelector('.add-address-btn');
      const addressesList = container.querySelector('.addresses-list');

      if (addBtn && addressesList) {
        addBtn.addEventListener('click', () => {
          this.renderer.addAddressRow(addressesList);
        });
      }
    });
  }

  // Kooperation: Tags persistieren (alte löschen, neue upserten)
  async handleKooperationTags(kooperationId, form) {
    try {
      if (!window.supabase) return;
      const hiddenInputs = form.querySelectorAll('input[name="koop_tag_ids[]"]');
      const tagIds = Array.from(hiddenInputs).map(i => i.value).filter(Boolean);
      console.log('🏷️ handleKooperationTags:', kooperationId, 'tagIds:', tagIds);

      const { error: delError } = await window.supabase
        .from('kooperation_tags')
        .delete()
        .eq('kooperation_id', kooperationId);
      if (delError) console.error('❌ Fehler beim Löschen alter Koop-Tags:', delError);

      if (tagIds.length > 0) {
        const rows = tagIds.map(id => ({ kooperation_id: kooperationId, tag_id: id }));
        const { error } = await window.supabase
          .from('kooperation_tags')
          .upsert(rows, { onConflict: 'kooperation_id,tag_id', ignoreDuplicates: true });
        if (error) throw error;
        console.log('✅ Koop-Tags gespeichert:', tagIds.length);
      }
    } catch (error) {
      console.error('❌ Fehler in handleKooperationTags:', error);
    }
  }

  // Ansprechpartner: Profilbild hochladen (WebP, max 500KB), altes löschen, DB-Update
  async handleAnsprechpartnerProfileImage(ansprechpartnerId, form) {
    try {
      console.log('📋 handleAnsprechpartnerProfileImage() aufgerufen für:', ansprechpartnerId);

      const uploaderRoot = form.querySelector('.uploader[data-name="profile_image_file"]');

      if (!uploaderRoot || !uploaderRoot.__uploaderInstance || !uploaderRoot.__uploaderInstance.files.length) {
        console.log('ℹ️ Kein Profilbild zum Hochladen');
        return;
      }

      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar');
        return;
      }

      const files = uploaderRoot.__uploaderInstance.files;
      let file = files[0];
      const bucket = 'ansprechpartner-images';

      const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

      if (!ALLOWED_TYPES.includes(file.type)) {
        console.warn(`⚠️ Nicht erlaubter Dateityp: ${file.type}`);
        alert(`Nur PNG, JPG und WebP Dateien sind erlaubt`);
        return;
      }

      try {
        const originalSize = file.size;
        file = await compressImage(file);
        console.log(`🖼️ Profilbild komprimiert: ${Math.round(originalSize / 1024)}KB → ${Math.round(file.size / 1024)}KB (WebP)`);
      } catch (compressError) {
        console.warn('⚠️ Komprimierung fehlgeschlagen, nutze Original:', compressError);
      }

      const MAX_FILE_SIZE = 500 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        console.warn(`⚠️ Profilbild zu groß: ${(file.size / 1024).toFixed(2)} KB`);
        alert(`Profilbild ist zu groß (max. 500 KB)`);
        return;
      }

      const path = `${ansprechpartnerId}/profile.webp`;
      console.log(`📤 Uploading Profilbild: ${file.name} -> ${path}`);

      try {
        const { data: existingFiles } = await window.supabase.storage
          .from(bucket)
          .list(ansprechpartnerId);

        if (existingFiles && existingFiles.length > 0) {
          for (const existingFile of existingFiles) {
            await window.supabase.storage
              .from(bucket)
              .remove([`${ansprechpartnerId}/${existingFile.name}`]);
          }
        }
      } catch (deleteErr) {
        console.warn('⚠️ Fehler beim Löschen alter Profilbilder:', deleteErr);
      }

      const { error: upErr } = await window.supabase.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'image/webp'
        });

      if (upErr) {
        console.error(`❌ Upload-Fehler:`, upErr);
        throw upErr;
      }

      const { data: publicUrlData } = window.supabase.storage
        .from(bucket)
        .getPublicUrl(path);

      const profile_image_url = publicUrlData?.publicUrl || '';

      const { error: dbErr } = await window.supabase
        .from('ansprechpartner')
        .update({
          profile_image_url,
          profile_image_path: path
        })
        .eq('id', ansprechpartnerId);

      if (dbErr) {
        console.error(`❌ DB-Fehler:`, dbErr);
        throw dbErr;
      }

      console.log(`✅ Profilbild erfolgreich hochgeladen: ${profile_image_url}`);
    } catch (error) {
      console.error('❌ Profilbild-Upload fehlgeschlagen:', error);
    }
  }

  // Rechnung: Belege + PDF-Upload verarbeiten (alte löschen, neue hochladen, DB-Update)
  async handleRechnungFiles(rechnungId, form) {
    if (!window.supabase || !rechnungId) return;

    try {
      const belegeUploader = form.querySelector('.uploader[data-name="belege_files"]')?.__uploaderInstance;
      if (belegeUploader) {
        const deletedIds = belegeUploader.getDeletedFileIds().filter(id => id !== 'pdf');
        for (const belegId of deletedIds) {
          try {
            const { data: row } = await window.supabase
              .from('rechnung_belege')
              .select('file_path')
              .eq('id', belegId)
              .single();
            if (row?.file_path) {
              await window.supabase.storage.from('rechnung-belege').remove([row.file_path]);
            }
            await window.supabase.from('rechnung_belege').delete().eq('id', belegId);
          } catch (err) {
            console.warn('⚠️ Fehler beim Löschen eines Belegs:', err?.message);
          }
        }

        const newFiles = belegeUploader.files || [];
        for (const file of newFiles) {
          const sanitizedName = file.name
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .replace(/\.{2,}/g, '_')
            .substring(0, 200);
          const belegePath = `${rechnungId}/${Date.now()}_${Math.random().toString(36).slice(2)}_${sanitizedName}`;
          const { error: upErr } = await window.supabase.storage.from('rechnung-belege').upload(belegePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type
          });
          if (upErr) {
            console.warn('⚠️ Beleg-Upload fehlgeschlagen:', upErr.message);
            continue;
          }
          const { data: urlData } = window.supabase.storage.from('rechnung-belege').getPublicUrl(belegePath);
          await window.supabase.from('rechnung_belege').insert({
            rechnung_id: rechnungId,
            file_name: file.name,
            file_path: belegePath,
            file_url: urlData?.publicUrl || '',
            content_type: file.type,
            size: file.size,
            uploaded_by: window.currentUser?.id || null
          });
        }
      }

      const pdfUploader = form.querySelector('.uploader[data-name="pdf_file"]')?.__uploaderInstance;
      if (pdfUploader) {
        // Gelöschte PDFs aus rechnung_pdfs und Storage entfernen
        const deletedPdfIds = pdfUploader.getDeletedFileIds();
        for (const pdfId of deletedPdfIds) {
          try {
            const { data: row } = await window.supabase
              .from('rechnung_pdfs')
              .select('file_path')
              .eq('id', pdfId)
              .single();
            if (row?.file_path) {
              await window.supabase.storage.from('rechnungen').remove([row.file_path]);
            }
            await window.supabase.from('rechnung_pdfs').delete().eq('id', pdfId);
          } catch (err) {
            console.warn('⚠️ Fehler beim Löschen eines PDFs:', err?.message);
          }
        }

        // Neue PDFs hochladen und in rechnung_pdfs speichern
        const newPdfFiles = pdfUploader.files || [];
        for (const file of newPdfFiles) {
          const sanitizedName = file.name
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .replace(/\.{2,}/g, '_')
            .substring(0, 200);
          const { data: rechnungRow } = await window.supabase
            .from('rechnung')
            .select('unternehmen_id')
            .eq('id', rechnungId)
            .single();
          const pdfPath = `${rechnungRow?.unternehmen_id || 'unknown'}/${Date.now()}_${Math.random().toString(36).slice(2)}_${sanitizedName}`;
          const { error: upErr } = await window.supabase.storage.from('rechnungen').upload(pdfPath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type
          });
          if (upErr) {
            console.warn('⚠️ PDF-Upload fehlgeschlagen:', upErr.message);
            continue;
          }
          const { data: urlData } = window.supabase.storage.from('rechnungen').getPublicUrl(pdfPath);
          await window.supabase.from('rechnung_pdfs').insert({
            rechnung_id: rechnungId,
            file_name: file.name,
            file_path: pdfPath,
            file_url: urlData?.publicUrl || '',
            content_type: file.type,
            size: file.size,
            uploaded_by: window.currentUser?.id || null
          });
        }
      }
    } catch (error) {
      console.error('❌ Fehler bei Rechnungs-Dateien:', error);
    }
  }
}
