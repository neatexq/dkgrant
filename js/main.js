/* ============================================================
   ТОВ ДК ГРАНТ — Main JavaScript
   ============================================================ */

const header = document.getElementById('site-header');
const burger = document.getElementById('burger');
const mobileNav = document.getElementById('mobile-nav');
const scrollTopBtn = document.getElementById('scroll-top');
const orderForm = document.getElementById('order-form');
const formSuccess = document.getElementById('form-success');
const submitBtn = document.getElementById('form-submit');
const formStatus = document.getElementById('form-status');
const yearEl = document.getElementById('year');
const htmlEl = document.documentElement;

const ORDER_API_URL = 'https://dkgrant-form.derevyankomisha2012.workers.dev/order';
const SITE_TOKEN = 'ЗАМІНІТЬ_НА_ТОЙ_САМИЙ_ТОКЕН_ЩО_У_WORKER';
const SUBMIT_COOLDOWN_MS = 5 * 60 * 1000;
const LAST_SUBMIT_KEY = 'dkgrant_last_submit';
const DEFAULT_FORM_BUTTON_HTML = '<i class="fa-solid fa-paper-plane"></i> <span data-uk="Надіслати заявку" data-ru="Отправить заявку">Надіслати заявку</span>';
const RETRY_FORM_BUTTON_HTML = '<i class="fa-solid fa-paper-plane"></i> <span data-uk="Спробувати ще раз" data-ru="Попробовать ещё раз">Спробувати ще раз</span>';
const validCargo = ['glass', 'mirrors', 'windows', 'aluminum', 'structures', 'other'];
const cargoLabels = {
  glass: { uk: 'Скло', ru: 'Стекло' },
  mirrors: { uk: 'Дзеркала', ru: 'Зеркала' },
  windows: { uk: 'Склопакети', ru: 'Стеклопакеты' },
  aluminum: { uk: 'Алюмінієвий профіль', ru: 'Алюминиевый профиль' },
  structures: { uk: 'Великогабаритні конструкції', ru: 'Крупногабаритные конструкции' },
  other: { uk: 'Інше', ru: 'Другое' },
};

const formLoadedAt = Date.now();
let currentLang = localStorage.getItem('lang') || 'uk';

const messages = {
  uk: {
    invalidFrom: 'Вкажіть коректну адресу відправлення (мінімум 3 символи).',
    invalidTo: 'Вкажіть коректну адресу призначення (мінімум 3 символи).',
    invalidCargo: 'Оберіть тип вантажу зі списку.',
    invalidDate: 'Дата не може бути в минулому.',
    invalidPhone: 'Введіть коректний номер телефону у форматі +380XXXXXXXXX.',
    invalidComment: 'Коментар занадто короткий. Додайте деталі або залиште поле порожнім.',
    cooldown: (minutes) => `Заявку вже надіслано. Спробуйте ще раз через ${minutes} хв. або зателефонуйте нам напряму.`,
    botBlocked: 'Неможливо відправити форму. Оновіть сторінку та спробуйте ще раз.',
    sending: 'Надсилаємо заявку…',
    success: 'Заявку успішно надіслано. Ми зв’яжемося з вами найближчим часом.',
    networkError: 'Не вдалося відправити заявку. Перевірте інтернет-з’єднання або зателефонуйте нам напряму.',
    genericError: 'Не вдалося обробити заявку. Спробуйте ще раз трохи пізніше.',
    serverRateLimit: 'Заявку вже надіслано. Зачекайте 5 хвилин або зателефонуйте нам.',
    serverForbidden: 'Форму тимчасово недоступно. Будь ласка, зателефонуйте нам напряму.',
  },
  ru: {
    invalidFrom: 'Укажите корректный адрес отправления (минимум 3 символа).',
    invalidTo: 'Укажите корректный адрес назначения (минимум 3 символа).',
    invalidCargo: 'Выберите тип груза из списка.',
    invalidDate: 'Дата не может быть в прошлом.',
    invalidPhone: 'Введите корректный номер телефона в формате +380XXXXXXXXX.',
    invalidComment: 'Комментарий слишком короткий. Добавьте детали или оставьте поле пустым.',
    cooldown: (minutes) => `Заявка уже отправлена. Попробуйте ещё раз через ${minutes} мин. или позвоните нам напрямую.`,
    botBlocked: 'Невозможно отправить форму. Обновите страницу и попробуйте снова.',
    sending: 'Отправляем заявку…',
    success: 'Заявка успешно отправлена. Мы свяжемся с вами в ближайшее время.',
    networkError: 'Не удалось отправить заявку. Проверьте интернет-соединение или позвоните нам напрямую.',
    genericError: 'Не удалось обработать заявку. Попробуйте ещё раз немного позже.',
    serverRateLimit: 'Заявка уже отправлена. Подождите 5 минут или позвоните нам.',
    serverForbidden: 'Форма временно недоступна. Пожалуйста, позвоните нам напрямую.',
  },
};

if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

function getText(key, ...args) {
  const entry = messages[currentLang][key];
  return typeof entry === 'function' ? entry(...args) : entry;
}

function closeMobileNav() {
  if (!mobileNav || !burger) return;
  mobileNav.classList.remove('open');
  mobileNav.hidden = true;
  burger.setAttribute('aria-expanded', 'false');
}

function openMobileNav() {
  if (!mobileNav || !burger) return;
  mobileNav.hidden = false;
  mobileNav.classList.add('open');
  burger.setAttribute('aria-expanded', 'true');
}

window.addEventListener('scroll', () => {
  if (header) {
    header.classList.toggle('scrolled', window.scrollY > 30);
  }
  if (scrollTopBtn) {
    scrollTopBtn.classList.toggle('visible', window.scrollY > 400);
  }
}, { passive: true });

if (burger && mobileNav) {
  burger.addEventListener('click', () => {
    const isOpen = mobileNav.classList.contains('open');
    if (isOpen) {
      closeMobileNav();
    } else {
      openMobileNav();
    }
  });

  mobileNav.querySelectorAll('a').forEach((anchor) => {
    anchor.addEventListener('click', closeMobileNav);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMobileNav();
  });
}

if (scrollTopBtn) {
  scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fadeEls = document.querySelectorAll('.fade-up');

if (prefersReducedMotion) {
  fadeEls.forEach((el) => el.classList.add('visible'));
} else {
  const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), 80);
        fadeObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  fadeEls.forEach((el) => fadeObserver.observe(el));

  document.querySelectorAll('.services-grid, .why-grid, .steps').forEach((grid) => {
    grid.querySelectorAll('.fade-up').forEach((child, index) => {
      child.style.transitionDelay = `${index * 0.07}s`;
    });
  });
}

function animateCounter(el, target, suffix, duration) {
  let start = 0;
  const step = Math.ceil(target / (duration / 16));
  const timer = setInterval(() => {
    start += step;
    if (start >= target) {
      start = target;
      clearInterval(timer);
    }
    el.textContent = start + suffix;
  }, 16);
}

const counters = document.querySelectorAll('[data-counter]');
if (prefersReducedMotion) {
  counters.forEach((el) => {
    el.textContent = `${el.getAttribute('data-counter')}${el.getAttribute('data-suffix') || ''}`;
  });
} else {
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.getAttribute('data-counter'), 10);
        const suffix = el.getAttribute('data-suffix') || '';
        animateCounter(el, target, suffix, 1400);
        counterObserver.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach((el) => counterObserver.observe(el));
}

function updateMetaByLang(lang) {
  const titleEl = document.getElementById('page-title');
  const descEl = document.getElementById('meta-desc');
  const ogTitle = document.querySelector('meta[property="og:title"]');
  const ogDesc = document.querySelector('meta[property="og:description"]');
  const twitterTitle = document.querySelector('meta[name="twitter:title"]');
  const twitterDesc = document.querySelector('meta[name="twitter:description"]');

  const seo = {
    uk: {
      title: 'ДК ГРАНТ — Перевезення скла та склоконструкцій по Києву',
      desc: 'Перевезення скла, дзеркал, склопакетів, алюмінієвого профілю та великогабаритних конструкцій у Києві. Послуги вантажників. Телефон: 067 538 40 31',
    },
    ru: {
      title: 'ДК ГРАНТ — Перевозка стекла и стеклоконструкций по Киеву',
      desc: 'Перевозка стекла, зеркал, стеклопакетов, алюминиевого профиля и крупногабаритных конструкций в Киеве. Услуги грузчиков. Телефон: 067 538 40 31',
    },
  };

  const currentSeo = seo[lang];
  titleEl.textContent = currentSeo.title;
  descEl.content = currentSeo.desc;
  if (ogTitle) ogTitle.content = currentSeo.title;
  if (ogDesc) ogDesc.content = currentSeo.desc;
  if (twitterTitle) twitterTitle.content = currentSeo.title;
  if (twitterDesc) twitterDesc.content = currentSeo.desc;
}

function translateSelectOptions(lang) {
  document.querySelectorAll('select option[data-uk]').forEach((option) => {
    const value = lang === 'uk' ? option.getAttribute('data-uk') : option.getAttribute('data-ru');
    if (value) option.textContent = value;
  });
}

function updateSubmitButtonLabel(html) {
  if (!submitBtn) return;
  submitBtn.innerHTML = html;
  const span = submitBtn.querySelector('span[data-uk]');
  if (span) {
    const value = currentLang === 'uk' ? span.getAttribute('data-uk') : span.getAttribute('data-ru');
    if (value) span.textContent = value;
  }
}

function setNotice(message = '', type = '') {
  if (!formStatus) return;
  if (!message) {
    formStatus.textContent = '';
    formStatus.className = 'form-notice';
    return;
  }

  formStatus.textContent = message;
  formStatus.className = `form-notice visible ${type}`.trim();
}

function setFieldState(name, message = '') {
  if (!orderForm) return;
  const field = orderForm.querySelector(`[name="${name}"]`);
  if (!field) return;

  const group = field.closest('.form-group');
  const errorEl = document.getElementById(`${name}-error`);
  if (!group || !errorEl) return;

  group.classList.remove('is-invalid', 'is-valid');
  field.removeAttribute('aria-invalid');
  errorEl.textContent = '';

  if (message) {
    group.classList.add('is-invalid');
    field.setAttribute('aria-invalid', 'true');
    errorEl.textContent = message;
  } else if (field.value.trim()) {
    group.classList.add('is-valid');
  }
}

function clearFieldStates() {
  if (!orderForm) return;
  ['from', 'to', 'cargo', 'date', 'phone', 'comment'].forEach((name) => setFieldState(name, ''));
}

function normalizePhone(value) {
  const cleaned = value.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    return `+${cleaned.slice(1).replace(/\D/g, '')}`;
  }
  return cleaned.replace(/\D/g, '');
}

function formatPhoneForInput(value) {
  const digits = value.replace(/\D/g, '');
  let normalized = digits;

  if (normalized.startsWith('380')) {
    normalized = normalized.slice(0, 12);
  } else if (normalized.startsWith('80')) {
    normalized = `3${normalized}`.slice(0, 12);
  } else if (normalized.startsWith('0')) {
    normalized = `38${normalized}`.slice(0, 12);
  } else {
    normalized = normalized.slice(0, 12);
  }

  if (!normalized) return '';

  const parts = [
    normalized.slice(0, 3),
    normalized.slice(3, 5),
    normalized.slice(5, 8),
    normalized.slice(8, 10),
    normalized.slice(10, 12),
  ].filter(Boolean);

  if (parts.length === 1) return `+${parts[0]}`;
  return `+${parts[0]} ${parts.slice(1).join(' ')}`;
}

function getRemainingCooldown() {
  const last = parseInt(localStorage.getItem(LAST_SUBMIT_KEY) || '0', 10);
  const elapsed = Date.now() - last;
  return Math.max(0, SUBMIT_COOLDOWN_MS - elapsed);
}

function validateForm(data) {
  const errors = {};

  if (data.from.length < 3 || /^[\d\s]+$/.test(data.from)) {
    errors.from = getText('invalidFrom');
  }

  if (data.to.length < 3 || /^[\d\s]+$/.test(data.to)) {
    errors.to = getText('invalidTo');
  }

  if (!validCargo.includes(data.cargo)) {
    errors.cargo = getText('invalidCargo');
  }

  if (data.date) {
    const chosen = new Date(data.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (chosen < today) {
      errors.date = getText('invalidDate');
    }
  }

  const phoneDigits = data.phone.replace(/\D/g, '');
  if (phoneDigits.length < 10) {
    errors.phone = getText('invalidPhone');
  }

  if (data.comment.length > 0 && data.comment.length < 5) {
    errors.comment = getText('invalidComment');
  }

  return errors;
}

function getFormData() {
  return {
    from: orderForm.querySelector('[name="from"]').value.trim(),
    to: orderForm.querySelector('[name="to"]').value.trim(),
    cargo: orderForm.querySelector('[name="cargo"]').value,
    cargoLabel: cargoLabels[orderForm.querySelector('[name="cargo"]').value]?.[currentLang] || '',
    date: orderForm.querySelector('[name="date"]').value,
    phone: normalizePhone(orderForm.querySelector('[name="phone"]').value.trim()),
    comment: orderForm.querySelector('[name="comment"]').value.trim(),
    website: '',
    lang: currentLang,
    _elapsed: Date.now() - formLoadedAt,
  };
}

function applyValidationResult(errors) {
  clearFieldStates();
  Object.entries(errors).forEach(([name, message]) => setFieldState(name, message));

  const firstError = Object.keys(errors)[0];
  if (firstError) {
    const firstField = orderForm.querySelector(`[name="${firstError}"]`);
    if (firstField) firstField.focus();
    setNotice(errors[firstError], 'error');
  } else {
    setNotice('');
  }
}

function toggleFormSuccess(show) {
  if (!orderForm || !formSuccess) return;
  orderForm.style.display = show ? 'none' : 'block';
  formSuccess.style.display = show ? 'block' : 'none';
}

function setLang(lang) {
  currentLang = lang;
  htmlEl.lang = lang;

  document.querySelectorAll('.lang-btn').forEach((btn) => {
    const isActive =
      (lang === 'uk' && btn.textContent.trim() === 'УК') ||
      (lang === 'ru' && btn.textContent.trim() === 'РУ');
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });

  document.querySelectorAll('[data-uk]').forEach((el) => {
    const value = lang === 'uk' ? el.getAttribute('data-uk') : el.getAttribute('data-ru');
    if (!value) return;

    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.setAttribute('placeholder', value);
    } else {
      el.textContent = value;
    }
  });

  translateSelectOptions(lang);
  updateMetaByLang(lang);
  localStorage.setItem('lang', lang);

  if (submitBtn && !submitBtn.disabled) {
    if (submitBtn.dataset.state === 'retry') {
      updateSubmitButtonLabel(RETRY_FORM_BUTTON_HTML);
    } else {
      updateSubmitButtonLabel(DEFAULT_FORM_BUTTON_HTML);
      submitBtn.dataset.state = 'default';
    }
  }

  if (formSuccess && getRemainingCooldown() > 0 && formSuccess.style.display === 'block') {
    setNotice(getText('success'), 'success');
  }
}

window.setLang = setLang;
setLang(currentLang);

if (orderForm) {
  const phoneInput = orderForm.querySelector('[name="phone"]');
  if (phoneInput) {
    phoneInput.addEventListener('input', () => {
      phoneInput.value = formatPhoneForInput(phoneInput.value);
      if (phoneInput.value.trim()) setFieldState('phone', '');
    });
  }

  ['from', 'to', 'cargo', 'date', 'phone', 'comment'].forEach((name) => {
    const field = orderForm.querySelector(`[name="${name}"]`);
    if (!field) return;

    const handler = () => {
      const data = getFormData();
      const errors = validateForm(data);
      setFieldState(name, errors[name] || '');
      if (!errors[name]) {
        const remainingErrors = Object.keys(errors).filter((key) => key !== name && errors[key]);
        if (remainingErrors.length === 0) setNotice('');
      }
    };

    field.addEventListener('blur', handler);
    field.addEventListener('change', handler);
  });

  orderForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFieldStates();

    const honeypot = orderForm.querySelector('[name="website"]').value.trim();
    if (honeypot !== '') {
      setNotice(getText('botBlocked'), 'error');
      return;
    }

    const elapsed = Date.now() - formLoadedAt;
    if (elapsed < 3000) {
      setNotice(getText('botBlocked'), 'error');
      return;
    }

    const remaining = getRemainingCooldown();
    if (remaining > 0) {
      const minutes = Math.ceil(remaining / 60000);
      setNotice(getText('cooldown', minutes), 'error');
      toggleFormSuccess(false);
      return;
    }

    const data = getFormData();
    const errors = validateForm(data);
    if (Object.keys(errors).length > 0) {
      applyValidationResult(errors);
      return;
    }

    setNotice(getText('sending'), 'success');
    submitBtn.disabled = true;
    submitBtn.dataset.state = 'loading';
    submitBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span>';

    try {
      const response = await fetch(ORDER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Site-Token': SITE_TOKEN,
        },
        body: JSON.stringify(data),
      });

      const result = await response.json().catch(() => ({}));

      if (response.status === 429) {
        setNotice(getText('serverRateLimit'), 'error');
        submitBtn.disabled = false;
        submitBtn.dataset.state = 'retry';
        updateSubmitButtonLabel(RETRY_FORM_BUTTON_HTML);
        return;
      }

      if (response.status === 403) {
        setNotice(getText('serverForbidden'), 'error');
        submitBtn.disabled = false;
        submitBtn.dataset.state = 'retry';
        updateSubmitButtonLabel(RETRY_FORM_BUTTON_HTML);
        return;
      }

      if (response.status === 422 && result.field) {
        setFieldState(result.field, result.error || getText('genericError'));
        setNotice(result.error || getText('genericError'), 'error');
        submitBtn.disabled = false;
        submitBtn.dataset.state = 'retry';
        updateSubmitButtonLabel(RETRY_FORM_BUTTON_HTML);
        return;
      }

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Server error');
      }

      localStorage.setItem(LAST_SUBMIT_KEY, String(Date.now()));
      setNotice(getText('success'), 'success');
      toggleFormSuccess(true);
    } catch (error) {
      console.error('Помилка відправки заявки:', error);
      setNotice(getText('networkError'), 'error');
      submitBtn.disabled = false;
      submitBtn.dataset.state = 'retry';
      updateSubmitButtonLabel(RETRY_FORM_BUTTON_HTML);
      return;
    }

    submitBtn.disabled = false;
    submitBtn.dataset.state = 'default';
    updateSubmitButtonLabel(DEFAULT_FORM_BUTTON_HTML);
  });

  if (getRemainingCooldown() > 0) {
    toggleFormSuccess(true);
    setNotice(getText('success'), 'success');
  }
}
