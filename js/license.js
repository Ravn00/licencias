async function licHash(secret, clientId, month, year2d) {
  const raw = `${secret}|${clientId}|${String(month).padStart(2,'0')}|${String(year2d).padStart(2,'0')}`;
  try {
    if (crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('').toUpperCase().slice(0, 8);
    }
  } catch(e) {}
  return sha256(raw).toUpperCase().slice(0, 8);
}

async function licGenHandler() {
  if (!authedOnly()) return;
  const body = $("modal-body");
  const client = body?.querySelector("#lic-gen-client")?.value.trim().toUpperCase();
  if (!client) { toast("Ingresa un ID de cliente"); return; }
  const month = parseInt(body?.querySelector("#lic-gen-month")?.value || "1");
  const year2d = parseInt(body?.querySelector("#lic-gen-year")?.value || "26");
  const resultEl = body?.querySelector("#lic-gen-result");
  const outputEl = body?.querySelector("#lic-gen-output");
  let secret = adminConfig?.license_secret || "";
  if (!secret) {
    try {
      const cfg = await apiProxyRead("admin_config", "license_secret", "&limit=1");
      secret = (cfg && cfg[0]?.license_secret) || "";
    } catch(e) { secret = ""; }
  }
  const hash = await licHash(secret, client, month, year2d);
  const code = `AP-${client}-${String(month).padStart(2,'0')}${String(year2d).padStart(2,'0')}-${hash}`;
  if (outputEl) outputEl.value = code;
  if (resultEl) resultEl.style.display = "flex";
  toast("Código generado");
}
