/* ============================================================
   ТОВ ДК ГРАНТ — Main JavaScript
   ============================================================ */

/* ── Year ─────────────────────────────────────────────────── */
document.getElementById('year').textContent = new Date().getFullYear();

/* ── Header scroll shadow ─────────────────────────────────── */
const header = document.getElementById('site-header');
window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 30);
}, { passive: true });

/* ── Burger menu ──────────────────────────────────────────── */
const burger    = document.getElementById('burger');
const mobileNav = document.getElementById('mobile-nav');
burger.addEventListener('click', () => {
  mobileNav.classList.toggle('open');
});
mobileNav.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => mobileNav.classList.remove('open'));
});

/* ── Scroll-to-top button ─────────────────────────────────── */
const scrollTopBtn = document.getElementById('scroll-top');
window.addEventListener('scroll', () => {
  scrollTopBtn.classList.toggle('visible', window.scrollY > 400);
}, { passive: true });
scrollTopBtn.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ── Scroll fade-in animations ────────────────────────────── */
const fadeEls = document.querySelectorAll('.fade-up');
const fadeObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      setTimeout(() => entry.target.classList.add('visible'), 80);
      fadeObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
fadeEls.forEach(el => fadeObserver.observe(el));

/* Stagger children inside grids */
document.querySelectorAll('.services-grid, .why-grid, .gallery-grid, .steps').forEach(grid => {
  grid.querySelectorAll('.fade-up').forEach((child, i) => {
    child.style.transitionDelay = (i * 0.07) + 's';
  });
});

/* ── Animated counters ────────────────────────────────────── */
function animateCounter(el, target, suffix, duration) {
  let start     = 0;
  const step    = Math.ceil(target / (duration / 16));
  const timer   = setInterval(() => {
    start += step;
    if (start >= target) {
      start = target;
      clearInterval(timer);
    }
    el.textContent = start + suffix;
  }, 16);
}

const counters = document.querySelectorAll('[data-counter]');
const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el     = entry.target;
      const target = parseInt(el.getAttribute('data-counter'), 10);
      const suffix = el.getAttribute('data-suffix') || '';
      animateCounter(el, target, suffix, 1400);
      counterObserver.unobserve(el);
    }
  });
}, { threshold: 0.5 });
counters.forEach(el => counterObserver.observe(el));

/* ── Language switcher ────────────────────────────────────── */
function setLang(lang) {
  document.documentElement.lang = lang;

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active',
      (lang === 'uk' && btn.textContent === 'УК') ||
      (lang === 'ru' && btn.textContent === 'РУ')
    );
  });

  document.querySelectorAll('[data-uk]').forEach(el => {
    const val = lang === 'uk' ? el.getAttribute('data-uk') : el.getAttribute('data-ru');
    if (val) el.textContent = val;
  });

  // SEO meta
  const titleEl   = document.getElementById('page-title');
  const descEl    = document.getElementById('meta-desc');
  if (lang === 'uk') {
    titleEl.textContent = 'ТОВ ДК ГРАНТ — Вантажні перевезення по Києву та Україні';
    descEl.content      = 'Надійні вантажні перевезення по Києву та всій Україні. Квартирні та офісні переїзди, перевезення меблів, послуги вантажників. Телефон: 067 538 40 31';
  } else {
    titleEl.textContent = 'ООО ДК ГРАНТ — Грузовые перевозки по Киеву и Украине';
    descEl.content      = 'Надёжные грузовые перевозки по Киеву и всей Украине. Квартирные и офисные переезды, перевозка мебели, услуги грузчиков. Телефон: 067 538 40 31';
  }

  localStorage.setItem('lang', lang);
}

/* Restore saved language */
const savedLang = localStorage.getItem('lang');
if (savedLang && savedLang !== 'uk') setLang(savedLang);

/* ── Order form ───────────────────────────────────────────── */

// ⚠️ Telegram-бот для отримання заявок з сайту
const TELEGRAM_BOT_TOKEN = '8827753540:AAF9HEkK6CITVc9fTuOc-6K7r1KjOvbftow';

// Сюди додаєш chat_id всіх, кому мають приходити заявки.
// Щоб дізнатись chat_id людини: вона пише /start твоєму боту,
// потім відкриваєш https://api.telegram.org/bot<TOKEN>/getUpdates
const TELEGRAM_CHAT_IDS = [
  '1553938904',   // твій chat_id
  // '0000000000', // ← сюди впишеш chat_id дядька, коли він напише /start боту
];

const orderForm    = document.getElementById('order-form');
const formSuccess  = document.getElementById('form-success');
const submitBtn    = document.getElementById('form-submit');

if (orderForm) {
  orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Collect data
    const data = {
      from:    orderForm.querySelector('[name="from"]').value.trim(),
      to:      orderForm.querySelector('[name="to"]').value.trim(),
      cargo:   orderForm.querySelector('[name="cargo"]').value,
      date:    orderForm.querySelector('[name="date"]').value,
      phone:   orderForm.querySelector('[name="phone"]').value.trim(),
      comment: orderForm.querySelector('[name="comment"]').value.trim(),
    };

    // Show loading state
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span>';

    // Назви типів вантажу для читабельного повідомлення
    const cargoLabels = {
      apartment:    'Квартирний переїзд',
      office:       'Офісний переїзд',
      furniture:    'Меблі / техніка',
      construction: 'Будматеріали',
      other:        'Інше',
    };

    const text =
      '🚛 Нове замовлення з сайту!\n' +
      `📍 Звідки: ${data.from}\n` +
      `📍 Куди: ${data.to}\n` +
      `📦 Вантаж: ${cargoLabels[data.cargo] || data.cargo}\n` +
      `📅 Дата: ${data.date || 'не вказано'}\n` +
      `📞 Телефон: ${data.phone}\n` +
      `💬 Коментар: ${data.comment || 'немає'}`;

    try {
      // Шлемо повідомлення кожному отримувачу окремим запитом
      await Promise.all(
        TELEGRAM_CHAT_IDS.map(chatId =>
          fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text }),
          })
        )
      );

      // Show success
      orderForm.style.display   = 'none';
      formSuccess.style.display = 'block';
    } catch (err) {
      console.error('Помилка відправки заявки:', err);
      submitBtn.disabled  = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> <span>Спробувати ще раз</span>';
      alert('Не вдалося відправити заявку. Перевірте інтернет-з\'єднання і спробуйте ще раз, або зателефонуйте нам напряму.');
    }
  });
}
