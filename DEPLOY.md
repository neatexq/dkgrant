# Інструкція з деплою захисту форми

## Що змінилося

### worker.js (новий файл)
Cloudflare Worker з повним захистом:
- Перевірка **Origin** — дозволяє запити лише з вашого домену
- **X-Site-Token** — секретний заголовок, без якого Worker поверне 403
- **Rate-limit** через KV — 1 заявка / 5 хвилин / IP (навіть якщо бот обійде Origin)
- **Honeypot** — дублюється на рівні Worker
- **Timing** — Worker відкидає `_elapsed < 3000 мс`

### js/main.js (оновлено)
- Додано відправку заголовка `X-Site-Token`
- Додано поле `_elapsed` в тіло запиту для timing-перевірки на Worker

---

## Покрокова інструкція

### 1. Встановіть Wrangler (якщо ще не)
```bash
npm install -g wrangler
wrangler login
```

### 2. Згенеруйте токен
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Скопіюйте результат.

### 3. Вставте токен у два місця
- `worker.js` → рядок `const SITE_TOKEN = '...'`
- `js/main.js` → рядок `const SITE_TOKEN = '...'`

### 4. Впишіть ваш домен у worker.js
```js
const ALLOWED_ORIGINS = [
  'https://ВАШ-ДОМЕН.ua',
  'https://www.ВАШ-ДОМЕН.ua',
];
```

### 5. Створіть KV namespace для rate-limit
```bash
wrangler kv:namespace create RATE_KV
```
Вставте отриманий `id` в `wrangler.toml`.

### 6. Встановіть секрети через Wrangler
```bash
wrangler secret put TG_BOT_TOKEN
# вводите токен бота

wrangler secret put TG_CHAT_ID
# вводите chat_id
```

### 7. Задеплойте Worker
```bash
wrangler deploy
```

### 8. Перевірте
Відкрийте ваш сайт і відправте тестову заявку.
Потім спробуйте з Postman або curl — має повернути 403:
```bash
curl -X POST https://dkgrant-form.derevyankomisha2012.workers.dev/order \
  -H "Content-Type: application/json" \
  -d '{"from":"test","to":"test","cargo":"glass","phone":"123"}'
# → {"ok":false,"error":"Forbidden origin"}
```

---

## Рівні захисту (пояснення)

| Захист | Де | Що блокує |
|---|---|---|
| Honeypot | Фронтенд + Worker | Прості боти що заповнюють всі поля |
| Timing < 3с | Фронтенд + Worker | Автоматизовані скрипти |
| Cooldown 5 хв | Фронтенд (localStorage) | Повторні кліки від реальних людей |
| Origin/Referer | **Worker** | Сторонні сайти з тим самим Worker URL |
| X-Site-Token | **Worker** | Прямі curl/скрипти без токену |
| Rate-limit IP | **Worker KV** | Масовий спам навіть якщо обійдено інші захисти |

> **Чому токен у JS не є проблемою?**
> Токен видно у вихідному коді — але атака з іншого сайту все одно
> блокується **перевіркою Origin на Worker**. Origin надсилає браузер
> автоматично і підробити його неможливо (це не заголовок що задає JS).
> Токен — додатковий бар'єр для curl-скриптів що не знають його.
