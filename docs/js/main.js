// ============================================================
// WEST OF SPADINA — shared behaviour (static, no scroll animation)
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initNavContrast();
  initVideoSection();
  initCountdown();
  initFaq();
  initGSAPCardStack();
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

  const darkSections = document.querySelectorAll(".event-stack__countdown, .site-footer");
  if (!darkSections.length) return;

  const logo = nav.querySelector(".nav__logo img");
  const active = new Set();

  const setState = (isDark) => {
    nav.classList.toggle("nav--on-dark", isDark);
    if (logo) {
      logo.src = isDark
        ? "assets/img/wos-wordmark-white.png"
        : "assets/img/wos-wordmark-black.png";
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

/* ---------------- GSAP CARD STACK ----------------
   .stack-section is pinned by ScrollTrigger for a fixed scroll
   distance. Rather than continuously scrubbing card heights to
   pixel scroll position (which fights for control against any
   CSS transition and reads as stutter), scroll progress inside
   the pin is bucketed into 3 discrete steps, and each step change
   fires one clean GSAP tween straight to the target heights.
   .hero-section above it is a normal, unpinned full-height section
   that scrolls off before the pin engages. */

function getNavHeight() {
  return (
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--nav-h")
    ) || 0
  );
}

function initGSAPCardStack() {
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") {
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  // Prevents a burst of catch-up frames (and the resulting jank) if the
  // tab was backgrounded or the main thread stalled right as the user
  // scrolled into the pinned section.
  gsap.ticker.lagSmoothing(1000, 16);

  const container = document.querySelector(".stack-container");
  const cards = document.querySelectorAll(".stack-card");
  if (!container || cards.length !== 3) return;

  const collapsedH = 140;
  let containerH = 0;
  let expandedH = 0;

  // Cached on load/resize only — never re-measured inside onUpdate,
  // which runs on every scroll tick and would otherwise force a
  // layout read (thrash) on each frame.
  function measure() {
    containerH = container.getBoundingClientRect().height;
    expandedH = containerH - 2 * collapsedH;
  }

  let activeIndex = 0; // Card 1 (Yellow/Day) starts expanded — matches the pinned entry frame
  let isAnimating = false;

  function applyHeights(instant) {
    cards.forEach((card, i) => {
      const targetH = i === activeIndex ? expandedH : collapsedH;
      if (instant) {
        gsap.set(card, { height: targetH });
      } else {
        gsap.to(card, {
          height: targetH,
          duration: 0.4,
          ease: "power3.out",
          overwrite: "auto",
          onComplete: () => {
            isAnimating = false;
          },
        });
      }
    });
  }

  measure();
  applyHeights(true); // Initial state: Yellow expanded, Pink & Countdown collapsed/peeking.

  function goToStep(index) {
    if (index < 0 || index > 2 || index === activeIndex || isAnimating) return;
    isAnimating = true;
    activeIndex = index;
    applyHeights(false);
  }

  ScrollTrigger.create({
    trigger: ".stack-section",
    start: "top top+=" + getNavHeight(),
    end: "+=2400", // runway buffer so Card 3 finishes expanding well before unpin
    pin: true,
    scrub: false,
    anticipatePin: 1,
    onUpdate: (self) => {
      const progress = self.progress;
      // Step 2 triggers earlier (0.60) so it has a hold buffer before
      // the section unpins at progress 1, instead of animating right
      // up to the unpin boundary and snapping mid-tween.
      if (progress < 0.3) {
        goToStep(0);
      } else if (progress < 0.6) {
        goToStep(1);
      } else {
        goToStep(2);
      }
    },
  });

  // Debounced: re-measure and reapply the current step's heights on
  // resize, then let ScrollTrigger recalculate pin/pixel boundaries
  // against the new layout.
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      measure();
      applyHeights(true);
      ScrollTrigger.refresh();
    }, 200);
  });
}

/* ---------------- VIDEO SECTION ----------------
   Muted/looped background video, paused while off-screen (playback
   control, not a decorative animation). */

function initVideoSection() {
  document.querySelectorAll(".event-stack__countdown video").forEach((video) => {
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
      { threshold: 0.15 }
    );
    observer.observe(video);
  });
}

/* ---------------- COUNTDOWN ---------------- */

function initCountdown() {
  const el = document.querySelector("[data-countdown]");
  if (!el) return;

  const target = new Date(el.dataset.countdown).getTime();
  const dEl = el.querySelector("[data-days]");
  const hEl = el.querySelector("[data-hours]");
  const mEl = el.querySelector("[data-minutes]");
  const sEl = el.querySelector("[data-seconds]");

  function tick() {
    const diff = Math.max(0, target - Date.now());
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    if (dEl) dEl.textContent = String(days).padStart(2, "0");
    if (hEl) hEl.textContent = String(hours).padStart(2, "0");
    if (mEl) mEl.textContent = String(minutes).padStart(2, "0");
    if (sEl) sEl.textContent = String(seconds).padStart(2, "0");
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
