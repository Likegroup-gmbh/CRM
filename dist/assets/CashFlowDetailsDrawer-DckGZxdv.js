class u{constructor(){this.drawer=null,this.entries=[]}async open(t,e,s,a,r){this.entries=t,this.unternehmenName=e,this.markeName=s,this.monatName=a,this.year=r,this.createDrawer(),this.bindEvents(),requestAnimationFrame(()=>{this.drawer.classList.add("active")})}createDrawer(){const t=document.createElement("div");t.className="drawer-overlay",t.innerHTML=`
      <div class="drawer-panel drawer-panel-wide">
        ${this.renderHeader()}
        ${this.renderBody()}
        ${this.renderFooter()}
      </div>
    `,document.body.appendChild(t),this.drawer=t}renderHeader(){const t=this.markeName?` - ${this.markeName}`:"";return`
      <div class="drawer-header">
        <div>
          <h2 class="drawer-title">Kundenrechnungen im ${this.monatName} ${this.year}</h2>
          <p class="drawer-subtitle">${this.escapeHtml(this.unternehmenName)}${t}</p>
        </div>
        <button class="drawer-close-btn" data-action="close">&times;</button>
      </div>
    `}renderBody(){if(this.entries.length===0)return`
        <div class="drawer-body">
          <div class="empty-state">
            <p>Keine Rechnungen gefunden.</p>
          </div>
        </div>
      `;const t=this.entries.reduce((e,s)=>e+(parseFloat(s.betrag)||0),0);return`
      <div class="drawer-body">
        <div class="table-container">
          <table class="data-table cash-flow-details-table">
            <thead>
              <tr>
                <th style="width: 30%;">Auftragsname</th>
                <th style="width: 15%;">RE-Nr</th>
                <th style="width: 15%;">Nettobetrag</th>
                <th style="width: 12%;">Status</th>
                <th style="width: 14%;">Rechnung gestellt</th>
                <th style="width: 14%;">Überwiesen</th>
              </tr>
            </thead>
            <tbody>
              ${this.entries.map(e=>this.renderEntryRow(e)).join("")}
            </tbody>
            <tfoot>
              <tr>
                <td style="text-align: left; font-weight: 600;">Gesamt:</td>
                <td></td>
                <td style="font-weight: 600;">${this.formatCurrency(t)}</td>
                <td colspan="3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `}renderEntryRow(t){const e=`<span class="status-badge status-success">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
        <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
      </svg>
    </span>`,s='<span class="status-badge status-inactive">—</span>',a=t.rechnung_gestellt?e:s,r=t.ueberwiesen?e:s,n=t.rechnung_gestellt_am?`<br><small style="color: var(--text-secondary);">${this.formatDate(t.rechnung_gestellt_am)}</small>`:"",i=t.ueberwiesen_am?`<br><small style="color: var(--text-secondary);">${this.formatDate(t.ueberwiesen_am)}</small>`:"",d={paid:"Bezahlt",invoiced:"Gestellt",pending:"Offen"},o={paid:"status-success",invoiced:"status-warning",pending:"status-inactive"},l=d[t.status]||"Offen",c=o[t.status]||"status-inactive";return`
      <tr>
        <td style="text-align: left;">${this.escapeHtml(t.auftragsname||"Unbenannt")}</td>
        <td>${this.escapeHtml(t.reNr||"—")}</td>
        <td style="font-weight: 500;">${this.formatCurrency(t.betrag)}</td>
        <td><span class="status-badge ${c}">${l}</span></td>
        <td>${a}${n}</td>
        <td>${r}${i}</td>
      </tr>
    `}renderFooter(){return`
      <div class="drawer-footer">
        <button class="primary-btn" data-action="close">Schließen</button>
      </div>
    `}bindEvents(){this.drawer.querySelectorAll('[data-action="close"]').forEach(t=>{t.addEventListener("click",()=>this.close())}),this.drawer.addEventListener("click",t=>{t.target===this.drawer&&this.close()}),this.escapeHandler=t=>{t.key==="Escape"&&this.close()},document.addEventListener("keydown",this.escapeHandler)}close(){this.drawer.classList.remove("active"),setTimeout(()=>{document.removeEventListener("keydown",this.escapeHandler),this.drawer.remove(),this.drawer=null},300)}formatCurrency(t){return!t||isNaN(t)?"0,00 €":`${parseFloat(t).toLocaleString("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2})} €`}formatDate(t){if(!t)return"";const e=new Date(t),s=String(e.getDate()).padStart(2,"0"),a=String(e.getMonth()+1).padStart(2,"0"),r=e.getFullYear();return`${s}.${a}.${r}`}escapeHtml(t){return t?t.toString().replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"):""}}export{u as CashFlowDetailsDrawer};
