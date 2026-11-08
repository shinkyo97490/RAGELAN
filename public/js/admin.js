// Espace admin : liste des inscriptions, autorisations parentales, export CSV
(function () {
  const $ = (s) => document.querySelector(s);
  const NAMES = {valorant: 'Valorant', rocketleague: 'Rocket League', fc27: 'FC 27 FUT', libres: 'Joueurs libres'};
  const STATUS = {paid: 'Payée', pending: 'En attente', expired: 'Expirée', cancelled: 'Annulée'};
  let pwd = sessionStorage.getItem('rl-admin') || '';
  let data = null;

  async function call(path, opts = {}) {
    const res = await fetch(path, {...opts, headers: {'x-admin-password': pwd, 'Content-Type': 'application/json', ...(opts.headers || {})}});
    if (res.status === 401) throw new Error('Mot de passe incorrect.');
    if (!res.ok) throw new Error((await res.json()).error || 'Erreur');
    return res;
  }

  function el(tag, props = {}, ...kids) {
    const e = document.createElement(tag);
    Object.assign(e, props);
    for (const k of kids) e.append(k);
    return e;
  }

  function render() {
    const st = data.status;
    const paid = data.inscriptions.filter((r) => r.status === 'paid');
    const players = paid.flatMap((r) => r.players);
    const stats = $('#stats');
    stats.replaceChildren();
    const add = (label, value) => stats.append(el('div', {className: 'stat'}, el('div', {className: 'display', textContent: value}), el('div', {className: 'note', textContent: label})));
    add('Joueurs inscrits (payés)', players.length);
    add('Encaissé', `${paid.reduce((n, r) => n + r.amount, 0)} €`);
    add('Menus Best Of restants', st.bestOfRemaining);
    add('Autorisations manquantes', players.filter((p) => p.mineur && !p.autorisationRecue).length);
    for (const [id, c] of Object.entries(st.competitions)) add(`${c.name} : ${c.unit} restant(e)s`, `${c.remaining}/${c.capacity}`);

    const f = $('#filter').value;
    const now = Date.now();
    const list = data.inscriptions.filter((r) => f === 'all' || (f === 'pending' ? r.status === 'pending' && new Date(r.expiresAt) > now : r.status === f))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const rows = $('#rows');
    rows.replaceChildren();
    for (const r of list) {
      const tdPlayers = el('td');
      r.players.forEach((p, i) => {
        const line = el('div', {style: 'margin-bottom:6px'});
        line.append(el('b', {textContent: p.pseudo}), ` — ${p.prenom} ${p.nom} · ${p.age} ans · ${p.ingame}`);
        if (p.email) line.append(el('br'), `${p.email} · ${p.tel}`);
        if (p.bestOf) line.append('');
        if (p.mineur) {
          const lab = el('label', {style: 'display:block;color:var(--orange)'});
          const cb = el('input', {type: 'checkbox', checked: p.autorisationRecue});
          cb.addEventListener('change', () => update(r.id, {action: 'autorisation', player: i, value: cb.checked}));
          lab.append(cb, ` Autorisation parentale reçue${p.moins16 ? ` · -16 ans, accompagnateur : ${p.accompagnateur?.nom} (${p.accompagnateur?.lien}, ${p.accompagnateur?.tel})` : ''}`);
          line.append(lab);
        }
        tdPlayers.append(line);
      });
      const actions = el('td');
      if (r.status === 'pending' || r.status === 'expired') {
        const b = el('button', {className: 'btn small ghost', textContent: 'Marquer payée'});
        b.addEventListener('click', () => confirm('Marquer cette inscription comme payée ?') && update(r.id, {action: 'markPaid'}));
        actions.append(b);
      }
      if (r.status !== 'cancelled') {
        const b = el('button', {className: 'btn small ghost', textContent: 'Annuler', style: 'margin-top:6px'});
        b.addEventListener('click', () => confirm("Annuler cette inscription ? La place sera libérée. Pense à rembourser via Stripe si besoin.") && update(r.id, {action: 'cancel'}));
        actions.append(b);
      }
      rows.append(el('tr', {},
        el('td', {textContent: new Date(r.createdAt).toLocaleString('fr-FR', {timeZone: 'Indian/Reunion'})}),
        el('td', {}, el('span', {className: `pill ${r.status}`, textContent: STATUS[r.status] || r.status})),
        el('td', {textContent: NAMES[r.competition]}),
        teamCell(r),
        tdPlayers,
        el('td', {textContent: `${r.amount} €${r.payment ? ` (${r.payment})` : ''}`}),
        actions));
    }
    if (!list.length) rows.append(el('tr', {}, el('td', {colSpan: 7, textContent: 'Aucune inscription.'})));
  }

  // Nom + logo de l'équipe, avec possibilité de remplacer le logo
  function teamCell(r) {
    const td = el('td');
    if (!r.teamName) { td.textContent = '—'; return td; }
    const box = el('div', {className: 'team-cell'});
    if (r.logo) {
      const a = el('a', {href: `/api/logo/${r.id}?v=${Date.now()}`, target: '_blank', title: 'Ouvrir le logo'});
      a.append(el('img', {src: a.href, alt: ''}));
      box.append(a);
    }
    const right = el('div');
    right.append(el('b', {textContent: r.teamName}), el('br'));
    const lab = el('label', {textContent: r.logo ? 'Changer le logo' : 'Ajouter le logo'});
    const input = el('input', {type: 'file', accept: 'image/png,image/jpeg,image/webp', className: 'hide'});
    input.addEventListener('change', () => {
      const f = input.files[0];
      if (!f) return;
      if (f.size > 2 * 1024 * 1024) return alert('Image trop lourde (2 Mo maximum).');
      const fr = new FileReader();
      fr.onload = async () => {
        try { await call('/api/admin/logo', {method: 'POST', body: JSON.stringify({id: r.id, logo: fr.result})}); await load(); } catch (e) { alert(e.message); }
      };
      fr.readAsDataURL(f);
    });
    lab.append(input);
    right.append(lab);
    box.append(right);
    td.append(box);
    return td;
  }

  async function load() {
    data = await (await call('/api/admin/inscriptions')).json();
    render();
  }
  async function update(id, body) {
    try { await call('/api/admin/update', {method: 'POST', body: JSON.stringify({id, ...body})}); await load(); } catch (e) { alert(e.message); }
  }

  async function enter() {
    try {
      await load();
      sessionStorage.setItem('rl-admin', pwd);
      $('#login').classList.add('hide');
      $('#app').classList.remove('hide');
      $('#refresh').classList.remove('hide');
      $('#export').classList.remove('hide');
      $('#backup').classList.remove('hide');
      $('#emarg').classList.remove('hide');
      $('#streamctl').classList.remove('hide');
    } catch (e) {
      sessionStorage.removeItem('rl-admin');
      $('#login-err').replaceChildren(el('div', {className: 'alert err', textContent: e.message}));
    }
  }

  $('#login').addEventListener('submit', (e) => { e.preventDefault(); pwd = $('#pwd').value; enter(); });
  $('#filter').addEventListener('change', render);
  $('#refresh').addEventListener('click', load);
  $('#export').addEventListener('click', async () => {
    const blob = await (await call('/api/admin/export.csv')).blob();
    const a = el('a', {href: URL.createObjectURL(blob), download: 'inscriptions_rage_lan_2026.csv'});
    a.click();
  });
  $('#backup').addEventListener('click', async () => {
    const blob = await (await call('/api/admin/backup.json')).blob();
    el('a', {href: URL.createObjectURL(blob), download: `sauvegarde_rage_lan_${new Date().toISOString().slice(0, 10)}.json`}).click();
  });
  if (pwd) enter();
})();
