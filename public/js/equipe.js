// Page d'une équipe (lien personnel) : liste de ses matchs et accès aux salles de match
(function () {
  const {esc, team, score, STATUS} = T;
  const q = new URLSearchParams(location.search);
  const id = q.get('id'), k = q.get('k');
  const view = document.getElementById('view');

  async function load() {
    try {
      const res = await fetch(`/api/tournoi/equipe/${encodeURIComponent(id || '')}?k=${encodeURIComponent(k || '')}`, {cache: 'no-store'});
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      const todo = d.matches.filter((m) => m.status !== 'done' && m.status !== 'waiting');
      const later = d.matches.filter((m) => m.status === 'waiting');
      const done = d.matches.filter((m) => m.status === 'done' && !m.bye);
      const card = (m) => `<div class="adm-match"><div class="top"><span class="mmeta" style="margin:0">${esc(m.roundName)} · BO${m.bo}</span><span class="pill ${m.status}">${STATUS[m.status]}</span></div>
        <div class="mrow"><div class="a">${team(m.a)}</div><div class="sc">${score(m)}</div><div class="b">${team(m.b)}</div></div>
        ${m.status !== 'done' && m.status !== 'waiting' ? `<a class="btn small" href="match.html?m=${m.id}&id=${encodeURIComponent(id)}&k=${encodeURIComponent(k)}">Entrer dans la salle</a>` : ''}</div>`;
      view.innerHTML = `<div class="page-head"><div class="kicker">${esc(d.compName)} · RAGE LAN 2026</div><h1 style="display:flex;align-items:center;gap:16px">${d.logo ? `<img src="${esc(d.logo)}" alt="" style="width:72px;height:72px;object-fit:contain">` : ''}${esc(d.name)}</h1></div>
        <div class="alert info">Garde ce lien : c'est ta page d'équipe. Ouvre la salle de chaque match pour ${d.comp === 'valorant' ? 'faire le ban de maps et ' : ''}déclarer le score.</div>
        <div class="panel"><h2>À jouer</h2><div class="mlist" style="gap:10px">${todo.map(card).join('') || '<p class="note">Aucun match à jouer pour le moment.</p>'}</div></div>
        ${later.length ? `<div class="panel"><h2>Prochains matchs</h2><div class="mlist" style="gap:10px">${later.map(card).join('')}</div></div>` : ''}
        ${done.length ? `<div class="panel"><h2>Terminés</h2><div class="mlist" style="gap:10px">${done.map(card).join('')}</div></div>` : ''}
        <p><a class="btn ghost" href="tournoi.html#${esc(d.comp)}">Voir tous les résultats</a></p>`;
    } catch (e) {
      view.innerHTML = '<div class="panel"><h2>Lien invalide</h2><p>Demande ton lien d\'équipe à un admin RushXP sur Discord.</p></div>';
    }
  }
  load(); setInterval(load, 10000);
})();
