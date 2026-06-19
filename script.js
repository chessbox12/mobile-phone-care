/* =========================================================================
   MOBILE PHONE CARE — "watch it heal" scroll choreography
   Pin the phone, scrub: front heals → rotate → back heals → polished.
   ========================================================================= */
(function () {
  "use strict";

  var nav = document.getElementById("nav");
  var REDUCED = false;
  try { REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  var HAS_GSAP = !!(window.gsap && window.ScrollTrigger);

  /* Navbar glass-on-scroll (always) */
  function onScrollNav() { if (nav) nav.classList.toggle("scrolled", window.scrollY > 24); }
  window.addEventListener("scroll", onScrollNav, { passive: true });
  onScrollNav();

  /* Smooth scroll (Lenis) */
  var lenis = null;
  if (!REDUCED && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
    window.lenis = lenis;
  }
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href");
      if (id === "#" || id.length < 2) return;
      var t = document.querySelector(id);
      if (!t) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(t, { offset: -64 });
      else {
        var y = t.getBoundingClientRect().top + window.scrollY - 64;
        window.scrollTo({ top: y, behavior: REDUCED ? "auto" : "smooth" });
      }
    });
  });

  if (REDUCED || !HAS_GSAP) return; // CSS shows healed phone + final caption

  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);

  if (lenis) {
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  var phone = document.getElementById("phone");
  var bar = document.querySelector(".stage__progress span");
  var hint = document.querySelector(".scroll-hint");
  var finalCta = document.querySelector(".cap__cta");
  if (finalCta) finalCta.style.pointerEvents = "none";

  // base pose + gentle float (float on the wrapper so it never fights rotation)
  gsap.set(phone, { rotationX: -5, rotationY: -12, transformPerspective: 1300 });
  gsap.to(".phone-wrap", { y: -14, duration: 4.5, ease: "sine.inOut", repeat: -1, yoyo: true });

  var tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: "#stage",
      start: "top top",
      end: "+=420%",
      scrub: 1,
      pin: true,
      pinSpacing: true,
      anticipatePin: 1,
      onUpdate: function (self) {
        if (bar) bar.style.width = (self.progress * 100).toFixed(1) + "%";
        if (hint) hint.classList.toggle("hide", self.progress > 0.02);
        if (finalCta) finalCta.style.pointerEvents = self.progress > 0.9 ? "auto" : "none";
      }
    }
  });

  // --- 1. front screen heals + settles flat ---
  tl.fromTo(phone, { rotationY: -12 }, { rotationY: 0, duration: 1 }, 0);
  tl.fromTo(".front-crack", { opacity: 1 }, { opacity: 0, ease: "power1.inOut", duration: 1 }, 0);

  // --- 2. rotate to reveal the back ---
  tl.to(phone, { rotationY: 180, ease: "power2.inOut", duration: 1.4 }, 1.4);

  // --- 3. back glass heals ---
  tl.fromTo(".back-crack", { opacity: 1 }, { opacity: 0, ease: "power1.inOut", duration: 1 }, 2.9);

  // --- 4. final polish ---
  tl.to(phone, { rotationY: 173, duration: 0.5 }, 3.9);

  /* ---- captions crossfade along the same scrub ---- */
  function cap(sel, inAt, outAt) {
    if (inAt != null) tl.fromTo(sel, { opacity: 0, y: 16 }, { opacity: 1, y: 0, ease: "power1.out", duration: 0.3 }, inAt);
    if (outAt != null) tl.to(sel, { opacity: 0, ease: "power1.in", duration: 0.3 }, outAt);
  }
  gsap.set('[data-cap="0"]', { opacity: 1, y: 0 }); // visible at the very top
  cap('[data-cap="0"]', null, 0.6);    // Cracked screen?
  cap('[data-cap="1"]', 0.85, 1.6);    // Healed to factory clarity.
  cap('[data-cap="2"]', 2.3, 3.1);     // Shattered back glass?
  cap('[data-cap="3"]', 3.3, 3.8);     // Restored, edge to edge.
  cap('[data-cap="4"]', 3.95, null);   // Your device deserves expert care. + CTA

  /* keep pin honest after fonts/layout settle */
  window.addEventListener("load", function () { ScrollTrigger.refresh(); });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }
})();
