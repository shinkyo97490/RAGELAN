// Espace admin : liste des inscriptions, autorisations parentales, export CSV
(function () {
  const $ = (s) => document.querySelector(s);
  const NAMES = {valorant: 'Valorant', rocketleague: 'Rocket League', fc27: 'FC 27 FUT', libres: 'Joueurs libres'};
  const STATUS = {paid: 'Payée', partial: 'Paiement partiel', pending: 'En attente', expired: 'Expirée', cancelled: 'Annulée'};
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
    const partial = data.inscriptions.filter((r) => r.status === 'partial');
    const players = paid.flatMap((r) => r.players);
    const cashed = paid.reduce((n, r) => n + r.amount, 0) + partial.reduce((n, r) => n + (r.amountPaid || 0), 0);
    const stats = $('#stats');
    stats.replaceChildren();
    const add = (label, value) => stats.append(el('div', {className: 'stat'}, el('div', {className: 'display', textContent: value}), el('div', {className: 'note', textContent: label})));
    add('Joueurs inscrits (payés)', players.length);
    add('Encaissé', `${cashed} €`);
    if (partial.length) add('Équipes en paiement partiel', partial.length);
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
        if (r.payMode === 'split' && r.status !== 'cancelled') {
          const pay = el('div', {style: 'margin-top:2px'});
          if (p.paid) pay.append(el('span', {className: 'pill paid', textContent: 'Part payée'}));
          else {
            pay.append(el('span', {className: 'pill pending', textContent: 'Part non payée'}), ' ');
            const link = `${location.origin}/payer.html?id=${r.id}&p=${i}&k=${p.payKey}`;
            const cp = el('button', {className: 'btn small ghost', textContent: 'Copier son lien', type: 'button'});
            cp.addEventListener('click', () => navigator.clipboard.writeText(link).then(() => { cp.textContent = 'Copié !'; }, () => prompt('Lien de paiement :', link)));
            const cash = el('button', {className: 'btn small ghost', textContent: 'Payé sur place', type: 'button'});
            cash.addEventListener('click', () => confirm(`Marquer la part de ${p.pseudo} comme payée (espèces, virement…) ?`) && update(r.id, {action: 'playerPaid', player: i}));
            pay.append(cp, ' ', cash);
          }
          line.append(pay);
        }
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
      if (r.status === 'partial') {
        const late = r.deadline && new Date(r.deadline) < now;
        actions.append(el('div', {className: 'note', style: `margin:0 0 6px;${late ? 'color:#ff6b6b;font-weight:700' : ''}`,
          textContent: `${late ? 'Délai dépassé' : 'Délai'} : ${new Date(r.deadline).toLocaleString('fr-FR', {timeZone: 'Indian/Reunion', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'})}`}));
        const ext = el('button', {className: 'btn small ghost', textContent: 'Prolonger 48 h'});
        ext.addEventListener('click', () => update(r.id, {action: 'extend'}));
        actions.append(ext);
      }
      if (r.status === 'pending' || r.status === 'expired' || r.status === 'partial') {
        const b = el('button', {className: 'btn small ghost', textContent: 'Marquer payée'});
        b.addEventListener('click', () => confirm('Marquer cette inscription comme payée ?') && update(r.id, {action: 'markPaid'}));
        actions.append(b);
      }
      if (data.mailEnabled && (r.status === 'paid' || r.status === 'partial')) {
        const b = el('button', {className: 'btn small ghost', textContent: "Renvoyer l'e-mail", style: 'margin-top:6px'});
        b.addEventListener('click', async () => { try { await call('/api/admin/mail', {method: 'POST', body: JSON.stringify({action: 'resend', id: r.id})}); b.textContent = 'Envoyé !'; } catch (e) { alert(e.message); } });
        actions.append(b);
      }
      if (r.mailError) actions.append(el('div', {className: 'note', style: 'color:#ff6b6b;margin-top:6px', textContent: `E-mail non envoyé (${r.mailError})`}));
      else if (r.mails?.confirm) actions.append(el('div', {className: 'note', style: 'margin-top:6px', textContent: 'E-mail de confirmation envoyé'}));
      if (r.status !== 'cancelled') {
        const b = el('button', {className: 'btn small ghost', textContent: 'Annuler', style: 'margin-top:6px'});
        b.addEventListener('click', () => confirm("Annuler cette inscription ? La place sera libérée. Pense à rembourser via Stripe si besoin.") && update(r.id, {action: 'cancel'}));
        actions.append(b);
      }
      rows.append(el('tr', {},
        el('td', {textContent: new Date(r.createdAt).toLocaleString('fr-FR', {timeZone: 'Indian/Reunion'})}),
        el('td', {}, el('span', {className: `pill ${r.status}`, textContent: r.status === 'partial' ? `${STATUS.partial} ${r.players.filter((p) => p.paid).length}/${r.players.length}` : STATUS[r.status] || r.status})),
        el('td', {textContent: NAMES[r.competition]}),
        teamCell(r),
        tdPlayers,
        el('td', {textContent: r.payMode === 'split' && r.status !== 'paid' ? `${r.amountPaid || 0} / ${r.amount} €` : `${r.amount} €${r.payment ? ` (${r.payment})` : ''}`}),
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
      $('#tournoi').classList.remove('hide');
      $('#mailtest').classList.remove('hide');
      $('#streamctl').classList.remove('hide');
    } catch (e) {
      sessionStorage.removeItem('rl-admin');
      $('#login-err').replaceChildren(el('div', {className: 'alert err', textContent: e.message}));
    }
  }

  $('#login').addEventListener('submit', (e) => { e.preventDefault(); pwd = $('#pwd').value; enter(); });
  $('#filter').addEventListener('change', render);
  $('#mailtest').addEventListener('click', async () => {
    try { const d = await (await call('/api/admin/mail', {method: 'POST', body: JSON.stringify({action: 'test'})})).json(); alert(`E-mail de test envoyé à ${d.to}. Vérifie la boîte de réception (et les spams).`); }
    catch (e) { alert(e.message); }
  });
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
