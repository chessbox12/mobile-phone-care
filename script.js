/* =========================================================================
   MOBILE PHONE CARE — scroll choreography
   Lenis smooth-scroll + GSAP ScrollTrigger. Degrades gracefully.
   ========================================================================= */
(function () {
  "use strict";

  var nav = document.getElementById("nav");
  var toggle = document.getElementById("navToggle");
  var scrim = document.getElementById("menuScrim");
  var NAV_OFFSET = 72;

  var REDUCED = false;
  try { REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  var HAS_GSAP = !!(window.gsap && window.ScrollTrigger);

  /* ---------------------------------------------------------------------
     Mobile menu  (always on)
     --------------------------------------------------------------------- */
  function setMenu(open) {
    document.body.classList.toggle("menu-open", open);
    if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (toggle) toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    var menu = document.getElementById("mobileMenu");
    if (menu) menu.setAttribute("aria-hidden", open ? "false" : "true");
    if (scrim) scrim.hidden = !open;
    document.documentElement.style.overflow = open ? "hidden" : "";
  }
  if (toggle) toggle.addEventListener("click", function () {
    setMenu(!document.body.classList.contains("menu-open"));
  });
  if (scrim) scrim.addEventListener("click", function () { setMenu(false); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setMenu(false);
  });

  /* ---------------------------------------------------------------------
     Navbar glass-on-scroll  (always on)
     --------------------------------------------------------------------- */
  function onScrollNav() {
    if (nav) nav.classList.toggle("scrolled", window.scrollY > 24);
  }
  window.addEventListener("scroll", onScrollNav, { passive: true });
  onScrollNav();

  /* ---------------------------------------------------------------------
     Lenis smooth scroll (skipped when reduced / no GSAP)
     --------------------------------------------------------------------- */
  var lenis = null;
  if (!REDUCED && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true });
  }

  // Anchor links → smooth scroll + close menu
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href");
      if (id === "#" || id.length < 2) return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      setMenu(false);
      if (lenis) {
        lenis.scrollTo(target, { offset: -NAV_OFFSET });
      } else {
        var y = target.getBoundingClientRect().top + window.scrollY - NAV_OFFSET;
        window.scrollTo({ top: y, behavior: REDUCED ? "auto" : "smooth" });
      }
    });
  });

  /* ---------------------------------------------------------------------
     Count-up stats  (works in every mode)
     --------------------------------------------------------------------- */
  function formatCount(el, value) {
    var decimals = parseInt(el.dataset.decimals || "0", 10);
    var suffix = el.dataset.suffix || "";
    var out;
    if (el.dataset.format === "k" && value >= 1000) {
      out = Math.round(value / 1000) + "k";
    } else {
      out = value.toFixed(decimals);
    }
    return out + suffix;
  }
  var counters = Array.prototype.slice.call(document.querySelectorAll("[data-count]"));

  function runCounter(el) {
    var target = parseFloat(el.dataset.count);
    if (REDUCED || !HAS_GSAP) { el.textContent = formatCount(el, target); return; }
    var obj = { v: 0 };
    window.gsap.to(obj, {
      v: target,
      duration: 1.8,
      ease: "power2.out",
      onUpdate: function () { el.textContent = formatCount(el, obj.v); },
      onComplete: function () { el.textContent = formatCount(el, target); }
    });
  }

  /* ---------------------------------------------------------------------
     Reduced motion / no GSAP — set finals, bail out of animation
     --------------------------------------------------------------------- */
  if (REDUCED || !HAS_GSAP) {
    counters.forEach(function (el) { el.textContent = formatCount(el, parseFloat(el.dataset.count)); });
    return;
  }

  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);

  // Drive ScrollTrigger from Lenis
  if (lenis) {
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  /* ---- Generic reveal-on-scroll ---- */
  ScrollTrigger.batch("[data-reveal]", {
    start: "top 88%",
    onEnter: function (batch) {
      gsap.to(batch, {
        opacity: 1, y: 0, duration: 0.85, ease: "power3.out", stagger: 0.08, overwrite: true
      });
    }
  });

  /* ---- Hero: floating device + broken → fixed crossfade ---- */
  gsap.to(".hero-phone", {
    y: -16, rotation: 1.4, duration: 4.5, ease: "sine.inOut", repeat: -1, yoyo: true
  });
  gsap.to(".phone-broken", {
    opacity: 0, ease: "none",
    scrollTrigger: { trigger: "#hero", start: "top top", end: "bottom top", scrub: true }
  });
  gsap.to(".phone-fixed", {
    opacity: 1, ease: "none",
    scrollTrigger: { trigger: "#hero", start: "15% top", end: "bottom top", scrub: true }
  });
  // Hero parallax: text drifts up, orbs drift
  gsap.to(".hero__copy", {
    yPercent: -8, ease: "none",
    scrollTrigger: { trigger: "#hero", start: "top top", end: "bottom top", scrub: true }
  });
  gsap.to(".hero .orb--blue", {
    yPercent: 24, ease: "none",
    scrollTrigger: { trigger: "#hero", start: "top top", end: "bottom top", scrub: true }
  });

  /* ---- Problem → solution: pinned crossfade sequence ---- */
  var steps = gsap.utils.toArray(".problem__step");
  if (steps.length) {
    gsap.set(steps[0], { opacity: 1, y: 0 });
    var bar = document.querySelector(".problem__progress span");
    var ptl = gsap.timeline({
      scrollTrigger: {
        trigger: "#problem",
        start: "top top",
        end: "bottom bottom",
        scrub: 0.6,
        onUpdate: function (self) { if (bar) bar.style.width = (self.progress * 100).toFixed(1) + "%"; }
      }
    });
    steps.forEach(function (step, i) {
      if (i > 0) ptl.fromTo(step, { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: 0.4 }, i);
      if (i < steps.length - 1) ptl.to(step, { opacity: 0, y: -34, duration: 0.4 }, i + 0.6);
    });
  }

  /* ---- Board-level: draw circuit traces ---- */
  gsap.to(".trace", {
    strokeDashoffset: 0, stagger: 0.06, duration: 1.4, ease: "power2.out",
    scrollTrigger: { trigger: "#board", start: "top 72%" }
  });
  gsap.fromTo(".circuit-chip",
    { scale: 0.94, opacity: 0.4 },
    { scale: 1, opacity: 1, transformOrigin: "center", duration: 1.2, ease: "power2.out",
      scrollTrigger: { trigger: "#board", start: "top 70%" } });

  /* ---- Stats: count up on enter ---- */
  counters.forEach(function (el) {
    ScrollTrigger.create({ trigger: el, start: "top 88%", once: true, onEnter: function () { runCounter(el); } });
  });

  /* ---- Service cards: subtle extra hover-tilt handled in CSS; nothing here ---- */

  /* ---- Keep triggers honest across font load / resize ---- */
  window.addEventListener("load", function () { ScrollTrigger.refresh(); });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }
})();
