class u{constructor(){this.drawerId="rechnung-anpassen-drawer",this.auftragId=null,this.auftragData=null}async open(t){console.log("📋 RECHNUNG-ANPASSEN: Öffne Drawer für Auftrag:",t),this.auftragId=t;try{await this.createDrawer(),await this.loadAuftragData(),this.renderForm(),this.bindEvents()}catch(e){console.error("❌ Fehler beim Öffnen des Drawers:",e),this.showError("Fehler beim Laden der Auftragsdaten.")}}async createDrawer(){this.removeDrawer();const t=document.createElement("div");t.className="drawer-overlay",t.id=`${this.drawerId}-overlay`;const e=document.createElement("div");e.setAttribute("role","dialog"),e.className="drawer-panel",e.id=this.drawerId;const a=document.createElement("div");a.className="drawer-header";const n=document.createElement("div"),s=document.createElement("span");s.className="drawer-title",s.textContent="Rechnung anpassen";const r=document.createElement("p");r.className="drawer-subtitle",r.textContent="Status und Datums-Felder verwalten",n.appendChild(s),n.appendChild(r);const l=document.createElement("div"),o=document.createElement("button");o.className="drawer-close-btn",o.setAttribute("type","button"),o.setAttribute("aria-label","Schließen"),o.innerHTML="&times;",l.appendChild(o),a.appendChild(n),a.appendChild(l);const i=document.createElement("div");i.className="drawer-body",i.id=`${this.drawerId}-body`;const d=document.createElement("div");d.className="drawer-footer",d.innerHTML=`
      <button type="button" class="mdc-btn mdc-btn--cancel" data-action="cancel">
        <span class="mdc-btn__icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
            <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </span>
        <span class="mdc-btn__label">Abbrechen</span>
      </button>
      <button type="button" class="mdc-btn mdc-btn--create" data-action="save">
        <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M9 16.17l-3.88-3.88a1 1 0 10-1.41 1.41l4.59 4.59a1 1 0 001.41 0l10-10a1 1 0 10-1.41-1.41L9 16.17z"/>
          </svg>
        </span>
        <span class="mdc-btn__spinner" aria-hidden="true">
          <svg class="mdc-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="16" height="16">
            <circle class="mdc-spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"/>
          </svg>
        </span>
        <span class="mdc-btn__label">Speichern</span>
      </button>
    `,e.appendChild(a),e.appendChild(i),e.appendChild(d),t.addEventListener("click",()=>this.close()),o.addEventListener("click",()=>this.close()),document.body.appendChild(t),document.body.appendChild(e),requestAnimationFrame(()=>{e.classList.add("show")})}async loadAuftragData(){console.log("🔍 RECHNUNG-ANPASSEN: Lade Auftragsdaten");const{data:t,error:e}=await window.supabase.from("auftrag").select("id, auftragsname, rechnung_gestellt, rechnung_gestellt_am, ueberwiesen, ueberwiesen_am").eq("id",this.auftragId).single();if(e)throw console.error("❌ Fehler beim Laden:",e),e;this.auftragData=t,console.log("✅ Auftragsdaten geladen:",this.auftragData)}renderForm(){const t=document.getElementById(`${this.drawerId}-body`);if(!t)return;const e=this.auftragData.rechnung_gestellt||!1,a=this.formatDateForInput(this.auftragData.rechnung_gestellt_am),n=this.auftragData.ueberwiesen||!1,s=this.formatDateForInput(this.auftragData.ueberwiesen_am);t.innerHTML=`
      <div class="form-section">
        <h3 class="form-section-title">Rechnungsinformationen</h3>
        
        <!-- Rechnung gestellt -->
        <div class="form-field">
          <label class="toggle-container">
            <span>Rechnung gestellt</span>
            <div class="toggle-switch">
              <input type="checkbox" id="rechnung_gestellt" ${e?"checked":""}>
              <span class="toggle-slider"></span>
            </div>
          </label>
        </div>
        
        <!-- Rechnung gestellt am -->
        <div class="form-field" id="rechnung_gestellt_am_field" style="display: ${e?"flex":"none"}">
          <label for="rechnung_gestellt_am">gestellt am</label>
          <input type="date" id="rechnung_gestellt_am" value="${a}">
        </div>
      </div>

      <div class="form-section">
        <h3 class="form-section-title">Zahlungsinformationen</h3>
        
        <!-- Überwiesen -->
        <div class="form-field">
          <label class="toggle-container">
            <span>Überwiesen</span>
            <div class="toggle-switch">
              <input type="checkbox" id="ueberwiesen" ${n?"checked":""}>
              <span class="toggle-slider"></span>
            </div>
          </label>
        </div>
        
        <!-- Überwiesen am -->
        <div class="form-field" id="ueberwiesen_am_field" style="display: ${n?"flex":"none"}">
          <label for="ueberwiesen_am">Überwiesen am</label>
          <input type="date" id="ueberwiesen_am" value="${s}">
        </div>
      </div>
    `}formatDateForInput(t){if(!t)return"";try{const e=new Date(t),a=e.getFullYear(),n=String(e.getMonth()+1).padStart(2,"0"),s=String(e.getDate()).padStart(2,"0");return`${a}-${n}-${s}`}catch(e){return console.error("❌ Fehler beim Formatieren des Datums:",e),""}}bindEvents(){const t=document.getElementById("rechnung_gestellt"),e=document.getElementById("ueberwiesen");t&&t.addEventListener("change",n=>{this.handleToggleChange("rechnung_gestellt",n.target.checked)}),e&&e.addEventListener("change",n=>{this.handleToggleChange("ueberwiesen",n.target.checked)});const a=document.querySelector(`#${this.drawerId} .drawer-footer`);a&&a.addEventListener("click",async n=>{const s=n.target.closest("[data-action]");if(!s)return;const r=s.dataset.action;console.log("🖱️ RECHNUNG-ANPASSEN: Button geklickt:",r),r==="cancel"?this.close():r==="save"&&await this.save()})}handleToggleChange(t,e){console.log(`🔄 Toggle geändert: ${t} = ${e}`);const a=`${t}_am_field`,n=`${t}_am`,s=document.getElementById(a),r=document.getElementById(n);if(!(!s||!r)&&(s.style.display=e?"flex":"none",e&&!r.value)){const l=new Date().toISOString().split("T")[0];r.value=l,console.log(`  ✅ Heutiges Datum gesetzt: ${l}`)}}async save(){console.log("💾 RECHNUNG-ANPASSEN: Speichere Änderungen");const t=document.querySelector(`#${this.drawerId} [data-action="save"]`);t&&(t.disabled=!0,t.classList.add("is-loading"));try{const e=document.getElementById("rechnung_gestellt").checked,a=document.getElementById("rechnung_gestellt_am").value||null,n=document.getElementById("ueberwiesen").checked,s=document.getElementById("ueberwiesen_am").value||null,r={rechnung_gestellt:e,rechnung_gestellt_am:e?a:null,ueberwiesen:n,ueberwiesen_am:n?s:null};console.log("  📝 Updates:",r);const{error:l}=await window.supabase.from("auftrag").update(r).eq("id",this.auftragId);if(l){console.error("❌ Fehler beim Speichern:",l),this.showError("Fehler beim Speichern der Änderungen.");return}console.log("✅ Erfolgreich gespeichert"),window.dispatchEvent(new CustomEvent("entityUpdated",{detail:{entity:"auftrag",id:this.auftragId}})),this.showSuccess(),setTimeout(()=>this.close(),500)}catch(e){console.error("❌ Fehler beim Speichern:",e),this.showError("Ein unerwarteter Fehler ist aufgetreten.")}finally{t&&(t.disabled=!1,t.classList.remove("is-loading"))}}showSuccess(){const t=document.getElementById(`${this.drawerId}-body`);if(!t)return;const e=document.createElement("div");e.className="alert alert-success",e.textContent="✅ Änderungen erfolgreich gespeichert",e.style.marginBottom="var(--space-md)",t.insertBefore(e,t.firstChild)}showError(t){const e=document.getElementById(`${this.drawerId}-body`);if(!e){alert(t);return}e.innerHTML=`
      <div class="alert alert-error">
        <strong>Fehler:</strong> ${t}
      </div>
    `}close(){const t=document.getElementById(this.drawerId);document.getElementById(`${this.drawerId}-overlay`),t&&t.classList.remove("show"),setTimeout(()=>{this.removeDrawer()},300)}removeDrawer(){const t=document.getElementById(this.drawerId),e=document.getElementById(`${this.drawerId}-overlay`);t&&t.remove(),e&&e.remove()}}export{u as RechnungAnpassenDrawer};
