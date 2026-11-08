// Formulaire d'inscription : choix de la compétition, joueurs, règles mineurs, paiement Stripe
(function () {
  const EVENT_DAY = new Date('2026-11-21T00:00:00Z');
  const COLORS = {valorant: 'var(--valorant)', rocketleague: 'var(--rl)', fc27: 'var(--fc)', libres: 'var(--libres)'};
  const INGAME = {valorant: 'Riot ID (ex. Pseudo#TAG) *', rocketleague: 'ID Epic Games / Steam *', fc27: 'EA ID *', libres: 'Pseudo en jeu principal *'};
  const RULES = {valorant: 'reglements/valorant.html', rocketleague: 'reglements/rocketleague.html', fc27: 'reglements/fc27.html', libres: 'reglements/libres.html'};

  const $ = (s, el = document) => el.querySelector(s);
  const params = new URLSearchParams(location.search);
  let st = null;
  let current = null;

  function banner(html, kind = 'info') { $('#banner').innerHTML = html ? `<div class="alert ${kind}">${html}</div>` : ''; }

  function ageAt(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const b = new Date(value + 'T00:00:00Z');
    let a = EVENT_DAY.getUTCFullYear() - b.getUTCFullYear();
    const m = EVENT_DAY.getUTCMonth() - b.getUTCMonth();
    if (m < 0 || (m === 0 && EVENT_DAY.getUTCDate() < b.getUTCDate())) a--;
    return a;
  }

  function renderPicker() {
    const box = $('#comp-pick');
    box.innerHTML = '';
    for (const [id, c] of Object.entries(st.competitions)) {
      const full = c.remaining === 0;
      const lab = document.createElement('label');
      lab.style.setProperty('--c', COLORS[id]);
      lab.innerHTML = `<input type="radio" name="competition" value="${id}" ${full ? 'disabled' : ''}>
        <span class="display" style="color:${COLORS[id]}">${c.name}</span>
        <small>${c.team ? `Équipe de ${c.size}` : 'Solo'} · ${c.price} € / joueur</small>
        <small>${full ? '<b style="color:#ff6b6b">COMPLET</b>' : `${c.remaining} ${c.unit} restant${c.unit === 'joueurs' ? '' : 'e'}${c.remaining > 1 ? 's' : ''}`}</small>`;
      box.appendChild(lab);
    }
    box.addEventListener('change', (e) => select(e.target.value));
    const pre = params.get('c');
    const input = pre && box.querySelector(`input[value="${pre}"]:not(:disabled)`);
    if (input) { input.checked = true; select(pre); }
  }

  function select(id) {
    current = id;
    const c = st.competitions[id];
    $('#team-panel').classList.toggle('hide', !c.team);
    $('#players-panel').classList.remove('hide');
    $('#final-panel').classList.remove('hide');
    $('#players-title').textContent = c.team ? `3. Les ${c.size} joueurs` : '2. Tes informations';
    $('#reglement-link').href = RULES[id];
    const wrap = $('#players');
    wrap.innerHTML = '';
    for (let i = 0; i < c.size; i++) {
      const node = $('#tpl-player').content.firstElementChild.cloneNode(true);
      node.querySelector('.p-title').textContent = c.team ? `Joueur ${i + 1}` : 'Joueur';
      node.querySelector('.p-sub').textContent = c.team && i === 0 ? 'Capitaine' : '';
      node.querySelector('.ingame-label').textContent = INGAME[id];
      const contactRequired = i === 0;
      node.querySelector('.email-label').textContent = contactRequired ? 'E-mail *' : 'E-mail (facultatif)';
      node.querySelector('.tel-label').textContent = contactRequired ? 'Téléphone *' : 'Téléphone (facultatif)';
      node.querySelector('[data-f="naissance"]').addEventListener('change', (e) => updateMinor(node, e.target.value));
      wrap.appendChild(node);
    }
    const total = c.price * c.size;
    $('#total').textContent = `${total} €`;
    $('#total-detail').textContent = c.team ? `${c.size} joueurs × ${c.price} €` : '';
  }

  function updateMinor(node, value) {
    const age = ageAt(value);
    const box = node.querySelector('.minor-box');
    const accomp = node.querySelector('.accomp');
    if (age === null || age >= 18) { box.classList.remove('show'); return; }
    box.classList.add('show');
    const under16 = age < 16;
    accomp.classList.toggle('show', under16);
    node.querySelector('.minor-text').innerHTML = under16
      ? `<b>Moins de 16 ans (${age} ans le 21 novembre)</b> : autorisation parentale obligatoire <b>et</b> présence d'un adulte accompagnateur sur place pendant toute la durée de présence du joueur.`
      : `<b>Joueur mineur (${age} ans le 21 novembre)</b> : l'autorisation parentale remplie et signée est obligatoire et doit être présentée à l'accueil le jour J.`;
  }

  function collect() {
    const players = [...document.querySelectorAll('#players .player')].map((node) => {
      const p = {};
      node.querySelectorAll('[data-f]').forEach((i) => (p[i.dataset.f] = i.type === 'checkbox' ? i.checked : i.value.trim()));
      const age = ageAt(p.naissance);
      if (age !== null && age < 16) {
        p.accompagnateur = {};
        node.querySelectorAll('[data-a]').forEach((i) => (p.accompagnateur[i.dataset.a] = i.value.trim()));
      }
      return p;
    });
    return {competition: current, teamName: $('#teamName').value.trim(), players,
      reglement: $('#reglement').checked, rgpd: $('#rgpd').checked};
  }

  $('#form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!current) return;
    const btn = $('#submit');
    btn.disabled = true; btn.textContent = 'Un instant…';
    $('#errors').innerHTML = '';
    try {
      const res = await fetch('/api/inscription', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(collect())});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      location.href = data.url;
    } catch (err) {
      const div = document.createElement('div');
      div.className = 'alert err';
      div.textContent = err.message;
      $('#errors').appendChild(div);
      btn.disabled = false; btn.textContent = 'Payer et valider';
    }
  });

  (async function init() {
    if (params.get('annule')) banner("Paiement annulé : ton inscription n'a pas été enregistrée. Tu peux recommencer ci-dessous.", 'err');
    try {
      st = await (await fetch('/api/status', {cache: 'no-store'})).json();
    } catch {
      banner('Impossible de charger les inscriptions pour le moment. Réessaie dans quelques instants.', 'err');
      $('#form').classList.add('hide');
      return;
    }
    $('#bestof-left').textContent = st.bestOfRemaining;
    const now = Date.now();
    if (now < new Date(st.openAt).getTime()) {
      banner(`Les inscriptions ouvrent le <b>${new Date(st.openAt).toLocaleDateString('fr-FR', {weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Indian/Reunion'})}</b>. Reviens vite !`);
      $('#form').classList.add('hide');
      return;
    }
    if (!st.open) { banner('Les inscriptions sont closes. Merci et rendez-vous les 21 & 22 novembre !'); $('#form').classList.add('hide'); return; }
    if (!st.paymentAvailable) banner("Le paiement en ligne n'est pas encore disponible : le formulaire sera activé très bientôt.", 'err');
    renderPicker();
  })();
})();
