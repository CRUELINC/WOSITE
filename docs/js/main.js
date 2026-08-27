// ============================================================
// WEST OF SPADINA — shared behaviour
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initFaq();
  initCardToggle();
  initTicketsCardVideo();
  initCountdown();
  initStickyCtaContrast();
});

/* ---------------- SPONSOR CAROUSELS ----------------
   Both marquees are driven by an `animation: ... linear infinite`
   that starts counting from navigation start, not from whenever the
   browser actually gets around to rendering it. On a busy initial
   load (parsing, images decoding, fonts swapping in) the animation
   keeps accumulating elapsed time on that timeline even while frames
   are being dropped, so once the page settles it visibly jumps ahead
   to catch up -- reading as "slow, then suddenly fast" on a cold
   load, and not happening on a warm one (e.g. after the screen wakes
   from sleep, when everything's already decoded). Holding both tracks
   paused until the window's load event, then starting them fresh,
   means their timeline only ever begins once the page is idle. */
window.addEventListener("load", () => {
  document.body.classList.add("carousels-ready");
});

/* ---------------- NAV ---------------- */

function initNav() {
  const nav = document.getElementById("siteNav");
  if (!nav) return;

  const burger = nav.querySelector(".nav__burger");
  const links = nav.querySelector(".nav__links");
  if (burger && links) {
    burger.addEventListener("click", () => {
      const open = links.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", String(open));
    });
    links.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => links.classList.remove("is-open"))
    );
  }
}

/* ---------------- STACK CARD EXPAND/COLLAPSE ----------------
   Replaces the old hover-to-expand interaction: each card's +/-
   button toggles .is-expanded (driving the height/reveal transitions
   in CSS) independently of the others. */

function initCardToggle() {
  document.querySelectorAll(".bar__toggle").forEach((btn) => {
    const card = btn.closest(".stack-card");
    if (!card) return;

    btn.addEventListener("click", () => {
      const expanded = card.classList.toggle("is-expanded");
      btn.setAttribute("aria-expanded", String(expanded));
    });
  });
}

/* ---------------- TICKETS CARD VIDEO ----------------
   Plays continuously (collapsed and hover-expanded alike) while any
   part of the card is on screen, and pauses once it scrolls out of
   view — playback control, not gated behind hover, but still not
   decoding frames for the large stretches of a visit where the card
   isn't visible at all. */

function initTicketsCardVideo() {
  const card = document.querySelector(".card--tickets");
  const video = card && card.querySelector("video");
  if (!video) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    },
    { threshold: 0.1 }
  );
  observer.observe(card);
}

/* ---------------- COUNTDOWN ---------------- */

function initCountdown() {
  const els = document.querySelectorAll("[data-countdown]");
  if (!els.length) return;

  const timers = Array.from(els).map((el) => ({
    target: new Date(el.dataset.countdown).getTime(),
    dEl: el.querySelector("[data-days]"),
    hEl: el.querySelector("[data-hours]"),
    mEl: el.querySelector("[data-minutes]"),
    sEl: el.querySelector("[data-seconds]"),
  }));

  function tick() {
    const now = Date.now();
    timers.forEach(({ target, dEl, hEl, mEl, sEl }) => {
      const diff = Math.max(0, target - now);
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      if (dEl) dEl.textContent = String(days).padStart(2, "0");
      if (hEl) hEl.textContent = String(hours).padStart(2, "0");
      if (mEl) mEl.textContent = String(minutes).padStart(2, "0");
      if (sEl) sEl.textContent = String(seconds).padStart(2, "0");
    });
  }

  tick();
  setInterval(tick, 1000);
}

/* ---------------- STICKY CTA CONTRAST ----------------
   The fixed "Get Tickets" button is yellow so it reads clearly over
   the site's mostly-light background, but the Day card and the
   footer are that same yellow -- the button would disappear into
   them. Swap it to pink for as long as it's sitting over a yellow
   section, using plain rect overlap checks (cheap, and avoids the
   IntersectionObserver rootMargin gymnastics a viewport-edge trigger
   like this would otherwise need). */

function initStickyCtaContrast() {
  const cta = document.querySelector(".hero__sticky-cta");
  const yellowEls = document.querySelectorAll(".bar--free, .site-footer");
  if (!cta || !yellowEls.length) return;

  function check() {
    const ctaRect = cta.getBoundingClientRect();
    const overYellow = Array.from(yellowEls).some((el) => {
      const r = el.getBoundingClientRect();
      return ctaRect.bottom > r.top && ctaRect.top < r.bottom;
    });
    cta.classList.toggle("hero__sticky-cta--pink", overYellow);
  }

  check();
  window.addEventListener("scroll", check, { passive: true });
  window.addEventListener("resize", check);
}

/* ---------------- FAQ ACCORDION ---------------- */

function initFaq() {
  const items = document.querySelectorAll(".faq-item");
  items.forEach((item) => {
    const btn = item.querySelector(".faq-item__q");
    const answer = item.querySelector(".faq-item__a");
    if (!btn || !answer) return;

    btn.addEventListener("click", () => {
      const isOpen = item.classList.contains("is-open");
      items.forEach((other) => {
        other.classList.remove("is-open");
        other.querySelector(".faq-item__a").style.maxHeight = null;
      });
      if (!isOpen) {
        item.classList.add("is-open");
        answer.style.maxHeight = answer.scrollHeight + "px";
      }
    });
  });
}
