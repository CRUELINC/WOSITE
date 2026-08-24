// ============================================================
// WEST OF SPADINA — shared behaviour (static, no scroll animation)
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initNavContrast();
  initFaq();
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

/* ---------------- NAV CONTRAST ----------------
   The nav has no background of its own, so its logo/links switch to
   white whenever a dark section (video, footer) sits behind it. */

function initNavContrast() {
  const nav = document.getElementById("siteNav");
  if (!nav) return;

  const darkSections = document.querySelectorAll(".card--tickets, .site-footer");
  if (!darkSections.length) return;

  const logo = nav.querySelector(".nav__logo img");
  const active = new Set();

  const setState = (isDark) => {
    nav.classList.toggle("nav--on-dark", isDark);
    if (logo) {
      logo.src = isDark
        ? "assets/img/wos-wordmark-white.webp"
        : "assets/img/wos-wordmark-black.webp";
    }
  };

  let observer;

  const build = () => {
    if (observer) observer.disconnect();
    active.clear();
    const navH = nav.offsetHeight;
    const bottomMargin = Math.max(window.innerHeight - navH - 1, 0);
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) active.add(entry.target);
          else active.delete(entry.target);
        });
        setState(active.size > 0);
      },
      { rootMargin: `-${navH}px 0px -${bottomMargin}px 0px`, threshold: 0 }
    );
    darkSections.forEach((el) => observer.observe(el));
  };

  build();
  window.addEventListener("resize", build);
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
