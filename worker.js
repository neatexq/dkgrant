/**
 * Cloudflare Worker — dkgrant-form
 *
 * Захист:
 *  1. Перевірка Origin/Referer — тільки ваш домен
 *  2. Секретний токен X-Site-Token
 *  3. Rate-limit 1 заявка / 5 хв / IP (KV)
 *  4. Бан по IP — назавжди або тимчасово (KV)
 *  5. Автобан — 3 невалідні заявки з одного IP → бан на 24 години
 *  6. Honeypot + Timing
 *  7. Повна валідація полів
 *
 * Управління банами через секретні URL:
 *   POST /admin/ban     { "ip": "1.2.3.4", "reason": "spam", "ttl": 86400 }
 *   POST /admin/unban   { "ip": "1.2.3.4" }
 *   GET  /admin/banlist
 *   Заголовок: X-Admin-Token: <ADMIN_TOKEN із Secrets>
 */

// ── Налаштування ─────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://dkgrant.site',
  'https://www.dkgrant.site',
  // 'http://localhost:5500',
];

// Секрети задаються через wrangler secret put або Cloudflare Dashboard
// SITE_TOKEN  — той самий що у main.js
// ADMIN_TOKEN — тільки для /admin/* маршрутів (інший рядок!)
// TG_BOT_TOKEN, TG_CHAT_ID

const RATE_LIMIT_SEC    = 5 * 60;   // 5 хвилин між заявками
const BAD_ATTEMPTS_MAX  = 3;         // скільки поганих спроб до автобану
const AUTO_BAN_SEC      = 24 * 3600; // автобан на 24 години

// ── Helpers ──────────────────────────────────────────────────
function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Site-Token',
    'Vary': 'Origin',
  };
}

function jsonResp(data, status, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function esc(s) {
  return String(s).replace(/[_*[\]()~`>#+=|{}.!\\-]/g, '\\$&');
}

// ── Лічильник поганих спроб → автобан ───────────────────────
async function recordBadAttempt(kv, ip) {
  if (!kv) return;
  const key     = `bad:${ip}`;
  const current = parseInt(await kv.get(key) || '0', 10) + 1;
  if (current >= BAD_ATTEMPTS_MAX) {
    // Автобан
    await kv.put(`ban:${ip}`, JSON.stringify({
      reason:   'auto: too many invalid attempts',
      bannedAt: new Date().toISOString(),
      auto:     true,
    }), { expirationTtl: AUTO_BAN_SEC });
    await kv.delete(key);
    console.warn(`Auto-banned IP: ${ip}`);
  } else {
    await kv.put(key, String(current), { expirationTtl: RATE_LIMIT_SEC * 2 });
  }
}

// ── Admin маршрути ───────────────────────────────────────────
async function handleAdmin(url, request, env) {
  // Перевірка адмін-токену
  const adminToken = request.headers.get('X-Admin-Token') || '';
  if (!env.ADMIN_TOKEN || adminToken !== env.ADMIN_TOKEN) {
    await new Promise(r => setTimeout(r, 500)); // затримка від брутфорсу
    return jsonResp({ ok: false, error: 'Unauthorized' }, 401);
  }

  const kv = env.RATE_KV;
  if (!kv) return jsonResp({ ok: false, error: 'KV not configured' }, 500);

  // GET /admin/banlist — список забанених IP
  if (request.method === 'GET' && url.pathname === '/admin/banlist') {
    const list = await kv.list({ prefix: 'ban:' });
    const bans = await Promise.all(
      list.keys.map(async k => {
        const val = await kv.get(k.name);
        return { ip: k.name.replace('ban:', ''), ...JSON.parse(val || '{}') };
      })
    );
    return jsonResp({ ok: true, bans }, 200);
  }

  // POST /admin/ban — забанити IP
  if (request.method === 'POST' && url.pathname === '/admin/ban') {
    const body = await request.json();
    const { ip, reason = 'manual ban', ttl } = body;
    if (!ip) return jsonResp({ ok: false, error: 'ip required' }, 400);
    const opts = ttl ? { expirationTtl: Number(ttl) } : {};
    await kv.put(`ban:${ip}`, JSON.stringify({
      reason,
      bannedAt: new Date().toISOString(),
      auto:     false,
      ttl:      ttl || 'permanent',
    }), opts);
    return jsonResp({ ok: true, message: `IP ${ip} banned` }, 200);
  }

  // POST /admin/unban — розбанити IP
  if (request.method === 'POST' && url.pathname === '/admin/unban') {
    const body = await request.json();
    const { ip } = body;
    if (!ip) return jsonResp({ ok: false, error: 'ip required' }, 400);
    await kv.delete(`ban:${ip}`);
    await kv.delete(`bad:${ip}`);
    return jsonResp({ ok: true, message: `IP ${ip} unbanned` }, 200);
  }

  return jsonResp({ ok: false, error: 'Not found' }, 404);
}

// ── Головний обробник ────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url     = new URL(request.url);
    const origin  = request.headers.get('Origin') || '';
    const referer = request.headers.get('Referer') || '';
    const ip      = request.headers.get('CF-Connecting-IP') || 'unknown';

    // Admin маршрути
    if (url.pathname.startsWith('/admin/')) {
      return handleAdmin(url, request, env);
    }

    // Preflight
    if (request.method === 'OPTIONS') {
      if (!ALLOWED_ORIGINS.includes(origin)) {
        return new Response('Forbidden', { status: 403 });
      }
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== 'POST' || url.pathname !== '/order') {
      return new Response('Not found', { status: 404 });
    }

    // ── 1. Перевірка Origin ──────────────────────────────────
    const originOk  = ALLOWED_ORIGINS.includes(origin);
    const refererOk = !origin && ALLOWED_ORIGINS.some(o => referer.startsWith(o));
    if (!originOk && !refererOk) {
      return jsonResp({ ok: false, error: 'Forbidden origin' }, 403);
    }
    const allowedOrigin = originOk ? origin : ALLOWED_ORIGINS[0];

    // ── 2. Секретний токен ───────────────────────────────────
    const token = request.headers.get('X-Site-Token') || '';
    if (env.SITE_TOKEN && token !== env.SITE_TOKEN) {
      await new Promise(r => setTimeout(r, 300));
      return jsonResp({ ok: false, error: 'Forbidden' }, 403, corsHeaders(allowedOrigin));
    }

    // ── 3. Перевірка бану по IP ──────────────────────────────
    if (env.RATE_KV) {
      const banData = await env.RATE_KV.get(`ban:${ip}`);
      if (banData) {
        const ban = JSON.parse(banData);
        console.warn(`Banned IP tried: ${ip}, reason: ${ban.reason}`);
        // Тихо повертаємо "успіх" — забанений не знає що заблокований
        return jsonResp({ ok: true }, 200, corsHeaders(allowedOrigin));
      }
    }

    // ── 4. Парсинг тіла ──────────────────────────────────────
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResp({ ok: false, error: 'Bad JSON' }, 400, corsHeaders(allowedOrigin));
    }

    // ── 5. Honeypot ──────────────────────────────────────────
    if (body.website && body.website.trim() !== '') {
      await recordBadAttempt(env.RATE_KV, ip);
      return jsonResp({ ok: true }, 200, corsHeaders(allowedOrigin));
    }

    // ── 6. Timing ────────────────────────────────────────────
    const elapsed = typeof body._elapsed === 'number' ? body._elapsed : 99999;
    if (elapsed < 3000) {
      await recordBadAttempt(env.RATE_KV, ip);
      return jsonResp({ ok: true }, 200, corsHeaders(allowedOrigin));
    }

    // ── 7. Rate-limit по IP ──────────────────────────────────
    if (env.RATE_KV) {
      const rlKey = `rl:${ip}`;
      const last  = await env.RATE_KV.get(rlKey);
      if (last) {
        return jsonResp({ ok: false, error: 'rate_limit' }, 429, corsHeaders(allowedOrigin));
      }
      await env.RATE_KV.put(rlKey, '1', { expirationTtl: RATE_LIMIT_SEC });
    }

    // ── 8. Валідація полів ───────────────────────────────────
    const { from, to, cargo, phone, comment = '', date = '' } = body;

    const validationErrors = [];

    if (!from || from.trim().length < 3 || /^[\d\s]+$/.test(from.trim())) {
      validationErrors.push('Invalid from address');
    }
    if (!to || to.trim().length < 3 || /^[\d\s]+$/.test(to.trim())) {
      validationErrors.push('Invalid to address');
    }

    const validCargo = ['glass', 'mirrors', 'windows', 'aluminum', 'structures', 'other'];
    if (!cargo || !validCargo.includes(cargo)) {
      validationErrors.push('Invalid cargo type');
    }

    if (date) {
      const chosen = new Date(date);
      const today  = new Date();
      today.setHours(0, 0, 0, 0);
      if (chosen < today) validationErrors.push('Date in the past');
    }

    const phoneDigits = (phone || '').replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      validationErrors.push('Invalid phone');
    }

    if (comment && comment.trim().length > 0 && comment.trim().length < 5) {
      validationErrors.push('Comment too short');
    }

    if (validationErrors.length > 0) {
      // Рахуємо погані спроби — якщо багато, автобан
      await recordBadAttempt(env.RATE_KV, ip);
      return jsonResp({ ok: false, error: validationErrors[0] }, 422, corsHeaders(allowedOrigin));
    }

    // ── 9. Відправка в Telegram ──────────────────────────────
    const tgToken  = env.TG_BOT_TOKEN;
    const tgChatId = env.TG_CHAT_ID;

    if (!tgToken || !tgChatId) {
      console.error('TG_BOT_TOKEN or TG_CHAT_ID not set');
      return jsonResp({ ok: false, error: 'Server misconfigured' }, 500, corsHeaders(allowedOrigin));
    }

    const text = [
      `📦 *Нова заявка з сайту ДК ГРАНТ*`,
      ``,
      `📍 *Звідки:* ${esc(from)}`,
      `📍 *Куди:* ${esc(to)}`,
      `🚚 *Вантаж:* ${esc(cargo)}`,
      `📅 *Дата:* ${esc(date || '—')}`,
      `📞 *Телефон:* ${esc(phone)}`,
      comment ? `💬 *Коментар:* ${esc(comment)}` : null,
      ``,
      `🌐 IP: \`${ip}\``,
    ].filter(Boolean).join('\n');

    const tgRes = await fetch(
      `https://api.telegram.org/bot${tgToken}/sendMessage`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ chat_id: tgChatId, text, parse_mode: 'Markdown' }),
      }
    );

    if (!tgRes.ok) {
      const err = await tgRes.text();
      console.error('Telegram error:', err);
      return jsonResp({ ok: false, error: 'Telegram send failed' }, 502, corsHeaders(allowedOrigin));
    }

    return jsonResp({ ok: true }, 200, corsHeaders(allowedOrigin));
  },
};
