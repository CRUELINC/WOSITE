// ============================================================
// WEST OF SPADINA — shared behaviour
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initFaq();
  initCardToggle();
  initCardArtScroll();
  initTicketsCardVideo();
  initCountdown();
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

/* ---------------- CARD ART SCROLL-LINK ----------------
   Day/Night's artwork strip (.bar__art-track, repeated 4x in the
   markup) drifts continuously at a fixed speed -- left-to-right by
   default, right-to-left while the page is being scrolled up --
   rather than tracking scroll delta 1:1 (which made it move exactly
   as fast, and only as far, as the user's own scroll gesture).
   Scroll direction only flips which way the constant drift runs; it
   doesn't change its speed.

   Each track's transform is `m - phase`, where phase is half a single
   repeat's width and m is (offset + phase) wrapped into [0, repeatWidth)
   -- offset itself is unbounded (it just accumulates forever), but
   re-centering the wrap around `phase` rather than 0 keeps the wrap
   point a full half-repeat away from the resting position, so the
   reset never lands near where the page actually is at rest. Because
   the track repeats every repeatWidth px, jumping by a whole
   repeatWidth at the wrap point is pixel-identical to not jumping at
   all -- that's what makes it invisible. */

function initCardArtScroll() {
  const tracks = Array.from(document.querySelectorAll(".bar__art-track"));
  if (!tracks.length) return;

  const state = tracks.map((track) => ({ track, repeatWidth: 0, offset: 0 }));

  function measure() {
    state.forEach((s) => {
      s.repeatWidth = s.track.scrollWidth / 4;
    });
  }
  measure();
  window.addEventListener("load", measure);
  window.addEventListener("resize", measure);

  const PX_PER_SECOND = 24;
  let direction = 1; // 1 = left-to-right (default/scrolling down), -1 = right-to-left (scrolling up)
  let lastY = window.scrollY;

  function onScroll() {
    const y = window.scrollY;
    const deltaY = y - lastY;
    lastY = y;
    if (deltaY < 0) direction = -1;
    else if (deltaY > 0) direction = 1;
  }

  window.addEventListener("scroll", onScroll, { passive: true });

  let lastTime = performance.now();

  function tick(now) {
    const dt = Math.min(now - lastTime, 100) / 1000;
    lastTime = now;

    state.forEach((s) => {
      if (!s.repeatWidth) return;
      s.offset += direction * PX_PER_SECOND * dt;
      const phase = s.repeatWidth / 2;
      const m = (((s.offset + phase) % s.repeatWidth) + s.repeatWidth) % s.repeatWidth;
      s.track.style.transform = `translateX(${m - phase}px)`;
    });

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
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
