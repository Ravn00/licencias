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

function sha256(str) {
  const chrsz = 8;
  function safe_add(x, y) { const lsw = (x & 0xFFFF) + (y & 0xFFFF); return (x >>> 16) + (y >>> 16) + (lsw >>> 16) << 16 | lsw & 0xFFFF; }
  function S(X, n) { return X >>> n; } function R(X, n) { return X << n >>> 0; }
  function Ch(x, y, z) { return x & y ^ ~x & z; } function Maj(x, y, z) { return x & y ^ x & z ^ y & z; }
  function Sigma0256(x) { return S(x, 2) ^ S(x, 13) ^ S(x, 22); } function Sigma1256(x) { return S(x, 6) ^ S(x, 11) ^ S(x, 25); }
  function Gamma0256(x) { return S(x, 7) ^ S(x, 18) ^ R(x, 3); } function Gamma1256(x) { return S(x, 17) ^ S(x, 19) ^ R(x, 10); }
  const K = [1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298];
  const l = str.length * chrsz; const m = [];
  for (let i = 0; i < l; i += chrsz) m[i>>5] |= (str.charCodeAt(i / chrsz) & 0xFF) << (24 - i % 32);
  m[l>>5] |= 0x80 << (24 - l % 32); m[((l + 64 >> 9) << 4) + 15] = l;
  let H = [1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225];
  for (let i = 0; i < m.length; i += 16) {
    const W = new Array(64);
    for (let t = 0; t < 16; t++) W[t] = m[i + t];
    for (let t = 16; t < 64; t++) W[t] = safe_add(safe_add(safe_add(Gamma1256(W[t - 2]), W[t - 7]), Gamma0256(W[t - 15])), W[t - 16]);
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let t = 0; t < 64; t++) {
      const T1 = safe_add(safe_add(safe_add(safe_add(h, Sigma1256(e)), Ch(e, f, g)), K[t]), W[t]);
      const T2 = safe_add(Sigma0256(a), Maj(a, b, c));
      h = g; g = f; f = e; e = safe_add(d, T1); d = c; c = b; b = a; a = safe_add(T1, T2);
    }
    H[0] = safe_add(H[0], a); H[1] = safe_add(H[1], b); H[2] = safe_add(H[2], c); H[3] = safe_add(H[3], d);
    H[4] = safe_add(H[4], e); H[5] = safe_add(H[5], f); H[6] = safe_add(H[6], g); H[7] = safe_add(H[7], h);
  }
  return H.map(x => ("0123456789abcdef").split("").reduce((s, _, i) => s + "0123456789abcdef"[(x >>> (7 - i) * 4) & 15], "")).join("");
}

async function getHash(str) {
  try {
    if (crypto.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,"0")).join("");
    }
  } catch(_) {}
  return sha256(str);
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

async function sbFetch(path, method="GET", body=null) {
  const opts = { method, headers: { "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}`, "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(SB_URL + path, opts);
    if (!res.ok) {
      console.error("sbFetch error:", method, path, res.status);
      return null;
    }
    if (method === "DELETE" || method === "PATCH") return true;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("json")) return res.json();
    return null;
  } catch(e) {
    console.error("sbFetch error:", e.message);
    return null;
  }
}

async function sbFetchAll(path) {
  let all = [], page = 0, pageSize = 1000;
  while (true) {
    const offset = page * pageSize;
    const url = `${path}&offset=${offset}&limit=${pageSize}`;
    const data = await sbFetch(url, "GET");
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    page++;
  }
  return all;
}

async function apiProxy(table, method, body, query) {
  if (!writeToken) { console.warn("apiProxy: no write token"); return null; }
  try {
    const res = await fetch(`${SB_URL}/functions/v1/api-proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-write-token": writeToken },
      body: JSON.stringify({ table, method, body, query: query || "" })
    });
    if (!res.ok) { console.warn("apiProxy error:", res.status); return null; }
    return true;
  } catch(e) { console.warn("apiProxy error:", e.message); return null; }
}

async function resetAllData() {
  const step1 = confirm("⚠️ RESET TOTAL\n\nEsto eliminará TODOS los datos:\n• Catálogo completo\n• Ventas registradas\n• Historial de escaneos\n• Dispositivos\n• Configuración\n\n¿Estás seguro?");
  if (!step1) return;
  const step2 = confirm("ÚLTIMA ADVERTENCIA\n\nEsta acción NO se puede deshacer.\nTodo el localStorage y los datos en Supabase serán eliminados.\n\n¿Confirmas?");
  if (!step2) return;
  localStorage.clear();
  if (writeToken) {
    try {
      await fetch(`${SB_URL}/functions/v1/api-proxy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-write-token": writeToken },
        body: JSON.stringify({ action: "reset-all" })
      });
    } catch(e) { console.warn("reset-all error:", e); }
  }
  location.reload();
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
