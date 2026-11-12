// Page de retour après le paiement : attend la confirmation Stripe (webhook) puis affiche le récapitulatif
(function () {
  const qs = new URLSearchParams(location.search), id = qs.get('id'), sid = qs.get('s') || '';
  const title = document.getElementById('title');
  const content = document.getElementById('content');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  let tries = 0;

  // Mode « chacun sa part » : liens de paiement à envoyer aux coéquipiers
  function splitBlock(r) {
    if (r.payMode !== 'split') return '';
    const left = r.players.filter((p) => !p.paid);
    const dl = r.deadline ? new Date(r.deadline).toLocaleString('fr-FR', {weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Indian/Reunion'}) : '';
    return `<h2 style="font-size:24px;margin-top:20px">Paiement de l'équipe</h2>
      ${left.length ? `<div class="alert info">Envoie à chaque coéquipier <b>son lien personnel</b> (Discord, WhatsApp…). Chacun paie ${r.price} €. L'équipe est confirmée quand tout le monde a payé${dl ? `, avant le <b>${esc(dl)}</b>` : ''}. Garde cette page : elle se met à jour toute seule.</div>`
        : '<div class="alert ok">Tout le monde a payé : ton équipe est confirmée !</div>'}
      <div class="split-list">${r.players.map((p, i) => `<div class="split-row"><span class="who">${esc(p.pseudo)}${i === 0 ? ' (capitaine)' : ''}</span>
        ${p.paid ? '<span class="ok">PAYÉ</span>' : `<div class="row-in"><input readonly value="${esc(p.link)}" aria-label="Lien de paiement de ${esc(p.pseudo)}"><button class="btn small" type="button" data-copy="${esc(p.link)}">Copier</button></div>`}</div>`).join('')}</div>`;
  }

  function show(r) {
    const partial = r.status === 'partial';
    title.innerHTML = partial ? 'TA PART EST <span style="color:var(--orange)">PAYÉE</span>' : '<span style="color:var(--orange)">C\'EST BON !</span>';
    const bestOf = r.players.filter((p) => p.bestOf);
    const minors = r.players.filter((p) => p.mineur);
    const under16 = r.players.filter((p) => p.moins16);
    content.innerHTML = `
      <p><b>${esc(r.competition)}</b>${r.teamName ? ` · équipe <b>${esc(r.teamName)}</b>` : ''} · ${r.payMode === 'split' ? `${r.players.filter((p) => p.paid).length}/${r.players.length} parts payées` : `${r.amount} € payés`}.</p>
      ${splitBlock(r)}
      <p>Joueurs : ${r.players.map((p) => esc(p.pseudo)).join(', ')}</p>
      ${bestOf.length && !partial ? `<div class="alert ok">${bestOf.length === r.players.length ? (r.players.length > 1 ? 'Toute l\'équipe fait' : 'Tu fais') : `${bestOf.map((p) => esc(p.pseudo)).join(', ')} font`} partie des 30 premiers inscrits : Menu Best Of offert !</div>` : ''}
      ${minors.length ? `<div class="alert info"><b>Joueur(s) mineur(s) : ${minors.map((p) => esc(p.pseudo)).join(', ')}</b><br>
        L'autorisation parentale remplie et signée est obligatoire : <a href="docs/Autorisation_parentale_RAGE_LAN_2026.pdf" download>télécharger le PDF</a>, à présenter à l'accueil le jour J.
        ${under16.length ? `<br><b>Moins de 16 ans (${under16.map((p) => esc(p.pseudo)).join(', ')}) :</b> un adulte accompagnateur doit être présent sur place pendant toute la durée de présence.` : ''}</div>` : ''}
      <h2 style="font-size:24px;margin-top:20px">Rendez-vous</h2>
      <p>Samedi 21 novembre 13h → dimanche 22 novembre 16h · Complexe Sportif de Saint-Paul.<br>N'oublie pas ton PC ou ta console, ton écran, tes périphériques, un câble RJ45 et une multiprise.</p>
      <p>Les horaires des matchs et les infos de dernière minute seront partagés sur le <a href="https://discord.gg/VMUXA2z5Y9" target="_blank" rel="noopener">Discord RushXP</a> : rejoins-le !</p>
      <p><a class="btn" href="index.html">Retour à l'accueil</a></p>`;
  }

  async function check() {
    if (!id) { content.innerHTML = '<p>Lien invalide.</p>'; return; }
    try {
      const res = await fetch(`/api/inscription/${encodeURIComponent(id)}${sid ? `?s=${encodeURIComponent(sid)}` : ''}`, {cache: 'no-store'});
      if (res.status === 404) { content.innerHTML = '<p>Inscription introuvable. Contacte-nous sur <a href="https://discord.gg/VMUXA2z5Y9">Discord</a>.</p>'; return; }
      const r = await res.json();
      if (!res.ok) throw new Error(r.error);
      if (r.status === 'paid') return show(r);
      if (r.status === 'partial') { show(r); setTimeout(check, 15000); return; }
      if (r.status === 'pending' && tries++ < 20) { setTimeout(check, 3000); return; }
      title.innerHTML = 'PAIEMENT <span style="color:var(--orange)">NON CONFIRMÉ</span>';
      content.innerHTML = r.status === 'pending'
        ? '<p>La confirmation du paiement prend plus de temps que prévu. Recharge cette page dans quelques minutes. Si le problème persiste, contacte-nous sur Discord.</p>'
        : '<p>Ce paiement n\'a pas abouti et ta place n\'est plus réservée. Tu peux <a href="inscription.html">recommencer ton inscription</a>.</p>';
    } catch (e) {
      // Coupure réseau ou serveur qui redémarre : on réessaie avant d'abandonner
      if (tries++ < 20) { setTimeout(check, 3000); return; }
      content.innerHTML = '<p>Impossible de vérifier ton paiement pour le moment. Recharge cette page dans quelques minutes : si tu as payé, ton inscription sera bien prise en compte. Sinon contacte-nous sur <a href="https://discord.gg/VMUXA2z5Y9">Discord</a>.</p>';
    }
  }
  content.addEventListener('click', (e) => {
    const b = e.target.closest('[data-copy]');
    if (!b) return;
    navigator.clipboard.writeText(b.dataset.copy).then(() => { b.textContent = 'Copié !'; setTimeout(() => (b.textContent = 'Copier'), 1500); },
      () => b.previousElementSibling.select());
  });
  check();
})();
