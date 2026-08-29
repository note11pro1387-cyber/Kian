/* ==========================================================================
   KIAN MOBILE REPAIR — MOTION / INTERACTION ENGINE
   Vanilla JS. GSAP + ScrollTrigger are optional enhancements: every module
   below still works (menus, gallery, FAQ, lightbox, tour, contact) even if
   the GSAP CDN fails to load — only the decorative scroll animation layer
   is skipped in that case, and .reveal-item/.reveal-hero fall back to a
   plain IntersectionObserver + CSS transition (see style.css).
   ========================================================================== */
(() => {
  'use strict';

  /* ================= CENTRAL CONFIG =================
     Single source of truth for business data. Editing this object is the
     only place needed to update contact info once real channels exist —
     both the contact section and the floating panel read from it. */
  const CONFIG = {
    phone: '+989036907733',
    phoneDisplay: '0903 690 7733',
    whatsapp: 'https://wa.me/989036907733',
    social: {
      telegram: '',
      rubika: '',
      eitaa: ''
    },
    timezone: 'Asia/Tehran',
    hours: [[10, 14], [17, 22]],
    services: {
      display: { title: 'نمایشگر', code: 'DISPLAY', description: 'تعویض نمایشگر، تاچ و بررسی مشکلات تصویر با تست دقیق پس از تعویض.' },
      charging: { title: 'شارژ و تغذیه', code: 'CHARGING', description: 'تعمیر و تعویض سوکت شارژ، آی‌سی شارژ و رفع مشکلات عدم شارژ شدن.' },
      board: { title: 'تعمیر برد', code: 'BOARD LEVEL', description: 'عیب‌یابی و تعمیر تخصصی برد در سطح قطعات SMD و مسیرهای ریز.' },
      battery: { title: 'باتری', code: 'BATTERY', description: 'تعویض باتری اصل با تست ظرفیت واقعی و ۶ ماه ضمانت.' },
      camera: { title: 'دوربین', code: 'CAMERA', description: 'تعمیر و تعویض ماژول دوربین و رفع مشکلات فوکوس و لرزش تصویر.' },
      water: { title: 'آب‌خوردگی', code: 'LIQUID DAMAGE', description: 'شستشوی تخصصی برد، بررسی خوردگی و بازیابی دستگاه پس از آب‌خوردگی.' },
      software: { title: 'نرم‌افزاری', code: 'SOFTWARE', description: 'رفع مشکلات نرم‌افزاری، هنگ کردن، ریست و به‌روزرسانی سیستم‌عامل.' },
      frame: { title: 'بدنه و شاسی', code: 'FRAME', description: 'تعویض بدنه، شاسی و دکمه‌های فیزیکی آسیب‌دیده دستگاه.' }
    }
  };

  /* ================= UTILITIES ================= */
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

  const state = {
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    coarsePointer: window.matchMedia('(hover: none), (pointer: coarse)').matches,
    menuOpen: false,
    lightboxOpen: false,
    tourOpen: false,
    lastFocused: null
  };

  function prefersReduced() { return state.reducedMotion; }

  function rafThrottle(fn) {
    let ticking = false;
    return (...args) => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { fn(...args); ticking = false; });
    };
  }

  function lockBody() { document.body.classList.add('is-locked'); }
  function unlockBody() {
    if (!state.menuOpen && !state.lightboxOpen && !state.tourOpen) {
      document.body.classList.remove('is-locked');
    }
  }

  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const onReducedMotionChange = (e) => { state.reducedMotion = e.matches; };
  if (reducedMotionQuery.addEventListener) {
    reducedMotionQuery.addEventListener('change', onReducedMotionChange);
  } else if (reducedMotionQuery.addListener) {
    reducedMotionQuery.addListener(onReducedMotionChange);
  }

  /* ================= FOCUS TRAP ================= */
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function getFocusable(container) {
    return $$(FOCUSABLE, container).filter((el) => el.offsetParent !== null);
  }

  function trapFocusKeydown(container, evt) {
    if (evt.key !== 'Tab') return;
    const items = getFocusable(container);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (evt.shiftKey && document.activeElement === first) {
      evt.preventDefault();
      last.focus();
    } else if (!evt.shiftKey && document.activeElement === last) {
      evt.preventDefault();
      first.focus();
    }
  }

  function setPageInert(exceptElement) {
    // Improve accessibility by making background content inert while
    // an overlay is open. Simple approach: aria-hidden on main and footer.
    const main = $('main');
    const footer = $('.site-footer');
    if (main) main.setAttribute('aria-hidden', 'true');
    if (footer) footer.setAttribute('aria-hidden', 'true');
    if (exceptElement) exceptElement.removeAttribute('aria-hidden');
  }

  function removePageInert() {
    const main = $('main');
    const footer = $('.site-footer');
    if (main) main.removeAttribute('aria-hidden');
    if (footer) footer.removeAttribute('aria-hidden');
  }

  function openOverlay(container) {
    state.lastFocused = document.activeElement;
    lockBody();
    setPageInert(container);
    const first = getFocusable(container)[0];
    if (first) first.focus();
  }

  function closeOverlay() {
    unlockBody();
    removePageInert();
    if (state.lastFocused && typeof state.lastFocused.focus === 'function') {
      state.lastFocused.focus();
    }
    state.lastFocused = null;
  }

  /* ================= IMAGE FALLBACK ENGINE ================= */
  function initImageFallbacks() {
    const FRAME_SELECTOR = '.hero__media, .image-frame, .portrait-frame, .workshop__image, .specialized__media, .classic__media, .gallery-item';

    function handleFailure(img) {
      if (img.dataset.fallbackStage !== 'online' && img.dataset.fallback) {
        img.dataset.fallbackStage = 'online';
        img.src = img.dataset.fallback;
        return;
      }
      const frame = img.closest(FRAME_SELECTOR);
      if (frame) frame.classList.add('is-missing');
    }

    $$('img[data-fallback]').forEach((img) => {
      img.addEventListener('error', () => handleFailure(img));
      if (img.complete && img.naturalWidth === 0) handleFailure(img);
    });
  }

  /* ================= PRELOADER ================= */
  function initPreloader() {
    const preloader = $('#preloader');
    if (!preloader) return;
    const percentEl = $('#preloaderPercent');
    let percent = 0;
    let raf;

    function tick() {
      percent = clamp(percent + Math.random() * 14, 0, 96);
      if (percentEl) percentEl.textContent = String(Math.round(percent)).padStart(2, '0') + '%';
      raf = requestAnimationFrame(() => setTimeout(tick, 90));
    }

    function finish() {
      if (preloader.dataset.done === 'true') return;
      preloader.dataset.done = 'true';
      cancelAnimationFrame(raf);
      if (percentEl) percentEl.textContent = '100%';
      const done = () => {
        preloader.style.display = 'none';
        document.dispatchEvent(new CustomEvent('kian:preloaderDone'));
      };
      if (window.gsap && !prefersReduced()) {
        gsap.to(preloader, { opacity: 0, duration: 0.5, ease: 'power1.out', onComplete: done });
      } else {
        preloader.style.transition = 'opacity .4s ease';
        preloader.style.opacity = '0';
        setTimeout(done, 420);
      }
    }

    tick();
    if (document.readyState === 'complete') {
      finish();
    } else {
      window.addEventListener('load', finish, { once: true });
    }
    setTimeout(finish, 2600);
  }

  /* ================= HEADER & ACTIVE SECTION ================= */
  function initHeader() {
    const header = $('#siteHeader');
    const bar = $('#mobileContactBar');
    if (!header) return;
    let lastY = window.scrollY;

    const onScroll = rafThrottle(() => {
      const y = window.scrollY;
      header.classList.toggle('is-scrolled', y > 12);
      if (y > lastY && y > 220 && !state.menuOpen) {
        header.classList.add('is-hidden');
      } else {
        header.classList.remove('is-hidden');
      }
      lastY = y;
      if (bar) bar.classList.toggle('is-visible', y > 480 && !state.menuOpen);
    });

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* Active section highlighting */
  function initActiveNav() {
    const sections = $$('section[id], main[id]');
    const navLinks = $$('.desktop-nav a');
    if (!sections.length || !navLinks.length) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach((link) => {
            link.classList.toggle('is-active', link.getAttribute('href') === `#${id}`);
          });
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });
    sections.forEach((section) => observer.observe(section));
  }

  /* ================= MOBILE MENU ================= */
  function initMobileMenu() {
    const toggle = $('#menuToggle');
    const menu = $('#mobileMenu');
    if (!toggle || !menu) return;

    function open() {
      state.menuOpen = true;
      toggle.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      menu.classList.add('is-open');
      openOverlay(menu);
      if (window.gsap && !prefersReduced()) {
        gsap.timeline()
          .to('.mobile-menu__backdrop', { opacity: 1, duration: 0.35, ease: 'power1.out' }, 0)
          .to('.mobile-menu__content', { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 0.05)
          .from('.mobile-menu__nav a', { opacity: 0, y: 24, duration: 0.45, stagger: 0.05, ease: 'power2.out' }, 0.12);
      } else {
        $('.mobile-menu__backdrop', menu).style.opacity = '1';
        $('.mobile-menu__content', menu).style.opacity = '1';
        $('.mobile-menu__content', menu).style.transform = 'none';
      }
    }

    function close() {
      state.menuOpen = false;
      toggle.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      const finish = () => { menu.classList.remove('is-open'); closeOverlay(); };
      if (window.gsap && !prefersReduced()) {
        gsap.timeline({ onComplete: finish })
          .to('.mobile-menu__content', { opacity: 0, y: 16, duration: 0.28, ease: 'power2.in' }, 0)
          .to('.mobile-menu__backdrop', { opacity: 0, duration: 0.28, ease: 'power1.in' }, 0);
      } else {
        finish();
      }
    }

    toggle.addEventListener('click', () => (state.menuOpen ? close() : open()));
    $$('[data-menu-close]', menu).forEach((el) => el.addEventListener('click', close));
    menu.addEventListener('keydown', (evt) => {
      if (evt.key === 'Escape') { close(); return; }
      trapFocusKeydown(menu, evt);
    });
  }

  /* ================= CURSOR (desktop) ================= */
  function initCursor() {
    if (state.coarsePointer || prefersReduced() || !window.gsap) return;
    const dot = $('#cursorDot');
    const ring = $('#cursorRing');
    if (!dot || !ring) return;

    let shown = false;

    window.addEventListener('mousemove', (evt) => {
      if (!shown) {
        shown = true;
        gsap.to([dot, ring], { opacity: 1, duration: 0.3 });
      }
      gsap.to(dot, { x: evt.clientX, y: evt.clientY, duration: 0.1, ease: 'power2.out' });
      gsap.to(ring, { x: evt.clientX, y: evt.clientY, duration: 0.35, ease: 'power2.out' });
    });

    $$('a, button, .gallery-item, .service-row').forEach((el) => {
      el.addEventListener('mouseenter', () => gsap.to(ring, { scale: 1.6, duration: 0.3 }));
      el.addEventListener('mouseleave', () => gsap.to(ring, { scale: 1, duration: 0.3 }));
    });
  }

  /* ================= SCROLL PROGRESS ================= */
  function initScrollProgress() {
    const bar = $('#scrollProgressBar');
    if (!bar) return;
    const onScroll = rafThrottle(() => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      const ratio = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
      bar.style.transform = `scaleX(${ratio})`;
    });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
  }

  /* ================= LIVE STATUS ================= */
  function initLiveStatus() {
    const wrap = $('#liveStatus');
    const text = $('#liveStatusText');
    if (!wrap || !text) return;

    function currentTehranMinutes() {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: CONFIG.timezone, hour: '2-digit', minute: '2-digit', hour12: false
      }).formatToParts(new Date());
      const h = Number(parts.find((p) => p.type === 'hour').value);
      const m = Number(parts.find((p) => p.type === 'minute').value);
      return h * 60 + m;
    }

    function update() {
      const nowMin = currentTehranMinutes();
      const isOpen = CONFIG.hours.some(([from, to]) => nowMin >= from * 60 && nowMin < to * 60);
      wrap.classList.toggle('is-open', isOpen);
      wrap.classList.toggle('is-closed', !isOpen);
      text.innerHTML = isOpen ? '<b>در حال فعالیت</b>' : '<b>خارج از ساعات فعالیت</b>';
    }

    update();
    setInterval(update, 60000);
  }

  /* ================= SERVICES ================= */
  function initServices() {
    const rows = $$('.service-row');
    const preview = $('#servicesPreview');
    if (!rows.length || !preview) return;
    const image = $('#servicesPreviewImage');
    const idxEl = $('#servicePreviewIndex');
    const titleEl = $('#servicePreviewTitle');
    const descEl = $('#servicePreviewDescription');
    const codeEl = $('#servicePreviewCode');

    function activate(row) {
      rows.forEach((r) => { r.classList.remove('is-active'); r.setAttribute('aria-expanded', 'false'); });
      row.classList.add('is-active');
      row.setAttribute('aria-expanded', 'true');
      const key = row.dataset.service;
      const data = CONFIG.services[key];
      const index = row.querySelector('.service-row__index');
      if (!data) return;
      if (idxEl && index) idxEl.textContent = index.textContent;
      if (titleEl) titleEl.textContent = data.title;
      if (descEl) descEl.textContent = data.description;
      if (codeEl) codeEl.textContent = data.code;
      if (image && window.gsap && !prefersReduced()) {
        gsap.fromTo(image, { opacity: 0.4 }, { opacity: 1, duration: 0.45, ease: 'power2.out' });
      }
    }

    rows.forEach((row) => row.addEventListener('click', () => activate(row)));

    if (!state.coarsePointer) {
      rows.forEach((row) => row.addEventListener('mouseenter', () => activate(row)));
    }
  }

  /* ================= GALLERY + FILTERS ================= */
  function initGallery() {
    const grid = $('#galleryGrid');
    const filters = $('#galleryFilters');
    if (!grid) return;
    const items = $$('.gallery-item', grid);

    if (filters) {
      $$('button', filters).forEach((btn) => {
        btn.addEventListener('click', () => {
          $$('button', filters).forEach((b) => b.setAttribute('aria-pressed', 'false'));
          btn.setAttribute('aria-pressed', 'true');
          const filter = btn.dataset.filter;
          items.forEach((item) => {
            const show = filter === 'all' || item.dataset.category === filter;
            item.classList.toggle('is-filtered-out', !show);
          });
        });
      });
    }

    items.forEach((item) => item.addEventListener('click', () => openLightbox(item)));
    return items;
  }

  /* ================= LIGHTBOX ================= */
  let lightboxItems = [];
  let lightboxIndex = 0;
  let lightboxImgErrorHandler = null;

  function renderLightbox() {
    const item = lightboxItems[lightboxIndex];
    if (!item) return;
    const img = $('#lightboxImage');
    const figure = $('#lightboxFigure');
    const caption = $('#lightboxCaption');
    const count = $('#lightboxCount');
    const sourceImg = $('img', item);
    const local = sourceImg.dataset.full || sourceImg.getAttribute('src');
    const fallback = sourceImg.dataset.fullFallback || sourceImg.dataset.fallback || '';

    figure.classList.remove('is-missing');
    img.dataset.fallback = fallback;
    img.dataset.fallbackStage = '';
    img.alt = sourceImg.alt;

    // Remove previous error handler to avoid memory leak
    if (lightboxImgErrorHandler) {
      img.removeEventListener('error', lightboxImgErrorHandler);
    }
    lightboxImgErrorHandler = () => {
      if (img.dataset.fallbackStage !== 'online' && fallback) {
        img.dataset.fallbackStage = 'online';
        img.src = fallback;
      } else {
        figure.classList.add('is-missing');
      }
    };
    img.addEventListener('error', lightboxImgErrorHandler);

    img.src = local;

    caption.textContent = $('.gallery-item__caption', item) ? $('.gallery-item__caption', item).textContent : '';
    const total = String(lightboxItems.length).padStart(2, '0');
    const pos = String(lightboxIndex + 1).padStart(2, '0');
    if (count) count.textContent = `${pos} / ${total}`;
  }

  function openLightbox(item) {
    lightboxItems = $$('.gallery-item', $('#galleryGrid')).filter((i) => !i.classList.contains('is-filtered-out'));
    lightboxIndex = Math.max(0, lightboxItems.indexOf(item));
    const box = $('#lightbox');
    if (!box) return;
    renderLightbox();
    state.lightboxOpen = true;
    box.classList.add('is-open');
    openOverlay(box);
    if (window.gsap && !prefersReduced()) {
      gsap.fromTo('.lightbox__dialog', { opacity: 0, scale: 0.97 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'power3.out' });
    }
  }

  function closeLightbox() {
    const box = $('#lightbox');
    if (!box) return;
    state.lightboxOpen = false;
    box.classList.remove('is-open');
    closeOverlay();
  }

  function stepLightbox(delta) {
    if (!lightboxItems.length) return;
    lightboxIndex = (lightboxIndex + delta + lightboxItems.length) % lightboxItems.length;
    renderLightbox();
  }

  function initLightbox() {
    const box = $('#lightbox');
    if (!box) return;
    $('#lightboxClose', box).addEventListener('click', closeLightbox);
    $$('[data-lightbox-close]', box).forEach((el) => el.addEventListener('click', closeLightbox));
    $('#lightboxPrev', box).addEventListener('click', () => stepLightbox(-1));
    $('#lightboxNext', box).addEventListener('click', () => stepLightbox(1));

    box.addEventListener('keydown', (evt) => {
      if (!state.lightboxOpen) return;
      if (evt.key === 'Escape') { closeLightbox(); return; }
      if (evt.key === 'ArrowRight') stepLightbox(1);
      if (evt.key === 'ArrowLeft') stepLightbox(-1);
      trapFocusKeydown(box, evt);
    });

    let touchStartX = null;
    const dialog = $('.lightbox__dialog', box);
    dialog.addEventListener('touchstart', (evt) => { touchStartX = evt.touches[0].clientX; }, { passive: true });
    dialog.addEventListener('touchend', (evt) => {
      if (touchStartX === null) return;
      const delta = evt.changedTouches[0].clientX - touchStartX;
      if (Math.abs(delta) > 40) stepLightbox(delta > 0 ? -1 : 1);
      touchStartX = null;
    }, { passive: true });
  }

  /* ================= FAQ ================= */
  function initFaq() {
    $$('.faq-item').forEach((item) => {
      const btn = $('button', item);
      const answer = $('.faq-item__answer', item);
      if (!btn || !answer) return;
      btn.addEventListener('click', () => {
        const isOpen = item.classList.contains('is-open');
        if (window.gsap && !prefersReduced()) {
          if (isOpen) {
            gsap.to(answer, { height: 0, duration: 0.35, ease: 'power2.inOut', onComplete: () => item.classList.remove('is-open') });
          } else {
            item.classList.add('is-open');
            gsap.fromTo(answer, { height: 0 }, { height: 'auto', duration: 0.4, ease: 'power2.out' });
          }
        } else {
          item.classList.toggle('is-open');
          answer.style.height = item.classList.contains('is-open') ? 'auto' : '0';
        }
        btn.setAttribute('aria-expanded', String(!isOpen));
      });
    });
  }

  /* ================= FLOATING CONTACT ================= */
  function initFloatingContact() {
    const toggle = $('#floatingToggle');
    const panel = $('#floatingPanel');
    if (!toggle || !panel) return;
    toggle.addEventListener('click', () => {
      const open = panel.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      if (window.gsap && !prefersReduced()) {
        gsap.to(panel, open
          ? { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: 'power2.out' }
          : { opacity: 0, y: 12, scale: 0.96, duration: 0.2, ease: 'power2.in' });
      }
    });
    document.addEventListener('click', (evt) => {
      if (!panel.classList.contains('is-open')) return;
      if (evt.target === toggle || toggle.contains(evt.target) || panel.contains(evt.target)) return;
      panel.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  }

  /* ================= SOCIAL CONFIG WIRING ================= */
  function initSocialConfig() {
    Object.keys(CONFIG.social).forEach((key) => {
      const url = CONFIG.social[key];
      if (!url) return;
      const gridEl = document.getElementById('social' + key.charAt(0).toUpperCase() + key.slice(1));
      if (gridEl) {
        const a = document.createElement('a');
        a.className = 'social-action';
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener';
        // Copy inner content without relying on innerHTML string replace
        Array.from(gridEl.childNodes).forEach((node) => a.appendChild(node.cloneNode(true)));
        // Replace the last arrow text if present
        const arrows = a.querySelectorAll('span:last-child');
        if (arrows.length) {
          const last = arrows[arrows.length - 1];
          last.textContent = '↗';
        }
        gridEl.replaceWith(a);
      }
      const floatEl = document.querySelector('.floating-contact__panel [data-social="' + key + '"]');
      if (floatEl && floatEl.tagName === 'SPAN') {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = floatEl.textContent.replace('(به‌زودی)', '').trim();
        floatEl.replaceWith(a);
      }
    });
  }

  /* ================= GUIDED TOUR ================= */
  function initGuidedTour() {
    const tour = $('#guidedTour');
    if (!tour) return;
    const steps = [
      { title: 'به کیان خوش آمدید', body: 'در چند قدم کوتاه، سایت کیان را معرفی می‌کنیم.' },
      { title: 'خدمات تخصصی', body: 'در بخش خدمات می‌توانید فهرست تعمیرات تخصصی را ببینید.' },
      { title: 'گالری واقعی', body: 'در گالری، نمونه‌هایی از فضای واقعی و فرآیند تعمیرات هست.' },
      { title: 'تماس مستقیم', body: 'برای تماس یا هماهنگی مراجعه، از بخش تماس استفاده کنید.' }
    ];
    let step = 0;
    const stepEl = $('#tourStep');
    const titleEl = $('#tourTitle');
    const bodyEl = $('#tourBody');
    const progressEl = $('#tourProgress');
    const prevBtn = $('#tourPrev');
    const nextBtn = $('#tourNext');

    function render() {
      const data = steps[step];
      titleEl.textContent = data.title;
      bodyEl.textContent = data.body;
      stepEl.textContent = `${String(step + 1).padStart(2, '0')} / ${String(steps.length).padStart(2, '0')}`;
      progressEl.style.width = `${((step + 1) / steps.length) * 100}%`;
      prevBtn.disabled = step === 0;
      nextBtn.textContent = step === steps.length - 1 ? 'پایان' : 'بعدی';
    }

    function open() {
      state.tourOpen = true;
      step = 0;
      render();
      tour.classList.add('is-open');
      openOverlay(tour);
    }
    function close() {
      state.tourOpen = false;
      tour.classList.remove('is-open');
      closeOverlay();
    }

    nextBtn.addEventListener('click', () => {
      if (step === steps.length - 1) { close(); return; }
      step += 1;
      render();
    });
    prevBtn.addEventListener('click', () => { if (step > 0) { step -= 1; render(); } });
    $('#tourSkip').addEventListener('click', close);
    $$('[data-tour-close]', tour).forEach((el) => el.addEventListener('click', close));
    tour.addEventListener('keydown', (evt) => {
      if (evt.key === 'Escape') { close(); return; }
      trapFocusKeydown(tour, evt);
    });

    window.KIAN = window.KIAN || {};
    window.KIAN.openTour = open;

    const openBtn = $('#tourOpenBtn');
    if (openBtn) openBtn.addEventListener('click', open);
  }

  /* ================= MISC ================= */
  function initBackToTop() {
    const btn = $('#backToTop');
    if (!btn) return;
    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: prefersReduced() ? 'auto' : 'smooth' });
    });
  }

  function initFooterYear() {
    const el = $('#footerYear');
    if (el) el.textContent = String(new Date().getFullYear());
  }

  /* ================= REVEAL FALLBACK (no GSAP) ================= */
  function revealFallback() {
    const items = $$('.reveal-item, .reveal-hero');
    if (!items.length) return;
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    items.forEach((el) => io.observe(el));
  }

  /* ================= GSAP-POWERED MOTION ================= */
  function initAnimations() {
    if (!window.gsap || !window.ScrollTrigger) {
      revealFallback();
      return;
    }
    gsap.registerPlugin(ScrollTrigger);
    document.documentElement.classList.add('js-gsap-ready');

    const runHero = () => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.to('.hero__eyebrow', { opacity: 1, y: 0, duration: 0.6 }, 0.05)
        .to('.hero__title', { opacity: 1, y: 0, duration: 0.9 }, 0.2)
        .to('.hero__lead', { opacity: 1, y: 0, duration: 0.8 }, 0.42)
        .to('.hero__actions', { opacity: 1, y: 0, duration: 0.7 }, 0.58)
        .to('.hero__local', { opacity: 1, y: 0, duration: 0.7 }, 0.68)
        .to('.hero__side', { opacity: 1, y: 0, duration: 0.8 }, 0.5);
    };
    document.addEventListener('kian:preloaderDone', runHero, { once: true });
    setTimeout(() => { if (!document.documentElement.classList.contains('hero-played')) { runHero(); document.documentElement.classList.add('hero-played'); } }, 3000);
    document.addEventListener('kian:preloaderDone', () => document.documentElement.classList.add('hero-played'), { once: true });

    if (!prefersReduced()) {
      gsap.to('.hero__image', { yPercent: 12, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
      gsap.to('.hero__grid', { yPercent: -8, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
      gsap.to('.hero__ambient--one', { x: 10, y: -8, duration: 8, ease: 'sine.inOut', repeat: -1, yoyo: true });
      gsap.to('.hero__ambient--two', { x: -8, y: 10, duration: 9, ease: 'sine.inOut', repeat: -1, yoyo: true });
    }

    ScrollTrigger.batch('.reveal-item', {
      start: 'top 88%',
      onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.8, stagger: 0.08, ease: 'power3.out', overwrite: true })
    });

    if (!prefersReduced()) {
      $$('[data-parallax-classic]').forEach((el) => {
        gsap.to(el.querySelector('img'), { yPercent: 6, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
      });
    }

    $$('.image-frame img, .portrait-frame img').forEach((img) => {
      gsap.fromTo(img, { clipPath: 'inset(0 0 100% 0)' }, {
        clipPath: 'inset(0 0 0% 0)', duration: 1.1, ease: 'power3.inOut',
        scrollTrigger: { trigger: img, start: 'top 85%' }
      });
    });

    $$('[data-scanline]').forEach((line) => {
      gsap.fromTo(line, { top: '4%', opacity: 0 }, {
        top: '92%', opacity: 0.5, duration: 3.4, ease: 'power1.inOut',
        scrollTrigger: { trigger: line.closest('.specialized'), start: 'top 60%', once: true }
      });
    });

    ScrollTrigger.matchMedia({
      '(min-width: 821px)': () => {
        gsap.to('#processLine', {
          scaleX: 1, ease: 'none',
          scrollTrigger: { trigger: '#processTimeline', start: 'top 75%', end: 'bottom 60%', scrub: true }
        });
      },
      '(max-width: 820px)': () => {
        gsap.to('#processLine', {
          scaleY: 1, ease: 'none',
          scrollTrigger: { trigger: '#processTimeline', start: 'top 80%', end: 'bottom 70%', scrub: true }
        });
      }
    });

    $$('.process-step').forEach((step) => {
      ScrollTrigger.create({
        trigger: step, start: 'top 65%', end: 'bottom 35%',
        onEnter: () => step.classList.add('is-active'),
        onLeaveBack: () => step.classList.remove('is-active')
      });
    });

    ScrollTrigger.refresh();
  }

  /* ================= INIT ================= */
  function init() {
    initImageFallbacks();
    initPreloader();
    initHeader();
    initActiveNav();
    initMobileMenu();
    initCursor();
    initScrollProgress();
    initLiveStatus();
    initServices();
    initGallery();
    initLightbox();
    initFaq();
    initFloatingContact();
    initSocialConfig();
    initGuidedTour();
    initBackToTop();
    initFooterYear();
    initAnimations();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
