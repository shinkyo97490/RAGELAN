// Paiement de sa part par un coéquipier (mode « chacun sa part »), via le lien personnel envoyé par le capitaine
(function () {
  const q = new URLSearchParams(location.search);
  const id = q.get('id'), p = q.get('p'), k = q.get('k');
  const api = `/api/payer/${encodeURIComponent(id || '')}/${encodeURIComponent(p || '')}?k=${encodeURIComponent(k || '')}`;
  const title = document.getElementById('title');
  const content = document.getElementById('content');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  let tries = 0;

  function team(r) {
    return `<div class="split-list">${r.team.map((x, i) => `<div class="split-row"><span class="who">${esc(x.pseudo)}${i === 0 ? ' (capitaine)' : ''}</span>
      <span class="${x.paid ? 'ok' : 'note'}" style="margin:0">${x.paid ? 'PAYÉ' : 'EN ATTENTE'}</span></div>`).join('')}</div>`;
  }

  function render(r) {
    const head = `<p><b>${esc(r.competition)}</b> · équipe <b>${esc(r.teamName)}</b></p>`;
    if (r.paid) {
      title.innerHTML = 'TA PART EST <span style="color:var(--orange)">PAYÉE</span>';
      content.innerHTML = `${head}${r.status === 'paid' ? '<div class="alert ok">Toute l\'équipe a payé : vous êtes inscrits !</div>'
        : '<div class="alert info">Merci ! L\'équipe sera confirmée quand tous les joueurs auront payé.</div>'}${team(r)}
        <p>Infos et horaires sur le <a href="https://discord.gg/VMUXA2z5Y9" target="_blank" rel="noopener">Discord RushXP</a>.</p>
        <p><a class="btn" href="index.html">Retour à l'accueil</a></p>`;
      return;
    }
    if (q.get('ok') && tries++ < 20) { content.innerHTML = '<p>Un instant, on confirme ton paiement…</p>'; setTimeout(load, 3000); return; }
    title.innerHTML = `SALUT <span style="color:var(--orange)">${esc(r.pseudo).toUpperCase()}</span>`;
    if (r.status === 'cancelled') { content.innerHTML = `${head}<div class="alert err">Cette inscription a été annulée. Contacte ton capitaine ou RushXP sur Discord.</div>`; return; }
    const dl = r.deadline ? new Date(r.deadline).toLocaleString('fr-FR', {weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Indian/Reunion'}) : '';
    content.innerHTML = `${head}
      <p>Ton capitaine t'a inscrit à la RAGE LAN 2026. Pour valider ta place, paie ta part : <b>${r.price} €</b>.${dl ? ` L'équipe a jusqu'au <b>${esc(dl)}</b> pour que tout le monde paie.` : ''}</p>
      ${team(r)}
      <div class="summary"><div><div class="note" style="margin:0">Ta part</div><div class="total">${r.price} €</div></div>
        <button class="btn" type="button" id="pay">Payer ma part</button></div>
      <p class="note">Paiement sécurisé par carte via Stripe. En payant, tu acceptes le règlement de la compétition et la <a href="confidentialite.html" target="_blank">politique de confidentialité</a>.</p>
      <div id="errors"></div>`;
    document.getElementById('pay').addEventListener('click', pay);
  }

  async function pay(e) {
    const btn = e.target;
    btn.disabled = true; btn.textContent = 'Un instant…';
    try {
      const res = await fetch(api, {method: 'POST'});
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Erreur');
      location.href = d.url;
    } catch (err) {
      document.getElementById('errors').innerHTML = `<div class="alert err">${esc(err.message)}</div>`;
      btn.disabled = false; btn.textContent = 'Payer ma part';
    }
  }

  async function load() {
    try {
      const res = await fetch(api, {cache: 'no-store'});
      const r = await res.json();
      if (!res.ok) throw new Error(r.error);
      render(r);
    } catch (e) {
      title.innerHTML = 'LIEN <span style="color:var(--orange)">INVALIDE</span>';
      content.innerHTML = '<p>Ce lien de paiement n\'est pas valide. Demande à ton capitaine de te renvoyer ton lien, ou contacte-nous sur <a href="https://discord.gg/VMUXA2z5Y9">Discord</a>.</p>';
    }
  }
  load();
})();
