// Gestion des tournois de la RAGE LAN 2026 : poules, phases finales, salles de match
// (résultats saisis par les équipes, ban de maps Valorant) et salles Joueurs libres.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const VALORANT_MAPS = ['Abyss', 'Ascent', 'Bind', 'Breeze', 'Corrode', 'Fracture', 'Haven', 'Icebox', 'Lotus', 'Pearl', 'Split', 'Sunset'];
const BRACKET_COMPS = ['valorant', 'rocketleague', 'fc27'];

module.exports = function tournoi({DATA_DIR, COMPETITIONS, loadDb, send, readBody, rateLimited}) {
  const FILE = path.join(DATA_DIR, 'tournoi.json');
  const empty = () => ({settings: {valorant: {mapPool: []}}, groups: {}, matches: [], keys: {}, rooms: []});

  function load() {
    try { return {...empty(), ...JSON.parse(fs.readFileSync(FILE, 'utf8'))}; } catch { return empty(); }
  }
  function save(t) {
    fs.mkdirSync(DATA_DIR, {recursive: true});
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(t, null, 2));
    fs.renameSync(tmp, FILE);
  }
  const uid = () => crypto.randomBytes(6).toString('hex');
  const safeEq = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

  // Participants : équipes (ou joueurs solo) dont l'inscription est payée
  function entrants(comp) {
    return loadDb().filter((r) => r.competition === comp && r.status === 'paid')
      .map((r) => ({id: r.id, name: r.teamName || r.players[0].pseudo, logo: r.logo ? `/api/logo/${r.id}` : ''}));
  }
  function nameMap() {
    const m = {};
    for (const r of loadDb()) m[r.id] = {name: r.teamName || r.players[0].pseudo, logo: r.logo ? `/api/logo/${r.id}` : ''};
    return m;
  }
  // Lien personnel de chaque équipe / joueur (créé à la première demande)
  function keyFor(t, regId) {
    if (!t.keys[regId]) t.keys[regId] = crypto.randomBytes(12).toString('hex');
    return t.keys[regId];
  }

  // ---------- Ban de maps Valorant ----------
  // BO1 : bans alternés jusqu'à la dernière map. BO3 : ban, ban, pick, pick puis bans alternés. BO5 : ban, ban, 4 picks.
  // Après chaque pick, l'adversaire choisit son côté ; sur la map décisive, c'est l'équipe qui n'a pas fait le dernier ban.
  function vetoPlan(bo, n) {
    const plan = [];
    const other = (s) => (s === 'a' ? 'b' : 'a');
    let turn = 'a';
    const push = (act) => { plan.push({act, team: turn}); turn = other(turn); };
    if (bo === 1) { while (plan.length < n - 1) push('ban'); return plan; }
    push('ban'); push('ban');
    for (let i = 0; i < bo - 1; i++) push('pick');
    while (plan.filter((x) => x.act === 'ban').length + bo - 1 < n - 1) push('ban');
    return plan;
  }
  function vetoState(m) {
    if (!m.veto) return null;
    const {pool, steps} = m.veto;
    const used = new Set(steps.filter((s) => s.map && s.act !== 'side').map((s) => s.map));
    const remaining = pool.filter((x) => !used.has(x));
    const plan = vetoPlan(m.bo, pool.length);
    const done = steps.filter((s) => s.act !== 'side').length;
    const lastSide = steps[steps.length - 1];
    // Côté à choisir après un pick (ou sur la map décisive)
    const pendingPick = steps.length && steps[steps.length - 1].act === 'pick' ? steps[steps.length - 1] : null;
    let next = null;
    if (pendingPick) next = {act: 'side', team: pendingPick.team === 'a' ? 'b' : 'a', map: pendingPick.map};
    else if (done < plan.length) next = plan[done];
    else if (!steps.some((s) => s.act === 'decider')) next = {act: 'decider'};
    else if (!(lastSide && lastSide.act === 'side' && lastSide.decider)) {
      const lastBan = [...steps].reverse().find((s) => s.act === 'ban');
      next = {act: 'side', team: lastBan ? (lastBan.team === 'a' ? 'b' : 'a') : 'a', map: steps.find((s) => s.act === 'decider').map, decider: true};
    }
    const maps = [];
    for (const s of steps) {
      if (s.act === 'pick' || s.act === 'decider') maps.push({map: s.map, pickedBy: s.act === 'pick' ? s.team : null});
      if (s.act === 'side') { const mm = maps.find((x) => x.map === s.map); if (mm) { mm.sideBy = s.team; mm.side = s.side; } }
    }
    return {pool, remaining, steps, next, maps, complete: !next};
  }
  function applyDecider(m) {
    const st = vetoState(m);
    if (st && st.next && st.next.act === 'decider') m.veto.steps.push({act: 'decider', map: st.remaining[0]});
  }

  // ---------- Matchs ----------
  function newMatch(comp, stage, extra) {
    return {id: uid(), comp, stage, a: null, b: null, bo: 1, status: 'waiting', scoreA: null, scoreB: null, reports: {}, ...extra};
  }
  function refreshReady(t, m) {
    if (m.status === 'waiting' && m.a && m.b) m.status = 'ready';
    if (m.status === 'ready' && m.comp === 'valorant' && !m.veto) {
      const pool = (t.settings.valorant?.mapPool || []).slice();
      if (pool.length >= m.bo + (m.bo === 1 ? 1 : 2)) { m.veto = {pool, steps: []}; applyDecider(m); }
    }
  }
  function setResult(t, m, a, b) {
    m.scoreA = a; m.scoreB = b; m.status = 'done'; m.doneAt = new Date().toISOString();
    if (m.stage !== 'bracket' || a === b) return;
    const win = a > b ? m.a : m.b, lose = a > b ? m.b : m.a;
    for (const [who, link] of [[win, m.next?.winner], [lose, m.next?.loser]]) {
      if (!link) continue;
      const target = t.matches.find((x) => x.id === link.match);
      if (!target) continue;
      target[link.slot] = who;
      refreshReady(t, target);
    }
  }
  function validScore(m, a, b) {
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a > 99 || b > 99) return 'Score invalide.';
    if (m.bo > 1) {
      const need = Math.ceil(m.bo / 2);
      if (Math.max(a, b) !== need || Math.min(a, b) >= need) return `En BO${m.bo}, le gagnant a ${need} map${need > 1 ? 's' : ''}.`;
    } else if (a === b && m.stage === 'bracket') return "Pas d'égalité en phase finale.";
    return null;
  }

  // Classement d'une poule : 3 pts victoire, 1 pt nul ; départage à la différence puis au total marqué
  function standings(t, comp, group) {
    const rows = Object.fromEntries(group.teams.map((id) => [id, {id, played: 0, w: 0, d: 0, l: 0, pts: 0, for: 0, against: 0}]));
    for (const m of t.matches) {
      if (m.comp !== comp || m.stage !== 'group' || m.group !== group.name || m.status !== 'done') continue;
      const A = rows[m.a], B = rows[m.b];
      if (!A || !B) continue;
      A.played++; B.played++; A.for += m.scoreA; A.against += m.scoreB; B.for += m.scoreB; B.against += m.scoreA;
      if (m.scoreA > m.scoreB) { A.w++; B.l++; A.pts += 3; } else if (m.scoreB > m.scoreA) { B.w++; A.l++; B.pts += 3; } else { A.d++; B.d++; A.pts++; B.pts++; }
    }
    return Object.values(rows).sort((x, y) => y.pts - x.pts || (y.for - y.against) - (x.for - x.against) || y.for - x.for);
  }

  // Round robin (méthode du cercle)
  function roundRobin(ids) {
    const list = ids.length % 2 ? [...ids, null] : [...ids];
    const n = list.length, rounds = [];
    for (let r = 0; r < n - 1; r++) {
      const pairs = [];
      for (let i = 0; i < n / 2; i++) { const a = list[i], b = list[n - 1 - i]; if (a && b) pairs.push(r % 2 ? [b, a] : [a, b]); }
      rounds.push(pairs);
      list.splice(1, 0, list.pop());
    }
    return rounds;
  }

  // Ordre de placement standard : 1 contre le dernier, et les deux meilleurs ne se croisent qu'en finale
  function seedOrder(size) {
    let o = [1];
    while (o.length < size) { const s = o.length * 2 + 1; o = o.flatMap((x) => [x, s - x]); }
    return o;
  }
  const roundName = (left) => (left === 1 ? 'Finale' : left === 2 ? 'Demi-finales' : left === 4 ? 'Quarts de finale' : `${left * 2}es de finale`);

  function buildSingle(comp, seeds, bo, boFinal) {
    let size = 1; while (size < seeds.length) size *= 2;
    const order = seedOrder(size).map((s) => seeds[s - 1] || null);
    const rounds = [];
    for (let left = size / 2, r = 1; left >= 1; left /= 2, r++) {
      rounds.push(Array.from({length: left}, (_, i) => newMatch(comp, 'bracket', {bracket: 'main', round: r, roundName: roundName(left), order: i, bo: left === 1 ? boFinal : bo})));
    }
    rounds.forEach((ms, r) => ms.forEach((m, i) => { if (rounds[r + 1]) m.next = {winner: {match: rounds[r + 1][Math.floor(i / 2)].id, slot: i % 2 ? 'b' : 'a'}}; }));
    rounds[0].forEach((m, i) => { m.a = order[i * 2]; m.b = order[i * 2 + 1]; });
    return rounds.flat();
  }

  function buildDouble(comp, seeds, bo, boFinal) {
    const size = seeds.length, k = Math.log2(size);
    const order = seedOrder(size).map((s) => seeds[s - 1]);
    const ub = [];
    for (let r = 1; r <= k; r++) {
      const n = size / 2 ** r;
      ub.push(Array.from({length: n}, (_, i) => newMatch(comp, 'bracket', {bracket: 'upper', round: r, order: i, bo,
        roundName: n === 1 ? 'Finale Winner' : `Winner · tour ${r}`})));
    }
    ub.forEach((ms, r) => ms.forEach((m, i) => { if (ub[r + 1]) m.next = {winner: {match: ub[r + 1][Math.floor(i / 2)].id, slot: i % 2 ? 'b' : 'a'}}; }));
    ub[0].forEach((m, i) => { m.a = order[i * 2]; m.b = order[i * 2 + 1]; });
    const lb = [];
    let lr = 1;
    const mk = (n, name) => Array.from({length: n}, (_, i) => newMatch(comp, 'bracket', {bracket: 'lower', round: lr, order: i, bo, roundName: name}));
    // Tour 1 du Loser : perdants du 1er tour Winner
    let prev = mk(size / 4, 'Loser · tour 1');
    ub[0].forEach((m, i) => (m.next.loser = {match: prev[Math.floor(i / 2)].id, slot: i % 2 ? 'b' : 'a'}));
    lb.push(prev);
    for (let j = 2; j <= k; j++) {
      lr++;
      const drop = mk(size / 2 ** j, j === k ? 'Finale Loser' : `Loser · tour ${lr}`);
      prev.forEach((m, i) => (m.next = {winner: {match: drop[i].id, slot: 'a'}}));
      // Les perdants du Winner sont croisés pour éviter une revanche immédiate
      ub[j - 1].forEach((m, i) => { m.next = m.next || {}; m.next.loser = {match: drop[drop.length - 1 - i].id, slot: 'b'}; });
      lb.push(drop);
      prev = drop;
      if (j < k) {
        lr++;
        const cons = mk(drop.length / 2, `Loser · tour ${lr}`);
        drop.forEach((m, i) => (m.next = {winner: {match: cons[Math.floor(i / 2)].id, slot: i % 2 ? 'b' : 'a'}}));
        lb.push(cons);
        prev = cons;
      }
    }
    const gf = newMatch(comp, 'bracket', {bracket: 'final', round: 1, order: 0, bo: boFinal, roundName: 'Grande finale'});
    ub[k - 1][0].next.winner = {match: gf.id, slot: 'a'};
    prev[0].next = {winner: {match: gf.id, slot: 'b'}};
    return [...ub.flat(), ...lb.flat(), gf];
  }

  // Byes (phase finale simple) : l'équipe seule passe directement au tour suivant
  function resolveByes(t, comp) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const m of t.matches) {
        if (m.comp !== comp || m.stage !== 'bracket' || m.status === 'done' || m.round !== 1 || m.bracket !== 'main') continue;
        if ((m.a && !m.b) || (!m.a && m.b)) { m.bye = true; setResult(t, m, m.a ? 1 : 0, m.b ? 1 : 0); changed = true; }
      }
    }
  }

  // ---------- Vues ----------
  function publicMatch(m, names) {
    const side = (id) => (id ? {id, ...(names[id] || {name: '?'})} : null);
    const veto = m.veto ? vetoState(m) : null;
    return {id: m.id, comp: m.comp, stage: m.stage, group: m.group, bracket: m.bracket, round: m.round, roundName: m.roundName, order: m.order,
      bo: m.bo, a: side(m.a), b: side(m.b), status: m.status, scoreA: m.scoreA, scoreB: m.scoreB, bye: Boolean(m.bye),
      reported: {a: Boolean(m.reports?.a), b: Boolean(m.reports?.b)},
      veto: veto && {maps: veto.maps, complete: veto.complete, steps: veto.steps}};
  }
  function publicState() {
    const t = load(), names = nameMap();
    const comps = {};
    for (const c of BRACKET_COMPS) {
      comps[c] = {
        name: COMPETITIONS[c].name,
        groups: (t.groups[c] || []).map((g) => ({name: g.name, standings: standings(t, c, g).map((r) => ({...r, ...(names[r.id] || {})}))})),
        matches: t.matches.filter((m) => m.comp === c).map((m) => publicMatch(m, names)),
      };
    }
    return {comps, rooms: t.rooms.map(publicRoom), classement: classement(t)};
  }
  function publicRoom(r) {
    return {id: r.id, name: r.name, game: r.game, capacity: r.capacity, info: r.info, open: r.open,
      players: r.players.map((p) => ({pseudo: p.pseudo, points: r.points?.[p.key] ?? null}))};
  }
  function classement(t) {
    const tot = {};
    for (const r of t.rooms) for (const p of r.players) {
      const pts = r.points?.[p.key];
      if (pts === undefined || pts === null) continue;
      tot[p.key] = tot[p.key] || {pseudo: p.pseudo, libre: p.libre, points: 0, rooms: 0};
      tot[p.key].points += pts; tot[p.key].rooms++;
    }
    return Object.values(tot).sort((a, b) => b.points - a.points);
  }

  // Joueurs autorisés à rejoindre une salle Joueurs libres : tous les joueurs inscrits et payés
  function findPlayer(pseudo) {
    const n = String(pseudo || '').trim().toLowerCase();
    if (!n) return null;
    for (const r of loadDb()) {
      if (r.status !== 'paid') continue;
      for (const p of r.players) if (p.pseudo.toLowerCase() === n) return {pseudo: p.pseudo, key: `${r.id}:${r.players.indexOf(p)}`, libre: r.competition === 'libres'};
    }
    return null;
  }

  const json = async (req) => { try { return JSON.parse(await readBody(req)); } catch { return null; } };

  // ---------- Routes publiques ----------
  async function publicApi(req, res, url, ip) {
    if (req.method === 'GET' && url.pathname === '/api/tournoi') return send(res, 200, publicState(), {'Cache-Control': 'no-store'}), true;

    // Page d'une équipe : ses matchs et ses salles
    let m = url.pathname.match(/^\/api\/tournoi\/equipe\/([0-9a-f-]{36})$/);
    if (req.method === 'GET' && m) {
      const t = load();
      if (!safeEq(url.searchParams.get('k') || '', t.keys[m[1]] || '')) return send(res, 404, {error: 'Lien invalide.'}), true;
      const reg = loadDb().find((r) => r.id === m[1]);
      const names = nameMap();
      return send(res, 200, {id: m[1], name: names[m[1]]?.name, logo: names[m[1]]?.logo, comp: reg.competition, compName: COMPETITIONS[reg.competition].name,
        matches: t.matches.filter((x) => x.a === m[1] || x.b === m[1]).map((x) => ({...publicMatch(x, names), mySide: x.a === m[1] ? 'a' : 'b'}))},
      {'Cache-Control': 'no-store'}), true;
    }

    // Salle de match
    m = url.pathname.match(/^\/api\/tournoi\/match\/([0-9a-f]{12})(\/(veto|report))?$/);
    if (m) {
      const t = load();
      const match = t.matches.find((x) => x.id === m[1]);
      if (!match) return send(res, 404, {error: 'Match introuvable.'}), true;
      const body = req.method === 'POST' ? await json(req) : null;
      const k = req.method === 'GET' ? url.searchParams.get('k') || '' : body?.k || '';
      const mySide = match.a && safeEq(k, t.keys[match.a] || '') ? 'a' : match.b && safeEq(k, t.keys[match.b] || '') ? 'b' : null;
      if (!mySide) return send(res, 403, {error: "Ce lien ne donne pas accès à ce match."}), true;
      const view = () => {
        const names = nameMap();
        const v = match.veto ? vetoState(match) : null;
        return {...publicMatch(match, names), mySide, myReport: match.reports?.[mySide] || null, otherReport: match.reports?.[mySide === 'a' ? 'b' : 'a'] || null,
          veto: v && {...v, maps: v.maps}};
      };
      if (req.method === 'GET' && !m[3]) return send(res, 200, view(), {'Cache-Control': 'no-store'}), true;
      if (req.method !== 'POST' || !body) return send(res, 400, {error: 'Requête invalide.'}), true;
      if (rateLimited('t:' + ip, 300)) return send(res, 429, {error: 'Trop de requêtes.'}), true;

      if (m[3] === 'veto') {
        if (!match.veto) return send(res, 409, {error: "Pas de ban de maps pour ce match."}), true;
        if (match.status === 'done') return send(res, 409, {error: 'Match terminé.'}), true;
        const st = vetoState(match);
        if (!st.next) return send(res, 409, {error: 'Le ban de maps est terminé.'}), true;
        if (st.next.team !== mySide) return send(res, 409, {error: "Ce n'est pas ton tour."}), true;
        if (st.next.act === 'side') {
          if (!['attaque', 'defense'].includes(body.side)) return send(res, 400, {error: 'Choisis Attaque ou Défense.'}), true;
          match.veto.steps.push({act: 'side', team: mySide, map: st.next.map, side: body.side, decider: Boolean(st.next.decider)});
        } else {
          if (!st.remaining.includes(body.map)) return send(res, 400, {error: 'Map non disponible.'}), true;
          match.veto.steps.push({act: st.next.act, team: mySide, map: body.map});
          applyDecider(match);
        }
        save(t);
        return send(res, 200, view()), true;
      }

      // Résultat : chaque équipe déclare le score ; s'ils concordent, le match est validé
      if (match.status === 'done') return send(res, 409, {error: 'Résultat déjà validé. Contacte un admin en cas d’erreur.'}), true;
      if (match.status === 'waiting') return send(res, 409, {error: 'Les deux adversaires ne sont pas encore connus.'}), true;
      const a = Number(body.scoreA), b = Number(body.scoreB);
      const err = validScore(match, a, b);
      if (err) return send(res, 400, {error: err}), true;
      match.reports = match.reports || {};
      match.reports[mySide] = {scoreA: a, scoreB: b, at: new Date().toISOString()};
      const o = match.reports[mySide === 'a' ? 'b' : 'a'];
      if (o && o.scoreA === a && o.scoreB === b) setResult(t, match, a, b);
      else match.status = o ? 'disputed' : 'reported';
      save(t);
      return send(res, 200, view()), true;
    }

    // Joueurs libres : inscription en direct dans une salle
    if (req.method === 'POST' && url.pathname === '/api/libres/join') {
      if (rateLimited('j:' + ip, 60)) return send(res, 429, {error: 'Trop de tentatives.'}), true;
      const body = await json(req);
      const t = load();
      const room = t.rooms.find((r) => r.id === body?.room);
      if (!room) return send(res, 404, {error: 'Salle introuvable.'}), true;
      if (!room.open) return send(res, 409, {error: 'Les inscriptions de cette salle sont fermées.'}), true;
      const p = findPlayer(body.pseudo);
      if (!p) return send(res, 404, {error: "Pseudo introuvable : utilise le pseudo de ton inscription à la LAN."}), true;
      if (room.players.some((x) => x.key === p.key)) return send(res, 409, {error: 'Tu es déjà inscrit dans cette salle.'}), true;
      if (room.capacity && room.players.length >= room.capacity) return send(res, 409, {error: 'Salle complète.'}), true;
      room.players.push({...p, at: new Date().toISOString()});
      save(t);
      return send(res, 200, publicRoom(room)), true;
    }
    return false;
  }

  // ---------- Routes admin (mot de passe déjà vérifié) ----------
  async function adminApi(req, res, url) {
    if (!url.pathname.startsWith('/api/admin/tournoi') && !url.pathname.startsWith('/api/admin/libres')) return false;
    const t = load();
    if (req.method === 'GET' && url.pathname === '/api/admin/tournoi') {
      const ent = {};
      for (const c of BRACKET_COMPS) ent[c] = entrants(c).map((e) => ({...e, key: keyFor(t, e.id)}));
      save(t);
      return send(res, 200, {...publicState(), entrants: ent, settings: t.settings, groupsRaw: t.groups, maps: VALORANT_MAPS,
        matchesRaw: t.matches.map((m) => ({id: m.id, reports: m.reports})),
        rooms: t.rooms.map((r) => ({...publicRoom(r), players: r.players.map((p) => ({pseudo: p.pseudo, key: p.key, libre: p.libre, points: r.points?.[p.key] ?? null}))}))},
      {'Cache-Control': 'no-store'}), true;
    }
    if (req.method !== 'POST') return send(res, 405, {error: 'Méthode non autorisée.'}), true;
    const b = await json(req);
    if (!b) return send(res, 400, {error: 'Requête invalide.'}), true;
    const comp = BRACKET_COMPS.includes(b.comp) ? b.comp : null;
    const ok = () => (save(t), send(res, 200, {ok: true}), true);
    const fail = (msg) => (send(res, 400, {error: msg}), true);
    const known = comp ? new Set(entrants(comp).map((e) => e.id)) : new Set();

    switch (url.pathname) {
      case '/api/admin/tournoi/settings': {
        const pool = Array.isArray(b.mapPool) ? [...new Set(b.mapPool.filter((x) => VALORANT_MAPS.includes(x)))] : null;
        if (!pool) return fail('Map pool invalide.');
        t.settings.valorant = {...t.settings.valorant, mapPool: pool};
        // Les matchs Valorant pas encore commencés prennent le nouveau map pool
        for (const m of t.matches) if (m.comp === 'valorant' && m.status !== 'done' && (!m.veto || !m.veto.steps.some((s) => s.act !== 'decider'))) { delete m.veto; refreshReady(t, m); }
        return ok();
      }
      case '/api/admin/tournoi/groups': {
        if (!comp) return fail('Compétition inconnue.');
        if (t.matches.some((m) => m.comp === comp && m.stage === 'group' && m.status === 'done') && !b.force) return fail('Des matchs de poule ont déjà un résultat. Confirme pour tout remplacer.');
        const groups = (b.groups || []).map((g, i) => ({name: String(g.name || String.fromCharCode(65 + i)).slice(0, 20), teams: [...new Set((g.teams || []).filter((id) => known.has(id)))]}))
          .filter((g) => g.teams.length);
        const bo = [1, 3, 5].includes(b.bo) ? b.bo : 1;
        t.groups[comp] = groups;
        t.matches = t.matches.filter((m) => !(m.comp === comp && m.stage === 'group'));
        for (const g of groups) roundRobin(g.teams).forEach((pairs, r) => pairs.forEach(([x, y], i) => {
          const m = newMatch(comp, 'group', {group: g.name, round: r + 1, roundName: `Poule ${g.name} · journée ${r + 1}`, order: i, bo, a: x, b: y});
          refreshReady(t, m); t.matches.push(m);
        }));
        return ok();
      }
      case '/api/admin/tournoi/bracket': {
        if (!comp) return fail('Compétition inconnue.');
        if (t.matches.some((m) => m.comp === comp && m.stage === 'bracket' && m.status === 'done' && !m.bye) && !b.force) return fail('La phase finale a déjà des résultats. Confirme pour la recréer.');
        const seeds = (b.seeds || []).filter((id) => known.has(id));
        if (new Set(seeds).size !== seeds.length || seeds.length < 2) return fail('Choisis au moins 2 participants différents.');
        const bo = [1, 3, 5].includes(b.bo) ? b.bo : 1, boFinal = [1, 3, 5].includes(b.boFinal) ? b.boFinal : bo;
        let list;
        if (b.format === 'double') {
          if (![4, 8, 16].includes(seeds.length)) return fail('La double élimination demande 4, 8 ou 16 participants.');
          list = buildDouble(comp, seeds, bo, boFinal);
        } else list = buildSingle(comp, seeds, bo, boFinal);
        t.matches = t.matches.filter((m) => !(m.comp === comp && m.stage === 'bracket'));
        t.matches.push(...list);
        for (const m of list) refreshReady(t, m);
        resolveByes(t, comp);
        return ok();
      }
      case '/api/admin/tournoi/clear': {
        if (!comp || !['group', 'bracket'].includes(b.stage)) return fail('Requête invalide.');
        t.matches = t.matches.filter((m) => !(m.comp === comp && m.stage === b.stage));
        if (b.stage === 'group') delete t.groups[comp];
        return ok();
      }
      case '/api/admin/tournoi/match': {
        const m = t.matches.find((x) => x.id === b.id);
        if (!m) return fail('Match introuvable.');
        if (b.action === 'score') {
          const a = Number(b.scoreA), c = Number(b.scoreB);
          const err = validScore(m, a, c);
          if (err) return fail(err);
          if (m.status === 'done' && m.stage === 'bracket') return fail('Résultat déjà validé : réinitialise le match avant de le modifier.');
          setResult(t, m, a, c);
        } else if (b.action === 'reset') {
          if (m.stage === 'bracket' && m.status === 'done') {
            // Retire le vainqueur/perdant propagé, sauf si le match suivant est déjà joué
            for (const link of [m.next?.winner, m.next?.loser]) {
              const nx = link && t.matches.find((x) => x.id === link.match);
              if (nx && nx.status === 'done') return fail(`Le match suivant (${nx.roundName}) est déjà joué : réinitialise-le d'abord.`);
            }
            for (const link of [m.next?.winner, m.next?.loser]) {
              const nx = link && t.matches.find((x) => x.id === link.match);
              if (nx) { nx[link.slot] = null; nx.status = 'waiting'; nx.reports = {}; delete nx.veto; }
            }
          }
          m.status = m.a && m.b ? 'ready' : 'waiting'; m.scoreA = m.scoreB = null; m.reports = {}; delete m.doneAt;
        } else if (b.action === 'resetVeto') { delete m.veto; refreshReady(t, m); }
        else if (b.action === 'bo' && [1, 3, 5].includes(b.bo) && m.status !== 'done') { m.bo = b.bo; delete m.veto; refreshReady(t, m); }
        else return fail('Action inconnue.');
        return ok();
      }
      case '/api/admin/libres': {
        const room = t.rooms.find((r) => r.id === b.id);
        if (b.action === 'create') {
          const name = String(b.name || '').trim().slice(0, 60);
          if (!name) return fail('Donne un nom à la salle.');
          t.rooms.push({id: uid(), name, game: String(b.game || '').slice(0, 40), capacity: Math.max(0, Math.min(200, Number(b.capacity) || 0)),
            info: String(b.info || '').slice(0, 300), open: true, players: [], points: {}, createdAt: new Date().toISOString()});
          return ok();
        }
        if (!room) return fail('Salle introuvable.');
        if (b.action === 'update') {
          if (b.name !== undefined) room.name = String(b.name).trim().slice(0, 60) || room.name;
          if (b.game !== undefined) room.game = String(b.game).slice(0, 40);
          if (b.info !== undefined) room.info = String(b.info).slice(0, 300);
          if (b.capacity !== undefined) room.capacity = Math.max(0, Math.min(200, Number(b.capacity) || 0));
          if (b.open !== undefined) room.open = Boolean(b.open);
        } else if (b.action === 'delete') t.rooms = t.rooms.filter((r) => r !== room);
        else if (b.action === 'add') {
          const p = findPlayer(b.pseudo);
          if (!p) return fail('Pseudo introuvable parmi les inscrits payés.');
          if (!room.players.some((x) => x.key === p.key)) room.players.push({...p, at: new Date().toISOString()});
        } else if (b.action === 'remove') { room.players = room.players.filter((p) => p.key !== b.key); delete room.points[b.key]; }
        else if (b.action === 'points') {
          room.points = room.points || {};
          for (const [key, v] of Object.entries(b.points || {})) {
            if (!room.players.some((p) => p.key === key)) continue;
            if (v === null || v === '') delete room.points[key];
            else if (Number.isFinite(Number(v))) room.points[key] = Math.round(Number(v));
          }
        } else return fail('Action inconnue.');
        return ok();
      }
    }
    return send(res, 404, {error: 'Introuvable.'}), true;
  }

  // Lien de la page d'équipe / joueur (pour l'e-mail de confirmation)
  function teamPath(regId) {
    const t = load();
    const had = t.keys[regId];
    const k = keyFor(t, regId);
    if (!had) save(t);
    return `/equipe.html?id=${regId}&k=${k}`;
  }

  return {publicApi, adminApi, vetoPlan, teamPath};
};
