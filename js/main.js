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

    /*
    ──────────────────────────────────────────────────────────────
    TODO: Підключіть реальну відправку одним із способів:

    ВАРІАНТ А — Telegram Bot API (безкоштовно, без реєстрації):
    ─────────────────────────────────────────────────────────────
    1. Відкрийте @BotFather в Telegram → /newbot → отримайте BOT_TOKEN
    2. Напишіть вашому боту /start, потім зайдіть на:
       https://api.telegram.org/bot<BOT_TOKEN>/getUpdates
       — там знайдіть ваш chat_id
    3. Замініть змінні нижче та розкоментуйте код:

    const BOT_TOKEN = 'YOUR_BOT_TOKEN';
    const CHAT_ID   = 'YOUR_CHAT_ID';
    const text = `
    🚛 Нове замовлення з сайту!
    📍 Звідки: ${data.from}
    📍 Куди: ${data.to}
    📦 Вантаж: ${data.cargo}
    📅 Дата: ${data.date}
    📞 Телефон: ${data.phone}
    💬 Коментар: ${data.comment || 'немає'}
    `;
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text }),
    });

    ВАРІАНТ Б — EmailJS (безкоштовно до 200 листів/місяць):
    ─────────────────────────────────────────────────────────────
    1. Реєстрація: https://www.emailjs.com
    2. Додайте Email Service (Gmail/Outlook)
    3. Створіть Email Template з полями {{from}}, {{to}}, {{phone}}
    4. Підключіть SDK у <head> і розкоментуйте:

    await emailjs.send('YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', data);
    ──────────────────────────────────────────────────────────────
    */

    // Симуляція відправки (поки без реального API)
    await new Promise(r => setTimeout(r, 900));

    // Show success
    orderForm.style.display   = 'none';
    formSuccess.style.display = 'block';
  });
}
