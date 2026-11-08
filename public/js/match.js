// Salle de match : ban de maps Valorant puis déclaration du score par chaque équipe
(function () {
  const {esc, team, STATUS, vetoLog, SIDE} = T;
  const q = new URLSearchParams(location.search);
  const mid = q.get('m'), k = q.get('k'), regId = q.get('id');
  const view = document.getElementById('view');
  if (regId) document.getElementById('back').href = `equipe.html?id=${encodeURIComponent(regId)}&k=${encodeURIComponent(k || '')}`;
  let m = null, err = '', busy = false, lastSig = '';

  async function post(path, body) {
    busy = true;
    try {
      const res = await fetch(`/api/tournoi/match/${mid}/${path}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({k, ...body})});
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      m = d; err = '';
    } catch (e) { err = e.message; }
    busy = false; lastSig = ''; render();
  }

  function vetoHtml() {
    const v = m.veto;
    if (!v) return m.comp === 'valorant' ? '<div class="panel"><h2>Ban de maps</h2><p class="note">Le map pool n\'est pas encore configuré : attends un admin.</p></div>' : '';
    const me = m.mySide, nameA = m.a?.name, nameB = m.b?.name;
    const mine = v.next && v.next.team === me;
    const banned = new Set(v.steps.filter((s) => s.act === 'ban').map((s) => s.map));
    const picked = new Set(v.steps.filter((s) => s.act === 'pick' || s.act === 'decider').map((s) => s.map));
    let prompt;
    if (!v.next) prompt = '<div class="alert ok">Ban de maps terminé. Bon match !</div>';
    else if (v.next.act === 'side') prompt = mine
      ? `<div class="alert info"><b>Choisis ton côté de départ sur ${esc(v.next.map)}</b></div><div class="inl"><button class="btn" data-side="attaque">Attaque</button><button class="btn" data-side="defense">Défense</button></div>`
      : `<div class="alert info">L'adversaire choisit son côté sur ${esc(v.next.map)}…</div>`;
    else prompt = mine ? `<div class="alert info"><b>À toi : ${v.next.act === 'ban' ? 'bannis' : 'choisis'} une map</b> (clique dessus)</div>`
      : `<div class="alert info">L'adversaire ${v.next.act === 'ban' ? 'bannit' : 'choisit'} une map…</div>`;
    const canClick = mine && v.next && v.next.act !== 'side' && m.status !== 'done';
    return `<div class="panel"><h2>Ban de maps · BO${m.bo}</h2>${prompt}
      <div class="veto">${v.pool.map((map) => `<button type="button" data-map="${esc(map)}" class="${banned.has(map) ? 'ban' : picked.has(map) ? 'pick' : canClick ? 'can' : ''}" ${canClick && v.remaining.includes(map) ? '' : 'disabled'}>${esc(map)}</button>`).join('')}</div>
      ${v.maps.length ? `<h3 style="margin:14px 0 6px">Maps du match</h3><ol>${v.maps.map((x) => `<li><b>${esc(x.map)}</b>${x.pickedBy ? ` · choisie par ${esc(x.pickedBy === 'a' ? nameA : nameB)}` : ' · décisive'}${x.side ? ` · ${esc(x.sideBy === 'a' ? nameA : nameB)} en ${SIDE[x.side]}` : ''}</li>`).join('')}</ol>` : ''}
      <details style="margin-top:10px"><summary>Historique</summary><div class="veto-log">${vetoLog(m, nameA, nameB) || '—'}</div></details></div>`;
  }

  function reportHtml() {
    if (m.status === 'done') return `<div class="panel"><h2>Résultat validé</h2><div class="alert ok">${esc(m.a.name)} ${m.scoreA} - ${m.scoreB} ${esc(m.b.name)}</div></div>`;
    if (m.status === 'waiting') return '<div class="panel"><p>L\'adversaire n\'est pas encore connu.</p></div>';
    const label = m.bo > 1 ? 'Maps gagnées' : m.comp === 'valorant' ? 'Rounds' : 'Buts';
    const mine = m.myReport, other = m.otherReport;
    return `<div class="panel"><h2>Déclarer le score</h2>
      ${m.status === 'disputed' ? '<div class="alert err">Les deux équipes ont déclaré des scores différents. Corrigez ou appelez un admin.</div>' : ''}
      ${mine && !other ? '<div class="alert info">Ton score est envoyé. On attend la confirmation de l\'adversaire.</div>' : ''}
      ${other && !mine ? `<div class="alert info">L'adversaire a déclaré <b>${other.scoreA} - ${other.scoreB}</b>. Confirme si c'est correct.</div>` : ''}
      <p class="note">${label} · le résultat est validé quand les deux équipes déclarent le même score.</p>
      <div class="inl" style="font-weight:800">${team(m.a)}<input type="number" min="0" max="99" id="sa" value="${mine?.scoreA ?? other?.scoreA ?? ''}">
        <span>-</span><input type="number" min="0" max="99" id="sb" value="${mine?.scoreB ?? other?.scoreB ?? ''}">${team(m.b)}</div>
      <p style="margin-top:14px"><button class="btn" id="send">${mine ? 'Modifier mon score' : 'Envoyer le score'}</button></p></div>`;
  }

  function render() {
    if (!m) return;
    const sig = JSON.stringify([m.status, m.veto?.steps?.length, m.reports, m.myReport, m.otherReport, err]);
    if (sig === lastSig) return; // évite d'effacer une saisie en cours
    lastSig = sig;
    view.innerHTML = `<div class="page-head"><div class="kicker">${esc(m.roundName)} · BO${m.bo}</div>
      <h1 style="font-size:clamp(30px,6vw,56px)">${esc(m.a?.name || '?')} <span class="fire">vs</span> ${esc(m.b?.name || '?')}</h1>
      <p class="mmeta">Tu joues avec <b>${esc((m.mySide === 'a' ? m.a : m.b).name)}</b> · <span class="pill ${m.status}">${STATUS[m.status]}</span></p></div>
      ${err ? `<div class="alert err">${esc(err)}</div>` : ''}
      ${m.comp === 'valorant' ? vetoHtml() : ''}${reportHtml()}`;
  }

  view.addEventListener('click', (e) => {
    if (busy) return;
    const map = e.target.closest('[data-map]:not(:disabled)'), side = e.target.closest('[data-side]');
    if (map) { const act = m.veto.next.act === 'ban' ? 'Bannir' : 'Choisir'; if (confirm(`${act} ${map.dataset.map} ?`)) post('veto', {map: map.dataset.map}); }
    else if (side) post('veto', {side: side.dataset.side});
    else if (e.target.id === 'send') {
      const a = Number(document.getElementById('sa').value), b = Number(document.getElementById('sb').value);
      if (document.getElementById('sa').value === '' || document.getElementById('sb').value === '') { err = 'Indique les deux scores.'; lastSig = ''; render(); return; }
      if (confirm(`Confirmer le score ${m.a.name} ${a} - ${b} ${m.b.name} ?`)) post('report', {scoreA: a, scoreB: b});
    }
  });

  async function load() {
    if (busy) return;
    try {
      const res = await fetch(`/api/tournoi/match/${encodeURIComponent(mid || '')}?k=${encodeURIComponent(k || '')}`, {cache: 'no-store'});
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      m = d; render();
    } catch (e) {
      if (!m) view.innerHTML = `<div class="panel"><h2>Accès impossible</h2><p>${esc(e.message)}</p></div>`;
    }
  }
  load(); setInterval(load, 3000);
})();
