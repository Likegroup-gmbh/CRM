class s{static show(){return new Promise(i=>{const n=document.querySelector(".kickoff-type-modal");n&&n.remove();const e=document.createElement("div");e.className="modal overlay-modal kickoff-type-modal",e.innerHTML=`
        <div class="modal-dialog" style="max-width: 560px;">
          <div class="modal-header">
            <h3>Strategiebriefing anlegen</h3>
            <button class="modal-close" data-action="close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="kickoff-type-options">
              <button type="button" class="kickoff-type-option" data-type="influencer">
                <span class="kickoff-type-option__label">Influencer</span>
                <span class="kickoff-type-option__desc">Creator-Content mit klarem Ziel und Format</span>
              </button>
              <button type="button" class="kickoff-type-option" data-type="organic">
                <span class="kickoff-type-option__label">Organic</span>
                <span class="kickoff-type-option__desc">Organische Reichweite, Format und Content-Logik</span>
              </button>
              <button type="button" class="kickoff-type-option" data-type="paid">
                <span class="kickoff-type-option__label">Paid</span>
                <span class="kickoff-type-option__desc">Bezahlte Kampagnen, Funnel und Performance-Ziel</span>
              </button>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="secondary-btn" data-action="cancel">Abbrechen</button>
          </div>
        </div>`,document.body.appendChild(e);const o=t=>{e.parentNode&&(window.removeEventListener("keydown",a),e.remove(),i(t))};e.querySelector('[data-action="close"]').addEventListener("click",()=>o(null)),e.querySelector('[data-action="cancel"]').addEventListener("click",()=>o(null)),e.addEventListener("click",t=>{t.target===e&&o(null)}),e.querySelectorAll(".kickoff-type-option").forEach(t=>{t.addEventListener("click",()=>o(t.dataset.type))});const a=t=>{t.key==="Escape"&&o(null)};window.addEventListener("keydown",a)})}}export{s as KickOffTypeDialog};
