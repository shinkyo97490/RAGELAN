// Console admin des tournois : liens d'équipe, map pool Valorant, poules, phase finale, matchs, salles Joueurs libres
(function () {
  const {esc, team, STATUS, groupsHtml, vetoLog} = T;
  const $ = (s) => document.querySelector(s);
  const view = $('#view');
  let pwd = sessionStorage.getItem('rl-admin') || '';
  let tab = (location.hash || '#valorant').slice(1);
  let D = null;
  const draftGroups = {}, draftSeeds = {}, opts = {};

  async function call(path, body) {
    const res = await fetch(path, body ? {method: 'POST', headers: {'Content-Type': 'application/json', 'x-admin-password': pwd}, body: JSON.stringify(body)}
      : {headers: {'x-admin-password': pwd}, cache: 'no-store'});
    if (res.status === 401) throw Object.assign(new Error('Mot de passe incorrect.'), {auth: true});
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'Erreur');
    return d;
  }
  async function act(path, body, confirmMsg) {
    try { await call(path, body); await load(); }
    catch (e) {
      if (confirmMsg && /Confirme/.test(e.message) && confirm(e.message)) return act(path, {...body, force: true});
      alert(e.message);
    }
  }
  const teamLink = (e) => `${location.origin}/equipe.html?id=${e.id}&k=${e.key}`;
  const matchLink = (m, side) => {
    const e = D.entrants[m.comp].find((x) => x.id === m[side]?.id);
    return e ? `${location.origin}/match.html?m=${m.id}&id=${e.id}&k=${e.key}` : '';
  };

  // ---------- Onglet compétition ----------
  function compView(c) {
    const ent = D.entrants[c];
    const C = D.comps[c];
    const FN = c === 'fortnite';
    const o = opts[c] = opts[c] || {nGroups: Math.max(1, (D.groupsRaw[c] || []).length || 2), bo: 1, format: c === 'valorant' || FN ? 'double' : 'single',
      bboBo: FN ? 9 : c === 'rocketleague' ? 5 : c === 'valorant' ? 3 : 1, boFinal: FN ? 13 : c === 'rocketleague' ? 5 : c === 'valorant' ? 3 : 1, nSeeds: FN ? Math.max(3, Math.min(16, ent.length || 12)) : 4};
    const BOS = FN ? [9, 13, 7, 5, 3, 1] : [1, 3, 5];
    if (!draftGroups[c]) {
      draftGroups[c] = {};
      (D.groupsRaw[c] || []).forEach((g) => g.teams.forEach((id) => (draftGroups[c][id] = g.name)));
    }
    const letters = Array.from({length: o.nGroups}, (_, i) => String.fromCharCode(65 + i));
    const unit = c === 'fc27' ? 'joueurs' : FN ? 'duos' : 'équipes';
    const bracketMatches = C.matches.filter((m) => m.stage === 'bracket');
    const seeds = draftSeeds[c] = draftSeeds[c] || [];
    while (seeds.length < o.nSeeds) seeds.push('');
    seeds.length = o.nSeeds;

    return `
    <div class="panel"><h2>${esc(C.name)} · ${ent.length} ${unit} payé${ent.length > 1 ? 's' : ''}</h2>
      <p class="note">Chaque ${c === 'fc27' ? 'joueur' : 'équipe'} a <b>un lien personnel</b> : sa page avec tous ses matchs, la salle de chaque match${c === 'valorant' ? ', le ban de maps' : ''} et la déclaration des scores. Envoie-le au capitaine (Discord, WhatsApp).</p>
      <p><button class="btn small" data-copyall="${c}">Copier tous les liens</button></p>
      <div class="chips">${ent.map((e) => `<span class="chip">${team(e)}<button class="btn small ghost" style="padding:4px 10px" data-copy="${esc(teamLink(e))}">Lien</button></span>`).join('') || '<span class="note">Aucune inscription payée.</span>'}</div>
    </div>

    ${c === 'valorant' ? `<div class="panel"><h2>Map pool</h2>
      <p class="note">Clique sur les maps du pool (7 conseillées). BO1 : bans jusqu'à la dernière map. BO3 : ban, ban, pick, pick, ban, ban, map décisive. BO5 : ban, ban, 4 picks, map décisive. L'adversaire de celui qui choisit une map choisit son côté. L'équipe A (à gauche) commence.</p>
      <div class="chips" id="pool">${D.maps.map((m) => `<button type="button" class="chip ${D.settings.valorant.mapPool.includes(m) ? 'on' : ''}" data-map="${m}">${m}</button>`).join('')}</div>
      <p style="margin-top:12px"><button class="btn small" id="savePool">Enregistrer le map pool (${D.settings.valorant.mapPool.length} maps)</button></p></div>` : ''}

    ${FN ? '' : `<div class="panel"><h2>Phase de groupes</h2>
      <div class="inl"><label>Nombre de poules <input type="number" min="1" max="8" value="${o.nGroups}" data-opt="nGroups"></label>
        <label>Format des matchs <select data-opt="bo">${[1, 3, 5].map((b) => `<option ${o.bo === b ? 'selected' : ''} value="${b}">BO${b}</option>`).join('')}</select></label>
        <button class="btn small ghost" id="shuffle">Répartir au hasard</button></div>
      <table class="t-table" style="margin-top:12px"><tbody>${ent.map((e) => `<tr><td>${team(e)}</td><td><select data-group="${e.id}" class="inl"><option value="">—</option>${letters.map((l) => `<option ${draftGroups[c][e.id] === l ? 'selected' : ''}>${l}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table>
      <p style="margin-top:12px" class="inl"><button class="btn small" id="saveGroups">Enregistrer les poules et créer les matchs</button>
        ${C.groups.length ? '<button class="btn small ghost" data-clear="group">Supprimer la phase de groupes</button>' : ''}</p>
      ${C.groups.length ? `<div style="margin-top:16px">${groupsHtml(C.groups)}</div>` : ''}
    </div>`}

    <div class="panel"><h2>${FN ? 'Tableau · 2v2 Realistic' : 'Phase finale'}</h2>
      <div class="inl"><label>Format <select data-opt="format"><option value="single" ${o.format === 'single' ? 'selected' : ''}>Élimination directe</option><option value="double" ${o.format === 'double' ? 'selected' : ''}>Double élimination</option></select></label>
        <label>Qualifiés <input type="number" min="2" max="32" value="${o.nSeeds}" data-opt="nSeeds"></label>
        <label>Matchs <select data-opt="bboBo">${BOS.map((b) => `<option ${o.bboBo === b ? 'selected' : ''} value="${b}">BO${b}</option>`).join('')}</select></label>
        <label>${o.format === 'double' ? 'Grande finale' : 'Finale'} <select data-opt="boFinal">${BOS.map((b) => `<option ${o.boFinal === b ? 'selected' : ''} value="${b}">BO${b}</option>`).join('')}</select></label>
        ${C.groups.length ? '<button class="btn small ghost" id="fromGroups">Remplir depuis les poules</button>' : ''}<button class="btn small ghost" id="drawSeeds">Tirage au sort</button></div>
      <p class="note">Tête de série 1 en haut. 1 affronte le dernier, 2 l'avant-dernier… ${o.format === 'double' ? 'Double élimination de 3 à 16 participants : s\'il en manque pour remplir le tableau (ex. 12 sur 16), les meilleures têtes de série sont exemptées du 1er tour, en Winner comme en Loser.' : 'S\'il manque des équipes, les meilleures têtes de série sont exemptées du 1er tour.'}${FN ? ' Fortnite : matchs en BO9 (premier à 5 manches), grande finale en BO13 (premier à 7).' : ''}</p>
      <div class="t-grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px">${seeds.map((s, i) => `<label class="inl"><b style="width:28px">${i + 1}</b><select data-seed="${i}" style="flex:1"><option value="">—</option>${ent.map((e) => `<option value="${e.id}" ${s === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></label>`).join('')}</div>
      <p style="margin-top:12px" class="inl"><button class="btn small" id="saveBracket">Créer la phase finale</button>${bracketMatches.length ? '<button class="btn small ghost" data-clear="bracket">Supprimer la phase finale</button>' : ''}</p>
      ${bracketMatches.length ? `<div style="margin-top:16px">${T.bracketHtml(C.matches)}</div>` : ''}
    </div>

    <div class="panel"><h2>Matchs</h2>
      <div class="inl" style="margin-bottom:12px"><label>Afficher <select data-opt="filter">${[['todo', 'À traiter'], ['all', 'Tous'], ['done', 'Terminés']].map(([v, l]) => `<option value="${v}" ${(o.filter || 'todo') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
      <div class="mlist" style="gap:10px">${matchesAdmin(c, o.filter || 'todo')}</div></div>`;
  }

  function matchesAdmin(c, filter) {
    const ms = D.comps[c].matches.filter((m) => !m.bye && (filter === 'all' || (filter === 'done' ? m.status === 'done' : m.status !== 'done')))
      .sort((a, b) => (a.stage === b.stage ? 0 : a.stage === 'group' ? -1 : 1) || String(a.group || a.bracket).localeCompare(String(b.group || b.bracket)) || a.round - b.round || a.order - b.order);
    if (!ms.length) return '<p class="note">Aucun match.</p>';
    return ms.map((m) => {
      const raw = D.matchesRaw.find((x) => x.id === m.id) || {};
      const rep = raw.reports || {};
      const r = (s) => (rep[s] ? `${rep[s].scoreA} - ${rep[s].scoreB}` : '—');
      const la = matchLink(m, 'a'), lb = matchLink(m, 'b');
      return `<div class="adm-match" data-match="${m.id}">
        <div class="top"><span class="mmeta" style="margin:0">${esc(m.roundName)} · BO${m.bo}</span><span class="pill ${m.status}">${STATUS[m.status]}</span></div>
        <div class="mrow"><div class="a">${team(m.a)}</div><div class="sc">${T.score(m)}</div><div class="b">${team(m.b)}</div></div>
        ${m.a && m.b ? `<div class="mmeta" style="margin:0">Déclaré par ${esc(m.a.name)} : <b>${r('a')}</b> · par ${esc(m.b.name)} : <b>${r('b')}</b></div>` : ''}
        ${m.veto ? `<details><summary class="mmeta" style="display:list-item;margin:0">Ban de maps ${m.veto.complete ? '(terminé)' : `(${m.veto.steps.length} étapes)`}</summary><div class="veto-log">${vetoLog(m, m.a?.name, m.b?.name) || '—'}</div></details>` : ''}
        <div class="inl">
          ${m.a && m.b ? `<input type="number" min="0" max="99" data-sa value="${m.scoreA ?? ''}"> - <input type="number" min="0" max="99" data-sb value="${m.scoreB ?? ''}"><button class="btn small" data-do="score">Valider le score</button>` : ''}
          ${m.status !== 'waiting' ? '<button class="btn small ghost" data-do="reset">Réinitialiser</button>' : ''}
          ${m.status !== 'done' ? `<select data-do="bo">${(m.comp === 'fortnite' ? [9, 13, 7, 5, 3, 1] : [1, 3, 5]).map((b) => `<option value="${b}" ${m.bo === b ? 'selected' : ''}>BO${b}</option>`).join('')}</select>` : ''}
          ${m.comp === 'valorant' && m.veto && m.status !== 'done' ? '<button class="btn small ghost" data-do="resetVeto">Refaire le ban</button>' : ''}
          ${la ? `<button class="btn small ghost" data-copy="${esc(la)}">Salle ${esc(m.a.name)}</button>` : ''}${lb ? `<button class="btn small ghost" data-copy="${esc(lb)}">Salle ${esc(m.b.name)}</button>` : ''}
        </div></div>`;
    }).join('');
  }

  // ---------- Onglet TFT : phase 1 en manches (remix des lobbies), puis finale ----------
  const tftOpt = {p1Rounds: 7, finalRounds: 9, finalSize: 8, lobbySize: 8, mode: 'snake'};
  function standingsTable(rows, qualif) {
    if (!rows.length) return '<p class="note">Pas encore de résultats.</p>';
    return `<table class="t-table"><thead><tr><th>#</th><th>Joueur</th><th>Pts</th><th>Top 1</th><th>Top 4</th><th>Manches</th><th>Places</th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr ${qualif && i < qualif ? 'style="background:rgba(232,176,74,.12)"' : ''}><td>${i + 1}</td><td><b>${esc(r.name)}</b></td><td class="n"><b>${r.points}</b></td><td class="n">${r.firsts}</td><td class="n">${r.top4}</td><td class="n">${r.played}</td><td class="n" style="font-family:var(--mono);font-size:13px">${r.places.join(' · ') || '—'}</td></tr>`).join('')}</tbody></table>`;
  }
  function roundsAdmin(phase, rounds) {
    return rounds.slice().reverse().map((r) => {
      const ri = r.n - 1;
      return `<details ${r === rounds[rounds.length - 1] ? 'open' : ''} class="t-card" style="margin-bottom:10px"><summary style="cursor:pointer"><b>Manche ${r.n}</b> ${r.done ? '<span class="pill done">Terminée</span>' : '<span class="pill ready">En cours</span>'}</summary>
        <div class="t-grid" style="margin-top:10px">${r.lobbies.map((l, li) => `<div class="t-card" data-lobby="${li}" data-round="${ri}" data-phase="${phase}"><h3>${rounds === D.tft.final?.rounds ? 'Lobby finale' : `Lobby ${String.fromCharCode(65 + li)}`} · ${l.length} joueurs</h3>
          <table class="t-table"><thead><tr><th>Joueur</th><th>Place</th><th>Pts</th></tr></thead><tbody>${l.map((p) => `<tr><td>${esc(p.name)}</td><td><select data-place="${p.id}"><option value="">—</option>${l.map((_, k) => `<option ${p.place === k + 1 ? 'selected' : ''}>${k + 1}</option>`).join('')}</select></td><td class="n">${p.place ? 9 - p.place : ''}</td></tr>`).join('')}</tbody></table>
          <p class="inl" style="margin-top:8px"><button class="btn small" data-tft="result">Enregistrer les places</button><button class="btn small ghost" data-tft="clearLobby">Effacer</button></p></div>`).join('')}</div></details>`;
    }).join('');
  }
  function tftView() {
    const X = D.tft, ent = D.entrants.tft || [];
    if (!X) return `<div class="panel"><h2>TFT · ${ent.length} joueur${ent.length > 1 ? 's' : ''} payé${ent.length > 1 ? 's' : ''}</h2>
      <div class="chips">${ent.map((e) => `<span class="chip">${esc(e.name)}</span>`).join('') || '<span class="note">Aucun joueur inscrit et payé.</span>'}</div>
      <p class="note" style="margin-top:12px">Phase 1 : chaque manche se joue en lobbies de 8 ; après chaque manche, les lobbies sont remixés. Points : 1er 8 pts … 8e 1 pt. Le top 8 va en finale (lobby unique), points remis à zéro.</p>
      <div class="inl"><label>Manches phase 1 <input type="number" min="1" max="15" value="${tftOpt.p1Rounds}" data-topt="p1Rounds"></label>
        <label>Manches finale <input type="number" min="1" max="15" value="${tftOpt.finalRounds}" data-topt="finalRounds"></label>
        <label>Qualifiés finale <input type="number" min="2" max="8" value="${tftOpt.finalSize}" data-topt="finalSize"></label>
        <label>Joueurs par lobby <input type="number" min="2" max="8" value="${tftOpt.lobbySize}" data-topt="lobbySize"></label>
        <label>Remix <select data-topt="mode"><option value="snake" ${tftOpt.mode === 'snake' ? 'selected' : ''}>Selon le classement (serpentin)</option><option value="random" ${tftOpt.mode === 'random' ? 'selected' : ''}>Aléatoire</option></select></label></div>
      <p style="margin-top:12px"><button class="btn" data-tft="start">Lancer le tournoi TFT (manche 1, lobbies au hasard)</button></p></div>`;
    const S = X.settings, p1 = X.p1, fin = X.final;
    const lastP1 = p1.rounds[p1.rounds.length - 1];
    const lastF = fin && fin.rounds[fin.rounds.length - 1];
    return `<div class="panel"><h2>TFT · ${X.phase === 'p1' ? `Phase 1 · manche ${p1.rounds.length}/${S.p1Rounds}` : X.phase === 'final' ? `Finale · manche ${fin.rounds.length}/${S.finalRounds}` : 'Tournoi terminé'}</h2>
      <p class="note">Remix : ${S.mode === 'random' ? 'aléatoire' : 'selon le classement (serpentin)'} · ${S.lobbySize} joueurs par lobby · finale top ${S.finalSize}. Saisis la place de chaque joueur à la fin de chaque partie.</p>
      <p class="inl">${X.phase === 'p1' ? `${p1.rounds.length < S.p1Rounds ? `<button class="btn small" data-tft="next" ${lastP1.done ? '' : 'disabled'}>Manche suivante (remix des lobbies)</button>` : ''}
          <button class="btn small ${p1.rounds.length >= S.p1Rounds ? '' : 'ghost'}" data-tft="final" ${lastP1.done ? '' : 'disabled'}>Lancer la finale (top ${S.finalSize})</button>
          <button class="btn small ghost" data-tft="undoRound">Annuler la dernière manche (vide)</button>`
        : X.phase === 'final' ? `${fin.rounds.length < S.finalRounds ? `<button class="btn small" data-tft="next" ${lastF.done ? '' : 'disabled'}>Manche suivante de la finale</button>` : `<button class="btn small" data-tft="finish" ${lastF.done ? '' : 'disabled'}>Clôturer le tournoi</button>`}
          <button class="btn small ghost" data-tft="undoRound">Annuler la dernière manche (vide)</button><button class="btn small ghost" data-tft="backToP1">Revenir à la phase 1</button>`
        : '<button class="btn small ghost" data-tft="reopen">Rouvrir la finale</button>'}
        <button class="btn small ghost" data-tft="reset">Tout recommencer</button></p></div>
    ${fin ? `<div class="panel"><h2>Finale · classement</h2>${standingsTable(fin.standings)}</div><div class="panel"><h2>Finale · manches</h2>${roundsAdmin('final', fin.rounds)}</div>` : ''}
    <div class="panel"><h2>Phase 1 · classement</h2><p class="note">Les ${S.finalSize} premiers (surlignés) vont en finale.</p>${standingsTable(p1.standings, S.finalSize)}</div>
    <div class="panel"><h2>Phase 1 · manches</h2>${roundsAdmin('p1', p1.rounds)}</div>`;
  }
  function tftAction(t) {
    const a = t.dataset.tft, path = '/api/admin/tournoi/tft';
    if (a === 'start') return confirm(`Lancer le tournoi TFT avec ${(D.entrants.tft || []).length} joueurs ?`) && act(path, {action: 'start', ...tftOpt}, true);
    const box = t.closest('[data-lobby]');
    if (box) {
      const base = {phase: box.dataset.phase, round: Number(box.dataset.round), lobby: Number(box.dataset.lobby)};
      if (a === 'clearLobby') return confirm('Effacer les places de ce lobby ?') && act(path, {action: 'clearLobby', ...base});
      const places = {};
      box.querySelectorAll('[data-place]').forEach((s) => (places[s.dataset.place] = s.value === '' ? null : Number(s.value)));
      return act(path, {action: 'result', ...base, places});
    }
    if (a === 'next') return act(path, {action: 'next'});
    if (a === 'final') return confirm('Lancer la finale avec le top du classement de la phase 1 ?') && act(path, {action: 'final'}, true);
    if (a === 'reset') return act(path, {action: 'reset'}, true);
    return act(path, {action: a});
  }

  // ---------- Onglet Salles (jeu libre, mini-tournois, parties TFT et Fortnite) ----------
  const COMPN = {valorant: 'Valorant', rocketleague: 'Rocket League', fc27: 'FC 27', tft: 'TFT', fortnite: 'Fortnite', libres: 'Joueur libre'};
  const kind = (p) => COMPN[p.comp] || (p.libre ? 'Joueur libre' : 'Compétiteur');
  function libresView() {
    return `<div class="panel"><h2>Créer une salle</h2>
      <p class="note">Les joueurs s'inscrivent en direct sur <a href="libres.html" target="_blank">${location.host}/libres.html</a> avec le pseudo de leur inscription : tous les inscrits y ont accès. Crée ici les salles des mini-tournois et des parties TFT et Fortnite (une salle = un lobby, points selon le classement).</p>
      <div class="fields"><div class="field"><label>Nom</label><input id="rName" placeholder="TFT · Lobby A · Partie 1" maxlength="60"></div>
        <div class="field"><label>Jeu</label><input id="rGame" placeholder="TFT" maxlength="40"></div>
        <div class="field"><label>Places (0 = illimité)</label><input id="rCap" type="number" min="0" max="200" value="0"></div></div>
      <div class="field" style="margin-top:12px"><label>Infos pour les joueurs (code du lobby, horaire, règles…)</label><input id="rInfo" maxlength="300"></div>
      <p style="margin-top:12px"><button class="btn small" id="createRoom">Créer la salle</button></p></div>
      ${D.rooms.map((r) => `<div class="panel" data-room="${r.id}"><h2 style="font-size:26px">${esc(r.name)} <span class="pill ${r.open ? 'paid' : 'waiting'}">${r.open ? 'Ouverte' : 'Fermée'}</span></h2>
        <div class="inl" style="margin-bottom:10px"><label>Jeu <input data-f="game" value="${esc(r.game)}"></label><label>Places <input type="number" data-f="capacity" value="${r.capacity}"></label>
          <label style="flex:1">Infos <input data-f="info" value="${esc(r.info)}" style="width:100%"></label><button class="btn small ghost" data-r="save">Enregistrer</button>
          <button class="btn small ${r.open ? 'ghost' : ''}" data-r="toggle">${r.open ? 'Fermer les inscriptions' : 'Rouvrir'}</button><button class="btn small ghost" data-r="delete">Supprimer</button></div>
        <table class="t-table"><thead><tr><th>Joueur</th><th>Inscrit en</th><th>Points</th><th></th></tr></thead><tbody>
          ${r.players.map((p) => `<tr><td><b>${esc(p.pseudo)}</b></td><td>${kind(p)}</td><td><input type="number" class="inl" style="width:80px;padding:6px;background:var(--bg);color:var(--text);border:1px solid var(--line-2)" data-pts="${esc(p.key)}" value="${p.points ?? ''}"></td>
            <td><button class="btn small ghost" style="padding:4px 10px" data-remove="${esc(p.key)}">Retirer</button></td></tr>`).join('') || '<tr><td colspan="4" class="note">Aucun inscrit.</td></tr>'}
        </tbody></table>
        <div class="inl" style="margin-top:10px"><button class="btn small" data-r="points">Enregistrer les points</button><input data-addp placeholder="Pseudo à ajouter"><button class="btn small ghost" data-r="add">Ajouter</button></div></div>`).join('')}
      <div class="panel"><h2>Classement général</h2>${D.classement.length ? `<table class="t-table"><thead><tr><th>#</th><th>Joueur</th><th>Inscrit en</th><th>Salles</th><th>Points</th></tr></thead><tbody>
        ${D.classement.map((p, i) => `<tr><td>${i + 1}</td><td><b>${esc(p.pseudo)}</b></td><td>${kind(p)}</td><td class="n">${p.rooms}</td><td class="n"><b>${p.points}</b></td></tr>`).join('')}</tbody></table>` : '<p class="note">Pas encore de points.</p>'}</div>`;
  }

  function render() {
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    if (!D) return;
    view.innerHTML = tab === 'libres' ? libresView() : tab === 'tft' ? tftView() : compView(tab);
  }

  // ---------- Actions ----------
  view.addEventListener('change', (e) => {
    const t = e.target, o = opts[tab];
    if (t.dataset.topt) { tftOpt[t.dataset.topt] = t.dataset.topt === 'mode' ? t.value : Number(t.value); return; }
    if (t.dataset.opt) { o[t.dataset.opt] = t.dataset.opt === 'format' || t.dataset.opt === 'filter' ? t.value : Math.max(1, Number(t.value) || 1); render(); }
    else if (t.dataset.group !== undefined) draftGroups[tab][t.dataset.group] = t.value;
    else if (t.dataset.seed !== undefined) draftSeeds[tab][Number(t.dataset.seed)] = t.value;
    else if (t.dataset.do === 'bo') act('/api/admin/tournoi/match', {id: t.closest('[data-match]').dataset.match, action: 'bo', bo: Number(t.value)});
  });

  view.addEventListener('click', (e) => {
    const t = e.target.closest('button, [data-map]');
    if (!t) return;
    const c = tab;
    if (t.dataset.copy) return T.copy(t.dataset.copy, t);
    if (t.dataset.copyall) return T.copy(D.entrants[c].map((x) => `${x.name} : ${teamLink(x)}`).join('\n'), t);
    if (t.dataset.map) { t.classList.toggle('on'); return; }
    if (t.id === 'savePool') return act('/api/admin/tournoi/settings', {mapPool: [...document.querySelectorAll('#pool .on')].map((x) => x.dataset.map)});
    if (t.id === 'shuffle') {
      const ids = D.entrants[c].map((x) => x.id).sort(() => Math.random() - 0.5);
      draftGroups[c] = {};
      ids.forEach((id, i) => (draftGroups[c][id] = String.fromCharCode(65 + (i % opts[c].nGroups))));
      return render();
    }
    if (t.id === 'saveGroups') {
      const groups = {};
      for (const [id, g] of Object.entries(draftGroups[c])) if (g) (groups[g] = groups[g] || []).push(id);
      const list = Object.keys(groups).sort().map((name) => ({name, teams: groups[name]}));
      if (!list.length) return alert('Place les participants dans les poules.');
      if (!confirm(`Créer ${list.length} poule(s) et tous leurs matchs en BO${opts[c].bo} ? Les matchs de poule existants seront remplacés.`)) return;
      return act('/api/admin/tournoi/groups', {comp: c, groups: list, bo: opts[c].bo}, true);
    }
    if (t.id === 'fromGroups') {
      // Premiers de chaque poule, puis deuxièmes, etc. (les poules se croisent)
      const gs = D.comps[c].groups, out = [];
      const depth = Math.max(...gs.map((g) => g.standings.length));
      for (let r = 0; r < depth; r++) {
        const row = gs.map((g) => g.standings[r]?.id).filter(Boolean);
        out.push(...(r % 2 ? row.reverse() : row));
      }
      draftSeeds[c] = out.slice(0, opts[c].nSeeds);
      return render();
    }
    if (t.id === 'drawSeeds') {
      draftSeeds[c] = D.entrants[c].map((x) => x.id).sort(() => Math.random() - 0.5).slice(0, opts[c].nSeeds);
      return render();
    }
    if (t.id === 'saveBracket') {
      const seeds = draftSeeds[c].filter(Boolean);
      if (!confirm(`Créer la phase finale (${opts[c].format === 'double' ? 'double élimination' : 'élimination directe'}, ${seeds.length} qualifiés) ?`)) return;
      return act('/api/admin/tournoi/bracket', {comp: c, format: opts[c].format, seeds, bo: opts[c].bboBo, boFinal: opts[c].boFinal}, true);
    }
    if (t.dataset.clear) return confirm('Supprimer cette phase et tous ses résultats ?') && act('/api/admin/tournoi/clear', {comp: c, stage: t.dataset.clear});
    const mEl = t.closest('[data-match]');
    if (mEl && t.dataset.do) {
      const id = mEl.dataset.match;
      if (t.dataset.do === 'score') {
        const a = mEl.querySelector('[data-sa]').value, b = mEl.querySelector('[data-sb]').value;
        if (a === '' || b === '') return alert('Indique les deux scores.');
        return act('/api/admin/tournoi/match', {id, action: 'score', scoreA: Number(a), scoreB: Number(b)});
      }
      if (t.dataset.do === 'reset') return confirm('Effacer le score et les déclarations de ce match ?') && act('/api/admin/tournoi/match', {id, action: 'reset'});
      if (t.dataset.do === 'resetVeto') return confirm('Recommencer le ban de maps ?') && act('/api/admin/tournoi/match', {id, action: 'resetVeto'});
    }
    // TFT
    if (t.dataset.tft) return tftAction(t);
    // Joueurs libres
    if (t.id === 'createRoom') return act('/api/admin/libres', {action: 'create', name: $('#rName').value, game: $('#rGame').value, capacity: Number($('#rCap').value), info: $('#rInfo').value});
    const rEl = t.closest('[data-room]');
    if (rEl) {
      const id = rEl.dataset.room, room = D.rooms.find((r) => r.id === id);
      if (t.dataset.remove) return confirm('Retirer ce joueur de la salle ?') && act('/api/admin/libres', {action: 'remove', id, key: t.dataset.remove});
      const f = (n) => rEl.querySelector(`[data-f="${n}"]`).value;
      if (t.dataset.r === 'save') return act('/api/admin/libres', {action: 'update', id, game: f('game'), capacity: Number(f('capacity')), info: f('info')});
      if (t.dataset.r === 'toggle') return act('/api/admin/libres', {action: 'update', id, open: !room.open});
      if (t.dataset.r === 'delete') return confirm(`Supprimer la salle « ${room.name} » et ses points ?`) && act('/api/admin/libres', {action: 'delete', id});
      if (t.dataset.r === 'add') return act('/api/admin/libres', {action: 'add', id, pseudo: rEl.querySelector('[data-addp]').value});
      if (t.dataset.r === 'points') {
        const points = {};
        rEl.querySelectorAll('[data-pts]').forEach((i) => (points[i.dataset.pts] = i.value === '' ? null : Number(i.value)));
        return act('/api/admin/libres', {action: 'points', id, points});
      }
    }
  });

  $('#tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    tab = b.dataset.tab; history.replaceState(null, '', '#' + tab); render();
  });
  $('#refresh').addEventListener('click', () => load());

  async function load() {
    try {
      D = await call('/api/admin/tournoi');
      sessionStorage.setItem('rl-admin', pwd);
      $('#login').classList.add('hide'); $('#app').classList.remove('hide');
      render();
    } catch (e) {
      if (e.auth) { sessionStorage.removeItem('rl-admin'); $('#app').classList.add('hide'); $('#login').classList.remove('hide'); if (pwd) $('#login-err').innerHTML = `<div class="alert err">${esc(e.message)}</div>`; }
      else alert(e.message);
    }
  }
  $('#login').addEventListener('submit', (e) => { e.preventDefault(); pwd = $('#pwd').value; load(); });
  if (pwd) load(); else $('#login').classList.remove('hide');
})();
