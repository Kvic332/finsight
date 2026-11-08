// FinSight website: menu, hero slider, reveal on scroll, waitlist sign-up.

// Waitlist emails go to the `waitlist` table in FinSight's Supabase project.
// The key below is the publishable (public) key; the table only allows inserts.
const SUPABASE_URL = 'https://otahfeuhnivowowkeolt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_SzymkXd1l0XX9ecayq1nNA_EBy9A6n2';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });

// ── Mobile menu ─────────────────────────────────────────────
const menuBtn = document.querySelector('.menu-btn');
const nav = document.getElementById('nav');
if (menuBtn && nav) {
  menuBtn.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', String(open));
  });
  const closeMenu = () => { nav.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); };
  nav.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
  // Escape or a tap outside the menu closes it.
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && nav.classList.contains('open')) { closeMenu(); menuBtn.focus(); }
  });
  document.addEventListener('click', e => {
    if (nav.classList.contains('open') && !nav.contains(e.target) && !menuBtn.contains(e.target)) closeMenu();
  });
}

// ── Hero slider ─────────────────────────────────────────────
const slider = document.querySelector('.slider');
if (slider) {
  const slides = [...slider.querySelectorAll('.slide')];
  const dotsBox = slider.querySelector('.dots');
  const ms = parseInt(getComputedStyle(slider).getPropertyValue('--slide-ms'), 10) || 7000;
  let index = 0;
  let timer = null;
  let paused = false;

  const dots = slides.map((_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-label', `Slide ${i + 1}`);
    b.innerHTML = '<span></span>';
    b.addEventListener('click', () => go(i, true));
    dotsBox.appendChild(b);
    return b;
  });

  function show(i) {
    slides.forEach((s, n) => {
      const on = n === i;
      s.classList.toggle('active', on);
      s.setAttribute('aria-hidden', on ? 'false' : 'true');
      s.querySelectorAll('a').forEach(a => { if (on) a.removeAttribute('tabindex'); else a.setAttribute('tabindex', '-1'); });
    });
    dots.forEach((d, n) => {
      d.classList.remove('active');
      d.setAttribute('aria-selected', n === i ? 'true' : 'false');
    });
    // Restart the progress bar animation on the active dot.
    void dots[i].offsetWidth;
    dots[i].classList.add('active');
  }

  function schedule() {
    clearTimeout(timer);
    if (reduceMotion || paused) return;
    timer = setTimeout(() => go(index + 1), ms);
  }

  function go(i, manual) {
    index = (i + slides.length) % slides.length;
    show(index);
    if (manual) paused = false;
    schedule();
  }

  function setPaused(p) {
    paused = p;
    slider.classList.toggle('paused', p);
    if (p) clearTimeout(timer); else schedule();
  }

  slider.querySelector('[data-prev]').addEventListener('click', () => go(index - 1, true));
  slider.querySelector('[data-next]').addEventListener('click', () => go(index + 1, true));
  slider.addEventListener('mouseenter', () => setPaused(true));
  slider.addEventListener('mouseleave', () => setPaused(false));
  slider.addEventListener('focusin', () => setPaused(true));
  slider.addEventListener('focusout', e => { if (!slider.contains(e.relatedTarget)) setPaused(false); });
  document.addEventListener('visibilitychange', () => setPaused(document.hidden));

  // Swipe on phones.
  let startX = null;
  slider.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  slider.addEventListener('touchend', e => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1), true);
    startX = null;
  });

  if (reduceMotion) slider.classList.add('paused');
  show(0);
  schedule();
}

// ── Reveal on scroll ────────────────────────────────────────
const revealEls = document.querySelectorAll('[data-reveal]');
if (!reduceMotion && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('in'); io.unobserve(entry.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  revealEls.forEach((el, i) => {
    el.classList.add('reveal');
    el.style.transitionDelay = `${(i % 3) * 80}ms`;
    io.observe(el);
  });
}

// ── Waitlist ────────────────────────────────────────────────
document.querySelectorAll('form[data-waitlist]').forEach(form => {
  const msg = form.nextElementSibling;
  const button = form.querySelector('button');
  const say = (text, kind) => { msg.textContent = text; msg.className = 'form-msg ' + (kind || ''); };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email = form.email.value.trim().toLowerCase();
    if (form.company.value) return; // a bot filled the hidden field
    if (!EMAIL_RE.test(email)) { say('Please enter a valid email address.', 'err'); form.email.focus(); return; }

    button.disabled = true;
    say('Adding you…');
    try {
      const res = await fetch(SUPABASE_URL + '/rest/v1/waitlist', {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ email, source: location.pathname }),
      });
      // 409 means the email is already on the list, which is fine.
      if (res.ok || res.status === 409) {
        form.reset();
        say("You're on the list. We'll email you when FinSight is on Google Play.", 'ok');
      } else {
        throw new Error('HTTP ' + res.status);
      }
    } catch {
      say("That didn't go through. Please check your connection and try again.", 'err');
    } finally {
      button.disabled = false;
    }
  });
});
