import"./modulepreload-polyfill-B5Qt9EMX.js";/* empty css                  */import{i as Ce,a as B,m as A,_ as x,b as z,c as J}from"./modules-N_JhTXHJ.js";import{a as P,b as j,p as Ne}from"./auth-DgPDu2lY.js";import"./core-C7Vz5Umf.js";const xe={SUPABASE:{URL:"https://yktycclozgsgaasduyol.supabase.co",KEY:"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrdHljY2xvemdzZ2Fhc2R1eW9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwODYzNTEsImV4cCI6MjA2ODY2MjM1MX0.6TM9Td6iKgmXV_fEPMJWZiD9n--X9TeNk0FoeL5B-9c"},APP:{NAME:"CRM Dashboard",VERSION:"2.0.0",DEBUG:!1,OFFLINE_MODE:!1},AUTH:{MIN_PASSWORD_LENGTH:4,MAX_LOGIN_ATTEMPTS:3,LOCKOUT_TIME:900*1e3},UI:{THEME:"light",LANGUAGE:"de",ANIMATIONS:!0}};typeof window<"u"&&(window.CONFIG=xe);class Re{constructor(){this.actionHandlers=new Map,this.moduleRegistry=null}setModuleRegistry(e){this.moduleRegistry=e}registerHandler(e,t){this.actionHandlers.set(e,t)}async executeAction(e,t,n,a){if(console.log(`🎯 ACTIONREGISTRY: Action ${e} für ${n} ${t}`),["edit","delete","notiz","add_ansprechpartner_unternehmen","remove_ansprechpartner_unternehmen","add_ansprechpartner_kampagne","remove_ansprechpartner_kampagne","add_ansprechpartner","marken","auftraege","kampagnen","assign_staff","assign-staff","add_to_list","add_to_campaign","video-create","bewerten","rechnung","invite","freischalten","set-role","set-field","assign-unternehmen","remove-unternehmen","assign-marke","remove-marke","rating","favorite"].includes(e))throw new Error(`${e}: Use legacy handler`);switch(e){case"view":if(!this.moduleRegistry)throw new Error("view: ModuleRegistry not set, use legacy handler");return this.handleView(n,t);case"details":case"auftrag-details":return this.handleDetails(n,t);case"quickview":throw new Error("quickview: Use legacy handler");default:const i=this.actionHandlers.get(e);return i?await i(t,n,a):this.dispatchActionEvent(e,t,n)}}handleView(e,t){this.moduleRegistry?this.moduleRegistry.navigateTo(`/${e}/${t}`):console.warn("ModuleRegistry nicht verfügbar")}handleEdit(e,t){this.moduleRegistry?this.moduleRegistry.navigateTo(`/${e}/${t}/edit`):console.warn("ModuleRegistry nicht verfügbar")}async handleDelete(e,t){const n=new CustomEvent("actionRequested",{detail:{action:"delete",entityType:e,entityId:t}});document.dispatchEvent(n)}async handleDetails(e,t){if(e==="auftrag"){const n=new CustomEvent("actionRequested",{detail:{action:"showDetails",entityType:"auftrag",entityId:t}});document.dispatchEvent(n)}}dispatchActionEvent(e,t,n){const a=new CustomEvent("actionRequested",{detail:{action:e,entityType:n,entityId:t}});document.dispatchEvent(a)}}const Q=new Re;class Ke{constructor(){this.dropdowns=new Map,this.boundEventListeners=new Set,this._iconObserver=null,this._normalizingIcons=!1,this.actionRegistry=Q,this.iconRegistry=Ce,this.actionBuilder=B}init(){console.log("🎯 ACTIONSDROPDOWN: Initialisiere ActionsDropdown"),this.bindGlobalEvents(),this.normalizeIcons(document),this.observeTableMutations(),setTimeout(()=>{console.log("🔍 ACTIONSDROPDOWN: Debug - Überprüfe Initialisierung"),console.log("🔍 ACTIONSDROPDOWN: window.ActionsDropdown verfügbar:",!!window.ActionsDropdown),console.log("🔍 ACTIONSDROPDOWN: createAuftragActions verfügbar:",!!window.ActionsDropdown?.createAuftragActions)},1e3)}getHeroIcon(e){return this.iconRegistry.get(e)}getStatusIcon(e){return this.iconRegistry.getStatusIcon(e)}async setField(e,t,n,a){try{if(console.log("⬆️ setField starte Update",{entityType:e,entityId:t,fieldName:n,fieldValue:a}),window.supabase){const r=window.dataService?.entities?.[e]?.table||e,i={[n]:a};window.dataService?.entities?.[e]?.fields?.updated_at&&(i.updated_at=new Date().toISOString());const{error:s}=await window.supabase.from(r).update(i).eq("id",t);if(s)throw s}else if(window.dataService?.updateEntity){const r=await window.dataService.updateEntity(e,t,{[n]:a});if(!r?.success)throw new Error(r?.error||"Update fehlgeschlagen")}else throw new Error("Kein Update-Mechanismus verfügbar");console.log("✅ setField DB-Update erfolgreich"),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:e,action:"updated",id:t,field:n,value:a}}))}catch(r){console.error("❌ setField fehlgeschlagen",r),alert("Aktualisierung fehlgeschlagen.")}}normalizeIcons(e){try{if(this._normalizingIcons)return;this._normalizingIcons=!0,(e||document).querySelectorAll('.actions-dropdown:not([data-icons-normalized="1"])').forEach(a=>{const r=(i,s)=>{a.querySelectorAll(i).forEach(o=>{const l=o.querySelector("svg");l&&l.remove(),o.insertAdjacentHTML("afterbegin",this.getHeroIcon(s))})};r('.action-item[data-action="view"]',"view"),r('.action-item[data-action="edit"]',"edit"),r('.action-item[data-action="notiz"]',"notiz"),r('.action-item[data-action="favorite"]',"favorite"),r('.action-item.action-danger[data-action="delete"]',"delete"),r('.action-item[data-action="rechnungen"]',"rechnungen"),r('.action-item[data-action="auftrag-details"]',"details"),a.setAttribute("data-icons-normalized","1")})}catch(t){console.warn("⚠️ ACTIONSDROPDOWN: normalizeIcons Fehler",t)}finally{this._normalizingIcons=!1}}observeTableMutations(){this._iconObserver||setTimeout(()=>{const e=document.querySelectorAll(".data-table-container, #dashboard-content");if(e.length===0){const t=document.getElementById("dashboard-content")||document.body;this.observeSingleTarget(t);return}e.forEach(t=>{this.observeSingleTarget(t)})},100)}observeSingleTarget(e){const t=new MutationObserver(n=>{for(const a of n)a.addedNodes&&a.addedNodes.length>0&&a.addedNodes.forEach(r=>{r.nodeType===1&&this.normalizeIcons(r)})});t.observe(e,{childList:!0,subtree:!0}),this._iconObserver?this._iconObserver.push(t):this._iconObserver=[t]}bindGlobalEvents(){document.addEventListener("click",e=>{const t=e.target.closest(".actions-toggle");t&&(e.preventDefault(),typeof e.stopImmediatePropagation=="function"?e.stopImmediatePropagation():e.stopPropagation(),this.toggleDropdown(t))}),document.addEventListener("click",async e=>{const t=e.target.closest(".submenu-item");if(!t)return;e.preventDefault(),typeof e.stopImmediatePropagation=="function"&&e.stopImmediatePropagation();const n=t.dataset.id,a=t.dataset.field,r=t.dataset.value,i=t.closest(".actions-dropdown-container")?.dataset?.entityType||"auftrag";if(console.log("▶️ Submenu-Click erkannt",{entityType:i,entityId:n,fieldName:a,fieldValue:r}),t.dataset.action==="set-field"){try{if(i==="kampagne"&&a==="status_id"){const s=t.dataset.statusName||"",{error:o}=await window.supabase.from("kampagne").update({status_id:r,status:s,updated_at:new Date().toISOString()}).eq("id",n);if(o)throw o;window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"kampagne",action:"updated",id:n,field:"status_id",value:r}})),console.log("✅ Status (id+name) aktualisiert")}else if(i==="kooperation"&&a==="status_id"){const s=t.dataset.statusName||"",{error:o}=await window.supabase.from("kooperationen").update({status_id:r,status:s,updated_at:new Date().toISOString()}).eq("id",n);if(o)throw o;window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"kooperation",action:"updated",id:n,field:"status_id",value:r}})),console.log("✅ Kooperation-Status (id+name) aktualisiert")}else await this.setField(i,n,a,r),console.log("✅ setField abgeschlossen")}catch(s){console.error("❌ setField Fehler aus Submenu",s),alert("Aktualisierung fehlgeschlagen.")}this.closeAllDropdowns()}}),document.addEventListener("click",e=>{const t=e.target.closest(".action-item");if(!t)return;const n=t.dataset?.action;if(!n||["comment-delete","video-view","video-edit","video-delete"].includes(n))return;e.preventDefault(),typeof e.stopImmediatePropagation=="function"?e.stopImmediatePropagation():e.stopPropagation();const r=t.dataset.id;let s=t.closest(".actions-dropdown-container")?.dataset?.entityType||"auftrag";if(console.log(`🎯 ACTIONSDROPDOWN: Entity-Type aus data-attribute: ${s}`),n==="favorite"){const o=t.dataset.creatorId||r;let l=t.dataset.kampagneId||null;this.addToFavorites(o,l),this.closeAllDropdowns();return}this.handleAction(n,r,s,t),this.closeAllDropdowns()}),document.addEventListener("click",e=>{e.target.closest(".actions-dropdown-container")||this.closeAllDropdowns()}),document.addEventListener("keydown",e=>{e.key==="Escape"&&this.closeAllDropdowns()})}getEntityTypeFromContext(e){const n=window.location.pathname.split("/").filter(o=>o);if(n.length>0){const o=n[0];if(["creator","unternehmen","marke","auftrag"].includes(o))return o}const a=e.closest("tr");if(a){const o=a.closest("table");if(o){const l=o.id;if(l.includes("creator"))return"creator";if(l.includes("unternehmen"))return"unternehmen";if(l.includes("marke"))return"marke";if(l.includes("auftrag"))return"auftrag"}}const r=e.textContent.toLowerCase();if(r.includes("creator")||r.includes("creator"))return"creator";if(r.includes("unternehmen")||r.includes("firmenname"))return"unternehmen";if(r.includes("marke")||r.includes("markenname"))return"marke";if(r.includes("auftrag")||r.includes("auftragsname"))return"auftrag";const i=e.closest("tbody");if(i){const o=i.closest("table");if(o){const l=o.querySelectorAll("th");for(let u of l){const d=u.textContent.toLowerCase();if(d.includes("creator")||d.includes("influencer"))return"creator";if(d.includes("unternehmen")||d.includes("firmenname"))return"unternehmen";if(d.includes("marke")||d.includes("markenname"))return"marke";if(d.includes("auftrag")||d.includes("auftragsname"))return"auftrag"}}}const s=window.location.pathname;return s.includes("/creator")?"creator":s.includes("/unternehmen")?"unternehmen":s.includes("/marke")?"marke":(s.includes("/auftrag")||console.warn('⚠️ Konnte Entity-Type nicht ermitteln, verwende "auftrag" als Fallback'),"auftrag")}toggleDropdown(e){const t=e.nextElementSibling,n=t.classList.contains("show");this.closeAllDropdowns(),n||(t.classList.add("show"),e.setAttribute("aria-expanded","true"))}closeAllDropdowns(){document.querySelectorAll(".actions-dropdown").forEach(e=>{e.classList.remove("show")}),document.querySelectorAll(".actions-toggle").forEach(e=>{e.setAttribute("aria-expanded","false")})}createCreatorActions(e){return this.isKunde()?this.createReadOnlyActions(e):`
      <div class="actions-dropdown-container">
        <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
        <div class="actions-dropdown">
          <a href="#" class="action-item" data-action="view" data-id="${e}">
            <i class="icon-eye"></i>
            Details anzeigen
          </a>
          <a href="#" class="action-item" data-action="edit" data-id="${e}">
            <i class="icon-edit"></i>
            Bearbeiten
          </a>
          <a href="#" class="action-item" data-action="notiz" data-id="${e}">
            <i class="icon-note"></i>
            Notiz hinzufügen
          </a>
          <a href="#" class="action-item" data-action="rating" data-id="${e}">
            
            Bewerten
          </a>
          <a href="#" class="action-item" data-action="add_to_list" data-id="${e}">
            ${this.getHeroIcon("add-to-list")}
            Zur Liste hinzufügen
          </a>
          <div class="action-separator"></div>
          <a href="#" class="action-item action-danger" data-action="delete" data-id="${e}">
            <i class="icon-trash"></i>
            Löschen
          </a>
        </div>
      </div>
    `}createUnternehmenActions(e){return this.isKunde()?this.createReadOnlyActions(e):`
      <div class="actions-dropdown-container">
        <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
        <div class="actions-dropdown">
          <a href="#" class="action-item" data-action="view" data-id="${e}">
            <i class="icon-eye"></i>
            Details anzeigen
          </a>
          <a href="#" class="action-item" data-action="edit" data-id="${e}">
            <i class="icon-edit"></i>
            Bearbeiten
          </a>
          <a href="#" class="action-item" data-action="notiz" data-id="${e}">
            <i class="icon-note"></i>
            Notiz hinzufügen
          </a>
          <a href="#" class="action-item" data-action="marken" data-id="${e}">
            <i class="icon-tag"></i>
            Marken anzeigen
          </a>
          <a href="#" class="action-item" data-action="auftraege" data-id="${e}">
            <i class="icon-briefcase"></i>
            Aufträge anzeigen
          </a>
          <div class="action-separator"></div>
          <a href="#" class="action-item action-danger" data-action="delete" data-id="${e}">
            <i class="icon-trash"></i>
            Löschen
          </a>
        </div>
      </div>
    `}createMarkeActions(e){return this.isKunde()?this.createReadOnlyActions(e):`
      <div class="actions-dropdown-container">
        <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
        <div class="actions-dropdown">
          <a href="#" class="action-item" data-action="view" data-id="${e}">
            <i class="icon-eye"></i>
            Details anzeigen
          </a>
          <a href="#" class="action-item" data-action="edit" data-id="${e}">
            <i class="icon-edit"></i>
            Bearbeiten
          </a>
          <a href="#" class="action-item" data-action="notiz" data-id="${e}">
            <i class="icon-note"></i>
            Notiz hinzufügen
          </a>
          <a href="#" class="action-item" data-action="auftraege" data-id="${e}">
            <i class="icon-briefcase"></i>
            Aufträge anzeigen
          </a>
          <div class="action-separator"></div>
          <a href="#" class="action-item action-danger" data-action="delete" data-id="${e}">
            <i class="icon-trash"></i>
            Löschen
          </a>
        </div>
      </div>
    `}createKooperationActions(e){return this.isKunde()?this.createReadOnlyActions(e):`
      <div class="actions-dropdown-container" data-entity-type="kooperation">
        <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
            <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
          </svg>
        </button>
        <div class="actions-dropdown">
          <a href="#" class="action-item" data-action="view" data-id="${e}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
              <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
              <path fill-rule="evenodd" d="M.661 10c1.743-2.372 4.761-5 9.339-5 4.578 0 7.601 2.628 9.339 5-1.738 2.372-4.761 5-9.339 5-4.578 0-7.601-2.628-9.339-5zM10 15a5 5 0 100-10 5 5 0 000 10z" clip-rule="evenodd" />
            </svg>
            Details anzeigen
          </a>
          <a href="#" class="action-item" data-action="edit" data-id="${e}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
              <path d="M5.433 13.917l-1.523 1.523a.75.75 0 001.06 1.06l1.523-1.523L5.433 13.917zM11.206 6.106L13.917 3.4a.75.75 0 011.06 1.06l-2.711 2.711-.693-.693z" />
              <path fill-rule="evenodd" d="M1.334 10.606a1.5 1.5 0 011.06-1.06l10.38-10.38a1.5 1.5 0 012.122 0l1.523 1.523a1.5 1.5 0 010 2.122l-10.38 10.38a1.5 1.5 0 01-1.06 1.06H1.334v-3.182z" clip-rule="evenodd" />
            </svg>
            Bearbeiten
          </a>
          <a href="#" class="action-item" data-action="notiz" data-id="${e}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
              <path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.336-3.117C2.688 12.31 2 11.104 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clip-rule="evenodd" />
            </svg>
            Notiz hinzufügen
          </a>
          <a href="#" class="action-item" data-action="quickview" data-id="${e}">
            ${this.getHeroIcon("quickview")}
            Schnellansicht öffnen
          </a>
          <div class="action-separator"></div>
          <a href="#" class="action-item action-danger" data-action="delete" data-id="${e}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
              <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.368.298a.75.75 0 10.232 1.482l.175-.027c.572-.089 1.14-.19 1.706-.302A3.75 3.75 0 019.75 3h.5a3.75 3.75 0 013.657 3.234c.566.112 1.134.213 1.706.302l.175.027a.75.75 0 10.232-1.482A41.203 41.203 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM2.5 7.75a.75.75 0 01.75-.75h13.5a.75.75 0 010 1.5H3.25a.75.75 0 01-.75-.75zM7.25 9.75a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5H8a.75.75 0 01-.75-.75zM6 12.25a.75.75 0 01.75-.75h6.5a.75.75 0 010 1.5H6.75a.75.75 0 01-.75-.75zM4.75 14.75a.75.75 0 01.75-.75h9.5a.75.75 0 010 1.5h-9.5a.75.75 0 01-.75-.75z" clip-rule="evenodd" />
            </svg>
            Löschen
          </a>
        </div>
      </div>
    `}createAuftragActions(e){if(console.log("🎯 ACTIONSDROPDOWN: createAuftragActions aufgerufen für ID:",e),this.isKunde())return this.createReadOnlyActions(e);const t=`
      <div class="actions-dropdown-container">
        <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
        <div class="actions-dropdown">
          <a href="#" class="action-item" data-action="view" data-id="${e}">
            <i class="icon-eye"></i>
            Details anzeigen
          </a>
          <a href="#" class="action-item" data-action="edit" data-id="${e}">
            <i class="icon-edit"></i>
            Bearbeiten
          </a>
          <a href="#" class="action-item" data-action="notiz" data-id="${e}">
            <i class="icon-note"></i>
            Notiz hinzufügen
          </a>
          <a href="#" class="action-item" data-action="auftrag-details" data-icon="details" data-id="${e}">
            Auftragsdetails hinzufügen
          </a>
          <a href="#" class="action-item" data-action="rechnung" data-id="${e}">
            <i class="icon-invoice"></i>
            Rechnung erstellen
          </a>
          <div class="action-separator"></div>
          <a href="#" class="action-item action-danger" data-action="delete" data-id="${e}">
            <i class="icon-trash"></i>
            Löschen
          </a>
        </div>
      </div>
    `;return console.log("🎯 ACTIONSDROPDOWN: HTML generiert:",t.substring(0,100)+"..."),t}isKunde(){return window.currentUser?.rolle==="kunde"}createReadOnlyActions(e){return`
      <div class="actions-dropdown-container">
        <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
        <div class="actions-dropdown">
          <a href="#" class="action-item" data-action="view" data-id="${e}">
            <i class="icon-eye"></i>
            Details anzeigen
          </a>
        </div>
      </div>
    `}async handleRemoveZuordnung(e,t){if(!window.kundenDetail||!window.kundenDetail.kundeId){console.error("❌ KundenDetail nicht verfügbar für Remove-Action");return}await window.kundenDetail.removeZuordnung(e,t)}createGenericActions(e,t,n=[]){return this.isKunde()?this.createReadOnlyActions(t):`
      <div class="actions-dropdown-container">
        <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
        <div class="actions-dropdown">
          ${[...[{action:"view",icon:"icon-eye",label:"Details anzeigen"},{action:"edit",icon:"icon-edit",label:"Bearbeiten"},{action:"notiz",icon:"icon-note",label:"Notiz hinzufügen"}],...n].map(s=>{const o=s.action==="delete"||s.action==="remove"?"action-danger":"",l=this.getHeroIcon(s.action)||`<i class="${s.icon}"></i>`;return`
        <a href="#" class="action-item ${o}" data-action="${s.action}" data-id="${t}">
          ${l}
          ${s.label}
        </a>
      `}).join("")}
        </div>
      </div>
    `}async handleAction(e,t,n,a){console.log(`🎯 ACTIONSDROPDOWN: Action ${e} für ${n} ${t}`);try{await this.actionRegistry.executeAction(e,t,n,a);return}catch(r){console.warn("⚠️ ActionRegistry konnte Action nicht verarbeiten, verwende Legacy-System:",r)}switch(e){case"view":window.navigateTo(`/${n}/${t}`);break;case"edit":window.navigateTo(`/${n}/${t}/edit`);break;case"delete":this.confirmDelete(t,n);break;case"remove":this.handleRemoveZuordnung(t,n);break;case"notiz":this.openNotizModal(t,n);break;case"rating":this.openRatingModal(t,n);break;case"marken":window.navigateTo(`/unternehmen/${t}/marken`);break;case"auftraege":window.navigateTo(`/unternehmen/${t}/auftraege`);break;case"kampagnen":window.navigateTo(`/auftrag/${t}/kampagnen`);break;case"video-create":n==="kooperation"?window.navigateTo(`/video/new?kooperation=${t}`):console.warn("video-create nur im Kontext kooperation unterstützt");break;case"quickview":this.openKooperationQuickView(t);break;case"assign-staff":if(window.currentUser?.rolle!=="admin"){alert("Nur Admins dürfen Mitarbeiter zuordnen.");break}this.openAssignStaffModal(t);break;case"assign_staff":if(n==="marke"){if(window.currentUser?.rolle!=="admin"){alert("Nur Admins dürfen Mitarbeiter zuordnen.");break}this.openAssignMarkeStaffModal(t)}else console.warn("assign_staff Action nur für Marken implementiert");break;case"rechnung":this.openRechnungModal(t,n);break;case"add_to_campaign":this.openAddToCampaignModal(t);break;case"favorite":{const r=document.querySelector("[data-kampagne-id]")?.dataset?.kampagneId;this.addToFavorites(t,r);break}case"add_to_list":{this.openAddToListModal(t);break}case"add_ansprechpartner":{this.openAddAnsprechpartnerModal(t);break}case"add_ansprechpartner_kampagne":{this.openAddAnsprechpartnerToKampagneModal(t);break}case"add_ansprechpartner_unternehmen":{this.openAddAnsprechpartnerToUnternehmenModal(t);break}case"remove_ansprechpartner_unternehmen":{this.openRemoveAnsprechpartnerFromUnternehmenModalNew(t);break}case"unassign-kampagne":{const r=a?.dataset?.mitarbeiterId||window.location.pathname.split("/").pop();if(!r){alert("Mitarbeiter-ID nicht gefunden");break}const i=t;if(!i)break;if(window.confirmationModal){if(!(await window.confirmationModal.open({title:"Zuweisung entfernen",message:"Zuweisung dieser Kampagne vom Mitarbeiter entfernen?",confirmText:"Entfernen",cancelText:"Abbrechen",danger:!0}))?.confirmed)break}else if(!confirm("Zuweisung dieser Kampagne vom Mitarbeiter entfernen?"))break;(async()=>{try{const{error:s}=await window.supabase.from("kampagne_mitarbeiter").delete().eq("mitarbeiter_id",r).eq("kampagne_id",i);if(s)throw s;const o=a.closest("tr");o&&o.remove();const l=document.querySelector('.tab-button[data-tab="kampagnen"] .tab-count');if(l){const u=parseInt(l.textContent||"1",10);l.textContent=String(Math.max(0,u-1))}alert("Zuweisung entfernt")}catch(s){console.error("❌ Zuweisung entfernen fehlgeschlagen",s),alert("Entfernen fehlgeschlagen")}})();break}case"video-view":window.navigateTo(`/video/${t}`);break;case"video-edit":window.navigateTo(`/video/${t}`);break;case"video-delete":this.confirmDelete(t,"kooperation_videos");break;case"details":case"auftrag-details":console.log("🎯 ACTIONSDROPDOWN: Details-Action wird verarbeitet"),console.log("🎯 window.auftragDetail:",!!window.auftragDetail),console.log("🎯 window.auftragsDetailsManager:",!!window.auftragsDetailsManager),console.log("🎯 window.formSystem:",!!window.formSystem),window.auftragDetail?(console.log("🎯 Verwende auftragDetail.showDetailsForm"),window.auftragDetail.showDetailsForm(t)):window.auftragsDetailsManager?(console.log("🎯 Verwende auftragsDetailsManager.open"),window.auftragsDetailsManager.open(t)):window.formSystem?(console.log("🎯 Verwende formSystem.openModalForm"),window.formSystem.openModalForm("auftrag_details",{auftrag_id:t})):(console.log("🎯 Keine verfügbaren Systeme gefunden"),alert("Auftragsdetails-Formular nicht verfügbar."));break;default:console.warn(`⚠️ Unbekannte Action: ${e}`)}}async openKooperationQuickView(e){try{const t=document.createElement("div");t.className="drawer-overlay";const n=document.createElement("div");n.setAttribute("role","dialog"),n.className="drawer-panel";const a=document.createElement("div");a.className="drawer-header";const r=document.createElement("div"),i=document.createElement("h1");i.textContent="Kooperation · Schnellansicht";const s=document.createElement("p");s.style.margin="0",s.style.color="#6b7280",s.textContent="Videos & Kommentare",r.appendChild(i),r.appendChild(s);const o=document.createElement("div"),l=document.createElement("button");l.className="drawer-close",l.id="kvq-close",l.textContent="Schließen",o.appendChild(l),a.appendChild(r),a.appendChild(o);const u=document.createElement("div");u.className="drawer-body";const d=document.createElement("div");d.className="detail-section";const c=document.createElement("h2");c.textContent="Videos";const m=document.createElement("div");m.id="kvq-table",m.textContent="Lade...",d.appendChild(c),d.appendChild(m),u.replaceChildren(d),n.appendChild(a),n.appendChild(u),document.body.appendChild(t),document.body.appendChild(n);const h=()=>{try{t.remove(),n.remove()}catch{}};t.addEventListener("click",h),a.querySelector("#kvq-close")?.addEventListener("click",h),document.addEventListener("keydown",function E($){$.key==="Escape"&&(h(),document.removeEventListener("keydown",E))}),requestAnimationFrame(()=>{n.classList.add("show")});const{data:p}=await window.supabase.from("kooperation_videos").select("id, position, content_art, titel, asset_url, status, created_at").eq("kooperation_id",e).order("position",{ascending:!0}),g=p||[];let b={};if(g.length){const E=g.map(L=>L.id),{data:$}=await window.supabase.from("kooperation_video_comment").select("id, video_id, runde, text, author_name, created_at, deleted_at").in("video_id",E).order("created_at",{ascending:!0});($||[]).forEach(L=>{const F=L.video_id;b[F]||(b[F]={r1:[],r2:[]});const N=L.runde===2||L.runde==="2"?"r2":"r1";b[F][N].push(L)})}const y=E=>window.validatorSystem?.sanitizeHtml?.(E)??E,w=E=>E?new Date(E).toLocaleDateString("de-DE"):"-",v=E=>!E||!E.length?"-":E.map($=>{const F=!!$.deleted_at?"text-decoration: line-through; color: #999;":"",N=y($.text||""),q=y($.author_name||"-"),U=w($.created_at);return`<div class="fb-line"><span class="fb-meta">${q} • ${U}</span><div class="fb-text" style="${F}">${N}</div></div>`}).join(""),k=g.map(E=>{const $=b[E.id]||{r1:[],r2:[]},L=E.asset_url?`<a class="kvq-link-btn" href="${E.asset_url}" target="_blank" rel="noopener">${this.getHeroIcon("view")}<span>Öffnen</span></a>`:"-";return`
          <tr>
            <td>${E.position||"-"}</td>
            <td>${y(E.content_art||"-")}</td>
            <td>
              <div class="kvq-cell">
                <span class="kvq-title-text">${y(E.titel||"-")}</span>
                ${L}
              </div>
            </td>
            <td class="feedback-cell">${v($.r1)}</td>
            <td class="feedback-cell">${v($.r2)}</td>
            <td><span class="status-badge status-${(E.status||"produktion").toLowerCase()}">${E.status==="abgeschlossen"?"Abgeschlossen":"Produktion"}</span></td>
          </tr>`}).join(""),_=g.length?`
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Content Art</th>
                <th>Titel/URL</th>
                <th>Feedback K1</th>
                <th>Feedback K2</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${k}</tbody>
          </table>
        </div>`:'<p class="empty-state">Keine Videos vorhanden.</p>',S=u.querySelector("#kvq-table");if(S.innerHTML="",g.length){const E=document.createElement("div");E.className="data-table-container",E.innerHTML=_,S.appendChild(E)}else{const E=document.createElement("p");E.className="empty-state",E.textContent="Keine Videos vorhanden.",S.appendChild(E)}this.normalizeIcons(u)}catch(t){console.error("❌ Quickview öffnen fehlgeschlagen",t),alert("Schnellansicht konnte nicht geöffnet werden.")}}async openAssignStaffModal(e){const t=document.createElement("div");t.className="modal overlay-modal",t.innerHTML=`
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Mitarbeiter zuordnen</h3>
          <button class="modal-close" id="assign-staff-close">×</button>
        </div>
        <div class="modal-body">
          <label class="form-label">Mitarbeiter wählen</label>
          <input type="text" id="staff-search" class="form-input auto-suggest-input" placeholder="Mitarbeiter suchen..." />
          <div id="staff-dropdown" class="auto-suggest-dropdown"></div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" id="assign-staff-cancel">Abbrechen</button>
          <button class="primary-btn" id="assign-staff-confirm" disabled>Zuordnen</button>
        </div>
      </div>`,document.body.appendChild(t);const n=t.querySelector("#staff-search"),a=t.querySelector("#staff-dropdown");let r=null;const i=async d=>{try{let c=[];try{const{data:p}=await window.supabase.from("kampagne_mitarbeiter").select("mitarbeiter_id").eq("kampagne_id",e);c=(p||[]).map(g=>g.mitarbeiter_id)}catch{}let m=window.supabase.from("benutzer").select("id, name, rolle, mitarbeiter_klasse:mitarbeiter_klasse_id(name)").order("name");d&&(m=m.ilike("name",`%${d}%`)),c.length>0&&(m=m.not("id","in",`(${c.join(",")})`));const{data:h}=await m;return h||[]}catch(c){return console.warn("⚠️ Mitarbeiter-Suche fehlgeschlagen",c),[]}},s=d=>{a.innerHTML=d.length?d.map(c=>`<div class="dropdown-item" data-id="${c.id}">${c.name}${c.mitarbeiter_klasse?.name?` <span class="muted">(${c.mitarbeiter_klasse.name})</span>`:""}${c.rolle?` <span class="muted">[${c.rolle}]</span>`:""}</div>`).join(""):'<div class="dropdown-item no-results">Keine Mitarbeiter gefunden</div>'};s(await i("")),a.classList.add("show"),n.focus(),(()=>{(!a.style.position||a.style.position==="absolute")&&(a.style.position="relative"),a.style.display="block"})(),n.addEventListener("focus",()=>a.classList.add("show")),n.addEventListener("blur",()=>setTimeout(()=>a.classList.remove("show"),150));let l;n.addEventListener("input",()=>{clearTimeout(l),l=setTimeout(async()=>s(await i(n.value.trim())),200)}),a.addEventListener("click",d=>{const c=d.target.closest(".dropdown-item");!c||c.classList.contains("no-results")||(r=c.dataset.id,n.value=c.textContent.trim(),t.querySelector("#assign-staff-confirm").disabled=!1,a.classList.remove("show"))});const u=()=>t.remove();t.querySelector("#assign-staff-close").onclick=u,t.querySelector("#assign-staff-cancel").onclick=u,t.querySelector("#assign-staff-confirm").onclick=async()=>{if(r)try{const{error:d}=await window.supabase.from("kampagne_mitarbeiter").insert({kampagne_id:e,mitarbeiter_id:r,role:"projektmanager"});if(d)throw console.error("❌ Insert-Fehler:",d),d;try{const{data:c}=await window.supabase.from("kampagne").select("id, kampagnenname").eq("id",e).single(),m=c?.kampagnenname||e;await window.notificationSystem?.pushNotification(r,{type:"assign",entity:"kampagne",entityId:e,title:"Neue Kampagnen-Zuweisung",message:`Du wurdest der Kampagne "${m}" zugeordnet.`}),window.dispatchEvent(new Event("notificationsRefresh"))}catch{}console.log("✅ Mitarbeiter erfolgreich zugeordnet"),u(),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"kampagne",action:"staff-assigned",id:e}})),alert("Mitarbeiter zugeordnet.")}catch(d){console.error("❌ Fehler beim Zuordnen",d),alert("Zuordnung fehlgeschlagen.")}}}async openAssignMarkeStaffModal(e){console.log("🎯 ACTIONSDROPDOWN: Öffne Mitarbeiter-Auswahl-Modal für Marke:",e);let t=[],n=[];try{const{data:c}=await window.supabase.from("marke_mitarbeiter").select("mitarbeiter_id").eq("marke_id",e);n=(c||[]).map(p=>p.mitarbeiter_id).filter(Boolean);let m=window.supabase.from("benutzer").select(`
          id, 
          name, 
          rolle,
          mitarbeiter_klasse:mitarbeiter_klasse_id(name)
        `).order("name");n.length>0&&(m=m.not("id","in",`(${n.join(",")})`));const{data:h}=await m;t=h||[]}catch(c){console.warn("⚠️ Fehler beim Laden der Mitarbeiter:",c)}const a=document.createElement("div");a.className="modal overlay-modal",a.innerHTML=`
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Mitarbeiter zur Marke hinzufügen</h3>
          <button class="modal-close" id="add-mitarbeiter-close">×</button>
        </div>
        <div class="modal-body">
          <label class="form-label">Mitarbeiter wählen</label>
          <input type="text" id="mitarbeiter-search" class="form-input auto-suggest-input" placeholder="Mitarbeiter suchen..." />
          <div id="mitarbeiter-dropdown" class="auto-suggest-dropdown"></div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" id="add-mitarbeiter-cancel">Abbrechen</button>
          <button class="primary-btn" id="add-mitarbeiter-confirm" disabled>Hinzufügen</button>
        </div>
      </div>`,document.body.appendChild(a);const r=a.querySelector("#mitarbeiter-search"),i=a.querySelector("#mitarbeiter-dropdown");let s=null;const o=(c="")=>{if(!c||c.trim().length===0){i.innerHTML='<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Mitarbeiter zu suchen...</div>';return}const m=c.toLowerCase(),h=t.filter(p=>{const g=(p.name||"").toLowerCase(),b=(p.rolle||"").toLowerCase(),y=(p.mitarbeiter_klasse?.name||"").toLowerCase();return g.includes(m)||b.includes(m)||y.includes(m)});i.innerHTML=h.length?h.map(p=>{const g=p.name,b=[p.rolle,p.mitarbeiter_klasse?.name].filter(Boolean).join(" • ");return`<div class="dropdown-item" data-id="${p.id}">
              <div class="dropdown-item-main">${g}</div>
              ${b?`<div class="dropdown-item-details">${b}</div>`:""}
            </div>`}).join(""):'<div class="dropdown-item no-results">Keine verfügbaren Mitarbeiter gefunden</div>'};i.innerHTML='<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Mitarbeiter zu suchen...</div>',r.addEventListener("focus",()=>{r.value.trim().length>0&&i.classList.add("show")}),r.addEventListener("blur",()=>{setTimeout(()=>i.classList.remove("show"),150)});let l;r.addEventListener("input",c=>{clearTimeout(l),l=setTimeout(async()=>{const m=c.target.value.trim();if(m.length<1){i.classList.remove("show");return}try{let h=window.supabase.from("benutzer").select(`
              id, 
              name, 
              rolle,
              mitarbeiter_klasse:mitarbeiter_klasse_id(name)
            `).or(`name.ilike.%${m}%,rolle.ilike.%${m}%`).order("name");n.length>0&&(h=h.not("id","in",`(${n.join(",")})`));const{data:p}=await h;t=p||[],o(m),i.classList.add("show")}catch(h){console.warn("⚠️ Mitarbeiter-Suche fehlgeschlagen",h)}},200)}),i.addEventListener("click",c=>{const m=c.target.closest(".dropdown-item");if(!m||m.classList.contains("no-results"))return;s=m.dataset.id;const h=m.querySelector(".dropdown-item-main")?.textContent||m.textContent;r.value=h,a.querySelector("#add-mitarbeiter-confirm").disabled=!1,i.classList.remove("show")});const u=()=>a.remove();a.querySelector("#add-mitarbeiter-close").onclick=u,a.querySelector("#add-mitarbeiter-cancel").onclick=u;const d=c=>{c.key==="Escape"&&(u(),document.removeEventListener("keydown",d))};document.addEventListener("keydown",d),a.querySelector("#add-mitarbeiter-confirm").onclick=async()=>{if(s)try{const{error:c}=await window.supabase.from("marke_mitarbeiter").insert({marke_id:e,mitarbeiter_id:s,assigned_by:window.currentUser?.id||null});if(c)throw c;try{const{data:m}=await window.supabase.from("marke").select("id, markenname").eq("id",e).single(),h=m?.markenname||e;await window.notificationSystem?.pushNotification(s,{type:"assignment",entity:"marke",entityId:e,title:"Neue Marken-Zuordnung",message:`Sie wurden der Marke "${h}" zugeordnet und können nun alle zugehörigen Kampagnen und Kooperationen einsehen.`}),window.dispatchEvent(new Event("notificationsRefresh"))}catch(m){console.warn("⚠️ Benachrichtigung fehlgeschlagen:",m)}u(),document.removeEventListener("keydown",d),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"mitarbeiter",action:"added",markeId:e}})),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"marke",action:"mitarbeiter-added",id:e}})),alert("✅ Mitarbeiter wurde erfolgreich zur Marke hinzugefügt und wird automatisch angezeigt!"),console.log("✅ ACTIONSDROPDOWN: Mitarbeiter erfolgreich hinzugefügt")}catch(c){console.error("❌ Fehler beim Hinzufügen des Mitarbeiters:",c),alert("Fehler beim Hinzufügen: "+(c.message||"Unbekannter Fehler"))}}}async addToFavorites(e,t){try{if(!t){const n=window.location.pathname.match(/\/kampagne\/([0-9a-fA-F-]{36})/);t=n?n[1]:null}if(!t){alert("Kampagne konnte nicht ermittelt werden.");return}await window.supabase.from("kampagne_creator_favoriten").insert({kampagne_id:t,creator_id:e}),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"kampagne",action:"favorite-added",id:t}})),alert("Zu Favoriten hinzugefügt.")}catch(n){console.error("❌ Fehler beim Hinzufügen zu Favoriten",n),alert("Hinzufügen zu Favoriten fehlgeschlagen.")}}async openAddToCampaignModal(e){let t=[],n=[],a=null;try{const[c,m]=await Promise.all([window.supabase.from("kampagne_creator").select("kampagne_id").eq("creator_id",e),window.supabase.from("kampagne_creator_sourcing").select("kampagne_id").eq("creator_id",e)]),h=(c?.data||[]).map(y=>y.kampagne_id).filter(Boolean),p=(m?.data||[]).map(y=>y.kampagne_id).filter(Boolean);if(n=Array.from(new Set([...h,...p])),window.currentUser?.rolle!=="admin"){const{data:y}=await window.supabase.from("kampagne_mitarbeiter").select("kampagne_id").eq("mitarbeiter_id",window.currentUser?.id);a=(y||[]).map(w=>w.kampagne_id).filter(Boolean)}let g=!0,b=window.supabase.from("kampagne").select("id, kampagnenname, status").order("created_at",{ascending:!1});if(Array.isArray(a)&&(a.length===0?(g=!1,t=[]):b=b.in("id",a)),n.length>0&&(b=b.not("id","in",`(${n.join(",")})`)),g){const{data:y}=await b;t=y||[]}}catch{}const r=document.createElement("div");r.className="modal overlay-modal",r.innerHTML=`
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Zu Kampagne hinzufügen</h3>
          <button class="modal-close" id="add-to-campaign-close">×</button>
        </div>
        <div class="modal-body">
          <label class="form-label">Kampagne wählen</label>
          <input type="text" id="campaign-search" class="form-input auto-suggest-input" placeholder="Kampagne suchen..." />
          <div id="campaign-dropdown" class="auto-suggest-dropdown"></div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" id="add-to-campaign-cancel">Abbrechen</button>
          <button class="primary-btn" id="add-to-campaign-confirm" disabled>Hinzufügen</button>
        </div>
      </div>`,document.body.appendChild(r);const i=r.querySelector("#campaign-search"),s=r.querySelector("#campaign-dropdown");let o=null;const l=(c="")=>{const m=c.toLowerCase(),h=t.filter(p=>(p.kampagnenname||"").toLowerCase().includes(m));s.innerHTML=h.length?h.map(p=>`<div class="dropdown-item" data-id="${p.id}">${p.kampagnenname}</div>`).join(""):'<div class="dropdown-item no-results">Keine Kampagne gefunden</div>'};l(""),i.addEventListener("focus",()=>{s.classList.add("show")}),i.addEventListener("blur",()=>{setTimeout(()=>s.classList.remove("show"),150)});let u;i.addEventListener("input",()=>{const c=i.value.trim();clearTimeout(u),u=setTimeout(async()=>{try{let m=window.supabase.from("kampagne").select("id, kampagnenname, status").order("created_at",{ascending:!1});if(c.length>0&&(m=m.ilike("kampagnenname",`%${c}%`)),Array.isArray(a)){if(a.length===0){t=[],l(c);return}m=m.in("id",a)}n.length>0&&(m=m.not("id","in",`(${n.join(",")})`));const{data:h}=await m;t=h||[],l(c)}catch(m){console.warn("⚠️ Kampagnen-Suche fehlgeschlagen",m)}},200)}),s.addEventListener("click",c=>{const m=c.target.closest(".dropdown-item");!m||m.classList.contains("no-results")||(o=m.dataset.id,i.value=m.textContent,r.querySelector("#add-to-campaign-confirm").disabled=!1,s.classList.remove("show"))});const d=()=>r.remove();r.querySelector("#add-to-campaign-close").onclick=d,r.querySelector("#add-to-campaign-cancel").onclick=d,r.querySelector("#add-to-campaign-confirm").onclick=async()=>{if(o)try{await window.supabase.from("kampagne_creator_sourcing").insert({kampagne_id:o,creator_id:e});try{const[{data:c},{data:m}]=await Promise.all([window.supabase.from("kampagne_mitarbeiter").select("mitarbeiter_id").eq("kampagne_id",o),window.supabase.from("kampagne").select("kampagnenname").eq("id",o).single()]),h=m?.kampagnenname||o,p=(c||[]).map(g=>g.mitarbeiter_id).filter(Boolean);for(const g of p)await window.notificationSystem?.pushNotification(g,{type:"update",entity:"kampagne",entityId:o,title:"Sourcing-Update",message:`Neuer Creator wurde dem Sourcing von "${h}" hinzugefügt.`});p.length&&window.dispatchEvent(new Event("notificationsRefresh"))}catch{}d(),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"kampagne",action:"sourcing-added",id:o}})),alert("Creator wurde zum Sourcing der Kampagne hinzugefügt.")}catch(c){console.error("❌ Fehler beim Hinzufügen zur Kampagne",c),alert("Hinzufügen fehlgeschlagen.")}}}async openAddAnsprechpartnerModal(e){console.log("🎯 ACTIONSDROPDOWN: Öffne Ansprechpartner-Auswahl-Modal für Marke:",e);let t=[],n=[];try{const{data:c}=await window.supabase.from("ansprechpartner_marke").select("ansprechpartner_id").eq("marke_id",e);n=(c||[]).map(p=>p.ansprechpartner_id).filter(Boolean);let m=window.supabase.from("ansprechpartner").select(`
          id, 
          vorname, 
          nachname, 
          email,
          unternehmen:unternehmen_id(firmenname),
          position:position_id(name)
        `).order("nachname");n.length>0&&(m=m.not("id","in",`(${n.join(",")})`));const{data:h}=await m;t=h||[]}catch(c){console.warn("⚠️ Fehler beim Laden der Ansprechpartner:",c)}const a=document.createElement("div");a.className="modal overlay-modal",a.innerHTML=`
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Ansprechpartner zur Marke hinzufügen</h3>
          <button class="modal-close" id="add-ansprechpartner-close">×</button>
        </div>
        <div class="modal-body">
          <label class="form-label">Ansprechpartner wählen</label>
          <input type="text" id="ansprechpartner-search" class="form-input auto-suggest-input" placeholder="Ansprechpartner suchen..." />
          <div id="ansprechpartner-dropdown" class="auto-suggest-dropdown"></div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" id="add-ansprechpartner-cancel">Abbrechen</button>
          <button class="primary-btn" id="add-ansprechpartner-confirm" disabled>Hinzufügen</button>
        </div>
      </div>`,document.body.appendChild(a);const r=a.querySelector("#ansprechpartner-search"),i=a.querySelector("#ansprechpartner-dropdown");let s=null;const o=(c="")=>{if(!c||c.trim().length===0){i.innerHTML='<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Ansprechpartner zu suchen...</div>';return}const m=c.toLowerCase(),h=t.filter(p=>{const g=`${p.vorname} ${p.nachname}`.toLowerCase(),b=(p.email||"").toLowerCase(),y=(p.unternehmen?.firmenname||"").toLowerCase();return g.includes(m)||b.includes(m)||y.includes(m)});i.innerHTML=h.length?h.map(p=>{const g=`${p.vorname} ${p.nachname}`,b=[p.email,p.unternehmen?.firmenname,p.position?.name].filter(Boolean).join(" • ");return`<div class="dropdown-item" data-id="${p.id}">
              <div class="dropdown-item-main">${g}</div>
              ${b?`<div class="dropdown-item-details">${b}</div>`:""}
            </div>`}).join(""):'<div class="dropdown-item no-results">Keine verfügbaren Ansprechpartner gefunden</div>'};i.innerHTML='<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Ansprechpartner zu suchen...</div>',r.addEventListener("focus",()=>{r.value.trim().length>0&&i.classList.add("show")}),r.addEventListener("blur",()=>{setTimeout(()=>i.classList.remove("show"),150)});let l;r.addEventListener("input",c=>{clearTimeout(l),l=setTimeout(async()=>{const m=c.target.value.trim();if(m.length<1){i.classList.remove("show");return}try{let h=window.supabase.from("ansprechpartner").select(`
              id, 
              vorname, 
              nachname, 
              email,
              unternehmen:unternehmen_id(firmenname),
              position:position_id(name)
            `).or(`vorname.ilike.%${m}%,nachname.ilike.%${m}%,email.ilike.%${m}%`).order("nachname");n.length>0&&(h=h.not("id","in",`(${n.join(",")})`));const{data:p}=await h;t=p||[],o(m),i.classList.add("show")}catch(h){console.warn("⚠️ Ansprechpartner-Suche fehlgeschlagen",h)}},200)}),i.addEventListener("click",c=>{const m=c.target.closest(".dropdown-item");if(!m||m.classList.contains("no-results"))return;s=m.dataset.id;const h=m.querySelector(".dropdown-item-main")?.textContent||m.textContent;r.value=h,a.querySelector("#add-ansprechpartner-confirm").disabled=!1,i.classList.remove("show")});const u=()=>a.remove();a.querySelector("#add-ansprechpartner-close").onclick=u,a.querySelector("#add-ansprechpartner-cancel").onclick=u;const d=c=>{c.key==="Escape"&&(u(),document.removeEventListener("keydown",d))};document.addEventListener("keydown",d),a.querySelector("#add-ansprechpartner-confirm").onclick=async()=>{if(s)try{const{error:c}=await window.supabase.from("ansprechpartner_marke").insert({marke_id:e,ansprechpartner_id:s});if(c)throw c;u(),document.removeEventListener("keydown",d),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"ansprechpartner",action:"added",markeId:e}})),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"marke",action:"ansprechpartner-added",id:e}})),alert("✅ Ansprechpartner wurde erfolgreich zur Marke hinzugefügt und wird automatisch angezeigt!"),console.log("✅ ACTIONSDROPDOWN: Ansprechpartner erfolgreich hinzugefügt")}catch(c){console.error("❌ Fehler beim Hinzufügen des Ansprechpartners:",c),alert("Fehler beim Hinzufügen: "+(c.message||"Unbekannter Fehler"))}}}async openAddAnsprechpartnerToUnternehmenModal(e){console.log("🎯 ACTIONSDROPDOWN: Öffne Ansprechpartner-Auswahl-Modal für Unternehmen:",e);let t=[],n=[];try{const{data:c}=await window.supabase.from("ansprechpartner_unternehmen").select("ansprechpartner_id").eq("unternehmen_id",e);n=(c||[]).map(p=>p.ansprechpartner_id).filter(Boolean);let m=window.supabase.from("ansprechpartner").select(`
          id, 
          vorname, 
          nachname, 
          email,
          unternehmen:unternehmen_id(firmenname),
          position:position_id(name)
        `).order("nachname");n.length>0&&(m=m.not("id","in",`(${n.join(",")})`));const{data:h}=await m;t=h||[]}catch(c){console.warn("⚠️ Fehler beim Laden der Ansprechpartner:",c)}const a=document.createElement("div");a.className="modal overlay-modal",a.innerHTML=`
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Ansprechpartner zum Unternehmen hinzufügen</h3>
          <button class="modal-close" id="add-ansprechpartner-unternehmen-close">×</button>
        </div>
        <div class="modal-body">
          <label class="form-label">Ansprechpartner wählen</label>
          <input type="text" id="ansprechpartner-unternehmen-search" class="form-input auto-suggest-input" placeholder="Ansprechpartner suchen..." />
          <div id="ansprechpartner-unternehmen-dropdown" class="auto-suggest-dropdown"></div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" id="add-ansprechpartner-unternehmen-cancel">Abbrechen</button>
          <button class="primary-btn" id="add-ansprechpartner-unternehmen-confirm" disabled>Hinzufügen</button>
        </div>
      </div>`,document.body.appendChild(a);const r=a.querySelector("#ansprechpartner-unternehmen-search"),i=a.querySelector("#ansprechpartner-unternehmen-dropdown");let s=null;const o=(c="")=>{if(!c||c.trim().length===0){i.innerHTML='<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Ansprechpartner zu suchen...</div>';return}const m=c.toLowerCase(),h=t.filter(p=>{const g=`${p.vorname} ${p.nachname}`.toLowerCase(),b=(p.email||"").toLowerCase(),y=(p.unternehmen?.firmenname||"").toLowerCase();return g.includes(m)||b.includes(m)||y.includes(m)});i.innerHTML=h.length?h.map(p=>{const g=`${p.vorname} ${p.nachname}`,b=[p.email,p.unternehmen?.firmenname,p.position?.name].filter(Boolean).join(" • ");return`<div class="dropdown-item" data-id="${p.id}">
              <div class="dropdown-item-main">${g}</div>
              ${b?`<div class="dropdown-item-details">${b}</div>`:""}
            </div>`}).join(""):'<div class="dropdown-item no-results">Keine verfügbaren Ansprechpartner gefunden</div>'};i.innerHTML='<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Ansprechpartner zu suchen...</div>',r.addEventListener("focus",()=>{r.value.trim().length>0&&i.classList.add("show")}),r.addEventListener("blur",()=>{setTimeout(()=>i.classList.remove("show"),150)});let l;r.addEventListener("input",c=>{clearTimeout(l),l=setTimeout(async()=>{const m=c.target.value.trim();if(m.length<1){i.classList.remove("show");return}try{let h=window.supabase.from("ansprechpartner").select(`
              id, 
              vorname, 
              nachname, 
              email,
              unternehmen:unternehmen_id(firmenname),
              position:position_id(name)
            `).or(`vorname.ilike.%${m}%,nachname.ilike.%${m}%,email.ilike.%${m}%`).order("nachname");n.length>0&&(h=h.not("id","in",`(${n.join(",")})`));const{data:p}=await h;t=p||[],o(m),i.classList.add("show")}catch(h){console.warn("⚠️ Ansprechpartner-Suche fehlgeschlagen",h)}},200)}),i.addEventListener("click",c=>{const m=c.target.closest(".dropdown-item");if(!m||m.classList.contains("no-results"))return;s=m.dataset.id;const h=m.querySelector(".dropdown-item-main")?.textContent||m.textContent;r.value=h,a.querySelector("#add-ansprechpartner-unternehmen-confirm").disabled=!1,i.classList.remove("show")});const u=()=>{document.body.removeChild(a)},d=c=>{c.key==="Escape"&&(u(),document.removeEventListener("keydown",d))};document.addEventListener("keydown",d),a.querySelector("#add-ansprechpartner-unternehmen-close").onclick=()=>{u(),document.removeEventListener("keydown",d)},a.querySelector("#add-ansprechpartner-unternehmen-cancel").onclick=()=>{u(),document.removeEventListener("keydown",d)},a.querySelector("#add-ansprechpartner-unternehmen-confirm").onclick=async()=>{if(s)try{const{error:c}=await window.supabase.from("ansprechpartner_unternehmen").insert([{ansprechpartner_id:s,unternehmen_id:e}]);if(c)throw c;u(),document.removeEventListener("keydown",d),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"ansprechpartner",action:"added",unternehmenId:e}})),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"unternehmen",action:"ansprechpartner-added",id:e}})),alert("✅ Ansprechpartner wurde erfolgreich zum Unternehmen hinzugefügt und wird automatisch angezeigt!"),console.log("✅ ACTIONSDROPDOWN: Ansprechpartner erfolgreich zu Unternehmen hinzugefügt")}catch(c){console.error("❌ Fehler beim Hinzufügen des Ansprechpartners:",c),alert("Fehler beim Hinzufügen: "+(c.message||"Unbekannter Fehler"))}}}async openRemoveAnsprechpartnerFromUnternehmenModal(e){console.log("🎯 ACTIONSDROPDOWN: Öffne Ansprechpartner-Entfernen-Modal für Unternehmen:",e);let t=[];try{const{data:d}=await window.supabase.from("ansprechpartner_unternehmen").select(`
          ansprechpartner_id,
          ansprechpartner:ansprechpartner_id (
            id,
            vorname,
            nachname,
            email,
            position:position_id(name)
          )
        `).eq("unternehmen_id",e);t=(d||[]).filter(c=>c.ansprechpartner).map(c=>c.ansprechpartner)}catch(d){console.warn("⚠️ Fehler beim Laden der Ansprechpartner:",d)}if(t.length===0){alert("Diesem Unternehmen sind noch keine Ansprechpartner zugeordnet.");return}const n=document.createElement("div");n.className="modal overlay-modal",n.innerHTML=`
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Ansprechpartner vom Unternehmen entfernen</h3>
          <button class="modal-close" id="remove-ansprechpartner-unternehmen-close">×</button>
        </div>
        <div class="modal-body">
          <label class="form-label">Ansprechpartner wählen</label>
          <input type="text" id="ansprechpartner-unternehmen-remove-search" class="form-input auto-suggest-input" placeholder="Ansprechpartner suchen..." />
          <div id="ansprechpartner-unternehmen-remove-dropdown" class="auto-suggest-dropdown"></div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" id="remove-ansprechpartner-unternehmen-cancel">Abbrechen</button>
          <button class="danger-btn" id="remove-ansprechpartner-unternehmen-confirm" disabled>Entfernen</button>
        </div>
      </div>`,document.body.appendChild(n);const a=n.querySelector("#ansprechpartner-unternehmen-remove-search"),r=n.querySelector("#ansprechpartner-unternehmen-remove-dropdown");let i=null;const s=(d="")=>{if(!d||d.trim().length===0){r.innerHTML='<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Ansprechpartner zu suchen...</div>';return}const c=d.toLowerCase(),m=t.filter(h=>{const p=`${h.vorname} ${h.nachname}`.toLowerCase(),g=(h.email||"").toLowerCase();return p.includes(c)||g.includes(c)});r.innerHTML=m.length?m.map(h=>{const p=`${h.vorname} ${h.nachname}`,g=[h.email,h.position?.name].filter(Boolean).join(" • ");return`<div class="dropdown-item" data-id="${h.id}">
              <div class="dropdown-item-main">${p}</div>
              ${g?`<div class="dropdown-item-details">${g}</div>`:""}
            </div>`}).join(""):'<div class="dropdown-item no-results">Keine Ansprechpartner gefunden</div>'};r.innerHTML='<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Ansprechpartner zu suchen...</div>',a.addEventListener("focus",()=>{a.value.trim().length>0&&r.classList.add("show")}),a.addEventListener("blur",()=>{setTimeout(()=>r.classList.remove("show"),150)});let o;a.addEventListener("input",d=>{clearTimeout(o),o=setTimeout(()=>{const c=d.target.value.trim();if(c.length<1){r.classList.remove("show");return}s(c),r.classList.add("show")},200)}),r.addEventListener("click",d=>{const c=d.target.closest(".dropdown-item");if(!c||c.classList.contains("no-results"))return;i=c.dataset.id;const m=c.querySelector(".dropdown-item-main")?.textContent||c.textContent;a.value=m,n.querySelector("#remove-ansprechpartner-unternehmen-confirm").disabled=!1,r.classList.remove("show")});const l=()=>{document.body.removeChild(n)},u=d=>{d.key==="Escape"&&(l(),document.removeEventListener("keydown",u))};document.addEventListener("keydown",u),n.querySelector("#remove-ansprechpartner-unternehmen-close").onclick=()=>{l(),document.removeEventListener("keydown",u)},n.querySelector("#remove-ansprechpartner-unternehmen-cancel").onclick=()=>{l(),document.removeEventListener("keydown",u)},n.querySelector("#remove-ansprechpartner-unternehmen-confirm").onclick=async()=>{if(i)try{const{error:d}=await window.supabase.from("ansprechpartner_unternehmen").delete().eq("ansprechpartner_id",i).eq("unternehmen_id",e);if(d)throw d;l(),document.removeEventListener("keydown",u),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"ansprechpartner",action:"removed",unternehmenId:e}})),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"unternehmen",action:"ansprechpartner-removed",id:e}})),alert("✅ Ansprechpartner wurde erfolgreich vom Unternehmen entfernt!"),console.log("✅ ACTIONSDROPDOWN: Ansprechpartner erfolgreich von Unternehmen entfernt")}catch(d){console.error("❌ Fehler beim Entfernen des Ansprechpartners:",d),alert("Fehler beim Entfernen: "+(d.message||"Unbekannter Fehler"))}}}async openRemoveAnsprechpartnerFromUnternehmenModalNew(e){console.log("🎯 ACTIONSDROPDOWN: Öffne Ansprechpartner-Entfernen-Modal für Unternehmen (Tabelle):",e);let t=[];try{const{data:h}=await window.supabase.from("ansprechpartner_unternehmen").select(`
          ansprechpartner_id,
          ansprechpartner:ansprechpartner_id (
            id,
            vorname,
            nachname,
            email,
            telefonnummer,
            position:position_id(name),
            unternehmen:unternehmen_id(firmenname)
          )
        `).eq("unternehmen_id",e);t=(h||[]).filter(p=>p.ansprechpartner).map(p=>p.ansprechpartner)}catch(h){console.warn("⚠️ Fehler beim Laden der Ansprechpartner:",h)}if(t.length===0){alert("Diesem Unternehmen sind noch keine Ansprechpartner zugeordnet.");return}const n=t.map(h=>`
      <tr>
        <td>
          <input type="checkbox" class="ansprechpartner-remove-check" data-id="${h.id}" />
        </td>
        <td>
          <a href="#" onclick="event.preventDefault(); window.navigateTo('/ansprechpartner/${h.id}')" class="table-link">
            ${h.vorname} ${h.nachname}
          </a>
        </td>
        <td>${h.email||"-"}</td>
        <td>${h.telefonnummer||"-"}</td>
        <td>${h.position?.name||"-"}</td>
        <td>
          <button class="btn-remove-single danger-btn" data-id="${h.id}" title="Einzeln entfernen">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </td>
      </tr>
    `).join(""),a=document.createElement("div");a.className="modal overlay-modal modal-large",a.innerHTML=`
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Ansprechpartner vom Unternehmen entfernen</h3>
          <button class="modal-close" id="remove-ansprechpartner-unternehmen-close">×</button>
        </div>
        <div class="modal-body">
          <p class="modal-description">Wählen Sie die Ansprechpartner aus, die Sie vom Unternehmen entfernen möchten:</p>
          
          <!-- Bulk Actions -->
          <div class="bulk-actions">
            <button id="select-all-ansprechpartner" class="secondary-btn">Alle auswählen</button>
            <button id="deselect-all-ansprechpartner" class="secondary-btn">Auswahl aufheben</button>
            <span class="selected-count">0 ausgewählt</span>
          </div>
          
          <!-- Ansprechpartner Tabelle -->
          <div class="data-table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th width="40">
                    <input type="checkbox" id="select-all-header" />
                  </th>
                  <th>Name</th>
                  <th>E-Mail</th>
                  <th>Telefon</th>
                  <th>Position</th>
                  <th width="80">Aktion</th>
                </tr>
              </thead>
              <tbody>
                ${n}
              </tbody>
            </table>
          </div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" id="remove-ansprechpartner-unternehmen-cancel">Abbrechen</button>
          <button class="danger-btn" id="remove-selected-ansprechpartner" disabled>Ausgewählte entfernen</button>
        </div>
      </div>`,document.body.appendChild(a);const r=a.querySelectorAll(".ansprechpartner-remove-check"),i=a.querySelector("#select-all-header"),s=a.querySelector("#select-all-ansprechpartner"),o=a.querySelector("#deselect-all-ansprechpartner"),l=a.querySelector(".selected-count"),u=a.querySelector("#remove-selected-ansprechpartner"),d=()=>{const p=a.querySelectorAll(".ansprechpartner-remove-check:checked").length;l.textContent=`${p} ausgewählt`,u.disabled=p===0,p===0?(i.checked=!1,i.indeterminate=!1):p===r.length?(i.checked=!0,i.indeterminate=!1):(i.checked=!1,i.indeterminate=!0)};r.forEach(h=>{h.addEventListener("change",d)}),i.addEventListener("change",()=>{const h=i.checked;r.forEach(p=>{p.checked=h}),d()}),s.addEventListener("click",()=>{r.forEach(h=>{h.checked=!0}),d()}),o.addEventListener("click",()=>{r.forEach(h=>{h.checked=!1}),d()}),a.querySelectorAll(".btn-remove-single").forEach(h=>{h.addEventListener("click",async p=>{const g=p.target.closest(".btn-remove-single").dataset.id,b=t.find(w=>w.id===g),y=b?`${b.vorname} ${b.nachname}`:"Ansprechpartner";{let w=!1;const v=`Möchten Sie ${y} wirklich vom Unternehmen entfernen?`;if(window.confirmationModal?w=!!(await window.confirmationModal.open({title:"Entfernen bestätigen",message:v,confirmText:"Entfernen",cancelText:"Abbrechen",danger:!0}))?.confirmed:w=confirm(v),!w)return;await this.removeAnsprechpartnerFromUnternehmen(g,e),p.target.closest("tr").remove(),d(),a.querySelectorAll("tbody tr").length===0&&c()}})}),u.addEventListener("click",async()=>{const h=a.querySelectorAll(".ansprechpartner-remove-check:checked"),p=Array.from(h).map(b=>b.dataset.id);if(p.length===0)return;const g=p.length;{let b=!1;const y=`Möchten Sie wirklich ${g} Ansprechpartner vom Unternehmen entfernen?`;if(window.confirmationModal?b=!!(await window.confirmationModal.open({title:"Entfernen bestätigen",message:y,confirmText:"Entfernen",cancelText:"Abbrechen",danger:!0}))?.confirmed:b=confirm(y),!b)return;let w=0,v=0;for(const _ of p)try{await this.removeAnsprechpartnerFromUnternehmen(_,e),w++;const S=a.querySelector(`[data-id="${_}"]`);S&&S.closest("tr").remove()}catch(S){v++,console.error("❌ Fehler beim Entfernen:",S)}let k="";w>0&&(k+=`✅ ${w} Ansprechpartner erfolgreich entfernt.`),v>0&&(k+=`
❌ ${v} Ansprechpartner konnten nicht entfernt werden.`),alert(k),d(),a.querySelectorAll("tbody tr").length===0&&c()}});const c=()=>{document.body.removeChild(a)},m=h=>{h.key==="Escape"&&(c(),document.removeEventListener("keydown",m))};document.addEventListener("keydown",m),a.querySelector("#remove-ansprechpartner-unternehmen-close").onclick=()=>{c(),document.removeEventListener("keydown",m)},a.querySelector("#remove-ansprechpartner-unternehmen-cancel").onclick=()=>{c(),document.removeEventListener("keydown",m)},d()}async removeAnsprechpartnerFromUnternehmen(e,t){try{const{error:n}=await window.supabase.from("ansprechpartner_unternehmen").delete().eq("ansprechpartner_id",e).eq("unternehmen_id",t);if(n)throw n;return window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"ansprechpartner",action:"removed",unternehmenId:t}})),console.log("✅ ACTIONSDROPDOWN: Ansprechpartner erfolgreich von Unternehmen entfernt"),!0}catch(n){throw console.error("❌ Fehler beim Entfernen des Ansprechpartners:",n),n}}async openAddToListModal(e){let t=[],n=[];try{const{data:d}=await window.supabase.from("creator_list_member").select("list_id").eq("creator_id",e);n=(d||[]).map(m=>m.list_id).filter(Boolean);const{data:c}=await window.supabase.from("creator_list").select("id, name, created_at").order("created_at",{ascending:!1});t=(c||[]).filter(m=>!n.includes(m.id))}catch{}const a=document.createElement("div");a.className="modal overlay-modal",a.innerHTML=`
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Zu Liste hinzufügen</h3>
          <button class="modal-close" id="add-to-list-close">×</button>
        </div>
        <div class="modal-body">
          <label class="form-label">Liste wählen</label>
          <input type="text" id="list-search" class="form-input auto-suggest-input" placeholder="Liste suchen..." />
          <div id="list-dropdown" class="auto-suggest-dropdown"></div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" id="add-to-list-cancel">Abbrechen</button>
          <button class="primary-btn" id="add-to-list-confirm" disabled>Hinzufügen</button>
        </div>
      </div>`,document.body.appendChild(a);const r=a.querySelector("#list-search"),i=a.querySelector("#list-dropdown");let s=null;const o=(d="")=>{const c=d.toLowerCase(),m=t.filter(h=>(h.name||"").toLowerCase().includes(c));i.innerHTML=m.length?m.map(h=>`<div class="dropdown-item" data-id="${h.id}">${h.name}</div>`).join(""):'<div class="dropdown-item no-results">Keine Liste gefunden</div>',i.classList.add("show")};o(""),r.addEventListener("focus",()=>i.classList.add("show")),r.addEventListener("blur",()=>setTimeout(()=>i.classList.remove("show"),150));let l;r.addEventListener("input",()=>{clearTimeout(l),l=setTimeout(()=>o(r.value.trim()),150)}),i.addEventListener("click",d=>{const c=d.target.closest(".dropdown-item");!c||c.classList.contains("no-results")||(s=c.dataset.id,r.value=c.textContent.trim(),a.querySelector("#add-to-list-confirm").disabled=!1,i.classList.remove("show"))});const u=()=>a.remove();a.querySelector("#add-to-list-close").onclick=u,a.querySelector("#add-to-list-cancel").onclick=u,a.querySelector("#add-to-list-confirm").onclick=async()=>{if(s)try{await window.supabase.from("creator_list_member").insert({list_id:s,creator_id:e,added_at:new Date().toISOString()}),u(),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"creator_list",action:"member-added",id:s}})),alert("Creator zur Liste hinzugefügt.")}catch(d){console.error("❌ Fehler beim Hinzufügen zur Liste",d),alert("Hinzufügen fehlgeschlagen.")}}}async confirmDelete(e,t){const a=`Möchten Sie wirklich ${this.getEntityDisplayName(t)} löschen? Diese Aktion kann nicht rückgängig gemacht werden.`;let r=!1;if(window.confirmationModal?r=!!(await window.confirmationModal.open({title:"Löschvorgang bestätigen",message:a,confirmText:"Endgültig löschen",cancelText:"Abbrechen",danger:!0}))?.confirmed:r=confirm(a),!r)return;console.log(`🗑️ Lösche ${t} ${e}`),(await window.dataService.deleteEntity(t,e))?.success&&window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:t,action:"deleted",id:e}}))}openNotizModal(e,t){console.log(`📝 Öffne Notiz-Modal für ${t} ${e}`)}openRatingModal(e,t){console.log(`⭐ Öffne Rating-Modal für ${t} ${e}`)}openRechnungModal(e,t){console.log(`💰 Öffne Rechnung-Modal für ${t} ${e}`)}getEntityDisplayName(e){return{creator:"den Creator",unternehmen:"das Unternehmen",marke:"die Marke",auftrag:"den Auftrag",kooperation:"die Kooperation"}[e]||"das Element"}async openAddAnsprechpartnerToKampagneModal(e){console.log("🎯 ACTIONSDROPDOWN: Öffne Ansprechpartner-Auswahl-Modal für Kampagne:",e);let t=[],n=[];try{const{data:c}=await window.supabase.from("ansprechpartner_kampagne").select("ansprechpartner_id").eq("kampagne_id",e);n=(c||[]).map(p=>p.ansprechpartner_id).filter(Boolean);let m=window.supabase.from("ansprechpartner").select(`
          id, 
          vorname, 
          nachname, 
          email,
          unternehmen:unternehmen_id(firmenname),
          position:position_id(name)
        `).order("nachname");n.length>0&&(m=m.not("id","in",`(${n.join(",")})`));const{data:h}=await m;t=h||[]}catch(c){console.warn("⚠️ Fehler beim Laden der Ansprechpartner:",c)}const a=document.createElement("div");a.className="modal overlay-modal",a.innerHTML=`
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Ansprechpartner zur Kampagne hinzufügen</h3>
          <button class="modal-close" id="add-ansprechpartner-kampagne-close">×</button>
        </div>
        <div class="modal-body">
          <label class="form-label">Ansprechpartner wählen</label>
          <input type="text" id="ansprechpartner-kampagne-search" class="form-input auto-suggest-input" placeholder="Ansprechpartner suchen..." />
          <div id="ansprechpartner-kampagne-dropdown" class="auto-suggest-dropdown"></div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" id="add-ansprechpartner-kampagne-cancel">Abbrechen</button>
          <button class="primary-btn" id="add-ansprechpartner-kampagne-confirm" disabled>Hinzufügen</button>
        </div>
      </div>`,document.body.appendChild(a);const r=a.querySelector("#ansprechpartner-kampagne-search"),i=a.querySelector("#ansprechpartner-kampagne-dropdown");let s=null;const o=(c="")=>{if(!c||c.trim().length===0){i.innerHTML='<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Ansprechpartner zu suchen...</div>';return}const m=c.toLowerCase(),h=t.filter(p=>{const g=`${p.vorname} ${p.nachname}`.toLowerCase(),b=(p.email||"").toLowerCase(),y=(p.unternehmen?.firmenname||"").toLowerCase();return g.includes(m)||b.includes(m)||y.includes(m)});i.innerHTML=h.length?h.map(p=>{const g=`${p.vorname} ${p.nachname}`,b=[p.email,p.unternehmen?.firmenname,p.position?.name].filter(Boolean).join(" • ");return`<div class="dropdown-item" data-id="${p.id}">
              <div class="dropdown-item-main">${g}</div>
              ${b?`<div class="dropdown-item-details">${b}</div>`:""}
            </div>`}).join(""):'<div class="dropdown-item no-results">Keine verfügbaren Ansprechpartner gefunden</div>'};i.innerHTML='<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Ansprechpartner zu suchen...</div>',r.addEventListener("focus",()=>{r.value.trim().length>0&&i.classList.add("show")}),r.addEventListener("blur",()=>{setTimeout(()=>i.classList.remove("show"),150)});let l;r.addEventListener("input",c=>{clearTimeout(l),l=setTimeout(async()=>{const m=c.target.value.trim();if(m.length<1){i.classList.remove("show");return}try{let h=window.supabase.from("ansprechpartner").select(`
              id, 
              vorname, 
              nachname, 
              email,
              unternehmen:unternehmen_id(firmenname),
              position:position_id(name)
            `).or(`vorname.ilike.%${m}%,nachname.ilike.%${m}%,email.ilike.%${m}%`).order("nachname");n.length>0&&(h=h.not("id","in",`(${n.join(",")})`));const{data:p}=await h;t=p||[],o(m),i.classList.add("show")}catch(h){console.warn("⚠️ Ansprechpartner-Suche fehlgeschlagen",h)}},200)}),i.addEventListener("click",c=>{const m=c.target.closest(".dropdown-item");if(!m||m.classList.contains("no-results"))return;s=m.dataset.id;const h=m.querySelector(".dropdown-item-main")?.textContent||m.textContent;r.value=h,a.querySelector("#add-ansprechpartner-kampagne-confirm").disabled=!1,i.classList.remove("show")});const u=()=>a.remove();a.querySelector("#add-ansprechpartner-kampagne-close").onclick=u,a.querySelector("#add-ansprechpartner-kampagne-cancel").onclick=u;const d=c=>{c.key==="Escape"&&(u(),document.removeEventListener("keydown",d))};document.addEventListener("keydown",d),a.querySelector("#add-ansprechpartner-kampagne-confirm").onclick=async()=>{if(s)try{const{error:c}=await window.supabase.from("ansprechpartner_kampagne").insert({kampagne_id:e,ansprechpartner_id:s});if(c)throw c;u(),document.removeEventListener("keydown",d),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"ansprechpartner",action:"added",kampagneId:e}})),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"kampagne",action:"ansprechpartner-added",id:e}})),alert("✅ Ansprechpartner wurde erfolgreich zur Kampagne hinzugefügt und wird automatisch angezeigt!"),console.log("✅ ACTIONSDROPDOWN: Ansprechpartner erfolgreich zu Kampagne hinzugefügt")}catch(c){console.error("❌ Fehler beim Hinzufügen des Ansprechpartners:",c),alert("Fehler beim Hinzufügen: "+(c.message||"Unbekannter Fehler"))}}}destroy(){console.log("🗑️ ACTIONSDROPDOWN: Cleanup"),this.closeAllDropdowns(),this.boundEventListeners.forEach(({element:e,type:t,handler:n})=>{e.removeEventListener(t,n)}),this.boundEventListeners.clear()}}const I=new Ke;class qe{constructor(){this.lists=[]}async init(){window.setHeadline("Listen"),await this.render(),await this.load(),await this.initFilters()}async render(){const e=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Listen</h1>
          <p>Gespeicherte Creator-Listen</p>
        </div>
        <div class="page-header-right">
          <button id="btn-new-list" class="primary-btn">Neue Liste</button>
        </div>
      </div>

      <div class="filter-bar">
        <div class="filter-left"><div id="filter-container"></div></div>
        <div class="filter-right">
          <button id="btn-filter-reset" class="secondary-btn" style="display:${this.hasActiveFilters()?"inline-block":"none"};">Filter zurücksetzen</button>
        </div>
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Creator</th>
              <th>Erstellt am</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody id="creator-lists-body">
            <tr><td colspan="4" class="loading">Lade Listen...</td></tr>
          </tbody>
        </table>
      </div>
    `;window.setContentSafely(window.content,e),document.getElementById("btn-new-list")?.addEventListener("click",t=>{t.preventDefault(),(async()=>{const{data:n,error:a}=await window.supabase.from("creator_list").insert({name:"Neue Liste",created_by:window.currentUser?.id,created_at:new Date().toISOString()}).select("id").single();!a&&n?.id?window.navigateTo(`/creator-lists/${n.id}`):alert("Liste konnte nicht erstellt werden.")})()})}async initFilters(){const e=document.getElementById("filter-container");e&&await A.renderFilterBar("creator_list",e,t=>this.onFiltersApplied(t),()=>this.onFiltersReset())}onFiltersApplied(e){A.applyFilters("creator_list",e),this.load()}onFiltersReset(){A.resetFilters("creator_list"),this.load()}hasActiveFilters(){const e=A.getFilters("creator_list");return Object.keys(e).length>0}async load(){const{data:e,error:t}=await window.supabase.from("creator_list").select("id, name, created_at, members:creator_list_member(count)").order("created_at",{ascending:!1});if(t)return console.error("❌ Fehler beim Laden der Listen:",t),this.updateTable([]);const n=(e||[]).map(a=>({id:a.id,name:a.name,created_at:a.created_at,count:a.members&&a.members[0]?.count||0}));this.lists=n,this.updateTable(n)}updateTable(e){const t=document.getElementById("creator-lists-body");if(!t)return;if(!e||e.length===0){t.innerHTML='<tr><td colspan="4" class="empty">Keine Listen vorhanden</td></tr>';return}const n=a=>a?new Intl.DateTimeFormat("de-DE").format(new Date(a)):"-";t.innerHTML=e.map(a=>`
      <tr>
        <td><a href="/creator-lists/${a.id}" onclick="event.preventDefault(); window.navigateTo('/creator-lists/${a.id}')">${window.validatorSystem.sanitizeHtml(a.name||a.id)}</a></td>
        <td>${a.count}</td>
        <td>${n(a.created_at)}</td>
        <td>
          <div class="actions-dropdown-container" data-entity-type="creator_list">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
            </button>
            <div class="actions-dropdown">
              <a href="#" class="action-item" data-action="view" data-id="${a.id}" onclick="event.preventDefault(); window.navigateTo('/creator/${a.id}')">Details anzeigen</a>
              <a href="#" class="action-item action-danger" data-action="delete" data-id="${a.id}" onclick="event.preventDefault(); (async()=>{ try{ await window.supabase.from('creator_list').delete().eq('id','${a.id}'); window.dispatchEvent(new CustomEvent('entityUpdated',{detail:{entity:'creator_list',action:'deleted',id:'${a.id}'}})); }catch(e){ alert('Löschen fehlgeschlagen'); } })()">Löschen</a>
            </div>
          </div>
        </td>
      </tr>
    `).join(""),I.normalizeIcons(document)}destroy(){}}const Ue=new qe;function He(f,e={}){const{showActions:t=!1}=e,n=i=>i?new Date(i).toLocaleDateString("de-DE"):"-",a=i=>Array.isArray(i)&&i.length>0?i.join(", "):"-",r=(f||[]).map(i=>{const s=i.id,o=i.kampagnenname||"Unbekannt",l=i.unternehmen?.firmenname||"-",u=i.marke?.markenname||"-",d=a(i.art_der_kampagne),c=i.status||"-",m=n(i.start),h=n(i.deadline),p=i.creatoranzahl??"-",g=i.videoanzahl??"-";return`
      <tr data-id="${s||""}">
        <td>
          ${s?`<a href="/kampagne/${s}" class="table-link" data-table="kampagne" data-id="${s}">${o}</a>`:o}
        </td>
        <td>${l}</td>
        <td>${u}</td>
        <td>${d}</td>
        <td><span class="status-badge status-${String(c).toLowerCase()}">${c}</span></td>
        <td>${m}</td>
        <td>${h}</td>
        <td>${p}</td>
        <td>${g}</td>
        ${t?"<td></td>":""}
      </tr>
    `}).join("");return`
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Kampagnenname</th>
            <th>Unternehmen</th>
            <th>Marke</th>
            <th>Art der Kampagne</th>
            <th>Status</th>
            <th>Start</th>
            <th>Deadline</th>
            <th>Creator Anzahl</th>
            <th>Video Anzahl</th>
            ${t?"<th>Aktionen</th>":""}
          </tr>
        </thead>
        <tbody>
          ${r||""}
        </tbody>
      </table>
    </div>
  `}class Oe{constructor(){this.creatorId=null,this.creator=null,this.notizen=[],this.ratings=[],this.kampagnen=[],this.lists=[],this.kooperationen=[],this.rechnungen=[],this.unternehmen=[]}async init(e){if(console.log("🎯 CREATORDETAIL: Initialisiere Creator-Detailseite für ID:",e),this.creatorId=e,window.moduleRegistry?.currentModule!==this){console.log("⚠️ CREATORDETAIL: Nicht mehr das aktuelle Modul, breche ab");return}try{if(await this.loadCreatorData(),window.breadcrumbSystem&&this.creator){const t=[this.creator.vorname,this.creator.nachname].filter(Boolean).join(" ")||"Details";window.breadcrumbSystem.updateBreadcrumb([{label:"Creator",url:"/creator",clickable:!0},{label:t,url:`/creator/${this.creatorId}`,clickable:!1}])}await this.render(),this.bindEvents(),console.log("✅ CREATORDETAIL: Initialisierung abgeschlossen")}catch(t){console.error("❌ CREATORDETAIL: Fehler bei der Initialisierung:",t),window.ErrorHandler.handle(t,"CreatorDetail.init")}}async loadCreatorData(){console.log("🔄 CREATORDETAIL: Lade Creator-Daten...");const{data:e,error:t}=await window.supabase.from("creator").select("*").eq("id",this.creatorId).single();if(t)throw new Error(`Fehler beim Laden der Creator-Daten: ${t.message}`);this.creator=e,console.log("✅ CREATORDETAIL: Creator-Basisdaten geladen:",e);try{const{data:s}=await window.supabase.from("creator_sprachen").select("sprache_id, sprachen:sprache_id(id, name)").eq("creator_id",this.creatorId);this.creator.sprachen=(s||[]).map(o=>o.sprachen).filter(Boolean)}catch{}try{const{data:s}=await window.supabase.from("creator_branchen").select("branche_id, branchen_creator:branche_id(id, name)").eq("creator_id",this.creatorId);this.creator.branchen=(s||[]).map(o=>o.branchen_creator).filter(Boolean)}catch{}try{const{data:s}=await window.supabase.from("creator_creator_type").select("creator_type_id, creator_type:creator_type_id(id, name)").eq("creator_id",this.creatorId);this.creator.creator_types=(s||[]).map(o=>o.creator_type).filter(Boolean)}catch{}this.notizen=await window.notizenSystem.loadNotizen("creator",this.creatorId),console.log("✅ CREATORDETAIL: Notizen geladen:",this.notizen.length),this.ratings=await window.bewertungsSystem.loadBewertungen("creator",this.creatorId),console.log("✅ CREATORDETAIL: Ratings geladen:",this.ratings.length);const{data:n,error:a}=await window.supabase.from("kampagne_creator").select(`
        *,
        kampagne:kampagne_id (
          id,
          kampagnenname,
          status,
          start,
          deadline,
          unternehmen:unternehmen_id (
            id,
            firmenname
          ),
          marke:marke_id (
            id,
            markenname
          )
        )
      `).eq("creator_id",this.creatorId).order("hinzugefuegt_am",{ascending:!1});a||(this.kampagnen=n||[]),console.log("✅ CREATORDETAIL: Kampagnen geladen:",this.kampagnen.length);try{const{data:s}=await window.supabase.from("kooperationen").select(`
          id,
          name,
          status,
          videoanzahl,
          gesamtkosten,
          kampagne:kampagne_id ( id, kampagnenname ),
          created_at
        `).eq("creator_id",this.creatorId).order("created_at",{ascending:!1});this.kooperationen=s||[]}catch(s){console.warn("⚠️ CREATORDETAIL: Kooperationen konnten nicht geladen werden",s),this.kooperationen=[]}console.log("✅ CREATORDETAIL: Kooperationen geladen:",this.kooperationen.length);try{const s=(this.kooperationen||[]).map(o=>o.id).filter(Boolean);if(s.length>0){const{data:o}=await window.supabase.from("rechnung").select("id, rechnung_nr, status, nettobetrag, bruttobetrag, gestellt_am, bezahlt_am, pdf_url, kooperation_id").in("kooperation_id",s).order("gestellt_am",{ascending:!1});this.rechnungen=o||[]}else this.rechnungen=[]}catch{this.rechnungen=[]}try{const s=(this.kooperationen||[]).filter(d=>d.kampagne).map(d=>({kampagne:{id:d.kampagne.id,kampagnenname:d.kampagne.kampagnenname,status:d.status||null,start:null,deadline:null,unternehmen:null,marke:null},hinzugefuegt_am:d.created_at||null,notiz:null})),o=[...this.kampagnen||[],...s],l=new Set;this.kampagnen=o.filter(d=>{const c=d?.kampagne?.id||d?.kampagne_id||d?.kampagne?.kampagnenname;return c?l.has(c)?!1:(l.add(c),!0):!0});const u=Array.from(new Set(this.kampagnen.map(d=>d?.kampagne?.id||d?.kampagne_id).filter(Boolean)));if(u.length>0){const{data:d}=await window.supabase.from("kampagne").select("id, unternehmen:unternehmen_id ( firmenname ), marke:marke_id ( markenname )").in("id",u),c=(d||[]).reduce((m,h)=>(m[h.id]=h,m),{});this.kampagnen=this.kampagnen.map(m=>{const h=m?.kampagne?.id||m?.kampagne_id,p=h?c[h]:null;return p&&(m.kampagne||(m.kampagne={id:h}),m.kampagne.unternehmen||(m.kampagne.unternehmen=p.unternehmen||null),m.kampagne.marke||(m.kampagne.marke=p.marke||null)),m})}}catch(s){console.warn("⚠️ CREATORDETAIL: Kampagnen-Merge aus Kooperationen fehlgeschlagen",s)}const{data:r,error:i}=await window.supabase.from("creator_list_member").select(`
        *,
        list:list_id (
          id,
          name,
          created_at
        )
      `).eq("creator_id",this.creatorId).order("added_at",{ascending:!1});i||(this.lists=r||[]),console.log("✅ CREATORDETAIL: Listen geladen:",this.lists.length);try{const s=(this.kampagnen||[]).map(c=>c?.kampagne?.unternehmen).filter(Boolean),o=(this.kooperationen||[]).map(c=>c?.kampagne?.id).filter(Boolean);let l=[];if(o.length>0){const{data:c}=await window.supabase.from("kampagne").select("id, unternehmen:unternehmen_id ( id, firmenname )").in("id",Array.from(new Set(o)));l=(c||[]).map(m=>m.unternehmen).filter(Boolean)}const u=[...s,...l].filter(Boolean),d=new Map;u.forEach(c=>{c?.id&&d.set(c.id,c)}),this.unternehmen=Array.from(d.values())}catch{this.unternehmen=[]}}async render(){if(!this.creator){window.setHeadline("Creator nicht gefunden"),window.content.innerHTML=`
        <div class="error-message">
          <p>Der angeforderte Creator wurde nicht gefunden.</p>
          <button onclick="window.navigateTo('/creator')" class="secondary-btn">Zurück zur Übersicht</button>
        </div>
      `;return}window.setHeadline(`${this.creator.vorname} ${this.creator.nachname}`);const e=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>${this.creator.vorname} ${this.creator.nachname}</h1>
          <p>Creator Details und Aktivitäten</p>
        </div>
        <div class="page-header-right">
          <button id="btn-edit-creator" class="primary-btn">Creator bearbeiten</button>
          <button onclick="window.navigateTo('/creator')" class="secondary-btn">Zurück zur Übersicht</button>
        </div>
      </div>

      <div class="content-section">
        <!-- Tab Navigation -->
        <div class="tab-navigation">
          <button class="tab-button active" data-tab="info">
            <i class="icon-user"></i>
            Informationen
          </button>
          <button class="tab-button" data-tab="notizen">
            <i class="icon-document-text"></i>
            Notizen
            <span class="tab-count">${this.notizen.length}</span>
          </button>
          <button class="tab-button" data-tab="ratings">
            
            Bewertungen
            <span class="tab-count">${this.ratings.length}</span>
          </button>
          <button class="tab-button" data-tab="kampagnen">
            <i class="icon-megaphone"></i>
            Kampagnen
            <span class="tab-count">${this.kampagnen.length}</span>
          </button>
          <button class="tab-button" data-tab="kooperationen">
            <i class="icon-handshake"></i>
            Kooperationen
            <span class="tab-count">${this.kooperationen.length}</span>
          </button>
          <button class="tab-button" data-tab="listen">
            <i class="icon-list"></i>
            Listen
            <span class="tab-count">${this.lists.length}</span>
          </button>
          <button class="tab-button" data-tab="rechnungen">
            <i class="icon-currency-euro"></i>
            Rechnungen
            <span class="tab-count">${this.rechnungen.length}</span>
          </button>
          <button class="tab-button" data-tab="unternehmen">
            <i class="icon-building"></i>
            Unternehmen
            <span class="tab-count">${(this.unternehmen||[]).length}</span>
          </button>
          <button class="tab-button" data-tab="adresse">
            <i class="icon-map-pin"></i>
            Adresse
          </button>
        </div>

        <!-- Tab Content -->
        <div class="tab-content">
          <!-- Informationen Tab -->
          <div class="tab-pane active" id="tab-info">
            <div class="detail-section">
              <h2>Creator Informationen</h2>
              <div class="detail-grid">
                <div class="detail-card">
                  <h3>Kontakt</h3>
                  <div class="detail-item">
                    <label>E-Mail:</label>
                    <span>${this.creator.mail||"-"}</span>
                  </div>
                  <div class="detail-item">
                    <label>Telefon:</label>
                    <span>${this.creator.telefonnummer||"-"}</span>
                  </div>
                  <div class="detail-item">
                    <label>Stadt:</label>
                    <span>${this.creator.lieferadresse_stadt||"-"}</span>
                  </div>
                  <div class="detail-item">
                    <label>Land:</label>
                    <span>${this.creator.lieferadresse_land||"-"}</span>
                  </div>
                </div>

                <div class="detail-card">
                  <h3>Social Media</h3>
                  <div class="detail-item">
                    <label>Instagram:</label>
                    <span>${this.creator.instagram?`@${this.creator.instagram}`:"-"}</span>
                  </div>
                  <div class="detail-item">
                    <label>Instagram Follower:</label>
                    <span>${this.creator.instagram_follower?this.formatNumber(this.creator.instagram_follower):"-"}</span>
                  </div>
                  <div class="detail-item">
                    <label>TikTok:</label>
                    <span>${this.creator.tiktok?`@${this.creator.tiktok}`:"-"}</span>
                  </div>
                  <div class="detail-item">
                    <label>TikTok Follower:</label>
                    <span>${this.creator.tiktok_follower?this.formatNumber(this.creator.tiktok_follower):"-"}</span>
                  </div>
                </div>

                <div class="detail-card">
                  <h3>Profil</h3>
                  <div class="detail-item">
                    <label>Typen:</label>
                    <span>${this.renderTagList(this.creator.creator_types)}</span>
                  </div>
                  <div class="detail-item">
                    <label>Sprachen:</label>
                    <span>${this.renderTagList(this.creator.sprachen)}</span>
                  </div>
                  <div class="detail-item">
                    <label>Branchen:</label>
                    <span>${this.renderTagList(this.creator.branchen)}</span>
                  </div>
                  <div class="detail-item">
                    <label>Portfolio:</label>
                    <span>${this.creator.portfolio_link?`<a href="${this.creator.portfolio_link}" target="_blank">Link</a>`:"-"}</span>
                  </div>
                </div>

                <div class="detail-card">
                  <h3>Finanzen</h3>
                  <div class="detail-item">
                    <label>Letztes Budget:</label>
                    <span>${this.creator.budget_letzte_buchung?this.formatCurrency(this.creator.budget_letzte_buchung):"-"}</span>
                  </div>
                  <div class="detail-item">
                    <label>Erstellt:</label>
                    <span>${this.formatDate(this.creator.created_at)}</span>
                  </div>
                  <div class="detail-item">
                    <label>Aktualisiert:</label>
                    <span>${this.formatDate(this.creator.updated_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Notizen Tab -->
          <div class="tab-pane" id="tab-notizen">
            <div class="detail-section">
              <h2>Notizen</h2>
              ${this.renderNotizen()}
            </div>
          </div>

          <!-- Ratings Tab -->
          <div class="tab-pane" id="tab-ratings">
            <div class="detail-section">
              <h2>Bewertungen</h2>
              ${this.renderRatings()}
            </div>
          </div>

          <!-- Kampagnen Tab -->
          <div class="tab-pane" id="tab-kampagnen">
            <div class="detail-section">
              <h2>Kampagnen</h2>
              ${this.renderKampagnen()}
            </div>
          </div>

          <!-- Kooperationen Tab -->
          <div class="tab-pane" id="tab-kooperationen">
            <div class="detail-section">
              <h2>Kooperationen</h2>
              ${this.renderKooperationen()}
            </div>
          </div>

          <!-- Listen Tab -->
          <div class="tab-pane" id="tab-listen">
            <div class="detail-section">
              <h2>Listen</h2>
              ${this.renderLists()}
            </div>
          </div>
          
          <!-- Rechnungen Tab -->
          <div class="tab-pane" id="tab-rechnungen">
            <div class="detail-section">
              <h2>Rechnungen</h2>
              ${this.renderRechnungen()}
            </div>
          </div>
          <!-- Unternehmen Tab -->
          <div class="tab-pane" id="tab-unternehmen">
            <div class="detail-section">
              <h2>Unternehmen</h2>
              ${this.renderUnternehmen()}
            </div>
          </div>
          <!-- Adresse Tab -->
          <div class="tab-pane" id="tab-adresse">
            <div class="detail-section">
              <h2>Adresse</h2>
              ${this.renderAdresse()}
            </div>
          </div>
        </div>
      </div>
    `;window.setContentSafely(window.content,e)}renderTagList(e){if(!e||e.length===0)return"-";if(Array.isArray(e))return`<div class="tags">${e.map(n=>{const a=typeof n=="object"&&(n.name||n.label)||n;return`<span class="tag">${String(a).trim()}</span>`}).join("")}</div>`;if(typeof e=="object"){const t=e.name||e.label;return t?`<div class="tags"><span class="tag">${t}</span></div>`:"-"}return`<div class="tags"><span class="tag">${String(e)}</span></div>`}renderNotizen(){return window.notizenSystem.renderNotizenContainer(this.notizen,"creator",this.creatorId)}renderRatings(){return window.bewertungsSystem.renderBewertungenContainer(this.ratings,"creator",this.creatorId)}renderKampagnen(){if(!this.kampagnen||this.kampagnen.length===0)return`
        <div class="empty-state">
          <p>Noch keine Kampagnen zugeordnet.</p>
        </div>
      `;const e=this.kampagnen.map(t=>{const n=t.kampagne||t;return{id:n.id,kampagnenname:n.kampagnenname,unternehmen:n.unternehmen||null,marke:n.marke||null,art_der_kampagne:n.art_der_kampagne,status:n.status,start:n.start,deadline:n.deadline,creatoranzahl:n.creatoranzahl,videoanzahl:n.videoanzahl}});return He(e,{showActions:!1})}renderLists(){return this.lists.length===0?`
        <div class="empty-state">
          <p>Noch keiner Liste zugeordnet.</p>
        </div>
      `:`
      <div class="lists-container">
        ${this.lists.map(t=>`
      <div class="list-card">
        <div class="list-header">
          <h4>${t.list.name}</h4>
          <span class="list-date">Hinzugefügt: ${this.formatDate(t.added_at)}</span>
        </div>
        <div class="list-details">
          <small>Liste erstellt: ${this.formatDate(t.list.created_at)}</small>
        </div>
      </div>
    `).join("")}
      </div>
    `}renderKooperationen(){return this.kooperationen.length===0?`
        <div class="empty-state">
          <div class="empty-icon">🤝</div>
          <h3>Keine Kooperationen vorhanden</h3>
          <p>Für diesen Creator wurden noch keine Kooperationen erstellt.</p>
        </div>
      `:`
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Kampagne</th>
              <th>Unternehmen</th>
              <th>Status</th>
              <th>Content Art</th>
              <th>Videos</th>
              <th>Gesamtkosten</th>
              <th>Skript Deadline</th>
              <th>Content Deadline</th>
              <th>Erstellt</th>
            </tr>
          </thead>
          <tbody>${this.kooperationen.map(t=>`
      <tr>
        <td>
          <a href="/kooperation/${t.id}" onclick="event.preventDefault(); window.navigateTo('/kooperation/${t.id}')">
            ${window.validatorSystem.sanitizeHtml(t.name||"Kooperation")}
          </a>
        </td>
        <td>
          <a href="/kampagne/${t.kampagne?.id||""}" onclick="event.preventDefault(); window.navigateTo('/kampagne/${t.kampagne?.id||""}')">
            ${window.validatorSystem.sanitizeHtml(t.kampagne?.kampagnenname||"-")}
          </a>
        </td>
        <td>${window.validatorSystem.sanitizeHtml(t.unternehmen?.firmenname||"-")}</td>
        <td><span class="status-badge status-${(t.status||"unknown").toLowerCase().replace(/\s+/g,"-")}">${t.status||"-"}</span></td>
        <td>${window.validatorSystem.sanitizeHtml(t.content_art||"-")}</td>
        <td>${t.videoanzahl||0}</td>
        <td>${t.gesamtkosten?this.formatCurrency(t.gesamtkosten):"-"}</td>
        <td>${this.formatDate(t.skript_deadline)}</td>
        <td>${this.formatDate(t.content_deadline)}</td>
        <td>${this.formatDate(t.created_at)}</td>
      </tr>
    `).join("")}</tbody>
        </table>
      </div>
    `}renderRechnungen(){if(!this.rechnungen||this.rechnungen.length===0)return`
        <div class="empty-state">
          <p>Keine Rechnungen vorhanden.</p>
        </div>
      `;const e=a=>a?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(a):"-",t=a=>a?new Date(a).toLocaleDateString("de-DE"):"-";return`
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Rechnungs-Nr</th>
              <th>Status</th>
              <th>Netto</th>
              <th>Brutto</th>
              <th>Gestellt</th>
              <th>Bezahlt</th>
              <th>Beleg</th>
            </tr>
          </thead>
          <tbody>${this.rechnungen.map(a=>`
      <tr>
        <td><a href="/rechnung/${a.id}" onclick="event.preventDefault(); window.navigateTo('/rechnung/${a.id}')">${window.validatorSystem.sanitizeHtml(a.rechnung_nr||"—")}</a></td>
        <td>${a.status||"-"}</td>
        <td>${e(a.nettobetrag)}</td>
        <td>${e(a.bruttobetrag)}</td>
        <td>${t(a.gestellt_am)}</td>
        <td>${t(a.bezahlt_am)}</td>
        <td>${a.pdf_url?`<a href="${a.pdf_url}" target="_blank" rel="noopener">PDF</a>`:"-"}</td>
      </tr>
    `).join("")}</tbody>
        </table>
      </div>
    `}renderUnternehmen(){const e=this.unternehmen||[];return e.length?`
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Unternehmen</th>
            </tr>
          </thead>
          <tbody>${e.map(n=>`
      <tr>
        <td><a href="/unternehmen/${n.id}" class="table-link" data-table="unternehmen" data-id="${n.id}">${window.validatorSystem.sanitizeHtml(n.firmenname||"—")}</a></td>
      </tr>`).join("")}</tbody>
        </table>
      </div>`:'<p class="empty-state">Keine Unternehmen vorhanden.</p>'}renderAdresse(){const e=this.creator||{},t=a=>a==null||a===""||a==="-"?"-":window.validatorSystem.sanitizeHtml(String(a)),n=[{label:"Straße",value:e.lieferadresse_strasse||"-"},{label:"Hausnummer",value:e.lieferadresse_hausnummer||"-"},{label:"PLZ",value:e.lieferadresse_plz||"-"},{label:"Stadt",value:e.lieferadresse_stadt||"-"},{label:"Land",value:e.lieferadresse_land||"-"}];return`
      <div class="data-table-container">
        <table class="data-table" id="creator-address-table">
          <thead>
            <tr>
              ${n.map(a=>`<th>${t(a.label)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            <tr>
              ${n.map(a=>`<td>${t(a.value)}</td>`).join("")}
            </tr>
          </tbody>
        </table>
      </div>
    `}formatFullAddress(e){const t=[e?.lieferadresse_strasse,e?.lieferadresse_hausnummer,e?.lieferadresse_plz,e?.lieferadresse_stadt,e?.lieferadresse_land].filter(Boolean);return t.length?t.join(", "):"-"}bindEvents(){document.addEventListener("click",e=>{e.target.classList.contains("tab-button")&&(e.preventDefault(),this.switchTab(e.target.dataset.tab))}),document.addEventListener("click",e=>{const t=e.target.closest&&e.target.closest(".table-link");t&&t.dataset.table==="unternehmen"&&(e.preventDefault(),window.navigateTo(`/unternehmen/${t.dataset.id}`))}),document.addEventListener("click",e=>{e.target.id==="btn-edit-creator"&&(e.preventDefault(),this.showEditForm())}),document.addEventListener("click",e=>{if(e.target.hasAttribute("data-kampagne-id")){e.preventDefault();const t=e.target.getAttribute("data-kampagne-id");window.navigateTo(`/kampagne/${t}`)}}),window.addEventListener("notizenUpdated",async e=>{e.detail.entityType==="creator"&&e.detail.entityId===this.creatorId&&(console.log("🔄 CREATORDETAIL: Notizen wurden aktualisiert, lade neu..."),this.notizen=await window.notizenSystem.loadNotizen("creator",this.creatorId),this.renderNotizen())}),window.addEventListener("bewertungenUpdated",async e=>{e.detail.entityType==="creator"&&e.detail.entityId===this.creatorId&&(console.log("🔄 CREATORDETAIL: Bewertungen wurden aktualisiert, lade neu..."),this.ratings=await window.bewertungsSystem.loadBewertungen("creator",this.creatorId),this.renderRatings())})}switchTab(e){console.log("🔄 CREATORDETAIL: Wechsle zu Tab:",e),document.querySelectorAll(".tab-button").forEach(a=>{a.classList.remove("active")}),document.querySelectorAll(".tab-pane").forEach(a=>{a.classList.remove("active")});const t=document.querySelector(`[data-tab="${e}"]`),n=document.getElementById(`tab-${e}`);t&&n&&(t.classList.add("active"),n.classList.add("active"))}showAddNotizModal(){console.log("📝 CREATORDETAIL: Zeige Add Notiz Modal")}showAddRatingModal(){console.log("⭐ CREATORDETAIL: Zeige Add Rating Modal")}showEditForm(){console.log("🎯 CREATORDETAIL: Zeige Creator-Bearbeitungsformular für ID:",this.creatorId),window.setHeadline("Creator bearbeiten");const e={...this.creator,_isEditMode:!0,_entityId:this.creatorId,sprachen_ids:this.creator.sprachen?this.creator.sprachen.map(a=>a.id):[],branchen_ids:this.creator.branchen?this.creator.branchen.map(a=>a.id):[],creator_type_ids:this.creator.creator_types?this.creator.creator_types.map(a=>a.id):[]};console.log("📋 CREATORDETAIL: Edit-Daten vorbereitet:",{sprachen_ids:e.sprachen_ids,branchen_ids:e.branchen_ids,creator_type_ids:e.creator_type_ids});const t=window.formSystem.renderFormOnly("creator",e);window.setContentSafely(window.content,`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Creator bearbeiten</h1>
          <p>Bearbeiten Sie die Informationen von ${this.creator.vorname} ${this.creator.nachname}</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/creator/${this.creatorId}')" class="secondary-btn">Zurück zu Details</button>
        </div>
      </div>
      
      <div class="form-page">
        ${t}
      </div>
    `),window.formSystem.bindFormEvents("creator",e);const n=document.getElementById("creator-form");n&&(n.onsubmit=async a=>{a.preventDefault(),await this.handleEditFormSubmit()})}async handleEditFormSubmit(){try{const e=document.getElementById("creator-form"),t=new FormData(e),n={};e.querySelectorAll('select[data-tag-based="true"]').forEach(s=>{const o=s.name;let l=e.querySelector(`select[name="${o}[]"][style*="display: none"]`);if(l||(l=e.querySelector(`select[name="${o}"][style*="display: none"]`)),!l){const u=e.querySelector(`select[name="${o}"]`)?.closest(".form-field")?.querySelector(".tag-based-select");if(u){const d=u.querySelectorAll(".tag[data-value]"),c=Array.from(d).map(m=>m.dataset.value).filter(Boolean);if(c.length>0){n[o]=c,console.log(`🏷️ Tag-basiertes Feld ${o} aus Tags gesammelt:`,c);return}}}if(l){const u=Array.from(l.selectedOptions).map(d=>d.value).filter(Boolean);u.length>0&&(n[o]=u,console.log(`🏷️ Tag-basiertes Feld ${o} aus Hidden-Select gesammelt:`,u))}else console.warn(`⚠️ Kein Hidden-Select oder Tags für ${o} gefunden`)});for(const[s,o]of t.entries())if(s.includes("[]")){const l=s.replace("[]","");n[l]||(n[l]=[]),n[l].push(o)}else!n.hasOwnProperty(s)||!Array.isArray(n[s])?n[s]=o:console.log(`⚠️ Überspringe ${s}, bereits als Array gesetzt:`,n[s]);const r=window.validatorSystem.validateForm(n,{vorname:{type:"text",minLength:2,required:!0},nachname:{type:"text",minLength:2,required:!0},mail:{type:"email"},telefonnummer:{type:"phone"},portfolio_link:{type:"url"}});if(!r.isValid){this.showValidationErrors(r.errors);return}const i=await window.dataService.updateEntity("creator",this.creatorId,n);if(i.success)this.showSuccessMessage("Creator erfolgreich aktualisiert!"),setTimeout(async()=>{await this.loadCreatorData(),await this.render(),window.navigateTo(`/creator/${this.creatorId}`)},1500);else throw new Error(i.error||"Unbekannter Fehler")}catch(e){console.error("❌ Edit Formular-Submit Fehler:",e),this.showErrorMessage(e.message)}}showValidationErrors(e){console.log("❌ Validierungsfehler:",e),document.querySelectorAll(".validation-error").forEach(t=>t.remove()),Object.keys(e).forEach(t=>{const n=document.querySelector(`[name="${t}"]`);if(n){const a=document.createElement("div");a.className="validation-error",a.textContent=e[t],a.style.color="#dc3545",a.style.fontSize="0.875rem",a.style.marginTop="0.25rem",n.parentNode.appendChild(a),n.style.borderColor="#dc3545"}})}showSuccessMessage(e){const t=document.createElement("div");t.className="alert alert-success",t.textContent=e,t.style.cssText=`
      background: #d4edda;
      color: #155724;
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      border: 1px solid #c3e6cb;
    `;const n=document.querySelector(".form-page");n&&n.insertBefore(t,n.firstChild)}showErrorMessage(e){const t=document.createElement("div");t.className="alert alert-danger",t.textContent=e,t.style.cssText=`
      background: #f8d7da;
      color: #721c24;
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      border: 1px solid #f5c6cb;
    `;const n=document.querySelector(".form-page");n&&n.insertBefore(t,n.firstChild)}formatNumber(e){return e>=1e6?(e/1e6).toFixed(1)+"M":e>=1e3?(e/1e3).toFixed(1)+"K":e.toString()}formatCurrency(e){return new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(e)}formatDate(e){return e?new Date(e).toLocaleDateString("de-DE"):"-"}destroy(){console.log("🗑️ CREATORDETAIL: Destroy aufgerufen"),window.setContentSafely(""),console.log("✅ CREATORDETAIL: Destroy abgeschlossen")}}const X=new Oe;class Ve{constructor(){this.listId=null,this.list=null,this.members=[]}async init(e){this.listId=e,await this.load(),await this.render()}async load(){try{const[{data:e},{data:t}]=await Promise.all([window.supabase.from("creator_list").select("id, name, created_at").eq("id",this.listId).single(),window.supabase.from("creator_list_member").select(`
            id,
            added_at,
            creator:creator_id (
              id,
              vorname,
              nachname,
              instagram,
              tiktok,
              mail,
              lieferadresse_stadt,
              lieferadresse_land
            )
          `).eq("list_id",this.listId).order("added_at",{ascending:!1})]);this.list=e||{id:this.listId,name:"-"},this.members=(t||[]).filter(n=>!!n.creator)}catch(e){console.error("❌ Fehler beim Laden der Creator-Liste:",e),this.list={id:this.listId,name:"-"},this.members=[]}}async render(){const e=this.members.length;window.setHeadline(`Liste: ${window.validatorSystem.sanitizeHtml(this.list?.name||"-")}`);const t=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>${window.validatorSystem.sanitizeHtml(this.list?.name||"-")}</h1>
          <p>${e} Creator</p>
        </div>
        <div class="page-header-right">
          <button class="secondary-btn" id="btn-back-lists">Zurück zu Listen</button>
        </div>
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Creator</th>
              <th>Instagram</th>
              <th>TikTok</th>
              <th>E-Mail</th>
              <th>Ort</th>
              <th>Hinzugefügt</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody id="creator-list-detail-body">
            ${this.members.map(n=>this.renderRow(n)).join("")||'<tr><td colspan="7" class="empty">Keine Creator</td></tr>'}
          </tbody>
        </table>
      </div>
    `;window.setContentSafely(window.content,t),I.normalizeIcons(document),document.getElementById("btn-back-lists")?.addEventListener("click",n=>{n.preventDefault(),window.navigateTo("/creator-lists")})}renderRow(e){const t=e.creator||{},n=[t.vorname,t.nachname].filter(Boolean).join(" ")||t.id||"-",a=t.instagram?`@${t.instagram}`:"-",r=t.tiktok?`@${t.tiktok}`:"-",i=t.mail||"-",s=[t.lieferadresse_stadt,t.lieferadresse_land].filter(Boolean).join(", ")||"-",o=e.added_at?new Intl.DateTimeFormat("de-DE").format(new Date(e.added_at)):"-";return`
      <tr>
        <td><a href="/creator/${t.id}" onclick="event.preventDefault(); window.navigateTo('/creator/${t.id}')">${window.validatorSystem.sanitizeHtml(n)}</a></td>
        <td>${window.validatorSystem.sanitizeHtml(a)}</td>
        <td>${window.validatorSystem.sanitizeHtml(r)}</td>
        <td>${window.validatorSystem.sanitizeHtml(i)}</td>
        <td>${window.validatorSystem.sanitizeHtml(s)}</td>
        <td>${o}</td>
        <td>
          <div class="actions-dropdown-container" data-entity-type="creator">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
            </button>
            <div class="actions-dropdown">
              <a href="#" class="action-item" data-action="view" data-id="${t.id}" onclick="event.preventDefault(); window.navigateTo('/creator/${t.id}')">Details anzeigen</a>
              <a href="#" class="action-item" data-action="add_to_campaign" data-id="${t.id}">
                ${I.getHeroIcon("add-to-campaign")}
                Zu Kampagne hinzufügen
              </a>
            </div>
          </div>
        </td>
      </tr>
    `}destroy(){}}const Pe=new Ve;class je{constructor(){this.selectedUnternehmen=new Set,this._boundEventListeners=new Set}async init(){if(window.setHeadline("Unternehmen Übersicht"),window.breadcrumbSystem&&window.breadcrumbSystem.updateBreadcrumb([{label:"Unternehmen",url:"/unternehmen",clickable:!1}]),!(window.canViewPage&&window.canViewPage("unternehmen")||await window.checkUserPermission("unternehmen","can_view"))){window.content.innerHTML=`
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Unternehmen anzuzeigen.</p>
        </div>
      `;return}this.bindEvents(),await this.loadAndRender()}async loadAndRender(){try{await this.render();const e=A.getFilters("unternehmen");console.log("🔍 Lade Unternehmen mit Filter:",e);const t=await window.dataService.loadEntities("unternehmen",e);console.log("📊 Unternehmen geladen:",t?.length||0),this.updateTable(t)}catch(e){window.ErrorHandler.handle(e,"UnternehmenList.loadAndRender")}}async render(){const e=window.currentUser?.permissions?.unternehmen?.can_edit||!1,t=A.getFilters("unternehmen");Object.entries(t).forEach(([r,i])=>{});let n=`<div class="filter-bar">
      <div class="filter-left">
        <div id="filter-container"></div>
      </div>
      <div class="filter-right">
        <button id="btn-filter-reset" class="secondary-btn" style="display:${this.hasActiveFilters()?"inline-block":"none"};">Alle Filter zurücksetzen</button>
      </div>
    </div>`,a=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Unternehmen</h1>
          <p>Verwalten Sie alle Unternehmen und deren Kontakte</p>
        </div>
        <div class="page-header-right">
          ${e?'<button id="btn-unternehmen-new" class="primary-btn">Neues Unternehmen anlegen</button>':""}
        </div>
      </div>

      <div class="table-filter-wrapper">
        ${n}
        <div class="table-actions">
          <button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
          <span id="selected-count" style="display:none;">0 ausgewählt</span>
          <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th><input type="checkbox" id="select-all-unternehmen"></th>
              <th>Name</th>
              <th>Branche</th>
              <th>Ansprechpartner</th>
              <th>Rechnungs E-Mail</th>
              <th>Stadt</th>
              <th>Land</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="9" class="no-data">Lade Unternehmen...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;window.setContentSafely(window.content,a),await this.initializeFilterBar()}async initializeFilterBar(){const e=document.getElementById("filter-container");e&&await A.renderFilterBar("unternehmen",e,t=>this.onFiltersApplied(t),()=>this.onFiltersReset())}onFiltersApplied(e){console.log("Filter angewendet:",e),A.applyFilters("unternehmen",e),this.loadAndRender()}onFiltersReset(){console.log("Filter zurückgesetzt"),A.resetFilters("unternehmen"),this.loadAndRender()}bindEvents(){this.boundFilterResetHandler=e=>{e.target.id==="btn-filter-reset"&&this.onFiltersReset()},document.addEventListener("click",this.boundFilterResetHandler),document.addEventListener("click",e=>{(e.target.id==="btn-unternehmen-new"||e.target.id==="btn-unternehmen-new-filter")&&(e.preventDefault(),window.navigateTo("/unternehmen/new"))}),document.addEventListener("click",e=>{if(e.target.classList.contains("table-link")&&e.target.dataset.table==="unternehmen"){e.preventDefault();const t=e.target.dataset.id;console.log("🎯 UNTERNEHMENLIST: Navigiere zu Unternehmen Details:",t),window.navigateTo(`/unternehmen/${t}`)}}),document.addEventListener("click",e=>{if(e.target.id==="btn-select-all"){e.preventDefault(),document.querySelectorAll(".unternehmen-check").forEach(a=>{a.checked=!0,a.dataset.id&&this.selectedUnternehmen.add(a.dataset.id)});const n=document.getElementById("select-all-unternehmen");n&&(n.indeterminate=!1,n.checked=!0),this.updateSelection()}}),document.addEventListener("click",e=>{e.target.id==="btn-deselect-all"&&(e.preventDefault(),this.deselectAll())}),window.addEventListener("entityUpdated",e=>{e.detail.entity==="unternehmen"&&this.loadAndRender()}),document.addEventListener("click",e=>{if(e.target.classList.contains("tag-x")){e.preventDefault(),e.stopPropagation();const n=e.target.closest(".filter-tag").dataset.key,a=A.getFilters("unternehmen");delete a[n],A.applyFilters("unternehmen",a),this.loadAndRender()}}),document.addEventListener("change",e=>{if(e.target.id==="select-all-unternehmen"){const t=document.querySelectorAll(".unternehmen-check"),n=e.target.checked;t.forEach(a=>{a.checked=n,n?this.selectedUnternehmen.add(a.dataset.id):this.selectedUnternehmen.delete(a.dataset.id)}),this.updateSelection(),console.log(`${n?"✅ Alle Unternehmen ausgewählt":"❌ Alle Unternehmen abgewählt"}: ${this.selectedUnternehmen.size}`)}}),document.addEventListener("change",e=>{e.target.classList.contains("unternehmen-check")&&(e.target.checked?this.selectedUnternehmen.add(e.target.dataset.id):this.selectedUnternehmen.delete(e.target.dataset.id),this.updateSelection(),this.updateSelectAllCheckbox())}),window.bulkActionSystem&&window.bulkActionSystem.registerList("unternehmen",this)}hasActiveFilters(){const e=A.getFilters("unternehmen");return Object.keys(e).length>0}updateSelection(){const e=this.selectedUnternehmen.size,t=document.getElementById("selected-count"),n=document.getElementById("btn-deselect-all"),a=document.getElementById("btn-delete-selected");t&&(t.textContent=`${e} ausgewählt`,t.style.display=e>0?"inline":"none"),n&&(n.style.display=e>0?"inline-block":"none"),a&&(a.style.display=e>0?"inline-block":"none")}async updateTable(e){const t=document.querySelector(".data-table tbody");if(!t)return;if(!e||e.length===0){const{renderEmptyState:i}=await x(async()=>{const{renderEmptyState:s}=await import("./core-C7Vz5Umf.js").then(o=>o.F);return{renderEmptyState:s}},[]);i(t);return}const n=e.map(i=>i.id).filter(Boolean),a=await this.loadAnsprechpartnerMap(n),r=e.map(i=>`
      <tr data-id="${i.id}">
        <td><input type="checkbox" class="unternehmen-check" data-id="${i.id}"></td>
        <td>
          <a href="#" class="table-link" data-table="unternehmen" data-id="${i.id}">
            ${window.validatorSystem.sanitizeHtml(i.firmenname||"")}
          </a>
        </td>
        <td>${this.renderBrancheTags(i.branchen)}</td>
        <td>${this.renderAnsprechpartnerList(a.get(i.id))}</td>
        <td>${window.validatorSystem.sanitizeHtml(i.invoice_email||"")}</td>
        <td>${window.validatorSystem.sanitizeHtml(i.rechnungsadresse_stadt||"")}</td>
        <td>${window.validatorSystem.sanitizeHtml(i.rechnungsadresse_land||"")}</td>
        <td>
          ${B.create("unternehmen",i.id)}
        </td>
      </tr>
    `).join("");t.innerHTML=r}renderBrancheTags(e){if(!e||Array.isArray(e)&&e.length===0)return"-";if(typeof e=="object"&&!Array.isArray(e)&&e.name)return`<div class="tags tags-compact"><span class="tag tag--branche">${window.validatorSystem.sanitizeHtml(e.name)}</span></div>`;if(typeof e=="string"){const t=e.split(",").map(a=>a.trim()).filter(Boolean);return t.length===0?"-":`<div class="tags tags-compact">${t.map(a=>`<span class="tag tag--branche">${window.validatorSystem.sanitizeHtml(a)}</span>`).join("")}</div>`}if(Array.isArray(e))return`<div class="tags tags-compact">${e.map(n=>{const a=typeof n=="object"&&(n.name||n.label)||n;return`<span class="tag tag--branche">${window.validatorSystem.sanitizeHtml(String(a).trim())}</span>`}).join("")}</div>`;if(typeof e=="object"){const t=e.name||e.label;return t?`<div class="tags tags-compact"><span class="tag tag--branche">${window.validatorSystem.sanitizeHtml(t)}</span></div>`:"-"}return"-"}async loadAnsprechpartnerMap(e){const t=new Map;try{if(!window.supabase||!Array.isArray(e)||e.length===0)return t;const{data:n,error:a}=await window.supabase.from("ansprechpartner_unternehmen").select(`
          unternehmen_id,
          ansprechpartner:ansprechpartner_id (
            id,
            vorname,
            nachname,
            email
          )
        `).in("unternehmen_id",e);if(a)return console.warn("⚠️ Konnte Ansprechpartner nicht laden:",a),t;(n||[]).forEach(r=>{if(!r.ansprechpartner)return;const i=r.unternehmen_id,s=r.ansprechpartner,o=t.get(i)||[];o.push(s),t.set(i,o)}),console.log("✅ UNTERNEHMENLISTE: Ansprechpartner-Map geladen:",t.size,"Unternehmen")}catch(n){console.warn("⚠️ loadAnsprechpartnerMap Fehler:",n)}return t}renderAnsprechpartnerList(e){if(!e||e.length===0)return"-";const t=e.filter(n=>n&&n.vorname&&n.nachname).map(n=>({name:`${n.vorname} ${n.nachname}`,type:"person",id:n.id,entityType:"ansprechpartner"}));return z.renderBubbles(t)}destroy(){console.log("UnternehmenList: Cleaning up..."),this._boundEventListeners.forEach(({element:e,type:t,handler:n})=>{e.removeEventListener(t,n)}),this._boundEventListeners.clear(),this.boundFilterResetHandler&&(document.removeEventListener("click",this.boundFilterResetHandler),this.boundFilterResetHandler=null)}showCreateForm(){console.log("🎯 Zeige Unternehmen-Erstellungsformular"),window.setHeadline("Neues Unternehmen anlegen"),window.breadcrumbSystem&&window.breadcrumbSystem.updateBreadcrumb([{label:"Unternehmen",url:"/unternehmen",clickable:!0},{label:"Neues Unternehmen",url:"/unternehmen/new",clickable:!1}]);const e=window.formSystem.renderFormOnly("unternehmen");window.content.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Neues Unternehmen anlegen</h1>
          <p>Erstellen Sie ein neues Unternehmen für das CRM</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/unternehmen')" class="secondary-btn">Zurück zur Übersicht</button>
        </div>
      </div>
      
      <div class="form-page">
        ${e}
      </div>
    `,window.formSystem.bindFormEvents("unternehmen",null)}async handleFormSubmit(){try{const e=document.getElementById("unternehmen-form"),t=window.formSystem.collectSubmitData(e),n=window.validatorSystem.validateForm(t,{firmenname:{type:"text",minLength:2,required:!0},invoice_email:{type:"email"}});if(!n.isValid){this.showValidationErrors(n.errors);return}const a=await window.dataService.createEntity("unternehmen",t);if(a.success){if(a.id)try{const{RelationTables:r}=await x(async()=>{const{RelationTables:s}=await Promise.resolve().then(()=>mt);return{RelationTables:s}},void 0);await new r().handleRelationTables("unternehmen",a.id,t,e),console.log("✅ Junction Table-Verknüpfungen verarbeitet")}catch(r){console.error("❌ Fehler beim Verarbeiten der Junction Tables:",r)}this.showSuccessMessage("Unternehmen erfolgreich erstellt!"),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"unternehmen",id:a.id,action:"created"}}))}else throw new Error(a.error||"Unbekannter Fehler")}catch(e){console.error("❌ Formular-Submit Fehler:",e),this.showErrorMessage(e.message)}}showValidationErrors(e){document.querySelectorAll(".field-error").forEach(t=>t.remove()),Object.entries(e).forEach(([t,n])=>{const a=document.querySelector(`[name="${t}"]`);if(a){const r=document.createElement("div");r.className="field-error",r.textContent=n,a.parentNode.appendChild(r)}})}showSuccessMessage(e){const t=document.createElement("div");t.className="alert alert-success",t.textContent=e;const n=document.getElementById("unternehmen-form");n&&n.parentNode.insertBefore(t,n)}showErrorMessage(e){const t=document.createElement("div");t.className="alert alert-error",t.textContent=e;const n=document.getElementById("unternehmen-form");n&&n.parentNode.insertBefore(t,n)}updateSelectAllCheckbox(){const e=document.getElementById("select-all-unternehmen"),t=document.querySelectorAll(".unternehmen-check");if(!e||t.length===0)return;const n=document.querySelectorAll(".unternehmen-check:checked"),a=n.length===t.length,r=n.length>0;e.checked=a,e.indeterminate=r&&!a,console.log(`🔧 Select-All Status: ${a?"Alle":r?"Teilweise":"Keine"} (${n.length}/${t.length})`)}deselectAll(){this.selectedUnternehmen.clear(),document.querySelectorAll(".unternehmen-check").forEach(n=>{n.checked=!1});const t=document.getElementById("select-all-unternehmen");t&&(t.checked=!1,t.indeterminate=!1),this.updateSelection(),console.log("✅ Alle Unternehmen-Auswahlen aufgehoben")}async showDeleteSelectedConfirmation(){const e=this.selectedUnternehmen.size;if(e===0){alert("Keine Unternehmen ausgewählt.");return}const t=e===1?"Möchten Sie das ausgewählte Unternehmen wirklich löschen?":`Möchten Sie die ${e} ausgewählten Unternehmen wirklich löschen?`;window.confirmationModal?(await window.confirmationModal.open({title:"Löschvorgang bestätigen",message:t,confirmText:"Endgültig löschen",cancelText:"Abbrechen",danger:!0}))?.confirmed&&this.deleteSelectedUnternehmen():confirm(`${t}

Dieser Vorgang kann nicht rückgängig gemacht werden.`)&&this.deleteSelectedUnternehmen()}async deleteSelectedUnternehmen(){const e=Array.from(this.selectedUnternehmen),t=e.length;console.log(`🗑️ Lösche ${t} Unternehmen...`),e.forEach(n=>{const a=document.querySelector(`tr[data-id="${n}"]`);a&&(a.style.opacity="0.5")});try{const n=await window.dataService.deleteEntities("unternehmen",e);if(n.success){e.forEach(r=>{document.querySelector(`tr[data-id="${r}"]`)?.remove()}),alert(`✅ ${n.deletedCount} Unternehmen erfolgreich gelöscht.`),this.deselectAll();const a=document.querySelector(".data-table tbody");a&&a.children.length===0&&await this.loadAndRender(),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"unternehmen",action:"bulk-deleted",count:n.deletedCount}}))}else throw new Error(n.error||"Löschen fehlgeschlagen")}catch(n){e.forEach(a=>{const r=document.querySelector(`tr[data-id="${a}"]`);r&&(r.style.opacity="1")}),console.error("❌ Fehler beim Löschen:",n),alert(`❌ Fehler beim Löschen: ${n.message}`),await this.loadAndRender()}}}const ee=new je;class Ge{constructor(){this.formData={},this.selectedBranches=[],this.allBranches=[]}async init(){if(console.log("🎯 UNTERNEHMENCREATE: Initialisiere Unternehmen-Erstellungsseite mit FormSystem"),window.moduleRegistry?.currentModule!==this){console.log("⚠️ UNTERNEHMENCREATE: Nicht mehr das aktuelle Modul, breche ab");return}try{this.showCreateForm(),console.log("✅ UNTERNEHMENCREATE: Initialisierung abgeschlossen")}catch(e){console.error("❌ UNTERNEHMENCREATE: Fehler bei der Initialisierung:",e),window.ErrorHandler.handle(e,"UnternehmenCreate.init")}}async loadBranches(){console.log("🔄 UNTERNEHMENCREATE: Lade Branchen...");const{data:e,error:t}=await window.supabase.from("branchen").select("*").order("name");if(t)throw new Error(`Fehler beim Laden der Branchen: ${t.message}`);this.allBranches=e,console.log("✅ UNTERNEHMENCREATE: Branchen geladen:",e.length)}render(){window.setHeadline("Neues Unternehmen anlegen"),window.setContentSafely(`
      <div class="create-page">
        <div class="create-container">
          <div class="create-header">
            <h1>Neues Unternehmen anlegen</h1>
            <p>Erstellen Sie ein neues Unternehmen mit allen relevanten Informationen.</p>
          </div>

          <form id="unternehmen-create-form" class="create-form">
            <!-- Grundinformationen -->
            <div class="form-section">
              <h2 class="section-title">Grundinformationen</h2>
              
              <div class="form-row">
                <div class="form-group">
                  <label for="firmenname" class="form-label required">Firmenname</label>
                  <input 
                    type="text" 
                    id="firmenname" 
                    name="firmenname" 
                    class="form-input" 
                    placeholder="Firmenname eingeben..."
                    required
                  >
                  <div class="form-error" id="firmenname-error"></div>
                </div>

                <div class="form-group">
                  <label for="webseite" class="form-label">Webseite</label>
                  <input 
                    type="url" 
                    id="webseite" 
                    name="webseite" 
                    class="form-input" 
                    placeholder="https://www.beispiel.de"
                  >
                  <div class="form-error" id="webseite-error"></div>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="branche" class="form-label">Branchen</label>
                  <div class="multi-select-container">
                    <div class="selected-items" id="selected-branches"></div>
                    <div class="input-with-clear">
                      <input 
                        type="text" 
                        id="branche-input" 
                        class="form-input auto-suggest-input" 
                        placeholder="Branche suchen und hinzufügen..."
                      >
                      <button type="button" class="clear-input-btn" id="clear-branche-input" title="Eingabe löschen">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div class="auto-suggest-dropdown" id="branche-dropdown"></div>
                  </div>
                  <div class="form-help">Mehrere Branchen können ausgewählt werden</div>
                </div>

                <div class="form-group">
                  <label for="status" class="form-label">Status</label>
                  <select id="status" name="status" class="form-select">
                    <option value="">Status auswählen...</option>
                    <option value="aktiv">Aktiv</option>
                    <option value="inaktiv">Inaktiv</option>
                    <option value="prospekt">Prospekt</option>
                  </select>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="auftragtype" class="form-label">Auftragstyp</label>
                  <select id="auftragtype" name="auftragtype" class="form-select">
                    <option value="">Auftragstyp auswählen...</option>
                    <option value="einmalig">Einmalig</option>
                    <option value="wiederkehrend">Wiederkehrend</option>
                    <option value="projekt">Projekt</option>
                  </select>
                </div>

                <div class="form-group">
                  <label for="invoice_email" class="form-label">Rechnungs-E-Mail</label>
                  <input 
                    type="email" 
                    id="invoice_email" 
                    name="invoice_email" 
                    class="form-input" 
                    placeholder="rechnung@unternehmen.de"
                  >
                  <div class="form-error" id="invoice_email-error"></div>
                </div>
              </div>
            </div>

            <!-- Rechnungsadresse -->
            <div class="form-section">
              <h2 class="section-title">Rechnungsadresse</h2>
              
              <div class="form-row">
                <div class="form-group">
                  <label for="rechnungsadresse_strasse" class="form-label">Straße</label>
                  <input 
                    type="text" 
                    id="rechnungsadresse_strasse" 
                    name="rechnungsadresse_strasse" 
                    class="form-input" 
                    placeholder="Straßenname"
                  >
                </div>

                <div class="form-group form-group-small">
                  <label for="rechnungsadresse_hausnummer" class="form-label">Hausnummer</label>
                  <input 
                    type="text" 
                    id="rechnungsadresse_hausnummer" 
                    name="rechnungsadresse_hausnummer" 
                    class="form-input" 
                    placeholder="123a"
                  >
                </div>
              </div>

              <div class="form-row">
                <div class="form-group form-group-small">
                  <label for="rechnungsadresse_plz" class="form-label">PLZ</label>
                  <input 
                    type="text" 
                    id="rechnungsadresse_plz" 
                    name="rechnungsadresse_plz" 
                    class="form-input" 
                    placeholder="12345"
                  >
                </div>

                <div class="form-group">
                  <label for="rechnungsadresse_stadt" class="form-label">Stadt</label>
                  <input 
                    type="text" 
                    id="rechnungsadresse_stadt" 
                    name="rechnungsadresse_stadt" 
                    class="form-input" 
                    placeholder="Stadtname"
                  >
                </div>

                <div class="form-group">
                  <label for="rechnungsadresse_land" class="form-label">Land</label>
                  <input 
                    type="text" 
                    id="rechnungsadresse_land" 
                    name="rechnungsadresse_land" 
                    class="form-input" 
                    placeholder="Deutschland"
                    value="Deutschland"
                  >
                </div>
              </div>
            </div>

            <!-- Aktionen -->
            <div class="form-actions">
              <button type="button" id="btn-cancel" class="btn btn-secondary">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Abbrechen
              </button>
              
              <button type="submit" id="btn-save" class="btn btn-primary">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Unternehmen anlegen
              </button>
            </div>
          </form>
        </div>
      </div>
    `)}bindEvents(){document.getElementById("unternehmen-create-form").addEventListener("submit",e=>{e.preventDefault(),this.handleSubmit()}),document.getElementById("btn-cancel").addEventListener("click",()=>{window.navigateTo("/unternehmen")}),document.getElementById("clear-branche-input").addEventListener("click",()=>{const e=document.getElementById("branche-input"),t=document.getElementById("branche-dropdown");e.value="",t.style.display="none",e.focus()}),this.setupBrancheAutoSuggest()}setupBrancheAutoSuggest(){const e=document.getElementById("branche-input"),t=document.getElementById("branche-dropdown");console.log("🔧 UNTERNEHMENCREATE: Setup Auto-Suggest, Branchen verfügbar:",this.allBranches.length),e.addEventListener("input",n=>{const a=n.target.value.toLowerCase().trim();if(console.log("🔍 UNTERNEHMENCREATE: Suche nach:",a),a.length<2){t.style.display="none";return}const r=this.allBranches.filter(i=>i.name.toLowerCase().includes(a)&&!this.selectedBranches.some(s=>s.id===i.id));console.log("📋 UNTERNEHMENCREATE: Gefilterte Branchen:",r.length),this.renderBrancheDropdown(r)}),e.addEventListener("focus",()=>{e.value.length>=2&&(t.style.display="block")}),document.addEventListener("click",n=>{!e.contains(n.target)&&!t.contains(n.target)&&(t.style.display="none")})}renderBrancheDropdown(e){const t=document.getElementById("branche-dropdown");e.length===0?t.innerHTML='<div class="dropdown-item no-results">Keine Branchen gefunden</div>':(t.innerHTML=e.map(n=>`
        <div class="dropdown-item" data-branch-id="${n.id}">
          <span class="branch-name">${n.name}</span>
          ${n.beschreibung?`<span class="branch-description">${n.beschreibung}</span>`:""}
        </div>
      `).join(""),t.querySelectorAll(".dropdown-item").forEach(n=>{n.classList.contains("no-results")||n.addEventListener("click",()=>{const a=n.dataset.branchId,r=e.find(i=>i.id===a);this.addBranch(r)})})),t.style.display="block"}addBranch(e){this.selectedBranches.some(t=>t.id===e.id)||(this.selectedBranches.push(e),this.renderSelectedBranches(),document.getElementById("branche-input").value="",document.getElementById("branche-dropdown").style.display="none")}removeBranch(e){this.selectedBranches=this.selectedBranches.filter(t=>t.id!==e),this.renderSelectedBranches()}renderSelectedBranches(){const e=document.getElementById("selected-branches");if(this.selectedBranches.length===0){e.innerHTML="";return}e.innerHTML=this.selectedBranches.map(t=>`
      <div class="selected-item" data-branch-id="${t.id}">
        <span class="item-name">${t.name}</span>
        <button type="button" class="remove-item" data-branch-id="${t.id}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    `).join(""),e.querySelectorAll(".remove-item").forEach(t=>{t.addEventListener("click",n=>{n.preventDefault();const a=t.dataset.branchId;this.removeBranch(a)})})}collectFormData(){const e=new FormData(document.getElementById("unternehmen-create-form")),t={},n=document.querySelector('select[name="branche_id[]"]');if(n){const a=Array.from(n.selectedOptions).map(r=>r.value).filter(Boolean);a.length>0&&(t.branche_id=a)}for(let[a,r]of e.entries())a==="branche_id"||a==="branche_id[]"||(t[a]=r.trim());return(!t.branche_id||t.branche_id.length===0)&&(t.branche_id=this.selectedBranches.map(a=>a.id).filter(Boolean)),Array.isArray(t.branche_id)||(t.branche_id=t.branche_id?[t.branche_id]:[]),t}validateForm(e){const t={};return e.firmenname||(t.firmenname="Firmenname ist erforderlich"),e.invoice_email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.invoice_email)&&(t.invoice_email="Bitte geben Sie eine gültige E-Mail-Adresse ein"),t}showValidationErrors(e){document.querySelectorAll(".form-error").forEach(t=>t.textContent=""),document.querySelectorAll(".form-input, .form-select").forEach(t=>t.classList.remove("error")),Object.keys(e).forEach(t=>{const n=document.getElementById(`${t}-error`),a=document.getElementById(t);n&&(n.textContent=e[t]),a&&a.classList.add("error")})}async handleSubmit(){try{const e=document.getElementById("btn-save"),t=e.innerHTML;e.innerHTML='<div class="loading-spinner"></div> Wird angelegt...',e.disabled=!0;const n=this.collectFormData(),a=this.validateForm(n);if(Object.keys(a).length>0){this.showValidationErrors(a),e.innerHTML=t,e.disabled=!1;return}const{data:r,error:i}=await window.supabase.from("unternehmen").insert([n]).select().single();if(i)throw i;console.log("✅ UNTERNEHMENCREATE: Unternehmen erstellt:",r);const s=document.getElementById("unternehmen-create-form")||document;await this.saveUnternehmenBranchen(r.id,n.branche_id,s),window.dispatchEvent(new CustomEvent("entityCreated",{detail:{entity:"unternehmen",data:r}})),window.showNotification("Unternehmen wurde erfolgreich angelegt!","success"),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"unternehmen",id:r.id,action:"created"}}))}catch(e){console.error("❌ UNTERNEHMENCREATE: Fehler beim Anlegen:",e),window.showNotification("Fehler beim Anlegen des Unternehmens: "+e.message,"error");const t=document.getElementById("btn-save");t.innerHTML=originalText,t.disabled=!1}}showCreateForm(){console.log("🎯 UNTERNEHMENCREATE: Zeige Unternehmen-Erstellungsformular mit FormSystem"),window.setHeadline("Neues Unternehmen anlegen"),window.breadcrumbSystem&&window.breadcrumbSystem.updateBreadcrumb([{label:"Unternehmen",url:"/unternehmen",clickable:!0},{label:"Neues Unternehmen",url:"/unternehmen/new",clickable:!1}]);const e=window.formSystem.renderFormOnly("unternehmen");window.content.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Neues Unternehmen anlegen</h1>
          <p>Erstellen Sie ein neues Unternehmen für das CRM</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/unternehmen')" class="secondary-btn">Zurück zur Übersicht</button>
        </div>
      </div>
      
      <div class="form-page">
        ${e}
      </div>
    `,window.formSystem.bindFormEvents("unternehmen",null);const t=document.getElementById("unternehmen-form");t&&(t.onsubmit=async n=>{n.preventDefault(),await this.handleFormSubmit()})}async handleFormSubmit(){try{console.log("🎯 UNTERNEHMENCREATE: Verarbeite Formular-Submit");const e=document.querySelector('#unternehmen-form button[type="submit"]'),t=e.innerHTML;e.innerHTML='<div class="loading-spinner"></div> Wird angelegt...',e.disabled=!0;const n=document.getElementById("unternehmen-form"),a=new FormData(n),r={},i={},s=n.querySelectorAll('select[data-tag-based="true"]');console.log("🏷️ Tag-basierte Selects gefunden:",s.length),s.forEach(u=>{let d=n.querySelector(`select[name="${u.name}"][style*="display: none"]`);if(!d){const c=n.querySelectorAll(`select[name="${u.name}"]`);c.length>1&&(d=c[1])}if(d){const c=Array.from(d.selectedOptions).map(m=>m.value).filter(m=>m!=="");c.length>0&&(i[u.name]=c,console.log(`🏷️ Tag-basiertes Multi-Select ${u.name}:`,c))}});for(let[u,d]of a.entries())if(!i.hasOwnProperty(u))if(u.includes("[]")){const c=u.replace("[]","");i[c]||(i[c]=[]),i[c].push(d),console.log(`📤 Multi-Select Array ${c}: ${d}`)}else i[u]?(Array.isArray(i[u])||(i[u]=[i[u]]),i[u].push(d)):i[u]=d;for(let[u,d]of Object.entries(i))r[u]=Array.isArray(d)?d:d.trim();r.branche_id&&Array.isArray(r.branche_id)&&console.log("✅ branche_id Array für Junction Table:",r.branche_id),console.log("📋 UNTERNEHMENCREATE: Formular-Daten gesammelt:",r),console.log("🧪 UNTERNEHMENCREATE: Übergabe an DataService mit branche_id:",r.branche_id);const o=await window.dataService.createEntity("unternehmen",r);if(!o.success)throw new Error(o.error||"Unbekannter Fehler beim Erstellen");const l=o.data;console.log("✅ UNTERNEHMENCREATE: Unternehmen erstellt:",l),await this.saveUnternehmenBranchen(o.id,r.branche_id,n),window.dispatchEvent(new CustomEvent("entityCreated",{detail:{entity:"unternehmen",data:l}})),window.showNotification("Unternehmen wurde erfolgreich angelegt!","success"),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"unternehmen",id:l.id,action:"created"}}))}catch(e){console.error("❌ UNTERNEHMENCREATE: Fehler beim Anlegen:",e),window.showNotification("Fehler beim Anlegen des Unternehmens: "+e.message,"error");const t=document.querySelector('#unternehmen-form button[type="submit"]');t&&(t.innerHTML=originalText,t.disabled=!1)}}async getBranchenNamen(e){try{const{data:t,error:n}=await window.supabase.from("branchen").select("id, name").in("id",e);return n?(console.error("❌ Fehler beim Laden der Branche-Namen:",n),e):e.map(a=>{const r=t.find(i=>i.id===a);return r?r.name:a})}catch(t){return console.error("❌ Fehler beim Laden der Branche-Namen:",t),e}}async saveUnternehmenBranchen(e,t=null,n=null){try{if(!e)return;let a=[];if(Array.isArray(t)?a=t.filter(Boolean):typeof t=="string"&&t&&(a=[t]),a.length===0){const c=(n||document).querySelector('select[name="branche_id[]"]');c&&(a=Array.from(c.selectedOptions).map(m=>m.value).filter(Boolean))}a.length===0&&this.selectedBranches.length>0&&(a=this.selectedBranches.map(d=>d.id).filter(Boolean));const{error:r}=await window.supabase.from("unternehmen_branchen").delete().eq("unternehmen_id",e);if(r)throw console.error("❌ Fehler beim Löschen bestehender Branchen-Zuordnungen:",r),r;if(a.length===0){await window.supabase.from("unternehmen").update({branche_id:null,branche:null}).eq("id",e),console.log("ℹ️ Keine Branchen ausgewählt – Primärbranche zurückgesetzt");return}const i=a.map(d=>({unternehmen_id:e,branche_id:d})),{error:s}=await window.supabase.from("unternehmen_branchen").insert(i);if(s)throw console.error("❌ Fehler beim Speichern der Branchen-Zuordnungen:",s),s;const l=(await this.getBranchenNamen(a)).filter(Boolean).join(", ")||null,{error:u}=await window.supabase.from("unternehmen").update({branche_id:a[0]||null,branche:l}).eq("id",e);u?console.error("❌ Fehler beim Aktualisieren der Primärbranche:",u):console.log(`✅ Primärbranche aktualisiert (${a[0]}) und Legacy-String gesetzt: ${l}`)}catch(a){console.error("❌ Fehler beim Speichern der Unternehmen-Branchen:",a),window.showNotification("Branchen-Zuordnungen konnten nicht vollständig gespeichert werden.","warning")}}destroy(){console.log("🗑️ UNTERNEHMENCREATE: Destroy aufgerufen"),window.setContentSafely(""),console.log("✅ UNTERNEHMENCREATE: Destroy abgeschlossen")}}const te=new Ge;class Ze{constructor(){this.drawerId="auftrag-details-drawer",this.bindEvents()}bindEvents(){document.addEventListener("actionRequested",e=>{const{action:t,entityType:n,entityId:a}=e.detail;t==="showDetails"&&n==="auftrag"&&(console.log("🎯 AUFTRAGSDETAILSMANAGER: Event empfangen für ID:",a),this.open(a))})}async open(e){console.log("🎯 AUFTRAGSDETAILSMANAGER: open() aufgerufen mit ID:",e);try{console.log("🎯 AUFTRAGSDETAILSMANAGER: Erstelle Drawer"),await this.createDrawer(),console.log("🎯 AUFTRAGSDETAILSMANAGER: Zeige Loading"),this.showLoading();let t=null;try{console.log("🎯 AUFTRAGSDETAILSMANAGER: Lade Details"),t=await this.loadDetails(e),console.log("🎯 AUFTRAGSDETAILSMANAGER: Details geladen:",t)}catch(a){console.warn("⚠️ Konnte Details nicht laden, zeige leeres Formular:",a)}console.log("🎯 AUFTRAGSDETAILSMANAGER: Lade Auftrag-Basis");const n=await this.loadAuftrag(e);console.log("🎯 AUFTRAGSDETAILSMANAGER: Auftrag-Basis geladen:",n),console.log("🎯 AUFTRAGSDETAILSMANAGER: Rendere Form"),this.renderForm(e,n,t),console.log("🎯 AUFTRAGSDETAILSMANAGER: Binde Events"),this.bindFormEvents(e),console.log("🎯 AUFTRAGSDETAILSMANAGER: Drawer sollte jetzt sichtbar sein")}catch(t){console.error("❌ AuftragsDetailsManager.open Fehler:",t),this.showError("Fehler beim Laden der Auftragsdetails.")}}async createDrawer(){this.removeDrawer();const e=document.createElement("div");e.className="drawer-overlay",e.id=`${this.drawerId}-overlay`;const t=document.createElement("div");t.setAttribute("role","dialog"),t.className="drawer-panel",t.id=this.drawerId;const n=document.createElement("div");n.className="drawer-header";const a=document.createElement("div"),r=document.createElement("h1");r.textContent="Auftragsdetails anlegen",r.style.margin="0",r.style.fontSize="1.25rem",r.style.fontWeight="600";const i=document.createElement("p");i.style.margin="0",i.style.color="#6b7280",i.style.fontSize="0.95rem",i.textContent="Ergänzen Sie detaillierte Produktionsinformationen",a.appendChild(r),a.appendChild(i);const s=document.createElement("div"),o=document.createElement("button");o.className="drawer-close",o.textContent="Schließen",s.appendChild(o),n.appendChild(a),n.appendChild(s);const l=document.createElement("div");l.className="drawer-body",l.id=`${this.drawerId}-body`,t.appendChild(n),t.appendChild(l),e.addEventListener("click",()=>this.close()),o.addEventListener("click",()=>this.close()),document.body.appendChild(e),document.body.appendChild(t),requestAnimationFrame(()=>{t.classList.add("show")})}close(){const e=document.getElementById(this.drawerId);e&&(e.classList.remove("show"),setTimeout(()=>this.removeDrawer(),250))}removeDrawer(){const e=document.getElementById(`${this.drawerId}-overlay`),t=document.getElementById(this.drawerId);e&&e.remove(),t&&t.remove()}showLoading(){const e=document.getElementById(`${this.drawerId}-body`);e&&(e.innerHTML='<div class="drawer-loading">Lade Auftragsdetails...</div>')}showError(e){const t=document.getElementById(`${this.drawerId}-body`);t&&(t.innerHTML=`<div class="alert alert-danger">${e}</div>`)}showSuccess(e){const t=document.getElementById(`${this.drawerId}-body`);if(!t)return;const n=document.createElement("div");n.className="alert alert-success",n.textContent=e,t.insertBefore(n,t.firstChild)}async loadAuftrag(e){if(!window.supabase)return{};const{data:t,error:n}=await window.supabase.from("auftrag").select("id, auftragsname, kampagnenanzahl, unternehmen:unternehmen_id(firmenname), marke:marke_id(markenname), ansprechpartner:ansprechpartner_id(vorname, nachname, email)").eq("id",e).single();if(n)throw n;return t||{}}async loadDetails(e){if(!window.supabase)return null;try{const{data:t,error:n}=await window.supabase.from("auftrag_details").select("*").eq("auftrag_id",e).maybeSingle();if(n){if(console.warn("⚠️ Fehler beim Laden der auftrag_details:",n),n.code==="PGRST116"||n.status===406)return null;throw n}return t||null}catch(t){return console.warn("⚠️ Fehler beim Laden der auftrag_details:",t),null}}renderForm(e,t,n){const a=document.getElementById(`${this.drawerId}-body`);if(!a)return;const r=(i,s)=>`
        <div class="detail-item">
          <label>${i}</label>
          <span>${s||"-"}</span>
        </div>
      `;a.innerHTML=`
      <div class="auftrag-details-layout">
        <div class="auftrag-basis">
          <h3>Basisdaten</h3>
          ${r("Auftragsname",t?.auftragsname)}
          ${r("Unternehmen",t?.unternehmen?.firmenname)}
          ${r("Marke",t?.marke?.markenname)}
          ${r("Ansprechpartner",this.formatAnsprechpartner(t?.ansprechpartner))}
          ${r("Kampagnenanzahl",t?.kampagnenanzahl)}
        </div>

        <form id="auftrag-details-form" data-auftrag-id="${e}" class="auftrag-details-form">
          <input type="hidden" name="auftrag_id" value="${e}">


          ${this.renderSection("UGC",n,"ugc",{video_anzahl:{label:"Gesamt Anzahl Videos",type:"number"},creator_anzahl:{label:"Gesamt Anzahl Creator",type:"number"},budget_info:{label:"Budget & Informationen",type:"textarea"}})}

          ${this.renderSection("Influencer",n,"influencer",{video_anzahl:{label:"Gesamt Anzahl Videos",type:"number"},creator_anzahl:{label:"Gesamt Anzahl Creator",type:"number"},budget_info:{label:"Budget & Informationen",type:"textarea"}})}

          ${this.renderSection("Vor Ort Dreh",n,"vor_ort",{video_anzahl:{label:"Gesamt Anzahl Videos",type:"number"},creator_anzahl:{label:"Gesamt Anzahl Creator",type:"number"},videographen_anzahl:{label:"Gesamt Anzahl Videographen",type:"number"},budget_info:{label:"Budget & Informationen",type:"textarea"}})}

          ${this.renderSection("Vor Ort Dreh Mitarbeiter",n,"vor_ort_mitarbeiter",{video_anzahl:{label:"Gesamt Anzahl Videos",type:"number"},videographen_anzahl:{label:"Gesamt Anzahl Videographen",type:"number"},budget_info:{label:"Budget & Informationen",type:"textarea"}})}

          <div class="detail-summary">
            <div class="summary-grid">
              <div class="summary-item">
                <label>Gesamtanzahl Videos</label>
                <input type="number" name="gesamt_videos" value="${n?.gesamt_videos||""}" readonly>
              </div>
              <div class="summary-item">
                <label>Gesamtanzahl Creator</label>
                <input type="number" name="gesamt_creator" value="${n?.gesamt_creator||""}" readonly>
              </div>
            </div>
          </div>

          <div class="drawer-actions">
            <button type="submit" class="primary-btn">Details speichern</button>
            <button type="button" class="secondary-btn" data-close>Abbrechen</button>
          </div>
        </form>
      </div>
    `}renderSection(e,t,n,a){const r=t?.[n]||{},i=Object.entries(a).map(([s,o])=>{const l=`${n}_${s}`,u=r[s]??"";return o.type==="textarea"?`
          <div class="form-field">
            <label for="${l}">${o.label}</label>
            <textarea name="${l}" rows="3">${u||""}</textarea>
          </div>
        `:`
        <div class="form-field">
          <label for="${l}">${o.label}</label>
          <input type="number" name="${l}" value="${u||""}" min="0" step="1">
        </div>
      `}).join("");return`
      <section class="details-section">
        <h3>${e}</h3>
        <div class="section-grid">
          ${i}
        </div>
      </section>
    `}formatAnsprechpartner(e){if(!e)return"-";const t=[e.vorname,e.nachname].filter(Boolean).join(" ");return e.email?`${t} (${e.email})`:t}bindFormEvents(e){const t=document.getElementById("auftrag-details-form");if(!t)return;t.querySelectorAll('input[type="number"]').forEach(a=>{a.addEventListener("input",()=>this.updateSummaryFields(t))}),t.querySelector("[data-close]")?.addEventListener("click",()=>this.close()),t.addEventListener("submit",async a=>{a.preventDefault(),await this.handleSubmit(t,e)}),this.updateSummaryFields(t)}updateSummaryFields(e){const n=["ugc_video_anzahl","influencer_video_anzahl","vor_ort_video_anzahl","vor_ort_mitarbeiter_video_anzahl"].reduce((o,l)=>{const u=parseInt(e.querySelector(`[name="${l}"]`)?.value||"0",10);return o+(isNaN(u)?0:u)},0),a=e.querySelector('[name="gesamt_videos"]');a&&(a.value=n);const i=["ugc_creator_anzahl","influencer_creator_anzahl","vor_ort_creator_anzahl"].reduce((o,l)=>{const u=parseInt(e.querySelector(`[name="${l}"]`)?.value||"0",10);return o+(isNaN(u)?0:u)},0),s=e.querySelector('[name="gesamt_creator"]');s&&(s.value=i)}async handleSubmit(e,t){try{const n=new FormData(e),a={auftrag_id:t};if(n.forEach((r,i)=>{i!=="auftrag_id"&&(r===""?a[i]=null:i.endsWith("_anzahl")||i==="gesamt_videos"||i==="gesamt_creator"||i==="kampagnenanzahl"?a[i]=parseInt(r,10)||0:a[i]=r)}),window.supabase){const{data:r,error:i}=await window.supabase.from("auftrag_details").select("id").eq("auftrag_id",t).maybeSingle();if(i&&i.code!=="PGRST116")throw i;let s;if(r?.id?{error:s}=await window.supabase.from("auftrag_details").update(a).eq("id",r.id):{error:s}=await window.supabase.from("auftrag_details").insert(a),s)throw s}else window.dataService?.createEntity&&await window.dataService.createEntity("auftrag_details",a);this.showSuccess("Auftragsdetails gespeichert."),setTimeout(()=>this.close(),1200),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"auftrag_details",auftrag_id:t,action:"saved"}}))}catch(n){console.error("❌ Auftragsdetails speichern fehlgeschlagen:",n),this.showError(n.message||"Speichern fehlgeschlagen.")}}}const ne=new Ze;class We{constructor(){this.selectedAuftraege=new Set,this._boundEventListeners=new Set,this.boundFilterResetHandler=null}async init(){console.log("📋 AUFTRAGLIST: Initialisiere Auftrags-Liste"),window.breadcrumbSystem&&window.breadcrumbSystem.updateBreadcrumb([{label:"Auftrag",url:"/auftrag",clickable:!1}]);try{window.bulkActionSystem?.registerList("auftrag",this),await this.loadAndRender(),this.bindEvents(),console.log("✅ AUFTRAGLIST: Initialisierung abgeschlossen")}catch(e){console.error("❌ AUFTRAGLIST: Fehler bei der Initialisierung:",e),window.ErrorHandler.handle(e,"AuftragList.init")}}async loadAndRender(){console.log("🔄 AUFTRAGLIST: Lade und rendere Aufträge");try{console.log("✅ AUFTRAGLIST: Rendere Seite"),await this.render(),console.log("✅ AUFTRAGLIST: Content gesetzt"),await this.initializeFilterBar(),console.log("🔍 AUFTRAGLIST: Lade Aufträge mit Beziehungen");const e=await this.loadAuftraegeWithRelations();console.log("📊 AUFTRAGLIST: Aufträge mit Beziehungen geladen:",e.length,e),this.updateTable(e),console.log("✅ AUFTRAGLIST: Tabelle aktualisiert")}catch(e){console.error("❌ AUFTRAGLIST: Fehler beim Laden und Rendern:",e),window.ErrorHandler.handle(e,"AuftragList.loadAndRender")}}async render(){window.setHeadline("Aufträge"),window.setContentSafely(window.content,`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Aufträge</h1>
          <p>Verwalten Sie alle Aufträge und Projekte</p>
        </div>
        <div class="page-header-right">
          <button id="btn-auftrag-new" class="primary-btn">
            <i class="icon-plus"></i>
            Neuen Auftrag anlegen
          </button>
        </div>
      </div>

      <div class="content-section">
        <div class="table-filter-wrapper">
          <div class="filter-bar">
            <div id="filter-container"></div>
            <button id="btn-filter-reset" class="secondary-btn" style="display:none;">Filter zurücksetzen</button>
          </div>
          <div class="table-actions">
            <button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
            <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
            <span id="selected-count" style="display:none;">0 ausgewählt</span>
            <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>
          </div>
        </div>

        <!-- Daten-Tabelle -->
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>
                  <input type="checkbox" id="select-all-auftraege">
                </th>
                <th>Auftragsname</th>
                <th>Unternehmen</th>
                <th>Marke</th>
                <th>PO</th>
                <th>RE. Nr</th>
                <th>RE-Fälligkeit</th>
                <th>Art der Kampagne</th>
                <th>Start</th>
                <th>Ende</th>
                <th>Brutto</th>
                <th>Netto</th>
                <th>Ansprechpartner</th>
                <th>Mitarbeiter</th>
                <th>Cutter</th>
                <th>Copywriter</th>
                <th>Rechnung gestellt</th>
                <th>Überwiesen</th>
                <th>Status</th>
                <th>Zugewiesen an</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="auftraege-table-body">
              <tr>
                <td colspan="10" class="loading">Lade Aufträge...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `)}async loadAuftraegeWithRelations(){try{if(!window.supabase)return console.warn("⚠️ Supabase nicht verfügbar - verwende Mock-Daten"),await window.dataService.loadEntities("auftrag");const{data:e,error:t}=await window.supabase.from("auftrag").select(`
          *,
          unternehmen:unternehmen_id(id, firmenname),
          marke:marke_id(id, markenname),
          ansprechpartner:ansprechpartner_id(id, vorname, nachname, email),
          cutter:auftrag_cutter(mitarbeiter:mitarbeiter_id(id, name)),
          copywriter:auftrag_copywriter(mitarbeiter:mitarbeiter_id(id, name)),
          mitarbeiter:auftrag_mitarbeiter(mitarbeiter:mitarbeiter_id(id, name))
        `).order("created_at",{ascending:!1});if(t)throw console.error("❌ Fehler beim Laden der Aufträge mit Beziehungen:",t),t;const n=e.map(a=>({...a,unternehmen:a.unternehmen?{id:a.unternehmen.id,firmenname:a.unternehmen.firmenname}:null,marke:a.marke?{id:a.marke.id,markenname:a.marke.markenname}:null}));return console.log("✅ Aufträge mit Beziehungen geladen:",n),console.log("🔍 Debug - Erster Auftrag:",n[0]),n}catch(e){return console.error("❌ Fehler beim Laden der Aufträge mit Beziehungen:",e),await window.dataService.loadEntities("auftrag")}}async initializeFilterBar(){const e=document.getElementById("filter-container");e&&await A.renderFilterBar("auftrag",e,t=>this.onFiltersApplied(t),()=>this.onFiltersReset())}onFiltersApplied(e){console.log("🔍 AUFTRAGLIST: Filter angewendet:",e),A.applyFilters("auftrag",e),this.loadAndRender()}onFiltersReset(){console.log("🔄 AUFTRAGLIST: Filter zurückgesetzt"),A.resetFilters("auftrag"),this.loadAndRender()}bindEvents(){this.boundFilterResetHandler=e=>{e.target.id==="btn-filter-reset"&&this.onFiltersReset()},document.addEventListener("click",this.boundFilterResetHandler),document.addEventListener("click",e=>{(e.target.id==="btn-auftrag-new"||e.target.id==="btn-auftrag-new-filter")&&(e.preventDefault(),window.navigateTo("/auftrag/new"))}),document.addEventListener("click",e=>{if(e.target.id==="btn-select-all"){e.preventDefault(),document.querySelectorAll(".auftrag-check").forEach(a=>{a.checked=!0,a.dataset.id&&this.selectedAuftraege.add(a.dataset.id)});const n=document.getElementById("select-all-auftraege");n&&(n.indeterminate=!1,n.checked=!0),this.updateSelection()}}),document.addEventListener("click",e=>{if(e.target.id==="btn-deselect-all"){e.preventDefault(),document.querySelectorAll(".auftrag-check").forEach(a=>{a.checked=!1}),this.selectedAuftraege.clear();const n=document.getElementById("select-all-auftraege");n&&(n.indeterminate=!1,n.checked=!1),this.updateSelection()}}),document.addEventListener("click",e=>{if(e.target.classList.contains("table-link")&&e.target.dataset.table==="auftrag"){e.preventDefault();const t=e.target.dataset.id;console.log("🎯 AUFTRAGLIST: Navigiere zu Auftrag Details:",t),window.navigateTo(`/auftrag/${t}`)}}),window.addEventListener("entityUpdated",e=>{e.detail.entity==="auftrag"&&this.loadAndRender()}),document.addEventListener("click",e=>{if(e.target.classList.contains("tag-x")){e.preventDefault(),e.stopPropagation();const n=e.target.closest(".filter-tag").dataset.key,a=window.filterSystem.getFilters("auftrag");delete a[n],window.filterSystem.applyFilters("auftrag",a),this.loadAndRender()}}),document.addEventListener("change",e=>{e.target.id==="select-all-auftraege"&&(document.querySelectorAll(".auftrag-check").forEach(n=>{n.checked=e.target.checked,e.target.checked?this.selectedAuftraege.add(n.dataset.id):this.selectedAuftraege.delete(n.dataset.id)}),this.updateSelection())}),document.addEventListener("change",e=>{e.target.classList.contains("auftrag-check")&&(e.target.checked?this.selectedAuftraege.add(e.target.dataset.id):this.selectedAuftraege.delete(e.target.dataset.id),this.updateSelection())})}hasActiveFilters(){const e=window.filterSystem.getFilters("auftrag");return Object.keys(e).length>0}updateSelection(){const e=this.selectedAuftraege.size,t=document.getElementById("selected-count"),n=document.getElementById("btn-deselect-all"),a=document.getElementById("btn-delete-selected");t&&(t.textContent=`${e} ausgewählt`,t.style.display=e>0?"inline":"none"),n&&(n.style.display=e>0?"inline-block":"none"),a&&(a.style.display=e>0?"inline-block":"none")}updateTable(e){const t=document.querySelector(".data-table tbody");if(!t)return;if(!e||e.length===0){t.innerHTML=`
        <tr>
          <td colspan="20" class="no-data">
            <div style="text-align: center; padding: 40px 20px;">
              <div style="font-size: 48px; color: #ccc; margin-bottom: 16px;">📋</div>
              <h3 style="color: #666; margin-bottom: 8px;">Keine Aufträge vorhanden</h3>
              <p style="color: #999; margin-bottom: 20px;">Es wurden noch keine Aufträge erstellt.</p>
              <button id="btn-create-first-auftrag" class="primary-btn">
                Ersten Auftrag anlegen
              </button>
            </div>
          </td>
        </tr>
      `;const a=document.getElementById("btn-create-first-auftrag");a&&a.addEventListener("click",r=>{r.preventDefault(),window.navigateTo("/auftrag/new")});return}const n=e.map(a=>{const r=h=>h?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(h):"-",i=h=>h?new Date(h).toLocaleDateString("de-DE"):"-",s=h=>h&&Array.isArray(h)?h.join(", "):"-",o=h=>h?"✅":"❌",l=h=>h?"👤":"-",u=h=>{if(!h)return"-";const p=[h.vorname,h.nachname].filter(Boolean).join(" ");if(!p)return"-";const g=[{name:p,type:"person",id:h.id,entityType:"ansprechpartner"}];return z.renderBubbles(g)},d=h=>{if(!h)return"-";const p=h.firmenname;if(!p)return"-";const g=[{name:p,type:"org",id:h.id,entityType:"unternehmen"}];return z.renderBubbles(g)},c=h=>{if(!h)return"-";const p=h.markenname;if(!p)return"-";const g=[{name:p,type:"org",id:h.id,entityType:"marke"}];return z.renderBubbles(g)},m=h=>{if(!h||h.length===0)return"-";const p=h.map(g=>{const b=g?.mitarbeiter?.name||g?.name,y=g?.mitarbeiter?.id||g?.id;return b?{name:b,type:"person",id:y,entityType:"mitarbeiter"}:null}).filter(Boolean);return p.length>0?z.renderBubbles(p):"-"};return`
        <tr data-id="${a.id}">
          <td><input type="checkbox" class="auftrag-check" data-id="${a.id}"></td>
          <td>
            <a href="#" class="table-link" data-table="auftrag" data-id="${a.id}">
              ${window.validatorSystem.sanitizeHtml(a.auftragsname||"Unbekannt")}
            </a>
          </td>
          <td>${d(a.unternehmen)}</td>
          <td>${c(a.marke)}</td>
          <td>${a.po||"-"}</td>
          <td>${a.re_nr||"-"}</td>
          <td>${i(a.re_faelligkeit)}</td>
          <td>${s(a.art_der_kampagne)}</td>
          <td>${i(a.start)}</td>
          <td>${i(a.ende)}</td>
          <td>${r(a.bruttobetrag)}</td>
          <td>${r(a.nettobetrag)}</td>
          <td>${u(a.ansprechpartner)}</td>
          <td>${m(a.mitarbeiter)}</td>
          <td>${m(a.cutter)}</td>
          <td>${m(a.copywriter)}</td>
          <td>${o(a.rechnung_gestellt)}</td>
          <td>${o(a.ueberwiesen)}</td>
          <td>
            <span class="status-badge status-${a.status?.toLowerCase()||"unknown"}">
              ${a.status||"-"}
            </span>
          </td>
          <td>${l(a.assignee_id)}</td>
          <td>
            ${B.create("auftrag",a.id)}
          </td>
        </tr>
      `}).join("");t.innerHTML=n}destroy(){console.log("AuftragList: Cleaning up..."),this._boundEventListeners.forEach(({element:e,type:t,handler:n})=>{e.removeEventListener(t,n)}),this._boundEventListeners.clear(),this.boundFilterResetHandler&&(document.removeEventListener("click",this.boundFilterResetHandler),this.boundFilterResetHandler=null)}showCreateForm(){console.log("🎯 Zeige Auftrag-Erstellungsformular"),window.setHeadline("Neuen Auftrag anlegen"),window.breadcrumbSystem&&window.breadcrumbSystem.updateBreadcrumb([{label:"Aufträge",url:"/auftrag",clickable:!0},{label:"Neuer Auftrag",url:"/auftrag/new",clickable:!1}]);const t=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Neuen Auftrag anlegen</h1>
          <p>Erstellen Sie einen neuen Auftrag für das CRM</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/auftrag')" class="secondary-btn">Zurück zur Übersicht</button>
        </div>
      </div>
      <div class="form-page">
        ${window.formSystem.renderFormOnly("auftrag")}
      </div>
    `;window.content.innerHTML=t,window.formSystem.bindFormEvents("auftrag",null)}}const ae=new We;class Ye{constructor(){this.selectedDetails=new Set,this._boundEventListeners=new Set}async init(){if(window.currentUser?.rolle==="kunde"){window.setHeadline("Zugriff verweigert"),window.content.innerHTML=`
        <div class="error-state">
          <h2>Zugriff verweigert</h2>
          <p>Sie haben keine Berechtigung, diese Seite zu sehen.</p>
        </div>
      `;return}window.setHeadline("Auftragsdetails Übersicht"),window.breadcrumbSystem&&window.breadcrumbSystem.updateBreadcrumb([{label:"Auftragsdetails",url:"/auftragsdetails",clickable:!1}]),await this.loadAndRender()}async render(){const e=window.currentUser?.permissions?.auftrag?.can_edit||window.currentUser?.rolle!=="kunde";let t=`<div class="filter-bar">
      <div class="filter-left">
        <div id="filter-container"></div>
      </div>
      <div class="filter-right">
        <button id="btn-filter-reset" class="secondary-btn" style="display:${this.hasActiveFilters()?"inline-block":"none"};">Alle Filter zurücksetzen</button>
      </div>
    </div>`,n=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Auftragsdetails</h1>
          <p>Detaillierte Produktionsplanung für Aufträge</p>
        </div>
        <div class="page-header-right">
          ${e?'<button id="btn-auftragsdetails-new" class="primary-btn">Neue Auftragsdetails anlegen</button>':""}
        </div>
      </div>

      <div class="table-filter-wrapper">
        ${t}
        <div class="table-actions">
          <button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
          <span id="selected-count" style="display:none;">0 ausgewählt</span>
          <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th><input type="checkbox" id="select-all-auftragsdetails"></th>
              <th>Auftragsname</th>
              <th>Unternehmen</th>
              <th>Marke</th>
              <th>Kampagnen</th>
              <th>Geplante Videos</th>
              <th>Geplante Creator</th>
              <th>Erstellt am</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="9" class="no-data">Lade Auftragsdetails...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;window.setContentSafely(window.content,n),this.bindEvents(),await this.initializeFilterBar()}hasActiveFilters(){const e=A.getFilters("auftragsdetails")||{};return Object.keys(e).length>0}async initializeFilterBar(){const e=document.getElementById("filter-container");e&&await A.renderFilterBar("auftragsdetails",e,t=>this.onFiltersApplied(t),()=>this.onFiltersReset())}onFiltersApplied(e){console.log("Filter angewendet:",e),this.loadAndRender()}onFiltersReset(){console.log("Filter zurückgesetzt"),this.loadAndRender()}bindEvents(){this._boundEventListeners.forEach(l=>l()),this._boundEventListeners.clear();const e=document.getElementById("btn-auftragsdetails-new");if(e){const l=()=>window.navigateTo("/auftragsdetails/new");e.addEventListener("click",l),this._boundEventListeners.add(()=>e.removeEventListener("click",l))}const t=document.getElementById("btn-filter-reset");if(t){const l=()=>this.onFiltersReset();t.addEventListener("click",l),this._boundEventListeners.add(()=>t.removeEventListener("click",l))}const n=document.getElementById("btn-select-all");if(n){const l=()=>this.selectAll();n.addEventListener("click",l),this._boundEventListeners.add(()=>n.removeEventListener("click",l))}const a=document.getElementById("btn-deselect-all");if(a){const l=()=>this.deselectAll();a.addEventListener("click",l),this._boundEventListeners.add(()=>a.removeEventListener("click",l))}const r=document.getElementById("btn-delete-selected");if(r){const l=()=>this.bulkDelete();r.addEventListener("click",l),this._boundEventListeners.add(()=>r.removeEventListener("click",l))}const i=document.getElementById("select-all-auftragsdetails");if(i){const l=()=>this.toggleSelectAll();i.addEventListener("change",l),this._boundEventListeners.add(()=>i.removeEventListener("change",l))}const s=l=>{const u=l.target.closest(".table-link");if(u){l.preventDefault();const c=u.dataset.table,m=u.dataset.id;c&&m&&window.navigateTo(`/${c}/${m}`)}const d=l.target.closest(".detail-check");if(d){const c=d.dataset.id;d.checked?this.selectedDetails.add(c):this.selectedDetails.delete(c),this.updateSelection()}},o=document.querySelector(".data-table tbody");o&&(o.addEventListener("click",s),o.addEventListener("change",s),this._boundEventListeners.add(()=>{o.removeEventListener("click",s),o.removeEventListener("change",s)}))}selectAll(){document.querySelectorAll(".detail-check").forEach(n=>{n.checked=!0,this.selectedDetails.add(n.dataset.id)});const t=document.getElementById("select-all-auftragsdetails");t&&(t.checked=!0),this.updateSelection()}toggleSelectAll(){const e=document.getElementById("select-all-auftragsdetails");document.querySelectorAll(".detail-check").forEach(n=>{n.checked=e.checked;const a=n.dataset.id;e.checked?this.selectedDetails.add(a):this.selectedDetails.delete(a)}),this.updateSelection()}deselectAll(){this.selectedDetails.clear(),document.querySelectorAll(".detail-check").forEach(t=>t.checked=!1);const e=document.getElementById("select-all-auftragsdetails");e&&(e.checked=!1),this.updateSelection()}updateSelection(){const e=this.selectedDetails.size,t=document.getElementById("selected-count"),n=document.getElementById("btn-select-all"),a=document.getElementById("btn-deselect-all"),r=document.getElementById("btn-delete-selected");t&&(t.textContent=`${e} ausgewählt`,t.style.display=e>0?"inline-block":"none"),n&&(n.style.display=e===0?"inline-block":"none"),a&&(a.style.display=e>0?"inline-block":"none"),r&&(r.style.display=e>0?"inline-block":"none"),this.updateSelectAllCheckbox()}updateSelectAllCheckbox(){const e=document.getElementById("select-all-auftragsdetails");if(!e)return;const t=document.querySelectorAll(".detail-check"),n=t.length>0&&Array.from(t).every(r=>r.checked),a=Array.from(t).some(r=>r.checked);e.checked=n,e.indeterminate=a&&!n}async bulkDelete(){if(!(this.selectedDetails.size===0||!await window.confirmationModal.show({title:"Auftragsdetails löschen",message:`Möchten Sie wirklich ${this.selectedDetails.size} Auftragsdetails löschen?`,confirmText:"Löschen",cancelText:"Abbrechen",type:"danger"})))try{const t=Array.from(this.selectedDetails).map(n=>window.dataService.deleteEntity("auftrag_details",n));await Promise.all(t),window.notificationSystem?.show(`${this.selectedDetails.size} Auftragsdetails erfolgreich gelöscht`,"success"),this.selectedDetails.clear(),await this.loadAndRender()}catch(t){console.error("Fehler beim Löschen:",t),window.notificationSystem?.show("Fehler beim Löschen der Auftragsdetails","error")}}updateTable(e){const t=document.querySelector(".data-table tbody");if(!t)return;if(!e||e.length===0){t.innerHTML=`
        <tr>
          <td colspan="9" class="no-data">Keine Auftragsdetails gefunden</td>
        </tr>
      `;return}const n=e.map(a=>{const r=a.auftrag||{},i=r.unternehmen||{},s=r.marke||{};return`
        <tr data-id="${a.id}">
          <td><input type="checkbox" class="detail-check" data-id="${a.id}"></td>
          <td>
            <a href="#" class="table-link" data-table="auftrag" data-id="${r.id||""}">
              ${window.validatorSystem.sanitizeHtml(r.auftragsname||"-")}
            </a>
          </td>
          <td>
            ${i.firmenname?`<a href="#" class="table-link" data-table="unternehmen" data-id="${i.id}">${window.validatorSystem.sanitizeHtml(i.firmenname)}</a>`:"-"}
          </td>
          <td>
            ${s.markenname?`<a href="#" class="table-link" data-table="marke" data-id="${s.id}">${window.validatorSystem.sanitizeHtml(s.markenname)}</a>`:"-"}
          </td>
          <td>${a.kampagnenanzahl||r.kampagnenanzahl||"-"}</td>
          <td>${a.gesamt_videos||"-"}</td>
          <td>${a.gesamt_creator||"-"}</td>
          <td>${a.created_at?new Date(a.created_at).toLocaleDateString("de-DE"):"-"}</td>
          <td>
            ${B.create("auftragsdetails",a.id)}
          </td>
        </tr>
      `}).join("");t.innerHTML=n}async loadAndRender(){try{console.log("🔄 AUFTRAGSDETAILSLIST: Lade Auftragsdetails..."),await this.render();const e=A.getFilters("auftragsdetails");console.log("🔍 Lade Auftragsdetails mit Filter:",e);const{data:t,error:n}=await window.supabase.from("auftrag_details").select(`
          *,
          auftrag:auftrag_id (
            id,
            auftragsname,
            kampagnenanzahl,
            unternehmen:unternehmen_id (
              id,
              firmenname
            ),
            marke:marke_id (
              id,
              markenname
            )
          )
        `).order("created_at",{ascending:!1});if(n)throw console.error("❌ Fehler beim Laden:",n),n;console.log("📊 Auftragsdetails geladen:",t?.length||0),this.updateTable(t)}catch(e){console.error("❌ AUFTRAGSDETAILSLIST: Fehler beim Laden:",e);const t=document.querySelector(".data-table tbody");t&&(t.innerHTML=`
          <tr>
            <td colspan="9" class="error">Fehler beim Laden der Auftragsdetails</td>
          </tr>
        `)}}destroy(){console.log("🗑️ AUFTRAGSDETAILSLIST: Cleanup"),this._boundEventListeners.forEach(e=>e()),this._boundEventListeners.clear(),this.selectedDetails.clear()}}const Je=new Ye;class Qe{constructor(){this.detailsId=null,this.details=null,this.auftrag=null,this.notizen=[],this.ratings=[]}async init(e){if(console.log("🎯 AUFTRAGSDETAILSDETAIL: Initialisiere Auftragsdetails-Detailseite für ID:",e),window.currentUser?.rolle==="kunde"){window.setHeadline("Zugriff verweigert"),window.content.innerHTML=`
        <div class="error-state">
          <h2>Zugriff verweigert</h2>
          <p>Sie haben keine Berechtigung, diese Seite zu sehen.</p>
        </div>
      `;return}try{this.detailsId=e,await this.loadDetailsData(),window.breadcrumbSystem&&this.auftrag&&window.breadcrumbSystem.updateBreadcrumb([{label:"Auftragsdetails",url:"/auftragsdetails",clickable:!0},{label:this.auftrag.auftragsname||"Details",url:`/auftragsdetails/${this.detailsId}`,clickable:!1}]),this.render(),this.bindEvents(),console.log("✅ AUFTRAGSDETAILSDETAIL: Initialisierung abgeschlossen")}catch(n){console.error("❌ AUFTRAGSDETAILSDETAIL: Fehler bei der Initialisierung:",n),window.ErrorHandler?.handle(n,"AuftragsdetailsDetail.init")}}async loadDetailsData(){console.log("🔄 AUFTRAGSDETAILSDETAIL: Lade Auftragsdetails-Daten...");try{const{data:e,error:t}=await window.supabase.from("auftrag_details").select(`
          *,
          auftrag:auftrag_id (
            id,
            auftragsname,
            kampagnenanzahl,
            status,
            start,
            ende,
            unternehmen:unternehmen_id (
              id,
              firmenname
            ),
            marke:marke_id (
              id,
              markenname
            ),
            ansprechpartner:ansprechpartner_id (
              id,
              vorname,
              nachname,
              email
            )
          )
        `).eq("id",this.detailsId).single();if(t)throw t;this.details=e,this.auftrag=e.auftrag,console.log("✅ AUFTRAGSDETAILSDETAIL: Auftragsdetails geladen:",this.details),window.notizenSystem&&(this.notizen=await window.notizenSystem.loadNotizen("auftrag_details",this.detailsId),console.log("✅ AUFTRAGSDETAILSDETAIL: Notizen geladen:",this.notizen.length)),window.bewertungsSystem&&(this.ratings=await window.bewertungsSystem.loadBewertungen("auftrag_details",this.detailsId),console.log("✅ AUFTRAGSDETAILSDETAIL: Ratings geladen:",this.ratings.length))}catch(e){throw console.error("❌ AUFTRAGSDETAILSDETAIL: Fehler beim Laden der Auftragsdetails-Daten:",e),e}}render(){window.setHeadline(`${this.auftrag?.auftragsname||"Auftragsdetails"} - Details`);const e=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>${this.auftrag?.auftragsname||"Auftragsdetails"} - Produktionsplanung</h1>
          <p>Detaillierte Produktionsinformationen für diesen Auftrag</p>
        </div>
        <div class="page-header-right">
          <button id="btn-edit-details" class="secondary-btn">
            <i class="icon-edit"></i>
            Bearbeiten
          </button>
          <button onclick="window.navigateTo('/auftragsdetails')" class="secondary-btn">
            Zurück zur Übersicht
          </button>
        </div>
      </div>

      <div class="content-section">
        <!-- Tab-Navigation -->
        <div class="tab-navigation">
          <button class="tab-button active" data-tab="informationen">
            Informationen
            <span class="tab-count">1</span>
          </button>
          <button class="tab-button" data-tab="ugc">
            UGC
          </button>
          <button class="tab-button" data-tab="influencer">
            Influencer
          </button>
          <button class="tab-button" data-tab="vor-ort">
            Vor Ort Dreh
          </button>
          <button class="tab-button" data-tab="vor-ort-mitarbeiter">
            Vor Ort Mitarbeiter
          </button>
          <button class="tab-button" data-tab="zusammenfassung">
            Zusammenfassung
          </button>
          ${window.notizenSystem?`
          <button class="tab-button" data-tab="notizen">
            Notizen
            <span class="tab-count">${this.notizen.length}</span>
          </button>
          `:""}
        </div>

        <!-- Tab-Content -->
        <div class="tab-content">
          <!-- Informationen Tab -->
          <div class="tab-pane active" id="informationen">
            ${this.renderInformationen()}
          </div>

          <!-- UGC Tab -->
          <div class="tab-pane" id="ugc">
            ${this.renderUGC()}
          </div>

          <!-- Influencer Tab -->
          <div class="tab-pane" id="influencer">
            ${this.renderInfluencer()}
          </div>

          <!-- Vor Ort Tab -->
          <div class="tab-pane" id="vor-ort">
            ${this.renderVorOrt()}
          </div>

          <!-- Vor Ort Mitarbeiter Tab -->
          <div class="tab-pane" id="vor-ort-mitarbeiter">
            ${this.renderVorOrtMitarbeiter()}
          </div>

          <!-- Zusammenfassung Tab -->
          <div class="tab-pane" id="zusammenfassung">
            ${this.renderZusammenfassung()}
          </div>

          ${window.notizenSystem?`
          <!-- Notizen Tab -->
          <div class="tab-pane" id="notizen">
            ${this.renderNotizen()}
          </div>
          `:""}
        </div>
      </div>
    `;window.setContentSafely(window.content,e)}renderInformationen(){const e=this.auftrag||{},t=e.unternehmen||{},n=e.marke||{},a=e.ansprechpartner||{};return`
      <div class="detail-section">
        <div class="detail-grid">
          <div class="detail-card">
            <h3>Auftrags-Informationen</h3>
            <div class="detail-item">
              <label>Auftragsname:</label>
              <span>
                <a href="#" class="table-link" data-table="auftrag" data-id="${e.id||""}">
                  ${window.validatorSystem.sanitizeHtml(e.auftragsname||"-")}
                </a>
              </span>
            </div>
            <div class="detail-item">
              <label>Unternehmen:</label>
              <span>
                ${t.firmenname?`<a href="#" class="table-link" data-table="unternehmen" data-id="${t.id}">${window.validatorSystem.sanitizeHtml(t.firmenname)}</a>`:"-"}
              </span>
            </div>
            <div class="detail-item">
              <label>Marke:</label>
              <span>
                ${n.markenname?`<a href="#" class="table-link" data-table="marke" data-id="${n.id}">${window.validatorSystem.sanitizeHtml(n.markenname)}</a>`:"-"}
              </span>
            </div>
            <div class="detail-item">
              <label>Ansprechpartner:</label>
              <span>${this.formatAnsprechpartner(a)}</span>
            </div>
            <div class="detail-item">
              <label>Status:</label>
              <span class="status-${e.status?.toLowerCase()||"unknown"}">
                ${e.status||"Unbekannt"}
              </span>
            </div>
            <div class="detail-item">
              <label>Kampagnenanzahl:</label>
              <span>${this.details?.kampagnenanzahl||e.kampagnenanzahl||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Zeitraum:</label>
              <span>
                ${e.start?new Date(e.start).toLocaleDateString("de-DE"):"-"} 
                bis 
                ${e.ende?new Date(e.ende).toLocaleDateString("de-DE"):"-"}
              </span>
            </div>
            <div class="detail-item">
              <label>Erstellt am:</label>
              <span>${this.details?.created_at?new Date(this.details.created_at).toLocaleDateString("de-DE"):"-"}</span>
            </div>
            <div class="detail-item">
              <label>Zuletzt aktualisiert:</label>
              <span>${this.details?.updated_at?new Date(this.details.updated_at).toLocaleDateString("de-DE"):"-"}</span>
            </div>
          </div>
        </div>
      </div>
    `}renderUGC(){const e=this.details||{};return`
      <div class="detail-section">
        <div class="detail-grid">
          <div class="detail-card">
            <h3>UGC (User Generated Content)</h3>
            <div class="detail-item">
              <label>Anzahl Videos:</label>
              <span>${e.ugc_video_anzahl||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Anzahl Creator:</label>
              <span>${e.ugc_creator_anzahl||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Budget & Informationen:</label>
              <div class="budget-info">
                ${e.ugc_budget_info?window.validatorSystem.sanitizeHtml(e.ugc_budget_info):"<em>Keine Informationen hinterlegt</em>"}
              </div>
            </div>
          </div>
        </div>
      </div>
    `}renderInfluencer(){const e=this.details||{};return`
      <div class="detail-section">
        <div class="detail-grid">
          <div class="detail-card">
            <h3>Influencer</h3>
            <div class="detail-item">
              <label>Anzahl Videos:</label>
              <span>${e.influencer_video_anzahl||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Anzahl Creator:</label>
              <span>${e.influencer_creator_anzahl||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Budget & Informationen:</label>
              <div class="budget-info">
                ${e.influencer_budget_info?window.validatorSystem.sanitizeHtml(e.influencer_budget_info):"<em>Keine Informationen hinterlegt</em>"}
              </div>
            </div>
          </div>
        </div>
      </div>
    `}renderVorOrt(){const e=this.details||{};return`
      <div class="detail-section">
        <div class="detail-grid">
          <div class="detail-card">
            <h3>Vor Ort Dreh</h3>
            <div class="detail-item">
              <label>Anzahl Videos:</label>
              <span>${e.vor_ort_video_anzahl||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Anzahl Creator:</label>
              <span>${e.vor_ort_creator_anzahl||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Anzahl Videographen:</label>
              <span>${e.vor_ort_videographen_anzahl||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Budget & Informationen:</label>
              <div class="budget-info">
                ${e.vor_ort_budget_info?window.validatorSystem.sanitizeHtml(e.vor_ort_budget_info):"<em>Keine Informationen hinterlegt</em>"}
              </div>
            </div>
          </div>
        </div>
      </div>
    `}renderVorOrtMitarbeiter(){const e=this.details||{};return`
      <div class="detail-section">
        <div class="detail-grid">
          <div class="detail-card">
            <h3>Vor Ort Dreh Mitarbeiter</h3>
            <div class="detail-item">
              <label>Anzahl Videos:</label>
              <span>${e.vor_ort_mitarbeiter_video_anzahl||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Anzahl Videographen:</label>
              <span>${e.vor_ort_mitarbeiter_videographen_anzahl||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Budget & Informationen:</label>
              <div class="budget-info">
                ${e.vor_ort_mitarbeiter_budget_info?window.validatorSystem.sanitizeHtml(e.vor_ort_mitarbeiter_budget_info):"<em>Keine Informationen hinterlegt</em>"}
              </div>
            </div>
          </div>
        </div>
      </div>
    `}renderZusammenfassung(){const e=this.details||{},t=n=>n||n===0?new Intl.NumberFormat("de-DE").format(n):"-";return`
      <div class="detail-section">
        <div class="detail-grid">
          <div class="detail-card">
            <h3>Gesamtübersicht</h3>
            <div class="detail-item">
              <label>Gesamtanzahl Videos (geplant):</label>
              <span class="highlight-value">${t(e.gesamt_videos)}</span>
            </div>
            <div class="detail-item">
              <label>Gesamtanzahl Creator (geplant):</label>
              <span class="highlight-value">${t(e.gesamt_creator)}</span>
            </div>
          </div>
          
          <div class="detail-card">
            <h3>Aufschlüsselung nach Kategorie</h3>
            <div class="category-breakdown">
              <div class="breakdown-item">
                <strong>UGC:</strong>
                <span>${t(e.ugc_video_anzahl)} Videos, ${t(e.ugc_creator_anzahl)} Creator</span>
              </div>
              <div class="breakdown-item">
                <strong>Influencer:</strong>
                <span>${t(e.influencer_video_anzahl)} Videos, ${t(e.influencer_creator_anzahl)} Creator</span>
              </div>
              <div class="breakdown-item">
                <strong>Vor Ort:</strong>
                <span>${t(e.vor_ort_video_anzahl)} Videos, ${t(e.vor_ort_creator_anzahl)} Creator, ${t(e.vor_ort_videographen_anzahl)} Videographen</span>
              </div>
              <div class="breakdown-item">
                <strong>Vor Ort Mitarbeiter:</strong>
                <span>${t(e.vor_ort_mitarbeiter_video_anzahl)} Videos, ${t(e.vor_ort_mitarbeiter_videographen_anzahl)} Videographen</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `}renderNotizen(){return window.notizenSystem?window.notizenSystem.renderNotizenContainer(this.notizen,"auftrag_details",this.detailsId):"<p>Notizen-System nicht verfügbar</p>"}formatAnsprechpartner(e){if(!e)return"-";const t=[e.vorname,e.nachname].filter(Boolean).join(" ");return e.email?`${t} (${e.email})`:t}bindEvents(){document.addEventListener("click",e=>{if(e.target.classList.contains("tab-button")){const n=e.target.dataset.tab;this.switchTab(n)}(e.target.id==="btn-edit-details"||e.target.closest("#btn-edit-details"))&&this.showEditForm();const t=e.target.closest(".table-link");if(t){e.preventDefault();const n=t.dataset.table,a=t.dataset.id;n&&a&&window.navigateTo(`/${n}/${a}`)}}),document.addEventListener("notizenUpdated",()=>{this.loadDetailsData().then(()=>{this.render(),this.bindEvents()})}),document.addEventListener("bewertungenUpdated",()=>{this.loadDetailsData().then(()=>{this.render(),this.bindEvents()})})}switchTab(e){document.querySelectorAll(".tab-button").forEach(a=>{a.classList.remove("active")}),document.querySelectorAll(".tab-pane").forEach(a=>{a.classList.remove("active")});const t=document.querySelector(`[data-tab="${e}"]`),n=document.getElementById(e);t&&t.classList.add("active"),n&&n.classList.add("active")}showEditForm(){console.log("🎯 AUFTRAGSDETAILSDETAIL: Öffne Bearbeitungsformular via Drawer"),window.auftragsDetailsManager?window.auftragsDetailsManager.open(this.auftrag.id):window.notificationSystem?.show("Bearbeitungsformular nicht verfügbar","error")}destroy(){console.log("AUFTRAGSDETAILSDETAIL: Cleaning up...")}}const Xe=new Qe;class et{constructor(){this.formData={}}async init(){if(console.log("🎯 AUFTRAGSDETAILSCREATE: Initialisiere Auftragsdetails-Erstellung"),window.currentUser?.rolle==="kunde"){window.setHeadline("Zugriff verweigert"),window.content.innerHTML=`
        <div class="error-state">
          <h2>Zugriff verweigert</h2>
          <p>Sie haben keine Berechtigung, diese Seite zu sehen.</p>
        </div>
      `;return}await this.showCreateForm()}async showCreateForm(){console.log("🎯 AUFTRAGSDETAILSCREATE: Zeige Auftragsdetails-Erstellungsformular"),window.setHeadline("Neue Auftragsdetails anlegen"),window.breadcrumbSystem&&window.breadcrumbSystem.updateBreadcrumb([{label:"Auftragsdetails",url:"/auftragsdetails",clickable:!0},{label:"Neue Auftragsdetails",url:"/auftragsdetails/new",clickable:!1}]);const{data:e,error:t}=await window.supabase.from("auftrag_details").select("auftrag_id");if(t){console.error("Fehler beim Laden der existierenden Details:",t),window.showNotification("Fehler beim Laden der Daten","error");return}const n=e.map(o=>o.auftrag_id);console.log("📋 Aufträge mit Details:",n);const{data:a,error:r}=await window.supabase.from("auftrag").select("id, auftragsname, unternehmen:unternehmen_id(firmenname), marke:marke_id(markenname)").order("created_at",{ascending:!1});if(r){console.error("Fehler beim Laden der Aufträge:",r),window.showNotification("Fehler beim Laden der Aufträge","error");return}const i=a.filter(o=>!n.includes(o.id));console.log("📊 Alle Aufträge:",a?.length||0),console.log("✅ Verfügbare Aufträge ohne Details:",i?.length||0);const s=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Neue Auftragsdetails anlegen</h1>
          <p>Erstellen Sie detaillierte Produktionsplanung für einen Auftrag</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/auftragsdetails')" class="secondary-btn">Zurück zur Übersicht</button>
        </div>
      </div>
      
      <div class="form-page">
        <form id="auftragsdetails-form" class="entity-form">
          
          <!-- Auftrag Auswahl -->
          <div class="form-section">
            <h2 class="section-title">Auftrag</h2>
            
            <div class="form-row">
              <div class="form-group">
                <label for="auftrag_id" class="form-label required">Auftrag auswählen</label>
                <select id="auftrag_id" name="auftrag_id" class="form-select" required ${i.length===0?"disabled":""}>
                  ${i.length===0?'<option value="">Keine Aufträge verfügbar (alle haben bereits Details)</option>':'<option value="">Bitte auswählen...</option>'}
                  ${i.map(o=>`
                    <option value="${o.id}">
                      ${o.auftragsname} ${o.unternehmen?`(${o.unternehmen.firmenname})`:""}
                    </option>
                  `).join("")}
                </select>
                ${i.length===0?'<div class="form-help" style="color: #e74c3c;">Alle Aufträge haben bereits Auftragsdetails. Bitte erstellen Sie zuerst einen neuen Auftrag.</div>':""}
              </div>

              <div class="form-group">
                <label for="kampagnenanzahl" class="form-label">Anzahl Kampagnen</label>
                <input type="number" id="kampagnenanzahl" name="kampagnenanzahl" class="form-input" min="0" placeholder="z.B. 4">
              </div>
            </div>
          </div>

          <!-- UGC Content -->
          <div class="form-section">
            <h2 class="section-title">UGC (User Generated Content)</h2>
            
            <div class="form-row">
              <div class="form-group">
                <label for="ugc_video_anzahl" class="form-label">Anzahl Videos</label>
                <input type="number" id="ugc_video_anzahl" name="ugc_video_anzahl" class="form-input" min="0" placeholder="z.B. 10">
              </div>
              <div class="form-group">
                <label for="ugc_creator_anzahl" class="form-label">Anzahl Creator</label>
                <input type="number" id="ugc_creator_anzahl" name="ugc_creator_anzahl" class="form-input" min="0" placeholder="z.B. 5">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="ugc_budget_info" class="form-label">Budget-Info</label>
                <textarea id="ugc_budget_info" name="ugc_budget_info" class="form-input" rows="3" placeholder="Budget-Details für UGC..."></textarea>
              </div>
            </div>
          </div>

          <!-- Influencer Content -->
          <div class="form-section">
            <h2 class="section-title">Influencer Marketing</h2>
            
            <div class="form-row">
              <div class="form-group">
                <label for="influencer_video_anzahl" class="form-label">Anzahl Videos</label>
                <input type="number" id="influencer_video_anzahl" name="influencer_video_anzahl" class="form-input" min="0" placeholder="z.B. 8">
              </div>
              <div class="form-group">
                <label for="influencer_creator_anzahl" class="form-label">Anzahl Creator</label>
                <input type="number" id="influencer_creator_anzahl" name="influencer_creator_anzahl" class="form-input" min="0" placeholder="z.B. 4">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="influencer_budget_info" class="form-label">Budget-Info</label>
                <textarea id="influencer_budget_info" name="influencer_budget_info" class="form-input" rows="3" placeholder="Budget-Details für Influencer..."></textarea>
              </div>
            </div>
          </div>

          <!-- Vor Ort -->
          <div class="form-section">
            <h2 class="section-title">Vor Ort (External)</h2>
            
            <div class="form-row">
              <div class="form-group">
                <label for="vor_ort_video_anzahl" class="form-label">Anzahl Videos</label>
                <input type="number" id="vor_ort_video_anzahl" name="vor_ort_video_anzahl" class="form-input" min="0" placeholder="z.B. 6">
              </div>
              <div class="form-group">
                <label for="vor_ort_creator_anzahl" class="form-label">Anzahl Creator</label>
                <input type="number" id="vor_ort_creator_anzahl" name="vor_ort_creator_anzahl" class="form-input" min="0" placeholder="z.B. 3">
              </div>
              <div class="form-group">
                <label for="vor_ort_videographen_anzahl" class="form-label">Anzahl Videographen</label>
                <input type="number" id="vor_ort_videographen_anzahl" name="vor_ort_videographen_anzahl" class="form-input" min="0" placeholder="z.B. 2">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="vor_ort_budget_info" class="form-label">Budget-Info</label>
                <textarea id="vor_ort_budget_info" name="vor_ort_budget_info" class="form-input" rows="3" placeholder="Budget-Details für Vor-Ort..."></textarea>
              </div>
            </div>
          </div>

          <!-- Vor Ort Mitarbeiter -->
          <div class="form-section">
            <h2 class="section-title">Vor Ort (Mitarbeiter)</h2>
            
            <div class="form-row">
              <div class="form-group">
                <label for="vor_ort_mitarbeiter_video_anzahl" class="form-label">Anzahl Videos</label>
                <input type="number" id="vor_ort_mitarbeiter_video_anzahl" name="vor_ort_mitarbeiter_video_anzahl" class="form-input" min="0" placeholder="z.B. 4">
              </div>
              <div class="form-group">
                <label for="vor_ort_mitarbeiter_videographen_anzahl" class="form-label">Anzahl Videographen</label>
                <input type="number" id="vor_ort_mitarbeiter_videographen_anzahl" name="vor_ort_mitarbeiter_videographen_anzahl" class="form-input" min="0" placeholder="z.B. 2">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="vor_ort_mitarbeiter_budget_info" class="form-label">Budget-Info</label>
                <textarea id="vor_ort_mitarbeiter_budget_info" name="vor_ort_mitarbeiter_budget_info" class="form-input" rows="3" placeholder="Budget-Details für Mitarbeiter Vor-Ort..."></textarea>
              </div>
            </div>
          </div>

          <!-- Gesamt -->
          <div class="form-section">
            <h2 class="section-title">Gesamt (automatisch berechnet)</h2>
            
            <div class="form-row">
              <div class="form-group">
                <label for="gesamt_videos" class="form-label">Gesamt Videos</label>
                <input type="number" id="gesamt_videos" name="gesamt_videos" class="form-input" min="0" placeholder="Automatisch berechnet" readonly>
                <div class="form-help">Wird automatisch aus allen Video-Anzahlen berechnet</div>
              </div>
              <div class="form-group">
                <label for="gesamt_creator" class="form-label">Gesamt Creator</label>
                <input type="number" id="gesamt_creator" name="gesamt_creator" class="form-input" min="0" placeholder="Automatisch berechnet" readonly>
                <div class="form-help">Wird automatisch aus allen Creator-Anzahlen berechnet</div>
              </div>
            </div>
          </div>

          <!-- Submit Buttons -->
          <div class="form-actions">
            <button type="button" onclick="window.navigateTo('/auftragsdetails')" class="btn btn-secondary">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Abbrechen
            </button>
            
            <button type="submit" class="btn btn-primary">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Auftragsdetails erstellen
            </button>
          </div>
        </form>
      </div>
    `;window.content.innerHTML=s,this.bindFormEvents()}bindFormEvents(){const e=document.getElementById("auftragsdetails-form");if(!e)return;const t=["ugc_video_anzahl","influencer_video_anzahl","vor_ort_video_anzahl","vor_ort_mitarbeiter_video_anzahl"],n=["ugc_creator_anzahl","influencer_creator_anzahl","vor_ort_creator_anzahl"],a=()=>{let r=0,i=0;t.forEach(s=>{const o=parseInt(document.getElementById(s)?.value||0);r+=o}),n.forEach(s=>{const o=parseInt(document.getElementById(s)?.value||0);i+=o}),document.getElementById("gesamt_videos").value=r||"",document.getElementById("gesamt_creator").value=i||""};[...t,...n].forEach(r=>{const i=document.getElementById(r);i&&i.addEventListener("input",a)}),e.addEventListener("submit",r=>this.handleFormSubmit(r))}async handleFormSubmit(e){e.preventDefault();try{const t=document.querySelector('#auftragsdetails-form button[type="submit"]');t&&(t.innerHTML="Erstelle...",t.disabled=!0);const n=document.getElementById("auftragsdetails-form"),a=new FormData(n),r={};for(let[o,l]of a.entries())l===""||l===null?r[o]=null:["kampagnenanzahl","ugc_video_anzahl","ugc_creator_anzahl","influencer_video_anzahl","influencer_creator_anzahl","vor_ort_video_anzahl","vor_ort_creator_anzahl","vor_ort_videographen_anzahl","vor_ort_mitarbeiter_video_anzahl","vor_ort_mitarbeiter_videographen_anzahl","gesamt_videos","gesamt_creator"].includes(o)?r[o]=l?parseInt(l):null:r[o]=l;if(console.log("📤 Auftragsdetails-Daten:",r),!r.auftrag_id){window.showNotification("Bitte wählen Sie einen Auftrag aus","error"),t&&(t.innerHTML="Auftragsdetails erstellen",t.disabled=!1);return}const{data:i,error:s}=await window.supabase.from("auftrag_details").insert([r]).select().single();if(s)throw s;console.log("✅ Auftragsdetails erfolgreich erstellt:",i),window.showNotification("Auftragsdetails erfolgreich erstellt","success"),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"auftrag_details",id:i.id,action:"created"}})),setTimeout(()=>{window.navigateTo(`/auftragsdetails/${i.id}`)},500)}catch(t){console.error("Fehler beim Erstellen:",t),window.ErrorHandler?.handle(t,"AuftragsdetailsCreate.handleFormSubmit"),window.showNotification(`Fehler beim Erstellen der Auftragsdetails: ${t.message}`,"error");const n=document.querySelector('#auftragsdetails-form button[type="submit"]');n&&(n.innerHTML="Auftragsdetails erstellen",n.disabled=!1)}}destroy(){console.log("🎯 AUFTRAGSDETAILSCREATE: Destroy")}}const tt=new et;class nt{constructor(){this.formData={}}async init(){console.log("🎯 MARKECREATE: Initialisiere Marke-Erstellung"),this.showCreateForm()}showCreateForm(){console.log("🎯 MARKECREATE: Zeige Marke-Erstellungsformular mit FormSystem"),window.setHeadline("Neue Marke anlegen"),window.breadcrumbSystem&&window.breadcrumbSystem.updateBreadcrumb([{label:"Marken",url:"/marke",clickable:!0},{label:"Neue Marke",url:"/marke/new",clickable:!1}]);const e=window.formSystem.renderFormOnly("marke");window.content.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Neue Marke anlegen</h1>
          <p>Erstellen Sie eine neue Marke für das CRM</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/marke')" class="secondary-btn">Zurück zur Übersicht</button>
        </div>
      </div>
      
      <div class="form-page">
        ${e}
      </div>
    `,window.formSystem.bindFormEvents("marke",null);const t=document.getElementById("marke-form");t&&(t.onsubmit=async n=>{n.preventDefault(),await this.handleFormSubmit()})}async handleFormSubmit(){try{console.log("🎯 MARKECREATE: Verarbeite Formular-Submit");const e=document.querySelector('#marke-form button[type="submit"]');let t="Marke anlegen";e&&(t=e.innerHTML,e.innerHTML='<div class="loading-spinner"></div> Wird angelegt...',e.disabled=!0);const n=document.getElementById("marke-form"),a=new FormData(n),r={},i={},s=n.querySelectorAll('select[data-tag-based="true"]');console.log("🏷️ Tag-basierte Selects gefunden:",s.length),s.forEach(d=>{let c=n.querySelector(`select[name="${d.name}"][style*="display: none"]`);if(!c){const m=n.querySelectorAll(`select[name="${d.name}"]`);m.length>1&&(c=m[1])}if(c){const m=Array.from(c.selectedOptions).map(h=>h.value).filter(h=>h!=="");m.length>0&&(i[d.name]=m,console.log(`🏷️ Tag-basiertes Multi-Select ${d.name}:`,m))}});const o=n.querySelector('select[name="branche_ids[]"]');if(o&&o.multiple){const d=Array.from(o.selectedOptions);if(d.length>0){const c=d.map(m=>m.value).filter(m=>m!=="");c.length>0&&(i.branche_ids=c,console.log("🏷️ MARKECREATE: Verstecktes Branchen-Select manuell verarbeitet:",c))}}for(let[d,c]of a.entries())if(!i.hasOwnProperty(d))if(d.includes("[]")){const m=d.replace("[]","");i[m]||(i[m]=[]),i[m].push(c)}else i[d]?(Array.isArray(i[d])||(i[d]=[i[d]]),i[d].push(c)):i[d]=c;for(let[d,c]of Object.entries(i))Array.isArray(c)&&(i[d]=[...new Set(c)]);for(let[d,c]of Object.entries(i))r[d]=Array.isArray(c)?c:c.trim();console.log("📤 Finale Marke-Daten:",r);const l=window.validatorSystem.validateForm(r,{markenname:{type:"text",minLength:2,required:!0}});if(!l.isValid){this.showValidationErrors(l.errors);return}const u=await window.dataService.createEntity("marke",r);if(u.success)this.showSuccessMessage("Marke erfolgreich erstellt!"),setTimeout(()=>{window.navigateTo("/marke")},1500);else throw new Error(u.error||"Fehler beim Erstellen der Marke")}catch(e){console.error("❌ Fehler beim Erstellen der Marke:",e),this.showErrorMessage(e.message||"Ein unerwarteter Fehler ist aufgetreten")}finally{const e=document.querySelector('#marke-form button[type="submit"]');e&&(e.innerHTML="Marke erstellen",e.disabled=!1)}}showValidationErrors(e){document.querySelectorAll(".field-error").forEach(t=>t.remove());for(const[t,n]of Object.entries(e)){const a=document.querySelector(`[name="${t}"]`);if(a){const r=document.createElement("div");r.className="field-error",r.textContent=n,r.style.color="red",r.style.fontSize="12px",r.style.marginTop="4px",a.parentNode.appendChild(r)}}}showSuccessMessage(e){const t=document.createElement("div");t.className="toast success",t.textContent=e,t.style.cssText=`
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `,document.body.appendChild(t),setTimeout(()=>t.style.opacity="1",100),setTimeout(()=>{t.style.opacity="0",setTimeout(()=>t.remove(),300)},3e3)}showErrorMessage(e){const t=document.createElement("div");t.className="toast error",t.textContent=e,t.style.cssText=`
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ef4444;
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `,document.body.appendChild(t),setTimeout(()=>t.style.opacity="1",100),setTimeout(()=>{t.style.opacity="0",setTimeout(()=>t.remove(),300)},3e3)}destroy(){console.log("🎯 MARKECREATE: Destroy")}}const Z=new nt;class at{constructor(){this.selectedMarken=new Set,this._boundEventListeners=new Set}async init(){if(console.log("🎯 MARKELLIST: Initialisiere Marken-Liste"),window.moduleRegistry?.currentModule!==this){console.log("⚠️ MARKELLIST: Nicht mehr das aktuelle Modul, breche ab");return}window.setHeadline("Marken Übersicht"),window.breadcrumbSystem&&window.breadcrumbSystem.updateBreadcrumb([{label:"Marke",url:"/marke",clickable:!1}]),window.bulkActionSystem?.registerList("marke",this);const e=window.canViewPage&&window.canViewPage("marke")||await window.checkUserPermission("marke","can_view");if(console.log("🔐 MARKELLIST: Berechtigung für marke.can_view:",e),!e){console.log("❌ MARKELLIST: Keine Berechtigung für Marken"),window.content.innerHTML=`
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Marken anzuzeigen.</p>
        </div>
      `;return}console.log("✅ MARKELLIST: Berechtigung OK, lade Marken..."),this.bindEvents(),await this.loadAndRender(),console.log("✅ MARKELLIST: Initialisierung abgeschlossen")}async loadAndRender(){try{await this.render();const e=A.getFilters("marke");console.log("🔍 Lade Marken mit Filter:",e);const t=await this.loadMarkenWithRelations(e);console.log("📊 Marken geladen:",t?.length||0),this.updateTable(t)}catch(e){window.ErrorHandler.handle(e,"MarkeList.loadAndRender")}}async loadMarkenWithRelations(e={}){try{if(!window.supabase)return console.warn("⚠️ Supabase nicht verfügbar - verwende Mock-Daten"),await window.dataService.loadEntities("marke",e);const t=window.currentUser?.rolle==="admin";let n=[];if(console.log("🔍 MARKELIST: Sichtbarkeits-Check:",{currentUser:window.currentUser?.name,rolle:window.currentUser?.rolle,isAdmin:t,userId:window.currentUser?.id}),!t)try{const{data:o,error:l}=await window.supabase.from("marke_mitarbeiter").select("marke_id").eq("mitarbeiter_id",window.currentUser?.id);l&&console.error("❌ MARKELIST: Fehler beim Laden der Zuordnungen:",l),n=(o||[]).map(u=>u.marke_id).filter(Boolean),console.log("🔍 MARKELIST: Zugeordnete Marken für Nicht-Admin:",{assignedMarken:o,allowedMarkeIds:n})}catch(o){console.error("❌ MARKELIST: Exception beim Laden der Zuordnungen:",o)}let a=window.supabase.from("marke").select(`
          *,
          unternehmen:unternehmen_id(id, firmenname),
          branchen:marke_branchen(branche:branche_id(id, name)),
          ansprechpartner:ansprechpartner_marke(ansprechpartner:ansprechpartner_id(id, vorname, nachname, email)),
          mitarbeiter:marke_mitarbeiter(mitarbeiter:mitarbeiter_id(id, name))
        `).order("created_at",{ascending:!1});if(t)console.log("✅ MARKELIST: Admin-Benutzer - alle Marken werden geladen");else if(n.length>0)a=a.in("id",n),console.log("🔍 MARKELIST: Query eingeschränkt auf Marken-IDs:",n);else return console.log("⚠️ MARKELIST: Keine zugeordneten Marken - leeres Ergebnis"),[];if(e){const o=(l,u,d="string")=>{u==null||u===""||u==="[object Object]"||(d==="string"?a=a.ilike(l,`%${u}%`):(d==="exact"||d==="uuid")&&(a=a.eq(l,u)))};o("markenname",e.markenname),o("unternehmen_id",e.unternehmen_id,"uuid"),o("branche_id",e.branche_id,"uuid")}const{data:r,error:i}=await a;if(i)throw console.error("❌ Fehler beim Laden der Marken mit Beziehungen:",i),i;const s=(r||[]).map(o=>({...o,branchen:(o.branchen||[]).map(l=>l.branche).filter(Boolean),ansprechpartner:(o.ansprechpartner||[]).map(l=>l.ansprechpartner).filter(Boolean),mitarbeiter:(o.mitarbeiter||[]).map(l=>l.mitarbeiter).filter(Boolean)}));return console.log("✅ Marken mit Beziehungen geladen:",s.length),s}catch(t){return console.error("❌ Fehler beim Laden der Marken:",t),await window.dataService.loadEntities("marke",e)}}async render(){const e=window.currentUser?.permissions?.marke?.can_edit||!1,t=A.getFilters("marke");Object.entries(t).forEach(([r,i])=>{});let n=`<div class="filter-bar">
      <div class="filter-left">
        <div id="filter-container"></div>
      </div>
      <div class="filter-right">
        <button id="btn-filter-reset" class="secondary-btn" style="display:${this.hasActiveFilters()?"inline-block":"none"};">Filter zurücksetzen</button>
      </div>
    </div>`,a=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Marken</h1>
          <p>Verwalten Sie alle Marken und deren Eigenschaften</p>
        </div>
        <div class="page-header-right">
          ${e?'<button id="btn-marke-new" class="primary-btn">Neue Marke anlegen</button>':""}
        </div>
      </div>

      <div class="table-filter-wrapper">
        ${n}
        <div class="table-actions">
          <button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
          <span id="selected-count" style="display:none;">0 ausgewählt</span>
          <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th><input type="checkbox" id="select-all-marken"></th>
              <th>Markenname</th>
              <th>Unternehmen</th>
              <th>Branche</th>
              <th>Webseite</th>
              <th>Ansprechpartner</th>
              <th>Zuständigkeit</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="8" class="no-data">Lade Marken...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;window.setContentSafely(window.content,a),await this.initializeFilterBar()}async initializeFilterBar(){const e=document.getElementById("filter-container");e&&await A.renderFilterBar("marke",e,t=>this.onFiltersApplied(t),()=>this.onFiltersReset())}onFiltersApplied(e){console.log("Filter angewendet:",e),A.applyFilters("marke",e),this.loadAndRender()}onFiltersReset(){console.log("Filter zurückgesetzt"),A.resetFilters("marke"),this.loadAndRender()}bindEvents(){this.boundFilterResetHandler=e=>{e.target.id==="btn-filter-reset"&&this.onFiltersReset()},document.addEventListener("click",this.boundFilterResetHandler),document.addEventListener("click",e=>{(e.target.id==="btn-marke-new"||e.target.id==="btn-marke-new-filter")&&(e.preventDefault(),window.navigateTo("/marke/new"))}),document.addEventListener("click",e=>{if(e.target.classList.contains("table-link")&&e.target.dataset.table==="marke"){e.preventDefault();const t=e.target.dataset.id;console.log("🎯 MARKELIST: Navigiere zu Marken Details:",t),window.navigateTo(`/marke/${t}`)}}),document.addEventListener("click",e=>{if(e.target.id==="btn-select-all"){e.preventDefault(),document.querySelectorAll(".marke-check").forEach(a=>{a.checked=!0,a.dataset.id&&this.selectedMarken.add(a.dataset.id)});const n=document.getElementById("select-all-marken");n&&(n.indeterminate=!1,n.checked=!0),this.updateSelection()}}),document.addEventListener("click",e=>{if(e.target.id==="btn-deselect-all"){e.preventDefault(),document.querySelectorAll(".marke-check").forEach(a=>{a.checked=!1}),this.selectedMarken.clear();const n=document.getElementById("select-all-marken");n&&(n.indeterminate=!1,n.checked=!1),this.updateSelection()}}),window.addEventListener("entityUpdated",e=>{e.detail.entity==="marke"&&this.loadAndRender()}),document.addEventListener("click",e=>{if(e.target.classList.contains("tag-x")){e.preventDefault(),e.stopPropagation();const n=e.target.closest(".filter-tag").dataset.key,a=A.getFilters("marke");delete a[n],A.applyFilters("marke",a),this.loadAndRender()}}),document.addEventListener("change",e=>{e.target.id==="select-all-marken"&&(document.querySelectorAll(".marke-check").forEach(n=>{n.checked=e.target.checked,e.target.checked?this.selectedMarken.add(n.dataset.id):this.selectedMarken.delete(n.dataset.id)}),this.updateSelection())}),document.addEventListener("change",e=>{e.target.classList.contains("marke-check")&&(e.target.checked?this.selectedMarken.add(e.target.dataset.id):this.selectedMarken.delete(e.target.dataset.id),this.updateSelection())})}hasActiveFilters(){const e=A.getFilters("marke");return Object.keys(e).length>0}updateSelection(){const e=this.selectedMarken.size,t=document.getElementById("selected-count"),n=document.getElementById("btn-deselect-all"),a=document.getElementById("btn-delete-selected");t&&(t.textContent=`${e} ausgewählt`,t.style.display=e>0?"inline":"none"),n&&(n.style.display=e>0?"inline-block":"none"),a&&(a.style.display=e>0?"inline-block":"none")}async updateTable(e){const t=document.querySelector(".data-table tbody");if(!t)return;if(!e||e.length===0){const{renderEmptyState:a}=await x(async()=>{const{renderEmptyState:r}=await import("./core-C7Vz5Umf.js").then(i=>i.F);return{renderEmptyState:r}},[]);a(t);return}const n=e.map(a=>`
      <tr data-id="${a.id}">
        <td><input type="checkbox" class="marke-check" data-id="${a.id}"></td>
        <td>
          <a href="#" class="table-link" data-table="marke" data-id="${a.id}">
            ${window.validatorSystem.sanitizeHtml(a.markenname||"")}
          </a>
        </td>
        <td>${window.validatorSystem.sanitizeHtml(a.unternehmen?.firmenname||"Kein Unternehmen zugeordnet")}</td>
        <td>${this.renderBranchen(a.branchen)}</td>
        <td>${a.webseite?`<a href="${a.webseite}" target="_blank" class="table-link">${a.webseite}</a>`:"-"}</td>
        <td>${this.renderAnsprechpartner(a.ansprechpartner)}</td>
        <td>${this.renderZustaendigkeit(a.zustaendigkeit,a.mitarbeiter)}</td>
        <td>
          ${B.create("marke",a.id)}
        </td>
      </tr>
    `).join("");t.innerHTML=n}renderBranchen(e){return!e||e.length===0?"-":`<div class="tags tags-compact">${e.filter(n=>n&&n.name).map(n=>`<span class="tag tag--branche">${n.name}</span>`).join("")}</div>`}renderAnsprechpartner(e){if(!e||e.length===0)return"-";const t=e.filter(n=>n&&n.vorname&&n.nachname).map(n=>({name:`${n.vorname} ${n.nachname}`,type:"person",id:n.id,entityType:"ansprechpartner"}));return z.renderBubbles(t)}renderZustaendigkeit(e,t){if(t&&t.length>0){const n=t.filter(a=>a&&a.name).map(a=>({name:a.name,type:"person",id:a.id,entityType:"mitarbeiter"}));return z.renderBubbles(n)}if(!e||e.length===0)return"-";if(Array.isArray(e)){const n=e.map(a=>({name:a.mitarbeiter?.name||"Unbekannt",type:"person",id:a.mitarbeiter?.id,entityType:"mitarbeiter"}));return z.renderBubbles(n)}return`<span class="text-muted">${e.mitarbeiter?.name||"Unbekannt"}</span>`}destroy(){console.log("🗑️ MARKELLIST: Destroy aufgerufen"),this._boundEventListeners.forEach(({element:e,type:t,handler:n})=>{e.removeEventListener(t,n)}),this._boundEventListeners.clear(),this.boundFilterResetHandler&&(document.removeEventListener("click",this.boundFilterResetHandler),this.boundFilterResetHandler=null),window.setContentSafely(""),console.log("✅ MARKELLIST: Destroy abgeschlossen")}async showDeleteSelectedConfirmation(){const e=this.selectedMarken.size;if(console.log(`🔧 MarkeList: showDeleteSelectedConfirmation aufgerufen, selectedCount: ${e}`,Array.from(this.selectedMarken)),e===0){alert("Keine Marken ausgewählt.");return}const t=e===1?"Möchten Sie die ausgewählte Marke wirklich löschen?":`Möchten Sie die ${e} ausgewählten Marken wirklich löschen?`;window.confirmationModal?(await window.confirmationModal.open({title:"Löschvorgang bestätigen",message:t,confirmText:"Endgültig löschen",cancelText:"Abbrechen",danger:!0}))?.confirmed&&this.deleteSelectedMarken():confirm(`${t}

Dieser Vorgang kann nicht rückgängig gemacht werden.`)&&this.deleteSelectedMarken()}async deleteSelectedMarken(){const e=Array.from(this.selectedMarken),t=e.length;console.log(`🗑️ Lösche ${t} Marken...`),e.forEach(n=>{const a=document.querySelector(`tr[data-id="${n}"]`);a&&(a.style.opacity="0.5")});try{const n=await window.dataService.deleteEntities("marke",e);if(n.success){e.forEach(r=>{document.querySelector(`tr[data-id="${r}"]`)?.remove()}),alert(`✅ ${n.deletedCount} Marken erfolgreich gelöscht.`),this.selectedMarken.clear(),this.updateSelection(),this.updateSelectAllCheckbox();const a=document.querySelector(".data-table tbody");a&&a.children.length===0&&await this.loadAndRender(),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"marke",action:"bulk-deleted",count:n.deletedCount}}))}else throw new Error(n.error||"Löschen fehlgeschlagen")}catch(n){e.forEach(a=>{const r=document.querySelector(`tr[data-id="${a}"]`);r&&(r.style.opacity="1")}),console.error("❌ Fehler beim Löschen:",n),alert(`❌ Fehler beim Löschen: ${n.message}`),await this.loadAndRender()}}showCreateForm(){console.log("🎯 Zeige Marken-Erstellungsformular mit MarkeCreate"),Z.showCreateForm()}}const re=new at;class ie{static optimizeTableColumns(e,t={}){if(!e)return;const n=e.querySelectorAll("thead th"),a=e.querySelectorAll("tbody tr");n.forEach((r,i)=>{const s=r.textContent.trim().toLowerCase();let o=this.getColumnClass(s,t[i]);o&&(r.classList.add(o),a.forEach(l=>{const u=l.children[i];u&&u.classList.add(o)}))})}static getColumnClass(e,t={}){return t&&t.cssClass?t.cssClass:e===""||e==="auswahl"||e==="select"?"checkbox-col":e.includes("id")||e.includes("nr")||e.includes("nummer")||e==="#"?"id-col":e.includes("name")||e.includes("titel")||e.includes("kampagne")||e.includes("auftrag")?"name-col":e.includes("unternehmen")||e.includes("marke")||e.includes("firma")||e.includes("brand")?"company-col":e.includes("status")||e.includes("zustand")||e.includes("phase")?"status-col":e.includes("datum")||e.includes("date")||e.includes("deadline")||e.includes("start")||e.includes("ende")||e.includes("erstellt")||e.includes("geändert")?"date-col":e.includes("anzahl")||e.includes("budget")||e.includes("betrag")||e.includes("kosten")||e.includes("preis")||e.includes("videos")||e.includes("creator")||e.includes("euro")||e.includes("€")?"number-col":e.includes("mail")||e.includes("email")||e.includes("website")||e.includes("url")||e.includes("link")||e.includes("telefon")||e.includes("instagram")||e.includes("tiktok")?"contact-col":e.includes("ansprechpartner")||e.includes("mitarbeiter")||e.includes("zuständig")||e.includes("kontakt")||e.includes("branchen")||e.includes("tags")?"list-col":e.includes("beschreibung")||e.includes("kommentar")||e.includes("notiz")||e.includes("text")||e.includes("inhalt")||e.includes("details")?"text-col":null}static autoOptimizeTable(e,t={}){const n=document.querySelector(e);if(!n){console.warn(`TableHelper: Tabelle mit Selektor "${e}" nicht gefunden`);return}this.optimizeTableColumns(n,t.columnConfig||{});const a=n.closest(".data-table-container");a&&(a.style.overflow="visible",a.style.boxShadow="none"),n.style.width="100%",n.style.tableLayout="auto",console.log(`✅ TableHelper: Tabelle "${e}" optimiert`)}static formatContactList(e,t){if(!t||t.length===0){e.textContent="-";return}const n=document.createElement("div");n.className="contact-list",t.forEach(a=>{const r=document.createElement("div");if(r.className="contact-item",a.link){const i=document.createElement("a");i.href=a.link,i.textContent=a.name,i.onclick=s=>{s.preventDefault(),window.navigateTo&&window.navigateTo(a.link)},r.appendChild(i)}else r.textContent=a.name||a;n.appendChild(r)}),e.innerHTML="",e.appendChild(n)}}typeof window<"u"&&(window.TableHelper=ie);class R{static render(e,t,n){if(!n||n.trim()==="")return'<span class="phone-display-empty">-</span>';const a=(e||"").toLowerCase(),r=t||"";return`
      <span class="phone-display">
        ${a?`<span class="fi fi-${a}" title="${r}"></span>`:""}
        <span class="phone-number">${r} ${n}</span>
      </span>
    `}static renderDetailed(e,t,n,a){if(!a||a.trim()==="")return'<span class="phone-display-empty">-</span>';const r=(e||"").toLowerCase(),i=t||"",s=n||"";return`
      <div class="phone-display-detailed">
        <div class="phone-country">
          ${r?`<span class="fi fi-${r}"></span>`:""}
          <span class="country-name">${s}</span>
        </div>
        <div class="phone-number-full">
          <span class="dial-code">${i}</span>
          <span class="phone-number">${a}</span>
        </div>
      </div>
    `}static renderClickable(e,t,n){if(!n||n.trim()==="")return'<span class="phone-display-empty">-</span>';const a=(e||"").toLowerCase(),r=t||"",i=n.replace(/\D/g,"");return`
      <a href="${`tel:${r.replace(/\D/g,"")}${i}`}" class="phone-display phone-display-clickable">
        ${a?`<span class="fi fi-${a}" title="${r}"></span>`:""}
        <span class="phone-number">${r} ${n}</span>
      </a>
    `}static extractPhoneData(e,t="telefonnummer"){if(!e)return null;const n=`${t}_land`,a=e[n];return{isoCode:a?.iso_code||null,vorwahl:a?.vorwahl||null,name:a?.name_de||a?.name||null,nummer:e[t]||null}}static renderBoth(e){if(!e)return'<span class="phone-display-empty">-</span>';const t=this.extractPhoneData(e,"telefonnummer"),n=this.extractPhoneData(e,"telefonnummer_office"),a=t?.nummer?this.renderClickable(t.isoCode,t.vorwahl,t.nummer):"",r=n?.nummer?this.renderClickable(n.isoCode,n.vorwahl,n.nummer):"";return!a&&!r?'<span class="phone-display-empty">-</span>':`
      <div class="phone-display-both">
        ${a?`<div class="phone-item"><span class="phone-label">Mobil:</span> ${a}</div>`:""}
        ${r?`<div class="phone-item"><span class="phone-label">Büro:</span> ${r}</div>`:""}
      </div>
    `}}class rt{constructor(){this.markeId=null,this.marke=null,this.notizen=[],this.ratings=[],this.kampagnen=[],this.auftraege=[],this.ansprechpartner=[],this.rechnungen=[]}async init(e){console.log("🎯 MARKENDETAIL: Initialisiere Marken-Detailseite für ID:",e);try{this.markeId=e,await this.loadMarkeData(),window.breadcrumbSystem&&this.marke&&window.breadcrumbSystem.updateBreadcrumb([{label:"Marke",url:"/marke",clickable:!0},{label:this.marke.markenname||"Details",url:`/marke/${this.markeId}`,clickable:!1}]),this.render(),this.bindEvents(),console.log("✅ MARKENDETAIL: Initialisierung abgeschlossen")}catch(t){console.error("❌ MARKENDETAIL: Fehler bei der Initialisierung:",t),window.ErrorHandler.handle(t,"MarkeDetail.init")}}async loadMarkeData(){console.log("🔄 MARKENDETAIL: Lade Marken-Daten...");try{const{data:e,error:t}=await window.supabase.from("marke").select(`
          *,
          unternehmen:unternehmen_id(firmenname),
          branche:branche_id(name)
        `).eq("id",this.markeId).single();if(t)throw t;this.marke=e,console.log("✅ MARKENDETAIL: Marken-Basisdaten geladen:",this.marke);try{const{data:l,error:u}=await window.supabase.from("marke_branchen").select(`
            branche_id,
            branche:branche_id(name)
          `).eq("marke_id",this.markeId);!u&&l&&l.length>0?(this.marke.branchen=l.map(d=>d.branche),console.log("✅ MARKENDETAIL: Branchen aus Junction Table geladen:",this.marke.branchen)):(this.marke.branchen=[],console.log("ℹ️ MARKENDETAIL: Keine Branchen in Junction Table gefunden"))}catch(l){console.warn("⚠️ MARKENDETAIL: Fehler beim Laden der Branchen:",l),this.marke.branchen=[]}window.notizenSystem&&(this.notizen=await window.notizenSystem.loadNotizen("marke",this.markeId),console.log("✅ MARKENDETAIL: Notizen geladen:",this.notizen.length)),window.bewertungsSystem&&(this.ratings=await window.bewertungsSystem.loadBewertungen("marke",this.markeId),console.log("✅ MARKENDETAIL: Ratings geladen:",this.ratings.length));const{data:n,error:a}=await window.supabase.from("kampagne").select("*").eq("marke_id",this.markeId);a||(this.kampagnen=n||[],console.log("✅ MARKENDETAIL: Kampagnen geladen:",this.kampagnen.length));const{data:r,error:i}=await window.supabase.from("auftrag").select("*").eq("marke_id",this.markeId);i||(this.auftraege=r||[],console.log("✅ MARKENDETAIL: Aufträge geladen:",this.auftraege.length));try{const l=(this.auftraege||[]).map(u=>u.id).filter(Boolean);if(l.length>0){const{data:u}=await window.supabase.from("rechnung").select("id, rechnung_nr, status, nettobetrag, bruttobetrag, gestellt_am, zahlungsziel, bezahlt_am, pdf_url, auftrag_id").in("auftrag_id",l);this.rechnungen=u||[]}else this.rechnungen=[]}catch{this.rechnungen=[]}const{data:s,error:o}=await window.supabase.from("ansprechpartner_marke").select(`
          ansprechpartner_id,
          ansprechpartner:ansprechpartner_id (
            *,
            position:position_id(name),
            unternehmen:unternehmen_id(firmenname),
            telefonnummer_land:eu_laender!telefonnummer_land_id (
              id,
              name,
              name_de,
              iso_code,
              vorwahl
            ),
            telefonnummer_office_land:eu_laender!telefonnummer_office_land_id (
              id,
              name,
              name_de,
              iso_code,
              vorwahl
            )
          )
        `).eq("marke_id",this.markeId);o||(this.ansprechpartner=s?.map(l=>l.ansprechpartner)||[],console.log("✅ MARKENDETAIL: Ansprechpartner geladen:",this.ansprechpartner.length))}catch(e){throw console.error("❌ MARKENDETAIL: Fehler beim Laden der Marken-Daten:",e),e}}render(){window.setHeadline(`${this.marke?.markenname||"Marke"} - Details`);const e=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>${this.marke?.markenname||"Marke"} - Details</h1>
          <p>Detaillierte Informationen zur Marke</p>
        </div>
        <div class="page-header-right">
          <button id="btn-edit-marke" class="secondary-btn">
            <i class="icon-edit"></i>
            Marke bearbeiten
          </button>
          <button onclick="window.navigateTo('/marke')" class="secondary-btn">
            Zurück zur Übersicht
          </button>
        </div>
      </div>

      <div class="content-section">
        <!-- Tab-Navigation -->
        <div class="tab-navigation">
          <button class="tab-button active" data-tab="informationen">
            Informationen
            <span class="tab-count">1</span>
          </button>
          <button class="tab-button" data-tab="notizen">
            Notizen
            <span class="tab-count">${this.notizen.length}</span>
          </button>
          <button class="tab-button" data-tab="bewertungen">
            Bewertungen
            <span class="tab-count">${this.ratings.length}</span>
          </button>
          <button class="tab-button" data-tab="kampagnen">
            Kampagnen
            <span class="tab-count">${this.kampagnen.length}</span>
          </button>
          <button class="tab-button" data-tab="auftraege">
            Aufträge
            <span class="tab-count">${this.auftraege.length}</span>
          </button>
          <button class="tab-button" data-tab="ansprechpartner">
            Ansprechpartner
            <span class="tab-count">${this.ansprechpartner.length}</span>
          </button>
          <button class="tab-button" data-tab="rechnungen">
            Rechnungen
            <span class="tab-count">${this.rechnungen.length}</span>
          </button>
        </div>

        <!-- Tab-Content -->
        <div class="tab-content">
          <!-- Informationen Tab -->
          <div class="tab-pane active" id="informationen">
            ${this.renderInformationen()}
          </div>

          <!-- Notizen Tab -->
          <div class="tab-pane" id="notizen">
            ${this.renderNotizen()}
          </div>

          <!-- Bewertungen Tab -->
          <div class="tab-pane" id="bewertungen">
            ${this.renderRatings()}
          </div>

          <!-- Kampagnen Tab -->
          <div class="tab-pane" id="kampagnen">
            ${this.renderKampagnen()}
          </div>

          <!-- Aufträge Tab -->
          <div class="tab-pane" id="auftraege">
            ${this.renderAuftraege()}
          </div>

          <!-- Ansprechpartner Tab -->
          <div class="tab-pane" id="ansprechpartner">
            ${this.renderAnsprechpartner()}
          </div>
          <div class="tab-pane" id="rechnungen">
            ${this.renderRechnungen()}
          </div>
        </div>
      </div>
    `;window.setContentSafely(window.content,e)}renderInformationen(){return`
      <div class="detail-section">
        <div class="detail-grid">
          <div class="detail-card">
            <h3>Marken-Informationen</h3>
            <div class="detail-item">
              <label>Markenname:</label>
              <span>${this.marke?.markenname||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Unternehmen:</label>
              <span>${this.marke?.unternehmen?.firmenname||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Webseite:</label>
              <span>
                ${this.marke?.webseite?`<a href="${this.marke.webseite}" target="_blank">${this.marke.webseite}</a>`:"-"}
              </span>
            </div>
            <div class="detail-item">
              <label>Branchen:</label>
              <span>${this.renderBranchen()}</span>
            </div>
            <div class="detail-item">
              <label>Erstellt am:</label>
              <span>${this.marke?.created_at?new Date(this.marke.created_at).toLocaleDateString("de-DE"):"-"}</span>
            </div>
            <div class="detail-item">
              <label>Zuletzt aktualisiert:</label>
              <span>${this.marke?.updated_at?new Date(this.marke.updated_at).toLocaleDateString("de-DE"):"-"}</span>
            </div>
          </div>
        </div>
      </div>
    `}renderBranchen(){return!this.marke?.branchen||this.marke.branchen.length===0?"-":`<div class="tags">${this.marke.branchen.filter(t=>t&&t.name).map(t=>`<span class="tag tag--branche">${t.name}</span>`).join("")}</div>`}renderNotizen(){return window.notizenSystem?window.notizenSystem.renderNotizenContainer(this.notizen,"marke",this.markeId):"<p>Notizen-System nicht verfügbar</p>"}renderRatings(){return window.bewertungsSystem?window.bewertungsSystem.renderBewertungenContainer(this.ratings,"marke",this.markeId):"<p>Bewertungs-System nicht verfügbar</p>"}renderKampagnen(){return!this.kampagnen||this.kampagnen.length===0?`
        <div class="empty-state">
          <div class="empty-icon">📢</div>
          <h3>Keine Kampagnen vorhanden</h3>
          <p>Es wurden noch keine Kampagnen für diese Marke erstellt.</p>
        </div>
      `:`
      <div class="kampagnen-container">
        ${this.kampagnen.map(t=>`
      <div class="kampagne-card">
        <div class="kampagne-header">
          <h4>${t.kampagnenname||"Unbekannte Kampagne"}</h4>
          <span class="kampagne-status status-${t.status?.toLowerCase()||"unknown"}">
            ${t.status||"Unbekannt"}
          </span>
        </div>
        <div class="kampagne-details">
          <p><strong>Beschreibung:</strong> ${t.beschreibung||"-"}</p>
          <p><strong>Budget:</strong> ${t.budget?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(t.budget):"-"}</p>
          <p><strong>Start:</strong> ${t.start?new Date(t.start).toLocaleDateString("de-DE"):"-"}</p>
          <p><strong>Ende:</strong> ${t.ende?new Date(t.ende).toLocaleDateString("de-DE"):"-"}</p>
        </div>
      </div>
    `).join("")}
      </div>
    `}renderAuftraege(){return!this.auftraege||this.auftraege.length===0?`
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <h3>Keine Aufträge vorhanden</h3>
          <p>Es wurden noch keine Aufträge für diese Marke erstellt.</p>
        </div>
      `:`
      <div class="auftraege-container">
        ${this.auftraege.map(t=>`
      <div class="auftrag-card">
        <div class="auftrag-header">
          <h4>${t.auftragsname||"Unbekannter Auftrag"}</h4>
          <span class="auftrag-status status-${t.status?.toLowerCase()||"unknown"}">
            ${t.status||"Unbekannt"}
          </span>
        </div>
        <div class="auftrag-details">
          <p><strong>Typ:</strong> ${t.auftragtype||"-"}</p>
          <p><strong>Budget:</strong> ${t.gesamt_budget?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(t.gesamt_budget):"-"}</p>
          <p><strong>Start:</strong> ${t.start?new Date(t.start).toLocaleDateString("de-DE"):"-"}</p>
          <p><strong>Ende:</strong> ${t.ende?new Date(t.ende).toLocaleDateString("de-DE"):"-"}</p>
        </div>
      </div>
    `).join("")}
      </div>
    `}renderAnsprechpartner(){const e=this.ansprechpartner&&this.ansprechpartner.length>0,t=e?"":`
      <div class="empty-state">
        <div class="empty-icon">👥</div>
        <h3>Keine Ansprechpartner vorhanden</h3>
        <p>Es wurden noch keine Ansprechpartner für diese Marke zugeordnet.</p>
      </div>
    `,n=`
      <div class="section-header">
        <h3>Ansprechpartner</h3>
      </div>
    `;if(!e)return n+t;const a=this.ansprechpartner.map(r=>`
      <tr>
        <td>
          <a href="#" class="table-link" data-table="ansprechpartner" data-id="${r.id}">
            ${r.vorname} ${r.nachname}
          </a>
        </td>
        <td>${r.position?.name||"-"}</td>
        <td>${r.email?`<a href="mailto:${r.email}">${r.email}</a>`:"-"}</td>
        <td>${R.render(r.telefonnummer_land?.iso_code,r.telefonnummer_land?.vorwahl,r.telefonnummer)}</td>
        <td>${R.render(r.telefonnummer_office_land?.iso_code,r.telefonnummer_office_land?.vorwahl,r.telefonnummer_office)}</td>
        <td>${r.unternehmen?.firmenname||"-"}</td>
        <td>${r.stadt||"-"}</td>
      </tr>
    `).join("");return`
      ${n}
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Position</th>
              <th>Email</th>
              <th>Telefon (Privat)</th>
              <th>Telefon (Büro)</th>
              <th>Unternehmen</th>
              <th>Stadt</th>
            </tr>
          </thead>
          <tbody>${a}</tbody>
        </table>
      </div>
    `}renderRechnungen(){if(!this.rechnungen||this.rechnungen.length===0)return`
        <div class="empty-state">
          <div class="empty-icon">💶</div>
          <h3>Keine Rechnungen vorhanden</h3>
        </div>
      `;const e=r=>r?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(r):"-",t=r=>r?new Date(r).toLocaleDateString("de-DE"):"-",a=`
      <div class="data-table-container">
        <table class="data-table" id="marke-rechnungen-table">
          <thead>
            <tr>
              <th>Rechnungs-Nr</th>
              <th>Status</th>
              <th>Netto</th>
              <th>Brutto</th>
              <th>Gestellt</th>
              <th>Beleg</th>
            </tr>
          </thead>
          <tbody>${this.rechnungen.map(r=>`
      <tr>
        <td><a href="/rechnung/${r.id}" onclick="event.preventDefault(); window.navigateTo('/rechnung/${r.id}')">${window.validatorSystem.sanitizeHtml(r.rechnung_nr||"—")}</a></td>
        <td>${r.status||"-"}</td>
        <td>${e(r.nettobetrag)}</td>
        <td>${e(r.bruttobetrag)}</td>
        <td>${t(r.gestellt_am)}</td>
        <td>${r.pdf_url?`<a href="${r.pdf_url}" target="_blank" rel="noopener">PDF</a>`:"-"}</td>
      </tr>
    `).join("")}</tbody>
        </table>
      </div>
    `;return setTimeout(()=>{ie.autoOptimizeTable("#marke-rechnungen-table",{columnConfig:{0:{cssClass:"id-col"},1:{cssClass:"status-col"},2:{cssClass:"number-col"},3:{cssClass:"number-col"},4:{cssClass:"date-col"},5:{cssClass:"contact-col"}}})},100),a}bindEvents(){document.addEventListener("click",e=>{if(e.target.classList.contains("tab-button")){const t=e.target.dataset.tab;this.switchTab(t)}}),document.addEventListener("click",e=>{e.target.id==="btn-edit-marke"&&this.showEditForm()}),document.addEventListener("click",e=>{if(e.target.id==="btn-add-ansprechpartner"){const t=e.target.dataset.markeId||this.markeId;window.actionsDropdown&&window.actionsDropdown.openAddAnsprechpartnerModal(t)}}),document.addEventListener("notizenUpdated",()=>{this.loadMarkeData().then(()=>{this.render(),this.bindEvents()})}),document.addEventListener("bewertungenUpdated",()=>{this.loadMarkeData().then(()=>{this.render(),this.bindEvents()})}),document.addEventListener("entityUpdated",e=>{e.detail?.entity==="ansprechpartner"&&e.detail?.markeId===this.markeId&&(console.log("🔄 MARKEDETAIL: Ansprechpartner wurde aktualisiert, lade Daten neu"),this.loadMarkeData().then(()=>{this.render(),this.bindEvents()}))})}switchTab(e){document.querySelectorAll(".tab-button").forEach(a=>{a.classList.remove("active")}),document.querySelectorAll(".tab-pane").forEach(a=>{a.classList.remove("active")});const t=document.querySelector(`[data-tab="${e}"]`),n=document.getElementById(e);t&&t.classList.add("active"),n&&n.classList.add("active")}async showEditForm(){console.log("🎯 MARKENDETAIL: Zeige Bearbeitungsformular"),window.setHeadline("Marke bearbeiten");const e={...this.marke};e._isEditMode=!0,e._entityId=this.markeId,this.marke.unternehmen_id?(console.log("🏢 MARKENDETAIL: Formatiere Unternehmen-Daten für FormSystem:",this.marke.unternehmen_id),e.unternehmen_id=this.marke.unternehmen_id):(console.log("ℹ️ MARKENDETAIL: Keine Unternehmen-Daten vorhanden für Edit-Modus"),e.unternehmen_id=null);try{const{data:a,error:r}=await window.supabase.from("marke_branchen").select("branche_id").eq("marke_id",this.markeId);if(!r&&a&&a.length>0){const i=a.map(s=>s.branche_id);console.log("🏷️ MARKENDETAIL: Formatiere Branchen-Daten für FormSystem:",i),e.branche_ids=i}else console.log("ℹ️ MARKENDETAIL: Keine Branchen-Daten vorhanden für Edit-Modus"),e.branche_ids=[]}catch(a){console.warn("⚠️ MARKENDETAIL: Fehler beim Laden der Branchen-Daten:",a),e.branche_ids=[]}console.log("📋 MARKENDETAIL: FormData für Rendering:",e);const t=window.formSystem.renderFormOnly("marke",e);window.content.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Marke bearbeiten</h1>
          <p>Bearbeiten Sie die Marken-Informationen</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/marke/${this.markeId}')" class="secondary-btn">Abbrechen</button>
        </div>
      </div>
      
      <div class="form-page">
        ${t}
      </div>
    `,window.formSystem.bindFormEvents("marke",e);const n=document.getElementById("marke-form");n&&(n.dataset.isEditMode="true",n.dataset.entityType="marke",n.dataset.entityId=this.markeId,e.unternehmen_id&&(n.dataset.existingUnternehmenId=e.unternehmen_id),e.branche_id&&Array.isArray(e.branche_id)&&e.branche_id.length>0&&(n.dataset.existingBranchenIds=JSON.stringify(e.branche_id)),console.log("📋 MARKENDETAIL: Form-Datasets gesetzt:",{isEditMode:n.dataset.isEditMode,entityType:n.dataset.entityType,entityId:n.dataset.entityId,existingUnternehmenId:n.dataset.existingUnternehmenId,existingBrancheId:n.dataset.existingBrancheId}),n.onsubmit=async a=>{a.preventDefault(),await this.handleEditFormSubmit()})}async handleEditFormSubmit(){try{console.log("🎯 MARKEDETAIL: Verarbeite Formular-Submit");const e=document.getElementById("marke-form"),t=new FormData(e),n={};for(const[s,o]of t.entries())n[s]=o;const a=e.querySelector('select[name="branche_id[]"]');if(a){const s=Array.from(a.selectedOptions).map(o=>o.value).filter(o=>o!=="");s.length>0&&(n["branche_id[]"]=s,console.log("🏷️ MARKEDETAIL: Alle ausgewählten Branchen gesammelt:",s))}console.log("📤 MARKEDETAIL: Submit-Daten für Update:",n);const r=window.validatorSystem.validateForm(n,{markenname:{type:"text",minLength:2,required:!0}});if(!r.isValid){this.showValidationErrors(r.errors);return}const i=await window.dataService.updateEntity("marke",this.markeId,n);if(i.success)this.showSuccessMessage("Marke erfolgreich aktualisiert!"),setTimeout(async()=>{await this.loadMarkeData(),this.render(),this.bindEvents()},1500);else throw new Error(i.error||"Unbekannter Fehler")}catch(e){console.error("❌ Formular-Submit Fehler:",e),this.showErrorMessage(e.message)}}showValidationErrors(e){console.log("❌ Validierungsfehler:",e),document.querySelectorAll(".validation-error").forEach(t=>t.remove()),Object.keys(e).forEach(t=>{const n=document.querySelector(`[name="${t}"]`);if(n){const a=document.createElement("div");a.className="validation-error",a.textContent=e[t],a.style.color="#dc3545",a.style.fontSize="0.875rem",a.style.marginTop="0.25rem",n.parentNode.appendChild(a),n.style.borderColor="#dc3545"}})}showSuccessMessage(e){const t=document.createElement("div");t.className="alert alert-success",t.textContent=e,t.style.cssText=`
      background: #d4edda;
      color: #155724;
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      border: 1px solid #c3e6cb;
    `;const n=document.querySelector(".form-page");n&&n.insertBefore(t,n.firstChild)}showErrorMessage(e){const t=document.createElement("div");t.className="alert alert-danger",t.textContent=e,t.style.cssText=`
      background: #f8d7da;
      color: #721c24;
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      border: 1px solid #f5c6cb;
    `;const n=document.querySelector(".form-page");n&&n.insertBefore(t,n.firstChild)}destroy(){console.log("MarkeDetail: Cleaning up...")}}const se=new rt;class it{constructor(){this.currentRoute="/",this.navSections=[{title:"Dashboard",items:[{id:"dashboard",label:"Dashboard",icon:"icon-dashboard",url:"/dashboard"}]},{title:"Unternehmen",items:[{id:"unternehmen",label:"Unternehmen",icon:"icon-building",url:"/unternehmen"},{id:"marke",label:"Marken",icon:"icon-tag",url:"/marke"},{id:"ansprechpartner",label:"Ansprechpartner",icon:"icon-user-circle",url:"/ansprechpartner"},{id:"auftrag",label:"Aufträge",icon:"icon-briefcase",url:"/auftrag"},{id:"auftragsdetails",label:"Auftragsdetails",icon:"icon-auftragsdetails",url:"/auftragsdetails"}]},{title:"Projektmanagement",items:[{id:"kampagne",label:"Kampagne",icon:"icon-campaign",url:"/kampagne"},{id:"briefing",label:"Briefing",icon:"icon-document",url:"/briefing"},{id:"kooperation",label:"Kooperation",icon:"icon-handshake",url:"/kooperation"},{id:"rechnung",label:"Rechnung",icon:"icon-currency-euro",url:"/rechnung"}]},{title:"Creator Management",items:[{id:"creator",label:"Creator",icon:"icon-users",url:"/creator"},{id:"creator-lists",label:"Listen",icon:"icon-list",url:"/creator-lists"}]},{title:"Admin",items:[{id:"mitarbeiter",label:"Mitarbeiter",icon:"icon-users",url:"/mitarbeiter"},{id:"kunden-admin",label:"Kunden",icon:"icon-user-circle",url:"/admin/kunden"}]}]}renderNavigation(){const e=document.getElementById("main-nav");if(!e){console.error("Navigation-Element nicht gefunden");return}const t=window.currentUser?.permissions||{},n=i=>{if(i==="dashboard")return!0;if(window.canViewPage&&typeof window.canViewPage=="function"){const l=window.canViewPage(i);if(l===!1)return!1;if(l===!0)return!0}const o={dashboard:"dashboard",unternehmen:"unternehmen",marke:"marke",auftrag:"auftrag",auftragsdetails:"auftrag",ansprechpartner:"ansprechpartner",kampagne:"kampagne",briefing:"briefing",kooperation:"kooperation",rechnung:"rechnung",creator:"creator","creator-lists":"creator",mitarbeiter:"dashboard"}[i]||i;return t?.[o]?.can_view||window.currentUser?.rolle==="admin"},r=`
      <div class="nav-sections">
        ${this.navSections.map(i=>{const s=i.items.filter(o=>n(o.id));return s.length===0?"":`
        <div class="nav-section">
          <h3 class="nav-section-title">${i.title}</h3>
          <ul class="nav-list">
            ${s.map(o=>`
              <li class="nav-item">
                <a href="${o.url}" class="nav-link" data-route="${o.url}">
                  <span class="nav-icon">${this.getIcon(o.icon)}</span>
                  <span class="nav-label">${o.label}</span>
                </a>
              </li>
            `).join("")}
          </ul>
        </div>`}).join("")}
      </div>
    `;e.innerHTML=r,this.bindNavigationEvents()}bindNavigationEvents(){document.querySelectorAll(".nav-link").forEach(t=>{t.addEventListener("click",n=>{n.preventDefault();const a=t.getAttribute("data-route");this.navigateTo(a)})})}navigateTo(e){console.log(`🧭 Navigation zu: ${e}`),this.currentRoute=e,this.updateActiveRoute(e),window.navigateTo?window.navigateTo(e):window.location.hash=e}updateActiveRoute(e){document.querySelectorAll(".nav-link").forEach(n=>{n.getAttribute("data-route")===e?n.classList.add("active"):n.classList.remove("active")})}getIcon(e){return{"icon-dashboard":'<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h7.5" /></svg>',"icon-users":'<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>',"icon-building":'<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" /></svg>',"icon-tag":'<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6z" /></svg>',"icon-briefcase":'<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>',"icon-auftragsdetails":'<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" /></svg>',"icon-user-circle":'<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" /></svg>',"icon-campaign":'<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 0 1-1.44-4.282m3.102.069a18.03 18.03 0 0 1-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 0 1 8.835 2.535M10.34 6.66a23.847 23.847 0 0 0 8.835-2.535m0 0A23.74 23.74 0 0 0 18.795 3m.38 1.125a23.91 23.91 0 0 1 1.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 0 0 1.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 0 1 0 3.46" /></svg>',"icon-document":'<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>',"icon-handshake":'<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" /></svg>',"icon-currency-euro":'<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 11.625h4.5m-4.5 2.25h4.5m2.121 1.527c-1.171 1.464-3.07 1.464-4.242 0-1.172-1.465-1.172-3.84 0-5.304 1.171-1.464 3.07-1.464 4.242 0M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>',"icon-list":'<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 17.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>'}[e]||'<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.482-.22-2.121-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>'}init(){console.log("🧭 NavigationSystem: Initialisiere Navigation"),this.renderNavigation()}destroy(){console.log("🗑️ NavigationSystem: Destroy aufgerufen")}}const oe=new it;class st{constructor(){this.entities={creator:{table:"creator",displayField:"vorname",fields:{vorname:"string",nachname:"string",instagram:"string",instagram_follower:"number",tiktok:"string",tiktok_follower:"number",telefonnummer:"string",mail:"string",portfolio_link:"string",budget_letzte_buchung:"number",lieferadresse_strasse:"string",lieferadresse_hausnummer:"string",lieferadresse_plz:"string",lieferadresse_stadt:"string",lieferadresse_land:"string",notiz:"string"},relations:{},manyToMany:{sprachen:{table:"sprachen",junctionTable:"creator_sprachen",localKey:"creator_id",foreignKey:"sprache_id",displayField:"name"},branchen:{table:"branchen_creator",junctionTable:"creator_branchen",localKey:"creator_id",foreignKey:"branche_id",displayField:"name"},creator_types:{table:"creator_type",junctionTable:"creator_creator_type",localKey:"creator_id",foreignKey:"creator_type_id",displayField:"name"}},filters:["vorname","nachname"],sortBy:"created_at",sortOrder:"desc"},ansprechpartner:{table:"ansprechpartner",displayField:"vorname",fields:{vorname:"string",nachname:"string",unternehmen_id:"uuid",position_id:"uuid",email:"string",telefonnummer:"string",telefonnummer_land_id:"uuid",telefonnummer_office:"string",telefonnummer_office_land_id:"uuid",linkedin:"string",stadt:"string",sprache_id:"uuid",notiz:"string"},relations:{unternehmen:{table:"unternehmen",foreignKey:"unternehmen_id",displayField:"firmenname"},sprache:{table:"sprachen",foreignKey:"sprache_id",displayField:"name"},position:{table:"positionen",foreignKey:"position_id",displayField:"name"},telefonnummer_land:{table:"eu_laender",foreignKey:"telefonnummer_land_id",displayField:"name_de"},telefonnummer_office_land:{table:"eu_laender",foreignKey:"telefonnummer_office_land_id",displayField:"name_de"}},manyToMany:{unternehmen:{table:"unternehmen",junctionTable:"ansprechpartner_unternehmen",localKey:"ansprechpartner_id",foreignKey:"unternehmen_id",displayField:"firmenname"},marken:{table:"marke",junctionTable:"ansprechpartner_marke",localKey:"ansprechpartner_id",foreignKey:"marke_id",displayField:"markenname"},sprachen:{table:"sprachen",junctionTable:"ansprechpartner_sprache",localKey:"ansprechpartner_id",foreignKey:"sprache_id",displayField:"name"}},filters:["vorname","nachname","position_id","unternehmen_id","stadt","sprache_id"],sortBy:"created_at",sortOrder:"desc"},unternehmen:{table:"unternehmen",displayField:"firmenname",fields:[{name:"firmenname",type:"string"},{name:"branche",type:"string"},{name:"branche_id",type:"uuid",relationTable:"unternehmen_branchen",relationField:"branche_id"},{name:"ansprechpartner",type:"string"},{name:"telefonnummer",type:"string"},{name:"invoice_email",type:"string"},{name:"rechnungsadresse_strasse",type:"string"},{name:"rechnungsadresse_hausnummer",type:"string"},{name:"rechnungsadresse_plz",type:"string"},{name:"rechnungsadresse_stadt",type:"string"},{name:"rechnungsadresse_land",type:"string"},{name:"webseite",type:"string"},{name:"status",type:"string"},{name:"notiz",type:"string"}],relations:{branche:{table:"branchen",foreignKey:"branche_id",displayField:"name"}},manyToMany:{branchen:{table:"branchen",junctionTable:"unternehmen_branchen",localKey:"unternehmen_id",foreignKey:"branche_id",displayField:"name"},ansprechpartner:{table:"ansprechpartner",junctionTable:"ansprechpartner_unternehmen",localKey:"unternehmen_id",foreignKey:"ansprechpartner_id",displayField:"vorname"}},filters:["firmenname","branche_id","status","rechnungsadresse_stadt","rechnungsadresse_land"],sortBy:"created_at",sortOrder:"desc"},kampagne:{table:"kampagne",displayField:"kampagnenname",fields:{kampagnenname:"string",unternehmen_id:"uuid",marke_id:"uuid",auftrag_id:"uuid",ziele:"string",art_der_kampagne:"array",kampagne_typ:"string",start:"date",deadline:"date",kampagnen_nummer:"number",drehort_typ_id:"uuid",drehort_beschreibung:"string",status_id:"uuid",creatoranzahl:"number",videoanzahl:"number",budget_info:"string"},relations:{unternehmen:{table:"unternehmen",foreignKey:"unternehmen_id",displayField:"firmenname"},marke:{table:"marke",foreignKey:"marke_id",displayField:"markenname"},auftrag:{table:"auftrag",foreignKey:"auftrag_id",displayField:"auftragsname"},drehort_typ:{table:"drehort_typen",foreignKey:"drehort_typ_id",displayField:"name"},status:{table:"kampagne_status",foreignKey:"status_id",displayField:"name"}},manyToMany:{ansprechpartner:{table:"ansprechpartner",junctionTable:"ansprechpartner_kampagne",localKey:"kampagne_id",foreignKey:"ansprechpartner_id",displayField:"id,vorname,nachname,email"},mitarbeiter:{table:"benutzer",junctionTable:"kampagne_mitarbeiter",localKey:"kampagne_id",foreignKey:"mitarbeiter_id",displayField:"name"}},filters:["kampagnenname","unternehmen_id","marke_id","status_id","art_der_kampagne","start","deadline"],sortBy:"created_at",sortOrder:"desc"},kooperation:{table:"kooperationen",displayField:"id",fields:{name:"string",creator_id:"uuid",kampagne_id:"uuid",briefing_id:"uuid",unternehmen_id:"uuid",status:"string",status_id:"uuid",content_art:"string",skript_autor:"string",nettobetrag:"number",zusatzkosten:"number",gesamtkosten:"number",vertrag_unterschrieben:"boolean",vertrag_link:"string",videoanzahl:"number",skript_deadline:"date",skript_link:"string",content_deadline:"date",content_link:"string",bewertung:"number",budget:"number",start_datum:"date",end_datum:"date",notiz:"string"},relations:{creator:{table:"creator",foreignKey:"creator_id",displayField:"vorname"},kampagne:{table:"kampagne",foreignKey:"kampagne_id",displayField:"name"},briefing:{table:"briefings",foreignKey:"briefing_id",displayField:"product_service_offer"}},filters:["creator_id","kampagne_id","status","budget","start_datum","end_datum"],sortBy:"created_at",sortOrder:"desc"},briefing:{table:"briefings",displayField:"product_service_offer",fields:{product_service_offer:"string",produktseite_url:"string",creator_aufgabe:"string",usp:"string",zielgruppe:"string",zieldetails:"string",deadline:"date",dos:"string",donts:"string",rechtlicher_hinweis:"string",unternehmen_id:"uuid",marke_id:"uuid",kampagne_id:"uuid",status:"string",assignee_id:"uuid",kooperation_id:"uuid",created_at:"date",updated_at:"date"},relations:{unternehmen:{table:"unternehmen",foreignKey:"unternehmen_id",displayField:"firmenname"},marke:{table:"marke",foreignKey:"marke_id",displayField:"markenname"},kampagne:{table:"kampagne",foreignKey:"kampagne_id",displayField:"kampagnenname"},assignee:{table:"benutzer",foreignKey:"assignee_id",displayField:"name"}},filters:["product_service_offer","unternehmen_id","marke_id","status","assignee_id","deadline","created_at"],sortBy:"created_at",sortOrder:"desc"},creator_type:{table:"creator_type",displayField:"name",fields:{name:"string",beschreibung:"string"},filters:["name"],sortBy:"name",sortOrder:"asc"},sprachen:{table:"sprachen",displayField:"name",fields:{name:"string",code:"string"},filters:["name"],sortBy:"name",sortOrder:"asc"},branchen_creator:{table:"branchen_creator",displayField:"name",fields:{name:"string",beschreibung:"string"},filters:["name"],sortBy:"name",sortOrder:"asc"},benutzer:{table:"benutzer",displayField:"name",fields:{name:"string",email:"string",rolle:"string",unterrolle:"string",zugriffsrechte:"json",auth_user_id:"uuid",profile_image_url:"string",mitarbeiter_klasse_id:"uuid",freigeschaltet:"boolean",updated_at:"date"},relations:{mitarbeiter_klasse:{table:"mitarbeiter_klasse",foreignKey:"mitarbeiter_klasse_id",displayField:"name"}}},kunden:{table:"benutzer",displayField:"name",fields:{name:"string",email:"string",rolle:"string",unterrolle:"string",freigeschaltet:"boolean",created_at:"date",updated_at:"date"},relations:{},manyToMany:{unternehmen:{table:"unternehmen",junctionTable:"kunde_unternehmen",localKey:"kunde_id",foreignKey:"unternehmen_id",displayField:"firmenname"},marken:{table:"marke",junctionTable:"kunde_marke",localKey:"kunde_id",foreignKey:"marke_id",displayField:"markenname"}},filters:["name","email","rolle","unterrolle"],sortBy:"created_at",sortOrder:"desc"},kampagne_status:{table:"kampagne_status",displayField:"name",fields:{name:"string",beschreibung:"string",sort_order:"number",created_at:"date",updated_at:"date"}},plattform_typen:{table:"plattform_typen",displayField:"name",fields:{name:"string",beschreibung:"string",created_at:"date",updated_at:"date"}},format_typen:{table:"format_typen",displayField:"name",fields:{name:"string",beschreibung:"string",created_at:"date",updated_at:"date"}},marke:{table:"marke",displayField:"markenname",fields:{markenname:"string",unternehmen_id:"uuid",webseite:"string",branche:"string",branche_id:"uuid",created_at:"date",updated_at:"date"},relations:{unternehmen:{table:"unternehmen",foreignKey:"unternehmen_id",displayField:"firmenname"}},manyToMany:{branchen:{table:"branchen",junctionTable:"marke_branchen",localKey:"marke_id",foreignKey:"branche_id",displayField:"name"},ansprechpartner:{table:"ansprechpartner",junctionTable:"ansprechpartner_marke",localKey:"marke_id",foreignKey:"ansprechpartner_id",displayField:"id,vorname,nachname,email"},mitarbeiter:{table:"benutzer",junctionTable:"marke_mitarbeiter",localKey:"marke_id",foreignKey:"mitarbeiter_id",displayField:"name",additionalFields:"created_at,assigned_by"}},filters:["markenname","unternehmen_id","branche_id"],sortBy:"created_at",sortOrder:"desc"},auftrag:{table:"auftrag",displayField:"auftragsname",fields:{auftragsname:"string",unternehmen_id:"uuid",marke_id:"uuid",status:"string",ansprechpartner_id:"uuid",po:"string",re_nr:"string",re_faelligkeit:"date",kampagnenanzahl:"number",start:"date",ende:"date",nettobetrag:"number",ust_prozent:"number",ust_betrag:"number",bruttobetrag:"number",rechnung_gestellt:"boolean",ueberwiesen:"boolean"},relations:{unternehmen:{table:"unternehmen",foreignKey:"unternehmen_id",displayField:"firmenname"},marke:{table:"marke",foreignKey:"marke_id",displayField:"markenname"},ansprechpartner:{table:"ansprechpartner",foreignKey:"ansprechpartner_id",displayField:"vorname"}},manyToMany:{mitarbeiter:{table:"benutzer",junctionTable:"auftrag_mitarbeiter",localKey:"auftrag_id",foreignKey:"mitarbeiter_id",displayField:"name"},cutter:{table:"benutzer",junctionTable:"auftrag_cutter",localKey:"auftrag_id",foreignKey:"mitarbeiter_id",displayField:"name"},copywriter:{table:"benutzer",junctionTable:"auftrag_copywriter",localKey:"auftrag_id",foreignKey:"mitarbeiter_id",displayField:"name"}},filters:["auftragsname","status","unternehmen_id","marke_id","ansprechpartner_id"],sortBy:"created_at",sortOrder:"desc"},auftrag_details:{table:"auftrag_details",displayField:"id",fields:{auftrag_id:"uuid",kampagnenanzahl:"number",ugc_video_anzahl:"number",ugc_creator_anzahl:"number",ugc_budget_info:"text",influencer_video_anzahl:"number",influencer_creator_anzahl:"number",influencer_budget_info:"text",vor_ort_video_anzahl:"number",vor_ort_creator_anzahl:"number",vor_ort_videographen_anzahl:"number",vor_ort_budget_info:"text",vor_ort_mitarbeiter_video_anzahl:"number",vor_ort_mitarbeiter_videographen_anzahl:"number",vor_ort_mitarbeiter_budget_info:"text",gesamt_videos:"number",gesamt_creator:"number"},relations:{auftrag:{table:"auftrag",foreignKey:"auftrag_id",displayField:"auftragsname"}},filters:["auftrag_id","kampagnenanzahl","gesamt_videos","gesamt_creator","created_at"],sortBy:"created_at",sortOrder:"desc"},rechnung:{table:"rechnung",displayField:"rechnung_nr",fields:{rechnung_nr:"string",kooperation_id:"uuid",kampagne_id:"uuid",creator_id:"uuid",auftrag_id:"uuid",unternehmen_id:"uuid",videoanzahl:"number",nettobetrag:"number",zusatzkosten:"number",bruttobetrag:"number",gestellt_am:"date",zahlungsziel:"date",bezahlt_am:"date",status:"string",geprueft:"boolean",pdf_url:"string",pdf_path:"string",created_at:"date",updated_at:"date"},relations:{unternehmen:{table:"unternehmen",foreignKey:"unternehmen_id",displayField:"firmenname"},auftrag:{table:"auftrag",foreignKey:"auftrag_id",displayField:"auftragsname"},kooperation:{table:"kooperationen",foreignKey:"kooperation_id",displayField:"name"},creator:{table:"creator",foreignKey:"creator_id",displayField:"vorname"},kampagne:{table:"kampagne",foreignKey:"kampagne_id",displayField:"kampagnenname"}},filters:["rechnung_nr","kooperation_id","kampagne_id","unternehmen_id","auftrag_id","status","gestellt_am","zahlungsziel","bezahlt_am","nettobetrag"],sortBy:"created_at",sortOrder:"desc"},creator_list:{table:"creator_list",displayField:"name",fields:{name:"string",beschreibung:"string",created_by:"uuid",created_at:"date",updated_at:"date"},relations:{},filters:["name","created_at"],sortBy:"created_at",sortOrder:"desc"}}}async createEntity(e,t){try{if(console.log(`✅ ${e} erstellt:`,t),!window.supabase||!window.supabase.auth){console.warn("⚠️ Supabase nicht verfügbar - verwende Mock-Daten");const s={id:Date.now().toString(),...t,created_at:new Date().toISOString()},o=JSON.parse(localStorage.getItem("mock_data")||"{}");return o[e]||(o[e]=[]),o[e].push(s),localStorage.setItem("mock_data",JSON.stringify(o)),console.log(`✅ ${e} Mock-Daten gespeichert:`,s),{success:!0,id:s.id,data:s}}const n=this.entities[e];if(!n)throw new Error(`Unbekannte Entität: ${e}`);if(e==="kooperation"&&(!t.content_art||t.content_art===""))try{const s=Object.entries(t).filter(([o,l])=>o.startsWith("video_content_art_")&&l).map(([,o])=>o)[0];s?t.content_art=s:t.content_art="N/A"}catch{t.content_art="N/A"}const a=await this.prepareDataForSupabase(t,n.fields,e),{data:r,error:i}=await window.supabase.from(n.table).insert([a]).select().single();return i?(console.error(`❌ Supabase Fehler beim Erstellen von ${e}:`,i),{success:!1,error:i.message}):(console.log(`✅ ${e} erfolgreich in Supabase erstellt:`,r),await this.handleManyToManyRelations(e,r.id,t),{success:!0,id:r.id,data:r})}catch(n){return console.error(`❌ Fehler beim Erstellen von ${e}:`,n),{success:!1,error:n.message}}}async updateEntity(e,t,n){try{if(console.log(`✅ ${e} aktualisiert:`,t,n),!window.supabase)return console.warn("⚠️ Supabase nicht verfügbar - verwende Mock-Daten"),{success:!0,id:t,data:n};const a=this.entities[e];if(!a)throw new Error(`Unbekannte Entität: ${e}`);const r=await this.prepareDataForSupabase(n,a.fields,e),{data:i,error:s}=await window.supabase.from(a.table).update(r).eq("id",t).select().single();return s?(console.error(`❌ Supabase Fehler beim Aktualisieren von ${e}:`,s),{success:!1,error:s.message}):(console.log(`✅ ${e} erfolgreich in Supabase aktualisiert:`,i),await this.handleManyToManyRelations(e,t,n),{success:!0,id:t,data:i})}catch(a){return console.error(`❌ Fehler beim Aktualisieren von ${e}:`,a),{success:!1,error:a.message}}}async deleteEntity(e,t){try{if(console.log(`🗑️ Lösche ${e}:`,t),!window.supabase)return console.warn("⚠️ Supabase nicht verfügbar - verwende Mock-Daten"),{success:!0,id:t};const n=this.entities[e];if(!n)throw new Error(`Unbekannte Entität: ${e}`);const{error:a}=await window.supabase.from(n.table).delete().eq("id",t);return a?(console.error(`❌ Supabase Fehler beim Löschen von ${e}:`,a),{success:!1,error:a.message}):(console.log(`✅ ${e} erfolgreich gelöscht:`,t),{success:!0,id:t})}catch(n){return console.error(`❌ Fehler beim Löschen von ${e}:`,n),{success:!1,error:n.message}}}async deleteEntities(e,t){try{if(!t||t.length===0)return{success:!0,deletedCount:0};if(console.log(`🗑️ Batch-Lösche ${t.length} ${e}...`),!window.supabase)return console.warn("⚠️ Supabase nicht verfügbar - verwende Mock-Daten"),{success:!0,deletedCount:t.length};const n=this.entities[e];if(!n)throw new Error(`Unbekannte Entität: ${e}`);const{error:a,count:r}=await window.supabase.from(n.table).delete({count:"exact"}).in("id",t);return a?(console.error(`❌ Batch-Delete Fehler für ${e}:`,a),{success:!1,error:a.message}):(console.log(`✅ ${r||t.length} ${e} erfolgreich gelöscht`),{success:!0,deletedCount:r||t.length})}catch(n){return console.error(`❌ Fehler beim Batch-Delete von ${e}:`,n),{success:!1,error:n.message}}}async loadEntities(e,t={}){try{if(!window.supabase||!window.supabase.auth){console.warn("⚠️ Supabase nicht verfügbar - verwende Mock-Daten");const s=JSON.parse(localStorage.getItem("mock_data")||"{}");return s[e]&&s[e].length>0?(console.log(`✅ Mock-Daten für ${e} geladen:`,s[e]),s[e]):this.getMockData(e)}const n=this.entities[e];if(!n)throw new Error(`Unbekannte Entität: ${e}`);let a;if(e==="marke")a=window.supabase.from(n.table).select(`
                  *,
                  unternehmen:unternehmen_id (
                    id,
                    firmenname
                  )
                `).order("created_at",{ascending:!1});else if(e==="creator"){a=window.supabase.from(n.table).select("*").order("created_at",{ascending:!1});try{let s=[];const o=l=>l==null?null:typeof l=="string"?l:typeof l=="object"?l.value||l.id||null:String(l);if(t&&t.sprache_id){const l=o(t.sprache_id),{data:u,error:d}=await window.supabase.from("creator_sprachen").select("creator_id").eq("sprache_id",l);d||s.push(new Set((u||[]).map(c=>c.creator_id))),delete t.sprache_id}if(t&&(t.branche_id||t.branche)){const l=o(t.branche_id||t.branche),{data:u,error:d}=await window.supabase.from("creator_branchen").select("creator_id").eq("branche_id",l);d||s.push(new Set((u||[]).map(c=>c.creator_id))),delete t.branche_id,delete t.branche}if(t&&t.creator_type_id){const l=o(t.creator_type_id),{data:u,error:d}=await window.supabase.from("creator_creator_type").select("creator_id").eq("creator_type_id",l);d||s.push(new Set((u||[]).map(c=>c.creator_id))),delete t.creator_type_id}if(s.length>0){let l=s[0];for(let d=1;d<s.length;d++)l=new Set([...l].filter(c=>s[d].has(c)));const u=[...l];if(u.length===0)return[];a=a.in("id",u)}}catch(s){console.warn("⚠️ Konnte Creator-Junction-Filter nicht anwenden:",s)}}else if(e==="ansprechpartner"){if(a=window.supabase.from(n.table).select(`
                  *,
                  unternehmen:unternehmen_id (
                    id,
                    firmenname
                  ),
                  sprache:sprache_id (
                    id,
                    name
                  ),
                  position:position_id (
                    id,
                    name
                  ),
                  telefonnummer_land:eu_laender!telefonnummer_land_id (
                    id,
                    name,
                    name_de,
                    iso_code,
                    vorwahl
                  ),
                  telefonnummer_office_land:eu_laender!telefonnummer_office_land_id (
                    id,
                    name,
                    name_de,
                    iso_code,
                    vorwahl
                  )
                `).order("created_at",{ascending:!1}),t&&t.sprache_id){const s=String(t.sprache_id),{data:o,error:l}=await window.supabase.from("ansprechpartner_sprache").select("ansprechpartner_id").eq("sprache_id",s);l&&console.error("❌ Fehler beim Laden der Sprach-Verknüpfungen:",l);const u=(o||[]).map(d=>d.ansprechpartner_id).filter(Boolean);if(u.length===0)return[];a=a.in("id",u),delete t.sprache_id}}else e==="rechnung"?a=window.supabase.from(n.table).select(`
                  *,
                  unternehmen:unternehmen_id (
                    id,
                    firmenname
                  ),
                  auftrag:auftrag_id (
                    id,
                    auftragsname
                  ),
                  creator:creator_id (
                    id,
                    vorname,
                    nachname
                  ),
                  kooperation:kooperation_id (
                    id,
                    name
                  )
                `).order("created_at",{ascending:!1}):e==="unternehmen"?a=window.supabase.from(n.table).select(`
                  *,
                  unternehmen_branchen (
                    branche_id,
                    branchen (
                      id,
                      name
                    )
                  )
                `).order("created_at",{ascending:!1}):a=window.supabase.from(n.table).select("*").order("created_at",{ascending:!1});a=await this.applyFilters(a,t,n.fields,e);const{data:r,error:i}=await a;return i?(console.error(`❌ Supabase Fehler beim Laden von ${e}:`,i),[]):(console.log(`✅ ${e} aus Supabase geladen:`,r?.length||0),e==="unternehmen"&&r&&r.forEach(s=>{s.unternehmen_branchen?(s.branchen=s.unternehmen_branchen.map(o=>o.branchen).filter(Boolean),delete s.unternehmen_branchen,console.log(`📋 Unternehmen ${s.firmenname}: ${s.branchen?.length||0} Branchen geladen`)):s.branchen=[]}),r&&n.manyToMany&&await this.loadManyToManyRelations(r,e,n.manyToMany),e==="creator"&&r&&r.forEach(s=>{s.sprachen=s.sprachen||[],s.branchen=s.branchen||[],s.creator_types=s.creator_types||[]}),r||[])}catch(n){return console.error(`❌ Fehler beim Laden von ${e}:`,n),[]}}async handleManyToManyRelations(e,t,n){try{const a=this.entities[e];if(!a||!a.manyToMany)return;for(const[r,i]of Object.entries(a.manyToMany)){let s;r==="sprachen"?s="sprachen_ids":r==="branchen"?s=e==="unternehmen"?"branche_id":"branche_ids":r==="creator_types"?s="creator_type_ids":r==="marken"?s="marke_ids":r==="unternehmen"?e==="ansprechpartner"?s="unternehmen_id":s="unternehmen_ids":s=`${r.slice(0,-1)}_ids`;const o=n[`${s}[]`],l=n[s],u=h=>{if(h==null)return[];if(Array.isArray(h))return h;if(typeof h=="string"){const p=h.trim();if(p.startsWith("[")&&p.endsWith("]"))try{const g=JSON.parse(p);if(Array.isArray(g))return g}catch{}return p.includes(",")?p.split(",").map(g=>g.trim()).filter(Boolean):p?[p]:[]}return[h]};let d=null;if(Array.isArray(l)?d=l:Array.isArray(o)?d=o:l!=null?d=l:d=o,console.log(`🔍 DATASERVICE: Prüfe ${s} für ${e}.${r}:`,{fieldData:d,"data[fieldName]":n[s],"data[fieldName + []]":n[`${s}[]`],allDataKeys:Object.keys(n)}),e==="ansprechpartner"&&r==="unternehmen"){console.log(`🔗 Spezielle Behandlung für ${e}.${r} (Legacy + Junction Table)`);let h=n.unternehmen_id;if(Array.isArray(h)&&(h=h[0],console.log(`📦 unternehmen_id war Array, extrahiere erstes Element: ${h}`)),h){console.log(`📝 Erstelle Junction Table Eintrag für Unternehmen ${h}`);const{error:p}=await window.supabase.from("ansprechpartner_unternehmen").delete().eq("ansprechpartner_id",t);p&&console.error("❌ Fehler beim Löschen bestehender Unternehmen-Verknüpfungen:",p);const{error:g}=await window.supabase.from("ansprechpartner_unternehmen").insert([{ansprechpartner_id:t,unternehmen_id:h}]);g?console.error("❌ Fehler beim Erstellen der Unternehmen-Verknüpfung:",g):console.log(`✅ Unternehmen-Verknüpfung erstellt für Ansprechpartner ${t} mit Unternehmen ${h}`)}continue}if(!d)continue;console.log(`🔗 Verarbeite Many-to-Many Beziehung: ${e}.${r} für ${s}:`,d);const c=Array.from(new Set(u(d).filter(Boolean))),{error:m}=await window.supabase.from(i.junctionTable).delete().eq(i.localKey,t);if(m){console.error(`❌ Fehler beim Löschen bestehender ${r} Beziehungen:`,m);continue}if(c.length>0&&c[0]){const h=c.filter(p=>p).map(p=>({[i.localKey]:t,[i.foreignKey]:p}));if(h.length>0){const{error:p}=await window.supabase.from(i.junctionTable).insert(h);p?console.error(`❌ Fehler beim Erstellen neuer ${r} Beziehungen:`,p):console.log(`✅ ${r} Beziehungen erstellt: ${h.length} Einträge`)}}}}catch(a){console.error("❌ Fehler beim Verarbeiten der Many-to-Many Beziehungen:",a)}}async loadManyToManyRelations(e,t,n){try{for(const[a,r]of Object.entries(n)){console.log(`🔗 Lade Many-to-Many Beziehung: ${t}.${a}`);const i=e.map(u=>u.id).filter(u=>u);if(i.length===0)continue;const{data:s,error:o}=await window.supabase.from(r.junctionTable).select(`
            ${r.localKey},
            ${r.foreignKey},
            ${r.table}!${r.foreignKey} (
              id,
              ${r.displayField}
            )
          `).in(r.localKey,i);if(o){console.error(`❌ Fehler beim Laden der Many-to-Many Beziehung ${a}:`,o);continue}const l={};s?.forEach(u=>{const d=u[r.localKey];l[d]||(l[d]=[]),u[r.table]&&l[d].push(u[r.table])}),e.forEach(u=>{u[a]=l[u.id]||[]}),console.log(`✅ Many-to-Many Beziehung ${a} geladen für ${e.length} Entitäten`)}}catch(a){console.error("❌ Fehler beim Laden der Many-to-Many Beziehungen:",a)}}async prepareDataForSupabase(e,t,n){const a={};if(n==="auftrag"&&e&&e.brutto_gesamt_budget&&!e.bruttobetrag&&(e.bruttobetrag=e.brutto_gesamt_budget),!t)return console.warn("⚠️ fieldConfig ist undefined - verwende Standard-Behandlung"),e;for(const[r,i]of Object.entries(e)){if(n==="kooperation"&&(r.startsWith("video_")||r.startsWith("adressname_")||r.startsWith("strasse_")||r.startsWith("hausnummer_")||r.startsWith("plz_")||r.startsWith("stadt_")||r.startsWith("land_")||r.startsWith("notiz_"))){console.log(`🔧 Überspringe dynamisches Feld für ${n}: ${r}`);continue}let s=i;if(typeof s=="string"&&s.startsWith("[")&&s.endsWith("]"))try{const l=JSON.parse(s);Array.isArray(l)&&(s=l)}catch{}if(r==="branche_id"&&n==="unternehmen"){console.log(`🏷️ Verarbeite ${r}:`,s);const l=this.entities[n]?.fields?.find(d=>d.name===r);if(l?.relationTable&&l?.relationField){console.log(`🔧 ${r} ist Relation-Field - wird von RelationTables verarbeitet`);continue}else if(s){a.branche_id=s,console.log(`✅ branche_id gesetzt: ${s}`);try{const{data:d,error:c}=await window.supabase.from("branchen").select("id, name").eq("id",s).single();!c&&d&&(a.branche=d.name,console.log(`✅ branche Namen gesetzt: ${a.branche}`))}catch(d){console.error("❌ Fehler beim Laden der Branche-Namen:",d)}}continue}if(r==="marke_ids"||r==="marke_ids[]"){console.log(`🏷️ Verarbeite ${r} für Ansprechpartner:`,s);continue}if(r==="sprachen_ids"||r==="sprachen_ids[]"){console.log(`🏷️ Verarbeite ${r} für Ansprechpartner:`,s);continue}if(n==="creator"&&(r==="sprachen_ids"||r==="sprachen_ids[]"||r==="branchen_ids"||r==="branchen_ids[]"||r==="creator_type_ids"||r==="creator_type_ids[]")){console.log(`🏷️ Verarbeite ${r} für Creator:`,s);continue}if(n==="marke"&&(r==="branche_ids"||r==="branche_ids[]")){console.log(`🏷️ Verarbeite ${r} für Marke:`,s);continue}if(n==="ansprechpartner"&&(r==="marke_ids"||r==="marke_ids[]"||r==="sprachen_ids"||r==="sprachen_ids[]")){console.log(`🏷️ Verarbeite ${r} für Ansprechpartner:`,s);continue}if(n==="ansprechpartner"&&r==="unternehmen_id"){Array.isArray(s)?(a.unternehmen_id=s[0],console.log(`📦 unternehmen_id war Array, extrahiere für Haupttabelle: ${a.unternehmen_id}`)):a.unternehmen_id=s;continue}if(n==="kampagne"&&(r==="ansprechpartner_ids"||r==="ansprechpartner_ids[]"||r==="mitarbeiter_ids"||r==="mitarbeiter_ids[]"||r==="pm_ids"||r==="pm_ids[]"||r==="scripter_ids"||r==="scripter_ids[]"||r==="cutter_ids"||r==="cutter_ids[]"||r==="plattform_ids"||r==="plattform_ids[]"||r==="format_ids"||r==="format_ids[]")){console.log(`🏷️ Verarbeite ${r} für Kampagne:`,s);continue}if(r==="pdf_file"||r.endsWith("_file")||r.endsWith("_ids")||r.endsWith("_ids[]")||r==="mitarbeiter_ids"||r==="kampagne_adressen"||r==="plattform_ids"||r==="format_ids"||r.startsWith("adressname_")||r.startsWith("strasse_")||r.startsWith("hausnummer_")||r.startsWith("plz_")||r.startsWith("stadt_")||r.startsWith("land_")||r.startsWith("notiz_")||r==="brutto_gesamt_budget"){if(r.endsWith("_ids")||r.endsWith("_ids[]")){const l=r.replace("_ids[]","_id").replace("_ids","_id");let u=!1;if(Array.isArray(t)?u=t.some(d=>d.name===l&&d.type==="uuid"):t&&typeof t=="object"&&(u=t[l]==="uuid"),u){const d=Array.isArray(s)?s:s?[s]:[];a[l]=d.length>0?d[0]:null,console.log(`✅ Setze ${l} aus ${r}:`,a[l])}}console.log(`🔧 Überspringe virtuelles Feld: ${r}`);continue}let o=null;if(Array.isArray(t)?o=t.find(u=>u.name===r)?.type:t&&typeof t=="object"&&(o=t[r]),o)switch(Array.isArray(s)&&(o==="uuid"||r.endsWith("_id"))&&(s=s.length>0?s[0]:null),o){case"number":a[r]=s?parseFloat(s):null;break;case"array":a[r]=Array.isArray(s)?s:s?[s]:null;break;case"date":a[r]=s?new Date(s).toISOString():null;break;case"boolean":a[r]=s==="on"||s===!0||s==="true";break;default:a[r]=s||null}else console.log(`🔧 Ignoriere unbekanntes Feld für ${n}: ${r}`)}return a}async applyFilters(e,t,n,a){for(const[r,i]of Object.entries(t)){if(r==="name"&&i){e=e.or(`vorname.ilike.%${i}%,nachname.ilike.%${i}%`);continue}if(i&&n[r]){const s=n[r],o=typeof i=="object"?"":String(i);switch(s){case"number":t[`${r}_min`]&&(e=e.gte(r,parseFloat(t[`${r}_min`]))),t[`${r}_max`]&&(e=e.lte(r,parseFloat(t[`${r}_max`]))),typeof i=="object"&&(i.min!=null&&i.min!==""&&(e=e.gte(r,parseFloat(i.min))),i.max!=null&&i.max!==""&&(e=e.lte(r,parseFloat(i.max))));break;case"string":r==="firmenname"||r==="markenname"||r==="name"?e=e.ilike(r,`%${o}%`):e=e.eq(r,o);break;case"array":Array.isArray(i)?e=e.overlaps(r,i):e=e.contains(r,[o]);break;case"date":if(t[`${r}_from`]&&(e=e.gte(r,t[`${r}_from`])),t[`${r}_to`]&&(e=e.lte(r,t[`${r}_to`])),typeof i=="object"){const l=i.from??i.min,u=i.to??i.max;l&&(e=e.gte(r,l)),u&&(e=e.lte(r,u))}break;case"uuid":if(o&&o!=="[object Object]")if(a==="unternehmen"&&r==="branche_id")try{let l=null;if(window.supabase){const{data:u,error:d}=await window.supabase.from("branchen").select("name").eq("id",o).single();d||(l=u?.name||null)}l?e=e.or(`branche_id.eq.${o},branche.ilike.%${l}%`):e=e.eq(r,o)}catch{e=e.eq(r,o)}else e=e.eq(r,o);break}}}return e}async loadFilterData(e){try{if(!window.supabase)return console.warn("⚠️ Supabase nicht verfügbar - verwende Mock-Daten"),this.getMockFilterData(e);const t=this.entities[e];if(!t)throw new Error(`Unbekannte Entität: ${e}`);let n=window.supabase.from(t.table);n=n.select("*");const{data:a,error:r}=await n;if(r)return console.error(`❌ Supabase Fehler beim Laden der Filter-Daten für ${e}:`,r),this.getMockFilterData(e);const i=await this.extractFilterOptions(a,e);if(e==="creator")try{const{data:s,error:o}=await window.supabase.from("creator_type").select("id, name").order("name");!o&&s&&(i.creator_type_id=s.map(m=>({id:m.id,name:m.name})));const{data:l,error:u}=await window.supabase.from("sprachen").select("id, name").order("name");!u&&l&&(i.sprache_id=l.map(m=>({id:m.id,name:m.name})));const{data:d,error:c}=await window.supabase.from("branchen_creator").select("id, name").order("name");!c&&d&&(i.branche_id=d.map(m=>({id:m.id,name:m.name})))}catch(s){console.error("❌ Fehler beim Laden der Creator-Filter-Optionen:",s)}if(e==="unternehmen")try{const{data:s,error:o}=await window.supabase.from("branchen").select("id, name, beschreibung").order("name");!o&&s&&(i.branche_id=s.map(l=>({id:l.id,name:l.name,description:l.beschreibung})),console.log(`✅ ${s.length} Branchen für Unternehmen-Filter geladen`))}catch(s){console.error("❌ Fehler beim Laden der Unternehmen-Filter-Optionen:",s)}if(e==="marke")try{const{data:s,error:o}=await window.supabase.from("branchen").select("id, name, beschreibung").order("name");!o&&s&&(i.branche_id=s.map(l=>({id:l.id,name:l.name,description:l.beschreibung})),console.log(`✅ ${s.length} Branchen für Marke-Filter geladen`))}catch(s){console.error("❌ Fehler beim Laden der Marke-Filter-Optionen:",s)}return console.log(`✅ Filter-Daten für ${e} geladen:`,i),i}catch(t){return console.error(`❌ Fehler beim Laden der Filter-Daten für ${e}:`,t),this.getMockFilterData(e)}}async executeQuery(e,t=[]){try{if(!window.supabase)return console.warn("⚠️ Supabase nicht verfügbar - kann SQL-Abfrage nicht ausführen"),[];const{data:n,error:a}=await window.supabase.rpc("execute_sql",{sql_query:e,sql_params:t});return a?(console.error("❌ Fehler bei der SQL-Abfrage:",a),[]):n||[]}catch(n){return console.error("❌ Fehler beim Ausführen der SQL-Abfrage:",n),[]}}async extractFilterOptions(e,t){const n={};if(t==="creator"){try{const{data:s,error:o}=await window.supabase.from("creator_type").select("id, name").order("name");if(!o&&s){const m=s.map(h=>({id:h.id,name:h.name}));n.creator_type=m,n.creator_type_id=m}const{data:l,error:u}=await window.supabase.from("sprachen").select("id, name").order("name");if(!u&&l){const m=l.map(h=>({id:h.id,name:h.name}));n.sprache=m,n.sprache_id=m}const{data:d,error:c}=await window.supabase.from("branchen_creator").select("id, name").order("name");if(!c&&d){const m=d.map(h=>({id:h.id,name:h.name}));n.branche=m,n.branche_id=m}}catch(s){console.error("❌ Fehler beim Laden der Filter-Optionen:",s)}const a=e.map(s=>s.instagram_follower).filter(s=>s&&s>0).sort((s,o)=>s-o);a.length>0&&(n.instagram_follower_min=Math.min(...a),n.instagram_follower_max=Math.max(...a));const r=new Set;e.forEach(s=>{s.lieferadresse_stadt&&r.add(s.lieferadresse_stadt)}),n.lieferadresse_stadt=Array.from(r).sort();const i=new Set;e.forEach(s=>{s.lieferadresse_land&&i.add(s.lieferadresse_land)}),n.lieferadresse_land=Array.from(i).sort()}else if(t==="unternehmen"){const a=new Set;e.forEach(o=>{o.branche&&a.add(o.branche)}),n.branche=Array.from(a).sort();const r=new Set;e.forEach(o=>{o.status&&r.add(o.status)}),n.status=Array.from(r).sort();const i=new Set;e.forEach(o=>{o.rechnungsadresse_stadt&&i.add(o.rechnungsadresse_stadt)}),n.rechnungsadresse_stadt=Array.from(i).sort();const s=new Set;e.forEach(o=>{o.rechnungsadresse_land&&s.add(o.rechnungsadresse_land)}),n.rechnungsadresse_land=Array.from(s).sort()}else if(t==="kampagne"){const a=new Set;e.forEach(i=>{i.status&&a.add(i.status)}),n.status=Array.from(a).sort();const r=e.map(i=>i.budget).filter(i=>i&&i>0).sort((i,s)=>i-s);r.length>0&&(n.budget_min=Math.min(...r),n.budget_max=Math.max(...r))}else if(t==="kooperation"){const a=new Set;e.forEach(i=>{i.status&&a.add(i.status)}),n.status=Array.from(a).sort();const r=e.map(i=>i.budget).filter(i=>i&&i>0).sort((i,s)=>i-s);r.length>0&&(n.budget_min=Math.min(...r),n.budget_max=Math.max(...r))}else if(t==="ansprechpartner"){try{const{data:r,error:i}=await window.supabase.from("positionen").select("id, name").order("sort_order, name");!i&&r&&(n.position_id=r.map(s=>({value:s.id,label:s.name})))}catch(r){console.error("❌ Fehler beim Laden der Positionen für Ansprechpartner-Filter:",r)}try{const{data:r,error:i}=await window.supabase.from("sprachen").select("id, name").order("name");!i&&r&&(n.sprache_id=r.map(s=>({value:s.id,label:s.name})))}catch(r){console.error("❌ Fehler beim Laden der Sprachen für Ansprechpartner-Filter:",r)}const a=new Set;e.forEach(r=>{r.stadt&&a.add(r.stadt)}),n.stadt=Array.from(a).sort();try{const{data:r,error:i}=await window.supabase.from("unternehmen").select("id, firmenname").order("firmenname");!i&&r&&(n.unternehmen_id=r.map(s=>({value:s.id,label:s.firmenname})))}catch(r){console.error("❌ Fehler beim Laden der Unternehmen für Ansprechpartner-Filter:",r)}}else if(t==="marke"){const a=new Set;e.forEach(i=>{i.branche&&a.add(i.branche)}),n.branche=Array.from(a).sort();const r=[...new Set(e.map(i=>i.unternehmen_id).filter(Boolean))];if(r.length>0)try{const{data:i,error:s}=await window.supabase.from("unternehmen").select("id, firmenname").in("id",r);!s&&i&&(n.unternehmen_id=i.map(o=>({value:o.id,label:o.firmenname})))}catch(i){console.error("❌ Fehler beim Laden der Unternehmen für Marken-Filter:",i)}}return n}getMockData(e){switch(console.log(`🔍 Lade Mock-Daten für ${e}`),e){case"unternehmen":return[{id:"1",firmenname:"Beispiel GmbH",branche:"Tech",webseite:"https://beispiel.de",created_at:new Date().toISOString()},{id:"2",firmenname:"Test AG",branche:"Business",webseite:"https://test.de",created_at:new Date().toISOString()}];case"marke":return[{id:"1",markenname:"Beispiel Marke",unternehmen_id:"1",branche:"Tech",webseite:"https://marke.de",created_at:new Date().toISOString(),unternehmen:{id:"1",firmenname:"Beispiel GmbH"}}];default:return[]}}getMockFilterData(e){return{creator:{sprachen:["Deutsch","Englisch","Französisch","Spanisch"],branche:["Mode","Beauty","Fitness","Food","Tech","Lifestyle"],creator_type:["Influencer","Content Creator","Künstler","Experte"],instagram_follower_min:1e3,instagram_follower_max:1e6},unternehmen:{branche:["Mode","Beauty","Fitness","Food","Tech","Lifestyle"]},marke:{branche:[{value:"Beauty & Fashion",label:"Beauty & Fashion"},{value:"Fitness & Gesundheit",label:"Fitness & Gesundheit"},{value:"Food & Lifestyle",label:"Food & Lifestyle"},{value:"Gaming",label:"Gaming"},{value:"Tech",label:"Tech"},{value:"Travel",label:"Travel"},{value:"Business",label:"Business"},{value:"Education",label:"Education"}],unternehmen_id:[{value:"1",label:"Beispiel GmbH"},{value:"2",label:"Test AG"}]},kampagne:{status:["Aktiv","In Planung","Abgeschlossen","Pausiert"],budget_min:1e3,budget_max:5e4},kooperation:{status:["Angefragt","Bestätigt","In Bearbeitung","Abgeschlossen","Abgelehnt"],budget_min:500,budget_max:1e4}}[e]||{}}}const K=new st;typeof window<"u"&&(window.DataService=K,window.CreatorService={loadFilterData:()=>K.loadFilterData("creator"),loadCreators:f=>K.loadEntities("creator",f),createEntity:f=>K.createEntity("creator",f),updateEntity:(f,e)=>K.updateEntity("creator",f,e),deleteEntity:f=>K.deleteEntity("creator",f)});class le{constructor(){this.sanitizeCache=new Map}sanitizeHtml(e){if(!e||typeof e!="string")return"";if(this.sanitizeCache.has(e))return this.sanitizeCache.get(e);let t=e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#x27;").replace(/\//g,"&#x2F;");return this.sanitizeCache.set(e,t),t}validateEmail(e){return!e||typeof e!="string"?!1:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())}validatePhone(e){return!e||typeof e!="string"?!1:e.replace(/[^\d+\-\(\)\s]/g,"").length>=10}validateUrl(e){if(!e||typeof e!="string")return!1;try{return new URL(e),!0}catch{return!1}}validateNumber(e,t=null,n=null){const a=parseFloat(e);return!(isNaN(a)||t!==null&&a<t||n!==null&&a>n)}validateText(e,t=0,n=null){if(!e||typeof e!="string")return!1;const a=e.trim().length;return!(a<t||n!==null&&a>n)}validateRequired(e){return e==null?!1:typeof e=="string"?e.trim().length>0:Array.isArray(e)?e.length>0:!0}validateForm(e,t){const n={};for(const[a,r]of Object.entries(t)){const i=e[a];if(r.required&&!this.validateRequired(i)){n[a]=`${a} ist erforderlich`;continue}if(this.validateRequired(i)){if(r.type==="email"&&!this.validateEmail(i)){n[a]="Ungültige Email-Adresse";continue}if(r.type==="phone"&&!this.validatePhone(i)){n[a]="Ungültige Telefonnummer";continue}if(r.type==="url"&&!this.validateUrl(i)){n[a]="Ungültige URL";continue}if(r.type==="number"&&!this.validateNumber(i,r.min,r.max)){n[a]="Ungültige Zahl";continue}if(r.type==="text"&&!this.validateText(i,r.minLength,r.maxLength)){n[a]="Ungültiger Text";continue}}}return{isValid:Object.keys(n).length===0,errors:n}}clearCache(){this.sanitizeCache.clear()}}const C=new le;typeof window<"u"&&(window.Validator={sanitizeHtml:f=>C.sanitizeHtml(f),validateEmail:f=>C.validateEmail(f),validatePhone:f=>C.validatePhone(f),validateUrl:f=>C.validateUrl(f),validateNumber:(f,e,t)=>C.validateNumber(f,e,t),validateText:(f,e,t)=>C.validateText(f,e,t),validateRequired:f=>C.validateRequired(f),validateForm:(f,e)=>C.validateForm(f,e)});class ot{constructor(){this.validator=C}sanitizeHtml(e){return this.validator.sanitizeHtml(e)}formatCreatorName(e,t){if(!e&&!t)return"Unbekannter Creator";const n=this.sanitizeHtml(e||""),a=this.sanitizeHtml(t||"");return`${n} ${a}`.trim()}formatFollowerCount(e){return!e||isNaN(e)?"-":e>=1e6?`${(e/1e6).toFixed(1)}M`:e>=1e3?`${(e/1e3).toFixed(1)}K`:e.toString()}formatBudget(e){return!e||isNaN(e)?"-":new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(e)}formatAddress(e){const t=[];return e.lieferadresse_strasse&&t.push(this.sanitizeHtml(e.lieferadresse_strasse)),e.lieferadresse_hausnummer&&t.push(this.sanitizeHtml(e.lieferadresse_hausnummer)),e.lieferadresse_plz&&t.push(this.sanitizeHtml(e.lieferadresse_plz)),e.lieferadresse_stadt&&t.push(this.sanitizeHtml(e.lieferadresse_stadt)),e.lieferadresse_land&&t.push(this.sanitizeHtml(e.lieferadresse_land)),t.length>0?t.join(", "):"-"}formatSocialMedia(e){const t=[];return e.instagram&&t.push(`<a href="https://instagram.com/${e.instagram.replace("@","")}" target="_blank" rel="noopener noreferrer">${this.sanitizeHtml(e.instagram)}</a>`),e.tiktok&&t.push(`<a href="https://tiktok.com/@${e.tiktok.replace("@","")}" target="_blank" rel="noopener noreferrer">${this.sanitizeHtml(e.tiktok)}</a>`),t.length>0?t.join("<br>"):"-"}formatTags(e,t=3){if(!e||!Array.isArray(e))return"-";const n=e.filter(r=>r&&r.trim()).map(r=>`<span class="tag">${this.sanitizeHtml(r.trim())}</span>`).slice(0,t);if(n.length===0)return"-";let a=n.join("");return e.length>t&&(a+=`<span class="tag-more">+${e.length-t}</span>`),a}formatCreatorType(e){return e?{Influencer:"Influencer","Content Creator":"Content Creator","UGC Creator":"UGC Creator","Micro Influencer":"Micro Influencer","Macro Influencer":"Macro Influencer",Celebrity:"Celebrity",Expert:"Expert",Lifestyle:"Lifestyle"}[e]||this.sanitizeHtml(e):"-"}formatContact(e){const t=[];return e.mail&&t.push(`<a href="mailto:${this.sanitizeHtml(e.mail)}">${this.sanitizeHtml(e.mail)}</a>`),e.telefonnummer&&t.push(`<a href="tel:${this.sanitizeHtml(e.telefonnummer)}">${this.sanitizeHtml(e.telefonnummer)}</a>`),e.portfolio_link&&t.push(`<a href="${this.sanitizeHtml(e.portfolio_link)}" target="_blank" rel="noopener noreferrer">Portfolio</a>`),t.length>0?t.join("<br>"):"-"}getCreatorStatus(e){const t=e.instagram&&e.instagram_follower>0,n=e.tiktok&&e.tiktok_follower>0,a=e.mail||e.telefonnummer,r=e.lieferadresse_stadt;return t&&n&&a&&r?"complete":t||n?"partial":"incomplete"}getStatusBadge(e){const t={complete:'<span class="badge badge-success">Vollständig</span>',partial:'<span class="badge badge-warning">Teilweise</span>',incomplete:'<span class="badge badge-error">Unvollständig</span>'};return t[e]||t.incomplete}validateCreator(e){const t=[];return!e.vorname&&!e.nachname&&t.push("Name ist erforderlich"),e.mail&&!this.validator.validateEmail(e.mail)&&t.push("Ungültige Email-Adresse"),e.telefonnummer&&!this.validator.validatePhone(e.telefonnummer)&&t.push("Ungültige Telefonnummer"),e.portfolio_link&&!this.validator.validateUrl(e.portfolio_link)&&t.push("Ungültige Portfolio-URL"),{isValid:t.length===0,errors:t}}}const de=new ot;typeof window<"u"&&(window.CreatorUtils=de);class W{getFormConfig(e){return{creator:{title:"Neuen Creator anlegen",fields:[{name:"vorname",label:"Vorname",type:"text",required:!0,validation:{type:"text",minLength:2}},{name:"nachname",label:"Nachname",type:"text",required:!0,validation:{type:"text",minLength:2}},{name:"instagram",label:"Instagram",type:"text",required:!1},{name:"instagram_follower",label:"Instagram Follower",type:"number",required:!1},{name:"tiktok",label:"TikTok",type:"text",required:!1},{name:"tiktok_follower",label:"TikTok Follower",type:"number",required:!1},{name:"sprachen_ids",label:"Sprachen",type:"multiselect",required:!1,options:[],dynamic:!0,searchable:!0,tagBased:!0,placeholder:"Sprachen suchen und hinzufügen...",table:"sprachen",displayField:"name",valueField:"id",customField:!0},{name:"branchen_ids",label:"Branchen",type:"multiselect",required:!1,options:[],dynamic:!0,searchable:!0,tagBased:!0,placeholder:"Branchen suchen und hinzufügen...",table:"branchen_creator",displayField:"name",valueField:"id",customField:!0},{name:"creator_type_ids",label:"Creator-Typen",type:"multiselect",required:!1,options:[],dynamic:!0,searchable:!0,tagBased:!0,placeholder:"Creator-Typen suchen und hinzufügen...",table:"creator_type",displayField:"name",valueField:"id",customField:!0},{name:"telefonnummer",label:"Telefonnummer",type:"tel",required:!1,validation:{type:"phone"}},{name:"mail",label:"Email",type:"email",required:!1,validation:{type:"email"}},{name:"portfolio_link",label:"Portfolio Link",type:"url",required:!1,validation:{type:"url"}},{name:"lieferadresse_strasse",label:"Straße",type:"text",required:!1},{name:"lieferadresse_hausnummer",label:"Hausnummer",type:"text",required:!1},{name:"lieferadresse_plz",label:"PLZ",type:"text",required:!1},{name:"lieferadresse_stadt",label:"Stadt",type:"text",required:!1},{name:"lieferadresse_land",label:"Land",type:"text",required:!1},{name:"notiz",label:"Notizen",type:"textarea",required:!1}]},unternehmen:{title:"Neues Unternehmen anlegen",fields:[{name:"firmenname",label:"Firmenname",type:"text",required:!0,validation:{type:"text",minLength:2}},{name:"branche_id",label:"Branchen",type:"multiselect",required:!1,dynamic:!0,searchable:!0,tagBased:!0,placeholder:"Branche suchen und hinzufügen...",table:"branchen",displayField:"name",valueField:"id",relationTable:"unternehmen_branchen",relationField:"branche_id"},{name:"rechnungsadresse_strasse",label:"Straße",type:"text",required:!1},{name:"rechnungsadresse_hausnummer",label:"Hausnummer",type:"text",required:!1},{name:"rechnungsadresse_plz",label:"PLZ",type:"text",required:!1},{name:"rechnungsadresse_stadt",label:"Stadt",type:"text",required:!1},{name:"rechnungsadresse_land",label:"Land",type:"text",required:!1},{name:"invoice_email",label:"Rechnungs-Email",type:"email",required:!1,validation:{type:"email"}},{name:"status",label:"Status",type:"select",required:!1,options:["Aktiv","Inaktiv","Prospekt"]}]},kampagne:{title:"Neue Kampagne anlegen",fields:[{name:"kampagnenname",label:"Kampagnenname",type:"text",required:!1,validation:{type:"text",minLength:2,skipIfAutoGenerated:!0},autoGenerate:!0,dependsOn:"auftrag_id",showWhen:"any",readonly:!0,placeholder:"Wird automatisch generiert..."},{name:"unternehmen_id",label:"Unternehmen",type:"select",required:!0,options:[],dynamic:!0,searchable:!0,placeholder:"Unternehmen suchen und auswählen...",table:"unternehmen",displayField:"firmenname",valueField:"id"},{name:"marke_id",label:"Marke",type:"select",required:!1,options:[],dynamic:!0,searchable:!0,placeholder:"Marke suchen und auswählen...",dependsOn:"unternehmen_id",table:"marke",displayField:"markenname",valueField:"id"},{name:"auftrag_id",label:"Auftrag",type:"select",required:!1,options:[],dynamic:!0,searchable:!0,placeholder:"Auftrag suchen und auswählen...",dependsOn:"marke_id",table:"auftrag",displayField:"auftragsname",valueField:"id"},{name:"ziele",label:"Ziele",type:"textarea",required:!1},{name:"art_der_kampagne",label:"Art der Kampagne",type:"multiselect",required:!1,options:[],dynamic:!0,searchable:!0,tagBased:!0,placeholder:"Kampagnenarten suchen und auswählen...",table:"kampagne_art_typen",displayField:"name",valueField:"id",directQuery:!0},{name:"kampagne_typ",label:"Kampagne Typ",type:"select",required:!0,searchable:!0,placeholder:"Kampagne-Typ auswählen...",options:[{value:"paid",label:"Paid"},{value:"organic",label:"Organic"}]},{name:"start",label:"Startdatum",type:"date",required:!1},{name:"deadline",label:"Deadline",type:"date",required:!1},{name:"drehort_typ_id",label:"Drehort",type:"select",required:!1,options:[],dynamic:!0,searchable:!0,placeholder:"Drehort-Typ auswählen...",table:"drehort_typen",displayField:"name",valueField:"id",directQuery:!0},{name:"drehort_beschreibung",label:"Drehort Beschreibung",type:"textarea",required:!1,dependsOn:"drehort_typ_id",showWhen:"Vor Ort Produktion"},{name:"kampagne_adressen",label:"Adressen",type:"custom",customType:"addresses",required:!1,dependsOn:"drehort_typ_id",showWhen:"Vor Ort Produktion"},{name:"status_id",label:"Status",type:"select",required:!1,options:[],dynamic:!0,searchable:!0,placeholder:"Status auswählen...",table:"kampagne_status",displayField:"name",valueField:"id",directQuery:!0},{name:"plattform_ids",label:"Plattformen",type:"multiselect",required:!1,options:[],dynamic:!0,searchable:!0,tagBased:!0,placeholder:"Plattformen suchen und auswählen...",table:"plattform_typen",displayField:"name",valueField:"id",relationTable:"kampagne_plattformen",relationField:"plattform_id",directQuery:!0},{name:"format_ids",label:"Formate",type:"multiselect",required:!1,options:[],dynamic:!0,searchable:!0,tagBased:!0,placeholder:"Formate suchen und auswählen...",table:"format_typen",displayField:"name",valueField:"id",relationTable:"kampagne_formate",relationField:"format_id",directQuery:!0},{name:"creatoranzahl",label:"Creator Anzahl",type:"number",required:!1,validation:{type:"number",min:1}},{name:"videoanzahl",label:"Video Anzahl",type:"number",required:!1,validation:{type:"number",min:1}},{name:"budget_info",label:"Budget Info",type:"textarea",required:!1}]},marke:{title:"Neue Marke anlegen",fields:[{name:"markenname",label:"Markenname",type:"text",required:!0,validation:{type:"text",minLength:2}},{name:"unternehmen_id",label:"Unternehmen",type:"select",required:!0,options:[],dynamic:!0,searchable:!0,placeholder:"Unternehmen suchen und auswählen...",table:"unternehmen",displayField:"firmenname",valueField:"id"},{name:"webseite",label:"Webseite",type:"url",required:!1,validation:{type:"url"}},{name:"branche_ids",label:"Branchen",type:"multiselect",required:!1,dynamic:!0,searchable:!0,tagBased:!0,placeholder:"Branchen suchen und hinzufügen...",table:"branchen",displayField:"name",valueField:"id"}]},auftrag:{title:"Neuen Auftrag anlegen",fields:[{name:"art_der_kampagne",label:"Art der Kampagne",type:"multiselect",required:!1,options:[],dynamic:!0,searchable:!0,tagBased:!0,table:"kampagne_art_typen",displayField:"name",valueField:"id"},{name:"auftragsname",label:"Auftragsname",type:"text",required:!0,validation:{type:"text",minLength:2}},{name:"unternehmen_id",label:"Unternehmen",type:"select",required:!0,options:[],dynamic:!0,searchable:!0,placeholder:"Unternehmen suchen und auswählen..."},{name:"marke_id",label:"Marke",type:"select",required:!1,options:[],dynamic:!0,searchable:!0,placeholder:"Marke suchen und auswählen...",dependsOn:"unternehmen_id",table:"marke",displayField:"markenname",valueField:"id"},{name:"status",label:"Status",type:"select",required:!1,options:["Beauftragt","In Produktion","Abgeschlossen","Storniert"]},{name:"ansprechpartner_id",label:"Ansprechpartner",type:"select",required:!1,options:[],dynamic:!0,searchable:!0,placeholder:"Ansprechpartner auswählen...",table:"ansprechpartner",displayField:"vorname,nachname,email",valueField:"id",dependsOn:"unternehmen_id"},{name:"po",label:"PO",type:"text",required:!1,placeholder:"Purchase Order Nummer..."},{name:"re_nr",label:"RE. Nr",type:"text",required:!1,placeholder:"Rechnungsnummer..."},{name:"re_faelligkeit",label:"RE-Fälligkeit",type:"date",required:!1},{name:"kampagnenanzahl",label:"Kampagnenanzahl",type:"number",required:!1,validation:{type:"number",min:1}},{name:"start",label:"Startdatum",type:"date",required:!1},{name:"ende",label:"Enddatum",type:"date",required:!1},{name:"nettobetrag",label:"Nettobetrag",type:"number",required:!1,validation:{type:"number",min:0}},{name:"ust_prozent",label:"USt (%)",type:"number",required:!1,validation:{type:"number",min:0,max:100},readonly:!0,defaultValue:19},{name:"ust_betrag",label:"USt Betrag",type:"number",required:!1,validation:{type:"number",min:0},readonly:!0,calculatedFrom:["nettobetrag","ust_prozent"]},{name:"bruttobetrag",label:"Brutto Gesamtbudget",type:"number",required:!1,validation:{type:"number",min:0},readonly:!0,calculatedFrom:["nettobetrag","ust_betrag"]},{name:"rechnung_gestellt",label:"Rechnung gestellt",type:"toggle",required:!1},{name:"ueberwiesen",label:"Überwiesen",type:"toggle",required:!1},{name:"mitarbeiter_ids",label:"Mitarbeiter zuweisen",type:"multiselect",required:!1,options:[],dynamic:!0,searchable:!0,tagBased:!0,placeholder:"Mitarbeiter suchen und auswählen...",table:"benutzer",displayField:"name",valueField:"id",relationTable:"auftrag_mitarbeiter",relationField:"mitarbeiter_id"},{name:"cutter_ids",label:"Cutter zuweisen",type:"multiselect",required:!1,options:[],dynamic:!0,searchable:!0,tagBased:!0,placeholder:"Cutter suchen und auswählen...",table:"benutzer",displayField:"name",valueField:"id",customField:!0,relationTable:"auftrag_cutter",relationField:"mitarbeiter_id"},{name:"copywriter_ids",label:"Copywright zuweisen",type:"multiselect",required:!1,options:[],dynamic:!0,searchable:!0,tagBased:!0,placeholder:"Copywriter suchen und auswählen...",table:"benutzer",displayField:"name",valueField:"id",customField:!0,relationTable:"auftrag_copywriter",relationField:"mitarbeiter_id"}]},kooperation:{title:"Neue Kooperation anlegen",fields:[{name:"unternehmen_id",label:"Unternehmen",type:"select",required:!0,options:[],dynamic:!0,searchable:!0,placeholder:"Unternehmen suchen und auswählen..."},{name:"marke_id",label:"Marke",type:"select",required:!0,options:[],dynamic:!0,searchable:!0,placeholder:"Marke auswählen...",dependsOn:"unternehmen_id"},{name:"kampagne_id",label:"Kampagne",type:"select",required:!0,options:[],dynamic:!0,searchable:!0,placeholder:"Kampagne suchen und auswählen...",dependsOn:"marke_id"},{name:"briefing_id",label:"Briefing",type:"select",required:!1,options:[],dynamic:!0,searchable:!0,placeholder:"Briefing wählen...",dependsOn:"kampagne_id",table:"briefings",displayField:"product_service_offer",valueField:"id"},{name:"creator_id",label:"Creator",type:"select",required:!0,options:[],dynamic:!0,searchable:!0,placeholder:"Creator suchen und auswählen...",dependsOn:"kampagne_id"},{name:"name",label:"Name",type:"text",required:!0,validation:{type:"text",minLength:2},autoGenerate:!0,readonly:!0,placeholder:"Wird automatisch generiert..."},{name:"content_art",label:"Content Art",type:"select",required:!0,options:["Paid","Organisch","Influencer","Videograph"]},{name:"skript_autor",label:"Skript schreibt",type:"select",required:!1,options:["Brand","Creator"]},{name:"nettobetrag",label:"Nettobetrag",type:"number",required:!1,validation:{type:"number",min:0}},{name:"zusatzkosten",label:"Zusatzkosten",type:"number",required:!1,validation:{type:"number",min:0}},{name:"gesamtkosten",label:"Gesamtkosten",type:"number",required:!1,validation:{type:"number",min:0}},{name:"vertrag_unterschrieben",label:"Vertrag unterschrieben",type:"checkbox",required:!1},{name:"vertrag_link",label:"Vertrag Link",type:"url",required:!1,validation:{type:"url"}},{name:"videoanzahl",label:"Video Anzahl",type:"number",required:!1,validation:{type:"number",min:1}},{name:"skript_deadline",label:"Skript Deadline",type:"date",required:!1},{name:"skript_link",label:"Skript Link",type:"url",required:!1,validation:{type:"url"}},{name:"content_deadline",label:"Content Deadline",type:"date",required:!1},{name:"status",label:"Status",type:"select",required:!0,options:["Todo","In progress","Done"]}]},ansprechpartner:{title:"Neuen Ansprechpartner anlegen",fields:[{name:"vorname",label:"Vorname",type:"text",required:!0,validation:{type:"text",minLength:2}},{name:"nachname",label:"Nachname",type:"text",required:!0,validation:{type:"text",minLength:2}},{name:"unternehmen_id",label:"Unternehmen",type:"select",required:!1,options:[],dynamic:!0,searchable:!0,placeholder:"Unternehmen suchen und auswählen...",table:"unternehmen",displayField:"firmenname",valueField:"id",directQuery:!0},{name:"marke_ids",label:"Marken",type:"multiselect",required:!1,options:[],dynamic:!0,searchable:!0,tagBased:!0,placeholder:"Marken suchen und hinzufügen...",dependsOn:"unternehmen_id",table:"marke",displayField:"markenname",valueField:"id",relationTable:"ansprechpartner_marke",relationField:"marke_id"},{name:"position_id",label:"Position",type:"select",required:!0,options:[],dynamic:!0,searchable:!0,placeholder:"Position suchen und auswählen...",table:"positionen",displayField:"name",valueField:"id",directQuery:!0},{name:"email",label:"E-Mail",type:"email",required:!1,validation:{type:"email"}},{name:"telefonnummer",nameCountry:"telefonnummer_land_id",label:"Telefonnummer (mobil)",type:"phone",required:!1,defaultCountry:"Deutschland",table:"eu_laender",displayField:"name_de,vorwahl,iso_code",valueField:"id",dynamic:!0},{name:"telefonnummer_office",nameCountry:"telefonnummer_office_land_id",label:"Telefonnummer (Büro)",type:"phone",required:!1,defaultCountry:"Deutschland",table:"eu_laender",displayField:"name_de,vorwahl,iso_code",valueField:"id",dynamic:!0},{name:"linkedin",label:"LinkedIn Profil",type:"url",required:!1,validation:{type:"url"}},{name:"stadt",label:"Stadt",type:"text",required:!1},{name:"sprachen_ids",label:"Sprachen",type:"multiselect",required:!1,dynamic:!0,searchable:!0,tagBased:!0,placeholder:"Sprachen suchen und hinzufügen...",table:"sprachen",displayField:"name",valueField:"id",relationTable:"ansprechpartner_sprache",relationField:"sprache_id",customField:!0},{name:"notiz",label:"Notizen",type:"textarea",required:!1,rows:4}]},briefing:{title:"Neues Briefing anlegen",fields:[{name:"product_service_offer",label:"Produkt/Service/Angebot",type:"text",required:!0,validation:{type:"text",minLength:2},placeholder:"Kurzbezeichnung des Produkts/Angebots"},{name:"produktseite_url",label:"Produktseite URL",type:"url",required:!1,validation:{type:"url"}},{name:"unternehmen_id",label:"Unternehmen",type:"select",required:!1,options:[],dynamic:!0,searchable:!0,placeholder:"Unternehmen suchen und auswählen...",table:"unternehmen",displayField:"firmenname",valueField:"id",directQuery:!0},{name:"marke_id",label:"Marke",type:"select",required:!1,options:[],dynamic:!0,searchable:!0,placeholder:"Marke suchen und auswählen...",dependsOn:"unternehmen_id",table:"marke",displayField:"markenname",valueField:"id"},{name:"kampagne_id",label:"Kampagne",type:"select",required:!1,options:[],dynamic:!0,searchable:!0,placeholder:"Kampagne wählen...",dependsOn:"marke_id",table:"kampagne",displayField:"kampagnenname",valueField:"id"},{name:"assignee_id",label:"Zugewiesen an",type:"select",required:!1,options:[],dynamic:!0,searchable:!0,placeholder:"Mitarbeiter auswählen...",table:"benutzer",displayField:"name",valueField:"id",directQuery:!0},{name:"status",label:"Status",type:"select",required:!1,options:["active","inactive","completed","cancelled"]},{name:"deadline",label:"Deadline",type:"date",required:!1},{name:"zielgruppe",label:"Zielgruppe",type:"textarea",required:!1,rows:3},{name:"zieldetails",label:"Zieldetails",type:"textarea",required:!1,rows:3},{name:"creator_aufgabe",label:"Creator Aufgabe",type:"textarea",required:!1,rows:4},{name:"usp",label:"USPs",type:"textarea",required:!1,rows:3,placeholder:"Unique Selling Points, durch Komma getrennt oder als Fließtext"},{name:"dos",label:"Do's",type:"textarea",required:!1,rows:3},{name:"donts",label:"Don'ts",type:"textarea",required:!1,rows:3},{name:"rechtlicher_hinweis",label:"Rechtlicher Hinweis",type:"textarea",required:!1,rows:4},{name:"documents_files",label:"Dokumente (PDFs, Bilder)",type:"custom",customType:"uploader",accept:"application/pdf,image/*",multiple:!0,required:!1}]},rechnung:{title:"Neue Rechnung anlegen",fields:[{name:"rechnung_nr",label:"Rechnungs-Nr",type:"text",required:!0,validation:{type:"text",minLength:2}},{name:"kooperation_id",label:"Kooperation",type:"select",required:!0,options:[],dynamic:!0,searchable:!0,placeholder:"Kooperation wählen...",table:"kooperationen",displayField:"name",valueField:"id"},{name:"unternehmen_id",label:"Unternehmen",type:"select",required:!0,options:[],dynamic:!0,searchable:!0,placeholder:"Unternehmen wird automatisch gesetzt",readonly:!0,table:"unternehmen",displayField:"firmenname",valueField:"id"},{name:"auftrag_id",label:"Auftrag",type:"select",required:!0,options:[],dynamic:!0,searchable:!0,placeholder:"Auftrag wird automatisch gesetzt",readonly:!0,table:"auftrag",displayField:"auftragsname",valueField:"id"},{name:"kampagne_id",label:"Kampagne",type:"select",required:!0,options:[],dynamic:!0,searchable:!0,placeholder:"Kampagne wird automatisch gesetzt",readonly:!0,table:"kampagne",displayField:"kampagnenname",valueField:"id"},{name:"creator_id",label:"Creator",type:"select",required:!1,options:[],dynamic:!0,searchable:!0,placeholder:"Creator wird automatisch gesetzt",readonly:!0,table:"creator",displayField:"vorname",valueField:"id"},{name:"videoanzahl",label:"Video Anzahl (aus Kooperation)",type:"number",required:!1,validation:{type:"number",min:0}},{name:"status",label:"Status",type:"select",required:!0,options:["Offen","Rückfrage","Bezahlt","An Qonto gesendet"]},{name:"geprueft",label:"Geprüft",type:"toggle",required:!1},{name:"gestellt_am",label:"Gestellt am",type:"date",required:!0},{name:"zahlungsziel",label:"Zahlungsziel",type:"date",required:!0},{name:"bezahlt_am",label:"Bezahlt am",type:"date",required:!1},{name:"nettobetrag",label:"Betrag (Netto)",type:"number",required:!0,validation:{type:"number",min:0}},{name:"zusatzkosten",label:"Zusatzkosten",type:"number",required:!1,validation:{type:"number",min:0}},{name:"bruttobetrag",label:"Betrag (Brutto)",type:"number",required:!0,validation:{type:"number",min:0}},{name:"pdf_file",label:"Rechnungs-PDF",type:"custom",customType:"uploader",accept:"application/pdf",multiple:!1,required:!1},{name:"belege_files",label:"Belege (mehrere Dateien)",type:"custom",customType:"uploader",accept:"application/pdf,image/*",multiple:!0,required:!1}]}}[e]||null}}class lt{constructor({multiple:e=!1,accept:t="*/*",onFilesChanged:n=()=>{}}={}){this.multiple=e,this.accept=t,this.onFilesChanged=n,this.files=[],this.root=null,this.input=null,this.listEl=null}mount(e){if(!e)return;this.root=e;const t=`uploader-input-${Math.random().toString(36).slice(2)}`;this.root.innerHTML=`
      <div class="uploader-drop" tabindex="0">
        <div class="uploader-instructions">
          <span>Per Drag & Drop hierher ziehen oder</span>
          <button type="button" class="uploader-btn">Datei(en) auswählen</button>
        </div>
        <input type="file" id="${t}" ${this.multiple?"multiple":""} accept="${this.accept}" style="display:none" />
      </div>
      <div class="uploader-list"></div>
    `,this.input=this.root.querySelector('input[type="file"]'),this.listEl=this.root.querySelector(".uploader-list"),this.bind(),this.root.__uploaderInstance=this,this.renderList()}bind(){const e=this.root.querySelector(".uploader-drop");this.root.querySelector(".uploader-btn").addEventListener("click",()=>this.input.click()),this.input.addEventListener("change",a=>this.handleFiles(a.target.files)),["dragenter","dragover"].forEach(a=>e.addEventListener(a,r=>{r.preventDefault(),e.classList.add("is-dragover")})),["dragleave","dragend","drop"].forEach(a=>e.addEventListener(a,r=>{r.preventDefault(),e.classList.remove("is-dragover")})),e.addEventListener("drop",a=>{const r=a.dataTransfer;if(!r)return;const i=r.files;this.handleFiles(i)});const n=this.root.closest("form");n&&["dragover","drop"].forEach(a=>n.addEventListener(a,r=>{r.preventDefault()}))}handleFiles(e){if(!e||e.length===0)return;const t=a=>!this.accept||this.accept==="*/*"?!0:this.accept.split(",").map(i=>i.trim()).some(i=>i.endsWith("/*")?a.type.startsWith(i.slice(0,-1)):a.type===i||`.${a.name.split(".").pop()}`===i),n=Array.from(e).filter(a=>t(a));this.multiple?this.files=[...this.files,...n]:this.files=n.length?[n[0]]:[],this.renderList(),this.onFilesChanged(this.files)}renderList(){if(!this.listEl)return;if(!this.files.length){this.listEl.innerHTML='<div class="uploader-empty">Keine Dateien ausgewählt</div>';return}const e=this.files.map((t,n)=>`
      <div class="uploader-item">
        <div class="uploader-meta">
          <span class="uploader-name">${t.name}</span>
          <span class="uploader-size">${this.formatSize(t.size)}</span>
        </div>
        <button type="button" class="uploader-remove" data-index="${n}">Entfernen</button>
      </div>
    `).join("");this.listEl.innerHTML=e,this.listEl.querySelectorAll(".uploader-remove").forEach(t=>{t.addEventListener("click",()=>{const n=parseInt(t.dataset.index,10);this.files.splice(n,1),this.renderList(),this.onFilesChanged(this.files)})})}formatSize(e){if(!e&&e!==0)return"";const t=["B","KB","MB","GB"];let n=e,a=0;for(;n>=1024&&a<t.length-1;)n/=1024,a++;return`${n.toFixed(1)} ${t[a]}`}}class dt{constructor(e,t=""){this.field=e,this.value=t,this.fieldId=`field-${e.name}`}render(){const e=this.field.required?"required":"",t=this.field.required?'<span class="required">*</span>':"",n=this.field.dependsOn?`data-depends-on="${this.field.dependsOn}"`:"",a=this.field.showWhen?`data-show-when="${this.field.showWhen}"`:"",r=this.field.dependsOn?'style="display: none;"':"";return`
      <div class="form-field" ${n} ${a} ${r}>
        <label for="${this.fieldId}">${this.field.label} ${t}</label>
        ${this.renderInput(e)}
      </div>
    `}renderInput(e){throw new Error("renderInput muss von Unterklassen implementiert werden")}sanitizeHtml(e){return e?e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#x27;"):""}validate(){const e=[];if(this.field.required&&(!this.value||this.value.toString().trim()==="")&&e.push(`${this.field.label} ist erforderlich.`),this.field.validation&&this.value){const t=this.validateField();e.push(...t)}return e}validateField(){return[]}setupEvents(e){this.field.autoGenerate&&e.setAttribute("data-auto-generate","true")}}class ct extends dt{constructor(e,t={}){super(e,t),this.phoneNumber=t?.telefonnummer||t||"",this.countryId=t?.land_id||"",this.countries=[]}render(){const e=this.field.required?"required":"",t=this.field.required?'<span class="required">*</span>':"",n=this.field.dependsOn?`data-depends-on="${this.field.dependsOn}"`:"",a=this.field.showWhen?`data-show-when="${this.field.showWhen}"`:"",r=this.field.dependsOn?'style="display: none;"':"",i=this.field.nameCountry||`${this.field.name}_land_id`,s=`field-${i}`,o=`field-${this.field.name}`;return`
      <div class="form-field phone-number-field-container" ${n} ${a} ${r}>
        <label>${this.field.label} ${t}</label>
        <div class="phone-number-field">
          <select 
            id="${s}" 
            name="${i}" 
            class="phone-country-select"
            data-searchable="true"
            data-placeholder="Land wählen..."
            data-table="eu_laender"
            data-display-field="name_de"
            data-value-field="id"
            data-phone-field="true"
            ${e}>
            <option value="">Land wählen...</option>
          </select>
          <div class="phone-input-wrapper">
            <span class="phone-prefix" style="display: none;"></span>
            <input 
              type="tel" 
              id="${o}" 
              name="${this.field.name}" 
              class="phone-number-input"
              placeholder="123 456 7890"
              value="${this.sanitizeHtml(this.phoneNumber)}"
              autocomplete="off"
              ${e}>
          </div>
        </div>
        
      </div>
    `}static renderCountryOption(e,t=!1){const n=t?"selected":"";return`
      <option value="${e.id}" ${n} data-iso="${e.iso_code}" data-vorwahl="${e.vorwahl}">
        ${e.vorwahl} ${e.name_de}
      </option>
    `}async loadCountries(){try{const{data:e,error:t}=await window.supabase.from("eu_laender").select("*").order("sort_order",{ascending:!0});if(t)throw t;return this.countries=e,e}catch(e){return console.error("❌ Fehler beim Laden der Länder:",e),[]}}getValue(){return{[this.field.name]:this.phoneNumber,[this.field.nameCountry||`${this.field.name}_land_id`]:this.countryId}}validateField(){const e=[];return this.phoneNumber&&this.phoneNumber.trim()!==""&&!this.countryId&&e.push(`${this.field.label}: Bitte wähle ein Land aus.`),this.field.required&&(!this.phoneNumber||this.phoneNumber.trim()==="")&&e.push(`${this.field.label} ist erforderlich.`),this.phoneNumber&&this.phoneNumber.trim()!==""&&(/^[0-9\s\-\(\)]+$/.test(this.phoneNumber)||e.push(`${this.field.label}: Ungültiges Format. Nur Zahlen, Leerzeichen und - ( ) erlaubt.`)),e}}class ce{constructor(){this.validator=new le}getFieldLabel(e){return{unternehmen_id:"Unternehmen",marke_id:"Marke",auftrag_id:"Auftrag",kampagne_id:"Kampagne",creator_id:"Creator"}[e]||e}renderForm(e,t=null){const n=this.getFormConfig(e);if(!n)return console.error(`❌ Keine Konfiguration für Entity: ${e}`),"";const a=!!t,r=this.renderFormOnly(e,t);return`
      <div class="modal-header">
        <h2>${a?"Bearbeiten":n.title}</h2>
        <button type="button" class="btn-close" aria-label="Schließen">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <form id="${e}-form" data-entity="${e}" data-entity-id="${t?.id||""}">
          ${r}
          <div class="form-actions">
            <button type="button" class="btn-secondary" onclick="this.closest('.modal-content').querySelector('.btn-close').click()">Abbrechen</button>
            <button type="submit" class="mdc-btn mdc-btn--create" data-variant="@create-prd.mdc" data-entity-label="${this.getEntityLabel(e)}" data-mode="${a?"update":"create"}">
              <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">${this.getCheckIcon()}</span>
              <span class="mdc-btn__spinner" aria-hidden="true">${this.getSpinnerIcon()}</span>
              <span class="mdc-btn__label">${a?"Aktualisieren":"Erstellen"}</span>
            </button>
          </div>
        </form>
      </div>
    `}renderFormOnly(e,t=null){const n=this.getFormConfig(e);if(!n)return"";const a=n.fields||[],r=new Set(["influencer","influencer_preis","ugc","ugc_preis","vor_ort_produktion","vor_ort_preis","ust_prozent","ust_betrag","deckungsbeitrag_prozent","deckungsbeitrag_betrag"]),i=[];let s=!1;for(const o of a){const l=t?t[o.name]:"",u=r.has(o.name);u&&!s&&(i.push('<div class="form-two-col">'),s=!0),!u&&s&&(i.push("</div>"),s=!1);let d=this.renderField(o,l);u&&(d=d.replace('<div class="form-field"','<div class="form-field form-field--half"')),i.push(d)}return s&&i.push("</div>"),`
      <form id="${e}-form" data-entity="${e}" data-entity-id="${t?.id||t?._entityId||""}" data-is-edit-mode="${t?._isEditMode?"true":"false"}">
        ${i.join("")}
        <div class="form-actions">
          <button type="button" class="btn-secondary" onclick="window.navigateTo('/${e}')">Abbrechen</button>
          <button type="submit" class="mdc-btn mdc-btn--create" data-variant="@create-prd.mdc" data-entity-label="${this.getEntityLabel(e)}" data-mode="${t?"update":"create"}">
            <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">${this.getCheckIcon()}</span>
            <span class="mdc-btn__spinner" aria-hidden="true">${this.getSpinnerIcon()}</span>
            <span class="mdc-btn__label">${t?"Aktualisieren":"Erstellen"}</span>
          </button>
        </div>
      </form>
    `}renderField(e,t=""){const n=`field-${e.name}`,a=e.required?"required":"",r=e.required?'<span class="required">*</span>':"";switch(e.type){case"text":case"email":case"tel":case"url":const i=e.dependsOn?`data-depends-on="${e.dependsOn}"`:"",s=e.showWhen?`data-show-when="${e.showWhen}"`:"",o=e.autoGenerate?'data-auto-generate="true"':"",l=e.readonly?"readonly":"",u=e.placeholder?`placeholder="${e.placeholder}"`:"",d=e.dependsOn?'style="display: none;"':"";return`
          <div class="form-field" ${i} ${s} ${d}>
            <label for="${n}">${e.label} ${r}</label>
            <input type="${e.type}" id="${n}" name="${e.name}" value="${this.validator.sanitizeHtml(t)}" ${a} ${o} ${l} ${u}>
            ${e.autoGenerate?'<small style="color: #6b7280; font-size: 12px;">Wird automatisch generiert</small>':""}
          </div>
        `;case"number":const c=e.readonly?"readonly":"",m=e.autoCalculate?'data-auto-calculate="true"':"",h=e.calculatedFrom?`data-calculated-from="${e.calculatedFrom.join(",")}"`:"",p=e.placeholder?`placeholder="${e.placeholder}"`:"",g=e.validation?.min!==void 0?`min="${e.validation.min}"`:"",b=e.validation?.max!==void 0?`max="${e.validation.max}"`:"",y=e.validation?.step!==void 0?`step="${e.validation.step}"`:'step="0.01"',w=e.defaultValue!==void 0&&(t===""||t===void 0||t===null)?`value="${e.defaultValue}"`:`value="${t}"`;return`
          <div class="form-field">
            <label for="${n}">${e.label} ${r}</label>
            <input type="number" id="${n}" name="${e.name}" ${w} ${a} ${c} ${m} ${h} ${p} ${g} ${b} ${y}>
            ${e.readonly&&e.calculatedFrom?'<small style="color: #6b7280; font-size: 12px;">Wird automatisch berechnet</small>':""}
          </div>
        `;case"date":return`
          <div class="form-field">
            <label for="${n}">${e.label} ${r}</label>
            <input type="date" id="${n}" name="${e.name}" value="${t}" ${a}>
          </div>
        `;case"textarea":const v=e.dependsOn?`data-depends-on="${e.dependsOn}"`:"",k=e.showWhen?`data-show-when="${e.showWhen}"`:"";return`
          <div class="form-field form-field-full" ${v} ${k}>
            <label for="${n}">${e.label} ${r}</label>
            <textarea id="${n}" name="${e.name}" rows="4" ${a}>${this.validator.sanitizeHtml(t)}</textarea>
          </div>
        `;case"select":let _="";if(e.dynamic?_=`<option value="">${e.dependsOn?`Erst ${this.getFieldLabel(e.dependsOn)} auswählen...`:e.placeholder||"Bitte wählen..."}</option>`:(_=`<option value="">${e.placeholder||"Bitte wählen..."}</option>`,_+=e.options.map(M=>{if(typeof M=="string")return`<option value="${M}" ${t===M?"selected":""}>${M}</option>`;if(M&&typeof M=="object"&&M.value!==void 0){const H=t===M.value?"selected":"";return`<option value="${M.value}" ${H}>${M.label||M.value}</option>`}return""}).join("")),e.searchable){const T=e.dependsOn?"disabled":"",M=e.readonly?"disabled":T,H=e.dependsOn?`Erst ${this.getFieldLabel(e.dependsOn)} auswählen...`:e.placeholder||"Bitte wählen...",O=[];e.table&&O.push(`data-table="${e.table}"`),e.displayField&&O.push(`data-display-field="${e.displayField}"`),e.valueField&&O.push(`data-value-field="${e.valueField}"`);const Be=O.join(" ");return`
            <div class="form-field">
              <label for="${n}">${e.label} ${r}</label>
              <select id="${n}" name="${e.name}" ${a} ${M} data-searchable="true" data-placeholder="${H}" ${e.readonly?'data-readonly="true"':""} ${Be}>
                ${_}
              </select>
              ${e.readonly?`<input type="hidden" name="${e.name}" id="${n}-hidden" value="">`:""}
            </div>
          `}const S=e.dependsOn?"disabled":"",E=e.readonly?"disabled":S,$=[];e.table&&$.push(`data-table="${e.table}"`),e.displayField&&$.push(`data-display-field="${e.displayField}"`),e.valueField&&$.push(`data-value-field="${e.valueField}"`);const L=$.join(" ");return`
          <div class="form-field">
            <label for="${n}">${e.label} ${r}</label>
            <select id="${n}" name="${e.name}" ${a} ${E} ${e.readonly?'data-readonly="true"':""} ${L}>
              ${_}
            </select>
            ${e.readonly?`<input type="hidden" name="${e.name}" id="${n}-hidden" value="">`:""}
          </div>
        `;case"multiselect":const F=Array.isArray(t)?t:t?t.split(","):[];let N="";if(e.dynamic||(N=e.options.map(T=>{const M=F.includes(T)?"selected":"";return`<option value="${T}" ${M}>${T}</option>`}).join("")),e.searchable){const T=F.length>0?`data-existing-values='${JSON.stringify(F)}'`:"";return`
            <div class="form-field">
              <label for="${n}">${e.label} ${r}</label>
              <select id="${n}" name="${e.name}" ${a} multiple data-searchable="true" data-tag-based="${e.tagBased||"false"}" data-placeholder="${e.placeholder||"Bitte wählen..."}" ${T}>
                ${N}
              </select>
            </div>
          `}return`
          <div class="form-field">
            <label for="${n}">${e.label} ${r}</label>
            <select id="${n}" name="${e.name}" ${a} multiple>
              ${N}
            </select>
          </div>
        `;case"checkbox":const q=t==="on"||t===!0||t==="true"?"checked":"";return`
          <div class="form-field">
            <label class="toggle-container">
              <span>${e.label} ${r}</span>
              <div class="toggle-switch">
                <input type="checkbox" id="${n}" name="${e.name}" ${q} ${a}>
                <span class="toggle-slider"></span>
              </div>
            </label>
          </div>
        `;case"toggle":const U=t==="on"||t===!0||t==="true"||t===1?"checked":"";return`
          <div class="form-field">
            <label class="toggle-container">
              <span>${e.label} ${r}</span>
              <div class="toggle-switch">
                <input type="checkbox" id="${n}" name="${e.name}" ${U} ${a}>
                <span class="toggle-slider"></span>
              </div>
            </label>
          </div>
        `;case"phone":return new ct(e,t).render();case"custom":if(e.customType==="addresses")return this.renderAddressesField(e,t);if(e.customType==="videos")return this.renderVideosField(e,t);if(e.customType==="file"){const T=e.accept?`accept="${e.accept}"`:"",M=e.multiple?"multiple":"";return`
            <div class="form-field">
              <label for="${n}">${e.label} ${r}</label>
              <input type="file" id="${n}" name="${e.name}" ${a} ${T} ${M}>
            </div>
          `}if(e.customType==="uploader"){const T=`uploader-${e.name}-${Math.random().toString(36).slice(2)}`;return setTimeout(()=>{const M=document.getElementById(T);M&&new lt({multiple:!!e.multiple,accept:e.accept||"*/*"}).mount(M.querySelector(".uploader"))},0),`
            <div class="form-field" id="${T}">
              <label>${e.label} ${r}</label>
              <div class="uploader" data-name="${e.name}"></div>
            </div>
          `}return`<div class="form-field">Unbekannter Feldtyp: ${e.customType}</div>`;default:return`<div class="form-field">Unbekannter Feldtyp: ${e.type}</div>`}}getCheckIcon(){return`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
  <path d="M9 16.17l-3.88-3.88a1 1 0 10-1.41 1.41l4.59 4.59a1 1 0 001.41 0l10-10a1 1 0 10-1.41-1.41L9 16.17z"/>
</svg>`}getSpinnerIcon(){return`
<svg class="mdc-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="16" height="16">
  <circle class="mdc-spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"/>
</svg>`}getEntityLabel(e){switch(e){case"kampagne":return"Kampagne";case"auftrag":return"Auftrag";case"creator":return"Creator";case"marke":return"Marke";case"unternehmen":return"Unternehmen";case"briefing":return"Briefing";case"kooperation":return"Kooperation";case"rechnung":return"Rechnung";case"ansprechpartner":return"Ansprechpartner";default:return"Eintrag"}}renderAddressesField(e,t=""){const n=`field-${e.name}`,a=e.dependsOn?`data-depends-on="${e.dependsOn}"`:"",r=e.showWhen?`data-show-when="${e.showWhen}"`:"";return`
      <div class="form-field form-field-full" ${a} ${r}>
        <label for="${n}" style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">${e.label}</label>
        <div class="addresses-container" id="${n}">
          <div class="addresses-list" style="margin-bottom: 16px;">
            <!-- Adressen werden hier dynamisch hinzugefügt -->
          </div>
          <button type="button" class="btn btn-secondary btn-sm add-address-btn" style="
            background: #6b7280;
            color: white;
            border: none;
            border-radius: 6px;
            padding: 8px 16px;
            cursor: pointer;
            font-size: 14px;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: background-color 0.2s;
          " onmouseover="this.style.background='#4b5563'" onmouseout="this.style.background='#6b7280'">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 16px; height: 16px;">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
            Adresse hinzufügen
          </button>
        </div>
      </div>
    `}renderVideosField(e,t=""){const n=`field-${e.name}`,a=Array.isArray(e.options)?e.options:[],r=this.validator.sanitizeHtml(JSON.stringify(a));return`
      <div class="form-field form-field-full">
        <label for="${n}" class="form-label">${e.label}</label>
        <div class="videos-container" id="${n}" data-options='${r}'>
          <div class="videos-list videos-grid"></div>
        </div>
      </div>
    `}addAddressRow(e){const t=`address-${Date.now()}`,n=`
      <div class="address-item" data-address-id="${t}" style="
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
        background: #f9fafb;
      ">
        <div class="address-header" style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        ">
          <h4 style="margin: 0; font-size: 16px; font-weight: 600; color: #374151;">Adresse ${t}</h4>
          <button type="button" class="btn-remove-address" onclick="this.closest('.address-item').remove()" style="
            background: #ef4444;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 4px 8px;
            cursor: pointer;
            font-size: 12px;
            transition: background-color 0.2s;
          " onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='#ef4444'">
            Entfernen
          </button>
        </div>
        <div class="address-fields" style="
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        ">
          <div class="form-field" style="grid-column: 1 / -1;">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Adressname</label>
            <input type="text" name="adressname_${t}" placeholder="z.B. Hauptbüro, Filiale, etc." 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Straße</label>
            <input type="text" name="strasse_${t}" placeholder="Musterstraße" 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Hausnummer</label>
            <input type="text" name="hausnummer_${t}" placeholder="123" 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">PLZ</label>
            <input type="text" name="plz_${t}" placeholder="12345" 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Stadt</label>
            <input type="text" name="stadt_${t}" placeholder="Musterstadt" 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Land</label>
            <input type="text" name="land_${t}" placeholder="Deutschland" 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field" style="grid-column: 1 / -1;">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Notiz</label>
            <textarea name="notiz_${t}" rows="2" placeholder="Zusätzliche Informationen" 
                      style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; resize: vertical;"></textarea>
          </div>
        </div>
      </div>
    `;e.insertAdjacentHTML("beforeend",n)}getFormConfig(e){return null}}class ut{constructor(){this.validator=window.validatorSystem||{sanitizeHtml:e=>e||"",validateForm:(e,t)=>({isValid:!0,errors:{}})}}validateFormData(e,t){const n=[],a=this.getFormConfig(e);return a&&a.fields.forEach(r=>{if(r.required&&(!t[r.name]||t[r.name].toString().trim()==="")&&n.push(`${r.label} ist erforderlich.`),r.validation&&t[r.name]){const i=t[r.name],s=this.validateField(r,i);n.push(...s)}}),n}validateField(e,t){const n=[];if(!e.validation)return n;switch(e.validation.type){case"text":e.validation.minLength&&t.length<e.validation.minLength&&n.push(`${e.label} muss mindestens ${e.validation.minLength} Zeichen lang sein.`),e.validation.maxLength&&t.length>e.validation.maxLength&&n.push(`${e.label} darf maximal ${e.validation.maxLength} Zeichen lang sein.`);break;case"number":const a=parseFloat(t);isNaN(a)?n.push(`${e.label} muss eine Zahl sein.`):(e.validation.min!==void 0&&a<e.validation.min&&n.push(`${e.label} muss mindestens ${e.validation.min} sein.`),e.validation.max!==void 0&&a>e.validation.max&&n.push(`${e.label} darf maximal ${e.validation.max} sein.`));break;case"email":/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)||n.push(`${e.label} muss eine gültige E-Mail-Adresse sein.`);break;case"url":try{new URL(t)}catch{n.push(`${e.label} muss eine gültige URL sein.`)}break;case"phone":/^[\+]?[0-9\s\-\(\)]{10,}$/.test(t)||n.push(`${e.label} muss eine gültige Telefonnummer sein.`);break}return n}sanitizeHtml(e){return e?e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#x27;"):""}showValidationErrors(e){if(document.querySelectorAll(".field-error").forEach(t=>t.remove()),e.forEach(t=>{const n=this.extractFieldNameFromError(t);if(n){const a=document.querySelector(`[name="${n}"]`);if(a){const r=document.createElement("div");r.className="field-error",r.textContent=t,r.style.cssText=`
            color: #dc2626;
            font-size: 12px;
            margin-top: 4px;
          `,a.parentNode.appendChild(r)}}}),e.length>0){const t=e.join(`
`);alert(`Validierungsfehler:
${t}`)}}extractFieldNameFromError(e){const t=["vorname","nachname","firmenname","kampagnenname","auftragsname","markenname"];for(const n of t)if(e.toLowerCase().includes(n))return n;return null}showSuccessMessage(e){console.log(`✅ ${e}`)}showErrorMessage(e){console.error(`❌ ${e}`),alert(e)}getFormConfig(e){return null}}class ue{async autoGenerateKampagnenname(e,t){try{if(!t)return;console.log(`🔧 Generiere Kampagnenname für Auftrag: ${t}`);const{data:n,error:a}=await window.supabase.from("auftrag").select(`
          *,
          unternehmen:unternehmen_id(firmenname),
          marke:marke_id(markenname)
        `).eq("id",t).single();if(a||!n){console.error("❌ Fehler beim Laden des Auftrags:",a);return}const{data:r,error:i}=await window.supabase.from("kampagne").select("id").eq("auftrag_id",t);if(i){console.error("❌ Fehler beim Zählen der Kampagnen:",i);return}const o=r.length+1,l=n.kampagnenanzahl||1,u=e.querySelector('input[name="deadline"]'),d=u?u.value:"";let m=`${n.unternehmen?.firmenname||"Unbekannte Firma"} - ${o}/${l}`;if(d){const g=new Date(d).toLocaleDateString("de-DE");m+=` - ${g}`}const h=e.querySelector('input[name="kampagnenname"]');h&&(h.value=m,h.dispatchEvent(new Event("input",{bubbles:!0})),h.dispatchEvent(new Event("change",{bubbles:!0})),h.focus(),h.blur(),console.log(`✅ Kampagnenname generiert: ${m}`),console.log(`🔍 Feld-Wert nach Setzen: "${h.value}"`))}catch(n){console.error("❌ Fehler beim Generieren des Kampagnennamens:",n)}}async autoGenerateKooperationsname(e){try{const t=e.querySelector('select[name="kampagne_id"]'),n=e.querySelector('select[name="creator_id"]'),a=e.querySelector('input[name="name"]');if(!t||!n||!a)return;const r=t.value,i=n.value;if(!r||!i)return;const{data:s,error:o}=await window.supabase.from("kampagne").select("id, creatoranzahl").eq("id",r).single();if(o||!s){console.error("❌ Fehler beim Laden der Kampagne für Kooperation:",o);return}const{data:l,error:u}=await window.supabase.from("kooperationen").select("id").eq("kampagne_id",r);if(u){console.error("❌ Fehler beim Zählen der Kooperationen:",u);return}const d=(l?.length||0)+1,c=s.creatoranzahl||1,{data:m,error:h}=await window.supabase.from("creator").select("vorname, nachname, instagram").eq("id",i).single();if(h||!m){console.error("❌ Fehler beim Laden des Creators:",h);return}const b=`${`${m.vorname||""} ${m.nachname||""}`.trim()||(m.instagram?`@${m.instagram}`:"Creator")} ${d}/${c}`;a.value=b,a.dispatchEvent(new Event("input",{bubbles:!0})),a.dispatchEvent(new Event("change",{bubbles:!0})),a.focus(),a.blur(),console.log(`✅ Kooperationsname generiert: ${b}`)}catch(t){console.error("❌ Fehler beim Generieren des Kooperationsnamens:",t)}}setupAutoGeneration(e){const t=e.querySelector('input[name="deadline"]');t&&t.addEventListener("change",()=>{const s=e.querySelector('select[name="auftrag_id"]');s&&s.value&&this.autoGenerateKampagnenname(e,s.value)});const n=e.querySelector('select[name="auftrag_id"]');n&&(n.addEventListener("change",()=>{n.value&&this.autoGenerateKampagnenname(e,n.value)}),n.value&&this.autoGenerateKampagnenname(e,n.value));const a=e.querySelector(".searchable-select-container, .tag-based-select");if(a){const s=a.querySelector(".searchable-select-input");if(s){let o;s.addEventListener("input",()=>{clearTimeout(o),o=setTimeout(()=>{const u=a.querySelector('select[style*="display: none"]');u&&u.value&&this.autoGenerateKampagnenname(e,u.value)},300)});const l=a.querySelector('select[style*="display: none"]');l&&l.value&&this.autoGenerateKampagnenname(e,l.value)}}const r=e.querySelector('select[name="kampagne_id"]'),i=e.querySelector('select[name="creator_id"]');if(r&&i){const s=()=>this.autoGenerateKooperationsname(e);r.addEventListener("change",s),i.addEventListener("change",s),r.value&&i.value&&this.autoGenerateKooperationsname(e);const o=l=>{const u=l.previousElementSibling;if(u&&u.classList.contains("searchable-select-container")){const d=u.querySelector(".searchable-select-input");if(d){let c;d.addEventListener("input",()=>{clearTimeout(c),c=setTimeout(()=>this.autoGenerateKooperationsname(e),300)})}}};o(r),o(i)}}}class me{constructor(){this.calculationRules={deckungsbeitrag_betrag:this.calculateDeckungsbeitragBetrag.bind(this),ust_betrag:this.calculateUstBetrag.bind(this),bruttobetrag:this.calculateBruttobetrag.bind(this),brutto_gesamt_budget:this.calculateBruttoGesamtBudget.bind(this),ksk_betrag:this.calculateKskBetrag.bind(this),nettobetrag:this.calculateNettoFromItems.bind(this),creator_budget:this.calculateCreatorBudget.bind(this)}}initializeAutoCalculation(e){if(!e)return;console.log("🔧 Initialisiere Auto-Calculation für Formular");const t=e.querySelectorAll("[data-calculated-from]"),n=e.querySelectorAll('[data-auto-calculate="true"]');n.forEach(r=>{r.addEventListener("input",i=>{this.handleFieldChange(e,i.target)}),r.addEventListener("change",i=>{this.handleFieldChange(e,i.target)})}),e.querySelectorAll('input[type="number"]').forEach(r=>{r.addEventListener("input",i=>{this.recalculateAllDependentFields(e)}),r.addEventListener("change",i=>{this.recalculateAllDependentFields(e)})}),console.log(`✅ Auto-Calculation initialisiert für ${t.length} berechnete Felder und ${n.length} Trigger-Felder`)}handleFieldChange(e,t){console.log(`🔄 Feld geändert: ${t.name} = ${t.value}`),this.recalculateAllDependentFields(e)}recalculateAllDependentFields(e){e.querySelectorAll("[data-calculated-from]").forEach(n=>{const a=n.name;if(this.calculationRules[a]){const r=this.calculationRules[a](e,n);r!=null&&(n.value=r,console.log(`💰 ${a} neu berechnet: ${r}`))}})}calculateDeckungsbeitragBetrag(e,t){try{const n=e.querySelector('[name="deckungsbeitrag_prozent"]'),a=e.querySelector('[name="nettobetrag"]');if(!n||!a)return console.warn("⚠️ Erforderliche Felder für Deckungsbeitrag-Berechnung nicht gefunden"),0;const r=parseFloat(n.value)||0,i=parseFloat(a.value)||0;if(r===0||i===0)return 0;const s=i*(r/100);return console.log(`💰 Deckungsbeitrag berechnet: ${i}€ * ${r}% = ${s}€`),Math.round(s*100)/100}catch(n){return console.error("❌ Fehler bei Deckungsbeitrag-Berechnung:",n),0}}calculateUstBetrag(e,t){try{const n=e.querySelector('[name="nettobetrag"]');if(!n)return 0;const a=parseFloat(n.value)||0,r=e.querySelector('[name="ust_prozent"]'),i=r&&parseFloat(r.value)||19,s=a*(i/100);return Math.round(s*100)/100}catch(n){return console.error("❌ Fehler bei USt-Berechnung:",n),0}}calculateBruttobetrag(e,t){return this.calculateBruttoGesamtBudget(e,t)}calculateBruttoGesamtBudget(e,t){try{const n=e.querySelector('[name="nettobetrag"]'),a=e.querySelector('[name="ust_betrag"]'),r=n&&parseFloat(n.value)||0,i=a?parseFloat(a.value)||this.calculateUstBetrag(e):this.calculateUstBetrag(e),s=r+i;return Math.round(s*100)/100}catch(n){return console.error("❌ Fehler bei Brutto-Berechnung:",n),0}}calculateKskBetrag(e,t){try{const n=e.querySelector('[name="nettobetrag"]');if(!n)return 0;const r=(parseFloat(n.value)||0)*.05;return Math.round(r*100)/100}catch(n){return console.error("❌ Fehler bei KSK-Berechnung:",n),0}}calculateNettoFromItems(e,t){try{const n=d=>{const c=e.querySelector(`[name="${d}"]`);return c&&parseFloat(c.value)||0},a=n("influencer"),r=n("influencer_preis"),i=n("ugc"),s=n("ugc_preis"),o=n("vor_ort_produktion"),l=n("vor_ort_preis"),u=a*r+i*s+o*l;return u>0?Math.round(u*100)/100:null}catch(n){return console.error("❌ Fehler bei Netto-Berechnung aus Items:",n),0}}calculateCreatorBudget(e,t){try{const n=o=>e.querySelector(`[name="${o}"]`),a=parseFloat(n("nettobetrag")?.value||"0")||0;let r=parseFloat(n("ksk_betrag")?.value||"0");(!r||r===0)&&(r=Math.round(a*.05*100)/100);let i=parseFloat(n("deckungsbeitrag_betrag")?.value||"0");if(!i||i===0){const o=parseFloat(n("deckungsbeitrag_prozent")?.value||"0")||0;i=Math.round(a*(Math.min(Math.max(o,0),100)/100)*100)/100}const s=Math.max(0,a-r-i);return Math.round(s*100)/100}catch(n){return console.error("❌ Fehler bei Creator-Budget-Berechnung:",n),0}}formatCurrency(e){return!e||isNaN(e)?"0,00":new Intl.NumberFormat("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2}).format(e)}validatePercentage(e){const t=parseFloat(e);return isNaN(t)||t<0?0:t>100?100:t}}new me;document.addEventListener("DOMContentLoaded",()=>{console.log("🔧 AutoCalculation Modul geladen")});class he{constructor(e){this.autoGeneration=e,this.dynamicDataLoader=null,this.formEventHandlers=new Map}setupDependentFields(e){if(e.dataset.entityType==="kampagne"&&e.dataset.isEditMode==="true"){console.log("🎯 DEPENDENTFIELDS: Überspringe Setup für Kampagne Edit-Mode - DynamicDataLoader übernimmt");return}e.querySelectorAll("[data-depends-on]").forEach(a=>{const r=a.dataset.dependsOn,i=a.dataset.showWhen,s=e.querySelector(`[name="${r}"]`);if(s){const o=()=>{const l=s.value;console.log(`🔍 Prüfe abhängiges Feld: ${r} = "${l}", showWhen = "${i}"`);let u=!1;if(s.tagName==="SELECT"){const c=s.selectedOptions[0],m=c?c.textContent:"";u=i?m.includes(i):!!l,console.log(`🔍 Select-Feld: "${m}" enthält "${i}" = ${u}`)}else u=i?l===i||l.includes(i):!!l;const d=a.closest(".form-field");d&&(d.style.display=u?"block":"none",console.log(`🔍 Feld ${a.dataset.dependsOn} ${u?"angezeigt":"versteckt"}`),u&&a.dataset.autoGenerate==="true"&&this.autoGeneration.autoGenerateKampagnenname(e,l))};s.addEventListener("change",o),o()}}),this.setupFormDelegation(e)}setupFormDelegation(e){if(e.dataset.entityType==="kampagne"&&e.dataset.isEditMode==="true"){console.log("🎯 DEPENDENTFIELDS: Überspringe Delegation Setup für Kampagne Edit-Mode");return}const n=e.dataset.entity,a=this.getFormConfig(n);if(!a||!a.fields)return;const r=new Map;a.fields.forEach(l=>{l.dependsOn&&(r.has(l.dependsOn)||r.set(l.dependsOn,[]),r.get(l.dependsOn).push(l))}),console.log("🗺️ DELEGATION: Dependency Map:",Object.fromEntries(r));const i=new Map;a.fields.forEach(l=>{const u=e.querySelector(`[name="${l.name}"]`);u&&i.set(l.name,u)});const s=new Map,o=async l=>{const u=l.target,d=u.name;if(r.has(d)){s.has(d)&&clearTimeout(s.get(d));const c=setTimeout(async()=>{const m=r.get(d),h=this.getFieldValue(u);console.log(`🔄 DELEGATION: ${d} → "${h}", ${m.length} abhängige Felder`);for(const p of m){const g=i.get(p.name);g&&(h?await this.loadDependentFieldData(g,p,h,e):await this.clearDependentField(g,p))}s.delete(d)},150);s.set(d,c)}};if(this.formEventHandlers.has(e)){const l=this.formEventHandlers.get(e);e.removeEventListener("change",l,!0)}e.addEventListener("change",o,!0),this.formEventHandlers.set(e,o),setTimeout(()=>{const l=e.dataset.isEditMode==="true";r.forEach((u,d)=>{const c=i.get(d);if(!c)return;const m=this.getFieldValue(c);u.forEach(async h=>{const p=i.get(h.name);if(!p)return;const g=this.getFieldValue(p);m?await this.loadDependentFieldData(p,h,m,e):l&&g?console.log(`📝 DELEGATION: Edit-Mode, behalte ${h.name}`):await this.clearDependentField(p,h)})})},300)}cleanup(e){if(this.formEventHandlers&&this.formEventHandlers.has(e)){const t=this.formEventHandlers.get(e);e.removeEventListener("change",t,!0),this.formEventHandlers.delete(e),console.log("🗑️ DEPENDENTFIELDS: Event Listeners entfernt für Form")}}getFieldValue(e){console.log("🔍 getFieldValue für Feld:",e.name);const t=e.value;console.log("📋 Original Select Wert:",t);const n=e.nextElementSibling;if(n&&(n.classList.contains("searchable-select-container")||n.classList.contains("tag-based-select"))){console.log("🔍 Searchable Select Container gefunden für:",e.name);const r=n.querySelector('select[style*="display: none"]');if(r&&r.id.endsWith("_hidden")){if(console.log("📦 Verstecktes Multi-Select gefunden:",r.id),r.selectedOptions.length>0){const i=r.selectedOptions[0].value;return console.log("✅ Wert aus verstecktem Multi-Select:",i),i}return console.log("⚠️ Verstecktes Multi-Select hat keine Auswahl"),""}if(t)return console.log("✅ Wert aus Original Select (Searchable):",t),t}const a=e.parentNode.querySelector('select[style*="display: none"]');if(a&&a!==e){const r=a.value;return console.log("📦 Wert aus verstecktem Select (Parent):",r),r}return console.log("✅ Standard Wert:",t),t}clearDependentField(e,t){if(console.log(`🧹 Leere abhängiges Feld: ${t.name}`),t.type==="multiselect"&&t.tagBased){console.log(`🏷️ Spezielle Behandlung für Tag-basiertes Multi-Select: ${t.name}`);const i=e.closest(".form-field")?.querySelector(".tag-based-select");if(i){const s=i.querySelector(".searchable-select-input");s&&(s.value="",s.placeholder=`Erst ${this.getFieldLabel(t.dependsOn)} auswählen...`,s.disabled=!0);const o=i.querySelector(".tags-container");o&&(o.innerHTML="",o.style.display="none");const l=i.querySelector(".searchable-select-dropdown");l&&(l.style.display="none");const u=i.querySelector('select[style*="display: none"]');u&&(u.innerHTML="")}e.innerHTML='<option value="">Bitte wählen...</option>',e.value="",e.disabled=!0;return}const a=`Erst ${{unternehmen_id:"Unternehmen",marke_id:"Marke",kampagne_id:"Kampagne",auftrag_id:"Auftrag"}[t.dependsOn]||t.dependsOn} auswählen...`,r=e.closest(".searchable-select-container, .tag-based-select");if(r){const i=r.querySelector(".searchable-select-input");i&&(i.value="",i.placeholder=a);const s=r.querySelector(".tags-container");s&&(s.innerHTML="")}e.innerHTML=`<option value="">${a}</option>`,e.value="",e.disabled=!0}async loadDependentFieldData(e,t,n,a){if(!this.dynamicDataLoader){console.error("❌ DynamicDataLoader nicht verfügbar");return}console.log(`🔄 Lade Daten für ${t.name} basierend auf ${t.dependsOn}:`,n),this.showLoadingState(e,t);try{if((t.name==="marke_id"||t.name==="marke_ids")&&t.dependsOn==="unternehmen_id"){const{data:r,error:i}=await window.supabase.from("marke").select("id, markenname").eq("unternehmen_id",n).order("markenname");if(i){console.error("❌ Fehler beim Laden der Marken:",i);return}const s=r.map(o=>({value:o.id,label:o.markenname}));if(console.log(`✅ ${s.length} Marken geladen für Unternehmen ${n}`),s.length===0){const o="Dieses Unternehmen hat keine Marke.";this.setNoOptionsState(e,t,o),await this.loadAuftraegeForUnternehmen(n,a,{disableMarke:!0,message:o});return}if(e.disabled=!1,t.name==="marke_ids"&&t.tagBased){const o=e.closest(".form-field")?.querySelector(".tag-based-select");if(o){const l=o.querySelector(".searchable-select-input");l&&(l.disabled=!1,l.placeholder=t.placeholder||"Marken suchen und hinzufügen...");try{o.dataset.options=JSON.stringify(s)}catch{}}await this.updateTagBasedMultiSelectOptions(e,t,s)}else this.updateDependentFieldOptions(e,t,s)}if(t.name==="auftrag_id"&&t.dependsOn==="marke_id"){const{data:r,error:i}=await window.supabase.from("auftrag").select("id, auftragsname").eq("marke_id",n).order("auftragsname");if(i){console.error("❌ Fehler beim Laden der Aufträge:",i);return}const s=r.map(o=>({value:o.id,label:o.auftragsname}));console.log(`✅ ${s.length} Aufträge geladen für Marke ${n}`),e.disabled=!1,this.updateDependentFieldOptions(e,t,s)}if(t.name==="auftrag_id"&&t.dependsOn==="unternehmen_id"){const{data:r,error:i}=await window.supabase.from("auftrag").select("id, auftragsname").eq("unternehmen_id",n).order("auftragsname");if(i){console.error("❌ Fehler beim Laden der Aufträge für Unternehmen:",i);return}const s=r.map(o=>({value:o.id,label:o.auftragsname}));console.log(`✅ ${s.length} Aufträge direkt für Unternehmen ${n} geladen`),e.disabled=!1,this.updateDependentFieldOptions(e,t,s)}if(t.name==="kampagne_id"&&t.dependsOn==="marke_id"){const{data:r,error:i}=await window.supabase.from("kampagne").select("id, kampagnenname, marke_id, videoanzahl").eq("marke_id",n).order("kampagnenname");if(i){console.error("❌ Fehler beim Laden der Kampagnen für Marke:",i);return}let s=r||[];try{const l=s.map(u=>u.id);if(l.length>0){const{data:u,error:d}=await window.supabase.from("kooperationen").select("kampagne_id, videoanzahl").in("kampagne_id",l);if(!d&&u){const c={};u.forEach(m=>{const h=m.kampagne_id,p=parseInt(m.videoanzahl,10)||0;c[h]=(c[h]||0)+p}),s=s.filter(m=>{const h=parseInt(m.videoanzahl,10)||0,p=c[m.id]||0;return Math.max(0,h-p)>0})}}}catch(l){console.warn("⚠️ Fehler beim Filtern der Kampagnen:",l)}const o=s.map(l=>({value:l.id,label:l.kampagnenname}));console.log(`✅ ${o.length} Kampagnen geladen für Marke ${n}`),e.disabled=!1,this.updateDependentFieldOptions(e,t,o)}else if(t.name==="kampagne_id"&&t.dependsOn==="unternehmen_id"){const{data:r,error:i}=await window.supabase.from("kampagne").select("id, kampagnenname, unternehmen_id, videoanzahl").eq("unternehmen_id",n).order("kampagnenname");if(i){console.error("❌ Fehler beim Laden der Kampagnen für Unternehmen:",i);return}let s=r||[];try{const l=s.map(u=>u.id);if(l.length>0){const{data:u,error:d}=await window.supabase.from("kooperationen").select("kampagne_id, videoanzahl").in("kampagne_id",l);if(!d&&u){const c={};u.forEach(m=>{const h=m.kampagne_id,p=parseInt(m.videoanzahl,10)||0;c[h]=(c[h]||0)+p}),s=s.filter(m=>{const h=parseInt(m.videoanzahl,10)||0,p=c[m.id]||0;return Math.max(0,h-p)>0})}}}catch(l){console.warn("⚠️ Konnte belegte Videos nicht überprüfen, zeige alle Kampagnen:",l)}const o=s.map(l=>({value:l.id,label:l.kampagnenname||"Unbenannte Kampagne"}));e.disabled=!1,this.updateDependentFieldOptions(e,t,o)}if(t.name==="creator_id"&&t.dependsOn==="kampagne_id")try{const{data:r,error:i}=await window.supabase.from("creator").select("id, vorname, nachname, instagram").order("vorname");if(i){console.error("❌ Fehler beim Laden aller Creator:",i);return}const s=(r||[]).map(o=>{const u=`${o.vorname||""} ${o.nachname||""}`.trim()||(o.instagram?`@${o.instagram}`:`Creator ${o.id}`);return{value:o.id,label:u}});e.disabled=!1,this.updateDependentFieldOptions(e,t,s)}catch(r){console.error("❌ Fehler beim Laden aller Creator:",r)}if(t.name==="briefing_id"&&t.dependsOn==="kampagne_id")try{const{data:r,error:i}=await window.supabase.from("briefings").select("id, product_service_offer, kampagne_id").eq("kampagne_id",n).order("created_at",{ascending:!1});if(i){console.error("❌ Fehler beim Laden der Briefings für Kampagne:",i);return}const s=(r||[]).map(o=>({value:o.id,label:o.product_service_offer||`Briefing ${o.id.slice(0,6)}`}));e.disabled=!1,this.updateDependentFieldOptions(e,t,s)}catch(r){console.error("❌ Unerwarteter Fehler beim Laden der Briefings:",r)}if(t.name==="ansprechpartner_id"&&t.dependsOn==="unternehmen_id"){const{data:r,error:i}=await window.supabase.from("ansprechpartner").select("id, vorname, nachname, email, unternehmen_id").eq("unternehmen_id",n).order("nachname");if(i){console.error("❌ Fehler beim Laden der Ansprechpartner für Unternehmen:",i);return}const s=(r||[]).map(o=>({value:o.id,label:[o.vorname,o.nachname,o.email].filter(Boolean).join(" | ")}));if(s.length===0){this.setNoOptionsState(e,t,"Dieses Unternehmen hat keine Ansprechpartner.");return}this.enableSearchableField(e,t),this.updateDependentFieldOptions(e,t,s)}}catch(r){console.error("❌ Fehler beim Laden der abhängigen Daten:",r),this.showErrorState(e,t)}finally{this.hideLoadingState(e)}}async loadAuftraegeForUnternehmen(e,t,n={}){try{const{disableMarke:a=!1,message:r="Keine Marken verfügbar"}=n,{data:i,error:s}=await window.supabase.from("auftrag").select("id, auftragsname, marke_id").eq("unternehmen_id",e).order("auftragsname");if(s){console.error("❌ Fehler beim Laden der Aufträge für Unternehmen:",s);return}if(i.length>0){console.log(`✅ ${i.length} Aufträge direkt für Unternehmen ${e} gefunden`);const o=t.querySelector('[name="auftrag_id"]');if(o){const l=i.map(u=>({value:u.id,label:u.auftragsname}));o.disabled=!1,this.updateDependentFieldOptions(o,{name:"auftrag_id"},l)}}else console.log(`⚠️ Keine Aufträge für Unternehmen ${e} gefunden`);if(a){const o=t.querySelector('[name="marke_id"]');if(o){const l=r;o.innerHTML=`<option value="">${l}</option>`,o.value="",o.disabled=!0;const u=o.closest(".searchable-select-container");if(u){const d=u.querySelector(".searchable-select-input");d&&(d.value="",d.placeholder=l,d.disabled=!0);const c=u.querySelector(".searchable-select-dropdown");c&&(c.innerHTML=`<div class="dropdown-item no-results">${l}</div>`)}}}}catch(a){console.error("❌ Fehler beim Laden der Aufträge für Unternehmen:",a)}}resetCascadeFields(e,t){console.log("🔄 Setze Kaskaden-Felder zurück:",t),t.forEach(n=>{const a=e.querySelector(`[name="${n}"]`);if(a){a.value="",a.disabled=!0;const r=a.closest(".searchable-select-container, .tag-based-select");if(r){const s=r.querySelector(".searchable-select-input");s&&(s.value="",s.placeholder=`Erst ${this.getFieldLabel(n.replace("_id",""))} auswählen...`);const o=r.querySelector(".tags-container");o&&(o.innerHTML="")}const i=`Erst ${this.getFieldLabel(n.replace("_id",""))} auswählen...`;a.innerHTML=`<option value="">${i}</option>`}})}getFieldLabel(e){return{unternehmen:"Unternehmen",unternehmen_id:"Unternehmen",marke:"Marke",marke_id:"Marke",marke_ids:"Marke",auftrag:"Auftrag",auftrag_id:"Auftrag",kampagne:"Kampagne",kampagne_id:"Kampagne"}[e]||e}updateDependentFieldOptions(e,t,n){console.log(`🔄 Aktualisiere Optionen für ${t.name} mit ${n.length} Optionen`),e.innerHTML='<option value="">Bitte wählen...</option>',n.forEach(r=>{const i=document.createElement("option");i.value=r.value,i.textContent=r.label,e.appendChild(i)});const a=e.nextElementSibling;if(a&&(a.classList.contains("searchable-select-container")||a.classList.contains("tag-based-select"))){console.log(`✅ Searchable Select Container gefunden für ${t.name}`);const r=a.querySelector(".searchable-select-input");r&&(r.disabled=!1,r.placeholder=t.placeholder||"Suchen...",r.readOnly=!1,console.log(`✅ Input-Feld aktiviert für ${t.name}`))}this.dynamicDataLoader&&this.dynamicDataLoader.updateSelectOptions&&this.dynamicDataLoader.updateSelectOptions(e,n,t),console.log(`✅ Optionen erfolgreich aktualisiert für ${t.name}`)}async updateTagBasedMultiSelectOptions(e,t,n){console.log(`🏷️ Aktualisiere Tag-basierte Multi-Select Optionen für ${t.name}:`,n);const a=e.closest(".form-field");if(!a){console.warn("❌ Kein Form-Field Container gefunden");return}const r=new Set,i=a.querySelector(".tag-based-select");if(i){i.querySelectorAll(".tag").forEach(l=>{const u=l.dataset?.value;u&&r.add(u)});const o=i.querySelector('select[style*="display: none"]');o&&Array.from(o.selectedOptions).forEach(l=>{l.value&&r.add(l.value)})}console.log("🔍 Bestehende ausgewählte Werte:",Array.from(r)),e.innerHTML='<option value="">Bitte wählen...</option>',n.forEach(s=>{const o=document.createElement("option");o.value=s.value,o.textContent=s.label,e.appendChild(o)}),window.formSystem?.optionsManager?.createTagBasedSelect?(window.formSystem.optionsManager.createTagBasedSelect(e,n,t),console.log(`✅ Tag-basierte Multi-Select Optionen für ${t.name} vollständig aktualisiert`)):console.warn(`⚠️ OptionsManager nicht verfügbar für ${t.name}`)}setNoOptionsState(e,t,n){const a=e.closest(".searchable-select-container, .tag-based-select");if(a){const r=a.querySelector(".searchable-select-input");r&&(r.value="",r.placeholder=n,r.disabled=!0);const i=a.querySelector(".searchable-select-dropdown");i&&(i.innerHTML=`<div class="dropdown-item no-results">${n}</div>`)}e.innerHTML=`<option value="">${n}</option>`,e.value="",e.disabled=!0}enableSearchableField(e,t){e.disabled=!1;const n=e.closest(".searchable-select-container, .tag-based-select");if(n){const a=n.querySelector(".searchable-select-input");a&&(a.disabled=!1,a.placeholder=t.placeholder||"Suchen...");const r=n.querySelector(".searchable-select-dropdown");r&&(r.innerHTML="")}}showLoadingState(e,t){const n=e.nextElementSibling;if(n&&n.classList.contains("searchable-select-container")){const r=n.querySelector(".searchable-select-input");r&&(r.disabled=!0,r.placeholder="Lädt...",r.classList.add("loading"))}const a=e.closest(".form-field")?.querySelector(".tag-based-select");if(a){const r=a.querySelector(".searchable-select-input");r&&(r.disabled=!0,r.placeholder="Lädt...",r.classList.add("loading"))}}hideLoadingState(e){const t=e.nextElementSibling;if(t&&t.classList.contains("searchable-select-container")){const a=t.querySelector(".searchable-select-input");a&&a.classList.remove("loading")}const n=e.closest(".form-field")?.querySelector(".tag-based-select");if(n){const a=n.querySelector(".searchable-select-input");a&&a.classList.remove("loading")}}showErrorState(e,t){const n=e.nextElementSibling;if(n&&n.classList.contains("searchable-select-container")){const r=n.querySelector(".searchable-select-input");r&&(r.placeholder="Fehler beim Laden",r.classList.add("error"),setTimeout(()=>{r.classList.remove("error"),r.placeholder=t.placeholder||"Bitte wählen..."},3e3))}const a=e.closest(".form-field")?.querySelector(".tag-based-select");if(a){const r=a.querySelector(".searchable-select-input");r&&(r.placeholder="Fehler beim Laden",r.classList.add("error"),setTimeout(()=>{r.classList.remove("error"),r.placeholder=t.placeholder||"Bitte wählen..."},3e3))}}}class Y{async handleRelationTables(e,t,n,a){try{const r=this.getFormConfig(e);if(!r)return;let i=[];r.sections?r.sections.forEach(s=>{i=i.concat(s.fields)}):i=r.fields;for(const s of i)if(s.relationTable&&s.relationField){const o=n[s.name];o&&await this.handleRelationTable(t,s,o)}}catch(r){console.error("❌ Fehler beim Verarbeiten der Verknüpfungstabellen:",r)}}async handleRelationTable(e,t,n){try{const a=t.relationTable,r=t.relationField;let i;t.name==="mitarbeiter_ids"?i=a==="auftrag_mitarbeiter"?"auftrag_id":"kampagne_id":t.name==="cutter_ids"&&a==="auftrag_cutter"||t.name==="copywriter_ids"&&a==="auftrag_copywriter"||t.name==="mitarbeiter_ids"&&a==="auftrag_mitarbeiter"?i="auftrag_id":t.name==="plattform_ids"||t.name==="format_ids"?i="kampagne_id":t.name==="branche_id"&&t.relationTable==="unternehmen_branchen"?i="unternehmen_id":t.name==="marke_ids"||t.name==="sprachen_ids"?i="ansprechpartner_id":i=`${t.name.replace("_ids","_id")}`;const{error:s}=await window.supabase.from(a).delete().eq(i,e);if(s)throw console.error("❌ Fehler beim Löschen bestehender Verknüpfungen:",s),s;let o=[];if(Array.isArray(n)?o=n:typeof n=="string"&&n.includes(",")?o=n.split(",").map(l=>l.trim()).filter(Boolean):n&&(o=[n]),o.length>0){let l=r;t.name==="sprachen_ids"?l="sprache_id":t.name==="marke_ids"?l="marke_id":(t.name==="mitarbeiter_ids"&&a==="auftrag_mitarbeiter"||t.name==="cutter_ids"&&a==="auftrag_cutter"||t.name==="copywriter_ids"&&a==="auftrag_copywriter")&&(l="mitarbeiter_id");const u=o.map(d=>({[i]:e,[l]:d}));try{const{error:d}=await window.supabase.from(a).insert(u);if(d){if(String(d.code)==="42P01"){console.warn(`⚠️ Relationstabelle ${a} existiert nicht. Überspringe Inserts.`);return}throw console.error("❌ Fehler beim Einfügen neuer Verknüpfungen:",d),d}}catch(d){if(String(d.code)==="42P01"){console.warn(`⚠️ Relationstabelle ${a} existiert nicht. Überspringe Inserts.`);return}throw d}console.log(`✅ ${o.length} Verknüpfungen in ${a} erstellt`)}console.log(`✅ Verknüpfungstabelle ${a} aktualisiert für ${e}`)}catch(a){console.error(`❌ Fehler beim Verarbeiten der Verknüpfungstabelle ${t.relationTable}:`,a)}}getFormConfig(e){return null}}const mt=Object.freeze(Object.defineProperty({__proto__:null,RelationTables:Y},Symbol.toStringTag,{value:"Module"}));class ht{constructor(e){this.formSystem=e}async bindFormEvents(e,t){const n=document.getElementById(`${e}-form`);if(!n)return;n.dataset.entity=e,t&&t._isEditMode?(console.log("🎯 FORMEVENTS: Edit-Mode erkannt, setze Kontext für DynamicDataLoader"),console.log("📋 FORMEVENTS: Edit-Mode Daten:",{entityId:t._entityId,unternehmenId:t.unternehmen_id,brancheId:t.branche_id,totalFields:Object.keys(t).length}),n.dataset.editModeData=JSON.stringify(t),n.dataset.isEditMode="true",n.dataset.entityType=e,n.dataset.entityId=t._entityId,t.unternehmen_id&&(n.dataset.existingUnternehmenId=t.unternehmen_id,console.log("🏢 FORMEVENTS: Unternehmen-ID für Edit-Mode gesetzt:",t.unternehmen_id)),t.branche_id&&(n.dataset.existingBrancheId=t.branche_id,console.log("🏷️ FORMEVENTS: Branche-ID für Edit-Mode gesetzt:",t.branche_id))):console.log("ℹ️ FORMEVENTS: Kein Edit-Mode erkannt oder keine Daten verfügbar"),n.onsubmit=async r=>{r.preventDefault();const i=n.querySelector(".mdc-btn.mdc-btn--create");if(!i){await this.formSystem.handleFormSubmit(e,t,n);return}if(i.dataset.locked==="true")return;i.dataset.locked="true";const s=i.querySelector(".mdc-btn__label")?.textContent||"",o=i.querySelector(".mdc-btn__label"),l=i.getAttribute("data-mode")||(t?"update":"create"),u=i.getAttribute("data-entity-label")||"Eintrag";i.classList.add("is-loading"),o&&(o.textContent=l==="update"?"Wird aktualisiert…":"Wird angelegt…");const d=Date.now(),c=await this.formSystem.handleFormSubmit(e,t,n),m=Date.now()-d;if(n.isConnected){if(c&&c.success===!1){i.classList.remove("is-loading"),i.dataset.locked="false",o&&(o.textContent=s);return}i.classList.remove("is-loading"),i.classList.add("is-success"),o&&(o.textContent=l==="update"?"Aktualisiert":`${u} angelegt`),setTimeout(()=>{i.dataset.locked="false"},Math.max(400,900-m))}};const a=n.querySelector(".btn-close");a&&(a.onclick=()=>this.formSystem.closeForm()),await this.formSystem.dataLoader.loadDynamicFormData(e,n),this.initializeSearchableSelects(n),this.formSystem.dependentFields.setupDependentFields(n),this.setupAddressesFields(n),this.setupVideosFields(n),this.formSystem.autoGeneration.setupAutoGeneration(n),this.formSystem.autoCalculation.initializeAutoCalculation(n),this.setupEntitySpecificEvents(e,n)}setupEntitySpecificEvents(e,t){switch(e){case"auftrag":this.setupAuftragEvents(t);break;case"kampagne":this.setupKampagneEvents(t);break;case"kooperation":this.setupKooperationEvents(t);break;case"rechnung":this.setupRechnungEvents(t);break}}setupAuftragEvents(e){const t=e.querySelector('input[name="bruttobetrag"]'),n=e.querySelector('input[name="deckungsbeitrag_prozent"]'),a=e.querySelector('input[name="deckungsbeitrag_betrag"]');if(t&&n&&a){const r=()=>{const i=parseFloat(t.value)||0,s=parseFloat(n.value)||0,o=i*s/100;a.value=o.toFixed(2)};t.addEventListener("input",r),n.addEventListener("input",r)}}setupKampagneEvents(e){const t=e.querySelector('select[name="auftrag_id"]'),n=e.querySelector('input[name="videoanzahl"]'),a=e.querySelector('input[name="creatoranzahl"]');if(!t||!n||!window.supabase)return;(()=>{n.dataset.stepperAttached!=="true"&&(console.log("🎯 FORMEVENTS: Erstelle Video-Stepper"),this.createStepperUI(n,"Video","Videos"),n.dataset.stepperAttached="true"),a&&a.dataset.stepperAttached!=="true"&&(console.log("🎯 FORMEVENTS: Erstelle Creator-Stepper"),this.createStepperUI(a,"Creator","Creator"),a.dataset.stepperAttached="true")})();const i=()=>{this.updateStepperUI(n,"Video","Videos",e),a&&this.updateStepperUI(a,"Creator","Creator",e)},s=(l,u,d)=>{const c=parseInt(l,10);return isNaN(c)||d===0?"":String(Math.max(u,Math.min(c,d)))},o=async()=>{const l=t.value;if(!l){n.disabled=!0,n.removeAttribute("max"),n.removeAttribute("min"),n.value="",i();return}try{const{data:u,error:d}=await window.supabase.from("auftrag").select("id, gesamtanzahl_videos").eq("id",l).single();if(d){console.error("❌ Fehler beim Laden des Auftrags (gesamtanzahl_videos):",d);return}const{data:c,error:m}=await window.supabase.from("auftrag_details").select("gesamt_videos, gesamt_creator").eq("auftrag_id",l).maybeSingle(),h=parseInt(c?.gesamt_videos||u?.gesamtanzahl_videos,10)||0;let p=window.supabase.from("kampagne").select("id, videoanzahl, creatoranzahl").eq("auftrag_id",l);const g=e.dataset.entityId||null;g&&(p=p.neq("id",g));const{data:b,error:y}=await p;if(y){console.error("❌ Fehler beim Laden der Kampagnen (videoanzahl, creatoranzahl):",y);return}const w=(b||[]).reduce((E,$)=>E+(parseInt($.videoanzahl,10)||0),0),v=(b||[]).reduce((E,$)=>E+(parseInt($.creatoranzahl,10)||0),0),k=Math.max(0,h-w),_=parseInt(c?.gesamt_creator,10)||0,S=Math.max(0,_-v);n.disabled=k===0,n.min=k>0?"1":"0",n.max=String(k),n.step="1",n.value?n.value=s(n.value,k>0?1:0,k):k>0&&(n.value="1"),a&&(_>0?(a.disabled=S===0,a.min=S>0?"1":"0",a.max=String(S),a.step="1",a.value?a.value=s(a.value,S>0?1:0,S):S>0&&(a.value="1"),this.showAvailabilityInfo(a,S,_,v,"Creator")):(a.disabled=!1,a.removeAttribute("max"),a.removeAttribute("min"),this.hideAvailabilityInfo(a))),this.showAvailabilityInfo(n,k,h,w,"Videos"),i()}catch(u){console.error("❌ Fehler beim Aktualisieren der Kampagnen-Video-Limits:",u)}};t.addEventListener("change",o),n.addEventListener("change",()=>{const l=parseInt(n.max||"0",10)||0;l>0&&(n.value=s(n.value,1,l)),i()}),e.addEventListener("submit",async l=>{const u=t.value;if(u)try{const{data:d}=await window.supabase.from("auftrag").select("id, gesamtanzahl_videos").eq("id",u).single(),{data:c}=await window.supabase.from("auftrag_details").select("gesamt_videos, gesamt_creator").eq("auftrag_id",u).maybeSingle(),m=parseInt(c?.gesamt_videos||d?.gesamtanzahl_videos,10)||0;let h=window.supabase.from("kampagne").select("videoanzahl").eq("auftrag_id",u);const p=e.dataset.entityId||null;p&&(h=h.neq("id",p));const{data:g}=await h,b=(g||[]).reduce((v,k)=>v+(parseInt(k.videoanzahl,10)||0),0),y=Math.max(0,m-b),w=parseInt(n.value||"0",10)||0;console.log("🔍 Submit-Guard Validierung:",{totalVideos:m,usedVideos:b,remaining:y,desired:w,auftragsDetails:!!c,source:c?"auftrag_details":"auftrag"}),w>y&&(l.preventDefault(),n.value=s(n.value,y>0?1:0,y),alert(`Die gewählte Video Anzahl (${w}) überschreitet die verfügbaren Videos (${y} von ${m} verfügbar).`),i())}catch{}}),o()}async setupRechnungEvents(e){const t=e.querySelector('select[name="kooperation_id"]');if(!t||!window.supabase)return;const n=e.querySelector('select[name="unternehmen_id"]'),a=e.querySelector('select[name="auftrag_id"]'),r=e.querySelector('select[name="creator_id"]'),i=e.querySelector('select[name="kampagne_id"]'),s=e.querySelector('input[name="videoanzahl"]'),o=e.querySelector('input[name="nettobetrag"]'),l=e.querySelector('input[name="zusatzkosten"]');e.querySelector('input[name="ust"]');const u=e.querySelector('input[name="bruttobetrag"]');[n,a,r,i].forEach(m=>{if(m){const h=m.parentNode.querySelector(".searchable-select-container");if(h){const p=h.querySelector(".searchable-select-input");p&&p.placeholder&&m.setAttribute("data-original-placeholder",p.placeholder)}}});const d=(m,h,p)=>{if(!m)return;m.innerHTML="";const g=document.createElement("option");g.value=h||"",g.textContent=p||"—",m.appendChild(g),m.value=h||"",m.disabled=!0;const b=m.parentNode.querySelector(".searchable-select-container");if(b){const w=b.querySelector(".searchable-select-input");w&&(w.value=p||"",m.getAttribute("data-readonly")==="true"&&(w.setAttribute("disabled","true"),w.classList.add("is-disabled")),w.hasAttribute("data-was-required")&&(h&&h.trim()!==""?w.setCustomValidity(""):w.setCustomValidity("Dieses Feld ist erforderlich.")))}const y=document.getElementById(`${m.id}-hidden`);y&&(y.value=h||"")},c=async()=>{const m=t.value;if(!m){[{field:a,placeholder:"Auftrag wählen..."},{field:n,placeholder:"Unternehmen wählen..."},{field:i,placeholder:"Kampagne wählen..."},{field:r,placeholder:"Creator wählen..."}].forEach(({field:S,placeholder:E})=>{if(S){S.disabled=!1,S.setAttribute("data-readonly","false"),S.innerHTML='<option value="">Bitte wählen...</option>';const $=S.parentNode.querySelector(".searchable-select-container");if($){const F=$.querySelector(".searchable-select-input");F&&(F.removeAttribute("disabled"),F.classList.remove("is-disabled"),F.value="",F.placeholder=E,F.hasAttribute("data-was-required")&&F.setCustomValidity("Dieses Feld ist erforderlich."))}S.getAttribute("data-table")&&window.formSystem&&window.formSystem.loadDynamicOptions(S)}}),s&&(s.value=""),o&&(o.value=""),l&&(l.value=""),u&&(u.value="");return}const{data:h,error:p}=await window.supabase.from("kooperationen").select("id, name, unternehmen_id, kampagne_id, nettobetrag, gesamtkosten, zusatzkosten, videoanzahl").eq("id",m).single();if(p){console.error("❌ Fehler beim Laden der Kooperation:",p);return}let g="";if(h?.unternehmen_id)try{const{data:_}=await window.supabase.from("unternehmen").select("id, firmenname").eq("id",h.unternehmen_id).single();g=_?.firmenname||""}catch{}d(n,h?.unternehmen_id||"",g);let b=null,y="";if(h?.kampagne_id)try{const{data:_}=await window.supabase.from("kampagne").select("auftrag_id").eq("id",h.kampagne_id).single();if(b=_?.auftrag_id||null,i){let S="";try{const{data:E}=await window.supabase.from("kampagne").select("id, kampagnenname").eq("id",h.kampagne_id).single();S=E?.kampagnenname||""}catch{}d(i,h.kampagne_id,S||`Kampagne ${h.kampagne_id}`)}if(b){const{data:S}=await window.supabase.from("auftrag").select("id, auftragsname").eq("id",b).single();y=S?.auftragsname||""}}catch(_){console.warn("⚠️ Konnte Auftrag über Kampagne nicht laden:",_)}if(d(a,b,y||(b?`Auftrag ${b}`:"")),!b&&a){console.warn("⚠️ Auftrag konnte nicht automatisch gesetzt werden. Feld wird für manuelle Auswahl freigeschaltet."),a.disabled=!1,a.setAttribute("data-readonly","false");const _=a.parentNode.querySelector(".searchable-select-container");if(_){const E=_.querySelector(".searchable-select-input");E&&(E.removeAttribute("disabled"),E.classList.remove("is-disabled"),E.placeholder="Auftrag wählen...",E.hasAttribute("data-was-required")&&E.setCustomValidity("Dieses Feld ist erforderlich."))}a.getAttribute("data-table")&&window.formSystem&&window.formSystem.loadDynamicOptions(a)}if(r)try{const{data:_}=await window.supabase.from("kooperationen").select("creator_id").eq("id",m).single(),S=_?.creator_id||null;let E="";if(S){const{data:$}=await window.supabase.from("creator").select("id, vorname, nachname").eq("id",S).single();E=$?`${$.vorname||""} ${$.nachname||""}`.trim():""}d(r,S,E)}catch(_){console.warn("⚠️ Konnte Creator nicht laden:",_)}s&&(s.value=h?.videoanzahl||"");const w=parseFloat(h?.nettobetrag||0)||0,v=parseFloat(h?.zusatzkosten||0)||0,k=h?.gesamtkosten!=null?h.gesamtkosten:w+v;o&&(o.value=w?String(w):""),l&&(l.value=v?String(v):""),u&&(u.value=isNaN(k)?"":String(k))};t.addEventListener("change",c),t.value||setTimeout(()=>c(),100),c()}setupKooperationEvents(e){const t=e.querySelector('select[name="kampagne_id"]'),n=e.querySelector('input[name="videoanzahl"]'),a=e.querySelector(".videos-container"),r=e.querySelector(".videos-list"),i=(()=>{try{return a?.dataset?.options?JSON.parse(a.dataset.options):[]}catch{return[]}})();if(!t||!n||!window.supabase)return;(()=>{if(n.dataset.stepperAttached==="true")return;try{n.type="hidden"}catch{n.style.display="none"}const d=document.createElement("div");d.className="number-stepper";const c=document.createElement("button");c.type="button",c.className="stepper-btn stepper-minus secondary-btn",c.textContent="-";const m=document.createElement("button");m.type="button",m.className="stepper-btn stepper-plus secondary-btn",m.textContent="+";const h=document.createElement("span");h.className="stepper-info",h.textContent="",n.parentNode.insertBefore(d,n.nextSibling),d.appendChild(c),d.appendChild(m),d.appendChild(h);const p=()=>({min:parseInt(n.min||"0",10)||0,max:parseInt(n.max||"0",10)||0}),g=w=>{const{min:v,max:k}=p(),_=parseInt(w||"0",10)||0;return k?String(Math.max(v,Math.min(_,k))):""},b=()=>{const{max:w}=p(),v=parseInt(n.value||"0",10)||0,k=Math.max(0,w-v),_=v===1?"Video":"Videos";h.textContent=w>0?`${v} ${_} | Rest: ${k}`:"Bitte zuerst Kampagne wählen",c.disabled=w===0||v<=(parseInt(n.min||"0",10)||0),m.disabled=w===0||v>=w},y=()=>{if(!r)return;const w=parseInt(n.value||"0",10)||0,v=r.querySelectorAll(".video-item").length;if(w>v)for(let k=0;k<w-v;k++)this.addVideoRow(r,i);else if(w<v)for(let k=0;k<v-w;k++){const _=r.querySelector(".video-item:last-of-type");_&&_.remove()}};c.addEventListener("click",()=>{const{min:w}=p(),v=parseInt(n.value||"0",10)||0,k=Math.max(w,v-1);n.value=g(String(k)),n.dispatchEvent(new Event("input",{bubbles:!0})),n.dispatchEvent(new Event("change",{bubbles:!0})),b(),y()}),m.addEventListener("click",()=>{const{max:w}=p(),v=parseInt(n.value||"0",10)||0,k=Math.min(w,v+1);n.value=g(String(k)),n.dispatchEvent(new Event("input",{bubbles:!0})),n.dispatchEvent(new Event("change",{bubbles:!0})),b(),y()}),n.addEventListener("input",()=>{n.value=g(n.value),b(),y()}),n.dataset.stepperAttached="true",b()})();const o=()=>{const d=n.parentNode.querySelector(".stepper-info"),c=n.parentNode.querySelector(".stepper-minus"),m=n.parentNode.querySelector(".stepper-plus"),h=parseInt(n.max||"0",10)||0,p=parseInt(n.min||"0",10)||0,g=parseInt(n.value||"0",10)||0,b=Math.max(0,h-g),y=g===1?"Video":"Videos";d&&(d.textContent=h>0?`${g} ${y} | Rest: ${b}`:"Bitte zuerst Kampagne wählen"),c&&(c.disabled=h===0||g<=p),m&&(m.disabled=h===0||g>=h)},l=(d,c,m)=>{const h=parseInt(d,10);return isNaN(h)||m===0?"":String(Math.max(c,Math.min(h,m)))},u=async()=>{const d=t.value;if(!d){n.disabled=!0,n.removeAttribute("max"),n.removeAttribute("min"),n.value="",o(),r&&(r.innerHTML="");return}try{const{data:c,error:m}=await window.supabase.from("kampagne").select("videoanzahl").eq("id",d).single();if(m){console.error("❌ Fehler beim Laden der Kampagne (videoanzahl):",m);return}const h=c?.videoanzahl||0,{data:p,error:g}=await window.supabase.from("kooperationen").select("videoanzahl").eq("kampagne_id",d);if(g){console.error("❌ Fehler beim Laden der Kooperationen (videoanzahl):",g);return}const b=(p||[]).reduce((v,k)=>v+(parseInt(k.videoanzahl,10)||0),0),y=Math.max(0,h-b);n.disabled=y===0,n.min=y>0?"1":"0",n.max=String(y),n.step="1",n.value?n.value=l(n.value,1,y):y>0&&(n.value="1"),o();const w=parseInt(n.value||"0",10)||0;if(r){const v=r.querySelectorAll(".video-item").length;if(w!==v){const k=w-v;if(k>0)for(let _=0;_<k;_++)this.addVideoRow(r,i);else for(let _=0;_<Math.abs(k);_++){const S=r.querySelector(".video-item:last-of-type");S&&S.remove()}}}}catch(c){console.error("❌ Fehler beim Aktualisieren der Video-Limits:",c)}};t.addEventListener("change",u),n.addEventListener("change",async()=>{const d=parseInt(n.max||"0",10)||0;if(d>0&&(n.value=l(n.value,1,d)),o(),r){const c=parseInt(n.value||"0",10)||0,m=r.querySelectorAll(".video-item").length;if(c!==m){const h=c-m;if(h>0)for(let p=0;p<h;p++)this.addVideoRow(r,i);else for(let p=0;p<Math.abs(h);p++){const g=r.querySelector(".video-item:last-of-type");g&&g.remove()}}}}),e.addEventListener("submit",async d=>{const c=t.value;if(c)try{const{data:m}=await window.supabase.from("kampagne").select("videoanzahl").eq("id",c).single(),h=m?.videoanzahl||0,{data:p}=await window.supabase.from("kooperationen").select("videoanzahl").eq("kampagne_id",c),g=(p||[]).reduce((w,v)=>w+(parseInt(v.videoanzahl,10)||0),0),b=Math.max(0,h-g);(parseInt(n.value||"0",10)||0)>b&&(d.preventDefault(),n.value=l(n.value,b>0?1:0,b),alert("Die gewählte Video Anzahl überschreitet die verfügbaren Videos dieser Kampagne."),o())}catch{}}),u(),(async()=>{try{const d=e.dataset.entityId;if(!d||!window.supabase||!r)return;const{data:c,error:m}=await window.supabase.from("kooperation_videos").select("id, content_art, titel, asset_url, kommentar, position").eq("kooperation_id",d).order("position",{ascending:!0});if(m)return;(c||[]).forEach(h=>this.addVideoRow(r,i,h)),n.value=String((c||[]).length||""),o()}catch{}})()}initializeSearchableSelects(e){console.log("⚠️ FormEvents.initializeSearchableSelects deaktiviert - wird vom Haupt-FormSystem übernommen")}setupAddressesFields(e){e.querySelectorAll(".addresses-container").forEach(n=>{const a=n.querySelector(".add-address-btn"),r=n.querySelector(".addresses-list");a&&r&&a.addEventListener("click",()=>{this.addAddressRow(r)})})}setupVideosFields(e){}addVideoRow(e,t=[],n={}){const a=`video-${Date.now()}`,r=['<option value="">Bitte wählen</option>'].concat(t.map(s=>`<option value="${s}" ${n.content_art===s?"selected":""}>${s}</option>`)).join(""),i=`
      <div class="video-item video-item-compact" data-video-id="${a}">
        <label class="sr-only">Content Art</label>
        <select name="video_content_art_${a}" class="video-content-select">
          ${r}
        </select>
      </div>`;e.insertAdjacentHTML("beforeend",i)}addAddressRow(e){const t=`address-${Date.now()}`,n=`
      <div class="address-item" data-address-id="${t}" style="
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
        background: #f9fafb;
      ">
        <div class="address-header" style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        ">
          <h4 style="margin: 0; font-size: 16px; font-weight: 600; color: #374151;">Adresse ${t}</h4>
          <button type="button" class="btn-remove-address" onclick="this.closest('.address-item').remove()" style="
            background: #ef4444;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 4px 8px;
            cursor: pointer;
            font-size: 12px;
            transition: background-color 0.2s;
          " onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='#ef4444'">
            Entfernen
          </button>
        </div>
        <div class="address-fields" style="
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        ">
          <div class="form-field" style="grid-column: 1 / -1;">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Adressname</label>
            <input type="text" name="adressname_${t}" placeholder="z.B. Hauptbüro, Filiale, etc." 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Straße</label>
            <input type="text" name="strasse_${t}" placeholder="Musterstraße" 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Hausnummer</label>
            <input type="text" name="hausnummer_${t}" placeholder="123" 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">PLZ</label>
            <input type="text" name="plz_${t}" placeholder="12345" 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Stadt</label>
            <input type="text" name="stadt_${t}" placeholder="Musterstadt" 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Land</label>
            <input type="text" name="land_${t}" placeholder="Deutschland" 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field" style="grid-column: 1 / -1;">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Notiz</label>
            <textarea name="notiz_${t}" rows="2" placeholder="Zusätzliche Informationen" 
                      style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; resize: vertical;"></textarea>
          </div>
        </div>
      </div>
    `;e.insertAdjacentHTML("beforeend",n)}showAvailabilityInfo(e,t,n,a,r){this.hideAvailabilityInfo(e);const i=document.createElement("div");i.className="availability-info",i.innerHTML=`
      <div class="availability-text">
        <span class="available">${t} ${r} verfügbar</span>
        <span class="total">von ${n} geplant (${a} bereits verplant)</span>
      </div>
      ${t===0?'<div class="availability-warning">Keine weiteren verfügbar</div>':""}
    `,e.parentNode.insertBefore(i,e.nextSibling)}hideAvailabilityInfo(e){const t=e.parentNode.querySelector(".availability-info");t&&t.remove()}createStepperUI(e,t,n){try{e.type="hidden"}catch{e.style.display="none"}const a=document.createElement("div");a.className="number-stepper";const r=document.createElement("button");r.type="button",r.className="stepper-btn stepper-minus secondary-btn",r.textContent="-";const i=document.createElement("button");i.type="button",i.className="stepper-btn stepper-plus secondary-btn",i.textContent="+";const s=document.createElement("span");s.className="stepper-info",e.parentNode.insertBefore(a,e.nextSibling),a.appendChild(r),a.appendChild(i),a.appendChild(s);const o=()=>({min:parseInt(e.min||"0",10)||0,max:parseInt(e.max||"0",10)||0}),l=d=>{const c=parseInt(d,10);if(isNaN(c))return"";const{min:m,max:h}=o();return h===0?"":String(Math.max(m,Math.min(c,h)))},u=()=>{const{max:d}=o(),c=parseInt(e.value||"0",10)||0,m=Math.max(0,d-c),h=c===1?t:n;s.textContent=d>0?`${c} ${h} | Rest: ${m}`:"Bitte zuerst Auftrag wählen",r.disabled=d===0||c<=o().min,i.disabled=d===0||c>=d};r.addEventListener("click",()=>{const{min:d}=o(),c=parseInt(e.value||"0",10)||0,m=Math.max(d,c-1);e.value=l(String(m)),e.dispatchEvent(new Event("input",{bubbles:!0})),e.dispatchEvent(new Event("change",{bubbles:!0})),u()}),i.addEventListener("click",()=>{const{max:d}=o(),c=parseInt(e.value||"0",10)||0,m=Math.min(d,c+1);e.value=l(String(m)),e.dispatchEvent(new Event("input",{bubbles:!0})),e.dispatchEvent(new Event("change",{bubbles:!0})),u()}),e.addEventListener("input",()=>{e.value=l(e.value),u()}),u()}updateStepperUI(e,t,n,a){const r=e.parentNode.querySelector(".stepper-info"),i=e.parentNode.querySelector(".stepper-minus"),s=e.parentNode.querySelector(".stepper-plus");if(!r||!i||!s)return;const o=parseInt(e.max||"0",10)||0,l=parseInt(e.min||"0",10)||0,u=parseInt(e.value||"0",10)||0,d=Math.max(0,o-u),c=u===1?t:n;a?.dataset?.isEditMode==="true"&&a?.dataset?.entityType==="kampagne"&&o===0?r.textContent=`${u} ${c} | Kein Auftrag zugeordnet`:r.textContent=o>0?`${u} ${c} | Rest: ${d}`:"Bitte zuerst Auftrag wählen",i.disabled=o===0||u<=l,s.disabled=o===0||u>=o}}class pt{constructor(e=1440*60*1e3){this.cache=new Map,this.maxAge=e,this.loading=new Map,console.log("📦 StaticDataCache initialisiert (Max Age:",e/1e3/60,"Minuten)")}async get(e,t="*",n="sort_order"){const a=`${e}_${t}`,r=this.cache.get(a);if(r&&Date.now()-r.timestamp<this.maxAge)return console.log(`✅ Cache HIT für ${e} (Alter: ${Math.round((Date.now()-r.timestamp)/1e3)}s)`),r.data;if(this.loading.has(a))return console.log(`⏳ Warte auf laufenden Request für ${e}...`),await this.loading.get(a);console.log(`📥 Cache MISS für ${e} - lade von DB...`);const i=this._loadFromDB(e,t,n);this.loading.set(a,i);try{const s=await i;return this.cache.set(a,{data:s,timestamp:Date.now()}),console.log(`✅ ${e} geladen und gecached (${s.length} Einträge)`),s}finally{this.loading.delete(a)}}async _loadFromDB(e,t,n){try{let a=window.supabase.from(e).select(t);n&&(a=a.order(n));const{data:r,error:i}=await a;if(i)throw i;return r||[]}catch(a){return console.error(`❌ Fehler beim Laden von ${e}:`,a),n&&a.message?.includes("sort_order")?(console.log(`⚠️ Retry ohne ORDER BY für ${e}...`),await this._loadFromDB(e,t,null)):[]}}invalidate(e){let t=0;for(const n of this.cache.keys())n.startsWith(`${e}_`)&&(this.cache.delete(n),t++);t>0&&console.log(`🗑️ Cache invalidiert für ${e} (${t} Einträge)`)}clear(){const e=this.cache.size;this.cache.clear(),console.log(`🗑️ Kompletter Cache gelöscht (${e} Einträge)`)}getStats(){const e={size:this.cache.size,entries:[]};for(const[t,n]of this.cache.entries())e.entries.push({key:t,age:Math.round((Date.now()-n.timestamp)/1e3),count:n.data.length});return e}}window.staticDataCache||(window.staticDataCache=new pt,console.log("✅ Global StaticDataCache erstellt"));const gt=window.staticDataCache;class pe{constructor(){this.dataService=window.dataService,this.cache=gt}setDataService(e){this.dataService=e}async loadDynamicFormData(e,t){try{const n=this.getFormConfig(e);if(!n)return;const a=n.fields||[],r=[];for(const i of a)i.dynamic&&r.push(this.loadFieldOptions(e,i,t));r.push(this.loadPhoneFieldCountries(t)),console.log(`🚀 Lade ${r.length} Felder parallel...`),await Promise.all(r),console.log(`✅ Alle ${r.length} Felder geladen`)}catch(n){console.error("❌ Fehler beim Laden der dynamischen Formulardaten:",n)}}async loadPhoneFieldCountries(e){try{const t=e.querySelectorAll('select[data-phone-field="true"]');if(t.length===0){console.log("🔧 Keine Phone-Country-Selects gefunden");return}console.log(`🔧 Lade Länder für ${t.length} Phone-Fields`);const n=await this.cache.get("eu_laender","*","sort_order");if(!n||n.length===0){console.error("❌ Keine EU-Länder geladen");return}console.log(`✅ ${n.length} EU-Länder geladen (aus Cache)`),t.forEach(a=>{for(;a.options.length>1;)a.remove(1);n.forEach(r=>{const i=document.createElement("option");i.value=r.id,i.textContent=`${r.vorwahl} ${r.name_de}`,i.dataset.isoCode=r.iso_code,i.dataset.vorwahl=r.vorwahl,i.dataset.customProperties=JSON.stringify({isoCode:r.iso_code,vorwahl:r.vorwahl}),a.appendChild(i)})}),t.forEach(a=>{if(!a.value&&e.dataset.isEditMode!=="true"){const i=Array.from(a.options).find(s=>s.dataset.isoCode==="de");i&&(i.selected=!0,a.value=i.value)}const r=Array.from(a.options).slice(1).map(i=>({value:i.value,label:i.textContent,isoCode:i.dataset.isoCode,vorwahl:i.dataset.vorwahl}));if(this.createSearchableSelect){if(this.createSearchableSelect(a,r,{placeholder:a.dataset.placeholder||"Land wählen...",type:"phone"}),a.value){const i=r.find(s=>s.value===a.value);if(i){const s=a.nextElementSibling;if(s&&s.classList.contains("searchable-select-container")){const o=s.querySelector("input");o&&(o.value=i.label.replace(i.vorwahl,"").trim(),o.dataset.selectedIsoCode=i.isoCode);const l=s.querySelector(".phone-flag-icon");l&&i.isoCode&&(l.className=`phone-flag-icon fi fi-${i.isoCode.toLowerCase()}`,console.log(`🚩 Initial Flagge gesetzt: fi-${i.isoCode.toLowerCase()}`));const u=s.parentElement.querySelector(".phone-input-wrapper");if(u&&i.vorwahl){const d=u.querySelector(".phone-prefix"),c=u.querySelector(".phone-number-input");d&&c&&(d.textContent=i.vorwahl,d.style.display="inline-block",c.value.startsWith(i.vorwahl)&&(c.value=c.value.substring(i.vorwahl.length).trim()),c.dataset.vorwahl=i.vorwahl,console.log(`📱 Initiale Vorwahl im Span gesetzt: ${i.vorwahl}`))}}}}a.addEventListener("change",i=>{const s=i.target.value,o=r.find(l=>l.value===s);if(o){const l=a.nextElementSibling;if(l&&l.classList.contains("searchable-select-container")){const u=l.querySelector(".phone-flag-icon");u&&o.isoCode&&(u.className=`phone-flag-icon fi fi-${o.isoCode.toLowerCase()}`,console.log(`🚩 Flagge geändert zu: fi-${o.isoCode.toLowerCase()}`));const d=l.parentElement.querySelector(".phone-input-wrapper");if(d&&o.vorwahl){const c=d.querySelector(".phone-prefix"),m=d.querySelector(".phone-number-input");if(c&&m){c.textContent=o.vorwahl,c.style.display="inline-block";const h=m.dataset.vorwahl;h&&m.value.startsWith(h)&&(m.value=m.value.substring(h.length).trim()),m.dataset.vorwahl=o.vorwahl,console.log(`📱 Vorwahl im Span gesetzt: ${o.vorwahl} (nicht editierbar)`)}}}}})}})}catch(t){console.error("❌ Fehler beim Laden der Phone-Field-Länder:",t)}}async loadFieldOptions(e,t,n){try{if(this.dataService||(console.error("❌ DataService ist nicht verfügbar in DynamicDataLoader"),this.dataService=window.dataService),t.dependsOn){const i=n.dataset.entityType==="kampagne"&&n.dataset.isEditMode==="true",s=n.dataset.entityType==="ansprechpartner"&&n.dataset.isEditMode==="true";if(!i&&!s){console.log(`⏭️ Überspringe automatisches Laden für abhängiges Feld: ${t.name} (abhängig von ${t.dependsOn})`);return}else console.log(`🎯 Edit-Mode (${n.dataset.entityType}): Lade abhängiges Feld trotzdem: ${t.name}`)}let a=[];if(e==="rechnung"&&t.name==="kooperation_id")console.log("🔧 Lade Kooperationen ohne bestehende Rechnung für Rechnungsformular"),a=await this.loadKooperationenOhneRechnung(),console.log("✅ kooperation_id Optionen (ohne Rechnung):",a.length);else if(t.options&&Array.isArray(t.options)&&!t.dynamic)console.log(`🔧 Verwende statische Optionen für ${t.name}`),a=t.options.map(i=>typeof i=="string"?{value:i,label:i}:i&&typeof i=="object"?{value:i.value,label:i.label||i.value}:null).filter(Boolean),console.log(`✅ ${t.name} statische Optionen:`,a.length);else if(t.table)console.log(`🔧 Lade Daten direkt aus Tabelle ${t.table} für ${t.name}`),a=await this.loadDirectQueryOptions(t,n),console.log(`✅ ${t.name} Optionen geladen:`,a.length,a.slice(0,3));else switch(t.name){case"unternehmen_id":if(!window.supabase){a=(await this.dataService.loadEntities("unternehmen")).map(v=>({value:v.id,label:v.firmenname||"Unbekanntes Unternehmen"}));break}try{if(e==="kooperation"){const{data:w,error:v}=await window.supabase.from("kampagne").select("unternehmen_id").not("unternehmen_id","is",null);if(v){console.error("❌ Fehler beim Laden der Kampagnen-Unternehmen:",v);break}const k=Array.from(new Set((w||[]).map(E=>E.unternehmen_id).filter(Boolean))),{data:_,error:S}=await window.supabase.from("unternehmen").select("id, firmenname").in("id",k).order("firmenname");if(S){console.error("❌ Fehler beim Laden der Unternehmen:",S);break}a=(_||[]).map(E=>({value:E.id,label:E.firmenname||"Unbekanntes Unternehmen"}))}else if(e==="kampagne"){const{data:w,error:v}=await window.supabase.from("auftrag").select("unternehmen_id").not("unternehmen_id","is",null);if(v){console.error("❌ Fehler beim Laden der Auftrag-Unternehmen:",v);break}const k=Array.from(new Set((w||[]).map(E=>E.unternehmen_id).filter(Boolean))),{data:_,error:S}=await window.supabase.from("unternehmen").select("id, firmenname").in("id",k).order("firmenname");if(S){console.error("❌ Fehler beim Laden der Unternehmen:",S);break}a=(_||[]).map(E=>({value:E.id,label:E.firmenname||"Unbekanntes Unternehmen"}))}else if(e==="marke"){const{data:w,error:v}=await window.supabase.from("unternehmen").select("id, firmenname").order("firmenname");if(v){console.error("❌ Fehler beim Laden aller Unternehmen:",v);break}a=(w||[]).map(k=>({value:k.id,label:k.firmenname||"Unbekanntes Unternehmen"}))}else{const{data:w,error:v}=await window.supabase.from("unternehmen").select("id, firmenname").order("firmenname");if(v){console.error("❌ Fehler beim Laden aller Unternehmen:",v);break}a=(w||[]).map(k=>({value:k.id,label:k.firmenname||"Unbekanntes Unternehmen"}))}}catch(w){console.error("❌ Fehler beim Laden der Unternehmen (kontext-spezifisch):",w)}break;case"auftrag_id":a=(await this.dataService.loadEntities("auftrag")).map(w=>({value:w.id,label:w.auftragsname||"Unbekannter Auftrag"}));break;case"creator_id":a=(await this.dataService.loadEntities("creator")).map(w=>({value:w.id,label:`${w.vorname} ${w.nachname}`||"Unbekannter Creator"}));break;case"kampagne_id":a=(await this.dataService.loadEntities("kampagne")).map(w=>({value:w.id,label:w.kampagnenname||"Unbekannte Kampagne"}));break;case"creator_type_id":const{data:l,error:u}=await window.supabase.from("creator_type").select("id, name").order("name");!u&&l&&(a=l.map(w=>({value:w.id,label:w.name||"Unbekannter Typ"})),console.log("✅ Creator Types geladen:",a.length));break;case"branche_id":const{data:d,error:c}=await window.supabase.from("branchen").select("id, name, beschreibung").order("name");!c&&d&&(a=d.map(w=>({value:w.id,label:w.name||"Unbekannte Branche",description:w.beschreibung})),console.log("✅ Branchen geladen:",a.length));break;case"assignee_id":const{data:m,error:h}=await window.supabase.from("benutzer").select("id, name").order("name");h?console.error("❌ Fehler beim Laden der Benutzer:",h):m?(a=m.map(w=>({value:w.id,label:w.name||"Unbekannter Benutzer"})),console.log("✅ Benutzer geladen:",a.length,a)):console.warn("⚠️ Keine Benutzer gefunden");break;case"art_der_kampagne":const{data:p,error:g}=await window.supabase.from("kampagne_art_typen").select("id, name").order("sort_order, name");!g&&p&&(a=p.map(w=>({value:w.id,label:w.name||"Unbekannte Art"})),console.log("✅ Kampagne Art Typen geladen:",a.length));break;case"format_anpassung":const{data:b,error:y}=await window.supabase.from("format_anpassung_typen").select("id, name").order("sort_order, name");!y&&b&&(a=b.map(w=>({value:w.id,label:w.name||"Unbekanntes Format"})),console.log("✅ Format Anpassung Typen geladen:",a.length));break;case"mitarbeiter_ids":a=await this.loadBenutzerOptions();break;case"cutter_ids":a=await this.loadBenutzerOptions({role:"cutter"});break;case"copywriter_ids":a=await this.loadBenutzerOptions({role:"copywriter"});break;case"ansprechpartner_id":a=await this.loadAnsprechpartnerOptions(t,n);break;default:break}const r=n.querySelector(`[name="${t.name}"]`);if(r)if(console.log(`🔧 Update Select für ${t.name} mit ${a.length} Optionen`),r.dataset.tagBased==="true"&&t.tagBased&&r.multiple)if(console.log("🏷️ DYNAMICDATALOADER: Initialisiere Tag-basiertes Multi-Select:",t.name),r.innerHTML="",r.appendChild(new Option("","")),a.forEach(i=>{const s=new Option(i.label,i.value,i.selected,i.selected);r.appendChild(s)}),a.length>0&&window.formSystem?.optionsManager?.createTagBasedSelect){console.log("🏷️ DYNAMICDATALOADER: Erstelle Tag-System mit",a.length,"Optionen für:",t.name);const i=a.filter(s=>s.selected);console.log(`🎯 DYNAMICDATALOADER: Übergebe ${i.length} selected Optionen an createTagBasedSelect:`,i.map(s=>`${s.label} (${s.value})`)),window.formSystem.optionsManager.createTagBasedSelect(r,a,t),console.log("✅ DYNAMICDATALOADER: Tag-basiertes Multi-Select initialisiert für:",t.name)}else a.length===0?console.log("⏭️ DYNAMICDATALOADER: Keine Optionen für Tag-System verfügbar:",t.name):console.warn("⚠️ DYNAMICDATALOADER: OptionsManager nicht verfügbar für:",t.name);else this.updateSelectOptions(r,a,t);else console.log(`❌ Select-Element nicht gefunden für ${t.name}`)}catch(a){console.error(`❌ Fehler beim Laden der Optionen für ${t.name}:`,a)}}async loadKooperationenOhneRechnung(){if(!window.supabase)return[];try{const{data:e,error:t}=await window.supabase.from("rechnung").select("kooperation_id").not("kooperation_id","is",null);if(t)return console.error("❌ Fehler beim Laden vorhandener Rechnungen:",t),[];const n=Array.from(new Set((e||[]).map(o=>o.kooperation_id).filter(Boolean)));let a=window.supabase.from("kooperationen").select("id, name, kampagne_id").order("created_at",{ascending:!1});n.length>0&&(a=a.not("id","in",`(${n.join(",")})`));const{data:r,error:i}=await a;if(i)return console.error("❌ Fehler beim Laden der Kooperationen (ohne Rechnung):",i),[];let s={};try{const o=Array.from(new Set((r||[]).map(l=>l.kampagne_id).filter(Boolean)));if(o.length>0){const{data:l}=await window.supabase.from("kampagne").select("id, kampagnenname").in("id",o);s=(l||[]).reduce((u,d)=>(u[d.id]=d.kampagnenname,u),{})}}catch{}return(r||[]).map(o=>({value:o.id,label:o.name?`${o.name} ${o.kampagne_id?`— ${s[o.kampagne_id]||"Kampagne"}`:""}`:s[o.kampagne_id]||o.id}))}catch(e){return console.error("❌ Unerwarteter Fehler beim Laden der kooperation_id Optionen:",e),[]}}async loadDirectQueryOptions(e,t){try{if(!e.table)return console.warn("⚠️ Keine Tabelle für direktes Laden definiert:",e.name),[];const n=["eu_laender","positionen","sprachen","branchen","kampagne_status","plattform_typen","format_typen","format_anpassung_typen","kampagne_art_typen","drehort_typen","creator_type","mitarbeiter_klasse"];let a;if(n.includes(e.table)&&!e.filter)a=await this.cache.get(e.table,"*","sort_order"),console.log(`📦 ${e.table} aus Cache geladen (${a.length} Einträge)`);else{let i=window.supabase.from(e.table).select("*");e.table==="eu_laender"&&(i=i.order("sort_order",{ascending:!0})),e.filter&&i.or(e.filter);const s=await i;if(s.error)return console.error(`❌ Fehler beim Laden der Daten aus ${e.table}:`,s.error),[];a=s.data}const r=a.map(i=>{let s="Unbekannt";if(e.displayField)if(e.displayField.includes(",")){const u=e.displayField.split(",").map(d=>d.trim()).map(d=>i[d]).filter(Boolean);s=u.length>0?u.join(" "):"Unbekannt"}else s=i[e.displayField]||"Unbekannt";else s=i.name||"Unbekannt";const o={value:i[e.valueField||"id"],label:s,description:i.beschreibung||i.description};return e.table==="eu_laender"&&(o.isoCode=i.iso_code,o.vorwahl=i.vorwahl),o});if(t.dataset.isEditMode==="true"){if(console.log("🔍 DYNAMICDATALOADER: Edit-Modus erkannt für Feld:",e.name,{entityType:t.dataset.entityType,hasEditModeData:!!t.dataset.editModeData}),(t.dataset.entityType==="kampagne"||t.dataset.entityType==="auftrag")&&t.dataset.editModeData)try{const s=JSON.parse(t.dataset.editModeData);e.name==="unternehmen_id"&&s.unternehmen_id&&(r.forEach(l=>{l.value===s.unternehmen_id&&(l.selected=!0)}),console.log(`✅ DYNAMICDATALOADER: Kampagne ${e.name} vorausgewählt:`,s.unternehmen_id)),e.name==="marke_id"&&s.marke_id&&(r.forEach(l=>{l.value===s.marke_id&&(l.selected=!0)}),console.log(`✅ DYNAMICDATALOADER: Kampagne ${e.name} vorausgewählt:`,s.marke_id)),e.name==="auftrag_id"&&s.auftrag_id&&(r.forEach(l=>{l.value===s.auftrag_id&&(l.selected=!0)}),console.log(`✅ DYNAMICDATALOADER: Kampagne ${e.name} vorausgewählt:`,s.auftrag_id)),e.name==="status_id"&&s.status_id&&(r.forEach(l=>{l.value===s.status_id&&(l.selected=!0)}),console.log(`✅ DYNAMICDATALOADER: Kampagne ${e.name} vorausgewählt:`,s.status_id)),e.name==="drehort_typ_id"&&s.drehort_typ_id&&(r.forEach(l=>{l.value===s.drehort_typ_id&&(l.selected=!0)}),console.log(`✅ DYNAMICDATALOADER: Kampagne ${e.name} vorausgewählt:`,s.drehort_typ_id)),e.name==="kampagne_typ"&&s.kampagne_typ&&(r.forEach(l=>{l.value===s.kampagne_typ&&(l.selected=!0)}),console.log(`✅ DYNAMICDATALOADER: Kampagne ${e.name} vorausgewählt:`,s.kampagne_typ)),e.name==="ansprechpartner_id"&&s.ansprechpartner_id&&(r.forEach(l=>{l.value===s.ansprechpartner_id&&(l.selected=!0)}),console.log(`✅ DYNAMICDATALOADER: Auftrag ${e.name} vorausgewählt:`,s.ansprechpartner_id)),e.name==="status"&&s.status&&(r.forEach(l=>{l.value===s.status&&(l.selected=!0)}),console.log(`✅ DYNAMICDATALOADER: Auftrag ${e.name} vorausgewählt:`,s.status));const o={ansprechpartner_ids:s.ansprechpartner_ids||s.ansprechpartner||[],mitarbeiter_ids:s.mitarbeiter_ids||s.mitarbeiter||[],pm_ids:s.pm_ids||s.projektmanager||[],scripter_ids:s.scripter_ids||s.scripter||[],cutter_ids:s.cutter_ids||s.cutter||[],copywriter_ids:s.copywriter_ids||s.copywriter||[],art_der_kampagne:s.art_der_kampagne||s.kampagnenarten||[],plattform_ids:s.plattform_ids||s.plattformen||[],format_ids:s.format_ids||s.formate||[]};if(console.log(`🔍 DYNAMICDATALOADER: Multi-Select Check für ${e.name}:`,{hasField:!!o[e.name],fieldData:o[e.name],editDataKey:e.name in s?s[e.name]:"nicht vorhanden"}),o[e.name]){const u=(Array.isArray(o[e.name])?o[e.name]:[o[e.name]]).map(d=>typeof d=="object"&&d!==null?d.id:d).filter(Boolean);u.length>0&&(r.forEach(d=>{u.includes(d.value)&&(d.selected=!0)}),console.log(`✅ DYNAMICDATALOADER: Kampagne ${e.name} vorausgewählt:`,u))}}catch(s){console.warn(`⚠️ DYNAMICDATALOADER: Fehler beim Laden der Kampagne Edit-Daten für ${e.name}:`,s)}if(t.dataset.entityType==="ansprechpartner"){if(e.name==="position_id"&&t.dataset.editModeData)try{const o=JSON.parse(t.dataset.editModeData).position_id;o&&(r.forEach(l=>{l.value===o&&(l.selected=!0)}),console.log("✅ DYNAMICDATALOADER: Position vorausgewählt:",o))}catch{}if(e.name==="sprache_id"&&t.dataset.editModeData)try{const o=JSON.parse(t.dataset.editModeData).sprache_id;o&&(r.forEach(l=>{l.value===o&&(l.selected=!0)}),console.log("✅ DYNAMICDATALOADER: Einzel-Sprache vorausgewählt:",o))}catch{}}if(t.dataset.entityType==="creator"&&t.dataset.editModeData)try{const s=JSON.parse(t.dataset.editModeData),o={sprachen_ids:s.sprachen_ids||s.sprachen||[],branchen_ids:s.branchen_ids||s.branchen||[],creator_type_ids:s.creator_type_ids||s.creator_types||[]};if(o[e.name]){const u=(Array.isArray(o[e.name])?o[e.name]:[o[e.name]]).map(d=>typeof d=="object"&&d!==null?d.id:d).filter(Boolean);u.length>0&&(r.forEach(d=>{u.includes(d.value)&&(d.selected=!0)}),console.log(`✅ DYNAMICDATALOADER: Creator ${e.name} vorausgewählt:`,u))}}catch(s){console.warn(`⚠️ DYNAMICDATALOADER: Fehler beim Laden der Creator Edit-Daten für ${e.name}:`,s)}if(e.name==="unternehmen_id"&&t.dataset.existingUnternehmenId){const s=t.dataset.existingUnternehmenId;console.log("🏢 DYNAMICDATALOADER: Markiere bestehendes Unternehmen als selected:",s),r.forEach(o=>{o.value===s&&(o.selected=!0,console.log("✅ DYNAMICDATALOADER: Unternehmen gefunden und markiert:",o.label))})}if(e.name==="branche_id"&&t.dataset.existingBrancheId){const s=t.dataset.existingBrancheId;console.log("🏷️ DYNAMICDATALOADER: Markiere bestehende Branche als selected:",s),r.forEach(o=>{o.value===s&&(o.selected=!0,console.log("✅ DYNAMICDATALOADER: Branche gefunden und markiert:",o.label))})}if(e.name==="marke_id"&&t.dataset.existingMarkeId){const s=t.dataset.existingMarkeId;console.log("🏷️ DYNAMICDATALOADER: Markiere bestehende Marke als selected:",s),r.forEach(o=>{o.value===s&&(o.selected=!0,console.log("✅ DYNAMICDATALOADER: Marke gefunden und markiert:",o.label))})}if(e.name==="auftrag_id"&&t.dataset.existingAuftragId){const s=t.dataset.existingAuftragId;console.log("📋 DYNAMICDATALOADER: Markiere bestehenden Auftrag als selected:",s),r.forEach(o=>{o.value===s&&(o.selected=!0,console.log("✅ DYNAMICDATALOADER: Auftrag gefunden und markiert:",o.label))})}const i=r.filter(s=>s.selected);i.length>0&&console.log("🎯 DYNAMICDATALOADER: Selected Optionen für",e.name,":",i.map(s=>s.label))}if(e.name==="branche_id"&&t.dataset.entityId&&(t.dataset.entityType==="unternehmen"||t.dataset.entityType==="marke"))try{const i=t.dataset.entityId;console.log("🔍 DYNAMICDATALOADER: Lade bestehende Branchen für Unternehmen:",i),console.log("🔍 DYNAMICDATALOADER: Form Datasets verfügbar:",{entityId:t.dataset.entityId,isEditMode:t.dataset.isEditMode,editModeData:!!t.dataset.editModeData,existingBranchenIds:!!t.dataset.existingBranchenIds});let s=[];if(t.dataset.editModeData)try{const o=JSON.parse(t.dataset.editModeData);o.branche_id&&Array.isArray(o.branche_id)&&(s=o.branche_id,console.log("📋 Verwende Branchen-IDs aus Edit-Mode Daten:",s))}catch(o){console.warn("⚠️ Fehler beim Parsen der Edit-Mode Daten:",o)}if(s.length===0){console.log("🔄 Lade Branchen-IDs aus Junction Table...");const o=t.dataset.entityType,l=o==="marke"?"marke_branchen":"unternehmen_branchen",u=o==="marke"?"marke_id":"unternehmen_id";console.log("🔍 DYNAMICDATALOADER: Lade aus Junction Table:",l,"mit",u,"=",i);const{data:d,error:c}=await window.supabase.from(l).select("branche_id").eq(u,i);!c&&d&&d.length>0&&(s=d.map(m=>m.branche_id),console.log("📋 Bestehende Branchen-IDs aus Junction Table:",s))}s.length>0?(s.forEach(o=>{const l=r.find(u=>u.value===o);l?(l.selected=!0,console.log("✅ Branche als ausgewählt markiert:",l.label,l.value)):console.warn("⚠️ Branche-Option nicht in verfügbaren Optionen gefunden:",o)}),console.log("✅ Insgesamt",s.length,"Branchen als ausgewählt markiert"),console.log("📋 Final Options nach Branche-Markierung:",r.map(o=>({value:o.value,label:o.label,selected:o.selected})))):console.log("ℹ️ Keine bestehenden Branchen für Unternehmen gefunden")}catch(i){console.error("❌ Fehler beim Laden der bestehenden Branchen:",i)}else if(t.dataset.entityId&&e.relationTable&&e.relationField){const i=t.dataset.entityId;let s;e.name==="mitarbeiter_ids"||e.name==="plattform_ids"||e.name==="format_ids"?s="kampagne_id":t.dataset.entityType==="ansprechpartner"&&e.name==="marke_ids"||t.dataset.entityType==="ansprechpartner"&&e.name==="sprachen_ids"?s="ansprechpartner_id":s=e.name.replace("_ids","_id");const{data:o,error:l}=await window.supabase.from(e.relationTable).select(e.relationField).eq(s,i);if(!l&&o.length>0){const u=o.map(d=>d[e.relationField]);r.forEach(d=>{u.includes(d.value)&&(d.selected=!0)})}}if(t.dataset.entityType==="kampagne"&&t.dataset.isEditMode==="true"&&(await this.loadKampagneDependentFieldsImproved(e,t,r),["unternehmen_id","marke_id","auftrag_id","ansprechpartner_id"].includes(e.name)&&setTimeout(()=>{this.setKampagneFieldAsReadonly(e,t)},200)),e.type==="phone"&&e.defaultCountry&&e.table==="eu_laender"&&!r.some(s=>s.selected)){const s=r.find(o=>o.label.includes("Deutschland")||o.label.includes("Germany")||o.label.includes("+49"));s&&(s.selected=!0,console.log(`✅ DYNAMICDATALOADER: Deutschland als Standard für ${e.name} ausgewählt`))}if(e.name==="branche_id"){const i=r.filter(s=>s.selected);console.log("🎯 DYNAMICDATALOADER: Final branche_id Optionen:",{total:r.length,selected:i.length,selectedValues:i.map(s=>({value:s.value,label:s.label}))})}return r}catch(n){return console.error("❌ Fehler beim Laden der direkten Optionen:",n),[]}}updateSelectOptions(e,t,n){console.log("🔧 Update Select-Optionen für:",n.name,"mit",t.length,"Optionen"),e.innerHTML="";const a=document.createElement("option");a.value="",a.textContent=n.placeholder||"Bitte wählen...",e.appendChild(a);const r=e.closest("form");let i=null;if(r&&r.dataset.isEditMode==="true"&&r.dataset.editModeData)try{i=JSON.parse(r.dataset.editModeData)[n.name],i&&console.log(`🎯 DYNAMICDATALOADER: Edit-Mode Wert für statisches Feld ${n.name}:`,i)}catch{}if(t.forEach(s=>{const o=document.createElement("option");o.value=s.value,o.textContent=s.label,(s.selected||i&&s.value===i)&&(o.selected=!0,i&&s.value===i&&console.log(`✅ DYNAMICDATALOADER: Statisches Feld ${n.name} vorausgewählt:`,i)),e.appendChild(o)}),e.dataset.searchable==="true"){console.log("🔧 Reinitialisiere Auto-Suggestion für:",n.name);const s=t.map(l=>({value:l.value,label:l.label,selected:l.selected||!1})),o=s.filter(l=>l.selected);o.length>0&&console.log("🎯 DYNAMICDATALOADER: Übergebe selected Optionen an reinitializeSearchableSelect:",o.map(l=>l.label)),this.reinitializeSearchableSelect(e,s,n);return}}async loadKampagneDependentFieldsImproved(e,t,n){try{const a=t.dataset.editModeData?JSON.parse(t.dataset.editModeData):{};if(e.name==="unternehmen_id"&&a.unternehmen_id){console.log("🏢 DYNAMICDATALOADER: Markiere Unternehmen als selected:",a.unternehmen_id),console.log("🏢 DYNAMICDATALOADER: Verfügbare Unternehmen-Optionen:",n.length,n);let r=!1;n.forEach(i=>{i.value===a.unternehmen_id&&(i.selected=!0,r=!0,console.log("✅ DYNAMICDATALOADER: Unternehmen gefunden und markiert:",i.label))}),r||console.log("❌ DYNAMICDATALOADER: Unternehmen NICHT in Optionen gefunden! Suche:",a.unternehmen_id)}if(e.name==="marke_id"&&a.unternehmen_id){console.log("🏢 DYNAMICDATALOADER: Lade Marken für Unternehmen im Kampagne Edit-Modus:",a.unternehmen_id);const{data:r,error:i}=await window.supabase.from("marke").select("id, markenname").eq("unternehmen_id",a.unternehmen_id).order("markenname");!i&&r&&(n.length=0,r.length===0?(n.push({value:"",label:"Keine Marken für dieses Unternehmen verfügbar",selected:!0,disabled:!0,style:"color: #6b7280; font-style: italic;"}),console.log("ℹ️ DYNAMICDATALOADER: Keine Marken für Unternehmen gefunden")):(n.push({value:"",label:"Marke auswählen...",selected:!1}),r.forEach(s=>{n.push({value:s.id,label:s.markenname,selected:s.id===a.marke_id})}),console.log("✅ DYNAMICDATALOADER: Marken-Optionen geladen:",n.length-1)))}if(e.name==="auftrag_id"&&(a.marke_id||a.unternehmen_id)){let r=[],i="";if(a.marke_id){console.log("🏷️ DYNAMICDATALOADER: Lade Aufträge für Marke im Kampagne Edit-Modus:",a.marke_id),i="Marke";const{data:s,error:o}=await window.supabase.from("auftrag").select("id, auftragsname").eq("marke_id",a.marke_id).order("auftragsname");!o&&s&&(r=s)}else if(a.unternehmen_id){console.log("🏢 DYNAMICDATALOADER: Lade direkte Aufträge für Unternehmen (keine Marken):",a.unternehmen_id),i="Unternehmen";const{data:s,error:o}=await window.supabase.from("auftrag").select("id, auftragsname").eq("unternehmen_id",a.unternehmen_id).is("marke_id",null).order("auftragsname");!o&&s&&(r=s)}n.length=0,r.length===0?(n.push({value:"",label:`Keine Aufträge für diese ${i} verfügbar`,selected:!0,disabled:!0,style:"color: #6b7280; font-style: italic;"}),console.log(`ℹ️ DYNAMICDATALOADER: Keine Aufträge für ${i} gefunden`)):(n.push({value:"",label:"Auftrag auswählen...",selected:!1}),r.forEach(s=>{n.push({value:s.id,label:s.auftragsname,selected:s.id===a.auftrag_id})}),console.log(`✅ DYNAMICDATALOADER: ${i}-Auftrags-Optionen geladen:`,n.length-1))}if(e.name==="ansprechpartner_id"&&a.unternehmen_id){console.log("👤 DYNAMICDATALOADER: Lade Ansprechpartner für Unternehmen im Kampagne Edit-Modus:",a.unternehmen_id);const{data:r,error:i}=await window.supabase.from("ansprechpartner").select("id, name").eq("unternehmen_id",a.unternehmen_id).order("name");!i&&r&&(n.length=0,r.length===0?(n.push({value:"",label:"Keine Ansprechpartner für dieses Unternehmen verfügbar",selected:!0,disabled:!0,style:"color: #6b7280; font-style: italic;"}),console.log("ℹ️ DYNAMICDATALOADER: Keine Ansprechpartner für Unternehmen gefunden")):(n.push({value:"",label:"Ansprechpartner auswählen...",selected:!1}),r.forEach(s=>{n.push({value:s.id,label:s.name,selected:s.id===a.ansprechpartner_id})}),console.log("✅ DYNAMICDATALOADER: Ansprechpartner-Optionen geladen:",n.length-1)))}}catch(a){console.error("❌ DYNAMICDATALOADER: Fehler beim Laden der verbesserten Kampagne-Felder:",a)}}setKampagneFieldAsReadonly(e,t){console.log("🔒 DYNAMICDATALOADER: Setze Feld als readonly:",e.name);try{const n=t.querySelector(`label[for="field-${e.name}"]`);n&&!n.textContent.includes("(fixiert)")&&(n.textContent+=" (fixiert)",n.style.color="#6b7280");const a=t.querySelector(`.searchable-select-container[data-field="${e.name}"]`);if(a){const i=a.querySelector(".searchable-select-input");i&&(i.disabled=!0,i.style.backgroundColor="#f3f4f6",i.style.cursor="not-allowed",i.style.color="#6b7280"),a.style.opacity="0.7",a.style.pointerEvents="none";const s=a.querySelector(".searchable-select-dropdown");s&&(s.style.display="none")}const r=t.querySelector(`select[name="${e.name}"]`);r&&(r.disabled=!0,r.style.backgroundColor="#f3f4f6",r.style.cursor="not-allowed"),console.log("✅ DYNAMICDATALOADER: Feld als readonly gesetzt:",e.name)}catch(n){console.error("❌ DYNAMICDATALOADER: Fehler beim Setzen als readonly:",n)}}async loadKampagneDependentFields(e,t,n){try{const a=t.dataset.editModeData?JSON.parse(t.dataset.editModeData):{};if(e.name==="marke_id"&&a.unternehmen_id){console.log("🏢 DYNAMICDATALOADER: Lade Marken für Unternehmen im Kampagne Edit-Modus:",a.unternehmen_id);const{data:r,error:i}=await window.supabase.from("marke").select("id, markenname").eq("unternehmen_id",a.unternehmen_id).order("markenname");!i&&r&&(n.length=0,r.forEach(s=>{n.push({value:s.id,label:s.markenname,selected:s.id===a.marke_id})}),console.log("✅ DYNAMICDATALOADER: Marken-Optionen geladen:",n.length))}if(e.name==="auftrag_id"&&a.marke_id){console.log("🏷️ DYNAMICDATALOADER: Lade Aufträge für Marke im Kampagne Edit-Modus:",a.marke_id);const{data:r,error:i}=await window.supabase.from("auftrag").select("id, auftragsname").eq("marke_id",a.marke_id).order("auftragsname");!i&&r&&(n.length=0,r.forEach(s=>{n.push({value:s.id,label:s.auftragsname,selected:s.id===a.auftrag_id})}),console.log("✅ DYNAMICDATALOADER: Auftrags-Optionen geladen:",n.length))}}catch(a){console.error("❌ DYNAMICDATALOADER: Fehler beim Laden der Kampagne-abhängigen Felder:",a)}}async loadBenutzerOptions(e={}){if(!window.supabase)return[];try{let t=window.supabase.from("benutzer").select("id, name, vorname, nachname, rolle").order("name");e.role&&(t=t.eq("rolle",e.role));const{data:n,error:a}=await t;return a?(console.error("❌ Fehler beim Laden der Benutzer:",a),[]):(n||[]).map(r=>({value:r.id,label:`${r.vorname} ${r.nachname} (${r.rolle})`}))}catch(t){return console.error("❌ Unerwarteter Fehler beim Laden der Benutzer-Optionen:",t),[]}}async loadAnsprechpartnerOptions(e,t){try{const n=t?.querySelector('select[name="unternehmen_id"]'),a=n?.value||null;if(!a)return[];const r=n.parentNode?.querySelector('select[style*="display: none"]'),i=r&&r!==n?r.value:a;let s=window.supabase.from("ansprechpartner").select("id, vorname, nachname, email, unternehmen_id").eq("unternehmen_id",i).order("nachname");const{data:o,error:l}=await s;if(l)return console.error("❌ Fehler beim Laden der Ansprechpartner:",l),[];const u=e?.value||e?.dataset?.value||null;return(o||[]).map(d=>({value:d.id,label:[d.vorname,d.nachname,d.email].filter(Boolean).join(" | "),selected:u&&u===d.id}))}catch(n){return console.error("❌ Unerwarteter Fehler beim Laden der Ansprechpartner:",n),[]}}reinitializeSearchableSelect(e,t,n){if(console.log("🔧 Reinitialisiere Searchable Select für:",n.name,"mit",t.length,"Optionen"),e.dataset.tagBased==="true"&&n.tagBased)if(console.log("🏷️ DYNAMICDATALOADER: Tag-basiertes Multi-Select erkannt:",n.name),window.formSystem?.optionsManager?.createTagBasedSelect){window.formSystem.optionsManager.createTagBasedSelect(e,t,n),console.log("✅ DYNAMICDATALOADER: Tag-basiertes Multi-Select reinitialisiert für:",n.name);return}else console.warn("⚠️ DYNAMICDATALOADER: OptionsManager nicht verfügbar für:",n.name);const a=e.nextElementSibling;if(a&&a.classList.contains("searchable-select-container")){console.log("🔄 Aktualisiere bestehenden Searchable Select Container für:",n.name);const i=a.querySelector(".searchable-select-dropdown");i&&this.updateDropdownItems&&(this.updateDropdownItems(i,t,""),console.log("✅ Dropdown Items aktualisiert für:",n.name));const s=a.querySelector(".searchable-select-input");s&&(s.disabled=!1,s.placeholder=n.placeholder||"Suchen...",s.readOnly=!1,console.log("✅ Input-Feld aktiviert für:",n.name));return}const r=e.parentNode.querySelector(".searchable-select-container");r&&r!==a&&r.remove(),e.style.display="none",this.createSearchableSelect(e,t,n)}updateDropdownItems(e,t,n){window.formSystem?.optionsManager?.updateDropdownItems&&window.formSystem.optionsManager.updateDropdownItems(e,t,n)}createSearchableSelect(e,t,n){console.log("🔧 Searchable Select erstellen für:",n.name)}getFormConfig(e){return null}}class ft{static createdTagBasedSelects=new Set;updateSelectOptions(e,t,n){if(console.log("🔧 Update Select-Optionen für:",n.name,"mit",t.length,"Optionen"),e.dataset.searchable==="true"){console.log("🔧 Reinitialisiere Auto-Suggestion für:",n.name),this.reinitializeSearchableSelect(e,t,n);return}e.innerHTML="";const a=document.createElement("option");a.value="",a.textContent=n.placeholder||"Bitte wählen...",e.appendChild(a),t.forEach(r=>{const i=document.createElement("option");i.value=r.value,i.textContent=r.label,r.selected&&(i.selected=!0),e.appendChild(i)})}reinitializeSearchableSelect(e,t,n){console.log("🔧 OPTIONSMANAGER: Reinitialisiere Searchable Select für:",n.name,"mit",t.length,"Optionen");const a=e.nextElementSibling;if(a&&(a.classList.contains("searchable-select-container")||a.classList.contains("tag-based-select"))){console.log("🔄 OPTIONSMANAGER: Aktualisiere bestehenden Container für:",n.name);const i=a.querySelector(".searchable-select-dropdown");i&&(this.updateDropdownItems(i,t,""),console.log("✅ OPTIONSMANAGER: Dropdown Items aktualisiert"));const s=a.querySelector(".searchable-select-input");s&&(s.disabled=!1,s.placeholder=n.placeholder||"Suchen...",s.readOnly=!1,console.log("✅ OPTIONSMANAGER: Input-Feld aktiviert für:",n.name));return}const r=e.parentNode.querySelector(".searchable-select-container, .tag-based-select");r&&r!==a&&(console.log("🗑️ OPTIONSMANAGER: Entferne alten Container für:",n.name),r.remove()),e.style.display="none",console.log("🆕 OPTIONSMANAGER: Erstelle neuen Searchable Select für:",n.name),this.createSearchableSelect(e,t,n)}createSearchableSelect(e,t,n){console.log("🔧 Searchable Select erstellen für:",n.name)}updateDropdownItems(e,t,n){e.innerHTML="";try{e.parentNode.dataset.options=JSON.stringify(t||[])}catch{}t.filter(r=>r.label.toLowerCase().includes(n.toLowerCase())).forEach(r=>{const i=document.createElement("div");i.className="searchable-select-item",i.textContent=r.label,i.style.cssText=`
        padding: 8px 12px;
        cursor: pointer;
        border-bottom: 1px solid #f3f4f6;
      `,i.addEventListener("click",()=>{const s=e.parentNode.parentNode.querySelector("select");s.value=r.value;const o=e.parentNode.querySelector("input");o.value=r.label,s.dispatchEvent(new Event("change",{bubbles:!0})),e.classList.remove("show")}),i.addEventListener("mouseenter",()=>{i.style.backgroundColor="#f3f4f6"}),i.addEventListener("mouseleave",()=>{i.style.backgroundColor="white"}),e.appendChild(i)})}createTagBasedSelect(e,t,n){console.log(`🏷️ Erstelle Tag-basiertes Select für ${n.name} mit ${t.length} Optionen:`,t.slice(0,3)),console.log("🏷️ Bestehendes verstecktes Select:",document.getElementById(e.id+"_hidden"));const a=e.id;if(this.constructor.createdTagBasedSelects.has(a)){console.log(`🔄 Tag-basiertes Select für ${n.name} bereits vorhanden - prüfe ob Update nötig`);const v=e.parentNode.querySelector(".tag-based-select"),k=v?.querySelector(".searchable-select-input");if(v&&k){console.log(`🔄 Aktualisiere bestehende Optionen vollständig für ${n.name} (${t.length} Optionen)`);try{v.dataset.options=JSON.stringify(t),console.log(`✅ Dataset-Optionen aktualisiert für ${n.name}`)}catch{}e.innerHTML='<option value="">Bitte wählen...</option>',t.forEach(L=>{const F=document.createElement("option");F.value=L.value,F.textContent=L.label,e.appendChild(F)});const _=v.querySelector(".searchable-select-dropdown");_&&(this.updateDropdownItems(_,t,""),console.log(`✅ Dropdown sofort aktualisiert für ${n.name}`));const S=new Set(t.map(L=>L.value)),E=v.querySelectorAll(".tag"),$=[];if(E.forEach(L=>{const F=L.dataset?.value;F&&!S.has(F)&&(console.log(`🗑️ Markiere ungültigen Tag zum Entfernen: ${F}`),$.push({tag:L,value:F}))}),$.length>0){const L=v.querySelector('select[style*="display: none"]');$.forEach(({tag:F,value:N})=>{if(F.remove(),L){const q=Array.from(L.options).find(U=>U.value===N);q&&L.removeChild(q)}}),console.log(`✅ ${$.length} ungültige Tag(s) entfernt`)}k.disabled=t.length===0,t.length===0?k.placeholder="Erst Unternehmen auswählen...":k.placeholder=n.placeholder||"Suchen und Tags hinzufügen...",console.log(`✅ Optionen für ${n.name} vollständig aktualisiert (Input ${k.disabled?"deaktiviert":"aktiviert"})`);return}else console.log(`🗑️ Entferne defektes Tag-System für ${n.name}`),v&&v.remove(),this.constructor.createdTagBasedSelects.delete(a)}this.constructor.createdTagBasedSelects.add(a);let r=document.getElementById(e.id+"_hidden"),i=new Set;r&&(console.log("🔄 Übernehme bestehende Werte für:",n.name),console.log("🔄 Bestehende Optionen:",Array.from(r.options).map(v=>({value:v.value,selected:v.selected}))),Array.from(r.selectedOptions).forEach(v=>{i.add(v.value)}),console.log("📋 Übernommene Werte:",Array.from(i)));const s=e.parentNode.querySelector(".tag-based-select");s&&s!==o&&(console.log("🗑️ Entferne bestehenden Tag-basierten Container"),s.remove());const o=document.createElement("div");o.className="searchable-select-container tag-based-select";try{o.dataset.options=JSON.stringify(t||[])}catch{}const l=document.createElement("input");l.type="text",l.className="searchable-select-input",l.placeholder=n.placeholder||e.dataset?.placeholder||"Suchen und Tags hinzufügen...",l.style.cssText=`
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      background: white;
      display: block;
      box-sizing: border-box;
    `;const u=document.createElement("div");u.className="tags-container",u.style.display="flex",u.style.flexWrap="wrap",u.style.gap="0.5rem",u.style.minHeight="32px",u.style.padding="0.5rem",u.style.border="1px solid #d1d5db",u.style.borderRadius="6px",u.style.marginTop="0.5rem",u.style.backgroundColor="#f9fafb";const d=document.createElement("div");d.className="searchable-select-dropdown";let c;r?(c=r,console.log("🔄 Verwende bestehendes verstecktes Select für:",n.name),console.log("🔄 Bestehende Optionen im versteckten Select:",Array.from(c.options).map(v=>v.value))):(c=document.createElement("select"),c.name=e.name+"[]",c.id=e.id+"_hidden",c.multiple=!0,c.style.display="none",r=c,console.log("🔄 Erstelle neues verstecktes Select für:",n.name));const m=(v,k)=>{const _=document.createElement("div");_.className="tag";try{_.dataset.value=v}catch{}const S=document.createElement("span");S.textContent=k;const E=document.createElement("span");return E.textContent="×",E.className="tag-remove",E.addEventListener("click",()=>{i.delete(v),u.removeChild(_),p()}),_.appendChild(S),_.appendChild(E),_},h=()=>{if(i.size>0)u.style.backgroundColor="#f9fafb";else if(u.style.backgroundColor="#f3f4f6",u.children.length===0){const k=document.createElement("span");k.className="tags-placeholder",k.textContent="Keine Auswahl",k.style.color="#6b7280",k.style.fontStyle="italic",k.style.fontSize="14px",u.appendChild(k)}const v=u.querySelector(".tags-placeholder");v&&i.size>0&&v.remove()},p=()=>{console.log(`🔄 UPDATEHIDDENSELECT: Aktualisiere verstecktes Select für ${n.name}`),console.log("🔄 UPDATEHIDDENSELECT: selectedValues enthält:",Array.from(i)),c.innerHTML="",i.forEach(k=>{const _=document.createElement("option");_.value=k,_.selected=!0,_.textContent=k,c.appendChild(_),console.log(`🔄 UPDATEHIDDENSELECT: Füge Option hinzu: ${k} (selected: ${_.selected})`)}),console.log(`🔄 UPDATEHIDDENSELECT: Verstecktes Select hat jetzt ${c.options.length} Optionen`),console.log("🔄 UPDATEHIDDENSELECT: Alle Optionen sind selected:",Array.from(c.options).map(k=>({value:k.value,selected:k.selected})));try{e.innerHTML="",i.forEach(k=>{const _=document.createElement("option");_.value=k,_.selected=!0,_.textContent=k,e.appendChild(_)}),console.log(`🔄 UPDATEHIDDENSELECT: Original Select gespiegelt mit ${e.options.length} Optionen`)}catch(k){console.warn("⚠️ UPDATEHIDDENSELECT: Fehler beim Spiegeln in Original Select:",k)}h();const v=new Event("change",{bubbles:!0});c.dispatchEvent(v)},g=t.filter(v=>v.selected);console.log("🎯 Bereits ausgewählte Optionen für Tag-Select:",g),g.forEach(v=>{if(i.has(v.value))console.log(`⚠️ Preselected Tag bereits vorhanden: ${v.label}`);else{i.add(v.value);const k=m(v.value,v.label);u.appendChild(k),console.log(`✅ Preselected Tag hinzugefügt: ${v.label}`)}}),p();const b=()=>{try{const v=o.dataset.options||"[]",k=JSON.parse(v);return Array.isArray(k)?k:t||[]}catch{return t||[]}},y=v=>{d.innerHTML="";const k=Array.isArray(v)?v:b();if(k.length===0){const _=document.createElement("div");_.textContent="Keine Ergebnisse",_.className="searchable-select-empty",d.appendChild(_);return}k.forEach(_=>{if(i.has(_.value))return;const S=document.createElement("div");S.className="searchable-select-item",S.dataset.value=_.value;const E=document.createElement("span");if(E.className="branch-name",E.textContent=_.label,S.appendChild(E),_.description){const $=document.createElement("span");$.className="branch-description",$.textContent=_.description,S.appendChild($)}S.classList.add("searchable-select-item"),S.addEventListener("mouseenter",()=>S.classList.add("hover")),S.addEventListener("mouseleave",()=>S.classList.remove("hover")),S.addEventListener("click",()=>{console.log(`🖱️ Klick auf Option: ${_.value}, selectedValues vorher:`,Array.from(i)),i.add(_.value),console.log("🖱️ selectedValues nach add:",Array.from(i));const $=m(_.value,_.label);u.appendChild($),l.value="",d.classList.remove("show"),p(),console.log(`✅ Tag hinzugefügt: ${_.value}`)}),d.appendChild(S)})};l.addEventListener("focus",()=>{d.classList.add("show"),y()}),l.addEventListener("input",v=>{const k=v.target.value.toLowerCase(),S=b().filter(E=>E.label.toLowerCase().includes(k)&&!i.has(E.value));y(S)}),document.addEventListener("click",v=>{o.contains(v.target)||d.classList.remove("show")}),l.addEventListener("keydown",v=>{v.key==="Escape"&&d.classList.remove("show")}),o.appendChild(l),o.appendChild(u),o.appendChild(d),o.appendChild(c),e.style.display="none",e.parentNode.insertBefore(o,e);const w=o.closest("form");if(w){const v=w.querySelector(`select[name="${c.name}"]`);console.log(`📋 Formular prüfen für ${c.name}:`,v?"bereits vorhanden":"nicht vorhanden"),v?console.log("⚠️ Verstecktes Select bereits im Formular vorhanden"):(w.appendChild(c),console.log(`✅ Verstecktes Select ${c.name} zum Formular hinzugefügt`))}console.log(`✅ Tag-basierte Auto-Suggestion Select erstellt für ${n.name}`)}}class bt{constructor(){this.stateManager=null,this.fieldLoader=null,this.dependencyGraph=null,this.initializationPromise=null}async initializeForm(e,t=null,n={}){if(console.log(`🏗️ SMARTINIT: Initialisiere ${e}${t?` (Edit: ${t})`:" (Create)"}`),this.initializationPromise)return console.log("⏳ SMARTINIT: Warte auf laufende Initialisierung..."),await this.initializationPromise;this.initializationPromise=this._doInitialize(e,t,n);const a=await this.initializationPromise;return this.initializationPromise=null,a}async _doInitialize(e,t,n){try{this.stateManager=new(await x(async()=>{const{FormStateManager:r}=await import("./FormStateManager-DePZziZt.js");return{FormStateManager:r}},[])).FormStateManager(e,t,n),this.fieldLoader=new(await x(async()=>{const{FormFieldLoader:r}=await import("./FormFieldLoader-VVrrw8J4.js");return{FormFieldLoader:r}},[])).FormFieldLoader(this.stateManager);const a=window.formSystem.config.getFormConfig(e);if(!a||!a.fields)throw new Error(`Keine Form-Konfiguration für ${e} gefunden`);return this.dependencyGraph=this.buildDependencyGraph(a.fields),console.log("📊 SMARTINIT: Dependency Graph:",{roots:this.dependencyGraph.roots.map(r=>r.name),dependencies:Object.fromEntries(this.dependencyGraph.graph)}),this.registerDependencies(),this.setupEventListeners(),await this.loadFieldsInDependencyOrder(),await this.initializeUI(),console.log(`✅ SMARTINIT: ${e} erfolgreich initialisiert`),{stateManager:this.stateManager,fieldLoader:this.fieldLoader,success:!0}}catch(a){throw console.error("❌ SMARTINIT: Initialisierung fehlgeschlagen:",a),this.cleanup(),a}}buildDependencyGraph(e){const t=new Map,n=new Map,a=new Map,r=[];return e.forEach(i=>{a.set(i.name,i),i.dependsOn?(t.has(i.dependsOn)||t.set(i.dependsOn,[]),t.get(i.dependsOn).push(i),n.set(i.name,i.dependsOn)):r.push(i)}),this.validateDependencies(t,n,a),{graph:t,reverseGraph:n,allFields:a,roots:r,levels:this.calculateDependencyLevels(t,r)}}validateDependencies(e,t,n){const a=new Set,r=new Set,i=s=>{if(r.has(s))return!0;if(a.has(s))return!1;a.add(s),r.add(s);const o=e.get(s)||[];for(const l of o)if(i(l.name))return!0;return r.delete(s),!1};for(const s of n.keys())if(i(s))throw new Error(`Circular dependency detected involving field: ${s}`);for(const[s,o]of t)n.has(o)||console.warn(`⚠️ SMARTINIT: Field ${s} depends on missing field ${o}`)}calculateDependencyLevels(e,t){const n=[];let a=[...t],r=0;for(;a.length>0;){n[r]=a,console.log(`📊 SMARTINIT: Level ${r}:`,a.map(s=>s.name));const i=[];for(const s of a){const o=e.get(s.name)||[];i.push(...o)}if(a=i,r++,r>10){console.warn("⚠️ SMARTINIT: Dependency levels exceeded maximum depth");break}}return n}registerDependencies(){for(const[e,t]of this.dependencyGraph.graph)for(const n of t)this.stateManager.addDependency(e,n.name)}setupEventListeners(){this.stateManager.on("fieldChanged",({fieldName:e,value:t})=>{this.handleFieldChange(e,t)}),this.stateManager.on("dependentFieldsTriggered",({parentField:e,dependents:t})=>{this.loadDependentFields(e,t)})}async handleFieldChange(e,t){console.log(`🔄 SMARTINIT: Field ${e} changed to:`,t),this.updateFieldUI(e,t)}async loadDependentFields(e,t){const n=this.stateManager.getFieldValue(e);console.log(`⚡ SMARTINIT: Lade abhängige Felder von ${e} (${n}):`,t);for(const a of t){const r=this.dependencyGraph.allFields.get(a);if(r)try{await this.fieldLoader.loadField(r,n)}catch(i){console.error(`❌ SMARTINIT: Fehler beim Laden von ${a}:`,i)}}}async loadFieldsInDependencyOrder(){console.log("🔄 SMARTINIT: Lade Felder in Dependency-Reihenfolge...");for(let e=0;e<this.dependencyGraph.levels.length;e++){const t=this.dependencyGraph.levels[e];console.log(`📊 SMARTINIT: Lade Level ${e} (${t.length} Felder):`,t.map(a=>a.name));const n=t.map(async a=>{try{let r=null;if(a.dependsOn&&(r=this.stateManager.getFieldValue(a.dependsOn),!r)){console.log(`⏭️ SMARTINIT: ${a.name} übersprungen - ${a.dependsOn} hat keinen Wert`);return}await this.fieldLoader.loadField(a,r)}catch(r){console.error(`❌ SMARTINIT: Fehler beim Laden von ${a.name}:`,r)}});await Promise.all(n),console.log(`✅ SMARTINIT: Level ${e} abgeschlossen`)}console.log("🏁 SMARTINIT: Alle Felder geladen")}async initializeUI(){console.log("🎨 SMARTINIT: Initialisiere UI..."),window.currentFormState=this.stateManager,window.currentFieldLoader=this.fieldLoader,console.log("✅ SMARTINIT: UI initialisiert")}updateFieldUI(e,t){const n=document.querySelector(`[name="${e}"]`);n&&(n.tagName==="SELECT"?n.value=t:n.type==="checkbox"||n.type==="radio"?n.checked=t:n.value=t,n.dispatchEvent(new Event("change",{bubbles:!0})))}getInitializationStatus(){return this.stateManager?{status:"initialized",entityType:this.stateManager.entityType,isEditMode:this.stateManager.isEditMode,loadedFields:this.fieldLoader?.getQueueStatus()?.loadedFields||[],stateDebug:this.stateManager.getDebugInfo()}:{status:"not_initialized"}}cleanup(){this.stateManager&&(this.stateManager.destroy(),this.stateManager=null),this.fieldLoader&&(this.fieldLoader.destroy(),this.fieldLoader=null),this.dependencyGraph=null,window.currentFormState===this.stateManager&&(window.currentFormState=null),window.currentFieldLoader===this.fieldLoader&&(window.currentFieldLoader=null),console.log("🗑️ SMARTINIT: Cleanup abgeschlossen")}destroy(){this.cleanup()}}let wt=class{constructor(){this.config=new W,this.renderer=new ce,this.validator=new ut,this.autoGeneration=new ue,this.autoCalculation=new me,this.dependentFields=new he(this.autoGeneration),this.relationTables=new Y,this.dataLoader=new pe,this.optionsManager=new ft,this.formEvents=new ht(this),this.smartInitializer=new bt,this.useSmartInitialization=!1,this.renderer.getFormConfig=this.config.getFormConfig.bind(this.config),this.relationTables.getFormConfig=this.config.getFormConfig.bind(this.config),this.dataLoader.getFormConfig=this.config.getFormConfig.bind(this.config),this.validator.getFormConfig=this.config.getFormConfig.bind(this.config),this.dependentFields.getFormConfig=this.config.getFormConfig.bind(this.config),this.dataLoader.createSearchableSelect=this.createSearchableSelect.bind(this),this.dataLoader.reinitializeSearchableSelect=this.reinitializeSearchableSelect.bind(this),this.optionsManager.createSearchableSelect=this.createSearchableSelect.bind(this),this.dependentFields.dynamicDataLoader=this.dataLoader,this.injectDataService(),this.currentForm=null,this.currentFormState=null}async loadDynamicOptions(e){if(!e||!e.getAttribute("data-table"))return;const t=e.getAttribute("data-table"),n=e.getAttribute("data-display-field")||"name",a=e.getAttribute("data-value-field")||"id";try{const{data:r,error:i}=await window.supabase.from(t).select(`${a}, ${n}`).order(n);if(i)throw i;e.innerHTML='<option value="">Bitte wählen...</option>';const s=r.map(o=>{const l=document.createElement("option");return l.value=o[a],l.textContent=o[n],e.appendChild(l),{value:o[a],label:o[n]}});if(e.getAttribute("data-searchable")==="true"){const o=e.parentNode.querySelector(".searchable-select-container");if(o){const l=o.querySelector(".searchable-select-dropdown"),u=o.querySelector(".searchable-select-input");l&&u&&(this.updateDropdownItems(l,s,""),u.value||(u.placeholder=e.getAttribute("data-placeholder")||"Bitte wählen..."))}}console.log(`✅ Dynamische Optionen geladen für ${e.name}: ${s.length} Optionen`)}catch(r){console.error(`❌ Fehler beim Laden der Optionen für ${t}:`,r)}}async openForm(e,t=null){try{const n=this.renderer.renderForm(e,t),a=document.createElement("div");a.className="modal-overlay",a.innerHTML=`
        <div class="modal-content">
          ${n}
        </div>
      `,document.body.appendChild(a),this.currentForm={entity:e,data:t,modal:a},await this.formEvents.bindFormEvents(e,t),console.log(`✅ Formular geöffnet: ${e}`)}catch(n){console.error("❌ Fehler beim Öffnen des Formulars:",n)}}closeForm(){if(this.currentForm&&this.currentForm.modal){const e=this.currentForm.modal.querySelector("form");e&&this.dependentFields.cleanup(e),document.body.removeChild(this.currentForm.modal),this.currentForm=null,console.log("✅ Formular geschlossen")}}renderFormOnly(e,t=null){return this.renderer.renderFormOnly(e,t)}async bindFormEvents(e,t){if(this.useSmartInitialization&&this.shouldUseSmartInit(e)){console.log(`🚀 FORMSYSTEM: Verwende Smart Initialization für ${e}`);try{this.currentFormState&&this.currentFormState.destroy();const n=t?._entityId||t?.id||null,a=await this.smartInitializer.initializeForm(e,n,t||{});if(a.success)return this.currentFormState=a.stateManager,console.log(`✅ FORMSYSTEM: Smart Initialization erfolgreich für ${e}`),await this.formEvents.bindFormEvents(e,t),a;console.warn("⚠️ FORMSYSTEM: Smart Initialization fehlgeschlagen, Fallback zu Legacy System")}catch(n){console.error("❌ FORMSYSTEM: Smart Initialization Error:",n),console.log(`🔄 FORMSYSTEM: Fallback zu Legacy System für ${e}`)}}return console.log(`📜 FORMSYSTEM: Verwende Legacy System für ${e}`),this.formEvents.bindFormEvents(e,t)}shouldUseSmartInit(e){return["kampagne","ansprechpartner","creator"].includes(e)}injectDataService(){window.dataService?(this.dataLoader.setDataService(window.dataService),console.log("✅ DataService erfolgreich injiziert")):(console.warn("⚠️ DataService noch nicht verfügbar, wird später injiziert"),setTimeout(()=>this.injectDataService(),100))}async handleFormSubmit(e,t,n){try{const a=n||document.getElementById(`${e}-form`);if(!a)return;const r=this.collectSubmitData(a);if(e==="kampagne"&&(!r.kampagnenname||r.kampagnenname.trim()==="")&&(console.log("🔧 FORMSYSTEM: Kampagnenname ist leer, generiere automatisch..."),r.auftrag_id)){await this.autoGeneration.autoGenerateKampagnenname(a,r.auftrag_id);const o=a.querySelector('input[name="kampagnenname"]');o&&o.value&&(r.kampagnenname=o.value,console.log("✅ FORMSYSTEM: Kampagnenname generiert:",r.kampagnenname))}console.log(`🧪 FORMSYSTEM: Submit-Daten fuer ${e}:`,r);const i=this.validator.validateFormData(e,r);if(i.length>0){this.validator.showValidationErrors(i);return}let s;if(t&&t.id?s=await window.dataService.updateEntity(e,t.id,r):s=await window.dataService.createEntity(e,r),s.success)await this.relationTables.handleRelationTables(e,s.id,r,a),e==="kampagne"&&await this.handleKampagneAddresses(s.id,a),e==="kooperation"&&await this.handleKooperationVideos(s.id,a),this.validator.showSuccessMessage(t?"Erfolgreich aktualisiert!":"Erfolgreich erstellt!"),a.querySelector(".mdc-btn.mdc-btn--create")?setTimeout(()=>this.closeForm(),400):this.closeForm(),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:e,id:s.id,action:t?"updated":"created"}}));else return this.validator.showErrorMessage(`Fehler beim ${t?"Aktualisieren":"Erstellen"}: ${s.error}`),{success:!1}}catch(a){return console.error("❌ Fehler beim Formular-Submit:",a),this.validator.showErrorMessage("Ein unerwarteter Fehler ist aufgetreten."),{success:!1}}}collectSubmitData(e){const t={};if(!e)return t;const n=new FormData(e);for(const[r,i]of n.entries()){const s=typeof i=="string"?i.trim():i,o=r.endsWith("[]"),l=o?r.slice(0,-2):r;o?(t[l]||(t[l]=[]),s!==""&&t[l].push(s)):t.hasOwnProperty(l)?(Array.isArray(t[l])||(t[l]=[t[l]]),s!==""&&t[l].push(s)):t[l]=s}return e.querySelectorAll("select[multiple]").forEach(r=>{const i=r.name;if(!i)return;const s=i.endsWith("[]")?i.slice(0,-2):i,o=Array.from(r.selectedOptions).map(l=>l.value).filter(Boolean);o.length>0?t[s]=Array.from(new Set(o)):t[s]||(t[s]=[])}),Object.keys(t).forEach(r=>{Array.isArray(t[r])&&(t[r]=Array.from(new Set(t[r].filter(Boolean))))}),t}async handleKampagneAddresses(e,t){try{const n=t.querySelector(".addresses-list");if(!n)return;const a=n.querySelectorAll(".address-item"),r=[];if(a.forEach(i=>{const s=i.dataset.addressId,o={kampagne_id:e,adressname:t.querySelector(`input[name="adressname_${s}"]`)?.value||"",strasse:t.querySelector(`input[name="strasse_${s}"]`)?.value||"",hausnummer:t.querySelector(`input[name="hausnummer_${s}"]`)?.value||"",plz:t.querySelector(`input[name="plz_${s}"]`)?.value||"",stadt:t.querySelector(`input[name="stadt_${s}"]`)?.value||"",land:t.querySelector(`input[name="land_${s}"]`)?.value||"",notiz:t.querySelector(`textarea[name="notiz_${s}"]`)?.value||""};o.adressname.trim()&&r.push(o)}),r.length>0){await window.supabase.from("kampagne_adressen").delete().eq("kampagne_id",e);const{error:i}=await window.supabase.from("kampagne_adressen").insert(r);i?console.error("❌ Fehler beim Speichern der Adressen:",i):console.log(`✅ ${r.length} Adressen für Kampagne ${e} gespeichert`)}}catch(n){console.error("❌ Fehler beim Verarbeiten der Kampagnen-Adressen:",n)}}setupAddressesFields(e){e.querySelectorAll(".addresses-container").forEach(n=>{const a=n.querySelector(".add-address-btn"),r=n.querySelector(".addresses-list");a&&r&&a.addEventListener("click",()=>{this.renderer.addAddressRow(r)})})}async handleKooperationVideos(e,t){try{if(!window.supabase)return;const n=t.querySelector(".videos-list");if(!n)return;const r=Array.from(n.querySelectorAll(".video-item")).map((i,s)=>{const o=i.getAttribute("data-video-id"),l=t.querySelector(`select[name="video_content_art_${o}"]`)?.value||null;return{kooperation_id:e,content_art:l,titel:null,asset_url:null,kommentar:null,position:s+1,created_at:new Date().toISOString(),updated_at:new Date().toISOString()}}).filter(i=>i.content_art||i.titel||i.asset_url||i.kommentar);if(await window.supabase.from("kooperation_videos").delete().eq("kooperation_id",e),r.length>0){const{data:i,error:s}=await window.supabase.from("kooperation_videos").insert(r).select("id, content_art, position");s?console.error("❌ Fehler beim Speichern der Kooperation-Videos:",s):(console.log(`✅ ${i?.length||0} Videos für Kooperation ${e} gespeichert`,i),(!i||i.length===0)&&console.warn("⚠️ Insert meldete Erfolg, aber keine Zeilen wurden zurückgegeben. Prüfe RLS/Policies für kooperation_videos."))}}catch(n){console.error("❌ Fehler in handleKooperationVideos:",n)}}initializeSearchableSelects(e){e.querySelectorAll('select[data-searchable="true"]').forEach(n=>{this.createSearchableSelect(n,[],{placeholder:n.dataset.placeholder||"Bitte wählen...",type:n.multiple?"multiselect":"select",tagBased:n.dataset.tagBased==="true"})})}createSearchableSelect(e,t,n){if((n?.type==="multiselect"||e.multiple)&&(n?.tagBased===!0||e.dataset.tagBased==="true")){if(!t||t.length===0)t=Array.from(e.options).slice(1).map(r=>({value:r.value,label:r.textContent,selected:r.selected||!1})),console.log("🔧 FORMSYSTEM: Optionen aus DOM extrahiert für Tag-basiertes Select:",t.filter(r=>r.selected));else{const r=t.filter(i=>i.selected);r.length>0&&console.log("🎯 FORMSYSTEM: Übergebe selected Optionen an OptionsManager:",r.map(i=>i.label))}return this.optionsManager.createTagBasedSelect(e,t,n)}return(!t||t.length===0)&&(t=Array.from(e.options).slice(1).map(r=>({value:r.value,label:r.textContent}))),this.createSimpleSearchableSelect(e,t,n)}isoToFlagEmoji(e){if(!e||e.length!==2)return"";const t=[...e.toUpperCase()].map(n=>127397+n.charCodeAt(0));return String.fromCodePoint(...t)}createSimpleSearchableSelect(e,t,n){const a=e.parentNode.querySelector(".searchable-select-container");a&&a.remove();const r=e.dataset.phoneField==="true",i=document.createElement("div");i.className="searchable-select-container";const s=document.createElement("input");s.type="text",s.className="searchable-select-input",s.placeholder=n.placeholder||"Suchen...",s.autocomplete="new-password",s.setAttribute("data-form-type","other"),s.setAttribute("data-lpignore","true"),s.setAttribute("readonly","readonly"),setTimeout(()=>{s.removeAttribute("readonly")},100);const o=document.createElement("div");o.className="searchable-select-dropdown",e.style.display="none",e.hasAttribute("required")&&(e.removeAttribute("required"),s.setAttribute("required",""),s.setAttribute("data-was-required","true"));const u=document.createElement("input");u.type="hidden",u.name=e.name,u.id=e.id+"_value",e.value&&(u.value=e.value),e.parentNode.insertBefore(i,e),i.appendChild(s),i.appendChild(o),i.appendChild(u);const d=t.find(m=>m.selected);if(d){if(r&&d.isoCode){const m=d.label.replace(/^\+\d+\s*/,"").trim(),h=this.isoToFlagEmoji(d.isoCode);s.value=`${h} ${m}`}else s.value=d.label;Array.from(e.options).forEach(m=>{m.value===d.value&&(m.selected=!0)}),u.value=d.value,console.log("✅ FORMSYSTEM: Bestehender Wert gesetzt für",n.name,":",d.label)}const c=()=>{if(r&&o.classList.contains("show")){const m=s.getBoundingClientRect();o.style.top=`${m.bottom}px`,o.style.left=`${m.left}px`,o.style.width=`${m.width}px`}};s.addEventListener("focus",()=>{o.classList.add("show"),r&&s.placeholder&&s.value===s.placeholder&&(s.value=""),this.updateDropdownItems(o,t,s.value),r&&setTimeout(()=>{c(),window.addEventListener("scroll",c,!0),window.addEventListener("resize",c)},10)}),s.addEventListener("blur",()=>{setTimeout(()=>{o.classList.remove("show"),r&&(window.removeEventListener("scroll",c,!0),window.removeEventListener("resize",c))},200)}),s.addEventListener("input",()=>{this.updateDropdownItems(o,t,s.value),s.hasAttribute("data-was-required")&&(s.value.trim()===""?s.setCustomValidity("Dieses Feld ist erforderlich."):s.setCustomValidity(""))}),this.updateDropdownItems(o,t,"")}updateDropdownItems(e,t,n){e.innerHTML="";const a=n.replace(/[\u{1F1E6}-\u{1F1FF}]/gu,"").trim(),r=t.filter(o=>o.label.toLowerCase().includes(a.toLowerCase())),s=e.parentNode.parentNode.querySelector("select")?.dataset?.phoneField==="true";r.forEach(o=>{const l=document.createElement("div");if(l.className="searchable-select-item",s&&o.isoCode){const u=this.isoToFlagEmoji(o.isoCode);l.textContent=`${u} ${o.label}`}else l.textContent=o.label;l.addEventListener("click",()=>{const u=e.parentNode.parentNode.querySelector("select");let d=Array.from(u.options).find(h=>h.value===o.value);d||(d=document.createElement("option"),d.value=o.value,d.textContent=o.label,o.isoCode&&(d.dataset.isoCode=o.isoCode),o.vorwahl&&(d.dataset.vorwahl=o.vorwahl),u.appendChild(d)),u.value=o.value;const c=e.parentNode.querySelector('input[type="hidden"]');c&&(c.value=o.value);const m=e.parentNode.querySelector(".searchable-select-input");if(s&&o.isoCode){const h=o.label.replace(/^\+\d+\s*/,"").trim(),p=this.isoToFlagEmoji(o.isoCode);m.value=`${p} ${h}`}else m.value=o.label;m.hasAttribute("data-was-required")&&m.setCustomValidity(""),u.dispatchEvent(new Event("change",{bubbles:!0})),e.classList.remove("show"),console.log(`✅ Searchable Select ${u.name} aktualisiert: ${o.label} → ${o.value}`)}),l.addEventListener("mouseenter",()=>l.classList.add("hover")),l.addEventListener("mouseleave",()=>l.classList.remove("hover")),e.appendChild(l)})}reinitializeSearchableSelect(e,t,n){e.style.display="none",this.createSearchableSelect(e,t,n)}validateFormData(e,t){const n=[],a=this.config.getFormConfig(e);return a&&a.fields.forEach(r=>{if(!(r.autoGenerate&&(!t[r.name]||t[r.name].toString().trim()===""))&&(r.required&&(!t[r.name]||t[r.name].toString().trim()==="")&&n.push(`${r.label} ist erforderlich.`),r.validation&&t[r.name])){const i=t[r.name];switch(r.validation.type){case"text":r.validation.minLength&&i.length<r.validation.minLength&&n.push(`${r.label} muss mindestens ${r.validation.minLength} Zeichen lang sein.`);break;case"number":r.validation.min!==void 0&&parseFloat(i)<r.validation.min&&n.push(`${r.label} muss mindestens ${r.validation.min} sein.`),r.validation.max!==void 0&&parseFloat(i)>r.validation.max&&n.push(`${r.label} darf maximal ${r.validation.max} sein.`);break;case"email":/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i)||n.push(`${r.label} muss eine gültige E-Mail-Adresse sein.`);break;case"url":try{new URL(i)}catch{n.push(`${r.label} muss eine gültige URL sein.`)}break}}}),n}showValidationErrors(e){const t=e.join(`
`);alert(`Validierungsfehler:
${t}`)}showSuccessMessage(e){console.log(`✅ ${e}`)}showErrorMessage(e){console.error(`❌ ${e}`),alert(e)}cleanupSmartInit(){this.currentFormState&&(this.currentFormState.destroy(),this.currentFormState=null),this.smartInitializer&&this.smartInitializer.cleanup(),window.currentFormState&&(window.currentFormState=null),window.currentFieldLoader&&(window.currentFieldLoader=null),console.log("🗑️ FORMSYSTEM: Smart Initialization Cleanup abgeschlossen")}destroy(){this.cleanupSmartInit(),this.currentForm&&this.closeForm(),console.log("🗑️ FORMSYSTEM: Komplett zerstört")}};const ge=new wt;typeof window<"u"&&(window.formSystem=ge);class fe{constructor(){this.config=new W,this.renderer=new ce,this.autoGeneration=new ue,this.dependentFields=new he(this.autoGeneration),this.relationTables=new Y,this.dataLoader=new pe,this.renderer.getFormConfig=this.config.getFormConfig.bind(this.config),this.relationTables.getFormConfig=this.config.getFormConfig.bind(this.config),this.dataLoader.getFormConfig=this.config.getFormConfig.bind(this.config),this.dependentFields.getFormConfig=this.config.getFormConfig.bind(this.config),this.dependentFields.dynamicDataLoader=this.dataLoader,this.dataLoader.createSearchableSelect=this.createSearchableSelect.bind(this),this.dataLoader.reinitializeSearchableSelect=this.reinitializeSearchableSelect.bind(this),this.currentForm=null}async loadDynamicOptions(e){if(!e||!e.getAttribute("data-table"))return;const t=e.getAttribute("data-table"),n=e.getAttribute("data-display-field")||"name",a=e.getAttribute("data-value-field")||"id";try{const{data:r,error:i}=await window.supabase.from(t).select(`${a}, ${n}`).order(n);if(i)throw i;e.innerHTML='<option value="">Bitte wählen...</option>',r.forEach(s=>{const o=document.createElement("option");o.value=s[a],o.textContent=s[n],e.appendChild(o)})}catch(r){console.error(`❌ Fehler beim Laden der Optionen für ${t}:`,r)}}async openForm(e,t=null){try{const n=this.renderer.renderForm(e,t),a=document.createElement("div");a.className="modal-overlay",a.innerHTML=`
        <div class="modal-content">
          ${n}
        </div>
      `,document.body.appendChild(a),this.currentForm={entity:e,data:t,modal:a},await this.bindFormEvents(e,t),console.log(`✅ Formular geöffnet: ${e}`)}catch(n){console.error("❌ Fehler beim Öffnen des Formulars:",n)}}closeForm(){this.currentForm&&this.currentForm.modal&&(document.body.removeChild(this.currentForm.modal),this.currentForm=null,console.log("✅ Formular geschlossen"))}async bindFormEvents(e,t){const n=document.getElementById(`${e}-form`);if(!n)return;n.onsubmit=async r=>{r.preventDefault(),await this.handleFormSubmit(e,t)};const a=n.querySelector(".btn-close");a&&(a.onclick=()=>this.closeForm()),t&&t._isEditMode?(console.log("🎯 FORMSYSTEM: Edit-Mode erkannt, setze Kontext für DynamicDataLoader"),console.log("📋 FORMSYSTEM: Edit-Mode Daten:",{entityId:t._entityId,brancheIds:t.branche_id,totalFields:Object.keys(t).length}),n.dataset.editModeData=JSON.stringify(t),t.branche_id&&Array.isArray(t.branche_id)?console.log("🏷️ FORMSYSTEM: Branchen-IDs für Edit-Mode verfügbar:",t.branche_id):console.log("ℹ️ FORMSYSTEM: Keine Branchen-IDs im Edit-Mode vorhanden")):console.log("ℹ️ FORMSYSTEM: Kein Edit-Mode erkannt oder keine Daten verfügbar"),await this.dataLoader.loadDynamicFormData(e,n),this.dependentFields.setupDependentFields(n),this.setupAddressesFields(n),this.autoGeneration.setupAutoGeneration(n)}async handleFormSubmit(e,t){try{const n=document.getElementById(`${e}-form`);if(!n)return;const a=new FormData(n),r={};console.log("📤 FormData sammeln..."),console.log("🚨 FORMSYSTEM: handleFormSubmit wird aufgerufen für:",e);let i=n.querySelectorAll('select[data-tag-based="true"]');if(console.log('🏷️ Tag-basierte Selects gefunden (data-tag-based="true"):',i.length),i.length===0){const c=n.querySelectorAll('select[multiple][style*="display: none"]');console.log("🔍 Versteckte Multi-Selects als Fallback gefunden:",c.length),i=Array.from(c).filter(m=>m.name.includes("[]")||m.id.includes("hidden")),console.log("🏷️ Tag-basierte Selects über Fallback gefunden:",i.length)}console.log("🚨 FORMSYSTEM: Tag-basierte Verarbeitung läuft!"),i.forEach(c=>{console.log(`🔍 Verarbeite Tag-basiertes Select: ${c.name}`);let m=c,h=c.name;if(h.includes("[]")&&(h=h.replace("[]","")),!c.style.display.includes("none")&&!c.name.includes("[]")){const p=n.querySelectorAll(`select[name^="${h}"]`);console.log(`🔍 Alle Selects für ${h}:`,p.length,Array.from(p).map(g=>({name:g.name,hidden:g.style.display==="none",options:g.options.length}))),m=n.querySelector(`select[name="${h}[]"][style*="display: none"]`)||n.querySelector(`select[name="${h}"][style*="display: none"]`)||(p.length>1?p[1]:null),console.log("🔍 Verstecktes Select gefunden:",!!m)}if(m){console.log("🔍 Verstecktes Select Details:",{name:m.name,optionsCount:m.options.length,selectedCount:m.selectedOptions.length});const p=Array.from(m.selectedOptions).map(g=>g.value).filter(g=>g!=="");console.log("🔍 Ausgewählte Werte:",p),p.length>0&&(r[h]=p,console.log(`🏷️ Tag-basiertes Multi-Select ${h}:`,p))}else console.log(`⚠️ Verstecktes Select für ${h} nicht gefunden`)});const s=n.querySelectorAll('select[multiple]:not([data-tag-based="true"])');console.log("🔧 Normale Multi-Select Felder gefunden:",s.length),s.forEach(c=>{const m=Array.from(c.selectedOptions).map(h=>h.value).filter(h=>h!=="");m.length>0&&(r[c.name]=m,console.log(`✅ Multi-Select ${c.name}:`,m))});for(const[c,m]of a.entries())if(m!=="")if(c.includes("[]")){const h=c.replace("[]","");if(r.hasOwnProperty(h)){console.log(`⏭️ Überspringe ${h} - bereits durch Tag-basierte Verarbeitung gesetzt:`,r[h]);continue}r[h]||(r[h]=[]),r[h].push(m),console.log(`📤 Multi-Select Array ${h}: ${m}`)}else r.hasOwnProperty(c)||(r[c]=m,console.log(`📤 FormData ${c}: ${m}`));const o=n.querySelectorAll('select[data-searchable="true"]');console.log("🔧 Searchable Selects gefunden:",o.length),o.forEach(c=>{console.log(`🔧 Prüfe Select ${c.name}:`,{value:c.value,options:c.options.length,selectedIndex:c.selectedIndex}),c.value&&c.value!==""?(r[c.name]=c.value,console.log(`✅ Searchable Select ${c.name}: ${c.value}`)):console.log(`❌ Searchable Select ${c.name}: Kein Wert`)});const l=n.querySelectorAll('select[data-phone-field="true"]');if(l.length>0&&(console.log(`📱 Prüfe ${l.length} Phone-Land-Felder explizit`),l.forEach(c=>{const m=c.name;let h=c.value;const p=c.closest(".form-field")?.querySelector(".choices");if(p&&!h){const g=p.querySelector("select.choices__input[hidden]");g&&g.value&&(h=g.value,console.log(`📱 Wert aus verstecktem Choices-Select für ${m}: ${h}`))}console.log(`📱 Phone-Land-Field ${m}:`,{value:h,alreadySet:r.hasOwnProperty(m),currentValue:r[m]}),h&&h!==""&&(!r[m]||r[m]==="")&&(r[m]=h,console.log(`✅ Phone-Land-Field ${m} gesetzt: ${h}`))})),["telefonnummer","telefonnummer_office"].forEach(c=>{if(r[c]){const m=r[c],h=m.match(/^(\+\d{1,4})\s*/);if(h){const p=m.substring(h[0].length).trim();r[c]=p,console.log(`🔧 ✂️ VORWAHL ENTFERNT von ${c}: "${m}" -> "${p}"`),console.log(`   Vorwahl "${h[1]}" ist in ${c}_land_id gespeichert`)}else console.log(`✅ ${c} hat bereits keine Vorwahl: "${m}"`)}}),e==="kampagne"&&(!r.kampagnenname||r.kampagnenname.trim()==="")&&(console.log("🔧 FORMSYSTEM: Kampagnenname ist leer, generiere automatisch..."),r.auftrag_id)){await this.autoGeneration.autoGenerateKampagnenname(n,r.auftrag_id);const c=n.querySelector('input[name="kampagnenname"]');c&&c.value&&(r.kampagnenname=c.value,console.log("✅ FORMSYSTEM: Kampagnenname generiert:",r.kampagnenname))}console.log("📤 Finale Submit-Daten:",r),console.log("🚨 FORMSYSTEM: Submit-Daten für DataService:",JSON.stringify(r,null,2));const u=this.validateFormData(e,r);if(u.length>0){this.showValidationErrors(u);return}let d;t&&t.id?d=await window.dataService.updateEntity(e,t.id,r):d=await window.dataService.createEntity(e,r),d.success?(e!=="ansprechpartner"&&await this.relationTables.handleRelationTables(e,d.id,r,n),e==="kampagne"&&await this.handleKampagneAddresses(d.id,n),this.showSuccessMessage(t?"Erfolgreich aktualisiert!":"Erfolgreich erstellt!"),this.closeForm(),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:e,id:d.id,action:t?"updated":"created"}}))):this.showErrorMessage(`Fehler beim ${t?"Aktualisieren":"Erstellen"}: ${d.error}`)}catch(n){console.error("❌ Fehler beim Formular-Submit:",n),console.error("❌ Error Stack:",n.stack);let a="Ein unerwarteter Fehler ist aufgetreten.";n.message&&(a+=` Details: ${n.message}`),this.showErrorMessage(a);const r=document.getElementById(`${e}-form`);if(r){const i=r.querySelector('button[type="submit"]');i&&(i.disabled=!1,i.textContent=t?"Speichern":"Erstellen")}}}async handleKampagneAddresses(e,t){try{const n=t.querySelector(".addresses-list");if(!n)return;const a=n.querySelectorAll(".address-item"),r=[];if(a.forEach(i=>{const s=i.dataset.addressId,o={kampagne_id:e,adressname:t.querySelector(`input[name="adressname_${s}"]`)?.value||"",strasse:t.querySelector(`input[name="strasse_${s}"]`)?.value||"",hausnummer:t.querySelector(`input[name="hausnummer_${s}"]`)?.value||"",plz:t.querySelector(`input[name="plz_${s}"]`)?.value||"",stadt:t.querySelector(`input[name="stadt_${s}"]`)?.value||"",land:t.querySelector(`input[name="land_${s}"]`)?.value||"",notiz:t.querySelector(`textarea[name="notiz_${s}"]`)?.value||""};o.adressname.trim()&&r.push(o)}),r.length>0){await window.supabase.from("kampagne_adressen").delete().eq("kampagne_id",e);const{error:i}=await window.supabase.from("kampagne_adressen").insert(r);i?console.error("❌ Fehler beim Speichern der Adressen:",i):console.log(`✅ ${r.length} Adressen für Kampagne ${e} gespeichert`)}}catch(n){console.error("❌ Fehler beim Verarbeiten der Kampagnen-Adressen:",n)}}setupAddressesFields(e){e.querySelectorAll(".addresses-container").forEach(n=>{const a=n.querySelector(".add-address-btn"),r=n.querySelector(".addresses-list");a&&r&&a.addEventListener("click",()=>{this.renderer.addAddressRow(r)})})}initializeSearchableSelects(e){e.querySelectorAll('select[data-searchable="true"]').forEach(n=>{if(n.options.length>1){const r=Array.from(n.options).slice(1).map(i=>({value:i.value,label:i.textContent}));console.log(`🔧 Initialisiere Searchable Select ${n.name} mit ${r.length} Optionen`),this.createSearchableSelect(n,r,{placeholder:n.dataset.placeholder||"Bitte wählen..."})}else console.log(`🔧 Initialisiere Searchable Select ${n.name} mit leeren Optionen`),this.createSearchableSelect(n,[],{placeholder:n.dataset.placeholder||"Bitte wählen..."})})}createSearchableSelect(e,t,n){if((n?.type==="multiselect"||e.multiple)&&(n?.tagBased===!0||e.dataset.tagBased==="true")&&(console.log(`🏷️ FORMSYSTEM: Erstelle Tag-basiertes Select für ${n.name}`),window.formSystem?.optionsManager?.createTagBasedSelect))return window.formSystem.optionsManager.createTagBasedSelect(e,t,n);const r=e.parentNode.querySelector(".searchable-select-container");r&&(document.getElementById(e.id+"_hidden")&&console.log("🔄 Behalte verstecktes Select-Element bei Container-Entfernung"),r.remove());const i=document.createElement("div");i.className="searchable-select-container",i.style.position="relative";const s=e?.dataset?.phoneField==="true";let o=null;s&&(o=document.createElement("span"),o.className="phone-flag-icon fi",o.style.cssText=`
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        width: 24px;
        height: 18px;
        z-index: 3;
        pointer-events: none;
        border-radius: 2px;
      `,i.appendChild(o),console.log("📍 Flag-Icon Container erstellt für Phone Field"));const l=document.createElement("input");l.type="text",l.className="searchable-select-input",l.placeholder=n.placeholder||"Suchen...",l.autocomplete="off",l.style.cssText=`
      width: 100%;
      padding: 8px ${s?"40px":"12px"} 8px ${s?"44px":"12px"};
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      background: white;
    `;const u=document.createElement("div");u.className="searchable-select-dropdown",u.style.cssText=`
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 1px solid #d1d5db;
      border-top: none;
      border-radius: 0 0 6px 6px;
      max-height: 200px;
      overflow-y: auto;
      z-index: 1000;
      display: none;
    `,e.style.display="none",e.parentNode.insertBefore(i,e),i.appendChild(l),i.appendChild(u),l.addEventListener("focus",()=>{u.style.display="block",this.updateDropdownItems(u,t,l.value,e)}),l.addEventListener("blur",()=>{setTimeout(()=>{u.style.display="none"},200)}),l.addEventListener("input",()=>{this.updateDropdownItems(u,t,l.value,e)}),this.updateDropdownItems(u,t,"",e)}updateDropdownItems(e,t,n,a){e.innerHTML="";const r=t.filter(s=>s.label.toLowerCase().includes(n.toLowerCase())),i=a?.dataset?.phoneField==="true";if(r.length===0){e.innerHTML='<div style="padding: 8px 12px; color: #9ca3af;">Keine Ergebnisse gefunden</div>';return}r.forEach(s=>{const o=document.createElement("div");if(o.className="searchable-select-item",i&&s.isoCode){const l=document.createElement("span");l.className=`fi fi-${s.isoCode.toLowerCase()}`,l.style.cssText="margin-right: 8px; display: inline-block; width: 20px; height: 15px;";const u=document.createTextNode(s.label);o.appendChild(l),o.appendChild(u)}else o.textContent=s.label;o.style.cssText=`
        padding: 8px 12px;
        cursor: pointer;
        border-bottom: 1px solid #f3f4f6;
        display: flex;
        align-items: center;
      `,o.addEventListener("click",()=>{const l=e.parentNode,u=l.parentNode.querySelector("select");if(u){u.value=s.value;const d=l.querySelector("input");if(d)if(u?.dataset?.phoneField==="true"&&s.isoCode){d.value=`${s.vorwahl} ${s.label.replace(s.vorwahl,"").trim()}`,d.dataset.selectedIsoCode=s.isoCode;const m=l.querySelector(".phone-flag-icon");m&&s.isoCode&&(m.className=`phone-flag-icon fi fi-${s.isoCode.toLowerCase()}`,console.log(`🚩 Flagge gesetzt: fi-${s.isoCode.toLowerCase()}`))}else d.value=s.label;u.dispatchEvent(new Event("change"))}e.style.display="none"}),o.addEventListener("mouseenter",()=>{o.style.backgroundColor="#f3f4f6"}),o.addEventListener("mouseleave",()=>{o.style.backgroundColor="white"}),e.appendChild(o)})}initializeSearchableSelectValue(e,t,n){console.log(`🔧 Initialisiere Searchable Select für ${n.name} mit vorausgewähltem Wert`);const a=t.find(r=>r.selected);if(a){console.log(`✅ Vorausgewählte Option gefunden: ${a.label}`),e.value=a.value;const r=e.parentNode.querySelector(".searchable-select-container");if(r){const i=r.querySelector("input");i&&(i.value=a.label,console.log(`✅ Input-Wert gesetzt: ${a.label}`))}}}reinitializeSearchableSelect(e,t,n){this.createSearchableSelect(e,t,n),this.initializeSearchableSelectValue(e,t,n)}validateFormData(e,t){const n=[],a=this.config.getFormConfig(e);return a&&a.fields.forEach(r=>{if(!(r.autoGenerate&&(!t[r.name]||t[r.name].toString().trim()===""))&&(r.required&&(!t[r.name]||t[r.name].toString().trim()==="")&&n.push(`${r.label} ist erforderlich.`),r.validation&&t[r.name])){const i=t[r.name];switch(r.validation.type){case"text":r.validation.minLength&&i.length<r.validation.minLength&&n.push(`${r.label} muss mindestens ${r.validation.minLength} Zeichen lang sein.`);break;case"number":r.validation.min!==void 0&&parseFloat(i)<r.validation.min&&n.push(`${r.label} muss mindestens ${r.validation.min} sein.`),r.validation.max!==void 0&&parseFloat(i)>r.validation.max&&n.push(`${r.label} darf maximal ${r.validation.max} sein.`);break;case"email":/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i)||n.push(`${r.label} muss eine gültige E-Mail-Adresse sein.`);break;case"url":try{new URL(i)}catch{n.push(`${r.label} muss eine gültige URL sein.`)}break}}}),n}showValidationErrors(e){const t=e.join(`
`);alert(`Validierungsfehler:
${t}`)}showSuccessMessage(e){console.log(`✅ ${e}`)}showErrorMessage(e){console.error(`❌ ${e}`),alert(e)}}class vt{constructor(){this.currentEntity=null,this.currentEntityId=null}async init(e,t){console.log("📝 NOTIZENSYSTEM: Initialisiere für",e,t),this.currentEntity=e,this.currentEntityId=t}async loadNotizen(e,t){console.log("🔄 NOTIZENSYSTEM: Lade Notizen für",e,t);try{const n=this.getNotizenTable(e);if(!n)return console.warn("⚠️ NOTIZENSYSTEM: Keine Notizen-Tabelle für",e),[];let a="*";n==="creator_notiz"&&(a+=`,
          kampagne:kampagne_id (
            id,
            kampagnenname,
            unternehmen:unternehmen_id (
              id,
              firmenname
            ),
            marke:marke_id (
              id,
              markenname
            )
          )`);const{data:r,error:i}=await window.supabase.from(n).select(a).eq(`${e}_id`,t).order("created_at",{ascending:!1});return i?(console.error("❌ NOTIZENSYSTEM: Fehler beim Laden der Notizen:",i),[]):(console.log("✅ NOTIZENSYSTEM: Notizen geladen:",r?.length||0),r||[])}catch(n){return console.error("❌ NOTIZENSYSTEM: Fehler beim Laden der Notizen:",n),[]}}async createNotiz(e,t,n){console.log("📝 NOTIZENSYSTEM: Erstelle Notiz für",e,t);try{const a=this.getNotizenTable(e);if(!a)throw new Error(`Keine Notizen-Tabelle für ${e} gefunden`);const r={[`${e}_id`]:t,text:n.text,user_name:n.user_name||"System",kampagne_id:n.kampagne_id||null,created_at:new Date().toISOString()},{data:i,error:s}=await window.supabase.from(a).insert(r).select().single();if(s)throw new Error(`Fehler beim Erstellen der Notiz: ${s.message}`);return console.log("✅ NOTIZENSYSTEM: Notiz erstellt:",i),{success:!0,data:i}}catch(a){return console.error("❌ NOTIZENSYSTEM: Fehler beim Erstellen der Notiz:",a),{success:!1,error:a.message}}}async deleteNotiz(e,t){console.log("🗑️ NOTIZENSYSTEM: Lösche Notiz",t);try{const n=this.getNotizenTable(e);if(!n)throw new Error(`Keine Notizen-Tabelle für ${e} gefunden`);const{error:a}=await window.supabase.from(n).delete().eq("id",t);if(a)throw new Error(`Fehler beim Löschen der Notiz: ${a.message}`);return console.log("✅ NOTIZENSYSTEM: Notiz gelöscht"),{success:!0}}catch(n){return console.error("❌ NOTIZENSYSTEM: Fehler beim Löschen der Notiz:",n),{success:!1,error:n.message}}}async updateNotiz(e,t,n){console.log("✏️ NOTIZENSYSTEM: Aktualisiere Notiz",t);try{const a=this.getNotizenTable(e);if(!a)throw new Error(`Keine Notizen-Tabelle für ${e} gefunden`);const r={text:n.text,kampagne_id:n.kampagne_id||null,updated_at:new Date().toISOString()},{data:i,error:s}=await window.supabase.from(a).update(r).eq("id",t).select().single();if(s)throw new Error(`Fehler beim Aktualisieren der Notiz: ${s.message}`);return console.log("✅ NOTIZENSYSTEM: Notiz aktualisiert:",i),{success:!0,data:i}}catch(a){return console.error("❌ NOTIZENSYSTEM: Fehler beim Aktualisieren der Notiz:",a),{success:!1,error:a.message}}}getNotizenTable(e){return{creator:"creator_notiz",kampagne:"creator_notiz",briefing:"briefing_notiz",kooperation:"kooperation_notiz"}[e]||null}renderNotizenContainer(e,t,n){return!e||e.length===0?`
        <div class="notizen-container">
          <div class="empty-state">
            <p>Noch keine Notizen vorhanden.</p>
            <button class="primary-btn" onclick="window.notizenSystem.showAddNotizModal('${t}', '${n}')">
              Notiz hinzufügen
            </button>
          </div>
        </div>
      `:`
      <div class="notizen-container">
        ${e.map(r=>`
      <div class="notiz-card" data-notiz-id="${r.id}">
        <div class="notiz-header">
          <span class="notiz-date">${this.formatDate(r.created_at)}</span>
          <span class="notiz-user">${r.user_name||"Unbekannt"}</span>
          <div class="notiz-actions">
            <button class="icon-btn edit-notiz" onclick="window.notizenSystem.showEditNotizModal('${t}', '${r.id}')" title="Bearbeiten">
              <i class="icon-pencil"></i>
            </button>
            <button class="icon-btn delete-notiz" onclick="window.notizenSystem.deleteNotiz('${t}', '${r.id}')" title="Löschen">
              <i class="icon-trash"></i>
            </button>
          </div>
        </div>
        <div class="notiz-content">
          <p>${r.text}</p>
        </div>
        ${r.kampagne?`
          <div class="notiz-kampagne">
            <small>Kampagne: <a href="#" data-kampagne-id="${r.kampagne.id}">${r.kampagne.kampagnenname}</a></small>
          </div>
        `:""}
      </div>
    `).join("")}
        <button class="primary-btn" onclick="window.notizenSystem.showAddNotizModal('${t}', '${n}')">
          Neue Notiz hinzufügen
        </button>
      </div>
    `}showAddNotizModal(e,t){console.log("📝 NOTIZENSYSTEM: Zeige Add Notiz Modal für",e,t),document.body.insertAdjacentHTML("beforeend",`
      <div class="modal-overlay" id="notiz-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Neue Notiz hinzufügen</h3>
            <button class="modal-close" onclick="window.notizenSystem.closeModal()">
              <i class="icon-x"></i>
            </button>
          </div>
          <div class="modal-body">
            <form id="add-notiz-form">
              <div class="form-group">
                <label for="notiz-text">Notiz</label>
                <textarea id="notiz-text" name="text" rows="4" required placeholder="Notiz eingeben..."></textarea>
              </div>
              <div class="form-group">
                <label for="notiz-kampagne">Kampagne (optional)</label>
                <select id="notiz-kampagne" name="kampagne_id">
                  <option value="">Keine Kampagne</option>
                  <!-- Kampagnen werden dynamisch geladen -->
                </select>
              </div>
              <div class="form-actions">
                <button type="button" class="secondary-btn" onclick="window.notizenSystem.closeModal()">Abbrechen</button>
                <button type="submit" class="primary-btn">Notiz speichern</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `),this.loadKampagnenForSelect(),this.bindNotizFormEvents(e,t)}showEditNotizModal(e,t){console.log("✏️ NOTIZENSYSTEM: Zeige Edit Notiz Modal für",e,t),console.log("TODO: Edit Notiz Modal implementieren")}async loadKampagnenForSelect(){try{const{data:e,error:t}=await window.supabase.from("kampagne").select(`
          id,
          kampagnenname,
          unternehmen:unternehmen_id (
            id,
            firmenname
          ),
          marke:marke_id (
            id,
            markenname
          )
        `).order("kampagnenname");if(!t&&e){const n=document.getElementById("notiz-kampagne");n&&e.forEach(a=>{const r=document.createElement("option");r.value=a.id,r.textContent=`${a.kampagnenname} (${a.unternehmen?.firmenname||"Unbekannt"})`,n.appendChild(r)})}}catch(e){console.error("❌ NOTIZENSYSTEM: Fehler beim Laden der Kampagnen:",e)}}bindNotizFormEvents(e,t){const n=document.getElementById("add-notiz-form");n&&(n.onsubmit=async a=>{a.preventDefault(),await this.handleNotizSubmit(e,t)})}async handleNotizSubmit(e,t){try{const n=document.getElementById("add-notiz-form"),a=new FormData(n),r={text:a.get("text"),kampagne_id:a.get("kampagne_id")||null,user_name:"Aktueller Benutzer"},i=await this.createNotiz(e,t,r);i.success?(this.showSuccessMessage("Notiz erfolgreich erstellt!"),this.closeModal(),window.dispatchEvent(new CustomEvent("notizenUpdated",{detail:{entityType:e,entityId:t}}))):this.showErrorMessage(i.error)}catch(n){console.error("❌ NOTIZENSYSTEM: Fehler beim Erstellen der Notiz:",n),this.showErrorMessage(n.message)}}closeModal(){const e=document.getElementById("notiz-modal");e&&e.remove()}showSuccessMessage(e){console.log("✅",e)}showErrorMessage(e){console.error("❌",e)}formatDate(e){return e?new Date(e).toLocaleDateString("de-DE"):"-"}destroy(){console.log("🗑️ NOTIZENSYSTEM: Destroy aufgerufen"),this.closeModal()}}const yt=new vt;class kt{constructor(){this.currentEntity=null,this.currentEntityId=null}async init(e,t){console.log("⭐ BEWERTUNGSSYSTEM: Initialisiere für",e,t),this.currentEntity=e,this.currentEntityId=t}async loadBewertungen(e,t){console.log("🔄 BEWERTUNGSSYSTEM: Lade Bewertungen für",e,t);try{const n=this.getBewertungsTable(e);if(!n)return console.warn("⚠️ BEWERTUNGSSYSTEM: Keine Bewertungs-Tabelle für",e),[];if(e==="kooperation"){const{data:i,error:s}=await window.supabase.from("kooperationen").select(`
            id,
            bewertung,
            created_at,
            updated_at
          `).eq("id",t).single();return s?(console.error("❌ BEWERTUNGSSYSTEM: Fehler beim Laden der Kooperation:",s),[]):i.bewertung?[{id:i.id,rating:i.bewertung,created_at:i.created_at,updated_at:i.updated_at,user_name:"System"}]:[]}const{data:a,error:r}=await window.supabase.from(n).select(`
          *,
          kampagne:kampagne_id (
            id,
            kampagnenname,
            unternehmen:unternehmen_id (
              id,
              firmenname
            ),
            marke:marke_id (
              id,
              markenname
            )
          )
        `).eq(`${e}_id`,t).order("created_at",{ascending:!1});return r?(console.error("❌ BEWERTUNGSSYSTEM: Fehler beim Laden der Bewertungen:",r),[]):(console.log("✅ BEWERTUNGSSYSTEM: Bewertungen geladen:",a?.length||0),a||[])}catch(n){return console.error("❌ BEWERTUNGSSYSTEM: Fehler beim Laden der Bewertungen:",n),[]}}async createBewertung(e,t,n){console.log("⭐ BEWERTUNGSSYSTEM: Erstelle Bewertung für",e,t);try{const a=this.getBewertungsTable(e);if(!a)throw new Error(`Keine Bewertungs-Tabelle für ${e} gefunden`);if(e==="kooperation"){const{data:o,error:l}=await window.supabase.from("kooperationen").update({bewertung:n.rating,updated_at:new Date().toISOString()}).eq("id",t).select().single();if(l)throw new Error(`Fehler beim Erstellen der Bewertung: ${l.message}`);return console.log("✅ BEWERTUNGSSYSTEM: Bewertung erstellt:",o),{success:!0,data:o}}const r={[`${e}_id`]:t,rating:n.rating,user_name:n.user_name||"System",kampagne_id:n.kampagne_id||null,created_at:new Date().toISOString()},{data:i,error:s}=await window.supabase.from(a).insert(r).select().single();if(s)throw new Error(`Fehler beim Erstellen der Bewertung: ${s.message}`);return console.log("✅ BEWERTUNGSSYSTEM: Bewertung erstellt:",i),{success:!0,data:i}}catch(a){return console.error("❌ BEWERTUNGSSYSTEM: Fehler beim Erstellen der Bewertung:",a),{success:!1,error:a.message}}}async deleteBewertung(e,t){console.log("🗑️ BEWERTUNGSSYSTEM: Lösche Bewertung",t);try{const n=this.getBewertungsTable(e);if(!n)throw new Error(`Keine Bewertungs-Tabelle für ${e} gefunden`);if(e==="kooperation"){const{error:r}=await window.supabase.from("kooperationen").update({bewertung:null,updated_at:new Date().toISOString()}).eq("id",t);if(r)throw new Error(`Fehler beim Löschen der Bewertung: ${r.message}`);return console.log("✅ BEWERTUNGSSYSTEM: Bewertung gelöscht"),{success:!0}}const{error:a}=await window.supabase.from(n).delete().eq("id",t);if(a)throw new Error(`Fehler beim Löschen der Bewertung: ${a.message}`);return console.log("✅ BEWERTUNGSSYSTEM: Bewertung gelöscht"),{success:!0}}catch(n){return console.error("❌ BEWERTUNGSSYSTEM: Fehler beim Löschen der Bewertung:",n),{success:!1,error:n.message}}}async updateBewertung(e,t,n){console.log("✏️ BEWERTUNGSSYSTEM: Aktualisiere Bewertung",t);try{const a=this.getBewertungsTable(e);if(!a)throw new Error(`Keine Bewertungs-Tabelle für ${e} gefunden`);if(e==="kooperation"){const{data:o,error:l}=await window.supabase.from("kooperationen").update({bewertung:n.rating,updated_at:new Date().toISOString()}).eq("id",t).select().single();if(l)throw new Error(`Fehler beim Aktualisieren der Bewertung: ${l.message}`);return console.log("✅ BEWERTUNGSSYSTEM: Bewertung aktualisiert:",o),{success:!0,data:o}}const r={rating:n.rating,kampagne_id:n.kampagne_id||null,updated_at:new Date().toISOString()},{data:i,error:s}=await window.supabase.from(a).update(r).eq("id",t).select().single();if(s)throw new Error(`Fehler beim Aktualisieren der Bewertung: ${s.message}`);return console.log("✅ BEWERTUNGSSYSTEM: Bewertung aktualisiert:",i),{success:!0,data:i}}catch(a){return console.error("❌ BEWERTUNGSSYSTEM: Fehler beim Aktualisieren der Bewertung:",a),{success:!1,error:a.message}}}getBewertungsTable(e){return{creator:"creator_rating",kampagne:"creator_rating",kooperation:"kooperationen",briefing:"briefing_rating"}[e]||null}renderBewertungenContainer(e,t,n){return!e||e.length===0?`
        <div class="bewertungen-container">
          <div class="empty-state">
            <p>Noch keine Bewertungen vorhanden.</p>
            <button class="primary-btn" onclick="window.bewertungsSystem.showAddBewertungModal('${t}', '${n}')">
              Bewertung hinzufügen
            </button>
          </div>
        </div>
      `:`
      <div class="bewertungen-container">
        ${e.map(r=>`
      <div class="bewertung-card" data-bewertung-id="${r.id}">
        <div class="bewertung-header">
          <div class="bewertung-stars">
            ${this.renderStars(r.rating)}
          </div>
          <span class="bewertung-date">${this.formatDate(r.created_at)}</span>
          <span class="bewertung-user">${r.user_name||"Unbekannt"}</span>
          <div class="bewertung-actions">
            <button class="icon-btn edit-bewertung" onclick="window.bewertungsSystem.showEditBewertungModal('${t}', '${r.id}')" title="Bearbeiten">
              <i class="icon-pencil"></i>
            </button>
            <button class="icon-btn delete-bewertung" onclick="window.bewertungsSystem.deleteBewertung('${t}', '${r.id}')" title="Löschen">
              <i class="icon-trash"></i>
            </button>
          </div>
        </div>
        ${r.kampagne?`
          <div class="bewertung-kampagne">
            <small>Kampagne: <a href="#" data-kampagne-id="${r.kampagne.id}">${r.kampagne.kampagnenname}</a></small>
          </div>
        `:""}
      </div>
    `).join("")}
        <button class="primary-btn" onclick="window.bewertungsSystem.showAddBewertungModal('${t}', '${n}')">
          Neue Bewertung hinzufügen
        </button>
      </div>
    `}renderStars(e){const t=[];for(let n=1;n<=5;n++)t.push(`<span class="star ${n<=e?"filled":""}">★</span>`);return t.join("")}showAddBewertungModal(e,t){console.log("⭐ BEWERTUNGSSYSTEM: Zeige Add Bewertung Modal für",e,t),document.body.insertAdjacentHTML("beforeend",`
      <div class="modal-overlay" id="bewertung-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Neue Bewertung hinzufügen</h3>
            <button class="modal-close" onclick="window.bewertungsSystem.closeModal()">
              <i class="icon-x"></i>
            </button>
          </div>
          <div class="modal-body">
            <form id="add-bewertung-form">
              <div class="form-group">
                <label>Bewertung</label>
                <div class="rating-input">
                  <div class="stars-container">
                    <span class="star-input" data-rating="1">★</span>
                    <span class="star-input" data-rating="2">★</span>
                    <span class="star-input" data-rating="3">★</span>
                    <span class="star-input" data-rating="4">★</span>
                    <span class="star-input" data-rating="5">★</span>
                  </div>
                  <input type="hidden" id="bewertung-rating" name="rating" value="0" required>
                  <div class="rating-text">Bitte wählen Sie eine Bewertung</div>
                </div>
              </div>
              <div class="form-group">
                <label for="bewertung-kampagne">Kampagne (optional)</label>
                <select id="bewertung-kampagne" name="kampagne_id">
                  <option value="">Keine Kampagne</option>
                  <!-- Kampagnen werden dynamisch geladen -->
                </select>
              </div>
              <div class="form-actions">
                <button type="button" class="secondary-btn" onclick="window.bewertungsSystem.closeModal()">Abbrechen</button>
                <button type="submit" class="primary-btn">Bewertung speichern</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `),this.loadKampagnenForSelect(),this.bindStarEvents(),this.bindBewertungFormEvents(e,t)}showEditBewertungModal(e,t){console.log("✏️ BEWERTUNGSSYSTEM: Zeige Edit Bewertung Modal für",e,t),console.log("TODO: Edit Bewertung Modal implementieren")}async loadKampagnenForSelect(){try{const{data:e,error:t}=await window.supabase.from("kampagne").select(`
          id,
          kampagnenname,
          unternehmen:unternehmen_id (
            id,
            firmenname
          ),
          marke:marke_id (
            id,
            markenname
          )
        `).order("kampagnenname");if(!t&&e){const n=document.getElementById("bewertung-kampagne");n&&e.forEach(a=>{const r=document.createElement("option");r.value=a.id,r.textContent=`${a.kampagnenname} (${a.unternehmen?.firmenname||"Unbekannt"})`,n.appendChild(r)})}}catch(e){console.error("❌ BEWERTUNGSSYSTEM: Fehler beim Laden der Kampagnen:",e)}}bindStarEvents(){const e=document.querySelectorAll(".star-input"),t=document.getElementById("bewertung-rating"),n=document.querySelector(".rating-text");e.forEach(a=>{a.addEventListener("click",()=>{const r=parseInt(a.dataset.rating);t.value=r,e.forEach((s,o)=>{s.classList.toggle("filled",o<r)});const i=["","Sehr schlecht","Schlecht","Okay","Gut","Sehr gut"];n.textContent=i[r]||"Bitte wählen Sie eine Bewertung"}),a.addEventListener("mouseenter",()=>{const r=parseInt(a.dataset.rating);e.forEach((i,s)=>{i.classList.toggle("filled",s<r)})}),a.addEventListener("mouseleave",()=>{const r=parseInt(t.value)||0;e.forEach((i,s)=>{i.classList.toggle("filled",s<r)})})})}bindBewertungFormEvents(e,t){const n=document.getElementById("add-bewertung-form");n&&(n.onsubmit=async a=>{a.preventDefault(),await this.handleBewertungSubmit(e,t)})}async handleBewertungSubmit(e,t){try{const n=document.getElementById("add-bewertung-form"),a=new FormData(n),r=parseInt(a.get("rating"));if(r===0){this.showErrorMessage("Bitte wählen Sie eine Bewertung aus.");return}const i={rating:r,kampagne_id:a.get("kampagne_id")||null,user_name:"Aktueller Benutzer"},s=await this.createBewertung(e,t,i);s.success?(this.showSuccessMessage("Bewertung erfolgreich erstellt!"),this.closeModal(),window.dispatchEvent(new CustomEvent("bewertungenUpdated",{detail:{entityType:e,entityId:t}}))):this.showErrorMessage(s.error)}catch(n){console.error("❌ BEWERTUNGSSYSTEM: Fehler beim Erstellen der Bewertung:",n),this.showErrorMessage(n.message)}}closeModal(){const e=document.getElementById("bewertung-modal");e&&e.remove()}showSuccessMessage(e){console.log("✅",e)}showErrorMessage(e){console.error("❌",e)}formatDate(e){return e?new Date(e).toLocaleDateString("de-DE"):"-"}destroy(){console.log("🗑️ BEWERTUNGSSYSTEM: Destroy aufgerufen"),this.closeModal()}}const _t=new kt;function V(f,e={}){const{showFavoriteAction:t=!1,showFavoritesMenu:n=!1,showSelection:a=!1,kampagneId:r=null}=e||{},i=(f||[]).map(s=>{const o=s.id,l=`${s.vorname||""} ${s.nachname||""}`.trim()||"Unbekannt",u=Array.isArray(s.creator_types)&&s.creator_types.length?s.creator_types.map(y=>typeof y=="object"&&(y.name||y.label)||y).join(", "):"-",d=Array.isArray(s.sprachen)&&s.sprachen.length?s.sprachen.map(y=>typeof y=="object"&&(y.name||y.label)||y).join(", "):"-",c=Array.isArray(s.branchen)&&s.branchen.length?s.branchen.map(y=>typeof y=="object"&&(y.name||y.label)||y).join(", "):"-",m=s.instagram_follower!=null?new Intl.NumberFormat("de-DE").format(s.instagram_follower):"-",h=s.tiktok_follower!=null?new Intl.NumberFormat("de-DE").format(s.tiktok_follower):"-",p=s.lieferadresse_stadt||"-",g=s.lieferadresse_land||"-",b=t?`
        <td>
          <div class="actions-dropdown-container" data-entity-type="creator">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
              </svg>
            </button>
            <div class="actions-dropdown">
              <a href="#" class="action-item" data-action="view" data-id="${o}">Details anzeigen</a>
              <a href="#" class="action-item" data-action="add_to_list" data-id="${o}">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                </svg>
                Zur Liste hinzufügen
              </a>
              <a href="#" class="action-item" data-action="favorite" data-creator-id="${o}" data-kampagne-id="${r}">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
                </svg>
                Favorit speichern
              </a>
              <div class="action-separator"></div>
              <a href="#" class="action-item action-danger" data-action="delete" data-id="${o}">Löschen</a>
            </div>
          </div>
        </td>
      `:n?`
        <td>
          <div class="actions-dropdown-container" data-entity-type="creator">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
              </svg>
            </button>
            <div class="actions-dropdown">
              <a href="#" class="action-item assign-to-campaign" data-creator-id="${o}" data-kampagne-id="${r}">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                </svg>
                Zu Kampagne hinzufügen
              </a>
              <div class="action-separator"></div>
              <a href="#" class="action-item action-danger remove-favorite" data-creator-id="${o}" data-kampagne-id="${r}">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m3 3 1.664 1.664M21 21l-1.5-1.5m-5.485-1.242L12 17.25 4.5 21V8.742m.164-4.078a2.15 2.15 0 0 1 1.743-1.342 48.507 48.507 0 0 1 11.186 0c1.1.128 1.907 1.077 1.907 2.185V19.5M4.664 4.664 19.5 19.5" />
                </svg>
                Aus Favoriten entfernen
              </a>
            </div>
          </div>
        </td>
      `:"";return`
      <tr data-id="${o||""}">
        ${a?`<td><input type="checkbox" class="creator-check" data-id="${o}"></td>`:""}
        <td>${o?`<a href="#" class="table-link" data-table="creator" data-id="${o}">${l}</a>`:l}</td>
        <td>${u}</td>
        <td>${d}</td>
        <td>${c}</td>
        <td>${m}</td>
        <td>${h}</td>
        <td>${p}</td>
        <td>${g}</td>
        ${b}
      </tr>
    `}).join("");return`
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            ${a?"<th></th>":""}
            <th>Name</th>
            <th>Typen</th>
            <th>Sprachen</th>
            <th>Branchen</th>
            <th>Instagram</th>
            <th>TikTok</th>
            <th>Stadt</th>
            <th>Land</th>
            ${t||n?"<th>Aktionen</th>":""}
          </tr>
        </thead>
        <tbody>
          ${i}
        </tbody>
      </table>
    </div>
  `}class Et{constructor(){this.unternehmenId=null,this.unternehmen=null,this.notizen=[],this.ratings=[],this.marken=[],this.auftraege=[],this.ansprechpartner=[],this.kampagnen=[],this.kooperationen=[],this.creators=[],this.rechnungen=[],this._creatorMap={}}async init(e){console.log("🎯 UNTERNEHMENDETAIL: Initialisiere Unternehmen-Detailseite für ID:",e);try{this.unternehmenId=e,await this.loadUnternehmenData(),window.breadcrumbSystem&&this.unternehmen&&window.breadcrumbSystem.updateBreadcrumb([{label:"Unternehmen",url:"/unternehmen",clickable:!0},{label:this.unternehmen.firmenname||"Details",url:`/unternehmen/${this.unternehmenId}`,clickable:!1}]),this.render(),this.bindEvents(),console.log("✅ UNTERNEHMENDETAIL: Initialisierung abgeschlossen")}catch(t){console.error("❌ UNTERNEHMENDETAIL: Fehler bei der Initialisierung:",t),window.ErrorHandler.handle(t,"UnternehmenDetail.init")}}async loadUnternehmenData(){console.log("🔄 UNTERNEHMENDETAIL: Lade Unternehmen-Daten...");try{const{data:e,error:t}=await window.supabase.from("unternehmen").select("*").eq("id",this.unternehmenId).single();if(t)throw t;this.unternehmen=e,console.log("✅ UNTERNEHMENDETAIL: Unternehmen-Basisdaten geladen:",this.unternehmen);try{const{data:l,error:u}=await window.supabase.from("unternehmen_branchen").select(`
            branche_id,
            branchen:branche_id (id, name)
          `).eq("unternehmen_id",this.unternehmenId);!u&&l&&(this.unternehmen.branche_id=l.map(d=>d.branche_id),this.unternehmen.branchen_names=l.map(d=>d.branchen?.name).filter(Boolean),console.log("✅ UNTERNEHMENDETAIL: Branchen geladen:",this.unternehmen.branche_id))}catch(l){console.warn("⚠️ UNTERNEHMENDETAIL: Branchen konnten nicht geladen werden:",l)}window.notizenSystem&&(this.notizen=await window.notizenSystem.loadNotizen("unternehmen",this.unternehmenId),console.log("✅ UNTERNEHMENDETAIL: Notizen geladen:",this.notizen.length)),window.bewertungsSystem&&(this.ratings=await window.bewertungsSystem.loadBewertungen("unternehmen",this.unternehmenId),console.log("✅ UNTERNEHMENDETAIL: Ratings geladen:",this.ratings.length));const{data:n,error:a}=await window.supabase.from("marke").select("*").eq("unternehmen_id",this.unternehmenId);a||(this.marken=n||[],console.log("✅ UNTERNEHMENDETAIL: Marken geladen:",this.marken.length));const{data:r,error:i}=await window.supabase.from("auftrag").select("*").eq("unternehmen_id",this.unternehmenId);i||(this.auftraege=r||[],console.log("✅ UNTERNEHMENDETAIL: Aufträge geladen:",this.auftraege.length));try{const{data:l}=await window.supabase.from("kampagne").select("id, kampagnenname, status, start, deadline, unternehmen_id").eq("unternehmen_id",this.unternehmenId).order("created_at",{ascending:!1});this.kampagnen=l||[],console.log("✅ UNTERNEHMENDETAIL: Kampagnen geladen:",this.kampagnen.length)}catch(l){console.warn("⚠️ Kampagnen konnten nicht geladen werden",l),this.kampagnen=[]}try{const{data:l,error:u}=await window.supabase.from("rechnung").select("id, rechnung_nr, status, nettobetrag, bruttobetrag, gestellt_am, zahlungsziel, bezahlt_am, pdf_url").eq("unternehmen_id",this.unternehmenId).order("gestellt_am",{ascending:!1});if(u)throw u;this.rechnungen=l||[]}catch(l){console.warn("⚠️ Rechnungen konnten nicht geladen werden",l),this.rechnungen=[]}try{const l=(this.kampagnen||[]).map(u=>u.id).filter(Boolean);if(l.length>0){const{data:u}=await window.supabase.from("kooperationen").select("id, name, status, videoanzahl, gesamtkosten, kampagne_id, creator_id, created_at").in("kampagne_id",l).order("created_at",{ascending:!1});this.kooperationen=u||[];const d=Array.from(new Set((this.kooperationen||[]).map(c=>c.creator_id).filter(Boolean)));if(d.length>0){const{data:c}=await window.supabase.from("creator").select("id, vorname, nachname, instagram, lieferadresse_strasse, lieferadresse_hausnummer, lieferadresse_plz, lieferadresse_stadt, lieferadresse_land").in("id",d);this.creators=c||[]}else this.creators=[];console.log("✅ UNTERNEHMENDETAIL: Kooperationen geladen:",this.kooperationen.length,"Creators:",this.creators.length)}else this.kooperationen=[],this.creators=[]}catch(l){console.warn("⚠️ Kooperationen/Creators konnten nicht geladen werden",l),this.kooperationen=[],this.creators=[]}const{data:s,error:o}=await window.supabase.from("ansprechpartner_unternehmen").select(`
          ansprechpartner_id,
          ansprechpartner:ansprechpartner_id (
            *,
            position:position_id(name),
            unternehmen:unternehmen_id(firmenname),
            telefonnummer_land:eu_laender!telefonnummer_land_id (
              id,
              name,
              name_de,
              iso_code,
              vorwahl
            ),
            telefonnummer_office_land:eu_laender!telefonnummer_office_land_id (
              id,
              name,
              name_de,
              iso_code,
              vorwahl
            )
          )
        `).eq("unternehmen_id",this.unternehmenId);o||(this.ansprechpartner=(s||[]).filter(l=>l.ansprechpartner).map(l=>l.ansprechpartner),console.log("✅ UNTERNEHMENDETAIL: Ansprechpartner geladen:",this.ansprechpartner.length));try{const{data:l}=await window.supabase.from("kampagne").select("id").eq("unternehmen_id",this.unternehmenId),u=(l||[]).map(c=>c.id);let d=[];if(u.length>0){const{data:c}=await window.supabase.from("kooperationen").select("creator_id").in("kampagne_id",u);d=Array.from(new Set((c||[]).map(m=>m.creator_id).filter(Boolean)))}if(d.length>0){const{data:c}=await window.supabase.from("creator").select("id, vorname, nachname, instagram_follower, tiktok_follower, lieferadresse_stadt, lieferadresse_land").in("id",d);this.creators=c||[],this._creatorMap=(c||[]).reduce((m,h)=>(m[h.id]=h,m),{})}else this.creators=[],this._creatorMap={}}catch(l){console.warn("⚠️ Creator für Unternehmen konnten nicht geladen werden",l),this.creators=[],this._creatorMap={}}}catch(e){throw console.error("❌ UNTERNEHMENDETAIL: Fehler beim Laden der Unternehmen-Daten:",e),e}}render(){window.setHeadline(`${this.unternehmen?.firmenname||"Unternehmen"} - Details`);const e=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>${this.unternehmen?.firmenname||"Unternehmen"} - Details</h1>
          <p>Detaillierte Informationen zum Unternehmen</p>
        </div>
        <div class="page-header-right">
          <button id="btn-edit-unternehmen" class="secondary-btn">
            <i class="icon-edit"></i>
            Unternehmen bearbeiten
          </button>
          <button onclick="window.navigateTo('/unternehmen')" class="secondary-btn">
            Zurück zur Übersicht
          </button>
        </div>
      </div>

      <div class="content-section">
        <!-- Tab-Navigation -->
        <div class="tab-navigation">
          <button class="tab-button active" data-tab="informationen">
            Informationen
            <span class="tab-count">1</span>
          </button>
          <button class="tab-button" data-tab="notizen">
            Notizen
            <span class="tab-count">${this.notizen.length}</span>
          </button>
          <button class="tab-button" data-tab="bewertungen">
            Bewertungen
            <span class="tab-count">${this.ratings.length}</span>
          </button>
          <button class="tab-button" data-tab="marken">
            Marken
            <span class="tab-count">${this.marken.length}</span>
          </button>
          <button class="tab-button" data-tab="auftraege">
            Aufträge
            <span class="tab-count">${this.auftraege.length}</span>
          </button>
          <button class="tab-button" data-tab="kampagnen">
            Kampagnen
            <span class="tab-count">${this.kampagnen.length}</span>
          </button>
          <button class="tab-button" data-tab="kooperationen">
            Kooperationen
            <span class="tab-count">${this.kooperationen.length}</span>
          </button>
          <button class="tab-button" data-tab="creators">
            Creator
            <span class="tab-count">${this.creators.length}</span>
          </button>
          <button class="tab-button" data-tab="ansprechpartner">
            Ansprechpartner
            <span class="tab-count">${this.ansprechpartner.length}</span>
          </button>
      <button class="tab-button" data-tab="rechnungen">
        Rechnungen
        <span class="tab-count">${this.rechnungen.length}</span>
      </button>
        </div>

        <!-- Tab-Content -->
        <div class="tab-content">
          <!-- Informationen Tab -->
          <div class="tab-pane active" id="informationen">
            ${this.renderInformationen()}
          </div>

          <!-- Notizen Tab -->
          <div class="tab-pane" id="notizen">
            ${this.renderNotizen()}
          </div>

          <!-- Bewertungen Tab -->
          <div class="tab-pane" id="bewertungen">
            ${this.renderRatings()}
          </div>

          <!-- Marken Tab -->
          <div class="tab-pane" id="marken">
            ${this.renderMarken()}
          </div>

          <!-- Aufträge Tab -->
          <div class="tab-pane" id="auftraege">
            ${this.renderAuftraege()}
          </div>

          <!-- Kampagnen Tab -->
          <div class="tab-pane" id="kampagnen">
            ${this.renderKampagnen()}
          </div>

          <!-- Kooperationen Tab -->
          <div class="tab-pane" id="kooperationen">
            ${this.renderKooperationen()}
          </div>

          <!-- Creator Tab -->
          <div class="tab-pane" id="creators">
            ${this.renderCreators()}
          </div>

          <!-- Ansprechpartner Tab -->
          <div class="tab-pane" id="ansprechpartner">
            ${this.renderAnsprechpartner()}
          </div>
          
          <!-- Rechnungen Tab -->
          <div class="tab-pane" id="rechnungen">
            ${this.renderRechnungen()}
          </div>
        </div>
      </div>
    `;window.setContentSafely(window.content,e)}renderInformationen(){return`
      <div class="detail-section">
        <div class="detail-grid">
          <div class="detail-card">
            <h3>Unternehmen-Informationen</h3>
            <div class="detail-item">
              <label>Firmenname:</label>
              <span>${this.unternehmen?.firmenname||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Webseite:</label>
              <span>
                ${this.unternehmen?.webseite?`<a href="${this.unternehmen.webseite}" target="_blank">${this.unternehmen.webseite}</a>`:"-"}
              </span>
            </div>
            <div class="detail-item">
              <label>Branche:</label>
              <span>${this.unternehmen?.branche||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Rechnungsadresse:</label>
              <span>${[this.unternehmen?.rechnungsadresse_strasse,this.unternehmen?.rechnungsadresse_hausnummer].filter(Boolean).join(" ")||"-"}</span>
            </div>
            <div class="detail-item">
              <label>PLZ:</label>
              <span>${this.unternehmen?.rechnungsadresse_plz||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Ort:</label>
              <span>${this.unternehmen?.rechnungsadresse_stadt||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Land:</label>
              <span>${this.unternehmen?.rechnungsadresse_land||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Erstellt am:</label>
              <span>${this.unternehmen?.created_at?new Date(this.unternehmen.created_at).toLocaleDateString("de-DE"):"-"}</span>
            </div>
            <div class="detail-item">
              <label>Zuletzt aktualisiert:</label>
              <span>${this.unternehmen?.updated_at?new Date(this.unternehmen.updated_at).toLocaleDateString("de-DE"):"-"}</span>
            </div>
          </div>
        </div>
      </div>
    `}renderNotizen(){return window.notizenSystem?window.notizenSystem.renderNotizenContainer(this.notizen,"unternehmen",this.unternehmenId):"<p>Notizen-System nicht verfügbar</p>"}renderRatings(){return window.bewertungsSystem?window.bewertungsSystem.renderBewertungenContainer(this.ratings,"unternehmen",this.unternehmenId):"<p>Bewertungs-System nicht verfügbar</p>"}renderMarken(){return!this.marken||this.marken.length===0?`
        <div class="empty-state">
          <div class="empty-icon">🏷️</div>
          <h3>Keine Marken vorhanden</h3>
          <p>Es wurden noch keine Marken für dieses Unternehmen erstellt.</p>
        </div>
      `:`
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Marke</th>
              <th>Webseite</th>
              <th>Branche</th>
              <th>Erstellt</th>
            </tr>
          </thead>
          <tbody>${this.marken.map(t=>`
      <tr>
        <td>
          <a href="#" class="table-link" data-table="marke" data-id="${t.id}">
            ${t.markenname||"Unbekannte Marke"}
          </a>
        </td>
        <td>${t.webseite?`<a href="${t.webseite}" target="_blank" rel="noopener">${t.webseite}</a>`:"-"}</td>
        <td>${t.branche||"-"}</td>
        <td>${t.created_at?new Date(t.created_at).toLocaleDateString("de-DE"):"-"}</td>
      </tr>
    `).join("")}</tbody>
        </table>
      </div>
    `}renderAuftraege(){return!this.auftraege||this.auftraege.length===0?`
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <h3>Keine Aufträge vorhanden</h3>
          <p>Es wurden noch keine Aufträge für dieses Unternehmen erstellt.</p>
        </div>
      `:`
      <div class="auftraege-container">
        ${this.auftraege.map(t=>`
      <div class="auftrag-card">
        <div class="auftrag-header">
          <h4>${t.auftragsname||"Unbekannter Auftrag"}</h4>
          <span class="auftrag-status status-${t.status?.toLowerCase()||"unknown"}">
            ${t.status||"Unbekannt"}
          </span>
        </div>
        <div class="auftrag-details">
          <p><strong>Typ:</strong> ${t.auftragtype||"-"}</p>
          <p><strong>Budget:</strong> ${t.gesamt_budget?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(t.gesamt_budget):"-"}</p>
          <p><strong>Start:</strong> ${t.start?new Date(t.start).toLocaleDateString("de-DE"):"-"}</p>
          <p><strong>Ende:</strong> ${t.ende?new Date(t.ende).toLocaleDateString("de-DE"):"-"}</p>
        </div>
      </div>
    `).join("")}
      </div>
    `}renderKampagnen(){return!this.kampagnen||this.kampagnen.length===0?`
        <div class="empty-state">
          <div class="empty-icon">📣</div>
          <h3>Keine Kampagnen vorhanden</h3>
          <p>Es wurden noch keine Kampagnen für dieses Unternehmen erstellt.</p>
        </div>
      `:`<div class="kampagnen-container">${this.kampagnen.map(t=>`
      <div class="kampagne-card">
        <div class="kampagne-header">
          <h4>${t.kampagnenname||"Unbekannte Kampagne"}</h4>
          <span class="kampagne-status status-${t.status?.toLowerCase()||"unknown"}">${t.status||"-"}</span>
        </div>
        <div class="kampagne-details">
          <p><strong>Start:</strong> ${t.start?new Date(t.start).toLocaleDateString("de-DE"):"-"}</p>
          <p><strong>Deadline:</strong> ${t.deadline?new Date(t.deadline).toLocaleDateString("de-DE"):"-"}</p>
        </div>
      </div>
    `).join("")}</div>`}renderKooperationen(){return!this.kooperationen||this.kooperationen.length===0?`
        <div class="empty-state">
          <div class="empty-icon">🤝</div>
          <h3>Keine Kooperationen vorhanden</h3>
          <p>Für die Kampagnen dieses Unternehmens wurden keine Kooperationen gefunden.</p>
        </div>
      `:`<div class="kooperationen-container">${this.kooperationen.map(t=>`
      <div class="kooperation-card">
        <div class="kooperation-header">
          <h4>${t.name||"Kooperation"}</h4>
          <span class="kooperation-status status-${t.status?.toLowerCase()||"unknown"}">${t.status||"-"}</span>
        </div>
        <div class="kooperation-details">
          <p><strong>Videos:</strong> ${t.videoanzahl||0}</p>
          <p><strong>Gesamtkosten:</strong> ${t.gesamtkosten?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(t.gesamtkosten):"-"}</p>
        </div>
      </div>
    `).join("")}</div>`}renderCreators(){return!this.creators||this.creators.length===0?`
        <div class="empty-state">
          <div class="empty-icon">👤</div>
          <h3>Keine Creator vorhanden</h3>
          <p>Es gibt keine Creator in Kooperationen für dieses Unternehmen.</p>
        </div>
      `:V(this.creators)}renderAnsprechpartner(){const e=this.ansprechpartner&&this.ansprechpartner.length>0,t=`
      <div class="section-header">
        <h3>Ansprechpartner</h3>
      </div>
    `;if(!e)return t+`
        <div class="empty-state">
          <div class="empty-icon">👥</div>
          <h3>Keine Ansprechpartner vorhanden</h3>
          <p>Es wurden noch keine Ansprechpartner für dieses Unternehmen zugeordnet.</p>
        </div>
      `;const n=this.ansprechpartner.map(a=>`
      <tr>
        <td>
          <a href="#" class="table-link" data-table="ansprechpartner" data-id="${a.id}">
            ${a.vorname} ${a.nachname}
          </a>
        </td>
        <td>${a.position?.name||"-"}</td>
        <td>${a.email?`<a href="mailto:${a.email}">${a.email}</a>`:"-"}</td>
        <td>${R.render(a.telefonnummer_land?.iso_code,a.telefonnummer_land?.vorwahl,a.telefonnummer)}</td>
        <td>${R.render(a.telefonnummer_office_land?.iso_code,a.telefonnummer_office_land?.vorwahl,a.telefonnummer_office)}</td>
        <td>${a.unternehmen?.firmenname||"-"}</td>
        <td>${a.stadt||"-"}</td>
        <td>
          <button class="btn-remove-ansprechpartner" data-ansprechpartner-id="${a.id}" data-unternehmen-id="${this.unternehmenId}" title="Ansprechpartner entfernen">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </td>
      </tr>
    `).join("");return`
      ${t}
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Position</th>
              <th>Email</th>
              <th>Telefon (Privat)</th>
              <th>Telefon (Büro)</th>
              <th>Unternehmen</th>
              <th>Stadt</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${n}</tbody>
        </table>
      </div>
    `}renderRechnungen(){if(!this.rechnungen||this.rechnungen.length===0)return`
        <div class="empty-state">
          <div class="empty-icon">💶</div>
          <h3>Keine Rechnungen vorhanden</h3>
          <p>Für dieses Unternehmen wurden noch keine Rechnungen erfasst.</p>
        </div>
      `;const e=a=>a?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(a):"-",t=a=>a?new Date(a).toLocaleDateString("de-DE"):"-";return`
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Rechnungs-Nr</th>
              <th>Status</th>
              <th>Netto</th>
              <th>Brutto</th>
              <th>Gestellt</th>
              <th>Fällig</th>
              <th>Bezahlt</th>
              <th>Beleg</th>
            </tr>
          </thead>
          <tbody>${this.rechnungen.map(a=>`
      <tr>
        <td><a href="/rechnung/${a.id}" onclick="event.preventDefault(); window.navigateTo('/rechnung/${a.id}')">${window.validatorSystem.sanitizeHtml(a.rechnung_nr||"—")}</a></td>
        <td><span class="status-badge status-${(a.status||"unknown").toLowerCase()}">${a.status||"-"}</span></td>
        <td>${e(a.nettobetrag)}</td>
        <td>${e(a.bruttobetrag)}</td>
        <td>${t(a.gestellt_am)}</td>
        <td>${t(a.zahlungsziel)}</td>
        <td>${t(a.bezahlt_am)}</td>
        <td>${a.pdf_url?`<a href="${a.pdf_url}" target="_blank" rel="noopener">PDF</a>`:"-"}</td>
      </tr>
    `).join("")}</tbody>
        </table>
      </div>
    `}bindEvents(){document.addEventListener("click",e=>{const t=e.target.closest(".tab-button");t&&t.dataset?.tab&&(e.preventDefault(),this.switchTab(t.dataset.tab))}),document.addEventListener("click",e=>{e.target.id==="btn-edit-unternehmen"&&this.showEditForm()}),document.addEventListener("click",e=>{if(e.target.id==="btn-add-ansprechpartner-unternehmen"){const t=e.target.dataset.unternehmenId||this.unternehmenId;window.actionsDropdown&&window.actionsDropdown.openAddAnsprechpartnerToUnternehmenModal(t)}}),document.addEventListener("click",e=>{if(e.target.classList.contains("btn-remove-ansprechpartner")){const t=e.target.dataset.ansprechpartnerId,n=e.target.dataset.unternehmenId||this.unternehmenId;confirm("Möchten Sie diesen Ansprechpartner wirklich vom Unternehmen entfernen?")&&this.removeAnsprechpartner(t,n)}}),document.addEventListener("entityUpdated",e=>{e.detail?.entity==="ansprechpartner"&&e.detail?.unternehmenId===this.unternehmenId&&(console.log("🔄 UNTERNEHMENDETAIL: Ansprechpartner wurde aktualisiert, lade Daten neu"),this.loadUnternehmenData().then(()=>{this.render(),this.bindEvents()})),e.detail?.entity==="unternehmen"&&e.detail?.id===this.unternehmenId&&(console.log("🔄 UNTERNEHMENDETAIL: Unternehmen wurde aktualisiert, lade Daten neu"),this.loadUnternehmenData().then(()=>{this.render(),this.bindEvents()}))})}async removeAnsprechpartner(e,t){try{const{error:n}=await window.supabase.from("ansprechpartner_unternehmen").delete().eq("ansprechpartner_id",e).eq("unternehmen_id",t);if(n)throw n;window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"ansprechpartner",action:"removed",unternehmenId:t}})),console.log("✅ UNTERNEHMENDETAIL: Ansprechpartner erfolgreich entfernt")}catch(n){console.error("❌ Fehler beim Entfernen des Ansprechpartners:",n),alert("Fehler beim Entfernen: "+(n.message||"Unbekannter Fehler"))}}switchTab(e){document.querySelectorAll(".tab-button").forEach(a=>{a.classList.remove("active")});const t=document.querySelector(`[data-tab="${e}"]`);t&&t.classList.add("active"),document.querySelectorAll(".tab-pane").forEach(a=>{a.classList.remove("active")});const n=document.getElementById(e);n&&n.classList.add("active")}showErrorMessage(e){const t=document.createElement("div");t.className="alert alert-danger",t.textContent=e,t.style.cssText=`
      background: #f8d7da;
      color: #721c24;
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      border: 1px solid #f5c6cb;
    `;const n=document.querySelector(".form-page");n&&n.insertBefore(t,n.firstChild)}async getBranchenNamen(e){try{const{data:t,error:n}=await window.supabase.from("branchen").select("id, name").in("id",e);return n?(console.error("❌ Fehler beim Laden der Branche-Namen:",n),e):e.map(a=>{const r=t.find(i=>i.id===a);return r?r.name:a})}catch(t){return console.error("❌ Fehler beim Laden der Branche-Namen:",t),e}}destroy(){console.log("UnternehmenDetail: Cleaning up...")}}const be=new Et;class St{constructor(){this.auftragId=null,this.auftrag=null,this.notizen=[],this.ratings=[],this.creator=[],this.marke=null,this.unternehmen=null,this.rechnungen=[],this.rechnungSummary={count:0,sumNetto:0,sumBrutto:0,paidCount:0,openCount:0},this.koopSummary={count:0,sumNetto:0,sumGesamt:0},this.auftragsDetails=null,this.realVideoCount=0,this.realCreatorCount=0}async init(e){console.log("🎯 AUFTRAGDETAIL: Initialisiere Auftrags-Detailseite für ID:",e);try{this.auftragId=e,await this.loadAuftragData(),window.breadcrumbSystem&&this.auftrag&&window.breadcrumbSystem.updateBreadcrumb([{label:"Auftrag",url:"/auftrag",clickable:!0},{label:this.auftrag.auftragsname||"Details",url:`/auftrag/${this.auftragId}`,clickable:!1}]),this.render(),this.bindEvents(),console.log("✅ AUFTRAGDETAIL: Initialisierung abgeschlossen")}catch(t){console.error("❌ AUFTRAGDETAIL: Fehler bei der Initialisierung:",t),window.ErrorHandler.handle(t,"AuftragDetail.init")}}async loadAuftragData(){console.log("🔄 AUFTRAGDETAIL: Lade Auftrags-Daten...");try{const{data:e,error:t}=await window.supabase.from("auftrag").select(`
          *,
          marke:marke_id(markenname),
          unternehmen:unternehmen_id(firmenname)
        `).eq("id",this.auftragId).single();if(t)throw t;this.auftrag=e,console.log("✅ AUFTRAGDETAIL: Auftrags-Basisdaten geladen:",this.auftrag),window.notizenSystem&&(this.notizen=await window.notizenSystem.loadNotizen("auftrag",this.auftragId),console.log("✅ AUFTRAGDETAIL: Notizen geladen:",this.notizen.length)),window.bewertungsSystem&&(this.ratings=await window.bewertungsSystem.loadBewertungen("auftrag",this.auftragId),console.log("✅ AUFTRAGDETAIL: Ratings geladen:",this.ratings.length));const{data:n,error:a}=await window.supabase.from("creator_auftrag").select(`
          creator:creator_id(*)
        `).eq("auftrag_id",this.auftragId);a||(this.creator=n?.map(r=>r.creator)||[],console.log("✅ AUFTRAGDETAIL: Creator geladen:",this.creator.length));try{const{data:r}=await window.supabase.from("auftrag_mitarbeiter").select(`
            benutzer:mitarbeiter_id(
              id,
              name,
              email
            )
          `).eq("auftrag_id",this.auftragId);this.auftrag.mitarbeiter=r?.map(i=>i.benutzer).filter(Boolean)||[],console.log("✅ AUFTRAGDETAIL: Mitarbeiter geladen:",this.auftrag.mitarbeiter.length)}catch(r){console.warn("⚠️ AUFTRAGDETAIL: Fehler beim Laden der Mitarbeiter:",r),this.auftrag.mitarbeiter=[]}try{const{data:r}=await window.supabase.from("auftrag_cutter").select(`
            benutzer:mitarbeiter_id(
              id,
              name,
              email
            )
          `).eq("auftrag_id",this.auftragId);this.auftrag.cutter=r?.map(i=>i.benutzer).filter(Boolean)||[],console.log("✅ AUFTRAGDETAIL: Cutter geladen:",this.auftrag.cutter.length)}catch(r){console.warn("⚠️ AUFTRAGDETAIL: Fehler beim Laden der Cutter:",r),this.auftrag.cutter=[]}try{const{data:r}=await window.supabase.from("auftrag_copywriter").select(`
            benutzer:mitarbeiter_id(
              id,
              name,
              email
            )
          `).eq("auftrag_id",this.auftragId);this.auftrag.copywriter=r?.map(i=>i.benutzer).filter(Boolean)||[],console.log("✅ AUFTRAGDETAIL: Copywriter geladen:",this.auftrag.copywriter.length)}catch(r){console.warn("⚠️ AUFTRAGDETAIL: Fehler beim Laden der Copywriter:",r),this.auftrag.copywriter=[]}if(this.auftrag.ansprechpartner_id)try{const{data:r}=await window.supabase.from("ansprechpartner").select("id, vorname, nachname, email").eq("id",this.auftrag.ansprechpartner_id).single();r&&(this.auftrag.ansprechpartner=r,console.log("✅ AUFTRAGDETAIL: Ansprechpartner geladen:",this.auftrag.ansprechpartner))}catch(r){console.warn("⚠️ AUFTRAGDETAIL: Fehler beim Laden des Ansprechpartners:",r)}try{const{data:r}=await window.supabase.from("rechnung").select("id, rechnung_nr, status, nettobetrag, bruttobetrag, gestellt_am, bezahlt_am, pdf_url").eq("auftrag_id",this.auftragId).order("gestellt_am",{ascending:!1});this.rechnungen=r||[];const i=(this.rechnungen||[]).reduce((u,d)=>u+(parseFloat(d.nettobetrag)||0),0),s=(this.rechnungen||[]).reduce((u,d)=>u+(parseFloat(d.bruttobetrag)||0),0),o=(this.rechnungen||[]).filter(u=>u.status==="Bezahlt").length,l=(this.rechnungen||[]).filter(u=>u.status!=="Bezahlt").length;this.rechnungSummary={count:(this.rechnungen||[]).length,sumNetto:i,sumBrutto:s,paidCount:o,openCount:l}}catch{this.rechnungen=[],this.rechnungSummary={count:0,sumNetto:0,sumBrutto:0,paidCount:0,openCount:0}}try{const{data:r}=await window.supabase.from("kampagne").select("id").eq("auftrag_id",this.auftragId),i=(r||[]).map(s=>s.id);if(i.length>0){const{data:s}=await window.supabase.from("kooperationen").select("nettobetrag, gesamtkosten").in("kampagne_id",i),o=(s||[]).reduce((u,d)=>u+(parseFloat(d.nettobetrag)||0),0),l=(s||[]).reduce((u,d)=>u+(parseFloat(d.gesamtkosten)||0),0);this.koopSummary={count:(s||[]).length,sumNetto:o,sumGesamt:l}}else this.koopSummary={count:0,sumNetto:0,sumGesamt:0}}catch{this.koopSummary={count:0,sumNetto:0,sumGesamt:0}}try{const{data:r,error:i}=await window.supabase.from("auftrag_details").select("*").eq("auftrag_id",this.auftragId).maybeSingle();i?(console.log("ℹ️ AUFTRAGDETAIL: Keine Auftragsdetails vorhanden"),this.auftragsDetails=null):(this.auftragsDetails=r,console.log("✅ AUFTRAGDETAIL: Auftragsdetails geladen:",this.auftragsDetails))}catch{this.auftragsDetails=null}await this.calculateRealCounts()}catch(e){throw console.error("❌ AUFTRAGDETAIL: Fehler beim Laden der Auftrags-Daten:",e),e}}async calculateRealCounts(){try{console.log("🔄 AUFTRAGDETAIL: Berechne echte Video- und Creator-Anzahl");const{data:e,error:t}=await window.supabase.from("kampagne").select("id, videoanzahl, creatoranzahl").eq("auftrag_id",this.auftragId);if(t){console.warn("⚠️ Fehler beim Laden der Kampagnen:",t);return}let n=0,a=0;if(e&&e.length>0){n=e.reduce((o,l)=>o+(l.videoanzahl||0),0),a=e.reduce((o,l)=>o+(l.creatoranzahl||0),0);const r=e.map(o=>o.id),{data:i,error:s}=await window.supabase.from("kooperationen").select("videoanzahl, creator_id").in("kampagne_id",r);if(!s&&i){const o=i.reduce((u,d)=>u+(d.videoanzahl||0),0),l=new Set(i.map(u=>u.creator_id).filter(Boolean));n=Math.max(n,o),a=Math.max(a,l.size)}}this.realVideoCount=n,this.realCreatorCount=a,console.log("✅ AUFTRAGDETAIL: Echte Zahlen berechnet - Videos:",n,"Creator:",a)}catch(e){console.warn("⚠️ Fehler bei der Berechnung der echten Zahlen:",e),this.realVideoCount=0,this.realCreatorCount=0}}render(){window.setHeadline(`${this.auftrag?.auftragsname||"Auftrag"} - Details`);const e=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>${this.auftrag?.auftragsname||"Auftrag"} - Details</h1>
          <p>Detaillierte Informationen zum Auftrag</p>
        </div>
        <div class="page-header-right">
          <button id="btn-edit-auftrag" class="secondary-btn">
            <i class="icon-edit"></i>
            Auftrag bearbeiten
          </button>
          <button onclick="window.navigateTo('/auftrag')" class="secondary-btn">
            Zurück zur Übersicht
          </button>
        </div>
      </div>

      <div class="content-section">
        <!-- Tab-Navigation -->
        <div class="tab-navigation">
          <button class="tab-button active" data-tab="informationen">
            Informationen
            <span class="tab-count">1</span>
          </button>
          <button class="tab-button" data-tab="notizen">
            Notizen
            <span class="tab-count">${this.notizen.length}</span>
          </button>
          <button class="tab-button" data-tab="bewertungen">
            Bewertungen
            <span class="tab-count">${this.ratings.length}</span>
          </button>
          <button class="tab-button" data-tab="creator">
            Creator
            <span class="tab-count">${this.creator.length}</span>
          </button>
          <button class="tab-button" data-tab="rechnungen">
            Rechnungen
            <span class="tab-count">${this.rechnungen.length}</span>
          </button>
          <button class="tab-button" data-tab="budget">
            Budget
          </button>
          <button class="tab-button" data-tab="auftragsdetails">
            Auftragsdetails
            <span class="tab-count">${this.auftragsDetails?"1":"0"}</span>
          </button>
        </div>

        <!-- Tab-Content -->
        <div class="tab-content">
          <!-- Informationen Tab -->
          <div class="tab-pane active" id="informationen">
            ${this.renderInformationen()}
          </div>

          <!-- Notizen Tab -->
          <div class="tab-pane" id="notizen">
            ${this.renderNotizen()}
          </div>

          <!-- Bewertungen Tab -->
          <div class="tab-pane" id="bewertungen">
            ${this.renderRatings()}
          </div>

          <!-- Creator Tab -->
          <div class="tab-pane" id="creator">
            ${this.renderCreator()}
          </div>
          
          <!-- Rechnungen Tab -->
          <div class="tab-pane" id="rechnungen">
            ${this.renderRechnungen()}
          </div>

          <!-- Budget Tab -->
          <div class="tab-pane" id="budget">
            ${this.renderBudget()}
          </div>

          <!-- Auftragsdetails Tab -->
          <div class="tab-pane" id="auftragsdetails">
            ${this.renderAuftragsdetails()}
          </div>
        </div>
      </div>
    `;window.setContentSafely(window.content,e)}renderBudget(){const e=l=>l||l===0?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(l):"-",t=l=>l||l===0?new Intl.NumberFormat("de-DE").format(l):"-",n=this.auftrag||{},a=n.ust_prozent!=null?n.ust_prozent:19,r=n.ust_betrag!=null?n.ust_betrag:parseFloat(n.nettobetrag||0)*(parseFloat(a)/100),i=n.deckungsbeitrag_prozent!=null?n.deckungsbeitrag_prozent:0,s=n.deckungsbeitrag_betrag!=null?n.deckungsbeitrag_betrag:parseFloat(n.nettobetrag||0)*(parseFloat(i)/100),o=parseFloat(n.influencer||0)*parseFloat(n.influencer_preis||0)+parseFloat(n.ugc||0)*parseFloat(n.ugc_preis||0)+parseFloat(n.vor_ort_produktion||0)*parseFloat(n.vor_ort_preis||0);return`
      <div class="detail-section">
        <div class="detail-grid">
          <div class="detail-card">
            <h3>Einnahmen (Auftrag)</h3>
            <div class="detail-item"><label>Netto:</label><span>${e(n.nettobetrag)}</span></div>
            <div class="detail-item"><label>USt (%):</label><span>${t(a)}</span></div>
            <div class="detail-item"><label>USt Betrag:</label><span>${e(r)}</span></div>
            <div class="detail-item"><label>Brutto Gesamtbudget:</label><span>${e(n.bruttobetrag)}</span></div>
          </div>
          <div class="detail-card">
            <h3>Planwerte</h3>
            <div class="detail-item"><label>Geplanter Deckungsbeitrag (%):</label><span>${t(i)}</span></div>
            <div class="detail-item"><label>Geplanter Deckungsbeitrag (Betrag):</label><span>${e(s)}</span></div>
            <div class="detail-item"><label>KSK (5% von Netto):</label><span>${e(n.ksk_betrag)}</span></div>
            <div class="detail-item"><label>Creator Budget:</label><span>${e(n.creator_budget)}</span></div>
          </div>
          <div class="detail-card">
            <h3>Preisaufbau (Netto)</h3>
            <div class="detail-item"><label>Influencer:</label><span>${t(n.influencer)} × ${e(n.influencer_preis)}</span></div>
            <div class="detail-item"><label>UGC:</label><span>${t(n.ugc)} × ${e(n.ugc_preis)}</span></div>
            <div class="detail-item"><label>Vor Ort Produktion:</label><span>${t(n.vor_ort_produktion)} × ${e(n.vor_ort_preis)}</span></div>
            <div class="detail-item"><label>Summe Positionen (Netto):</label><span>${e(o)}</span></div>
          </div>
          <div class="detail-card">
            <h3>Rechnungen</h3>
            <div class="detail-item"><label>Anzahl:</label><span>${t(this.rechnungSummary.count)}</span></div>
            <div class="detail-item"><label>Summe Netto:</label><span>${e(this.rechnungSummary.sumNetto)}</span></div>
            <div class="detail-item"><label>Summe Brutto:</label><span>${e(this.rechnungSummary.sumBrutto)}</span></div>
            <div class="detail-item"><label>Bezahlt / Offen:</label><span>${t(this.rechnungSummary.paidCount)} / ${t(this.rechnungSummary.openCount)}</span></div>
          </div>
          <div class="detail-card">
            <h3>Ausgaben (Kooperationen)</h3>
            <div class="detail-item"><label>Anzahl Kooperationen:</label><span>${t(this.koopSummary.count)}</span></div>
            <div class="detail-item"><label>Summe Nettokosten:</label><span>${e(this.koopSummary.sumNetto)}</span></div>
            <div class="detail-item"><label>Summe Gesamtkosten:</label><span>${e(this.koopSummary.sumGesamt)}</span></div>
          </div>
        </div>
      </div>
    `}renderAuftragsdetails(){if(!this.auftragsDetails)return`
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <h3>Keine Auftragsdetails vorhanden</h3>
          <p>Es wurden noch keine detaillierten Produktionsinformationen für diesen Auftrag hinterlegt.</p>
          <button onclick="window.auftragsDetailsManager?.open('${this.auftragId}')" class="primary-btn">
            Auftragsdetails anlegen
          </button>
        </div>
      `;const e=this.auftragsDetails,t=r=>r||r===0?new Intl.NumberFormat("de-DE").format(r):"-",a=[{title:"UGC (User Generated Content)",prefix:"ugc",color:"#28a745"},{title:"Influencer",prefix:"influencer",color:"#6f42c1"},{title:"Vor Ort Dreh",prefix:"vor_ort",color:"#fd7e14"},{title:"Vor Ort Dreh Mitarbeiter",prefix:"vor_ort_mitarbeiter",color:"#20c997"}].map(r=>{const i=e[`${r.prefix}_video_anzahl`],s=e[`${r.prefix}_creator_anzahl`],o=e[`${r.prefix}_videographen_anzahl`],l=e[`${r.prefix}_budget_info`];return!i&&!s&&!o&&!l?"":`
        <tr>
          <td>
            <div class="section-indicator" style="background: ${r.color}"></div>
            ${r.title}
          </td>
          <td class="text-center">${t(i)}</td>
          <td class="text-center">${t(s)}</td>
          <td class="text-center">${t(o)}</td>
          <td class="budget-cell">${l?`<div class="budget-info">${window.validatorSystem.sanitizeHtml(l)}</div>`:"-"}</td>
        </tr>
      `}).filter(r=>r).join("");return`
      <div class="detail-section">
        <div class="section-header">
          <h3>Produktionsdetails</h3>
          <button onclick="window.auftragsDetailsManager?.open('${this.auftragId}')" class="secondary-btn">
            Bearbeiten
          </button>
        </div>

        <div class="auftragsdetails-summary">
          <div class="summary-cards">
            <div class="summary-card">
              <div class="summary-value">${t(this.realVideoCount)}</div>
              <div class="summary-label">Aktuell gebuchte Videos</div>
              ${e?.gesamt_videos?`<div class="summary-planned">Geplant: ${t(e.gesamt_videos)}</div>`:""}
            </div>
            <div class="summary-card">
              <div class="summary-value">${t(this.realCreatorCount)}</div>
              <div class="summary-label">Aktuell gebuchte Creator</div>
              ${e?.gesamt_creator?`<div class="summary-planned">Geplant: ${t(e.gesamt_creator)}</div>`:""}
            </div>
          </div>
        </div>

        <div class="data-table-container">
          <table class="data-table auftragsdetails-table">
            <thead>
              <tr>
                <th>Kategorie</th>
                <th class="text-center">Videos</th>
                <th class="text-center">Creator</th>
                <th class="text-center">Videographen</th>
                <th>Budget & Informationen</th>
              </tr>
            </thead>
            <tbody>
              ${a||`
                <tr>
                  <td colspan="5" class="no-data">
                    Keine Produktionsdetails vorhanden
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `}renderInformationen(){return`
      <div class="detail-section">
        <div class="detail-grid">
          <div class="detail-card">
            <h3>Auftrags-Informationen</h3>
            <div class="detail-item">
              <label>Auftragsname:</label>
              <span>${this.auftrag?.auftragsname||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Marke:</label>
              <span>${this.auftrag?.marke?.markenname||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Unternehmen:</label>
              <span>${this.auftrag?.unternehmen?.firmenname||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Status:</label>
              <span class="status-${this.auftrag?.status?.toLowerCase()||"unknown"}">
                ${this.auftrag?.status||"Unbekannt"}
              </span>
            </div>
            <div class="detail-item">
              <label>Typ:</label>
              <span>${this.auftrag?.auftragtype||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Budget:</label>
              <span>${this.auftrag?.gesamt_budget?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(this.auftrag.gesamt_budget):"-"}</span>
            </div>
            <div class="detail-item">
              <label>Start:</label>
              <span>${this.auftrag?.start?new Date(this.auftrag.start).toLocaleDateString("de-DE"):"-"}</span>
            </div>
            <div class="detail-item">
              <label>Ende:</label>
              <span>${this.auftrag?.ende?new Date(this.auftrag.ende).toLocaleDateString("de-DE"):"-"}</span>
            </div>
            <div class="detail-item">
              <label>Erstellt am:</label>
              <span>${this.auftrag?.created_at?new Date(this.auftrag.created_at).toLocaleDateString("de-DE"):"-"}</span>
            </div>
            <div class="detail-item">
              <label>Zuletzt aktualisiert:</label>
              <span>${this.auftrag?.updated_at?new Date(this.auftrag.updated_at).toLocaleDateString("de-DE"):"-"}</span>
            </div>
          </div>
        </div>
      </div>
    `}renderNotizen(){return window.notizenSystem?window.notizenSystem.renderNotizenContainer(this.notizen,"auftrag",this.auftragId):"<p>Notizen-System nicht verfügbar</p>"}renderRatings(){return window.bewertungsSystem?window.bewertungsSystem.renderBewertungenContainer(this.ratings,"auftrag",this.auftragId):"<p>Bewertungs-System nicht verfügbar</p>"}renderCreator(){return!this.creator||this.creator.length===0?`
        <div class="empty-state">
          <div class="empty-icon">👤</div>
          <h3>Keine Creator zugewiesen</h3>
          <p>Es wurden noch keine Creator diesem Auftrag zugewiesen.</p>
        </div>
      `:`
      <div class="creator-container">
        ${this.creator.map(t=>`
      <div class="creator-card">
        <div class="creator-header">
          <h4>${t.vorname} ${t.nachname}</h4>
          <span class="creator-status status-${t.status?.toLowerCase()||"unknown"}">
            ${t.status||"Unbekannt"}
          </span>
        </div>
        <div class="creator-details">
          <p><strong>Email:</strong> ${t.email?`<a href="mailto:${t.email}">${t.email}</a>`:"-"}</p>
          <p><strong>Telefon:</strong> ${t.telefonnummer?`<a href="tel:${t.telefonnummer}">${t.telefonnummer}</a>`:"-"}</p>
          <p><strong>Kategorie:</strong> ${t.kategorie||"-"}</p>
        </div>
      </div>
    `).join("")}
      </div>
    `}renderRechnungen(){if(!this.rechnungen||this.rechnungen.length===0)return`
        <div class="empty-state">
          <div class="empty-icon">💶</div>
          <h3>Keine Rechnungen vorhanden</h3>
        </div>
      `;const e=a=>a?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(a):"-",t=a=>a?new Date(a).toLocaleDateString("de-DE"):"-";return`
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Rechnungs-Nr</th>
              <th>Status</th>
              <th>Netto</th>
              <th>Brutto</th>
              <th>Gestellt</th>
              <th>Bezahlt</th>
              <th>Beleg</th>
            </tr>
          </thead>
          <tbody>${this.rechnungen.map(a=>`
      <tr>
        <td><a href="/rechnung/${a.id}" onclick="event.preventDefault(); window.navigateTo('/rechnung/${a.id}')">${window.validatorSystem.sanitizeHtml(a.rechnung_nr||"—")}</a></td>
        <td>${a.status||"-"}</td>
        <td>${e(a.nettobetrag)}</td>
        <td>${e(a.bruttobetrag)}</td>
        <td>${t(a.gestellt_am)}</td>
        <td>${t(a.bezahlt_am)}</td>
        <td>${a.pdf_url?`<a href="${a.pdf_url}" target="_blank" rel="noopener">PDF</a>`:"-"}</td>
      </tr>
    `).join("")}</tbody>
        </table>
      </div>
    `}bindEvents(){document.addEventListener("click",e=>{if(e.target.classList.contains("tab-button")){const t=e.target.dataset.tab;this.switchTab(t)}}),document.addEventListener("click",e=>{e.target.id==="btn-edit-auftrag"&&this.showEditForm()}),document.addEventListener("notizenUpdated",()=>{this.loadAuftragData().then(()=>{this.render(),this.bindEvents()})}),document.addEventListener("bewertungenUpdated",()=>{this.loadAuftragData().then(()=>{this.render(),this.bindEvents()})}),document.addEventListener("entityUpdated",e=>{e.detail.entity==="auftrag_details"&&e.detail.auftrag_id==this.auftragId&&this.loadAuftragData().then(()=>{this.render(),this.bindEvents()})})}switchTab(e){document.querySelectorAll(".tab-button").forEach(a=>{a.classList.remove("active")}),document.querySelectorAll(".tab-pane").forEach(a=>{a.classList.remove("active")});const t=document.querySelector(`[data-tab="${e}"]`),n=document.getElementById(e);t&&t.classList.add("active"),n&&n.classList.add("active")}showEditForm(){console.log("🎯 AUFTRAGDETAIL: Zeige Bearbeitungsformular"),window.setHeadline("Auftrag bearbeiten");const e={...this.auftrag};e._isEditMode=!0,e._entityId=this.auftragId,this.auftrag.unternehmen_id&&(e.unternehmen_id=this.auftrag.unternehmen_id,console.log("🏢 AUFTRAGDETAIL: Unternehmen-ID für Edit-Mode:",this.auftrag.unternehmen_id)),this.auftrag.marke_id&&(e.marke_id=this.auftrag.marke_id,console.log("🏷️ AUFTRAGDETAIL: Marke-ID für Edit-Mode:",this.auftrag.marke_id)),this.auftrag.ansprechpartner_id&&(e.ansprechpartner_id=this.auftrag.ansprechpartner_id,console.log("👤 AUFTRAGDETAIL: Ansprechpartner-ID für Edit-Mode:",this.auftrag.ansprechpartner_id)),e.mitarbeiter_ids=this.auftrag.mitarbeiter?this.auftrag.mitarbeiter.map(a=>a.id).filter(Boolean):[],e.cutter_ids=this.auftrag.cutter?this.auftrag.cutter.map(a=>a.id).filter(Boolean):[],e.copywriter_ids=this.auftrag.copywriter?this.auftrag.copywriter.map(a=>a.id).filter(Boolean):[],this.auftrag.art_der_kampagne&&Array.isArray(this.auftrag.art_der_kampagne)?(e.art_der_kampagne=this.auftrag.art_der_kampagne,console.log("🎨 AUFTRAGDETAIL: art_der_kampagne gesetzt:",this.auftrag.art_der_kampagne)):console.log("⚠️ AUFTRAGDETAIL: art_der_kampagne NICHT gesetzt oder nicht Array:",this.auftrag.art_der_kampagne),console.log("📋 AUFTRAGDETAIL: Multi-Select IDs extrahiert:",{mitarbeiter_ids:e.mitarbeiter_ids,cutter_ids:e.cutter_ids,copywriter_ids:e.copywriter_ids,art_der_kampagne:e.art_der_kampagne}),console.log("📋 AUFTRAGDETAIL: FormData für Rendering:",e);const t=window.formSystem.renderFormOnly("auftrag",e);window.content.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Auftrag bearbeiten</h1>
          <p>Bearbeiten Sie die Informationen von ${this.auftrag.auftragsname}</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/auftrag/${this.auftragId}')" class="secondary-btn">Zurück zu Details</button>
        </div>
      </div>
      
      <div class="form-page">
        ${t}
      </div>
    `,window.formSystem.bindFormEvents("auftrag",e);const n=document.getElementById("auftrag-form");if(n){n.dataset.isEditMode="true",n.dataset.entityType="auftrag",n.dataset.entityId=this.auftragId;const a={unternehmen_id:e.unternehmen_id,marke_id:e.marke_id,ansprechpartner_id:e.ansprechpartner_id,status:e.status,art_der_kampagne:e.art_der_kampagne,mitarbeiter_ids:e.mitarbeiter_ids,cutter_ids:e.cutter_ids,copywriter_ids:e.copywriter_ids};n.dataset.editModeData=JSON.stringify(a),console.log("📋 AUFTRAGDETAIL: EditModeData gesetzt:",a),console.log("🎨 AUFTRAGDETAIL: art_der_kampagne in editModeData:",a.art_der_kampagne),e.unternehmen_id&&(n.dataset.existingUnternehmenId=e.unternehmen_id),e.marke_id&&(n.dataset.existingMarkeId=e.marke_id),e.ansprechpartner_id&&(n.dataset.existingAnsprechpartnerId=e.ansprechpartner_id),console.log("📋 AUFTRAGDETAIL: Form-Datasets gesetzt:",{isEditMode:n.dataset.isEditMode,entityType:n.dataset.entityType,entityId:n.dataset.entityId,existingUnternehmenId:n.dataset.existingUnternehmenId,existingMarkeId:n.dataset.existingMarkeId,existingAnsprechpartnerId:n.dataset.existingAnsprechpartnerId,editModeData:"Set"}),n.onsubmit=async r=>{r.preventDefault(),await this.handleEditFormSubmit()},console.log("🔍 AUFTRAGDETAIL: Form Datasets gesetzt:",{entityId:n.dataset.entityId,isEditMode:n.dataset.isEditMode,entityType:n.dataset.entityType,existingUnternehmenId:n.dataset.existingUnternehmenId,existingMarkeId:n.dataset.existingMarkeId,existingAnsprechpartnerId:n.dataset.existingAnsprechpartnerId})}}async handleEditFormSubmit(){try{const e=document.getElementById("auftrag-form"),t=new FormData(e),n={};for(const[i,s]of t.entries())n[i]=s;const a=window.validatorSystem.validateForm(n,{auftragsname:{type:"text",minLength:2,required:!0}});if(!a.isValid){this.showValidationErrors(a.errors);return}const r=await window.dataService.updateEntity("auftrag",this.auftragId,n);if(r.success)this.showSuccessMessage("Auftrag erfolgreich aktualisiert!"),setTimeout(async()=>{await this.loadAuftragData(),this.render(),this.bindEvents()},1500);else throw new Error(r.error||"Unbekannter Fehler")}catch(e){console.error("❌ Formular-Submit Fehler:",e),this.showErrorMessage(e.message)}}showValidationErrors(e){console.log("❌ Validierungsfehler:",e),document.querySelectorAll(".validation-error").forEach(t=>t.remove()),Object.keys(e).forEach(t=>{const n=document.querySelector(`[name="${t}"]`);if(n){const a=document.createElement("div");a.className="validation-error",a.textContent=e[t],a.style.color="#dc3545",a.style.fontSize="0.875rem",a.style.marginTop="0.25rem",n.parentNode.appendChild(a),n.style.borderColor="#dc3545"}})}showSuccessMessage(e){const t=document.createElement("div");t.className="alert alert-success",t.textContent=e,t.style.cssText=`
      background: #d4edda;
      color: #155724;
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      border: 1px solid #c3e6cb;
    `;const n=document.querySelector(".form-page");n&&n.insertBefore(t,n.firstChild)}showErrorMessage(e){const t=document.createElement("div");t.className="alert alert-danger",t.textContent=e,t.style.cssText=`
      background: #f8d7da;
      color: #721c24;
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      border: 1px solid #f5c6cb;
    `;const n=document.querySelector(".form-page");n&&n.insertBefore(t,n.firstChild)}destroy(){console.log("AuftragDetail: Cleaning up...")}showDetailsForm(e){ne.open(e)}}const we=new St;class At{constructor(){this.selectedKooperation=new Set,this._boundEventListeners=new Set,this.statusOptions=[]}async init(){if(window.setHeadline("Kooperationen Übersicht"),window.breadcrumbSystem&&window.breadcrumbSystem.updateBreadcrumb([{label:"Kooperation",url:"/kooperation",clickable:!1}]),window.bulkActionSystem&&window.bulkActionSystem.hideForKunden(),!(window.canViewPage&&window.canViewPage("kooperation")||await window.checkUserPermission("kooperation","can_view"))){window.content.innerHTML=`
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Kooperationen anzuzeigen.</p>
        </div>
      `;return}this.bindEvents(),await this.loadAndRender()}async loadAndRender(){try{await this.render(),await this.initializeFilterBar();const e=A.getFilters("kooperation");console.log("🔍 Lade Kooperationen mit Filter:",e);const t=await this.loadKooperationenWithRelations();console.log("📊 Kooperationen geladen:",t?.length||0),this.updateTable(t)}catch(e){window.ErrorHandler.handle(e,"KooperationList.loadAndRender")}}async loadKooperationenWithRelations(){try{if(!window.supabase)return console.warn("⚠️ Supabase nicht verfügbar - verwende Mock-Daten"),await window.dataService.loadEntities("kooperation");try{const{data:d}=await window.supabase.from("kampagne_status").select("id, name, sort_order").order("sort_order",{ascending:!0}).order("name",{ascending:!0});this.statusOptions=d||[]}catch(d){console.warn("⚠️ Konnte Status-Optionen nicht laden",d),this.statusOptions=[]}const e=window.currentUser?.rolle==="admin";let t=[];if(!e)try{const{data:d}=await window.supabase.from("kampagne_mitarbeiter").select("kampagne_id").eq("mitarbeiter_id",window.currentUser?.id),c=(d||[]).map(g=>g.kampagne_id).filter(Boolean),{data:m}=await window.supabase.from("marke_mitarbeiter").select("marke_id").eq("mitarbeiter_id",window.currentUser?.id),h=(m||[]).map(g=>g.marke_id).filter(Boolean);let p=[];if(h.length>0){const{data:g}=await window.supabase.from("kampagne").select("id").in("marke_id",h);p=(g||[]).map(b=>b.id).filter(Boolean)}t=[...new Set([...c,...p])],console.log(`🔍 KOOPERATIONLIST: Mitarbeiter ${window.currentUser?.id} hat Zugriff auf:`,{direkteKampagnen:c.length,markenKampagnen:p.length,gesamt:t.length})}catch(d){console.error("❌ Fehler beim Laden der Kampagnen-Zuordnungen:",d)}let n=window.supabase.from("kooperationen").select("id, name, status, status_id, videoanzahl, gesamtkosten, kampagne_id, creator_id, assignee_id, skript_deadline, content_deadline, created_at").order("created_at",{ascending:!1});!e&&window.currentUser?.rolle!=="kunde"&&(n=n.or(`assignee_id.eq.${window.currentUser?.id}${t.length?`,kampagne_id.in.(${t.join(",")})`:""}`));const{data:a,error:r}=await n;if(r)throw console.error("❌ Fehler beim Laden der Kooperationen mit Beziehungen:",r),r;const i=Array.from(new Set((a||[]).map(d=>d.kampagne_id).filter(Boolean))),s=Array.from(new Set((a||[]).map(d=>d.creator_id).filter(Boolean)));let o={},l={};try{if(i.length>0){const{data:d}=await window.supabase.from("kampagne").select("id, kampagnenname, status, start, deadline").in("id",i);o=(d||[]).reduce((c,m)=>(c[m.id]=m,c),{})}if(s.length>0){const{data:d}=await window.supabase.from("creator").select("id, vorname, nachname, instagram").in("id",s);l=(d||[]).reduce((c,m)=>(c[m.id]=m,c),{})}}catch(d){console.warn("⚠️ Beziehungen konnten nicht vollständig geladen werden:",d)}const u=(a||[]).map(d=>({...d,creator:l[d.creator_id]||null,kampagne:o[d.kampagne_id]||null}));return this._kampagneMap=o,this._creatorMap=l,console.log("✅ Kooperationen mit Beziehungen geladen:",u),u}catch(e){return console.error("❌ Fehler beim Laden der Kooperationen mit Beziehungen:",e),await window.dataService.loadEntities("kooperation")}}async render(e){const t=window.currentUser?.permissions?.kooperation?.can_edit||!1,n=A.getFilters("kooperation");Object.entries(n).forEach(([i,s])=>{});let a=`<div class="filter-bar">
      <div class="filter-left">
        <div id="filter-container"></div>
      </div>
      <div class="filter-right">
        <button id="btn-filter-reset" class="secondary-btn" style="display:${this.hasActiveFilters()?"inline-block":"none"};">Filter zurücksetzen</button>
      </div>
    </div>`,r=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Kooperationen</h1>
          <p>Verwalten Sie alle Kooperationen zwischen Creators und Kampagnen</p>
        </div>
        <div class="page-header-right">
          ${t?'<button id="btn-kooperation-new" class="primary-btn">Neue Kooperation anlegen</button>':""}
        </div>
      </div>

      <div class="table-filter-wrapper">
        ${a}
        <div class="table-actions">
          <button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
          <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>
        </div>
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th><input type="checkbox" id="select-all-kooperationen"></th>
              <th>Name</th>
              <th>Kampagne</th>
              <th>Creator</th>
              <th>Videos</th>
              <th>Status</th>
           <th>Gesamtkosten</th>
              <th>Start</th>
              <th>Ende</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody id="kooperationen-table-body">
            <tr>
              <td colspan="9" class="loading">Lade Kooperationen...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;window.setContentSafely(window.content,r)}async initializeFilterBar(){const e=document.getElementById("filter-container");e&&await A.renderFilterBar("kooperation",e,t=>this.onFiltersApplied(t),()=>this.onFiltersReset())}onFiltersApplied(e){console.log("🔍 KooperationList: Filter angewendet:",e),A.applyFilters("kooperation",e),this.loadAndRender()}onFiltersReset(){console.log("🔄 KooperationList: Filter zurückgesetzt"),A.resetFilters("kooperation"),this.loadAndRender()}bindEvents(){this.boundFilterResetHandler=e=>{e.target.id==="btn-filter-reset"&&this.onFiltersReset()},document.addEventListener("click",this.boundFilterResetHandler),document.addEventListener("click",e=>{(e.target.id==="btn-kooperation-new"||e.target.id==="btn-kooperation-new-filter")&&(e.preventDefault(),window.navigateTo("/kooperation/new"))}),document.addEventListener("click",e=>{if(e.target.id==="btn-select-all"){e.preventDefault(),document.querySelectorAll(".kooperation-check").forEach(a=>{a.checked=!0,a.dataset.id&&this.selectedKooperation.add(a.dataset.id)});const n=document.getElementById("select-all-kooperationen");n&&(n.indeterminate=!1,n.checked=!0),this.updateSelection()}}),document.addEventListener("click",e=>{if(e.target.id==="btn-deselect-all"){e.preventDefault(),document.querySelectorAll(".kooperation-check").forEach(a=>{a.checked=!1}),this.selectedKooperation.clear();const n=document.getElementById("select-all-kooperationen");n&&(n.indeterminate=!1,n.checked=!1),this.updateSelection()}}),document.addEventListener("click",e=>{if(e.target.classList.contains("table-link")&&e.target.dataset.table==="kooperation"){e.preventDefault();const t=e.target.dataset.id;console.log("🎯 KOOPERATIONLIST: Navigiere zu Kooperation Details:",t),window.navigateTo(`/kooperation/${t}`)}}),document.addEventListener("click",e=>{const t=e.target.closest&&e.target.closest(".action-item");if(t&&t.dataset.action==="video-create"&&t.dataset.id){e.preventDefault();const n=t.dataset.id;window.navigateTo(`/video/new?kooperation=${n}`)}}),window.addEventListener("entityUpdated",e=>{e.detail.entity==="kooperation"&&this.loadAndRender()}),document.addEventListener("click",e=>{if(e.target.classList.contains("tag-x")){e.preventDefault(),e.stopPropagation();const n=e.target.closest(".filter-tag").dataset.key,a=A.getFilters("kooperation");delete a[n],A.applyFilters("kooperation",a),this.loadAndRender()}}),document.addEventListener("change",e=>{e.target.id==="select-all-kooperationen"&&(document.querySelectorAll(".kooperation-check").forEach(n=>{n.checked=e.target.checked,e.target.checked?this.selectedKooperation.add(n.dataset.id):this.selectedKooperation.delete(n.dataset.id)}),this.updateSelection())}),document.addEventListener("change",e=>{e.target.classList.contains("kooperation-check")&&(e.target.checked?this.selectedKooperation.add(e.target.dataset.id):this.selectedKooperation.delete(e.target.dataset.id),this.updateSelection())})}hasActiveFilters(){const e=A.getFilters("kooperation");return Object.keys(e).length>0}updateSelection(){const e=this.selectedKooperation.size,t=document.getElementById("selected-count"),n=document.getElementById("btn-deselect-all"),a=document.getElementById("btn-delete-selected");t&&(t.textContent=`${e} ausgewählt`,t.style.display=e>0?"inline":"none"),n&&(n.style.display=e>0?"inline-block":"none"),a&&(a.style.display=e>0?"inline-block":"none")}async updateTable(e){const t=document.getElementById("kooperationen-table-body");if(!t)return;if(!e||e.length===0){const{renderEmptyState:a}=await x(async()=>{const{renderEmptyState:r}=await import("./core-C7Vz5Umf.js").then(i=>i.F);return{renderEmptyState:r}},[]);a(t);return}const n=e.map(a=>{const r=s=>s?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(s):"-",i=s=>s?new Date(s).toLocaleDateString("de-DE"):"-";return`
        <tr data-id="${a.id}">
          <td><input type="checkbox" class="kooperation-check" data-id="${a.id}"></td>
          <td>
            <a href="#" class="table-link" data-table="kooperation" data-id="${a.id}">
              ${window.validatorSystem.sanitizeHtml(a.name||"—")}
            </a>
          </td>
          <td>${window.validatorSystem.sanitizeHtml(a.kampagne?.kampagnenname||this._kampagneMap?.[a.kampagne_id]?.kampagnenname||"Unbekannt")}</td>
          <td>
            ${window.validatorSystem.sanitizeHtml(a.creator?`${a.creator.vorname} ${a.creator.nachname}`:this._creatorMap?.[a.creator_id]?`${this._creatorMap[a.creator_id].vorname} ${this._creatorMap[a.creator_id].nachname}`:"Unbekannt")}
          </td>
          <td>${a.videoanzahl||0}</td>
          <td>
            <span class="status-badge status-${(a.status||this.statusOptions.find(s=>s.id===a.status_id)?.name||"unknown").toLowerCase()}">
              ${a.status||this.statusOptions.find(s=>s.id===a.status_id)?.name||"-"}
            </span>
          </td>
          <td>${r(a.gesamtkosten)}</td>
          <td>${i(a.skript_deadline)}</td>
          <td>${i(a.content_deadline)}</td>
          <td>
            ${B.create("kooperation",a.id,window.currentUser,{statusOptions:this.statusOptions,currentStatus:{id:a.status_id,name:a.status}})}
          </td>
        </tr>
      `}).join("");t.innerHTML=n}async showDeleteSelectedConfirmation(){const e=this.selectedKooperation.size;if(e===0){alert("Keine Kooperationen ausgewählt.");return}const t=e===1?"Möchten Sie die ausgewählte Kooperation wirklich löschen?":`Möchten Sie die ${e} ausgewählten Kooperationen wirklich löschen?`;(await window.confirmationModal.open({title:"Löschvorgang bestätigen",message:t,confirmText:"Endgültig löschen",cancelText:"Abbrechen",danger:!0}))?.confirmed&&this.deleteSelectedKooperationen()}async deleteSelectedKooperationen(){const e=Array.from(this.selectedKooperation),t=e.length;console.log(`🗑️ Lösche ${t} Kooperationen...`),e.forEach(n=>{const a=document.querySelector(`tr[data-id="${n}"]`);a&&(a.style.opacity="0.5")});try{const n=await window.dataService.deleteEntities("kooperation",e);if(n.success){e.forEach(r=>{document.querySelector(`tr[data-id="${r}"]`)?.remove()}),alert(`✅ ${n.deletedCount} Kooperationen erfolgreich gelöscht.`),this.selectedKooperation.clear(),this.updateSelection();const a=document.querySelector("#kooperationen-table-body");a&&a.children.length===0&&await this.loadAndRender(),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"kooperation",action:"bulk-deleted",count:n.deletedCount}}))}else throw new Error(n.error||"Löschen fehlgeschlagen")}catch(n){e.forEach(a=>{const r=document.querySelector(`tr[data-id="${a}"]`);r&&(r.style.opacity="1")}),console.error("❌ Fehler beim Löschen:",n),alert(`❌ Fehler beim Löschen: ${n.message}`),await this.loadAndRender()}}destroy(){console.log("KooperationList: Cleaning up..."),this._boundEventListeners.forEach(({element:e,type:t,handler:n})=>{e.removeEventListener(t,n)}),this._boundEventListeners.clear(),this.boundFilterResetHandler&&(document.removeEventListener("click",this.boundFilterResetHandler),this.boundFilterResetHandler=null)}showCreateForm(){console.log("🎯 Zeige Kooperations-Erstellungsformular"),window.setHeadline("Neue Kooperation anlegen"),window.breadcrumbSystem&&window.breadcrumbSystem.updateBreadcrumb([{label:"Kooperation",url:"/kooperation",clickable:!0},{label:"Neue Kooperation",url:"/kooperation/new",clickable:!1}]);const e=window.formSystem.renderFormOnly("kooperation");window.content.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Neue Kooperation anlegen</h1>
          <p>Erstellen Sie eine neue Kooperation zwischen Creator und Kampagne</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/kooperation')" class="secondary-btn">Zurück zur Übersicht</button>
        </div>
      </div>
      
      <div class="form-page">
        ${e}
      </div>
    `,window.formSystem.bindFormEvents("kooperation",null);const t=document.getElementById("kooperation-form");t&&(t.onsubmit=async n=>{n.preventDefault(),await this.handleFormSubmit()})}async handleFormSubmit(){try{const e=document.getElementById("kooperation-form"),t=new FormData(e),n={};for(const[i,s]of t.entries())if(i.includes("[]")){const o=i.replace("[]","");n[o]||(n[o]=[]),n[o].push(s)}else n[i]=s;console.log("📝 Kooperation Submit-Daten:",n);const a=window.validatorSystem.validateForm(n,"kooperation");if(!a.isValid){this.showValidationErrors(a.errors);return}const r=await window.dataService.createEntity("kooperation",n);r.success&&window.formSystem&&await window.formSystem.handleKooperationVideos(r.id,e),r.success?(this.showSuccessMessage("Kooperation erfolgreich erstellt!"),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"kooperation",action:"created",id:r.id}}))):this.showErrorMessage(`Fehler beim Erstellen: ${r.error}`)}catch(e){console.error("❌ Fehler beim Erstellen der Kooperation:",e),this.showErrorMessage("Ein unerwarteter Fehler ist aufgetreten.")}}showValidationErrors(e){console.error("❌ Validierungsfehler:",e),document.querySelectorAll(".validation-error").forEach(t=>t.remove()),Object.entries(e).forEach(([t,n])=>{const a=document.querySelector(`[name="${t}"]`);if(a){const r=document.createElement("div");r.className="validation-error",r.textContent=n,a.parentNode.appendChild(r)}})}showSuccessMessage(e){const t=document.createElement("div");t.className="alert alert-success",t.textContent=e;const n=document.getElementById("kooperation-form");n&&(n.parentNode.insertBefore(t,n),setTimeout(()=>{t.remove()},5e3))}showErrorMessage(e){const t=document.createElement("div");t.className="alert alert-danger",t.textContent=e;const n=document.getElementById("kooperation-form");n&&(n.parentNode.insertBefore(t,n),setTimeout(()=>{t.remove()},5e3))}}const ve=new At;class $t{constructor(){this.drawerId="kooperation-versand-drawer",this.bindEvents()}bindEvents(){document.addEventListener("actionRequested",e=>{const{action:t,entityType:n,entityId:a}=e.detail;t==="showVersand"&&n==="kooperation"&&(console.log("🎯 VERSANDMANAGER: Event empfangen für ID:",a),this.open(a))})}async open(e){console.log("🎯 VERSANDMANAGER: open() aufgerufen mit ID:",e);try{console.log("🎯 VERSANDMANAGER: Erstelle Drawer"),await this.createDrawer(),console.log("🎯 VERSANDMANAGER: Zeige Loading"),this.showLoading(),console.log("🎯 VERSANDMANAGER: Lade Kooperation und Creator-Daten");const t=await this.loadKooperationData(e);console.log("🎯 VERSANDMANAGER: Kooperation-Daten geladen:",t);let n=null;try{console.log("🎯 VERSANDMANAGER: Lade Versand-Daten"),n=await this.loadVersandDaten(e),console.log("🎯 VERSANDMANAGER: Versand-Daten geladen:",n)}catch(a){console.warn("⚠️ Konnte Versand-Daten nicht laden, zeige leeres Formular:",a)}console.log("🎯 VERSANDMANAGER: Rendere Form"),this.renderForm(e,t,n),console.log("🎯 VERSANDMANAGER: Binde Events"),this.bindFormEvents(e),console.log("🎯 VERSANDMANAGER: Drawer sollte jetzt sichtbar sein")}catch(t){console.error("❌ VersandManager.open Fehler:",t),this.showError("Fehler beim Laden der Versand-Daten.")}}async createDrawer(){this.removeDrawer();const e=document.createElement("div");e.className="drawer-overlay",e.id=`${this.drawerId}-overlay`;const t=document.createElement("div");t.setAttribute("role","dialog"),t.className="drawer-panel",t.id=this.drawerId;const n=document.createElement("div");n.className="drawer-header";const a=document.createElement("div"),r=document.createElement("h1");r.textContent="Versand-Daten verwalten",r.style.margin="0",r.style.fontSize="1.25rem",r.style.fontWeight="600";const i=document.createElement("p");i.style.margin="0",i.style.color="#6b7280",i.style.fontSize="0.95rem",i.textContent="Tracking-Nummer und Versand-Status verwalten",a.appendChild(r),a.appendChild(i);const s=document.createElement("div"),o=document.createElement("button");o.className="drawer-close",o.textContent="Schließen",s.appendChild(o),n.appendChild(a),n.appendChild(s);const l=document.createElement("div");l.className="drawer-body",l.id=`${this.drawerId}-body`,t.appendChild(n),t.appendChild(l),e.addEventListener("click",()=>this.close()),o.addEventListener("click",()=>this.close()),document.body.appendChild(e),document.body.appendChild(t),requestAnimationFrame(()=>{t.classList.add("show")})}close(){const e=document.getElementById(this.drawerId);e&&(e.classList.remove("show"),setTimeout(()=>this.removeDrawer(),250))}removeDrawer(){const e=document.getElementById(`${this.drawerId}-overlay`),t=document.getElementById(this.drawerId);e&&e.remove(),t&&t.remove()}showLoading(){const e=document.getElementById(`${this.drawerId}-body`);e&&(e.innerHTML='<div class="drawer-loading">Lade Versand-Daten...</div>')}showError(e){const t=document.getElementById(`${this.drawerId}-body`);t&&(t.innerHTML=`<div class="alert alert-danger">${e}</div>`)}showSuccess(e){const t=document.getElementById(`${this.drawerId}-body`);if(!t)return;const n=document.createElement("div");n.className="alert alert-success",n.textContent=e,t.insertBefore(n,t.firstChild)}async loadKooperationData(e){if(!window.supabase)return{};const{data:t,error:n}=await window.supabase.from("kooperationen").select(`
        id, 
        name, 
        creator:creator_id(
          id, vorname, nachname, 
          lieferadresse_strasse, lieferadresse_hausnummer, 
          lieferadresse_plz, lieferadresse_stadt, lieferadresse_land
        )
      `).eq("id",e).single();if(n)throw n;return t||{}}async loadVersandDaten(e){if(!window.supabase)return[];try{const{data:t,error:n}=await window.supabase.from("kooperation_versand").select("*").eq("kooperation_id",e).order("created_at",{ascending:!1});return n?(console.warn("⚠️ Fehler beim Laden der Versand-Daten:",n),[]):t||[]}catch(t){return console.warn("⚠️ Fehler beim Laden der Versand-Daten:",t),[]}}renderForm(e,t,n){const a=document.getElementById(`${this.drawerId}-body`);if(!a)return;const r=t.creator;a.innerHTML=`
      <div class="versand-form-layout">
        <div class="creator-info">
          <h3>Creator & Lieferadresse</h3>
          <div class="creator-details">
            <div class="detail-item">
              <label>Name:</label>
              <span>${r?.vorname||""} ${r?.nachname||""}</span>
            </div>
            <div class="detail-item">
              <label>Kooperation:</label>
              <span>${t.name||"Unbekannt"}</span>
            </div>
          </div>
          
          <div class="address-preview">
            <h4>Lieferadresse (aus Creator-Profil)</h4>
            <div class="address-display">
              <div class="address-name">${r?.vorname||""} ${r?.nachname||""}</div>
              <div class="address-line">${r?.lieferadresse_strasse||""} ${r?.lieferadresse_hausnummer||""}</div>
              <div class="address-line">${r?.lieferadresse_plz||""} ${r?.lieferadresse_stadt||""}</div>
              <div class="address-line">${r?.lieferadresse_land||"Deutschland"}</div>
            </div>
            ${r?.lieferadresse_strasse?"":'<p class="address-warning">⚠️ Keine Lieferadresse im Creator-Profil hinterlegt</p>'}
          </div>
        </div>

        <div class="versand-table-section">
          <h3>Versand-Übersicht</h3>
          ${this.renderVersandTable(n,r)}
        </div>

        <form id="versand-form" data-kooperation-id="${e}" class="versand-form">
          <input type="hidden" name="kooperation_id" value="${e}">

          <div class="form-section">
            <h3>Neues Produkt versenden</h3>
            <div class="versand-details-grid">
              <div class="form-field">
                <label for="produkt_name">Produktname</label>
                <input type="text" name="produkt_name" placeholder="z.B. Produktpaket, Geschenkbox, etc." required>
              </div>
              <div class="form-field">
                <label for="tracking_nummer">Tracking-Nummer</label>
                <input type="text" name="tracking_nummer" placeholder="z.B. 1Z999AA1234567890">
                <small class="field-hint">Status wird automatisch auf "versendet" gesetzt</small>
              </div>
              <div class="form-field">
                <label for="versand_datum">Versand-Datum</label>
                <input type="date" name="versand_datum">
              </div>
              <div class="form-field">
                <label for="beschreibung">Beschreibung</label>
                <textarea name="beschreibung" rows="2" placeholder="Details zum Produkt...""></textarea>
              </div>
              <div class="form-field form-field-full">
                <label for="notizen">Versand-Notizen</label>
                <textarea name="notizen" rows="2" placeholder="Zusätzliche Notizen zum Versand..."></textarea>
              </div>
            </div>
          </div>

          <div class="drawer-actions">
            <button type="submit" class="primary-btn">Produkt hinzufügen</button>
            <button type="button" class="secondary-btn" data-close>Abbrechen</button>
          </div>
        </form>
      </div>
    `}renderVersandTable(e,t){if(!e||e.length===0)return`
        <div class="empty-state-small">
          <p>Noch keine Produkte versendet</p>
        </div>
      `;const n=i=>i?new Date(i).toLocaleDateString("de-DE"):"-",a=i=>i?.lieferadresse_strasse?`${i.lieferadresse_strasse} ${i.lieferadresse_hausnummer||""}, ${i.lieferadresse_plz||""} ${i.lieferadresse_stadt||""}, ${i.lieferadresse_land||"Deutschland"}`:"Keine Adresse hinterlegt";return`
      <div class="data-table-container">
        <table class="data-table versand-table">
          <thead>
            <tr>
              <th>Produkt</th>
              <th>Lieferadresse</th>
              <th class="text-center">Status</th>
              <th class="text-center">Tracking-Nr</th>
              <th class="text-center">Versand-Datum</th>
              <th class="text-center">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            ${e.map(i=>`
      <tr>
        <td>
          <div class="product-info">
            <div class="product-name">${window.validatorSystem.sanitizeHtml(i.produkt_name)}</div>
            ${i.beschreibung?`<div class="product-desc">${window.validatorSystem.sanitizeHtml(i.beschreibung)}</div>`:""}
          </div>
        </td>
        <td class="address-cell">
          <div class="address-compact">
            <div class="address-name">${t?.vorname||""} ${t?.nachname||""}</div>
            <div class="address-text">${a(t)}</div>
          </div>
        </td>
        <td class="text-center">
          <span class="status-badge ${i.versendet?"status-versendet":"status-offen"}">
            ${i.versendet?"Versendet":"Offen"}
          </span>
        </td>
        <td class="text-center">
          ${i.tracking_nummer?`<span class="tracking-number">${i.tracking_nummer}</span>`:"-"}
        </td>
        <td class="text-center">${n(i.versand_datum)}</td>
        <td class="text-center">
          <button class="btn-delete-versand" data-id="${i.id}" title="Löschen">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>
        </td>
      </tr>
    `).join("")}
          </tbody>
        </table>
      </div>
    `}bindFormEvents(e){const t=document.getElementById("versand-form");t&&(document.addEventListener("click",async n=>{if(n.target.closest(".btn-delete-versand")){n.preventDefault();const r=n.target.closest(".btn-delete-versand").dataset.id;confirm("Versand-Eintrag wirklich löschen?")&&await this.deleteVersandEintrag(r,e)}}),t.querySelector("[data-close]")?.addEventListener("click",()=>this.close()),t.addEventListener("submit",async n=>{n.preventDefault(),await this.handleSubmit(t,e)}))}async handleSubmit(e,t){try{const n=new FormData(e),a={kooperation_id:t};n.forEach((i,s)=>{s!=="kooperation_id"&&(i===""?a[s]=null:a[s]=i)});const r=a.tracking_nummer&&a.tracking_nummer.trim()!=="";if(a.versendet=r,window.supabase){const{error:i}=await window.supabase.from("kooperation_versand").insert(a);if(i)throw i}else window.dataService?.createEntity&&await window.dataService.createEntity("kooperation_versand",a);this.showSuccess("Versand-Daten gespeichert."),setTimeout(()=>this.close(),1200),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"kooperation_versand",kooperation_id:t,action:"saved"}}))}catch(n){console.error("❌ Versand-Daten speichern fehlgeschlagen:",n),this.showError(n.message||"Speichern fehlgeschlagen.")}}async deleteVersandEintrag(e,t){try{if(window.supabase){const{error:r}=await window.supabase.from("kooperation_versand").delete().eq("id",e);if(r)throw r}const n=await this.loadKooperationData(t),a=await this.loadVersandDaten(t);this.renderForm(t,n,a),this.bindFormEvents(t),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"kooperation_versand",kooperation_id:t,action:"deleted"}}))}catch(n){console.error("❌ Fehler beim Löschen des Versand-Eintrags:",n),alert("Fehler beim Löschen: "+n.message)}}}const Dt=new $t;window.kooperationVersandManager=Dt;class Lt{constructor(){this.kooperationId=null,this.kooperation=null,this.notizen=[],this.ratings=[],this.creator=null,this.kampagne=null,this.rechnungen=[],this.videos=[],this.history=[],this.historyCount=0,this.versandDaten=null}async init(e){if(console.log("🎯 KOOPERATIONDETAIL: Initialisiere Kooperations-Detailseite für ID:",e),this.kooperationId=e,window.moduleRegistry?.currentModule!==this){console.log("⚠️ KOOPERATIONDETAIL: Nicht mehr das aktuelle Modul, breche ab");return}try{await this.loadKooperationData(),window.breadcrumbSystem&&this.kooperation&&window.breadcrumbSystem.updateBreadcrumb([{label:"Kooperation",url:"/kooperation",clickable:!0},{label:this.kooperation.name||"Details",url:`/kooperation/${this.kooperationId}`,clickable:!1}]),await this.render(),this.bindEvents(),console.log("✅ KOOPERATIONDETAIL: Initialisierung abgeschlossen")}catch(t){console.error("❌ KOOPERATIONDETAIL: Fehler bei der Initialisierung:",t),window.ErrorHandler.handle(t,"KooperationDetail.init")}}async loadKooperationData(){console.log("🔄 KOOPERATIONDETAIL: Lade Kooperations-Daten...");const{data:e,error:t}=await window.supabase.from("kooperationen").select(`
        id, name, status, nettobetrag, zusatzkosten, gesamtkosten, skript_deadline, content_deadline, videoanzahl,
        creator_id, kampagne_id, unternehmen_id,
        creator:creator_id ( 
          id, vorname, nachname, instagram, instagram_follower, tiktok, tiktok_follower, mail,
          lieferadresse_strasse, lieferadresse_hausnummer, lieferadresse_plz, lieferadresse_stadt, lieferadresse_land
        ),
        kampagne:kampagne_id (
          id, kampagnenname, status, deadline, start, creatoranzahl, videoanzahl,
          unternehmen:unternehmen_id ( id, firmenname ),
          marke:marke_id ( id, markenname )
        ),
        unternehmen:unternehmen_id ( id, firmenname )
      `).eq("id",this.kooperationId).single();if(t)throw new Error(`Fehler beim Laden der Kooperations-Daten: ${t.message}`);if(this.kooperation=e,this.creator=e.creator,console.log("✅ KOOPERATIONDETAIL: Kooperations-Basisdaten geladen:",e),console.log("✅ KOOPERATIONDETAIL: Creator-Daten mit Adresse:",this.creator),this.notizen=await window.notizenSystem.loadNotizen("kooperation",this.kooperationId),console.log("✅ KOOPERATIONDETAIL: Notizen geladen:",this.notizen.length),window.bewertungsSystem)try{this.ratings=await window.bewertungsSystem.loadBewertungen("kooperation",this.kooperationId)}catch{this.ratings=[]}else this.ratings=[];this.creator=e.creator||null,this.kampagne=e.kampagne||null;try{const{data:n}=await window.supabase.from("rechnung").select("id, rechnung_nr, status, nettobetrag, bruttobetrag, gestellt_am, bezahlt_am, pdf_url").eq("kooperation_id",this.kooperationId).order("gestellt_am",{ascending:!1});this.rechnungen=n||[]}catch{this.rechnungen=[]}try{const{data:n}=await window.supabase.from("kooperation_videos").select("id, content_art, titel, asset_url, kommentar, status, position, created_at").eq("kooperation_id",this.kooperationId).order("position",{ascending:!0});if(this.videos=n||[],this.videos.length>0){const a=this.videos.map(i=>i.id),{data:r}=await window.supabase.from("kooperation_video_asset").select("id, video_id, file_url, version_number, is_current, created_at").in("video_id",a).eq("is_current",!0);this.videos=this.videos.map(i=>({...i,currentAsset:(r||[]).find(s=>s.video_id===i.id)||null}))}try{const a=e?.kampagne?.id||e?.kampagne_id;if(a){const{data:r}=await window.supabase.from("kooperationen").select("videoanzahl").eq("kampagne_id",a),i=(r||[]).reduce((o,l)=>o+(parseInt(l.videoanzahl,10)||0),0),s=parseInt(e?.kampagne?.videoanzahl,10)||null;this.campaignVideoTotals={total:s,used:i,remaining:s!=null?Math.max(0,s-i):null}}else this.campaignVideoTotals=null}catch{this.campaignVideoTotals=null}try{const a=(this.videos||[]).map(r=>r.id);if(a.length>0){const{data:r}=await window.supabase.from("kooperation_video_comment").select("id, video_id, runde, text, created_at, author_name, deleted_at").in("video_id",a).order("created_at",{ascending:!0}),i={};(r||[]).forEach(s=>{i[s.video_id]||(i[s.video_id]={r1:[],r2:[]});const o=s.runde===2||s.runde==="2"?"r2":"r1";i[s.video_id][o].push(s)}),this.videos=(this.videos||[]).map(s=>({...s,feedback1:i[s.id]?.r1||[],feedback2:i[s.id]?.r2||[]}))}}catch{}}catch{this.videos=[]}try{const{data:n}=await window.supabase.from("kooperation_history").select("id, old_status, new_status, comment, created_at, benutzer:changed_by(name)").eq("kooperation_id",this.kooperationId).order("created_at",{ascending:!1});this.history=(n||[]).map(a=>({id:a.id,old_status:a.old_status||null,new_status:a.new_status||null,comment:a.comment||"",created_at:a.created_at,user_name:a.benutzer?.name||"-"})),this.historyCount=this.history.length}catch{this.history=[],this.historyCount=0}try{const{data:n,error:a}=await window.supabase.from("kooperation_versand").select(`
          *,
          kooperation:kooperation_id(
            creator:creator_id(
              id, vorname, nachname,
              lieferadresse_strasse, lieferadresse_hausnummer, 
              lieferadresse_plz, lieferadresse_stadt, lieferadresse_land
            )
          )
        `).eq("kooperation_id",this.kooperationId).order("created_at",{ascending:!1});a?(console.log("ℹ️ KOOPERATIONDETAIL: Keine Versand-Daten vorhanden oder Tabelle existiert nicht"),this.versandDaten=[]):(this.versandDaten=n||[],console.log("✅ KOOPERATIONDETAIL: Versand-Daten mit Creator-Info geladen:",this.versandDaten.length,"Einträge"),this.versandDaten.length>0&&console.log("🔍 DEBUG: Erste Sendung Creator-Daten:",this.versandDaten[0].kooperation?.creator))}catch{this.versandDaten=[]}}async render(){if(!this.kooperation){this.showNotFound();return}const e=window.currentUser?.permissions?.kooperation?.can_edit||!1,t=this.kooperation.name||"Kooperation";window.setHeadline&&window.setHeadline(`Kooperation: ${window.validatorSystem?.sanitizeHtml?.(t)||t}`);const n=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>${window.validatorSystem.sanitizeHtml(t)}</h1>
          <p>Kooperations-Details und Aktivitäten</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/kooperation')" class="secondary-btn">Zurück zur Übersicht</button>
          ${e?'<button id="btn-edit-kooperation" class="primary-btn">Bearbeiten</button>':""}
        </div>
      </div>

      <div class="content-section">
        <div class="tab-navigation">
          <button class="tab-button active" data-tab="info">
            <i class="icon-information-circle"></i>
            Informationen
          </button>
          <button class="tab-button" data-tab="videos">
            <i class="icon-film"></i>
            Videos <span class="tab-count">${this.videos.length}</span>
          </button>
          <button class="tab-button" data-tab="notizen">
            <i class="icon-document-text"></i>
            Notizen <span class="tab-count">${this.notizen.length}</span>
          </button>
          <button class="tab-button" data-tab="ratings">
           
            Bewertungen <span class="tab-count">${this.ratings.length}</span>
          </button>
          <button class="tab-button" data-tab="history">
            
            History <span class="tab-count">${this.historyCount}</span>
          </button>
          <button class="tab-button" data-tab="rechnungen">
            <i class="icon-currency-euro"></i>
            Rechnungen <span class="tab-count">${this.rechnungen.length}</span>
          </button>
          <button class="tab-button" data-tab="versand">
            <i class="icon-truck"></i>
            Versand <span class="tab-count">${this.versandDaten?.length||0}</span>
          </button>
        </div>

        <div class="tab-content">
          <div class="tab-pane active" id="tab-info">
            ${this.renderInfo()}
          </div>
          <div class="tab-pane" id="tab-videos">
            <div class="detail-section">
              <h2>Videos ${this.renderVideoCounters()}</h2>
              ${this.renderVideos()}
            </div>
          </div>
          <div class="tab-pane" id="tab-notizen">
            <div class="detail-section">
              <h2>Notizen</h2>
              ${this.renderNotizen()}
            </div>
          </div>
          <div class="tab-pane" id="tab-ratings">
            <div class="detail-section">
              <h2>Bewertungen</h2>
              ${this.renderRatings()}
            </div>
          </div>
          <div class="tab-pane" id="tab-history">
            <div class="detail-section">
              <h2>History</h2>
              ${this.renderHistory()}
            </div>
          </div>
          <div class="tab-pane" id="tab-rechnungen">
            <div class="detail-section">
              <h2>Rechnungen</h2>
              ${this.renderRechnungen()}
            </div>
          </div>
          <div class="tab-pane" id="tab-versand">
            <div class="detail-section">
              <h2>Versand</h2>
              ${this.renderVersand()}
            </div>
          </div>
        </div>
      </div>
    `;window.setContentSafely(window.content,n)}renderVideoCounters(){try{const e=parseInt(this.kooperation?.videoanzahl,10)||0,n=`<span class="tag tag--type" title="Kooperation: hochgeladen/geplant">Koop: ${(this.videos||[]).length}/${e}</span>`,a=this.campaignVideoTotals;if(a&&a.total!=null){const r=`<span class="tag tag--type" title="Kampagne: genutzt/gesamt (offen)">Kampagne: ${a.used}/${a.total} (${Math.max(0,a.remaining)} offen)</span>`;return`${n} ${r}`}return n}catch{return""}}renderInfo(){const e=r=>r?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(r):"-",t=r=>r?new Date(r).toLocaleDateString("de-DE"):"-",n=this.creator?`
      <div class="detail-card">
        <h3>Creator</h3>
        <div class="detail-grid-2">
          <div class="detail-item"><label>Name</label><span>${this.creator.vorname} ${this.creator.nachname}</span></div>
          <div class="detail-item"><label>E-Mail</label><span>${this.creator.mail||"-"}</span></div>
          <div class="detail-item"><label>Instagram</label><span>${this.creator.instagram?`@${this.creator.instagram}`:"-"}</span></div>
          <div class="detail-item"><label>Instagram Follower</label><span>${this.creator.instagram_follower?this.formatNumber(this.creator.instagram_follower):"-"}</span></div>
          <div class="detail-item"><label>TikTok</label><span>${this.creator.tiktok?`@${this.creator.tiktok}`:"-"}</span></div>
          <div class="detail-item"><label>TikTok Follower</label><span>${this.creator.tiktok_follower?this.formatNumber(this.creator.tiktok_follower):"-"}</span></div>
        </div>
        <div class="detail-actions">
          <button onclick="window.navigateTo('/creator/${this.creator.id}')" class="secondary-btn">Creator Details anzeigen</button>
        </div>
      </div>
    `:'<div class="detail-card"><h3>Creator</h3><p>Keine Creator-Daten</p></div>',a=this.kampagne?`
      <div class="detail-card">
        <h3>Kampagne</h3>
        <div class="detail-grid-2">
          <div class="detail-item"><label>Name</label><span>${this.kampagne.kampagnenname}</span></div>
          <div class="detail-item"><label>Status</label><span class="status-badge status-${this.kampagne.status?.toLowerCase()||"unknown"}">${this.kampagne.status||"-"}</span></div>
          <div class="detail-item"><label>Unternehmen</label><span>${this.kampagne.unternehmen?.firmenname||"-"}</span></div>
          <div class="detail-item"><label>Marke</label><span>${this.kampagne.marke?.markenname||"-"}</span></div>
        </div>
        <div class="detail-actions">
          <button onclick="window.navigateTo('/kampagne/${this.kampagne.id}')" class="secondary-btn">Kampagne Details anzeigen</button>
        </div>
      </div>
    `:'<div class="detail-card"><h3>Kampagne</h3><p>Keine Kampagnen-Daten</p></div>';return`
      <div class="detail-section">
        <h2>Kooperations-Informationen</h2>
        <div class="detail-grid">
          <div class="detail-card">
            <h3>Allgemein</h3>
            <div class="detail-grid-2">
              <div class="detail-item"><label>Status</label><span class="status-badge status-${this.kooperation.status?.toLowerCase()||"unknown"}">${this.kooperation.status||"-"}</span></div>
              <div class="detail-item"><label>Budget</label><span>${e(this.kooperation.gesamtkosten??(this.kooperation.nettobetrag||0)+(this.kooperation.zusatzkosten||0))}</span></div>
              <div class="detail-item"><label>Skript-Deadline</label><span>${t(this.kooperation.skript_deadline)}</span></div>
              <div class="detail-item"><label>Content-Deadline</label><span>${t(this.kooperation.content_deadline)}</span></div>
            </div>
          </div>

          ${n}
          ${a}
        </div>
      </div>
    `}renderNotizen(){return window.notizenSystem?window.notizenSystem.renderNotizenContainer(this.notizen,"kooperation",this.kooperationId):!this.notizen||this.notizen.length===0?`
        <div class="empty-state">
          <p>Keine Notizen vorhanden</p>
        </div>
      `:`<div class="notizen-container">${this.notizen.map(t=>`
      <div class="notiz-card">
        <div class="notiz-header">
          <span>${t.user_name||"Unbekannt"}</span>
          <span>${new Date(t.created_at).toLocaleDateString("de-DE")}</span>
        </div>
        <div class="notiz-content"><p>${window.validatorSystem?.sanitizeHtml?.(t.text)||t.text}</p></div>
      </div>
    `).join("")}</div>`}renderRatings(){return window.bewertungsSystem?window.bewertungsSystem.renderBewertungenContainer(this.ratings,"kooperation",this.kooperationId):!this.ratings||this.ratings.length===0?`
        <div class="empty-state">
          <p>Keine Bewertungen vorhanden.</p>
        </div>
      `:""}renderHistory(){if(!this.history||this.history.length===0)return`
        <div class="empty-state">
          <p>Keine Historie vorhanden</p>
        </div>
      `;const e=n=>n?new Date(n).toLocaleString("de-DE"):"-";return`
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Zeitpunkt</th>
              <th>User</th>
              <th>Alt</th>
              <th>Neu</th>
              <th>Kommentar</th>
            </tr>
          </thead>
          <tbody>${this.history.map(n=>`
      <tr>
        <td>${e(n.created_at)}</td>
        <td>${window.validatorSystem.sanitizeHtml(n.user_name||"-")}</td>
        <td>${window.validatorSystem.sanitizeHtml(n.old_status||"-")}</td>
        <td>${window.validatorSystem.sanitizeHtml(n.new_status||"-")}</td>
        <td>${window.validatorSystem.sanitizeHtml(n.comment||"")}</td>
      </tr>
    `).join("")}</tbody>
        </table>
      </div>
    `}renderRechnungen(){if(!this.rechnungen||this.rechnungen.length===0)return'<p class="empty-state">Keine Rechnungen zu dieser Kooperation.</p>';const e=a=>a?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(a):"-",t=a=>a?new Date(a).toLocaleDateString("de-DE"):"-";return`
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Rechnungs-Nr</th>
              <th>Status</th>
              <th>Netto</th>
              <th>Brutto</th>
              <th>Gestellt</th>
              <th>Bezahlt</th>
              <th>Beleg</th>
            </tr>
          </thead>
          <tbody>${this.rechnungen.map(a=>`
      <tr>
        <td><a href="/rechnung/${a.id}" onclick="event.preventDefault(); window.navigateTo('/rechnung/${a.id}')">${window.validatorSystem.sanitizeHtml(a.rechnung_nr||"—")}</a></td>
        <td>${a.status||"-"}</td>
        <td>${e(a.nettobetrag)}</td>
        <td>${e(a.bruttobetrag)}</td>
        <td>${t(a.gestellt_am)}</td>
        <td>${t(a.bezahlt_am)}</td>
        <td>${a.pdf_url?`<a href="${a.pdf_url}" target="_blank" rel="noopener">PDF</a>`:"-"}</td>
      </tr>
    `).join("")}</tbody>
        </table>
      </div>
    `}renderVideos(){const e=window.currentUser?.permissions?.kooperation?.can_edit||window.currentUser?.rolle==="admin",t=window.currentUser?.rolle==="admin"||window.currentUser?.rolle==="mitarbeiter",n=parseInt(this.kooperation?.videoanzahl,10)||0,a=(this.videos||[]).length,r=n===0||a<n,i=e&&t?`
      <div class="table-actions" style="margin-bottom: 8px;">
        <div class="table-actions-left"></div>
        <div class="table-actions-right">
          ${r?'<button id="btn-goto-video-create" class="primary-btn">Video hinzufügen</button>':'<button class="secondary-btn" disabled title="Limit erreicht">Limit erreicht</button>'}
        </div>
      </div>`:"";if(!this.videos||this.videos.length===0)return`${i}<p class="empty-state">Keine Videos angelegt.</p>`;const s=this.videos.map(o=>{const l=h=>!h||h.length===0?"-":h.map(p=>{const g=p.created_at?new Date(p.created_at).toLocaleDateString("de-DE"):"",b=p.author_name||"",y=window.validatorSystem.sanitizeHtml(p.text||"");return`<div class="fb-line"><span class="fb-meta">${b}${g?" • "+g:""}</span><div class="fb-text">${y}</div></div>`}).join(""),u=window.currentUser?.rolle,d=u==="kunde",c=u==="admin",m=`
        <div class="actions-dropdown-container" data-entity-type="kooperation_videos">
          <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
          </button>
          <div class="actions-dropdown">
            ${d?"":`
            <div class="action-submenu">
              <a href="#" class="action-item has-submenu" data-submenu="status">
                ${I.getHeroIcon("invoice")}
                <span>Status ändern</span>
              </a>
              <div class="submenu" data-submenu="status">
                <a href="#" class="submenu-item" data-action="set-field" data-field="status" data-value="produktion" data-id="${o.id}">
                  ${I.getStatusIcon("Kick-Off")}
                  <span>Produktion</span>
                  ${(o.status||"produktion")==="produktion"?'<span class="submenu-check">✓</span>':""}
                </a>
                <a href="#" class="submenu-item" data-action="set-field" data-field="status" data-value="abgeschlossen" data-id="${o.id}">
                  ${I.getHeroIcon("check")}
                  <span>Abgeschlossen</span>
                  ${o.status==="abgeschlossen"?'<span class="submenu-check">✓</span>':""}
                </a>
              </div>
            </div>
            `}
            <a href="#" class="action-item" data-action="video-view" data-id="${o.id}">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              Details ansehen
            </a>
            ${d?"":`
            <a href="#" class="action-item" data-action="video-edit" data-id="${o.id}">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
              </svg>
              Bearbeiten
            </a>
            `}
            ${c?`
            <div class="action-separator"></div>
            <a href="#" class="action-item action-danger" data-action="video-delete" data-id="${o.id}">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
              Löschen
            </a>
            `:""}
          </div>
        </div>`;return`
        <tr>
          <td>${o.position||"-"}</td>
          <td>${window.validatorSystem.sanitizeHtml(o.content_art||"-")}</td>
          <td>
            ${o.titel?`<a href="/video/${o.id}" class="table-link" data-table="video" data-id="${o.id}">${window.validatorSystem.sanitizeHtml(o.titel)}</a>`:o.asset_url?`<a href="${o.asset_url}" target="_blank" rel="noopener">Link</a>`:"-"}
            ${o.currentAsset?`<span class="version-badge" style="margin-left:8px;">V${o.currentAsset.version_number||1}</span>`:""}
          </td>
          <td class="feedback-cell">${l(o.feedback1)}</td>
          <td class="feedback-cell">${l(o.feedback2)}</td>
          <td><span class="status-badge status-${(o.status||"produktion").toLowerCase()}">${o.status==="abgeschlossen"?"Abgeschlossen":"Produktion"}</span></td>
          <td>${m}</td>
        </tr>`}).join("");return`
      ${i}
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Content Art</th>
              <th>URL</th>
              <th>Feedback K1</th>
              <th>Feedback K2</th>
              <th>Status</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>${s}</tbody>
        </table>
      </div>
    `}bindEvents(){document.addEventListener("click",e=>{e.target.classList?.contains("tab-button")&&(e.preventDefault(),this.switchTab(e.target.dataset.tab))}),document.addEventListener("click",e=>{const t=e.target.closest&&e.target.closest(".table-link");t&&t.dataset.table==="video"&&t.dataset.id&&(e.preventDefault(),window.navigateTo(`/video/${t.dataset.id}`))}),document.addEventListener("click",e=>{e.target.id==="btn-edit-kooperation"&&(e.preventDefault(),this.showEditForm())}),window.addEventListener("notizenUpdated",async e=>{if(e.detail.entityType==="kooperation"&&e.detail.entityId===this.kooperationId){this.notizen=await window.notizenSystem.loadNotizen("kooperation",this.kooperationId);const t=document.querySelector("#tab-notizen .detail-section");t&&(t.innerHTML=`<h2>Notizen</h2>${this.renderNotizen()}`);const n=document.querySelector('.tab-button[data-tab="notizen"] .tab-count');n&&(n.textContent=String(this.notizen.length))}}),window.addEventListener("entityUpdated",e=>{e.detail.entity==="kooperation_versand"&&e.detail.kooperation_id==this.kooperationId&&this.loadKooperationData().then(()=>{this.render(),this.bindEvents()})}),window.addEventListener("entityUpdated",async e=>{if(e.detail?.entity==="kooperation_videos"){await this.loadKooperationData();const t=document.querySelector("#tab-videos .detail-section");if(t&&(t.innerHTML=`<h2>Videos</h2>${this.renderVideos()}`),window.location.pathname.startsWith("/video/"))try{const n=window.location.pathname.split("/").pop();n&&window.navigateTo(`/video/${n}`)}catch{}}}),document.addEventListener("click",e=>{e.target&&e.target.id==="btn-goto-video-create"&&(e.preventDefault(),window.navigateTo(`/video/new?kooperation=${this.kooperationId}`))}),document.addEventListener("click",async e=>{const t=e.target.closest(".action-item");if(!t)return;const n=t.dataset.action,a=t.dataset.id;if(n==="video-view"&&a)e.preventDefault(),window.navigateTo(`/video/${a}`);else if(n==="video-edit"&&a)e.preventDefault(),alert("Video-Bearbeitung noch nicht implementiert");else if(n==="video-delete"&&a){if(e.preventDefault(),!confirm("Video wirklich löschen?"))return;try{const{error:r}=await window.supabase.from("kooperation_videos").delete().eq("id",a);if(r)throw r;await this.loadKooperationData();const i=document.querySelector("#tab-videos .detail-section");i&&(i.innerHTML=`<h2>Videos</h2>${this.renderVideos()}`)}catch(r){console.error("Video löschen fehlgeschlagen",r),alert("Video konnte nicht gelöscht werden.")}}})}showEditForm(){console.log("🎯 Zeige Kooperations-Bearbeitungsformular"),window.setHeadline("Kooperation bearbeiten");const e=window.formSystem.renderFormOnly("kooperation",this.kooperation);window.content.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Kooperation bearbeiten</h1>
          <p>Bearbeiten Sie die Kooperations-Details</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/kooperation/${this.kooperationId}')" class="secondary-btn">Zurück zu Details</button>
        </div>
      </div>
      
      <div class="form-page">
        ${e}
      </div>
    `,window.formSystem.bindFormEvents("kooperation",this.kooperationId);const t=document.getElementById("kooperation-form");t&&(t.onsubmit=async n=>{n.preventDefault(),await this.handleEditFormSubmit()})}async handleEditFormSubmit(){try{const e=document.getElementById("kooperation-form"),t=new FormData(e),n={};for(const[i,s]of t.entries())if(i.includes("[]")){const o=i.replace("[]","");n[o]||(n[o]=[]),n[o].push(s)}else n[i]=s;console.log("📝 Kooperation Edit Submit-Daten:",n);const a=window.validatorSystem.validateForm(n,"kooperation");if(!a.isValid){this.showValidationErrors(a.errors);return}const r=await window.dataService.updateEntity("kooperation",this.kooperationId,n);r.success?(this.showSuccessMessage("Kooperation erfolgreich aktualisiert!"),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"kooperation",action:"updated",id:this.kooperationId}})),setTimeout(()=>{window.navigateTo(`/kooperation/${this.kooperationId}`)},1500)):this.showErrorMessage(`Fehler beim Aktualisieren: ${r.error}`)}catch(e){console.error("❌ Fehler beim Aktualisieren der Kooperation:",e),this.showErrorMessage("Ein unerwarteter Fehler ist aufgetreten.")}}showAddNotizModal(){window.notizenSystem.showAddNotizModal("kooperation",this.kooperationId,()=>{this.loadKooperationData().then(()=>{this.render()})})}switchTab(e){document.querySelectorAll(".tab-button").forEach(a=>a.classList.remove("active")),document.querySelectorAll(".tab-pane").forEach(a=>a.classList.remove("active"));const t=document.querySelector(`[data-tab="${e}"]`),n=document.getElementById(`tab-${e}`);t&&n&&(t.classList.add("active"),n.classList.add("active"))}showNotFound(){window.setHeadline("Kooperation nicht gefunden"),window.content.innerHTML=`
      <div class="error-message">
        <h2>Kooperation nicht gefunden</h2>
        <p>Die angeforderte Kooperation konnte nicht gefunden werden.</p>
        <button onclick="window.navigateTo('/kooperation')" class="primary-btn">Zurück zur Übersicht</button>
      </div>
    `}showValidationErrors(e){console.error("❌ Validierungsfehler:",e),document.querySelectorAll(".validation-error").forEach(t=>t.remove()),Object.entries(e).forEach(([t,n])=>{const a=document.querySelector(`[name="${t}"]`);if(a){const r=document.createElement("div");r.className="validation-error",r.textContent=n,a.parentNode.appendChild(r)}})}showSuccessMessage(e){const t=document.createElement("div");t.className="alert alert-success",t.textContent=e;const n=document.getElementById("kooperation-form");n&&(n.parentNode.insertBefore(t,n),setTimeout(()=>{t.remove()},5e3))}showErrorMessage(e){const t=document.createElement("div");t.className="alert alert-danger",t.textContent=e;const n=document.getElementById("kooperation-form");n&&(n.parentNode.insertBefore(t,n),setTimeout(()=>{t.remove()},5e3))}formatNumber(e){return e?new Intl.NumberFormat("de-DE").format(e):"-"}formatCurrency(e){return e?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(e):"-"}formatDate(e){return e?new Date(e).toLocaleDateString("de-DE"):"-"}renderVersand(){if(!this.versandDaten||this.versandDaten.length===0)return`
        <div class="empty-state">
          <div class="empty-icon">📦</div>
          <h3>Keine Versand-Daten vorhanden</h3>
          <p>Es wurden noch keine Produkte für diese Kooperation versendet.</p>
          <button onclick="window.kooperationVersandManager?.open('${this.kooperationId}')" class="primary-btn">
            Erstes Produkt versenden
          </button>
        </div>
      `;const e=this.versandDaten,t=this.kooperation?.creator||this.creator,n=i=>i?new Date(i).toLocaleDateString("de-DE"):"-",a=i=>{if(console.log("🔍 DEBUG formatAddress - Creator:",i),!i?.lieferadresse_strasse)return console.log("⚠️ DEBUG: Keine lieferadresse_strasse gefunden"),"Keine Adresse hinterlegt";const s=`${i.lieferadresse_strasse} ${i.lieferadresse_hausnummer||""}, ${i.lieferadresse_plz||""} ${i.lieferadresse_stadt||""}, ${i.lieferadresse_land||"Deutschland"}`;return console.log("✅ DEBUG: Formatierte Adresse:",s),s},r=e.map(i=>{const s=i.kooperation?.creator||t;return`
        <tr>
          <td>
            <div class="product-info">
              <div class="product-name">${window.validatorSystem.sanitizeHtml(i.produkt_name)}</div>
              ${i.beschreibung?`<div class="product-desc">${window.validatorSystem.sanitizeHtml(i.beschreibung)}</div>`:""}
            </div>
          </td>
          <td class="address-cell">
            <div class="address-compact">
              <div class="address-name">${s?.vorname||""} ${s?.nachname||""}</div>
              <div class="address-text">${a(s)}</div>
            </div>
          </td>
          <td class="text-center">
            <span class="status-badge ${i.versendet?"status-versendet":"status-offen"}">
              ${i.versendet?"Versendet":"Offen"}
            </span>
          </td>
          <td class="text-center">
            ${i.tracking_nummer?`<span class="tracking-number">${i.tracking_nummer}</span>`:"-"}
          </td>
          <td class="text-center">${n(i.versand_datum)}</td>
        </tr>
      `}).join("");return`
      <div class="versand-container">
        <div class="section-header">
          <h3>Versand-Übersicht</h3>
          <button onclick="window.kooperationVersandManager?.open('${this.kooperationId}')" class="secondary-btn">
            Neues Produkt versenden
          </button>
        </div>

        <div class="data-table-container">
          <table class="data-table versand-table">
            <thead>
              <tr>
                <th>Produkt</th>
                <th>Lieferadresse</th>
                <th class="text-center">Status</th>
                <th class="text-center">Tracking-Nr</th>
                <th class="text-center">Versand-Datum</th>
              </tr>
            </thead>
            <tbody>
              ${r}
            </tbody>
          </table>
        </div>
      </div>
    `}destroy(){console.log("KooperationDetail: Cleaning up...")}}const ye=new Lt,ke={videoId:null,video:null,kooperation:null,comments:[],assets:[],async init(f){try{const t=new URL(window.location.href).searchParams.get("kooperation");this.videoId=f&&f!=="new"?f:null;const n=this.videoId?"detail":"new";if(!this.videoId&&n==="new"){if(window.setHeadline("Neues Video"),!(window.currentUser?.permissions?.kooperation?.can_edit||window.currentUser?.rolle==="admin")){window.content.innerHTML='<p class="empty-state">Keine Berechtigung.</p>';return}const r=t?await this.fetchKooperationInfo(t):null;window.breadcrumbSystem&&r&&window.breadcrumbSystem.updateBreadcrumb([{label:"Kooperation",url:"/kooperation",clickable:!0},{label:r.name||"Details",url:`/kooperation/${t}`,clickable:!0},{label:"Neues Video",url:"#",clickable:!1}]);const i=parseInt(r?.videoanzahl,10)||0,{data:s}=t?await window.supabase.from("kooperation_videos").select("id").eq("kooperation_id",t):{data:[]},o=(s||[]).length,l=i>0&&o>=i,u=r?.name||"-",d=r?.kampagne?.kampagnenname||"-",c=`
          <div class="page-header">
            <div class="page-header-left">
              <h1>Neues Video</h1>
              <p>Kooperation: ${window.validatorSystem?.sanitizeHtml?.(u)||"-"} · Kampagne: ${window.validatorSystem?.sanitizeHtml?.(d)||"-"}</p>
            </div>
            <div class="page-header-right">
              ${t?'<button id="btn-back-to-kooperation" class="secondary-btn">Zur Kooperation</button>':""}
            </div>
          </div>
          <div class="form-page">
            ${l?`<div class="alert alert-danger">Videolimit erreicht (${o}/${i}). Es können keine weiteren Videos angelegt werden.</div>`:""}
            <form id="video-create-form" class="entity-form" data-entity="kooperation_videos">
              <div class="form-grid">
                <div class="form-field">
                  <label>Titel</label>
                  <input type="text" name="titel" class="form-input" placeholder="z. B. Hook/Intro" required />
                </div>
                <div class="form-field">
                  <label>Content Art</label>
                  <select name="content_art" class="form-input">
                    <option value="">– bitte wählen –</option>
                    <option value="Paid">Paid</option>
                    <option value="Organisch">Organisch</option>
                    <option value="Influencer">Influencer</option>
                    <option value="Videograph">Videograph</option>
                  </select>
                </div>
                <div class="form-field">
                  <label>Asset URL</label>
                  <input type="url" name="asset_url" class="form-input" placeholder="https://..." />
                </div>
                <input type="hidden" name="kooperation_id" value="${t||""}" />
              </div>
              <div class="form-actions">
                <button type="submit" class="primary-btn mdc-btn" data-default-text="Video anlegen" data-success-text="Video angelegt" ${l?"disabled":""}>Video anlegen</button>
                ${t?'<button type="button" id="btn-cancel-create" class="secondary-btn">Abbrechen</button>':""}
              </div>
            </form>
          </div>`;window.setContentSafely(window.content,c),this.bindCreateEvents(t);return}await this.loadData(),window.breadcrumbSystem&&this.video&&this.kooperation&&window.breadcrumbSystem.updateBreadcrumb([{label:"Kooperation",url:"/kooperation",clickable:!0},{label:this.kooperation.name||"Details",url:`/kooperation/${this.kooperation.id}`,clickable:!0},{label:this.video.titel||"Video",url:`/video/${this.videoId}`,clickable:!1}]),this.render(),this.bindEvents()}catch(e){console.error("KooperationVideoDetail init error:",e),window.notificationSystem?.error?.("Video-Detail konnte nicht geladen werden.")}},async fetchKooperationInfo(f){try{const{data:e}=await window.supabase.from("kooperationen").select("id, name, kampagne:kampagne_id(id, kampagnenname)").eq("id",f).single();return e||null}catch{return null}},bindCreateEvents(f){document.getElementById("btn-back-to-kooperation")?.addEventListener("click",t=>{t.preventDefault(),f&&window.navigateTo(`/kooperation/${f}`)}),document.getElementById("btn-cancel-create")?.addEventListener("click",t=>{t.preventDefault(),f&&window.navigateTo(`/kooperation/${f}`)});const e=document.getElementById("video-create-form");if(e){const t=e.querySelector('input[name="kooperation_id"]');t&&!t.value&&f&&(t.value=f),e.addEventListener("submit",async n=>{n.preventDefault();const a=e.querySelector(".mdc-btn"),r=new FormData(e),i={kooperation_id:r.get("kooperation_id")||f||null,titel:String(r.get("titel")||"").trim()||null,content_art:String(r.get("content_art")||"").trim()||null,asset_url:String(r.get("asset_url")||"").trim()||null,status:"produktion"};if(!i.kooperation_id||!i.titel){alert("Bitte Kooperation und Titel angeben.");return}try{a&&(a.disabled=!0,a.classList.add("is-loading"));let s=1;try{const{data:u}=await window.supabase.from("kooperation_videos").select("position").eq("kooperation_id",f).order("position",{ascending:!1}).limit(1);s=(u&&u[0]&&parseInt(u[0].position,10)||0)+1}catch{}const{data:o,error:l}=await window.supabase.from("kooperation_videos").insert({...i,position:s}).select("id").single();if(l)throw l;if(o&&o.id&&i.asset_url)try{await window.supabase.from("kooperation_video_asset").insert({video_id:o.id,file_url:i.asset_url,file_path:i.asset_url,version_number:1,is_current:!0,description:"Initiales Video",uploaded_by:window.currentUser?.id||null,created_at:new Date().toISOString()}),console.log("✅ Initiales Asset (V1) erstellt für Video:",o.id)}catch(u){console.warn("⚠️ Asset V1 konnte nicht erstellt werden:",u)}try{await this.sendVideoUploadNotifications(o.id,!1)}catch(u){console.warn("⚠️ Video-Upload-Benachrichtigung konnte nicht versendet werden:",u)}a&&(a.classList.remove("is-loading"),a.classList.add("is-success"),a.textContent=a.dataset.successText||"Angelegt"),setTimeout(()=>{window.navigateTo(`/kooperation/${f}`)},400)}catch(s){console.error("Video anlegen fehlgeschlagen",s),a&&(a.classList.remove("is-loading"),a.disabled=!1),alert("Video konnte nicht angelegt werden.")}})}},async loadData(){const{data:f,error:e}=await window.supabase.from("kooperation_videos").select("id, kooperation_id, titel, content_art, asset_url, kommentar, status, position, created_at").eq("id",this.videoId).single();if(e)throw e;this.video=f;try{const{data:t}=await window.supabase.from("kooperationen").select("id, name, kampagne:kampagne_id(id, kampagnenname)").eq("id",f.kooperation_id).single();this.kooperation=t||null}catch{this.kooperation=null}try{const{data:t}=await window.supabase.from("kooperation_video_comment").select("id, video_id, runde, text, author_name, author_benutzer_id, created_at, deleted_at, deleted_by_benutzer_id").eq("video_id",this.videoId).order("created_at",{ascending:!0});this.comments=t||[]}catch{this.comments=[]}try{const{data:t}=await window.supabase.from("kooperation_video_asset").select("id, file_url, file_path, version_number, is_current, description, uploaded_by, created_at").eq("video_id",this.videoId).order("version_number",{ascending:!1});this.assets=t||[]}catch{this.assets=[]}},render(){const f=this.video||{},e=f.titel||`Video #${f.id}`,t=this.kooperation?.name||"-",n=this.kooperation?.kampagne?.kampagnenname||"-",a=c=>window.validatorSystem?.sanitizeHtml?.(c)??c,r=c=>c?new Date(c).toLocaleString("de-DE"):"-";typeof window.setHeadline=="function"&&window.setHeadline(`Video: ${a(e)}`);const i=window.currentUser?.permissions?.kooperation?.can_edit||window.currentUser?.rolle==="admin",s=window.currentUser?.rolle==="admin"||window.currentUser?.rolle==="mitarbeiter";(this.assets.find(c=>c.is_current)||this.assets[0])?.file_url||f.asset_url;const l={r1:[],r2:[]};(this.comments||[]).forEach(c=>{const m=c.runde===2||c.runde==="2"?"r2":"r1";l[m].push(c)});const u=this.renderAssetVersions(this.assets,a,r,i),d=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>${a(e)}</h1>
          <p>Kooperation: ${a(t)} · Kampagne: ${a(n)}</p>
        </div>
        <div class="page-header-right">
          ${f.kooperation_id?'<button id="btn-back-kooperation" class="secondary-btn">Zur Kooperation</button>':""}
        </div>
      </div>

      <!-- Tab-Navigation -->
      <div class="tab-navigation">
        <button class="tab-button active" data-tab="info">
          Informationen
        </button>
        <button class="tab-button" data-tab="videos">
          Videos & Feedback
        </button>
      </div>

      <div class="tab-content">
        <!-- Tab: Informationen -->
        <div class="tab-pane active" id="tab-info">
          <div class="detail-card">
            <h3>Informationen</h3>
            <div class="detail-grid-2">
              <div class="detail-item"><label>Content-Art</label><span>${a(f.content_art||"-")}</span></div>
              <div class="detail-item"><label>Position</label><span>${f.position||"-"}</span></div>
              <div class="detail-item"><label>Status</label>
                <span class="status-badge status-${(f.status||"produktion").toLowerCase()}">${f.status==="abgeschlossen"?"Abgeschlossen":"Produktion"}</span>
              </div>
              <div class="detail-item"><label>Erstellt</label><span>${r(f.created_at)}</span></div>
            </div>
            ${i?`
            <div class="form-inline" style="margin-top:var(--space-sm);gap:var(--space-xs);display:flex;align-items:center;">
              <label>Status ändern:</label>
              <select id="video-status" class="form-input" style="max-width:220px;">
                <option value="produktion" ${f.status!=="abgeschlossen"?"selected":""}>Produktion</option>
                <option value="abgeschlossen" ${f.status==="abgeschlossen"?"selected":""}>Abgeschlossen</option>
              </select>
              <button id="btn-save-status" class="mdc-btn mdc-btn--create" data-variant="@create-prd.mdc">
                <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">${window.formSystem?.formRenderer?.getCheckIcon?.()||"✔"}</span>
                <span class="mdc-btn__spinner" aria-hidden="true">${window.formSystem?.formRenderer?.getSpinnerIcon?.()||""}</span>
                <span class="mdc-btn__label">Speichern</span>
              </button>
            </div>`:""}
          </div>
        </div>

        <!-- Tab: Videos & Feedback -->
        <div class="tab-pane" id="tab-videos">
          <div class="detail-card">
            <h3>Video-Versionen</h3>
            ${u}
            ${s?`
            <div class="asset-upload-section" style="margin-top:var(--space-md);padding-top:var(--space-md);border-top:var(--border-xs) solid var(--border-primary);">
              <h4 style="margin:0 0 var(--space-sm) 0;">Neue Video-Version hochladen</h4>
              <form id="asset-upload-form">
                <div class="detail-grid-2">
                  <div class="form-field" style="grid-column: span 2;">
                    <label>Asset URL</label>
                    <input type="url" name="file_url" class="form-input" placeholder="https://..." required />
                  </div>
                  <div class="form-field" style="grid-column: span 2;">
                    <label>Beschreibung (optional)</label>
                    <textarea name="description" class="form-input" rows="2" placeholder="z.B. Feedback aus Runde 1 eingearbeitet"></textarea>
                  </div>
                </div>
                <button type="submit" class="primary-btn" style="margin-top:var(--space-xs);">Version hochladen</button>
              </form>
            </div>`:""}
          </div>

          <div class="detail-grid">
            <div class="detail-card">
              <h3>Feedback Runde 1</h3>
              <div id="comments-r1">${this.renderCommentsTable(l.r1)}</div>
            </div>
            <div class="detail-card">
              <h3>Feedback Runde 2</h3>
              <div id="comments-r2">${this.renderCommentsTable(l.r2)}</div>
            </div>
          </div>

          <div class="detail-card">
            <h3>Kommentar hinzufügen</h3>
            <form id="comment-form">
              <div class="detail-grid-2">
                <div class="form-field">
                  <label>Runde</label>
                  <select name="runde" class="form-input">
                    <option value="1">1</option>
                    <option value="2">2</option>
                  </select>
                </div>
                <div class="form-field" style="grid-column: span 2;">
                  <label>Text</label>
                  <textarea name="text" class="form-input" rows="3" placeholder="Kommentar eingeben..."></textarea>
                </div>
              </div>
              <div style="margin-top:var(--space-xs);">
                <button type="submit" class="mdc-btn mdc-btn--create" data-variant="@create-prd.mdc" data-default-text="Speichern" data-success-text="Gespeichert">
                  <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">${window.formSystem?.formRenderer?.getCheckIcon?.()||"✔"}</span>
                  <span class="mdc-btn__spinner" aria-hidden="true">${window.formSystem?.formRenderer?.getSpinnerIcon?.()||""}</span>
                  <span class="mdc-btn__label">Speichern</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;window.setContentSafely(window.content,d)},async sendFeedbackNotifications(f){if(!this.video?.kooperation_id||!window.currentUser?.id)return;const e=window.currentUser?.rolle==="kunde",t=window.currentUser?.rolle==="mitarbeiter"||window.currentUser?.rolle==="admin";try{if(t){const{data:n}=await window.supabase.from("kooperationen").select(`
            id,
            name,
            kampagne:kampagne_id(
              id,
              kampagnenname,
              marke:marke_id(
                id,
                markenname,
                kunden_marken!inner(kunde_id)
              )
            )
          `).eq("id",this.video.kooperation_id).single();if(n?.kampagne?.marke?.kunden_marken){const a=n.kampagne.marke.kunden_marken.map(s=>s.kunde_id).filter(Boolean),r=this.video?.titel||`Video #${this.videoId}`,i=n.name||"Unbekannte Kooperation";if(a.length>0){const s=a.map(o=>({user_id:o,type:"feedback",entity:"kooperation_videos",entity_id:this.videoId,title:"Neues Video-Feedback",message:`Neues Feedback (Runde ${f}) für Video "${r}" in Kooperation "${i}"`,created_at:new Date().toISOString()}));await window.supabase.from("notifications").insert(s),window.dispatchEvent(new Event("notificationsRefresh"))}}}else if(e){const{data:n}=await window.supabase.from("kooperationen").select(`
            id,
            name,
            kampagne:kampagne_id(
              id,
              kampagnenname,
              kampagne_mitarbeiter!inner(mitarbeiter_id)
            )
          `).eq("id",this.video.kooperation_id).single();if(n?.kampagne?.kampagne_mitarbeiter){const a=n.kampagne.kampagne_mitarbeiter.map(s=>s.mitarbeiter_id).filter(Boolean),r=this.video?.titel||`Video #${this.videoId}`,i=n.name||"Unbekannte Kooperation";if(a.length>0){const s=a.map(o=>({user_id:o,type:"feedback",entity:"kooperation_videos",entity_id:this.videoId,title:"Kunden-Feedback erhalten",message:`Kunde hat Feedback (Runde ${f}) für Video "${r}" in Kooperation "${i}" gegeben`,created_at:new Date().toISOString()}));await window.supabase.from("notifications").insert(s),window.dispatchEvent(new Event("notificationsRefresh"))}}}}catch(n){console.error("❌ Fehler beim Versenden der Feedback-Benachrichtigungen:",n)}},async sendVideoUploadNotifications(f,e=!1){if(!(!f||!(window.currentUser?.rolle==="mitarbeiter"||window.currentUser?.rolle==="admin")))try{const{data:n}=await window.supabase.from("kooperation_videos").select(`
          id,
          titel,
          kooperation:kooperation_id(
            id,
            name,
            kampagne:kampagne_id(
              id,
              kampagnenname,
              marke:marke_id(
                id,
                markenname,
                kunde_marke!inner(kunde_id)
              )
            )
          )
        `).eq("id",f).single();if(n?.kooperation?.kampagne?.marke?.kunde_marke){const a=n.kooperation.kampagne.marke.kunde_marke.map(s=>s.kunde_id).filter(Boolean),r=n.titel||`Video #${f}`,i=n.kooperation.name||"Unbekannte Kooperation";if(a.length>0){const s=a.map(o=>({user_id:o,type:"video_upload",entity:"kooperation_videos",entity_id:f,title:e?"Neue Video-Version hochgeladen":"Neues Video hochgeladen",message:e?`Eine neue Version von "${r}" wurde in Kooperation "${i}" hochgeladen`:`Ein neues Video "${r}" wurde in Kooperation "${i}" hochgeladen`,created_at:new Date().toISOString()}));await window.supabase.from("notifications").insert(s),window.dispatchEvent(new Event("notificationsRefresh")),console.log(`✅ Video-Upload-Benachrichtigungen versendet (${a.length} Kunden)`)}}}catch(n){console.error("❌ Fehler beim Versenden der Video-Upload-Benachrichtigungen:",n)}},renderAssetVersions(f,e,t,n){return!f||f.length===0?'<p class="empty-state">Keine Assets vorhanden.</p>':`
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Version</th>
              <th>Beschreibung</th>
              <th>Hochgeladen am</th>
              <th>Status</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>${[...f].sort((i,s)=>(s.version_number||0)-(i.version_number||0)).map(i=>`
      <tr>
        <td>
          <span style="font-weight:600;color:var(--color-primary);">V${i.version_number||1}</span>
        </td>
        <td>${i.description?e(i.description):"—"}</td>
        <td>${t(i.created_at)}</td>
        <td>
          ${i.is_current?'<span class="status-badge status-abgeschlossen">Aktuell</span>':'<span class="status-badge status-produktion">Archiv</span>'}
        </td>
        <td>
          <div class="actions-dropdown-container" data-entity-type="kooperation_video_asset">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
            </button>
            <div class="actions-dropdown">
              <a href="${i.file_url}" target="_blank" rel="noopener" class="action-item">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
                Öffnen
              </a>
              ${!i.is_current&&n?`
              <a href="#" class="action-item set-current-version" data-asset-id="${i.id}">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                Als aktuell markieren
              </a>
              `:""}
            </div>
          </div>
        </td>
      </tr>
    `).join("")}</tbody>
        </table>
      </div>
    `},renderCommentsTable(f){const e=r=>window.validatorSystem?.sanitizeHtml?.(r)??r,t=r=>r?new Date(r).toLocaleString("de-DE"):"-",n=window.currentUser?.id;return!f||f.length===0?'<p class="empty-state">Keine Kommentare vorhanden.</p>':`
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Datum</th>
              <th>Kommentar</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>${f.map(r=>{const i=!!r.deleted_at,o=r.author_benutzer_id===n&&!i,l=i?' style="opacity: 0.5; background-color: #f9f9f9;"':"",u=i?' style="text-decoration: line-through; color: #999;"':"";return`
      <tr${l}>
        <td>${e(r.author_name||"-")}</td>
        <td>${t(r.created_at)}</td>
        <td${u}>
          ${e(r.text||"")}
          ${i?`<br><small style="color: #999;">Gelöscht am: ${t(r.deleted_at)}</small>`:""}
        </td>
        <td>
          ${o?`
          <div class="actions-dropdown-container" data-entity-type="kooperation_video_comment">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
            </button>
            <div class="actions-dropdown">
              <a href="#" class="action-item action-danger comment-delete" data-action="comment-delete" data-id="${r.id}">
                ${window.ActionsDropdown?.getHeroIcon?window.ActionsDropdown.getHeroIcon("delete"):""}
                Entfernen
              </a>
            </div>
          </div>
          `:"—"}
        </td>
      </tr>
      `}).join("")}</tbody>
        </table>
      </div>
    `},bindEvents(){document.addEventListener("click",n=>{if(n.target.classList.contains("tab-button")){n.preventDefault();const a=n.target.dataset.tab;a&&this.switchTab(a)}}),document.getElementById("btn-back-kooperation")?.addEventListener("click",n=>{n.preventDefault(),this.video?.kooperation_id&&window.navigateTo(`/kooperation/${this.video.kooperation_id}`)});const f=document.getElementById("btn-save-status");f&&f.addEventListener("click",async n=>{n.preventDefault();try{const r=document.getElementById("video-status")?.value||"produktion",{error:i}=await window.supabase.from("kooperation_videos").update({status:r,updated_at:new Date().toISOString()}).eq("id",this.videoId);if(i)throw i;await this.loadData(),this.render(),this.bindEvents(),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"kooperation_videos",action:"updated",id:this.videoId,field:"status",value:r}}))}catch(a){console.error("Status speichern fehlgeschlagen",a),alert("Status konnte nicht gespeichert werden.")}}),this.bindAssetUploadEvents(),document.querySelectorAll(".set-current-version").forEach(n=>{n.addEventListener("click",async a=>{a.preventDefault();const r=n.dataset.assetId;if(!(!r||!confirm("Diese Version als aktuelle Version markieren?")))try{await window.supabase.from("kooperation_video_asset").update({is_current:!1}).eq("video_id",this.videoId);const{error:i}=await window.supabase.from("kooperation_video_asset").update({is_current:!0}).eq("id",r);if(i)throw i;await this.loadData(),this.render(),this.bindEvents()}catch(i){console.error("Version aktualisieren fehlgeschlagen",i),alert("Version konnte nicht als aktuell markiert werden.")}})});const e=document.getElementById("comment-form");if(e){const n=e.querySelector(".mdc-btn");e.addEventListener("submit",async a=>{a.preventDefault();const r=new FormData(e),i=parseInt(r.get("runde")||"1",10)===2?2:1,s=String(r.get("text")||"").trim();if(s)try{n&&(n.disabled=!0,n.classList.add("is-loading"));const o={video_id:this.videoId,runde:i,text:s,author_benutzer_id:window.currentUser?.id||null,author_name:window.currentUser?.name||null,created_at:new Date().toISOString()},{error:l}=await window.supabase.from("kooperation_video_comment").insert(o);if(l)throw l;try{await this.sendFeedbackNotifications(i)}catch(d){console.warn("⚠️ Benachrichtigung konnte nicht versendet werden:",d)}if(e.reset(),this.comments=this.comments||[],this.comments.push({...o}),n){n.classList.remove("is-loading"),n.classList.add("is-success");const d=n.querySelector(".mdc-btn__label");d&&(d.textContent=n.dataset.successText||"Gespeichert"),setTimeout(()=>{n.classList.remove("is-success"),n.disabled=!1,d&&(d.textContent=n.dataset.defaultText||"Speichern")},600)}const u=document.querySelector("#comments-"+(i===2?"r2":"r1"));u&&(u.innerHTML=this.renderCommentsTable(i===2?[...this.comments.filter(d=>d.runde===2)]:[...this.comments.filter(d=>d.runde!==2)]))}catch(o){console.error("Kommentar speichern fehlgeschlagen",o),n&&(n.classList.remove("is-loading"),n.disabled=!1),alert("Kommentar konnte nicht gespeichert werden.")}})}const t=document.querySelector(".content-section");t&&t.addEventListener("click",async n=>{const a=n.target.closest(".comment-delete");if(!a)return;n.preventDefault();const r=a.dataset.id;if(r&&confirm("Kommentar wirklich entfernen?"))try{const{error:i}=await window.supabase.from("kooperation_video_comment").update({deleted_at:new Date().toISOString(),deleted_by_benutzer_id:window.currentUser?.id||null}).eq("id",r);if(i)throw i;await this.loadData(),this.render(),this.bindEvents()}catch(i){console.error("Kommentar löschen fehlgeschlagen",i),alert("Kommentar konnte nicht gelöscht werden.")}}),window.ActionsDropdown&&window.ActionsDropdown.init()},bindAssetUploadEvents(){const f=document.getElementById("asset-upload-form");f&&f.addEventListener("submit",async e=>{e.preventDefault();const t=new FormData(f),n=String(t.get("file_url")||"").trim();if(!n){alert("Bitte Asset-URL angeben.");return}try{const a=f.querySelector('button[type="submit"]');a&&(a.disabled=!0,a.textContent="Wird hochgeladen...");const i=(this.assets.length>0?Math.max(...this.assets.map(o=>o.version_number||0)):0)+1;await window.supabase.from("kooperation_video_asset").update({is_current:!1}).eq("video_id",this.videoId);const{error:s}=await window.supabase.from("kooperation_video_asset").insert({video_id:this.videoId,file_url:n,file_path:n,version_number:i,is_current:!0,description:t.get("description")||null,uploaded_by:window.currentUser?.id||null,created_at:new Date().toISOString()});if(s)throw s;try{await this.sendVideoUploadNotifications(this.videoId,!0)}catch(o){console.warn("⚠️ Video-Version-Benachrichtigung konnte nicht versendet werden:",o)}await this.loadData(),this.render(),this.bindEvents(),window.notificationSystem?.success?.(`Version ${i} erfolgreich hochgeladen.`)}catch(a){console.error("Asset-Upload fehlgeschlagen",a),alert("Asset konnte nicht hochgeladen werden: "+(a.message||""));const r=f.querySelector('button[type="submit"]');r&&(r.disabled=!1,r.textContent="Version hochladen")}})},switchTab(f){console.log("🔄 VIDEO-DETAIL: Wechsle zu Tab:",f),document.querySelectorAll(".tab-button").forEach(n=>{n.classList.remove("active")}),document.querySelectorAll(".tab-pane").forEach(n=>{n.classList.remove("active")});const e=document.querySelector(`[data-tab="${f}"]`),t=document.getElementById(`tab-${f}`);e&&t&&(e.classList.add("active"),t.classList.add("active"))},destroy(){}};class Ft{constructor(){this.selectedKampagnen=new Set,this._boundEventListeners=new Set,this.statusOptions=[],this.kampagneArtMap=new Map}async init(){if(window.setHeadline("Kampagnen Übersicht"),window.breadcrumbSystem&&window.breadcrumbSystem.updateBreadcrumb([{label:"Kampagne",url:"/kampagne",clickable:!1}]),window.bulkActionSystem&&window.bulkActionSystem.hideForKunden(),!(window.canViewPage&&window.canViewPage("kampagne")||await window.checkUserPermission("kampagne","can_view"))){window.content.innerHTML=`
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Kampagnen anzuzeigen.</p>
        </div>
      `;return}this.bindEvents(),await this.loadAndRender()}async loadAndRender(){try{await this.render(),await this.initializeFilterBar();const e=A.getFilters("kampagne");console.log("🔍 Lade Kampagnen mit Filter:",e);const t=await this.loadKampagnenWithRelations();console.log("📊 Kampagnen geladen:",t?.length||0),this.updateTable(t)}catch(e){window.ErrorHandler.handle(e,"KampagneList.loadAndRender")}}async loadKampagnenWithRelations(){try{if(!window.supabase)return console.warn("⚠️ Supabase nicht verfügbar - verwende Mock-Daten"),await window.dataService.loadEntities("kampagne");try{const[{data:o},{data:l}]=await Promise.all([window.supabase.from("kampagne_status").select("id, name, sort_order").order("sort_order",{ascending:!0}).order("name",{ascending:!0}),window.supabase.from("kampagne_art_typen").select("id, name")]);this.statusOptions=o||[],this.kampagneArtMap=new Map((l||[]).map(u=>[u.id,u.name]))}catch(o){console.warn("⚠️ Konnte Status/Arten nicht laden",o)}const e=window.currentUser?.rolle==="admin"||window.currentUser?.rolle?.toLowerCase()==="admin";let t=[];if(!e)try{const{data:o}=await window.supabase.from("kampagne_mitarbeiter").select("kampagne_id").eq("mitarbeiter_id",window.currentUser?.id),l=(o||[]).map(m=>m.kampagne_id).filter(Boolean),{data:u}=await window.supabase.from("marke_mitarbeiter").select("marke_id").eq("mitarbeiter_id",window.currentUser?.id),d=(u||[]).map(m=>m.marke_id).filter(Boolean);let c=[];if(d.length>0){const{data:m}=await window.supabase.from("kampagne").select("id").in("marke_id",d);c=(m||[]).map(h=>h.id).filter(Boolean)}if(t=[...new Set([...l,...c])],console.log(`🔍 KAMPAGNELIST: Mitarbeiter ${window.currentUser?.id} hat Zugriff auf:`,{direkteKampagnen:l.length,markenKampagnen:c.length,gesamt:t.length}),t.length===0&&window.currentUser?.rolle!=="kunde")return[]}catch(o){if(console.error("❌ Fehler beim Laden der Zuordnungen:",o),window.currentUser?.rolle!=="kunde")return[]}let n=window.supabase.from("kampagne").select(`
          *,
          unternehmen:unternehmen_id(id, firmenname),
          marke:marke_id(id, markenname),
          auftrag:auftrag_id(auftragsname),
          status_ref:status_id(id, name)
        `).order("created_at",{ascending:!1});!e&&window.currentUser?.rolle!=="kunde"&&t.length>0&&(n=n.in("id",t));const{data:a,error:r}=await n;if(r)throw console.error("❌ Fehler beim Laden der Kampagnen mit Beziehungen:",r),r;const i=a.map(o=>{const u=(Array.isArray(o.art_der_kampagne)?o.art_der_kampagne:[]).map(d=>this.kampagneArtMap.get(d)||d);return{...o,art_der_kampagne_display:u,unternehmen:o.unternehmen?{firmenname:o.unternehmen.firmenname}:null,marke:o.marke?{markenname:o.marke.markenname}:null,auftrag:o.auftrag?{auftragsname:o.auftrag.auftragsname}:null,status_name:o.status_ref?.name||o.status||null}}),s=window.dataService.entities.kampagne;return s.manyToMany&&await window.dataService.loadManyToManyRelations(i,"kampagne",s.manyToMany),console.log("✅ Kampagnen mit Beziehungen geladen:",i),i}catch(e){return console.error("❌ Fehler beim Laden der Kampagnen mit Beziehungen:",e),await window.dataService.loadEntities("kampagne")}}async render(){const e=window.currentUser?.permissions?.kampagne?.can_edit||!1,t=A.getFilters("kampagne");Object.entries(t).forEach(([r,i])=>{});let n=`<div class="filter-bar">
      <div class="filter-left">
        <div id="filter-container"></div>
      </div>
      <div class="filter-right">
        <button id="btn-filter-reset" class="secondary-btn" style="display:${this.hasActiveFilters()?"inline-block":"none"};">Filter zurücksetzen</button>
      </div>
    </div>`,a=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Kampagnen</h1>
          <p>Verwalten Sie alle Kampagnen und deren Details</p>
        </div>
        <div class="page-header-right">
          ${e?'<button id="btn-kampagne-new" class="primary-btn">Neue Kampagne anlegen</button>':""}
        </div>
      </div>

      <div class="table-filter-wrapper">
        ${n}
        <div class="table-actions">
          <button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
          <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>
        </div>
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>
                <input type="checkbox" id="select-all-kampagnen">
              </th>
              <th>Kampagnenname</th>
              <th>Unternehmen</th>
              <th>Marke</th>
              <th>Art der Kampagne</th>
              <th>Status</th>
              <th>Start</th>
              <th>Deadline</th>
              <th>Creator Anzahl</th>
              <th>Video Anzahl</th>
              <th>Ansprechpartner</th>
              <th>Mitarbeiter</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody id="kampagnen-table-body">
            <tr>
              <td colspan="12" class="loading">Lade Kampagnen...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;window.setContentSafely(window.content,a)}async initializeFilterBar(){const e=document.getElementById("filter-container");e&&await A.renderFilterBar("kampagne",e,t=>this.onFiltersApplied(t),()=>this.onFiltersReset())}onFiltersApplied(e){console.log("🔍 KampagneList: Filter angewendet:",e),A.applyFilters("kampagne",e),this.loadAndRender()}onFiltersReset(){console.log("🔄 KampagneList: Filter zurückgesetzt"),A.resetFilters("kampagne"),this.loadAndRender()}bindEvents(){this.boundFilterResetHandler=e=>{e.target.id==="btn-filter-reset"&&this.onFiltersReset()},document.addEventListener("click",this.boundFilterResetHandler),document.addEventListener("click",e=>{(e.target.id==="btn-kampagne-new"||e.target.id==="btn-kampagne-new-filter")&&(e.preventDefault(),window.navigateTo("/kampagne/new"))}),document.addEventListener("click",e=>{if(e.target.id==="btn-select-all"){e.preventDefault(),document.querySelectorAll(".kampagne-check").forEach(a=>{a.checked=!0,a.dataset.id&&this.selectedKampagnen.add(a.dataset.id)});const n=document.getElementById("select-all-kampagnen");n&&(n.indeterminate=!1,n.checked=!0),this.updateSelection()}}),document.addEventListener("click",e=>{e.target.id==="btn-deselect-all"&&(e.preventDefault(),this.deselectAll())}),document.addEventListener("click",e=>{if(e.target.classList.contains("table-link")&&e.target.dataset.table==="kampagne"){e.preventDefault();const t=e.target.dataset.id;console.log("🎯 KAMPAGNELIST: Navigiere zu Kampagne Details:",t),window.navigateTo(`/kampagne/${t}`)}}),window.addEventListener("entityUpdated",e=>{e.detail.entity==="kampagne"&&this.loadAndRender()}),document.addEventListener("click",e=>{if(e.target.classList.contains("tag-x")){e.preventDefault(),e.stopPropagation();const n=e.target.closest(".filter-tag").dataset.key,a=A.getFilters("kampagne");delete a[n],A.applyFilters("kampagne",a),this.loadAndRender()}}),document.addEventListener("change",e=>{if(e.target.id==="select-all-kampagnen"){const t=document.querySelectorAll(".kampagne-check"),n=e.target.checked;t.forEach(a=>{a.checked=n,n?this.selectedKampagnen.add(a.dataset.id):this.selectedKampagnen.delete(a.dataset.id)}),this.updateSelection(),console.log(`${n?"✅ Alle Kampagnen ausgewählt":"❌ Alle Kampagnen abgewählt"}: ${this.selectedKampagnen.size}`)}}),document.addEventListener("change",e=>{e.target.classList.contains("kampagne-check")&&(e.target.checked?this.selectedKampagnen.add(e.target.dataset.id):this.selectedKampagnen.delete(e.target.dataset.id),this.updateSelection(),this.updateSelectAllCheckbox())}),window.bulkActionSystem&&window.bulkActionSystem.registerList("kampagne",this)}hasActiveFilters(){const e=A.getFilters("kampagne");return Object.keys(e).length>0}updateSelection(){const e=this.selectedKampagnen.size,t=document.getElementById("selected-count"),n=document.getElementById("btn-deselect-all"),a=document.getElementById("btn-delete-selected");t&&(t.textContent=`${e} ausgewählt`,t.style.display=e>0?"inline":"none"),n&&(n.style.display=e>0?"inline-block":"none"),a&&(a.style.display=e>0?"inline-block":"none")}async updateTable(e){const t=document.getElementById("kampagnen-table-body");if(!t)return;if(!e||e.length===0){const{renderEmptyState:a}=await x(async()=>{const{renderEmptyState:r}=await import("./core-C7Vz5Umf.js").then(i=>i.F);return{renderEmptyState:r}},[]);a(t);return}const n=e.map(a=>{const r=s=>s?new Date(s).toLocaleDateString("de-DE"):"-",i=s=>s&&Array.isArray(s)&&s.length?s.join(", "):"-";return`
        <tr data-id="${a.id}">
          <td><input type="checkbox" class="kampagne-check" data-id="${a.id}"></td>
          <td>
            <a href="#" class="table-link" data-table="kampagne" data-id="${a.id}">
              ${window.validatorSystem.sanitizeHtml(a.kampagnenname||"Unbekannt")}
            </a>
          </td>
          <td>${this.renderUnternehmen(a.unternehmen)}</td>
          <td>${this.renderMarke(a.marke)}</td>
          <td>${i(a.art_der_kampagne_display||a.art_der_kampagne)}</td>
          <td>
            <span class="status-badge status-${(a.status_name||"").toLowerCase().replace(/\s+/g,"-")||"unknown"}">
              ${a.status_name||"-"}
            </span>
          </td>
          <td>${r(a.start)}</td>
          <td>${r(a.deadline)}</td>
          <td>${a.creatoranzahl||0}</td>
          <td>${a.videoanzahl||0}</td>
          <td>${this.renderAnsprechpartner(a.ansprechpartner)}</td>
          <td>${this.renderMitarbeiter(a.mitarbeiter)}</td>
          <td>
            ${B.create("kampagne",a.id,window.currentUser,{statusOptions:this.statusOptions,currentStatus:{id:a.status_id,name:a.status}})}
          </td>
        </tr>
      `}).join("");t.innerHTML=n}destroy(){console.log("KampagneList: Cleaning up..."),this._boundEventListeners.forEach(({element:e,type:t,handler:n})=>{e.removeEventListener(t,n)}),this._boundEventListeners.clear(),this.boundFilterResetHandler&&(document.removeEventListener("click",this.boundFilterResetHandler),this.boundFilterResetHandler=null)}showCreateForm(){console.log("🎯 Zeige Kampagnen-Erstellungsformular"),window.setHeadline("Neue Kampagne anlegen"),window.breadcrumbSystem&&window.breadcrumbSystem.updateBreadcrumb([{label:"Kampagne",url:"/kampagne",clickable:!0},{label:"Neue Kampagne",url:"/kampagne/new",clickable:!1}]);const e=window.formSystem.renderFormOnly("kampagne");window.content.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Neue Kampagne anlegen</h1>
          <p>Erstellen Sie eine neue Kampagne</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/kampagne')" class="secondary-btn">Zurück zur Übersicht</button>
        </div>
      </div>
      
      <div class="form-page">
        ${e}
      </div>
    `,window.formSystem.bindFormEvents("kampagne",null);const t=document.getElementById("kampagne-form");t&&(t.onsubmit=async n=>{n.preventDefault(),await this.handleFormSubmit()})}async handleFormSubmit(){try{const e=document.getElementById("kampagne-form"),t=new FormData(e),n={};e.querySelectorAll('select[data-tag-based="true"]').forEach(o=>{const l=o.name;let u=e.querySelector(`select[name="${l}[]"][style*="display: none"]`);if(u||(u=e.querySelector(`select[name="${l}"][style*="display: none"]`)),!u){const d=e.querySelector(`select[name="${l}"]`)?.closest(".form-field")?.querySelector(".tag-based-select");if(d){const c=d.querySelectorAll(".tag[data-value]"),m=Array.from(c).map(h=>h.dataset.value).filter(Boolean);if(m.length>0){n[l]=m,console.log(`🏷️ Tag-basiertes Feld ${l} aus Tags gesammelt:`,m);return}}}if(u){const d=Array.from(u.selectedOptions).map(c=>c.value).filter(Boolean);d.length>0&&(n[l]=d,console.log(`🏷️ Tag-basiertes Feld ${l} aus Hidden-Select gesammelt:`,d))}else console.warn(`⚠️ Kein Hidden-Select oder Tags für ${l} gefunden`)});for(const[o,l]of t.entries())if(o.includes("[]")){const u=o.replace("[]","");n[u]||(n[u]=[]),n[u].push(l)}else!n.hasOwnProperty(o)||!Array.isArray(n[o])?n[o]=l:console.log(`⚠️ Überspringe ${o}, bereits als Array gesetzt:`,n[o]);const r=e.querySelector('input[name="kampagnenname"]');r&&r.value&&(n.kampagnenname=r.value),console.log("📝 Kampagne Submit-Daten:",n);const i=window.validatorSystem.validateForm(n,"kampagne");if(!i.isValid){this.showValidationErrors(i.errors);return}const s=await window.dataService.createEntity("kampagne",n);if(s.success){try{const o=s.id,l=b=>Array.isArray(b)?b:b?[b]:[],u=b=>Array.from(new Set((b||[]).filter(Boolean))),d=u(l(n.ansprechpartner_ids));if(d.length>0){const b=d.map(y=>({kampagne_id:o,ansprechpartner_id:y}));await window.supabase.from("ansprechpartner_kampagne").insert(b),console.log("✅ Ansprechpartner-Zuordnungen gespeichert:",b.length)}const c=u(l(n.mitarbeiter_ids)),m=u(l(n.pm_ids)),h=u(l(n.scripter_ids)),p=u(l(n.cutter_ids)),g=[];c.forEach(b=>g.push({kampagne_id:o,mitarbeiter_id:b,role:"projektmanager"})),m.forEach(b=>g.push({kampagne_id:o,mitarbeiter_id:b,role:"projektmanager"})),h.forEach(b=>g.push({kampagne_id:o,mitarbeiter_id:b,role:"scripter"})),p.forEach(b=>g.push({kampagne_id:o,mitarbeiter_id:b,role:"cutter"})),g.length>0&&window.supabase&&(await window.supabase.from("kampagne_mitarbeiter").insert(g),console.log("✅ Mitarbeiter-Zuordnungen gespeichert:",g.length))}catch(o){console.warn("⚠️ Many-to-Many Zuordnungen konnten nicht gespeichert werden",o)}this.showSuccessMessage("Kampagne erfolgreich erstellt!"),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"kampagne",action:"created",id:s.id}})),setTimeout(()=>{window.navigateTo("/kampagne")},1500)}else this.showErrorMessage(`Fehler beim Erstellen: ${s.error}`)}catch(e){console.error("❌ Fehler beim Erstellen der Kampagne:",e),this.showErrorMessage("Ein unerwarteter Fehler ist aufgetreten.")}}showValidationErrors(e){console.error("❌ Validierungsfehler:",e),document.querySelectorAll(".validation-error").forEach(t=>t.remove()),Object.entries(e).forEach(([t,n])=>{const a=document.querySelector(`[name="${t}"]`);if(a){const r=document.createElement("div");r.className="validation-error",r.textContent=n,a.parentNode.appendChild(r)}})}showSuccessMessage(e){const t=document.createElement("div");t.className="alert alert-success",t.textContent=e;const n=document.getElementById("kampagne-form");n&&(n.parentNode.insertBefore(t,n),setTimeout(()=>{t.remove()},5e3))}showErrorMessage(e){const t=document.createElement("div");t.className="alert alert-danger",t.textContent=e;const n=document.getElementById("kampagne-form");n&&(n.parentNode.insertBefore(t,n),setTimeout(()=>{t.remove()},5e3))}updateSelectAllCheckbox(){const e=document.getElementById("select-all-kampagnen"),t=document.querySelectorAll(".kampagne-check");if(!e||t.length===0)return;const n=document.querySelectorAll(".kampagne-check:checked"),a=n.length===t.length,r=n.length>0;e.checked=a,e.indeterminate=r&&!a}deselectAll(){this.selectedKampagnen.clear(),document.querySelectorAll(".kampagne-check").forEach(n=>{n.checked=!1});const t=document.getElementById("select-all-kampagnen");t&&(t.checked=!1,t.indeterminate=!1),this.updateSelection(),console.log("✅ Alle Kampagnen-Auswahlen aufgehoben")}async showDeleteSelectedConfirmation(){const e=this.selectedKampagnen.size;if(e===0){alert("Keine Kampagnen ausgewählt.");return}const t=e===1?"Möchten Sie die ausgewählte Kampagne wirklich löschen?":`Möchten Sie die ${e} ausgewählten Kampagnen wirklich löschen?`;window.confirmationModal?(await window.confirmationModal.open({title:"Löschvorgang bestätigen",message:`${t}`,confirmText:"Endgültig löschen",cancelText:"Abbrechen",danger:!0}))?.confirmed&&this.deleteSelectedKampagnen():confirm(`${t}

Dieser Vorgang kann nicht rückgängig gemacht werden.`)&&this.deleteSelectedKampagnen()}async deleteSelectedKampagnen(){const e=Array.from(this.selectedKampagnen),t=e.length;console.log(`🗑️ Lösche ${t} Kampagnen...`),e.forEach(n=>{const a=document.querySelector(`tr[data-id="${n}"]`);a&&(a.style.opacity="0.5")});try{const n=await window.dataService.deleteEntities("kampagne",e);if(n.success){e.forEach(r=>{document.querySelector(`tr[data-id="${r}"]`)?.remove()}),alert(`✅ ${n.deletedCount} Kampagnen erfolgreich gelöscht.`),this.deselectAll();const a=document.querySelector("#kampagnen-table-body");a&&a.children.length===0&&await this.loadAndRender(),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"kampagne",action:"bulk-deleted",count:n.deletedCount}}))}else throw new Error(n.error||"Löschen fehlgeschlagen")}catch(n){e.forEach(a=>{const r=document.querySelector(`tr[data-id="${a}"]`);r&&(r.style.opacity="1")}),console.error("❌ Fehler beim Löschen:",n),alert(`❌ Fehler beim Löschen: ${n.message}`),await this.loadAndRender()}}renderAnsprechpartner(e){if(!e||e.length===0)return"-";const t=e.filter(n=>n&&n.vorname&&n.nachname).map(n=>({name:`${n.vorname} ${n.nachname}`,type:"person",id:n.id,entityType:"ansprechpartner"}));return z.renderBubbles(t)}renderUnternehmen(e){if(!e||!e.firmenname)return"-";const t=[{name:e.firmenname,type:"org",id:e.id,entityType:"unternehmen"}];return z.renderBubbles(t)}renderMarke(e){if(!e||!e.markenname)return"-";const t=[{name:e.markenname,type:"org",id:e.id,entityType:"marke"}];return z.renderBubbles(t)}renderMitarbeiter(e){if(!e||e.length===0)return"-";console.log("🔍 KampagneList renderMitarbeiter:",e);const t=e.filter(n=>n&&(n.name||n.email)).map(n=>({name:n.name||n.email,type:"person",id:n.id,entityType:"mitarbeiter"}));return console.log("🔍 KampagneList mitarbeiter items:",t),z.renderBubbles(t)}}const _e=new Ft;class Mt{constructor(){this.kampagneId=null,this.kampagneData=null,this.creator=[],this.notizen=[],this.ratings=[],this.kooperationen=[],this.koopBudgetSum=0,this.koopVideosUsed=0,this.sourcingCreators=[],this.favoriten=[],this.rechnungen=[],this.history=[],this.historyCount=0,this.koopHistory=[],this.koopHistoryCount=0}async init(e){if(console.log("🎯 KAMPAGNEDETAIL: Initialisiere Kampagnen-Detailseite für ID:",e),this.kampagneId=e,window.moduleRegistry?.currentModule!==this){console.log("⚠️ KAMPAGNEDETAIL: Nicht mehr das aktuelle Modul, breche ab");return}try{await this.loadKampagneData(),window.breadcrumbSystem&&this.kampagneData&&window.breadcrumbSystem.updateBreadcrumb([{label:"Kampagne",url:"/kampagne",clickable:!0},{label:this.kampagneData.kampagnenname||"Details",url:`/kampagne/${this.kampagneId}`,clickable:!1}]),await this.render(),this.bindEvents(),this.bindAnsprechpartnerEvents(),console.log("✅ KAMPAGNEDETAIL: Initialisierung abgeschlossen")}catch(t){console.error("❌ KAMPAGNEDETAIL: Fehler bei der Initialisierung:",t),window.ErrorHandler.handle(t,"KampagneDetail.init")}}async loadKooperationen(){try{const{data:e,error:t}=await window.supabase.from("kooperationen").select("id, name, status, gesamtkosten, videoanzahl, creator_id").eq("kampagne_id",this.kampagneId).order("created_at",{ascending:!1});if(t)throw t;const n=Array.from(new Set((e||[]).map(r=>r.creator_id).filter(Boolean)));let a={};if(n.length>0){const{data:r}=await window.supabase.from("creator").select("id, vorname, nachname").in("id",n);a=(r||[]).reduce((i,s)=>(i[s.id]=s,i),{})}this.kooperationen=(e||[]).map(r=>({...r,creator:a[r.creator_id]||null})),this.koopBudgetSum=this.kooperationen.reduce((r,i)=>r+(parseFloat(i.gesamtkosten)||0),0),this.koopVideosUsed=this.kooperationen.reduce((r,i)=>r+(parseInt(i.videoanzahl,10)||0),0),console.log("✅ KAMPAGNEDETAIL: Kooperationen geladen:",this.kooperationen.length,"Budgetsumme:",this.koopBudgetSum)}catch(e){console.error("❌ KAMPAGNEDETAIL: Fehler beim Laden der Kooperationen:",e),this.kooperationen=[],this.koopBudgetSum=0}}renderKooperationen(){const e=d=>d?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(d):"-",t=this.kampagneData?.auftrag?.creator_budget||0,n=this.koopBudgetSum,a=t>0?Math.min(100,Math.round(n/t*100)):0,r=this.kampagneData?.videoanzahl||0,i=this.koopVideosUsed||0,s=Math.max(0,r-i),o=r>0?Math.min(100,Math.round(i/r*100)):0,l=`
      <div class="budget-progress">
        <div class="budget-header">
          <span>Aufgebraucht: ${e(n)} von ${e(t)}</span>
          <span>${a}%</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${a}%"></div></div>
      </div>
      <div class="budget-progress" style="margin-top:12px;">
        <div class="budget-header">
          <span>Videos: ${i} von ${r} | Rest: ${s}</span>
          <span>${o}%</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${o}%"></div></div>
      </div>`;if(!this.kooperationen||this.kooperationen.length===0)return`
        ${l}
        <div class="empty-state">
          <p>Keine Kooperationen verknüpft</p>
          <button class="primary-btn" onclick="window.navigateTo('/kooperation/new')">Kooperation anlegen</button>
        </div>
      `;const u=this.kooperationen.map(d=>`
      <tr>
        <td><a href="/kooperation/${d.id}" onclick="event.preventDefault(); window.navigateTo('/kooperation/${d.id}')">${window.validatorSystem.sanitizeHtml(d.name||"—")}</a></td>
        <td>${window.validatorSystem.sanitizeHtml(d.creator?`${d.creator.vorname} ${d.creator.nachname}`:"Unbekannt")}</td>
        <td>${d.videoanzahl||0}</td>
        <td><span class="status-badge status-${(d.status||"unknown").toLowerCase()}">${d.status||"-"}</span></td>
        <td>${e(d.gesamtkosten)}</td>
      </tr>
    `).join("");return`
      ${l}
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Creator</th>
              <th>Videos</th>
              <th>Status</th>
              <th>Gesamtkosten</th>
            </tr>
          </thead>
          <tbody>
            ${u}
          </tbody>
        </table>
      </div>
    `}renderCreatorSourcing(){return!this.sourcingCreators||this.sourcingCreators.length===0?`
        <div class="empty-state">
          <p>Keine Creator gefunden.</p>
        </div>
      `:`
      <div class="table-actions">
        <div class="table-actions-left">
          <button id="btn-select-all-sourcing" class="secondary-btn">Alle auswählen</button>
        </div>
      </div>
      ${V(this.sourcingCreators,{showFavoriteAction:!0,showSelection:!0,kampagneId:this.kampagneId})}
    `}renderFavoriten(){return!this.favoriten||this.favoriten.length===0?`
        <div class="empty-state">
          <p>Noch keine Favoriten.</p>
        </div>
      `:`
      <div class="table-actions">
        <div class="table-actions-left">
          <button id="btn-select-all-favs" class="secondary-btn">Alle auswählen</button>
        </div>
      </div>
      ${V(this.favoriten,{showFavoritesMenu:!0,showSelection:!0,kampagneId:this.kampagneId})}
    `}renderRechnungen(){if(!this.rechnungen||this.rechnungen.length===0)return`
         <div class="empty-state">
           <p>Keine Rechnungen zu dieser Kampagne.</p>
         </div>
       `;const e=a=>a?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(a):"-",t=a=>a?new Date(a).toLocaleDateString("de-DE"):"-";return`
       <div class="data-table-container">
         <table class="data-table">
           <thead>
              <tr>
                <th>Rechnungs-Nr</th>
                <th>Status</th>
                <th>Creator</th>
                <th>Kooperation</th>
                <th>Netto</th>
                <th>Brutto</th>
                <th>Gestellt</th>
                <th>Bezahlt</th>
                <th>Beleg</th>
              </tr>
           </thead>
           <tbody>${this.rechnungen.map(a=>`
       <tr>
         <td><a href="/rechnung/${a.id}" onclick="event.preventDefault(); window.navigateTo('/rechnung/${a.id}')">${window.validatorSystem.sanitizeHtml(a.rechnung_nr||"—")}</a></td>
         <td><span class="status-badge status-${(a.status||"unknown").toLowerCase()}">${a.status||"-"}</span></td>
         <td>${a.creator?window.validatorSystem.sanitizeHtml(`${a.creator.vorname||""} ${a.creator.nachname||""}`.trim()||"-"):"-"}</td>
         <td>${a.kooperation?`<a href="/kooperation/${a.kooperation.id}" onclick="event.preventDefault(); window.navigateTo('/kooperation/${a.kooperation.id}')">${window.validatorSystem.sanitizeHtml(a.kooperation.name||a.kooperation.id)}</a>`:"-"}</td>
         <td>${e(a.nettobetrag)}</td>
         <td>${e(a.bruttobetrag)}</td>
         <td>${t(a.gestellt_am)}</td>
         <td>${t(a.bezahlt_am)}</td>
         <td>${a.pdf_url?`<a href="${a.pdf_url}" target="_blank" rel="noopener">PDF</a>`:"-"}</td>
       </tr>
     `).join("")}</tbody>
         </table>
       </div>
     `}async loadKampagneData(){console.log("🔄 KAMPAGNEDETAIL: Lade Kampagnen-Daten...");try{const{data:e,error:t}=await window.supabase.from("kampagne").select(`
          *,
          unternehmen:unternehmen_id(firmenname, webseite, branche_id),
          marke:marke_id(markenname, webseite),
          auftrag:auftrag_id(auftragsname, status, gesamt_budget, creator_budget)
        `).eq("id",this.kampagneId).single();if(t)throw t;this.kampagneData=e;const{data:n,error:a}=await window.supabase.from("ansprechpartner_kampagne").select(`
          ansprechpartner:ansprechpartner_id(
            id,
            vorname,
            nachname,
            email,
            unternehmen:unternehmen_id(firmenname),
            position:position_id(name)
          )
        `).eq("kampagne_id",this.kampagneId);a||(this.kampagneData.ansprechpartner=n?.map(l=>l.ansprechpartner).filter(Boolean)||[],console.log("✅ KAMPAGNEDETAIL: Ansprechpartner geladen:",this.kampagneData.ansprechpartner.length));const{data:r,error:i}=await window.supabase.from("kampagne_mitarbeiter").select(`
          role,
          benutzer:mitarbeiter_id(
            id,
            name,
            email
          )
        `).eq("kampagne_id",this.kampagneId);!i&&r&&(this.kampagneData.mitarbeiter=r.filter(l=>!l.role||l.role==="mitarbeiter").map(l=>l.benutzer).filter(Boolean),this.kampagneData.projektmanager=r.filter(l=>l.role==="projektmanager").map(l=>l.benutzer).filter(Boolean),this.kampagneData.scripter=r.filter(l=>l.role==="scripter").map(l=>l.benutzer).filter(Boolean),this.kampagneData.cutter=r.filter(l=>l.role==="cutter").map(l=>l.benutzer).filter(Boolean),console.log("✅ KAMPAGNEDETAIL: Mitarbeiter geladen:",{mitarbeiter:this.kampagneData.mitarbeiter.length,projektmanager:this.kampagneData.projektmanager.length,scripter:this.kampagneData.scripter.length,cutter:this.kampagneData.cutter.length}));try{const{data:l}=await window.supabase.from("kampagne_plattformen").select(`
            plattform:plattform_id(
              id,
              name
            )
          `).eq("kampagne_id",this.kampagneId);l&&(this.kampagneData.plattformen=l.map(u=>u.plattform).filter(Boolean),this.kampagneData.plattform_ids=this.kampagneData.plattformen.map(u=>u.id),console.log("✅ KAMPAGNEDETAIL: Plattformen geladen:",this.kampagneData.plattformen.length))}catch(l){console.warn("⚠️ KAMPAGNEDETAIL: Plattformen konnten nicht geladen werden",l)}try{const{data:l}=await window.supabase.from("kampagne_formate").select(`
            format:format_id(
              id,
              name
            )
          `).eq("kampagne_id",this.kampagneId);l&&(this.kampagneData.formate=l.map(u=>u.format).filter(Boolean),this.kampagneData.format_ids=this.kampagneData.formate.map(u=>u.id),console.log("✅ KAMPAGNEDETAIL: Formate geladen:",this.kampagneData.formate.length))}catch(l){console.warn("⚠️ KAMPAGNEDETAIL: Formate konnten nicht geladen werden",l)}if(console.log("✅ KAMPAGNEDETAIL: Kampagnen-Basisdaten geladen:",this.kampagneData),this.kampagneData.art_der_kampagne&&this.kampagneData.art_der_kampagne.length>0){const{data:l,error:u}=await window.supabase.from("kampagne_art_typen").select("id, name, beschreibung").in("id",this.kampagneData.art_der_kampagne);u||(this.kampagneData.kampagne_art_typen=l||[],console.log("✅ KAMPAGNEDETAIL: Kampagnen-Arten geladen:",this.kampagneData.kampagne_art_typen.length))}const{data:s,error:o}=await window.supabase.from("kampagne_creator").select(`
          *,
          creator:creator_id(
            id,
            vorname,
            nachname,
            instagram,
            instagram_follower,
            tiktok,
            tiktok_follower,
            mail,
            telefonnummer
          )
        `).eq("kampagne_id",this.kampagneId);o||(this.creator=s||[],console.log("✅ KAMPAGNEDETAIL: Creators geladen:",this.creator.length));try{const{data:l}=await window.supabase.from("kampagne_creator_sourcing").select(`
            id,
            creator:creator_id (
              id,
              vorname,
              nachname,
              creator_types:creator_creator_type(creator_type:creator_type_id(name)),
              sprachen:creator_sprachen(sprachen:sprache_id(name)),
              branchen:creator_branchen(branchen_creator:branche_id(name)),
              instagram_follower,
              tiktok_follower,
              lieferadresse_stadt,
              lieferadresse_land
            )
          `).eq("kampagne_id",this.kampagneId);this.sourcingCreators=(l||[]).map(u=>{const d=u.creator||{};return{id:d.id,vorname:d.vorname,nachname:d.nachname,creator_types:(d.creator_types||[]).map(c=>c.creator_type).filter(Boolean),sprachen:(d.sprachen||[]).map(c=>c.sprachen).filter(Boolean),branchen:(d.branchen||[]).map(c=>c.branchen_creator).filter(Boolean),instagram_follower:d.instagram_follower,tiktok_follower:d.tiktok_follower,lieferadresse_stadt:d.lieferadresse_stadt,lieferadresse_land:d.lieferadresse_land}})}catch(l){console.warn("⚠️ KAMPAGNEDETAIL: Creator Sourcing konnte nicht geladen werden",l),this.sourcingCreators=[]}try{const{data:l}=await window.supabase.from("kampagne_creator_favoriten").select(`
            id,
            creator:creator_id (
              id,
              vorname,
              nachname,
              creator_types:creator_creator_type(creator_type:creator_type_id(name)),
              sprachen:creator_sprachen(sprachen:sprache_id(name)),
              branchen:creator_branchen(branchen_creator:branche_id(name)),
              instagram_follower,
              tiktok_follower,
              lieferadresse_stadt,
              lieferadresse_land
            )
          `).eq("kampagne_id",this.kampagneId);this.favoriten=(l||[]).map(u=>{const d=u.creator||{};return{id:d.id,vorname:d.vorname,nachname:d.nachname,creator_types:(d.creator_types||[]).map(c=>c.creator_type).filter(Boolean),sprachen:(d.sprachen||[]).map(c=>c.sprachen).filter(Boolean),branchen:(d.branchen||[]).map(c=>c.branchen_creator).filter(Boolean),instagram_follower:d.instagram_follower,tiktok_follower:d.tiktok_follower,lieferadresse_stadt:d.lieferadresse_stadt,lieferadresse_land:d.lieferadresse_land}})}catch(l){console.warn("⚠️ KAMPAGNEDETAIL: Favoriten konnten nicht geladen werden",l),this.favoriten=[]}window.notizenSystem&&(this.notizen=await window.notizenSystem.loadNotizen("kampagne",this.kampagneId),console.log("✅ KAMPAGNEDETAIL: Notizen geladen:",this.notizen.length)),window.bewertungsSystem&&(this.ratings=await window.bewertungsSystem.loadBewertungen("kampagne",this.kampagneId),console.log("✅ KAMPAGNEDETAIL: Ratings geladen:",this.ratings.length)),await this.loadKooperationen();try{const{data:l}=await window.supabase.from("rechnung").select("id, rechnung_nr, status, nettobetrag, bruttobetrag, gestellt_am, bezahlt_am, pdf_url, kooperation:kooperation_id(id, name), creator:creator_id(id, vorname, nachname)").eq("kampagne_id",this.kampagneId).order("gestellt_am",{ascending:!1});this.rechnungen=l||[]}catch{this.rechnungen=[]}try{const{data:l}=await window.supabase.from("kampagne_history").select("id, old_status, new_status, comment, created_at, benutzer:changed_by(name)").eq("kampagne_id",this.kampagneId).order("created_at",{ascending:!1});this.history=(l||[]).map(u=>({id:u.id,old_status:u.old_status||null,new_status:u.new_status||null,comment:u.comment||"",created_at:u.created_at,user_name:u.benutzer?.name||"-"})),this.historyCount=this.history.length}catch{this.history=[],this.historyCount=0}try{const l=(this.kooperationen||[]).map(u=>u.id).filter(Boolean);if(l.length>0){const u=(this.kooperationen||[]).reduce((c,m)=>(c[m.id]=m,c),{}),{data:d}=await window.supabase.from("kooperation_history").select("id, kooperation_id, old_status, new_status, comment, created_at, benutzer:changed_by(name)").in("kooperation_id",l).order("created_at",{ascending:!1});this.koopHistory=(d||[]).map(c=>({id:c.id,kooperation_id:c.kooperation_id,kooperation_name:u[c.kooperation_id]?.name||c.kooperation_id,old_status:c.old_status||null,new_status:c.new_status||null,comment:c.comment||"",created_at:c.created_at,user_name:c.benutzer?.name||"-"})),this.koopHistoryCount=this.koopHistory.length}else this.koopHistory=[],this.koopHistoryCount=0}catch{this.koopHistory=[],this.koopHistoryCount=0}}catch(e){throw console.error("❌ KAMPAGNEDETAIL: Fehler beim Laden der Kampagnen-Daten:",e),e}}async render(){if(!this.kampagneData){this.showNotFound();return}window.setHeadline(`Kampagne: ${this.kampagneData.kampagnenname}`);const e=window.currentUser?.permissions?.kampagne?.can_edit||!1,t=window.currentUser?.permissions?.kampagne?.can_delete||!1,n=s=>s?new Date(s).toLocaleDateString("de-DE"):"-",a=s=>s?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(s):"-",r=s=>s?Array.isArray(s)?s.map(o=>o.name||o).join(", "):String(s):"-",i=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>${window.validatorSystem.sanitizeHtml(this.kampagneData.kampagnenname)}</h1>
          <p>Kampagnen-Details und verwandte Informationen</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/kampagne')" class="secondary-btn">Zurück zur Übersicht</button>
          ${e?'<button id="btn-edit-kampagne" class="primary-btn">Bearbeiten</button>':""}
          ${t?'<button id="btn-delete-kampagne" class="danger-btn">Kampagne löschen</button>':""}
        </div>
      </div>

      <div class="content-section">
        <!-- Tab Navigation -->
        <div class="tab-navigation">
          <button class="tab-button active" data-tab="info">
            <i class="icon-information-circle"></i>
            Informationen
          </button>
          ${window.canViewTable&&window.canViewTable("kampagne","creators")!==!1?`
          <button class="tab-button" data-tab="creators">
            <i class="icon-users"></i>
            Creator
            <span class="tab-count">${this.creator.length}</span>
          </button>`:""}
          ${window.canViewTable&&window.canViewTable("kampagne","notizen")!==!1?`
          <button class="tab-button" data-tab="notizen">
            <i class="icon-document-text"></i>
            Notizen
            <span class="tab-count">${this.notizen.length}</span>
          </button>`:""}
          ${window.canViewTable&&window.canViewTable("kampagne","kooperationen")!==!1?`
          <button class="tab-button" data-tab="koops">
            <i class="icon-link"></i>
            Kooperationen
            <span class="tab-count">${this.kooperationen.length}</span>
          </button>`:""}
          ${window.canViewTable&&window.canViewTable("kampagne","sourcing")!==!1?`
          <button class="tab-button" data-tab="sourcing">
            <i class="icon-user-plus"></i>
            Creator Sourcing
            <span class="tab-count">${this.sourcingCreators.length}</span>
          </button>`:""}
          ${window.canViewTable&&window.canViewTable("kampagne","favoriten")!==!1?`
          <button class="tab-button" data-tab="favs">
            
            Favoriten
            <span class="tab-count">${this.favoriten.length}</span>
          </button>`:""}
          ${window.canViewTable&&window.canViewTable("kampagne","ratings")!==!1?`
          <button class="tab-button" data-tab="ratings">
            
            Bewertungen
            <span class="tab-count">${this.ratings.length}</span>
          </button>`:""}
          ${window.canViewTable&&window.canViewTable("kampagne","history")!==!1?`
          <button class="tab-button" data-tab="history">
            
            History
            <span class="tab-count">${this.historyCount+this.koopHistoryCount}</span>
          </button>`:""}
          ${window.canViewTable&&window.canViewTable("kampagne","rechnungen")!==!1?`
          <button class="tab-button" data-tab="rechnungen">
            <i class="icon-currency-euro"></i>
            Rechnungen
            <span class="tab-count">${this.rechnungen.length}</span>
          </button>`:""}
        </div>

        <!-- Tab Content -->
        <div class="tab-content">
          <!-- Informationen Tab -->
          <div class="tab-pane active" id="tab-info">
            <div class="detail-section">
              <h2>Kampagnen Informationen</h2>
              <div class="detail-grid">
                <!-- Hauptinformationen -->
                <div class="detail-card">
                  <h3>Kampagnen-Informationen</h3>
                  <div class="detail-grid-2">
                    <div class="detail-item">
                      <label>Kampagnenname:</label>
                      <span>${window.validatorSystem.sanitizeHtml(this.kampagneData.kampagnenname)}</span>
                    </div>
                    <div class="detail-item">
                      <label>Status:</label>
                      <span class="status-badge status-${this.kampagneData.status?.toLowerCase()||"unknown"}">
                        ${this.kampagneData.status||"-"}
                      </span>
                    </div>
                    <div class="detail-item">
                      <label>Art der Kampagne:</label>
                      <span>${r(this.kampagneData.kampagne_art_typen)}</span>
                    </div>
                    <div class="detail-item">
                      <label>Kampagnen-Nummer:</label>
                      <span>${this.kampagneData.kampagnen_nummer||"-"}</span>
                    </div>
                    <div class="detail-item">
                      <label>Start:</label>
                      <span>${n(this.kampagneData.start)}</span>
                    </div>
                    <div class="detail-item">
                      <label>Deadline:</label>
                      <span>${n(this.kampagneData.deadline)}</span>
                    </div>
                    <div class="detail-item">
                      <label>Drehort:</label>
                      <span>${window.validatorSystem.sanitizeHtml(this.kampagneData.drehort||"-")}</span>
                    </div>
                    <div class="detail-item">
                      <label>Creator Anzahl:</label>
                      <span>${this.kampagneData.creatoranzahl||0}</span>
                    </div>
                    <div class="detail-item">
                      <label>Video Anzahl:</label>
                      <span>${this.kampagneData.videoanzahl||0}</span>
                    </div>
                  </div>
                </div>

                <!-- Ziele und Budget -->
                <div class="detail-card">
                  <h3>Ziele & Budget</h3>
                  <div class="detail-item">
                    <label>Ziele:</label>
                    <span>${window.validatorSystem.sanitizeHtml(this.kampagneData.ziele||"-")}</span>
                  </div>
                  <div class="detail-item">
                    <label>Budget Info:</label>
                    <span>${window.validatorSystem.sanitizeHtml(this.kampagneData.budget_info||"-")}</span>
                  </div>
                </div>

                <!-- Unternehmen -->
                <div class="detail-card">
                  <h3>Unternehmen</h3>
                  <div class="detail-item">
                    <label>Firmenname:</label>
                    <span>${window.validatorSystem.sanitizeHtml(this.kampagneData.unternehmen?.firmenname||"Unbekannt")}</span>
                  </div>
                  <div class="detail-item">
                    <label>Webseite:</label>
                    <span>${this.kampagneData.unternehmen?.webseite?`<a href="${this.kampagneData.unternehmen.webseite}" target="_blank">${this.kampagneData.unternehmen.webseite}</a>`:"-"}</span>
                  </div>
                  <div class="detail-item">
                    <label>Branche:</label>
                    <span>${window.validatorSystem.sanitizeHtml(this.kampagneData.unternehmen?.branche_id||"-")}</span>
                  </div>
                </div>

                <!-- Marke -->
                <div class="detail-card">
                  <h3>Marke</h3>
                  <div class="detail-item">
                    <label>Markenname:</label>
                    <span>${window.validatorSystem.sanitizeHtml(this.kampagneData.marke?.markenname||"Unbekannt")}</span>
                  </div>
                  <div class="detail-item">
                    <label>Webseite:</label>
                    <span>${this.kampagneData.marke?.webseite?`<a href="${this.kampagneData.marke.webseite}" target="_blank">${this.kampagneData.marke.webseite}</a>`:"-"}</span>
                  </div>
                </div>

                <!-- Auftrag -->
                <div class="detail-card">
                  <h3>Auftrag</h3>
                  <div class="detail-item">
                    <label>Auftragsname:</label>
                    <span>${window.validatorSystem.sanitizeHtml(this.kampagneData.auftrag?.auftragsname||"Unbekannt")}</span>
                  </div>
                  <div class="detail-item">
                    <label>Status:</label>
                    <span class="status-badge status-${this.kampagneData.auftrag?.status?.toLowerCase()||"unknown"}">
                      ${this.kampagneData.auftrag?.status||"-"}
                    </span>
                  </div>
                  <div class="detail-item">
                    <label>Gesamt Budget:</label>
                    <span>${a(this.kampagneData.auftrag?.gesamt_budget)}${this.koopBudgetSum?` (aufgebraucht: ${a(this.koopBudgetSum)})`:""}</span>
                  </div>
                  <div class="detail-item">
                    <label>Creator Budget:</label>
                    <span>${a(this.kampagneData.auftrag?.creator_budget)}${this.koopBudgetSum?` (aufgebraucht: ${a(this.koopBudgetSum)})`:""}</span>
                  </div>
                </div>

                <!-- Ansprechpartner -->
                <div class="detail-card">
                  <h3>Ansprechpartner
                    <button class="btn-add-ansprechpartner-kampagne btn btn-sm btn-primary" style="margin-left: 10px;">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4" style="margin-right: 5px;">
                        <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
                      </svg>
                      Hinzufügen
                    </button>
                  </h3>
                  <div class="detail-item">
                    ${this.renderAnsprechpartner()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Creators Tab (gebuchte Creator) -->
          <div class="tab-pane" id="tab-creators">
            <div class="detail-section">
              <h2>Creator</h2>
              <div id="creators-list">
                ${this.renderCreatorsList()}
              </div>
            </div>
          </div>

          <!-- Notizen Tab -->
          <div class="tab-pane" id="tab-notizen">
            <div class="detail-section">
              <h2>Notizen</h2>
              <div id="notizen-list">
                ${this.renderNotizen()}
              </div>
            </div>
          </div>

          <!-- Bewertungen Tab -->
          <div class="tab-pane" id="tab-ratings">
            <div class="detail-section">
              <h2>Bewertungen</h2>
              <div id="ratings-list">
                ${this.renderRatings()}
              </div>
            </div>
          </div>

          <!-- Kooperationen Tab -->
          <div class="tab-pane" id="tab-koops">
            <div class="detail-section">
              <h2>Kooperationen</h2>
              ${this.renderKooperationen()}
            </div>
          </div>

          <!-- Creator Sourcing Tab (Kandidatenliste) -->
          <div class="tab-pane" id="tab-sourcing">
            <div class="detail-section">
              <h2>Creator Sourcing</h2>
              ${this.renderCreatorSourcing()}
            </div>
          </div>

          <!-- Favoriten Tab -->
          <div class="tab-pane" id="tab-favs">
            <div class="detail-section">
              <h2>Favoriten</h2>
              ${this.renderFavoriten()}
            </div>
          </div>

          <!-- Rechnungen Tab -->
          <div class="tab-pane" id="tab-rechnungen">
            <div class="detail-section">
              <h2>Rechnungen</h2>
              ${this.renderRechnungen()}
            </div>
          </div>

          <!-- History Tab -->
          <div class="tab-pane" id="tab-history">
            <div class="detail-section">
              <h2>History</h2>
              ${this.renderHistory()}
            </div>
          </div>
        </div>
      </div>

      
    `;window.setContentSafely(window.content,i)}renderCreatorsList(){if(!this.creator||this.creator.length===0)return`
        <div class="empty-state">
          <p>Keine Creators dieser Kampagne zugewiesen</p>
          <button id="btn-add-creator" class="primary-btn">Creator hinzufügen</button>
        </div>
      `;const e=this.creator.map(n=>({id:n.creator?.id,vorname:n.creator?.vorname,nachname:n.creator?.nachname,creator_types:n.creator?.creator_types||[],sprachen:n.creator?.sprachen||[],branchen:n.creator?.branchen||[],instagram_follower:n.creator?.instagram_follower,tiktok_follower:n.creator?.tiktok_follower,lieferadresse_stadt:n.creator?.lieferadresse_stadt,lieferadresse_land:n.creator?.lieferadresse_land}));return`${V(e)}`}renderNotizen(){return!this.notizen||this.notizen.length===0?`
        <div class="empty-state">
          <p>Keine Notizen vorhanden</p>
          <button id="btn-add-notiz" class="primary-btn">Notiz hinzufügen</button>
        </div>
      `:`
      <div class="notizen-container">
        ${this.notizen.map(t=>`
      <div class="notiz-card">
        <div class="notiz-header">
          <span>${t.user_name||"Unbekannt"}</span>
          <span>${new Date(t.created_at).toLocaleDateString("de-DE")}</span>
        </div>
        <div class="notiz-content">
          <p>${window.validatorSystem.sanitizeHtml(t.text)}</p>
        </div>
      </div>
    `).join("")}
      </div>
      <div class="notizen-actions">
        <button id="btn-add-notiz" class="primary-btn">Notiz hinzufügen</button>
      </div>
    `}renderRatings(){return!this.ratings||this.ratings.length===0?`
        <div class="empty-state">
          <p>Keine Bewertungen vorhanden</p>
          <button id="btn-add-rating" class="primary-btn">Bewertung hinzufügen</button>
        </div>
      `:`
      <div class="ratings-container">
        ${this.ratings.map(t=>`
      <div class="rating-card">
        <div class="rating-header">
          <span>${t.user_name||"Unbekannt"}</span>
          <span>${new Date(t.created_at).toLocaleDateString("de-DE")}</span>
        </div>
        <div class="rating-stars">
          ${Array.from({length:5},(n,a)=>`
            <span class="star ${a<t.rating?"filled":""}">★</span>
          `).join("")}
        </div>
      </div>
    `).join("")}
      </div>
      <div class="ratings-actions">
        <button id="btn-add-rating" class="primary-btn">Bewertung hinzufügen</button>
      </div>
    `}renderHistory(){if(!this.history||this.history.length===0)return`
        <div class="empty-state">
          <p>Keine Historie vorhanden</p>
        </div>
      `;const e=i=>i?new Date(i).toLocaleString("de-DE"):"-",n=`
      <div class="data-table-container">
        <h3 style="margin:8px 0;">Kampagne</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>Zeitpunkt</th>
              <th>User</th>
              <th>Alt</th>
              <th>Neu</th>
              <th>Kommentar</th>
            </tr>
          </thead>
          <tbody>${this.history.map(i=>`
      <tr>
        <td>${e(i.created_at)}</td>
        <td>${window.validatorSystem.sanitizeHtml(i.user_name||"-")}</td>
        <td>${window.validatorSystem.sanitizeHtml(i.old_status||"-")}</td>
        <td>${window.validatorSystem.sanitizeHtml(i.new_status||"-")}</td>
        <td>${window.validatorSystem.sanitizeHtml(i.comment||"")}</td>
      </tr>
    `).join("")}</tbody>
        </table>
      </div>`,r=`
      <div class="data-table-container" style="margin-top:16px;">
        <h3 style="margin:8px 0;">Kooperationen</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>Zeitpunkt</th>
              <th>User</th>
              <th>Kooperation</th>
              <th>Alt</th>
              <th>Neu</th>
              <th>Kommentar</th>
            </tr>
          </thead>
          <tbody>${(this.koopHistory||[]).map(i=>`
      <tr>
        <td>${e(i.created_at)}</td>
        <td>${window.validatorSystem.sanitizeHtml(i.user_name||"-")}</td>
        <td><a href="/kooperation/${i.kooperation_id}" onclick="event.preventDefault(); window.navigateTo('/kooperation/${i.kooperation_id}')">${window.validatorSystem.sanitizeHtml(i.kooperation_name||"—")}</a></td>
        <td>${window.validatorSystem.sanitizeHtml(i.old_status||"-")}</td>
        <td>${window.validatorSystem.sanitizeHtml(i.new_status||"-")}</td>
        <td>${window.validatorSystem.sanitizeHtml(i.comment||"")}</td>
      </tr>
    `).join("")}</tbody>
        </table>
      </div>`;return`${n}${r}`}showNotFound(){window.setHeadline("Kampagne nicht gefunden"),window.content.innerHTML=`
      <div class="error-message">
        <h2>Kampagne nicht gefunden</h2>
        <p>Die angeforderte Kampagne konnte nicht gefunden werden.</p>
        <button onclick="window.navigateTo('/kampagne')" class="primary-btn">Zurück zur Übersicht</button>
      </div>
    `}bindEvents(){document.addEventListener("click",e=>{e.target.classList.contains("tab-button")&&(e.preventDefault(),this.switchTab(e.target.dataset.tab))}),document.addEventListener("click",e=>{(e.target.id==="btn-edit-kampagne"||e.target.id==="btn-edit-kampagne-bottom")&&(e.preventDefault(),window.navigateTo(`/kampagne/${this.kampagneId}/edit`))}),document.addEventListener("click",e=>{e.target.id==="btn-add-creator"&&(e.preventDefault(),this.showAddCreatorModal())}),document.addEventListener("click",e=>{e.target.id==="btn-add-notiz"&&(e.preventDefault(),this.showAddNotizModal())}),document.addEventListener("click",e=>{e.target.id==="btn-add-rating"&&(e.preventDefault(),this.showAddRatingModal())}),document.addEventListener("click",e=>{e.target.id==="btn-delete-kampagne"&&(e.preventDefault(),this.showDeleteConfirmation())}),window.addEventListener("notizenUpdated",async e=>{e.detail.entityType==="kampagne"&&e.detail.entityId===this.kampagneId&&(console.log("🔄 KAMPAGNEDETAIL: Notizen wurden aktualisiert, lade neu..."),this.notizen=await window.notizenSystem.loadNotizen("kampagne",this.kampagneId),this.renderNotizen())}),window.addEventListener("bewertungenUpdated",async e=>{e.detail.entityType==="kampagne"&&e.detail.entityId===this.kampagneId&&(console.log("🔄 KAMPAGNEDETAIL: Bewertungen wurden aktualisiert, lade neu..."),this.ratings=await window.bewertungsSystem.loadBewertungen("kampagne",this.kampagneId),this.renderRatings())}),window.addEventListener("entityUpdated",async e=>{if(e.detail?.entity==="kooperation"){await this.loadKampagneData();const t=document.querySelector("#tab-history .detail-section");t&&(t.innerHTML=`<h2>History</h2>${this.renderHistory()}`);const n=document.querySelector('.tab-button[data-tab="history"] .tab-count');n&&(n.textContent=String(this.historyCount+this.koopHistoryCount))}}),document.addEventListener("click",async e=>{const t=e.target.closest(".action-item.add-favorite");if(!t)return;e.preventDefault();const n=t.dataset.creatorId,a=t.dataset.kampagneId||this.kampagneId;try{await window.supabase.from("kampagne_creator_favoriten").insert({kampagne_id:a,creator_id:n});const{data:r}=await window.supabase.from("kampagne_creator_favoriten").select(`
            creator:creator_id ( id, vorname, nachname, instagram_follower, tiktok_follower, lieferadresse_stadt, lieferadresse_land )
          `).eq("kampagne_id",a);this.favoriten=(r||[]).map(s=>({id:s.creator?.id,vorname:s.creator?.vorname,nachname:s.creator?.nachname,instagram_follower:s.creator?.instagram_follower,tiktok_follower:s.creator?.tiktok_follower,lieferadresse_stadt:s.creator?.lieferadresse_stadt,lieferadresse_land:s.creator?.lieferadresse_land}));const i=document.querySelector("#tab-favs .detail-section");i&&(i.innerHTML=`<h2>Favoriten</h2>${this.renderFavoriten()}`),alert("Zu Favoriten hinzugefügt.")}catch(r){console.error("❌ Fehler beim Hinzufügen zu Favoriten",r),alert("Hinzufügen zu Favoriten fehlgeschlagen.")}}),document.addEventListener("click",e=>{e.target.id==="btn-select-all-sourcing"&&(e.preventDefault(),document.querySelectorAll("#tab-sourcing .creator-check").forEach(t=>{t.checked=!0}))}),document.addEventListener("click",e=>{e.target.id==="btn-select-all-favs"&&(e.preventDefault(),document.querySelectorAll("#tab-favs .creator-check").forEach(t=>{t.checked=!0}))}),document.addEventListener("click",async e=>{const t=e.target.closest(".action-item.assign-to-campaign");if(!t)return;e.preventDefault();const n=t.dataset.creatorId,a=t.dataset.kampagneId||this.kampagneId;try{await window.supabase.from("kampagne_creator").insert({kampagne_id:a,creator_id:n}),await window.supabase.from("kampagne_creator_favoriten").delete().eq("kampagne_id",a).eq("creator_id",n);const[{data:r},{data:i}]=await Promise.all([window.supabase.from("kampagne_creator").select("*, creator:creator_id(id, vorname, nachname, instagram_follower, tiktok_follower, lieferadresse_stadt, lieferadresse_land)").eq("kampagne_id",a),window.supabase.from("kampagne_creator_favoriten").select("creator:creator_id(id, vorname, nachname, instagram_follower, tiktok_follower, lieferadresse_stadt, lieferadresse_land)").eq("kampagne_id",a)]);this.creator=r||[],this.favoriten=(i||[]).map(d=>({id:d.creator?.id,vorname:d.creator?.vorname,nachname:d.creator?.nachname,instagram_follower:d.creator?.instagram_follower,tiktok_follower:d.creator?.tiktok_follower,lieferadresse_stadt:d.creator?.lieferadresse_stadt,lieferadresse_land:d.creator?.lieferadresse_land}));const s=document.querySelector("#tab-favs .detail-section");s&&(s.innerHTML=`<h2>Favoriten</h2>${this.renderFavoriten()}`);const o=document.querySelector("#tab-creators #creators-list");o&&(o.innerHTML=this.renderCreatorsList());const l=document.querySelector('.tab-button[data-tab="favs"] .tab-count');l&&(l.textContent=String(this.favoriten.length));const u=document.querySelector('.tab-button[data-tab="creators"] .tab-count');u&&(u.textContent=String(this.creator.length)),this.switchTab("creators")}catch(r){console.error("❌ Fehler beim Hinzufügen zur Kampagne",r),alert("Hinzufügen zur Kampagne fehlgeschlagen.")}}),document.addEventListener("click",async e=>{const t=e.target.closest(".action-item.remove-favorite");if(!t)return;e.preventDefault();const n=t.dataset.creatorId,a=t.dataset.kampagneId||this.kampagneId;try{await window.supabase.from("kampagne_creator_favoriten").delete().eq("kampagne_id",a).eq("creator_id",n);const{data:r}=await window.supabase.from("kampagne_creator_favoriten").select("creator:creator_id(id, vorname, nachname, instagram_follower, tiktok_follower, lieferadresse_stadt, lieferadresse_land)").eq("kampagne_id",a);this.favoriten=(r||[]).map(o=>({id:o.creator?.id,vorname:o.creator?.vorname,nachname:o.creator?.nachname,instagram_follower:o.creator?.instagram_follower,tiktok_follower:o.creator?.tiktok_follower,lieferadresse_stadt:o.creator?.lieferadresse_stadt,lieferadresse_land:o.creator?.lieferadresse_land}));const i=document.querySelector("#tab-favs .detail-section");i&&(i.innerHTML=`<h2>Favoriten</h2>${this.renderFavoriten()}`);const s=document.querySelector('.tab-button[data-tab="favs"] .tab-count');s&&(s.textContent=String(this.favoriten.length))}catch(r){console.error("❌ Fehler beim Entfernen aus Favoriten",r),alert("Entfernen aus Favoriten fehlgeschlagen.")}})}switchTab(e){console.log("🔄 KAMPAGNEDETAIL: Wechsle zu Tab:",e),document.querySelectorAll(".tab-button").forEach(a=>{a.classList.remove("active")}),document.querySelectorAll(".tab-pane").forEach(a=>{a.classList.remove("active")});const t=document.querySelector(`[data-tab="${e}"]`),n=document.getElementById(`tab-${e}`);t&&n&&(t.classList.add("active"),n.classList.add("active"))}showAddCreatorModal(){console.log('🎯 Zeige "Creator hinzufügen" Modal'),alert("Funktion zum Hinzufügen von Creators wird implementiert...")}showAddNotizModal(){console.log('🎯 Zeige "Notiz hinzufügen" Modal'),window.notizenSystem&&window.notizenSystem.showAddNotizModal("kampagne",this.kampagneId)}showAddRatingModal(){console.log('🎯 Zeige "Bewertung hinzufügen" Modal'),window.bewertungsSystem&&window.bewertungsSystem.showAddRatingModal("kampagne",this.kampagneId)}showDeleteConfirmation(){confirm("Sind Sie sicher, dass Sie diese Kampagne löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.")&&this.deleteKampagne()}async deleteKampagne(){try{const{error:e}=await window.supabase.from("kampagne").delete().eq("id",this.kampagneId);if(e)throw e;window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"kampagne",action:"deleted",id:this.kampagneId}})),window.navigateTo("/kampagne")}catch(e){console.error("❌ Fehler beim Löschen der Kampagne:",e),alert("Ein unerwarteter Fehler ist aufgetreten.")}}destroy(){console.log("🗑️ KAMPAGNEDETAIL: Destroy aufgerufen"),window.setContentSafely(""),console.log("✅ KAMPAGNEDETAIL: Destroy abgeschlossen")}renderAnsprechpartner(){return!this.kampagneData.ansprechpartner||this.kampagneData.ansprechpartner.length===0?'<span class="text-muted">Keine Ansprechpartner zugeordnet</span>':`<div class="tags">${this.kampagneData.ansprechpartner.filter(t=>t&&t.vorname&&t.nachname).map(t=>{const n=[t.position?.name,t.unternehmen?.firmenname].filter(Boolean).join(" • ");return`<a href="#" class="tag tag--ansprechpartner" onclick="event.preventDefault(); window.navigateTo('/ansprechpartner/${t.id}')">
          ${t.vorname} ${t.nachname}
          ${n?`<small style="opacity: 0.8; margin-left: 5px;">(${n})</small>`:""}
        </a>`}).join("")}</div>`}bindAnsprechpartnerEvents(){const e=document.querySelector(".btn-add-ansprechpartner-kampagne");e&&e.addEventListener("click",()=>{window.actionsDropdown.openAddAnsprechpartnerToKampagneModal(this.kampagneId)}),window.addEventListener("entityUpdated",t=>{t.detail.entity==="ansprechpartner"&&t.detail.action==="added"&&t.detail.kampagneId===this.kampagneId&&this.loadKampagneData().then(()=>{this.render()})})}showEditForm(){console.log("🎯 KAMPAGNEDETAIL: Zeige Bearbeitungsformular"),window.setHeadline("Kampagne bearbeiten");const e={...this.kampagneData};e._isEditMode=!0,e._entityId=this.kampagneId,this.kampagneData.unternehmen_id&&(e.unternehmen_id=this.kampagneData.unternehmen_id,console.log("🏢 KAMPAGNEDETAIL: Unternehmen-ID für Edit-Mode:",this.kampagneData.unternehmen_id)),this.kampagneData.marke_id&&(e.marke_id=this.kampagneData.marke_id,console.log("🏷️ KAMPAGNEDETAIL: Marke-ID für Edit-Mode:",this.kampagneData.marke_id)),this.kampagneData.auftrag_id&&(e.auftrag_id=this.kampagneData.auftrag_id,console.log("📋 KAMPAGNEDETAIL: Auftrag-ID für Edit-Mode:",this.kampagneData.auftrag_id)),e.ansprechpartner_ids=this.kampagneData.ansprechpartner?this.kampagneData.ansprechpartner.map(a=>a.id):[],e.mitarbeiter_ids=this.kampagneData.mitarbeiter?this.kampagneData.mitarbeiter.map(a=>a.id):[],e.pm_ids=this.kampagneData.projektmanager?this.kampagneData.projektmanager.map(a=>a.id):[],e.scripter_ids=this.kampagneData.scripter?this.kampagneData.scripter.map(a=>a.id):[],e.cutter_ids=this.kampagneData.cutter?this.kampagneData.cutter.map(a=>a.id):[],this.kampagneData.status_id&&(e.status_id=this.kampagneData.status_id),this.kampagneData.drehort_typ_id&&(e.drehort_typ_id=this.kampagneData.drehort_typ_id),this.kampagneData.art_der_kampagne&&Array.isArray(this.kampagneData.art_der_kampagne)?(e.art_der_kampagne=this.kampagneData.art_der_kampagne,console.log("🎨 KAMPAGNEDETAIL: art_der_kampagne gesetzt:",this.kampagneData.art_der_kampagne)):console.log("⚠️ KAMPAGNEDETAIL: art_der_kampagne NICHT gesetzt oder nicht Array:",this.kampagneData.art_der_kampagne),this.kampagneData.plattform_ids&&Array.isArray(this.kampagneData.plattform_ids)&&(e.plattform_ids=this.kampagneData.plattform_ids),this.kampagneData.format_ids&&Array.isArray(this.kampagneData.format_ids)&&(e.format_ids=this.kampagneData.format_ids),this.kampagneData.kampagne_typ?(e.kampagne_typ=this.kampagneData.kampagne_typ,console.log("🏷️ KAMPAGNEDETAIL: kampagne_typ gesetzt:",this.kampagneData.kampagne_typ)):console.log("⚠️ KAMPAGNEDETAIL: kampagne_typ NICHT gesetzt"),console.log("📋 KAMPAGNEDETAIL: Multi-Select IDs extrahiert:",{ansprechpartner_ids:e.ansprechpartner_ids,mitarbeiter_ids:e.mitarbeiter_ids,pm_ids:e.pm_ids,scripter_ids:e.scripter_ids,cutter_ids:e.cutter_ids,status_id:e.status_id,drehort_typ_id:e.drehort_typ_id,art_der_kampagne:e.art_der_kampagne,plattform_ids:e.plattform_ids,format_ids:e.format_ids}),console.log("📋 KAMPAGNEDETAIL: FormData für Rendering:",e);const t=window.formSystem.renderFormOnly("kampagne",e);window.content.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Kampagne bearbeiten</h1>
          <p>Bearbeiten Sie die Informationen von ${this.kampagneData.kampagnenname}</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/kampagne/${this.kampagneId}')" class="secondary-btn">Zurück zu Details</button>
        </div>
      </div>
      
      <div class="form-page">
        ${t}
      </div>
    `,window.formSystem.bindFormEvents("kampagne",e);const n=document.getElementById("kampagne-form");if(n){n.dataset.isEditMode="true",n.dataset.entityType="kampagne",n.dataset.entityId=this.kampagneId;const a={unternehmen_id:e.unternehmen_id,marke_id:e.marke_id,auftrag_id:e.auftrag_id,status_id:e.status_id,drehort_typ_id:e.drehort_typ_id,kampagne_typ:e.kampagne_typ,ansprechpartner_ids:e.ansprechpartner_ids,mitarbeiter_ids:e.mitarbeiter_ids,pm_ids:e.pm_ids,scripter_ids:e.scripter_ids,cutter_ids:e.cutter_ids,art_der_kampagne:e.art_der_kampagne,plattform_ids:e.plattform_ids,format_ids:e.format_ids};n.dataset.editModeData=JSON.stringify(a),console.log("📋 KAMPAGNEDETAIL: EditModeData gesetzt:",a),console.log("🎨 KAMPAGNEDETAIL: art_der_kampagne in editModeData:",a.art_der_kampagne),e.unternehmen_id&&(n.dataset.existingUnternehmenId=e.unternehmen_id),e.marke_id&&(n.dataset.existingMarkeId=e.marke_id),e.auftrag_id&&(n.dataset.existingAuftragId=e.auftrag_id),console.log("📋 KAMPAGNEDETAIL: Form-Datasets gesetzt:",{isEditMode:n.dataset.isEditMode,entityType:n.dataset.entityType,entityId:n.dataset.entityId,existingUnternehmenId:n.dataset.existingUnternehmenId,existingMarkeId:n.dataset.existingMarkeId,existingAuftragId:n.dataset.existingAuftragId,editModeData:"Set"}),n.onsubmit=async r=>{r.preventDefault(),await this.handleEditFormSubmit()},console.log("🔍 KAMPAGNEDETAIL: Form Datasets gesetzt:",{entityId:n.dataset.entityId,isEditMode:n.dataset.isEditMode,entityType:n.dataset.entityType,existingUnternehmenId:n.dataset.existingUnternehmenId,existingMarkeId:n.dataset.existingMarkeId,existingAuftragId:n.dataset.existingAuftragId})}}async handleEditFormSubmit(){console.log("📝 KAMPAGNEDETAIL: Verarbeite Formular-Submission...");const e=document.querySelector('form[data-entity-type="kampagne"]');if(!e){console.error("❌ Formular nicht gefunden");return}try{const t=new FormData(e),n={};e.querySelectorAll('select[style*="display: none"], select[style*="display:none"]').forEach(i=>{if(i.name&&i.name.includes("_ids")){const s=i.name.replace("[]",""),o=Array.from(i.selectedOptions).map(l=>l.value);o.length>0&&(n[s]=o,console.log(`🏷️ Tag-basiertes Feld ${s} aus Hidden-Select gesammelt:`,o))}});for(const[i,s]of t.entries())if(i.includes("[]")){const o=i.replace("[]","");n[o]||(n[o]=[]),n[o].push(s)}else!n.hasOwnProperty(i)||!Array.isArray(n[i])?n[i]=s:console.log(`⚠️ Überspringe ${i}, bereits als Array gesetzt:`,n[i]);if(console.log("📋 KAMPAGNEDETAIL: Submit-Daten gesammelt:",n),await window.dataService.updateEntity("kampagne",this.kampagneId,n)){try{const i=c=>Array.isArray(c)?c:c?[c]:[],s=c=>Array.from(new Set((c||[]).filter(Boolean)));if(n.plattform_ids!==void 0){const c=s(i(n.plattform_ids));if(await window.supabase.from("kampagne_plattformen").delete().eq("kampagne_id",this.kampagneId),c.length>0){const m=c.map(h=>({kampagne_id:this.kampagneId,plattform_id:h}));await window.supabase.from("kampagne_plattformen").insert(m),console.log("✅ KAMPAGNEDETAIL: Plattform-Verknüpfungen aktualisiert:",m.length)}else console.log("ℹ️ KAMPAGNEDETAIL: Keine Plattformen ausgewählt")}if(n.format_ids!==void 0){const c=s(i(n.format_ids));if(await window.supabase.from("kampagne_formate").delete().eq("kampagne_id",this.kampagneId),c.length>0){const m=c.map(h=>({kampagne_id:this.kampagneId,format_id:h}));await window.supabase.from("kampagne_formate").insert(m),console.log("✅ KAMPAGNEDETAIL: Format-Verknüpfungen aktualisiert:",m.length)}else console.log("ℹ️ KAMPAGNEDETAIL: Keine Formate ausgewählt")}const o=s(i(n.mitarbeiter_ids)),l=s(i(n.pm_ids)),u=s(i(n.scripter_ids)),d=s(i(n.cutter_ids));if(o.length>0||l.length>0||u.length>0||d.length>0){await window.supabase.from("kampagne_mitarbeiter").delete().eq("kampagne_id",this.kampagneId);const c=[];o.forEach(m=>c.push({kampagne_id:this.kampagneId,mitarbeiter_id:m,role:"projektmanager"})),l.forEach(m=>c.push({kampagne_id:this.kampagneId,mitarbeiter_id:m,role:"projektmanager"})),u.forEach(m=>c.push({kampagne_id:this.kampagneId,mitarbeiter_id:m,role:"scripter"})),d.forEach(m=>c.push({kampagne_id:this.kampagneId,mitarbeiter_id:m,role:"cutter"})),c.length>0&&(await window.supabase.from("kampagne_mitarbeiter").insert(c),console.log("✅ KAMPAGNEDETAIL: Mitarbeiter-Zuordnungen aktualisiert:",c.length))}if(n.ansprechpartner_ids!==void 0){const c=s(i(n.ansprechpartner_ids));if(await window.supabase.from("ansprechpartner_kampagne").delete().eq("kampagne_id",this.kampagneId),c.length>0){const m=c.map(h=>({kampagne_id:this.kampagneId,ansprechpartner_id:h}));await window.supabase.from("ansprechpartner_kampagne").insert(m),console.log("✅ KAMPAGNEDETAIL: Ansprechpartner-Zuordnungen aktualisiert:",m.length)}}}catch(i){console.warn("⚠️ KAMPAGNEDETAIL: Junction Table Updates konnten nicht vollständig durchgeführt werden",i)}this.showSuccessMessage("Kampagne erfolgreich aktualisiert!"),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"kampagne",action:"updated",id:this.kampagneId}})),setTimeout(()=>{window.navigateTo(`/kampagne/${this.kampagneId}`)},1500)}}catch(t){console.error("❌ Fehler beim Aktualisieren der Kampagne:",t),this.showErrorMessage("Ein unerwarteter Fehler ist aufgetreten.")}}showSuccessMessage(e){const t=document.createElement("div");t.className="alert alert-success",t.textContent=e;const n=document.getElementById("kampagne-form");n&&(n.parentNode.insertBefore(t,n),setTimeout(()=>{t.remove()},5e3))}showErrorMessage(e){const t=document.createElement("div");t.className="alert alert-danger",t.textContent=e;const n=document.getElementById("kampagne-form");n&&(n.parentNode.insertBefore(t,n),setTimeout(()=>{t.remove()},5e3))}}const Ee=new Mt;class zt{static formatStatus(e){return{active:"Aktiv",inactive:"Inaktiv",completed:"Abgeschlossen",cancelled:"Storniert",draft:"Entwurf",pending:"Ausstehend"}[e]||e||"Unbekannt"}static formatKampagnenArt(e){return e?Array.isArray(e)?e.join(", "):{influencer:"Influencer Kampagne",ugc:"UGC",igc:"IGC",ai:"AI"}[e]||e||"Unbekannt":"-"}static calculateProgress(e){if(!e.start||!e.deadline)return 0;const t=new Date(e.start),n=new Date(e.deadline),a=new Date;if(a<t)return 0;if(a>n)return 100;const r=n-t,i=a-t;return Math.round(i/r*100)}static isKampagneActive(e){if(!e.start||!e.deadline)return!1;const t=new Date,n=new Date(e.start),a=new Date(e.deadline);return t>=n&&t<=a}static isKampagneExpired(e){if(!e.deadline)return!1;const t=new Date,n=new Date(e.deadline);return t>n}static getRemainingDays(e){if(!e.deadline)return null;const t=new Date,a=new Date(e.deadline)-t;return Math.ceil(a/(1e3*60*60*24))}static formatBudget(e){return e?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(e):"-"}static formatDate(e){return e?new Date(e).toLocaleDateString("de-DE"):"-"}static formatDateTime(e){return e?new Date(e).toLocaleString("de-DE"):"-"}static validateKampagneData(e){const t={};if((!e.kampagnenname||e.kampagnenname.trim()==="")&&(t.kampagnenname="Kampagnenname ist erforderlich"),e.unternehmen_id||(t.unternehmen_id="Unternehmen ist erforderlich"),e.start||(t.start="Startdatum ist erforderlich"),e.deadline||(t.deadline="Deadline ist erforderlich"),e.start&&e.deadline){const n=new Date(e.start),a=new Date(e.deadline);n>=a&&(t.deadline="Deadline muss nach dem Startdatum liegen")}return e.creatoranzahl&&(isNaN(e.creatoranzahl)||e.creatoranzahl<0)&&(t.creatoranzahl="Creator Anzahl muss eine positive Zahl sein"),e.videoanzahl&&(isNaN(e.videoanzahl)||e.videoanzahl<0)&&(t.videoanzahl="Video Anzahl muss eine positive Zahl sein"),{isValid:Object.keys(t).length===0,errors:t}}static createKampagneSummary(e){const t=this.calculateProgress(e),n=this.isKampagneActive(e),a=this.getRemainingDays(e);return{id:e.id,name:e.kampagnenname,status:e.status,progress:t,isActive:n,remainingDays:a,creatorCount:e.creatoranzahl||0,videoCount:e.videoanzahl||0,start:this.formatDate(e.start),deadline:this.formatDate(e.deadline)}}static getFilterOptions(){return{status:[{value:"active",label:"Aktiv"},{value:"inactive",label:"Inaktiv"},{value:"completed",label:"Abgeschlossen"},{value:"cancelled",label:"Storniert"},{value:"draft",label:"Entwurf"},{value:"pending",label:"Ausstehend"}],art_der_kampagne:[{value:"influencer",label:"Influencer Kampagne"},{value:"ugc",label:"UGC Kampagne"},{value:"paid",label:"Paid Kampagne"},{value:"organic",label:"Organische Kampagne"},{value:"hybrid",label:"Hybrid Kampagne"}]}}static createExportData(e){return e.map(t=>({Kampagnenname:t.kampagnenname,Status:this.formatStatus(t.status),"Art der Kampagne":this.formatKampagnenArt(t.art_der_kampagne),Start:this.formatDate(t.start),Deadline:this.formatDate(t.deadline),"Creator Anzahl":t.creatoranzahl||0,"Video Anzahl":t.videoanzahl||0,Drehort:t.drehort||"-",Ziele:t.ziele||"-","Budget Info":t.budget_info||"-",Unternehmen:t.unternehmen?.firmenname||"Unbekannt",Marke:t.marke?.markenname||"Unbekannt",Auftrag:t.auftrag?.auftragsname||"Unbekannt","Erstellt am":this.formatDateTime(t.created_at),"Aktualisiert am":this.formatDateTime(t.updated_at)}))}static createKampagneStats(e){const t={total:e.length,active:0,completed:0,cancelled:0,draft:0,totalCreators:0,totalVideos:0,totalBudget:0};return e.forEach(n=>{switch(n.status){case"active":t.active++;break;case"completed":t.completed++;break;case"cancelled":t.cancelled++;break;case"draft":t.draft++;break}t.totalCreators+=n.creatoranzahl||0,t.totalVideos+=n.videoanzahl||0,n.budget_info}),t}}const It=new zt;class Tt{constructor(){this.selectedBriefings=new Set,this._boundEventListeners=new Set}async init(e){if(e&&e!=="new"&&window.moduleRegistry)return window.navigateTo(`/briefing/${e}`);if(window.setHeadline("Briefings Übersicht"),window.breadcrumbSystem&&window.breadcrumbSystem.updateBreadcrumb([{label:"Briefing",url:"/briefing",clickable:!1}]),window.bulkActionSystem&&window.bulkActionSystem.hideForKunden(),!(window.canViewPage&&window.canViewPage("briefing")||await window.checkUserPermission("briefing","can_view"))){window.content.innerHTML=`
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Briefings anzuzeigen.</p>
        </div>
      `;return}window.bulkActionSystem?.registerList("briefing",this),this.bindEvents(),await this.loadAndRender()}async loadAndRender(){try{await this.render(),await this.initializeFilterBar();const e=A.getFilters("briefing");console.log("🔍 Lade Briefings mit Filter:",e);const t=await this.loadBriefingsWithRelations(e);console.log("📊 Briefings geladen:",t?.length||0),this.updateTable(t)}catch(e){window.ErrorHandler.handle(e,"BriefingList.loadAndRender")}}async loadBriefingsWithRelations(e={}){try{if(!window.supabase)return console.warn("⚠️ Supabase nicht verfügbar - verwende Mock-Daten"),await window.dataService.loadEntities("briefing",e);const t=window.currentUser?.rolle==="admin";let n=[],a=[];if(!t)try{const{data:d}=await window.supabase.from("kampagne_mitarbeiter").select("kampagne_id").eq("mitarbeiter_id",window.currentUser?.id),c=(d||[]).map(g=>g.kampagne_id).filter(Boolean),{data:m}=await window.supabase.from("marke_mitarbeiter").select("marke_id").eq("mitarbeiter_id",window.currentUser?.id),h=(m||[]).map(g=>g.marke_id).filter(Boolean);let p=[];if(h.length>0){const{data:g}=await window.supabase.from("kampagne").select("id").in("marke_id",h);p=(g||[]).map(b=>b.id).filter(Boolean)}if(n=[...new Set([...c,...p])],n.length>0){const{data:g}=await window.supabase.from("kooperationen").select("id").in("kampagne_id",n);a=(g||[]).map(b=>b.id)}console.log(`🔍 BRIEFINGLIST: Mitarbeiter ${window.currentUser?.id} hat Zugriff auf:`,{direkteKampagnen:c.length,markenKampagnen:p.length,gesamtKampagnen:n.length,kooperationen:a.length})}catch(d){console.error("❌ Fehler beim Laden der Zuordnungen:",d)}let r=window.supabase.from("briefings").select(`
          *,
          unternehmen:unternehmen_id(id, firmenname),
          marke:marke_id(id, markenname),
          kampagne:kampagne_id(id, kampagnenname),
          assignee:assignee_id(id, name)
        `).order("created_at",{ascending:!1});if(!t&&window.currentUser?.rolle!=="kunde"){const d=[`assignee_id.eq.${window.currentUser?.id}`];a.length&&d.push(`kooperation_id.in.(${a.join(",")})`),n.length&&d.push(`kampagne_id.in.(${n.join(",")})`),r=r.or(d.join(","))}if(e){const d=(c,m,h="string")=>{if(m==null||m===""||m==="[object Object]")return;const p=String(m);switch(h){case"uuid":r=r.eq(c,p);break;case"dateRange":m.from&&(r=r.gte(c,m.from)),m.to&&(r=r.lte(c,m.to));break;case"stringIlike":r=r.ilike(c,`%${p}%`);break;default:r=r.eq(c,p)}};d("unternehmen_id",e.unternehmen_id,"uuid"),d("marke_id",e.marke_id,"uuid"),d("assignee_id",e.assignee_id,"uuid"),d("status",e.status),e.product_service_offer&&d("product_service_offer",e.product_service_offer,"stringIlike"),e.deadline&&d("deadline",e.deadline,"dateRange"),e.created_at&&d("created_at",e.created_at,"dateRange")}const{data:i,error:s}=await r;if(s)throw s;const o=i||[],l=o.filter(d=>!d.unternehmen&&d.unternehmen_id).map(d=>d.unternehmen_id),u=o.filter(d=>!d.marke&&d.marke_id).map(d=>d.marke_id);this._unternehmenMap={},this._markeMap={};try{if(l.length>0){const d=Array.from(new Set(l)),{data:c}=await window.supabase.from("unternehmen").select("id, firmenname").in("id",d);(c||[]).forEach(m=>{this._unternehmenMap[m.id]=m})}if(u.length>0){const d=Array.from(new Set(u)),{data:c}=await window.supabase.from("marke").select("id, markenname").in("id",d);(c||[]).forEach(m=>{this._markeMap[m.id]=m})}}catch(d){console.warn("⚠️ Konnte Fallback-Relationen für Briefings nicht vollständig laden:",d)}return o.map(d=>({...d,unternehmen:d.unternehmen||(d.unternehmen_id?this._unternehmenMap[d.unternehmen_id]:null)||null,marke:d.marke||(d.marke_id?this._markeMap[d.marke_id]:null)||null,assignee:d.assignee?{id:d.assignee.id,name:d.assignee.name}:null}))}catch(t){return console.error("❌ Fehler beim Laden der Briefings mit Beziehungen:",t),await window.dataService.loadEntities("briefing",e)}}async render(){window.currentUser?.permissions?.briefing?.can_edit;const e=`<div class="filter-bar">
      <div class="filter-left">
        <div id="filter-container"></div>
      </div>
      <div class="filter-right">
        <button id="btn-filter-reset" class="secondary-btn" style="display:${this.hasActiveFilters()?"inline-block":"none"};">Filter zurücksetzen</button>
      </div>
    </div>`,t=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Briefings</h1>
          <p>Verwalten Sie alle Briefings</p>
        </div>
        <div class="page-header-right">
          ${window.currentUser?.permissions?.briefing?.can_edit?'<button id="btn-briefing-new" class="primary-btn">Neues Briefing anlegen</button>':""}
        </div>
      </div>

      <div class="table-filter-wrapper">
        ${e}
        <div class="table-actions">
          <button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
          <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>
        </div>
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th><input type="checkbox" id="select-all-briefings"></th>
              <th>Produkt/Angebot</th>
              <th>Unternehmen</th>
              <th>Marke</th>
              <th>Status</th>
              <th>Kampagne</th>
              <th>Deadline</th>
              <th>Zugewiesen</th>
              <th>Erstellt</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody id="briefings-table-body">
            <tr>
              <td colspan="10" class="loading">Lade Briefings...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;window.setContentSafely(window.content,t)}async initializeFilterBar(){const e=document.getElementById("filter-container");e&&await A.renderFilterBar("briefing",e,t=>this.onFiltersApplied(t),()=>this.onFiltersReset())}onFiltersApplied(e){console.log("🔍 BriefingList: Filter angewendet:",e),A.applyFilters("briefing",e),this.loadAndRender()}onFiltersReset(){console.log("🔄 BriefingList: Filter zurückgesetzt"),A.resetFilters("briefing"),this.loadAndRender()}bindEvents(){this.boundFilterResetHandler=e=>{e.target.id==="btn-filter-reset"&&this.onFiltersReset()},document.addEventListener("click",this.boundFilterResetHandler),document.addEventListener("click",e=>{(e.target.id==="btn-briefing-new"||e.target.id==="btn-briefing-new-filter")&&(e.preventDefault(),window.navigateTo("/briefing/new"))}),document.addEventListener("click",e=>{if(e.target.id==="btn-select-all"){e.preventDefault(),document.querySelectorAll(".briefing-check").forEach(a=>{a.checked=!0,a.dataset.id&&this.selectedBriefings.add(a.dataset.id)});const n=document.getElementById("select-all-briefings");n&&(n.indeterminate=!1,n.checked=!0),this.updateSelection()}}),document.addEventListener("click",e=>{if(e.target.id==="btn-deselect-all"){e.preventDefault(),document.querySelectorAll(".briefing-check").forEach(a=>{a.checked=!1}),this.selectedBriefings.clear();const n=document.getElementById("select-all-briefings");n&&(n.indeterminate=!1,n.checked=!1),this.updateSelection()}}),document.addEventListener("click",e=>{if(e.target.classList.contains("table-link")&&e.target.dataset.table==="briefing"){e.preventDefault();const t=e.target.dataset.id;window.navigateTo(`/briefing/${t}`)}}),window.addEventListener("entityUpdated",e=>{e.detail.entity==="briefing"&&this.loadAndRender()}),document.addEventListener("change",e=>{if(e.target.id==="select-all-briefings"){const t=document.querySelectorAll(".briefing-check"),n=e.target.checked;t.forEach(a=>{a.checked=n,n?this.selectedBriefings.add(a.dataset.id):this.selectedBriefings.delete(a.dataset.id)}),this.updateSelection()}}),document.addEventListener("change",e=>{e.target.classList.contains("briefing-check")&&(e.target.checked?this.selectedBriefings.add(e.target.dataset.id):this.selectedBriefings.delete(e.target.dataset.id),this.updateSelection(),this.updateSelectAllCheckbox())})}hasActiveFilters(){const e=A.getFilters("briefing");return Object.keys(e).length>0}async showDeleteSelectedConfirmation(){const e=this.selectedBriefings.size;if(e===0){alert("Keine Briefings ausgewählt.");return}const t=e===1?"Möchten Sie das ausgewählte Briefing wirklich löschen?":`Möchten Sie die ${e} ausgewählten Briefings wirklich löschen?`;window.confirmationModal?(await window.confirmationModal.open({title:"Löschvorgang bestätigen",message:t,confirmText:"Endgültig löschen",cancelText:"Abbrechen",danger:!0}))?.confirmed&&this.deleteSelectedBriefings():confirm(`${t}

Dieser Vorgang kann nicht rückgängig gemacht werden.`)&&this.deleteSelectedBriefings()}async deleteSelectedBriefings(){const e=Array.from(this.selectedBriefings),t=e.length;console.log(`🗑️ Lösche ${t} Briefings...`),e.forEach(n=>{const a=document.querySelector(`tr[data-id="${n}"]`);a&&(a.style.opacity="0.5")});try{const n=await window.dataService.deleteEntities("briefing",e);if(n.success){e.forEach(r=>{document.querySelector(`tr[data-id="${r}"]`)?.remove()}),alert(`✅ ${n.deletedCount} Briefings erfolgreich gelöscht.`),this.selectedBriefings.clear(),this.updateSelection(),this.updateSelectAllCheckbox();const a=document.getElementById("briefings-table-body");a&&a.children.length===0&&await this.loadAndRender(),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"briefing",action:"bulk-deleted",count:n.deletedCount}}))}else throw new Error(n.error||"Löschen fehlgeschlagen")}catch(n){e.forEach(a=>{const r=document.querySelector(`tr[data-id="${a}"]`);r&&(r.style.opacity="1")}),console.error("❌ Fehler beim Löschen:",n),alert(`❌ Fehler beim Löschen: ${n.message}`),await this.loadAndRender()}}updateSelection(){const e=this.selectedBriefings.size,t=document.getElementById("btn-deselect-all"),n=document.getElementById("btn-delete-selected");t&&(t.style.display=e>0?"inline-block":"none"),n&&(n.style.display=e>0?"inline-block":"none")}updateSelectAllCheckbox(){const e=document.getElementById("select-all-briefings"),t=document.querySelectorAll(".briefing-check");if(!e||t.length===0)return;const n=Array.from(t).filter(r=>r.checked).length,a=t.length;e.checked=n===a,e.indeterminate=n>0&&n<a}renderUnternehmen(e){const t=e.unternehmen||(e.unternehmen_id?this._unternehmenMap?.[e.unternehmen_id]:null);if(!t||!t.firmenname)return"-";const n=[{name:t.firmenname,type:"org",id:t.id,entityType:"unternehmen"}];return z.renderBubbles(n)}renderMarke(e){const t=e.marke||(e.marke_id?this._markeMap?.[e.marke_id]:null);if(!t||!t.markenname)return"-";const n=[{name:t.markenname,type:"org",id:t.id,entityType:"marke"}];return z.renderBubbles(n)}renderAssignee(e){if(!e||!e.name)return"-";const t=[{name:e.name,type:"person",id:e.id,entityType:"mitarbeiter"}];return z.renderBubbles(t)}async updateTable(e){const t=document.getElementById("briefings-table-body");if(!t)return;if(!e||e.length===0){const{renderEmptyState:i}=await x(async()=>{const{renderEmptyState:s}=await import("./core-C7Vz5Umf.js").then(o=>o.F);return{renderEmptyState:s}},[]);i(t);return}const n=i=>i?new Date(i).toLocaleDateString("de-DE"):"-",a=i=>window.validatorSystem.sanitizeHtml(i||"—"),r=e.map(i=>`
      <tr data-id="${i.id}">
        <td><input type="checkbox" class="briefing-check" data-id="${i.id}"></td>
        <td>
          <a href="#" class="table-link" data-table="briefing" data-id="${i.id}">
            ${a((i.product_service_offer||"").toString().slice(0,80))}
          </a>
        </td>
        <td>${this.renderUnternehmen(i)}</td>
        <td>${this.renderMarke(i)}</td>
        <td>
          <span class="status-badge status-${(i.status||"unknown").toLowerCase()}">
            ${a(i.status)}
          </span>
        </td>
        <td>
          ${i.kampagne?.id?`<span class="tag tag--type">${a(i.kampagne.kampagnenname)}</span>`:"-"}
        </td>
        <td>${n(i.deadline)}</td>
        <td>${this.renderAssignee(i.assignee)}</td>
        <td>${n(i.created_at)}</td>
        <td>
          ${B.create("briefing",i.id)}
        </td>
      </tr>
    `).join("");t.innerHTML=r}showCreateForm(){window.setHeadline("Neues Briefing anlegen"),window.breadcrumbSystem&&window.breadcrumbSystem.updateBreadcrumb([{label:"Briefing",url:"/briefing",clickable:!0},{label:"Neues Briefing",url:"/briefing/new",clickable:!1}]);const e=window.formSystem.renderFormOnly("briefing");window.content.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Neues Briefing anlegen</h1>
          <p>Erstellen Sie ein neues Briefing</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/briefing')" class="secondary-btn">Zurück zur Übersicht</button>
        </div>
      </div>
      <div class="form-page">
        ${e}
      </div>
    `,window.formSystem.bindFormEvents("briefing",null);const t=document.getElementById("briefing-form");t&&(t.onsubmit=async n=>{n.preventDefault(),await this.handleCreateFormSubmit(t)})}async handleCreateFormSubmit(e){try{const t=new FormData(e),n={};for(const[r,i]of t.entries())!r.includes("[]")&&!r.includes("_files")&&(n[r]=i);console.log("📝 Briefing Submit-Daten:",n);const a=await window.dataService.createEntity("briefing",n);if(a.success)console.log("✅ Briefing erstellt, ID:",a.id),await this.uploadBriefingDocuments(a.id,e),alert("Briefing erfolgreich erstellt!"),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"briefing",action:"created",id:a.id}})),window.navigateTo(`/briefing/${a.id}`);else throw new Error(a.error||"Erstellen fehlgeschlagen")}catch(t){console.error("❌ Fehler beim Erstellen:",t),alert(`Fehler beim Erstellen des Briefings: ${t.message}`)}}async uploadBriefingDocuments(e,t){try{const n=t.querySelector('.uploader[data-name="documents_files"]');if(!n||!n.__uploaderInstance||!n.__uploaderInstance.files.length){console.log("ℹ️ Keine Dokumente zum Hochladen");return}if(!window.supabase){console.warn("⚠️ Supabase nicht verfügbar - Upload übersprungen");return}const a=Array.from(n.__uploaderInstance.files),r="documents",i=10*1024*1024,s=["application/pdf","image/jpeg","image/png","image/gif","image/webp"];for(const o of a){if(o.size>i){console.warn(`⚠️ Datei zu groß: ${o.name} (${(o.size/(1024*1024)).toFixed(2)} MB)`),alert(`Die Datei "${o.name}" ist zu groß (max. 10 MB)`);continue}if(!s.includes(o.type)){console.warn(`⚠️ Nicht erlaubter Dateityp: ${o.name} (${o.type})`),alert(`Die Datei "${o.name}" hat einen nicht erlaubten Dateityp`);continue}const l=o.name.replace(/[^a-zA-Z0-9._-]/g,"_").replace(/\.{2,}/g,"_").substring(0,200),u=Date.now(),d=Math.random().toString(36).substring(2,10),c=`briefings/${e}/${u}_${d}_${l}`;console.log(`📤 Uploading: ${o.name} -> ${c}`);const{error:m}=await window.supabase.storage.from(r).upload(c,o,{cacheControl:"3600",upsert:!1,contentType:o.type});if(m)throw console.error(`❌ Upload-Fehler für ${o.name}:`,m),m;const{data:h,error:p}=await window.supabase.storage.from(r).createSignedUrl(c,3600*24*7);if(p)throw console.error(`❌ Signierte URL Fehler für ${o.name}:`,p),p;const g=h?.signedUrl||"",{error:b}=await window.supabase.from("briefing_documents").insert({briefing_id:e,file_name:l,file_path:c,file_url:g,content_type:o.type,size:o.size,uploaded_by:window.currentUser?.id||null});if(b)throw console.error(`❌ DB-Fehler für ${o.name}:`,b),b;console.log(`✅ Dokument hochgeladen: ${o.name}`)}console.log(`✅ Alle ${a.length} Dokumente erfolgreich hochgeladen`)}catch(n){console.error("❌ Fehler beim Dokument-Upload:",n),alert("⚠️ Warnung: Einige Dokumente konnten nicht hochgeladen werden. Bitte versuchen Sie es später erneut.")}}destroy(){this._boundEventListeners.forEach(({element:e,type:t,handler:n})=>{e.removeEventListener(t,n)}),this._boundEventListeners.clear(),this.boundFilterResetHandler&&(document.removeEventListener("click",this.boundFilterResetHandler),this.boundFilterResetHandler=null)}}const Se=new Tt;class Bt{constructor(){this.briefingId=null,this.briefing=null,this.notizen=[],this.ratings=[]}async init(e){if(this.briefingId=e,window.moduleRegistry?.currentModule===this)try{await this.loadBriefingData(),window.breadcrumbSystem&&this.briefing&&window.breadcrumbSystem.updateBreadcrumb([{label:"Briefing",url:"/briefing",clickable:!0},{label:this.briefing.titel||"Details",url:`/briefing/${this.briefingId}`,clickable:!1}]),await this.render(),this.bindEvents()}catch(t){console.error("❌ BRIEFINGDETAIL: Fehler bei der Initialisierung:",t),window.ErrorHandler?.handle?.(t,"BriefingDetail.init")}}async loadBriefingData(){if(!(!this.briefingId||this.briefingId==="new"))try{const{data:e,error:t}=await window.supabase.from("briefings").select(`
          *,
          unternehmen:unternehmen_id(id, firmenname, webseite),
          marke:marke_id(id, markenname, webseite),
          kampagne:kampagne_id(id, kampagnenname),
          assignee:assignee_id(id, name)
        `).eq("id",this.briefingId).single();if(t)throw t;if(this.briefing=e,this.briefing?.kooperation_id)try{const{data:n}=await window.supabase.from("kooperationen").select(`
              id,
              name,
              status,
              kampagne:kampagne_id ( id, kampagnenname )
            `).eq("id",this.briefing.kooperation_id).single();n&&(this.briefing.kooperation=n)}catch(n){console.warn("⚠️ BRIEFINGDETAIL: Kooperation konnte nicht geladen werden",n),this.briefing.kooperation=null}if(window.notizenSystem&&(this.notizen=await window.notizenSystem.loadNotizen("briefing",this.briefingId)),window.bewertungsSystem&&(this.ratings=await window.bewertungsSystem.loadBewertungen("briefing",this.briefingId)),this.briefing?.id)try{const{data:n,error:a}=await window.supabase.from("briefing_documents").select("*").eq("briefing_id",this.briefing.id).order("created_at",{ascending:!1});a?(console.warn("⚠️ BRIEFINGDETAIL: Dokumente laden fehlgeschlagen:",a),this.briefing.documents=[]):(this.briefing.documents=n||[],console.log(`📄 ${n?.length||0} Dokumente geladen für Briefing ${this.briefing.id}`))}catch(n){console.warn("⚠️ BRIEFINGDETAIL: Dokumente konnten nicht geladen werden",n),this.briefing.documents=[]}}catch(e){throw console.error("❌ BRIEFINGDETAIL: Fehler beim Laden der Briefing-Daten:",e),e}}async render(){if(!this.briefing){this.showNotFound();return}const e=this.briefing.product_service_offer||"Briefing";window.setHeadline(`Briefing: ${window.validatorSystem?.sanitizeHtml?.(e)||e}`);const t=window.currentUser?.permissions?.briefing?.can_edit||!1,n=window.currentUser?.permissions?.briefing?.can_delete||!1,a=s=>s?new Date(s).toLocaleDateString("de-DE"):"-",r=s=>window.validatorSystem?.sanitizeHtml?.(s||"-")||s||"-",i=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>${r(e)}</h1>
          <p>Briefing-Details und verwandte Informationen</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/briefing')" class="secondary-btn">Zurück zur Übersicht</button>
          ${t?'<button id="btn-edit-briefing" class="primary-btn">Bearbeiten</button>':""}
        </div>
      </div>

      <div class="content-section">
        <div class="tab-navigation">
          <button class="tab-button active" data-tab="info">
            <i class="icon-information-circle"></i>
            Informationen
          </button>
          <button class="tab-button" data-tab="dokumente">
            Dokumente
            <span class="tab-count">${this.briefing.documents?.length||0}</span>
          </button>
          <button class="tab-button" data-tab="notizen">
            <i class="icon-document-text"></i>
            Notizen
            <span class="tab-count">${this.notizen.length}</span>
          </button>
          <button class="tab-button" data-tab="ratings">
           
            Bewertungen
            <span class="tab-count">${this.ratings.length}</span>
          </button>
        </div>

        <div class="tab-content">
          <div class="tab-pane active" id="tab-info">
            <div class="detail-section">
              <h2>Briefing Informationen</h2>
              <div class="detail-grid">
                <div class="detail-card">
                  <h3>Allgemein</h3>
                  <div class="detail-grid-2">
                    <div class="detail-item">
                      <label>Produkt/Angebot:</label>
                      <span>${r(this.briefing.product_service_offer)}</span>
                    </div>
                    <div class="detail-item">
                      <label>Status:</label>
                      <span class="status-badge status-${(this.briefing.status||"unknown").toLowerCase()}">${r(this.briefing.status)}</span>
                    </div>
                    <div class="detail-item">
                      <label>Deadline:</label>
                      <span>${a(this.briefing.deadline)}</span>
                    </div>
                    <div class="detail-item">
                      <label>Zugewiesen:</label>
                      <span>${r(this.briefing.assignee?.name)}</span>
                    </div>
                    <div class="detail-item">
                      <label>Produktseite:</label>
                      <span>${this.briefing.produktseite_url?`<a href="${this.briefing.produktseite_url}" target="_blank">Link</a>`:"-"}</span>
                    </div>
                    <div class="detail-item">
                      <label>Erstellt:</label>
                      <span>${a(this.briefing.created_at)}</span>
                    </div>
                    <div class="detail-item">
                      <label>Aktualisiert:</label>
                      <span>${a(this.briefing.updated_at)}</span>
                    </div>
                  </div>
                </div>

                <div class="detail-card">
                  <h3>Unternehmen & Marke</h3>
                  <div class="detail-item">
                    <label>Unternehmen:</label>
                    <span>${r(this.briefing.unternehmen?.firmenname)}</span>
                  </div>
                  <div class="detail-item">
                    <label>Marke:</label>
                    <span>${r(this.briefing.marke?.markenname)}</span>
                  </div>
                  <div class="detail-item">
                    <label>Kampagne:</label>
                    <span>${this.briefing.kampagne?.id?`<a href="/kampagne/${this.briefing.kampagne.id}" onclick="event.preventDefault(); window.navigateTo('/kampagne/${this.briefing.kampagne.id}')">${r(this.briefing.kampagne.kampagnenname||"Kampagne")}</a>`:"-"}</span>
                  </div>
                  <div class="detail-item">
                    <label>Kooperation:</label>
                    <span>${this.briefing.kooperation?.id?`<a href="/kooperation/${this.briefing.kooperation.id}" onclick="event.preventDefault(); window.navigateTo('/kooperation/${this.briefing.kooperation.id}')">${r(this.briefing.kooperation.name||"Kooperation")}</a>`:"-"}</span>
                  </div>
                </div>

                <div class="detail-card">
                  <h3>Briefing-Inhalte</h3>
                  <div class="detail-item">
                    <label>Creator Aufgabe:</label>
                    <span>${r(this.briefing.creator_aufgabe)}</span>
                  </div>
                  <div class="detail-item">
                    <label>USPs:</label>
                    <span>${r(this.briefing.usp)}</span>
                  </div>
                  <div class="detail-item">
                    <label>Zielgruppe:</label>
                    <span>${r(this.briefing.zielgruppe)}</span>
                  </div>
                  <div class="detail-item">
                    <label>Zieldetails:</label>
                    <span>${r(this.briefing.zieldetails)}</span>
                  </div>
                </div>

                <div class="detail-card">
                  <h3>Guidelines</h3>
                  <div class="detail-item">
                    <label>Do's:</label>
                    <span>${r(this.briefing.dos)}</span>
                  </div>
                  <div class="detail-item">
                    <label>Don'ts:</label>
                    <span>${r(this.briefing.donts)}</span>
                  </div>
                  <div class="detail-item">
                    <label>Rechtlicher Hinweis:</label>
                    <span>${r(this.briefing.rechtlicher_hinweis)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="tab-pane" id="tab-dokumente">
            <div class="detail-section">
              <h2>Dokumente</h2>
              ${this.renderDocumentsTable()}
            </div>
          </div>

          <div class="tab-pane" id="tab-notizen">
            <div class="detail-section">
              <h2>Notizen</h2>
              ${this.renderNotizen()}
            </div>
          </div>

          <div class="tab-pane" id="tab-ratings">
            <div class="detail-section">
              <h2>Bewertungen</h2>
              ${this.renderRatings()}
            </div>
          </div>
        </div>
      </div>

      <div class="detail-actions">
        ${t?'<button id="btn-edit-briefing-bottom" class="primary-btn">Briefing bearbeiten</button>':""}
        ${n?'<button id="btn-delete-briefing" class="danger-btn">Briefing löschen</button>':""}
      </div>
    `;window.setContentSafely(window.content,i)}renderNotizen(){return window.notizenSystem?window.notizenSystem.renderNotizenContainer(this.notizen,"briefing",this.briefingId):!this.notizen||this.notizen.length===0?`
        <div class="empty-state">
          <p>Keine Notizen vorhanden</p>
        </div>
      `:`<div class="notizen-container">${this.notizen.map(t=>`
      <div class="notiz-card">
        <div class="notiz-header">
          <span>${t.user_name||"Unbekannt"}</span>
          <span>${new Date(t.created_at).toLocaleDateString("de-DE")}</span>
        </div>
        <div class="notiz-content">
          <p>${window.validatorSystem?.sanitizeHtml?.(t.text)||t.text}</p>
        </div>
      </div>
    `).join("")}</div>`}renderRatings(){return window.bewertungsSystem?window.bewertungsSystem.renderBewertungenContainer(this.ratings,"briefing",this.briefingId):!this.ratings||this.ratings.length===0?`
        <div class="empty-state">
          <p>Keine Bewertungen vorhanden</p>
        </div>
      `:`<div class="ratings-container">${this.ratings.map(t=>`
      <div class="rating-card">
        <div class="rating-header">
          <span>${t.user_name||"Unbekannt"}</span>
          <span>${new Date(t.created_at).toLocaleDateString("de-DE")}</span>
        </div>
        <div class="rating-stars">
          ${Array.from({length:5},(n,a)=>`
            <span class="star ${a<t.rating?"filled":""}">★</span>
          `).join("")}
        </div>
      </div>
    `).join("")}</div>`}bindEvents(){document.addEventListener("click",e=>{e.target.classList.contains("tab-button")&&(e.preventDefault(),this.switchTab(e.target.dataset.tab))}),document.addEventListener("click",e=>{(e.target.id==="btn-edit-briefing"||e.target.id==="btn-edit-briefing-bottom")&&(e.preventDefault(),window.navigateTo(`/briefing/${this.briefingId}/edit`))}),document.addEventListener("click",async e=>{const t=e.target.closest(".action-doc-open");if(t){e.preventDefault();const n=t.dataset.docPath;if(!n){alert("Fehler: Dokumentpfad nicht gefunden");return}try{console.log("📄 Öffne Dokument:",n);const{data:a,error:r}=await window.supabase.storage.from("documents").createSignedUrl(n,3600*24*7);if(r)throw r;if(a?.signedUrl)console.log("✅ Signierte URL generiert, öffne neues Fenster"),window.open(a.signedUrl,"_blank","noopener,noreferrer");else throw new Error("Signierte URL konnte nicht generiert werden")}catch(a){console.error("❌ Fehler beim Öffnen:",a),alert(`Fehler beim Öffnen des Dokuments: ${a.message}`)}}}),document.addEventListener("click",async e=>{if(e.target.closest(".action-doc-delete")){e.preventDefault();const t=e.target.closest(".action-doc-delete"),n=t.dataset.docId,a=t.dataset.docName,r=t.dataset.docPath;if(!confirm(`Dokument "${a}" wirklich löschen?`))return;try{const{error:i}=await window.supabase.storage.from("documents").remove([r]);if(i)throw i;const{error:s}=await window.supabase.from("briefing_documents").delete().eq("id",n);if(s)throw s;alert("Dokument erfolgreich gelöscht"),await this.loadBriefingData(),await this.render(),this.bindEvents(),this.switchTab("dokumente")}catch(i){console.error("❌ Fehler beim Löschen:",i),alert(`Fehler beim Löschen: ${i.message}`)}}}),document.addEventListener("click",async e=>{if(e.target.id==="btn-delete-briefing"){if(e.preventDefault(),!confirm("Dieses Briefing wirklich löschen?"))return;try{const{error:n}=await window.supabase.from("briefings").delete().eq("id",this.briefingId);if(n)throw n;window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"briefing",action:"deleted",id:this.briefingId}})),window.navigateTo("/briefing")}catch(n){console.error("❌ Fehler beim Löschen des Briefings:",n),alert("Löschen fehlgeschlagen.")}}}),window.addEventListener("notizenUpdated",async e=>{if(e.detail.entityType==="briefing"&&e.detail.entityId===this.briefingId){this.notizen=await window.notizenSystem.loadNotizen("briefing",this.briefingId);const t=document.querySelector("#tab-notizen .detail-section");t&&(t.innerHTML=`<h2>Notizen</h2>${this.renderNotizen()}`)}}),window.addEventListener("bewertungenUpdated",async e=>{if(e.detail.entityType==="briefing"&&e.detail.entityId===this.briefingId){this.ratings=await window.bewertungsSystem.loadBewertungen("briefing",this.briefingId);const t=document.querySelector("#tab-ratings .detail-section");t&&(t.innerHTML=`<h2>Bewertungen</h2>${this.renderRatings()}`)}})}switchTab(e){document.querySelectorAll(".tab-button").forEach(a=>a.classList.remove("active")),document.querySelectorAll(".tab-pane").forEach(a=>a.classList.remove("active"));const t=document.querySelector(`[data-tab="${e}"]`),n=document.getElementById(`tab-${e}`);t&&n&&(t.classList.add("active"),n.classList.add("active"))}renderDocumentActions(e){const t=window.currentUser?.permissions?.briefing?.can_delete||!1;return`
      <div class="actions-dropdown-container" data-entity-type="briefing_documents">
        <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
        <div class="actions-dropdown">
          <a href="#" class="action-item action-doc-open" data-doc-path="${e.file_path}">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            Öffnen
          </a>
          ${t?`
            <div class="action-separator"></div>
            <a href="#" class="action-item action-danger action-doc-delete" data-doc-id="${e.id}" data-doc-name="${e.file_name}" data-doc-path="${e.file_path}">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
              Löschen
            </a>
          `:""}
        </div>
      </div>
    `}renderDocumentsTable(){if(!this.briefing.documents||this.briefing.documents.length===0)return`
        <div class="empty-state">
          <p>Keine Dokumente vorhanden</p>
        </div>
      `;const e=r=>{if(!r)return"-";const i=r/(1024*1024);return i<1?`${(r/1024).toFixed(1)} KB`:`${i.toFixed(1)} MB`},t=r=>r?new Date(r).toLocaleDateString("de-DE",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}):"-",n=r=>window.validatorSystem?.sanitizeHtml?.(r||"")||r||"",a=r=>r?.includes("pdf")?"📄":r?.includes("image")?"🖼️":r?.includes("word")||r?.includes("document")?"📝":"📎";return`
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 50px;">Typ</th>
              <th>Dateiname</th>
              <th style="width: 120px;">Größe</th>
              <th style="width: 180px;">Hochgeladen am</th>
              <th style="width: 100px;">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            ${this.briefing.documents.map(r=>`
              <tr>
                <td style="text-align: center; font-size: 1.5rem;">
                  ${a(r.content_type)}
                </td>
                <td>
                  <strong>${n(r.file_name)}</strong>
                </td>
                <td>${e(r.size)}</td>
                <td>${t(r.created_at)}</td>
                <td>
                  ${this.renderDocumentActions(r)}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `}showNotFound(){window.setHeadline("Briefing nicht gefunden"),window.content.innerHTML=`
      <div class="error-message">
        <h2>Briefing nicht gefunden</h2>
        <p>Das angeforderte Briefing konnte nicht gefunden werden.</p>
        <button onclick="window.navigateTo('/briefing')" class="primary-btn">Zurück zur Übersicht</button>
      </div>
    `}showEditForm(){console.log("🎯 BRIEFINGDETAIL: Zeige Bearbeitungsformular"),window.setHeadline("Briefing bearbeiten");const e=window.formSystem.renderFormOnly("briefing",this.briefing);window.content.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Briefing bearbeiten</h1>
          <p>Bearbeiten Sie die Briefing-Informationen</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/briefing/${this.briefingId}')" class="secondary-btn">Zurück zu Details</button>
        </div>
      </div>
      
      <div class="form-page">
        ${e}
      </div>
    `,window.formSystem.bindFormEvents("briefing",this.briefing);const t=document.getElementById("briefing-form");t&&(t.onsubmit=async n=>{n.preventDefault(),await this.handleEditFormSubmit()})}async handleEditFormSubmit(){try{const e=document.getElementById("briefing-form"),t=new FormData(e),n={};for(const[r,i]of t.entries())if(r.includes("[]")){const s=r.replace("[]","");n[s]||(n[s]=[]),n[s].push(i)}else n[r]=i;console.log("📝 Briefing Edit Submit-Daten:",n);const a=await window.dataService.updateEntity("briefing",this.briefingId,n);a.success?(this.showSuccessMessage("Briefing erfolgreich aktualisiert!"),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"briefing",action:"updated",id:this.briefingId}})),setTimeout(()=>{window.navigateTo(`/briefing/${this.briefingId}`)},1500)):this.showErrorMessage(`Fehler beim Aktualisieren: ${a.error}`)}catch(e){console.error("❌ Fehler beim Aktualisieren des Briefings:",e),this.showErrorMessage("Ein unerwarteter Fehler ist aufgetreten.")}}showSuccessMessage(e){const t=document.createElement("div");t.className="alert alert-success",t.textContent=e;const n=document.getElementById("briefing-form");n&&(n.parentNode.insertBefore(t,n),setTimeout(()=>{t.remove()},5e3))}showErrorMessage(e){const t=document.createElement("div");t.className="alert alert-danger",t.textContent=e;const n=document.getElementById("briefing-form");n&&(n.parentNode.insertBefore(t,n),setTimeout(()=>{t.remove()},5e3))}destroy(){window.setContentSafely("")}}const Ae=new Bt;class Ct{constructor(){this.formData={}}async init(){console.log("🎯 ANSPRECHPARTNERCREATE: Initialisiere Ansprechpartner-Erstellung"),this.showCreateForm()}showCreateForm(){console.log("🎯 ANSPRECHPARTNERCREATE: Zeige Ansprechpartner-Erstellungsformular mit FormSystem"),console.log("🚨 ANSPRECHPARTNERCREATE: WIRD VERWENDET!"),window.setHeadline("Neuen Ansprechpartner anlegen"),window.breadcrumbSystem&&window.breadcrumbSystem.updateBreadcrumb([{label:"Ansprechpartner",url:"/ansprechpartner",clickable:!0},{label:"Neuer Ansprechpartner",url:"/ansprechpartner/new",clickable:!1}]);const e=window.formSystem.renderFormOnly("ansprechpartner");window.content.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Neuen Ansprechpartner anlegen</h1>
          <p>Erstellen Sie einen neuen Ansprechpartner für das CRM</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/ansprechpartner')" class="secondary-btn">Zurück zur Übersicht</button>
        </div>
      </div>
      
      <div class="form-page">
        ${e}
      </div>
    `,window.formSystem.bindFormEvents("ansprechpartner",null),console.log("✅ ANSPRECHPARTNERCREATE: Verwende FormSystem Submit Handler (kein Custom Handler mehr)")}async handleFormSubmit(){try{const e=document.querySelector('#ansprechpartner-form button[type="submit"]');e&&(e.innerHTML="Erstelle...",e.disabled=!0);const t=document.getElementById("ansprechpartner-form"),n=new FormData(t),a={},r={},i=t.querySelectorAll('select[data-tag-based="true"]');console.log("🏷️ Tag-basierte Selects gefunden:",i.length),i.forEach(d=>{console.log(`🔍 Verarbeite Tag-basiertes Select: ${d.name}`);const c=t.querySelectorAll(`select[name^="${d.name}"]`);console.log(`🔍 Alle Selects für ${d.name}:`,c.length,Array.from(c).map(h=>({name:h.name,hidden:h.style.display==="none",options:h.options.length})));let m=t.querySelector(`select[name="${d.name}[]"][style*="display: none"]`);if(console.log("🔍 Verstecktes Select mit [] gefunden:",!!m),m||(m=t.querySelector(`select[name="${d.name}"][style*="display: none"]`),console.log("🔍 Verstecktes Select ohne [] gefunden:",!!m)),m||c.length>1&&(m=c[1],console.log("🔍 Fallback: Zweites Select verwendet:",!!m)),m){console.log(`🔍 Verstecktes Select Details für ${d.name}:`,{name:m.name,optionsCount:m.options.length,selectedCount:m.selectedOptions.length,allOptions:Array.from(m.options).map(b=>({value:b.value,selected:b.selected}))});const h=Array.from(m.options).map(b=>b.value).filter(b=>b!==""&&b!=null),p=Array.from(m.selectedOptions).map(b=>b.value).filter(b=>b!==""&&b!=null),g=p.length>0?p:h;console.log(`🔍 Werte-Analyse für ${d.name}:`,{allValues:h,selectedValues:p,finalValues:g,using:p.length>0?"selectedOptions":"allOptions"}),g.length>0?(r[d.name]=g,console.log(`🏷️ Tag-basiertes Multi-Select ${d.name}:`,g)):console.log(`⚠️ Keine Werte für ${d.name} gefunden`)}else console.log(`⚠️ Verstecktes Select für ${d.name} nicht gefunden`)});const s=t.querySelector('select[name="marke_ids[]"]');if(s&&s.multiple){const d=Array.from(s.selectedOptions);if(d.length>0){const c=d.map(m=>m.value).filter(m=>m!=="");c.length>0&&(r.marke_ids=c,console.log("🏷️ ANSPRECHPARTNERCREATE: Verstecktes Marken-Select manuell verarbeitet:",c))}}const o=t.querySelector('select[name="sprachen_ids[]"]');if(o&&o.multiple){const d=Array.from(o.selectedOptions);if(d.length>0){const c=d.map(m=>m.value).filter(m=>m!=="");c.length>0&&(r.sprachen_ids=c,console.log("🏷️ ANSPRECHPARTNERCREATE: Verstecktes Sprachen-Select manuell verarbeitet:",c))}}for(let[d,c]of n.entries())if(!r.hasOwnProperty(d))if(d.includes("[]")){const m=d.replace("[]","");r[m]||(r[m]=[]),r[m].push(c)}else r[d]?(Array.isArray(r[d])||(r[d]=[r[d]]),r[d].push(c)):r[d]=c;for(let[d,c]of Object.entries(r))Array.isArray(c)&&(r[d]=[...new Set(c)]);for(let[d,c]of Object.entries(r))a[d]=Array.isArray(c)?c:c.trim();console.log("📤 Finale Ansprechpartner-Daten:",a);const l=window.validatorSystem.validateForm(a,{vorname:{type:"text",minLength:2,required:!0},nachname:{type:"text",minLength:2,required:!0}});if(!l.isValid){this.showValidationErrors(l.errors);return}const u=await window.dataService.createEntity("ansprechpartner",a);if(u.success)this.showSuccessMessage("Ansprechpartner erfolgreich erstellt!"),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"ansprechpartner",id:u.data.id,action:"created"}}));else throw new Error(u.error||"Fehler beim Erstellen des Ansprechpartners")}catch(e){console.error("❌ Fehler beim Erstellen des Ansprechpartners:",e),this.showErrorMessage(e.message||"Ein unerwarteter Fehler ist aufgetreten")}finally{const e=document.querySelector('#ansprechpartner-form button[type="submit"]');e&&(e.innerHTML="Ansprechpartner anlegen",e.disabled=!1)}}showValidationErrors(e){document.querySelectorAll(".field-error").forEach(t=>t.remove());for(const[t,n]of Object.entries(e)){const a=document.querySelector(`[name="${t}"]`);if(a){const r=document.createElement("div");r.className="field-error",r.textContent=n,r.style.color="red",r.style.fontSize="12px",r.style.marginTop="4px",a.parentNode.appendChild(r)}}}showSuccessMessage(e){const t=document.createElement("div");t.className="toast success",t.textContent=e,t.style.cssText=`
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `,document.body.appendChild(t),setTimeout(()=>t.style.opacity="1",100),setTimeout(()=>{t.style.opacity="0",setTimeout(()=>t.remove(),300)},3e3)}showErrorMessage(e){const t=document.createElement("div");t.className="toast error",t.textContent=e,t.style.cssText=`
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ef4444;
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `,document.body.appendChild(t),setTimeout(()=>t.style.opacity="1",100),setTimeout(()=>{t.style.opacity="0",setTimeout(()=>t.remove(),300)},3e3)}destroy(){console.log("🎯 ANSPRECHPARTNERCREATE: Destroy")}renderKampagnen(){return!this.ansprechpartner.ansprechpartner_kampagne||this.ansprechpartner.ansprechpartner_kampagne.length===0?`
        <div class="empty-state">
          <div class="empty-icon">📢</div>
          <h3>Keine Kampagnen zugeordnet</h3>
          <p>Diesem Ansprechpartner sind noch keine Kampagnen zugeordnet.</p>
        </div>
      `:`
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Kampagne</th>
              <th>Unternehmen</th>
              <th>Start</th>
              <th>Deadline</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${this.ansprechpartner.ansprechpartner_kampagne.map(t=>{const n=t.kampagne;return`
        <tr>
          <td>
            <a href="#" class="table-link" data-table="kampagne" data-id="${n.id}">
              ${n.kampagnenname||"Unbekannte Kampagne"}
            </a>
          </td>
          <td>${n.unternehmen?.firmenname?`<a href="#" class="table-link" data-table="unternehmen" data-id="${n.unternehmen.id}">${n.unternehmen.firmenname}</a>`:"-"}</td>
          <td>${n.start?new Date(n.start).toLocaleDateString("de-DE"):"-"}</td>
          <td>${n.deadline?new Date(n.deadline).toLocaleDateString("de-DE"):"-"}</td>
          <td>${n.status||"-"}</td>
        </tr>
      `}).join("")}</tbody>
        </table>
      </div>
    `}}const G=new Ct;class Nt{constructor(){this.selectedAnsprechpartner=new Set,this._boundEventListeners=new Set}async init(){window.setHeadline("Ansprechpartner Übersicht"),console.log("🎯 ANSPRECHPARTNERLIST: Initialisiere Ansprechpartner-Liste"),window.breadcrumbSystem&&window.breadcrumbSystem.updateBreadcrumb([{label:"Ansprechpartner",url:"/ansprechpartner",clickable:!1}]),this.bindEvents(),await this.loadAndRender()}async render(e){const t=document.getElementById("dashboard-content");if(!t){console.error("❌ ANSPRECHPARTNERLIST: Dashboard-Content nicht gefunden");return}t.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Ansprechpartner</h1>
          <p>Verwalte alle Ansprechpartner von Unternehmen und Marken</p>
        </div>
        <div class="page-header-right">
          <button id="btn-ansprechpartner-new" class="primary-btn">Neuen Ansprechpartner anlegen</button>
        </div>
      </div>

      <div class="table-filter-wrapper">
        <div class="filter-bar">
          <div class="filter-left">
            <div id="filter-container"></div>
          </div>
          <div class="filter-right">
            <button id="btn-filter-reset" class="secondary-btn" style="display:${this.hasActiveFilters()?"inline-block":"none"};">Alle Filter zurücksetzen</button>
          </div>
        </div>
        <div class="table-actions">
          <button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
          <span id="selected-count" style="display:none;">0 ausgewählt</span>
          <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table" id="ansprechpartner-table">
          <thead>
            <tr>
              <th><input type="checkbox" id="select-all-ansprechpartner"></th>
              <th>Name</th>
              <th>Position</th>
              <th>Unternehmen</th>
              <th>Marken</th>
              <th>Email</th>
              <th>Telefon Mobil</th>
              <th>Telefon Büro</th>
              <th>Stadt</th>
              <th>Sprache</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <!-- Wird dynamisch gefüllt -->
          </tbody>
        </table>
      </div>
    `,await this.initializeFilterBar()}async initializeFilterBar(){const e=document.getElementById("filter-container");e&&await A.renderFilterBar("ansprechpartner",e,t=>this.onFiltersApplied(t),()=>this.onFiltersReset())}onFiltersApplied(e){console.log("Filter angewendet:",e),A.applyFilters("ansprechpartner",e),this.loadAndRender()}onFiltersReset(){console.log("Filter zurückgesetzt"),A.resetFilters("ansprechpartner"),this.loadAndRender()}bindEvents(){this.boundFilterResetHandler=e=>{e.target.id==="btn-filter-reset"&&this.onFiltersReset()},document.addEventListener("click",this.boundFilterResetHandler),document.addEventListener("click",e=>{e.target.id==="btn-ansprechpartner-new"&&(e.preventDefault(),window.navigateTo("/ansprechpartner/new"))}),document.addEventListener("click",e=>{if(e.target.classList.contains("table-link")&&e.target.dataset.table==="ansprechpartner"){e.preventDefault();const t=e.target.dataset.id;console.log("🎯 ANSPRECHPARTNERLIST: Navigiere zu Ansprechpartner Details:",t),window.navigateTo(`/ansprechpartner/${t}`)}}),document.addEventListener("click",e=>{if(e.target.id==="btn-select-all"){e.preventDefault(),document.querySelectorAll(".ansprechpartner-check").forEach(a=>{a.checked=!0,a.dataset.id&&this.selectedAnsprechpartner.add(a.dataset.id)});const n=document.getElementById("select-all-ansprechpartner");n&&(n.indeterminate=!1,n.checked=!0),this.updateSelection()}}),document.addEventListener("click",e=>{e.target.id==="btn-deselect-all"&&(e.preventDefault(),this.deselectAll())}),window.addEventListener("entityUpdated",e=>{e.detail.entity==="ansprechpartner"&&this.loadAndRender()}),document.addEventListener("change",e=>{if(e.target.id==="select-all-ansprechpartner"){const t=document.querySelectorAll(".ansprechpartner-check"),n=e.target.checked;t.forEach(a=>{a.checked=n,n?this.selectedAnsprechpartner.add(a.dataset.id):this.selectedAnsprechpartner.delete(a.dataset.id)}),this.updateSelection(),console.log(`${n?"✅ Alle Ansprechpartner ausgewählt":"❌ Alle Ansprechpartner abgewählt"}: ${this.selectedAnsprechpartner.size}`)}}),document.addEventListener("change",e=>{if(e.target.classList.contains("ansprechpartner-check")){const t=e.target.dataset.id;console.log(`🔧 AnsprechpartnerList: Checkbox ${t} ${e.target.checked?"ausgewählt":"abgewählt"}`),e.target.checked?this.selectedAnsprechpartner.add(t):this.selectedAnsprechpartner.delete(t),console.log("🔧 AnsprechpartnerList: Aktuelle Auswahl:",Array.from(this.selectedAnsprechpartner)),this.updateSelection(),this.updateSelectAllCheckbox()}}),window.bulkActionSystem&&window.bulkActionSystem.registerList("ansprechpartner",this)}hasActiveFilters(){const e=A.getFilters("ansprechpartner");return Object.keys(e).length>0}updateSelection(){const e=this.selectedAnsprechpartner.size,t=document.getElementById("selected-count"),n=document.getElementById("btn-deselect-all"),a=document.getElementById("btn-delete-selected");t&&(t.textContent=`${e} ausgewählt`,t.style.display=e>0?"inline":"none"),n&&(n.style.display=e>0?"inline-block":"none"),a&&(a.style.display=e>0?"inline-block":"none")}updateTable(e){const t=document.querySelector(".data-table tbody");if(!t)return;if(!e||e.length===0){t.innerHTML=`
        <tr>
          <td colspan="10" class="no-data">Keine Ansprechpartner gefunden</td>
        </tr>
      `;return}const n=e.map(a=>`
      <tr data-id="${a.id}">
        <td><input type="checkbox" class="ansprechpartner-check" data-id="${a.id}"></td>
        <td>
          <a href="#" class="table-link" data-table="ansprechpartner" data-id="${a.id}">
            ${window.validatorSystem.sanitizeHtml(`${a.vorname} ${a.nachname}`)}
          </a>
        </td>
        <td>${a.position?.name||"-"}</td>
        <td>
          ${this.renderUnternehmen(a)}
        </td>
        <td>
          ${a.marken&&a.marken.length>0?z.renderBubbles(a.marken.map(r=>({name:r.markenname,type:"org",id:r.id,entityType:"marke"}))):"-"}
        </td>
        <td>${a.email?`<a href="mailto:${a.email}">${a.email}</a>`:"-"}</td>
        <td>${R.render(a.telefonnummer_land?.iso_code,a.telefonnummer_land?.vorwahl,a.telefonnummer)}</td>
        <td>${R.render(a.telefonnummer_office_land?.iso_code,a.telefonnummer_office_land?.vorwahl,a.telefonnummer_office)}</td>
        <td>${a.stadt||"-"}</td>
        <td>
          ${a.sprachen&&a.sprachen.length>0?`<div class="tag-list">${a.sprachen.map(r=>`<span class="tag tag--sprache">${window.validatorSystem.sanitizeHtml(r.name)}</span>`).join("")}</div>`:a.sprache?.name?`<span class="tag tag--sprache">${window.validatorSystem.sanitizeHtml(a.sprache.name)}</span>`:"-"}
        </td>
        <td>
          ${B.create("ansprechpartner",a.id)}
        </td>
      </tr>
    `).join("");t.innerHTML=n}renderUnternehmen(e){if(Array.isArray(e.unternehmen)&&e.unternehmen.length>0){const t=e.unternehmen.map(n=>({name:n.firmenname,type:"org",id:n.id,entityType:"unternehmen"}));return z.renderBubbles(t)}if(e.unternehmen&&e.unternehmen.firmenname){const t=[{name:e.unternehmen.firmenname,type:"org",id:e.unternehmen.id,entityType:"unternehmen"}];return z.renderBubbles(t)}return"-"}async loadAndRender(){try{console.log("🔄 ANSPRECHPARTNERLIST: Lade Ansprechpartner..."),await this.render();const e=A.getFilters("ansprechpartner");console.log("🔍 Lade Ansprechpartner mit Filter:",e);const t=await window.dataService.loadEntities("ansprechpartner",e);console.log("📊 Ansprechpartner geladen:",t?.length||0),this.updateTable(t)}catch(e){console.error("❌ ANSPRECHPARTNERLIST: Fehler beim Laden:",e);const t=document.querySelector(".data-table tbody");t&&(t.innerHTML=`
          <tr>
            <td colspan="10" class="error">Fehler beim Laden der Ansprechpartner</td>
          </tr>
        `)}}updateSelectAllCheckbox(){const e=document.getElementById("select-all-ansprechpartner"),t=document.querySelectorAll(".ansprechpartner-check");if(!e||t.length===0)return;const n=document.querySelectorAll(".ansprechpartner-check:checked"),a=n.length===t.length,r=n.length>0;e.checked=a,e.indeterminate=r&&!a}deselectAll(){this.selectedAnsprechpartner.clear(),document.querySelectorAll(".ansprechpartner-check").forEach(n=>{n.checked=!1});const t=document.getElementById("select-all-ansprechpartner");t&&(t.checked=!1,t.indeterminate=!1),this.updateSelection(),console.log("✅ Alle Ansprechpartner-Auswahlen aufgehoben")}async showDeleteSelectedConfirmation(){const e=this.selectedAnsprechpartner.size;if(e===0){alert("Keine Ansprechpartner ausgewählt.");return}const t=e===1?"Möchten Sie den ausgewählten Ansprechpartner wirklich löschen?":`Möchten Sie die ${e} ausgewählten Ansprechpartner wirklich löschen?`;(await window.confirmationModal.open({title:"Löschvorgang bestätigen",message:t,confirmText:"Endgültig löschen",cancelText:"Abbrechen",danger:!0}))?.confirmed&&this.deleteSelectedAnsprechpartner()}async deleteSelectedAnsprechpartner(){const e=Array.from(this.selectedAnsprechpartner),t=e.length;console.log(`🗑️ Lösche ${t} Ansprechpartner...`),e.forEach(n=>{const a=document.querySelector(`tr[data-id="${n}"]`);a&&(a.style.opacity="0.5")});try{const n=await window.dataService.deleteEntities("ansprechpartner",e);if(n.success){e.forEach(r=>{document.querySelector(`tr[data-id="${r}"]`)?.remove()}),alert(`✅ ${n.deletedCount} Ansprechpartner erfolgreich gelöscht.`),this.deselectAll();const a=document.querySelector("#ansprechpartner-table-body, .data-table tbody");a&&a.children.length===0&&await this.loadAndRender(),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"ansprechpartner",action:"bulk-deleted",count:n.deletedCount}}))}else throw new Error(n.error||"Löschen fehlgeschlagen")}catch(n){e.forEach(a=>{const r=document.querySelector(`tr[data-id="${a}"]`);r&&(r.style.opacity="1")}),console.error("❌ Fehler beim Löschen:",n),alert(`❌ Fehler beim Löschen: ${n.message}`),await this.loadAndRender()}}showCreateForm(){console.log("🎯 Zeige Ansprechpartner-Erstellungsformular mit AnsprechpartnerCreate"),G.showCreateForm()}destroy(){console.log("AnsprechpartnerList: Cleaning up..."),this.boundFilterResetHandler&&document.removeEventListener("click",this.boundFilterResetHandler)}}const $e=new Nt;class xt{constructor(){this.ansprechpartner=null,this.ansprechpartnerId=null,this.formConfig=null,this.formRenderer=null,this.dataLoader=null,this.formSystem=null,this.notizen=[],this.ratings=[]}async init(e){if(this.ansprechpartnerId=e,console.log("🎯 ANSPRECHPARTNERDETAIL: Initialisiere Detail-Seite für:",e),e==="new"){console.log("🎯 ANSPRECHPARTNERDETAIL: Verwende AnsprechpartnerCreate für neuen Ansprechpartner"),G.showCreateForm();return}else{if(await this.loadAnsprechpartnerData(),window.breadcrumbSystem&&this.ansprechpartner){const t=[this.ansprechpartner.vorname,this.ansprechpartner.nachname].filter(Boolean).join(" ")||"Details";window.breadcrumbSystem.updateBreadcrumb([{label:"Ansprechpartner",url:"/ansprechpartner",clickable:!0},{label:t,url:`/ansprechpartner/${this.ansprechpartnerId}`,clickable:!1}])}this.render(),this.bindEvents()}}async loadAnsprechpartnerData(){try{console.log("🔄 ANSPRECHPARTNERDETAIL: Lade Ansprechpartner-Daten...");const{data:e,error:t}=await window.supabase.from("ansprechpartner").select(`
          *,
          unternehmen:unternehmen_id (
            id,
            firmenname
          ),
          ansprechpartner_marke (
            marke:marke_id (
              id,
              markenname
            )
          ),
          ansprechpartner_kampagne (
            kampagne:kampagne_id (
              id,
              kampagnenname
            )
          ),
          telefonnummer_land:eu_laender!telefonnummer_land_id (
            id,
            name,
            name_de,
            iso_code,
            vorwahl
          ),
          telefonnummer_office_land:eu_laender!telefonnummer_office_land_id (
            id,
            name,
            name_de,
            iso_code,
            vorwahl
          )
        `).eq("id",this.ansprechpartnerId).single();if(t){console.error("❌ ANSPRECHPARTNERDETAIL: Fehler beim Laden:",t),this.showError("Ansprechpartner konnte nicht geladen werden.");return}this.ansprechpartner=e,console.log("✅ ANSPRECHPARTNERDETAIL: Ansprechpartner geladen:",this.ansprechpartner),window.notizenSystem&&(this.notizen=await window.notizenSystem.loadNotizen("ansprechpartner",this.ansprechpartnerId),console.log("✅ ANSPRECHPARTNERDETAIL: Notizen geladen:",this.notizen.length)),window.bewertungsSystem&&(this.ratings=await window.bewertungsSystem.loadBewertungen("ansprechpartner",this.ansprechpartnerId),console.log("✅ ANSPRECHPARTNERDETAIL: Ratings geladen:",this.ratings.length))}catch(e){console.error("❌ ANSPRECHPARTNERDETAIL: Unerwarteter Fehler:",e),this.showError("Ein unerwarteter Fehler ist aufgetreten.")}}render(){if(!this.ansprechpartner){this.showError("Ansprechpartner nicht gefunden.");return}window.setHeadline(`${this.ansprechpartner.vorname} ${this.ansprechpartner.nachname} - Details`);const e=document.getElementById("dashboard-content");e&&(e.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>${this.ansprechpartner.vorname} ${this.ansprechpartner.nachname} - Details</h1>
          <p>Detaillierte Informationen zum Ansprechpartner</p>
        </div>
        <div class="page-header-right">
          <button class="secondary-btn" id="btn-edit">
            <i class="icon-edit"></i>
            Ansprechpartner bearbeiten
          </button>
          <button class="secondary-btn" id="btn-back">
            Zurück zur Übersicht
          </button>
        </div>
      </div>

      <div class="content-section">
        <!-- Tab-Navigation -->
        <div class="tab-navigation">
          <button class="tab-button active" data-tab="informationen">
            Informationen
            <span class="tab-count">1</span>
          </button>
          <button class="tab-button" data-tab="notizen">
            Notizen
            <span class="tab-count">${this.notizen?this.notizen.length:0}</span>
          </button>
          <button class="tab-button" data-tab="bewertungen">
            Bewertungen
            <span class="tab-count">${this.ratings?this.ratings.length:0}</span>
          </button>
          <button class="tab-button" data-tab="marken">
            Zugeordnete Marken
            <span class="tab-count">${this.ansprechpartner.ansprechpartner_marke?this.ansprechpartner.ansprechpartner_marke.length:0}</span>
          </button>
          <button class="tab-button" data-tab="kampagnen">
            Zugeordnete Kampagnen
            <span class="tab-count">${this.ansprechpartner.ansprechpartner_kampagne?this.ansprechpartner.ansprechpartner_kampagne.length:0}</span>
          </button>
        </div>

        <!-- Tab-Content -->
        <div class="tab-content">
          <!-- Informationen Tab -->
          <div class="tab-pane active" id="informationen">
            ${this.renderInformationen()}
          </div>

          <!-- Notizen Tab -->
          <div class="tab-pane" id="notizen">
            ${this.renderNotizen()}
          </div>

          <!-- Bewertungen Tab -->
          <div class="tab-pane" id="bewertungen">
            ${this.renderBewertungen()}
          </div>

          <!-- Marken Tab -->
          <div class="tab-pane" id="marken">
            ${this.renderMarken()}
          </div>

          <!-- Kampagnen Tab -->
          <div class="tab-pane" id="kampagnen">
            ${this.renderKampagnen()}
          </div>
        </div>
      </div>
    `)}renderInformationen(){return`
      <div class="detail-section">
        <div class="detail-grid">
          <!-- Kontaktinformationen -->
          <div class="detail-card">
            <h3>Kontaktinformationen</h3>
            <div class="detail-item">
              <label>Name:</label>
              <span>${this.ansprechpartner.vorname} ${this.ansprechpartner.nachname}</span>
            </div>
            <div class="detail-item">
              <label>Position:</label>
              <span>${this.ansprechpartner.position||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Email:</label>
              <span>${this.ansprechpartner.email?`<a href="mailto:${this.ansprechpartner.email}">${this.ansprechpartner.email}</a>`:"-"}</span>
            </div>
            <div class="detail-item">
              <label>Telefon (Mobil):</label>
              <span>${R.renderClickable(this.ansprechpartner.telefonnummer_land?.iso_code,this.ansprechpartner.telefonnummer_land?.vorwahl,this.ansprechpartner.telefonnummer)}</span>
            </div>
            <div class="detail-item">
              <label>Telefon (Büro):</label>
              <span>${R.renderClickable(this.ansprechpartner.telefonnummer_office_land?.iso_code,this.ansprechpartner.telefonnummer_office_land?.vorwahl,this.ansprechpartner.telefonnummer_office)}</span>
            </div>
            <div class="detail-item">
              <label>LinkedIn:</label>
              <span>${this.ansprechpartner.linkedin?`<a href="${this.ansprechpartner.linkedin}" target="_blank" rel="noopener noreferrer">${this.ansprechpartner.linkedin}</a>`:"-"}</span>
            </div>
          </div>

          <!-- Standort & Sprache -->
          <div class="detail-card">
            <h3>Standort & Sprache</h3>
            <div class="detail-item">
              <label>Stadt:</label>
              <span>${this.ansprechpartner.stadt||"-"}</span>
            </div>
            <div class="detail-item">
              <label>Sprache:</label>
              <span>${this.ansprechpartner.sprachen&&this.ansprechpartner.sprachen.length>0?this.ansprechpartner.sprachen.map(e=>e.name).join(", "):this.ansprechpartner.sprache?.name||this.ansprechpartner.sprache||"-"}</span>
            </div>
          </div>

          <!-- Unternehmen -->
          <div class="detail-card">
            <h3>Unternehmen</h3>
            <div class="detail-item">
              <label>Unternehmen:</label>
              <span>
                ${this.ansprechpartner.unternehmen?`<a href="#" class="table-link" data-table="unternehmen" data-id="${this.ansprechpartner.unternehmen.id}">${this.ansprechpartner.unternehmen.firmenname}</a>`:"-"}
              </span>
            </div>
            <div class="detail-item">
              <label>Erstellt am:</label>
              <span>${this.ansprechpartner.created_at?new Date(this.ansprechpartner.created_at).toLocaleDateString("de-DE"):"-"}</span>
            </div>
            <div class="detail-item">
              <label>Zuletzt aktualisiert:</label>
              <span>${this.ansprechpartner.updated_at?new Date(this.ansprechpartner.updated_at).toLocaleDateString("de-DE"):"-"}</span>
            </div>
          </div>

          <!-- Notizen (falls vorhanden) -->
          ${this.ansprechpartner.notiz?`
          <div class="detail-card full-width">
            <h3>Notizen</h3>
            <div class="detail-item">
              <p class="notiz-text">${this.ansprechpartner.notiz}</p>
            </div>
          </div>
          `:""}
        </div>
      </div>
    `}renderNotizen(){return window.notizenSystem?window.notizenSystem.renderNotizenContainer(this.notizen,"ansprechpartner",this.ansprechpartnerId):"<p>Notizen-System nicht verfügbar</p>"}renderBewertungen(){return window.bewertungsSystem?window.bewertungsSystem.renderBewertungenContainer(this.ratings,"ansprechpartner",this.ansprechpartnerId):"<p>Bewertungs-System nicht verfügbar</p>"}renderMarken(){return!this.ansprechpartner.ansprechpartner_marke||this.ansprechpartner.ansprechpartner_marke.length===0?`
        <div class="empty-state">
          <div class="empty-icon">🏷️</div>
          <h3>Keine Marken zugeordnet</h3>
          <p>Diesem Ansprechpartner sind noch keine Marken zugeordnet.</p>
        </div>
      `:`
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Marke</th>
              <th>Unternehmen</th>
              <th>Webseite</th>
              <th>Erstellt</th>
            </tr>
          </thead>
          <tbody>${this.ansprechpartner.ansprechpartner_marke.map(t=>{const n=t.marke;return`
        <tr>
          <td>
            <a href="#" class="table-link" data-table="marke" data-id="${n.id}">
              ${n.markenname||"Unbekannte Marke"}
            </a>
          </td>
          <td>${n.unternehmen?.firmenname?`<a href="#" class="table-link" data-table="unternehmen" data-id="${n.unternehmen.id}">${n.unternehmen.firmenname}</a>`:"-"}</td>
          <td>${n.webseite?`<a href="${n.webseite}" target="_blank" rel="noopener">${n.webseite}</a>`:"-"}</td>
          <td>${n.created_at?new Date(n.created_at).toLocaleDateString("de-DE"):"-"}</td>
        </tr>
      `}).join("")}</tbody>
        </table>
      </div>
    `}renderKampagnen(){return!this.ansprechpartner.ansprechpartner_kampagne||this.ansprechpartner.ansprechpartner_kampagne.length===0?`
        <div class="empty-state">
          <div class="empty-icon">📢</div>
          <h3>Keine Kampagnen zugeordnet</h3>
          <p>Diesem Ansprechpartner sind noch keine Kampagnen zugeordnet.</p>
        </div>
      `:`
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Kampagne</th>
              <th>Unternehmen</th>
              <th>Start</th>
              <th>Deadline</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${this.ansprechpartner.ansprechpartner_kampagne.map(t=>{const n=t.kampagne;return`
        <tr>
          <td>
            <a href="#" class="table-link" data-table="kampagne" data-id="${n.id}">
              ${n.kampagnenname||"Unbekannte Kampagne"}
            </a>
          </td>
          <td>${n.unternehmen?.firmenname?`<a href="#" class="table-link" data-table="unternehmen" data-id="${n.unternehmen.id}">${n.unternehmen.firmenname}</a>`:"-"}</td>
          <td>${n.start?new Date(n.start).toLocaleDateString("de-DE"):"-"}</td>
          <td>${n.deadline?new Date(n.deadline).toLocaleDateString("de-DE"):"-"}</td>
          <td>${n.status||"-"}</td>
        </tr>
      `}).join("")}</tbody>
        </table>
      </div>
    `}renderMarkenList(){return!this.ansprechpartner.ansprechpartner_marke||this.ansprechpartner.ansprechpartner_marke.length===0?'<p class="empty-state">Keine Marken zugeordnet.</p>':`<div class="tag-list">${this.ansprechpartner.ansprechpartner_marke.map(t=>{const n=t.marke;return`
        <div class="tag-item">
          <a href="#" class="table-link" data-table="marke" data-id="${n.id}">
            ${n.markenname}
          </a>
        </div>
      `}).join("")}</div>`}renderKampagnenList(){return!this.ansprechpartner.ansprechpartner_kampagne||this.ansprechpartner.ansprechpartner_kampagne.length===0?'<p class="empty-state">Keine Kampagnen zugeordnet.</p>':`<div class="tag-list">${this.ansprechpartner.ansprechpartner_kampagne.map(t=>{const n=t.kampagne;return`
        <div class="tag-item">
          <a href="#" class="table-link" data-table="kampagne" data-id="${n.id}">
            ${n.kampagnenname}
          </a>
        </div>
      `}).join("")}</div>`}bindEvents(){document.addEventListener("click",e=>{if(e.target.classList.contains("tab-button")){const t=e.target.dataset.tab;this.switchTab(t)}}),document.addEventListener("click",e=>{(e.target.id==="btn-back"||e.target.closest("#btn-back"))&&(e.preventDefault(),window.navigateTo("/ansprechpartner"))}),document.addEventListener("click",e=>{(e.target.id==="btn-edit"||e.target.closest("#btn-edit"))&&(e.preventDefault(),window.navigateTo(`/ansprechpartner/${this.ansprechpartnerId}/edit`))}),document.addEventListener("click",e=>{if(e.target.classList.contains("table-link")){e.preventDefault();const t=e.target.dataset.table,n=e.target.dataset.id;window.navigateTo(`/${t}/${n}`)}}),document.addEventListener("notizenUpdated",()=>{this.loadAnsprechpartnerData().then(()=>{this.render(),this.bindEvents()})}),document.addEventListener("bewertungenUpdated",()=>{this.loadAnsprechpartnerData().then(()=>{this.render(),this.bindEvents()})})}switchTab(e){document.querySelectorAll(".tab-button").forEach(a=>{a.classList.remove("active")}),document.querySelectorAll(".tab-pane").forEach(a=>{a.classList.remove("active")});const t=document.querySelector(`[data-tab="${e}"]`),n=document.getElementById(e);t&&t.classList.add("active"),n&&n.classList.add("active")}async renderCreateForm(){window.setHeadline("Neuen Ansprechpartner anlegen");const e=document.getElementById("dashboard-content");if(!e)return;const t=new W;if(this.formConfig=t.getFormConfig("ansprechpartner"),!this.formConfig){console.error("❌ Keine FormConfig für ansprechpartner gefunden"),this.showError("Formular-Konfiguration nicht gefunden.");return}this.formSystem=new fe,this.formRenderer=this.formSystem.renderer,console.log("🎯 ANSPRECHPARTNERDETAIL: Rendere Formular..."),e.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>${this.formConfig.title}</h1>
          <p>Erfasse die Daten für einen neuen Ansprechpartner</p>
        </div>
      </div>

      <div class="form-container">
        <div id="form-content">Lade Formular...</div>
      </div>
    `;try{const n=this.formRenderer.renderFormOnly("ansprechpartner");document.getElementById("form-content").innerHTML=n;const a=document.querySelector("#ansprechpartner-form .btn-secondary"),r=document.querySelector("#ansprechpartner-form .btn-primary");a&&(a.className="secondary-btn",a.id="btn-cancel-form"),r&&(r.className="action-btn",r.textContent="Ansprechpartner erstellen");const i=document.getElementById("ansprechpartner-form");i&&await this.formSystem.dataLoader.loadDynamicFormData("ansprechpartner",i),this.initializeSearchableSelects(),this.bindFormSubmitEvents(),console.log("✅ ANSPRECHPARTNERDETAIL: Formular erfolgreich geladen")}catch(n){console.error("❌ ANSPRECHPARTNERDETAIL: Fehler beim Laden des Formulars:",n),document.getElementById("form-content").innerHTML=`
        <div class="error-message">
          <p>Fehler beim Laden des Formulars: ${n.message}</p>
        </div>
      `}}bindFormEvents(){}initializeSearchableSelects(){console.log("🎯 ANSPRECHPARTNERDETAIL: Initialisiere Searchable Selects...");const e=document.getElementById("ansprechpartner-form");e&&this.formSystem.initializeSearchableSelects(e)}setupMarkenFiltering(){const e=document.querySelector('select[name="unternehmen_id"]'),t=document.querySelector('select[name="marke_ids"]');e&&t&&(console.log("🔗 ANSPRECHPARTNERDETAIL: Setup Marken-Filterung"),e.addEventListener("change",async n=>{const a=n.target.value;console.log("🏢 ANSPRECHPARTNERDETAIL: Unternehmen geändert:",a),a?await this.loadMarkenForUnternehmen(a,t):await this.loadAllMarken(t)}))}async loadMarkenForUnternehmen(e,t){try{console.log("🔄 ANSPRECHPARTNERDETAIL: Lade Marken für Unternehmen:",e);const{data:n,error:a}=await window.supabase.from("marke").select("id, markenname").eq("unternehmen_id",e).order("markenname");!a&&n?(console.log("✅ ANSPRECHPARTNERDETAIL: Marken geladen:",n.length),this.updateMarkenOptions(t,n)):console.error("❌ ANSPRECHPARTNERDETAIL: Fehler beim Laden der Marken:",a)}catch(n){console.error("❌ ANSPRECHPARTNERDETAIL: Unerwarteter Fehler beim Laden der Marken:",n)}}async loadAllMarken(e){try{console.log("🔄 ANSPRECHPARTNERDETAIL: Lade alle Marken");const{data:t,error:n}=await window.supabase.from("marke").select("id, markenname").order("markenname");!n&&t&&(console.log("✅ ANSPRECHPARTNERDETAIL: Alle Marken geladen:",t.length),this.updateMarkenOptions(e,t))}catch(t){console.error("❌ ANSPRECHPARTNERDETAIL: Fehler beim Laden aller Marken:",t)}}updateMarkenOptions(e,t){for(;e.options.length>1;)e.removeChild(e.lastChild);t.forEach(a=>{const r=document.createElement("option");r.value=a.id,r.textContent=a.markenname,e.appendChild(r)});const n=e.parentNode.querySelector(".searchable-select-container");if(n){n.remove(),e.style.display="";const a=t.map(r=>({value:r.id,label:r.markenname}));this.formSystem.createSearchableSelect(e,a,{placeholder:"Marken suchen und auswählen..."})}console.log("✅ ANSPRECHPARTNERDETAIL: Marken-Optionen aktualisiert")}bindFormSubmitEvents(){const e=document.getElementById("ansprechpartner-form");e?e.addEventListener("submit",async t=>{t.preventDefault(),console.log("📤 ANSPRECHPARTNERDETAIL: Formular wird abgesendet...");const n=new FormData(e),a={};for(const[i,s]of n.entries())s&&s.trim()!==""&&(a[i]=s.trim());const r=e.querySelector('select[name="marke_ids"]');if(r&&r.multiple){const i=Array.from(r.selectedOptions);i.length>0&&(a.marke_ids=i.map(s=>s.value))}console.log("📊 ANSPRECHPARTNERDETAIL: Gesammelte Daten:",a),console.log("⚠️ ANSPRECHPARTNERDETAIL: Submit wird jetzt vom FormSystem übernommen")}):console.warn("⚠️ ANSPRECHPARTNERDETAIL: Formular nicht gefunden")}async handleFormSubmit(e){throw console.log("⚠️ ANSPRECHPARTNERDETAIL: handleFormSubmit wird nicht mehr verwendet - FormSystem übernimmt"),new Error("Diese Methode wird nicht mehr verwendet")}showError(e){const t=document.getElementById("dashboard-content");t&&(t.innerHTML=`
      <div class="page-header">
        <div class="page-title">
          <h1>Fehler</h1>
        </div>
        <div class="page-actions">
          <button class="secondary-btn" id="btn-back-error">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Zurück zur Liste
          </button>
        </div>
      </div>
      <div class="error-message">
        <p>${e}</p>
      </div>
    `,document.addEventListener("click",n=>{(n.target.id==="btn-back-error"||n.target.closest("#btn-back-error"))&&(n.preventDefault(),window.navigateTo("/ansprechpartner"))}))}showEditForm(){console.log("🎯 ANSPRECHPARTNERDETAIL: Zeige Bearbeitungsformular"),window.setHeadline("Ansprechpartner bearbeiten");const e={...this.ansprechpartner};try{e._isEditMode=!0,e._entityId=this.ansprechpartnerId,e.unternehmen_id=this.ansprechpartner?.unternehmen_id||this.ansprechpartner?.unternehmen?.id||null,e.position_id=this.ansprechpartner?.position_id||null}catch{}try{const n=(this.ansprechpartner?.ansprechpartner_marke||[]).map(a=>a?.marke?.id).filter(Boolean);n.length>0&&(e.marke_ids=n)}catch{}try{const n=(this.ansprechpartner?.sprachen||[]).map(a=>a?.id).filter(Boolean);n.length>0&&(e.sprachen_ids=n)}catch{}const t=window.formSystem.renderFormOnly("ansprechpartner",e);window.content.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Ansprechpartner bearbeiten</h1>
          <p>Bearbeiten Sie die Informationen von ${this.ansprechpartner.vorname} ${this.ansprechpartner.nachname}</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/ansprechpartner/${this.ansprechpartnerId}')" class="secondary-btn">Zurück zu Details</button>
        </div>
      </div>
      
      <div class="form-page">
        ${t}
      </div>
    `,window.formSystem.bindFormEvents("ansprechpartner",e),console.log("⚠️ ANSPRECHPARTNERDETAIL: Custom Submit Handler entfernt - FormSystem übernimmt")}async handleEditFormSubmit(){try{const e=document.getElementById("ansprechpartner-form"),t=new FormData(e),n={};for(const[i,s]of t.entries())if(i.includes("[]")){const o=i.replace("[]","");n[o]||(n[o]=[]),n[o].push(s)}else n.hasOwnProperty(i)||(n[i]=s);e.querySelectorAll('select[data-tag-based="true"]').forEach(i=>{let s=e.querySelector(`select[name="${i.name}[]"][style*="display: none"]`);if(s||(s=e.querySelector(`select[name="${i.name}"][style*="display: none"]`)),s){const o=Array.from(s.selectedOptions).map(l=>l.value).filter(Boolean);o.length>0&&(n[i.name]=o)}}),console.log("📝 Ansprechpartner Edit Submit-Daten:",n);const r=await window.dataService.updateEntity("ansprechpartner",this.ansprechpartnerId,n);r.success?(this.showSuccessMessage("Ansprechpartner erfolgreich aktualisiert!"),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"ansprechpartner",action:"updated",id:this.ansprechpartnerId}})),setTimeout(()=>{window.navigateTo(`/ansprechpartner/${this.ansprechpartnerId}`)},1500)):this.showErrorMessage(`Fehler beim Aktualisieren: ${r.error}`)}catch(e){console.error("❌ Fehler beim Aktualisieren des Ansprechpartners:",e),this.showErrorMessage("Ein unerwarteter Fehler ist aufgetreten.")}}showSuccessMessage(e){const t=document.createElement("div");t.className="alert alert-success",t.textContent=e;const n=document.getElementById("ansprechpartner-form");n&&(n.parentNode.insertBefore(t,n),setTimeout(()=>{t.remove()},5e3))}showErrorMessage(e){const t=document.createElement("div");t.className="alert alert-danger",t.textContent=e;const n=document.getElementById("ansprechpartner-form");n&&(n.parentNode.insertBefore(t,n),setTimeout(()=>{t.remove()},5e3))}destroy(){console.log("AnsprechpartnerDetail: Cleaning up..."),this.ansprechpartner=null,this.ansprechpartnerId=null}}const De=new xt;class Rt{constructor(){this.selectedRechnungen=new Set}async init(){window.setHeadline("Rechnungen"),window.breadcrumbSystem&&window.breadcrumbSystem.updateBreadcrumb([{label:"Rechnung",url:"/rechnung",clickable:!1}]),await this.loadAndRender(),window.addEventListener("entityUpdated",e=>{e?.detail?.entity==="rechnung"&&this.loadAndRender()}),document.addEventListener("click",e=>{e.target&&e.target.id==="btn-rechnung-new"&&(e.preventDefault(),this.showCreateForm())})}async loadAndRender(){try{await this.render(),await this.initializeFilterBar();const e=A.getFilters("rechnung"),t=window.currentUser?.rolle==="admin";let n=[],a=[];if(!t&&window.supabase)try{const{data:i}=await window.supabase.from("kampagne_mitarbeiter").select("kampagne_id").eq("mitarbeiter_id",window.currentUser?.id),s=(i||[]).map(d=>d.kampagne_id).filter(Boolean),{data:o}=await window.supabase.from("marke_mitarbeiter").select("marke_id").eq("mitarbeiter_id",window.currentUser?.id),l=(o||[]).map(d=>d.marke_id).filter(Boolean);let u=[];if(l.length>0){const{data:d}=await window.supabase.from("kampagne").select("id").in("marke_id",l);u=(d||[]).map(c=>c.id).filter(Boolean)}if(n=[...new Set([...s,...u])],n.length>0){const{data:d}=await window.supabase.from("kooperationen").select("id").in("kampagne_id",n);a=(d||[]).map(c=>c.id)}console.log(`🔍 RECHNUNGLIST: Mitarbeiter ${window.currentUser?.id} hat Zugriff auf:`,{direkteKampagnen:s.length,markenKampagnen:u.length,gesamtKampagnen:n.length,kooperationen:a.length})}catch(i){console.error("❌ Fehler beim Laden der Zuordnungen:",i)}let r;if(!t&&window.currentUser?.rolle!=="kunde"&&(n.length||a.length)){const i={...e};r=await window.dataService.loadEntities("rechnung",i),r=(r||[]).filter(s=>s.kampagne_id&&n.includes(s.kampagne_id)||s.kooperation_id&&a.includes(s.kooperation_id))}else r=await window.dataService.loadEntities("rechnung",e);this.updateTable(r)}catch(e){window.ErrorHandler?.handle?.(e,"RechnungList.loadAndRender")}}async render(){const e=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Rechnungen</h1>
          <p>Alle Rechnungen im Überblick</p>
        </div>
        <div class="page-header-right">
          ${window.currentUser?.permissions?.rechnung?.can_edit?'<button id="btn-rechnung-new" class="primary-btn">Neue Rechnung anlegen</button>':""}
        </div>
      </div>

      <div class="table-filter-wrapper">
        <div class="filter-bar">
          <div id="filter-container"></div>
          <button id="btn-filter-reset" class="secondary-btn" style="display:${this.hasActiveFilters()?"inline-block":"none"};">Filter zurücksetzen</button>
        </div>
        <div class="table-actions">
          <button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
          <span id="selected-count" style="display:none;">0 ausgewählt</span>
          <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>
        </div>
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th><input type="checkbox" id="select-all-rechnungen"></th>
              <th>Rechnungs-Nr</th>
              <th>Unternehmen</th>
              <th>Auftrag</th>
              <th>Creator</th>
              <th>Gestellt am</th>
              <th>Zahlungsziel</th>
              <th>Status</th>
              <th>Nettobetrag</th>
              <th>Bruttobetrag</th>
              <th>Beleg</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody id="rechnungen-table-body">
            <tr>
              <td colspan="9" class="loading">Lade Rechnungen...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;window.setContentSafely(window.content,e)}async initializeFilterBar(){const e=document.getElementById("filter-container");e&&await A.renderFilterBar("rechnung",e,t=>this.onFiltersApplied(t),()=>this.onFiltersReset())}onFiltersApplied(e){A.applyFilters("rechnung",e),this.loadAndRender()}onFiltersReset(){A.resetFilters("rechnung"),this.loadAndRender()}hasActiveFilters(){const e=A.getFilters("rechnung");return Object.keys(e).length>0}async updateTable(e){const t=document.getElementById("rechnungen-table-body");if(!t)return;if(!e||e.length===0){const{renderEmptyState:s}=await x(async()=>{const{renderEmptyState:o}=await import("./core-C7Vz5Umf.js").then(l=>l.F);return{renderEmptyState:o}},[]);s(t);return}const n=s=>s==null?"-":new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(s),a=s=>s?new Intl.DateTimeFormat("de-DE").format(new Date(s)):"-",r=e.map(s=>`
      <tr data-id="${s.id}">
        <td><input type="checkbox" class="rechnung-check" data-id="${s.id}"></td>
        <td>${s.rechnung_nr||"-"}</td>
        <td>${s.unternehmen?.firmenname||"-"}</td>
        <td>${s.auftrag?.auftragsname||"-"}</td>
        <td>${[s.creator?.vorname,s.creator?.nachname].filter(Boolean).join(" ")||"-"}</td>
        <td>${a(s.gestellt_am)}</td>
        <td>${a(s.zahlungsziel)}</td>
        <td>${s.status||"-"}</td>
        <td>${n(s.nettobetrag)}</td>
        <td>${n(s.bruttobetrag)}</td>
        <td>${s.pdf_url?`<a href="${s.pdf_url}" target="_blank" rel="noopener noreferrer">PDF</a>`:"-"}</td>
        <td>
          ${B.create("rechnung",s.id)}
        </td>
      </tr>
    `).join("");t.innerHTML=r,document.querySelectorAll(".rechnung-check").forEach(s=>{s.addEventListener("change",o=>{const l=o.target.dataset.id;o.target.checked?this.selectedRechnungen.add(l):this.selectedRechnungen.delete(l),this.updateSelectionUI(),this.updateHeaderSelectAll()})});const i=document.getElementById("select-all-rechnungen");i&&i.addEventListener("change",s=>{const o=s.target.checked;document.querySelectorAll(".rechnung-check").forEach(l=>{l.checked=o,o?this.selectedRechnungen.add(l.dataset.id):this.selectedRechnungen.delete(l.dataset.id)}),this.updateSelectionUI()}),document.getElementById("btn-select-all")?.addEventListener("click",s=>{s.preventDefault(),document.querySelectorAll(".rechnung-check").forEach(l=>{l.checked=!0,this.selectedRechnungen.add(l.dataset.id)});const o=document.getElementById("select-all-rechnungen");o&&(o.indeterminate=!1,o.checked=!0),this.updateSelectionUI()}),document.getElementById("btn-deselect-all")?.addEventListener("click",s=>{s.preventDefault(),document.querySelectorAll(".rechnung-check").forEach(l=>{l.checked=!1}),this.selectedRechnungen.clear();const o=document.getElementById("select-all-rechnungen");o&&(o.indeterminate=!1,o.checked=!1),this.updateSelectionUI()}),document.getElementById("btn-delete-selected")?.addEventListener("click",async s=>{s.preventDefault(),await this.deleteSelected()})}updateHeaderSelectAll(){const e=document.getElementById("select-all-rechnungen"),t=document.querySelectorAll(".rechnung-check");if(!e||t.length===0)return;const n=document.querySelectorAll(".rechnung-check:checked").length;e.checked=n===t.length,e.indeterminate=n>0&&n<t.length}updateSelectionUI(){const e=this.selectedRechnungen.size,t=document.getElementById("selected-count"),n=document.getElementById("btn-deselect-all"),a=document.getElementById("btn-delete-selected");t&&(t.textContent=`${e} ausgewählt`,t.style.display=e>0?"inline":"none"),n&&(n.style.display=e>0?"inline-block":"none"),a&&(a.style.display=e>0?"inline-block":"none")}async deleteSelected(){const e=Array.from(this.selectedRechnungen);if(e.length===0){alert("Keine Rechnungen ausgewählt.");return}const t=e.length===1?"Möchten Sie die ausgewählte Rechnung wirklich löschen?":`Möchten Sie die ${e.length} ausgewählten Rechnungen wirklich löschen?`;if((await window.confirmationModal.open({title:"Löschvorgang bestätigen",message:t,confirmText:"Endgültig löschen",cancelText:"Abbrechen",danger:!0}))?.confirmed){console.log(`🗑️ Lösche ${e.length} Rechnungen...`),e.forEach(a=>{const r=document.querySelector(`tr[data-id="${a}"]`);r&&(r.style.opacity="0.5")});try{const a=await window.dataService.deleteEntities("rechnung",e);if(a.success){e.forEach(i=>{document.querySelector(`tr[data-id="${i}"]`)?.remove()}),alert(`✅ ${a.deletedCount} Rechnungen erfolgreich gelöscht.`),this.selectedRechnungen.clear();const r=document.querySelector(".data-table tbody");r&&r.children.length===0&&await this.loadAndRender(),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"rechnung",action:"bulk-deleted",count:a.deletedCount}}))}else throw new Error(a.error||"Löschen fehlgeschlagen")}catch(a){e.forEach(r=>{const i=document.querySelector(`tr[data-id="${r}"]`);i&&(i.style.opacity="1")}),console.error("❌ Fehler beim Löschen:",a),alert(`❌ Fehler beim Löschen: ${a.message}`),await this.loadAndRender()}}}showCreateForm(){window.navigateTo("/rechnung/new")}}const Kt=new Rt;class qt{constructor(){this.id=null,this.data=null,this.belege=[]}async init(e){if(this.id=e,e==="new")return this.showCreateForm();await this.load(),window.breadcrumbSystem&&this.data&&window.breadcrumbSystem.updateBreadcrumb([{label:"Rechnung",url:"/rechnung",clickable:!0},{label:this.data.rechnungsnummer||"Details",url:`/rechnung/${this.id}`,clickable:!1}]),this.render(),this.bindEvents()}async load(){const{data:e,error:t}=await window.supabase.from("rechnung").select(`*,
        unternehmen:unternehmen_id(id, firmenname),
        auftrag:auftrag_id(id, auftragsname)
      `).eq("id",this.id).single();if(t)throw t;this.data=e;try{const{data:n}=await window.supabase.from("rechnung_belege").select("id, file_name, file_path, file_url, content_type, size, uploaded_at, uploaded_by").eq("rechnung_id",this.id).order("uploaded_at",{ascending:!1}),a="rechnung-belege",r=[];for(const i of n||[]){let s=i.file_url||"";try{const{data:o}=await window.supabase.storage.from(a).createSignedUrl(i.file_path,3600);o?.signedUrl&&(s=o.signedUrl)}catch{}r.push({...i,open_url:s})}this.belege=r}catch{this.belege=[]}}render(){window.setHeadline(`Rechnung ${this.data?.rechnung_nr||""}`);const e=a=>a==null?"-":new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(a),t=a=>a?new Intl.DateTimeFormat("de-DE").format(new Date(a)):"-",n=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Rechnung ${this.data?.rechnung_nr||""}</h1>
          <p>Details zur Rechnung</p>
        </div>
        <div class="page-header-right">
          <button id="btn-edit-rechnung" class="secondary-btn">Bearbeiten</button>
          <button onclick="window.navigateTo('/rechnung')" class="secondary-btn">Zur Übersicht</button>
        </div>
      </div>

      <div class="content-section">
        <div class="detail-grid">
          <div class="detail-card">
            <h3>Allgemein</h3>
            <div class="detail-item"><label>Rechnungs-Nr</label><span>${this.data?.rechnung_nr||"-"}</span></div>
            <div class="detail-item"><label>Unternehmen</label><span>${this.data?.unternehmen?.firmenname||"-"}</span></div>
            <div class="detail-item"><label>Auftrag</label><span>${this.data?.auftrag?.auftragsname||"-"}</span></div>
            <div class="detail-item"><label>Status</label><span>${this.data?.status||"-"}</span></div>
            <div class="detail-item"><label>Gestellt am</label><span>${t(this.data?.gestellt_am)}</span></div>
            <div class="detail-item"><label>Zahlungsziel</label><span>${t(this.data?.zahlungsziel)}</span></div>
            <div class="detail-item"><label>Bezahlt am</label><span>${t(this.data?.bezahlt_am)}</span></div>
            <div class="detail-item"><label>Nettobetrag</label><span>${e(this.data?.betrag_netto)}</span></div>
            <div class="detail-item"><label>Bruttobetrag</label><span>${e(this.data?.betrag_brutto)}</span></div>
            <div class="detail-item"><label>PDF</label><span>${this.data?.pdf_url?`<a href="${this.data.pdf_url}" target="_blank" rel="noopener noreferrer">Öffnen</a>`:"-"}</span></div>
          </div>

          <div class="detail-card">
            <h3>Belege</h3>
            ${!this.belege||this.belege.length===0?`
              <p class="empty-state">Keine Belege vorhanden</p>
            `:`
              <div class="data-table-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Datei</th>
                      <th>Größe</th>
                      <th>Hochgeladen am</th>
                      <th>Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this.belege.map(a=>`
                      <tr>
                        <td>${window.validatorSystem.sanitizeHtml(a.file_name||"")}</td>
                        <td>${a.size!=null?Math.round(a.size/1024*10)/10+" KB":"-"}</td>
                        <td>${t(a.uploaded_at)}</td>
                        <td>${a.open_url?`<a href="${a.open_url}" target="_blank" rel="noopener noreferrer">Öffnen</a>`:"-"}</td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
              </div>
            `}
          </div>
        </div>
      </div>
    `;window.setContentSafely(window.content,n)}showCreateForm(){window.setHeadline("Neue Rechnung anlegen"),window.breadcrumbSystem&&window.breadcrumbSystem.updateBreadcrumb([{label:"Rechnung",url:"/rechnung",clickable:!0},{label:"Neue Rechnung",url:"/rechnung/new",clickable:!1}]);const e=window.formSystem.renderFormOnly("rechnung");window.content.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Neue Rechnung anlegen</h1>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/rechnung')" class="secondary-btn">Zurück</button>
        </div>
      </div>
      <div class="form-page">${e}</div>
    `,window.formSystem.bindFormEvents("rechnung",null);const t=document.getElementById("rechnung-form");t&&(t.onsubmit=async n=>{n.preventDefault(),await this.handleCreateSubmit()})}async handleCreateSubmit(){try{const e=document.getElementById("rechnung-form"),t=new FormData(e),n={};for(const[d,c]of t.entries())n[d]=c;e.querySelectorAll('select[data-searchable="true"]').forEach(d=>{const c=d.parentNode.querySelector(".searchable-select-container");if(c){const m=c.querySelector(".searchable-select-input");if(m&&m.value){const p=Array.from(d.options).find(g=>g.textContent.trim()===m.value.trim());p&&(n[d.name]=p.value,console.log(`✅ Searchable Select ${d.name} korrigiert: ${m.value} → ${p.value}`))}}});const i=["auftrag_id","kooperation_id","unternehmen_id","kampagne_id"].filter(d=>!n[d]||n[d].trim()==="");if(i.length>0){alert(`Bitte füllen Sie alle Pflichtfelder aus: ${i.join(", ")}`);return}console.log("📋 Submit-Daten vor Übertragung:",n),console.log("🔍 auftrag_id Wert:",n.auftrag_id,typeof n.auftrag_id);const s=e.querySelector('.uploader[data-name="pdf_file"]');let o=null,l=null;if(s&&s.__uploaderInstance&&s.__uploaderInstance.files.length&&window.supabase){const d=s.__uploaderInstance.files[0],c="rechnungen",m=`${n.unternehmen_id||"unknown"}/${Date.now()}_${d.name}`,{error:h}=await window.supabase.storage.from(c).upload(m,d,{cacheControl:"3600",upsert:!1,contentType:d.type});if(h)throw h;const{data:p}=window.supabase.storage.from(c).getPublicUrl(m);o=p.publicUrl,l=m}o&&(n.pdf_url=o,n.pdf_path=l);const u=await window.dataService.createEntity("rechnung",n);if(u.success){try{const d=e.querySelector('.uploader[data-name="belege_files"]');if(d&&d.__uploaderInstance&&d.__uploaderInstance.files.length&&window.supabase){const c=u.id,m=Array.from(d.__uploaderInstance.files);for(const h of m){const p="rechnung-belege",g=`${c}/${Date.now()}_${Math.random().toString(36).slice(2)}_${h.name}`,{error:b}=await window.supabase.storage.from(p).upload(g,h,{cacheControl:"3600",upsert:!1,contentType:h.type});if(b)throw b;const{data:y}=await window.supabase.storage.from(p).createSignedUrl(g,3600*24*7),w=y?.signedUrl||"";await window.supabase.from("rechnung_belege").insert({rechnung_id:c,file_name:h.name,file_path:g,file_url:w,content_type:h.type,size:h.size,uploaded_by:window.currentUser?.id||null})}}}catch(d){console.warn("⚠️ Belege-Upload teilweise fehlgeschlagen:",d)}alert("Rechnung erstellt"),window.navigateTo(`/rechnung/${u.id}`)}else throw new Error(u.error||"Unbekannter Fehler")}catch(e){alert(`Fehler: ${e.message}`)}}bindEvents(){document.addEventListener("click",e=>{e.target.id==="btn-edit-rechnung"&&this.showEditForm()})}showEditForm(){const e=window.formSystem.renderFormOnly("rechnung",this.data);window.content.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Rechnung bearbeiten</h1>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/rechnung/${this.id}')" class="secondary-btn">Abbrechen</button>
        </div>
      </div>
      <div class="form-page">${e}</div>
    `,window.formSystem.bindFormEvents("rechnung",this.data)}}const Ut=new qt;class Ht{constructor(){this.rows=[],this.mitarbeiterKlassen=[]}async init(){if(window.setHeadline("Mitarbeiter"),window.breadcrumbSystem&&window.breadcrumbSystem.updateBreadcrumb([{label:"Mitarbeiter",url:"/mitarbeiter",clickable:!1}]),!(window.currentUser?.rolle==="admin"||window.canViewPage?.("mitarbeiter")||window.checkUserPermission("dashboard","can_view"))){window.content.innerHTML=`
        <div class="error-message">
          <p>Keine Berechtigung.</p>
        </div>
      `;return}await this.load(),await this.render(),this.bind()}async load(){try{if(window.supabase){const{data:e,error:t}=await window.supabase.from("mitarbeiter_klasse").select("id, name, description").order("sort_order",{ascending:!0});t?console.warn("⚠️ Fehler beim Laden der Mitarbeiter-Klassen:",t):this.mitarbeiterKlassen=e||[]}if(window.supabase){const{data:e,error:t}=await window.supabase.from("benutzer").select(`
            id,
            name,
            rolle,
            unterrolle,
            freigeschaltet,
            mitarbeiter_klasse:mitarbeiter_klasse_id(id, name)
          `).order("name");if(t){console.warn("⚠️ Fehler beim Laden der Mitarbeiter-Liste (eventuell fehlt freigeschaltet Spalte)",t);const{data:n,error:a}=await window.supabase.from("benutzer").select("id, name, rolle, unterrolle, mitarbeiter_klasse:mitarbeiter_klasse_id(id, name)").order("name");if(a){console.error("❌ Auch Fallback fehlgeschlagen:",a),this.rows=[];return}this.rows=(n||[]).map(r=>({...r,freigeschaltet:r.rolle==="admin"}))}else this.rows=e||[]}else this.rows=await window.dataService.loadEntities("benutzer")}catch(e){console.error("❌ Fehler beim Laden der Mitarbeiter:",e),this.rows=[]}}async render(){const t=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Mitarbeiter</h1>
          <p>Benutzerverwaltung und Rechte</p>
        </div>
        <div class="page-header-right">
        </div>
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Rolle</th>
              <th>E-Mail</th>
              <th>Unterrolle</th>
              <th>Kategorie</th>
              <th>Status</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            ${this.rows.map(n=>{const a=n.freigeschaltet?'<span class="status-badge success">FREIGESCHALTET</span>':'<span class="status-badge warning">WARTET</span>',r=this.renderActionsMenu(n);return`
        <tr data-id="${n.id}">
          <td>${n.id?`<a href="#" class="table-link" data-table="mitarbeiter" data-id="${n.id}">${window.validatorSystem.sanitizeHtml(n.name||"—")}</a>`:window.validatorSystem.sanitizeHtml(n.name||"—")}</td>
          <td>${window.validatorSystem.sanitizeHtml(n.rolle||"—")}</td>
          <td>${window.validatorSystem.sanitizeHtml(n.email||"—")}</td>
          <td>${window.validatorSystem.sanitizeHtml(n.unterrolle||"—")}</td>
          <td>${n.mitarbeiter_klasse?.name?`<div class="tags tags-compact"><span class="tag">${window.validatorSystem.sanitizeHtml(n.mitarbeiter_klasse.name)}</span></div>`:"—"}</td>
          <td>${a}</td>
          <td>${r}</td>
        </tr>
      `}).join("")||'<tr><td colspan="7" class="loading">Keine Mitarbeiter gefunden</td></tr>'}
          </tbody>
        </table>
      </div>
    `;window.setContentSafely(window.content,t)}renderActionsMenu(e){return B.create("mitarbeiter",e.id)}getRoleIcon(e){switch(String(e||"").toLowerCase().trim()){case"strategie":case"strategy / creator":return`
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 0 1-.657.643 48.39 48.39 0 0 1-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 0 1-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 0 0-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 0 1-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 0 0 .657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 0 1-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 0 0 5.427-.63 48.05 48.05 0 0 0 .582-4.717.532.532 0 0 0-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.96.401v0a.656.656 0 0 0 .658-.663 48.422 48.422 0 0 0-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 0 1-.61-.58v0Z" />
        </svg>`;case"customer success manager":return`
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
        </svg>`;case"cutter":return`
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="m7.848 8.25 1.536.887M7.848 8.25a3 3 0 1 1-5.196-3 3 3 0 0 1 5.196 3Zm1.536.887a2.165 2.165 0 0 1 1.083 1.839c.005.351.054.695.14 1.024M9.384 9.137l2.077 1.199M7.848 15.75l1.536-.887m-1.536.887a3 3 0 1 1-5.196 3 3 3 0 0 1 5.196-3Zm1.536-.887a2.165 2.165 0 0 0 1.083-1.838c.005-.352.054-.695.14-1.025m-1.223 2.863 2.077-1.199m0-3.328a4.323 4.323 0 0 1 2.068-1.379l5.325-1.628a4.5 4.5 0 0 1 2.48-.044l.803.215-7.794 4.5m-2.882-1.664A4.33 4.33 0 0 0 10.607 12m3.736 0 7.794 4.5-.802.215a4.5 4.5 0 0 1-2.48-.043l-5.326-1.629a4.324 4.324 0 0 1-2.068-1.379M14.343 12l-2.882 1.664" />
        </svg>`;case"scripter":case"skripter":return`
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 11.625h4.5m-4.5 2.25h4.5m2.121 1.527c-1.171 1.464-3.07 1.464-4.242 0-1.172-1.465-1.172-3.84 0-5.304 1.171-1.464 3.07-1.464 4.242 0M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 0 1 9 9v.375M10.125 2.25A3.375 3.375 0 0 1 13.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 0 1 3.375 3.375M9 15l2.25 2.25L15 12" />
        </svg>`;case"projektmanager":return`
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
        </svg>`;default:return I.getHeroIcon("edit")}}bind(){document.addEventListener("click",e=>{const t=e.target.closest(".table-link");if(t&&t.dataset.table==="mitarbeiter"){e.preventDefault();const n=t.dataset.id;window.navigateTo(`/mitarbeiter/${n}`)}}),document.addEventListener("click",e=>{if(e.target.closest('.action-item[data-action="set-field"]')){e.preventDefault();const t=e.target.closest('.action-item[data-action="set-field"]'),n=t.dataset.id,a=t.dataset.field,r=t.dataset.value,i=t.dataset.rolleName;this.handleRoleChange(n,a,r,i)}if(e.target.closest('.action-item[data-action="freischalten"]')){e.preventDefault();const t=e.target.closest('.action-item[data-action="freischalten"]'),n=t.dataset.id,a=t.dataset.currentStatus==="true";this.handleFreischaltenToggle(n,!a)}}),window.addEventListener("entityUpdated",async e=>{const{entity:t,id:n,field:a,value:r}=e.detail||{};if(t!=="benutzer"||a!=="mitarbeiter_klasse_id"&&a!=="freigeschaltet")return;const i=document.querySelector(`tr[data-id="${n}"]`);if(i){if(a==="mitarbeiter_klasse_id")try{(!Array.isArray(this.mitarbeiterKlassen)||this.mitarbeiterKlassen.length===0)&&await this.load();const s=(this.mitarbeiterKlassen||[]).find(l=>l.id===r),o=i.children[4];o&&(s?.name?o.innerHTML=`<div class="tags tags-compact"><span class="tag">${window.validatorSystem.sanitizeHtml(s.name)}</span></div>`:o.textContent="—")}catch(s){console.warn("Konnte Kategorie-Zelle nicht live aktualisieren",s)}if(a==="freigeschaltet"){const s=i.children[5];s&&(s.innerHTML=r?'<span class="status-badge success">FREIGESCHALTET</span>':'<span class="status-badge warning">WARTET</span>')}}})}async handleRoleChange(e,t,n,a){try{console.log(`🔄 Ändere Rolle für Mitarbeiter ${e} auf "${a}"`),await I.setField("benutzer",e,t,n),console.log("✅ Rolle erfolgreich geändert"),await this.load(),await this.render(),this.bind(),window.NotificationSystem&&window.NotificationSystem.show("success",`Rolle erfolgreich auf "${a}" geändert`)}catch(r){console.error("❌ Fehler beim Ändern der Rolle:",r),window.NotificationSystem&&window.NotificationSystem.show("error","Fehler beim Ändern der Rolle")}}async handleFreischaltenToggle(e,t){try{console.log(`${t?"🔓":"🔒"} ${t?"Schalte":"Sperre"} Mitarbeiter ${e}`),await I.setField("benutzer",e,"freigeschaltet",t),console.log("✅ Status erfolgreich geändert"),await this.load(),await this.render(),this.bind();const n=t?"freigeschaltet":"gesperrt";window.NotificationSystem&&window.NotificationSystem.show("success",`Mitarbeiter erfolgreich ${n}`)}catch(n){console.error("❌ Fehler beim Ändern des Status:",n),window.NotificationSystem&&window.NotificationSystem.show("error","Fehler beim Ändern des Status")}}destroy(){window.setContentSafely("")}}const Ot=new Ht;class Vt{constructor(){this.userId=null,this.user=null,this.assignments={kampagnen:[],kooperationen:[],briefings:[]},this.budget={invoicesByKoop:{},totals:{netto:0,zusatz:0,gesamt:0,invoice_netto:0,invoice_brutto:0}},this.statusOptions=[]}async init(e){if(this.userId=e,await this.load(),window.breadcrumbSystem&&this.user){const t=this.user.name||"Details";window.breadcrumbSystem.updateBreadcrumb([{label:"Mitarbeiter",url:"/mitarbeiter",clickable:!0},{label:t,url:`/mitarbeiter/${this.userId}`,clickable:!1}])}await this.render(),this.bind()}async load(){try{const{data:e}=await window.supabase.from("benutzer").select("*").eq("id",this.userId).single();this.user=e||{};const[{data:t},{data:n},{data:a},{data:r}]=await Promise.all([window.supabase.from("kampagne_mitarbeiter").select("kampagne:kampagne_id(id, kampagnenname)").eq("mitarbeiter_id",this.userId),window.supabase.from("kooperationen").select("id, name, status, kampagne:kampagne_id(kampagnenname), nettobetrag, zusatzkosten, gesamtkosten").eq("assignee_id",this.userId),window.supabase.from("briefings").select("id, product_service_offer, status").eq("assignee_id",this.userId),window.supabase.from("kampagne_status").select("id, name, sort_order").order("sort_order",{ascending:!0}).order("name",{ascending:!0})]);this.assignments.kampagnen=(t||[]).map(l=>l.kampagne).filter(Boolean),this.assignments.kooperationen=n||[],this.assignments.briefings=a||[],this.statusOptions=r||[];const i=(this.assignments.kooperationen||[]).map(l=>l.id).filter(Boolean);let s={},o={netto:0,zusatz:0,gesamt:0,invoice_netto:0,invoice_brutto:0};if(i.length>0)try{const{data:l}=await window.supabase.from("rechnung").select("id, rechnung_nr, status, nettobetrag, bruttobetrag, gestellt_am, bezahlt_am, pdf_url, kooperation_id").in("kooperation_id",i);(l||[]).forEach(u=>{s[u.kooperation_id]||(s[u.kooperation_id]=[]),s[u.kooperation_id].push(u),o.invoice_netto+=Number(u.nettobetrag||0),o.invoice_brutto+=Number(u.bruttobetrag||0)})}catch{s={}}(this.assignments.kooperationen||[]).forEach(l=>{o.netto+=Number(l.nettobetrag||0),o.zusatz+=Number(l.zusatzkosten||0),o.gesamt+=Number(l.gesamtkosten!=null?l.gesamtkosten:Number(l.nettobetrag||0)+Number(l.zusatzkosten||0))}),this.budget={invoicesByKoop:s,totals:o}}catch(e){console.error("❌ Fehler beim Laden Mitarbeiter-Details:",e)}}renderAssignmentsList(e,t){return!e||e.length===0?'<div class="empty-state"><p>Keine Einträge</p></div>':`
      <ul class="simple-list">
        ${e.map(t).join("")}
      </ul>`}renderKampagnenTable(){const e=(this.assignments.kampagnen||[]).map(t=>`
      <tr>
        <td><a href="/kampagne/${t.id}" onclick="event.preventDefault(); window.navigateTo('/kampagne/${t.id}')">${window.validatorSystem.sanitizeHtml(t.kampagnenname||t.id)}</a></td>
        <td style="text-align:right;">
          <div class="actions-dropdown-container" data-entity-type="kampagne">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
            </button>
            <div class="actions-dropdown">
              <div class="action-submenu">
                <a href="#" class="action-item has-submenu" data-submenu="status">
                  ${I.getHeroIcon("invoice")}
                  <span>Status ändern</span>
                </a>
                <div class="submenu" data-submenu="status">
                  ${(this.statusOptions||[]).map(n=>`
                    <a href="#" class="submenu-item" data-action="set-field" data-field="status_id" data-value="${n.id}" data-status-name="${n.name.replace(/\"/g,'\\"')}" data-id="${t.id}">${I.getStatusIcon(n.name)}<span>${n.name}</span></a>
                  `).join("")}
                </div>
              </div>
              <a href="#" class="action-item" data-action="view" data-id="${t.id}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5"><path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" /><path fill-rule="evenodd" d="M.661 10c1.743-2.372 4.761-5 9.339-5 4.578 0 7.601 2.628 9.339 5-1.738 2.372-4.761 5-9.339 5-4.578 0-7.601-2.628-9.339-5zM10 15a5 5 0 100-10 5 5 0 000 10z" clip-rule="evenodd" /></svg>
                Details anzeigen
              </a>
              <a href="#" class="action-item action-danger" data-action="unassign-kampagne" data-id="${t.id}" data-mitarbeiter-id="${this.userId}">
                <i class="icon-trash"></i>
                Zuweisung entfernen
              </a>
            </div>
          </div>
        </td>
      </tr>
    `).join("");return e?`
      <div class="data-table-container">
        <table class="data-table">
          <thead><tr><th>Kampagne</th><th>Aktionen</th></tr></thead>
          <tbody>${e}</tbody>
        </table>
      </div>
    `:'<div class="empty-state"><p>Keine Kampagnen zugewiesen</p></div>'}renderKooperationenTable(){const e=(this.assignments.kooperationen||[]).map(t=>`
      <tr>
        <td><a href="/kooperation/${t.id}" onclick="event.preventDefault(); window.navigateTo('/kooperation/${t.id}')">${window.validatorSystem.sanitizeHtml(t.name||t.id)}</a></td>
        <td>${window.validatorSystem.sanitizeHtml(t.kampagne?.kampagnenname||"-")}</td>
        <td><span class="status-badge status-${(t.status||"").toLowerCase().replace(/\s+/g,"-")}">${t.status||"-"}</span></td>
      </tr>
    `).join("");return e?`
      <div class="data-table-container">
        <table class="data-table">
          <thead><tr><th>Name</th><th>Kampagne</th><th>Status</th></tr></thead>
          <tbody>${e}</tbody>
        </table>
      </div>
    `:'<div class="empty-state"><p>Keine Kooperationen zugewiesen</p></div>'}renderBriefingsTable(){const e=(this.assignments.briefings||[]).map(t=>`
      <tr>
        <td><a href="/briefing/${t.id}" onclick="event.preventDefault(); window.navigateTo('/briefing/${t.id}')">${window.validatorSystem.sanitizeHtml(t.product_service_offer||t.id)}</a></td>
        <td><span class="status-badge status-${(t.status||"").toLowerCase().replace(/\s+/g,"-")}">${t.status||"-"}</span></td>
      </tr>
    `).join("");return e?`
      <div class="data-table-container">
        <table class="data-table">
          <thead><tr><th>Briefing</th><th>Status</th></tr></thead>
          <tbody>${e}</tbody>
        </table>
      </div>
    `:'<div class="empty-state"><p>Keine Briefings zugewiesen</p></div>'}generatePermissionsTable(){const e=this.user?.zugriffsrechte||{};return[["creator","Creator"],["creator-lists","Creator Listen"],["unternehmen","Unternehmen"],["marke","Marken"],["auftrag","Aufträge"],["kampagne","Kampagnen"],["kooperation","Kooperationen"],["rechnung","Rechnungen"],["briefing","Briefings"]].map(([t,n])=>`
      <tr>
        <td>${n}</td>
        <td style="text-align:right;">
          <label class="toggle-label" style="justify-content:flex-end;">
            <span class="toggle-switch">
              <input type="checkbox" class="perm-toggle" data-key="${t}" ${e?.[t]?.can_view===!1?"":e?.[t]===!0||e?.[t]?.can_view===!0?"checked":""}>
              <span class="toggle-slider"></span>
            </span>
          </label>
        </td>
        <td style="text-align:right;">
          <label class="toggle-label" style="justify-content:flex-end;">
            <span class="toggle-switch">
              <input type="checkbox" class="perm-edit-toggle" data-key="${t}" ${e?.[t]?.can_edit?"checked":""}>
              <span class="toggle-slider"></span>
            </span>
          </label>
        </td>
      </tr>
    `).join("")}async autoSavePermissions(){if(!this.user?.freigeschaltet){console.log("⚠️ Auto-Save übersprungen: Benutzer nicht freigeschaltet");return}try{const e=document.querySelectorAll(".perm-toggle"),t=document.querySelectorAll(".perm-edit-toggle");let n={};e.forEach(r=>{const i=r.dataset.key;n[i]||(n[i]={}),n[i].can_view=!!r.checked}),t.forEach(r=>{const i=r.dataset.key;n[i]||(n[i]={}),n[i].can_edit=!!r.checked});const{error:a}=await window.supabase.from("benutzer").update({zugriffsrechte:n}).eq("id",this.userId);if(a){console.error("❌ Auto-Save Rechte fehlgeschlagen",a),alert("Fehler beim Speichern der Rechte");return}this.user.zugriffsrechte=n,console.log("✅ Rechte automatisch gespeichert")}catch(e){console.error("❌ Auto-Save Rechte Fehler",e),alert("Fehler beim Speichern der Rechte")}}async render(){this.user?.zugriffsrechte;const e=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Mitarbeiter: ${window.validatorSystem.sanitizeHtml(this.user?.name||"-")}</h1>
          <p>Rechte und Zuweisungen verwalten</p>
        </div>
        <div class="page-header-right">
          <button class="secondary-btn" id="btn-back-mitarbeiter">Mitarbeiter Übersicht</button>
          <p class="text-muted" style="text-align: center; font-style: italic; margin: 1rem 0;">
            Änderungen werden automatisch gespeichert
          </p>
        </div>
      </div>

      <div class="content-section">
        <div class="tab-navigation">
          <button class="tab-button active" data-tab="rechte">Rechte</button>
          <button class="tab-button" data-tab="kampagnen">Kampagnen <span class="tab-count">${this.assignments.kampagnen.length}</span></button>
          <button class="tab-button" data-tab="koops">Kooperationen <span class="tab-count">${this.assignments.kooperationen.length}</span></button>
          <button class="tab-button" data-tab="budget">Mitarbeiter Budget</button>
          <button class="tab-button" data-tab="briefings">Briefings <span class="tab-count">${this.assignments.briefings.length}</span></button>
        </div>

        <div class="tab-content">
          <div class="tab-pane active" id="tab-rechte">
            <div class="detail-section">
              <h2>Benutzer-Status</h2>
              <div class="data-table-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th style="width:120px; text-align:right;">Aktiv</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <div>
                          <strong>Benutzer freigeschaltet</strong>
                          <div class="form-help" style="margin-top: 4px;">
                            ${this.user?.freigeschaltet?"Dieser Benutzer ist freigeschaltet und kann sich anmelden. Sie können Rechte vergeben.":"Dieser Benutzer wartet auf Freischaltung. Schalten Sie ihn frei, bevor Sie Rechte vergeben."}
                          </div>
                        </div>
                      </td>
                      <td style="text-align:right;">
                        <label class="toggle-label" style="justify-content:flex-end;">
                          <span class="toggle-switch">
                            <input type="checkbox" id="freigeschaltet-toggle" ${this.user?.freigeschaltet?"checked":""}>
                            <span class="toggle-slider"></span>
                          </span>
                        </label>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            
            <div class="detail-section">
              <h2>Rechte</h2>
              ${this.user?.freigeschaltet?`<div class="data-table-container">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Recht</th>
                        <th style="width:120px; text-align:right;">Lesen</th>
                        <th style="width:120px; text-align:right;">Bearbeiten</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${this.generatePermissionsTable()}
                    </tbody>
                  </table>
                </div>`:'<p class="text-muted"><em>Rechte können erst nach der Freischaltung des Benutzers vergeben werden.</em></p>'}
            </div>
          </div>

          <div class="tab-pane" id="tab-kampagnen">
            <div class="detail-section">
              <h2>Zugewiesene Kampagnen</h2>
              ${this.renderKampagnenTable()}
            </div>
          </div>

          <div class="tab-pane" id="tab-koops">
            <div class="detail-section">
              <h2>Zugewiesene Kooperationen</h2>
              ${this.renderKooperationenTable()}
            </div>
          </div>

          <div class="tab-pane" id="tab-budget">
            <div class="detail-section">
              <h2>Mitarbeiter Budget</h2>
              ${this.renderBudget()}
            </div>
          </div>

          <div class="tab-pane" id="tab-briefings">
            <div class="detail-section">
              <h2>Zugewiesene Briefings</h2>
              ${this.renderBriefingsTable()}
            </div>
          </div>
        </div>
      </div>
    `;window.setContentSafely(window.content,e)}formatCurrency(e){const t=Number(e||0);return new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(t)}renderBudget(){const e=(this.assignments.kooperationen||[]).map(r=>{const i=this.budget.invoicesByKoop[r.id]||[],s=i.length?i.map(d=>`<div><a href="/rechnung/${d.id}" onclick="event.preventDefault(); window.navigateTo('/rechnung/${d.id}')">${window.validatorSystem.sanitizeHtml(d.rechnung_nr||d.id)}</a> — ${this.formatCurrency(d.bruttobetrag)} <span class="status-badge status-${(d.status||"").toLowerCase().replace(/\s+/g,"-")}">${d.status||"-"}</span></div>`).join(""):'<span class="muted">Keine Rechnung</span>',o=Number(r.nettobetrag||0),l=Number(r.zusatzkosten||0),u=r.gesamtkosten!=null?Number(r.gesamtkosten):o+l;return`
        <tr>
          <td><a href="/kooperation/${r.id}" onclick="event.preventDefault(); window.navigateTo('/kooperation/${r.id}')">${window.validatorSystem.sanitizeHtml(r.name||r.id)}</a></td>
          <td>${window.validatorSystem.sanitizeHtml(r.kampagne?.kampagnenname||"-")}</td>
          <td style="text-align:right;">${this.formatCurrency(o)}</td>
          <td style="text-align:right;">${this.formatCurrency(l)}</td>
          <td style="text-align:right;">${this.formatCurrency(u)}</td>
          <td>${s}</td>
        </tr>
      `}).join(""),t=this.budget.totals||{netto:0,zusatz:0,gesamt:0,invoice_netto:0,invoice_brutto:0},n=`
      <div class="summary-cards grid-3">
        <div class="detail-card"><h3>Summe Netto (Koops)</h3><div class="detail-value">${this.formatCurrency(t.netto)}</div></div>
        <div class="detail-card"><h3>Summe Zusatzkosten</h3><div class="detail-value">${this.formatCurrency(t.zusatz)}</div></div>
        <div class="detail-card"><h3>Summe Gesamtkosten</h3><div class="detail-value">${this.formatCurrency(t.gesamt)}</div></div>
      </div>
      <div class="summary-cards grid-2" style="margin-top:12px;">
        <div class="detail-card"><h3>Summe Rechnungen Netto</h3><div class="detail-value">${this.formatCurrency(t.invoice_netto)}</div></div>
        <div class="detail-card"><h3>Summe Rechnungen Brutto</h3><div class="detail-value">${this.formatCurrency(t.invoice_brutto)}</div></div>
      </div>
    `,a=e?`
        <div class="data-table-container" style="margin-top:12px;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Kooperation</th>
                <th>Kampagne</th>
                <th style="text-align:right;">Netto</th>
                <th style="text-align:right;">Zusatz</th>
                <th style="text-align:right;">Gesamt</th>
                <th>Rechnungen</th>
              </tr>
            </thead>
            <tbody>${e}</tbody>
          </table>
        </div>
      `:'<div class="empty-state"><p>Keine Kooperationen zugewiesen</p></div>';return`${n}${a}`}bind(){document.addEventListener("click",t=>{const n=t.target.closest(".tab-button");if(!n)return;t.preventDefault();const a=n.dataset.tab;document.querySelectorAll(".tab-button").forEach(i=>i.classList.remove("active")),n.classList.add("active"),document.querySelectorAll(".tab-pane").forEach(i=>i.classList.remove("active"));const r=document.getElementById(`tab-${a}`);r&&r.classList.add("active")});const e=this;document.addEventListener("change",async t=>{if(t.target&&t.target.id==="freigeschaltet-toggle"){const n=t.target.checked,a=document.querySelector("#tab-rechte .detail-section:nth-child(2)"),r=document.querySelector("#tab-rechte .form-help");try{const i={freigeschaltet:n};n?(e.user.rolle==="pending"&&(i.rolle="user"),e.user.unterrolle==="awaiting_approval"&&(i.unterrolle="can_view")):(i.rolle="pending",i.unterrolle="awaiting_approval",i.zugriffsrechte=null);const{error:s}=await window.supabase.from("benutzer").update(i).eq("id",e.userId);if(s){console.error("❌ Auto-Save Freigeschaltet fehlgeschlagen",s),t.target.checked=!n,alert("Fehler beim Speichern des Freischaltungs-Status");return}e.user.freigeschaltet=n,i.rolle&&(e.user.rolle=i.rolle),i.unterrolle&&(e.user.unterrolle=i.unterrolle),i.zugriffsrechte!==void 0&&(e.user.zugriffsrechte=i.zugriffsrechte),window.notificationSystem&&e.user.auth_user_id&&(await window.notificationSystem.pushNotification(e.user.auth_user_id,{type:"system",entity:"benutzer",entityId:e.userId,title:n?"Ihr Account wurde freigeschaltet":"Ihr Account wurde gesperrt",message:n?"Sie können sich jetzt anmelden und das System nutzen.":"Ihr Zugang wurde vorübergehend deaktiviert."}),window.dispatchEvent(new Event("notificationsRefresh"))),console.log(`✅ Benutzer ${n?"freigeschaltet":"gesperrt"}`),setTimeout(()=>{e.render().then(()=>e.bind())},100)}catch(i){console.error("❌ Auto-Save Fehler",i),t.target.checked=!n,alert("Fehler beim Speichern");return}a&&(n?(a.style.display="block",a.innerHTML=`
              <h2>Rechte</h2>
              <div class="data-table-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Recht</th>
                      <th style="width:120px; text-align:right;">Lesen</th>
                      <th style="width:120px; text-align:right;">Bearbeiten</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${e.generatePermissionsTable()}
                  </tbody>
                </table>
              </div>
            `):a.innerHTML=`
              <h2>Rechte</h2>
              <p class="text-muted"><em>Rechte können erst nach der Freischaltung des Benutzers vergeben werden.</em></p>
            `),r&&(r.textContent=n?"Dieser Benutzer ist freigeschaltet und kann sich anmelden. Sie können Rechte vergeben.":"Dieser Benutzer wartet auf Freischaltung. Schalten Sie ihn frei, bevor Sie Rechte vergeben.")}t.target&&(t.target.classList.contains("perm-toggle")||t.target.classList.contains("perm-edit-toggle"))&&await e.autoSavePermissions()}),document.addEventListener("click",async t=>{if(t.target&&t.target.id==="btn-back-mitarbeiter"){t.preventDefault(),window.navigateTo("/mitarbeiter");return}if(t.target&&t.target.id==="btn-save-perms"){t.preventDefault();const n=document.getElementById("freigeschaltet-toggle"),a=n?n.checked:this.user?.freigeschaltet;let r={};if(a){const i=document.querySelectorAll(".perm-toggle"),s=document.querySelectorAll(".perm-edit-toggle");i.forEach(o=>{const l=o.dataset.key;r[l]||(r[l]={}),r[l].can_view=!!o.checked}),s.forEach(o=>{const l=o.dataset.key;r[l]||(r[l]={}),r[l].can_edit=!!o.checked})}try{const i={freigeschaltet:a,zugriffsrechte:r},{error:s}=await window.supabase.from("benutzer").update(i).eq("id",this.userId);if(s)throw s;this.user.freigeschaltet=a,this.user.zugriffsrechte=r;try{const o=a?"freigeschaltet":"gesperrt",l=Object.entries(r).map(([u,d])=>`${u}: ${d?.can_view?"R":"-"}/${d?.can_edit?"E":"-"}`).join(", ");await window.notificationSystem?.pushNotification(this.userId,{type:"update",entity:"mitarbeiter",entityId:this.userId,title:a?"Account freigeschaltet":"Account gesperrt",message:a?`Ihr Account wurde freigeschaltet. ${l?"Rechte: "+l:""}`:"Ihr Account wurde gesperrt."}),window.dispatchEvent(new Event("notificationsRefresh"))}catch{}alert(a?"Benutzer freigeschaltet und Rechte gespeichert":"Benutzer gesperrt"),await this.render(),this.bind()}catch(i){console.error("❌ Speichern fehlgeschlagen",i),alert("Fehler beim Speichern")}}})}showEditForm(){console.log("🎯 MITARBEITERDETAIL: Zeige Bearbeitungsformular"),window.setHeadline("Mitarbeiter bearbeiten"),window.content.innerHTML=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Mitarbeiter bearbeiten</h1>
          <p>Die Bearbeitung von Mitarbeitern erfolgt über die Detail-Ansicht</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/mitarbeiter/${this.userId}')" class="secondary-btn">Zurück zu Details</button>
        </div>
      </div>
      
      <div class="content-section">
        <div class="info-message">
          <h2>Hinweis</h2>
          <p>Die Bearbeitung von Mitarbeitern erfolgt direkt über die Detail-Ansicht mit speziellen Admin-Funktionen.</p>
          <p>Klicken Sie auf "Zurück zu Details" um zur vollständigen Mitarbeiter-Verwaltung zu gelangen.</p>
          <br>
          <button onclick="window.navigateTo('/mitarbeiter/${this.userId}')" class="primary-btn">Zurück zur Detail-Ansicht</button>
        </div>
      </div>
    `}destroy(){window.setContentSafely("")}}const Pt=new Vt;class jt{constructor(){this.rows=[],this.filteredRows=[],this.unternehmenMap={},this.markenMap={}}async init(){if(window.setHeadline("Kunden"),window.breadcrumbSystem&&window.breadcrumbSystem.updateBreadcrumb([{label:"Kunden",url:"/admin/kunden",clickable:!1}]),!(window.currentUser?.rolle==="admin"||window.canViewPage?.("mitarbeiter"))){window.content.innerHTML=`
        <div class="error-message">
          <p>Keine Berechtigung.</p>
        </div>
      `;return}await this.load(),await this.render(),this.bind()}async load(){try{if(window.supabase){const{data:e,error:t}=await window.supabase.from("benutzer").select("id, name, rolle, unterrolle, freigeschaltet, auth_user_id").in("rolle",["kunde","kunde_editor"]).order("name",{ascending:!0});if(t)throw t;this.rows=e||[],this.filteredRows=this.rows;const n=(this.rows||[]).map(a=>a.id).filter(Boolean);if(n.length){const[{data:a},{data:r}]=await Promise.all([window.supabase.from("kunde_unternehmen").select("kunde_id, unternehmen:unternehmen_id(id, firmenname)").in("kunde_id",n),window.supabase.from("kunde_marke").select("kunde_id, marke:marke_id(id, markenname)").in("kunde_id",n)]);this.unternehmenMap={},(a||[]).forEach(i=>{this.unternehmenMap[i.kunde_id]||(this.unternehmenMap[i.kunde_id]=[]),i.unternehmen&&this.unternehmenMap[i.kunde_id].push(i.unternehmen)}),this.markenMap={},(r||[]).forEach(i=>{this.markenMap[i.kunde_id]||(this.markenMap[i.kunde_id]=[]),i.marke&&this.markenMap[i.kunde_id].push(i.marke)})}}else this.rows=await window.dataService.loadEntities("benutzer"),this.rows=(this.rows||[]).filter(e=>["kunde","kunde_editor"].includes((e.rolle||"").toLowerCase())),this.filteredRows=this.rows}catch(e){console.error("❌ Fehler beim Laden der Kunden:",e),this.rows=[],this.filteredRows=[]}}async render(){const t=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Kunden</h1>
          <p>Externe Kunden verwalten</p>
        </div>
        <div class="page-header-right">
          <div class="search-inline">
            <input id="kunden-search" class="form-input" type="text" placeholder="Suche nach Name/Rolle..." />
          </div>
          <button class="primary-btn" id="btn-kunde-anlegen" style="margin-left:8px;">Kunde anlegen</button>
        </div>
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Rolle</th>
              <th>Unterrolle</th>
              <th>Unternehmen</th>
              <th>Marken</th>
              <th>Freigeschaltet</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            ${(this.filteredRows||[]).map(n=>{const a=n.freigeschaltet?'<span class="status-badge success">FREIGESCHALTET</span>':'<span class="status-badge warning">WARTET</span>',r=this.renderActionsMenu(n),i=(this.unternehmenMap[n.id]||[]).length,s=(this.markenMap[n.id]||[]).length,o=i?`<div class="tags tags-compact"><span class="tag">${i}</span></div>`:"—",l=s?`<div class="tags tags-compact"><span class="tag">${s}</span></div>`:"—";return`
        <tr data-id="${n.id}">
          <td>${n.id?`<a href="#" class="table-link" data-table="kunden" data-id="${n.id}">${window.validatorSystem.sanitizeHtml(n.name||"—")}</a>`:window.validatorSystem.sanitizeHtml(n.name||"—")}</td>
          <td>${window.validatorSystem.sanitizeHtml(n.auth_user_id?"Registriert":"—")}</td>
          <td>${window.validatorSystem.sanitizeHtml(n.rolle||"—")}</td>
          <td>${window.validatorSystem.sanitizeHtml(n.unterrolle||"—")}</td>
          <td>${o}</td>
          <td>${l}</td>
          <td>${a}</td>
          <td>${r}</td>
        </tr>
      `}).join("")||'<tr><td colspan="8" class="loading">Keine Kunden gefunden</td></tr>'}
          </tbody>
        </table>
      </div>
    `;window.setContentSafely(window.content,t)}renderActionsMenu(e){return B.create("kunde",e.id)}bind(){document.addEventListener("click",e=>{e.target&&e.target.id==="btn-kunde-anlegen"&&(e.preventDefault(),window.navigateTo("/admin/kunden/new"))}),document.addEventListener("input",e=>{if(e.target&&e.target.id==="kunden-search"){const t=(e.target.value||"").toLowerCase();t?this.filteredRows=(this.rows||[]).filter(n=>(n.name||"").toLowerCase().includes(t)||(n.rolle||"").toLowerCase().includes(t)||(n.unterrolle||"").toLowerCase().includes(t)):this.filteredRows=this.rows,this.render()}}),document.addEventListener("click",e=>{const t=e.target.closest(".table-link");if(t&&t.dataset.table==="kunden"){e.preventDefault();const n=t.dataset.id;window.navigateTo(`/kunden-admin/${n}`)}}),document.addEventListener("click",async e=>{if(e.target.closest('.submenu-item[data-action="set-role"]')){e.preventDefault();const t=e.target.closest('.submenu-item[data-action="set-role"]'),n=t.dataset.id,a=t.dataset.role;try{await I.setField("benutzer",n,"rolle",a),await this.load(),await this.render(),this.bind(),window.NotificationSystem?.show("success",`Rolle gesetzt: ${a}`)}catch(r){console.error("❌ Rolle setzen fehlgeschlagen",r),window.NotificationSystem?.show("error","Rolle setzen fehlgeschlagen")}}if(e.target.closest('.submenu-item[data-action="assign-unternehmen"]')){e.preventDefault();const t=e.target.closest(".submenu-item").dataset.id;await this.showUnternehmenZuordnungModal(t)}if(e.target.closest('.submenu-item[data-action="remove-unternehmen"]')){e.preventDefault();const t=e.target.closest(".submenu-item").dataset.id,n=prompt("Unternehmen-ID zum Entfernen");if(!n)return;try{const{error:a}=await window.supabase.from("kunde_unternehmen").delete().eq("kunde_id",t).eq("unternehmen_id",n);if(a)throw a;await this.load(),await this.render(),this.bind(),window.NotificationSystem?.show("success","Unternehmen entfernt")}catch(a){console.error("❌ Entfernen fehlgeschlagen",a),window.NotificationSystem?.show("error","Entfernen fehlgeschlagen")}}if(e.target.closest('.submenu-item[data-action="assign-marke"]')){e.preventDefault();const t=e.target.closest(".submenu-item").dataset.id,n=prompt("Marken-ID eingeben");if(!n)return;try{const{error:a}=await window.supabase.from("kunde_marke").insert({kunde_id:t,marke_id:n});if(a)throw a;await this.load(),await this.render(),this.bind(),window.NotificationSystem?.show("success","Marke zugeordnet")}catch(a){console.error("❌ Zuordnung fehlgeschlagen",a),window.NotificationSystem?.show("error","Zuordnung fehlgeschlagen")}}if(e.target.closest('.submenu-item[data-action="remove-marke"]')){e.preventDefault();const t=e.target.closest(".submenu-item").dataset.id,n=prompt("Marken-ID zum Entfernen");if(!n)return;try{const{error:a}=await window.supabase.from("kunde_marke").delete().eq("kunde_id",t).eq("marke_id",n);if(a)throw a;await this.load(),await this.render(),this.bind(),window.NotificationSystem?.show("success","Marke entfernt")}catch(a){console.error("❌ Entfernen fehlgeschlagen",a),window.NotificationSystem?.show("error","Entfernen fehlgeschlagen")}}if(e.target.closest('.action-item[data-action="invite"]')){e.preventDefault();const n=e.target.closest('.action-item[data-action="invite"]').dataset.id;try{await window.notificationSystem?.sendCustomerInvite?.(n),window.NotificationSystem?.show("success","Einladung gesendet")}catch(a){console.error("❌ Einladung fehlgeschlagen",a),window.NotificationSystem?.show("error","Einladung fehlgeschlagen")}}if(e.target.closest('.action-item[data-action="freischalten"]')){e.preventDefault();const t=e.target.closest('.action-item[data-action="freischalten"]'),n=t.dataset.id,a=t.dataset.currentStatus==="true";try{await I.setField("benutzer",n,"freigeschaltet",!a),await this.load(),await this.render(),this.bind(),window.NotificationSystem?.show("success",a?"Kunde gesperrt":"Kunde freigeschaltet")}catch(r){console.error("❌ Status-Update fehlgeschlagen",r),window.NotificationSystem?.show("error","Update fehlgeschlagen")}}if(e.target.closest('.action-item[data-action="view"]')){e.preventDefault();const n=e.target.closest('.action-item[data-action="view"]').dataset.id;window.navigateTo(`/kunden-admin/${n}`)}})}async showCreateForm(){if(!(window.currentUser?.rolle==="admin")){window.content.innerHTML='<div class="error-message"><p>Keine Berechtigung.</p></div>';return}window.breadcrumbSystem&&window.breadcrumbSystem.updateBreadcrumb([{label:"Kunden",url:"/admin/kunden",clickable:!0},{label:"Neuer Kunde",url:"/admin/kunden/new",clickable:!1}]),window.setContentSafely(window.content,`
      <div class="page-header">
        <div class="page-header-left">
          <h1>Kunde anlegen</h1>
          <p>Wizard zum Anlegen inkl. Zuordnungen</p>
        </div>
        <div class="page-header-right">
          <button class="secondary-btn" id="btn-kunden-zurueck">Zur Übersicht</button>
        </div>
      </div>

      <div class="content-section">
        <form id="kunden-create-form" class="form-grid">
          <div class="form-group">
            <label class="form-label" for="c-name">Name</label>
            <input class="form-input" id="c-name" type="text" placeholder="Max Mustermann" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="c-email">E-Mail</label>
            <input class="form-input" id="c-email" type="email" placeholder="kunde@example.com" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="c-rolle">Rolle</label>
            <select id="c-rolle" class="form-input">
              <option value="kunde" selected>Kunde</option>
              <option value="kunde_editor">Kunde (Editor)</option>
            </select>
          </div>

          <div class="form-group tag-based-select" style="grid-column: 1 / -1;">
            <label class="form-label">Unternehmen</label>
            <input type="text" id="as-unternehmen" class="form-input auto-suggest-input" placeholder="Unternehmen suchen..." />
            <div id="asdd-unternehmen" class="auto-suggest-dropdown"></div>
            <div id="tags-unternehmen" class="tags-container"></div>
          </div>

          <div class="form-group tag-based-select" style="grid-column: 1 / -1;">
            <label class="form-label">Marken (Multi-Select)</label>
            <input type="text" id="as-marke" class="form-input auto-suggest-input" placeholder="Marke suchen..." />
            <div id="asdd-marke" class="auto-suggest-dropdown"></div>
            <div id="tags-marke" class="tags-container"></div>
          </div>

          <div class="form-group tag-based-select" style="grid-column: 1 / -1;">
            <label class="form-label">Kampagnen (Multi-Select)</label>
            <input type="text" id="as-kampagne" class="form-input auto-suggest-input" placeholder="Kampagne suchen..." />
            <div id="asdd-kampagne" class="auto-suggest-dropdown"></div>
            <div id="tags-kampagne" class="tags-container"></div>
          </div>

          <div class="form-group tag-based-select" style="grid-column: 1 / -1;">
            <label class="form-label">Kooperationen (Multi-Select)</label>
            <input type="text" id="as-kooperation" class="form-input auto-suggest-input" placeholder="Kooperation suchen..." />
            <div id="asdd-kooperation" class="auto-suggest-dropdown"></div>
            <div id="tags-kooperation" class="tags-container"></div>
          </div>

          <div class="form-group" style="grid-column: 1 / -1; display:flex; gap:8px; align-items:center;">
            <button type="submit" class="primary-btn" id="btn-kunde-speichern">Kunde speichern</button>
            <button type="button" class="secondary-btn" id="btn-invite-copy">Einladungslink kopieren</button>
            <span class="muted" id="invite-hint">Kunde nicht vorhanden? Link kopieren und versenden.</span>
          </div>
        </form>

        <div id="kunden-create-msg" class="info-message" style="display:none; margin-top:12px;"></div>
      </div>
    `),document.getElementById("btn-kunden-zurueck")?.addEventListener("click",l=>{l.preventDefault(),window.navigateTo("/admin/kunden")}),document.getElementById("btn-invite-copy")?.addEventListener("click",l=>{l.preventDefault();const u=document.getElementById("c-name").value.trim(),d=document.getElementById("c-email").value.trim(),c=`${window.location.origin}/src/auth/kunden-register.html?email=${encodeURIComponent(d)}&name=${encodeURIComponent(u)}`;navigator.clipboard?.writeText(c).then(()=>{window.NotificationSystem?.show("success","Einladungslink kopiert")}).catch(()=>{window.NotificationSystem?.show("info",c)})});let n=null,a=[],r=[],i=[];const s=(l,u,d,c)=>{const m=document.getElementById(l),h=document.createElement("span");h.className="tag",h.textContent=d;const p=document.createElement("button");p.type="button",p.className="tag-remove",p.innerHTML="&times;",p.addEventListener("click",()=>{c(),h.remove()}),h.appendChild(p),m.appendChild(h)},o=(l,u,d,c,m)=>{const h=document.getElementById(l),p=document.getElementById(u);let g;const b=y=>{p.innerHTML=`<div class="dropdown-item no-results">${y}</div>`};h.addEventListener("focus",async()=>{try{const y=await d("");p.innerHTML=y&&y.length?y.map(w=>m(w)).join(""):'<div class="dropdown-item no-results">Keine Treffer</div>',p.classList.add("show")}catch{b("Fehler bei der Suche"),p.classList.add("show")}}),h.addEventListener("blur",()=>{setTimeout(()=>p.classList.remove("show"),150)}),h.addEventListener("input",()=>{clearTimeout(g),g=setTimeout(async()=>{const y=h.value.trim();if(y.length<1){try{const w=await d("");p.innerHTML=w&&w.length?w.map(v=>m(v)).join(""):'<div class="dropdown-item no-results">Keine Treffer</div>',p.classList.add("show")}catch{b("Fehler bei der Suche"),p.classList.add("show")}return}try{const w=await d(y);if(!w||w.length===0){b("Keine Treffer"),p.classList.add("show");return}p.innerHTML=w.map(v=>m(v)).join(""),p.classList.add("show")}catch(w){console.warn("AutoSuggest query error",w),b("Fehler bei der Suche"),p.classList.add("show")}},200)}),p.addEventListener("click",y=>{const w=y.target.closest(".dropdown-item[data-id]");if(!w)return;const v=w.dataset.id;c(v,w.dataset.label),p.classList.remove("show"),h.value=""})};o("as-unternehmen","asdd-unternehmen",async l=>{let u=window.supabase.from("unternehmen").select("id, firmenname").order("firmenname",{ascending:!0}).limit(20);l&&l.length>0&&(u=u.ilike("firmenname",`%${l}%`));const{data:d}=await u;return d||[]},(l,u)=>{n=l,document.getElementById("tags-unternehmen").innerHTML="",s("tags-unternehmen",l,u,()=>{n=null}),document.getElementById("tags-marke").innerHTML="",document.getElementById("tags-kampagne").innerHTML="",document.getElementById("tags-kooperation").innerHTML="",a=[],r=[],i=[],document.getElementById("as-marke")?.dispatchEvent(new Event("focus")),document.getElementById("as-kampagne")?.dispatchEvent(new Event("focus")),document.getElementById("as-kooperation")?.dispatchEvent(new Event("focus"))},l=>`<div class="dropdown-item" data-id="${l.id}" data-label="${window.validatorSystem.sanitizeHtml(l.firmenname)}">${window.validatorSystem.sanitizeHtml(l.firmenname)}</div>`),o("as-marke","asdd-marke",async l=>{let u=window.supabase.from("marke").select("id, markenname, unternehmen_id").order("markenname",{ascending:!0}).limit(20);l&&l.length>0&&(u=u.ilike("markenname",`%${l}%`)),n&&(u=u.eq("unternehmen_id",n));const{data:d}=await u;return(d||[]).filter(c=>!a.includes(c.id))},(l,u)=>{a.includes(l)||(a.push(l),s("tags-marke",l,u,()=>{a=a.filter(d=>d!==l)}),document.getElementById("tags-kampagne").innerHTML="",document.getElementById("tags-kooperation").innerHTML="",r=[],i=[],document.getElementById("as-kampagne")?.dispatchEvent(new Event("focus")),document.getElementById("as-kooperation")?.dispatchEvent(new Event("focus")))},l=>`<div class="dropdown-item" data-id="${l.id}" data-label="${window.validatorSystem.sanitizeHtml(l.markenname)}">${window.validatorSystem.sanitizeHtml(l.markenname)}</div>`),o("as-kampagne","asdd-kampagne",async l=>{let u=window.supabase.from("kampagne").select("id, kampagnenname, marke_id, unternehmen_id").order("created_at",{ascending:!1}).limit(20);l&&l.length>0&&(u=u.ilike("kampagnenname",`%${l}%`)),a.length>0?u=u.in("marke_id",a):n&&(u=u.eq("unternehmen_id",n));const{data:d}=await u;return(d||[]).filter(c=>!r.includes(c.id))},(l,u)=>{r.includes(l)||(r.push(l),s("tags-kampagne",l,u,()=>{r=r.filter(d=>d!==l)}),document.getElementById("tags-kooperation").innerHTML="",i=[],document.getElementById("as-kooperation")?.dispatchEvent(new Event("focus")))},l=>`<div class="dropdown-item" data-id="${l.id}" data-label="${window.validatorSystem.sanitizeHtml(l.kampagnenname)}">${window.validatorSystem.sanitizeHtml(l.kampagnenname)}</div>`),o("as-kooperation","asdd-kooperation",async l=>{let u=window.supabase.from("kooperationen").select("id, name, kampagne_id, unternehmen_id").order("created_at",{ascending:!1}).limit(20);if(l&&l.length>0&&(u=u.ilike("name",`%${l}%`)),r.length>0)u=u.in("kampagne_id",r);else if(a.length>0){const{data:c}=await window.supabase.from("kampagne").select("id").in("marke_id",a),m=(c||[]).map(h=>h.id);m.length>0&&(u=u.in("kampagne_id",m))}else n&&(u=u.eq("unternehmen_id",n));const{data:d}=await u;return(d||[]).filter(c=>!i.includes(c.id))},(l,u)=>{i.includes(l)||(i.push(l),s("tags-kooperation",l,u,()=>{i=i.filter(d=>d!==l)}))},l=>`<div class="dropdown-item" data-id="${l.id}" data-label="${window.validatorSystem.sanitizeHtml(l.name)}">${window.validatorSystem.sanitizeHtml(l.name)}</div>`),document.getElementById("kunden-create-form")?.addEventListener("submit",async l=>{l.preventDefault();const u=document.getElementById("c-name").value.trim(),d=document.getElementById("c-email").value.trim(),c=document.getElementById("c-rolle").value,m=n?[n]:[],h=[...a],p=[...r],g=[...i],b=document.getElementById("kunden-create-msg"),y=(w,v)=>{b.className=`${w==="error"?"error-message":"success-message"}`,b.textContent=v,b.style.display=""};try{const{data:w}=await window.supabase.from("benutzer").select("id, email").eq("email",d).maybeSingle?.()||{},v=w?.id||null;if(!v){y("info","Benutzer noch nicht vorhanden. Einladung senden und nach Registrierung erneut Zuordnungen speichern."),window.NotificationSystem?.show("info","Einladung erforderlich.");return}const{error:k}=await window.supabase.from("benutzer").update({name:u,rolle:c}).eq("id",v);if(k)throw k;let _=[];if(p.length>0){const{data:$}=await window.supabase.from("kampagne").select("id, marke_id").in("id",p);_=($||[]).map(L=>L.marke_id).filter(Boolean)}let S=[];if(g.length>0){const{data:$}=await window.supabase.from("kooperationen").select("id, kampagne:kampagne_id(marke_id)").in("id",g);S=($||[]).map(L=>L.kampagne?.marke_id).filter(Boolean)}const E=Array.from(new Set([...h||[],..._,...S]));if(m.length){const $=m.map(L=>({kunde_id:v,unternehmen_id:L}));await window.supabase.from("kunde_unternehmen").upsert($,{onConflict:"kunde_id,unternehmen_id",ignoreDuplicates:!0})}if(E.length){const $=E.map(L=>({kunde_id:v,marke_id:L}));await window.supabase.from("kunde_marke").upsert($,{onConflict:"kunde_id,marke_id",ignoreDuplicates:!0})}y("success","Kunde aktualisiert und Zuordnungen gespeichert."),window.NotificationSystem?.show("success","Gespeichert"),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"kunden",id:v,action:"updated"}}))}catch(w){console.error("❌ Speichern fehlgeschlagen",w),y("error",w?.message||"Speichern fehlgeschlagen")}})}async showUnternehmenZuordnungModal(e){const t=document.createElement("div");t.className="modal-overlay",t.innerHTML=`
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h3>Unternehmen zuordnen</h3>
          <button id="close-modal" class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Unternehmen suchen</label>
            <input id="unternehmen-search" class="form-input" type="text" placeholder="Firmenname eingeben..." autocomplete="off" />
            <div id="unternehmen-dropdown" class="auto-suggest-dropdown" style="display: none;"></div>
          </div>
          <div id="selected-unternehmen" class="selected-items" style="margin-top: 10px;"></div>
        </div>
        <div class="modal-footer">
          <button id="save-zuordnung" class="primary-btn" disabled>Zuordnen</button>
          <button id="cancel-zuordnung" class="secondary-btn">Abbrechen</button>
        </div>
      </div>
    `,document.body.appendChild(t);const n=t.querySelector("#unternehmen-search"),a=t.querySelector("#unternehmen-dropdown"),r=t.querySelector("#selected-unternehmen"),i=t.querySelector("#save-zuordnung");let s=null,o;n.addEventListener("input",u=>{clearTimeout(o),o=setTimeout(async()=>{const d=u.target.value.trim();if(d.length<2){a.style.display="none";return}try{const{data:c,error:m}=await window.supabase.from("unternehmen").select("id, firmenname").ilike("firmenname",`%${d}%`).order("firmenname").limit(10);if(m)throw m;c&&c.length>0?(a.innerHTML=c.map(h=>`
              <div class="dropdown-item" data-id="${h.id}" data-name="${h.firmenname}">
                <div class="dropdown-item-main">${window.validatorSystem.sanitizeHtml(h.firmenname)}</div>
              </div>
            `).join(""),a.style.display="block"):(a.innerHTML='<div class="dropdown-item no-results">Keine Unternehmen gefunden</div>',a.style.display="block")}catch(c){console.error("❌ Unternehmen-Suche fehlgeschlagen",c),a.innerHTML='<div class="dropdown-item no-results">Fehler bei der Suche</div>',a.style.display="block"}},300)}),a.addEventListener("click",u=>{const d=u.target.closest(".dropdown-item[data-id]");d&&(s={id:d.dataset.id,name:d.dataset.name},r.innerHTML=`
        <div class="selected-item">
          <span class="selected-item-name">${window.validatorSystem.sanitizeHtml(s.name)}</span>
          <button type="button" class="selected-item-remove">&times;</button>
        </div>
      `,n.value="",a.style.display="none",i.disabled=!1)}),r.addEventListener("click",u=>{u.target.classList.contains("selected-item-remove")&&(s=null,r.innerHTML="",i.disabled=!0)}),i.addEventListener("click",async()=>{if(s)try{const{error:u}=await window.supabase.from("kunde_unternehmen").insert({kunde_id:e,unternehmen_id:s.id});if(u)throw u;window.NotificationSystem?.show("success","Unternehmen erfolgreich zugeordnet"),t.remove(),await this.load(),await this.render(),this.bind()}catch(u){console.error("❌ Zuordnung fehlgeschlagen",u),window.NotificationSystem?.show("error","Zuordnung fehlgeschlagen: "+u.message)}});const l=()=>t.remove();t.querySelector("#close-modal").onclick=l,t.querySelector("#cancel-zuordnung").onclick=l,t.addEventListener("click",u=>{u.target===t&&l()}),setTimeout(()=>n.focus(),100)}destroy(){window.setContentSafely("")}}const Le=new jt;class Gt{constructor(){this.userId=null,this.user=null,this.assignments={unternehmen:[],marken:[]}}async init(e){if(this.userId=e,await this.load(),window.breadcrumbSystem&&this.user){const t=this.user.name||"Details";window.breadcrumbSystem.updateBreadcrumb([{label:"Kunden",url:"/admin/kunden",clickable:!0},{label:t,url:`/admin/kunden/${this.userId}`,clickable:!1}])}await this.render(),this.bind()}async load(){try{const[{data:e},{data:t},{data:n}]=await Promise.all([window.supabase.from("benutzer").select("*").eq("id",this.userId).single(),window.supabase.from("kunde_unternehmen").select("unternehmen:unternehmen_id(id, firmenname)").eq("kunde_id",this.userId),window.supabase.from("kunde_marke").select("marke:marke_id(id, markenname)").eq("kunde_id",this.userId)]);this.user=e||{},this.assignments.unternehmen=(t||[]).map(a=>a.unternehmen).filter(Boolean),this.assignments.marken=(n||[]).map(a=>a.marke).filter(Boolean)}catch(e){console.error("❌ Fehler beim Laden Kunden-Details:",e)}}renderList(e,t){if(!e||e.length===0)return'<div class="empty-state"><p>Keine Einträge</p></div>';const n=t==="unternehmen"?"Unternehmen":"Marke",a=t==="unternehmen"?"firmenname":"markenname";return`
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Erstellt</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            ${e.map(r=>{const i=r[a]||r.name||r.id,s=r.created_at?new Date(r.created_at).toLocaleDateString("de-DE"):"—";return`
                <tr>
                  <td>
                    <a href="/${t}/${r.id}" onclick="event.preventDefault(); window.navigateTo('/${t}/${r.id}')" class="table-link">
                      ${window.validatorSystem.sanitizeHtml(i)}
                    </a>
                  </td>
                  <td>${s}</td>
                  <td>
                    ${window.ActionsDropdown?.createGenericActions(t,r.id,[{action:"remove",icon:"icon-trash",label:`${n}-Zuordnung entfernen`}])||""}
                  </td>
                </tr>`}).join("")}
          </tbody>
        </table>
      </div>`}async render(){const e=`
      <div class="kunden-detail">
        <div class="page-header">
        <div class="page-header-left">
          <h1>Kunde: ${window.validatorSystem.sanitizeHtml(this.user?.name||"-")}</h1>
          <p>Stammdaten und Zuordnungen</p>
        </div>
        <div class="page-header-right">
          <button class="secondary-btn" id="btn-back-kunden">Kunden Übersicht</button>
        </div>
      </div>

      <div class="content-section">
        <div class="tab-navigation">
          <button class="tab-button active" data-tab="stammdaten">Stammdaten</button>
          <button class="tab-button" data-tab="unternehmen">Unternehmen <span class="tab-count">${this.assignments.unternehmen.length}</span></button>
          <button class="tab-button" data-tab="marken">Marken <span class="tab-count">${this.assignments.marken.length}</span></button>
        </div>

        <div class="tab-content">
          <div class="tab-pane active" id="tab-stammdaten">
            <div class="detail-section">
              <h2>Benutzer-Status</h2>
              <div class="data-table-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th style="width:120px; text-align:right;">Aktiv</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <div>
                          <strong>Benutzer freigeschaltet</strong>
                          <div class="form-help" style="margin-top: 4px;">
                            ${this.user?.freigeschaltet?"Dieser Benutzer ist freigeschaltet.":"Dieser Benutzer ist gesperrt oder wartet auf Freischaltung."}
                          </div>
                        </div>
                      </td>
                      <td style="text-align:right;">
                        <label class="toggle-label" style="justify-content:flex-end;">
                          <span class="toggle-switch">
                            <input type="checkbox" id="freigeschaltet-toggle" ${this.user?.freigeschaltet?"checked":""}>
                            <span class="toggle-slider"></span>
                          </span>
                        </label>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="detail-section">
              <h2>Rolle</h2>
              <div class="data-table-container">
                <table class="data-table">
                  <thead>
                    <tr><th>Rolle</th><th>Unterrolle</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>${window.validatorSystem.sanitizeHtml(this.user?.rolle||"-")}</td>
                      <td>${window.validatorSystem.sanitizeHtml(this.user?.unterrolle||"-")}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div class="tab-pane" id="tab-unternehmen">
            <div class="detail-section">
              <div class="section-header">
                <h2>Unternehmen</h2>
                <button class="primary-btn" id="btn-add-unternehmen">Unternehmen hinzufügen</button>
              </div>
              ${this.renderList(this.assignments.unternehmen,"unternehmen")}
            </div>
          </div>

          <div class="tab-pane" id="tab-marken">
            <div class="detail-section">
              <div class="section-header">
                <h2>Marken</h2>
                <button class="primary-btn" id="btn-add-marke">Marke hinzufügen</button>
              </div>
              ${this.renderList(this.assignments.marken,"marke")}
            </div>
          </div>
        </div>
      </div>
      </div>
    `;window.setContentSafely(window.content,e)}async removeZuordnung(e,t){const n=this.kundeId;if(confirm("Möchten Sie die Zuordnung wirklich entfernen?"))try{let a,r;if(t==="unternehmen")a="kunde_unternehmen",r="Fehler beim Entfernen der Unternehmen-Zuordnung";else if(t==="marke")a="kunde_marke",r="Fehler beim Entfernen der Marken-Zuordnung";else throw new Error("Unbekannter Typ");const{error:i}=await window.supabase.from(a).delete().eq("kunde_id",n).eq(`${t}_id`,e);if(i)throw i;window.notificationSystem?.showSuccess(`${t==="unternehmen"?"Unternehmen":"Marke"}-Zuordnung erfolgreich entfernt!`),await this.load()}catch(a){console.error(`❌ ${errorMessage}:`,a),window.notificationSystem?.showError(`${errorMessage}: ${a.message}`)}}bind(){this.clickHandler&&document.removeEventListener("click",this.clickHandler),this.changeHandler&&document.removeEventListener("change",this.changeHandler),this.clickHandler=e=>{if(e.target&&e.target.id==="btn-back-kunden"){e.preventDefault(),window.navigateTo("/admin/kunden");return}if(e.target&&e.target.id==="btn-add-unternehmen"){e.preventDefault(),this.showUnternehmenZuordnungModal();return}if(e.target&&e.target.id==="btn-add-marke"){e.preventDefault(),this.showMarkeZuordnungModal();return}const t=e.target.closest(".tab-button");if(t){e.preventDefault(),document.querySelectorAll(".tab-button").forEach(a=>a.classList.remove("active")),t.classList.add("active"),document.querySelectorAll(".tab-pane").forEach(a=>a.classList.remove("active"));const n=document.getElementById(`tab-${t.dataset.tab}`);n&&n.classList.add("active")}},this.changeHandler=async e=>{if(e.target&&e.target.id==="freigeschaltet-toggle"){const t=e.target.checked;try{const n={freigeschaltet:t};t||(n.rolle="pending",n.unterrolle="awaiting_approval",n.zugriffsrechte=null);const{error:a}=await window.supabase.from("benutzer").update(n).eq("id",this.userId);if(a)throw a;this.user.freigeschaltet=t,n.rolle&&(this.user.rolle=n.rolle),n.unterrolle&&(this.user.unterrolle=n.unterrolle),window.NotificationSystem?.show("success",t?"Kunde freigeschaltet":"Kunde gesperrt")}catch(n){console.error("❌ Update fehlgeschlagen",n),e.target.checked=!t,window.NotificationSystem?.show("error","Update fehlgeschlagen")}}},document.addEventListener("click",this.clickHandler),document.addEventListener("change",this.changeHandler)}async showUnternehmenZuordnungModal(){document.querySelectorAll(".modal-overlay").forEach(l=>l.remove());const e=document.createElement("div");e.className="modal-overlay",e.innerHTML=`
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h3>Unternehmen zuordnen</h3>
          <button id="close-modal" class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Unternehmen suchen</label>
            <input id="unternehmen-search" class="form-input" type="text" placeholder="Firmenname eingeben..." autocomplete="off" />
            <div id="unternehmen-dropdown" class="auto-suggest-dropdown" style="display: none;"></div>
          </div>
          <div id="selected-unternehmen" class="selected-items" style="margin-top: 10px;"></div>
        </div>
        <div class="modal-footer">
          <button id="save-zuordnung" class="primary-btn" disabled>Zuordnen</button>
          <button id="cancel-zuordnung" class="secondary-btn">Abbrechen</button>
        </div>
      </div>
    `,document.body.appendChild(e);const t=e.querySelector("#unternehmen-search"),n=e.querySelector("#unternehmen-dropdown"),a=e.querySelector("#selected-unternehmen"),r=e.querySelector("#save-zuordnung");let i=null,s;t.addEventListener("input",l=>{clearTimeout(s),s=setTimeout(async()=>{const u=l.target.value.trim();if(u.length<2){n.style.display="none";return}try{const{data:d,error:c}=await window.supabase.from("unternehmen").select("id, firmenname").ilike("firmenname",`%${u}%`).order("firmenname").limit(10);if(c)throw c;d&&d.length>0?(n.innerHTML=d.map(m=>`
              <div class="dropdown-item" data-id="${m.id}" data-name="${m.firmenname}">
                <div class="dropdown-item-main">${window.validatorSystem.sanitizeHtml(m.firmenname)}</div>
              </div>
            `).join(""),n.style.display="block"):(n.innerHTML='<div class="dropdown-item no-results">Keine Unternehmen gefunden</div>',n.style.display="block")}catch(d){console.error("❌ Unternehmen-Suche fehlgeschlagen",d),n.innerHTML='<div class="dropdown-item no-results">Fehler bei der Suche</div>',n.style.display="block"}},300)}),n.addEventListener("click",l=>{const u=l.target.closest(".dropdown-item[data-id]");u&&(i={id:u.dataset.id,name:u.dataset.name},a.innerHTML=`
        <div class="selected-item">
          <span class="selected-item-name">${window.validatorSystem.sanitizeHtml(i.name)}</span>
          <button type="button" class="selected-item-remove">&times;</button>
        </div>
      `,t.value="",n.style.display="none",r.disabled=!1)}),a.addEventListener("click",l=>{l.target.classList.contains("selected-item-remove")&&(i=null,a.innerHTML="",r.disabled=!0)}),r.addEventListener("click",async()=>{if(i)try{const{error:l}=await window.supabase.from("kunde_unternehmen").insert({kunde_id:this.userId,unternehmen_id:i.id});if(l){if(l.code==="23505"){window.NotificationSystem?.show("warning","Unternehmen ist bereits zugeordnet"),e.remove();return}throw l}window.NotificationSystem?.show("success","Unternehmen erfolgreich zugeordnet"),e.remove(),await this.load(),await this.render(),this.bind()}catch(l){console.error("❌ Zuordnung fehlgeschlagen",l),window.NotificationSystem?.show("error","Zuordnung fehlgeschlagen: "+l.message)}});const o=()=>e.remove();e.querySelector("#close-modal").onclick=o,e.querySelector("#cancel-zuordnung").onclick=o,e.addEventListener("click",l=>{l.target===e&&o()}),setTimeout(()=>t.focus(),100)}async showMarkeZuordnungModal(){document.querySelectorAll(".modal-overlay").forEach(l=>l.remove());const e=document.createElement("div");e.className="modal-overlay",e.innerHTML=`
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h3>Marke zuordnen</h3>
          <button id="close-modal" class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Marke suchen</label>
            <input id="marke-search" class="form-input" type="text" placeholder="Markenname eingeben..." autocomplete="off" />
            <div id="marke-dropdown" class="auto-suggest-dropdown" style="display: none;"></div>
          </div>
          <div id="selected-marke" class="selected-items" style="margin-top: 10px;"></div>
        </div>
        <div class="modal-footer">
          <button id="save-zuordnung" class="primary-btn" disabled>Zuordnen</button>
          <button id="cancel-zuordnung" class="secondary-btn">Abbrechen</button>
        </div>
      </div>
    `,document.body.appendChild(e);const t=e.querySelector("#marke-search"),n=e.querySelector("#marke-dropdown"),a=e.querySelector("#selected-marke"),r=e.querySelector("#save-zuordnung");let i=null,s;t.addEventListener("input",l=>{clearTimeout(s),s=setTimeout(async()=>{const u=l.target.value.trim();if(u.length<2){n.style.display="none";return}try{const{data:d,error:c}=await window.supabase.from("marke").select("id, markenname").ilike("markenname",`%${u}%`).order("markenname").limit(10);if(c)throw c;d&&d.length>0?(n.innerHTML=d.map(m=>`
              <div class="dropdown-item" data-id="${m.id}" data-name="${m.markenname}">
                <div class="dropdown-item-main">${window.validatorSystem.sanitizeHtml(m.markenname)}</div>
              </div>
            `).join(""),n.style.display="block"):(n.innerHTML='<div class="dropdown-item no-results">Keine Marken gefunden</div>',n.style.display="block")}catch(d){console.error("❌ Marken-Suche fehlgeschlagen",d),n.innerHTML='<div class="dropdown-item no-results">Fehler bei der Suche</div>',n.style.display="block"}},300)}),n.addEventListener("click",l=>{const u=l.target.closest(".dropdown-item[data-id]");u&&(i={id:u.dataset.id,name:u.dataset.name},a.innerHTML=`
        <div class="selected-item">
          <span class="selected-item-name">${window.validatorSystem.sanitizeHtml(i.name)}</span>
          <button type="button" class="selected-item-remove">&times;</button>
        </div>
      `,t.value="",n.style.display="none",r.disabled=!1)}),a.addEventListener("click",l=>{l.target.classList.contains("selected-item-remove")&&(i=null,a.innerHTML="",r.disabled=!0)}),r.addEventListener("click",async()=>{if(i)try{const{error:l}=await window.supabase.from("kunde_marke").insert({kunde_id:this.userId,marke_id:i.id});if(l){if(l.code==="23505"){window.NotificationSystem?.show("warning","Marke ist bereits zugeordnet"),e.remove();return}throw l}window.NotificationSystem?.show("success","Marke erfolgreich zugeordnet"),e.remove(),await this.load(),await this.render(),this.bind()}catch(l){console.error("❌ Zuordnung fehlgeschlagen",l),window.NotificationSystem?.show("error","Zuordnung fehlgeschlagen: "+l.message)}});const o=()=>e.remove();e.querySelector("#close-modal").onclick=o,e.querySelector("#cancel-zuordnung").onclick=o,e.addEventListener("click",l=>{l.target===e&&o()}),setTimeout(()=>t.focus(),100)}destroy(){this.clickHandler&&document.removeEventListener("click",this.clickHandler),this.changeHandler&&document.removeEventListener("change",this.changeHandler),document.querySelectorAll(".modal-overlay").forEach(e=>e.remove()),window.setContentSafely("")}}const Zt=new Gt;class Wt{constructor(){this.kampagnen=[]}async init(){window.setHeadline("Meine Kampagnen"),window.breadcrumbSystem&&window.breadcrumbSystem.updateBreadcrumb([{label:"Meine Kampagnen",url:"/kunden",clickable:!1}]),await this.load(),await this.render(),this.bind()}async load(){try{const{data:e,error:t}=await window.supabase.from("kampagne").select("id, kampagnenname, unternehmen:unternehmen_id(firmenname), marke:marke_id(markenname), status:status_id(name)").order("created_at",{ascending:!1});if(t)throw t;this.kampagnen=e||[]}catch(e){console.error("❌ Fehler beim Laden der Kampagnen (Kunden):",e),this.kampagnen=[]}}async render(){const t=`
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Kampagne</th>
              <th>Unternehmen</th>
              <th>Marke</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${(this.kampagnen||[]).map(n=>`
      <tr>
        <td><a href="/kunden-kampagne/${n.id}" onclick="event.preventDefault(); window.navigateTo('/kunden-kampagne/${n.id}')">${window.validatorSystem.sanitizeHtml(n.kampagnenname||n.id)}</a></td>
        <td>${window.validatorSystem.sanitizeHtml(n.unternehmen?.firmenname||"—")}</td>
        <td>${window.validatorSystem.sanitizeHtml(n.marke?.markenname||"—")}</td>
        <td>${window.validatorSystem.sanitizeHtml(n.status?.name||"—")}</td>
      </tr>
    `).join("")||'<tr><td colspan="4" class="loading">Keine Kampagnen</td></tr>'}</tbody>
        </table>
      </div>
    `;window.setContentSafely(window.content,t)}bind(){}destroy(){window.setContentSafely("")}}const Yt=new Wt;class Jt{constructor(){this.kampagneId=null,this.kampagne=null,this.koops=[]}async init(e){this.kampagneId=e,await this.load(),window.breadcrumbSystem&&this.kampagne&&window.breadcrumbSystem.updateBreadcrumb([{label:"Meine Kampagnen",url:"/kunden",clickable:!0},{label:this.kampagne.kampagnenname||"Kampagne",url:`/kunden-kampagne/${this.kampagneId}`,clickable:!1}]),await this.render(),this.bind()}async load(){try{const[{data:e},{data:t}]=await Promise.all([window.supabase.from("kampagne").select("id, kampagnenname, unternehmen:unternehmen_id(firmenname), marke:marke_id(markenname)").eq("id",this.kampagneId).single(),window.supabase.from("kooperationen").select("id, name, status").eq("kampagne_id",this.kampagneId).order("created_at",{ascending:!1})]);this.kampagne=e||null,this.koops=t||[]}catch(e){console.error("❌ Fehler beim Laden Kampagne/Kooperationen (Kunden):",e),this.kampagne=null,this.koops=[]}}async render(){const e=(this.koops||[]).map(n=>`
      <tr>
        <td><a href="/kunden-kooperation/${n.id}" onclick="event.preventDefault(); window.navigateTo('/kunden-kooperation/${n.id}')">${window.validatorSystem.sanitizeHtml(n.name||n.id)}</a></td>
        <td><span class="status-badge status-${(n.status||"").toLowerCase().replace(/\s+/g,"-")}">${window.validatorSystem.sanitizeHtml(n.status||"—")}</span></td>
      </tr>
    `).join(""),t=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>${window.validatorSystem.sanitizeHtml(this.kampagne?.kampagnenname||"-")}</h1>
          <p>${window.validatorSystem.sanitizeHtml(this.kampagne?.unternehmen?.firmenname||"—")} · ${window.validatorSystem.sanitizeHtml(this.kampagne?.marke?.markenname||"—")}</p>
        </div>
        <div class="page-header-right">
          <button class="secondary-btn" id="btn-back-kunden">Zurück</button>
        </div>
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead><tr><th>Kooperation</th><th>Status</th></tr></thead>
          <tbody>${e||'<tr><td colspan="2" class="loading">Keine Kooperationen</td></tr>'}</tbody>
        </table>
      </div>
    `;window.setContentSafely(window.content,t)}bind(){document.addEventListener("click",e=>{e.target&&e.target.id==="btn-back-kunden"&&(e.preventDefault(),window.navigateTo("/kunden"))})}destroy(){window.setContentSafely("")}}const Qt=new Jt;class Xt{constructor(){this.koopId=null,this.koop=null,this.uploads=[],this.videos=[]}async init(e){if(this.koopId=e,await this.load(),window.breadcrumbSystem&&this.koop){const t=this.koop.kampagne?.kampagnenname||"Kampagne";window.breadcrumbSystem.updateBreadcrumb([{label:"Meine Kampagnen",url:"/kunden",clickable:!0},{label:t,url:"#",clickable:!1},{label:this.koop.name||"Kooperation",url:`/kunden-kooperation/${this.koopId}`,clickable:!1}])}await this.render(),this.bind()}async load(){try{const[{data:e},{data:t},{data:n}]=await Promise.all([window.supabase.from("kooperationen").select("id, name, status, kampagne:kampagne_id(kampagnenname)").eq("id",this.koopId).single(),window.supabase.from("kooperation_uploads").select("id, filename, filetype, filesize, created_at, storage_path").eq("kooperation_id",this.koopId).order("created_at",{ascending:!1}),window.supabase.from("kooperation_videos").select("id, titel, content_art, status, position, created_at").eq("kooperation_id",this.koopId).order("position",{ascending:!0})]);if(this.koop=e||null,this.uploads=t||[],this.videos=n||[],this.videos.length>0){const a=this.videos.map(i=>i.id),{data:r}=await window.supabase.from("kooperation_video_asset").select("id, video_id, file_url, version_number, is_current, description, created_at").in("video_id",a).order("version_number",{ascending:!1});this.videos.forEach(i=>{i.assets=(r||[]).filter(s=>s.video_id===i.id)})}}catch(e){console.error("❌ Fehler beim Laden Kooperation/Uploads/Videos (Kunden):",e),this.koop=null,this.uploads=[],this.videos=[]}}formatSize(e){const t=Number(e||0);return t<1024?`${t} B`:t<1024*1024?`${(t/1024).toFixed(1)} KB`:t<1024*1024*1024?`${(t/1024/1024).toFixed(1)} MB`:`${(t/1024/1024/1024).toFixed(1)} GB`}async render(){const e=i=>window.validatorSystem?.sanitizeHtml?.(i)??i,t=i=>i?new Date(i).toLocaleString("de-DE"):"-",n=(this.uploads||[]).map(i=>`
      <tr>
        <td>${e(i.filename||i.id)}</td>
        <td>${e(i.filetype||"—")}</td>
        <td style="text-align:right;">${this.formatSize(i.filesize)}</td>
        <td>${new Date(i.created_at).toLocaleString("de-DE")}</td>
        <td style="text-align:right;">
          <a href="#" class="secondary-btn small" data-action="download" data-path="${i.storage_path}" data-id="${i.id}">Download</a>
        </td>
      </tr>
    `).join(""),a=this.videos.length>0?this.videos.map(i=>this.renderVideoSection(i,e,t)).join(""):'<p class="empty-state">Keine Videos vorhanden.</p>',r=`
      <div class="page-header">
        <div class="page-header-left">
          <h1>${e(this.koop?.name||"-")}</h1>
          <p>${e(this.koop?.kampagne?.kampagnenname||"—")}</p>
        </div>
        <div class="page-header-right">
          <button class="secondary-btn" id="btn-back-kampagne">Zurück</button>
        </div>
      </div>

      ${this.videos.length>0?`
        <div class="detail-card" style="margin-bottom:24px;">
          <h2>Videos</h2>
          ${a}
        </div>
      `:""}

      <div class="detail-card">
        <h2>Uploads</h2>
        <div class="data-table-container">
          <table class="data-table">
            <thead><tr><th>Datei</th><th>Typ</th><th style="text-align:right;">Größe</th><th>Hochgeladen</th><th style="text-align:right;">Aktion</th></tr></thead>
            <tbody>${n||'<tr><td colspan="5" class="loading">Keine Uploads</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    `;window.setContentSafely(window.content,r)}renderVideoSection(e,t,n){const a=e.assets||[];return a.find(r=>r.is_current)||a[0],`
      <div class="video-section" style="margin-bottom:24px;padding-bottom:24px;border-bottom:1px solid var(--border-primary);">
        <h3>${t(e.titel||"Video #"+e.id)}</h3>
        <div style="display:flex;gap:8px;margin-bottom:12px;">
          <span class="status-badge status-${(e.status||"produktion").toLowerCase()}">${e.status==="abgeschlossen"?"Abgeschlossen":"Produktion"}</span>
          ${e.content_art?`<span class="badge">${t(e.content_art)}</span>`:""}
        </div>
        
        ${a.length>0?this.renderAssetVersionsTimeline(a,t,n):'<p class="empty-state">Keine Assets vorhanden.</p>'}
      </div>
    `}renderAssetVersionsTimeline(e,t,n){return`
      <div class="asset-versions-timeline">
        ${[...e].sort((r,i)=>(i.version_number||0)-(r.version_number||0)).map(r=>`
          <div class="timeline-item ${r.is_current?"is-current":""}">
            <div class="timeline-marker">${r.version_number||1}</div>
            <div class="timeline-content">
              <h5>
                Version ${r.version_number||1}
                ${r.is_current?'<span style="padding:2px 8px;border-radius:4px;font-size:11px;background:var(--color-success-light);color:var(--color-success-dark);font-weight:600;">Aktuell</span>':""}
              </h5>
              ${r.description?`<p>${t(r.description)}</p>`:""}
              <small>${n(r.created_at)}</small>
              <a href="${r.file_url}" target="_blank" rel="noopener" class="link-btn">
                Video ansehen
              </a>
            </div>
          </div>
        `).join("")}
      </div>
    `}bind(){document.addEventListener("click",async e=>{if(e.target&&e.target.id==="btn-back-kampagne"){e.preventDefault(),window.history.back();return}const t=e.target.closest('[data-action="download"]');if(t){e.preventDefault();const n=t.dataset.path;try{const{data:a,error:r}=await window.supabase.storage?.from("kooperation_uploads")?.createSignedUrl(n,600);!r&&a?.signedUrl?window.open(a.signedUrl,"_blank"):window.open(n,"_blank")}catch(a){console.error("❌ Download fehlgeschlagen",a),window.NotificationSystem?.show("error","Download fehlgeschlagen")}}})}destroy(){window.setContentSafely("")}}const en=new Xt;class tn{constructor(){this.currentEntityType=null,this.currentListInstance=null,this.boundEventListeners=new Set}init(){console.log("🔧 BulkActionSystem: Initialisiere..."),this.bindGlobalEvents()}registerList(e,t){console.log(`🔧 BulkActionSystem: Registriere ${e} Liste`),this.currentEntityType=e,this.currentListInstance=t,console.log(`✅ BulkActionSystem: ${e} als aktive Liste gesetzt`,{hasDeleteMethod:typeof t.showDeleteSelectedConfirmation=="function",currentPath:window.location.pathname})}updateActiveList(){const e=window.location.pathname;console.log(`🔧 BulkActionSystem: Prüfe aktuelle Route: ${e}`);const t=e.split("/").filter(n=>n);if(t.length>0){const n=t[0],a=`${n}List`;if(window[a])return this.currentEntityType=n,this.currentListInstance=window[a],console.log(`✅ BulkActionSystem: ${n} automatisch erkannt und gesetzt`),!0}return console.log("❌ BulkActionSystem: Keine passende Liste für aktuelle Route gefunden"),!1}bindGlobalEvents(){const e=n=>{n.target.id==="btn-deselect-all"&&(n.preventDefault(),this.handleDeselectAll())};document.addEventListener("click",e),this.boundEventListeners.add({element:document,type:"click",handler:e});const t=n=>{n.target.id==="btn-delete-selected"&&(n.preventDefault(),this.handleDeleteSelected())};document.addEventListener("click",t),this.boundEventListeners.add({element:document,type:"click",handler:t}),console.log("✅ BulkActionSystem: Globale Event-Listener registriert")}handleDeselectAll(){console.log("🔧 BulkActionSystem: Handle Deselect All"),this.currentListInstance||this.updateActiveList(),this.currentListInstance&&typeof this.currentListInstance.deselectAll=="function"?(console.log(`✅ BulkActionSystem: Rufe deselectAll() für ${this.currentEntityType} auf`),this.currentListInstance.deselectAll()):(console.log("⚠️ BulkActionSystem: Fallback - Generische Deselection"),this.genericDeselectAll())}handleDeleteSelected(){if(console.log("🔧 BulkActionSystem: Handle Delete Selected"),this.currentListInstance&&typeof this.currentListInstance.showDeleteSelectedConfirmation=="function"){console.log(`✅ BulkActionSystem: Rufe showDeleteSelectedConfirmation() für ${this.currentEntityType} auf`),this.currentListInstance.showDeleteSelectedConfirmation();return}if(!this.currentListInstance&&this.updateActiveList()&&this.currentListInstance&&typeof this.currentListInstance.showDeleteSelectedConfirmation=="function"){console.log(`✅ BulkActionSystem: Nach Update gefunden - rufe showDeleteSelectedConfirmation() für ${this.currentEntityType} auf`),this.currentListInstance.showDeleteSelectedConfirmation();return}console.log("⚠️ BulkActionSystem: Fallback - Generische Deletion"),this.genericDeleteSelected()}genericDeselectAll(){const e=this.detectCurrentEntityType();if(!e){console.log("❌ BulkActionSystem: Kann Entity-Type nicht erkennen");return}const t=this.getEntityConfig(e),n=document.querySelectorAll(t.checkboxSelector),a=document.getElementById(t.selectAllId);n.forEach(r=>{r.checked=!1}),a&&(a.checked=!1,a.indeterminate=!1),this.hideButtons(),console.log(`✅ BulkActionSystem: Generische Deselection für ${e} abgeschlossen`)}async genericDeleteSelected(){const e=this.detectCurrentEntityType();if(!e){console.log("❌ BulkActionSystem: Kann Entity-Type nicht erkennen");return}const t=this.getEntityConfig(e),n=document.querySelectorAll(`${t.checkboxSelector}:checked`);if(n.length===0){alert(`Keine ${t.displayName} ausgewählt.`);return}const a=n.length===1?`Möchten Sie ${t.displayName.slice(0,-1)} wirklich löschen?`:`Möchten Sie die ${n.length} ausgewählten ${t.displayName} wirklich löschen?`;window.confirmationModal?(await window.confirmationModal.open({title:"Löschvorgang bestätigen",message:a,confirmText:"Endgültig löschen",cancelText:"Abbrechen",danger:!0}))?.confirmed&&this.performGenericDelete(e,n):confirm(`${a}

Dieser Vorgang kann nicht rückgängig gemacht werden.`)&&this.performGenericDelete(e,n)}async performGenericDelete(e,t){const n=Array.from(t).map(r=>r.dataset.id),a=n.length;console.log(`🗑️ BulkActionSystem: Lösche ${a} ${e}...`),n.forEach(r=>{const i=document.querySelector(`tr[data-id="${r}"]`);i&&(i.style.opacity="0.5")});try{const r=await window.dataService.deleteEntities(e,n);if(r.success){const i=this.getEntityConfig(e);n.forEach(o=>{document.querySelector(`tr[data-id="${o}"]`)?.remove()}),alert(`✅ ${r.deletedCount} ${i.displayName} erfolgreich gelöscht.`),this.genericDeselectAll();const s=document.querySelector("tbody");s&&s.children.length===0&&this.currentListInstance&&typeof this.currentListInstance.loadAndRender=="function"&&await this.currentListInstance.loadAndRender(),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:e,action:"bulk-deleted",count:r.deletedCount}}))}else throw new Error(r.error||"Löschen fehlgeschlagen")}catch(r){n.forEach(i=>{const s=document.querySelector(`tr[data-id="${i}"]`);s&&(s.style.opacity="1")}),console.error("❌ BulkActionSystem: Fehler beim Löschen:",r),alert(`❌ Fehler beim Löschen: ${r.message}`),this.currentListInstance&&typeof this.currentListInstance.loadAndRender=="function"&&await this.currentListInstance.loadAndRender()}}detectCurrentEntityType(){const e=window.location.pathname.split("/").filter(n=>n);if(e.length>0){const n=e[0];if(["creator","unternehmen","kampagne","marke","auftrag","ansprechpartner","kooperation"].includes(n))return n}const t=["creator","unternehmen","kampagne","marke","auftrag","ansprechpartner","kooperation"];for(const n of t){const a=this.getEntityConfig(n);if(document.querySelectorAll(a.checkboxSelector).length>0)return console.log(`🔧 BulkActionSystem: Entity-Type ${n} aus Checkboxen erkannt`),n}return null}getEntityConfig(e){return{creator:{checkboxSelector:".creator-check",selectAllId:"select-all-creators",displayName:"Creator"},unternehmen:{checkboxSelector:".unternehmen-check",selectAllId:"select-all-unternehmen",displayName:"Unternehmen"},kampagne:{checkboxSelector:".kampagne-check",selectAllId:"select-all-kampagnen",displayName:"Kampagnen"},marke:{checkboxSelector:".marke-check",selectAllId:"select-all-marken",displayName:"Marken"},auftrag:{checkboxSelector:".auftrag-check",selectAllId:"select-all-auftraege",displayName:"Aufträge"},ansprechpartner:{checkboxSelector:".ansprechpartner-check",selectAllId:"select-all-ansprechpartner",displayName:"Ansprechpartner"},kooperation:{checkboxSelector:".kooperation-check",selectAllId:"select-all-kooperationen",displayName:"Kooperationen"}}[e]||{checkboxSelector:`.${e}-check`,selectAllId:`select-all-${e}`,displayName:e}}hideButtons(){const e=document.getElementById("selected-count"),t=document.getElementById("btn-deselect-all"),n=document.getElementById("btn-delete-selected");e&&(e.style.display="none"),t&&(t.style.display="none"),n&&(n.style.display="none")}isKunde(){return window.currentUser?.rolle==="kunde"}hideForKunden(){this.isKunde()&&(console.log("🔧 BulkActionSystem: Verstecke Bulk-Actions für Kunden"),this.hideButtons(),document.querySelectorAll('input[type="checkbox"][data-entity-id]').forEach(t=>{t.style.display="none"}))}destroy(){this.boundEventListeners.forEach(({element:e,type:t,handler:n})=>{e.removeEventListener(t,n)}),this.boundEventListeners.clear()}}const Fe=new tn;class nn{constructor(){this.notifications=[],this.unreadCount=0,this.pollIntervalMs=6e4,this._timer=null,this._initialized=!1}init(){this._initialized||(this._initialized=!0,this.bindUI(),this.refresh(!0),this.startPolling(),window.addEventListener("notificationsRefresh",()=>this.refresh()))}destroy(){this._timer&&clearInterval(this._timer),this._timer=null,this._initialized=!1}startPolling(){this._timer&&clearInterval(this._timer),this._timer=setInterval(()=>this.refresh(),this.pollIntervalMs)}bindUI(){const e=document.querySelector("#notificationBell, .notification-bell"),t=document.querySelector("#notificationDropdown, .notification-dropdown");if(!e||!t)return;const n=()=>{t.classList.toggle("show")};e.addEventListener("click",a=>{a.preventDefault(),n()}),document.addEventListener("click",a=>{!t.contains(a.target)&&!e.contains(a.target)&&t.classList.remove("show")})}async refresh(e=!1){try{if(!window.supabase||!window.currentUser?.id)return;const{data:t,error:n}=await window.supabase.from("notifications").select("id, user_id, type, entity, entity_id, title, message, created_at, read_at").eq("user_id",window.currentUser.id).order("created_at",{ascending:!1}).limit(20);if(n)throw n;this.notifications=t||[],this.unreadCount=(this.notifications||[]).filter(a=>!a.read_at).length,this.renderBadge(),this.renderDropdown(),!e&&this.unreadCount>0}catch(t){console.warn("⚠️ Notifications refresh failed",t)}}renderBadge(){const e=document.querySelector("#notificationBadge, .notification-badge");if(!e)return;const t=this.unreadCount;e.textContent=t>99?"99+":String(t||""),e.style.display=t>0?"":"none"}renderDropdown(){const e=document.querySelector("#notificationDropdown, .notification-dropdown");if(!e)return;const t=(this.notifications||[]).map(a=>{const r=this.getEntityUrl(a.entity,a.entity_id),i=new Date(a.created_at).toLocaleString("de-DE");return`
        <div class="notification-item ${a.read_at?"":"unread"}" data-id="${a.id}">
          <div class="notification-title">${this.escape(a.title||"Benachrichtigung")}</div>
          <div class="notification-message">${this.escape(a.message||"")}</div>
          <div class="notification-meta">
            <span class="notification-time">${i}</span>
            ${r?`<a href="${r}" data-route="${r}" class="notification-open">Öffnen</a>`:""}
          </div>
        </div>`}).join(""),n=`
      <div class="notification-actions">
        <button class="btn-link" id="markAllRead">Alle als gelesen</button>
      </div>`;e.innerHTML=`<div class="notification-list">${t||'<div class="notification-empty">Keine Benachrichtigungen</div>'}</div>${n}`,e.querySelector("#markAllRead")?.addEventListener("click",async a=>{a.preventDefault(),await this.markAllAsRead(),this.refresh()}),e.querySelectorAll(".notification-open").forEach(a=>{a.addEventListener("click",async r=>{r.preventDefault();const s=r.target.closest(".notification-item")?.dataset?.id;s&&await this.markAsRead(s);const o=a.getAttribute("data-route");o&&window.navigateTo&&window.navigateTo(o),e.classList.remove("show")})})}getEntityUrl(e,t){return!e||!t?"":{kampagne:`/kampagne/${t}`,kooperation:`/kooperation/${t}`,briefing:`/briefing/${t}`,auftrag:`/auftrag/${t}`}[e]||""}async markAsRead(e){try{if(!window.supabase)return;await window.supabase.from("notifications").update({read_at:new Date().toISOString()}).eq("id",e)}catch(t){console.warn("⚠️ markAsRead failed",t)}}async markAllAsRead(){try{if(!window.supabase||!window.currentUser?.id)return;await window.supabase.from("notifications").update({read_at:new Date().toISOString()}).is("read_at",null).eq("user_id",window.currentUser.id)}catch(e){console.warn("⚠️ markAllAsRead failed",e)}}async pushNotification(e,t){try{if(!window.supabase||!e)return;const n={user_id:e,type:t?.type||"info",entity:t?.entity||null,entity_id:t?.entityId||null,title:t?.title||"Benachrichtigung",message:t?.message||"",created_at:new Date().toISOString()};await window.supabase.from("notifications").insert(n)}catch(n){console.warn("⚠️ pushNotification failed",n)}}escape(e){if(!e)return"";const t=document.createElement("div");return t.textContent=e,t.innerHTML}}const Me=new nn;class an{constructor(){this.data={stats:{},deadlines:[],recentActivity:[],alerts:[]},this.refreshInterval=null}async init(){if(window.setHeadline("Dashboard"),window.breadcrumbSystem&&window.breadcrumbSystem.updateBreadcrumb([{label:"Dashboard",url:"/dashboard",clickable:!1}]),window.currentUser?.rolle==="kunde"){await this.renderKundenDashboard();return}await this.loadDashboardData(),await this.render(),this.setupEventListeners(),this.startAutoRefresh()}async loadDashboardData(){try{await Promise.all([this.loadStats(),this.loadUpcomingDeadlines(),this.loadRecentActivity(),this.loadAlerts()])}catch(e){console.error("❌ Fehler beim Laden der Dashboard-Daten:",e)}}async loadStats(){try{if(!window.supabase){this.data.stats=this.getMockStats();return}const[{data:e},{data:t},{data:n},{data:a},{data:r},{data:i}]=await Promise.all([window.supabase.from("kampagne").select("id, status_id, deadline"),window.supabase.from("auftrag").select("id, status, ende, re_faelligkeit"),window.supabase.from("briefings").select("id, status, deadline"),window.supabase.from("kooperationen").select("id, status, content_deadline, skript_deadline"),window.supabase.from("creator").select("id"),window.supabase.from("rechnungen").select("id, status, zahlungsziel")]);this.data.stats={kampagnen:{total:e?.length||0,aktiv:e?.filter(s=>s.status_id==="active")?.length||0,ueberfaellig:e?.filter(s=>s.deadline&&new Date(s.deadline)<new Date)?.length||0},auftraege:{total:t?.length||0,aktiv:t?.filter(s=>s.status==="aktiv")?.length||0,ueberfaellig:t?.filter(s=>s.ende&&new Date(s.ende)<new Date)?.length||0},briefings:{total:n?.length||0,offen:n?.filter(s=>s.status!=="completed")?.length||0,ueberfaellig:n?.filter(s=>s.deadline&&new Date(s.deadline)<new Date)?.length||0},kooperationen:{total:a?.length||0,aktiv:a?.filter(s=>s.status==="active")?.length||0},creator:{total:r?.length||0},rechnungen:{total:i?.length||0,offen:i?.filter(s=>s.status!=="bezahlt")?.length||0,ueberfaellig:i?.filter(s=>s.zahlungsziel&&new Date(s.zahlungsziel)<new Date)?.length||0}}}catch(e){console.error("❌ Fehler beim Laden der Statistiken:",e),this.data.stats=this.getMockStats()}}async loadUpcomingDeadlines(){try{if(!window.supabase){this.data.deadlines=this.getMockDeadlines();return}const e=new Date;e.setDate(e.getDate()+7);const t=e.toISOString().split("T")[0],n=window.currentUser?.rolle==="admin";let a=[],r=[];if(!n)try{const{data:g}=await window.supabase.from("kampagne_mitarbeiter").select("kampagne_id").eq("mitarbeiter_id",window.currentUser?.id),b=(g||[]).map(k=>k.kampagne_id).filter(Boolean),{data:y}=await window.supabase.from("marke_mitarbeiter").select("marke_id").eq("mitarbeiter_id",window.currentUser?.id),w=(y||[]).map(k=>k.marke_id).filter(Boolean);let v=[];if(w.length>0){const{data:k}=await window.supabase.from("kampagne").select("id").in("marke_id",w);v=(k||[]).map(_=>_.id).filter(Boolean)}if(a=[...new Set([...b,...v])],a.length>0){const{data:k}=await window.supabase.from("kooperationen").select("id").in("kampagne_id",a);r=(k||[]).map(_=>_.id)}console.log(`🔍 DASHBOARD: Mitarbeiter ${window.currentUser?.id} hat Zugriff auf:`,{direkteKampagnen:b.length,markenKampagnen:v.length,gesamtKampagnen:a.length,kooperationen:r.length})}catch(g){console.error("❌ Fehler beim Laden der Zuordnungen für Dashboard:",g)}let i=window.supabase.from("kampagne").select("id, kampagnenname, deadline, unternehmen:unternehmen_id(firmenname)").lte("deadline",t).gte("deadline",new Date().toISOString().split("T")[0]),s=window.supabase.from("briefings").select("id, product_service_offer, deadline, unternehmen:unternehmen_id(firmenname)").lte("deadline",t).gte("deadline",new Date().toISOString().split("T")[0]),o=window.supabase.from("kooperationen").select("id, name, skript_deadline, creator:creator_id(vorname, nachname)").lte("skript_deadline",t).gte("skript_deadline",new Date().toISOString().split("T")[0]),l=window.supabase.from("kooperationen").select("id, name, content_deadline, creator:creator_id(vorname, nachname)").lte("content_deadline",t).gte("content_deadline",new Date().toISOString().split("T")[0]),u=window.supabase.from("rechnungen").select("id, rechnungs_nr, zahlungsziel, unternehmen:unternehmen_id(firmenname)").lte("zahlungsziel",t).gte("zahlungsziel",new Date().toISOString().split("T")[0]);n||(a.length>0?(i=i.in("id",a),s=s.in("kampagne_id",a),u=u.in("kampagne_id",a)):(i=i.eq("id","00000000-0000-0000-0000-000000000000"),s=s.eq("kampagne_id","00000000-0000-0000-0000-000000000000"),u=u.eq("kampagne_id","00000000-0000-0000-0000-000000000000")),r.length>0?(o=o.in("id",r),l=l.in("id",r)):(o=o.eq("id","00000000-0000-0000-0000-000000000000"),l=l.eq("id","00000000-0000-0000-0000-000000000000")));const[{data:d},{data:c},{data:m},{data:h},{data:p}]=await Promise.all([i,s,o,l,u]);this.data.deadlines=[...d?.map(g=>({type:"kampagne",id:g.id,title:g.kampagnenname,subtitle:g.unternehmen?.firmenname,deadline:g.deadline,priority:this.getDeadlinePriority(g.deadline),url:`/kampagne/${g.id}`}))||[],...c?.map(g=>({type:"briefing",id:g.id,title:g.product_service_offer,subtitle:g.unternehmen?.firmenname,deadline:g.deadline,priority:this.getDeadlinePriority(g.deadline),url:`/briefing/${g.id}`}))||[],...m?.map(g=>({type:"kooperation-skript",id:g.id,title:`Skript: ${g.name||"Kooperation"}`,subtitle:`${g.creator?.vorname} ${g.creator?.nachname}`,deadline:g.skript_deadline,priority:this.getDeadlinePriority(g.skript_deadline),url:`/kooperation/${g.id}`}))||[],...h?.map(g=>({type:"kooperation-content",id:g.id,title:`Content: ${g.name||"Kooperation"}`,subtitle:`${g.creator?.vorname} ${g.creator?.nachname}`,deadline:g.content_deadline,priority:this.getDeadlinePriority(g.content_deadline),url:`/kooperation/${g.id}`}))||[],...p?.map(g=>({type:"rechnung",id:g.id,title:`Rechnung ${g.rechnungs_nr}`,subtitle:g.unternehmen?.firmenname,deadline:g.zahlungsziel,priority:this.getDeadlinePriority(g.zahlungsziel),url:`/rechnung/${g.id}`}))||[]].sort((g,b)=>new Date(g.deadline)-new Date(b.deadline))}catch(e){console.error("❌ Fehler beim Laden der Deadlines:",e),this.data.deadlines=this.getMockDeadlines()}}async loadRecentActivity(){try{if(!window.supabase){this.data.recentActivity=this.getMockActivity();return}const e=new Date;e.setDate(e.getDate()-7);const t=e.toISOString(),[{data:n},{data:a},{data:r}]=await Promise.all([window.supabase.from("kampagne").select("id, kampagnenname, created_at, unternehmen:unternehmen_id(firmenname)").gte("created_at",t).order("created_at",{ascending:!1}).limit(5),window.supabase.from("auftrag").select("id, auftragsname, created_at, unternehmen:unternehmen_id(firmenname)").gte("created_at",t).order("created_at",{ascending:!1}).limit(5),window.supabase.from("briefings").select("id, product_service_offer, created_at, unternehmen:unternehmen_id(firmenname)").gte("created_at",t).order("created_at",{ascending:!1}).limit(5)]);this.data.recentActivity=[...n?.map(i=>({type:"kampagne",title:i.kampagnenname,subtitle:i.unternehmen?.firmenname,timestamp:i.created_at,url:`/kampagne/${i.id}`}))||[],...a?.map(i=>({type:"auftrag",title:i.auftragsname,subtitle:i.unternehmen?.firmenname,timestamp:i.created_at,url:`/auftrag/${i.id}`}))||[],...r?.map(i=>({type:"briefing",title:i.product_service_offer,subtitle:i.unternehmen?.firmenname,timestamp:i.created_at,url:`/briefing/${i.id}`}))||[]].sort((i,s)=>new Date(s.timestamp)-new Date(i.timestamp)).slice(0,8)}catch(e){console.error("❌ Fehler beim Laden der Aktivitäten:",e),this.data.recentActivity=this.getMockActivity()}}async loadAlerts(){try{if(!window.supabase){this.data.alerts=this.getMockAlerts();return}const e=new Date,t=[],{data:n}=await window.supabase.from("kampagne").select("id, kampagnenname, deadline").lt("deadline",e.toISOString()).neq("status_id","completed");n?.forEach(i=>{t.push({type:"error",title:"Überfällige Kampagne",message:`${i.kampagnenname} - Deadline überschritten`,url:`/kampagne/${i.id}`,timestamp:i.deadline})});const a=e.toISOString().split("T")[0],{data:r}=await window.supabase.from("kampagne").select("id, kampagnenname, deadline").eq("deadline",a);r?.forEach(i=>{t.push({type:"warning",title:"Deadline heute",message:`${i.kampagnenname} - heute fällig`,url:`/kampagne/${i.id}`,timestamp:i.deadline})}),this.data.alerts=t.slice(0,5)}catch(e){console.error("❌ Fehler beim Laden der Alerts:",e),this.data.alerts=this.getMockAlerts()}}async render(){const e=window.currentUser?.isBlocked===!0,t=window.currentUser?.blockReason||"Ihr Account wartet auf Freischaltung durch einen Administrator",n=`
      <div class="dashboard-container">
        <!-- Dashboard Header -->
        <div class="page-header">
          <div class="page-header-left">
            <h1>Dashboard</h1>
            <p>${e?t:"Überblick über alle wichtigen Kennzahlen und Deadlines"}</p>
          </div>
        </div>

        ${e?this.renderPendingMessage():""}

        ${e?"":`
        <!-- KPI Cards -->
        <div class="dashboard-stats">
          ${this.renderStatsCards()}
        </div>

        <!-- Deadlines Section -->
        <div class="content-section">
          <div class="section-header">
            <h2>Anstehende Deadlines</h2>
            <span class="section-count">${this.data.deadlines.length} Einträge</span>
          </div>
          ${this.renderDeadlinesTable()}
        </div>

        <!-- Alerts Section -->
        <div class="content-section">
          <div class="section-header">
            <h2>Wichtige Hinweise</h2>
            <span class="section-count">${this.data.alerts.length} Einträge</span>
          </div>
          ${this.renderAlertsTable()}
        </div>

        <!-- Recent Activity Section -->
        <div class="content-section">
          <div class="section-header">
            <h2>Letzte Aktivitäten</h2>
            <span class="section-count">${this.data.recentActivity.length} Einträge</span>
          </div>
          ${this.renderRecentActivityTable()}
        </div>
        `}
      </div>
    `;window.setContentSafely(window.content,n)}async renderKundenDashboard(){if(window.currentUser?.isBlocked===!0){const t=`
        <div class="dashboard-container">
          <div class="page-header">
            <div class="page-header-left">
              <h1>Willkommen</h1>
              <p>Ihr Account wartet auf Freischaltung</p>
            </div>
          </div>
          <div class="data-table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${window.validatorSystem.sanitizeHtml(window.currentUser?.name||"Unbekannt")}</td>
                  <td><span class="status-badge status-pending">Wartet auf Freischaltung</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="content-section" style="margin-top: 24px;">
            <p>Ein Administrator wird Ihren Account in Kürze überprüfen und freischalten.</p>
          </div>
        </div>
      `;window.setContentSafely(window.content,t);return}try{const[{data:t},{data:n}]=await Promise.all([window.supabase.from("kampagne").select("id, kampagnenname, unternehmen:unternehmen_id(firmenname), marke:marke_id(markenname), status:status_id(name)").order("created_at",{ascending:!1}),window.supabase.from("kooperationen").select("id, name, kampagne:kampagne_id(kampagnenname), status, creator:creator_id(vorname, nachname)").order("created_at",{ascending:!1})]),a=(t||[]).map(s=>`
        <tr>
          <td><a href="/kunden-kampagne/${s.id}" onclick="event.preventDefault(); window.navigateTo('/kunden-kampagne/${s.id}')">${window.validatorSystem.sanitizeHtml(s.kampagnenname||s.id)}</a></td>
          <td>${window.validatorSystem.sanitizeHtml(s.unternehmen?.firmenname||"—")}</td>
          <td>${window.validatorSystem.sanitizeHtml(s.marke?.markenname||"—")}</td>
          <td><span class="status-badge">${window.validatorSystem.sanitizeHtml(s.status?.name||"—")}</span></td>
        </tr>
      `).join(""),r=(n||[]).map(s=>`
        <tr>
          <td><a href="/kunden-kooperation/${s.id}" onclick="event.preventDefault(); window.navigateTo('/kunden-kooperation/${s.id}')">${window.validatorSystem.sanitizeHtml(s.name||s.id)}</a></td>
          <td>${window.validatorSystem.sanitizeHtml(s.kampagne?.kampagnenname||"—")}</td>
          <td>${window.validatorSystem.sanitizeHtml(s.creator?`${s.creator.vorname||""} ${s.creator.nachname||""}`.trim():"—")}</td>
          <td><span class="status-badge status-${(s.status||"").toLowerCase().replace(/\s+/g,"-")}">${window.validatorSystem.sanitizeHtml(s.status||"—")}</span></td>
        </tr>
      `).join(""),i=`
        <div class="dashboard-container">
          <div class="page-header">
            <div class="page-header-left">
              <h1>Willkommen, ${window.validatorSystem.sanitizeHtml(window.currentUser?.name||"Kunde")}</h1>
              <p>Übersicht über Ihre Kampagnen und Kooperationen</p>
            </div>
          </div>
          
          <div class="content-section">
            <div class="section-header">
              <h2>Meine Kampagnen</h2>
              <span class="section-count">${(t||[]).length} Einträge</span>
            </div>
            <div class="data-table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Kampagne</th>
                    <th>Unternehmen</th>
                    <th>Marke</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>${a||'<tr><td colspan="4" class="loading">Keine Kampagnen</td></tr>'}</tbody>
              </table>
            </div>
          </div>
          
          <div class="content-section">
            <div class="section-header">
              <h2>Meine Kooperationen</h2>
              <span class="section-count">${(n||[]).length} Einträge</span>
            </div>
            <div class="data-table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Kooperation</th>
                    <th>Kampagne</th>
                    <th>Creator</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>${r||'<tr><td colspan="4" class="loading">Keine Kooperationen</td></tr>'}</tbody>
              </table>
            </div>
          </div>
        </div>
      `;window.setContentSafely(window.content,i)}catch(t){console.error("❌ Fehler beim Laden des Kunden-Dashboards:",t),window.setContentSafely(window.content,'<p class="error">Fehler beim Laden der Daten.</p>')}}renderPendingMessage(){return`
      <div class="content-section">
        <div class="pending-user-message">
          <div class="pending-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 48px; height: 48px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h3>Account wartet auf Freischaltung</h3>
          <p>Ihr Account wurde erfolgreich erstellt und wartet nun auf die Freischaltung durch einen Administrator.</p>
          <div class="pending-details">
            <div class="pending-info">
              <strong>Name:</strong> ${window.currentUser?.name||"Unbekannt"}
            </div>
            <div class="pending-info">
              <strong>E-Mail:</strong> Aus Sicherheitsgründen ausgeblendet
            </div>
            <div class="pending-info">
              <strong>Status:</strong> <span class="pending-status">Warten auf Freischaltung</span>
            </div>
          </div>
          <div class="pending-actions">
            <p><strong>Was passiert als nächstes?</strong></p>
            <ul>
              <li>Ein Administrator wird Ihren Account in Kürze überprüfen</li>
              <li>Sie erhalten eine E-Mail, sobald Ihr Account freigeschaltet wurde</li>
              <li>Nach der Freischaltung haben Sie Zugriff auf alle freigegebenen Module</li>
            </ul>
          </div>
          <div class="pending-contact">
            <p>Bei Fragen wenden Sie sich bitte an einen Administrator.</p>
          </div>
        </div>
      </div>
      
      <style>
        .pending-user-message {
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          padding: 2rem;
          text-align: center;
          max-width: 600px;
          margin: 0 auto;
        }
        
        .pending-icon {
          margin-bottom: 1rem;
          color: #64748b;
        }
        
        .pending-user-message h3 {
          color: #1e293b;
          font-size: 1.5rem;
          margin-bottom: 0.5rem;
          font-weight: 600;
        }
        
        .pending-user-message > p {
          color: #64748b;
          font-size: 1.1rem;
          margin-bottom: 1.5rem;
          line-height: 1.6;
        }
        
        .pending-details {
          background: white;
          border-radius: 8px;
          padding: 1.5rem;
          margin: 1.5rem 0;
          text-align: left;
          border: 1px solid #e2e8f0;
        }
        
        .pending-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0;
          border-bottom: 1px solid #f1f5f9;
        }
        
        .pending-info:last-child {
          border-bottom: none;
        }
        
        .pending-status {
          color: #f59e0b;
          font-weight: 600;
          background: #fef3c7;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.875rem;
        }
        
        .pending-actions {
          background: #f8fafc;
          border-radius: 8px;
          padding: 1.5rem;
          margin: 1.5rem 0;
          text-align: left;
        }
        
        .pending-actions p {
          margin-bottom: 1rem;
          color: #1e293b;
          font-weight: 600;
        }
        
        .pending-actions ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        
        .pending-actions li {
          color: #64748b;
          padding: 0.5rem 0;
          position: relative;
          padding-left: 1.5rem;
        }
        
        .pending-actions li::before {
          content: "✓";
          position: absolute;
          left: 0;
          color: #10b981;
          font-weight: bold;
        }
        
        .pending-contact {
          margin-top: 1.5rem;
          padding-top: 1rem;
          border-top: 1px solid #e2e8f0;
          color: #64748b;
          font-size: 0.95rem;
        }
      </style>
    `}renderStatsCards(){const e=this.data.stats;return`
      <div class="stats-card">
        <div class="stats-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 0 1-1.44-4.282m3.102.069a18.03 18.03 0 0 1-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 0 1 8.835 2.535M10.34 6.66a23.847 23.847 0 0 0 8.835-2.535m0 0A23.74 23.74 0 0 0 18.795 3m.38 1.125a23.91 23.91 0 0 1 1.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 0 0 1.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 0 1 0 3.46" />
          </svg>
        </div>
        <div class="stats-content">
          <div class="stats-number">${e.kampagnen?.aktiv||0}</div>
          <div class="stats-label">Aktive Kampagnen</div>
          <div class="stats-sublabel">${e.kampagnen?.total||0} gesamt</div>
        </div>
        ${e.kampagnen?.ueberfaellig>0?`<div class="stats-alert status-badge danger">${e.kampagnen.ueberfaellig} überfällig</div>`:""}
      </div>

      <div class="stats-card">
        <div class="stats-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
        </div>
        <div class="stats-content">
          <div class="stats-number">${e.auftraege?.aktiv||0}</div>
          <div class="stats-label">Aktive Aufträge</div>
          <div class="stats-sublabel">${e.auftraege?.total||0} gesamt</div>
        </div>
        ${e.auftraege?.ueberfaellig>0?`<div class="stats-alert status-badge danger">${e.auftraege.ueberfaellig} überfällig</div>`:""}
      </div>

      <div class="stats-card">
        <div class="stats-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 11.625h4.5m-4.5 2.25h4.5m2.121 1.527c-1.171 1.464-3.07 1.464-4.242 0-1.172-1.465-1.172-3.84 0-5.304 1.171-1.464 3.07-1.464 4.242 0M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
        </div>
        <div class="stats-content">
          <div class="stats-number">${e.briefings?.offen||0}</div>
          <div class="stats-label">Offene Briefings</div>
          <div class="stats-sublabel">${e.briefings?.total||0} gesamt</div>
        </div>
        ${e.briefings?.ueberfaellig>0?`<div class="stats-alert status-badge danger">${e.briefings.ueberfaellig} überfällig</div>`:""}
      </div>

      <div class="stats-card">
        <div class="stats-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12s-1.536.219-2.121.659c-1.172.879-1.172 2.303 0 3.182.879.659 1.879.659 2.758 0L15 13.5M12 6V4.5" />
          </svg>
        </div>
        <div class="stats-content">
          <div class="stats-number">${e.rechnungen?.offen||0}</div>
          <div class="stats-label">Offene Rechnungen</div>
          <div class="stats-sublabel">${e.rechnungen?.total||0} gesamt</div>
        </div>
        ${e.rechnungen?.ueberfaellig>0?`<div class="stats-alert status-badge danger">${e.rechnungen.ueberfaellig} überfällig</div>`:""}
      </div>

      <div class="stats-card">
        <div class="stats-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
          </svg>
        </div>
        <div class="stats-content">
          <div class="stats-number">${e.creator?.total||0}</div>
          <div class="stats-label">Creator</div>
          <div class="stats-sublabel">Im System</div>
        </div>
      </div>
    `}renderDeadlinesTable(){return this.data.deadlines.length?`
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Typ</th>
              <th>Titel</th>
              <th>Unternehmen</th>
              <th>Deadline</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${this.data.deadlines.map(t=>{const n=Math.ceil((new Date(t.deadline)-new Date)/864e5),a=n<0,r=n===0,i=a?'<span class="status-badge danger">Überfällig</span>':r?'<span class="status-badge warning">Heute</span>':n<=3?'<span class="status-badge warning">Dringend</span>':'<span class="status-badge info">Normal</span>',s={kampagne:"Kampagne",briefing:"Briefing","kooperation-skript":"Skript","kooperation-content":"Content",rechnung:"Rechnung"}[t.type]||t.type;return`
        <tr class="table-row-clickable" onclick="window.navigateTo('${t.url}')">
          <td>
            <span class="status-badge status-badge-type status-badge-type-${t.type}">${s}</span>
          </td>
          <td class="cell-main">
            <div class="cell-title">${t.title}</div>
          </td>
          <td>${t.subtitle||"-"}</td>
          <td>
            <div class="deadline-cell">
              <div class="deadline-date">${new Date(t.deadline).toLocaleDateString("de-DE")}</div>
              <div class="deadline-time">${a?`${Math.abs(n)} Tage überfällig`:r?"Heute fällig":`in ${n} Tagen`}</div>
            </div>
          </td>
          <td>${i}</td>
        </tr>
      `}).join("")}
          </tbody>
        </table>
      </div>
    `:`
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Typ</th>
                <th>Titel</th>
                <th>Unternehmen</th>
                <th>Deadline</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="5" class="no-data">Keine anstehenden Deadlines</td>
              </tr>
            </tbody>
          </table>
        </div>
      `}renderAlertsTable(){return this.data.alerts.length?`
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Typ</th>
              <th>Nachricht</th>
              <th>Zeit</th>
            </tr>
          </thead>
          <tbody>
            ${this.data.alerts.map(t=>{const n={error:'<span class="status-badge danger">Fehler</span>',warning:'<span class="status-badge warning">Warnung</span>',info:'<span class="status-badge info">Info</span>'}[t.type]||'<span class="status-badge info">Info</span>';return`
        <tr class="table-row-clickable" onclick="window.navigateTo('${t.url}')">
          <td>${n}</td>
          <td class="cell-main">
            <div class="cell-title">${t.title}</div>
            <div class="cell-subtitle">${t.message}</div>
          </td>
          <td>${this.formatTimeAgo(t.timestamp)}</td>
        </tr>
      `}).join("")}
          </tbody>
        </table>
      </div>
    `:`
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Typ</th>
                <th>Nachricht</th>
                <th>Zeit</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="3" class="no-data">Keine wichtigen Hinweise</td>
              </tr>
            </tbody>
          </table>
        </div>
      `}renderRecentActivityTable(){return this.data.recentActivity.length?`
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Typ</th>
              <th>Aktivität</th>
              <th>Unternehmen</th>
              <th>Zeit</th>
            </tr>
          </thead>
          <tbody>
            ${this.data.recentActivity.map(t=>{const n={kampagne:'<span class="status-badge status-badge-type status-badge-type-kampagne">Kampagne</span>',auftrag:'<span class="status-badge status-badge-type status-badge-type-auftrag">Auftrag</span>',briefing:'<span class="status-badge status-badge-type status-badge-type-briefing">Briefing</span>',kooperation:'<span class="status-badge status-badge-type status-badge-type-kooperation">Kooperation</span>'}[t.type]||`<span class="status-badge status-badge-type">${t.type}</span>`;return`
        <tr class="table-row-clickable" onclick="window.navigateTo('${t.url}')">
          <td>${n}</td>
          <td class="cell-main">
            <div class="cell-title">${t.title}</div>
          </td>
          <td>${t.subtitle||"-"}</td>
          <td>${this.formatTimeAgo(t.timestamp)}</td>
        </tr>
      `}).join("")}
          </tbody>
        </table>
      </div>
    `:`
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Typ</th>
                <th>Aktivität</th>
                <th>Unternehmen</th>
                <th>Zeit</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="4" class="no-data">Keine letzten Aktivitäten</td>
              </tr>
            </tbody>
          </table>
        </div>
      `}getDeadlinePriority(e){const t=Math.ceil((new Date(e)-new Date)/864e5);return t<0?"overdue":t===0?"today":t<=3?"urgent":t<=7?"warning":"normal"}getAlertIcon(e){const t={error:'<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" /></svg>',warning:'<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>',info:'<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" /></svg>'};return t[e]||t.info}formatTimeAgo(e){const t=new Date,n=new Date(e),a=Math.floor((t-n)/1e3);return a<60?"Gerade eben":a<3600?`${Math.floor(a/60)}m`:a<86400?`${Math.floor(a/3600)}h`:a<604800?`${Math.floor(a/86400)}d`:n.toLocaleDateString("de-DE")}setupEventListeners(){const e=document.getElementById("dashboard-refresh");e&&e.addEventListener("click",()=>this.refresh())}async refresh(){await this.loadDashboardData(),await this.render()}startAutoRefresh(){this.refreshInterval=setInterval(()=>{this.refresh()},300*1e3)}destroy(){this.refreshInterval&&(clearInterval(this.refreshInterval),this.refreshInterval=null)}getMockStats(){return{kampagnen:{total:12,aktiv:8,ueberfaellig:2},auftraege:{total:15,aktiv:10,ueberfaellig:1},briefings:{total:8,offen:5,ueberfaellig:1},kooperationen:{total:25,aktiv:18},creator:{total:45},rechnungen:{total:20,offen:8,ueberfaellig:3}}}getMockDeadlines(){const e=new Date;return[{type:"kampagne",id:"1",title:"Summer Collection Campaign",subtitle:"Fashion Brand GmbH",deadline:new Date(e.getTime()+1440*60*1e3).toISOString(),priority:"urgent",url:"/kampagne/1"},{type:"briefing",id:"2",title:"Produktvorstellung Sneaker",subtitle:"Sports Company",deadline:new Date(e.getTime()+4320*60*1e3).toISOString(),priority:"warning",url:"/briefing/2"}]}getMockActivity(){return[{type:"kampagne",title:"Neue Kampagne erstellt",subtitle:"Fashion Brand GmbH",timestamp:new Date(Date.now()-7200*1e3).toISOString(),url:"/kampagne/1"},{type:"auftrag",title:"Auftrag abgeschlossen",subtitle:"Tech Startup",timestamp:new Date(Date.now()-14400*1e3).toISOString(),url:"/auftrag/2"}]}getMockAlerts(){return[{type:"error",title:"Überfällige Deadline",message:"Kampagne XY ist seit 2 Tagen überfällig",url:"/kampagne/1",timestamp:new Date().toISOString()},{type:"warning",title:"Deadline heute",message:"Briefing ABC muss heute fertig werden",url:"/briefing/2",timestamp:new Date().toISOString()}]}}const ze=new an;class rn{constructor(){this.container=null,this.currentBreadcrumbs=[]}init(){if(this.container=document.getElementById("breadcrumb-container"),!this.container){console.warn("⚠️ BreadcrumbSystem: Container nicht gefunden");return}console.log("✅ BreadcrumbSystem: Initialisiert")}updateBreadcrumb(e){if(!this.container){console.warn("⚠️ BreadcrumbSystem: Container nicht initialisiert");return}this.currentBreadcrumbs=e,this.render()}reset(){this.currentBreadcrumbs=[],this.container&&(this.container.innerHTML="")}render(){if(!this.container||!this.currentBreadcrumbs.length){this.container&&(this.container.innerHTML="");return}const e=this.currentBreadcrumbs.map((t,n)=>{const a=n===this.currentBreadcrumbs.length-1,r=window.validatorSystem?.sanitizeHtml?.(t.label)||t.label;return a||!t.clickable?`<span class="breadcrumb-item breadcrumb-current">${r}</span>`:`
          <a href="${t.url}" class="breadcrumb-item breadcrumb-link" data-route="${t.url}">
            ${r}
          </a>
          <span class="breadcrumb-separator">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 14px; height: 14px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </span>
        `}).join("");this.container.innerHTML=`
      <nav class="breadcrumb" aria-label="Breadcrumb">
        ${e}
      </nav>
    `,this.bindEvents()}bindEvents(){if(!this.container)return;this.container.querySelectorAll(".breadcrumb-link").forEach(t=>{t.addEventListener("click",n=>{n.preventDefault();const a=t.getAttribute("data-route");a&&window.navigateTo&&window.navigateTo(a)})})}generateBreadcrumb(e,t,n=[]){const a=[{label:e,url:t,clickable:!0}];return n.forEach((r,i)=>{const s=i===n.length-1;a.push({label:r.label,url:r.url||"#",clickable:r.clickable!==!1&&!s})}),a}}const Ie=new rn;class sn{constructor(){this._open=!1}open({title:e="Löschen bestätigen",message:t="Sind Sie sicher?",confirmText:n="Löschen",cancelText:a="Abbrechen",danger:r=!0}={}){return this._open?Promise.reject(new Error("ConfirmationModal bereits offen")):(this._open=!0,new Promise(i=>{const s=document.createElement("div");s.className="modal overlay-modal",s.innerHTML=`
        <div class="modal-dialog">
          <div class="modal-header">
            <h3>${e}</h3>
            <button class="modal-close" data-action="close">×</button>
          </div>
          <div class="modal-body">
            <p class="confirm-message">${t}</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="secondary-btn" data-action="cancel">${a}</button>
            <button type="button" class="${r?"danger-btn":"primary-btn"}" data-action="confirm">${n}</button>
          </div>
        </div>`,document.body.appendChild(s);const o=u=>{s.parentNode&&(s.remove(),this._open=!1,i(u))};s.querySelector('[data-action="close"]').addEventListener("click",()=>o({confirmed:!1})),s.querySelector('[data-action="cancel"]').addEventListener("click",()=>o({confirmed:!1})),s.querySelector('[data-action="confirm"]').addEventListener("click",()=>o({confirmed:!0})),s.addEventListener("click",u=>{u.target===s&&o({confirmed:!1})});const l=u=>{u.key==="Escape"&&(window.removeEventListener("keydown",l),o({confirmed:!1}))};window.addEventListener("keydown",l)}))}}const on=new sn;typeof window<"u"&&(window.confirmationModal=on);class ln{constructor(){this.user=null,this.isEditing=!1}async init(){await this.load(),await this.render(),this.bind()}async load(){try{if(!window.currentUser?.id)throw new Error("Kein Benutzer eingeloggt");const{data:e,error:t}=await window.supabase.from("benutzer").select(`
          *,
          mitarbeiter_klasse:mitarbeiter_klasse_id(name, description)
        `).eq("id",window.currentUser.id).single();if(t)throw t;this.user=e||{},console.log("✅ Profil geladen:",this.user)}catch(e){console.error("❌ Fehler beim Laden des Profils:",e),window.ErrorHandler.handle(e,"ProfileDetail.load")}}async render(){const e=document.getElementById("dashboard-content");if(!e){console.error("❌ dashboard-content Container nicht gefunden");return}e.innerHTML=`
      <div class="page-header">
        <div class="page-title">
          <h1>Mein Profil</h1>
          <p>Persönliche Informationen und Einstellungen</p>
        </div>
        <div class="page-actions">
          <button id="edit-profile-btn" class="btn btn-primary">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
            Profil bearbeiten
          </button>
        </div>
      </div>

      <div class="detail-container">
        <div class="detail-grid">
          <!-- Profil-Informationen -->
          <div class="detail-section">
            <h2>Persönliche Informationen</h2>
            <div class="detail-grid-two">
              <div class="detail-field">
                <label>Name</label>
                <div class="detail-value" id="profile-name">
                  ${this.isEditing?`
                    <input type="text" id="name-input" class="form-input" value="${this.user.name||""}" placeholder="Vollständiger Name">
                  `:this.user.name||"Nicht angegeben"}
                </div>
              </div>
              
              <div class="detail-field">
                <label>E-Mail</label>
                <div class="detail-value">${this.user.auth_user_id?"Über Supabase Auth verwaltet":"Nicht angegeben"}</div>
              </div>
              
              <div class="detail-field">
                <label>Rolle</label>
                <div class="detail-value">
                  <span class="badge badge-${this.user.rolle?.toLowerCase()==="admin"?"primary":"secondary"}">
                    ${this.user.rolle||"Nicht definiert"}
                  </span>
                </div>
              </div>
              
              <div class="detail-field">
                <label>Unterrolle</label>
                <div class="detail-value">
                  ${this.user.unterrolle?`<span class="badge badge-outline">${this.user.unterrolle}</span>`:"Keine"}
                </div>
              </div>
              
              <div class="detail-field">
                <label>Mitarbeiter-Klasse</label>
                <div class="detail-value">
                  ${this.user.mitarbeiter_klasse?.name||"Nicht zugewiesen"}
                </div>
              </div>
              
              <div class="detail-field">
                <label>Erstellt am</label>
                <div class="detail-value">${this.formatDate(this.user.created_at)}</div>
              </div>
            </div>
            
            ${this.isEditing?`
              <div class="form-actions">
                <button id="save-profile-btn" class="btn btn-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Speichern
                </button>
                <button id="cancel-edit-btn" class="btn btn-secondary">Abbrechen</button>
              </div>
            `:""}
          </div>

          <!-- Berechtigungen -->
          <div class="detail-section">
            <h2>Berechtigungen</h2>
            <div class="permissions-grid">
              ${this.renderPermissions()}
            </div>
          </div>
        </div>
      </div>
    `}renderProfileInfo(){return`
      <div class="detail-section">
        <h2>Persönliche Informationen</h2>
        <div class="detail-grid-two">
          <div class="detail-field">
            <label>Name</label>
            <div class="detail-value">${this.user?.name||"Nicht angegeben"}</div>
          </div>
          
          <div class="detail-field">
            <label>E-Mail</label>
            <div class="detail-value">${this.user?.auth_user_id?"Über Supabase Auth verwaltet":"Nicht angegeben"}</div>
          </div>
          
          <div class="detail-field">
            <label>Rolle</label>
            <div class="detail-value">
              <span class="badge badge-${this.user?.rolle?.toLowerCase()==="admin"?"primary":"secondary"}">
                ${this.user?.rolle||"Nicht definiert"}
              </span>
            </div>
          </div>
          
          <div class="detail-field">
            <label>Unterrolle</label>
            <div class="detail-value">
              ${this.user?.unterrolle?`<span class="badge badge-outline">${this.user.unterrolle}</span>`:"Keine"}
            </div>
          </div>
          
          <div class="detail-field">
            <label>Mitarbeiter-Klasse</label>
            <div class="detail-value">
              ${this.user?.mitarbeiter_klasse?.name||"Nicht zugewiesen"}
            </div>
          </div>
          
          <div class="detail-field">
            <label>Erstellt am</label>
            <div class="detail-value">${this.formatDate(this.user?.created_at)}</div>
          </div>
        </div>
      </div>
    `}renderEditForm(){return`
      <div class="detail-section">
        <h2>Profil bearbeiten</h2>
        <div class="detail-grid-two">
          <div class="detail-field">
            <label for="name-input">Name *</label>
            <input type="text" id="name-input" class="form-input" value="${this.user?.name||""}" placeholder="Vollständiger Name">
          </div>
          
          <div class="detail-field">
            <label>E-Mail</label>
            <div class="detail-value text-muted">Über Supabase Auth verwaltet</div>
          </div>
          
          <div class="detail-field">
            <label>Rolle</label>
            <div class="detail-value text-muted">Wird vom Administrator verwaltet</div>
          </div>
          
          <div class="detail-field">
            <label>Unterrolle</label>
            <div class="detail-value text-muted">Wird vom Administrator verwaltet</div>
          </div>
        </div>
        
        <div class="form-actions">
          <button id="save-profile-btn" class="btn btn-primary">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Speichern
          </button>
          <button id="cancel-edit-btn" class="btn btn-secondary">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Abbrechen
          </button>
        </div>
      </div>
    `}renderPermissions(){if(!this.user?.zugriffsrechte)return`
        <div class="detail-section">
          <h2>Meine Berechtigungen</h2>
          <div class="empty-state">
            <p>Keine Berechtigungen definiert.</p>
          </div>
        </div>
      `;const e=this.user.zugriffsrechte;return`
      <div class="detail-section">
        <h2>Meine Berechtigungen</h2>
        <p class="text-muted">Diese Berechtigungen werden vom Administrator verwaltet.</p>
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Bereich</th>
                <th style="width:100px; text-align:center;">Lesen</th>
                <th style="width:100px; text-align:center;">Bearbeiten</th>
                <th style="width:100px; text-align:center;">Löschen</th>
              </tr>
            </thead>
            <tbody>
              ${[{key:"creator",label:"Creator"},{key:"creator-lists",label:"Creator-Listen"},{key:"unternehmen",label:"Unternehmen"},{key:"marke",label:"Marken"},{key:"auftrag",label:"Aufträge"},{key:"kampagne",label:"Kampagnen"},{key:"kooperation",label:"Kooperationen"},{key:"briefing",label:"Briefings"},{key:"rechnung",label:"Rechnungen"},{key:"ansprechpartner",label:"Ansprechpartner"}].map(n=>{const a=e[n.key],r=a?.can_view!==!1,i=a?.can_edit===!0,s=a?.can_delete===!0;return`
                  <tr>
                    <td>${n.label}</td>
                    <td style="text-align:center;">
                      <span class="permission-indicator ${r?"granted":"denied"}">
                        ${r?"✓":"✗"}
                      </span>
                    </td>
                    <td style="text-align:center;">
                      <span class="permission-indicator ${i?"granted":"denied"}">
                        ${i?"✓":"✗"}
                      </span>
                    </td>
                    <td style="text-align:center;">
                      <span class="permission-indicator ${s?"granted":"denied"}">
                        ${s?"✓":"✗"}
                      </span>
                    </td>
                  </tr>
                `}).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `}getEntityLabel(e){return{creator:"Creator",kampagne:"Kampagnen",kooperation:"Kooperationen",briefing:"Briefings",rechnung:"Rechnungen",unternehmen:"Unternehmen",marke:"Marken",auftrag:"Aufträge",ansprechpartner:"Ansprechpartner"}[e]||e}bind(){const e=document.querySelectorAll(".tab-btn"),t=document.querySelectorAll(".tab-pane");e.forEach(n=>{n.addEventListener("click",()=>{const a=n.dataset.tab;e.forEach(r=>r.classList.remove("active")),t.forEach(r=>r.classList.remove("active")),n.classList.add("active"),document.getElementById(`tab-${a}`)?.classList.add("active")})}),document.getElementById("edit-profile-btn")?.addEventListener("click",()=>{this.isEditing=!this.isEditing,this.render()}),document.getElementById("save-profile-btn")?.addEventListener("click",async()=>{await this.saveProfile()}),document.getElementById("cancel-edit-btn")?.addEventListener("click",()=>{this.isEditing=!1,this.render()})}async saveProfile(){try{const t=document.getElementById("name-input")?.value?.trim();if(!t){alert("Name darf nicht leer sein");return}const{error:n}=await window.supabase.from("benutzer").update({name:t,updated_at:new Date().toISOString()}).eq("id",this.user.id);if(n)throw n;window.currentUser.name=t,this.user.name=t,window.setupHeaderUI?.(),this.isEditing=!1,await this.render(),alert("Profil erfolgreich aktualisiert"),console.log("✅ Profil gespeichert")}catch(e){console.error("❌ Fehler beim Speichern:",e),alert("Fehler beim Speichern des Profils")}}formatDate(e){return e?new Date(e).toLocaleDateString("de-DE",{year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"}):"Unbekannt"}destroy(){console.log("ProfileDetail: Cleaning up...")}}class dn{constructor(){this.modules=new Map,this.currentModule=null}register(e,t){this.modules.set(e,t)}navigateTo(e){try{if(window.history&&window.history.pushState){const d=e.startsWith("/")?e:`/${e}`;window.history.pushState({route:d},"",d)}}catch{}try{e.startsWith("/admin/kunden")&&(e=e.replace("/admin/kunden","/kunden-admin"))}catch{}const n=e.replace(/^\//,"").split("/"),[a,r,i]=n;this.currentModule&&this.currentModule.destroy&&(console.log("🗑️ Zerstöre aktuelles Modul:",this.currentModule.constructor.name),this.currentModule.destroy(),this.currentModule=null);let s=a,o=this.modules.get(s),l=i==="edit";r&&a==="creator"&&r!=="new"&&(s="creator-detail",o=this.modules.get(s),console.log(`🎯 Creator-Details erkannt, verwende Modul: ${s}`)),a==="creator-lists"&&r&&(s="creator-list-detail",o=this.modules.get(s),console.log("🎯 Creator-Listen-Detail erkannt")),r&&a==="mitarbeiter"&&r!=="new"&&(s="mitarbeiter-detail",o=this.modules.get(s),console.log(`🎯 Mitarbeiter-Details erkannt, verwende Modul: ${s}`)),r&&a==="kunden-admin"&&r!=="new"&&(s="kunden-detail",o=this.modules.get(s),console.log(`🎯 Kunden-Admin-Details erkannt, verwende Modul: ${s}`)),r&&a==="kunden-kampagne"&&r!=="new"&&(s="kunden-kampagne-detail",o=this.modules.get(s),console.log("🎯 Kunden Kampagne-Detail erkannt")),r&&a==="kunden-kooperation"&&r!=="new"&&(s="kunden-kooperation-detail",o=this.modules.get(s),console.log("🎯 Kunden Kooperation-Detail erkannt")),r&&a==="marke"&&r!=="new"&&(s="marke-detail",o=this.modules.get(s),console.log(`🎯 Marken-Details erkannt, verwende Modul: ${s}`)),r==="neu"&&a==="unternehmen"?(s="unternehmen-create",o=this.modules.get(s),console.log(`🎯 Unternehmen-Erstellung erkannt, verwende Modul: ${s}`)):r&&a==="unternehmen"&&r!=="new"&&r!=="neu"&&(s="unternehmen-detail",o=this.modules.get(s),console.log(`🎯 Unternehmen-Details erkannt, verwende Modul: ${s}`)),r==="new"&&a==="auftragsdetails"?(s="auftragsdetails-create",o=this.modules.get(s),console.log(`🎯 Auftragsdetails-Erstellung erkannt, verwende Modul: ${s}`)):r&&a==="auftragsdetails"&&r!=="new"?(s="auftragsdetails-detail",o=this.modules.get(s),console.log(`🎯 Auftragsdetails-Details erkannt, verwende Modul: ${s}`)):r&&a==="auftrag"&&r!=="new"&&(s="auftrag-detail",o=this.modules.get(s),console.log(`🎯 Auftrags-Details erkannt, verwende Modul: ${s}`)),r&&a==="kooperation"&&r!=="new"&&(s="kooperation-detail",o=this.modules.get(s),console.log(`🎯 Kooperations-Details erkannt, verwende Modul: ${s}`));const u=r&&r.split("?")[0];if(u&&a==="video"&&u!=="new"&&(s="kooperation-video-detail",o=this.modules.get(s),console.log(`🎯 Video-Details erkannt, verwende Modul: ${s}`)),a==="video"&&(!u||u==="new")&&(s="kooperation-video-detail",o=this.modules.get(s),console.log(`🎯 Video-Neuanlage erkannt, verwende Modul: ${s}`)),r&&a==="kampagne"&&r!=="new"&&(s="kampagne-detail",o=this.modules.get(s),console.log(`🎯 Kampagnen-Details erkannt, verwende Modul: ${s}`)),r&&a==="briefing"&&r!=="new"&&(s="briefing-detail",o=this.modules.get(s),console.log(`🎯 Briefing-Details erkannt, verwende Modul: ${s}`)),r&&a==="rechnung"&&r!=="new"&&(s="rechnung-detail",o=this.modules.get(s),console.log(`🎯 Rechnung-Details erkannt, verwende Modul: ${s}`)),r&&a==="ansprechpartner"&&(s="ansprechpartner-detail",o=this.modules.get(s),console.log(`🎯 Ansprechpartner-Details/Erstellung erkannt, verwende Modul: ${s}`)),o){console.log(`✅ Modul gefunden: ${s}`,o),this.currentModule=o;const d=r&&r.split("?")[0];if(d==="new")return a==="rechnung"?(s="rechnung-detail",o=this.modules.get(s),o.init?.("new")):(console.log(`📝 Zeige Erstellungsformular für: ${a}`),s.includes("-detail")?o.init?.("new"):o.showCreateForm?.());if(d)if(l){if(console.log(`✏️ Zeige Edit-Formular für: ${a}/${r}`),o&&o.init){o.init(d).then(()=>{o.showEditForm&&o.showEditForm()});return}}else return console.log(`👁️ Zeige Details für: ${a}/${r}`),o.init?.(d);else return console.log(`🚀 Initialisiere Modul: ${a}`),o.init()}else console.warn(`❌ Modul nicht gefunden: ${s}`),this.loadDashboard()}loadDashboard(){const e=this.modules.get("dashboard");e?(this.currentModule=e,e.init()):(window.setHeadline("Dashboard"),window.content.innerHTML=`
        <div class="dashboard">
          <h1>Willkommen im CRM</h1>
          <p>Dashboard wird geladen...</p>
        </div>
      `)}}const D=new dn;window.moduleRegistry=D;D.register("creator",J);D.register("creator-detail",X);D.register("creator-lists",Ue);D.register("creator-list-detail",Pe);D.register("unternehmen",ee);D.register("unternehmen-create",te);D.register("auftrag",ae);D.register("auftragsdetails",Je);D.register("auftragsdetails-detail",Xe);D.register("auftragsdetails-create",tt);D.register("marke",re);D.register("marke-detail",se);D.register("marke-create",Z);D.register("unternehmen-detail",be);D.register("auftrag-detail",we);D.register("kooperation",ve);D.register("kooperation-detail",ye);D.register("kooperation-video-detail",ke);D.register("kampagne",_e);D.register("kampagne-detail",Ee);D.register("ansprechpartner",$e);D.register("ansprechpartner-detail",De);D.register("ansprechpartner-create",G);D.register("briefing",Se);D.register("briefing-detail",Ae);D.register("rechnung",Kt);D.register("rechnung-detail",Ut);D.register("mitarbeiter",Ot);D.register("mitarbeiter-detail",Pt);D.register("admin/kunden",Le);D.register("kunden-admin",Le);D.register("kunden-detail",Zt);D.register("kunden",Yt);D.register("kunden-kampagne-detail",Qt);D.register("kunden-kooperation-detail",en);D.register("dashboard",ze);const Te=new ln;window.profileDetail=Te;D.register("profile",Te);window.navigateTo=f=>{D.navigateTo(f)};window.filterSystem=A;window.creatorList=J;window.creatorDetail=X;window.unternehmenList=ee;window.unternehmenCreate=te;window.auftragList=ae;window.markeList=re;window.markeDetail=se;window.markeCreate=Z;window.unternehmenDetail=be;window.auftragDetail=we;window.auftragsDetailsManager=ne;window.kooperationList=ve;window.kooperationDetail=ye;window.kooperationVideoDetail=ke;window.kampagneList=_e;window.kampagneDetail=Ee;window.briefingDetail=Ae;window.kampagneUtils=It;window.briefingList=Se;window.AuthService=P;window.AuthUtils=j;window.authService=P;window.authUtils=j;window.navigationSystem=oe;window.permissionSystem=Ne;window.dataService=K;window.validatorSystem=C;window.creatorUtils=de;window.formSystem=ge;window.newFormSystem=new fe;window.notizenSystem=yt;window.bewertungsSystem=_t;window.ActionsDropdown=I;window.bulkActionSystem=Fe;window.notificationSystem=Me;window.ansprechpartnerList=$e;window.ansprechpartnerDetail=De;window.ansprechpartnerCreate=G;window.dashboardModule=ze;window.breadcrumbSystem=Ie;document.addEventListener("DOMContentLoaded",async()=>{if(console.log("🎯 Initialisiere Event-basiertes Modul-System..."),window.appRoot=document.getElementById("app-root"),window.loginRoot=document.getElementById("login-root"),window.content=document.getElementById("dashboard-content"),window.nav=document.getElementById("main-nav"),window.supabase&&window.CONFIG?.SUPABASE?.URL&&window.CONFIG?.SUPABASE?.KEY)try{window.supabase=window.supabase.createClient(window.CONFIG.SUPABASE.URL,window.CONFIG.SUPABASE.KEY),console.log("✅ Supabase initialisiert")}catch(e){console.error("❌ Supabase-Initialisierung fehlgeschlagen:",e)}else console.warn("⚠️ Supabase nicht verfügbar - verwende Offline-Modus");if(await P.checkAuth()){console.log("✅ Benutzer ist authentifiziert"),Q.setModuleRegistry(D),oe.init(),I.init(),Fe.init(),Me.init(),Ie.init(),window.appRoot.style.display="",window.loginRoot.style.display="none";const e=location.pathname;e==="/"||e==="/dashboard"?D.loadDashboard():D.navigateTo(e),window.setupHeaderUI?.()}else console.log("🔐 Benutzer nicht authentifiziert - zeige Login"),j.showLogin()});window.handleLogout=async()=>{try{await P.signOut()}catch(f){console.warn("Logout warn:",f)}finally{window.appRoot&&(window.appRoot.style.display="none"),window.loginRoot&&(window.loginRoot.style.display="");const f=document.getElementById("mitarbeiterPanelOverlay"),e=document.getElementById("mitarbeiterPanel");f&&(f.style.display="none"),e&&(e.style.display="none"),j.showLogin?.()}};window.setupHeaderUI=()=>{try{const f=document.querySelector(".profile-img"),e=document.querySelector(".profile-initials"),t=(window.currentUser?.name||"").trim();if(t&&e){const o=t.split(/\s+/).filter(Boolean),l=(o[0]?.[0]||"").toUpperCase()+(o[1]?.[0]||"").toUpperCase();e.textContent=l||(t[0]||"?").toUpperCase()}window.currentUser?.avatar_url&&f&&(f.src=window.currentUser.avatar_url,f.style.display="",e&&(e.style.display="none"));const n=document.querySelector(".profile-btn"),a=document.querySelector(".profile-dropdown");n&&a&&!n.dataset.bound&&(n.dataset.bound="true",n.addEventListener("click",o=>{o.stopPropagation();const l=a.getAttribute("aria-hidden")==="false";a.setAttribute("aria-hidden",l?"true":"false"),n.setAttribute("aria-expanded",l?"false":"true")}),a.addEventListener("click",o=>{const l=o.target.closest("[data-action]")?.dataset.action;l&&(o.preventDefault(),a.setAttribute("aria-hidden","true"),n.setAttribute("aria-expanded","false"),l==="view-profile"&&D.navigateTo("/profile"))}),document.addEventListener("click",()=>{a.setAttribute("aria-hidden","true"),n.setAttribute("aria-expanded","false")}));const r=document.querySelector(".quick-menu-btn"),i=document.querySelector(".quick-menu-dropdown"),s=document.querySelector(".quick-menu-container");if(s&&window.currentUser?.rolle==="kunde"?s.style.display="none":s&&(s.style.display=""),r&&i&&!r.dataset.bound){const o=()=>{i.classList.remove("show"),r.setAttribute("aria-expanded","false")};r.addEventListener("click",u=>{u.preventDefault();const d=i.classList.toggle("show");r.setAttribute("aria-expanded",String(d))}),document.addEventListener("click",u=>{!i.contains(u.target)&&!r.contains(u.target)&&o()});const l={unternehmen:"unternehmen",marke:"marke",auftrag:"auftrag",ansprechpartner:"ansprechpartner",kampagne:"kampagne",briefing:"briefing",kooperation:"kooperation",creator:"creator"};i.querySelectorAll(".quick-menu-item").forEach(u=>{const d=u.getAttribute("data-entity"),c=l[d],m=c?!!window.permissionSystem?.getEntityPermissions(c)?.can_edit:!1;u.style.display=m||window.currentUser?.rolle==="admin"?"":"none"}),i.addEventListener("click",u=>{const d=u.target.closest(".quick-menu-item");if(!d)return;const c=d.getAttribute("data-entity");if(c){switch(c){case"unternehmen":window.navigateTo("/unternehmen/neu");break;case"marke":window.navigateTo("/marke/new");break;case"auftrag":window.navigateTo("/auftrag/new");break;case"ansprechpartner":window.navigateTo("/ansprechpartner/new");break;case"kampagne":window.navigateTo("/kampagne/new");break;case"briefing":window.navigateTo("/briefing/new");break;case"kooperation":window.navigateTo("/kooperation/new");break;case"creator":window.navigateTo("/creator/new");break}o()}}),r.dataset.bound="true"}}catch(f){console.warn("Header/Quick-Menu setup warn:",f)}};
