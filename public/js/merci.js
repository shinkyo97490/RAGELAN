// Page de retour après le paiement : attend la confirmation Stripe (webhook) puis affiche le récapitulatif
(function () {
  const id = new URLSearchParams(location.search).get('id');
  const title = document.getElementById('title');
  const content = document.getElementById('content');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  let tries = 0;

  function show(r) {
    title.innerHTML = '<span style="color:var(--orange)">C\'EST BON !</span>';
    const bestOf = r.players.filter((p) => p.bestOf);
    const minors = r.players.filter((p) => p.mineur);
    const under16 = r.players.filter((p) => p.moins16);
    content.innerHTML = `
      <p><b>${esc(r.competition)}</b>${r.teamName ? ` · équipe <b>${esc(r.teamName)}</b>` : ''} · ${r.amount} € payés.</p>
      <p>Joueurs : ${r.players.map((p) => esc(p.pseudo)).join(', ')}</p>
      ${bestOf.length ? `<div class="alert ok">${bestOf.length === r.players.length ? (r.players.length > 1 ? 'Toute l\'équipe fait' : 'Tu fais') : `${bestOf.map((p) => esc(p.pseudo)).join(', ')} font`} partie des 30 premiers inscrits : Menu Best Of offert !</div>` : ''}
      ${minors.length ? `<div class="alert info"><b>Joueur(s) mineur(s) : ${minors.map((p) => esc(p.pseudo)).join(', ')}</b><br>
        L'autorisation parentale remplie et signée est obligatoire : <a href="docs/Autorisation_parentale_RAGE_LAN_2026.pdf" download>télécharger le PDF</a>, à présenter à l'accueil le jour J.
        ${under16.length ? `<br><b>Moins de 16 ans (${under16.map((p) => esc(p.pseudo)).join(', ')}) :</b> un adulte accompagnateur doit être présent sur place pendant toute la durée de présence.` : ''}</div>` : ''}
      <h2 style="font-size:24px;margin-top:20px">Rendez-vous</h2>
      <p>Samedi 21 novembre 13h → dimanche 22 novembre 16h · Complexe Sportif de Saint-Paul.<br>N'oublie pas ton PC ou ta console + ton écran.</p>
      <p>Les horaires des matchs et les infos de dernière minute seront partagés sur le <a href="https://discord.gg/VMUXA2z5Y9" target="_blank" rel="noopener">Discord RushXP</a> : rejoins-le !</p>
      <p><a class="btn" href="index.html">Retour à l'accueil</a></p>`;
  }

  async function check() {
    if (!id) { content.innerHTML = '<p>Lien invalide.</p>'; return; }
    try {
      const res = await fetch(`/api/inscription/${encodeURIComponent(id)}`, {cache: 'no-store'});
      const r = await res.json();
      if (!res.ok) throw new Error(r.error);
      if (r.status === 'paid') return show(r);
      if (r.status === 'pending' && tries++ < 20) { setTimeout(check, 3000); return; }
      title.innerHTML = 'PAIEMENT <span style="color:var(--orange)">NON CONFIRMÉ</span>';
      content.innerHTML = r.status === 'pending'
        ? '<p>La confirmation du paiement prend plus de temps que prévu. Recharge cette page dans quelques minutes. Si le problème persiste, contacte-nous sur Discord.</p>'
        : '<p>Ce paiement n\'a pas abouti et ta place n\'est plus réservée. Tu peux <a href="inscription.html">recommencer ton inscription</a>.</p>';
    } catch (e) {
      content.innerHTML = '<p>Inscription introuvable. Contacte-nous sur <a href="https://discord.gg/VMUXA2z5Y9">Discord</a>.</p>';
    }
  }
  check();
})();
