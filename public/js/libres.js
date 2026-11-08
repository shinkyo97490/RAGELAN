// Joueurs libres : inscription en direct dans les salles de mini-tournoi créées par les admins
(function () {
  const {esc} = T;
  const me = document.getElementById('me');
  const roomsEl = document.getElementById('rooms');
  const rankEl = document.getElementById('rank');
  try { me.value = localStorage.getItem('rl-pseudo') || ''; } catch { /* stockage indisponible */ }
  me.addEventListener('change', () => { try { localStorage.setItem('rl-pseudo', me.value.trim()); } catch { /* idem */ } render(); });
  let data = null;
  const msg = {};

  function render() {
    if (!data) return;
    const mine = me.value.trim().toLowerCase();
    const rooms = data.rooms.slice().sort((a, b) => b.open - a.open);
    roomsEl.innerHTML = rooms.length ? `<div class="t-grid">${rooms.map((r) => {
      const inIt = mine && r.players.some((p) => p.pseudo.toLowerCase() === mine);
      const full = r.capacity && r.players.length >= r.capacity;
      return `<div class="t-card" style="${r.open ? '' : 'opacity:.6'}"><h3>${esc(r.name)}</h3>
        <div class="mmeta">${esc(r.game)} · <b>${r.players.length}${r.capacity ? ' / ' + r.capacity : ''}</b> inscrits · ${r.open ? (full ? '<span class="pill waiting">Complète</span>' : '<span class="pill paid">Ouverte</span>') : '<span class="pill waiting">Fermée</span>'}</div>
        ${r.info ? `<p style="white-space:pre-line">${esc(r.info)}</p>` : ''}
        <div class="chips" style="margin:10px 0">${r.players.map((p) => `<span class="chip ${p.pseudo.toLowerCase() === mine ? 'on' : ''}">${esc(p.pseudo)}${p.points !== null ? ` · ${p.points} pts` : ''}</span>`).join('') || '<span class="note">Sois le premier !</span>'}</div>
        ${inIt ? '<div class="alert ok">Tu es inscrit dans cette salle.</div>' : r.open && !full ? `<button class="btn small" data-join="${r.id}">Je m'inscris</button>` : ''}
        ${msg[r.id] ? `<div class="alert err" style="margin-top:10px">${esc(msg[r.id])}</div>` : ''}</div>`;
    }).join('')}</div>` : '<div class="panel"><p>Aucune salle ouverte pour le moment. Les admins les créent pendant la LAN : reviens vite !</p></div>';
    rankEl.innerHTML = data.classement.length ? `<table class="t-table"><thead><tr><th>#</th><th>Joueur</th><th>Salles</th><th>Points</th></tr></thead><tbody>
      ${data.classement.map((p, i) => `<tr ${p.pseudo.toLowerCase() === mine ? 'style="color:var(--orange)"' : ''}><td>${i + 1}</td><td><b>${esc(p.pseudo)}</b></td><td class="n">${p.rooms}</td><td class="n"><b>${p.points}</b></td></tr>`).join('')}</tbody></table>`
      : '<p class="note">Pas encore de points.</p>';
  }

  roomsEl.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-join]');
    if (!b) return;
    const pseudo = me.value.trim();
    if (!pseudo) { me.focus(); msg[b.dataset.join] = 'Indique ton pseudo en haut de la page.'; render(); return; }
    b.disabled = true;
    try {
      const res = await fetch('/api/libres/join', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({room: b.dataset.join, pseudo})});
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      delete msg[b.dataset.join];
      try { localStorage.setItem('rl-pseudo', pseudo); } catch { /* idem */ }
    } catch (err) { msg[b.dataset.join] = err.message; }
    load();
  });

  async function load() {
    try { data = await (await fetch('/api/tournoi', {cache: 'no-store'})).json(); render(); } catch { /* réessaie */ }
  }
  load(); setInterval(load, 8000);
})();
