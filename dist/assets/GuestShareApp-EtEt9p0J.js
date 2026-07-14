import{p as f}from"./auth-DqylGLjk.js";const b={kampagne:e=>`/kampagne/${e}`,sourcing:e=>`/sourcing/${e}`,strategie:e=>`/strategie/${e}`},w={kampagne:"Kampagne",sourcing:"Sourcing-Liste",strategie:"Strategie-Liste"};async function I(e){const t=document.getElementById("login-root"),n=document.getElementById("app-root");n&&(n.style.display="none"),t&&(t.style.display=""),l(t,"Link wird geprüft …");let i;try{const{data:a,error:r}=await window.supabase.functions.invoke("share-list",{body:{action:"resolve",token:e}});if(r){const d=await k(r);l(t,d||"Dieser Link ist ungültig oder wurde widerrufen.",!0);return}i=a}catch(a){console.error("Share-Resolve fehlgeschlagen:",a),l(t,"Der Link konnte nicht geprüft werden. Bitte später erneut versuchen.",!0);return}if(!i?.valid){l(t,i?.error||"Dieser Link ist ungültig oder wurde widerrufen.",!0);return}const{data:{session:o}}=await window.supabase.auth.getSession();if(o){if((o.user.email||"").toLowerCase()===i.email.toLowerCase()){await h(e,i);return}await window.supabase.auth.signOut()}v(t,e,i)}function v(e,t,n){const i=w[n.entityType]||"Liste";e.innerHTML=`
    <div class="guest-onboarding">
      <div class="guest-onboarding-card">
        <h2>Geteilte ${i}</h2>
        <p class="guest-onboarding-info">
          Dieser Zugang ist für <strong>${m(n.email)}</strong> bestimmt.
          Zur Bestätigung senden wir einen 6-stelligen Code an diese E-Mail-Adresse.
        </p>

        <div id="guest-step-name">
          <label class="label" for="guest-name-input">Ihr Name</label>
          <input type="text" id="guest-name-input" class="input" placeholder="Vor- und Nachname"
                 value="${m(n.gastName||"")}" autocomplete="name">
          <button id="guest-send-code" class="primary-btn guest-btn">Code anfordern</button>
        </div>

        <div id="guest-step-code" style="display:none;">
          <label class="label" for="guest-code-input">Sicherheitscode</label>
          <input type="text" id="guest-code-input" class="input" inputmode="numeric" maxlength="6"
                 placeholder="6-stelliger Code" autocomplete="one-time-code">
          <button id="guest-verify-code" class="primary-btn guest-btn">Bestätigen</button>
          <button id="guest-resend-code" class="guest-link-btn">Code erneut senden</button>
        </div>

        <p id="guest-error" class="guest-onboarding-error" style="display:none;"></p>
      </div>
    </div>
  `;const o=document.getElementById("guest-name-input"),a=document.getElementById("guest-code-input"),r=document.getElementById("guest-error"),d=s=>{r.textContent=s,r.style.display=""},u=()=>{r.style.display="none"},c=async s=>{if(u(),!o.value.trim()){d("Bitte geben Sie Ihren Namen ein.");return}s.disabled=!0,s.textContent="Wird gesendet …";const{error:p}=await window.supabase.auth.signInWithOtp({email:n.email,options:{shouldCreateUser:!1}});if(s.disabled=!1,s.textContent=s.id==="guest-send-code"?"Code anfordern":"Code erneut senden",p){console.error("OTP-Versand fehlgeschlagen:",p),d("Der Code konnte nicht gesendet werden. Bitte kurz warten und erneut versuchen.");return}document.getElementById("guest-step-name").style.display="none",document.getElementById("guest-step-code").style.display="",a.focus()};document.getElementById("guest-send-code").addEventListener("click",s=>c(s.currentTarget)),document.getElementById("guest-resend-code").addEventListener("click",s=>{s.preventDefault(),c(s.currentTarget)});const y=async()=>{u();const s=a.value.trim();if(!/^\d{6}$/.test(s)){d("Bitte geben Sie den 6-stelligen Code ein.");return}const g=document.getElementById("guest-verify-code");g.disabled=!0,g.textContent="Wird geprüft …";const{error:p}=await window.supabase.auth.verifyOtp({email:n.email,token:s,type:"email"});if(g.disabled=!1,g.textContent="Bestätigen",p){console.error("OTP-Verifikation fehlgeschlagen:",p),d("Der Code ist ungültig oder abgelaufen.");return}await h(t,n,o.value.trim())};document.getElementById("guest-verify-code").addEventListener("click",y),a.addEventListener("keydown",s=>{s.key==="Enter"&&y()})}async function h(e,t,n=""){const i=document.getElementById("login-root"),o=document.getElementById("app-root");l(i,"Liste wird geladen …");const{data:{session:a}}=await window.supabase.auth.getSession();if(!a){l(i,"Anmeldung fehlgeschlagen. Bitte den Link erneut öffnen.",!0);return}const{data:r,error:d}=await window.supabase.from("benutzer").select("*").eq("auth_user_id",a.user.id).single();if(d||!r){console.error("Gast-Benutzer konnte nicht geladen werden:",d),l(i,"Zugang konnte nicht geladen werden.",!0);return}if(n&&n!==r.name){const{error:c}=await window.supabase.from("benutzer").update({name:n}).eq("id",r.id);c||(r.name=n)}const u=b[t.entityType]?.(t.entityId);if(!u){l(i,"Unbekannter Listen-Typ.",!0);return}window.guestShare={token:e,entityType:t.entityType,entityId:t.entityId,rechte:t.rechte,allowedRoute:u},window.currentUser=r,f.setUserPermissions(r),f.setScopedPermissions([]);try{await window.supabase.rpc("touch_list_share",{p_token:e})}catch(c){console.warn("touch_list_share fehlgeschlagen:",c)}o.classList.add("guest-mode"),o.style.display="",i.style.display="none",await window.moduleRegistry.navigateTo(u,!0)}async function B(){const e=document.getElementById("login-root"),t=document.getElementById("app-root");t&&(t.style.display="none"),e&&(e.style.display="");let n=[];try{const{data:o}=await window.supabase.from("list_shares").select("token, entity_type, created_at").is("revoked_at",null).order("created_at",{ascending:!1});n=o||[]}catch(o){console.warn("Shares konnten nicht geladen werden:",o)}const i=n.map(o=>{const a=w[o.entity_type]||"Liste";return`
      <a class="guest-share-link" href="/share/${m(o.token)}">
        <span>${a} öffnen</span>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="16" height="16">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </a>`}).join("");e.innerHTML=`
    <div class="guest-onboarding">
      <div class="guest-onboarding-card">
        <h2>Kein Zugriff auf diesen Bereich</h2>
        <p class="guest-onboarding-info">
          Danke für Ihr Interesse — Ihr Zugang gilt nur für die mit Ihnen geteilten Listen.
        </p>
        ${n.length>0?`
          <div class="guest-share-links">${i}</div>
        `:`
          <p class="guest-onboarding-info" style="margin-bottom:16px;">
            Ihr Zugang wurde widerrufen oder es liegen keine geteilten Listen vor.
          </p>
        `}
        <button id="guest-logout-btn" class="guest-link-btn">Abmelden</button>
      </div>
    </div>
  `,document.getElementById("guest-logout-btn")?.addEventListener("click",async()=>{try{await window.supabase.auth.signOut()}finally{window.location.href="/"}})}function l(e,t,n=!1){e&&(e.innerHTML=`
    <div class="guest-onboarding">
      <div class="guest-onboarding-card">
        <p class="${n?"guest-onboarding-error":""}" style="margin:0;">${m(t)}</p>
      </div>
    </div>
  `)}async function k(e){try{if(e?.context&&typeof e.context.json=="function")return(await e.context.json())?.error||null}catch{}return null}function m(e){return String(e||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}export{I as initGuestShare,B as renderGuestNoAccess};
