// Page publique des résultats : poules, phases finales, salles et classement Joueurs libres (rafraîchie toute seule)
(function () {
  const {esc, groupsHtml, matchRow, bracketHtml} = T;
  const view = document.getElementById('view');
  let tab = (location.hash || '#valorant').slice(1);
  let data = null;

  function render() {
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    if (!data) return;
    if (tab === 'libres') {
      view.innerHTML = `<div class="t-grid">${data.rooms.map((r) => `<div class="t-card"><h3>${esc(r.name)}</h3>
        <div class="mmeta">${esc(r.game)} · ${r.players.length}${r.capacity ? '/' + r.capacity : ''} inscrits · ${r.open ? '<span class="pill paid">Inscriptions ouvertes</span>' : '<span class="pill waiting">Fermée</span>'}</div>
        <div class="chips">${r.players.map((p) => `<span class="chip">${esc(p.pseudo)}${p.points !== null ? ` · ${p.points} pts` : ''}</span>`).join('') || '<span class="note">Personne pour l\'instant.</span>'}</div></div>`).join('') || '<p>Aucune salle pour le moment.</p>'}</div>
        <div class="t-card" style="margin-top:16px"><h3>Classement Joueurs libres</h3>${rank(data.classement)}</div>
        <p style="margin-top:16px"><a class="btn" href="libres.html">S'inscrire dans une salle</a></p>`;
      return;
    }
    const c = data.comps[tab];
    const groupMatches = c.matches.filter((m) => m.stage === 'group');
    const groupsByName = {};
    for (const m of groupMatches) (groupsByName[m.group] = groupsByName[m.group] || []).push(m);
    view.innerHTML = `${c.groups.length ? `<h2 class="h2" style="font-size:40px;margin:8px 0 14px">Phase de groupes</h2>${groupsHtml(c.groups)}
      <div class="t-grid" style="margin-top:16px">${Object.entries(groupsByName).map(([g, ms]) => `<div class="t-card"><h3>Matchs · poule ${esc(g)}</h3><div class="mlist">${ms.sort((a, b) => a.round - b.round || a.order - b.order).map(matchRow).join('')}</div></div>`).join('')}</div>` : ''}
      ${c.matches.some((m) => m.stage === 'bracket') ? `<h2 class="h2" style="font-size:40px;margin:28px 0 14px">Phase finale</h2>${bracketHtml(c.matches)}` : ''}
      ${!c.groups.length && !c.matches.length ? '<div class="panel"><p>Le tableau sera publié au début de la compétition.</p></div>' : ''}`;
  }
  function rank(list) {
    if (!list.length) return '<p class="note">Pas encore de points.</p>';
    return `<table class="t-table"><thead><tr><th>#</th><th>Joueur</th><th>Salles</th><th>Points</th></tr></thead><tbody>
      ${list.map((p, i) => `<tr><td>${i + 1}</td><td><b>${esc(p.pseudo)}</b></td><td class="n">${p.rooms}</td><td class="n"><b>${p.points}</b></td></tr>`).join('')}</tbody></table>`;
  }
  async function load() {
    try { data = await (await fetch('/api/tournoi', {cache: 'no-store'})).json(); render(); } catch { /* réessaie au prochain tour */ }
  }
  document.getElementById('tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    tab = b.dataset.tab; history.replaceState(null, '', '#' + tab); render();
  });
  render(); load(); setInterval(load, 15000);
})();
