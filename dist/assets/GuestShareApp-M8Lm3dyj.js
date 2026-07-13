import{p as f}from"./auth-DqylGLjk.js";const b={kampagne:e=>`/kampagne/${e}`,sourcing:e=>`/sourcing/${e}`,strategie:e=>`/strategie/${e}`},h={kampagne:"Kampagne",sourcing:"Sourcing-Liste",strategie:"Strategie-Liste"};async function I(e){const t=document.getElementById("login-root"),s=document.getElementById("app-root");s&&(s.style.display="none"),t&&(t.style.display=""),u(t,"Link wird geprüft …");let i;try{const{data:o,error:r}=await window.supabase.functions.invoke("share-list",{body:{action:"resolve",token:e}});if(r){const a=await E(r);u(t,a||"Dieser Link ist ungültig oder wurde widerrufen.",!0);return}i=o}catch(o){console.error("Share-Resolve fehlgeschlagen:",o),u(t,"Der Link konnte nicht geprüft werden. Bitte später erneut versuchen.",!0);return}if(!i?.valid){u(t,i?.error||"Dieser Link ist ungültig oder wurde widerrufen.",!0);return}const{data:{session:d}}=await window.supabase.auth.getSession();if(d){if((d.user.email||"").toLowerCase()===i.email.toLowerCase()){await w(e,i);return}await window.supabase.auth.signOut()}v(t,e,i)}function v(e,t,s){const i=h[s.entityType]||"Liste";e.innerHTML=`
    <div class="guest-onboarding">
      <div class="guest-onboarding-card">
        <h2>Geteilte ${i}</h2>
        <p class="guest-onboarding-info">
          Dieser Zugang ist für <strong>${m(s.email)}</strong> bestimmt.
          Zur Bestätigung senden wir einen 6-stelligen Code an diese E-Mail-Adresse.
        </p>

        <div id="guest-step-name">
          <label class="label" for="guest-name-input">Ihr Name</label>
          <input type="text" id="guest-name-input" class="input" placeholder="Vor- und Nachname"
                 value="${m(s.gastName||"")}" autocomplete="name">
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
  `;const d=document.getElementById("guest-name-input"),o=document.getElementById("guest-code-input"),r=document.getElementById("guest-error"),a=n=>{r.textContent=n,r.style.display=""},l=()=>{r.style.display="none"},c=async n=>{if(l(),!d.value.trim()){a("Bitte geben Sie Ihren Namen ein.");return}n.disabled=!0,n.textContent="Wird gesendet …";const{error:p}=await window.supabase.auth.signInWithOtp({email:s.email,options:{shouldCreateUser:!1}});if(n.disabled=!1,n.textContent=n.id==="guest-send-code"?"Code anfordern":"Code erneut senden",p){console.error("OTP-Versand fehlgeschlagen:",p),a("Der Code konnte nicht gesendet werden. Bitte kurz warten und erneut versuchen.");return}document.getElementById("guest-step-name").style.display="none",document.getElementById("guest-step-code").style.display="",o.focus()};document.getElementById("guest-send-code").addEventListener("click",n=>c(n.currentTarget)),document.getElementById("guest-resend-code").addEventListener("click",n=>{n.preventDefault(),c(n.currentTarget)});const y=async()=>{l();const n=o.value.trim();if(!/^\d{6}$/.test(n)){a("Bitte geben Sie den 6-stelligen Code ein.");return}const g=document.getElementById("guest-verify-code");g.disabled=!0,g.textContent="Wird geprüft …";const{error:p}=await window.supabase.auth.verifyOtp({email:s.email,token:n,type:"email"});if(g.disabled=!1,g.textContent="Bestätigen",p){console.error("OTP-Verifikation fehlgeschlagen:",p),a("Der Code ist ungültig oder abgelaufen.");return}await w(t,s,d.value.trim())};document.getElementById("guest-verify-code").addEventListener("click",y),o.addEventListener("keydown",n=>{n.key==="Enter"&&y()})}async function w(e,t,s=""){const i=document.getElementById("login-root"),d=document.getElementById("app-root");u(i,"Liste wird geladen …");const{data:{session:o}}=await window.supabase.auth.getSession();if(!o){u(i,"Anmeldung fehlgeschlagen. Bitte den Link erneut öffnen.",!0);return}const{data:r,error:a}=await window.supabase.from("benutzer").select("*").eq("auth_user_id",o.user.id).single();if(a||!r){console.error("Gast-Benutzer konnte nicht geladen werden:",a),u(i,"Zugang konnte nicht geladen werden.",!0);return}if(s&&s!==r.name){const{error:c}=await window.supabase.from("benutzer").update({name:s}).eq("id",r.id);c||(r.name=s)}const l=b[t.entityType]?.(t.entityId);if(!l){u(i,"Unbekannter Listen-Typ.",!0);return}window.guestShare={token:e,entityType:t.entityType,entityId:t.entityId,rechte:t.rechte,allowedRoute:l},window.currentUser=r,f.setUserPermissions(r),f.setScopedPermissions([]);try{await window.supabase.rpc("touch_list_share",{p_token:e})}catch(c){console.warn("touch_list_share fehlgeschlagen:",c)}d.classList.add("guest-mode"),d.style.display="",i.style.display="none",await window.moduleRegistry.navigateTo(l,!0)}function u(e,t,s=!1){e&&(e.innerHTML=`
    <div class="guest-onboarding">
      <div class="guest-onboarding-card">
        <p class="${s?"guest-onboarding-error":""}" style="margin:0;">${m(t)}</p>
      </div>
    </div>
  `)}async function E(e){try{if(e?.context&&typeof e.context.json=="function")return(await e.context.json())?.error||null}catch{}return null}function m(e){return String(e||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}export{I as initGuestShare};
