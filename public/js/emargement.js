// Fiche d'émargement imprimable, générée à partir des inscriptions payées (accès admin)
(function () {
  const COMPS = {
    valorant: {name: 'Valorant', color: '#FF4655', day: 'sam'},
    rocketleague: {name: 'Rocket League', color: '#1E8BFF', day: 'sam'},
    tft: {name: 'TFT', color: '#C9922E', day: 'sam'},
    fc27: {name: 'EA Sports FC 27 FUT', color: '#00A84F', day: 'dim'},
    fortnite: {name: 'Fortnite', color: '#8A4FE0', day: 'dim'},
  };
  const pwd = sessionStorage.getItem('rl-admin') || '';
  const $ = (s) => document.querySelector(s);
  let regs = [];

  const el = (tag, props = {}, ...kids) => { const e = document.createElement(tag); Object.assign(e, props); e.append(...kids); return e; };

  function render() {
    const day = $('#day').value;
    const only = $('#comp').value;
    const sheet = $('#sheet');
    sheet.replaceChildren();
    const ids = Object.keys(COMPS).filter((id) => (only ? id === only : day === 'all' || COMPS[id].day === day));
    const list = regs.filter((r) => ids.includes(r.competition));
    const total = list.reduce((n, r) => n + r.players.length, 0);
    const dayLabel = {sam: 'Samedi 21 novembre 2026', dim: 'Dimanche 22 novembre 2026', all: '21 & 22 novembre 2026'}[day];

    sheet.append(el('header', {},
      el('img', {src: 'assets/logos/rushxp.png', alt: ''}),
      el('div', {}, el('h1', {textContent: "RAGE LAN 2026 — FICHE D'ÉMARGEMENT"}), el('div', {textContent: `${dayLabel} · Complexe Sportif de Saint-Paul`})),
      el('div', {className: 'meta', textContent: `${total} joueur(s) · imprimé le ${new Date().toLocaleString('fr-FR', {timeZone: 'Indian/Reunion'})}`})));

    if (!list.length) { sheet.append(el('p', {className: 'empty', textContent: 'Aucun inscrit payé pour cette sélection.'})); return; }

    for (const id of ids) {
      const rs = list.filter((r) => r.competition === id)
        .sort((a, b) => (a.teamName || '').localeCompare(b.teamName || '', 'fr') || a.players[0].nom.localeCompare(b.players[0].nom, 'fr'));
      if (!rs.length) continue;
      const c = COMPS[id];
      const n = rs.reduce((k, r) => k + r.players.length, 0);
      sheet.append(el('h2', {style: `background:${c.color}`, textContent: `${c.name} — ${n} joueur(s)${rs[0].teamName ? ` · ${rs.length} équipe(s)` : ''}`}));
      const table = el('table');
      const team = Boolean(rs[0].teamName);
      table.append(el('thead', {}, el('tr', {}, ...['Présent', ...(team ? ['Équipe'] : []), 'Nom Prénom', 'Pseudo', 'Âge', 'Autorisation parentale', 'Accompagnateur (−16 ans)', 'Menu Best Of remis', 'Bracelet', 'Signature']
        .map((h) => el('th', {textContent: h})))));
      const tbody = el('tbody');
      const rows = rs.flatMap((r) => r.players.map((p, i) => ({r, p, first: i === 0})))
        .sort((a, b) => team ? 0 : a.p.nom.localeCompare(b.p.nom, 'fr'));
      for (const {r, p, first} of rows) {
        const tr = el('tr');
        tr.append(el('td', {className: 'box', textContent: '☐'}));
        if (team) tr.append(el('td', {className: 'team', textContent: first ? r.teamName : ''}));
        tr.append(el('td', {textContent: `${p.nom.toUpperCase()} ${p.prenom}`}));
        tr.append(el('td', {textContent: p.pseudo}));
        tr.append(el('td', {className: p.mineur ? 'minor' : '', textContent: `${p.age}${p.mineur ? ' (mineur)' : ''}`}));
        tr.append(el('td', {className: p.mineur ? 'minor' : 'box', textContent: p.mineur ? (p.autorisationRecue ? '✔ reçue (admin)' : '☐ à récupérer') : '—'}));
        tr.append(el('td', {className: p.moins16 ? 'minor' : 'box', textContent: p.moins16 && p.accompagnateur ? `☐ ${p.accompagnateur.nom} (${p.accompagnateur.lien}) ${p.accompagnateur.tel}` : '—'}));
        tr.append(el('td', {className: 'box', textContent: p.bestOf ? '☐' : '—'}));
        tr.append(el('td', {className: 'box', textContent: '☐'}));
        tr.append(el('td', {className: 'sig'}));
        tbody.append(tr);
      }
      table.append(tbody);
      sheet.append(table);
    }
    sheet.append(el('p', {className: 'legend', textContent: "Mineurs : vérifier l'autorisation parentale signée avant l'accès à la compétition. Moins de 16 ans : vérifier la présence de l'adulte accompagnateur. Menu Best Of : à remettre aux joueurs avec une case ☐ (« — » = non concerné)."}));
  }

  async function load() {
    if (!pwd) { $('#err').textContent = "Connecte-toi d'abord sur la page admin."; $('#sheet').replaceChildren(); return; }
    const res = await fetch('/api/admin/inscriptions', {headers: {'x-admin-password': pwd}});
    if (!res.ok) { $('#err').textContent = 'Accès refusé : reconnecte-toi sur la page admin.'; return; }
    regs = (await res.json()).inscriptions.filter((r) => r.status === 'paid');
    render();
  }

  $('#day').addEventListener('change', () => { $('#comp').value = ''; render(); });
  $('#comp').addEventListener('change', render);
  load();
})();
