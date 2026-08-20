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
  let fullH = 0;
  let expandedH = 0;

  // Cached on load/resize only — never re-measured inside onUpdate,
  // which runs on every scroll tick and would otherwise force a
  // layout read (thrash) on each frame. fullH comes from the viewport,
  // not the container's own box: pre-pin the container is intentionally
  // only as tall as its three collapsed cards (420px), so measuring
  // itself wouldn't give the screen-filling target height.
  function measure() {
    fullH = window.innerHeight - getNavHeight();
    expandedH = fullH - 2 * collapsedH;
  }

  let activeIndex = -1; // -1 = collapsed (approach, or collapsed-while-pinned)
  let isAnimating = false;
  // Whether ScrollTrigger currently has the section pinned. Height is
  // keyed off this, not off activeIndex: activeIndex is -1 both before
  // the pin engages (normal doc flow, container should be a tight
  // 420px wrap) AND for an instant right as the pin engages/releases
  // (still fixed in a full-viewport frame). Sizing the container off
  // activeIndex alone left that second case at only 420px tall while
  // pinned, exposing the rest of the fixed frame as bare page
  // background — the "yellow block" under the collapsed cards.
  let pinned = false;

  function applyHeights(instant) {
    gsap.set(container, {
      height: pinned ? fullH : "auto",
      // Docks the flush collapsed stack against the bottom edge when
      // collapsed; once a card is expanding, anchor from the top so it
      // fills down.
      justifyContent: activeIndex === -1 ? "flex-end" : "flex-start",
    });

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
  applyHeights(true); // Initial state: all three cards collapsed, tight stack (approach mode).

  function goToStep(index) {
    if (index < -1 || index > 2 || index === activeIndex) return;
    // Exiting to -1 (onLeave/onLeaveBack) must always take effect, even
    // mid-tween on a fast scroll, so the stack never gets stuck full-screen
    // past the footer boundary — overwrite: "auto" on the tweens below
    // handles cutting off whatever was still in flight.
    if (isAnimating && index !== -1) return;
    isAnimating = true;
    activeIndex = index;
    applyHeights(false);
  }

  ScrollTrigger.create({
    trigger: ".stack-section",
    start: "top top+=" + getNavHeight(),
    end: "+=2000",
    pin: true,
    scrub: false,
    preventOverlaps: true,
    fastScrollEnd: true,
    onUpdate: (self) => {
      const progress = self.progress;
      if (progress <= 0) {
        goToStep(-1); // At/above the pin start, keep all collapsed.
      } else if (progress < 0.33) {
        goToStep(0);
      } else if (progress < 0.66) {
        goToStep(1);
      } else {
        goToStep(2);
      }
    },
    onEnter: () => {
      // Pin just engaged while still collapsed (activeIndex is unchanged
      // at -1, so goToStep would no-op) — force the container to the
      // full pinned frame so the collapsed dock has no exposed
      // background behind/below it.
      pinned = true;
      applyHeights(true);
    },
    onEnterBack: () => {
      pinned = true;
      applyHeights(true);
    },
    onLeave: () => {
      // Past the pin: unpin cleanly into a tight compact stack directly
      // above the footer, cards collapsed.
      pinned = false;
      goToStep(-1);
    },
    onLeaveBack: () => {
      // Scrolled back above the pin: reset to approach state.
      pinned = false;
      goToStep(-1);
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
