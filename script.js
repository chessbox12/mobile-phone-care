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
  const N = 8, angs = [];
  for (let i = 0; i < N; i++) angs.push(i / N * Math.PI * 2 + rnd(-0.12, 0.12));
  angs.sort((a, b) => a - b); angs.push(angs[0] + Math.PI * 2);
  const rings = [0, 0.20, 0.46, 1.0].map(f => f * maxR);
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

// Reduce each crack cell to a Voronoi SITE (centroid) + ring band. Nearest-site
// assignment -> every triangle lands in exactly one cell (never split -> winding stays valid).
function buildFractureCells(W, H, ix, iy, seed) {
  const polys = genShardPolys(W, H, ix, iy, seed);
  const maxd = Math.hypot(W, H) / 2;
  const cells = [];
  for (const poly of polys) {
    let cx = 0, cy = 0;
    for (const p of poly) { cx += p[0]; cy += p[1]; }
    cx /= poly.length; cy /= poly.length;
    cells.push({ cx, cy, ring: Math.min(Math.hypot(cx - ix, cy - iy) / maxd, 1) });
  }
  return { cells, ix, iy, maxd };
}
function nearestCell(cells, x, y) {
  let bi = 0, bd = Infinity;
  for (let i = 0; i < cells.length; i++) {
    const dx = cells[i].cx - x, dy = cells[i].cy - y, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; bi = i; }
  }
  return bi;
}

// the GLB's real display mesh: hardcoded name first (asset is fixed), then a
// structural fallback (flat bbox + emissiveMap + ~white emissive), else null.
const SCREEN_MESH_NAME = "xXDHkMplTIDAXLN";
function findScreenMesh(root) {
  let byName = null;
  root.traverse((o) => { if (!byName && o.isMesh && o.name === SCREEN_MESH_NAME) byName = o; });
  if (byName) return byName;
  let best = null, bestArea = 0;
  const size = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m || !m.emissiveMap || !m.emissive) return;
    if (m.emissive.r + m.emissive.g + m.emissive.b < 2.4) return; // ~white
    o.geometry.computeBoundingBox();
    o.geometry.boundingBox.getSize(size);
    const dims = [size.x, size.y, size.z].sort((a, b) => a - b);
    if (dims[0] > 1e-3 && dims[0] / (dims[2] || 1) > 0.02) return; // must be ~flat
    const area = dims[1] * dims[2];
    if (area > bestArea) { bestArea = area; best = o; }
  });
  return best;
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
    // the phone's own lock-screen wallpaper, drawn to a canvas
    function makeScreenTexture() {
      const W = 700, H = 1460;
      const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
      const ctx = cv.getContext("2d");
      const g = ctx.createRadialGradient(W * 0.5, H * 0.34, 0, W * 0.5, H * 0.42, H * 0.72);
      g.addColorStop(0, "#222a33"); g.addColorStop(0.5, "#13161c"); g.addColorStop(1, "#070809");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const glow = ctx.createRadialGradient(W * 0.5, H * 0.2, 0, W * 0.5, H * 0.2, W * 0.8);
      glow.addColorStop(0, "rgba(96,140,210,0.16)"); glow.addColorStop(1, "rgba(96,140,210,0)");
      ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center";
      ctx.fillStyle = "#f4f7fc";
      ctx.font = "300 " + Math.round(H * 0.135) + "px -apple-system,'Helvetica Neue',Arial,sans-serif";
      ctx.fillText("9:41", W / 2, H * 0.31);
      ctx.fillStyle = "rgba(214,224,240,0.85)";
      ctx.font = "500 " + Math.round(H * 0.027) + "px -apple-system,Arial,sans-serif";
      ctx.fillText("Friday, 20 June", W / 2, H * 0.356);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      const bw = W * 0.3, bh = 9, bx = W / 2 - bw / 2, by = H * 0.962;
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, bh / 2); ctx.fill(); } else ctx.fillRect(bx, by, bw, bh);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      return tex;
    }

    // mode "image": the screen picture itself is the shards (opaque, screen-space UVs);
    // mode "glass": faint reflective glass shards over the intact model surface.
    function buildShardFace(faceZ, flipX, seed, mode) {
      const rng = mulberry32(seed), rnd = (a, b) => a + rng() * (b - a);
      const ix = rnd(-0.08, 0.08) * fW, iy = rnd(-0.05, 0.18) * fH;
      const polys = genShardPolys(fW, fH, ix, iy, seed);
      const group = new THREE.Group();
      group.position.z = faceZ;
      if (flipX) group.rotation.y = Math.PI;
      group.renderOrder = 6;
      phone.add(group);
      const isImage = mode === "image";
      let imgMat = null, fillMat = null;
      if (isImage) {
        imgMat = new THREE.MeshBasicMaterial({ map: makeScreenTexture() });
        const backing = new THREE.Mesh(new THREE.PlaneGeometry(fW * 1.04, fH * 1.02), new THREE.MeshBasicMaterial({ color: 0x05060a }));
        backing.position.z = -0.008; backing.renderOrder = 4; group.add(backing);
      } else {
        // premium glass: glossy, clear-coated, picks up the room-environment reflections
        fillMat = new THREE.MeshPhysicalMaterial({ color: 0xc4d6e8, transparent: true, opacity: 0, roughness: 0.03, metalness: 0, envMapIntensity: 2.6, clearcoat: 1, clearcoatRoughness: 0.03, reflectivity: 0.6, depthWrite: false, side: THREE.DoubleSide });
      }
      const edgeMat = new THREE.LineBasicMaterial({ color: 0xeaf4ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      const maxd = Math.hypot(fW, fH) / 2;
      const shards = [];
      for (const poly of polys) {
        const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
        const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
        const shape = new THREE.Shape();
        poly.forEach((p, i) => i ? shape.lineTo(p[0] - cx, p[1] - cy) : shape.moveTo(p[0] - cx, p[1] - cy));
        const geo = new THREE.ShapeGeometry(shape);
        if (isImage) {
          const pos = geo.attributes.position, uv = [];
          for (let i = 0; i < pos.count; i++) {
            let u = (pos.getX(i) + cx + fW / 2) / fW, v = (pos.getY(i) + cy + fH / 2) / fH;
            if (flipX) u = 1 - u;
            uv.push(u, v);
          }
          geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
        }
        const holder = new THREE.Group();
        const sMesh = new THREE.Mesh(geo, isImage ? imgMat : fillMat); sMesh.renderOrder = 6;
        const sLine = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat); sLine.renderOrder = 7;
        holder.add(sMesh, sLine);
        const dir = new THREE.Vector2(cx - ix, cy - iy);
        const dist = dir.length() || 1e-3; dir.multiplyScalar(1 / dist);
        const t = Math.min(dist / maxd, 1);
        const home = new THREE.Vector3(cx, cy, 0);
        const spread = isImage ? (0.02 + t * 0.05) : (0.008 + t * 0.03);
        const lift = isImage ? (0.006 + rng() * 0.018 + t * 0.014) : (0.02 + rng() * 0.05 + t * 0.045);
        const broken = new THREE.Vector3(cx + dir.x * spread, cy + dir.y * spread, lift);
        const brot = new THREE.Euler(rnd(-0.16, 0.16), rnd(-0.16, 0.16), rnd(-0.16, 0.16));
        holder.position.copy(broken);
        holder.rotation.copy(brot);
        group.add(holder);
        shards.push({ holder, home, broken, brot, delay: (1 - t) * 0.4, dur: 0.45 + rng() * 0.12 });
      }
      return { group, fillMat, edgeMat, shards };
    }

    // Fragment the WHOLE rendered phone's own geometry/materials into ~20 reassembling
    // 3D cells: walk every triangle of all 31 meshes, bake into phone-local space, assign
    // each to the nearest fracture cell, rebuild per (cell, material) with the ORIGINAL
    // material. The union == the intact phone, so reassembly is pixel-seamless.
    function buildWholePhoneShatter(seed) {
      const PW = 1.46, PH = 3.0;                       // confirmed phone-local face W/H (slab)
      phone.updateWorldMatrix(true, false);
      modelWrap.updateWorldMatrix(true, true);
      const phoneInv = new THREE.Matrix4().copy(phone.matrixWorld).invert();

      const rng = mulberry32(seed), rnd = (a, b) => a + rng() * (b - a);
      const ix = rnd(-0.10, 0.10) * PW, iy = rnd(0.02, 0.22) * PH;   // off-center upper-mid impact
      const F = buildFractureCells(PW, PH, ix, iy, seed);
      const cells = F.cells, NC = cells.length;
      const buckets = cells.map(() => new Map());      // ci -> Map<material, {pos,nor,uv,uv2}>

      const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
      const nA = new THREE.Vector3(), nB = new THREE.Vector3(), nC = new THREE.Vector3();
      const nrm = new THREE.Matrix3();
      const meshes = [];
      modelWrap.traverse((o) => { if (o.isMesh && o.geometry) meshes.push(o); });

      for (const mesh of meshes) {
        mesh.updateWorldMatrix(true, false);
        const toLocal = new THREE.Matrix4().multiplyMatrices(phoneInv, mesh.matrixWorld);
        nrm.getNormalMatrix(toLocal);
        const flip = toLocal.determinant() < 0;        // base.ry=PI mirror -> reverse winding so FrontSide stays lit
        const g = mesh.geometry;
        const pos = g.attributes.position;
        const idx = g.index;
        if (Array.isArray(mesh.material) && mesh.material.length > 1)
          console.warn("[shatter] multi-material mesh; only material[0] used:", mesh.name);
        const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;

        // Copy EVERY source attribute by its real name (uv / uv1 / uv2 / uv3 / color / ...)
        // so whatever UV channel each map samples exists; position + normal get transformed.
        const attrs = [];
        for (const name in g.attributes) attrs.push({ name, a: g.attributes[name], size: g.attributes[name].itemSize });

        const triCount = idx ? idx.count / 3 : pos.count / 3;
        for (let t = 0; t < triCount; t++) {
          let iA = idx ? idx.getX(t * 3)     : t * 3;
          let iB = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
          let iC = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
          if (flip) { const tmp = iB; iB = iC; iC = tmp; } // keep winding consistent w/ flipped normals
          const tri = [iA, iB, iC];

          vA.fromBufferAttribute(pos, iA).applyMatrix4(toLocal);
          vB.fromBufferAttribute(pos, iB).applyMatrix4(toLocal);
          vC.fromBufferAttribute(pos, iC).applyMatrix4(toLocal);
          const ci = nearestCell(cells, (vA.x + vB.x + vC.x) / 3, (vA.y + vB.y + vC.y) / 3);

          let bk = buckets[ci].get(material);
          if (!bk) { bk = {}; for (const e of attrs) bk[e.name] = { data: [], size: e.size }; buckets[ci].set(material, bk); }
          for (const e of attrs) {
            const slot = bk[e.name] || (bk[e.name] = { data: [], size: e.size });
            const out = slot.data;
            if (e.name === "position") {
              out.push(vA.x, vA.y, vA.z, vB.x, vB.y, vB.z, vC.x, vC.y, vC.z);
            } else if (e.name === "normal") {
              nA.fromBufferAttribute(e.a, iA).applyMatrix3(nrm).normalize();
              nB.fromBufferAttribute(e.a, iB).applyMatrix3(nrm).normalize();
              nC.fromBufferAttribute(e.a, iC).applyMatrix3(nrm).normalize();
              out.push(nA.x, nA.y, nA.z, nB.x, nB.y, nB.z, nC.x, nC.y, nC.z);
            } else {
              const a = e.a, s = e.size;
              for (let j = 0; j < 3; j++) for (let k = 0; k < s; k++) out.push(a.getComponent(tri[j], k));
            }
          }
        }
      }

      // Lift TOWARD camera regardless of base.ry=PI: test camera in phone-local space.
      const camLocal = camera.getWorldPosition(new THREE.Vector3()); phone.worldToLocal(camLocal);
      const LIFT_SIGN = camLocal.z >= 0 ? 1 : -1;

      const group = new THREE.Group(); group.name = "phoneShatter"; group.renderOrder = 6;
      phone.add(group);                                // inherits scroll rotation
      const shards = [];

      for (let ci = 0; ci < NC; ci++) {
        const mats = buckets[ci];
        if (mats.size === 0) continue;                 // empty Voronoi site -> no draw call
        const holder = new THREE.Group(); holder.frustumCulled = false;
        for (const [material, bk] of mats) {
          const posBk = bk["position"];
          if (!posBk || posBk.data.length < 9) continue; // degenerate bucket
          const geo = new THREE.BufferGeometry();
          for (const name in bk) {
            if (name === "tangent") continue;            // unreliable under the transform; three derives it
            geo.setAttribute(name, new THREE.Float32BufferAttribute(bk[name].data, bk[name].size));
          }
          // Guarantee every UV channel a shared material might sample exists (alias to uv),
          // so a fragment never references an undeclared uv attribute in the compiled shader.
          let uvAttr = geo.getAttribute("uv");
          if (!uvAttr) { uvAttr = new THREE.Float32BufferAttribute(new Float32Array((posBk.data.length / 3) * 2), 2); geo.setAttribute("uv", uvAttr); }
          for (const nm of ["uv1", "uv2", "uv3"]) if (!geo.getAttribute(nm)) geo.setAttribute(nm, uvAttr);
          const piece = new THREE.Mesh(geo, material);  // ORIGINAL material (shared program/textures)
          piece.frustumCulled = false; piece.renderOrder = 6;
          holder.add(piece);
        }
        if (holder.children.length === 0) continue;
        group.add(holder);

        // BROKEN POSE — controlled, ring-scaled (inner ~static, rim flies/lifts/tumbles more)
        const c = cells[ci];
        const dir = new THREE.Vector2(c.cx - F.ix, c.cy - F.iy);
        const dist = dir.length() || 1e-3; dir.multiplyScalar(1 / dist);
        const ring = c.ring;
        const spread = 0.05 + ring * 0.24;             // controlled: stays readable as a shattered phone
        const lift   = LIFT_SIGN * (0.04 + ring * 0.18 + rng() * 0.05);
        const tum    = 0.04 + ring * 0.15;
        const broken = new THREE.Vector3(dir.x * spread, dir.y * spread, lift);
        const brot   = new THREE.Euler(rnd(-tum, tum), rnd(-tum, tum), rnd(-tum * 1.1, tum * 1.1));
        holder.position.copy(broken); holder.rotation.copy(brot);

        shards.push({ holder, home: new THREE.Vector3(0, 0, 0), broken, brot,
                      delay: ring * 0.45, dur: 0.5 + rng() * 0.12 });
      }

      // Hide intact model so exactly one copy of geometry draws (no z-fight).
      modelWrap.traverse((o) => { if (o.isMesh) o.visible = false; });
      return { group, shards, edgeMat: null, fillMat: null };
    }

    function healShards(face, p) {
      if (!face) return;
      for (const s of face.shards) {
        let e = easeOut(clamp01((p - s.delay) / s.dur));
        if (e > 0.999) e = 1;                          // snap -> exact home -> pixel-seamless reseal
        s.holder.position.lerpVectors(s.broken, s.home, e);
        s.holder.rotation.set(s.brot.x * (1 - e), s.brot.y * (1 - e), s.brot.z * (1 - e));
      }
      // bright crack edges glint while shattered, then fade out as the glass seats;
      // the glass keeps a faint sheen even when repaired (it's still glass).
      const seal = easeOut(clamp01((p - 0.5) / 0.5));  // 0 broken -> 1 fully healed
      if (face.edgeMat) face.edgeMat.opacity = 0.9 * (1 - seal);
      if (face.fillMat) face.fillMat.opacity = 0.26 - 0.16 * seal;
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
      frontFace = buildShardFace(depth / 2 + 0.006, false, 7, "glass");  // shattered front screen glass
      backFace = buildShardFace(-depth / 2 - 0.006, true, 23, "glass");  // shattered back glass
      healShards(frontFace, 0); healShards(backFace, 0);                 // render shattered at scroll top
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
          const fp = clamp01(p / 0.26), bp = clamp01((p - 0.64) / 0.22); // front repairs first, then back
          if (DESKTOP) { healShards(frontFace, fp); healShards(backFace, bp); }
          else {
            if (frontPlane) frontPlane.material.opacity = 1 - clamp01((p - 0.02) / 0.18);
            if (backPlane) backPlane.material.opacity = 1 - clamp01((p - 0.66) / 0.2);
          }
        }
      }
    });
    tl.to(phone.rotation, { y: 0,              duration: 1.0 }, 0);                        // gentle settle face-on during front repair
    tl.to(phone.rotation, { y: Math.PI,        duration: 1.5, ease: "power2.inOut" }, 1.6); // rotate to reveal the (shattered) back
    tl.to(phone.rotation, { x: -0.1,           duration: 0.75, ease: "sine.inOut" }, 1.6);
    tl.to(phone.rotation, { x: 0.04,           duration: 0.75, ease: "sine.inOut" }, 2.35);
    tl.to(phone.rotation, { y: Math.PI - 0.18, duration: 0.5 }, 4.0);

    function cap(sel, inAt, outAt) {
      const el = document.querySelector(sel);
      if (!el) return;
      if (inAt != null) tl.fromTo(el, { opacity: 0, y: 16 }, { opacity: 1, y: 0, ease: "power1.out", duration: 0.3 }, inAt);
      if (outAt != null) tl.to(el, { opacity: 0, ease: "power1.in", duration: 0.3 }, outAt);
    }
    gsap.set('[data-cap="0"]', { opacity: 1, y: 0 });
    cap('[data-cap="0"]', null, 1.0);   // "Cracked screen?" over the shattered front
    cap('[data-cap="1"]', 1.3, 2.3);    // "Healed to factory clarity." after the front repairs
    cap('[data-cap="2"]', 3.0, 3.7);    // "Shattered back glass?" as the back is revealed
    cap('[data-cap="3"]', 3.9, 4.4);    // "Restored, edge to edge." after the back repairs
    cap('[data-cap="4"]', 4.5, null);   // final CTA

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
