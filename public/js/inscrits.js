// Section « Les inscrits » : équipes et joueurs dont l'inscription est payée (pseudos uniquement)
(function () {
  const root = document.getElementById('inscrits');
  if (!root) return;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const TABS = [
    {id: 'valorant', name: 'VALORANT', unit: 'ÉQUIPES DE 5', hue: 20},
    {id: 'rocketleague', name: 'ROCKET LEAGUE', unit: 'ÉQUIPES DE 3', hue: 210},
    {id: 'fc27', name: 'EA SPORTS FC 27 / FUT', unit: 'JOUEURS SOLO'},
    {id: 'libres', name: 'JOUEURS LIBRES', unit: 'JOUEURS LIBRES'},
  ];
  let data = null, tab = 'valorant', q = '';

  const taken = (c) => (c.team ? c.teams.length * c.size : c.players.length);
  const initial = (name) => (String(name).trim()[0] || '?').toUpperCase();

  function renderTabs() {
    $('insc-tabs').innerHTML = TABS.map((t) => {
      const c = data[t.id], on = t.id === tab;
      // Valorant et Rocket League : compté en équipes ; FC 27 et Joueurs libres : en joueurs
      const n = c.team ? c.teams.length : c.players.length, cap = c.team ? c.maxTeams : c.places;
      const left = Math.max(0, cap - n), what = c.team ? (left > 1 ? 'ÉQUIPES RESTANTES' : 'ÉQUIPE RESTANTE') : (left > 1 ? 'PLACES RESTANTES' : 'PLACE RESTANTE');
      return `<button type="button" role="tab" aria-selected="${on}" class="insc-tab ${on ? 'on' : ''}" data-tab="${t.id}">
        <span class="row"><span class="nm">${t.name}</span><span class="ct">${n} / ${cap}</span></span>
        <span class="gauge"><i style="width:${Math.min(100, Math.round(n / cap * 100))}%"></i></span>
        <span class="left">${left} ${what}</span></button>`;
    }).join('');
  }

  function renderList() {
    const t = TABS.find((x) => x.id === tab), c = data[tab], s = q.trim().toLowerCase();
    const has = (v) => !s || String(v).toLowerCase().includes(s);
    $('insc-sub').textContent = c.team
      ? `${t.name} · ${c.teams.length} ÉQUIPE${c.teams.length > 1 ? 'S' : ''} INSCRITE${c.teams.length > 1 ? 'S' : ''} · ${t.unit}`
      : `${t.name} · ${c.players.length} INSCRIT${c.players.length > 1 ? 'S' : ''} · ${t.unit}`;
    let html = '';
    if (c.team) {
      const teams = c.teams.map((tm, i) => ({...tm, seed: i + 1})).filter((tm) => has(tm.name) || tm.players.some(has));
      html = teams.map((tm) => `<div class="insc-team"><div class="hd"><div class="id">
          <div class="insc-logo" style="${tm.logo ? '' : `background:hsl(${(tm.seed * 47 + t.hue) % 360} 70% 62%)`}">${tm.logo ? `<img src="${esc(tm.logo)}" alt="" loading="lazy">` : `<span>${esc(initial(tm.name))}</span>`}</div>
          <div class="meta"><span class="seed">#${String(tm.seed).padStart(2, '0')}</span><span class="tn">${esc(tm.name)}</span><span class="insc-badge">CONFIRMÉE</span></div></div></div>
        <div class="pl">${tm.players.map((p, j) => `<div><span>${esc(p)}</span>${j === 0 ? '<em>CAPITAINE</em>' : ''}</div>`).join('')}</div></div>`).join('');
      html = html ? `<div class="insc-teams">${html}</div>` : '';
      if (!html) html = `<p class="insc-empty">${s ? `Aucun résultat pour « ${esc(q)} ».` : 'Aucune équipe confirmée pour l’instant.'}</p>`;
    } else {
      const list = c.players.map((p, i) => ({p, n: i + 1})).filter((x) => has(x.p));
      html = list.length ? `<div class="insc-solos">${list.map((x) => `<div class="insc-solo"><span>${esc(x.p)}</span><small>#${String(x.n).padStart(2, '0')}</small></div>`).join('')}</div>`
        : `<p class="insc-empty">${s ? `Aucun résultat pour « ${esc(q)} ».` : 'Personne pour l’instant : sois le premier !'} ${s ? '' : '<a href="#inscription">S’inscrire →</a>'}</p>`;
    }
    $('insc-list').innerHTML = html;
  }

  function render() {
    if (!data) return;
    $('insc-total').textContent = TABS.reduce((n, t) => n + taken(data[t.id]), 0);
    renderTabs(); renderList();
  }

  $('insc-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    tab = b.dataset.tab; q = ''; $('insc-q').value = ''; render();
  });
  $('insc-q').addEventListener('input', (e) => { q = e.target.value; renderList(); });

  async function load() {
    try { data = await (await fetch('/api/inscrits', {cache: 'no-store'})).json(); render(); } catch { /* réessaie plus tard */ }
  }
  load();
  setInterval(load, 60000);
})();
