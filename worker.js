/**
 * ДК ГРАНТ — Cloudflare Worker
 * 1) Приймає заявки з форми сайту і шле їх усім підписаним у Telegram
 * 2) Працює як Telegram-бот: пароль для підписки, кнопка "Відписатись"
 *
 * ── НАЛАШТУВАННЯ (Settings → Variables and Secrets) ──────────────────
 *   BOT_TOKEN   (Secret)  — токен бота від @BotFather
 *   ACCESS_CODE (Secret)  — пароль для підписки, напр. kd123grant
 *
 * ── ПРИВ'ЯЗКА KV (Settings → Variables → KV Namespace Bindings) ──────
 *   SUBSCRIBERS — KV namespace (зберігає chat_id підписників)
 *
 * ── ПІСЛЯ ДЕПЛОЮ ──────────────────────────────────────────────────────
 *   1. Відкрити в браузері:
 *      https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=<WORKER_URL>/telegram
 *      (замініть <BOT_TOKEN> і <WORKER_URL> на свої)
 *   2. Готово — бот почне відповідати на /start
 */

const TG_API = (token) => `https://api.telegram.org/bot${token}`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight (для запитів з сайту)
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    // ── Маршрут 1: заявка з сайту ──────────────────────────────
    if (url.pathname === "/" || url.pathname === "/order") {
      return handleOrder(request, env);
    }

    // ── Маршрут 2: вебхук Telegram-бота ────────────────────────
    if (url.pathname === "/telegram") {
      return handleTelegram(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

/* ════════════════════════════════════════════════════════════
   ЗАЯВКА З САЙТУ → РОЗСИЛКА ПІДПИСНИКАМ
   ════════════════════════════════════════════════════════════ */
async function handleOrder(request, env) {
  const headers = { ...corsHeaders(), "Content-Type": "application/json" };

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      status: 405,
      headers,
    });
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Bad JSON" }), {
      status: 400,
      headers,
    });
  }

  // Підпис типу вантажу зрозумілою мовою
  const cargoLabels = {
    apartment: "Квартирний переїзд",
    office: "Офісний переїзд",
    furniture: "Меблі / техніка",
    construction: "Будматеріали",
    other: "Інше",
  };
  const cargoText = cargoLabels[data.cargo] || data.cargo || "—";

  const text =
    `🚚 <b>Нова заявка з сайту ДК ГРАНТ</b>\n\n` +
    `📍 <b>Звідки:</b> ${escapeHtml(data.from) || "—"}\n` +
    `📍 <b>Куди:</b> ${escapeHtml(data.to) || "—"}\n` +
    `📦 <b>Тип вантажу:</b> ${escapeHtml(cargoText)}\n` +
    `📅 <b>Дата:</b> ${escapeHtml(data.date) || "не вказана"}\n` +
    `📞 <b>Телефон:</b> ${escapeHtml(data.phone) || "—"}\n` +
    `💬 <b>Коментар:</b> ${escapeHtml(data.comment) || "—"}`;

  const sent = await broadcast(env, text);

  return new Response(JSON.stringify({ ok: true, sent }), { status: 200, headers });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* Розсилка тексту усім активним підписникам */
async function broadcast(env, text) {
  const subs = await getSubscribers(env);
  let sent = 0;

  for (const chatId of subs) {
    const ok = await sendMessage(env, chatId, text);
    if (ok) sent++;
  }
  return sent;
}

/* ════════════════════════════════════════════════════════════
   TELEGRAM BOT (webhook)
   ════════════════════════════════════════════════════════════ */
async function handleTelegram(request, env) {
  if (request.method !== "POST") {
    return new Response("OK"); // на GET просто відповідаємо, щоб не падало
  }

  let update;
  try {
    update = await request.json();
  } catch {
    return new Response("OK");
  }

  const msg = update.message;
  const cb = update.callback_query;

  // ── Натискання кнопок (callback_query) ─────────────────────
  if (cb) {
    const chatId = cb.message.chat.id;

    if (cb.data === "unsubscribe") {
      await removeSubscriber(env, chatId);
      await answerCallback(env, cb.id, "Сповіщення вимкнено");
      await editOrSend(env, chatId, cb.message.message_id,
        "🔕 Сповіщення про нові заявки <b>вимкнено</b>.\n\nЩоб знову увімкнути — введіть пароль ще раз.");
      return new Response("OK");
    }

    if (cb.data === "subscribe_again") {
      await editOrSend(env, chatId, cb.message.message_id,
        "Введіть пароль доступу, щоб знову отримувати сповіщення.");
      return new Response("OK");
    }

    await answerCallback(env, cb.id, "");
    return new Response("OK");
  }

  if (!msg || !msg.text) {
    return new Response("OK");
  }

  const chatId = msg.chat.id;
  const text = msg.text.trim();

  // ── /start ───────────────────────────────────────────────
  if (text === "/start") {
    const isSub = await isSubscriber(env, chatId);
    if (isSub) {
      await sendMessageWithKeyboard(env, chatId,
        "👋 Вітаю! Ви вже підписані на сповіщення про нові заявки з сайту ДК ГРАНТ.",
        unsubscribeKeyboard());
    } else {
      await sendMessage(env, chatId,
        "👋 Вітаю! Цей бот надсилає сповіщення про нові заявки з сайту ДК ГРАНТ.\n\n" +
        "Введіть <b>пароль доступу</b>, щоб почати отримувати сповіщення.");
    }
    return new Response("OK");
  }

  // ── /stop — вимкнути сповіщення ─────────────────────────────
  if (text === "/stop") {
    await removeSubscriber(env, chatId);
    await sendMessage(env, chatId,
      "🔕 Сповіщення вимкнено. Введіть пароль ще раз, щоб увімкнути знову.");
    return new Response("OK");
  }

  // ── /status ──────────────────────────────────────────────
  if (text === "/status") {
    const isSub = await isSubscriber(env, chatId);
    await sendMessage(env, chatId,
      isSub
        ? "✅ Сповіщення <b>увімкнено</b>. Команда /stop — вимкнути."
        : "❌ Сповіщення <b>вимкнено</b>. Введіть пароль, щоб увімкнути.");
    return new Response("OK");
  }

  // ── Перевірка пароля ─────────────────────────────────────
  if (text === env.ACCESS_CODE) {
    const wasSub = await isSubscriber(env, chatId);
    await addSubscriber(env, chatId);
    await sendMessageWithKeyboard(env, chatId,
      wasSub
        ? "✅ Сповіщення вже були увімкнені."
        : "✅ Готово! Тепер ви будете отримувати сповіщення про нові заявки з сайту ДК ГРАНТ.",
      unsubscribeKeyboard());
    return new Response("OK");
  }

  // ── Будь-яке інше повідомлення ──────────────────────────
  const isSub = await isSubscriber(env, chatId);
  if (isSub) {
    await sendMessage(env, chatId,
      "Команди:\n/status — перевірити стан сповіщень\n/stop — вимкнути сповіщення");
  } else {
    await sendMessage(env, chatId,
      "❌ Невірний пароль. Введіть правильний пароль доступу, щоб отримувати сповіщення про заявки.");
  }
  return new Response("OK");
}

function unsubscribeKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🔕 Вимкнути сповіщення", callback_data: "unsubscribe" }],
    ],
  };
}

/* ════════════════════════════════════════════════════════════
   ЗБЕРІГАННЯ ПІДПИСНИКІВ (Cloudflare KV)
   Ключ: "subscribers" → JSON-масив chat_id
   ════════════════════════════════════════════════════════════ */
async function getSubscribers(env) {
  const raw = await env.SUBSCRIBERS.get("subscribers");
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function addSubscriber(env, chatId) {
  const subs = await getSubscribers(env);
  if (!subs.includes(chatId)) {
    subs.push(chatId);
    await env.SUBSCRIBERS.put("subscribers", JSON.stringify(subs));
  }
}

async function removeSubscriber(env, chatId) {
  const subs = await getSubscribers(env);
  const updated = subs.filter((id) => id !== chatId);
  await env.SUBSCRIBERS.put("subscribers", JSON.stringify(updated));
}

async function isSubscriber(env, chatId) {
  const subs = await getSubscribers(env);
  return subs.includes(chatId);
}

/* ════════════════════════════════════════════════════════════
   TELEGRAM API HELPERS
   ════════════════════════════════════════════════════════════ */
async function sendMessage(env, chatId, text) {
  try {
    const res = await fetch(`${TG_API(env.BOT_TOKEN)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function sendMessageWithKeyboard(env, chatId, text, keyboard) {
  try {
    const res = await fetch(`${TG_API(env.BOT_TOKEN)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        reply_markup: keyboard,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function editOrSend(env, chatId, messageId, text) {
  try {
    const res = await fetch(`${TG_API(env.BOT_TOKEN)}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: "HTML",
      }),
    });
    if (!res.ok) {
      await sendMessage(env, chatId, text);
    }
  } catch {
    await sendMessage(env, chatId, text);
  }
}

async function answerCallback(env, callbackQueryId, text) {
  try {
    await fetch(`${TG_API(env.BOT_TOKEN)}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });
  } catch {
    /* ignore */
  }
}
