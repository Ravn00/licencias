const SB_URL = "https://xkguzluwbbxsbustlcxo.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrZ3V6bHV3YmJ4c2J1c3RsY3hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNzQwOTUsImV4cCI6MjA5NTc1MDA5NX0.N6oatsQFuRPdlpKcwWnqNSvagtg1dGqjSNg2dzU9Tl0";

let adminPasswordHash = "";
let authed = false;
let adminConfig = null;
let allLoaded = false;
let writeToken = "";

function authedOnly() { if (!authed) { window.location.reload(); return false; } return true; }

async function checkSavedSession() {
  try {
    const saved = localStorage.getItem("ap_session");
    if (saved) {
      const s = JSON.parse(saved);
      if (s && s.exp > Date.now()) { authed = true; return true; }
    }
  } catch(_) {}
  return false;
}



async function doLogin() {
  await loadAdminConfig();
  const pw = document.getElementById("pw-input").value;
  const errEl = document.getElementById("pw-error");
  const hash = await getHash(pw);
  if (hash !== adminPasswordHash) {
    errEl.textContent = "Contraseña incorrecta";
    document.getElementById("pw-input").value = "";
    return;
  }
  authed = true;
  errEl.textContent = "";
  localStorage.setItem("ap_session", JSON.stringify({ exp: Date.now() + 86400000 }));
  document.getElementById("pw-gate").classList.add("gone");
  document.getElementById("app-layout").style.display = "flex";
  loadAllData();
}

async function loadAdminConfig() {
  try {
    const data = await sbFetch("/rest/v1/admin_config?select=*&limit=1", "GET");
    if (data && data.length > 0) {
      adminConfig = data[0];
      if (typeof adminConfig.api_keys === "string") {
        try { adminConfig.api_keys = JSON.parse(adminConfig.api_keys); } catch(_) { adminConfig.api_keys = []; }
      }
      if (!Array.isArray(adminConfig.api_keys)) adminConfig.api_keys = [];
      if (adminConfig.password_hash) adminPasswordHash = adminConfig.password_hash;
      writeToken = adminConfig.write_token || "";
    } else { adminConfig = null; }
  } catch(e) { console.warn("loadAdminConfig:", e); adminConfig = null; }
  return adminConfig;
}

async function upsertAdminConfig(payload) {
  const hasExisting = adminConfig && adminConfig.id;
  if (hasExisting) {
    delete payload.id;
    const ok = await apiProxy("admin_config", "PATCH", payload, "?id=eq.global");
    if (!ok) await sbFetch("/rest/v1/admin_config?id=eq.global", "PATCH", payload);
  } else {
    const ok = await apiProxy("admin_config", "POST", { id: "global", ...payload });
    if (!ok) await sbFetch("/rest/v1/admin_config", "POST", { id: "global", ...payload });
  }
}

async function updateAdminConfig(updates) {
  try {
    const payload = { ...updates, updated_at: new Date().toISOString() };
    await upsertAdminConfig(payload);
  } catch(e) { console.warn("updateAdminConfig:", e); toast("Error al guardar"); }
  await loadAdminConfig();
}
