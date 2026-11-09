// Envoi d'e-mails par SMTP (Hostinger : smtp.hostinger.com, port 465, TLS) sans dépendance externe.
'use strict';

const tls = require('tls');
const crypto = require('crypto');

module.exports = function mailer({host, port, user, pass, fromName}) {
  const enabled = Boolean(host && user && pass);
  const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
  const wrap = (s) => s.replace(/.{1,76}/g, '$&\r\n');
  const encHeader = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);

  // Petite session SMTP sur TLS (port 465) : on attend chaque réponse complète avant la commande suivante
  function connect() {
    return new Promise((resolve, reject) => {
      const socket = tls.connect({host, port, servername: host}, () => resolve(socket));
      socket.once('error', reject);
      socket.setTimeout(20000, () => socket.destroy(new Error('SMTP : délai dépassé')));
    });
  }
  function session(socket) {
    let buf = '', pending = null, failure = null;
    socket.setEncoding('utf8');
    const check = () => {
      if (!pending) return;
      if (failure) { const p = pending; pending = null; return p.reject(failure); }
      let pos = 0;
      while (true) {
        const nl = buf.indexOf('\r\n', pos);
        if (nl < 0) return;
        const line = buf.slice(pos, nl);
        pos = nl + 2;
        if (/^\d{3}( |$)/.test(line)) { const res = buf.slice(0, pos); buf = buf.slice(pos); const p = pending; pending = null; return p.resolve(res); }
      }
    };
    socket.on('data', (d) => { buf += d; check(); });
    socket.on('error', (e) => { failure = e; check(); });
    socket.on('close', () => { failure = failure || new Error('SMTP : connexion fermée'); check(); });
    async function cmd(line, expect) {
      const p = new Promise((resolve, reject) => { pending = {resolve, reject}; });
      if (line !== null) socket.write(line + '\r\n');
      check();
      const res = await p;
      const last = res.trim().split('\r\n').pop();
      if (!expect.includes(Number(last.slice(0, 3)))) throw new Error(`SMTP ${line ? line.split(/[ :]/)[0] : 'connexion'} : ${last}`);
      return res;
    }
    return {cmd};
  }

  async function send({to, subject, html, text}) {
    if (!enabled) return {skipped: true};
    const rcpts = [...new Set([].concat(to).filter(Boolean).map((x) => String(x).trim().toLowerCase()))];
    if (!rcpts.length) return {skipped: true};
    const socket = await connect();
    const s = session(socket);
    try {
      await s.cmd(null, [220]);
      await s.cmd('EHLO ragelan.rushxp.re', [250]);
      await s.cmd('AUTH LOGIN', [334]);
      await s.cmd(b64(user), [334]);
      await s.cmd(b64(pass), [235]);
      await s.cmd(`MAIL FROM:<${user}>`, [250]);
      for (const r of rcpts) await s.cmd(`RCPT TO:<${r}>`, [250, 251]);
      await s.cmd('DATA', [354]);
      const boundary = 'rl' + crypto.randomBytes(8).toString('hex');
      const msg = [
        `From: ${encHeader(fromName)} <${user}>`,
        `To: ${rcpts.join(', ')}`,
        `Reply-To: ${user}`,
        `Subject: ${encHeader(subject)}`,
        `Date: ${new Date().toUTCString()}`,
        `Message-ID: <${crypto.randomUUID()}@${user.split('@')[1]}>`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        '',
        `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap(b64(text)),
        `--${boundary}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap(b64(html)),
        `--${boundary}--`, '',
      ].join('\r\n');
      await s.cmd(msg + '\r\n.', [250]);
      await s.cmd('QUIT', [221]).catch(() => {});
      return {sent: rcpts.length};
    } finally {
      socket.end();
    }
  }

  return {enabled, send};
};
