// Masterliste-Detail: Creator hinzufuegen (Datenbank, Links, Formular),
// Instagram-Abruf ueber den Creator-Pool und "Creator anlegen".

import { CreatorFormDrawer } from './CreatorFormDrawer.js';
import { SelectionBar } from '../../core/list/SelectionBar.js';
import { CREATOR_TYP_OPTIONS } from '../creator-auswahl/creatorTypeOptions.js';
import { creatorAuswahlService } from '../creator-auswahl/CreatorAuswahlService.js';
import { ladeCreatorFuerHandles } from '../creator-auswahl/castingCreatorVerknuepfung.js';
import { normalizedInstagramUrl } from '../creator-auswahl/instagramDrawerFill.js';
import { connectInstagramSilent } from '../../core/ActionsDropdownEffects.js';
import {
  canManageMasterliste,
  escapeHtml,
  leseMasterlisteLinks,
  quickAddText,
  teileHandlesAuf,
  verknuepfbareMember
} from './masterliste.js';
import { eintragAusFormular, prefillOhneDatensatz } from './masterlisteEintrag.js';

export function installMasterlisteEintraege(proto) {
  Object.assign(proto, {
    /** Eintraege ohne Creator mit dem CRM-Creator verknuepfen, dem der Handle eindeutig gehoert. */
    async verknuepfeOffene() {
      if (!canManageMasterliste()) return false;
      const offen = this.members.filter(member => !member.hatDatensatz && member.igUsername);
      if (!offen.length) return false;
      try {
        const creators = await ladeCreatorFuerHandles(offen.map(member => member.igUsername));
        const links = verknuepfbareMember(this.members, creators);
        const results = await Promise.all(links.map(link =>
          window.supabase.from('creator_list_member').update({ creator_id: link.creatorId }).eq('id', link.memberId)
        ));
        return results.some(result => !result.error);
      } catch (error) {
        console.warn('Masterliste: Verknüpfung mit Stammdaten fehlgeschlagen', error);
        return false;
      }
    },

    nextPosition() {
      return this.members.reduce((max, member) => Math.max(max, member.position ?? -1), -1) + 1;
    },

    /** true, wenn der Creator auf der Liste steht und der Drawer zu ist. */
    async addMember(creatorId) {
      const { error } = await window.supabase.from('creator_list_member').insert({
        list_id: this.listId,
        creator_id: creatorId,
        added_at: new Date().toISOString(),
        position: this.nextPosition()
      });
      if (error) {
        const schonDabei = error.code === '23505';
        window.toastSystem?.show(
          schonDabei ? 'Creator ist schon auf dieser Masterliste.' : 'Hinzufügen fehlgeschlagen.',
          schonDabei ? 'warning' : 'error'
        );
        return false;
      }
      window.toastSystem?.show('Creator hinzugefügt.', 'success');
      this.closeDrawers();
      await this.load();
      await this.customColumns.loadValues(this.members.map(member => member.memberId).filter(Boolean));
      this.renderShell();
      return true;
    },

    /**
     * Ein oder mehrere Instagram-Links auf die Liste setzen. true, wenn Zeilen
     * angelegt wurden und der Drawer zu ist; der Instagram-Abruf laeuft danach weiter.
     */
    async addLinks(raw) {
      if (!canManageMasterliste() || this._addLinksBusy) return false;
      const { handles, ungueltig } = leseMasterlisteLinks(raw);
      if (!handles.length) {
        window.toastSystem?.show('Bitte Instagram-Profil-Links einfügen (kein Reel oder Post)', 'info');
        return false;
      }

      this._addLinksBusy = true;
      try {
        const creators = await ladeCreatorFuerHandles(handles);
        const { schonDabei, crmTreffer, neu } = teileHandlesAuf(handles, this.members, creators);
        const addedAt = new Date().toISOString();
        let position = this.nextPosition();
        const rows = [
          ...crmTreffer.map(({ creator }) => ({ list_id: this.listId, creator_id: creator.id, added_at: addedAt, position: position++ })),
          ...neu.map(handle => ({ list_id: this.listId, ig_username: handle, added_at: addedAt, position: position++ }))
        ];

        const text = quickAddText({
          hinzugefuegt: rows.length,
          verknuepft: crmTreffer.length,
          schonDabei: schonDabei.length,
          ungueltig: ungueltig.length
        });
        if (!rows.length) {
          window.toastSystem?.show(text, 'info');
          return false;
        }

        const { data, error } = await window.supabase
          .from('creator_list_member')
          .insert(rows)
          .select('id, ig_username, creator_id');
        if (error) throw error;
        window.toastSystem?.show(text, 'success');
        this.closeDrawers();
        await this.refreshMembers();

        const offen = (data || []).filter(entry => !entry.creator_id && entry.ig_username);
        this._igWarteschlange = this._igWarteschlange
          .then(() => this.ladeInstagramFuer(offen))
          .catch(error => console.warn('Masterliste: Instagram-Abruf abgebrochen', error));
        return true;
      } catch (error) {
        console.error('Masterliste: Hinzufügen per Link fehlgeschlagen', error);
        window.toastSystem?.show(
          error?.code === '23505' ? 'Creator ist schon auf dieser Masterliste.' : 'Hinzufügen fehlgeschlagen.',
          error?.code === '23505' ? 'warning' : 'error'
        );
        return false;
      } finally {
        this._addLinksBusy = false;
      }
    },

    /**
     * Tab "Neuer Creator": Eintrag mit eigenen Werten. Mit Instagram-Link haengt er
     * am Handle (oder am Creator, dem der Handle gehoert), ohne Link nur an den Werten.
     */
    async addEintrag(values) {
      if (!canManageMasterliste() || this._addLinksBusy) return false;
      const ergebnis = eintragAusFormular(values, { erlaubteTypen: CREATOR_TYP_OPTIONS });
      if (ergebnis.fehler) {
        window.toastSystem?.show(ergebnis.fehler, 'error');
        return false;
      }

      this._addLinksBusy = true;
      try {
        const basis = { list_id: this.listId, added_at: new Date().toISOString(), position: this.nextPosition() };
        let row = { ...basis, ...ergebnis.werte };
        let meldung = 'Creator hinzugefügt.';
        if (ergebnis.handle) {
          const creators = await ladeCreatorFuerHandles([ergebnis.handle]);
          const { schonDabei, crmTreffer } = teileHandlesAuf([ergebnis.handle], this.members, creators);
          if (schonDabei.length) {
            window.toastSystem?.show('Dieser Creator steht schon auf der Liste', 'info');
            return false;
          }
          if (crmTreffer.length) {
            row = { ...basis, creator_id: crmTreffer[0].creator.id };
            meldung = 'Creator aus den Stammdaten verknüpft.';
          } else {
            row.ig_username = ergebnis.handle;
          }
        }

        const { data, error } = await window.supabase
          .from('creator_list_member')
          .insert(row)
          .select('id, ig_username, creator_id')
          .single();
        if (error) throw error;
        window.toastSystem?.show(meldung, 'success');
        this.closeDrawers();
        await this.refreshMembers();

        if (data && !data.creator_id && data.ig_username) {
          this._igWarteschlange = this._igWarteschlange
            .then(() => this.ladeInstagramFuer([data]))
            .catch(error => console.warn('Masterliste: Instagram-Abruf abgebrochen', error));
        }
        return true;
      } catch (error) {
        console.error('Masterliste: Neuer Creator fehlgeschlagen', error);
        window.toastSystem?.show(
          error?.code === '23505' ? 'Creator ist schon auf dieser Masterliste.' : 'Hinzufügen fehlgeschlagen.',
          error?.code === '23505' ? 'warning' : 'error'
        );
        return false;
      } finally {
        this._addLinksBusy = false;
      }
    },

    /** Leiste unten wie im Casting: Link(s) einfügen oder aus der Datenbank wählen. */
    mountLinkBar() {
      this.linkBar?.destroy();
      this.linkBar = null;
      if (!canManageMasterliste()) return;
      this.linkBar = new SelectionBar({
        id: 'masterliste-link-bar',
        onAction: (name, event) => {
          if (name === 'masterliste-links') this.submitLinkBar(event.target.elements?.links);
          else if (name === 'masterliste-aus-db') this.openAddDrawer('database');
        }
      });
      this.linkBar.mount('', {
        idleHtml: `
          <form data-selection-form="masterliste-links" autocomplete="off" novalidate>
            <input id="masterliste-link-input" name="links" type="text" class="form-input"
                   placeholder="Instagram-Link(s) einfügen" aria-label="Instagram-Link(s) einfügen">
            <button type="submit" class="mdc-btn mdc-btn--sm">Hinzufügen</button>
            <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-selection-action="masterliste-aus-db">Aus Datenbank</button>
          </form>
        `
      });
    },

    async submitLinkBar(input) {
      if (!input || input.disabled) return;
      input.disabled = true;
      try {
        if (await this.addLinks(input.value)) input.value = '';
      } finally {
        input.disabled = false;
        if (input.isConnected) input.focus();
      }
    },

    /** Nacheinander wegen des Meta-Limits; ein Fehler stoppt die uebrigen Abrufe nicht. */
    async ladeInstagramFuer(rows) {
      let fehlgeschlagen = 0;
      for (const row of rows) {
        if (!await this.ladeInstagram(row.id, row.ig_username)) fehlgeschlagen += 1;
        await this.refreshMembers();
      }
      if (fehlgeschlagen) {
        window.toastSystem?.show(
          fehlgeschlagen === 1
            ? 'Instagram konnte für einen Eintrag nicht geladen werden'
            : `Instagram konnte für ${fehlgeschlagen} Einträge nicht geladen werden`,
          'warning'
        );
      }
    },

    /** Instagram-Abruf ueber den Creator-Pool. true, wenn der Eintrag danach am Pool haengt. */
    async ladeInstagram(memberId, handle) {
      try {
        const result = await creatorAuswahlService.previewInstagramStats(normalizedInstagramUrl(handle));
        const poolId = result?.fields?.sourcing_creator_id;
        if (!poolId) return false;
        const { error } = await window.supabase
          .from('creator_list_member')
          .update({ sourcing_creator_id: poolId })
          .eq('id', memberId);
        if (error) throw error;
        return true;
      } catch (error) {
        console.warn(`Masterliste: Instagram-Abruf für @${handle} fehlgeschlagen`, error);
        return false;
      }
    },

    async instagramNeuLaden(memberId) {
      const member = this.members.find(item => item.memberId === memberId);
      if (!member?.igUsername || !canManageMasterliste()) return;
      window.toastSystem?.show('Instagram-Daten werden geladen...', 'info');
      const ok = await this.ladeInstagram(memberId, member.igUsername);
      window.toastSystem?.show(
        ok ? 'Instagram-Daten geladen' : 'Instagram konnte nicht geladen werden',
        ok ? 'success' : 'error'
      );
      if (ok) await this.refreshMembers();
    },

    openCreatorAnlegen(memberId) {
      const member = this.members.find(item => item.memberId === memberId);
      if (!member || member.hatDatensatz || !canManageMasterliste()) return;
      new CreatorFormDrawer().open({
        prefill: prefillOhneDatensatz(member),
        originalFollowers: {
          instagram: member.pool?.follower_instagram ?? member.eigen?.follower_instagram ?? null,
          tiktok: member.eigen?.follower_tiktok ?? null
        },
        extraInsert: { profilbild_url: member.pool?.profile_image_url || null },
        onCreated: async (creator) => {
          const ok = await this.verknuepfeMember(memberId, creator.id);
          if (ok && creator.instagram) void connectInstagramSilent(creator.id);
        },
        onUseExisting: async (creatorId) => {
          if (await this.verknuepfeMember(memberId, creatorId)) {
            window.toastSystem?.show('Bestehenden Creator verknüpft', 'success');
          }
        }
      });
    },

    async verknuepfeMember(memberId, creatorId) {
      const { error } = await window.supabase
        .from('creator_list_member')
        .update({ creator_id: creatorId })
        .eq('id', memberId);
      if (error) {
        const schonDabei = error.code === '23505';
        window.toastSystem?.show(
          schonDabei ? 'Dieser Creator steht schon auf der Masterliste.' : 'Verknüpfen fehlgeschlagen.',
          schonDabei ? 'warning' : 'error'
        );
        return false;
      }
      await this.refreshMembers();
      return true;
    },

    async removeMember(memberId) {
      const member = this.members.find(item => item.memberId === memberId);
      if (!member) return;
      let confirmed = false;
      if (window.confirmationModal) {
        const result = await window.confirmationModal.open({
          title: 'Creator entfernen',
          message: `${escapeHtml(member?.creator?.name || 'Dieser Creator')} wird nur von dieser Masterliste genommen.`,
          confirmText: 'Entfernen',
          cancelText: 'Abbrechen',
          danger: true
        });
        confirmed = result?.confirmed;
      } else {
        confirmed = confirm('Creator von dieser Masterliste nehmen?');
      }
      if (!confirmed) return;
      const { error } = await window.supabase
        .from('creator_list_member')
        .delete()
        .eq('list_id', this.listId)
        .eq('id', memberId);
      if (error) {
        window.toastSystem?.show('Entfernen fehlgeschlagen.', 'error');
        return;
      }
      this.members = this.members.filter(item => item.memberId !== memberId);
      window.toastSystem?.show('Creator von der Masterliste genommen.', 'success');
      this.renderTable();
    }
  });
}
