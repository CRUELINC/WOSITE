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
  // Cards 2 and 3 have a -24px margin-top (see .stack-card:nth-child(2/3)
  // in style.css) so they physically overlap the card above them, like a
  // layered deck. That shrinks the real on-screen height of both the
  // collapsed 3-card stack and any expanded frame by one overlap per seam.
  const overlap = 24;
  const collapsedTotalH = collapsedH * 3 - overlap * 2;
  let fullH = 0;
  let expandedH = 0;
  // How far the container needs to slide up, once any card is
  // expanding, to keep its bottom edge anchored at the same screen
  // position it had while collapsed. The pin engages as early as
  // possible — the instant the collapsed 420px stack would first sit
  // flush at the bottom of the viewport — so GSAP fixes the section at
  // that (low) natural position. Growing the container to fullH from
  // there would just overflow off the bottom of the screen unless we
  // also shift it up by the height delta, which is what this offset is.
  let expandedShiftY = 0;

  // Cached on load/resize only — never re-measured inside onUpdate,
  // which runs on every scroll tick and would otherwise force a
  // layout read (thrash) on each frame. fullH comes from the viewport,
  // not the container's own box: while collapsed, the container is
  // intentionally only as tall as the three overlapping cards
  // (collapsedTotalH).
  function measure() {
    fullH = window.innerHeight - getNavHeight();
    expandedH = fullH - 2 * (collapsedH - overlap);
    expandedShiftY = -(fullH - collapsedTotalH);
  }

  let activeIndex = -1; // -1 = collapsed (approach, collapsed-while-pinned, or exited)
  let isAnimating = false;

  function applyHeights(instant) {
    // Always an explicit pixel height, pinned or not: Card 3 has no
    // height of its own (flex: 1 1 0, see style.css) and fills whatever
    // the container doesn't otherwise use, but a flex-grow item with a
    // zero basis only grows into a *definite*-size container. Sizing
    // this to "auto" while unpinned (as a previous version did) left
    // nothing for Card 3 to grow into, so it silently collapsed to 0
    // height and vanished. Whether we're actually pinned right now
    // doesn't change what the container's height/position should be —
    // only whether any card is expanded does (activeIndex !== -1),
    // including the moment right after unpinning, where activeIndex is
    // deliberately left at 2 so Card 3 stays fully expanded (there's no
    // onLeave handler resetting it — see the ScrollTrigger config below).
    const expanding = activeIndex !== -1;
    const targetContainerH = expanding ? fullH : collapsedTotalH;
    const targetY = expanding ? expandedShiftY : 0;

    if (instant) {
      gsap.set(container, { height: targetContainerH, y: targetY });
    } else {
      gsap.to(container, {
        height: targetContainerH,
        y: targetY,
        duration: 0.4,
        ease: "power3.out",
        overwrite: "auto",
      });
    }

    // Card 3 (index 2) is never tweened directly — it's the sole
    // flex-grow item (see .stack-card:nth-child(3) in style.css), so it
    // always fills whatever space cards 1/2 leave behind and its bottom
    // edge never moves. Only cards 0 and 1 have an explicit height.
    [cards[0], cards[1]].forEach((card, i) => {
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
    start: "top bottom-=" + collapsedTotalH,
    end: "+=2000",
    pin: true,
    pinSpacing: true,
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
    // No onLeave: leave Card 3 fully expanded and let the footer scroll
    // up over it naturally, instead of shrinking it back to collapsed
    // here (which revealed bare background before the footer actually
    // arrived).
    onLeaveBack: () => {
      // Scrolled back above the pin: reset to approach state.
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

  // This runs on DOMContentLoaded, before images/video/fonts have
  // necessarily finished loading — if any of those shift the page's
  // layout afterward, ScrollTrigger's cached trigger position goes
  // stale and the pin can engage at the wrong scroll offset, which
  // also reads as a snap. Refresh once now and again once everything
  // has actually loaded.
  ScrollTrigger.refresh();
  window.addEventListener("load", () => {
    measure();
    applyHeights(true);
    ScrollTrigger.refresh();
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
