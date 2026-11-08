// Accueil : compte à rebours, places restantes, Menus Best Of, état des inscriptions
(function () {
  document.documentElement.classList.add('js');
  const EVENT = new Date('2026-11-21T13:00:00+04:00').getTime();
  const pad = (n) => String(n).padStart(2, '0');

  // Compte à rebours J / H / MIN, rafraîchi toutes les 30 s (0 une fois l'heure passée)
  function tick() {
    const el = document.getElementById('countdown');
    if (!el) return;
    const d = Math.max(0, EVENT - Date.now()) / 1000;
    const v = {j: Math.floor(d / 86400), h: Math.floor((d % 86400) / 3600), m: Math.floor((d % 3600) / 60), s: Math.floor(d % 60)};
    for (const [k, n] of Object.entries(v)) {
      const t = el.querySelector(`[data-k="${k}"]`);
      if (t) t.textContent = pad(n);
    }
  }
  tick();
  setInterval(tick, 30000);

  const fmtDate = (iso) => new Date(iso).toLocaleDateString('fr-FR', {day: 'numeric', month: 'long', timeZone: 'Indian/Reunion'});

  async function loadStatus() {
    try {
      const st = await (await fetch('/api/status', {cache: 'no-store'})).json();
      document.querySelectorAll('#bestof-left, #bestof-left-2').forEach((e) => (e.textContent = st.bestOfRemaining));
      const now = Date.now();
      const before = now < new Date(st.openAt).getTime();
      const reg = document.getElementById('reg-state');
      const title = document.getElementById('reg-title');
      if (before) {
        if (reg) reg.textContent = `OUVERTURE DES INSCRIPTIONS LE ${fmtDate(st.openAt).toUpperCase()}`;
        if (title) title.textContent = 'BIENTÔT';
      } else if (!st.open) {
        if (reg) reg.textContent = 'INSCRIPTIONS CLOSES';
        if (title) title.textContent = 'CLOSES';
      }

      for (const [id, c] of Object.entries(st.competitions)) {
        const el = document.querySelector(`[data-places="${id}"]`);
        if (el) {
          if (c.remaining === 0) { el.textContent = 'COMPLET'; el.classList.add('full'); }
          else {
            const unit = c.remaining > 1 ? c.unit : c.unit.replace(/s$/, '');
            const adj = (c.unit === 'joueurs' ? 'restant' : 'restante') + (c.remaining > 1 ? 's' : '');
            el.innerHTML = `<span class="n">${c.remaining}</span> ${unit} ${adj} sur ${c.capacity}`;
          }
        }
        const bar = document.querySelector(`[data-bar="${id}"]`);
        if (bar) bar.style.width = `${Math.round((c.remaining / c.capacity) * 100)}%`;
        document.querySelectorAll(`[data-cta="${id}"]`).forEach((a) => {
          if (c.remaining === 0 || !st.open) {
            a.setAttribute('aria-disabled', 'true');
            a.textContent = c.remaining === 0 ? 'COMPLET' : before ? `OUVERTURE LE ${fmtDate(st.openAt).toUpperCase()}` : 'INSCRIPTIONS CLOSES';
          }
        });
      }
    } catch (e) { /* le site reste lisible sans le serveur */ }
  }
  loadStatus();
  setInterval(loadStatus, 30000);

  // Apparition des sections au défilement
  const els = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), {rootMargin: '0px 0px -6% 0px'});
    els.forEach((el) => io.observe(el));
  } else els.forEach((el) => el.classList.add('in'));
})();
