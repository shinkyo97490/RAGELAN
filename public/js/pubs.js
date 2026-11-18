// Espaces partenaires (Orange, McDonald's) : colonne affichée à côté des pages tournoi, salle de match, équipe et inscription.
(function () {
  const MCDO = ['assets/pub/mcdo-combo-gamer.jpg', 'assets/pub/mcdo-ravito.jpg', 'assets/pub/mcdo-respawn.jpg'];
  const ORANGE = 'assets/pub/orange-cheatcode.jpg';
  document.querySelectorAll('[data-pubs]').forEach((box) => {
    box.innerHTML = `<span class="pubs-k">Partenaires</span>
      <a class="pub" href="https://www.orange.re/" target="_blank" rel="noopener sponsored" aria-label="Orange : offre Fibre Cheat Code 18-26 ans"><img src="${ORANGE}" alt="Orange · Cheat_Code_18_26 · Offre Internet Fibre 14,90 €/mois pendant 9 mois puis 24,90 €/mois, engagement 12 mois" loading="lazy"></a>
      <div class="pub pub-rot" aria-label="McDonald's McDelivery avec Uber Eats : offres jusqu'au 29 novembre 2026">${MCDO.map((src, i) => `<img src="${src}" alt="McDonald's McDelivery · offre Uber Eats jusqu'au 29 novembre 2026" class="${i ? '' : 'on'}" loading="lazy">`).join('')}</div>`;
    const imgs = box.querySelectorAll('.pub-rot img');
    let i = 0;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) setInterval(() => { imgs[i].classList.remove('on'); i = (i + 1) % imgs.length; imgs[i].classList.add('on'); }, 7000);
  });
})();
