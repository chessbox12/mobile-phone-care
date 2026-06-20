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

/* ----- crack overlay: real shattered-glass photo, fractures extracted to alpha ----- */
function crackTexture(file, flipX) {
  const tex = new THREE.Texture();
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.center.set(0.5, 0.5);
  if (flipX) { tex.wrapS = THREE.RepeatWrapping; tex.repeat.x = -1; }
  const img = new Image();
  img.onload = () => { tex.image = img; tex.needsUpdate = true; };
  img.src = file;
  return tex;
}

/* ----- glass-shard shatter helpers ----- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Sutherland–Hodgman clip of a polygon to an axis-aligned rect
function clipRect(poly, minx, miny, maxx, maxy) {
  const lx = (a, b, x) => { const t = (x - a[0]) / (b[0] - a[0]); return [x, a[1] + t * (b[1] - a[1])]; };
  const ly = (a, b, y) => { const t = (y - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), y]; };
  const clip = (pts, inside, isect) => {
    const r = [], n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[(i + n - 1) % n], b = pts[i], ia = inside(a), ib = inside(b);
      if (ib) { if (!ia) r.push(isect(a, b)); r.push(b); }
      else if (ia) r.push(isect(a, b));
    }
    return r;
  };
  let p = poly;
  p = clip(p, q => q[0] >= minx, (a, b) => lx(a, b, minx)); if (p.length < 3) return p;
  p = clip(p, q => q[0] <= maxx, (a, b) => lx(a, b, maxx)); if (p.length < 3) return p;
  p = clip(p, q => q[1] >= miny, (a, b) => ly(a, b, miny)); if (p.length < 3) return p;
  p = clip(p, q => q[1] <= maxy, (a, b) => ly(a, b, maxy));
  return p;
}
// radial+ring shatter of a centred rect into shard polygons (ordered, not random)
function genShardPolys(W, H, ix, iy, seed) {
  const rng = mulberry32(seed), rnd = (a, b) => a + rng() * (b - a);
  let maxR = 0;
  for (const c of [[-W/2,-H/2],[W/2,-H/2],[W/2,H/2],[-W/2,H/2]]) maxR = Math.max(maxR, Math.hypot(c[0] - ix, c[1] - iy));
  maxR *= 1.05;
  const N = 11, angs = [];
  for (let i = 0; i < N; i++) angs.push(i / N * Math.PI * 2 + rnd(-0.12, 0.12));
  angs.sort((a, b) => a - b); angs.push(angs[0] + Math.PI * 2);
  const rings = [0, 0.14, 0.32, 0.58, 1.0].map(f => f * maxR);
  const polar = (a, r) => [ix + Math.cos(a) * r, iy + Math.sin(a) * r];
  const out = [];
  for (let k = 0; k < rings.length - 1; k++)
    for (let i = 0; i < N; i++) {
      const a0 = angs[i], a1 = angs[i + 1];
      const poly = k === 0
        ? [[ix, iy], polar(a0, rings[1]), polar(a1, rings[1])]
        : [polar(a0, rings[k]), polar(a1, rings[k]), polar(a1, rings[k + 1]), polar(a0, rings[k + 1])];
      const c = clipRect(poly, -W/2, -H/2, W/2, H/2);
      if (c.length >= 3) out.push(c);
    }
  return out;
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
    // After base orientation, smallest dim is depth (Z); the two larger are the face.
    const dimsArr = [dims.w, dims.h, dims.d].sort((a, b) => a - b);
    const depth = dimsArr[0], fW = dimsArr[1] * 0.9, fH = dimsArr[2] * 0.94;
    const DESKTOP = (canvas.clientWidth || window.innerWidth || 1280) >= 820;

    let frontFace = null, backFace = null, frontPlane = null, backPlane = null;
    const easeOut = (x) => 1 - Math.pow(1 - x, 3);
    const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

    /* desktop: real glass shards that reassemble (gaps between them read as the cracks) */
    function buildShardFace(faceZ, flipX, seed) {
      const rng = mulberry32(seed), rnd = (a, b) => a + rng() * (b - a);
      const ix = rnd(-0.1, 0.1) * fW, iy = rnd(-0.06, 0.2) * fH;
      const polys = genShardPolys(fW, fH, ix, iy, seed);
      const group = new THREE.Group();
      group.position.z = faceZ;
      if (flipX) group.rotation.y = Math.PI;
      group.renderOrder = 6;
      phone.add(group);
      const fillMat = new THREE.MeshStandardMaterial({ color: 0xdce8ef, transparent: true, opacity: 0, roughness: 0.12, metalness: 0, envMapIntensity: 1.7, depthWrite: false, side: THREE.DoubleSide });
      const edgeMat = new THREE.LineBasicMaterial({ color: 0xeef5ff, transparent: true, opacity: 0, depthWrite: false });
      const maxd = Math.hypot(fW, fH) / 2;
      const shards = [];
      for (const poly of polys) {
        const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
        const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
        const shape = new THREE.Shape();
        poly.forEach((p, i) => i ? shape.lineTo(p[0] - cx, p[1] - cy) : shape.moveTo(p[0] - cx, p[1] - cy));
        const geo = new THREE.ShapeGeometry(shape);
        const holder = new THREE.Group();
        holder.add(new THREE.Mesh(geo, fillMat));
        holder.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));
        const dir = new THREE.Vector2(cx - ix, cy - iy);
        const dist = dir.length() || 1e-3; dir.multiplyScalar(1 / dist);
        const t = Math.min(dist / maxd, 1);
        const home = new THREE.Vector3(cx, cy, 0);
        const broken = new THREE.Vector3(cx + dir.x * (0.006 + t * 0.022), cy + dir.y * (0.006 + t * 0.022), 0.015 + rng() * 0.04 + t * 0.03);
        const brot = new THREE.Euler(rnd(-0.16, 0.16), rnd(-0.16, 0.16), rnd(-0.1, 0.1));
        holder.position.copy(broken);
        holder.rotation.copy(brot);
        group.add(holder);
        shards.push({ holder, home, broken, brot, delay: (1 - t) * 0.4, dur: 0.45 + rng() * 0.12 });
      }
      return { group, fillMat, edgeMat, shards };
    }
    function healShards(face, p) {
      if (!face) return;
      for (const s of face.shards) {
        const e = easeOut(clamp01((p - s.delay) / s.dur));
        s.holder.position.lerpVectors(s.broken, s.home, e);
        s.holder.rotation.set(s.brot.x * (1 - e), s.brot.y * (1 - e), s.brot.z * (1 - e));
      }
      const vis = 1 - easeOut(clamp01((p - 0.7) / 0.3)); // once seated, fade edges/glass -> smooth
      face.edgeMat.opacity = 0.6 * vis;
      face.fillMat.opacity = 0.16 * vis;
    }

    /* mobile/fallback: flat crack overlay that fades */
    function flatPlane(file, z, faceBack) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(fW * 1.42, fW * 1.42),
        new THREE.MeshBasicMaterial({ map: crackTexture(file, faceBack), transparent: true, depthWrite: false })
      );
      mesh.position.z = z;
      if (faceBack) mesh.rotation.y = Math.PI;
      mesh.renderOrder = 6;
      phone.add(mesh);
      return mesh;
    }

    if (DESKTOP) {
      frontFace = buildShardFace(depth / 2 + 0.006, false, 7);
      backFace = buildShardFace(-depth / 2 - 0.006, true, 23);
      healShards(frontFace, 0); healShards(backFace, 0);
    } else {
      frontPlane = flatPlane("assets/img/crack.png", depth / 2 + 0.01, false);
      backPlane = flatPlane("assets/img/crack-back.png", -depth / 2 - 0.01, true);
    }

    phone.rotation.set(0.04, -0.22, 0);

    const bar = document.querySelector(".stage__progress span");
    const hint = document.querySelector(".scroll-hint");
    const cta = document.querySelector(".cap__cta");
    if (cta) cta.style.pointerEvents = "none";

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: "#stage", start: "top top", end: "+=560%",
        scrub: 1, pin: true, pinSpacing: true, anticipatePin: 1,
        onUpdate(self) {
          const p = self.progress;
          if (bar) bar.style.width = (p * 100).toFixed(1) + "%";
          if (hint) hint.classList.toggle("hide", p > 0.02);
          if (cta) cta.style.pointerEvents = p > 0.9 ? "auto" : "none";
          const fp = clamp01(p / 0.20), bp = clamp01((p - 0.64) / 0.22);
          if (DESKTOP) { healShards(frontFace, fp); healShards(backFace, bp); }
          else {
            if (frontPlane) frontPlane.material.opacity = 1 - clamp01((p - 0.02) / 0.18);
            if (backPlane) backPlane.material.opacity = 1 - clamp01((p - 0.66) / 0.2);
          }
        }
      }
    });
    tl.to(phone.rotation, { y: 0, duration: 1 }, 0);
    tl.to(phone.rotation, { y: Math.PI, duration: 1.5, ease: "power2.inOut" }, 1.4);
    tl.to(phone.rotation, { x: -0.1, duration: 0.75, ease: "sine.inOut" }, 1.4);
    tl.to(phone.rotation, { x: 0.04, duration: 0.75, ease: "sine.inOut" }, 2.15);
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
    window.__heal = (fp, bp) => { if (DESKTOP) { healShards(frontFace, fp || 0); healShards(backFace, bp || 0); } };
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
