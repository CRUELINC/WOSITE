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
  // The -1 ("nothing expanded") state uses a completely different
  // layout from the expanded states: Day/Night side by side, Video as
  // a full-width bar underneath — not the vertical overlapping deck.
  const rowDayNightH = 180;
  const rowVideoH = 100;
  const collapsedTotalH = rowDayNightH + rowVideoH;
  let fullH = 0;
  let expandedH = 0;
  // How far the container needs to slide up, once any card is
  // expanding, to keep its bottom edge anchored at the same screen
  // position it had while collapsed. The pin engages as early as
  // possible — the instant the collapsed (row-layout) stack would
  // first sit flush at the bottom of the viewport — so GSAP fixes the
  // section at that (low) natural position. Growing the container to
  // fullH from there would just overflow off the bottom of the screen
  // unless we also shift it up by the height delta, which is what this
  // offset is.
  let expandedShiftY = 0;

  // Cached on load/resize only — never re-measured inside onUpdate,
  // which runs on every scroll tick and would otherwise force a
  // layout read (thrash) on each frame. fullH comes from the viewport,
  // not the container's own box: while collapsed, the container is
  // intentionally only as tall as the row layout (collapsedTotalH).
  function measure() {
    fullH = window.innerHeight - getNavHeight();
    expandedH = fullH - 2 * (collapsedH - overlap);
    expandedShiftY = -(fullH - collapsedTotalH);
  }

  let activeIndex = -1; // -1 = collapsed (approach, collapsed-while-pinned, or exited)
  let isAnimating = false;
  // The container and the two tweened cards used to animate as three
  // independent gsap.to() calls, each with its own overwrite: "auto".
  // On a slow, hesitant scroll that flips direction near a step
  // threshold, goToStep() can fire again before the previous tween
  // finishes, and "auto" only overwrites conflicting tweens on the
  // *same* target — so the container's tween could get interrupted/
  // restarted independently of the cards' tweens (or vice versa),
  // leaving them settled at different points: cards fully collapsed
  // to 140px while the container was still mid-tween at a much taller
  // height, showing as blank space above the cards. Driving all three
  // off one timeline makes them start, restart, and complete as a
  // single atomic unit.
  let heightTimeline = null;

  // Lays out cards 0/1 (Day/Night) side by side and card 2 (Video) as a
  // full-width bar underneath, for the -1 ("nothing expanded") state.
  // Row/column direction and each card's width/margin/flex role can't
  // be smoothly tweened between this and the vertical deck layout below
  // (flex-direction isn't animatable, and a mid-morph width/direction
  // change reads as broken rather than smooth either way) — set
  // instantly, always, even when the height/position change around it
  // animates.
  function applyRowLayout() {
    // .bar__meta/.bar__title are sized with viewport-width-based
    // clamp()s (see style.css) tuned for a full-width card — at 50%
    // width they overflow/overlap. This class scopes smaller sizing
    // to just this layout; it's a plain CSS class (no !important),
    // so it doesn't fight any of the inline styles GSAP sets above.
    container.classList.add("is-row-collapsed");
    gsap.set(container, { flexDirection: "row", flexWrap: "wrap" });
    gsap.set(cards[0], {
      width: "50%",
      height: rowDayNightH,
      marginTop: 0,
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: "auto",
    });
    gsap.set(cards[1], {
      width: "50%",
      height: rowDayNightH,
      marginTop: 0,
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: "auto",
    });
    gsap.set(cards[2], {
      width: "100%",
      height: rowVideoH,
      // CSS gives Card 3 a min-height: 140px floor (defense against an
      // earlier bug where it could collapse to 0 in the column layout)
      // — override it here or it'd force this 100px bar up to 140px.
      minHeight: rowVideoH,
      marginTop: 0,
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: "auto",
    });
  }

  // Restores the vertical overlapping-deck layout used by every
  // expanded (0/1/2) state — see the .stack-card CSS comments for how
  // Card 3's flex-grow fill works.
  function applyColumnLayout() {
    container.classList.remove("is-row-collapsed");
    gsap.set(container, { flexDirection: "column", flexWrap: "nowrap" });
    gsap.set(cards[0], { width: "100%", marginTop: 0, flexGrow: 0, flexShrink: 0, flexBasis: "auto" });
    gsap.set(cards[1], { width: "100%", marginTop: -overlap, flexGrow: 0, flexShrink: 0, flexBasis: "auto" });
    gsap.set(cards[2], {
      width: "100%",
      marginTop: -overlap,
      height: "auto",
      minHeight: collapsedH,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
    });
  }

  function applyHeights(instant) {
    // Whether we're pinned or not doesn't change what the container's
    // height/position should be — only whether any card is expanded
    // does (activeIndex !== -1), including the moment right after
    // unpinning, where activeIndex is deliberately left at 2 so Card 3
    // stays fully expanded (there's no onLeave handler resetting it —
    // see the ScrollTrigger config below).
    const expanding = activeIndex !== -1;
    const targetContainerH = expanding ? fullH : collapsedTotalH;
    const targetY = expanding ? expandedShiftY : 0;

    // Always tear down whatever was previously in flight before
    // setting new values/starting a new tween, so a rapid direction
    // change can never leave the container and cards mid-transition
    // against two different old targets.
    if (heightTimeline) {
      heightTimeline.kill();
      heightTimeline = null;
    }

    if (instant) {
      // Instant: safe to swap the row/column layout and set the final
      // size together — no intermediate frame is ever rendered, so
      // there's no window where they could be out of sync.
      if (expanding) {
        applyColumnLayout();
      } else {
        applyRowLayout();
      }
      gsap.set(container, { height: targetContainerH, y: targetY });
      // Card 3 (index 2) is never tweened directly in the expanded
      // (column) layout — it's the sole flex-grow item there, so it
      // always fills whatever space cards 1/2 leave behind and its
      // bottom edge never moves. In the row layout all three cards
      // already got their fixed size from applyRowLayout() above.
      if (expanding) {
        [cards[0], cards[1]].forEach((card, i) => {
          gsap.set(card, { height: i === activeIndex ? expandedH : collapsedH });
        });
      }
      return;
    }

    // Animated: row<->column can't itself be tweened, so one side of
    // this transition has to snap discretely — but WHEN it snaps
    // matters. Row->column (expanding) snaps immediately, so the
    // height tween below plays out within the correct (vertical) form
    // from the first frame. Column->row (collapsing) is the opposite:
    // snapping the cards to their tiny final row size immediately,
    // while the container is still mid-tween shrinking from a much
    // taller height, left them sitting inside a box far bigger than
    // their own content for the whole 0.4s — a big gap around them.
    // Deferring the snap to onComplete instead keeps the cards in
    // their current (larger) form, simply clipped by the container's
    // overflow: hidden as it shrinks, matching how every other
    // collapse in this component already looks — then swaps to the
    // correct row layout in the same instant the container finishes
    // shrinking to meet it.
    if (expanding) {
      applyColumnLayout();
    }

    heightTimeline = gsap.timeline({
      onComplete: () => {
        if (!expanding) {
          applyRowLayout();
        }
        isAnimating = false;
        heightTimeline = null;
      },
    });
    heightTimeline.to(container, { height: targetContainerH, y: targetY, duration: 0.4, ease: "power3.out" }, 0);
    if (expanding) {
      [cards[0], cards[1]].forEach((card, i) => {
        const targetH = i === activeIndex ? expandedH : collapsedH;
        heightTimeline.to(card, { height: targetH, duration: 0.4, ease: "power3.out" }, 0);
      });
    }
  }

  measure();
  applyHeights(true); // Initial state: all three cards collapsed, tight stack (approach mode).

  function goToStep(index) {
    if (index < -1 || index > 2 || index === activeIndex) return;
    // Exiting to -1 (onLeave/onLeaveBack) must always take effect, even
    // mid-tween on a fast scroll, so the stack never gets stuck full-screen
    // past the footer boundary — applyHeights() kills whatever timeline
    // was still in flight before starting the new one.
    if (isAnimating && index !== -1) return;
    isAnimating = true;
    activeIndex = index;
    applyHeights(false);
  }

  // The pin's own scroll distance for the 3 expand steps.
  const stepDistance = 2000;

  // GSAP's pin-spacer reserves scroll room based on the section's
  // *collapsed* height (collapsedTotalH) at refresh time, plus the pin's
  // scroll distance — it has no idea the pin visually grows up to fullH
  // via our translateY trick. That gap between "reserved" and "visually
  // reached" only matters at the moment of unpinning: if we were still
  // expanded right up until onLeave, the section would hand off from
  // "pinned at fullH, nav-anchored" straight into normal flow sized for
  // collapsedTotalH, landing in the wrong spot with no continuity.
  //
  // The fix: extend the pin by exactly that gap (collapseDistance) and
  // spend it on a smooth, *animated* collapse back to collapsedTotalH
  // while STILL pinned — mirroring how the very first expand (step 0)
  // animates smoothly because both its start and end states are pinned.
  // By the real end of the pin, the section is already collapsed and
  // already sitting where collapsedTotalH naturally rests, so handing
  // off to normal flow is seamless.
  function getTotalDistance() {
    return stepDistance + Math.abs(expandedShiftY);
  }

  ScrollTrigger.create({
    trigger: ".stack-section",
    start: "top bottom-=" + collapsedTotalH,
    end: () => "+=" + getTotalDistance(),
    pin: true,
    pinSpacing: true,
    scrub: false,
    preventOverlaps: true,
    fastScrollEnd: true,
    onUpdate: (self) => {
      const px = self.progress * getTotalDistance();
      if (px <= 0) {
        goToStep(-1); // At/above the pin start, keep all collapsed.
      } else if (px < stepDistance * 0.33) {
        goToStep(0);
      } else if (px < stepDistance * 0.66) {
        goToStep(1);
      } else if (px < stepDistance) {
        goToStep(2);
      } else {
        // Final stretch: collapse back to the row layout while still
        // pinned, so the section is already sitting where
        // collapsedTotalH naturally rests by the time it unpins — see
        // getTotalDistance()'s comment for why that distance exists.
        goToStep(-1);
      }
    },
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
  window.addEventListener("load", refreshAll);

  // window.load doesn't cover every case — the countdown video only
  // has preload="metadata", so on a real network connection it can
  // finish loading (and settle the page's layout) well after
  // window.load already fired. A ResizeObserver on the document
  // catches that and any other late layout shift generically, instead
  // of trying to enumerate every asset that might cause one.
  function refreshAll() {
    measure();
    applyHeights(true);
    ScrollTrigger.refresh();
  }
  let observerTimer;
  const layoutObserver = new ResizeObserver(() => {
    clearTimeout(observerTimer);
    observerTimer = setTimeout(refreshAll, 150);
  });
  layoutObserver.observe(document.documentElement);

  // Defense in depth: if the container's rendered height ever drifts
  // from what the current step calls for — whatever the cause — snap
  // it back on the very next scroll tick rather than leaving it stuck
  // out of sync until something else happens to trigger a refresh.
  // Only checked while heightTimeline is idle: mid-tween, the height is
  // *intentionally* somewhere between the collapsed and expanded values
  // for ~0.4s on every legitimate step change — checking against the
  // final target during that window would flag every normal transition
  // as "drifted" and force-snap it, killing the animation outright.
  ScrollTrigger.create({
    trigger: ".stack-section",
    start: "top bottom",
    end: "bottom top",
    onUpdate: () => {
      if (heightTimeline) return;
      const expected = activeIndex === -1 ? collapsedTotalH : fullH;
      if (Math.abs(container.getBoundingClientRect().height - expected) > 2) {
        applyHeights(true);
      }
    },
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
