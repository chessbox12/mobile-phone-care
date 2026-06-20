/* =========================================================================
   MOBILE PHONE CARE — Three.js "watch it heal" with a real iPhone model.
   Scroll-scrubbed: front heals → rotates → back heals → polished.
   3D model: "Apple iPhone 15 Pro Max" by Polyman (Sketchfab), CC-BY-4.0
   https://sketchfab.com/3d-models/apple-iphone-15-pro-max-black-df17520841214c1792fb8a44c6783ee7
   ========================================================================= */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
if (gsap && gsap.config) gsap.config({ nullTargetWarn: false });
const docEl = document.documentElement;
const REDUCED = docEl.classList.contains("reduced");
const NOWEBGL = docEl.classList.contains("no-webgl");
const nav = document.getElementById("nav");

/* nav glass-on-scroll */
function onScrollNav() { if (nav) nav.classList.toggle("scrolled", window.scrollY > 24); }
window.addEventListener("scroll", onScrollNav, { passive: true });
onScrollNav();

/* Lenis smooth scroll + anchors */
let lenis = null;
if (!REDUCED && window.Lenis) { lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true }); window.lenis = lenis; }
document.querySelectorAll('a[href^="#"]').forEach(function (a) {
  a.addEventListener("click", function (e) {
    const id = a.getAttribute("href");
    if (id === "#" || id.length < 2) return;
    const t = document.querySelector(id);
    if (!t) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(t, { offset: -64 });
    else { const y = t.getBoundingClientRect().top + window.scrollY - 64; window.scrollTo({ top: y, behavior: REDUCED ? "auto" : "smooth" }); }
  });
});

/* ----- crack overlay art → texture ----- */
const SCREEN_W = 600, SCREEN_H = 1240, RX = 70;
function svgTexture(svg, { flipX = false } = {}) {
  const tex = new THREE.Texture();
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (flipX) { tex.wrapS = THREE.RepeatWrapping; tex.repeat.x = -1; }
  const img = new Image();
  img.onload = () => { tex.image = img; tex.needsUpdate = true; };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  return tex;
}
function crackSVG(cx, cy) {
  const lines = [
    `${cx},${cy} ${cx + 72},${cy - 180} ${cx + 100},${cy - 344} ${cx + 148},${cy - 508}`,
    `${cx},${cy} ${cx + 180},${cy - 56} ${cx + 280},${cy - 156} ${cx + 320},${cy - 220}`,
    `${cx},${cy} ${cx + 148},${cy + 120} ${cx + 240},${cy + 280} ${cx + 320},${cy + 440}`,
    `${cx},${cy} ${cx - 8},${cy + 240} ${cx - 40},${cy + 440} ${cx - 68},${cy + 624}`,
    `${cx},${cy} ${cx - 140},${cy + 112} ${cx - 244},${cy + 216} ${cx - 320},${cy + 336}`,
    `${cx},${cy} ${cx - 108},${cy - 116} ${cx - 212},${cy - 208} ${cx - 300},${cy - 300}`,
    `${cx},${cy} ${cx - 28},${cy - 176} ${cx - 64},${cy - 344} ${cx - 96},${cy - 520}`
  ].map(p => `<polyline points="${p}"/>`).join("");
  const ring = [
    `${cx + 100},${cy - 344} ${cx + 156},${cy - 212} ${cx + 212},${cy - 36} ${cx + 148},${cy + 120}`,
    `${cx - 108},${cy - 116} ${cx - 140},${cy + 112} ${cx - 8},${cy + 240} ${cx + 148},${cy + 120}`
  ].map(p => `<polyline points="${p}" stroke-opacity=".34"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SCREEN_W}" height="${SCREEN_H}" viewBox="0 0 ${SCREEN_W} ${SCREEN_H}">
    <defs>
      <radialGradient id="i" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".4" stop-color="#dfe3ea" stop-opacity=".22"/><stop offset="1" stop-color="#dfe3ea" stop-opacity="0"/></radialGradient>
      <clipPath id="c"><rect x="0" y="0" width="${SCREEN_W}" height="${SCREEN_H}" rx="${RX}"/></clipPath>
    </defs>
    <g clip-path="url(#c)">
      <circle cx="${cx}" cy="${cy}" r="230" fill="url(#i)"/>
      <g fill="#cfd4dd" opacity=".10"><polygon points="${cx},${cy} ${cx + 110},${cy - 156} ${cx + 240},${cy - 56} ${cx + 144},${cy + 60}"/><polygon points="${cx},${cy} ${cx + 144},${cy + 60} ${cx + 92},${cy + 280} ${cx - 40},${cy + 200}"/><polygon points="${cx},${cy} ${cx - 40},${cy + 200} ${cx - 188},${cy + 144} ${cx - 140},${cy - 56}"/></g>
      <g fill="none" stroke="#f4f6fa" stroke-opacity=".72" stroke-width="2.4" stroke-linejoin="round">${lines}${ring}</g>
    </g>
  </svg>`;
}

/* boot (after consts) */
if (REDUCED || NOWEBGL || !window.gsap || !window.ScrollTrigger) {
  docEl.classList.add("no-webgl");
} else {
  try { init3D(); }
  catch (e) { window.__initErr = (e && e.stack) || String(e); console.error("init3D failed", e); docEl.classList.add("no-webgl"); }
}

function init3D() {
  gsap.registerPlugin(ScrollTrigger);
  const canvas = document.getElementById("gl");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 100);
  camera.position.set(0, 0, 13);
  const params = { phoneY: 0.4 };

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const key = new THREE.DirectionalLight(0xfff4e2, 2.0); key.position.set(4, 6, 7); scene.add(key);
  const rim = new THREE.DirectionalLight(0xbcd4ff, 1.0); rim.position.set(-5, 2, -4); scene.add(rim);

  const phone = new THREE.Group();   // scroll rotation applies here
  scene.add(phone);
  const modelWrap = new THREE.Group(); // holds the loaded model + its base orientation
  phone.add(modelWrap);

  // base orientation of the raw model: the GLB's screen faces -Z natively,
  // so spin 180° about Y to face the camera at rest.
  const base = { rx: 0, ry: Math.PI, rz: 0, scale: 1 };
  function applyBase() { modelWrap.rotation.set(base.rx, base.ry, base.rz); }
  applyBase();

  const TARGET_H = 3.0;
  let dims = { w: 1.4, h: 3, d: 0.2 };
  let frontCrack = null, backCrack = null, started = false;

  /* ---- load the iPhone model ---- */
  const draco = new DRACOLoader();
  draco.setDecoderPath("assets/vendor/addons/libs/draco/gltf/");
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  loader.load("assets/models/iphone15.glb", (gltf) => {
    const m = gltf.scene;
    const box = new THREE.Box3().setFromObject(m);
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    m.position.sub(center);
    const maxDim = Math.max(size.x, size.y, size.z);
    const s = TARGET_H / maxDim;
    m.scale.setScalar(s);
    dims = { w: size.x * s, h: size.y * s, d: size.z * s };
    m.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    modelWrap.add(m);
    buildCracksAndScroll();
  }, undefined, (err) => {
    console.error("iPhone model failed to load", err);
    docEl.classList.add("no-webgl");
  });

  /* ---- crack overlays + scroll choreography (after model ready) ---- */
  function buildCracksAndScroll() {
    const faceW = Math.min(dims.w, dims.h, dims.d) === dims.w ? dims.h : dims.w; // safety
    // After base orientation, smallest dim is depth (Z); the two larger are the face.
    const dimsArr = [dims.w, dims.h, dims.d].sort((a, b) => a - b);
    const depth = dimsArr[0], fW = dimsArr[1] * 0.9, fH = dimsArr[2] * 0.94;

    function plane(tex, z, faceBack) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(fW, fH),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 1 })
      );
      mesh.position.z = z;
      if (faceBack) mesh.rotation.y = Math.PI;
      mesh.renderOrder = 5;
      phone.add(mesh);
      return mesh;
    }
    frontCrack = plane(svgTexture(crackSVG(300, 560)), depth / 2 + 0.01, false);
    backCrack = plane(svgTexture(crackSVG(300, 560), { flipX: true }), -depth / 2 - 0.01, true);

    phone.rotation.set(0.04, -0.22, 0);

    const bar = document.querySelector(".stage__progress span");
    const hint = document.querySelector(".scroll-hint");
    const cta = document.querySelector(".cap__cta");
    if (cta) cta.style.pointerEvents = "none";

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: "#stage", start: "top top", end: "+=520%",
        scrub: 1, pin: true, pinSpacing: true, anticipatePin: 1,
        onUpdate(self) {
          if (bar) bar.style.width = (self.progress * 100).toFixed(1) + "%";
          if (hint) hint.classList.toggle("hide", self.progress > 0.02);
          if (cta) cta.style.pointerEvents = self.progress > 0.9 ? "auto" : "none";
        }
      }
    });
    tl.to(phone.rotation, { y: 0, duration: 1 }, 0);
    tl.to(frontCrack.material, { opacity: 0, duration: 1, ease: "power1.inOut" }, 0);
    tl.to(phone.rotation, { y: Math.PI, duration: 1.5, ease: "power2.inOut" }, 1.4);
    tl.to(phone.rotation, { x: -0.1, duration: 0.75, ease: "sine.inOut" }, 1.4);
    tl.to(phone.rotation, { x: 0.04, duration: 0.75, ease: "sine.inOut" }, 2.15);
    tl.to(backCrack.material, { opacity: 0, duration: 1, ease: "power1.inOut" }, 2.95);
    tl.to(phone.rotation, { y: Math.PI - 0.18, duration: 0.5 }, 3.9);

    function cap(sel, inAt, outAt) {
      const el = document.querySelector(sel);
      if (!el) return;
      if (inAt != null) tl.fromTo(el, { opacity: 0, y: 16 }, { opacity: 1, y: 0, ease: "power1.out", duration: 0.3 }, inAt);
      if (outAt != null) tl.to(el, { opacity: 0, ease: "power1.in", duration: 0.3 }, outAt);
    }
    gsap.set('[data-cap="0"]', { opacity: 1, y: 0 });
    cap('[data-cap="0"]', null, 0.6);
    cap('[data-cap="1"]', 0.85, 1.6);
    cap('[data-cap="2"]', 2.35, 3.1);
    cap('[data-cap="3"]', 3.3, 3.8);
    cap('[data-cap="4"]', 3.95, null);

    if (lenis) {
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }
    started = true;
    canvas.classList.add("is-ready");
    ScrollTrigger.refresh();
  }

  /* ---- sizing ---- */
  function resize() {
    const w = canvas.clientWidth || window.innerWidth || 1280;
    const h = canvas.clientHeight || window.innerHeight || 800;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  window.addEventListener("resize", resize);
  resize();

  /* ---- render loop ---- */
  const clock = new THREE.Clock();
  function loop() {
    const t = clock.getElapsedTime();
    phone.position.y = params.phoneY + Math.sin(t * 0.8) * 0.04;
    phone.rotation.z = started ? phone.rotation.z : 0;
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  loop();

  window.addEventListener("load", () => ScrollTrigger.refresh());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());

  // small debug handle (harmless)
  window.__mpc = { renderer, scene, camera, phone, st: () => ScrollTrigger.getAll().find(t => t.pin) };
}
