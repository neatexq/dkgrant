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
    titleEl.textContent = 'ДК ГРАНТ — Перевезення скла та склоконструкцій по Києву';
    descEl.content      = 'Перевезення скла, дзеркал, склопакетів, алюмінієвого профілю та великогабаритних конструкцій у Києві. Послуги вантажників. Телефон: 067 538 40 31';
  } else {
    titleEl.textContent = 'ДК ГРАНТ — Перевозка стекла и стеклоконструкций по Киеву';
    descEl.content      = 'Перевозка стекла, зеркал, стеклопакетов, алюминиевого профиля и крупногабаритных конструкций в Киеве. Услуги грузчиков. Телефон: 067 538 40 31';
  }

  localStorage.setItem('lang', lang);
}

/* Restore saved language */
const savedLang = localStorage.getItem('lang');
if (savedLang && savedLang !== 'uk') setLang(savedLang);

/* ── Order form ───────────────────────────────────────────── */

// Worker URL
const ORDER_API_URL = 'https://dkgrant-form.derevyankomisha2012.workers.dev/order';

// Секретний токен — той самий рядок, що й SITE_TOKEN у worker.js
// Це не є 100% секретом (видно в JS), але захищає від випадкових
// скриптів та автоматів. Для повного захисту — лише перевірка Origin на Worker.
const SITE_TOKEN = ' dk_grant_secret_2024_xkq9abc';

const orderForm    = document.getElementById('order-form');
const formSuccess  = document.getElementById('form-success');
const submitBtn    = document.getElementById('form-submit');

// Час відкриття сторінки — для timing-перевірки
const formLoadedAt = Date.now();

// Ліміт повторної відправки — раз на 5 хвилин
const SUBMIT_COOLDOWN_MS = 5 * 60 * 1000;
const LAST_SUBMIT_KEY    = 'dkgrant_last_submit';

function getRemainingCooldown() {
  const last    = parseInt(localStorage.getItem(LAST_SUBMIT_KEY) || '0', 10);
  const elapsed = Date.now() - last;
  return Math.max(0, SUBMIT_COOLDOWN_MS - elapsed);
}

if (orderForm) {
  orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // ── Антиспам: honeypot ────────────────────────────────────
    const honeypot = orderForm.querySelector('[name="website"]').value.trim();
    if (honeypot !== '') {
      console.warn('Bot blocked (honeypot)');
      return;
    }

    // ── Антиспам: занадто швидке заповнення ───────────────────
    const elapsed = Date.now() - formLoadedAt;
    if (elapsed < 3000) {
      console.warn('Bot blocked (too fast)');
      return;
    }

    // ── Антиспам: cooldown ────────────────────────────────────
    const remaining = getRemainingCooldown();
    if (remaining > 0) {
      const minutes = Math.ceil(remaining / 60000);
      alert(
        `Заявку вже надіслано. Спробуйте ще раз через ${minutes} хв., ` +
        `або зателефонуйте нам напряму: 067 538 40 31.`
      );
      return;
    }

    // Collect data
    const data = {
      from:     orderForm.querySelector('[name="from"]').value.trim(),
      to:       orderForm.querySelector('[name="to"]').value.trim(),
      cargo:    orderForm.querySelector('[name="cargo"]').value,
      date:     orderForm.querySelector('[name="date"]').value,
      phone:    orderForm.querySelector('[name="phone"]').value.trim(),
      comment:  orderForm.querySelector('[name="comment"]').value.trim(),
      website:  '',
      _elapsed: elapsed,
    };

    // ── Валідація полів ───────────────────────────────────────
    const errors = [];

    // Звідки — мінімум 3 символи, не лише пробіли/цифри
    if (data.from.length < 3 || /^[\d\s]+$/.test(data.from)) {
      errors.push('Вкажіть коректну адресу відправлення (мінімум 3 символи)');
    }

    // Куди — те саме
    if (data.to.length < 3 || /^[\d\s]+$/.test(data.to)) {
      errors.push('Вкажіть коректну адресу призначення (мінімум 3 символи)');
    }

    // Тип вантажу — має бути обраний зі списку
    const validCargo = ['glass', 'mirrors', 'windows', 'aluminum', 'structures', 'other'];
    if (!validCargo.includes(data.cargo)) {
      errors.push('Оберіть тип вантажу зі списку');
    }

    // Дата — якщо вказана, не може бути в минулому
    if (data.date) {
      const chosen = new Date(data.date);
      const today  = new Date();
      today.setHours(0, 0, 0, 0);
      if (chosen < today) {
        errors.push('Дата не може бути в минулому');
      }
    }

    // Телефон — мінімум 10 цифр
    const phoneDigits = data.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      errors.push('Введіть коректний номер телефону (наприклад +380671234567)');
    }

    // Коментар — якщо є, мінімум 5 символів
    if (data.comment.length > 0 && data.comment.length < 5) {
      errors.push('Коментар занадто короткий (мінімум 5 символів або залиште порожнім)');
    }

    if (errors.length > 0) {
      alert(errors.join('\n'));
      return;
    }

    // Show loading state
    submitBtn.disabled   = true;
    submitBtn.innerHTML  = '<span class="spinner"></span>';

    try {
      const res = await fetch(ORDER_API_URL, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          // Секретний заголовок — Worker відхиляє запити без нього
          'X-Site-Token': SITE_TOKEN,
        },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (res.status === 429) {
        // Rate-limit з Worker
        alert('Заявку вже надіслано. Зачекайте 5 хвилин або зателефонуйте: 067 538 40 31.');
        submitBtn.disabled  = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> <span>Надіслати заявку</span>';
        return;
      }

      if (!res.ok || !result.ok) {
        throw new Error(result.error || 'Server error');
      }

      // Запам'ятовуємо час успішної відправки
      localStorage.setItem(LAST_SUBMIT_KEY, String(Date.now()));

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

  // Якщо людина нещодавно вже відправляла — одразу показуємо success
  if (getRemainingCooldown() > 0) {
    orderForm.style.display   = 'none';
    formSuccess.style.display = 'block';
  }
}
