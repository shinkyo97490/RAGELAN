// Serveur du site RAGE LAN 2026 — Node.js 18+, aucune dépendance externe.
// Inscriptions stockées dans data/inscriptions.json, paiement via Stripe Checkout.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---------- Configuration (variables d'environnement) ----------
const PORT = Number(process.env.PORT || 3000);
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
// Paiement simulé pour tester en local, uniquement sans clé Stripe
const MOCK_PAYMENT = !STRIPE_SECRET_KEY && process.env.MOCK_PAYMENT === '1';
// Heure de La Réunion = UTC+4
const OPEN_AT = new Date(process.env.OPEN_AT || '2026-11-09T00:00:00+04:00');
const CLOSE_AT = new Date(process.env.CLOSE_AT || '2026-11-19T00:00:00+04:00'); // 18 nov. à minuit
const EVENT_DATE = new Date('2026-11-21T13:00:00+04:00');
const HOLD_MINUTES = 30; // durée de réservation d'une place pendant le paiement (minimum Stripe)
const BEST_OF_TOTAL = 30;

const COMPETITIONS = {
  valorant: {name: 'Valorant', team: true, size: 5, capacity: 8, unit: 'équipes', price: 25},
  rocketleague: {name: 'Rocket League', team: true, size: 3, capacity: 8, unit: 'équipes', price: 20},
  fc27: {name: 'EA Sports FC 27 FUT', team: false, size: 1, capacity: 24, unit: 'joueurs', price: 20},
  libres: {name: 'Joueurs libres', team: false, size: 1, capacity: 40, unit: 'places', price: 20},
};

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
// Sur Hostinger, placer les données hors du dossier de l'application pour qu'un redéploiement ne les efface pas
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const DB_FILE = path.join(DATA_DIR, 'inscriptions.json');
const STREAM_FILE = path.join(DATA_DIR, 'stream.json');
const LOGO_DIR = path.join(DATA_DIR, 'logos');

// ---------- Logos d'équipe (Valorant, Rocket League) ----------
const LOGO_MAX = 2 * 1024 * 1024;
const LOGO_TYPES = {png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp'};
// Décode une image envoyée en data URL et vérifie qu'il s'agit vraiment d'un PNG, JPEG ou WebP
function parseLogo(v) {
  if (typeof v !== 'string') return null;
  const m = v.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return null;
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length || buf.length > LOGO_MAX) return null;
  const ext = buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? 'png'
    : buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff ? 'jpg'
      : buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP' ? 'webp' : null;
  return ext ? {ext, buf} : null;
}
function saveLogo(id, logo) {
  fs.mkdirSync(LOGO_DIR, {recursive: true});
  for (const e of Object.keys(LOGO_TYPES)) fs.rmSync(path.join(LOGO_DIR, `${id}.${e}`), {force: true});
  const name = `${id}.${logo.ext}`;
  fs.writeFileSync(path.join(LOGO_DIR, name), logo.buf);
  return name;
}
// Logo d'une équipe payée, retrouvée par son nom, pour l'habillage Twitch
function teamLogoUrl(game, teamName) {
  const n = String(teamName || '').trim().toLowerCase();
  const r = n && loadDb().find((x) => x.competition === game && x.status === 'paid' && x.logo && x.teamName.toLowerCase() === n);
  return r ? `/api/logo/${r.id}` : '';
}

// État de l'habillage Twitch (piloté depuis /stream/controle.html)
const STREAM_DEFAULT = {
  scene: 'match', game: 'valorant', phase: 'Phase de groupes', bo: 3, bugPos: 'top',
  teamA: 'Équipe A', teamB: 'Équipe B', scoreA: 0, scoreB: 0,
  message: 'Bienvenue à la RAGE LAN 2026 !', countdown: '', next: [],
};
function loadStream() {
  try { return {...STREAM_DEFAULT, ...JSON.parse(fs.readFileSync(STREAM_FILE, 'utf8'))}; } catch { return {...STREAM_DEFAULT}; }
}
function saveStream(st) {
  fs.mkdirSync(DATA_DIR, {recursive: true});
  fs.writeFileSync(STREAM_FILE, JSON.stringify(st, null, 2));
}
function cleanStream(b) {
  const st = loadStream();
  const txt = (v, n) => (typeof v === 'string' ? v.slice(0, n) : undefined);
  const num = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : undefined);
  const upd = {
    scene: ['match', 'starting', 'pause', 'end'].includes(b.scene) ? b.scene : undefined,
    game: ['valorant', 'rocketleague', 'fc27', 'libres'].includes(b.game) ? b.game : undefined,
    bugPos: ['top', 'bottom', 'hidden'].includes(b.bugPos) ? b.bugPos : undefined,
    phase: txt(b.phase, 40), bo: num(b.bo, 9), teamA: txt(b.teamA, 30), teamB: txt(b.teamB, 30),
    scoreA: num(b.scoreA, 9), scoreB: num(b.scoreB, 9), message: txt(b.message, 140),
    countdown: typeof b.countdown === 'string' && (b.countdown === '' || !isNaN(Date.parse(b.countdown))) ? b.countdown : undefined,
    next: Array.isArray(b.next) ? b.next.slice(0, 5).map((x) => String(x).slice(0, 80)) : undefined,
  };
  for (const [k, v] of Object.entries(upd)) if (v !== undefined) st[k] = v;
  return st;
}

// ---------- Stockage ----------
function loadDb() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { return []; }
}
function saveDb(db) {
  fs.mkdirSync(DATA_DIR, {recursive: true});
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

// Une inscription « pending » ne bloque une place que pendant la durée de réservation
function isActive(r, now = Date.now()) {
  return r.status === 'paid' || (r.status === 'pending' && new Date(r.expiresAt).getTime() > now);
}
function usedUnits(db, comp) {
  return db.filter((r) => r.competition === comp && isActive(r))
    .reduce((n, r) => n + (COMPETITIONS[comp].team ? 1 : r.players.length), 0);
}
function bestOfGiven(db) {
  return db.filter((r) => r.status === 'paid').reduce((n, r) => n + r.players.filter((p) => p.bestOf).length, 0);
}

function status() {
  const db = loadDb();
  const now = Date.now();
  const competitions = {};
  for (const [id, c] of Object.entries(COMPETITIONS)) {
    competitions[id] = {name: c.name, capacity: c.capacity, unit: c.unit, price: c.price, size: c.size, team: c.team,
      remaining: Math.max(0, c.capacity - usedUnits(db, id))};
  }
  return {
    open: now >= OPEN_AT.getTime() && now < CLOSE_AT.getTime(),
    openAt: OPEN_AT.toISOString(), closeAt: CLOSE_AT.toISOString(), eventAt: EVENT_DATE.toISOString(),
    bestOfRemaining: Math.max(0, BEST_OF_TOTAL - bestOfGiven(db)),
    paymentAvailable: Boolean(STRIPE_SECRET_KEY) || MOCK_PAYMENT,
    competitions,
  };
}

// ---------- Validation ----------
function ageAt(birth, ref) {
  let a = ref.getUTCFullYear() - birth.getUTCFullYear();
  const m = ref.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && ref.getUTCDate() < birth.getUTCDate())) a--;
  return a;
}
const str = (v, max = 80) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s.-]{5,19}$/;

function validate(body) {
  const errors = [];
  const comp = COMPETITIONS[body.competition];
  if (!comp) return {errors: ['Compétition inconnue.']};
  const teamName = comp.team ? str(body.teamName, 40) : '';
  if (comp.team && teamName.length < 2) errors.push("Indique le nom de l'équipe.");
  if (!Array.isArray(body.players) || body.players.length !== comp.size) {
    errors.push(comp.team ? `Il faut exactement ${comp.size} joueurs (pas de remplaçant).` : 'Un seul joueur par inscription.');
    return {errors};
  }
  const players = body.players.map((p, i) => {
    const label = comp.team ? `Joueur ${i + 1}` : 'Joueur';
    const out = {
      pseudo: str(p.pseudo, 40), ingame: str(p.ingame, 60), prenom: str(p.prenom, 50), nom: str(p.nom, 50),
      email: str(p.email, 120).toLowerCase(), tel: str(p.tel, 20), naissance: str(p.naissance, 10),
    };
    if (!out.pseudo) errors.push(`${label} : pseudo manquant.`);
    if (!out.ingame) errors.push(`${label} : identifiant en jeu manquant.`);
    if (!out.prenom || !out.nom) errors.push(`${label} : prénom et nom obligatoires.`);
    const needContact = i === 0; // capitaine ou joueur solo
    if ((needContact || out.email) && !EMAIL_RE.test(out.email)) errors.push(`${label} : e-mail invalide.`);
    if ((needContact || out.tel) && !PHONE_RE.test(out.tel)) errors.push(`${label} : téléphone invalide.`);
    const birth = new Date(out.naissance + 'T00:00:00Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(out.naissance) || isNaN(birth)) {
      errors.push(`${label} : date de naissance invalide.`);
    } else {
      out.age = ageAt(birth, EVENT_DATE);
      if (out.age < 5 || out.age > 100) errors.push(`${label} : date de naissance invalide.`);
      out.mineur = out.age < 18;
      out.moins16 = out.age < 16;
      if (out.mineur && p.autorisationOk !== true) errors.push(`${label} : un mineur doit s'engager à fournir l'autorisation parentale signée.`);
      if (out.moins16) {
        const a = p.accompagnateur || {};
        out.accompagnateur = {nom: str(a.nom, 80), lien: str(a.lien, 40), tel: str(a.tel, 20)};
        if (!out.accompagnateur.nom || !out.accompagnateur.lien || !PHONE_RE.test(out.accompagnateur.tel)) {
          errors.push(`${label} : moins de 16 ans, l'adulte accompagnateur (nom, lien, téléphone) est obligatoire.`);
        }
      }
    }
    out.autorisationRecue = false;
    return out;
  });
  const logo = comp.team ? parseLogo(body.logo) : null;
  if (comp.team && !logo) errors.push("Ajoute le logo de l'équipe (PNG, JPG ou WebP, 2 Mo maximum).");
  if (body.reglement !== true) errors.push('Tu dois accepter le règlement.');
  if (body.rgpd !== true) errors.push('Tu dois accepter la politique de confidentialité.');
  return {errors, comp, teamName, players, logo};
}

// ---------- Stripe ----------
function formEncode(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v !== null && typeof v === 'object') formEncode(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out.join('&');
}

async function createCheckout(reg) {
  const comp = COMPETITIONS[reg.competition];
  const params = {
    mode: 'payment',
    customer_email: reg.players[0].email,
    client_reference_id: reg.id,
    expires_at: Math.floor(new Date(reg.expiresAt).getTime() / 1000),
    success_url: `${BASE_URL}/merci.html?id=${reg.id}`,
    cancel_url: `${BASE_URL}/inscription.html?c=${reg.competition}&annule=1`,
    metadata: {registration_id: reg.id, competition: reg.competition},
    line_items: {0: {
      quantity: reg.players.length,
      price_data: {currency: 'eur', unit_amount: comp.price * 100,
        product_data: {name: `RAGE LAN 2026 — ${comp.name}${reg.teamName ? ` (équipe ${reg.teamName})` : ''}`}},
    }},
  };
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {Authorization: `Bearer ${STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded'},
    body: formEncode(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Erreur Stripe');
  return data;
}

function verifyStripeSignature(raw, header) {
  if (!STRIPE_WEBHOOK_SECRET || !header) return false;
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=')));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = crypto.createHmac('sha256', STRIPE_WEBHOOK_SECRET).update(`${t}.${raw}`).digest('hex');
  const sigs = header.split(',').filter((kv) => kv.startsWith('v1=')).map((kv) => kv.slice(3));
  return sigs.some((s) => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}

// Confirme une inscription payée et attribue les Menus Best Of dans l'ordre des paiements
function markPaid(id, info = {}) {
  const db = loadDb();
  const reg = db.find((r) => r.id === id);
  if (!reg || reg.status === 'paid') return reg;
  reg.status = 'paid';
  reg.paidAt = new Date().toISOString();
  Object.assign(reg, info);
  let left = BEST_OF_TOTAL - bestOfGiven(db);
  for (const p of reg.players) { p.bestOf = left > 0; if (left > 0) left--; }
  saveDb(db);
  return reg;
}

// ---------- HTTP ----------
const MIME = {'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.pdf': 'application/pdf',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8'};

function send(res, code, body, headers = {}) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(code, {'Content-Type': isObj ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff', ...headers});
  res.end(isObj ? JSON.stringify(body) : body);
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const hits = new Map(); // limite simple : 20 tentatives d'inscription par heure et par IP
function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 3600e3);
  list.push(now); hits.set(ip, list);
  return list.length > 20;
}

function isAdmin(req) {
  const given = String(req.headers['x-admin-password'] || '');
  if (!ADMIN_PASSWORD || !given) return false;
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

function csv(db) {
  const head = ['id', 'date', 'statut', 'competition', 'equipe', 'montant', 'joueur', 'pseudo', 'id_en_jeu', 'prenom', 'nom', 'email', 'telephone',
    'naissance', 'age', 'mineur', 'moins_16', 'accompagnateur', 'tel_accompagnateur', 'autorisation_recue', 'menu_best_of', 'logo'];
  // Neutralise les formules (=, +, -, @) qu'Excel exécuterait, sauf les numéros de téléphone
  const esc = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@]/.test(s) && !/^\+?\d[\d\s.-]*$/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const rows = [head.join(';')];
  for (const r of db) r.players.forEach((p, i) => rows.push([r.id, r.createdAt, r.status, COMPETITIONS[r.competition].name, r.teamName, r.amount,
    i + 1, p.pseudo, p.ingame, p.prenom, p.nom, p.email, p.tel, p.naissance, p.age, p.mineur ? 'oui' : 'non', p.moins16 ? 'oui' : 'non',
    p.accompagnateur ? `${p.accompagnateur.nom} (${p.accompagnateur.lien})` : '', p.accompagnateur?.tel, p.autorisationRecue ? 'oui' : 'non',
    p.bestOf ? 'oui' : 'non', r.logo && i === 0 ? `${BASE_URL}/api/logo/${r.id}` : ''].map(esc).join(';')));
  return '﻿' + rows.join('\n');
}

async function api(req, res, url) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;

  if (req.method === 'GET' && url.pathname === '/api/status') return send(res, 200, status());

  if (req.method === 'POST' && url.pathname === '/api/inscription') {
    if (rateLimited(ip)) return send(res, 429, {error: 'Trop de tentatives, réessaie plus tard.'});
    const st = status();
    if (!st.open) return send(res, 403, {error: Date.now() < OPEN_AT ? 'Les inscriptions ne sont pas encore ouvertes.' : 'Les inscriptions sont closes.'});
    if (!st.paymentAvailable) return send(res, 503, {error: "Le paiement en ligne n'est pas encore configuré. Réessaie plus tard."});
    let body;
    try { body = JSON.parse(await readBody(req, 3 * 1024 * 1024)); } catch { return send(res, 400, {error: 'Requête invalide ou logo trop lourd (2 Mo maximum).'}); }
    const v = validate(body);
    if (v.errors.length) return send(res, 400, {error: v.errors.join(' ')});
    const db = loadDb();
    if (v.comp.capacity - usedUnits(db, body.competition) < 1) return send(res, 409, {error: `${v.comp.name} est complet.`});
    if (v.comp.team && db.some((r) => r.competition === body.competition && isActive(r) && r.teamName.toLowerCase() === v.teamName.toLowerCase())) {
      return send(res, 409, {error: "Ce nom d'équipe est déjà pris."});
    }
    const now = new Date();
    const reg = {
      id: crypto.randomUUID(), createdAt: now.toISOString(), status: 'pending',
      expiresAt: new Date(now.getTime() + HOLD_MINUTES * 60e3).toISOString(),
      competition: body.competition, teamName: v.teamName, players: v.players, amount: v.comp.price * v.players.length,
    };
    if (v.logo) reg.logo = saveLogo(reg.id, v.logo);
    db.push(reg); saveDb(db);
    if (MOCK_PAYMENT) {
      markPaid(reg.id, {payment: 'simulé'});
      return send(res, 200, {url: `/merci.html?id=${reg.id}`});
    }
    try {
      const session = await createCheckout(reg);
      const db2 = loadDb(); const r2 = db2.find((r) => r.id === reg.id); r2.stripeSession = session.id; saveDb(db2);
      return send(res, 200, {url: session.url});
    } catch (e) {
      const db2 = loadDb(); const r2 = db2.find((r) => r.id === reg.id); r2.status = 'cancelled'; saveDb(db2);
      console.error('Stripe :', e.message);
      return send(res, 502, {error: 'Le paiement n\'a pas pu être lancé. Réessaie dans quelques minutes.'});
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/stripe/webhook') {
    const raw = await readBody(req, 512 * 1024);
    if (!verifyStripeSignature(raw, req.headers['stripe-signature'])) return send(res, 400, {error: 'Signature invalide'});
    const event = JSON.parse(raw);
    const s = event.data?.object || {};
    const id = s.metadata?.registration_id || s.client_reference_id;
    if (event.type === 'checkout.session.completed' && s.payment_status === 'paid' && id) {
      markPaid(id, {stripeSession: s.id, payment: 'stripe', amountPaid: s.amount_total / 100});
    } else if (event.type === 'checkout.session.expired' && id) {
      const db = loadDb(); const r = db.find((x) => x.id === id);
      if (r && r.status === 'pending') { r.status = 'expired'; saveDb(db); }
    }
    return send(res, 200, {received: true});
  }

  if (req.method === 'GET' && url.pathname === '/api/stream') {
    const st = loadStream();
    return send(res, 200, {...st, logoA: teamLogoUrl(st.game, st.teamA), logoB: teamLogoUrl(st.game, st.teamB)}, {'Cache-Control': 'no-store'});
  }

  const lm = url.pathname.match(/^\/api\/logo\/([0-9a-f-]{36})$/);
  if (req.method === 'GET' && lm) {
    const r = loadDb().find((x) => x.id === lm[1]);
    const file = r?.logo && path.join(LOGO_DIR, path.basename(r.logo));
    if (!file || !fs.existsSync(file)) return send(res, 404, {error: 'Logo introuvable.'});
    res.writeHead(200, {'Content-Type': LOGO_TYPES[path.extname(file).slice(1)], 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'", 'Cache-Control': 'no-cache'});
    return fs.createReadStream(file).pipe(res);
  }

  const m = url.pathname.match(/^\/api\/inscription\/([0-9a-f-]{36})$/);
  if (req.method === 'GET' && m) {
    const r = loadDb().find((x) => x.id === m[1]);
    if (!r) return send(res, 404, {error: 'Inscription introuvable.'});
    return send(res, 200, {status: isActive(r) ? r.status : (r.status === 'pending' ? 'expired' : r.status),
      competition: COMPETITIONS[r.competition].name, teamName: r.teamName, amount: r.amount,
      players: r.players.map((p) => ({pseudo: p.pseudo, mineur: p.mineur, moins16: p.moins16, bestOf: Boolean(p.bestOf)}))});
  }

  if (url.pathname.startsWith('/api/admin/')) {
    if (!isAdmin(req)) return send(res, 401, {error: 'Mot de passe incorrect.'});
    if (req.method === 'GET' && url.pathname === '/api/admin/inscriptions') return send(res, 200, {inscriptions: loadDb(), status: status()});
    if (req.method === 'GET' && url.pathname === '/api/admin/export.csv') {
      return send(res, 200, csv(loadDb()), {'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="inscriptions_rage_lan_2026.csv"'});
    }
    if (req.method === 'GET' && url.pathname === '/api/admin/backup.json') {
      return send(res, 200, JSON.stringify(loadDb(), null, 2), {'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="sauvegarde_rage_lan_${new Date().toISOString().slice(0, 10)}.json"`});
    }
    if (req.method === 'POST' && url.pathname === '/api/admin/stream') {
      let b; try { b = JSON.parse(await readBody(req)); } catch { return send(res, 400, {error: 'Requête invalide.'}); }
      const st = cleanStream(b); saveStream(st);
      return send(res, 200, st);
    }
    if (req.method === 'POST' && url.pathname === '/api/admin/logo') {
      let b; try { b = JSON.parse(await readBody(req, 3 * 1024 * 1024)); } catch { return send(res, 400, {error: 'Logo trop lourd (2 Mo maximum).'}); }
      const db = loadDb(); const r = db.find((x) => x.id === b.id);
      if (!r || !COMPETITIONS[r.competition].team) return send(res, 404, {error: 'Équipe introuvable.'});
      const logo = parseLogo(b.logo);
      if (!logo) return send(res, 400, {error: 'Image invalide : PNG, JPG ou WebP, 2 Mo maximum.'});
      r.logo = saveLogo(r.id, logo); saveDb(db);
      return send(res, 200, {ok: true});
    }
    if (req.method === 'POST' && url.pathname === '/api/admin/update') {
      let b; try { b = JSON.parse(await readBody(req)); } catch { return send(res, 400, {error: 'Requête invalide.'}); }
      const db = loadDb(); const r = db.find((x) => x.id === b.id);
      if (!r) return send(res, 404, {error: 'Introuvable.'});
      if (b.action === 'autorisation' && r.players[b.player]) r.players[b.player].autorisationRecue = Boolean(b.value);
      else if (b.action === 'markPaid') { saveDb(db); markPaid(r.id, {payment: 'manuel'}); return send(res, 200, {ok: true}); }
      else if (b.action === 'cancel') r.status = 'cancelled';
      else return send(res, 400, {error: 'Action inconnue.'});
      saveDb(db);
      return send(res, 200, {ok: true});
    }
  }
  return send(res, 404, {error: 'Introuvable.'});
}

function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, 'Interdit');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      const nf = path.join(PUBLIC, '404.html');
      return fs.existsSync(nf) ? (res.writeHead(404, {'Content-Type': MIME['.html']}), fs.createReadStream(nf).pipe(res)) : send(res, 404, 'Page introuvable');
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': st.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff'});
    fs.createReadStream(file).pipe(res);
  });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) await api(req, res, url);
    else if (req.method === 'GET' || req.method === 'HEAD') serveStatic(req, res, url);
    else send(res, 405, 'Méthode non autorisée');
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, {error: 'Erreur serveur.'});
  }
}).listen(PORT, () => {
  console.log(`RAGE LAN 2026 — http://localhost:${PORT}`);
  if (!STRIPE_SECRET_KEY) console.log(MOCK_PAYMENT ? '⚠️  Paiement SIMULÉ (MOCK_PAYMENT=1) — ne pas utiliser en production.' : '⚠️  STRIPE_SECRET_KEY absent : inscriptions désactivées.');
  if (STRIPE_SECRET_KEY && !STRIPE_WEBHOOK_SECRET) console.log('⚠️  STRIPE_WEBHOOK_SECRET absent : les paiements ne seront pas confirmés.');
  if (!ADMIN_PASSWORD) console.log('⚠️  ADMIN_PASSWORD absent : espace admin désactivé.');
  console.log(`Données : ${DB_FILE}`);
});
