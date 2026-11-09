// Modèles des e-mails envoyés aux joueurs (confirmation, liens de paiement, rappels)
'use strict';

module.exports = function emails({BASE_URL, COMPETITIONS}) {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const DISCORD = 'https://discord.gg/VMUXA2z5Y9';
  const date = (iso) => new Date(iso).toLocaleString('fr-FR', {weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Indian/Reunion'});

  // Habillage commun (tableaux et styles en ligne pour les clients mail)
  function layout(title, body) {
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;background:#0c0a09;font-family:Arial,Helvetica,sans-serif;color:#f4f1ed">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0c0a09"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#16130f;border-top:6px solid #f7941d">
<tr><td style="padding:28px 28px 8px"><img src="${BASE_URL}/assets/da/logo-rage-lan-2.png" alt="LAN R.A.G.E 2" width="180" style="display:block;width:180px;height:auto"></td></tr>
<tr><td style="padding:8px 28px 28px;font-size:16px;line-height:1.55;color:#f4f1ed">
<h1 style="margin:10px 0 16px;font-size:26px;line-height:1.15;color:#ffffff;text-transform:uppercase">${esc(title)}</h1>
${body}
</td></tr>
<tr><td style="padding:18px 28px;background:#f7941d;color:#0c0a09;font-size:13px;line-height:1.5">
<b>RAGE LAN 2026</b> · 21 &amp; 22 novembre · Complexe Sportif de Saint-Paul<br>
<a href="${DISCORD}" style="color:#0c0a09">Discord RushXP</a> · <a href="https://twitch.tv/rushxptv" style="color:#0c0a09">twitch.tv/rushxptv</a> · <a href="${BASE_URL}" style="color:#0c0a09">ragelan.rushxp.re</a>
</td></tr></table>
<p style="font-size:12px;color:#8a8178;margin:14px 0 0">Tu reçois ce message suite à ton inscription à la RAGE LAN 2026 organisée par RushXP.</p>
</td></tr></table></body></html>`;
  }
  const btn = (href, label) => `<p style="margin:22px 0"><a href="${href}" style="display:inline-block;background:#f7941d;color:#0c0a09;font-weight:bold;text-decoration:none;padding:14px 22px;text-transform:uppercase">${esc(label)}</a></p>`;
  const box = (html, color = '#f7941d') => `<div style="border-left:4px solid ${color};background:#0c0a09;padding:12px 16px;margin:16px 0">${html}</div>`;
  // Version texte : on retire les balises
  const toText = (html) => html.replace(/<br\s*\/?>/g, '\n').replace(/<\/(p|div|li|h1|tr)>/g, '\n').replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g, '$2 ($1)')
    .replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n{3,}/g, '\n\n').trim();
  const mail = (to, subject, title, body) => { const html = layout(title, body); return {to, subject, html, text: toText(body)}; };

  const contacts = (reg) => reg.players.map((p) => p.email).filter(Boolean);
  const label = (reg) => `${COMPETITIONS[reg.competition].name}${reg.teamName ? ` · équipe ${reg.teamName}` : ''}`;

  function practical(reg) {
    const minors = reg.players.filter((p) => p.mineur), u16 = reg.players.filter((p) => p.moins16);
    return `${minors.length ? box(`<b>Joueur(s) mineur(s) : ${minors.map((p) => esc(p.pseudo)).join(', ')}</b><br>
      L'autorisation parentale remplie et signée est obligatoire, à présenter à l'accueil : <a href="${BASE_URL}/docs/Autorisation_parentale_RAGE_LAN_2026.pdf" style="color:#f7941d">télécharger le PDF</a>.
      ${u16.length ? `<br><b>Moins de 16 ans (${u16.map((p) => esc(p.pseudo)).join(', ')})</b> : un adulte accompagnateur doit être présent sur place pendant toute la durée de présence.` : ''}`, '#ffc72c') : ''}
      <p><b>Rendez-vous</b> samedi 21 novembre à 13h au Complexe Sportif de Saint-Paul, jusqu'au dimanche 22 novembre à 16h. On joue toute la nuit !</p>
      <p><b>À ramener :</b> ton PC ou ta console, ton écran, tes périphériques, un câble RJ45 et une multiprise.</p>
      <p>Horaires des matchs et infos de dernière minute sur le <a href="${DISCORD}" style="color:#f7941d">Discord RushXP</a> : rejoins-le !</p>`;
  }

  return {
    // Inscription confirmée (paiement complet)
    confirm(reg, teamUrl) {
      const bestOf = reg.players.filter((p) => p.bestOf);
      const body = `<p>Ton inscription est confirmée : <b>${esc(label(reg))}</b>.</p>
        <p>Joueurs : ${reg.players.map((p) => esc(p.pseudo)).join(', ')}<br>Montant réglé : ${reg.amount} €</p>
        ${bestOf.length ? box(`<b>Menu Best Of McDonald's offert</b> à ${bestOf.map((p) => esc(p.pseudo)).join(', ')} : vous faites partie des 30 premiers inscrits !`, '#ffc72c') : ''}
        ${teamUrl ? `<p>Pendant la LAN, ta page ${reg.teamName ? "d'équipe" : 'joueur'} te donne accès à tes matchs${reg.competition === 'valorant' ? ', au ban de maps' : ''} et à la déclaration des scores. Garde ce lien :</p>${btn(teamUrl, reg.teamName ? "Ma page d'équipe" : 'Ma page joueur')}` : ''}
        ${reg.competition === 'libres' ? `<p>Les salles des mini-tournois s'ouvrent en direct pendant la LAN : ${btn(`${BASE_URL}/libres.html`, 'Salles Joueurs libres')}</p>` : ''}
        ${practical(reg)}`;
      return mail(contacts(reg), `Inscription confirmée · RAGE LAN 2026 · ${COMPETITIONS[reg.competition].name}`, "C'est bon, tu es inscrit !", body);
    },
    // Chacun sa part : le capitaine a payé, liens de paiement de l'équipe
    splitCaptain(reg, links) {
      const body = `<p>Ta part est payée pour <b>${esc(label(reg))}</b>. Il reste à tes coéquipiers à payer la leur (${COMPETITIONS[reg.competition].price} € chacun) avant le <b>${esc(date(reg.deadline))}</b>.</p>
        <p>Chaque joueur a son lien personnel. ${reg.players.slice(1).some((p) => p.email) ? 'Ceux qui ont donné leur e-mail le reçoivent aussi directement.' : 'Envoie-le à chacun (Discord, WhatsApp…).'}</p>
        ${reg.players.map((p, i) => i === 0 ? '' : `<p style="margin:8px 0"><b>${esc(p.pseudo)}</b> : <a href="${links[i]}" style="color:#f7941d;word-break:break-all">${links[i]}</a></p>`).join('')}
        ${btn(`${BASE_URL}/merci.html?id=${reg.id}`, "Suivre le paiement de l'équipe")}
        <p style="font-size:14px;color:#c9c2b9">L'équipe est confirmée quand tout le monde a payé. Tu recevras alors un e-mail de confirmation.</p>`;
      return mail(reg.players[0].email, `Ta part est payée · paiement de l'équipe ${reg.teamName}`, 'Ta part est payée', body);
    },
    // Chacun sa part : lien personnel d'un coéquipier
    splitPlayer(reg, i, link) {
      const p = reg.players[i];
      const body = `<p>Salut <b>${esc(p.pseudo)}</b>, ton capitaine <b>${esc(reg.players[0].pseudo)}</b> t'a inscrit à la RAGE LAN 2026 : <b>${esc(label(reg))}</b>.</p>
        <p>Pour valider ta place, paie ta part : <b>${COMPETITIONS[reg.competition].price} €</b>, avant le <b>${esc(date(reg.deadline))}</b>.</p>
        ${btn(link, 'Payer ma part')}
        <p style="font-size:14px;color:#c9c2b9">Lien personnel : ne le partage pas.</p>`;
      return mail(p.email, `Paie ta part · RAGE LAN 2026 · équipe ${reg.teamName}`, 'Paie ta part', body);
    },
    // Chacun sa part : confirmation d'une part payée par un coéquipier
    playerPaid(reg, i) {
      const left = reg.players.filter((x) => !x.paid).length;
      const body = `<p>Merci <b>${esc(reg.players[i].pseudo)}</b>, ta part est payée pour <b>${esc(label(reg))}</b>.</p>
        <p>${left ? `Il reste ${left} joueur${left > 1 ? 's' : ''} à payer. L'équipe sera confirmée quand tout le monde aura payé.` : "Toute l'équipe a payé : vous êtes inscrits !"}</p>
        ${reg.players[i].bestOf ? box("<b>Menu Best Of McDonald's offert</b> : tu fais partie des 30 premiers inscrits !", '#ffc72c') : ''}`;
      return mail(reg.players[i].email, `Ta part est payée · RAGE LAN 2026`, 'Ta part est payée', body);
    },
    // Rappel avant la fin du délai de 48 h
    reminder(reg, links) {
      const unpaid = reg.players.map((p, i) => ({p, i})).filter(({p}) => !p.paid);
      const body = `<p>L'équipe <b>${esc(reg.teamName)}</b> (${esc(COMPETITIONS[reg.competition].name)}) n'est pas encore confirmée : il manque le paiement de <b>${unpaid.map(({p}) => esc(p.pseudo)).join(', ')}</b>.</p>
        <p>Date limite : <b>${esc(date(reg.deadline))}</b>.</p>
        ${unpaid.map(({p, i}) => `<p style="margin:8px 0"><b>${esc(p.pseudo)}</b> : <a href="${links[i]}" style="color:#f7941d;word-break:break-all">${links[i]}</a></p>`).join('')}
        <p>Un souci ? Contacte-nous sur le <a href="${DISCORD}" style="color:#f7941d">Discord RushXP</a>.</p>`;
      return mail([reg.players[0].email, ...unpaid.map(({p}) => p.email)], `Rappel : paiement de l'équipe ${reg.teamName} · RAGE LAN 2026`, "Il manque des paiements", body);
    },
    test() {
      return mail(null, 'Test d’envoi · RAGE LAN 2026', 'Les e-mails fonctionnent', '<p>Ce message de test confirme que le site ragelan.rushxp.re peut envoyer des e-mails depuis cette adresse.</p>');
    },
  };
};
