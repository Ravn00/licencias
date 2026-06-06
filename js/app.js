document.getElementById("pw-btn").onclick = doLogin;
document.getElementById("pw-input").addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });

// ---
// INIT
// ---
window.addEventListener("load", async () => {
  const valid = await checkSavedSession();
  if (valid) {
    authed = true;
    document.getElementById("pw-gate").classList.add("gone");
    document.getElementById("app-layout").style.display = "flex";
    loadAllData();
  }
  $("pw-input").focus();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
  const stored = localStorage.getItem('ap_theme_panel');
  if (stored === 'light') document.documentElement.classList.add('light');
});

// Theme toggle
(function() {
  const btn = document.getElementById('sidebar-theme');
  const icon = document.getElementById('side-theme-icon');
  if (!btn) return;
  btn.onclick = () => {
    const isLight = document.documentElement.classList.toggle('light');
    localStorage.setItem('ap_theme_panel', isLight ? 'light' : 'dark');
  };
})();
