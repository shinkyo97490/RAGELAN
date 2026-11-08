// Fonctions partagées par les pages de tournoi (résultats, admin, équipe, salle de match)
window.T = (function () {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const COLORS = {valorant: 'var(--valorant)', rocketleague: 'var(--rl)', fc27: 'var(--fc)', libres: 'var(--orange)'};
  const STATUS = {waiting: 'En attente', ready: 'À jouer', reported: '1 score déclaré', disputed: 'Scores différents', done: 'Terminé'};

  const team = (t) => (t ? `<span class="t-team">${t.logo ? `<img src="${esc(t.logo)}" alt="">` : ''}<span>${esc(t.name)}</span></span>` : '<span class="t-team" style="color:var(--muted)">À déterminer</span>');
  const score = (m) => (m.status === 'done' ? (m.bye ? 'exempt' : `${m.scoreA} - ${m.scoreB}`) : 'vs');
  const winner = (m) => (m.status === 'done' && !m.bye ? (m.scoreA > m.scoreB ? 'a' : m.scoreB > m.scoreA ? 'b' : '') : '');

  function groupsHtml(groups) {
    return `<div class="t-grid">${groups.map((g) => `<div class="t-card"><h3>Poule ${esc(g.name)}</h3>
      <table class="t-table"><thead><tr><th>#</th><th>Équipe</th><th>J</th><th>V</th><th>N</th><th>D</th><th>Diff</th><th>Pts</th></tr></thead><tbody>
      ${g.standings.map((r, i) => `<tr><td>${i + 1}</td><td>${team(r)}</td><td class="n">${r.played}</td><td class="n">${r.w}</td><td class="n">${r.d}</td><td class="n">${r.l}</td>
        <td class="n">${r.for - r.against > 0 ? '+' : ''}${r.for - r.against}</td><td class="n"><b>${r.pts}</b></td></tr>`).join('')}
      </tbody></table></div>`).join('')}</div>`;
  }

  function matchRow(m) {
    const w = winner(m);
    return `<div class="mrow ${w ? 'win-' + w : ''}"><div class="a">${team(m.a)}</div><div class="sc">${score(m)}</div><div class="b">${team(m.b)}</div></div>`;
  }

  // Tableau de phase finale, colonne par tour (Winner, Loser, grande finale)
  function bracketHtml(matches) {
    const bm = matches.filter((m) => m.stage === 'bracket');
    if (!bm.length) return '';
    const sections = [['main', ''], ['upper', 'Winner bracket'], ['lower', 'Loser bracket'], ['final', '']];
    return sections.map(([key, title]) => {
      const ms = bm.filter((m) => m.bracket === key);
      if (!ms.length) return '';
      const rounds = [...new Set(ms.map((m) => m.round))].sort((a, b) => a - b);
      return `${title ? `<h3 style="margin:18px 0 10px">${title}</h3>` : ''}<div class="bracket">${rounds.map((r) => {
        const col = ms.filter((m) => m.round === r).sort((a, b) => a.order - b.order);
        return `<div class="col"><h4>${esc(col[0].roundName)} · BO${col[0].bo}</h4>${col.map((m) => {
          const w = winner(m);
          return `<div class="bm"><div class="row ${w === 'a' ? 'w' : ''}">${team(m.a)}<b>${m.status === 'done' && !m.bye ? m.scoreA : ''}</b></div>
            <div class="row ${w === 'b' ? 'w' : ''}">${m.bye && !m.b ? '<span class="t-team" style="color:var(--muted)">Exempt</span>' : team(m.b)}<b>${m.status === 'done' && !m.bye ? m.scoreB : ''}</b></div></div>`;
        }).join('')}</div>`;
      }).join('')}</div>`;
    }).join('');
  }

  const SIDE = {attaque: 'Attaque', defense: 'Défense'};
  function vetoLog(m, nameA, nameB) {
    if (!m.veto) return '';
    const n = (s) => esc(s === 'a' ? nameA : nameB);
    return m.veto.steps.map((s) => s.act === 'ban' ? `${n(s.team)} bannit <b>${esc(s.map)}</b>`
      : s.act === 'pick' ? `${n(s.team)} choisit <b>${esc(s.map)}</b>`
        : s.act === 'decider' ? `Map décisive : <b>${esc(s.map)}</b>`
          : `${n(s.team)} commence en <b>${SIDE[s.side]}</b> sur ${esc(s.map)}`).join('<br>');
  }

  async function copy(text, btn) {
    try { await navigator.clipboard.writeText(text); if (btn) { const t = btn.textContent; btn.textContent = 'Copié !'; setTimeout(() => (btn.textContent = t), 1400); } }
    catch { prompt('Copie ce lien :', text); }
  }

  return {esc, COLORS, STATUS, team, score, winner, groupsHtml, matchRow, bracketHtml, vetoLog, SIDE, copy};
})();
