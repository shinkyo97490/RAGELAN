// Accueil le jour J : cocher la présence, l'autorisation parentale (mineurs) et l'adulte accompagnateur (moins de 16 ans)
(function () {
  const COMPS = {
    valorant: {name: 'Valorant', color: 'var(--valorant)'},
    rocketleague: {name: 'Rocket League', color: 'var(--rl)'},
    fc27: {name: 'EA Sports FC 27 FUT', color: 'var(--fc)'},
    brawlstars: {name: 'Brawl Stars', color: 'var(--brawl, #ffc21a)'},
  };
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  let pwd = sessionStorage.getItem('rl-admin') || '';
  let regs = [];

  async function load() {
    try {
      const res = await fetch('/api/admin/inscriptions', {headers: {'x-admin-password': pwd}, cache: 'no-store'});
      if (res.status === 401) throw Object.assign(new Error('Mot de passe incorrect.'), {auth: true});
      const d = await res.json();
      regs = d.inscriptions.filter((r) => r.status === 'paid' && COMPS[r.competition]);
      sessionStorage.setItem('rl-admin', pwd);
      $('#login').classList.add('hide'); $('#app').classList.remove('hide');
      render();
    } catch (e) {
      if (e.auth) { sessionStorage.removeItem('rl-admin'); $('#app').classList.add('hide'); $('#login').classList.remove('hide'); if (pwd) $('#login-err').innerHTML = `<div class="alert err">${esc(e.message)}</div>`; }
      else alert('Impossible de charger les inscriptions : ' + e.message);
    }
  }

  // Un joueur est « en règle » quand il est présent, que son autorisation est reçue s'il est mineur et que son accompagnateur est là s'il a moins de 16 ans
  const complete = (p) => p.present && (!p.mineur || p.autorisationRecue) && (!p.moins16 || p.accompPresent);

  function render() {
    const q = norm($('#q').value), only = $('#comp').value, show = $('#show').value;
    const all = regs.flatMap((r) => r.players.map((p) => ({r, p})));
    const st = {
      total: all.length, here: all.filter((x) => x.p.present).length,
      minors: all.filter((x) => x.p.mineur).length, auth: all.filter((x) => x.p.mineur && !x.p.autorisationRecue).length,
      acc: all.filter((x) => x.p.moins16 && !x.p.accompPresent).length,
    };
    $('#stats').innerHTML = `<div><b>${st.here}/${st.total}</b>joueurs arrivés</div><div><b>${st.minors}</b>mineurs</div>
      <div><b>${st.auth}</b>autorisations à récupérer</div><div><b>${st.acc}</b>accompagnateurs à voir (−16 ans)</div>`;

    let html = '';
    for (const [id, c] of Object.entries(COMPS)) {
      if (only && only !== id) continue;
      const rs = regs.filter((r) => r.competition === id).sort((a, b) => (a.teamName || a.players[0].pseudo).localeCompare(b.teamName || b.players[0].pseudo, 'fr'));
      let block = '';
      for (const r of rs) {
        const rows = r.players.map((p, i) => ({p, i})).filter(({p}) => {
          if (q && !norm(`${p.pseudo} ${p.prenom} ${p.nom} ${r.teamName || ''}`).includes(q)) return false;
          if (show === 'todo') return !complete(p);
          if (show === 'done') return p.present;
          if (show === 'minors') return p.mineur;
          return true;
        });
        if (!rows.length) continue;
        const here = r.players.filter((p) => p.present).length;
        block += `<div class="acc-team">${r.teamName ? `<h3>${r.logo ? `<img src="/api/logo/${r.id}" alt="">` : ''}${esc(r.teamName)}<small>${here}/${r.players.length} arrivés</small></h3>` : ''}
          ${rows.map(({p, i}) => playerRow(r, p, i)).join('')}</div>`;
      }
      if (block) html += `<div class="acc-group" style="--c:${c.color}">${c.name}</div>${block}`;
    }
    $('#list').innerHTML = html || '<p class="note">Aucun joueur pour cette recherche.</p>';
  }

  function box(r, i, action, on, label, sub, todo) {
    return `<label class="chk ${on ? 'on' : todo ? 'todo' : ''}"><input type="checkbox" data-id="${r.id}" data-i="${i}" data-a="${action}" ${on ? 'checked' : ''}><span>${label}${sub ? `<small>${sub}</small>` : ''}</span></label>`;
  }
  function playerRow(r, p, i) {
    const a = p.accompagnateur || {};
    return `<div class="pl ${complete(p) ? 'ok' : ''}">
      <div class="who"><b>${esc(p.pseudo)}</b><span>${esc((p.nom || '').toUpperCase())} ${esc(p.prenom)} · ${p.age ?? '?'} ans${p.tel ? ` · ${esc(p.tel)}` : ''}</span>
        ${p.moins16 ? '<span class="min m16">MOINS DE 16 ANS</span>' : p.mineur ? '<span class="min">MINEUR</span>' : ''}</div>
      ${box(r, i, 'present', p.present, 'Présent', p.presentAt ? new Date(p.presentAt).toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit', timeZone: 'Indian/Reunion'}) : '', false)}
      ${p.mineur ? box(r, i, 'autorisation', p.autorisationRecue, 'Autorisation parentale', 'remplie et signée', !p.autorisationRecue) : '<div class="na">Majeur : pas d’autorisation</div>'}
      ${p.moins16 ? box(r, i, 'accompPresent', p.accompPresent, 'Accompagnateur présent', `${esc(a.nom || '?')} (${esc(a.lien || '?')}) ${esc(a.tel || '')}`, !p.accompPresent) : '<div class="na">Pas d’accompagnateur requis</div>'}
    </div>`;
  }

  $('#list').addEventListener('change', async (e) => {
    const c = e.target.closest('input[data-a]');
    if (!c) return;
    const {id, i, a} = c.dataset, value = c.checked;
    c.disabled = true;
    try {
      const res = await fetch('/api/admin/update', {method: 'POST', headers: {'Content-Type': 'application/json', 'x-admin-password': pwd}, body: JSON.stringify({id, action: a, player: Number(i), value})});
      if (!res.ok) throw new Error((await res.json()).error || 'Erreur');
      const p = regs.find((r) => r.id === id).players[Number(i)];
      if (a === 'autorisation') p.autorisationRecue = value; else { p[a] = value; p[a + 'At'] = value ? new Date().toISOString() : null; }
      render();
    } catch (err) {
      alert('Non enregistré : ' + err.message + '. Vérifie la connexion et réessaie.');
      c.checked = !value; c.disabled = false;
    }
  });
  $('#q').addEventListener('input', render);
  $('#comp').addEventListener('change', render);
  $('#show').addEventListener('change', render);
  $('#refresh').addEventListener('click', load);
  $('#comp').insertAdjacentHTML('beforeend', Object.entries(COMPS).map(([id, c]) => `<option value="${id}">${c.name}</option>`).join(''));
  $('#login').addEventListener('submit', (e) => { e.preventDefault(); pwd = $('#pwd').value; load(); });
  if (pwd) load(); else $('#login').classList.remove('hide');
  setInterval(() => { if (pwd && !document.querySelector('#list input:focus')) load(); }, 30000);
})();
